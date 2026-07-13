import { cache } from "react";
import { redirect } from "next/navigation";

import type { User, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer — the authorization boundary.
 *
 * The proxy only does optimistic cookie checks and does not intercept
 * Server Actions, and layouts don't re-render on navigation. So every
 * protected page and every Server Action must call one of the require*
 * helpers below. Rule of thumb: no Prisma write without a require* above it.
 */

/** Authenticated user with their mirrored DB row, or null. Memoized per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();

  // getUser() validates the JWT with Supabase Auth — never use getSession() here.
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  const existing = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (existing) return existing;

  // Fallback sync: the Postgres trigger on auth.users is the primary path,
  // but if the row is missing (e.g. trigger added after this auth user),
  // mirror it here rather than stranding the session.
  const meta = authUser.user_metadata;
  return prisma.user.upsert({
    where: { id: authUser.id },
    update: {},
    create: {
      id: authUser.id,
      email: authUser.email,
      name:
        (meta.full_name as string | undefined) ??
        (meta.name as string | undefined) ??
        authUser.email.split("@")[0],
      avatarUrl: (meta.avatar_url as string | undefined) ?? null,
    },
  });
});

/** Require a signed-in user (any status). */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Require a signed-in, approved (ACTIVE) user. Pending/disabled users are routed to their holding page. */
export async function requireActiveUser(): Promise<User> {
  const user = await requireUser();
  switch (user.status) {
    case "PENDING_PROFILE":
      redirect("/onboarding");
      break;
    case "PENDING_APPROVAL":
    case "DISABLED":
      redirect("/pending-approval");
      break;
  }
  return user;
}

/**
 * Require an ACTIVE user with one of the given roles.
 * Minimal gate until Phase 1's authz `can()` matrix lands.
 */
export async function requireRole(...roles: UserRole[]): Promise<User> {
  const user = await requireActiveUser();
  if (!user.role || !roles.includes(user.role)) redirect("/dashboard");
  return user;
}
