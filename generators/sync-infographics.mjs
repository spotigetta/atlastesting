import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const atlasRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const externalSourceRoot = path.join(path.dirname(atlasRoot), "infografiasfinal");
const targetRoot = path.join(atlasRoot, "assets", "infografias");
const files = [
  "infodoctrina_textogrande.html", "infografiaCanonIA_v2.html", "infohistoria.html",
  "infografiaLiturgIA_v2.html", "infoCirculos.html", "infografiaCinepilot.html",
  "infobib.html", "infografiaLosClasicos_v2.html", "infoSJM.html"
];

fs.mkdirSync(targetRoot, { recursive: true });
let copied = 0;
for (const file of files) {
  const source = path.join(externalSourceRoot, file);
  const target = path.join(targetRoot, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, target);
  if (fs.existsSync(target)) copied += 1;
}
console.log(`Atlas infografías: ${copied}/${files.length} disponibles en assets/infografias.`);
if (copied !== files.length) process.exitCode = 1;
