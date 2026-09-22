import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Rocket, ImagePlus, Video, X, Send } from "lucide-react";
import PostCard from "@/components/dashboard/PostCard";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];

interface SportrisePost {
  id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
  comments_disabled: boolean;
}

// SportRise author identity shared by every card — matches exactly what
// ActivitySection.tsx builds for these posts in the regular feed
// (fetchSportrisePosts), so PostCard's isSportriseAuthor branch (Rocket
// avatar, no per-post edit/delete menu since isOwnPost is user_id-based
// and "sportrise" never equals a real admin's uuid) renders identically
// here. user_id: "sportrise" is a placeholder, not a real account.
const SPORTRISE_AUTHOR = { user_id: "sportrise", name: "SportRise", photo: null, role: "sportrise", title: "" };

export default function AdminSportrisePosts({ embedded }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [posts, setPosts] = useState<SportrisePost[]>([]);
  const [loading, setLoading] = useState(true);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminUserId(data.user?.id ?? null));
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("sportrise_posts")
      .select("id, content, image_url, video_url, created_at, comments_disabled")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setPosts(data || []);
    setLoading(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Format nesuportat. Folosește JPG, PNG, WebP sau GIF.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Imaginea trebuie să fie sub 10MB.", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  // No duration/size cap here, unlike NewPostComposer.tsx's 60s/50MB limits
  // for regular users (getVideoDuration/MAX_VIDEO_DURATION_SECONDS) —
  // explicit product decision: SportRise posts are admin-only, published on
  // trust, so only the file *type* is checked, never length or size.
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      toast({ title: "Format nesuportat. Folosește MP4, WebM, OGG sau MOV.", variant: "destructive" });
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

  const handlePublish = async () => {
    if (!content.trim() || !adminUserId) return;
    setPosting(true);
    let imageUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${adminUserId}/${Date.now()}-sportrise.${ext}`;
      const { error: uploadError } = await supabase.storage.from("player-documents").upload(path, imageFile);
      if (uploadError) {
        toast({ title: "Nu s-a putut încărca imaginea.", variant: "destructive" });
        setPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("player-documents").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }
    let videoUrl: string | null = null;
    if (videoFile) {
      const ext = videoFile.name.split(".").pop();
      const path = `${adminUserId}/${Date.now()}-sportrise-video.${ext}`;
      // Same bucket (player-videos) regular video posts/highlights use —
      // can_view_profile_media() already treats any file under an admin's
      // own uploader folder as app-wide, readable-by-everyone content (see
      // 20260926090000_private_media_buckets.sql), so no separate storage
      // policy is needed for this to work.
      const { error: uploadError } = await supabase.storage.from("player-videos").upload(path, videoFile);
      if (uploadError) {
        toast({ title: "Nu s-a putut încărca videoclipul.", variant: "destructive" });
        setPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("player-videos").getPublicUrl(path);
      videoUrl = urlData.publicUrl;
    }
    const { error } = await (supabase as any).from("sportrise_posts").insert({
      content: content.trim(),
      image_url: imageUrl,
      video_url: videoUrl,
      created_by: adminUserId,
    });
    setPosting(false);
    if (error) {
      toast({ title: "Eroare la publicare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Postare SportRise publicată!" });
    setContent("");
    removeImage();
    removeVideo();
    fetchPosts();
  };

  // Soft-delete, same as posts/scout_posts elsewhere — matches the "Admins
  // can update sportrise posts" RLS policy (20260910090000_sportrise_official_posts.sql),
  // which is a plain has_role(auth.uid(), 'admin') check with no other
  // condition. A 403 here almost always means the signed-in account's own
  // user_roles row doesn't actually have 'admin' (e.g. testing from a
  // second, non-admin account), not a bug in this call itself.
  const handleDelete = async (postId: string) => {
    const { error } = await (supabase as any)
      .from("sportrise_posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", postId);
    if (error) {
      toast({ title: "Eroare la ștergere", description: error.message, variant: "destructive" });
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div className={embedded ? "text-gray-900" : "min-h-screen bg-gray-200 text-gray-900"}>
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        {!embedded && (
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-heading font-bold">🚀 Postări SportRise</h1>
          </div>
        )}
        {embedded && (
          <h1 className="text-2xl font-heading font-bold mb-2 flex items-center gap-2">
            <Rocket className="h-6 w-6" /> Postări SportRise
          </h1>
        )}
        <p className="text-sm text-gray-500 mb-6">
          Aceste postări apar în feed-ul de Activitate al tuturor utilizatorilor, marcate ca oficiale SportRise. Aprecierile
          și comentariile funcționează la fel ca la orice altă postare — poți comenta și tu, ca SportRise.
        </p>

        {/* Composer */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3 mb-6">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Scrie o postare explicativă sau un anunț SportRise..."
            rows={4}
          />
          {imagePreview && (
            <div className="relative inline-block">
              <img src={imagePreview} alt="" className="max-h-40 rounded-lg object-cover" />
              <button type="button" onClick={removeImage} className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          )}
          {videoPreview && (
            <div className="relative inline-block">
              <video src={videoPreview} className="max-h-40 rounded-lg" controls />
              <button type="button" onClick={removeVideo} className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <Button type="button" variant="ghost" size="sm" onClick={() => imageInputRef.current?.click()} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                <ImagePlus className="h-4 w-4 mr-1" />Fotografie
              </Button>
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
              {/* No size/duration limit, unlike player posts (NewPostComposer.tsx) — SportRise content is admin-only, published on trust. */}
              <Button type="button" variant="ghost" size="sm" onClick={() => videoInputRef.current?.click()} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                <Video className="h-4 w-4 mr-1" />Videoclip
              </Button>
            </div>
            <Button type="button" size="sm" onClick={handlePublish} disabled={posting || !content.trim()} className="bg-orange-500 hover:bg-orange-600 text-white">
              {posting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Publică
            </Button>
          </div>
        </div>

        {/* Existing list — rendered through the same PostCard every user
            sees in their own Activity feed, so likes/comments (both
            visible AND actionable here) are the real, live counts/threads,
            not a separate admin-only view. The admin's own account can
            like/comment through this card just like any other viewer;
            deleting a post uses the dedicated button below instead of
            PostCard's own menu (which never shows here anyway, since
            isOwnPost compares against the "sportrise" placeholder user_id). */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Nicio postare SportRise publicată încă.</p>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <div key={p.id} className="relative">
                <PostCard
                  post={{
                    id: p.id,
                    user_id: "sportrise",
                    content: p.content,
                    image_url: p.image_url,
                    video_url: p.video_url,
                    post_type: "sportrise",
                    created_at: p.created_at,
                    comments_disabled: p.comments_disabled,
                  }}
                  author={SPORTRISE_AUTHOR}
                  currentUserId={adminUserId}
                  onDelete={handleDelete}
                  onViewProfile={() => {}}
                  hideMenu
                />
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="absolute top-3 right-3 gap-1.5 h-7 px-2.5 text-xs"
                  onClick={() => handleDelete(p.id)}
                >
                  Șterge postarea
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
