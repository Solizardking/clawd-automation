/**
 * Skill Hub bridge — installable agent skills (skills.x402agent.io catalog).
 * Canonical sources live under repo-local `skillhub/`.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const config = require('../config/index.js');

const HUB_ROOT = path.resolve(__dirname, '../../skillhub');
const CATALOG_PATH = path.join(HUB_ROOT, 'catalog.json');
const SKILLS_CLI = path.join(HUB_ROOT, 'bin/skills.mjs');

function productUrls() {
  return {
    skills:
      config.product?.skillsUrl ||
      config.product?.domains?.skills ||
      'https://skills.x402agent.io',
    hub:
      config.product?.hubUrl ||
      config.product?.domains?.hub ||
      'https://hub.x402agent.io',
    product: config.product?.url || 'https://x402agent.io'
  };
}

function ensureHub() {
  if (!fs.existsSync(HUB_ROOT)) {
    throw new Error('Skill hub not found at skillhub/ — inject from skillhub-main first');
  }
  return HUB_ROOT;
}

function loadCatalog() {
  ensureHub();
  const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
  return JSON.parse(raw);
}

function getManifest() {
  const catalog = loadCatalog();
  const categories = {};
  for (const s of catalog) {
    const c = s.category || 'uncategorized';
    categories[c] = (categories[c] || 0) + 1;
  }
  const urls = productUrls();
  return {
    name: 'X402 Skill Hub',
    hub: urls.skills,
    portal: urls.hub,
    product: urls.product,
    skillsUrl: urls.skills,
    hubUrl: urls.hub,
    aliases: [
      urls.skills,
      urls.hub,
      'https://skills.x402.wtf',
      'https://skills.onchainai.fund'
    ],
    root: HUB_ROOT,
    skillCount: catalog.length,
    categories,
    paths: {
      catalog: CATALOG_PATH,
      skills: path.join(HUB_ROOT, 'skills'),
      public: path.join(HUB_ROOT, 'public'),
      cli: SKILLS_CLI,
      scanner: path.join(HUB_ROOT, 'scanner')
    },
    install: {
      all: 'node skillhub/bin/skills.mjs install --all',
      one: 'node skillhub/bin/skills.mjs install <slug>',
      list: 'node skillhub/bin/skills.mjs list'
    },
    endpoints: {
      local: '/skills-hub',
      site: '/skillhub/',
      catalogApi: `${urls.skills}/api/skills.json`,
      portal: urls.hub
    }
  };
}

function findSkill(slugOrName) {
  const catalog = loadCatalog();
  const q = String(slugOrName).toLowerCase();
  return (
    catalog.find((s) => s.slug === slugOrName || s.name === slugOrName) ||
    catalog.find((s) => s.slug.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) ||
    null
  );
}

function searchSkills(query, { limit = 25, category } = {}) {
  const catalog = loadCatalog();
  const q = String(query || '').toLowerCase().trim();
  let rows = catalog;
  if (category) {
    rows = rows.filter((s) => (s.category || '').toLowerCase().includes(String(category).toLowerCase()));
  }
  if (q) {
    rows = rows.filter(
      (s) =>
        s.slug.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
    );
  }
  return rows.slice(0, limit);
}

function readSkillMarkdown(slug) {
  const skill = findSkill(slug);
  if (!skill) throw new Error(`Unknown skill: ${slug}`);
  const skillPath = path.join(HUB_ROOT, 'skills', skill.slug, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    // some skills may be nested differently
    const alt = path.join(HUB_ROOT, 'skills', skill.slug.replace(/\//g, path.sep), 'SKILL.md');
    if (!fs.existsSync(alt)) throw new Error(`SKILL.md missing for ${skill.slug}`);
    return { skill, path: alt, markdown: fs.readFileSync(alt, 'utf8') };
  }
  return { skill, path: skillPath, markdown: fs.readFileSync(skillPath, 'utf8') };
}

/**
 * Run skillhub CLI (list/install). Returns { status, stdout, stderr }.
 */
function runSkillsCli(args = [], opts = {}) {
  ensureHub();
  const result = spawnSync(process.execPath, [SKILLS_CLI, ...args], {
    cwd: HUB_ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...(opts.env || {}) },
    maxBuffer: 20 * 1024 * 1024
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : null
  };
}

function listJson() {
  const out = runSkillsCli(['list', '--json']);
  if (out.status !== 0) {
    // fallback to catalog file
    return loadCatalog();
  }
  try {
    return JSON.parse(out.stdout);
  } catch {
    return loadCatalog();
  }
}

module.exports = {
  HUB_ROOT,
  CATALOG_PATH,
  ensureHub,
  loadCatalog,
  getManifest,
  findSkill,
  searchSkills,
  readSkillMarkdown,
  runSkillsCli,
  listJson
};
