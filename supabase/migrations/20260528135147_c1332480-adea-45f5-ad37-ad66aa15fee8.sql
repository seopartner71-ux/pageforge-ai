-- Helper: check if user is staff (admin or employee)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::app_role, 'employee'::app_role)
  )
$$;

-- Table
CREATE TABLE public.staff_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  kind text NOT NULL DEFAULT 'memo',
  content text DEFAULT '',
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  external_url text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_resources TO authenticated;
GRANT ALL ON public.staff_resources TO service_role;

ALTER TABLE public.staff_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view resources"
ON public.staff_resources FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert resources"
ON public.staff_resources FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Staff can update resources"
ON public.staff_resources FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete resources"
ON public.staff_resources FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));

CREATE TRIGGER update_staff_resources_updated_at
BEFORE UPDATE ON public.staff_resources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_staff_resources_kind ON public.staff_resources(kind);
CREATE INDEX idx_staff_resources_created_at ON public.staff_resources(created_at DESC);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-files', 'staff-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff can view staff files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'staff-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can upload staff files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'staff-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can update staff files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'staff-files' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete staff files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'staff-files' AND public.is_staff(auth.uid()));