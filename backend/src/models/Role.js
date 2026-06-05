import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
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
    permissions: {
      type: [String],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique role names within a tenant workspace
roleSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.model('Role', roleSchema);
