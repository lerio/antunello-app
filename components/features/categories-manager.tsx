"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Edit2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FloatingButton } from "@/components/ui/floating-button";
import { Modal } from "@/components/ui/modal";
import { CategoryForm, type CategoryKind } from "@/components/features/category-form";
import { PageStack } from "@/components/layout/page-container";
import { useCategories } from "@/hooks/useCategories";
import type { CategoryEntry } from "@/utils/custom-categories";
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
 * Renaming and deleting categories means migrating the transactions that use
 * them, which is not designed yet. Until it is, those actions are placeholders;
 * adding categories is real.
 */
const notAvailable = () =>
  toast("Editing categories isn't available yet.", { id: "categories-wip" });

/**
 * Settings → Categories: the main categories with their subcategories (built-in
 * and custom). Adding saves to `custom_categories`; edit and delete are
 * placeholders for now.
 */
type Category = CategoryEntry;

/** Display order of the sections; "Money Transfer" is the only movement. */
const SECTIONS: { title: string; match: (cat: Category) => boolean }[] = [
  { title: "Income", match: (cat) => cat.type === "income" },
  {
    title: "Expenses",
    match: (cat) => cat.type === "expense" && cat.category !== "Money Transfer",
  },
  { title: "Movements", match: (cat) => cat.category === "Money Transfer" },
];

const kindOf = (cat: Category): CategoryKind =>
  cat.category === "Money Transfer" ? "transfer" : cat.type;

export default function CategoriesManager() {
  // Kept set on close so the form stays rendered during the slide-out animation.
  // editing null means "add".
  const [editing, setEditing] = useState<Category | null>(null);
  // Set when editing a subcategory of `editing`.
  const [editingSub, setEditingSub] = useState<string | null>(null);
  // True when adding a subcategory to `editing`.
  const [addingSub, setAddingSub] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { categories, addCategory } = useCategories();
  const [sectionTitle, setSectionTitle] = useState(SECTIONS[0].title);
  const section = SECTIONS.find((s) => s.title === sectionTitle) ?? SECTIONS[0];
  const openAdd = () => {
    setEditing(null);
    setEditingSub(null);
    setAddingSub(false);
    setIsEditOpen(true);
  };
  const openAddSub = (cat: Category) => {
    setEditing(cat);
    setEditingSub(null);
    setAddingSub(true);
    setIsEditOpen(true);
  };
  const openEditSub = (cat: Category, sub: string) => {
    setEditing(cat);
    setEditingSub(sub);
    setAddingSub(false);
    setIsEditOpen(true);
  };
  const openEdit = (cat: Category) => {
    setEditing(cat);
    setEditingSub(null);
    setAddingSub(false);
    setIsEditOpen(true);
  };
  const { byCategory, bySubcategory, byCategoryAndType, bySubcategoryAndType, isLoading } =
    useCategoryCounts();
  // A name that exists under both types must be counted per type; otherwise the
  // plain count (which also catches transactions whose type is unusual, such as
  // transfer legs) is kept as it always was.
  const isAmbiguous = (cat: Category) =>
    categories.filter((other) => other.category === cat.category).length > 1;
  const categoryCount = (cat: Category) =>
    isLoading
      ? undefined
      : isAmbiguous(cat)
        ? (byCategoryAndType[`${cat.type}|${cat.category}`] ?? 0)
        : (byCategory[cat.category] ?? 0);
  const subcategoryCount = (cat: Category, sub: string) => {
    if (isLoading) return undefined;
    const key = subcategoryKey(cat.category, sub);
    return isAmbiguous(cat) ? (bySubcategoryAndType[`${cat.type}|${key}`] ?? 0) : (bySubcategory[key] ?? 0);
  };
  const handleSubmit = async (title: string, kind: CategoryKind, icon: string) => {
    const isEdit = !addingSub && editing !== null;
    const isEditSub = editingSub !== null;
    if (isEdit || isEditSub) {
      notAvailable();
      return;
    }

    const clash = (names: string[]) =>
      names.some((name) => name.toLowerCase() === title.toLowerCase());

    if (addingSub && editing) {
      if (clash(editing.subcategories)) {
        throw new Error(`"${editing.category}" already has a subcategory called "${title}".`);
      }
      await addCategory({ name: title, type: editing.type, parent_category: editing.category });
      toast.success("Subcategory added");
    } else {
      if (kind === "transfer") throw new Error("New categories can be income or expense.");
      // The same name is fine under a different type.
      const sameType = categories.filter((cat) => cat.type === kind).map((cat) => cat.category);
      if (clash(sameType)) throw new Error(`A ${kind} category called "${title}" already exists.`);
      await addCategory({ name: title, type: kind, icon });
      toast.success("Category added");
    }
    setIsEditOpen(false);
  };

  const transactionCountValue = !editing
    ? undefined
    : editingSub
      ? subcategoryCount(editing, editingSub)
      : categoryCount(editing);
  return (
    <PageStack>
      <div role="tablist" className="flex items-center gap-4">
        {SECTIONS.map((sec) => (
          <button
            key={sec.title}
            type="button"
            role="tab"
            aria-selected={sec.title === section.title}
            onClick={() => setSectionTitle(sec.title)}
            className={cn(
              "m-0 text-base font-semibold transition-colors focus:outline-none",
              sec.title === section.title
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {sec.title}
          </button>
        ))}
      </div>

      <PageStack>
        {categories.filter(section.match).map((cat) => {
          const Icon = getCategoryIcon(cat.category);
          return (
            <Card key={`${cat.type}/${cat.category}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {Icon && <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />}
                  <h3 className="m-0 text-lg font-semibold">{cat.category}</h3>
                  <CountBadge count={categoryCount(cat)} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    onClick={() => openEdit(cat)}
                    size="icon"
                    variant="ghost"
                    title="Edit category"
                    className={cn(iconButtonClass, "hover:text-primary")}
                  >
                    <Edit2 className="h-4 w-4" />
                    <span className="sr-only">Edit {cat.category}</span>
                  </Button>
                </div>
              </div>
  
              <ul className="mt-3 divide-y divide-border">
                {cat.subcategories.map((sub) => (
                  <li key={sub} className="flex items-center justify-between gap-2 py-1">
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                    {sub}
                    <CountBadge
                      count={subcategoryCount(cat, sub)}
                    />
                  </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        onClick={() => openEditSub(cat, sub)}
                        size="icon"
                        variant="ghost"
                        title="Edit subcategory"
                        className={cn(iconButtonClass, "hover:text-primary")}
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="sr-only">Edit {sub}</span>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
  
              <Button
                onClick={() => openAddSub(cat)}
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

      <FloatingButton onClick={openAdd} icon={Plus} label="Add category" />

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <CategoryForm
          key={`${editing?.type ?? ""}/${editing?.category ?? "new"}/${editingSub ?? (addingSub ? "+" : "")}`}
          title={addingSub ? undefined : (editingSub ?? editing?.category)}
          parentTitle={editingSub || addingSub ? editing?.category : undefined}
          kind={editing ? kindOf(editing) : undefined}
          icon={editing ? getCategoryIcon(editing.category)?.displayName : undefined}
          transactionCount={transactionCountValue}
          // Adding saves; editing is still a placeholder (see notAvailable).
          canDelete={
            !!editing &&
            (editingSub
              ? transactionCountValue === 0
              : transactionCountValue === 0 && editing.subcategories.length === 0)
          }
          onDelete={notAvailable}
          onSubmit={handleSubmit}
          onClose={() => setIsEditOpen(false)}
        />
      </Modal>
    </PageStack>
  );
}
