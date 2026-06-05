const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  ip: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'LEADERSHIP'],
      default: 'EMPLOYEE',
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockoutUntil: {
      type: Date,
      default: null,
    },
    sessions: [sessionSchema],
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure email is unique per tenant
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password helper
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Check if locked helper
userSchema.methods.isLocked = function () {
  return !!(this.lockoutUntil && this.lockoutUntil > Date.now());
};

module.exports = mongoose.model('User', userSchema);
