import mongoose from 'mongoose';

const leaveBalanceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    leaveTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveType',
      required: true,
    },
    allocated: {
      type: Number,
      required: true,
      default: 0,
    },
    used: {
      type: Number,
      required: true,
      default: 0,
    },
    pendingApproval: {
      type: Number,
      required: true,
      default: 0,
    },
    carriedForward: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce one balance row per employee per leave type per tenant
leaveBalanceSchema.index({ tenantId: 1, employeeId: 1, leaveTypeId: 1 }, { unique: true });

export default mongoose.model('LeaveBalance', leaveBalanceSchema);
