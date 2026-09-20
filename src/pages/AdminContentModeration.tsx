import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, ShieldAlert, Flag } from "lucide-react";
import { SignedImg, SignedVideo } from "@/components/SignedSrc";

// "post" here also covers "test_video" — technical performance test
// uploads are just another kind of post-like content for this filter,
// per explicit product decision (not worth a third radio option).
type QueueFilter = "posts" | "avatars" | "video_highlights";

// Admin queue for the automated video/content moderation pipeline (see
// VIDEO_MODERATION_IMPLEMENTATION_PROMPT.md §8). Deliberately separate from
// AdminSupportTickets — that page is for user-filed reports about accounts;
// this one is content sitting in moderation_status pending/flagged, whether
// it got there from the automated pipeline or from a post-publish report.
interface QueueItem {
  id: string;
  content_type: "post" | "scout_post" | "test_video" | "avatar" | "video_highlight";
  user_id: string;
  moderation_status: string;
  video_url: string | null;
  image_url: string | null;
  content: string | null;
  created_at: string;
  deleted_at?: string | null;
  author_name?: string;
  author_dob?: string | null;
  latest_scores?: Record<string, number>;
  latest_reason?: string | null;
  report_reason?: string | null;
  // Only set for content_type "avatar" — which profile table to act on.
  // An avatar has no dedicated row/id of its own; `id` is the user_id.
  avatar_table?: "player_profiles" | "scout_profiles";
}

const CATEGORY_LABELS: Record<string, string> = {
  sexual: "Conținut sexual", violence: "Violență", weapons: "Arme",
  drugs: "Droguri", hate: "Discurs instigator la ură", threats: "Amenințări/hărțuire", text: "Text",
};

