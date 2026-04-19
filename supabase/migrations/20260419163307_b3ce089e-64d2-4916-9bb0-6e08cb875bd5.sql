-- Таблица логов диалогов с Data Copilot
CREATE TABLE public.copilot_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  text text NOT NULL DEFAULT '',
  intent text,
  card_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_messages_user ON public.copilot_messages(user_id, created_at DESC);
CREATE INDEX idx_copilot_messages_session ON public.copilot_messages(session_id, created_at);

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own copilot messages"
  ON public.copilot_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own copilot messages"
  ON public.copilot_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all copilot messages"
  ON public.copilot_messages FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
