"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
// Checking imports in other files... app/layout.tsx used "clsx" or custom?
// Actually I don't see `cn` imported in FloatingButton. It uses template literals.
// "className={`fixed ... ${className}`}"
// I will stick to template literals to be safe.

interface PendingTransactionsButtonProps {
    readonly count: number;
    readonly onClick: () => void;
    readonly bottomOffsetClass?: string;
    readonly className?: string;
}

export function PendingTransactionsButton({
    count,
    onClick,
    bottomOffsetClass = "bottom-20",
    className = ""
}: PendingTransactionsButtonProps) {
    if (count === 0) return null;

    return (
        <button
            onClick={onClick}
            className={`fixed ${bottomOffsetClass} right-8 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors z-[60] animate-in slide-in-from-bottom-5 duration-300 border-2 border-white dark:border-gray-800 ${className}`}
            aria-label={`${count} New Transactions`}
        >
            <div className="relative">
                <Bell size={28} />
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full border-2 border-white dark:border-gray-800">
                    {count}
                </span>
            </div>
        </button>
    );
}
