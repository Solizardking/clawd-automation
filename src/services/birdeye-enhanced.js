/**
 * Enhanced Birdeye Service for X402 CLI
 * 
 * Extends the base Birdeye service with:
 * - ASCII chart rendering for OHLCV data
 * - AI-powered trend analysis
 * - Formatted CLI output with colors
 * - Whale tracking
 * - Market sentiment scoring
 * - Token comparison reports
 */

const birdeyeService = require('./birdeye/index');
const config = require('../config/index.js');

// ANSI
const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const fgRGB = (r, g, b) => `${ESC}38;2;${r};${g};${b}m`;

const GREEN = fgRGB(0, 255, 136);
const RED = fgRGB(255, 50, 80);
const YELLOW = fgRGB(255, 200, 0);
const CYAN = fgRGB(0, 200, 255);
const PURPLE = fgRGB(180, 50, 255);
const WHITE = fgRGB(220, 220, 230);

class BirdeyeEnhancedService {
    constructor() {
        this.birdeye = birdeyeService;
    }

    /**
     * Get trending tokens with formatted analysis
     */
    async getTrendingWithAnalysis(limit = 10) {
        try {
            const trending = await this.birdeye.getTrendingTokens('rank', 'asc', limit);

            if (!trending || !trending.data) {
                return { trending: [], message: 'No trending data available' };
            }

            const tokens = trending.data.tokens || trending.data || [];

            // Format for CLI display
            const formatted = tokens.map((token, i) => ({
                rank: i + 1,
                name: token.name || 'Unknown',
                symbol: token.symbol || '???',
                address: token.address,
                price: token.price ? `$${this._formatNumber(token.price)}` : 'N/A',
                priceChange24h: token.priceChange24hPercent ?
                    `${token.priceChange24hPercent >= 0 ? '+' : ''}${token.priceChange24hPercent.toFixed(2)}%` : 'N/A',
                volume24h: token.v24hUSD ? `$${this._formatLargeNumber(token.v24hUSD)}` : 'N/A',
                marketCap: token.mc ? `$${this._formatLargeNumber(token.mc)}` : 'N/A',
                liquidity: token.liquidity ? `$${this._formatLargeNumber(token.liquidity)}` : 'N/A',
            }));

            return {
                trending: formatted,
                count: formatted.length,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            throw new Error(`Trending analysis failed: ${error.message}`);
        }
    }

    /**
     * Get OHLCV data with ASCII chart
     */
    async getOHLCVWithChart(tokenAddress, timeframe = '1h', options = {}) {
        try {
            // Convert timeframe to API format
            const tfMap = {
                '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
                '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W',
            };

            const type = tfMap[timeframe.toLowerCase()] || '1H';
            const now = Math.floor(Date.now() / 1000);
            const periods = {
                '1m': 3600, '5m': 18000, '15m': 54000, '30m': 108000,
                '1H': 86400, '4H': 345600, '1D': 2592000, '1W': 18144000,
            };

            const timeFrom = now - (periods[type] || 86400);

            const ohlcv = await this.birdeye.getOHLCVV3(tokenAddress, type, timeFrom, now, options);

            if (!ohlcv || !ohlcv.data || !ohlcv.data.items || ohlcv.data.items.length === 0) {
                return { error: 'No OHLCV data available', address: tokenAddress };
            }

            const items = ohlcv.data.items;
            const chart = this._renderASCIIChart(items);

            // Calculate stats
            const closes = items.map(i => i.c);
            const highs = items.map(i => i.h);
            const lows = items.map(i => i.l);
            const volumes = items.map(i => i.v);

            return {
                address: tokenAddress,
                timeframe,
                dataPoints: items.length,
                stats: {
                    currentPrice: `$${this._formatNumber(closes[closes.length - 1])}`,
                    high: `$${this._formatNumber(Math.max(...highs))}`,
                    low: `$${this._formatNumber(Math.min(...lows))}`,
                    change: `${((closes[closes.length - 1] / closes[0] - 1) * 100).toFixed(2)}%`,
                    avgVolume: `$${this._formatLargeNumber(volumes.reduce((a, b) => a + b, 0) / volumes.length)}`,
                },
                chart,
            };
        } catch (error) {
            throw new Error(`OHLCV chart failed: ${error.message}`);
        }
    }

    /**
     * Render a simple ASCII price chart
     */
    _renderASCIIChart(items, width = 60, height = 15) {
        const closes = items.map(i => i.c);
        const min = Math.min(...closes);
        const max = Math.max(...closes);
        const range = max - min || 1;

        // Normalize to chart height
        const normalized = closes.map(c => Math.floor(((c - min) / range) * (height - 1)));

        // Downsample if too many points
        let sampled = normalized;
        if (normalized.length > width) {
            sampled = [];
            const step = normalized.length / width;
            for (let i = 0; i < width; i++) {
                sampled.push(normalized[Math.floor(i * step)]);
            }
        }

        // Build chart rows
        const lines = [];
        lines.push(`  ${DIM}$${this._formatNumber(max).padStart(12)}${RESET} ┐`);

        for (let row = height - 1; row >= 0; row--) {
            let line = '  ' + ' '.repeat(13) + '│';
            for (let col = 0; col < sampled.length; col++) {
                if (sampled[col] === row) {
                    // Determine color based on trend
                    const prevVal = col > 0 ? sampled[col - 1] : sampled[col];
                    if (sampled[col] >= prevVal) {
                        line += `${GREEN}█${RESET}`;
                    } else {
                        line += `${RED}█${RESET}`;
                    }
                } else if (sampled[col] > row) {
                    // Fill below the line
                    const prevVal = col > 0 ? sampled[col - 1] : sampled[col];
                    if (sampled[col] >= prevVal) {
                        line += `${fgRGB(0, 80, 40)}░${RESET}`;
                    } else {
                        line += `${fgRGB(80, 20, 30)}░${RESET}`;
                    }
                } else {
                    line += ' ';
                }
            }
            lines.push(line);
        }

        lines.push(`  ${DIM}$${this._formatNumber(min).padStart(12)}${RESET} ┘` + `${DIM}${'─'.repeat(sampled.length)}${RESET}`);
        lines.push(`  ${' '.repeat(14)}${DIM}${items.length} candles${RESET}`);

        return lines.join('\n');
    }

    /**
     * Market sentiment analysis
     */
    async getMarketSentiment(tokenAddress) {
        try {
            const [overview, marketData] = await Promise.all([
                this.birdeye.getTokenOverview(tokenAddress).catch(() => null),
                this.birdeye.getTokenMarketData(tokenAddress).catch(() => null),
            ]);

            const data = overview?.data || marketData?.data || {};

            // Calculate sentiment score (0-100)
            let score = 50; // Neutral baseline

            if (data.priceChange24hPercent) {
                score += Math.min(20, Math.max(-20, data.priceChange24hPercent * 2));
            }
            if (data.v24hChangePercent) {
                score += Math.min(10, Math.max(-10, data.v24hChangePercent / 10));
            }
            if (data.uniqueWallet24h && data.uniqueWallet24hChangePercent) {
                score += Math.min(10, Math.max(-10, data.uniqueWallet24hChangePercent / 5));
            }

            score = Math.max(0, Math.min(100, Math.round(score)));

            let sentiment;
            if (score >= 80) sentiment = { label: 'EXTREME GREED', emoji: '🚀', color: 'green' };
            else if (score >= 60) sentiment = { label: 'GREED', emoji: '📈', color: 'lime' };
            else if (score >= 45) sentiment = { label: 'NEUTRAL', emoji: '😐', color: 'yellow' };
            else if (score >= 25) sentiment = { label: 'FEAR', emoji: '📉', color: 'orange' };
            else sentiment = { label: 'EXTREME FEAR', emoji: '💀', color: 'red' };

            return {
                address: tokenAddress,
                score,
                sentiment: sentiment.label,
                emoji: sentiment.emoji,
                metrics: {
                    priceChange24h: data.priceChange24hPercent || 0,
                    volumeChange24h: data.v24hChangePercent || 0,
                    walletChange24h: data.uniqueWallet24hChangePercent || 0,
                },
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            throw new Error(`Sentiment analysis failed: ${error.message}`);
        }
    }

    /**
     * Whale alert - large transactions
     */
    async getWhaleAlerts(tokenAddress, minUSD = 10000) {
        try {
            const trades = await this.birdeye.getTokenTradesV3(tokenAddress, { limit: 100 });

            if (!trades || !trades.data || !trades.data.items) {
                return { alerts: [], message: 'No trade data available' };
            }

            const whales = trades.data.items
                .filter(t => (t.volumeUsd || t.volume_usd || 0) >= minUSD)
                .map(t => ({
                    type: t.side || t.type || 'unknown',
                    amount: `$${this._formatLargeNumber(t.volumeUsd || t.volume_usd || 0)}`,
                    price: t.price ? `$${this._formatNumber(t.price)}` : 'N/A',
                    timestamp: t.blockUnixTime ? new Date(t.blockUnixTime * 1000).toISOString() : 'N/A',
                    txHash: t.txHash || t.tx_hash || 'unknown',
                }));

            return {
                address: tokenAddress,
                minUSD: `$${this._formatLargeNumber(minUSD)}`,
                whaleCount: whales.length,
                alerts: whales.slice(0, 20),
            };
        } catch (error) {
            throw new Error(`Whale alerts failed: ${error.message}`);
        }
    }

    /**
     * Format number for display
     */
    _formatNumber(n) {
        if (n === null || n === undefined) return '0';
        const num = parseFloat(n);
        if (isNaN(num)) return '0';

        if (num < 0.00001) return num.toExponential(4);
        if (num < 0.01) return num.toFixed(8);
        if (num < 1) return num.toFixed(6);
        if (num < 1000) return num.toFixed(4);
        return num.toFixed(2);
    }

    /**
     * Format large numbers (1.2M, 3.5B, etc.)
     */
    _formatLargeNumber(n) {
        const num = parseFloat(n);
        if (isNaN(num)) return '0';

        if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toFixed(2);
    }
}

module.exports = new BirdeyeEnhancedService();
