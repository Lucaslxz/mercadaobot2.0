/**
 * Sistema de logs de auditoria otimizado para Sequelize
 */
const { AuditLog } = require('../models');
const { sequelize } = require('../utils/db');
const { Op } = require('sequelize');
const config = require('../../config');
const winston = require('winston');
const { format } = winston;

// Configuração otimizada do logger Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'discord-bot' },
  transports: [
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  ]
});

// Adicionar console em ambiente não-produção
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple()
    )
  }));
}

/**
 * Registra entrada no log de auditoria com retry
 * @param {Object} logData - Dados para o log
 * @returns {Promise<Object>} - Entrada de log criada
 */
async function log(logData) {
  try {
    // Verificar campos obrigatórios
    if (!logData.action || !logData.category || !logData.severity || !logData.status) {
      logger.error('Dados incompletos para log de auditoria:', logData);
      return null;
    }

    // Preparar dados para Sequelize
    const auditData = {
      action: logData.action,
      category: logData.category,
      severity: logData.severity,
      status: logData.status,
      timestamp: logData.timestamp || new Date(),
      userId: logData.user?.id,
      targetId: logData.target?.id,
      details: logData.details || {},
      ip: logData.ip,
      // Calcular data de retenção baseada na severidade
      retentionDate: calculateRetentionDate(logData.severity)
    };

    // Tentativa com retry (3x)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const auditEntry = await AuditLog.create(auditData);

        // Log crítico ou erro também no logger principal
        if (logData.severity === 'CRITICAL' || logData.severity === 'ERROR') {
          const msg = `[AUDIT ${logData.severity}] ${logData.action}`;
          logger[logData.severity === 'CRITICAL' ? 'error' : 'error'](msg, logData.details || {});
        }

        return auditEntry;
      } catch (saveError) {
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          continue;
        }
        throw saveError;
      }
    }
  } catch (error) {
    logger.error('Erro ao registrar log de auditoria:', error);
    return null;
  }
}

/**
 * Calcula data de retenção baseada na severidade
 * @private
 */
function calculateRetentionDate(severity) {
  const now = new Date();
  const retentionSeconds = config.audit.retentionPeriod[severity] ||
                          config.audit.retentionPeriod.INFO; // Default

  return new Date(now.getTime() + (retentionSeconds * 1000));
}

/**
 * Busca logs com filtros avançados e paginação
 * @param {Object} filters - Filtros
 * @param {Object} options - Opções de paginação e ordenação
 * @returns {Promise<Object>} - Logs paginados
 */
async function searchLogs(filters = {}, options = {}) {
  try {
    const whereClause = {};

    // Aplicar filtros
    if (filters.action) whereClause.action = filters.action;
    if (filters.category) whereClause.category = filters.category;
    if (filters.severity) whereClause.severity = filters.severity;
    if (filters.status) whereClause.status = filters.status;
    if (filters.userId) whereClause.userId = filters.userId;
    if (filters.targetId) whereClause.targetId = filters.targetId;

    // Filtros para IDs de referência
    if (filters.productId) {
      whereClause.details = sequelize.where(
        sequelize.fn('JSON_EXTRACT', sequelize.col('details'), '$.productId'),
        filters.productId
      );
    }

    if (filters.paymentId) {
      whereClause.details = sequelize.where(
        sequelize.fn('JSON_EXTRACT', sequelize.col('details'), '$.paymentId'),
        filters.paymentId
      );
    }

    // Filtros de data
    if (filters.startDate || filters.endDate) {
      whereClause.timestamp = {};
      if (filters.startDate) whereClause.timestamp[Op.gte] = new Date(filters.startDate);
      if (filters.endDate) whereClause.timestamp[Op.lte] = new Date(filters.endDate);
    }

    // Paginação
    const limit = options.limit || 100;
    const offset = options.skip || 0;
    const order = options.sort ?
      Object.entries(options.sort).map(([key, value]) => [key, value === -1 ? 'DESC' : 'ASC']) :
      [['timestamp', 'DESC']];

    // Execução em paralelo para performance
    const [logs, total] = await Promise.all([
      AuditLog.findAll({
        where: whereClause,
        order,
        limit,
        offset
      }),
      AuditLog.count({ where: whereClause })
    ]);

    return {
      logs,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    logger.error('Erro ao buscar logs de auditoria:', error);
    return { logs: [], total: 0, page: 1, pageSize: options.limit || 100, totalPages: 0 };
  }
}

/**
 * Estatísticas de logs de auditoria
 * @param {Object} filters - Filtros para estatísticas
 * @returns {Promise<Object>} - Estatísticas agregadas
 */
async function getAuditStats(filters = {}) {
  try {
    const whereClause = {};

    // Aplicar filtros de data
    if (filters.startDate || filters.endDate) {
      whereClause.timestamp = {};
      if (filters.startDate) whereClause.timestamp[Op.gte] = new Date(filters.startDate);
      if (filters.endDate) whereClause.timestamp[Op.lte] = new Date(filters.endDate);
    }

    // Total de logs
    const totalCount = await AuditLog.count({ where: whereClause });

    // Estatísticas por severidade
    const severityStats = await AuditLog.findAll({
      attributes: [
        'severity',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: whereClause,
      group: ['severity'],
      order: [[sequelize.literal('count'), 'DESC']]
    });

    // Estatísticas por categoria
    const categoryStats = await AuditLog.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: whereClause,
      group: ['category'],
      order: [[sequelize.literal('count'), 'DESC']]
    });

    // Estatísticas por status
    const statusStats = await AuditLog.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: whereClause,
      group: ['status'],
      order: [[sequelize.literal('count'), 'DESC']]
    });

    // Ações mais comuns
    const topActions = await AuditLog.findAll({
      attributes: [
        'action',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: whereClause,
      group: ['action'],
      order: [[sequelize.literal('count'), 'DESC']],
      limit: 10
    });

    // Logs recentes
    const recentLogs = await AuditLog.findAll({
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: 5
    });

    return {
      total: totalCount,
      bySeverity: severityStats.map(item => ({
        severity: item.severity,
        count: parseInt(item.getDataValue('count'), 10)
      })),
      byCategory: categoryStats.map(item => ({
        category: item.category,
        count: parseInt(item.getDataValue('count'), 10)
      })),
      byStatus: statusStats.map(item => ({
        status: item.status,
        count: parseInt(item.getDataValue('count'), 10)
      })),
      topActions: topActions.map(item => ({
        action: item.action,
        count: parseInt(item.getDataValue('count'), 10)
      })),
      recentLogs
    };
  } catch (error) {
    logger.error('Erro ao obter estatísticas de auditoria:', error);
    return {
      total: 0,
      bySeverity: [],
      byCategory: [],
      byStatus: [],
      topActions: [],
      recentLogs: []
    };
  }
}

/**
 * Limpa logs antigos com performance otimizada
 * @returns {Promise<Object>} - Resultado da operação
 */
async function cleanupOldLogs() {
  try {
    const now = new Date();

    // Exclusão de logs expirados baseada em retenção
    const result = await AuditLog.destroy({
      where: {
        retentionDate: { [Op.lt]: now }
      }
    });

    logger.info(`Limpeza de logs antigos: ${result} logs removidos`);

    return {
      success: true,
      deletedCount: result
    };
  } catch (error) {
    logger.error('Erro ao limpar logs antigos:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

module.exports = {
  log,
  searchLogs,
  getAuditStats,
  cleanupOldLogs,
  logger // Exportando winston logger
};
