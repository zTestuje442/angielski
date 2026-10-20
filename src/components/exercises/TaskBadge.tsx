// Ikona z podpisem: co trzeba zrobić w zadaniu (tłumaczenie, pytanie, przeczenie…).
import type { ReactNode } from "react";
import { TASK_KINDS, type TaskKind } from "../../lib/taskKind.ts";

const ICONS: Record<TaskKind, ReactNode> = {
  // dwa dymki: polski → angielski
  translate: <><path d="M3 5h9v7H7l-3 3v-3H3z" /><path d="M12 9h9v7h-1v3l-3-3h-5v-4" /><path d="M15 12.5h3" /></>,
  question: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" /><path d="M12 17h.01" /></>,
  negative: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>,
  combine: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  rewrite: <><path d="M4 9a8 8 0 0 1 14-3l2 2" /><path d="M20 4v4h-4" /><path d="M20 15a8 8 0 0 1-14 3l-2-2" /><path d="M4 20v-4h4" /></>,
  gap: <><path d="M3 15h4" /><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M17 15h4" /></>,
  choose: <><circle cx="6" cy="7" r="2" /><path d="M11 7h10" /><circle cx="6" cy="17" r="2" fill="currentColor" /><path d="M11 17h10" /></>,
  truefalse: <><path d="M3 12l3 3 5-6" /><path d="M14 8l7 7M21 8l-7 7" /></>,
  match: <><circle cx="4" cy="6" r="1.5" /><circle cx="4" cy="18" r="1.5" /><circle cx="20" cy="6" r="1.5" /><circle cx="20" cy="18" r="1.5" /><path d="M5.5 6.5l13 11M5.5 17.5l13-11" /></>,
  order: <><rect x="3" y="4" width="8" height="5" rx="1" /><rect x="13" y="4" width="8" height="5" rx="1" /><rect x="3" y="15" width="18" height="5" rx="1" /><path d="M12 10.5v3" /></>,
  fix: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
};

export function TaskBadge({ kind }: { kind: TaskKind }) {
  return (
    <span className="task-badge" data-kind={kind}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[kind]}</svg>
      {TASK_KINDS[kind]}
    </span>
  );
}
