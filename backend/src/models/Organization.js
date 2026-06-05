import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
    },
    locations: [
      {
        name: { type: String, required: true, trim: true },
        address: { type: String, trim: true },
        code: { type: String, trim: true },
      },
    ],
    departments: [
      {
        name: { type: String, required: true, trim: true },
        code: { type: String, required: true, trim: true },
      },
    ],
    grades: [
      {
        name: { type: String, required: true, trim: true },
        level: { type: Number },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index on tenantId for quick configuration retrieval
organizationSchema.index({ tenantId: 1 });

export default mongoose.model('Organization', organizationSchema);
