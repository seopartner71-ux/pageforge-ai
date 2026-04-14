
-- Fix: Admins can view all analyses (for admin stats/logs)
CREATE POLICY "Admins can view all analyses"
ON public.analyses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix: Admins can view all analysis_results
CREATE POLICY "Admins can view all results"
ON public.analysis_results
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
