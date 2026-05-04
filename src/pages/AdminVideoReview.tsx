import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminVideoSubmissions } from "@/hooks/useVideoSubmissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, XCircle, Clock, Video, Star } from "lucide-react";

const testLabelMap: Record<string, string> = {
  control_pass_video: "Control și Pasă",
  slalom_video: "Slalom printre Jaloane",
  precision_video: "Precizie",
  coordination_video: "Coordonare",
  long_pass_video: "Pasă Lungă la Punct Fix",
  star_shooting_drill_video: "Star Shooting Drill",
  crossover_video: "Crossover",
  between_the_legs_video: "Between the Legs",
  double_cross_video: "Double Cross",
  between_legs_cross_video: "Between the Legs Cross",
  free_throw_shooting_video: "Free Throw Shooting",
};

export default function AdminVideoReview() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { submissions, loading, reviewVideo, rejectVideo } = useAdminVideoSubmissions();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [grade, setGrade] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "rejected">("pending");

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(user.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAdmin = roles?.some((r: any) => r.role === "admin");
      if (!hasAdmin) {
        navigate("/dashboard");
        toast({ title: "Acces interzis", description: "Nu ai permisiuni de administrator.", variant: "destructive" });
        return;
      }
      setIsAdmin(true);
      setCheckingAuth(false);
    };
    checkAdmin();
  }, [navigate, toast]);

  if (checkingAuth || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Se verifică permisiunile...</p>
      </div>
    );
  }

  const filtered = submissions.filter((s) => filter === "all" || s.status === filter);

  const handleReview = async (submissionId: string) => {
    const gradeNum = parseFloat(grade);
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 10) {
      toast({ title: "Nota trebuie să fie între 1 și 10", variant: "destructive" });
      return;
    }
    const { error } = await reviewVideo(submissionId, gradeNum, notes, currentUserId!);
    if (error) {
      toast({ title: "Eroare la verificare", variant: "destructive" });
    } else {
      toast({ title: "Video verificat cu succes!" });
      setReviewingId(null);
      setGrade("");
      setNotes("");
    }
  };

  const handleReject = async (submissionId: string) => {
    const { error } = await rejectVideo(submissionId, notes, currentUserId!);
    if (error) {
      toast({ title: "Eroare la respingere", variant: "destructive" });
    } else {
      toast({ title: "Video respins." });
      setReviewingId(null);
      setNotes("");
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock className="h-3 w-3" /> În așteptare</span>;
      case "verified":
        return <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle className="h-3 w-3" /> Verificat</span>;
      case "rejected":
        return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="h-3 w-3" /> Respins</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-heading font-bold">🎥 Verificare Videouri</h1>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(["pending", "verified", "rejected", "all"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "pending" ? "În așteptare" : f === "verified" ? "Verificate" : f === "rejected" ? "Respinse" : "Toate"}
              {f === "pending" && ` (${submissions.filter((s) => s.status === "pending").length})`}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Se încarcă...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Niciun video de afișat.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((sub) => (
              <div key={sub.id} className="border border-border rounded-lg p-4 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{sub.player_name}</span>
                      {statusBadge(sub.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {testLabelMap[sub.test_key] || sub.test_key} • {new Date(sub.created_at).toLocaleDateString("ro-RO")}
                    </p>
                    {sub.grade !== null && (
                      <p className="text-sm mt-1 flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400" />
                        Nota: <strong>{sub.grade}</strong>
                      </p>
                    )}
                    {sub.reviewer_notes && (
                      <p className="text-xs text-muted-foreground mt-1">Note: {sub.reviewer_notes}</p>
                    )}
                  </div>
                  <a
                    href={sub.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-xs underline whitespace-nowrap"
                  >
                    Vezi video →
                  </a>
                </div>

                {/* Video preview */}
                {sub.video_url && !sub.video_url.includes("youtube") && !sub.video_url.includes("youtu.be") && (
                  <video
                    src={sub.video_url}
                    controls
                    className="w-full max-h-64 rounded-md mt-3 bg-black"
                  />
                )}
                {sub.video_url && (sub.video_url.includes("youtube") || sub.video_url.includes("youtu.be")) && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    <a href={sub.video_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Deschide pe YouTube →
                    </a>
                  </div>
                )}

                {/* Review actions for pending */}
                {sub.status === "pending" && (
                  <>
                    {reviewingId === sub.id ? (
                      <div className="mt-4 space-y-3 border-t border-border pt-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Nota (1-10)</label>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            step="0.1"
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            placeholder="ex: 8.5"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Note / Observații</label>
                          <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Observații opționale..."
                            className="mt-1"
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleReview(sub.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Verifică & Acordă Notă
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(sub.id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Respinge
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setReviewingId(null); setGrade(""); setNotes(""); }}
                          >
                            Anulează
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => setReviewingId(sub.id)}
                      >
                        Verifică acest video
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
