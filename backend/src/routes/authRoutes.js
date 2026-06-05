const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const tenantIsolation = require('../middleware/tenantIsolation');

// Public authentication paths
router.post('/register-tenant', authController.registerTenant);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);

// Protected session paths
router.get('/sessions', tenantIsolation, authController.getSessions);

module.exports = router;
