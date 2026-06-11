<p align="center">
  <h1 align="center">Antunello</h1>
  <p align="center"><em>…dei conti se ne occupa lui</em></p>
</p>

<p align="center">
  A comprehensive personal finance tracker — income, expenses, budgets, multi-currency, bank sync, and charts.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" alt="Next.js 16">
  <img src="https://img.shields.io/badge/React-19.2-blue?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript" alt="TypeScript 6">
  <img src="https://img.shields.io/badge/Supabase-hosted-3ECF8E?logo=supabase" alt="Supabase">
  <img src="https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss" alt="Tailwind v4">
</p>

---

## Features

### 💰 Transaction Management
- Add, edit, and delete transactions with **optimistic updates** — the UI reflects changes instantly and rolls back on error
- **Multi-currency support**: automatic EUR conversion using ECB exchange rates (Frankfurter API), with local DB caching and retry logic
- **Money transfers** between fund accounts with source/target fund selection and validation
- **Split transactions**: distribute a transaction evenly across all 12 months of the year (penny rounding handled)
- **Hide from totals**: flag individual transactions to exclude them from summaries
- **Title suggestions**: auto-tracked by category with frequency-based ranking and one-click auto-fill

### 📊 Dashboards & Charts
- **Monthly view**: transactions grouped by date with daily totals, sticky scrollable period selector, and comparison against previous month and same month last year
- **Yearly view**: income/expense/balance aggregated by month with monthly averages
- **Dashboard**: current vs previous month vs same-month-last-year comparison tables with expandable category breakdowns
- **Balance chart**: interactive line chart with previous-period overlay, time range selector (1M/1Y/5Y/All), responsive sizing
- **Category charts**: bar chart for category-specific spending history with transaction counts
- **Advanced filtering**: multi-dimensional filter panel — type, category/subcategory, currency, fund source, amount range, period — with chip badges

### 🔍 Search
- Real-time full-text search across all transactions (300ms debounce)
- Summary stats with income/expense/hidden breakdown

### 💳 Fund Accounts
- Track balances across **Checking Accounts, Savings Accounts, Investments, P2P Lending, Financial Services, and Cash**
- Expandable grouped view with collapsible sections and per-fund amounts
- Global EUR total with currency conversion

### 💸 Budgets
- Set category-based monthly budgets
- Color-coded progress bars: green (< 90%), amber (90–100%), red (> 100%)
- Spending alerts when approaching or exceeding limits

### 🏦 Bank Integration (Enable Banking)
- OAuth-based bank connection via PSD2 open banking
- Automatic transaction import with deduplication
- **Pending transaction review wizard**: accept or reject bank-imported transactions before they enter your ledger
- Background cron sync (`/api/cron/sync`)

### 📱 Mobile-First UX
- **Pull-to-refresh** with resistance curve on transaction views
- **Privacy mode**: toggle to blur all financial data on screen (persisted to localStorage)
- **Bottom navigation bar** with safe-area-inset support on mobile, horizontal nav on desktop
- **Bottom-sheet modals** with swipe-to-close, animated entry/exit
- **Floating action buttons** with stacked layout when multiple actions are available
- **Skeleton loading states** for all data views (balance, charts, forms, summaries, transaction lists)

### 📥 CSV Import
- Bulk import from **Cashew-formatted** CSV files
- Batch validation with detailed error reporting
- Rate-limited currency conversion for imported transactions

### 🔐 Security
- **Row Level Security** on all database tables — users can only access their own data
- Cookie-based Supabase Auth sessions via `@supabase/ssr`
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Cron endpoints protected by shared secret

