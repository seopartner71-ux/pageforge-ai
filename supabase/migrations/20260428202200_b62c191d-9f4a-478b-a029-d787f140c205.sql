-- Add keyword_difficulty to blog_topics for KD-based competition
ALTER TABLE public.blog_topics 
  ADD COLUMN IF NOT EXISTS keyword_difficulty integer;

-- Seed proxy settings rows (admins can edit values via UI)
INSERT INTO public.system_settings (key_name, key_value)
VALUES ('proxy_url', ''), ('proxy_enabled', 'false')
ON CONFLICT (key_name) DO NOTHING;