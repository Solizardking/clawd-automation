const axios = require('axios');
const config = require('../../config/index.js');

class JupiterService {
  constructor() {
    this.apiUrl = config.jupiter.apiUrl;
    this.apiKey = config.jupiter.apiKey;
  }

  /**
   * Get quote for a swap
   */
  async getQuote(inputMint, outputMint, amount, slippageBps = 50) {
    try {
      const params = {
        inputMint,
        outputMint,
        amount,
        slippageBps
      };

      const response = await axios.get(`${this.apiUrl}/v6/quote`, { params });
      return response.data;
    } catch (error) {
      console.error('Jupiter quote error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get swap transaction
   */
  async getSwapTransaction(quoteResponse, userPublicKey, options = {}) {
    try {
      const response = await axios.post(`${this.apiUrl}/v6/swap`, {
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        ...options
      });

      return response.data;
    } catch (error) {
      console.error('Jupiter swap error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get token price
   */
  async getTokenPrice(tokenAddress) {
    try {
      const response = await axios.get(`${this.apiUrl}/price/v2`, {
        params: {
          ids: tokenAddress
        }
      });

      return response.data.data[tokenAddress];
    } catch (error) {
      console.error('Jupiter price error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get X402 token price
   */
  async getX402Price() {
    return this.getTokenPrice(config.x402.tokenMint);
  }

  /**
   * Get optimal route for swap
   */
  async getRoute(inputMint, outputMint, amount) {
    try {
      const quote = await this.getQuote(inputMint, outputMint, amount);

      return {
        inputMint,
        outputMint,
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        priceImpactPct: quote.priceImpactPct,
        marketInfos: quote.marketInfos,
        routePlan: quote.routePlan
      };
    } catch (error) {
      console.error('Jupiter route error:', error);
      throw error;
    }
  }

  /**
   * Get all tokens supported by Jupiter
   */
  async getSupportedTokens() {
    try {
      const response = await axios.get(`${this.apiUrl}/tokens/v2`);
      return response.data;
    } catch (error) {
      console.error('Jupiter tokens error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Execute trade (simulation - actual execution requires wallet signing)
   */
  async simulateTrade(inputToken, outputToken, amount, userWallet) {
    try {
      // Get quote
      const quote = await this.getQuote(inputToken, outputToken, amount);

      // Get swap transaction
      const swapTransaction = await this.getSwapTransaction(quote, userWallet);

      return {
        quote,
        transaction: swapTransaction,
        estimated: {
          input: quote.inAmount,
          output: quote.outAmount,
          priceImpact: quote.priceImpactPct
        }
      };
    } catch (error) {
      console.error('Trade simulation error:', error);
      throw error;
    }
  }

  /**
   * Get market stats for X402
   */
  async getX402MarketStats() {
    try {
      const price = await this.getX402Price();
      const solMint = 'So11111111111111111111111111111111111111112'; // SOL mint address

      // Get quote for 1 X402 to SOL
      const quote = await this.getQuote(
        config.x402.tokenMint,
        solMint,
        1000000 // 1 X402 (assuming 6 decimals)
      );

      return {
        price: price?.price || 0,
        priceInSol: quote.outAmount / 1e9, // Convert lamports to SOL
        volume24h: price?.volume24h || 0,
        marketCap: price?.marketCap || 0
      };
    } catch (error) {
      console.error('X402 market stats error:', error);
      return {
        price: 0,
        priceInSol: 0,
        volume24h: 0,
        marketCap: 0
      };
    }
  }

  /**
   * Analyze trade opportunity
   */
  async analyzeTrade(inputToken, outputToken, amount) {
    try {
      const route = await this.getRoute(inputToken, outputToken, amount);
      const inputPrice = await this.getTokenPrice(inputToken);
      const outputPrice = await this.getTokenPrice(outputToken);

      return {
        route,
        prices: {
          input: inputPrice,
          output: outputPrice
        },
        recommendation: this.generateTradeRecommendation(route, inputPrice, outputPrice)
      };
    } catch (error) {
      console.error('Trade analysis error:', error);
      throw error;
    }
  }

  /**
   * Generate trade recommendation based on analysis
   */
  generateTradeRecommendation(route, inputPrice, outputPrice) {
    const priceImpact = parseFloat(route.priceImpactPct);

    if (priceImpact > 5) {
      return {
        action: 'AVOID',
        reason: 'High price impact (>5%)',
        priceImpact
      };
    } else if (priceImpact > 2) {
      return {
        action: 'CAUTION',
        reason: 'Moderate price impact (2-5%)',
        priceImpact
      };
    } else {
      return {
        action: 'EXECUTE',
        reason: 'Low price impact (<2%)',
        priceImpact
      };
    }
  }
}

module.exports = new JupiterService();
