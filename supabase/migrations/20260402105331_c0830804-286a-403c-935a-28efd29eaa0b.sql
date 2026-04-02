
-- Create storage bucket for report logos
INSERT INTO storage.buckets (id, name, public) VALUES ('report-logos', 'report-logos', true);

-- Allow authenticated users to upload logos to their own folder
CREATE POLICY "Users can upload their own logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'report-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'report-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'report-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'report-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public read for logos (needed for PDF generation)
CREATE POLICY "Logos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'report-logos');
