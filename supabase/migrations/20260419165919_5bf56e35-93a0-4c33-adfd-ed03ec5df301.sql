-- 1. Документы (книги, методички и т.п.)
CREATE TABLE public.kb_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text DEFAULT '',
  source_type text NOT NULL DEFAULT 'pdf', -- pdf | docx | txt | manual
  storage_path text DEFAULT '',
  total_chunks integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kb_documents"
  ON public.kb_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_kb_documents_updated_at
  BEFORE UPDATE ON public.kb_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Чанки с FTS (русский)
CREATE TABLE public.kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  heading text DEFAULT '',
  tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('russian', coalesce(heading, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(content, '')), 'B')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX kb_chunks_tsv_idx ON public.kb_chunks USING gin(tsv);
CREATE INDEX kb_chunks_doc_idx ON public.kb_chunks(document_id, chunk_index);

ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kb_chunks"
  ON public.kb_chunks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. RPC поиска: SECURITY DEFINER — доступен любому залогиненному (его дёргает edge fn от имени юзера через service role)
CREATE OR REPLACE FUNCTION public.kb_search(q text, max_results integer DEFAULT 5)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  heading text,
  content text,
  rank real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id              AS chunk_id,
    c.document_id     AS document_id,
    d.title           AS document_title,
    c.heading         AS heading,
    c.content         AS content,
    ts_rank(c.tsv, websearch_to_tsquery('russian', q)) AS rank
  FROM public.kb_chunks c
  JOIN public.kb_documents d ON d.id = c.document_id
  WHERE c.tsv @@ websearch_to_tsquery('russian', q)
  ORDER BY rank DESC
  LIMIT GREATEST(1, LEAST(max_results, 20));
$$;

-- 4. Storage-бакет для исходников (приватный)
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base', 'knowledge-base', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read kb files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge-base' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload kb files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'knowledge-base' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete kb files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'knowledge-base' AND public.has_role(auth.uid(), 'admin'));