import LeaveType from '../models/LeaveType.js';
import LeaveBalance from '../models/LeaveBalance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Employee from '../models/Employee.js';
import AuditLog from '../models/AuditLog.js';

// Create a new Leave Type and auto-seed balances for active employees
export const createLeaveType = async (req, res, next) => {
  try {
    const { name, code, description, annualEntitlement, allowHalfDay, allowNegativeBalance, carryForwardLimit } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'name and code are required.' });
    }

    const leaveType = new LeaveType({
      tenantId: req.tenantId,
      name,
      code: code.toUpperCase(),
      description,
      annualEntitlement: annualEntitlement !== undefined ? annualEntitlement : 12,
      allowHalfDay: allowHalfDay !== undefined ? allowHalfDay : true,
      allowNegativeBalance: allowNegativeBalance !== undefined ? allowNegativeBalance : false,
      carryForwardLimit: carryForwardLimit !== undefined ? carryForwardLimit : 0,
    });
    await leaveType.save();

    // Auto-seed balance entries for all active employees of the tenant
    const activeEmployees = await Employee.find({
      tenantId: req.tenantId,
      'employment.status': 'ACTIVE',
    });

    if (activeEmployees.length > 0) {
      const balanceEntries = activeEmployees.map(emp => ({
        tenantId: req.tenantId,
        employeeId: emp._id,
        leaveTypeId: leaveType._id,
        allocated: leaveType.annualEntitlement,
        used: 0,
        pendingApproval: 0,
        carriedForward: 0,
      }));
      await LeaveBalance.insertMany(balanceEntries);
    }

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'LEAVE_TYPE_CREATE',
      entity: 'LEAVE_TYPE',
      entityId: leaveType._id,
      details: { name: leaveType.name, code: leaveType.code, annualEntitlement: leaveType.annualEntitlement },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(201).json({
      message: 'Leave type created and balances seeded successfully.',
      leaveType,
    });
  } catch (err) {
    next(err);
  }
};

// Retrieve all leave types for the tenant
export const getLeaveTypes = async (req, res, next) => {
  try {
    let leaveTypes = await LeaveType.find({ tenantId: req.tenantId });
    if (leaveTypes.length === 0) {
      const defaultTypes = [
        { tenantId: req.tenantId, name: 'Casual Leave', code: 'CL', annualEntitlement: 12, allowHalfDay: true, allowNegativeBalance: false },
        { tenantId: req.tenantId, name: 'Sick Leave', code: 'SL', annualEntitlement: 10, allowHalfDay: true, allowNegativeBalance: false },
        { tenantId: req.tenantId, name: 'Earned Leave', code: 'EL', annualEntitlement: 15, allowHalfDay: false, allowNegativeBalance: false },
        { tenantId: req.tenantId, name: 'Comp-off', code: 'COMP', annualEntitlement: 0, allowHalfDay: true, allowNegativeBalance: false },
        { tenantId: req.tenantId, name: 'Maternity Leave', code: 'ML', annualEntitlement: 84, allowHalfDay: false, allowNegativeBalance: false },
        { tenantId: req.tenantId, name: 'Paternity Leave', code: 'PL', annualEntitlement: 14, allowHalfDay: false, allowNegativeBalance: false },
        { tenantId: req.tenantId, name: 'Loss of Pay', code: 'LOP', annualEntitlement: 0, allowHalfDay: true, allowNegativeBalance: true }
      ];

      const createdTypes = await LeaveType.insertMany(defaultTypes);

      // Seed default balances for active employees
      const activeEmployees = await Employee.find({
        tenantId: req.tenantId,
        'employment.status': 'ACTIVE',
      });

      if (activeEmployees.length > 0) {
        const balanceEntries = [];
        activeEmployees.forEach(emp => {
          createdTypes.forEach(lt => {
            balanceEntries.push({
              tenantId: req.tenantId,
              employeeId: emp._id,
              leaveTypeId: lt._id,
              allocated: lt.annualEntitlement,
              used: 0,
              pendingApproval: 0,
              carriedForward: 0,
            });
          });
        });
        await LeaveBalance.insertMany(balanceEntries);
      }

      leaveTypes = await LeaveType.find({ tenantId: req.tenantId });
    }
    return res.status(200).json(leaveTypes);
  } catch (err) {
    next(err);
  }
};

