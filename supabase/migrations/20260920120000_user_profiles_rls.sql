-- Enable RLS on user_profiles (was exposed to anon/authenticated without RLS).
-- Mirrors categories/transactions: authenticated users manage only their row.

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own profile" ON public.user_profiles;
CREATE POLICY "Users can manage their own profile"
  ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE public.user_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;
