/*
 * Genera el corpus verificable del modo "Cómo lo vivieron los santos".
 *
 * Fuente única: ../Vida de los Santos/*.md (incluidas las semblanzas).
 * Salida: data/saints-moods.json.
 *
 * El generador no redacta ni parafrasea citas: cada excerpt es una subcadena
 * literal del Markdown de origen. La selección es léxica y reproducible, queda
 * explicada mediante matchedTerms, score y la posición exacta en el documento.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const atlasRoot = dirname(toolsDir);
const workspaceRoot = dirname(atlasRoot);
const sourceRoot = join(workspaceRoot, "Vida de los Santos");
const catalogFile = join(atlasRoot, "data", "catalog.json");
const outputFile = join(atlasRoot, "data", "saints-moods.json");
const LIBRARY_ID = "vida-santos";
const PASSAGES_PER_MOOD = 10;

const moods = [
  { id: "desolacion-espiritual", label: "Desolación espiritual", group: "En la desolación", description: "Cuando desaparece el consuelo y el alma atraviesa oscuridad interior.", terms: ["desolación", "desolation", "sin consuelo", "no consolation", "oscuridad del alma", "darkness of soul", "abandono interior", "interior darkness", "desierto espiritual", "spiritual desert", "pruebas interiores", "interior trials", "spiritual trials", "sequedad espiritual", "spiritual dryness", "aridez"], context: ["alma", "soul", "espiritual", "spiritual", "dios", "god", "oración", "prayer", "fe", "faith", "interior"], exclude: ["not without consolation"] },
  { id: "ansiedad-inquietud", label: "Ansiedad e inquietud", group: "En la desolación", description: "Cuando la preocupación, la angustia o la agitación interior pesan.", terms: ["ansiedad", "anxiety", "angustia", "anguish", "inquietud", "uneasiness", "anxious", "preocupación", "worry", "worried", "agitado", "agitation", "distress", "aflicción", "affliction"] },
  { id: "miedo", label: "Miedo", group: "En la desolación", description: "Ante el peligro, el futuro incierto o una amenaza concreta.", terms: ["miedo", "temor", "fear", "afraid", "frightened", "terror", "dread", "asustado", "temía", "fears"] },
  { id: "tribulacion", label: "Tribulación", group: "En la desolación", description: "Pruebas intensas que sacuden la vida y ponen a prueba la fidelidad.", terms: ["tribulación", "tribulation", "prueba", "trial", "adversidad", "adversity", "calamidad", "calamity", "aflicción", "affliction", "penalidad", "hardship"] },
  { id: "soledad", label: "Soledad", group: "En la desolación", description: "Cuando el santo queda solo, aislado o sin apoyo humano.", terms: ["soledad", "solitude", "se quedó solo", "completamente solo", "alone", "lonely", "loneliness", "aislamiento", "isolation", "abandonado", "forsaken", "sin compañía", "without company"] },
  { id: "duda-oscuridad-fe", label: "Duda y oscuridad de fe", group: "En la desolación", description: "Dudas, oscuridad intelectual o dificultad para comprender el camino de Dios.", terms: ["duda", "doubt", "doubts", "dudaba", "oscuridad de la fe", "darkness of faith", "crisis de fe", "crisis of faith", "incertidumbre", "uncertainty", "perplejo", "perplexed"], context: ["dios", "god", "fe", "faith", "alma", "soul", "creer", "believe", "oración", "prayer", "espiritual", "spiritual"], exclude: ["sin duda", "no quedó duda", "no doubt", "without doubt", "beyond doubt"] },
  { id: "falta-fe", label: "Falta de fe", group: "En la desolación", description: "Momentos de incredulidad, alejamiento o fe debilitada.", terms: ["falta de fe", "lack of faith", "poca fe", "little faith", "incredulidad", "unbelief", "incrédulo", "unbeliever", "perdió la fe", "lost his faith", "lost her faith", "sin fe", "without faith"] },
  { id: "enfermedad", label: "Enfermedad", group: "En la desolación", description: "La enfermedad vivida con realismo, fe y esperanza.", terms: ["enfermedad", "illness", "disease", "enfermo", "enferma", "sick", "malady", "dolencia", "fiebre", "fever", "hospital", "médico", "physician"] },
  { id: "dolor-fisico", label: "Dolor físico", group: "En la desolación", description: "Dolor corporal, heridas y limitaciones físicas.", terms: ["dolor físico", "physical pain", "sufrimiento físico", "physical suffering", "dolor extremo", "extreme pain", "severe pain", "sufría dolores", "suffered pain", "herida", "wound", "herido", "wounded", "agonía", "agony", "tormento", "torment", "lesión", "injury"], context: ["cuerpo", "body", "físico", "physical", "enfermedad", "illness", "herida", "wound", "sick", "fiebre", "fever", "salud", "health"] },
  { id: "persecucion", label: "Persecución", group: "En la desolación", description: "Hostilidad y persecución sufridas por fidelidad a Cristo.", terms: ["persecución", "persecution", "perseguido", "persecuted", "perseguían", "hostilidad", "hostility", "enemigos de la fe", "enemies of the faith", "opresión", "oppression"] },
  { id: "martirio", label: "Martirio", group: "En la desolación", description: "El testimonio supremo de la fe ante la violencia y la muerte.", terms: ["martirio", "martyrdom", "mártir", "martyr", "martyrs", "dio su vida", "gave his life", "gave her life", "por la fe", "for the faith", "sangre de los mártires"] },
  { id: "cruz-sufrimiento", label: "Cruz y sufrimiento", group: "En la desolación", description: "Cargar con la cruz y unir el sufrimiento al de Cristo.", terms: ["la cruz", "the cross", "su cruz", "his cross", "her cross", "sufrimiento", "suffering", "padecimiento", "sorrow", "pasión de cristo", "passion of christ"] },
  { id: "tentacion", label: "Tentación", group: "En la desolación", description: "Combate interior frente a tentaciones y engaños.", terms: ["tentación", "temptation", "tentado", "tempted", "tentaciones", "temptations", "demonio", "devil", "enemigo del alma", "enemy of the soul", "evil one", "combate espiritual", "spiritual combat"] },
  { id: "sequedad-oracion", label: "Sequedad en la oración", group: "En la desolación", description: "Orar sin gusto sensible, entre aridez y aparente silencio de Dios.", terms: ["sequedad", "dryness", "aridez", "aridity", "sin consuelo", "without consolation", "oración seca", "dry prayer", "dificultad en la oración", "difficulty in prayer", "pruebas interiores", "interior trials", "spiritual trials", "oscuridad interior", "interior darkness"], context: ["oración", "prayer", "alma", "soul", "dios", "god", "espiritual", "spiritual", "contemplación", "contemplation", "fe", "faith"], exclude: ["not without consolation"] },
  { id: "abandono-dios", label: "Abandono y ausencia", group: "En la desolación", description: "Cuando el santo queda sin apoyo humano o Dios parece lejano, aunque la fe permanezca.", terms: ["abandonado por dios", "abandoned by god", "dios le había abandonado", "god had forsaken", "dios parecía ausente", "god seemed absent", "silencio de dios", "silence of god", "dios mío por qué", "my god why", "forsaken me", "lejos de dios", "abandonment", "forsaken", "deserted", "desamparo", "desamparado", "left alone", "sin consuelo", "no consolation", "sin auxilio", "without help", "sin ayuda", "without human help", "deprived of consolation"] },
  { id: "tristeza", label: "Tristeza", group: "En la desolación", description: "Tristeza humana o espiritual atravesada sin dejar de buscar a Dios.", terms: ["tristeza", "sadness", "triste", "sad", "melancolía", "melancholy", "pena", "sorrow", "lloró", "wept", "lágrimas", "tears"] },
  { id: "duelo-perdida", label: "Duelo y pérdida", group: "En la desolación", description: "La muerte de seres queridos y otras pérdidas decisivas.", terms: ["duelo", "mourning", "pérdida", "loss", "muerte de su madre", "death of his mother", "death of her mother", "muerte de su padre", "death of his father", "death of her father", "falleció", "bereavement", "quedó huérfano", "orphan"] },
  { id: "fracaso", label: "Fracaso", group: "En la desolación", description: "Proyectos frustrados, derrotas y caminos que parecían cerrarse.", terms: ["fracaso", "failure", "fracasó", "failed", "derrota", "defeat", "derrotado", "defeated", "sin éxito", "unsuccessful", "decepción", "disappointment"] },
  { id: "humillacion", label: "Humillación", group: "En la desolación", description: "Humillaciones y desprecios acogidos sin perder la dignidad cristiana.", terms: ["humillación", "humiliation", "humillado", "humiliated", "desprecio", "contempt", "despreciado", "despised", "burla", "mockery", "ridicule", "insulto", "insult"] },
  { id: "calumnia-incomprension", label: "Calumnia e incomprensión", group: "En la desolación", description: "Juicios injustos, calumnias y falta de comprensión incluso entre cercanos.", terms: ["calumnia", "slander", "calumniado", "slandered", "acusado injustamente", "falsely accused", "incomprensión", "misunderstood", "difamación", "defamation", "falsa acusación", "false accusation"] },
  { id: "pobreza-carencia", label: "Pobreza y carencia", group: "En la desolación", description: "Falta de medios, hambre y pobreza voluntaria o padecida.", terms: ["pobreza", "poverty", "pobre", "poor", "hambre", "hunger", "sin dinero", "without money", "mendigar", "begging", "necesidad", "destitute", "privation"] },
  { id: "prision-cautiverio", label: "Prisión y cautiverio", group: "En la desolación", description: "La fe vivida en la cárcel, el cautiverio o la reclusión forzada.", terms: ["prisión", "prison", "cárcel", "jail", "encarcelado", "imprisoned", "cautiverio", "captivity", "cautivo", "captive", "calabozo", "dungeon", "chains"] },
  { id: "exilio-destierro", label: "Exilio y destierro", group: "En la desolación", description: "Lejos de la patria, expulsado o obligado a comenzar de nuevo.", terms: ["exilio", "exile", "destierro", "banishment", "desterrado", "banished", "expulsado", "expelled", "refugiado", "refugee", "lejos de su patria", "from his homeland"] },
  { id: "cansancio", label: "Cansancio y agotamiento", group: "En la desolación", description: "Fatiga del cuerpo y del alma en una tarea prolongada.", terms: ["cansancio", "fatigue", "cansado", "tired", "agotado", "exhausted", "agotamiento", "weariness", "fatigado", "weary", "sin fuerzas", "no strength"] },
  { id: "impotencia-limites", label: "Impotencia y límites", group: "En la desolación", description: "Aceptar que no se puede todo y obrar fielmente dentro de los propios límites.", terms: ["impotencia", "powerlessness", "incapaz", "unable", "no podía", "could not", "debilidad", "weakness", "débil", "weak", "limitación", "limitations", "sin fuerzas"] },
  { id: "pecado-conversion", label: "Pecado y conversión", group: "Volver a Dios", description: "Una vida transformada al reconocer el pecado y volver a Dios.", terms: ["conversión", "conversion", "conversión a la fe", "conversion to the faith", "converted to the faith", "pecado", "pecador", "sinner", "vida pasada", "former life", "volvió a dios", "returned to god", "cambio de vida", "changed his life", "changed her life"] },
  { id: "culpa-arrepentimiento", label: "Culpa y arrepentimiento", group: "Volver a Dios", description: "El dolor por el mal cometido que abre a una vida nueva.", terms: ["arrepentimiento", "repentance", "arrepentido", "repented", "remordimiento", "remorse", "culpa", "guilt", "contrición", "contrition", "penitencia", "penance"] },
  { id: "confesion-reconciliacion", label: "Confesión y reconciliación", group: "Volver a Dios", description: "Confesar los pecados, recibir el perdón y recomenzar.", terms: ["confesión", "confession", "confesó", "confessed", "confesarse", "sacramento de la penitencia", "sacrament of penance", "absolución", "absolution", "reconciliación", "reconciliation"] },
  { id: "confianza-dios", label: "Confianza en Dios", group: "Encontrar luz", description: "Fiarnos de Dios precisamente cuando no controlamos la situación.", terms: ["confianza en dios", "trust in god", "confió en dios", "trusted in god", "confiar en dios", "confiaba en dios", "trusting god", "puso su confianza", "placed his trust", "placed her trust", "fiarse de dios"] },
  { id: "esperanza", label: "Esperanza", group: "Encontrar luz", description: "Esperar contra toda apariencia y mirar el futuro desde Dios.", terms: ["esperanza", "hope", "esperaba", "hoped", "esperar en dios", "hope in god", "sin perder la esperanza", "did not lose hope", "esperanza cristiana", "christian hope"] },
  { id: "paz-interior", label: "Paz interior", group: "Encontrar luz", description: "La paz que permanece o regresa en medio de dificultades reales.", terms: ["paz interior", "interior peace", "paz del alma", "peace of soul", "en paz", "at peace", "serenidad", "serenity", "tranquilo", "calm", "tranquillity", "peaceful"] },
  { id: "alegria", label: "Alegría", group: "Encontrar luz", description: "Alegría cristiana que no depende de que desaparezcan las dificultades.", terms: ["alegría", "joy", "gozo", "gladness", "júbilo", "rejoicing", "feliz", "happy", "alegre", "joyful", "regocijo"] },
  { id: "consuelo-espiritual", label: "Consuelo espiritual", group: "Encontrar luz", description: "Luz, fervor o consuelo recibido después de una prueba.", terms: ["consuelo", "consolation", "consoló", "comforted", "confortó", "alivio", "relief", "fervor", "fervour", "dulzura espiritual", "spiritual sweetness"] },
  { id: "oracion", label: "Oración", group: "Vida interior", description: "Buscar a Dios, hablar con Él y sostener la vida mediante la oración.", terms: ["oración", "prayer", "rezaba", "prayed", "rezar", "to pray", "plegaria", "contemplation", "meditación", "meditation"] },
  { id: "silencio-recogimiento", label: "Silencio y recogimiento", group: "Vida interior", description: "Silencio exterior e interior para escuchar y contemplar.", terms: ["silencio", "silence", "recogimiento", "recollection", "retiro", "retreat", "soledad", "solitude", "contemplativo", "contemplative", "quietud", "quiet"] },
  { id: "eucaristia", label: "Eucaristía", group: "Vida interior", description: "La Misa, la comunión y la presencia eucarística en su vida.", terms: ["eucaristía", "eucharist", "sagrada comunión", "holy communion", "comunión", "communion", "santa misa", "holy mass", "blessed sacrament", "santísimo sacramento"] },
  { id: "amor-cristo", label: "Amor a Cristo", group: "Vida interior", description: "Una amistad y un amor concretos a Jesucristo.", terms: ["amor a cristo", "love of christ", "amaba a cristo", "loved christ", "amor de jesús", "love of jesus", "cristo crucificado", "crucified christ", "corazón de jesús", "sacred heart"] },
  { id: "amor-maria", label: "Amor a María", group: "Vida interior", description: "Devoción y confianza filial en la Virgen María.", terms: ["virgen maría", "virgin mary", "madre de dios", "mother of god", "nuestra señora", "our lady", "santísima virgen", "blessed virgin", "rosario", "rosary", "devoción a maría"] },
  { id: "obediencia", label: "Obediencia", group: "Virtudes en acción", description: "Obedecer a Dios y a las mediaciones legítimas con libertad interior.", terms: ["obediencia", "obedience", "obedeció", "obeyed", "obediente", "obedient", "voluntad de dios", "will of god", "sumisión", "submission"] },
  { id: "humildad", label: "Humildad", group: "Virtudes en acción", description: "Vivir en la verdad, servir sin buscar protagonismo y aceptar ayuda.", terms: ["humildad", "humility", "humilde", "humble", "humillarse", "self-abasement", "pequeñez", "littleness", "modestia", "modesty"] },
  { id: "paciencia", label: "Paciencia", group: "Virtudes en acción", description: "Sostener con mansedumbre una espera, una persona o una dificultad.", terms: ["paciencia", "patience", "soportó", "endured", "mansedumbre", "meekness", "longanimidad", "forbearance"] },
  { id: "perseverancia", label: "Perseverancia", group: "Virtudes en acción", description: "Continuar fielmente a pesar del tiempo, el cansancio o los obstáculos.", terms: ["perseverancia", "perseverance", "perseveró", "persevered", "constancia", "steadfastness", "fidelidad", "fidelity", "permaneció fiel", "remained faithful"] },
  { id: "fortaleza", label: "Fortaleza", group: "Virtudes en acción", description: "Coraje cristiano ante una amenaza, una decisión o una prueba.", terms: ["fortaleza", "fortitude", "valor", "courage", "valentía", "bravery", "valiente", "brave", "heroico", "heroic", "firmeza", "firmness"] },
  { id: "abandono-providencia", label: "Abandono y providencia", group: "Virtudes en acción", description: "Entregarse a la providencia de Dios y dejar en sus manos el resultado.", terms: ["providencia", "providence", "providencia divina", "divine providence", "abandono en dios", "surrender to god", "en manos de dios", "in god's hands", "se abandonó", "resigned himself", "resigned herself"] },
  { id: "perdon-enemigos", label: "Perdón a los enemigos", group: "Virtudes en acción", description: "Perdonar ofensas concretas y responder al mal con el bien.", terms: ["perdonó", "forgave", "perdonar", "to forgive", "perdón", "forgiveness", "pardon", "pardoned", "perdonar a sus enemigos", "forgive his enemies", "forgive her enemies", "sin rencor", "without resentment", "misericordia con sus enemigos", "mercy toward his enemies"], context: ["enemigo", "enemy", "enemies", "ofensa", "offence", "offense", "insulto", "insult", "calumnia", "slander", "perseguidor", "persecutor", "injury", "wrong"] },
  { id: "caridad-servicio", label: "Caridad y servicio", group: "Virtudes en acción", description: "Amor efectivo a pobres, enfermos y personas concretas.", terms: ["caridad", "charity", "servicio", "service", "sirvió", "served", "pobres", "the poor", "enfermos", "the sick", "obras de misericordia", "works of mercy"] },
  { id: "vocacion-llamada", label: "Vocación y llamada", group: "Decidir y entregarse", description: "Descubrir una llamada de Dios y responder a ella.", terms: ["vocación", "vocation", "llamada de dios", "call of god", "dios le llamaba", "god called him", "god called her", "sintió la llamada", "felt called", "respondió a la llamada", "responded to the call"] },
  { id: "discernimiento-decision", label: "Discernimiento y decisión", group: "Decidir y entregarse", description: "Reconocer por dónde conduce Dios y tomar una decisión libre.", terms: ["discernimiento", "discernment", "discernir", "discern", "decisión", "decision", "decidió", "decided", "elección", "choice", "voluntad de dios", "will of god"] },
  { id: "mision-apostolado", label: "Misión y apostolado", group: "Decidir y entregarse", description: "Salir al encuentro, anunciar el Evangelio y acompañar a otros.", terms: ["misión", "mission", "misionero", "missionary", "apostolado", "apostolate", "evangelización", "evangelization", "predicó", "preached", "evangelio", "gospel"] },
  { id: "muerte-vida-eterna", label: "Muerte y vida eterna", group: "Esperanza final", description: "Afrontar la muerte con fe y deseo de la vida eterna.", terms: ["vida eterna", "eternal life", "muerte", "death", "murió", "died", "cielo", "heaven", "última hora", "last hour", "entregó su alma", "gave up his soul", "gave up her soul"] }
];

const normalize = value => String(value || "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/[\u2018\u2019]/g, "'");

const walk = async directory => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? walk(join(directory, entry.name))
    : [join(directory, entry.name)]));
  return nested.flat();
};

function frontMatter(markdown) {
  const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?/);
  const fields = {};
  if (!match) return { fields, bodyStart: 0 };
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([\w-]+):\s*(.*)$/);
    if (field) fields[field[1]] = field[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return { fields, bodyStart: match[0].length };
}

function termRegex(term) {
  const pattern = normalize(term)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${pattern}(?=$|[^a-z0-9])`, "giu");
}

function matchTerms(normalized, patterns) {
  const matches = [];
  let score = 0;
  for (const { term, regex } of patterns) {
    regex.lastIndex = 0;
    const found = [...normalized.matchAll(regex)];
    if (!found.length) continue;
    matches.push(term);
    const specificity = term.includes(" ") ? 8 : Math.min(6, Math.max(2, normalize(term).length / 4));
    score += specificity + Math.min(3, found.length - 1);
  }
  return { matches, score };
}

function narrativeBlocks(markdown, bodyStart) {
  const body = markdown.slice(bodyStart);
  const blocks = [];
  const separator = /(?:\r?\n){2,}/g;
  let localStart = 0;
  let separatorMatch;
  const add = localEnd => {
    const raw = body.slice(localStart, localEnd);
    const leading = raw.match(/^\s*/)?.[0].length || 0;
    const trailing = raw.match(/\s*$/)?.[0].length || 0;
    const text = raw.slice(leading, Math.max(leading, raw.length - trailing));
    const start = bodyStart + localStart + leading;
    localStart = localEnd;
    if (text.length < 180 || text.length > 5000) return;
    if (/^(#{1,6}|\*\*Fuente|\*\*T.tulo|\*\*Autor|\|)/i.test(text.trim())) return;
    if (/Project Gutenberg|START OF (?:THIS|THE) PROJECT|END OF (?:THIS|THE) PROJECT|Google Book Search|Digitized by|PUBLISHED IN|all rights reserved|copyright/i.test(text)) return;
    if ((text.match(/[\p{L}]{2,}/gu) || []).length < 35) return;
    if ((text.match(/https?:\/\//g) || []).length > 1) return;
    blocks.push({ start, end: start + text.length, text, normalized: normalize(text) });
  };
  while ((separatorMatch = separator.exec(body))) {
    add(separatorMatch.index);
    localStart = separatorMatch.index + separatorMatch[0].length;
  }
  add(body.length);
  return blocks;
}

function compactExactExcerpt(block, matchedTerms, maxLength = 2100) {
  if (block.text.length <= maxLength) return { text: block.text, start: block.start };
  const normalized = normalize(block.text);
  let hit = -1;
  for (const term of matchedTerms) {
    const index = normalized.indexOf(normalize(term));
    if (index >= 0 && (hit < 0 || index < hit)) hit = index;
  }
  if (hit < 0) hit = Math.floor(block.text.length / 2);
  let start = Math.max(0, hit - Math.floor(maxLength * .38));
  let end = Math.min(block.text.length, start + maxLength);
  const beforeSentence = Math.max(block.text.lastIndexOf(". ", start), block.text.lastIndexOf("! ", start), block.text.lastIndexOf("? ", start));
  if (beforeSentence >= Math.max(0, start - 180)) start = beforeSentence + 2;
  else if (start > 0) {
    const nextBoundary = block.text.slice(start, Math.min(block.text.length, start + 100)).search(/\s/);
    if (nextBoundary >= 0) start += nextBoundary + 1;
  }
  const afterCandidates = [block.text.indexOf(". ", end - 120), block.text.indexOf("! ", end - 120), block.text.indexOf("? ", end - 120)].filter(index => index >= 0);
  if (afterCandidates.length) end = Math.min(...afterCandidates) + 1;
  else if (end < block.text.length) {
    const previousBoundary = block.text.lastIndexOf(" ", end);
    if (previousBoundary > start + 300) end = previousBoundary;
  }
  const exact = block.text.slice(start, end).trim();
  const trimOffset = block.text.slice(start, end).indexOf(exact);
  return { text: exact, start: block.start + start + Math.max(0, trimOffset) };
}

function expandExactContext(markdown, bodyStart, excerpt, targetLength = 2100) {
  if (excerpt.text.length >= targetLength * .78) return excerpt;
  const missing = targetLength - excerpt.text.length;
  let start = Math.max(bodyStart, excerpt.start - Math.floor(missing * .46));
  let end = Math.min(markdown.length, excerpt.start + excerpt.text.length + Math.ceil(missing * .54));
  const previousParagraph = markdown.lastIndexOf("\n\n", excerpt.start);
  if (previousParagraph >= start) start = previousParagraph + 2;
  const nextParagraph = markdown.indexOf("\n\n", excerpt.start + excerpt.text.length);
  if (nextParagraph > 0 && nextParagraph <= end) end = nextParagraph;
  const raw = markdown.slice(start, end);
  const clean = raw.trim();
  const offset = raw.indexOf(clean);
  return clean.length >= excerpt.text.length
    ? { text: clean, start: start + Math.max(0, offset) }
    : excerpt;
}

function summaryPoints(excerpt, saint, mood) {
  const clean = excerpt.replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(item => item.trim()).filter(item => item.length > 35) || [];
  const shorten = text => text.length > 190 ? `${text.slice(0, 187).replace(/\s+\S*$/, "")}…` : text;
  const thematic = sentences.find(sentence => mood.terms.some(term => normalize(sentence).includes(normalize(term)))) || sentences[0];
  const response = sentences.find((sentence, index) => index > 0 && /(?:dios|senor|fe|oraci|confi|acept|permanec|decid|respond|sirvi|perdon|esper)/i.test(normalize(sentence))) || sentences[Math.min(1, sentences.length - 1)];
  const outcome = sentences.length > 2 ? sentences[sentences.length - 1] : sentences[Math.max(0, sentences.length - 1)];
  return [
    { label: "La situación", text: shorten(thematic || `${saint} atravesó una experiencia de ${mood.label.toLocaleLowerCase("es")}.`) },
    { label: "Su respuesta", text: shorten(response || "La biografía muestra su respuesta concreta dentro de la prueba.") },
    { label: "La clave", text: shorten(outcome || "El contexto completo permite comprender cómo maduró esta experiencia.") }
  ];
}

function readerChunks(markdown, max = 42000) {
  const chunks = [];
  let cursor = 0;
  while (cursor < markdown.length) {
    let end = Math.min(markdown.length, cursor + max);
    if (end < markdown.length) {
      const lineBreak = markdown.lastIndexOf("\n", end);
      if (lineBreak > cursor + max * .55) end = lineBreak + 1;
    }
    chunks.push({ start: cursor, end });
    cursor = end;
  }
  return chunks.length ? chunks : [{ start: 0, end: 0 }];
}

function chunkLocation(chunks, charStart) {
  const index = Math.max(0, chunks.findIndex(chunk => charStart >= chunk.start && charStart < chunk.end));
  return { chunkIndex: index, chunkOffset: charStart - chunks[index].start };
}

function isExcluded(relativePath) {
  const name = basename(relativePath);
  return /^000\d_/.test(name)
    || relativePath.startsWith("Pedro Ballester - Audiolibro/")
    || /(?:INDICE|CONTROL|FUENTES_Y|PENDIENTES|INFORME|AMPLIACION_BIOGRAFIAS)/i.test(name);
}

function saintIdentity(title, relativePath) {
  const fromFile = basename(relativePath, ".md").replace(/^\d{4}_/, "").replaceAll("_", " ");
  return normalize(title || fromFile).replace(/\b(?:san|santa|santo|saint|st)\.?\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function stableCandidateSort(a, b) {
  return Number(b.isSpanish) - Number(a.isSpanish)
    || b.score - a.score
    || Number(a.isDuplicateSource) - Number(b.isDuplicateSource)
    || a.saint.localeCompare(b.saint, "es")
    || a.charStart - b.charStart;
}

function detectsSpanish(fields, markdown, bodyStart) {
  const declared = normalize(fields.language || "").replace(/[^a-z]/g, "");
  if (["es", "spa", "spanish", "espanol"].includes(declared)) return true;
  if (["en", "eng", "english", "de", "german", "fr", "fre", "french", "it", "ita", "italian", "pt", "por", "portuguese"].includes(declared)) return false;
  const sample = normalize(markdown.slice(bodyStart, bodyStart + 18000));
  const count = terms => terms.reduce((sum, term) => sum + ([...sample.matchAll(termRegex(term))].length), 0);
  const spanish = count(["que", "para", "con", "una", "los", "las", "del", "por", "como"]);
  const english = count(["the", "and", "of", "to", "in", "that", "with", "for", "was"]);
  return spanish > english * 1.15;
}

const catalog = JSON.parse(await readFile(catalogFile, "utf8"));
const library = catalog.libraries.find(item => item.id === LIBRARY_ID);
if (!library) throw new Error(`No existe la biblioteca ${LIBRARY_ID} en data/catalog.json.`);
const catalogByFile = new Map(library.documents.map(document => [String(document.file).replaceAll("\\", "/"), document]));

const files = (await walk(sourceRoot))
  .filter(file => extname(file).toLowerCase() === ".md")
  .map(file => ({ file, relative: relative(sourceRoot, file).replaceAll("\\", "/") }))
  .filter(item => !isExcluded(item.relative))
  .sort((a, b) => a.relative.localeCompare(b.relative, "es"));

const documents = [];
for (const item of files) {
  const catalogDocument = catalogByFile.get(item.relative);
  if (!catalogDocument) continue;
  const markdown = await readFile(item.file, "utf8");
  const { fields, bodyStart } = frontMatter(markdown);
  const title = fields.saint || catalogDocument.title || basename(item.relative, ".md");
  documents.push({
    ...item,
    markdown,
    fields,
    bodyStart,
    title,
    identity: saintIdentity(title, item.relative),
    catalogDocument,
    blocks: narrativeBlocks(markdown, bodyStart),
    chunks: readerChunks(markdown),
    isSpanish: detectsSpanish(fields, markdown, bodyStart),
    isDuplicateSource: item.relative.startsWith("Semblanzas Mercaba/")
  });
}

for (const mood of moods) {
  mood.patterns = mood.terms.map(term => ({ term, regex: termRegex(term) }));
  mood.contextPatterns = (mood.context || []).map(term => ({ term, regex: termRegex(term) }));
  mood.excludePatterns = (mood.exclude || []).map(term => ({ term, regex: termRegex(term) }));
}

const outputMoods = [];
const insufficientMoods = [];
for (const mood of moods) {
  const candidates = [];
  for (const document of documents) {
    let bestForSaint = null;
    for (const block of document.blocks) {
      const matched = matchTerms(block.normalized, mood.patterns);
      if (!matched.matches.length) continue;
      let excerpt = compactExactExcerpt(block, matched.matches);
      excerpt = expandExactContext(document.markdown, document.bodyStart, excerpt);
      if (/Project Gutenberg|Google Book Search|Digitized by|PUBLISHED IN|all rights reserved|copyright/i.test(excerpt.text)) continue;
      const context = mood.contextPatterns.length ? matchTerms(normalize(excerpt.text), mood.contextPatterns) : { matches: [], score: 0 };
      if (mood.contextPatterns.length && !context.matches.length) continue;
      if (mood.excludePatterns.length && matchTerms(normalize(excerpt.text), mood.excludePatterns).matches.length) continue;
      const quality = Math.min(5, (excerpt.text.match(/[.!?](?:\s|$)/g) || []).length);
      const score = matched.score + context.score * .35 + quality + (document.isSpanish ? 2.5 : 0) - (document.isDuplicateSource ? 0.75 : 0);
      const location = chunkLocation(document.chunks, excerpt.start);
      const candidate = {
        score,
        isSpanish: document.isSpanish,
        isDuplicateSource: document.isDuplicateSource,
        saint: document.title,
        saintIdentity: document.identity,
        documentId: document.catalogDocument.id,
        contentFile: document.catalogDocument.contentFile,
        title: document.catalogDocument.title,
        documentTitle: document.catalogDocument.title,
        sourcePath: document.relative,
        sourceFile: document.relative,
        sourceUrl: document.fields.source_url || null,
        language: document.fields.language || null,
        excerpt: excerpt.text,
        charStart: excerpt.start,
        charEnd: excerpt.start + excerpt.text.length,
        chunkIndex: location.chunkIndex,
        chunkOffset: location.chunkOffset,
        query: excerpt.text.replace(/\s+/g, " ").trim().slice(0, 180),
        searchQuery: excerpt.text.replace(/\s+/g, " ").trim().slice(0, 180),
        matchedTerms: matched.matches,
        matchedContextTerms: context.matches
      };
      if (!bestForSaint || stableCandidateSort(candidate, bestForSaint) < 0) bestForSaint = candidate;
    }
    if (bestForSaint) candidates.push(bestForSaint);
  }

  candidates.sort(stableCandidateSort);
  const selected = [];
  const identities = new Set();
  for (const candidate of candidates) {
    if (identities.has(candidate.saintIdentity)) continue;
    selected.push(candidate);
    identities.add(candidate.saintIdentity);
    if (selected.length === PASSAGES_PER_MOOD) break;
  }
  if (selected.length < PASSAGES_PER_MOOD) insufficientMoods.push(`${mood.label}: ${selected.length}`);
  outputMoods.push({
    id: mood.id,
    label: mood.label,
    group: mood.group,
    description: mood.description,
    count: selected.length,
    passages: selected.map(({ score, isSpanish, isDuplicateSource, saintIdentity: _identity, ...passage }, index) => ({
      id: `${mood.id}-${String(index + 1).padStart(2, "0")}`,
      ...passage,
      summaryPoints: summaryPoints(passage.excerpt, passage.saint, mood),
      selection: { score: Number(score.toFixed(2)), spanishPreferred: isSpanish, secondaryCopy: isDuplicateSource }
    }))
  });
}

const allPassages = outputMoods.flatMap(mood => mood.passages.map(passage => ({ moodId: mood.id, ...passage })));
if (insufficientMoods.length) throw new Error(`Etiquetas con menos de ${PASSAGES_PER_MOOD} santos: ${insufficientMoods.join("; ")}`);
const validation = {
  expectedMoods: 50,
  actualMoods: outputMoods.length,
  expectedPassages: 500,
  actualPassages: allPassages.length,
  passagesPerMood: PASSAGES_PER_MOOD,
  allDocumentIdsResolve: allPassages.every(passage => library.documents.some(document => document.id === passage.documentId)),
  allExcerptsAreExact: allPassages.every(passage => {
    const document = documents.find(item => item.catalogDocument.id === passage.documentId);
    return document?.markdown.slice(passage.charStart, passage.charEnd) === passage.excerpt;
  }),
  allMoodsHaveTenDistinctSaints: outputMoods.every(mood => new Set(mood.passages.map(passage => normalize(passage.saint))).size === PASSAGES_PER_MOOD),
  allLocationsAreValid: allPassages.every(passage => passage.charStart >= 0 && passage.charEnd > passage.charStart && passage.chunkIndex >= 0 && passage.chunkOffset >= 0),
  distinctSaints: new Set(allPassages.map(passage => normalize(passage.saint))).size,
  distinctDocuments: new Set(allPassages.map(passage => passage.documentId)).size,
  spanishPassages: allPassages.filter(passage => passage.selection.spanishPreferred).length
};
if (validation.actualMoods !== validation.expectedMoods
  || validation.actualPassages !== validation.expectedPassages
  || !validation.allDocumentIdsResolve
  || !validation.allExcerptsAreExact
  || !validation.allMoodsHaveTenDistinctSaints
  || !validation.allLocationsAreValid) {
  throw new Error(`Validación fallida: ${JSON.stringify(validation)}`);
}

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  libraryId: LIBRARY_ID,
  title: "Cómo lo vivieron los santos",
  description: "Cincuenta situaciones y disposiciones del alma, con diez pasajes biográficos literales y verificables en cada una.",
  methodology: {
    source: "Markdown de la carpeta Vida de los Santos",
    selection: "Coincidencia léxica reproducible; se priorizan fuentes castellanas y los pasajes restantes reciben una traducción editorial separada del original.",
    quotationPolicy: "excerpt siempre es una subcadena exacta del Markdown; no contiene paráfrasis ni texto inventado.",
    exclusions: ["documentos 000x de control, índice o informes", "capítulos de transcripción del audiolibro", "bloques de metadatos y avisos de Project Gutenberg"],
    caveat: "La coincidencia temática es editorial-asistida por léxico. matchedTerms y location permiten revisar cada selección en su contexto antes de publicarla."
  },
  groups: [...new Set(moods.map(mood => mood.group))].map(name => ({ name, moodIds: moods.filter(mood => mood.group === name).map(mood => mood.id) })),
  moods: outputMoods,
  validation
};

await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Modo santos generado: ${validation.actualMoods} etiquetas, ${validation.actualPassages} pasajes, ${validation.distinctSaints} santos.`);
console.log(`Pasajes en español priorizados: ${validation.spanishPassages}; referencias resolubles y citas exactas: sí.`);
