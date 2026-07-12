/**
 * X402 CLI Commands Registry
 * 
 * Comprehensive command set covering ALL Birdeye V3 APIs,
 * AI Chat, Image Gen, Solana, Wallet & more.
 */

const path = require('path');

// ═══════════════════════════════════════════
// ANSI
// ═══════════════════════════════════════════
const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const fgRGB = (r, g, b) => `${ESC}38;2;${r};${g};${b}m`;

const SOLANA_GRAD = [
    fgRGB(0, 255, 163),
    fgRGB(50, 200, 200),
    fgRGB(100, 150, 240),
    fgRGB(150, 100, 255),
    fgRGB(180, 50, 255),
];

function gradientText(text, palette) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const ci = Math.floor((i / text.length) * palette.length);
        result += palette[Math.min(ci, palette.length - 1)] + text[i];
    }
    return result + RESET;
}

// ═══════════════════════════════════════════
// Lazy-loaded Services (only load when needed)
// ═══════════════════════════════════════════
let _config, _birdeyeService, _unifiedAI, _geminiImage, _portfolioService,
    _jupiterService, _solanaService, _x402SPLService, _pumpFunService,
    _agentCouncil, _investmentCouncil, _birdeyeEnhanced, _skillhub, _constitution,
    _personas, _knowledge;

function getConfig() { return _config || (_config = require('../../config/index.js')); }
function getBirdeye() { return _birdeyeService || (_birdeyeService = require('../../services/birdeye')); }
function getUnifiedAI() { return _unifiedAI || (_unifiedAI = require('../../providers/unified-ai')); }
function getGeminiImage() { return _geminiImage || (_geminiImage = require('../../services/gemini-image')); }
function getPortfolio() { return _portfolioService || (_portfolioService = require('../../services/portfolio')); }
function getJupiter() { return _jupiterService || (_jupiterService = require('../../services/jupiter')); }
function getSolana() { return _solanaService || (_solanaService = require('../../services/solana/connection')); }
function getX402SPL() { return _x402SPLService || (_x402SPLService = require('../../services/x402-spl-token')); }
function getPumpFun() { return _pumpFunService || (_pumpFunService = require('../../services/pumpfun')); }
function getCouncil() { return _agentCouncil || (_agentCouncil = require('../../agents/agent-council')); }
function getInvestmentCouncil() { return _investmentCouncil || (_investmentCouncil = require('../../agents/google-a2a/investment-council')); }
function getBirdeyeEnhanced() { return _birdeyeEnhanced || (_birdeyeEnhanced = require('../../services/birdeye-enhanced')); }
function getSkillhub() { return _skillhub || (_skillhub = require('../../services/skillhub')); }
function getConstitution() { return _constitution || (_constitution = require('../../services/constitution')); }
function getPersonas() { return _personas || (_personas = require('../../services/personas')); }
function getKnowledge() { return _knowledge || (_knowledge = require('../../knowledge/clawdbrowser')); }

