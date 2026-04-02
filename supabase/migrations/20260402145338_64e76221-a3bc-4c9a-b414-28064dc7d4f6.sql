
-- 1. Add is_approved column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- 2. Approve the admin user
UPDATE public.profiles SET is_approved = true WHERE email = 'sinitsin3@yandex.ru';
