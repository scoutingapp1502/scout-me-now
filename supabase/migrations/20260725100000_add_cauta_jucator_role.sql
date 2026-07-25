-- New role: "Caută Jucător" ("Search Player") — mirrors scout/club_rep in
-- the dashboard UI but goes through the same document-verification flow as
-- scout. This migration only adds the enum value; Postgres forbids using a
-- freshly-added enum value inside the same transaction that added it, so
-- every migration referencing 'cauta_jucator' must run in a later, separate
-- migration file.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cauta_jucator';
