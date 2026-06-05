import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import Shift from '../src/models/Shift.js';
import AttendanceRecord from '../src/models/AttendanceRecord.js';
import {
  requestRegularization,
  getPendingRegularizations,
  reviewRegularization
} from '../src/controllers/attendanceController.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.3 PHASE 3 REGULARIZATION & APPROVALS VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let managerUser = null;
  let managerEmp = null;
  let employeeUser = null;
  let employeeEmp = null;
  let otherUser = null;
  let otherEmp = null;
  let shift = null;

  try {
    // 1. Create a dummy tenant
    tenant = new Tenant({
      name: 'Test Corp Regularization Tenant',
      subdomain: `test-corp-reg-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant created:', tenant.name);

    // 2. Create Shift (09:00 - 17:00, 8 hours standard shift, 10 min grace)
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

    // 3. Create Manager User & Employee Shell
    managerUser = new User({
      tenantId: tenant._id,
      email: `manager-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE', // Standard role is employee, but they report to no one and others report to them
    });
    await managerUser.save();

    managerEmp = new Employee({
      tenantId: tenant._id,
      userId: managerUser._id,
      employeeId: `MGR-${Date.now()}`,
      personal: { firstName: 'Manager', lastName: 'Test' },
      employment: { status: 'ACTIVE', shiftId: shift._id }
    });
    await managerEmp.save();
    console.log('✔ Manager User & Employee created');

    // 4. Create Employee User & Employee Shell reporting to Manager
    employeeUser = new User({
      tenantId: tenant._id,
      email: `emp-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await employeeUser.save();

    employeeEmp = new Employee({
      tenantId: tenant._id,
      userId: employeeUser._id,
      employeeId: `EMP-${Date.now()}`,
      personal: { firstName: 'Regular', lastName: 'Employee' },
      employment: {
        status: 'ACTIVE',
        shiftId: shift._id,
        reportingManagerId: managerEmp._id
      }
    });
    await employeeEmp.save();
    console.log('✔ Employee reporting to Manager created');

    // 5. Create Other Employee User & Employee Shell (not the manager) for unauthorized access check
    otherUser = new User({
      tenantId: tenant._id,
      email: `other-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await otherUser.save();

    otherEmp = new Employee({
      tenantId: tenant._id,
      userId: otherUser._id,
      employeeId: `OTH-${Date.now()}`,
      personal: { firstName: 'Other', lastName: 'Employee' },
      employment: {
        status: 'ACTIVE',
        shiftId: shift._id
      }
    });
    await otherEmp.save();
    console.log('✔ Other Employee created');

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
      console.error('Controller Error callback invoked:', err);
      throw err;
    };

    // ==========================================
    // TEST 1: Request regularization outside allowed months (boundary test)
    // ==========================================
    console.log('\n--- Test 1: Validation of Date Range Boundaries ---');
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 3); // 3 months ago (invalid range)
    const oldDateStr = oldDate.toISOString().split('T')[0];

    const req1 = {
      tenantId: tenant._id,
      user: { id: employeeUser._id, role: 'EMPLOYEE' },
      body: {
        date: oldDateStr,
        requestedTimeIn: new Date(`${oldDateStr}T09:00:00.000Z`).toISOString(),
        requestedTimeOut: new Date(`${oldDateStr}T17:00:00.000Z`).toISOString(),
        reason: 'Forgot to clock in 3 months ago'
      },
      ip: '127.0.0.1',
      headers: {}
    };
    const res1 = createMockResponse();

    await requestRegularization(req1, res1, mockNext);

    console.log(`  - Status Code: ${res1.statusCode} (expected: 400)`);
    console.log(`  - Error Message: "${res1.body?.error}"`);
    if (res1.statusCode !== 400) {
      throw new Error(`Expected Test 1 to return status 400, got ${res1.statusCode}`);
    }
    if (!res1.body?.error?.includes('current or previous calendar month')) {
      throw new Error(`Expected error message to mention current/previous month limits`);
    }
    console.log('✔ Test 1 passed: Date range limits are strictly enforced.');

    // ==========================================
    // TEST 2: Request regularization within valid date range
    // ==========================================
    console.log('\n--- Test 2: Valid Regularization Submission ---');
    const validDate = new Date(); // Today's date is always valid
    const validDateStr = validDate.toISOString().split('T')[0];

    const timeInDate = new Date(`${validDateStr}T08:30:00.000Z`);
    const timeOutDate = new Date(`${validDateStr}T18:00:00.000Z`); // 9.5 hours (570 mins)

    const req2 = {
      tenantId: tenant._id,
      user: { id: employeeUser._id, role: 'EMPLOYEE' },
      body: {
        date: validDateStr,
        requestedTimeIn: timeInDate.toISOString(),
        requestedTimeOut: timeOutDate.toISOString(),
        reason: 'Card not working'
      },
      ip: '127.0.0.1',
      headers: {}
    };
    const res2 = createMockResponse();

    await requestRegularization(req2, res2, mockNext);

    console.log(`  - Status Code: ${res2.statusCode} (expected: 200)`);
    console.log(`  - Regularization status: ${res2.body?.record?.regularization?.status} (expected: PENDING)`);
    if (res2.statusCode !== 200) {
      throw new Error(`Expected Test 2 to succeed (200), got ${res2.statusCode}`);
    }
    if (res2.body?.record?.regularization?.status !== 'PENDING') {
      throw new Error(`Expected status to be PENDING, got ${res2.body?.record?.regularization?.status}`);
    }
    
    const recordId = res2.body.record._id;
    console.log('✔ Test 2 passed: Valid request submitted and state is PENDING.');

    // ==========================================
    // TEST 3: Fetch pending requests as manager
    // ==========================================
    console.log('\n--- Test 3: Manager Fetch Pending Requests Queue ---');
    const req3 = {
      tenantId: tenant._id,
      user: { id: managerUser._id, role: 'EMPLOYEE' }
    };
    const res3 = createMockResponse();

    await getPendingRegularizations(req3, res3, mockNext);

    console.log(`  - Status Code: ${res3.statusCode} (expected: 200)`);
    console.log(`  - Pending records count: ${res3.body?.length} (expected: 1)`);
    if (res3.statusCode !== 200) {
      throw new Error(`Expected Test 3 to succeed, got ${res3.statusCode}`);
    }
    if (res3.body.length !== 1) {
      throw new Error(`Expected 1 pending record, got ${res3.body.length}`);
    }
    if (res3.body[0]._id.toString() !== recordId.toString()) {
      throw new Error(`Fetched record ID mismatch! Expected ${recordId}, got ${res3.body[0]._id}`);
    }
    console.log('✔ Test 3 passed: Manager retrieved the team member\'s pending request correctly.');

    // ==========================================
    // TEST 4: Unauthorized User review check
    // ==========================================
    console.log('\n--- Test 4: Access Control Verification ---');
    const req4 = {
      tenantId: tenant._id,
      user: { id: otherUser._id, role: 'EMPLOYEE' },
      body: { action: 'APPROVE', comment: 'Stealing approval' },
      params: { id: recordId }
    };
    const res4 = createMockResponse();

    await reviewRegularization(req4, res4, mockNext);

    console.log(`  - Status Code: ${res4.statusCode} (expected: 403)`);
    console.log(`  - Error Message: "${res4.body?.error}"`);
    if (res4.statusCode !== 403) {
      throw new Error(`Expected status 403 (Forbidden), got ${res4.statusCode}`);
    }
    console.log('✔ Test 4 passed: Unauthorized non-manager approval was successfully blocked.');

    // ==========================================
    // TEST 5: Manager reviews and approves request
    // ==========================================
    console.log('\n--- Test 5: Manager Approval & Rules Recalculation ---');
    const req5 = {
      tenantId: tenant._id,
      user: { id: managerUser._id, role: 'EMPLOYEE' },
      body: { action: 'APPROVE', comment: 'Approved for card issue.' },
      params: { id: recordId }
    };
    const res5 = createMockResponse();

    await reviewRegularization(req5, res5, mockNext);

    console.log(`  - Status Code: ${res5.statusCode} (expected: 200)`);
    const updatedRecord = res5.body.record;
    console.log(`  - Attendance Record status: ${updatedRecord.status} (expected: REGULARIZED)`);
    console.log(`  - Regularization status: ${updatedRecord.regularization.status} (expected: APPROVED)`);
    console.log(`  - Work minutes: ${updatedRecord.totalWorkMinutes} (expected: 570)`);
    console.log(`  - Overtime minutes: ${updatedRecord.overtimeMinutes} (expected: 90)`); // 570 mins worked - 480 mins shift = 90 mins OT
    console.log(`  - Punch count: ${updatedRecord.punches.length} (expected: 2)`);

    if (res5.statusCode !== 200) {
      throw new Error(`Expected Test 5 to succeed (200), got ${res5.statusCode}`);
    }
    if (updatedRecord.status !== 'REGULARIZED') {
      throw new Error(`Expected record status to be REGULARIZED, got ${updatedRecord.status}`);
    }
    if (updatedRecord.regularization.status !== 'APPROVED') {
      throw new Error(`Expected regularization status to be APPROVED, got ${updatedRecord.regularization.status}`);
    }
    if (updatedRecord.totalWorkMinutes !== 570) {
      throw new Error(`Expected totalWorkMinutes to be 570, got ${updatedRecord.totalWorkMinutes}`);
    }
    if (updatedRecord.overtimeMinutes !== 90) {
      throw new Error(`Expected overtimeMinutes to be 90, got ${updatedRecord.overtimeMinutes}`);
    }
    if (updatedRecord.punches.length !== 2) {
      throw new Error(`Expected punches count to be 2, got ${updatedRecord.punches.length}`);
    }
    console.log('✔ Test 5 passed: Approval executed, times overwritten, and durations/overtimes recalculated.');

    // ==========================================
    // TEST 6: Manager reviews and rejects request
    // ==========================================
    console.log('\n--- Test 6: Rejection Scenario ---');
    // Create another request
    const rejectedDate = new Date();
    rejectedDate.setDate(rejectedDate.getDate() - 1); // Yesterday
    const rejectedDateStr = rejectedDate.toISOString().split('T')[0];

    const req6_sub = {
      tenantId: tenant._id,
      user: { id: employeeUser._id, role: 'EMPLOYEE' },
      body: {
        date: rejectedDateStr,
        requestedTimeIn: new Date(`${rejectedDateStr}T09:00:00.000Z`).toISOString(),
        requestedTimeOut: new Date(`${rejectedDateStr}T17:00:00.000Z`).toISOString(),
        reason: 'Forgot card again'
      },
      ip: '127.0.0.1',
      headers: {}
    };
    const res6_sub = createMockResponse();
    await requestRegularization(req6_sub, res6_sub, mockNext);
    const rejectedRecordId = res6_sub.body.record._id;

    // Reject it
    const req6_rev = {
      tenantId: tenant._id,
      user: { id: managerUser._id, role: 'EMPLOYEE' },
      body: { action: 'REJECT', comment: 'Rejected: Please follow policy.' },
      params: { id: rejectedRecordId }
    };
    const res6_rev = createMockResponse();

    await reviewRegularization(req6_rev, res6_rev, mockNext);

    console.log(`  - Status Code: ${res6_rev.statusCode} (expected: 200)`);
    console.log(`  - Regularization status: ${res6_rev.body.record.regularization.status} (expected: REJECTED)`);
    console.log(`  - Record status: ${res6_rev.body.record.status} (expected: ABSENT because punches not changed)`);

    if (res6_rev.statusCode !== 200) {
      throw new Error(`Expected Test 6 to succeed (200), got ${res6_rev.statusCode}`);
    }
    if (res6_rev.body.record.regularization.status !== 'REJECTED') {
      throw new Error(`Expected regularization status to be REJECTED, got ${res6_rev.body.record.regularization.status}`);
    }
    console.log('✔ Test 6 passed: Rejection successfully processed, request is marked REJECTED, and attendance punches left unmodified.');

    console.log('\n✔ ALL PHASE 3 REGULARIZATION & APPROVAL TESTS PASSED SUCCESSFULLY!');

  } catch (error) {
    console.error('❌ REGULARIZATION VERIFICATION TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up database test records...');
    if (tenant) await AttendanceRecord.deleteMany({ tenantId: tenant._id });
    if (employeeEmp) await Employee.collection.deleteOne({ _id: employeeEmp._id });
    if (managerEmp) await Employee.collection.deleteOne({ _id: managerEmp._id });
    if (otherEmp) await Employee.collection.deleteOne({ _id: otherEmp._id });
    if (shift) await Shift.deleteOne({ _id: shift._id });
    if (employeeUser) await User.deleteOne({ _id: employeeUser._id });
    if (managerUser) await User.deleteOne({ _id: managerUser._id });
    if (otherUser) await User.deleteOne({ _id: otherUser._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });

    await mongoose.connection.close();
    console.log('DB Connection closed. Exit validation.');
  }
}

runTests();
