/**
 * Painel administrativo
 * Interface de gerenciamento para administradores
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { logger } = require('../utils/helpers');
const config = require('../../config');
const productService = require('../services/ProductService');
const paymentService = require('../services/PaymentService');
const userService = require('../services/UserService');
const { formatDate, formatCurrency } = require('../utils/helpers');

class AdminPanel {
  constructor() {
    this.id = 'admin';
    this.buttons = {
      payments: 'admin_payments',
      products: 'admin_products',
      users: 'admin_users',
      stats: 'admin_stats',
      sync: 'admin_sync',
      refresh: 'admin_refresh',
      back: 'admin_back',
      approve: 'admin_approve_',
      reject: 'admin_reject_',
      addProduct: 'admin_add_product',
      editProduct: 'admin_edit_product_',
      removeProduct: 'admin_remove_product_',
      blockUser: 'admin_block_user_',
      unblockUser: 'admin_unblock_user_'
    };
  }

  /**
   * Renderiza o painel administrativo principal
   * @param {TextChannel} channel - Canal onde o painel será enviado
   * @param {Object} options - Opções adicionais
   * @param {PanelSystem} panelSystem - Sistema de painéis
   */
  async render(channel, options = {}, panelSystem) {
    try {
      // Verificar permissões se houver membro
      if (options.member && !options.member.permissions.has('Administrator')) {
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Acesso Negado')
          .setColor(config.discord.embedColors.error)
          .setDescription('Você não tem permissão para acessar o painel de administração.')
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

      // Obter estatísticas básicas
      const pendingPayments = await paymentService.getPendingApprovals();
      const availableProducts = await productService.getAvailableProducts();

      // Criar embed do painel admin
      const embed = new EmbedBuilder()
        .setTitle('🔧 Painel de Administração')
        .setColor(config.discord.embedColors.primary)
        .setDescription('Bem-vindo ao painel de administração. Selecione uma função:')
        .addFields(
          { name: '💰 Pagamentos', value: `${pendingPayments.length} pagamentos pendentes`, inline: true },
          { name: '📦 Produtos', value: `${availableProducts.length} produtos disponíveis`, inline: true },
          { name: '📊 Sistema', value: 'Monitoramento e controle', inline: true }
        )
        .setFooter({ text: 'Painel Administrativo - Use os botões abaixo para navegar' })
        .setTimestamp();

      // Botões principais
      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(this.buttons.payments)
            .setLabel(`Pagamentos (${pendingPayments.length})`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💰'),

          new ButtonBuilder()
            .setCustomId(this.buttons.products)
            .setLabel('Produtos')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📦'),

          new ButtonBuilder()
            .setCustomId(this.buttons.users)
            .setLabel('Usuários')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👥')
        );

      // Botões secundários
      const row2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(this.buttons.stats)
            .setLabel('Estatísticas')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊'),

          new ButtonBuilder()
            .setCustomId(this.buttons.sync)
            .setLabel('Sincronizar Produtos')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔄'),

          new ButtonBuilder()
            .setCustomId(this.buttons.refresh)
            .setLabel('Atualizar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔍')
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
    } catch (error) {
      logger.error('Erro ao renderizar painel administrativo:', error);

      // Mensagem de erro
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setColor(config.discord.embedColors.error)
        .setDescription('Ocorreu um erro ao carregar o painel administrativo. Por favor, tente novamente.')
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
   * Renderiza painel de gerenciamento de pagamentos
   * @param {TextChannel} channel - Canal onde o painel será enviado
   * @param {Object} options - Opções adicionais
   */
  async renderPaymentsPanel(channel, options = {}) {
    try {
      // Buscar pagamentos pendentes
      const pendingPayments = await paymentService.getPendingApprovals();

      // Criar embed
      const embed = new EmbedBuilder()
        .setTitle('💰 Gerenciamento de Pagamentos')
        .setColor(config.discord.embedColors.primary)
        .setDescription(`${pendingPayments.length} pagamentos aguardando aprovação.`)
        .setTimestamp();

      if (pendingPayments.length === 0) {
        embed.addFields({
          name: 'Nenhum pagamento pendente',
          value: 'Não há pagamentos aguardando aprovação no momento.'
        });

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(this.buttons.back)
              .setLabel('Voltar')
              .setStyle(ButtonStyle.Secondary)
          );

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
      }

      // Adicionar informações dos pagamentos (primeiros 5)
      const displayedPayments = pendingPayments.slice(0, 5);

      displayedPayments.forEach((payment, index) => {
        const timeUntilExpire = new Date(payment.expiresAt) - new Date();
        const expiresText = timeUntilExpire > 0
          ? `Expira em ${Math.ceil(timeUntilExpire / 60000)}min`
          : 'EXPIRADO';

        embed.addFields({
          name: `#${index + 1} - ${payment.productName}`,
          value: `👤 **Usuário**: ${payment.userName}\n💲 **Valor**: R$ ${payment.amount.toFixed(2)}\n⏰ **Status**: ${expiresText}\n🆔 **ID**: ${payment.id.toString().substring(0, 8)}`
        });
      });

      // Se houver mais pagamentos do que os mostrados
      if (pendingPayments.length > 5) {
        embed.addFields({
          name: 'Mais pagamentos',
          value: `+ ${pendingPayments.length - 5} pagamentos não mostrados`
        });
      }

      // Menu de seleção para pagamentos
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_select_payment')
        .setPlaceholder('Selecione um pagamento para gerenciar');

      displayedPayments.forEach((payment, index) => {
        selectMenu.addOptions({
          label: `${index + 1}. ${payment.productName.substring(0, 25)}`,
          description: `R$ ${payment.amount.toFixed(2)} - ${payment.userName}`,
          value: payment.id.toString()
        });
      });

      const row1 = new ActionRowBuilder().addComponents(selectMenu);

      // Botões de ação
      const row2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(this.buttons.refresh)
            .setLabel('Atualizar')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(this.buttons.back)
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Primary)
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
    } catch (error) {
      logger.error('Erro ao renderizar painel de pagamentos:', error);

      // Mensagem de erro
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setColor(config.discord.embedColors.error)
        .setDescription('Ocorreu um erro ao carregar os pagamentos. Por favor, tente novamente.')
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
   * Renderiza detalhes de um pagamento específico
   * @param {TextChannel} channel - Canal onde a mensagem será enviada
   * @param {string} paymentId - ID do pagamento
   * @param {Object} options - Opções adicionais
   */
  async renderPaymentDetails(channel, paymentId, options = {}) {
    try {
      // Importações necessárias
      const { Payment, Product } = require('../models');

      // Buscar pagamento
      const payment = await Payment.findByPk(paymentId, {
        include: [{ model: Product, as: 'Product' }]
      });

      if (!payment) {
        // Pagamento não encontrado
        const notFoundEmbed = new EmbedBuilder()
          .setTitle('❌ Pagamento não encontrado')
          .setColor(config.discord.embedColors.error)
          .setDescription(`Não foi possível encontrar o pagamento com ID ${paymentId.substring(0, 8)}.`)
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

      // Calcular status do tempo
      let statusText = '';
      const now = new Date();
      const created = new Date(payment.createdAt);
      const expires = new Date(payment.expiresAt);

      if (payment.status === 'COMPLETED') {
        statusText = '✅ APROVADO';
      } else if (payment.status === 'REJECTED') {
        statusText = '❌ REJEITADO';
      } else if (payment.status === 'EXPIRED' || expires < now) {
        statusText = '⏱️ EXPIRADO';
      } else {
        const timeLeft = expires - now;
        const minutesLeft = Math.ceil(timeLeft / (1000 * 60));
        statusText = `⏳ PENDENTE (${minutesLeft}min restantes)`;
      }

      // Criar embed com detalhes do pagamento
      const embed = new EmbedBuilder()
        .setTitle(`💰 Detalhes do Pagamento #${payment.id.toString().substring(0, 8)}`)
        .setColor(config.discord.embedColors.primary)
        .addFields(
          {
            name: '👤 Cliente',
            value: `${payment.userName}\nID: ${payment.userId}`
          },
          {
            name: '📦 Produto',
            value: payment.productName
          },
          {
            name: '💲 Valor',
            value: formatCurrency(payment.amount)
          },
          {
            name: '🕒 Criado em',
            value: formatDate(payment.createdAt)
          },
          {
            name: '⏱️ Expira em',
            value: formatDate(payment.expiresAt)
          },
          {
            name: '📊 Status',
            value: statusText
          }
        )
        .setTimestamp();

      // Adicionar informações específicas de acordo com o status
      if (payment.status === 'COMPLETED') {
        embed.addFields(
          {
            name: '✅ Aprovado por',
            value: payment.approvedBy || 'Sistema'
          },
          {
            name: '🕒 Aprovado em',
            value: formatDate(payment.completedAt)
          }
        );
      } else if (payment.status === 'REJECTED') {
        embed.addFields(
          {
            name: '❌ Rejeitado por',
            value: payment.rejectedBy || 'Sistema'
          },
          {
            name: '🕒 Rejeitado em',
            value: formatDate(payment.rejectedAt)
          },
          {
            name: '📝 Motivo',
            value: payment.rejectionReason || 'Não especificado'
          }
        );
      }

      // Preparar botões de acordo com o status
      let components = [];

      if (payment.status === 'PENDING' || payment.status === 'PROCESSING') {
        // Botões para aprovar/rejeitar
        const actionRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`${this.buttons.approve}${payment.id}`)
              .setLabel('Aprovar Pagamento')
              .setStyle(ButtonStyle.Success)
              .setEmoji('✅'),
            new ButtonBuilder()
              .setCustomId(`${this.buttons.reject}${payment.id}`)
              .setLabel('Rejeitar Pagamento')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('❌')
          );

        components.push(actionRow);
      }

      // Botão de voltar (sempre presente)
      const navigationRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(this.buttons.payments)
            .setLabel('Voltar para Pagamentos')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(this.buttons.back)
            .setLabel('Menu Principal')
            .setStyle(ButtonStyle.Secondary)
        );

      components.push(navigationRow);

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
      logger.error(`Erro ao renderizar detalhes do pagamento ${paymentId}:`, error);

      // Mensagem de erro
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setColor(config.discord.embedColors.error)
        .setDescription('Ocorreu um erro ao carregar os detalhes do pagamento. Por favor, tente novamente.')
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
   * Renderiza painel de gerenciamento de produtos
   * @param {TextChannel} channel - Canal onde o painel será enviado
   * @param {Object} options - Opções adicionais
   */
  async renderProductsPanel(channel, options = {}) {
    try {
      // Buscar produtos
      const availableProducts = await productService.getAvailableProducts(10);
      const totalProducts = availableProducts.length;

      // Criar embed
      const embed = new EmbedBuilder()
        .setTitle('📦 Gerenciamento de Produtos')
        .setColor(config.discord.embedColors.primary)
        .setDescription(`${totalProducts} produtos disponíveis no sistema.`)
        .setTimestamp();

      // Adicionar produtos recentes
      availableProducts.slice(0, 5).forEach((product, index) => {
        embed.addFields({
          name: `#${index + 1} - ${product.nome}`,
          value: `💰 **Preço**: R$ ${product.preco.toFixed(2)}\n📊 **Tipo**: ${product.tipo}\n👁️ **Visualizações**: ${product.visualizacoes}`
        });
      });

      // Botão para adicionar produto
      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(this.buttons.addProduct)
            .setLabel('Adicionar Produto')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕'),
          new ButtonBuilder()
            .setCustomId(this.buttons.sync)
            .setLabel('Sincronizar com API')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄')
        );

      // Menu de seleção para produtos
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_select_product')
        .setPlaceholder('Selecione um produto para gerenciar');

      availableProducts.slice(0, 10).forEach((product) => {
        selectMenu.addOptions({
          label: product.nome.substring(0, 25),
          description: `R$ ${product.preco.toFixed(2)} - ${product.tipo}`,
          value: product.id.toString()
        });
      });

      const row2 = new ActionRowBuilder().addComponents(selectMenu);

      // Botão de voltar
      const row3 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(this.buttons.refresh)
            .setLabel('Atualizar')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(this.buttons.back)
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Secondary)
        );

      // Enviar ou editar mensagem
      if (options.message) {
        return await options.message.edit({
          embeds: [embed],
          components: [row1, row2, row3]
        });
      } else {
        return await channel.send({
          embeds: [embed],
          components: [row1, row2, row3]
        });
      }
    } catch (error) {
      logger.error('Erro ao renderizar painel de produtos:', error);

      // Mensagem de erro
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setColor(config.discord.embedColors.error)
        .setDescription('Ocorreu um erro ao carregar os produtos. Por favor, tente novamente.')
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
   * Renderiza painel de gerenciamento de usuários
   * @param {TextChannel} channel - Canal onde o painel será enviado
   * @param {Object} options - Opções adicionais
   */
  async renderUsersPanel(channel, options = {}) {
    try {
      // Obter informações de usuários (implementação básica)
      const users = await this._getRecentUsers();

      // Criar embed
      const embed = new EmbedBuilder()
        .setTitle('👥 Gerenciamento de Usuários')
        .setColor(config.discord.embedColors.primary)
        .setDescription('Gerenciamento de usuários e permissões.')
        .setTimestamp();

      // Adicionar usuários recentes
      if (users.length > 0) {
        users.forEach((user, index) => {
          embed.addFields({
            name: `#${index + 1} - ${user.username}`,
            value: `🆔 **ID**: ${user.userId}\n📅 **Desde**: ${formatDate(user.createdAt)}\n⚠️ **Bloqueado**: ${user.isBlocked ? 'Sim' : 'Não'}`
          });
        });
      } else {
        embed.addFields({
          name: 'Nenhum usuário encontrado',
          value: 'Não há usuários registrados no sistema.'
        });
      }

      // Botão de busca
      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('admin_search_user')
            .setLabel('Buscar Usuário')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔍'),
          new ButtonBuilder()
            .setCustomId('admin_block_management')
            .setLabel('Gerenciar Bloqueios')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚠️')
        );

      // Menu de seleção para usuários
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_select_user')
        .setPlaceholder('Selecione um usuário para gerenciar');

      users.forEach((user) => {
        selectMenu.addOptions({
          label: user.username.substring(0, 25),
          description: `${user.userId} - ${user.isBlocked ? 'Bloqueado' : 'Ativo'}`,
          value: user.userId
        });
      });

      const row2 = new ActionRowBuilder().addComponents(selectMenu);

      // Botão de voltar
      const row3 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(this.buttons.refresh)
            .setLabel('Atualizar')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(this.buttons.back)
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Secondary)
        );

      // Enviar ou editar mensagem
      if (options.message) {
        return await options.message.edit({
          embeds: [embed],
          components: [row1, row2, row3]
        });
      } else {
        return await channel.send({
          embeds: [embed],
          components: [row1, row2, row3]
        });
      }
    } catch (error) {
      logger.error('Erro ao renderizar painel de usuários:', error);

      // Mensagem de erro
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setColor(config.discord.embedColors.error)
        .setDescription('Ocorreu um erro ao carregar os usuários. Por favor, tente novamente.')
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
   * Renderiza painel de estatísticas do sistema
   * @param {TextChannel} channel - Canal onde o painel será enviado
   * @param {Object} options - Opções adicionais
   */
  async renderStatsPanel(channel, options = {}) {
    try {
      // Obter estatísticas (implementação básica)
      const stats = await this._getSystemStats();

      // Criar embed
      const embed = new EmbedBuilder()
        .setTitle('📊 Estatísticas do Sistema')
        .setColor(config.discord.embedColors.primary)
        .setDescription('Visão geral de atividades e métricas do sistema.')
        .addFields(
          {
            name: '💰 Vendas',
            value: `**Total**: ${stats.sales.total} vendas\n**Valor**: R$ ${stats.sales.value.toFixed(2)}\n**Hoje**: ${stats.sales.today} vendas`,
            inline: true
          },
          {
            name: '👥 Usuários',
            value: `**Total**: ${stats.users.total} usuários\n**Ativos**: ${stats.users.active} usuários\n**Novos Hoje**: ${stats.users.newToday} usuários`,
            inline: true
          },
          {
            name: '📦 Produtos',
            value: `**Disponíveis**: ${stats.products.available}\n**Vendidos**: ${stats.products.sold}\n**Visualizações**: ${stats.products.views}`,
            inline: true
          },
          {
            name: '🏆 Produto Mais Vendido',
            value: stats.topProduct ? `**Nome**: ${stats.topProduct.name}\n**Vendas**: ${stats.topProduct.quantity}` : 'Nenhum produto vendido',
            inline: false
          }
        )
        .setTimestamp();

      // Botões de ação
      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('admin_export_stats')
            .setLabel('Exportar Relatório')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝'),
          new ButtonBuilder()
            .setCustomId(this.buttons.refresh)
            .setLabel('Atualizar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄')
        );

      // Botão de voltar
      const row2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(this.buttons.back)
            .setLabel('Voltar')
            .setStyle(ButtonStyle.Secondary)
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
    } catch (error) {
      logger.error('Erro ao renderizar painel de estatísticas:', error);

      // Mensagem de erro
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setColor(config.discord.embedColors.error)
        .setDescription('Ocorreu um erro ao carregar as estatísticas. Por favor, tente novamente.')
        .setTimestamp();

      if (options.message) {
        return await options.message.edit({
          embeds: [errorEmbed],
          components: [new ActionRowBuilder()
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
  try {
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

    // Mostrar painel de pagamentos
    if (customId === this.buttons.payments) {
      await interaction.deferUpdate();
      return await this.renderPaymentsPanel(interaction.channel, {
        userId: interaction.user.id,
        username: interaction.user.tag,
        message: interaction.message
      });
    }

    // Mostrar painel de produtos
    if (customId === this.buttons.products) {
      await interaction.deferUpdate();
      return await this.renderProductsPanel(interaction.channel, {
        userId: interaction.user.id,
        username: interaction.user.tag,
        message: interaction.message
      });
    }

    // Mostrar painel de usuários
    if (customId === this.buttons.users) {
      await interaction.deferUpdate();
      return await this.renderUsersPanel(interaction.channel, {
        userId: interaction.user.id,
        username: interaction.user.tag,
        message: interaction.message
      });
    }

    // Estatísticas
    if (customId === this.buttons.stats) {
      await interaction.deferUpdate();
      return await this.renderStatsPanel(interaction.channel, {
        userId: interaction.user.id,
        username: interaction.user.tag,
        message: interaction.message
      });
    }

    // Sincronizar produtos
    if (customId === this.buttons.sync) {
      await interaction.deferReply({ ephemeral: true });

      try {
        const lztService = require('../product/lzt');
        const result = await lztService.syncProducts();

        if (result.success) {
          await interaction.editReply({
            content: `✅ Sincronização concluída! ${result.added} produtos adicionados, ${result.updated} atualizados, ${result.errors} erros.`
          });
        } else {
          await interaction.editReply({
            content: `❌ Erro na sincronização: ${result.message}`
          });
        }
      } catch (error) {
        logger.error('Erro ao sincronizar produtos:', error);
        await interaction.editReply({
          content: '❌ Erro ao sincronizar produtos. Verifique os logs.'
        });
      }

      // Atualizar painel após sincronização
      await this.render(interaction.channel, {
        userId: interaction.user.id,
        username: interaction.user.tag,
        message: interaction.message
      }, panelSystem);

      return;
    }

    // Tratar seleção de pagamento
    if (customId === 'admin_select_payment' && interaction.isStringSelectMenu()) {
      await interaction.deferUpdate();
      const selectedPaymentId = interaction.values[0];

      // Renderizar detalhes do pagamento selecionado
      return await this.renderPaymentDetails(interaction.channel, selectedPaymentId, {
        userId: interaction.user.id,
        message: interaction.message
      });
    }

    // Aprovar pagamento
    if (customId.startsWith(this.buttons.approve)) {
      await interaction.deferReply({ ephemeral: true });

      const paymentId = customId.replace(this.buttons.approve, '');
      const result = await paymentService.approvePayment(paymentId, interaction.user.id);

      if (result.success) {
        await interaction.editReply({
          content: `✅ Pagamento aprovado com sucesso! Dados enviados ao usuário.`
        });
      } else {
        await interaction.editReply({
          content: `❌ Erro ao aprovar pagamento: ${result.message}`
        });
      }

      // Atualizar painel após operação
      return await this.renderPaymentsPanel(interaction.channel, {
        userId: interaction.user.id,
        username: interaction.user.tag,
        message: interaction.message
      });
    }

    // Rejeitar pagamento
    if (customId.startsWith(this.buttons.reject)) {
      // Mostrar modal para informar motivo da rejeição
      const modal = new ModalBuilder()
        .setCustomId(`reject_payment_modal_${customId.replace(this.buttons.reject, '')}`)
        .setTitle('Rejeitar Pagamento');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reject_reason')
        .setLabel('Motivo da rejeição')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Informe o motivo para rejeitar este pagamento')
        .setRequired(true)
        .setMaxLength(200);

      modal.addComponents(
        new ActionRowBuilder().addComponents(reasonInput)
      );

      return await interaction.showModal(modal);
    }

    // Processamento do modal de rejeição
    if (interaction.isModalSubmit() && interaction.customId.startsWith('reject_payment_modal_')) {
      await interaction.deferUpdate();

      const paymentId = interaction.customId.replace('reject_payment_modal_', '');
      const reason = interaction.fields.getTextInputValue('reject_reason');

      const result = await paymentService.rejectPayment(paymentId, reason, interaction.user.id);

      if (result.success) {
        await interaction.followUp({
          content: `✅ Pagamento rejeitado. Motivo: ${reason}`,
          ephemeral: true
        });
      } else {
        await interaction.followUp({
          content: `❌ Erro ao rejeitar pagamento: ${result.message}`,
          ephemeral: true
        });
      }

      // Atualizar painel após operação
      return await this.renderPaymentsPanel(interaction.channel, {
        userId: interaction.user.id,
        username: interaction.user.tag,
        message: interaction.message
      });
    }

    // Verifica e encaminha para métodos específicos de outros painéis
    // Essa é uma adaptação para interações não mapeadas corretamente
    if (!interaction.replied && !interaction.deferred) {
      logger.debug(`AdminPanel: interação não tratada diretamente: ${customId}`);
      // Não fazer nada, deixar o sistema tentar outros painéis
    }
  } catch (error) {
    logger.error(`Erro ao processar interação no painel administrativo:`, error);

    // Tentar responder ao usuário
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Ocorreu um erro ao processar sua interação. Por favor, tente novamente.',
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.followUp({
          content: 'Ocorreu um erro ao processar sua interação. Por favor, tente novamente.',
          ephemeral: true
        });
      }
    } catch (replyError) {
      logger.error('Erro ao enviar mensagem de erro:', replyError);
    }
  }
}

/**
 * Manipula comando /admin
 * @param {CommandInteraction} interaction - Interação de comando
 * @param {Object} options - Opções adicionais
 * @param {PanelSystem} panelSystem - Sistema de painéis
 */
async handleCommand(interaction, options, panelSystem) {
  // Verificar permissões de administrador
  if (!interaction.memberPermissions.has('Administrator')) {
    return await interaction.editReply({
      content: 'Você não tem permissão para acessar o painel administrativo.',
      ephemeral: true
    });
  }

  await this.render(interaction.channel, {
    userId: interaction.user.id,
    username: interaction.user.tag,
    member: interaction.member
  }, panelSystem);

  await interaction.editReply({
    content: 'Painel administrativo aberto:',
    ephemeral: true
  });
}

/**
 * Obtém usuários recentes para exibição no painel
 * @returns {Promise<Array>} Lista de usuários
 * @private
 */
async _getRecentUsers() {
  try {
    const User = require('../models').User;

    // Buscar usuários recentes
    const users = await User.findAll({
      order: [['lastActive', 'DESC']],
      limit: 5
    });

    return users;
  } catch (error) {
    logger.error('Erro ao obter usuários recentes:', error);
    return [];
  }
}

/**
 * Obtém estatísticas básicas do sistema
 * @returns {Promise<Object>} Estatísticas do sistema
 * @private
 */
async _getSystemStats() {
  try {
    // Obter modelos
    const { Payment, Product, User } = require('../models');

    // Data de hoje (início)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calcular estatísticas
    const [
      totalUsers,
      activeUsers,
      newUsers,
      totalProducts,
      availableProducts,
      totalSales,
      todaySales,
      totalSalesValue
    ] = await Promise.all([
      User.count(),
      User.count({ where: { lastActive: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      User.count({ where: { createdAt: { [Op.gte]: today } } }),
      Product.count(),
      Product.count({ where: { disponivel: true, vendido: false } }),
      Payment.count({ where: { status: 'COMPLETED' } }),
      Payment.count({ where: { status: 'COMPLETED', completedAt: { [Op.gte]: today } } }),
      Payment.sum('amount', { where: { status: 'COMPLETED' } })
    ]);

    // Tentar obter produto mais vendido
    let topProduct = null;
    try {
      const soldProducts = await Product.findAll({
        where: { vendido: true },
        attributes: ['nome', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['nome'],
        order: [[sequelize.literal('count'), 'DESC']],
        limit: 1
      });

      if (soldProducts.length > 0) {
        topProduct = {
          name: soldProducts[0].nome,
          quantity: parseInt(soldProducts[0].getDataValue('count'), 10)
        };
      }
    } catch (topProductError) {
      logger.warn('Erro ao obter produto mais vendido:', topProductError);
    }

    return {
      users: {
        total: totalUsers || 0,
        active: activeUsers || 0,
        newToday: newUsers || 0
      },
      products: {
        total: totalProducts || 0,
        available: availableProducts || 0,
        sold: (totalProducts - availableProducts) || 0,
        views: await Product.sum('visualizacoes') || 0
      },
      sales: {
        total: totalSales || 0,
        today: todaySales || 0,
        value: totalSalesValue || 0
      },
      topProduct
    };
  } catch (error) {
    logger.error('Erro ao obter estatísticas do sistema:', error);

    // Retornar dados vazios em caso de erro
    return {
      users: { total: 0, active: 0, newToday: 0 },
      products: { total: 0, available: 0, sold: 0, views: 0 },
      sales: { total: 0, today: 0, value: 0 },
      topProduct: null
    };
  }
}
}

module.exports = new AdminPanel();
