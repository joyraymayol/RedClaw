"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword, type AuthFormState } from "@/lib/actions/auth";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    updatePassword,
    {}
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Set a new password</CardTitle>
        <CardDescription>
          You&apos;ll use this password (or Google) to sign in from now on.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
        <form className="space-y-4" action={formAction} suppressHydrationWarning>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save password"}
          </Button>
        </form>
        {state.error && (
          <p
            role="alert"
            className="border-destructive/30 text-destructive mt-4 rounded-md border bg-destructive/5 p-2.5 text-xs"
          >
            {state.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
