/**
 * HTTP 402 Payment Gateway
 * Implements HTTP 402 Payment Required status with X402 SPL token settlement
 *
 * Based on RFC 7231 - HTTP/1.1 Semantics: 402 Payment Required
 * Extended for crypto micropayments on Solana
 */

const express = require('express');
const crypto = require('crypto');
const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const x402Token = require('./x402-spl-token');
const config = require('../config/index.js');

class HTTP402Gateway {
  constructor() {
    this.connection = new Connection(config.solana.rpcUrl);

    // Get X402 token mint from config
    const mintAddress = config.solana?.x402TokenMint || config.x402?.tokenMint || '6H8uyJYrPVcra6Fi7iWh29DXSm8KctzhHRyXmPwKpump';
    this.x402Mint = new PublicKey(mintAddress);

    // Payment challenges (temporary storage, use Redis in production)
    this.challenges = new Map();

    // Pricing for different resources
    this.pricing = {
      // API endpoints
      '/api/agent/analyze': 0.01,
      '/api/agent/trade': 0.05,
      '/api/agent/council': 0.1,
      '/api/market/data': 0.001,
      '/api/market/advanced': 0.01,

      // AI model access
      'vertex_ai_gemini_pro': 0.02,
      'vertex_ai_thinking': 0.05,
      'openrouter_claude': 0.03,

      // Data resources
      'historical_data': 0.005,
      'real_time_feed': 0.01,
      'premium_analytics': 0.1
    };

    // Verified payments cache (signature -> payment info)
    this.paymentCache = new Map();

    // Session-based access (for authenticated users)
    this.sessions = new Map();
  }

  /**
   * Express middleware to require payment for protected routes
   */
  requirePayment(price) {
    return async (req, res, next) => {
      try {
        // Check if request includes payment proof
        const paymentProof = req.headers['x-payment-signature'];

        if (!paymentProof) {
          // No payment - send 402 with payment details
          return this.send402Response(res, price, req.path);
        }

        // Verify payment
        const isValid = await this.verifyPayment(paymentProof, price);

        if (!isValid) {
          return res.status(403).json({
            error: 'Invalid or insufficient payment',
            message: 'Payment verification failed'
          });
        }

        // Payment verified - allow access
        console.log(`✅ Payment verified: ${price} X402 for ${req.path}`);
        next();

      } catch (error) {
        console.error('Payment verification error:', error);
        return res.status(500).json({
          error: 'Payment verification error',
          message: error.message
        });
      }
    };
  }

  /**
   * Send HTTP 402 Payment Required response
   */
  send402Response(res, price, resource) {
    const challengeId = this.generateChallengeId();
    const gateway = process.env.PAYMENT_GATEWAY_WALLET;

    // Create payment challenge
    const challenge = {
      challengeId,
      resource,
      price,
      currency: 'X402',
      gateway,
      createdAt: Date.now(),
      expiresAt: Date.now() + 300000, // 5 minutes
      status: 'pending'
    };

    this.challenges.set(challengeId, challenge);

    // Clean up expired challenges
    setTimeout(() => {
      if (this.challenges.get(challengeId)?.status === 'pending') {
        this.challenges.delete(challengeId);
      }
    }, 300000);

    // Return 402 with payment instructions
    return res.status(402).json({
      error: 'Payment Required',
      message: `This resource requires payment of ${price} X402 tokens`,
      payment: {
        challengeId,
        amount: price,
        currency: 'X402',
        token: config.solana.x402TokenMint,
        recipient: gateway,
        network: 'solana',
        instructions: {
          step1: `Transfer ${price} X402 tokens to ${gateway}`,
          step2: 'Include challengeId in transaction memo',
          step3: 'Retry request with transaction signature in X-Payment-Signature header'
        },
        solana_pay: this.generateSolanaPayURL(gateway, price, challengeId),
        qr_code: this.generatePaymentQR(gateway, price, challengeId)
      },
      docs: 'https://docs.x402.fund/payment-protocol'
    });
  }

  /**
   * Verify payment on Solana
   */
  async verifyPayment(txSignature, expectedAmount) {
    try {
      // Check cache first
      const cached = this.paymentCache.get(txSignature);
      if (cached && cached.amount >= expectedAmount) {
        return true;
      }

      // Fetch transaction from Solana
      const tx = await this.connection.getParsedTransaction(txSignature, {
        maxSupportedTransactionVersion: 0
      });

      if (!tx || !tx.meta) {
        return false;
      }

      // Verify transaction succeeded
      if (tx.meta.err) {
        return false;
      }

      // Extract X402 transfer details
      const x402Transfer = this.extractX402Transfer(tx);

      if (!x402Transfer) {
        return false;
      }

      // Verify amount
      if (x402Transfer.amount < expectedAmount) {
        return false;
      }

      // Verify recipient is our gateway
      const gateway = process.env.PAYMENT_GATEWAY_WALLET;
      if (x402Transfer.recipient !== gateway) {
        return false;
      }

      // Cache verified payment
      this.paymentCache.set(txSignature, {
        amount: x402Transfer.amount,
        sender: x402Transfer.sender,
        timestamp: Date.now()
      });

      return true;

    } catch (error) {
      console.error('Payment verification error:', error);
      return false;
    }
  }

