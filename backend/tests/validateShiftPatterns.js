import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import Shift from '../src/models/Shift.js';
import EmployeeShiftSchedule from '../src/models/EmployeeShiftSchedule.js';
import AttendanceRecord from '../src/models/AttendanceRecord.js';
import { recalculateRecordRules } from '../src/controllers/attendanceController.js';
import { assignShiftToTeam, assignRotationalShifts } from '../src/controllers/attendanceConfigController.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.3 FLEXIBLE, ROTATIONAL & BULK SHIFTS INTEGRATION VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let user = null;
  let employee1 = null;
  let employee2 = null;
  let defaultShift = null;
  let flexShift = null;
  let overrideShift = null;
  let records = [];

  try {
    // 1. Setup Tenant
    tenant = new Tenant({
      name: 'Test Corp Shift Patterns',
      subdomain: `test-corp-sp-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant created:', tenant.name);

    // 2. Setup User
    user = new User({
      tenantId: tenant._id,
      email: `spadmin-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'HR_ADMIN',
    });
    await user.save();
    console.log('✔ Admin User created');

    // 3. Setup Shifts
    // Standard Fixed Shift
    defaultShift = new Shift({
      tenantId: tenant._id,
      name: 'Standard Fixed Shift',
      startTime: '09:00',
      endTime: '17:00',
      gracePeriodMins: 15,
      weeklyOffs: [0, 6],
    });
    await defaultShift.save();
    console.log('✔ Standard fixed shift created');

    // Flexible Shift (No late mark, OT over minWorkMinutesPerDay)
    flexShift = new Shift({
      tenantId: tenant._id,
      name: 'Flexible Shift',
      startTime: '09:00',
      endTime: '17:00',
      weeklyOffs: [0, 6],
      type: 'FLEXIBLE',
      minWorkMinutesPerDay: 480, // 8 hours threshold
    });
    await flexShift.save();
    console.log('✔ Flexible shift created');

    // Override Fixed Shift
    overrideShift = new Shift({
      tenantId: tenant._id,
      name: 'Override Shift',
      startTime: '13:00',
      endTime: '21:00',
      weeklyOffs: [0, 6],
    });
    await overrideShift.save();
    console.log('✔ Rotational override shift created');

    // 4. Setup Employees
    employee1 = new Employee({
      tenantId: tenant._id,
      userId: user._id,
      employeeId: `EMP-${Date.now()}-A`,
      personal: { firstName: 'Alice', lastName: 'Developer' },
      employment: {
        status: 'ACTIVE',
        shiftId: defaultShift._id,
        assignedShift: defaultShift.name,
        department: 'Engineering',
        location: 'Headquarters',
      },
    });
    await employee1.save();

    employee2 = new Employee({
      tenantId: tenant._id,
      userId: new mongoose.Types.ObjectId(),
      employeeId: `EMP-${Date.now()}-B`,
      personal: { firstName: 'Bob', lastName: 'Salesperson' },
      employment: {
        status: 'ACTIVE',
        shiftId: defaultShift._id,
        assignedShift: defaultShift.name,
        department: 'Sales',
        location: 'Branch',
      },
    });
    await employee2.save();
    console.log('✔ Employees seeded: Alice (Engineering), Bob (Sales)');

    // ==========================================
    // TEST 1: FLEXIBLE SHIFTS RULES EVALUATION
    // ==========================================
    console.log('\n--- Test 1: Flexible Shifts Rules Engine ---');
    
    // Alice clocks in late relative to 09:00 (e.g. 09:30 AM), but works 9.5 hours (570 mins)
    const date1_in = new Date();
    date1_in.setHours(9, 30, 0, 0);
    const date1_out = new Date();
    date1_out.setHours(19, 0, 0, 0); // 9 hours 30 mins

    const flexRecord = new AttendanceRecord({
      tenantId: tenant._id,
      employeeId: employee1._id,
      date: '2026-06-01',
      punches: [
        { time: date1_in, type: 'IN' },
        { time: date1_out, type: 'OUT' },
      ],
    });

    recalculateRecordRules(flexRecord, flexShift);
    console.log(`Flex Record Calculated -> Status: ${flexRecord.status}, Total Work Minutes: ${flexRecord.totalWorkMinutes}, Overtime Minutes: ${flexRecord.overtimeMinutes}`);

    // Assertions
    if (flexRecord.status !== 'PRESENT') {
      throw new Error(`Expected status to be PRESENT, got ${flexRecord.status} (flexible shift should never mark late check-in)`);
    }
    if (flexRecord.totalWorkMinutes !== 570) {
      throw new Error(`Expected work minutes to be 570, got ${flexRecord.totalWorkMinutes}`);
    }
    if (flexRecord.overtimeMinutes !== 90) { // 570 - 480
      throw new Error(`Expected overtime to be 90 minutes, got ${flexRecord.overtimeMinutes}`);
    }
    console.log('✔ Test 1 passed: Flexible shift evaluates duration correctly without late marks');

    // ==========================================
    // TEST 2: BULK TEAM SHIFT ASSIGNMENT
    // ==========================================
    console.log('\n--- Test 2: Bulk Team Shift Assignment ---');
    
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
    const mockNext = (err) => { throw err; };

    const bulkReq = {
      tenantId: tenant._id,
      user: { id: user._id },
      body: {
        department: 'Engineering',
        shiftId: flexShift._id,
      }
    };

    await assignShiftToTeam(bulkReq, mockRes, mockNext);

    if (mockRes.statusCode !== 200) {
      throw new Error(`Bulk assign controller returned status code ${mockRes.statusCode}`);
    }

    // Verify DB states
    const checkEmp1 = await Employee.findById(employee1._id);
    const checkEmp2 = await Employee.findById(employee2._id);

    console.log(`Alice Shift: ${checkEmp1.employment.assignedShift} (${checkEmp1.employment.shiftId})`);
    console.log(`Bob Shift: ${checkEmp2.employment.assignedShift} (${checkEmp2.employment.shiftId})`);

    if (checkEmp1.employment.shiftId.toString() !== flexShift._id.toString()) {
      throw new Error('Alice (Engineering) shift was not updated to flexible shift');
    }
    if (checkEmp2.employment.shiftId.toString() !== defaultShift._id.toString()) {
      throw new Error('Bob (Sales) shift was incorrectly updated during department bulk change');
    }
    console.log('✔ Test 2 passed: Bulk team mapping target matching works correctly');

    // ==========================================
    // TEST 3: ROTATIONAL SHIFT SCHEDULER (OVERLOAD BY DATE)
    // ==========================================
    console.log('\n--- Test 3: Rotational Shift Scheduler Overrides ---');

    const rotationalRes = {
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

    const rotationalReq = {
      tenantId: tenant._id,
      user: { id: user._id },
      body: {
        employeeIds: [employee1._id.toString()],
        startDate: '2026-06-05',
        endDate: '2026-06-07',
        shiftId: overrideShift._id,
      }
    };

    await assignRotationalShifts(rotationalReq, rotationalRes, mockNext);

    if (rotationalRes.statusCode !== 200) {
      throw new Error(`Rotational schedule setup failed: ${rotationalRes.body?.error}`);
    }

    // Check EmployeeShiftSchedule is created
    const schedules = await EmployeeShiftSchedule.find({
      tenantId: tenant._id,
      employeeId: employee1._id,
    });
    console.log(`Rotational records created for Alice: ${schedules.length} days`);
    if (schedules.length !== 3) {
      throw new Error(`Expected 3 schedule override records, got ${schedules.length}`);
    }

    const targetDateSched = await EmployeeShiftSchedule.findOne({
      tenantId: tenant._id,
      employeeId: employee1._id,
      date: '2026-06-06',
    });
    if (!targetDateSched || targetDateSched.shiftId.toString() !== overrideShift._id.toString()) {
      throw new Error('Override shift schedule was not created for 2026-06-06');
    }
    console.log('✔ Test 3 passed: Rotational shift mapping overrides are stored successfully');

    console.log('\n✔ All tests passed successfully!');

  } catch (err) {
    console.error('❌ SHIFT PATTERNS VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up database test records...');
    if (employee1) await Employee.collection.deleteOne({ _id: employee1._id });
    if (employee2) await Employee.collection.deleteOne({ _id: employee2._id });
    if (defaultShift) await Shift.deleteOne({ _id: defaultShift._id });
    if (flexShift) await Shift.deleteOne({ _id: flexShift._id });
    if (overrideShift) await Shift.deleteOne({ _id: overrideShift._id });
    if (user) await User.deleteOne({ _id: user._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });
    await EmployeeShiftSchedule.deleteMany({ tenantId: tenant?._id });

    await mongoose.connection.close();
    console.log('DB Connection closed. Exit validation.');
  }
}

runTests();
