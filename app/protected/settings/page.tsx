import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Lock } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="container max-w-4xl py-6 lg:py-10 px-4">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Settings</h3>
          <p className="text-sm text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>
        
        {/* Separator replacement since I'm not sure if it exists, standard hr */}
        <hr className="my-4 border-gray-200 dark:border-gray-700" />

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>
                Update your account information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-gray-500">
                    Change your password to keep your account secure.
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/protected/reset-password">
                    <Lock className="mr-2 h-4 w-4" />
                    Reset Password
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>App Preferences</CardTitle>
              <CardDescription>
                Customize your experience.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 italic">
                More settings coming soon...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
