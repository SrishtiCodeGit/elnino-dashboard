"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PHASE_COLOR } from "@/lib/theme";

const NAV = [
  { href: "/", label: "US Impact Map" },
  { href: "/enso", label: "ENSO Monitor" },
  { href: "/markets", label: "Financial Markets" },
  { href: "/commodities", label: "Commodities" },
  { href: "/crypto", label: "Cryptocurrency" },
  { href: "/insurance", label: "Insurance & Banking" },
] as const;

export function FloatingMenu({
  latestOni,
}: {
  latestOni: { value: number; phase: string; date: string };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  const ref = useRef<HTMLDivElement>(null);
  const phaseColor = PHASE_COLOR[latestOni.phase] ?? "#64748B";

  // Close the menu on navigation. Computed during render (not an effect) so
  // it takes effect before paint, per React's "adjusting state on prop
  // change" pattern.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="fixed top-5 left-5 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="w-12 h-12 rounded-full bg-surface border border-border-strong shadow-xl flex items-center justify-center text-text-primary hover:border-la-nina-strong transition-colors"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      <div
        className={`absolute top-14 left-0 w-64 rounded-2xl border border-border-strong bg-surface shadow-2xl overflow-hidden origin-top-left transition-all duration-150
          ${open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}
      >
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-la-nina-strong pulse-dot" />
            <span className="text-[0.82rem] font-bold tracking-tight text-text-primary">
              El Nino Financial Risk
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg font-extrabold tabular-nums" style={{ color: phaseColor }}>
              {latestOni.value >= 0 ? "+" : ""}
              {latestOni.value.toFixed(2)}&deg;C
            </span>
            <span className="text-[0.68rem] text-text-secondary">
              {latestOni.phase} &middot; {latestOni.date}
            </span>
          </div>
        </div>

        <nav className="py-1.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2.5 text-[0.83rem] transition-colors ${
                  active
                    ? "text-text-primary font-semibold bg-la-nina-strong/10"
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
