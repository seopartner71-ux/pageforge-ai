CREATE POLICY "users insert own import jobs"
  ON public.ads_import_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own import jobs"
  ON public.ads_import_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own import jobs"
  ON public.ads_import_jobs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);