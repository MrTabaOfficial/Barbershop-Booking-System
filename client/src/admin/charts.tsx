import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { axisTicks } from "./chartMath.ts";

const HEIGHT = 220;
const MARGIN = { top: 12, right: 4, bottom: 26 };
const AXIS_CHARACTER_WIDTH = 7.5;
const AXIS_LABEL_ROOM = 70;
const MAX_BAR_WIDTH = 24;
const BAR_GAP = 2;
const CORNER = 4;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

type Column = { key: string; label: string; shortLabel: string; value: number };

type ColumnChartProps = {
  title: string;
  hint: string;
  columns: Column[];
  smallestStep?: number;
  formatValue: (value: number) => string;
};

export function ColumnChart({ title, hint, columns, smallestStep, formatValue }: ColumnChartProps) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const ticks = axisTicks(Math.max(...columns.map((column) => column.value), 0), smallestStep);
  const top = ticks.at(-1) ?? 1;

  const longestLabel = Math.max(...ticks.map((tick) => formatValue(tick).length));
  const left = longestLabel * AXIS_CHARACTER_WIDTH + 12;

  const innerWidth = Math.max(width - left - MARGIN.right, 0);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = columns.length > 0 ? innerWidth / columns.length : 0;
  const barWidth = Math.max(Math.min(MAX_BAR_WIDTH, band - BAR_GAP), 1);

  const y = (value: number) => MARGIN.top + innerHeight * (1 - value / top);
  const x = (index: number) => left + band * index + (band - barWidth) / 2;

  const labelsThatFit = Math.max(Math.floor(innerWidth / AXIS_LABEL_ROOM), 1);
  const labelEvery = Math.max(Math.ceil(columns.length / labelsThatFit), 1);

  function activateFromPointer(event: PointerEvent<SVGSVGElement>) {
    const offset = event.clientX - event.currentTarget.getBoundingClientRect().left - left;
    const index = Math.floor(offset / band);
    setActive(index >= 0 && index < columns.length ? index : null);
  }

  const isReading = active !== null;
  useEffect(() => {
    if (!isReading) {
      return;
    }
    // A reading opened by hovering has to close on Escape as well, and the
    // chart doesn't have keyboard focus then.
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setActive(null);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isReading]);

  function activateFromKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0 || columns.length === 0) {
      return;
    }
    event.preventDefault();
    const from = active ?? (step === 1 ? -1 : columns.length);
    setActive(Math.min(Math.max(from + step, 0), columns.length - 1));
  }

  const activeColumn = active === null ? undefined : columns[active];
  const activeCenter = active === null ? 0 : x(active) + barWidth / 2;

  return (
    <figure>
      <figcaption className="mb-3">
        <h2 className="text-base font-semibold tracking-normal">{title}</h2>
      </figcaption>
      <div
        ref={ref}
        tabIndex={0}
        role="group"
        aria-label={`${title}. ${hint}`}
        onKeyDown={activateFromKeyboard}
        onBlur={() => setActive(null)}
        className="relative rounded-md"
      >
        <svg
          width={width}
          height={HEIGHT}
          aria-hidden="true"
          onPointerDown={activateFromPointer}
          onPointerMove={activateFromPointer}
          // A finger leaves the chart the moment it lifts, so only a mouse
          // leaving clears the reading; a tap's reading stays until focus moves.
          onPointerLeave={(event) => event.pointerType === "mouse" && setActive(null)}
          className="block touch-pan-y"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 0 ? "stroke-edge" : "stroke-line"}
              />
              <text
                x={left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted text-xs tabular-nums"
              >
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {columns.map((column, index) => {
            const height = innerHeight * (column.value / top);
            const radius = Math.min(CORNER, height, barWidth / 2);
            const barLeft = x(index);
            const bottom = MARGIN.top + innerHeight;
            return (
              <g key={column.key}>
                {height > 0 && (
                  <path
                    d={`M${barLeft},${bottom} V${bottom - height + radius} Q${barLeft},${bottom - height} ${barLeft + radius},${bottom - height} H${barLeft + barWidth - radius} Q${barLeft + barWidth},${bottom - height} ${barLeft + barWidth},${bottom - height + radius} V${bottom} Z`}
                    className={index === active ? "fill-action-pressed" : "fill-action"}
                  />
                )}
                {index === active && (
                  <rect
                    x={barLeft - 1}
                    y={bottom + 2}
                    width={barWidth + 2}
                    height={3}
                    className="fill-ink"
                  />
                )}
                {index % labelEvery === 0 && (
                  <text
                    x={barLeft + barWidth / 2}
                    y={HEIGHT - 8}
                    textAnchor={index === 0 ? "start" : "middle"}
                    className="fill-muted text-xs"
                  >
                    {column.shortLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div aria-live="polite">
          {activeColumn && active !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-md border border-line bg-page px-3 py-2 text-sm shadow-pop"
              style={
                activeCenter < width / 2
                  ? { left: Math.max(activeCenter - 20, left) }
                  : { right: Math.max(width - activeCenter - 20, 0) }
              }
            >
              <span className="block font-semibold tabular-nums">
                {formatValue(activeColumn.value)}
              </span>
              <span className="block text-muted">{activeColumn.label}</span>
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}

type BarListProps = {
  title: string;
  rows: { label: string; value: number }[];
};

export function BarList({ title, rows }: BarListProps) {
  const longest = Math.max(...rows.map((row) => row.value), 1);
  return (
    <figure>
      <figcaption className="mb-3">
        <h2 className="text-base font-semibold tracking-normal">{title}</h2>
      </figcaption>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex justify-between gap-4 text-sm">
              <span>{row.label}</span>
              <span className="font-semibold tabular-nums">{row.value}</span>
            </div>
            <div className="mt-1.5 h-2">
              {row.value > 0 && (
                <div
                  className="h-full min-w-1 rounded-r-[4px] bg-action"
                  style={{ width: `${(row.value / longest) * 100}%` }}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}
