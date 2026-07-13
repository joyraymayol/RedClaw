"use client";

import { useActionState } from "react";
import { Ban, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignRole,
  disableUser,
  type AdminActionState,
} from "@/lib/actions/admin";
import type { AccountStatus, UserRole } from "@/generated/prisma/enums";

const ROLES: UserRole[] = [
  "REQUESTER",
  "TECHNICIAN",
  "ADMIN",
  "SUPERVISOR",
  "HEAD",
];

export function UserRowActions({
  userId,
  status,
  role,
  isSelf,
}: {
  userId: string;
  status: AccountStatus;
  role: UserRole | null;
  isSelf: boolean;
}) {
  const [assignState, assignAction, assignPending] = useActionState<
    AdminActionState,
    FormData
  >(assignRole, {});
  const [disableState, disableAction, disablePending] = useActionState<
    AdminActionState,
    FormData
  >(disableUser, {});

  if (isSelf || status === "PENDING_PROFILE") {
    return (
      <span className="text-xs text-muted-foreground">
        {isSelf ? "—" : "Awaiting profile"}
      </span>
    );
  }

  const error = assignState.error ?? disableState.error;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        <form action={assignAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          <Select name="role" defaultValue={role ?? undefined} required>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Assign role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" disabled={assignPending}>
            <Check className="size-3.5" />
            {status === "PENDING_APPROVAL"
              ? "Approve"
              : status === "DISABLED"
                ? "Re-activate"
                : "Update"}
          </Button>
        </form>
        {status !== "DISABLED" && (
          <form action={disableAction}>
            <input type="hidden" name="userId" value={userId} />
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={disablePending}
            >
              <Ban className="size-3.5" />
              Disable
            </Button>
          </form>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
