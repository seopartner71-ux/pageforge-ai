
-- ============ ADS DASHBOARD TABLES ============

-- 1. Рекламные кабинеты
CREATE TABLE public.ads_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  external_id TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'yandex_direct',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_accounts TO authenticated;
GRANT ALL ON public.ads_accounts TO service_role;
ALTER TABLE public.ads_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ads_accounts" ON public.ads_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all ads_accounts" ON public.ads_accounts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_ads_accounts_project ON public.ads_accounts(project_id);
CREATE INDEX idx_ads_accounts_user ON public.ads_accounts(user_id);

-- 2. Кампании
CREATE TABLE public.ads_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'working', -- working | limited | low_ctr | paused
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_campaigns TO authenticated;
GRANT ALL ON public.ads_campaigns TO service_role;
ALTER TABLE public.ads_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ads_campaigns" ON public.ads_campaigns FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all ads_campaigns" ON public.ads_campaigns FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_ads_campaigns_account ON public.ads_campaigns(account_id);

-- 3. Ежедневные метрики (по кампании)
CREATE TABLE public.ads_daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  spend NUMERIC NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_daily_metrics TO authenticated;
GRANT ALL ON public.ads_daily_metrics TO service_role;
ALTER TABLE public.ads_daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ads_daily_metrics" ON public.ads_daily_metrics FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all ads_daily_metrics" ON public.ads_daily_metrics FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_ads_metrics_user_date ON public.ads_daily_metrics(user_id, date);
CREATE INDEX idx_ads_metrics_account_date ON public.ads_daily_metrics(account_id, date);
CREATE INDEX idx_ads_metrics_campaign_date ON public.ads_daily_metrics(campaign_id, date);

-- 4. Проблемные поисковые запросы
CREATE TABLE public.ads_search_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  spend NUMERIC NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_negative BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_search_queries TO authenticated;
GRANT ALL ON public.ads_search_queries TO service_role;
ALTER TABLE public.ads_search_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ads_search_queries" ON public.ads_search_queries FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all ads_search_queries" ON public.ads_search_queries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_ads_queries_user_date ON public.ads_search_queries(user_id, date);

-- 5. Алерты / что требует внимания
CREATE TABLE public.ads_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'yellow', -- red | yellow | blue | emerald
  text TEXT NOT NULL,
  impact_value NUMERIC NOT NULL DEFAULT 0,
  impact_positive BOOLEAN NOT NULL DEFAULT false,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_alerts TO authenticated;
GRANT ALL ON public.ads_alerts TO service_role;
ALTER TABLE public.ads_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ads_alerts" ON public.ads_alerts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all ads_alerts" ON public.ads_alerts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_ads_alerts_user ON public.ads_alerts(user_id);

-- 6. AI-рекомендации
CREATE TABLE public.ads_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  savings NUMERIC NOT NULL DEFAULT 0,
  cta TEXT NOT NULL DEFAULT 'Применить',
  status TEXT NOT NULL DEFAULT 'idle', -- idle | done
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_recommendations TO authenticated;
GRANT ALL ON public.ads_recommendations TO service_role;
ALTER TABLE public.ads_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ads_recommendations" ON public.ads_recommendations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all ads_recommendations" ON public.ads_recommendations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. AI-аудит (радар) — оси и значения по кабинету
CREATE TABLE public.ads_audit_axes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  axis TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_audit_axes TO authenticated;
GRANT ALL ON public.ads_audit_axes TO service_role;
ALTER TABLE public.ads_audit_axes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ads_audit_axes" ON public.ads_audit_axes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all ads_audit_axes" ON public.ads_audit_axes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Триггеры updated_at
CREATE TRIGGER trg_ads_accounts_upd BEFORE UPDATE ON public.ads_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ads_recommendations_upd BEFORE UPDATE ON public.ads_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
