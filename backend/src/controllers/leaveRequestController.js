import LeaveType from '../models/LeaveType.js';
import LeaveBalance from '../models/LeaveBalance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Employee from '../models/Employee.js';
import AuditLog from '../models/AuditLog.js';
import Shift from '../models/Shift.js';
import Holiday from '../models/Holiday.js';
import EmployeeShiftSchedule from '../models/EmployeeShiftSchedule.js';
import ApprovalInstance from '../models/ApprovalInstance.js';
import ApprovalDelegation from '../models/ApprovalDelegation.js';
import * as workflowEngine from '../utils/workflowEngine.js';

// Helper to generate dates in range YYYY-MM-DD
const getDatesInRange = (startDate, endDate) => {
  const dates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

// Apply for a new leave request
export const applyLeave = async (req, res, next) => {
  try {
    const { leaveTypeId, startDate, endDate, halfDay, halfDaySession, reason } = req.body;

    if (!leaveTypeId || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'leaveTypeId, startDate, endDate, and reason are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return res.status(400).json({ error: 'Invalid start or end date.' });
    }

    if (halfDay && startDate !== endDate) {
      return res.status(400).json({ error: 'Half-day leaves are only permitted for single-day applications.' });
    }

    const employee = await Employee.findOne({ tenantId: req.tenantId, userId: req.user.id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found.' });
    }

    const leaveType = await LeaveType.findOne({ tenantId: req.tenantId, _id: leaveTypeId, isActive: true });
    if (!leaveType) {
      return res.status(404).json({ error: 'Active leave type not found.' });
    }

    // 1. Overlapping checks (including both pending and approved states)
    const overlappingRequest = await LeaveRequest.findOne({
      tenantId: req.tenantId,
      employeeId: employee._id,
      status: { $in: ['PENDING', 'APPROVED'] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });

    if (overlappingRequest) {
      return res.status(400).json({
        error: `Leave request overlaps with an existing ${overlappingRequest.status.toLowerCase()} leave request (${overlappingRequest.startDate} to ${overlappingRequest.endDate}).`,
      });
    }

    // 2. Fetch shift schedules and holidays in bulk for off exclusions
    const shiftScheduleOverrides = await EmployeeShiftSchedule.find({
      tenantId: req.tenantId,
      employeeId: employee._id,
      date: { $gte: startDate, $lte: endDate },
    });
    const overrideMap = new Map(shiftScheduleOverrides.map(s => [s.date, s.shiftId.toString()]));

    // Normalize date strings for query
    const queryStart = new Date(startDate);
    queryStart.setHours(0, 0, 0, 0);
    const queryEnd = new Date(endDate);
    queryEnd.setHours(23, 59, 59, 999);
    const holidays = await Holiday.find({
      tenantId: req.tenantId,
      date: { $gte: queryStart, $lte: queryEnd },
    });

    const tenantShifts = await Shift.find({ tenantId: req.tenantId });
    const shiftMap = new Map(tenantShifts.map(s => [s._id.toString(), s]));

    // Calculate working days in date range
    let workingDaysCount = 0;
    let current = new Date(startDate);

    while (current <= end) {
      const dStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay(); // 0 is Sunday, 6 is Saturday

      // Check if it is a holiday for this employee's location
      const isHoliday = holidays.some(h => {
        const hStr = h.date.toISOString().split('T')[0];
        if (hStr !== dStr) return false;
        const hLoc = h.location?.trim().toLowerCase() || 'all';
        const empLoc = employee.employment?.location?.trim().toLowerCase() || '';
        return hLoc === 'all' || hLoc === empLoc;
      });

      if (!isHoliday) {
        // Resolve active shift for this employee on this date
        let shiftId = employee.employment?.shiftId?.toString();
        if (overrideMap.has(dStr)) {
          shiftId = overrideMap.get(dStr);
        }

        const shift = shiftId ? shiftMap.get(shiftId) : null;
        const weeklyOffs = shift?.weeklyOffs !== undefined ? shift.weeklyOffs : [0, 6];

        if (!weeklyOffs.includes(dayOfWeek)) {
          workingDaysCount++;
        }
      }

      current.setDate(current.getDate() + 1);
    }

    if (workingDaysCount === 0) {
      return res.status(400).json({
        error: 'No working days found in the requested date range (all selected days are weekly offs or holidays).',
      });
    }

    const totalDays = halfDay ? 0.5 : workingDaysCount;

    // 3. Balance verification
    let balance = await LeaveBalance.findOne({
      tenantId: req.tenantId,
      employeeId: employee._id,
      leaveTypeId: leaveType._id,
    });

    if (!balance) {
      balance = new LeaveBalance({
        tenantId: req.tenantId,
        employeeId: employee._id,
        leaveTypeId: leaveType._id,
        allocated: 0,
        used: 0,
        pendingApproval: 0,
        carriedForward: 0,
      });
    }

    const availableDays = balance.allocated + balance.carriedForward - balance.used - balance.pendingApproval;

    if (availableDays < totalDays && !leaveType.allowNegativeBalance) {
      return res.status(400).json({
        error: `Insufficient leave balance. Available: ${availableDays} days, Requested: ${totalDays} days.`,
      });
    }

    // Determine LOP (Loss of Pay) days
    let lopDays = 0;
    if (leaveType.code === 'LWP') {
      lopDays = totalDays;
    } else if (availableDays < totalDays) {
      // Deficit days are treated as Loss of Pay (if allowNegativeBalance is true)
      lopDays = totalDays - Math.max(0, availableDays);
    }

    // Lock requested days
    balance.pendingApproval += totalDays;
    await balance.save();

    // Create leave request
    const leaveRequest = new LeaveRequest({
      tenantId: req.tenantId,
      employeeId: employee._id,
      leaveTypeId: leaveType._id,
      startDate,
      endDate,
      halfDay,
      halfDaySession: halfDay ? halfDaySession : null,
      totalDays,
      lopDays,
      reason,
      status: 'PENDING',
    });
    await leaveRequest.save();

    // Initiate workflow engine approval chain
    await workflowEngine.initiateWorkflow(
      req.tenantId,
      'LEAVE',
      req.user.id,
      leaveRequest._id,
      { totalDays: leaveRequest.totalDays }
    );

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'LEAVE_APPLY',
      entity: 'LEAVE_REQUEST',
      entityId: leaveRequest._id,
      details: { startDate, endDate, totalDays, lopDays, code: leaveType.code },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(201).json({
      message: 'Leave application submitted successfully.',
      leaveRequest,
    });
  } catch (err) {
    next(err);
  }
};

// Cancel a pending or approved leave request
export const cancelLeaveRequest = async (req, res, next) => {
  try {
    const request = await LeaveRequest.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    }).populate('employeeId');

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    // Access check: only request owner or HR admin can cancel
    const isAdmin = req.user.role === 'HR_ADMIN';
    const isOwner = request.employeeId.userId?.toString() === req.user.id.toString();

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Access denied. You can only cancel your own requests.' });
    }

    if (['REJECTED', 'CANCELLED'].includes(request.status)) {
      return res.status(400).json({ error: `Cannot cancel a request that is already ${request.status.toLowerCase()}.` });
    }

    const balance = await LeaveBalance.findOne({
      tenantId: req.tenantId,
      employeeId: request.employeeId._id,
      leaveTypeId: request.leaveTypeId,
    });

    if (balance) {
      if (request.status === 'PENDING') {
        balance.pendingApproval = Math.max(0, balance.pendingApproval - request.totalDays);
      } else if (request.status === 'APPROVED') {
        balance.used = Math.max(0, balance.used - request.totalDays);
      }
      await balance.save();
    }

    request.status = 'CANCELLED';
    await request.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'LEAVE_CANCEL',
      entity: 'LEAVE_REQUEST',
      entityId: request._id,
      details: { originalStatus: request.status, totalDays: request.totalDays },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({
      message: 'Leave request cancelled successfully.',
      request,
    });
  } catch (err) {
    next(err);
  }
};

