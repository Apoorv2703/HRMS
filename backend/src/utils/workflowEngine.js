import ApprovalPolicy from '../models/ApprovalPolicy.js';
import ApprovalInstance from '../models/ApprovalInstance.js';
import ApprovalDelegation from '../models/ApprovalDelegation.js';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import LeaveRequest from '../models/LeaveRequest.js';
import LeaveBalance from '../models/LeaveBalance.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import Shift from '../models/Shift.js';
import AuditLog from '../models/AuditLog.js';
import { sendNotification } from './notificationService.js';

// Helper to finalize the underlying business request once workflow engine acts
const finalizeRequest = async (tenantId, requestType, requestId, action, reviewerUserId, comment) => {
  if (requestType === 'LEAVE') {
    const request = await LeaveRequest.findById(requestId).populate('employeeId');
    if (!request) throw new Error('Leave request not found.');

    const manager = await Employee.findOne({ tenantId, userId: reviewerUserId });

    const balance = await LeaveBalance.findOne({
      tenantId,
      employeeId: request.employeeId._id,
      leaveTypeId: request.leaveTypeId,
    });

    if (balance) {
      // Clear the locked pending balance
      balance.pendingApproval = Math.max(0, balance.pendingApproval - request.totalDays);
      if (action === 'APPROVE') {
        balance.used += request.totalDays;
      }
      await balance.save();
    }

    request.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    request.reviewedBy = manager?._id || null;
    request.approverComment = comment || '';
    await request.save();
  } else if (requestType === 'REGULARIZATION') {
    const record = await AttendanceRecord.findById(requestId).populate('employeeId');
    if (!record) throw new Error('Attendance record not found.');

    if (action === 'APPROVE') {
      // Overwrite punches
      record.punches = [
        {
          time: record.regularization.requestedTimeIn,
          type: 'IN',
          ip: 'Regularized',
        },
        {
          time: record.regularization.requestedTimeOut,
          type: 'OUT',
          ip: 'Regularized',
        },
      ];

      // Recalculate work duration in minutes
      const diffMs = new Date(record.regularization.requestedTimeOut) - new Date(record.regularization.requestedTimeIn);
      const workedMins = Math.max(0, Math.floor(diffMs / 1000 / 60));
      record.totalWorkMinutes = workedMins;

      // Load shift rules
      let shift = null;
      const { default: EmployeeShiftSchedule } = await import('../models/EmployeeShiftSchedule.js');
      const rotationalOverride = await EmployeeShiftSchedule.findOne({
        tenantId,
        employeeId: record.employeeId._id,
        date: record.date,
      });

      if (rotationalOverride) {
        shift = await Shift.findById(rotationalOverride.shiftId);
      } else if (record.employeeId.employment?.shiftId) {
        shift = await Shift.findById(record.employeeId.employment.shiftId);
      }

      let shiftLengthMins = 8 * 60; // default 8 hours
      if (shift) {
        if (shift.type === 'FLEXIBLE') {
          shiftLengthMins = shift.minWorkMinutesPerDay !== undefined ? shift.minWorkMinutesPerDay : 8 * 60;
        } else {
          const [startH, startM] = shift.startTime.split(':').map(Number);
          const [endH, endM] = shift.endTime.split(':').map(Number);
          const startMin = startH * 60 + startM;
          const endMin = endH * 60 + endM;
          shiftLengthMins = endMin > startMin ? (endMin - startMin) : (24 * 60 - startMin + endMin);
        }
      }

      if (workedMins > shiftLengthMins) {
        record.overtimeMinutes = workedMins - shiftLengthMins;
      } else {
        record.overtimeMinutes = 0;
      }

      record.status = 'REGULARIZED';
      record.regularization.status = 'APPROVED';
    } else {
      record.regularization.status = 'REJECTED';
    }

    record.regularization.approverComment = comment || '';
    await record.save();
  }
};

