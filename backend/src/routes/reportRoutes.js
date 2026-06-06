import express from 'express';
import * as reportController from '../controllers/reportController.js';
import tenantIsolation from '../middleware/tenantIsolation.js';
import rbac from '../middleware/rbac.js';

const router = express.Router();

// Apply tenant isolation globally to all reports routes
router.use(tenantIsolation);

// Everyone has access to their own scoped dashboard KPIs
router.get('/dashboard', rbac(['HR_ADMIN', 'LEADERSHIP', 'MANAGER', 'EMPLOYEE']), reportController.getDashboardMetrics);

// Management & HR Admin standard reports query
router.get('/data', rbac(['HR_ADMIN', 'LEADERSHIP', 'MANAGER']), reportController.getReportData);
router.get('/export', rbac(['HR_ADMIN', 'LEADERSHIP', 'MANAGER']), reportController.exportReportCSV);

// Reports email delivery scheduling
router.post('/schedule', rbac(['HR_ADMIN', 'LEADERSHIP', 'MANAGER']), reportController.scheduleReport);
router.get('/schedule', rbac(['HR_ADMIN', 'LEADERSHIP', 'MANAGER']), reportController.getSchedules);
router.post('/schedule/trigger-runs', rbac(['HR_ADMIN']), reportController.triggerScheduledRuns);

export default router;
