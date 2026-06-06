import Shift from '../models/Shift.js';
import Holiday from '../models/Holiday.js';
import AuditLog from '../models/AuditLog.js';
import Tenant from '../models/Tenant.js';
import Employee from '../models/Employee.js';
import EmployeeShiftSchedule from '../models/EmployeeShiftSchedule.js';
import crypto from 'crypto';

// ==========================================
// SHIFT CRUD CONTROLLERS
// ==========================================

export const createShift = async (req, res, next) => {
  try {
    const { name, startTime, endTime, gracePeriodMins, halfDayThresholdMins, weeklyOffs } = req.body;

    if (!name || !startTime || !endTime) {
      return res.status(400).json({ error: 'name, startTime, and endTime are required.' });
    }

    const shift = new Shift({
      tenantId: req.tenantId,
      name,
      startTime,
      endTime,
      gracePeriodMins,
      halfDayThresholdMins,
      weeklyOffs,
    });
    await shift.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'SHIFT_CREATE',
      entity: 'SHIFT',
      entityId: shift._id,
      details: { name, startTime, endTime },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(201).json({ message: 'Shift created successfully.', shift });
  } catch (err) {
    next(err);
  }
};

export const getShifts = async (req, res, next) => {
  try {
    let shifts = await Shift.find({ tenantId: req.tenantId });
    if (shifts.length === 0) {
      const defaultShifts = [
        {
          tenantId: req.tenantId,
          name: 'Day Shift',
          startTime: '09:00',
          endTime: '17:00',
          gracePeriodMins: 15,
          halfDayThresholdMins: 240,
          shortLeaveThresholdMins: 360,
          weeklyOffs: [0, 6],
        },
        {
          tenantId: req.tenantId,
          name: 'Night Shift',
          startTime: '22:00',
          endTime: '06:00',
          gracePeriodMins: 15,
          halfDayThresholdMins: 240,
          shortLeaveThresholdMins: 360,
          weeklyOffs: [0, 6],
        },
        {
          tenantId: req.tenantId,
          name: 'Morning Shift',
          startTime: '06:00',
          endTime: '14:00',
          gracePeriodMins: 15,
          halfDayThresholdMins: 240,
          shortLeaveThresholdMins: 360,
          weeklyOffs: [0, 6],
        }
      ];
      await Shift.insertMany(defaultShifts);
      shifts = await Shift.find({ tenantId: req.tenantId });
    }
    return res.status(200).json(shifts);
  } catch (err) {
    next(err);
  }
};

export const getShiftById = async (req, res, next) => {
  try {
    const shift = await Shift.findOne({ tenantId: req.tenantId, _id: req.params.id });
    if (!shift) {
      return res.status(404).json({ error: 'Shift not found.' });
    }
    return res.status(200).json(shift);
  } catch (err) {
    next(err);
  }
};

export const updateShift = async (req, res, next) => {
  try {
    const { name, startTime, endTime, gracePeriodMins, halfDayThresholdMins, weeklyOffs } = req.body;

    const shift = await Shift.findOne({ tenantId: req.tenantId, _id: req.params.id });
    if (!shift) {
      return res.status(404).json({ error: 'Shift not found.' });
    }

    if (name) shift.name = name;
    if (startTime) shift.startTime = startTime;
    if (endTime) shift.endTime = endTime;
    if (gracePeriodMins !== undefined) shift.gracePeriodMins = gracePeriodMins;
    if (halfDayThresholdMins !== undefined) shift.halfDayThresholdMins = halfDayThresholdMins;
    if (weeklyOffs) shift.weeklyOffs = weeklyOffs;

    await shift.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'SHIFT_UPDATE',
      entity: 'SHIFT',
      entityId: shift._id,
      details: { name: shift.name },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({ message: 'Shift updated successfully.', shift });
  } catch (err) {
    next(err);
  }
};

