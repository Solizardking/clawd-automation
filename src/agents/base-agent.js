const aiProvider = require('../providers/unified-ai');

class BaseAgent {
  constructor(name, type, capabilities = []) {
    this.name = name;
    this.type = type;
    this.capabilities = capabilities;
    this.memory = [];
    this.state = 'idle';
    this.personaId = null;
    this.useKnowledge = false;
  }

  /**
   * Attach a hedge persona to this agent
   */
  setPersona(personaId) {
    this.personaId = personaId;
    return this;
  }

  /**
   * Enable/disable knowledge base context injection
   */
  setKnowledge(enabled = true) {
    this.useKnowledge = enabled;
    return this;
  }

  /**
   * Get persona prompt context (if persona attached)
   */
  getPersonaContext() {
    if (!this.personaId) return '';
    try {
      const personas = require('../services/personas');
      return personas.getPersonaPrompt(this.personaId, { maxChars: 2000 });
    } catch {
      return '';
    }
  }

  /**
   * Get knowledge base context (if enabled)
   */
  getKnowledgeContext() {
    if (!this.useKnowledge) return '';
    try {
      const knowledge = require('../knowledge/clawdbrowser');
      return knowledge.getPromptContext({ maxChars: 3000, minConfidence: 'high' });
    } catch {
      return '';
    }
  }

  /**
   * Add message to agent memory
   */
  remember(message) {
    this.memory.push({
      timestamp: Date.now(),
      content: message
    });

    // Keep only last 50 messages
    if (this.memory.length > 50) {
      this.memory = this.memory.slice(-50);
    }
  }

  /**
   * Get agent memory context
   */
  getContext() {
    return this.memory.map(m => m.content).join('\n');
  }

  /**
   * Process task with AI (X402 Agent)
   */
  async think(prompt) {
    const personaCtx = this.getPersonaContext();
    const knowledgeCtx = this.getKnowledgeContext();

    const enhancedPrompt = `
X402 Agent: ${this.name} (${this.type})
X402 Token: 6H8uyJYrPVcra6Fi7iWh29DXSm8KctzhHRyXmPwKpump
Capabilities: ${this.capabilities.join(', ')}
${personaCtx ? `\nPersona:\n${personaCtx}\n` : ''}
${knowledgeCtx ? `\nKnowledge:\n${knowledgeCtx}\n` : ''}
Context: ${this.getContext()}

Task: ${prompt}
`;

    const response = await aiProvider.agentProcess('x402', 'analyze', {
      prompt: enhancedPrompt
    });

    this.remember(`Task: ${prompt}\nResponse: ${response}`);
    return response;
  }

  /**
   * Execute action
   */
  async act(action, params = {}) {
    this.state = 'working';

    try {
      const result = await this.executeAction(action, params);
      this.remember(`Action: ${action}\nResult: ${JSON.stringify(result)}`);
      this.state = 'idle';
      return result;
    } catch (error) {
      this.state = 'error';
      this.remember(`Action: ${action}\nError: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute specific action (to be overridden by subclasses)
   */
  async executeAction(action, params) {
    throw new Error('executeAction must be implemented by subclass');
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      type: this.type,
      state: this.state,
      capabilities: this.capabilities,
      memorySize: this.memory.length
    };
  }

  /**
   * Reset agent state
   */
  reset() {
    this.memory = [];
    this.state = 'idle';
  }
}

module.exports = BaseAgent;
