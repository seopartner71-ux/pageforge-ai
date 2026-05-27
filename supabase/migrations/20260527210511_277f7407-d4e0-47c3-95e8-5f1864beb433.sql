
-- ============ crawl_jobs ============
CREATE TABLE public.crawl_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crawl_jobs TO authenticated;
GRANT ALL ON public.crawl_jobs TO service_role;
ALTER TABLE public.crawl_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own crawl_jobs" ON public.crawl_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own crawl_jobs" ON public.crawl_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own crawl_jobs" ON public.crawl_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own crawl_jobs" ON public.crawl_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all crawl_jobs" ON public.crawl_jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_crawl_jobs_user ON public.crawl_jobs(user_id, created_at DESC);
CREATE INDEX idx_crawl_jobs_status ON public.crawl_jobs(status) WHERE status IN ('pending','running');

-- ============ crawl_pages ============
CREATE TABLE public.crawl_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.crawl_jobs(id) ON DELETE CASCADE,
  url text NOT NULL,
  status_code integer,
  depth integer DEFAULT 0,
  title text,
  description text,
  h1 text,
  canonical text,
  is_indexed boolean DEFAULT true,
  load_time_ms integer,
  word_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crawl_pages TO authenticated;
GRANT ALL ON public.crawl_pages TO service_role;
ALTER TABLE public.crawl_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access pages via job owner" ON public.crawl_pages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crawl_jobs j WHERE j.id = crawl_pages.job_id AND j.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crawl_jobs j WHERE j.id = crawl_pages.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Admins view all crawl_pages" ON public.crawl_pages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_crawl_pages_job ON public.crawl_pages(job_id);

-- ============ crawl_issues ============
CREATE TABLE public.crawl_issues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.crawl_jobs(id) ON DELETE CASCADE,
  page_url text,
  type text NOT NULL DEFAULT 'technical',
  code text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crawl_issues TO authenticated;
GRANT ALL ON public.crawl_issues TO service_role;
ALTER TABLE public.crawl_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access issues via job owner" ON public.crawl_issues FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crawl_jobs j WHERE j.id = crawl_issues.job_id AND j.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crawl_jobs j WHERE j.id = crawl_issues.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Admins view all crawl_issues" ON public.crawl_issues FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_crawl_issues_job_type ON public.crawl_issues(job_id, type, code);

-- ============ crawl_stats ============
CREATE TABLE public.crawl_stats (
  job_id uuid NOT NULL PRIMARY KEY REFERENCES public.crawl_jobs(id) ON DELETE CASCADE,
  total_pages integer NOT NULL DEFAULT 0,
  total_issues integer NOT NULL DEFAULT 0,
  critical_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  info_count integer NOT NULL DEFAULT 0,
  avg_load_time_ms integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crawl_stats TO authenticated;
GRANT ALL ON public.crawl_stats TO service_role;
ALTER TABLE public.crawl_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access stats via job owner" ON public.crawl_stats FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crawl_jobs j WHERE j.id = crawl_stats.job_id AND j.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crawl_jobs j WHERE j.id = crawl_stats.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Admins view all crawl_stats" ON public.crawl_stats FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ audit_checks ============
CREATE TABLE public.audit_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  job_id uuid REFERENCES public.crawl_jobs(id) ON DELETE CASCADE,
  check_number text NOT NULL,
  check_name text NOT NULL,
  section text NOT NULL DEFAULT 'technical',
  importance text NOT NULL DEFAULT 'medium',
  difficulty text NOT NULL DEFAULT 'medium',
  check_type text NOT NULL DEFAULT 'auto',
  external_url text,
  result text NOT NULL DEFAULT 'unchecked',
  comment text,
  status text NOT NULL DEFAULT 'new',
  audit_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_checks TO authenticated;
GRANT ALL ON public.audit_checks TO service_role;
ALTER TABLE public.audit_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own audit_checks" ON public.audit_checks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all audit_checks" ON public.audit_checks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_audit_checks_user ON public.audit_checks(user_id, audit_date DESC);

-- ============ audit_url_errors ============
CREATE TABLE public.audit_url_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_check_id uuid NOT NULL REFERENCES public.audit_checks(id) ON DELETE CASCADE,
  url text NOT NULL DEFAULT '',
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_url_errors TO authenticated;
GRANT ALL ON public.audit_url_errors TO service_role;
ALTER TABLE public.audit_url_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access url_errors via check owner" ON public.audit_url_errors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.audit_checks c WHERE c.id = audit_url_errors.audit_check_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.audit_checks c WHERE c.id = audit_url_errors.audit_check_id AND c.user_id = auth.uid()));
CREATE POLICY "Admins view all audit_url_errors" ON public.audit_url_errors FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ Trigger updated_at ============
CREATE TRIGGER trg_crawl_jobs_updated BEFORE UPDATE ON public.crawl_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_audit_checks_updated BEFORE UPDATE ON public.audit_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ claim_next_crawl_job RPC ============
CREATE OR REPLACE FUNCTION public.claim_next_crawl_job()
RETURNS TABLE(id uuid, user_id uuid, domain text, options jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.crawl_jobs;
BEGIN
  SELECT * INTO v_job
  FROM public.crawl_jobs
  WHERE status = 'pending'
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.crawl_jobs
  SET status = 'running', started_at = now(), updated_at = now()
  WHERE crawl_jobs.id = v_job.id;

  id := v_job.id;
  user_id := v_job.user_id;
  domain := v_job.domain;
  options := v_job.options;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_crawl_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_crawl_job() TO service_role;
