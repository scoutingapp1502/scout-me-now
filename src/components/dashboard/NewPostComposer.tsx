import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Loader2, User, ImagePlus, Video, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const POST_TYPES = [
  { value: "general", labelRo: "General", labelEn: "General" },
  { value: "transfer", labelRo: "Transfer / Colaborare", labelEn: "Transfer / Collaboration" },
  { value: "challenge", labelRo: "Provocare", labelEn: "Challenge" },
  { value: "event", labelRo: "Eveniment", labelEn: "Event" },
];

interface NewPostComposerProps {
  currentUserId: string;
  myPhoto?: string | null;
  onPosted: () => void;
}

const NewPostComposer = ({ currentUserId, myPhoto, onPosted }: NewPostComposerProps) => {
  const { lang } = useLanguage();
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState("general");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };
  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error(lang === "ro" ? "Videoclipul trebuie să fie sub 50MB" : "Video must be under 50MB");
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };
  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handlePost = async () => {
    if (!newContent.trim() || !currentUserId) return;
    setPosting(true);
    let imageUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${currentUserId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("player-documents").upload(path, imageFile);
      if (error) {
        toast.error(lang === "ro" ? "Nu s-a putut încărca imaginea." : "Failed to upload the image.");
        setPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("player-documents").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }
    let videoUrl: string | null = null;
    if (videoFile) {
      const ext = videoFile.name.split(".").pop();
      const path = `${currentUserId}/${Date.now()}-video.${ext}`;
      const { error } = await supabase.storage.from("player-videos").upload(path, videoFile);
      if (error) {
        toast.error(lang === "ro" ? "Nu s-a putut încărca videoclipul." : "Failed to upload the video.");
        setPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("player-videos").getPublicUrl(path);
      videoUrl = urlData.publicUrl;
    }
    const { error } = await supabase
      .from("posts")
      .insert({ user_id: currentUserId, content: newContent.trim(), image_url: imageUrl, video_url: videoUrl, post_type: newType } as any)
      .select()
      .single();
    if (error) {
      toast.error(lang === "ro" ? "Eroare la publicare" : "Failed to post");
    } else {
      setNewContent("");
      setNewType("general");
      removeImage();
      removeVideo();
      onPosted();
    }
    setPosting(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {myPhoto ? <img src={myPhoto} alt="" className="w-full h-full object-cover" /> : <User className="h-5 w-5 text-muted-foreground" />}
        </div>
        <Textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder={lang === "ro" ? "Împărtășește o idee, un eveniment, o provocare..." : "Share an idea, event, challenge..."}
          className="min-h-[60px] resize-none bg-background border-border"
        />
      </div>

      {imagePreview && (
        <div className="relative inline-block">
          <img src={imagePreview} alt="" className="max-h-48 rounded-lg object-cover" />
          <button onClick={removeImage} className="absolute top-1 right-1 bg-black/60 rounded-full p-1"><X className="h-3 w-3 text-white" /></button>
        </div>
      )}
      {videoPreview && (
        <div className="relative inline-block">
          <video src={videoPreview} className="max-h-48 rounded-lg" controls />
          <button onClick={removeVideo} className="absolute top-1 right-1 bg-black/60 rounded-full p-1"><X className="h-3 w-3 text-white" /></button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="text-muted-foreground">
            <ImagePlus className="h-4 w-4 mr-1" />{lang === "ro" ? "Fotografie" : "Photo"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => videoInputRef.current?.click()} className="text-muted-foreground">
            <Video className="h-4 w-4 mr-1" />{lang === "ro" ? "Videoclip" : "Video"}
          </Button>

          <Select value={newType} onValueChange={setNewType}>
            <SelectTrigger className="w-auto h-8 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
            <SelectContent>{POST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{lang === "ro" ? t.labelRo : t.labelEn}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={handlePost} disabled={posting || !newContent.trim()}>
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          {lang === "ro" ? "Publică" : "Post"}
        </Button>
      </div>
    </div>
  );
};

export default NewPostComposer;
