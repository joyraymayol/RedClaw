import { Badge } from "@/components/ui/badge";
import type { AccountStatus } from "@/generated/prisma/enums";

const STATUS_BADGE: Record<
  AccountStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  PENDING_PROFILE: { label: "Awaiting profile", variant: "outline" },
  PENDING_APPROVAL: { label: "Needs approval", variant: "default" },
  ACTIVE: { label: "Active", variant: "secondary" },
  DISABLED: { label: "Disabled", variant: "destructive" },
};

export function UserStatusBadge({ status }: { status: AccountStatus }) {
  const { label, variant } = STATUS_BADGE[status];
  return <Badge variant={variant}>{label}</Badge>;
}
