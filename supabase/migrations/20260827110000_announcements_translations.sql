-- Per-language title/content overrides for announcements, e.g.
-- {"en": {"title": "...", "content": "..."}, "de": {...}}
-- Missing languages fall back to the base (Romanian) title/content.
ALTER TABLE public.announcements
  ADD COLUMN translations jsonb NOT NULL DEFAULT '{}'::jsonb;
