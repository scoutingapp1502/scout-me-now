import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ShieldAlert, Ban, ShieldOff, ShieldCheck, XCircle, Search, Users } from "lucide-react";

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
    </div>
  );

  if (embedded) return content;
  return content;
}
