-- 1. radar_projects
CREATE TABLE public.radar_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_name text NOT NULL,
  domain text NOT NULL,
  language text NOT NULL DEFAULT 'ru',
  data_nuggets text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_projects TO authenticated;
GRANT ALL ON public.radar_projects TO service_role;
ALTER TABLE public.radar_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own radar_projects" ON public.radar_projects
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all radar_projects" ON public.radar_projects
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_radar_projects_updated_at
  BEFORE UPDATE ON public.radar_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. radar_keywords
CREATE TABLE public.radar_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.radar_projects(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_branded_query boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_keywords TO authenticated;
GRANT ALL ON public.radar_keywords TO service_role;
ALTER TABLE public.radar_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own radar_keywords" ON public.radar_keywords
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all radar_keywords" ON public.radar_keywords
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_radar_keywords_project ON public.radar_keywords(project_id);

-- 3. radar_prompt_groups
CREATE TABLE public.radar_prompt_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.radar_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_prompt_groups TO authenticated;
GRANT ALL ON public.radar_prompt_groups TO service_role;
ALTER TABLE public.radar_prompt_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own radar_prompt_groups" ON public.radar_prompt_groups
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all radar_prompt_groups" ON public.radar_prompt_groups
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_radar_prompt_groups_project ON public.radar_prompt_groups(project_id);

-- 4. radar_prompts
CREATE TABLE public.radar_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.radar_projects(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.radar_prompt_groups(id) ON DELETE SET NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_prompts TO authenticated;
GRANT ALL ON public.radar_prompts TO service_role;
ALTER TABLE public.radar_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own radar_prompts" ON public.radar_prompts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all radar_prompts" ON public.radar_prompts
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_radar_prompts_project ON public.radar_prompts(project_id);
CREATE INDEX idx_radar_prompts_group ON public.radar_prompts(group_id);

-- 5. radar_analysis_runs
CREATE TABLE public.radar_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.radar_projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  total_prompts integer NOT NULL DEFAULT 0,
  completed_prompts integer NOT NULL DEFAULT 0,
  current_model text,
  current_prompt_text text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_analysis_runs TO authenticated;
GRANT ALL ON public.radar_analysis_runs TO service_role;
ALTER TABLE public.radar_analysis_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own radar_analysis_runs" ON public.radar_analysis_runs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all radar_analysis_runs" ON public.radar_analysis_runs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_radar_analysis_runs_project ON public.radar_analysis_runs(project_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.radar_analysis_runs;

-- 6. radar_results
CREATE TABLE public.radar_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  keyword_id uuid REFERENCES public.radar_keywords(id) ON DELETE CASCADE,
  prompt_id uuid REFERENCES public.radar_prompts(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.radar_analysis_runs(id) ON DELETE SET NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'opportunity',
  brand_mentioned boolean NOT NULL DEFAULT false,
  is_brand_found boolean NOT NULL DEFAULT false,
  domain_linked boolean NOT NULL DEFAULT false,
  is_branded_query boolean NOT NULL DEFAULT false,
  sentiment text DEFAULT 'neutral',
  competitor_domains text[] NOT NULL DEFAULT '{}',
  matched_snippets text[] NOT NULL DEFAULT '{}',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_response_text text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_results TO authenticated;
GRANT ALL ON public.radar_results TO service_role;
ALTER TABLE public.radar_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own radar_results" ON public.radar_results
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all radar_results" ON public.radar_results
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_radar_results_keyword ON public.radar_results(keyword_id);
CREATE INDEX idx_radar_results_prompt ON public.radar_results(prompt_id);
CREATE INDEX idx_radar_results_run ON public.radar_results(run_id);