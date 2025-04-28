/**
 * Serviço centralizado para gerenciamento de produtos
 * Consolida funções de src/product/catalog.js
 */
const { Op } = require('sequelize');
const { Product } = require('../models');
const cache = require('../utils/cache');
const { logger } = require('../utils/helpers');

// Chaves de cache
const CACHE_KEY_PRODUCTS = 'products:all';
const CACHE_KEY_PRODUCT = 'product:';
const CACHE_TTL = 300; // 5 minutos

class ProductService {
  /**
   * Obtém produtos disponíveis com filtros opcionais
   * @param {number} limit - Limite de resultados
   * @param {Object} filters - Filtros para busca
   * @returns {Promise<Array>} - Lista de produtos
   */
  async getAvailableProducts(limit = 100, filters = {}) {
    try {
      // Verificar cache se não houver filtros
      if (Object.keys(filters).length === 0) {
        const cachedProducts = await cache.get(CACHE_KEY_PRODUCTS);
        if (cachedProducts) return cachedProducts.slice(0, limit);
      }

      // Construir query
      const query = { disponivel: true, vendido: false };

      // Aplicar filtros
      if (filters.tipo) query.tipo = filters.tipo;
      if (filters.precoMin) query.preco = { ...query.preco, [Op.gte]: filters.precoMin };
      if (filters.precoMax) {
        query.preco = query.preco ? { ...query.preco, [Op.lte]: filters.precoMax } : { [Op.lte]: filters.precoMax };
      }

      // Filtros para detalhes específicos
      if (filters.rank && query.tipo === 'valorant') {
        query['$detalhes.rank$'] = filters.rank;
      }
      if (filters.skinsMin && query.tipo === 'valorant') {
        query['$detalhes.skins$'] = { [Op.gte]: filters.skinsMin };
      }
      if (filters.region) {
        query['$detalhes.region$'] = filters.region;
      }

      // Opções de ordenação
      const order = [];
      if (filters.orderBy === 'preco') {
        order.push(['preco', filters.orderDirection === 'desc' ? 'DESC' : 'ASC']);
      } else if (filters.orderBy === 'data') {
        order.push(['createdAt', filters.orderDirection === 'desc' ? 'DESC' : 'ASC']);
      } else if (filters.orderBy === 'visualizacoes') {
        order.push(['visualizacoes', 'DESC']);
      } else {
        order.push(['createdAt', 'DESC']); // Padrão
      }

      // Executar query
      const produtos = await Product.findAll({
        where: query,
        order,
        limit: limit || 100
      });

      // Atualizar cache para consulta padrão
      if (Object.keys(filters).length === 0) {
        await cache.set(CACHE_KEY_PRODUCTS, produtos, CACHE_TTL);
      }

      return produtos;
    } catch (error) {
      logger.error('Erro ao buscar produtos disponíveis:', error);
      return [];
    }
  }

  /**
   * Obtém produto por ID
   * @param {string} productId - ID do produto
   * @returns {Promise<Object|null>} - Produto encontrado ou null
   */
  async getProductById(productId) {
    try {
      // Verificar cache
      const cacheKey = `${CACHE_KEY_PRODUCT}${productId}`;
      const cachedProduct = await cache.get(cacheKey);

      if (cachedProduct) return cachedProduct;

      // Buscar produto
      const produto = await Product.findByPk(productId);

      if (!produto) return null;

      // Incrementar visualizações
      produto.visualizacoes = (produto.visualizacoes || 0) + 1;
      await produto.save();

      // Atualizar cache
      await cache.set(cacheKey, produto, CACHE_TTL);

      return produto;
    } catch (error) {
      logger.error(`Erro ao buscar produto ${productId}:`, error);
      return null;
    }
  }

  /**
   * Cria um novo produto
   * @param {Object} productData - Dados do produto
   * @returns {Promise<Object>} - Produto criado
   */
  async createProduct(productData) {
    try {
      // Validar dados essenciais
      if (!productData.tipo || !productData.preco) {
        throw new Error('Tipo e preço são obrigatórios');
      }

      const newProduct = await Product.create({
        nome: productData.nome || `${productData.tipo} #${Math.floor(Math.random() * 10000)}`,
        tipo: productData.tipo,
        preco: productData.preco,
        descricao: productData.descricao || '',
        detalhes: productData.detalhes || {},
        disponivel: productData.disponivel !== undefined ? productData.disponivel : true,
        criadoPor: productData.criadoPor,
        origem: productData.origem || 'MANUAL',
        origemId: productData.origemId,
        imagens: productData.imagens || []
      });

      // Invalidar cache
      await cache.del(CACHE_KEY_PRODUCTS);

      logger.info(`Novo produto criado: ${newProduct.id}`);

      return newProduct;
    } catch (error) {
      logger.error('Erro ao criar produto:', error);
      throw error;
    }
  }

  /**
   * Atualiza um produto existente
   * @param {string} productId - ID do produto
   * @param {Object} updateData - Dados para atualização
   * @returns {Promise<Object>} - Resultado da operação
   */
  async updateProduct(productId, updateData) {
    try {
      const produto = await Product.findByPk(productId);

      if (!produto) {
        return { success: false, message: 'Produto não encontrado' };
      }

      // Campos que podem ser atualizados
      const allowedFields = ['nome', 'preco', 'descricao', 'detalhes', 'disponivel', 'imagens'];

      // Atualizar campos permitidos
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          produto[field] = updateData[field];
        }
      }

      // Registrar atualização
      produto.updatedAt = new Date();
      await produto.save();

      // Invalidar cache
      await cache.del(CACHE_KEY_PRODUCTS);
      await cache.del(`${CACHE_KEY_PRODUCT}${productId}`);

      logger.info(`Produto ${productId} atualizado`);

      return { success: true, product: produto };
    } catch (error) {
      logger.error(`Erro ao atualizar produto ${productId}:`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Marca um produto como vendido
   * @param {string} productId - ID do produto
   * @param {string} userId - ID do usuário comprador
   * @returns {Promise<Object>} - Resultado da operação
   */
  async markProductAsSold(productId, userId) {
    try {
      const produto = await Product.findByPk(productId);

      if (!produto) {
        return { success: false, message: 'Produto não encontrado' };
      }

      if (produto.vendido) {
        return { success: false, message: 'Produto já foi vendido' };
      }

      // Atualizar produto
      produto.vendido = true;
      produto.disponivel = false;
      produto.dataVenda = new Date();
      produto.compradoPor = userId;

      await produto.save();

      // Invalidar cache
      await cache.del(CACHE_KEY_PRODUCTS);
      await cache.del(`${CACHE_KEY_PRODUCT}${productId}`);

      logger.info(`Produto ${productId} marcado como vendido para ${userId}`);

      return { success: true };
    } catch (error) {
      logger.error(`Erro ao marcar produto ${productId} como vendido:`, error);
      return { success: false, message: error.message };
    }
  }
}

// Singleton
const productService = new ProductService();
module.exports = productService;
