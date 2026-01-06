import React, { useState, useMemo } from "react";
import { Transaction } from "@/types/database";
import { CATEGORY_ICONS } from "@/utils/categories";
import { LucideProps, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import {
    getDifferenceColorClass,
    getCategoryNameClass,
    getTotalAmountClass,
} from "@/utils/styling-utils";
import { Skeleton } from "@/components/ui/skeleton";

// --- Types ---

type ComparisonData = {
    transactions: Transaction[];
    label: string;
}

type DashboardSummaryProps = {
    current: ComparisonData;
    prev: ComparisonData;
    lastYear: ComparisonData;
    isLoading: boolean;
}

type TotalsItem = {
    category: string;
    total: number;
    prevTotal: number;
    lastYearTotal: number;

    // For rendering
    isBalance?: boolean;
    isIncome?: boolean;
    isExpense?: boolean;
    isHidden?: boolean;

    // Differences
    diffPrev: number;
    diffLastYear: number;

    // Sub-items (categories)
    icon?: React.ComponentType<LucideProps>;
    type?: "income" | "expense";
    subItems?: TotalsItem[];
}

// --- Helpers ---

// --- Helpers ---

type CategoryAggregate = {
    total: number;
    subcategories: Record<string, number>;
};

function calculateTotals(transactions: Transaction[]) {
    let income = 0;
    let expense = 0;
    const incomeCategories: Record<string, CategoryAggregate> = {};
    const expenseCategories: Record<string, CategoryAggregate> = {};

    transactions.forEach(t => {
        if (t.hide_from_totals || t.is_money_transfer || !t.eur_amount) return;

        const amount = t.eur_amount;
        const subCat = t.sub_category || "Uncategorized";

        if (t.type === 'income') {
            income += amount;
            if (!incomeCategories[t.main_category]) {
                incomeCategories[t.main_category] = { total: 0, subcategories: {} };
            }
            incomeCategories[t.main_category].total += amount;
            incomeCategories[t.main_category].subcategories[subCat] = (incomeCategories[t.main_category].subcategories[subCat] || 0) + amount;
        } else {
            expense += amount;
            if (!expenseCategories[t.main_category]) {
                expenseCategories[t.main_category] = { total: 0, subcategories: {} };
            }
            expenseCategories[t.main_category].total += amount;
            expenseCategories[t.main_category].subcategories[subCat] = (expenseCategories[t.main_category].subcategories[subCat] || 0) + amount;
        }
    });

    return { income, expense, incomeCategories, expenseCategories };
}

function formatAmount(amount: number) {
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

function formatDifference(diff: number, isIncome: boolean, privacyMode: boolean) {
    if (Math.abs(diff) < 0.01) return <span className="text-muted-foreground text-xs sm:text-sm">-</span>;

    const sign = diff > 0 ? "+" : "-";
    // Use standard difference color logic: green for positive income/gains, red for positive expense
    // Actually getDifferenceColorClass handles this: 
    // - diff > 0 && isIncome => green
    // - diff > 0 && !isIncome => red
    // - diff < 0 && isIncome => red
    // - diff < 0 && !isIncome => green

    const colorClass = getDifferenceColorClass(diff, isIncome);

    return (
        <span className={`${colorClass} text-xs sm:text-sm whitespace-nowrap`}>
            <PrivacyBlur blur={privacyMode}>
                {sign}{formatAmount(Math.abs(diff))}
            </PrivacyBlur>
        </span>
    );
}

// --- Components ---

function ComparisonCell({
    current,
    comparison,
    isIncome,
    privacyMode
}: {
    current: number,
    comparison: number,
    isIncome: boolean,
    privacyMode: boolean
}) {
    const diff = current - comparison;
    return formatDifference(diff, isIncome, privacyMode);
}

function DashboardTotalsTable({
    data,
    privacyMode,
    isExpanded,
    onToggle
}: {
    data: TotalsItem[],
    privacyMode: boolean,
    isExpanded: boolean,
    onToggle: () => void
}) {
    const balanceItem = data.find(d => d.isBalance);
    if (!balanceItem) return null;

    const isGains = balanceItem.total >= 0;
    const title = isGains ? "Gains (30 Days)" : "Losses (30 Days)";
    const colorClass = isGains ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";

    const filteredData = isExpanded ? data.filter(d => !d.isBalance) : [];

    return (
        <div className="bg-white dark:bg-gray-800 text-card-foreground rounded-xl border shadow-sm p-4 sm:p-5 mt-4">
            <div className="flex items-center justify-between" onClick={onToggle} role="button">
                <h3 className={`text-base font-semibold ${colorClass} flex items-center gap-2`}>
                    {isGains ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    <span>{title}</span>
                    <span className="ml-1">
                        <PrivacyBlur blur={privacyMode}>
                            €{formatAmount(Math.abs(balanceItem.total))}
                        </PrivacyBlur>
                    </span>
                </h3>
                <div className="p-1 text-muted-foreground">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
            </div>

            {isExpanded && (
                <div className="mt-4 overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                                <th className="text-left py-2 font-medium w-[30%] sm:w-1/3">Category</th>
                                <th className="text-right py-2 font-medium"></th>
                                <th className="text-right py-2 font-medium">Previous</th>
                                <th className="text-right py-2 font-medium">vs '{new Date().getFullYear().toString().slice(-2) === "00" ? "99" : (new Date().getFullYear() - 1).toString().slice(-2)}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredData.map((item) => (
                                <tr key={item.category} className="text-sm">
                                    <td className="py-3 pr-2">
                                        <div className="font-medium">{item.category}</div>
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <span className={`${item.isIncome ? "text-green-600" : (item.isExpense ? "text-red-600" : "")} text-xs`}>
                                            <PrivacyBlur blur={privacyMode}>
                                                €{formatAmount(item.total)}
                                            </PrivacyBlur>
                                        </span>
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <ComparisonCell
                                            current={item.total}
                                            comparison={item.prevTotal}
                                            isIncome={!!(item.isIncome || item.isBalance)}
                                            privacyMode={privacyMode}
                                        />
                                    </td>
                                    <td className="py-3 pl-2 text-right">
                                        <ComparisonCell
                                            current={item.total}
                                            comparison={item.lastYearTotal}
                                            isIncome={!!(item.isIncome || item.isBalance)}
                                            privacyMode={privacyMode}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function DashboardCategoryTable({
    items,
    privacyMode
}: {
    items: TotalsItem[],
    privacyMode: boolean
}) {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    const handleExpand = (category: string) => {
        setExpandedCategory(prev => prev === category ? null : category);
    };

    if (items.length === 0) return null;

    return (
        <div className="bg-white dark:bg-gray-800 text-card-foreground rounded-xl border shadow-sm p-4 sm:p-5 mt-4">
            <h3 className="text-base font-semibold mb-4">Category Breakdown (30 Days)</h3>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                            <th className="text-left py-2 font-medium w-[25%] sm:w-1/3">Category</th>
                            <th className="text-right py-2 font-medium"></th>
                            <th className="text-right py-2 font-medium">Previous</th>
                            <th className="text-right py-2 font-medium">vs '{new Date().getFullYear().toString().slice(-2) === "00" ? "99" : (new Date().getFullYear() - 1).toString().slice(-2)}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {items.map((item) => (
                            <React.Fragment key={item.category}>
                                <tr
                                    className="text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                    onClick={() => handleExpand(item.category)}
                                >
                                    <td className="py-3 pr-2">
                                        <div className="flex items-center gap-1 sm:gap-2">

                                            {item.icon && <item.icon size={16} className="text-muted-foreground flex-shrink-0" />}
                                            <div className="relative min-w-0 flex-1 max-w-[80px] sm:max-w-[200px]">
                                                <span
                                                    className={`font-medium block overflow-hidden whitespace-nowrap ${item.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                                                    style={{
                                                        maskImage: "linear-gradient(to right, black 0%, black 85%, transparent 100%)",
                                                        WebkitMaskImage: "linear-gradient(to right, black 0%, black 85%, transparent 100%)",
                                                    }}
                                                >
                                                    {item.category}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <span className={`${item.type === 'income' ? "text-green-600" : "text-red-600"} text-xs`}>
                                            <PrivacyBlur blur={privacyMode}>
                                                €{formatAmount(item.total)}
                                            </PrivacyBlur>
                                        </span>
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <ComparisonCell
                                            current={item.total}
                                            comparison={item.prevTotal}
                                            isIncome={item.type === 'income'}
                                            privacyMode={privacyMode}
                                        />
                                    </td>
                                    <td className="py-3 pl-2 text-right">
                                        <ComparisonCell
                                            current={item.total}
                                            comparison={item.lastYearTotal}
                                            isIncome={item.type === 'income'}
                                            privacyMode={privacyMode}
                                        />
                                    </td>
                                </tr>
                                {/* Subcategories */}
                                {expandedCategory === item.category && item.subItems?.map((sub) => (
                                    <tr key={`${item.category}-${sub.category}`} className="text-xs bg-gray-50/50 dark:bg-gray-800/50">
                                        <td className="py-2 pr-2">
                                            <div className="relative min-w-0 max-w-[80px] sm:max-w-[200px]">
                                                <span
                                                    className="text-muted-foreground block overflow-hidden whitespace-nowrap"
                                                    style={{
                                                        maskImage: "linear-gradient(to right, black 0%, black 85%, transparent 100%)",
                                                        WebkitMaskImage: "linear-gradient(to right, black 0%, black 85%, transparent 100%)",
                                                    }}
                                                >
                                                    {sub.category}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-2 text-right">
                                            <span className="text-muted-foreground">
                                                <PrivacyBlur blur={privacyMode}>
                                                    €{formatAmount(sub.total)}
                                                </PrivacyBlur>
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 text-right">
                                            <ComparisonCell
                                                current={sub.total}
                                                comparison={sub.prevTotal}
                                                isIncome={item.type === 'income'}
                                                privacyMode={privacyMode}
                                            />
                                        </td>
                                        <td className="py-2 pl-2 text-right">
                                            <ComparisonCell
                                                current={sub.total}
                                                comparison={sub.lastYearTotal}
                                                isIncome={item.type === 'income'}
                                                privacyMode={privacyMode}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function DashboardSummary({ current, prev, lastYear, isLoading }: DashboardSummaryProps) {
    const { privacyMode } = usePrivacyMode();
    const [isTotalsExpanded, setIsTotalsExpanded] = useState(true);

    const totalsData = useMemo(() => {
        if (!current.transactions || !prev.transactions || !lastYear.transactions) return null;

        const curr = calculateTotals(current.transactions);
        const prevT = calculateTotals(prev.transactions);
        const lastY = calculateTotals(lastYear.transactions);

        // 1. Balance/Income/Expense Structure
        const balanceCurrent = curr.income - curr.expense;
        const balancePrev = prevT.income - prevT.expense;
        const balanceLastYear = lastY.income - lastY.expense;

        const mainItems: TotalsItem[] = [
            {
                category: balanceCurrent >= 0 ? "Gains" : "Losses",
                total: balanceCurrent,
                prevTotal: balancePrev,
                lastYearTotal: balanceLastYear,
                diffPrev: balanceCurrent - balancePrev,
                diffLastYear: balanceCurrent - balanceLastYear,
                isBalance: true
            },
            {
                category: "Income",
                total: curr.income,
                prevTotal: prevT.income,
                lastYearTotal: lastY.income,
                diffPrev: curr.income - prevT.income,
                diffLastYear: curr.income - lastY.income,
                isIncome: true
            },
            {
                category: "Expenses",
                total: curr.expense,
                prevTotal: prevT.expense,
                lastYearTotal: lastY.expense,
                diffPrev: curr.expense - prevT.expense,
                diffLastYear: curr.expense - lastY.expense,
                isExpense: true
            }
        ];

        // 2. Category Breakdown Structure
        // Get all unique categories from all periods to ensure we show everything? 
        // Or just current period? Requirement says "should show the same data of the previous table, but broken down"
        // Usually breakdown shows categories present in current period.

        const categoryItems: TotalsItem[] = [];

        const buildCategoryItems = (
            currCats: Record<string, CategoryAggregate>,
            prevCats: Record<string, CategoryAggregate>,
            lastYearCats: Record<string, CategoryAggregate>,
            type: 'income' | 'expense'
        ) => {
            Object.entries(currCats)
                .sort(([, a], [, b]) => b.total - a.total)
                .forEach(([cat, data]) => {
                    const prevCatData = prevCats[cat];
                    const lastYearCatData = lastYearCats[cat];
                    const prevTotal = prevCatData?.total || 0;
                    const lastYearTotal = lastYearCatData?.total || 0;

                    // Build subitems
                    const subItems: TotalsItem[] = [];
                    Object.entries(data.subcategories)
                        .sort(([, a], [, b]) => b - a)
                        .forEach(([subCat, subAmount]) => {
                            const prevSubTotal = prevCatData?.subcategories[subCat] || 0;
                            const lastYearSubTotal = lastYearCatData?.subcategories[subCat] || 0;
                            subItems.push({
                                category: subCat,
                                total: subAmount,
                                prevTotal: prevSubTotal,
                                lastYearTotal: lastYearSubTotal,
                                diffPrev: subAmount - prevSubTotal,
                                diffLastYear: subAmount - lastYearSubTotal,
                                type
                            });
                        });

                    categoryItems.push({
                        category: cat,
                        total: data.total,
                        prevTotal: prevTotal,
                        lastYearTotal: lastYearTotal,
                        diffPrev: data.total - prevTotal,
                        diffLastYear: data.total - lastYearTotal,
                        type,
                        icon: CATEGORY_ICONS[cat],
                        subItems
                    });
                });
        };

        buildCategoryItems(curr.incomeCategories, prevT.incomeCategories, lastY.incomeCategories, 'income');
        buildCategoryItems(curr.expenseCategories, prevT.expenseCategories, lastY.expenseCategories, 'expense');

        return { mainItems, categoryItems };

    }, [current.transactions, prev.transactions, lastYear.transactions]);

    if (isLoading) {
        return (
            <div className="space-y-4 mt-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    if (!totalsData) return null;

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <DashboardTotalsTable
                data={totalsData.mainItems}
                privacyMode={privacyMode}
                isExpanded={isTotalsExpanded}
                onToggle={() => setIsTotalsExpanded(!isTotalsExpanded)}
            />

            <DashboardCategoryTable
                items={totalsData.categoryItems}
                privacyMode={privacyMode}
            />
        </div>
    );
}
