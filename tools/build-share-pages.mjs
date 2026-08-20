import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASE = "https://spotigetta.github.io/atlastesting/";
const catalog = JSON.parse(await readFile(join(ROOT, "data", "catalog.json"), "utf8"));
const covers = { doctrine:"portadaSanJosemarIA.webp", canon:"canoniaportada.webp", history:"historiaportada.webp", liturgy:"liturgiaportada.webp", ortodoxia:"ortodoxiaportada.webp", cinepilot:"cinepilotportada.webp", bibliotecaria:"bibliotecariaportada.webp", clasicos:"clasicosportada.webp", "san-josemaria":"portadaSanJosemarIA.webp", "preparadora-circulos":"preparadordecirculosportada.webp", "vida-santos":"santosportada.png" };
const page = ({title, description, image, target}) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><meta property="og:type" content="website"><meta property="og:site_name" content="Atlas · Mercabá"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="${image}"><meta property="og:url" content="${target}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${image}"><meta http-equiv="refresh" content="0;url=${target}"></head><body><a href="${target}">Abrir Atlas</a><script>location.replace(${JSON.stringify(target)})</script></body></html>`;
async function emit(path, options) { await mkdir(path, { recursive:true }); await writeFile(join(path,"index.html"), page(options)); }
await emit(join(ROOT,"share"), { title:"Atlas · Mercabá", description:"Bibliotecas, documentos, IA y recursos para estudiar, rezar y descubrir.", image:`${BASE}assets/icons/icon-512.png`, target:BASE });
for (const library of catalog.libraries) await emit(join(ROOT,"share","libraries",library.id), { title:`${library.short} · Atlas`, description:library.purpose || `Biblioteca especializada de Atlas: ${library.short}.`, image:`${BASE}assets/images/libraries/${covers[library.id] || "historiaportada.webp"}`, target:`${BASE}#/library/${library.id}/documents` });
console.log(`Páginas de compartir generadas: ${catalog.libraries.length + 1}`);
