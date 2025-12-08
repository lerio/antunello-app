# GEMINI.md

This file provides context and guidance for Gemini when working with code in this repository.

## Project Overview

Antunello is a comprehensive personal finance tracking application built with Next.js 16, React 19, Supabase, and shadcn/ui. The app tracks income and expenses with categorized transactions, multi-currency support, fund account management, and real-time data synchronization.

## Architecture

- **Framework**: Next.js 16.0.7 with App Router, React 19.2.1
- **Database**: Supabase (PostgreSQL with real-time subscriptions and RLS policies)
- **Authentication**: Supabase Auth with cookie-based sessions (@supabase/ssr)
- **Styling**: Tailwind CSS v4 with PostCSS and shadcn/ui components
- **State Management**: SWR 2.3.7 with localStorage persistence for data fetching and caching
- **Type Safety**: TypeScript 5.9.3 throughout
- **UI Components**: shadcn/ui, Radix UI primitives, Lucide React icons
- **Build Tool**: Turbopack (Next.js bundler)
- **Theming**: next-themes for dark mode support

## Key Features

- **Transaction Management**: Add, edit, delete transactions with optimistic updates
- **Multi-Currency Support**: Automatic EUR conversion using ECB exchange rates (Frankfurter API)
- **Fund Categories**: Track balances across bank accounts, savings, investments, and other fund types
- **Monthly/Yearly Views**: Organized transaction views with sticky period selectors
- **Search**: Real-time full-text search across all transactions
- **CSV Import**: Bulk import from Cashew-formatted CSV files with validation
- **Title Suggestions**: Auto-tracked transaction titles by category for quick data entry
- **Exchange Rate Caching**: Local database caching with retry logic for missing rates
- **Hide from Totals**: Flag transactions to exclude from summaries
- **Real-time Sync**: PostgreSQL LISTEN/NOTIFY for instant updates across devices

## Common Commands

```bash
npm run dev      # Start development server on localhost:3000
npm run build    # Build for production
npm start        # Start production server
```

### Maintenance Scripts
```bash
npm run find-pipe-titles         # Find transactions with pipe characters in titles
npm run update-pipe-titles       # Dry run: Check for transactions needing pipe title updates
npm run update-pipe-titles:execute # Execute: Update transactions with pipe titles
```

## Key Directories

- `app/` - Next.js App Router pages, layouts, and API routes
  - `(auth)/` - Authentication routes (sign-in)
  - `protected/` - Protected application routes (dashboard, add, edit, etc.)
  - `api/` - API routes
- `components/` - Reusable UI components organized by purpose:
  - `ui/` - Base shadcn/ui components (buttons, inputs, etc.)
  - `features/` - Business logic components (forms, tables, summaries)
  - `layout/` - Layout-specific components (header, user menu)
- `hooks/` - Custom React hooks for data operations and state management
- `utils/` - General utilities and Supabase client configurations
  - `supabase/` - Client, server, middleware, database-utils, pattern-utils
  - `csv-import.ts` - CSV parsing and validation
  - `currency-conversion.ts` - Multi-currency EUR conversion
  - `transaction-fetcher.ts` - SWR fetcher for transactions
- `lib/` - Utility functions and configurations
  - `swr-config.ts` - Global SWR configuration with localStorage
  - `cache-persistence.ts` - Cache serialization/deserialization
- `types/` - TypeScript type definitions (database, transactions, fund categories)
- `migrations/` - Database migration SQL files
- `scripts/` - Build and data processing scripts
- `public/` - Static assets

## Application Pages

- `/protected` - Home dashboard with balance overview
- `/protected/transactions` - Monthly transaction list view
- `/protected/year` - Yearly summary aggregated by month
- `/protected/search` - Real-time transaction search with filters
- `/protected/add` - Dedicated transaction add page
- `/protected/edit/[id]` - Edit transaction by ID
- `/protected/budgets` - Budget management (coming soon)
- `/protected/settings` - Settings and password reset
- `/protected/admin` - Admin dashboard (CSV import, fund categories)
- `/protected/reset-password` - Password reset functionality
- `/(auth)/sign-in` - Authentication login page

