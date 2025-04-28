/**
 * Serviço centralizado de gerenciamento de usuários
 * Consolida funções de src/user/profile.js
 */
const { User, Activity } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../utils/helpers');

class UserService {
  /**
   * Cria ou atualiza o perfil de um usuário
   * @param {Object} userData - Dados do usuário
   * @returns {Promise<Object>} - Perfil do usuário
   */
  async createUserProfile(userData) {
    try {
      // Verificar se o usuário já existe
      const [user, created] = await User.findOrCreate({
        where: { userId: userData.userId },
        defaults: {
          username: userData.username,
          email: userData.email,
          createdAt: userData.createdAt || new Date(),
          preferences: userData.preferences || {}
        }
      });

      if (!created) {
        // Atualizar dados existentes
        user.username = userData.username;
        user.lastActive = new Date();

        // Atualizar outros campos se fornecidos
        if (userData.email) user.email = userData.email;
        if (userData.preferences) user.preferences = userData.preferences;

        await user.save();
        logger.debug(`Perfil do usuário ${userData.userId} atualizado`);
      } else {
        logger.info(`Novo perfil de usuário criado para ${userData.userId}`);
      }

      return user;
    } catch (error) {
      logger.error(`Erro ao criar/atualizar perfil de usuário ${userData.userId}:`, error);
      throw error;
    }
  }

  /**
   * Obtém o perfil de um usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Perfil do usuário
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findByPk(userId);

      if (user) {
        // Atualizar última atividade
        user.lastActive = new Date();
        await user.save();
      }

      return user;
    } catch (error) {
      logger.error(`Erro ao obter perfil do usuário ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Registra uma atividade no histórico do usuário
   * @param {string} userId - ID do usuário
   * @param {string} action - Tipo de ação
   * @param {Object} data - Dados da ação
   * @returns {Promise<boolean>} - Status da operação
   */
  async recordActivity(userId, action, data = {}) {
    try {
      // Verificar se o usuário existe
      let user = await User.findByPk(userId);

      if (!user) {
        // Criar perfil caso não exista
        user = await this.createUserProfile({
          userId,
          username: userId, // Placeholder até obter o username real
          createdAt: new Date()
        });
      }

      // Criar atividade
      await Activity.create({
        userId,
        action,
        data,
        createdAt: new Date()
      });

      // Limitar tamanho do histórico (manter últimas 100 atividades)
      const count = await Activity.count({ where: { userId } });

      if (count > 100) {
        const activitiesToDelete = await Activity.findAll({
          where: { userId },
          order: [['createdAt', 'ASC']],
          limit: count - 100
        });

        if (activitiesToDelete.length > 0) {
          await Activity.destroy({
            where: {
              id: {
                [Op.in]: activitiesToDelete.map(a => a.id)
              }
            }
          });
        }
      }

      // Atualizar timestamp de última atividade
      user.lastActive = new Date();
      await user.save();

      logger.debug(`Atividade ${action} registrada para usuário ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Erro ao registrar atividade ${action} para usuário ${userId}:`, error);
      return false;
    }
  }

  /**
   * Obtém o histórico de atividades de um usuário
   * @param {string} userId - ID do usuário
   * @param {number} limit - Limite de atividades para retornar
   * @returns {Promise<Array>} - Histórico de atividades
   */
  async getUserHistory(userId, limit = 50) {
    try {
      const activities = await Activity.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit
      });

      return activities;
    } catch (error) {
      logger.error(`Erro ao obter histórico do usuário ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Obtém o histórico de compras de um usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Array>} - Histórico de compras
   */
  async getPurchaseHistory(userId) {
    try {
      const { Payment } = require('../models');

      // Buscar pagamentos aprovados
      const payments = await Payment.findAll({
        where: {
          userId,
          status: 'COMPLETED'
        },
        order: [['completedAt', 'DESC']]
      });

      // Transformar em formato mais amigável
      return payments.map(payment => ({
        paymentId: payment.id,
        productId: payment.productId,
        productName: payment.productName,
        amount: payment.amount,
        date: payment.completedAt || payment.createdAt,
        method: payment.method
      }));
    } catch (error) {
      logger.error(`Erro ao obter histórico de compras do usuário ${userId}:`, error);
      return [];
    }
  }

  /**
   * Bloqueia um usuário
   * @param {string} userId - ID do usuário
   * @param {string} reason - Motivo do bloqueio
   * @param {string} adminId - ID do admin que realizou o bloqueio
   * @returns {Promise<Object>} - Resultado da operação
   */
  async blockUser(userId, reason, adminId) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        return { success: false, message: 'Usuário não encontrado' };
      }

      // Atualizar status de bloqueio
      user.isBlocked = true;
      user.blockReason = reason;
      user.blockedBy = adminId;
      user.blockDate = new Date();

      await user.save();

      logger.info(`Usuário ${userId} bloqueado por ${adminId}. Motivo: ${reason}`);
      return {
        success: true,
        user: {
          userId: user.userId,
          username: user.username,
          blockDate: user.blockDate
        }
      };
    } catch (error) {
      logger.error(`Erro ao bloquear usuário ${userId}:`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Desbloqueia um usuário
   * @param {string} userId - ID do usuário
   * @param {string} adminId - ID do admin que realizou o desbloqueio
   * @returns {Promise<Object>} - Resultado da operação
   */
  async unblockUser(userId, adminId) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        return { success: false, message: 'Usuário não encontrado' };
      }

      // Verificar se está bloqueado
      if (!user.isBlocked) {
        return { success: false, message: 'Usuário não está bloqueado' };
      }

      // Registrar atividade de desbloqueio
      await this.recordActivity(userId, 'USER_UNBLOCKED', {
        adminId,
        previousReason: user.blockReason
      });

      // Atualizar status
      user.isBlocked = false;
      user.blockReason = null;
      user.blockDate = null;

      await user.save();

      logger.info(`Usuário ${userId} desbloqueado por ${adminId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Erro ao desbloquear usuário ${userId}:`, error);
      return { success: false, message: error.message };
    }
  }
}

// Singleton
const userService = new UserService();
module.exports = userService;
