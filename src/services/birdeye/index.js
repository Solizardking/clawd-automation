/**
 * Birdeye Service - Unified API Gateway
 * 
 * Re-exports the comprehensive V3 client with FULL API coverage,
 * plus legacy compatibility methods and X402-specific analytics.
 * 
 * Uses BIRDEYE_API_KEY from environment / config.
 */

const v3 = require('./v3');
const config = require('../../config/index.js');

class BirdeyeService {
  constructor() {
    // The V3 client handles all HTTP calls
    this.v3 = v3;
    this.apiUrl = v3.baseUrl;
    this.apiKey = v3.apiKey;
  }

  // ═══════════════════════════════════════════════════════════════
  //  STATS - Token Overview, Metadata, Market Data, Trade Data
  // ═══════════════════════════════════════════════════════════════

  /** Token Overview with custom timeframes */
  async getTokenOverview(address, options) { return this.v3.getTokenOverview(address, options); }

  /** Token Metadata - Single */
  async getTokenMetadata(address, options) { return this.v3.getTokenMetadataSingle(address, options); }
  async getTokenMetadataSingle(address, options) { return this.v3.getTokenMetadataSingle(address, options); }

  /** Token Metadata - Multiple (max 50) */
  async getTokenMetadataMultiple(addresses, options) { return this.v3.getTokenMetadataMultiple(addresses, options); }

  /** Token Market Data - Single */
  async getTokenMarketData(address, options) { return this.v3.getTokenMarketDataSingle(address, options); }
  async getTokenMarketDataSingle(address, options) { return this.v3.getTokenMarketDataSingle(address, options); }

  /** Token Market Data - Multiple (max 20) */
  async getTokenMarketDataMultiple(addresses, options) { return this.v3.getTokenMarketDataMultiple(addresses, options); }

  /** Token Trade Data - Single (full buy/sell/volume/wallet data across timeframes) */
  async getTokenTradeData(address, options) { return this.v3.getTokenTradeDataSingle(address, options); }
  async getTokenTradeDataSingle(address, options) { return this.v3.getTokenTradeDataSingle(address, options); }

  /** Token Trade Data - Multiple (max 20) */
  async getTokenTradeDataMultiple(addresses, options) { return this.v3.getTokenTradeDataMultiple(addresses, options); }

  /** Token Liquidity (Exit Liquidity) - Single */
  async getTokenLiquidity(address, options) { return this.v3.getTokenLiquiditySingle(address, options); }
  async getTokenLiquiditySingle(address, options) { return this.v3.getTokenLiquiditySingle(address, options); }

  /** Token Liquidity - Multiple (max 50) */
  async getTokenLiquidityMultiple(addresses, options) { return this.v3.getTokenLiquidityMultiple(addresses, options); }

  /** Pair Overview - Single */
  async getPairOverview(address, options) { return this.v3.getPairOverviewSingle(address, options); }
  async getPairOverviewSingle(address, options) { return this.v3.getPairOverviewSingle(address, options); }

  /** Pair Overview - Multiple (max 20) */
  async getPairOverviewMultiple(addresses, options) { return this.v3.getPairOverviewMultiple(addresses, options); }

  /** Price Stats - Single (price, high/low, % change by timeframe) */
  async getPriceStats(address, options) { return this.v3.getPriceStatsSingle(address, options); }
  async getPriceStatsSingle(address, options) { return this.v3.getPriceStatsSingle(address, options); }

  /** Price Stats - Multiple (max 20, uses POST) */
  async getPriceStatsMultiple(addresses, options) { return this.v3.getPriceStatsMultiple(addresses, options); }

  // ═══════════════════════════════════════════════════════════════
  //  TOKEN/MARKET LIST
  // ═══════════════════════════════════════════════════════════════

  /** Token List V3 (max 100 per call, full filtering) */
  async getTokenList(options) { return this.v3.getTokenList(options); }

  /** Token List V3 Scroll (up to 5000 per batch) */
  async getTokenListScroll(options) { return this.v3.getTokenListScroll(options); }

  /** Token New Listing */
  async getNewListings(options) { return this.v3.getTokenNewListing(options); }
  async getTokenNewListing(options) { return this.v3.getTokenNewListing(options); }

