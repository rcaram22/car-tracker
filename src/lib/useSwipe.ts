import { useRef, type MouseEvent, type TouchEvent } from 'react';

const MIN_DISTANCE = 40;

// Calls onSwipe(1) for a swipe to the left (next) and onSwipe(-1) for a swipe
// to the right (previous). Mostly-vertical gestures are left to page scroll.
export function useSwipe(onSwipe: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  return {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      swiped.current = false;
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || e.touches.length) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) {
        return;
      }
      swiped.current = true;
      onSwipe(dx < 0 ? 1 : -1);
    },
    // A swipe must not also count as a tap on whatever sits underneath.
    onClickCapture: (e: MouseEvent) => {
      if (!swiped.current) return;
      swiped.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