### ⚡ Performance
- **Dual cache system**: SWR (in-memory) + localStorage (persistent) for zero-load navigation
- Intelligent **prefetching** of adjacent months/years with dedup queues
- `pushState`-based navigation avoids server round-trips on month/year changes
- Memoized components and calculations throughout
- Paginated batch fetching for large datasets

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16.2 (App Router, Turbopack) |
| **UI Library** | React 19.2 |
| **Language** | TypeScript 6.0 (strict mode) |
| **Database** | Supabase (PostgreSQL + RLS + real-time) |
| **Auth** | Supabase Auth (`@supabase/ssr`, cookie-based) |
| **Styling** | Tailwind CSS v4 + shadcn/ui + Radix UI primitives |
| **Data Fetching** | SWR 2.4 with localStorage persistence |
| **UI State** | Zustand 5.0 |
| **Charts** | Recharts 3.8 |
| **Date Handling** | date-fns 4.4, react-day-picker 10.0 |
| **Icons** | Lucide React 1.17 |
| **Notifications** | react-hot-toast 2.6 |
| **Theming** | next-themes 0.4 (dark/light mode) |
| **JWT** | jose 6.2 (Enable Banking API auth) |
| **Tooltips** | @floating-ui/react 0.27 |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- A **Supabase** project ([create one free](https://database.new))
- (Optional) **Enable Banking** credentials for bank sync

### 1. Clone and install

```bash
git clone <repo-url>
cd antunello-app
npm install
```

### 2. Environment variables

Copy the example and fill in your Supabase details:

```bash
cp .env.example .env.local
```

Required variables in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

Optional — Enable Banking (bank sync):

```env
ENABLE_BANKING_APP_ID=your-app-id
ENABLE_BANKING_PRIVATE_KEY="-----BEGIN PRIVATE KEY----- ..."
ENABLE_BANKING_KID=your-key-id
CRON_SECRET=your-cron-secret
NEXT_PUBLIC_APP_URL=https://localhost:3000
```

### 3. Set up the database

Run the migration SQL files in `migrations/` in numerical order via the **Supabase SQL Editor**. The migrations create:

- `fund_categories` table and FK on `transactions`
- `transaction_title_patterns` table for title suggestions
- `exchange_rates` table for currency conversion caching
- `budgets` table
- `enable_banking` integration tables
- RPC functions: `get_overall_total_eur`, `get_balance_before_date`
- Composite indexes for query performance
- RLS policies for data isolation

There are also rollback files for migrations 011 and 012.

### 4. Start the dev server

```bash
npm run dev
```

The app runs on **[https://localhost:3000](https://localhost:3000)** (HTTPS enabled via `--experimental-https` with self-signed certificates in `certificates/`).

---

## Available Scripts

```bash
npm run dev                      # Start dev server with HTTPS
npm run build                    # Production build
npm start                        # Production server
npm run find-pipe-titles         # Discover transactions with || title markers
npm run find-pipe-titles:verbose # Same, with detailed output
npm run update-pipe-titles       # Dry-run: preview pipe-title updates
npm run update-pipe-titles:execute # Apply pipe-title updates to database
```

---

## Project Structure

```
antunello-app/
├── app/                          # Next.js App Router
│   ├── (auth)/sign-in/           # Login page
│   ├── api/                      # API routes
│   │   ├── cron/sync/            # Enable Banking background sync
│   │   ├── enable-banking/       # Bank OAuth + disconnect + mapping
│   │   ├── overall-totals/       # Global balance RPC
│   │   └── pending-transactions/ # Accept/reject bank transactions
│   ├── protected/                # Authenticated pages
│   │   ├── add/                  # Add transaction
│   │   ├── admin/                # CSV import, fund management
│   │   ├── budgets/              # Budget list, add, edit
│   │   ├── category/[category]/  # Category + subcategory views
│   │   ├── edit/[id]/            # Edit transaction
│   │   ├── filter/               # Advanced filtering
│   │   ├── search/               # Full-text search
│   │   ├── settings/             # User settings
│   │   ├── transactions/         # Monthly view
│   │   └── year/                 # Yearly view
│   ├── actions.ts                # Server actions (auth)
│   ├── globals.css               # Tailwind v4 theme + shadcn CSS vars
│   └── layout.tsx                # Root layout
├── components/
│   ├── features/                 # Business logic components (17 files)
│   ├── layout/                   # Navigation, header, hero, theme, privacy
│   └── ui/                       # Base components + skeletons (30+ files)
├── hooks/                        # Custom React hooks (31 total)
├── utils/
│   ├── supabase/                 # Client, server, middleware, admin, DB utils
│   ├── enable-banking/           # API client + sync service
│   ├── currency-conversion.ts    # Frankfurter API + exchange rate caching
│   ├── csv-import.ts             # Cashew CSV parser + validator
│   ├── split-transactions.ts     # Split-amount calculation logic
│   └── ...                       # Date, formatting, validation, styling utils
├── lib/
│   ├── swr-config.ts             # Global SWR + localStorage provider
│   ├── cache-persistence.ts      # localStorage cache serialization
│   └── utils.ts                  # cn() + encodedRedirect()
├── types/
│   └── database.ts               # All TypeScript types + category definitions
├── constants/
│   └── app-constants.ts          # Currency options and symbols
├── migrations/                   # 17 numbered SQL migration files
├── scripts/                      # Pipe-title utilities + migration runner
├── certificates/                 # HTTPS dev certs (gitignored)
└── public/                       # Static assets
```

---

## Data Models

### Transaction
The core entity. Fields: `amount`, `currency`, `type` (expense/income), `main_category`, `sub_category`, `title`, `date`, `eur_amount`, `exchange_rate`, `hide_from_totals`, `fund_category_id`, `is_money_transfer`, `target_fund_category_id`, `split_across_year`.

### FundCategory
Bank accounts and fund balances: `name`, `description`, `currency`, `amount`, `top_level_category` (Checking, Savings, Investments, P2P Lending, Financial Services, Cash), `order_index`, `is_active`.

### Budget
Category-based monthly budgets: `category`, `amount`.

### ExchangeRate
Cached ECB rates: `date`, `base_currency`, `target_currency`, `rate`, `source`, `is_missing`.

### PendingTransaction
Bank-imported transactions awaiting review: `account_id`, `amount`, `currency`, `description`, `booking_date`, `status` (pending/accepted/rejected).

### Categories (20 total)
**Income**: Primary Income, Government Benefits, Other Income, Money Transfer
**Expenses**: Dining, Groceries, Housing, Transportation, Shopping, Health, Entertainment, Travel, Education, Fitness, Personal Care, Services, Insurance, Taxes and Fines, Gifts and Donations, Bank Movements

---

## Key Architecture Decisions

- **Query-param navigation**: Month/year changes use `?year=2024&month=12` with `pushState` instead of route-based URLs. This eliminates server round-trips on period navigation.
- **Dual cache**: SWR handles in-memory caching and revalidation while localStorage provides instant data on reload. Both are kept in sync on every mutation.
- **Optimistic updates**: Mutations update all affected caches (month, year, balance, fund categories, overall totals) immediately, with full rollback on error.
- **CET timezone awareness**: Year boundaries use CET (Jan 1 00:00 CET = Dec 31 23:00 UTC) to match the user's timezone.
- **No real-time on iOS Safari**: PostgreSQL LISTEN/NOTIFY subscriptions are disabled on iOS Safari to avoid performance issues — background polling (`useBackgroundSync`) serves as fallback.
- **Custom component implementations**: Dropdown menus, modals, and selects use custom implementations rather than headless UI libraries to minimize bundle size and maximize control.
- **Tailwind v4 CSS-native config**: All theme values are defined via `@theme` in `globals.css` — there is no `tailwind.config.ts` file.

---

## License

Private project.
