"use client";

import { useMemo, useState, type ComponentType } from "react";
import { ChevronDown, ChevronUp, type LucideProps } from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import { CATEGORY_ICONS } from "@/utils/categories";
import { useMonthMovers, useMonthPace, MonthMover } from "@/hooks/useMonthPace";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { Skeleton } from "@/components/ui/skeleton";

/** `1.234,56 €` — the app's single currency formatter, never hand-prefixed. */
function eur(amount: number): string {
  return formatCurrency(Math.abs(amount), "EUR");
}

/** `+1.234,56 €` / `-310,00 €` */
function signedEur(amount: number): string {
  return `${amount < 0 ? "-" : "+"}${eur(amount)}`;
}

/** Direction without relying on colour. */
function arrow(amount: number): string {
  return amount > 0 ? "▲" : amount < 0 ? "▼" : "–";
}

/**
 * The previous-month comparison window, e.g. `Sep 1–20`.
 *
 * The day is clamped because a short month ends earlier — on 31 October the
 * comparison only runs to 30 September.
 */
function previousMonthRange(monthStart: string, asOfDate: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  const daysInPreviousMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const day = Math.min(Number(asOfDate.split("-")[2]), daysInPreviousMonth);
  // en-GB renders September as "Sept"; the shared copy deck wants three letters.
  const name = new Date(Date.UTC(year, month - 2, 1))
    .toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })
    .slice(0, 3);

  return `${name} 1–${day}`;
}

/** The subcategory is the useful label; the category is its context. */
function moverParts(mover: MonthMover): {
  title: string;
  subtitle: string | null;
  Icon: ComponentType<LucideProps>;
} {
  return {
    title: mover.subCategory ?? mover.mainCategory,
    subtitle: mover.subCategory ? mover.mainCategory : null,
    Icon: (CATEGORY_ICONS[mover.mainCategory] ??
      CATEGORY_ICONS.Services) as ComponentType<LucideProps>,
  };
}

/**
 * Home's "This month" block: what has been spent, how it compares with a usual
 * month at the same point, and the categories driving the gap.
 */