// ═══════════════════════════════════════════
// Command Registry
// ═══════════════════════════════════════════
const commands = {

    // ─── AI Chat ─────────────────────────────
    ask: {
        description: 'Ask the X402 AI agent anything',
        usage: 'ask <question>',
        category: 'ai',
        async execute(args) {
            const question = args.join(' ');
            if (!question) throw new Error('Please provide a question');
            const ai = getUnifiedAI();
            return await ai.answerX402Question(question);
        }
    },

    chat: {
        description: 'Start a chat session with AI',
        usage: 'chat <message>',
        category: 'ai',
        async execute(args) {
            const message = args.join(' ');
            if (!message) throw new Error('Please provide a message');
            const ai = getUnifiedAI();
            return await ai.route('general', { prompt: message });
        }
    },

    think: {
        description: 'Deep thinking mode (best reasoning model)',
        usage: 'think <complex question>',
        category: 'ai',
        async execute(args) {
            const prompt = args.join(' ');
            if (!prompt) throw new Error('Please provide a question');
            const ai = getUnifiedAI();
            return await ai.deepThinkingTask(prompt);
        }
    },

    code: {
        description: 'Generate code with AI',
        usage: 'code <description>',
        category: 'ai',
        async execute(args) {
            const prompt = args.join(' ');
            if (!prompt) throw new Error('Please describe what code you want');
            const ai = getUnifiedAI();
            return await ai.codeTask(prompt);
        }
    },

    // ─── Nano Banana (Gemini Image Gen) ──────
    image: {
        description: 'Generate an image with Nano Banana (Gemini)',
        usage: 'image <prompt>',
        category: 'image',
        async execute(args) {
            const prompt = args.join(' ');
            if (!prompt) throw new Error('Please provide an image prompt');
            const gemini = getGeminiImage();
            return await gemini.generateImage(prompt);
        }
    },

    banana: {
        description: 'Nano Banana Pro - premium image generation',
        usage: 'banana <prompt>',
        category: 'image',
        async execute(args) {
            const prompt = args.join(' ');
            if (!prompt) throw new Error('Please provide a prompt');
            const gemini = getGeminiImage();
            return await gemini.generateImagePro(prompt);
        }
    },

    sticker: {
        description: 'Generate a kawaii sticker/icon',
        usage: 'sticker <subject>',
        category: 'image',
        async execute(args) {
            const subject = args.join(' ');
            if (!subject) throw new Error('Please describe the sticker');
            const gemini = getGeminiImage();
            return await gemini.generateSticker(subject);
        }
    },

    logo: {
        description: 'Generate a professional logo',
        usage: 'logo <brand> [description]',
        category: 'image',
        async execute(args) {
            if (!args[0]) throw new Error('Usage: logo <brand> [description]');
            const gemini = getGeminiImage();
            return await gemini.generateLogo(args[0], args.slice(1).join(' '));
        }
    },

    weather: {
        description: 'Generate weather visualization',
        usage: 'weather <city>',
        category: 'image',
        async execute(args) {
            const city = args.join(' ') || 'San Francisco';
            const gemini = getGeminiImage();
            return await gemini.generateWeatherViz(city);
        }
    },

    article: {
        description: 'Generate visual article/infographic',
        usage: 'article <topic>',
        category: 'image',
        async execute(args) {
            const topic = args.join(' ');
            if (!topic) throw new Error('Please provide a topic');
            const gemini = getGeminiImage();
            return await gemini.generateArticle(topic);
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  BIRDEYE V3 - STATS
    // ═══════════════════════════════════════════════════════════════

    price: {
        description: 'Get token price',
        usage: 'price <token_address>',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getPrice(args[0]);
        }
    },

    overview: {
        description: 'Token overview (price, volume, wallets across timeframes)',
        usage: 'overview <token_address> [frames]',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getTokenOverview(args[0], { frames: args[1] });
        }
    },

    metadata: {
        description: 'Token metadata (name, symbol, decimals, logo, extensions)',
        usage: 'metadata <token_address>',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getTokenMetadata(args[0]);
        }
    },

    'meta-multi': {
        description: 'Metadata for multiple tokens (max 50)',
        usage: 'meta-multi <addr1,addr2,...>',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Provide comma-separated addresses');
            const birdeye = getBirdeye();
            return await birdeye.getTokenMetadataMultiple(args[0]);
        }
    },

    market: {
        description: 'Token market data (price, liquidity, supply, mcap, FDV, holders)',
        usage: 'market <token_address>',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getTokenMarketData(args[0]);
        }
    },

    'market-multi': {
        description: 'Market data for multiple tokens (max 20)',
        usage: 'market-multi <addr1,addr2,...>',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Provide comma-separated addresses');
            const birdeye = getBirdeye();
            return await birdeye.getTokenMarketDataMultiple(args[0]);
        }
    },

    tradedata: {
        description: 'Token trade data (buys/sells/volume/wallets by timeframe)',
        usage: 'tradedata <token_address> [frames]',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getTokenTradeData(args[0], { frames: args[1] });
        }
    },

    'tradedata-multi': {
        description: 'Trade data for multiple tokens (max 20)',
        usage: 'tradedata-multi <addr1,addr2,...> [frames]',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Provide comma-separated addresses');
            const birdeye = getBirdeye();
            return await birdeye.getTokenTradeDataMultiple(args[0], { frames: args[1] });
        }
    },

    liquidity: {
        description: 'Token exit liquidity (real liquidity check)',
        usage: 'liquidity <token_address> [chain]',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getTokenLiquidity(args[0], { chain: args[1] || 'solana' });
        }
    },

    'liquidity-multi': {
        description: 'Exit liquidity for multiple tokens (max 50)',
        usage: 'liquidity-multi <addr1,addr2,...>',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Provide comma-separated addresses');
            const birdeye = getBirdeye();
            return await birdeye.getTokenLiquidityMultiple(args[0]);
        }
    },

    pair: {
        description: 'Pair overview (base/quote, liquidity, volume, trades)',
        usage: 'pair <pair_address>',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a pair address');
            const birdeye = getBirdeye();
            return await birdeye.getPairOverview(args[0]);
        }
    },

    'pair-multi': {
        description: 'Pair overview for multiple pairs (max 20)',
        usage: 'pair-multi <pair1,pair2,...>',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Provide comma-separated pair addresses');
            const birdeye = getBirdeye();
            return await birdeye.getPairOverviewMultiple(args[0]);
        }
    },

    pricestats: {
        description: 'Price stats (current, high/low, % change by timeframe)',
        usage: 'pricestats <token_address> [timeframes]',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getPriceStats(args[0], { listTimeframe: args[1] || '1m,5m,30m,1h,24h,7d' });
        }
    },

    'pricestats-multi': {
        description: 'Price stats for multiple tokens (max 20)',
        usage: 'pricestats-multi <addr1,addr2,...> [timeframes]',
        category: 'birdeye',
        async execute(args) {
            if (!args[0]) throw new Error('Provide comma-separated addresses');
            const birdeye = getBirdeye();
            return await birdeye.getPriceStatsMultiple(args[0], { listTimeframe: args[1] || '1h,24h,7d' });
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  BIRDEYE V3 - TOKEN/MARKET LIST
    // ═══════════════════════════════════════════════════════════════

    'token-list': {
        description: 'List tokens with filters (sort by liquidity, mcap, volume)',
        usage: 'token-list [sortBy] [limit]',
        category: 'birdeye-list',
        async execute(args) {
            const birdeye = getBirdeye();
            return await birdeye.getTokenList({
                sortBy: args[0] || 'liquidity',
                limit: parseInt(args[1]) || 20,
            });
        }
    },

    'top-volume': {
        description: 'Top tokens by 24h trading volume',
        usage: 'top-volume [limit]',
        category: 'birdeye-list',
        async execute(args) {
            const birdeye = getBirdeye();
            return await birdeye.getTokenList({
                sortBy: 'volume_24h_usd',
                limit: parseInt(args[0]) || 20,
            });
        }
    },

    'top-gainers': {
        description: 'Top price gainers (24h)',
        usage: 'top-gainers [limit]',
        category: 'birdeye-list',
        async execute(args) {
            const birdeye = getBirdeye();
            return await birdeye.getTokenList({
                sortBy: 'price_change_24h_percent',
                sortType: 'desc',
                limit: parseInt(args[0]) || 20,
            });
        }
    },

    'new-listings': {
        description: 'Recently listed tokens',
        usage: 'new-listings [limit]',
        category: 'birdeye-list',
        async execute(args) {
            const birdeye = getBirdeye();
            return await birdeye.getNewListings({ limit: parseInt(args[0]) || 20 });
        }
    },

    'token-markets': {
        description: 'All markets/pairs for a token',
        usage: 'token-markets <token_address>',
        category: 'birdeye-list',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getTokenMarketList(args[0]);
        }
    },

    trending: {
        description: 'Show trending tokens with analysis',
        usage: 'trending [limit]',
        category: 'birdeye-list',
        async execute(args) {
            const limit = parseInt(args[0]) || 10;
            const enhanced = getBirdeyeEnhanced();
            return await enhanced.getTrendingWithAnalysis(limit);
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  BIRDEYE V3 - TRANSACTIONS
    // ═══════════════════════════════════════════════════════════════

    trades: {
        description: 'Recent trades for a token (V3)',
        usage: 'trades <token_address> [limit] [type]',
        category: 'birdeye-txs',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getTokenTradesV3(args[0], {
                limit: parseInt(args[1]) || 20,
                txType: args[2] || 'swap',
            });
        }
    },

    'trades-all': {
        description: 'All trades across all tokens (V3)',
        usage: 'trades-all [limit] [type]',
        category: 'birdeye-txs',
        async execute(args) {
            const birdeye = getBirdeye();
            return await birdeye.getAllTradesV3({
                limit: parseInt(args[0]) || 20,
                txType: args[1] || 'swap',
            });
        }
    },

    'trades-pair': {
        description: 'Trades for a specific pair',
        usage: 'trades-pair <pair_address> [limit]',
        category: 'birdeye-txs',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a pair address');
            const birdeye = getBirdeye();
            return await birdeye.getPairTrades(args[0], {
                limit: parseInt(args[1]) || 20,
            });
        }
    },

    'trader-txs': {
        description: 'A trader/wallet\'s recent transactions',
        usage: 'trader-txs <wallet_address> [limit]',
        category: 'birdeye-txs',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a wallet address');
            const birdeye = getBirdeye();
            return await birdeye.getTraderTrades(args[0], {
                limit: parseInt(args[1]) || 20,
            });
        }
    },

    whales: {
        description: 'Whale trades (filtered by volume USD)',
        usage: 'whales <token_address> [min_usd]',
        category: 'birdeye-txs',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getWhaleTradesV3(args[0], parseFloat(args[1]) || 10000);
        }
    },

    'mint-burn': {
        description: 'Token mint/burn transactions',
        usage: 'mint-burn <token_address> [limit]',
        category: 'birdeye-txs',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getTokenMintBurn(args[0], {
                limit: parseInt(args[1]) || 20,
            });
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  BIRDEYE V3 - WALLET, NETWORTH & PNL
    // ═══════════════════════════════════════════════════════════════

    wallet: {
        description: 'Wallet token portfolio (all balances)',
        usage: 'wallet <wallet_address>',
        category: 'wallet',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a wallet address');
            const birdeye = getBirdeye();
            return await birdeye.getWalletPortfolio(args[0]);
        }
    },

    networth: {
        description: 'Wallet net worth in USD',
        usage: 'networth <wallet_address>',
        category: 'wallet',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a wallet address');
            const birdeye = getBirdeye();
            return await birdeye.getWalletNetWorth(args[0]);
        }
    },

    pnl: {
        description: 'Wallet profit & loss',
        usage: 'pnl <wallet_address>',
        category: 'wallet',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a wallet address');
            const birdeye = getBirdeye();
            return await birdeye.getWalletPnL(args[0]);
        }
    },

    'wallet-balance': {
        description: 'Check specific token balance in a wallet',
        usage: 'wallet-balance <wallet_address> <token_address>',
        category: 'wallet',
        async execute(args) {
            if (!args[0] || !args[1]) throw new Error('Usage: wallet-balance <wallet> <token>');
            const birdeye = getBirdeye();
            return await birdeye.getWalletTokenBalance(args[0], args[1]);
        }
    },

    'trader-profile': {
        description: 'Complete trader profile (portfolio + PnL + trades)',
        usage: 'trader-profile <wallet_address>',
        category: 'wallet',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a wallet address');
            const birdeye = getBirdeye();
            return await birdeye.getTraderProfile(args[0]);
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  BIRDEYE V3 - HOLDER, SECURITY, SEARCH
    // ═══════════════════════════════════════════════════════════════

    holders: {
        description: 'Top token holders',
        usage: 'holders <token_address> [limit]',
        category: 'birdeye-extra',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getTokenHolders(args[0], {
                limit: parseInt(args[1]) || 20,
            });
        }
    },

    security: {
        description: 'Token security audit (ownership, freeze authority)',
        usage: 'security <token_address>',
        category: 'birdeye-extra',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getTokenSecurity(args[0]);
        }
    },

    search: {
        description: 'Search tokens by keyword (Birdeye)',
        usage: 'search <keyword>',
        category: 'birdeye-extra',
        async execute(args) {
            const keyword = args.join(' ');
            if (!keyword) throw new Error('Please provide a search keyword');
            const birdeye = getBirdeye();
            return await birdeye.searchTokens(keyword);
        }
    },

    creation: {
        description: 'Token creation info (deployer, time)',
        usage: 'creation <token_address>',
        category: 'birdeye-extra',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getTokenCreationInfo(args[0]);
        }
    },

    meme: {
        description: 'Comprehensive meme token data',
        usage: 'meme <token_address>',
        category: 'birdeye-extra',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getComprehensiveMemeData(args[0]);
        }
    },

    networks: {
        description: 'List all supported Birdeye networks',
        usage: 'networks',
        category: 'birdeye-extra',
        async execute() {
            const birdeye = getBirdeye();
            return await birdeye.getNetworkList();
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  BIRDEYE - OHLCV & CHARTS
    // ═══════════════════════════════════════════════════════════════

    ohlcv: {
        description: 'OHLCV chart with ASCII visualization',
        usage: 'ohlcv <token_address> [timeframe]',
        category: 'birdeye-chart',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const enhanced = getBirdeyeEnhanced();
            return await enhanced.getOHLCVWithChart(args[0], args[1] || '1h');
        }
    },

    sentiment: {
        description: 'Market sentiment analysis (fear/greed score)',
        usage: 'sentiment <token_address>',
        category: 'birdeye-chart',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const enhanced = getBirdeyeEnhanced();
            return await enhanced.getMarketSentiment(args[0]);
        }
    },

    'whale-alerts': {
        description: 'Large transaction alerts',
        usage: 'whale-alerts <token_address> [min_usd]',
        category: 'birdeye-chart',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const enhanced = getBirdeyeEnhanced();
            return await enhanced.getWhaleAlerts(args[0], parseFloat(args[1]) || 10000);
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  BIRDEYE - TOKEN INTELLIGENCE
    // ═══════════════════════════════════════════════════════════════

    intel: {
        description: 'Full token intelligence (metadata + market + trade + security)',
        usage: 'intel <token_address>',
        category: 'birdeye-intel',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token address');
            const birdeye = getBirdeye();
            return await birdeye.getTokenIntelligence(args[0]);
        }
    },

    compare: {
        description: 'Compare multiple tokens',
        usage: 'compare <addr1> <addr2> [addr3...]',
        category: 'birdeye-intel',
        async execute(args) {
            if (args.length < 2) throw new Error('Provide at least 2 token addresses');
            const birdeye = getBirdeye();
            return await birdeye.compareTokens(args);
        }
    },

    analytics: {
        description: 'Deep X402 token analytics',
        usage: 'analytics',
        category: 'birdeye-intel',
        async execute() {
            const birdeye = getBirdeye();
            return await birdeye.getX402Analytics();
        }
    },

    'x402-intel': {
        description: 'Full X402 token intelligence report',
        usage: 'x402-intel',
        category: 'birdeye-intel',
        async execute() {
            const birdeye = getBirdeye();
            return await birdeye.getX402Intelligence();
        }
    },

    // ─── Solana & Portfolio ──────────────────
    balance: {
        description: 'Get SOL balance for an address',
        usage: 'balance <address>',
        category: 'solana',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a wallet address');
            const solana = getSolana();
            const balance = await solana.getBalance(args[0]);
            return { address: args[0], balance };
        }
    },

    tokens: {
        description: 'Get token accounts for wallet',
        usage: 'tokens <address>',
        category: 'solana',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a wallet address');
            const solana = getSolana();
            const tokens = await solana.getTokenAccounts(args[0]);
            return { address: args[0], tokens };
        }
    },

    portfolio: {
        description: 'Get full portfolio analysis',
        usage: 'portfolio <address>',
        category: 'solana',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a wallet address');
            const portfolio = getPortfolio();
            return await portfolio.getPortfolio(args[0]);
        }
    },

    // ─── X402 Token ──────────────────────────
    supply: {
        description: 'X402 token supply info',
        usage: 'supply',
        category: 'x402',
        async execute() {
            const spl = getX402SPL();
            return await spl.getSupplyInfo();
        }
    },

    // ─── Trading ─────────────────────────────
    trade: {
        description: 'Get swap quote via Jupiter',
        usage: 'trade <from_token> <to_token> <amount>',
        category: 'trading',
        async execute(args) {
            if (args.length < 3) throw new Error('Usage: trade <from> <to> <amount>');
            const jupiter = getJupiter();
            return await jupiter.getQuote(args[0], args[1], args[2]);
        }
    },

    // ─── Agent Council ───────────────────────
    council: {
        description: 'Run AI agent council task',
        usage: 'council <task> [params...]',
        category: 'agents',
        async execute(args) {
            const task = args[0];
            if (!task) throw new Error('Please specify a task');
            const council = getCouncil();
            return await council.routeTask(task, { input: args.slice(1).join(' ') });
        }
    },

    invest: {
        description: 'Investment council analysis',
        usage: 'invest <token_address>',
        category: 'agents',
        async execute(args) {
            if (!args[0]) throw new Error('Please provide a token to analyze');
            const council = getInvestmentCouncil();
            return await council.analyzeInvestment({ tokenAddress: args[0] });
        }
    },

    // ─── Clawd Constitution ──────────────────
    laws: {
        description: 'Show the six-law harness (or three on-chain laws)',
        usage: 'laws [three|six]',
        category: 'constitution',
        async execute(args) {
            const which = (args[0] || 'six').toLowerCase();
            const id = which === 'three' || which === '3' ? 'three-laws' : 'six-laws';
            const doc = getConstitution().readDocument(id);
            return {
                id: doc.id,
                title: doc.title,
                sha256: doc.sha256,
                lines: doc.lines,
                markdown: doc.markdown
            };
        }
    },

    soul: {
        description: 'Show Clawd SOUL.md character document',
        usage: 'soul',
        category: 'constitution',
        async execute() {
            const doc = getConstitution().readDocument('soul');
            return { id: doc.id, sha256: doc.sha256, markdown: doc.markdown };
        }
    },

    identity: {
        description: 'Show Clawd IDENTITY.md',
        usage: 'identity',
        category: 'constitution',
        async execute() {
            const doc = getConstitution().readDocument('identity');
            return { id: doc.id, sha256: doc.sha256, markdown: doc.markdown };
        }
    },

    constitution: {
        description: 'Constitution manifest or full document by id',
        usage: 'constitution [id]',
        category: 'constitution',
        async execute(args) {
            if (!args[0]) return getConstitution().getManifest();
            const doc = getConstitution().readDocument(args[0]);
            return {
                id: doc.id,
                title: doc.title,
                layer: doc.layer,
                sha256: doc.sha256,
                markdown: doc.markdown
            };
        }
    },

    strategy: {
        description: 'Show active strategy.md + research program.md',
        usage: 'strategy [program]',
        category: 'constitution',
        async execute(args) {
            if ((args[0] || '').toLowerCase() === 'program') {
                const doc = getConstitution().readDocument('program');
                return { id: doc.id, sha256: doc.sha256, markdown: doc.markdown };
            }
            const doc = getConstitution().readDocument('strategy');
            return { id: doc.id, sha256: doc.sha256, markdown: doc.markdown };
        }
    },

    // ─── Skill Hub (skills.x402.wtf) ─────────
    'skills-hub': {
        description: 'Skill hub manifest (count, categories, install paths)',
        usage: 'skills-hub',
        category: 'skills',
        async execute() {
            return getSkillhub().getManifest();
        }
    },

    'skills-list': {
        description: 'List or search installable agent skills',
        usage: 'skills-list [query] [limit]',
        category: 'skills',
        async execute(args) {
            const query = args[0] || '';
            const limit = Number(args[1]) || 30;
            if (!query) {
                const m = getSkillhub().getManifest();
                return {
                    skillCount: m.skillCount,
                    categories: m.categories,
                    sample: getSkillhub().searchSkills('', { limit: 15 }),
                    hint: 'skills-list magicblock 20  ·  skills install solana-dev'
                };
            }
            return getSkillhub().searchSkills(query, { limit });
        }
    },

    'skills-show': {
        description: 'Show SKILL.md for a catalog slug',
        usage: 'skills-show <slug>',
        category: 'skills',
        async execute(args) {
            if (!args[0]) throw new Error('Usage: skills-show solana-dev');
            const { skill, path: skillPath, markdown } = getSkillhub().readSkillMarkdown(args[0]);
            return {
                ...skill,
                path: skillPath,
                preview: markdown.slice(0, 2500),
                chars: markdown.length
            };
        }
    },

    'skills-install': {
        description: 'Install skill(s) into an agent skills root via skillhub CLI',
        usage: 'skills-install <slug...> [--claude|--codex|--force]',
        category: 'skills',
        async execute(args) {
            if (!args.length) throw new Error('Usage: skills-install solana-dev magicblock --force');
            const result = getSkillhub().runSkillsCli(['install', ...args]);
            return {
                status: result.status,
                stdout: result.stdout.slice(0, 4000),
                stderr: result.stderr.slice(0, 1000),
                error: result.error
            };
        }
    },

    // ─── Hedge Personas ─────────────────────
    personas: {
        description: 'List all hedge personas or show one by id',
        usage: 'personas [id]',
        category: 'personas',
        async execute(args) {
            const personas = getPersonas();
            if (!args[0]) return personas.getManifest();
            return personas.loadPersona(args[0]);
        }
    },

    persona: {
        description: 'Show a single persona\'s full profile',
        usage: 'persona <id>',
        category: 'personas',
        async execute(args) {
            if (!args[0]) throw new Error('Usage: persona valueclaw');
            return getPersonas().loadPersona(args[0]);
        }
    },

    hedge: {
        description: 'Get hedge council prompt (all personas combined)',
        usage: 'hedge [query]',
        category: 'personas',
        async execute(args) {
            const personas = getPersonas();
            if (!args[0]) return { prompt: personas.getAllPersonaPrompts() };
            const selected = personas.selectPersona(args.join(' '));
            return {
                matched: selected ? selected.id : null,
                prompt: selected
                    ? personas.getPersonaPrompt(selected.id)
                    : personas.getAllPersonaPrompts()
            };
        }
    },

    // ─── Knowledge Base ──────────────────────
    knowledge: {
        description: 'Knowledge base manifest or search facts',
        usage: 'knowledge [search <query> | doc <id> | tag <tag>]',
        category: 'knowledge',
        async execute(args) {
            const kb = getKnowledge();
            if (!args[0]) return kb.getManifest();
            const sub = args[0];
            if (sub === 'search' && args[1]) {
                return kb.searchFacts(args.slice(1).join(' '));
            }
            if (sub === 'doc' && args[1]) {
                return kb.getDoc(args[1], { maxChars: 5000 });
            }
            if (sub === 'tag' && args[1]) {
                return kb.getByTag(args[1]);
            }
            if (sub === 'context') {
                return { context: kb.getPromptContext() };
            }
            return kb.getManifest();
        }
    },

    kb: {
        description: 'Alias for knowledge',
        usage: 'kb [search <query> | doc <id> | tag <tag>]',
        category: 'knowledge',
        async execute(args) {
            return commands.knowledge.execute(args);
        }
    },

    facts: {
        description: 'Search knowledge facts by query',
        usage: 'facts <query> [limit]',
        category: 'knowledge',
        async execute(args) {
            if (!args[0]) throw new Error('Usage: facts solana 10');
            const kb = getKnowledge();
            return kb.searchFacts(args[0], { limit: parseInt(args[1]) || 20 });
        }
    },

    // ─── System ──────────────────────────────
    status: {
        description: 'Show system status and connected services',
        usage: 'status',
        category: 'system',
        async execute() {
            const config = getConfig();
            let skillhub = null;
            try {
                skillhub = getSkillhub().getManifest();
            } catch (e) {
                skillhub = { error: e.message };
            }
            return {
                version: '2.0.0',
                node: process.version,
                platform: process.platform,
                uptime: Math.floor(process.uptime()) + 's',
                memory: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
                providers: {
                    google: !!config.google?.apiKey ? '✓ Connected' : '✗ Missing key',
                    openai: !!config.openai?.apiKey ? '✓ Connected' : '✗ Missing key',
                    anthropic: !!config.anthropic?.apiKey ? '✓ Connected' : '✗ Missing key',
                    xai: !!config.xai?.apiKey ? '✓ Connected' : '✗ Missing key',
                    birdeye: !!config.birdeye?.apiKey ? '✓ Connected' : '✗ Missing key',
                    solana: !!config.solana?.rpcUrl ? '✓ Connected' : '✗ Missing RPC',
                    jupiter: !!config.jupiter?.apiKey ? '✓ Connected' : '✗ Missing key',
                },
                x402: {
                    tokenMint: config.x402?.tokenMint,
                    agentWallet: config.x402?.agentWallet,
                },
                skillhub: skillhub && !skillhub.error
                    ? { skillCount: skillhub.skillCount, hub: skillhub.hub }
                    : skillhub,
                bundles: {
                    personas: (() => { try { return getPersonas().getManifest().present + '/5'; } catch { return 'missing'; } })(),
                    knowledge: (() => { try { return getKnowledge().getSummary(); } catch { return 'missing'; } })(),
                },
            };
        }
    },

    config: {
        description: 'Show current configuration (redacted)',
        usage: 'config',
        category: 'system',
        async execute() {
            const config = getConfig();
            const redact = (key) => key ? '***' + key.slice(-6) : 'NOT SET';
            return {
                providers: {
                    google: redact(config.google?.apiKey),
                    openai: redact(config.openai?.apiKey),
                    anthropic: redact(config.anthropic?.apiKey),
                    birdeye: redact(config.birdeye?.apiKey),
                },
                solana: {
                    rpc: config.solana?.rpcUrl ? config.solana.rpcUrl.split('?')[0] + '...' : 'NOT SET'
                },
                x402: config.x402
            };
        }
    },

    env: {
        description: 'Check environment variable status',
        usage: 'env',
        category: 'system',
        async execute() {
            const keys = [
                'GOOGLE_API_KEY', 'BIRDEYE_API_KEY', 'OPENAI_API_KEY',
                'ANTHROPIC_API_KEY', 'XAI_API_KEY', 'SOLANA_RPC_URL',
                'HELIUS_RPC_URL', 'CLOUDFLARE_API_TOKEN', 'JUPITER_API_KEY',
                'FAL_API_KEY', 'PERPLEXITY_API_KEY', 'X402_TOKEN_MINT',
            ];
            const status = {};
            for (const key of keys) {
                status[key] = process.env[key] ? '✓ Set' : '✗ Missing';
            }
            return status;
        }
    },

    server: {
        description: 'Start the HTTP API server',
        usage: 'server [port]',
        category: 'system',
        async execute(args) {
            const port = args[0] || process.env.PORT || 3000;
            process.env.PORT = port;
            console.log(`\n  ${fgRGB(0, 255, 136)}▸${RESET} Starting X402 API server on port ${BOLD}${port}${RESET}...`);
            require('../../index.js');
            return `Server running on http://localhost:${port}`;
        }
    },
};

