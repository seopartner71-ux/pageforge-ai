CREATE TABLE IF NOT EXISTS public.semantic_cores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid,
  name text NOT NULL DEFAULT 'Семантическое ядро',
  topic text NOT NULL DEFAULT '',
  seed_keywords text[] NOT NULL DEFAULT '{}',
  region text NOT NULL DEFAULT 'Москва',
  search_engine text NOT NULL DEFAULT 'yandex',
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  clusters jsonb NOT NULL DEFAULT '[]'::jsonb,
  wordstat_mode text NOT NULL DEFAULT 'mock',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.semantic_cores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own semantic_cores" ON public.semantic_cores
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own semantic_cores" ON public.semantic_cores
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own semantic_cores" ON public.semantic_cores
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own semantic_cores" ON public.semantic_cores
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all semantic_cores" ON public.semantic_cores
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_semantic_cores_updated_at BEFORE UPDATE ON public.semantic_cores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_semantic_cores_user ON public.semantic_cores(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_semantic_cores_project ON public.semantic_cores(project_id);

INSERT INTO public.system_settings (key_name, key_value)
VALUES ('wordstat_api_key', '')
ON CONFLICT DO NOTHING;