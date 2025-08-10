import { EnvVarWarning } from "@/components/layout/env-var-warning";
import HeaderAuth from "@/components/layout/header-auth";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { Geist, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import "./globals.css";
import { Suspense } from "react";
import { Toaster } from "react-hot-toast";
import { SWRConfig } from "swr";
import { swrConfig } from "@/lib/swr-config";
import { CacheManager } from "@/components/cache-manager";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Antunello App",
  description: "...dei conti se ne occupa lui",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.className} ${inter.variable}`} suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100" style={{ fontFamily: 'Inter, sans-serif' }}>
        <Suspense fallback={<div>Loading...</div>}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SWRConfig value={swrConfig}>
              <CacheManager />
              <div className="min-h-screen flex flex-col">
                <Toaster position="top-right" />
                
                {/* New Header Design */}
                <header className="bg-white dark:bg-gray-800 shadow-sm">
                  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-gray-900 dark:bg-gray-100 rounded-full flex items-center justify-center text-white dark:text-gray-900 font-bold text-lg">
                        N
                      </div>
                      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Antunello App</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                      {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                    </div>
                  </div>
                </header>

                {/* Main Content */}
                <main className="flex-grow">
                  {children}
                </main>

                <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
                  <p>
                    Made in 🇯🇵 by{" "}
                    <a
                      href="https://www.linkedin.com/in/valerio-donati-b0b0b21/"
                      target="_blank"
                      className="font-bold hover:underline"
                      rel="noreferrer"
                    >
                      Lerio
                    </a>
                  </p>
                </footer>
              </div>
            </SWRConfig>
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
