/**
 * Utilitário para cache utilizando Redis com fallback para memória local
 */
const config = require('../../config'); // Caminho corrigido
const { logger } = require('./helpers');

let redisClient = null;
let mockCache = null;
let usingMockCache = false;

/**
 * Inicializa o cliente Redis ou fallback
 * @returns {Promise} - Promessa da inicialização
 */
async function initCache() {
  try {
    // Se já existe cliente e está pronto, retorna
    if (redisClient && redisClient.isReady) {
      return redisClient;
    }

    // Verificar se Redis está habilitado
    if (!config.redis || !config.redis.enabled) {
      logger.info('Redis desativado nas configurações. Usando cache em memória.');
      usingMockCache = true;
      return initMockCache();
    }

    try {
      // Importação dinâmica para não quebrar se o Redis não estiver instalado
      const Redis = require('redis');

      // Criar novo cliente Redis
      redisClient = Redis.createClient({
        url: config.redis.uri
      });

      // Configurar eventos
      redisClient.on('error', (error) => {
        logger.error('Erro no Redis:', error);
        // Fallback para mock em caso de erro
        if (!usingMockCache) {
          logger.info('Alternando para mock cache após erro Redis');
          usingMockCache = true;
          initMockCache();
        }
      });

      redisClient.on('connect', () => {
        logger.info('Conexão com Redis estabelecida');
      });

      // Conectar cliente
      await redisClient.connect();
      return redisClient;
    } catch (error) {
      logger.error('Erro ao inicializar cache Redis:', error);
      // Fallback para mock
      logger.info('Usando mock cache como fallback');
      usingMockCache = true;
      return initMockCache();
    }
  } catch (error) {
    logger.error('Erro ao inicializar cache:', error);
    // Fallback para mock
    logger.info('Usando cache em memória como último recurso');
    usingMockCache = true;
    return createInMemoryCache();
  }
}

/**
 * Inicializa cache mock em memória
 * @returns {Object} - Cliente mock
 */
function initMockCache() {
  mockCache = createInMemoryCache();
  logger.info('Mock cache inicializado (armazenamento em memória)');
  return mockCache;
}

/**
 * Cria um cache em memória simples
 * @returns {Object} - Cliente mock
 */
function createInMemoryCache() {
  const storage = new Map();
  const timeouts = new Map();

  return {
    get: async (key) => storage.get(key) || null,
    set: async (key, value, ttl = 3600) => {
      storage.set(key, value);
      if (ttl > 0) {
        if (timeouts.has(key)) clearTimeout(timeouts.get(key));
        timeouts.set(key, setTimeout(() => storage.delete(key), ttl * 1000));
      }
      return true;
    },
    del: async (key) => {
      if (timeouts.has(key)) clearTimeout(timeouts.get(key));
      return storage.delete(key);
    },
    clear: async () => {
      timeouts.forEach(t => clearTimeout(t));
      timeouts.clear();
      storage.clear();
      return true;
    },
    keys: async (pattern) => {
      return Array.from(storage.keys()).filter(k =>
        pattern ? k.includes(pattern.replace('*', '')) : true
      );
    },
    isReady: true
  };
}

/**
 * Obtém valor do cache
 * @param {string} key - Chave para busca
 * @returns {Promise<any>} - Valor armazenado ou null
 */
async function get(key) {
  try {
    if (usingMockCache) {
      return mockCache ? await mockCache.get(key) : null;
    }

    if (!redisClient || !redisClient.isReady) {
      await initCache();
    }

    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Erro ao obter valor do cache para chave ${key}:`, error);
    return null;
  }
}

/**
 * Armazena valor no cache
 * @param {string} key - Chave para armazenamento
 * @param {any} value - Valor a ser armazenado
 * @param {number} ttl - Tempo de vida em segundos
 * @returns {Promise<boolean>} - Status da operação
 */
async function set(key, value, ttl = 3600) {
  try {
    if (usingMockCache) {
      return mockCache ? await mockCache.set(key, value, ttl) : false;
    }

    if (!redisClient || !redisClient.isReady) {
      await initCache();
    }

    const stringValue = JSON.stringify(value);

    if (ttl > 0) {
      await redisClient.setEx(key, ttl, stringValue);
    } else {
      await redisClient.set(key, stringValue);
    }
    return true;
  } catch (error) {
    logger.error(`Erro ao armazenar valor no cache para chave ${key}:`, error);
    return false;
  }
}

/**
 * Remove valor do cache
 * @param {string} key - Chave para remoção
 * @returns {Promise<boolean>} - Status da operação
 */
async function del(key) {
  try {
    if (usingMockCache) {
      return mockCache ? await mockCache.del(key) : false;
    }

    if (!redisClient || !redisClient.isReady) {
      await initCache();
    }

    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error(`Erro ao remover valor do cache para chave ${key}:`, error);
    return false;
  }
}

/**
 * Limpa todo o cache
 * @returns {Promise<boolean>} - Status da operação
 */
async function clear() {
  try {
    if (usingMockCache) {
      return mockCache ? await mockCache.clear() : false;
    }

    if (!redisClient || !redisClient.isReady) {
      await initCache();
    }

    await redisClient.flushAll();
    logger.info('Cache limpo com sucesso');
    return true;
  } catch (error) {
    logger.error('Erro ao limpar cache:', error);
    return false;
  }
}

/**
 * Busca chaves por padrão
 * @param {string} pattern - Padrão para busca
 * @returns {Promise<Array>} - Lista de chaves
 */
async function keys(pattern) {
  try {
    if (usingMockCache) {
      return mockCache ? await mockCache.keys(pattern) : [];
    }

    if (!redisClient || !redisClient.isReady) {
      await initCache();
    }

    return await redisClient.keys(pattern);
  } catch (error) {
    logger.error(`Erro ao obter chaves com padrão ${pattern}:`, error);
    return [];
  }
}

module.exports = {
  initCache,
  get,
  set,
  del,
  clear,
  keys,
  client: () => redisClient || mockCache
};
