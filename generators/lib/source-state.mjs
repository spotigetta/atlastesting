import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const read = file => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";

function treeState(root, extensions = new Set([".js", ".mjs", ".css", ".html", ".json", ".md", ".png"])) {
  if (!fs.existsSync(root)) return [];
  const output = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (extensions.has(path.extname(entry.name).toLowerCase())) {
        const stat = fs.statSync(absolute);
        output.push({ file: path.relative(root, absolute).replaceAll("\\", "/"), size: stat.size, modified: stat.mtimeMs });
      }
    }
  };
  visit(root);
  return output;
}

function fileState(root, names) {
  return names.flatMap(file => {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) return [];
    const stat = fs.statSync(absolute);
    return [{ file, size: stat.size, modified: stat.mtimeMs }];
  });
}

export function sourceFingerprint({ atlasRoot, sourceRoot }) {
  const contentDir = path.join(atlasRoot, "content");
  const dataDir = path.join(atlasRoot, "data");
  const registryPath = path.join(contentDir, "libraries.json");
  const libraries = JSON.parse(read(registryPath) || "[]");
  const files = [];

  for (const library of libraries) {
    const directory = path.join(sourceRoot, library.folder);
    if (!fs.existsSync(directory)) continue;
    for (const file of fs.readdirSync(directory).filter(name => /\.md$/i.test(name)).sort()) {
      const stat = fs.statSync(path.join(directory, file));
      files.push({
        libraryId: library.id,
        folder: library.folder,
        file,
        size: stat.size,
        modified: stat.mtimeMs
      });
    }
  }

  const payload = {
    files,
    libraries: read(registryPath),
    overrides: read(path.join(dataDir, "metadata-overrides.json")),
    quotes: read(path.join(atlasRoot, "frases.md")),
    youtube: read(path.join(contentDir, "youtube-shorts.json")),
    instagram: read(path.join(contentDir, "instagram.json")),
    prompts: read(path.join(contentDir, "library-prompts.json")),
    contentTree: treeState(contentDir, new Set([".json", ".md"])),
    scriptsTree: treeState(path.join(atlasRoot, "scripts"), new Set([".js"])),
    stylesTree: treeState(path.join(atlasRoot, "styles"), new Set([".css"])),
    publicShell: fileState(atlasRoot, ["index.html", "offline.html", "manifest.webmanifest", "service-worker.js", "package.json"]),
    infographicsTree: treeState(path.join(path.dirname(atlasRoot), "infografiasfinal"), new Set([".html", ".png", ".jpg", ".jpeg"]))
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