// Initiate workflow instance for a created request
export const initiateWorkflow = async (tenantId, requestType, requesterUserId, requestId, details) => {
  const now = new Date();
  
  // Find employee profile of the requester
  const requesterEmp = await Employee.findOne({ tenantId, userId: requesterUserId });
  if (!requesterEmp) {
    throw new Error('Employee profile not found for the requester.');
  }

  // Load policy
  let policy = await ApprovalPolicy.findOne({ tenantId, requestType });
  
  // Compile steps
  let steps = [];
  if (policy && policy.steps && policy.steps.length > 0) {
    steps = [...policy.steps];
  } else {
    // Default fallback policy: Single-step approval by Direct Manager
    steps = [
      {
        level: 1,
        approverType: 'MANAGER',
      }
    ];
  }

  // Evaluate conditional rules
  if (policy && policy.conditionalRules && policy.conditionalRules.length > 0) {
    for (const rule of policy.conditionalRules) {
      const { field, operator, value, extraStep } = rule;
      const valToCheck = details[field];
      let triggered = false;
      if (valToCheck !== undefined) {
        if (operator === 'GT' && valToCheck > value) triggered = true;
        if (operator === 'LT' && valToCheck < value) triggered = true;
        if (operator === 'EQ' && valToCheck === value) triggered = true;
      }
      if (triggered && extraStep) {
        // Appending the extra step as the last level
        const maxLevel = steps.reduce((max, s) => Math.max(max, s.level), 0);
        steps.push({
          level: maxLevel + 1,
          approverType: extraStep.approverType,
          approverRole: extraStep.approverRole,
          approverRoleId: extraStep.approverRoleId,
          approverUserId: extraStep.approverUserId,
        });
      }
    }
  }

  // Compile individual user accounts for each level
  const compiledApprovers = [];
  for (const step of steps) {
    let resolvedUserId = null;

    if (step.approverType === 'MANAGER') {
      if (requesterEmp.employment?.reportingManagerId) {
        const manager = await Employee.findOne({ tenantId, _id: requesterEmp.employment.reportingManagerId });
        if (manager && manager.userId) {
          resolvedUserId = manager.userId;
        }
      }
    } else if (step.approverType === 'ROLE') {
      // Find the first user in the tenant with the matching role
      const matchedUser = await User.findOne({ tenantId, role: step.approverRole });
      if (matchedUser) {
        resolvedUserId = matchedUser._id;
      }
    } else if (step.approverType === 'SPECIFIC_USER') {
      resolvedUserId = step.approverUserId;
    }

    // Fallback if no approver resolved (e.g. no manager and no admin): route to first HR_ADMIN
    if (!resolvedUserId) {
      const fallbackAdmin = await User.findOne({ tenantId, role: 'HR_ADMIN' });
      if (fallbackAdmin) {
        resolvedUserId = fallbackAdmin._id;
      }
    }

    if (resolvedUserId) {
      // Check for active delegation for this resolved user
      const delegation = await ApprovalDelegation.findOne({
        tenantId,
        delegatorId: resolvedUserId,
        startDate: { $lte: now },
        endDate: { $gte: now },
        isActive: true,
      });

      if (delegation && delegation.delegateeId) {
        compiledApprovers.push({
          level: step.level,
          userId: delegation.delegateeId,
          status: 'PENDING',
          delegatedFromUserId: resolvedUserId,
        });
      } else {
        compiledApprovers.push({
          level: step.level,
          userId: resolvedUserId,
          status: 'PENDING',
        });
      }
    }
  }

  if (compiledApprovers.length === 0) {
    throw new Error('No valid approvers could be resolved for this request.');
  }

  // Create active SLA deadline date
  const slaHours = policy?.slaHours || 72;
  const slaDeadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000);

  const instance = new ApprovalInstance({
    tenantId,
    requestType,
    requestId,
    currentLevel: 1,
    status: 'PENDING',
    activeApproverId: compiledApprovers[0].userId,
    activeSlaDeadline: slaDeadline,
    compiledApprovers,
    history: [
      {
        actedBy: requesterUserId,
        action: 'SUBMIT',
        comment: 'Request submitted to workflow engine.',
      }
    ]
  });

  await instance.save();

  // Send notification to active approver
  try {
    let nameStr = 'An employee';
    let rangeStr = 'selected dates';
    let daysStr = '0';
    let dateStr = 'selected date';

    if (requestType === 'LEAVE') {
      const reqObj = await LeaveRequest.findById(requestId).populate('employeeId');
      if (reqObj) {
        nameStr = `${reqObj.employeeId?.personal?.firstName} ${reqObj.employeeId?.personal?.lastName}`;
        rangeStr = `${reqObj.startDate} to ${reqObj.endDate}`;
        daysStr = String(reqObj.totalDays);
      }
      await sendNotification(tenantId, compiledApprovers[0].userId, 'LEAVE_SUBMITTED', {
        requesterName: nameStr,
        dateRange: rangeStr,
        days: daysStr,
      });
    } else if (requestType === 'REGULARIZATION') {
      const recObj = await AttendanceRecord.findById(requestId).populate('employeeId');
      if (recObj) {
        nameStr = `${recObj.employeeId?.personal?.firstName} ${recObj.employeeId?.personal?.lastName}`;
        dateStr = recObj.date;
      }
      await sendNotification(tenantId, compiledApprovers[0].userId, 'REGULARIZATION_SUBMITTED', {
        requesterName: nameStr,
        date: dateStr,
      });
    }
  } catch (err) {
    console.error('Failed to dispatch notification on workflow initiation:', err);
  }

  return instance;
};

