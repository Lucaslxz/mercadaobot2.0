/**
 * Bot de Vendas para Discord
 * Sistema otimizado com foco em interações por painéis visuais
 * Mercadão das Contas - v1.0.0
 */

// Carregar variáveis de ambiente
require('dotenv').config();

// Importações da biblioteca Discord.js
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  Collection
} = require('discord.js');

// Importações do sistema interno
const config = require('./config');
const { logger } = require('./src/utils/helpers');
const db = require('./src/utils/db');
const cache = require('./src/utils/cache');

// Importação do sistema de painéis e eventos
const panelSystem = require('./src/core/PanelSystem');
const eventHandler = require('./src/core/EventHandler');

// Inicializar cliente Discord com as permissões necessárias
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember
  ],
  allowedMentions: {
    parse: ['users', 'roles'],
    repliedUser: true
  }
});

// Registrar coleções para uso global
client.commands = new Collection();
client.cooldowns = new Collection();
client.activeMenus = new Collection();

/**
 * Função principal de inicialização
 */
async function main() {
  try {
    logger.info('=== INICIANDO BOT DE VENDAS DISCORD ===');
    logger.info(`Versão do Node.js: ${process.version}`);
    logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);

    // Conectar e inicializar banco de dados
    logger.info('Conectando ao banco de dados...');
    await db.connectWithRetry(3);
    await db.initDatabase(false, true);
    logger.info('Banco de dados inicializado com sucesso');

    // Inicializar sistema de cache
    logger.info('Inicializando sistema de cache...');
    await cache.initCache();
    logger.info('Sistema de cache inicializado');

    // Registrar painéis no sistema central
    logger.info('Registrando painéis interativos...');
    registerPanels();
    logger.info('Painéis registrados com sucesso');

    // Configurar manipuladores de eventos
    logger.info('Configurando manipuladores de eventos...');
    eventHandler.setupEvents(client);
    logger.info('Eventos configurados com sucesso');

    // Login no Discord
    logger.info('Conectando ao Discord...');
    const token = process.env.DISCORD_TOKEN || config.discord.token;

    if (!token) {
      throw new Error('Token do Discord não encontrado. Configure a variável DISCORD_TOKEN no arquivo .env');
    }

    await client.login(token);
    logger.info(`Bot conectado com sucesso como ${client.user.tag}`);

    // Configurar presença
    client.user.setPresence({
      activities: [{
        name: config.discord.status || '/menu | Mercadão das Contas',
        type: ActivityType.Playing
      }],
      status: 'online'
    });

    // Configurar backup automático do banco de dados
    if (config.database.backupInterval > 0) {
      setInterval(async () => {
        try {
          const backupPath = await db.backupDatabase();
          logger.info(`Backup automático criado em: ${backupPath}`);
        } catch (error) {
          logger.error('Erro ao criar backup automático:', error);
        }
      }, config.database.backupInterval);
    }

    // Exportar client para uso em outros módulos
    module.exports.client = client;

    logger.info('===== INICIALIZAÇÃO CONCLUÍDA =====');
  } catch (error) {
    logger.error('Erro crítico durante inicialização:', error);
    logger.error(error.stack);

    // Tentar desconectar graciosamente antes de sair
    try {
      if (client.isReady()) {
        await client.destroy();
      }
      await db.disconnect();
    } catch (cleanupError) {
      logger.error('Erro durante limpeza de recursos:', cleanupError);
    }

    process.exit(1);
  }
}

/**
 * Registra os painéis no sistema central
 */
