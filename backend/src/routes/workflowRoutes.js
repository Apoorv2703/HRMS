import express from 'express';
import * as workflowController from '../controllers/workflowController.js';
import tenantIsolation from '../middleware/tenantIsolation.js';
import rbac from '../middleware/rbac.js';

const router = express.Router();

// Apply tenant isolation globally to all workflow paths
router.use(tenantIsolation);

// Policy management (HR Admin only)
router.post('/policy', rbac(['HR_ADMIN']), workflowController.configurePolicy);
router.get('/policy/:requestType', rbac(['HR_ADMIN']), workflowController.getPolicy);

// Delegation rules
router.post('/delegate', workflowController.createDelegation);
router.get('/delegate/active', workflowController.getActiveDelegations);

// Workflow state execution actions
router.post('/review/:id', workflowController.reviewRequestWorkflow);
router.get('/history/:id', workflowController.getWorkflowHistory);

// Diagnostics/Cron trigger
router.post('/cron/sla', workflowController.runSlaCron);

export default router;
