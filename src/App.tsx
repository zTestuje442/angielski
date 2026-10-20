import { useCallback, useEffect, useState } from "react";
import { Session } from "./components/exercises/Session.tsx";
import { PathScreen } from "./components/path/PathScreen.tsx";
import { WritingScreen } from "./components/writing/WritingScreen.tsx";
import { loadExercises, loadSets, loadWritingTask } from "./content.ts";
import {
  activeReviews, addReviews, levelFor, loadProgress, markLink, recordSet, removeReview, saveProgress, setLevel, type Progress,
} from "./lib/progress.ts";
import { useSync } from "./lib/useSync.ts";
import type { PlayableExercise, Section, Topic, WritingTask } from "./types.ts";

type View =
  | { kind: "path" }
  | { kind: "set"; run: number; topic: Topic; setId: string; exercises: PlayableExercise[] }
  | { kind: "reviews"; run: number; exercises: PlayableExercise[] }
  | { kind: "writing"; topic: Topic; task: WritingTask };

function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress(localStorage));
  const [section, setSection] = useState<Section>("grammar");
  const [view, setView] = useState<View>({ kind: "path" });
  const [lastToday, setLastToday] = useState<Record<string, string | undefined>>({});

  const sync = useSync(progress, setProgress);

  useEffect(() => { saveProgress(localStorage, progress); }, [progress]);
  useEffect(() => { window.scrollTo(0, 0); }, [view.kind]);

  const pathKey = `${section}-${levelFor(progress, section)}`;
  const onTodaySeen = useCallback(
    (id: string | undefined) => setLastToday(m => (m[pathKey] === id ? m : { ...m, [pathKey]: id })),
    [pathKey],
  );

  const startSet = async (topic: Topic, setId: string) => {
    const set = (await loadSets(topic)).find(s => s.id === setId);
    if (set) setView({ kind: "set", run: Date.now(), topic, setId, exercises: set.exercises });
  };
  const startReviews = async () => {
    const exercises = await loadExercises(activeReviews(progress));
    if (exercises.length) setView({ kind: "reviews", run: Date.now(), exercises });
  };
  const startWriting = async (topic: Topic) => {
    const task = await loadWritingTask(topic);
    if (task) setView({ kind: "writing", topic, task });
  };
  const toPath = () => setView({ kind: "path" });

  if (view.kind === "set") {
    const n = view.topic.sets.indexOf(view.setId) + 1;
    return (
      <Session key={view.run} mode="set" title={`${view.topic.title} · zestaw ${n}`} level={view.topic.level}
        exercises={view.exercises}
        onFirstTry={(id, ok) => { if (!ok) setProgress(p => addReviews(p, [id], new Date())); }}
        onFinish={score => setProgress(p => recordSet(p, view.setId, score, new Date()))}
        onRestart={() => setView({ ...view, run: Date.now() })}
        onExit={toPath} />
    );
  }
  if (view.kind === "writing") return <WritingScreen topic={view.topic} task={view.task} onExit={toPath} />;
  if (view.kind === "reviews") {
    return (
      <Session key={view.run} mode="reviews" title="Powtórki" exercises={view.exercises}
        onFirstTry={(id, ok) => { if (ok) setProgress(p => removeReview(p, id, new Date())); }}
        onFinish={() => {}} onRestart={startReviews} onExit={toPath} />
    );
  }
  return (
    <PathScreen key={pathKey} progress={progress} section={section} onSection={setSection}
      onLevel={l => setProgress(p => setLevel(p, section, l, new Date()))}
      onStart={startSet} onWriting={startWriting} onReviews={startReviews} sync={sync}
      onLink={(url, done) => setProgress(p => markLink(p, url, done, new Date()))}
      lastToday={lastToday[pathKey]} onTodaySeen={onTodaySeen} />
  );
}

export default App;
