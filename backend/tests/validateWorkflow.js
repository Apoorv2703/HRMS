import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import LeaveType from '../src/models/LeaveType.js';
import LeaveBalance from '../src/models/LeaveBalance.js';
import LeaveRequest from '../src/models/LeaveRequest.js';
import ApprovalPolicy from '../src/models/ApprovalPolicy.js';
import ApprovalInstance from '../src/models/ApprovalInstance.js';
import ApprovalDelegation from '../src/models/ApprovalDelegation.js';
import * as workflowEngine from '../src/utils/workflowEngine.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.6 WORKFLOW & APPROVALS INTEGRATION VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let hrAdminUser = null;
  let managerUser = null;
  let employeeUser = null;
  let delegateUser = null;
  let leadershipUser = null;

  let hrAdminEmp = null;
  let managerEmp = null;
  let employeeEmp = null;
  let delegateEmp = null;
  let leadershipEmp = null;

  let testLeaveType = null;

  try {
    // 1. Create a dummy tenant
    tenant = new Tenant({
      name: 'Test Corp Workflow Approvals',
      subdomain: `test-workflow-${Date.now()}`,
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

    delegateUser = new User({
      tenantId: tenant._id,
      email: `delegate-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'EMPLOYEE',
    });
    await delegateUser.save();

    leadershipUser = new User({
      tenantId: tenant._id,
      email: `leadership-${Date.now()}@test.com`,
      passwordHash: 'Password123!',
      role: 'LEADERSHIP',
    });
    await leadershipUser.save();

    console.log('✔ User accounts created');

    // 3. Create Employee documents mapping to User accounts
    hrAdminEmp = new Employee({
      tenantId: tenant._id,
      userId: hrAdminUser._id,
      employeeId: 'EMP-HR-01',
      personal: { firstName: 'HR', lastName: 'Admin' },
      employment: { status: 'ACTIVE' }
    });
    await hrAdminEmp.save();

    managerEmp = new Employee({
      tenantId: tenant._id,
      userId: managerUser._id,
      employeeId: 'EMP-MGR-01',
      personal: { firstName: 'Reporting', lastName: 'Manager' },
      employment: { status: 'ACTIVE' }
    });
    await managerEmp.save();

    employeeEmp = new Employee({
      tenantId: tenant._id,
      userId: employeeUser._id,
      employeeId: 'EMP-EMP-01',
      personal: { firstName: 'Staff', lastName: 'Employee' },
      employment: {
        status: 'ACTIVE',
        reportingManagerId: managerEmp._id // Link reporting manager!
      }
    });
    await employeeEmp.save();

    delegateEmp = new Employee({
      tenantId: tenant._id,
      userId: delegateUser._id,
      employeeId: 'EMP-DEL-01',
      personal: { firstName: 'Delegated', lastName: 'Colleague' },
      employment: { status: 'ACTIVE' }
    });
    await delegateEmp.save();

    leadershipEmp = new Employee({
      tenantId: tenant._id,
      userId: leadershipUser._id,
      employeeId: 'EMP-LDR-01',
      personal: { firstName: 'Leadership', lastName: 'Executive' },
      employment: { status: 'ACTIVE' }
    });
    await leadershipEmp.save();

    console.log('✔ Employee mappings registered');

    // 4. Register a dummy Leave Type and set leave balance
    testLeaveType = new LeaveType({
      tenantId: tenant._id,
      name: 'Casual Leave',
      code: 'CL',
      annualEntitlement: 10,
      allowHalfDay: true,
      allowNegativeBalance: false,
    });
    await testLeaveType.save();

    const leaveBalance = new LeaveBalance({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      leaveTypeId: testLeaveType._id,
      allocated: 10,
      used: 0,
      pendingApproval: 0,
      carriedForward: 0,
    });
    await leaveBalance.save();

    console.log('✔ Leave settings initialized');

    // ==========================================
    // TEST CASE 1: MULTI-LEVEL ROUTING SEQUENTIAL APPROVAL
    // ==========================================
    console.log('\n--- Test Case 1: Multi-level sequential approval routing ---');

    // Configure Policy: Level 1 -> Manager, Level 2 -> HR_ADMIN (Role)
    const policy = new ApprovalPolicy({
      tenantId: tenant._id,
      requestType: 'LEAVE',
      steps: [
        { level: 1, approverType: 'MANAGER' },
        { level: 2, approverType: 'ROLE', approverRole: 'HR_ADMIN' }
      ],
      slaHours: 24,
      escalationUserId: leadershipUser._id,
    });
    await policy.save();
    console.log('✔ Approval Policy registered with Level 1: MANAGER, Level 2: ROLE(HR_ADMIN)');

    // Create a Leave Request for 3 days
    const leaveRequest = new LeaveRequest({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      leaveTypeId: testLeaveType._id,
      startDate: '2026-06-10',
      endDate: '2026-06-12',
      totalDays: 3,
      lopDays: 0,
      reason: 'Sick leave test',
      status: 'PENDING',
    });
    await leaveRequest.save();

    // Lock balance pending
    leaveBalance.pendingApproval += 3;
    await leaveBalance.save();

    // Initiate workflow
    const instance = await workflowEngine.initiateWorkflow(
      tenant._id,
      'LEAVE',
      employeeUser._id,
      leaveRequest._id,
      { totalDays: 3 }
    );

    if (!instance) throw new Error('Workflow failed to initiate.');
    console.log('✔ Workflow initiated successfully. Active approver:', instance.activeApproverId.toString());

    // Assert level 1 active approver is Reporting Manager (managerUser)
    if (instance.activeApproverId.toString() !== managerUser._id.toString()) {
      throw new Error(`Expected Level 1 active approver to be manager (${managerUser._id}), got: ${instance.activeApproverId}`);
    }
    console.log('✔ Assert passed: Level 1 active approver is the reporting manager');

    // Process Level 1 Approval Action (Manager approves)
    const afterL1Instance = await workflowEngine.processAction(
      tenant._id,
      leaveRequest._id,
      managerUser._id,
      'APPROVE',
      'Manager approved level 1'
    );

    // Assert level 2 is now active approver (hrAdminUser)
    if (afterL1Instance.activeApproverId.toString() !== hrAdminUser._id.toString()) {
      throw new Error(`Expected Level 2 active approver to be hrAdmin (${hrAdminUser._id}), got: ${afterL1Instance.activeApproverId}`);
    }
    console.log('✔ Assert passed: Level 1 approved. Next active approver is the HR_ADMIN role user');

    // Process Level 2 Approval Action (HR Admin approves)
    const afterL2Instance = await workflowEngine.processAction(
      tenant._id,
      leaveRequest._id,
      hrAdminUser._id,
      'APPROVE',
      'HR Admin approved level 2'
    );

    // Assert that the workflow is fully APPROVED
    if (afterL2Instance.status !== 'APPROVED') {
      throw new Error(`Expected workflow status to be APPROVED, got: ${afterL2Instance.status}`);
    }
    console.log('✔ Assert passed: Workflow status is APPROVED');

    // Fetch updated leave request and balance
    const finalizedRequest = await LeaveRequest.findById(leaveRequest._id);
    if (finalizedRequest.status !== 'APPROVED') {
      throw new Error(`Expected LeaveRequest status to be APPROVED, got: ${finalizedRequest.status}`);
    }
    console.log('✔ Assert passed: LeaveRequest database status is APPROVED');

    const updatedBalance = await LeaveBalance.findOne({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      leaveTypeId: testLeaveType._id
    });
    if (updatedBalance.pendingApproval !== 0 || updatedBalance.used !== 3) {
      throw new Error(`Leave balance update failed. pendingApproval: ${updatedBalance.pendingApproval}, used: ${updatedBalance.used}`);
    }
    console.log('✔ Assert passed: LeaveBalance updated correctly (used: 3, pendingApproval: 0)');


    // ==========================================
    // TEST CASE 2: CONDITIONAL ROUTING ROUTE BY DURATION
    // ==========================================
    console.log('\n--- Test Case 2: Conditional routing thresholds ---');

    // Modify policy: Add conditional rule (if totalDays > 5, append Level 3 role: LEADERSHIP)
    policy.conditionalRules = [
      {
        field: 'totalDays',
        operator: 'GT',
        value: 5,
        extraStep: {
          approverType: 'ROLE',
          approverRole: 'LEADERSHIP'
        }
      }
    ];
    await policy.save();
    console.log('✔ Policy updated with condition: if totalDays > 5, append role LEADERSHIP');

    // 2.a Test request with 2 days (less than threshold 5)
    const shortRequest = new LeaveRequest({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      leaveTypeId: testLeaveType._id,
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      totalDays: 2,
      lopDays: 0,
      reason: 'Short leave',
      status: 'PENDING',
    });
    await shortRequest.save();

    const shortInstance = await workflowEngine.initiateWorkflow(
      tenant._id,
      'LEAVE',
      employeeUser._id,
      shortRequest._id,
      { totalDays: 2 }
    );

    console.log(`✔ Short request (2 days) compiled approver count: ${shortInstance.compiledApprovers.length}`);
    if (shortInstance.compiledApprovers.length !== 2) {
      throw new Error(`Expected 2 approval steps for short request, got: ${shortInstance.compiledApprovers.length}`);
    }
    console.log('✔ Assert passed: Short request compiles standard 2 levels of approvals');

    // 2.b Test request with 7 days (greater than threshold 5)
    const longRequest = new LeaveRequest({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      leaveTypeId: testLeaveType._id,
      startDate: '2026-07-10',
      endDate: '2026-07-17',
      totalDays: 7,
      lopDays: 0,
      reason: 'Long vacation',
      status: 'PENDING',
    });
    await longRequest.save();

    const longInstance = await workflowEngine.initiateWorkflow(
      tenant._id,
      'LEAVE',
      employeeUser._id,
      longRequest._id,
      { totalDays: 7 }
    );

    console.log(`✔ Long request (7 days) compiled approver count: ${longInstance.compiledApprovers.length}`);
    if (longInstance.compiledApprovers.length !== 3) {
      throw new Error(`Expected 3 approval steps (appended LEADERSHIP), got: ${longInstance.compiledApprovers.length}`);
    }
    
    // Assert Level 3 user is leadershipUser
    const step3 = longInstance.compiledApprovers.find(s => s.level === 3);
    if (!step3 || step3.userId.toString() !== leadershipUser._id.toString()) {
      throw new Error(`Expected Level 3 approver to be leadership user (${leadershipUser._id}), got: ${step3?.userId}`);
    }
    console.log('✔ Assert passed: Long request appends Level 3 LEADERSHIP user based on totalDays > 5 conditional rule');


    // ==========================================
    // TEST CASE 3: DELEGATION ROUTING REDIRECTIONS
    // ==========================================
    console.log('\n--- Test Case 3: Delegate routing redirections ---');

    // Register active delegation: manager delegates to delegateUser today
    const now = new Date();
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);   // tomorrow

    const delegationRule = new ApprovalDelegation({
      tenantId: tenant._id,
      delegatorId: managerUser._id,
      delegateeId: delegateUser._id,
      startDate,
      endDate,
      isActive: true,
    });
    await delegationRule.save();
    console.log(`✔ Active Delegation registered: Manager delegates to ${delegateUser.email}`);

    // Create a new Leave request (totalDays = 1)
    const delegateTestRequest = new LeaveRequest({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      leaveTypeId: testLeaveType._id,
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      totalDays: 1,
      lopDays: 0,
      reason: 'Delegation test',
      status: 'PENDING',
    });
    await delegateTestRequest.save();

    // Initiate workflow
    const delegateInstance = await workflowEngine.initiateWorkflow(
      tenant._id,
      'LEAVE',
      employeeUser._id,
      delegateTestRequest._id,
      { totalDays: 1 }
    );

    console.log('✔ Workflow initiated. Level 1 active approver:', delegateInstance.activeApproverId.toString());
    
    // Assert active approver is delegateUser instead of managerUser
    if (delegateInstance.activeApproverId.toString() !== delegateUser._id.toString()) {
      throw new Error(`Expected active approver to redirect to delegate (${delegateUser._id}), got: ${delegateInstance.activeApproverId}`);
    }
    console.log('✔ Assert passed: Active approver successfully redirected to the delegate User account');

    // Process approval by delegateUser
    const afterDelegateApproved = await workflowEngine.processAction(
      tenant._id,
      delegateTestRequest._id,
      delegateUser._id,
      'APPROVE',
      'Delegate approved this!'
    );

    // Verify history logs have delegation details
    const step1Record = afterDelegateApproved.compiledApprovers.find(s => s.level === 1);
    if (!step1Record || step1Record.delegatedFromUserId?.toString() !== managerUser._id.toString()) {
      throw new Error(`Delegation log check failed: ${JSON.stringify(step1Record)}`);
    }
    console.log('✔ Assert passed: Audit log records delegatedFromUserId field correctly in compiledApprovers history');


    // ==========================================
    // TEST CASE 4: SLA BREACH AUTOMATIC ESCALATION
    // ==========================================
    console.log('\n--- Test Case 4: SLA Timeout breach and automatic escalation ---');

    // Create a leave request
    const slaTestRequest = new LeaveRequest({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      leaveTypeId: testLeaveType._id,
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      totalDays: 1,
      lopDays: 0,
      reason: 'SLA test request',
      status: 'PENDING',
    });
    await slaTestRequest.save();

    // Deactivate delegation to make sure it routes to manager
    delegationRule.isActive = false;
    await delegationRule.save();

    const slaInstance = await workflowEngine.initiateWorkflow(
      tenant._id,
      'LEAVE',
      employeeUser._id,
      slaTestRequest._id,
      { totalDays: 1 }
    );

    console.log('✔ SLA test workflow initiated. Current active approver:', slaInstance.activeApproverId.toString());

    // Manually force SLA deadline into the past
    slaInstance.activeSlaDeadline = new Date(Date.now() - 5000); // 5 seconds ago
    await slaInstance.save();
    console.log('✔ Artificially updated SLA deadline to the past');

    // Run SLA daemon checker sweep
    const processedBreaches = await workflowEngine.checkSlaBreaches();
    console.log(`✔ SLA Sweep checker run complete. Breaches processed: ${processedBreaches}`);

    // Retrieve updated instance
    const updatedSlaInstance = await ApprovalInstance.findById(slaInstance._id);
    
    // Assert activeApproverId has changed to policy.escalationUserId (leadershipUser)
    if (updatedSlaInstance.activeApproverId.toString() !== leadershipUser._id.toString()) {
      throw new Error(`SLA Escalation failed. Expected active approver to escalate to leadership (${leadershipUser._id}), got: ${updatedSlaInstance.activeApproverId}`);
    }
    
    // Assert status is ESCALATED
    if (updatedSlaInstance.status !== 'ESCALATED') {
      throw new Error(`Expected instance status to be ESCALATED, got: ${updatedSlaInstance.status}`);
    }
    console.log('✔ Assert passed: SLA breach auto-escalated request successfully to the leadership User account');
    console.log('✔ Assert passed: Instance status is set to ESCALATED');


    console.log('\n✔✔✔ ALL SECTION 6.6 WORKFLOWS & APPROVALS TESTS COMPLETED SUCCESSFULLY! ✔✔✔');

  } catch (error) {
    console.error('\n❌ INTEGRATION TESTING FAILURE:', error);
    process.exitCode = 1;
  } finally {
    console.log('\nTearing down integration test records...');
    
    // Delete instances, policies, delegations, requests, types, balances, employees, users, tenant
    await ApprovalInstance.deleteMany({ tenantId: tenant?._id });
    await ApprovalPolicy.deleteMany({ tenantId: tenant?._id });
    await ApprovalDelegation.deleteMany({ tenantId: tenant?._id });
    await LeaveRequest.deleteMany({ tenantId: tenant?._id });
    await LeaveBalance.deleteMany({ tenantId: tenant?._id });
    if (testLeaveType) await LeaveType.deleteOne({ _id: testLeaveType._id });

    if (employeeEmp) await Employee.collection.deleteOne({ _id: employeeEmp._id });
    if (managerEmp) await Employee.collection.deleteOne({ _id: managerEmp._id });
    if (hrAdminEmp) await Employee.collection.deleteOne({ _id: hrAdminEmp._id });
    if (delegateEmp) await Employee.collection.deleteOne({ _id: delegateEmp._id });
    if (leadershipEmp) await Employee.collection.deleteOne({ _id: leadershipEmp._id });

    if (employeeUser) await User.deleteOne({ _id: employeeUser._id });
    if (managerUser) await User.deleteOne({ _id: managerUser._id });
    if (hrAdminUser) await User.deleteOne({ _id: hrAdminUser._id });
    if (delegateUser) await User.deleteOne({ _id: delegateUser._id });
    if (leadershipUser) await User.deleteOne({ _id: leadershipUser._id });

    if (tenant) await Tenant.deleteOne({ _id: tenant._id });

    await mongoose.connection.close();
    console.log('Database connection terminated. Done.');
  }
}

runTests();
