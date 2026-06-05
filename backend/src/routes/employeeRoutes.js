import express from 'express';
import * as employeeController from '../controllers/employeeController.js';
import tenantIsolation from '../middleware/tenantIsolation.js';
import rbac from '../middleware/rbac.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Public routes for onboarding setup activation
router.get('/verify-invite', employeeController.verifyInviteCode);
router.post('/activate-invite', employeeController.activateOnboardedEmployee);

// Protected routes (Tenant Isolation required)
// Bulk operations (Admin / Leadership)
router.get('/export-csv', tenantIsolation, rbac(['HR_ADMIN', 'LEADERSHIP']), employeeController.exportCSV);
router.post('/import-csv', tenantIsolation, rbac(['HR_ADMIN']), employeeController.importCSV);

// Pending approvals management (Admin only)
router.get('/pending-edits', tenantIsolation, rbac(['HR_ADMIN']), employeeController.getPendingEdits);
router.post('/:id/review-edits', tenantIsolation, rbac(['HR_ADMIN']), employeeController.reviewPendingEdits);

// Core employee CRUD operations
router.post('/invite', tenantIsolation, rbac(['HR_ADMIN']), employeeController.inviteEmployee);
router.get('/', tenantIsolation, employeeController.getDirectory);
router.get('/:id', tenantIsolation, employeeController.getEmployeeById);
router.put('/:id', tenantIsolation, employeeController.updateProfile);
router.post('/:id/terminate', tenantIsolation, rbac(['HR_ADMIN']), employeeController.terminateEmployee);

// Documents endpoints
router.post('/:id/documents', tenantIsolation, upload.single('file'), employeeController.uploadDocument);
router.delete('/:id/documents/:docId', tenantIsolation, employeeController.deleteDocument);

export default router;
