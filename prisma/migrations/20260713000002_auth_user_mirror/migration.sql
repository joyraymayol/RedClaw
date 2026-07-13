-- Hand-written migration (invisible to Prisma introspection — never `prisma db push`).
--
-- Mirrors every new auth.users row into public."User" the moment it is
-- created, so a client that never calls a sync endpoint can't skip it.
-- New rows start as PENDING_PROFILE / isActive=false (column defaults):
-- self-served Google sign-ups can access nothing until an admin approves.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public."User" (id, email, name, "avatarUrl", "updatedAt")
  VALUES (
    NEW.id::text,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name', -- Google OAuth
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'avatar_url',
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- All app access goes through Prisma (table owner bypasses RLS).
-- Enabling RLS with no policies denies Supabase's anon/authenticated
-- PostgREST roles any direct access to this table.
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
