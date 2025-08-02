import { useState, useCallback, useMemo } from 'react'
import { MAIN_CATEGORIES, SUB_CATEGORIES, Transaction } from '@/types/database'
import { createClient } from '@/utils/supabase/client'
import { formatDateTimeLocal, parseDateTime } from '@/utils/date'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { 
  Euro, 
  DollarSign, 
  ArrowUpCircle, 
  ArrowDownCircle,
  Calendar,
  Hash,
  Type,
  ChevronDown
} from 'lucide-react'

type TransactionFormProps = {
  onSubmit: (data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  initialData?: Transaction
}

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR', icon: Euro },
  { value: 'USD', label: 'USD', icon: DollarSign },
  { value: 'JPY', label: 'JPY', icon: Hash },
]

export default function TransactionFormModern({ onSubmit, initialData }: TransactionFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [mainCategory, setMainCategory] = useState(initialData?.main_category || MAIN_CATEGORIES[0])
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>(initialData?.type || 'expense')
  
  const subCategories = useMemo(() => {
    return SUB_CATEGORIES[mainCategory as keyof typeof SUB_CATEGORIES] || []
  }, [mainCategory])

  const defaultDate = useMemo(() => {
    return initialData?.date ? formatDateTimeLocal(initialData.date) : formatDateTimeLocal(new Date().toISOString())
  }, [initialData?.date])

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
        currency: formData.get('currency') as string,
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
  }, [onSubmit, transactionType])

  const handleCategoryChange = useCallback((value: string) => {
    setMainCategory(value)
  }, [])

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Transaction Type Toggle */}
        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <button
            type="button"
            onClick={() => setTransactionType('expense')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              transactionType === 'expense'
                ? 'bg-red-500 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <ArrowDownCircle size={20} />
            Expense
          </button>
          <button
            type="button"
            onClick={() => setTransactionType('income')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              transactionType === 'income'
                ? 'bg-green-500 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <ArrowUpCircle size={20} />
            Income
          </button>
        </div>

        {/* Amount and Currency Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="amount" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Amount
            </Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                id="amount"
                type="number"
                name="amount"
                step="0.01"
                required
                defaultValue={initialData?.amount}
                className="pl-10 h-12 text-lg font-medium border-2 rounded-xl focus:border-blue-500 transition-colors"
                placeholder="0.00"
                autoComplete="off"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Currency</Label>
            <Select name="currency" defaultValue={initialData?.currency || 'EUR'}>
              <SelectTrigger className="h-12 border-2 rounded-xl focus:border-blue-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map(option => {
                  const IconComponent = option.icon
                  return (
                    <SelectItem key={option.value} value={option.value} className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <IconComponent size={16} />
                        {option.label}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Title Field */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Title
          </Label>
          <div className="relative">
            <Type className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              id="title"
              type="text"
              name="title"
              required
              defaultValue={initialData?.title}
              className="pl-10 h-12 text-lg border-2 rounded-xl focus:border-blue-500 transition-colors"
              placeholder="e.g., Grocery shopping, Salary, Coffee..."
              autoComplete="off"
            />
          </div>
        </div>

        {/* Categories Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Main Category</Label>
            <Select name="main_category" value={mainCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger className="h-12 border-2 rounded-xl focus:border-blue-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {MAIN_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sub Category</Label>
            <Select name="sub_category" defaultValue={initialData?.sub_category} key={mainCategory}>
              <SelectTrigger className="h-12 border-2 rounded-xl focus:border-blue-500">
                <SelectValue placeholder="Select sub category" />
              </SelectTrigger>
              <SelectContent>
                {subCategories.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Field */}
        <div className="space-y-2">
          <Label htmlFor="date" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Date & Time
          </Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              id="date"
              type="datetime-local"
              name="date"
              required
              defaultValue={defaultDate}
              className="pl-10 h-12 border-2 rounded-xl focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <Button 
            type="submit" 
            disabled={isLoading} 
            className={`w-full h-14 text-lg font-semibold rounded-xl transition-all duration-200 ${
              transactionType === 'expense'
                ? 'bg-red-500 hover:bg-red-600 focus:bg-red-600'
                : 'bg-green-500 hover:bg-green-600 focus:bg-green-600'
            } text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5`}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </div>
            ) : (
              initialData ? 'Save Changes' : `Add ${transactionType === 'expense' ? 'Expense' : 'Income'}`
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}