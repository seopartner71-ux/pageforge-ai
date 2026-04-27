ALTER TABLE public.semantic_keywords ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'mock';
ALTER TABLE public.semantic_jobs ADD COLUMN IF NOT EXISTS dataforseo_cost numeric(10,4) NOT NULL DEFAULT 0;
ALTER TABLE public.semantic_jobs ADD COLUMN IF NOT EXISTS source_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.semantic_jobs ADD COLUMN IF NOT EXISTS enabled_sources text[] NOT NULL DEFAULT ARRAY['autocomplete','suggestions','competitors','ai']::text[];