"use client";

import React, { createContext, useState, useEffect, ReactNode } from "react";

interface PrivacyContextType {
  privacyMode: boolean;
  togglePrivacyMode: () => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacyMode, setPrivacyMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("privacy-mode");
    if (stored !== null) {
      setPrivacyMode(stored === "true");
    }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("privacy-mode", String(privacyMode));
    }
  }, [privacyMode, mounted]);

  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => !prev);
  };

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export { PrivacyContext };
