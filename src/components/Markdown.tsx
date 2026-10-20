// Minimalny markdown wyjaśnień: akapity, listy „- ” (także pod zdaniem wstępu), **pogrubienie**, *kursywa*,
// [linki](https://...) – zewnętrzne, więc otwierają się w nowej karcie.
import type { ReactNode } from "react";

const LINK = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/;

function inline(text: string): ReactNode[] {
  return text.split(/(\[[^\]]+\]\(https:\/\/[^)\s]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    const link = part.match(LINK);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part.startsWith("*") && part.length > 1 ? <em key={i}>{part.slice(1, -1)}</em>
      : part;
  });
}

/** Dzieli blok na kolejne grupy: zwykłe linie (akapit) i linie „- ” (lista). */
function groups(block: string): { list: boolean; lines: string[] }[] {
  const out: { list: boolean; lines: string[] }[] = [];
  for (const line of block.split("\n")) {
    const list = line.startsWith("- ");
    const last = out[out.length - 1];
    if (last && last.list === list) last.lines.push(list ? line.slice(2) : line);
    else out.push({ list, lines: [list ? line.slice(2) : line] });
  }
  return out;
}

export function Markdown({ text }: { text: string }) {
  return text.split(/\n{2,}/).flatMap((block, i) => groups(block).map((g, j) =>
    g.list
      ? <ul key={`${i}-${j}`}>{g.lines.map((l, k) => <li key={k}>{inline(l)}</li>)}</ul>
      : <p key={`${i}-${j}`}>{inline(g.lines.join(" "))}</p>));
}
