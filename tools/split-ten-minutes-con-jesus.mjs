import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const atlas = dirname(toolsDir);
const workspace = dirname(atlas);
const sourceDir = join(workspace, "12_IA_Meditacion_DiarIA");
const input = join(sourceDir, "003_10_Minutos_con_Jesus.md");
const targetWords = 450000;
const outputPattern = /^003_10_Minutos_con_Jesus_P\d{2}\.md$/;
const legacyPattern = /^00[34]_10_Minutos_con_Jesus_P\d+\.md$/;

const countWords = value => (value.match(/[\p{L}\p{N}]+/gu) || []).length;
const normalize = value => String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();

const text = normalize(await readFile(input, "utf8"));
const introMatch = text.match(/^#\s+.*?\n\n[\s\S]*?(?=\n##\s)/);
const intro = introMatch ? introMatch[0].trimEnd() : `# 10 minutos con Jesus: transcripciones`;
const body = text.slice(intro.length).trimStart();
const sections = body.split(/\n(?=##\s)/g).map(section => section.trim()).filter(Boolean);

if (!sections.length) {
  throw new Error("No se encontraron secciones para dividir el archivo.");
}

const sectionSizes = sections.map(section => countWords(section));
const maxSectionSize = Math.max(...sectionSizes);
if (maxSectionSize > targetWords) {
  throw new Error(`Hay una sección individual con ${maxSectionSize} palabras, por encima del límite.`);
}

for (const file of await readdir(sourceDir)) {
  if (outputPattern.test(file) || legacyPattern.test(file)) {
    await rm(join(sourceDir, file), { force: true });
  }
}

const parts = [];
let currentSections = [];
let currentWords = 0;
let partNumber = 1;

const flush = async () => {
  if (!currentSections.length) return;
  const suffix = String(partNumber).padStart(2, "0");
  const fileName = `003_10_Minutos_con_Jesus_P${suffix}.md`;
  const heading = `## Parte ${suffix}`;
  const content = [intro, heading, ...currentSections].join("\n\n").trimEnd() + "\n";
  const words = countWords(content);
  parts.push({ fileName, words });
  await mkdir(sourceDir, { recursive: true });
  await writeFile(join(sourceDir, fileName), content, "utf8");
  currentSections = [];
  currentWords = 0;
  partNumber += 1;
};

for (const section of sections) {
  const words = countWords(section);
  if (currentSections.length && currentWords + words > targetWords) {
    await flush();
  }
  currentSections.push(section);
  currentWords += words;
}

await flush();

console.log(JSON.stringify({ parts, totalParts: parts.length }, null, 2));
