import Employee from '../models/Employee.js';
import Shift from '../models/Shift.js';
import Holiday from '../models/Holiday.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import LeaveRequest from '../models/LeaveRequest.js';

/**
 * Helper to get number of days in a month
 */
const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

/**
 * Returns a complete grid of all active employees and their daily attendance status for a given month.
 */
export const getMusterRegister = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Valid year and month (1-12) are required.' });
    }

    const monthStr = month.toString().padStart(2, '0');
    const numDays = getDaysInMonth(year, month);

    // 1. Fetch active employees (populate shift)
    const employees = await Employee.find({
      tenantId: req.tenantId,
      'employment.status': 'ACTIVE',
    })
      .populate('employment.shiftId')
      .select('personal.firstName personal.lastName employeeId employment.shiftId employment.location');

    // 2. Fetch holidays for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const holidays = await Holiday.find({
      tenantId: req.tenantId,
      date: { $gte: startDate, $lte: endDate },
    });

    // Fetch all shifts in bulk to avoid DB queries inside loops
    const tenantShifts = await Shift.find({ tenantId: req.tenantId });
    const shiftMap = new Map(tenantShifts.map(s => [s._id.toString(), s]));

    // Fetch employee rotational schedules for the month in bulk
    const { default: EmployeeShiftSchedule } = await import('../models/EmployeeShiftSchedule.js');
    const monthlySchedules = await EmployeeShiftSchedule.find({
      tenantId: req.tenantId,
      date: { $regex: `^${year}-${monthStr}` },
    });
    const scheduleMap = new Map();
    monthlySchedules.forEach(sched => {
      scheduleMap.set(`${sched.employeeId.toString()}_${sched.date}`, sched.shiftId.toString());
    });

    // 3. Fetch attendance records for the month
    const records = await AttendanceRecord.find({
      tenantId: req.tenantId,
      date: { $regex: `^${year}-${monthStr}` },
    });

    // Fetch approved leaves for the month in bulk
    const approvedLeaves = await LeaveRequest.find({
      tenantId: req.tenantId,
      status: 'APPROVED',
      startDate: { $lte: `${year}-${monthStr}-${numDays.toString().padStart(2, '0')}` },
      endDate: { $gte: `${year}-${monthStr}-01` },
    }).populate('leaveTypeId', 'code');

    // Create a map for quick record lookup: employeeId_date -> record
    const recordMap = new Map();
    records.forEach(rec => {
      recordMap.set(`${rec.employeeId.toString()}_${rec.date}`, rec);
    });

    const todayStr = new Date().toISOString().split('T')[0];

    // Build the grid
    const grid = employees.map(emp => {
      const dailyAttendance = {};

      for (let day = 1; day <= numDays; day++) {
        const dayStr = day.toString().padStart(2, '0');
        const dateKey = `${year}-${monthStr}-${dayStr}`;

        const recordKey = `${emp._id.toString()}_${dateKey}`;
        const record = recordMap.get(recordKey);

        const dayLeave = approvedLeaves.find(l =>
          l.employeeId.toString() === emp._id.toString() &&
          l.startDate <= dateKey &&
          l.endDate >= dateKey
        );

        // Resolve active shift for this employee on this date
        let shift = emp.employment?.shiftId ? shiftMap.get(emp.employment.shiftId.toString()) : null;
        const overrideShiftId = scheduleMap.get(`${emp._id.toString()}_${dateKey}`);
        if (overrideShiftId) {
          shift = shiftMap.get(overrideShiftId);
        }

        const weeklyOffs = shift?.weeklyOffs || [0, 6]; // default Sat/Sun off
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay(); // 0 is Sun, 6 is Sat

        const isHoliday = holidays.some(h => {
          const hDate = h.date.toISOString().split('T')[0];
          if (hDate !== dateKey) return false;
          const hLoc = h.location?.trim().toLowerCase() || 'all';
          const empLoc = emp.employment?.location?.trim().toLowerCase() || '';
          return hLoc === 'all' || hLoc === empLoc;
        });

        if (record && record.status !== 'ABSENT') {
          dailyAttendance[dayStr] = record.status;
        } else if (isHoliday) {
          dailyAttendance[dayStr] = 'HOLIDAY';
        } else if (weeklyOffs.includes(dayOfWeek)) {
          dailyAttendance[dayStr] = 'WEEKLY_OFF';
        } else if (dayLeave) {
          dailyAttendance[dayStr] = dayLeave.leaveTypeId?.code || 'LEAVE';
        } else if (dateKey > todayStr) {
          dailyAttendance[dayStr] = '-';
        } else {
          dailyAttendance[dayStr] = 'ABSENT';
        }
      }
      return {
        _id: emp._id,
        employeeId: emp.employeeId,
        name: `${emp.personal.firstName} ${emp.personal.lastName}`,
        days: dailyAttendance,
      };
    });

    return res.status(200).json({
      year,
      month,
      numDays,
      grid,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Returns aggregate metrics and analytics dashboard stats for the selected month/year.
 */
export const getAttendanceStats = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Valid year and month (1-12) are required.' });
    }

    const monthStr = month.toString().padStart(2, '0');

    // 1. Fetch active employees count
    const activeEmployeesCount = await Employee.countDocuments({
      tenantId: req.tenantId,
      'employment.status': 'ACTIVE',
    });

    // 2. Fetch all records for the month
    const records = await AttendanceRecord.find({
      tenantId: req.tenantId,
      date: { $regex: `^${year}-${monthStr}` },
    }).populate('employeeId', 'personal.firstName personal.lastName employeeId');

    let totalPresent = 0;
    let totalLate = 0;
    let totalHalfDay = 0;
    let totalShortLeave = 0;
    let totalAbsent = 0;
    let totalWorkMins = 0;
    let totalOvertimeMins = 0;
    let workDaysCount = 0;

    // Overtime aggregate map: employeeId -> { name, employeeId, minutes }
    const otMap = new Map();

    records.forEach(rec => {
      if (['PRESENT', 'LATE', 'HALF_DAY', 'REGULARIZED', 'SHORT_LEAVE'].includes(rec.status)) {
        totalPresent++;
        if (rec.totalWorkMinutes > 0) {
          totalWorkMins += rec.totalWorkMinutes;
          workDaysCount++;
        }
      }
      if (rec.status === 'LATE') {
        totalLate++;
      }
      if (rec.status === 'HALF_DAY') {
        totalHalfDay++;
      }
      if (rec.status === 'SHORT_LEAVE') {
        totalShortLeave++;
      }
      if (rec.status === 'ABSENT') {
        totalAbsent++;
      }

      if (rec.overtimeMinutes > 0) {
        totalOvertimeMins += rec.overtimeMinutes;

        const empIdStr = rec.employeeId?._id?.toString() || 'unknown';
        const empName = rec.employeeId
          ? `${rec.employeeId.personal.firstName} ${rec.employeeId.personal.lastName}`
          : 'Unknown Employee';
        const customEmpId = rec.employeeId?.employeeId || '-';

        if (otMap.has(empIdStr)) {
          const item = otMap.get(empIdStr);
          item.overtimeMinutes += rec.overtimeMinutes;
        } else {
          otMap.set(empIdStr, {
            name: empName,
            employeeId: customEmpId,
            overtimeMinutes: rec.overtimeMinutes,
          });
        }
      }
    });

    // Fetch approved leaves for the month to calculate LOP and total leaves
    const numDays = getDaysInMonth(year, month);
    const approvedLeaves = await LeaveRequest.find({
      tenantId: req.tenantId,
      status: 'APPROVED',
      startDate: { $lte: `${year}-${monthStr}-${numDays.toString().padStart(2, '0')}` },
      endDate: { $gte: `${year}-${monthStr}-01` }
    });

    let totalLeaves = 0;
    let totalLopDays = 0;

    approvedLeaves.forEach(l => {
      // Find overlap dates with current month
      const current = new Date(l.startDate);
      const end = new Date(l.endDate);
      const dates = [];
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      const monthPrefix = `${year}-${monthStr}-`;
      const daysInMonth = dates.filter(d => d.startsWith(monthPrefix));

      if (dates.length > 0 && daysInMonth.length > 0) {
        const ratio = daysInMonth.length / dates.length;
        totalLeaves += l.totalDays * ratio;
        totalLopDays += (l.lopDays || 0) * ratio;
      }
    });

    const avgWorkHours = workDaysCount > 0 ? (totalWorkMins / workDaysCount / 60).toFixed(2) : '0.00';
    const totalOvertimeHours = (totalOvertimeMins / 60).toFixed(2);

    const overtimeSheet = Array.from(otMap.values()).map(item => ({
      ...item,
      overtimeHours: (item.overtimeMinutes / 60).toFixed(2),
    })).sort((a, b) => b.overtimeMinutes - a.overtimeMinutes);

    return res.status(200).json({
      year,
      month,
      activeEmployees: activeEmployeesCount,
      metrics: {
        totalPresent,
        totalLate,
        totalHalfDay,
        totalShortLeave,
        totalAbsent,
        avgWorkHours,
        totalOvertimeHours,
        totalLeaves: Math.round(totalLeaves * 100) / 100,
        totalLopDays: Math.round(totalLopDays * 100) / 100,
      },
      overtimeSheet,
    });
  } catch (err) {
    next(err);
  }
};
