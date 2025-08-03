import { useState, useCallback, useMemo } from 'react'
import { MAIN_CATEGORIES, SUB_CATEGORIES, Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'
import { formatDateTimeLocal, parseDateTime } from '@/utils/date'
import { Calendar, MinusCircle, PlusCircle } from 'lucide-react'

type TransactionFormModalProps = {
  onSubmit: (data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  initialData?: Transaction
}

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD', symbol: '$' },
  { value: 'EUR', label: 'EUR', symbol: '€' },
  { value: 'JPY', label: 'JPY', symbol: '¥' },
]

export default function TransactionFormModal({ onSubmit, initialData }: TransactionFormModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [mainCategory, setMainCategory] = useState(initialData?.main_category || MAIN_CATEGORIES[0])
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>(initialData?.type || 'expense')
  const [selectedCurrency, setSelectedCurrency] = useState(initialData?.currency || 'EUR')
  
  const subCategories = useMemo(() => {
    return SUB_CATEGORIES[mainCategory as keyof typeof SUB_CATEGORIES] || []
  }, [mainCategory])

  const defaultDate = useMemo(() => {
    return initialData?.date ? formatDateTimeLocal(initialData.date) : formatDateTimeLocal(new Date().toISOString())
  }, [initialData?.date])

  const currencySymbol = useMemo(() => {
    return CURRENCY_OPTIONS.find(c => c.value === selectedCurrency)?.symbol || '€'
  }, [selectedCurrency])

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const formData = new FormData(e.currentTarget)
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) throw new Error('User not authenticated')
      
      const data = {
        user_id: user.id,
        amount: Number(formData.get('amount')),
        currency: selectedCurrency,
        type: transactionType,
        main_category: formData.get('main_category') as string,
        sub_category: formData.get('sub_category') as string,
        title: formData.get('title') as string,
        date: parseDateTime(formData.get('date') as string),
      }

      await onSubmit(data)
    } catch (error) {
      console.error('Form submission failed:', error)
    } finally {
      setIsLoading(false)
    }
  }, [onSubmit, transactionType, selectedCurrency])

  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setMainCategory(e.target.value)
  }, [])

  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCurrency(e.target.value)
  }, [])

  return (
    <div className="w-full bg-white p-6 md:p-8 lg:p-12 font-inter">
      <h1 className="text-4xl font-bold text-gray-800 mb-12">
        {initialData ? 'Edit Transaction' : 'Add Transaction'}
      </h1>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          
          {/* Amount with Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="amount">
              Amount
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                {currencySymbol}
              </span>
              <input
                className="pl-10 pr-20 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm h-12"
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                required
                defaultValue={initialData?.amount}
                autoComplete="off"
              />
              <div className="absolute inset-y-0 right-0 flex items-center">
                <select
                  className="h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 text-sm rounded-md form-select"
                  id="currency"
                  name="currency"
                  value={selectedCurrency}
                  onChange={handleCurrencyChange}
                  aria-label="Currency selection"
                >
                  {CURRENCY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Transaction Type */}
          <div>
            <div className="block text-sm font-medium text-gray-700 mb-2">Type</div>
            <div className="flex space-x-4">
              <button
                className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center font-medium border-2 transition-all ${
                  transactionType === 'expense'
                    ? 'bg-red-100 text-red-700 border-red-500'
                    : 'bg-red-50 text-red-700 border-gray-200 hover:bg-red-100 hover:border-red-400'
                }`}
                type="button"
                onClick={() => setTransactionType('expense')}
              >
                <MinusCircle size={20} className="mr-2" />
                Expense
              </button>
              <button
                className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center font-medium border-2 transition-all ${
                  transactionType === 'income'
                    ? 'bg-green-100 text-green-700 border-green-500'
                    : 'bg-green-50 text-green-700 border-gray-200 hover:bg-green-100 hover:border-green-400'
                }`}
                type="button"
                onClick={() => setTransactionType('income')}
              >
                <PlusCircle size={20} className="mr-2" />
                Income
              </button>
            </div>
          </div>

          {/* Main Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="main-category">
              Main Category
            </label>
            <select
              className="form-select block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm rounded-lg shadow-sm"
              id="main-category"
              name="main_category"
              value={mainCategory}
              onChange={handleCategoryChange}
            >
              {MAIN_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Sub Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="sub-category">
              Sub Category
            </label>
            <select
              className="form-select block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm rounded-lg shadow-sm"
              id="sub-category"
              name="sub_category"
              defaultValue={initialData?.sub_category}
              key={mainCategory}
            >
              <option value="">Select sub category</option>
              {subCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="title">
              Title
            </label>
            <input
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm h-12 px-4"
              id="title"
              name="title"
              placeholder="e.g., Monthly groceries at the supermarket"
              type="text"
              required
              defaultValue={initialData?.title}
              autoComplete="off"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="date">
              Date
            </label>
            <div className="relative">
              <input
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm h-12 pl-4 pr-10"
                id="date"
                name="date"
                type="datetime-local"
                required
                defaultValue={defaultDate}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Calendar size={20} className="text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-12">
          <button
            className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-lg text-lg font-semibold text-white transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              transactionType === 'expense'
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                {initialData ? 'Saving Changes...' : 'Adding Transaction...'}
              </div>
            ) : (
              initialData ? 'Save Changes' : `Add ${transactionType === 'expense' ? 'Expense' : 'Income'}`
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        .form-select {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 0.5rem center;
          background-size: 1.5em 1.5em;
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
        }
      `}</style>
    </div>
  )
}