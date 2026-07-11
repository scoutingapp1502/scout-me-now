import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface RequestInfo {
  id: string;
  requester_name: string;
  relationship: string | null;
  club: string | null;
  season_from: string | null;
  season_to: string | null;
  message: string | null;
  status: string;
}

type PageState = "loading" | "form" | "completed" | "already_done" | "error";

export default function ExternalRecommend() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [pageState, setPageState] = useState<PageState>("loading");
  const [requestInfo, setRequestInfo] = useState<RequestInfo | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setPageState("error");
      return;
    }

    const fetchRequest = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-external-recommendation-request", {
          body: { token },
        });
        if (error || data?.error) {
          setPageState("error");
          return;
        }
        if (data.request.status === "completed") {
          setPageState("already_done");
          return;
        }
        setRequestInfo(data.request);
        setPageState("form");
      } catch {
        setPageState("error");
      }
    };

    fetchRequest();
  }, [token]);

  const handleSubmit = async () => {
    if (!authorName.trim() || !content.trim() || !token) return;
    setSubmitting(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-external-recommendation", {
        body: { token, authorName, content },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error === "already_completed") {
        setPageState("already_done");
        return;
      }
      if (data?.error) throw new Error(data.error);
      setPageState("completed");
    } catch (err: any) {
      setError(err.message || "A apărut o eroare. Încearcă din nou.");
    } finally {
      setSubmitting(false);
    }
  };

  const contextParts: string[] = [];
  if (requestInfo?.relationship) contextParts.push(requestInfo.relationship);
  if (requestInfo?.club) contextParts.push(requestInfo.club);
  if (requestInfo?.season_from && requestInfo?.season_to) {
    contextParts.push(
      requestInfo.season_from === requestInfo.season_to
        ? requestInfo.season_from
        : `${requestInfo.season_from}–${requestInfo.season_to}`
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <p className="text-primary font-bold text-sm tracking-widest uppercase mb-8 text-center">
          SportRise
        </p>

        {pageState === "loading" && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {pageState === "error" && (
          <div className="bg-card rounded-xl border border-border p-8 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold text-foreground">Link invalid sau expirat</h1>
            <p className="text-muted-foreground text-sm">
              Acest link nu este valid. Dacă ai primit un email, asigură-te că folosești link-ul complet.
            </p>
          </div>
        )}

        {pageState === "already_done" && (
          <div className="bg-card rounded-xl border border-border p-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <h1 className="text-xl font-semibold text-foreground">Recomandare deja trimisă</h1>
            <p className="text-muted-foreground text-sm">
              Ai trimis deja o recomandare pentru această solicitare. Mulțumim!
            </p>
          </div>
        )}

        {pageState === "completed" && (
          <div className="bg-card rounded-xl border border-border p-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <h1 className="text-xl font-semibold text-foreground">Recomandare trimisă!</h1>
            <p className="text-muted-foreground text-sm">
              Mulțumim! Recomandarea ta a fost trimisă cu succes și va apărea pe profilul lui{" "}
              <span className="font-medium text-foreground">{requestInfo?.requester_name}</span> după aprobare.
            </p>
          </div>
        )}

        {pageState === "form" && requestInfo && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-border">
              <h1 className="text-xl font-semibold text-foreground mb-1">
                {requestInfo.requester_name} te roagă să scrii o recomandare
              </h1>
              {contextParts.length > 0 && (
                <p className="text-sm text-muted-foreground">{contextParts.join(" · ")}</p>
              )}
            </div>

            {/* Message from requester */}
            {requestInfo.message && (
              <div className="px-6 py-4 bg-accent/20 border-b border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                  Mesaj personal
                </p>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                  {requestInfo.message}
                </p>
              </div>
            )}

            {/* Form */}
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Numele tău <span className="text-destructive">*</span>
                </label>
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="ex: Ion Popescu"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Recomandarea ta pentru {requestInfo.requester_name.split(" ")[0]}{" "}
                  <span className="text-destructive">*</span>
                </label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`Scrie recomandarea ta pentru ${requestInfo.requester_name}...`}
                  className="min-h-[140px] resize-none"
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Descrie calitățile, colaborarea sau orice considerați relevant.
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={submitting || !authorName.trim() || !content.trim()}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Se trimite...</>
                ) : (
                  "Trimite recomandarea"
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Recomandarea va fi vizibilă pe profilul lui {requestInfo.requester_name} după ce acesta o aprobă.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