function registerPanels() {
  try {
    // Importar os painéis principais
    const mainPanel = require('./src/interfaces/MainPanel');
    const storePanel = require('./src/interfaces/StorePanel');
    const adminPanel = require('./src/interfaces/AdminPanel');

    // Registrar painéis principais
    panelSystem.registerPanel('main', mainPanel);
    panelSystem.registerPanel('store', storePanel);
    panelSystem.registerPanel('admin', adminPanel);

    // Mapear interações aos painéis principais
    panelSystem.mapInteractions(['main_', 'menu_'], 'main');
    panelSystem.mapInteractions(['store_', 'product_'], 'store');
    panelSystem.mapInteractions(['admin_', 'approval_'], 'admin');

    // Tentar carregar os painéis adicionais individualmente
    const availablePanels = {
      profile: false,
      cart: false,
      payment: false,
      support: false
    };

    // Tentar carregar o painel de perfil
    try {
      const profilePanel = require('./src/interfaces/ProfilePanel');
      panelSystem.registerPanel('profile', profilePanel);
      availablePanels.profile = true;
      logger.info('Painel profile registrado com sucesso');
    } catch (e) {
      logger.warn(`Painel profile não pôde ser carregado: ${e.message}`);
    }

    // Tentar carregar o painel de carrinho
    try {
      const cartPanel = require('./src/interfaces/CartPanel');
      panelSystem.registerPanel('cart', cartPanel);
      availablePanels.cart = true;
      logger.info('Painel cart registrado com sucesso');
    } catch (e) {
      logger.warn(`Painel cart não pôde ser carregado: ${e.message}`);
    }

    // Tentar carregar o painel de pagamento
    try {
      const paymentPanel = require('./src/interfaces/PaymentPanel');
      panelSystem.registerPanel('payment', paymentPanel);
      availablePanels.payment = true;
      logger.info('Painel payment registrado com sucesso');
    } catch (e) {
      logger.warn(`Painel payment não pôde ser carregado: ${e.message}`);
    }

    // Tentar carregar o painel de suporte
    try {
      const supportPanel = require('./src/interfaces/SupportPanel');
      panelSystem.registerPanel('support', supportPanel);
      availablePanels.support = true;
      logger.info('Painel support registrado com sucesso');
    } catch (e) {
      logger.warn(`Painel support não pôde ser carregado: ${e.message}`);
    }

    // Mapear interações apenas para os painéis disponíveis
    if (availablePanels.profile) {
      panelSystem.mapInteractions(['profile_', 'user_'], 'profile');
    }
    if (availablePanels.cart) {
      panelSystem.mapInteractions(['cart_', 'checkout_'], 'cart');
    }
    if (availablePanels.payment) {
      panelSystem.mapInteractions(['payment_', 'pix_'], 'payment');
    }
    if (availablePanels.support) {
      panelSystem.mapInteractions(['support_', 'ticket_'], 'support');
    }
  } catch (error) {
    logger.error('Erro ao registrar painéis:', error);
    throw error;
  }
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
  logger.error('Erro não tratado (unhandledRejection):', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Exceção não capturada (uncaughtException):', error);

  // Em casos graves, pode ser melhor reiniciar o bot
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    logger.error('Erro de conexão crítico, reiniciando em 5 segundos...');
    setTimeout(() => {
      process.exit(1); // O process manager (PM2, etc) irá reiniciar o processo
    }, 5000);
  }
});

// Desligamento controlado
process.on('SIGINT', async () => {
  logger.info('Recebido sinal SIGINT, iniciando desligamento controlado...');

  // Timeout para encerramento forçado
  const forceExitTimeout = setTimeout(() => {
    logger.error('Desligamento controlado excedeu o tempo limite. Forçando saída.');
    process.exit(1);
  }, 30000); // 30 segundos máximo

  try {
    // Desconectar cliente Discord
    if (client && client.isReady()) {
      logger.info('Desconectando cliente Discord...');
      await client.destroy();
      logger.info('Cliente Discord desconectado com sucesso');
    }

    // Fechar conexão com banco de dados
    logger.info('Fechando conexão com banco de dados...');
    await db.disconnect();
    logger.info('Conexão com banco de dados encerrada com sucesso');

    // Limpar timeout de encerramento forçado
    clearTimeout(forceExitTimeout);

    logger.info('Desligamento controlado concluído, saindo...');
    process.exit(0);
  } catch (error) {
    logger.error('Erro durante o desligamento controlado:', error);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
});

// Iniciar o sistema
main();
