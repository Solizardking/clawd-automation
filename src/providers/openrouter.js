/**
 * OpenRouter CJS provider — free-router aware.
 *
 * Env:
 *   OPENROUTER_API_KEY
 *   OPENROUTER_FREE_MODEL   (default: openrouter/free)
 *   OPENROUTER_MODEL
 *   OPENROUTER_PROVIDER_SORT (price|throughput|latency)
 */

const config = require('../config/index.js');

const FREE_ROUTER = 'openrouter/free';

class OpenRouterProvider {
  constructor() {
    this.apiKey = config.openRouter.apiKey;
    this.baseUrl = config.openRouter.baseUrl || 'https://openrouter.ai/api/v1';
    this.models = config.openRouter.models;
    this.freeModel = config.openRouter.freeModel || FREE_ROUTER;
    this.defaultModel = config.openRouter.defaultModel || this.freeModel;
    this.siteUrl = config.openRouter.siteUrl || 'https://x402.wtf';
    this.appName = config.openRouter.appName || 'Clawd Automaton';
    this.providerSort = config.openRouter.providerSort;
  }

  /**
   * Chat completions via OpenRouter (returns full message content string).
   * @param {string} [model] - defaults to free router / OPENROUTER_FREE_MODEL
   * @param {Array} messages
   * @param {object} [options] - extra body fields; options.provider merges routing prefs
   */
  async generateCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }

    const resolvedModel = model || this.defaultModel || this.freeModel || FREE_ROUTER;
    const { provider: providerOverride, ...rest } = options;

    const body = {
      model: resolvedModel,
      messages,
      ...rest,
    };

    const provider = {
      ...(this.providerSort ? { sort: this.providerSort } : {}),
      ...(providerOverride || {}),
    };
    if (Object.keys(provider).length > 0) {
      body.provider = provider;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.appName,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error?.message || JSON.stringify(data) || response.statusText;
      throw new Error(`OpenRouter API Error: ${response.status} ${msg}`);
    }

    // Free router: data.model is the actual selected free model
    this.lastModelUsed = data.model || resolvedModel;
    this.lastUsage = data.usage || null;

    return data.choices?.[0]?.message?.content ?? '';
  }

  /** Full response object (for callers that need model/usage metadata). */
  async chat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }
    const model = options.model || this.defaultModel || this.freeModel || FREE_ROUTER;
    const { model: _m, provider: providerOverride, ...rest } = options;
    const body = { model, messages, ...rest };
    const provider = {
      ...(this.providerSort ? { sort: this.providerSort } : {}),
      ...(providerOverride || {}),
    };
    if (Object.keys(provider).length > 0) body.provider = provider;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.appName,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error?.message || JSON.stringify(data) || response.statusText;
      throw new Error(`OpenRouter API Error: ${response.status} ${msg}`);
    }
    this.lastModelUsed = data.model || model;
    this.lastUsage = data.usage || null;
    return data;
  }

  /** Zero-cost path via Free Models Router. */
  async freeChat(messages, options = {}) {
    return this.generateCompletion(this.freeModel || FREE_ROUTER, messages, options);
  }

  async writeContent(prompt) {
    return this.generateCompletion(this.models.writing || this.freeModel, [
      { role: 'user', content: prompt },
    ]);
  }

  async deepThinking(prompt) {
    return this.generateCompletion(this.models.deep || this.freeModel, [
      { role: 'user', content: prompt },
    ]);
  }

  async googleQuery(prompt) {
    return this.generateCompletion(this.models.google || this.freeModel, [
      { role: 'user', content: prompt },
    ]);
  }

  async claudeAnalysis(prompt) {
    return this.generateCompletion(this.models.claude || this.freeModel, [
      { role: 'user', content: prompt },
    ]);
  }

  async grokCode(prompt) {
    return this.generateCompletion(this.models.grokCode || this.freeModel, [
      { role: 'user', content: prompt },
    ]);
  }

  async kimiAssist(prompt) {
    return this.generateCompletion(this.models.kimi || this.freeModel, [
      { role: 'user', content: prompt },
    ]);
  }

  async nvidiaInference(prompt) {
    return this.generateCompletion(this.models.nvidia || this.freeModel, [
      { role: 'user', content: prompt },
    ]);
  }

  async analyzeImage(imageUrl, prompt) {
    return this.generateCompletion(this.models.claude || this.freeModel, [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ]);
  }
}

module.exports = new OpenRouterProvider();
