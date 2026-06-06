import mongoose from 'mongoose';

const approvalInstanceSchema = new mongoose.Schema(
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
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    currentLevel: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'ESCALATED'],
      default: 'PENDING',
    },
    activeApproverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    activeSlaDeadline: {
      type: Date,
      required: true,
    },
    compiledApprovers: [
      {
        level: { type: Number, required: true },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        status: {
          type: String,
          enum: ['PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'],
          default: 'PENDING',
        },
        actedAt: { type: Date },
        comment: { type: String, default: '' },
        delegatedFromUserId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
      }
    ],
    history: [
      {
        actedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
        action: {
          type: String,
          required: true,
        }, // e.g. SUBMIT, APPROVE, REJECT, ESCALATE, DELEGATE
        timestamp: {
          type: Date,
          default: Date.now,
        },
        comment: { type: String, default: '' },
      }
    ],
  },
  {
    timestamps: true,
  }
);

approvalInstanceSchema.index({ tenantId: 1, activeApproverId: 1, status: 1 });
approvalInstanceSchema.index({ tenantId: 1, requestId: 1 }, { unique: true });

export default mongoose.model('ApprovalInstance', approvalInstanceSchema);
