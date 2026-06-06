import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import Shift from '../src/models/Shift.js';
import AttendanceRecord from '../src/models/AttendanceRecord.js';
import LeaveType from '../src/models/LeaveType.js';
import LeaveBalance from '../src/models/LeaveBalance.js';
import ScheduledReport from '../src/models/ScheduledReport.js';
import * as reportController from '../src/controllers/reportController.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.8 REPORTS & DASHBOARDS INTEGRATION VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let hrAdminUser = null;
  let managerUser = null;
  let employeeUser = null;

  let hrAdminEmp = null;
  let managerEmp = null;
  let employeeEmp = null;

  let shift = null;

  try {
    // 1. Create a dummy tenant
    tenant = new Tenant({
      name: 'Test Corp Reports',
      subdomain: `test-reports-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant created:', tenant.name);

    // 2. Create User accounts
    hrAdminUser = new User({
      tenantId: tenant._id,
      email: `hradmin-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'HR_ADMIN',
    });
    await hrAdminUser.save();

    managerUser = new User({
      tenantId: tenant._id,
      email: `manager-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'MANAGER',
    });
    await managerUser.save();

    employeeUser = new User({
      tenantId: tenant._id,
      email: `employee-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await employeeUser.save();

    console.log('✔ User accounts created');

    // 3. Create Shift
    shift = new Shift({
      tenantId: tenant._id,
      name: 'Report Shift',
      startTime: '09:00',
      endTime: '17:00',
      gracePeriodMins: 10,
      halfDayThresholdMins: 240,
    });
    await shift.save();

    // 4. Create Employee profiles
    hrAdminEmp = new Employee({
      tenantId: tenant._id,
      userId: hrAdminUser._id,
      employeeId: 'EMP-HR-ADMIN-01',
      personal: { firstName: 'Donald', lastName: 'HR' },
      employment: {
        joiningDate: new Date('2026-01-15'),
        status: 'ACTIVE',
        department: 'Human Resources',
        location: 'HQ',
        shiftId: shift._id,
      }
    });
    await hrAdminEmp.save();

    managerEmp = new Employee({
      tenantId: tenant._id,
      userId: managerUser._id,
      employeeId: 'EMP-MGR-01',
      personal: { firstName: 'Grace', lastName: 'Manager' },
      employment: {
        joiningDate: new Date('2026-02-10'),
        status: 'ACTIVE',
        department: 'Engineering',
        location: 'HQ',
        shiftId: shift._id,
      }
    });
    await managerEmp.save();

    employeeEmp = new Employee({
      tenantId: tenant._id,
      userId: employeeUser._id,
      employeeId: 'EMP-STAFF-01',
      personal: { firstName: 'Alan', lastName: 'Employee' },
      employment: {
        joiningDate: new Date('2026-03-01'),
        status: 'ACTIVE',
        department: 'Engineering',
        location: 'HQ',
        reportingManagerId: managerEmp._id,
        shiftId: shift._id,
      }
    });
    await employeeEmp.save();

    console.log('✔ Employee mappings registered');

    // 5. Seed Attendance record (Employee is late, Manager is on-time)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const mgrRecord = new AttendanceRecord({
      tenantId: tenant._id,
      employeeId: managerEmp._id,
      date: todayStr,
      status: 'PRESENT',
      totalWorkMinutes: 480,
      overtimeMinutes: 60,
    });
    await mgrRecord.save();

    const empRecord = new AttendanceRecord({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      date: todayStr,
      status: 'LATE',
      totalWorkMinutes: 460,
      overtimeMinutes: 0,
    });
    await empRecord.save();

    console.log('✔ Attendance history seeded');

    // Setup Mock Request/Response helpers
    const createMockRes = () => ({
      statusCode: 200,
      headers: {},
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      header(name, val) { this.headers[name] = val; return this; },
      attachment(filename) { this.attachmentName = filename; return this; },
      send(data) { this.body = data; return this; }
    });

    const mockNext = (err) => {
      console.error('Controller Error Call:', err);
      throw err;
    };


    // ==========================================
    // TEST CASE 1: ROLE-BASED DASHBOARD METRICS
    // ==========================================
    console.log('\n--- Test Case 1: Role-based dashboard metrics scoping ---');

    // A. HR Admin (should see global active headcount = 3)
    const req1A = {
      tenantId: tenant._id,
      user: { id: hrAdminUser._id, role: 'HR_ADMIN' },
    };
    const res1A = createMockRes();
    await reportController.getDashboardMetrics(req1A, res1A, mockNext);

    console.log('HR Admin metrics:', res1A.body.metrics);
    if (res1A.body.metrics.headcount !== 3) {
      throw new Error(`Expected global headcount to be 3, got: ${res1A.body.metrics.headcount}`);
    }
    console.log('✔ Assert passed: HR Admin dashboard retrieves global headcount count correctly');

    // B. Manager (should see team headcount = 2: Manager + Direct Report)
    const req1B = {
      tenantId: tenant._id,
      user: { id: managerUser._id, role: 'MANAGER' },
    };
    const res1B = createMockRes();
    await reportController.getDashboardMetrics(req1B, res1B, mockNext);

    console.log('Manager metrics:', res1B.body.metrics);
    if (res1B.body.metrics.headcount !== 2) {
      throw new Error(`Expected manager team headcount to be 2, got: ${res1B.body.metrics.headcount}`);
    }
    console.log('✔ Assert passed: Manager dashboard filters statistics to direct reports count correctly');

    // C. Employee (should see personal attendance stats only)
    const req1C = {
      tenantId: tenant._id,
      user: { id: employeeUser._id, role: 'EMPLOYEE' },
    };
    const res1C = createMockRes();
    await reportController.getDashboardMetrics(req1C, res1C, mockNext);

    console.log('Employee personal stats:', res1C.body.metrics);
    if (res1C.body.metrics.lateDays !== 1 || res1C.body.metrics.presentDays !== 1) {
      throw new Error(`Expected personal late/present days to be 1, got: ${JSON.stringify(res1C.body.metrics)}`);
    }
    console.log('✔ Assert passed: Employee dashboard retrieves personal logs successfully');


    // ==========================================
    // TEST CASE 2: TABULAR REPORT QUERY (OVERTIME)
    // ==========================================
    console.log('\n--- Test Case 2: Tabular Report Query ---');

    const req2 = {
      tenantId: tenant._id,
      user: { id: hrAdminUser._id, role: 'HR_ADMIN' },
      query: { type: 'overtime', startDate: todayStr, endDate: todayStr }
    };
    const res2 = createMockRes();
    await reportController.getReportData(req2, res2, mockNext);

    console.log('Overtime report data:', res2.body);
    if (res2.body.length !== 1 || res2.body[0].employeeId !== 'EMP-MGR-01') {
      throw new Error(`Expected 1 manager overtime record in report, got: ${res2.body.length}`);
    }
    console.log('✔ Assert passed: Overtime report correctly isolates and aggregates overtime hours');


    // ==========================================
    // TEST CASE 3: CSV EXPORT FORMATTING
    // ==========================================
    console.log('\n--- Test Case 3: CSV Export formatting ---');

    const req3 = {
      tenantId: tenant._id,
      user: { id: hrAdminUser._id, role: 'HR_ADMIN' },
      query: { type: 'attendance', startDate: todayStr, endDate: todayStr }
    };
    const res3 = createMockRes();
    await reportController.exportReportCSV(req3, res3, mockNext);

    console.log('CSV Content Preview:\n', res3.body);
    if (res3.headers['Content-Type'] !== 'text/csv' || !res3.body.includes('presentDays,lateDays')) {
      throw new Error('CSV Export response does not contain correct format headers.');
    }
    console.log('✔ Assert passed: CSV download dispatches files attachments with correct headers');


    // ==========================================
    // TEST CASE 4: DELIVERY SCHEDULER & MOCK SMTP
    // ==========================================
    console.log('\n--- Test Case 4: Delivery Scheduler & Sweep ---');

    // Create schedule config
    const req4A = {
      tenantId: tenant._id,
      user: { id: hrAdminUser._id, role: 'HR_ADMIN' },
      body: {
        reportType: 'headcount',
        frequency: 'WEEKLY',
        recipients: ['hr@company.com', 'ceo@company.com'],
        department: 'Engineering',
      }
    };
    const res4A = createMockRes();
    await reportController.scheduleReport(req4A, res4A, mockNext);

    console.log('Schedule registered:', res4A.body.schedule.reportType, res4A.body.schedule.frequency);

    // Assert DB record
    const schedCount = await ScheduledReport.countDocuments({ tenantId: tenant._id });
    if (schedCount !== 1) {
      throw new Error(`Expected 1 registered schedule in DB, got: ${schedCount}`);
    }

    // Trigger run sweep checks
    const req4B = {
      tenantId: tenant._id,
      user: { id: hrAdminUser._id, role: 'HR_ADMIN' },
    };
    const res4B = createMockRes();
    await reportController.triggerScheduledRuns(req4B, res4B, mockNext);

    console.log('Runs check complete status:', res4B.body.message);
    if (!res4B.body.message.includes('Dispatches processed: 1')) {
      throw new Error('Scheduled runner failed to pick up and process active report configs.');
    }
    console.log('✔ Assert passed: Delivery scheduler sweeps and dispatches attachments via mock SMTP logs');


    console.log('\n✔✔✔ ALL SECTION 6.8 REPORTS & DASHBOARDS TESTS COMPLETED SUCCESSFULLY! ✔✔✔');

  } catch (err) {
    console.error('\n❌ REPORTS TESTING FAILURE:', err);
    process.exitCode = 1;
  } finally {
    console.log('\nTearing down report test records...');
    await ScheduledReport.deleteMany({ tenantId: tenant?._id });
    await AttendanceRecord.deleteMany({ tenantId: tenant?._id });
    if (shift) await Shift.deleteOne({ _id: shift._id });
    if (employeeEmp) await Employee.collection.deleteOne({ _id: employeeEmp._id });
    if (managerEmp) await Employee.collection.deleteOne({ _id: managerEmp._id });
    if (hrAdminEmp) await Employee.collection.deleteOne({ _id: hrAdminEmp._id });

    if (employeeUser) await User.deleteOne({ _id: employeeUser._id });
    if (managerUser) await User.deleteOne({ _id: managerUser._id });
    if (hrAdminUser) await User.deleteOne({ _id: hrAdminUser._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });

    await mongoose.connection.close();
    console.log('Database connection terminated. Done.');
  }
}

runTests();
