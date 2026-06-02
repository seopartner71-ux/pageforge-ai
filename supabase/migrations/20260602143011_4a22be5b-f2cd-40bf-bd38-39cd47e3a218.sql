ALTER TABLE public.ads_campaigns
  ADD COLUMN IF NOT EXISTS external_id text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ads_campaigns_account_external
  ON public.ads_campaigns(account_id, external_id)
  WHERE external_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ads_daily_metrics_acc_camp_date
  ON public.ads_daily_metrics(account_id, campaign_id, date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ads_search_queries_acc_query_date
  ON public.ads_search_queries(account_id, query, date);