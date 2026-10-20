"use client";

import { useSyncExternalStore } from "react";

/** Matches the `lg` breakpoint the Home grid uses. */
const QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * Whether the viewport is desktop-sized.
 *
 * The server snapshot is `false`, so the first paint uses the mobile defaults
 * and the client corrects immediately after hydration without a mismatch.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
