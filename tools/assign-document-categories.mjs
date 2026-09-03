import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const catalogPath = path.join(root, "data", "catalog.json");
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));

const normalize = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const textOf = doc => normalize(`${doc.title || ""} ${doc.author || ""} ${doc.file || ""}`);
const has = (text, ...terms) => terms.some(term => text.includes(normalize(term)));

function doctrineCategory(doc) {
  const text = textOf(doc);
  if (has(text, "antiqua et nova", "inteligencia artificial")) return "Fe, razón e inteligencia artificial";
  if (has(text, "samaritanus", "dignitas infinita", "dignitas personae", "bioetica", "persona humana", "que es el hombre", "comunion y servicio")) return "Antropología, dignidad y bioética";
  if (has(text, "gestis verbisque", "reciprocidad entre fe y sacramentos", "desiderio desideravi")) return "Sacramentos y vida litúrgica";
  if (has(text, "placuit deo", "jesucristo hijo de dios", "historicidad de los evangelios")) return "Cristología y salvación";
  if (has(text, "oeconomicae", "fratelli tutti", "querida amazonia", "etica universal", "libertad religiosa")) return "Doctrina social, economía y cultura";
  if (has(text, "iuvenescit", "sinodalidad", "diaconado", "memoria y reconciliacion")) return "Iglesia, carismas y ministerios";
  if (has(text, "gaudete et exsultate", "misericordia et misera")) return "Santidad, misericordia y vida espiritual";
  if (has(text, "christus vivit")) return "Jóvenes, vocación y discernimiento";
  if (has(text, "patris corde")) return "San José, familia y paternidad";
  if (has(text, "fiducia supplicans")) return "Pastoral, afectividad y acompañamiento";
  if (has(text, "teologia hoy", "ad theologiam")) return "Teología y misión";
  if (has(text, "pueblo judio", "sagradas escrituras", "inspiracion y verdad", "biblia y moral")) return "Sagrada Escritura e interpretación";
  if (has(text, "religiones", "esperanza de salvacion")) return "Religiones, misión y escatología";
  return "Magisterio y doctrina contemporánea";
}

function ortodoxiaCategory(doc) {
  const text = textOf(doc);
  if (has(text, "instrucciones de uso", "criterios de adquisicion", "guia de fuentes")) return "Guía del corpus y método";
  if (has(text, "gaudium et spes", "dignitatis humanae")) return "Concilio Vaticano II";
  if (has(text, "catecismo", "compendio catecismo")) return "Catecismo y síntesis de la fe";
  if (has(text, "agustin", "augustin")) return "Padres de la Iglesia · San Agustín";
  if (has(text, "suma teologica", "santo tomas")) return "Teología y moral · Santo Tomás";
  if (has(text, "deus caritas", "evangelium vitae", "veritatis splendor", "humanae vitae", "familiaris consortio", "mulieris dignitatem", "carta a las familias", "amoris laetitia")) return "Magisterio · matrimonio, familia y vida";
  if (has(text, "dignitas infinita", "dignitas personae", "sexualidad humana", "uniones homosexuales", "uniones de hecho", "etica sexual")) return "Magisterio · dignidad, afectividad y bioética";
  if (has(text, "biblia y moral", "reciprocidad entre fe y sacramentos")) return "Sagrada Escritura, moral y sacramentos";
  if (has(text, "chesterton")) return "Apologética y cultura · G. K. Chesterton";
  if (has(text, "newman")) return "Fe, razón y universidad · J. H. Newman";
  if (has(text, "plato", "aristotle", "cicero")) return "Filosofía clásica y virtud";
  if (has(text, "belloc")) return "Historia, sociedad y cultura cristiana";
  if (has(text, "benson")) return "Novela, conversión y vida cristiana";
  if (has(text, "comunicar la fe", "catholic voices", "word on fire", "trent horn", "ronald knox", "arguments", "public discourse", "aceprensa", "omnes", "diego blanco")) return "Comunicación pública, apologética y cultura";
  if (has(text, "cuerpo", "sexualidad", "castidad", "matrimonio", "familia", "afectividad", "genero", "queer", "pornografia", "amor", "celibato")) return "Afectividad, matrimonio y teología del cuerpo";
  if (has(text, "bioetica", "genetica", "biotecnologia", "eugenics", "vulnerabilidad")) return "Bioética, salud y vulnerabilidad";
  if (has(text, "ley natural", "bien comun", "doctrina social", "economia", "politica", "libertad religiosa", "derecho")) return "Ética social, derecho y bien común";
  if (has(text, "psiquiatr", "salud mental", "emociones", "trauma", "perdon", "madurez", "personalidad")) return "Salud mental, madurez y acompañamiento";
  if (has(text, "educacion", "universidad", "fe, razon", "fe razon")) return "Educación, fe y razón";
  return "Doctrina y debate público";
}

