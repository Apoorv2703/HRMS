import Employee from '../models/Employee.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import LeaveRequest from '../models/LeaveRequest.js';
import LeaveBalance from '../models/LeaveBalance.js';

/**
 * Resolves the reporting scope based on user role.
 * - HR_ADMIN / LEADERSHIP: Global scope (all employees).
 * - MANAGER: Scoped to manager + their direct/indirect reporting employees.
 * - EMPLOYEE: Scoped strictly to themselves.
 */
export const resolveReportScope = async (tenantId, user) => {
  if (['HR_ADMIN', 'LEADERSHIP'].includes(user.role)) {
    return { isGlobal: true, employeeIds: [] };
  }

  const employee = await Employee.findOne({ tenantId, userId: user.id });
  if (!employee) {
    return { isGlobal: false, employeeIds: [] };
  }

  if (user.role === 'MANAGER') {
    const directReports = await Employee.find({
      tenantId,
      'employment.reportingManagerId': employee._id,
    });
    const ids = [employee._id, ...directReports.map((r) => r._id)];
    return { isGlobal: false, employeeIds: ids };
  }

  // Employee role
  return { isGlobal: false, employeeIds: [employee._id] };
};

/**
 * Headcount Report
 */
export const fetchHeadcountReport = async (tenantId, scope, filters = {}) => {
  const query = { tenantId };

  if (!scope.isGlobal) {
    query._id = { $in: scope.employeeIds };
  }

  if (filters.department) {
    query['employment.department'] = filters.department;
  }
  if (filters.location) {
    query['employment.location'] = filters.location;
  }

  const employees = await Employee.find(query).sort({ 'personal.firstName': 1 });

  return employees.map((emp) => ({
    employeeId: emp.employeeId,
    name: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
    email: emp.personal?.personalEmail || 'N/A',
    department: emp.employment?.department || 'Unassigned',
    designation: emp.employment?.designation || 'Unassigned',
    location: emp.employment?.location || 'Unassigned',
    status: emp.employment?.status || 'PROBATION',
    joiningDate: emp.employment?.joiningDate ? emp.employment.joiningDate.toISOString().split('T')[0] : 'N/A',
    exitDate: emp.employment?.exitDate ? emp.employment.exitDate.toISOString().split('T')[0] : 'N/A',
  }));
};

/**
 * Attendance Summary Report
 */
export const fetchAttendanceReport = async (tenantId, scope, filters = {}) => {
  // Resolve employee list
  const empQuery = { tenantId };
  if (!scope.isGlobal) {
    empQuery._id = { $in: scope.employeeIds };
  }
  if (filters.department) {
    empQuery['employment.department'] = filters.department;
  }
  if (filters.location) {
    empQuery['employment.location'] = filters.location;
  }

  const employees = await Employee.find(empQuery);
  const employeeIds = employees.map((e) => e._id);

  // Set date ranges
  const today = new Date();
  const startStr = filters.startDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const endStr = filters.endDate || today.toISOString().split('T')[0];

  const records = await AttendanceRecord.find({
    tenantId,
    employeeId: { $in: employeeIds },
    date: { $gte: startStr, $lte: endStr },
  });

  const summaryMap = new Map();
  employees.forEach((emp) => {
    summaryMap.set(emp._id.toString(), {
      employeeId: emp.employeeId,
      name: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
      department: emp.employment?.department || 'Unassigned',
      location: emp.employment?.location || 'Unassigned',
      presentDays: 0,
      lateDays: 0,
      absentDays: 0,
      halfDays: 0,
      workedMinutes: 0,
    });
  });

  records.forEach((rec) => {
    const key = rec.employeeId.toString();
    if (summaryMap.has(key)) {
      const summary = summaryMap.get(key);
      if (['PRESENT', 'REGULARIZED', 'SHORT_LEAVE'].includes(rec.status)) {
        summary.presentDays++;
      } else if (rec.status === 'LATE') {
        summary.lateDays++;
        summary.presentDays++;
      } else if (rec.status === 'HALF_DAY') {
        summary.halfDays++;
      } else if (rec.status === 'ABSENT') {
        summary.absentDays++;
      }
      summary.workedMinutes += rec.totalWorkMinutes || 0;
    }
  });

  return Array.from(summaryMap.values()).map((summary) => ({
    ...summary,
    workedHours: (summary.workedMinutes / 60).toFixed(2),
  }));
};

/**
 * Leave Balance & Usage Report
 */
export const fetchLeavesReport = async (tenantId, scope, filters = {}) => {
  const empQuery = { tenantId };
  if (!scope.isGlobal) {
    empQuery._id = { $in: scope.employeeIds };
  }
  if (filters.department) {
    empQuery['employment.department'] = filters.department;
  }
  if (filters.location) {
    empQuery['employment.location'] = filters.location;
  }

  const employees = await Employee.find(empQuery);
  const employeeIds = employees.map((e) => e._id);

  const balances = await LeaveBalance.find({
    tenantId,
    employeeId: { $in: employeeIds },
  }).populate('leaveTypeId', 'name code');

  const balancesMap = new Map();
  balances.forEach((bal) => {
    const key = bal.employeeId.toString();
    const list = balancesMap.get(key) || [];
    list.push({
      type: bal.leaveTypeId?.name || 'Leave',
      code: bal.leaveTypeId?.code || 'LV',
      allocated: bal.allocated,
      used: bal.used,
      pending: bal.pendingApproval,
      remaining: Math.max(0, bal.allocated - bal.used),
    });
    balancesMap.set(key, list);
  });

  const result = [];
  employees.forEach((emp) => {
    const empLeaves = balancesMap.get(emp._id.toString()) || [
      { type: 'Casual Leave', code: 'CL', allocated: 0, used: 0, pending: 0, remaining: 0 },
    ];

    empLeaves.forEach((leave) => {
      result.push({
        employeeId: emp.employeeId,
        name: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
        department: emp.employment?.department || 'Unassigned',
        location: emp.employment?.location || 'Unassigned',
        leaveType: `${leave.type} (${leave.code})`,
        allocated: leave.allocated,
        used: leave.used,
        pending: leave.pending,
        remaining: leave.remaining,
      });
    });
  });

  return result;
};

