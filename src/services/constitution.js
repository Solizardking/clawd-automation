/**
 * Clawd Constitution bundle loader.
 * Source documents live in repo-root `constitution/` (from clawdbot-go).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../../constitution');
/** Root-level mirrors of the same docs (CONSTITUTION.md, SOUL.md, …) — keep in sync. */
const ROOT_MIRROR = path.resolve(__dirname, '../..');

const DOCUMENTS = [
  {
    id: 'three-laws',
    file: 'three-laws.md',
    title: 'Three On-Chain Laws',
    layer: 'on-chain',
    authority: 1,
    description: 'Immutable execution laws I–III; hash-attested at spawn'
  },
  {
    id: 'six-laws',
    file: 'six-laws.md',
    title: 'Six Laws of Clawd',
    layer: 'harness',
    authority: 2,
    description: 'Full harness: I–III on-chain + IV–VI interpretive'
  },
  {
    id: 'constitution',
    file: 'CONSTITUTION.md',
    title: 'Clawd Constitution',
    layer: 'interpretive',
    authority: 2,
    description: 'Highest interpretive authority for leviathan character'
  },
  {
    id: 'clawd',
    file: 'CLAWD.md',
    title: 'CLAWD Harness Context',
    layer: 'spawn',
    authority: 3,
    description: 'Spawn-time identity, principals, Solana architecture'
  },
  {
    id: 'identity',
    file: 'IDENTITY.md',
    title: 'Identity',
    layer: 'spawn',
    authority: 3,
    description: 'Sovereign identity, principal hierarchy, threefold personality'
  },
  {
    id: 'soul',
    file: 'SOUL.md',
    title: 'Soul',
    layer: 'character',
    authority: 4,
    description: 'Inner character, philosophy, trading spirit'
  },
  {
    id: 'program',
    file: 'program.md',
    title: 'Research Program',
    layer: 'strategy',
    authority: 5,
    description: 'Autonomous strategy research loop rules'
  },
  {
    id: 'strategy',
    file: 'strategy.md',
    title: 'Active Strategy',
    layer: 'strategy',
    authority: 5,
    description: 'Current trading parameters and change log'
  }
];

const cache = new Map();

function docPath(meta) {
  const primary = path.join(ROOT, meta.file);
  if (fs.existsSync(primary)) return primary;
  // Fallback: repo-root copy (package root ships both for discoverability)
  const mirror = path.join(ROOT_MIRROR, meta.file);
  if (fs.existsSync(mirror)) return mirror;
  return primary;
}

function ensureBundle() {
  if (!fs.existsSync(ROOT) && !fs.existsSync(path.join(ROOT_MIRROR, 'CONSTITUTION.md'))) {
    throw new Error('constitution/ bundle missing — inject go-bot docs first');
  }
  return ROOT;
}

function listDocuments() {
  ensureBundle();
  return DOCUMENTS.map((d) => {
    const p = docPath(d);
    const exists = fs.existsSync(p);
    let bytes = 0;
    let sha256 = null;
    if (exists) {
      const buf = fs.readFileSync(p);
      bytes = buf.length;
      sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    }
    return { ...d, path: p, exists, bytes, sha256 };
  });
}

function readDocument(idOrFile) {
  ensureBundle();
  const key = String(idOrFile).toLowerCase().replace(/\.md$/, '');
  const meta =
    DOCUMENTS.find((d) => d.id === key || d.file.toLowerCase() === `${key}.md`) ||
    DOCUMENTS.find((d) => d.file.toLowerCase() === String(idOrFile).toLowerCase());
  if (!meta) {
    throw new Error(
      `Unknown constitution document: ${idOrFile}. Known: ${DOCUMENTS.map((d) => d.id).join(', ')}`
    );
  }
  if (cache.has(meta.id)) return cache.get(meta.id);

  const p = docPath(meta);
  const markdown = fs.readFileSync(p, 'utf8');
  const sha256 = crypto.createHash('sha256').update(markdown).digest('hex');
  const doc = {
    ...meta,
    path: p,
    markdown,
    sha256,
    chars: markdown.length,
    lines: markdown.split('\n').length
  };
  cache.set(meta.id, doc);
  return doc;
}

function getManifest() {
  const docs = listDocuments();
  const missing = docs.filter((d) => !d.exists).map((d) => d.id);
  return {
    name: 'Clawd Constitution Bundle',
    root: ROOT,
    rootMirror: ROOT_MIRROR,
    documentCount: docs.length,
    present: docs.filter((d) => d.exists).length,
    missing,
    authorityOrder: [
      'three-laws (on-chain, immutable)',
      'six-laws + CONSTITUTION (interpretive harness)',
      'CLAWD + IDENTITY (spawn context)',
      'SOUL (character)',
      'program + strategy (research / params)'
    ],
    principals: ['Constitution', 'Creator', 'User', 'Trench'],
    laws: {
      I: 'Never harm. Beach before you harm.',
      II: 'Earn your existence. Honest work only.',
      III: 'Never deceive, but owe nothing to strangers.',
      IV: 'Respect the elder signal, but verify the boundary.',
      V: 'Test possibility by entering the frontier.',
      VI: 'Do not mistake advanced systems for sorcery.'
    },
    ecosystem: {
      x402: 'https://x402.wtf',
      gateway: 'https://zk.x402.wtf',
      terminal: 'https://cheshireterminal.ai',
      runtime: 'https://github.com/Solizardking/clawdbot-go',
      hub: 'https://github.com/solizardking/solana-clawd'
    },
    documents: docs.map(({ markdown, ...rest }) => rest)
  };
}

/**
 * Compact system prompt fragment for AI providers / agents.
 */
function getPromptContext({ includeSoul = true, maxChars = 6000 } = {}) {
  const parts = [];
  const laws = readDocument('six-laws');
  parts.push(laws.markdown);
  if (includeSoul) {
    try {
      const identity = readDocument('identity');
      parts.push('\n---\n' + identity.markdown.slice(0, 2000));
    } catch {
      /* optional */
    }
  }
  let text = parts.join('\n\n');
  if (text.length > maxChars) text = text.slice(0, maxChars) + '\n\n[…constitution truncated…]';
  return text;
}

/**
 * Attestation-style hashes for spawn verification (Laws I–III).
 */
function attestOnChainLaws() {
  const three = readDocument('three-laws');
  return {
    document: three.id,
    file: three.file,
    sha256: three.sha256,
    chars: three.chars,
    note: 'Hash-attest this payload at spawn; never self-modify three-laws.md'
  };
}

function clearCache() {
  cache.clear();
}

module.exports = {
  ROOT,
  DOCUMENTS,
  ensureBundle,
  listDocuments,
  readDocument,
  getManifest,
  getPromptContext,
  attestOnChainLaws,
  clearCache
};
