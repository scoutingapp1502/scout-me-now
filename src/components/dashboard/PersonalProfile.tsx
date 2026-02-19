import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, Edit2, MapPin, Instagram, Twitter, Youtube, Plus, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";

type PlayerProfile = Tables<"player_profiles">;

interface PersonalProfileProps {
  userId: string;
}

const positions = [
  "Portar", "Fundaș Central", "Fundaș Dreapta", "Fundaș Stânga",
  "Mijlocaș Defensiv", "Mijlocaș Central", "Mijlocaș Ofensiv",
  "Extremă Dreapta", "Extremă Stânga", "Atacant", "Atacant Fals"
];

type TabType = "stats" | "profile" | "video";

const PersonalProfile = ({ userId }: PersonalProfileProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<PlayerProfile>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("stats");
  const [newVideoUrl, setNewVideoUrl] = useState("");

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    let { data, error } = await supabase
      .from("player_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data && !error) {
      // Auto-create profile if it doesn't exist
      const { data: newData, error: insertError } = await supabase
        .from("player_profiles")
        .insert({ user_id: userId, first_name: "", last_name: "" })
        .select("*")
        .single();
      if (insertError) console.error(insertError);
      else data = newData;
    }

    if (data) {
      setProfile(data);
      setForm(data);
    }
    if (error) console.error(error);
    setLoading(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let photoUrl = form.photo_url;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${userId}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      const payload = {
          first_name: form.first_name,
          last_name: form.last_name,
          bio: form.bio,
          position: form.position,
          preferred_foot: form.preferred_foot,
          nationality: form.nationality,
          date_of_birth: form.date_of_birth,
          height_cm: form.height_cm,
          weight_kg: form.weight_kg,
          current_team: form.current_team,
          goals: form.goals,
          assists: form.assists,
          matches_played: form.matches_played,
          palmares: form.palmares,
          instagram_url: form.instagram_url,
          tiktok_url: form.tiktok_url,
          twitter_url: form.twitter_url,
          agent_name: form.agent_name,
          agent_email: form.agent_email,
          agent_phone: form.agent_phone,
          photo_url: photoUrl,
          speed: form.speed,
          jumping: form.jumping,
          endurance: form.endurance,
          acceleration: form.acceleration,
          defense: form.defense,
          career_description: form.career_description,
          video_highlights: form.video_highlights,
        };

      let error;
      if (profile) {
        ({ error } = await supabase
          .from("player_profiles")
          .update(payload)
          .eq("user_id", userId));
      } else {
        ({ error } = await supabase
          .from("player_profiles")
          .insert({ ...payload, user_id: userId }));
      }

      if (error) throw error;

      toast({ title: t.dashboard.profile.profileUpdated });
      setEditing(false);
      setAvatarFile(null);
      fetchProfile();
    } catch (err: any) {
      toast({ title: t.dashboard.profile.error, description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addVideoUrl = () => {
    if (!newVideoUrl.trim()) return;
    const current = form.video_highlights || [];
    updateForm("video_highlights", [...current, newVideoUrl.trim()]);
    setNewVideoUrl("");
  };

  const removeVideoUrl = (index: number) => {
    const current = form.video_highlights || [];
    updateForm("video_highlights", current.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground font-body">{t.dashboard.profile.loading}</div>;
  }

  const photoSrc = avatarPreview || profile?.photo_url;

  return (
    <div className="max-w-4xl mx-auto space-y-0">
      {/* Header / Hero */}
      <div className="relative bg-gradient-to-br from-sidebar to-sidebar-accent rounded-t-xl overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)`,
          backgroundSize: '30px 30px'
        }} />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 p-5 sm:p-8">
          {/* Info */}
          <div className="flex-1 text-center sm:text-left order-2 sm:order-1">
            {editing ? (
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <Input value={form.first_name || ""} onChange={(e) => updateForm("first_name", e.target.value)} placeholder={t.dashboard.profile.firstName} className="bg-sidebar-accent border-sidebar-border text-foreground font-display text-xl sm:text-2xl h-auto py-1" />
                <Input value={form.last_name || ""} onChange={(e) => updateForm("last_name", e.target.value)} placeholder={t.dashboard.profile.lastName} className="bg-sidebar-accent border-sidebar-border text-foreground font-display text-xl sm:text-2xl h-auto py-1" />
              </div>
            ) : (
            <h1 className="font-display text-3xl sm:text-5xl text-foreground tracking-wide uppercase">
                {profile?.first_name || profile?.last_name
                  ? `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()
                  : t.dashboard.profile.completeProfile}
              </h1>
            )}

            {editing ? (
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <Select value={form.position || ""} onValueChange={(v) => updateForm("position", v)}>
                  <SelectTrigger className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground w-full sm:w-48">
                    <SelectValue placeholder={t.dashboard.profile.position} />
                    <SelectValue placeholder="Poziție" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={form.current_team || ""} onChange={(e) => updateForm("current_team", e.target.value)} placeholder={t.dashboard.profile.currentTeam} className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground sm:w-48" />
              </div>
            ) : (
              <p className="text-muted-foreground font-body text-sm sm:text-base mt-1">
                {form.position ? <span className="text-primary font-semibold">{form.position}</span> : <span className="text-muted-foreground italic">{t.dashboard.profile.addPosition}</span>}
                {form.current_team && <span> · {form.current_team}</span>}
              </p>
            )}

            {/* Social icons */}
            {!editing && (
              <div className="flex items-center justify-center sm:justify-start gap-3 mt-3">
                {profile?.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors"><Instagram className="h-5 w-5" /></a>}
                {profile?.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors"><Twitter className="h-5 w-5" /></a>}
              </div>
            )}
            {editing && (
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <Input value={form.instagram_url || ""} onChange={(e) => updateForm("instagram_url", e.target.value)} placeholder="Instagram URL" className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs" />
                <Input value={form.twitter_url || ""} onChange={(e) => updateForm("twitter_url", e.target.value)} placeholder="Twitter/X URL" className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs" />
                <Input value={form.tiktok_url || ""} onChange={(e) => updateForm("tiktok_url", e.target.value)} placeholder="TikTok URL" className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs" />
              </div>
            )}
          </div>

          {/* Avatar */}
          <div className="relative group order-1 sm:order-2">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl border-2 border-primary/30 overflow-hidden bg-muted shadow-lg">
              {photoSrc ? (
                <img src={photoSrc} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Camera className="h-10 w-10" />
                </div>
              )}
            </div>
            {editing && (
              <label className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-primary" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            )}
          </div>

        </div>
      </div>

      {/* Tabs + Edit button row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center border-b border-border bg-card rounded-b-xl">
        <div className="flex flex-1 overflow-x-auto">
          {([
            { key: "stats" as TabType, label: "Stats" },
            { key: "profile" as TabType, label: "Profile" },
            { key: "video" as TabType, label: "Video" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 sm:px-6 py-3 font-display text-base sm:text-lg tracking-wide transition-colors relative whitespace-nowrap
                ${activeTab === tab.key
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-t-full" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center sm:justify-end px-4 py-2 sm:py-0">
          <Button
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
            className={editing ? "bg-primary hover:bg-primary/90 text-primary-foreground font-display text-sm sm:text-base px-4 sm:px-6 w-full sm:w-auto" : "bg-accent text-accent-foreground hover:bg-accent/90 font-display text-sm sm:text-base px-4 sm:px-6 shadow-md w-full sm:w-auto"}
          >
            {editing ? (
              <><Save className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />{saving ? "..." : t.dashboard.profile.save}</>
            ) : (
              <><Edit2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />{t.dashboard.profile.edit}</>
            )}
          </Button>
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === "stats" && <StatsTab form={form} profile={profile} editing={editing} updateForm={updateForm} />}
        {activeTab === "profile" && <ProfileTab form={form} profile={profile} editing={editing} updateForm={updateForm} />}
        {activeTab === "video" && (
          <VideoTab
            form={form}
            profile={profile}
            editing={editing}
            newVideoUrl={newVideoUrl}
            setNewVideoUrl={setNewVideoUrl}
            addVideoUrl={addVideoUrl}
            removeVideoUrl={removeVideoUrl}
          />
        )}
      </div>
    </div>
  );
};

/* ======================== STATS TAB ======================== */
function StatsTab({ form, profile, editing, updateForm }: {
  form: Partial<PlayerProfile>; profile: PlayerProfile | null; editing: boolean; updateForm: (k: string, v: any) => void;
}) {
  const { t } = useLanguage();
  const stats = [
    { key: "speed", label: t.dashboard.profile.speed, icon: "⚡" },
    { key: "jumping", label: t.dashboard.profile.jumping, icon: "🦘" },
    { key: "endurance", label: t.dashboard.profile.endurance, icon: "💪" },
    { key: "acceleration", label: t.dashboard.profile.acceleration, icon: "🚀" },
    { key: "defense", label: t.dashboard.profile.defense, icon: "🛡️" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const value = (form as any)[stat.key] ?? 0;
          const percentage = Math.min(value, 100);
          const circumference = 2 * Math.PI * 40;
          const strokeDashoffset = circumference - (percentage / 100) * circumference;

          return (
            <div key={stat.key} className="bg-card border border-border rounded-xl p-4 flex flex-col items-center">
              {editing ? (
                <div className="w-full text-center">
                  <p className="text-xs text-muted-foreground font-body mb-2">{stat.label}</p>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) => updateForm(stat.key, Math.min(100, parseInt(e.target.value) || 0))}
                    className="text-center text-lg font-display"
                  />
                </div>
              ) : (
                <>
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                      <circle
                        cx="50" cy="50" r="40" fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-display text-2xl sm:text-3xl text-foreground">{value}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-body mt-2 uppercase tracking-wide">{stat.label}</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Classic stats row */}
      <div className="grid grid-cols-3 gap-3">
        {editing ? (
          <>
            <div className="bg-card border border-border rounded-xl p-4">
              <Label className="font-body text-xs text-muted-foreground">{t.dashboard.profile.goals}</Label>
              <Input type="number" value={form.goals ?? 0} onChange={(e) => updateForm("goals", parseInt(e.target.value) || 0)} className="mt-1" />
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <Label className="font-body text-xs text-muted-foreground">{t.dashboard.profile.assists}</Label>
              <Input type="number" value={form.assists ?? 0} onChange={(e) => updateForm("assists", parseInt(e.target.value) || 0)} className="mt-1" />
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <Label className="font-body text-xs text-muted-foreground">{t.dashboard.profile.matches}</Label>
              <Input type="number" value={form.matches_played ?? 0} onChange={(e) => updateForm("matches_played", parseInt(e.target.value) || 0)} className="mt-1" />
            </div>
          </>
        ) : (
          <>
            {[
              { label: t.dashboard.profile.goals, value: profile?.goals ?? 0, icon: "⚽" },
              { label: t.dashboard.profile.assists, value: profile?.assists ?? 0, icon: "🅰️" },
              { label: t.dashboard.profile.matches, value: profile?.matches_played ?? 0, icon: "🏟️" },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                <span className="text-2xl">{s.icon}</span>
                <p className="font-display text-3xl text-foreground mt-1">{s.value}</p>
                <p className="text-xs text-muted-foreground font-body">{s.label}</p>
              </div>
            ))}
          </>
        )}
      </div>

      {/* FIFA-style card */}
      {!editing && (
        <div className="flex justify-center">
          <div className="relative w-64 bg-gradient-to-b from-primary/20 to-primary/5 border-2 border-primary/30 rounded-2xl p-5 shadow-lg">
            {/* Top accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-1 bg-primary rounded-b-full" />
            
            {/* Player name */}
            <div className="text-center mb-4 mt-1">
              <p className="font-display text-lg text-primary uppercase tracking-wider">
                {profile?.last_name || "PLAYER"}
              </p>
              <p className="text-xs text-muted-foreground font-body">{profile?.position || "—"}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                { label: "VIT", value: (form as any).speed ?? 0 },
                { label: "DET", value: (form as any).jumping ?? 0 },
                { label: "REZ", value: (form as any).endurance ?? 0 },
                { label: "ACC", value: (form as any).acceleration ?? 0 },
                { label: "APR", value: (form as any).defense ?? 0 },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-2">
                  <span className="font-display text-2xl text-foreground w-10 text-right">{stat.value}</span>
                  <span className="text-xs text-muted-foreground font-body uppercase tracking-wide">{stat.label}</span>
                </div>
              ))}
            </div>

            {/* Bottom accent */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary/50 rounded-t-full" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================== PROFILE TAB ======================== */
function ProfileTab({ form, profile, editing, updateForm }: {
  form: Partial<PlayerProfile>; profile: PlayerProfile | null; editing: boolean; updateForm: (k: string, v: any) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      {/* Physical + details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display text-lg text-foreground mb-3 uppercase">{t.dashboard.profile.physicalData}</h3>
          {editing ? (
            <div className="space-y-3">
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.heightLabel}</Label><Input type="number" value={form.height_cm ?? ""} onChange={(e) => updateForm("height_cm", parseInt(e.target.value) || null)} /></div>
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.weightLabel}</Label><Input type="number" value={form.weight_kg ?? ""} onChange={(e) => updateForm("weight_kg", parseInt(e.target.value) || null)} /></div>
              <div>
                <Label className="text-xs text-muted-foreground">{t.dashboard.profile.preferredFoot}</Label>
                <Select value={form.preferred_foot || ""} onValueChange={(v) => updateForm("preferred_foot", v)}>
                  <SelectTrigger><SelectValue placeholder={t.dashboard.profile.selectFoot} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Drept">{t.dashboard.profile.rightFoot}</SelectItem>
                    <SelectItem value="Stâng">{t.dashboard.profile.leftFoot}</SelectItem>
                    <SelectItem value="Ambele">{t.dashboard.profile.bothFeet}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.birthDate}</Label><Input type="date" value={form.date_of_birth || ""} onChange={(e) => updateForm("date_of_birth", e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.nationality}</Label><Input value={form.nationality || ""} onChange={(e) => updateForm("nationality", e.target.value)} /></div>
            </div>
          ) : (
            <div className="space-y-3 font-body text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t.dashboard.profile.height}</span><span className="text-foreground font-semibold">{profile?.height_cm ? `${(profile.height_cm / 100).toFixed(2)}m` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t.dashboard.profile.weight}</span><span className="text-foreground font-semibold">{profile?.weight_kg ? `${profile.weight_kg}kg` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t.dashboard.profile.preferredFoot}</span><span className="text-foreground font-semibold">{profile?.preferred_foot || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t.dashboard.profile.nationality}</span><span className="text-foreground font-semibold">{profile?.nationality || "—"}</span></div>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display text-lg text-foreground mb-3 uppercase">{t.dashboard.profile.agentContact}</h3>
          {editing ? (
            <div className="space-y-3">
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.agentName}</Label><Input value={form.agent_name || ""} onChange={(e) => updateForm("agent_name", e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.agentEmail}</Label><Input value={form.agent_email || ""} onChange={(e) => updateForm("agent_email", e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.agentPhone}</Label><Input value={form.agent_phone || ""} onChange={(e) => updateForm("agent_phone", e.target.value)} /></div>
            </div>
          ) : (
            <div className="font-body text-sm space-y-1">
              {profile?.agent_name ? (
                <>
                  <p className="text-foreground font-semibold">{profile.agent_name}</p>
                  {profile.agent_email && <p className="text-muted-foreground">{profile.agent_email}</p>}
                  {profile.agent_phone && <p className="text-muted-foreground">{profile.agent_phone}</p>}
                </>
              ) : (
                <p className="text-muted-foreground">{t.dashboard.profile.noAgent}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* About */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
        <h3 className="font-display text-xl text-foreground mb-3 uppercase">
          {t.dashboard.profile.about} {profile?.first_name} {profile?.last_name}
        </h3>
        {editing ? (
          <Textarea
            value={form.career_description || ""}
            onChange={(e) => updateForm("career_description", e.target.value)}
            placeholder={t.dashboard.profile.careerPlaceholder}
            rows={8}
          />
        ) : (
          <div className="space-y-0">
            {(profile?.career_description || t.dashboard.profile.noDescription).split("\n").filter(Boolean).map((line, i) => (
              <div key={i} className="py-3 border-b border-border last:border-b-0">
                <p className="text-foreground font-body text-sm leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Achievements / Palmares */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="relative bg-accent px-5 py-3">
          <h3 className="font-display text-xl text-accent-foreground uppercase">{t.dashboard.profile.achievements}</h3>
          <div className="absolute right-0 top-0 w-16 h-full bg-gradient-to-l from-accent/50 to-transparent" />
        </div>
        <div className="p-5">
          {editing ? (
            <Textarea
              value={form.palmares || ""}
              onChange={(e) => updateForm("palmares", e.target.value)}
              placeholder={t.dashboard.profile.achievementsPlaceholder}
              rows={5}
            />
          ) : (
            <div className="space-y-0">
              {(profile?.palmares || t.dashboard.profile.noAchievements).split("\n").filter(Boolean).map((line, i) => (
                <div key={i} className="py-3 border-b border-border last:border-b-0">
                  <p className="text-foreground font-body text-sm font-medium">{line}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================== VIDEO TAB ======================== */
function VideoTab({ form, profile, editing, newVideoUrl, setNewVideoUrl, addVideoUrl, removeVideoUrl }: {
  form: Partial<PlayerProfile>; profile: PlayerProfile | null; editing: boolean;
  newVideoUrl: string; setNewVideoUrl: (v: string) => void; addVideoUrl: () => void; removeVideoUrl: (i: number) => void;
}) {
  const { t } = useLanguage();
  const videos = editing ? (form.video_highlights || []) : (profile?.video_highlights || []);

  return (
    <div className="space-y-4">
      {editing && (
        <div className="bg-card border border-border rounded-xl p-4">
          <Label className="text-xs text-muted-foreground font-body mb-2 block">{t.dashboard.profile.addVideo}</Label>
          <div className="flex gap-2">
            <Input
              value={newVideoUrl}
              onChange={(e) => setNewVideoUrl(e.target.value)}
              placeholder={t.dashboard.profile.videoPlaceholder}
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && addVideoUrl()}
            />
            <Button onClick={addVideoUrl} size="sm"><Plus className="h-4 w-4 mr-1" />{t.dashboard.profile.addBtn}</Button>
          </div>
        </div>
      )}

      {videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map((url, i) => {
            const youtubeId = extractYouTubeId(url);
            return (
              <div key={i} className="bg-card border border-border rounded-xl overflow-hidden group relative">
                {youtubeId ? (
                  <div className="aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeId}`}
                      title={`Video ${i + 1}`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Youtube className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-body text-sm text-foreground truncate">{url}</span>
                  </a>
                )}
                {editing && (
                  <button
                    onClick={() => removeVideoUrl(i)}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Youtube className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-body text-sm">{t.dashboard.profile.noVideos}</p>
        </div>
      )}
    </div>
  );
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default PersonalProfile;
