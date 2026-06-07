import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verify } from 'otplib';
import qrcode from 'qrcode';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import AuditLog from '../models/AuditLog.js';
import { validatePassword } from '../utils/passwordValidator.js';
import { sendPasswordResetEmail } from '../utils/emailService.js';

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

const findTenantBySubdomainOrName = async (input) => {
  if (!input) return null;
  const searchVal = input.trim().toLowerCase();
  
  // 1. Try exact subdomain match
  let tenant = await Tenant.findOne({ subdomain: searchVal, isActive: true });
  if (tenant) return tenant;
  
  // 2. Try exact name match (case-insensitive)
  const escapedInput = searchVal.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  tenant = await Tenant.findOne({
    name: { $regex: new RegExp("^" + escapedInput + "$", "i") },
    isActive: true
  });
  if (tenant) return tenant;

  // 3. Typo handling (common crop/corp swaps)
  let fallbackSearch = searchVal;
  if (searchVal.includes('corp')) {
    fallbackSearch = searchVal.replace('corp', 'crop');
  } else if (searchVal.includes('crop')) {
    fallbackSearch = searchVal.replace('crop', 'corp');
  }
  
  if (fallbackSearch !== searchVal) {
    const escapedFallback = fallbackSearch.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    tenant = await Tenant.findOne({
      $or: [
        { subdomain: fallbackSearch },
        { name: { $regex: new RegExp("^" + escapedFallback + "$", "i") } }
      ],
      isActive: true
    });
    if (tenant) return tenant;
  }

  // 4. Partial name match (e.g. typing "redvision" matches "redvision crop")
  tenant = await Tenant.findOne({
    name: { $regex: new RegExp(escapedInput, "i") },
    isActive: true
  });
  if (tenant) return tenant;

  return null;
};

