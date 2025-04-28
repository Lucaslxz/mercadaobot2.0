/**
 * Cliente para API do LZT Market
 */

const axios = require('axios');
const crypto = require('crypto');
const config = require('../../config');
const { logger } = require('../../utils/helpers');

class LZTMarketClient {
  constructor() {
    this.apiKey = config.lzt.apiKey;
    this.apiSecret = config.lzt.apiSecret;
    this.baseUrl = config.lzt.baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000 // 30 segundos
    });
  }

  /**
   * Assina a requisição com as credenciais da API
   * @private
   */
  _signRequest(method, endpoint, data = {}, timestamp = Date.now()) {
    // Formato: METHOD|endpoint|timestamp|payload
    const payload = `${method.toUpperCase()}|${endpoint}|${timestamp}|${JSON.stringify(data)}`;

    // Gerar assinatura usando o secret
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');

    return {
      'X-API-KEY': this.apiKey,
      'X-API-SIGNATURE': signature,
      'X-API-TIMESTAMP': timestamp
    };
  }

  /**
   * Faz uma requisição para a API com retry automático
   * @param {string} method - Método HTTP
   * @param {string} endpoint - Endpoint da API
   * @param {Object} data - Dados da requisição
   * @returns {Promise<Object>} - Resposta da API
   */
  async request(method, endpoint, data = {}, retries = 3) {
    try {
      const timestamp = Date.now();
      const headers = this._signRequest(method, endpoint, data, timestamp);

      const response = await this.client({
        method,
        url: endpoint,
        data: method !== 'get' ? data : undefined,
        params: method === 'get' ? data : undefined,
        headers
      });

      return response.data;
    } catch (error) {
      // Verificar se deve tentar novamente
      if (retries > 0 && this._shouldRetry(error)) {
        logger.warn(`Erro na requisição LZT (${method} ${endpoint}), tentando novamente... (${retries} tentativas restantes)`);

        // Delay exponencial
        const delay = Math.pow(2, 4 - retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        // Tentar novamente
        return this.request(method, endpoint, data, retries - 1);
      }

      logger.error(`Erro na requisição LZT: ${method.toUpperCase()} ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Determina se deve tentar novamente baseado no erro
   * @private
   */
  _shouldRetry(error) {
    // Retry em erros de rede ou timeout
    if (!error.response) {
      return true;
    }

    // Retry em erros 5xx (servidor) ou 429 (rate limit)
    const status = error.response.status;
    return status === 429 || status >= 500;
  }

  /**
   * Busca produtos disponíveis
   * @param {Object} filters - Filtros para busca
   * @returns {Promise<Array>} - Lista de produtos
   */
  async getProducts(filters = {}) {
    return await this.request('get', '/products', filters);
  }

  /**
   * Busca detalhes de um produto
   * @param {string} productId - ID do produto no LZT Market
   * @returns {Promise<Object>} - Detalhes do produto
   */
  async getProductDetails(productId) {
    return await this.request('get', `/products/${productId}`);
  }

  /**
   * Reserva um produto para compra
   * @param {string} productId - ID do produto no LZT Market
   * @returns {Promise<Object>} - Dados da reserva
   */
  async reserveProduct(productId) {
    return await this.request('post', `/products/${productId}/reserve`, {});
  }

  /**
   * Finaliza a compra de um produto reservado
   * @param {string} reservationId - ID da reserva
   * @param {Object} paymentData - Dados do pagamento
   * @returns {Promise<Object>} - Status da compra
   */
  async purchaseProduct(reservationId, paymentData) {
    return await this.request('post', `/reservations/${reservationId}/purchase`, paymentData);
  }

  /**
   * Cancela uma reserva
   * @param {string} reservationId - ID da reserva
   * @returns {Promise<Object>} - Status do cancelamento
   */
  async cancelReservation(reservationId) {
    return await this.request('post', `/reservations/${reservationId}/cancel`, {});
  }
}

// Exportar instância única
module.exports = new LZTMarketClient();
