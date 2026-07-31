import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sourceFingerprint } from "../generators/lib/source-state.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(root, "data");
const sourceRoot = path.join(root, "source", "libraries");
const snapshotsDir = path.join(root, "source", "providers", "snapshots");
const generatedDir = path.join(root, "generated");
const stagingDir = path.join(generatedDir, "dist-next");
const distDir = path.join(root, "dist");
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const run = script => {
  console.log(`\n→ ${script}`);
  execFileSync(process.execPath, [path.join(root, "generators", script)], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ATLAS_SOURCE_ROOT: sourceRoot }
  });
};

function copySnapshots() {
  if (!fs.existsSync(snapshotsDir)) return;
  for (const entry of fs.readdirSync(snapshotsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    fs.copyFileSync(path.join(snapshotsDir, entry.name), path.join(dataDir, entry.name));
  }
}

function copyFile(relative, destinationRoot = stagingDir) {
  const source = path.join(root, relative);
  if (!fs.existsSync(source)) throw new Error(`Falta el recurso público ${relative}`);
  const target = path.join(destinationRoot, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDirectory(relative) {
  const source = path.join(root, relative);
  const target = path.join(stagingDir, relative);
  if (!fs.existsSync(source)) throw new Error(`Falta el directorio público ${relative}`);
  fs.cpSync(source, target, { recursive: true, force: true });
}

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

fs.mkdirSync(generatedDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
copySnapshots();

for (const script of [
  "build-data.mjs",
  "build-quotes.mjs",
  "build-youtube-shorts.mjs",
  "build-youtube-music.mjs",
  "build-channel-catalog.mjs",
  "sync-infographics.mjs",
  "build-reader-content.mjs",
  "build-fulltext.mjs"
]) run(script);
copySnapshots();

execFileSync(process.execPath, [path.join(root, "tools", "validate.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ATLAS_SOURCE_ROOT: sourceRoot }
});

if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

for (const file of [
  "index.html", "offline.html", "manifest.webmanifest", "service-worker.js",
  "sjm_transparente.png"
]) copyFile(file);
for (const directory of ["styles", "scripts", "assets"]) copyDirectory(directory);

const publicDataFiles = [
  "catalog.json", "external-content.json", "quotes.json", "youtube-shorts.json",
  "channel-catalog.json", "youtube-live-cache.json", "youtube-music-cache.json",
  "instagram-cache.json", "josemaria-quotes.json", "provider-health.json", "version.json", "changelog.json",
  "import-report.json"
];
for (const file of publicDataFiles) copyFile(path.join("data", file));
for (const directory of ["data/documents", "data/search"]) copyDirectory(directory);

const buildId = `${packageMetadata.version}-${crypto.createHash("sha256")
  .update(hashFile(path.join(dataDir, "catalog.json")))
  .update(hashFile(path.join(dataDir, "documents", "manifest.json")))
  .digest("hex").slice(0, 12)}`;
const buildManifest = {
  app: "ATLAS",
  version: packageMetadata.version,
  buildId,
  generatedAt: new Date().toISOString(),
  basePath: "./",
  catalog: "data/catalog.json"
};
fs.writeFileSync(path.join(stagingDir, "build-manifest.json"), `${JSON.stringify(buildManifest, null, 2)}\n`);
fs.writeFileSync(path.join(stagingDir, ".nojekyll"), "");

const serviceWorkerPath = path.join(stagingDir, "service-worker.js");
fs.writeFileSync(
  serviceWorkerPath,
  fs.readFileSync(serviceWorkerPath, "utf8").replaceAll("__ATLAS_VERSION__", buildId),
  "utf8"
);

if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true });
fs.renameSync(stagingDir, distDir);

execFileSync(process.execPath, [path.join(root, "tools", "validate.mjs"), "--dist"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ATLAS_SOURCE_ROOT: sourceRoot }
});
fs.writeFileSync(path.join(dataDir, "source-state.json"), `${JSON.stringify({
  fingerprint: sourceFingerprint({ atlasRoot: root, sourceRoot }),
  updatedAt: new Date().toISOString(),
  buildId
}, null, 2)}\n`);
console.log(`\nAtlas ${buildId} construido en ${distDir}`);
