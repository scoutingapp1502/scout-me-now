import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Loader2, User, ImagePlus, Video, X, Send, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import PostCard from "./PostCard";
import PersonalProfile from "./PersonalProfile";
import ScoutPersonalProfile from "./ScoutPersonalProfile";

interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  post_type: string;
  created_at: string;
  author_name: string;
  author_photo: string | null;
  author_role: string;
  author_title: string;
}

const POST_TYPES = [
  { value: "general", labelRo: "General", labelEn: "General" },
  { value: "transfer", labelRo: "Transfer / Colaborare", labelEn: "Transfer / Collaboration" },
  { value: "challenge", labelRo: "Provocare", labelEn: "Challenge" },
  { value: "event", labelRo: "Eveniment", labelEn: "Event" },
];

const CELEBRATION_EVENTS = [
  { 
    value: "trophy", 
    labelRo: "🏆 Câștigarea unui trofeu", 
    labelEn: "🏆 Winning a trophy",
    prefillRo: "🏆 Sărbătoresc câștigarea unui trofeu! ",
    prefillEn: "🏆 Celebrating winning a trophy! ",
  },
  { 
    value: "contract", 
    labelRo: "✍️ Semnare contract cu o echipă nouă", 
    labelEn: "✍️ Signing with a new team",
    prefillRo: "✍️ Am semnat un contract cu o echipă nouă! ",
    prefillEn: "✍️ I've signed a contract with a new team! ",
  },
  { 
    value: "agent", 
    labelRo: "🤝 Colaborarea cu un nou agent", 
    labelEn: "🤝 Collaborating with a new agent",
    prefillRo: "🤝 Am început o colaborare cu un nou agent! ",
    prefillEn: "🤝 I've started working with a new agent! ",
  },
  { 
    value: "other", 
    labelRo: "🎉 Altele", 
    labelEn: "🎉 Other",
    prefillRo: "🎉 Sărbătoresc un moment special! ",
    prefillEn: "🎉 Celebrating a special moment! ",
  },
];

