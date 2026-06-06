import mongoose from 'mongoose';

const punchSchema = new mongoose.Schema({
  time: {
    type: Date,
    required: true,
    default: Date.now,
  },
  type: {
    type: String,
    enum: ['IN', 'OUT'],
    required: true,
  },
  ip: {
    type: String,
    trim: true,
  },
  location: {
    lat: { type: Number },
    lng: { type: Number },
  },
});

const attendanceRecordSchema = new mongoose.Schema(
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
    date: {
      type: String, // format: YYYY-MM-DD
      required: true,
    },
    punches: [punchSchema],
    status: {
      type: String,
      enum: ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'WEEKLY_OFF', 'HOLIDAY', 'REGULARIZED', 'SHORT_LEAVE'],
      default: 'PRESENT',
    },
    totalWorkMinutes: {
      type: Number,
      default: 0,
    },
    overtimeMinutes: {
      type: Number,
      default: 0,
    },
    regularization: {
      requestedTimeIn: { type: Date },
      requestedTimeOut: { type: Date },
      reason: { type: String, trim: true },
      status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
      },
      approverComment: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: one attendance record per employee per day
attendanceRecordSchema.index({ tenantId: 1, employeeId: 1, date: 1 }, { unique: true });
// Common queries index
attendanceRecordSchema.index({ tenantId: 1, date: 1 });
attendanceRecordSchema.index({ tenantId: 1, employeeId: 1, status: 1 });

export default mongoose.model('AttendanceRecord', attendanceRecordSchema);
