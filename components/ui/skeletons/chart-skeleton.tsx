import { Skeleton } from "@/components/ui/skeleton";

export function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm p-4 sm:p-6">
      {/* Header */}
      <div className="flex justify-start items-center mb-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-12" />
          ))}
        </div>
      </div>

      {/* Chart area - responsive height */}
      <Skeleton className="h-[250px] md:h-[350px] w-full mt-6" />
    </div>
  );
}
