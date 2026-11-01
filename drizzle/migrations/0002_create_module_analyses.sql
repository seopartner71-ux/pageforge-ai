-- module_analyses: сохранённые отчёты модулей аналитики
CREATE TABLE public.module_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Отчёт аналитики',
  niche TEXT NOT NULL DEFAULT '',
  geo TEXT DEFAULT '',
  site TEXT DEFAULT '',
  form JSONB NOT NULL DEFAULT '{}'::jsonb,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_analyses TO authenticated;
GRANT ALL ON public.module_analyses TO service_role;

ALTER TABLE public.module_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own module_analyses"
  ON public.module_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own module_analyses"
  ON public.module_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own module_analyses"
  ON public.module_analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own module_analyses"
  ON public.module_analyses FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all module_analyses"
  ON public.module_analyses FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_module_analyses_user_module ON public.module_analyses(user_id, module_id, created_at DESC);