const ActivitySection = () => {
  const { lang } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState("general");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [showCelebrationDialog, setShowCelebrationDialog] = useState(false);

  // Current user photo/name for composer
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  const [myName, setMyName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        loadMyProfile(user.id);
      }
    });
  }, []);

  const loadMyProfile = async (userId: string) => {
    const { data: role } = await supabase.rpc("get_user_role", { _user_id: userId });
    if (role === "player") {
      const { data } = await supabase.from("player_profiles").select("first_name, last_name, photo_url").eq("user_id", userId).maybeSingle();
      if (data) { setMyName(`${data.first_name} ${data.last_name}`.trim()); setMyPhoto(data.photo_url); }
    } else {
      const { data } = await supabase.from("scout_profiles").select("first_name, last_name, photo_url").eq("user_id", userId).maybeSingle();
      if (data) { setMyName(`${data.first_name} ${data.last_name}`.trim()); setMyPhoto(data.photo_url); }
    }
  };

  const fetchPosts = async (userId: string) => {
    setLoading(true);

    // Get followed user IDs
    const { data: followsData } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);

    const followedIds = (followsData || []).map(f => f.following_id);
    // Include own posts + followed users' posts
    const allIds = [...new Set([userId, ...followedIds])];

    const { data: rawPosts } = await supabase
      .from("posts")
      .select("*")
      .in("user_id", allIds)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!rawPosts || rawPosts.length === 0) { setPosts([]); setLoading(false); return; }

    const userIds = [...new Set(rawPosts.map(p => p.user_id))];

    const [playerRes, scoutRes, roleRes] = await Promise.all([
      supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url, position, current_team").in("user_id", userIds),
      supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url, title, organization").in("user_id", userIds),
      supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
    ]);

    const roleMap = new Map<string, string>();
    (roleRes.data || []).forEach(r => roleMap.set(r.user_id, r.role));

    const profileMap = new Map<string, { name: string; photo: string | null; title: string }>();
    (playerRes.data || []).forEach(p => {
      profileMap.set(p.user_id, {
        name: `${p.first_name} ${p.last_name}`.trim(),
        photo: p.photo_url,
        title: [p.position, p.current_team].filter(Boolean).join(" · "),
      });
    });
    (scoutRes.data || []).forEach(s => {
      if (!profileMap.has(s.user_id)) {
        profileMap.set(s.user_id, {
          name: `${s.first_name} ${s.last_name}`.trim(),
          photo: s.photo_url,
          title: [s.title, s.organization].filter(Boolean).join(" | "),
        });
      }
    });

    const enriched: Post[] = rawPosts.map(p => {
      const profile = profileMap.get(p.user_id);
      const role = roleMap.get(p.user_id) || "player";
      return {
        ...p,
        author_name: profile?.name || (lang === "ro" ? "Utilizator" : "User"),
        author_photo: profile?.photo || null,
        author_role: role,
        author_title: profile?.title || "",
      };
    });

    setPosts(enriched);
    setLoading(false);
  };

  // Keep a ref to currentUserId so the realtime callback always has the latest value
  const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = currentUserId;

  useEffect(() => { if (currentUserId) fetchPosts(currentUserId); }, [currentUserId]);

  // Realtime — stable subscription, uses ref to avoid stale closures
  useEffect(() => {
    const channel = supabase
      .channel("posts-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
        const uid = currentUserIdRef.current;
        if (uid) fetchPosts(uid);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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
      if (!error) {
        const { data: urlData } = supabase.storage.from("player-documents").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
    }

    let videoUrl: string | null = null;
    if (videoFile) {
      const ext = videoFile.name.split(".").pop();
      const path = `${currentUserId}/${Date.now()}-video.${ext}`;
      const { error } = await supabase.storage.from("player-videos").upload(path, videoFile);
      if (!error) {
        const { data: urlData } = supabase.storage.from("player-videos").getPublicUrl(path);
        videoUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from("posts").insert({
      user_id: currentUserId,
      content: newContent.trim(),
      image_url: imageUrl,
      video_url: videoUrl,
      post_type: newType,
    } as any).select().single();

    if (error) {
      toast.error(lang === "ro" ? "Eroare la publicare" : "Failed to post");
    } else {
      setNewContent("");
      setNewType("general");
      removeImage();
      removeVideo();
      await fetchPosts(currentUserId);
    }
    setPosting(false);
  };

  const handleDelete = async (postId: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) toast.error(lang === "ro" ? "Eroare la ștergere" : "Failed to delete");
  };

  const getTypeLabel = (type: string) => {
    const t = POST_TYPES.find(p => p.value === type);
    return t ? (lang === "ro" ? t.labelRo : t.labelEn) : type;
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "transfer": return "bg-blue-500/20 text-blue-400";
      case "challenge": return "bg-orange-500/20 text-orange-400";
      case "event": return "bg-green-500/20 text-green-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return lang === "ro" ? "acum" : "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString(lang === "ro" ? "ro-RO" : "en-US", { day: "numeric", month: "short" });
  };

  const getRoleLabel = (role: string) => {
    if (role === "scout") return "Scouter";
    if (role === "agent") return "Agent";
    return lang === "ro" ? "Jucător" : "Player";
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="font-display text-2xl text-foreground">
        {lang === "ro" ? "Activitate" : "Activity"}
      </h2>

      {/* Composer */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {myPhoto ? (
              <img src={myPhoto} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="h-5 w-5 text-muted-foreground" />
            )}
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
            <button onClick={removeImage} className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        )}

        {videoPreview && (
          <div className="relative inline-block">
            <video src={videoPreview} className="max-h-48 rounded-lg" controls />
            <button onClick={removeVideo} className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="text-muted-foreground">
              <ImagePlus className="h-4 w-4 mr-1" />
              {lang === "ro" ? "Fotografie" : "Photo"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => videoInputRef.current?.click()} className="text-muted-foreground">
              <Video className="h-4 w-4 mr-1" />
              {lang === "ro" ? "Videoclip" : "Video"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCelebrationDialog(true)} className="text-muted-foreground">
              <PartyPopper className="h-4 w-4 mr-1" />
              {lang === "ro" ? "Sărbătorește" : "Celebrate"}
            </Button>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="w-auto h-8 text-xs bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {lang === "ro" ? t.labelRo : t.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

      {/* Celebration Dialog */}
      <Dialog open={showCelebrationDialog} onOpenChange={setShowCelebrationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{lang === "ro" ? "Selectați un eveniment" : "Select an event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {CELEBRATION_EVENTS.map(evt => (
              <button
                key={evt.value}
                onClick={() => {
                  setNewContent(lang === "ro" ? evt.prefillRo : evt.prefillEn);
                  setNewType("event");
                  setShowCelebrationDialog(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-muted transition-colors text-sm text-foreground"
              >
                {lang === "ro" ? evt.labelRo : evt.labelEn}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
          <Button size="sm" onClick={handlePost} disabled={posting || !newContent.trim()}>
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            {lang === "ro" ? "Publică" : "Post"}
          </Button>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {lang === "ro" ? "Nicio postare încă. Urmărește persoane pentru a vedea activitatea lor!" : "No posts yet. Follow people to see their activity!"}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {post.author_photo ? (
                        <img src={post.author_photo} alt={post.author_name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-display text-sm text-foreground truncate">{post.author_name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                          {getRoleLabel(post.author_role)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{post.author_title}</p>
                      <p className="text-[10px] text-muted-foreground/60">{timeAgo(post.created_at)}</p>
                    </div>
                  </div>
                  {post.user_id === currentUserId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDelete(post.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          {lang === "ro" ? "Șterge" : "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Type badge */}
                {post.post_type !== "general" && (
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mb-2 ${getTypeBadgeColor(post.post_type)}`}>
                    {getTypeLabel(post.post_type)}
                  </span>
                )}

                {/* Content */}
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{post.content}</p>
              </div>

              {/* Image */}
              {post.image_url && (
                <img src={post.image_url} alt="" className="w-full max-h-96 object-cover" />
              )}

              {/* Video */}
              {(post as any).video_url && (
                <video src={(post as any).video_url} className="w-full max-h-96" controls />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivitySection;
