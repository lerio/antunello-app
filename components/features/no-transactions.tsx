import Image from 'next/image'

export default function NoTransactions() {
  return (
    <div className="w-full">
      <div className="text-center py-12">
        <div className="flex justify-center mb-6">
          <Image
            src="/empty-box.png"
            alt="No transactions found"
            width={200}
            height={200}
            priority
          />
        </div>
        <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
          No transactions found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          There are no transactions for the selected month
        </p>
      </div>
    </div>
  )
} 