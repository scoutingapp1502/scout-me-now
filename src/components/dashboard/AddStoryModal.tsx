import { useState, useEffect, useRef } from "react";
import { X, Camera, ChevronDown, Images, Smile, Music, Sparkles, Loader2, User } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AddStoryModalProps {
  userId: string;
  open: boolean;
  onClose: () => void;
  onPosted?: () => void;
  userPhoto?: string | null;
}

interface RecentImage { id: string; url: string; }
type View = "gallery" | "editor" | "textMode";

const quickActions = [
  { id: "add_yours", emoji: "🔗", labelRo: "Adaugă al tău", labelEn: "Add yours" },
  { id: "music",     emoji: "🎵", labelRo: "Muzică",        labelEn: "Music"      },
  { id: "collage",   emoji: "🖼️", labelRo: "Colaj",         labelEn: "Collage"    },
];

const TEXT_STYLES = ["Modern", "Classic", "Signature", "Neon", "Typewriter"];

export default function AddStoryModal({ userId, open, onClose, onPosted, userPhoto }: AddStoryModalProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<View>("gallery");
  const [recentImages, setRecentImages] = useState<RecentImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [overlayText, setOverlayText] = useState("");
  const [draftText, setDraftText] = useState("");
  const [textStyle, setTextStyle] = useState(0);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!open) {
      setView("gallery"); setSelectedUrl(null); setSelectedFile(null);
      setCaption(""); setOverlayText(""); setDraftText("");
      return;
    }
    const fetch = async () => {
      setLoadingImages(true);
      const { data } = await supabase
        .from("posts").select("id, image_url")
        .eq("user_id", userId).not("image_url", "is", null)
        .order("created_at", { ascending: false }).limit(17);
      if (data) setRecentImages(data.filter((p: any) => !!p.image_url).map((p: any) => ({ id: p.id, url: p.image_url as string })));
      setLoadingImages(false);
    };
    fetch();
  }, [open, userId]);

  const selectImage = (url: string, file?: File) => {
    setSelectedUrl(url); setSelectedFile(file || null); setView("editor");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    selectImage(URL.createObjectURL(file), file);
  };

  const openTextMode = () => {
    setDraftText(overlayText);
    setView("textMode");
    setTimeout(() => textInputRef.current?.focus(), 100);
  };

  const confirmText = () => {
    setOverlayText(draftText);
    setView("editor");
  };

  const handlePost = async () => {
    if (!selectedUrl) return;
    setPosting(true);
    try {
      let mediaUrl = selectedUrl;
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop() || "jpg";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("stories").upload(path, selectedFile, { upsert: false });
        if (uploadError) {
          toast({ title: lang === "ro" ? "Nu s-a putut încărca imaginea." : "Failed to upload the image.", variant: "destructive" });
          setPosting(false);
          return;
        }
        const { data: urlData } = supabase.storage.from("stories").getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
      }
      const { error: insertError } = await (supabase as any)
        .from("stories")
        .insert({ user_id: userId, media_url: mediaUrl, caption: caption.trim(), overlay_text: overlayText.trim() });
      if (insertError) {
        toast({ title: lang === "ro" ? "Eroare la postare." : "Failed to post.", variant: "destructive" });
        return;
      }
      toast({ title: lang === "ro" ? "Story postat!" : "Story posted!" });
      onPosted?.(); onClose();
    } catch {
      toast({ title: lang === "ro" ? "Eroare la postare." : "Failed to post.", variant: "destructive" });
    } finally { setPosting(false); }
  };

  const coming = () => toast({ title: lang === "ro" ? "Funcționalitate în curând." : "Coming soon." });

  const isEditor = view === "editor" || view === "textMode";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-sm w-full p-0 bg-background border-border overflow-hidden h-[92vh] flex flex-col gap-0"
        hideClose={true}
      >

        {/* ───── GALLERY VIEW ───── */}
        {view === "gallery" && (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <button onClick={onClose} className="p-1 text-foreground hover:text-primary"><X className="h-5 w-5" /></button>
              <h2 className="font-heading text-base text-foreground">{lang === "ro" ? "Adaugă la story" : "Add to story"}</h2>
              <div className="w-7" />
            </div>
            <div className="flex gap-3 px-4 pt-3 pb-2 shrink-0">
              {quickActions.map((a) => (
                <button key={a.id} onClick={coming} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className="w-full aspect-square rounded-xl bg-muted/60 border border-border flex items-center justify-center text-2xl">{a.emoji}</div>
                  <span className="text-[10px] text-muted-foreground font-body">{lang === "ro" ? a.labelRo : a.labelEn}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between px-4 py-2 shrink-0">
              <button className="flex items-center gap-1 text-sm font-semibold text-foreground font-body">
                {lang === "ro" ? "Recente" : "Recents"}<ChevronDown className="h-4 w-4" />
              </button>
              <div className="flex gap-3">
                <button onClick={coming} className="text-xs text-muted-foreground font-body hover:text-foreground flex items-center gap-1">
                  <Images className="h-3.5 w-3.5" />{lang === "ro" ? "Selectează" : "Select"}
                </button>
                <button onClick={coming} className="text-xs text-muted-foreground font-body hover:text-foreground">{lang === "ro" ? "Gestionează" : "Manage"}</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-0.5">
                <button onClick={() => fileInputRef.current?.click()} className="aspect-square bg-muted/40 flex items-center justify-center hover:bg-muted/60 transition-colors">
                  <Camera className="h-7 w-7 text-muted-foreground" />
                </button>
                {loadingImages
                  ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square bg-muted animate-pulse" />)
                  : recentImages.map((img) => (
                      <button key={img.id} onClick={() => selectImage(img.url)} className="aspect-square overflow-hidden">
                        <img src={img.url} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                      </button>
                    ))}
                {!loadingImages && recentImages.length === 0 && (
                  <div className="col-span-2 aspect-[2/1] bg-muted/20 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground font-body text-center px-4">{lang === "ro" ? "Nicio imagine postată încă" : "No posted images yet"}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ───── EDITOR VIEW ───── */}
        {view === "editor" && selectedUrl && (
          <>
            {/* Top controls — absolute over image */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between px-3 pt-3 pointer-events-none">
              {/* Back to gallery */}
              <button
                onClick={() => { setView("gallery"); setSelectedUrl(null); setSelectedFile(null); }}
                className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center pointer-events-auto"
              >
                <X className="h-5 w-5 text-white" />
              </button>

              {/* Right tool column: Aa on top, then others */}
              <div className="flex flex-col gap-2 pointer-events-auto">
                {/* Aa — functional */}
                <button
                  onClick={openTextMode}
                  className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"
                >
                  <span className="text-white text-sm font-bold leading-none">Aa</span>
                </button>
                <button onClick={coming} className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"><Smile className="h-4 w-4 text-white" /></button>
                <button onClick={coming} className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"><Music className="h-4 w-4 text-white" /></button>
                <button onClick={coming} className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"><Sparkles className="h-4 w-4 text-white" /></button>
              </div>
            </div>

            {/* Image */}
            <div className="flex-1 bg-black relative overflow-hidden">
              <img src={selectedUrl} alt="Story preview" className="w-full h-full object-contain" />
              {/* Text overlay */}
              {overlayText && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span
                    className="text-white text-2xl font-bold text-center px-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                    style={{ fontFamily: textStyle === 0 ? "'Bebas Neue', sans-serif" : "serif", whiteSpace: "pre-wrap", maxWidth: "80%" }}
                  >
                    {overlayText}
                  </span>
                </div>
              )}
            </div>

            {/* Caption */}
            <div className="bg-black px-4 py-2 shrink-0">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={lang === "ro" ? "Adaugă o descriere..." : "Add a caption..."}
                className="w-full bg-transparent text-white/80 text-sm placeholder:text-white/40 font-body outline-none border-none"
                maxLength={150}
              />
            </div>

            {/* Bottom bar */}
            <div className="bg-black px-3 py-3 flex items-center gap-2 shrink-0">
              <button onClick={handlePost} disabled={posting} className="flex-1 flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-full px-3 py-2 transition-colors">
                <div className="w-7 h-7 rounded-full bg-muted overflow-hidden shrink-0">
                  {userPhoto ? <img src={userPhoto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User className="h-3.5 w-3.5 text-muted-foreground" /></div>}
                </div>
                <span className="text-white text-xs font-body truncate">{lang === "ro" ? "Story-ul tău" : "Your story"}</span>
              </button>
              <button onClick={coming} className="flex-1 flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-full px-3 py-2 transition-colors">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0"><span className="text-[9px]">⭐</span></div>
                <span className="text-white text-xs font-body truncate">{lang === "ro" ? "Prieteni apropiați" : "Close Friends"}</span>
              </button>
              <button onClick={handlePost} disabled={posting} className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 hover:bg-primary/80 transition-colors disabled:opacity-50">
                {posting ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <span className="text-white font-bold text-lg">→</span>}
              </button>
            </div>
          </>
        )}

        {/* ───── TEXT MODE VIEW ───── */}
        {view === "textMode" && selectedUrl && (
          <>
            {/* Image background */}
            <div className="absolute inset-0 z-0">
              <img src={selectedUrl} alt="" className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* Top: Done button */}
            <div className="relative z-20 flex items-center justify-end px-4 pt-4 shrink-0">
              <button
                onClick={confirmText}
                className="text-white text-sm font-semibold font-body bg-black/30 px-4 py-1.5 rounded-full"
              >
                {lang === "ro" ? "Gata" : "Done"}
              </button>
            </div>

            {/* Text input centered on image */}
            <div className="relative z-20 flex-1 flex items-center justify-center px-6">
              <input
                ref={textInputRef}
                type="text"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder={lang === "ro" ? "Scrie ceva..." : "Type something..."}
                className="w-full bg-transparent text-white text-2xl font-bold text-center outline-none border-none placeholder:text-white/40 caret-white"
                style={{ fontFamily: textStyle === 0 ? "'Bebas Neue', sans-serif" : "serif" }}
                onKeyDown={(e) => e.key === "Enter" && confirmText()}
              />
            </div>

            {/* Text style selector */}
            <div className="relative z-20 shrink-0 bg-black/60 px-4 py-2">
              <div className="flex gap-3 overflow-x-auto scrollbar-none mb-2">
                {TEXT_STYLES.map((style, i) => (
                  <button
                    key={style}
                    onClick={() => setTextStyle(i)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-body transition-colors ${textStyle === i ? "bg-white text-black" : "bg-white/20 text-white"}`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
      </DialogContent>
    </Dialog>
  );
}