  /** All markets/pairs for a token */
  async getTokenMarketList(address, options) { return this.v3.getTokenMarketList(address, options); }

  // ═══════════════════════════════════════════════════════════════
  //  TRANSACTIONS
  // ═══════════════════════════════════════════════════════════════

  /** Trades - Token V3 (block time/number ranges, source, owner, pool) */
  async getTokenTradesV3(address, options) { return this.v3.getTradesTokenV3(address, options); }

  /** Trades - All V3 */
  async getAllTradesV3(options) { return this.v3.getTradesAllV3(options); }

  /** Trades - Recent V3 */
  async getRecentTradesV3(options) { return this.v3.getTradesRecentV3(options); }

  /** Trades - Token (legacy V1) */
  async getTokenTrades(address, options) { return this.v3.getTradesToken(address, options); }

  /** Trades - Pair */
  async getPairTrades(address, options) { return this.v3.getTradesPair(address, options); }

  /** Trades - Token Seek By Time */
  async getTokenTradesByTime(address, options) { return this.v3.getTradesTokenSeekByTime(address, options); }

  /** Trades - Pair Seek By Time */
  async getPairTradesByTime(address, options) { return this.v3.getTradesPairSeekByTime(address, options); }

  /** Trader - Trades Seek By Time (by wallet) */
  async getTraderTrades(walletAddress, options) { return this.v3.getTraderTradesSeekByTime(walletAddress, options); }

  /** Trades - Token Filtered By Volume V3 */
  async getTradesByVolume(tokenAddress, volumeType, options) { return this.v3.getTradesTokenByVolume(tokenAddress, volumeType, options); }

  /** Token Mint/Burn transactions */
  async getTokenMintBurn(address, options) { return this.v3.getTokenMintBurn(address, options); }

  // ═══════════════════════════════════════════════════════════════
  //  WALLET, NETWORTH & PNL
  // ═══════════════════════════════════════════════════════════════

  /** Wallet portfolio (all token balances) */
  async getWalletPortfolio(wallet, options) { return this.v3.getWalletPortfolio(wallet, options); }

  /** Wallet specific token balance */
  async getWalletTokenBalance(wallet, tokenAddress, options) { return this.v3.getWalletTokenBalance(wallet, tokenAddress, options); }

  /** Wallet net worth in USD */
  async getWalletNetWorth(wallet, options) { return this.v3.getWalletNetWorth(wallet, options); }

  /** Wallet PnL (profit and loss) */
  async getWalletPnL(wallet, options) { return this.v3.getWalletPnL(wallet, options); }

  // ═══════════════════════════════════════════════════════════════
  //  HOLDER
  // ═══════════════════════════════════════════════════════════════

  /** Token top holders */
  async getTokenHolders(address, options) { return this.v3.getTokenHolders(address, options); }

  // ═══════════════════════════════════════════════════════════════
  //  BLOCKCHAIN
  // ═══════════════════════════════════════════════════════════════

  /** List supported networks */
  async getNetworkList() { return this.v3.getNetworkList(); }

  // ═══════════════════════════════════════════════════════════════
  //  CREATION & TRENDING
  // ═══════════════════════════════════════════════════════════════

  /** Token creation info (deployer, time, initial supply) */
  async getTokenCreationInfo(address, options) { return this.v3.getTokenCreationInfo(address, options); }

  /** Trending tokens */
  async getTrendingTokens(sortBy, sortType, limit) {
    const result = await this.v3.getTokenTrending({ sortBy, sortType, limit });
    return result?.data?.tokens || result?.data || [];
  }

  // ═══════════════════════════════════════════════════════════════
  //  MEME
  // ═══════════════════════════════════════════════════════════════

  /** Meme token detail */
  async getMemeTokenDetail(address, options) { return this.v3.getMemeTokenDetail(address, options); }

  // ═══════════════════════════════════════════════════════════════
  //  SECURITY
  // ═══════════════════════════════════════════════════════════════

  /** Token security audit (ownership, renounced, freeze authority) */
  async getTokenSecurity(address, options) { return this.v3.getTokenSecurity(address, options); }

  // ═══════════════════════════════════════════════════════════════
  //  SEARCH & UTILS
  // ═══════════════════════════════════════════════════════════════

