import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ShieldAlert, Ban, ShieldOff, ShieldCheck, XCircle, Search, Users, MessageSquare, Download, FileCheck } from "lucide-react";
import jsPDF from "jspdf";

const PAGE_SIZE = 30;

// Full, searchable user directory — separate from AdminUsersAtRisk (which
// only lists accounts already past the rejected/reports threshold). An
// admin needs to be able to act on ANY account directly by name/email, not
// just the ones already flagged automatically.
interface DirectoryUser {
  user_id: string;
  first_name: string;
  last_name: string;
  role: "player" | "cauta_jucator";
  rejected_posts_count: number;
  approved_reports_count: number;
  warning_count: number;
  email: string;
  account_status: "active" | "banned" | "closed";
}

const ROLE_LABEL: Record<string, string> = { player: "Jucător", cauta_jucator: "Scouter" };

interface ConversationRow {
  conversation_id: string;
  other_user_id: string;
  other_name: string;
  message_count: number;
  last_message_at: string | null;
}

export default function AdminAllUsers({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [closingUser, setClosingUser] = useState<DirectoryUser | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Conversation export (legal evidence) — see
  // 20261017090000_minor_safety_messaging_and_activity.sql. Kept entirely
  // separate from the warn/ban/close actions above.
  const [conversationsUser, setConversationsUser] = useState<DirectoryUser | null>(null);
  const [conversationsList, setConversationsList] = useState<ConversationRow[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [exportingConversationId, setExportingConversationId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(async (offset: number) => {
    const { data, error } = await (supabase as any).rpc("search_all_users", {
      p_search: debouncedSearch || null, p_limit: PAGE_SIZE, p_offset: offset,
    });
    if (error) { console.error("Failed to search users:", error); return []; }
    return (data || []) as DirectoryUser[];
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHasMore(true);
    fetchPage(0).then((page) => {
      if (cancelled) return;
      setUsers(page);
      setHasMore(page.length === PAGE_SIZE);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const page = await fetchPage(users.length);
    setUsers((prev) => [...prev, ...page]);
    setHasMore(page.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [fetchPage, users.length, loadingMore, hasMore, loading]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore(); }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const isBanned = (u: DirectoryUser) => u.account_status === "banned";
  const isClosed = (u: DirectoryUser) => u.account_status === "closed";

  const handleIssueWarning = async (u: DirectoryUser) => {
    setProcessing(u.user_id);
    const { error } = await (supabase as any).rpc("issue_user_warning", { p_user_id: u.user_id });
    setProcessing(null);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Avertisment trimis utilizatorului." });
    setUsers((prev) => prev.map((x) => x.user_id === u.user_id ? { ...x, warning_count: x.warning_count + 1 } : x));
  };

  const handleBanToggle = async (u: DirectoryUser) => {
    setProcessing(u.user_id);
    const { error } = await supabase.functions.invoke("ban-user", {
      body: { userId: u.user_id, action: isBanned(u) ? "unban" : "ban" },
    });
    setProcessing(null);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isBanned(u) ? "Cont deblocat." : "Cont blocat." });
    setUsers((prev) => prev.map((x) => x.user_id === u.user_id ? { ...x, account_status: isBanned(u) ? "active" : "banned" } : x));
  };

  const handleClosePermanently = async () => {
    if (!closingUser) return;
    setProcessing(closingUser.user_id);
    const { error } = await supabase.functions.invoke("close-account-permanently", {
      body: { userId: closingUser.user_id, reason: closeReason.trim() || null },
    });
    setProcessing(null);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cont închis definitiv. Emailul nu mai poate fi reutilizat." });
    setUsers((prev) => prev.map((x) => x.user_id === closingUser.user_id ? { ...x, account_status: "closed" } : x));
    setClosingUser(null);
    setCloseReason("");
  };

  const handleOpenConversations = async (u: DirectoryUser) => {
    setConversationsUser(u);
    setConversationsList([]);
    setLoadingConversations(true);
    const { data, error } = await (supabase as any).rpc("get_user_conversations_for_admin", { _user_id: u.user_id });
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      setLoadingConversations(false);
      return;
    }
    const rows = (data || []) as { conversation_id: string; other_user_id: string; message_count: number; last_message_at: string | null }[];
    const otherIds = [...new Set(rows.map((r) => r.other_user_id))];
    const [playerRes, scoutRes] = otherIds.length
      ? await Promise.all([
          supabase.from("player_profiles").select("user_id, first_name, last_name").in("user_id", otherIds),
          supabase.from("scout_profiles").select("user_id, first_name, last_name").in("user_id", otherIds),
        ])
      : [{ data: [] }, { data: [] }];
    const nameByUser = new Map<string, string>();
    (playerRes.data || []).forEach((p: any) => nameByUser.set(p.user_id, `${p.first_name} ${p.last_name}`.trim()));
    (scoutRes.data || []).forEach((s: any) => { if (!nameByUser.has(s.user_id)) nameByUser.set(s.user_id, `${s.first_name} ${s.last_name}`.trim()); });
    setConversationsList(rows.map((r) => ({ ...r, other_name: nameByUser.get(r.other_user_id) || "Utilizator" })));
    setLoadingConversations(false);
  };

  // Exports one conversation as a PDF (messages + every parental-presence
  // confirmation on record, with timestamps) and computes a SHA-256 hash of
  // the EXACT JSON snapshot the PDF was built from — using the browser's
  // native Web Crypto API, no extra dependency. The hash is recorded
  // server-side (conversation_export_log, append-only, admin-readable only)
  // alongside who exported it and when, so a later dispute can verify a
  // given export was genuinely produced from real data: recomputing
  // get_conversation_export for the same conversation and re-hashing it
  // should reproduce a hash already on file, and any mismatch is itself
  // evidence that something changed. This does NOT prove the PDF file
  // itself wasn't altered after being saved — only that the data it was
  // built from, at export time, is on record and reproducible.
  const handleExportConversation = async (conv: ConversationRow) => {
    if (!conversationsUser) return;
    setExportingConversationId(conv.conversation_id);
    try {
      const { data: snapshot, error } = await (supabase as any).rpc("get_conversation_export", {
        _conversation_id: conv.conversation_id,
      });
      if (error) throw error;

      // Canonical JSON string — the exact bytes that get hashed. Must match
      // 1:1 with what's re-hashed later for verification, so this string is
      // never reformatted/re-serialized after this point.
      const canonicalJson = JSON.stringify(snapshot);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson));
      const hashHex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");

      const { error: logError } = await (supabase as any).from("conversation_export_log").insert({
        conversation_id: conv.conversation_id,
        exported_by: (await supabase.auth.getUser()).data.user?.id,
        content_sha256: hashHex,
      });
      if (logError) throw logError;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 14;
      let y = 18;

      doc.setFontSize(16);
      doc.text("Export conversație — dovadă legală", marginX, y);
      y += 8;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Conversație: ${conv.conversation_id}`, marginX, y); y += 5;
      doc.text(`Participanți: ${conversationsUser.first_name} ${conversationsUser.last_name} (${conversationsUser.user_id}) și ${conv.other_name} (${conv.other_user_id})`, marginX, y); y += 5;
      doc.text(`Exportat la: ${new Date(snapshot.exported_at).toLocaleString("ro-RO")}`, marginX, y); y += 5;
      doc.text(`Hash SHA-256 al conținutului exportat: ${hashHex}`, marginX, y); y += 8;
      doc.setDrawColor(200);
      doc.line(marginX, y, pageWidth - marginX, y); y += 8;

      const confirmations = (snapshot.parental_presence_confirmations || []) as { confirmed_by: string; confirmed_at: string }[];
      if (confirmations.length > 0) {
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text("Confirmări prezență părinte/tutore:", marginX, y); y += 6;
        doc.setFontSize(9);
        doc.setTextColor(80);
        for (const c of confirmations) {
          doc.text(`• ${new Date(c.confirmed_at).toLocaleString("ro-RO")} — confirmat de ${c.confirmed_by}`, marginX, y);
          y += 5;
        }
        y += 4;
        doc.setDrawColor(200);
        doc.line(marginX, y, pageWidth - marginX, y); y += 8;
      }

      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text("Mesaje:", marginX, y); y += 6;
      doc.setFontSize(9);

      const messages = (snapshot.messages || []) as { sender_id: string; content: string; created_at: string; deleted_at: string | null }[];
      for (const m of messages) {
        if (y > pageHeight - 20) { doc.addPage(); y = 18; }
        const senderLabel = m.sender_id === conversationsUser.user_id ? conversationsUser.first_name : conv.other_name;
        const timestamp = new Date(m.created_at).toLocaleString("ro-RO");
        const status = m.deleted_at ? " [ȘTERS]" : "";
        doc.setTextColor(0);
        doc.text(`${senderLabel} — ${timestamp}${status}`, marginX, y); y += 5;
        doc.setTextColor(60);
        const lines = doc.splitTextToSize(m.content || "(fără conținut)", pageWidth - marginX * 2);
        for (const line of lines) {
          if (y > pageHeight - 20) { doc.addPage(); y = 18; }
          doc.text(line, marginX, y); y += 5;
        }
        y += 3;
      }

      doc.save(`conversatie-${conv.conversation_id}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: "Conversație exportată.", description: "Hash-ul de integritate a fost înregistrat." });
    } catch (err: any) {
      toast({ title: "Eroare la export", description: err.message, variant: "destructive" });
    } finally {
      setExportingConversationId(null);
    }
  };

  const content = (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4 text-gray-900">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-gray-700" />
        <h2 className="text-xl font-heading font-bold">Toți Utilizatorii</h2>
      </div>
      <p className="text-sm text-gray-500 font-body">
        Caută orice cont după nume sau adresă de email pentru a-l avertiza, bloca sau închide definitiv.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută după nume sau email..."
          className="pl-9 bg-white border-gray-300 text-gray-900"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : users.length === 0 ? (
        <p className="text-center text-gray-500 py-12 font-body">Niciun utilizator găsit.</p>
      ) : (
        <>
          {users.map((u) => (
            <div key={u.user_id} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-heading font-semibold">
                    {u.first_name} {u.last_name}
                    <span className="ml-2 text-xs font-normal text-gray-400">{ROLE_LABEL[u.role]}</span>
                  </p>
                  <p className="text-xs text-gray-500 font-body mt-0.5">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {u.rejected_posts_count > 0 && (
                    <Badge variant="outline" className="text-red-600 border-red-500">
                      {u.rejected_posts_count} respinse
                    </Badge>
                  )}
                  {u.approved_reports_count > 0 && (
                    <Badge variant="outline" className="text-red-700 border-red-600">
                      {u.approved_reports_count} rapoarte aprobate
                    </Badge>
                  )}
                  {u.warning_count > 0 && (
                    <Badge variant="outline" className="text-orange-600 border-orange-500">
                      {u.warning_count} {u.warning_count === 1 ? "avertisment" : "avertismente"}
                    </Badge>
                  )}
                  {isClosed(u) && <Badge variant="outline" className="text-gray-600 border-gray-400">Închis definitiv</Badge>}
                  {isBanned(u) && !isClosed(u) && <Badge variant="outline" className="text-gray-600 border-gray-400">Blocat</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm" variant="outline" className="gap-2"
                  disabled={processing === u.user_id}
                  onClick={() => handleIssueWarning(u)}
                >
                  {processing === u.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                  Avertizează
                </Button>
                {!isClosed(u) && (
                  isBanned(u) ? (
                    <Button
                      size="sm" variant="outline" className="gap-2"
                      disabled={processing === u.user_id}
                      onClick={() => handleBanToggle(u)}
                    >
                      {processing === u.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Deblochează
                    </Button>
                  ) : (
                    <Button
                      size="sm" variant="destructive" className="gap-2"
                      disabled={processing === u.user_id}
                      onClick={() => handleBanToggle(u)}
                    >
                      {processing === u.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                      Blochează
                    </Button>
                  )
                )}
                {!isClosed(u) && (
                  <Button
                    size="sm" variant="destructive" className="gap-2 bg-red-900 hover:bg-red-950"
                    disabled={processing === u.user_id}
                    onClick={() => { setClosingUser(u); setCloseReason(""); }}
                  >
                    <Ban className="h-4 w-4" />
                    Închide definitiv
                  </Button>
                )}
                <Button
                  size="sm" variant="outline" className="gap-2"
                  onClick={() => handleOpenConversations(u)}
                >
                  <MessageSquare className="h-4 w-4" />
                  Conversații
                </Button>
              </div>
            </div>
          ))}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-orange-500" /></div>
          )}
        </>
      )}

      <Dialog open={!!closingUser} onOpenChange={(open) => { if (!open) { setClosingUser(null); setCloseReason(""); } }}>
        <DialogContent className="bg-white border-gray-200 text-gray-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Ban className="h-5 w-5" /> Închide contul definitiv
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 font-body">
            Această acțiune este <strong>ireversibilă</strong>. Contul lui <strong>{closingUser?.first_name} {closingUser?.last_name}</strong> ({closingUser?.email})
            va fi blocat definitiv, iar adresa de email nu va mai putea fi folosită niciodată pentru un cont nou pe SportRise.
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
            <Button variant="outline" onClick={() => { setClosingUser(null); setCloseReason(""); }}>
              Anulează
            </Button>
            <Button
              variant="destructive"
              className="bg-red-900 hover:bg-red-950 gap-2"
              disabled={processing === closingUser?.user_id}
              onClick={handleClosePermanently}
            >
              {processing === closingUser?.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Confirm închiderea definitivă
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!conversationsUser} onOpenChange={(open) => { if (!open) { setConversationsUser(null); setConversationsList([]); } }}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Conversații — {conversationsUser?.first_name} {conversationsUser?.last_name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500 font-body -mt-2">
            Exportul generează un PDF cu toate mesajele și confirmările de prezență părinte/tutore, plus un hash SHA-256
            al conținutului, înregistrat separat pentru a putea dovedi ulterior integritatea datelor exportate.
          </p>
          {loadingConversations ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
          ) : conversationsList.length === 0 ? (
            <p className="text-center text-gray-500 py-8 font-body text-sm">Nicio conversație găsită.</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {conversationsList.map((c) => (
                <div key={c.conversation_id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
                  <div className="min-w-0">
                    <p className="font-body font-medium text-sm truncate">{c.other_name}</p>
                    <p className="text-xs text-gray-500 font-body">
                      {c.message_count} {c.message_count === 1 ? "mesaj" : "mesaje"}
                      {c.last_message_at && ` · ultimul: ${new Date(c.last_message_at).toLocaleDateString("ro-RO")}`}
                    </p>
                  </div>
                  <Button
                    size="sm" variant="outline" className="gap-2 shrink-0"
                    disabled={exportingConversationId === c.conversation_id}
                    onClick={() => handleExportConversation(c)}
                  >
                    {exportingConversationId === c.conversation_id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Download className="h-4 w-4" />}
                    Exportă
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-400 font-body flex items-center gap-1.5">
            <FileCheck className="h-3.5 w-3.5 shrink-0" /> Fiecare export este înregistrat definitiv (conversation_export_log) și nu poate fi modificat sau șters.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (embedded) return content;
  return content;
}
