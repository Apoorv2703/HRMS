import Employee from '../models/Employee.js';
import Shift from '../models/Shift.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import AuditLog from '../models/AuditLog.js';
import Tenant from '../models/Tenant.js';
import ApprovalInstance from '../models/ApprovalInstance.js';
import ApprovalDelegation from '../models/ApprovalDelegation.js';
import * as workflowEngine from '../utils/workflowEngine.js';

/**
 * Checks and returns the attendance record for the logged-in employee for a given date.
 */
export const getTodayAttendance = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const employee = await Employee.findOne({ tenantId: req.tenantId, userId: req.user.id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found.' });
    }

    const record = await AttendanceRecord.findOne({
      tenantId: req.tenantId,
      employeeId: employee._id,
      date,
    }).populate('employeeId', 'personal.firstName personal.lastName');

    return res.status(200).json(record || null);
  } catch (err) {
    next(err);
  }
};

/**
 * Shared helper to calculate daily attendance status, total work minutes, and overtime.
 * Chronologically sorts punches first to ensure correct sequence analysis.
 */
export const recalculateRecordRules = (record, shift) => {
  // Sort punches chronologically by time
  record.punches.sort((a, b) => new Date(a.time) - new Date(b.time));

  const inPunches = record.punches.filter(p => p.type === 'IN');

  // 1. Evaluate Late Status (based on the first IN punch of the day)
  const firstIn = inPunches[0];
  if (firstIn) {
    if (shift && shift.type === 'FLEXIBLE') {
      record.status = 'PRESENT'; // Flexible shifts are never late by clock-in
    } else {
      let shiftStartMins = 9 * 60; // default 09:00 AM
      let gracePeriod = 15;        // default 15 minutes

      if (shift) {
        const [sh, sm] = shift.startTime.split(':').map(Number);
        shiftStartMins = sh * 60 + sm;
        gracePeriod = shift.gracePeriodMins;
      }

      const firstInTime = new Date(firstIn.time);
      const punchHours = firstInTime.getHours();
      const punchMins = firstInTime.getMinutes();
      const punchMinutesFromMidnight = punchHours * 60 + punchMins;

      if (punchMinutesFromMidnight > shiftStartMins + gracePeriod) {
        record.status = 'LATE';
      } else {
        record.status = 'PRESENT';
      }
    }
  } else {
    record.status = 'ABSENT'; // No IN punches means absent
  }

  // 2. Worked Duration (sum of all matching IN-OUT intervals)
  let totalWorkedMins = 0;
  for (let i = 0; i < record.punches.length; i++) {
    const p = record.punches[i];
    if (p.type === 'IN') {
      const nextPunch = record.punches[i + 1];
      if (nextPunch && nextPunch.type === 'OUT') {
        const diffMs = new Date(nextPunch.time) - new Date(p.time);
        totalWorkedMins += Math.max(0, Math.floor(diffMs / 1000 / 60));
        i++; // skip matching OUT
      }
    }
  }
  record.totalWorkMinutes = totalWorkedMins;

  // Apply Half-Day and Short-Leave checks
  let halfDayThreshold = 240; // default 4 hours
  let shortLeaveThreshold = 360; // default 6 hours
  if (shift) {
    halfDayThreshold = shift.halfDayThresholdMins;
    shortLeaveThreshold = shift.shortLeaveThresholdMins !== undefined ? shift.shortLeaveThresholdMins : 360;
  }

  if (totalWorkedMins > 0) {
    if (totalWorkedMins < halfDayThreshold) {
      record.status = 'HALF_DAY';
    } else if (totalWorkedMins < shortLeaveThreshold) {
      record.status = 'SHORT_LEAVE';
    }
  }

  // 3. Overtime Calculations
  let shiftLengthMins = 8 * 60; // default 8 hours
  if (shift) {
    if (shift.type === 'FLEXIBLE') {
      shiftLengthMins = shift.minWorkMinutesPerDay !== undefined ? shift.minWorkMinutesPerDay : 8 * 60;
    } else {
      const [startH, startM] = shift.startTime.split(':').map(Number);
      const [endH, endM] = shift.endTime.split(':').map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;
      shiftLengthMins = endMin > startMin ? (endMin - startMin) : (24 * 60 - startMin + endMin);
    }
  }

  if (totalWorkedMins > shiftLengthMins) {
    record.overtimeMinutes = totalWorkedMins - shiftLengthMins;
  } else {
    record.overtimeMinutes = 0;
  }
};

