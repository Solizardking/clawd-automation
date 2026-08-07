/**
 * Hedge Persona Bundle Loader
 *
 * Loads the ClawdBrowser hedge persona set (activistpinch, latticeclaw,
 * moatmaw, soltoshi, valueclaw) from data/hedge/*.json and provides
 * prompt-context generation for AI agents.
 *
 * Pattern mirrors src/services/constitution.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../../data/hedge');
/** Voice-council overlays (same ids + disruptiveshell) live next to hedge bios. */
const COUNCIL_ROOT = path.resolve(__dirname, '../../lobster-council');

const PERSONAS = [
  { id: 'activistpinch', file: 'activistpinch.json', name: 'ActivistPinch', role: 'Activist Claw Lobster' },
  { id: 'latticeclaw',   file: 'latticeclaw.json',   name: 'LatticeClaw',   role: 'Quant Strategy Lobster' },
  { id: 'moatmaw',       file: 'moatmaw.json',        name: 'MoatMaw',       role: 'Competitive Moat Lobster' },
  { id: 'soltoshi',      file: 'soltoshi.json',       name: 'Soltoshi',       role: 'Satoshi Disciple Lobster' },
  { id: 'valueclaw',     file: 'valueclaw.json',      name: 'ValueClaw',      role: 'Margin of Safety Lobster' },
];

const cache = new Map();

function personaPath(meta) {
  return path.join(ROOT, meta.file);
}

function ensureBundle() {
  if (!fs.existsSync(ROOT)) {
    throw new Error('data/hedge/ bundle missing — copy ClawdBrowser hedge personas first');
  }
  return ROOT;
}

/**
 * Load a single persona JSON by id (e.g. 'valueclaw') or file name.
 */
function loadPersona(idOrFile) {
  ensureBundle();
  const key = String(idOrFile).toLowerCase().replace(/\.json$/, '');
  const meta =
    PERSONAS.find((p) => p.id === key) ||
    PERSONAS.find((p) => p.file.toLowerCase() === `${key}.json`) ||
    PERSONAS.find((p) => p.file.toLowerCase() === String(idOrFile).toLowerCase());

  if (!meta) {
    throw new Error(
      `Unknown persona: ${idOrFile}. Known: ${PERSONAS.map((p) => p.id).join(', ')}`
    );
  }
  if (cache.has(meta.id)) return cache.get(meta.id);

  const raw = fs.readFileSync(personaPath(meta), 'utf8');
  const data = JSON.parse(raw);
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');

  const persona = {
    ...meta,
    data,
    sha256,
    path: personaPath(meta),
    name: data.persona?.name || meta.name,
    role: data.persona?.role || meta.role,
    greeting: data.persona?.greeting || '',
    avatar: data.persona?.avatar || '',
    coreQuote: data.persona?.core_quote || '',
    traits: data.persona?.traits || [],
    bio: data.bio || [],
    communicationStyle: data.communication_style || {},
    beliefs: data.beliefs || [],
    lexicon: data.lobster_lexicon || {},
    signaturePhrases: data.signature_phrases || [],
  };

  cache.set(meta.id, persona);
  return persona;
}

/**
 * List all personas with metadata.
 */
function listPersonas() {
  ensureBundle();
  return PERSONAS.map((p) => {
    const fp = personaPath(p);
    const exists = fs.existsSync(fp);
    let bytes = 0;
    let sha256 = null;
    if (exists) {
      const buf = fs.readFileSync(fp);
      bytes = buf.length;
      sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    }
    return { ...p, path: fp, exists, bytes, sha256 };
  });
}

/**
 * Get the index.json manifest.
 */
function getIndex() {
  ensureBundle();
  const indexPath = path.join(ROOT, 'index.json');
  if (fs.existsSync(indexPath)) {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  }
  return null;
}

/**
 * Get a compact system-prompt fragment for a single persona.
 */
