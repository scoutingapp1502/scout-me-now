-- RecommendationsSection searches profiles with .ilike("full_name", `%term%`).
-- A leading-wildcard ILIKE cannot use a regular btree index and forces a
-- sequential scan; pg_trgm's GIN index supports it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
  ON public.profiles USING gin (full_name gin_trgm_ops);
