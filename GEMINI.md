# GEMINI.md

## Project Overview

This is a Next.js web application for personal finance management, named "Antunello App". It uses Supabase for the backend and authentication, and Tailwind CSS with shadcn/ui for styling. The application allows users to track their income and expenses, categorize transactions, and view monthly summaries. It supports multiple currencies with automatic conversion to EUR.

The frontend is built with React and Next.js, utilizing features like the App Router, Server Components, and Server Actions. State management on the client-side is handled with SWR. The UI is designed to be responsive and modern, with a focus on performance through techniques like lazy loading components.

## Building and Running

To build and run the project locally, follow these steps:

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Set up environment variables:**
    Rename `.env.example` to `.env.local` and add your Supabase project URL and anon key.
    ```
    NEXT_PUBLIC_SUPABASE_URL=[INSERT SUPABASE PROJECT URL]
    NEXT_PUBLIC_SUPABASE_ANON_KEY=[INSERT SUPABASE PROJECT API ANON KEY]
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

4.  **Build for production:**
    ```bash
    npm run build
    ```

5.  **Start the production server:**
    ```bash
    npm run start
    ```

## Development Conventions

*   **Styling:** The project uses Tailwind CSS for utility-first styling, with components from shadcn/ui.
*   **Components:** Components are organized into `components/features`, `components/layout`, and `components/ui`. Feature components encapsulate specific application functionalities.
*   **Data Fetching:** SWR is used for data fetching and caching on the client-side.
*   **Authentication:** Authentication is handled by Supabase Auth, with session management implemented in the middleware.
*   **Database Types:** TypeScript types for the database schema are defined in `types/database.ts`.
*   **Server Actions:** Server-side logic is implemented using Next.js Server Actions in `app/actions.ts`.
*   **Environment Variables:** Supabase credentials and other secrets are managed through environment variables.
*   **Linting and Formatting:** TODO: Add information about linting and formatting tools if they are configured in the project.
