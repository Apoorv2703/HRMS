import express from 'express';
import * as configController from '../controllers/attendanceConfigController.js';
import tenantIsolation from '../middleware/tenantIsolation.js';
import rbac from '../middleware/rbac.js';

const router = express.Router();

// Apply tenant isolation to all config routes
router.use(tenantIsolation);

// Shifts Routing
router.post('/shifts', rbac(['HR_ADMIN']), configController.createShift);
router.get('/shifts', configController.getShifts);
router.get('/shifts/:id', configController.getShiftById);
router.put('/shifts/:id', rbac(['HR_ADMIN']), configController.updateShift);
router.delete('/shifts/:id', rbac(['HR_ADMIN']), configController.deleteShift);

// Holidays Routing
router.post('/holidays', rbac(['HR_ADMIN']), configController.createHoliday);
router.get('/holidays', configController.getHolidays);
router.get('/holidays/:id', configController.getHolidayById);
router.put('/holidays/:id', rbac(['HR_ADMIN']), configController.updateHoliday);
router.delete('/holidays/:id', rbac(['HR_ADMIN']), configController.deleteHoliday);

// Attendance Policy Settings (IP Whitelist, Geofencing, Biometric API Key)
router.get('/settings', rbac(['HR_ADMIN']), configController.getAttendanceSettings);
router.put('/settings', rbac(['HR_ADMIN']), configController.updateAttendanceSettings);

export default router;
