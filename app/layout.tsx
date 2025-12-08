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
import { getClientSwrConfig } from "@/lib/swr-config";
import { CacheManager } from "@/components/cache-manager";
import {
  MobileNavigation,
  DesktopNavigation,
} from "@/components/layout/navigation";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PrivacyProvider } from "@/components/layout/privacy-provider";
import { PrivacyToggle } from "@/components/layout/privacy-toggle";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Antunello",
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
    <html
      lang="en"
      className={`${geistSans.className} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body
        className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="w-8 h-8 bg-gray-900 dark:bg-gray-100 rounded-full flex items-center justify-center text-white dark:text-gray-900 font-bold text-lg animate-pulse">
                A
              </div>
            </div>
          }
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <PrivacyProvider>
              <SWRConfig value={getClientSwrConfig()}>
                <CacheManager />
              <div className="min-h-screen flex flex-col overflow-x-clip">
                <Toaster position="top-right" />

                {/* New Header Design */}
                <header className="bg-white dark:bg-gray-800 shadow-sm relative z-[60]">
                  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-8">
                      <Link
                        href="/protected"
                        className="flex items-center space-x-4 hover:opacity-80 transition-opacity"
                      >
                        <div className="w-8 h-8 bg-gray-900 dark:bg-gray-100 rounded-full flex items-center justify-center text-white dark:text-gray-900 font-bold text-lg">
                          A
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 hidden sm:block">
                          Antunello
                        </h1>
                      </Link>

                      {/* Desktop Navigation */}
                      <DesktopNavigation />
                    </div>

                    <div className="flex items-center space-x-4">
                      <ThemeToggle />
                      <PrivacyToggle />
                      {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                    </div>
                  </div>
                </header>

                {/* Main Content */}
                <main className="flex-grow pb-20 md:pb-0">{children}</main>

                <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16 mb-16 md:mb-0">
                  <p>
                    Made in 🇯🇵&nbsp;&nbsp;by{" "}
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

                {/* Mobile Navigation */}
                <MobileNavigation />
              </div>
            </SWRConfig>
            </PrivacyProvider>
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
