-- Add 'club_rep' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'club_rep';