"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  readonly pullDistance: number;
  readonly isRefreshing: boolean;
  readonly threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const isVisible = pullDistance > 0 || isRefreshing;

  if (!isVisible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[70] flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${Math.min(pullDistance * 0.5, 60)}px)`,
        transition: isRefreshing ? 'transform 0.3s ease-out' : 'none',
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg border border-gray-200 dark:border-gray-700">
        <RefreshCw
          size={24}
          className={cn(
            "text-gray-600 dark:text-gray-300",
            isRefreshing && "animate-spin"
          )}
          style={{
            transform: !isRefreshing ? `rotate(${progress * 360}deg)` : undefined,
            transition: !isRefreshing ? 'transform 0.1s linear' : undefined,
          }}
        />
      </div>
    </div>
  );
}
