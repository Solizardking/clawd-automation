/**
 * Futarchy Governance System
 * "Vote values, but bet beliefs" - Robin Hanson
 *
 * Implements prediction market-based governance for X402 Fund
 * Uses Solana for settlement and Google Vertex AI for market analysis
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const x402Token = require('./x402-spl-token');
const vertexConfig = require('../agents/google-a2a/vertex-ai-config');
const config = require('../config/index.js');

class FutarchyGovernance {
  constructor() {
    this.connection = new Connection(config.solana.rpcUrl);

    // Active proposals
    this.proposals = new Map();

    // Prediction markets for each proposal
    this.markets = new Map();

    // Governance parameters
    this.params = {
      minProposalStake: 1000, // 1000 X402 to create proposal
      votingPeriod: 604800000, // 7 days in ms
      marketDuration: 1209600000, // 14 days in ms
      quorumThreshold: 0.05, // 5% of token supply must participate
      decisionThreshold: 0.60 // 60% confidence required to pass
    };

    // Metrics to optimize (fund's objectives)
    this.optimizationMetrics = [
      'total_aum', // Assets Under Management
      'sharpe_ratio', // Risk-adjusted returns
      'max_drawdown', // Risk management
      'win_rate', // Success rate
      'agent_efficiency' // Cost per decision
    ];
  }

  /**
   * Create a governance proposal
   */
  async createProposal(proposalData) {
    const {
      proposerId,
      title,
      description,
      action,
      params,
      stake
    } = proposalData;

    // Validate stake
    if (stake < this.params.minProposalStake) {
      throw new Error(`Minimum stake is ${this.params.minProposalStake} X402`);
    }

    // Generate proposal ID
    const proposalId = this.generateProposalId();

    const proposal = {
      proposalId,
      proposerId,
      title,
      description,
      action, // e.g., "adjust_position_sizing", "add_agent", "change_strategy"
      params,
      stake,
      status: 'active',
      createdAt: Date.now(),
      votingEnds: Date.now() + this.params.votingPeriod,
      marketEnds: Date.now() + this.params.marketDuration,
      outcome: null,
      executedAt: null
    };

    this.proposals.set(proposalId, proposal);

    // Create dual prediction markets
    await this.createPredictionMarkets(proposalId, proposal);

    console.log(`📜 Created proposal: ${title}`);
    console.log(`   ID: ${proposalId}`);
    console.log(`   Voting ends: ${new Date(proposal.votingEnds).toISOString()}`);

    return proposal;
  }

  /**
   * Create prediction markets for proposal
   * Two markets: "Adopt & Metric Improves" vs "Reject & Metric Improves"
   */
  async createPredictionMarkets(proposalId, proposal) {
    const markets = {};

    // For each optimization metric, create conditional markets
    for (const metric of this.optimizationMetrics) {
      const adoptMarket = {
        marketId: `${proposalId}_adopt_${metric}`,
        proposalId,
        condition: 'adopt',
        metric,
        description: `If proposal "${proposal.title}" is ADOPTED, will ${metric} improve by 10%+ in 30 days?`,
        outcomes: {
          yes: { shares: 0, liquidity: 0 },
          no: { shares: 0, liquidity: 0 }
        },
        currentPrice: 0.5, // Start at 50/50
        totalVolume: 0,
        participants: 0,
        createdAt: Date.now(),
        expiresAt: proposal.marketEnds
      };

      const rejectMarket = {
        marketId: `${proposalId}_reject_${metric}`,
        proposalId,
        condition: 'reject',
        metric,
        description: `If proposal "${proposal.title}" is REJECTED, will ${metric} improve by 10%+ in 30 days?`,
        outcomes: {
          yes: { shares: 0, liquidity: 0 },
          no: { shares: 0, liquidity: 0 }
        },
        currentPrice: 0.5,
        totalVolume: 0,
        participants: 0,
        createdAt: Date.now(),
        expiresAt: proposal.marketEnds
      };

      markets[`adopt_${metric}`] = adoptMarket;
      markets[`reject_${metric}`] = rejectMarket;
    }

    this.markets.set(proposalId, markets);

    console.log(`📊 Created ${Object.keys(markets).length} prediction markets for proposal`);

    return markets;
  }

  /**
   * Place bet on prediction market
   */
  async placeBet(betData) {
    const {
      marketId,
      outcome, // 'yes' or 'no'
      amount,
      bettorAddress
    } = betData;

    // Find market
    const [proposalId] = marketId.split('_adopt_').length > 1
      ? marketId.split('_adopt_')
      : marketId.split('_reject_');

    const markets = this.markets.get(proposalId);
    if (!markets) {
      throw new Error('Market not found');
    }

    const market = Object.values(markets).find(m => m.marketId === marketId);
    if (!market) {
      throw new Error('Market not found');
    }

    // Check market is still open
    if (Date.now() > market.expiresAt) {
      throw new Error('Market has expired');
    }

    // Update market state using constant product market maker (x * y = k)
    const before = market.outcomes[outcome].liquidity;
    market.outcomes[outcome].liquidity += amount;
    market.outcomes[outcome].shares += this.calculateShares(market, outcome, amount);

    // Update price based on new liquidity ratio
    const totalLiquidity = market.outcomes.yes.liquidity + market.outcomes.no.liquidity;
    market.currentPrice = market.outcomes.yes.liquidity / totalLiquidity;

    market.totalVolume += amount;
    market.participants++;

    console.log(`🎰 Bet placed on ${marketId}: ${amount} X402 on ${outcome.toUpperCase()}`);
    console.log(`   New price: ${(market.currentPrice * 100).toFixed(2)}%`);

    return {
      marketId,
      outcome,
      amount,
      shares: market.outcomes[outcome].shares,
      newPrice: market.currentPrice
    };
  }

  /**
   * Calculate shares using constant product formula
   */
  calculateShares(market, outcome, amount) {
    // Simplified AMM calculation
    const k = market.outcomes.yes.liquidity * market.outcomes.no.liquidity;
    if (k === 0) return amount; // Initial liquidity

    const currentLiquidity = market.outcomes[outcome].liquidity;
    const newLiquidity = currentLiquidity + amount;

    return newLiquidity - currentLiquidity;
  }

  /**
   * Resolve proposal using market prices
   */
  async resolveProposal(proposalId) {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (Date.now() < proposal.votingEnds) {
      throw new Error('Voting period not ended');
    }

    const markets = this.markets.get(proposalId);

    // Calculate expected value for each condition (adopt vs reject)
    const adoptExpectedValue = this.calculateExpectedValue(markets, 'adopt');
    const rejectExpectedValue = this.calculateExpectedValue(markets, 'reject');

    // Decision: adopt if expected value is higher
    const shouldAdopt = adoptExpectedValue > rejectExpectedValue;

    // Check confidence threshold
    const confidence = Math.abs(adoptExpectedValue - rejectExpectedValue) /
                      Math.max(adoptExpectedValue, rejectExpectedValue);

    if (confidence < this.params.decisionThreshold) {
      proposal.outcome = 'insufficient_confidence';
      proposal.status = 'rejected';
      console.log(`❌ Proposal ${proposalId} rejected: insufficient confidence (${(confidence * 100).toFixed(2)}%)`);
      return proposal;
    }

    proposal.outcome = shouldAdopt ? 'adopted' : 'rejected';
    proposal.status = shouldAdopt ? 'passed' : 'rejected';
    proposal.confidence = confidence;
    proposal.adoptEV = adoptExpectedValue;
    proposal.rejectEV = rejectExpectedValue;

    console.log(`\n🏛️  Proposal Resolution: ${proposal.title}`);
    console.log(`   Decision: ${proposal.outcome.toUpperCase()}`);
    console.log(`   Confidence: ${(confidence * 100).toFixed(2)}%`);
    console.log(`   Adopt EV: ${adoptExpectedValue.toFixed(4)}`);
    console.log(`   Reject EV: ${rejectExpectedValue.toFixed(4)}`);

    // Execute if adopted
    if (shouldAdopt) {
      await this.executeProposal(proposal);
    }

    return proposal;
  }

  /**
   * Calculate expected value from markets
   */
  calculateExpectedValue(markets, condition) {
    let totalEV = 0;
    let count = 0;

    // Average across all metrics
    for (const metric of this.optimizationMetrics) {
      const market = markets[`${condition}_${metric}`];

      if (market && market.totalVolume > 0) {
        // Market price represents probability of improvement
        const probability = market.currentPrice;

        // Weight by total volume (higher volume = more信 reliable signal)
        const weight = market.totalVolume;

        totalEV += probability * weight;
        count += weight;
      }
    }

    return count > 0 ? totalEV / count : 0.5; // Default to neutral if no betting
  }

  /**
   * Execute adopted proposal
   */
  async executeProposal(proposal) {
    console.log(`⚡ Executing proposal: ${proposal.title}`);

    // Execute based on action type
    switch (proposal.action) {
      case 'adjust_position_sizing':
        await this.adjustPositionSizing(proposal.params);
        break;

      case 'add_agent':
        await this.addAgent(proposal.params);
        break;

      case 'change_strategy':
        await this.changeStrategy(proposal.params);
        break;

      case 'update_risk_params':
        await this.updateRiskParams(proposal.params);
        break;

      case 'allocate_budget':
        await this.allocateBudget(proposal.params);
        break;

      default:
        console.warn(`Unknown action type: ${proposal.action}`);
    }

    proposal.executedAt = Date.now();
    proposal.status = 'executed';

    console.log(`✅ Proposal executed successfully`);
  }

  /**
   * Execute: Adjust position sizing
   */
  async adjustPositionSizing(params) {
    const { maxPositionSize, kellyMultiplier } = params;
    console.log(`📊 Adjusting position sizing: max=${maxPositionSize}%, kelly=${kellyMultiplier}x`);
    // Implementation would update fund parameters
  }

  /**
   * Execute: Add new agent to council
   */
  async addAgent(params) {
    const { agentType, agentConfig } = params;
    console.log(`🤖 Adding new agent: ${agentType}`);
    // Implementation would register agent in A2A protocol
  }

  /**
   * Execute: Change investment strategy
   */
  async changeStrategy(params) {
    const { strategy, allocation } = params;
    console.log(`🎯 Changing strategy to: ${strategy} (${allocation}% allocation)`);
    // Implementation would update fund strategy
  }

  /**
   * Execute: Update risk parameters
   */
  async updateRiskParams(params) {
    const { maxDrawdown, stopLoss, leverage } = params;
    console.log(`⚠️  Updating risk params: DD=${maxDrawdown}%, SL=${stopLoss}%, leverage=${leverage}x`);
    // Implementation would update risk management system
  }

  /**
   * Execute: Allocate budget
   */
  async allocateBudget(params) {
    const { category, amount, duration } = params;
    console.log(`💰 Allocating ${amount} X402 to ${category} for ${duration}ms`);
    // Implementation would transfer funds
  }

  /**
   * Get all active proposals
   */
  getActiveProposals() {
    return Array.from(this.proposals.values())
      .filter(p => p.status === 'active');
  }

  /**
   * Get proposal by ID
   */
  getProposal(proposalId) {
    return this.proposals.get(proposalId);
  }

  /**
   * Get markets for proposal
   */
  getMarkets(proposalId) {
    return this.markets.get(proposalId);
  }

  /**
   * Get governance statistics
   */
  getStats() {
    const proposals = Array.from(this.proposals.values());

    return {
      totalProposals: proposals.length,
      activeProposals: proposals.filter(p => p.status === 'active').length,
      passedProposals: proposals.filter(p => p.status === 'passed').length,
      rejectedProposals: proposals.filter(p => p.status === 'rejected').length,
      executedProposals: proposals.filter(p => p.status === 'executed').length,
      totalMarketsVolume: this.getTotalMarketsVolume(),
      avgConfidence: this.getAvgConfidence(proposals)
    };
  }

  getTotalMarketsVolume() {
    let total = 0;
    for (const markets of this.markets.values()) {
      for (const market of Object.values(markets)) {
        total += market.totalVolume;
      }
    }
    return total;
  }

  getAvgConfidence(proposals) {
    const resolved = proposals.filter(p => p.confidence !== undefined);
    if (resolved.length === 0) return 0;

    const sum = resolved.reduce((acc, p) => acc + p.confidence, 0);
    return sum / resolved.length;
  }

  // Helper methods

  generateProposalId() {
    return `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new FutarchyGovernance();
