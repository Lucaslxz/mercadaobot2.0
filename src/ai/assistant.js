/**
 * Assistente virtual para suporte ao cliente
 * Versão otimizada com cache inteligente e processamento de linguagem natural
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/helpers');
const userService = require('../user/profile');
const cache = require('../utils/cache');

class VirtualAssistant {
  constructor() {
    this.responses = new Map();
    this.cacheKey = 'assistant:';
    this.cacheTTL = 86400; // 24 horas
    this.knowledgeBase = this._initializeKnowledgeBase();
  }

  /**
   * Inicializa a base de conhecimento com perguntas frequentes
   * @private
   */
  _initializeKnowledgeBase() {
    return [
      {
        questions: ['como comprar', 'como faço para comprar', 'quero comprar'],
        answer: 'Para comprar uma conta, você pode usar o comando /produtos para ver o catálogo completo. Depois, use /comprar <ID> para iniciar o processo de compra. Você receberá instruções de pagamento via PIX e, após a confirmação, a conta será entregue a você.'
      },
      {
        questions: ['forma de pagamento', 'como pagar', 'aceita cartão', 'métodos de pagamento'],
        answer: 'Aceitamos pagamento via PIX. Após escolher seu produto, você receberá um QR Code e um código PIX para realizar o pagamento. O processo é rápido e seguro.'
      },
      {
        questions: ['tem garantia', 'garantia', 'estorno', 'devolução'],
        answer: 'Não oferecemos garantia ou estorno para as contas vendidas. Isso é claramente comunicado durante o processo de compra. Todas as contas são verificadas antes da venda para garantir que estão em boas condições.'
      },
      {
        questions: ['mudar email', 'trocar email', 'alterar email', 'mudar senha'],
        answer: 'Para alterar o email da conta que você comprou, recomendamos fazê-lo imediatamente após receber os dados de acesso. Isso garantirá que você tenha controle total sobre a conta.'
      },
      {
        questions: ['conta banida', 'fui banido', 'ban', 'suspensão'],
        answer: 'Não nos responsabilizamos por contas que sejam banidas após a compra. Sugerimos sempre seguir as regras dos jogos e não utilizar qualquer tipo de programa não autorizado.'
      },
      {
        questions: ['tempo de entrega', 'quanto tempo', 'quando recebo'],
        answer: 'A entrega das contas é feita após a confirmação manual do pagamento por um dos administradores. Normalmente, este processo leva de 5 a 30 minutos durante o horário comercial (9h às 22h).'
      },
      {
        questions: ['skin específica', 'tem skin', 'procuro conta com'],
        answer: 'Para buscar contas com skins específicas, recomendamos usar o comando /produtos e depois filtrar. Você também pode acessar nosso mini-site para visualizar todas as skins disponíveis em cada conta.'
      },
      {
        questions: ['não recebi', 'pagamento não confirmado', 'paguei mas não recebi'],
        answer: 'Se você realizou o pagamento mas ainda não recebeu a conta, por favor, aguarde a aprovação manual por um administrador. Se já passou mais de 1 hora, use o comando /suporte para entrar em contato com nossa equipe.'
      },
      {
        questions: ['visualizar skins', 'ver detalhes', 'mini-site'],
        answer: 'Você pode visualizar todos os detalhes da conta, incluindo skins, agentes e chaveiros, acessando nosso mini-site. O link é fornecido ao usar o comando /produto <ID> e clicar no botão "Ver no Mini-Site".'
      },
      {
        questions: ['falar com atendente', 'falar com pessoa', 'atendimento humano'],
        answer: 'Para falar com um atendente humano, use o comando /suporte seguido de uma breve descrição do seu problema. Um membro da nossa equipe irá atender você o mais rápido possível.'
      },
      {
        questions: ['preço', 'valor', 'quanto custa', 'custo'],
        answer: 'Os preços variam de acordo com o tipo de conta, rank, quantidade de skins e outros fatores. Use o comando /produtos para ver os preços de todas as contas disponíveis no momento.'
      },
      {
        questions: ['promoção', 'desconto', 'cupom', 'oferta'],
        answer: 'Temos promoções e descontos frequentes. Use o comando /promocoes para ver as ofertas ativas. Usuários que acumulam pontos de fidelidade também podem obter descontos exclusivos.'
      },
      {
        questions: ['reembolso', 'devolver', 'arrependimento'],
        answer: 'Não oferecemos reembolso ou política de arrependimento para as contas vendidas. Por isso, recomendamos verificar todos os detalhes antes de realizar a compra.'
      },
      {
        questions: ['segurança', 'seguro', 'confiável'],
        answer: 'Nossa plataforma é segura e confiável. Todas as transações são criptografadas e os dados dos clientes são protegidos. Temos anos de experiência no mercado e milhares de clientes satisfeitos.'
      },
      {
        questions: ['pontos', 'fidelidade', 'recompensas', 'cashback'],
        answer: 'Temos um programa de fidelidade onde você acumula pontos em cada compra. Esses pontos podem ser trocados por descontos em compras futuras. Use o comando /perfil para verificar seus pontos acumulados.'
      }
    ];
  }

  /**
   * Processa uma pergunta e retorna uma resposta otimizada
   * @param {string} question - Pergunta do usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Resposta processada
   */
  async getResponse(question, userId) {
    try {
      const normalizedQuestion = this._normalizeQuestion(question);
      const cacheKey = `${this.cacheKey}${normalizedQuestion}`;
      const cachedResponse = await cache.get(cacheKey);

      if (cachedResponse) {
        logger.debug(`Cache hit para pergunta: "${normalizedQuestion}"`);
        return {
          ...cachedResponse,
          id: uuidv4() // Gerar novo ID para tracking
        };
      }

      const bestMatch = this._findBestMatch(normalizedQuestion);
      const responseId = uuidv4();
      const suggestions = bestMatch ? this._generateRelatedSuggestions(normalizedQuestion, bestMatch) : [];

      const response = {
        id: responseId,
        question,
        answer: bestMatch ? bestMatch.answer : "Desculpe, não tenho uma resposta específica para essa pergunta. Por favor, tente reformular ou use o comando /suporte para falar com nossa equipe.",
        suggestions,
        timestamp: new Date()
      };

      this.responses.set(responseId, response);

      if (bestMatch && bestMatch.confidence > 0.7) {
        await cache.set(cacheKey, {
          answer: response.answer,
          suggestions: response.suggestions
        }, this.cacheTTL);
        logger.debug(`Nova entrada de cache para: "${normalizedQuestion}"`);
      }

      await this._recordInteraction(userId, question, response);
      return response;
    } catch (error) {
      logger.error('Erro ao processar pergunta do assistente:', error);
      return {
        id: uuidv4(),
        question,
        answer: "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente mais tarde.",
        suggestions: [],
        timestamp: new Date()
      };
    }
  }

  /**
   * Registra feedback do usuário sobre uma resposta
   * @param {string} responseId - ID da resposta
   * @param {string} userId - ID do usuário
   * @param {string} feedbackType - Tipo de feedback ('positive' ou 'negative')
   * @returns {Promise<boolean>} - Status da operação
   */
  async recordFeedback(responseId, userId, feedbackType) {
    try {
      const response = this.responses.get(responseId);
      if (!response) {
        logger.warn(`Tentativa de feedback para resposta inexistente: ${responseId}`);
        return false;
      }

      await userService.recordActivity(userId, 'ASSISTANT_FEEDBACK', {
        responseId,
        question: response.question,
        feedbackType,
        timestamp: new Date()
      });

      if (feedbackType === 'negative') {
        const cacheKey = `${this.cacheKey}${this._normalizeQuestion(response.question)}`;
        await cache.del(cacheKey);
        logger.info(`Cache invalidado após feedback negativo: ${cacheKey}`);
      }

      logger.info(`Feedback ${feedbackType} registrado para resposta ${responseId} do usuário ${userId}`);
      return true;
    } catch (error) {
      logger.error('Erro ao registrar feedback do assistente:', error);
      return false;
    }
  }

  /**
   * Adiciona nova pergunta/resposta à base de conhecimento
   * @param {string} question - Pergunta a ser adicionada
   * @param {string} answer - Resposta correspondente
   * @param {Array} variations - Variações da pergunta
   * @returns {Promise<boolean>} - Status da operação
   */
  async addToKnowledgeBase(question, answer, variations = []) {
    try {
      if (!question || !answer) {
        logger.warn('Tentativa de adicionar entrada vazia à base de conhecimento');
        return false;
      }

      const newEntry = {
        questions: [question, ...variations].filter(Boolean),
        answer,
        addedAt: new Date()
      };

      this.knowledgeBase.push(newEntry);
      await this._invalidateRelatedCaches(question, variations);

      logger.info(`Nova entrada adicionada à base de conhecimento: "${question}"`);
      return true;
    } catch (error) {
      logger.error('Erro ao adicionar à base de conhecimento:', error);
      return false;
    }
  }

  /**
   * Treina o assistente com novas perguntas e respostas em lote
   * @param {Array} data - Array de objetos {question, answer, variations}
   * @returns {Promise<Object>} - Resultado da operação
   */
  async batchTrain(data) {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        return { success: false, message: 'Dados de treinamento inválidos' };
      }

      let added = 0;
      let errors = 0;

      for (const item of data) {
        try {
          const success = await this.addToKnowledgeBase(
            item.question,
            item.answer,
            item.variations || []
          );

          if (success) {
            added++;
          } else {
            errors++;
          }
        } catch (itemError) {
          logger.error('Erro ao processar item de treinamento:', itemError);
          errors++;
        }
      }

      return {
        success: true,
        added,
        errors,
        total: data.length
      };
    } catch (error) {
      logger.error('Erro no treinamento em lote:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Normaliza uma pergunta para busca e cache
   * @param {string} question - Pergunta original
   * @returns {string} - Pergunta normalizada
   * @private
   */
  _normalizeQuestion(question) {
    return question
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove pontuação
      .replace(/\s+/g, ' ')    // Remove espaços extras
      .trim();
  }

  /**
   * Encontra a melhor correspondência na base de conhecimento
   * @param {string} question - Pergunta normalizada
   * @returns {Object|null} - Melhor correspondência ou null
   * @private
   */
  _findBestMatch(question) {
    let bestMatch = null;
    let highestConfidence = 0;

    for (const entry of this.knowledgeBase) {
      for (const knownQuestion of entry.questions) {
        const confidence = this._calculateConfidence(question, this._normalizeQuestion(knownQuestion));

        if (confidence > highestConfidence && confidence > 0.5) {
          highestConfidence = confidence;
          bestMatch = {
            ...entry,
            confidence
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calcula a confiança da correspondência entre duas perguntas
   * @param {string} questionA - Primeira pergunta normalizada
   * @param {string} questionB - Segunda pergunta normalizada
   * @returns {number} - Pontuação de confiança (0-1)
   * @private
   */
  _calculateConfidence(questionA, questionB) {
    // Se são exatamente iguais
    if (questionA === questionB) return 1.0;

    // Verifica se questionA contém questionB ou vice-versa
    if (questionA.includes(questionB)) return 0.9;
    if (questionB.includes(questionA)) return 0.8;

    // Checa palavras em comum
    const wordsA = questionA.split(' ');
    const wordsB = questionB.split(' ');
    const commonWords = wordsA.filter(word => wordsB.includes(word));

    if (commonWords.length === 0) return 0;

    // Calcular similaridade baseada em palavras comuns
    const similarityA = commonWords.length / wordsA.length;
    const similarityB = commonWords.length / wordsB.length;

    // Dar mais peso para palavras-chave relevantes
    const keywordBoost = this._calculateKeywordBoost(commonWords);

    return Math.min(1.0, (similarityA + similarityB) / 2 + keywordBoost);
  }

  /**
   * Calcula boost de confiança baseado em palavras-chave importantes
   * @param {Array} words - Lista de palavras em comum
   * @returns {number} - Valor de boost (0-0.5)
   * @private
   */
  _calculateKeywordBoost(words) {
    const importantKeywords = ['comprar', 'pagar', 'conta', 'valor', 'preço', 'skin', 'garantia', 'entrega'];
    const matches = words.filter(word => importantKeywords.includes(word));
    return matches.length * 0.1; // 0.1 de boost por palavra-chave
  }

  /**
   * Gera sugestões de perguntas relacionadas
   * @param {string} question - Pergunta normalizada
   * @param {Object} bestMatch - Melhor correspondência
   * @param {number} limit - Limite de sugestões
   * @returns {Array} - Lista de sugestões
   * @private
   */
  _generateRelatedSuggestions(question, bestMatch, limit = 3) {
    if (!bestMatch) return [];

    const suggestions = [];

    // Encontrar outras entradas relacionadas
    for (const entry of this.knowledgeBase) {
      // Pular a própria entrada
      if (entry === bestMatch) continue;

      // Verificar se há relação com a pergunta original
      let highestConfidence = 0;

      for (const knownQuestion of entry.questions) {
        const confidence = this._calculateConfidence(question, this._normalizeQuestion(knownQuestion));
        highestConfidence = Math.max(highestConfidence, confidence);
      }

      // Se houver alguma relação, adicionar como sugestão
      if (highestConfidence > 0.3) {
        suggestions.push({
          question: entry.questions[0],
          confidence: highestConfidence
        });
      }
    }

    // Ordenar por confiança e pegar as primeiras 'limit'
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit)
      .map(s => s.question);
  }

  /**
   * Registra uma interação para análise e melhoria contínua
   * @param {string} userId - ID do usuário
   * @param {string} question - Pergunta original
   * @param {Object} response - Resposta gerada
   * @returns {Promise<void>}
   * @private
   */
  async _recordInteraction(userId, question, response) {
    try {
      await userService.recordActivity(userId, 'ASSISTANT_QUERY', {
        question,
        responseId: response.id,
        hasSuggestions: response.suggestions.length > 0,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Erro ao registrar interação com assistente:', error);
    }
  }

  /**
   * Invalida caches relacionados a uma pergunta
   * @param {string} question - Pergunta principal
   * @param {Array} variations - Variações da pergunta
   * @returns {Promise<void>}
   * @private
   */
  async _invalidateRelatedCaches(question, variations) {
    const keys = [question, ...variations].filter(Boolean).map(q =>
      `${this.cacheKey}${this._normalizeQuestion(q)}`
    );

    for (const key of keys) {
      await cache.del(key);
      logger.debug(`Cache invalidado: ${key}`);
    }
  }
}

// Criar instância do assistente
const assistant = new VirtualAssistant();

// Exportar API pública
module.exports = {
  /**
   * Obtém resposta do assistente virtual para uma pergunta
   * @param {string} question - Pergunta do usuário
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Resposta do assistente
   */
  getResponse: async (question, userId) => {
    return await assistant.getResponse(question, userId);
  },

  /**
   * Registra feedback sobre uma resposta
   * @param {string} responseId - ID da resposta
   * @param {string} userId - ID do usuário
   * @param {string} feedbackType - Tipo de feedback ('positive' ou 'negative')
   * @returns {Promise<boolean>} - Status da operação
   */
  recordFeedback: async (responseId, userId, feedbackType) => {
    return await assistant.recordFeedback(responseId, userId, feedbackType);
  },

  /**
   * Adiciona novo conhecimento ao assistente
   * @param {string} question - Pergunta principal
   * @param {string} answer - Resposta para a pergunta
   * @param {Array} variations - Variações da pergunta
   * @returns {Promise<boolean>} - Status da operação
   */
  addKnowledge: async (question, answer, variations = []) => {
    return await assistant.addToKnowledgeBase(question, answer, variations);
  },

  /**
   * Treina o assistente com múltiplas perguntas/respostas
   * @param {Array} data - Dados de treinamento [{question, answer, variations}, ...]
   * @returns {Promise<Object>} - Resultado do treinamento
   */
  batchTrain: async (data) => {
    return await assistant.batchTrain(data);
  },

  // Exportar instância para testes (privado)
  _instance: assistant
};
