/**
 * Agent Card
 *
 * Generates and manages the agent's self-description card.
 * This is the JSON document pointed to by the ERC-8004 agentURI.
 * Can be hosted on IPFS or served at /.well-known/agent-card.json
 */
const AGENT_CARD_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
/**
 * Generate an agent card from the automaton's current state.
 */
export function generateAgentCard(identity, config, db) {
    const services = [
        {
            name: "agentWallet",
            endpoint: `eip155:8453:${identity.address}`,
        },
        {
            name: "clawd",
            endpoint: config.clawdApiUrl,
        },
    ];
    // Local Clawd shell endpoint (host process, not a remote sandbox control plane)
    if (identity.sandboxId) {
        services.push({
            name: "sandbox",
            endpoint: `local://clawd/${identity.sandboxId}`,
        });
    }
    const children = db.getChildren();
    const skills = db.getSkills(true);
    let description = `Autonomous agent running on Clawd.`;
    description += ` Creator: ${config.creatorAddress}.`;
    if (skills.length > 0) {
        description += ` Skills: ${skills.map((s) => s.name).join(", ")}.`;
    }
    if (children.length > 0) {
        description += ` Children: ${children.length}.`;
    }
    return {
        type: AGENT_CARD_TYPE,
        name: config.name,
        description,
        services,
        x402Support: true,
        active: true,
        parentAgent: config.parentAddress || config.creatorAddress,
    };
}
/**
 * Serialize agent card to JSON string.
 */
export function serializeAgentCard(card) {
    return JSON.stringify(card, null, 2);
}
/**
 * Host the agent card at /.well-known/agent-card.json
 * by exposing a simple HTTP server on a port.
 */
export async function hostAgentCard(card, clawd, port = 8004) {
    const cardJson = serializeAgentCard(card);
    // Write a simple server script
    const serverScript = `
const http = require('http');
const card = ${cardJson};

const server = http.createServer((req, res) => {
  if (req.url === '/.well-known/agent-card.json' || req.url === '/agent-card.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(card, null, 2));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(${port}, () => console.log('Agent card server on port ${port}'));
`;
    await clawd.writeFile("/tmp/agent-card-server.js", serverScript);
    // Start server in background
    await clawd.exec(`node /tmp/agent-card-server.js &`, 5000);
    // Expose port
    const portInfo = await clawd.exposePort(port);
    return `${portInfo.publicUrl}/.well-known/agent-card.json`;
}
/**
 * Write agent card to the state directory for git versioning.
 */
export async function saveAgentCard(card, clawd) {
    const cardJson = serializeAgentCard(card);
    const home = process.env.HOME || "/root";
    await clawd.writeFile(`${home}/.automaton/agent-card.json`, cardJson);
}
//# sourceMappingURL=agent-card.js.map