# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Antunello is a comprehensive personal finance tracking application built with Next.js 16, Supabase, and shadcn/ui. The app tracks income and expenses with categorized transactions, multi-currency support, fund account management, and real-time data synchronization.

## Architecture

- **Framework**: Next.js 16.0.5 with App Router, React 19.2.0
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
npm run dev                     # Start development server on localhost:3000
npm run build                   # Build for production
npm start                       # Start production server
npm run find-pipe-titles        # Utility to discover transaction title patterns
npm run update-pipe-titles      # Utility to update transaction title patterns
```

## Key Directories

- `app/` - Next.js App Router pages, layouts, and API routes
- `components/` - Reusable UI components organized by purpose:
  - `ui/` - Base shadcn/ui components (button, input, select, modal, etc.)
  - `features/` - Business logic components (forms, tables, summaries, balance)
  - `layout/` - Layout components (navigation, header, theme toggle)
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
- `/protected/transactions` - Monthly transaction list view (currently points to /protected)
- `/protected/year` - Yearly summary aggregated by month
- `/protected/search` - Real-time transaction search with filters
- `/protected/add` - Dedicated transaction add page
- `/protected/edit/[id]` - Edit transaction by ID
- `/protected/budgets` - Budget management (coming soon)
- `/protected/settings` - Settings and password reset
- `/protected/admin` - Admin dashboard (CSV import, fund categories, data management)
- `/protected/reset-password` - Password reset functionality
- `/(auth)/sign-in` - Authentication login page

## Data Models

### Transaction
Primary entity for tracking income and expenses:
- Core fields: `id`, `user_id`, `amount`, `currency`, `type` (expense/income)
- Categorization: `main_category`, `sub_category`, `title`, `date`
- Currency conversion: `eur_amount`, `exchange_rate`, `rate_date`
- Features: `hide_from_totals`, `fund_category_id`
- Timestamps: `created_at`, `updated_at`

### FundCategory
Track fund accounts and their balances:
- Fields: `id`, `user_id`, `name`, `description`, `currency`, `amount`
- Organization: `top_level_category`, `order_index`, `is_active`
- Top-level categories: Bank Accounts, Savings Accounts, Investments, P2P Lending, Financial Services, Cash

### ExchangeRate
Cached exchange rates for currency conversion:
- Fields: `id`, `date`, `base_currency`, `target_currency`, `rate`
- Tracking: `source`, `is_missing`, `created_at`, `updated_at`

### TitleSuggestion
Auto-tracked transaction titles for suggestions:
- Fields: `id`, `user_id`, `title`, `type`, `main_category`, `sub_category`
- Usage: `frequency`, `last_used_at`, `created_at`, `updated_at`

### Categories
19 predefined main categories with subcategories in `types/database.ts`:
- Income: Primary Income, Government Benefits, Other Income
- Expenses: Dining, Groceries, Housing, Transportation, Shopping, Health, Entertainment, Travel, Education, Fitness, Personal Care, Services, Insurance, Taxes and Fines, Gifts and Donations, Bank Movements

## Component Organization

### Layout Components (`components/layout/`)
- `navigation.tsx` - Mobile (bottom) and desktop (top) navigation
- `header-auth.tsx` - Authentication header with user menu
- `user-menu.tsx` - Dropdown user menu
- `theme-toggle.tsx` - Dark/light theme switcher
- `env-var-warning.tsx` - Environment variable validation warning

### Feature Components (`components/features/`)
- `transaction-form-modal.tsx` - Modal form for add/edit with validation
- `transaction-form-html-design.tsx` - HTML form for dedicated pages
- `transactions-table-optimized.tsx` - Optimized table with lazy loading
- `transaction-summary.tsx` - Monthly/yearly summary with charts
- `balance.tsx` - Expandable fund categories balance display
- `overall-totals.tsx` - Global balance total display
- `fund-categories-manager.tsx` - Admin interface for fund management
- `search-summary.tsx` - Search results summary stats
- `cache-manager.tsx` - Cache lifecycle management (localStorage sync)

### UI Components (`components/ui/`)
- Form controls: `input.tsx`, `label.tsx`, `select.tsx`, `category-select.tsx`, `title-suggestion-input.tsx`
- Buttons: `button.tsx`, `submit-button.tsx`, `floating-button.tsx`
- Containers: `card.tsx`, `badge.tsx`, `modal.tsx`
- Period selectors: `horizontal-month-selector.tsx`, `horizontal-year-selector.tsx`
- Tooltips: `validation-tooltip.tsx`, `hidden-transactions-tooltip.tsx`
- Dropdowns: `dropdown-menu.tsx`

## Custom Hooks

### Data Fetching
- `useTransaction.ts` - Fetch single transaction by ID
- `useTransactionsOptimized.ts` - Fetch month transactions with real-time updates
- `useYearTransactions.ts` - Aggregate yearly data
- `useAllTransactions.ts` - Fetch all transactions
- `useOverallTotals.ts` - Fetch global balance total
- `useTransactionSearch.ts` - Real-time transaction search
- `useFundCategories.ts` - Fetch fund categories with balances
- `useTitleSuggestions.ts` - Get title suggestions by category

### Mutations
- `useTransactionMutations.ts` - Add/update/delete with optimistic updates

### Utilities
- `usePrefetch.ts` - Intelligent prefetch of adjacent months
- `useYearPrefetch.ts` - Year data prefetching
- `useAvailableMonths.ts` - Get available months for date picker
- `useAvailableYears.ts` - Get available years
- `useModalState.ts` - Modal state management
- `useFormFieldProtection.ts` - Unsaved changes warning
- `useSlideAnimation.ts` - Slide animation effects

## Supabase Integration

### Client Utilities
- `utils/supabase/client.ts` - Client-side Supabase instance
- `utils/supabase/server.ts` - Server-side Supabase instance
- `utils/supabase/middleware.ts` - Auth middleware for route protection
- `utils/supabase/database-utils.ts` - Bulk operations (import, delete, count)
- `utils/supabase/pattern-utils.ts` - Transaction pattern matching/search
- `utils/supabase/check-env-vars.ts` - Environment variable validation

### Database Features
- Row Level Security (RLS) policies for user data isolation
- Triggers for `updated_at` auto-updates
- Trigger for maintaining title pattern frequency
- Indexes on `user_id`, `date`, `currency` for performance
- RPC function `get_overall_total_eur` for efficient total calculations
- Real-time subscriptions via PostgreSQL LISTEN/NOTIFY

### Authentication
- `app/actions.ts` - Sign-in, sign-out, and auth actions
- Cookie-based sessions for server-side auth
- User ID isolation in all queries via RLS

## External Services

### Frankfurter API (ECB Exchange Rates)
- **Endpoint**: api.frankfurter.app
- **Purpose**: Free ECB exchange rates with no API key required
- **Features**: Local caching, retry logic, fallback to recent rates
- **Implementation**: `utils/currency-conversion.ts`

### API Routes
- `/api/overall-totals` - RPC call for total balance calculation

## Performance Optimizations

- **Optimistic Updates**: Immediate UI updates with rollback on error
- **SWR Cache**: Client-side cache with localStorage persistence
- **Prefetching**: Adjacent month/year data loaded proactively
- **Debounced Saves**: 500ms debounce for cache persistence
- **Dynamic Imports**: Form components loaded on demand
- **Memoized Calculations**: Summary statistics cached
- **Dual Cache System**: SWR + localStorage for consistency

## Development Notes

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (required)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (required)

### Key Implementation Details
- Transaction forms support both creation and editing modes with validation
- Monthly/yearly views with sticky period selectors
- Real-time subscriptions filtered per user for security
- Exchange rates cached locally with marked-as-missing flags
- CSV import supports Cashew format with detailed error reporting
- Title suggestions auto-tracked with frequency-based ranking
- Hide from totals feature for exclusion from summaries
- Floating action buttons with stacked layout when multiple
- Scroll-to-top button appears after 300px scroll
- Search preserves referrer context for navigation

### State Management Strategy
- Dual cache: SWR (client-side) + localStorage (persistence)
- Both caches updated simultaneously for consistency
- Automatic sync on navigate/reload
- Fallback to cached data during loads

### Error Handling
- Graceful fallbacks for missing exchange rates
- Toast notifications (react-hot-toast) for async operations
- Retry logic with exponential backoff
- Validation at import and form submission

### Testing
- No dedicated test files - relies on manual testing and visual verification

## Configuration Files

- `next.config.ts` - Turbopack, security headers, image optimization, console removal in production
- `tsconfig.json` - Path alias `@/*`, strict TypeScript configuration
- `components.json` - shadcn/ui component configuration
- `postcss.config.js` - PostCSS with Tailwind CSS v4
- `package.json` - Dependencies, scripts, and package configuration
