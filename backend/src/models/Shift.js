import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema(
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
    startTime: {
      type: String,
      required: true, // e.g. "09:00"
      trim: true,
    },
    endTime: {
      type: String,
      required: true, // e.g. "17:00"
      trim: true,
    },
    gracePeriodMins: {
      type: Number,
      default: 15, // grace period in minutes before being marked late
    },
    halfDayThresholdMins: {
      type: Number,
      default: 240, // minimum work duration in minutes required to qualify for half-day
    },
    weeklyOffs: {
      type: [Number],
      default: [0, 6], // Array of numbers representing Sunday (0) to Saturday (6)
    },
  },
  {
    timestamps: true,
  }
);

// A shift name must be unique per tenant
shiftSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default mongoose.model('Shift', shiftSchema);
