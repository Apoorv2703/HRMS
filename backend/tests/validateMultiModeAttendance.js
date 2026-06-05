import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import Shift from '../src/models/Shift.js';
import AttendanceRecord from '../src/models/AttendanceRecord.js';
import { punchAttendance, biometricSyncPunch } from '../src/controllers/attendanceController.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.3 PHASE 5 MULTI-MODE CAPTURE VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let user = null;
  let employee = null;
  let shift = null;

  try {
    // ─── Setup ────────────────────────────────────────────────────────────────────

    tenant = new Tenant({
      name: 'Test Corp MultiMode Tenant',
      subdomain: `test-corp-mm-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant created:', tenant.name);

    shift = new Shift({
      tenantId: tenant._id,
      name: 'Standard Day Shift',
      startTime: '09:00',
      endTime: '17:00',
      gracePeriodMins: 10,
      halfDayThresholdMins: 240,
      weeklyOffs: [0, 6],
    });
    await shift.save();
    console.log('✔ Shift created');

    user = new User({
      tenantId: tenant._id,
      email: `mm-user-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await user.save();

    employee = new Employee({
      tenantId: tenant._id,
      userId: user._id,
      employeeId: `EMP-MM-${Date.now()}`,
      personal: { firstName: 'Multi', lastName: 'Mode' },
      employment: {
        status: 'ACTIVE',
        shiftId: shift._id,
        location: 'HQ',
      },
    });
    await employee.save();
    console.log('✔ Employee created');

    // Helper builders
    const makeRes = () => ({
      statusCode: 200,
      body: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; return this; },
    });

    const mockNext = (err) => { throw err; };

    const makePunchReq = (overrides = {}) => ({
      tenantId: tenant._id,
      user: { id: user._id, role: 'EMPLOYEE' },
      body: {
        date: new Date().toISOString().split('T')[0],
        time: new Date().toISOString(),
        type: 'IN',
        ...overrides.body,
      },
      ip: overrides.ip || '127.0.0.1',
      headers: { 'user-agent': 'Test Runner' },
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: IP WHITELIST
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════');
    console.log(' SCENARIO 1: IP Whitelist Enforcement');
    console.log('══════════════════════════════════════════');

    // Activate IP whitelist on tenant
    tenant.settings.attendance.ipWhitelist = ['192.168.1.100', '127.0.0.1'];
    await tenant.save();
    console.log('✔ IP whitelist activated: [192.168.1.100, 127.0.0.1]');

    // Test 1a: Blocked IP
    console.log('\n--- Test 1a: Blocked IP (10.0.0.5) ---');
    const res1a = makeRes();
    await punchAttendance(makePunchReq({ ip: '10.0.0.5' }), res1a, mockNext);

    console.log(`  - Status Code: ${res1a.statusCode} (expected: 400)`);
    console.log(`  - Error: "${res1a.body?.error}"`);
    if (res1a.statusCode !== 400) throw new Error(`Expected 400, got ${res1a.statusCode}`);
    if (!res1a.body?.error?.includes('not whitelisted')) throw new Error('Wrong error message for blocked IP');
    console.log('✔ Test 1a passed: Blocked IP correctly rejected.');

    // Test 1b: Allowed IP (exact match)
    console.log('\n--- Test 1b: Allowed IP (127.0.0.1 exact match) ---');
    await AttendanceRecord.deleteMany({ tenantId: tenant._id });
    const res1b = makeRes();
    await punchAttendance(makePunchReq({ ip: '127.0.0.1' }), res1b, mockNext);

    console.log(`  - Status Code: ${res1b.statusCode} (expected: 200)`);
    if (res1b.statusCode !== 200) throw new Error(`Expected 200 for allowed IP, got ${res1b.statusCode}: ${res1b.body?.error}`);
    console.log('✔ Test 1b passed: Allowed IP (127.0.0.1) correctly accepted.');

    // Test 1c: Wildcard IP match (192.168.1.*)
    console.log('\n--- Test 1c: Wildcard IP (192.168.1.*) ---');
    tenant.settings.attendance.ipWhitelist = ['192.168.1.*'];
    await tenant.save();
    await AttendanceRecord.deleteMany({ tenantId: tenant._id });

    const res1c = makeRes();
    await punchAttendance(makePunchReq({ ip: '192.168.1.55' }), res1c, mockNext);

    console.log(`  - Status Code: ${res1c.statusCode} (expected: 200)`);
    if (res1c.statusCode !== 200) throw new Error(`Expected 200 for wildcard IP, got ${res1c.statusCode}: ${res1c.body?.error}`);
    console.log('✔ Test 1c passed: Wildcard IP pattern (192.168.1.*) correctly matched and accepted.');

    // Reset IP whitelist
    tenant.settings.attendance.ipWhitelist = [];
    await tenant.save();

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: GPS GEOFENCING
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════');
    console.log(' SCENARIO 2: GPS Geofencing Enforcement');
    console.log('══════════════════════════════════════════');

    // Set up organization with HQ geofence at San Francisco (37.7749, -122.4194), radius 200m
    const { default: Organization } = await import('../src/models/Organization.js');
    const org = new Organization({
      tenantId: tenant._id,
      locations: [{
        name: 'HQ',
        code: 'HQ',
        address: 'San Francisco, CA',
        latitude: 37.7749,
        longitude: -122.4194,
        radiusMeters: 200,
      }],
    });
    await org.save();
    console.log('✔ Organization created with HQ geofence at (37.7749, -122.4194), radius 200m');

    // Enable geofencing on tenant
    tenant.settings.attendance.geofencingEnabled = true;
    await tenant.save();

    // Test 2a: Punch with no GPS coordinates (should be blocked)
    console.log('\n--- Test 2a: Missing GPS coordinates ---');
    await AttendanceRecord.deleteMany({ tenantId: tenant._id });
    const res2a = makeRes();
    await punchAttendance(makePunchReq({ ip: '127.0.0.1' }), res2a, mockNext);

    console.log(`  - Status Code: ${res2a.statusCode} (expected: 400)`);
    console.log(`  - Error: "${res2a.body?.error}"`);
    if (res2a.statusCode !== 400) throw new Error(`Expected 400, got ${res2a.statusCode}`);
    if (!res2a.body?.error?.includes('GPS location coordinates')) throw new Error('Wrong error for missing coordinates');
    console.log('✔ Test 2a passed: Punch without GPS coordinates correctly blocked.');

    // Test 2b: Punch WITHIN geofence (37.7748, -122.4193 ≈ ~15m from HQ)
    console.log('\n--- Test 2b: Punch within geofence (~15m from HQ) ---');
    await AttendanceRecord.deleteMany({ tenantId: tenant._id });
    const res2b = makeRes();
    await punchAttendance(makePunchReq({
      ip: '127.0.0.1',
      body: {
        date: new Date().toISOString().split('T')[0],
        time: new Date(`${new Date().toISOString().split('T')[0]}T08:55:00.000Z`).toISOString(),
        type: 'IN',
        location: { lat: 37.7748, lng: -122.4193 }, // ~15m from HQ
      },
    }), res2b, mockNext);

    console.log(`  - Status Code: ${res2b.statusCode} (expected: 200)`);
    if (res2b.statusCode !== 200) throw new Error(`Expected 200 for in-bounds punch, got ${res2b.statusCode}: ${res2b.body?.error}`);
    console.log('✔ Test 2b passed: Punch within 200m radius accepted.');

    // Test 2c: Punch OUTSIDE geofence (37.8049, -122.4194 ≈ ~3.3km from HQ)
    console.log('\n--- Test 2c: Punch outside geofence (~3.3km from HQ) ---');
    await AttendanceRecord.deleteMany({ tenantId: tenant._id });
    const res2c = makeRes();
    await punchAttendance(makePunchReq({
      ip: '127.0.0.1',
      body: {
        date: new Date().toISOString().split('T')[0],
        time: new Date().toISOString(),
        type: 'IN',
        location: { lat: 37.8049, lng: -122.4194 }, // ~3.3km away
      },
    }), res2c, mockNext);

    console.log(`  - Status Code: ${res2c.statusCode} (expected: 400)`);
    console.log(`  - Error: "${res2c.body?.error}"`);
    if (res2c.statusCode !== 400) throw new Error(`Expected 400 for out-of-bounds punch, got ${res2c.statusCode}`);
    if (!res2c.body?.error?.includes('outside the authorized geofence')) throw new Error('Wrong error for geofence block');
    console.log('✔ Test 2c passed: Punch outside 200m radius correctly blocked with distance info.');

    // Disable geofencing
    tenant.settings.attendance.geofencingEnabled = false;
    await tenant.save();

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: BIOMETRIC DEVICE SYNC
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════');
    console.log(' SCENARIO 3: Biometric Device Sync');
    console.log('══════════════════════════════════════════');

    const BIO_API_KEY = `bio-key-${Date.now()}`;
    tenant.settings.attendance.biometricApiKey = BIO_API_KEY;
    await tenant.save();
    console.log('✔ Biometric API Key set on tenant');

    const today = new Date().toISOString().split('T')[0];

    // Build local-time Date objects for the rules engine (same pattern as validatePunches.js)
    const inTime = new Date();
    inTime.setHours(9, 0, 0, 0); // 09:00 local - on-time
    const outTime = new Date();
    outTime.setHours(17, 0, 0, 0); // 17:00 local - end of shift

    // Test 3a: Missing API key header (401)
    console.log('\n--- Test 3a: Missing x-biometric-api-key header ---');
    await AttendanceRecord.deleteMany({ tenantId: tenant._id });
    const res3a = makeRes();
    const bioReq3a = {
      headers: {},
      body: { employeeId: employee.employeeId, time: inTime.toISOString(), type: 'IN', deviceId: 'BIO-001' },
      ip: '127.0.0.1',
    };
    await biometricSyncPunch(bioReq3a, res3a, mockNext);

    console.log(`  - Status Code: ${res3a.statusCode} (expected: 401)`);
    if (res3a.statusCode !== 401) throw new Error(`Expected 401, got ${res3a.statusCode}`);
    console.log('✔ Test 3a passed: Missing API key correctly returns 401.');

    // Test 3b: Wrong API key (401)
    console.log('\n--- Test 3b: Wrong x-biometric-api-key ---');
    const res3b = makeRes();
    const bioReq3b = {
      headers: { 'x-biometric-api-key': 'totally-wrong-key' },
      body: { employeeId: employee.employeeId, time: inTime.toISOString(), type: 'IN', deviceId: 'BIO-001' },
      ip: '127.0.0.1',
    };
    await biometricSyncPunch(bioReq3b, res3b, mockNext);

    console.log(`  - Status Code: ${res3b.statusCode} (expected: 401)`);
    if (res3b.statusCode !== 401) throw new Error(`Expected 401 for wrong key, got ${res3b.statusCode}`);
    console.log('✔ Test 3b passed: Invalid API key correctly returns 401.');

    // Test 3c: Valid IN punch via biometric sync
    console.log('\n--- Test 3c: Valid biometric IN sync (09:00) ---');
    const res3c = makeRes();
    const bioReq3c = {
      headers: { 'x-biometric-api-key': BIO_API_KEY },
      body: { employeeId: employee.employeeId, time: inTime.toISOString(), type: 'IN', deviceId: 'BIO-001' },
      ip: '127.0.0.1',
    };
    await biometricSyncPunch(bioReq3c, res3c, mockNext);

    console.log(`  - Status Code: ${res3c.statusCode} (expected: 200)`);
    console.log(`  - Record status: ${res3c.body?.record?.status} (expected: PRESENT)`);
    console.log(`  - Punch IP: "${res3c.body?.record?.punches?.[0]?.ip}" (expected: "Biometric (BIO-001)")`);
    if (res3c.statusCode !== 200) throw new Error(`Expected 200 for valid biometric punch, got ${res3c.statusCode}: ${res3c.body?.error}`);
    if (res3c.body.record.status !== 'PRESENT') throw new Error(`Expected PRESENT, got ${res3c.body.record.status}`);
    if (res3c.body.record.punches[0].ip !== 'Biometric (BIO-001)') throw new Error('Biometric device ID not recorded correctly in punch IP field');
    console.log('✔ Test 3c passed: Biometric IN punch synced, PRESENT status set, device ID recorded.');

    // Test 3d: Valid OUT punch + duration calculation (17:00 = 8h worked, 0 OT)
    console.log('\n--- Test 3d: Valid biometric OUT sync (17:00, 8h worked) ---');
    const res3d = makeRes();
    const bioReq3d = {
      headers: { 'x-biometric-api-key': BIO_API_KEY },
      body: { employeeId: employee.employeeId, time: outTime.toISOString(), type: 'OUT', deviceId: 'BIO-001' },
      ip: '127.0.0.1',
    };
    await biometricSyncPunch(bioReq3d, res3d, mockNext);

    console.log(`  - Status Code: ${res3d.statusCode} (expected: 200)`);
    console.log(`  - Total work minutes: ${res3d.body?.record?.totalWorkMinutes} (expected: 480)`);
    console.log(`  - Overtime minutes: ${res3d.body?.record?.overtimeMinutes} (expected: 0)`);
    if (res3d.statusCode !== 200) throw new Error(`Expected 200 for OUT punch, got ${res3d.statusCode}`);
    if (res3d.body.record.totalWorkMinutes !== 480) throw new Error(`Expected 480 work mins, got ${res3d.body.record.totalWorkMinutes}`);
    if (res3d.body.record.overtimeMinutes !== 0) throw new Error(`Expected 0 OT mins, got ${res3d.body.record.overtimeMinutes}`);
    console.log('✔ Test 3d passed: Biometric OUT punch synced, 480 work minutes and 0 OT calculated.');

    // Test 3e: Duplicate timestamp rejected
    console.log('\n--- Test 3e: Duplicate timestamp rejection ---');
    const res3e = makeRes();
    await biometricSyncPunch(bioReq3c, res3e, mockNext); // Same IN punch as 3c
    console.log(`  - Status Code: ${res3e.statusCode} (expected: 400 - duplicate)`);
    if (res3e.statusCode !== 400) throw new Error(`Expected 400 for duplicate punch, got ${res3e.statusCode}`);
    console.log('✔ Test 3e passed: Duplicate biometric timestamp correctly rejected.');

    console.log('\n✔ ALL PHASE 5 MULTI-MODE CAPTURE TESTS PASSED SUCCESSFULLY!');

  } catch (error) {
    console.error('\n❌ MULTI-MODE CAPTURE VERIFICATION TEST FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up test data...');
    const { default: Organization } = await import('../src/models/Organization.js');
    if (tenant) {
      await AttendanceRecord.deleteMany({ tenantId: tenant._id });
      await Organization.deleteMany({ tenantId: tenant._id });
    }
    if (employee) await Employee.collection.deleteOne({ _id: employee._id });
    if (shift) await Shift.deleteOne({ _id: shift._id });
    if (user) await User.deleteOne({ _id: user._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });

    await mongoose.connection.close();
    console.log('DB Connection closed. Exit validation.');
  }
}

runTests();
