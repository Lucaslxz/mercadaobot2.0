/**
 * Serviço centralizado de pagamentos
 * Consolida funções de src/payment/pix.js e src/payment/approval.js
 */
const { Payment, Product } = require('../models');
const userService = require('./UserService');
const { logger } = require('../utils/helpers');
const auditLogger = require('../audit/logger');
const cache = require('../utils/cache');
const crypto = require('crypto');

// Chave de cache para pagamentos pendentes
const CACHE_KEY_PENDING = 'payments:pending';
const CACHE_TTL = 300; // 5 minutos

class PaymentService {
  /**
   * Cria um novo pagamento
   * @param {Object} paymentData - Dados do pagamento
   * @returns {Promise<Object>} - Dados do pagamento criado
   */
  async createPayment(paymentData) {
    try {
      // Calcular data de expiração
      const expirationTime = 1800; // 30 minutos em segundos
      const expiresAt = new Date(Date.now() + expirationTime * 1000);

      // Criar pagamento no banco de dados
      const newPayment = await Payment.create({
        userId: paymentData.userId,
        userName: paymentData.userName,
        productId: paymentData.productId,
        productName: paymentData.productName,
        amount: paymentData.amount,
        method: 'PIX',
        status: 'PENDING',
        expiresAt: expiresAt,
        metadata: {
          ipAddress: paymentData.ipAddress,
          userAgent: paymentData.userAgent
        }
      });

      // Gerar código PIX
      const pixCode = this.generatePixCode(newPayment);

      // Gerar QR Code
      const qrCodeUrl = await this.generateQRCode(pixCode);

      // Atualizar modelo com informações do PIX
      newPayment.pixCode = pixCode;
      newPayment.qrCodeUrl = qrCodeUrl;

      await newPayment.save();

      // Registrar na auditoria
      await auditLogger.log({
        action: 'PAYMENT_CREATED',
        category: 'TRANSACTION',
        severity: 'INFO',
        status: 'SUCCESS',
        user: {
          id: paymentData.userId,
          username: paymentData.userName
        },
        payment: {
          id: newPayment.id,
          amount: newPayment.amount,
          method: 'PIX'
        },
        product: {
          id: paymentData.productId,
          name: paymentData.productName
        }
      });

      logger.info(`Novo pagamento PIX criado: ${newPayment.id}`);

      return newPayment;
    } catch (error) {
      logger.error('Erro ao criar pagamento PIX:', error);
      throw error;
    }
  }

  /**
   * Gera um código PIX para pagamento
   * @param {Object} payment - Dados do pagamento
   * @returns {string} - Código PIX
   * @private
   */
  generatePixCode(payment) {
    // Implementação simplificada
    const pixData = {
      keyType: 'random',
      keyValue: `BOT${payment.id.toString().substring(0, 8)}`,
      name: "Bot de Vendas Discord",
      city: "São Paulo",
      txId: payment.id.toString().substring(0, 25),
      amount: payment.amount.toFixed(2),
      description: `Compra: ${payment.productName.substring(0, 30)}`
    };

    // Criar String do PIX (formato simplificado)
    return Buffer.from(JSON.stringify(pixData)).toString('base64');
  }

