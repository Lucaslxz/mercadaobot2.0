/**
 * Painel de ajuda
 * Exibe informações e instruções sobre o sistema
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

class HelpPanel {
  constructor() {
    this.id = 'help';
    this.buttons = {
      back: 'help_back',
      commands: 'help_commands',
      faq: 'help_faq',
      tutorial: 'help_tutorial',
      contact: 'help_contact'
    };
  }

  /**
   * Renderiza o painel de ajuda
   * @param {TextChannel} channel - Canal onde o painel será enviado
   * @param {Object} options - Opções adicionais
   * @param {PanelSystem} panelSystem - Sistema de painéis
   */
  async render(channel, options = {}, panelSystem) {
    try {
      const userId = options.userId;
      if (userId) {
        // Registrar visualização da ajuda
        await userService.recordActivity(userId, 'HELP_VIEW', {
          timestamp: new Date()
        });
      }

      // Criar embed da ajuda
      const embed = new EmbedBuilder()
        .setTitle('❓ Central de Ajuda')
        .setColor(config.discord.embedColors.primary)
        .setDescription('Bem-vindo à Central de Ajuda do Mercadão das Contas! Selecione uma opção abaixo:')
        .addFields(
          {
            name: '📚 Comandos',
            value: 'Lista de todos os comandos disponíveis'
          },
          {
            name: '❓ Perguntas Frequentes',
            value: 'Dúvidas mais comuns sobre o sistema'
          },
          {
            name: '📖 Tutorial',
            value: 'Aprenda a usar o sistema passo a passo'
          },
          {
            name: '📩 Contato',
            value: 'Formas de entrar em contato com nossa equipe'
          }
        )
        .setFooter({ text: 'Mercadão das Contas - Central de Ajuda' })
        .setTimestamp();

      // Botões interativos
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(this.buttons.commands)
            .setLabel('Comandos')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📚'),
          new ButtonBuilder()
            .setCustomId(this.buttons.faq)
            .setLabel('Perguntas Frequentes')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('❓'),
          new ButtonBuilder()
            .setCustomId(this.buttons.tutorial)
            .setLabel('Tutorial')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📖'),
          new ButtonBuilder()
            .setCustomId(this.buttons.contact)
            .setLabel('Contato')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📩'),
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
      logger.error('Erro ao renderizar painel de ajuda:', error);

      // Mensagem de erro
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erro')
        .setColor(config.discord.embedColors.error)
        .setDescription('Ocorreu um erro ao carregar a ajuda. Por favor, tente novamente.')
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

    // Mostrar lista de comandos
    if (customId === this.buttons.commands) {
      await interaction.deferReply({ ephemeral: true });

      const commandsEmbed = new EmbedBuilder()
        .setTitle('📚 Lista de Comandos')
        .setColor(config.discord.embedColors.primary)
        .setDescription('Aqui estão todos os comandos disponíveis:')
        .addFields(
          {
            name: '/menu',
            value: 'Abre o menu principal da loja'
          },
          {
            name: '/loja',
            value: 'Mostra produtos disponíveis para compra'
          },
          {
            name: '/perfil',
            value: 'Visualiza seu perfil e histórico de compras'
          },
          {
            name: '/ajuda',
            value: 'Exibe informações de ajuda sobre o sistema'
          },
          {
            name: '/admin',
            value: 'Acessa o painel administrativo (apenas administradores)'
          }
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [commandsEmbed]
      });

      return;
    }

    // Mostrar perguntas frequentes
    if (customId === this.buttons.faq) {
      await interaction.deferReply({ ephemeral: true });

      const faqEmbed = new EmbedBuilder()
        .setTitle('❓ Perguntas Frequentes')
        .setColor(config.discord.embedColors.primary)
        .addFields(
          {
            name: 'Como funciona o sistema de compra?',
            value: 'Você escolhe o produto desejado, realiza o pagamento via PIX e, após a confirmação, recebe os dados de acesso da conta.'
          },
          {
            name: 'Quanto tempo leva para receber minha conta?',
            value: 'Após a confirmação do pagamento, sua conta é entregue imediatamente se houver um administrador online. Caso contrário, o tempo máximo é de 1 hora em horário comercial.'
          },
          {
            name: 'O que fazer se a conta não funcionar?',
            value: 'Abra um ticket de suporte imediatamente informando o problema. É importante tentar acessar a conta logo após a compra.'
          },
          {
            name: 'Vocês oferecem garantia?',
            value: 'Oferecemos suporte para o primeiro acesso. Após o acesso bem-sucedido, recomendamos alterar o email e senha imediatamente.'
          },
          {
            name: 'Como funciona o sistema de pontos?',
            value: 'Cada compra gera pontos de fidelidade que podem ser usados como desconto em compras futuras.'
          }
        )
        .setFooter({ text: 'Para outras dúvidas, use o botão de Suporte no menu principal' })
        .setTimestamp();

      await interaction.editReply({
        embeds: [faqEmbed]
      });

      return;
    }

    // Mostrar tutorial
    if (customId === this.buttons.tutorial) {
      await interaction.deferReply({ ephemeral: true });

      const tutorialEmbed = new EmbedBuilder()
        .setTitle('📖 Tutorial')
        .setColor(config.discord.embedColors.primary)
        .setDescription('Siga estes passos para realizar uma compra:')
        .addFields(
          {
            name: '1. Navegue na loja',
            value: 'Use o comando `/menu` e clique no botão Loja para ver os produtos disponíveis.'
          },
          {
            name: '2. Escolha um produto',
            value: 'Clique em um produto para ver detalhes e preço.'
          },
          {
            name: '3. Adicione ao carrinho',
            value: 'Clique em "Adicionar ao Carrinho" ou "Comprar Agora".'
          },
          {
            name: '4. Finalize a compra',
            value: 'Siga as instruções para realizar o pagamento via PIX.'
          },
          {
            name: '5. Receba o produto',
            value: 'Após a confirmação do pagamento, você receberá as informações de acesso.'
          }
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [tutorialEmbed]
      });

      return;
    }

    // Mostrar informações de contato
    if (customId === this.buttons.contact) {
      await interaction.deferReply({ ephemeral: true });

      await interaction.editReply({
        content: '📩 **Informações de Contato**\n\n' +
                'Email: suporte@mercadaodascontas.com\n' +
                'Instagram: @mercadaodascontas\n' +
                'Twitter: @mktcontas\n' +
                'Horário de atendimento: Segunda a Sexta, 9h às 22h'
      });

      return;
    }
  }

  /**
   * Manipula comando /ajuda
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
      content: 'Central de ajuda aberta:',
      ephemeral: true
    });
  }
}

module.exports = new HelpPanel();
