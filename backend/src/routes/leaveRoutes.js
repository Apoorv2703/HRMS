import express from 'express';
import * as configController from '../controllers/leaveConfigController.js';
import * as requestController from '../controllers/leaveRequestController.js';
import tenantIsolation from '../middleware/tenantIsolation.js';
import rbac from '../middleware/rbac.js';

const router = express.Router();

// Apply tenant isolation to all leaves routes
router.use(tenantIsolation);

// Policy Configurations (HR Admin only)
router.post('/types', rbac(['HR_ADMIN']), configController.createLeaveType);
router.put('/types/:id', rbac(['HR_ADMIN']), configController.updateLeaveType);
router.delete('/types/:id', rbac(['HR_ADMIN']), configController.deleteLeaveType);
router.post('/balances/adjust', rbac(['HR_ADMIN']), configController.adjustLeaveBalance);

// Public Configurations (Accessible by all tenant employees)
router.get('/types', configController.getLeaveTypes);

// Employee Quota Balances
router.get('/balances', requestController.getMyLeaveBalances);
router.get('/balances/employee/:employeeId', requestController.getEmployeeLeaveBalances);

// Requests Workflow
router.post('/apply', requestController.applyLeave);
router.get('/my-requests', requestController.getMyLeaveRequests);
router.post('/requests/:id/cancel', requestController.cancelLeaveRequest);

// Approvals Workflow
router.get('/pending', requestController.getPendingLeaveRequests);
router.post('/requests/:id/review', requestController.reviewLeaveRequest);

export default router;
