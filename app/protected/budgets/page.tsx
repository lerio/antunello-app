import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export default function BudgetsPage() {
  return (
    <div className="container max-w-4xl py-6 lg:py-10 px-4">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Budgets</h3>
          <p className="text-sm text-muted-foreground">
            Plan and track your spending against budgets.
          </p>
        </div>
        
        <hr className="my-4 border-gray-200 dark:border-gray-700" />

        <div className="grid gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Monthly Budget
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$1,000.00 / $1,500.00</div>
              <p className="text-xs text-muted-foreground">
                Remaining: $500.00
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Budget Categories</CardTitle>
              <CardDescription>
                Set up and manage budgets for different spending categories.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 italic">
                Budgeting features coming soon...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
