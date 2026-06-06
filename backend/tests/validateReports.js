import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import Shift from '../src/models/Shift.js';
import Holiday from '../src/models/Holiday.js';
import AttendanceRecord from '../src/models/AttendanceRecord.js';
import { getMusterRegister, getAttendanceStats } from '../src/controllers/attendanceReportController.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.3 PHASE 4 MUSTER REGISTER & REPORTS VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let user1 = null;
  let emp1 = null;
  let user2 = null;
  let emp2 = null;
  let shift = null;
  let holiday = null;

  try {
    // 1. Create a dummy tenant
    tenant = new Tenant({
      name: 'Test Corp Reports Tenant',
      subdomain: `test-corp-rep-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant created:', tenant.name);

    // 2. Create Shift (09:00 - 17:00, 8 hours standard shift, weekly off on Sundays only for testing)
    shift = new Shift({
      tenantId: tenant._id,
      name: 'Report Day Shift',
      startTime: '09:00',
      endTime: '17:00',
      gracePeriodMins: 10,
      halfDayThresholdMins: 240,
      weeklyOffs: [0] // Sunday is weekly off
    });
    await shift.save();
    console.log('✔ Shift configured');

    // 3. Create Holiday on the 10th of the current month (specifically for HQ location)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const monthStr = month.toString().padStart(2, '0');

    holiday = new Holiday({
      tenantId: tenant._id,
      name: 'Report Test Holiday',
      date: new Date(`${year}-${monthStr}-10T00:00:00.000Z`),
      location: 'HQ'
    });
    await holiday.save();
    console.log('✔ Location-specific Holiday (HQ) created on the 10th of the month');

    // 4. Create Employee 1 (HQ location)
    user1 = new User({
      tenantId: tenant._id,
      email: `emp1-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await user1.save();

    emp1 = new Employee({
      tenantId: tenant._id,
      userId: user1._id,
      employeeId: `EMP-REP-1`,
      personal: { firstName: 'Donald', lastName: 'Knuth' },
      employment: {
        status: 'ACTIVE',
        shiftId: shift._id,
        location: 'HQ'
      }
    });
    await emp1.save();

    // 5. Create Employee 2 (Remote location)
    user2 = new User({
      tenantId: tenant._id,
      email: `emp2-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await user2.save();

    emp2 = new Employee({
      tenantId: tenant._id,
      userId: user2._id,
      employeeId: `EMP-REP-2`,
      personal: { firstName: 'Grace', lastName: 'Hopper' },
      employment: {
        status: 'ACTIVE',
        shiftId: shift._id,
        location: 'Remote'
      }
    });
    await emp2.save();
    console.log('✔ Two active employees onboarded (Donald at HQ, Grace at Remote)');

    // 6. Seed mock punches for Employee 1
    // Day 1: Present, on-time, standard hours (09:00 - 17:00 = 480 worked mins, OT = 0)
    const recDay1 = new AttendanceRecord({
      tenantId: tenant._id,
      employeeId: emp1._id,
      date: `${year}-${monthStr}-01`,
      status: 'PRESENT',
      totalWorkMinutes: 480,
      overtimeMinutes: 0,
      punches: [
        { time: new Date(`${year}-${monthStr}-01T09:00:00Z`), type: 'IN' },
        { time: new Date(`${year}-${monthStr}-01T17:00:00Z`), type: 'OUT' }
      ]
    });
    await recDay1.save();

    // Day 2: Late check-in (09:20 - 17:00 = 460 worked mins, status LATE)
    const recDay2 = new AttendanceRecord({
      tenantId: tenant._id,
      employeeId: emp1._id,
      date: `${year}-${monthStr}-02`,
      status: 'LATE',
      totalWorkMinutes: 460,
      overtimeMinutes: 0,
      punches: [
        { time: new Date(`${year}-${monthStr}-02T09:20:00Z`), type: 'IN' },
        { time: new Date(`${year}-${monthStr}-02T17:00:00Z`), type: 'OUT' }
      ]
    });
    await recDay2.save();

    // Day 3: Overtime (08:00 - 18:00 = 600 worked mins, OT = 120 mins, status PRESENT)
    const recDay3 = new AttendanceRecord({
      tenantId: tenant._id,
      employeeId: emp1._id,
      date: `${year}-${monthStr}-03`,
      status: 'PRESENT',
      totalWorkMinutes: 600,
      overtimeMinutes: 120,
      punches: [
        { time: new Date(`${year}-${monthStr}-03T08:00:00Z`), type: 'IN' },
        { time: new Date(`${year}-${monthStr}-03T18:00:00Z`), type: 'OUT' }
      ]
    });
    await recDay3.save();

    // Day 4: Half Day (09:00 - 12:30 = 210 worked mins < 240, status HALF_DAY)
    const recDay4 = new AttendanceRecord({
      tenantId: tenant._id,
      employeeId: emp1._id,
      date: `${year}-${monthStr}-04`,
      status: 'HALF_DAY',
      totalWorkMinutes: 210,
      overtimeMinutes: 0,
      punches: [
        { time: new Date(`${year}-${monthStr}-04T09:00:00Z`), type: 'IN' },
        { time: new Date(`${year}-${monthStr}-04T12:30:00Z`), type: 'OUT' }
      ]
    });
    await recDay4.save();

    console.log('✔ Attendance history seeded for Employee 1 (Donald)');

    // Helper to create mock request/response objects
    const createMockResponse = () => {
      return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; }
      };
    };

    const mockNext = (err) => {
      console.error('Controller Error:', err);
      throw err;
    };

    // ==========================================
    // TEST 1: Retrieve Muster Register
    // ==========================================
    console.log('\n--- Test 1: Fetch Muster Register Grid ---');
    const req1 = {
      tenantId: tenant._id,
      user: { id: user1._id, role: 'HR_ADMIN' },
      query: { year, month }
    };
    const res1 = createMockResponse();

    await getMusterRegister(req1, res1, mockNext);

    console.log(`  - Status Code: ${res1.statusCode} (expected: 200)`);
    console.log(`  - Grid Length: ${res1.body?.grid?.length} (expected: 2)`);
    
    if (res1.statusCode !== 200) {
      throw new Error(`Expected Test 1 to return status 200, got ${res1.statusCode}`);
    }
    if (res1.body.grid.length !== 2) {
      throw new Error(`Expected 2 employees in muster grid, got ${res1.body.grid.length}`);
    }

    const donaldRow = res1.body.grid.find(r => r.employeeId === 'EMP-REP-1');
    const graceRow = res1.body.grid.find(r => r.employeeId === 'EMP-REP-2');

    if (!donaldRow || !graceRow) {
      throw new Error('Could not find both employees in muster register grid');
    }

    // Verify Donald (emp1) days
    console.log('  - Donald Day 01:', donaldRow.days['01'], '(expected: PRESENT)');
    console.log('  - Donald Day 02:', donaldRow.days['02'], '(expected: LATE)');
    console.log('  - Donald Day 03:', donaldRow.days['03'], '(expected: PRESENT)');
    console.log('  - Donald Day 04:', donaldRow.days['04'], '(expected: HALF_DAY)');
    console.log('  - Donald Day 10:', donaldRow.days['10'], '(expected: HOLIDAY)');

    if (donaldRow.days['01'] !== 'PRESENT') throw new Error('Donald Day 01 status mismatch');
    if (donaldRow.days['02'] !== 'LATE') throw new Error('Donald Day 02 status mismatch');
    if (donaldRow.days['03'] !== 'PRESENT') throw new Error('Donald Day 03 status mismatch');
    if (donaldRow.days['04'] !== 'HALF_DAY') throw new Error('Donald Day 04 status mismatch');
    if (donaldRow.days['10'] !== 'HOLIDAY') throw new Error('Donald Day 10 status mismatch');

    const expectedGraceDay10Status = `${year}-${monthStr}-10` > todayStr ? '-' : 'ABSENT';
    console.log(`  - Grace Day 10: ${graceRow.days['10']} (expected: ${expectedGraceDay10Status} due to location specific holiday mismatch)`);
    if (graceRow.days['10'] !== expectedGraceDay10Status) throw new Error(`Grace Day 10 location-specific holiday check failed: should be ${expectedGraceDay10Status}`);

    // Find a Sunday to check Weekly Off
    const firstSunday = [1, 2, 3, 4, 5, 6, 7].find(d => {
      const dateObj = new Date(year, month - 1, d);
      return dateObj.getDay() === 0; // Sunday
    });
    const sundayStr = firstSunday.toString().padStart(2, '0');
    console.log(`  - Sunday Day ${sundayStr} check:`, graceRow.days[sundayStr], '(expected: WEEKLY_OFF)');
    if (graceRow.days[sundayStr] !== 'WEEKLY_OFF') {
      throw new Error(`Expected Sunday (Day ${sundayStr}) to be WEEKLY_OFF, got ${graceRow.days[sundayStr]}`);
    }

    // Verify Grace (emp2) has ABSENT for other weekdays
    const weekday = [1, 2, 3, 4, 5, 6, 7].find(d => {
      const dateObj = new Date(year, month - 1, d);
      return dateObj.getDay() !== 0 && d !== 10; // Not Sunday, not the 10th Holiday
    });
    const weekdayStr = weekday.toString().padStart(2, '0');
    console.log(`  - Weekday Day ${weekdayStr} check for Grace:`, graceRow.days[weekdayStr], '(expected: ABSENT)');
    if (graceRow.days[weekdayStr] !== 'ABSENT') {
      throw new Error(`Expected weekday (Day ${weekdayStr}) to be ABSENT for Grace, got ${graceRow.days[weekdayStr]}`);
    }

    console.log('✔ Test 1 passed: Muster Register correctly resolves actual records, holidays, weekly-offs, and absences.');

    // ==========================================
    // TEST 2: Retrieve Attendance Stats & Overtime
    // ==========================================
    console.log('\n--- Test 2: Fetch Monthly Attendance Stats & Overtime Sheet ---');
    const req2 = {
      tenantId: tenant._id,
      user: { id: user1._id, role: 'HR_ADMIN' },
      query: { year, month }
    };
    const res2 = createMockResponse();

    await getAttendanceStats(req2, res2, mockNext);

    console.log(`  - Status Code: ${res2.statusCode} (expected: 200)`);
    console.log(`  - Active Employees Count: ${res2.body?.activeEmployees} (expected: 2)`);
    console.log(`  - Metrics - Total Present Days: ${res2.body?.metrics?.totalPresent} (expected: 4)`);
    console.log(`  - Metrics - Total Late Days: ${res2.body?.metrics?.totalLate} (expected: 1)`);
    console.log(`  - Metrics - Total Half-Days: ${res2.body?.metrics?.totalHalfDay} (expected: 1)`);
    console.log(`  - Metrics - Total Overtime Hours: ${res2.body?.metrics?.totalOvertimeHours} (expected: 2.00)`);
    
    // Average work hours: (480 + 460 + 600 + 210) / 4 days / 60 mins = 1750 / 4 / 60 = 437.5 / 60 = 7.29 hours
    console.log(`  - Metrics - Average Work Hours: ${res2.body?.metrics?.avgWorkHours} (expected: 7.29)`);

    if (res2.statusCode !== 200) {
      throw new Error(`Expected Test 2 to return status 200, got ${res2.statusCode}`);
    }
    if (res2.body.activeEmployees !== 2) {
      throw new Error(`Expected 2 active employees, got ${res2.body.activeEmployees}`);
    }
    if (res2.body.metrics.totalPresent !== 4) {
      throw new Error(`Expected 4 present days, got ${res2.body.metrics.totalPresent}`);
    }
    if (res2.body.metrics.totalLate !== 1) {
      throw new Error(`Expected 1 late check-in, got ${res2.body.metrics.totalLate}`);
    }
    if (res2.body.metrics.totalHalfDay !== 1) {
      throw new Error(`Expected 1 half-day, got ${res2.body.metrics.totalHalfDay}`);
    }
    if (res2.body.metrics.totalOvertimeHours !== '2.00') {
      throw new Error(`Expected 2.00 overtime hours, got ${res2.body.metrics.totalOvertimeHours}`);
    }
    if (res2.body.metrics.avgWorkHours !== '7.29') {
      throw new Error(`Expected 7.29 average work hours, got ${res2.body.metrics.avgWorkHours}`);
    }

    // Overtime Sheet check
    console.log(`  - Overtime Sheet items count: ${res2.body?.overtimeSheet?.length} (expected: 1)`);
    if (res2.body.overtimeSheet.length !== 1) {
      throw new Error(`Expected 1 item in overtime sheet, got ${res2.body.overtimeSheet.length}`);
    }
    console.log(`    - Item 0 employee: "${res2.body.overtimeSheet[0].name}" (ID: ${res2.body.overtimeSheet[0].employeeId})`);
    console.log(`    - Overtime hours: ${res2.body.overtimeSheet[0].overtimeHours} (expected: 2.00)`);

    if (res2.body.overtimeSheet[0].employeeId !== 'EMP-REP-1') {
      throw new Error(`Expected overtime sheet to record EMP-REP-1, got ${res2.body.overtimeSheet[0].employeeId}`);
    }
    if (res2.body.overtimeSheet[0].overtimeHours !== '2.00') {
      throw new Error(`Expected overtime hours in sheet to be 2.00, got ${res2.body.overtimeSheet[0].overtimeHours}`);
    }

    console.log('✔ Test 2 passed: Stats calculations and overtime summaries are fully correct.');

    console.log('\n✔ ALL PHASE 4 MUSTER REGISTER & REPORTS TESTS PASSED SUCCESSFULLY!');

  } catch (error) {
    console.error('❌ REPORTS VERIFICATION TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up database test records...');
    if (tenant) await AttendanceRecord.deleteMany({ tenantId: tenant._id });
    if (emp1) await Employee.collection.deleteOne({ _id: emp1._id });
    if (emp2) await Employee.collection.deleteOne({ _id: emp2._id });
    if (shift) await Shift.deleteOne({ _id: shift._id });
    if (holiday) await Holiday.deleteOne({ _id: holiday._id });
    if (user1) await User.deleteOne({ _id: user1._id });
    if (user2) await User.deleteOne({ _id: user2._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });

    await mongoose.connection.close();
    console.log('DB Connection closed. Exit validation.');
  }
}

runTests();
