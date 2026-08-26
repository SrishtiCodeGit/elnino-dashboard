"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** Drag-to-reposition for a floating panel. Position is top-left pixels
 * relative to the viewport; the returned handlers go on whatever element
 * should act as the drag handle (a header bar), not the whole panel, so
 * scrolling/clicking inside the panel body still works normally. */
export function useDraggable(initial: { x: number; y: number }) {
  const [pos, setPos] = useState(initial);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pos]
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const maxX = window.innerWidth - 80;
    const maxY = window.innerHeight - 60;
    setPos({
      x: Math.min(Math.max(0, dragState.current.origX + dx), maxX),
      y: Math.min(Math.max(0, dragState.current.origY + dy), maxY),
    });
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    dragState.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  return { pos, setPos, dragHandleProps: { onPointerDown, onPointerMove, onPointerUp } };
}
