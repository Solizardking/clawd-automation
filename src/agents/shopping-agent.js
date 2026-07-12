const BaseAgent = require('./base-agent');
const x402Service = require('../services/x402-token');

class ShoppingAgent extends BaseAgent {
  constructor() {
    super('ShoppingAgent', 'shopping', [
      'product_search',
      'price_comparison',
      'deal_finding',
      'personalized_recommendations',
      'x402_payment_integration'
    ]);
  }

  /**
   * Execute shopping actions
   */
  async executeAction(action, params) {
    const actions = {
      search_products: () => this.searchProducts(params),
      compare_prices: () => this.comparePrices(params),
      find_deals: () => this.findDeals(params),
      recommend_products: () => this.recommendProducts(params),
      calculate_total: () => this.calculateTotal(params),
      optimize_cart: () => this.optimizeCart(params),
      track_price: () => this.trackPrice(params)
    };

    const actionFn = actions[action];
    if (!actionFn) {
      throw new Error(`Unknown action: ${action}`);
    }

    return await actionFn();
  }

  /**
   * Search for products
   */
  async searchProducts(params) {
    const { query, category, priceRange, filters } = params;

    const searchPrompt = `
      Search for products matching:
      Query: ${query}
      Category: ${category || 'all'}
      Price Range: ${priceRange ? `$${priceRange.min} - $${priceRange.max}` : 'any'}
      Filters: ${filters ? JSON.stringify(filters) : 'none'}

      Provide a curated list with:
      1. Product names
      2. Descriptions
      3. Estimated prices in USD and X402
      4. Quality ratings
      5. Availability
    `;

    const results = await this.think(searchPrompt);

    // Get X402 price for conversion
    const x402Price = await x402Service.getMarketStats();

    return {
      query,
      category,
      priceRange,
      results,
      x402Price: x402Price.price,
      timestamp: Date.now()
    };
  }

  /**
   * Compare prices across platforms
   */
  async comparePrices(params) {
    const { productName, platforms } = params;

    const comparisonPrompt = `
      Compare prices for "${productName}" across these platforms:
      ${platforms.join(', ')}

      Provide:
      1. Price on each platform
      2. Shipping costs
      3. Total cost
      4. Estimated delivery time
      5. Best value recommendation
      6. Prices in both USD and X402 equivalent
    `;

    const comparison = await this.think(comparisonPrompt);

    const x402Stats = await x402Service.getMarketStats();

    return {
      product: productName,
      platforms,
      comparison,
      x402ConversionRate: x402Stats.price,
      timestamp: Date.now()
    };
  }

  /**
   * Find deals and discounts
   */
  async findDeals(params) {
    const { categories, budget, preferences } = params;

    const dealsPrompt = `
      Find the best deals and discounts for:
      Categories: ${categories.join(', ')}
      Budget: $${budget}
      Preferences: ${preferences ? JSON.stringify(preferences) : 'none'}

      Provide:
      1. Top 10 deals
      2. Discount percentage
      3. Original vs sale price
      4. Deal expiration
      5. Why it's a good deal
      6. X402 payment benefits (if any)
    `;

    const deals = await this.think(dealsPrompt);

    return {
      categories,
      budget,
      deals,
      potentialSavings: this.calculateSavings(deals),
      timestamp: Date.now()
    };
  }

  /**
   * Recommend personalized products
   */
  async recommendProducts(params) {
    const { userProfile, purchaseHistory, preferences, budget } = params;

    const recommendationPrompt = `
      Recommend products based on:

      User Profile:
      ${JSON.stringify(userProfile, null, 2)}

      Purchase History:
      ${purchaseHistory ? purchaseHistory.slice(0, 10).join(', ') : 'none'}

      Preferences:
      ${JSON.stringify(preferences, null, 2)}

      Budget: $${budget}

      Provide:
      1. Top 10 personalized recommendations
      2. Why each product matches user preferences
      3. Confidence score for each recommendation
      4. Price in USD and X402
      5. Similar alternatives
    `;

    const recommendations = await this.think(recommendationPrompt);

    return {
      userProfile,
      budget,
      recommendations,
      timestamp: Date.now()
    };
  }

