CREATE TABLE public.pdf_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Default',
  is_active boolean NOT NULL DEFAULT false,
  theme text NOT NULL DEFAULT 'dark',
  primary_color text NOT NULL DEFAULT '#7c3aed',
  accent_color text NOT NULL DEFAULT '#3b82f6',
  font_family text NOT NULL DEFAULT 'Inter',
  font_sizes jsonb NOT NULL DEFAULT '{"heading":20,"subheading":16,"body":13}'::jsonb,
  margins jsonb NOT NULL DEFAULT '{"top":25,"bottom":25,"left":20,"right":20}'::jsonb,
  logo_url text,
  company_name text DEFAULT '',
  enabled_sections jsonb NOT NULL DEFAULT '["scores","aiReport","priorities","tfidf","ngrams","images","anchors","stealth","semanticMap","blueprint","implementationPlan","topicalGap"]'::jsonb,
  section_order jsonb NOT NULL DEFAULT '["scores","aiReport","priorities","tfidf","ngrams","images","anchors","stealth","semanticMap","blueprint","implementationPlan","topicalGap"]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates" ON public.pdf_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own templates" ON public.pdf_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON public.pdf_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON public.pdf_templates FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_pdf_templates_updated_at
BEFORE UPDATE ON public.pdf_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();