  /**
   * Gera URL de um QR Code para o pagamento PIX
   * @param {string} pixCode - Código PIX
   * @returns {Promise<string>} - URL do QR Code
   * @private
   */
  async generateQRCode(pixCode) {
    try {
      // Implementação simplificada - em produção usaria uma biblioteca como 'qrcode'
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`;
    } catch (error) {
      logger.error('Erro ao gerar QR Code:', error);
      // Retornar URL de um QR code genérico em caso de erro
      return 'https://i.imgur.com/placeholder-qr.png';
    }
  }

  /**
   * Aprova um pagamento e entrega o produto
   * @param {string} paymentId - ID do pagamento
   * @param {string} adminId - ID do administrador
   * @returns {Promise<Object>} - Resultado da aprovação
   */
  async approvePayment(paymentId, adminId) {
    try {
      const payment = await Payment.findByPk(paymentId);
      if (!payment) return { success: false, message: 'Pagamento não encontrado', payment: null };

      // Verificar status atual
      if (payment.status !== 'PENDING' && payment.status !== 'PROCESSING') {
        return { success: false, message: `Pagamento já foi ${payment.status === 'COMPLETED' ? 'aprovado' : 'rejeitado/expirado'}`, payment };
      }

      // Verificar produto
      const product = await Product.findByPk(payment.productId);
      if (!product || !product.disponivel || product.vendido) {
        payment.status = 'REJECTED';
        payment.rejectedAt = new Date();
        payment.rejectionReason = 'Produto não disponível';
        await payment.save();
        return { success: false, message: 'Produto não disponível', payment };
      }

      // Gerar credenciais
      const accountCredentials = this._generateAccountCredentials();

      // Atualizar pagamento
      payment.status = 'COMPLETED';
      payment.completedAt = new Date();
      payment.approvedBy = adminId;
      payment.deliveryData = accountCredentials;
      await payment.save();

      // Atualizar produto
      product.vendido = true;
      product.disponivel = false;
      product.dataVenda = new Date();
      product.compradoPor = payment.userId;
      await product.save();

      // Registrar atividade e pontos
      await userService.recordActivity(payment.userId, 'PRODUCT_PURCHASE', {
        productId: product.id,
        productName: product.nome,
        paymentId: payment.id,
        amount: payment.amount
      });

      // Invalidar cache
      await cache.del(CACHE_KEY_PENDING);

      // Log de auditoria
      await auditLogger.log({
        action: 'PAYMENT_APPROVED',
        category: 'TRANSACTION',
        severity: 'INFO',
        status: 'SUCCESS',
        user: { id: adminId },
        target: { id: payment.userId, username: payment.userName },
        payment: { id: payment.id, amount: payment.amount },
        product: { id: product.id, name: product.nome }
      });

      logger.info(`Pagamento ${paymentId} aprovado por ${adminId}`);
      return { success: true, payment, accountCredentials };
    } catch (error) {
      logger.error(`Erro ao aprovar pagamento ${paymentId}:`, error);
      return { success: false, message: 'Erro ao processar aprovação', payment: null };
    }
  }

  /**
   * Rejeita um pagamento
   * @param {string} paymentId - ID do pagamento
   * @param {string} reason - Motivo da rejeição
   * @param {string} adminId - ID do administrador
   * @returns {Promise<Object>} - Resultado da rejeição
   */
  async rejectPayment(paymentId, reason, adminId) {
    try {
      const payment = await Payment.findByPk(paymentId);
      if (!payment) return { success: false, message: 'Pagamento não encontrado', payment: null };

      // Verificar status atual
      if (payment.status === 'COMPLETED') {
        return { success: false, message: 'Pagamento já foi aprovado e não pode ser rejeitado', payment };
      }
      if (payment.status === 'REJECTED') {
        return { success: false, message: 'Pagamento já foi rejeitado anteriormente', payment };
      }

      // Atualizar pagamento
      payment.status = 'REJECTED';
      payment.rejectedAt = new Date();
      payment.rejectionReason = reason;
      payment.rejectedBy = adminId;
      await payment.save();

      // Registrar atividade
      await userService.recordActivity(payment.userId, 'PAYMENT_REJECTED', {
        paymentId: payment.id,
        productId: payment.productId,
        reason
      });

      // Invalidar cache
      await cache.del(CACHE_KEY_PENDING);

      // Log de auditoria
      await auditLogger.log({
        action: 'PAYMENT_REJECTED',
        category: 'TRANSACTION',
        severity: 'WARNING',
        status: 'SUCCESS',
        user: { id: adminId },
        target: { id: payment.userId, username: payment.userName },
        payment: { id: payment.id, amount: payment.amount },
        product: { id: payment.productId, name: payment.productName },
        details: { reason }
      });

      logger.info(`Pagamento ${paymentId} rejeitado por ${adminId}: ${reason}`);
      return { success: true, payment };
    } catch (error) {
      logger.error(`Erro ao rejeitar pagamento ${paymentId}:`, error);
      return { success: false, message: 'Erro ao processar rejeição', payment: null };
    }
  }

  /**
   * Obtém todos os pagamentos pendentes de aprovação
   * @returns {Promise<Array>} - Lista de pagamentos pendentes
   */
  async getPendingApprovals() {
    try {
      // Verificar cache
      const cachedPayments = await cache.get(CACHE_KEY_PENDING);
      if (cachedPayments) return cachedPayments;

      // Buscar do banco
      const pendingPayments = await Payment.findAll({
        where: {
          status: ['PENDING', 'PROCESSING']
        },
        order: [['createdAt', 'DESC']],
        include: [{ model: Product, as: 'Product' }]
      });

      // Salvar no cache
      await cache.set(CACHE_KEY_PENDING, pendingPayments, CACHE_TTL);
      return pendingPayments;
    } catch (error) {
      logger.error('Erro ao obter pagamentos pendentes:', error);
      return [];
    }
  }

  /**
   * Gera credenciais de acesso aleatórias
   * @private
   */
  _generateAccountCredentials() {
    const login = `user_${crypto.randomBytes(4).toString('hex')}`;
    const password = crypto.randomBytes(8).toString('base64').replace(/[\/\+=]/g, '');
    return { login, password };
  }
}

// Singleton
const paymentService = new PaymentService();
module.exports = paymentService;
