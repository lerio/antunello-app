"use client";

import { useContext } from "react";
import { PrivacyContext } from "@/components/layout/privacy-provider";

/**
 * Hook to access the current privacy mode state.
 *
 * Reads the `PrivacyContext` provided by `PrivacyProvider`. When privacy mode
 * is active, sensitive financial figures should be masked or hidden from the UI.
 *
 * @returns The privacy context value (contains whether privacy mode is enabled
 *          and a toggle function).
 *
 * @throws {Error} If called outside of a `PrivacyProvider`.
 */
export function usePrivacyMode() {
  const context = useContext(PrivacyContext);

  if (context === undefined) {
    throw new Error("usePrivacyMode must be used within a PrivacyProvider");
  }

  return context;
}
