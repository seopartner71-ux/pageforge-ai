ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS entities jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sge_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cluster_results jsonb DEFAULT '{}'::jsonb;