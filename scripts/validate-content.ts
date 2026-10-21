// Walidacja schematu i spójności treści: curriculum.json, data/exercises/<level>/<topicId>.json
// data/readings/<level>/<setId>.json (Reading: jeden tekst = jeden zestaw)
// i data/writing/<level>/<topicId>.json (Writing: zadanie otwarte) oraz data/external-links.json.
// Uruchom: npm run validate
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bareWord, tokenize } from "../src/lib/check.ts";
import { EXERCISE_TYPES, LEVELS, SECTIONS } from "../src/types.ts";

export interface ExerciseFile {
  level: string;     // nazwa katalogu
  topicId: string;   // nazwa pliku bez .json
  data: unknown;     // ExerciseSet[]
}

export interface ReadingFile {
  level: string;     // nazwa katalogu
  setId: string;     // nazwa pliku bez .json
  data: unknown;     // ReadingSet
}

export interface WritingFile {
  level: string;     // nazwa katalogu
  topicId: string;   // nazwa pliku bez .json
  data: unknown;     // WritingTask
}

export interface Report {
  errors: string[];
  topics: number;
  sets: number;
  missingSets: string[];          // zestawy zadeklarowane w curriculum, bez treści
  missingExplanations: string[];  // tematy z pustym explanation
  missingWriting: string[];       // tematy Writing bez zadania otwartego
}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_EXPLANATION_WORDS = 300; // brief: „max ~250 słów”
// Długość tekstu Reading: A1 ~100 słów → C1 ~600, z tolerancją ±40%.
const READING_WORDS: Record<string, number> = { A1: 100, A2: 200, B1: 300, B2: 450, C1: 600 };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every(isText);
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function validateContent(
  curriculum: unknown, files: ExerciseFile[], readings: ReadingFile[] = [], writings: WritingFile[] = [],
): Report {
  const errors: string[] = [];
  const missingExplanations: string[] = [];
  const topics = new Map<string, Obj>();
  const setOwner = new Map<string, string>();  // setId → topicId
  const orders = new Map<string, number[]>();  // "section level" → order[]

  if (!Array.isArray(curriculum)) {
    return { errors: ["curriculum.json: oczekiwano tablicy tematów"], topics: 0, sets: 0, missingSets: [], missingExplanations, missingWriting: [] };
  }

  curriculum.forEach((t, i) => {
    const at = `curriculum[${i}]`;
    if (!isObj(t)) return void errors.push(`${at}: temat nie jest obiektem`);
    const id = t.id;
    if (typeof id !== "string" || !ID.test(id)) return void errors.push(`${at}: nieprawidłowe id ${JSON.stringify(id)}`);
    const where = `temat ${id}`;
    if (topics.has(id)) errors.push(`${where}: duplikat id`);
    topics.set(id, t);

    if (!SECTIONS.includes(t.section as never)) errors.push(`${where}: nieznany dział ${JSON.stringify(t.section)}`);
    if (!LEVELS.includes(t.level as never)) errors.push(`${where}: nieznany poziom ${JSON.stringify(t.level)}`);
    else if (!id.startsWith(`${(t.level as string).toLowerCase()}-`)) errors.push(`${where}: id nie zaczyna się od poziomu`);
    if (!Number.isInteger(t.order) || (t.order as number) < 1) errors.push(`${where}: order musi być liczbą całkowitą ≥ 1`);
    else {
      const key = `${t.section} ${t.level}`;
      orders.set(key, [...(orders.get(key) ?? []), t.order as number]);
    }
    if (!isText(t.title)) errors.push(`${where}: brak title`);
    if (typeof t.explanation !== "string") errors.push(`${where}: explanation musi być tekstem`);
    else if (t.explanation.trim() === "") missingExplanations.push(id);
    else if (words(t.explanation) > MAX_EXPLANATION_WORDS) errors.push(`${where}: explanation ma ${words(t.explanation)} słów (max ~250)`);

    if (!Array.isArray(t.sets) || t.sets.length < 3) errors.push(`${where}: wymagane min. 3 zestawy`);
    for (const s of Array.isArray(t.sets) ? t.sets : []) {
      if (typeof s !== "string" || !ID.test(s)) errors.push(`${where}: nieprawidłowe id zestawu ${JSON.stringify(s)}`);
      else if (setOwner.has(s)) errors.push(`${where}: duplikat id zestawu ${s}`);
      else setOwner.set(s, id);
    }
  });

  for (const [key, list] of orders) {
    const sorted = [...list].sort((a, b) => a - b);
    if (sorted.some((o, i) => o !== i + 1)) errors.push(`${key}: order musi być kolejno 1…${list.length}, jest ${sorted.join(", ")}`);
  }

  const filled = new Set<string>();
  const exerciseIds = new Set<string>();
  for (const f of files) {
    const at = `exercises/${f.level}/${f.topicId}.json`;
    const topic = topics.get(f.topicId);
    if (!topic) { errors.push(`${at}: brak tematu ${f.topicId} w curriculum`); continue; }
    if (topic.level !== f.level) errors.push(`${at}: temat jest na poziomie ${topic.level}`);
    if (topic.section === "reading") errors.push(`${at}: teksty Reading należą do data/readings/<poziom>/<setId>.json`);
    if (!Array.isArray(f.data)) { errors.push(`${at}: oczekiwano tablicy zestawów`); continue; }
    for (const set of f.data) checkSet(set, f.topicId, topic.level as string, at);
  }

  for (const r of readings) {
    const at = `readings/${r.level}/${r.setId}.json`;
    const topicId = setOwner.get(r.setId);
    const topic = topicId ? topics.get(topicId) : undefined;
    if (!topicId || !topic) { errors.push(`${at}: brak zestawu ${r.setId} w curriculum`); continue; }
    if (topic.section !== "reading") errors.push(`${at}: zestaw należy do tematu spoza Reading`);
    if (topic.level !== r.level) errors.push(`${at}: temat jest na poziomie ${topic.level}`);
    if (!isObj(r.data)) { errors.push(`${at}: oczekiwano obiektu z tekstem i zadaniami`); continue; }
    if (r.data.id !== r.setId) errors.push(`${at}: id różny od nazwy pliku`);
    if (!isText(r.data.title)) errors.push(`${at}: brak title`);
    if (!isText(r.data.text)) errors.push(`${at}: brak text`);
    else {
      const target = READING_WORDS[topic.level as string];
      const n = words(r.data.text);
      if (n < target * 0.6 || n > target * 1.4) errors.push(`${at}: tekst ma ${n} słów (na ${topic.level} ok. ${target})`);
    }
    checkSet(r.data, topicId, topic.level as string, at);
  }

  const withTask = new Set<string>();
  for (const w of writings) {
    const at = `writing/${w.level}/${w.topicId}.json`;
    const topic = topics.get(w.topicId);
    if (!topic) { errors.push(`${at}: brak tematu ${w.topicId} w curriculum`); continue; }
    if (topic.section !== "writing") errors.push(`${at}: temat spoza Writing`);
    if (topic.level !== w.level) errors.push(`${at}: temat jest na poziomie ${topic.level}`);
    if (!isObj(w.data)) { errors.push(`${at}: oczekiwano obiektu zadania`); continue; }
    const d = w.data;
    withTask.add(w.topicId);
    if (d.topicId !== w.topicId) errors.push(`${at}: topicId różny od nazwy pliku`);
    if (!isText(d.task)) errors.push(`${at}: brak task`);
    if (!isTextList(d.checklist) || d.checklist.length < 3) errors.push(`${at}: checklist wymaga min. 3 punktów`);
    const range = d.words;
    const okRange = Array.isArray(range) && range.length === 2 && range.every(Number.isInteger) && range[0] < range[1];
    if (!okRange) errors.push(`${at}: words musi być [min, max]`);
    if (!isText(d.model)) errors.push(`${at}: brak model`);
    else if (okRange) {
      const n = words(d.model);
      if (n < range[0] || n > range[1]) errors.push(`${at}: tekst wzorcowy ma ${n} słów, a zadanie wymaga ${range[0]}–${range[1]}`);
    }
  }
  const missingWriting = [...topics.values()]
    .filter(t => t.section === "writing" && !withTask.has(t.id as string)).map(t => t.id as string);

  const missingSets = [...setOwner.keys()].filter(s => !filled.has(s));
  return { errors, topics: topics.size, sets: setOwner.size, missingSets, missingExplanations, missingWriting };

  function checkSet(set: unknown, topicId: string, level: string, at: string) {
    if (!isObj(set) || typeof set.id !== "string") { errors.push(`${at}: zestaw bez id`); return; }
    const where = `${at} › ${set.id}`;
    if (setOwner.get(set.id) !== topicId) errors.push(`${where}: zestaw nie należy do tematu ${topicId} w curriculum`);
    if (filled.has(set.id)) errors.push(`${where}: duplikat zestawu`);
    filled.add(set.id);
    if (set.topicId !== topicId) errors.push(`${where}: topicId różny od tematu ${topicId}`);
    if (!Array.isArray(set.exercises)) { errors.push(`${where}: brak exercises`); return; }
    if (set.exercises.length < 8 || set.exercises.length > 12) errors.push(`${where}: ${set.exercises.length} zadań (wymagane 8–12)`);
    const types = new Set(set.exercises.map(e => (isObj(e) ? e.type : undefined)));
    if (types.size < 3) errors.push(`${where}: ${types.size} typy zadań (wymagane min. 3)`);
    set.exercises.forEach((e, i) => errors.push(...checkExercise(e, `${where} › [${i}]`, exerciseIds, set.id as string, level)));
  }
}

