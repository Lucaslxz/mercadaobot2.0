const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Schema para log de auditoria no sistema
 */
const AuditLogSchema = new Schema({
  // Informações da ação
  action: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: ['USER', 'PRODUCT', 'TRANSACTION', 'SECURITY', 'SYSTEM', 'INTEGRATION', 'MARKETING', 'SUPPORT'],
    index: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
    default: 'INFO',
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['SUCCESS', 'ERROR', 'INFO', 'BLOCKED'],
    default: 'SUCCESS'
  },

  // Agente da ação (quem executou)
  user: {
    id: { type: String },
    username: { type: String }
  },

  // Alvo da ação (afetado pela ação)
  target: {
    id: { type: String },
    username: { type: String }
  },

  // Objetos relacionados
  product: {
    id: { type: Schema.Types.ObjectId },
    name: { type: String },
    price: { type: Number }
  },
  payment: {
    id: { type: Schema.Types.ObjectId },
    method: { type: String },
    amount: { type: Number }
  },

  // Detalhes adicionais
  details: {
    type: Schema.Types.Mixed
  },

  // Informações de rede
  ip: { type: String },

  // Timestamps automáticos
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Data de retenção (quando o log deve ser deletado)
  retentionDate: {
    type: Date,
    index: true
  }
});

// Índices para consultas frequentes
AuditLogSchema.index({ 'user.id': 1, action: 1 });
AuditLogSchema.index({ category: 1, timestamp: -1 });
AuditLogSchema.index({ retentionDate: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
