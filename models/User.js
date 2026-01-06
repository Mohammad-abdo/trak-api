import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.loginType || this.loginType === 'email';
    }
  },
  countryCode: {
    type: String,
    default: '+1'
  },
  contactNumber: {
    type: String,
    required: true,
    unique: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  address: {
    type: String
  },
  userType: {
    type: String,
    enum: ['admin', 'rider', 'driver', 'fleet'],
    required: true
  },
  playerId: {
    type: String
  },
  fcmToken: {
    type: String
  },
  fleetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  latitude: {
    type: Number
  },
  longitude: {
    type: Number
  },
  currentHeading: {
    type: Number
  },
  lastNotificationSeen: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'pending'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: false
  },
  uid: {
    type: String
  },
  loginType: {
    type: String,
    enum: ['email', 'google', 'facebook', 'apple'],
    default: 'email'
  },
  displayName: {
    type: String
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  isVerifiedDriver: {
    type: Boolean,
    default: false
  },
  lastLocationUpdateAt: {
    type: Date
  },
  otpVerifyAt: {
    type: Date
  },
  lastActivedAt: {
    type: Date
  },
  appVersion: {
    type: String
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  partnerReferralCode: {
    type: String
  },
  emailVerifiedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Generate referral code for riders and drivers
  if (!this.referralCode && ['rider', 'driver'].includes(this.userType)) {
    this.referralCode = await this.generateUniqueReferralCode();
  }
  
  next();
});

// Generate unique referral code
userSchema.methods.generateUniqueReferralCode = async function() {
  const generateCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };
  
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    code = generateCode();
    const existing = await mongoose.model('User').findOne({ referralCode: code });
    if (!existing) isUnique = true;
  }
  
  return code;
};

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ contactNumber: 1 });
userSchema.index({ userType: 1, status: 1 });
userSchema.index({ latitude: 1, longitude: 1 }); // For geospatial queries

export default mongoose.model('User', userSchema);



