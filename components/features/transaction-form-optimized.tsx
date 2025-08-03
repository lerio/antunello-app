import { useState, useCallback, useMemo } from "react";
import { MAIN_CATEGORIES, SUB_CATEGORIES, Transaction } from "@/types/database";
import { createClient } from "@/utils/supabase/client";
import { formatDateTimeLocal, parseDateTime } from "@/utils/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type TransactionFormProps = {
  onSubmit: (
    data: Omit<Transaction, "id" | "created_at" | "updated_at">
  ) => Promise<void>;
  initialData?: Transaction;
};

// Memoized currency options
const CURRENCY_OPTIONS = [
  { value: "EUR", label: "EUR" },
  { value: "JPY", label: "JPY" },
  { value: "USD", label: "USD" },
];

const TYPE_OPTIONS = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

export default function TransactionFormOptimized({
  onSubmit,
  initialData,
}: TransactionFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [mainCategory, setMainCategory] = useState(
    initialData?.main_category || MAIN_CATEGORIES[0]
  );

  // Memoize subcategories to prevent recalculation
  const subCategories = useMemo(() => {
    return SUB_CATEGORIES[mainCategory as keyof typeof SUB_CATEGORIES] || [];
  }, [mainCategory]);

  // Memoize default date to prevent recalculation on each render
  const defaultDate = useMemo(() => {
    return initialData?.date
      ? formatDateTimeLocal(initialData.date)
      : formatDateTimeLocal(new Date().toISOString());
  }, [initialData?.date]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsLoading(true);

      try {
        const formData = new FormData(e.currentTarget);
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) throw new Error("User not authenticated");

        const data = {
          user_id: user.id,
          amount: Number(formData.get("amount")),
          currency: formData.get("currency") as string,
          type: formData.get("type") as "expense" | "income",
          main_category: formData.get("main_category") as string,
          sub_category: formData.get("sub_category") as string,
          title: formData.get("title") as string,
          date: parseDateTime(formData.get("date") as string),
        };

        await onSubmit(data);
      } catch (error) {
        console.error("Form submission failed:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [onSubmit]
  );

  const handleCategoryChange = useCallback((value: string) => {
    setMainCategory(value);
  }, []);

  return (
    <form onSubmit={handleSubmit}>
      <Card className="rounded-none">
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                name="amount"
                step="0.01"
                required
                defaultValue={initialData?.amount}
                autoComplete="off"
              />
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                name="currency"
                defaultValue={initialData?.currency || "EUR"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue={initialData?.type || "expense"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Main Category */}
            <div className="space-y-2">
              <Label htmlFor="main_category">Main Category</Label>
              <Select
                name="main_category"
                value={mainCategory}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select main category" />
                </SelectTrigger>
                <SelectContent>
                  {MAIN_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub Category */}
            <div className="space-y-2">
              <Label htmlFor="sub_category">Sub Category</Label>
              <Select
                name="sub_category"
                defaultValue={initialData?.sub_category}
                key={mainCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sub category" />
                </SelectTrigger>
                <SelectContent>
                  {subCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="datetime-local"
                name="date"
                required
                defaultValue={defaultDate}
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              type="text"
              name="title"
              required
              defaultValue={initialData?.title}
              autoComplete="off"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading
              ? "Saving..."
              : initialData
              ? "Save Changes"
              : "Add Entry"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
