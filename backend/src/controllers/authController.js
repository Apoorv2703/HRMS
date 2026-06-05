const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// Helper to generate access token
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      tenantId: user.tenantId,
      role: user.role,
    },
    process.env.JWT_SECRET || 'fallback_secret_key',
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

// Helper to generate a refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

// Controller functions
exports.registerTenant = async (req, res) => {
  const { companyName, subdomain, email, password } = req.body;

  if (!companyName || !subdomain || !email || !password) {
    return res.status(400).json({ error: 'All fields (companyName, subdomain, email, password) are required.' });
  }

  try {
    // Check if subdomain is already taken
    const existingTenant = await Tenant.findOne({ subdomain });
    if (existingTenant) {
      return res.status(400).json({ error: 'Subdomain is already registered.' });
    }

    // Create the tenant
    const tenant = new Tenant({
      name: companyName,
      subdomain: subdomain,
    });
    await tenant.save();

    // Create the admin user for this tenant
    const adminUser = new User({
      tenantId: tenant._id,
      email,
      passwordHash: password, // Pre-save hook will hash it
      role: 'HR_ADMIN',
    });
    await adminUser.save();

    // Create Audit Log
    await AuditLog.create({
      tenantId: tenant._id,
      userId: adminUser._id,
      action: 'TENANT_REGISTRATION',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { companyName, subdomain, adminEmail: email },
    });

    return res.status(201).json({
      message: 'Tenant and HR Admin account registered successfully.',
      tenant: {
        id: tenant._id,
        name: tenant.name,
        subdomain: tenant.subdomain,
      },
    });
  } catch (err) {
    console.error('Register Tenant Error:', err);
    return res.status(500).json({ error: 'Internal server error during tenant registration.' });
  }
};

exports.login = async (req, res) => {
  const { email, password, subdomain } = req.body;

  if (!email || !password || !subdomain) {
    return res.status(400).json({ error: 'Email, password, and subdomain are required.' });
  }

  try {
    // Lookup tenant
    const tenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase(), isActive: true });
    if (!tenant) {
      return res.status(401).json({ error: 'Invalid subdomain or inactive tenant.' });
    }

    // Find user within this tenant
    const user = await User.findOne({ tenantId: tenant._id, email: email.toLowerCase() });
    if (!user) {
      // Log failed login attempt anonymously (to prevent user enumeration)
      await AuditLog.create({
        tenantId: tenant._id,
        action: 'LOGIN_FAILED_UNKNOWN_USER',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { attemptedEmail: email },
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check if locked
    if (user.isLocked()) {
      const lockTimeRemaining = Math.ceil((user.lockoutUntil - Date.now()) / 1000 / 60);
      return res.status(423).json({
        error: `Account is temporarily locked due to excessive failed attempts. Try again in ${lockTimeRemaining} minutes.`,
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts += 1;

      let responseMsg = 'Invalid email or password.';
      let loggedAction = 'LOGIN_FAILED';

      // Check lockout threshold
      const lockoutAttempts = tenant.settings?.passwordPolicy?.lockoutAttempts || 5;
      const lockoutDuration = tenant.settings?.passwordPolicy?.lockoutDurationMinutes || 15;

      if (user.failedLoginAttempts >= lockoutAttempts) {
        user.lockoutUntil = Date.now() + lockoutDuration * 60 * 1000;
        loggedAction = 'ACCOUNT_LOCKED';
        responseMsg = `Account is now locked for ${lockoutDuration} minutes due to excessive failed attempts.`;
      } else {
        const remaining = lockoutAttempts - user.failedLoginAttempts;
        responseMsg = `Invalid email or password. You have ${remaining} attempts remaining before lockout.`;
      }

      await user.save();

      // Log failure
      await AuditLog.create({
        tenantId: tenant._id,
        userId: user._id,
        action: loggedAction,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: { email: user.email, failedAttempts: user.failedLoginAttempts },
      });

      return res.status(401).json({ error: responseMsg });
    }

    // Login successful
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    // Store session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Limit active sessions to 5 to prevent array bloating
    if (user.sessions.length >= 5) {
      user.sessions.shift(); // Remove oldest
    }

    user.sessions.push({
      token: refreshToken,
      expiresAt,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await user.save();

    // Log success
    await AuditLog.create({
      tenantId: tenant._id,
      userId: user._id,
      action: 'LOGIN_SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Set Refresh Token in secure cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      token: accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
};

exports.refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'Refresh token missing.' });
  }

  try {
    // Find user containing the active session token
    const user = await User.findOne({ 'sessions.token': token });
    if (!user) {
      return res.status(401).json({ error: 'Session not found or expired.' });
    }

    // Extract active session
    const sessionIndex = user.sessions.findIndex((s) => s.token === token);
    const session = user.sessions[sessionIndex];

    // Check expiration
    if (session.expiresAt < Date.now()) {
      user.sessions.splice(sessionIndex, 1); // Remove expired session
      await user.save();
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    // Rotate Refresh Token
    const newRefreshToken = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Update session
    session.token = newRefreshToken;
    session.expiresAt = expiresAt;
    session.ip = req.ip;
    session.userAgent = req.headers['user-agent'];

    await user.save();

    // Generate new Access Token
    const accessToken = generateAccessToken(user);

    // Set new secure cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ token: accessToken });
  } catch (err) {
    console.error('Refresh Token Error:', err);
    return res.status(500).json({ error: 'Internal server error during token refresh.' });
  }
};

exports.logout = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(200).json({ message: 'Already logged out.' });
  }

  try {
    const user = await User.findOne({ 'sessions.token': token });
    if (user) {
      // Remove current session
      user.sessions = user.sessions.filter((s) => s.token !== token);
      await user.save();

      // Log logout event
      await AuditLog.create({
        tenantId: user.tenantId,
        userId: user._id,
        action: 'LOGOUT',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    res.clearCookie('refreshToken');
    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout Error:', err);
    return res.status(500).json({ error: 'Internal server error during logout.' });
  }
};

exports.getSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Map sessions to exclude raw refresh tokens
    const activeSessions = user.sessions.map((s) => ({
      id: s._id,
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));

    return res.status(200).json({ sessions: activeSessions });
  } catch (err) {
    console.error('Get Sessions Error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
