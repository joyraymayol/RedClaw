"use client";

import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// TODO(Phase 0): wire submit + Google button to Supabase Auth
// (signInWithPassword / signInWithOAuth) once lib/supabase is in place.
export function LoginForm() {
  const [notice, setNotice] = useState<string | null>(null);

  function notYetWired() {
    setNotice(
      "Authentication isn't wired up yet — Supabase Auth lands in Phase 0 of the build plan."
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Sign in to RedClaw</CardTitle>
        <CardDescription>
          Maintenance console access for the Plaspack team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            notYetWired();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@plaspack.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="remember" className="font-normal">
              <Checkbox id="remember" name="remember" />
              Remember me
            </Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary underline-offset-4 transition-colors hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full">
            Sign in
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
          onClick={notYetWired}
        >
          <GoogleIcon className="size-4" />
          Continue with Google
        </Button>

        {notice && (
          <p
            role="status"
            className="mt-4 rounded-md border bg-muted/50 p-2.5 text-xs text-muted-foreground"
          >
            {notice}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          No account? Access is provisioned by your maintenance admin.
        </p>
      </CardFooter>
    </Card>
  );
}
