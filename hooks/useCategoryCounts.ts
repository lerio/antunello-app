import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'
import { fetchAllBatches } from '@/utils/supabase/fetch-all'

/** Transaction counts per main category and per category/subcategory pair. */
export interface CategoryCounts {
  /** Number of transactions in each main category. */
  byCategory: Record<string, number>
  /** Number of transactions in each subcategory, keyed `${category}|${subcategory}`. */
  bySubcategory: Record<string, number>
}

/** Key used in `CategoryCounts.bySubcategory`. */
export const subcategoryKey = (category: string, subcategory: string) =>
  `${category}|${subcategory}`

const fetcher = async (): Promise<CategoryCounts> => {
  const supabase = createClient()

  const rows = await fetchAllBatches<{ main_category: string; sub_category: string | null }>(
    (from, to) =>
      supabase
        .from('transactions')
        .select('main_category, sub_category')
        .order('id')
        .range(from, to)
  )

  const byCategory: Record<string, number> = {}
  const bySubcategory: Record<string, number> = {}
  for (const row of rows) {
    byCategory[row.main_category] = (byCategory[row.main_category] ?? 0) + 1
    if (row.sub_category) {
      const key = subcategoryKey(row.main_category, row.sub_category)
      bySubcategory[key] = (bySubcategory[key] ?? 0) + 1
    }
  }
  return { byCategory, bySubcategory }
}

/**
 * How many transactions each category and subcategory has.
 *
 * @returns The counts (empty until loaded) and the loading flag.
 */
export function useCategoryCounts() {
  const { data, isLoading } = useSWR('category-counts', fetcher)
  return {
    byCategory: data?.byCategory ?? {},
    bySubcategory: data?.bySubcategory ?? {},
    isLoading,
  }
}