## Data Model

### Transaction
Primary entity for tracking income and expenses:
- **Location**: `types/database.ts` defines the schema.
- **Attributes**: Amount, currency, type (expense/income), categories (main & sub), title, date.
- **Currency conversion**: `eur_amount`, `exchange_rate`, `rate_date`
- **Features**: `hide_from_totals`, `fund_category_id`
- **Security**: RLS enabled; users can only access their own transactions.

### FundCategory
Track fund accounts and their balances:
- **Attributes**: `name`, `description`, `currency`, `amount`
- **Organization**: `top_level_category`, `order_index`, `is_active`

### ExchangeRate
Cached exchange rates for currency conversion:
- **Attributes**: `date`, `base_currency`, `target_currency`, `rate`
- **Tracking**: `source`, `is_missing`

### TitleSuggestion
Auto-tracked transaction titles for suggestions:
- **Attributes**: `title`, `type`, `main_category`, `sub_category`
- **Usage**: `frequency`, `last_used_at`

### Categories
19 predefined main categories with subcategories in `types/database.ts`.

## Component Organization

### Layout Components (`components/layout/`)
- `navigation.tsx` - Mobile (bottom) and desktop (top) navigation
- `header-auth.tsx` - Authentication header with user menu
- `user-menu.tsx` - Dropdown user menu
- `theme-toggle.tsx` - Dark/light theme switcher

### Feature Components (`components/features/`)
- `transaction-form-modal.tsx` - Modal form for add/edit with validation
- `transaction-form-html-design.tsx` - HTML form for dedicated pages
- `transactions-table-optimized.tsx` - Optimized table with lazy loading
- `transaction-summary.tsx` - Monthly/yearly summary with charts
- `balance.tsx` - Expandable fund categories balance display
- `overall-totals.tsx` - Global balance total display
- `fund-categories-manager.tsx` - Admin interface for fund management
- `search-summary.tsx` - Search results summary stats
- `cache-manager.tsx` - Cache lifecycle management

### UI Components (`components/ui/`)
- Standard shadcn/ui components plus specialized inputs like `category-select.tsx` and `title-suggestion-input.tsx`.

## Custom Hooks

### Data Fetching
- `useTransaction.ts`, `useTransactionsOptimized.ts`, `useYearTransactions.ts`
- `useAllTransactions.ts`, `useOverallTotals.ts`, `useTransactionSearch.ts`
- `useFundCategories.ts`, `useTitleSuggestions.ts`

### Mutations
- `useTransactionMutations.ts` - Add/update/delete with optimistic updates

### Utilities
- `usePrefetch.ts`, `useYearPrefetch.ts` - Intelligent data prefetching
- `useAvailableMonths.ts`, `useAvailableYears.ts` - Date pickers support

## Supabase Integration

### Client Utilities
- `utils/supabase/client.ts` - Client-side instance
- `utils/supabase/server.ts` - Server-side instance
- `utils/supabase/middleware.ts` - Auth middleware
- `utils/supabase/database-utils.ts` - Bulk operations

### Database Features
- **RLS Policies**: User data isolation
- **Triggers**: Auto-updates for timestamps and pattern frequency
- **RPC Functions**: `get_overall_total_eur` for efficient totals
- **Real-time**: PostgreSQL LISTEN/NOTIFY subscriptions

## External Services

### Frankfurter API (ECB Exchange Rates)
- **Endpoint**: api.frankfurter.app
- **Features**: Free, no key required, local caching, retry logic
- **Implementation**: `utils/currency-conversion.ts`

## Performance Optimizations

- **Optimistic Updates**: Instant UI feedback
- **Dual Cache**: SWR (memory) + localStorage (persistence)
- **Prefetching**: Adjacent periods loaded proactively
- **Debounced Saves**: Efficient cache persistence
- **Memoized Calculations**: Summary statistics cached

## Development Notes

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### State Management Strategy
- Dual cache system ensures data is available immediately on reload via localStorage while SWR revalidates in the background.

### Error Handling
- Graceful fallbacks for missing exchange rates.
- Retry logic with exponential backoff for network operations.
- Toast notifications for user feedback.
