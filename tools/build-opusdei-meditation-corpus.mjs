import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const year = Number(process.argv.find(value => /^\d{4}$/.test(value)) || new Date().getFullYear());
const overrides = JSON.parse(await readFile(join(root, "data", "opusdei-meditation-overrides.json"), "utf8"));
const byDate = new Map((overrides.items || []).map(item => [item.date, item]));
const records = [];
const current = new Date(Date.UTC(year, 0, 1));
while (current.getUTCFullYear() === year) {
  const date = current.toISOString().slice(0, 10);
  records.push({
    date,
    title: `Meditación del ${date.slice(8,10)}/${date.slice(5,7)}/${date.slice(0,4)}`,
    officialUrl: `https://opusdei.org/es/meditation/${date}/`,
    themes: [], gospelRefs: [], gospelLinks: [], excerpt: "", status: "pending-review",
    ...(byDate.get(date) || {})
  });
  current.setUTCDate(current.getUTCDate() + 1);
}
const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  year,
  source: overrides.source,
  rightsPolicy: overrides.rightsPolicy,
  records,
  stats: { total: records.length, reviewed: records.filter(item => item.status === "reviewed").length, pending: records.filter(item => item.status !== "reviewed").length }
};
await writeFile(join(root, "data", "opusdei-meditations.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
const output = join(root, "content", "opusdei-meditations", String(year));
await mkdir(output, { recursive: true });
for (let month = 1; month <= 12; month += 1) {
  const items = records.filter(item => Number(item.date.slice(5,7)) === month);
  const lines = [`# Meditaciones · ${year}-${String(month).padStart(2,"0")}`, "", "> Índice editorial: metadatos, temas y enlaces oficiales. Atlas no reproduce automáticamente el texto íntegro.", ""];
  for (const item of items) {
    lines.push(`## ${item.date} · ${item.title}`, "", `- Fuente oficial: ${item.officialUrl}`, `- Estado: ${item.status === "reviewed" ? "revisado" : "pendiente de revisión editorial"}`);
    if (item.themes.length) lines.push(`- Temas: ${item.themes.join(", ")}`);
    if (item.gospelRefs.length) lines.push(`- Evangelio: ${item.gospelRefs.join("; ")}`);
    if (item.gospelLinks.length) lines.push(`- Enlace bíblico: ${item.gospelLinks.join(" · ")}`);
    if (item.excerpt) lines.push("", `> ${item.excerpt}`);
    lines.push("");
  }
  await writeFile(join(output, `${year}-${String(month).padStart(2,"0")}.md`), `${lines.join("\n")}\n`, "utf8");
}
console.log(`Corpus ${year}: ${payload.stats.total} días; ${payload.stats.reviewed} revisados; 12 índices mensuales.`);
