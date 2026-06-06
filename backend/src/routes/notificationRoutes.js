import express from 'express';
import * as notificationController from '../controllers/notificationController.js';
import tenantIsolation from '../middleware/tenantIsolation.js';

const router = express.Router();

// Apply tenant isolation globally to all notification paths
router.use(tenantIsolation);

router.get('/', notificationController.getMyNotifications);
router.put('/:id/read', notificationController.markAsRead);
router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', notificationController.updatePreferences);

export default router;
