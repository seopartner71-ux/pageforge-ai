ALTER TABLE public.ads_accounts
  ADD COLUMN IF NOT EXISTS oauth_client_id text;

CREATE INDEX IF NOT EXISTS idx_ads_accounts_oauth_client
  ON public.ads_accounts(oauth_client_id);