import React from "react";

interface PrivacyBlurProps {
  children: React.ReactNode;
  blur?: boolean;
}

export function PrivacyBlur({ children, blur = false }: PrivacyBlurProps) {
  if (!blur) {
    return <>{children}</>;
  }

  return (
    <span
      className="select-none"
      style={{
        filter: "blur(6px)",
        WebkitFilter: "blur(6px)",
      }}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
