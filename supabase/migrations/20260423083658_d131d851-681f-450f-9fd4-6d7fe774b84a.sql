-- intent_checks: сохранённые проверки интента
CREATE TABLE public.intent_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID,
  name TEXT NOT NULL DEFAULT 'Проверка интента',
  queries TEXT[] NOT NULL DEFAULT '{}',
  search_engine TEXT NOT NULL DEFAULT 'google',
  city TEXT NOT NULL DEFAULT 'Москва',
  depth INTEGER NOT NULL DEFAULT 10,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_markdown TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.intent_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own intent_checks"
  ON public.intent_checks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own intent_checks"
  ON public.intent_checks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own intent_checks"
  ON public.intent_checks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own intent_checks"
  ON public.intent_checks FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all intent_checks"
  ON public.intent_checks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_intent_checks_updated_at
  BEFORE UPDATE ON public.intent_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_intent_checks_user ON public.intent_checks(user_id, created_at DESC);

-- intent_results: построчные результаты SERP
CREATE TABLE public.intent_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  check_id UUID NOT NULL REFERENCES public.intent_checks(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  position INTEGER NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  title TEXT DEFAULT '',
  snippet TEXT DEFAULT '',
  site_type TEXT NOT NULL DEFAULT 'Неизвестно',
  page_type TEXT DEFAULT '',
  engine TEXT NOT NULL DEFAULT 'google',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.intent_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own intent_results"
  ON public.intent_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.intent_checks c WHERE c.id = intent_results.check_id AND c.user_id = auth.uid()));
CREATE POLICY "Users can insert own intent_results"
  ON public.intent_results FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.intent_checks c WHERE c.id = intent_results.check_id AND c.user_id = auth.uid()));
CREATE POLICY "Users can delete own intent_results"
  ON public.intent_results FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.intent_checks c WHERE c.id = intent_results.check_id AND c.user_id = auth.uid()));
CREATE POLICY "Admins can view all intent_results"
  ON public.intent_results FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_intent_results_check ON public.intent_results(check_id, query, position);