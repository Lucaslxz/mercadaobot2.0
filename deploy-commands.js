/**
 * Script para registro automático de comandos Discord
 * Usado tanto para atualização manual como na inicialização do bot
 */
const { REST, Routes } = require('discord.js');
const { logger } = require('./src/utils/helpers');
const config = require('./config');

// Definição dos comandos atuais
const commands = [
  {
    name: 'menu',
    description: 'Abre o menu principal da loja'
  },
  {
    name: 'loja',
    description: 'Mostra produtos disponíveis para compra'
  },
  {
    name: 'admin',
    description: 'Acessa o painel administrativo (apenas administradores)'
  },
  {
    name: 'perfil',
    description: 'Visualiza seu perfil e histórico de compras'
  },
  {
    name: 'ajuda',
    description: 'Exibe informações de ajuda sobre o sistema'
  }
];

/**
 * Lista todos os comandos registrados no Discord
 * @param {string} token - Token do bot
 * @param {string} clientId - ID do cliente
 * @param {string} guildId - ID do servidor (opcional)
 * @returns {Promise<Array>} Lista de comandos
 */
async function getRegisteredCommands(token, clientId, guildId = null) {
  try {
    const rest = new REST().setToken(token);

    // Buscar comandos globais ou de um servidor específico
    const endpoint = guildId ?
      Routes.applicationGuildCommands(clientId, guildId) :
      Routes.applicationCommands(clientId);

    return await rest.get(endpoint);
  } catch (error) {
    logger.error('Erro ao obter comandos registrados:', error);
    return [];
  }
}

/**
 * Registra comandos no Discord
 * @param {boolean} global - Se true, registra comandos globalmente
 * @returns {Promise<boolean>} Status da operação
 */
async function registerCommands(global = false) {
  try {
    const token = process.env.DISCORD_TOKEN || config.discord.token;
    const clientId = process.env.DISCORD_CLIENT_ID || config.discord.clientId;
    const guildId = process.env.DISCORD_GUILD_ID || config.discord.guildId;

    if (!token || !clientId) {
      logger.warn('Token ou Client ID do Discord não encontrados nas configurações');
      return false;
    }

    // Inicializar cliente REST
    const rest = new REST().setToken(token);

    // Verificar se precisa registrar em um servidor específico
    if (!global && !guildId) {
      logger.warn('ID do servidor não encontrado, registrando comandos globalmente');
      global = true;
    }

    logger.info(`Iniciando registro de ${commands.length} comandos ${global ? 'globais' : 'do servidor'}`);

    // Definir endpoint baseado no escopo (global ou servidor)
    const endpoint = global ?
      Routes.applicationCommands(clientId) :
      Routes.applicationGuildCommands(clientId, guildId);

    // Registrar comandos
    const data = await rest.put(endpoint, { body: commands });

    logger.info(`Sucesso! ${data.length} comandos registrados ${global ? 'globalmente' : 'no servidor'}`);
    return true;
  } catch (error) {
    logger.error('Erro ao registrar comandos:', error);
    return false;
  }
}

/**
 * Remove todos os comandos antigos
 * @param {boolean} global - Se true, remove comandos globais
 * @returns {Promise<boolean>} Status da operação
 */
async function clearCommands(global = false) {
  try {
    const token = process.env.DISCORD_TOKEN || config.discord.token;
    const clientId = process.env.DISCORD_CLIENT_ID || config.discord.clientId;
    const guildId = process.env.DISCORD_GUILD_ID || config.discord.guildId;

    if (!token || !clientId) {
      logger.warn('Token ou Client ID do Discord não encontrados nas configurações');
      return false;
    }

    // Inicializar cliente REST
    const rest = new REST().setToken(token);

    // Verificar se precisa limpar de um servidor específico
    if (!global && !guildId) {
      logger.warn('ID do servidor não encontrado, limpando comandos globais');
      global = true;
    }

    // Definir endpoint baseado no escopo
    const endpoint = global ?
      Routes.applicationCommands(clientId) :
      Routes.applicationGuildCommands(clientId, guildId);

    logger.info(`Removendo todos os comandos ${global ? 'globais' : 'do servidor'}`);

    // Remover comandos (enviando array vazio)
    await rest.put(endpoint, { body: [] });

    logger.info(`Sucesso! Todos os comandos foram removidos ${global ? 'globalmente' : 'do servidor'}`);
    return true;
  } catch (error) {
    logger.error('Erro ao remover comandos:', error);
    return false;
  }
}

// Permitir execução direta (node deploy-commands.js)
if (require.main === module) {
  // Verificar argumentos da linha de comando
  const args = process.argv.slice(2);

  if (args.includes('--clear')) {
    // Limpar comandos
    const global = args.includes('--global');
    clearCommands(global).then(() => {
      logger.info('Operação concluída');
      process.exit(0);
    });
  } else {
    // Registrar comandos
    const global = args.includes('--global');
    registerCommands(global).then(() => {
      logger.info('Operação concluída');
      process.exit(0);
    });
  }
}

module.exports = {
  registerCommands,
  clearCommands,
  getRegisteredCommands,
  commands
};
