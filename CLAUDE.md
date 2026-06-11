# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Behavioral Guidelines

These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so and push back when warranted.
- If unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility or configurability that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Self-check: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

- Don't improve adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that *your* changes made unused.
- Don't remove pre-existing dead code unless asked.
- Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

- "Add validation" → Write tests for invalid inputs, then make them pass.
- "Fix the bug" → Write a test that reproduces it, then make them pass.
- "Refactor X" → Ensure tests pass before and after.
- For multi-step tasks, state a brief numbered plan with verification checks.
- Weak criteria like "make it work" require constant clarification. Strong criteria let you loop independently.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before mistakes rather than after.

---

## Project Overview

Antunello is a comprehensive personal finance tracking application built with Next.js 16, Supabase, and shadcn/ui. The app tracks income and expenses with categorized transactions, multi-currency support, fund account management, banking integration, and real-time data synchronization.

## Architecture

- **Framework**: Next.js 16.2.9 with App Router, React 19.2.7
- **Database**: Supabase (PostgreSQL with RLS policies and real-time subscriptions)
- **Authentication**: Supabase Auth with cookie-based sessions (@supabase/ssr)
- **Styling**: Tailwind CSS v4.3.0 configured via CSS `@theme` directives (no tailwind.config file)
- **State Management**: SWR 2.4.1 with localStorage persistence, Zustand 5.0.14 for UI state
- **Type Safety**: TypeScript 6.0.3 throughout with strict mode
- **UI Components**: shadcn/ui, Radix UI primitives (Label, Popover, Select, Slider, Slot, Switch), Lucide React 1.17.0
- **Charts**: Recharts 3.8.1
- **Build Tool**: Turbopack (Next.js bundler)
- **Theming**: next-themes 0.4.6 for dark mode support
- **Date Handling**: date-fns 4.4.0, react-day-picker 10.0.1
- **Notifications**: react-hot-toast 2.6.0
- **JWT**: jose 6.2.3 (Enable Banking API authentication)
- **Floating UI**: @floating-ui/react 0.27.19 (tooltips, popovers)
- **Class Utilities**: clsx 2.1.1, tailwind-merge 3.6.0, class-variance-authority 0.7.1

## Key Features

- **Transaction Management**: Add, edit, delete transactions with optimistic updates and rollback
- **Multi-Currency Support**: Automatic EUR conversion using ECB exchange rates (Frankfurter API)
- **Fund Categories**: Track balances across bank accounts, savings, investments, and other fund types
- **Money Transfers**: Move funds between accounts with source/target fund selection
- **Split Transactions**: Distribute a transaction amount evenly across months of the year
- **Monthly/Yearly Views**: Organized transaction views with sticky scrollable period selectors
- **Dashboard**: Period-over-period comparison with income/expense/balance breakdowns
- **Balance Charts**: Interactive line chart with previous-period overlay comparison
- **Category Charts**: Bar chart for category-specific spending history
- **Advanced Filtering**: Multi-dimensional transaction filtering (type, category, currency, fund, amount range, period)
- **Search**: Real-time full-text search across all transactions
- **Budgets**: Category-based budget tracking with progress bars and spending alerts
- **CSV Import**: Bulk import from Cashew-formatted CSV files with validation
- **Title Suggestions**: Auto-tracked transaction titles with frequency-based ranking and auto-fill
- **Exchange Rate Caching**: Local database caching with retry logic for missing rates
- **Hide from Totals**: Flag transactions to exclude from summaries
- **Privacy Mode**: Toggle to blur financial data on screen
- **Pull-to-Refresh**: Mobile gesture for refreshing transaction data
- **Background Sync**: Polling-based detection of remote changes with update banners
- **Enable Banking Integration**: Automatic bank transaction import via OAuth
- **Pending Transaction Review**: Accept/reject wizard for bank-imported transactions
- **Real-time Sync**: PostgreSQL LISTEN/NOTIFY for instant updates across devices

## Common Commands

```bash
npm run dev                     # Start development server on localhost:3000 (with HTTPS)
npm run build                   # Build for production
npm start                       # Start production server
npm run find-pipe-titles        # Discover transaction titles containing || markers
npm run find-pipe-titles:verbose # Same with detailed output
npm run update-pipe-titles      # Dry-run: preview pipe-title updates
npm run update-pipe-titles:execute # Execute pipe-title updates in database
```

## Key Directories

