import { mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const projectRoot = resolve(__dirname, "..");
const publicDir = join(projectRoot, "public");

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

function pkgDir(name) {
  const candidates = {
    "@mercuryworkshop/scramjet": "@mercuryworkshop/scramjet/path",
    "@mercuryworkshop/scramjet-controller": "@mercuryworkshop/scramjet-controller",
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
  await copy(join(scramDir, "dist", "scramjet.js"), "scram/scramjet.js");
  await copy(join(scramDir, "dist", "scramjet.wasm"), "scram/scramjet.wasm");

  const controllerDir = pkgDir("@mercuryworkshop/scramjet-controller");
  await copy(
    join(controllerDir, "dist", "controller.api.js"),
    "controller/controller.api.js",
  );
  await copy(
    join(controllerDir, "dist", "controller.inject.js"),
    "controller/controller.inject.js",
  );
  await copy(
    join(controllerDir, "dist", "controller.sw.js"),
    "controller/controller.sw.js",
  );

  const epoxyWasm = fileURLToPath(
    import.meta.resolve("@mercuryworkshop/epoxy-tls"),
  );
  await copy(
    join(dirname(epoxyWasm), "epoxy.wasm"),
    "assets/epoxy.wasm",
  );

  console.log(`[scram-assets] copied bundles to ${publicDir}`);
}

main().catch((err) => {
  console.error("[scram-assets] failed:", err);
  process.exit(1);
});
