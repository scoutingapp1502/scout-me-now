import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, Edit2, MapPin, Instagram, Twitter, Youtube, Plus, Trash2, Upload, Loader2, FileText, X, Info, Calendar } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";
import PlayerStats from "./PlayerStats";
import NationalityInput from "@/components/ui/nationality-input";

type PlayerProfile = Tables<"player_profiles">;

interface PersonalProfileProps {
  userId: string;
  readOnly?: boolean;
}

const positionsBySport: Record<string, string[]> = {
  football: [
    "Portar", "Fundaș Central", "Fundaș Dreapta", "Fundaș Stânga",
    "Mijlocaș Defensiv", "Mijlocaș Central", "Mijlocaș Ofensiv",
    "Extremă Dreapta", "Extremă Stânga", "Atacant", "Atacant Fals"
  ],
  basketball: [
    "Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"
  ],
};

type TabType = "stats" | "profile" | "video";

interface TechnicalTest {
  key: string;
  label: string;
  icon: string;
  description: string;
  inputKey: string;
  uploadId: string;
  storagePath: string;
}

const basketballTests: TechnicalTest[] = [
  { key: "free_throw_shooting_video", label: "Free Throw Shooting", icon: "🏀", description: "Configurare: Jucătorul se poziționează la linia de aruncări libere.\n\nExercițiu: Timp de 60 de secunde, sportivul aruncă, își recuperează singur mingea și revine la linia de la libere pentru o nouă aruncare. Se numără câte aruncări convertite reușește.", inputKey: "_fts_video_input", uploadId: "fts-video-upload", storagePath: "free-throw-shooting" },
  { key: "star_shooting_drill_video", label: "Star Shooting Drill", icon: "🎯", description: "Configurare: 5 puncte de aruncare marcate pe teren: colțul drept, aripa stângă, aripa dreaptă, colțul stâng și vârful cheii.\n\nExercițiu: 25 de aruncări – câte 5 din fiecare punct. După fiecare aruncare, jucătorul trebuie să schimbe poziția. Exercițiul nu este cronometrat.", inputKey: "_ssd_video_input", uploadId: "ssd-video-upload", storagePath: "star-shooting-drill" },
  { key: "crossover_video", label: "Crossover", icon: "🏀", description: "Configurare: 6 jaloane, 3 pe partea dreaptă și 3 pe stânga, la distanța de 2 metri una de cealaltă.\n\nExercițiu: Executarea procedeului de cros la viteza maximă, schimbând direcția la fiecare jalon.", inputKey: "_crossover_video_input", uploadId: "crossover-video-upload", storagePath: "crossover" },
  { key: "between_the_legs_video", label: "Between the Legs", icon: "🏀", description: "Configurare: 6 jaloane, 3 pe partea dreaptă și 3 pe stânga, la distanța de 2 metri una de cealaltă.\n\nExercițiu: Executarea procedeului de trecerea mingii printre picioare la viteza maximă, schimbând direcția la fiecare jalon.", inputKey: "_btl_video_input", uploadId: "btl-video-upload", storagePath: "between-the-legs" },
  { key: "double_cross_video", label: "Double Cross", icon: "🏀", description: "Configurare: 5 jaloane pe o linie coliniară, la distanța de 3 metri unul față de celălalt.\n\nExercițiu: Executarea procedeului de dublu cros de fiecare dată când jucătorul ajunge în fața jalonului.", inputKey: "_dc_video_input", uploadId: "dc-video-upload", storagePath: "double-cross" },
  { key: "between_legs_cross_video", label: "Between the Legs Cross", icon: "🏀", description: "Configurare: 5 jaloane pe o linie coliniară, la distanța de 3 metri unul față de celălalt.\n\nExercițiu: Executarea procedeului de trecerea mingii printre picioare și apoi cross de fiecare dată când jucătorul ajunge în fața jalonului.", inputKey: "_blc_video_input", uploadId: "blc-video-upload", storagePath: "between-legs-cross" },
];

const footballTests: TechnicalTest[] = [
  { key: "control_pass_video", label: "Control și Pasă", icon: "⚽", description: "Configurare: Jucătorul stă la 5 metri de un perete sau un partener.\n\nExercițiu: Jucătorul trebuie să paseze mingea în perete și să facă prima atingere (preluarea) pentru a pregăti următoarea pasă. Se cronometrează câte repetări corecte face în 60 de secunde.", inputKey: "_cp_video_input", uploadId: "cp-video-upload", storagePath: "control-pass" },
  { key: "slalom_video", label: "Slalom printre Jaloane", icon: "⚽", description: "Configurare: 6 jaloane așezate în linie dreaptă, la o distanță de 1 metru unul de celălalt.\n\nExercițiu: Jucătorul parcurge slalomul dus-întors cât mai rapid posibil, păstrând mingea sub control.\n\nVariante de filmat: Doar piciorul drept, doar piciorul stâng și liber (ambele).", inputKey: "_slalom_video_input", uploadId: "slalom-video-upload", storagePath: "slalom" },
  { key: "precision_video", label: "Precizie", icon: "⚽", description: "Configurare: O poartă standard (sau un perete unde sunt marcate colțurile de sus/jos). Jucătorul așază mingea la 16 metri (linia careului mare).\n\nExercițiu: 5 șuturi cu piciorul drept și 5 cu piciorul stâng, încercând să lovească zonele indicate (colțurile).", inputKey: "_precision_video_input", uploadId: "precision-video-upload", storagePath: "precision" },
  { key: "coordination_video", label: "Coordonare", icon: "⚽", description: "Exercițiu: Jucătorul trebuie să mențină mingea în aer folosind picioarele, coapsele și capul.\n\nProvocare: Jucătorul trebuie să facă o secvență specifică (ex: stângul-dreptul-coapsa stângă-coapsa dreaptă-cap) de cât mai multe ori fără să scape mingea.", inputKey: "_coord_video_input", uploadId: "coord-video-upload", storagePath: "coordination" },
  { key: "long_pass_video", label: "Pasă Lungă la Punct Fix", icon: "⚽", description: "Configurare: Un cerc format din jaloane (diametru de 3 metri) la o distanță de 30 de metri de jucător.\n\nExercițiu: 5 încercări de a trimite mingea prin aer astfel încât să aterizeze în interiorul cercului.\n\nVariante de filmat: doar piciorul drept, doar piciorul stâng.", inputKey: "_lp_video_input", uploadId: "lp-video-upload", storagePath: "long-pass" },
];