function clasicosCategory(doc) {
  const text = textOf(doc);
  if (has(text, "plato", "aristotle", "cicero", "adam smith", "tocqueville", "hobbes", "paine", "mill", "kropotkin", "maimonides", "montesquieu", "emerson", "voltaire", "politics", "wealth of nations", "on liberty", "leviathan", "federalist", "de legibus", "de officiis")) return "Pensamiento, filosofía y política";
  if (has(text, "shakespeare", "sophocles", "moliere", "milton", "virgil", "ovid", "whitman", "yeats", "tagore", "poems", "poesia", "tartuffe", "antigone", "aeneid", "metamorphoses", "gitanjali")) return "Teatro, poesía y mito";
  if (has(text, "caesar", "grant", "equiano", "northup", "andrews", "memoirs", "history", "travels", "journey", "diary", "ten days", "prisons", "hawaii", "autobiography")) return "Historia, viajes y memorias";
  if (has(text, "baum", "carroll", "grimm", "verne", "kipling", "dunsany", "wyss", "aladdin", "alice", "fairy", "magic", "adventures", "saga", "treasure", "island", "fantasy")) return "Aventura, imaginación e infancia";
  if (has(text, "christie", "conan", "mystery", "detective", "poirot", "leavenworth", "beetle", "lodger")) return "Misterio, terror y relato popular";
  return "Narrativa · novela y relato";
}

function sanJosemariaCategory(doc) {
  const text = textOf(doc);
  if (has(text, "camino", "surco", "forja")) return "Obras de espiritualidad";
  if (has(text, "amigos de dios", "es cristo que pasa", "amar a la iglesia")) return "Homilías, Iglesia y vida cristiana";
  if (has(text, "cartas", "carta no")) return "Cartas";
  if (has(text, "tertulia", "conversaciones")) return "Entrevistas y tertulias";
  if (has(text, "santo rosario", "via crucis")) return "Oración y devociones";
  if (has(text, "abadesa", "universidad")) return "Estudios históricos y culturales";
  if (has(text, "dialogo con el senor")) return "Meditaciones y oración";
  if (has(text, "index", "obras completas")) return "Guías de lectura y obras completas";
  return "San Josemaría · otros escritos";
}

function cinepilotCategory(doc) {
  const text = textOf(doc);
  if (has(text, "lista peliculas")) return "Índices y guías de visionado";
  if (has(text, "imagenes", "contenidos")) return "Recursos visuales y contenidos";
  return "Fichas y recomendaciones cinematográficas";
}

function bibliotecariaCategory(doc) {
  const text = textOf(doc);
  if (has(text, "ensayos", "pensamiento")) return "Ensayo, pensamiento y humanidades";
  if (has(text, "descripciones ampliadas")) return "Guías de literatura universal";
  if (has(text, "lote")) return "Selecciones por autores y obras";
  return "Guías de literatura universal";
}

const rules = {
  doctrine: doctrineCategory,
  ortodoxia: ortodoxiaCategory,
  cinepilot: cinepilotCategory,
  bibliotecaria: bibliotecariaCategory,
  clasicos: clasicosCategory,
  "san-josemaria": sanJosemariaCategory
};

const generic = value => !value || /^(nuevos documentos|sin categor[ií]a|sin clasificar|otros|general|documento)$/i.test(value.trim());
const changes = [];

for (const library of catalog.libraries) {
  const classify = rules[library.id];
  if (classify) {
    for (const doc of library.documents || []) {
      if (!generic(doc.category)) continue;
      const category = classify(doc);
      if (!category) throw new Error(`No se pudo clasificar ${library.id}/${doc.id}`);
      changes.push({ library: library.id, id: doc.id, from: doc.category || "", to: category });
      doc.category = category;
    }
  }
  const counts = new Map();
  for (const doc of library.documents || []) {
    if (generic(doc.category)) throw new Error(`Categoría genérica pendiente: ${library.id}/${doc.id}`);
    counts.set(doc.category, (counts.get(doc.category) || 0) + 1);
  }
  library.categories = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
  library.stats = { ...library.stats, documents: library.documents.length, words: library.documents.reduce((sum, doc) => sum + (doc.words || 0), 0), categories: library.categories.length, authors: new Set(library.documents.map(doc => doc.author).filter(Boolean)).size };
}

if (process.argv.includes("--check")) {
  console.log(`Auditoría correcta: ${catalog.libraries.length} bibliotecas; ${changes.length} documentos clasificarían.`);
  process.exit(0);
}

await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Categorías asignadas: ${changes.length}`);
for (const library of catalog.libraries) console.log(`${library.id}: ${library.categories.length} categorías`);
