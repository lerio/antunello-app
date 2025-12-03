import { Skeleton } from "@/components/ui/skeleton"

export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 border rounded-lg p-4 flex items-center justify-between"
        >
          {/* Icon + Category */}
          <div className="flex items-center gap-3 flex-1">
            <Skeleton variant="circle" className="w-10 h-10 flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>

          {/* Amount */}
          <div className="text-right space-y-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}
