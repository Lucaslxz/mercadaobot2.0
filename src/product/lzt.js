/**
 * Integração com o LZT Market (Simplificada)
 */
const axios = require('axios');
const config = require('../../config'); // Caminho corrigido
const { logger } = require('../utils/helpers');
const { Product } = require('../models');
const cache = require('../utils/cache');

// Chave de cache para produtos
const CACHE_KEY_PRODUCTS = 'products:lzt';
const CACHE_TTL = 300; // 5 minutos

// Cliente API LZT simplificado
class LZTClient {
  constructor() {
    this.apiKey = config.lzt.apiKey;
    this.baseUrl = config.lzt.baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'X-API-KEY': this.apiKey
      }
    });
  }

  /**
   * Faz uma requisição para a API
   * @param {string} method - Método HTTP
   * @param {string} endpoint - Endpoint da API
   * @param {Object} data - Dados da requisição
   * @returns {Promise<Object>} - Resposta da API
   */
  async request(method, endpoint, data = {}, retries = 3) {
    try {
      const response = await this.client({
        method,
        url: endpoint,
        data: method !== 'get' ? data : undefined,
        params: method === 'get' ? data : undefined
      });

      return response.data;
    } catch (error) {
      if (retries > 0 && this._shouldRetry(error)) {
        logger.warn(`Erro na requisição LZT, tentando novamente... (${retries} tentativas restantes)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.request(method, endpoint, data, retries - 1);
      }

      logger.error(`Erro na requisição LZT: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Determina se deve tentar novamente
   * @private
   */
  _shouldRetry(error) {
    if (!error.response) return true;
    return error.response.status === 429 || error.response.status >= 500;
  }

  /**
   * Busca produtos disponíveis
   * @param {Object} filters - Filtros para busca
   * @returns {Promise<Array>} - Lista de produtos
   */
  async getProducts(filters = {}) {
    return this.request('get', '/products', filters);
  }

  /**
   * Busca detalhes de um produto
   * @param {string} productId - ID do produto
   * @returns {Promise<Object>} - Detalhes do produto
   */
  async getProductDetails(productId) {
    return this.request('get', `/products/${productId}`);
  }
}

// Instância do cliente
const lztClient = new LZTClient();

/**
 * Sincroniza produtos do LZT Market
 * @returns {Promise<Object>} - Resultado da sincronização
 */
async function syncProducts() {
  try {
    logger.info('Iniciando sincronização com LZT Market...');

    // Buscar produtos disponíveis no LZT
    const lztProducts = await lztClient.getProducts({
      status: 'available',
      limit: 100
    });

    if (!lztProducts || !lztProducts.data || !Array.isArray(lztProducts.data)) {
      logger.error('Formato inválido na resposta do LZT Market');
      return {
        success: false,
        message: 'Formato de resposta inválido',
        added: 0,
        updated: 0,
        errors: 1
      };
    }

    let added = 0;
    let updated = 0;
    let errors = 0;

    // Processar produtos
    for (const lztProduct of lztProducts.data) {
      try {
        // Verificar se o produto já existe
        const existingProduct = await Product.findOne({
          where: {
            origem: 'LZT',
            origemId: lztProduct.id
          }
        });

        if (existingProduct) {
          // Atualizar produto existente
          await existingProduct.update({
            nome: lztProduct.title || `Conta ${lztProduct.type || 'Valorant'}`,
            preco: lztProduct.price || 0,
            descricao: lztProduct.description || '',
            disponivel: lztProduct.status === 'available',
            detalhes: lztProduct.details || {},
            imagens: lztProduct.images || []
          });

          updated++;
        } else {
          // Criar novo produto
          await Product.create({
            nome: lztProduct.title || `Conta ${lztProduct.type || 'Valorant'}`,
            tipo: lztProduct.type || 'valorant',
            preco: lztProduct.price || 0,
            descricao: lztProduct.description || '',
            detalhes: lztProduct.details || {},
            disponivel: lztProduct.status === 'available',
            origem: 'LZT',
            origemId: lztProduct.id,
            imagens: lztProduct.images || []
          });

          added++;
        }
      } catch (error) {
        logger.error(`Erro ao processar produto LZT:`, error);
        errors++;
      }
    }

    // Invalidar cache
    await cache.del(CACHE_KEY_PRODUCTS);

    logger.info(`Sincronização concluída: ${added} adicionados, ${updated} atualizados, ${errors} erros`);

    return {
      success: true,
      added,
      updated,
      errors
    };
  } catch (error) {
    logger.error('Erro ao sincronizar com LZT Market:', error);
    return {
      success: false,
      message: error.message,
      added: 0,
      updated: 0,
      errors: 1
    };
  }
}

module.exports = {
  client: lztClient,
  syncProducts
};
