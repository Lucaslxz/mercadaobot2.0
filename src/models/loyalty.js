const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Schema para transações de pontos de fidelidade
 */
const LoyaltyTransactionSchema = new Schema({
  amount: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    enum: ['PURCHASE', 'REDEEM', 'BONUS', 'EXPIRATION', 'REFERRAL', 'GIFT'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'USED', 'EXPIRED'],
    default: 'ACTIVE'
  },
  relatedProductId: {
    type: Schema.Types.ObjectId,
    ref: 'Product'
  },
  relatedPaymentId: {
    type: Schema.Types.ObjectId,
    ref: 'Payment'
  },
  actionBy: {
    type: String
  }
}, { _id: true });

/**
 * Schema principal para o sistema de fidelidade
 */
const LoyaltySchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userName: {
    type: String
  },
  totalPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  lifetimePoints: {
    type: Number,
    default: 0,
    min: 0
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  transactions: [LoyaltyTransactionSchema],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Métodos virtuais
LoyaltySchema.virtual('activePoints').get(function() {
  return this.transactions
    .filter(tx => tx.status === 'ACTIVE' && tx.expiresAt > new Date())
    .reduce((sum, tx) => sum + tx.amount, 0);
});

// Índice para pesquisas frequentes
LoyaltySchema.index({ userId: 1 });
LoyaltySchema.index({ level: 1 });

module.exports = mongoose.model('Loyalty', LoyaltySchema);
