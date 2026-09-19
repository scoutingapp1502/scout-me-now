import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, ShieldAlert, Flag } from "lucide-react";
import { SignedImg, SignedVideo } from "@/components/SignedSrc";

// Admin queue for the automated video/content moderation pipeline (see
// VIDEO_MODERATION_IMPLEMENTATION_PROMPT.md §8). Deliberately separate from
// AdminSupportTickets — that page is for user-filed reports about accounts;
// this one is content sitting in moderation_status pending/flagged, whether
// it got there from the automated pipeline or from a post-publish report.
interface QueueItem {
  id: string;
  content_type: "post" | "test_video";
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

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    const [postsRes, submissionsRes] = await Promise.all([
      // No longer restricted to video posts — text and photo posts go
      // through the same moderation pipeline now. deleted_at is selected
      // (not filtered out) so a post the author deleted while still under
      // review still shows up here — as "deleted by user", not silently
      // vanished — until an admin dismisses it.
      supabase.from("posts").select("id, user_id, content, image_url, video_url, moderation_status, created_at, deleted_at")
        .in("moderation_status", ["pending", "flagged"])
        .order("created_at", { ascending: false }),
      supabase.from("video_submissions").select("id, user_id, video_url, moderation_status, created_at")
        .in("moderation_status", ["pending", "flagged"])
        .order("created_at", { ascending: false }),
    ]);

    const postItems: QueueItem[] = (postsRes.data || []).map((p: any) => ({
      id: p.id, content_type: "post", user_id: p.user_id, moderation_status: p.moderation_status,
      video_url: p.video_url, image_url: p.image_url, content: p.content, created_at: p.created_at,
      deleted_at: p.deleted_at,
    }));
    const submissionItems: QueueItem[] = (submissionsRes.data || []).map((s: any) => ({
      id: s.id, content_type: "test_video", user_id: s.user_id, moderation_status: s.moderation_status,
      video_url: s.video_url, image_url: null, content: null, created_at: s.created_at,
    }));
    const all = [...postItems, ...submissionItems];

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
    // status-flip behavior for now.
    if (decision === "rejected" && item.content_type === "post") {
      const { error } = await supabase.functions.invoke("reject-post", { body: { post_id: item.id } });
      setProcessing(null);
      if (error) {
        toast({ title: "Eroare", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Conținut respins și șters." });
      await fetchQueue();
      return;
    }

    const table = item.content_type === "post" ? "posts" : "video_submissions";
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
    const { error } = await supabase.from("posts").update({ moderation_status: "approved" }).eq("id", item.id);
    setProcessing(null);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Element scos din coadă." });
    await fetchQueue();
  };

  const content = (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4 text-gray-900">
      <h2 className="text-xl font-heading font-bold">Moderare conținut</h2>
      <p className="text-sm text-gray-500 font-body">
        {items.length} elemente în așteptare de verificare
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-500 py-12 font-body">Nu există conținut de verificat.</p>
      ) : (
        items.map((item) => {
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
                    {item.content_type === "post" ? "Postare" : "Video test"} ·{" "}
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
                  <Button size="sm" variant="outline" className="gap-2" disabled={processing === item.id} onClick={() => handleDismissDeleted(item)}>
                    {processing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Anulează
                  </Button>
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
