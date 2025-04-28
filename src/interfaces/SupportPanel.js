/**
 * Painel de suporte
 * Permite criar tickets de suporte e FAQ
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
  } = require('discord.js');
  const { logger } = require('../utils/helpers');
  const config = require('../../config');
  const userService = require('../services/UserService');

  class SupportPanel {
    constructor() {
      this.id = 'support';
      this.buttons = {
        back: 'support_back',
        create: 'support_create_ticket',
        faq: 'support_faq',
        contact: 'support_contact'
      };
    }

    /**
     * Renderiza o painel de suporte
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

        // Registrar visualização do suporte
        await userService.recordActivity(userId, 'SUPPORT_VIEW', {
          timestamp: new Date()
        });

        // Criar embed do suporte
        const embed = new EmbedBuilder()
          .setTitle('🎫 Central de Suporte')
          .setColor(config.discord.embedColors.primary)
          .setDescription('Precisa de ajuda? Escolha uma das opções abaixo:')
          .addFields(
            {
              name: '❓ Perguntas Frequentes',
              value: 'Veja respostas para as dúvidas mais comuns.'
            },
            {
              name: '🎫 Abrir Ticket',
              value: 'Crie um ticket para falar com nossa equipe de suporte.'
            },
            {
              name: '📱 Contato',
              value: 'Outras formas de entrar em contato conosco.'
            }
          )
          .setFooter({ text: 'Mercadão das Contas - Central de Suporte' })
          .setTimestamp();

        // Botões interativos
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(this.buttons.faq)
              .setLabel('Perguntas Frequentes')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('❓'),
            new ButtonBuilder()
              .setCustomId(this.buttons.create)
              .setLabel('Abrir Ticket')
              .setStyle(ButtonStyle.Success)
              .setEmoji('🎫'),
            new ButtonBuilder()
              .setCustomId(this.buttons.contact)
              .setLabel('Contato')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('📱'),
            new ButtonBuilder()
              .setCustomId(this.buttons.back)
              .setLabel('Voltar')
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
        logger.error('Erro ao renderizar painel de suporte:', error);

        // Mensagem de erro
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Erro')
          .setColor(config.discord.embedColors.error)
          .setDescription('Ocorreu um erro ao carregar o suporte. Por favor, tente novamente.')
          .setTimestamp();

        if (options.message) {
          return await options.message.edit({
            embeds: [errorEmbed],
            components: [
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(this.buttons.back)
                    .setLabel('Voltar')
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
                    .setLabel('Voltar')
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

      // Mostrar FAQ
      if (customId === this.buttons.faq) {
        await interaction.deferReply({ ephemeral: true });

        // Mostrar perguntas frequentes
        const faqEmbed = new EmbedBuilder()
          .setTitle('❓ Perguntas Frequentes')
          .setColor(config.discord.embedColors.primary)
          .addFields(
            {
              name: '1. Como funciona o sistema de compra?',
              value: 'Você escolhe o produto desejado, realiza o pagamento via PIX e, após a confirmação, recebe os dados de acesso da conta.'
            },
            {
              name: '2. Quanto tempo leva para receber minha conta?',
              value: 'Após a confirmação do pagamento, sua conta é entregue imediatamente se houver um administrador online. Caso contrário, o tempo máximo é de 1 hora em horário comercial.'
            },
            {
              name: '3. O que fazer se a conta não funcionar?',
              value: 'Abra um ticket de suporte imediatamente informando o problema. É importante tentar acessar a conta logo após a compra.'
            },
            {
              name: '4. Vocês oferecem garantia?',
              value: 'Oferecemos suporte para o primeiro acesso. Após o acesso bem-sucedido, recomendamos alterar o email e senha imediatamente.'
            },
            {
              name: '5. Como funciona o sistema de pontos?',
              value: 'Cada compra gera pontos de fidelidade que podem ser usados como desconto em compras futuras.'
            }
          )
          .setFooter({ text: 'Para outras dúvidas, abra um ticket de suporte.' });

        await interaction.editReply({
          embeds: [faqEmbed]
        });

        return;
      }

      // Mostrar informações de contato
      if (customId === this.buttons.contact) {
        await interaction.deferReply({ ephemeral: true });

        // Mostrar contatos
        await interaction.editReply({
          content: '📱 **Informações de Contato**\n\n' +
                  'Email: suporte@mercadaodascontas.com\n' +
                  'Instagram: @mercadaodascontas\n' +
                  'Twitter: @mktcontas\n' +
                  'Horário de atendimento: Segunda a Sexta, 9h às 22h'
        });

        return;
      }

      // Abrir ticket
      if (customId === this.buttons.create) {
        // Mostrar modal para criar ticket
        const modal = new ModalBuilder()
          .setCustomId('support_ticket_modal')
          .setTitle('Abrir Ticket de Suporte');

        // Campos do formulário
        const subjectInput = new TextInputBuilder()
          .setCustomId('ticket_subject')
          .setLabel('Assunto do ticket')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Problema na compra, Dúvida sobre produto...')
          .setRequired(true)
          .setMaxLength(100);

        const descriptionInput = new TextInputBuilder()
          .setCustomId('ticket_description')
          .setLabel('Descreva seu problema em detalhes')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Informe todos os detalhes do seu problema ou dúvida...')
          .setRequired(true)
          .setMaxLength(1000);

        // Adicionar campos ao modal
        modal.addComponents(
          new ActionRowBuilder().addComponents(subjectInput),
          new ActionRowBuilder().addComponents(descriptionInput)
        );

        // Mostrar o modal
        return await interaction.showModal(modal);
      }

      // Processar envio do modal de ticket
      if (interaction.isModalSubmit() && interaction.customId === 'support_ticket_modal') {
        await interaction.deferReply({ ephemeral: true });

        // Obter dados do formulário
        const subject = interaction.fields.getTextInputValue('ticket_subject');
        const description = interaction.fields.getTextInputValue('ticket_description');

        // Registrar criação de ticket (simulação)
        await userService.recordActivity(interaction.user.id, 'TICKET_CREATED', {
          subject,
          timestamp: new Date()
        });

        // Responder ao usuário
        await interaction.editReply({
          content: '✅ **Ticket Criado com Sucesso!**\n\n' +
                  `**Assunto:** ${subject}\n\n` +
                  'Sua solicitação foi registrada e nossa equipe de suporte responderá em breve. ' +
                  'Você receberá uma notificação quando houver uma resposta.'
        });

        return;
      }
    }

    /**
     * Manipula comando /suporte
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
        content: 'Central de suporte aberta:',
        ephemeral: true
      });
    }
  }

  module.exports = new SupportPanel();
