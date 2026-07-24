import { useState } from "react";
import { LifeBuoy, ArrowLeft, ChevronRight, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface HelpSectionProps {
  userId: string;
  onBack: () => void;
}

type Category = "bug" | "account" | "report_user" | "payment" | "other";

const CATEGORIES: { value: Category; labelRo: string; labelEn: string }[] = [
  { value: "bug",         labelRo: "O funcție nu merge",         labelEn: "Something isn't working" },
  { value: "account",     labelRo: "Probleme cu contul",         labelEn: "Account issue" },
  { value: "report_user", labelRo: "Raportează un utilizator",   labelEn: "Report a user" },
  { value: "payment",     labelRo: "Plăți și abonamente",        labelEn: "Payments and subscriptions" },
  { value: "other",       labelRo: "Altceva",                    labelEn: "Something else" },
];

// ── Contact form sub-page ────────────────────────────────────────────────────
function ReportProblemPage({ userId, lang, onBack }: { userId: string; lang: string; onBack: () => void }) {
  const { toast } = useToast();
  const [category, setCategory] = useState<Category>("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({ title: lang === "ro" ? "Scrie un mesaj înainte de a trimite." : "Write a message before submitting.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any).from("support_tickets").insert({
      user_id: userId,
      category,
      message: message.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: lang === "ro" ? "Nu s-a putut trimite raportul." : "Could not send your report.", variant: "destructive" });
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
          <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></button>
          <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
            {lang === "ro" ? "Raportează o problemă" : "Report a problem"}
          </h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-primary" />
          <p className="text-sm font-semibold font-body text-foreground">
            {lang === "ro" ? "Raportul a fost trimis." : "Your report was sent."}
          </p>
          <p className="text-xs text-muted-foreground font-body">
            {lang === "ro" ? "Îl vom analiza cât mai curând posibil." : "We'll review it as soon as possible."}
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={onBack}>
            {lang === "ro" ? "Înapoi" : "Back"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Raportează o problemă" : "Report a problem"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div>
          <p className="text-sm font-semibold font-body text-foreground mb-2">
            {lang === "ro" ? "Ce categorie descrie cel mai bine problema?" : "Which category best describes the issue?"}
          </p>
          <div className="space-y-2">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
                  category === c.value ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/30"
                }`}
              >
                <span className="text-sm font-body text-foreground">{lang === "ro" ? c.labelRo : c.labelEn}</span>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${category === c.value ? "border-primary" : "border-muted-foreground/40"}`}>
                  {category === c.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold font-body text-foreground mb-2">
            {lang === "ro" ? "Descrie problema" : "Describe the issue"}
          </p>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={lang === "ro" ? "Spune-ne ce s-a întâmplat..." : "Tell us what happened..."}
            className="min-h-32 text-white"
          />
        </div>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
          <Send className="h-4 w-4" />
          {submitting ? (lang === "ro" ? "Se trimite..." : "Sending...") : (lang === "ro" ? "Trimite raportul" : "Send report")}
        </Button>
      </div>
    </div>
  );
}

// ── Main Help section ────────────────────────────────────────────────────────
export default function HelpSection({ userId, onBack }: HelpSectionProps) {
  const { lang } = useLanguage();
  const [subPage, setSubPage] = useState<"report" | null>(null);

  if (subPage === "report") {
    return <ReportProblemPage userId={userId} lang={lang} onBack={() => setSubPage(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Ajutor și asistență" : "Help and support"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Icon + title */}
        <div className="flex flex-col items-center px-8 py-8 text-center">
          <LifeBuoy className="h-20 w-20 text-primary mb-4" strokeWidth={1.2} />
          <p className="text-lg font-semibold font-heading text-foreground">
            {lang === "ro" ? "Ajutor și asistență" : "Help and support"}
          </p>
        </div>

        <div className="bg-card border-y border-border">
          <button
            onClick={() => setSubPage("report")}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
          >
            <span className="text-sm font-body text-foreground">
              {lang === "ro" ? "Raportează o problemă" : "Report a problem"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