- `app/` - Next.js App Router pages, layouts, and API routes
- `components/` - Reusable UI components organized by purpose:
  - `ui/` - Base components (button, input, select, modal, date-picker, skeletons, etc.)
  - `features/` - Business logic components (forms, tables, summaries, charts, balance, budgets)
  - `layout/` - Layout components (navigation, header, hero, theme toggle, privacy)
  - `providers/` - Empty placeholder directory for future providers
- `hooks/` - 31 custom React hooks for data operations and state management
- `utils/` - General utilities and Supabase client configurations
  - `supabase/` - Client, server, middleware, database-utils, pattern-utils, env
  - `enable-banking/` - Enable Banking API client and sync service
- `lib/` - Utility functions and configurations
  - `swr-config.ts` - Global SWR configuration with localStorage persistence
  - `cache-persistence.ts` - Cache serialization/deserialization to localStorage
  - `cache-debouncer.ts` - Debounced save and periodic persistence
  - `utils.ts` - `cn()` class merge utility, `encodedRedirect()` helper
- `types/` - TypeScript type definitions (database models, category icons, global types)
- `constants/` - App-wide constants (currency options, symbols)
- `migrations/` - 17 numbered database migration SQL files
- `scripts/` - Data processing scripts (pipe-title find/update, migration runner)
- `public/` - Static assets (empty-box.png)
- `certificates/` - HTTPS dev certificates (localhost-key.pem, localhost.pem) — gitignored

## Application Pages

### Public
- `/` — Landing page with hero and description
- `/(auth)/sign-in` — Email/password login page

### Protected (require authentication)
- `/protected` — Home dashboard with balance overview, charts, and comparison tables
- `/protected/transactions` — Monthly transaction list view
- `/protected/year` — Yearly summary aggregated by month
- `/protected/add` — Dedicated transaction add page
- `/protected/edit/[id]` — Edit transaction by ID
- `/protected/search` — Real-time transaction search with filters
- `/protected/filter` — Advanced multi-dimensional filtered transaction view
- `/protected/category/[category]` — Transactions filtered by main category with chart
- `/protected/category/[category]/[subcategory]` — Transactions filtered by subcategory
- `/protected/budgets` — Budget list with progress bars
- `/protected/budgets/add` — Add budget form
- `/protected/budgets/edit/[id]` — Edit budget form
- `/protected/settings` — User settings and password reset
- `/protected/admin` — Admin dashboard (CSV import, fund categories management, data management)
- `/protected/reset-password` — Password reset functionality

### API Routes
- `/api/overall-totals` — RPC call for global balance total calculation
- `/api/transactions/bulk-fetch` — Bulk fetch transactions
- `/api/pending-transactions/[id]` — Accept/reject pending bank transactions
- `/api/enable-banking/auth` — Enable Banking OAuth authentication
- `/api/enable-banking/callback` — Enable Banking OAuth callback
- `/api/enable-banking/disconnect` — Disconnect Enable Banking integration
- `/api/enable-banking/update-mapping` — Update transaction-to-category mappings
- `/api/cron/sync` — Cron endpoint for background Enable Banking sync (protected by `CRON_SECRET`)

## Data Models

### Transaction
Primary entity for tracking income and expenses:
- Core fields: `id`, `user_id`, `amount`, `currency`, `type` (expense/income)
- Categorization: `main_category`, `sub_category`, `title`, `date`
- Currency conversion: `eur_amount`, `exchange_rate`, `rate_date`
- Features: `hide_from_totals`, `fund_category_id`, `is_money_transfer`, `target_fund_category_id`, `split_across_year`
- Timestamps: `created_at`, `updated_at`
- UI-only fields (not persisted): `split_source_transaction_id`, `split_is_read_only`, `split_display_amount`, `split_display_eur_amount`

### FundCategory
Track fund accounts and their balances:
- Fields: `id`, `user_id`, `name`, `description`, `currency`, `amount`
- Organization: `top_level_category`, `order_index`, `is_active`
- Top-level categories: Checking Accounts, Savings Accounts, Investments, P2P Lending, Financial Services, Cash

### ExchangeRate
Cached exchange rates for currency conversion:
- Fields: `id`, `date`, `base_currency`, `target_currency`, `rate`
- Tracking: `source` (api/fallback), `is_missing`, `created_at`, `updated_at`

