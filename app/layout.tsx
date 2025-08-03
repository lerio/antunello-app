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

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Antunello App",
  description: "...dei conti se ne occupa lui",
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
      <body className="bg-background text-foreground">
        <Suspense fallback={<div>Loading...</div>}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SWRConfig value={swrConfig}>
              <main className="min-h-screen flex flex-col items-center">
                <Toaster position="top-right" />
                <div className="flex-1 w-full flex flex-col items-center">
                  <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                    <div className="w-full max-w-[800px] flex justify-between items-center p-3 px-3 sm:px-6 lg:px-8 text-sm">
                      <div className="flex gap-5 items-center font-semibold">
                        <Link href={"/"}>Antunello App</Link>
                      </div>
                      {!hasEnvVars ? <EnvVarWarning /> : <HeaderAuth />}
                    </div>
                  </nav>
                  <div className="w-full">{children}</div>

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
              </main>
            </SWRConfig>
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
