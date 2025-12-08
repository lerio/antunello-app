"use client";

import { useContext } from "react";
import { PrivacyContext } from "@/components/layout/privacy-provider";

export function usePrivacyMode() {
  const context = useContext(PrivacyContext);

  if (context === undefined) {
    throw new Error("usePrivacyMode must be used within a PrivacyProvider");
  }

  return context;
}
