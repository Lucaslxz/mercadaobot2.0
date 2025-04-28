/**
 * Configurações centralizadas do sistema
 * Versão otimizada para sistema de painéis interativos
 */
require('dotenv').config();

module.exports = {
  // Configurações do Discord
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID,
    prefix: '/',
    adminRoles: ['Admin', 'Moderador'],
    adminUsers: process.env.ADMIN_USERS ? process.env.ADMIN_USERS.split(',') : [],
    status: 'Mercadão das Contas | Digite /menu',
    channels: {
      store: process.env.CHANNEL_STORE || 'loja',
      admin: process.env.CHANNEL_ADMIN || 'admin',
      payments: process.env.CHANNEL_PAYMENTS || 'pagamentos',
      support: process.env.CHANNEL_SUPPORT || 'suporte',
      announcements: process.env.CHANNEL_ANNOUNCEMENTS || 'anuncios',
      welcome: process.env.CHANNEL_WELCOME || 'bem-vindo'
    },
    categories: {
      store: process.env.CATEGORY_STORE || 'Loja',
      admin: process.env.CATEGORY_ADMIN || 'Administração',
      support: process.env.CATEGORY_SUPPORT || 'Suporte',
      tickets: process.env.CATEGORY_TICKETS || 'Tickets'
    },
    embedColors: {
      primary: '#4F46E5',
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6'
    },
    panels: {
      refreshInterval: 600000, // 10 minutos
      itemsPerPage: 5,
      maxCartItems: 10,
      timeout: 1800000, // 30 minutos para expirar painel inativo
      interactions: {
        mainPanel: 'main',
        storePanel: 'store',
        adminPanel: 'admin',
        cartPanel: 'cart',
        profilePanel: 'profile',
        paymentPanel: 'payment',
        supportPanel: 'support',
        helpPanel: 'help'
      }
    }
  },

  // Configurações do banco de dados
  database: {
    filename: 'database.sqlite',
    backupInterval: 86400000, // 24 horas
    maxBackups: 7,
    logQueries: process.env.NODE_ENV === 'development'
  },

  // Configurações Redis
  redis: {
    uri: process.env.REDIS_URI || 'redis://localhost:6379',
    enabled: process.env.USE_REDIS === 'true',
    prefix: 'mercadao:',
    defaultTTL: 3600 // 1 hora
  },

  // Configurações LZT Market
  lzt: {
    apiKey: process.env.LZT_API_KEY,
    apiSecret: process.env.LZT_API_SECRET,
    baseUrl: process.env.LZT_API_URL || 'https://api.lzt.market/v1',
    syncInterval: 900000, // 15 minutos
    enabled: process.env.LZT_ENABLED === 'true'
  },

  // Configurações de pagamento
  payment: {
    pix: {
      keyType: process.env.PIX_KEY_TYPE || 'random',
      keyValue: process.env.PIX_KEY,
      provider: process.env.PIX_PROVIDER || '99pay',
      manualApproval: process.env.MANUAL_APPROVAL !== 'false',
      beneficiaryName: process.env.PIX_BENEFICIARY_NAME || 'Mercadão das Contas',
      city: process.env.PIX_CITY || 'São Paulo'
    },
    expiration: parseInt(process.env.PAYMENT_EXPIRATION || '1800'),
    minimumAmount: parseFloat(process.env.MINIMUM_AMOUNT || '5.00'),
    notificationEmail: process.env.NOTIFICATION_EMAIL,
    notificationDiscord: process.env.NOTIFICATION_DISCORD_WEBHOOK
  },

  // Configurações do sistema de auditoria
  audit: {
    enabled: true,
    logLevels: ['info', 'warning', 'error', 'critical'],
    retentionPeriod: {
      critical: 157680000, // 5 anos
      error: 63072000,     // 2 anos
      warning: 31536000,   // 1 ano
      info: 15768000       // 6 meses
    }
  },

  // Configurações do sistema de marketing
  marketing: {
    promotionTypes: ['flash', 'season', 'combo', 'limited'],
    discountLimits: {
      max: 50,
      min: 5
    },
    loyaltyPoints: {
      conversionRate: 0.01,
      expirationDays: 90,
      bonusForRegistration: 100
    }
  },

  // Configurações do sistema de carrinho
  cart: {
    timeoutMinutes: 30,
    maxItems: 10,
    cleanupInterval: 3600000 // 1 hora
  },

  // Configurações do assistente virtual
  assistant: {
    enabled: true,
    cacheTTL: 3600,
    maxSuggestions: 3,
    dmEnabled: true,
    reportUnknownQuestions: true
  },

  // Configurações do sistema de tickets
  tickets: {
    maxActivePerUser: 3,
    autoCloseAfterDays: 3,
    archiveAfterClose: true,
    categoryName: 'Tickets'
  },

  // Configurações do sistema de suporte
  support: {
    staffRoleIds: process.env.SUPPORT_STAFF_ROLES ? process.env.SUPPORT_STAFF_ROLES.split(',') : [],
    categoryId: process.env.SUPPORT_CATEGORY_ID,
    pingRoleId: process.env.SUPPORT_PING_ROLE,
    archiveTickets: true,
    maxActiveTickets: 50
  },

  // Configurações do sistema anti-fraude
  antifraud: {
    enabled: true,
    maxFailedPayments: 3,
    maxAccountsPerIp: 5,
    suspiciousIpCountries: process.env.SUSPICIOUS_COUNTRIES ? process.env.SUSPICIOUS_COUNTRIES.split(',') : []
  },

  // Configurações do sistema de notificações
  notifications: {
    enabled: true,
    paymentApproval: true,
    newSales: true,
    supportRequests: true
  }
};
