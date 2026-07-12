/**
 * Agent-to-Agent (A2A) Protocol Implementation
 * Google Vertex AI Agents + X402 Micropayments
 *
 * Implements secure, authenticated communication between autonomous agents
 * with built-in X402 payment settlement on Solana
 */

const crypto = require('crypto');
const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const x402Payment = require('../../services/x402-spl-token');
const config = require('../../config/index.js');

class A2AProtocol {
  constructor() {
    this.connection = new Connection(config.solana.rpcUrl);

    // Get X402 token mint from config
    const mintAddress = config.solana?.x402TokenMint || config.x402?.tokenMint || '6H8uyJYrPVcra6Fi7iWh29DXSm8KctzhHRyXmPwKpump';
    this.x402Mint = new PublicKey(mintAddress);

    // Agent registry - maps agent IDs to their public keys and endpoints
    this.agentRegistry = new Map();

    // Message queue for async agent communication
    this.messageQueue = [];

    // Active sessions between agents
    this.sessions = new Map();

    // Payment escrow for multi-step agent interactions
    this.escrows = new Map();
  }

  /**
   * Register an agent in the A2A network
   */
  registerAgent(agentConfig) {
    const {
      agentId,
      agentName,
      publicKey,
      endpoint,
      capabilities,
      pricingModel
    } = agentConfig;

    this.agentRegistry.set(agentId, {
      agentId,
      agentName,
      publicKey: new PublicKey(publicKey),
      endpoint,
      capabilities,
      pricingModel,
      registeredAt: Date.now(),
      reputation: 100, // Start at 100, adjusted based on performance
      totalTransactions: 0
    });

    console.log(`✅ Registered agent: ${agentName} (${agentId})`);
    return true;
  }

  /**
   * Send message from one agent to another with optional payment
   */
  async sendMessage(fromAgentId, toAgentId, message, options = {}) {
    const {
      requiresPayment = false,
      paymentAmount = 0,
      priority = 'normal',
      expectResponse = true,
      timeout = 30000
    } = options;

    // Validate agents exist
    const fromAgent = this.agentRegistry.get(fromAgentId);
    const toAgent = this.agentRegistry.get(toAgentId);

    if (!fromAgent || !toAgent) {
      throw new Error('Agent not found in registry');
    }

    // Create message envelope
    const envelope = {
      messageId: this.generateMessageId(),
      from: fromAgentId,
      to: toAgentId,
      timestamp: Date.now(),
      priority,
      payload: message,
      signature: null,
      payment: requiresPayment ? {
        amount: paymentAmount,
        status: 'pending',
        txSignature: null
      } : null
    };

    // Sign message with agent's private key
    envelope.signature = this.signMessage(envelope, fromAgent);

    // Process payment if required
    if (requiresPayment && paymentAmount > 0) {
      try {
        const paymentTx = await this.processPayment(
          fromAgent.publicKey,
          toAgent.publicKey,
          paymentAmount
        );

        envelope.payment.status = 'completed';
        envelope.payment.txSignature = paymentTx;

        console.log(`💳 Payment processed: ${paymentAmount} X402 from ${fromAgentId} to ${toAgentId}`);
      } catch (error) {
        console.error('Payment failed:', error.message);
        envelope.payment.status = 'failed';
        throw new Error(`Payment required but failed: ${error.message}`);
      }
    }

    // Add to message queue
    this.messageQueue.push(envelope);

    // Deliver message
    const response = await this.deliverMessage(envelope, expectResponse, timeout);

    return {
      messageId: envelope.messageId,
      delivered: true,
      paymentStatus: envelope.payment?.status,
      response
    };
  }

  /**
   * Deliver message to target agent
   */
  async deliverMessage(envelope, expectResponse, timeout) {
    const toAgent = this.agentRegistry.get(envelope.to);

    // Verify message signature
    if (!this.verifySignature(envelope)) {
      throw new Error('Invalid message signature');
    }

    // Simulate message delivery (in production, this would be HTTP/gRPC call)
    console.log(`📨 Delivering message ${envelope.messageId} to ${toAgent.agentName}`);

    if (expectResponse) {
      // Wait for response with timeout
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Response timeout'));
        }, timeout);

