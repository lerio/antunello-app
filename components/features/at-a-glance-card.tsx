"use client";

import { useMemo } from "react";
import { formatAmountWithoutSymbol } from "@/utils/format-utils";
import { useMonthMovers, useMonthPace, MonthMover } from "@/hooks/useMonthPace";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { Skeleton } from "@/components/ui/skeleton";

/** `€1.234,56` — matches the Balance card's formatting. */
function eur(amount: number): string {
  return `€${formatAmountWithoutSymbol(Math.abs(amount))}`;
}

/** `+€1.234,56` / `-€310,00` */
function signedEur(amount: number): string {
  return `${amount < 0 ? "-" : "+"}${eur(amount)}`;
}

/** Green when the number is good news, red when it isn't. */
function deltaClass(amount: number): string {
  return amount >= 0
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";
}

/**
 * The window the previous-month comparison covers, e.g. `September to day 15`.
 * The day is clamped because a short month ends earlier — on 31 October the
 * comparison only runs to 30 September.
 */
function previousMonthWindow(monthStart: string, asOfDate: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  const daysInPreviousMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const day = Math.min(Number(asOfDate.split("-")[2]), daysInPreviousMonth);
  const name = new Date(Date.UTC(year, month - 2, 1)).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  return `${name} to day ${day}`;
}

function moverLabel(mover: MonthMover): string {
  return mover.subCategory
    ? `${mover.mainCategory} · ${mover.subCategory}`
    : mover.mainCategory;
}

/**
 * Home's "At a glance" block: how this month's spending compares with a
 * typical month at the same point, and which categories are driving the gap.
 */
export default function AtAGlanceCard() {
  const { pace, isLoading, error, mutate } = useMonthPace();
  const { movers } = useMonthMovers();
  const { privacyMode } = usePrivacyMode();

  const percent =
    pace && pace.typicalSpentToDate !== null && pace.typicalSpentToDate > 0
      ? ((pace.spentToDate - pace.typicalSpentToDate) / pace.typicalSpentToDate) * 100
      : null;

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
      ? "text-red-600 dark:text-red-400"
      : mood === "less"
        ? "text-green-600 dark:text-green-400"
        : "text-muted-foreground";

  // The biggest contributors to the gap, in the direction the month is running.
  // The RPC returns deltas descending, so the coldest categories are at the end.
  const culprits = useMemo(() => {
    if (mood === "more") return movers.filter((m) => m.delta > 0).slice(0, 3);
    if (mood === "less") return movers.filter((m) => m.delta < 0).slice(-3).reverse();
    return [];
  }, [mood, movers]);

  return (
    <div className="bg-white dark:bg-gray-800 text-card-foreground rounded-xl border shadow-sm p-4 mb-2">
      <h3 className="text-lg font-semibold m-0">At a glance</h3>

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
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : (
        <div className="mt-2">
          <p className="mt-1 text-sm text-muted-foreground">
            Spent{" "}
            <span className="font-semibold text-foreground">
              <PrivacyBlur blur={privacyMode}>{eur(pace.spentToDate)}</PrivacyBlur>
            </span>{" "}
            this month so far
            {percent !== null && (
              <>
                {" ("}
                {mood === "inline" ? (
                  <span className="text-muted-foreground">
                    in line with your usual pace
                  </span>
                ) : (
                  <>
                    <span className={`font-semibold ${paceClass}`}>
                      <PrivacyBlur blur={privacyMode}>
                        {Math.round(Math.abs(percent))}%
                      </PrivacyBlur>
                    </span>{" "}
                    <span className={paceClass}>
                      {mood === "more" ? "more" : "less"} than usual
                    </span>
                  </>
                )}
                {")"}
              </>
            )}
          </p>

          {culprits.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-sm">
              {culprits.map((mover) => (
                <li
                  key={`${mover.mainCategory}|${mover.subCategory ?? ""}`}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="truncate text-muted-foreground">
                    {moverLabel(mover)}
                  </span>
                  <span className={`shrink-0 font-medium ${paceClass}`}>
                    <PrivacyBlur blur={privacyMode}>
                      {signedEur(mover.delta)}
                    </PrivacyBlur>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            {pace.prevMonthNetToDay !== null && (
              <p>
                vs {previousMonthWindow(pace.monthStart, pace.asOfDate)}:{" "}
                <PrivacyBlur blur={privacyMode}>
                  <span className={deltaClass(pace.netToDate - pace.prevMonthNetToDay)}>
                    {signedEur(pace.netToDate - pace.prevMonthNetToDay)}
                  </span>
                </PrivacyBlur>
              </p>
            )}

            <p>
              Balance (Last 30 days):{" "}
              <PrivacyBlur blur={privacyMode}>
                <span className={deltaClass(pace.prior30dNet)}>
                  {signedEur(pace.prior30dNet)}
                </span>
              </PrivacyBlur>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
