-- "Restrict" a group member: the restrictor simply stops seeing that
-- person's messages in this specific group, without leaving or notifying
-- anyone (mirrors the existing per-user "restricted accounts" feature, but
-- scoped to one group instead of the whole app).
CREATE TABLE public.group_restricted_senders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.group_conversations(id) ON DELETE CASCADE,
  restrictor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restricted_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, restrictor_id, restricted_user_id)
);

ALTER TABLE public.group_restricted_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_restricted_senders_select_own" ON public.group_restricted_senders
  FOR SELECT USING (restrictor_id = auth.uid());

CREATE POLICY "group_restricted_senders_insert_own" ON public.group_restricted_senders
  FOR INSERT WITH CHECK (restrictor_id = auth.uid() AND public.is_group_member(group_id));

CREATE POLICY "group_restricted_senders_delete_own" ON public.group_restricted_senders
  FOR DELETE USING (restrictor_id = auth.uid());
