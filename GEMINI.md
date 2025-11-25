# GEMINI.md

This file provides context and guidance for Gemini when working with code in this repository.

## Project Overview

Antunello is a personal finance tracking application built with Next.js 16, React 19, Supabase, and shadcn/ui. The app allows users to track income and expenses with categorized transactions.

## Architecture

- **Framework**: Next.js 16 with App Router
- **Runtime**: React 19
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Authentication**: Supabase Auth with cookie-based sessions (@supabase/ssr)
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **State Management**: SWR for data fetching and caching
- **Type Safety**: TypeScript 5.9

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

- `app/` - Next.js App Router pages and layouts
  - `(auth)/` - Authentication routes (sign-in)
  - `protected/` - Protected application routes (dashboard, add, edit, etc.)
  - `api/` - API routes
- `components/` - Reusable UI components organized by purpose:
  - `ui/` - Base shadcn/ui components (buttons, inputs, etc.)
  - `features/` - Business logic components (forms, tables, summaries)
  - `layout/` - Layout-specific components (header, user menu)
- `utils/supabase/` - Supabase client configurations
  - `client.ts` - Client-side Supabase client
  - `server.ts` - Server-side Supabase client
  - `middleware.ts` - Middleware for session management
- `hooks/` - Custom React hooks for data operations (e.g., `useTransaction`, `useOverallTotals`)
- `types/` - TypeScript type definitions (`database.ts` holds the schema types)
- `scripts/` - Node.js maintenance and migration scripts

## Data Model

The core entity is `Transaction`.
- **Location**: `types/database.ts` defines the schema.
- **Attributes**: Amount, currency, type (income/expense), categories (main & sub), title, date.
- **Security**: Row Level Security (RLS) is enabled; users can only access their own transactions.

## Development Patterns

- **Data Fetching**: Uses SWR for client-side fetching, caching, and optimistic updates.
- **Authentication**: Handled via Supabase Auth. Middleware protects routes in `app/protected/`.
- **Forms**: React Hook Form principles (likely manual or via shadcn patterns) with validation.
- **Styling**: Utility-first with Tailwind. Dark mode support via `next-themes`.
- **Env Variables**: Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
