import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pipeline, env } from "@huggingface/transformers";

env.allowRemoteModels = true;
const dataFile = new URL("../data/saints-moods.json", import.meta.url);
const cacheFile = new URL("../data/saints-translation-cache.json", import.meta.url);
const modelCache = new URL("../.translation-models/", import.meta.url);
env.cacheDir = decodeURIComponent(modelCache.pathname.replace(/^\/(?:[A-Za-z]:)/, match => match.slice(1))).replaceAll("/", "\\");
const data = JSON.parse(await readFile(dataFile, "utf8"));
let cache = {};
try { cache = JSON.parse(await readFile(cacheFile, "utf8")); } catch {}
const translator = await pipeline("translation", "Xenova/opus-mt-en-es", { dtype: "q4" });
const key = text => createHash("sha256").update(text).digest("hex");
const normalize = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function chunks(text, limit = 850) {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const result = []; let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > limit) { result.push(current.trim()); current = ""; }
    current += `${sentence.trim()} `;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}
async function translate(text) {
  const cacheKey = key(text); if (cache[cacheKey]) return cache[cacheKey];
  const translated = [];
  for (const chunk of chunks(text)) {
    const output = await translator(chunk, { max_new_tokens: 384 });
    translated.push(output[0]?.translation_text || output.translation_text || "");
  }
  cache[cacheKey] = translated.join(" ").trim(); return cache[cacheKey];
}
function summary(text, saint, mood) {
  const sentences = text.replace(/\s+/g," ").trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(x=>x.trim()).filter(x=>x.length>35)||[];
  const short = value => value.length>190 ? `${value.slice(0,187).replace(/\s+\S*$/,"")}…` : value;
  const thematic=sentences.find(x=>mood.label.split(/\s+/).some(t=>t.length>4&&normalize(x).includes(normalize(t))))||sentences[0];
  const response=sentences.find((x,i)=>i>0&&/(?:dios|senor|fe|oraci|confi|acept|permanec|decid|respond|sirvi|perdon|esper)/i.test(normalize(x)))||sentences[Math.min(1,sentences.length-1)];
  const outcome=sentences.length>2?sentences[sentences.length-1]:sentences[Math.max(0,sentences.length-1)];
  return [{label:"La situación",text:short(thematic||`${saint} atravesó esta experiencia.`)},{label:"Su respuesta",text:short(response||"La biografía muestra su respuesta concreta dentro de la prueba.")},{label:"La clave",text:short(outcome||"El contexto completo ayuda a comprender cómo maduró esta experiencia.")}];
}
let translated=0, processed=0;
for (const mood of data.moods) for (const passage of mood.passages) {
  if (!passage.selection?.spanishPreferred) { passage.originalExcerpt=passage.excerpt; passage.excerptSpanish=await translate(passage.excerpt); passage.translation={language:"es",method:"modelo local OPUS-MT",preservesOriginal:true}; translated++; }
  else { passage.excerptSpanish=passage.excerpt; passage.translation={language:"es",method:"fuente original castellana",preservesOriginal:true}; }
  passage.summaryPoints=summary(passage.excerptSpanish, passage.saint, mood);
  processed++;
  await writeFile(cacheFile, `${JSON.stringify(cache,null,2)}\n`, "utf8");
  await writeFile(dataFile, `${JSON.stringify(data,null,2)}\n`, "utf8");
  if (processed % 10 === 0) console.log(`Procesados ${processed}/500; traducciones locales ${translated}.`);
}
data.methodology.translationPolicy="La tarjeta se muestra siempre en castellano. Cuando la fuente está en otra lengua, excerpt conserva la cita literal y excerptSpanish contiene una traducción generada localmente.";
data.validation.spanishDisplayPassages=500; data.validation.translatedPassages=translated;
await writeFile(cacheFile, `${JSON.stringify(cache,null,2)}\n`, "utf8");
await writeFile(dataFile, `${JSON.stringify(data,null,2)}\n`, "utf8");
console.log(`Pasajes en castellano: 500; traducidos localmente: ${translated}; originales conservados: sí.`);
