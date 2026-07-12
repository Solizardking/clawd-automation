const {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const {
  getAccount,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} = require('@solana/spl-token');
const config = require('../config/index.js');
const solanaService = require('./solana/connection');

class X402SPLTokenService {
  constructor() {
    this.connection = solanaService.getConnection();
    this.tokenMint = new PublicKey(config.x402.tokenMint);

    // X402 Token Info
    this.tokenInfo = {
      mint: config.x402.tokenMint,
      symbol: 'X402',
      name: 'X402',
      decimals: 6,
      pumpFunUrl: 'https://pump.fun/coin/6H8uyJYrPVcra6Fi7iWh29DXSm8KctzhHRyXmPwKpump',
      twitter: 'https://x.com/terminagent',
      website: 'https://x402.space'
    };
  }

  /**
   * Get X402 token info
   */
  getTokenInfo() {
    return this.tokenInfo;
  }

  /**
   * Get associated token account for a wallet
   */
  async getAssociatedTokenAccount(walletAddress) {
    try {
      const walletPubkey = new PublicKey(walletAddress);
      const associatedTokenAddress = await getAssociatedTokenAddress(
        this.tokenMint,
        walletPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      return associatedTokenAddress.toString();
    } catch (error) {
      console.error('Error getting associated token account:', error);
      throw error;
    }
  }

  /**
   * Check if associated token account exists
   */
  async hasTokenAccount(walletAddress) {
    try {
      const ataAddress = await this.getAssociatedTokenAccount(walletAddress);
      const accountInfo = await this.connection.getAccountInfo(new PublicKey(ataAddress));
      return accountInfo !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get X402 balance for wallet
   */
  async getBalance(walletAddress) {
    try {
      const walletPubkey = new PublicKey(walletAddress);
      const ataAddress = await getAssociatedTokenAddress(
        this.tokenMint,
        walletPubkey
      );

      try {
        const tokenAccount = await getAccount(this.connection, ataAddress);
        return Number(tokenAccount.amount) / Math.pow(10, this.tokenInfo.decimals);
      } catch (error) {
        // Account doesn't exist
        return 0;
      }
    } catch (error) {
      console.error('Error getting X402 balance:', error);
      return 0;
    }
  }

  /**
   * Get detailed token account info
   */
  async getTokenAccountInfo(walletAddress) {
    try {
      const walletPubkey = new PublicKey(walletAddress);
      const ataAddress = await getAssociatedTokenAddress(
        this.tokenMint,
        walletPubkey
      );

      const tokenAccount = await getAccount(this.connection, ataAddress);

      return {
        address: ataAddress.toString(),
        mint: tokenAccount.mint.toString(),
        owner: tokenAccount.owner.toString(),
        amount: Number(tokenAccount.amount),
        decimals: this.tokenInfo.decimals,
        uiAmount: Number(tokenAccount.amount) / Math.pow(10, this.tokenInfo.decimals),
        delegate: tokenAccount.delegate?.toString() || null,
        delegatedAmount: tokenAccount.delegatedAmount ? Number(tokenAccount.delegatedAmount) : 0,
        isInitialized: tokenAccount.isInitialized,
        isFrozen: tokenAccount.isFrozen,
        isNative: tokenAccount.isNative,
        rentExemptReserve: tokenAccount.rentExemptReserve ? Number(tokenAccount.rentExemptReserve) : null,
        closeAuthority: tokenAccount.closeAuthority?.toString() || null
      };
    } catch (error) {
      console.error('Error getting token account info:', error);
      return null;
    }
  }

  /**
   * Create transfer instruction
   */
  async createTransferInstruction(fromWallet, toWallet, amount, fromKeypair = null) {
    try {
      const fromPubkey = new PublicKey(fromWallet);
      const toPubkey = new PublicKey(toWallet);

      // Get associated token accounts
      const fromAta = await getAssociatedTokenAddress(
        this.tokenMint,
        fromPubkey
      );

      const toAta = await getAssociatedTokenAddress(
        this.tokenMint,
        toPubkey
      );

      // Check if recipient has token account
      const toAccountInfo = await this.connection.getAccountInfo(toAta);
      const instructions = [];

      // Create recipient ATA if it doesn't exist
      if (!toAccountInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            fromPubkey,
            toAta,
            toPubkey,
            this.tokenMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Add transfer instruction
      const transferAmount = BigInt(Math.floor(amount * Math.pow(10, this.tokenInfo.decimals)));
      instructions.push(
        createTransferInstruction(
          fromAta,
          toAta,
          fromPubkey,
          transferAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      return {
        instructions,
        fromAta: fromAta.toString(),
        toAta: toAta.toString(),
        amount: transferAmount.toString()
      };
    } catch (error) {
      console.error('Error creating transfer instruction:', error);
      throw error;
    }
  }

  /**
   * Get token supply info
   */
  async getSupplyInfo() {
    try {
      const supply = await this.connection.getTokenSupply(this.tokenMint);

      return {
        total: Number(supply.value.amount) / Math.pow(10, this.tokenInfo.decimals),
        decimals: supply.value.decimals,
        uiAmount: supply.value.uiAmount,
        uiAmountString: supply.value.uiAmountString
      };
    } catch (error) {
      console.error('Error getting supply info:', error);
      throw error;
    }
  }

  /**
   * Get largest token holders
   */
  async getLargestHolders(limit = 20) {
    try {
      const largestAccounts = await this.connection.getTokenLargestAccounts(this.tokenMint);

      return largestAccounts.value.slice(0, limit).map((account, index) => ({
        rank: index + 1,
        address: account.address.toString(),
        amount: Number(account.amount) / Math.pow(10, this.tokenInfo.decimals),
        uiAmount: account.uiAmount,
        decimals: account.decimals
      }));
    } catch (error) {
      console.error('Error getting largest holders:', error);
      throw error;
    }
  }

  /**
   * Calculate holder tier
   */
  calculateTier(balance) {
    if (balance >= 100000) return 'DIAMOND';
    if (balance >= 50000) return 'PLATINUM';
    if (balance >= 10000) return 'GOLD';
    if (balance >= 1000) return 'SILVER';
    return 'BRONZE';
  }

  /**
   * Get holder statistics
   */
  async getHolderStats(walletAddress) {
    try {
      const balance = await this.getBalance(walletAddress);
      const tier = this.calculateTier(balance);
      const supply = await this.getSupplyInfo();
      const ownershipPercent = (balance / supply.total) * 100;

      return {
        wallet: walletAddress,
        balance,
        tier,
        ownershipPercent,
        usdValue: 0, // Would need price feed
        rank: null // Would need to calculate from all holders
      };
    } catch (error) {
      console.error('Error getting holder stats:', error);
      throw error;
    }
  }

  /**
   * Get token metadata
   */
  async getTokenMetadata() {
    try {
      const supply = await this.getSupplyInfo();
      const largestHolders = await this.getLargestHolders(10);

      return {
        ...this.tokenInfo,
        supply: supply.total,
        decimals: this.tokenInfo.decimals,
        topHolders: largestHolders.length,
        largestHolders: largestHolders.slice(0, 5),
        links: {
          pumpFun: this.tokenInfo.pumpFunUrl,
          twitter: this.tokenInfo.twitter,
          website: this.tokenInfo.website,
          solscan: `https://solscan.io/token/${this.tokenInfo.mint}`,
          dexscreener: `https://dexscreener.com/solana/${this.tokenInfo.mint}`,
          birdeye: `https://birdeye.so/token/${this.tokenInfo.mint}`
        }
      };
    } catch (error) {
      console.error('Error getting token metadata:', error);
      throw error;
    }
  }

  /**
   * Validate X402 holder for access
   */
  async validateHolder(walletAddress, minimumBalance = 1000) {
    try {
      const balance = await this.getBalance(walletAddress);
      const tier = this.calculateTier(balance);
      const hasAccess = balance >= minimumBalance;

      return {
        wallet: walletAddress,
        balance,
        tier,
        hasAccess,
        minimumRequired: minimumBalance,
        deficit: Math.max(0, minimumBalance - balance)
      };
    } catch (error) {
      console.error('Error validating holder:', error);
      throw error;
    }
  }

  /**
   * Get token program account info
   */
  async getTokenProgramInfo() {
    try {
      const accountInfo = await this.connection.getParsedAccountInfo(this.tokenMint);

      if (!accountInfo.value) {
        throw new Error('Token mint account not found');
      }

      const data = accountInfo.value.data;

      return {
        mint: this.tokenMint.toString(),
        mintAuthority: data.parsed?.info?.mintAuthority || null,
        supply: data.parsed?.info?.supply || null,
        decimals: data.parsed?.info?.decimals || this.tokenInfo.decimals,
        isInitialized: data.parsed?.info?.isInitialized || false,
        freezeAuthority: data.parsed?.info?.freezeAuthority || null
      };
    } catch (error) {
      console.error('Error getting token program info:', error);
      throw error;
    }
  }

  /**
   * Monitor token transfers for a wallet
   */
  async monitorTransfers(walletAddress, callback, options = {}) {
    try {
      const walletPubkey = new PublicKey(walletAddress);
      const ataAddress = await getAssociatedTokenAddress(
        this.tokenMint,
        walletPubkey
      );

      // Subscribe to account changes
      const subscriptionId = this.connection.onAccountChange(
        ataAddress,
        (accountInfo, context) => {
          callback({
            slot: context.slot,
            accountInfo,
            timestamp: Date.now()
          });
        },
        'confirmed'
      );

      return {
        subscriptionId,
        unsubscribe: () => {
          this.connection.removeAccountChangeListener(subscriptionId);
        }
      };
    } catch (error) {
      console.error('Error monitoring transfers:', error);
      throw error;
    }
  }

  /**
   * Get transfer history for wallet
   */
  async getTransferHistory(walletAddress, limit = 50) {
    try {
      const walletPubkey = new PublicKey(walletAddress);
      const ataAddress = await getAssociatedTokenAddress(
        this.tokenMint,
        walletPubkey
      );

      const signatures = await this.connection.getSignaturesForAddress(
        ataAddress,
        { limit }
      );

      const transfers = [];

      for (const sig of signatures) {
        const tx = await this.connection.getParsedTransaction(
          sig.signature,
          { maxSupportedTransactionVersion: 0 }
        );

        if (tx && tx.meta && !tx.meta.err) {
          // Parse transfer details
          const instructions = tx.transaction.message.instructions;
          for (const instruction of instructions) {
            if (instruction.program === 'spl-token' &&
                instruction.parsed?.type === 'transfer') {
              const info = instruction.parsed.info;
              transfers.push({
                signature: sig.signature,
                slot: sig.slot,
                timestamp: sig.blockTime,
                type: 'transfer',
                from: info.source,
                to: info.destination,
                amount: info.amount,
                uiAmount: Number(info.amount) / Math.pow(10, this.tokenInfo.decimals),
                authority: info.authority
              });
            }
          }
        }
      }

      return transfers;
    } catch (error) {
      console.error('Error getting transfer history:', error);
      throw error;
    }
  }

  /**
   * Calculate X402 holder benefits
   */
  getHolderBenefits(balance) {
    const tier = this.calculateTier(balance);

    const benefits = {
      DIAMOND: {
        tier: 'DIAMOND',
        emoji: '💎',
        apiCalls: 'unlimited',
        features: [
          'Unlimited AI agent access',
          'Custom agent creation',
          'Priority support',
          'Advanced analytics',
          'Trading bot access',
          'Early feature access',
          'Governance voting rights'
        ],
        discounts: {
          trading: '100% fee reduction',
          merchant: '5% discount',
          premium: 'All features included'
        }
      },
      PLATINUM: {
        tier: 'PLATINUM',
        emoji: '🏆',
        apiCalls: 10000,
        features: [
          'Unlimited AI agent access',
          'Custom agent creation',
          'Priority support',
          'Advanced analytics',
          'Trading bot access'
        ],
        discounts: {
          trading: '50% fee reduction',
          merchant: '3% discount',
          premium: 'Most features included'
        }
      },
      GOLD: {
        tier: 'GOLD',
        emoji: '🥇',
        apiCalls: 5000,
        features: [
          'All AI agents',
          'Advanced analytics',
          'Trading bot access',
          'Priority queuing'
        ],
        discounts: {
          trading: '25% fee reduction',
          merchant: '2% discount'
        }
      },
      SILVER: {
        tier: 'SILVER',
        emoji: '🥈',
        apiCalls: 1000,
        features: [
          'Standard AI agents',
          'Basic analytics',
          'Standard support'
        ],
        discounts: {
          trading: '10% fee reduction',
          merchant: '1% discount'
        }
      },
      BRONZE: {
        tier: 'BRONZE',
        emoji: '🥉',
        apiCalls: 100,
        features: [
          'Basic AI agent access',
          'Limited analytics'
        ],
        discounts: {
          trading: 'Standard fees',
          merchant: 'No discount'
        }
      }
    };

    return benefits[tier];
  }
}

module.exports = new X402SPLTokenService();
