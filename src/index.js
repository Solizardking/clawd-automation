const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/index.js');

// Services
const authService = require('./services/auth');
const portfolioService = require('./services/portfolio');
const x402Service = require('./services/x402-token');
const x402SPLService = require('./services/x402-spl-token');
const pumpFunService = require('./services/pumpfun');
const solanaService = require('./services/solana/connection');
const jupiterService = require('./services/jupiter');
const birdeyeService = require('./services/birdeye');
const http402Gateway = require('./services/http-402-gateway');
const futarchyGovernance = require('./services/futarchy-governance');

// AI Providers
const cloudflareAI = require('./providers/cloudflare-ai');
const unifiedAI = require('./providers/unified-ai');

// Agents
const agentCouncil = require('./agents/agent-council');

// Google A2A Agents
const investmentCouncil = require('./agents/google-a2a/investment-council');
const a2aProtocol = require('./agents/google-a2a/a2a-protocol');
const securityAgents = require('./agents/google-a2a/security-agents');

const app = express();

// CORS — product origin (x402agent.io) + localhost for local dashboard
const allowedOrigins = new Set(config.cors?.origins || []);
app.use(
  cors({
    origin(origin, callback) {
      // Non-browser / same-origin requests have no Origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      // Allow any localhost / 127.0.0.1 port for local dev
      try {
        const u = new URL(origin);
        if (
          (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
          (u.protocol === 'http:' || u.protocol === 'https:')
        ) {
          return callback(null, true);
        }
      } catch {
        /* ignore */
      }
      return callback(null, false);
    },
    credentials: true
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Auth middleware
const requireAuth = (req, res, next) => {
  const sessionToken = req.headers['x-session-token'];

  if (!sessionToken) {
    return res.status(401).json({ error: 'No session token provided' });
  }

  try {
    const session = authService.validateSession(sessionToken);
    req.session = session;
    next();
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
};

// Health check + product discovery
app.get('/health', (req, res) => {
  let skillhub = null;
  let constitution = null;
  try {
    skillhub = require('./services/skillhub').getManifest();
  } catch {
    skillhub = null;
  }
  try {
    constitution = require('./services/constitution').getManifest();
  } catch {
    constitution = null;
  }
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    version: require('../package.json').version,
    product: config.product?.name || 'x402agent.io',
    productUrl: config.product?.url || 'https://x402agent.io',
    url: config.product?.url || 'https://x402agent.io',
    skillsUrl: config.product?.skillsUrl || 'https://skills.x402agent.io',
    hubUrl: config.product?.hubUrl || 'https://hub.x402agent.io',
    domains: config.product?.domains || {
      product: 'https://x402agent.io',
      skills: 'https://skills.x402agent.io',
      hub: 'https://hub.x402agent.io'
    },
    skillhub: skillhub
      ? {
          skillCount: skillhub.skillCount,
          hub: skillhub.hub,
          portal: skillhub.portal || skillhub.hubUrl,
          skillsUrl: skillhub.skillsUrl || skillhub.hub
        }
      : null,
    constitution: constitution
      ? { present: constitution.present, documentCount: constitution.documentCount }
      : null
  });
});

// ============ SKILL HUB (skills.x402agent.io · hub.x402agent.io) ============
app.get('/skills-hub', (req, res) => {
  try {
    res.json(require('./services/skillhub').getManifest());
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.get('/skills-hub/catalog', (req, res) => {
  try {
    const hub = require('./services/skillhub');
    if (req.query.q) {
      return res.json(hub.searchSkills(req.query.q, {
        limit: Number(req.query.limit) || 50,
        category: req.query.category
      }));
    }
    res.json(hub.loadCatalog());
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

// Express 5 / path-to-regexp v8: use {*slug} for multi-segment slugs
app.get('/skills-hub/skill/{*slug}', (req, res) => {
  try {
    const hub = require('./services/skillhub');
    const slug = Array.isArray(req.params.slug)
      ? req.params.slug.join('/')
      : String(req.params.slug || '').replace(/^\//, '');
    const found = hub.findSkill(slug);
    if (!found) return res.status(404).json({ error: 'Skill not found', slug });
    if (req.query.full === '1') {
      const full = hub.readSkillMarkdown(found.slug);
      return res.type('text/markdown').send(full.markdown);
    }
    res.json(found);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Static skill hub site (catalog UI) when present
const skillhubPublic = path.join(__dirname, '../skillhub/public');
if (require('fs').existsSync(skillhubPublic)) {
  app.use('/skillhub', express.static(skillhubPublic));
}

// ============ CLAWD CONSTITUTION ============
app.get('/constitution', (req, res) => {
  try {
    res.json(require('./services/constitution').getManifest());
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.get('/constitution/laws', (req, res) => {
  try {
    const c = require('./services/constitution');
    const id = req.query.three === '1' || req.query.layer === 'three' ? 'three-laws' : 'six-laws';
    const doc = c.readDocument(id);
    res.json({
      id: doc.id,
      title: doc.title,
      sha256: doc.sha256,
      markdown: doc.markdown
    });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.get('/constitution/:id', (req, res) => {
  try {
    const doc = require('./services/constitution').readDocument(req.params.id);
    if (req.query.raw === '1') {
      return res.type('text/markdown').send(doc.markdown);
    }
    res.json({
      id: doc.id,
      title: doc.title,
      layer: doc.layer,
      authority: doc.authority,
      sha256: doc.sha256,
      lines: doc.lines,
      markdown: doc.markdown
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// ============ AUTH ROUTES ============

// Generate auth challenge
app.post('/auth/challenge', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const challenge = authService.generateChallenge(walletAddress);
    res.json(challenge);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login with signature
app.post('/auth/login', async (req, res) => {
  try {
    const { walletAddress, signature, nonce } = req.body;
    const session = await authService.createSession(walletAddress, signature, nonce);
    res.json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Refresh session
app.post('/auth/refresh', requireAuth, async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'];
    const session = await authService.refreshSession(sessionToken);
    res.json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Logout
app.post('/auth/logout', requireAuth, (req, res) => {
  const sessionToken = req.headers['x-session-token'];
  const result = authService.logout(sessionToken);
  res.json(result);
});

// ============ PORTFOLIO ROUTES ============

// Get portfolio
app.get('/portfolio', requireAuth, async (req, res) => {
  try {
    const portfolio = await portfolioService.getPortfolio(req.session.walletAddress);
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get portfolio analytics
app.get('/portfolio/analytics', requireAuth, async (req, res) => {
  try {
    const analytics = await portfolioService.getAnalytics(req.session.walletAddress);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get rebalancing suggestions
app.get('/portfolio/rebalance', requireAuth, async (req, res) => {
  try {
    const suggestions = await portfolioService.suggestRebalancing(req.session.walletAddress);
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ X402 TOKEN ROUTES ============

// Get X402 token data
app.get('/x402/info', async (req, res) => {
  try {
    const data = await x402Service.getTokenData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get X402 market stats
app.get('/x402/market', async (req, res) => {
  try {
    const stats = await x402Service.getMarketStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get X402 performance
app.get('/x402/performance', async (req, res) => {
  try {
    const performance = await x402Service.analyzePerformance();
    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ X402 SPL TOKEN ROUTES ============

// Get X402 SPL token metadata
app.get('/x402/spl/metadata', async (req, res) => {
  try {
    const metadata = await x402SPLService.getTokenMetadata();
    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get X402 balance for wallet
app.get('/x402/spl/balance/:address', async (req, res) => {
  try {
    const balance = await x402SPLService.getBalance(req.params.address);
    res.json({ address: req.params.address, balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get token account info
app.get('/x402/spl/account/:address', async (req, res) => {
  try {
    const accountInfo = await x402SPLService.getTokenAccountInfo(req.params.address);
    res.json(accountInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get largest X402 holders
app.get('/x402/spl/holders', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const holders = await x402SPLService.getLargestHolders(limit);
    res.json({ holders, count: holders.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get holder statistics
app.get('/x402/spl/holder/:address', requireAuth, async (req, res) => {
  try {
    const stats = await x402SPLService.getHolderStats(req.params.address);
    const benefits = x402SPLService.getHolderBenefits(stats.balance);
    res.json({ ...stats, benefits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transfer history
app.get('/x402/spl/transfers/:address', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const transfers = await x402SPLService.getTransferHistory(req.params.address, limit);
    res.json({ address: req.params.address, transfers, count: transfers.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate X402 holder
app.get('/x402/spl/validate/:address', async (req, res) => {
  try {
    const minimum = parseInt(req.query.minimum) || 1000;
    const validation = await x402SPLService.validateHolder(req.params.address, minimum);
    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get supply info
app.get('/x402/spl/supply', async (req, res) => {
  try {
    const supply = await x402SPLService.getSupplyInfo();
    res.json(supply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PUMP.FUN ROUTES ============

// Get X402 from Pump.fun
app.get('/pumpfun/x402', async (req, res) => {
  try {
    const data = await pumpFunService.getX402Page();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get token data from Pump.fun
app.get('/pumpfun/token/:mint', async (req, res) => {
  try {
    const data = await pumpFunService.getTokenData(req.params.mint);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get token trades
app.get('/pumpfun/trades/:mint', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const trades = await pumpFunService.getTokenTrades(req.params.mint, limit);
    res.json({ mint: req.params.mint, trades, count: trades.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trending tokens
app.get('/pumpfun/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const trending = await pumpFunService.getTrendingTokens(limit);
    res.json({ trending, count: trending.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search tokens
app.get('/pumpfun/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit) || 20;
    const results = await pumpFunService.searchTokens(query, { limit });
    res.json({ query, results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ BIRDEYE MEMECOIN DATA ROUTES ============

// Get token price
app.get('/birdeye/price/:address', async (req, res) => {
  try {
    const price = await birdeyeService.getPrice(req.params.address, {
      includeLiquidity: req.query.include_liquidity !== 'false'
    });
    res.json(price);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get multiple token prices
app.get('/birdeye/prices', async (req, res) => {
  try {
    const { addresses } = req.query;
    if (!addresses) {
      return res.status(400).json({ error: 'addresses parameter required' });
    }
    const prices = await birdeyeService.getMultiplePrices(addresses);
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get token trades
app.get('/birdeye/trades/:address', async (req, res) => {
  try {
    const trades = await birdeyeService.getTokenTradesV3(req.params.address, {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    });
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent trades
app.get('/birdeye/trades/recent', async (req, res) => {
  try {
    const trades = await birdeyeService.getRecentTradesV3({
      limit: parseInt(req.query.limit) || 100
    });
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get OHLCV data
app.get('/birdeye/ohlcv/:address', async (req, res) => {
  try {
    const { type, time_from, time_to } = req.query;
    if (!type || !time_from || !time_to) {
      return res.status(400).json({ error: 'type, time_from, and time_to required' });
    }
    const ohlcv = await birdeyeService.getOHLCVV3(
      req.params.address,
      type,
      parseInt(time_from),
      parseInt(time_to),
      { currency: req.query.currency || 'usd' }
    );
    res.json(ohlcv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comprehensive meme data
app.get('/birdeye/meme/:address', async (req, res) => {
  try {
    const data = await birdeyeService.getComprehensiveMemeData(req.params.address);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ TRADING ROUTES ============

// Get quote
app.post('/trade/quote', requireAuth, async (req, res) => {
  try {
    const { inputToken, outputToken, amount } = req.body;
    const quote = await jupiterService.getQuote(inputToken, outputToken, amount);
    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze trade
app.post('/trade/analyze', requireAuth, async (req, res) => {
  try {
    const { inputToken, outputToken, amount } = req.body;
    const analysis = await jupiterService.analyzeTrade(inputToken, outputToken, amount);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get token analysis
app.get('/trade/token/:address', requireAuth, async (req, res) => {
  try {
    const analysis = await birdeyeService.analyzeTokenPerformance(req.params.address);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ AGENT ROUTES ============

// Execute agent task
app.post('/agent/execute', requireAuth, async (req, res) => {
  try {
    const { task, params } = req.body;
    const result = await agentCouncil.routeTask(task, params);
    authService.logActivity(req.headers['x-session-token'], `agent_task:${task}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Collaborative task
app.post('/agent/collaborate', requireAuth, async (req, res) => {
  try {
    const { task, params } = req.body;
    const result = await agentCouncil.collaborate(task, params);
    authService.logActivity(req.headers['x-session-token'], `agent_collaborate:${task}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agent voting
app.post('/agent/vote', requireAuth, async (req, res) => {
  try {
    const { proposal, params } = req.body;
    const result = await agentCouncil.vote(proposal, params);
    authService.logActivity(req.headers['x-session-token'], `agent_vote:${proposal}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get council status
app.get('/agent/status', requireAuth, async (req, res) => {
  try {
    const status = agentCouncil.getCouncilStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trading agent specific
app.post('/agent/trading/:action', requireAuth, async (req, res) => {
  try {
    const result = await agentCouncil.agents.trading.act(req.params.action, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Merchant agent specific
app.post('/agent/merchant/:action', requireAuth, async (req, res) => {
  try {
    const result = await agentCouncil.agents.merchant.act(req.params.action, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Developer agent specific
app.post('/agent/developer/:action', requireAuth, async (req, res) => {
  try {
    const result = await agentCouncil.agents.developer.act(req.params.action, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Shopping agent specific
app.post('/agent/shopping/:action', requireAuth, async (req, res) => {
  try {
    const result = await agentCouncil.agents.shopping.act(req.params.action, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SOLANA ROUTES ============

// Get balance
app.get('/solana/balance/:address', async (req, res) => {
  try {
    const balance = await solanaService.getBalance(req.params.address);
    res.json({ address: req.params.address, balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get token accounts
app.get('/solana/tokens/:address', async (req, res) => {
  try {
    const tokens = await solanaService.getTokenAccounts(req.params.address);
    res.json({ address: req.params.address, tokens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent transactions
app.get('/solana/transactions/:address', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const transactions = await solanaService.getRecentTransactions(req.params.address, limit);
    res.json({ address: req.params.address, transactions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ X402 KNOWLEDGE ROUTES ============

// Get X402 protocol knowledge
app.get('/x402/knowledge', async (req, res) => {
  try {
    const category = req.query.category;
    const knowledge = unifiedAI.getKnowledge(category);
    res.json(knowledge);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ask X402 Agent a question
app.post('/x402/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    const answer = await unifiedAI.answerX402Question(question);
    res.json({ question, answer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get X402 protocol context
app.get('/x402/context', async (req, res) => {
  try {
    const context = unifiedAI.knowledgeContext;
    res.json({ context });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ USER ROUTES ============

// Get user stats
app.get('/user/stats', requireAuth, (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'];
    const stats = authService.getUserStats(sessionToken);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tier benefits
app.get('/user/benefits', requireAuth, (req, res) => {
  try {
    const benefits = authService.getTierBenefits(req.session.tier);
    res.json({ tier: req.session.tier, benefits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CLOUDFLARE AI ROUTES ============

// Get available Cloudflare models
app.get('/ai/cloudflare/models', (req, res) => {
  try {
    const models = cloudflareAI.getAvailableModels();
    res.json({ models, count: models.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Text generation using Cloudflare
app.post('/ai/cloudflare/generate', requireAuth, async (req, res) => {
  try {
    const { model, prompt, options } = req.body;
    const result = await cloudflareAI.generateCompletion(model || 'llama31_8b', prompt, options);
    authService.logActivity(req.headers['x-session-token'], 'cloudflare_generate');
    res.json({ result, model });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Image generation using Cloudflare
app.post('/ai/cloudflare/image', requireAuth, async (req, res) => {
  try {
    const { prompt, model, options } = req.body;
    const imageBase64 = await cloudflareAI.generateImage(prompt, model || 'flux_schnell', options);
    authService.logActivity(req.headers['x-session-token'], 'cloudflare_image');
    res.json({ image: imageBase64, format: 'base64' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vision analysis using Cloudflare
app.post('/ai/cloudflare/vision', requireAuth, async (req, res) => {
  try {
    const { imageUrl, prompt, options } = req.body;
    const result = await cloudflareAI.analyzeImage(imageUrl, prompt, options);
    authService.logActivity(req.headers['x-session-token'], 'cloudflare_vision');
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Text embeddings using Cloudflare
app.post('/ai/cloudflare/embeddings', requireAuth, async (req, res) => {
  try {
    const { text, model } = req.body;
    const embeddings = await cloudflareAI.generateEmbeddings(text, model);
    res.json({ embeddings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Translation using Cloudflare
app.post('/ai/cloudflare/translate', requireAuth, async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;
    const translated = await cloudflareAI.translate(text, sourceLang, targetLang);
    res.json({ translated, sourceLang, targetLang });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Text to speech using Cloudflare
app.post('/ai/cloudflare/tts', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    const audioBase64 = await cloudflareAI.textToSpeech(text);
    res.json({ audio: audioBase64, format: 'base64' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Speech to text using Cloudflare
app.post('/ai/cloudflare/stt', requireAuth, async (req, res) => {
  try {
    const { audio } = req.body;
    const text = await cloudflareAI.speechToText(audio);
    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unified AI route - automatically selects best model
app.post('/ai/unified/complete', requireAuth, async (req, res) => {
  try {
    const { task, prompt, data } = req.body;
    const result = await unifiedAI.route(task || 'general', { prompt, ...data });
    authService.logActivity(req.headers['x-session-token'], `unified_ai:${task}`);
    res.json({ result, task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Multi-model consensus
app.post('/ai/unified/consensus', requireAuth, async (req, res) => {
  try {
    const { prompt, models } = req.body;
    const result = await unifiedAI.consensus(prompt, models);
    authService.logActivity(req.headers['x-session-token'], 'unified_consensus');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GOOGLE A2A INVESTMENT COUNCIL ROUTES ============

// Analyze investment opportunity
app.post('/api/council/analyze', requireAuth, async (req, res) => {
  try {
    const opportunity = req.body;
    const analysis = await investmentCouncil.analyzeInvestment(opportunity);
    authService.logActivity(req.headers['x-session-token'], 'council_analysis');
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get council history
app.get('/api/council/history', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = investmentCouncil.getHistory(limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get agent performance metrics
app.get('/api/council/performance', async (req, res) => {
  try {
    const performance = investmentCouncil.getAgentPerformance();
    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ A2A PROTOCOL ROUTES ============

// Register agent in A2A network
app.post('/api/a2a/register', requireAuth, async (req, res) => {
  try {
    const agentConfig = req.body;
    const result = a2aProtocol.registerAgent(agentConfig);
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send agent-to-agent message
app.post('/api/a2a/message', requireAuth, async (req, res) => {
  try {
    const { fromAgentId, toAgentId, message, options } = req.body;
    const result = await a2aProtocol.sendMessage(fromAgentId, toAgentId, message, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create multi-agent session
app.post('/api/a2a/session', requireAuth, async (req, res) => {
  try {
    const sessionConfig = req.body;
    const session = await a2aProtocol.createSession(sessionConfig);
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get A2A network stats
app.get('/api/a2a/stats', async (req, res) => {
  try {
    const stats = a2aProtocol.getNetworkStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get agent registry
app.get('/api/a2a/agents', async (req, res) => {
  try {
    const agents = a2aProtocol.getRegistry();
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SECURITY AGENTS ROUTES ============

// Full security analysis
app.post('/api/security/analyze', requireAuth, async (req, res) => {
  try {
    const { tokenAddress } = req.body;
    const analysis = await securityAgents.analyzeToken(tokenAddress);
    authService.logActivity(req.headers['x-session-token'], 'security_analysis');
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if token is blacklisted
app.get('/api/security/blacklist/:address', async (req, res) => {
  try {
    const isBlacklisted = securityAgents.isBlacklisted(req.params.address);
    res.json({ address: req.params.address, blacklisted: isBlacklisted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get security incidents
app.get('/api/security/incidents', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const incidents = securityAgents.getIncidents(limit);
    res.json(incidents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ FUTARCHY GOVERNANCE ROUTES ============

// Create governance proposal
app.post('/api/governance/proposal', requireAuth, async (req, res) => {
  try {
    const proposalData = req.body;
    const proposal = await futarchyGovernance.createProposal(proposalData);
    authService.logActivity(req.headers['x-session-token'], 'create_proposal');
    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Place bet on prediction market
app.post('/api/governance/bet', requireAuth, async (req, res) => {
  try {
    const betData = req.body;
    const result = await futarchyGovernance.placeBet(betData);
    authService.logActivity(req.headers['x-session-token'], 'place_bet');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve proposal
app.post('/api/governance/resolve/:proposalId', requireAuth, async (req, res) => {
  try {
    const result = await futarchyGovernance.resolveProposal(req.params.proposalId);
    authService.logActivity(req.headers['x-session-token'], 'resolve_proposal');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active proposals
app.get('/api/governance/proposals', async (req, res) => {
  try {
    const proposals = futarchyGovernance.getActiveProposals();
    res.json(proposals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get proposal details
app.get('/api/governance/proposal/:proposalId', async (req, res) => {
  try {
    const proposal = futarchyGovernance.getProposal(req.params.proposalId);
    const markets = futarchyGovernance.getMarkets(req.params.proposalId);
    res.json({ proposal, markets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get governance stats
app.get('/api/governance/stats', async (req, res) => {
  try {
    const stats = futarchyGovernance.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ HTTP 402 PAYMENT GATEWAY ROUTES ============

// Mount 402 gateway routes
app.use('/api/payment', http402Gateway.createRouter());

// Get fund statistics
app.get('/api/fund/stats', async (req, res) => {
  try {
    const stats = {
      totalAUM: 2400000,
      sharpeRatio: 3.2,
      activeAgents: 9,
      winRate: 68,
      totalTrades: 342,
      successfulTrades: 233,
      governanceProposals: futarchyGovernance.getStats().totalProposals,
      a2aMessages: a2aProtocol.getNetworkStats().totalMessages
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  // Check which AI providers are configured
  const providers = [];
  if (config.google.apiKey) providers.push('Google Gemini');
  if (config.openai.apiKey) providers.push('OpenAI GPT');
  if (config.xai.apiKey) providers.push('XAI Grok');
  if (config.anthropic.apiKey) providers.push('Anthropic Claude');
  if (config.openRouter.apiKey) providers.push('OpenRouter');
  if (config.cloudflare.apiToken) providers.push('Cloudflare AI');

  const productUrl = config.product?.url || 'https://x402agent.io';
  console.log(`
  ╔════════════════════════════════════════════════════╗
  ║         x402agent.io — X402 Agent                 ║
  ║         Vending machine for data & AI tools        ║
  ╠════════════════════════════════════════════════════╣
  ║  🌐 Product: ${productUrl.padEnd(36)}║
  ║  🖥️  Server: http://localhost:${PORT.toString().padEnd(26)}║
  ║  📊 Dashboard: http://localhost:${PORT}/               ║
  ║  Environment: ${config.server.env.padEnd(33)}║
  ║                                                    ║
  ║  🤖 X402 Unified Agent:                            ║
  ║     One agent, multiple AI providers               ║
  ║     Automatic routing & cascading fallbacks        ║
  ║                                                    ║
  ║  🧠 Active AI Providers (${providers.length}):                         ║
${providers.map(p => `  ║     ✓ ${p.padEnd(44)}║`).join('\n')}
  ║                                                    ║
  ║  🔗 Blockchain Integration:                        ║
  ║     ✓ Solana (Helius RPC)                          ║
  ║     ✓ Jupiter DEX                                  ║
  ║     ✓ Birdeye Analytics                            ║
  ║     ✓ Pump.fun Real-time                           ║
  ║                                                    ║
  ║  ⚙️  Features:                                      ║
  ║     • Multi-provider AI routing                    ║
  ║     • Google Gemini thinking & TTS                 ║
  ║     • Vision, audio, video analysis                ║
  ║     • Long context (1M+ tokens)                    ║
  ║     • HTTP 402 Payment Gateway                     ║
  ║     • Futarchy Governance                          ║
  ║     • A2A Protocol                                 ║
  ║                                                    ║
  ║  💎 X402 Token: ${config.x402.tokenMint.substring(0, 8)}...                 ║
  ╚════════════════════════════════════════════════════╝

  🚀 X402 Agent operational. ${providers.length} AI provider${providers.length !== 1 ? 's' : ''} online.
  `);
});

module.exports = app;
