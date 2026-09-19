import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, FlaskConical, CheckCircle, ShieldAlert, HelpCircle } from "lucide-react";
import { moderateUploadedVideo, type ModerationOutcome } from "@/lib/videoModeration";

// DEV-ONLY panel to exercise the full moderation pipeline
// (analyze-video-frames → recheck-video-content → admin_review) without
// hand-building a JWT, base64 frames, or a Postman request. It never
// appears in a production build — gated on Vite's import.meta.env.DEV,
// which is statically false in `vite build` output — and it never sends
// real user content: it synthesizes a tiny throwaway clip client-side for
// every run, uploads it under the current admin's own folder in
// player-videos, and creates a normal video_submissions row for it.
//
// Scores are never chosen here — this panel only names a scenario
// (SAFE / UNCERTAIN_VIOLENCE / UNCERTAIN_SEXUAL / HIGH); analyze-video-frames
// decides the actual CategoryScores server-side, and only when
// MODERATION_TEST_MODE=true on the server AND content_type is
// "test_video" — this panel can never mock a real post, and passing a
// scenario here does nothing at all unless the server secret is set.
// No API key, service-account key, or access token is ever visible here.

type Scenario = "SAFE" | "UNCERTAIN_VIOLENCE" | "UNCERTAIN_SEXUAL" | "HIGH";

const SCENARIOS: { id: Scenario; label: string; expect: string; description: string }[] = [
  {
    id: "SAFE",
    label: "SAFE",
    expect: "approved",
    description: "Toate categoriile primesc scoruri mici. Nu se apelează Google — trebuie să vezi decision: approved direct din prima trecere.",
  },
  {
    id: "UNCERTAIN_VIOLENCE",
    label: "UNCERTAIN — Violence",
    expect: "recheck → Google Vision SafeSearch (real)",
    description: "Doar categoria violence intră în banda incertă. Recheck-ul apelează Google Cloud Vision SafeSearch REAL pe cadrele video-ului de test.",
  },
  {
    id: "UNCERTAIN_SEXUAL",
    label: "UNCERTAIN — Sexual",
    expect: "recheck → Google Video Intelligence (real)",
    description: "Doar categoria sexual intră în banda incertă. Recheck-ul apelează Google Cloud Video Intelligence (Explicit Content Detection) REAL, autentificat prin OAuth Service Account.",
  },
  {
    id: "HIGH",
    label: "HIGH",
    expect: "admin_review (fără recheck)",
    description: "O categorie depășește pragul high_min. Conținutul merge direct la admin_review, fără să se mai cheltuiască vreun apel de reverificare.",
  },
];

// Builds a tiny (~1s) synthetic video entirely in the browser via
// MediaRecorder + a canvas stream — no fixture file needed, nothing to ship.
async function createSyntheticTestClip(): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext("2d")!;
  const stream = canvas.captureStream(10);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  recorder.start();

  let hue = 0;
  const interval = setInterval(() => {
    ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hue = (hue + 30) % 360;
  }, 100);

  await new Promise((resolve) => setTimeout(resolve, 1200));
  clearInterval(interval);
  recorder.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());

  const blob = new Blob(chunks, { type: "video/webm" });
  return new File([blob], "moderation-test-clip.webm", { type: "video/webm" });
}

export default function AdminModerationTestPanel() {
  const { toast } = useToast();
  const [running, setRunning] = useState<Scenario | null>(null);
  const [results, setResults] = useState<Record<Scenario, ModerationOutcome | null | "error">>({
    SAFE: null, UNCERTAIN_VIOLENCE: null, UNCERTAIN_SEXUAL: null, HIGH: null,
  });

  const runScenario = async (scenario: Scenario) => {
    setRunning(scenario);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const file = await createSyntheticTestClip();
      const path = `${user.id}/moderation-test-${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage.from("player-videos").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("player-videos").getPublicUrl(path);

      // video_submissions' real INSERT policy requires the 'player' role,
      // which an admin account doesn't have — and that policy must stay as
      // it is for real player submissions. This goes through a dedicated
      // Edge Function instead, which re-checks admin + MODERATION_TEST_MODE
      // server-side before using the service role to insert (see that
      // function's header comment for the full reasoning).
      const { data: submissionRes, error: submissionError } = await supabase.functions.invoke(
        "create-moderation-test-submission",
        { body: { video_url: urlData.publicUrl, test_scenario: scenario } }
      );
      if (submissionError) throw submissionError;
      const submission = submissionRes.submission;

      const outcome = await moderateUploadedVideo({
        file,
        bucket: "player-videos",
        storagePath: path,
        contentType: "test_video",
        contentId: (submission as any).id,
        testScenario: scenario,
      });

      setResults((prev) => ({ ...prev, [scenario]: outcome ?? "error" }));
      if (!outcome) {
        toast({ title: "Pipeline-ul de moderare nu a returnat un rezultat.", variant: "destructive" });
      }
    } catch (err: any) {
      console.error(`Moderation test scenario ${scenario} failed:`, err);
      setResults((prev) => ({ ...prev, [scenario]: "error" }));
      toast({ title: "Eroare la rularea scenariului", description: err.message, variant: "destructive" });
    } finally {
      setRunning(null);
    }
  };

  const decisionBadge = (outcome: ModerationOutcome | null | "error") => {
    if (outcome === null) return null;
    if (outcome === "error") return <span className="text-xs text-red-600 font-semibold">Eroare</span>;
    const color = outcome.decision === "approved" ? "text-green-600" : outcome.decision === "admin_review" ? "text-red-600" : "text-yellow-600";
    return <span className={`text-xs font-semibold ${color}`}>decision: {outcome.decision}</span>;
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4 text-gray-900">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-purple-600" />
        <h2 className="text-xl font-heading font-bold">Test moderare video (dev only)</h2>
      </div>
      <p className="text-sm text-gray-500 font-body">
        Vizibil doar în modul de dezvoltare. Fiecare scenariu creează un clip de test sintetic (nu conținut real de utilizator),
        îl urcă în storage și rulează pipeline-ul complet de moderare. Scorurile sunt decise exclusiv server-side —
        acest panou doar numește scenariul dorit. Funcționează efectiv numai dacă secretul <code className="bg-gray-100 px-1 rounded">MODERATION_TEST_MODE=true</code> este setat pe server.
      </p>

      <div className="space-y-3">
        {SCENARIOS.map((s) => {
          const result = results[s.id];
          return (
            <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-heading font-semibold">{s.label}</p>
                  <p className="text-xs text-gray-500 font-body mt-0.5">Așteptat: {s.expect}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={running !== null}
                  onClick={() => runScenario(s.id)}
                  className="gap-2"
                >
                  {running === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                  Rulează
                </Button>
              </div>
              <p className="text-xs text-gray-600 font-body">{s.description}</p>
              {result && result !== "error" && (
                <div className="rounded-lg bg-gray-100 px-3 py-2 space-y-1">
                  <div className="flex items-center gap-2">
                    {result.decision === "approved" && <CheckCircle className="h-3.5 w-3.5 text-green-600" />}
                    {result.decision === "admin_review" && <ShieldAlert className="h-3.5 w-3.5 text-red-600" />}
                    {result.decision === "recheck" && <HelpCircle className="h-3.5 w-3.5 text-yellow-600" />}
                    {decisionBadge(result)}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.scores).map(([cat, score]) => (
                      <span key={cat} className="text-[11px] bg-white rounded-full px-2 py-0.5 border border-gray-200">
                        {cat}: {(Number(score) * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {result === "error" && decisionBadge(result)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
