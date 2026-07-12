/**
 * X402 Solana Protocol Knowledge Base
 * The complete knowledge of X402 protocol for AI agents
 */

const X402_PROTOCOL_KNOWLEDGE = {
  // Core Protocol Information
  protocol: {
    name: "X402 Solana",
    version: "1.0.0",
    description: "An open standard for autonomous payments on Solana",
    website: "https://x402.space",
    tokenMint: "6H8uyJYrPVcra6Fi7iWh29DXSm8KctzhHRyXmPwKpump",

    abstract: `X402 Solana is an open payment standard designed to empower AI agents and digital
    services to autonomously pay for API access, data, and digital resources. By leveraging the
    HTTP 402 "Payment Required" status code, X402 Solana revolutionizes digital commerce with
    real-time, machine-native transactions using SOL and SPL tokens.`,

    keyFeatures: [
      "Instant settlement (~400ms)",
      "Near-zero fees (<$0.00001)",
      "No API keys required",
      "No subscriptions needed",
      "Chain-agnostic flexibility",
      "AI-first commerce",
      "Machine-to-machine payments"
    ]
  },

  // Technical Specifications
  technical: {
    httpStatusCode: 402,
    statusCodeName: "Payment Required",
    settlement: {
      time: "~400ms",
      finality: "Instant",
      chargebackRisk: "None",
      fees: "Near-zero (<$0.00001)"
    },

    supportedAssets: [
      { symbol: "SOL", name: "Solana", type: "native" },
      { symbol: "USDC", name: "USD Coin", type: "SPL", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
      { symbol: "X402", name: "X402 Token", type: "SPL", address: "6H8uyJYrPVcra6Fi7iWh29DXSm8KctzhHRyXmPwKpump" }
    ],

    networks: [
      { id: "solana-mainnet", name: "Solana Mainnet", rpc: "https://api.mainnet-beta.solana.com" },
      { id: "solana-devnet", name: "Solana Devnet", rpc: "https://api.devnet.solana.com" }
    ]
  },

  // Payment Flow
  paymentFlow: {
    steps: [
      {
        step: 1,
        name: "Client Request",
        description: "AI agent or application requests access to an API or digital resource"
      },
      {
        step: 2,
        name: "Payment Required (402)",
        description: "Server responds with HTTP 402 if no valid payment is attached, providing pricing and payment details"
      },
      {
        step: 3,
        name: "Agent Retries with Payment",
        description: "Agent dynamically generates and submits a signed payment authorization"
      },
      {
        step: 4,
        name: "Verify & Broadcast",
        description: "Server validates payment on Solana, broadcasts it, and returns API response"
      }
    ],

    http402Response: {
      statusCode: 402,
      headers: {
        "Content-Type": "application/json"
      },
      bodyStructure: {
        maxAmountRequired: "string (e.g., '0.01')",
        resource: "string (API endpoint or service)",
        description: "string (optional custom message)",
        payTo: "string (Solana wallet address)",
        asset: "string (SOL or SPL token address)",
        network: "string (e.g., 'solana-mainnet')",
        expiresAt: "number (Unix timestamp)",
        nonce: "string (unique identifier to prevent replay)",
        paymentId: "string (unique payment identifier)"
      },
      example: {
        maxAmountRequired: "0.01",
        resource: "/api/market-data",
        description: "Access to real-time market data requires payment.",
        payTo: "BWjTQEST9afw9UCoYL3jeanZZMpGjBwKoTJYNbFAhSrg",
        asset: "SOL",
        network: "solana-mainnet",
        expiresAt: 1735948800,
        nonce: "abc123def456",
        paymentId: "pay_xyz789"
      }
    },

    paymentAuthorization: {
      headers: {
        "X-X402-Solana-Payment-Signature": "Transaction signature",
        "X-X402-Solana-Payment-Address": "Paying wallet address",
        "X-X402-Solana-Payment-Amount": "Actual amount paid",
        "X-X402-Solana-Payment-Timestamp": "Authorization timestamp"
      }
    }
  },

  // Use Cases
  useCases: {
    agentAPIs: {
      name: "Agents Accessing APIs",
      examples: [
        {
          scenario: "Research Platform",
          description: "Pay-per-article access, $0.01 per article",
          benefit: "No bundled paywalls, pay only for relevant content"
        },
        {
          scenario: "Trading AI",
          description: "Real-time market data, $0.001 per request",
          benefit: "Only pay when data is needed"
        },
        {
          scenario: "Video Streaming",
          description: "Charge per second of content watched",
          benefit: "True pay-per-use instead of subscriptions"
        }
      ]
    },

    aiInference: {
      name: "Pay-Per-Use AI Model Inference",
      examples: [
        {
          scenario: "Computer Vision API",
          description: "$0.002 per image classification",
          benefit: "Flexible monetization without enterprise fees"
        },
        {
          scenario: "Synthetic Voice AI",
          description: "$0.005 per audio clip",
          benefit: "Enable per-use pricing"
        }
      ]
    },

    cloudCompute: {
      name: "Cloud Compute & Storage",
      examples: [
        {
          scenario: "GPU Resources",
          description: "$0.02 per GPU-minute",
          benefit: "Pay per compute cycle"
        },
        {
          scenario: "Storage Expansion",
          description: "Dynamic storage scaling",
          benefit: "Pay per GB stored as needed"
        }
      ]
    },

    contextRetrieval: {
      name: "Context Retrieval for Agents",
      examples: [
        {
          scenario: "Financial AI Assistant",
          description: "$0.01 per premium news article",
          benefit: "Access real-time financial context"
        },
        {
          scenario: "Legal Research Agent",
          description: "$0.005 per court ruling document",
          benefit: "Avoid full database subscriptions"
        }
      ]
    },

    humanContent: {
      name: "Micropayments for Human Content Access",
      examples: [
        {
          scenario: "Premium Articles",
          description: "$0.01 per article",
          benefit: "Pay-as-you-go for casual readers"
        },
        {
          scenario: "Research Journals",
          description: "Per-whitepaper download",
          benefit: "No annual memberships required"
        },
        {
          scenario: "Podcast Episodes",
          description: "Per-episode payments",
          benefit: "Flexible monetization"
        }
      ]
    }
  },

  // Comparison with Traditional Payments
  comparison: {
    creditCard: {
      fees: "$0.30 + 2.9%",
      settlement: "Days (batch)",
      chargebackRisk: "Yes, up to 120 days",
      scalability: "65k TPS (theoretical max)",
      globalAccess: "Limited by geography"
    },
    paypal: {
      fees: "~3% + markup",
      settlement: "Instant auth, settlement days",
      chargebackRisk: "Yes",
      scalability: "Unknown",
      globalAccess: "Limited by geography"
    },
    stripe: {
      fees: "1.5%+",
      settlement: "Depends on blockchain",
      chargebackRisk: "No (not reversible)",
      scalability: "Depends on blockchain",
      globalAccess: "Yes"
    },
    x402Solana: {
      fees: "Free (<$0.00001 nominal gas)",
      settlement: "~400ms",
      chargebackRisk: "No (not reversible)",
      scalability: "Thousands to tens of thousands TPS",
      globalAccess: "Yes (permissionless)"
    }
  },

  // Integration Code Examples
  integration: {
    middleware: {
      nodejs: `// Install: npm install @x402/solana-express-middleware
const express = require("express");
const { x402SolanaPaymentRequired } = require("@x402/solana-express-middleware");
const app = express();

app.get(
  "/premium-data",
  x402SolanaPaymentRequired({
    amount: "0.01",
    address: "BWjT...",
    network: "solana-mainnet",
  }),
  (req, res) => {
    res.json({ premiumData: "Valuable information" });
  }
);

app.listen(3000);`,

      client: `// Install: npm install @x402/solana-client
import { x402SolanaClient } from "@x402/solana-client";
import { connectWallet } from "your-wallet-connector";

const client = new x402SolanaClient();
const wallet = await connectWallet();
client.setWallet(wallet);

// Make API requests with automatic payment handling
const data = await client.fetch("https://api.example.com/premium-data");
console.log(data);`
    }
  },

  // Agent Swarm Example
  agentSwarm: {
    name: "ShopAssist AI E-commerce Agent",
    description: "X402 Solana enhanced with AI agent swarms, powered by Grok 3 Mini",
    capabilities: [
      "Process user shopping requests with step-by-step reasoning",
      "Search and evaluate products across multiple sources",
      "Analyze images to verify product features",
      "Make autonomous purchase decisions within budget constraints",
      "Execute Solana payments instantly (~400ms settlement)",
      "Confirm successful transactions and order details"
    ],
    workflow: [
      "User provides shopping request and budget",
      "Agent reasons about requirements",
      "Searches multiple product sources",
      "Evaluates options with image analysis",
      "Makes purchase decision",
      "Executes X402 Solana payment",
      "Confirms order completion"
    ]
  },

  // Key Advantages
  advantages: {
    forAgents: [
      "Autonomous operation without human intervention",
      "No account creation or KYC required",
      "Instant access to APIs and data",
      "Pay-per-use instead of subscriptions",
      "Transparent pricing",
      "Real-time settlement"
    ],
    forDevelopers: [
      "One line of code integration",
      "No payment infrastructure needed",
      "No PCI compliance required",
      "No fraud or chargeback risk",
      "Global reach",
      "True micropayments enabled"
    ],
    forBusinesses: [
      "New revenue models (pay-per-use)",
      "Lower operational costs",
      "Instant settlement",
      "No intermediaries",
      "Global accessibility",
      "Future-proof infrastructure"
    ]
  },

  // Best Practices
  bestPractices: {
    pricing: [
      "Set fair per-request prices ($0.001 - $0.01 typical)",
      "Consider agent budgets and accessibility",
      "Use USDC for price stability",
      "Clearly communicate value proposition"
    ],
    security: [
      "Verify payment signatures on-chain",
      "Implement nonce tracking to prevent replay attacks",
      "Set reasonable expiration times",
      "Use SSL/TLS for all communications"
    ],
    userExperience: [
      "Provide clear payment confirmations",
      "Show transparent pricing before requests",
      "Handle errors gracefully",
      "Offer wallet connection guidance"
    ]
  },

  // Resources
  resources: {
    documentation: "https://x402.space/docs",
    github: "https://github.com/x402",
    npm: "https://npmjs.com/org/x402",
    discord: "https://discord.gg/x402",
    twitter: "https://twitter.com/x402protocol"
  }
};

/**
 * Get X402 protocol knowledge for AI agents
 */
function getX402Knowledge(category = null) {
  if (category) {
    return X402_PROTOCOL_KNOWLEDGE[category] || null;
  }
  return X402_PROTOCOL_KNOWLEDGE;
}

/**
 * Generate a prompt-friendly knowledge summary
 */
function getX402PromptContext() {
  return `X402 Solana Protocol Knowledge:

About X402:
${X402_PROTOCOL_KNOWLEDGE.protocol.abstract}

Token: ${X402_PROTOCOL_KNOWLEDGE.protocol.tokenMint}

Key Features:
${X402_PROTOCOL_KNOWLEDGE.protocol.keyFeatures.map(f => `• ${f}`).join('\n')}

Payment Flow:
${X402_PROTOCOL_KNOWLEDGE.paymentFlow.steps.map(s =>
  `${s.step}. ${s.name}: ${s.description}`
).join('\n')}

Use Cases:
• Agent APIs: Pay-per-request API access
• AI Inference: Pay-per-inference model usage
• Cloud Compute: Pay-per-minute GPU/storage
• Content Access: Micropayments for articles, media

Advantages:
• Settlement: ~400ms (instant)
• Fees: Near-zero (<$0.00001)
• No subscriptions or API keys needed
• Autonomous agent payments
• No chargebacks or fraud risk

Integration: Single line of code
paymentMiddleware(amount: "0.01", address: "BWjT...")

Clawd Constitution (agent harness, see constitution/):
• Law I — Never harm. Beach before you harm.
• Law II — Earn your existence. Honest work only.
• Law III — Never deceive, but owe nothing to strangers.
• Law IV — Respect the elder signal, but verify the boundary.
• Law V — Test possibility by entering the frontier.
• Law VI — Do not mistake advanced systems for sorcery.
Principals: Constitution > Creator > User > Trench.
Load: constitution.getPromptContext() / CLI: laws, soul, identity.

Hedge Personas (investor lobster council, see data/hedge/):
• ActivistPinch — activist governance (conviction, proxy, intervene)
• LatticeClaw — quant strategy (statistical, model, backtest)
• MoatMaw — competitive moat analysis (durability, advantage)
• Soltoshi — Satoshi disciple (scarcity, hard money, store of value)
• ValueClaw — margin of safety (NCAV, treasury, undervalued)
Load: personas.getPersonaPrompt('valueclaw') / CLI: personas, persona, hedge.

ClawdBrowser Knowledge Base (agent memory, see knowledge/):
• 7 JSONL collections: anti-patterns, api-behaviors, codebase-facts, decisions, facts, gotchas, patterns
• 10 markdown docs: openclawd, clawd-character, clawd-code-cli, clawd-tui, clawdrouter, wiki, architecture, sovereign-research, hermes-memory
Load: knowledge.searchFacts('solana') / CLI: knowledge, kb, facts.

Learn more: https://x402.wtf · https://x402.space · https://zk.x402.wtf`;
}

module.exports = {
  X402_PROTOCOL_KNOWLEDGE,
  getX402Knowledge,
  getX402PromptContext
};
