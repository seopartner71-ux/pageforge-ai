CREATE TABLE public.internal_link_audit_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.internal_link_audits(id) ON DELETE CASCADE,
  idx integer NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (audit_id, idx)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_link_audit_parts TO authenticated;
GRANT ALL ON public.internal_link_audit_parts TO service_role;

ALTER TABLE public.internal_link_audit_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ilap access" ON public.internal_link_audit_parts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.internal_link_audits a ON a.id = internal_link_audit_parts.audit_id
    WHERE p.id = a.project_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.internal_link_audits a ON a.id = internal_link_audit_parts.audit_id
    WHERE p.id = a.project_id AND p.user_id = auth.uid()
  ));