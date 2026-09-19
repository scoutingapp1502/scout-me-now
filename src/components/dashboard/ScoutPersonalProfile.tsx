import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, Edit2, MapPin, Building2, Plus, Trash2, Loader2, Briefcase, Award, MessageSquare, Image, Send, MoreHorizontal, ThumbsUp, Share2, Info, MessageCircle, UserPlus, UserCheck, Users, Lock, FileText, Upload, Download } from "lucide-react";
import { openSignedUrl } from "@/lib/signedMedia";
import { SignedImg } from "@/components/SignedSrc";
import MessageDialog from "./MessageDialog";
import ScoutExtraSections from "./ScoutExtraSections";
import RepresentedPlayersSection from "./RepresentedPlayersSection";
import SkillsEditor from "./SkillsEditor";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFollowers } from "@/hooks/useFollowers";
import { useAccountLock } from "@/hooks/useAccountLock";
import FollowersList from "./FollowersList";
import RecommendationsSection from "./RecommendationsSection";
import PersonalAreaFooter from "./PersonalAreaFooter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
const LazyPersonalProfile = lazy(() => import("./PersonalProfile"));
const LazyScoutPersonalProfile = lazy(() => import("./ScoutPersonalProfile"));

type ScoutProfile = Tables<"scout_profiles">;
type ScoutExperience = Tables<"scout_experiences">;
type ScoutPost = Tables<"scout_posts">;

interface ScoutPersonalProfileProps {
  userId: string;
  readOnly?: boolean;
  onNavigateToChat?: (userId: string) => void;
  onNavigate?: (section: string) => void;
}

function formatExpDate(val: string | null | undefined, locale: string, presentWord: string): string {
  if (!val) return "";
  if (val === "Prezent") return presentWord;
  if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, mo] = val.split("-");
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString(locale, { month: "short", year: "numeric" });
  }
  if (val.match(/^\d{4}-\d{2}$/)) {
    const [y, mo] = val.split("-");
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString(locale, { month: "short", year: "numeric" });
  }
  return val;
}

/* ─── Player Reports Upload Section ────────────────────────────────── */

