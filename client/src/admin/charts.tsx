import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";

const HEIGHT = 220;
const MARGIN = { top: 12, right: 8, bottom: 26 };
const AXIS_CHARACTER_WIDTH = 6.5;
const MAX_BAR_WIDTH = 24;
const BAR_GAP = 2;
const CORNER = 4;

function niceCeiling(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((multiple) => multiple * magnitude >= value) ?? 10;
  return step * magnitude;
}

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

type Column = { label: string; shortLabel: string; value: number };

type ColumnChartProps = {
  title: string;
  columns: Column[];
  formatValue: (value: number) => string;
};

export function ColumnChart({ title, columns, formatValue }: ColumnChartProps) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const top = niceCeiling(Math.max(...columns.map((column) => column.value), 0));
  const ticks = top % 2 === 0 ? [0, top / 2, top] : [0, top];

  const longestLabel = Math.max(...ticks.map((tick) => formatValue(tick).length));
  const left = longestLabel * AXIS_CHARACTER_WIDTH + 16;

  const innerWidth = Math.max(width - left - MARGIN.right, 0);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = columns.length > 0 ? innerWidth / columns.length : 0;
  const barWidth = Math.max(Math.min(MAX_BAR_WIDTH, band - BAR_GAP), 1);

  const y = (value: number) => MARGIN.top + innerHeight * (1 - value / top);
  const x = (index: number) => left + band * index + (band - barWidth) / 2;

  const labelEvery = Math.max(Math.ceil(columns.length / 6), 1);

  function activateFromPointer(event: PointerEvent<SVGSVGElement>) {
    const offset = event.clientX - event.currentTarget.getBoundingClientRect().left - left;
    const index = Math.floor(offset / band);
    setActive(index >= 0 && index < columns.length ? index : null);
  }

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

  return (
    <figure>
      <figcaption className="mb-3 text-sm font-semibold">{title}</figcaption>
      <div
        ref={ref}
        tabIndex={0}
        role="group"
        aria-label={`${title}. Press the left and right arrow keys to read each day.`}
        onKeyDown={activateFromKeyboard}
        onBlur={() => setActive(null)}
        className="relative"
      >
        <svg
          width={width}
          height={HEIGHT}
          aria-hidden="true"
          onPointerMove={activateFromPointer}
          onPointerLeave={() => setActive(null)}
          className="block"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-line"
              />
              <text
                x={left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted text-[11px] tabular-nums"
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
              <g key={column.label}>
                {height > 0 && (
                  <path
                    d={`M${barLeft},${bottom} V${bottom - height + radius} Q${barLeft},${bottom - height} ${barLeft + radius},${bottom - height} H${barLeft + barWidth - radius} Q${barLeft + barWidth},${bottom - height} ${barLeft + barWidth},${bottom - height + radius} V${bottom} Z`}
                    className={index === active ? "fill-brass-light" : "fill-brass"}
                  />
                )}
                {index % labelEvery === 0 && (
                  <text
                    x={barLeft + barWidth / 2}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-muted text-[11px]"
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
              className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-sm border border-line-strong bg-ink px-3 py-2 text-sm shadow-lg"
              style={{
                left: Math.min(Math.max(x(active) + barWidth / 2, 70), Math.max(width - 70, 70)),
                top: 0,
              }}
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
      <figcaption className="mb-3 text-sm font-semibold">{title}</figcaption>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="flex justify-between gap-4 text-sm">
              <span>{row.label}</span>
              <span className="tabular-nums text-muted">{row.value}</span>
            </div>
            <div className="mt-1.5 h-2">
              {row.value > 0 && (
                <div
                  className="h-full min-w-1 rounded-r bg-brass"
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
