/**
 * Adaptadores para diferentes versões do modelo de pagamento
 */

const { logger } = require('../../utils/helpers');

/**
 * Adapta um modelo de pagamento antigo para o formato atual
 * @param {Object} payment - Modelo de pagamento
 * @returns {Object} - Modelo de pagamento adaptado
 */
function adaptPaymentModel(payment) {
  // Se for um modelo novo (com pixDetails), retorna sem modificações
  if (payment.pixDetails) {
    return payment;
  }

  // Se for um modelo antigo, adapta os campos
  try {
    // Criar um objeto adaptado
    const adaptedPayment = {
      ...payment.toObject(),
      pixDetails: {
        code: payment.pixCode,
        qrCode: payment.qrCodeUrl,
        transactionId: payment._id.toString().substring(0, 16)
      }
    };

    // Adicionar getters para compatibilidade reversa
    Object.defineProperties(adaptedPayment, {
      pixCode: {
        get: function() {
          return this.pixDetails.code;
        }
      },
      qrCodeUrl: {
        get: function() {
          return this.pixDetails.qrCode;
        }
      }
    });

    return adaptedPayment;
  } catch (error) {
    logger.error('Erro ao adaptar modelo de pagamento:', error);
    return payment;
  }
}

/**
 * Adapta informações de pagamento para formato compatível com operações bancárias
 * @param {Object} payment - Modelo de pagamento
 * @returns {Object} - Dados formatados para banco
 */
function adaptPaymentForBank(payment) {
  return {
    transactionId: payment._id.toString(),
    amount: payment.amount.toFixed(2),
    description: `Compra: ${payment.productName}`,
    customer: {
      id: payment.userId,
      name: payment.userName
    },
    metadata: {
      productId: payment.productId.toString()
    }
  };
}

module.exports = {
  adaptPaymentModel,
  adaptPaymentForBank
};
