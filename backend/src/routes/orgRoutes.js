import express from 'express';
import * as orgController from '../controllers/orgController.js';
import tenantIsolation from '../middleware/tenantIsolation.js';
import rbac from '../middleware/rbac.js';

const router = express.Router();

// Retrieve organization metadata configurations (Locations, Departments, Grades)
router.get('/', tenantIsolation, orgController.getOrganization);

// Update/replace organization setup (HR Admin only)
router.put('/', tenantIsolation, rbac(['HR_ADMIN']), orgController.updateOrganization);

export default router;