export const deleteShift = async (req, res, next) => {
  try {
    const shift = await Shift.findOne({ tenantId: req.tenantId, _id: req.params.id });
    if (!shift) {
      return res.status(404).json({ error: 'Shift not found.' });
    }

    await Shift.deleteOne({ _id: shift._id });

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'SHIFT_DELETE',
      entity: 'SHIFT',
      entityId: shift._id,
      details: { name: shift.name },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({ message: 'Shift deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// HOLIDAY CRUD CONTROLLERS
// ==========================================

export const createHoliday = async (req, res, next) => {
  try {
    const { name, date, location } = req.body;

    if (!name || !date) {
      return res.status(400).json({ error: 'name and date are required.' });
    }

    const holiday = new Holiday({
      tenantId: req.tenantId,
      name,
      date: new Date(date),
      location: location || 'All',
    });
    await holiday.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'HOLIDAY_CREATE',
      entity: 'HOLIDAY',
      entityId: holiday._id,
      details: { name, date, location: holiday.location },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(201).json({ message: 'Holiday created successfully.', holiday });
  } catch (err) {
    next(err);
  }
};

export const getHolidays = async (req, res, next) => {
  try {
    const holidays = await Holiday.find({ tenantId: req.tenantId }).sort({ date: 1 });
    return res.status(200).json(holidays);
  } catch (err) {
    next(err);
  }
};

export const getHolidayById = async (req, res, next) => {
  try {
    const holiday = await Holiday.findOne({ tenantId: req.tenantId, _id: req.params.id });
    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found.' });
    }
    return res.status(200).json(holiday);
  } catch (err) {
    next(err);
  }
};

export const updateHoliday = async (req, res, next) => {
  try {
    const { name, date, location } = req.body;

    const holiday = await Holiday.findOne({ tenantId: req.tenantId, _id: req.params.id });
    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found.' });
    }

    if (name) holiday.name = name;
    if (date) holiday.date = new Date(date);
    if (location) holiday.location = location;

    await holiday.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'HOLIDAY_UPDATE',
      entity: 'HOLIDAY',
      entityId: holiday._id,
      details: { name: holiday.name },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({ message: 'Holiday updated successfully.', holiday });
  } catch (err) {
    next(err);
  }
};

export const deleteHoliday = async (req, res, next) => {
  try {
    const holiday = await Holiday.findOne({ tenantId: req.tenantId, _id: req.params.id });
    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found.' });
    }

    await Holiday.deleteOne({ _id: holiday._id });

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'HOLIDAY_DELETE',
      entity: 'HOLIDAY',
      entityId: holiday._id,
      details: { name: holiday.name },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({ message: 'Holiday deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// ATTENDANCE POLICY SETTINGS CONTROLLERS
// ==========================================

/**
 * Returns the current tenant attendance policy settings.
 */
export const getAttendanceSettings = async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).select('settings.attendance');
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }
    return res.status(200).json(tenant.settings?.attendance || {});
  } catch (err) {
    next(err);
  }
};

/**
 * Updates attendance policy settings for the tenant:
 * - ipWhitelist: array of IP/CIDR patterns
 * - geofencingEnabled: boolean toggle
 * - biometricApiKey: string key (or pass 'GENERATE' to auto-create a secure random key)
 */
export const updateAttendanceSettings = async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    const { ipWhitelist, geofencingEnabled, biometricApiKey } = req.body;

    if (!tenant.settings) tenant.settings = {};
    if (!tenant.settings.attendance) tenant.settings.attendance = {};

    if (Array.isArray(ipWhitelist)) {
      tenant.settings.attendance.ipWhitelist = ipWhitelist;
    }

    if (typeof geofencingEnabled === 'boolean') {
      tenant.settings.attendance.geofencingEnabled = geofencingEnabled;
    }

    if (biometricApiKey !== undefined) {
      if (biometricApiKey === 'GENERATE') {
        // Auto-generate a cryptographically secure random API key
        tenant.settings.attendance.biometricApiKey = crypto.randomBytes(32).toString('hex');
      } else if (biometricApiKey === '') {
        // Clear the key
        tenant.settings.attendance.biometricApiKey = undefined;
      } else {
        tenant.settings.attendance.biometricApiKey = biometricApiKey;
      }
    }

    tenant.markModified('settings');
    await tenant.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'ATTENDANCE_SETTINGS_UPDATE',
      entity: 'TENANT',
      entityId: tenant._id,
      details: {
        ipWhitelistCount: tenant.settings.attendance.ipWhitelist?.length,
        geofencingEnabled: tenant.settings.attendance.geofencingEnabled,
        biometricKeySet: !!tenant.settings.attendance.biometricApiKey,
      },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({
      message: 'Attendance settings updated successfully.',
      settings: tenant.settings.attendance,
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// BULK TEAM AND ROTATIONAL SHIFT ASSIGNMENTS
// ==========================================

/**
 * Bulk assigns a shift to all active employees in a department and/or office location.
 */
export const assignShiftToTeam = async (req, res, next) => {
  try {
    const { department, location, shiftId } = req.body;

    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId is required.' });
    }

    if (!department && !location) {
      return res.status(400).json({ error: 'Either department or location must be specified.' });
    }

    const shift = await Shift.findOne({ tenantId: req.tenantId, _id: shiftId });
    if (!shift) {
      return res.status(404).json({ error: 'Shift configuration not found.' });
    }

    const filter = { tenantId: req.tenantId, 'employment.status': 'ACTIVE' };
    if (department) filter['employment.department'] = department;
    if (location) filter['employment.location'] = location;

    const result = await Employee.updateMany(filter, {
      $set: {
        'employment.shiftId': shift._id,
        'employment.assignedShift': shift.name,
      }
    });

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'SHIFT_ASSIGN_TEAM_BULK',
      entity: 'EMPLOYEE',
      entityId: shift._id,
      details: { department, location, modifiedCount: result.modifiedCount },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({
      message: `Successfully assigned ${shift.name} to ${result.modifiedCount} employees matching search filters.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Creates rotational schedule overrides for specified employees across a date range.
 */
export const assignRotationalShifts = async (req, res, next) => {
  try {
    const { employeeIds, startDate, endDate, shiftId } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'employeeIds array is required and cannot be empty.' });
    }
    if (!startDate || !endDate || !shiftId) {
      return res.status(400).json({ error: 'startDate, endDate, and shiftId are required.' });
    }

    const shift = await Shift.findOne({ tenantId: req.tenantId, _id: shiftId });
    if (!shift) {
      return res.status(404).json({ error: 'Shift configuration not found.' });
    }

    // Generate dates range (inclusive)
    const dates = [];
    let current = new Date(startDate);
    const end = new Date(endDate);

    if (current > end) {
      return res.status(400).json({ error: 'startDate cannot be after endDate.' });
    }

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // Prepare bulk ops upserts
    const ops = [];
    employeeIds.forEach(empId => {
      dates.forEach(d => {
        ops.push({
          updateOne: {
            filter: { tenantId: req.tenantId, employeeId: empId, date: d },
            update: { $set: { shiftId: shift._id } },
            upsert: true,
          }
        });
      });
    });

    await EmployeeShiftSchedule.bulkWrite(ops);

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'SHIFT_ASSIGN_ROTATIONAL_BULK',
      entity: 'EMPLOYEE',
      entityId: shift._id,
      details: { employeesCount: employeeIds.length, startDate, endDate },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({
      message: `Successfully scheduled rotational shift ${shift.name} for ${employeeIds.length} employees from ${startDate} to ${endDate}.`,
    });
  } catch (err) {
    next(err);
  }
};
