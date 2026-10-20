import type { CSSProperties } from "react";
import type { Level } from "../../types.ts";

/** Znak szlaku: pas biały–kolor–biały w kolorze poziomu. */
export function Sign({ level, size = "m" }: { level: Level; size?: "s" | "m" | "l" }) {
  return <span className={`sign sign-${size}`} style={{ "--lvl": `var(--${level})` } as CSSProperties} aria-hidden="true" />;
}
