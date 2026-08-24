"use client";

interface Props {
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}

export function YearRangeSlider({ min, max, value, onChange }: Props) {
  const [start, end] = value;
  const pctStart = ((start - min) / (max - min)) * 100;
  const pctEnd = ((end - min) / (max - min)) * 100;

  return (
    <div className="w-full sm:w-64">
      <div className="flex justify-between text-[0.7rem] text-text-secondary mb-1.5 tabular-nums">
        <span>{start}</span>
        <span>{end}</span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1 rounded-full bg-elevated" />
        <div
          className="absolute h-1 rounded-full bg-la-nina-strong"
          style={{ left: `${pctStart}%`, right: `${100 - pctEnd}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={start}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), end);
            onChange([v, end]);
          }}
          className="range-thumb absolute w-full appearance-none bg-transparent pointer-events-none"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={end}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), start);
            onChange([start, v]);
          }}
          className="range-thumb absolute w-full appearance-none bg-transparent pointer-events-none"
        />
      </div>
      <style jsx>{`
        .range-thumb::-webkit-slider-thumb {
          pointer-events: auto;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #f1f5f9;
          border: 2px solid #0ea5e9;
          cursor: pointer;
          margin-top: 0;
        }
        .range-thumb::-moz-range-thumb {
          pointer-events: auto;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #f1f5f9;
          border: 2px solid #0ea5e9;
          cursor: pointer;
        }
        .range-thumb::-webkit-slider-runnable-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
