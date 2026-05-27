
CREATE TABLE public.link_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  donor_url text NOT NULL,
  anchor text NOT NULL DEFAULT '',
  acceptor_url text NOT NULL,
  type text NOT NULL DEFAULT 'outreach' CHECK (type IN ('outreach','crowd','exchange')),
  cost numeric NOT NULL DEFAULT 0,
  placed_at date,
  last_checked_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active','lost','pending')),
  last_status_code int,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX link_profile_user_idx ON public.link_profile(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_profile TO authenticated;
GRANT ALL ON public.link_profile TO service_role;

ALTER TABLE public.link_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own link_profile" ON public.link_profile
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own link_profile" ON public.link_profile
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own link_profile" ON public.link_profile
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own link_profile" ON public.link_profile
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER link_profile_updated_at
  BEFORE UPDATE ON public.link_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
