/**
 * Painel de carrinho de compras
 * Permite adicionar, remover produtos e finalizar compra
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
  } = require('discord.js');
  const { logger } = require('../utils/helpers');
  const config = require('../../config');
  const userService = require('../services/UserService');
  const productService = require('../services/ProductService');

  class CartPanel {
    constructor() {
      this.id = 'cart';
      this.buttons = {
        back: 'cart_back',
        clear: 'cart_clear',
        checkout: 'cart_checkout',
        remove: 'cart_remove_',
        continue: 'cart_continue'
      };

      // Armazenamento em memória dos carrinhos (temporário)
      // Em produção, deve ser movido para uma solução persistente
      this.carts = new Map();
    }

    /**
     * Renderiza o painel do carrinho
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

        // Obter itens do carrinho
        const cart = this.getCart(userId);

        // Registrar visualização do carrinho
        await userService.recordActivity(userId, 'CART_VIEW', {
          itemCount: cart.items.length,
          timestamp: new Date()
        });

        // Criar embed do carrinho
        const embed = new EmbedBuilder()
          .setTitle('🛒 Seu Carrinho')
          .setColor(config.discord.embedColors.primary)
          .setTimestamp()
          .setFooter({ text: 'Mercadão das Contas - Seu carrinho de compras' });

        if (cart.items.length === 0) {
          embed.setDescription('Seu carrinho está vazio.\nVá para a loja e adicione produtos!');
        } else {
          // Calcular total
          const total = cart.items.reduce((sum, item) => sum + item.price, 0);

          embed.setDescription(`Você tem ${cart.items.length} item(s) no carrinho.`);

          // Adicionar itens
          cart.items.forEach((item, index) => {
            embed.addFields({
              name: `${index + 1}. ${item.name}`,
              value: `💰 **Preço**: R$ ${item.price.toFixed(2)}`
            });
          });

          // Adicionar total
          embed.addFields({
            name: '💲 Total',
            value: `R$ ${total.toFixed(2)}`
          });
        }

        // Botões interativos
        const row1 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(this.buttons.continue)
              .setLabel('Continuar Comprando')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🛍️'),
            new ButtonBuilder()
              .setCustomId(this.buttons.checkout)
              .setLabel('Finalizar Compra')
              .setStyle(ButtonStyle.Success)
              .setEmoji('💳')
              .setDisabled(cart.items.length === 0)
          );

        const row2 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(this.buttons.clear)
              .setLabel('Limpar Carrinho')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(cart.items.length === 0),
            new ButtonBuilder()
              .setCustomId(this.buttons.back)
              .setLabel('Menu Principal')
              .setStyle(ButtonStyle.Secondary)
          );

        // Menu de seleção para remover itens (se houver)
        let components = [row1, row2];

        if (cart.items.length > 0) {
          const removeMenu = new StringSelectMenuBuilder()
            .setCustomId('cart_remove_item')
            .setPlaceholder('Selecione um item para remover...');

          cart.items.forEach((item, index) => {
            removeMenu.addOptions({
              label: `${index + 1}. ${item.name.substring(0, 25)}`,
              description: `R$ ${item.price.toFixed(2)}`,
              value: index.toString()
            });
          });

          const row3 = new ActionRowBuilder()
            .addComponents(removeMenu);

          components.push(row3);
        }

        // Enviar ou editar mensagem
        if (options.message) {
          return await options.message.edit({
            embeds: [embed],
            components: components
          });
        } else {
          return await channel.send({
            embeds: [embed],
            components: components
          });
        }
      } catch (error) {
        logger.error('Erro ao renderizar painel do carrinho:', error);

        // Mensagem de erro
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Erro')
          .setColor(config.discord.embedColors.error)
          .setDescription('Ocorreu um erro ao carregar seu carrinho. Por favor, tente novamente.')
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

      // Continuar comprando
      if (customId === this.buttons.continue) {
        await interaction.deferUpdate();
        return await panelSystem.renderPanel('store', interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message
        });
      }

      // Limpar carrinho
      if (customId === this.buttons.clear) {
        await interaction.deferUpdate();

        // Limpar carrinho do usuário
        this.clearCart(interaction.user.id);

        // Registrar atividade
        await userService.recordActivity(interaction.user.id, 'CART_CLEARED', {
          timestamp: new Date()
        });

        // Atualizar painel
        return await this.render(interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message
        }, panelSystem);
      }

      // Remover item (via menu de seleção)
      if (customId === 'cart_remove_item') {
        await interaction.deferUpdate();

        const index = parseInt(interaction.values[0]);
        const cart = this.getCart(interaction.user.id);

        if (index >= 0 && index < cart.items.length) {
          const removedItem = cart.items[index];
          cart.items.splice(index, 1);

          // Registrar atividade
          await userService.recordActivity(interaction.user.id, 'CART_REMOVE_ITEM', {
            productId: removedItem.id,
            productName: removedItem.name,
            timestamp: new Date()
          });
        }

        // Atualizar painel
        return await this.render(interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message
        }, panelSystem);
      }

      // Finalizar compra
      if (customId === this.buttons.checkout) {
        await interaction.deferUpdate();

        const cart = this.getCart(interaction.user.id);

        if (cart.items.length === 0) {
          // Carrinho vazio, mostrar mensagem
          await interaction.followUp({
            content: 'Seu carrinho está vazio. Adicione produtos antes de finalizar a compra.',
            ephemeral: true
          });

          return;
        }

        // Redirecionar para painel de pagamento
        return await panelSystem.renderPanel('payment', interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message,
          cart: cart
        });
      }
    }

    /**
     * Adiciona um item ao carrinho
     * @param {string} userId - ID do usuário
     * @param {string} productId - ID do produto
     * @returns {Promise<Object>} - Status da operação
     */
    async addItem(userId, productId) {
      try {
        // Obter detalhes do produto
        const product = await productService.getProductById(productId);

        if (!product) {
          return {
            success: false,
            message: 'Produto não encontrado',
            itemCount: 0
          };
        }

        if (!product.disponivel || product.vendido) {
          return {
            success: false,
            message: 'Produto não está disponível',
            itemCount: 0
          };
        }

        // Obter carrinho do usuário
        const cart = this.getCart(userId);

        // Verificar limite de itens
        const maxItems = config.cart?.maxItems || 10;
        if (cart.items.length >= maxItems) {
          return {
            success: false,
            message: `Limite máximo de ${maxItems} itens no carrinho`,
            itemCount: cart.items.length
          };
        }

        // Verificar se o produto já está no carrinho
        const existingItem = cart.items.find(item => item.id === productId);
        if (existingItem) {
          return {
            success: false,
            message: 'Este produto já está no seu carrinho',
            itemCount: cart.items.length
          };
        }

        // Adicionar ao carrinho
        cart.items.push({
          id: product.id,
          name: product.nome,
          price: product.preco,
          type: product.tipo
        });

        // Atualizar timestamp
        cart.updatedAt = new Date();

        // Registrar atividade
        await userService.recordActivity(userId, 'CART_ADD_ITEM', {
          productId: product.id,
          productName: product.nome,
          timestamp: cart.updatedAt
        });

        return {
          success: true,
          message: 'Produto adicionado ao carrinho',
          itemCount: cart.items.length
        };
      } catch (error) {
        logger.error(`Erro ao adicionar produto ${productId} ao carrinho:`, error);
        return {
          success: false,
          message: 'Ocorreu um erro ao adicionar o produto ao carrinho',
          itemCount: 0
        };
      }
    }

    /**
     * Obtém o carrinho de um usuário
     * @param {string} userId - ID do usuário
     * @returns {Object} - Carrinho do usuário
     */
    getCart(userId) {
      // Verificar se o usuário já tem um carrinho
      if (!this.carts.has(userId)) {
        // Criar novo carrinho
        this.carts.set(userId, {
          userId,
          items: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      return this.carts.get(userId);
    }

    /**
     * Limpa o carrinho de um usuário
     * @param {string} userId - ID do usuário
     */
    clearCart(userId) {
      this.carts.set(userId, {
        userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    /**
     * Manipula comando /carrinho
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
        content: 'Carrinho aberto:',
        ephemeral: true
      });
    }
  }

  module.exports = new CartPanel();
