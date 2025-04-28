import { signInAction } from "@/app/actions";
import { FormMessage } from "@/components/ui/form-message"; // Updated import path
import { SubmitButton } from "@/components/ui/submit-button"; // Updated import path
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { Message } from "@/components/ui/form-message"; // Import the Message type

export default async function Login(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  return (
    <form className="flex-1 flex flex-col min-w-64">
      <h1 className="text-2xl font-medium">Sign in</h1>
      <div className="flex flex-col gap-2 [&>input]:mb-3 mt-8">
        <Label htmlFor="email">Email</Label>
        <Input
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
          type="password"
          name="password"
          placeholder="Your password"
          required
        />
        <SubmitButton pendingText="Signing In..." formAction={signInAction}>
          Sign in
        </SubmitButton>
        <FormMessage message={searchParams as Message} />
      </div>
    </form>
  );
}