// Controller functions
export const registerTenant = async (req, res) => {
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

    // Check default password policy for new HR admin account before saving anything
    const defaultPolicy = { minLength: 8, requireSpecial: true, requireNumbers: true, requireUppercase: true };
    const passValidation = validatePassword(password, defaultPolicy);
    if (!passValidation.isValid) {
      return res.status(400).json({ error: `Password policy violation: ${passValidation.error}` });
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

    // Create Employee record for the admin user
    const emailPrefix = email.split('@')[0];
    const firstName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    const adminEmployee = new Employee({
      tenantId: tenant._id,
      userId: adminUser._id,
      employeeId: 'ADMIN-00001',
      personal: {
        firstName,
        lastName: 'Admin',
        personalEmail: email,
      },
      employment: {
        joiningDate: new Date(),
        status: 'ACTIVE',
        department: 'Human Resources',
        designation: 'HR Administrator',
        location: 'HQ',
      }
    });
    await adminEmployee.save();

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

export const login = async (req, res) => {
  const { email, password, subdomain } = req.body;

  if (!email || !password || !subdomain) {
    return res.status(400).json({ error: 'Email, password, and subdomain are required.' });
  }

  try {
    // Lookup tenant
    const tenant = await findTenantBySubdomainOrName(subdomain);
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

    // Check password expiry (policy parameter)
    const expiryDays = tenant.settings?.passwordPolicy?.passwordExpiryDays ?? 90;
    if (expiryDays > 0 && user.passwordChangedAt) {
      const expiryMs = expiryDays * 24 * 60 * 60 * 1000;
      const isExpired = user.passwordChangedAt.getTime() + expiryMs < Date.now();
      if (isExpired) {
        // Log expired status
        await AuditLog.create({
          tenantId: tenant._id,
          userId: user._id,
          action: 'LOGIN_BLOCKED_PASSWORD_EXPIRED',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
        return res.status(403).json({
          error: 'Your password has expired. You must change it to gain access.',
          code: 'PASSWORD_EXPIRED',
          userId: user._id,
          email: user.email,
          subdomain: tenant.subdomain,
        });
      }
    }

    // Check if MFA is required or enabled
    if (tenant.settings?.mfaRequired || user.mfaEnabled) {
      const tempToken = jwt.sign(
        { userId: user._id, tenantId: tenant._id, isMfaPending: true },
        process.env.JWT_SECRET || 'fallback_secret_key',
        { expiresIn: '5m' }
      );

      await AuditLog.create({
        tenantId: tenant._id,
        userId: user._id,
        action: 'LOGIN_MFA_CHALLENGE',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(200).json({
        mfaRequired: true,
        tempToken,
        email: user.email,
        subdomain: tenant.subdomain,
      });
    }

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
      secure: true,
      sameSite: 'none',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      token: accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
};

export const refreshToken = async (req, res) => {
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
      secure: true,
      sameSite: 'none',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      token: accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (err) {
    console.error('Refresh Token Error:', err);
    return res.status(500).json({ error: 'Internal server error during token refresh.' });
  }
};

export const logout = async (req, res) => {
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

export const getSessions = async (req, res) => {
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

export const resetExpiredPassword = async (req, res) => {
  const { subdomain, email, currentPassword, newPassword } = req.body;

  if (!subdomain || !email || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const tenant = await Tenant.findOne({ subdomain: subdomain.toLowerCase(), isActive: true });
    if (!tenant) {
      return res.status(400).json({ error: 'Invalid subdomain or inactive tenant.' });
    }

    const user = await User.findOne({ tenantId: tenant._id, email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ error: 'User does not exist.' });
    }

    // Verify current password first
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect current password.' });
    }

    // Validate new password against tenant policy
    const policy = tenant.settings?.passwordPolicy || { minLength: 8, requireSpecial: true, requireNumbers: true, requireUppercase: true };
    const passValidation = validatePassword(newPassword, policy);
    if (!passValidation.isValid) {
      return res.status(400).json({ error: `Password policy violation: ${passValidation.error}` });
    }

    // Prohibit matching the old password
    const isSame = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSame) {
      return res.status(400).json({ error: 'New password cannot be identical to your current password.' });
    }

    // Update password
    user.passwordHash = newPassword; // Pre-save hook hashes it and resets passwordChangedAt
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    await user.save();

    // Log password update event
    await AuditLog.create({
      tenantId: tenant._id,
      userId: user._id,
      action: 'PASSWORD_EXPIRY_RESET',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ message: 'Password updated successfully. Please log in with your new password.' });
  } catch (err) {
    console.error('Reset Expired Password Error:', err);
    return res.status(500).json({ error: 'Internal server error during password reset.' });
  }
};

export const setupMfa = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.mfaEnabled) {
      return res.status(400).json({ error: 'MFA is already setup and active on this account.' });
    }

    const secret = generateSecret();
    const otpauth = generateURI({
      secret,
      label: user.email,
      issuer: 'HRMS-Platform',
    });

    const qrCodeUrl = await qrcode.toDataURL(otpauth);

    user.mfaSecret = secret;
    await user.save();

    return res.status(200).json({
      qrCodeUrl,
      secret
    });
  } catch (err) {
    console.error('Setup MFA Error:', err);
    return res.status(500).json({ error: 'Internal server error during MFA setup.' });
  }
};

export const enableMfa = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Verification code is required.' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.mfaEnabled) {
      return res.status(400).json({ error: 'MFA is already active.' });
    }

    if (!user.mfaSecret) {
      return res.status(400).json({ error: 'Initialize MFA setup first.' });
    }

    const result = await verify({ token, secret: user.mfaSecret });
    const isValid = result?.valid === true;
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code. Try again.' });
    }

    user.mfaEnabled = true;
    await user.save();

    await AuditLog.create({
      tenantId: user.tenantId,
      userId: user._id,
      action: 'MFA_ENABLED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ message: 'MFA activated successfully.' });
  } catch (err) {
    console.error('Enable MFA Error:', err);
    return res.status(500).json({ error: 'Internal server error enabling MFA.' });
  }
};

export const verifyMfa = async (req, res) => {
  const { token, tempToken } = req.body;

  if (!token || !tempToken) {
    return res.status(400).json({ error: 'OTP code and transaction token are required.' });
  }

  try {
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET || 'fallback_secret_key');
    if (!decoded.isMfaPending) {
      return res.status(401).json({ error: 'Invalid security verification context.' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User record not found.' });
    }

    const tenant = await Tenant.findById(decoded.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant record not found.' });
    }

    const result = await verify({ token, secret: user.mfaSecret });
    const isValid = result?.valid === true;
    if (!isValid) {
      await AuditLog.create({
        tenantId: user.tenantId,
        userId: user._id,
        action: 'LOGIN_MFA_FAILED',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return res.status(401).json({ error: 'Invalid authenticator code.' });
    }

    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    if (user.sessions.length >= 5) {
      user.sessions.shift();
    }

    user.sessions.push({
      token: refreshToken,
      expiresAt,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await user.save();

    await AuditLog.create({
      tenantId: user.tenantId,
      userId: user._id,
      action: 'LOGIN_SUCCESS_MFA',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      token: accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (err) {
    console.error('Verify MFA Error:', err);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'MFA transaction expired. Please try logging in again.' });
    }
    return res.status(500).json({ error: 'Internal server error during MFA login verification.' });
  }
};

export const googleLogin = async (req, res) => {
  const { code, subdomain } = req.body;

  if (!code || !subdomain) {
    return res.status(400).json({ error: 'OAuth code and subdomain are required.' });
  }

  try {
    const tenant = await findTenantBySubdomainOrName(subdomain);
    if (!tenant) {
      return res.status(400).json({ error: 'Invalid subdomain or inactive tenant.' });
    }

    let email = '';
    
    // Fallback for mock testing if Google OAuth environment variables are missing
    if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'MOCK_CLIENT_ID') {
      if (code.includes('@')) {
        email = code.toLowerCase();
      } else {
        email = `admin@${tenant.subdomain}.com`;
      }
    } else {
      // Exchange OAuth code for access token using Node native fetch
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Google OAuth token exchange failed:', tokenResponse.status, errorText);
        throw new Error(`Failed to exchange Google OAuth code: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        console.error('Google OAuth profile fetch failed:', profileResponse.status, errorText);
        throw new Error(`Failed to fetch user info from Google: ${errorText}`);
      }

      const profileData = await profileResponse.json();
      email = profileData.email.toLowerCase();
    }

    const user = await User.findOne({ tenantId: tenant._id, email });
    if (!user) {
      return res.status(401).json({ error: `SSO Error: User with email ${email} is not registered in this tenant workspace.` });
    }

    // Connect user and issue tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    if (user.sessions.length >= 5) {
      user.sessions.shift();
    }

    user.sessions.push({
      token: refreshToken,
      expiresAt,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    await user.save();

    await AuditLog.create({
      tenantId: tenant._id,
      userId: user._id,
      action: 'LOGIN_SUCCESS_GOOGLE_SSO',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      token: accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (err) {
    console.error('Google OAuth Login Error:', err);
    return res.status(500).json({ error: 'Internal server error during Google SSO authentication.' });
  }
};

export const microsoftLogin = async (req, res) => {
  const { code, subdomain } = req.body;

  if (!code || !subdomain) {
    return res.status(400).json({ error: 'OAuth code and subdomain are required.' });
  }

  try {
    const tenant = await findTenantBySubdomainOrName(subdomain);
    if (!tenant) {
      return res.status(400).json({ error: 'Invalid subdomain or inactive tenant.' });
    }

    let email = '';

    if (!process.env.MICROSOFT_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID === 'MOCK_CLIENT_ID') {
      if (code.includes('@')) {
        email = code.toLowerCase();
      } else {
        email = `admin@${tenant.subdomain}.com`;
      }
    } else {
      // Exchange OAuth code for Azure AD token
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
          redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange Microsoft OAuth token.');
      }

      const tokenData = await tokenResponse.json();
      const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to fetch user profile from Microsoft Graph API.');
      }

      const profileData = await profileResponse.json();
      email = (profileData.mail || profileData.userPrincipalName).toLowerCase();
    }

    const user = await User.findOne({ tenantId: tenant._id, email });
    if (!user) {
      return res.status(401).json({ error: `SSO Error: User with email ${email} is not registered in this tenant workspace.` });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    if (user.sessions.length >= 5) {
      user.sessions.shift();
    }

    user.sessions.push({
      token: refreshToken,
      expiresAt,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    await user.save();

    await AuditLog.create({
      tenantId: tenant._id,
      userId: user._id,
      action: 'LOGIN_SUCCESS_MICROSOFT_SSO',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      token: accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (err) {
    console.error('Microsoft OAuth Login Error:', err);
    return res.status(500).json({ error: 'Internal server error during Microsoft SSO authentication.' });
  }
};

export const samlCallback = async (req, res) => {
  const { SAMLResponse, subdomain } = req.body;

  if (!SAMLResponse || !subdomain) {
    return res.status(400).json({ error: 'SAML Assertion payload and subdomain are required.' });
  }

  try {
    const tenant = await findTenantBySubdomainOrName(subdomain);
    if (!tenant) {
      return res.status(400).json({ error: 'Invalid subdomain or inactive tenant.' });
    }

    let email = '';

    // Mock/Demo XML Assertion decoding fallback
    if (SAMLResponse.startsWith('MOCK_SAML_ASSERTION:')) {
      email = SAMLResponse.split(':')[1].toLowerCase();
    } else {
      // Decode the base64 assertion XML payload
      const decodedXML = Buffer.from(SAMLResponse, 'base64').toString('utf8');
      
      // Basic XML parsing regex to extract email claim (Subject NameID)
      const nameIdMatch = decodedXML.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i);
      if (!nameIdMatch) {
        return res.status(400).json({ error: 'Failed to locate user NameID in SAML XML assertions.' });
      }
      email = nameIdMatch[1].toLowerCase();
      
      // In production: Verify XML cryptographic signature using xml-crypto with Tenant's IDP Certificate
    }

    const user = await User.findOne({ tenantId: tenant._id, email });
    if (!user) {
      return res.status(401).json({ error: `SAML Login Error: User ${email} not registered in this workspace.` });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    if (user.sessions.length >= 5) {
      user.sessions.shift();
    }

    user.sessions.push({
      token: refreshToken,
      expiresAt,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    await user.save();

    await AuditLog.create({
      tenantId: tenant._id,
      userId: user._id,
      action: 'LOGIN_SUCCESS_SAML_SSO',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      token: accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (err) {
    console.error('SAML Assertion Callback Error:', err);
    return res.status(500).json({ error: 'Internal server error validating SAML callback assertion.' });
  }
};

export const getSsoConfig = async (req, res) => {
  const { subdomain } = req.query;

  if (!subdomain) {
    return res.status(400).json({ error: 'Subdomain is required.' });
  }

  try {
    const tenant = await findTenantBySubdomainOrName(subdomain);
    if (!tenant) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
    const microsoftClientId = process.env.MICROSOFT_CLIENT_ID || '';

    return res.status(200).json({
      googleEnabled: !!googleClientId,
      googleClientId,
      microsoftEnabled: !!microsoftClientId,
      microsoftClientId,
      samlEnabled: tenant.settings?.saml?.enabled || false,
      samlEntryPoint: tenant.settings?.saml?.entryPoint || '',
      samlIssuer: tenant.settings?.saml?.issuer || '',
      samlCert: tenant.settings?.saml?.cert || '',
    });
  } catch (err) {
    console.error('Get SSO Config Error:', err);
    return res.status(500).json({ error: 'Internal server error retrieving SSO configuration.' });
  }
};

export const updateSamlConfig = async (req, res) => {
  const { enabled, entryPoint, issuer, cert } = req.body;

  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    if (!tenant.settings) {
      tenant.settings = {};
    }

    tenant.settings.saml = {
      enabled: !!enabled,
      entryPoint: entryPoint || '',
      issuer: issuer || '',
      cert: cert || '',
    };

    await tenant.save();

    await AuditLog.create({
      tenantId: tenant._id,
      userId: req.user.id,
      action: 'UPDATE_SAML_SETTINGS',
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'] || 'Server',
      details: { enabled, entryPoint, issuer },
    });

    return res.status(200).json({
      message: 'SAML settings updated successfully.',
      saml: tenant.settings.saml,
    });
  } catch (err) {
    console.error('Update SAML Config Error:', err);
    return res.status(500).json({ error: 'Internal server error updating SAML configuration.' });
  }
};

/**
 * Initiates a password reset by generating a secure token and emailing a reset link.
 * POST /api/v1/auth/forgot-password
 * Body: { email, subdomain }
 */
export const forgotPassword = async (req, res, next) => {
  const { email, subdomain } = req.body;

  if (!email || !subdomain) {
    return res.status(400).json({ error: 'Email and workspace subdomain are required.' });
  }

  try {
    // Always respond with a generic message to prevent user enumeration
    const genericResponse = {
      message: 'If that email is registered in your workspace, a password reset link has been sent.',
    };

    const tenant = await findTenantBySubdomainOrName(subdomain);
    if (!tenant) return res.status(200).json(genericResponse);

    const user = await User.findOne({ tenantId: tenant._id, email: email.toLowerCase().trim() });
    if (!user) return res.status(200).json(genericResponse);

    // Generate a cryptographically secure raw token
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Store the SHA-256 hash of the token (never store raw tokens in DB)
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save({ validateBeforeSave: false });

    // Build reset URL with raw token (frontend will send it back)
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendBase}/reset-password?token=${rawToken}&email=${encodeURIComponent(email.toLowerCase().trim())}&subdomain=${encodeURIComponent(subdomain.toLowerCase().trim())}`;

    // Get display name from Employee profile if available
    const emp = await Employee.findOne({ tenantId: tenant._id, userId: user._id });
    const displayName = emp ? `${emp.personal?.firstName || ''} ${emp.personal?.lastName || ''}`.trim() : 'User';

    await sendPasswordResetEmail(email.toLowerCase().trim(), resetLink, displayName);

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error('Forgot Password Error:', err);
    next(err);
  }
};

/**
 * Validates reset token and updates the user's password.
 * POST /api/v1/auth/reset-password
 * Body: { token, email, subdomain, newPassword }
 */
export const resetPassword = async (req, res, next) => {
  const { token, email, subdomain, newPassword } = req.body;

  if (!token || !email || !subdomain || !newPassword) {
    return res.status(400).json({ error: 'Token, email, subdomain, and new password are all required.' });
  }

  try {
    // Validate password strength
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.message });
    }

    const tenant = await findTenantBySubdomainOrName(subdomain);
    if (!tenant) {
      return res.status(400).json({ error: 'Invalid or expired reset link.' });
    }

    const user = await User.findOne({ tenantId: tenant._id, email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset link.' });
    }

    // Hash the incoming raw token and compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    if (
      !user.passwordResetToken ||
      user.passwordResetToken !== hashedToken ||
      !user.passwordResetExpiry ||
      user.passwordResetExpiry < Date.now()
    ) {
      return res.status(400).json({ error: 'This password reset link is invalid or has expired. Please request a new one.' });
    }

    // Set new password (pre-save hook will hash it)
    user.passwordHash = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpiry = null;
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    await user.save();

    return res.status(200).json({ message: 'Password reset successfully. You can now login with your new password.' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    next(err);
  }
};
