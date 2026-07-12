const openRouter = require('./openrouter');
const cloudflareAI = require('./cloudflare-ai');
const { OpenAI } = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenAI } = require('@google/genai');
const config = require('../config/index.js');
const { getX402Knowledge, getX402PromptContext } = require('../knowledge/x402-protocol');

class X402UnifiedAgent {
  constructor() {
    // Initialize all AI provider clients
    this.openai = config.openai.apiKey ? new OpenAI({ apiKey: config.openai.apiKey }) : null;
    this.anthropic = config.anthropic.apiKey ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;
    this.xai = config.xai.apiKey ? new OpenAI({ apiKey: config.xai.apiKey, baseURL: 'https://api.x.ai/v1' }) : null;
    this.google = config.google.apiKey ? new GoogleGenAI({ apiKey: config.google.apiKey }) : null;

    // OpenRouter for multi-model access
    this.openRouter = openRouter;

    // Cloudflare AI Gateway
    this.cloudflare = cloudflareAI;

    // X402 Agent identity and knowledge
    this.agentName = 'X402 Solana Agent';
    this.agentVersion = '1.0.0';
    this.knowledge = getX402Knowledge();
    this.knowledgeContext = getX402PromptContext();
  }

  /**
   * Route requests to the best AI model based on task type
   * Uses all available providers: OpenRouter, Google, OpenAI, XAI, Anthropic
   */
  async route(task, data) {
    const strategies = {
      // Writing tasks - use specialized writing model or Google Gemini
      'content_creation': () => this.useGoogleOrFallback('writing', data.prompt),
      'blog_post': () => this.useGoogleOrFallback('writing', data.prompt),

      // Deep thinking tasks - use DeepSeek or Google Gemini with thinking
      'complex_analysis': () => this.deepThinkingTask(data.prompt),
      'research': () => this.deepThinkingTask(data.prompt),

      // Code tasks - use XAI Grok or Google Gemini or DeepSeek
      'code_generation': () => this.codeTask(data.prompt),
      'code_review': () => this.codeTask(data.prompt),

      // Vision tasks - use Google Gemini Flash or Cloudflare
      'image_analysis': () => this.visionTask(data.imageUrl, data.prompt),

      // Fast responses - use Google Gemini Flash or Cloudflare
      'quick_query': () => this.fastTask(data.prompt),

      // Multi-lingual support - use Google Gemini or Cloudflare Qwen
      'translation': () => this.translationTask(data.prompt),

      // Inference tasks
      'prediction': () => this.deepThinkingTask(data.prompt),

      // Image generation - use Cloudflare Flux
      'image_generation': () => this.cloudflare.generateImage(data.prompt, 'flux_schnell'),

      // Embeddings - use Cloudflare BGE
      'embedding': () => this.cloudflare.generateEmbeddings(data.text),

      // Speech tasks - use Google or Cloudflare
      'text_to_speech': () => this.ttsTask(data.text),
      'speech_to_text': () => this.sttTask(data.audio),

      // General purpose - cascade through all providers
      'general': () => this.generalTask(data.prompt)
    };

    const strategy = strategies[task] || strategies['general'];
    return await strategy();
  }

