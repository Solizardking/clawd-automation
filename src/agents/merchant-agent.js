const BaseAgent = require('./base-agent');
const x402Service = require('../services/x402-token');

class MerchantAgent extends BaseAgent {
  constructor() {
    super('MerchantAgent', 'merchant', [
      'payment_processing',
      'inventory_management',
      'pricing_strategy',
      'customer_analytics',
      'x402_integration'
    ]);

    this.acceptedTokens = [
      { symbol: 'X402', mint: process.env.X402_TOKEN_MINT },
      { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112' }
    ];
  }

  /**
   * Execute merchant actions
   */
  async executeAction(action, params) {
    const actions = {
      create_payment_request: () => this.createPaymentRequest(params),
      verify_payment: () => this.verifyPayment(params),
      calculate_price: () => this.calculatePrice(params),
      manage_inventory: () => this.manageInventory(params),
      analyze_sales: () => this.analyzeSales(params),
      create_discount: () => this.createDiscount(params),
      process_refund: () => this.processRefund(params)
    };

    const actionFn = actions[action];
    if (!actionFn) {
      throw new Error(`Unknown action: ${action}`);
    }

    return await actionFn();
  }

  /**
   * Create payment request
   */
  async createPaymentRequest(params) {
    const { amount, currency, productId, customerId } = params;

    let amountInX402;
    if (currency === 'USD') {
      const x402Price = await x402Service.getMarketStats();
      amountInX402 = amount / x402Price.price;
    } else {
      amountInX402 = amount;
    }

    const paymentRequest = {
      id: this.generatePaymentId(),
      amount: amountInX402,
      amountUSD: currency === 'USD' ? amount : null,
      token: 'X402',
      tokenMint: this.acceptedTokens[0].mint,
      productId,
      customerId,
      status: 'pending',
      expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
      createdAt: Date.now()
    };

    const aiMessage = await this.think(`
      Create a customer-friendly payment message for:
      Amount: ${amountInX402.toFixed(2)} X402 (${currency === 'USD' ? '$' + amount : amount})
      Product ID: ${productId}
    `);

    return {
      ...paymentRequest,
      customerMessage: aiMessage
    };
  }

  /**
   * Verify payment
   */
  async verifyPayment(params) {
    const { paymentId, txSignature, walletAddress } = params;

    // In production, verify the actual transaction on-chain
    const verification = {
      paymentId,
      txSignature,
      verified: true, // Simulate verification
      timestamp: Date.now()
    };

    const aiConfirmation = await this.think(`
      Generate a payment confirmation message for:
      Payment ID: ${paymentId}
      Transaction: ${txSignature}
      Customer Wallet: ${walletAddress}
    `);

    return {
      ...verification,
      confirmationMessage: aiConfirmation
    };
  }

  /**
   * Calculate dynamic pricing
   */
  async calculatePrice(params) {
    const { basePrice, productType, demand, inventory } = params;

    const x402Stats = await x402Service.getMarketStats();

    // Dynamic pricing algorithm
    const demandMultiplier = demand > 100 ? 1.2 : demand > 50 ? 1.1 : 1.0;
    const inventoryMultiplier = inventory < 10 ? 1.3 : inventory < 50 ? 1.1 : 1.0;

    const dynamicPrice = basePrice * demandMultiplier * inventoryMultiplier;
    const priceInX402 = dynamicPrice / x402Stats.price;

    const aiPricing = await this.think(`
      Analyze this pricing strategy:
      Base Price: $${basePrice}
      Demand Level: ${demand}
      Inventory: ${inventory}
      Dynamic Price: $${dynamicPrice.toFixed(2)}
      X402 Price: ${priceInX402.toFixed(2)} X402
    `);

    return {
      basePrice,
      dynamicPrice,
      priceInX402,
      priceInUSD: dynamicPrice,
      factors: {
        demand: demandMultiplier,
        inventory: inventoryMultiplier
      },
      aiPricingStrategy: aiPricing
    };
  }

  /**
   * Manage inventory
   */
  async manageInventory(params) {
    const { productId, action, quantity } = params;

    const inventoryActions = {
      add: (current, qty) => current + qty,
      remove: (current, qty) => Math.max(0, current - qty),
      set: (current, qty) => qty
    };

    const newQuantity = inventoryActions[action](params.currentQuantity || 0, quantity);

    const aiInventoryAdvice = await this.think(`
      Provide inventory management advice for:
      Product: ${productId}
      Action: ${action}
      New Quantity: ${newQuantity}
      Include reorder recommendations if quantity is low.
    `);

    return {
      productId,
      previousQuantity: params.currentQuantity || 0,
      newQuantity,
      action,
      aiAdvice: aiInventoryAdvice,
      reorderNeeded: newQuantity < 20
    };
  }

  /**
   * Analyze sales
   */
  async analyzeSales(params) {
    const { period, transactions } = params;

    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const avgTransaction = totalRevenue / transactions.length;

    const topProducts = this.getTopProducts(transactions);
    const topCustomers = this.getTopCustomers(transactions);

    const aiAnalysis = await this.think(`
      Analyze these sales metrics and provide business insights:
      Period: ${period}
      Total Transactions: ${transactions.length}
      Total Revenue: ${totalRevenue} X402
      Average Transaction: ${avgTransaction.toFixed(2)} X402
      Top Products: ${JSON.stringify(topProducts)}
      Top Customers: ${JSON.stringify(topCustomers)}
    `);

    return {
      period,
      metrics: {
        totalRevenue,
        totalTransactions: transactions.length,
        avgTransaction,
        topProducts,
        topCustomers
      },
      aiAnalysis
    };
  }

  /**
   * Create discount/promotion
   */
  async createDiscount(params) {
    const { discountType, value, conditions, expiresIn } = params;

    const discount = {
      id: this.generateDiscountId(),
      type: discountType, // 'percentage' or 'fixed'
      value,
      conditions,
      expiresAt: Date.now() + expiresIn,
      createdAt: Date.now()
    };

    const aiPromotion = await this.think(`
      Create a compelling promotional message for:
      Discount Type: ${discountType}
      Value: ${value}${discountType === 'percentage' ? '%' : ' X402'}
      Conditions: ${JSON.stringify(conditions)}
    `);

    return {
      ...discount,
      promotionalMessage: aiPromotion
    };
  }

  /**
   * Process refund
   */
  async processRefund(params) {
    const { orderId, reason, amount, customerWallet } = params;

    const refund = {
      id: this.generateRefundId(),
      orderId,
      reason,
      amount,
      customerWallet,
      status: 'processing',
      createdAt: Date.now()
    };

    const aiRefundMessage = await this.think(`
      Generate a professional refund notification for:
      Order: ${orderId}
      Amount: ${amount} X402
      Reason: ${reason}
    `);

    return {
      ...refund,
      customerMessage: aiRefundMessage
    };
  }

  /**
   * Helper: Get top products
   */
  getTopProducts(transactions) {
    const productCount = {};
    transactions.forEach(tx => {
      productCount[tx.productId] = (productCount[tx.productId] || 0) + 1;
    });

    return Object.entries(productCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([productId, count]) => ({ productId, count }));
  }

  /**
   * Helper: Get top customers
   */
  getTopCustomers(transactions) {
    const customerSpending = {};
    transactions.forEach(tx => {
      customerSpending[tx.customerId] =
        (customerSpending[tx.customerId] || 0) + tx.amount;
    });

    return Object.entries(customerSpending)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([customerId, total]) => ({ customerId, total }));
  }

  /**
   * Helper: Generate payment ID
   */
  generatePaymentId() {
    return `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper: Generate discount ID
   */
  generateDiscountId() {
    return `DISC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper: Generate refund ID
   */
  generateRefundId() {
    return `REF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = MerchantAgent;
