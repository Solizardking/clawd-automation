const axios = require('axios');
const config = require('../config/index.js');

class CloudflareAIProvider {
  constructor() {
    this.accountId = config.cloudflare.accountId;
    this.apiToken = config.cloudflare.apiToken;
    this.gatewayId = config.cloudflare.gatewayId || 'x402';

    // Cloudflare AI Gateway base URL
    this.gatewayBaseUrl = `https://gateway.ai.cloudflare.com/v1/${this.accountId}/${this.gatewayId}`;

    // Available Cloudflare Workers AI models
    this.models = {
      // Text Generation Models
      llama31_8b: '@cf/meta/llama-3.1-8b-instruct',
      llama32_1b: '@cf/meta/llama-3.2-1b-instruct',
      llama32_3b: '@cf/meta/llama-3.2-3b-instruct',
      mistral7b: '@cf/mistral/mistral-7b-instruct-v0.1',
      qwen25_7b: '@cf/qwen/qwen2.5-7b-instruct-awq',

      // Code Models
      deepseek_coder: '@hf/thebloke/deepseek-coder-6.7b-instruct-awq',
      codellama: '@cf/meta/codellama-7b-instruct',

      // Vision Models
      llama32_vision: '@cf/meta/llama-3.2-11b-vision-instruct',

      // Embedding Models
      bge_base: '@cf/baai/bge-base-en-v1.5',
      bge_large: '@cf/baai/bge-large-en-v1.5',

      // Translation
      m2m100: '@cf/meta/m2m100-1.2b',

      // Image Generation
      stable_diffusion: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
      flux_schnell: '@cf/black-forest-labs/flux-1-schnell',

      // Text-to-Speech
      speecht5: '@cf/microsoft/speecht5-tts',

      // Speech-to-Text
      whisper: '@cf/openai/whisper'
    };
  }

