/**
 * Geração de códigos PIX e QR codes
 */

const { v4: uuidv4 } = require('uuid');
const config = require('../../../config'); // Caminho corrigido
const { logger } = require('../../utils/helpers');

/**
 * Gera uma chave PIX única para o pagamento
 * @returns {string} - Chave PIX única
 */
function generatePixKey() {
  // Gerar identificador único para a transação
  const transactionId = uuidv4().replace(/-/g, '').substring(0, 16);

  // Adicionar prefixo para identificar no sistema
  return `DISCBOT${transactionId}`;
}

/**
 * Gera o código PIX para pagamento
 * @param {Object} paymentData - Dados do pagamento
 * @returns {string} - Código PIX no formato "Copia e Cola"
 */
function generatePixCode(paymentData) {
  // Esta é uma implementação simplificada
  // Em produção, deve seguir o padrão EMV do Banco Central
  const pixData = {
    keyType: config.payment.pix.keyType,
    keyValue: config.payment.pix.keyValue,
    name: "Bot de Vendas Discord",
    city: "São Paulo",
    txId: paymentData._id.toString().substring(0, 25),
    amount: paymentData.amount.toFixed(2),
    description: `Compra: ${paymentData.productName.substring(0, 30)}`
  };

  // Criar String do PIX (formato simplificado)
  return Buffer.from(JSON.stringify(pixData)).toString('base64');
}

/**
 * Gera URL de um QR Code para o pagamento PIX
 * @param {string} pixCode - Código PIX
 * @returns {Promise<string>} - URL do QR Code em data:image/png;base64
 */
async function generateQRCode(pixCode) {
  try {
    // Importação dinâmica para evitar erro se o módulo não existir
    let QRCode;
    try {
      QRCode = require('qrcode');
    } catch (error) {
      logger.error('Módulo QRCode não encontrado:', error);
      // Fallback para QR code estático
      return 'https://i.imgur.com/placeholder-qr.png';
    }

    // Opções do QR Code
    const options = {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };

    // Gerar QR code como data URL
    return await QRCode.toDataURL(pixCode, options);
  } catch (error) {
    logger.error('Erro ao gerar QR Code:', error);
    // Retornar URL de um QR code genérico em caso de erro
    return 'https://i.imgur.com/placeholder-qr.png';
  }
}

module.exports = {
  generatePixKey,
  generatePixCode,
  generateQRCode
};
