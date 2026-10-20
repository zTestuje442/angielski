// Linki „Dodatkowo”: zbiera tytuły i URL-e ze spisów treści trzech serwisów,
// przypisuje je do tematów według scripts/links/rules.json i zapisuje src/data/external-links.json.
// Linki bez tematu trafiają do docs/faza-5/niedopasowane.md – do ręcznej decyzji.
//
// Uruchom:
//   node scripts/collect-links.ts            – pobierz spisy treści i przypisz linki
//   node scripts/collect-links.ts --offline  – przypisz ponownie z zapisanego scripts/links/collected.json
//   node scripts/collect-links.ts --check    – sprawdź, czy każdy link z external-links.json zwraca 200
//
// Pobieramy wyłącznie strony spisów treści (kilkanaście zapytań), z poszanowaniem robots.txt
// (Disallow i Crawl-delay – ang.pl wymaga 60 s przerwy między zapytaniami).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const SOURCES = ["PEG", "BC", "ang.pl"] as const;
export type Source = (typeof SOURCES)[number];

export interface Link {
  title: string;
  url: string;
  source: Source;
}

/** topicId → URL-e w kolejności wyświetlania. */
export type Rules = Record<string, string[]>;

interface IndexPage {
  source: Source;
  url: string;
  keep: RegExp;   // które linki ze strony są lekcjami
  nested?: boolean;  // spis drzewiasty: tytuł podstrony poprzedza tytuł rodzica („Present Perfect: for i since”)
}

const BC = "https://learnenglish.britishcouncil.org/free-resources";
const BC_LESSON = /^https:\/\/learnenglish\.britishcouncil\.org\/free-resources\/(grammar\/(a1-a2|b1-b2|b1-b2-grammar|c1|english-grammar-reference)|vocabulary\/(a1-a2|b1-b2)|reading\/(a1|a2|b1|b2|c1)|writing\/(a1|a2|b1|b2|c1))\/[a-z0-9-]+$/;
const PEG_NAV = /\/(english-level-test|grammar-explanations|grammar-exercises|membership|schools|books|index|about|contact|privacy-policy|terms|faq|login|sitemap|the-method)\.html$/;

export const INDEX_PAGES: IndexPage[] = [
  { source: "PEG", url: "https://www.perfect-english-grammar.com/grammar-explanations.html",
    keep: /^https:\/\/www\.perfect-english-grammar\.com\/[a-z0-9-]+\.html$/ },
  ...["grammar/a1-a2", "grammar/b1-b2", "grammar/c1", "vocabulary/a1-a2", "vocabulary/b1-b2",
      "reading/a1", "reading/a2", "reading/b1", "reading/b2", "reading/c1",
      "writing/a1", "writing/a2", "writing/b1", "writing/b2", "writing/c1",
      ...["adjectives", "adverbials", "determiners-quantifiers", "nouns", "possessives", "pronouns", "verbs"]
        .map(c => `grammar/english-grammar-reference/${c}`)]
    .map(path => ({ source: "BC" as const, url: `${BC}/${path}`, keep: BC_LESSON })),
  { source: "ang.pl", url: "https://www.ang.pl/gramatyka/spis-tresci", nested: true,
    keep: /^https:\/\/www\.ang\.pl\/gramatyka\/[a-z0-9-]+\/[a-z0-9-/]+$/ },
  { source: "ang.pl", url: "https://www.ang.pl/slownictwo",
    keep: /^https:\/\/www\.ang\.pl\/slownictwo\/[a-z0-9-]+(\/[a-z0-9-]+)*$/ },
];

const USER_AGENT = "SzlakLinks/1.0 (personal English trainer; collects lesson titles and URLs)";

const ENTITIES: Record<string, string> = { amp: "&", quot: "\"", apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘" };
const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);