function getPersonaPrompt(id, { maxChars = 3000 } = {}) {
  const p = loadPersona(id);
  const parts = [
    `${p.data.persona?.greeting || ''}`,
    ``,
    `Role: ${p.role}`,
    `Core Philosophy: ${p.coreQuote}`,
    ``,
    `Traits: ${p.traits.join(', ')}`,
    ``,
    `Bio:`,
    ...p.bio.map((b) => `  - ${b}`),
    ``,
    `Beliefs:`,
    ...p.beliefs.map((b) => `  - ${b}`),
  ];

  if (p.signaturePhrases.length) {
    parts.push('', 'Signature Phrases:', ...p.signaturePhrases.map((s) => `  • "${s}"`));
  }
  if (Object.keys(p.lexicon).length) {
    parts.push('', 'Lexicon:');
    for (const [term, def] of Object.entries(p.lexicon)) {
      parts.push(`  ${term}: ${def}`);
    }
  }

  let text = parts.join('\n');
  if (text.length > maxChars) text = text.slice(0, maxChars) + '\n\n[…persona truncated…]';
  return text;
}

/**
 * Get a combined prompt for all personas (council mode).
 */
function getAllPersonaPrompts({ maxChars = 12000 } = {}) {
  const parts = PERSONAS.map((p) => {
    try {
      return `=== ${p.name} (${p.role}) ===\n${getPersonaPrompt(p.id, { maxChars: 2500 })}`;
    } catch {
      return null;
    }
  }).filter(Boolean);

  let text = parts.join('\n\n---\n\n');
  if (text.length > maxChars) text = text.slice(0, maxChars) + '\n\n[…personas truncated…]';
  return text;
}

/**
 * Get manifest / status object.
 */
function getManifest() {
  const personas = listPersonas();
  const present = personas.filter((p) => p.exists);
  let council = null;
  try {
    const lc = require('./lobster-council');
    council = typeof lc.getManifest === 'function' ? lc.getManifest() : null;
  } catch (err) {
    council = { error: err.message };
  }
  return {
    name: 'Hedge Persona Bundle',
    root: ROOT,
    councilRoot: COUNCIL_ROOT,
    personaCount: personas.length,
    present: present.length,
    missing: personas.filter((p) => !p.exists).map((p) => p.id),
    personas: present.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      sha256: p.sha256?.slice(0, 12) + '…',
      bytes: p.bytes,
    })),
    index: getIndex(),
    lobsterCouncil: council,
  };
}

/**
 * Select the best persona for a given task based on keyword matching.
 */
function selectPersona(task) {
  const lower = String(task).toLowerCase();
  const matchers = [
    { id: 'activistpinch', keywords: ['governance', 'activist', 'proxy', 'vote', 'proposal', 'intervene'] },
    { id: 'latticeclaw',   keywords: ['quant', 'quantitative', 'model', 'statistical', 'correlation', 'backtest'] },
    { id: 'moatmaw',       keywords: ['moat', 'competitive', 'advantage', 'durable', 'monopoly', 'network effect'] },
    { id: 'soltoshi',      keywords: ['bitcoin', 'satoshi', 'store of value', 'scarcity', 'harden', 'austrian'] },
    { id: 'valueclaw',     keywords: ['value', 'margin of safety', 'ncav', 'undervalued', 'asset backed', 'treasury'] },
  ];

  for (const m of matchers) {
    if (m.keywords.some((kw) => lower.includes(kw))) {
      try {
        return loadPersona(m.id);
      } catch {
        /* skip if missing */
      }
    }
  }
  return null;
}

function clearCache() {
  cache.clear();
}

module.exports = {
  ROOT,
  COUNCIL_ROOT,
  PERSONAS,
  ensureBundle,
  loadPersona,
  listPersonas,
  getIndex,
  getPersonaPrompt,
  getAllPersonaPrompts,
  getManifest,
  selectPersona,
  clearCache,
};
