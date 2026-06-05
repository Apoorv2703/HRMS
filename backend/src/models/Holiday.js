import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      default: 'All', // e.g. 'All', 'HQ', 'Remote' or specific office branch name
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate holidays on the same date/location per tenant
holidaySchema.index({ tenantId: 1, date: 1, location: 1 }, { unique: true });

export default mongoose.model('Holiday', holidaySchema);
