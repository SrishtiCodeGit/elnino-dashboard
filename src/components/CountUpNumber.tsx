"use client";

import { useEffect, useRef, useState } from "react";

/** Animates from the previous displayed value to `value` on every change
 * (including the initial mount, where it counts up from 0) — an ease-out
 * tween via requestAnimationFrame, not a CSS transition, since the
 * in-between numbers themselves need to render. Skips the animation
 * entirely under prefers-reduced-motion. */
export function CountUpNumber({
  value,
  duration = 700,
  formatter,
}: {
  value: number;
  duration?: number;
  formatter?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;

    const prefersReduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || from === to) {
      setDisplay(to);
      return;
    }

    const start = performance.now();
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const rounded = Math.round(display);
  return <>{formatter ? formatter(rounded) : rounded}</>;
}
