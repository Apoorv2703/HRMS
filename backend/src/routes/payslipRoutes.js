import express from 'express';
import * as payslipController from '../controllers/payslipController.js';
import tenantIsolation from '../middleware/tenantIsolation.js';
import rbac from '../middleware/rbac.js';

const router = express.Router();

// Apply tenant isolation globally for all payslip paths
router.use(tenantIsolation);

// HR Admin only: generate/publish a monthly payslip
router.post('/', rbac(['HR_ADMIN']), payslipController.generatePayslip);

// Employee Self-Service: retrieve own payslips list
router.get('/mine', payslipController.getMyPayslips);

// Fetch all payslips for a specific employee
router.get('/employee/:employeeId', payslipController.getPayslipsByEmployee);

// Fetch specific payslip details (internally validates ownership or supervisor authorization)
router.get('/:id', payslipController.getPayslipDetails);

export default router;