/**
 * Late/Absent Report
 */
export const fetchLateAbsentReport = async (tenantId, scope, filters = {}) => {
  const empQuery = { tenantId };
  if (!scope.isGlobal) {
    empQuery._id = { $in: scope.employeeIds };
  }
  if (filters.department) {
    empQuery['employment.department'] = filters.department;
  }
  if (filters.location) {
    empQuery['employment.location'] = filters.location;
  }

  const employees = await Employee.find(empQuery);
  const employeeIds = employees.map((e) => e._id);

  const today = new Date();
  const startStr = filters.startDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const endStr = filters.endDate || today.toISOString().split('T')[0];

  const records = await AttendanceRecord.find({
    tenantId,
    employeeId: { $in: employeeIds },
    date: { $gte: startStr, $lte: endStr },
    status: { $in: ['LATE', 'ABSENT'] },
  }).populate('employeeId', 'personal.firstName personal.lastName employeeId employment.department employment.location');

  return records.map((rec) => {
    const inPunch = rec.punches?.find((p) => p.type === 'IN');
    const timeIn = inPunch ? new Date(inPunch.time).toISOString().split('T')[1].slice(0, 5) : 'N/A';
    return {
      employeeId: rec.employeeId?.employeeId || 'N/A',
      name: rec.employeeId
        ? `${rec.employeeId.personal?.firstName} ${rec.employeeId.personal?.lastName}`
        : 'Unknown',
      department: rec.employeeId?.employment?.department || 'Unassigned',
      location: rec.employeeId?.employment?.location || 'Unassigned',
      date: rec.date,
      status: rec.status,
      timeIn,
    };
  });
};

/**
 * Overtime Report
 */
export const fetchOvertimeReport = async (tenantId, scope, filters = {}) => {
  const empQuery = { tenantId };
  if (!scope.isGlobal) {
    empQuery._id = { $in: scope.employeeIds };
  }
  if (filters.department) {
    empQuery['employment.department'] = filters.department;
  }
  if (filters.location) {
    empQuery['employment.location'] = filters.location;
  }

  const employees = await Employee.find(empQuery);
  const employeeIds = employees.map((e) => e._id);

  const today = new Date();
  const startStr = filters.startDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const endStr = filters.endDate || today.toISOString().split('T')[0];

  const records = await AttendanceRecord.find({
    tenantId,
    employeeId: { $in: employeeIds },
    date: { $gte: startStr, $lte: endStr },
    overtimeMinutes: { $gt: 0 },
  }).populate('employeeId', 'personal.firstName personal.lastName employeeId employment.department employment.location');

  const otMap = new Map();
  records.forEach((rec) => {
    if (!rec.employeeId) return;
    const key = rec.employeeId._id.toString();
    const current = otMap.get(key) || {
      employeeId: rec.employeeId.employeeId,
      name: `${rec.employeeId.personal?.firstName} ${rec.employeeId.personal?.lastName}`,
      department: rec.employeeId.employment?.department || 'Unassigned',
      location: rec.employeeId.employment?.location || 'Unassigned',
      overtimeMinutes: 0,
    };
    current.overtimeMinutes += rec.overtimeMinutes;
    otMap.set(key, current);
  });

  return Array.from(otMap.values()).map((ot) => ({
    ...ot,
    overtimeHours: (ot.overtimeMinutes / 60).toFixed(2),
  }));
};

/**
 * Attrition Report
 */
export const fetchAttritionReport = async (tenantId, scope, filters = {}) => {
  const empQuery = { tenantId };
  if (!scope.isGlobal) {
    empQuery._id = { $in: scope.employeeIds };
  }
  if (filters.location) {
    empQuery['employment.location'] = filters.location;
  }

  const today = new Date();
  const startStr = filters.startDate || `${today.getFullYear()}-01-01`;
  const endStr = filters.endDate || today.toISOString().split('T')[0];
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  const employees = await Employee.find(empQuery);

  const deptMap = new Map();

  employees.forEach((emp) => {
    const dept = emp.employment?.department || 'Unassigned';
    const record = deptMap.get(dept) || {
      department: dept,
      joinedCount: 0,
      leftCount: 0,
      netChange: 0,
      activeHeadcount: 0,
    };

    const joinDate = new Date(emp.employment?.joiningDate);
    if (joinDate >= startDate && joinDate <= endDate) {
      record.joinedCount++;
    }

    if (emp.employment?.status === 'EXITED' && emp.employment?.exitDate) {
      const exitDate = new Date(emp.employment.exitDate);
      if (exitDate >= startDate && exitDate <= endDate) {
        record.leftCount++;
      }
    }

    if (emp.employment?.status === 'ACTIVE' || emp.employment?.status === 'PROBATION') {
      record.activeHeadcount++;
    }

    deptMap.set(dept, record);
  });

  return Array.from(deptMap.values()).map((rec) => {
    rec.netChange = rec.joinedCount - rec.leftCount;
    const baseCount = rec.activeHeadcount + rec.leftCount;
    rec.attritionRate =
      baseCount > 0 ? `${((rec.leftCount / baseCount) * 100).toFixed(2)}%` : '0.00%';
    return rec;
  });
};
