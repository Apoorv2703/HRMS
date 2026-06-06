import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    annualEntitlement: {
      type: Number,
      required: true,
      default: 12,
    },
    allowHalfDay: {
      type: Boolean,
      default: true,
    },
    allowNegativeBalance: {
      type: Boolean,
      default: false,
    },
    carryForwardLimit: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique name and code per tenant
leaveTypeSchema.index({ tenantId: 1, name: 1 }, { unique: true });
leaveTypeSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export default mongoose.model('LeaveType', leaveTypeSchema);