const getTechnicalTestsBySport = (sport: string | null | undefined): TechnicalTest[] => {
  if (sport === "basketball") return basketballTests;
  if (sport === "football") return footballTests;
  return footballTests; // default
};

type EditingSection = "header" | "stats" | "technical" | "physical" | "agent" | "about" | "palmares" | "video" | null;

interface CareerEntry {
  id?: string;
  team_name: string;
  start_date: string;
  end_date: string;
  currently_active: boolean;
  description: string;
}

const PersonalProfile = ({ userId, readOnly = false }: PersonalProfileProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<PlayerProfile>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("stats");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [careerEntries, setCareerEntries] = useState<CareerEntry[]>([]);
  const currentSport = (form as any).sport || (profile as any)?.sport || "football";

  useEffect(() => {
    fetchProfile();
    fetchCareerEntries();
  }, [userId]);

  const fetchCareerEntries = async () => {
    const { data } = await supabase
      .from("player_career_entries")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (data) {
      setCareerEntries(data.map((e: any) => ({
        id: e.id,
        team_name: e.team_name || "",
        start_date: e.start_date || "",
        end_date: e.end_date || "",
        currently_active: e.currently_active || false,
        description: e.description || "",
      })));
    }
  };

  const fetchProfile = async () => {
    let { data, error } = await supabase
      .from("player_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data && !error && !readOnly) {
      // Auto-create profile if it doesn't exist (only for own profile)
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
          video_descriptions: (form as any).video_descriptions,
          about_documents: form.about_documents,
          palmares_documents: form.palmares_documents,
          sport: (form as any).sport,
          star_shooting_drill: (form as any).star_shooting_drill,
          star_shooting_drill_video: (form as any).star_shooting_drill_video,
          crossover_video: (form as any).crossover_video,
          between_the_legs_video: (form as any).between_the_legs_video,
          double_cross_video: (form as any).double_cross_video,
          between_legs_cross_video: (form as any).between_legs_cross_video,
          free_throw_shooting_video: (form as any).free_throw_shooting_video,
        };

      let error;
      if (profile) {
        ({ error } = await supabase
          .from("player_profiles")
          .update(payload as any)
          .eq("user_id", userId));
      } else {
        ({ error } = await supabase
          .from("player_profiles")
          .insert({ ...payload, user_id: userId } as any));
      }

      if (error) throw error;

      // Save career entries if editing about section
      if (editingSection === "about") {
        // Delete existing entries
        await supabase.from("player_career_entries").delete().eq("user_id", userId);
        // Insert new entries
        if (careerEntries.length > 0) {
          const entries = careerEntries.map((e, i) => ({
            user_id: userId,
            team_name: e.team_name,
            start_date: e.start_date || null,
            end_date: e.currently_active ? null : (e.end_date || null),
            currently_active: e.currently_active,
            description: e.description || null,
            sort_order: i,
          }));
          const { error: careerError } = await supabase.from("player_career_entries").insert(entries);
          if (careerError) throw careerError;
        }
      }

      toast({ title: t.dashboard.profile.profileUpdated });
      setEditingSection(null);
      setAvatarFile(null);
      window.location.reload();
    } catch (err: any) {
      toast({ title: t.dashboard.profile.error, description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const SectionEditButton = ({ section }: { section: EditingSection }) => {
    if (readOnly || !section) return null;
    const isEditing = editingSection === section;
    return (
      <button
        onClick={() => isEditing ? handleSave() : setEditingSection(section)}
        disabled={saving}
        className="text-muted-foreground hover:text-primary transition-colors p-1"
        aria-label={isEditing ? "Salvează" : "Editează"}
      >
        {isEditing ? (saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-primary" />) : <Edit2 className="h-4 w-4" />}
      </button>
    );
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
    <div className="max-w-4xl mx-auto space-y-0 overflow-hidden">
      {/* Header / Hero */}
      <div className="relative bg-gradient-to-br from-sidebar to-sidebar-accent rounded-t-xl overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)`,
          backgroundSize: '30px 30px'
        }} />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 p-4 sm:p-8">
          {/* Info */}
          <div className="flex-1 min-w-0 w-full text-center sm:text-left order-2 sm:order-1">
            {editingSection === "header" ? (
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <Input value={form.first_name || ""} onChange={(e) => updateForm("first_name", e.target.value)} placeholder={t.dashboard.profile.firstName} className="bg-sidebar-accent border-sidebar-border text-white font-display text-lg sm:text-2xl h-auto py-1 min-w-0" />
                <Input value={form.last_name || ""} onChange={(e) => updateForm("last_name", e.target.value)} placeholder={t.dashboard.profile.lastName} className="bg-sidebar-accent border-sidebar-border text-white font-display text-lg sm:text-2xl h-auto py-1 min-w-0" />
              </div>
            ) : (
            <h1 className="font-display text-3xl sm:text-5xl text-white tracking-wide uppercase">
                {profile?.first_name || profile?.last_name
                  ? `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()
                  : t.dashboard.profile.completeProfile}
              </h1>
            )}

            {editingSection === "header" ? (
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <Select value={form.position || ""} onValueChange={(v) => updateForm("position", v)}>
                  <SelectTrigger className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground w-full sm:w-48">
                    <SelectValue placeholder={t.dashboard.profile.position} />
                    <SelectValue placeholder="Poziție" />
                  </SelectTrigger>
                  <SelectContent>
                    {(positionsBySport[form.sport || profile?.sport || "football"] || positionsBySport["football"]).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={form.current_team || ""} onChange={(e) => updateForm("current_team", e.target.value)} placeholder={t.dashboard.profile.currentTeam} className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground w-full sm:w-48 min-w-0" />
              </div>
            ) : (
              <p className="text-muted-foreground font-body text-sm sm:text-base mt-1">
                {form.position ? <span className="text-primary font-semibold">{form.position}</span> : (readOnly ? null : <span className="text-muted-foreground italic">{t.dashboard.profile.addPosition}</span>)}
                {form.current_team && <span> · {form.current_team}</span>}
                {(form as any).sport && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-body uppercase">{(form as any).sport}</span>}
              </p>
            )}

            {/* Nationality, DOB & Social icons */}
            {editingSection !== "header" && (
              <div className="flex items-center justify-center sm:justify-start gap-6 mt-4 pt-3 border-t border-border/30 flex-wrap">
                <div className="flex flex-col">
                  <span className="text-xs text-primary font-body uppercase tracking-wide">{t.dashboard.profile.nationality}</span>
                  <span className="text-sm font-semibold text-white font-body mt-0.5">
                    {profile?.nationality || (readOnly ? "" : <span className="italic text-muted-foreground font-normal">{t.dashboard.profile.addNationality || "Adaugă naționalitate"}</span>)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-primary font-body uppercase tracking-wide">{t.dashboard.profile.birthDate}</span>
                  <span className="text-sm font-semibold text-white font-body mt-0.5">
                    {profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : (readOnly ? "" : <span className="italic text-muted-foreground font-normal">{t.dashboard.profile.addDob || "Adaugă data nașterii"}</span>)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-primary font-body uppercase tracking-wide">{t.dashboard.profile.addSocial || "Rețele de socializare"}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {profile?.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="text-white hover:text-primary transition-colors"><Instagram className="h-5 w-5" /></a>}
                    {profile?.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="text-white hover:text-primary transition-colors"><Twitter className="h-5 w-5" /></a>}
                    {!profile?.instagram_url && !profile?.twitter_url && !readOnly && <span className="text-muted-foreground italic text-sm font-body font-normal">—</span>}
                  </div>
                </div>
              </div>
            )}
            {editingSection === "header" && (
              <div className="flex flex-col gap-2 mt-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <NationalityInput value={form.nationality || ""} onChange={(val) => updateForm("nationality", val)} placeholder={t.dashboard.profile.nationality} className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs min-w-0" />
                  <Input type="date" value={form.date_of_birth || ""} onChange={(e) => updateForm("date_of_birth", e.target.value)} placeholder={t.dashboard.profile.birthDate} className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs min-w-0" />
                </div>
                <div className="flex flex-col gap-2">
                  <Input value={form.instagram_url || ""} onChange={(e) => updateForm("instagram_url", e.target.value)} placeholder="Instagram URL" className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs min-w-0" />
                  <Input value={form.twitter_url || ""} onChange={(e) => updateForm("twitter_url", e.target.value)} placeholder="Twitter/X URL" className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs min-w-0" />
                  <Input value={form.tiktok_url || ""} onChange={(e) => updateForm("tiktok_url", e.target.value)} placeholder="TikTok URL" className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs min-w-0" />
                </div>
              </div>
            )}
          </div>

          {/* Avatar */}
          <div className="relative group order-1 sm:order-2 shrink-0">
            <div className="w-24 h-24 sm:w-40 sm:h-40 rounded-xl border-2 border-primary/30 overflow-hidden bg-muted shadow-lg">
              {photoSrc ? (
                <img src={photoSrc} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Camera className="h-10 w-10" />
                </div>
              )}
            </div>
            {editingSection === "header" && (
              <label className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-primary" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            )}
          </div>

          {/* Edit pencil for header */}
          {!readOnly && (
            <div className="absolute top-3 right-3 z-10">
              <SectionEditButton section="header" />
            </div>
          )}
        </div>
      </div>

      {/* Tabs row (no edit button) */}
      <div className="flex items-stretch border-b border-border bg-card rounded-b-xl">
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
      </div>

      {/* Tab content */}
      <div className="mt-6 px-2 sm:px-6">
        {activeTab === "stats" && <StatsTab form={form} profile={profile} editingSection={editingSection} updateForm={updateForm} photoSrc={photoSrc} userId={userId} SectionEditButton={SectionEditButton} />}
        {activeTab === "profile" && <ProfileTab form={form} profile={profile} editingSection={editingSection} updateForm={updateForm} userId={userId} readOnly={readOnly} SectionEditButton={SectionEditButton} careerEntries={careerEntries} setCareerEntries={setCareerEntries} />}
        {activeTab === "video" && (
          <VideoTab
            form={form}
            profile={profile}
            editing={editingSection === "video"}
            newVideoUrl={newVideoUrl}
            setNewVideoUrl={setNewVideoUrl}
            addVideoUrl={addVideoUrl}
            removeVideoUrl={removeVideoUrl}
            updateForm={updateForm}
            SectionEditButton={SectionEditButton}
          />
        )}
      </div>
    </div>
  );
};

/* ======================== STATS TAB ======================== */
function StatsTab({ form, profile, editingSection, updateForm, photoSrc, userId, SectionEditButton }: {
  form: Partial<PlayerProfile>; profile: PlayerProfile | null; editingSection: EditingSection; updateForm: (k: string, v: any) => void; photoSrc?: string | null; userId: string; SectionEditButton: React.FC<{ section: EditingSection }>;
}) {
  const editing = editingSection === "stats";
  const editingTechnical = editingSection === "technical";
  const currentSport = (form as any).sport || (profile as any)?.sport || "football";
  const { t } = useLanguage();
  const { toast } = useToast();
  const stats = [
    { key: "speed", label: "Pro Line Drill", icon: "⚡" },
    { key: "jumping", label: "2 Foots Vertical Jump", icon: "🦘" },
    { key: "endurance", label: "Shuttle Run", icon: "💪" },
    { key: "acceleration", label: "2 Foots Vertical Jump in action", icon: "🚀" },
  ];

  const overallRating = Math.round(
    (((form as any).speed ?? 0) + ((form as any).jumping ?? 0) + ((form as any).endurance ?? 0) + ((form as any).acceleration ?? 0)) / 4
  );

  return (
    <div className="space-y-6">
      {/* FIFA card + Stat bars side by side on desktop */}
      <div className="flex flex-col lg:flex-row gap-6 items-center">
          {/* FIFA-style card - refined */}
          <div className="mx-auto lg:mx-0 relative w-[220px] shrink-0 rounded-2xl overflow-hidden shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.4)]"
            style={{
              background: 'linear-gradient(160deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.65) 60%, hsl(var(--primary) / 0.35) 100%)',
            }}
          >
            <div className="absolute inset-0 opacity-[0.07]" style={{
              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.5) 8px, rgba(255,255,255,0.5) 9px)`,
            }} />
            <div className="relative">
              <div className="flex items-start px-4 pt-4">
                <div className="flex flex-col items-center">
                  <span className="font-display text-[42px] text-primary-foreground leading-none drop-shadow-lg">{overallRating}</span>
                  <span className="font-display text-[11px] text-primary-foreground/80 uppercase tracking-[0.2em]">{profile?.position ? profile.position.substring(0, 3).toUpperCase() : "—"}</span>
                </div>
              </div>
              <div className="flex justify-center mt-1 px-5">
                <div className="w-[130px] h-[130px] rounded-xl overflow-hidden border-2 border-primary-foreground/20 shadow-lg">
                  {photoSrc ? (
                    <img src={photoSrc} alt="Player" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary-foreground/10">
                      <Camera className="h-8 w-8 text-primary-foreground/40" />
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center mt-2 pb-2 mx-4">
                <div className="border-t border-primary-foreground/20 pt-2">
                  <p className="font-display text-sm text-primary-foreground uppercase tracking-[0.15em]">{profile?.first_name || ""} {profile?.last_name || "PLAYER"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-5 pb-4">
                {[
                  { label: "PLD", value: (form as any).speed ?? 0 },
                  { label: "2FVJ", value: (form as any).jumping ?? 0 },
                  { label: "SHR", value: (form as any).endurance ?? 0 },
                  { label: "2FVJA", value: (form as any).acceleration ?? 0 },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center gap-2">
                    <span className="font-display text-lg text-primary-foreground leading-none">{stat.value}</span>
                    <span className="text-[10px] text-primary-foreground/60 font-body uppercase tracking-wider">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stat bars / edit inputs */}
          <div className="flex-1 w-full bg-card border border-border rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-display text-lg text-foreground uppercase tracking-wide">Teste Atletice</h4>
              <SectionEditButton section="stats" />
            </div>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
                {stats.map((stat) => {
                  const value = (form as any)[stat.key] ?? 0;
                  return (
                    <div key={stat.key} className="bg-muted/50 border border-border rounded-xl p-3 sm:p-4 flex flex-col items-center">
                      <p className="text-xs text-muted-foreground font-body mb-2 text-center">{stat.icon} {stat.label}</p>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={value}
                        onChange={(e) => updateForm(stat.key, Math.min(100, parseInt(e.target.value) || 0))}
                        className="text-center text-lg font-display text-white"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {stats.map((stat) => {
                    const value = (form as any)[stat.key] ?? 0;
                    const percentage = Math.min(value, 100);
                    return (
                      <div key={stat.key} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-body text-muted-foreground uppercase tracking-wide">{stat.icon} {stat.label}</span>
                          <span className="font-display text-xl text-foreground">{value}</span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${percentage}%`,
                              background: percentage >= 80
                                ? 'linear-gradient(90deg, hsl(var(--primary)), hsl(145 80% 50%))'
                                : percentage >= 50
                                  ? 'linear-gradient(90deg, hsl(var(--primary) / 0.7), hsl(var(--primary)))'
                                  : 'linear-gradient(90deg, hsl(var(--destructive) / 0.6), hsl(var(--destructive)))',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-body uppercase tracking-wide">Rating General</span>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-3xl text-primary">{overallRating}</span>
                    <span className="text-xs text-muted-foreground font-body">/100</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Teste Tehnice Specifice section */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-display text-lg text-foreground uppercase tracking-wide">Teste Tehnice Specifice</h4>
            <SectionEditButton section="technical" />
          </div>
          {editingTechnical ? (
            <div className="space-y-4">
              {getTechnicalTestsBySport(currentSport).map((test) => (
                <div key={test.key}>
                  <p className="text-xs text-muted-foreground font-body mb-2">🎥 Video {test.label}</p>
                  {(form as any)[test.key] && (
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-body truncate flex-1">{(form as any)[test.key]}</span>
                      <Button type="button" variant="ghost" size="icon" onClick={() => updateForm(test.key as any, null)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Link YouTube sau video URL"
                      value={(form as any)[test.inputKey] || ""}
                      onChange={(e) => updateForm(test.inputKey as any, e.target.value)}
                      className="text-white flex-1 min-w-0"
                    />
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => {
                      const val = (form as any)[test.inputKey]?.trim();
                      if (val) {
                        updateForm(test.key as any, val);
                        updateForm(test.inputKey as any, "");
                      }
                    }}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="relative mt-2">
                    <div className="border-2 border-dashed border-border rounded-lg p-3 sm:p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => document.getElementById(test.uploadId)?.click()}>
                      <Upload className="h-5 w-5 text-muted-foreground mx-auto" />
                      <span className="text-xs text-muted-foreground font-body block mt-1">Sau încarcă video (MP4, WebM, MOV)</span>
                    </div>
                    <input
                      id={test.uploadId}
                      type="file"
                      accept="video/mp4,video/webm,video/ogg,video/quicktime"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const ext = file.name.split(".").pop();
                        const path = `${userId}/${test.storagePath}-${Date.now()}.${ext}`;
                        const { error: uploadError } = await supabase.storage.from("player-videos").upload(path, file, { upsert: true });
                        if (uploadError) {
                          toast({ title: "Eroare", description: "Nu s-a putut încărca videoul.", variant: "destructive" });
                          return;
                        }
                        const { data: urlData } = supabase.storage.from("player-videos").getPublicUrl(path);
                        updateForm(test.key as any, urlData.publicUrl);
                        toast({ title: "Video încărcat cu succes!" });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {getTechnicalTestsBySport(currentSport).map((test) => (
                <div key={test.key}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-body text-muted-foreground uppercase tracking-wide">{test.icon} {test.label}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-muted-foreground hover:text-primary transition-colors p-1" aria-label={`Info ${test.label}`}>
                          <Info className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="text-sm font-body" side="top">
                        <p className="font-semibold mb-1">{test.icon} {test.label}</p>
                        <p className="text-muted-foreground text-xs whitespace-pre-line">{test.description}</p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {(() => {
                    const videoUrl = (form as any)[test.key] || (profile as any)?.[test.key] || "";
                    if (!videoUrl) return <p className="text-xs text-muted-foreground mt-2 font-body">Niciun video încărcat.</p>;
                    return (
                      <div className="mt-2">
                        {videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${extractYouTubeId(videoUrl)}`}
                            className="w-full aspect-video rounded-lg"
                            allowFullScreen
                          />
                        ) : (
                          <video src={videoUrl} controls className="w-full rounded-lg aspect-video" />
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>


      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {editing ? (
          <>
            <div className="bg-card border border-border rounded-xl p-4">
              <Label className="font-body text-xs text-muted-foreground">{t.dashboard.profile.goals}</Label>
              <Input type="number" value={form.goals ?? 0} onChange={(e) => updateForm("goals", parseInt(e.target.value) || 0)} className="mt-1 text-white" />
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <Label className="font-body text-xs text-muted-foreground">{t.dashboard.profile.assists}</Label>
              <Input type="number" value={form.assists ?? 0} onChange={(e) => updateForm("assists", parseInt(e.target.value) || 0)} className="mt-1 text-white" />
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <Label className="font-body text-xs text-muted-foreground">{t.dashboard.profile.matches}</Label>
              <Input type="number" value={form.matches_played ?? 0} onChange={(e) => updateForm("matches_played", parseInt(e.target.value) || 0)} className="mt-1 text-white" />
            </div>
          </>
        ) : (
          <>
            {[
              { label: t.dashboard.profile.goals, value: profile?.goals ?? 0, icon: "⚽" },
              { label: t.dashboard.profile.assists, value: profile?.assists ?? 0, icon: "🅰️" },
              { label: t.dashboard.profile.matches, value: profile?.matches_played ?? 0, icon: "🏟️" },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 sm:p-5 text-center group hover:border-primary/30 transition-colors">
                <span className="text-2xl block">{s.icon}</span>
                <p className="font-display text-3xl sm:text-4xl text-foreground mt-1">{s.value}</p>
                <p className="text-xs text-muted-foreground font-body uppercase tracking-wide mt-1">{s.label}</p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ======================== DOCUMENT UPLOAD HELPER ======================== */
function DocumentUploader({ documents, onAdd, onRemove, editing, label }: {
  documents: string[]; onAdd: (url: string) => void; onRemove: (index: number) => void; editing: boolean; label: string;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Eroare", description: "Format nesuportat. Folosește PDF, JPG, PNG sau WebP.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Eroare", description: "Fișierul trebuie să fie mai mic de 10MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("player-documents")
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("player-documents").getPublicUrl(path);
      onAdd(urlData.publicUrl);
      toast({ title: "Document încărcat cu succes!" });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const getFileName = (url: string) => {
    try {
      const parts = url.split("/");
      const raw = parts[parts.length - 1];
      // Remove timestamp prefix
      return raw.replace(/^\d+-[a-z0-9]+\./, '').length > 0 ? decodeURIComponent(raw) : raw;
    } catch { return "Document"; }
  };

  return (
    <div className="mt-3">
      <p className="text-xs text-foreground font-medium font-body mb-2">{label}</p>
      {documents.length > 0 && (
        <div className="space-y-2 mb-2">
          {documents.map((url, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    window.open(blobUrl, '_blank');
                  } catch {
                    window.open(url, '_blank');
                  }
                }}
                className="text-sm text-foreground font-body hover:text-primary truncate flex-1 text-left"
              >
                {getFileName(url)}
              </button>
              {editing && (
                <button onClick={() => onRemove(i)} className="text-destructive hover:text-destructive/80 shrink-0">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {editing && (
        <label className="block">
          <div className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
            {uploading ? (
              <><Loader2 className="h-4 w-4 text-primary animate-spin" /><span className="text-sm text-muted-foreground font-body">Se încarcă...</span></>
            ) : (
              <><Upload className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground font-body">Încarcă document (PDF, JPG, PNG, max 10MB)</span></>
            )}
          </div>
          <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      )}
    </div>
  );
}

/* ======================== PALMARES EDITOR ======================== */
function PalmaresEditor({ entry, idx, careerEntries, setCareerEntries }: {
  entry: CareerEntry; idx: number; careerEntries: CareerEntry[]; setCareerEntries: React.Dispatch<React.SetStateAction<CareerEntry[]>>;
}) {
  // Parse existing description as JSON palmares or default
  let palmares = { place: "", championship: "", category: "", year: "" };
  try {
    if (entry.description) palmares = { ...palmares, ...JSON.parse(entry.description) };
  } catch { /* old free-text, ignore */ }

  const updatePalmares = (field: string, value: string) => {
    const updated = [...careerEntries];
    const newPalmares = { ...palmares, [field]: value };
    updated[idx] = { ...entry, description: JSON.stringify(newPalmares) };
    setCareerEntries(updated);
  };

  const placeOptions = ["Locul 1", "Locul 2", "Locul 3"];
  const championshipOptions = ["Campionat Municipal", "Campionat Regional", "Campionat Național"];
  const categoryOptions = ["U12", "U13", "U14", "U15", "U16", "U17", "U18", "U19", "U21", "Seniori"];

  const [customPlace, setCustomPlace] = useState(palmares.place && !placeOptions.includes(palmares.place));
  const [customChampionship, setCustomChampionship] = useState(palmares.championship && !championshipOptions.includes(palmares.championship));
  const [customCategory, setCustomCategory] = useState(palmares.category && !categoryOptions.includes(palmares.category));

  return (
    <div className="space-y-3 border-t border-border pt-3 mt-2">
      <Label className="text-xs text-foreground font-semibold">🏆 Palmares</Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-foreground font-medium">Loc</Label>
          {customPlace ? (
            <div className="flex gap-1">
              <Input value={palmares.place} onChange={(e) => updatePalmares("place", e.target.value)} placeholder="Ex.: Locul 4" className="bg-background text-foreground placeholder:text-foreground/60" />
              <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomPlace(false); updatePalmares("place", ""); }}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <Select value={palmares.place} onValueChange={(v) => v === "__custom__" ? setCustomPlace(true) : updatePalmares("place", v)}>
              <SelectTrigger className="bg-background text-foreground"><SelectValue placeholder="Selectează..." /></SelectTrigger>
              <SelectContent>
                {placeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                <SelectItem value="__custom__">Altele...</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <Label className="text-xs text-foreground font-medium">Campionat</Label>
          {customChampionship ? (
            <div className="flex gap-1">
              <Input value={palmares.championship} onChange={(e) => updatePalmares("championship", e.target.value)} placeholder="Ex.: Campionat European" className="bg-background text-foreground placeholder:text-foreground/60" />
              <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomChampionship(false); updatePalmares("championship", ""); }}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <Select value={palmares.championship} onValueChange={(v) => v === "__custom__" ? setCustomChampionship(true) : updatePalmares("championship", v)}>
              <SelectTrigger className="bg-background text-foreground"><SelectValue placeholder="Selectează..." /></SelectTrigger>
              <SelectContent>
                {championshipOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                <SelectItem value="__custom__">Altele...</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <Label className="text-xs text-foreground font-medium">Categoria</Label>
          {customCategory ? (
            <div className="flex gap-1">
              <Input value={palmares.category} onChange={(e) => updatePalmares("category", e.target.value)} placeholder="Ex.: Open" className="bg-background text-foreground placeholder:text-foreground/60" />
              <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomCategory(false); updatePalmares("category", ""); }}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <Select value={palmares.category} onValueChange={(v) => v === "__custom__" ? setCustomCategory(true) : updatePalmares("category", v)}>
              <SelectTrigger className="bg-background text-foreground"><SelectValue placeholder="Selectează..." /></SelectTrigger>
              <SelectContent>
                {categoryOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                <SelectItem value="__custom__">Altele...</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <Label className="text-xs text-foreground font-medium">Anul</Label>
          <Input value={palmares.year} onChange={(e) => updatePalmares("year", e.target.value)} placeholder="Ex.: 2024" className="bg-background text-foreground placeholder:text-foreground/60" />
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ form, profile, editingSection, updateForm, userId, readOnly, SectionEditButton, careerEntries, setCareerEntries }: {
  form: Partial<PlayerProfile>; profile: PlayerProfile | null; editingSection: EditingSection; updateForm: (k: string, v: any) => void; userId: string; readOnly: boolean; SectionEditButton: React.FC<{ section: EditingSection }>; careerEntries: CareerEntry[]; setCareerEntries: React.Dispatch<React.SetStateAction<CareerEntry[]>>;
}) {
  const { t } = useLanguage();

  const editingPhysical = editingSection === "physical";
  const editingAgent = editingSection === "agent";
  const editingAbout = editingSection === "about";
  const editingPalmares = editingSection === "palmares";

  const aboutDocs = editingAbout ? (form.about_documents || []) : (profile?.about_documents || []);
  const palmaresDocs = editingPalmares ? (form.palmares_documents || []) : (profile?.palmares_documents || []);

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <PlayerStats userId={userId} isOwner={!readOnly} />

      {/* Physical + details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg text-foreground uppercase">{t.dashboard.profile.physicalData}</h3>
            <div className="flex items-center gap-1">
              {!readOnly && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-primary transition-colors" aria-label="Sfaturi date fizice">
                      <Info className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="text-sm font-body" side="top">
                    <p className="font-semibold mb-1">💡 Sfaturi</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                      <li>Completează datele fizice cu acuratețe</li>
                      <li>Actualizează-le periodic pentru a reflecta progresul</li>
                      <li>Scouterii verifică aceste date frecvent</li>
                    </ul>
                  </PopoverContent>
                </Popover>
              )}
              <SectionEditButton section="physical" />
            </div>
          </div>
          {editingPhysical ? (
            <div className="space-y-3">
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.heightLabel}</Label><Input type="text" inputMode="numeric" pattern="[0-9]*" value={form.height_cm ?? ""} onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault(); }} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); updateForm("height_cm", v ? parseInt(v) : null); }} className="text-white" /></div>
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.weightLabel}</Label><Input type="text" inputMode="numeric" pattern="[0-9]*" value={form.weight_kg ?? ""} onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault(); }} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); updateForm("weight_kg", v ? parseInt(v) : null); }} className="text-white" /></div>
              <div>
                <Label className="text-xs text-muted-foreground">{(form.sport || profile?.sport) === "basketball" ? t.dashboard.profile.preferredHand : t.dashboard.profile.preferredFoot}</Label>
                <Select value={form.preferred_foot || ""} onValueChange={(v) => updateForm("preferred_foot", v)}>
                  <SelectTrigger className="text-white"><SelectValue placeholder={t.dashboard.profile.selectFoot} /></SelectTrigger>
                  <SelectContent>
                    {(form.sport || profile?.sport) === "basketball" ? (
                      <>
                        <SelectItem value="Dreapta">{t.dashboard.profile.rightHand}</SelectItem>
                        <SelectItem value="Stânga">{t.dashboard.profile.leftHand}</SelectItem>
                        <SelectItem value="Ambele">{t.dashboard.profile.bothHands}</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="Drept">{t.dashboard.profile.rightFoot}</SelectItem>
                        <SelectItem value="Stâng">{t.dashboard.profile.leftFoot}</SelectItem>
                        <SelectItem value="Ambele">{t.dashboard.profile.bothFeet}</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.birthDate}</Label><Input type="date" value={form.date_of_birth || ""} onChange={(e) => updateForm("date_of_birth", e.target.value)} className="text-white" /></div>
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.nationality}</Label><NationalityInput value={form.nationality || ""} onChange={(val) => updateForm("nationality", val)} className="text-white" /></div>
            </div>
          ) : (
            <div className="space-y-3 font-body text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t.dashboard.profile.height}</span><span className="text-foreground font-semibold">{profile?.height_cm ? `${(profile.height_cm / 100).toFixed(2)}m` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t.dashboard.profile.weight}</span><span className="text-foreground font-semibold">{profile?.weight_kg ? `${profile.weight_kg}kg` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{(profile?.sport) === "basketball" ? t.dashboard.profile.preferredHand : t.dashboard.profile.preferredFoot}</span><span className="text-foreground font-semibold">{profile?.preferred_foot || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t.dashboard.profile.nationality}</span><span className="text-foreground font-semibold">{profile?.nationality || "—"}</span></div>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg text-foreground uppercase">{t.dashboard.profile.agentContact}</h3>
            <div className="flex items-center gap-1">
              {!readOnly && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-primary transition-colors" aria-label="Sfaturi contact agent">
                      <Info className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="text-sm font-body" side="top">
                    <p className="font-semibold mb-1">💡 Sfaturi</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                      <li>Adaugă datele agentului pentru contactări rapide</li>
                      <li>Verifică adresa de email să fie corectă</li>
                      <li>Include un număr de telefon activ</li>
                    </ul>
                  </PopoverContent>
                </Popover>
              )}
              <SectionEditButton section="agent" />
            </div>
          </div>
          {editingAgent ? (
            <div className="space-y-3">
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.agentName}</Label><Input value={form.agent_name || ""} onChange={(e) => updateForm("agent_name", e.target.value)} className="text-white" /></div>
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.agentEmail}</Label><Input value={form.agent_email || ""} onChange={(e) => updateForm("agent_email", e.target.value)} className="text-white" /></div>
              <div><Label className="text-xs text-muted-foreground">{t.dashboard.profile.agentPhone}</Label><Input value={form.agent_phone || ""} onChange={(e) => updateForm("agent_phone", e.target.value)} className="text-white" /></div>
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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-2xl text-foreground">{t.dashboard.profile.about}</h3>
            {!readOnly && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-muted-foreground hover:text-primary transition-colors" aria-label="Sfaturi despre">
                    <Info className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="text-sm font-body" side="top">
                  <p className="font-semibold mb-1">💡 Sfaturi</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                    <li>Descrie parcursul tău sportiv pe scurt</li>
                    <li>Menționează echipele anterioare și performanțele</li>
                    <li>Încarcă documente justificative pentru credibilitate</li>
                  </ul>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <SectionEditButton section="about" />
        </div>
        {editingAbout ? (
          <div className="space-y-4">
            {careerEntries.map((entry, idx) => (
              <div key={idx} className="bg-muted border border-border rounded-lg p-4 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => setCareerEntries(careerEntries.filter((_, i) => i !== idx))}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div>
                  <Label className="text-xs text-foreground font-medium">Echipa*</Label>
                  <Input
                    value={entry.team_name}
                    onChange={(e) => {
                      const updated = [...careerEntries];
                      updated[idx] = { ...entry, team_name: e.target.value };
                      setCareerEntries(updated);
                    }}
                    placeholder="Ex.: FC Barcelona"
                    className="bg-background"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-foreground font-medium">Data început</Label>
                    <Input
                      type="date"
                      value={entry.start_date}
                      onChange={(e) => {
                        const updated = [...careerEntries];
                        updated[idx] = { ...entry, start_date: e.target.value };
                        setCareerEntries(updated);
                      }}
                      className="bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-foreground font-medium">Data sfârșit</Label>
                    <Input
                      type="date"
                      value={entry.end_date}
                      onChange={(e) => {
                        const updated = [...careerEntries];
                        updated[idx] = { ...entry, end_date: e.target.value };
                        setCareerEntries(updated);
                      }}
                      disabled={entry.currently_active}
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`currently-active-${idx}`}
                    checked={entry.currently_active}
                    onCheckedChange={(checked) => {
                      const updated = [...careerEntries];
                      updated[idx] = { ...entry, currently_active: !!checked, end_date: checked ? "" : entry.end_date };
                      setCareerEntries(updated);
                    }}
                  />
                  <Label htmlFor={`currently-active-${idx}`} className="text-xs text-foreground cursor-pointer">
                    Activez în acest moment
                  </Label>
                </div>
                {/* Palmares structured fields */}
                <PalmaresEditor
                  entry={entry}
                  idx={idx}
                  careerEntries={careerEntries}
                  setCareerEntries={setCareerEntries}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCareerEntries([...careerEntries, { team_name: "", start_date: "", end_date: "", currently_active: false, description: "" }])}
              className="w-full text-foreground border-foreground/30 hover:text-foreground"
            >
              <Plus className="h-4 w-4 mr-1" /> Adaugă echipă
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {careerEntries.length > 0 ? (
              careerEntries.map((entry, idx) => (
                <div key={idx} className="border-l-2 border-primary/30 pl-3">
                  <p className="font-semibold text-foreground text-sm">{entry.team_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.start_date ? new Date(entry.start_date).toLocaleDateString("ro-RO", { month: "short", year: "numeric" }) : "—"}
                    {" — "}
                    {entry.currently_active ? "Prezent" : entry.end_date ? new Date(entry.end_date).toLocaleDateString("ro-RO", { month: "short", year: "numeric" }) : "—"}
                  </p>
                  {entry.description && (
                    <p className="text-xs text-foreground/70 mt-1">
                      {(() => {
                        try {
                          const p = JSON.parse(entry.description);
                          const parts = [p.place, p.championship, p.category ? `Categoria ${p.category}` : null, p.year].filter(Boolean);
                          return parts.join(" • ");
                        } catch {
                          return entry.description;
                        }
                      })()}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="italic text-muted-foreground text-sm">{t.dashboard.profile.noDescription}</p>
            )}
          </div>
        )}
        <div className="mt-4">
          <DocumentUploader
            documents={aboutDocs}
            onAdd={(url) => updateForm("about_documents", [...(form.about_documents || []), url])}
            onRemove={(i) => updateForm("about_documents", (form.about_documents || []).filter((_, idx) => idx !== i))}
            editing={editingAbout}
            label="📄 Documente atestare"
          />
        </div>
      </div>

      {/* Achievements / Palmares */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="relative bg-accent px-5 py-3 flex items-center justify-between">
          <h3 className="font-display text-xl text-accent-foreground uppercase">{t.dashboard.profile.achievements}</h3>
          <div className="flex items-center gap-1 z-10">
            {!readOnly && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-accent-foreground/60 hover:text-accent-foreground transition-colors" aria-label="Sfaturi palmares">
                    <Info className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="text-sm font-body" side="top">
                  <p className="font-semibold mb-1">💡 Sfaturi</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                    <li>Listează trofeele și premiile câștigate</li>
                    <li>Include competițiile și anul</li>
                    <li>Încarcă diplomele sau certificatele ca dovadă</li>
                  </ul>
                </PopoverContent>
              </Popover>
            )}
            <SectionEditButton section="palmares" />
          </div>
          <div className="absolute right-0 top-0 w-16 h-full bg-gradient-to-l from-accent/50 to-transparent" />
        </div>
        <div className="p-5">
          {editingPalmares ? (
            <Textarea
              value={form.palmares || ""}
              onChange={(e) => updateForm("palmares", e.target.value)}
              placeholder={t.dashboard.profile.achievementsPlaceholder}
              rows={5}
              className="text-white"
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
          <DocumentUploader
            documents={palmaresDocs}
            onAdd={(url) => updateForm("palmares_documents", [...(form.palmares_documents || []), url])}
            onRemove={(i) => updateForm("palmares_documents", (form.palmares_documents || []).filter((_, idx) => idx !== i))}
            editing={editingPalmares}
            label="🏆 Documente atestare competiții/trofee"
          />
        </div>
      </div>
    </div>
  );
}

/* ======================== VIDEO TAB ======================== */
function VideoTab({ form, profile, editing, newVideoUrl, setNewVideoUrl, addVideoUrl, removeVideoUrl, updateForm, SectionEditButton }: {
  form: Partial<PlayerProfile>; profile: PlayerProfile | null; editing: boolean;
  newVideoUrl: string; setNewVideoUrl: (v: string) => void; addVideoUrl: () => void; removeVideoUrl: (i: number) => void; updateForm: (k: string, v: any) => void; SectionEditButton: React.FC<{ section: EditingSection }>;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [newVideoDescription, setNewVideoDescription] = useState("");
  const videos = editing ? (form.video_highlights || []) : (profile?.video_highlights || []);
  const descriptions: string[] = editing ? ((form as any).video_descriptions || []) : ((profile as any)?.video_descriptions || []);

  const addVideoWithDescription = () => {
    if (!newVideoUrl.trim()) return;
    const currentVideos = form.video_highlights || [];
    const currentDescs: string[] = (form as any).video_descriptions || [];
    updateForm("video_highlights", [...currentVideos, newVideoUrl.trim()]);
    updateForm("video_descriptions", [...currentDescs, newVideoDescription.trim()]);
    setNewVideoUrl("");
    setNewVideoDescription("");
  };

  const removeVideoWithDescription = (index: number) => {
    const currentVideos = form.video_highlights || [];
    const currentDescs: string[] = (form as any).video_descriptions || [];
    updateForm("video_highlights", currentVideos.filter((_, i) => i !== index));
    updateForm("video_descriptions", currentDescs.filter((_, i) => i !== index));
  };

  const updateDescription = (index: number, value: string) => {
    const currentDescs: string[] = [...((form as any).video_descriptions || [])];
    // Ensure array is long enough
    while (currentDescs.length <= index) currentDescs.push("");
    currentDescs[index] = value;
    updateForm("video_descriptions", currentDescs);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: t.dashboard.profile.error, description: "Format video nesuportat. Folosește MP4, WebM, OGG, MOV, AVI sau MKV.", variant: "destructive" });
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast({ title: t.dashboard.profile.error, description: "Fișierul video trebuie să fie mai mic de 100MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}.${ext}`;
      const path = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("player-videos")
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("player-videos").getPublicUrl(path);
      const currentVideos = form.video_highlights || [];
      const currentDescs: string[] = (form as any).video_descriptions || [];
      updateForm("video_highlights", [...currentVideos, urlData.publicUrl]);
      updateForm("video_descriptions", [...currentDescs, ""]);

      toast({ title: "Video încărcat cu succes!" });
    } catch (err: any) {
      toast({ title: t.dashboard.profile.error, description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const isUploadedVideo = (url: string) => {
    return url.includes("player-videos") || url.match(/\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-lg text-foreground uppercase tracking-wide">Video Highlights</h4>
        <SectionEditButton section="video" />
      </div>
      {editing && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          {/* YouTube link input */}
          <div>
            <Label className="text-xs text-muted-foreground font-body mb-2 block">{t.dashboard.profile.addVideo}</Label>
            <div className="flex gap-2">
              <Input
                value={newVideoUrl}
                onChange={(e) => setNewVideoUrl(e.target.value)}
                placeholder={t.dashboard.profile.videoPlaceholder}
                className="flex-1 text-foreground"
                onKeyDown={(e) => e.key === "Enter" && addVideoWithDescription()}
              />
              <Button onClick={addVideoWithDescription} size="sm"><Plus className="h-4 w-4 mr-1" />{t.dashboard.profile.addBtn}</Button>
            </div>
          </div>
          {/* Description for new video */}
          <div>
            <Label className="text-xs text-muted-foreground font-body mb-1 block">Descriere video (opțional)</Label>
            <Textarea
              value={newVideoDescription}
              onChange={(e) => setNewVideoDescription(e.target.value)}
              placeholder="Ex: Liga 1 - Etapa 12, vs FC Steaua, gol din minutul 34..."
              rows={2}
              className="text-foreground text-sm"
            />
          </div>
          {/* File upload */}
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <div className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                {uploading ? (
                  <><Loader2 className="h-5 w-5 text-primary animate-spin" /><span className="text-sm text-muted-foreground font-body">Se încarcă...</span></>
                ) : (
                  <><Upload className="h-5 w-5 text-muted-foreground" /><span className="text-sm text-muted-foreground font-body">Încarcă video de pe calculator (MP4, WebM, MOV, max 100MB)</span></>
                )}
              </div>
              <input
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/x-matroska"
                className="hidden"
                onChange={handleVideoUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      )}

      {videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map((url, i) => {
            const youtubeId = extractYouTubeId(url);
            const isUploaded = isUploadedVideo(url);
            const description = descriptions[i] || "";
            return (
              <div key={i} className="bg-card border border-border rounded-xl overflow-hidden group relative">
                {youtubeId ? (
                  <div className="aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeId}`}
                      title={description || `Video ${i + 1}`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : isUploaded ? (
                  <div className="aspect-video">
                    <video
                      src={url}
                      controls
                      className="w-full h-full object-contain bg-black"
                      preload="metadata"
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
                {/* Description area */}
                <div className="px-4 py-3 border-t border-border">
                  {editing ? (
                    <Textarea
                      value={description}
                      onChange={(e) => updateDescription(i, e.target.value)}
                      placeholder="Descriere: competiție, adversar, stagiu meci..."
                      rows={2}
                      className="text-foreground text-xs"
                    />
                  ) : description ? (
                    <p className="text-foreground/80 font-body text-sm leading-relaxed">{description}</p>
                  ) : null}
                </div>
                {editing && (
                  <button
                    onClick={() => removeVideoWithDescription(i)}
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
