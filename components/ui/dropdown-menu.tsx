"use client";

import { useState, useRef, useEffect, ReactNode, createContext, useContext, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  readonly trigger: ReactNode;
  readonly children: ReactNode;
  readonly align?: "left" | "right";
  readonly className?: string;
}

interface DropdownMenuItemProps {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly className?: string;
}

const DropdownContext = createContext<{
  close: () => void;
} | null>(null);

export function DropdownMenu({
  trigger,
  children,
  align = "right",
  className
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen]);

  const close = useCallback(() => setIsOpen(false), []);
  const contextValue = useMemo(() => ({ close }), [close]);

  return (
    <div className={cn("relative inline-block text-left", className)}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center w-full"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {trigger}
      </button>

      {isOpen && (
        <DropdownContext.Provider value={contextValue}>
          <div
            ref={menuRef}
            className={cn(
              "absolute z-[70] mt-2 w-56 origin-top-right rounded-md bg-popover text-popover-foreground shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-border",
              align === "left" ? "left-0" : "right-0",
              // Mobile responsive positioning
              "sm:w-56 w-48 max-w-xs"
            )}
            role="menu"
            aria-orientation="vertical"
          >
            <div className="py-1" role="none">
              {children}
            </div>
          </div>
        </DropdownContext.Provider>
      )}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  className
}: DropdownMenuItemProps) {
  const context = useContext(DropdownContext);

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    context?.close();
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-left px-4 py-3 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors active:bg-accent/80 touch-manipulation",
        // Better mobile touch targets
        "min-h-[44px] flex items-center",
        className
      )}
      role="menuitem"
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}