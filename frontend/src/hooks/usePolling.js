import { useEffect, useRef, useCallback } from 'react';

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
  const isMountedRef = useRef(true);
  const isExecutingRef = useRef(false);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const scheduleNext = useCallback(
    (delay) => {
      if (!isMountedRef.current || !enabled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (!isMountedRef.current || !enabled) return;
        if (document.hidden) {
          // Skip execution while tab is hidden; will resume on visibility change
          return;
        }
        if (isExecutingRef.current) {
          scheduleNext(intervalMs);
          return;
        }

        isExecutingRef.current = true;
        try {
          await fnRef.current();
        } catch {
          // Errors handled within fn
        } finally {
          isExecutingRef.current = false;
          if (isMountedRef.current && enabled) {
            scheduleNext(intervalMs);
          }
        }
      }, delay);
    },
    [enabled, intervalMs],
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      // Immediate initial tick
      (async () => {
        if (isExecutingRef.current) return;
        isExecutingRef.current = true;
        try {
          await fnRef.current();
        } catch {
          // Errors handled inside fn
        } finally {
          isExecutingRef.current = false;
          scheduleNext(intervalMs);
        }
      })();
    }

    const onVisibilityChange = () => {
      if (!document.hidden && enabled && isMountedRef.current) {
        scheduleNext(100);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, intervalMs, scheduleNext]);
}
