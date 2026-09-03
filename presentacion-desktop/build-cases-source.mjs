import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const folder = dirname(fileURLToPath(import.meta.url));
const markdown = await readFile(join(folder, "casos-practicos-originales.md"), "utf8");
await writeFile(
  join(folder, "casos-practicos-originales.js"),
  `window.ATLAS_CASES_SOURCE = ${JSON.stringify(markdown)};\n`,
  "utf8"
);

console.log("Casos originales incrustados para apertura local.");
