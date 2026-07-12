const axios = require('axios');
const WebSocket = require('ws');
const config = require('../config/index.js');

class PumpFunService {
  constructor() {
    this.apiUrl = 'https://frontend-api.pump.fun';
    this.wsUrl = 'wss://pumpportal.fun/api/data';
    this.x402Mint = config.x402.tokenMint;
    this.x402Url = 'https://pump.fun/coin/6H8uyJYrPVcra6Fi7iWh29DXSm8KctzhHRyXmPwKpump';

    this.ws = null;
    this.subscribers = new Map();
  }

  /**
   * Get token data from Pump.fun
   */
  async getTokenData(mintAddress = this.x402Mint) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/coins/${mintAddress}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'X402Agent/1.0'
          }
        }
      );

      return this.parseTokenData(response.data);
    } catch (error) {
      console.error('Pump.fun API error:', error.response?.data || error.message);
      // Return cached/default data if API fails
      return this.getDefaultX402Data();
    }
  }

  /**
   * Parse token data from Pump.fun response
   */
  parseTokenData(data) {
    return {
      mint: data.mint || this.x402Mint,
      name: data.name || 'X402',
      symbol: data.symbol || 'X402',
      description: data.description || '',
      image: data.image_uri || data.image || '',
      twitter: data.twitter || 'https://x.com/terminagent',
      telegram: data.telegram || '',
      website: data.website || 'https://x402.space',

      // Market data
      marketCap: data.usd_market_cap || data.market_cap || 0,
      price: data.price || 0,
      priceChange24h: data.price_change_24h_percent || 0,
      volume24h: data.volume_24h || 0,
      liquidity: data.liquidity || 0,

      // Trading data
      buyers: data.complete || data.king_of_the_hill_timestamp ? true : false,
      bondingCurve: data.bonding_curve || null,
      associatedBondingCurve: data.associated_bonding_curve || null,

      // Timestamps
      createdAt: data.created_timestamp || data.timestamp || null,
      lastTrade: data.last_trade_timestamp || null,

      // Meta
      pumpFunUrl: `https://pump.fun/coin/${data.mint || this.x402Mint}`,
      creator: data.creator || null,
      creatorPercentage: data.creator_percentage || 0,

      // Raw data
      raw: data
    };
  }

  /**
   * Get default X402 data (fallback)
   */
  getDefaultX402Data() {
    return {
      mint: this.x402Mint,
      name: 'X402',
      symbol: 'X402',
      description: 'The official Ticker of the X402 Protocol. AI agents powered by X402 token on Solana.',
      image: 'https://ipfs.io/ipfs/bafybeievhyslsry2hwlk4exdxve5ptxqfv7hb7zzzpgezr3wlgcgmfvk4y',
      twitter: 'https://x.com/terminagent',
      telegram: '',
      website: 'https://x402.space',
      marketCap: 0,
      price: 0,
      priceChange24h: 0,
      volume24h: 0,
      liquidity: 0,
      pumpFunUrl: this.x402Url,
      buyers: false,
      createdAt: null,
      raw: {}
    };
  }

  /**
   * Get X402 token info
   */
  async getX402Info() {
    return this.getTokenData(this.x402Mint);
  }

  /**
   * Search tokens on Pump.fun
   */
  async searchTokens(query, options = {}) {
    try {
      const params = {
        limit: options.limit || 20,
        offset: options.offset || 0,
        sort: options.sort || 'created_timestamp',
        order: options.order || 'DESC'
      };

      const response = await axios.get(
        `${this.apiUrl}/coins`,
        {
          params,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'X402Agent/1.0'
          }
        }
      );

      const tokens = response.data || [];

      // Filter by query if provided
      if (query) {
        const lowerQuery = query.toLowerCase();
        return tokens.filter(token =>
          token.name?.toLowerCase().includes(lowerQuery) ||
          token.symbol?.toLowerCase().includes(lowerQuery) ||
          token.mint?.toLowerCase().includes(lowerQuery)
        ).map(token => this.parseTokenData(token));
      }

      return tokens.map(token => this.parseTokenData(token));
    } catch (error) {
      console.error('Pump.fun search error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get trending tokens
   */
  async getTrendingTokens(limit = 10) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/coins`,
        {
          params: {
            limit,
            sort: 'last_trade_timestamp',
            order: 'DESC',
            includeNsfw: false
          },
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'X402Agent/1.0'
          }
        }
      );

      return (response.data || []).map(token => this.parseTokenData(token));
    } catch (error) {
      console.error('Pump.fun trending error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get token trades
   */
  async getTokenTrades(mintAddress = this.x402Mint, limit = 50) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/trades/${mintAddress}`,
        {
          params: {
            limit,
            offset: 0
          },
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'X402Agent/1.0'
          }
        }
      );

      return (response.data || []).map(trade => ({
        signature: trade.signature,
        timestamp: trade.timestamp,
        type: trade.is_buy ? 'BUY' : 'SELL',
        solAmount: trade.sol_amount || 0,
        tokenAmount: trade.token_amount || 0,
        price: trade.sol_amount && trade.token_amount ?
          trade.sol_amount / trade.token_amount : 0,
        user: trade.user || null,
        mint: trade.mint || mintAddress
      }));
    } catch (error) {
      console.error('Pump.fun trades error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Connect to Pump.fun WebSocket for real-time data
   */
  connectWebSocket(subscriptions = []) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return this.ws;
    }

    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      console.log('✅ Connected to Pump.fun WebSocket');

      // Subscribe to X402 by default
      this.subscribeToToken(this.x402Mint);

      // Subscribe to additional tokens
      subscriptions.forEach(sub => {
        this.subscribeToToken(sub.mint || sub);
      });
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleWebSocketMessage(message);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket disconnected');
      // Reconnect after 5 seconds
      setTimeout(() => this.connectWebSocket(subscriptions), 5000);
    });

    return this.ws;
  }

  /**
   * Subscribe to token updates
   */
  subscribeToToken(mintAddress, callback = null) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return false;
    }

    const subscription = {
      method: 'subscribeTokenTrade',
      keys: [mintAddress]
    };

    this.ws.send(JSON.stringify(subscription));

    if (callback) {
      if (!this.subscribers.has(mintAddress)) {
        this.subscribers.set(mintAddress, []);
      }
      this.subscribers.get(mintAddress).push(callback);
    }

    console.log(`Subscribed to token: ${mintAddress}`);
    return true;
  }

  /**
   * Unsubscribe from token updates
   */
  unsubscribeFromToken(mintAddress) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const unsubscription = {
      method: 'unsubscribeTokenTrade',
      keys: [mintAddress]
    };

    this.ws.send(JSON.stringify(unsubscription));
    this.subscribers.delete(mintAddress);

    console.log(`Unsubscribed from token: ${mintAddress}`);
    return true;
  }

  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(message) {
    if (!message || !message.mint) return;

    const trade = {
      mint: message.mint,
      signature: message.signature,
      timestamp: message.timestamp || Date.now(),
      type: message.txType === 'buy' ? 'BUY' : 'SELL',
      solAmount: message.solAmount || 0,
      tokenAmount: message.tokenAmount || 0,
      price: message.solAmount && message.tokenAmount ?
        message.solAmount / message.tokenAmount : 0,
      user: message.user || message.traderPublicKey || null,
      newMarketCap: message.marketCapSol || 0,
      bondingCurveKey: message.bondingCurveKey || null
    };

    // Notify subscribers
    const callbacks = this.subscribers.get(message.mint);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(trade);
        } catch (error) {
          console.error('Subscriber callback error:', error);
        }
      });
    }

    // Emit to global listeners (if any)
    this.emit('trade', trade);
  }

  /**
   * Simple event emitter
   */
  emit(event, data) {
    const globalCallbacks = this.subscribers.get(`__${event}__`);
    if (globalCallbacks) {
      globalCallbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Listen to global events
   */
  on(event, callback) {
    const eventKey = `__${event}__`;
    if (!this.subscribers.has(eventKey)) {
      this.subscribers.set(eventKey, []);
    }
    this.subscribers.get(eventKey).push(callback);
  }

  /**
   * Monitor X402 token in real-time
   */
  monitorX402(callback) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket();
      // Wait for connection then subscribe
      setTimeout(() => {
        this.subscribeToToken(this.x402Mint, callback);
      }, 1000);
    } else {
      this.subscribeToToken(this.x402Mint, callback);
    }

    return {
      stop: () => this.unsubscribeFromToken(this.x402Mint)
    };
  }

  /**
   * Get X402 pump.fun page data
   */
  async getX402Page() {
    const tokenData = await this.getX402Info();
    const trades = await this.getTokenTrades(this.x402Mint, 20);

    return {
      url: this.x402Url,
      token: tokenData,
      recentTrades: trades,
      stats: {
        totalTrades: trades.length,
        buyCount: trades.filter(t => t.type === 'BUY').length,
        sellCount: trades.filter(t => t.type === 'SELL').length,
        avgBuySize: this.calculateAvgSize(trades.filter(t => t.type === 'BUY')),
        avgSellSize: this.calculateAvgSize(trades.filter(t => t.type === 'SELL'))
      }
    };
  }

  /**
   * Calculate average trade size
   */
  calculateAvgSize(trades) {
    if (trades.length === 0) return 0;
    const total = trades.reduce((sum, trade) => sum + trade.solAmount, 0);
    return total / trades.length;
  }

  /**
   * Close WebSocket connection
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.subscribers.clear();
      console.log('Disconnected from Pump.fun WebSocket');
    }
  }
}

module.exports = new PumpFunService();
