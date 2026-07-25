-- New default for account_visibility, per product decision: every new user
-- should default to fully public visibility rather than the previous
-- scouts_only default.
--
-- Deliberately NOT backfilling existing rows: a row already sitting at the
-- old 'scouts_only' default is indistinguishable from a row where a user
-- explicitly chose 'scouts_only' — both look identical in the database.
-- Backfilling would risk silently overriding a deliberate privacy choice,
-- so only NEW user_privacy_settings rows get the new default.
ALTER TABLE public.user_privacy_settings
  ALTER COLUMN account_visibility SET DEFAULT 'everyone';