export default function AdminContentModeration({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("posts");

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    const [postsRes, scoutPostsRes, submissionsRes, playerAvatarsRes, scoutAvatarsRes, highlightsRes] = await Promise.all([
      // No longer restricted to video posts — text and photo posts go
      // through the same moderation pipeline now. deleted_at is selected
      // (not filtered out) so a post the author deleted while still under
      // review still shows up here — as "deleted by user", not silently
      // vanished — until an admin dismisses it.
      supabase.from("posts").select("id, user_id, content, image_url, video_url, moderation_status, created_at, deleted_at")
        .in("moderation_status", ["pending", "flagged"])
        .order("created_at", { ascending: false }),
      // A Descoperitor's own post (scout_posts) goes through the exact same
      // pipeline now (see 20261016090000_scout_posts_same_pipeline_as_posts.sql)
      // — grouped into the same "Postări" filter as posts/test_video below,
      // not a separate radio option.
      (supabase as any).from("scout_posts").select("id, user_id, content, image_url, video_url, moderation_status, created_at, deleted_at")
        .in("moderation_status", ["pending", "flagged"])
        .order("created_at", { ascending: false }),
      supabase.from("video_submissions").select("id, user_id, video_url, moderation_status, created_at")
        .in("moderation_status", ["pending", "flagged"])
        .order("created_at", { ascending: false }),
      (supabase as any).from("player_profiles").select("user_id, pending_photo_url, avatar_moderation_status, avatar_submitted_at")
        .not("pending_photo_url", "is", null).not("avatar_moderation_status", "is", null),
      (supabase as any).from("scout_profiles").select("user_id, pending_photo_url, avatar_moderation_status, avatar_submitted_at")
        .not("pending_photo_url", "is", null).not("avatar_moderation_status", "is", null),
      // Uploaded-file highlights only — YouTube links never enter this
      // table (see 20261015090000_video_highlights_moderation.sql header).
      (supabase as any).from("video_highlight_submissions").select("id, user_id, video_url, description, moderation_status, created_at")
        .in("moderation_status", ["pending", "flagged"])
        .order("created_at", { ascending: false }),
    ]);
    if (scoutPostsRes.error) console.error("Failed to load pending scout posts:", scoutPostsRes.error);
    if (playerAvatarsRes.error) console.error("Failed to load pending player avatars:", playerAvatarsRes.error);
    if (scoutAvatarsRes.error) console.error("Failed to load pending scout avatars:", scoutAvatarsRes.error);
    if (highlightsRes.error) console.error("Failed to load pending video highlights:", highlightsRes.error);

    const postItems: QueueItem[] = (postsRes.data || []).map((p: any) => ({
      id: p.id, content_type: "post", user_id: p.user_id, moderation_status: p.moderation_status,
      video_url: p.video_url, image_url: p.image_url, content: p.content, created_at: p.created_at,
      deleted_at: p.deleted_at,
    }));
    const scoutPostItems: QueueItem[] = (scoutPostsRes.data || []).map((p: any) => ({
      id: p.id, content_type: "scout_post", user_id: p.user_id, moderation_status: p.moderation_status,
      video_url: p.video_url, image_url: p.image_url, content: p.content, created_at: p.created_at,
      deleted_at: p.deleted_at,
    }));
    const submissionItems: QueueItem[] = (submissionsRes.data || []).map((s: any) => ({
      id: s.id, content_type: "test_video", user_id: s.user_id, moderation_status: s.moderation_status,
      video_url: s.video_url, image_url: null, content: null, created_at: s.created_at,
    }));
    const avatarItems: QueueItem[] = [
      ...(playerAvatarsRes.data || []).map((a: any) => ({
        id: a.user_id, content_type: "avatar" as const, user_id: a.user_id, moderation_status: a.avatar_moderation_status,
        video_url: null, image_url: a.pending_photo_url, content: null, created_at: a.avatar_submitted_at,
        avatar_table: "player_profiles" as const,
      })),
      ...(scoutAvatarsRes.data || []).map((a: any) => ({
        id: a.user_id, content_type: "avatar" as const, user_id: a.user_id, moderation_status: a.avatar_moderation_status,
        video_url: null, image_url: a.pending_photo_url, content: null, created_at: a.avatar_submitted_at,
        avatar_table: "scout_profiles" as const,
      })),
    ];
    const highlightItems: QueueItem[] = (highlightsRes.data || []).map((h: any) => ({
      id: h.id, content_type: "video_highlight" as const, user_id: h.user_id, moderation_status: h.moderation_status,
      video_url: h.video_url, image_url: null, content: h.description || null, created_at: h.created_at,
    }));
    const all = [...postItems, ...scoutPostItems, ...submissionItems, ...avatarItems, ...highlightItems];

    const userIds = [...new Set(all.map((i) => i.user_id))];
    const [playerRes, scoutRes, reportsRes] = await Promise.all([
      supabase.from("player_profiles").select("user_id, first_name, last_name, date_of_birth").in("user_id", userIds),
      supabase.from("scout_profiles").select("user_id, first_name, last_name").in("user_id", userIds),
      (supabase as any).from("support_tickets").select("reported_content_type, reported_content_id, message")
        .not("reported_content_id", "is", null),
    ]);
    const nameByUser = new Map<string, { name: string; dob?: string | null }>();
    (playerRes.data || []).forEach((p: any) => nameByUser.set(p.user_id, { name: `${p.first_name} ${p.last_name}`.trim(), dob: p.date_of_birth }));
    (scoutRes.data || []).forEach((s: any) => { if (!nameByUser.has(s.user_id)) nameByUser.set(s.user_id, { name: `${s.first_name} ${s.last_name}`.trim() }); });

    const reportByContent = new Map<string, string>();
    (reportsRes.data || []).forEach((r: any) => reportByContent.set(`${r.reported_content_type}:${r.reported_content_id}`, r.message));

    const contentIds = all.map((i) => i.id);
    const { data: results } = await (supabase as any)
      .from("content_moderation_results")
      .select("content_id, scores, reason, stage, created_at")
      .in("content_id", contentIds)
      .order("created_at", { ascending: false });
    const latestByContent = new Map<string, { scores: Record<string, number>; reason: string | null }>();
    (results || []).forEach((r: any) => {
      if (!latestByContent.has(r.content_id)) latestByContent.set(r.content_id, { scores: r.scores, reason: r.reason });
    });

    setItems(all.map((i) => ({
      ...i,
      author_name: nameByUser.get(i.user_id)?.name || "Utilizator",
      author_dob: nameByUser.get(i.user_id)?.dob,
      latest_scores: latestByContent.get(i.id)?.scores,
      latest_reason: latestByContent.get(i.id)?.reason,
      report_reason: reportByContent.get(`${i.content_type}:${i.id}`),
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const handleDecision = async (item: QueueItem, decision: "approved" | "rejected") => {
    setProcessing(item.id);

    // Rejecting a post is a hard delete (row + storage files), not a status
    // flip — see reject-post's header comment. video_submissions has no
    // equivalent function yet, so a rejected test video keeps the old
    // status-flip behavior for now. "scout_post" is a Descoperitor's own
    // post — same function, same behavior, just a different source table
    // (see 20261016090000_scout_posts_same_pipeline_as_posts.sql).
    if (decision === "rejected" && (item.content_type === "post" || item.content_type === "scout_post")) {
      const { error } = await supabase.functions.invoke("reject-post", {
        body: { post_id: item.id, table: item.content_type === "scout_post" ? "scout_posts" : "posts" },
      });
      setProcessing(null);
      if (error) {
        toast({ title: "Eroare", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Conținut respins și șters." });
      await fetchQueue();
      return;
    }

    // Avatars have a different shape entirely — no separate row to flip a
    // status on, just pending_photo_url/avatar_moderation_status staged on
    // the profile row (see 20261006090000_avatar_moderation.sql). Approval
    // promotes the pending file into photo_url via the same
    // approve_pending_avatar RPC the pipeline itself uses; rejection deletes
    // the pending file and increments rejected_posts_count, identically to
    // a rejected post, via the reject-avatar Edge Function.
    if (item.content_type === "avatar") {
      if (decision === "approved") {
        const { error } = await (supabase as any).rpc("approve_pending_avatar", { p_user_id: item.user_id, p_table: item.avatar_table });
        setProcessing(null);
        if (error) {
          toast({ title: "Eroare", description: error.message, variant: "destructive" });
          return;
        }
        toast({ title: "Poză de profil aprobată." });
      } else {
        const { error } = await supabase.functions.invoke("reject-avatar", {
          body: { user_id: item.user_id, avatar_table: item.avatar_table },
        });
        setProcessing(null);
        if (error) {
          toast({ title: "Eroare", description: error.message, variant: "destructive" });
          return;
        }
        toast({ title: "Poză de profil respinsă." });
      }
      await fetchQueue();
      return;
    }

    // Video highlights: approval appends the url/description into
    // player_profiles' live arrays and flips the submission row to
    // 'approved' (kept, never deleted — see the migration header);
    // rejection deletes the storage file and, if it had already gone live
    // (a report being upheld), removes it from those arrays too — both via
    // the reject-video-highlight Edge Function, same division of labor as
    // reject-post/reject-avatar.
    if (item.content_type === "video_highlight") {
      if (decision === "approved") {
        const { error } = await (supabase as any).rpc("approve_video_highlight", { p_submission_id: item.id });
        setProcessing(null);
        if (error) {
          toast({ title: "Eroare", description: error.message, variant: "destructive" });
          return;
        }
        toast({ title: "Video highlight aprobat." });
      } else {
        const { error } = await supabase.functions.invoke("reject-video-highlight", {
          body: { submission_id: item.id },
        });
        setProcessing(null);
        if (error) {
          toast({ title: "Eroare", description: error.message, variant: "destructive" });
          return;
        }
        toast({ title: "Video highlight respins." });
      }
      await fetchQueue();
      return;
    }

    // Only ever reached here for "approved" (post/scout_post "rejected"
    // returns early above) or a "test_video" of either decision.
    const table = item.content_type === "post" ? "posts" : item.content_type === "scout_post" ? "scout_posts" : "video_submissions";
    // .select() is required here, not cosmetic: without it, Supabase/PostgREST
    // reports success with no error even when RLS silently filters the
    // update to zero affected rows (e.g. a missing admin UPDATE policy) —
    // exactly the bug that made Approve/Reject show a success toast on
    // posts while changing nothing.
    const { data, error } = await supabase.from(table).update({ moderation_status: decision }).eq("id", item.id).select("id");
    setProcessing(null);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    if (!data || data.length === 0) {
      toast({ title: "Nicio modificare aplicată", description: "Rândul nu a fost găsit sau nu ai drepturi asupra lui.", variant: "destructive" });
      return;
    }
    toast({ title: decision === "approved" ? "Conținut aprobat." : "Conținut respins." });
    await fetchQueue();
  };

  // For a post the author already deleted (deleted_at set) while it was
  // still pending/flagged — there is nothing left to approve or reject, it
  // is already invisible everywhere (every read path filters deleted_at IS
  // NULL). This just clears it from the queue; moderation_status is set to
  // 'approved' purely as a queue-exit value, it has no visibility effect on
  // an already-deleted post, and it is NOT the same as an admin rejection —
  // it must never touch rejected_posts_count.
  const handleDismissDeleted = async (item: QueueItem) => {
    setProcessing(item.id);
    const table = item.content_type === "scout_post" ? "scout_posts" : "posts";
    const { error } = await (supabase as any).from(table).update({ moderation_status: "approved" }).eq("id", item.id);
    setProcessing(null);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Element scos din coadă." });
    await fetchQueue();
  };

  // Pure display filter — all three categories stay loaded in `items` at
  // all times (badge counts elsewhere in the admin sidebar count everything
  // regardless of this toggle), this just narrows what's rendered.
  const filteredItems = useMemo(
    () => items.filter((i) => {
      if (filter === "avatars") return i.content_type === "avatar";
      if (filter === "video_highlights") return i.content_type === "video_highlight";
      return i.content_type !== "avatar" && i.content_type !== "video_highlight";
    }),
    [items, filter]
  );
  const postsCount = useMemo(() => items.filter((i) => i.content_type !== "avatar" && i.content_type !== "video_highlight").length, [items]);
  const avatarsCount = useMemo(() => items.filter((i) => i.content_type === "avatar").length, [items]);
  const highlightsCount = useMemo(() => items.filter((i) => i.content_type === "video_highlight").length, [items]);

  const content = (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4 text-gray-900">
      <h2 className="text-xl font-heading font-bold">Moderare conținut</h2>

      <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-3">
        <label className="flex items-center gap-2 text-sm font-body cursor-pointer">
          <input type="radio" name="queue-filter" checked={filter === "posts"} onChange={() => setFilter("posts")} className="accent-orange-500" />
          Postări <span className="text-gray-400">({postsCount})</span>
        </label>
        <label className="flex items-center gap-2 text-sm font-body cursor-pointer">
          <input type="radio" name="queue-filter" checked={filter === "avatars"} onChange={() => setFilter("avatars")} className="accent-orange-500" />
          Poze de profil <span className="text-gray-400">({avatarsCount})</span>
        </label>
        <label className="flex items-center gap-2 text-sm font-body cursor-pointer">
          <input type="radio" name="queue-filter" checked={filter === "video_highlights"} onChange={() => setFilter("video_highlights")} className="accent-orange-500" />
          Video Highlights <span className="text-gray-400">({highlightsCount})</span>
        </label>
      </div>

      <p className="text-sm text-gray-500 font-body">
        {filteredItems.length} elemente în așteptare de verificare
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : filteredItems.length === 0 ? (
        <p className="text-center text-gray-500 py-12 font-body">Nu există conținut de verificat în această categorie.</p>
      ) : (
        filteredItems.map((item) => {
          const isMinorAuthor = item.author_dob ? (() => {
            const dob = new Date(item.author_dob!);
            const eighteenth = new Date(dob); eighteenth.setFullYear(dob.getFullYear() + 18);
            return eighteenth > new Date();
          })() : false;

          return (
            <div key={`${item.content_type}-${item.id}`} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-heading font-semibold">
                    {item.author_name}
                    {isMinorAuthor && <span className="ml-2 text-xs font-normal text-orange-600">(minor)</span>}
                  </p>
                  <p className="text-xs text-gray-500 font-body mt-0.5">
                    {item.content_type === "post" ? "Postare" : item.content_type === "scout_post" ? "Postare (Descoperitor)" : item.content_type === "avatar" ? "Poză de profil" : item.content_type === "video_highlight" ? "Video Highlight" : "Video test"} ·{" "}
                    {new Date(item.created_at).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {item.deleted_at ? (
                  <Badge variant="outline" className="text-gray-500 border-gray-400">Ștearsă de utilizator</Badge>
                ) : (
                  <Badge variant="outline" className={item.moderation_status === "flagged" ? "text-red-600 border-red-500" : "text-yellow-600 border-yellow-500"}>
                    {item.moderation_status === "flagged" ? "Semnalat" : "În așteptare"}
                  </Badge>
                )}
              </div>

              {item.content && <p className="text-sm text-gray-900 font-body bg-gray-100 rounded-lg px-3 py-2 whitespace-pre-wrap">{item.content}</p>}
              {item.image_url && <SignedImg src={item.image_url} alt="" className="max-h-64 rounded-lg object-cover" />}
              {item.video_url && <SignedVideo src={item.video_url} controls className="max-h-64 rounded-lg bg-black w-full" />}

              {item.latest_scores && Object.keys(item.latest_scores).length > 0 && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Scoruri de risc</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(item.latest_scores).map(([cat, score]) => (
                      <span key={cat} className="text-xs bg-white rounded-full px-2.5 py-1 border border-gray-200">
                        {CATEGORY_LABELS[cat] || cat}: {(Number(score) * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                  {item.latest_reason && <p className="text-xs text-gray-600">{item.latest_reason}</p>}
                </div>
              )}

              {item.report_reason && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><Flag className="h-3.5 w-3.5" /> Raportat de un utilizator</p>
                  <p className="text-xs text-gray-600 mt-1">{item.report_reason}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {item.deleted_at ? (
                  <>
                    <Button size="sm" variant="outline" className="gap-2" disabled={processing === item.id} onClick={() => handleDismissDeleted(item)}>
                      {processing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Anulează
                    </Button>
                    {/* The author already deleted this themselves, so there's
                        nothing left to make invisible — but an admin can
                        still judge it as having genuinely been a violation,
                        which increments rejected_posts_count exactly like a
                        normal rejection (reject-post already hard-deletes
                        the row + best-effort cleans up storage regardless of
                        whether it was already soft-deleted). Without this,
                        a user could dodge the counter entirely just by
                        deleting a flagged post before an admin gets to it. */}
                    <Button size="sm" variant="destructive" className="gap-2" disabled={processing === item.id} onClick={() => handleDecision(item, "rejected")}>
                      {processing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Respinge
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white" disabled={processing === item.id} onClick={() => handleDecision(item, "approved")}>
                      {processing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      Aprobă
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-2" disabled={processing === item.id} onClick={() => handleDecision(item, "rejected")}>
                      {processing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Respinge
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  if (embedded) return content;
  return content;
}
