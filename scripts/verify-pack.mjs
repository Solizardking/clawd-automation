#!/usr/bin/env node
/**
 * Pack the package, install from tarball into a clean dir, run --version/--help.
 * Usage: node scripts/verify-pack.mjs [evidence-dir]
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
  createWriteStream,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir =
  process.argv[2] ||
  path.join(ROOT, ".pack-evidence");
const require = createRequire(import.meta.url);
const pkg = require(path.join(ROOT, "package.json"));

function run(cmd, opts = {}) {
  const r = spawnSync(cmd, {
    shell: true,
    encoding: "utf8",
    cwd: opts.cwd || ROOT,
    env: { ...process.env, ...(opts.env || {}) },
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
    combined: `${r.stdout || ""}${r.stderr || ""}`,
  };
}

function writeLog(name, body) {
  mkdirSync(evidenceDir, { recursive: true });
  const p = path.join(evidenceDir, name);
  writeFileSync(p, body, "utf8");
  console.log(`wrote ${p}`);
  return p;
}

// 1. build
console.log("→ build");
let r = run("npm run build");
if (r.status !== 0) {
  writeLog("build-fail.log", r.combined);
  process.exit(1);
}

// 2. npm pack
console.log("→ npm pack");
r = run("npm pack --json");
writeLog("npm-pack.log", r.combined);
if (r.status !== 0) {
  console.error("npm pack failed");
  process.exit(1);
}

let tarballName;
try {
  const arr = JSON.parse(r.stdout.trim().split("\n").filter(Boolean).pop() || r.stdout);
  const list = Array.isArray(arr) ? arr : [arr];
  tarballName = list[0]?.filename || list[0]?.id;
} catch {
  // fallback: look for clawd-automaton-*.tgz
  const files = readdirSync(ROOT).filter((f) => f.endsWith(".tgz"));
  tarballName = files.sort().pop();
}
if (!tarballName) {
  // npm pack without --json prints the filename
  const m = r.combined.match(/clawd-automaton-[\d.]+\.tgz/);
  tarballName = m?.[0];
}
if (!tarballName) {
  console.error("could not determine tarball name");
  process.exit(1);
}
const tarballPath = path.isAbsolute(tarballName)
  ? tarballName
  : path.join(ROOT, path.basename(tarballName));
console.log("tarball:", tarballPath);
writeLog("tarball-path.txt", tarballPath + "\n");

// 3. list tarball contents
r = run(`tar -tzf "${tarballPath}"`);
writeLog("tarball-contents.txt", r.combined);
const contents = r.combined;
const mustInclude = [
  "package/dist/index.js",
  "package/src/services/constitution.js",
  "package/constitution/",
  "package/zk-primitives/MANIFEST.json",
];
const mustExclude = ["package/src/__tests__", "package/node_modules"];
for (const m of mustInclude) {
  if (!contents.includes(m.replace(/\/$/, "")) && !contents.split("\n").some((l) => l.includes(m.replace(/\/$/, "")))) {
    // softer: check prefix match
    const ok = contents.split("\n").some((l) => l.includes(m.replace(/\/$/, "")));
    if (!ok) {
      console.error("tarball missing:", m);
      process.exit(1);
    }
  }
}
// shebang check inside tarball
r = run(`tar -xOf "${tarballPath}" package/dist/index.js | head -c 40`);
if (!r.stdout.startsWith("#!/usr/bin/env node")) {
  console.error("tarball dist/index.js missing shebang:", JSON.stringify(r.stdout));
  process.exit(1);
}

// 4. clean install from tarball
const clean = path.join(evidenceDir, "clean-install");
rmSync(clean, { recursive: true, force: true });
mkdirSync(clean, { recursive: true });
writeFileSync(
  path.join(clean, "package.json"),
  JSON.stringify({ name: "pack-smoke", private: true }, null, 2),
);
console.log("→ npm install tarball in", clean);
r = run(`npm install "${tarballPath}"`, { cwd: clean });
writeLog("install-from-tarball.log", r.combined);
if (r.status !== 0) {
  console.error("install from tarball failed");
  process.exit(1);
}

const binJs = path.join(
  clean,
  "node_modules",
  "@clawd",
  "automaton",
  "dist",
  "index.js",
);
if (!existsSync(binJs)) {
  console.error("installed package missing dist/index.js");
  process.exit(1);
}

// 5. run --version / --help via node on installed path
console.log("→ --version / --help");
const ver = run(`node "${binJs}" --version`, { cwd: clean });
const help = run(`node "${binJs}" --help`, { cwd: clean });
const installLog = [
  "=== --version ===",
  ver.combined,
  "=== --help ===",
  help.combined,
  "=== expected version ===",
  pkg.version,
].join("\n");
writeLog("install-from-tarball-cli.log", installLog);

if (ver.status !== 0 || !ver.stdout.includes("Clawd Automaton") || !ver.stdout.includes(pkg.version)) {
  console.error("version check failed:", ver.combined);
  process.exit(1);
}
if (help.status !== 0 || !help.stdout.includes("--run") || !help.stdout.includes("--setup")) {
  console.error("help check failed:", help.combined);
  process.exit(1);
}

// also try local bin link if npm created it
const localBin = path.join(clean, "node_modules", ".bin", "automaton");
if (existsSync(localBin)) {
  const b = run(`"${localBin}" --version`, { cwd: clean });
  writeLog("install-bin-version.log", b.combined);
  if (b.status !== 0 || !b.stdout.includes(pkg.version)) {
    console.error("bin wrapper failed");
    process.exit(1);
  }
}

console.log("✓ pack + clean install smoke OK");
console.log("  version:", ver.stdout.trim());
