import express from 'express';
import * as roleController from '../controllers/roleController.js';
import tenantIsolation from '../middleware/tenantIsolation.js';
import checkPermission from '../middleware/checkPermission.js';

const router = express.Router();

// Role config endpoints (HR Admins who have policy:configure permission)
router.post('/', tenantIsolation, checkPermission('policy:configure'), roleController.createRole);
router.get('/', tenantIsolation, checkPermission('policy:configure'), roleController.getRoles);
router.put('/:id', tenantIsolation, checkPermission('policy:configure'), roleController.updateRole);
router.delete('/:id', tenantIsolation, checkPermission('policy:configure'), roleController.deleteRole);

// Assign role to user
router.put('/users/:userId/role', tenantIsolation, checkPermission('policy:configure'), roleController.assignUserRole);

export default router;
