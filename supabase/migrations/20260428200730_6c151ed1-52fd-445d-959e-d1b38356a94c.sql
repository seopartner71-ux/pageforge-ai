-- Blog topics jobs (analogue of semantic_jobs)
CREATE TABLE public.blog_topics_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid,
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  input_topic text NOT NULL DEFAULT '',
  input_region text NOT NULL DEFAULT 'Москва',
  topic_count integer NOT NULL DEFAULT 0,
  serp_checked integer NOT NULL DEFAULT 0,
  serp_total integer NOT NULL DEFAULT 0,
  dataforseo_cost numeric NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.blog_topics_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blog_topics_jobs" ON public.blog_topics_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own blog_topics_jobs" ON public.blog_topics_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own blog_topics_jobs" ON public.blog_topics_jobs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own blog_topics_jobs" ON public.blog_topics_jobs
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all blog_topics_jobs" ON public.blog_topics_jobs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_blog_topics_jobs_updated_at
  BEFORE UPDATE ON public.blog_topics_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Topics (one row per blog topic candidate)
CREATE TABLE public.blog_topics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.blog_topics_jobs(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  ws_frequency integer NOT NULL DEFAULT 0,
  word_count integer NOT NULL DEFAULT 0,
  intent text NOT NULL DEFAULT 'info',
  competition_level text,                  -- easy | medium | hard | null (not checked)
  strong_count integer,                    -- 0..10 strong domains in top10
  serp_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  blog_score integer NOT NULL DEFAULT 0,
  traffic_potential integer NOT NULL DEFAULT 0,
  data_source text NOT NULL DEFAULT 'dataforseo',
  serp_checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blog_topics" ON public.blog_topics
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.blog_topics_jobs j WHERE j.id = blog_topics.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Users can insert own blog_topics" ON public.blog_topics
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.blog_topics_jobs j WHERE j.id = blog_topics.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Users can update own blog_topics" ON public.blog_topics
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.blog_topics_jobs j WHERE j.id = blog_topics.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Users can delete own blog_topics" ON public.blog_topics
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.blog_topics_jobs j WHERE j.id = blog_topics.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Admins can view all blog_topics" ON public.blog_topics
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_blog_topics_job ON public.blog_topics(job_id);
CREATE INDEX idx_blog_topics_jobs_user ON public.blog_topics_jobs(user_id);