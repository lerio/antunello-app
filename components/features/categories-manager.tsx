"use client";

import toast from "react-hot-toast";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageStack } from "@/components/layout/page-container";
import { CATEGORIES_WITH_TYPES } from "@/types/database";
import { getCategoryIcon } from "@/types/category-icons";
import { cn } from "@/lib/utils";
import { subcategoryKey, useCategoryCounts } from "@/hooks/useCategoryCounts";

/** Pill with a transaction count; shows nothing while the counts load. */
function CountBadge({ count }: { count: number | undefined }) {
  if (count === undefined) return null;
  return (
    <span
      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs tabular-nums text-gray-600 dark:bg-gray-700 dark:text-gray-400"
      title={`${count} transaction${count === 1 ? "" : "s"}`}
    >
      {count}
    </span>
  );
}

const iconButtonClass = "h-8 w-8 shrink-0 text-muted-foreground";

/**
 * Editing categories means migrating the transactions that use them, which is
 * not designed yet. Until it is, every action is a placeholder.
 */
const notAvailable = () =>
  toast("Editing categories isn't available yet.", { id: "categories-wip" });

/**
 * Settings → Categories: the main categories with their subcategories, and the
 * add / edit / delete controls. The controls are UI only for now.
 */
type Category = (typeof CATEGORIES_WITH_TYPES)[number];

/** Display order of the sections; "Money Transfer" is the only movement. */
const SECTIONS: { title: string; match: (cat: Category) => boolean }[] = [
  { title: "Income", match: (cat) => cat.type === "income" },
  {
    title: "Expense",
    match: (cat) => cat.type === "expense" && cat.category !== "Money Transfer",
  },
  { title: "Movement", match: (cat) => cat.category === "Money Transfer" },
];

export default function CategoriesManager() {
  const { byCategory, bySubcategory, isLoading } = useCategoryCounts();
  const countOf = (counts: Record<string, number>, key: string) =>
    isLoading ? undefined : (counts[key] ?? 0);
  return (
    <PageStack>
      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h3 className="m-0 text-base font-semibold text-muted-foreground">
            {section.title}
          </h3>
          <PageStack>
            {CATEGORIES_WITH_TYPES.filter(section.match).map((cat) => {
              const Icon = getCategoryIcon(cat.category);
              return (
                <Card key={cat.category}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {Icon && <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />}
                      <h3 className="m-0 text-lg font-semibold">{cat.category}</h3>
                      <CountBadge count={countOf(byCategory, cat.category)} />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        onClick={notAvailable}
                        size="icon"
                        variant="ghost"
                        title="Edit category"
                        className={cn(iconButtonClass, "hover:text-primary")}
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="sr-only">Edit {cat.category}</span>
                      </Button>
                      <Button
                        onClick={notAvailable}
                        size="icon"
                        variant="ghost"
                        title="Delete category"
                        className={cn(iconButtonClass, "hover:text-destructive")}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete {cat.category}</span>
                      </Button>
                    </div>
                  </div>
      
                  <ul className="mt-3 divide-y divide-border">
                    {cat.subcategories.map((sub) => (
                      <li key={sub} className="flex items-center justify-between gap-2 py-1">
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                        {sub}
                        <CountBadge
                          count={countOf(bySubcategory, subcategoryKey(cat.category, sub))}
                        />
                      </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            onClick={notAvailable}
                            size="icon"
                            variant="ghost"
                            title="Edit subcategory"
                            className={cn(iconButtonClass, "hover:text-primary")}
                          >
                            <Edit2 className="h-4 w-4" />
                            <span className="sr-only">Edit {sub}</span>
                          </Button>
                          <Button
                            onClick={notAvailable}
                            size="icon"
                            variant="ghost"
                            title="Delete subcategory"
                            className={cn(iconButtonClass, "hover:text-destructive")}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete {sub}</span>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
      
                  <Button
                    onClick={notAvailable}
                    variant="ghost"
                    size="sm"
                    className="mt-2 -ml-3 text-muted-foreground hover:text-primary"
                  >
                    <Plus className="h-4 w-4" />
                    Add subcategory
                  </Button>
                </Card>
                    );
            })}
          </PageStack>
        </section>
      ))}

      <div className="flex justify-center">
        <Button onClick={notAvailable} variant="outline" className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add New Category
        </Button>
      </div>
    </PageStack>
  );
}
