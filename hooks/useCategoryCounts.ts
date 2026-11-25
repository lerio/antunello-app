import useSWR from 'swr'
import { createClient } from '@/utils/supabase/client'
import { fetchAllBatches } from '@/utils/supabase/fetch-all'

/** Transaction counts per main category and per category/subcategory pair. */
export interface CategoryCounts {
  /** Number of transactions in each main category. */
  byCategory: Record<string, number>
  /** Number of transactions in each subcategory, keyed `${category}|${subcategory}`. */
  bySubcategory: Record<string, number>
  /**
   * The same counts split by transaction type, keyed `${type}|${category}`, for
   * telling apart two main categories that share a name across types.
   */
  byCategoryAndType: Record<string, number>
  /** Keyed `${type}|${category}|${subcategory}`. */
  bySubcategoryAndType: Record<string, number>
}

/** Key used in `CategoryCounts.bySubcategory`. */
export const subcategoryKey = (category: string, subcategory: string) =>
  `${category}|${subcategory}`

const fetcher = async (): Promise<CategoryCounts> => {
  const supabase = createClient()

  const rows = await fetchAllBatches<{ main_category: string; sub_category: string | null; type: string }>(
    (from, to) =>
      supabase
        .from('transactions')
        .select('main_category, sub_category, type')
        .order('id')
        .range(from, to)
  )

  const byCategory: Record<string, number> = {}
  const bySubcategory: Record<string, number> = {}
  const byCategoryAndType: Record<string, number> = {}
  const bySubcategoryAndType: Record<string, number> = {}
  for (const row of rows) {
    byCategory[row.main_category] = (byCategory[row.main_category] ?? 0) + 1
    const typedKey = `${row.type}|${row.main_category}`
    byCategoryAndType[typedKey] = (byCategoryAndType[typedKey] ?? 0) + 1
    if (row.sub_category) {
      const key = subcategoryKey(row.main_category, row.sub_category)
      bySubcategory[key] = (bySubcategory[key] ?? 0) + 1
      const typedSubKey = `${row.type}|${key}`
      bySubcategoryAndType[typedSubKey] = (bySubcategoryAndType[typedSubKey] ?? 0) + 1
    }
  }
  return { byCategory, bySubcategory, byCategoryAndType, bySubcategoryAndType }
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
    byCategoryAndType: data?.byCategoryAndType ?? {},
    bySubcategoryAndType: data?.bySubcategoryAndType ?? {},
    isLoading,
  }
}
