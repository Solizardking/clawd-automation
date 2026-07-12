/**
 * Investment Council - Multi-Agent Decision Making
 * Google Vertex AI + X402 Protocol
 */

const { VertexAI } = require('@google-cloud/vertexai');
const vertexConfig = require('./vertex-ai-config');
const x402Payment = require('../../services/x402-spl-token');
const { Connection, PublicKey } = require('@solana/web3.js');
const config = require('../../config/index.js');

class InvestmentCouncil {
  constructor() {
    this.vertexAI = new VertexAI({
      project: vertexConfig.projectId,
      location: vertexConfig.location
    });

    this.agents = vertexConfig.agents.council;
    this.connection = new Connection(config.solana.rpcUrl);

    // Agent wallet addresses (each agent has own wallet for X402 payments)
    this.agentWallets = {
      buffett: new PublicKey(process.env.BUFFETT_WALLET || 'BuFFett11111111111111111111111111111111111'),
      lynch: new PublicKey(process.env.LYNCH_WALLET || 'Lynch111111111111111111111111111111111111'),
      druckenmiller: new PublicKey(process.env.DRUCK_WALLET || 'Druck111111111111111111111111111111111111'),
      munger: new PublicKey(process.env.MUNGER_WALLET || 'Munger11111111111111111111111111111111111')
    };

    this.consensusHistory = [];
  }

  /**
   * Analyze investment opportunity with full council
   */
  async analyzeInvestment(opportunity) {
    const {
      tokenAddress,
      tokenSymbol,
      tokenName,
      currentPrice,
      marketCap,
      volume24h,
      holderCount,
      description,
      category
    } = opportunity;

    console.log(`\n🏛️  Investment Council analyzing: ${tokenSymbol}`);
    console.log(`📊 Market Cap: $${marketCap.toLocaleString()}`);
    console.log(`💰 24h Volume: $${volume24h.toLocaleString()}`);

    // Get market regime to adjust weights
    const marketData = await this.getMarketData();
    const regime = vertexConfig.getMarketRegime(marketData);
    console.log(`📈 Market Regime: ${regime.regime.toUpperCase()}`);

    // Run all agents in parallel
    const analysisPromises = Object.entries(this.agents).map(async ([agentId, agent]) => {
      return await this.runAgent(agentId, agent, opportunity, regime);
    });

    const analyses = await Promise.all(analysisPromises);

    // Calculate weighted consensus
    const consensus = this.calculateConsensus(analyses, regime.weights);

    // Store in history
    this.consensusHistory.push({
      timestamp: Date.now(),
      tokenSymbol,
      tokenAddress,
      analyses,
      consensus,
      regime: regime.regime
    });

    return {
      tokenSymbol,
      tokenAddress,
      consensus,
      analyses,
      marketRegime: regime.regime,
      recommendation: this.getRecommendation(consensus.score),
      positionSize: this.calculatePositionSize(consensus.score, consensus.risk)
    };
  }

  /**
   * Run individual agent analysis
   */
  async runAgent(agentId, agentConfig, opportunity, regime) {
    try {
      // Check if agent has sufficient X402 balance
      const wallet = this.agentWallets[agentId];
      const balance = await x402Payment.getBalance(wallet.toString());

      if (balance < 0.01) {
        console.warn(`⚠️  ${agentId} has insufficient X402 balance (${balance})`);
        return {
          agentId,
          error: 'Insufficient X402 balance',
          score: 50, // Neutral
          confidence: 0
        };
      }

      // Charge X402 for analysis
      const cost = 0.01; // 0.01 X402 per complex analysis
      console.log(`💳 Charging ${agentId}: ${cost} X402`);

      const model = this.vertexAI.getGenerativeModel({
        model: agentConfig.model,
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048
        }
      });

      const prompt = this.buildAnalysisPrompt(agentConfig, opportunity, regime);

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      // Parse agent response
      const analysis = this.parseAgentResponse(agentId, response);

      console.log(`✅ ${agentConfig.name}: Score ${analysis.score}/100`);

      return {
        agentId,
        agentName: agentConfig.name,
        ...analysis,
        x402Cost: cost,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error(`❌ Error running ${agentId}:`, error.message);
      return {
        agentId,
        error: error.message,
        score: 50,
        confidence: 0
      };
    }
  }

