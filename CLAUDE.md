# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Antunello App is a personal finance tracking application built with Next.js 15, Supabase, and shadcn/ui. The app allows users to track income and expenses with categorized transactions.

## Architecture
- **Framework**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Authentication**: Supabase Auth with cookie-based sessions
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **State Management**: SWR for data fetching and caching
- **Type Safety**: TypeScript throughout

## Common Commands
```bash
npm run dev      # Start development server on localhost:3000
npm run build    # Build for production
npm start        # Start production server
```

## Key Directories
- `app/` - Next.js App Router pages and layouts
- `components/` - Reusable UI components organized by purpose:
  - `ui/` - Base shadcn/ui components
  - `features/` - Business logic components (forms, tables, summaries)
  - `layout/` - Layout-specific components (header, warnings)
- `utils/supabase/` - Supabase client configurations for different contexts
- `hooks/` - Custom React hooks for data operations
- `types/` - TypeScript type definitions

## Data Model
Core entity is `Transaction` with categorized expense/income tracking:
- Categories are predefined in `types/database.ts` with main categories and sub-categories
- Transactions include amount, currency, type, categories, title, and date
- User authentication required for all transaction operations

## Supabase Integration
- Client-side: `utils/supabase/client.ts`
- Server-side: `utils/supabase/server.ts` 
- Middleware: `utils/supabase/middleware.ts`
- Auth actions in `app/actions.ts`

## Development Notes
- Environment variables required: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Uses SWR for optimistic updates and real-time data sync
- Transaction forms support both creation and editing modes
- Monthly/yearly views for transaction organization