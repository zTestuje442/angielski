// Dostęp do treści: program z curriculum.json, ćwiczenia i teksty ładowane leniwie.
import curriculum from "./data/curriculum.json";
import externalLinks from "./data/external-links.json";
import type { ExerciseSet, ExternalLink, PlayableExercise, ReadingSet, Topic, WritingTask } from "./types.ts";

export const topics = curriculum as Topic[];

export const linksFor = (t: Topic): ExternalLink[] => (externalLinks as Record<string, ExternalLink[]>)[t.id] ?? [];

const exerciseFiles = import.meta.glob<ExerciseSet[]>("./data/exercises/*/*.json", { import: "default" });
const readingFiles = import.meta.glob<ReadingSet>("./data/readings/*/*.json", { import: "default" });
const writingFiles = import.meta.glob<WritingTask>("./data/writing/*/*.json", { import: "default" });

const readingPath = (t: Topic, setId: string) => `./data/readings/${t.level}/${setId}.json`;
const exercisePath = (t: Topic) => `./data/exercises/${t.level}/${t.id}.json`;
const writingPath = (t: Topic) => `./data/writing/${t.level}/${t.id}.json`;

export const hasContent = (t: Topic) =>
  t.section === "reading" ? t.sets.some(s => readingPath(t, s) in readingFiles) : exercisePath(t) in exerciseFiles;

export const hasWritingTask = (t: Topic) => writingPath(t) in writingFiles;
export const loadWritingTask = async (t: Topic) => writingFiles[writingPath(t)]?.();

export interface PlayableSet { id: string; exercises: PlayableExercise[] }

export async function loadSets(t: Topic): Promise<PlayableSet[]> {
  if (t.section !== "reading") return (await exerciseFiles[exercisePath(t)]?.()) ?? [];
  const sets = await Promise.all(t.sets.map(s => readingFiles[readingPath(t, s)]?.()));
  return sets.filter(s => s !== undefined).map(s => ({
    id: s.id,
    exercises: s.exercises.map(e => ({ ...e, passage: { title: s.title, text: s.text } })),
  }));
}

// Id zadania = `${setId}-NN`, id zestawu = `${topicId}-N` (pilnuje validate-content).
const topicIdOf = (exerciseId: string) => exerciseId.split("-").slice(0, -2).join("-");

export async function loadExercises(ids: string[]): Promise<PlayableExercise[]> {
  const byId = new Map<string, PlayableExercise>();
  for (const topicId of new Set(ids.map(topicIdOf))) {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) continue;
    for (const set of await loadSets(topic)) for (const e of set.exercises) byId.set(e.id, e);
  }
  return ids.flatMap(id => byId.get(id) ?? []);
}
