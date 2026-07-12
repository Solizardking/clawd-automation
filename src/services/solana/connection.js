const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const config = require('../../config/index.js');

class SolanaService {
  constructor() {
    this.connection = new Connection(
      config.solana.rpcUrl || clusterApiUrl('mainnet-beta'),
      'confirmed'
    );
    this.x402TokenMint = new PublicKey(config.x402.tokenMint);
    this.agentWallet = new PublicKey(config.x402.agentWallet);
  }

  /**
   * Get connection instance
   */
  getConnection() {
    return this.connection;
  }

  /**
   * Get SOL balance for an address
   */
  async getBalance(publicKey) {
    try {
      const balance = await this.connection.getBalance(new PublicKey(publicKey));
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(walletAddress, tokenMintAddress = null) {
    try {
      const mintAddress = tokenMintAddress ? new PublicKey(tokenMintAddress) : this.x402TokenMint;
      const walletPubkey = new PublicKey(walletAddress);

      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        walletPubkey,
        { mint: mintAddress }
      );

      if (tokenAccounts.value.length === 0) {
        return 0;
      }

      const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      return balance;
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw error;
    }
  }

  /**
   * Get X402 token balance
   */
  async getX402Balance(walletAddress) {
    return this.getTokenBalance(walletAddress, config.x402.tokenMint);
  }

  /**
   * Get account info
   */
  async getAccountInfo(publicKey) {
    try {
      const accountInfo = await this.connection.getAccountInfo(new PublicKey(publicKey));
      return accountInfo;
    } catch (error) {
      console.error('Error getting account info:', error);
      throw error;
    }
  }

  /**
   * Get recent transactions for an address
   */
  async getRecentTransactions(publicKey, limit = 10) {
    try {
      const pubKey = new PublicKey(publicKey);
      const signatures = await this.connection.getSignaturesForAddress(pubKey, { limit });

      const transactions = await Promise.all(
        signatures.map(async (sig) => {
          const tx = await this.connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          });
          return {
            signature: sig.signature,
            slot: sig.slot,
            timestamp: sig.blockTime,
            status: sig.confirmationStatus,
            transaction: tx
          };
        })
      );

      return transactions;
    } catch (error) {
      console.error('Error getting recent transactions:', error);
      throw error;
    }
  }

  /**
   * Get token accounts for a wallet
   */
  async getTokenAccounts(walletAddress) {
    try {
      const walletPubkey = new PublicKey(walletAddress);
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        walletPubkey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      return tokenAccounts.value.map(account => ({
        pubkey: account.pubkey.toString(),
        mint: account.account.data.parsed.info.mint,
        amount: account.account.data.parsed.info.tokenAmount.uiAmount,
        decimals: account.account.data.parsed.info.tokenAmount.decimals
      }));
    } catch (error) {
      console.error('Error getting token accounts:', error);
      throw error;
    }
  }

  /**
   * Get current slot
   */
  async getCurrentSlot() {
    return await this.connection.getSlot();
  }

  /**
   * Get block time
   */
  async getBlockTime(slot) {
    return await this.connection.getBlockTime(slot);
  }

  /**
   * Verify transaction signature
   */
  async verifyTransaction(signature) {
    try {
      const status = await this.connection.getSignatureStatus(signature);
      return status.value?.confirmationStatus === 'confirmed' ||
             status.value?.confirmationStatus === 'finalized';
    } catch (error) {
      console.error('Error verifying transaction:', error);
      return false;
    }
  }
}

module.exports = new SolanaService();
