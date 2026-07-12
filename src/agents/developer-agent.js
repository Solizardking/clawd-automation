const BaseAgent = require('./base-agent');

class DeveloperAgent extends BaseAgent {
  constructor() {
    super('DeveloperAgent', 'developer', [
      'code_generation',
      'code_review',
      'smart_contract_analysis',
      'api_integration',
      'debugging',
      'documentation'
    ]);
  }

  /**
   * Execute developer actions
   */
  async executeAction(action, params) {
    const actions = {
      generate_code: () => this.generateCode(params),
      review_code: () => this.reviewCode(params),
      analyze_contract: () => this.analyzeSmartContract(params),
      create_api_docs: () => this.createApiDocs(params),
      debug_issue: () => this.debugIssue(params),
      suggest_optimization: () => this.suggestOptimization(params),
      generate_tests: () => this.generateTests(params)
    };

    const actionFn = actions[action];
    if (!actionFn) {
      throw new Error(`Unknown action: ${action}`);
    }

    return await actionFn();
  }

  /**
   * Generate code
   */
  async generateCode(params) {
    const { language, description, framework } = params;

    const codePrompt = `
      Generate ${language} code for: ${description}
      ${framework ? `Using framework: ${framework}` : ''}
      Include error handling, comments, and best practices.
      Format the code with proper indentation.
    `;

    const code = await this.think(codePrompt);

    return {
      language,
      description,
      code,
      framework,
      timestamp: Date.now()
    };
  }

  /**
   * Review code
   */
  async reviewCode(params) {
    const { code, language, focusAreas } = params;

    const reviewPrompt = `
      Review this ${language} code and provide feedback:

      ${code}

      Focus areas: ${focusAreas ? focusAreas.join(', ') : 'security, performance, maintainability'}

      Provide:
      1. Issues found (if any)
      2. Security concerns
      3. Performance improvements
      4. Code quality suggestions
      5. Best practices recommendations
    `;

    const review = await this.think(reviewPrompt);

    return {
      code,
      language,
      review,
      focusAreas,
      timestamp: Date.now()
    };
  }

  /**
   * Analyze smart contract
   */
  async analyzeSmartContract(params) {
    const { contractCode, network } = params;

    const analysisPrompt = `
      Analyze this ${network} smart contract for:
      1. Security vulnerabilities
      2. Gas optimization opportunities
      3. Logic errors
      4. Best practices compliance
      5. Reentrancy risks
      6. Access control issues

      Contract Code:
      ${contractCode}

      Provide detailed analysis and recommendations.
    `;

    const analysis = await this.think(analysisPrompt);

    return {
      contractCode,
      network,
      analysis,
      securityScore: this.calculateSecurityScore(analysis),
      timestamp: Date.now()
    };
  }

  /**
   * Create API documentation
   */
  async createApiDocs(params) {
    const { endpoints, serviceName } = params;

    const docsPrompt = `
      Create comprehensive API documentation for ${serviceName}:

      Endpoints:
      ${JSON.stringify(endpoints, null, 2)}

      Include:
      1. Endpoint descriptions
      2. Request/Response formats
      3. Authentication requirements
      4. Rate limits
      5. Error codes
      6. Example requests/responses
      7. SDK code examples (JavaScript/Python)
    `;

    const documentation = await this.think(docsPrompt);

    return {
      serviceName,
      endpoints,
      documentation,
      format: 'markdown',
      timestamp: Date.now()
    };
  }

  /**
   * Debug issue
   */
  async debugIssue(params) {
    const { error, code, context } = params;

    const debugPrompt = `
      Debug this issue:

      Error: ${error}

      Code:
      ${code}

      Context: ${context}

      Provide:
      1. Root cause analysis
      2. Step-by-step debugging approach
      3. Potential fixes
      4. Prevention strategies
    `;

    const debugSolution = await this.think(debugPrompt);

    return {
      error,
      code,
      context,
      solution: debugSolution,
      timestamp: Date.now()
    };
  }

  /**
   * Suggest optimization
   */
  async suggestOptimization(params) {
    const { code, language, optimizationType } = params;

    const optimizationPrompt = `
      Suggest ${optimizationType || 'performance'} optimizations for this ${language} code:

      ${code}

      Provide:
      1. Specific optimization techniques
      2. Refactored code examples
      3. Performance impact estimation
      4. Trade-offs to consider
    `;

    const optimization = await this.think(optimizationPrompt);

    return {
      original: code,
      language,
      optimizationType,
      suggestions: optimization,
      timestamp: Date.now()
    };
  }

  /**
   * Generate tests
   */
  async generateTests(params) {
    const { code, language, testFramework } = params;

    const testPrompt = `
      Generate comprehensive unit tests for this ${language} code:

      ${code}

      ${testFramework ? `Using test framework: ${testFramework}` : 'Use appropriate test framework'}

      Include:
      1. Happy path tests
      2. Edge cases
      3. Error handling tests
      4. Mock/stub examples where needed
      5. Test coverage considerations
    `;

    const tests = await this.think(testPrompt);

    return {
      originalCode: code,
      language,
      testFramework,
      tests,
      timestamp: Date.now()
    };
  }

  /**
   * Generate Solana program
   */
  async generateSolanaProgram(params) {
    const { programType, features } = params;

    const programPrompt = `
      Generate a Solana program (Rust) for: ${programType}

      Features: ${features.join(', ')}

      Include:
      1. Program structure
      2. Instruction handlers
      3. State management
      4. Security checks
      5. Error handling
      6. Documentation
    `;

    const program = await this.think(programPrompt);

    return {
      programType,
      features,
      code: program,
      language: 'rust',
      platform: 'solana',
      timestamp: Date.now()
    };
  }

  /**
   * Create X402 integration guide
   */
  async createX402IntegrationGuide(params) {
    const { platform, useCase } = params;

    const guidePrompt = `
      Create a step-by-step integration guide for X402 token on ${platform}:

      Use Case: ${useCase}

      Include:
      1. Prerequisites
      2. Installation steps
      3. Configuration
      4. Code examples
      5. Testing guidelines
      6. Best practices
      7. Common pitfalls
      8. Troubleshooting
    `;

    const guide = await this.think(guidePrompt);

    return {
      platform,
      useCase,
      guide,
      format: 'markdown',
      timestamp: Date.now()
    };
  }

  /**
   * Calculate security score from analysis
   */
  calculateSecurityScore(analysis) {
    // Simple heuristic - count security-related keywords
    const securityKeywords = [
      'vulnerability',
      'risk',
      'unsafe',
      'warning',
      'critical',
      'exploit'
    ];

    const lowerAnalysis = analysis.toLowerCase();
    const issueCount = securityKeywords.filter(keyword =>
      lowerAnalysis.includes(keyword)
    ).length;

    // Score from 0-100, decreasing with more issues
    return Math.max(0, 100 - (issueCount * 15));
  }

  /**
   * Generate SDK client
   */
  async generateSDKClient(params) {
    const { apiSpec, language, sdkName } = params;

    const sdkPrompt = `
      Generate a ${language} SDK client for: ${sdkName}

      API Specification:
      ${JSON.stringify(apiSpec, null, 2)}

      Include:
      1. Client initialization
      2. All API methods
      3. Error handling
      4. Type definitions
      5. Authentication
      6. Rate limiting
      7. Usage examples
    `;

    const sdk = await this.think(sdkPrompt);

    return {
      sdkName,
      language,
      apiSpec,
      code: sdk,
      timestamp: Date.now()
    };
  }
}

module.exports = DeveloperAgent;
