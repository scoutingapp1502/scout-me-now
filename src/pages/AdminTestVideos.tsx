import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTestReferenceVideos } from "@/hooks/useTestReferenceVideos";
import { athleticTests, getTechnicalTestsBySport, getTestRefKey, TechnicalTest } from "@/components/dashboard/PersonalProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Trash2, Plus, Loader2, Film } from "lucide-react";

const SPORTS: { key: string; label: string }[] = [
  { key: "football", label: "Fotbal" },
  { key: "basketball", label: "Baschet" },
];

export default function AdminTestVideos({ embedded }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { videos, loading, saveVideo, removeVideo } = useTestReferenceVideos();
  const [sport, setSport] = useState<string>("football");
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const handleSaveUrl = async (testKey: string) => {
    const url = urlInputs[testKey]?.trim();
    if (!url) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await saveVideo(testKey, url, user.id);
    if (error) {
      toast({ title: "Eroare la salvare", variant: "destructive" });
    } else {
      toast({ title: "Video exemplu salvat!" });
      setUrlInputs((prev) => ({ ...prev, [testKey]: "" }));
    }
  };

  const handleFileUpload = async (testKey: string, storagePath: string, file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUploadingKey(testKey);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/test-examples/${storagePath}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("player-videos").upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Eroare", description: "Nu s-a putut încărca videoul.", variant: "destructive" });
      setUploadingKey(null);
      return;
    }
    const { data: urlData } = supabase.storage.from("player-videos").getPublicUrl(path);
    const { error } = await saveVideo(testKey, urlData.publicUrl, user.id);
    setUploadingKey(null);
    if (error) {
      toast({ title: "Eroare la salvare", variant: "destructive" });
    } else {
      toast({ title: "Video exemplu încărcat!" });
    }
  };

  const handleRemove = async (testKey: string) => {
    const { error } = await removeVideo(testKey);
    if (error) {
      toast({ title: "Eroare la ștergere", variant: "destructive" });
    } else {
      toast({ title: "Video exemplu șters." });
    }
  };

  const renderTestRow = (test: TechnicalTest) => {
    const refKey = getTestRefKey(test);
    const videoUrl = videos[refKey];
    return (
      <div key={refKey} className="border border-border rounded-lg p-4 bg-card space-y-3">
        <div>
          <p className="font-semibold text-sm">{test.icon} {test.label}</p>
          <p className="text-xs text-muted-foreground whitespace-pre-line mt-1">{test.description}</p>
        </div>

        {videoUrl && (
          <div className="relative">
            <video src={videoUrl} controls className="w-full max-h-56 rounded-md bg-black" />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={() => handleRemove(refKey)}
              title="Șterge video exemplu"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Link YouTube sau video URL"
            value={urlInputs[refKey] || ""}
            onChange={(e) => setUrlInputs((prev) => ({ ...prev, [refKey]: e.target.value }))}
            className="flex-1 min-w-0"
          />
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => handleSaveUrl(refKey)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div>
          <div
            className="border-2 border-dashed border-border rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => document.getElementById(`admin-test-video-${refKey}`)?.click()}
          >
            {uploadingKey === refKey ? (
              <Loader2 className="h-5 w-5 text-muted-foreground mx-auto animate-spin" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground mx-auto" />
            )}
            <span className="text-xs text-muted-foreground font-body block mt-1">Sau încarcă video (MP4, WebM, MOV)</span>
          </div>
          <input
            id={`admin-test-video-${refKey}`}
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(refKey, test.storagePath, file);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    );
  };

  const technicalTests = getTechnicalTestsBySport(sport);

  return (
    <div className={embedded ? "text-foreground" : "min-h-screen bg-background text-foreground"}>
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {!embedded && (
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-heading font-bold">🎬 Video-uri Exemplu Teste</h1>
          </div>
        )}
        {embedded && (
          <h1 className="text-2xl font-heading font-bold mb-2 flex items-center gap-2">
            <Film className="h-6 w-6" /> Video-uri Exemplu Teste
          </h1>
        )}
        <p className="text-sm text-muted-foreground mb-6">
          Videoclipurile încărcate aici vor apărea în secțiunea de informații a fiecărui test, pe profilele jucătorilor.
        </p>

        {/* Sport selector */}
        <div className="flex gap-2 mb-6">
          {SPORTS.map((s) => (
            <Button
              key={s.key}
              variant={sport === s.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSport(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Teste Atletice (comune tuturor sporturilor)
              </h2>
              <div className="space-y-4">
                {athleticTests.map(renderTestRow)}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Teste Specifice — {SPORTS.find((s) => s.key === sport)?.label}
              </h2>
              <div className="space-y-4">
                {technicalTests.map(renderTestRow)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
