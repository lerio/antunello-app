/**
 * Diagnostic script: Inspect money transfers between two funds.
 *
 * Run with: npx tsx scripts/diagnose-fund-balance.ts
 *
 * Finds all transactions linked to the two funds and reports the balance
 * calculation step-by-step so you can compare against expected values.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// ── Load env ──────────────────────────────────────────────────────────────
config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars. Check .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Config: set user email to scope to a specific user ────────────────────
const USER_EMAIL = process.argv[2];
if (!USER_EMAIL) {
  console.error("Usage: npx tsx scripts/diagnose-fund-balance.ts <user-email>");
  process.exit(1);
}

async function getUserId(email: string): Promise<string> {
  // Look up user by email via admin API
  const { data } = await supabase.auth.admin.listUsers();
  const user = data?.users?.find((u) => u.email === email);
  if (!user) throw new Error(`User not found: ${email}`);
  return user.id;
}

interface FundRow {
  id: string;
  name: string;
  currency: string;
  amount: number;
  is_active: boolean;
}

interface TxRow {
  id: string;
  fund_category_id: string | null;
  target_fund_category_id: string | null;
  amount: number;
  currency: string;
  date: string;
  type: "income" | "expense";
  is_money_transfer: boolean | null;
  title: string;
}

async function main() {
  const userId = await getUserId(USER_EMAIL);
  console.log(`User ID: ${userId}\n`);

  // ── Fetch all funds ───────────────────────────────────────────────────
  const { data: funds } = await supabase
    .from("fund_categories")
    .select("*")
    .eq("user_id", userId)
    .order("order_index");

  if (!funds?.length) {
    console.log("No funds found.");
    return;
  }

  console.log("── Funds ────────────────────────────────────────────────────");
  for (const f of funds) {
    console.log(`  ${f.name} (${f.currency}) — initial amount: ${f.amount}`);
  }

  // ── Fetch transactions linked to any fund ──────────────────────────────
  const { data: transactions } = await supabase
    .from("transactions")
    .select(
      "id, fund_category_id, target_fund_category_id, amount, currency, date, type, is_money_transfer, title"
    )
    .eq("user_id", userId)
    .or("fund_category_id.not.is.null,target_fund_category_id.not.is.null")
    .order("date", { ascending: true });

  if (!transactions?.length) {
    console.log("\nNo fund-linked transactions found.");
    return;
  }

  // ── Per-fund breakdown ────────────────────────────────────────────────
  console.log(`\n── Balance breakdown (${transactions.length} fund-linked txs) ──`);

  for (const fund of funds as FundRow[]) {
    const fundTxs = (transactions as TxRow[]).filter(
      (tx) =>
        tx.fund_category_id === fund.id ||
        tx.target_fund_category_id === fund.id
    );

    let balance = fund.amount;
    console.log(`\n  Fund: ${fund.name} (${fund.currency})`);
    console.log(`  Initial amount: ${fund.amount}`);

    for (const tx of fundTxs) {
      const prev = balance;
      let operation = "";

      if (tx.is_money_transfer) {
        if (tx.fund_category_id === fund.id) {
          balance -= tx.amount;
          operation = `-${tx.amount} (transfer OUT → fund ${tx.target_fund_category_id?.slice(0, 8)}…)`;
        } else if (tx.target_fund_category_id === fund.id) {
          balance += tx.amount;
          operation = `+${tx.amount} (transfer IN ← fund ${tx.fund_category_id?.slice(0, 8)}…)`;
        } else {
          operation = "??? UNEXPECTED: is_money_transfer but fund matches neither source nor target";
        }
      } else {
        if (tx.type === "income") {
          balance += tx.amount;
          operation = `+${tx.amount} (income)`;
        } else {
          balance -= tx.amount;
          operation = `-${tx.amount} (expense)`;
        }
      }

      // Highlight unexpected patterns
      const flags: string[] = [];
      if (!tx.is_money_transfer && tx.target_fund_category_id) {
        flags.push("⚠️ target_fund set but NOT marked as money transfer");
      }
      if (tx.is_money_transfer && !tx.target_fund_category_id) {
        flags.push("⚠️ money_transfer but NO target_fund");
      }

      console.log(
        `    ${tx.date.slice(0, 10)}  ${operation.padEnd(40)}  → ${balance.toFixed(2)}  ${tx.title.slice(0, 30)}  ${flags.join(" ")}`
      );
    }

    console.log(`  ─────────────────────────────`);
    console.log(`  Final calculated balance: ${balance.toFixed(2)} ${fund.currency}`);
  }

  // ── Cross-fund summary ────────────────────────────────────────────────
  console.log(`\n── Money transfers between funds ───────────────────────────`);
  const moneyTransfers = (transactions as TxRow[]).filter((tx) => tx.is_money_transfer);
  if (!moneyTransfers.length) {
    console.log("  None found.");
  } else {
    for (const tx of moneyTransfers) {
      const srcName = funds.find((f) => f.id === tx.fund_category_id)?.name ?? "?";
      const tgtName = funds.find((f) => f.id === tx.target_fund_category_id)?.name ?? "?";
      const flags: string[] = [];
      if (!tx.target_fund_category_id) flags.push("MISSING_TARGET");
      if (!tx.fund_category_id) flags.push("MISSING_SOURCE");
      console.log(
        `  ${tx.date.slice(0, 10)}  ${tx.amount} ${tx.currency}  ${srcName} → ${tgtName}  "${tx.title}"  ${flags.join(" ")}`
      );
    }
  }
}

main().catch(console.error);
