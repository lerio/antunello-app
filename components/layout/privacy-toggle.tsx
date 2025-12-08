"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";

import { Button } from "@/components/ui/button";

export function PrivacyToggle() {
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={togglePrivacyMode}
      aria-label="Toggle privacy mode"
      title={privacyMode ? "Privacy mode: ON" : "Privacy mode: OFF"}
    >
      <Eye className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all data-[privacy=true]:rotate-90 data-[privacy=true]:scale-0" data-privacy={privacyMode} />
      <EyeOff className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all data-[privacy=true]:rotate-0 data-[privacy=true]:scale-100" data-privacy={privacyMode} />
      <span className="sr-only">
        {privacyMode ? "Disable privacy mode" : "Enable privacy mode"}
      </span>
    </Button>
  );
}
