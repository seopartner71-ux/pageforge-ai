-- 1. Extend ads_accounts
ALTER TABLE public.ads_accounts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'connected',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'RUB',
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- 2. ads_oauth_tokens — server-only secrets
CREATE TABLE public.ads_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'yandex_direct',
  external_login text,
  access_token text NOT NULL,
  refresh_token text,
  token_type text NOT NULL DEFAULT 'Bearer',
  scope text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, external_login)
);

-- Tokens never reach the browser — only service_role (edge functions) can touch this table.
GRANT ALL ON public.ads_oauth_tokens TO service_role;

ALTER TABLE public.ads_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Deny all direct client access (defence in depth on top of missing GRANTs).
CREATE POLICY "tokens are server-only"
  ON public.ads_oauth_tokens
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE TRIGGER trg_ads_oauth_tokens_updated_at
  BEFORE UPDATE ON public.ads_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ads_oauth_tokens_user ON public.ads_oauth_tokens(user_id);
CREATE INDEX idx_ads_oauth_tokens_account ON public.ads_oauth_tokens(account_id);

-- 3. ads_import_jobs — progress of 90-day import
CREATE TABLE public.ads_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'yandex_direct',
  status text NOT NULL DEFAULT 'pending',
  -- pending | running | completed | failed
  step text,
  -- campaigns | daily_metrics | search_queries | done
  progress int NOT NULL DEFAULT 0,
  total int NOT NULL DEFAULT 100,
  imported_campaigns int NOT NULL DEFAULT 0,
  imported_metric_rows int NOT NULL DEFAULT 0,
  imported_query_rows int NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ads_import_jobs TO authenticated;
GRANT ALL ON public.ads_import_jobs TO service_role;

ALTER TABLE public.ads_import_jobs ENABLE ROW LEVEL SECURITY;

-- Users can see their own jobs; only edge functions write.
CREATE POLICY "users read own import jobs"
  ON public.ads_import_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_ads_import_jobs_updated_at
  BEFORE UPDATE ON public.ads_import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ads_import_jobs_user ON public.ads_import_jobs(user_id);
CREATE INDEX idx_ads_import_jobs_account ON public.ads_import_jobs(account_id);
CREATE INDEX idx_ads_import_jobs_status ON public.ads_import_jobs(status);