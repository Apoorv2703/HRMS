import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import Shift from '../src/models/Shift.js';
import LeaveType from '../src/models/LeaveType.js';
import LeaveBalance from '../src/models/LeaveBalance.js';
import LeaveRequest from '../src/models/LeaveRequest.js';
import Payslip from '../src/models/Payslip.js';

import { updateProfile, getPendingEdits, reviewPendingEdits } from '../src/controllers/employeeController.js';
import { applyLeave, reviewLeaveRequest } from '../src/controllers/leaveRequestController.js';
import { generatePayslip, getMyPayslips, getPayslipDetails, getPayslipsByEmployee } from '../src/controllers/payslipController.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.5 SELF-SERVICE (ESS & MSS) INTEGRATION VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let adminUser = null;
  let managerUser = null;
  let employeeUser = null;
  let otherUser = null;
  
  let managerEmp = null;
  let employeeEmp = null;
  let otherEmp = null;
  
  let shift = null;
  let lwpLeaveType = null;
  let generatedPayslipId = null;

  try {
    // 1. Provision Test Tenant
    tenant = new Tenant({
      name: 'Self Service Corp',
      subdomain: `self-service-${Date.now()}`,
    });
    await tenant.save();
    console.log('✔ Tenant provisioned:', tenant.subdomain);

    // 2. Setup Users
    adminUser = new User({
      tenantId: tenant._id,
      email: `admin-${Date.now()}@selfservice.com`,
      passwordHash: 'Password123!',
      role: 'HR_ADMIN',
    });
    await adminUser.save();

    managerUser = new User({
      tenantId: tenant._id,
      email: `mgr-${Date.now()}@selfservice.com`,
      passwordHash: 'Password123!',
      role: 'MANAGER',
    });
    await managerUser.save();

    employeeUser = new User({
      tenantId: tenant._id,
      email: `emp-${Date.now()}@selfservice.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await employeeUser.save();

    otherUser = new User({
      tenantId: tenant._id,
      email: `other-${Date.now()}@selfservice.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await otherUser.save();
    console.log('✔ Users created');

    // 3. Setup Default Shift
    shift = new Shift({
      tenantId: tenant._id,
      name: 'Standard Day Shift',
      startTime: '09:00',
      endTime: '17:00',
      weeklyOffs: [0, 6],
    });
    await shift.save();
    console.log('✔ Shift created');

    // 4. Onboard Employees
    managerEmp = new Employee({
      tenantId: tenant._id,
      userId: managerUser._id,
      employeeId: 'MGR-02',
      personal: { firstName: 'Miranda', lastName: 'Manager' },
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
      employeeId: 'EMP-02',
      personal: { firstName: 'Evan', lastName: 'Employee' },
      employment: {
        status: 'ACTIVE',
        shiftId: shift._id,
        reportingManagerId: managerEmp._id,
        location: 'HQ',
      },
    });
    await employeeEmp.save();

    otherEmp = new Employee({
      tenantId: tenant._id,
      userId: otherUser._id,
      employeeId: 'EMP-03',
      personal: { firstName: 'Owen', lastName: 'Other' },
      employment: {
        status: 'ACTIVE',
        shiftId: shift._id,
        location: 'HQ',
      },
    });
    await otherEmp.save();
    console.log('✔ Onboarded Miranda (Manager), Evan (Reports to Miranda), and Owen (Other Employee)');

    // ==========================================
    // TEST 1: ESS PROFILE UPDATE (Immediate vs Buffer)
    // ==========================================
    console.log('\n--- Test 1: ESS Profile Update & Approvals Buffer ---');

    // Evan (EMPLOYEE) updates own profile: personalEmail (immediate) and firstName (sensitive)
    const mockResUpdate = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const mockNext = (err) => { throw err; };

    const updateReq = {
      tenantId: tenant._id,
      user: { id: employeeUser._id, role: 'EMPLOYEE' },
      params: { id: 'me' },
      body: {
        personal: {
          personalEmail: 'evan.new@gmail.com', // non-sensitive, direct update
          firstName: 'Evan Rotated', // sensitive, should buffer
        },
        bankDetails: {
          bankName: 'New Bank Corp', // sensitive, should buffer
          accountNumber: '987654321',
        }
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Test-Agent' }
    };

    await updateProfile(updateReq, mockResUpdate, mockNext);

    console.log('Update Status Code:', mockResUpdate.statusCode);
    console.log('Update Pending Status:', mockResUpdate.body.pending);
    
    // Query DB directly to verify immediate update and buffering
    let freshEvan = await Employee.findById(employeeEmp._id);
    
    // check immediate field
    console.log('Immediate field (personalEmail) updated:', freshEvan.personal.personalEmail === 'evan.new@gmail.com');
    if (freshEvan.personal.personalEmail !== 'evan.new@gmail.com') {
      throw new Error('Immediate field was not updated directly.');
    }

    // check sensitive field (should NOT be updated yet)
    console.log('Sensitive field (firstName) not updated in core:', freshEvan.personal.firstName === 'Evan');
    if (freshEvan.personal.firstName !== 'Evan') {
      throw new Error('Sensitive field updated immediately, bypassing buffer.');
    }

    // check pendingChanges buffer
    console.log('Pending changes status:', freshEvan.pendingChanges.status);
    console.log('Buffered firstName:', freshEvan.pendingChanges.data?.personal?.firstName);
    console.log('Buffered bankName:', freshEvan.pendingChanges.data?.bankDetails?.bankName);

    if (freshEvan.pendingChanges.status !== 'PENDING' || 
        freshEvan.pendingChanges.data?.personal?.firstName !== 'Evan Rotated' ||
        freshEvan.pendingChanges.data?.bankDetails?.bankName !== 'New Bank Corp') {
      throw new Error('Pending changes buffer not populated correctly.');
    }

    // Fetch pending edits as HR Admin
    const mockResPending = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const pendingReq = {
      tenantId: tenant._id,
      user: { id: adminUser._id, role: 'HR_ADMIN' }
    };
    await getPendingEdits(pendingReq, mockResPending, mockNext);
    console.log('Pending list count:', mockResPending.body.length);
    const targetPending = mockResPending.body.find(e => e._id.toString() === employeeEmp._id.toString());
    if (!targetPending || !targetPending.pendingChanges || !targetPending.pendingChanges.data) {
      throw new Error('Pending edits for our employee not listed for HR Admin.');
    }

    // Review & approve changes as HR Admin
    const mockResReview = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const reviewReq = {
      tenantId: tenant._id,
      user: { id: adminUser._id, role: 'HR_ADMIN' },
      params: { id: employeeEmp._id.toString() },
      body: { action: 'APPROVE' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Test-Agent' }
    };
    await reviewPendingEdits(reviewReq, mockResReview, mockNext);

    // Verify DB after approval
    freshEvan = await Employee.findById(employeeEmp._id);
    console.log('Approved status in core firstName:', freshEvan.personal.firstName);
    console.log('Approved status in core bankName:', freshEvan.bankDetails.bankName);
    console.log('Pending status reset:', freshEvan.pendingChanges.status);

    if (freshEvan.personal.firstName !== 'Evan Rotated' ||
        freshEvan.bankDetails.bankName !== 'New Bank Corp' ||
        freshEvan.pendingChanges.status !== 'APPROVED') {
      throw new Error('Pending changes were not applied/merged correctly upon approval.');
    }
    console.log('✔ Test 1 passed: ESS profile update and approvals buffer works correctly');

    // ==========================================
    // TEST 2: LEAVE ACCRUAL FOR LOP DAYS
    // ==========================================
    console.log('\n--- Test 2: Leave Accrual for LOP Days ---');

    // Configure LWP Leave Type
    lwpLeaveType = new LeaveType({
      tenantId: tenant._id,
      name: 'Leave Without Pay Test',
      code: 'LWP_TEST',
      annualEntitlement: 0,
      allowHalfDay: true,
      allowNegativeBalance: true,
    });
    await lwpLeaveType.save();

    // Auto-seed balances
    const balance = new LeaveBalance({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      leaveTypeId: lwpLeaveType._id,
      allocated: 0,
      used: 0,
      pendingApproval: 0,
    });
    await balance.save();

    // Apply for 3 days of LWP (June 15 to June 17, 2026)
    const mockApplyRes = {
      statusCode: 201,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const applyReq = {
      tenantId: tenant._id,
      user: { id: employeeUser._id },
      body: {
        leaveTypeId: lwpLeaveType._id.toString(),
        startDate: '2026-06-15',
        endDate: '2026-06-17',
        reason: 'Personal unpaid leave',
      }
    };
    await applyLeave(applyReq, mockApplyRes, mockNext);
    let requestLWP = mockApplyRes.body.leaveRequest;
    console.log(`LWP Leave Request totalDays: ${requestLWP.totalDays}, lopDays: ${requestLWP.lopDays}`);
    if (requestLWP.lopDays !== 3) {
      throw new Error(`Expected lopDays to be 3, got ${requestLWP.lopDays}`);
    }

    // Approve the LWP request as Manager
    const mockReviewLWP = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const reviewReqLWP = {
      tenantId: tenant._id,
      user: { id: managerUser._id },
      params: { id: requestLWP._id.toString() },
      body: { action: 'APPROVE', comment: 'Approved.' }
    };
    await reviewLeaveRequest(reviewReqLWP, mockReviewLWP, mockNext);
    console.log('LWP Leave approved.');
    console.log('✔ Test 2 passed: LOP days registered on approved leave request');

    // ==========================================
    // TEST 3: PAYSLIP GENERATION & LOP DEDUCTION
    // ==========================================
    console.log('\n--- Test 3: Payslip Generation & LOP Deduction ---');

    const mockResPayslip = {
      statusCode: 201,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const payslipReq = {
      tenantId: tenant._id,
      user: { id: adminUser._id, role: 'HR_ADMIN' },
      body: {
        employeeId: employeeEmp._id.toString(),
        month: 6,
        year: 2026,
        basicSalary: 30000,
        allowances: 5000,
        deductions: 2000,
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Test-Agent' }
    };

    await generatePayslip(payslipReq, mockResPayslip, mockNext);
    console.log('Payslip Status Code:', mockResPayslip.statusCode);
    
    const payslip = mockResPayslip.body.payslip;
    generatedPayslipId = payslip._id;
    console.log('Payslip lopDays calculated:', payslip.lopDays);
    console.log('Payslip deductions calculated:', payslip.deductions);
    console.log('Payslip netSalary calculated:', payslip.netSalary);

    // June 2026 has 30 days.
    // basicSalary = 30000. dailyRate = 30000 / 30 = 1000.
    // LOP days = 3. LOP deduction = 3 * 1000 = 3000.
    // Other deductions = 2000.
    // Total deductions = 2000 + 3000 = 5000.
    // Net Salary = 30000 + 5000 - 5000 = 30000.
    
    if (payslip.lopDays !== 3) {
      throw new Error(`Expected lopDays to be 3, got ${payslip.lopDays}`);
    }
    if (payslip.deductions !== 5000) {
      throw new Error(`Expected total deductions to be 5000, got ${payslip.deductions}`);
    }
    if (payslip.netSalary !== 30000) {
      throw new Error(`Expected netSalary to be 30000, got ${payslip.netSalary}`);
    }
    console.log('✔ Test 3 passed: Payslip LOP deduction computed correctly');

    // ==========================================
    // TEST 4: PAYSLIP ACCESS SCOPES (ESS & MSS)
    // ==========================================
    console.log('\n--- Test 4: Payslip Access Scopes ---');

    // A. Employee retrieves own payslips (ESS)
    const mockResMyPayslips = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const myPayslipsReq = {
      tenantId: tenant._id,
      user: { id: employeeUser._id, role: 'EMPLOYEE' }
    };
    await getMyPayslips(myPayslipsReq, mockResMyPayslips, mockNext);
    console.log('Employee fetched own payslips count:', mockResMyPayslips.body.length);
    if (mockResMyPayslips.body.length !== 1 || mockResMyPayslips.body[0]._id.toString() !== generatedPayslipId.toString()) {
      throw new Error('Employee failed to retrieve own payslip.');
    }

    // B. Employee retrieves specific payslip details
    const mockResDetailsSelf = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const detailsSelfReq = {
      tenantId: tenant._id,
      user: { id: employeeUser._id, role: 'EMPLOYEE' },
      params: { id: generatedPayslipId.toString() }
    };
    await getPayslipDetails(detailsSelfReq, mockResDetailsSelf, mockNext);
    console.log('Employee fetched details status:', mockResDetailsSelf.statusCode);
    if (mockResDetailsSelf.body._id.toString() !== generatedPayslipId.toString()) {
      throw new Error('Employee failed to fetch specific own payslip details.');
    }

    // C. Manager retrieves details of direct report (MSS)
    const mockResDetailsMgr = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const detailsMgrReq = {
      tenantId: tenant._id,
      user: { id: managerUser._id, role: 'MANAGER' },
      params: { id: generatedPayslipId.toString() }
    };
    await getPayslipDetails(detailsMgrReq, mockResDetailsMgr, mockNext);
    console.log('Manager fetched details status:', mockResDetailsMgr.statusCode);
    if (mockResDetailsMgr.body._id.toString() !== generatedPayslipId.toString()) {
      throw new Error("Manager failed to retrieve direct report's payslip details.");
    }

    // D. HR Admin retrieves details
    const mockResDetailsAdmin = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const detailsAdminReq = {
      tenantId: tenant._id,
      user: { id: adminUser._id, role: 'HR_ADMIN' },
      params: { id: generatedPayslipId.toString() }
    };
    await getPayslipDetails(detailsAdminReq, mockResDetailsAdmin, mockNext);
    console.log('Admin fetched details status:', mockResDetailsAdmin.statusCode);
    if (mockResDetailsAdmin.body._id.toString() !== generatedPayslipId.toString()) {
      throw new Error('Admin failed to retrieve payslip details.');
    }

    // E. Unauthorized employee tries to retrieve details of another employee
    const mockResDetailsOther = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const detailsOtherReq = {
      tenantId: tenant._id,
      user: { id: otherUser._id, role: 'EMPLOYEE' },
      params: { id: generatedPayslipId.toString() }
    };
    let unauthBlocked = false;
    try {
      await getPayslipDetails(detailsOtherReq, mockResDetailsOther, mockNext);
    } catch (err) {
      unauthBlocked = true;
    }
    if (mockResDetailsOther.statusCode === 403 || unauthBlocked || mockResDetailsOther.body?.error) {
      console.log('✔ Access denied for unauthorized employee (Expected)');
    } else {
      throw new Error("Unauthorized employee was able to access another employee's payslip.");
    }
    console.log('✔ Test 4 passed: Payslip access control scopes enforced successfully');

    console.log('\n✔ ALL SECTION 6.5 SELF-SERVICE INTEGRATION TESTS PASSED SUCCESSFULLY!');

  } catch (err) {
    console.error('❌ SELF-SERVICE VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up database test records...');
    
    if (generatedPayslipId) {
      await Payslip.deleteOne({ _id: generatedPayslipId });
    }
    if (lwpLeaveType) {
      await LeaveType.deleteOne({ _id: lwpLeaveType._id });
      await LeaveBalance.deleteMany({ tenantId: tenant?._id });
      await LeaveRequest.deleteMany({ tenantId: tenant?._id });
    }
    if (employeeEmp) await Employee.collection.deleteOne({ _id: employeeEmp._id });
    if (managerEmp) await Employee.collection.deleteOne({ _id: managerEmp._id });
    if (otherEmp) await Employee.collection.deleteOne({ _id: otherEmp._id });
    if (shift) await Shift.deleteOne({ _id: shift._id });
    
    if (employeeUser) await User.deleteOne({ _id: employeeUser._id });
    if (managerUser) await User.deleteOne({ _id: managerUser._id });
    if (adminUser) await User.deleteOne({ _id: adminUser._id });
    if (otherUser) await User.deleteOne({ _id: otherUser._id });
    
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });

    await mongoose.connection.close();
    console.log('DB Connection closed. Exit validation.');
  }
}

runTests();