/** Linki <a href> ze strony: adres bezwzględny bez #/?, tekst bez znaczników. Pierwszy niepusty tytuł wygrywa. */
export function parseLinks(html: string, base: string): { url: string; title: string }[] {
  const found = new Map<string, string>();
  for (const [, href, inner] of html.matchAll(/<a\b[^>]*?\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: string;
    try { url = new URL(decode(href), base).href; } catch { continue; }
    url = url.replace(/[?#].*$/, "").replace(/\/$/, "");
    // Karta z nagłówkiem i opisem: tytułem jest sam nagłówek.
    const heading = inner.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ?? inner;
    const title = decode(heading.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").replace(/^[‹›«»\s]+|[‹›«»\s]+$/g, "");
    if (title && !found.get(url)) found.set(url, title);
    else if (!found.has(url)) found.set(url, "");
  }
  return [...found].filter(([, t]) => t).map(([url, title]) => ({ url, title }));
}

/** Linki-lekcje ze wszystkich stron spisów treści, bez duplikatów (pierwsze wystąpienie wygrywa). */
export function pickLessons(pages: { page: IndexPage; html: string }[]): Link[] {
  const out = new Map<string, Link>();
  for (const { page, html } of pages) {
    const all = parseLinks(html, page.url);
    // Rodzic: najdłuższy link-przedrostek z co najmniej dwoma segmentami ścieżki (pomijamy „Gramatyka”).
    // Bez rodzica tytuł pisany małą literą („osobowe”) dostaje nazwę działu z adresu („Zaimki: osobowe”).
    const withParent = (url: string, title: string) => {
      const parent = all
        .filter(p => url.startsWith(p.url + "/") && new URL(p.url).pathname.split("/").length > 2)
        .sort((a, b) => b.url.length - a.url.length)[0];
      if (parent) return `${parent.title}: ${title}`;
      if (!/^\p{Ll}/u.test(title)) return title;
      const section = new URL(url).pathname.split("/")[2] ?? "";
      return `${section.charAt(0).toUpperCase()}${section.slice(1).replace(/-/g, " ")}: ${title}`;
    };
    for (const { url, title } of all) {
      if (!page.keep.test(url) || PEG_NAV.test(url) || out.has(url)) continue;
      if (INDEX_PAGES.some(p => p.url === url)) continue;
      out.set(url, { title: page.nested ? withParent(url, title) : title, url, source: page.source });
    }
  }
  return [...out.values()];
}

export interface Mapping {
  links: Record<string, Link[]>;     // topicId → linki (tylko title, url, source)
  unmatched: Link[];                  // zebrane, ale nieprzypisane do żadnego tematu
  stale: { topicId: string; url: string }[];  // w regułach, ale nie ma ich już w spisach treści
  unknownTopics: string[];            // reguły dla tematów spoza curriculum
  topicsWithout: string[];            // tematy bez żadnego linku
}

export function mapLinks(collected: Link[], rules: Rules, topicIds: string[]): Mapping {
  const byUrl = new Map(collected.map(l => [l.url, l]));
  const used = new Set<string>();
  const links: Record<string, Link[]> = {};
  const stale: Mapping["stale"] = [];
  const known = new Set(topicIds);
  const unknownTopics = Object.keys(rules).filter(t => !known.has(t));
  for (const topicId of topicIds) {
    const list: Link[] = [];
    for (const url of rules[topicId] ?? []) {
      const link = byUrl.get(url);
      if (!link) { stale.push({ topicId, url }); continue; }
      used.add(url);
      list.push({ title: link.title, url: link.url, source: link.source });
    }
    if (list.length) links[topicId] = list;
  }
  return {
    links, stale, unknownTopics,
    unmatched: collected.filter(l => !used.has(l.url)),
    topicsWithout: topicIds.filter(t => !links[t]),
  };
}

// ---------- robots.txt ----------

export interface Robots { disallow: RegExp[]; delayMs: number }

/** Reguły dla „User-agent: *”: Disallow (z * i $) oraz Crawl-delay. */
export function parseRobots(txt: string): Robots {
  const disallow: RegExp[] = [];
  let delay = 0, inStar = false, lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, key, value] = m;
    if (/^user-agent$/i.test(key)) {
      inStar = (lastWasAgent && inStar) || value.trim() === "*";
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!inStar) continue;
    if (/^disallow$/i.test(key) && value) {
      const re = value.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      disallow.push(new RegExp(`^${re}`));
    }
    if (/^crawl-delay$/i.test(key)) delay = Math.max(delay, Number(value) || 0);
  }
  return { disallow, delayMs: delay * 1000 };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Grzeczny klient: robots.txt na host, Crawl-delay (min. 1 s) między zapytaniami do tego samego hosta. */
function politeFetcher() {
  const robots = new Map<string, Robots>();
  const last = new Map<string, number>();
  return async (url: string, method: "GET" | "HEAD" = "GET"): Promise<Response | string> => {
    const { origin, pathname } = new URL(url);
    if (!robots.has(origin)) {
      const r = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT } }).catch(() => null);
      robots.set(origin, parseRobots(r?.ok ? await r.text() : ""));
      last.set(origin, Date.now());
    }
    const rules = robots.get(origin)!;
    if (rules.disallow.some(re => re.test(pathname))) return "zablokowane przez robots.txt";
    const wait = (last.get(origin) ?? 0) + Math.max(rules.delayMs, 1000) - Date.now();
    if (wait > 0) await sleep(wait);
    last.set(origin, Date.now());
    return fetch(url, { method, redirect: "follow", headers: { "user-agent": USER_AGENT } });
  };
}

