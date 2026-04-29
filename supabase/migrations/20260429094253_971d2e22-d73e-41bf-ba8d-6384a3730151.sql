CREATE TABLE public.site_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view site config"
  ON public.site_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert site config"
  ON public.site_config FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update site config"
  ON public.site_config FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete site config"
  ON public.site_config FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.site_config (key, value) VALUES
  ('footer_links', '[{"label":"Системное SEO","url":"https://systemnoe-seo.ru/","newTab":true}]'::jsonb)
ON CONFLICT (key) DO NOTHING;