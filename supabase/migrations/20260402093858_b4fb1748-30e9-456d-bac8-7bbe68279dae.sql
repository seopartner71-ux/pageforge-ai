ALTER TABLE public.analyses ADD COLUMN progress jsonb DEFAULT '[]'::jsonb;

-- Allow the service role to update progress during analysis
-- The existing RLS policies already allow users to view/update their own analyses