const TradingAgent = require('./trading-agent');
const MerchantAgent = require('./merchant-agent');
const DeveloperAgent = require('./developer-agent');
const ShoppingAgent = require('./shopping-agent');
const aiProvider = require('../providers/unified-ai');

class AgentCouncil {
  constructor() {
    this.agents = {
      trading: new TradingAgent(),
      merchant: new MerchantAgent(),
      developer: new DeveloperAgent(),
      shopping: new ShoppingAgent()
    };

    this.sessions = new Map();
    this.votingHistory = [];
  }

  /**
   * Route task to appropriate agent
   */
  async routeTask(task, params) {
    const agentType = this.classifyTask(task);
    const agent = this.agents[agentType];

    if (!agent) {
      throw new Error(`No agent found for task type: ${agentType}`);
    }

    return await agent.act(task, params);
  }

  /**
   * Classify task to determine appropriate agent
   */
  classifyTask(task) {
    const taskPatterns = {
      trading: ['trade', 'swap', 'buy', 'sell', 'analyze market', 'price', 'dex'],
      merchant: ['payment', 'sell product', 'inventory', 'pricing', 'discount', 'refund'],
      developer: ['code', 'program', 'smart contract', 'api', 'debug', 'test'],
      shopping: ['shop', 'find product', 'compare', 'deal', 'recommend', 'cart']
    };

    const lowerTask = task.toLowerCase();

    for (const [agentType, patterns] of Object.entries(taskPatterns)) {
      if (patterns.some(pattern => lowerTask.includes(pattern))) {
        return agentType;
      }
    }

    return 'trading'; // Default
  }

  /**
   * Execute collaborative task with multiple agents
   */
  async collaborate(task, params) {
    const relevantAgents = this.selectRelevantAgents(task);

    const results = await Promise.all(
      relevantAgents.map(async (agentType) => {
        const agent = this.agents[agentType];
        try {
          const result = await agent.think(task);
          return {
            agent: agentType,
            result,
            success: true
          };
        } catch (error) {
          return {
            agent: agentType,
            error: error.message,
            success: false
          };
        }
      })
    );

    const consensus = await this.buildConsensus(results);

    return {
      task,
      agents: relevantAgents,
      results,
      consensus,
      timestamp: Date.now()
    };
  }

  /**
   * Select relevant agents for a task
   */
  selectRelevantAgents(task) {
    const lowerTask = task.toLowerCase();
    const selected = [];

    if (lowerTask.includes('trade') || lowerTask.includes('market')) {
      selected.push('trading');
    }
    if (lowerTask.includes('payment') || lowerTask.includes('merchant')) {
      selected.push('merchant');
    }
    if (lowerTask.includes('code') || lowerTask.includes('develop')) {
      selected.push('developer');
    }
    if (lowerTask.includes('shop') || lowerTask.includes('product')) {
      selected.push('shopping');
    }

    // If no specific match, use all agents for comprehensive analysis
    return selected.length > 0 ? selected : Object.keys(this.agents);
  }

  /**
   * Build consensus from multiple agent responses
   */
  async buildConsensus(results) {
    const successfulResults = results.filter(r => r.success);

    if (successfulResults.length === 0) {
      return {
        consensus: null,
        confidence: 0,
        reason: 'No successful agent responses'
      };
    }

    if (successfulResults.length === 1) {
      return {
        consensus: successfulResults[0].result,
        confidence: 0.7,
        reason: 'Single agent response'
      };
    }

    // Use AI to synthesize consensus
    const consensusPrompt = `
      Synthesize a consensus from these agent responses:

      ${successfulResults.map((r, i) => `
        Agent ${i + 1} (${r.agent}):
        ${r.result}
      `).join('\n\n')}

      Provide:
      1. Consensus recommendation
      2. Key agreements
      3. Key disagreements
      4. Confidence level (0-100)
    `;

    const synthesis = await aiProvider.route('complex_analysis', {
      prompt: consensusPrompt
    });

    return {
      consensus: synthesis,
      confidence: 0.85,
      agentCount: successfulResults.length,
      reason: 'Multi-agent consensus'
    };
  }

