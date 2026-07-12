const solanaService = require('./solana/connection');
const jupiterService = require('./jupiter');
const birdeyeService = require('./birdeye');
const config = require('../config/index.js');

class X402TokenService {
  constructor() {
    this.tokenMint = config.x402.tokenMint;
    this.agentWallet = config.x402.agentWallet;
  }

  /**
   * Get comprehensive X402 token data
   */
  async getTokenData() {
    try {
      const [birdeyeData, jupiterPrice, agentBalance] = await Promise.allSettled([
        birdeyeService.getX402Analytics(),
        jupiterService.getX402Price(),
        solanaService.getX402Balance(this.agentWallet)
      ]);

      return {
        mint: this.tokenMint,
        analytics: birdeyeData.status === 'fulfilled' ? birdeyeData.value : null,
        price: jupiterPrice.status === 'fulfilled' ? jupiterPrice.value : null,
        agentBalance: agentBalance.status === 'fulfilled' ? agentBalance.value : 0,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('X402 token data error:', error);
      throw error;
    }
  }

  /**
   * Get X402 balance for a wallet
   */
  async getBalance(walletAddress) {
    return solanaService.getX402Balance(walletAddress);
  }

  /**
   * Get X402 market stats
   */
  async getMarketStats() {
    try {
      const [marketData, jupiterStats] = await Promise.all([
        birdeyeService.getX402MarketData(),
        jupiterService.getX402MarketStats()
      ]);

      return {
        price: marketData.price || jupiterStats.price,
        priceInSol: jupiterStats.priceInSol,
        marketCap: marketData.market_cap || jupiterStats.marketCap,
        liquidity: marketData.liquidity,
        volume24h: jupiterStats.volume24h,
        fdv: marketData.fdv,
        circulatingSupply: marketData.circulating_supply,
        totalSupply: marketData.total_supply
      };
    } catch (error) {
      console.error('X402 market stats error:', error);
      throw error;
    }
  }

  /**
   * Analyze X402 token performance
   */
  async analyzePerformance() {
    try {
      const performance = await birdeyeService.analyzeTokenPerformance(this.tokenMint);
      const marketStats = await this.getMarketStats();

      return {
        ...performance,
        marketStats,
        healthScore: this.calculateHealthScore(performance, marketStats),
        insights: this.generateInsights(performance, marketStats)
      };
    } catch (error) {
      console.error('X402 performance analysis error:', error);
      throw error;
    }
  }

  /**
   * Calculate health score (0-100)
   */
  calculateHealthScore(performance, marketStats) {
    const liquidityScore = performance.liquidityScore || 0;
    const volumeScore = this.calculateVolumeScore(marketStats.volume24h, marketStats.marketCap);
    const priceStabilityScore = 100 - Math.min(Math.abs(marketStats.priceChange24h || 0), 100);

    return Math.round((liquidityScore * 0.4 + volumeScore * 0.3 + priceStabilityScore * 0.3));
  }

  /**
   * Calculate volume score
   */
  calculateVolumeScore(volume24h, marketCap) {
    if (!volume24h || !marketCap) return 0;

    const volumeRatio = volume24h / marketCap;

    if (volumeRatio >= 0.3) return 100; // Excellent volume
    if (volumeRatio >= 0.2) return 80;
    if (volumeRatio >= 0.1) return 60;
    if (volumeRatio >= 0.05) return 40;
    return 20;
  }

  /**
   * Generate insights
   */
  generateInsights(performance, marketStats) {
    const insights = [];

    // Liquidity insights
    if (performance.liquidityScore >= 80) {
      insights.push({
        type: 'POSITIVE',
        category: 'LIQUIDITY',
        message: 'Strong liquidity supports stable trading'
      });
    } else if (performance.liquidityScore < 40) {
      insights.push({
        type: 'WARNING',
        category: 'LIQUIDITY',
        message: 'Low liquidity may cause high slippage'
      });
    }

    // Volume insights
    const volumeRatio = marketStats.volume24h / marketStats.marketCap;
    if (volumeRatio >= 0.2) {
      insights.push({
        type: 'POSITIVE',
        category: 'VOLUME',
        message: 'High trading volume indicates strong market interest'
      });
    }

    // Market cap insights
    if (marketStats.marketCap > 1000000) {
      insights.push({
        type: 'POSITIVE',
        category: 'MARKET_CAP',
        message: 'Established market cap reduces volatility risk'
      });
    } else if (marketStats.marketCap < 100000) {
      insights.push({
        type: 'WARNING',
        category: 'MARKET_CAP',
        message: 'Low market cap indicates early stage with higher risk'
      });
    }

    return insights;
  }

  /**
   * Get X402 holders count (if available)
   */
  async getHoldersCount() {
    try {
      const tokenInfo = await birdeyeService.getX402TokenInfo();
      return tokenInfo.holders || 0;
    } catch (error) {
      console.error('Error getting holders count:', error);
      return 0;
    }
  }

  /**
   * Check if wallet has minimum X402 balance
   */
  async hasMinimumBalance(walletAddress, minimumAmount = 1000) {
    try {
      const balance = await this.getBalance(walletAddress);
      return balance >= minimumAmount;
    } catch (error) {
      console.error('Error checking minimum balance:', error);
      return false;
    }
  }

  /**
   * Get X402 transaction history for wallet
   */
  async getTransactionHistory(walletAddress, limit = 20) {
    try {
      const transactions = await solanaService.getRecentTransactions(walletAddress, limit);

      // Filter for X402 token transactions
      const x402Transactions = transactions.filter(tx => {
        const instructions = tx.transaction?.transaction?.message?.instructions || [];
        return instructions.some(instruction => {
          const accounts = instruction.accounts || [];
          return accounts.some(account =>
            account.toString() === this.tokenMint
          );
        });
      });

      return x402Transactions.map(tx => ({
        signature: tx.signature,
        timestamp: tx.timestamp,
        status: tx.status,
        slot: tx.slot
      }));
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  }

  /**
   * Estimate swap amount for X402
   */
  async estimateSwap(inputToken, amount, direction = 'to_x402') {
    try {
      let quote;

      if (direction === 'to_x402') {
        quote = await jupiterService.getQuote(inputToken, this.tokenMint, amount);
      } else {
        quote = await jupiterService.getQuote(this.tokenMint, inputToken, amount);
      }

      return {
        input: quote.inAmount,
        output: quote.outAmount,
        priceImpact: quote.priceImpactPct,
        route: quote.routePlan
      };
    } catch (error) {
      console.error('Error estimating swap:', error);
      throw error;
    }
  }
}

module.exports = new X402TokenService();
