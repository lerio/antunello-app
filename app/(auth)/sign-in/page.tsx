import { signInAction } from "@/app/actions";
import { FormMessage } from "@/components/ui/form-message"; // Updated import path
import { SubmitButton } from "@/components/ui/submit-button"; // Updated import path
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { Message } from "@/components/ui/form-message"; // Import the Message type

export default async function Login(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed-width-container py-6">
        <div className="max-w-md mx-auto">
          <form className="flex flex-col">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-left">
              Sign in
            </h1>
            <div className="flex flex-col gap-2 [&>input]:mb-3 mt-8">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                placeholder="you@example.com"
                required
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                inputMode="email"
              />
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                name="password"
                placeholder="Your password"
                required
              />
              <SubmitButton
                pendingText="Signing In..."
                formAction={signInAction}
              >
                Sign in
              </SubmitButton>
              <FormMessage message={searchParams} />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
