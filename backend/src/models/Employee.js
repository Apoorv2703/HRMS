import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true }, // e.g. OFFER_LETTER, AADHAAR, PAN, SSN
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const employeeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    employeeId: {
      type: String,
      required: true,
      trim: true,
    },
    personal: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      dob: { type: Date },
      avatarUrl: { type: String, trim: true },
      gender: { type: String, trim: true },
      contactNumber: { type: String, trim: true },
      personalEmail: { type: String, trim: true, lowercase: true },
      maritalStatus: { type: String, trim: true },
      nationality: { type: String, trim: true },
      currentAddress: { type: String, trim: true },
      permanentAddress: { type: String, trim: true },
      emergencyContact: {
        name: { type: String, trim: true },
        relationship: { type: String, trim: true },
        phone: { type: String, trim: true },
      },
    },
    professional: {
      education: [
        {
          institution: { type: String, trim: true },
          degree: { type: String, trim: true },
          fieldOfStudy: { type: String, trim: true },
          startYear: { type: String, trim: true },
          endYear: { type: String, trim: true },
        }
      ],
      experience: [
        {
          company: { type: String, trim: true },
          designation: { type: String, trim: true },
          startDate: { type: Date },
          endDate: { type: Date },
          description: { type: String, trim: true },
        }
      ],
      skills: [{ type: String, trim: true }],
      certifications: [
        {
          name: { type: String, trim: true },
          issuer: { type: String, trim: true },
          issueDate: { type: Date },
          expiryDate: { type: Date },
          credentialId: { type: String, trim: true },
        }
      ],
    },
    employment: {
      joiningDate: { type: Date, default: Date.now },
      status: {
        type: String,
        enum: ['PROBATION', 'ACTIVE', 'SUSPENDED', 'EXITED'],
        default: 'PROBATION',
      },
      reportingManagerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null,
      },
      department: { type: String, trim: true },
      designation: { type: String, trim: true },
      location: { type: String, trim: true },
      grade: { type: String, trim: true },
      assignedShift: { type: String, trim: true, default: '' },
      shiftId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shift',
        default: null,
      },
      employmentType: {
        type: String,
        enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
        default: 'FULL_TIME',
      },
      exitDate: { type: Date, default: null },
      exitReason: { type: String, trim: true, default: null },
    },
    bankDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      bankName: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      pan: { type: String, trim: true },
    },
    statutory: {
      uan: { type: String, trim: true }, // Unified Account Number (India PF)
      pfNumber: { type: String, trim: true },
      esiNumber: { type: String, trim: true },
      ssn: { type: String, trim: true }, // Social Security Number (US)
    },
    documents: [documentSchema],
    pendingChanges: {
      data: { type: mongoose.Schema.Types.Mixed, default: null },
      requestedAt: { type: Date, default: null },
      status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
      },
    },
    inviteCode: {
      type: String,
      default: null,
    },
    inviteExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Employee ID must be unique per tenant
employeeSchema.index({ tenantId: 1, employeeId: 1 }, { unique: true });
// User ID must be unique per tenant
employeeSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
employeeSchema.index({ tenantId: 1, 'employment.reportingManagerId': 1 });
employeeSchema.index({ tenantId: 1, 'employment.status': 1 });

// Mongoose Middlewares to block physical deletions (strict delete blocks)
const blockDeletion = function (next) {
  next(new Error('Physical deletion of employee records is prohibited. Update employment status to EXITED and record exit details instead.'));
};

employeeSchema.pre('remove', blockDeletion);
employeeSchema.pre('deleteOne', blockDeletion);
employeeSchema.pre('deleteMany', blockDeletion);
employeeSchema.pre('findOneAndDelete', blockDeletion);

export default mongoose.model('Employee', employeeSchema);