// Process an approval or rejection action
export const processAction = async (tenantId, requestId, actorUserId, action, comment) => {
  const now = new Date();
  
  // Find instance
  const instance = await ApprovalInstance.findOne({ tenantId, requestId });
  if (!instance) {
    throw new Error('Approval workflow instance not found for this request.');
  }

  if (instance.status !== 'PENDING' && instance.status !== 'ESCALATED') {
    throw new Error('This request has already been finalized.');
  }

  const activeApprover = instance.activeApproverId.toString();
  const actorStr = actorUserId.toString();

  // Check delegation: is actor the active approver or their delegate?
  let isValidApprover = activeApprover === actorStr;
  let delegatedFrom = null;

  if (!isValidApprover) {
    const delegation = await ApprovalDelegation.findOne({
      tenantId,
      delegatorId: activeApprover,
      delegateeId: actorUserId,
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true,
    });
    if (delegation) {
      isValidApprover = true;
      delegatedFrom = activeApprover;
    }
  }

  if (!isValidApprover) {
    throw new Error('Access denied. You are not the active approver or a delegate for this request.');
  }

  // Update active level step
  const currentLevelStep = instance.compiledApprovers.find(c => c.level === instance.currentLevel);
  if (currentLevelStep) {
    currentLevelStep.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    currentLevelStep.actedAt = now;
    currentLevelStep.comment = comment || '';
    if (delegatedFrom) {
      currentLevelStep.delegatedFromUserId = delegatedFrom;
    }
  }

  // Push history log
  instance.history.push({
    actedBy: actorUserId,
    action,
    comment: comment || '',
  });

  if (action === 'REJECT') {
    instance.status = 'REJECTED';
    await instance.save();
    
    // Trigger callback: reject original request
    await finalizeRequest(tenantId, instance.requestType, requestId, 'REJECT', actorUserId, comment);

    // Notify requester of rejection
    try {
      let requesterUserId = null;
      let rangeStr = 'selected dates';
      let dateStr = 'selected date';

      const actorEmp = await Employee.findOne({ tenantId, userId: actorUserId });
      const approverName = actorEmp ? `${actorEmp.personal?.firstName} ${actorEmp.personal?.lastName}` : 'your manager';

      if (instance.requestType === 'LEAVE') {
        const reqObj = await LeaveRequest.findById(requestId).populate('employeeId');
        if (reqObj) {
          requesterUserId = reqObj.employeeId.userId;
          rangeStr = `${reqObj.startDate} to ${reqObj.endDate}`;
        }
        if (requesterUserId) {
          await sendNotification(tenantId, requesterUserId, 'LEAVE_REJECTED', {
            dateRange: rangeStr,
            approverName,
          });
        }
      } else if (instance.requestType === 'REGULARIZATION') {
        const recObj = await AttendanceRecord.findById(requestId).populate('employeeId');
        if (recObj) {
          requesterUserId = recObj.employeeId.userId;
          dateStr = recObj.date;
        }
        if (requesterUserId) {
          await sendNotification(tenantId, requesterUserId, 'REGULARIZATION_REJECTED', {
            date: dateStr,
            approverName,
          });
        }
      }
    } catch (err) {
      console.error('Failed to notify requester on workflow rejection:', err);
    }

    return instance;
  }

  // It is APPROVED. Check if there is a next level
  if (instance.currentLevel < instance.compiledApprovers.length) {
    instance.currentLevel += 1;
    const nextStep = instance.compiledApprovers.find(c => c.level === instance.currentLevel);
    
    // Resolve delegator/delegatee for next level on-the-fly
    const delegationNext = await ApprovalDelegation.findOne({
      tenantId,
      delegatorId: nextStep.userId,
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true,
    });

    if (delegationNext && delegationNext.delegateeId) {
      nextStep.delegatedFromUserId = nextStep.userId;
      nextStep.userId = delegationNext.delegateeId;
    }

    instance.activeApproverId = nextStep.userId;
    
    // Reset SLA deadline
    const policy = await ApprovalPolicy.findOne({ tenantId, requestType: instance.requestType });
    const slaHours = policy?.slaHours || 72;
    instance.activeSlaDeadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000);
    instance.status = 'PENDING'; // Clear ESCALATED flag if advanced

    // Notify next approver
    try {
      let nameStr = 'An employee';
      let rangeStr = 'selected dates';
      let daysStr = '0';
      let dateStr = 'selected date';

      if (instance.requestType === 'LEAVE') {
        const reqObj = await LeaveRequest.findById(requestId).populate('employeeId');
        if (reqObj) {
          nameStr = `${reqObj.employeeId?.personal?.firstName} ${reqObj.employeeId?.personal?.lastName}`;
          rangeStr = `${reqObj.startDate} to ${reqObj.endDate}`;
          daysStr = String(reqObj.totalDays);
        }
        await sendNotification(tenantId, nextStep.userId, 'LEAVE_SUBMITTED', {
          requesterName: nameStr,
          dateRange: rangeStr,
          days: daysStr,
        });
      } else if (instance.requestType === 'REGULARIZATION') {
        const recObj = await AttendanceRecord.findById(requestId).populate('employeeId');
        if (recObj) {
          nameStr = `${recObj.employeeId?.personal?.firstName} ${recObj.employeeId?.personal?.lastName}`;
          dateStr = recObj.date;
        }
        await sendNotification(tenantId, nextStep.userId, 'REGULARIZATION_SUBMITTED', {
          requesterName: nameStr,
          date: dateStr,
        });
      }
    } catch (err) {
      console.error('Failed to notify next approver on workflow progression:', err);
    }
  } else {
    // All levels approved! Complete the request
    instance.status = 'APPROVED';
    await finalizeRequest(tenantId, instance.requestType, requestId, 'APPROVE', actorUserId, comment);

    // Notify requester of approval
    try {
      let requesterUserId = null;
      let rangeStr = 'selected dates';
      let dateStr = 'selected date';

      const actorEmp = await Employee.findOne({ tenantId, userId: actorUserId });
      const approverName = actorEmp ? `${actorEmp.personal?.firstName} ${actorEmp.personal?.lastName}` : 'your manager';

      if (instance.requestType === 'LEAVE') {
        const reqObj = await LeaveRequest.findById(requestId).populate('employeeId');
        if (reqObj) {
          requesterUserId = reqObj.employeeId.userId;
          rangeStr = `${reqObj.startDate} to ${reqObj.endDate}`;
        }
        if (requesterUserId) {
          await sendNotification(tenantId, requesterUserId, 'LEAVE_APPROVED', {
            dateRange: rangeStr,
            approverName,
          });
        }
      } else if (instance.requestType === 'REGULARIZATION') {
        const recObj = await AttendanceRecord.findById(requestId).populate('employeeId');
        if (recObj) {
          requesterUserId = recObj.employeeId.userId;
          dateStr = recObj.date;
        }
        if (requesterUserId) {
          await sendNotification(tenantId, requesterUserId, 'REGULARIZATION_APPROVED', {
            date: dateStr,
            approverName,
          });
        }
      }
    } catch (err) {
      console.error('Failed to notify requester on workflow approval completion:', err);
    }
  }

  await instance.save();
  return instance;
};

