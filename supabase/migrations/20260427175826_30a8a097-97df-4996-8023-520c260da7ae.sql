ALTER TABLE public.semantic_keywords
ADD COLUMN IF NOT EXISTS keyword_difficulty integer NULL;

ALTER TABLE public.semantic_keywords
ADD CONSTRAINT semantic_keywords_kd_range CHECK (
  keyword_difficulty IS NULL OR (keyword_difficulty >= 0 AND keyword_difficulty <= 100)
);