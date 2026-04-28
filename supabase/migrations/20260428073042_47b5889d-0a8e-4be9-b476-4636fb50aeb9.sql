
CREATE TABLE public.serp_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  project_id uuid,
  keyword text NOT NULL,
  region text NOT NULL DEFAULT 'Россия',
  engine text NOT NULL DEFAULT 'yandex',
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  depth integer NOT NULL DEFAULT 10,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX serp_snapshots_user_keyword_idx ON public.serp_snapshots(user_id, keyword, region, engine, snapshot_date);

ALTER TABLE public.serp_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own serp_snapshots"
  ON public.serp_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all serp_snapshots"
  ON public.serp_snapshots FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own serp_snapshots"
  ON public.serp_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own serp_snapshots"
  ON public.serp_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own serp_snapshots"
  ON public.serp_snapshots FOR DELETE
  USING (auth.uid() = user_id);
