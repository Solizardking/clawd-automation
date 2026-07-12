/**
 * Security Agents - OpSec, Risk Management, Rug Detection
 * Google Vertex AI + Solana on-chain analysis
 */

const { VertexAI } = require('@google-cloud/vertexai');
const { Connection, PublicKey } = require('@solana/web3.js');
const vertexConfig = require('./vertex-ai-config');
const x402Token = require('../../services/x402-spl-token');
const birdeye = require('../../services/birdeye');
const config = require('../../config/index.js');

class SecurityAgents {
  constructor() {
    this.vertexAI = new VertexAI({
      project: vertexConfig.projectId,
      location: vertexConfig.location
    });

    this.connection = new Connection(config.solana.rpcUrl);

    this.agents = vertexConfig.agents.security;

    // Security incidents log
    this.incidents = [];

    // Blacklist
    this.blacklist = new Set();

    // Risk scores cache
    this.riskCache = new Map();
  }

  /**
   * Run full security analysis on token
   */
  async analyzeToken(tokenAddress) {
    console.log(`\n🔒 Running security analysis on ${tokenAddress}`);

    // Run all security agents in parallel
    const [mcafeeAnalysis, riskAnalysis, rugAnalysis] = await Promise.all([
      this.runMcAfeeAgent(tokenAddress),
      this.runRiskAgent(tokenAddress),
      this.runRugDetector(tokenAddress)
    ]);

    // Aggregate results
    const securityScore = this.calculateSecurityScore({
      mcafee: mcafeeAnalysis,
      risk: riskAnalysis,
      rug: rugAnalysis
    });

    const result = {
      tokenAddress,
      timestamp: Date.now(),
      securityScore,
      threat: this.getThreatLevel(securityScore),
      analyses: {
        opsec: mcafeeAnalysis,
        risk: riskAnalysis,
        rug: rugAnalysis
      },
      recommendation: this.getSecurityRecommendation(securityScore),
      blockers: this.getBlockingIssues({
        mcafee: mcafeeAnalysis,
        risk: riskAnalysis,
        rug: rugAnalysis
      })
    };

    // Cache result
    this.riskCache.set(tokenAddress, result);

    // Log incident if high risk
    if (securityScore < 50) {
      this.logIncident(tokenAddress, result);
    }

    // Auto-blacklist if critical risk
    if (securityScore < 20) {
      this.addToBlacklist(tokenAddress, 'Critical security risk');
    }

    console.log(`🛡️  Security Score: ${securityScore}/100`);
    console.log(`⚠️  Threat Level: ${result.threat}`);

    return result;
  }

  /**
   * McAfee OpSec Agent - Paranoid security checks
   */
  async runMcAfeeAgent(tokenAddress) {
    console.log(`🕵️  Running McAfee OpSec checks...`);

    try {
      // Fetch on-chain data
      const tokenData = await this.getTokenData(tokenAddress);

      const model = this.vertexAI.getGenerativeModel({
        model: vertexConfig.models.reasoning
      });

      const prompt = `${this.agents.mcafee.systemPrompt}

TOKEN SECURITY ANALYSIS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Token: ${tokenAddress}

On-Chain Data:
• Mint Authority: ${tokenData.mintAuthority || 'REVOKED ✅'}
• Freeze Authority: ${tokenData.freezeAuthority || 'REVOKED ✅'}
• Supply: ${tokenData.supply?.toLocaleString() || 'N/A'}
• Decimals: ${tokenData.decimals}
• Top 10 Holders: ${tokenData.top10Percentage}%
• LP Burned: ${tokenData.lpBurned ? 'YES ✅' : 'NO ❌'}
• Age: ${tokenData.ageHours} hours
• Liquidity: $${tokenData.liquidity?.toLocaleString()}

Contract Info:
• Verified: ${tokenData.verified ? 'YES ✅' : 'NO ❌'}
• Upgrade Authority: ${tokenData.upgradeAuthority || 'N/A'}
• Hidden Functions: ${tokenData.hiddenFunctions || 'NONE ✅'}

Team Info:
• Team Doxxed: ${tokenData.teamDoxxed ? 'YES ✅' : 'NO ❌'}
• Social Links: ${tokenData.socialLinks || 'N/A'}
• Audit: ${tokenData.audit || 'NO ❌'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run your paranoid OpSec checklist. Output JSON:
{
  "score": 0-100,
  "confidence": 0-100,
  "redFlags": ["flag1", "flag2"],
  "greenFlags": ["flag1", "flag2"],
  "criticalIssues": ["issue1"],
  "recommendation": "CLEAR|CAUTION|AVOID",
  "reasoning": "detailed analysis"
}`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      return this.parseAgentResponse('mcafee', response);

    } catch (error) {
      console.error('McAfee agent error:', error.message);
      return {
        score: 0,
        confidence: 0,
        error: error.message,
        recommendation: 'AVOID'
      };
    }
  }