  /**
   * Extract X402 transfer from transaction
   */
  extractX402Transfer(tx) {
    try {
      const instructions = tx.transaction.message.instructions;

      for (const ix of instructions) {
        if (ix.program === 'spl-token' && ix.parsed?.type === 'transfer') {
          const info = ix.parsed.info;

          // Verify it's X402 token
          if (info.mint === config.solana.x402TokenMint) {
            return {
              amount: parseFloat(info.tokenAmount?.uiAmount || 0),
              sender: info.source,
              recipient: info.destination
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting transfer:', error);
      return null;
    }
  }

  /**
   * Generate Solana Pay URL for easy payment
   */
  generateSolanaPayURL(recipient, amount, reference) {
    const params = new URLSearchParams({
      recipient,
      amount,
      'spl-token': config.solana.x402TokenMint,
      reference,
      label: 'X402 Fund Payment',
      message: `Pay ${amount} X402 for resource access`
    });

    return `solana:${recipient}?${params.toString()}`;
  }

  /**
   * Generate payment QR code data
   */
  generatePaymentQR(recipient, amount, reference) {
    const solanaPayURL = this.generateSolanaPayURL(recipient, amount, reference);

    // In production, generate actual QR code image
    // For now, return the data URL
    return {
      url: solanaPayURL,
      qr_api: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(solanaPayURL)}`
    };
  }

  /**
   * Create session after successful payment (for multiple requests)
   */
  async createSession(paymentSignature, credits) {
    const sessionId = this.generateSessionId();

    const session = {
      sessionId,
      paymentSignature,
      credits,
      used: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
      status: 'active'
    };

    this.sessions.set(sessionId, session);

    // Auto-expire session
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 3600000);

    return sessionId;
  }

  /**
   * Middleware for session-based access
   */
  requireSession(costPerRequest) {
    return async (req, res, next) => {
      const sessionId = req.headers['x-session-id'];

      if (!sessionId) {
        return res.status(401).json({
          error: 'Session required',
          message: 'Purchase a session to access this resource'
        });
      }

      const session = this.sessions.get(sessionId);

      if (!session || session.status !== 'active') {
        return res.status(401).json({
          error: 'Invalid or expired session'
        });
      }

      // Check remaining credits
      if (session.used + costPerRequest > session.credits) {
        return res.status(402).json({
          error: 'Insufficient credits',
          message: 'Please purchase more credits',
          remaining: session.credits - session.used
        });
      }

      // Deduct credits
      session.used += costPerRequest;

      console.log(`📊 Session ${sessionId}: ${session.used}/${session.credits} credits used`);

      next();
    };
  }

  /**
   * Get pricing for resource
   */
  getPrice(resource) {
    return this.pricing[resource] || 0.01; // Default 0.01 X402
  }

  /**
   * Set custom pricing
   */
  setPrice(resource, price) {
    this.pricing[resource] = price;
  }

  /**
   * Get active challenges
   */
  getChallenges() {
    return Array.from(this.challenges.values());
  }

  /**
   * Get payment statistics
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s => s.status === 'active');

    return {
      totalPayments: this.paymentCache.size,
      activeSessions: activeSessions.length,
      totalSessions: sessions.length,
      totalRevenue: sessions.reduce((sum, s) => sum + s.credits, 0),
      pendingChallenges: Array.from(this.challenges.values())
        .filter(c => c.status === 'pending').length
    };
  }

  /**
   * Express router with 402-protected endpoints
   */
  createRouter() {
    const router = express.Router();

    // Public endpoint - pricing information
    router.get('/pricing', (req, res) => {
      res.json({
        currency: 'X402',
        token: config.solana.x402TokenMint,
        network: 'solana',
        prices: this.pricing,
        payment_methods: ['solana_pay', 'direct_transfer']
      });
    });

    // Purchase session (bulk credits)
    router.post('/session/purchase', this.requirePayment(1.0), async (req, res) => {
      const { credits } = req.body;
      const paymentSig = req.headers['x-payment-signature'];

      const sessionId = await this.createSession(paymentSig, credits);

      res.json({
        success: true,
        sessionId,
        credits,
        expiresAt: Date.now() + 3600000
      });
    });

    // Check session status
    router.get('/session/:sessionId', (req, res) => {
      const session = this.sessions.get(req.params.sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({
        sessionId: session.sessionId,
        credits: session.credits,
        used: session.used,
        remaining: session.credits - session.used,
        expiresAt: session.expiresAt,
        status: session.status
      });
    });

    // Verify payment
    router.post('/verify', async (req, res) => {
      const { signature, expectedAmount } = req.body;

      const isValid = await this.verifyPayment(signature, expectedAmount);

      res.json({
        valid: isValid,
        signature,
        amount: expectedAmount
      });
    });

    // Gateway statistics
    router.get('/stats', (req, res) => {
      res.json(this.getStats());
    });

    return router;
  }

  // Utility methods

  generateChallengeId() {
    return `challenge_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateSessionId() {
    return `session_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  }
}

module.exports = new HTTP402Gateway();