  /**
   * Build analysis prompt for specific agent
   */
  buildAnalysisPrompt(agentConfig, opportunity, regime) {
    return `${agentConfig.systemPrompt}

CURRENT MARKET REGIME: ${regime.regime.toUpperCase()}

Investment Opportunity Analysis Request:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Token: ${opportunity.tokenName} (${opportunity.tokenSymbol})
Contract: ${opportunity.tokenAddress}
Category: ${opportunity.category}

Financial Metrics:
• Price: $${opportunity.currentPrice}
• Market Cap: $${opportunity.marketCap?.toLocaleString() || 'N/A'}
• 24h Volume: $${opportunity.volume24h?.toLocaleString() || 'N/A'}
• Holders: ${opportunity.holderCount?.toLocaleString() || 'N/A'}

Description:
${opportunity.description}

On-Chain Data:
• Top 10 Holders: ${opportunity.top10Percentage || 'N/A'}%
• Liquidity: $${opportunity.liquidity?.toLocaleString() || 'N/A'}
• LP Burned: ${opportunity.lpBurned ? 'YES ✅' : 'NO ❌'}
• Mint Revoked: ${opportunity.mintRevoked ? 'YES ✅' : 'NO ❌'}

Social Metrics:
• Twitter Followers: ${opportunity.twitterFollowers?.toLocaleString() || 'N/A'}
• Discord Members: ${opportunity.discordMembers?.toLocaleString() || 'N/A'}
• Sentiment Score: ${opportunity.sentimentScore || 'N/A'}/100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Provide your analysis using your unique investment philosophy.

REQUIRED OUTPUT FORMAT (JSON):
{
  "score": 0-100,
  "confidence": 0-100,
  "reasoning": "Detailed analysis based on your principles",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "keyMetrics": {
    "valuationScore": 0-100,
    "qualityScore": 0-100,
    "growthPotential": 0-100
  },
  "recommendation": "STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL",
  "targetPrice": "$X.XX or null",
  "timeHorizon": "days|weeks|months|years",
  "positionSizing": "% of portfolio recommendation"
}`;
  }

