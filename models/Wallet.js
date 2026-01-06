import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  }
}, {
  timestamps: true
});

const walletHistorySchema = new mongoose.Schema({
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  balance: {
    type: Number,
    required: true
  },
  description: {
    type: String
  },
  transactionType: {
    type: String,
    enum: ['ride_payment', 'withdrawal', 'refund', 'reward', 'admin_adjustment'],
    required: true
  },
  rideRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RideRequest'
  }
}, {
  timestamps: true
});

export const Wallet = mongoose.model('Wallet', walletSchema);
export const WalletHistory = mongoose.model('WalletHistory', walletHistorySchema);



