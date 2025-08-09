export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Month Selector Skeleton */}
      <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-50 pt-6 pb-4 -mx-6 px-6">
        <div className="flex justify-center items-center mb-8">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
          <div className="w-48 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-6"></div>
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Summary Card Skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8 animate-pulse">
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
        </div>
        <div className="mt-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              </div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions Skeleton */}
      <div className="space-y-6">
        {[1, 2, 3].map((group) => (
          <div key={group} className="mb-6">
            {/* Date Header Skeleton */}
            <div className="sticky top-28 bg-gray-50 dark:bg-gray-900 z-40 py-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 -mx-6 px-6">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
            </div>
            
            {/* Transaction Cards Skeleton */}
            <div className="mt-4 space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between shadow-sm animate-pulse">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                    <div className="ml-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-1"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}