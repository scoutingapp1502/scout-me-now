import { supabase } from "@/integrations/supabase/client";

function genCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const suffix = Array.from({ length: 5 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `SPORT-${suffix}`;
}

export async function getOrCreateInviteCode(userId: string): Promise<string> {
  const { data: existing } = await (supabase as any)
    .from("user_invite_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  if ((existing as any)?.code) return (existing as any).code;

  const newCode = genCode();
  const { error } = await (supabase as any)
    .from("user_invite_codes")
    .upsert({ user_id: userId, code: newCode }, { onConflict: "user_id", ignoreDuplicates: true });

  if (!error) return newCode;

  const { data: retry } = await (supabase as any)
    .from("user_invite_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  return (retry as any)?.code ?? newCode;
}
