import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  baseFare: {
    type: Number,
    required: true,
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
  waitingTimeLimit: {
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
  seatCount: {
    type: Number,
    default: 4
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  icon: {
    type: String
  },
  image: {
    type: String
  },
  regionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region'
  }
}, {
  timestamps: true
});

export default mongoose.model('Service', serviceSchema);



