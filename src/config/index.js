require('dotenv').config();

/** Strip trailing slash from public URLs. */
function normalizeUrl(u, fallback) {
  const v = (u || fallback || '').trim();
  return v.replace(/\/$/, '');
}

/** Public product surface for this agent stack (overridable for staging). */
const PRODUCT_URL = normalizeUrl(
  process.env.PRODUCT_URL || process.env.X402_PRODUCT_URL,
  'https://x402agent.io'
);
/** Skill catalog / static Skill Hub site */
const SKILLS_URL = normalizeUrl(
  process.env.SKILLS_URL || process.env.SKILLHUB_SITE_URL || process.env.X402_SKILLS_URL,
  'https://skills.x402agent.io'
);
/** Skill Hub portal (publish, scanner, discovery) */
const HUB_URL = normalizeUrl(
  process.env.HUB_URL || process.env.X402_HUB_URL,
  'https://hub.x402agent.io'
);

/** Origins allowed for browser CORS (product hosts + local dev). */
function buildCorsOrigins() {
  const defaults = [
    PRODUCT_URL,
    SKILLS_URL,
    HUB_URL,
    'https://x402agent.io',
    'http://x402agent.io',
    'https://skills.x402agent.io',
    'http://skills.x402agent.io',
    'https://hub.x402agent.io',
    'http://hub.x402agent.io',
    // Legacy ecosystem aliases (still served content may call APIs)
    'https://skills.x402.wtf',
    'https://x402.wtf',
    'http://localhost',
    'https://localhost',
    'http://127.0.0.1',
    'https://127.0.0.1'
  ];
  const fromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...defaults, ...fromEnv])];
}

module.exports = {
  /** Product identity — single source for health, dashboard, docs */
  product: {
    name: 'x402agent.io',
    url: PRODUCT_URL,
    skillsUrl: SKILLS_URL,
    hubUrl: HUB_URL,
    title: 'X402 Agent',
    tagline: 'Vending machine for data & AI tools on Solana',
    domains: {
      product: PRODUCT_URL,
      skills: SKILLS_URL,
      hub: HUB_URL
    }
  },

  cors: {
    origins: buildCorsOrigins()
  },

  // OpenRouter — Free Models Router by default (openrouter/free)
  // Docs: https://openrouter.ai/docs/guides/routing/routers/free-router
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
    /** Free Models Router or a specific free slug (`model:free`). */
    freeModel: process.env.OPENROUTER_FREE_MODEL || 'openrouter/free',
    /** Default chat model; falls back to freeModel when unset. */
    defaultModel:
      process.env.OPENROUTER_MODEL ||
      process.env.OPENROUTER_FREE_MODEL ||
      'openrouter/free',
    siteUrl:
      process.env.OPENROUTER_SITE_URL ||
      process.env.OPENROUTER_HTTP_REFERER ||
      PRODUCT_URL,
    appName:
      process.env.OPENROUTER_APP_NAME ||
      process.env.OPENROUTER_TITLE ||
      'Conway Automaton',
    /** Optional provider sort: price | throughput | latency */
    providerSort: process.env.OPENROUTER_PROVIDER_SORT || undefined,
    models: {
      free: process.env.OPENROUTER_FREE_MODEL || 'openrouter/free',
      auto: process.env.OPENROUTER_AUTO_MODEL || 'openrouter/auto',
      writing:
        process.env.OPENROUTER_WRITING_MODEL ||
        process.env.OPENROUTER_FREE_MODEL ||
        'openrouter/free',
      deep: process.env.OPENROUTER_DEEP_MODEL || 'deepseek/deepseek-v3.2-exp',
      google:
        process.env.OPENROUTER_GOOGLE_MODEL ||
        'google/gemini-2.5-flash-preview-09-2025',
      claude: process.env.OPENROUTER_CLAUDE_MODEL || 'anthropic/claude-sonnet-4.5',
      grokCode: process.env.OPENROUTER_GROKCODE_MODEL || 'x-ai/grok-4-fast',
      kimi: process.env.OPENROUTER_KIMI_MODEL || 'moonshotai/kimi-k2-0905',
      grok: process.env.OPENROUTER_GROK_MODEL || 'x-ai/grok-4-fast',
      nvidia: process.env.OPENROUTER_NVIDIA_MODEL || 'nvidia/nemotron-nano-9b-v2'
    }
  },

  // Direct API Keys
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY
  },

  xai: {
    apiKey: process.env.XAI_API_KEY
  },

  google: {
    apiKey: process.env.GOOGLE_API_KEY
  },

  // Cloudflare AI Gateway
  cloudflare: {
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    gatewayId: process.env.CLOUDFLARE_GATEWAY_ID || 'x402'
  },

  // Additional AI Providers
  nvidia: {
    apiKey: process.env.NVIDIA_API_KEY
  },

  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY
  },

  fal: {
    apiKey: process.env.FAL_API_KEY
  },

  // Solana Configuration — Connection requires http(s); rewrite accidental wss://
  solana: {
    rpcUrl: (() => {
      const raw =
        process.env.SOLANA_RPC_URL ||
        process.env.HELIUS_RPC_URL ||
        process.env.RPC_URL ||
        'https://api.mainnet-beta.solana.com';
      if (typeof raw === 'string' && raw.startsWith('wss://')) {
        return 'https://' + raw.slice('wss://'.length);
      }
      if (typeof raw === 'string' && raw.startsWith('ws://')) {
        return 'http://' + raw.slice('ws://'.length);
      }
      if (typeof raw === 'string' && (raw.startsWith('http://') || raw.startsWith('https://'))) {
        return raw;
      }
      return 'https://api.mainnet-beta.solana.com';
    })(),
    heliusApiKey: process.env.HELIUS_API_KEY
  },

  // X402 Token Configuration
  x402: {
    tokenMint: process.env.X402_TOKEN_MINT || '6H8uyJYrPVcra6Fi7iWh29DXSm8KctzhHRyXmPwKpump',
    agentWallet: process.env.X402_AGENT_WALLET || 'Bnf1judBhBg1QTWKxYjjTdfvH4k6AFNUkr6bexe1oP7S'
  },

  // DEX & Analytics
  jupiter: {
    apiKey: process.env.JUPITER_API_KEY,
    apiUrl: 'https://api.jup.ag'
  },

  birdeye: {
    apiKey: process.env.BIRDEYE_API_KEY,
    apiUrl: 'https://public-api.birdeye.so'
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  }
};