function checkExercise(e: unknown, at: string, seen: Set<string>, setId: string, level: string): string[] {
  if (!isObj(e)) return [`${at}: zadanie nie jest obiektem`];
  const errs: string[] = [];
  const where = typeof e.id === "string" ? `${at} ${e.id}` : at;
  if (typeof e.id !== "string" || !ID.test(e.id)) errs.push(`${where}: nieprawidłowe id`);
  else if (!e.id.startsWith(`${setId}-`)) errs.push(`${where}: id zadania musi zaczynać się od ${setId}-`);
  else if (seen.has(e.id)) errs.push(`${where}: duplikat id zadania`);
  else seen.add(e.id);
  if (!EXERCISE_TYPES.includes(e.type as never)) errs.push(`${where}: nieznany typ ${JSON.stringify(e.type)}`);
  if (!isText(e.prompt)) errs.push(`${where}: brak prompt`);
  if (!isText(e.explanation)) errs.push(`${where}: brak explanation`);
  if (!isText(e.answer) && !isTextList(e.answer)) errs.push(`${where}: brak answer`);
  if ((e.type === "match" || e.type === "tiles") && !isTextList(e.answer)) errs.push(`${where}: ${e.type} wymaga answer jako tablicy`);
  if (e.type === "cloze" && isText(e.prompt) && e.prompt.split("___").length !== 2) errs.push(`${where}: cloze wymaga dokładnie jednej luki ___`);
  if (e.type === "tiles") {
    const extra = Array.isArray(e.distractors) ? e.distractors.length : 0;
    const early = level === "A1" || level === "A2";
    if (early ? extra > 0 : extra < 1 || extra > 2) errs.push(`${where}: tiles na ${level} ${early ? "bez zbędnych kafelków" : "wymaga 1–2 zbędnych kafelków"}`);
  }
  if (e.type === "match" && isTextList(e.answer)) {
    const pairs = e.answer;
    if (!pairs.every(p => p.split("|").length === 2)) errs.push(`${where}: match wymaga par w formacie "lewa|prawa"`);
    else {
      const sides = [0, 1].map(i => pairs.map(p => p.split("|")[i].trim()));
      if (sides.some(s => new Set(s).size !== s.length)) errs.push(`${where}: match wymaga różnych elementów po obu stronach`);
    }
  }
  if (e.type === "choice" && isText(e.answer) && isTextList(e.distractors)) {
    const options = [e.answer, ...e.distractors].map(o => o.trim().toLowerCase());
    if (new Set(options).size !== options.length) errs.push(`${where}: choice ma powtórzoną opcję`);
  }
  if (e.type === "error") {
    const ok = isTextList(e.answer) && e.answer.length === 2 && isText(e.prompt)
      && tokenize(e.prompt).map(bareWord).includes(e.answer[0]);
    if (!ok) errs.push(`${where}: error wymaga answer [błędne słowo z prompt, poprawka]`);
  }
  if (e.type === "choice" && !(isTextList(e.distractors) && e.distractors.length >= 2 && e.distractors.length <= 3)) {
    errs.push(`${where}: choice wymaga 2–3 distractors (razem 3–4 opcje)`);
  }
  if (e.accept !== undefined && !isTextList(e.accept)) errs.push(`${where}: accept musi być tablicą tekstów`);
  if (e.distractors !== undefined && !isTextList(e.distractors)) errs.push(`${where}: distractors musi być tablicą tekstów`);
  if (e.hint !== undefined && !isText(e.hint)) errs.push(`${where}: pusty hint`);
  if (e.meaning !== undefined && !isText(e.meaning)) errs.push(`${where}: pusty meaning`);
  // Luka bez wskazówki w nawiasie potrzebuje polskiego znaczenia zdania (w Reading wskazówką jest tekst).
  if (e.type === "cloze" && at.startsWith("exercises/") && isText(e.prompt) && !e.prompt.includes("(") && !isText(e.meaning)) {
    errs.push(`${where}: cloze bez wskazówki w nawiasie wymaga meaning (znaczenie zdania po polsku)`);
  }
  return errs;
}

