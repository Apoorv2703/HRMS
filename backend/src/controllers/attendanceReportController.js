import Employee from '../models/Employee.js';
import Shift from '../models/Shift.js';
import Holiday from '../models/Holiday.js';
import AttendanceRecord from '../models/AttendanceRecord.js';

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

    // 1. Fetch active employees (populate shift)
    const employees = await Employee.find({
      tenantId: req.tenantId,
      'employment.status': 'ACTIVE',
    })
      .populate('employment.shiftId')
      .select('personal.firstName personal.lastName employeeId employment.shiftId');

    // 2. Fetch holidays for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const holidays = await Holiday.find({
      tenantId: req.tenantId,
      date: { $gte: startDate, $lte: endDate },
    });

    const holidayDates = new Set(
      holidays.map(h => h.date.toISOString().split('T')[0])
    );

    // 3. Fetch attendance records for the month
    const monthStr = month.toString().padStart(2, '0');
    const records = await AttendanceRecord.find({
      tenantId: req.tenantId,
      date: { $regex: `^${year}-${monthStr}` },
    });

    // Create a map for quick record lookup: employeeId_date -> record
    const recordMap = new Map();
    records.forEach(rec => {
      recordMap.set(`${rec.employeeId.toString()}_${rec.date}`, rec);
    });

    const numDays = getDaysInMonth(year, month);
    const todayStr = new Date().toISOString().split('T')[0];

    // Build the grid
    const grid = employees.map(emp => {
      const dailyAttendance = {};

      for (let day = 1; day <= numDays; day++) {
        const dayStr = day.toString().padStart(2, '0');
        const dateKey = `${year}-${monthStr}-${dayStr}`;

        const recordKey = `${emp._id.toString()}_${dateKey}`;
        const record = recordMap.get(recordKey);

        if (record) {
          dailyAttendance[dayStr] = record.status;
        } else if (holidayDates.has(dateKey)) {
          dailyAttendance[dayStr] = 'HOLIDAY';
        } else {
          // Check shift weekly offs
          const dateObj = new Date(year, month - 1, day);
          const dayOfWeek = dateObj.getDay(); // 0 is Sun, 6 is Sat
          const shift = emp.employment?.shiftId;
          const weeklyOffs = shift?.weeklyOffs || [0, 6]; // default Sat/Sun off

          if (weeklyOffs.includes(dayOfWeek)) {
            dailyAttendance[dayStr] = 'WEEKLY_OFF';
          } else if (dateKey > todayStr) {
            dailyAttendance[dayStr] = '-';
          } else {
            dailyAttendance[dayStr] = 'ABSENT';
          }
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
    let totalAbsent = 0;
    let totalWorkMins = 0;
    let totalOvertimeMins = 0;
    let workDaysCount = 0;

    // Overtime aggregate map: employeeId -> { name, employeeId, minutes }
    const otMap = new Map();

    records.forEach(rec => {
      if (['PRESENT', 'LATE', 'HALF_DAY', 'REGULARIZED'].includes(rec.status)) {
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
        totalAbsent,
        avgWorkHours,
        totalOvertimeHours,
      },
      overtimeSheet,
    });
  } catch (err) {
    next(err);
  }
};
