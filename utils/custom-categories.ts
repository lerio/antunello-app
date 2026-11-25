import { createElement, type ComponentType } from "react"
import { DynamicIcon, type IconName } from "lucide-react/dynamic"
import { CATEGORIES_WITH_TYPES } from "@/types/database"
import { CATEGORY_ICONS as UI_CATEGORY_ICONS } from "@/utils/categories"
import { CATEGORY_ICONS as FORM_CATEGORY_ICONS } from "@/types/category-icons"
import type { LucideIcon } from "lucide-react"

/** A user-defined category row (`custom_categories`); see migrations/027. */
export type CustomCategory = {
  id: string
  user_id: string
  name: string
  /** Null for a main category; otherwise the name of its (built-in or custom) main category. */
  parent_category: string | null
  /** A main category's own type; a subcategory stores its parent's. Null only on rows from before migration 028. */
  type: "income" | "expense" | null
  /** A Lucide component name, e.g. "Utensils". */
  icon: string | null
  created_at: string
  updated_at: string
}

/** A main category with its subcategories and type, built-in or custom. */
export type CategoryEntry = {
  category: string
  subcategories: string[]
  type: "income" | "expense"
  isCustom: boolean
}

const byName = (a: string, b: string) => a.localeCompare(b)

/**
 * The built-in categories plus the user's own.
 *
 * Custom main categories follow the built-in ones, alphabetically; custom
 * subcategories are added to their parent's list, alphabetically after the
 * built-in subcategories. Two main categories may share a name when their types
 * differ, so a subcategory attaches to the parent with its name *and* type. A
 * subcategory whose parent no longer exists is dropped.
 */
export function mergeCategories(custom: readonly CustomCategory[]): CategoryEntry[] {
  const entries: CategoryEntry[] = CATEGORIES_WITH_TYPES.map((cat) => ({
    category: cat.category,
    subcategories: [...cat.subcategories],
    type: cat.type,
    isCustom: false,
  }))

  const customMains = custom
    .filter((row) => row.parent_category === null && row.type !== null)
    .sort((a, b) => byName(a.name, b.name))
  for (const row of customMains) {
    entries.push({ category: row.name, subcategories: [], type: row.type!, isCustom: true })
  }

  const customSubs = custom
    .filter((row) => row.parent_category !== null)
    .sort((a, b) => byName(a.name, b.name))
  for (const row of customSubs) {
    // A row without a type predates migration 028; it can only match by name.
    entries
      .find((entry) => entry.category === row.parent_category && (row.type === null || entry.type === row.type))
      ?.subcategories.push(row.name)
  }

  return entries
}

/** `"Gamepad2"` -> `"gamepad-2"`, the form `DynamicIcon` expects. */
const toIconName = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .toLowerCase()

const iconCache = new Map<string, ComponentType<{ className?: string; size?: number | string }>>()

/**
 * A component rendering the named Lucide icon, loaded on demand so custom icons
 * do not pull the whole set into the bundle. One component per name, cached, so
 * React sees a stable type across renders.
 */
export function customIconComponent(name: string) {
  let component = iconCache.get(name)
  if (!component) {
    const iconName = toIconName(name) as IconName
    component = function CustomCategoryIcon(props) {
      return createElement(DynamicIcon, { name: iconName, ...props })
    }
    component.displayName = name
    iconCache.set(name, component)
  }
  return component
}

const registered = new Set<string>()

/**
 * Make custom main categories' icons visible to the code that looks icons up by
 * name in the two built-in maps (`utils/categories` and `types/category-icons`),
 * so no caller has to know whether a category is built-in. Built-in entries are
 * never overridden. Idempotent: it replaces what a previous call registered.
 */
export function registerCustomCategoryIcons(custom: readonly CustomCategory[]) {
  for (const name of registered) {
    delete UI_CATEGORY_ICONS[name]
    delete FORM_CATEGORY_ICONS[name]
  }
  registered.clear()

  for (const row of custom) {
    if (row.parent_category !== null || !row.icon) continue
    if (row.name in UI_CATEGORY_ICONS) continue
    const component = customIconComponent(row.icon)
    UI_CATEGORY_ICONS[row.name] = component as React.ComponentType
    FORM_CATEGORY_ICONS[row.name] = component as unknown as LucideIcon
    registered.add(row.name)
  }
}