const LINK_SOURCES = ["PEG", "BC", "ang.pl"];
const LINK_KEYS = ["source", "title", "url"];

/** external-links.json: { topicId: [{ title, url, source }] } – tylko te trzy pola, znane tematy, adresy https. */
export function validateLinks(data: unknown, topicIds: Set<string>): string[] {
  if (!isObj(data)) return ["external-links.json: oczekiwano obiektu { topicId: [...] }"];
  const errors: string[] = [];
  for (const [topicId, list] of Object.entries(data)) {
    const at = `external-links.json › ${topicId}`;
    if (!topicIds.has(topicId)) errors.push(`${at}: nieznany temat`);
    if (!Array.isArray(list) || list.length === 0) { errors.push(`${at}: oczekiwano niepustej listy`); continue; }
    const urls = new Set<string>();
    list.forEach((l, i) => {
      if (!isObj(l)) { errors.push(`${at} › [${i}]: oczekiwano obiektu`); return; }
      if (Object.keys(l).sort().join() !== LINK_KEYS.join()) errors.push(`${at} › [${i}]: dozwolone pola to tylko title, url, source`);
      if (!isText(l.title)) errors.push(`${at} › [${i}]: brak title`);
      if (typeof l.url !== "string" || !/^https:\/\/[^\s]+$/.test(l.url)) errors.push(`${at} › [${i}]: url musi być adresem https`);
      else if (urls.has(l.url)) errors.push(`${at} › [${i}]: powtórzony url`);
      else urls.add(l.url);
      if (!LINK_SOURCES.includes(l.source as string)) errors.push(`${at} › [${i}]: source musi być jednym z ${LINK_SOURCES.join(", ")}`);
    });
  }
  return errors;
}