  /**
   * Calculate cart total with X402 discount
   */
  async calculateTotal(params) {
    const { items, paymentMethod, discountCode } = params;

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // X402 payment discount (e.g., 2%)
    const x402Discount = paymentMethod === 'X402' ? subtotal * 0.02 : 0;

    // Discount code
    let codeDiscount = 0;
    if (discountCode) {
      codeDiscount = this.applyDiscountCode(discountCode, subtotal);
    }

    const total = subtotal - x402Discount - codeDiscount;

    const x402Stats = await x402Service.getMarketStats();
    const totalInX402 = total / x402Stats.price;

    const summaryPrompt = `
      Create a friendly cart summary for:
      Subtotal: $${subtotal.toFixed(2)}
      X402 Payment Discount: $${x402Discount.toFixed(2)}
      Discount Code Savings: $${codeDiscount.toFixed(2)}
      Total: $${total.toFixed(2)} (${totalInX402.toFixed(2)} X402)
    `;

    const summary = await this.think(summaryPrompt);

    return {
      items,
      pricing: {
        subtotal,
        x402Discount,
        codeDiscount,
        total,
        totalInX402
      },
      summary,
      timestamp: Date.now()
    };
  }

  /**
   * Optimize shopping cart
   */
  async optimizeCart(params) {
    const { cart, budget, priorities } = params;

    const optimizationPrompt = `
      Optimize this shopping cart:

      Current Cart:
      ${JSON.stringify(cart, null, 2)}

      Budget: $${budget}
      Priorities: ${priorities.join(', ')}

      Provide:
      1. Items to keep
      2. Items to remove
      3. Alternative cheaper options
      4. Bundle deals
      5. Optimized total
      6. Savings achieved
    `;

    const optimization = await this.think(optimizationPrompt);

    return {
      originalCart: cart,
      budget,
      optimization,
      timestamp: Date.now()
    };
  }

  /**
   * Track price changes
   */
  async trackPrice(params) {
    const { productId, targetPrice, notifyMethod } = params;

    const tracking = {
      id: this.generateTrackingId(),
      productId,
      targetPrice,
      currentPrice: params.currentPrice,
      notifyMethod,
      active: true,
      createdAt: Date.now()
    };

    const notificationPrompt = `
      Create a price tracking notification template for:
      Product ID: ${productId}
      Target Price: $${targetPrice}
      Current Price: $${params.currentPrice}
    `;

    const notification = await this.think(notificationPrompt);

    return {
      ...tracking,
      notificationTemplate: notification
    };
  }

  /**
   * Generate shopping insights
   */
  async generateInsights(params) {
    const { purchaseHistory, spending, preferences } = params;

    const insightsPrompt = `
      Analyze shopping behavior and provide insights:

      Purchase History: ${purchaseHistory.length} items
      Total Spending: $${spending.total}
      Average Order: $${spending.average}
      Preferences: ${JSON.stringify(preferences, null, 2)}

      Provide:
      1. Spending patterns
      2. Favorite categories
      3. Money-saving opportunities
      4. Product recommendations
      5. Budget optimization tips
      6. X402 token benefits for future purchases
    `;

    const insights = await this.think(insightsPrompt);

    return {
      stats: {
        totalPurchases: purchaseHistory.length,
        totalSpending: spending.total,
        averageOrder: spending.average
      },
      insights,
      timestamp: Date.now()
    };
  }

  /**
   * Helper: Calculate savings from deals
   */
  calculateSavings(dealsText) {
    // Simple extraction - in production, parse actual deal data
    const savingsMatch = dealsText.match(/save.*?(\d+)%/gi);
    if (savingsMatch) {
      const percentages = savingsMatch.map(s =>
        parseInt(s.match(/\d+/)[0])
      );
      const avgSavings = percentages.reduce((a, b) => a + b, 0) / percentages.length;
      return {
        averageDiscount: avgSavings,
        dealCount: percentages.length
      };
    }
    return { averageDiscount: 0, dealCount: 0 };
  }

  /**
   * Helper: Apply discount code
   */
  applyDiscountCode(code, subtotal) {
    // Simplified - in production, validate against database
    const discountCodes = {
      'X402SAVE10': subtotal * 0.10,
      'X402SAVE20': subtotal * 0.20,
      'WELCOME': 10.00
    };

    return discountCodes[code.toUpperCase()] || 0;
  }

  /**
   * Helper: Generate tracking ID
   */
  generateTrackingId() {
    return `TRACK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = ShoppingAgent;
