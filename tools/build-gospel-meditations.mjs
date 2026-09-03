import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const external = JSON.parse(await fs.readFile(path.join(root, "data/external-content.json"), "utf8"));
const opus = JSON.parse(await fs.readFile(path.join(root, "data/opusdei-meditations.json"), "utf8").catch(() => '{"records":[]}'));

const themes = [
  { id: "tristeza", label: "la tristeza", icon: "◐", test: /triste|dolor|llanto|fracaso|desconciert|al borde/i },
  { id: "oracion", label: "la oración", icon: "✦", test: /contempl|orar|oración|betania|ante dios|desierto/i },
  { id: "amargura", label: "la amargura", icon: "◇", test: /amargura|joven rico|tentaci|dificultad|fracaso/i },
  { id: "voluntad", label: "seguir la voluntad de Dios", icon: "↗", test: /voluntad|llamada|vocaci|misión|camino|decisión/i },
  { id: "fiat", label: "decir «sí» — fiat", icon: "M", test: /maría|anunciación|visitación|caná|respuesta libre/i },
  { id: "confianza", label: "volver a confiar", icon: "≈", test: /confi|vivir de fe|preocupaci|palabra que salva|hijo amado/i },
  { id: "alegria", label: "recuperar la alegría", icon: "☀", test: /alegr|felicidad|fiesta|visitación|caná/i },
  { id: "conversion", label: "recomenzar y convertirse", icon: "↺", test: /zaqueo|pródigo|bartimeo|publicano|convers|volver al padre|nueva fuerza/i },
  { id: "prueba", label: "atravesar la prueba", icon: "△", test: /desierto|sufrimiento|dificultad|tentaci|fracaso|cruz|ciego/i },
  { id: "caridad", label: "amar y servir", icon: "♡", test: /samaritano|prójimo|pentecostés|servicio|almas|perfume|cariño/i }
];

function repair(value = "") {
  let text = String(value);
  for (let i = 0; i < 2 && /Ã|Â|â/.test(text); i++) {
    const candidate = Buffer.from(text, "latin1").toString("utf8");
    if ((candidate.match(/Ã|Â|â/g) || []).length >= (text.match(/Ã|Â|â/g) || []).length) break;
    text = candidate;
  }
  return text.replace(/\s+/g, " ").trim();
}

let meditations = (external.items || [])
  .filter(item => item.type === "prayer" && /^https:\/\/(?:www\.)?opusdei\.org\//i.test(item.url || ""))
  .map(item => {
    const title = repair(item.title);
    const description = repair(item.description);
    const searchable = `${title} ${description}`;
    let categoryIds = themes.filter(theme => theme.test.test(searchable)).map(theme => theme.id);
    if (!categoryIds.length) categoryIds = ["oracion"];
    return {
      id: item.id,
      title,
      description,
      url: item.url,
      image: item.image || "",
      source: "Opus Dei · Como en una película",
      categoryIds
    };
  });

if (!meditations.length) {
  meditations = (opus.records || [])
    .filter(item => item.contentFile || item.excerpt || !/^Meditación del \d{2}\/\d{2}\/\d{4}$/.test(item.title || ""))
    .map(item => {
      const title = repair(item.title);
      const description = repair(item.excerpt || `Meditación del Evangelio correspondiente al ${item.date}.`);
      const searchable = `${title} ${(item.themes || []).join(" ")} ${description}`;
      let categoryIds = themes.filter(theme => theme.test.test(searchable)).map(theme => theme.id);
      if (!categoryIds.length) categoryIds = ["oracion"];
      return { id:`opus-${item.date}`, title, description, url:item.officialUrl, image:item.image || "", source:"Opus Dei · Meditaciones", categoryIds };
    });
}

const counts = Object.fromEntries(themes.map(theme => [theme.id, meditations.filter(item => item.categoryIds.includes(theme.id)).length]));
const payload = `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  editorialNote: "Selección temática de metadatos y enlaces oficiales. Atlas no reproduce el artículo completo.",
  themes: themes.map(({ test, ...theme }) => ({ ...theme, count: counts[theme.id] })),
  meditations
}, null, 2)}\n`;
await fs.writeFile(path.join(root, "data/gospel-meditations.json"), payload);
await fs.mkdir(path.join(root, "dist/data"), { recursive: true });
await fs.writeFile(path.join(root, "dist/data/gospel-meditations.json"), payload);
console.log(`Meditaciones: ${meditations.length}; categorías: ${themes.length}`);
