import mongoose from 'mongoose';
import connectDB from '../src/config/config.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';
import Employee from '../src/models/Employee.js';
import LeaveType from '../src/models/LeaveType.js';
import LeaveBalance from '../src/models/LeaveBalance.js';
import LeaveRequest from '../src/models/LeaveRequest.js';
import Notification from '../src/models/Notification.js';
import NotificationPreference from '../src/models/NotificationPreference.js';
import * as notificationService from '../src/utils/notificationService.js';
import * as workflowEngine from '../src/utils/workflowEngine.js';

async function runTests() {
  console.log('--- STARTING SECTION 6.7 NOTIFICATIONS INTEGRATION VERIFICATION ---');

  await connectDB();

  let tenant = null;
  let hrAdminUser = null;
  let managerUser = null;
  let employeeUser = null;

  let hrAdminEmp = null;
  let managerEmp = null;
  let employeeEmp = null;

  let testLeaveType = null;

  try {
    // 1. Create a dummy tenant
    tenant = new Tenant({
      name: 'Test Corp Notifications',
      subdomain: `test-notifications-${Date.now()}`,
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
        reportingManagerId: managerEmp._id
      }
    });
    await employeeEmp.save();

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
    // TEST CASE 1: TEMPLATE COMPILATION
    // ==========================================
    console.log('\n--- Test Case 1: Template compilation ---');

    const result = await notificationService.sendNotification(
      tenant._id,
      managerUser._id,
      'LEAVE_SUBMITTED',
      {
        requesterName: 'Staff Employee',
        dateRange: '2026-06-10 to 2026-06-12',
        days: '3'
      }
    );

    if (result.title !== 'New Leave Request') {
      throw new Error(`Expected title to be "New Leave Request", got: "${result.title}"`);
    }

    const expectedMsg = 'Staff Employee submitted a leave request for 2026-06-10 to 2026-06-12 (3 days).';
    if (result.message !== expectedMsg) {
      throw new Error(`Expected message to be: "${expectedMsg}", got: "${result.message}"`);
    }

    console.log('✔ Assert passed: Message template compiled and interpolated correctly');


    // ==========================================
    // TEST CASE 2: PREFERENCES RESPECTED
    // ==========================================
    console.log('\n--- Test Case 2: Preferences respected ---');

    // Set Manager preferences: In-app: true, Email: true, Push: true (Default)
    // Now set preferences to In-App: false
    let preferences = await NotificationPreference.findOne({ tenantId: tenant._id, userId: managerUser._id });
    if (!preferences) {
      preferences = new NotificationPreference({
        tenantId: tenant._id,
        userId: managerUser._id,
        email: true,
        inApp: false,
        push: true
      });
    } else {
      preferences.inApp = false;
    }
    await preferences.save();
    console.log('✔ Set manager preferences: In-app alerts turned OFF');

    // Clear previous notifications for manager
    await Notification.deleteMany({ userId: managerUser._id });

    // Send a leave submitted alert
    await notificationService.sendNotification(
      tenant._id,
      managerUser._id,
      'LEAVE_SUBMITTED',
      {
        requesterName: 'Staff Employee',
        dateRange: '2026-06-10 to 2026-06-12',
        days: '3'
      }
    );

    // Verify no Notification document was saved in database
    const notifsCount = await Notification.countDocuments({ userId: managerUser._id });
    if (notifsCount !== 0) {
      throw new Error(`Expected 0 in-app notifications due to preference settings, got: ${notifsCount}`);
    }
    console.log('✔ Assert passed: No in-app notification document created when preference is turned off');


    // ==========================================
    // TEST CASE 3: CRITICAL SECURITY OVERRIDES
    // ==========================================
    console.log('\n--- Test Case 3: Critical security overrides bypass preferences ---');

    // Set employee preferences: all false
    const empPref = new NotificationPreference({
      tenantId: tenant._id,
      userId: employeeUser._id,
      email: false,
      inApp: false,
      push: false
    });
    await empPref.save();
    console.log('✔ Set employee preferences: ALL channels turned OFF');

    // Trigger a critical security event
    await notificationService.sendNotification(
      tenant._id,
      employeeUser._id,
      'CRITICAL_SECURITY',
      {
        securityReason: 'MFA setup has been modified from IP 192.168.1.1'
      }
    );

    // Verify that an in-app Notification was STILL created!
    const criticalNotifs = await Notification.find({ userId: employeeUser._id });
    if (criticalNotifs.length !== 1) {
      throw new Error(`Expected 1 critical notification to bypass preferences, got: ${criticalNotifs.length}`);
    }

    if (!criticalNotifs[0].message.includes('MFA setup has been modified')) {
      throw new Error(`Critical message text mismatch: ${criticalNotifs[0].message}`);
    }
    console.log('✔ Assert passed: Critical security alert successfully bypassed disabled channels preferences');


    // ==========================================
    // TEST CASE 4: INTEGRATED WORKFLOW EVENT TRIGGER
    // ==========================================
    console.log('\n--- Test Case 4: Integrated workflow event trigger ---');

    // Restore manager preferences to default (inApp: true)
    preferences.inApp = true;
    await preferences.save();

    // Create a new Leave request
    const leaveRequest = new LeaveRequest({
      tenantId: tenant._id,
      employeeId: employeeEmp._id,
      leaveTypeId: testLeaveType._id,
      startDate: '2026-06-15',
      endDate: '2026-06-15',
      totalDays: 1,
      lopDays: 0,
      reason: 'Integrated test',
      status: 'PENDING',
    });
    await leaveRequest.save();

    // Clear manager notifications
    await Notification.deleteMany({ userId: managerUser._id });

    // Initiate workflow through Engine
    await workflowEngine.initiateWorkflow(
      tenant._id,
      'LEAVE',
      employeeUser._id,
      leaveRequest._id,
      { totalDays: 1 }
    );

    // Verify manager received the notification document in-app
    const workflowNotifs = await Notification.find({ userId: managerUser._id });
    if (workflowNotifs.length !== 1) {
      throw new Error(`Expected manager to receive 1 notification from workflow trigger, got: ${workflowNotifs.length}`);
    }

    if (workflowNotifs[0].type !== 'LEAVE_SUBMITTED') {
      throw new Error(`Expected notification type LEAVE_SUBMITTED, got: ${workflowNotifs[0].type}`);
    }
    console.log('✔ Assert passed: Workflow Engine successfully triggered leave request notification dispatch to manager');


    console.log('\n✔✔✔ ALL SECTION 6.7 NOTIFICATIONS TESTS COMPLETED SUCCESSFULLY! ✔✔✔');

  } catch (error) {
    console.error('\n❌ NOTIFICATIONS TESTING FAILURE:', error);
    process.exitCode = 1;
  } finally {
    console.log('\nTearing down notification test records...');
    
    await Notification.deleteMany({ tenantId: tenant?._id });
    await NotificationPreference.deleteMany({ tenantId: tenant?._id });
    await LeaveRequest.deleteMany({ tenantId: tenant?._id });
    await LeaveBalance.deleteMany({ tenantId: tenant?._id });
    if (testLeaveType) await LeaveType.deleteOne({ _id: testLeaveType._id });

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
