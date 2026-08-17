import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    passwordHash: {
      type: String,
      required: true
    },

    // ── Profile ───────────────────────────────────────
    avatar: {
      type: String,
      default: null
    },

    phone: {
      type: String,
      default: null,
      trim: true
    },

    // ── Authorization ─────────────────────────────────
    role: {
      type: String,
      enum: ['organizer', 'admin'],
      default: 'organizer'
    },

    isActive: {
      type: Boolean,
      default: true
    },

    // ── Tracking ──────────────────────────────────────
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true    // createdAt + updatedAt
  }
);

// Never return passwordHash in JSON responses
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return {
    id: obj._id,
    name: obj.name,
    email: obj.email,
    avatar: obj.avatar,
    phone: obj.phone,
    role: obj.role,
    isActive: obj.isActive,
    lastLoginAt: obj.lastLoginAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

export default mongoose.model('User', userSchema);