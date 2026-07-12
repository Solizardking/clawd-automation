const axios = require('axios');
const config = require('../config/index.js');

class OpenRouterProvider {
  constructor() {
    this.apiKey = config.openRouter.apiKey;
    this.baseUrl = config.openRouter.baseUrl;
    this.models = config.openRouter.models;
  }

  async generateCompletion(model, messages, options = {}) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          messages,
          ...options
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://x402.space',
            'X-Title': 'X402 Solana Agent',
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenRouter API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Specialized model methods
  async writeContent(prompt) {
    return this.generateCompletion(this.models.writing, [
      { role: 'user', content: prompt }
    ]);
  }

  async deepThinking(prompt) {
    return this.generateCompletion(this.models.deep, [
      { role: 'user', content: prompt }
    ]);
  }

  async googleQuery(prompt) {
    return this.generateCompletion(this.models.google, [
      { role: 'user', content: prompt }
    ]);
  }

  async claudeAnalysis(prompt) {
    return this.generateCompletion(this.models.claude, [
      { role: 'user', content: prompt }
    ]);
  }

  async grokCode(prompt) {
    return this.generateCompletion(this.models.grokCode, [
      { role: 'user', content: prompt }
    ]);
  }

  async kimiAssist(prompt) {
    return this.generateCompletion(this.models.kimi, [
      { role: 'user', content: prompt }
    ]);
  }

  async nvidiaInference(prompt) {
    return this.generateCompletion(this.models.nvidia, [
      { role: 'user', content: prompt }
    ]);
  }

  // Vision capabilities
  async analyzeImage(imageUrl, prompt) {
    return this.generateCompletion(this.models.claude, [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          }
        ]
      }
    ]);
  }
}

module.exports = new OpenRouterProvider();
