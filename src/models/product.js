const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductDetailsSchema = new Schema({
  rank: { type: String },
  skins: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  agents: { type: Number, default: 0 },
  region: { type: String },
  email_changed: { type: Boolean, default: false },
  valorantPoints: { type: Number, default: 0 },
  verification: { type: Boolean, default: true }
}, { _id: false, strict: false });

const ProductSchema = new Schema({
  nome: {
    type: String,
    required: true,
    trim: true
  },
  tipo: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  preco: {
    type: Number,
    required: true,
    min: [0, 'Preço não pode ser negativo']
  },
  descricao: {
    type: String,
    required: true
  },
  detalhes: {
    type: ProductDetailsSchema,
    default: () => ({})
  },
  disponivel: {
    type: Boolean,
    default: true,
    index: true
  },
  vendido: {
    type: Boolean,
    default: false,
    index: true
  },
  dataCriacao: {
    type: Date,
    default: Date.now,
    index: true
  },
  dataVenda: {
    type: Date
  },
  ultimaAtualizacao: {
    type: Date,
    default: Date.now
  },
  visualizacoes: {
    type: Number,
    default: 0
  },
  compradoPor: {
    type: String
  },
  criadoPor: {
    type: String
  },
  origem: {
    type: String,
    enum: ['MANUAL', 'LZT', 'API'],
    default: 'MANUAL'
  },
  origemId: {
    type: String
  },
  imagens: [{
    type: String
  }]
}, {
  timestamps: true
});

// Índices para otimização de consultas
ProductSchema.index({
  tipo: 1,
  preco: 1,
  disponivel: 1
});

module.exports = mongoose.model('Product', ProductSchema);