  /**
   * Generate text completion using Cloudflare Workers AI
   */
  async generateCompletion(model, prompt, options = {}) {
    try {
      const modelPath = this.models[model] || model;
      const url = `${this.gatewayBaseUrl}/workers-ai/${modelPath}`;

      const response = await axios.post(
        url,
        {
          prompt,
          max_tokens: options.maxTokens || 512,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.9,
          ...options
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.result?.response || response.data.result;
    } catch (error) {
      console.error('Cloudflare AI Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generate chat completion using Cloudflare Workers AI
   */
  async chatCompletion(model, messages, options = {}) {
    try {
      const modelPath = this.models[model] || model;
      const url = `${this.gatewayBaseUrl}/workers-ai/${modelPath}`;

      const response = await axios.post(
        url,
        {
          messages,
          max_tokens: options.maxTokens || 512,
          temperature: options.temperature || 0.7,
          ...options
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.result?.response || response.data.result;
    } catch (error) {
      console.error('Cloudflare Chat Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Use Llama 3.1 8B for general tasks
   */
  async llama(prompt, options = {}) {
    return this.generateCompletion('llama31_8b', prompt, options);
  }

  /**
   * Use Mistral 7B for complex reasoning
   */
  async mistral(prompt, options = {}) {
    return this.generateCompletion('mistral7b', prompt, options);
  }

  /**
   * Use DeepSeek Coder for code generation
   */
  async codeGeneration(prompt, options = {}) {
    return this.generateCompletion('deepseek_coder', prompt, options);
  }

  /**
   * Use Qwen 2.5 for multilingual support
   */
  async qwen(prompt, options = {}) {
    return this.generateCompletion('qwen25_7b', prompt, options);
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(text, model = 'bge_base') {
    try {
      const modelPath = this.models[model] || model;
      const url = `${this.gatewayBaseUrl}/workers-ai/${modelPath}`;

      const response = await axios.post(
        url,
        { text },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.result?.data || response.data.result;
    } catch (error) {
      console.error('Cloudflare Embeddings Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generate image using Stable Diffusion or Flux
   */
  async generateImage(prompt, model = 'flux_schnell', options = {}) {
    try {
      const modelPath = this.models[model] || model;
      const url = `${this.gatewayBaseUrl}/workers-ai/${modelPath}`;

      const response = await axios.post(
        url,
        {
          prompt,
          num_steps: options.steps || 4,
          guidance: options.guidance || 7.5,
          ...options
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      // Return base64 encoded image
      return Buffer.from(response.data).toString('base64');
    } catch (error) {
      console.error('Cloudflare Image Generation Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Vision analysis using Llama 3.2 Vision
   */
  async analyzeImage(imageUrl, prompt, options = {}) {
    try {
      const url = `${this.gatewayBaseUrl}/workers-ai/${this.models.llama32_vision}`;

      const response = await axios.post(
        url,
        {
          prompt,
          image: imageUrl,
          max_tokens: options.maxTokens || 512,
          ...options
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.result?.response || response.data.result;
    } catch (error) {
      console.error('Cloudflare Vision Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Translate text using M2M100
   */
  async translate(text, sourceLang, targetLang) {
    try {
      const url = `${this.gatewayBaseUrl}/workers-ai/${this.models.m2m100}`;

      const response = await axios.post(
        url,
        {
          text,
          source_lang: sourceLang,
          target_lang: targetLang
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.result?.translated_text || response.data.result;
    } catch (error) {
      console.error('Cloudflare Translation Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Text to speech
   */
  async textToSpeech(text) {
    try {
      const url = `${this.gatewayBaseUrl}/workers-ai/${this.models.speecht5}`;

      const response = await axios.post(
        url,
        { text },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      return Buffer.from(response.data).toString('base64');
    } catch (error) {
      console.error('Cloudflare TTS Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Speech to text using Whisper
   */
  async speechToText(audioBase64) {
    try {
      const url = `${this.gatewayBaseUrl}/workers-ai/${this.models.whisper}`;

      const response = await axios.post(
        url,
        {
          audio: audioBase64
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.result?.text || response.data.result;
    } catch (error) {
      console.error('Cloudflare STT Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Route through AI Gateway for any provider (OpenAI, Anthropic, etc.)
   */
  async gatewayRequest(provider, endpoint, payload) {
    try {
      const url = `${this.gatewayBaseUrl}/${provider}${endpoint}`;

      const response = await axios.post(
        url,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Cloudflare Gateway Error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Route OpenAI requests through Cloudflare Gateway
   */
  async openaiGateway(endpoint, payload) {
    return this.gatewayRequest('openai', endpoint, payload);
  }

  /**
   * Route Anthropic requests through Cloudflare Gateway
   */
  async anthropicGateway(endpoint, payload) {
    return this.gatewayRequest('anthropic', endpoint, payload);
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    return Object.keys(this.models).map(key => ({
      id: key,
      path: this.models[key],
      category: this.categorizeModel(key)
    }));
  }

  /**
   * Categorize model by type
   */
  categorizeModel(modelKey) {
    if (modelKey.includes('llama') && !modelKey.includes('vision')) return 'text';
    if (modelKey.includes('mistral') || modelKey.includes('qwen')) return 'text';
    if (modelKey.includes('deepseek') || modelKey.includes('code')) return 'code';
    if (modelKey.includes('vision')) return 'vision';
    if (modelKey.includes('bge')) return 'embedding';
    if (modelKey.includes('m2m')) return 'translation';
    if (modelKey.includes('stable') || modelKey.includes('flux')) return 'image';
    if (modelKey.includes('speech')) return 'audio';
    if (modelKey.includes('whisper')) return 'audio';
    return 'other';
  }

  /**
   * Get gateway analytics (if available)
   */
  async getAnalytics() {
    try {
      // Cloudflare AI Gateway provides analytics
      // This would require additional API endpoint access
      return {
        gatewayId: this.gatewayId,
        accountId: this.accountId,
        message: 'Analytics available in Cloudflare Dashboard'
      };
    } catch (error) {
      console.error('Analytics Error:', error.message);
      return null;
    }
  }
}

module.exports = new CloudflareAIProvider();
