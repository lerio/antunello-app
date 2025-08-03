import { useState } from "react";
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

export default function TransactionForm({
  onSubmit,
  initialData,
}: TransactionFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [mainCategory, setMainCategory] = useState(
    initialData?.main_category || MAIN_CATEGORIES[0]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

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

    try {
      await onSubmit(data);
    } catch (error) {
      console.error("Form submission failed:", error);
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                name="amount"
                step="0.01"
                required
                defaultValue={initialData?.amount}
              />
            </div>

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
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="JPY">JPY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue={initialData?.type || "expense"}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="main_category">Main Category</Label>
              <Select
                name="main_category"
                value={mainCategory}
                onValueChange={setMainCategory}
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

            <div className="space-y-2">
              <Label htmlFor="sub_category">Sub Category</Label>
              <Select
                name="sub_category"
                defaultValue={initialData?.sub_category}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sub category" />
                </SelectTrigger>
                <SelectContent>
                  {SUB_CATEGORIES[
                    mainCategory as keyof typeof SUB_CATEGORIES
                  ].map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="datetime-local"
                name="date"
                required
                defaultValue={
                  initialData?.date
                    ? formatDateTimeLocal(initialData.date)
                    : formatDateTimeLocal(new Date().toISOString())
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              type="text"
              name="title"
              required
              defaultValue={initialData?.title}
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
