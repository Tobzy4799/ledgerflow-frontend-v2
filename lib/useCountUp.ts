"use client";

import { useEffect, useRef, useState } from "react";

/// Animates from 0 to `target` over `duration` ms, using an ease-out curve.
/// Starts only once `active` becomes true (e.g. when scrolled into view).
export function useCountUp(target: number, active: boolean, duration = 1200) {
  const [value, setValue] = useState(0);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!active || hasRun.current || !isFinite(target)) return;
    hasRun.current = true;

    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [active, target, duration]);

  return value;
}