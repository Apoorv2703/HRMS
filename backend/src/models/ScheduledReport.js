import mongoose from 'mongoose';

const scheduledReportSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportType: {
      type: String,
      enum: ['headcount', 'attendance', 'leaves', 'late-absent', 'overtime', 'attrition'],
      required: true,
    },
    frequency: { type: String, enum: ['DAILY', 'WEEKLY', 'MONTHLY'], required: true },
    recipients: [{ type: String, required: true }],
    filters: {
      department: { type: String, default: '' },
      location: { type: String, default: '' },
    },
    isActive: { type: Boolean, default: true },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

scheduledReportSchema.index({ tenantId: 1, userId: 1 });

export default mongoose.model('ScheduledReport', scheduledReportSchema);
