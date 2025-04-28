/**
 * Painel principal do sistema
 * Interface central que dá acesso a todas as funcionalidades para usuários
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
  } = require('discord.js');
  const { logger } = require('../utils/helpers');
  const config = require('../../config');
  const userService = require('../services/UserService');

  class MainPanel {
    constructor() {
      this.id = 'main';
      this.buttons = {
        store: 'main_store',
        profile: 'main_profile',
        support: 'main_support',
        help: 'main_help',
        cart: 'main_cart',
        points: 'main_points'
      };
    }

    /**
     * Renderiza o painel principal
     * @param {TextChannel} channel - Canal onde o painel será enviado
     * @param {Object} options - Opções adicionais
     * @param {PanelSystem} panelSystem - Sistema de painéis
     */
    async render(channel, options = {}, panelSystem) {
      const userId = options.userId || channel.recipient?.id;
      let user = null;

      if (userId) {
        // Verificar se o usuário existe no banco
        user = await userService.getUserProfile(userId);

        // Se não existir, criar perfil
        if (!user) {
          const username = options.username || channel.recipient?.username || 'Usuário';
          await userService.createUserProfile({
            userId,
            username,
            createdAt: new Date()
          });
        }

        // Registrar uso do painel
        await userService.recordActivity(userId, 'PANEL_OPEN', {
          panel: 'main'
        });
      }

      // Criar embed do menu
      const embed = new EmbedBuilder()
        .setTitle('🏪 Mercadão das Contas')
        .setColor(config.discord.embedColors.primary)
        .setDescription('Bem-vindo! Selecione uma opção:')
        .addFields(
          { name: '🛍️ Loja', value: 'Explore nosso catálogo de produtos' },
          { name: '👤 Perfil', value: 'Visualize seu perfil e histórico de compras' },
          { name: '🎫 Suporte', value: 'Abra um ticket de suporte' },
          { name: '❓ Ajuda', value: 'Veja informações de ajuda' }
        )
        .setFooter({ text: 'Mercadão das Contas - Sua loja de contas confiável' })
        .setTimestamp();

      // Botões interativos - primeira linha
      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(this.buttons.store)
            .setLabel('Loja')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛍️'),

          new ButtonBuilder()
            .setCustomId(this.buttons.profile)
            .setLabel('Perfil')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👤'),

          new ButtonBuilder()
            .setCustomId(this.buttons.support)
            .setLabel('Suporte')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎫'),

          new ButtonBuilder()
            .setCustomId(this.buttons.help)
            .setLabel('Ajuda')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❓')
        );

      // Segunda linha de botões
      const row2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(this.buttons.cart)
            .setLabel('Carrinho')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛒'),

          new ButtonBuilder()
            .setCustomId(this.buttons.points)
            .setLabel('Pontos de Fidelidade')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎁')
        );

      // Enviar ou editar mensagem
      if (options.message) {
        return await options.message.edit({
          embeds: [embed],
          components: [row1, row2]
        });
      } else {
        return await channel.send({
          embeds: [embed],
          components: [row1, row2]
        });
      }
    }

    /**
     * Manipula interações com o painel
     * @param {Interaction} interaction - Interação do Discord
     * @param {PanelSystem} panelSystem - Sistema de painéis
     */
    async handleInteraction(interaction, panelSystem) {
      const customId = interaction.customId;

      // Tratar cada botão
      switch (customId) {
        case this.buttons.store:
          await interaction.deferUpdate();
          return await panelSystem.renderPanel('store', interaction.channel, {
            userId: interaction.user.id,
            username: interaction.user.tag,
            message: interaction.message
          });

        case this.buttons.profile:
          await interaction.deferUpdate();
          return await panelSystem.renderPanel('profile', interaction.channel, {
            userId: interaction.user.id,
            username: interaction.user.tag,
            message: interaction.message
          });

        case this.buttons.support:
          await interaction.deferUpdate();
          return await panelSystem.renderPanel('support', interaction.channel, {
            userId: interaction.user.id,
            username: interaction.user.tag,
            message: interaction.message
          });

        case this.buttons.help:
          await interaction.deferUpdate();
          return await panelSystem.renderPanel('help', interaction.channel, {
            userId: interaction.user.id,
            username: interaction.user.tag,
            message: interaction.message
          });

        case this.buttons.cart:
          await interaction.deferUpdate();
          return await panelSystem.renderPanel('cart', interaction.channel, {
            userId: interaction.user.id,
            username: interaction.user.tag,
            message: interaction.message
          });

        case this.buttons.points:
          await interaction.deferUpdate();
          return await panelSystem.renderPanel('loyalty', interaction.channel, {
            userId: interaction.user.id,
            username: interaction.user.tag,
            message: interaction.message
          });

        default:
          // Botão não reconhecido
          await interaction.reply({
            content: 'Este botão não está disponível no momento.',
            ephemeral: true
          });
      }
    }

    /**
     * Manipula comando /menu
     * @param {CommandInteraction} interaction - Interação de comando
     * @param {Object} options - Opções adicionais
     * @param {PanelSystem} panelSystem - Sistema de painéis
     */
    async handleCommand(interaction, options, panelSystem) {
      await this.render(interaction.channel, {
        userId: interaction.user.id,
        username: interaction.user.tag
      }, panelSystem);

      await interaction.editReply({
        content: 'Menu principal aberto:',
        ephemeral: true
      });
    }

    /**
     * Envia mensagem de boas-vindas para novos membros
     * @param {GuildMember} member - Novo membro
     */
    async sendWelcome(member) {
      try {
        const embed = new EmbedBuilder()
          .setTitle('🏪 Bem-vindo ao Mercadão das Contas!')
          .setColor(config.discord.embedColors.primary)
          .setDescription(`Olá ${member.user.username}! Seja bem-vindo à maior loja de contas Valorant do Discord.`)
          .addFields(
            { name: '🛍 Nossos Produtos', value: 'Temos as melhores contas Valorant com skins raras e ranks altos.' },
            { name: '💰 Como Comprar', value: 'Use o comando `/menu` para ver todas as opções disponíveis.' },
            { name: '❓ Precisa de Ajuda?', value: 'Use o comando `/ajuda` para obter informações.' }
          )
          .setTimestamp();

        // Tentar enviar DM
        try {
          await member.send({ embeds: [embed] });
        } catch (dmError) {
          logger.warn(`Não foi possível enviar DM para ${member.user.tag}: ${dmError.message}`);

          // Tentar enviar no canal de boas-vindas
          const welcomeChannel = member.guild.channels.cache.find(
            channel => channel.name === 'bem-vindo' || channel.name === 'welcome' || channel.name === 'geral'
          );

          if (welcomeChannel) {
            await welcomeChannel.send({
              content: `Bem-vindo, <@${member.id}>!`,
              embeds: [embed]
            });
          }
        }
      } catch (error) {
        logger.error(`Erro ao enviar mensagem de boas-vindas para ${member.user.tag}:`, error);
      }
    }

    /**
     * Manipula mensagens em DM
     * @param {Message} message - Mensagem recebida
     */
    async handleDM(message) {
      try {
        // Verificar se mensagem é confusa ou se parece com comando
        if (message.content.startsWith('/') ||
            message.content.startsWith('!') ||
            message.content.length < 10) {

          // Mostrar menu principal
          await this.render(message.channel, {
            userId: message.author.id,
            username: message.author.tag
          });

          await message.reply('Aqui está o menu principal. Use os botões abaixo para navegar.');
          return;
        }

        // Tratar como pergunta para o assistente (se existir)
        const assistantService = require('../services/AssistantService');

        if (assistantService && typeof assistantService.getResponse === 'function') {
          const response = await assistantService.getResponse(message.content, message.author.id);

          // Criar embed com a resposta
          const assistantEmbed = new EmbedBuilder()
            .setTitle('🤖 Assistente Virtual')
            .setColor(config.discord.embedColors.primary)
            .setDescription(`**Sua pergunta:** ${message.content}\n\n**Resposta:** ${response.answer}`)
            .setTimestamp();

          // Adicionar sugestões relacionadas se houver
          if (response.suggestions && response.suggestions.length > 0) {
            assistantEmbed.addFields({
              name: 'Perguntas relacionadas',
              value: response.suggestions.join('\n')
            });
          }

          // Botões para feedback
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`assistant_helpful_${response.id}`)
                .setLabel('👍 Útil')
                .setStyle(ButtonStyle.Success),

              new ButtonBuilder()
                .setCustomId(`assistant_not_helpful_${response.id}`)
                .setLabel('👎 Não ajudou')
                .setStyle(ButtonStyle.Danger)
            );

          // Enviar resposta
          await message.reply({
            embeds: [assistantEmbed],
            components: [row]
          });

          return;
        }

        // Fallback: mostrar menu principal
        await this.render(message.channel, {
          userId: message.author.id,
          username: message.author.tag
        });

        await message.reply('Não entendi sua mensagem. Aqui está o menu principal para você navegar.');
      } catch (error) {
        logger.error(`Erro ao processar mensagem DM: ${error.message}`, error);

        try {
          await message.reply('Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.');
        } catch (replyError) {
          logger.error('Erro ao enviar mensagem de erro:', replyError);
        }
      }
    }
  }

  module.exports = new MainPanel();
