CREATE UNIQUE INDEX IF NOT EXISTS uq_ads_accounts_user_provider_login_client
  ON public.ads_accounts(user_id, provider, external_id, oauth_client_id)
  WHERE oauth_client_id IS NOT NULL;