// ═══════════════════════════════════════════
// Command Execution
// ═══════════════════════════════════════════
async function executeCommand(command, args = [], flags = {}) {
    const cmd = commands[command];

    if (!cmd) {
        // Fallback: send to AI chat
        const ai = getUnifiedAI();
        const result = await ai.answerX402Question([command, ...args].join(' '));
        return result;
    }

    return cmd.execute(args, flags);
}

// ═══════════════════════════════════════════
// Help Text Generator
// ═══════════════════════════════════════════
function getCommandHelp() {
    const categories = {
        '🧠 AI & Chat': { filter: 'ai' },
        '🍌 Nano Banana (Image Gen)': { filter: 'image' },
        '📊 Token Stats (Birdeye V3)': { filter: 'birdeye' },
        '📋 Token & Market Lists': { filter: 'birdeye-list' },
        '💹 Transactions & Trades': { filter: 'birdeye-txs' },
        '📈 Charts & Sentiment': { filter: 'birdeye-chart' },
        '🔍 Intelligence & Analytics': { filter: 'birdeye-intel' },
        '🔒 Security, Holders & Search': { filter: 'birdeye-extra' },
        '👛 Wallet, Networth & PnL': { filter: 'wallet' },
        '💰 Solana & Portfolio': { filter: 'solana' },
        '🪙 X402 Token': { filter: 'x402' },
        '🔄 Trading': { filter: 'trading' },
        '🤖 Agent Council': { filter: 'agents' },
        '📚 Skill Hub': { filter: 'skills' },
        '🦞 Clawd Constitution': { filter: 'constitution' },
        '🦞 Hedge Personas': { filter: 'personas' },
        '🧠 Knowledge Base': { filter: 'knowledge' },
        '⚙️  System': { filter: 'system' },
    };

    let help = `\n  ${gradientText('X402 Agent Commands', SOLANA_GRAD)}\n`;
    help += `  ${DIM}${'─'.repeat(55)}${RESET}\n`;

    for (const [label, { filter }] of Object.entries(categories)) {
        const cmds = Object.entries(commands).filter(([, c]) => c.category === filter);
        if (cmds.length === 0) continue;

        help += `\n  ${BOLD}${label}${RESET}\n`;
        for (const [name, cmd] of cmds) {
            help += `    ${fgRGB(0, 255, 163)}${name.padEnd(18)}${RESET} ${DIM}${cmd.description}${RESET}\n`;
            help += `    ${' '.repeat(18)} ${fgRGB(80, 80, 100)}${cmd.usage}${RESET}\n`;
        }
    }

    help += `\n  ${DIM}Built-in: ${RESET}clear${DIM}, ${RESET}exit${DIM}, ${RESET}history${DIM}, ${RESET}help`;
    help += `\n  ${DIM}Any other input is sent to the AI as a chat message${RESET}\n`;

    return help;
}

module.exports = { executeCommand, getCommandHelp, commands };
