ALTER TABLE public.semantic_jobs
  ADD COLUMN IF NOT EXISTS input_stop_words text[] NOT NULL DEFAULT '{}'::text[];