  /**
   * Risk Management Agent - Quantitative risk analysis
   */
  async runRiskAgent(tokenAddress) {
    console.log(`📊 Running risk management analysis...`);

    try {
      const tokenData = await this.getTokenData(tokenAddress);
      const marketData = await this.getMarketData(tokenAddress);

      const model = this.vertexAI.getGenerativeModel({
        model: vertexConfig.models.reasoning
      });

      const prompt = `${this.agents.risk_manager.systemPrompt}

RISK ANALYSIS REQUEST:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Token: ${tokenAddress}

Market Metrics:
• Market Cap: $${marketData.marketCap?.toLocaleString()}
• 24h Volume: $${marketData.volume24h?.toLocaleString()}
• Volume/MCap Ratio: ${marketData.volumeRatio?.toFixed(4)}
• Liquidity: $${tokenData.liquidity?.toLocaleString()}
• Liquidity/MCap: ${marketData.liquidityRatio?.toFixed(4)}

Volatility:
• 24h Change: ${marketData.priceChange24h}%
• 7d Volatility: ${marketData.volatility7d}%
• ATH Distance: ${marketData.athDistance}%

Concentration:
• Top 10: ${tokenData.top10Percentage}%
• Top 20: ${tokenData.top20Percentage}%
• Gini Coefficient: ${tokenData.giniCoefficient?.toFixed(4)}

Smart Contract Risk:
• Age: ${tokenData.ageHours} hours
• Audit Status: ${tokenData.audit || 'None'}
• Upgrade Risk: ${tokenData.upgradeAuthority ? 'HIGH ⚠️' : 'LOW ✅'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Calculate risk metrics and position sizing. Output JSON:
{
  "riskScore": 0-100,
  "var95": "Value at Risk 95%",
  "maxDrawdownEstimate": "%",
  "liquidityRisk": 0-100,
  "volatilityRisk": 0-100,
  "concentrationRisk": 0-100,
  "smartContractRisk": 0-100,
  "recommendedPositionSize": "% of portfolio",
  "stopLoss": "% below entry",
  "riskRewardRatio": "number"
}`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      return this.parseAgentResponse('risk_manager', response);

    } catch (error) {
      console.error('Risk agent error:', error.message);
      return {
        riskScore: 100,
        error: error.message
      };
    }
  }

  /**
   * Rug Detector Agent - Scam and rug pull detection
   */
  async runRugDetector(tokenAddress) {
    console.log(`🚨 Running rug pull detection...`);

    try {
      const tokenData = await this.getTokenData(tokenAddress);
      const holderData = await this.getHolderData(tokenAddress);
      const socialData = await this.getSocialData(tokenAddress);

      const model = this.vertexAI.getGenerativeModel({
        model: vertexConfig.models.vision // Can analyze charts and socials
      });

      const prompt = `${this.agents.rug_detector.systemPrompt}

RUG PULL DETECTION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Token: ${tokenAddress}

Rug Risk Indicators:

🔍 On-Chain Red Flags:
• Liquidity: $${tokenData.liquidity?.toLocaleString()} ${tokenData.liquidity < 50000 ? '🚩' : '✅'}
• LP Burned: ${tokenData.lpBurned ? '✅' : '🚩 NOT BURNED'}
• Mint Authority: ${tokenData.mintAuthority ? '🚩 NOT REVOKED' : '✅ REVOKED'}
• Top 5 Holders: ${holderData.top5Percentage}% ${holderData.top5Percentage > 60 ? '🚩' : '✅'}
• Age: ${tokenData.ageHours}h ${tokenData.ageHours < 24 ? '🚩' : '✅'}

📊 Trading Pattern:
• Suspicious Pumps: ${holderData.suspiciousPumps ? '🚩 DETECTED' : '✅ CLEAN'}
• Insider Trading: ${holderData.insiderTrading ? '🚩 DETECTED' : '✅ CLEAN'}
• Wash Trading: ${holderData.washTrading ? '🚩 DETECTED' : '✅ CLEAN'}

👥 Social Analysis:
• Twitter: ${socialData.twitter || 'NONE 🚩'}
• Followers: ${socialData.twitterFollowers?.toLocaleString() || '0'}
• Engagement Rate: ${socialData.engagementRate}%
• Bot Detection: ${socialData.botPercentage}% bots ${socialData.botPercentage > 50 ? '🚩' : '✅'}
• Fake Endorsements: ${socialData.fakeEndorsements ? '🚩 DETECTED' : '✅ CLEAN'}

🌐 Website/Docs:
• Website: ${socialData.website || 'NONE 🚩'}
• Whitepaper: ${socialData.whitepaper ? '✅' : '🚩 NONE'}
• Plagiarism: ${socialData.plagiarismDetected ? '🚩 DETECTED' : '✅ CLEAN'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Analyze rug pull probability. Output JSON:
{
  "rugRiskScore": 0-100,
  "confidence": 0-100,
  "redFlags": ["flag1", "flag2"],
  "criticalRedFlags": ["critical1"],
  "rugProbability": "%",
  "recommendation": "CLEAR|CAUTION|AVOID",
  "reasoning": "detailed analysis",
  "exitStrategy": "immediate|caution|normal"
}`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      return this.parseAgentResponse('rug_detector', response);

    } catch (error) {
      console.error('Rug detector error:', error.message);
      return {
        rugRiskScore: 100,
        recommendation: 'AVOID',
        error: error.message
      };
    }
  }

