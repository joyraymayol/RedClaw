import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock, ShieldAlert } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { departmentLabel } from "@/lib/constants/org";

export const metadata: Metadata = {
  title: "Awaiting approval",
};

export default async function PendingApprovalPage() {
  const user = await requireUser();

  if (user.status === "ACTIVE") redirect("/dashboard");
  if (user.status === "PENDING_PROFILE") redirect("/onboarding");

  const disabled = user.status === "DISABLED";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both w-full max-w-sm duration-500">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-md border bg-muted/50">
            {disabled ? (
              <ShieldAlert className="size-4.5 text-destructive" />
            ) : (
              <Clock className="size-4.5 text-primary" />
            )}
          </div>
          <CardTitle className="text-lg">
            {disabled ? "Account disabled" : "Your account is under review"}
          </CardTitle>
          <CardDescription>
            {disabled
              ? "This account has been disabled. Contact your maintenance admin if you think this is a mistake."
              : "Your details were sent to higher management for review. Once your role is assigned, you'll be able to use the app."}
          </CardDescription>
        </CardHeader>
        {!disabled && (
          <CardContent>
            <dl className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="text-right font-medium">{user.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="text-right font-medium">{user.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Department</dt>
                <dd className="text-right font-medium">{departmentLabel(user.department)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Position</dt>
                <dd className="text-right font-medium">{user.position}</dd>
              </div>
            </dl>
          </CardContent>
        )}
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            {disabled ? (
              "You can sign out from the top-right corner."
            ) : (
              <>
                Approved already?{" "}
                <Link
                  href="/pending-approval"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Check again
                </Link>
                .
              </>
            )}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
