import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

// Editorial navigation only. Sources are resolved against the shipped corpus;
// no answer is attributed to NotebookLM and no protected text is copied here.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/catalog.json"), "utf8"));
const documents = new Map(catalog.libraries.flatMap(library => library.documents.map(doc => [doc.id, { ...doc, library }])));
const catechism = "doctrine-0091_Catecismo_Iglesia_Catol";
const classics = author => `clasicos-${author} - Obras completas`;
const entries = [
  {
    id: "fe", title: "Creer y comprender", group: "biblioteca", tone: "ochre", shape: "arch",
    description: "Qué significa creer y por qué la fe se vive con otros.",
    question: "¿La fe es una decisión individual?",
    answer: "La respuesta a Dios es personal y libre. El Catecismo añade que nadie cree solo: recibimos la fe de otros y también la transmitimos.",
    sources: [{ id: catechism, title: "Catecismo de la Iglesia Católica", author: "Iglesia católica", location: "Número 166", quote: "La fe es un acto personal: la respuesta libre del hombre a la iniciativa de Dios que se revela." }],
    followUp: "Explica la relación entre fe personal e Iglesia en los números 166–169 del Catecismo. Cita cada afirmación."
  },
  {
    id: "conciencia", title: "Conciencia y libertad", group: "biblioteca", tone: "ink", shape: "steps",
    description: "Leer sobre la responsabilidad de nuestros actos.",
    question: "¿Qué entiende el Catecismo por libertad?",
    answer: "La vincula con la razón y la voluntad: podemos actuar o no actuar y elegir deliberadamente. Esa capacidad explica que nuestros actos tengan una responsabilidad personal.",
    sources: [{ id: catechism, title: "Catecismo de la Iglesia Católica", author: "Iglesia católica", location: "Número 1731", quote: "La libertad es el poder, radicado en la razón y en la voluntad, de obrar o de no obrar" }],
    followUp: "Distingue libertad y responsabilidad según los números 1730–1742 del Catecismo, con citas."
  },
  {
    id: "oracion", title: "Empezar a rezar", group: "biblioteca", tone: "olive", shape: "orbit",
    description: "La oración explicada desde sus fuentes.",
    question: "¿Tengo que saber qué decir para hacer oración?",
    answer: "En Camino, san Josemaría propone hablar con Dios de la propia vida, incluidas las preocupaciones y las flaquezas. El punto 91 ofrece un comienzo concreto para esa conversación.",
    sources: [{ id: "san-josemaria-camino", title: "Camino", author: "San Josemaría Escrivá", location: "Punto 91", quote: "orar es hablar con Dios. Pero, ¿de qué?" }, { id: catechism, title: "Catecismo de la Iglesia Católica", author: "Iglesia católica", location: "Número 2559", quote: "La oración es la elevación del alma a Dios o la petición a Dios de bienes convenientes" }],
    followUp: "Ayúdame a comprender el punto 91 de Camino y el número 2559 del Catecismo. Distingue explicación y cita literal."
  },
  {
    id: "liturgia", title: "Comprender la liturgia", group: "biblioteca", tone: "wine", shape: "arch",
    description: "Por qué la celebración ocupa un lugar central en la Iglesia.",
    question: "¿Qué lugar tiene la liturgia en la vida cristiana?",
    answer: "Sacrosanctum Concilium la describe como cumbre de la actividad de la Iglesia y fuente de su fuerza. En su número 10 relaciona esa afirmación con reunirse para alabar a Dios y participar en el sacrificio.",
    sources: [{ id: "liturgy-0076_Sacrosanctum_Concilium_ES", title: "Sacrosanctum Concilium", author: "Concilio Vaticano II", location: "Número 10", quote: "la Liturgia es la cumbre a la cual tiende la actividad de la Iglesia y al mismo tiempo la fuente de donde mana toda su fuerza" }],
    followUp: "Explica Sacrosanctum Concilium 10 y su relación con la vida fuera de la celebración. Fundamenta la respuesta en el documento."
  },
  {
    id: "trabajo", title: "La vida de cada día", group: "biblioteca", tone: "ochre", shape: "steps",
    description: "El trabajo y las decisiones pequeñas en Camino.",
    question: "¿Por dónde empezar si estoy aplazando mi trabajo?",
    answer: "El punto 15 de Camino propone un primer paso muy concreto: no dejar para mañana el trabajo de hoy. Es una invitación breve a actuar, que puede leerse dentro del capítulo sobre el carácter.",
    sources: [{ id: "san-josemaria-camino", title: "Camino", author: "San Josemaría Escrivá", location: "Carácter, punto 15", quote: "No dejes tu trabajo para mañana." }],
    followUp: "Relaciona el punto 15 de Camino con otros textos de san Josemaría sobre el trabajo. Identifica la obra y el punto de cada cita."
  },
  {
    id: "agustin", title: "La búsqueda de Dios", group: "biblioteca", tone: "blue", shape: "orbit",
    description: "Entrar en las Confesiones de san Agustín.",
    question: "¿Cómo empiezan las Confesiones?",
    answer: "Agustín comienza hablando directamente con Dios. La inquietud del corazón aparece como una búsqueda de descanso en Él; esa forma de dirigirse a Dios permite leer el inicio como una oración.",
    sources: [{ id: "doctrine-0146_Agustin_Confesiones", title: "Confesiones", author: "San Agustín", location: "Libro I, capítulo 1", quote: "está inquieto nuestro corazón hasta que descanse en Vos" }],
    followUp: "Comenta el libro I, capítulo 1, de las Confesiones. ¿Qué relación establece Agustín entre conocer, invocar y alabar a Dios? Cita el pasaje."
  },
  {
    id: "vida-buena", title: "La vida buena", group: "clasicos", tone: "ochre", shape: "orbit",
    description: "Aristóteles: la felicidad y el tiempo que exige vivir bien.",
    question: "¿Un buen día basta para ser feliz, según Aristóteles?",
    answer: "En el libro I de la Ética a Nicómaco, Aristóteles compara la felicidad con la llegada de la primavera: un solo día no basta. Su argumento pide mirar una vida completa, no un instante agradable.",
    sources: [{ id: classics("Aristotle"), title: "Ética a Nicómaco", author: "Aristóteles", location: "Libro I, capítulo 7", language: "en", quote: "one swallow or one fine day does not make a spring" }],
    related: [{ id: classics("Plato"), title: "Apología de Sócrates", author: "Platón" }],
    followUp: "¿Por qué Aristóteles necesita una vida completa para hablar de felicidad? Comenta Ética a Nicómaco I, 7 y cita el texto disponible."
  },
  {
    id: "justicia", title: "Justicia y misericordia", group: "clasicos", tone: "wine", shape: "arch",
    description: "Un juicio en Shakespeare y una pregunta sobre el perdón.",
    question: "¿Qué dice Porcia sobre la misericordia?",
    answer: "En El mercader de Venecia, Porcia afirma que la misericordia no se puede imponer y que beneficia a quien la da y a quien la recibe. Es el argumento de un personaje en una escena judicial, no una sentencia del narrador.",
    sources: [{ id: classics("William Shakespeare"), title: "El mercader de Venecia", author: "William Shakespeare", location: "Acto IV, escena I, intervención de Porcia", language: "en", quote: "The quality of mercy is not strain'd," }],
    related: [{ id: `${classics("Fyodor Dostoyevsky")} - Parte 01`, title: "Crimen y castigo", author: "Fiódor Dostoievski" }],
    followUp: "Comenta el discurso de Porcia sobre la misericordia en El mercader de Venecia, acto IV, escena I. ¿Cómo se relaciona con lo que sucede después? Cita el texto."
  },
  {
    id: "heroes", title: "Héroes y conflictos", group: "clasicos", tone: "blue", shape: "steps",
    description: "La cólera de Aquiles como entrada a la Ilíada.",
    question: "¿La Ilíada comienza celebrando una victoria?",
    answer: "Su primera invocación anuncia la cólera de Aquiles y el daño que ocasiona a los aqueos. Este inicio propone leer la acción heroica atendiendo también a sus consecuencias para los demás.",
    sources: [{ id: classics("Homer"), title: "Ilíada", author: "Homero", location: "Canto I, inicio", language: "en", quote: "Sing, O goddess, the anger of Achilles son of Peleus, that brought countless ills upon the Achaeans." }],
    related: [{ id: classics("Miguel de Cervantes Saavedra"), title: "Don Quijote", author: "Miguel de Cervantes" }],
    followUp: "Explica el comienzo del canto I de la Ilíada. ¿Cómo afecta la cólera de Aquiles a los demás? Cita ejemplos y diferencia hechos del relato e interpretación."
  },
  {
    id: "familia", title: "Familia y vínculos", group: "clasicos", tone: "olive", shape: "arch",
    description: "La casa de los Oblonski al comienzo de Anna Karénina.",
    question: "¿Cómo pasa Tolstói de una frase general a una familia concreta?",
    answer: "Anna Karénina abre con una afirmación sobre las familias felices e infelices. El párrafo siguiente sitúa el conflicto en casa de los Oblonski: una infidelidad ha roto la convivencia. La novela concreta así la frase inicial.",
    sources: [{ id: `${classics("Leo Tolstoy")} - Parte 01`, title: "Anna Karénina", author: "Lev Tolstói", location: "Primera parte, capítulo 1", language: "en", quote: "Happy families are all alike; every unhappy family is unhappy in its own way." }],
    related: [{ id: `${classics("Jane Austen")} - Parte 01`, title: "Emma", author: "Jane Austen" }],
    followUp: "Comenta el inicio de Anna Karénina y la crisis de los Oblonski en la primera parte, capítulo 1. Apoya tu lectura en pasajes concretos."
  },
  {
    id: "examinar-vida", title: "Examinar la propia vida", group: "clasicos", tone: "ink", shape: "steps",
    description: "Sócrates ante sus jueces en la Apología.",
    question: "¿Por qué Sócrates insiste en seguir preguntando?",
    answer: "En la Apología, Sócrates presenta el examen de sí mismo y de los demás como un bien. Su frase sobre la vida sin examen aparece mientras explica a los jueces por qué no puede prometer que dejará de filosofar.",
    sources: [{ id: classics("Plato"), title: "Apología de Sócrates", author: "Platón", location: "38a, defensa ante los jueces", language: "en", quote: "the unexamined life is not worth living" }],
    related: [{ id: classics("Aristotle"), title: "Ética a Nicómaco", author: "Aristóteles" }],
    followUp: "Sitúa la frase sobre la vida sin examen en la Apología de Sócrates, 38a. ¿Qué está respondiendo Sócrates? Cita su argumento."
  },
  {
    id: "interioridad", title: "Deseo y búsqueda", group: "clasicos", tone: "wine", shape: "orbit",
    description: "Leer la inquietud de Agustín en primera persona.",
    question: "¿Las Confesiones cuentan una vida o hablan con Dios?",
    answer: "En su comienzo hacen ambas cosas: Agustín habla de la condición humana mientras se dirige a Dios. El deseo de descanso aparece dentro de esa conversación, que da forma al relato de su vida.",
    sources: [{ id: classics("Augustine of Hippo"), title: "Confesiones", author: "San Agustín", location: "Libro I, capítulo 1", language: "en", quote: "our heart is restless, until it repose in Thee" }],
    related: [{ id: classics("Dante"), title: "Paraíso", author: "Dante Alighieri" }],
    followUp: "Explica cómo se combinan narración y oración al comienzo del libro I de las Confesiones de Agustín. Distingue las palabras del autor de tu interpretación."
  }
];

