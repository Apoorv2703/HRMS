import Notification from '../models/Notification.js';
import NotificationPreference from '../models/NotificationPreference.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';

/**
 * Dispatch a notification across selected channels, respecting user preference settings.
 * Security/Critical events bypass user configurations and enforce delivery.
 */
export const sendNotification = async (tenantId, userId, eventType, details = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.warn(`[NotificationService] Target user ${userId} not found.`);
      return null;
    }

    // Load or initialize default user settings
    let preferences = await NotificationPreference.findOne({ tenantId, userId });
    if (!preferences) {
      preferences = new NotificationPreference({
        tenantId,
        userId,
        email: true,
        inApp: true,
        push: true,
      });
      await preferences.save();
    }

    // Standardize template content
    let title = 'System Alert';
    let message = 'A system event has occurred.';
    let link = '';

    const requesterName = details.requesterName || 'An employee';
    const dateRange = details.dateRange || 'selected dates';
    const date = details.date || 'selected date';
    const days = details.days || '0';
    const approverName = details.approverName || 'your manager';
    const securityReason = details.securityReason || 'security audit update';

    switch (eventType) {
      case 'LEAVE_SUBMITTED':
        title = 'New Leave Request';
        message = `${requesterName} submitted a leave request for ${dateRange} (${days} days).`;
        link = '/leaves';
        break;

      case 'LEAVE_APPROVED':
        title = 'Leave Request Approved';
        message = `Your leave request for ${dateRange} has been approved by ${approverName}.`;
        link = '/leaves';
        break;

      case 'LEAVE_REJECTED':
        title = 'Leave Request Rejected';
        message = `Your leave request for ${dateRange} was rejected by ${approverName}.`;
        link = '/leaves';
        break;

      case 'REGULARIZATION_SUBMITTED':
        title = 'New Regularization Request';
        message = `${requesterName} requested punch correction for ${date}.`;
        link = '/muster';
        break;

      case 'REGULARIZATION_APPROVED':
        title = 'Regularization Request Approved';
        message = `Your regularization request for ${date} has been approved.`;
        link = '/muster';
        break;

      case 'REGULARIZATION_REJECTED':
        title = 'Regularization Request Rejected';
        message = `Your regularization request for ${date} was rejected.`;
        link = '/muster';
        break;

      case 'SLA_BREACH':
        title = 'Approvals Escalation Warning';
        message = `Request from ${requesterName} has breached SLA timeline and is escalated to you.`;
        link = '/leaves';
        break;

      case 'MISSED_PUNCH':
        title = 'Missed Punch Alert';
        message = `It looks like you forgot to clock out for your shift on ${date}.`;
        link = '/muster';
        break;

      case 'CRITICAL_SECURITY':
        title = 'Security Alert';
        message = `Security Alert: ${securityReason}`;
        break;

      default:
        title = details.title || title;
        message = details.message || message;
        link = details.link || link;
        break;
    }

    const isCritical = eventType === 'CRITICAL_SECURITY';

    // 1. In-App Notification channel
    if (preferences.inApp || isCritical) {
      const notification = new Notification({
        tenantId,
        userId,
        title,
        message,
        type: eventType,
        link,
        isRead: false,
      });
      await notification.save();
      console.log(`[NotificationService] Saved in-app alert for user ${userId}: "${title}"`);
    }

    // 2. Email Notification channel (Mock SMTP handler)
    if (preferences.email || isCritical) {
      console.log(`[EMAIL MOCK] Dispatching email to <${user.email}>:
-------------------------------------------------------
Subject: ${title}
Message: ${message}
Action Link: ${link ? `http://localhost:5173${link}` : 'N/A'}
-------------------------------------------------------`);
    }

    // 3. Push Notification channel (Mock Push handler)
    if (preferences.push || isCritical) {
      console.log(`[PUSH MOCK] Sending push alert to device registered under user ${userId}: [${title}] -> ${message}`);
    }

    return { title, message };
  } catch (err) {
    console.error('[NotificationService] Error executing sendNotification:', err);
    throw err;
  }
};
