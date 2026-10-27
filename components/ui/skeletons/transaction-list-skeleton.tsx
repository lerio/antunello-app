import { Skeleton } from "@/components/ui/skeleton"

export function TransactionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white dark:bg-gray-800">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex min-h-16 items-center justify-between gap-3 p-4 ${
            i > 0 ? "border-t border-border" : ""
          }`}
        >
          <div className="flex flex-1 items-center gap-3">
            <Skeleton variant="circle" className="h-10 w-10 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}
