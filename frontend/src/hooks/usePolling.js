import { useEffect, useRef } from 'react';

/**
 * Custom polling hook with document visibility management,
 * unmount cleanup, and overlap prevention.
 *
 * @param {() => Promise<void>} fn - Async function to execute on each poll tick
 * @param {number} intervalMs - Polling interval in milliseconds (default 3000)
 * @param {boolean} enabled - Whether polling is currently active
 */
export function usePolling(fn, intervalMs = 3000, enabled = true) {
  const timerRef = useRef(null);
  const isExecutingRef = useRef(false);
  const generationRef = useRef(0);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    const generation = ++generationRef.current;
    const isCurrent = () => enabled && generationRef.current === generation;

    const scheduleNext = (delay) => {
      if (!isCurrent()) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(run, delay);
    };

    const run = async () => {
      if (!isCurrent() || document.hidden) return;
      if (isExecutingRef.current) {
        scheduleNext(intervalMs);
        return;
      }

      isExecutingRef.current = true;
      try {
        await fnRef.current();
      } catch {
        // Background poll errors are handled by the polling callback.
      } finally {
        isExecutingRef.current = false;
        if (isCurrent()) scheduleNext(intervalMs);
      }
    };

    if (enabled) run();

    const onVisibilityChange = () => {
      if (!document.hidden && isCurrent()) {
        scheduleNext(100);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (generationRef.current === generation) generationRef.current += 1;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
