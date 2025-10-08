const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: String,
    enum: ['basic', 'premium', 'enterprise'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'expired', 'canceled'],
    default: 'pending'
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  bankTransferId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankTransfer'
  },
  paymentMethod: {
    type: String,
    default: 'bank_transfer'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// تحديث updatedAt قبل الحفظ
SubscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);