export function loadContent(dataDir: string):
  { curriculum: unknown; files: ExerciseFile[]; readings: ReadingFile[]; writings: WritingFile[] } {
  const readJson = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));
  const jsonFiles = (dir: string) => (existsSync(dir) ? readdirSync(dir) : []).flatMap(level =>
    readdirSync(join(dir, level)).filter(n => n.endsWith(".json"))
      .map(n => ({ level, name: n.slice(0, -5), data: readJson(join(dir, level, n)) })));
  return {
    curriculum: readJson(join(dataDir, "curriculum.json")),
    files: jsonFiles(join(dataDir, "exercises")).map(f => ({ level: f.level, topicId: f.name, data: f.data })),
    readings: jsonFiles(join(dataDir, "readings")).map(f => ({ level: f.level, setId: f.name, data: f.data })),
    writings: jsonFiles(join(dataDir, "writing")).map(f => ({ level: f.level, topicId: f.name, data: f.data })),
  };
}

if (import.meta.main) {
  const { curriculum, files, readings, writings } = loadContent(join(import.meta.dirname, "../src/data"));
  const r = validateContent(curriculum, files, readings, writings);
  const linksPath = join(import.meta.dirname, "../src/data/external-links.json");
  if (existsSync(linksPath) && Array.isArray(curriculum)) {
    const ids = new Set(curriculum.map(t => (t as Obj).id as string));
    r.errors.push(...validateLinks(JSON.parse(readFileSync(linksPath, "utf8")), ids));
  }
  for (const e of r.errors) console.error(`BŁĄD  ${e}`);
  console.log(`Tematy: ${r.topics}, zestawy: ${r.sets}`);
  console.log("Brak treści (zestawy / wyjaśnienia / zadania otwarte Writing):");
  for (const level of LEVELS) {
    const prefix = `${level.toLowerCase()}-`;
    const sets = r.missingSets.filter(s => s.startsWith(prefix)).length;
    const expl = r.missingExplanations.filter(t => t.startsWith(prefix)).length;
    const open = r.missingWriting.filter(t => t.startsWith(prefix)).length;
    console.log(`  ${level}: ${sets} / ${expl} / ${open}${sets + expl + open === 0 ? "  komplet" : ""}`);
  }
  console.log(r.errors.length ? `Błędy: ${r.errors.length}` : "OK, brak błędów");
  process.exitCode = r.errors.length ? 1 : 0;
}
