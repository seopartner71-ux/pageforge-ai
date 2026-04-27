-- semantic_jobs
CREATE TABLE public.semantic_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid,
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  input_topic text NOT NULL DEFAULT '',
  input_seeds text[] NOT NULL DEFAULT '{}',
  input_region text NOT NULL DEFAULT 'Москва',
  input_engine text NOT NULL DEFAULT 'yandex',
  keyword_count integer NOT NULL DEFAULT 0,
  cluster_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.semantic_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own semantic_jobs"
  ON public.semantic_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own semantic_jobs"
  ON public.semantic_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own semantic_jobs"
  ON public.semantic_jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own semantic_jobs"
  ON public.semantic_jobs FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all semantic_jobs"
  ON public.semantic_jobs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_semantic_jobs_user_id ON public.semantic_jobs(user_id);
CREATE INDEX idx_semantic_jobs_created_at ON public.semantic_jobs(created_at DESC);

CREATE TRIGGER trg_semantic_jobs_updated_at
  BEFORE UPDATE ON public.semantic_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- semantic_keywords
CREATE TABLE public.semantic_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.semantic_jobs(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  ws_frequency integer NOT NULL DEFAULT 0,
  exact_frequency integer NOT NULL DEFAULT 0,
  intent text NOT NULL DEFAULT 'transac',
  score integer NOT NULL DEFAULT 0,
  cluster_id integer,
  cluster_name text,
  serp_urls text[] NOT NULL DEFAULT '{}',
  included boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.semantic_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own semantic_keywords"
  ON public.semantic_keywords FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.semantic_jobs j WHERE j.id = semantic_keywords.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Users can insert own semantic_keywords"
  ON public.semantic_keywords FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.semantic_jobs j WHERE j.id = semantic_keywords.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Users can update own semantic_keywords"
  ON public.semantic_keywords FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.semantic_jobs j WHERE j.id = semantic_keywords.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Users can delete own semantic_keywords"
  ON public.semantic_keywords FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.semantic_jobs j WHERE j.id = semantic_keywords.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Admins can view all semantic_keywords"
  ON public.semantic_keywords FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_semantic_keywords_job_id ON public.semantic_keywords(job_id);

-- semantic_clusters
CREATE TABLE public.semantic_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.semantic_jobs(id) ON DELETE CASCADE,
  cluster_index integer NOT NULL,
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'mixed',
  keyword_count integer NOT NULL DEFAULT 0,
  avg_score integer NOT NULL DEFAULT 0
);

ALTER TABLE public.semantic_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own semantic_clusters"
  ON public.semantic_clusters FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.semantic_jobs j WHERE j.id = semantic_clusters.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Users can insert own semantic_clusters"
  ON public.semantic_clusters FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.semantic_jobs j WHERE j.id = semantic_clusters.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Users can update own semantic_clusters"
  ON public.semantic_clusters FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.semantic_jobs j WHERE j.id = semantic_clusters.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Users can delete own semantic_clusters"
  ON public.semantic_clusters FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.semantic_jobs j WHERE j.id = semantic_clusters.job_id AND j.user_id = auth.uid()));
CREATE POLICY "Admins can view all semantic_clusters"
  ON public.semantic_clusters FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_semantic_clusters_job_id ON public.semantic_clusters(job_id);