import * as reportService from '../utils/reportService.js';
import ScheduledReport from '../models/ScheduledReport.js';
import Employee from '../models/Employee.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import LeaveRequest from '../models/LeaveRequest.js';
import LeaveBalance from '../models/LeaveBalance.js';
import User from '../models/User.js';
import { formatCSV } from '../utils/csv.js';

/**
 * Retrieves aggregate KPI metrics for role-based dashboard cards.
 */
export const getDashboardMetrics = async (req, res, next) => {
  try {
    const scope = await reportService.resolveReportScope(req.tenantId, req.user);
    const todayStr = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const currentMonthStr = String(currentMonth).padStart(2, '0');

    // 1. Employee Dashboard Stats
    if (req.user.role === 'EMPLOYEE') {
      const emp = await Employee.findOne({ tenantId: req.tenantId, userId: req.user.id });
      if (!emp) {
        return res.status(404).json({ error: 'Employee profile not found.' });
      }

      // Current month attendance records
      const records = await AttendanceRecord.find({
        tenantId: req.tenantId,
        employeeId: emp._id,
        date: { $regex: `^${currentYear}-${currentMonthStr}` },
      });

      let present = 0;
      let late = 0;
      let absent = 0;
      let halfDay = 0;
      records.forEach((r) => {
        if (['PRESENT', 'REGULARIZED', 'SHORT_LEAVE'].includes(r.status)) present++;
        else if (r.status === 'LATE') { present++; late++; }
        else if (r.status === 'ABSENT') absent++;
        else if (r.status === 'HALF_DAY') halfDay++;
      });

      // Remaining leave balance
      const balances = await LeaveBalance.find({ tenantId: req.tenantId, employeeId: emp._id });
      const totalRemaining = balances.reduce((sum, b) => sum + Math.max(0, b.allocated - b.used), 0);

      return res.status(200).json({
        role: 'EMPLOYEE',
        metrics: {
          presentDays: present,
          lateDays: late,
          absentDays: absent,
          halfDays: halfDay,
          remainingLeaves: totalRemaining,
          shift: emp.employment?.assignedShift || 'Standard Shift',
        },
      });
    }

    // 2. Manager, HR Admin, or Leadership Dashboard Stats
    const empQuery = { tenantId: req.tenantId };
    if (!scope.isGlobal) {
      empQuery._id = { $in: scope.employeeIds };
    }

    const headcountCount = await Employee.countDocuments({
      ...empQuery,
      'employment.status': { $in: ['ACTIVE', 'PROBATION'] },
    });

    const employees = await Employee.find(empQuery);
    const employeeIds = employees.map((e) => e._id);

    // Current month attendance logs
    const records = await AttendanceRecord.find({
      tenantId: req.tenantId,
      employeeId: { $in: employeeIds },
      date: { $regex: `^${currentYear}-${currentMonthStr}` },
    });

    let totalWorkMinutes = 0;
    let workDaysCount = 0;
    let totalOvertimeMinutes = 0;
    records.forEach((r) => {
      if (r.totalWorkMinutes > 0) {
        totalWorkMinutes += r.totalWorkMinutes;
        workDaysCount++;
      }
      if (r.overtimeMinutes > 0) {
        totalOvertimeMinutes += r.overtimeMinutes;
      }
    });

    const avgWorkHours = workDaysCount > 0 ? (totalWorkMinutes / workDaysCount / 60).toFixed(2) : '0.00';
    const totalOvertimeHours = (totalOvertimeMinutes / 60).toFixed(2);

    // Leaves today
    const leavesCount = await LeaveRequest.countDocuments({
      tenantId: req.tenantId,
      employeeId: { $in: employeeIds },
      status: 'APPROVED',
      startDate: { $lte: todayStr },
      endDate: { $gte: todayStr },
    });

    // Attrition Rate calculation (exited in current year / total base)
    const exitedCount = await Employee.countDocuments({
      ...empQuery,
      'employment.status': 'EXITED',
      'employment.exitDate': { $gte: new Date(`${currentYear}-01-01`) },
    });
    const baseCount = headcountCount + exitedCount;
    const attritionRate = baseCount > 0 ? `${((exitedCount / baseCount) * 100).toFixed(1)}%` : '0.0%';

    return res.status(200).json({
      role: req.user.role,
      metrics: {
        headcount: headcountCount,
        avgWorkHours,
        totalOvertimeHours,
        activeLeavesToday: leavesCount,
        attritionRate,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Returns JSON array data for selected report type.
 */
export const getReportData = async (req, res, next) => {
  try {
    const { type, startDate, endDate, department, location } = req.query;
    if (!type) {
      return res.status(400).json({ error: 'Report type parameter is required.' });
    }

    const scope = await reportService.resolveReportScope(req.tenantId, req.user);
    const filters = { startDate, endDate, department, location };
    let data = [];

    switch (type) {
      case 'headcount':
        data = await reportService.fetchHeadcountReport(req.tenantId, scope, filters);
        break;
      case 'attendance':
        data = await reportService.fetchAttendanceReport(req.tenantId, scope, filters);
        break;
      case 'leaves':
        data = await reportService.fetchLeavesReport(req.tenantId, scope, filters);
        break;
      case 'late-absent':
        data = await reportService.fetchLateAbsentReport(req.tenantId, scope, filters);
        break;
      case 'overtime':
        data = await reportService.fetchOvertimeReport(req.tenantId, scope, filters);
        break;
      case 'attrition':
        data = await reportService.fetchAttritionReport(req.tenantId, scope, filters);
        break;
      default:
        return res.status(400).json({ error: `Unsupported report type: ${type}` });
    }

    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

/**
 * Generates and triggers download of CSV report file.
 */
export const exportReportCSV = async (req, res, next) => {
  try {
    const { type, startDate, endDate, department, location } = req.query;
    if (!type) {
      return res.status(400).json({ error: 'Report type parameter is required.' });
    }

    const scope = await reportService.resolveReportScope(req.tenantId, req.user);
    const filters = { startDate, endDate, department, location };
    let data = [];
    let headers = [];

    switch (type) {
      case 'headcount':
        data = await reportService.fetchHeadcountReport(req.tenantId, scope, filters);
        headers = ['employeeId', 'name', 'email', 'department', 'designation', 'location', 'status', 'joiningDate', 'exitDate'];
        break;
      case 'attendance':
        data = await reportService.fetchAttendanceReport(req.tenantId, scope, filters);
        headers = ['employeeId', 'name', 'department', 'location', 'presentDays', 'lateDays', 'absentDays', 'halfDays', 'workedHours'];
        break;
      case 'leaves':
        data = await reportService.fetchLeavesReport(req.tenantId, scope, filters);
        headers = ['employeeId', 'name', 'department', 'location', 'leaveType', 'allocated', 'used', 'pending', 'remaining'];
        break;
      case 'late-absent':
        data = await reportService.fetchLateAbsentReport(req.tenantId, scope, filters);
        headers = ['employeeId', 'name', 'department', 'location', 'date', 'status', 'timeIn'];
        break;
      case 'overtime':
        data = await reportService.fetchOvertimeReport(req.tenantId, scope, filters);
        headers = ['employeeId', 'name', 'department', 'location', 'overtimeHours'];
        break;
      case 'attrition':
        data = await reportService.fetchAttritionReport(req.tenantId, scope, filters);
        headers = ['department', 'joinedCount', 'leftCount', 'netChange', 'attritionRate'];
        break;
      default:
        return res.status(400).json({ error: 'Unsupported report type.' });
    }

    const csvContent = formatCSV(data, headers);
    res.header('Content-Type', 'text/csv');
    res.attachment(`${type}_report_${Date.now()}.csv`);
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};

/**
 * Configure email delivery schedule.
 */
export const scheduleReport = async (req, res, next) => {
  try {
    const { reportType, frequency, recipients, department, location } = req.body;
    if (!reportType || !frequency || !recipients || recipients.length === 0) {
      return res.status(400).json({ error: 'reportType, frequency, and recipients list are required.' });
    }

    const schedule = new ScheduledReport({
      tenantId: req.tenantId,
      userId: req.user.id,
      reportType,
      frequency,
      recipients,
      filters: { department, location },
    });

    await schedule.save();

    return res.status(201).json({ message: 'Report schedule registered successfully.', schedule });
  } catch (err) {
    next(err);
  }
};

/**
 * Get active scheduled reports configurations.
 */
export const getSchedules = async (req, res, next) => {
  try {
    const schedules = await ScheduledReport.find({
      tenantId: req.tenantId,
      userId: req.user.id,
      isActive: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json(schedules);
  } catch (err) {
    next(err);
  }
};

/**
 * Iterates through active report schedules and simulates email dispatch.
 */
export const triggerScheduledRuns = async (req, res, next) => {
  try {
    const schedules = await ScheduledReport.find({ isActive: true }).populate('userId', 'email');
    let triggerCount = 0;

    for (const sched of schedules) {
      // Simulate/Generate CSV report data
      const scope = { isGlobal: true, employeeIds: [] }; // Mock runner uses global scope
      const data = await reportService.fetchHeadcountReport(sched.tenantId, scope, sched.filters);
      const csvStr = formatCSV(data, ['employeeId', 'name', 'department', 'location', 'status']);

      // Log the mock email delivery check
      console.log(`[EMAIL MOCK] Dispatching SCHEDULED REPORT <${sched.reportType}> (${sched.frequency})
-------------------------------------------------------
To Recipients: ${sched.recipients.join(', ')}
Scheduled by: ${sched.userId?.email || 'N/A'}
Content Attachment: [CSV Report File - ${data.length} records]
Preview Content:
${csvStr.slice(0, 300)}...
-------------------------------------------------------`);

      sched.lastSentAt = new Date();
      await sched.save();
      triggerCount++;
    }

    return res.status(200).json({ message: `Scheduled report sweep complete. Dispatches processed: ${triggerCount}` });
  } catch (err) {
    next(err);
  }
};
