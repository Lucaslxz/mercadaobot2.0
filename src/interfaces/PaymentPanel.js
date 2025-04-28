/**
 * Painel de pagamento
 * Processa pagamentos e mostra informações para o usuário
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
  const paymentService = require('../services/PaymentService');
  const productService = require('../services/ProductService');

  class PaymentPanel {
    constructor() {
      this.id = 'payment';
      this.buttons = {
        back: 'payment_back',
        cancel: 'payment_cancel',
        check: 'payment_check',
        confirm: 'payment_confirm'
      };
    }

    /**
     * Renderiza o painel de pagamento
     * @param {TextChannel} channel - Canal onde o painel será enviado
     * @param {Object} options - Opções adicionais
     * @param {PanelSystem} panelSystem - Sistema de painéis
     */
    async render(channel, options = {}, panelSystem) {
      try {
        const userId = options.userId;
        const paymentId = options.paymentId;
        const cart = options.cart;

        // Verificar opções necessárias
        if (!userId) {
          throw new Error('ID do usuário não fornecido');
        }

        // Buscar informações do pagamento ou criar novo
        let payment;
        if (paymentId) {
          // Buscar pagamento existente
          // Implementação completa dependeria de um método como getPaymentById
          payment = { id: paymentId };
        } else if (options.productId) {
          // Compra direta de um produto
          payment = await this.createDirectPayment(userId, options.username, options.productId);
        } else if (cart && cart.items.length > 0) {
          // Checkout do carrinho (implementação básica)
          payment = {
            id: 'cart-payment',
            items: cart.items,
            total: cart.items.reduce((sum, item) => sum + item.price, 0)
          };
        } else {
          throw new Error('Dados insuficientes para pagamento');
        }

        // Registrar atividade do usuário
        await userService.recordActivity(userId, 'PAYMENT_VIEW', {
          paymentId: payment.id,
          timestamp: new Date()
        });

        // Criar embed do pagamento
        const embed = new EmbedBuilder()
          .setTitle('💰 Pagamento')
          .setColor(config.discord.embedColors.primary)
          .setDescription('Para concluir sua compra, siga as instruções abaixo:')
          .addFields(
            {
              name: '📦 Produto',
              value: payment.productName || 'Múltiplos produtos'
            },
            {
              name: '💲 Valor',
              value: `R$ ${payment.amount?.toFixed(2) || payment.total?.toFixed(2) || '0,00'}`
            },
            {
              name: '🔍 Status',
              value: payment.status || 'PENDENTE'
            },
            {
              name: '⏳ Tempo Limite',
              value: 'O pagamento deve ser realizado em até 30 minutos.'
            }
          )
          .setFooter({ text: 'Mercadão das Contas - Sistema de Pagamento' })
          .setTimestamp();

        // Se tiver código PIX, adicionar
        if (payment.pixCode) {
          embed.addFields(
            {
              name: '📱 PIX Copia e Cola',
              value: '```' + payment.pixCode + '```'
            }
          );
        }

        // Se tiver QR Code, adicionar
        if (payment.qrCodeUrl) {
          embed.setImage(payment.qrCodeUrl);
        }

        // Botões interativos
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(this.buttons.check)
              .setLabel('Verifiquei o Pagamento')
              .setStyle(ButtonStyle.Success)
              .setEmoji('✅'),
            new ButtonBuilder()
              .setCustomId(this.buttons.cancel)
              .setLabel('Cancelar')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('❌'),
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
        logger.error('Erro ao renderizar painel de pagamento:', error);

        // Mensagem de erro
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Erro')
          .setColor(config.discord.embedColors.error)
          .setDescription('Ocorreu um erro ao processar o pagamento. Por favor, tente novamente.')
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

      // Voltar ao menu anterior ou carrinho
      if (customId === this.buttons.back) {
        await interaction.deferUpdate();

        // Verificar se veio do carrinho
        const cartPanel = panelSystem.panels.get('cart');
        const hasItems = cartPanel && cartPanel.getCart(interaction.user.id).items.length > 0;

        if (hasItems) {
          return await panelSystem.renderPanel('cart', interaction.channel, {
            userId: interaction.user.id,
            username: interaction.user.tag,
            message: interaction.message
          });
        } else {
          return await panelSystem.renderPanel('main', interaction.channel, {
            userId: interaction.user.id,
            username: interaction.user.tag,
            message: interaction.message
          });
        }
      }

      // Verificação de pagamento
      if (customId === this.buttons.check) {
        await interaction.deferReply({ ephemeral: true });

        // Esta é uma implementação básica, em produção deve verificar status real
        await interaction.editReply({
          content: '⏳ **Verificando pagamento...**\n\nSeu pagamento está sendo processado manualmente. Um administrador irá verificar e aprovar em breve.\n\nVocê receberá uma notificação assim que a aprovação for concluída.'
        });

        // Registrar verificação de pagamento
        await userService.recordActivity(interaction.user.id, 'PAYMENT_CHECK', {
          timestamp: new Date()
        });

        return;
      }

      // Cancelar pagamento
      if (customId === this.buttons.cancel) {
        await interaction.deferUpdate();

        // Registrar cancelamento
        await userService.recordActivity(interaction.user.id, 'PAYMENT_CANCELLED', {
          timestamp: new Date()
        });

        // Voltar para o menu principal
        return await panelSystem.renderPanel('main', interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message
        });
      }
    }

    /**
     * Cria um pagamento direto para um produto
     * @param {string} userId - ID do usuário
     * @param {string} username - Nome do usuário
     * @param {string} productId - ID do produto
     * @returns {Promise<Object>} - Dados do pagamento criado
     */
    async createDirectPayment(userId, username, productId) {
      try {
        // Obter detalhes do produto
        const product = await productService.getProductById(productId);

        if (!product) {
          throw new Error('Produto não encontrado');
        }

        if (!product.disponivel || product.vendido) {
          throw new Error('Produto não está disponível');
        }

        // Criar pagamento
        const paymentData = {
          userId,
          userName: username,
          productId: product.id,
          productName: product.nome,
          amount: product.preco
        };

        // Esta é uma implementação simulada, em produção usaria paymentService.createPayment
        const payment = {
          id: 'direct-payment-' + Date.now(),
          ...paymentData,
          status: 'PENDING',
          createdAt: new Date(),
          // Códigos simulados
          pixCode: 'SIMULACAO-PIX-CODIGO-00000000001',
          qrCodeUrl: 'https://i.imgur.com/placeholder-qr.png'
        };

        return payment;
      } catch (error) {
        logger.error('Erro ao criar pagamento direto:', error);
        throw error;
      }
    }

    /**
     * Inicia um processo de compra direta
     * @param {string} userId - ID do usuário
     * @param {string} productId - ID do produto
     * @returns {Promise<Object>} - Status da operação
     */
    async startDirectPurchase(userId, productId) {
      try {
        // Obter detalhes do usuário
        const user = await userService.getUserProfile(userId);
        const username = user?.username || userId;

        // Criar pagamento simulado
        const payment = await this.createDirectPayment(userId, username, productId);

        return {
          success: true,
          paymentId: payment.id,
          message: 'Pagamento iniciado com sucesso'
        };
      } catch (error) {
        logger.error('Erro ao iniciar compra direta:', error);
        return {
          success: false,
          message: error.message || 'Erro ao iniciar pagamento'
        };
      }
    }
  }

  module.exports = new PaymentPanel();
