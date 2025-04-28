/**
 * Modelos Sequelize centralizados para o sistema
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/db');

// Modelo de Usuário
const User = sequelize.define('User', {
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: DataTypes.STRING,
  isBlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  blockReason: DataTypes.STRING,
  blockedBy: DataTypes.STRING,
  blockDate: DataTypes.DATE,
  preferences: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  lastActive: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Modelo de Produto
const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nome: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tipo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  preco: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  descricao: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  detalhes: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  disponivel: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  vendido: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  dataVenda: DataTypes.DATE,
  visualizacoes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  compradoPor: DataTypes.STRING,
  criadoPor: DataTypes.STRING,
  origem: {
    type: DataTypes.STRING,
    defaultValue: 'MANUAL'
  },
  origemId: DataTypes.STRING,
  imagens: {
    type: DataTypes.JSON,
    defaultValue: []
  }
});

// Modelo de Pagamento
const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  userName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Products',
      key: 'id'
    }
  },
  productName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  method: {
    type: DataTypes.STRING,
    defaultValue: 'PIX'
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED', 'EXPIRED'),
    defaultValue: 'PENDING'
  },
  pixCode: DataTypes.STRING,
  qrCodeUrl: DataTypes.STRING,
  expiresAt: DataTypes.DATE,
  completedAt: DataTypes.DATE,
  approvedBy: DataTypes.STRING,
  rejectedAt: DataTypes.DATE,
  rejectionReason: DataTypes.STRING,
  rejectedBy: DataTypes.STRING,
  deliveryData: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
});

// Modelo de Promoção
const Promotion = sequelize.define('Promotion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  titulo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  descricao: DataTypes.TEXT,
  tipo: {
    type: DataTypes.ENUM('flash', 'season', 'combo', 'limited'),
    allowNull: false
  },
  desconto: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 1,
      max: 90
    }
  },
  dataInicio: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  dataFim: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duracao: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ativa: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  criadoPor: DataTypes.STRING,
  produtos: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  categorias: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  codigoPromo: DataTypes.STRING,
  usoLimitado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  limiteUsos: DataTypes.INTEGER,
  imageUrl: DataTypes.STRING
});

// Modelo de Log de Auditoria
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('USER', 'PRODUCT', 'TRANSACTION', 'SECURITY', 'SYSTEM', 'INTEGRATION', 'MARKETING', 'SUPPORT'),
    allowNull: false
  },
  severity: {
    type: DataTypes.ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL'),
    defaultValue: 'INFO'
  },
  status: {
    type: DataTypes.ENUM('SUCCESS', 'ERROR', 'INFO', 'BLOCKED'),
    defaultValue: 'SUCCESS'
  },
  userId: DataTypes.STRING,
  targetId: DataTypes.STRING,
  details: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  ip: DataTypes.STRING,
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  retentionDate: DataTypes.DATE
});

// Modelo de Atividade do Usuário
const Activity = sequelize.define('Activity', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  data: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

// Modelo de Pontos de Fidelidade
const Loyalty = sequelize.define('Loyalty', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  userName: DataTypes.STRING,
  totalPoints: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lifetimePoints: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  transactions: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

// Modelo de Ticket
const Ticket = sequelize.define('Ticket', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  channelId: {
    type: DataTypes.STRING,
    unique: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  subject: DataTypes.STRING,
  status: {
    type: DataTypes.ENUM('OPEN', 'CLOSED', 'ARCHIVED'),
    defaultValue: 'OPEN'
  },
  closedBy: DataTypes.STRING,
  closedAt: DataTypes.DATE,
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

// Configurar relações entre modelos
// User -> Activity (1:N)
User.hasMany(Activity, { foreignKey: 'userId' });
Activity.belongsTo(User, { foreignKey: 'userId', targetKey: 'userId' });

// User -> Loyalty (1:1)
User.hasOne(Loyalty, { foreignKey: 'userId' });
Loyalty.belongsTo(User, { foreignKey: 'userId', targetKey: 'userId' });

// User -> Payment (1:N)
User.hasMany(Payment, { foreignKey: 'userId' });
Payment.belongsTo(User, { foreignKey: 'userId', targetKey: 'userId' });

// Product -> Payment (1:N)
Product.hasMany(Payment, { foreignKey: 'productId' });
Payment.belongsTo(Product, { foreignKey: 'productId' });

// User -> Ticket (1:N)
User.hasMany(Ticket, { foreignKey: 'userId' });
Ticket.belongsTo(User, { foreignKey: 'userId', targetKey: 'userId' });

// Exportar modelos
module.exports = {
  User,
  Product,
  Payment,
  Promotion,
  AuditLog,
  Activity,
  Loyalty,
  Ticket
};