// Manager Review Workflow (APPROVE / REJECT)
export const reviewLeaveRequest = async (req, res, next) => {
  try {
    const { action, comment } = req.body;

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'action must be APPROVE or REJECT.' });
    }

    const request = await LeaveRequest.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    }).populate('employeeId');

    if (!request) {
      return res.status(404).json({ error: 'Leave request not found.' });
    }

    // Delegate to workflow engine
    const instance = await workflowEngine.processAction(
      req.tenantId,
      request._id,
      req.user.id,
      action,
      comment
    );

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: `LEAVE_REVIEW_${action}`,
      entity: 'LEAVE_REQUEST',
      entityId: request._id,
      details: { action, comment },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    const updatedRequest = await LeaveRequest.findById(request._id).populate('employeeId');

    return res.status(200).json({
      message: `Leave request successfully ${action.toLowerCase()}d.`,
      request: updatedRequest,
      instance,
    });
  } catch (err) {
    next(err);
  }
};

// Retrieve own leave requests history
export const getMyLeaveRequests = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ tenantId: req.tenantId, userId: req.user.id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found.' });
    }

    const requests = await LeaveRequest.find({
      tenantId: req.tenantId,
      employeeId: employee._id,
    }).populate('leaveTypeId', 'name code').sort({ createdAt: -1 });

    return res.status(200).json(requests);
  } catch (err) {
    next(err);
  }
};

