import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Loader2, User, ImagePlus, Video, X, Send, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAccountLock } from "@/hooks/useAccountLock";
import { moderateUploadedPost } from "@/lib/videoModeration";

const POST_TYPES = [
  { value: "general", labelRo: "General", labelEn: "General" },
  { value: "transfer", labelRo: "Transfer / Colaborare", labelEn: "Transfer / Collaboration" },
  { value: "challenge", labelRo: "Provocare", labelEn: "Challenge" },
  { value: "event", labelRo: "Eveniment", labelEn: "Event" },
];

interface NewPostComposerProps {
  currentUserId: string;
  myPhoto?: string | null;
  myRole?: "player" | "cauta_jucator" | null;
  onPosted: (post?: { id: string; content: string; image_url: string | null; video_url: string | null; post_type: string; created_at: string; moderation_status: string }) => void;
}

const NewPostComposer = ({ currentUserId, myPhoto, myRole, onPosted }: NewPostComposerProps) => {
  const { lang } = useLanguage();
  const { isLocked: accountLocked } = useAccountLock(currentUserId, myRole);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState("general");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error(lang === "ro" ? "Format nesuportat. Folosește JPG, PNG, WebP sau GIF." : "Unsupported format. Use JPG, PNG, WebP or GIF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(lang === "ro" ? "Imaginea trebuie să fie sub 10MB" : "Image must be under 10MB");
      return;
    }
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
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      toast.error(lang === "ro" ? "Format nesuportat. Folosește MP4, WebM, OGG sau MOV." : "Unsupported format. Use MP4, WebM, OGG or MOV.");
      return;
    }
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
    if (myRole === "cauta_jucator" && accountLocked) {
      toast.error(lang === "ro" ? "Contul tău trebuie verificat înainte de a putea publica." : "Your account must be verified before you can post.");
      return;
    }
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
    let videoStoragePath: string | null = null;
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
      videoStoragePath = path;
    }
    // Every post (text, photo, or video) goes through the same moderation
    // pipeline now, so moderation_status always starts 'pending' here and
    // moderateUploadedPost below is what actually resolves it — nothing is
    // auto-approved just for lacking an attachment.
    const { data, error } = myRole === "cauta_jucator"
      ? await supabase
          .from("scout_posts")
          .insert({ user_id: currentUserId, content: newContent.trim(), image_url: imageUrl } as any)
          .select()
          .single()
      : await supabase
          .from("posts")
          .insert({ user_id: currentUserId, content: newContent.trim(), image_url: imageUrl, video_url: videoUrl, post_type: newType, moderation_status: "pending" } as any)
          .select()
          .single();
    if (error) {
      toast.error(lang === "ro" ? "Eroare la publicare" : "Failed to post");
    } else {
      setNewContent("");
      setNewType("general");
      removeImage();
      removeVideo();
      onPosted(data ? {
        id: (data as any).id,
        content: (data as any).content,
        image_url: (data as any).image_url,
        video_url: (data as any).video_url ?? null,
        post_type: (data as any).post_type ?? (myRole === "cauta_jucator" ? "scout" : newType),
        created_at: (data as any).created_at,
        moderation_status: (data as any).moderation_status ?? "pending",
      } : undefined);

      // Every post (text, photo, or video) stays hidden from everyone but
      // the author/admins until this resolves — never blocks the toast/UI
      // above, runs in the background. scout_posts has no moderation_status
      // column yet, so this only applies to player posts for now.
      if (data && myRole !== "cauta_jucator") {
        moderateUploadedPost({
          videoFile,
          videoBucket: "player-videos",
          videoStoragePath,
          imageFile,
          contentId: (data as any).id,
          caption: newContent.trim(),
        }).catch((err) => console.error("Moderation pipeline failed:", err));
      }
    }
    setPosting(false);
  };

  const isScoutLocked = myRole === "cauta_jucator" && accountLocked;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      {isScoutLocked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <Lock className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            {lang === "ro" ? "Poți publica după ce contul tău este verificat de un administrator." : "You can post once your account has been verified by an admin."}
          </p>
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
          {myPhoto ? <img src={myPhoto} alt="" className="w-full h-full object-cover" /> : <User className="h-5 w-5 text-gray-500" />}
        </div>
        <Textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder={lang === "ro" ? "Împărtășește o idee, un eveniment, o provocare..." : "Share an idea, event, challenge..."}
          className="min-h-[60px] resize-none bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900"
          disabled={isScoutLocked}
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
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100" disabled={isScoutLocked}>
            <ImagePlus className="h-4 w-4 mr-1" />{lang === "ro" ? "Fotografie" : "Photo"}
          </Button>
          {myRole !== "cauta_jucator" && (
            <>
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
              <Button variant="ghost" size="sm" onClick={() => videoInputRef.current?.click()} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                <Video className="h-4 w-4 mr-1" />{lang === "ro" ? "Videoclip" : "Video"}
              </Button>

              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="w-auto h-8 text-xs bg-gray-100 border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-900"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-gray-900">{POST_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="focus:bg-gray-100 focus:text-gray-900">{lang === "ro" ? t.labelRo : t.labelEn}</SelectItem>)}</SelectContent>
              </Select>
            </>
          )}
        </div>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handlePost} disabled={posting || !newContent.trim() || isScoutLocked}>
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : isScoutLocked ? <Lock className="h-4 w-4 mr-1" /> : <Send className="h-4 w-4 mr-1" />}
          {lang === "ro" ? "Publică" : "Post"}
        </Button>
      </div>
    </div>
  );
};

export default NewPostComposer;
