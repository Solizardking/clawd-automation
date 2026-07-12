/**
 * ClawdBrowser Knowledge Base Loader
 *
 * Loads the ClawdBrowser knowledge/ directory — JSONL fact files (anti-patterns,
 * api-behaviors, codebase-facts, decisions, facts, gotchas, patterns) plus
 * narrative markdown docs (openclawd, clawd-character, clawd-code-cli, etc).
 *
 * Provides querying, search, and prompt-context generation for AI agents.
 *
 * Pattern mirrors src/knowledge/x402-protocol.js for in-memory knowledge
 * and src/services/constitution.js for file-based loading.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../../knowledge');

// ─── JSONL Collections ────────────────────────────
const JSONL_FILES = [
  { id: 'anti-patterns', file: 'anti-patterns.jsonl', description: 'Things that consistently cause bugs or failures' },
  { id: 'api-behaviors', file: 'api-behaviors.jsonl', description: 'How specific APIs actually behave (not what docs say)' },
  { id: 'codebase-facts', file: 'codebase-facts.jsonl', description: 'Structural facts about the codebase' },
  { id: 'decisions', file: 'decisions.jsonl', description: 'Architectural decisions and rationale' },
  { id: 'facts', file: 'facts.jsonl', description: 'General knowledge facts' },
  { id: 'gotchas', file: 'gotchas.jsonl', description: 'Surprising behaviors and traps' },
  { id: 'patterns', file: 'patterns.jsonl', description: 'Proven code patterns and best practices' },
];

// ─── Markdown Docs ────────────────────────────────
const MD_FILES = [
  { id: 'readme', file: 'README.md', title: 'Knowledge Base Index' },
  { id: 'sovereign-research', file: 'SOVEREIGN_RESEARCH.md', title: 'Sovereign Research' },
  { id: 'architecture', file: 'architecture-pieces.md', title: 'Architecture Pieces' },
  { id: 'clawd-character', file: 'clawd-character.md', title: 'Clawd Character' },
  { id: 'clawd-code-cli', file: 'clawd-code-cli.md', title: 'Clawd Code CLI' },
  { id: 'clawd-tui', file: 'clawd-tui.md', title: 'Clawd TUI' },
  { id: 'clawdrouter', file: 'clawdrouter.md', title: 'ClawdRouter' },
  { id: 'openclawd', file: 'openclawd.md', title: 'OpenClawd' },
  { id: 'openclawd-hermes', file: 'openclawd-hermes-memory.md', title: 'OpenClawd Hermes Memory' },
  { id: 'wiki', file: 'wiki.md', title: 'Wiki' },
];

// ─── Caches ────────────────────────────────────────
const _jsonlCache = new Map();
const _mdCache = new Map();

function ensureBundle() {
  if (!fs.existsSync(ROOT)) {
    throw new Error('knowledge/ bundle missing — copy ClawdBrowser knowledge files first');
  }
  return ROOT;
}

/**
 * Parse a JSONL file into an array of entry objects.
 * Skips comment lines (#) and blank lines.
 */
function parseJSONL(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const entries = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // Skip malformed lines
    }
  }
  return { entries, raw, sha256: crypto.createHash('sha256').update(raw).digest('hex') };
}

/**
 * Load a JSONL collection by id.
 */
function loadCollection(id) {
  ensureBundle();
  if (_jsonlCache.has(id)) return _jsonlCache.get(id);

  const meta = JSONL_FILES.find((f) => f.id === id);
  if (!meta) {
    throw new Error(`Unknown collection: ${id}. Known: ${JSONL_FILES.map((f) => f.id).join(', ')}`);
  }

  const fp = path.join(ROOT, meta.file);
  if (!fs.existsSync(fp)) {
    throw new Error(`Collection file missing: ${meta.file}`);
  }

  const result = { ...meta, ...parseJSONL(fp), path: fp };
  _jsonlCache.set(id, result);
  return result;
}

/**
 * Load a markdown doc by id.
 */
function loadDoc(id) {
  ensureBundle();
  if (_mdCache.has(id)) return _mdCache.get(id);

  const meta = MD_FILES.find((f) => f.id === id);
  if (!meta) {
    throw new Error(`Unknown doc: ${id}. Known: ${MD_FILES.map((f) => f.id).join(', ')}`);
  }

  const fp = path.join(ROOT, meta.file);
  if (!fs.existsSync(fp)) {
    throw new Error(`Doc file missing: ${meta.file}`);
  }

  const markdown = fs.readFileSync(fp, 'utf8');
  const sha256 = crypto.createHash('sha256').update(markdown).digest('hex');

  const result = {
    ...meta,
    path: fp,
    markdown,
    sha256,
    chars: markdown.length,
    lines: markdown.split('\n').length,
  };
  _mdCache.set(id, result);
  return result;
}

/**
 * Search across all JSONL collections by text query.
 * Matches against fact, recommendation, tags, and affectedServices fields.
 */
