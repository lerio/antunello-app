"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import { Lock, Building2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, Suspense, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import useSWR, { useSWRConfig } from "swr";
import toast from "react-hot-toast";
import { useFundCategories } from "@/hooks/useFundCategories";
import { getSelectClass } from "@/utils/styling-utils";

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();

  // Show toast based on URL params
  useEffect(() => {
    const integration = searchParams.get("integration");
    if (integration === "success") {
      toast.success("Bank account connected successfully!", {
        id: "auth-success",
      });
      router.replace("/protected/settings");
    } else if (integration === "error") {
      toast.error("Failed to connect bank account.", { id: "auth-error" });
      router.replace("/protected/settings");
    }
  }, [searchParams, router]);

  // Fetch integration configs including 'settings' to get bank name/IBAN
  const { data: connectedAccounts, mutate } = useSWR(
    "integration-configs",
    async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("integration_configs")
        .select("*")
        .eq("user_id", user.id);
      return data || [];
    },
  );

  const { fundCategories, isLoading: isFundsLoading } = useFundCategories();

  const handleConnect = (bank: string, country: string) => {
    window.location.href = `/api/enable-banking/auth?bank=${encodeURIComponent(bank)}&country=${country}`;
  };

  const handleDisconnect = async (bankName: string) => {
    // Logic: disconnect by bank name if available, otherwise try to map Bunq legacy
    if (
      !confirm(`Are you sure you want to disconnect all ${bankName} accounts?`)
    )
      return;

    const toastId = toast.loading("Disconnecting...");
    try {
      const res = await fetch("/api/enable-banking/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bank_name: bankName }),
      });

      if (!res.ok) throw new Error("Failed to disconnect");

      await mutate(); // Refresh list
      toast.success("Disconnected successfully", { id: toastId });
    } catch (e) {
      toast.error("Error disconnecting", { id: toastId });
    }
  };

  const handleMappingChange = async (accountId: string, fundId: string) => {
    const toastId = toast.loading("Updating mapping...");
    try {
      const res = await fetch("/api/enable-banking/update-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          fund_category_id: fundId || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update mapping");

      await mutate();
      toast.success("Mapping updated", { id: toastId });
    } catch (e) {
      toast.error("Error updating mapping", { id: toastId });
    }
  };

  const handleBulkFetchChange = async (accountId: string, enabled: boolean) => {
    // Optimistic update could go here, but for now we rely on SWR revalidation
    const toastId = toast.loading("Updating settings...");
    try {
      const res = await fetch("/api/enable-banking/update-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          bulk_fetch_enabled: enabled,
        }),
      });

      if (!res.ok) throw new Error("Failed to update settings");

      await mutate();
      toast.success("Settings updated", { id: toastId });
    } catch (e) {
      toast.error("Error updating settings", { id: toastId });
    }
  };

  const handleFetch = async (accountId: string) => {
    const toastId = toast.loading("Fetching transactions...");
    try {
      const res = await fetch(`/api/cron/sync?account_id=${accountId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to fetch");

      // Check if new transactions were found (backend uses new_pending)
      const newFound = data.results?.some((r: any) => r.new_pending > 0);

      if (newFound) {
        toast.success("Sync complete! New transactions found.", { id: toastId });
        // Manually refresh pending transactions so the notification bubble updates
        globalMutate("pending-transactions");
      } else {
        toast.success("Sync complete. No new transactions.", { id: toastId });
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message}`, { id: toastId });
    }
  };

  const isConnected = (bankName: string) => {
    return connectedAccounts?.some((acc) => {
      const settings = (acc.settings as any) || {};
      // Check explicit bank name stored in settings
      if (settings.bank_name === bankName) return true;
      // Fallback: Check if Bunq and no bank name (legacy existing connection)
      if (
        bankName === "Bunq" &&
        !settings.bank_name &&
        acc.provider === "enable_banking"
      )
        return true;
      return false;
    });
  };

  const banks = [
    {
      name: "Bunq",
      country: "NL",
      icon: Building2,
      description: "Connect your Bunq (NL) accounts.",
    },
    {
      name: "Revolut",
      country: "IT",
      icon: Building2,
      description: "Connect your Revolut (IT) accounts.",
    },
    {
      name: "DKB",
      country: "DE",
      icon: Building2,
      description: "Connect your DKB (DE) accounts.",
    },
    {
      name: "PayPal",
      country: "IT",
      icon: Building2,
      description: "Connect your PayPal (IT) account.",
    },
    {
      name: "Wise",
      country: "IT",
      icon: Building2,
      description: "Connect your Wise (IT) accounts.",
    },
  ];

  return (
    <div className="container max-w-4xl py-6 lg:py-10 px-4">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Settings</h3>
          <p className="text-sm text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        <hr className="my-4 border-gray-200 dark:border-gray-700" />

        <div className="grid gap-6 w-full max-w-full">
          <Card className="w-full max-w-full overflow-hidden">
            <CardHeader>
              <CardTitle>Bank Integrations</CardTitle>
              <CardDescription>
                Connect your bank accounts to automatically import transactions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6">
              <div className="grid gap-4">
                {banks.map((bank) => {
                  const connected = isConnected(bank.name);
                  return (
                    <div
                      key={bank.name}
                      className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <bank.icon className="h-5 w-5 text-blue-500" />
                          <span className="font-semibold">{bank.name}</span>
                          {connected && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              Connected
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {bank.description}
                        </p>
                      </div>
                      {connected ? (
                        <Button
                          onClick={() => handleDisconnect(bank.name)}
                          variant="destructive"
                          size="sm"
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleConnect(bank.name, bank.country)}
                          variant="outline"
                          size="sm"
                        >
                          Connect
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {connectedAccounts && connectedAccounts.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-sm font-medium">
                    Connected Account Details
                  </h4>
                  <div className="space-y-2">
                    {connectedAccounts.map((acc) => {
                      const settings = (acc.settings as any) || {};
                      // If no bank name, assume bunq if provider is enable_banking (legacy fix)
                      const bankName =
                        settings.bank_name ||
                        (acc.provider === "enable_banking"
                          ? "Bunq"
                          : "Unknown");
                      const iban = settings.iban;

                      return (
                        <div
                          key={acc.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 gap-4"
                        >
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium flex items-center gap-2 flex-wrap">
                                {bankName}
                                {iban && (
                                  <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded truncate max-w-[150px] sm:max-w-none">
                                    {iban}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400 truncate">
                                ID: {acc.account_id}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 dark:border-gray-800">
                            <div className="flex items-center justify-between sm:justify-end gap-2 w-full">
                              <span className="text-xs text-gray-400 opacity-70">
                                Last sync:{" "}
                                {acc.last_sync_at
                                  ? new Date(acc.last_sync_at).toLocaleDateString()
                                  : "Never"}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                onClick={() => handleFetch(acc.account_id)}
                                title="Fetch transactions now"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="flex flex-col gap-1 w-full sm:w-auto sm:items-end">
                              <label className="text-[10px] text-gray-500 uppercase font-semibold">
                                Link to Fund
                              </label>
                              <select
                                className={getSelectClass(isFundsLoading) + " w-full sm:w-auto"}
                                value={settings.fund_category_id || ""}
                                onChange={(e) =>
                                  handleMappingChange(acc.account_id, e.target.value)
                                }
                                disabled={isFundsLoading}
                              >
                                <option value="">No mapping</option>
                                {fundCategories
                                  .filter((f) => f.is_active)
                                  .map((fund) => (
                                    <option key={fund.id} value={fund.id}>
                                      {fund.name} ({fund.currency})
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div className="flex items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                              <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                                Bulk Fetch
                              </label>
                              <Switch
                                checked={!!settings.bulk_fetch_enabled}
                                onCheckedChange={(checked) =>
                                  handleBulkFetchChange(acc.account_id, checked)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="w-full max-w-full overflow-hidden">
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>
                Update your account information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-gray-500">
                    Change your password to keep your account secure.
                  </p>
                </div>
                <Button variant="outline" asChild className="w-full sm:w-auto">
                  <Link href="/protected/reset-password">
                    <Lock className="mr-2 h-4 w-4" />
                    Reset Password
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div >
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
