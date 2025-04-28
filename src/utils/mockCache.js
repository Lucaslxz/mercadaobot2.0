/**
 * Implementação de cache em memória para desenvolvimento e fallback
 */
const { logger } = require('./helpers');

// Armazenamento em memória
const mockStorage = new Map();
const timeouts = new Map();

/**
 * Inicializa o cache mock
 * @returns {Promise<Object>} Cliente mock
 */
async function initCache() {
  logger.info('Mock cache inicializado (armazenamento em memória)');
  return {
    get,
    set,
    del,
    clear,
    keys
  };
}

/**
 * Obtém valor do cache
 * @param {string} key - Chave para busca
 * @returns {Promise<any>} - Valor armazenado ou null
 */
async function get(key) {
  return mockStorage.get(key) || null;
}

/**
 * Armazena valor no cache
 * @param {string} key - Chave para armazenamento
 * @param {any} value - Valor a ser armazenado
 * @param {number} ttl - Tempo de vida em segundos
 * @returns {Promise<boolean>} Status da operação
 */
async function set(key, value, ttl = 3600) {
  mockStorage.set(key, value);

  // Simular expiração
  if (ttl > 0) {
    // Limpar timeout anterior se existir
    if (timeouts.has(key)) {
      clearTimeout(timeouts.get(key));
    }

    // Definir novo timeout
    const timeout = setTimeout(() => {
      mockStorage.delete(key);
      timeouts.delete(key);
      logger.debug(`Cache expirado para chave: ${key}`);
    }, ttl * 1000);

    timeouts.set(key, timeout);
  }

  return true;
}

/**
 * Remove valor do cache
 * @param {string} key - Chave para remoção
 * @returns {Promise<boolean>} Status da operação
 */
async function del(key) {
  // Limpar timeout se existir
  if (timeouts.has(key)) {
    clearTimeout(timeouts.get(key));
    timeouts.delete(key);
  }

  return mockStorage.delete(key);
}

/**
 * Limpa todo o cache
 * @returns {Promise<boolean>} Status da operação
 */
async function clear() {
  // Limpar todos os timeouts
  for (const timeout of timeouts.values()) {
    clearTimeout(timeout);
  }

  mockStorage.clear();
  timeouts.clear();

  logger.debug('Cache em memória limpo');
  return true;
}

/**
 * Busca chaves por padrão
 * @param {string} pattern - Padrão para busca
 * @returns {Promise<Array>} Lista de chaves
 */
async function keys(pattern) {
  if (!pattern || pattern === '*') {
    return Array.from(mockStorage.keys());
  }

  // Implementação básica de busca por padrão
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  return Array.from(mockStorage.keys()).filter(key => regex.test(key));
}

module.exports = {
  initCache,
  get,
  set,
  del,
  clear,
  keys,
  client: () => ({
    isReady: true,
    get,
    set,
    setEx: async (key, ttl, value) => set(key, value, ttl),
    del,
    flushAll: clear,
    keys
  })
};
