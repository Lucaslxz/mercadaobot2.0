/**
 * Sistema de recomendação de produtos com IA
 */
const { logger } = require('../utils/helpers');
const userService = require('../user/profile');
const productService = require('../product/catalog');
const { Product } = require('../models');
const cache = require('../utils/cache');

class RecommendationEngine {
  constructor() {
    this.cacheKey = 'recommendation:';
    this.cacheTTL = 1800; // 30 minutos
  }

  /**
   * Gera recomendações personalizadas para um usuário
   * @param {string} userId - ID do usuário
   * @param {number} limit - Número de recomendações
   * @returns {Promise<Array>} - Produtos recomendados
   */
  async getRecommendationsForUser(userId, limit = 3) {
    try {
      // Verificar cache primeiro
      const cacheKey = `${this.cacheKey}${userId}`;
      const cachedRecommendations = await cache.get(cacheKey);
      if (cachedRecommendations) return cachedRecommendations;

      // Carregar perfil do usuário
      const userProfile = await userService.getUserProfile(userId);
      const userHistory = await userService.getUserHistory(userId);

      if (!userProfile || !userHistory || userHistory.length === 0) {
        // Usuário sem histórico, retornar produtos populares
        const popularProducts = await this._getPopularProducts(limit);
        await cache.set(cacheKey, popularProducts, this.cacheTTL);
        return popularProducts;
      }

      // Extrair dados relevantes
      const viewedProducts = userHistory
        .filter(item => item.action === 'PRODUCT_VIEW')
        .map(item => item.data?.productId)
        .filter(Boolean);

      const purchasedProducts = userHistory
        .filter(item => item.action === 'PRODUCT_PURCHASE')
        .map(item => item.data?.productId)
        .filter(Boolean);

      // Carregar produtos disponíveis
      const availableProducts = await productService.getAvailableProducts();

      // Calcular pontuação para cada produto
      const scoredProducts = [];
      for (const product of availableProducts) {
        // Pular produtos já comprados pelo usuário
        if (purchasedProducts.includes(product.id.toString())) continue;

        const score = this._calculateRecommendationScore(
          product, viewedProducts, purchasedProducts, userProfile.preferences
        );
        scoredProducts.push({ product, score });
      }

      // Ordenar e retornar as melhores recomendações
      const recommendations = scoredProducts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.product);

      // Salvar no cache
      await cache.set(cacheKey, recommendations, this.cacheTTL);
      return recommendations;
    } catch (error) {
      logger.error('Erro ao gerar recomendações:', error);
      return [];
    }
  }

  /**
   * Encontra produtos similares a um produto específico
   * @param {string} productId - ID do produto
   * @param {number} limit - Número de produtos similares
   * @returns {Promise<Array>} - Produtos similares
   */
  async getSimilarProducts(productId, limit = 3) {
    try {
      // Verificar cache primeiro
      const cacheKey = `${this.cacheKey}similar:${productId}`;
      const cachedSimilar = await cache.get(cacheKey);
      if (cachedSimilar) return cachedSimilar;

      // Carregar produto de referência
      const product = await productService.getProductById(productId);
      if (!product) return [];

      // Carregar todos os produtos disponíveis
      const availableProducts = await productService.getAvailableProducts();

      // Calcular similaridade para cada produto
      const similarProducts = [];
      for (const otherProduct of availableProducts) {
        // Pular o próprio produto
        if (otherProduct.id.toString() === productId) continue;

        const similarity = this._calculateProductSimilarity(product, otherProduct);
        similarProducts.push({ product: otherProduct, similarity });
      }

      // Ordenar por similaridade e pegar os top N
      const recommendations = similarProducts
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(item => item.product);

      // Salvar no cache
      await cache.set(cacheKey, recommendations, this.cacheTTL);
      return recommendations;
    } catch (error) {
      logger.error('Erro ao buscar produtos similares:', error);
      return [];
    }
  }

  /**
   * Atualiza o perfil de recomendações do usuário
   * @param {string} userId - ID do usuário
   * @param {string} action - Tipo de ação
   * @param {Object} data - Dados da ação
   */
  async updateUserProfile(userId, action, data) {
    try {
      // Registrar ação no histórico do usuário
      await userService.recordActivity(userId, action, data);
      // Invalidar cache de recomendações para este usuário
      await cache.del(`${this.cacheKey}${userId}`);
      logger.debug(`Perfil de recomendações atualizado para usuário ${userId}`);
    } catch (error) {
      logger.error('Erro ao atualizar perfil para recomendações:', error);
    }
  }

  // Métodos privados
  /**
   * Obtém produtos populares para recomendação
   * @param {number} limit - Número de produtos
   * @returns {Promise<Array>} - Produtos populares
   * @private
   */
  async _getPopularProducts(limit) {
    try {
      return await Product.findAll({
        where: {
          disponivel: true,
          vendido: false
        },
        order: [['visualizacoes', 'DESC']],
        limit
      });
    } catch (error) {
      logger.error('Erro ao obter produtos populares:', error);
      return [];
    }
  }

  /**
   * Calcula pontuação de recomendação para um produto
   * @param {Object} product - Produto
   * @param {Array} viewedProducts - Produtos visualizados
   * @param {Array} purchasedProducts - Produtos comprados
   * @param {Object} preferences - Preferências do usuário
   * @returns {number} - Pontuação do produto
   * @private
   */
  _calculateRecommendationScore(product, viewedProducts, purchasedProducts, preferences) {
    let score = 0;

    // Bonificação por tipo preferido
    if (preferences && preferences.categories && preferences.categories.includes(product.tipo)) {
      score += 50;
    }

    // Bonificação por faixa de preço preferida
    if (preferences && preferences.priceRange) {
      const [min, max] = preferences.priceRange;
      if (product.preco >= min && product.preco <= max) {
        score += 30;
      }
    }

    // Bonificação por visualizações prévias de produtos similares
    if (viewedProducts && viewedProducts.length > 0) {
      const viewBonus = 20 * viewedProducts.filter(id => {
        try {
          return product.tipo === id.tipo ||
                 (product.tags && id.tags && product.tags.some(tag => id.tags.includes(tag)));
        } catch (error) {
          return false;
        }
      }).length;

      score += Math.min(viewBonus, 60); // Limitar bônus máximo
    }

    // Ajuste por popularidade
    if (product.visualizacoes) {
      score += Math.min(product.visualizacoes / 10, 20); // Max 20 pontos
    }

    // Ajuste por novidade (produtos recentes recebem boost)
    if (product.createdAt) {
      const now = new Date();
      const productDate = new Date(product.createdAt);
      const daysSinceCreation = (now - productDate) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < 7) { // Produto com menos de 7 dias
        score += Math.max(0, 20 - (daysSinceCreation * 2)); // Diminui gradualmente
      }
    }

    return score;
  }

  /**
   * Calcula similaridade entre produtos
   * @param {Object} productA - Primeiro produto
   * @param {Object} productB - Segundo produto
   * @returns {number} - Pontuação de similaridade
   * @private
   */
  _calculateProductSimilarity(productA, productB) {
    let similarity = 0;

    // Mesmo tipo: 50 pontos
    if (productA.tipo === productB.tipo) {
      similarity += 50;
    }

    // Faixa de preço similar: até 30 pontos
    const priceDiff = Math.abs(productA.preco - productB.preco);
    const priceSimilarity = Math.max(0, 30 - (priceDiff / 10));
    similarity += priceSimilarity;

    // Detalhes similares
    if (productA.detalhes && productB.detalhes) {
      // Similaridade de rank (para contas Valorant)
      if (productA.detalhes.rank && productB.detalhes.rank &&
          productA.detalhes.rank === productB.detalhes.rank) {
        similarity += 20;
      }

      // Similaridade de número de skins
      if (productA.detalhes.skins && productB.detalhes.skins) {
        const skinDiff = Math.abs(productA.detalhes.skins - productB.detalhes.skins);
        const skinSimilarity = Math.max(0, 20 - (skinDiff * 2));
        similarity += skinSimilarity;
      }
    }

    return similarity;
  }
}

// Instância única para todo o sistema
const recommendationEngine = new RecommendationEngine();

// API pública
module.exports = {
  getRecommendationsForUser: async (userId, limit = 3) => {
    return await recommendationEngine.getRecommendationsForUser(userId, limit);
  },
  getSimilarProducts: async (productId, limit = 3) => {
    return await recommendationEngine.getSimilarProducts(productId, limit);
  },
  recordInteraction: async (userId, action, data) => {
    await recommendationEngine.updateUserProfile(userId, action, data);
  }
};
