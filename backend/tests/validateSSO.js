import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import { getSsoConfig, updateSamlConfig, googleLogin, microsoftLogin, samlCallback } from '../src/controllers/authController.js';

async function runTests() {
  console.log('--- STARTING SSO & SAML AUTHENTICATION INTEGRATION VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let adminUser = null;
  let employeeUser = null;
  let employeeEmp = null;

  try {
    // 1. Setup Tenant
    tenant = new Tenant({
      name: 'Test Corp SSO Tenant',
      subdomain: `test-corp-sso-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant created:', tenant.subdomain);

    // 2. Setup HR Admin and Employee
    adminUser = new User({
      tenantId: tenant._id,
      email: `admin-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'HR_ADMIN',
    });
    await adminUser.save();

    employeeUser = new User({
      tenantId: tenant._id,
      email: `bob-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await employeeUser.save();

    employeeEmp = new Employee({
      tenantId: tenant._id,
      userId: employeeUser._id,
      employeeId: 'EMP-SSO-01',
      personal: { firstName: 'Bob', lastName: 'SSO' },
      employment: {
        status: 'ACTIVE',
        location: 'HQ',
      },
    });
    await employeeEmp.save();
    console.log('✔ User accounts initialized');

    // ==========================================
    // TEST 1: Retrieve Initial SSO Configurations
    // ==========================================
    console.log('\n--- Test 1: Retrieve Workspace SSO Config ---');
    const mockRes1 = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const req1 = {
      query: { subdomain: tenant.subdomain }
    };
    
    await getSsoConfig(req1, mockRes1);
    
    console.log('SAML Enabled Status:', mockRes1.body.samlEnabled);
    console.log('Google Enabled Status:', mockRes1.body.googleEnabled);
    if (mockRes1.body.samlEnabled !== false) {
      throw new Error('SAML should initially be disabled.');
    }
    console.log('✔ Test 1 passed: SSO configuration retrieved successfully');

    // ==========================================
    // TEST 2: Update SAML Configuration Settings (HR_ADMIN)
    // ==========================================
    console.log('\n--- Test 2: Configure SAML Settings (Admin) ---');
    const mockRes2 = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const req2 = {
      tenantId: tenant._id,
      user: { id: adminUser._id },
      body: {
        enabled: true,
        entryPoint: 'https://mock-idp.com/sso/saml',
        issuer: 'mock-sp-entity-id',
        cert: '-----BEGIN CERTIFICATE-----\nMOCK_CERTIFICATE\n-----END CERTIFICATE-----',
      }
    };

    await updateSamlConfig(req2, mockRes2);
    
    console.log('Updated SAML entrypoint URL:', mockRes2.body.saml.entryPoint);
    if (mockRes2.body.saml.enabled !== true || mockRes2.body.saml.entryPoint !== 'https://mock-idp.com/sso/saml') {
      throw new Error('Failed to update SAML configuration.');
    }

    // Re-verify config endpoint
    const mockRes1Re = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    await getSsoConfig(req1, mockRes1Re);
    console.log('SAML Re-verified Enabled:', mockRes1Re.body.samlEnabled);
    if (mockRes1Re.body.samlEnabled !== true) {
      throw new Error('Config endpoint did not reflect updated SAML status.');
    }
    console.log('✔ Test 2 passed: SAML settings configured and retrieved successfully');

    // ==========================================
    // TEST 3: Google Login OAuth Mock
    // ==========================================
    console.log('\n--- Test 3: Google SSO Callback Login ---');
    const mockRes3 = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      cookie(name, value, options) { return this; }
    };
    const req3 = {
      body: {
        code: employeeUser.email, // Passing user email as mock OAuth authorization code
        subdomain: tenant.subdomain,
      },
      headers: { 'user-agent': 'Node-Validation' },
      ip: '127.0.0.1'
    };

    await googleLogin(req3, mockRes3);

    console.log('Returned Access Token length:', mockRes3.body.token?.length);
    console.log('Returned User Email:', mockRes3.body.user?.email);
    if (!mockRes3.body.token || mockRes3.body.user?.email !== employeeUser.email) {
      throw new Error('Google SSO login failed.');
    }
    console.log('✔ Test 3 passed: Google SSO Mock callback login successful');

    // ==========================================
    // TEST 4: SAML Assertion Callback Login Mock
    // ==========================================
    console.log('\n--- Test 4: SAML Callback Login ---');
    const mockRes4 = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      cookie(name, value, options) { return this; }
    };
    const req4 = {
      body: {
        SAMLResponse: `MOCK_SAML_ASSERTION:${employeeUser.email}`,
        subdomain: tenant.subdomain,
      },
      headers: { 'user-agent': 'Node-Validation' },
      ip: '127.0.0.1'
    };

    await samlCallback(req4, mockRes4);

    console.log('Returned SAML Access Token length:', mockRes4.body.token?.length);
    console.log('Returned SAML User Email:', mockRes4.body.user?.email);
    if (!mockRes4.body.token || mockRes4.body.user?.email !== employeeUser.email) {
      throw new Error('SAML Callback login failed.');
    }
    console.log('✔ Test 4 passed: SAML SSO Mock callback login successful');

    console.log('\n✔ ALL SSO & SAML AUTHENTICATION TESTS PASSED SUCCESSFULLY!');

  } catch (err) {
    console.error('❌ SSO & SAML AUTH VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up database test records...');
    if (employeeEmp) await Employee.collection.deleteOne({ _id: employeeEmp._id });
    if (employeeUser) await User.deleteOne({ _id: employeeUser._id });
    if (adminUser) await User.deleteOne({ _id: adminUser._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });

    await mongoose.connection.close();
    console.log('DB Connection closed. Exit validation.');
  }
}

runTests();
