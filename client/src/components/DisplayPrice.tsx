import { formatLari, LARI_SIGN } from "../lib/format.ts";

export function DisplayPrice({ cents, className = "" }: { cents: number; className?: string }) {
  return (
    <span className={`font-display ${className}`}>
      {formatLari(cents)}
      {/* Fraunces has no lari sign, and the fallback glyph is much lighter
          than its digits unless it is drawn in a heavier weight. */}
      &nbsp;<span className="font-georgian font-bold">{LARI_SIGN}</span>
    </span>
  );
}
