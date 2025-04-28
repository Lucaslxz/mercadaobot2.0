/**
 * Painel de perfil de usuário
 * Exibe informações do usuário, histórico de compras e pontos de fidelidade
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

  class ProfilePanel {
    constructor() {
      this.id = 'profile';
      this.buttons = {
        back: 'profile_back',
        points: 'profile_points',
        purchases: 'profile_purchases',
        refresh: 'profile_refresh',
      };
    }

    /**
     * Renderiza o painel de perfil do usuário
     * @param {TextChannel} channel - Canal onde o painel será enviado
     * @param {Object} options - Opções adicionais
     * @param {PanelSystem} panelSystem - Sistema de painéis
     */
    async render(channel, options = {}, panelSystem) {
      try {
        const userId = options.userId;
        if (!userId) {
          throw new Error('ID do usuário não fornecido');
        }

        // Obter perfil do usuário
        const userProfile = await userService.getUserProfile(userId);

        if (!userProfile) {
          // Criar perfil caso não exista
          await userService.createUserProfile({
            userId,
            username: options.username || 'Usuário',
            createdAt: new Date()
          });
        }

        // Registrar visualização do perfil
        await userService.recordActivity(userId, 'PROFILE_VIEW', {
          timestamp: new Date()
        });

        // Tentar obter histórico de compras
        let purchaseHistory = [];
        try {
          purchaseHistory = await userService.getPurchaseHistory(userId);
        } catch (error) {
          logger.error(`Erro ao obter histórico de compras do usuário ${userId}:`, error);
        }

        // Criar embed do perfil
        const embed = new EmbedBuilder()
          .setTitle('👤 Seu Perfil')
          .setColor(config.discord.embedColors.primary)
          .setDescription(`Olá, <@${userId}>!\nAqui estão suas informações e histórico.`)
          .addFields(
            {
              name: '📊 Informações',
              value: `**Usuário**: ${userProfile?.username || options.username || 'Desconhecido'}\n**ID**: ${userId}\n**Membro desde**: ${new Date(userProfile?.createdAt || Date.now()).toLocaleDateString('pt-BR')}`
            },
            {
              name: '🛍️ Compras',
              value: purchaseHistory.length > 0
                ? `Você realizou ${purchaseHistory.length} compra(s).\nUse o botão abaixo para ver detalhes.`
                : 'Você ainda não realizou nenhuma compra.\nUse /loja para explorar nossos produtos!'
            }
          )
          .setFooter({ text: 'Mercadão das Contas - Seu perfil' })
          .setTimestamp();

        // Botões interativos
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(this.buttons.purchases)
              .setLabel('Ver Minhas Compras')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🛍️'),
            new ButtonBuilder()
              .setCustomId(this.buttons.points)
              .setLabel('Pontos de Fidelidade')
              .setStyle(ButtonStyle.Success)
              .setEmoji('🎁'),
            new ButtonBuilder()
              .setCustomId(this.buttons.refresh)
              .setLabel('Atualizar')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🔄'),
            new ButtonBuilder()
              .setCustomId(this.buttons.back)
              .setLabel('Menu Principal')
              .setStyle(ButtonStyle.Secondary)
          );

        // Enviar ou editar mensagem
        if (options.message) {
          return await options.message.edit({
            embeds: [embed],
            components: [row]
          });
        } else {
          return await channel.send({
            embeds: [embed],
            components: [row]
          });
        }
      } catch (error) {
        logger.error('Erro ao renderizar painel de perfil:', error);

        // Mensagem de erro
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Erro')
          .setColor(config.discord.embedColors.error)
          .setDescription('Ocorreu um erro ao carregar seu perfil. Por favor, tente novamente.')
          .setTimestamp();

        if (options.message) {
          return await options.message.edit({
            embeds: [errorEmbed],
            components: [
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(this.buttons.back)
                    .setLabel('Menu Principal')
                    .setStyle(ButtonStyle.Primary)
                )
            ]
          });
        } else {
          return await channel.send({
            embeds: [errorEmbed],
            components: [
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(this.buttons.back)
                    .setLabel('Menu Principal')
                    .setStyle(ButtonStyle.Primary)
                )
            ]
          });
        }
      }
    }

    /**
     * Manipula interações com o painel
     * @param {Interaction} interaction - Interação do Discord
     * @param {PanelSystem} panelSystem - Sistema de painéis
     */
    async handleInteraction(interaction, panelSystem) {
      const customId = interaction.customId;

      // Voltar ao menu principal
      if (customId === this.buttons.back) {
        await interaction.deferUpdate();
        return await panelSystem.renderPanel('main', interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message
        });
      }

      // Atualizar painel
      if (customId === this.buttons.refresh) {
        await interaction.deferUpdate();
        return await this.render(interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message
        }, panelSystem);
      }

      // Ver compras (funcionalidade básica)
      if (customId === this.buttons.purchases) {
        await interaction.deferReply({ ephemeral: true });

        try {
          const purchases = await userService.getPurchaseHistory(interaction.user.id);

          if (purchases.length === 0) {
            return await interaction.editReply({
              content: 'Você ainda não realizou nenhuma compra.'
            });
          }

          // Mostrar últimas 5 compras
          const recentPurchases = purchases.slice(0, 5);
          let purchaseText = '**Suas compras recentes:**\n\n';

          recentPurchases.forEach((purchase, index) => {
            const date = new Date(purchase.date).toLocaleDateString('pt-BR');
            purchaseText += `**${index + 1}.** ${purchase.productName}\n`;
            purchaseText += `💰 **Valor:** R$ ${purchase.amount.toFixed(2)}\n`;
            purchaseText += `📅 **Data:** ${date}\n\n`;
          });

          if (purchases.length > 5) {
            purchaseText += `*E mais ${purchases.length - 5} outras compras...*`;
          }

          return await interaction.editReply({
            content: purchaseText
          });
        } catch (error) {
          logger.error('Erro ao buscar compras:', error);
          return await interaction.editReply({
            content: 'Ocorreu um erro ao buscar seu histórico de compras.'
          });
        }
      }

      // Ver pontos de fidelidade (versão básica)
      if (customId === this.buttons.points) {
        await interaction.deferReply({ ephemeral: true });

        return await interaction.editReply({
          content: '🎁 **Sistema de Pontos de Fidelidade**\n\nO sistema de pontos está em implementação. Em breve você poderá acumular pontos em suas compras e trocá-los por descontos exclusivos!'
        });
      }
    }

    /**
     * Manipula comando /perfil
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
        content: 'Perfil aberto:',
        ephemeral: true
      });
    }
  }

  module.exports = new ProfilePanel();
