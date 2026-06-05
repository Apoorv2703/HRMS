import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    subdomain: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    domain: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    settings: {
      mfaRequired: {
        type: Boolean,
        default: false,
      },
      passwordPolicy: {
        minLength: {
          type: Number,
          default: 8,
        },
        requireSpecial: {
          type: Boolean,
          default: true,
        },
        requireNumbers: {
          type: Boolean,
          default: true,
        },
        requireUppercase: {
          type: Boolean,
          default: true,
        },
        lockoutAttempts: {
          type: Number,
          default: 5,
        },
        lockoutDurationMinutes: {
          type: Number,
          default: 15,
        },
        passwordExpiryDays: {
          type: Number,
          default: 90,
        },
      },
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

export default mongoose.model('Tenant', tenantSchema);
