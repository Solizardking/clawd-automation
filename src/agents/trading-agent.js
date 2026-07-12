const BaseAgent = require('./base-agent');
const jupiterService = require('../services/jupiter');
const birdeyeService = require('../services/birdeye');
const x402Service = require('../services/x402-token');

class TradingAgent extends BaseAgent {
  constructor() {
    super('TradingAgent', 'trading', [
      'market_analysis',
      'price_prediction',
      'trade_execution',
      'risk_assessment',
      'portfolio_management'
    ]);
  }

  /**
   * Execute trading actions
   */
  async executeAction(action, params) {
    const actions = {
      analyze_market: () => this.analyzeMarket(params.tokenAddress),
      get_quote: () => this.getQuote(params),
      simulate_trade: () => this.simulateTrade(params),
      assess_risk: () => this.assessRisk(params.tokenAddress),
      compare_tokens: () => this.compareTokens(params.tokens),
      get_x402_status: () => this.getX402Status()
    };

    const actionFn = actions[action];
    if (!actionFn) {
      throw new Error(`Unknown action: ${action}`);
    }

    return await actionFn();
  }

  /**
   * Analyze market conditions
   */
  async analyzeMarket(tokenAddress) {
    const analysis = await birdeyeService.analyzeTokenPerformance(tokenAddress);
    const aiAnalysis = await this.think(`
      Analyze this market data and provide trading recommendations:
      ${JSON.stringify(analysis, null, 2)}
    `);

    return {
      ...analysis,
      aiRecommendation: aiAnalysis
    };
  }

  /**
   * Get trading quote
   */
  async getQuote(params) {
    const { inputToken, outputToken, amount } = params;
    const quote = await jupiterService.getQuote(inputToken, outputToken, amount);

    return {
      quote,
      analysis: {
        priceImpact: quote.priceImpactPct,
        estimatedOutput: quote.outAmount,
        route: quote.routePlan
      }
    };
  }

  /**
   * Simulate trade
   */
  async simulateTrade(params) {
    const { inputToken, outputToken, amount, userWallet } = params;
    const simulation = await jupiterService.simulateTrade(
      inputToken,
      outputToken,
      amount,
      userWallet
    );

    const aiAdvice = await this.think(`
      Review this trade simulation and provide advice:
      Input: ${inputToken}
      Output: ${outputToken}
      Amount: ${amount}
      Price Impact: ${simulation.quote.priceImpactPct}%
      Estimated Output: ${simulation.estimated.output}
    `);

    return {
      ...simulation,
      aiAdvice
    };
  }

  /**
   * Assess trading risk
   */
  async assessRisk(tokenAddress) {
    const performance = await birdeyeService.analyzeTokenPerformance(tokenAddress);

    const riskFactors = {
      liquidityRisk: performance.liquidityScore < 50,
      volatilityRisk: Math.abs(performance.priceChange24h || 0) > 20,
      marketCapRisk: performance.marketCap < 100000,
      overallRisk: performance.riskLevel
    };

    const aiRiskAssessment = await this.think(`
      Assess the trading risks for this token:
      ${JSON.stringify(riskFactors, null, 2)}
      ${JSON.stringify(performance, null, 2)}
    `);

    return {
      riskFactors,
      performance,
      aiRiskAssessment,
      recommendation: this.generateRiskRecommendation(riskFactors)
    };
  }

  /**
   * Generate risk recommendation
   */
  generateRiskRecommendation(riskFactors) {
    const riskCount = Object.values(riskFactors).filter(Boolean).length;

    if (riskCount >= 3) {
      return {
        action: 'AVOID',
        reason: 'Multiple high-risk factors identified',
        maxPositionSize: '0%'
      };
    } else if (riskCount === 2) {
      return {
        action: 'CAUTION',
        reason: 'Moderate risk factors present',
        maxPositionSize: '2-5%'
      };
    } else if (riskCount === 1) {
      return {
        action: 'CONSIDER',
        reason: 'Minimal risk factors',
        maxPositionSize: '5-10%'
      };
    } else {
      return {
        action: 'FAVORABLE',
        reason: 'Low risk profile',
        maxPositionSize: 'Up to 15%'
      };
    }
  }

  /**
   * Compare multiple tokens
   */
  async compareTokens(tokens) {
    const comparison = await birdeyeService.compareTokens(tokens);

    const aiComparison = await this.think(`
      Compare these tokens and recommend the best trading opportunity:
      ${JSON.stringify(comparison, null, 2)}
    `);

    return {
      ...comparison,
      aiComparison
    };
  }

  /**
   * Get X402 token status
   */
  async getX402Status() {
    const [performance, marketStats] = await Promise.all([
      x402Service.analyzePerformance(),
      x402Service.getMarketStats()
    ]);

    const aiStatus = await this.think(`
      Analyze the X402 token status and provide trading insights:
      Performance: ${JSON.stringify(performance, null, 2)}
      Market Stats: ${JSON.stringify(marketStats, null, 2)}
    `);

    return {
      performance,
      marketStats,
      aiStatus
    };
  }

  /**
   * Optimize trade execution
   */
  async optimizeTrade(params) {
    const { inputToken, outputToken, amount } = params;

    // Get multiple routes
    const route = await jupiterService.getRoute(inputToken, outputToken, amount);

    // Analyze with AI
    const optimization = await this.think(`
      Optimize this trade execution:
      Route: ${JSON.stringify(route, null, 2)}
      Consider: slippage, price impact, gas fees, timing
    `);

    return {
      route,
      optimization,
      recommendations: {
        bestRoute: route,
        timing: 'Execute during high liquidity hours',
        slippageSettings: route.priceImpactPct < 1 ? 0.5 : 1.0
      }
    };
  }
}

module.exports = TradingAgent;
