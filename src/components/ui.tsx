import type { ReactNode } from "react";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-border pb-4 mb-6">
      <h1 className="text-[1.4rem] font-bold tracking-tight text-text-primary">{title}</h1>
      {subtitle && <p className="text-[0.82rem] text-text-secondary mt-1">{subtitle}</p>}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[0.68rem] font-bold tracking-widest uppercase text-text-muted my-5">
      {children}
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

export function SourceBadge({ sources }: { sources: string[] }) {
  return (
    <div className="mt-1 mb-1 flex flex-wrap gap-1.5">
      {sources.map((s) => (
        <span
          key={s}
          className="inline-flex items-center text-[0.68rem] text-text-muted bg-elevated border border-border rounded px-1.5 py-0.5"
        >
          Source: {s}
        </span>
      ))}
    </div>
  );
}

type KpiColor = "positive" | "negative" | "neutral";

export function Kpi({
  label,
  value,
  sub,
  color = "neutral",
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  color?: KpiColor;
}) {
  const colorClass =
    color === "positive"
      ? "text-green"
      : color === "negative"
        ? "text-el-nino-strong"
        : "text-text-primary";
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4 h-full">
      <div className="text-[0.7rem] font-semibold tracking-wider uppercase text-text-muted mb-2">
        {label}
      </div>
      <div className={`text-[1.75rem] font-bold tracking-tight tabular-nums ${colorClass}`}>
        {value}
      </div>
      {sub && <div className="text-[0.75rem] text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

export function Callout({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning";
}) {
  const cls =
    tone === "warning"
      ? "bg-amber/10 border-amber/30 border-l-amber"
      : "bg-la-nina-strong/10 border-la-nina-strong/30 border-l-la-nina-strong";
  return (
    <div className={`rounded-r-lg border border-l-4 px-4 py-3 text-[0.82rem] leading-relaxed text-text-secondary my-3 ${cls}`}>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}
