import { useEffect, useState } from "react";
import { topics } from "../../content.ts";
import { activeReviews, isTopicDone, levelFor, type Progress } from "../../lib/progress.ts";
import { LEVELS, SECTIONS, type Level, type Section, type Topic } from "../../types.ts";
import { Sign } from "./Sign.tsx";
import { SyncButton, type SyncProps } from "./SyncDialog.tsx";
import { Trail } from "./Trail.tsx";

const SECTION_NAMES: Record<Section, string> = {
  grammar: "Gramatyka", vocabulary: "Słownictwo", sentences: "Zdania", reading: "Reading", writing: "Writing",
};

interface Props {
  progress: Progress;
  section: Section;
  onSection: (s: Section) => void;
  onLevel: (l: Level) => void;
  onStart: (topic: Topic, setId: string) => void;
  onWriting: (topic: Topic) => void;
  onLink: (url: string, done: boolean) => void;
  onReviews: () => void;
  sync: SyncProps;
  lastToday: string | undefined;          // „dziś” widziane ostatnio na tej ścieżce
  onTodaySeen: (topicId: string | undefined) => void;
}

export function PathScreen({ progress, section, onSection, onLevel, onStart, onWriting, onLink, onReviews, sync, lastToday, onTodaySeen }: Props) {
  const level = levelFor(progress, section);
  const path = topics.filter(t => t.section === section && t.level === level).sort((a, b) => a.order - b.order);
  const today = path.find(t => !isTopicDone(progress, t));
  const reviews = activeReviews(progress).length;

  // Znacznik „jesteś tutaj” startuje z ostatnio widzianego miejsca i przesuwa się na nowe „dziś”.
  const [markerAt, setMarkerAt] = useState(lastToday ?? today?.id);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMarkerAt(today?.id));
    onTodaySeen(today?.id);
    return () => cancelAnimationFrame(frame);
  }, [today?.id, onTodaySeen]);

  return (
    <div className="path-screen">
      <header className="app-head">
        <div className="head-row">
          <span className="logo">Szlak</span>
          <nav className="tabs" aria-label="Działy">
            {SECTIONS.map(s => (
              <button key={s} type="button" aria-current={s === section ? "page" : undefined} onClick={() => onSection(s)}>
                {SECTION_NAMES[s]}
              </button>
            ))}
          </nav>
        </div>
        <div className="head-row">
          <div className="levels" role="group" aria-label="Poziom">
            {LEVELS.map(l => {
              const off = section === "writing" && l === "A1";
              return (
                <button key={l} type="button" aria-pressed={l === level} disabled={off} title={off ? "Writing od A2" : undefined}
                  onClick={() => onLevel(l)}>
                  <Sign level={l} size="s" />{l}{off && <span className="off-note">od A2</span>}
                </button>
              );
            })}
          </div>
          <div className="head-links">
            <button className="link-btn" type="button" disabled={reviews === 0} onClick={onReviews}>
              Powtórki ({reviews})
            </button>
            <SyncButton sync={sync} />
          </div>
        </div>
      </header>
      <main className="path-wrap">
        <Contours />
        <Trail path={path} progress={progress} today={today} markerAt={markerAt}
          justDone={lastToday !== today?.id ? lastToday : undefined} onStart={onStart} onWriting={onWriting} onLink={onLink} />
        {!today && path.length > 0 && <p className="path-end">Ten poziom masz przebyty. Wybierz kolejny.</p>}
      </main>
    </div>
  );
}

function Contours() {
  return (
    <svg className="contours" viewBox="0 0 600 700" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <path d="M620 40 C520 60 470 120 430 190 S360 330 420 400 S560 470 620 520" />
      <path d="M620 90 C540 110 500 160 470 220 S420 330 460 380 S560 440 620 470" />
      <path d="M620 140 C565 160 535 200 515 245 S490 320 515 350 S575 395 620 415" />
      <path d="M620 190 C590 205 570 235 562 265 S560 310 580 325 S605 345 620 350" />
      <path d="M-20 560 C80 540 160 600 260 640 S420 700 520 720" />
      <path d="M-20 610 C90 600 170 640 250 680 S360 720 420 740" />
    </svg>
  );
}