// Update an existing leave type
export const updateLeaveType = async (req, res, next) => {
  try {
    const { name, code, description, annualEntitlement, allowHalfDay, allowNegativeBalance, carryForwardLimit, isActive } = req.body;
    const leaveType = await LeaveType.findOne({ tenantId: req.tenantId, _id: req.params.id });

    if (!leaveType) {
      return res.status(404).json({ error: 'Leave type not found.' });
    }

    if (name) leaveType.name = name;
    if (code) leaveType.code = code.toUpperCase();
    if (description !== undefined) leaveType.description = description;
    if (annualEntitlement !== undefined) leaveType.annualEntitlement = annualEntitlement;
    if (allowHalfDay !== undefined) leaveType.allowHalfDay = allowHalfDay;
    if (allowNegativeBalance !== undefined) leaveType.allowNegativeBalance = allowNegativeBalance;
    if (carryForwardLimit !== undefined) leaveType.carryForwardLimit = carryForwardLimit;
    if (isActive !== undefined) leaveType.isActive = isActive;

    await leaveType.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'LEAVE_TYPE_UPDATE',
      entity: 'LEAVE_TYPE',
      entityId: leaveType._id,
      details: { name: leaveType.name, code: leaveType.code },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({ message: 'Leave type updated successfully.', leaveType });
  } catch (err) {
    next(err);
  }
};

// Delete/deactivate a leave type (only if no pending leave requests depend on it)
export const deleteLeaveType = async (req, res, next) => {
  try {
    const leaveType = await LeaveType.findOne({ tenantId: req.tenantId, _id: req.params.id });
    if (!leaveType) {
      return res.status(404).json({ error: 'Leave type not found.' });
    }

    const pendingRequestsCount = await LeaveRequest.countDocuments({
      tenantId: req.tenantId,
      leaveTypeId: leaveType._id,
      status: 'PENDING',
    });

    if (pendingRequestsCount > 0) {
      return res.status(400).json({
        error: 'Cannot deactivate or delete leave type. There are pending leave applications linked to it.',
      });
    }

    leaveType.isActive = false;
    await leaveType.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'LEAVE_TYPE_DEACTIVATE',
      entity: 'LEAVE_TYPE',
      entityId: leaveType._id,
      details: { name: leaveType.name, code: leaveType.code },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({ message: 'Leave type deactivated successfully.' });
  } catch (err) {
    next(err);
  }
};

// Manual adjustment of leave balance for a specific employee
export const adjustLeaveBalance = async (req, res, next) => {
  try {
    const { employeeId, leaveTypeId, adjustmentType, amount, reason } = req.body;

    if (!employeeId || !leaveTypeId || !adjustmentType || amount === undefined || !reason) {
      return res.status(400).json({ error: 'employeeId, leaveTypeId, adjustmentType, amount, and reason are required.' });
    }

    if (!['CREDIT', 'DEBIT'].includes(adjustmentType)) {
      return res.status(400).json({ error: 'adjustmentType must be CREDIT or DEBIT.' });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number.' });
    }

    let balance = await LeaveBalance.findOne({
      tenantId: req.tenantId,
      employeeId,
      leaveTypeId,
    });

    if (!balance) {
      balance = new LeaveBalance({
        tenantId: req.tenantId,
        employeeId,
        leaveTypeId,
        allocated: 0,
        used: 0,
        pendingApproval: 0,
        carriedForward: 0,
      });
    }

    const delta = adjustmentType === 'CREDIT' ? amountNum : -amountNum;
    balance.allocated += delta;
    await balance.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'LEAVE_BALANCE_ADJUST',
      entity: 'EMPLOYEE',
      entityId: employeeId,
      details: { leaveTypeId, adjustmentType, amount: amountNum, reason },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({ message: 'Leave balance adjusted successfully.', balance });
  } catch (err) {
    next(err);
  }
};
