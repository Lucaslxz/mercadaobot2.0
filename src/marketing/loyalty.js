/**
 * Sistema de pontos de fidelidade para usuários
 */

const { Loyalty, User } = require('../models');
const { logger } = require('../utils/helpers');
const config = require('../config');
const auditLogger = require('../audit/logger');
const { Op } = require('sequelize');

/**
 * Adiciona pontos de fidelidade a um usuário
 * @param {string} userId - ID do usuário
 * @param {number} points - Quantidade de pontos
 * @param {string} reason - Motivo da adição
 * @param {Object} metadata - Dados adicionais
 * @returns {Promise<Object>} - Resultado da operação
 */
async function addPoints(userId, points, reason, metadata = {}) {
  try {
    // Verificar se é um valor válido
    if (points <= 0) {
      return {
        success: false,
        message: 'Quantidade de pontos deve ser maior que zero'
      };
    }

    // Obter ou criar perfil de fidelidade
    let loyalty = await Loyalty.findOne({
      where: { userId }
    });

    if (!loyalty) {
      // Obter dados do usuário
      const userService = require('../user/profile');
      const userProfile = await userService.getUserProfile(userId);

      if (!userProfile) {
        return {
          success: false,
          message: 'Usuário não encontrado'
        };
      }

      // Criar novo perfil de fidelidade
      loyalty = await Loyalty.create({
        userId,
        userName: userProfile.username,
        totalPoints: 0,
        lifetimePoints: 0,
        level: 1,
        transactions: []
      });
    }

    // Calcular data de expiração
    const now = new Date();
    const expirationDays = config.marketing.loyaltyPoints.expirationDays;
    const expiresAt = new Date(now.getTime() + (expirationDays * 24 * 60 * 60 * 1000));

    // Adicionar transação como objeto JSON
    const transaction = {
      id: Date.now().toString(),
      amount: points,
      reason,
      createdAt: now,
      expiresAt,
      status: 'ACTIVE',
      relatedProductId: metadata.productId,
      relatedPaymentId: metadata.paymentId
    };

    // Clone do array de transações
    const updatedTransactions = loyalty.transactions ? [...loyalty.transactions] : [];
    updatedTransactions.push(transaction);

    // Atualizar dados de fidelidade
    const updatedTotalPoints = loyalty.totalPoints + points;
    const updatedLifetimePoints = loyalty.lifetimePoints + points;
    const updatedLevel = _calculateLoyaltyLevel(updatedLifetimePoints);

    // Atualizar registro
    loyalty.transactions = updatedTransactions;
    loyalty.totalPoints = updatedTotalPoints;
    loyalty.lifetimePoints = updatedLifetimePoints;
    loyalty.level = updatedLevel;
    loyalty.lastUpdated = now;

    await loyalty.save();

    // Registrar na auditoria
    await auditLogger.log({
      action: 'LOYALTY_POINTS_ADDED',
      category: 'MARKETING',
      severity: 'INFO',
      status: 'SUCCESS',
      user: {
        id: userId,
        username: loyalty.userName
      },
      details: {
        points,
        reason,
        newTotal: loyalty.totalPoints,
        newLevel: loyalty.level,
        metadata
      }
    });

    logger.info(`${points} pontos de fidelidade adicionados para usuário ${userId}: ${reason}`);
    return {
      success: true,
      updatedPoints: loyalty.totalPoints,
      level: loyalty.level
    };
  } catch (error) {
    logger.error(`Erro ao adicionar pontos para usuário ${userId}:`, error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Utiliza pontos de fidelidade de um usuário
 * @param {string} userId - ID do usuário
 * @param {number} points - Quantidade de pontos
 * @param {string} reason - Motivo da utilização
 * @param {Object} metadata - Dados adicionais
 * @returns {Promise<Object>} - Resultado da operação
 */
async function usePoints(userId, points, reason, metadata = {}) {
  try {
    // Verificar se é um valor válido
    if (points <= 0) {
      return {
        success: false,
        message: 'Quantidade de pontos deve ser maior que zero'
      };
    }

    // Obter perfil de fidelidade
    const loyalty = await Loyalty.findOne({
      where: { userId }
    });

    if (!loyalty) {
      return {
        success: false,
        message: 'Usuário não possui pontos de fidelidade'
      };
    }

    // Verificar se tem pontos suficientes
    if (loyalty.totalPoints < points) {
      return {
        success: false,
        message: 'Saldo de pontos insuficiente',
        currentPoints: loyalty.totalPoints,
        requestedPoints: points
      };
    }

    // Adicionar transação negativa
    const now = new Date();
    const transaction = {
      id: Date.now().toString(),
      amount: -points,
      reason,
      createdAt: now,
      expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)), // Não expira
      status: 'USED',
      relatedProductId: metadata.productId,
      relatedPaymentId: metadata.paymentId,
      actionBy: metadata.adminId
    };

    // Atualizar transações
    const updatedTransactions = loyalty.transactions ? [...loyalty.transactions] : [];
    updatedTransactions.push(transaction);

    // Atualizar saldo
    loyalty.transactions = updatedTransactions;
    loyalty.totalPoints -= points;
    loyalty.lastUpdated = now;

    await loyalty.save();

    // Registrar na auditoria
    await auditLogger.log({
      action: 'LOYALTY_POINTS_USED',
      category: 'MARKETING',
      severity: 'INFO',
      status: 'SUCCESS',
      user: {
        id: userId,
        username: loyalty.userName
      },
      details: {
        points,
        reason,
        newTotal: loyalty.totalPoints,
        metadata
      }
    });

    logger.info(`${points} pontos de fidelidade utilizados pelo usuário ${userId}: ${reason}`);
    return {
      success: true,
      remainingPoints: loyalty.totalPoints,
      level: loyalty.level
    };
  } catch (error) {
    logger.error(`Erro ao utilizar pontos do usuário ${userId}:`, error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Obtém saldo e histórico de pontos de um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Dados de fidelidade
 */
async function getUserPoints(userId) {
  try {
    // Obter perfil de fidelidade
    const loyalty = await Loyalty.findOne({
      where: { userId }
    });

    if (!loyalty) {
      // Criar perfil vazio
      return {
        amount: 0,
        lifetimePoints: 0,
        level: 1,
        transactions: [],
        valueInMoney: 0
      };
    }

    // Verificar pontos expirados
    await _processExpiredPoints(loyalty);

    // Calcular valor em dinheiro
    const conversionRate = config.marketing.loyaltyPoints.conversionRate;
    const valueInMoney = loyalty.totalPoints * conversionRate;

    // Obter histórico de transações (mais recentes primeiro)
    const transactions = loyalty.transactions
      ? [...loyalty.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(tx => ({
          id: tx.id,
          amount: tx.amount,
          reason: tx.reason,
          date: tx.createdAt,
          expiresAt: tx.expiresAt,
          status: tx.status
        }))
      : [];

    return {
      amount: loyalty.totalPoints,
      lifetimePoints: loyalty.lifetimePoints,
      level: loyalty.level,
      transactions,
      valueInMoney
    };
  } catch (error) {
    logger.error(`Erro ao obter pontos do usuário ${userId}:`, error);
    return {
      amount: 0,
      lifetimePoints: 0,
      level: 1,
      transactions: [],
      valueInMoney: 0
    };
  }
}

/**
 * Calcula um nível de fidelidade com base em pontos
 * @param {number} lifetimePoints - Total de pontos acumulados na vida
 * @returns {number} - Nível calculado
 * @private
 */
function _calculateLoyaltyLevel(lifetimePoints) {
  if (lifetimePoints >= 10000) return 5; // VIP
  if (lifetimePoints >= 5000) return 4;  // Ouro
  if (lifetimePoints >= 2000) return 3;  // Prata
  if (lifetimePoints >= 500) return 2;   // Bronze
  return 1; // Iniciante
}

/**
 * Processa pontos expirados de um perfil
 * @param {Object} loyalty - Perfil de fidelidade
 * @returns {Promise<Object>} - Perfil atualizado
 * @private
 */
async function _processExpiredPoints(loyalty) {
  try {
    const now = new Date();
    let pointsExpired = 0;
    let updatedTransactions = [...loyalty.transactions];

    // Identificar transações expiradas
    for (let i = 0; i < updatedTransactions.length; i++) {
      const tx = updatedTransactions[i];
      if (tx.status === 'ACTIVE' && new Date(tx.expiresAt) <= now) {
        updatedTransactions[i] = { ...tx, status: 'EXPIRED' };
        pointsExpired += tx.amount;
      }
    }

    // Se houve expiração, atualizar saldo
    if (pointsExpired > 0) {
      // Registrar transação de expiração
      const expirationTx = {
        id: Date.now().toString(),
        amount: -pointsExpired,
        reason: 'EXPIRATION',
        createdAt: now,
        expiresAt: new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)), // Não expira
        status: 'USED'
      };

      updatedTransactions.push(expirationTx);

      // Atualizar modelo
      loyalty.transactions = updatedTransactions;
      loyalty.totalPoints -= pointsExpired;
      loyalty.lastUpdated = now;

      await loyalty.save();

      logger.info(`${pointsExpired} pontos expiraram para o usuário ${loyalty.userId}`);

      // Flag para notificar o chamador sobre expiração
      loyalty._expiredPoints = pointsExpired;
    }

    return loyalty;
  } catch (error) {
    logger.error(`Erro ao processar pontos expirados para usuário ${loyalty.userId}:`, error);
    return loyalty;
  }
}

module.exports = {
  addPoints,
  usePoints,
  getUserPoints
};
