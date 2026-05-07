import { mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const projectRoot = resolve(__dirname, "..");
const publicDir = join(projectRoot, "public", "scram");

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

function pkgDir(name) {
  const candidates = {
    "@mercuryworkshop/scramjet": "@mercuryworkshop/scramjet/path",
    "@mercuryworkshop/bare-mux": "@mercuryworkshop/bare-mux",
    "@mercuryworkshop/epoxy-transport": "@mercuryworkshop/epoxy-transport",
  };
  const entry = candidates[name] || name;
  const resolved = require.resolve(entry, { paths: [projectRoot] });
  let dir = dirname(resolved);
  for (let i = 0; i < 8; i++) {
    const pj = join(dir, "package.json");
    if (existsSync(pj)) {
      try {
        const j = require(pj);
        if (j.name === name) return dir;
      } catch {}
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not locate package directory for ${name}`);
}

async function copy(srcAbs, destRel) {
  const dest = join(publicDir, destRel);
  await ensureDir(dirname(dest));
  await copyFile(srcAbs, dest);
}

async function main() {
  await ensureDir(publicDir);
  const scramDir = pkgDir("@mercuryworkshop/scramjet");
  await copy(join(scramDir, "dist", "scramjet.all.js"), "scramjet.all.js");
  await copy(join(scramDir, "dist", "scramjet.sync.js"), "scramjet.sync.js");
  await copy(join(scramDir, "dist", "scramjet.wasm.wasm"), "scramjet.wasm.wasm");

  const bareMuxDir = pkgDir("@mercuryworkshop/bare-mux");
  await copy(join(bareMuxDir, "dist", "index.mjs"), "bare-mux/index.mjs");
  await copy(join(bareMuxDir, "dist", "worker.js"), "bare-mux/worker.js");

  const epoxyDir = pkgDir("@mercuryworkshop/epoxy-transport");
  await copy(join(epoxyDir, "dist", "index.mjs"), "epoxy/index.mjs");

  console.log(`[scram-assets] copied bundles to ${publicDir}`);
}

main().catch((err) => {
  console.error("[scram-assets] failed:", err);
  process.exit(1);
});
