
CREATE OR REPLACE FUNCTION public.kb_search(q text, max_results integer DEFAULT 5)
 RETURNS TABLE(chunk_id uuid, document_id uuid, document_title text, heading text, content text, rank real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tokens text[];
  ts_query_str text;
  ts_q tsquery;
BEGIN
  -- Разбиваем запрос на токены длиной ≥ 3 символов (буквы/цифры/дефис)
  SELECT array_agg(t)
    INTO tokens
  FROM (
    SELECT lower(regexp_replace(m, '[^a-zA-Zа-яА-ЯёЁ0-9-]', '', 'g')) AS t
    FROM regexp_split_to_table(coalesce(q, ''), '\s+') AS m
  ) sub
  WHERE length(t) >= 3;

  IF tokens IS NULL OR array_length(tokens, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Строим tsquery через OR (любое слово даёт совпадение)
  ts_query_str := array_to_string(
    ARRAY(SELECT quote_literal(x) || ':*' FROM unnest(tokens) AS x),
    ' | '
  );

  BEGIN
    ts_q := to_tsquery('simple', ts_query_str);
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  RETURN QUERY
  SELECT
    c.id              AS chunk_id,
    c.document_id     AS document_id,
    d.title           AS document_title,
    c.heading         AS heading,
    c.content         AS content,
    GREATEST(
      ts_rank(c.tsv, ts_q),
      ts_rank(to_tsvector('simple', c.content), ts_q)
    ) AS rank
  FROM public.kb_chunks c
  JOIN public.kb_documents d ON d.id = c.document_id
  WHERE c.tsv @@ ts_q
     OR to_tsvector('simple', c.content) @@ ts_q
  ORDER BY rank DESC
  LIMIT GREATEST(1, LEAST(max_results, 20));
END;
$function$;