/**
 * Performs a web clock-in/out punch for the logged-in employee.
 * Evaluates tenant rules: IP Whitelist, GPS Geofencing, Shift rules (LATE, HALF_DAY, OVERTIME).
 */
export const punchAttendance = async (req, res, next) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const timeStr = req.body.time || new Date().toISOString();
    const punchTime = new Date(timeStr);
    const clientIp = req.body.ip || req.ip || '127.0.0.1';
    const clientLocation = req.body.location || null;

    const employee = await Employee.findOne({ tenantId: req.tenantId, userId: req.user.id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found.' });
    }

    const tenant = await Tenant.findById(req.tenantId);

    // 1. IP Whitelist Check
    if (tenant?.settings?.attendance?.ipWhitelist?.length > 0) {
      const { isIpAllowed } = await import('../utils/ipMatcher.js');
      if (!isIpAllowed(clientIp, tenant.settings.attendance.ipWhitelist)) {
        return res.status(400).json({
          error: `Punch blocked: Your IP address (${clientIp}) is not whitelisted for attendance punches.`
        });
      }
    }

    // 2. GPS Geofencing Check
    if (tenant?.settings?.attendance?.geofencingEnabled) {
      const { default: Organization } = await import('../models/Organization.js');
      const org = await Organization.findOne({ tenantId: req.tenantId });

      const matchedLoc = org?.locations?.find(loc =>
        loc.name && employee.employment?.location &&
        (loc.name.toLowerCase() === employee.employment.location.toLowerCase() ||
         loc.code?.toLowerCase() === employee.employment.location.toLowerCase())
      );

      const targetLocs = [];
      if (matchedLoc && typeof matchedLoc.latitude === 'number' && typeof matchedLoc.longitude === 'number') {
        targetLocs.push(matchedLoc);
      } else if (org?.locations) {
        org.locations.forEach(loc => {
          if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
            targetLocs.push(loc);
          }
        });
      }

      if (targetLocs.length > 0) {
        if (!clientLocation || typeof clientLocation.lat !== 'number' || typeof clientLocation.lng !== 'number') {
          return res.status(400).json({
            error: 'GPS location coordinates are required for geofenced clock-in/out.'
          });
        }

        const { calculateDistance } = await import('../utils/geofence.js');
        let inBounds = false;
        let minDistance = Infinity;
        let closestLocName = '';

        for (const loc of targetLocs) {
          const distance = calculateDistance(
            clientLocation.lat,
            clientLocation.lng,
            loc.latitude,
            loc.longitude
          );
          const radius = loc.radiusMeters || 200;
          if (distance <= radius) {
            inBounds = true;
            break;
          }
          if (distance < minDistance) {
            minDistance = distance;
            closestLocName = loc.name;
          }
        }

        if (!inBounds) {
          return res.status(400).json({
            error: `Punch blocked: You are outside the authorized geofence boundary. Closest location: ${closestLocName} (Distance: ${Math.round(minDistance)}m, Allowed: ${targetLocs[0].radiusMeters || 200}m).`
          });
        }
      }
    }

    // Load active Shift (rotational override check)
    let shift = null;
    const { default: EmployeeShiftSchedule } = await import('../models/EmployeeShiftSchedule.js');
    const rotationalOverride = await EmployeeShiftSchedule.findOne({
      tenantId: req.tenantId,
      employeeId: employee._id,
      date,
    });

    if (rotationalOverride) {
      shift = await Shift.findById(rotationalOverride.shiftId);
    } else if (employee.employment?.shiftId) {
      shift = await Shift.findById(employee.employment.shiftId);
    }

    // Find or initialize daily attendance record
    let record = await AttendanceRecord.findOne({
      tenantId: req.tenantId,
      employeeId: employee._id,
      date,
    });

    if (!record) {
      record = new AttendanceRecord({
        tenantId: req.tenantId,
        employeeId: employee._id,
        date,
        punches: [],
        status: 'PRESENT',
      });
    }

    // Auto-toggling punch type logic
    const lastPunch = record.punches[record.punches.length - 1];
    const punchType = req.body.type || (lastPunch && lastPunch.type === 'IN' ? 'OUT' : 'IN');

    // Add punch entry
    record.punches.push({
      time: punchTime,
      type: punchType,
      ip: clientIp,
      location: clientLocation ? { lat: clientLocation.lat, lng: clientLocation.lng } : undefined,
    });

    // Run rules engine using the shared helper
    recalculateRecordRules(record, shift);

    await record.save();

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'EMPLOYEE_ATTENDANCE_PUNCH',
      entity: 'ATTENDANCE',
      entityId: record._id,
      details: { punchType, time: punchTime, date, status: record.status },
      ip: clientIp,
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({
      message: `Successfully clocked ${punchType.toLowerCase()}.`,
      record,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Sync endpoint for external Biometric devices. Authenticated via x-biometric-api-key header.
 * Bypasses normal user session JWT requirements, geofencing coordinates, and IP whitelists.
 */
export const biometricSyncPunch = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-biometric-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'Authentication required. Missing x-biometric-api-key header.' });
    }

    const tenant = await Tenant.findOne({ 'settings.attendance.biometricApiKey': apiKey });
    if (!tenant) {
      return res.status(401).json({ error: 'Invalid biometric API key.' });
    }

    const { employeeId, time, type, deviceId } = req.body;
    if (!employeeId || !time || !type || !deviceId) {
      return res.status(400).json({ error: 'employeeId, time, type, and deviceId are required fields.' });
    }

    if (!['IN', 'OUT'].includes(type)) {
      return res.status(400).json({ error: 'Punch type must be IN or OUT.' });
    }

    const employee = await Employee.findOne({ tenantId: tenant._id, employeeId });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found.' });
    }

    const punchTime = new Date(time);
    const date = time.split('T')[0];

    // Load active Shift (rotational override check)
    let shift = null;
    const { default: EmployeeShiftSchedule } = await import('../models/EmployeeShiftSchedule.js');
    const rotationalOverride = await EmployeeShiftSchedule.findOne({
      tenantId: tenant._id,
      employeeId: employee._id,
      date,
    });

    if (rotationalOverride) {
      shift = await Shift.findById(rotationalOverride.shiftId);
    } else if (employee.employment?.shiftId) {
      shift = await Shift.findById(employee.employment.shiftId);
    }

    let record = await AttendanceRecord.findOne({
      tenantId: tenant._id,
      employeeId: employee._id,
      date,
    });

    if (!record) {
      record = new AttendanceRecord({
        tenantId: tenant._id,
        employeeId: employee._id,
        date,
        punches: [],
        status: 'PRESENT',
      });
    }

    // Prevent duplicate sync records
    const isDuplicate = record.punches.some(p => p.time.getTime() === punchTime.getTime());
    if (isDuplicate) {
      return res.status(400).json({ error: 'Duplicate punch log at the same timestamp.' });
    }

    record.punches.push({
      time: punchTime,
      type,
      ip: `Biometric (${deviceId})`,
    });

    // Run rules engine using the shared helper
    recalculateRecordRules(record, shift);

    await record.save();

    await AuditLog.create({
      tenantId: tenant._id,
      actorId: employee.userId,
      action: 'BIOMETRIC_ATTENDANCE_PUNCH_SYNC',
      entity: 'ATTENDANCE',
      entityId: record._id,
      details: { punchType: type, time: punchTime, date, deviceId, status: record.status },
      ip: req.ip || '127.0.0.1',
      userAgent: 'Biometric Sync Agent',
    });

    return res.status(200).json({
      message: 'Biometric punch synced successfully.',
      record,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Request correction/regularization for a specific daily attendance record.
 * Allowed only for current and previous months.
 */
export const requestRegularization = async (req, res, next) => {
  try {
    const { date, requestedTimeIn, requestedTimeOut, reason } = req.body;

    if (!date || !requestedTimeIn || !requestedTimeOut || !reason) {
      return res.status(400).json({ error: 'date, requestedTimeIn, requestedTimeOut, and reason are required.' });
    }

    const timeIn = new Date(requestedTimeIn);
    const timeOut = new Date(requestedTimeOut);

    if (timeIn >= timeOut) {
      return res.status(400).json({ error: 'Clock-in time must be strictly before clock-out time.' });
    }

    // Limit regularization to current and previous months
    const reqDate = new Date(date);
    const now = new Date();
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    if (reqDate < startOfPrevMonth) {
      return res.status(400).json({ error: 'Regularization requests are only permitted for the current or previous calendar month.' });
    }

    const employee = await Employee.findOne({ tenantId: req.tenantId, userId: req.user.id });
    if (!employee) {
      return res.status(404).json({ error: 'Employee profile not found.' });
    }

    let record = await AttendanceRecord.findOne({ tenantId: req.tenantId, employeeId: employee._id, date });
    if (!record) {
      record = new AttendanceRecord({
        tenantId: req.tenantId,
        employeeId: employee._id,
        date,
        status: 'ABSENT',
        punches: [],
      });
    }

    record.regularization = {
      requestedTimeIn: timeIn,
      requestedTimeOut: timeOut,
      reason,
      status: 'PENDING',
    };

    await record.save();

    // Initiate workflow engine approval chain
    await workflowEngine.initiateWorkflow(
      req.tenantId,
      'REGULARIZATION',
      req.user.id,
      record._id,
      {}
    );

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'EMPLOYEE_REGULARIZATION_REQUEST',
      entity: 'ATTENDANCE',
      entityId: record._id,
      details: { date, reason },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    return res.status(200).json({ message: 'Regularization request submitted successfully.', record });
  } catch (err) {
    next(err);
  }
};

/**
 * Returns pending regularization requests for the logged-in manager's team.
 */
export const getPendingRegularizations = async (req, res, next) => {
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
      requestType: 'REGULARIZATION',
      $or: [
        { activeApproverId: req.user.id },
        { activeApproverId: { $in: delegators } }
      ]
    });

    const recordIds = instances.map(inst => inst.requestId);

    const records = await AttendanceRecord.find({
      tenantId: req.tenantId,
      _id: { $in: recordIds },
    }).populate('employeeId', 'personal.firstName personal.lastName employeeId');

    return res.status(200).json(records);
  } catch (err) {
    next(err);
  }
};

/**
 * Approves or Rejects a pending regularization request. Overwrites daily punches on approval.
 */
export const reviewRegularization = async (req, res, next) => {
  try {
    const { action, comment } = req.body;
    const { id } = req.params;

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'action must be either APPROVE or REJECT.' });
    }

    const record = await AttendanceRecord.findOne({ tenantId: req.tenantId, _id: id }).populate('employeeId');
    if (!record) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }

    // Delegate to workflow engine
    const instance = await workflowEngine.processAction(
      req.tenantId,
      record._id,
      req.user.id,
      action,
      comment
    );

    await AuditLog.create({
      tenantId: req.tenantId,
      actorId: req.user.id,
      action: 'EMPLOYEE_REGULARIZATION_REVIEW',
      entity: 'ATTENDANCE',
      entityId: record._id,
      details: { action, comment },
      ip: req.ip || '127.0.0.1',
      userAgent: req.headers?.['user-agent'] || 'Server',
    });

    const updatedRecord = await AttendanceRecord.findById(record._id).populate('employeeId');

    return res.status(200).json({
      message: `Regularization request successfully ${action === 'APPROVE' ? 'approved' : 'rejected'}.`,
      record: updatedRecord,
      instance,
    });
  } catch (err) {
    next(err);
  }
};
