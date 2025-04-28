/**
 * Sistema central de painéis interativos
 * Centraliza a criação, gerenciamento e interação com painéis visuais
 */

const { EmbedBuilder, ActionRowBuilder } = require('discord.js');
const { logger } = require('../utils/helpers');

class PanelSystem {
  constructor() {
    this.panels = new Map(); // Armazena todos os painéis registrados
    this.interactions = new Map(); // Mapeia IDs de interação para manipuladores
    this.activeMessages = new Map(); // Mapeia mensagens ativas para seus painéis
  }

  /**
   * Registra um novo painel no sistema
   * @param {string} id - ID único do painel
   * @param {Object} panel - Objeto do painel com manipuladores
   */
  registerPanel(id, panel) {
    if (!panel.render || typeof panel.render !== 'function') {
      throw new Error(`Painel ${id} não implementa método render()`);
    }

    if (!panel.handleInteraction || typeof panel.handleInteraction !== 'function') {
      throw new Error(`Painel ${id} não implementa método handleInteraction()`);
    }

    this.panels.set(id, panel);
    logger.info(`Painel ${id} registrado com sucesso`);

    return this;
  }

  /**
   * Mapeia IDs de botões para manipuladores de painel
   * @param {string} interactionId - ID da interação (customId do botão/select)
   * @param {string} panelId - ID do painel que deve tratar esta interação
   */
  mapInteraction(interactionId, panelId) {
    if (!this.panels.has(panelId)) {
      throw new Error(`Painel ${panelId} não encontrado para mapear interação ${interactionId}`);
    }

    this.interactions.set(interactionId, panelId);
    return this;
  }

  /**
   * Mapeia múltiplas interações para um painel
   * @param {Array<string>} interactionIds - Lista de IDs de interação
   * @param {string} panelId - ID do painel que deve tratar estas interações
   */
  mapInteractions(interactionIds, panelId) {
    for (const id of interactionIds) {
      this.mapInteraction(id, panelId);
    }
    return this;
  }

  /**
   * Processa uma interação
   * @param {Interaction} interaction - Objeto de interação do Discord
   */
  async handleInteraction(interaction) {
    // Ignorar interações que não são de botão, select menu ou modal
    if (!interaction.isButton() &&
        !interaction.isStringSelectMenu() &&
        !interaction.isModalSubmit()) {
      return false;
    }

    const customId = interaction.customId;

    // Verificar prefixos para interações dinâmicas
    for (const [interactionId, panelId] of this.interactions.entries()) {
      if (customId === interactionId || customId.startsWith(interactionId + '_')) {
        const panel = this.panels.get(panelId);
        if (panel) {
          try {
            await panel.handleInteraction(interaction, this);
            return true;
          } catch (error) {
            logger.error(`Erro ao processar interação ${customId} no painel ${panelId}:`, error);

            // Tentar responder com erro se possível
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: 'Ocorreu um erro ao processar sua interação.',
                ephemeral: true
              });
            }
            return true;
          }
        }
      }
    }

    return false; // Interação não manipulada
  }

  /**
   * Renderiza um painel em um canal
   * @param {string} panelId - ID do painel a ser renderizado
   * @param {TextChannel} channel - Canal onde o painel será enviado
   * @param {Object} options - Opções adicionais para o painel
   */
  async renderPanel(panelId, channel, options = {}) {
    const panel = this.panels.get(panelId);
    if (!panel) {
      throw new Error(`Painel ${panelId} não encontrado`);
    }

    try {
      const message = await panel.render(channel, options, this);

      if (message) {
        this.activeMessages.set(message.id, {
          panelId,
          channelId: channel.id,
          options
        });
      }

      return message;
    } catch (error) {
      logger.error(`Erro ao renderizar painel ${panelId}:`, error);
      throw error;
    }
  }

  /**
   * Atualiza todos os painéis ativos
   */
  async updateAllPanels() {
    for (const [messageId, data] of this.activeMessages.entries()) {
      try {
        const { panelId, channelId, options } = data;
        const panel = this.panels.get(panelId);

        if (!panel || !panel.update) continue;

        const client = require('../../bot').client;
        const channel = await client.channels.fetch(channelId);

        if (!channel) continue;

        const message = await channel.messages.fetch(messageId);

        if (!message) continue;

        await panel.update(message, options, this);
      } catch (error) {
        logger.error(`Erro ao atualizar painel (messageId: ${messageId}):`, error);
        this.activeMessages.delete(messageId);
      }
    }
  }
}

// Singleton
const panelSystem = new PanelSystem();
module.exports = panelSystem;
