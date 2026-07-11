-- ============================================================
-- Invite system: codes, uses, test unlocks via invites
-- ============================================================

-- 1. user_invite_codes
CREATE TABLE IF NOT EXISTS user_invite_codes (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code       text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_invite_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_all"  ON user_invite_codes;
DROP POLICY IF EXISTS "insert_own"  ON user_invite_codes;
DROP POLICY IF EXISTS "update_own"  ON user_invite_codes;
DROP POLICY IF EXISTS "read own code"   ON user_invite_codes;
DROP POLICY IF EXISTS "insert own code" ON user_invite_codes;
DROP POLICY IF EXISTS "read"            ON user_invite_codes;
DROP POLICY IF EXISTS "insert"          ON user_invite_codes;
DROP POLICY IF EXISTS "update"          ON user_invite_codes;

-- Anyone can read codes (needed to validate a code at registration)
CREATE POLICY "select_all" ON user_invite_codes FOR SELECT USING (true);
-- Authenticated user can insert/update their own code
CREATE POLICY "insert_own" ON user_invite_codes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON user_invite_codes FOR UPDATE USING (auth.uid() = user_id);

-- 2. invite_uses
CREATE TABLE IF NOT EXISTS invite_uses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(invitee_id)
);

ALTER TABLE invite_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own"  ON invite_uses;
DROP POLICY IF EXISTS "insert_any"  ON invite_uses;
DROP POLICY IF EXISTS "inviter reads uses"           ON invite_uses;
DROP POLICY IF EXISTS "insert use"                   ON invite_uses;
DROP POLICY IF EXISTS "Inviter reads own uses"       ON invite_uses;
DROP POLICY IF EXISTS "Anyone can insert invite use" ON invite_uses;

-- Inviter can see who used their code
CREATE POLICY "select_own" ON invite_uses FOR SELECT USING (auth.uid() = inviter_id);
-- Any authenticated user can register an invite use (done at registration)
CREATE POLICY "insert_any" ON invite_uses FOR INSERT WITH CHECK (true);

-- 3. invite_test_unlocks
CREATE TABLE IF NOT EXISTS invite_test_unlocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_key   text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, test_key)
);

ALTER TABLE invite_test_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own"                    ON invite_test_unlocks;
DROP POLICY IF EXISTS "manage own unlocks"            ON invite_test_unlocks;
DROP POLICY IF EXISTS "Users manage own invite unlocks" ON invite_test_unlocks;

CREATE POLICY "manage_own" ON invite_test_unlocks FOR ALL USING (auth.uid() = user_id);
