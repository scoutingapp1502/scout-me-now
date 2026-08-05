import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface VerificationRequest {
  id: string;
  user_id: string;
  document_url: string;
  status: "pending" | "approved" | "rejected";
  reviewer_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  full_name?: string;
  email?: string;
}

export default function AdminScoutVerification() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scout_verification_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Eroare la încărcare", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Enrich with profile data (batched instead of one query per request)
    const userIds = (data || []).map((req: any) => req.user_id);
    const { data: profiles } = await supabase
      .from("scout_profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", userIds);

    const profileByUserId = new Map(
      (profiles || []).map((p) => [p.user_id, p])
    );

    const enriched = (data || []).map((req: any) => {
      const profile = profileByUserId.get(req.user_id);
      return {
        ...req,
        full_name: profile
          ? `${profile.first_name} ${profile.last_name}`.trim()
          : "Necunoscut",
      } as VerificationRequest;
    });

    setRequests(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const getSignedUrl = async (documentUrl: string) => {
    // Extract path from URL: .../object/scout-documents/userId/file.ext
    const marker = "/object/scout-documents/";
    const idx = documentUrl.indexOf(marker);
    if (idx === -1) {
      window.open(documentUrl, "_blank");
      return;
    }
    const path = documentUrl.slice(idx + marker.length);
    const { data } = await supabase.storage
      .from("scout-documents")
      .createSignedUrl(path, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast({ title: "Nu s-a putut genera link-ul", variant: "destructive" });
    }
  };

  const handleDecision = async (req: VerificationRequest, decision: "approved" | "rejected") => {
    setProcessing(req.id);
    const note = notes[req.id] ?? "";

    const { error } = await supabase
      .from("scout_verification_requests")
      .update({
        status: decision,
        reviewer_notes: note || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", req.id);

    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
    } else {
      // Send email notification to scout
      await supabase.functions.invoke("notify-scout-verification", {
        body: { userId: req.user_id, decision, reviewerNotes: notes[req.id] ?? null },
      });
      toast({
        title: decision === "approved" ? "Cont aprobat" : "Cont respins",
        description: `Contul lui ${req.full_name} a fost ${decision === "approved" ? "aprobat" : "respins"}.`,
      });
      await fetchRequests();
    }
    setProcessing(null);
  };

  const statusBadge = (status: string) => {
    if (status === "pending") return <Badge variant="outline" className="text-yellow-500 border-yellow-500">În așteptare</Badge>;
    if (status === "approved") return <Badge variant="outline" className="text-green-500 border-green-500">Aprobat</Badge>;
    return <Badge variant="outline" className="text-destructive border-destructive">Respins</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-muted-foreground font-body">
        Nu există solicitări de verificare a documentelor.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h2 className="text-xl font-heading font-bold">Verificare Documente Înregistrate</h2>
      <p className="text-sm text-muted-foreground font-body">
        {requests.filter(r => r.status === "pending").length} solicitări în așteptare
      </p>

      {requests.map((req) => (
        <div key={req.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-heading font-semibold">{req.full_name}</p>
              <p className="text-xs text-muted-foreground font-body mt-0.5">
                {new Date(req.created_at).toLocaleDateString("ro-RO", {
                  day: "numeric", month: "long", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
            {statusBadge(req.status)}
          </div>

          <button
            onClick={() => getSignedUrl(req.document_url)}
            className="flex items-center gap-2 text-sm text-primary hover:underline font-body"
          >
            <FileText className="h-4 w-4" />
            Vizualizează document
            <ExternalLink className="h-3 w-3" />
          </button>

          {req.reviewer_notes && req.status !== "pending" && (
            <p className="text-sm text-muted-foreground font-body bg-muted/40 rounded-lg px-3 py-2">
              Notă: {req.reviewer_notes}
            </p>
          )}

          {req.status === "pending" && (
            <div className="space-y-3">
              <Textarea
                placeholder="Notă opțională (vizibilă după decizie)..."
                value={notes[req.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                className="font-body text-sm resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  disabled={processing === req.id}
                  onClick={() => handleDecision(req, "approved")}
                >
                  {processing === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Aprobă
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-2"
                  disabled={processing === req.id}
                  onClick={() => handleDecision(req, "rejected")}
                >
                  {processing === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Respinge
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
