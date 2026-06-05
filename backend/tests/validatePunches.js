import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import Shift from '../src/models/Shift.js';
import AttendanceRecord from '../src/models/AttendanceRecord.js';
import { punchAttendance } from '../src/controllers/attendanceController.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.3 CORE PUNCH & RULES ENGINE VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let user = null;
  let employee = null;
  let shift = null;
  let testRecordId = null;

  try {
    // 1. Create a dummy tenant
    tenant = new Tenant({
      name: 'Test Corp Attendance Punches',
      subdomain: `test-corp-punch-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant created:', tenant.name);

    // 2. Create User
    user = new User({
      tenantId: tenant._id,
      email: `punchuser-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await user.save();
    console.log('✔ User created');

    // 3. Create a Shift (09:00 - 17:00, 10 min grace, 240 min half-day threshold)
    shift = new Shift({
      tenantId: tenant._id,
      name: 'Standard Day Shift',
      startTime: '09:00',
      endTime: '17:00',
      gracePeriodMins: 10,
      halfDayThresholdMins: 240,
      weeklyOffs: [0, 6]
    });
    await shift.save();
    console.log('✔ Shift configured');

    // 4. Create Employee linked to the Shift
    employee = new Employee({
      tenantId: tenant._id,
      userId: user._id,
      employeeId: `EMP-${Date.now()}-PCH`,
      personal: { firstName: 'Punch', lastName: 'Test' },
      employment: {
        status: 'ACTIVE',
        shiftId: shift._id
      }
    });
    await employee.save();
    console.log('✔ Employee created with linked shift');

    // 5. Test 1: On-Time Check-In Punch (08:55 AM)
    console.log('Simulating On-Time Punch (08:55)...');
    const onTimeInDate = new Date();
    onTimeInDate.setHours(8, 55, 0, 0);

    const mockRes1 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };

    const mockReq1 = {
      tenantId: tenant._id,
      user: { id: user._id, role: 'EMPLOYEE' },
      body: {
        date: '2026-06-06',
        time: onTimeInDate.toISOString(),
        type: 'IN'
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Test Punch Runner' }
    };

    const mockNext = (err) => {
      console.error('Punch controller error:', err);
      throw err;
    };

    await punchAttendance(mockReq1, mockRes1, mockNext);

    if (mockRes1.statusCode !== 200) {
      throw new Error(`On-time punch failed: ${mockRes1.body?.error}`);
    }

    testRecordId = mockRes1.body.record._id;
    console.log(`  - Punch result status: ${mockRes1.body.record.status} (expected: PRESENT)`);
    if (mockRes1.body.record.status !== 'PRESENT') {
      throw new Error(`Expected status to be PRESENT, got ${mockRes1.body.record.status}`);
    }

    // Clean up record for next test scenario
    await AttendanceRecord.deleteMany({ tenantId: tenant._id });

    // 6. Test 2: Late Check-In Punch (09:20 AM - Past 09:00 + 10 min grace)
    console.log('Simulating Late Punch (09:20)...');
    const lateInDate = new Date();
    lateInDate.setHours(9, 20, 0, 0);

    const mockRes2 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };

    const mockReq2 = {
      tenantId: tenant._id,
      user: { id: user._id, role: 'EMPLOYEE' },
      body: {
        date: '2026-06-06',
        time: lateInDate.toISOString(),
        type: 'IN'
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Test Punch Runner' }
    };

    await punchAttendance(mockReq2, mockRes2, mockNext);

    console.log(`  - Punch result status: ${mockRes2.body.record.status} (expected: LATE)`);
    if (mockRes2.body.record.status !== 'LATE') {
      throw new Error(`Expected status to be LATE, got ${mockRes2.body.record.status}`);
    }

    // 7. Test 3: Clock-Out resulting in HALF_DAY (11:20 AM - total 120 worked minutes, threshold 240 mins)
    console.log('Simulating Half-day Check-Out (11:20)...');
    const halfDayOutDate = new Date();
    halfDayOutDate.setHours(11, 20, 0, 0);

    const mockRes3 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };

    const mockReq3 = {
      tenantId: tenant._id,
      user: { id: user._id, role: 'EMPLOYEE' },
      body: {
        date: '2026-06-06',
        time: halfDayOutDate.toISOString(),
        type: 'OUT'
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Test Punch Runner' }
    };

    await punchAttendance(mockReq3, mockRes3, mockNext);

    console.log(`  - Punch result status: ${mockRes3.body.record.status} (expected: HALF_DAY)`);
    console.log(`  - Work minutes: ${mockRes3.body.record.totalWorkMinutes} (expected: 120)`);
    if (mockRes3.body.record.status !== 'HALF_DAY') {
      throw new Error(`Expected status to be HALF_DAY, got ${mockRes3.body.record.status}`);
    }
    if (mockRes3.body.record.totalWorkMinutes !== 120) {
      throw new Error(`Expected totalWorkMinutes to be 120, got ${mockRes3.body.record.totalWorkMinutes}`);
    }

    // Clean up record for next test scenario
    await AttendanceRecord.deleteMany({ tenantId: tenant._id });

    // 8. Test 4: Clock-In + Clock-Out with normal PRESENT hours and Overtime (08:00 AM to 06:00 PM - 10 hours)
    console.log('Simulating Full day + Overtime punch sequence...');
    const fullInDate = new Date();
    fullInDate.setHours(8, 0, 0, 0);
    const fullOutDate = new Date();
    fullOutDate.setHours(18, 0, 0, 0); // 10 hours worked (600 mins). Shift length is 8 hours (480 mins). OT = 2 hours (120 mins).

    const mockRes4 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const mockReq4 = {
      tenantId: tenant._id,
      user: { id: user._id, role: 'EMPLOYEE' },
      body: {
        date: '2026-06-06',
        time: fullInDate.toISOString(),
        type: 'IN'
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Test Punch Runner' }
    };
    await punchAttendance(mockReq4, mockRes4, mockNext);

    const mockRes5 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const mockReq5 = {
      tenantId: tenant._id,
      user: { id: user._id, role: 'EMPLOYEE' },
      body: {
        date: '2026-06-06',
        time: fullOutDate.toISOString(),
        type: 'OUT'
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Test Punch Runner' }
    };
    await punchAttendance(mockReq5, mockRes5, mockNext);

    console.log(`  - Punch result status: ${mockRes5.body.record.status} (expected: PRESENT)`);
    console.log(`  - Work minutes: ${mockRes5.body.record.totalWorkMinutes} (expected: 600)`);
    console.log(`  - Overtime minutes: ${mockRes5.body.record.overtimeMinutes} (expected: 120)`);

    if (mockRes5.body.record.status !== 'PRESENT') {
      throw new Error(`Expected status to be PRESENT, got ${mockRes5.body.record.status}`);
    }
    if (mockRes5.body.record.totalWorkMinutes !== 600) {
      throw new Error(`Expected totalWorkMinutes to be 600, got ${mockRes5.body.record.totalWorkMinutes}`);
    }
    if (mockRes5.body.record.overtimeMinutes !== 120) {
      throw new Error(`Expected overtimeMinutes to be 120, got ${mockRes5.body.record.overtimeMinutes}`);
    }

    console.log('✔ All Phase 2 Web Punch & Rules Engine tests passed successfully!');

  } catch (error) {
    console.error('❌ PUNCH VERIFICATION TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('Cleaning up database test records...');
    if (tenant) await AttendanceRecord.deleteMany({ tenantId: tenant._id });
    if (employee) await Employee.collection.deleteOne({ _id: employee._id });
    if (shift) await Shift.deleteOne({ _id: shift._id });
    if (user) await User.deleteOne({ _id: user._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });

    await mongoose.connection.close();
    console.log('DB Connection closed. Exit validation.');
  }
}

runTests();
