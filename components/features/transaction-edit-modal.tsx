import { useState } from 'react'
import { Transaction } from '@/types/database'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <div className="w-full bg-white" style={{ fontFamily: 'Inter, sans-serif' }}>
      <TransactionFormModal initialData={transaction} onSubmit={onSubmit} />
      
      {/* Delete Section */}
      <div className="px-6 md:px-8 lg:px-12 pb-6 md:pb-8 lg:pb-12">
        <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-100 text-red-600 rounded-xl">
              <AlertTriangle size={20} />
            </div>
            
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-2">Danger Zone</h3>
              <p className="text-sm text-red-800 mb-4">
                Once you delete this transaction, it cannot be recovered. This action is permanent.
              </p>
              
              {!showDeleteConfirm ? (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete Transaction
                </Button>
              ) : (
                <div className="flex gap-3">
                  <Button
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Confirm Delete
                  </Button>
                  <Button
                    onClick={() => setShowDeleteConfirm(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}