  /**
   * Voting mechanism for decision making
   */
  async vote(proposal, params) {
    const votes = await Promise.all(
      Object.entries(this.agents).map(async ([type, agent]) => {
        const vote = await agent.think(`
          Vote on this proposal (YES/NO/ABSTAIN):

          Proposal: ${proposal}
          Parameters: ${JSON.stringify(params, null, 2)}

          Provide your vote and reasoning.
        `);

        return {
          agent: type,
          vote: this.parseVote(vote),
          reasoning: vote
        };
      })
    );

    const tally = this.tallyVotes(votes);

    const result = {
      proposal,
      params,
      votes,
      tally,
      decision: this.determineDecision(tally),
      timestamp: Date.now()
    };

    this.votingHistory.push(result);

    return result;
  }

  /**
   * Parse vote from agent response
   */
  parseVote(response) {
    const upper = response.toUpperCase();
    if (upper.includes('YES') && !upper.includes('NO')) return 'YES';
    if (upper.includes('NO')) return 'NO';
    return 'ABSTAIN';
  }

  /**
   * Tally votes
   */
  tallyVotes(votes) {
    return votes.reduce((tally, vote) => {
      tally[vote.vote] = (tally[vote.vote] || 0) + 1;
      return tally;
    }, { YES: 0, NO: 0, ABSTAIN: 0 });
  }

  /**
   * Determine decision from vote tally
   */
  determineDecision(tally) {
    const total = tally.YES + tally.NO + tally.ABSTAIN;
    const yesPercent = (tally.YES / total) * 100;

    if (yesPercent >= 75) {
      return { decision: 'APPROVED', confidence: 'HIGH' };
    } else if (yesPercent >= 50) {
      return { decision: 'APPROVED', confidence: 'MEDIUM' };
    } else if (tally.NO > tally.YES) {
      return { decision: 'REJECTED', confidence: 'HIGH' };
    } else {
      return { decision: 'UNDECIDED', confidence: 'LOW' };
    }
  }

  /**
   * Create collaborative session
   */
  createSession(sessionId, participants) {
    const session = {
      id: sessionId,
      participants,
      agents: participants.map(type => this.agents[type]),
      messages: [],
      createdAt: Date.now(),
      active: true
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Add message to session
   */
  async sessionMessage(sessionId, message, fromAgent = null) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.messages.push({
      from: fromAgent || 'user',
      message,
      timestamp: Date.now()
    });

    // Get responses from all participating agents
    const responses = await Promise.all(
      session.agents.map(async (agent) => {
        const response = await agent.think(`
          Session context:
          ${session.messages.map(m => `${m.from}: ${m.message}`).join('\n')}

          New message: ${message}

          Respond based on your expertise.
        `);

        return {
          agent: agent.name,
          response
        };
      })
    );

    // Add agent responses to session
    responses.forEach(r => {
      session.messages.push({
        from: r.agent,
        message: r.response,
        timestamp: Date.now()
      });
    });

    return responses;
  }

  /**
   * Get all agent statuses
   */
  getCouncilStatus() {
    return {
      agents: Object.entries(this.agents).map(([type, agent]) => ({
        type,
        ...agent.getStatus()
      })),
      activeSessions: this.sessions.size,
      votingHistory: this.votingHistory.length,
      timestamp: Date.now()
    };
  }

  /**
   * Optimize task execution with best agent
   */
  async optimizeExecution(task, params) {
    // Analyze task complexity
    const analysis = await aiProvider.route('complex_analysis', {
      prompt: `Analyze this task and determine:
        1. Complexity level (simple/medium/complex)
        2. Required capabilities
        3. Recommended agent type(s)

        Task: ${task}
        Parameters: ${JSON.stringify(params, null, 2)}
      `
    });

    // Route to appropriate execution method
    if (analysis.includes('multiple') || analysis.includes('collaborate')) {
      return await this.collaborate(task, params);
    } else {
      return await this.routeTask(task, params);
    }
  }

  /**
   * Emergency council meeting (all agents weigh in)
   */
  async emergencyMeeting(issue, urgency = 'high') {
    const meeting = {
      id: `EMERGENCY_${Date.now()}`,
      issue,
      urgency,
      timestamp: Date.now()
    };

    const responses = await this.collaborate(`
      EMERGENCY MEETING - ${urgency.toUpperCase()} URGENCY

      Issue: ${issue}

      Provide immediate assessment and recommendations.
    `, {});

    return {
      ...meeting,
      ...responses,
      resolution: responses.consensus
    };
  }
}

module.exports = new AgentCouncil();
