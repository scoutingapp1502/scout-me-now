import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle, XCircle, Flag, ShieldAlert, ShieldOff, Ban } from "lucide-react";
import { SignedImg, SignedVideo } from "@/components/SignedSrc";

// User-initiated reports (see 20261011090000_user_content_reports.sql) —
// separate from AdminContentModeration (the automated pipeline's own
// pending/flagged queue). "Aprobă" here means "this report is legitimate"
// (the reported content genuinely violates the rules), which deletes the
// content and increments approved_reports_count on its author — the
// OPPOSITE polarity from AdminContentModeration's "Aprobă" (which means
// "this content is fine"). Labeled explicitly below to avoid confusion.
type ReportFilter = "post" | "comment" | "avatar" | "video_highlight";

interface ReportItem {
  id: string;
  content_type: ReportFilter;
  content_id: string;
  post_id: string | null;
  content_owner_id: string;
  reporter_id: string;
  created_at: string;
  owner_name?: string;
  reporter_name?: string;
  avatar_table?: "player_profiles" | "scout_profiles";
  // Resolved content to actually show the admin what was reported.
  post_content?: string | null;
  post_image_url?: string | null;
  post_video_url?: string | null;
  // Which table content_id resolves in — a Descoperitor's own post
  // (scout_posts) is reported with the same content_type "post" as a
  // player's (see PostCard.handleReportPost / ScoutPersonalProfile's own
  // report button), so this is what tells reject-post which table to act
  // on. Only ever set for content_type "post".
  post_table?: "posts" | "scout_posts";
  comment_content?: string | null;
  avatar_url?: string | null;
  highlight_video_url?: string | null;
  highlight_status?: string | null;
}

