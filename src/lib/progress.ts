// Model postępu + merge. Zapis zawsze najpierw do localStorage (działa offline).
import type { Level, Section, Topic } from "../types.ts";

export const PASS_SCORE = 80; // %

export interface SetResult {
  bestScore: number;    // 0–100, wynik z pierwszej próby
  completedAt: string;  // ISO; moment uzyskania bestScore
}

/** Zadanie w powtórkach jest aktywne, gdy nie ma `done` albo dodano je ponownie po `done`. */
export interface ReviewEntry {
  added: string;   // ISO
  done?: string;   // ISO
}

export interface LevelChoice {
  level: Level;
  at: string;      // ISO
}

/** Checkbox „zrobione” przy linku „Dodatkowo”; wygrywa ostatnie kliknięcie. */
export interface LinkMark {
  done: boolean;
  at: string;      // ISO
}

export interface Progress {
  sets: Record<string, SetResult>;
  reviews: Record<string, ReviewEntry>;              // id zadania → zdarzenia
  levels: Partial<Record<Section, LevelChoice>>;     // wybrany poziom w dziale
  links: Record<string, LinkMark>;                   // URL → stan checkboxa
}

export const emptyProgress = (): Progress => ({ sets: {}, reviews: {}, levels: {}, links: {} });

export function recordSet(p: Progress, setId: string, score: number, now: Date): Progress {
  const prev = p.sets[setId];
  if (prev && prev.bestScore > score) return p;
  return { ...p, sets: { ...p.sets, [setId]: { bestScore: score, completedAt: now.toISOString() } } };
}

export const isSetPassed = (p: Progress, setId: string) => (p.sets[setId]?.bestScore ?? 0) >= PASS_SCORE;
export const isTopicDone = (p: Progress, t: Topic) => t.sets.every(s => isSetPassed(p, s));

export function topicsOnPath(topics: Topic[], section: Section, level: Level): Topic[] {
  return topics.filter(t => t.section === section && t.level === level).sort((a, b) => a.order - b.order);
}

/** „Dziś” = pierwszy niezrobiony temat w dziale i poziomie. */
export function todayTopic(topics: Topic[], p: Progress, section: Section, level: Level): Topic | undefined {
  return topicsOnPath(topics, section, level).find(t => !isTopicDone(p, t));
}

const isActive = (e: ReviewEntry) => !e.done || e.done < e.added;

/** Aktywne powtórki w kolejności dodania. */
export function activeReviews(p: Progress): string[] {
  return Object.entries(p.reviews)
    .filter(([, e]) => isActive(e))
    .sort(([a, x], [b, y]) => x.added.localeCompare(y.added) || a.localeCompare(b))
    .map(([id]) => id);
}

export function addReviews(p: Progress, ids: string[], now: Date): Progress {
  const fresh = ids.filter(id => !p.reviews[id] || !isActive(p.reviews[id]));
  if (!fresh.length) return p;
  const at = now.toISOString();
  return { ...p, reviews: { ...p.reviews, ...Object.fromEntries(fresh.map(id => [id, { ...p.reviews[id], added: at }])) } };
}

export function removeReview(p: Progress, id: string, now: Date): Progress {
  const e = p.reviews[id];
  return e && isActive(e) ? { ...p, reviews: { ...p.reviews, [id]: { ...e, done: now.toISOString() } } } : p;
}

/** Wybrany poziom w dziale; domyślnie pierwszy dostępny (Writing zaczyna się od A2). */
export const levelFor = (p: Progress, s: Section): Level => p.levels[s]?.level ?? (s === "writing" ? "A2" : "A1");

export const setLevel = (p: Progress, section: Section, level: Level, now: Date): Progress =>
  ({ ...p, levels: { ...p.levels, [section]: { level, at: now.toISOString() } } });

export const isLinkDone = (p: Progress, url: string) => p.links[url]?.done ?? false;

export const markLink = (p: Progress, url: string, done: boolean, now: Date): Progress =>
  ({ ...p, links: { ...p.links, [url]: { done, at: now.toISOString() } } });

// ===== Merge =====
// Deterministyczny i niezależny od kolejności argumentów: każdy element bierze „lepszą” wersję, nic nie jest
// nadpisywane w całości. Zestaw: wyższy bestScore, przy remisie późniejsze completedAt.
// Powtórka: najpóźniejsze dodanie i najpóźniejsze zrobienie. Poziom: później wybrany.
// Link: późniejsze kliknięcie, przy remisie „zrobione”.

const later = (a?: string, b?: string) => (a === undefined ? b : b === undefined ? a : a > b ? a : b);

function betterSet(a: SetResult, b: SetResult): SetResult {
  if (a.bestScore !== b.bestScore) return a.bestScore > b.bestScore ? a : b;
  return a.completedAt >= b.completedAt ? a : b;
}

function betterLevel(a: LevelChoice, b: LevelChoice): LevelChoice {
  if (a.at !== b.at) return a.at > b.at ? a : b;
  return a.level >= b.level ? a : b;
}

function betterLink(a: LinkMark, b: LinkMark): LinkMark {
  if (a.at !== b.at) return a.at > b.at ? a : b;
  return a.done ? a : b;
}

function mergeRecords<T>(a: Record<string, T>, b: Record<string, T>, pick: (x: T, y: T) => T): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k], v) : v;
  return out;
}

export function mergeProgress(a: Progress, b: Progress): Progress {
  return {
    sets: mergeRecords(a.sets, b.sets, betterSet),
    reviews: mergeRecords(a.reviews, b.reviews, (x, y) => {
      const done = later(x.done, y.done);
      return done ? { added: later(x.added, y.added)!, done } : { added: later(x.added, y.added)! };
    }),
    levels: mergeRecords(a.levels as Record<string, LevelChoice>, b.levels as Record<string, LevelChoice>, betterLevel),
    links: mergeRecords(a.links, b.links, betterLink),
  };
}

// ===== Zapis =====

const EPOCH = new Date(0).toISOString();

/** Odczyt postępu z niezaufanego JSON-a (localStorage, Supabase). Starszy format z fazy 2 jest przepisywany. */
export function parseProgress(data: unknown): Progress {
  if (typeof data !== "object" || data === null) return emptyProgress();
  const d = data as Record<string, unknown>;
  const p = emptyProgress();
  if (typeof d.sets === "object" && d.sets) p.sets = d.sets as Progress["sets"];
  if (Array.isArray(d.reviews)) p.reviews = Object.fromEntries(d.reviews.map(id => [String(id), { added: EPOCH }]));
  else if (typeof d.reviews === "object" && d.reviews) p.reviews = d.reviews as Progress["reviews"];
  if (typeof d.levels === "object" && d.levels) {
    for (const [s, v] of Object.entries(d.levels)) {
      p.levels[s as Section] = typeof v === "string" ? { level: v as Level, at: EPOCH } : (v as LevelChoice);
    }
  }
  if (typeof d.links === "object" && d.links) p.links = d.links as Progress["links"];
  return p;
}

const KEY = "szlak.progress";

export function loadProgress(storage: Storage): Progress {
  try {
    const raw = storage.getItem(KEY);
    return raw ? parseProgress(JSON.parse(raw)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(storage: Storage, p: Progress): void {
  try {
    storage.setItem(KEY, JSON.stringify(p));
  } catch {
    // brak miejsca / zablokowany storage — postęp zostaje w pamięci
  }
}
