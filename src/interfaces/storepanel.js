/**
 * Painel de loja interativo
 * Mostra produtos disponíveis, permite filtros e navegação para compra
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
  const productService = require('../services/ProductService');
  const userService = require('../services/UserService');

  class StorePanel {
    constructor() {
      this.id = 'store';
      this.buttons = {
        back: 'store_back',
        viewAll: 'store_view_all',
        cart: 'store_cart',
        support: 'store_support',
        refresh: 'store_refresh',
        filter_valorant: 'store_filter_valorant',
        filter_steam: 'store_filter_steam',
        filter_lol: 'store_filter_lol',
        viewProduct: 'store_view_product_',
        addToCart: 'store_add_cart_',
        buyNow: 'store_buy_now_'
      };
    }

    /**
     * Renderiza o painel da loja
     * @param {TextChannel} channel - Canal onde o painel será enviado
     * @param {Object} options - Opções adicionais
     * @param {PanelSystem} panelSystem - Sistema de painéis
     */
    async render(channel, options = {}, panelSystem) {
      const userId = options.userId;
      const filter = options.filter || 'all';
      const page = options.page || 1;
      const itemsPerPage = config.discord.panels.itemsPerPage || 5;

      // Registrar visita à loja se tiver userId
      if (userId) {
        await userService.recordActivity(userId, 'STORE_VIEW', {
          filter,
          page
        });
      }

      try {
        // Obter produtos com filtro
        const filters = {};

        if (filter !== 'all') {
          filters.tipo = filter;
        }

        const produtos = await productService.getAvailableProducts(itemsPerPage * 2, filters);

        // Configurar paginação
        const totalProducts = produtos.length;
        const totalPages = Math.ceil(totalProducts / itemsPerPage);
        const startIdx = (page - 1) * itemsPerPage;
        const endIdx = Math.min(startIdx + itemsPerPage, totalProducts);
        const displayedProducts = produtos.slice(startIdx, endIdx);

        // Criar embed da loja
        const embed = new EmbedBuilder()
          .setTitle('🏪 Loja - Mercadão das Contas')
          .setColor(config.discord.embedColors.primary)
          .setDescription(`${filter === 'all' ? 'Todos os produtos' : `Produtos ${filter}`} (${startIdx + 1}-${endIdx} de ${totalProducts})`)
          .setFooter({ text: `Página ${page}/${totalPages || 1} • Use os botões para navegar` })
          .setTimestamp();

        // Adicionar produtos
        if (displayedProducts.length > 0) {
          displayedProducts.forEach((produto, index) => {
            embed.addFields({
              name: `${startIdx + index + 1}. ${produto.nome}`,
              value: `💰 **R$ ${produto.preco.toFixed(2)}**\n${produto.descricao.substring(0, 100)}${produto.descricao.length > 100 ? '...' : ''}`
            });
          });
        } else {
          embed.setDescription('Não há produtos disponíveis no momento. Volte mais tarde!');
        }

        // Botões para categorias
        const row1 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(this.buttons.filter_valorant)
              .setLabel('Valorant')
              .setStyle(filter === 'valorant' ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(this.buttons.filter_steam)
              .setLabel('Steam')
              .setStyle(filter === 'steam' ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(this.buttons.filter_lol)
              .setLabel('League of Legends')
              .setStyle(filter === 'lol' ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(this.buttons.viewAll)
              .setLabel('Ver Todos')
              .setStyle(filter === 'all' ? ButtonStyle.Success : ButtonStyle.Secondary)
          );

        // Botões de paginação e ações
        const row2 = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`store_prev_${page}`)
              .setLabel('⬅️ Anterior')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page <= 1),
            new ButtonBuilder()
              .setCustomId(`store_next_${page}`)
              .setLabel('Próxima ➡️')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page >= totalPages),
            new ButtonBuilder()
              .setCustomId(this.buttons.refresh)
              .setLabel('🔄 Atualizar')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(this.buttons.back)
              .setLabel('Menu Principal')
              .setStyle(ButtonStyle.Danger)
          );

        // Adicionar menu de seleção para produtos se houver produtos
        let row3 = null;

        if (displayedProducts.length > 0) {
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('store_select_product')
            .setPlaceholder('Selecione um produto para ver detalhes');

          displayedProducts.forEach((produto, index) => {
            selectMenu.addOptions({
              label: produto.nome.substring(0, 25),
              description: `R$ ${produto.preco.toFixed(2)}`,
              value: produto.id.toString(),
              emoji: '🛍️'
            });
          });

          row3 = new ActionRowBuilder().addComponents(selectMenu);
        }

        // Enviar ou editar mensagem
        const components = row3 ? [row1, row2, row3] : [row1, row2];

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
        logger.error('Erro ao renderizar painel da loja:', error);

        // Mensagem de erro
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Erro')
          .setColor(config.discord.embedColors.error)
          .setDescription('Ocorreu um erro ao carregar a loja. Por favor, tente novamente.')
          .setTimestamp();

        if (options.message) {
          return await options.message.edit({
            embeds: [errorEmbed],
            components: []
          });
        } else {
          return await channel.send({
            embeds: [errorEmbed],
            components: []
          });
        }
      }
    }

    /**
     * Renderiza detalhes de um produto específico
     * @param {TextChannel} channel - Canal onde a mensagem será enviada
     * @param {string} productId - ID do produto
     * @param {Object} options - Opções adicionais
     */
    async renderProductDetails(channel, productId, options = {}) {
      try {
        // Buscar produto
        const produto = await productService.getProductById(productId);

        if (!produto) {
          const notFoundEmbed = new EmbedBuilder()
            .setTitle('❌ Produto não encontrado')
            .setColor(config.discord.embedColors.error)
            .setDescription('O produto que você está procurando não foi encontrado.')
            .setTimestamp();

          if (options.message) {
            return await options.message.edit({
              embeds: [notFoundEmbed],
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
              embeds: [notFoundEmbed],
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

        // Registrar visualização se tiver userId
        if (options.userId) {
          await userService.recordActivity(options.userId, 'PRODUCT_VIEW', {
            productId: produto.id,
            productName: produto.nome,
            price: produto.preco
          });
        }

        // Criar embed com detalhes do produto
        const embed = new EmbedBuilder()
          .setTitle(`🛍️ ${produto.nome}`)
          .setColor(config.discord.embedColors.primary)
          .setDescription(produto.descricao)
          .addFields(
            { name: 'Preço', value: `💰 **R$ ${produto.preco.toFixed(2)}**`, inline: true },
            { name: 'Tipo', value: produto.tipo, inline: true },
            { name: 'Disponibilidade', value: produto.disponivel ? '✅ Disponível' : '❌ Indisponível', inline: true }
          )
          .setTimestamp();

        // Adicionar detalhes específicos do produto
        if (produto.detalhes) {
          // Para contas Valorant
          if (produto.tipo === 'valorant') {
            if (produto.detalhes.rank) embed.addFields({ name: 'Rank', value: produto.detalhes.rank, inline: true });
            if (produto.detalhes.skins) embed.addFields({ name: 'Skins', value: String(produto.detalhes.skins), inline: true });
            if (produto.detalhes.region) embed.addFields({ name: 'Região', value: produto.detalhes.region, inline: true });
            if (produto.detalhes.level) embed.addFields({ name: 'Nível', value: String(produto.detalhes.level), inline: true });
            if (produto.detalhes.agents) embed.addFields({ name: 'Agentes', value: String(produto.detalhes.agents), inline: true });
          } else {
            // Para outros tipos de produtos
            Object.entries(produto.detalhes).forEach(([key, value]) => {
              if (key && value !== undefined && value !== null) {
                embed.addFields({ name: key, value: String(value), inline: true });
              }
            });
          }
        }

        // Botões de ação
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`${this.buttons.addToCart}${produto.id}`)
              .setLabel('Adicionar ao Carrinho')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🛒')
              .setDisabled(!produto.disponivel),

            new ButtonBuilder()
              .setCustomId(`${this.buttons.buyNow}${produto.id}`)
              .setLabel('Comprar Agora')
              .setStyle(ButtonStyle.Success)
              .setDisabled(!produto.disponivel),

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
        logger.error(`Erro ao renderizar detalhes do produto ${productId}:`, error);

        // Mensagem de erro
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Erro')
          .setColor(config.discord.embedColors.error)
          .setDescription('Ocorreu um erro ao carregar os detalhes do produto. Por favor, tente novamente.')
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
     * Atualiza o painel
     * @param {Message} message - Mensagem do painel
     * @param {Object} options - Opções do painel
     * @param {PanelSystem} panelSystem - Sistema de painéis
     */
    async update(message, options, panelSystem) {
      // Re-renderizar com as mesmas opções
      return await this.render(message.channel, {
        ...options,
        message
      }, panelSystem);
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

      // Ver todos os produtos
      if (customId === this.buttons.viewAll) {
        await interaction.deferUpdate();
        return await this.render(interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message,
          filter: 'all',
          page: 1
        }, panelSystem);
      }

      // Filtrar por categoria
      if (customId === this.buttons.filter_valorant) {
        await interaction.deferUpdate();
        return await this.render(interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message,
          filter: 'valorant',
          page: 1
        }, panelSystem);
      }

      if (customId === this.buttons.filter_steam) {
        await interaction.deferUpdate();
        return await this.render(interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message,
          filter: 'steam',
          page: 1
        }, panelSystem);
      }

      if (customId === this.buttons.filter_lol) {
        await interaction.deferUpdate();
        return await this.render(interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message,
          filter: 'lol',
          page: 1
        }, panelSystem);
      }

      // Navegar para próxima/anterior página
      if (customId.startsWith('store_prev_') || customId.startsWith('store_next_')) {
        const currentPage = parseInt(customId.split('_')[2]);
        const newPage = customId.startsWith('store_prev_') ? currentPage - 1 : currentPage + 1;

        // Obter filtro atual do embed
        const embed = interaction.message.embeds[0];
        const descriptionText = embed.description || '';
        let filter = 'all';

        if (descriptionText.includes('Produtos valorant')) {
          filter = 'valorant';
        } else if (descriptionText.includes('Produtos steam')) {
          filter = 'steam';
        } else if (descriptionText.includes('Produtos lol')) {
          filter = 'lol';
        }

        await interaction.deferUpdate();
        return await this.render(interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message,
          filter,
          page: newPage
        }, panelSystem);
      }

      // Ver detalhes de produto (pelo botão ou select)
      if (customId.startsWith(this.buttons.viewProduct) || customId === 'store_select_product') {
        await interaction.deferUpdate();

        let productId;
        if (customId === 'store_select_product') {
          productId = interaction.values[0];
        } else {
          productId = customId.replace(this.buttons.viewProduct, '');
        }

        return await this.renderProductDetails(interaction.channel, productId, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message
        });
      }

      // Adicionar ao carrinho
      if (customId.startsWith(this.buttons.addToCart)) {
        await interaction.deferReply({ ephemeral: true });

        const productId = customId.replace(this.buttons.addToCart, '');
        const cartService = panelSystem.panels.get('cart');

        if (!cartService) {
          return await interaction.editReply({
            content: 'Serviço de carrinho não disponível no momento.'
          });
        }

        try {
          const result = await cartService.addItem(interaction.user.id, productId);

          if (result.success) {
            return await interaction.editReply({
              content: `✅ Produto adicionado ao carrinho! Você tem ${result.itemCount} item(s) no carrinho.`
            });
          } else {
            return await interaction.editReply({
              content: `❌ Erro ao adicionar ao carrinho: ${result.message}`
            });
          }
        } catch (error) {
          logger.error(`Erro ao adicionar produto ${productId} ao carrinho:`, error);
          return await interaction.editReply({
            content: 'Ocorreu um erro ao adicionar o produto ao carrinho.'
          });
        }
      }

      // Comprar agora
      if (customId.startsWith(this.buttons.buyNow)) {
        await interaction.deferReply({ ephemeral: true });

        const productId = customId.replace(this.buttons.buyNow, '');
        const paymentService = panelSystem.panels.get('payment');

        if (!paymentService) {
          return await interaction.editReply({
            content: 'Serviço de pagamento não disponível no momento.'
          });
        }

        try {
          // Iniciar processo de compra direta
          const result = await paymentService.startDirectPurchase(interaction.user.id, productId);

          if (result.success) {
            // Redirecionar para painel de pagamento
            await interaction.editReply({
              content: 'Redirecionando para pagamento...'
            });

            return await panelSystem.renderPanel('payment', interaction.channel, {
              userId: interaction.user.id,
              username: interaction.user.tag,
              paymentId: result.paymentId,
              productId
            });
          } else {
            return await interaction.editReply({
              content: `❌ Erro ao iniciar compra: ${result.message}`
            });
          }
        } catch (error) {
          logger.error(`Erro ao iniciar compra direta do produto ${productId}:`, error);
          return await interaction.editReply({
            content: 'Ocorreu um erro ao iniciar o processo de compra.'
          });
        }
      }

      // Ver carrinho
      if (customId === this.buttons.cart) {
        await interaction.deferUpdate();
        return await panelSystem.renderPanel('cart', interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message
        });
      }

      // Abrir suporte
      if (customId === this.buttons.support) {
        await interaction.deferUpdate();
        return await panelSystem.renderPanel('support', interaction.channel, {
          userId: interaction.user.id,
          username: interaction.user.tag,
          message: interaction.message
        });
      }
    }

    /**
     * Manipula comando /loja
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
        content: 'Loja aberta:',
        ephemeral: true
      });
    }
  }

  module.exports = new StorePanel();
