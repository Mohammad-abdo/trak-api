import mongoose from 'mongoose';

const rideRequestSchema = new mongoose.Schema({
  riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  datetime: {
    type: Date,
    default: Date.now
  },
  isSchedule: {
    type: Boolean,
    default: false
  },
  scheduleDatetime: {
    type: Date
  },
  rideAttempt: {
    type: Number,
    default: 0
  },
  distanceUnit: {
    type: String,
    enum: ['km', 'mile'],
    default: 'km'
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  surgeAmount: {
    type: Number,
    default: 0
  },
  subtotal: {
    type: Number,
    default: 0
  },
  extraChargesAmount: {
    type: Number,
    default: 0
  },
  startLatitude: {
    type: Number,
    required: true
  },
  startLongitude: {
    type: Number,
    required: true
  },
  endLatitude: {
    type: Number,
    required: true
  },
  endLongitude: {
    type: Number,
    required: true
  },
  startAddress: {
    type: String,
    required: true
  },
  endAddress: {
    type: String,
    required: true
  },
  distance: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  seatCount: {
    type: Number,
    default: 1
  },
  reason: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  internalNote: {
    type: String
  },
  driverNote: {
    type: String
  },
  rideHasBid: {
    type: Boolean,
    default: false
  },
  baseFare: {
    type: Number,
    default: 0
  },
  minimumFare: {
    type: Number,
    default: 0
  },
  baseDistance: {
    type: Number,
    default: 0
  },
  perDistance: {
    type: Number,
    default: 0
  },
  perDistanceCharge: {
    type: Number,
    default: 0
  },
  perMinuteDrive: {
    type: Number,
    default: 0
  },
  perMinuteDriveCharge: {
    type: Number,
    default: 0
  },
  paymentType: {
    type: String,
    enum: ['cash', 'wallet', 'card'],
    default: 'cash'
  },
  extraCharges: [{
    name: String,
    amount: Number
  }],
  tips: {
    type: Number,
    default: 0
  },
  cancelBy: {
    type: String,
    enum: ['rider', 'driver', 'admin']
  },
  cancelationCharges: {
    type: Number,
    default: 0
  },
  couponDiscount: {
    type: Number,
    default: 0
  },
  couponCode: {
    type: String
  },
  couponData: {
    type: mongoose.Schema.Types.Mixed
  },
  otp: {
    type: String
  },
  waitingTimeLimit: {
    type: Number,
    default: 0
  },
  waitingTime: {
    type: Number,
    default: 0
  },
  perMinuteWaiting: {
    type: Number,
    default: 0
  },
  perMinuteWaitingCharge: {
    type: Number,
    default: 0
  },
  cancelledDriverIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  nearbyDriverIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  rejectedBidDriverIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  serviceData: {
    type: mongoose.Schema.Types.Mixed
  },
  maxTimeForFindDriverForRideRequest: {
    type: Number,
    default: 300 // 5 minutes in seconds
  },
  isRiderRated: {
    type: Boolean,
    default: false
  },
  isDriverRated: {
    type: Boolean,
    default: false
  },
  riderequestInDriverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  riderequestInDatetime: {
    type: Date
  },
  isRideForOther: {
    type: Boolean,
    default: false
  },
  otherRiderData: {
    type: mongoose.Schema.Types.Mixed
  },
  dropLocation: [{
    latitude: Number,
    longitude: Number,
    address: String
  }],
  datetimeUtc: {
    type: Date
  },
  multiDropLocation: [{
    latitude: Number,
    longitude: Number,
    address: String
  }],
  surcharge: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  smsType: {
    type: String
  },
  tripType: {
    type: String,
    enum: ['normal', 'airport', 'zone'],
    default: 'normal'
  },
  flightNumber: {
    type: String
  },
  pickupPoint: {
    type: String
  },
  preferredPickupTime: {
    type: Date
  },
  preferredDropoffTime: {
    type: Date
  },
  airportPickup: {
    type: Boolean,
    default: false
  },
  airportDropoff: {
    type: Boolean,
    default: false
  },
  zonePickup: {
    type: Boolean,
    default: false
  },
  zoneDropoff: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
rideRequestSchema.index({ riderId: 1, status: 1 });
rideRequestSchema.index({ driverId: 1, status: 1 });
rideRequestSchema.index({ status: 1 });
rideRequestSchema.index({ createdAt: -1 });

export default mongoose.model('RideRequest', rideRequestSchema);



