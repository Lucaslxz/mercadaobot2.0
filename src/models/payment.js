const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const config = require('../config');

/**
 * Schema de pagamento para transações no sistema de vendas
 */
const PaymentSchema = new Schema({
  // Identificação do usuário
  userId: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },

  // Detalhes do produto
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },

  // Informações financeiras
  amount: {
    type: Number,
    required: true,
    min: [0, 'Valor do pagamento não pode ser negativo']
  },
  method: {
    type: String,
    enum: ['PIX', 'MANUAL', 'CREDIT_CARD', 'CRYPTO'],
    default: 'PIX'
  },

  // Status do pagamento
  status: {
    type: String,
    enum: [
      'PENDING',     // Aguardando pagamento
      'PROCESSING',  // Em processamento
      'COMPLETED',   // Pagamento confirmado
      'FAILED',      // Falha no pagamento
      'REFUNDED',    // Reembolsado
      'CANCELLED',   // Cancelado
      'EXPIRED'      // Expirado
    ],
    default: 'PENDING',
    index: true
  },

  // Detalhes de PIX
  pixCode: {
    type: String
  },
  qrCodeUrl: {
    type: String
  },

  // Timestamps de eventos
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + config.payment.expiration * 1000)
  },
  completedAt: {
    type: Date
  },

  // Informações de aprovação/rejeição
  approvedBy: {
    type: String
  },
  rejectedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  rejectedBy: {
    type: String
  },

  // Informações de entrega
  deliveryData: {
    type: Schema.Types.Mixed
  },

  // Metadados opcionais
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
