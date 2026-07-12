/**
 * x402-agent — Solana AI Agentic Protocol Engine
 * 
 * Programmatic API for use as an npm package.
 * 
 * Usage:
 *   const x402 = require('x402-agent');
 * 
 *   // Birdeye V3 API (all 53 methods)
 *   const metadata = await x402.birdeye.getTokenMetadataSingle('So11...');
 *   const market   = await x402.birdeye.getTokenMarketDataSingle('So11...');
 *   const intel    = await x402.birdeye.getTokenIntelligence('So11...');
 * 
 *   // Enhanced analytics (charts, sentiment, whales)
 *   const chart     = await x402.enhanced.getOHLCVWithChart('So11...', '1h');
 *   const sentiment = await x402.enhanced.getMarketSentiment('So11...');
 * 
 *   // Unified Birdeye Gateway (backward-compatible)
 *   const price = await x402.gateway.getPrice('So11...');
 * 
 *   // Direct V3 client access
 *   const v3 = x402.v3;
 * 
 *   // Hedge personas + knowledge
 *   const persona = x402.personas.loadPersona('valueclaw');
 *   const facts   = x402.knowledge.searchFacts('solana');
 */

'use strict';

// ─── Core Services ───────────────────────────
const birdeyeV3 = require('../src/services/birdeye/v3');
const birdeyeGateway = require('../src/services/birdeye/index');
const birdeyeEnhanced = require('../src/services/birdeye-enhanced');
const config = require('../src/config');

// ─── Lazy-loaded services (only load when called) ────
let _solana, _jupiter, _portfolio, _pumpfun, _x402spl, _x402token,
    _geminiImage, _unifiedAI, _cloudflareAI, _council, _investmentCouncil,
    _a2aProtocol, _securityAgents, _http402, _futarchy, _auth, _skillhub,
    _constitution, _personas, _knowledge;

// ─── Public API ──────────────────────────────
const x402 = {
    // ═══════════════════════════════════════════
    //  BIRDEYE V3 — Complete API Client
    // ═══════════════════════════════════════════
    /** Full V3 client with 53 public methods covering every Birdeye endpoint */
    birdeye: birdeyeV3,

    /** Alias: direct access to the V3 client */
    v3: birdeyeV3,

    /** Unified gateway with backward compatibility + X402 analytics */
    gateway: birdeyeGateway,

    /** Enhanced service: ASCII charts, sentiment scores, whale alerts */
    enhanced: birdeyeEnhanced,

    // ═══════════════════════════════════════════
    //  CONFIGURATION
    // ═══════════════════════════════════════════
    config,

    // ═══════════════════════════════════════════
    //  LAZY-LOADED SERVICES
    // ═══════════════════════════════════════════

    /** Solana connection utilities */
    get solana() { return _solana || (_solana = require('../src/services/solana/connection')); },

    /** Jupiter DEX aggregator */
    get jupiter() { return _jupiter || (_jupiter = require('../src/services/jupiter')); },

    /** Portfolio analysis */
    get portfolio() { return _portfolio || (_portfolio = require('../src/services/portfolio')); },

    /** PumpFun integration */
    get pumpfun() { return _pumpfun || (_pumpfun = require('../src/services/pumpfun')); },

    /** X402 SPL token operations */
    get x402spl() { return _x402spl || (_x402spl = require('../src/services/x402-spl-token')); },

    /** X402 token info */
    get x402token() { return _x402token || (_x402token = require('../src/services/x402-token')); },

    /** Gemini image generation (Nano Banana) */
    get geminiImage() { return _geminiImage || (_geminiImage = require('../src/services/gemini-image')); },

    /** Unified AI provider router */
    get ai() { return _unifiedAI || (_unifiedAI = require('../src/providers/unified-ai')); },

    /** Cloudflare AI gateway */
    get cloudflareAI() { return _cloudflareAI || (_cloudflareAI = require('../src/providers/cloudflare-ai')); },

    /** Agent council */
    get council() { return _council || (_council = require('../src/agents/agent-council')); },

    /** Investment council (Google A2A) */
    get investmentCouncil() { return _investmentCouncil || (_investmentCouncil = require('../src/agents/google-a2a/investment-council')); },

    /** A2A protocol */
    get a2a() { return _a2aProtocol || (_a2aProtocol = require('../src/agents/google-a2a/a2a-protocol')); },

    /** Security agents */
    get securityAgents() { return _securityAgents || (_securityAgents = require('../src/agents/google-a2a/security-agents')); },

    /** HTTP 402 gateway */
    get http402() { return _http402 || (_http402 = require('../src/services/http-402-gateway')); },

    /** Futarchy governance */
    get futarchy() { return _futarchy || (_futarchy = require('../src/services/futarchy-governance')); },

    /** Auth service */
    get auth() { return _auth || (_auth = require('../src/services/auth')); },

    /**
     * Skill Hub — installable agent skills (catalog + installer).
     * Source: skillhub/ (skills.x402agent.io · hub.x402agent.io). CLI: `skills list|install`
     */
    get skillhub() {
        return _skillhub || (_skillhub = require('../src/services/skillhub'));
    },

    /** Alias */
    get skills() {
        return this.skillhub;
    },

    /**
     * Clawd Constitution bundle — six laws, identity, soul, strategy.
     * Source: constitution/ (from clawdbot-go). CLI: laws, soul, constitution
     */
    get constitution() {
        return _constitution || (_constitution = require('../src/services/constitution'));
    },

    /** Alias */
    get clawd() {
        return this.constitution;
    },

    /**
     * Hedge Persona bundle — 5 investor lobster personas.
     * Source: data/hedge/ (from ClawdBrowser). CLI: persona, personas, hedge
     */
    get personas() {
        return _personas || (_personas = require('../src/services/personas'));
    },

    /**
     * ClawdBrowser Knowledge Base — 7 JSONL collections + 10 markdown docs.
     * Source: knowledge/ (from ClawdBrowser). CLI: knowledge, kb, facts
     */
    get knowledge() {
        return _knowledge || (_knowledge = require('../src/knowledge/clawdbrowser'));
    },

    // ═══════════════════════════════════════════
    //  CLI
    // ═══════════════════════════════════════════

    /** Programmatic access to CLI commands */
    get cli() {
        const { executeCommand, getCommandHelp, commands } = require('../src/cli/commands');
        return { executeCommand, getCommandHelp, commands };
    },

    /** Start the interactive REPL */
    get repl() {
        return require('../src/cli');
    },

    /** Start the Express API server */
    startServer(port) {
        if (port) process.env.PORT = String(port);
        return require('../src/index');
    },

    // ═══════════════════════════════════════════
    //  VERSION
    // ═══════════════════════════════════════════
    version: require('../package.json').version,
};

module.exports = x402;