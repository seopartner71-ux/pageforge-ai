
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS gsc_site_url text,
  ADD COLUMN IF NOT EXISTS yandex_host text,
  ADD COLUMN IF NOT EXISTS gsc_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS yandex_connected boolean NOT NULL DEFAULT false;
