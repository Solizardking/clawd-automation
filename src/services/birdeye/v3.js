/**
 * Birdeye V3 Comprehensive API Client
 * 
 * Complete implementation of ALL Birdeye Data Services APIs:
 * 
 * ═══ STATS ═══
 *  - Token Overview (GET /defi/token_overview)
 *  - Token Metadata Single (GET /defi/v3/token/meta-data/single)
 *  - Token Metadata Multiple (GET /defi/v3/token/meta-data/multiple)
 *  - Token Market Data Single (GET /defi/v3/token/market-data)
 *  - Token Market Data Multiple (GET /defi/v3/token/market-data/multiple)
 *  - Token Trade Data Single (GET /defi/v3/token/trade-data/single)
 *  - Token Trade Data Multiple (GET /defi/v3/token/trade-data/multiple)
 *  - Token Liquidity Single (GET /defi/v3/token/exit-liquidity)
 *  - Token Liquidity Multiple (GET /defi/v3/token/exit-liquidity/multiple)
 *  - Pair Overview Single (GET /defi/v3/pair/overview/single)
 *  - Pair Overview Multiple (GET /defi/v3/pair/overview/multiple)
 *  - Price Stats Single (GET /defi/v3/price/stats/single)
 *  - Price Stats Multiple (POST /defi/v3/price/stats/multiple)
 * 
 * ═══ TOKEN/MARKET LIST ═══
 *  - Token List V3 (GET /defi/v3/token/list)
 *  - Token List V3 Scroll (GET /defi/v3/token/list/scroll)
 *  - Token New Listing (GET /defi/v3/token/new-listing)
 *  - Token All Market List (GET /defi/v3/token/market-list)
 * 
 * ═══ TRANSACTIONS ═══
 *  - Trades Token V3 (GET /defi/v3/token/txs)
 *  - Trades All V3 (GET /defi/v3/txs)
 *  - Trades Recent V3 (GET /defi/v3/txs/recent)
 *  - Trades Token (GET /defi/txs/token)
 *  - Trades Pair (GET /defi/txs/pair)
 *  - Trades Token Seek By Time (GET /defi/txs/token/seek_by_time)
 *  - Trades Pair Seek By Time (GET /defi/txs/pair/seek_by_time)
 *  - Trader Trades Seek By Time (GET /trader/txs/seek_by_time)
 *  - Trades Token Filtered By Volume V3 (GET /defi/v3/token/txs-by-volume)
 *  - Token Mint/Burn (GET /defi/v3/token/mint-burn)
 * 
 * ═══ WALLET, NETWORTH & PNL ═══
 *  - Wallet Portfolio (GET /v1/wallet/token_list)
 *  - Wallet Balance (GET /v1/wallet/token_balance)
 *  - Wallet Net Worth (GET /v1/wallet/net_worth)
 *  - Wallet PnL (GET /v1/wallet/pnl)
 * 
 * ═══ HOLDER ═══
 *  - Token Holder List (GET /defi/v3/token/holder)
 * 
 * ═══ BLOCKCHAIN ═══
 *  - Network List (GET /defi/v3/network/list)
 * 
 * ═══ CREATION & TRENDING ═══
 *  - Token Creation Info (GET /defi/token_creation_info)
 *  - Token Trending (GET /defi/token_trending)
 * 
 * ═══ MEME ═══
 *  - Meme Token Detail Single (GET /defi/v3/token/meme/detail/single)
 * 
 * ═══ SECURITY ═══
 *  - Token Security (GET /defi/token_security)
 * 
 * ═══ SEARCH & UTILS ═══
 *  - Token Search (GET /defi/v3/search)
 */

const axios = require('axios');
const config = require('../../config/index.js');

class BirdeyeV3Client {
    constructor() {
        this.baseUrl = config.birdeye.apiUrl || 'https://public-api.birdeye.so';
        this.apiKey = config.birdeye.apiKey;
        this.defaultChain = 'solana';

        this.headers = {
            'accept': 'application/json',
            'x-chain': this.defaultChain,
            'X-API-KEY': this.apiKey,
        };
    }

