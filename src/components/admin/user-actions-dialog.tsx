"use client";

import { useState, useTransition } from "react";
import { Ban, Check, UserCog } from "lucide-react";

import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignRole, disableUser } from "@/lib/actions/admin";
import { departmentLabel } from "@/lib/constants/org";
import { formatDateTimeParts } from "@/lib/format";
import type { AccountStatus, Department, UserRole } from "@/generated/prisma/enums";

const ROLES: UserRole[] = [
  "REQUESTER",
  "TECHNICIAN",
  "ADMIN",
  "SUPERVISOR",
  "HEAD",
];

type RowUser = {
  id: string;
  name: string;
  email: string;
  department: Department | null;
  position: string | null;
  status: AccountStatus;
  role: UserRole | null;
  createdAt: Date;
};

export function UserActionsDialog({
  user,
  isSelf,
}: {
  user: RowUser;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignPending, startAssign] = useTransition();
  const [disablePending, startDisable] = useTransition();

  function submit(
    action: typeof assignRole,
    start: typeof startAssign,
    formData: FormData
  ) {
    start(async () => {
      const result = await action({}, formData);
      if (result.success) {
        setOpen(false);
        setError(null);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setError(null);
  }

  const canModify = !isSelf && user.status !== "PENDING_PROFILE";

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Manage ${user.name}`}
        onClick={() => setOpen(true)}
      >
        <UserCog className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{user.name}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {user.email}
            </DialogDescription>
          </DialogHeader>

          <dl className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <UserStatusBadge status={user.status} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Current role</dt>
              <dd className="font-mono text-xs font-medium">
                {user.role ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Department</dt>
              <dd className="font-medium">{departmentLabel(user.department)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Position</dt>
              <dd className="font-medium">{user.position ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Joined</dt>
              <dd className="font-medium">
                {(() => {
                  const ts = formatDateTimeParts(user.createdAt);
                  return `${ts.date}, ${ts.time}`;
                })()}
              </dd>
            </div>
          </dl>

          {isSelf && (
            <p className="text-xs text-muted-foreground">
              You can&apos;t modify your own account.
            </p>
          )}
          {!isSelf && user.status === "PENDING_PROFILE" && (
            <p className="text-xs text-muted-foreground">
              This person hasn&apos;t completed their profile yet — there is
              nothing to approve.
            </p>
          )}

          {canModify && (
            <div className="space-y-3">
              <form
                action={(fd) => submit(assignRole, startAssign, fd)}
                className="space-y-2"
              >
                <input type="hidden" name="userId" value={user.id} />
                <Label htmlFor={`role-${user.id}`}>Assign role</Label>
                <div className="flex items-center gap-2">
                  {/* key: remount when the stored role changes, instead of letting base-ui warn about defaultValue drifting on a mounted Select */}
                  <Select
                    key={user.role ?? "none"}
                    name="role"
                    defaultValue={user.role ?? undefined}
                    required
                  >
                    <SelectTrigger id={`role-${user.id}`} className="flex-1">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit" disabled={assignPending}>
                    <Check className="size-3.5" />
                    {user.status === "PENDING_APPROVAL"
                      ? "Approve"
                      : user.status === "DISABLED"
                        ? "Re-activate"
                        : "Update"}
                  </Button>
                </div>
              </form>

              {user.status !== "DISABLED" && (
                <form action={(fd) => submit(disableUser, startDisable, fd)}>
                  <input type="hidden" name="userId" value={user.id} />
                  <Button
                    type="submit"
                    variant="destructive"
                    className="w-full"
                    disabled={disablePending}
                  >
                    <Ban className="size-3.5" />
                    Disable account
                  </Button>
                </form>
              )}

              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
