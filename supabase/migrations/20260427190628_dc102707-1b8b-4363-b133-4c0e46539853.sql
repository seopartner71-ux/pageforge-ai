
CREATE TABLE public.schema_audits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid,
  url text NOT NULL,
  domain text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  overall_score integer NOT NULL DEFAULT 0,
  found_schemas_count integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  schemas_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_code jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_recommendations jsonb NOT NULL DEFAULT '{}'::jsonb,
  page_type text NOT NULL DEFAULT 'other',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.schema_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schema_audits" ON public.schema_audits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own schema_audits" ON public.schema_audits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schema_audits" ON public.schema_audits
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own schema_audits" ON public.schema_audits
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all schema_audits" ON public.schema_audits
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_schema_audits_updated_at
  BEFORE UPDATE ON public.schema_audits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_schema_audits_user_created ON public.schema_audits(user_id, created_at DESC);
