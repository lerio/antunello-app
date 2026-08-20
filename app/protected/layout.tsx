import { BackgroundSyncProvider } from "@/components/layout/background-sync-provider";

/**
 * Layout shared by all protected pages.
 *
 * Mounts the background sync provider once so every protected page detects
 * remote changes (single user, multiple devices) and auto-revalidates its
 * data, with the update banner as a cue.
 */
export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <BackgroundSyncProvider>{children}</BackgroundSyncProvider>;
}
