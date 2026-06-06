import LeaveType from '../models/LeaveType.js';
import LeaveBalance from '../models/LeaveBalance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Employee from '../models/Employee.js';
import AuditLog from '../models/AuditLog.js';
import Shift from '../models/Shift.js';
import Holiday from '../models/Holiday.js';
import EmployeeShiftSchedule from '../models/EmployeeShiftSchedule.js';

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

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'This request has already been reviewed.' });
    }

    // Access check: must be reporting manager or HR Admin
    const manager = await Employee.findOne({ tenantId: req.tenantId, userId: req.user.id });
    const isManager = manager && request.employeeId.employment?.reportingManagerId?.toString() === manager._id.toString();
    const isAdmin = req.user.role === 'HR_ADMIN';

    if (!isManager && !isAdmin) {
      return res.status(403).json({ error: 'Access denied. Only the reporting manager or an HR Admin can review this request.' });
    }

    const balance = await LeaveBalance.findOne({
      tenantId: req.tenantId,
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

    return res.status(200).json({
      message: `Leave request successfully ${action.toLowerCase()}d.`,
      request,
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
    const manager = await Employee.findOne({ tenantId: req.tenantId, userId: req.user.id });
    if (!manager) {
      return res.status(200).json([]);
    }

    const team = await Employee.find({
      tenantId: req.tenantId,
      'employment.reportingManagerId': manager._id,
    });

    if (team.length === 0) {
      return res.status(200).json([]);
    }

    const requests = await LeaveRequest.find({
      tenantId: req.tenantId,
      employeeId: { $in: team.map(emp => emp._id) },
      status: 'PENDING',
    }).populate('employeeId', 'personal.firstName personal.lastName employeeId')
      .populate('leaveTypeId', 'name code')
      .sort({ createdAt: -1 });

    return res.status(200).json(requests);
  } catch (err) {
    next(err);
  }
};

// Retrieve leave balances for a specific employee
export const getEmployeeLeaveBalances = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
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

    const balances = await LeaveBalance.find({
      tenantId: req.tenantId,
      employeeId: employee._id,
    }).populate('leaveTypeId', 'name code annualEntitlement allowHalfDay allowNegativeBalance');

    return res.status(200).json(balances);
  } catch (err) {
    next(err);
  }
};
