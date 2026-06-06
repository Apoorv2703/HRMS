import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import Shift from '../src/models/Shift.js';
import Holiday from '../src/models/Holiday.js';
import LeaveType from '../src/models/LeaveType.js';
import LeaveBalance from '../src/models/LeaveBalance.js';
import LeaveRequest from '../src/models/LeaveRequest.js';
import { createLeaveType } from '../src/controllers/leaveConfigController.js';
import { applyLeave, cancelLeaveRequest, reviewLeaveRequest } from '../src/controllers/leaveRequestController.js';
import { getMusterRegister, getAttendanceStats } from '../src/controllers/attendanceReportController.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.4 LEAVE MANAGEMENT INTEGRATION VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let adminUser = null;
  let managerUser = null;
  let employeeUser = null;
  let managerEmp = null;
  let employeeEmp = null;
  let shift = null;
  let holiday = null;
  let paidLeaveType = null;
  let unpaidLeaveType = null;

  try {
    // 1. Setup Tenant
    tenant = new Tenant({
      name: 'Test Corp Leaves Tenant',
      subdomain: `test-corp-lt-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant created:', tenant.name);

    // 2. Setup Users & Manager hierarchy
    adminUser = new User({
      tenantId: tenant._id,
      email: `admin-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'HR_ADMIN',
    });
    await adminUser.save();

    managerUser = new User({
      tenantId: tenant._id,
      email: `mgr-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'MANAGER',
    });
    await managerUser.save();

    employeeUser = new User({
      tenantId: tenant._id,
      email: `emp-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await employeeUser.save();

    // 3. Setup Default Shift
    shift = new Shift({
      tenantId: tenant._id,
      name: 'Day Shift',
      startTime: '09:00',
      endTime: '17:00',
      weeklyOffs: [0, 6], // Sat & Sun off
    });
    await shift.save();

    // 4. Onboard Employees
    managerEmp = new Employee({
      tenantId: tenant._id,
      userId: managerUser._id,
      employeeId: 'MGR-01',
      personal: { firstName: 'Alice', lastName: 'Manager' },
      employment: {
        status: 'ACTIVE',
        shiftId: shift._id,
        location: 'HQ',
      },
    });
    await managerEmp.save();

    employeeEmp = new Employee({
      tenantId: tenant._id,
      userId: employeeUser._id,
      employeeId: 'EMP-01',
      personal: { firstName: 'Bob', lastName: 'Developer' },
      employment: {
        status: 'ACTIVE',
        shiftId: shift._id,
        reportingManagerId: managerEmp._id,
        location: 'HQ',
      },
    });
    await employeeEmp.save();
    console.log('✔ Onboarded Alice (Manager) and Bob (Developer reporting to Alice)');

    // 5. Configure Leave Types (via controller to test auto-provisioning)
    console.log('\n--- Test 1: Policy Setup & Quota Auto-Provisioning ---');
    const mockRes1 = {
      statusCode: 201,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const mockNext = (err) => { throw err; };

    const createReqPaid = {
      tenantId: tenant._id,
      user: { id: adminUser._id },
      body: {
        name: 'Casual Leave',
        code: 'CL',
        annualEntitlement: 10,
        allowHalfDay: true,
        allowNegativeBalance: false,
      }
    };
    await createLeaveType(createReqPaid, mockRes1, mockNext);
    paidLeaveType = mockRes1.body.leaveType;
    console.log(`✔ Paid leave policy ${paidLeaveType.code} created`);

    // Create Unpaid LWP type
    const mockRes2 = {
      statusCode: 201,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const createReqUnpaid = {
      tenantId: tenant._id,
      user: { id: adminUser._id },
      body: {
        name: 'Leave Without Pay',
        code: 'LWP',
        annualEntitlement: 0,
        allowHalfDay: true,
        allowNegativeBalance: true, // LWP allows going into negative/deficit
      }
    };
    await createLeaveType(createReqUnpaid, mockRes2, mockNext);
    unpaidLeaveType = mockRes2.body.leaveType;
    console.log(`✔ Unpaid leave policy ${unpaidLeaveType.code} created`);

    // Check balances were auto-seeded
    const bobBalances = await LeaveBalance.find({ tenantId: tenant._id, employeeId: employeeEmp._id });
    console.log(`Bob's initial balance count: ${bobBalances.length}`);
    if (bobBalances.length !== 2) {
      throw new Error(`Expected 2 balance rows for Bob, got ${bobBalances.length}`);
    }
    const bobCLBalance = bobBalances.find(b => b.leaveTypeId.toString() === paidLeaveType._id.toString());
    if (bobCLBalance.allocated !== 10) {
      throw new Error(`Expected Bob's CL balance allocation to be 10, got ${bobCLBalance.allocated}`);
    }
    console.log('✔ Test 1 passed: Policies created and quotas auto-provisioned correctly');

    // ==========================================
    // TEST 2: LEAVE APPLICATION & LOCKING Workflow
    // ==========================================
    console.log('\n--- Test 2: Leave Application & Balance Locking ---');
    const mockApplyRes1 = {
      statusCode: 201,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };

    // Bob applies for a 3-day LWP leave (Mon Jun 15 to Wed Jun 17, 2026)
    const applyReq1 = {
      tenantId: tenant._id,
      user: { id: employeeUser._id },
      body: {
        leaveTypeId: unpaidLeaveType._id.toString(),
        startDate: '2026-06-15',
        endDate: '2026-06-17',
        reason: 'Family urgent trip',
      }
    };
    await applyLeave(applyReq1, mockApplyRes1, mockNext);
    let request1 = mockApplyRes1.body.leaveRequest;
    console.log(`Request created: ID ${request1._id}, status: ${request1.status}, totalDays: ${request1.totalDays}`);

    // Verify Bob's LWP balance lock
    let bobLWPBalance = await LeaveBalance.findOne({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      leaveTypeId: unpaidLeaveType._id,
    });
    console.log(`Bob LWP Balance locked count: ${bobLWPBalance.pendingApproval} (expected: 3)`);
    if (bobLWPBalance.pendingApproval !== 3) {
      throw new Error('Leave days were not locked on submission');
    }

    // Cancel the pending request
    const mockCancelRes = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const cancelReq = {
      tenantId: tenant._id,
      user: { id: employeeUser._id },
      params: { id: request1._id.toString() }
    };
    await cancelLeaveRequest(cancelReq, mockCancelRes, mockNext);
    
    // Check balance restored
    bobLWPBalance = await LeaveBalance.findOne({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      leaveTypeId: unpaidLeaveType._id,
    });
    console.log(`Bob LWP Balance after cancellation: pending: ${bobLWPBalance.pendingApproval}, used: ${bobLWPBalance.used} (expected: 0)`);
    if (bobLWPBalance.pendingApproval !== 0) {
      throw new Error('Balance not restored on cancellation');
    }
    console.log('✔ Test 2 passed: Balance successfully locks on submission and restores on cancellation');

    // ==========================================
    // TEST 3: WEEKLY-OFF & HOLIDAY EXCLUSIONS
    // ==========================================
    console.log('\n--- Test 3: Weekly-Off & Holiday Exclusions ---');
    
    // Create a location-specific holiday on Friday, June 19, 2026
    holiday = new Holiday({
      tenantId: tenant._id,
      name: 'Midsummer Festival',
      date: new Date('2026-06-19'),
      location: 'HQ',
    });
    await holiday.save();
    console.log(`✔ Holiday created on Friday, June 19 for location HQ`);

    // Bob applies for leave from Thu Jun 18 to Mon Jun 22, 2026
    // Thu Jun 18 -> Working
    // Fri Jun 19 -> Holiday (HQ)
    // Sat Jun 20 -> Weekly Off
    // Sun Jun 21 -> Weekly Off
    // Mon Jun 22 -> Working
    // Net working days should be 2 (Thursday & Monday)
    const mockApplyRes2 = {
      statusCode: 201,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const applyReq2 = {
      tenantId: tenant._id,
      user: { id: employeeUser._id },
      body: {
        leaveTypeId: paidLeaveType._id.toString(),
        startDate: '2026-06-18',
        endDate: '2026-06-22',
        reason: 'Resting',
      }
    };
    await applyLeave(applyReq2, mockApplyRes2, mockNext);
    let request2 = mockApplyRes2.body.leaveRequest;
    console.log(`Exclusion Request created: totalDays: ${request2.totalDays} (expected: 2)`);
    if (request2.totalDays !== 2) {
      throw new Error(`Expected totalDays to exclude off and holiday, resulting in 2. Got ${request2.totalDays}`);
    }
    console.log('✔ Test 3 passed: Exclusions correctly filter out holidays and weekly-offs');

    // ==========================================
    // TEST 4: OVERLAP VALIDATION PREVENTIONS
    // ==========================================
    console.log('\n--- Test 4: Overlapping Date Check Preventions ---');
    const mockApplyResFail = {
      statusCode: 201,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const applyReqFail = {
      tenantId: tenant._id,
      user: { id: employeeUser._id },
      body: {
        leaveTypeId: paidLeaveType._id.toString(),
        startDate: '2026-06-19', // overlaps with June 18-22
        endDate: '2026-06-20',
        reason: 'Another check',
      }
    };

    let overlapBlocked = false;
    try {
      await applyLeave(applyReqFail, mockApplyResFail, mockNext);
    } catch (err) {
      // It might throw next(err) or return error response
      overlapBlocked = true;
    }
    if (mockApplyResFail.statusCode === 400 || overlapBlocked || mockApplyResFail.body?.error) {
      console.log('✔ Submission blocked due to overlap (Expected)');
    } else {
      throw new Error('Overlapping request was not blocked');
    }
    console.log('✔ Test 4 passed: Overlapping requests are correctly rejected');

    // ==========================================
    // TEST 5: MANAGER REVIEW & BALANCE SETTLEMENT
    // ==========================================
    console.log('\n--- Test 5: Manager Review Approval & Quota Settlement ---');
    const mockReviewRes = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const reviewReq = {
      tenantId: tenant._id,
      user: { id: managerUser._id }, // manager Alice
      params: { id: request2._id.toString() },
      body: { action: 'APPROVE', comment: 'Enjoy your rest.' }
    };
    await reviewLeaveRequest(reviewReq, mockReviewRes, mockNext);

    let bobCLBalanceFinal = await LeaveBalance.findOne({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      leaveTypeId: paidLeaveType._id,
    });
    console.log(`Bob CL Balance after approval: pending: ${bobCLBalanceFinal.pendingApproval}, used: ${bobCLBalanceFinal.used}`);
    if (bobCLBalanceFinal.pendingApproval !== 0 || bobCLBalanceFinal.used !== 2) {
      throw new Error('Approved request did not settle balance registers correctly');
    }
    console.log('✔ Test 5 passed: Manager review transitions locked days to used counts');

    // ==========================================
    // TEST 6: LOP ACCRUAL & PAYROLL SUMMARIES
    // ==========================================
    console.log('\n--- Test 6: Unpaid LOP Accrual & Payroll Integration ---');
    
    // Bob applies for an LWP leave that is approved (e.g. 3 days Mon Jun 8 to Wed Jun 10)
    const mockApplyLWP = {
      statusCode: 201,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const applyReqLWP = {
      tenantId: tenant._id,
      user: { id: employeeUser._id },
      body: {
        leaveTypeId: unpaidLeaveType._id.toString(),
        startDate: '2026-06-08',
        endDate: '2026-06-10',
        reason: 'Unpaid personal leaves',
      }
    };
    await applyLeave(applyReqLWP, mockApplyLWP, mockNext);
    let requestLWP = mockApplyLWP.body.leaveRequest;
    console.log(`LWP Request created: totalDays: ${requestLWP.totalDays}, lopDays: ${requestLWP.lopDays}`);
    if (requestLWP.lopDays !== 3) {
      throw new Error(`Expected lopDays to be 3, got ${requestLWP.lopDays}`);
    }

    // Approve the LWP request
    const mockReviewLWP = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const reviewReqLWP = {
      tenantId: tenant._id,
      user: { id: managerUser._id },
      params: { id: requestLWP._id.toString() },
      body: { action: 'APPROVE', comment: 'Approved LWP.' }
    };
    await reviewLeaveRequest(reviewReqLWP, mockReviewLWP, mockNext);

    // Call stats endpoint to verify LOP integration
    const mockStatsRes = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const statsReq = {
      tenantId: tenant._id,
      query: { year: '2026', month: '6' }
    };
    await getAttendanceStats(statsReq, mockStatsRes, mockNext);
    
    const metrics = mockStatsRes.body.metrics;
    console.log(`Stats metrics leaves: ${metrics.totalLeaves}, LOP days: ${metrics.totalLopDays}`);
    if (metrics.totalLeaves !== 5) {
      throw new Error(`Expected totalLeaves to be 5, got ${metrics.totalLeaves}`);
    }
    if (metrics.totalLopDays !== 3) {
      throw new Error(`Expected totalLopDays to be 3, got ${metrics.totalLopDays}`);
    }
    console.log('✔ Test 6 passed: LOP days and total leaves aggregate correctly for payroll');

    // ==========================================
    // TEST 7: MUSTER GRID OVERLAY
    // ==========================================
    console.log('\n--- Test 7: Muster Register Grid Leave Overlay ---');
    const mockMusterRes = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const musterReq = {
      tenantId: tenant._id,
      query: { year: '2026', month: '6' }
    };
    await getMusterRegister(musterReq, mockMusterRes, mockNext);

    const bobGridRow = mockMusterRes.body.grid.find(r => r._id.toString() === employeeEmp._id.toString());
    console.log('Bob Muster Days Row:', bobGridRow.days);

    // Check overlays:
    // Mon Jun 8 -> LWP
    // Thu Jun 18 -> CL
    // Fri Jun 19 -> HOLIDAY
    // Sat Jun 20 -> WEEKLY_OFF
    // Mon Jun 22 -> CL
    if (bobGridRow.days['08'] !== 'LWP') {
      throw new Error(`Expected Day 08 to show LWP status, got ${bobGridRow.days['08']}`);
    }
    if (bobGridRow.days['18'] !== 'CL') {
      throw new Error(`Expected Day 18 to show CL status, got ${bobGridRow.days['18']}`);
    }
    if (bobGridRow.days['19'] !== 'HOLIDAY') {
      throw new Error(`Expected Day 19 to show HOLIDAY status, got ${bobGridRow.days['19']}`);
    }
    if (bobGridRow.days['20'] !== 'WEEKLY_OFF') {
      throw new Error(`Expected Day 20 to show WEEKLY_OFF status, got ${bobGridRow.days['20']}`);
    }
    if (bobGridRow.days['22'] !== 'CL') {
      throw new Error(`Expected Day 22 to show CL status, got ${bobGridRow.days['22']}`);
    }
    console.log('✔ Test 7 passed: Muster grid correctly overlays leave and off statuses');

    console.log('\n✔ ALL SECTION 6.4 LEAVE MANAGEMENT TESTS PASSED SUCCESSFULLY!');

  } catch (err) {
    console.error('❌ LEAVE MANAGEMENT VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up database test records...');
    if (employeeEmp) await Employee.collection.deleteOne({ _id: employeeEmp._id });
    if (managerEmp) await Employee.collection.deleteOne({ _id: managerEmp._id });
    if (shift) await Shift.deleteOne({ _id: shift._id });
    if (holiday) await Holiday.deleteOne({ _id: holiday._id });
    if (paidLeaveType) await LeaveType.deleteOne({ _id: paidLeaveType._id });
    if (unpaidLeaveType) await LeaveType.deleteOne({ _id: unpaidLeaveType._id });
    if (employeeUser) await User.deleteOne({ _id: employeeUser._id });
    if (managerUser) await User.deleteOne({ _id: managerUser._id });
    if (adminUser) await User.deleteOne({ _id: adminUser._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });
    await LeaveBalance.deleteMany({ tenantId: tenant?._id });
    await LeaveRequest.deleteMany({ tenantId: tenant?._id });

    await mongoose.connection.close();
    console.log('DB Connection closed. Exit validation.');
  }
}

runTests();
