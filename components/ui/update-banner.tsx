"use client";

import { RefreshCw, X } from "lucide-react";
import { Button } from "./button";

interface UpdateBannerProps {
  readonly updateCount: number;
  readonly onRefresh: () => void;
  readonly onDismiss: () => void;
}

export function UpdateBanner({
  updateCount,
  onRefresh,
  onDismiss,
}: UpdateBannerProps) {
  return (
    <div className="sticky top-0 z-[60] bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 animate-in slide-in-from-top duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <RefreshCw
              size={18}
              className="text-blue-600 dark:text-blue-400 flex-shrink-0"
            />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {updateCount} {updateCount === 1 ? "new transaction" : "new transactions"} available
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={onRefresh}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Refresh
            </Button>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
              aria-label="Dismiss update notification"
            >
              <X size={18} className="text-blue-600 dark:text-blue-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
