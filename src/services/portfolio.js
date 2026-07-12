const solanaService = require('./solana/connection');
const birdeyeService = require('./birdeye');
const jupiterService = require('./jupiter');
const x402Service = require('./x402-token');

class PortfolioService {
  constructor() {
    this.portfolioCache = new Map();
  }

  /**
   * Get comprehensive portfolio data for a wallet
   */
  async getPortfolio(walletAddress) {
    try {
      const [
        solBalance,
        tokenAccounts,
        x402Balance,
        x402Stats,
        recentTx
      ] = await Promise.allSettled([
        solanaService.getBalance(walletAddress),
        solanaService.getTokenAccounts(walletAddress),
        x402Service.getBalance(walletAddress),
        x402Service.getMarketStats(),
        solanaService.getRecentTransactions(walletAddress, 20)
      ]);

      // Get token prices for all holdings
      const tokenPrices = await this.getTokenPrices(
        tokenAccounts.status === 'fulfilled' ? tokenAccounts.value : []
      );

      const portfolio = {
        wallet: walletAddress,
        balances: {
          sol: solBalance.status === 'fulfilled' ? solBalance.value : 0,
          x402: x402Balance.status === 'fulfilled' ? x402Balance.value : 0,
          tokens: tokenAccounts.status === 'fulfilled' ? tokenAccounts.value : []
        },
        prices: tokenPrices,
        x402Stats: x402Stats.status === 'fulfilled' ? x402Stats.value : null,
        recentTransactions: recentTx.status === 'fulfilled' ? recentTx.value : [],
        totalValue: await this.calculateTotalValue(
          solBalance.status === 'fulfilled' ? solBalance.value : 0,
          x402Balance.status === 'fulfilled' ? x402Balance.value : 0,
          tokenAccounts.status === 'fulfilled' ? tokenAccounts.value : [],
          tokenPrices
        ),
        timestamp: Date.now()
      };

      this.portfolioCache.set(walletAddress, portfolio);
      return portfolio;
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      throw error;
    }
  }

  /**
   * Get prices for token holdings
   */
  async getTokenPrices(tokenAccounts) {
    const prices = {};

    for (const account of tokenAccounts) {
      try {
        const price = await jupiterService.getTokenPrice(account.mint);
        prices[account.mint] = price;
      } catch (error) {
        console.log(`Could not fetch price for ${account.mint}`);
        prices[account.mint] = null;
      }
    }

    return prices;
  }

  /**
   * Calculate total portfolio value in USD
   */
  async calculateTotalValue(solBalance, x402Balance, tokenAccounts, tokenPrices) {
    try {
      // SOL value
      const solPrice = await jupiterService.getTokenPrice(
        'So11111111111111111111111111111111111111112'
      );
      const solValue = solBalance * (solPrice?.price || 0);

      // X402 value
      const x402Price = await jupiterService.getX402Price();
      const x402Value = x402Balance * (x402Price?.price || 0);

      // Other tokens value
      const tokensValue = tokenAccounts.reduce((total, account) => {
        const price = tokenPrices[account.mint]?.price || 0;
        return total + (account.amount * price);
      }, 0);

      return {
        sol: solValue,
        x402: x402Value,
        tokens: tokensValue,
        total: solValue + x402Value + tokensValue
      };
    } catch (error) {
      console.error('Error calculating total value:', error);
      return { sol: 0, x402: 0, tokens: 0, total: 0 };
    }
  }

  /**
   * Get portfolio analytics
   */
  async getAnalytics(walletAddress) {
    const portfolio = await this.getPortfolio(walletAddress);

    // Calculate allocations
    const allocations = this.calculateAllocations(portfolio);

    // Calculate performance
    const performance = await this.calculatePerformance(walletAddress);

    // Risk assessment
    const riskAssessment = await this.assessRisk(portfolio);

    return {
      wallet: walletAddress,
      allocations,
      performance,
      riskAssessment,
      diversification: this.calculateDiversification(allocations),
      timestamp: Date.now()
    };
  }

  /**
   * Calculate portfolio allocations
   */
  calculateAllocations(portfolio) {
    const total = portfolio.totalValue.total;

    if (total === 0) {
      return {
        sol: 0,
        x402: 0,
        otherTokens: 0,
        breakdown: []
      };
    }

    const allocations = {
      sol: (portfolio.totalValue.sol / total) * 100,
      x402: (portfolio.totalValue.x402 / total) * 100,
      otherTokens: (portfolio.totalValue.tokens / total) * 100,
      breakdown: portfolio.balances.tokens.map(token => {
        const price = portfolio.prices[token.mint]?.price || 0;
        const value = token.amount * price;
        return {
          mint: token.mint,
          amount: token.amount,
          value,
          allocation: (value / total) * 100
        };
      })
    };

    return allocations;
  }

  /**
   * Calculate portfolio performance
   */
  async calculatePerformance(walletAddress) {
    // This would require historical data in production
    // For now, return estimated performance based on recent transactions

    const recentTx = await solanaService.getRecentTransactions(walletAddress, 50);

    return {
      totalTransactions: recentTx.length,
      period: '24h', // Could be configurable
      estimatedGain: 0, // Would calculate from historical data
      estimatedGainPercent: 0,
      mostActiveToken: this.getMostActiveToken(recentTx)
    };
  }

