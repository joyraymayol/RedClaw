"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
import { sendPasswordReset, type AuthFormState } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    sendPasswordReset,
    {}
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a reset link. If you only
          sign in with Google, this also lets you add a password to your
          account.
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
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        {state.success && (
          <p
            role="status"
            className="mt-4 rounded-md border bg-muted/50 p-2.5 text-xs text-muted-foreground"
          >
            {state.success}
          </p>
        )}
        {state.error && (
          <p
            role="alert"
            className="border-destructive/30 text-destructive mt-4 rounded-md border bg-destructive/5 p-2.5 text-xs"
          >
            {state.error}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