// Check active SLA timeouts and escalate breached levels
export const checkSlaBreaches = async () => {
  const now = new Date();
  
  // Find all active instances that breached the SLA deadline
  const breachedInstances = await ApprovalInstance.find({
    status: { $in: ['PENDING', 'ESCALATED'] },
    activeSlaDeadline: { $lte: now },
  });

  const processedCount = breachedInstances.length;

  for (const instance of breachedInstances) {
    try {
      // Escalation:
      // We look up the policy to find escalationUserId
      const policy = await ApprovalPolicy.findOne({ tenantId: instance.tenantId, requestType: instance.requestType });
      
      let targetEscalationUserId = policy?.escalationUserId;
      if (!targetEscalationUserId) {
        // Fallback: Escalate to the first available HR_ADMIN
        const hrAdmin = await User.findOne({ tenantId: instance.tenantId, role: 'HR_ADMIN' });
        if (hrAdmin) {
          targetEscalationUserId = hrAdmin._id;
        }
      }

      if (targetEscalationUserId && targetEscalationUserId.toString() !== instance.activeApproverId.toString()) {
        // Log action in history
        instance.history.push({
          actedBy: null,
          action: 'ESCALATE',
          comment: `SLA breached. Escalated automatically from ${instance.activeApproverId} to ${targetEscalationUserId}.`,
        });

        await instance.save();

        // Notify new active approver of SLA breach escalation
        try {
          let nameStr = 'An employee';
          if (instance.requestType === 'LEAVE') {
            const reqObj = await LeaveRequest.findById(instance.requestId).populate('employeeId');
            if (reqObj) nameStr = `${reqObj.employeeId?.personal?.firstName} ${reqObj.employeeId?.personal?.lastName}`;
          } else if (instance.requestType === 'REGULARIZATION') {
            const recObj = await AttendanceRecord.findById(instance.requestId).populate('employeeId');
            if (recObj) nameStr = `${recObj.employeeId?.personal?.firstName} ${recObj.employeeId?.personal?.lastName}`;
          }
          await sendNotification(instance.tenantId, targetEscalationUserId, 'SLA_BREACH', {
            requesterName: nameStr,
          });
        } catch (err) {
          console.error('Failed to send notification on SLA breach escalation:', err);
        }
      }
    } catch (err) {
      console.error(`Failed to process SLA breach for instance ${instance._id}:`, err);
    }
  }

  return processedCount;
};
