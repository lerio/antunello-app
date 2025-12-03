import { Skeleton } from "@/components/ui/skeleton"

type SummarySkeletonProps = {
  readonly collapsed?: boolean;
  readonly yearView?: boolean;
}

export function SummarySkeleton({ collapsed = false, yearView = false }: SummarySkeletonProps) {
  if (yearView) {
    // Year view - show both Totals and Categories sections
    return (
      <div className="space-y-4 sm:space-y-6 py-2 sm:py-6">
        {/* Totals Section (collapsed) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-5" />
          </div>
        </div>

        {/* Category Breakdown Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm p-4 sm:p-6">
          {/* Header */}
          <Skeleton className="h-6 w-48 mb-3 sm:mb-4" />

          {/* Table header */}
          <div className="flex justify-between items-center border-b border-border pb-2 mb-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>

          {/* Category rows */}
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                <div className="flex items-center gap-2">
                  <Skeleton variant="circle" className="h-4 w-4 flex-shrink-0" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (collapsed) {
    // Collapsed state - just header row with title and icon
    // Wrapped in same container as actual component
    return (
      <div className="space-y-4 sm:space-y-6 py-2 sm:py-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-5" />
          </div>
        </div>
      </div>
    )
  }

  // Expanded state - full summary with rows
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm p-6 mb-8">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
      </div>

      {/* Rows */}
      <div className="mt-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Skeleton variant="circle" className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
