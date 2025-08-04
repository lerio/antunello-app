import { useState } from 'react'
import { Transaction } from '@/types/database'
import { Trash2 } from 'lucide-react'
import TransactionFormModal from './transaction-form-modal'

type TransactionEditModalProps = {
  transaction: Transaction
  onSubmit: (data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onDelete: (transaction: Transaction) => Promise<void>
}

export default function TransactionEditModal({ 
  transaction, 
  onSubmit, 
  onDelete 
}: TransactionEditModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDelete = async () => {
    await onDelete(transaction)
    setShowDeleteConfirm(false)
  }

  return (
    <div className="w-full bg-white dark:bg-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
      <TransactionFormModal initialData={transaction} onSubmit={onSubmit} disabled={showDeleteConfirm} />
      
      {/* Delete Section */}
      <div className="px-4 pt-0 pb-4 sm:px-6 sm:pt-0 sm:pb-6 md:px-8 md:pt-0 md:pb-8 lg:px-12 lg:pt-0 lg:pb-12">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 focus:ring-red-500 dark:focus:ring-red-400"
          >
            <Trash2 size={20} className="mr-2 flex-shrink-0" />
            Delete Transaction
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              className="flex-1 flex items-center justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 focus:ring-red-500 dark:focus:ring-red-400"
            >
              <Trash2 size={20} className="mr-2 flex-shrink-0" />
              Confirm
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 flex items-center justify-center py-4 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg text-lg font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-gray-500 dark:focus:ring-gray-400"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}