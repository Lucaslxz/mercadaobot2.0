const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Schema para promoções e descontos no sistema
 */
const PromotionSchema = new Schema({
  // Informações básicas
  titulo: {
    type: String,
    required: true
  },
  descricao: {
    type: String
  },
  tipo: {
    type: String,
    enum: ['flash', 'season', 'combo', 'limited'],
    required: true
  },

  // Detalhes do desconto
  desconto: {
    type: Number,
    required: true,
    min: [1, 'Desconto deve ser no mínimo 1%'],
    max: [90, 'Desconto não pode exceder 90%']
  },

  // Período de validade
  dataInicio: {
    type: Date,
    default: Date.now,
    required: true
  },
  dataFim: {
    type: Date,
    required: true
  },
  duracao: {
    type: Number, // em horas
    required: true
  },

  // Status da promoção
  ativa: {
    type: Boolean,
    default: true
  },

  // Informações adicionais
  criadoPor: {
    type: String
  },

  // Escopo da promoção
  produtos: [{
    type: Schema.Types.ObjectId,
    ref: 'Product'
  }],
  categorias: [{
    type: String
  }],

  // Código promocional (opcional)
  codigoPromo: {
    type: String
  },

  // Limites de uso
  usoLimitado: {
    type: Boolean,
    default: false
  },
  limiteUsos: {
    type: Number
  },

  // Imagem da promoção (opcional)
  imageUrl: {
    type: String
  }
}, {
  timestamps: true
});

// Índices para otimização de consultas
PromotionSchema.index({ dataInicio: 1, dataFim: 1, ativa: 1 });
PromotionSchema.index({ codigoPromo: 1 }, { sparse: true });

module.exports = mongoose.model('Promotion', PromotionSchema);
