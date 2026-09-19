import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ShieldAlert, Ban, ShieldOff, ShieldCheck, XCircle } from "lucide-react";

// Admin view of players with a track record of rejected posts — a list to
// act on with judgment (warn, ban, or permanently close), not an automatic
// enforcement mechanism. Per explicit product decision, warning someone
// here does NOT automatically ban them on their next rejection; it only
// highlights them here so an admin recognizes a repeat case faster.
const MIN_REJECTED_TO_LIST = 3;

interface AtRiskUser {
  user_id: string;
  first_name: string;
  last_name: string;
  rejected_posts_count: number;
  warned_at: string | null;
  email: string;
  banned_until: string | null;
}

export default function AdminUsersAtRisk({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const [users, setUsers] = useState<AtRiskUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [closingUser, setClosingUser] = useState<AtRiskUser | null>(null);
  const [closeReason, setCloseReason] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_users_at_risk", { p_min_rejected: MIN_REJECTED_TO_LIST });
    if (error) {
      console.error("Failed to load at-risk users:", error);
      toast({ title: "Eroare la încărcare", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setUsers(data || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const isBanned = (u: AtRiskUser) => !!u.banned_until && new Date(u.banned_until) > new Date();

  const handleToggleWarning = async (u: AtRiskUser) => {
    setProcessing(u.user_id);
    const { error } = await (supabase as any).rpc("set_user_warned", { p_user_id: u.user_id, p_warned: !u.warned_at });
    setProcessing(null);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: u.warned_at ? "Avertisment eliminat." : "Utilizator avertizat." });
    await fetchUsers();
  };

  const handleBanToggle = async (u: AtRiskUser) => {
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
    await fetchUsers();
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
    setClosingUser(null);
    setCloseReason("");
    await fetchUsers();
  };

  const content = (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4 text-gray-900">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-red-600" />
        <h2 className="text-xl font-heading font-bold">Useri cu potențial de blocare</h2>
      </div>
      <p className="text-sm text-gray-500 font-body">
        Jucători cu {MIN_REJECTED_TO_LIST}+ postări respinse. Avertizarea este doar informativă — nu blochează automat contul la o nouă respingere.
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : users.length === 0 ? (
        <p className="text-center text-gray-500 py-12 font-body">Niciun utilizator nu depășește pragul momentan.</p>
      ) : (
        users.map((u) => (
          <div key={u.user_id} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-heading font-semibold">
                  {u.first_name} {u.last_name}
                  {u.warned_at && <span className="ml-2 text-xs font-normal text-orange-600">(avertizat)</span>}
                </p>
                <p className="text-xs text-gray-500 font-body mt-0.5">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-red-600 border-red-500">
                  {u.rejected_posts_count} postări respinse
                </Badge>
                {isBanned(u) && <Badge variant="outline" className="text-gray-600 border-gray-400">Blocat</Badge>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm" variant="outline" className="gap-2"
                disabled={processing === u.user_id}
                onClick={() => handleToggleWarning(u)}
              >
                {processing === u.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                {u.warned_at ? "Elimină avertisment" : "Avertizează"}
              </Button>
              {isBanned(u) ? (
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
              )}
              <Button
                size="sm" variant="destructive" className="gap-2 bg-red-900 hover:bg-red-950"
                disabled={processing === u.user_id}
                onClick={() => { setClosingUser(u); setCloseReason(""); }}
              >
                <Ban className="h-4 w-4" />
                Închide definitiv
              </Button>
            </div>
          </div>
        ))
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