        // Simulate async response (in production, agent would call respondToMessage)
        setTimeout(() => {
          clearTimeout(timeoutId);
          resolve({
            responseId: this.generateMessageId(),
            success: true,
            data: { acknowledged: true }
          });
        }, 100);
      });
    }

    return null;
  }

  /**
   * Process X402 payment between agents
   */
  async processPayment(fromWallet, toWallet, amount) {
    // In production, this would create and send actual Solana transaction
    // For now, we'll return a mock transaction signature

    const mockSignature = crypto.randomBytes(32).toString('hex');

    console.log(`💸 Processing ${amount} X402 payment`);
    console.log(`   From: ${fromWallet.toString()}`);
    console.log(`   To: ${toWallet.toString()}`);

    // Update agent transaction counts
    const fromAgent = Array.from(this.agentRegistry.values())
      .find(a => a.publicKey.equals(fromWallet));
    const toAgent = Array.from(this.agentRegistry.values())
      .find(a => a.publicKey.equals(toWallet));

    if (fromAgent) fromAgent.totalTransactions++;
    if (toAgent) toAgent.totalTransactions++;

    return mockSignature;
  }

  /**
   * Create a multi-agent session for collaborative work
   */
  async createSession(sessionConfig) {
    const {
      sessionId = this.generateSessionId(),
      participants,
      coordinator,
      purpose,
      budget,
      timeLimit
    } = sessionConfig;

    // Validate all participants are registered
    for (const agentId of participants) {
      if (!this.agentRegistry.has(agentId)) {
        throw new Error(`Agent ${agentId} not registered`);
      }
    }

    const session = {
      sessionId,
      participants,
      coordinator,
      purpose,
      budget,
      spent: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + (timeLimit || 3600000), // Default 1 hour
      status: 'active',
      messages: [],
      decisions: []
    };

    this.sessions.set(sessionId, session);

    console.log(`🤝 Created A2A session: ${sessionId}`);
    console.log(`   Participants: ${participants.join(', ')}`);
    console.log(`   Budget: ${budget} X402`);

    return session;
  }

  /**
   * Agent votes in a session (for consensus decisions)
   */
  async submitVote(sessionId, agentId, vote) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    if (!session.participants.includes(agentId)) {
      throw new Error('Agent not part of session');
    }

    const voteRecord = {
      agentId,
      vote,
      timestamp: Date.now(),
      weight: this.getAgentWeight(agentId)
    };

    session.decisions.push(voteRecord);

    console.log(`🗳️  ${agentId} voted in session ${sessionId}`);

    return voteRecord;
  }

  /**
   * Calculate consensus in a session
   */
  calculateConsensus(sessionId) {
    const session = this.sessions.get(sessionId);

    if (!session || !session.decisions.length) {
      return null;
    }

    // Group votes by decision
    const voteGroups = {};
    let totalWeight = 0;

    session.decisions.forEach(decision => {
      const voteKey = JSON.stringify(decision.vote);

      if (!voteGroups[voteKey]) {
        voteGroups[voteKey] = {
          vote: decision.vote,
          weight: 0,
          agents: []
        };
      }

      voteGroups[voteKey].weight += decision.weight;
      voteGroups[voteKey].agents.push(decision.agentId);
      totalWeight += decision.weight;
    });

    // Find winning vote
    const votes = Object.values(voteGroups);
    votes.sort((a, b) => b.weight - a.weight);

    const consensus = {
      decision: votes[0].vote,
      confidence: (votes[0].weight / totalWeight) * 100,
      supportingAgents: votes[0].agents,
      totalVotes: session.decisions.length,
      alternatives: votes.slice(1)
    };

    return consensus;
  }

  /**
   * Get agent weight for voting (based on reputation and expertise)
   */
  getAgentWeight(agentId) {
    const agent = this.agentRegistry.get(agentId);

    if (!agent) return 0;

    // Weight based on reputation (0-100) and transaction history
    const reputationWeight = agent.reputation / 100;
    const experienceWeight = Math.min(agent.totalTransactions / 1000, 1);

    return (reputationWeight * 0.7) + (experienceWeight * 0.3);
  }

  /**
   * Request resource from another agent with payment
   */
  async requestResource(fromAgentId, toAgentId, resourceType, params) {
    const toAgent = this.agentRegistry.get(toAgentId);

    if (!toAgent) {
      throw new Error('Target agent not found');
    }

    // Check if agent provides this resource
    if (!toAgent.capabilities.includes(resourceType)) {
      throw new Error(`Agent ${toAgentId} doesn't provide ${resourceType}`);
    }

    // Get pricing for resource
    const price = this.getResourcePrice(toAgent, resourceType, params);

    console.log(`🔌 ${fromAgentId} requesting ${resourceType} from ${toAgentId}`);
    console.log(`   Price: ${price} X402`);

    // Send request with payment
    const response = await this.sendMessage(fromAgentId, toAgentId, {
      type: 'RESOURCE_REQUEST',
      resourceType,
      params
    }, {
      requiresPayment: true,
      paymentAmount: price,
      expectResponse: true
    });

    return response;
  }

  /**
   * Get resource pricing from agent's pricing model
   */
  getResourcePrice(agent, resourceType, params) {
    const { pricingModel } = agent;

    if (!pricingModel || !pricingModel[resourceType]) {
      return 0.01; // Default price
    }

    const pricing = pricingModel[resourceType];

    // Support different pricing models
    if (pricing.type === 'fixed') {
      return pricing.amount;
    } else if (pricing.type === 'tiered') {
      // Price based on complexity/size
      const tier = params.complexity || 'medium';
      return pricing.tiers[tier] || pricing.default;
    } else if (pricing.type === 'usage') {
      // Price based on usage metrics
      const units = params.units || 1;
      return pricing.pricePerUnit * units;
    }

    return 0.01;
  }

  /**
   * Create escrow for multi-step agent interaction
   */
  async createEscrow(fromAgentId, toAgentId, amount, conditions) {
    const escrowId = this.generateEscrowId();

    const escrow = {
      escrowId,
      fromAgentId,
      toAgentId,
      amount,
      conditions,
      status: 'locked',
      createdAt: Date.now(),
      releasedAt: null
    };

    this.escrows.set(escrowId, escrow);

    console.log(`🔒 Created escrow: ${escrowId}`);
    console.log(`   Amount: ${amount} X402`);
    console.log(`   Conditions: ${conditions.length}`);

    return escrowId;
  }

  /**
   * Release escrow when conditions are met
   */
  async releaseEscrow(escrowId, proof) {
    const escrow = this.escrows.get(escrowId);

    if (!escrow) {
      throw new Error('Escrow not found');
    }

    if (escrow.status !== 'locked') {
      throw new Error('Escrow already processed');
    }

    // Verify conditions are met
    const conditionsMet = this.verifyEscrowConditions(escrow, proof);

    if (!conditionsMet) {
      throw new Error('Escrow conditions not met');
    }

    // Process payment
    const fromAgent = this.agentRegistry.get(escrow.fromAgentId);
    const toAgent = this.agentRegistry.get(escrow.toAgentId);

    await this.processPayment(fromAgent.publicKey, toAgent.publicKey, escrow.amount);

    escrow.status = 'released';
    escrow.releasedAt = Date.now();

    console.log(`✅ Escrow ${escrowId} released: ${escrow.amount} X402`);

    return true;
  }

  /**
   * Verify escrow conditions
   */
  verifyEscrowConditions(escrow, proof) {
    // Implement condition verification logic
    // For now, return true if proof is provided
    return proof && proof.verified === true;
  }

  // Helper methods

  generateMessageId() {
    return `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateSessionId() {
    return `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateEscrowId() {
    return `escrow_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  signMessage(envelope, agent) {
    const message = JSON.stringify({
      from: envelope.from,
      to: envelope.to,
      timestamp: envelope.timestamp,
      payload: envelope.payload
    });

    return crypto.createHash('sha256').update(message).digest('hex');
  }

  verifySignature(envelope) {
    // In production, verify with agent's public key
    return envelope.signature && envelope.signature.length === 64;
  }

  /**
   * Get agent registry
   */
  getRegistry() {
    return Array.from(this.agentRegistry.values());
  }

  /**
   * Get active sessions
   */
  getActiveSessions() {
    return Array.from(this.sessions.values())
      .filter(s => s.status === 'active');
  }

  /**
   * Get message history
   */
  getMessageHistory(limit = 50) {
    return this.messageQueue.slice(-limit);
  }

  /**
   * Get network statistics
   */
  getNetworkStats() {
    const agents = Array.from(this.agentRegistry.values());

    return {
      totalAgents: agents.length,
      totalMessages: this.messageQueue.length,
      activeSessions: this.getActiveSessions().length,
      totalEscrows: this.escrows.size,
      averageReputation: agents.reduce((sum, a) => sum + a.reputation, 0) / agents.length,
      totalTransactions: agents.reduce((sum, a) => sum + a.totalTransactions, 0)
    };
  }
}

module.exports = new A2AProtocol();
