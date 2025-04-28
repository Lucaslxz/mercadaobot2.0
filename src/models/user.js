const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema para preferências do usuário
const PreferenceSchema = new Schema({
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  categories: [{ type: String }],
  priceRange: [{ type: Number }], // [min, max]
  notifications: { type: Boolean, default: true }
});

// Schema para histórico de atividades
const ActivitySchema = new Schema({
  action: {
    type: String,
    required: true
  },
  timestamp: { type: Date, default: Date.now },
  data: { type: Schema.Types.Mixed }
});

// Schema principal do usuário
const UserSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  email: { type: String },
  preferences: { type: PreferenceSchema, default: () => ({}) },
  isBlocked: { type: Boolean, default: false },
  blockReason: { type: String },
  blockedBy: { type: String },
  blockDate: { type: Date },
  activities: [ActivitySchema],
  lastActive: { type: Date, default: Date.now }
});

// Índices para melhor performance
UserSchema.index({ userId: 1 }, { unique: true });
UserSchema.index({ 'activities.timestamp': -1 });
UserSchema.index({ lastActive: -1 });
UserSchema.index({ isBlocked: 1 });

module.exports = mongoose.model('User', UserSchema);