    /**
     * Internal request helper with error handling
     */
    async _get(path, params = {}, options = {}) {
        try {
            const chain = options.chain || this.defaultChain;
            const response = await axios.get(`${this.baseUrl}${path}`, {
                params: this._cleanParams(params),
                headers: { ...this.headers, 'x-chain': chain },
            });
            return response.data;
        } catch (error) {
            const errData = error.response?.data || { message: error.message };
            const status = error.response?.status || 'UNKNOWN';
            throw new Error(`Birdeye API error [${status}] ${path}: ${JSON.stringify(errData)}`);
        }
    }

    async _post(path, body = {}, params = {}, options = {}) {
        try {
            const chain = options.chain || this.defaultChain;
            const response = await axios.post(`${this.baseUrl}${path}`, body, {
                params: this._cleanParams(params),
                headers: { ...this.headers, 'x-chain': chain, 'content-type': 'application/json' },
            });
            return response.data;
        } catch (error) {
            const errData = error.response?.data || { message: error.message };
            const status = error.response?.status || 'UNKNOWN';
            throw new Error(`Birdeye API error [${status}] ${path}: ${JSON.stringify(errData)}`);
        }
    }

    _cleanParams(params) {
        const clean = {};
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null && v !== '') {
                clean[k] = v;
            }
        }
        return clean;
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  STATS - Token Overview                                      ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/token_overview
     * Retrieve stats of a specified token with custom timeframes.
     * 
     * @param {string} address - Token contract address (required)
     * @param {object} options
     * @param {string} options.frames - Custom time intervals, comma-separated (e.g. "1m,5m,30m,1h,24h")
     * @param {string} options.uiAmountMode - "scaled" or "raw" (default: "scaled")
     * @param {string} options.chain - Chain (default: "solana")
     */
    async getTokenOverview(address, options = {}) {
        return this._get('/defi/token_overview', {
            address,
            frames: options.frames,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  STATS - Token Metadata                                      ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/v3/token/meta-data/single
     * Retrieve metadata of a specified token (name, symbol, decimals, extensions, logo).
     * 
     * @param {string} address - Token contract address (required)
     */
    async getTokenMetadataSingle(address, options = {}) {
        return this._get('/defi/v3/token/meta-data/single', { address }, options);
    }

    /**
     * GET /defi/v3/token/meta-data/multiple
     * Retrieve metadata of multiple tokens. Maximum 50 addresses.
     * 
     * @param {string|string[]} addresses - Comma-separated or array of token addresses (required)
     */
    async getTokenMetadataMultiple(addresses, options = {}) {
        const list = Array.isArray(addresses) ? addresses.join(',') : addresses;
        return this._get('/defi/v3/token/meta-data/multiple', { list_address: list }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  STATS - Token Market Data                                    ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/v3/token/market-data
     * Retrieve market data: price, liquidity, supply, market cap, FDV, holder count.
     * 
     * @param {string} address - Token contract address (required)
     * @param {object} options
     * @param {string} options.uiAmountMode - "scaled" or "raw" (default: "scaled")
     */
    async getTokenMarketDataSingle(address, options = {}) {
        return this._get('/defi/v3/token/market-data', {
            address,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/v3/token/market-data/multiple
     * Retrieve market data of multiple tokens. Maximum 20 addresses.
     * 
     * @param {string|string[]} addresses - Comma-separated or array of token addresses (required)
     */
    async getTokenMarketDataMultiple(addresses, options = {}) {
        const list = Array.isArray(addresses) ? addresses.join(',') : addresses;
        return this._get('/defi/v3/token/market-data/multiple', {
            list_address: list,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  STATS - Token Trade Data                                     ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/v3/token/trade-data/single
     * Full trade data with all timeframes: price history, wallets, buys/sells, volume.
     * 
     * @param {string} address - Token contract address (required)
     * @param {object} options
     * @param {string} options.frames - Custom time intervals (e.g. "1m,5m,1h,24h")
     * @param {string} options.uiAmountMode - "scaled" or "raw"
     */
    async getTokenTradeDataSingle(address, options = {}) {
        return this._get('/defi/v3/token/trade-data/single', {
            address,
            frames: options.frames,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/v3/token/trade-data/multiple
     * Trade data for multiple tokens. Maximum 20 addresses.
     * 
     * @param {string|string[]} addresses - Comma-separated or array of token addresses
     * @param {object} options
     * @param {string} options.frames - Custom time intervals
     */
    async getTokenTradeDataMultiple(addresses, options = {}) {
        const list = Array.isArray(addresses) ? addresses.join(',') : addresses;
        return this._get('/defi/v3/token/trade-data/multiple', {
            list_address: list,
            frames: options.frames,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  STATS - Token Liquidity (Exit Liquidity)                     ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/v3/token/exit-liquidity
     * Liquidity value based on USD, native tokens, and high-liquidity assets.
     * Confirms on-chain pools have real liquidity prior to trades.
     * 
     * @param {string} address - Token contract address (required)
     * @param {object} options
     * @param {string} options.chain - default "base" (per API docs)
     */
    async getTokenLiquiditySingle(address, options = {}) {
        return this._get('/defi/v3/token/exit-liquidity', { address }, {
            chain: options.chain || 'base',
            ...options,
        });
    }

    /**
     * GET /defi/v3/token/exit-liquidity/multiple
     * Exit liquidity for multiple tokens. Maximum 50 addresses.
     * 
     * @param {string|string[]} addresses
     */
    async getTokenLiquidityMultiple(addresses, options = {}) {
        const list = Array.isArray(addresses) ? addresses.join(',') : addresses;
        return this._get('/defi/v3/token/exit-liquidity/multiple', { list_address: list }, {
            chain: options.chain || 'base',
            ...options,
        });
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  STATS - Pair Overview                                        ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/v3/pair/overview/single
     * Retrieve stats of a specified pair (base/quote tokens, liquidity, volume, trades).
     * 
     * @param {string} address - Pair contract address (required)
     */
    async getPairOverviewSingle(address, options = {}) {
        return this._get('/defi/v3/pair/overview/single', {
            address,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/v3/pair/overview/multiple
     * Retrieve stats of multiple pairs. Maximum 20 addresses.
     * 
     * @param {string|string[]} addresses - Pair contract addresses
     */
    async getPairOverviewMultiple(addresses, options = {}) {
        const list = Array.isArray(addresses) ? addresses.join(',') : addresses;
        return this._get('/defi/v3/pair/overview/multiple', {
            list_address: list,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  STATS - Price Stats                                          ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/v3/price/stats/single
     * Price stats (current price, high/low, % change) by timeframe for one token.
     * 
     * @param {string} address - Token contract address (required)
     * @param {object} options
     * @param {string} options.listTimeframe - e.g. "1m,5m,30m,1h,2h,4h,8h,24h,2d,3d,7d"
     * @param {string} options.uiAmountMode - "raw", "scaled", "both"
     */
    async getPriceStatsSingle(address, options = {}) {
        return this._get('/defi/v3/price/stats/single', {
            address,
            list_timeframe: options.listTimeframe,
            ui_amount_mode: options.uiAmountMode || 'raw',
        }, options);
    }

    /**
     * POST /defi/v3/price/stats/multiple
     * Price stats for multiple tokens. Max 20 tokens.
     * 
     * @param {string|string[]} addresses - Comma-separated addresses
     * @param {object} options
     * @param {string} options.listTimeframe - Timeframe list
     */
    async getPriceStatsMultiple(addresses, options = {}) {
        const list = Array.isArray(addresses) ? addresses.join(',') : addresses;
        return this._post('/defi/v3/price/stats/multiple', {
            list_address: list,
        }, {
            list_timeframe: options.listTimeframe,
            ui_amount_mode: options.uiAmountMode || 'raw',
        }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  TOKEN/MARKET LIST                                            ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/v3/token/list
     * Retrieve a list of tokens with comprehensive filtering and sorting.
     * Maximum 100 tokens per call.
     * 
     * @param {object} options - Extensive filtering options
     * @param {string} options.sortBy - Sort field (default: "liquidity"). Options: liquidity, market_cap, fdv, volume_1h_usd, etc.
     * @param {string} options.sortType - "desc" or "asc" (default: "desc")
     * @param {number} options.minLiquidity, options.maxLiquidity
     * @param {number} options.minMarketCap, options.maxMarketCap
     * @param {number} options.minFdv, options.maxFdv
     * @param {number} options.minHolder
     * @param {number} options.minVolume1hUsd, options.minVolume24hUsd, ...
     * @param {number} options.minPriceChange1hPercent, options.minPriceChange24hPercent, ...
     * @param {number} options.minTrade1hCount, options.minTrade24hCount, ...
     * @param {number} options.offset - Pagination (default: 0, max: 10000)
     * @param {number} options.limit - Items per page (default: 100, max: 100)
     */
    async getTokenList(options = {}) {
        return this._get('/defi/v3/token/list', {
            sort_by: options.sortBy || 'liquidity',
            sort_type: options.sortType || 'desc',
            min_liquidity: options.minLiquidity,
            max_liquidity: options.maxLiquidity,
            min_market_cap: options.minMarketCap,
            max_market_cap: options.maxMarketCap,
            min_fdv: options.minFdv,
            max_fdv: options.maxFdv,
            min_recent_listing_time: options.minRecentListingTime,
            max_recent_listing_time: options.maxRecentListingTime,
            min_last_trade_unix_time: options.minLastTradeUnixTime,
            max_last_trade_unix_time: options.maxLastTradeUnixTime,
            min_holder: options.minHolder,
            min_volume_1h_usd: options.minVolume1hUsd,
            min_volume_2h_usd: options.minVolume2hUsd,
            min_volume_4h_usd: options.minVolume4hUsd,
            min_volume_8h_usd: options.minVolume8hUsd,
            min_volume_24h_usd: options.minVolume24hUsd,
            min_volume_7d_usd: options.minVolume7dUsd,
            min_volume_30d_usd: options.minVolume30dUsd,
            min_volume_1h_change_percent: options.minVolume1hChangePercent,
            min_volume_2h_change_percent: options.minVolume2hChangePercent,
            min_volume_4h_change_percent: options.minVolume4hChangePercent,
            min_volume_8h_change_percent: options.minVolume8hChangePercent,
            min_volume_24h_change_percent: options.minVolume24hChangePercent,
            min_volume_7d_change_percent: options.minVolume7dChangePercent,
            min_volume_30d_change_percent: options.minVolume30dChangePercent,
            min_price_change_1h_percent: options.minPriceChange1hPercent,
            min_price_change_2h_percent: options.minPriceChange2hPercent,
            min_price_change_4h_percent: options.minPriceChange4hPercent,
            min_price_change_8h_percent: options.minPriceChange8hPercent,
            min_price_change_24h_percent: options.minPriceChange24hPercent,
            min_price_change_7d_percent: options.minPriceChange7dPercent,
            min_price_change_30d_percent: options.minPriceChange30dPercent,
            min_trade_1h_count: options.minTrade1hCount,
            min_trade_2h_count: options.minTrade2hCount,
            min_trade_4h_count: options.minTrade4hCount,
            min_trade_8h_count: options.minTrade8hCount,
            min_trade_24h_count: options.minTrade24hCount,
            min_trade_7d_count: options.minTrade7dCount,
            min_trade_30d_count: options.minTrade30dCount,
            offset: options.offset || 0,
            limit: options.limit || 100,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/v3/token/list/scroll
     * Retrieve up to 5,000 tokens per batch with scroll pagination.
     * Only one active scroll_id per account every 30 seconds.
     * 
     * @param {object} options - Same filters as getTokenList plus:
     * @param {string} options.scrollId - Continue from previous scroll
     * @param {number} options.limit - Up to 5000 per page
     */
    async getTokenListScroll(options = {}) {
        return this._get('/defi/v3/token/list/scroll', {
            scroll_id: options.scrollId,
            limit: options.limit || 5000,
            sort_by: options.sortBy || 'liquidity',
            sort_type: options.sortType || 'desc',
            min_liquidity: options.minLiquidity,
            max_liquidity: options.maxLiquidity,
            min_market_cap: options.minMarketCap,
            max_market_cap: options.maxMarketCap,
            min_fdv: options.minFdv,
            max_fdv: options.maxFdv,
            min_holder: options.minHolder,
            min_volume_24h_usd: options.minVolume24hUsd,
            min_price_change_24h_percent: options.minPriceChange24hPercent,
            min_trade_24h_count: options.minTrade24hCount,
            offset: options.offset || 0,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/v3/token/new-listing
     * Retrieve newly listed tokens.
     * 
     * @param {object} options
     * @param {number} options.limit - Number of results
     * @param {string} options.memeplatformId - Filter by launchpad
     */
    async getTokenNewListing(options = {}) {
        return this._get('/defi/v3/token/new-listing', {
            limit: options.limit || 50,
            memeplatform_id: options.memeplatformId,
            time_to: options.timeTo,
            time_from: options.timeFrom,
        }, options);
    }

    /**
     * GET /defi/v3/token/market-list
     * Retrieve all markets(pairs) for a token.
     * 
     * @param {string} address - Token contract address
     * @param {object} options
     */
    async getTokenMarketList(address, options = {}) {
        return this._get('/defi/v3/token/market-list', {
            address,
            offset: options.offset || 0,
            limit: options.limit || 50,
            sort_by: options.sortBy || 'liquidity',
            sort_type: options.sortType || 'desc',
        }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  TRANSACTIONS                                                 ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/v3/token/txs
     * Trades for a specific token with V3 filters (block time/number ranges, source, owner).
     * 
     * @param {string} address - Token contract address (required)
     * @param {object} options
     * @param {number} options.offset - 0-9999
     * @param {number} options.limit - 1-100 (default: 100)
     * @param {string} options.sortBy - "block_unix_time" or "block_number"
     * @param {string} options.sortType - "desc"
     * @param {string} options.txType - "swap", "buy", "sell", "add", "remove", "all"
     * @param {string} options.source - AMM source (raydium, etc.)
     * @param {string} options.owner - Wallet address filter
     * @param {string} options.poolId - LP pool filter
     * @param {number} options.beforeTime, options.afterTime - Unix timestamps
     * @param {number} options.beforeBlockNumber, options.afterBlockNumber - Block numbers
     */
    async getTradesTokenV3(address, options = {}) {
        return this._get('/defi/v3/token/txs', {
            address,
            offset: options.offset || 0,
            limit: options.limit || 100,
            sort_by: options.sortBy || 'block_unix_time',
            sort_type: options.sortType || 'desc',
            tx_type: options.txType || 'swap',
            source: options.source,
            owner: options.owner,
            pool_id: options.poolId,
            before_time: options.beforeTime,
            after_time: options.afterTime,
            before_block_number: options.beforeBlockNumber,
            after_block_number: options.afterBlockNumber,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/v3/txs
     * All trades across all tokens with V3 filters.
     */
    async getTradesAllV3(options = {}) {
        return this._get('/defi/v3/txs', {
            offset: options.offset || 0,
            limit: options.limit || 100,
            sort_by: options.sortBy || 'block_unix_time',
            sort_type: options.sortType || 'desc',
            tx_type: options.txType || 'swap',
            source: options.source,
            owner: options.owner,
            pool_id: options.poolId,
            before_time: options.beforeTime,
            after_time: options.afterTime,
            before_block_number: options.beforeBlockNumber,
            after_block_number: options.afterBlockNumber,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/v3/txs/recent
     * Get most recent trades.
     */
    async getTradesRecentV3(options = {}) {
        return this._get('/defi/v3/txs/recent', {
            offset: options.offset || 0,
            limit: options.limit || 100,
            tx_type: options.txType || 'swap',
            owner: options.owner,
            before_time: options.beforeTime,
            after_time: options.afterTime,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/txs/token
     * Legacy trades for a token (V1).
     */
    async getTradesToken(address, options = {}) {
        return this._get('/defi/txs/token', {
            address,
            offset: options.offset || 0,
            limit: options.limit || 50,
            tx_type: options.txType || 'swap',
            sort_type: options.sortType || 'desc',
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/txs/pair
     * Trades for a pair. offset + limit must be ≤ 50,000.
     * 
     * @param {string} address - Pair contract address (required)
     */
    async getTradesPair(address, options = {}) {
        return this._get('/defi/txs/pair', {
            address,
            offset: options.offset || 0,
            limit: options.limit || 50,
            tx_type: options.txType || 'swap',
            sort_type: options.sortType || 'desc',
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/txs/token/seek_by_time
     * Token trades with time bound option.
     */
    async getTradesTokenSeekByTime(address, options = {}) {
        return this._get('/defi/txs/token/seek_by_time', {
            address,
            offset: options.offset || 0,
            limit: options.limit || 100,
            tx_type: options.txType || 'swap',
            before_time: options.beforeTime,
            after_time: options.afterTime,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/txs/pair/seek_by_time
     * Pair trades with time bound option.
     */
    async getTradesPairSeekByTime(address, options = {}) {
        return this._get('/defi/txs/pair/seek_by_time', {
            address,
            offset: options.offset || 0,
            limit: options.limit || 50,
            tx_type: options.txType || 'swap',
            before_time: options.beforeTime,
            after_time: options.afterTime,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /trader/txs/seek_by_time
     * A trader's trades with time bound option.
     * 
     * @param {string} address - Trader address (required)
     */
    async getTraderTradesSeekByTime(address, options = {}) {
        return this._get('/trader/txs/seek_by_time', {
            address,
            offset: options.offset || 0,
            limit: options.limit || 100,
            tx_type: options.txType,
            before_time: options.beforeTime,
            after_time: options.afterTime,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/v3/token/txs-by-volume
     * Token trades filtered by volume (USD or amount). Supports time ranges beyond 30 days.
     * Max limit of 500.
     * 
     * @param {string} tokenAddress - Token contract address
     * @param {string} volumeType - "usd" or "amount" (required)
     * @param {object} options
     * @param {number} options.minVolume, options.maxVolume
     * @param {string} options.txType - "swap", "buy", "sell", "add", "remove", "all"
     */
    async getTradesTokenByVolume(tokenAddress, volumeType = 'usd', options = {}) {
        return this._get('/defi/v3/token/txs-by-volume', {
            token_address: tokenAddress,
            volume_type: volumeType,
            min_volume: options.minVolume,
            max_volume: options.maxVolume,
            sort_by: options.sortBy || 'block_unix_time',
            tx_type: options.txType || 'swap',
            source: options.source,
            owner: options.owner,
            before_time: options.beforeTime,
            after_time: options.afterTime,
            offset: options.offset || 0,
            limit: options.limit || 100,
            ui_amount_mode: options.uiAmountMode || 'scaled',
        }, options);
    }

    /**
     * GET /defi/v3/token/mint-burn
     * Token mint and burn transactions.
     * 
     * @param {string} address - Token contract address
     */
    async getTokenMintBurn(address, options = {}) {
        return this._get('/defi/v3/token/mint-burn', {
            address,
            offset: options.offset || 0,
            limit: options.limit || 100,
            sort_by: options.sortBy || 'block_unix_time',
            sort_type: options.sortType || 'desc',
            tx_type: options.txType || 'all',
            before_time: options.beforeTime,
            after_time: options.afterTime,
        }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  WALLET, NETWORTH & PNL                                       ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /v1/wallet/token_list
     * Get all token balances in a wallet (portfolio).
     * 
     * @param {string} wallet - Wallet address
     */
    async getWalletPortfolio(wallet, options = {}) {
        return this._get('/v1/wallet/token_list', {
            wallet,
        }, options);
    }

    /**
     * GET /v1/wallet/token_balance
     * Get specific token balance in a wallet.
     * 
     * @param {string} wallet - Wallet address
     * @param {string} tokenAddress - Token to check
     */
    async getWalletTokenBalance(wallet, tokenAddress, options = {}) {
        return this._get('/v1/wallet/token_balance', {
            wallet,
            token_address: tokenAddress,
        }, options);
    }

    /**
     * GET /v1/wallet/net_worth
     * Get total net worth of a wallet in USD.
     * 
     * @param {string} wallet - Wallet address
     */
    async getWalletNetWorth(wallet, options = {}) {
        return this._get('/v1/wallet/net_worth', { wallet }, options);
    }

    /**
     * GET /v1/wallet/pnl
     * Get profit and loss data for a wallet.
     * 
     * @param {string} wallet - Wallet address
     */
    async getWalletPnL(wallet, options = {}) {
        return this._get('/v1/wallet/pnl', { wallet }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  HOLDER                                                       ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/v3/token/holder
     * Get top holders of a token.
     * 
     * @param {string} address - Token contract address
     */
    async getTokenHolders(address, options = {}) {
        return this._get('/defi/v3/token/holder', {
            address,
            offset: options.offset || 0,
            limit: options.limit || 100,
        }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  BLOCKCHAIN                                                    ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/v3/network/list
     * List all supported networks.
     */
    async getNetworkList() {
        return this._get('/defi/v3/network/list', {});
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  CREATION & TRENDING                                          ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/token_creation_info
     * Get token creation info (deployer, time, initial supply).
     * 
     * @param {string} address - Token contract address
     */
    async getTokenCreationInfo(address, options = {}) {
        return this._get('/defi/token_creation_info', { address }, options);
    }

    /**
     * GET /defi/token_trending
     * Get trending tokens.
     * 
     * @param {object} options
     * @param {string} options.sortBy - Default "rank"
     * @param {string} options.sortType - Default "asc"
     * @param {number} options.offset - Default 0
     * @param {number} options.limit - Default 20
     */
    async getTokenTrending(options = {}) {
        return this._get('/defi/token_trending', {
            sort_by: options.sortBy || 'rank',
            sort_type: options.sortType || 'asc',
            offset: options.offset || 0,
            limit: options.limit || 20,
        }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  MEME                                                          ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/v3/token/meme/detail/single
     * Get detailed meme token data (additional social/community metrics).
     * 
     * @param {string} address - Token contract address
     */
    async getMemeTokenDetail(address, options = {}) {
        return this._get('/defi/v3/token/meme/detail/single', { address }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SECURITY                                                      ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/token_security
     * Get token security audit data (ownership, renounced, freeze authority, etc).
     * 
     * @param {string} address - Token contract address
     */
    async getTokenSecurity(address, options = {}) {
        return this._get('/defi/token_security', { address }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SEARCH & UTILS                                                ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/v3/search
     * Search tokens by keyword.
     * 
     * @param {string} keyword - Search query
     * @param {object} options
     * @param {string} options.target - "token", "pair", "all"
     * @param {string} options.sortBy - Sort field
     * @param {string} options.sortType - "asc" or "desc"
     * @param {number} options.offset, options.limit
     */
    async searchTokens(keyword, options = {}) {
        return this._get('/defi/v3/search', {
            keyword,
            target: options.target || 'token',
            sort_by: options.sortBy || 'liquidity',
            sort_type: options.sortType || 'desc',
            offset: options.offset || 0,
            limit: options.limit || 20,
            chain: options.chain || 'solana',
        }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  PRICE & OHLCV                                                 ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * GET /defi/price
     * Get single token price.
     */
    async getPrice(address, options = {}) {
        return this._get('/defi/price', {
            address,
            check_liquidity: options.checkLiquidity,
            include_liquidity: options.includeLiquidity !== false,
            ui_amount_mode: options.uiAmountMode || 'raw',
        }, options);
    }

    /**
     * GET /defi/multi_price
     * Get multiple token prices.
     */
    async getMultiplePrices(addresses, options = {}) {
        const list = Array.isArray(addresses) ? addresses.join(',') : addresses;
        return this._get('/defi/multi_price', {
            list_address: list,
            check_liquidity: options.checkLiquidity,
            include_liquidity: options.includeLiquidity !== false,
            ui_amount_mode: options.uiAmountMode || 'raw',
        }, options);
    }

    /**
     * GET /defi/price_volume/single
     * Price + Volume data for a single token.
     */
    async getPriceVolumeSingle(address, options = {}) {
        return this._get('/defi/price_volume/single', {
            address,
            type: options.type || '24h',
        }, options);
    }

    /**
     * POST /defi/price_volume/multi
     * Price + Volume data for multiple tokens.
     */
    async getPriceVolumeMulti(addresses, options = {}) {
        const list = Array.isArray(addresses) ? addresses.join(',') : addresses;
        return this._post('/defi/price_volume/multi', {
            list_address: list,
        }, {
            type: options.type || '24h',
        }, options);
    }

    /**
     * GET /defi/history_price
     * Historical price data.
     */
    async getHistoricalPrice(address, options = {}) {
        return this._get('/defi/history_price', {
            address,
            address_type: options.addressType || 'token',
            type: options.type || '1H',
            time_from: options.timeFrom,
            time_to: options.timeTo,
        }, options);
    }

    /**
     * GET /defi/ohlcv
     * OHLCV candlestick data.
     */
    async getOHLCV(address, type, timeFrom, timeTo, options = {}) {
        return this._get('/defi/ohlcv', {
            address,
            type,
            time_from: timeFrom,
            time_to: timeTo,
            currency: options.currency || 'usd',
            ui_amount_mode: options.uiAmountMode || 'raw',
        }, options);
    }

    /**
     * GET /defi/ohlcv/pair
     * OHLCV for a specific pair.
     */
    async getOHLCVPair(address, type, timeFrom, timeTo, options = {}) {
        return this._get('/defi/ohlcv/pair', {
            address,
            type,
            time_from: timeFrom,
            time_to: timeTo,
        }, options);
    }

    /**
     * GET /defi/ohlcv/base_quote
     * OHLCV for a base/quote pair.
     */
    async getOHLCVBaseQuote(baseAddress, quoteAddress, type, timeFrom, timeTo, options = {}) {
        return this._get('/defi/ohlcv/base_quote', {
            base_address: baseAddress,
            quote_address: quoteAddress,
            type,
            time_from: timeFrom,
            time_to: timeTo,
            ui_amount_mode: options.uiAmountMode || 'raw',
        }, options);
    }

    /**
     * GET /defi/v3/ohlcv
     * V3 OHLCV with enhanced data.
     */
    async getOHLCVV3(address, type, timeFrom, timeTo, options = {}) {
        return this._get('/defi/v3/ohlcv', {
            address,
            type,
            time_from: timeFrom,
            time_to: timeTo,
            currency: options.currency || 'usd',
            ui_amount_mode: options.uiAmountMode || 'raw',
        }, options);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  CONVENIENCE / COMPOSITE METHODS                               ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * Get comprehensive token intelligence (metadata + market + trade + security).
     */
    async getTokenIntelligence(address) {
        const [metadata, marketData, tradeData, security] = await Promise.allSettled([
            this.getTokenMetadataSingle(address),
            this.getTokenMarketDataSingle(address),
            this.getTokenTradeDataSingle(address),
            this.getTokenSecurity(address),
        ]);

        return {
            metadata: metadata.status === 'fulfilled' ? metadata.value?.data : null,
            marketData: marketData.status === 'fulfilled' ? marketData.value?.data : null,
            tradeData: tradeData.status === 'fulfilled' ? tradeData.value?.data : null,
            security: security.status === 'fulfilled' ? security.value?.data : null,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Get X402 token full intelligence.
     */
    async getX402Intelligence() {
        return this.getTokenIntelligence(config.x402.tokenMint);
    }

    /**
     * Get whale trades (high-volume transactions) for a token.
     */
    async getWhaleTradesV3(tokenAddress, minVolumeUsd = 10000, options = {}) {
        return this.getTradesTokenByVolume(tokenAddress, 'usd', {
            minVolume: minVolumeUsd,
            limit: options.limit || 50,
            ...options,
        });
    }

    /**
     * Get top tokens by market cap, volume, or liquidity.
     */
    async getTopTokens(sortBy = 'market_cap', limit = 20) {
        return this.getTokenList({ sortBy, limit, sortType: 'desc' });
    }

    /**
     * Get recently listed tokens.
     */
    async getRecentlyListed(limit = 20) {
        return this.getTokenNewListing({ limit });
    }

    /**
     * Get complete trader profile.
     */
    async getTraderProfile(walletAddress) {
        const [portfolio, netWorth, pnl, trades] = await Promise.allSettled([
            this.getWalletPortfolio(walletAddress),
            this.getWalletNetWorth(walletAddress),
            this.getWalletPnL(walletAddress),
            this.getTraderTradesSeekByTime(walletAddress, { limit: 50 }),
        ]);

        return {
            portfolio: portfolio.status === 'fulfilled' ? portfolio.value?.data : null,
            netWorth: netWorth.status === 'fulfilled' ? netWorth.value?.data : null,
            pnl: pnl.status === 'fulfilled' ? pnl.value?.data : null,
            recentTrades: trades.status === 'fulfilled' ? trades.value?.data : null,
            wallet: walletAddress,
            timestamp: new Date().toISOString(),
        };
    }
}

module.exports = new BirdeyeV3Client();
