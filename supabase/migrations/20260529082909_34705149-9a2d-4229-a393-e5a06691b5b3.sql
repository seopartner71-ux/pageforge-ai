
CREATE TABLE IF NOT EXISTS public.yandex_tokens (
  user_id uuid PRIMARY KEY,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  yandex_login text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.yandex_tokens TO authenticated;
GRANT ALL ON public.yandex_tokens TO service_role;

ALTER TABLE public.yandex_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own yandex tokens"
ON public.yandex_tokens FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own yandex tokens"
ON public.yandex_tokens FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own yandex tokens"
ON public.yandex_tokens FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own yandex tokens"
ON public.yandex_tokens FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER trg_yandex_tokens_updated_at
BEFORE UPDATE ON public.yandex_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
