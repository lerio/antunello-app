import useSWR, { mutate as globalMutate } from 'swr'
import { createClient } from '@/utils/supabase/client'
import { Budget } from '@/types/database'
import { useTransactionsOptimized } from '@/hooks/useTransactionsOptimized'
import { useMemo } from 'react'

// Fetcher for budgets
const budgetsFetcher = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .order('category')

    if (error) throw error
    return data as Budget[]
}

export function useBudgets() {
    const { data, error, isLoading, mutate } = useSWR('budgets', budgetsFetcher)
    return { budgets: data || [], error, isLoading, mutate }
}

export function useBudgetProgress() {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    // Reuse existing hook to get current month transactions
    // This ensures we share the cache and get real-time updates if useTransactionsOptimized handles them
    const { transactions, isLoading } = useTransactionsOptimized(currentYear, currentMonth)

    const spendingByCategory = useMemo(() => {
        const spending: Record<string, number> = {}

        transactions.forEach(t => {
            // Only count expenses that are not hidden and not money transfers
            if (
                t.type === 'expense' &&
                !t.hide_from_totals &&
                !t.is_money_transfer
            ) {
                // Use EUR amount if available, otherwise original amount (assuming EUR base or simple sum)
                // logic should align with other parts of the app which seem to rely on eur_amount for totals
                const amount = t.eur_amount || t.amount
                spending[t.main_category] = (spending[t.main_category] || 0) + amount
            }
        })

        return spending
    }, [transactions])

    return { spendingByCategory, isLoading }
}

export function useBudgetMutations() {
    const supabase = createClient()

    const addBudget = async (budget: Omit<Budget, 'id' | 'created_at' | 'updated_at'>) => {
        const { data, error } = await supabase
            .from('budgets')
            .insert([budget])
            .select()
            .single()

        if (error) throw error

        // Revalidate budgets cache
        globalMutate('budgets')
        return data
    }

    const updateBudget = async (id: string, updates: Partial<Budget>) => {
        const { data, error } = await supabase
            .from('budgets')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        // Revalidate budgets cache
        globalMutate('budgets')
        return data
    }

    const deleteBudget = async (id: string) => {
        const { error } = await supabase
            .from('budgets')
            .delete()
            .eq('id', id)

        if (error) throw error

        // Revalidate budgets cache
        globalMutate('budgets')
    }

    return {
        addBudget,
        updateBudget,
        deleteBudget
    }
}