### TitleSuggestion
Auto-tracked transaction titles for suggestions (table: `transaction_title_patterns`):
- Fields: `id`, `user_id`, `title`, `type`, `main_category`, `sub_category`
- Usage tracking: `frequency`, `last_used_at`, `created_at`, `updated_at`

### Budget
Category-based budget tracking:
- Fields: `id`, `user_id`, `category`, `amount`, `created_at`, `updated_at`

### PendingTransaction
Bank-imported transactions awaiting review:
- Fields: `id`, `user_id`, `account_id`, `transaction_id`, `amount`, `currency`, `description`, `booking_date`, `status` (pending/accepted/rejected), timestamps

### Categories
20 main categories with subcategories defined in `types/database.ts`:
- **Income**: Primary Income, Government Benefits, Other Income, Money Transfer
- **Expenses**: Dining, Groceries, Housing, Transportation, Shopping, Health, Entertainment, Travel, Education, Fitness, Personal Care, Services, Insurance, Taxes and Fines, Gifts and Donations, Bank Movements

## Component Organization

### Layout Components (`components/layout/`)
- `navigation.tsx` — Mobile (fixed bottom) and desktop (inline top) navigation with active state detection
- `header-auth.tsx` — Async server component: auth header with user menu or sign-in link
- `user-menu.tsx` — Dropdown user menu with sign-out option
- `theme-toggle.tsx` — Dark/light theme switcher with animated icon
- `privacy-provider.tsx` — Context provider for privacy mode (persisted to localStorage)
- `privacy-toggle.tsx` — Privacy mode toggle button (Eye/EyeOff icons)
- `hero.tsx` — Landing page hero section
- `env-var-warning.tsx` — Warning banner for missing Supabase environment variables

### Feature Components (`components/features/`)
- `transaction-form-modal.tsx` — Modal form for add/edit with type selector (Expense/Income/Money Transfer), category/suggestion auto-fill, fund selection, validation tooltips, split/hide options, delete with confirmation (899 lines)
- `transaction-form-html-design.tsx` — Alternative HTML form for dedicated add/edit pages with native controls (479 lines)
- `transactions-table-optimized.tsx` — Optimized transactions list with date-grouped cards, daily totals, category icons, split indicators, hidden transaction dimming, gradient fade masks (321 lines)
- `transaction-summary.tsx` — Monthly/yearly totals with comparison rows (vs previous month, vs same month last year), category breakdown, proration for current month, split handling (1330 lines)
- `dashboard-summary.tsx` — Dashboard with current/previous/same-month-last-year comparison tables, category breakdown with expandable subcategories (561 lines)
- `balance-chart.tsx` — Interactive balance line chart with previous-period overlay, time range selector (1M/1Y/5Y/All), responsive sizing (361 lines)
- `category-chart.tsx` — Bar chart for category spending over time with transaction count summary (349 lines)
- `balance.tsx` — Expandable fund categories grouped by top-level category, collapsible sections (188 lines)
- `overall-totals.tsx` — Global balance total display
- `fund-categories-manager.tsx` — Admin CRUD interface for fund categories with inline editing (426 lines)
- `filter-controls.tsx` — Advanced filter panel: type/category/currency/fund/amount-range/period multi-select with chip badges (389 lines)
- `search-summary.tsx` — Search results summary with income/expense/hidden breakdown (135 lines)
- `budget-card.tsx` — Budget display card with progress bar and color-coded thresholds (green/amber/red)
- `budget-form.tsx` — Budget add/edit form with category selection
- `pending-transactions-button.tsx` — Floating bell icon with count badge for pending bank transactions
- `pending-transactions-notifier.tsx` — Polling-based notifier for new bank transactions (60s interval)
- `no-transactions.tsx` — Empty state with illustration

