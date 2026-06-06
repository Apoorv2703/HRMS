import mongoose from 'mongoose';

const approvalPolicySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    requestType: {
      type: String,
      enum: ['LEAVE', 'REGULARIZATION'],
      required: true,
    },
    steps: [
      {
        level: { type: Number, required: true },
        approverType: {
          type: String,
          enum: ['MANAGER', 'ROLE', 'SPECIFIC_USER'],
          required: true,
        },
        approverRole: {
          type: String,
          enum: ['HR_ADMIN', 'LEADERSHIP', 'MANAGER', 'EMPLOYEE'],
          default: null,
        },
        approverRoleId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Role',
          default: null,
        },
        approverUserId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
      }
    ],
    conditionalRules: [
      {
        field: { type: String }, // e.g. "totalDays"
        operator: { type: String, enum: ['GT', 'LT', 'EQ'] },
        value: { type: mongoose.Schema.Types.Mixed },
        extraStep: {
          approverType: { type: String, enum: ['ROLE', 'SPECIFIC_USER'], required: true },
          approverRole: {
            type: String,
            enum: ['HR_ADMIN', 'LEADERSHIP', 'MANAGER', 'EMPLOYEE'],
            default: null,
          },
          approverRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
          approverUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        }
      }
    ],
    slaHours: {
      type: Number,
      default: 72,
    },
    escalationUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compounded uniqueness on tenant & requestType
approvalPolicySchema.index({ tenantId: 1, requestType: 1 }, { unique: true });

export default mongoose.model('ApprovalPolicy', approvalPolicySchema);
