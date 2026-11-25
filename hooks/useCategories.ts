import { useCallback, useMemo } from "react"
import useSWR from "swr"
import { createClient } from "@/utils/supabase/client"
import {
  mergeCategories,
  registerCustomCategoryIcons,
  type CategoryEntry,
  type CustomCategory,
} from "@/utils/custom-categories"

const CUSTOM_CATEGORIES_KEY = "custom_categories"

const fetcher = async () => {
  const supabase = createClient()
  const { data, error } = await supabase.from("custom_categories").select("*").order("name")
  if (error) throw error
  return data as CustomCategory[]
}

/**
 * The values for a new custom category; `parent_category` omitted means a main
 * category. `type` is the category's own, or for a subcategory its parent's.
 */
export type NewCustomCategory = {
  name: string
  type: "income" | "expense"
  parent_category?: string
  icon?: string
}

/**
 * The user's custom category rows, and the side effect of making their icons
 * visible to the icon maps. Components that only render a category icon
 * (rather than list categories) call this, so they re-render once custom icons
 * arrive without paying for the merged lists.
 */
export function useCustomCategories() {
  const { data, error, isLoading, mutate } = useSWR(CUSTOM_CATEGORIES_KEY, fetcher)
  const custom = useMemo(() => {
    const rows = data ?? []
    // Done while rendering, before any child reads the icon maps in the same pass.
    registerCustomCategoryIcons(rows)
    return rows
  }, [data])
  return { custom, error, isLoading, mutate }
}

/**
 * Built-in categories merged with the user's custom ones.
 *
 * Use this instead of the constants in `types/database.ts` wherever a list of
 * categories is shown or validated, so custom categories appear everywhere.
 * Until the custom rows load, it returns the built-in categories alone.
 */
export function useCategories() {
  const { custom, error, isLoading, mutate } = useCustomCategories()

  const categories: CategoryEntry[] = useMemo(() => mergeCategories(custom), [custom])
  // Names can repeat across types, so these are by name: the union over same-named categories.
  const mainCategories = useMemo(() => [...new Set(categories.map((cat) => cat.category))], [categories])
  const subCategories = useMemo(() => {
    const byName: Record<string, string[]> = {}
    for (const cat of categories) {
      byName[cat.category] = [...new Set([...(byName[cat.category] ?? []), ...cat.subcategories])]
    }
    return byName
  }, [categories])

  /** The subcategories of the main category with this name and type. */
  const subCategoriesFor = useCallback(
    (category: string, type: "income" | "expense") =>
      categories.find((cat) => cat.category === category && cat.type === type)?.subcategories ?? [],
    [categories],
  )

  /** Whether a main category with this name exists with this type. */
  const isCategoryOfType = useCallback(
    (category: string, type: "income" | "expense") =>
      categories.some((cat) => cat.category === category && cat.type === type),
    [categories],
  )

  const getType = useCallback(
    (category: string): "income" | "expense" =>
      categories.find((cat) => cat.category === category)?.type ?? "expense",
    [categories],
  )

  const addCategory = useCallback(
    async (values: NewCustomCategory) => {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error("User not authenticated")

      const isSub = values.parent_category !== undefined
      const { error: insertError } = await supabase.from("custom_categories").insert({
        user_id: userData.user.id,
        name: values.name,
        parent_category: values.parent_category ?? null,
        type: values.type,
        icon: values.icon || null,
      })
      if (insertError) throw insertError
      await mutate()
    },
    [mutate],
  )

  return {
    categories,
    mainCategories,
    subCategories,
    subCategoriesFor,
    isCategoryOfType,
    getType,
    addCategory,
    customCategories: custom,
    error,
    isLoading,
  }
}
