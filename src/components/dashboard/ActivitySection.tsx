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
  { value: "trophy", labelRo: "🏆 Câștigarea unui trofeu", labelEn: "🏆 Winning a trophy", prefillRo: "🏆 Sărbătoresc câștigarea unui trofeu! ", prefillEn: "🏆 Celebrating winning a trophy! " },
  { value: "contract", labelRo: "✍️ Semnare contract cu o echipă nouă", labelEn: "✍️ Signing with a new team", prefillRo: "✍️ Am semnat un contract cu o echipă nouă! ", prefillEn: "✍️ I've signed a contract with a new team! " },
  { value: "agent", labelRo: "🤝 Colaborarea cu un nou agent", labelEn: "🤝 Collaborating with a new agent", prefillRo: "🤝 Am început o colaborare cu un nou agent! ", prefillEn: "🤝 I've started working with a new agent! " },
  { value: "other", labelRo: "🎉 Altele", labelEn: "🎉 Other", prefillRo: "🎉 Sărbătoresc un moment special! ", prefillEn: "🎉 Celebrating a special moment! " },
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
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  const [myName, setMyName] = useState("");
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [viewingProfileRole, setViewingProfileRole] = useState<string>("player");

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
    const { data: followsData } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
    const followedIds = (followsData || []).map(f => f.following_id);
    const allIds = [...new Set([userId, ...followedIds])];

    const { data: rawPosts } = await supabase.from("posts").select("*").in("user_id", allIds).order("created_at", { ascending: false }).limit(50);
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
    (playerRes.data || []).forEach(p => profileMap.set(p.user_id, { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url, title: [p.position, p.current_team].filter(Boolean).join(" · ") }));
    (scoutRes.data || []).forEach(s => { if (!profileMap.has(s.user_id)) profileMap.set(s.user_id, { name: `${s.first_name} ${s.last_name}`.trim(), photo: s.photo_url, title: [s.title, s.organization].filter(Boolean).join(" | ") }); });

    const enriched: Post[] = rawPosts.map(p => {
      const profile = profileMap.get(p.user_id);
      const role = roleMap.get(p.user_id) || "player";
      return { ...p, author_name: profile?.name || (lang === "ro" ? "Utilizator" : "User"), author_photo: profile?.photo || null, author_role: role, author_title: profile?.title || "" };
    });
    setPosts(enriched);
    setLoading(false);
  };

  const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = currentUserId;

  useEffect(() => { if (currentUserId) fetchPosts(currentUserId); }, [currentUserId]);

  useEffect(() => {
    const channel = supabase.channel("posts-feed").on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => {
      const uid = currentUserIdRef.current;
      if (uid) fetchPosts(uid);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setImageFile(file); setImagePreview(URL.createObjectURL(file)); };
  const removeImage = () => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; };
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error(lang === "ro" ? "Videoclipul trebuie să fie sub 50MB" : "Video must be under 50MB"); return; }
    setVideoFile(file); setVideoPreview(URL.createObjectURL(file));
  };
  const removeVideo = () => { setVideoFile(null); setVideoPreview(null); if (videoInputRef.current) videoInputRef.current.value = ""; };

  const handlePost = async () => {
    if (!newContent.trim() || !currentUserId) return;
    setPosting(true);
    let imageUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${currentUserId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("player-documents").upload(path, imageFile);
      if (!error) { const { data: urlData } = supabase.storage.from("player-documents").getPublicUrl(path); imageUrl = urlData.publicUrl; }
    }
    let videoUrl: string | null = null;
    if (videoFile) {
      const ext = videoFile.name.split(".").pop();
      const path = `${currentUserId}/${Date.now()}-video.${ext}`;
      const { error } = await supabase.storage.from("player-videos").upload(path, videoFile);
      if (!error) { const { data: urlData } = supabase.storage.from("player-videos").getPublicUrl(path); videoUrl = urlData.publicUrl; }
    }
    const { error } = await supabase.from("posts").insert({ user_id: currentUserId, content: newContent.trim(), image_url: imageUrl, video_url: videoUrl, post_type: newType } as any).select().single();
    if (error) { toast.error(lang === "ro" ? "Eroare la publicare" : "Failed to post"); } else { setNewContent(""); setNewType("general"); removeImage(); removeVideo(); await fetchPosts(currentUserId); }
    setPosting(false);
  };

  const handleDelete = async (postId: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) toast.error(lang === "ro" ? "Eroare la ștergere" : "Failed to delete");
    else if (currentUserId) fetchPosts(currentUserId);
  };

  const handleUnfollow = async (userId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", userId);
    if (error) { toast.error(lang === "ro" ? "Eroare" : "Error"); }
    else { toast.success(lang === "ro" ? "Nu mai urmărești acest utilizator" : "Unfollowed successfully"); fetchPosts(currentUserId); }
  };

  const handleViewProfile = (userId: string, role: string) => { setViewingProfileId(userId); setViewingProfileRole(role); };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="font-display text-2xl text-foreground">{lang === "ro" ? "Activitate" : "Activity"}</h2>

      {/* Composer */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {myPhoto ? <img src={myPhoto} alt="" className="w-full h-full object-cover" /> : <User className="h-5 w-5 text-muted-foreground" />}
          </div>
          <Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder={lang === "ro" ? "Împărtășește o idee, un eveniment, o provocare..." : "Share an idea, event, challenge..."} className="min-h-[60px] resize-none bg-background border-border" />
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
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="text-muted-foreground"><ImagePlus className="h-4 w-4 mr-1" />{lang === "ro" ? "Fotografie" : "Photo"}</Button>
            <Button variant="ghost" size="sm" onClick={() => videoInputRef.current?.click()} className="text-muted-foreground"><Video className="h-4 w-4 mr-1" />{lang === "ro" ? "Videoclip" : "Video"}</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCelebrationDialog(true)} className="text-muted-foreground"><PartyPopper className="h-4 w-4 mr-1" />{lang === "ro" ? "Sărbătorește" : "Celebrate"}</Button>
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

      {/* Celebration Dialog */}
      <Dialog open={showCelebrationDialog} onOpenChange={setShowCelebrationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{lang === "ro" ? "Selectați un eveniment" : "Select an event"}</DialogTitle></DialogHeader>
          <div className="space-y-1">
            {CELEBRATION_EVENTS.map(evt => (
              <button key={evt.value} onClick={() => { setNewContent(lang === "ro" ? evt.prefillRo : evt.prefillEn); setNewType("event"); setShowCelebrationDialog(false); }} className="w-full text-left px-4 py-3 rounded-lg hover:bg-muted transition-colors text-sm text-foreground">
                {lang === "ro" ? evt.labelRo : evt.labelEn}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">{lang === "ro" ? "Nicio postare încă. Urmărește persoane pentru a vedea activitatea lor!" : "No posts yet. Follow people to see their activity!"}</div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={{ id: post.id, user_id: post.user_id, content: post.content, image_url: post.image_url, video_url: (post as any).video_url || null, post_type: post.post_type, created_at: post.created_at }}
              author={{ user_id: post.user_id, name: post.author_name, photo: post.author_photo, role: post.author_role, title: post.author_title }}
              currentUserId={currentUserId}
              onDelete={handleDelete}
              onUnfollow={handleUnfollow}
              onViewProfile={handleViewProfile}
            />
          ))}
        </div>
      )}

      {/* Profile View Dialog */}
      <Dialog open={!!viewingProfileId} onOpenChange={(open) => !open && setViewingProfileId(null)}>
        <DialogContent className="max-w-[100vw] sm:max-w-4xl w-[100vw] sm:w-[95vw] h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 gap-0 bg-background border-0 sm:border sm:border-border rounded-none sm:rounded-xl fixed inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] !translate-x-0 !translate-y-0 sm:!translate-x-[-50%] sm:!translate-y-[-50%]" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle className="sr-only">{lang === "ro" ? "Profil" : "Profile"}</DialogTitle>
          <div className="overflow-y-auto h-full sm:max-h-[90vh]">
            {viewingProfileId && (
              viewingProfileRole === "player"
                ? <PersonalProfile userId={viewingProfileId} readOnly />
                : <ScoutPersonalProfile userId={viewingProfileId} readOnly />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActivitySection;
