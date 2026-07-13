import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

export function SignOutButton() {
  return (
    // suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms
    <form action={signOut} suppressHydrationWarning>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut className="size-3.5" />
        Sign out
      </Button>
    </form>
  );
}
