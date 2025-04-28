import { useState } from 'react'
import { MAIN_CATEGORIES, SUB_CATEGORIES, Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'
import { formatDateTimeLocal, parseDateTime } from '@/utils/date'

type TransactionFormProps = {
  onSubmit: (data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  initialData?: Transaction
}

export default function TransactionForm({ onSubmit, initialData }: TransactionFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [mainCategory, setMainCategory] = useState(initialData?.main_category || MAIN_CATEGORIES[0])
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) throw new Error('User not authenticated')
    
    const data = {
      user_id: user.id,
      amount: Number(formData.get('amount')),
      currency: formData.get('currency') as string,
      type: formData.get('type') as 'expense' | 'income',
      main_category: formData.get('main_category') as string,
      sub_category: formData.get('sub_category') as string,
      title: formData.get('title') as string,
      date: parseDateTime(formData.get('date') as string),
    }

    try {
      await onSubmit(data)
    } catch (error) {
      console.error('Form submission failed:', error)
    }
    
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Amount</label>
          <input
            type="number"
            name="amount"
            step="0.01"
            required
            defaultValue={initialData?.amount}
            className="w-full p-2 border rounded"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <select 
            name="currency"
            defaultValue={initialData?.currency || 'EUR'}
            className="w-full p-2 border rounded"
          >
            <option value="EUR">EUR</option>
            <option value="JPY">JPY</option>
            <option value="USD">USD</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select 
            name="type"
            defaultValue={initialData?.type || 'expense'}
            className="w-full p-2 border rounded"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Main Category</label>
          <select 
            name="main_category"
            value={mainCategory}
            onChange={(e) => setMainCategory(e.target.value)}
            className="w-full p-2 border rounded"
          >
            {MAIN_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Sub Category</label>
          <select 
            name="sub_category"
            defaultValue={initialData?.sub_category}
            className="w-full p-2 border rounded"
          >
            {SUB_CATEGORIES[mainCategory as keyof typeof SUB_CATEGORIES].map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="datetime-local"
            name="date"
            required
            defaultValue={initialData?.date ? formatDateTimeLocal(initialData.date) : formatDateTimeLocal(new Date().toISOString())}
            className="w-full p-2 border rounded"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          type="text"
          name="title"
          required
          defaultValue={initialData?.title}
          className="w-full p-2 border rounded"
        />
      </div>
      
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Saving...' : initialData ? 'Save Changes' : 'Add Transaction'}
      </button>
    </form>
  )
} 