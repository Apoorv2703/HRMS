import Shift from '../models/Shift.js';
import Holiday from '../models/Holiday.js';
import AuditLog from '../models/AuditLog.js';
import Tenant from '../models/Tenant.js';
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
    const shifts = await Shift.find({ tenantId: req.tenantId });
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
