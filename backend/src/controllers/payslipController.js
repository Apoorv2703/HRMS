import Payslip from '../models/Payslip.js';
import Employee from '../models/Employee.js';
import LeaveRequest from '../models/LeaveRequest.js';
import AuditLog from '../models/AuditLog.js';

// Helper to get number of days in a month
const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

// Generate a payslip for an employee (HR Admin only)
export const generatePayslip = async (req, res, next) => {
  try {
    const { employeeId, month, year, basicSalary, allowances, deductions } = req.body;

    if (!employeeId || !month || !year || basicSalary === undefined) {
      return res.status(400).json({ error: 'employeeId, month, year, and basicSalary are required.' });
    }

    const mNum = parseInt(month);
    const yNum = parseInt(year);
    if (isNaN(mNum) || mNum < 1 || mNum > 12 || isNaN(yNum)) {
      return res.status(400).json({ error: 'Valid month (1-12) and year are required.' });
    }

    // Verify employee exists in this tenant
    const employee = await Employee.findOne({ tenantId: req.tenantId, _id: employeeId });
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found in this workspace.' });
    }

    // 1. Calculate LOP Days for the employee in the target month/year
    const monthStr = mNum.toString().padStart(2, '0');
    const numDays = getDaysInMonth(yNum, mNum);
    const startMonthStr = `${yNum}-${monthStr}-01`;
    const endMonthStr = `${yNum}-${monthStr}-${numDays.toString().padStart(2, '0')}`;

    const approvedLeaves = await LeaveRequest.find({
      tenantId: req.tenantId,
      employeeId,
      status: 'APPROVED',
      startDate: { $lte: endMonthStr },
      endDate: { $gte: startMonthStr },
    });

    let lopDays = 0;
    approvedLeaves.forEach((l) => {
      const current = new Date(l.startDate);
      const end = new Date(l.endDate);
      const dates = [];
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      const monthPrefix = `${yNum}-${monthStr}-`;
      const daysInMonth = dates.filter((d) => d.startsWith(monthPrefix));

      if (dates.length > 0 && daysInMonth.length > 0) {
        const ratio = daysInMonth.length / dates.length;
        lopDays += (l.lopDays || 0) * ratio;
      }
    });

    // Round LOP days to 2 decimal places
    lopDays = Math.round(lopDays * 100) / 100;

    // 2. Perform Salary Calculations
    const dailyRate = basicSalary / numDays;
    const lopDeduction = lopDays * dailyRate;
    const totalDeductions = (Number(deductions) || 0) + lopDeduction;

    const netSalary = Math.max(0, basicSalary + (Number(allowances) || 0) - totalDeductions);

    // Save payslip (Upsert: overwrite if already exists for the month/year)
    let payslip = await Payslip.findOne({
      tenantId: req.tenantId,
      employeeId,
      month: mNum,
      year: yNum,
    });

    if (payslip) {
      payslip.basicSalary = basicSalary;
      payslip.allowances = Number(allowances) || 0;
      payslip.deductions = totalDeductions;
      payslip.lopDays = lopDays;
      payslip.netSalary = Math.round(netSalary * 100) / 100;
      await payslip.save();
    } else {
      payslip = new Payslip({
        tenantId: req.tenantId,
        employeeId,
        month: mNum,
        year: yNum,
        basicSalary,
        allowances: Number(allowances) || 0,
        deductions: Math.round(totalDeductions * 100) / 100,
        lopDays,
        netSalary: Math.round(netSalary * 100) / 100,
      });
      await payslip.save();
    }

    await AuditLog.create({
      tenantId: req.tenantId,
      userId: req.user.id,
      action: 'PAYSLIP_GENERATE',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'Server',
      details: { employeeId: employee.employeeId, year: yNum, month: mNum, netSalary: payslip.netSalary },
    });

    return res.status(201).json({
      message: 'Payslip generated successfully.',
      payslip,
    });
  } catch (err) {
    next(err);
  }
};

// Retrieve own payslips (ESS)
export const getMyPayslips = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ tenantId: req.tenantId, userId: req.user.id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found.' });
    }

    const payslips = await Payslip.find({
      tenantId: req.tenantId,
      employeeId: employee._id,
      status: 'PUBLISHED',
    }).sort({ year: -1, month: -1 });

    return res.status(200).json(payslips);
  } catch (err) {
    next(err);
  }
};

// Retrieve details for a specific payslip
export const getPayslipDetails = async (req, res, next) => {
  try {
    const payslip = await Payslip.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    }).populate('employeeId', 'userId personal.firstName personal.lastName employeeId employment.department employment.designation employment.reportingManagerId');

    if (!payslip) {
      return res.status(404).json({ error: 'Payslip not found.' });
    }

    // Access check: must be owner, manager of owner, or HR Admin
    const isOwner = payslip.employeeId.userId?.toString() === req.user.id?.toString();
    const isAdmin = req.user.role === 'HR_ADMIN';

    // If manager, verify reporting hierarchy
    let isManager = false;
    if (req.user.role === 'MANAGER') {
      const manager = await Employee.findOne({ tenantId: req.tenantId, userId: req.user.id });
      if (manager && payslip.employeeId.employment?.reportingManagerId?.toString() === manager._id.toString()) {
        isManager = true;
      }
    }

    if (!isOwner && !isAdmin && !isManager) {
      return res.status(403).json({ error: 'Access denied. You are not authorized to view this payslip.' });
    }

    return res.status(200).json(payslip);
  } catch (err) {
    next(err);
  }
};

// Retrieve payslips for a specific employee (Manager / Admin / Leadership only)
export const getPayslipsByEmployee = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    const isAdmin = req.user.role === 'HR_ADMIN';
    const isLeadership = req.user.role === 'LEADERSHIP';

    let isManager = false;
    if (req.user.role === 'MANAGER') {
      const manager = await Employee.findOne({ tenantId: req.tenantId, userId: req.user.id });
      const targetEmp = await Employee.findOne({ tenantId: req.tenantId, _id: employeeId });
      if (manager && targetEmp && targetEmp.employment?.reportingManagerId?.toString() === manager._id.toString()) {
        isManager = true;
      }
    }

    if (!isAdmin && !isLeadership && !isManager) {
      return res.status(403).json({ error: "Access denied. You are not authorized to view this employee's payslips." });
    }

    const payslips = await Payslip.find({
      tenantId: req.tenantId,
      employeeId,
    }).sort({ year: -1, month: -1 });

    return res.status(200).json(payslips);
  } catch (err) {
    next(err);
  }
};
