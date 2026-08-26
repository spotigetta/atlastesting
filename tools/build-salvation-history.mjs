import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const atlasRoot = resolve(here, "..");
const sourcePath = resolve(atlasRoot, "..", "conversacion_completa.md");
const outputPath = resolve(atlasRoot, "data", "salvation-history.json");

const markdown = await readFile(sourcePath, "utf8");
const eventPattern = /^###\s+(\d+)\.\s+(.+)\r?\n([\s\S]*?)(?=^###\s+\d+\.|^#\s+Respuesta|^##\s+Rama|(?![\s\S]))/gm;
const field = (body, name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(`\\*\\*${escaped}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*[^*]+:\\*\\*|\\n\\s*---|$)`, "i"));
  return (match?.[1] || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
};
const plain = value => String(value || "").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/[*_`>#]/g, "").replace(/\s+/g, " ").trim();
const slug = value => plain(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 56);

const eras = [
  { id:"creation", title:"Creación", subtitle:"Una familia nacida del don", range:[1,24], color:"#77a56b", accent:"#d7e9b5", symbol:"✦", books:["Génesis"] },
  { id:"noah", title:"Noé", subtitle:"La creación preservada", range:[25,36], color:"#4f92a8", accent:"#b9e6e7", symbol:"⌁", books:["Génesis"] },
  { id:"patriarchs", title:"Abraham y los patriarcas", subtitle:"Una familia para bendecir a todas", range:[37,331], color:"#b98745", accent:"#f1d39a", symbol:"✧", books:["Génesis"] },
  { id:"moses", title:"Moisés", subtitle:"Un pueblo liberado y consagrado", range:[332,383], color:"#b9523f", accent:"#f1ae82", symbol:"△", books:["Éxodo","Levítico","Números","Deuteronomio"] },
  { id:"land", title:"Tierra y jueces", subtitle:"Aprender a vivir como pueblo", range:[384,417], color:"#74884d", accent:"#cbd999", symbol:"⌂", books:["Josué","Jueces","Rut","1 Samuel"] },
  { id:"david", title:"David, reino y profetas", subtitle:"Una casa y un trono para siempre", range:[418,482], color:"#725388", accent:"#d2b5e2", symbol:"♕", books:["Samuel","Reyes","Crónicas","Profetas"] },
  { id:"return", title:"Exilio y espera", subtitle:"La promesa permanece encendida", range:[483,519], color:"#66707d", accent:"#bfc8ce", symbol:"◐", books:["Esdras","Nehemías","Macabeos","Profetas"] },
  { id:"christ", title:"Jesucristo", subtitle:"Todas las promesas convergen en el Hijo", range:[520,843], color:"#a93d42", accent:"#f3c485", symbol:"✝", books:["Evangelios"] },
  { id:"church", title:"Iglesia", subtitle:"La familia se abre a las naciones", range:[844,999], color:"#cb7441", accent:"#ffd58d", symbol:"🔥", books:["Hechos","Cartas apostólicas","Padres apostólicos"] },
  { id:"consummation", title:"Consumación", subtitle:"La familia entra en la Jerusalén definitiva", range:[1000,9999], color:"#354d79", accent:"#ddc877", symbol:"◎", books:["Apocalipsis"] }
];
const eraFor = number => eras.find(item => number >= item.range[0] && number <= item.range[1]) || eras.at(-1);
const topicRules = {
  cordero:/cordero|abel|sacrific|pascua|isaías 53|siervo sufriente/i,
  templo:/templo|santuario|tabernáculo|morada|arca/i,
  reino:/reino|rey|trono|corona|davíd/i,
  hijo:/hijo|filiación|primogénit|padre/i,
  pascua:/pascua|éxodo|mar rojo|pan ácimo|calvario/i,
  sacerdocio:/sacerd|melquisedec|levita|altar/i,
  esposo:/espos|boda|matrimonio|alianza matrimonial/i,
  espiritu:/espíritu|pentecostés|viento|fuego/i,
  nuevaAlianza:/nueva alianza|sangre de la alianza|corazón nuevo|jeremías 31/i
};
const personRules = ["Adán","Eva","Noé","Abraham","Sara","Isaac","Jacob","José","Moisés","Aarón","Josué","Rut","Samuel","Saúl","David","Salomón","Elías","Isaías","Jeremías","Ezequiel","Daniel","María","José","Juan Bautista","Jesús","Pedro","Pablo","Bernabé"];

const events = [];
for (const match of markdown.matchAll(eventPattern)) {
  const number = Number(match[1]);
  const title = plain(match[2]);
  const body = match[3];
  const date = plain(field(body, "Fecha"));
  const summary = plain(field(body, "Descripción") || field(body, "Hito"));
  const full = field(body, "Descripción completa") || field(body, "Descripción") || plain(body);
  const references = plain(field(body, "Referencias bíblicas")).split(/\s*;\s*/).filter(Boolean);
  const relation = plain(field(body, "Relación con la historia de la salvación"));
  const searchable = `${title} ${summary} ${relation} ${references.join(" ")}`;
  const topics = Object.entries(topicRules).filter(([,pattern]) => pattern.test(searchable)).map(([id]) => id);
  const people = personRules.filter(person => new RegExp(`\\b${person.replace("í","[ií]").replace("é","[eé]")}\\b`, "i").test(searchable));
  const era = eraFor(number);
  events.push({
    id:`hito-${number}-${slug(title)}`, number, title, date, summary, fullDescription:full,
    references, relation, eraId:era.id, topics, people,
    importance: number === era.range[0] || /alianza|nace jesús|resurrección|pentecostés|pascua|sinaí|templo|exilio/i.test(title) ? 3 : references.length >= 7 ? 2 : 1
  });
}

if (events.length < 850) throw new Error(`La extracción solo produjo ${events.length} hitos; se esperaban al menos 850.`);
const numbers = new Set(events.map(item => item.number));
const payload = {
  version:1,
  generatedAt:new Date().toISOString(),
  source:{
    title:"Un padre fiel a sus promesas",
    author:"Scott Hahn",
    url:"#/reader/history-un-padre-fiel-a-sus-promesas-scott-hahn",
    documentId:"history-un-padre-fiel-a-sus-promesas-scott-hahn",
    note:"Eje hermenéutico: Dios forma progresivamente una familia mediante alianzas y cumple sus promesas en Cristo."
  },
  stats:{ events:events.length, numberedEvents:numbers.size, first:Math.min(...numbers), last:Math.max(...numbers) },
  eras,
  topics:[
    ["cordero","Cordero"],["templo","Templo"],["reino","Reino"],["hijo","Hijo"],["pascua","Pascua"],
    ["sacerdocio","Sacerdocio"],["esposo","Esposo"],["espiritu","Espíritu"],["nuevaAlianza","Nueva Alianza"]
  ].map(([id,label]) => ({ id,label,count:events.filter(item => item.topics.includes(id)).length })),
  events
};

await mkdir(dirname(outputPath), { recursive:true });
await writeFile(outputPath, JSON.stringify(payload), "utf8");
console.log(`Historia de la Salvación: ${events.length} hitos, ${payload.topics.length} conexiones temáticas.`);
