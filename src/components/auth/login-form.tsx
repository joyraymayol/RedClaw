"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { GoogleIcon } from "@/components/auth/google-icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPassword, type AuthFormState } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    signInWithPassword,
    { error: initialError }
  );
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState(false);

  async function signInWithGoogle() {
    setOauthPending(true);
    setOauthError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setOauthError("Couldn't start Google sign-in. Please try again.");
      setOauthPending(false);
    }
    // On success the browser navigates away to Google.
  }

  const error = state.error ?? oauthError;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Sign in to RedClaw</CardTitle>
        <CardDescription>
          Maintenance console access for the Plaspack team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
        <form className="space-y-4" action={formAction} suppressHydrationWarning>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@gmail.com"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-primary underline-offset-4 transition-colors hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-2 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              or continue with
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={signInWithGoogle}
          disabled={oauthPending}
        >
          <GoogleIcon className="size-4" />
          {oauthPending ? "Redirecting to Google…" : "Continue with Google"}
        </Button>

        {error && (
          <p
            role="alert"
            className="border-destructive/30 text-destructive mt-4 rounded-md border bg-destructive/5 p-2.5 text-xs"
          >
            {error}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          No account? Sign in with your Google account to request access.
        </p>
      </CardFooter>
    </Card>
  );
}
