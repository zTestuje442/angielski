// Układanie zdania z kafelków.
// Mysz: klik w kafelek z puli dokłada go do zdania, klik w kafelek w zdaniu odkłada go, przeciąganie zmienia kolejność.
// Klawiatura: Enter na kafelku z puli dokłada; w zdaniu Spacja podnosi, strzałki przesuwają, Spacja upuszcza,
// Backspace/Delete odkłada.
import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState } from "react";
import { shuffle } from "../../lib/shuffle.ts";
import { FORM_ID, PromptLines, type ExerciseProps } from "./parts.tsx";

const announcements = {
  onDragStart: () => "Podniesiono kafelek. Strzałki przesuwają, Spacja upuszcza, Escape anuluje.",
  onDragOver: () => "",
  onDragEnd: () => "Upuszczono kafelek.",
  onDragCancel: () => "Anulowano przesuwanie.",
};

export function Tiles({ exercise, answered, onSubmit, onReady }: ExerciseProps) {
  const [tiles] = useState(() => shuffle([...(exercise.answer as string[]), ...(exercise.distractors ?? [])]));
  const [placed, setPlaced] = useState<number[]>([]);
  const poolRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  const add = (i: number) => {
    if (answered) return;
    const next = [...placed, i];
    setPlaced(next);
    onReady(true);
    // Fokus na następny wolny kafelek z puli, a gdy pula pusta — na „Sprawdź”.
    const free = tiles.map((_, j) => j).filter(j => !next.includes(j));
    const target = free.find(j => j > i) ?? free[0];
    requestAnimationFrame(() => {
      if (target !== undefined) poolRefs.current[target]?.focus();
      else document.querySelector<HTMLButtonElement>(`button[form=${FORM_ID}]`)?.focus();
    });
  };
  const remove = (i: number) => {
    if (answered) return;
    const next = placed.filter(p => p !== i);
    setPlaced(next);
    onReady(next.length > 0);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setPlaced(arrayMove(placed, placed.indexOf(Number(active.id)), placed.indexOf(Number(over.id))));
  };

  return (
    <form id={FORM_ID} onSubmit={e => { e.preventDefault(); if (placed.length) onSubmit({ type: "tiles", value: placed.map(i => tiles[i]) }); }}>
      <PromptLines prompt={exercise.prompt} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
        accessibility={{ announcements, screenReaderInstructions: { draggable: "Spacja podnosi kafelek, Backspace odkłada go do puli." } }}>
        <SortableContext items={placed} strategy={horizontalListSortingStrategy}>
          <div className="answer-line" aria-label="Twoje zdanie">
            {placed.map(i => <PlacedTile key={i} id={i} text={tiles[i]} disabled={answered} onRemove={() => remove(i)} />)}
          </div>
        </SortableContext>
      </DndContext>
      <div className="pool" aria-label="Kafelki do wyboru">
        {tiles.map((t, i) => placed.includes(i)
          ? <span key={i} className="tile used" aria-hidden="true">{t}</span>
          : <button key={i} ref={el => { poolRefs.current[i] = el; }} type="button" className="tile" disabled={answered}
              onClick={() => add(i)}>{t}</button>)}
      </div>
    </form>
  );
}

function PlacedTile({ id, text, disabled, onRemove }: { id: number; text: string; disabled: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <button ref={setNodeRef} type="button" className={`tile placed${isDragging ? " dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes} {...listeners}
      onClick={onRemove}
      onKeyDown={e => {
        if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); onRemove(); return; }
        if (e.key === "Enter") return; // Enter = klik = odłożenie; nie przekazuj do sensora
        listeners?.onKeyDown?.(e);
      }}>
      {text}
    </button>
  );
}
