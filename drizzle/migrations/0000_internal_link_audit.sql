CREATE TABLE public.internal_link_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  regex text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_internal_link_rules_project ON public.internal_link_rules(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_link_rules TO authenticated;
GRANT ALL ON public.internal_link_rules TO service_role;
ALTER TABLE public.internal_link_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ilr access" ON public.internal_link_rules FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE TABLE public.internal_link_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'done',
  source_note text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_report jsonb
);
CREATE INDEX idx_internal_link_audits_project ON public.internal_link_audits(project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_link_audits TO authenticated;
GRANT ALL ON public.internal_link_audits TO service_role;
ALTER TABLE public.internal_link_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ila access" ON public.internal_link_audits FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));