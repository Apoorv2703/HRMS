import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';

// Retrieve notifications list for logged-in user
export const getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      tenantId: req.tenantId,
      userId: req.user.id,
    }).sort({ createdAt: -1 }).limit(100);

    return res.status(200).json(notifications);
  } catch (err) {
    next(err);
  }
};

// Mark a specific notification as read
export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({
      tenantId: req.tenantId,
      userId: req.user.id,
      _id: id,
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification alert not found.' });
    }

    notification.isRead = true;
    await notification.save();

    return res.status(200).json({ message: 'Notification marked as read.', notification });
  } catch (err) {
    next(err);
  }
};

// Fetch user notification channel preferences
export const getPreferences = async (req, res, next) => {
  try {
    let preferences = await NotificationPreference.findOne({
      tenantId: req.tenantId,
      userId: req.user.id,
    });

    if (!preferences) {
      preferences = new NotificationPreference({
        tenantId: req.tenantId,
        userId: req.user.id,
      });
      await preferences.save();
    }

    return res.status(200).json(preferences);
  } catch (err) {
    next(err);
  }
};

// Update user notification channel preferences
export const updatePreferences = async (req, res, next) => {
  try {
    const { email, inApp, push, digestEnabled } = req.body;

    let preferences = await NotificationPreference.findOne({
      tenantId: req.tenantId,
      userId: req.user.id,
    });

    if (!preferences) {
      preferences = new NotificationPreference({
        tenantId: req.tenantId,
        userId: req.user.id,
      });
    }

    if (email !== undefined) preferences.email = !!email;
    if (inApp !== undefined) preferences.inApp = !!inApp;
    if (push !== undefined) preferences.push = !!push;
    if (digestEnabled !== undefined) preferences.digestEnabled = !!digestEnabled;

    await preferences.save();

    return res.status(200).json({ message: 'Preferences updated successfully.', preferences });
  } catch (err) {
    next(err);
  }
};
