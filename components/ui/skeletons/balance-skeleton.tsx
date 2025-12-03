import { Skeleton } from "@/components/ui/skeleton"

export function BalanceSkeleton() {
  return (
    <div className="space-y-2">
      {/* Fund category rows */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex justify-between items-center">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}
