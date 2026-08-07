/**
 * Lobster Council — voice-agent roster loader.
 *
 * Source of truth: repo-root `lobster-council/*.json` (voice + systemRole configs).
 * Complements `data/hedge/` persona bios loaded by personas.js — same identifiers,
 * different surface (voice/realtime vs character bio).
 *
 * Pattern mirrors src/services/personas.js and constitution.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../../lobster-council');

/** Canonical council seat order (DisruptiveShell is council-only, not in hedge). */
const MEMBERS = [
  { id: 'soltoshi', file: 'soltoshi.json', seat: 'sovereign' },
  { id: 'valueclaw', file: 'valueclaw.json', seat: 'value' },
  { id: 'latticeclaw', file: 'latticeclaw.json', seat: 'quant' },
  { id: 'moatmaw', file: 'moatmaw.json', seat: 'moat' },
  { id: 'activistpinch', file: 'activistpinch.json', seat: 'activist' },
  { id: 'disruptiveshell', file: 'disruptiveshell.json', seat: 'vision' },
];

const cache = new Map();

function ensureCouncil() {
  if (!fs.existsSync(ROOT)) {
    throw new Error(
      'lobster-council/ missing — expected voice-council JSON next to package root',
    );
  }
  return ROOT;
}

function memberPath(meta) {
  return path.join(ROOT, meta.file);
}

/**
 * Load one council member by id or filename.
 */
function loadMember(idOrFile) {
  ensureCouncil();
  const key = String(idOrFile).toLowerCase().replace(/\.json$/, '');
  const meta =
    MEMBERS.find((m) => m.id === key) ||
    MEMBERS.find((m) => m.file.toLowerCase() === `${key}.json`) ||
    MEMBERS.find((m) => m.file.toLowerCase() === String(idOrFile).toLowerCase());

  if (!meta) {
    throw new Error(
      `Unknown lobster-council member: ${idOrFile}. Known: ${MEMBERS.map((m) => m.id).join(', ')}`,
    );
  }
  if (cache.has(meta.id)) return cache.get(meta.id);

  const fp = memberPath(meta);
  if (!fs.existsSync(fp)) {
    throw new Error(`Council file missing: ${fp}`);
  }
  const raw = fs.readFileSync(fp, 'utf8');
  const data = JSON.parse(raw);
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');

  const member = {
    ...meta,
    data,
    sha256,
    path: fp,
    identifier: data.identifier || meta.id,
    title: data.meta?.title || meta.id,
    description: data.meta?.description || '',
    avatar: data.meta?.avatar || '🦞',
    tags: data.meta?.tags || [],
    category: data.meta?.category || 'voice-council',
    systemRole: data.config?.systemRole || '',
    voice: data.voice || null,
    homepage: data.homepage || null,
    author: data.author || null,
  };

  cache.set(meta.id, member);
  return member;
}

function listMembers() {
  ensureCouncil();
  return MEMBERS.map((m) => {
    const fp = memberPath(m);
    const exists = fs.existsSync(fp);
    let bytes = 0;
    let sha256 = null;
    if (exists) {
      const buf = fs.readFileSync(fp);
      bytes = buf.length;
      sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    }
    return { ...m, path: fp, exists, bytes, sha256 };
  });
}

/**
 * System-prompt fragment for one council voice (systemRole + meta).
 */
function getMemberPrompt(id, { maxChars = 4000 } = {}) {
  const m = loadMember(id);
  const parts = [
    `${m.avatar} ${m.title}`,
    m.description,
    '',
    m.systemRole,
  ];
  if (m.voice?.tools?.length) {
    parts.push(
      '',
      'Voice tools: ' +
        m.voice.tools
          .map((t) => (typeof t === 'string' ? t : t.type || JSON.stringify(t)))
          .join(', '),
    );
  }
  let text = parts.filter(Boolean).join('\n');
  if (text.length > maxChars) text = text.slice(0, maxChars) + '\n\n[…council truncated…]';
  return text;
}

/**
 * Full council briefing (all seats).
 */
function getCouncilPrompt({ maxChars = 16000 } = {}) {
  const parts = MEMBERS.map((m) => {
    try {
      return `=== ${m.id} ===\n${getMemberPrompt(m.id, { maxChars: 2800 })}`;
    } catch {
      return null;
    }
  }).filter(Boolean);
  let text = parts.join('\n\n---\n\n');
  if (text.length > maxChars) text = text.slice(0, maxChars) + '\n\n[…council truncated…]';
  return text;
}

/**
 * Pick a council seat for a task (keyword routing).
 */
function selectMember(task) {
  const lower = String(task).toLowerCase();
  const matchers = [
    {
      id: 'disruptiveshell',
      keywords: ['vision', 'exponential', 'ai crypto', 'optimistic', '10-year', 'compute'],
    },
    {
      id: 'soltoshi',
      keywords: ['trench', 'hash', 'sovereign', 'proof', 'on-chain', 'contrarian'],
    },
    {
      id: 'valueclaw',
      keywords: ['value', 'margin', 'safety', 'undervalued', 'ncav', 'treasury'],
    },
    {
      id: 'latticeclaw',
      keywords: ['quant', 'model', 'correlation', 'backtest', 'statistical'],
    },
    {
      id: 'moatmaw',
      keywords: ['moat', 'competitive', 'durable', 'network effect'],
    },
    {
      id: 'activistpinch',
      keywords: ['governance', 'activist', 'vote', 'proposal', 'proxy'],
    },
  ];
  for (const m of matchers) {
    if (m.keywords.some((kw) => lower.includes(kw))) {
      try {
        return loadMember(m.id);
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

/**
 * Merge council voice overlay with hedge persona when both exist.
 * Returns { council, hedge } without throwing if hedge is absent.
 */
function composeWithHedge(id) {
  const council = loadMember(id);
  let hedge = null;
  try {
    // Lazy require to avoid cycle if personas loads council later
    const personas = require('./personas');
    if (typeof personas.loadPersona === 'function') {
      try {
        hedge = personas.loadPersona(id);
      } catch {
        hedge = null;
      }
    }
  } catch {
    hedge = null;
  }
  return {
    id: council.id,
    title: council.title,
    systemRole: council.systemRole,
    voice: council.voice,
    hedge: hedge
      ? {
          name: hedge.name,
          role: hedge.role,
          coreQuote: hedge.coreQuote,
          traits: hedge.traits,
        }
      : null,
    path: council.path,
    sha256: council.sha256,
  };
}

function getManifest() {
  const members = listMembers();
  const present = members.filter((m) => m.exists);
  return {
    name: 'Lobster Council',
    root: ROOT,
    memberCount: members.length,
    present: present.length,
    missing: members.filter((m) => !m.exists).map((m) => m.id),
    members: present.map((m) => ({
      id: m.id,
      seat: m.seat,
      sha256: m.sha256 ? m.sha256.slice(0, 12) + '…' : null,
      bytes: m.bytes,
    })),
    hedgeBundle: path.resolve(__dirname, '../../data/hedge'),
    oodaRoot: path.resolve(__dirname, '../../ooda'),
  };
}

function clearCache() {
  cache.clear();
}

module.exports = {
  ROOT,
  MEMBERS,
  ensureCouncil,
  loadMember,
  listMembers,
  getMemberPrompt,
  getCouncilPrompt,
  selectMember,
  composeWithHedge,
  getManifest,
  clearCache,
};
