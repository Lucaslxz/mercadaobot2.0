/**
 * Manipulador de eventos centralizado
 * Registra e processa todos os eventos do Discord, direcionando para painéis
 */

const { Events } = require('discord.js');
const { logger } = require('../utils/helpers');
const panelSystem = require('./PanelSystem');
const userService = require('../services/UserService');
const config = require('../../config');

// Importar sistema de registro de comandos
const { registerCommands } = require('../../deploy-commands');

class EventHandler {
  constructor() {
    this.eventHandlers = new Map();
    this.setupDefaultHandlers();
  }

  /**
   * Configura os manipuladores padrão para eventos essenciais
   */
  setupDefaultHandlers() {
    // Evento quando o bot fica online
    this.registerHandler(Events.ClientReady, this.handleReady);

    // Evento de interação (botões, selects, modals)
    this.registerHandler(Events.InteractionCreate, this.handleInteraction);

    // Evento de novo membro
    this.registerHandler(Events.GuildMemberAdd, this.handleNewMember);

    // Evento de mensagem recebida
    this.registerHandler(Events.MessageCreate, this.handleMessage);
  }

  /**
   * Registra um manipulador para um evento
   * @param {string} eventName - Nome do evento
   * @param {Function} handler - Função manipuladora
   */
  registerHandler(eventName, handler) {
    this.eventHandlers.set(eventName, handler.bind(this));
    return this;
  }

  /**
   * Configura todos os eventos no cliente
   * @param {Client} client - Cliente Discord
   */
  setupEvents(client) {
    for (const [event, handler] of this.eventHandlers.entries()) {
      if (event === Events.ClientReady) {
        client.once(event, handler);
      } else {
        client.on(event, handler);
      }
    }

    logger.info('Eventos configurados com sucesso');
    return this;
  }

  /**
   * Manipulador para o evento Ready
   * @param {Client} client - Cliente Discord
   */
  async handleReady(client) {
    logger.info(`Bot online como ${client.user.tag}`);

    // Definir status do bot
    client.user.setPresence({
      activities: [{ name: config.discord.status || '/menu | Mercadão das Contas', type: 3 }],
      status: 'online'
    });

    // Registrar comandos automaticamente
    try {
      await registerCommands(false); // Registrar comandos apenas no servidor (não globais)
      logger.info('Comandos registrados com sucesso');
    } catch (error) {
      logger.error('Erro ao registrar comandos automaticamente:', error);
    }

    // Iniciar atualização periódica de painéis
    setInterval(() => {
      panelSystem.updateAllPanels()
        .catch(err => logger.error('Erro na atualização automática de painéis:', err));
    }, config.discord.panels.refreshInterval || 60000);
  }

