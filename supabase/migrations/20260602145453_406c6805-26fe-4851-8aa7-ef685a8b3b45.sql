ALTER TABLE public.ads_oauth_tokens
  ADD COLUMN IF NOT EXISTS oauth_client_id text,
  ADD COLUMN IF NOT EXISTS oauth_client_secret text;

ALTER TABLE public.ads_oauth_tokens
  DROP CONSTRAINT IF EXISTS ads_oauth_tokens_user_id_provider_external_login_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ads_oauth_tokens_user_provider_login_client
  ON public.ads_oauth_tokens(user_id, provider, external_login, oauth_client_id);

CREATE INDEX IF NOT EXISTS idx_ads_oauth_tokens_oauth_client
  ON public.ads_oauth_tokens(oauth_client_id);