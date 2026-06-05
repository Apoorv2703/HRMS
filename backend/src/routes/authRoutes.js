import express from 'express';
import * as authController from '../controllers/authController.js';
import tenantIsolation from '../middleware/tenantIsolation.js';

const router = express.Router();

// Public authentication paths
router.post('/register-tenant', authController.registerTenant);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/reset-expired-password', authController.resetExpiredPassword);
router.post('/verify-mfa', authController.verifyMfa);
router.post('/google/callback', authController.googleLogin);
router.post('/microsoft/callback', authController.microsoftLogin);
router.post('/saml/callback', authController.samlCallback);

// Protected session paths
router.get('/sessions', tenantIsolation, authController.getSessions);
router.post('/mfa/setup', tenantIsolation, authController.setupMfa);
router.post('/mfa/enable', tenantIsolation, authController.enableMfa);

export default router;