### UI Components (`components/ui/`)
- **Form controls**: `input.tsx`, `label.tsx`, `select.tsx`, `category-select.tsx`, `title-suggestion-input.tsx`, `fund-select.tsx`, `searchable-select.tsx`, `multi-select-chips.tsx`, `switch.tsx`
- **Buttons**: `button.tsx`, `submit-button.tsx`, `floating-button.tsx`
- **Containers**: `card.tsx`, `badge.tsx`, `modal.tsx` (bottom-sheet with swipe-to-close)
- **Date/time**: `calendar.tsx`, `date-picker.tsx`, `date-time-picker.tsx`
- **Period selectors**: `horizontal-month-selector.tsx` (scrollable, auto-centered), `horizontal-year-selector.tsx`
- **Overlays**: `popover.tsx`, `dropdown-menu.tsx`, `modal.tsx`
- **Tooltips**: `validation-tooltip.tsx` (Floating UI), `hidden-transactions-tooltip.tsx`
- **Charts helpers**: `dual-range-slider.tsx`
- **Loading states**: `skeleton.tsx` with variants (pulse/wave/none) + dedicated skeleton components for balance, charts, forms, summaries, transaction lists
- **Privacy**: `privacy-blur.tsx` (CSS blur filter wrapper)
- **Mobile**: `pull-to-refresh-indicator.tsx`
- **Other**: `transaction-view-tabs.tsx`, `update-banner.tsx`, `daily-hidden-indicator.tsx`, `form-message.tsx`
- **Skeletons**: `balance-skeleton.tsx`, `chart-skeleton.tsx`, `form-skeleton.tsx`, `summary-skeleton.tsx`, `transaction-list-skeleton.tsx`

### Cache Manager (`components/cache-manager.tsx`)
- Listens for Supabase auth state changes (SIGNED_OUT, TOKEN_REFRESHED without session)
- Clears localStorage cache on sign-out/session expiry
- Renders nothing (returns null)

## Custom Hooks (31 total)

### Data Fetching
- `useTransaction.ts` — Fetch single transaction by ID
- `useTransactionsOptimized.ts` — Primary month-transaction hook: SWR with fallback cache, prefetching, real-time subscription handling, memoized totals
- `useYearTransactions.ts` — Fetch year transactions with CET boundary handling and adjacent-year prefetching
- `useAllTransactions.ts` — Fetch all user transactions via paginated batches
- `useOverallTotals.ts` — Fetch global EUR balance from `/api/overall-totals`
- `useTransactionSearch.ts` — Debounced (300ms) ilike search across transactions
- `useFundCategories.ts` — Fetch fund categories with calculated balances from transactions
- `useTitleSuggestions.ts` — Debounced (300ms) title suggestion search from transaction_title_patterns
- `useFilteredTransactions.ts` — Multi-dimensional filtering with 300ms debounce, supports type/category/currency/fund/amount/period filters
- `useDateRangeTransactions.ts` — Fetch transactions within arbitrary date ranges
- `useRangeTransactions.ts` — Fetch lightweight transaction data for time-range-based charts
- `useCategoryTransactions.ts` — Fetch transactions filtered by main/sub category with time range
- `useBudgets.ts` — Fetch budgets and compute spending progress

### Charts and Analytics
- `useBalanceHistory.ts` — Compute running balance series for time ranges (daily/weekly/monthly aggregation)
- `useBalanceComparisonHistory.ts` — Previous-period overlay data for balance charts
- `useCategoryHistory.ts` — Compute category spending history for time ranges
- `useDashboardComparison.ts` — Compare current, previous-month, and same-month-last-year transaction sets
- `useStartingBalance.ts` — Fetch balance-before-date via RPC for chart calculations

### Mutations
- `useTransactionMutations.ts` — addTransaction, updateTransaction, deleteTransaction with optimistic updates, EUR conversion, cache invalidation across month/year/balance/fund/overall-totals, rollback on error

### UI State
- `useModalState.ts` — Manage add/edit modal open/close state
- `usePendingTransactionModal.ts` — Zustand-based wizard for reviewing bank-imported transactions (open, next, current index)
- `usePrivacyMode.ts` — Consume privacy context from PrivacyProvider
- `usePullToRefresh.ts` — Touch-based pull-to-refresh gesture with resistance curve
- `useSlideAnimation.ts` — Direction-aware slide animation phase management

### Utilities
- `usePrefetch.ts` — Intelligent prefetch of adjacent months with dedup queue (500ms debounce)
- `useYearPrefetch.ts` — Intelligent prefetch of adjacent years with dedup queue
- `useAvailableMonths.ts` — Get earliest transaction date, generate month options with fallback range
- `useAvailableYears.ts` — Generate year options (2016 to current+5)
- `useBackgroundSync.ts` — Poll for remote changes every 60s when tab visible, compares row count and latest updated_at
- `useFormFieldProtection.ts` — Defensive hook preventing browser extension (1Password) conflicts with form fields
- `usePendingTransactions.ts` — Poll for pending bank transactions every 60s via SWR

## Supabase Integration

