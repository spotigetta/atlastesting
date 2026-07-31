import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sizeOf = directory => fs.existsSync(directory)
  ? fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .reduce((sum, entry) => sum + fs.statSync(path.join(entry.parentPath, entry.name)).size, 0)
  : 0;
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data", "catalog.json"), "utf8"));
const reader = JSON.parse(fs.readFileSync(path.join(root, "data", "documents", "manifest.json"), "utf8"));
const search = JSON.parse(fs.readFileSync(path.join(root, "data", "search", "manifest.json"), "utf8"));
const report = {
  generatedAt: new Date().toISOString(),
  libraries: catalog.libraries.length,
  documents: catalog.meta.documents,
  readerDocuments: reader.documents,
  searchDocuments: search.meta.documents,
  sourceBytes: sizeOf(path.join(root, "source", "libraries")),
  readerBytes: sizeOf(path.join(root, "data", "documents")),
  searchBytes: sizeOf(path.join(root, "data", "search")),
  distBytes: sizeOf(path.join(root, "dist"))
};
console.log(JSON.stringify(report, null, 2));
