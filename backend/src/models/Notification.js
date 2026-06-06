import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      required: true,
    }, // e.g. LEAVE_SUBMITTED, LEAVE_APPROVED, SLA_BREACH, REGULARIZATION_SUBMITTED, etc.
    link: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ tenantId: 1, userId: 1, isRead: 1 });

export default mongoose.model('Notification', notificationSchema);