  /** Search tokens by keyword */
  async searchTokens(keyword, options) { return this.v3.searchTokens(keyword, options); }

  // ═══════════════════════════════════════════════════════════════
  //  PRICE & OHLCV
  // ═══════════════════════════════════════════════════════════════

  /** Single token price */
  async getPrice(address, options) { return this.v3.getPrice(address, options); }

  /** Multiple token prices */
  async getMultiplePrices(addresses, options) { return this.v3.getMultiplePrices(addresses, options); }

  /** Price + Volume single */
  async getPriceVolumeSingle(address, options) { return this.v3.getPriceVolumeSingle(address, options); }

  /** Price + Volume multiple */
  async getPriceVolumeMulti(addresses, options) { return this.v3.getPriceVolumeMulti(addresses, options); }

  /** Historical price */
  async getHistoricalPrice(address, options) { return this.v3.getHistoricalPrice(address, options); }

  /** OHLCV candlestick data */
  async getOHLCV(address, type, timeFrom, timeTo, options) { return this.v3.getOHLCV(address, type, timeFrom, timeTo, options); }

  /** OHLCV for pair */
  async getOHLCVPair(address, type, timeFrom, timeTo, options) { return this.v3.getOHLCVPair(address, type, timeFrom, timeTo, options); }

  /** OHLCV for base/quote */
  async getOHLCVBaseQuote(baseAddress, quoteAddress, type, timeFrom, timeTo, options) { return this.v3.getOHLCVBaseQuote(baseAddress, quoteAddress, type, timeFrom, timeTo, options); }

  /** OHLCV V3 */
  async getOHLCVV3(address, type, timeFrom, timeTo, options) { return this.v3.getOHLCVV3(address, type, timeFrom, timeTo, options); }

  // ═══════════════════════════════════════════════════════════════
  //  X402 SPECIFIC
  // ═══════════════════════════════════════════════════════════════

  /** X402 token info (metadata) */
  async getX402TokenInfo() { return this.getTokenMetadata(config.x402.tokenMint); }

  /** X402 market data */
  async getX402MarketData() { return this.getTokenMarketData(config.x402.tokenMint); }

  /** X402 as meme token */
  async getX402AsMemeToken() {
    try { return await this.getMemeTokenDetail(config.x402.tokenMint); }
    catch { return null; }
  }

  /** X402 comprehensive analytics */
  async getX402Analytics() {
    const [marketData, tokenInfo, creationInfo, memeData, security] = await Promise.allSettled([
      this.getX402MarketData(),
      this.getX402TokenInfo(),
      this.getTokenCreationInfo(config.x402.tokenMint),
      this.getX402AsMemeToken(),
      this.getTokenSecurity(config.x402.tokenMint),
    ]);

    return {
      marketData: marketData.status === 'fulfilled' ? marketData.value : null,
      tokenInfo: tokenInfo.status === 'fulfilled' ? tokenInfo.value : null,
      creationInfo: creationInfo.status === 'fulfilled' ? creationInfo.value : null,
      memeData: memeData.status === 'fulfilled' ? memeData.value : null,
      security: security.status === 'fulfilled' ? security.value : null,
      timestamp: Date.now(),
    };
  }

  /** Full token intelligence (metadata + market + trade + security) */
  async getTokenIntelligence(address) { return this.v3.getTokenIntelligence(address); }

  /** X402 full intelligence */
  async getX402Intelligence() { return this.v3.getX402Intelligence(); }

  /** Whale trades for a token */
  async getWhaleTradesV3(tokenAddress, minVolumeUsd, options) { return this.v3.getWhaleTradesV3(tokenAddress, minVolumeUsd, options); }

  /** Top tokens ranked by metric */
  async getTopTokens(sortBy, limit) { return this.v3.getTopTokens(sortBy, limit); }

  /** Recently listed tokens */
  async getRecentlyListed(limit) { return this.v3.getRecentlyListed(limit); }

  /** Complete trader/wallet profile */
  async getTraderProfile(walletAddress) { return this.v3.getTraderProfile(walletAddress); }

  // ═══════════════════════════════════════════════════════════════
  //  ANALYTICS / SCORING (kept from original)
  // ═══════════════════════════════════════════════════════════════