### Client Utilities (`utils/supabase/`)
- `client.ts` — Browser client via `createBrowserClient` from @supabase/ssr
- `server.ts` — Server client via `createServerClient` with cookie handling
- `middleware.ts` — Auth middleware: session refresh, protected route redirect, authenticated-user redirect from `/` to `/protected`
- `admin.ts` — Service-role client for admin operations (CSV import, data management)
- `database-utils.ts` — Bulk operations: `deleteAllUserTransactions()`, `getUserTransactionCount()`, `importTransactions()` with batch retry logic
- `pattern-utils.ts` — `TransactionPatternService` class: pattern upsert, ilike search, frequency tracking, cleanup
- `fetch-all.ts` — Generic paginated fetch-all helper (`fetchAllBatches<T>`)
- `env.ts` — Environment variable accessors with legacy key fallback
- `check-env-vars.ts` — Re-exports `hasSupabasePublicEnvVars` as `hasEnvVars` (tutorial compatibility)

### Database Features
- Row Level Security (RLS) policies for complete user data isolation
- Triggers for `updated_at` auto-updates and title pattern frequency maintenance
- Composite indexes on `(user_id, date)`, `(user_id, currency)` for query performance
- RPC functions: `get_overall_total_eur` (efficient total calculation), `get_balance_before_date` (historical balance), `cleanup_old_title_patterns`
- Real-time subscriptions via PostgreSQL LISTEN/NOTIFY (disabled on iOS Safari for performance)
- CET timezone-aware year boundaries (Jan 1 00:00 CET = Dec 31 23:00 UTC)

### Authentication Flow
- `app/actions.ts` — Server actions: `signInAction`, `signOutAction`, `resetPasswordAction`
- `proxy.ts` — Middleware matcher proxy for session update
- Cookie-based sessions for server-side auth
- User ID isolation enforced by RLS in all queries
- Cache clearing on sign-out via `cache-manager.tsx`

## External Services

### Frankfurter API (ECB Exchange Rates)
- **Endpoint**: api.frankfurter.app
- **Purpose**: Free ECB exchange rates, no API key required
- **Features**: Local DB caching, exponential backoff retry (3 attempts), fallback to most recent rate, marked-as-missing tracking, batch conversion with rate limiting
- **Implementation**: `utils/currency-conversion.ts`

### Enable Banking API
- **Purpose**: Automatic bank transaction import via PSD2 open banking
- **Auth**: RS256 JWT signed with private key (jose library), 5-minute token expiry
- **OAuth Flow**: `/api/enable-banking/auth` → bank redirect → `/api/enable-banking/callback`
- **Sync**: Background cron job (`/api/cron/sync`) polls for new transactions, deduplicates, inserts as pending
- **Implementation**: `utils/enable-banking/client.ts` (API client), `utils/enable-banking/sync-service.ts` (sync logic)
- **Environment**: Requires `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_PRIVATE_KEY`, `ENABLE_BANKING_KID`, `CRON_SECRET`

## State Management Strategy

### Dual Cache System
- **SWR**: In-memory client-side cache with dedup, revalidation, and keepPreviousData
- **localStorage**: Persistent cache serialized on mutation success (500ms debounce), hydrated on load
- Both caches updated simultaneously for consistency
- Fallback to cached data during network loads (instant navigation)
- 24-hour cache expiry, 6-hour TTL for transaction data, 2-hour for other data
- Cache cleared on sign-out or session expiry

### SWR Configuration (`lib/swr-config.ts`)
- `revalidateOnFocus: false` (reduces unnecessary refetches)
- `revalidateOnReconnect: false`
- `errorRetryCount: 2`
- `dedupingInterval: 10000`
- `keepPreviousData: true`

### Simple In-Memory Cache (`utils/simple-cache.ts`)
- LRU cache with 10-entry max and 1-hour TTL
- Used for transaction data to avoid redundant Supabase queries
- Singleton instance (`transactionCache`) shared across hooks and fetchers

### Zustand Store
- `usePendingTransactionModal.ts` — Wizard-style modal state for reviewing pending bank transactions

## Performance Optimizations

