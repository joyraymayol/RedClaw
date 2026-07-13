import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set new password",
};

export default async function ResetPasswordPage() {
  // The recovery link lands here with a session (via /auth/callback).
  // Without one, the link is invalid or expired.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both w-full max-w-sm duration-500">
      {user ? (
        <ResetPasswordForm />
      ) : (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-lg">Link expired</CardTitle>
            <CardDescription>
              This reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/forgot-password"
              className="text-sm text-primary underline-offset-4 transition-colors hover:underline"
            >
              Request a new reset link
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
