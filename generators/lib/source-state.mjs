import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const read = file => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";

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
    prompts: read(path.join(contentDir, "library-prompts.json"))
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