  /**
   * Parse agent response into structured data
   */
  parseAgentResponse(agentId, responseText) {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: parsed.score || 50,
          confidence: parsed.confidence || 50,
          reasoning: parsed.reasoning || '',
          strengths: parsed.strengths || [],
          weaknesses: parsed.weaknesses || [],
          keyMetrics: parsed.keyMetrics || {},
          recommendation: parsed.recommendation || 'HOLD',
          targetPrice: parsed.targetPrice,
          timeHorizon: parsed.timeHorizon,
          positionSizing: parsed.positionSizing
        };
      }
    } catch (error) {
      console.error(`Failed to parse ${agentId} response:`, error.message);
    }

    // Fallback: extract score from text
    const scoreMatch = responseText.match(/score[:\s]+(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;

    return {
      score,
      confidence: 50,
      reasoning: responseText.substring(0, 500),
      strengths: [],
      weaknesses: [],
      recommendation: 'HOLD'
    };
  }

  /**
   * Calculate weighted consensus from all agents
   */
  calculateConsensus(analyses, weights) {
    let totalScore = 0;
    let totalConfidence = 0;
    let totalWeight = 0;

    const votingResults = {};

    analyses.forEach(analysis => {
      const weight = weights[analysis.agentId] || 0.25;
      totalWeight += weight;

      totalScore += analysis.score * weight;
      totalConfidence += (analysis.confidence || 50) * weight;

      votingResults[analysis.agentId] = {
        score: analysis.score,
        confidence: analysis.confidence,
        weight,
        recommendation: analysis.recommendation
      };
    });

    const consensusScore = Math.round(totalScore / totalWeight);
    const consensusConfidence = Math.round(totalConfidence / totalWeight);

    // Calculate agreement level
    const scores = analyses.map(a => a.score);
    const variance = this.calculateVariance(scores);
    const agreement = variance < 100 ? 'HIGH' : variance < 400 ? 'MODERATE' : 'LOW';

    // Aggregate strengths and weaknesses
    const allStrengths = analyses.flatMap(a => a.strengths || []);
    const allWeaknesses = analyses.flatMap(a => a.weaknesses || []);

    // Calculate risk score (inverse of Munger's score, or average weakness severity)
    const mungerAnalysis = analyses.find(a => a.agentId === 'munger');
    const riskScore = mungerAnalysis ? 100 - mungerAnalysis.score : 50;

    return {
      score: consensusScore,
      confidence: consensusConfidence,
      agreement,
      variance: Math.round(variance),
      risk: riskScore,
      votingResults,
      topStrengths: this.getTopItems(allStrengths, 5),
      topWeaknesses: this.getTopItems(allWeaknesses, 5)
    };
  }

  /**
   * Calculate statistical variance
   */
  calculateVariance(numbers) {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Get top N items by frequency
   */
  getTopItems(items, n) {
    const counts = {};
    items.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([item]) => item);
  }

  /**
   * Get recommendation based on consensus score
   */
  getRecommendation(score) {
    if (score >= 85) return 'STRONG_BUY';
    if (score >= 70) return 'BUY';
    if (score >= 50) return 'HOLD';
    if (score >= 30) return 'SELL';
    return 'STRONG_SELL';
  }

  /**
   * Calculate position size using Kelly Criterion
   */
  calculatePositionSize(score, risk) {
    // Kelly Criterion: f = (bp - q) / b
    // f = fraction of portfolio to bet
    // b = odds (payoff ratio)
    // p = probability of winning
    // q = probability of losing (1-p)

    const confidence = score / 100; // Convert score to probability
    const riskAdjustment = (100 - risk) / 100;

    // Assume 3:1 reward:risk for crypto
    const oddsRatio = 3;

    // Kelly fraction
    const p = confidence * riskAdjustment;
    const q = 1 - p;
    const kellyFraction = (oddsRatio * p - q) / oddsRatio;

    // Use half-Kelly for safety
    const halfKelly = kellyFraction / 2;

    // Cap at 10% of portfolio (risk management)
    const positionSize = Math.max(0, Math.min(halfKelly * 100, 10));

    return Math.round(positionSize * 10) / 10; // Round to 1 decimal
  }

  /**
   * Get market data for regime detection
   */
  async getMarketData() {
    // TODO: Integrate with Birdeye/Jupiter for real market data
    // For now, return mock data
    return {
      volatility: 0.6,
      trend: 0.5,
      liquidity: 0.7,
      sentiment: 0.6
    };
  }

  /**
   * Get consensus history
   */
  getHistory(limit = 10) {
    return this.consensusHistory.slice(-limit);
  }

  /**
   * Get agent performance metrics
   */
  getAgentPerformance() {
    const performance = {};

    Object.keys(this.agents).forEach(agentId => {
      const agentAnalyses = this.consensusHistory.flatMap(h =>
        h.analyses.filter(a => a.agentId === agentId)
      );

      if (agentAnalyses.length > 0) {
        const avgScore = agentAnalyses.reduce((sum, a) => sum + a.score, 0) / agentAnalyses.length;
        const avgConfidence = agentAnalyses.reduce((sum, a) => sum + (a.confidence || 50), 0) / agentAnalyses.length;

        performance[agentId] = {
          totalAnalyses: agentAnalyses.length,
          avgScore: Math.round(avgScore),
          avgConfidence: Math.round(avgConfidence),
          totalX402Spent: agentAnalyses.reduce((sum, a) => sum + (a.x402Cost || 0), 0)
        };
      }
    });

    return performance;
  }
}

module.exports = new InvestmentCouncil();
