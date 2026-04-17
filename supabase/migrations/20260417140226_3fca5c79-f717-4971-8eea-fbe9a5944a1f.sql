-- ====== link_audits ======
CREATE TABLE public.link_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Ссылочный аудит',
  sites JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_markdown TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.link_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own link_audits" ON public.link_audits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own link_audits" ON public.link_audits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own link_audits" ON public.link_audits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own link_audits" ON public.link_audits FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all link_audits" ON public.link_audits FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_link_audits_project ON public.link_audits(project_id, created_at DESC);
CREATE INDEX idx_link_audits_user ON public.link_audits(user_id, created_at DESC);

CREATE TRIGGER update_link_audits_updated_at
BEFORE UPDATE ON public.link_audits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== competitor_analyses ======
CREATE TABLE public.competitor_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Анализ конкурентов',
  file_name TEXT DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_markdown TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own competitor_analyses" ON public.competitor_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own competitor_analyses" ON public.competitor_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own competitor_analyses" ON public.competitor_analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own competitor_analyses" ON public.competitor_analyses FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all competitor_analyses" ON public.competitor_analyses FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_competitor_analyses_project ON public.competitor_analyses(project_id, created_at DESC);
CREATE INDEX idx_competitor_analyses_user ON public.competitor_analyses(user_id, created_at DESC);

CREATE TRIGGER update_competitor_analyses_updated_at
BEFORE UPDATE ON public.competitor_analyses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== top_analyses ======
CREATE TABLE public.top_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Анализ топа',
  file_name TEXT DEFAULT '',
  region TEXT DEFAULT '',
  my_domain TEXT DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_markdown TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.top_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own top_analyses" ON public.top_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own top_analyses" ON public.top_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own top_analyses" ON public.top_analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own top_analyses" ON public.top_analyses FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all top_analyses" ON public.top_analyses FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_top_analyses_project ON public.top_analyses(project_id, created_at DESC);
CREATE INDEX idx_top_analyses_user ON public.top_analyses(user_id, created_at DESC);

CREATE TRIGGER update_top_analyses_updated_at
BEFORE UPDATE ON public.top_analyses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();