  async analyzeTokenPerformance(tokenAddress) {
    try {
      const result = await this.getTokenMarketData(tokenAddress);
      const marketData = result?.data || result;

      return {
        address: tokenAddress,
        price: marketData.price,
        liquidity: marketData.liquidity,
        marketCap: marketData.market_cap,
        fdv: marketData.fdv,
        holder: marketData.holder,
        volume24h: marketData.volume_24h || 0,
        priceChange24h: marketData.price_change_24h_percent || 0,
        liquidityScore: this.calculateLiquidityScore(marketData.liquidity, marketData.market_cap),
        riskLevel: this.assessRiskLevel(marketData),
        recommendation: this.generateRecommendation(marketData),
      };
    } catch (error) {
      console.error('Token performance analysis error:', error);
      throw error;
    }
  }

  calculateLiquidityScore(liquidity, marketCap) {
    if (!liquidity || !marketCap) return 0;
    const ratio = liquidity / marketCap;
    if (ratio >= 0.2) return 100;
    if (ratio >= 0.1) return 80;
    if (ratio >= 0.05) return 60;
    if (ratio >= 0.02) return 40;
    return 20;
  }

  assessRiskLevel(marketData) {
    const liq = this.calculateLiquidityScore(marketData.liquidity, marketData.market_cap);
    if (liq >= 80 && marketData.market_cap > 1000000) return 'LOW';
    if (liq >= 60 && marketData.market_cap > 500000) return 'MEDIUM';
    if (liq >= 40) return 'HIGH';
    return 'VERY_HIGH';
  }

  generateRecommendation(marketData) {
    const liq = this.calculateLiquidityScore(marketData.liquidity, marketData.market_cap);
    const risk = this.assessRiskLevel(marketData);

    if (risk === 'LOW' && liq >= 80) {
      return { action: 'BUY', confidence: 'HIGH', reasons: ['Strong liquidity', 'Established market cap', 'Low risk'] };
    } else if (risk === 'MEDIUM' && liq >= 60) {
      return { action: 'HOLD', confidence: 'MEDIUM', reasons: ['Moderate liquidity', 'Growing market cap', 'Medium risk'] };
    } else if (risk === 'HIGH' || liq < 40) {
      return { action: 'AVOID', confidence: 'HIGH', reasons: ['Low liquidity', 'High risk', 'Potential manipulation'] };
    }
    return { action: 'RESEARCH', confidence: 'LOW', reasons: ['Insufficient data', 'Unclear market conditions'] };
  }

  async compareTokens(tokenAddresses) {
    const analyses = await Promise.all(tokenAddresses.map(addr => this.analyzeTokenPerformance(addr)));
    return {
      tokens: analyses,
      bestPerformer: analyses.reduce((best, curr) => curr.liquidityScore > best.liquidityScore ? curr : best),
      comparison: {
        averageLiquidityScore: analyses.reduce((s, a) => s + a.liquidityScore, 0) / analyses.length,
        averageMarketCap: analyses.reduce((s, a) => s + (a.marketCap || 0), 0) / analyses.length,
        totalTokens: analyses.length,
        lowRiskCount: analyses.filter(a => a.riskLevel === 'LOW').length,
        highRiskCount: analyses.filter(a => a.riskLevel === 'HIGH' || a.riskLevel === 'VERY_HIGH').length,
      },
    };
  }

  /** Comprehensive meme data for a token */
  async getComprehensiveMemeData(address) {
    const [price, trades, ohlcv24h] = await Promise.allSettled([
      this.getPrice(address, { includeLiquidity: true }),
      this.getTokenTradesV3(address, { limit: 50 }),
      this.getOHLCVV3(address, '1h', Math.floor(Date.now() / 1000) - 86400, Math.floor(Date.now() / 1000)),
    ]);

    return {
      price: price.status === 'fulfilled' ? price.value : null,
      recentTrades: trades.status === 'fulfilled' ? trades.value : null,
      ohlcv24h: ohlcv24h.status === 'fulfilled' ? ohlcv24h.value : null,
      timestamp: Date.now(),
    };
  }
}

module.exports = new BirdeyeService();