function searchFacts(query, { limit = 20, collections = null } = {}) {
  ensureBundle();
  const lower = String(query).toLowerCase();
  const targetCollections = collections || JSONL_FILES.map((f) => f.id);
  const results = [];

  for (const colId of targetCollections) {
    let col;
    try {
      col = loadCollection(colId);
    } catch {
      continue;
    }
    for (const entry of col.entries) {
      const haystack = [
        entry.fact,
        entry.recommendation,
        entry.id,
        ...(entry.tags || []),
        ...(entry.affectedServices || []),
        ...(entry.affectedFiles || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!query || haystack.includes(lower)) {
        results.push({ collection: colId, ...entry });
      }
    }
  }

  return results.slice(0, limit);
}

/**
 * Get facts by tag across all collections.
 */
function getByTag(tag, { limit = 20 } = {}) {
  ensureBundle();
  const lower = String(tag).toLowerCase();
  const results = [];

  for (const meta of JSONL_FILES) {
    let col;
    try {
      col = loadCollection(meta.id);
    } catch {
      continue;
    }
    for (const entry of col.entries) {
      if ((entry.tags || []).some((t) => t.toLowerCase().includes(lower))) {
        results.push({ collection: meta.id, ...entry });
      }
    }
  }

  return results.slice(0, limit);
}

/**
 * Get facts by confidence level.
 */
function getByConfidence(level, { limit = 50 } = {}) {
  ensureBundle();
  const lower = String(level).toLowerCase();
  const results = [];

  for (const meta of JSONL_FILES) {
    let col;
    try {
      col = loadCollection(meta.id);
    } catch {
      continue;
    }
    for (const entry of col.entries) {
      if ((entry.confidence || '').toLowerCase() === lower) {
        results.push({ collection: meta.id, ...entry });
      }
    }
  }

  return results.slice(0, limit);
}

/**
 * Generate a compact prompt-context from high-confidence facts.
 */
function getPromptContext({ maxChars = 8000, minConfidence = 'high' } = {}) {
  const confidenceOrder = { high: 3, medium: 2, low: 1 };
  const minLevel = confidenceOrder[minConfidence] || 3;

  const facts = [];
  for (const meta of JSONL_FILES) {
    let col;
    try {
      col = loadCollection(meta.id);
    } catch {
      continue;
    }
    for (const entry of col.entries) {
      const level = confidenceOrder[(entry.confidence || 'low').toLowerCase()] || 1;
      if (level >= minLevel && entry.fact) {
        facts.push({ collection: meta.id, level, ...entry });
      }
    }
  }

  // Sort by confidence (high first)
  facts.sort((a, b) => b.level - a.level);

  const parts = ['ClawdBrowser Knowledge Base — Key Facts:', ''];
  for (const f of facts) {
    const line = `[${f.collection}/${f.confidence}] ${f.fact}`;
    if (f.recommendation) {
      parts.push(`  ${line}`);
      parts.push(`    → ${f.recommendation}`);
    } else {
      parts.push(`  ${line}`);
    }
  }

  let text = parts.join('\n');
  if (text.length > maxChars) text = text.slice(0, maxChars) + '\n\n[…knowledge truncated…]';
  return text;
}

/**
 * Get a specific markdown doc's content.
 */
function getDoc(id, { maxChars } = {}) {
  const doc = loadDoc(id);
  let md = doc.markdown;
  if (maxChars && md.length > maxChars) {
    md = md.slice(0, maxChars) + '\n\n[…doc truncated…]';
  }
  return { ...doc, markdown: md };
}

/**
 * Get the full manifest / status.
 */
function getManifest() {
  ensureBundle();
  const jsonlStatus = JSONL_FILES.map((f) => {
    const fp = path.join(ROOT, f.file);
    const exists = fs.existsSync(fp);
    let entryCount = 0;
    let bytes = 0;
    if (exists) {
      const stat = fs.statSync(fp);
      bytes = stat.size;
      try {
        entryCount = loadCollection(f.id).entries.length;
      } catch {
        /* ignore parse errors */
      }
    }
    return { ...f, exists, entryCount, bytes };
  });

  const mdStatus = MD_FILES.map((f) => {
    const fp = path.join(ROOT, f.file);
    const exists = fs.existsSync(fp);
    let bytes = 0;
    if (exists) bytes = fs.statSync(fp).size;
    return { ...f, exists, bytes };
  });

  return {
    name: 'ClawdBrowser Knowledge Bundle',
    root: ROOT,
    jsonlCount: jsonlStatus.length,
    jsonlPresent: jsonlStatus.filter((f) => f.exists).length,
    mdCount: mdStatus.length,
    mdPresent: mdStatus.filter((f) => f.exists).length,
    totalEntries: jsonlStatus.reduce((sum, f) => sum + f.entryCount, 0),
    totalBytes: [...jsonlStatus, ...mdStatus].reduce((sum, f) => sum + (f.bytes || 0), 0),
    collections: jsonlStatus,
    docs: mdStatus,
  };
}

/**
 * Get a summary of all knowledge for status display.
 */
function getSummary() {
  const m = getManifest();
  return {
    collections: `${m.jsonlPresent}/${m.jsonlCount}`,
    docs: `${m.mdPresent}/${m.mdCount}`,
    totalEntries: m.totalEntries,
    totalSize: Math.round(m.totalBytes / 1024) + 'KB',
  };
}

function clearCache() {
  _jsonlCache.clear();
  _mdCache.clear();
}

module.exports = {
  ROOT,
  JSONL_FILES,
  MD_FILES,
  ensureBundle,
  loadCollection,
  loadDoc,
  searchFacts,
  getByTag,
  getByConfidence,
  getPromptContext,
  getDoc,
  getManifest,
  getSummary,
  clearCache,
};