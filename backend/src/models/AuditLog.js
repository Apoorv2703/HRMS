const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Can be null for anonymous or failed log-ins before user identification
    },
    action: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Disable standard updates on document instance
    versionKey: false,
  }
);

// Compound index for fast audits
auditLogSchema.index({ tenantId: 1, timestamp: -1 });

// Helper to block modifications
const blockMutation = (next) => {
  const err = new Error('Audit logs are immutable and cannot be modified or deleted.');
  next(err);
};

// Hook all Mongoose update and delete methods to throw errors
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return blockMutation(next);
  }
  next();
});

auditLogSchema.pre('updateOne', blockMutation);
auditLogSchema.pre('updateMany', blockMutation);
auditLogSchema.pre('findOneAndUpdate', blockMutation);
auditLogSchema.pre('update', blockMutation);
auditLogSchema.pre('deleteOne', blockMutation);
auditLogSchema.pre('deleteMany', blockMutation);
auditLogSchema.pre('findOneAndDelete', blockMutation);
auditLogSchema.pre('findOneAndRemove', blockMutation);
auditLogSchema.pre('remove', blockMutation);

module.exports = mongoose.model('AuditLog', auditLogSchema);
