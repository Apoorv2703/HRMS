import mongoose from 'mongoose';

const employeeShiftScheduleSchema = new mongoose.Schema(
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
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: enforce one shift schedule per employee per date per tenant
employeeShiftScheduleSchema.index({ tenantId: 1, employeeId: 1, date: 1 }, { unique: true });
// Common query index for muster lookup
employeeShiftScheduleSchema.index({ tenantId: 1, date: 1 });

export default mongoose.model('EmployeeShiftSchedule', employeeShiftScheduleSchema);
