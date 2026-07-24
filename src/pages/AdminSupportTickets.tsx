import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface SupportTicket {
  id: string;
  user_id: string;
  category: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter_name?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: "O funcție nu merge",
  account: "Probleme cu contul",
  report_user: "Raportare utilizator",
  payment: "Plăți și abonamente",
  other: "Altceva",
};

export default function AdminSupportTickets() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Eroare la încărcare", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const userIds = (data || []).map((t: any) => t.user_id);
    const [playerRes, scoutRes] = await Promise.all([
      supabase.from("player_profiles").select("user_id, first_name, last_name").in("user_id", userIds),
      supabase.from("scout_profiles").select("user_id, first_name, last_name").in("user_id", userIds),
    ]);
    const nameByUserId = new Map<string, string>();
    (playerRes.data || []).forEach((p: any) => nameByUserId.set(p.user_id, `${p.first_name} ${p.last_name}`.trim()));
    (scoutRes.data || []).forEach((s: any) => { if (!nameByUserId.has(s.user_id)) nameByUserId.set(s.user_id, `${s.first_name} ${s.last_name}`.trim()); });

    setTickets((data || []).map((t: any) => ({ ...t, reporter_name: nameByUserId.get(t.user_id) || "Utilizator" })));
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleUpdate = async (ticket: SupportTicket, status: "in_progress" | "resolved") => {
    setProcessing(ticket.id);
    const note = notes[ticket.id] ?? ticket.admin_notes ?? "";
    const { error } = await (supabase as any)
      .from("support_tickets")
      .update({
        status,
        admin_notes: note || null,
        resolved_at: status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", ticket.id);

    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    } else {
      toast({ title: status === "resolved" ? "Ticket rezolvat" : "Marcat în lucru" });
      await fetchTickets();
    }
    setProcessing(null);
  };

  const statusBadge = (status: string) => {
    if (status === "open") return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Deschis</Badge>;
    if (status === "in_progress") return <Badge variant="outline" className="text-blue-500 border-blue-500">În lucru</Badge>;
    return <Badge variant="outline" className="text-green-500 border-green-500">Rezolvat</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-muted-foreground font-body">
        Nu există rapoarte trimise de utilizatori.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h2 className="text-xl font-heading font-bold">Rapoarte utilizatori</h2>
      <p className="text-sm text-muted-foreground font-body">
        {tickets.filter(t => t.status !== "resolved").length} rapoarte nerezolvate
      </p>

      {tickets.map((ticket) => (
        <div key={ticket.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-heading font-semibold">{ticket.reporter_name}</p>
              <p className="text-xs text-muted-foreground font-body mt-0.5">
                {CATEGORY_LABELS[ticket.category] || ticket.category} ·{" "}
                {new Date(ticket.created_at).toLocaleDateString("ro-RO", {
                  day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
            {statusBadge(ticket.status)}
          </div>

          <p className="text-sm text-foreground font-body bg-muted/40 rounded-lg px-3 py-2 whitespace-pre-wrap">
            {ticket.message}
          </p>

          {ticket.status !== "resolved" && (
            <div className="space-y-3">
              <Textarea
                placeholder="Notă internă (opțional)..."
                value={notes[ticket.id] ?? ticket.admin_notes ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                className="font-body text-sm resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                {ticket.status === "open" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={processing === ticket.id}
                    onClick={() => handleUpdate(ticket, "in_progress")}
                  >
                    {processing === ticket.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                    Marchează în lucru
                  </Button>
                )}
                <Button
                  size="sm"
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  disabled={processing === ticket.id}
                  onClick={() => handleUpdate(ticket, "resolved")}
                >
                  {processing === ticket.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Marchează rezolvat
                </Button>
              </div>
            </div>
          )}

          {ticket.status === "resolved" && ticket.admin_notes && (
            <p className="text-sm text-muted-foreground font-body">
              Notă: {ticket.admin_notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