  /**
   * Use Google Gemini or fallback to other providers
   */
  async useGoogleOrFallback(taskType, prompt) {
    try {
      if (this.google) {
        const response = await this.google.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: this.formatX402Prompt(prompt),
          config: {
            temperature: 0.7,
            thinkingConfig: { thinkingBudget: -1 }
          }
        });
        return response.text;
      }
    } catch (error) {
      console.error('Google Gemini error:', error.message);
    }

    // Fallback to OpenRouter
    if (taskType === 'writing') {
      return this.openRouter.writeContent(prompt);
    }
    return this.openRouter.deepThinking(prompt);
  }

  /**
   * Deep thinking tasks - use best reasoning model
   */
  async deepThinkingTask(prompt) {
    // Try Google Gemini with thinking first
    try {
      if (this.google) {
        const response = await this.google.models.generateContent({
          model: 'gemini-2.5-pro',
          contents: this.formatX402Prompt(prompt),
          config: {
            thinkingConfig: { thinkingBudget: -1, includeThoughts: true }
          }
        });
        return response.text;
      }
    } catch (error) {
      console.error('Google Gemini thinking error:', error.message);
    }

    // Fallback to DeepSeek via OpenRouter
    return this.openRouter.deepThinking(prompt);
  }

  /**
   * Code generation tasks
   */
  async codeTask(prompt) {
    // Try XAI Grok first (best for code)
    try {
      if (this.xai) {
        const completion = await this.xai.chat.completions.create({
          model: 'grok-beta',
          messages: [{ role: 'user', content: this.formatX402Prompt(prompt) }]
        });
        return completion.choices[0].message.content;
      }
    } catch (error) {
      console.error('XAI Grok error:', error.message);
    }

    // Try Google Gemini Code
    try {
      if (this.google) {
        const response = await this.google.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: this.formatX402Prompt(prompt),
          config: {
            systemInstruction: 'You are an expert Solana/Rust developer working on the X402 protocol.'
          }
        });
        return response.text;
      }
    } catch (error) {
      console.error('Google Gemini code error:', error.message);
    }

    // Fallback to OpenRouter
    return this.openRouter.grokCode(prompt);
  }

  /**
   * Vision analysis tasks
   */
  async visionTask(imageUrl, prompt) {
    // Try Google Gemini Flash with vision
    try {
      if (this.google) {
        const response = await this.google.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              parts: [
                { text: this.formatX402Prompt(prompt) },
                { inlineData: { data: imageUrl, mimeType: 'image/jpeg' } }
              ]
            }
          ]
        });
        return response.text;
      }
    } catch (error) {
      console.error('Google vision error:', error.message);
    }

    // Fallback to Cloudflare
    return this.cloudflare.analyzeImage(imageUrl, prompt);
  }

  /**
   * Fast response tasks
   */
  async fastTask(prompt) {
    // Try Google Gemini Flash (fastest)
    try {
      if (this.google) {
        const response = await this.google.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: this.formatX402Prompt(prompt),
          config: {
            thinkingConfig: { thinkingBudget: 0 }
          }
        });
        return response.text;
      }
    } catch (error) {
      console.error('Google Flash error:', error.message);
    }

    // Fallback to Cloudflare Llama
    return this.cloudflare.llama(prompt);
  }

  /**
   * Translation tasks
   */
  async translationTask(prompt) {
    // Try Google Gemini (supports 100+ languages)
    try {
      if (this.google) {
        const response = await this.google.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: this.formatX402Prompt(prompt)
        });
        return response.text;
      }
    } catch (error) {
      console.error('Google translation error:', error.message);
    }

    // Fallback to Cloudflare
    return this.cloudflare.qwen(prompt);
  }

  /**
   * Text-to-speech tasks
   */
  async ttsTask(text) {
    // Try Google Gemini TTS first
    try {
      if (this.google) {
        const response = await this.google.models.generateContent({
          model: 'gemini-2.5-flash-preview-tts',
          contents: [{ parts: [{ text: `Say: ${text}` }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
            }
          }
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      }
    } catch (error) {
      console.error('Google TTS error:', error.message);
    }

    // Fallback to Cloudflare
    return this.cloudflare.textToSpeech(text);
  }

  /**
   * Speech-to-text tasks
   */
  async sttTask(audio) {
    // Use Cloudflare Whisper
    return this.cloudflare.speechToText(audio);
  }

  /**
   * General purpose task with cascading fallbacks
   */
  async generalTask(prompt) {
    // Try providers in order of preference
    const providers = [
      { name: 'Google Gemini', fn: () => this.google?.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: this.formatX402Prompt(prompt)
      }).then(r => r.text) },
      { name: 'OpenAI GPT', fn: () => this.openai?.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: this.formatX402Prompt(prompt) }]
      }).then(r => r.choices[0].message.content) },
      { name: 'XAI Grok', fn: () => this.xai?.chat.completions.create({
        model: 'grok-beta',
        messages: [{ role: 'user', content: this.formatX402Prompt(prompt) }]
      }).then(r => r.choices[0].message.content) },
      { name: 'Anthropic Claude', fn: () => this.anthropic?.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: this.formatX402Prompt(prompt) }]
      }).then(r => r.content[0].text) },
      { name: 'Cloudflare Llama', fn: () => this.cloudflare.llama(prompt) }
    ];

    for (const provider of providers) {
      try {
        if (provider.fn) {
          const result = await provider.fn();
          if (result) return result;
        }
      } catch (error) {
        console.error(`${provider.name} error:`, error.message);
      }
    }

    throw new Error('All AI providers failed');
  }

  /**
   * Format prompt with X402 agent context and knowledge
   */
  formatX402Prompt(prompt) {
    return `You are the X402 Solana Agent, an AI assistant for the X402 protocol on Solana.

${this.knowledgeContext}

Your role is to assist with:
• Solana blockchain operations and payments
• X402 protocol implementation and usage
• Autonomous agent-to-agent payments
• Trading and DeFi on Solana
• Web3 payments and micropayments

${prompt}`;
  }

  /**
   * Get specific X402 knowledge
   */
  getKnowledge(category) {
    return getX402Knowledge(category);
  }

  /**
   * Answer questions about X402 protocol
   */
  async answerX402Question(question) {
    const enhancedPrompt = `${this.formatX402Prompt('')}

Question about X402 Protocol: ${question}

Please provide a detailed, accurate answer based on the X402 protocol knowledge provided above.`;

    return await this.deepThinkingTask(enhancedPrompt);
  }

  /**
   * Parallel processing for multi-model consensus
   */
  async consensus(prompt, models = ['claude', 'llama', 'deepseek', 'mistral']) {
    const promises = models.map(async (model) => {
      switch(model) {
        case 'claude':
          return this.openRouter.claudeAnalysis(prompt);
        case 'grok':
          return this.openRouter.grokCode(prompt);
        case 'deepseek':
          return this.openRouter.deepThinking(prompt);
        case 'google':
          return this.openRouter.googleQuery(prompt);
        case 'llama':
          return this.cloudflare.llama(prompt);
        case 'mistral':
          return this.cloudflare.mistral(prompt);
        case 'qwen':
          return this.cloudflare.qwen(prompt);
        default:
          return this.cloudflare.llama(prompt);
      }
    });

    const results = await Promise.all(promises);

    return {
      responses: results,
      consensus: results.length > 0 ? results[0] : null, // Could implement voting logic
      modelCount: results.length
    };
  }

  /**
   * Get available Cloudflare models
   */
  getCloudflareModels() {
    return this.cloudflare.getAvailableModels();
  }

  /**
   * Generate image using Cloudflare
   */
  async generateImage(prompt, style = 'flux_schnell') {
    return this.cloudflare.generateImage(prompt, style);
  }

  /**
   * Analyze image using Cloudflare Vision
   */
  async analyzeImage(imageUrl, prompt) {
    return this.cloudflare.analyzeImage(imageUrl, prompt);
  }

  /**
   * Generate embeddings using Cloudflare
   */
  async generateEmbeddings(text) {
    return this.cloudflare.generateEmbeddings(text);
  }

  /**
   * Text to speech using Cloudflare
   */
  async textToSpeech(text) {
    return this.cloudflare.textToSpeech(text);
  }

  /**
   * Speech to text using Cloudflare Whisper
   */
  async speechToText(audioBase64) {
    return this.cloudflare.speechToText(audioBase64);
  }

  /**
   * Stream responses for real-time applications
   */
  async streamResponse(prompt, modelType = 'claude') {
    // Implementation for streaming would depend on specific use case
    // For now, return regular completion
    return await this.route(modelType, { prompt });
  }

  /**
   * X402 Agent-specific processing
   */
  async agentProcess(agentType, task, data) {
    const agentPrompts = {
      x402: `As the X402 Solana Agent, ${task}: ${data.prompt}`,
      trading: `As the X402 Solana Trading Agent, ${task}: ${data.prompt}`,
      merchant: `As the X402 Merchant Agent, ${task}: ${data.prompt}`,
      developer: `As the X402 Developer Agent for Solana/Rust, ${task}: ${data.prompt}`,
      shopping: `As the X402 Shopping Assistant Agent, ${task}: ${data.prompt}`
    };

    const enhancedPrompt = agentPrompts[agentType] || agentPrompts['x402'];

    // Route to appropriate model based on task complexity
    const taskType = this.classifyTask(task);
    return await this.route(taskType, { prompt: enhancedPrompt });
  }

  /**
   * Classify task to route to appropriate model
   */
  classifyTask(task) {
    const taskMap = {
      'analyze': 'complex_analysis',
      'write': 'content_creation',
      'code': 'code_generation',
      'review': 'code_review',
      'translate': 'translation',
      'predict': 'prediction'
    };

    for (const [key, value] of Object.entries(taskMap)) {
      if (task.toLowerCase().includes(key)) {
        return value;
      }
    }

    return 'general';
  }
}

module.exports = new X402UnifiedAgent();