// ---------- CLI ----------

const ROOT = join(import.meta.dirname, "..");
const COLLECTED = join(ROOT, "scripts", "links", "collected.json");
const RULES = join(ROOT, "scripts", "links", "rules.json");
const OUT = join(ROOT, "src", "data", "external-links.json");
const REPORT = join(ROOT, "docs", "faza-5", "niedopasowane.md");

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path: string, data: unknown) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
};

async function collect(): Promise<Link[]> {
  const get = politeFetcher();
  const pages: { page: IndexPage; html: string }[] = [];
  for (const page of INDEX_PAGES) {
    const res = await get(page.url);
    if (typeof res === "string" || !res.ok) {
      console.log(`  pominięto ${page.url}: ${typeof res === "string" ? res : res.status}`);
      continue;
    }
    pages.push({ page, html: await res.text() });
    console.log(`  ${page.url}`);
  }
  return pickLessons(pages);
}

function report(m: Mapping, total: number, topics: { id: string; level: string; title: string }[]): string {
  const title = new Map(topics.map(t => [t.id, `${t.level} ${t.title}`]));
  const lines = [
    "# Linki „Dodatkowo” – do ręcznej decyzji",
    "",
    `Zebrane linki: ${total}. Przypisane: ${total - m.unmatched.length}. Tematy z linkami: ${topics.length - m.topicsWithout.length} z ${topics.length}.`,
    "",
    "Plik generuje `node scripts/collect-links.ts`. Przypisania są w `scripts/links/rules.json`.",
    "",
  ];
  if (m.stale.length) {
    lines.push("## Nieaktualne reguły (adresu nie ma już w spisach treści)", "");
    for (const s of m.stale) lines.push(`- ${s.topicId}: ${s.url}`);
    lines.push("");
  }
  lines.push(`## Linki bez tematu (${m.unmatched.length})`, "");
  for (const source of SOURCES) {
    const list = m.unmatched.filter(l => l.source === source);
    if (!list.length) continue;
    lines.push(`### ${source} (${list.length})`, "");
    for (const l of list) lines.push(`- [${l.title}](${l.url})`);
    lines.push("");
  }
  lines.push(`## Tematy bez linków (${m.topicsWithout.length})`, "");
  for (const t of m.topicsWithout) lines.push(`- ${t} – ${title.get(t)}`);
  return lines.join("\n") + "\n";
}

async function check() {
  const data = readJson<Record<string, Link[]>>(OUT);
  const urls = [...new Set(Object.values(data).flat().map(l => l.url))];
  const get = politeFetcher();
  const bad: string[] = [];
  const hosts = new Map<string, string[]>();
  for (const u of urls) hosts.set(new URL(u).origin, [...(hosts.get(new URL(u).origin) ?? []), u]);
  // Hosty sprawdzamy równolegle, adresy w obrębie hosta – po kolei z Crawl-delay.
  await Promise.all([...hosts.values()].map(async list => {
    for (const u of list) {
      // Jedna ponowna próba przy błędzie sieci (nie przy złym statusie).
      const res = await get(u, "HEAD").catch(() => get(u, "HEAD")).catch(e => String(e));
      const status = typeof res === "string" ? res : res.status;
      if (status !== 200) bad.push(`${status} ${u}`);
    }
  }));
  console.log(`Sprawdzono ${urls.length} linków.`);
  if (bad.length) { console.log(`Nie zwraca 200: ${bad.length}`); for (const b of bad) console.log(`  ${b}`); process.exitCode = 1; }
  else console.log("Wszystkie zwracają 200.");
}

async function main() {
  if (process.argv.includes("--check")) return check();
  let collected: Link[];
  if (process.argv.includes("--offline")) collected = readJson<Link[]>(COLLECTED);
  else {
    console.log("Pobieram spisy treści…");
    collected = await collect();
    writeJson(COLLECTED, collected);
  }
  const topics = readJson<{ id: string; level: string; title: string }[]>(join(ROOT, "src", "data", "curriculum.json"));
  const rules = readJson<Rules>(RULES);
  const m = mapLinks(collected, rules, topics.map(t => t.id));
  writeJson(OUT, m.links);
  mkdirSync(dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, report(m, collected.length, topics));
  console.log(`Zebrane: ${collected.length}, bez tematu: ${m.unmatched.length}, tematy bez linków: ${m.topicsWithout.length}, nieaktualne reguły: ${m.stale.length}`);
  if (m.unknownTopics.length) { console.log(`Reguły dla nieznanych tematów: ${m.unknownTopics.join(", ")}`); process.exitCode = 1; }
}

if (import.meta.main) await main();