  /**
   * Calculate aggregate security score
   */
  calculateSecurityScore(analyses) {
    const weights = {
      mcafee: 0.35,
      risk: 0.35,
      rug: 0.30
    };

    let totalScore = 0;

    // McAfee OpSec score (inverted - higher is better)
    totalScore += (analyses.mcafee.score || 0) * weights.mcafee;

    // Risk score (inverted - lower risk is better)
    totalScore += (100 - (analyses.risk.riskScore || 100)) * weights.risk;

    // Rug score (inverted - lower rug risk is better)
    totalScore += (100 - (analyses.rug.rugRiskScore || 100)) * weights.rug;

    return Math.round(totalScore);
  }

  /**
   * Get threat level from security score
   */
  getThreatLevel(score) {
    if (score >= 80) return 'LOW';
    if (score >= 60) return 'MODERATE';
    if (score >= 40) return 'HIGH';
    if (score >= 20) return 'CRITICAL';
    return 'EXTREME';
  }

  /**
   * Get security recommendation
   */
  getSecurityRecommendation(score) {
    if (score >= 70) return 'CLEAR - Safe to proceed';
    if (score >= 50) return 'CAUTION - Proceed with reduced position size';
    if (score >= 30) return 'HIGH RISK - Only for experienced traders';
    return 'AVOID - Critical security issues detected';
  }

  /**
   * Get blocking issues
   */
  getBlockingIssues(analyses) {
    const blockers = [];

    // Critical issues from each agent
    if (analyses.mcafee.criticalIssues) {
      blockers.push(...analyses.mcafee.criticalIssues);
    }

    if (analyses.rug.criticalRedFlags) {
      blockers.push(...analyses.rug.criticalRedFlags);
    }

    return blockers;
  }

  /**
   * Parse agent response
   */
  parseAgentResponse(agentId, responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error(`Failed to parse ${agentId} response:`, error.message);
    }

    return { error: 'Failed to parse response', score: 0 };
  }

  /**
   * Get token data from Solana
   */
  async getTokenData(tokenAddress) {
    // Simplified - in production, fetch from Solana + Birdeye
    return {
      mintAuthority: null,
      freezeAuthority: null,
      supply: 1000000000,
      decimals: 9,
      top10Percentage: 45,
      top20Percentage: 60,
      lpBurned: true,
      ageHours: 168,
      liquidity: 250000,
      verified: true,
      teamDoxxed: false,
      giniCoefficient: 0.72
    };
  }

  /**
   * Get market data
   */
  async getMarketData(tokenAddress) {
    return {
      marketCap: 5000000,
      volume24h: 500000,
      volumeRatio: 0.1,
      liquidityRatio: 0.05,
      priceChange24h: 15.5,
      volatility7d: 45,
      athDistance: -35
    };
  }

  /**
   * Get holder data
   */
  async getHolderData(tokenAddress) {
    return {
      top5Percentage: 35,
      suspiciousPumps: false,
      insiderTrading: false,
      washTrading: false
    };
  }

  /**
   * Get social data
   */
  async getSocialData(tokenAddress) {
    return {
      twitter: 'https://twitter.com/example',
      twitterFollowers: 5000,
      engagementRate: 3.5,
      botPercentage: 15,
      fakeEndorsements: false,
      website: 'https://example.com',
      whitepaper: true,
      plagiarismDetected: false
    };
  }

  /**
   * Log security incident
   */
  logIncident(tokenAddress, analysis) {
    const incident = {
      timestamp: Date.now(),
      tokenAddress,
      securityScore: analysis.securityScore,
      threat: analysis.threat,
      blockers: analysis.blockers
    };

    this.incidents.push(incident);

    console.warn(`⚠️  SECURITY INCIDENT LOGGED: ${tokenAddress}`);
  }

  /**
   * Add to blacklist
   */
  addToBlacklist(tokenAddress, reason) {
    this.blacklist.add(tokenAddress);
    console.error(`🚫 BLACKLISTED: ${tokenAddress} - ${reason}`);
  }

  /**
   * Check if token is blacklisted
   */
  isBlacklisted(tokenAddress) {
    return this.blacklist.has(tokenAddress);
  }

  /**
   * Get security incidents
   */
  getIncidents(limit = 50) {
    return this.incidents.slice(-limit);
  }

  /**
   * Get blacklist
   */
  getBlacklist() {
    return Array.from(this.blacklist);
  }
}

module.exports = new SecurityAgents();
