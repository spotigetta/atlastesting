import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const generatorsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const atlasRoot = path.dirname(generatorsDir);
export const embeddedSourceRoot = path.join(atlasRoot, "source", "libraries");
export const legacySourceRoot = path.dirname(atlasRoot);
export const sourceRoot = path.resolve(
  process.env.ATLAS_SOURCE_ROOT ||
  (fs.existsSync(embeddedSourceRoot) ? embeddedSourceRoot : legacySourceRoot)
);
export const dataRoot = path.resolve(process.env.ATLAS_DATA_ROOT || path.join(atlasRoot, "data"));

export function assertInside(parent, candidate, label = "ruta") {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} fuera del directorio permitido: ${candidate}`);
  }
  return path.resolve(candidate);
}