function PlayerReportsSection({ userId, readOnly = false }: { userId: string; readOnly?: boolean }) {
  const { toast } = useToast();
  const { lang } = useLanguage();
  const ro = lang === "ro";
  const isOwner = !readOnly;

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => { fetchReports(); }, [userId]);

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("scout_uploaded_reports")
      .select("*")
      .eq("scout_user_id", userId)
      .order("created_at", { ascending: false });
    setReports(data || []);
    setLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!title.trim()) {
      toast({ title: ro ? "Adaugă un titlu înainte de a încărca fișierul." : "Add a title before uploading.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/report-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("scout-reports").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("scout-reports").getPublicUrl(path);
      const { error: dbError } = await (supabase as any).from("scout_uploaded_reports").insert({
        scout_user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        file_url: urlData.publicUrl,
        file_name: file.name,
      });
      if (dbError) throw dbError;
      setTitle("");
      setDescription("");
      e.target.value = "";
      await fetchReports();
      toast({ title: ro ? "Raport încărcat cu succes!" : "Report uploaded!" });
    } catch (err: any) {
      toast({ title: ro ? "Eroare" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from("scout_uploaded_reports").delete().eq("id", id);
    setReports(prev => prev.filter(r => r.id !== id));
    toast({ title: ro ? "Raport șters." : "Report deleted." });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-orange-500" />
        <h2 className="font-display text-2xl text-gray-900">
          {ro ? "Rapoarte jucători" : "Player reports"}
        </h2>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 -m-1.5 text-gray-500 hover:text-orange-500 transition-colors rounded-full"
            >
              <Info className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-72 text-sm">
            <p className="font-semibold mb-2">
              {ro ? "Ce este această secțiune?" : "What is this section?"}
            </p>
            <p className="text-gray-500">
              {ro
                ? "Încarcă rapoarte scrise (PDF/Word) despre jucătorii pe care i-ai evaluat sau urmărit — analize, observații de la meciuri, recomandări. Rapoartele sunt vizibile pe profilul tău public, ca dovadă a activității tale."
                : "Upload written reports (PDF/Word) about players you've evaluated or scouted — analyses, match observations, recommendations. Reports are visible on your public profile as proof of your activity."}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {/* Upload form – only for owner */}
      {isOwner && (
        <div className="mb-5 p-4 bg-gray-100 rounded-lg border border-gray-200 space-y-3">
          <p className="text-xs text-gray-500 font-body uppercase tracking-wider">
            {ro ? "Adaugă raport nou" : "Add new report"}
          </p>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={ro ? "Titlu (ex: Analiza atacanților Liga 1 – 2024)" : "Title (e.g. Liga 1 strikers analysis – 2024)"}
          />
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={ro ? "Descriere opțională..." : "Optional description..."}
            rows={2}
            className="text-sm min-h-0"
          />
          <div className="flex items-center gap-3">
            <label className={`inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border text-sm font-body transition-colors ${
              uploading || !title.trim()
                ? "opacity-50 cursor-not-allowed border-gray-200 text-gray-500"
                : "border-orange-500 text-orange-500 hover:bg-orange-50"
            }`}>
              {uploading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Upload className="h-4 w-4" />}
              {ro ? "Selectează fișier (PDF / Word)" : "Select file (PDF / Word)"}
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                disabled={uploading || !title.trim()}
                onChange={handleFileChange}
              />
            </label>
            {!title.trim() && (
              <span className="text-xs text-gray-500 font-body">
                {ro ? "Completează titlul mai întâi" : "Fill in the title first"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Reports list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        </div>
      ) : reports.length === 0 ? (
        <p className="text-gray-500 italic text-sm font-body text-center py-4">
          {isOwner
            ? (ro ? "Niciun raport încărcat încă." : "No reports uploaded yet.")
            : (ro ? "Niciun raport disponibil." : "No reports available.")}
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map(report => (
            <div key={report.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors bg-gray-50">
              <div className="shrink-0 w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm font-body">{report.title}</p>
                {report.description && (
                  <p className="text-gray-500 text-xs font-body mt-0.5 line-clamp-2">{report.description}</p>
                )}
                <p className="text-gray-500 text-xs font-body mt-1">
                  {new Date(report.created_at).toLocaleDateString(LOCALE_BY_LANG[lang] || "en-US", { day: "numeric", month: "short", year: "numeric" })}
                  {report.file_name && (
                    <span className="ml-1.5 opacity-60">· {report.file_name}</span>
                  )}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0 mt-0.5">
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); openSignedUrl(report.file_url); }}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:text-orange-500 hover:border-orange-300 transition-colors font-body"
                >
                  <Download className="h-3.5 w-3.5" />
                  {ro ? "Deschide" : "Open"}
                </a>
                {isOwner && (
                  <button
                    onClick={() => handleDelete(report.id)}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-destructive hover:border-destructive/40 transition-colors"
                    title={ro ? "Șterge" : "Delete"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

const LOCALE_BY_LANG: Record<string, string> = {
  ro: "ro-RO", en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT",
};

const ScoutPersonalProfile = ({ userId, readOnly = false, onNavigateToChat, onNavigate }: ScoutPersonalProfileProps) => {
  const { toast } = useToast();
  const { lang, t } = useLanguage();
  const ts = t.dashboard.scoutProfile;
  const [profile, setProfile] = useState<ScoutProfile | null>(null);
  const [experiences, setExperiences] = useState<ScoutExperience[]>([]);
  const [posts, setPosts] = useState<ScoutPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<"header" | "about" | "experience" | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ScoutProfile>>({});
  const [expForms, setExpForms] = useState<Partial<ScoutExperience>[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [newPostImagePreview, setNewPostImagePreview] = useState<string | null>(null);
  const [postingActivity, setPostingActivity] = useState(false);
  const [activityFilter, setActivityFilter] = useState<"all" | "posts" | "images">("all");
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [followStatus, setFollowStatus] = useState<"none" | "pending" | "accepted" | "rejected">("none");
  const [followLoading, setFollowLoading] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState(false);
  const { followers, count: followerCount, removeFollower } = useFollowers(userId);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const { isLocked: viewerLocked } = useAccountLock(viewerUserId, viewerRole);
  const [recAuthorView, setRecAuthorView] = useState<{ userId: string; role: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setViewerUserId(user?.id || null);
      if (user?.id) {
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle()
          .then(({ data }) => setViewerRole(data?.role ?? null))
          .catch((err) => console.error("Failed to load viewer role:", err));
      }
    }).catch((err) => console.error("Failed to get current user:", err));
  }, []);

  useEffect(() => {
    fetchData();
    if (readOnly) checkFollowStatus();
  }, [userId]);

  const checkFollowStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("follows")
      .select("status")
      .eq("follower_id", user.id)
      .eq("following_id", userId)
      .maybeSingle();
    setFollowStatus((data?.status as typeof followStatus) || "none");
  };

  const toggleFollow = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setFollowLoading(true);
    if (followStatus === "accepted" || followStatus === "pending") {
      const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
      if (!error) setFollowStatus("none");
    } else {
      const { error } = await supabase.rpc("request_follow", { _following_id: userId });
      if (!error) setFollowStatus("pending");
    }
    setFollowLoading(false);
  };

  const notifyProfileUpdated = () => {
    window.dispatchEvent(new Event("profile-updated"));
  };

  const fetchData = async () => {
    const [profileRes, expRes, postsRes] = await Promise.all([
      supabase.from("scout_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("scout_experiences").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
      (supabase as any).from("scout_posts").select("*").eq("user_id", userId).eq("is_archived", false).order("created_at", { ascending: false }).limit(10),
    ]);

    let data = profileRes.data;
    if (!data && !profileRes.error && !readOnly) {
      const { data: newData } = await supabase
        .from("scout_profiles")
        .insert({ user_id: userId, first_name: "", last_name: "" })
        .select("*")
        .single();
      data = newData;
    }

    if (data) { setProfile(data); setForm(data); }
    if (expRes.data) { setExperiences(expRes.data); setExpForms(expRes.data); }
    if (postsRes.data) { setPosts(postsRes.data); }
    setLoading(false);
  };

  const handlePostSubmit = async () => {
    if (!newPostContent.trim()) return;
    if (!readOnly && viewerLocked) {
      toast({ title: ts.accountPendingTitle, description: ts.accountPendingDesc, variant: "destructive" });
      return;
    }
    setPostingActivity(true);
    try {
      let imageUrl: string | null = null;
      if (newPostImage) {
        const ext = newPostImage.name.split(".").pop();
        const path = `${userId}/post-${Date.now()}.${ext}`;
        await supabase.storage.from("avatars").upload(path, newPostImage, { upsert: true });
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
      const { error } = await supabase.from("scout_posts").insert({
        user_id: userId,
        content: newPostContent.trim(),
        image_url: imageUrl,
      });
      if (error) throw error;
      setNewPostContent("");
      setNewPostImage(null);
      setNewPostImagePreview(null);
      const { data: refreshed } = await (supabase as any).from("scout_posts").select("*").eq("user_id", userId).eq("is_archived", false).order("created_at", { ascending: false }).limit(10);
      if (refreshed) setPosts(refreshed);
      notifyProfileUpdated();
      toast({ title: ts.postPublished });
    } catch (err: any) {
      const isRlsError = typeof err?.message === "string" && err.message.includes("row-level security policy");
      toast({
        title: isRlsError ? ts.accountPendingTitle : t.dashboard.tests.uploadErrorTitle,
        description: isRlsError ? ts.accountPendingDesc : err.message,
        variant: "destructive",
      });
    } finally {
      setPostingActivity(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    await (supabase as any).from("scout_posts").update({ deleted_at: new Date().toISOString() }).eq("id", postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    notifyProfileUpdated();
  };

  const handlePostImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setNewPostImage(file); setNewPostImagePreview(URL.createObjectURL(file)); }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); }
  };

  const updateForm = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const updateExp = (index: number, key: string, value: any) => {
    setExpForms(prev => prev.map((exp, i) => i === index ? { ...exp, [key]: value } : exp));
  };

  const addExperience = () => {
    setExpForms(prev => [...prev, { user_id: userId, organization: "", role: "", sort_order: prev.length }]);
  };

  const removeExperience = (index: number) => {
    setExpForms(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveHeader = async () => {
    setSaving(true);
    try {
      let photoUrl = form.photo_url;
      let coverUrl = form.cover_photo_url;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${userId}/scout-avatar.${ext}`;
        const { error: avatarError } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        if (avatarError) throw avatarError;
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `${userId}/scout-cover.${ext}`;
        const { error: coverError } = await supabase.storage.from("avatars").upload(path, coverFile, { upsert: true });
        if (coverError) throw coverError;
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        coverUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("scout_profiles").update({
        first_name: form.first_name,
        last_name: form.last_name,
        title: form.title,
        organization: form.organization,
        city: (form as any).city,
        country: form.country,
        photo_url: photoUrl,
        cover_photo_url: coverUrl,
      }).eq("user_id", userId);
      if (error) throw error;

      toast({ title: t.dashboard.profile.profileUpdated });
      setEditingSection(null);
      setAvatarFile(null);
      setCoverFile(null);
      notifyProfileUpdated();
      fetchData();
    } catch (err: any) {
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAbout = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("scout_profiles").update({
        bio: form.bio,
        skills: form.skills,
      }).eq("user_id", userId);
      if (error) throw error;

      toast({ title: ts.aboutUpdated });
      setEditingSection(null);
      notifyProfileUpdated();
      fetchData();
    } catch (err: any) {
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExperience = async () => {
    setSaving(true);
    try {
      const existingIds = experiences.map(e => e.id);
      const keptIds = expForms.filter(e => e.id).map(e => e.id!);
      const removedIds = existingIds.filter(id => !keptIds.includes(id));
      if (removedIds.length > 0) {
        const { error: deleteError } = await supabase.from("scout_experiences").delete().in("id", removedIds);
        if (deleteError) throw deleteError;
      }

      for (let i = 0; i < expForms.length; i++) {
        const exp = expForms[i];
        const expPayload = {
          user_id: userId,
          organization: exp.organization || "",
          role: exp.role || "",
          location: exp.location,
          start_date: exp.start_date,
          end_date: exp.end_date,
          description: exp.description,
          skills: exp.skills,
          sort_order: i,
        };
        if (exp.id) {
          const { error: updateError } = await supabase.from("scout_experiences").update(expPayload).eq("id", exp.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase.from("scout_experiences").insert(expPayload);
          if (insertError) throw insertError;
        }
      }

      toast({ title: ts.experienceUpdated });
      setEditingSection(null);
      notifyProfileUpdated();
      fetchData();
    } catch (err: any) {
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-500"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const photoSrc = avatarPreview || profile?.photo_url;
  const coverSrc = coverPreview || profile?.cover_photo_url;
  const skillsArray = form.skills || [];

  if (!readOnly && showFollowersList) {
    return (
      <FollowersList
        followers={followers}
        onRemove={removeFollower}
        onViewProfile={() => {}}
        onClose={() => setShowFollowersList(false)}
        isLocked={viewerLocked}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-0 lg:p-6 -mx-4 lg:mx-0 w-[calc(100%+2rem)] lg:w-auto">
      {!readOnly && viewerLocked && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">
              {ts.accountPendingTitle}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {ts.accountPendingDesc}
            </p>
          </div>
        </div>
      )}
      {/* ===== HEADER CARD (LinkedIn-style) ===== */}
      <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
        {/* Cover Photo */}
        <div className="relative h-40 sm:h-52 bg-gradient-to-r from-orange-200 via-orange-100 to-gray-100 overflow-hidden">
          {coverSrc && <img src={coverSrc} alt="Cover" className="w-full h-full object-cover" />}
          {!coverSrc && (
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, #f97316 1px, transparent 0)`,
              backgroundSize: '30px 30px'
            }} />
          )}
          {editingSection === "header" && (
            <label className="absolute top-3 right-3 bg-white/80 rounded-lg p-2 cursor-pointer hover:bg-white transition-colors">
              <Camera className="h-5 w-5 text-gray-900" />
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
            </label>
          )}
        </div>

        {/* Profile Info Section */}
        <div className="relative px-4 sm:px-6 pb-6">
          {/* Avatar - overlapping cover */}
          <div className="relative -mt-16 sm:-mt-20 mb-4">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-white overflow-hidden bg-gray-100 shadow-lg">
              {photoSrc ? (
                <img src={photoSrc} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  <Camera className="h-10 w-10" />
                </div>
              )}
            </div>
            {editingSection === "header" && (
              <label className="absolute bottom-1 left-20 sm:left-24 bg-orange-500 rounded-full p-2 cursor-pointer hover:bg-orange-600 transition-colors shadow-md">
                <Camera className="h-4 w-4 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            )}
          </div>

          {/* Name & Title */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 text-center sm:text-left">
            <div className="flex-1">
              {/* Info tooltip for header */}
              {!readOnly && editingSection !== "header" && (
                <div className="mb-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-gray-500 hover:text-orange-500 transition-colors" aria-label={ts.headerTipsAria}>
                        <Info className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" collisionPadding={16} className="w-[calc(100vw-32px)] max-w-80 text-sm bg-white border-gray-200">
                      <p className="font-semibold text-gray-900 mb-2">{ts.headerTipsTitle}</p>
                      <ul className="list-disc pl-4 space-y-1 text-gray-500">
                        <li>{ts.headerTip1}</li>
                        <li>{ts.headerTip2}</li>
                        <li>{ts.headerTip3}</li>
                        <li>{ts.headerTip4}</li>
                        <li>{ts.headerTip5}</li>
                      </ul>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              {editingSection === "header" ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input value={form.first_name || ""} onChange={e => updateForm("first_name", e.target.value)} placeholder={t.dashboard.profile.firstName} className="bg-gray-100 border-gray-300 text-gray-900 font-display text-xl h-auto py-1" />
                    <Input value={form.last_name || ""} onChange={e => updateForm("last_name", e.target.value)} placeholder={t.dashboard.profile.lastName} className="bg-gray-100 border-gray-300 text-gray-900 font-display text-xl h-auto py-1" />
                  </div>
                  <Input value={form.title || ""} onChange={e => updateForm("title", e.target.value)} placeholder={ts.titlePlaceholder} className="bg-gray-100 border-gray-300 text-gray-900 text-sm" />
                  <Input value={form.organization || ""} onChange={e => updateForm("organization", e.target.value)} placeholder={ts.organizationPlaceholder} className="bg-gray-100 border-gray-300 text-gray-900 text-sm" />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input value={(form as any).city || ""} onChange={e => updateForm("city" as any, e.target.value)} placeholder={ts.cityPlaceholder} className="bg-gray-100 border-gray-300 text-gray-900 text-sm flex-1" />
                    <Input value={form.country || ""} onChange={e => updateForm("country", e.target.value)} placeholder={ts.countryPlaceholder} className="bg-gray-100 border-gray-300 text-gray-900 text-sm flex-1" />
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="font-display text-3xl sm:text-4xl text-gray-900 tracking-wide">
                    {profile?.first_name || profile?.last_name
                      ? `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()
                      : t.dashboard.profile.completeProfile}
                  </h1>
                  {profile?.title && (
                    <p className="text-gray-700 font-body text-base mt-1">
                      {profile.title}
                      {profile.organization && <span> @{profile.organization}</span>}
                    </p>
                  )}
                  {((profile as any)?.city || profile?.country) && (
                    <p className="flex items-center justify-center sm:justify-start gap-1 text-gray-500 text-sm font-body mt-1">
                      <MapPin className="h-4 w-4" />
                      {[(profile as any)?.city, profile?.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                </>
              )}
              {/* Follower count */}
              {editingSection !== "header" && (
                <div className="mt-2">
                  <button
                    onClick={() => !readOnly && setShowFollowersList(!showFollowersList)}
                    className={`flex items-center justify-center sm:justify-start gap-1.5 text-sm font-body w-full sm:w-auto ${!readOnly ? "hover:text-orange-500 cursor-pointer" : "cursor-default"} transition-colors`}
                  >
                    <Users className="h-4 w-4 text-green-500" />
                    <span className="font-semibold text-gray-900">{followerCount}</span>
                    <span className="text-gray-500">{ts.followersWord}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right side: Edit button above Organization badge */}
            <div className="flex flex-col items-center sm:items-end gap-2">
              {!readOnly && editingSection !== "header" && (
                <button
                  data-tour="profile-edit"
                  onClick={() => setEditingSection("header")}
                  className="group text-gray-900 hover:text-gray-400 transition-colors p-1"
                  aria-label={ts.editAria}
                >
                  <Edit2 className="h-4 w-4 stroke-[2.5] group-hover:stroke-[1.5]" />
                </button>
              )}
              {editingSection !== "header" && profile?.organization && (
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                  <Building2 className="h-5 w-5 text-orange-500" />
                  <span className="text-sm font-body text-gray-900">{profile.organization}</span>
                </div>
              )}
            </div>
            {/* Action buttons for readOnly */}
            {readOnly && editingSection !== "header" && (
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2 sm:mt-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          onClick={(e) => { e.stopPropagation(); onNavigateToChat ? onNavigateToChat(userId) : setShowMessageDialog(true); }}
                          size="sm"
                          disabled={followStatus !== "accepted" || viewerLocked}
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-body gap-2 disabled:opacity-50"
                        >
                          {followStatus !== "accepted" ? <Lock className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                          {ts.messageBtn}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {followStatus !== "accepted" && (
                      <TooltipContent>
                        {ts.messageDisabledTooltip}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
                <Button
                  onClick={(e) => { e.stopPropagation(); toggleFollow(); }}
                  size="sm"
                  disabled={followLoading || viewerLocked}
                  className={`font-body gap-2 ${
                    followStatus === "accepted"
                      ? "bg-white border border-gray-200 text-gray-900 hover:bg-gray-50"
                      : followStatus === "pending"
                        ? "bg-white border border-purple-600 text-purple-600 hover:bg-purple-50"
                        : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                  }`}
                >
                  {followLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : followStatus === "accepted" ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {followStatus === "accepted" ? ts.followingBtn : followStatus === "pending" ? ts.requestSentBtn : ts.followBtn}
                </Button>
              </div>
            )}
          </div>

          {/* Save button for header */}
          {!readOnly && editingSection === "header" && (
            <div className="flex gap-3 mt-4">
              <Button onClick={handleSaveHeader} disabled={saving} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-body">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? "..." : t.dashboard.profile.save}
              </Button>
            </div>
          )}
        </div>

      </div>



      {/* ===== DESPRE / BIO ===== */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl text-gray-900">{ts.aboutTitle}</h2>
            {!readOnly && <Popover>
              <PopoverTrigger asChild>
                <button className="text-gray-500 hover:text-orange-500 transition-colors" aria-label={ts.aboutTipsAria}>
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" collisionPadding={16} className="w-[calc(100vw-32px)] max-w-80 text-sm bg-white border-gray-200">
                <p className="font-semibold text-gray-900 mb-2">{ts.aboutTipsTitle}</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-500">
                  <li>{ts.aboutTip1}</li>
                  <li>{ts.aboutTip2}</li>
                  <li>{ts.aboutTip3}</li>
                  <li>{ts.aboutTip4}</li>
                  <li>{ts.aboutTip5}</li>
                </ul>
              </PopoverContent>
            </Popover>}
          </div>
          {!readOnly && editingSection !== "about" && (
            <button onClick={() => setEditingSection("about")} className="group text-gray-900 hover:text-gray-400 transition-colors p-1" aria-label={ts.editAria}>
              <Edit2 className="h-4 w-4 stroke-[2.5] group-hover:stroke-[1.5]" />
            </button>
          )}
          {!readOnly && editingSection === "about" && (
            <Button size="sm" onClick={handleSaveAbout} disabled={saving} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-body">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {saving ? "..." : t.dashboard.profile.save}
            </Button>
          )}
        </div>
        {editingSection === "about" ? (
          <Textarea
            value={form.bio || ""}
            onChange={e => updateForm("bio", e.target.value)}
            placeholder={ts.aboutPlaceholder}
            className="bg-gray-100 border-gray-300 text-gray-900 min-h-[120px]"
          />
        ) : (
          <p className="text-gray-700 font-body text-sm leading-relaxed whitespace-pre-line">
            {profile?.bio || <span className="italic text-gray-500">{t.dashboard.profile.noDescription}</span>}
          </p>
        )}

        {/* Skills */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-5 w-5 text-orange-500" />
            <h3 className="font-display text-lg text-gray-900">{ts.topSkillsTitle}</h3>
            {!readOnly && <Popover>
              <PopoverTrigger asChild>
                <button className="text-gray-500 hover:text-orange-500 transition-colors" aria-label={ts.skillsTipsAria}>
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" collisionPadding={16} className="w-[calc(100vw-32px)] max-w-80 text-sm bg-white border-gray-200">
                <p className="font-semibold text-gray-900 mb-2">{ts.skillsTipsTitle}</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-500">
                  <li>{ts.skillTip1}</li>
                  <li>{ts.skillTip2}</li>
                  <li>{ts.skillTip3}</li>
                  <li>{ts.skillTip4}</li>
                </ul>
              </PopoverContent>
            </Popover>}
          </div>
          {editingSection === "about" ? (
            <SkillsEditor skills={form.skills || []} onChange={(skills) => updateForm("skills", skills)} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {skillsArray.length > 0 ? skillsArray.map((skill, i) => (
                <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-body">
                  {skill}
                </span>
              )) : (
                <span className="text-gray-500 italic text-sm">{ts.noSkillsAdded}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== RAPOARTE JUCĂTORI ===== */}
      <PlayerReportsSection userId={userId} readOnly={readOnly} />

      {/* ===== JUCĂTORI REPREZENTAȚI ===== */}
      <RepresentedPlayersSection userId={userId} readOnly={readOnly} />

      {/* ===== ACTIVITATE ===== */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl text-gray-900">{ts.activityTitle}</h2>
            {!readOnly && <Popover>
              <PopoverTrigger asChild>
                <button className="text-gray-500 hover:text-orange-500 transition-colors" aria-label={ts.activityTipsAria}>
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" collisionPadding={16} className="w-[calc(100vw-32px)] max-w-80 text-sm bg-white border-gray-200">
                <p className="font-semibold text-gray-900 mb-2">{ts.activityTipsTitle}</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-500">
                  <li>{ts.activityTip1}</li>
                  <li>{ts.activityTip2}</li>
                  <li>{ts.activityTip3}</li>
                  <li>{ts.activityTip4}</li>
                  <li>{ts.activityTip5}</li>
                </ul>
              </PopoverContent>
            </Popover>}
          </div>
        </div>
        <p className="text-gray-500 text-sm font-body mb-4">{posts.length} {ts.postsCountSuffix}</p>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {([
            { key: "all" as const, label: ts.filterAll },
            { key: "posts" as const, label: ts.filterPosts },
            { key: "images" as const, label: ts.filterImages },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActivityFilter(tab.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-body transition-colors border ${
                activityFilter === tab.key
                  ? "bg-orange-500 text-white border-orange-500"
                  : "border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* New post form (only for own profile) */}
        {!readOnly && (
          <div className="mb-6 border border-gray-200 rounded-xl p-4">
            {viewerLocked && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-3">
                <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700">{ts.accountPendingDesc}</p>
              </div>
            )}
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                {photoSrc ? (
                  <img src={photoSrc} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <Camera className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <Textarea
                  value={newPostContent}
                  onChange={e => setNewPostContent(e.target.value)}
                  placeholder={ts.writePostPlaceholder}
                  className="bg-transparent border-none text-gray-900 text-sm min-h-[60px] p-0 resize-none focus-visible:ring-0"
                  disabled={viewerLocked}
                />
                {newPostImagePreview && (
                  <div className="relative mt-2 inline-block">
                    <img src={newPostImagePreview} alt="Preview" className="max-h-32 rounded-lg" />
                    <button onClick={() => { setNewPostImage(null); setNewPostImagePreview(null); }} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                  <label className={`text-gray-500 transition-colors ${viewerLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:text-orange-500"}`}>
                    <Image className="h-5 w-5" />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePostImageChange} disabled={viewerLocked} />
                  </label>
                  <Button
                    size="sm"
                    onClick={handlePostSubmit}
                    disabled={postingActivity || !newPostContent.trim() || viewerLocked}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-body"
                  >
                    {postingActivity ? <Loader2 className="h-4 w-4 animate-spin" /> : viewerLocked ? <><Lock className="h-4 w-4 mr-1" />{ts.publishBtn}</> : <><Send className="h-4 w-4 mr-1" />{ts.publishBtn}</>}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Posts grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(activityFilter === "all" ? posts : activityFilter === "images" ? posts.filter(p => p.image_url) : posts.filter(p => !p.image_url)).map(post => (
            <div key={post.id} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Post header */}
              <div className="flex items-start gap-3 p-4 pb-2">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                  {photoSrc ? (
                    <img src={photoSrc} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <Camera className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body font-semibold text-gray-900 text-sm">
                    {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="text-gray-500 text-xs font-body truncate">{profile?.title}</p>
                  <p className="text-gray-500 text-xs font-body">
                    {new Date(post.created_at).toLocaleDateString(LOCALE_BY_LANG[lang], { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {!readOnly && (
                  <button onClick={() => handleDeletePost(post.id)} className="text-gray-500 hover:text-destructive transition-colors p-1">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Post content */}
              <div className="px-4 pb-3">
                <p className="text-gray-700 font-body text-sm whitespace-pre-line line-clamp-4">{post.content}</p>
              </div>

              {/* Post image */}
              {post.image_url && (
                <div className="w-full">
                  <SignedImg src={post.image_url} alt="" className="w-full object-cover max-h-64" />
                </div>
              )}

              {/* Post actions */}
              <div className="flex items-center justify-around border-t border-gray-200 px-4 py-2">
                <button className="flex items-center gap-1.5 text-gray-500 hover:text-orange-500 text-sm font-body transition-colors py-1.5">
                  <ThumbsUp className="h-4 w-4" /> {ts.likeBtn}
                </button>
                <button className="flex items-center gap-1.5 text-gray-500 hover:text-orange-500 text-sm font-body transition-colors py-1.5">
                  <MessageSquare className="h-4 w-4" /> {ts.commentBtn}
                </button>
                <button className="flex items-center gap-1.5 text-gray-500 hover:text-orange-500 text-sm font-body transition-colors py-1.5">
                  <Share2 className="h-4 w-4" /> {ts.shareBtn}
                </button>
              </div>
            </div>
          ))}
        </div>

        {posts.length === 0 && (
          <p className="text-gray-500 italic text-sm font-body text-center py-4">{ts.noPostsYet}</p>
        )}
      </div>

      {/* ===== EXPERIENȚĂ ===== */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl text-gray-900">{ts.experienceTitle}</h2>
            {!readOnly && <Popover>
              <PopoverTrigger asChild>
                <button className="text-gray-500 hover:text-orange-500 transition-colors" aria-label={ts.experienceTipsAria}>
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" collisionPadding={16} className="w-[calc(100vw-32px)] max-w-80 text-sm bg-white border-gray-200">
                <p className="font-semibold text-gray-900 mb-2">{ts.experienceTipsTitle}</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-500">
                  <li>{ts.expTip1}</li>
                  <li>{ts.expTip2}</li>
                  <li>{ts.expTip3}</li>
                  <li>{ts.expTip4}</li>
                  <li>{ts.expTip5}</li>
                </ul>
              </PopoverContent>
            </Popover>}
          </div>
          <div className="flex items-center gap-2">
            {editingSection === "experience" && (
              <>
                <Button variant="outline" size="sm" onClick={addExperience} className="text-purple-600 border-purple-300 hover:bg-purple-50">
                  <Plus className="h-4 w-4 mr-1" /> {t.dashboard.profile.addBtn}
                </Button>
                <Button size="sm" onClick={handleSaveExperience} disabled={saving} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-body">
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  {saving ? "..." : t.dashboard.profile.save}
                </Button>
              </>
            )}
            {!readOnly && editingSection !== "experience" && (
              <button onClick={() => setEditingSection("experience")} className="group text-gray-900 hover:text-gray-400 transition-colors p-1" aria-label={ts.editAria}>
                <Edit2 className="h-4 w-4 stroke-[2.5] group-hover:stroke-[1.5]" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {expForms.length === 0 && editingSection !== "experience" && (
            <p className="text-gray-500 italic text-sm font-body">{ts.noExperienceYet}</p>
          )}
          {expForms.map((exp, index) => (
            <div key={exp.id || `new-${index}`} className="flex gap-4">
              {/* Icon */}
              <div className="flex-shrink-0 mt-1">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-orange-500" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {editingSection === "experience" ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input value={exp.role || ""} onChange={e => updateExp(index, "role", e.target.value)} placeholder={ts.rolePlaceholder} className="bg-gray-100 border-gray-300 text-gray-900 text-sm flex-1" />
                      <Button variant="ghost" size="icon" onClick={() => removeExperience(index)} className="text-destructive hover:text-destructive/80 flex-shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input value={exp.organization || ""} onChange={e => updateExp(index, "organization", e.target.value)} placeholder={ts.organizationPlaceholder} className="bg-gray-100 border-gray-300 text-gray-900 text-sm" />
                    <Input value={exp.location || ""} onChange={e => updateExp(index, "location", e.target.value)} placeholder={ts.locationPlaceholder} className="bg-gray-100 border-gray-300 text-gray-900 text-sm" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-900 font-medium">{ts.startDateLabel}</Label>
                        <Input
                          type="date"
                          value={exp.start_date?.match(/^\d{4}-\d{2}-\d{2}$/) ? exp.start_date : ""}
                          onChange={e => updateExp(index, "start_date", e.target.value)}
                          className="bg-gray-100 border-gray-300 text-gray-900"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-900 font-medium">{ts.endDateLabel}</Label>
                        <Input
                          type="date"
                          value={exp.end_date?.match(/^\d{4}-\d{2}-\d{2}$/) ? exp.end_date : ""}
                          min={exp.start_date?.match(/^\d{4}-\d{2}-\d{2}$/) ? exp.start_date : undefined}
                          onChange={e => updateExp(index, "end_date", e.target.value)}
                          disabled={exp.end_date === "Prezent"}
                          className="bg-gray-100 border-gray-300 text-gray-900"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`exp-active-${index}`}
                        checked={exp.end_date === "Prezent"}
                        onCheckedChange={(checked) => updateExp(index, "end_date", checked ? "Prezent" : "")}
                      />
                      <Label htmlFor={`exp-active-${index}`} className="text-xs text-gray-900 cursor-pointer">
                        {ts.currentlyActiveLabel}
                      </Label>
                    </div>
                    <Textarea value={exp.description || ""} onChange={e => updateExp(index, "description", e.target.value)} placeholder={ts.descriptionPlaceholder} className="bg-gray-100 border-gray-300 text-gray-900 text-sm min-h-[60px]" />
                    <Input
                      value={(exp.skills || []).join(", ")}
                      onChange={e => updateExp(index, "skills", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                      placeholder={ts.skillsPlaceholder}
                      className="bg-gray-100 border-gray-300 text-gray-900 text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <h3 className="font-body font-semibold text-gray-900">{exp.role || ts.roleUnspecified}</h3>
                    <p className="text-gray-600 font-body text-sm">{exp.organization}</p>
                    <p className="text-gray-500 font-body text-xs mt-0.5">
                      {exp.start_date && <span>{formatExpDate(exp.start_date, LOCALE_BY_LANG[lang], ts.presentWord)}</span>}
                      {exp.start_date && exp.end_date && <span> – </span>}
                      {exp.end_date && <span>{formatExpDate(exp.end_date, LOCALE_BY_LANG[lang], ts.presentWord)}</span>}
                      {exp.location && <span> · {exp.location}</span>}
                    </p>
                    {exp.description && (
                      <p className="text-gray-600 font-body text-sm mt-2 whitespace-pre-line">{exp.description}</p>
                    )}
                    {exp.skills && exp.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {exp.skills.map((skill, si) => (
                          <span key={si} className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded text-xs font-body">{skill}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Extra sections: Studii, Licențe, Limbi */}
      <ScoutExtraSections userId={userId} readOnly={readOnly} />

      {/* Recomandări */}
      <RecommendationsSection
        profileUserId={userId}
        viewerUserId={viewerUserId}
        isOwner={!readOnly || viewerUserId === userId}
        profileRole="scout"
        onViewProfile={(uid, role) => setRecAuthorView({ userId: uid, role })}
      />

      {!readOnly && <PersonalAreaFooter onNavigate={onNavigate} />}

      {/* Message Dialog */}
      {readOnly && (
        <MessageDialog
          open={showMessageDialog}
          onOpenChange={setShowMessageDialog}
          recipientUserId={userId}
          recipientName={`${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()}
        />
      )}

      {/* Dialog: vizualizare profil autor recomandare */}
      <Dialog open={!!recAuthorView} onOpenChange={(open) => !open && setRecAuthorView(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {recAuthorView && (
            <Suspense fallback={<div className="flex items-center justify-center py-16"><span className="text-gray-500 text-sm">{t.dashboard.profile.loading}</span></div>}>
              {recAuthorView.role === "player"
                ? <LazyPersonalProfile userId={recAuthorView.userId} readOnly />
                : <LazyScoutPersonalProfile userId={recAuthorView.userId} readOnly />}
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScoutPersonalProfile;
