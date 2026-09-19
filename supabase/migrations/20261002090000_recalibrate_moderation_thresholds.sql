-- The initial thresholds (20260927090000) were explicit conservative
-- placeholders, documented at the time as "to be calibrated once real
-- traffic/false-positive data exists". First real-world use surfaced that
-- immediately: a plain, harmless clip scored 20% on "sexual" from OpenAI
-- Moderation (a normal amount of noise for a single-frame check on a
-- low-risk video) and was routed to admin_review purely because low_max
-- was set to 0.15 — well below normal background noise for a clean video.
--
-- Raises low_max across every category so a clean video's typical baseline
-- noise (roughly 0-25%) reads as LOW, while high_min stays a wide margin
-- above it so genuinely risky content still routes to recheck/admin_review.
-- These are still not scientifically tuned — just a less trigger-happy
-- starting point — and should keep moving as real approve/reject outcomes
-- accumulate in content_moderation_results.
UPDATE public.moderation_thresholds SET low_max = 0.40, high_min = 0.80 WHERE category = 'sexual';
UPDATE public.moderation_thresholds SET low_max = 0.40, high_min = 0.80 WHERE category = 'violence';
UPDATE public.moderation_thresholds SET low_max = 0.40, high_min = 0.80 WHERE category = 'weapons';
UPDATE public.moderation_thresholds SET low_max = 0.40, high_min = 0.80 WHERE category = 'drugs';
UPDATE public.moderation_thresholds SET low_max = 0.35, high_min = 0.75 WHERE category = 'hate';
UPDATE public.moderation_thresholds SET low_max = 0.35, high_min = 0.75 WHERE category = 'threats';
UPDATE public.moderation_thresholds SET low_max = 0.35, high_min = 0.75 WHERE category = 'text';
