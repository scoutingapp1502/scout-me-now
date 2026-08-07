-- Sharing a post into a chat previously only inserted a plain-text excerpt,
-- so it rendered as an ordinary message bubble instead of a rich post
-- preview. Store a reference to the original post so the chat UI can render
-- an actual card (image, author, caption). ON DELETE SET NULL: if the post
-- is later removed, the message degrades to its plain-text fallback instead
-- of breaking.
ALTER TABLE public.messages ADD COLUMN shared_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;
ALTER TABLE public.group_messages ADD COLUMN shared_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;