export default function AdminUserReports({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReportFilter>("post");
  const [closingItem, setClosingItem] = useState<ReportItem | null>(null);
  const [closeReason, setCloseReason] = useState("");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("user_content_reports")
      .select("id, content_type, content_id, post_id, content_owner_id, reporter_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load user reports:", error);
      toast({ title: "Eroare la încărcare", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const rows: ReportItem[] = data || [];

    // Resolve names for both owner and reporter.
    const userIds = [...new Set(rows.flatMap((r) => [r.content_owner_id, r.reporter_id]))];
    const [playerRes, scoutRes] = await Promise.all([
      supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", userIds),
      supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", userIds),
    ]);
    const nameByUser = new Map<string, string>();
    const avatarTableByUser = new Map<string, "player_profiles" | "scout_profiles">();
    (playerRes.data || []).forEach((p: any) => { nameByUser.set(p.user_id, `${p.first_name} ${p.last_name}`.trim()); avatarTableByUser.set(p.user_id, "player_profiles"); });
    (scoutRes.data || []).forEach((s: any) => { if (!nameByUser.has(s.user_id)) { nameByUser.set(s.user_id, `${s.first_name} ${s.last_name}`.trim()); avatarTableByUser.set(s.user_id, "scout_profiles"); } });

    // Resolve the actual reported content per type. A reported "post" may
    // live in either posts or scout_posts (a Descoperitor's own post goes
    // through content_type "post" too — see PostCard.handleReportPost /
    // ScoutPersonalProfile.handleReportPost) — content_id alone can't say
    // which, so both tables are queried and whichever actually has the row
    // wins.
    const postIds = [...new Set(rows.filter((r) => r.content_type === "post").map((r) => r.content_id))];
    const commentIds = [...new Set(rows.filter((r) => r.content_type === "comment").map((r) => r.content_id))];
    const parentPostIds = [...new Set(rows.filter((r) => r.content_type === "comment" && r.post_id).map((r) => r.post_id as string))];
    const avatarUserIds = [...new Set(rows.filter((r) => r.content_type === "avatar").map((r) => r.content_id))];
    const highlightIds = [...new Set(rows.filter((r) => r.content_type === "video_highlight").map((r) => r.content_id))];

    const [postsRes, scoutPostsRes, parentPostsRes, commentsRes, playerAvatarsRes, scoutAvatarsRes, highlightsRes] = await Promise.all([
      postIds.length ? supabase.from("posts").select("id, content, image_url, video_url").in("id", postIds) : Promise.resolve({ data: [] }),
      postIds.length ? (supabase as any).from("scout_posts").select("id, content, image_url, video_url").in("id", postIds) : Promise.resolve({ data: [] }),
      parentPostIds.length ? supabase.from("posts").select("id, content, image_url, video_url").in("id", parentPostIds) : Promise.resolve({ data: [] }),
      commentIds.length ? supabase.from("post_comments").select("id, content").in("id", commentIds) : Promise.resolve({ data: [] }),
      avatarUserIds.length ? (supabase as any).from("player_profiles").select("user_id, pending_photo_url, photo_url").in("user_id", avatarUserIds) : Promise.resolve({ data: [] }),
      avatarUserIds.length ? (supabase as any).from("scout_profiles").select("user_id, pending_photo_url, photo_url").in("user_id", avatarUserIds) : Promise.resolve({ data: [] }),
      highlightIds.length ? (supabase as any).from("video_highlight_submissions").select("id, video_url, moderation_status").in("id", highlightIds) : Promise.resolve({ data: [] }),
    ]);
    const postById = new Map((postsRes.data || []).map((p: any) => [p.id, p]));
    const scoutPostById = new Map((scoutPostsRes.data || []).map((p: any) => [p.id, p]));
    const parentPostById = new Map((parentPostsRes.data || []).map((p: any) => [p.id, p]));
    const commentById = new Map((commentsRes.data || []).map((c: any) => [c.id, c]));
    const avatarUrlByUser = new Map<string, string | null>();
    (playerAvatarsRes.data || []).forEach((p: any) => avatarUrlByUser.set(p.user_id, p.pending_photo_url || p.photo_url));
    (scoutAvatarsRes.data || []).forEach((s: any) => { if (!avatarUrlByUser.has(s.user_id)) avatarUrlByUser.set(s.user_id, s.pending_photo_url || s.photo_url); });
    const highlightById = new Map((highlightsRes.data || []).map((h: any) => [h.id, h]));

    setItems(rows.map((r) => {
      const post = r.content_type === "post" ? (postById.get(r.content_id) ?? scoutPostById.get(r.content_id)) : r.post_id ? parentPostById.get(r.post_id) : null;
      const comment = r.content_type === "comment" ? commentById.get(r.content_id) : null;
      const highlight = r.content_type === "video_highlight" ? highlightById.get(r.content_id) : null;
      return {
        ...r,
        owner_name: nameByUser.get(r.content_owner_id) || "Utilizator",
        reporter_name: nameByUser.get(r.reporter_id) || "Utilizator",
        avatar_table: avatarTableByUser.get(r.content_owner_id),
        post_content: (post as any)?.content ?? null,
        post_image_url: (post as any)?.image_url ?? null,
        post_video_url: (post as any)?.video_url ?? null,
        post_table: r.content_type === "post" ? (postById.has(r.content_id) ? "posts" : "scout_posts") : undefined,
        comment_content: (comment as any)?.content ?? null,
        avatar_url: r.content_type === "avatar" ? avatarUrlByUser.get(r.content_id) ?? null : null,
        highlight_video_url: (highlight as any)?.video_url ?? null,
        highlight_status: (highlight as any)?.moderation_status ?? null,
      };
    }));
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const filteredItems = useMemo(() => items.filter((i) => i.content_type === filter), [items, filter]);
  const counts = useMemo(() => ({
    post: items.filter((i) => i.content_type === "post").length,
    comment: items.filter((i) => i.content_type === "comment").length,
    avatar: items.filter((i) => i.content_type === "avatar").length,
    video_highlight: items.filter((i) => i.content_type === "video_highlight").length,
  }), [items]);

  // "Aprobă" = the report is legitimate: increments approved_reports_count
  // (via approve_user_report) then deletes the underlying content —
  // comments are deleted by that same RPC directly; posts/avatars need the
  // service-role Edge Functions for storage cleanup, called right after
  // with skip_counter so rejected_posts_count isn't double-bumped for the
  // same event.
  const handleApprove = async (item: ReportItem) => {
    setProcessing(item.id);
    const { error } = await (supabase as any).rpc("approve_user_report", { p_report_id: item.id });
    if (error) {
      setProcessing(null);
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    if (item.content_type === "post") {
      const { error: rejectError } = await supabase.functions.invoke("reject-post", { body: { post_id: item.content_id, skip_counter: true, table: item.post_table ?? "posts" } });
      if (rejectError) console.error("Failed to delete reported post after report approval:", rejectError);
    } else if (item.content_type === "avatar" && item.avatar_table) {
      // reject_live: true — a reported avatar is always the current,
      // already-approved photo_url (a user can only ever see/report what's
      // actually live, never a pending_photo_url still awaiting the
      // automated pipeline). Clears photo_url outright rather than the
      // pending-avatar rejection path AdminContentModeration uses.
      const { error: rejectError } = await supabase.functions.invoke("reject-avatar", {
        body: { user_id: item.content_id, avatar_table: item.avatar_table, reason: "Raport utilizator aprobat", skip_counter: true, reject_live: true },
      });
      if (rejectError) console.error("Failed to reject reported avatar after report approval:", rejectError);
    } else if (item.content_type === "video_highlight") {
      // approve_user_report already ran reject_video_highlight (removes it
      // from the live arrays if it was approved, flips the submission's own
      // status) — this call is just the storage file cleanup.
      const { error: rejectError } = await supabase.functions.invoke("reject-video-highlight", { body: { submission_id: item.content_id } });
      if (rejectError) console.error("Failed to clean up reported video highlight after report approval:", rejectError);
    }
    setProcessing(null);
    toast({ title: "Raport aprobat. Conținutul a fost șters." });
    await fetchReports();
  };

  const handleDismiss = async (item: ReportItem) => {
    setProcessing(item.id);
    const { error } = await (supabase as any).rpc("dismiss_user_report", { p_report_id: item.id });
    setProcessing(null);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Raport respins." });
    await fetchReports();
  };

  // Same three account-level actions as AdminUsersAtRisk, reused here so an
  // admin can act on the reported author directly without navigating away
  // — per explicit product decision.
  const handleWarn = async (item: ReportItem) => {
    setProcessing(item.id);
    const { error } = await (supabase as any).rpc("issue_user_warning", { p_user_id: item.content_owner_id });
    setProcessing(null);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Avertisment trimis utilizatorului." });
  };

  const handleBan = async (item: ReportItem) => {
    setProcessing(item.id);
    const { error } = await supabase.functions.invoke("ban-user", { body: { userId: item.content_owner_id, action: "ban" } });
    setProcessing(null);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cont blocat." });
  };

  const handleClosePermanently = async () => {
    if (!closingItem) return;
    setProcessing(closingItem.id);
    const { error } = await supabase.functions.invoke("close-account-permanently", {
      body: { userId: closingItem.content_owner_id, reason: closeReason.trim() || null },
    });
    setProcessing(null);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cont închis definitiv. Emailul nu mai poate fi reutilizat." });
    setClosingItem(null);
    setCloseReason("");
  };

  const filterLabels: Record<ReportFilter, string> = { post: "Postări", comment: "Comentarii postări", avatar: "Poze de profil", video_highlight: "Video Highlights" };

  const content = (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4 text-gray-900">
      <div className="flex items-center gap-2">
        <Flag className="h-5 w-5 text-red-600" />
        <h2 className="text-xl font-heading font-bold">Rapoarte Utilizatori</h2>
      </div>
      <p className="text-sm text-gray-500 font-body">
        Rapoarte trimise de utilizatori pe postări, comentarii, poze de profil sau video highlights. Aprobarea unui raport șterge conținutul și crește contorul de rapoarte aprobate al autorului.
      </p>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-3">
        {(Object.keys(filterLabels) as ReportFilter[]).map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm font-body cursor-pointer">
            <input type="radio" name="report-filter" checked={filter === key} onChange={() => setFilter(key)} className="accent-orange-500" />
            {filterLabels[key]} <span className="text-gray-400">({counts[key]})</span>
          </label>
        ))}
      </div>

      <p className="text-sm text-gray-500 font-body">{filteredItems.length} rapoarte în așteptare</p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : filteredItems.length === 0 ? (
        <p className="text-center text-gray-500 py-12 font-body">Niciun raport în această categorie.</p>
      ) : (
        filteredItems.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-heading font-semibold">{item.owner_name}</p>
                <p className="text-xs text-gray-500 font-body mt-0.5">
                  Raportat de {item.reporter_name} ·{" "}
                  {new Date(item.created_at).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <Badge variant="outline" className="text-red-600 border-red-500">{filterLabels[item.content_type]}</Badge>
            </div>

            {/* For a reported comment, show the parent post for context AND
                the comment itself — explicit product requirement. */}
            {item.content_type === "comment" && (item.post_content || item.post_image_url || item.post_video_url) && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500">Postarea originală</p>
                {item.post_content && <p className="text-sm text-gray-700 font-body whitespace-pre-wrap">{item.post_content}</p>}
                {item.post_image_url && <SignedImg src={item.post_image_url} alt="" className="max-h-48 rounded-lg object-cover" />}
                {item.post_video_url && <SignedVideo src={item.post_video_url} controls className="max-h-48 rounded-lg bg-black w-full" />}
              </div>
            )}
            {item.content_type === "comment" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">Comentariu raportat</p>
                <p className="text-sm text-gray-900 font-body whitespace-pre-wrap">{item.comment_content}</p>
              </div>
            )}
            {item.content_type === "post" && (
              <>
                {item.post_content && <p className="text-sm text-gray-900 font-body bg-gray-100 rounded-lg px-3 py-2 whitespace-pre-wrap">{item.post_content}</p>}
                {item.post_image_url && <SignedImg src={item.post_image_url} alt="" className="max-h-64 rounded-lg object-cover" />}
                {item.post_video_url && <SignedVideo src={item.post_video_url} controls className="max-h-64 rounded-lg bg-black w-full" />}
              </>
            )}
            {item.content_type === "avatar" && item.avatar_url && (
              <SignedImg src={item.avatar_url} alt="" className="max-h-64 rounded-lg object-cover" />
            )}
            {item.content_type === "video_highlight" && item.highlight_video_url && (
              <SignedVideo src={item.highlight_video_url} controls className="max-h-64 rounded-lg bg-black w-full" />
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700 text-white" disabled={processing === item.id} onClick={() => handleApprove(item)}>
                {processing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Aprobă raportul (șterge conținutul)
              </Button>
              <Button size="sm" variant="outline" className="gap-2" disabled={processing === item.id} onClick={() => handleDismiss(item)}>
                {processing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Respinge raportul
              </Button>
              <Button size="sm" variant="outline" className="gap-2" disabled={processing === item.id} onClick={() => handleWarn(item)}>
                {processing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                Avertizează
              </Button>
              <Button size="sm" variant="destructive" className="gap-2" disabled={processing === item.id} onClick={() => handleBan(item)}>
                {processing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                Blochează
              </Button>
              <Button size="sm" variant="destructive" className="gap-2 bg-red-900 hover:bg-red-950" disabled={processing === item.id} onClick={() => { setClosingItem(item); setCloseReason(""); }}>
                <Ban className="h-4 w-4" />
                Închide definitiv
              </Button>
            </div>
          </div>
        ))
      )}

      <Dialog open={!!closingItem} onOpenChange={(open) => { if (!open) { setClosingItem(null); setCloseReason(""); } }}>
        <DialogContent className="bg-white border-gray-200 text-gray-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Ban className="h-5 w-5" /> Închide contul definitiv
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 font-body">
            Această acțiune este <strong>ireversibilă</strong>. Contul lui <strong>{closingItem?.owner_name}</strong> va fi
            blocat definitiv, iar adresa de email nu va mai putea fi folosită niciodată pentru un cont nou pe SportRise.
            Datele contului nu sunt șterse.
          </p>
          <Textarea
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="Motiv (opțional, pentru evidența internă)..."
            className="font-body text-sm resize-none"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setClosingItem(null); setCloseReason(""); }}>
              Anulează
            </Button>
            <Button
              variant="destructive"
              className="bg-red-900 hover:bg-red-950 gap-2"
              disabled={processing === closingItem?.id}
              onClick={handleClosePermanently}
            >
              {processing === closingItem?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Confirm închiderea definitivă
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (embedded) return content;
  return content;
}
