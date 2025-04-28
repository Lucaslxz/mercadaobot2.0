/**
 * Utilitário para conexão e operações com o banco de dados
 */
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { logger } = require('./helpers');

// Caminho para o arquivo de banco de dados
const dbPath = path.join(process.cwd(), process.env.DB_FILENAME || 'database.sqlite');

// Verificar se o diretório existe, se não, criar
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Criar instância do Sequelize
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: process.env.NODE_ENV === 'development' ? msg => logger.debug(msg) : false,
  define: {
    timestamps: true,
    underscored: false,
    freezeTableName: false,
    charset: 'utf8',
    dialectOptions: {
      collate: 'utf8_general_ci'
    }
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

/**
 * Estabelece conexão com o banco de dados
 * @returns {Promise<Sequelize>} Instância do Sequelize
 */
async function connect() {
  try {
    await sequelize.authenticate();
    logger.info('Conexão com o banco de dados estabelecida com sucesso');
    return sequelize;
  } catch (error) {
    logger.error('Falha ao conectar ao banco de dados:', error);
    throw error;
  }
}

/**
 * Tenta conectar ao banco de dados com retry automático
 * @param {number} maxRetries - Número máximo de tentativas
 * @returns {Promise<Sequelize>} Instância do Sequelize
 */
async function connectWithRetry(maxRetries = 3) {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      return await connect();
    } catch (error) {
      retries++;
      logger.warn(`Tentativa ${retries}/${maxRetries} falhou. Tentando novamente em 5s...`);

      if (retries >= maxRetries) {
        logger.error('Número máximo de tentativas excedido');
        throw error;
      }

      // Aguardar antes da próxima tentativa
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Inicializa o banco de dados, cria tabelas se não existirem
 * @param {boolean} force - Se true, recria todas as tabelas (CUIDADO: apaga dados)
 * @param {boolean} alter - Se true, atualiza tabelas existentes conforme modelos
 * @returns {Promise<Sequelize>} Instância do Sequelize
 */
async function initDatabase(force = false, alter = true) {
  try {
    await connectWithRetry();
    logger.info(`Sincronizando modelos com o banco de dados... (force: ${force}, alter: ${alter})`);

    // Importar modelos
    const models = require('../models');

    // Sincronizar modelos com o banco
    await sequelize.sync({ force, alter });
    logger.info('Banco de dados inicializado com sucesso');

    // Verificar se é necessário criar dados iniciais
    if (force) {
      await createInitialData();
    }

    return sequelize;
  } catch (error) {
    logger.error('Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

/**
 * Criar dados iniciais quando o banco for recriado
 * @returns {Promise<void>}
 */
async function createInitialData() {
  try {
    logger.info('Criando dados iniciais...');

    // Importar modelos
    const { User, Product, Promotion } = require('../models');

    // Verificar se já existe administrador
    const adminExists = await User.findOne({ where: { username: 'admin' } });

    if (!adminExists) {
      // Criar usuário admin
      await User.create({
        userId: 'admin',
        username: 'admin',
        isAdmin: true,
        createdAt: new Date()
      });

      logger.info('Usuário administrador criado com sucesso');
    }

    // Criar produtos de exemplo se necessário
    const productsCount = await Product.count();

    if (productsCount === 0) {
      // Produtos de exemplo
      const exampleProducts = [
        {
          nome: 'Conta Valorant - Bronze',
          tipo: 'valorant',
          preco: 35.90,
          descricao: 'Conta Valorant Rank Bronze com 10 skins básicas.',
          detalhes: {
            rank: 'Bronze',
            skins: 10,
            region: 'BR',
            level: 25,
            verification: true
          },
          disponivel: true,
          origem: 'MANUAL'
        },
        {
          nome: 'Conta Valorant - Prata',
          tipo: 'valorant',
          preco: 59.90,
          descricao: 'Conta Valorant Rank Prata com 15 skins.',
          detalhes: {
            rank: 'Prata',
            skins: 15,
            region: 'BR',
            level: 40,
            verification: true
          },
          disponivel: true,
          origem: 'MANUAL'
        }
      ];

      for (const product of exampleProducts) {
        await Product.create(product);
      }

      logger.info(`${exampleProducts.length} produtos de exemplo criados com sucesso`);
    }

    // Criar promoção de exemplo
    const promoExists = await Promotion.count();

    if (promoExists === 0) {
      // Calcular datas
      const now = new Date();
      const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

      await Promotion.create({
        titulo: 'Promoção de Boas-Vindas',
        descricao: 'Desconto especial para novos usuários! 10% OFF em qualquer produto.',
        tipo: 'season',
        desconto: 10,
        dataInicio: now,
        dataFim: nextWeek,
        duracao: 168, // 7 dias em horas
        ativa: true,
        criadoPor: 'admin'
      });

      logger.info('Promoção de exemplo criada com sucesso');
    }

    logger.info('Dados iniciais criados com sucesso');
  } catch (error) {
    logger.error('Erro ao criar dados iniciais:', error);
    throw error;
  }
}

/**
 * Desconecta do banco de dados
 * @returns {Promise<void>}
 */
async function disconnect() {
  try {
    if (sequelize) {
      await sequelize.close();
      logger.info('Desconectado do banco de dados com sucesso');
    }
  } catch (error) {
    logger.error('Erro ao desconectar do banco de dados:', error);
    throw error;
  }
}

/**
 * Realiza backup do banco de dados
 * @returns {Promise<string>} - Caminho do arquivo de backup
 */
async function backupDatabase() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups');
    const backupPath = path.join(backupDir, `database-${timestamp}.sqlite`);

    // Criar diretório de backup se não existir
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Copiar arquivo de banco de dados
    fs.copyFileSync(dbPath, backupPath);

    // Limitar número de backups
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('database-') && file.endsWith('.sqlite'))
      .sort((a, b) => b.localeCompare(a));

    // Manter apenas os últimos 7 backups
    const maxBackups = 7;
    if (backupFiles.length > maxBackups) {
      for (let i = maxBackups; i < backupFiles.length; i++) {
        fs.unlinkSync(path.join(backupDir, backupFiles[i]));
      }
    }

    logger.info(`Backup criado com sucesso: ${backupPath}`);
    return backupPath;
  } catch (error) {
    logger.error('Erro ao realizar backup do banco de dados:', error);
    throw error;
  }
}

module.exports = {
  sequelize,
  connect,
  connectWithRetry,
  initDatabase,
  disconnect,
  backupDatabase
};