  /**
   * Manipulador para o evento InteractionCreate
   * @param {Interaction} interaction - Objeto de interação
   */
  async handleInteraction(interaction) {
    // Ignorar interações de bots
    if (interaction.user.bot) return;

    try {
      // Se for comando slash
      if (interaction.isChatInputCommand()) {
        return await this.handleSlashCommand(interaction);
      }

      // Registrar atividade do usuário
      try {
        await userService.recordActivity(interaction.user.id, 'INTERACTION', {
          type: interaction.type,
          customId: interaction.isButton() || interaction.isStringSelectMenu() ||
                   interaction.isModalSubmit() ? interaction.customId : null
        });
      } catch (activityError) {
        logger.warn(`Erro ao registrar atividade: ${activityError.message}`);
        // Não interromper o fluxo por erro no registro de atividade
      }

      // Tentar processar via PanelSystem
      const handled = await panelSystem.handleInteraction(interaction);

      // Se nenhum painel manipulou, mostrar erro
      if (!handled && (interaction.isButton() || interaction.isStringSelectMenu())) {
        const customId = interaction.customId;
        logger.warn(`Interação não manipulada: ${customId}`);

        // Tentar descobrir a qual painel a interação deveria pertencer
        const panelPrefix = customId.split('_')[0];
        const targetPanel = `${panelPrefix}_panel`;

        logger.debug(`Tentativa de mapear ${customId} para ${targetPanel}`);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Este botão ou menu não está mais disponível ou há um problema no sistema.',
            ephemeral: true
          });
        }
      }
    } catch (error) {
      logger.error('Erro ao processar interação:', error);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Ocorreu um erro ao processar sua interação.',
            ephemeral: true
          });
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: 'Ocorreu um erro ao processar sua interação.'
          });
        }
      } catch (replyError) {
        logger.error('Erro ao responder com erro:', replyError);
      }
    }
  }

  /**
   * Manipulador para comandos slash
   * @param {CommandInteraction} interaction - Interação de comando
   */
  async handleSlashCommand(interaction) {
    const commandName = interaction.commandName;

    // Mapear comandos principais para painéis
    const panelCommands = {
      'menu': { panelId: 'main', options: {} },
      'loja': { panelId: 'store', options: {} },
      'admin': { panelId: 'admin', options: {} },
      'perfil': { panelId: 'profile', options: {} },
      'ajuda': { panelId: 'help', options: {} }
    };

    if (panelCommands[commandName]) {
      // Verificar permissões para comandos de admin
      if (commandName === 'admin' && !interaction.memberPermissions?.has('Administrator')) {
        return await interaction.reply({
          content: 'Você não tem permissão para acessar este painel.',
          ephemeral: true
        });
      }

      // Responder com painel apropriado
      await interaction.deferReply({ ephemeral: true });

      try {
        const { panelId, options } = panelCommands[commandName];
        const panel = panelSystem.panels.get(panelId);

        if (panel && panel.handleCommand) {
          await panel.handleCommand(interaction, options, panelSystem);
        } else {
          await interaction.editReply({
            content: `Comando /${commandName} está sendo implementado. Tente novamente em breve.`
          });
        }
      } catch (error) {
        logger.error(`Erro ao processar comando ${commandName}:`, error);
        await interaction.editReply({
          content: 'Ocorreu um erro ao processar seu comando. Por favor, tente novamente.'
        });
      }

      return;
    }

    // Para comandos não mapeados, verificar comandos registrados
    const client = interaction.client;
    const command = client.commands?.get(commandName);

    if (!command) {
      return await interaction.reply({
        content: 'Comando não encontrado. Use /menu para ver os comandos disponíveis.',
        ephemeral: true
      });
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Erro ao executar comando ${commandName}:`, error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Ocorreu um erro ao executar este comando.',
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: 'Ocorreu um erro ao executar este comando.'
        });
      }
    }
  }

  /**
   * Manipulador para novos membros
   * @param {GuildMember} member - Novo membro
   */
  async handleNewMember(member) {
    try {
      // Criar perfil de usuário
      await userService.createUserProfile({
        userId: member.id,
        username: member.user.tag,
        createdAt: new Date()
      });

      // Enviar mensagem de boas-vindas
      const mainPanel = panelSystem.panels.get('main');

      if (mainPanel && mainPanel.sendWelcome) {
        await mainPanel.sendWelcome(member);
      } else {
        // Fallback para mensagem padrão
        try {
          await member.send({
            content: `Bem-vindo ao Mercadão das Contas, ${member.user.username}! Digite /menu para começar.`
          });
        } catch (dmError) {
          logger.warn(`Não foi possível enviar DM para ${member.user.tag}`);

          // Tentar enviar no canal de boas-vindas
          const welcomeChannel = member.guild.channels.cache.find(
            channel => channel.name === 'bem-vindo' || channel.name === 'welcome' || channel.name === 'geral'
          );

          if (welcomeChannel) {
            await welcomeChannel.send({
              content: `Bem-vindo, <@${member.id}>! Digite /menu para começar.`
            });
          }
        }
      }
    } catch (error) {
      logger.error(`Erro ao processar novo membro ${member.user.tag}:`, error);
    }
  }

  /**
   * Manipulador para mensagens
   * @param {Message} message - Mensagem recebida
   */
  async handleMessage(message) {
    // Ignorar mensagens de bots
    if (message.author.bot) return;

    // Verificar se é um comando com prefixo
    const prefix = config.discord.prefix || '/';

    if (message.content.startsWith(prefix)) {
      // Extrair comando e argumentos
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      // Buscar comando
      const command = message.client.commands?.get(commandName);

      if (command) {
        try {
          await command.execute(message, args);
        } catch (error) {
          logger.error(`Erro ao executar comando ${commandName}:`, error);
          await message.reply('Ocorreu um erro ao executar este comando.');
        }
      } else if (message.channel.type === 'DM') {
        // Em DM, mostrar menu principal
        const mainPanel = panelSystem.panels.get('main');

        if (mainPanel && mainPanel.handleDM) {
          await mainPanel.handleDM(message);
        } else {
          await message.reply('Use o comando /menu para acessar as opções principais.');
        }
      }
    } else if (message.channel.type === 'DM') {
      // Mensagem normal em DM
      const mainPanel = panelSystem.panels.get('main');

      if (mainPanel && mainPanel.handleDM) {
        await mainPanel.handleDM(message);
      } else {
        // Responder com instruções básicas
        await message.reply('Para interagir com o bot, use o comando /menu ou entre no servidor.');
      }
    }
  }
}

// Singleton
const eventHandler = new EventHandler();
module.exports = eventHandler;