- **Optimistic Updates**: Immediate UI updates with full rollback on error
- **Dual Cache**: SWR (memory) + localStorage (persistence) for zero-load navigation
- **Prefetching**: Adjacent month/year data loaded proactively with dedup queue (500ms debounce)
- **Debounced Saves**: 500ms debounce for localStorage cache writes, 2s debounce for save calls
- **Client-Side Navigation**: `pushState` for month/year changes avoids RSC server round-trips
- **Memoized Components**: `TransactionRow` wrapped in `React.memo`, summary calculations memoized
- **Paginated Fetching**: `fetchAllBatches` for large datasets (1000 rows per page)
- **Simple In-Memory Cache**: LRU cache avoids redundant Supabase queries for frequently accessed data
- **Revalidation Strategy**: `revalidateOnFocus: false` prevents unnecessary refetches
- **CSS-Only Scrollbars**: Hidden scrollbars on month/year selectors
- **Bundle Optimization**: `optimizePackageImports` for lucide-react and @radix-ui/react-select

## Development Notes

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (required)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — Supabase publishable key (preferred)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Legacy anonymous key fallback
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key for admin operations
- `ENABLE_BANKING_APP_ID` — Enable Banking application ID
- `ENABLE_BANKING_PRIVATE_KEY` — Enable Banking RSA private key (PEM format)
- `ENABLE_BANKING_KID` — Enable Banking key ID (optional)
- `CRON_SECRET` — Shared secret for securing cron API endpoints
- `NEXT_PUBLIC_APP_URL` — Application base URL

### HTTPS Development
- Dev server runs with `--experimental-https` flag
- Self-signed certificates in `certificates/` directory (gitignored)
- Required for secure cookie handling and OAuth redirects

### Key Implementation Details
- Transaction forms support creation, editing, and money transfer modes with full validation
- Money transfers require source and target fund selection with different-funds validation
- Split transactions distribute amounts evenly across 12 months (penny rounding: January takes remainder)
- Monthly/yearly views use sticky scrollable period selectors that auto-center on selection
- Exchange rates cached locally with `is_missing` flag for retry logic
- CSV import supports Cashew format with batch validation and rate-limited currency conversion
- Title suggestions auto-track frequency and are ordered by recency × frequency
- Hide from totals feature for exclusion from summaries with visual dimming (50% opacity)
- Floating action buttons with stacked layout when multiple are visible
- Privacy mode blurs all financial data (6px blur filter) and persists to localStorage
- Pull-to-refresh on mobile with resistance curve and 80px threshold
- Search preserves referrer context for back-navigation
- Budgets display color-coded progress: green (< 90%), amber (90-100%), red (> 100%)
- Dashboard comparison shows current vs previous month vs same month last year in expandable sections
- Split read-only instances shown at 60% opacity with desaturation
- Daily hidden transaction indicator (EyeOff icon with count)

### Navigation and Routing
- Month navigation uses query parameters (`?year=2024&month=12`) with `pushState`
- Category/subcategory routes at `/protected/category/[category]` and `/protected/category/[category]/[subcategory]`
- Navigation component hides on add/edit pages
- Mobile: fixed bottom nav bar with safe-area-inset-bottom padding
- Desktop: horizontal inline nav links with active background highlight

### Styling Approach
- Tailwind CSS v4: theme configured via `@theme` directive in `app/globals.css` (no tailwind.config file)
- CSS variables for light/dark mode with `next-themes`
- Custom component variants via `class-variance-authority` (buttons, badges, labels)
- Consistent styling utilities in `utils/styling-utils.ts` for type-dependent colors, category styles
- Form components protect against browser extension (1Password) interference

### Error Handling
- Graceful fallbacks for missing exchange rates (use most recent available rate)
- Toast notifications (react-hot-toast) for all async operation feedback
- Retry logic with exponential backoff for network operations (import, exchange rates)
- Validation at import time and form submission with Floating UI tooltips (4s auto-dismiss)
- Supabase server client gracefully handles missing cookies in Server Components
- Split transaction fetching degrades gracefully if `split_across_year` column missing

### Testing
- No dedicated test files — relies on manual testing and visual verification

## Configuration Files

- `next.config.ts` — Turbopack, security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy), image optimization (WebP/AVIF), console removal in production, allowed dev origins, HTTPS
- `tsconfig.json` — Path alias `@/*`, strict TypeScript, `react-jsx`, bundler module resolution, Next.js plugin
- `components.json` — shadcn/ui configuration (RSC, Tailwind v4, neutral base, CSS variables)
- `postcss.config.js` — PostCSS with `@tailwindcss/postcss` plugin (Tailwind v4)
- `package.json` — Dependencies, scripts, ESM package configuration (private: true)
- `proxy.ts` — Supabase auth middleware matcher (excludes static files, images)
- `.env.example` — Template with required Supabase variables