export default function AtAGlanceCard() {
  const { pace, isLoading, error, mutate } = useMonthPace();
  const { movers } = useMonthMovers();
  const { privacyMode } = usePrivacyMode();
  const [detailOpen, setDetailOpen] = useState(true);

  const usual = pace?.typicalSpentToDate ?? null;
  const hasPace = usual !== null && usual > 0;
  const percent =
    pace && hasPace ? ((pace.spentToDate - usual) / usual) * 100 : null;

  const mood =
    percent === null
      ? "unknown"
      : percent > 0.5
        ? "more"
        : percent < -0.5
          ? "less"
          : "inline";

  const paceClass =
    mood === "more"
      ? "text-negative"
      : mood === "less"
        ? "text-positive"
        : "text-muted-foreground";
  const chipClass =
    mood === "more"
      ? "bg-negative/10 text-negative"
      : mood === "less"
        ? "bg-positive/10 text-positive"
        : "bg-muted text-muted-foreground";
  const barClass =
    mood === "more"
      ? "bg-negative"
      : mood === "less"
        ? "bg-positive"
        : "bg-muted-foreground/60";

  // The bar reads left to right: spent so far, with a tick at the usual level.
  // The 10% headroom keeps an over-spend visible instead of clipping at 100%.
  const scale = pace && hasPace ? Math.max(pace.spentToDate, usual) * 1.1 : 1;
  const spentWidth = pace ? Math.min(100, (pace.spentToDate / scale) * 100) : 0;
  const usualPosition = hasPace ? Math.min(100, (usual / scale) * 100) : 0;

  // The biggest contributors to the gap, in the direction the month is running.
  // The RPC returns deltas descending, so the coldest categories are at the end.
  const culprits = useMemo(() => {
    if (mood === "more") return movers.filter((m) => m.delta > 0).slice(0, 3);
    if (mood === "less") return movers.filter((m) => m.delta < 0).slice(-3).reverse();
    return [];
  }, [mood, movers]);

  const prevMonthDelta =
    pace && pace.prevMonthNetToDay !== null
      ? pace.netToDate - pace.prevMonthNetToDay
      : null;

  return (
    <div className="bg-white dark:bg-gray-800 text-card-foreground rounded-2xl border shadow-sm p-4 sm:p-6 tabular-nums">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold m-0">This month</h3>
        <button
          onClick={() => setDetailOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label={detailOpen ? "Hide details" : "Show details"}
          aria-expanded={detailOpen}
        >
          {detailOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {error ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load this month&apos;s pace.
          </p>
          <button
            onClick={() => mutate()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : isLoading || !pace ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-56" />
        </div>
      ) : (
        <div className="mt-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-3xl font-semibold">
              <PrivacyBlur blur={privacyMode}>{eur(pace.spentToDate)}</PrivacyBlur>
            </span>
            {percent !== null && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${chipClass}`}
              >
                <PrivacyBlur blur={privacyMode}>
                  {mood === "inline" ? (
                    "In line with usual"
                  ) : (
                    <>
                      <span aria-hidden="true">
                        {mood === "more" ? "▲" : "▼"}
                      </span>{" "}
                      <span className="sr-only">
                        {mood === "more" ? "above " : "below "}
                      </span>
                      {Math.round(Math.abs(percent))}% vs usual
                    </>
                  )}
                </PrivacyBlur>
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">spent so far</p>

          {hasPace && (
            <div className="relative mt-4 pb-6">
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${barClass}`}
                  style={{ width: `${spentWidth}%` }}
                />
              </div>
              <div
                className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground/50"
                style={{ left: `${usualPosition}%` }}
              />
              <span
                className="absolute top-3 -translate-x-1/2 text-[10px] leading-none text-muted-foreground"
                style={{
                  left: `${Math.min(94, Math.max(6, usualPosition))}%`,
                }}
              >
                usual
              </span>
            </div>
          )}

          {detailOpen && (
            <>
          {culprits.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">vs usual</p>
              <ul className="mt-1 divide-y divide-border">
                {culprits.map((mover) => {
                  const { title, subtitle, Icon } = moverParts(mover);
                  return (
                    <li
                      key={`${mover.mainCategory}|${mover.subCategory ?? ""}`}
                      className="flex items-center gap-3 py-2"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {title}
                        </span>
                        {subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {subtitle}
                          </span>
                        )}
                      </span>
                      <span className={`shrink-0 text-sm font-medium ${paceClass}`}>
                        <PrivacyBlur blur={privacyMode}>
                          {signedEur(mover.delta)}
                        </PrivacyBlur>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mt-3 divide-y divide-border border-t border-border">
            {prevMonthDelta !== null && (
              <div className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Spent vs {previousMonthRange(pace.monthStart, pace.asOfDate)}
                </span>
                <span
                  className={`shrink-0 text-sm font-medium ${
                    prevMonthDelta > 0
                      ? "text-negative"
                      : prevMonthDelta < 0
                        ? "text-positive"
                        : "text-muted-foreground"
                  }`}
                >
                  <PrivacyBlur blur={privacyMode}>
                    <span aria-hidden="true">{arrow(prevMonthDelta)}</span>{" "}
                    <span className="sr-only">
                      {prevMonthDelta > 0
                        ? "up "
                        : prevMonthDelta < 0
                          ? "down "
                          : ""}
                    </span>
                    {signedEur(prevMonthDelta)}
                  </PrivacyBlur>
                </span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3 py-2">
              <span className="text-xs text-muted-foreground">
                Net cash flow, last 30 days
              </span>
              <span
                className={`shrink-0 text-sm font-medium ${
                  pace.prior30dNet >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                <PrivacyBlur blur={privacyMode}>
                  <span aria-hidden="true">{arrow(pace.prior30dNet)}</span>{" "}
                  <span className="sr-only">
                    {pace.prior30dNet > 0
                      ? "up "
                      : pace.prior30dNet < 0
                        ? "down "
                        : ""}
                  </span>
                  {signedEur(pace.prior30dNet)}
                </PrivacyBlur>
              </span>
            </div>
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
