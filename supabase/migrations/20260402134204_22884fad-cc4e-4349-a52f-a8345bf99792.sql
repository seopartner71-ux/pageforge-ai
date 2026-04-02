
-- Add share_token and is_stealth_applied to analyses
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS share_token text UNIQUE;
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS is_stealth_applied boolean DEFAULT false;

-- Add branding fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS logo_url text;

-- Create index for fast share_token lookups
CREATE INDEX IF NOT EXISTS idx_analyses_share_token ON public.analyses(share_token) WHERE share_token IS NOT NULL;

-- Allow public (unauthenticated) access to analyses via share_token
CREATE POLICY "Public can view shared analyses"
ON public.analyses
FOR SELECT
TO anon
USING (share_token IS NOT NULL AND share_token != '');

-- Allow public access to analysis_results for shared analyses
CREATE POLICY "Public can view shared results"
ON public.analysis_results
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM public.analyses
  WHERE analyses.id = analysis_results.analysis_id
  AND analyses.share_token IS NOT NULL
  AND analyses.share_token != ''
));
