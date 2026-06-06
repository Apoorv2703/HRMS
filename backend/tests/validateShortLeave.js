import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import Shift from '../src/models/Shift.js';
import AttendanceRecord from '../src/models/AttendanceRecord.js';
import { recalculateRecordRules } from '../src/controllers/attendanceController.js';
import { getAttendanceStats } from '../src/controllers/attendanceReportController.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.3 SHORT-LEAVE RULES VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let user = null;
  let employee = null;
  let shift = null;
  let records = [];

  try {
    // 1. Create a dummy tenant
    tenant = new Tenant({
      name: 'Test Corp Short-Leave',
      subdomain: `test-corp-sl-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant created:', tenant.name);

    // 2. Create User
    user = new User({
      tenantId: tenant._id,
      email: `sluser-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'HR_ADMIN',
    });
    await user.save();
    console.log('✔ User created');

    // 3. Create Shift with Short-Leave configurations
    shift = new Shift({
      tenantId: tenant._id,
      name: 'Short-Leave Validation Shift',
      startTime: '09:00',
      endTime: '17:00',
      gracePeriodMins: 15,
      halfDayThresholdMins: 240, // 4 hours
      shortLeaveThresholdMins: 360, // 6 hours
      weeklyOffs: [0, 6],
    });
    await shift.save();
    console.log('✔ Shift created with short-leave configuration:', shift.name);

    // 4. Create Employee and assign Shift
    employee = new Employee({
      tenantId: tenant._id,
      userId: user._id,
      employeeId: `EMP-${Date.now()}-SL`,
      personal: { firstName: 'Short', lastName: 'Leave' },
      employment: {
        status: 'ACTIVE',
        shiftId: shift._id,
        assignedShift: shift.name,
      },
    });
    await employee.save();
    console.log('✔ Employee created and shift linked');

    // ==========================================
    // TEST BOUNDARIES IN RULES ENGINE
    // ==========================================

    // Scenario A: Worked 3 hours (180 mins) -> should be HALF_DAY
    const dateA_in = new Date();
    dateA_in.setHours(9, 0, 0, 0);
    const dateA_out = new Date();
    dateA_out.setHours(12, 0, 0, 0);

    const recordA = new AttendanceRecord({
      tenantId: tenant._id,
      employeeId: employee._id,
      date: '2026-06-01',
      punches: [
        { time: dateA_in, type: 'IN' },
        { time: dateA_out, type: 'OUT' },
      ],
    });
    recalculateRecordRules(recordA, shift);
    console.log(`Scenario A (3 hours worked) -> status calculated: ${recordA.status}, minutes: ${recordA.totalWorkMinutes}`);
    if (recordA.status !== 'HALF_DAY') {
      throw new Error(`Expected status to be HALF_DAY, got ${recordA.status}`);
    }
    await recordA.save();
    records.push(recordA);

    // Scenario B: Worked 5 hours (300 mins) -> should be SHORT_LEAVE
    const dateB_in = new Date();
    dateB_in.setHours(9, 0, 0, 0);
    const dateB_out = new Date();
    dateB_out.setHours(14, 0, 0, 0);

    const recordB = new AttendanceRecord({
      tenantId: tenant._id,
      employeeId: employee._id,
      date: '2026-06-02',
      punches: [
        { time: dateB_in, type: 'IN' },
        { time: dateB_out, type: 'OUT' },
      ],
    });
    recalculateRecordRules(recordB, shift);
    console.log(`Scenario B (5 hours worked) -> status calculated: ${recordB.status}, minutes: ${recordB.totalWorkMinutes}`);
    if (recordB.status !== 'SHORT_LEAVE') {
      throw new Error(`Expected status to be SHORT_LEAVE, got ${recordB.status}`);
    }
    await recordB.save();
    records.push(recordB);

    // Scenario C: Worked 7 hours (420 mins) -> should be PRESENT
    const dateC_in = new Date();
    dateC_in.setHours(9, 0, 0, 0);
    const dateC_out = new Date();
    dateC_out.setHours(16, 0, 0, 0);

    const recordC = new AttendanceRecord({
      tenantId: tenant._id,
      employeeId: employee._id,
      date: '2026-06-03',
      punches: [
        { time: dateC_in, type: 'IN' },
        { time: dateC_out, type: 'OUT' },
      ],
    });
    recalculateRecordRules(recordC, shift);
    console.log(`Scenario C (7 hours worked) -> status calculated: ${recordC.status}, minutes: ${recordC.totalWorkMinutes}`);
    if (recordC.status !== 'PRESENT') {
      throw new Error(`Expected status to be PRESENT, got ${recordC.status}`);
    }
    await recordC.save();
    records.push(recordC);

    // Scenario D: Worked 5 hours but checked in late (09:30 AM) -> should be SHORT_LEAVE (Short Leave overrides Late check-in rules when work mins are insufficient)
    const dateD_in = new Date();
    dateD_in.setHours(9, 30, 0, 0);
    const dateD_out = new Date();
    dateD_out.setHours(14, 30, 0, 0);

    const recordD = new AttendanceRecord({
      tenantId: tenant._id,
      employeeId: employee._id,
      date: '2026-06-04',
      punches: [
        { time: dateD_in, type: 'IN' },
        { time: dateD_out, type: 'OUT' },
      ],
    });
    recalculateRecordRules(recordD, shift);
    console.log(`Scenario D (Late Check-in + 5 hours worked) -> status calculated: ${recordD.status}, minutes: ${recordD.totalWorkMinutes}`);
    if (recordD.status !== 'SHORT_LEAVE') {
      throw new Error(`Expected status to be SHORT_LEAVE, got ${recordD.status}`);
    }
    await recordD.save();
    records.push(recordD);

    console.log('✔ All rules engine boundary assertions passed successfully!');

    // ==========================================
    // TEST REPORTS & AGGREGATE STATS
    // ==========================================
    const mockRes = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      }
    };
    
    const mockNext = (err) => {
      throw err;
    };

    const mockStatsReq = {
      tenantId: tenant._id,
      query: {
        year: '2026',
        month: '6',
      }
    };

    await getAttendanceStats(mockStatsReq, mockRes, mockNext);

    if (mockRes.statusCode !== 200) {
      throw new Error(`getAttendanceStats API failed: ${mockRes.body?.error}`);
    }

    const metrics = mockRes.body.metrics;
    console.log('✔ Fetched attendance stats metrics:', metrics);

    // Scenario A, B, C, D:
    // A: HALF_DAY (present=1)
    // B: SHORT_LEAVE (present=2, shortLeave=1)
    // C: PRESENT (present=3)
    // D: SHORT_LEAVE (present=4, shortLeave=2)
    // totalPresent count should be 4
    if (metrics.totalPresent !== 4) {
      throw new Error(`Expected totalPresent to be 4, got ${metrics.totalPresent}`);
    }
    
    // totalShortLeave count should be 2
    if (metrics.totalShortLeave !== 2) {
      throw new Error(`Expected totalShortLeave to be 2, got ${metrics.totalShortLeave}`);
    }

    console.log('✔ Stats aggregations for Short Leave passed successfully!');

  } catch (error) {
    console.error('❌ SHORT-LEAVE RULES TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('Cleaning up database test records...');
    for (const rec of records) {
      await AttendanceRecord.deleteOne({ _id: rec._id });
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
