import express from 'express';
import * as attendanceController from '../controllers/attendanceController.js';
import * as reportController from '../controllers/attendanceReportController.js';
import tenantIsolation from '../middleware/tenantIsolation.js';
import rbac from '../middleware/rbac.js';

const router = express.Router();

// ─── Public Biometric Sync Route ───────────────────────────────────────────────
// This endpoint is intentionally placed BEFORE tenantIsolation middleware.
// It does NOT use JWT auth - authentication is via the x-biometric-api-key header
// checked inside the controller, which also resolves the tenant from the API key.
router.post('/biometric-punch', attendanceController.biometricSyncPunch);

// ─── JWT-Protected Routes (require tenantIsolation) ────────────────────────────
router.use(tenantIsolation);

router.post('/punch', attendanceController.punchAttendance);
router.get('/today', attendanceController.getTodayAttendance);

// Regularization Workflow Paths
router.post('/regularize', attendanceController.requestRegularization);
router.get('/regularize/pending', attendanceController.getPendingRegularizations);
router.post('/regularize/:id/review', attendanceController.reviewRegularization);

// Reports & Analytics Dashboards
router.get('/muster', rbac(['HR_ADMIN', 'LEADERSHIP', 'MANAGER']), reportController.getMusterRegister);
router.get('/stats', rbac(['HR_ADMIN', 'LEADERSHIP', 'MANAGER']), reportController.getAttendanceStats);

export default router;