const errors = [];
const payloads = new Map();
function resolveSource(source, topic, cited = true) {
  const doc = documents.get(source.id);
  if (!doc) { errors.push(`${topic.id}: missing document ${source.id}`); return null; }
  if (doc.unlockFeature || doc.library.unlockFeature) { errors.push(`${topic.id}: protected source excluded ${source.id}`); return null; }
  const result = { ...source, libraryId: doc.library.id };
  if (cited) {
    let payload = payloads.get(doc.id);
    if (!payload) {
      const bytes = fs.readFileSync(path.join(root, doc.contentFile));
      payload = JSON.parse(doc.contentFile.endsWith(".gz") ? gunzipSync(bytes) : bytes.toString("utf8"));
      payloads.set(doc.id, payload);
    }
    const chunk = payload.chunks.find(chunk => String(chunk.markdown ?? chunk.text ?? "").includes(source.quote));
    if (!chunk) { errors.push(`${topic.id}: quote not found in ${source.id}: ${source.quote}`); return null; }
    result.chunkIndex = chunk.index ?? payload.chunks.indexOf(chunk);
    // q is supported by the existing reader: it opens the matching chunk and
    // highlights the literal phrase, rather than promising an unsupported anchor.
    result.readerUrl = `#/reader/${encodeURIComponent(doc.id)}?q=${encodeURIComponent(source.quote)}`;
  } else result.readerUrl = `#/reader/${encodeURIComponent(doc.id)}`;
  return result;
}
const topics = entries.map(topic => ({
  ...topic,
  sources: topic.sources.map(source => resolveSource(source, topic)).filter(Boolean),
  related: (topic.related || []).map(source => resolveSource(source, topic, false)).filter(Boolean)
}));
if (errors.length) throw new Error(errors.join("\n"));
const result = {
  schemaVersion: 1,
  editorialNote: "Selección editorial de Atlas. Las respuestas breves se verifican con los pasajes enlazados; no son respuestas generadas por NotebookLM.",
  topics
};
const target = path.join(root, "data/discovery-library.json");
if (!process.argv.includes("--check")) fs.writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`, "utf8");
else if (fs.readFileSync(target, "utf8") !== `${JSON.stringify(result, null, 2)}\n`) throw new Error("Discovery data is stale; run node tools/build-discovery-library.mjs");
console.log(`${topics.length} editorial topics; ${topics.reduce((n, topic) => n + topic.sources.length, 0)} verified quotations; no protected sources.`);
