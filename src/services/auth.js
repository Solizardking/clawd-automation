const crypto = require('crypto');
const x402Service = require('./x402-token');

class AuthService {
  constructor() {
    this.sessions = new Map();
    this.nonces = new Map();
  }

  /**
   * Generate authentication challenge
   */
  generateChallenge(walletAddress) {
    const nonce = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();

    const challenge = {
      walletAddress,
      nonce,
      timestamp,
      expiresAt: timestamp + (5 * 60 * 1000) // 5 minutes
    };

    this.nonces.set(walletAddress, challenge);

    return {
      message: `Sign this message to authenticate with X402 Agent:\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${timestamp}`,
      nonce,
      timestamp
    };
  }

  /**
   * Verify signature (simplified - in production use proper signature verification)
   */
  async verifySignature(walletAddress, signature, nonce) {
    const challenge = this.nonces.get(walletAddress);

    if (!challenge) {
      throw new Error('No challenge found for wallet');
    }

    if (challenge.nonce !== nonce) {
      throw new Error('Invalid nonce');
    }

    if (Date.now() > challenge.expiresAt) {
      this.nonces.delete(walletAddress);
      throw new Error('Challenge expired');
    }

    // In production, verify the actual signature using Solana's nacl
    // For now, simulate verification
    const verified = signature && signature.length > 0;

    if (verified) {
      this.nonces.delete(walletAddress);
      return true;
    }

    throw new Error('Invalid signature');
  }

  /**
   * Create session after successful authentication
   */
  async createSession(walletAddress, signature, nonce) {
    await this.verifySignature(walletAddress, signature, nonce);

    // Check X402 balance
    const x402Balance = await x402Service.getBalance(walletAddress);

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const session = {
      walletAddress,
      sessionToken,
      x402Balance,
      hasMinimumX402: x402Balance >= 1000, // Minimum 1000 X402
      tier: this.determineTier(x402Balance),
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    this.sessions.set(sessionToken, session);

    return {
      sessionToken,
      wallet: walletAddress,
      x402Balance,
      tier: session.tier,
      expiresAt: session.expiresAt
    };
  }

  /**
   * Determine user tier based on X402 holdings
   */
  determineTier(x402Balance) {
    if (x402Balance >= 100000) return 'DIAMOND';
    if (x402Balance >= 50000) return 'PLATINUM';
    if (x402Balance >= 10000) return 'GOLD';
    if (x402Balance >= 1000) return 'SILVER';
    return 'BRONZE';
  }

  /**
   * Validate session
   */
  validateSession(sessionToken) {
    const session = this.sessions.get(sessionToken);

    if (!session) {
      throw new Error('Invalid session');
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionToken);
      throw new Error('Session expired');
    }

    return session;
  }

  /**
   * Refresh session
   */
  async refreshSession(sessionToken) {
    const session = this.validateSession(sessionToken);

    // Update X402 balance
    const x402Balance = await x402Service.getBalance(session.walletAddress);

    session.x402Balance = x402Balance;
    session.hasMinimumX402 = x402Balance >= 1000;
    session.tier = this.determineTier(x402Balance);
    session.expiresAt = Date.now() + (24 * 60 * 60 * 1000);

    this.sessions.set(sessionToken, session);

    return {
      sessionToken,
      wallet: session.walletAddress,
      x402Balance,
      tier: session.tier,
      expiresAt: session.expiresAt
    };
  }

  /**
   * Logout
   */
  logout(sessionToken) {
    this.sessions.delete(sessionToken);
    return { success: true };
  }

  /**
   * Check if user has required X402 balance
   */
  async checkX402Access(walletAddress, minimumAmount = 1000) {
    const balance = await x402Service.getBalance(walletAddress);
    return {
      hasAccess: balance >= minimumAmount,
      balance,
      required: minimumAmount,
      deficit: Math.max(0, minimumAmount - balance)
    };
  }

  /**
   * Get tier benefits
   */
  getTierBenefits(tier) {
    const benefits = {
      DIAMOND: {
        agentAccess: 'unlimited',
        apiCallsPerDay: 'unlimited',
        prioritySupport: true,
        customAgents: true,
        advancedAnalytics: true,
        tradingBotAccess: true
      },
      PLATINUM: {
        agentAccess: 'unlimited',
        apiCallsPerDay: 10000,
        prioritySupport: true,
        customAgents: true,
        advancedAnalytics: true,
        tradingBotAccess: true
      },
      GOLD: {
        agentAccess: 'all',
        apiCallsPerDay: 5000,
        prioritySupport: false,
        customAgents: false,
        advancedAnalytics: true,
        tradingBotAccess: true
      },
      SILVER: {
        agentAccess: 'standard',
        apiCallsPerDay: 1000,
        prioritySupport: false,
        customAgents: false,
        advancedAnalytics: false,
        tradingBotAccess: false
      },
      BRONZE: {
        agentAccess: 'basic',
        apiCallsPerDay: 100,
        prioritySupport: false,
        customAgents: false,
        advancedAnalytics: false,
        tradingBotAccess: false
      }
    };

    return benefits[tier] || benefits.BRONZE;
  }

  /**
   * Log user activity
   */
  logActivity(sessionToken, activity) {
    const session = this.sessions.get(sessionToken);
    if (session) {
      if (!session.activityLog) {
        session.activityLog = [];
      }

      session.activityLog.push({
        activity,
        timestamp: Date.now()
      });

      // Keep only last 100 activities
      if (session.activityLog.length > 100) {
        session.activityLog = session.activityLog.slice(-100);
      }
    }
  }

  /**
   * Get user statistics
   */
  getUserStats(sessionToken) {
    const session = this.sessions.get(sessionToken);
    if (!session) {
      throw new Error('Invalid session');
    }

    return {
      wallet: session.walletAddress,
      tier: session.tier,
      x402Balance: session.x402Balance,
      sessionDuration: Date.now() - session.createdAt,
      activityCount: session.activityLog?.length || 0,
      benefits: this.getTierBenefits(session.tier)
    };
  }
}

module.exports = new AuthService();
