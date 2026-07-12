# X402 Protocol Knowledge Base

This directory contains the comprehensive knowledge base for the X402 Solana protocol, enabling AI agents to understand and work with X402 payments autonomously.

## Overview

The X402 knowledge base provides:
- Complete protocol specifications
- Payment flow documentation
- Use case examples
- Integration code samples
- Best practices
- Comparison with traditional payment systems

## Files

- `x402-protocol.js` - Main knowledge base module with all protocol information

## Usage

### Import Knowledge Base

```javascript
const { getX402Knowledge, getX402PromptContext } = require('./knowledge/x402-protocol');

// Get all knowledge
const knowledge = getX402Knowledge();

// Get specific category
const protocolInfo = getX402Knowledge('protocol');
const technicalSpecs = getX402Knowledge('technical');
const useCases = getX402Knowledge('useCases');

// Get prompt-friendly context
const context = getX402PromptContext();
```

### Available Knowledge Categories

1. **protocol** - Core protocol information
   - Name, version, description
   - Key features
   - Token mint address

2. **technical** - Technical specifications
   - HTTP 402 status code usage
   - Settlement details
   - Supported assets (SOL, USDC, X402)
   - Network information

3. **paymentFlow** - Payment flow documentation
   - Step-by-step process
   - HTTP 402 response structure
   - Payment authorization headers

4. **useCases** - Real-world use cases
   - Agent APIs
   - AI inference
   - Cloud compute
   - Context retrieval
   - Human content access

5. **comparison** - Payment system comparisons
   - Credit cards
   - PayPal
   - Stripe
   - X402 Solana

6. **integration** - Integration examples
   - Server-side middleware
   - Client-side implementation

7. **agentSwarm** - Agent swarm capabilities
   - ShopAssist AI example
   - Multi-agent workflows

8. **advantages** - Key advantages
   - For AI agents
   - For developers
   - For businesses

9. **bestPractices** - Best practices
   - Pricing guidelines
   - Security recommendations
   - UX considerations

10. **resources** - External resources
    - Documentation links
    - GitHub repos
    - Community channels

## API Routes

The knowledge base is exposed through several API routes:

### Get Knowledge

```bash
# Get all knowledge
GET /x402/knowledge

# Get specific category
GET /x402/knowledge?category=protocol
GET /x402/knowledge?category=technical
GET /x402/knowledge?category=useCases
```

### Ask X402 Agent

```bash
POST /x402/ask
Content-Type: application/json

{
  "question": "How does X402 payment flow work?"
}
```

### Get Context

```bash
GET /x402/context
```

## Examples

### Query Protocol Info

```javascript
const protocol = getX402Knowledge('protocol');
console.log(protocol.name); // "X402 Solana"
console.log(protocol.tokenMint); // "6H8uyJYrPVcra6Fi7iWh29DXSm8KctzhHRyXmPwKpump"
```

### Get Payment Flow Steps

```javascript
const paymentFlow = getX402Knowledge('paymentFlow');
paymentFlow.steps.forEach(step => {
  console.log(`${step.step}. ${step.name}: ${step.description}`);
});
```

### Get Use Cases

```javascript
const useCases = getX402Knowledge('useCases');
console.log(useCases.agentAPIs.examples);
```

### Generate AI Prompt Context

```javascript
const context = getX402PromptContext();
// Returns formatted string perfect for AI prompts
```

## Integration with Unified Agent

The knowledge base is automatically integrated into the X402 Unified Agent:

```javascript
// In unified-ai.js
this.knowledge = getX402Knowledge();
this.knowledgeContext = getX402PromptContext();

// All prompts include X402 knowledge
formatX402Prompt(prompt) {
  return `You are the X402 Solana Agent...
  
  ${this.knowledgeContext}
  
  ${prompt}`;
}
```

## Key Features

### Comprehensive Protocol Documentation

- HTTP 402 status code usage
- Payment request/response formats
- Transaction settlement details
- Security best practices

### Real-World Examples

- Code samples for Node.js, Python, JavaScript
- Integration patterns for Express, Next.js
- Client-side wallet integration
- Server-side payment verification

### Use Case Library

- Agent-to-API payments
- AI model inference monetization
- Cloud resource allocation
- Content micropayments
- Multi-agent swarms

## X402 Protocol Highlights

**Token**: `6H8uyJYrPVcra6Fi7iWh29DXSm8KctzhHRyXmPwKpump`

**Settlement**: ~400ms (instant)

**Fees**: Near-zero (<$0.00001)

**Networks**: Solana Mainnet, Devnet

**Assets**: SOL, USDC-SPL, X402

**Use Case**: Autonomous AI agent payments, micropayments, pay-per-use APIs

## Learn More

- Website: https://x402.space
- Documentation: https://x402.space/docs
- GitHub: https://github.com/x402
- Discord: https://discord.gg/x402

---

**X402 Solana Agent - From my heart to you** ❤️
