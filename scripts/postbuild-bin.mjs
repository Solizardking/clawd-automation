#!/usr/bin/env node
/**
 * Ensure the published CLI entry has a shebang and executable bit.
 * npm bin linking relies on both for a clean global install.
 */
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "dist", "index.js");

if (!existsSync(entry)) {
  console.error("[postbuild-bin] missing dist/index.js — run tsc first");
  process.exit(1);
}

const SHEBANG = "#!/usr/bin/env node\n";
let body = readFileSync(entry, "utf8");
if (!body.startsWith("#!")) {
  body = SHEBANG + body;
  writeFileSync(entry, body, "utf8");
}

chmodSync(entry, 0o755);
console.log("[postbuild-bin] dist/index.js shebang+mode 0755 ok");
