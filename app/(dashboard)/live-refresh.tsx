"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// The worker does the slow work out of band, so pages re-render on a short interval to show its progress.
const EVERY_MS = 4000;

// Rendered by a page while it has work in flight (e.g. drafts in the receipt check). Gives up after forMs
// so a job that failed for good doesn't keep a forgotten tab refreshing forever.
export function LiveRefresh({ forMs = 180_000 }: { forMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const until = Date.now() + forMs;
    const t = setInterval(() => (Date.now() < until ? router.refresh() : clearInterval(t)), EVERY_MS);
    return () => clearInterval(t);
  }, [router, forMs]);
  return null;
}

// For buttons that start a job: keep the page fresh for ms, then call onDone.
export function useRefreshFor() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);
  return useCallback(
    (ms: number, onDone?: () => void) => {
      clearInterval(timer.current);
      const until = Date.now() + ms;
      timer.current = setInterval(() => {
        router.refresh();
        if (Date.now() >= until) {
          clearInterval(timer.current);
          onDone?.();
        }
      }, EVERY_MS);
    },
    [router],
  );
}
