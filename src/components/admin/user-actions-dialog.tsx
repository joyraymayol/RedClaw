"use client";

import { useState, useTransition } from "react";
import {
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  InfoIcon,
  Save,
  ShieldCheck,
  Trash2,
  User,
  UserCog,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { assignRole, disableUser, updateUserProfile } from "@/lib/actions/admin";
import { DEPARTMENT_ITEMS, DEPARTMENTS, POSITIONS, departmentLabel } from "@/lib/constants/org";
import { formatDateTimeParts } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountStatus, Department, UserRole } from "@/generated/prisma/enums";

const ROLES: UserRole[] = [
  "REQUESTER",
  "TECHNICIAN",
  "ADMIN",
  "SUPERVISOR",
  "HEAD",
];

// Mirrors UserStatusBadge's semantics (green = active/good, red = disabled,
// amber = waiting on someone) but as an icon+color pair for the dl row.
const STATUS_ICON: Record<AccountStatus, { Icon: LucideIcon; className: string }> = {
  PENDING_PROFILE: { Icon: Clock, className: "text-muted-foreground" },
  PENDING_APPROVAL: { Icon: Clock, className: "text-amber-600 dark:text-amber-500" },
  ACTIVE: { Icon: CheckCircle2, className: "text-green-600 dark:text-green-500" },
  DISABLED: { Icon: XCircle, className: "text-destructive" },
};

type RowUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  department: Department | null;
  position: string | null;
  status: AccountStatus;
  role: UserRole | null;
  createdAt: Date;
};

export function UserActionsDialog({
  user,
  isSelf,
  canManage,
  isViewerAdmin,
}: {
  user: RowUser;
  isSelf: boolean;
  /** Whether the viewing admin/head may act on this particular user — ADMIN
      always; a HEAD only within their own department (mirrors `canManageUser`
      in authz.ts, the real server-side gate every action below re-checks). */
  canManage: boolean;
  /** Whether the viewer is ADMIN specifically — only admins may reassign
      department, even among users a HEAD can otherwise manage. */
  isViewerAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignPending, startAssign] = useTransition();
  const [disablePending, startDisable] = useTransition();
  const [profilePending, startProfile] = useTransition();

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

  const canModify = !isSelf && user.status !== "PENDING_PROFILE" && canManage;

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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="flex-row items-center gap-3 space-y-0">
            {user.avatarUrl ? (
              // Google avatar URL; next/image would need a remotePatterns
              // entry for a one-off image (same tradeoff as the sidebar's).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="size-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="size-4" />
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="truncate text-xl">{user.name}</DialogTitle>
              <DialogDescription className="truncate font-mono text-xs">
                {user.email}
              </DialogDescription>
            </div>
          </DialogHeader>

          <dl className="divide-y divide-border rounded-md border text-sm">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                {(() => {
                  const { Icon, className } = STATUS_ICON[user.status];
                  return <Icon className={cn("size-4", className)} />;
                })()}
                Status
              </dt>
              <dd>
                <UserStatusBadge status={user.status} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="size-4" />
                Current role
              </dt>
              <dd className="font-mono text-xs font-medium">
                {user.role ?? "—"}
              </dd>
            </div>
            {!canModify && (
              <>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="size-4" />
                    Department
                  </dt>
                  <dd className="font-medium">{departmentLabel(user.department)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <User className="size-4" />
                    Position
                  </dt>
                  <dd className="font-medium">{user.position ?? "—"}</dd>
                </div>
              </>
            )}
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-4" />
                Joined
              </dt>
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
          {!isSelf && user.status !== "PENDING_PROFILE" && !canManage && (
            <p className="text-xs text-muted-foreground">
              This account is outside your department — only admins can
              manage it.
            </p>
          )}

          {canModify && (
            <div className="space-y-3">
              <form
                action={(fd) => submit(updateUserProfile, startProfile, fd)}
                className="space-y-2"
              >
                <input type="hidden" name="userId" value={user.id} />
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor={`position-${user.id}`} className="flex items-center gap-1.5">
                      <User className="size-3.5 text-primary" />
                      Position
                    </Label>
                    {/* key: remount when the stored position changes, instead of letting base-ui warn about defaultValue drifting on a mounted Select */}
                    <Select
                      key={user.position ?? "none"}
                      name="position"
                      defaultValue={user.position ?? undefined}
                      required
                    >
                      <SelectTrigger id={`position-${user.id}`} className="w-full">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {POSITIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Label htmlFor={`department-${user.id}`} className="flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-primary" />
                        Department
                      </Label>
                      {!isViewerAdmin && (
                        <Tooltip>
                          <TooltipTrigger
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Why is department locked?"
                          >
                            <InfoIcon className="size-3.5" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Only admins can change department.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Select
                      key={user.department ?? "none"}
                      name="department"
                      items={DEPARTMENT_ITEMS}
                      defaultValue={user.department ?? undefined}
                      disabled={!isViewerAdmin}
                      required
                    >
                      <SelectTrigger id={`department-${user.id}`} className="w-full">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {DEPARTMENT_ITEMS[d]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={profilePending}
                >
                  <Save className="size-3.5" />
                  Save details
                </Button>
              </form>

              <form
                action={(fd) => submit(assignRole, startAssign, fd)}
                className="space-y-2"
              >
                <input type="hidden" name="userId" value={user.id} />
                <Label htmlFor={`role-${user.id}`} className="flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" />
                  Assign role
                </Label>
                <div className="flex items-center gap-2">
                  {/* key: remount when the stored role changes, instead of letting base-ui warn about defaultValue drifting on a mounted Select */}
                  <Select
                    key={user.role ?? "none"}
                    name="role"
                    defaultValue={user.role ?? undefined}
                    required
                  >
                    <SelectTrigger id={`role-${user.id}`} className="min-w-0 flex-1">
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
                    <Trash2 className="size-3.5" />
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