  /**
   * Assess portfolio risk
   */
  async assessRisk(portfolio) {
    const allocations = this.calculateAllocations(portfolio);

    // Concentration risk
    const maxAllocation = Math.max(
      allocations.sol,
      allocations.x402,
      ...allocations.breakdown.map(b => b.allocation)
    );

    // Liquidity risk
    const liquidityScores = await Promise.all(
      portfolio.balances.tokens.map(async (token) => {
        try {
          const analysis = await birdeyeService.analyzeTokenPerformance(token.mint);
          return analysis.liquidityScore;
        } catch {
          return 50; // Default medium score
        }
      })
    );

    const avgLiquidity = liquidityScores.length > 0
      ? liquidityScores.reduce((a, b) => a + b) / liquidityScores.length
      : 50;

    // Overall risk level
    let riskLevel = 'MEDIUM';
    if (maxAllocation > 70 || avgLiquidity < 40) {
      riskLevel = 'HIGH';
    } else if (maxAllocation < 30 && avgLiquidity > 70) {
      riskLevel = 'LOW';
    }

    return {
      riskLevel,
      concentrationRisk: maxAllocation > 50,
      maxAllocation,
      liquidityScore: avgLiquidity,
      recommendations: this.generateRiskRecommendations(maxAllocation, avgLiquidity)
    };
  }

  /**
   * Generate risk recommendations
   */
  generateRiskRecommendations(maxAllocation, avgLiquidity) {
    const recommendations = [];

    if (maxAllocation > 70) {
      recommendations.push({
        type: 'DIVERSIFICATION',
        priority: 'HIGH',
        message: 'Consider diversifying - high concentration in single asset'
      });
    }

    if (avgLiquidity < 50) {
      recommendations.push({
        type: 'LIQUIDITY',
        priority: 'MEDIUM',
        message: 'Some holdings have low liquidity - may face slippage when selling'
      });
    }

    if (maxAllocation < 30 && avgLiquidity > 70) {
      recommendations.push({
        type: 'POSITIVE',
        priority: 'INFO',
        message: 'Well-diversified portfolio with good liquidity'
      });
    }

    return recommendations;
  }

  /**
   * Calculate diversification score (0-100)
   */
  calculateDiversification(allocations) {
    const assets = [
      allocations.sol,
      allocations.x402,
      ...allocations.breakdown.map(b => b.allocation)
    ].filter(a => a > 0);

    if (assets.length <= 1) return 0;

    // Calculate Herfindahl-Hirschman Index (HHI)
    const hhi = assets.reduce((sum, allocation) => {
      return sum + Math.pow(allocation, 2);
    }, 0);

    // Convert HHI to 0-100 score (lower HHI = better diversification)
    const score = Math.max(0, 100 - (hhi / 100));

    return {
      score: Math.round(score),
      assetCount: assets.length,
      rating: score > 70 ? 'EXCELLENT' : score > 50 ? 'GOOD' : score > 30 ? 'FAIR' : 'POOR'
    };
  }

  /**
   * Get most active token from transactions
   */
  getMostActiveToken(transactions) {
    const tokenActivity = {};

    transactions.forEach(tx => {
      const instructions = tx.transaction?.transaction?.message?.instructions || [];
      instructions.forEach(instruction => {
        const accounts = instruction.accounts || [];
        accounts.forEach(account => {
          const addr = account.toString();
          tokenActivity[addr] = (tokenActivity[addr] || 0) + 1;
        });
      });
    });

    const sorted = Object.entries(tokenActivity)
      .sort(([, a], [, b]) => b - a);

    return sorted.length > 0 ? sorted[0][0] : null;
  }

  /**
   * Compare portfolio with benchmarks
   */
  async compareWithBenchmarks(walletAddress) {
    const portfolio = await this.getPortfolio(walletAddress);
    const analytics = await this.getAnalytics(walletAddress);

    // Benchmark: Typical X402 holder portfolio
    const benchmark = {
      x402Allocation: 40,
      solAllocation: 30,
      otherTokensAllocation: 30,
      averageTokenCount: 5
    };

    const comparison = {
      portfolio: {
        x402Allocation: analytics.allocations.x402,
        solAllocation: analytics.allocations.sol,
        otherTokensAllocation: analytics.allocations.otherTokens,
        tokenCount: portfolio.balances.tokens.length
      },
      benchmark,
      deviations: {
        x402: analytics.allocations.x402 - benchmark.x402Allocation,
        sol: analytics.allocations.sol - benchmark.solAllocation,
        tokens: portfolio.balances.tokens.length - benchmark.averageTokenCount
      }
    };

    return comparison;
  }

  /**
   * Generate portfolio rebalancing suggestions
   */
  async suggestRebalancing(walletAddress, targetAllocations = null) {
    const analytics = await this.getAnalytics(walletAddress);

    const defaultTarget = {
      x402: 40,
      sol: 30,
      otherTokens: 30
    };

    const target = targetAllocations || defaultTarget;
    const current = analytics.allocations;

    const suggestions = [];

    // X402 rebalancing
    const x402Diff = target.x402 - current.x402;
    if (Math.abs(x402Diff) > 5) {
      suggestions.push({
        action: x402Diff > 0 ? 'BUY' : 'SELL',
        asset: 'X402',
        targetAllocation: target.x402,
        currentAllocation: current.x402,
        difference: Math.abs(x402Diff)
      });
    }

    // SOL rebalancing
    const solDiff = target.sol - current.sol;
    if (Math.abs(solDiff) > 5) {
      suggestions.push({
        action: solDiff > 0 ? 'BUY' : 'SELL',
        asset: 'SOL',
        targetAllocation: target.sol,
        currentAllocation: current.sol,
        difference: Math.abs(solDiff)
      });
    }

    return {
      currentAllocations: current,
      targetAllocations: target,
      suggestions,
      rebalancingNeeded: suggestions.length > 0
    };
  }
}

module.exports = new PortfolioService();