// Retrieve pending requests queue for the logged-in manager
export const getPendingLeaveRequests = async (req, res, next) => {
  try {
    const now = new Date();
    // Resolve active delegations for the current user
    const activeDelegationsForMe = await ApprovalDelegation.find({
      tenantId: req.tenantId,
      delegateeId: req.user.id,
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true,
    });
    const delegators = activeDelegationsForMe.map(d => d.delegatorId);

    const instances = await ApprovalInstance.find({
      tenantId: req.tenantId,
      status: { $in: ['PENDING', 'ESCALATED'] },
      requestType: 'LEAVE',
      $or: [
        { activeApproverId: req.user.id },
        { activeApproverId: { $in: delegators } }
      ]
    });

    const requestIds = instances.map(inst => inst.requestId);

    const requests = await LeaveRequest.find({
      tenantId: req.tenantId,
      _id: { $in: requestIds },
    }).populate('employeeId', 'personal.firstName personal.lastName employeeId')
      .populate('leaveTypeId', 'name code')
      .sort({ createdAt: -1 });

    return res.status(200).json(requests);
  } catch (err) {
    next(err);
  }
};

// Helper to ensure an employee has leave balance records for all active leave types
const ensureLeaveBalances = async (tenantId, employeeId) => {
  let allLeaveTypes = await LeaveType.find({ tenantId });
  if (allLeaveTypes.length === 0) {
    const defaultTypes = [
      { tenantId, name: 'Casual Leave', code: 'CL', annualEntitlement: 12, allowHalfDay: true, allowNegativeBalance: false },
      { tenantId, name: 'Sick Leave', code: 'SL', annualEntitlement: 10, allowHalfDay: true, allowNegativeBalance: false },
      { tenantId, name: 'Earned Leave', code: 'EL', annualEntitlement: 15, allowHalfDay: false, allowNegativeBalance: false },
      { tenantId, name: 'Comp-off', code: 'COMP', annualEntitlement: 0, allowHalfDay: true, allowNegativeBalance: false },
      { tenantId, name: 'Maternity Leave', code: 'ML', annualEntitlement: 84, allowHalfDay: false, allowNegativeBalance: false },
      { tenantId, name: 'Paternity Leave', code: 'PL', annualEntitlement: 14, allowHalfDay: false, allowNegativeBalance: false },
      { tenantId, name: 'Loss of Pay', code: 'LOP', annualEntitlement: 0, allowHalfDay: true, allowNegativeBalance: true }
    ];
    allLeaveTypes = await LeaveType.insertMany(defaultTypes);
  }

  const existingBalances = await LeaveBalance.find({ tenantId, employeeId });
  const existingTypeIds = new Set(existingBalances.map(b => b.leaveTypeId.toString()));
  const missingTypes = allLeaveTypes.filter(lt => !existingTypeIds.has(lt._id.toString()));

  if (missingTypes.length > 0) {
    const newBalances = missingTypes.map(lt => ({
      tenantId,
      employeeId,
      leaveTypeId: lt._id,
      allocated: lt.annualEntitlement,
      used: 0,
      pendingApproval: 0,
      carriedForward: 0,
    }));
    await LeaveBalance.insertMany(newBalances);
  }
};

// Retrieve leave balances for a specific employee
export const getEmployeeLeaveBalances = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    
    await ensureLeaveBalances(req.tenantId, employeeId);

    const balances = await LeaveBalance.find({
      tenantId: req.tenantId,
      employeeId,
    }).populate('leaveTypeId', 'name code annualEntitlement allowHalfDay allowNegativeBalance');

    return res.status(200).json(balances);
  } catch (err) {
    next(err);
  }
};

// Retrieve own leave balances
export const getMyLeaveBalances = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ tenantId: req.tenantId, userId: req.user.id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found.' });
    }

    await ensureLeaveBalances(req.tenantId, employee._id);

    const balances = await LeaveBalance.find({
      tenantId: req.tenantId,
      employeeId: employee._id,
    }).populate('leaveTypeId', 'name code annualEntitlement allowHalfDay allowNegativeBalance');

    return res.status(200).json(balances);
  } catch (err) {
    next(err);
  }
};
