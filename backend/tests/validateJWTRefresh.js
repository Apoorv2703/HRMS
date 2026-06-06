import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import { login, refreshToken, logout } from '../src/controllers/authController.js';

async function runTests() {
  console.log('--- STARTING JWT SESSION & REFRESH TOKEN ROTATION VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let user = null;

  try {
    // 1. Provision Test Tenant
    tenant = new Tenant({
      name: 'Test JWT Corp',
      subdomain: `test-jwt-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant provisioned:', tenant.subdomain);

    // 2. Provision Test User (pre-save hook hashes password)
    user = new User({
      tenantId: tenant._id,
      email: 'test-user@jwtcorp.com',
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await user.save();
    console.log('✔ User account provisioned');

    // ==========================================
    // TEST 1: Login and issue tokens
    // ==========================================
    console.log('\n--- Test 1: User Login & Session Initialization ---');
    let capturedCookies = {};
    const mockRes1 = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      cookie(name, value, options) {
        capturedCookies[name] = value;
        return this;
      }
    };
    const req1 = {
      body: {
        email: 'test-user@jwtcorp.com',
        password: 'Password123!',
        subdomain: tenant.subdomain
      },
      headers: { 'user-agent': 'Session-Test-Agent' },
      ip: '127.0.0.1'
    };

    await login(req1, mockRes1);

    console.log('Login status code:', mockRes1.statusCode);
    console.log('Access Token issued:', !!mockRes1.body.token);
    console.log('Refresh Token cookie set:', !!capturedCookies.refreshToken);

    if (!mockRes1.body.token || !capturedCookies.refreshToken) {
      throw new Error('Failed to issue access token or set refresh token cookie.');
    }

    // Verify refresh token is saved on user record
    let freshUser = await User.findById(user._id);
    console.log('Active database sessions count:', freshUser.sessions.length);
    if (freshUser.sessions.length !== 1 || freshUser.sessions[0].token !== capturedCookies.refreshToken) {
      throw new Error('Refresh token not registered on user session list in DB.');
    }
    console.log('✔ Test 1 passed: Login initialized token structures successfully');

    // ==========================================
    // TEST 2: Refresh Token Rotation
    // ==========================================
    console.log('\n--- Test 2: Refresh Token Rotation ---');
    const oldRefreshToken = capturedCookies.refreshToken;
    let newCookies = {};
    const mockRes2 = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      cookie(name, value, options) {
        newCookies[name] = value;
        return this;
      }
    };
    const req2 = {
      cookies: { refreshToken: oldRefreshToken },
      headers: { 'user-agent': 'Session-Test-Agent-Rotated' },
      ip: '127.0.0.1'
    };

    await refreshToken(req2, mockRes2);

    console.log('Token Refresh status code:', mockRes2.statusCode);
    console.log('New Access Token issued:', !!mockRes2.body.token);
    console.log('New Refresh Token cookie set:', !!newCookies.refreshToken);

    if (!mockRes2.body.token || !newCookies.refreshToken) {
      throw new Error('Refresh token rotation failed.');
    }

    if (oldRefreshToken === newCookies.refreshToken) {
      throw new Error('Refresh token was not rotated (it stayed the same).');
    }

    // Verify old refresh token is gone and new refresh token is present in DB
    freshUser = await User.findById(user._id);
    console.log('Database sessions count after refresh:', freshUser.sessions.length);
    const sessionExists = freshUser.sessions.some(s => s.token === newCookies.refreshToken);
    const oldSessionExists = freshUser.sessions.some(s => s.token === oldRefreshToken);

    if (!sessionExists) {
      throw new Error('New rotated refresh token not found on database.');
    }
    if (oldSessionExists) {
      throw new Error('Old refresh token was not removed from database.');
    }
    console.log('✔ Test 2 passed: Refresh token rotated successfully');

    // ==========================================
    // TEST 3: User Logout Revocation
    // ==========================================
    console.log('\n--- Test 3: Session Logout Revocation ---');
    let clearedCookies = {};
    const mockRes3 = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      clearCookie(name) {
        clearedCookies[name] = true;
        return this;
      }
    };
    const req3 = {
      cookies: { refreshToken: newCookies.refreshToken },
      headers: { 'user-agent': 'Session-Test-Agent-Rotated' },
      ip: '127.0.0.1'
    };

    await logout(req3, mockRes3);

    console.log('Logout status code:', mockRes3.statusCode);
    console.log('Refresh Token cookie cleared:', !!clearedCookies.refreshToken);

    freshUser = await User.findById(user._id);
    console.log('Database sessions count after logout:', freshUser.sessions.length);

    if (freshUser.sessions.length !== 0) {
      throw new Error('Session was not removed from database on logout.');
    }
    console.log('✔ Test 3 passed: Session revoked and cleared successfully');

    console.log('\n✔ ALL JWT SESSION & REFRESH TOKEN TESTS PASSED SUCCESSFULLY!');

  } catch (err) {
    console.error('❌ JWT SESSION VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up database test records...');
    if (user) await User.deleteOne({ _id: user._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });

    await mongoose.connection.close();
    console.log('DB Connection closed. Exit validation.');
  }
}

runTests();
