import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, Edit2, MapPin, Instagram, Twitter, Youtube, Plus, Trash2, Upload, Loader2, FileText, X, Info, Calendar, GripVertical, ChevronsUpDown, Check, MessageCircle, UserPlus, UserCheck, Users, Lock } from "lucide-react";
import MessageDialog from "./MessageDialog";
import PostCard from "./PostCard";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";
import PlayerStats from "./PlayerStats";
import NationalityInput, { getDisplayNationality } from "@/components/ui/nationality-input";
import { useFollowers } from "@/hooks/useFollowers";
import FollowersList from "./FollowersList";
import AthleticTestRegistrationDialog from "./AthleticTestRegistrationDialog";
import { useTestUnlocks } from "@/hooks/useTestUnlocks";
import { Progress } from "@/components/ui/progress";
import { Lock as LockIcon, Gift } from "lucide-react";
import RecommendationsSection from "./RecommendationsSection";
import StreakBadges, { getNextBadgeMilestone } from "./StreakBadges";
import WeeklyChallengeCard from "./WeeklyChallengeCard";
import ScoutPlayerNoteDialog from "./ScoutPlayerNoteDialog";
import { ClipboardList } from "lucide-react";

type PlayerProfile = Tables<"player_profiles">;

const COUNTRY_PHONE_PREFIXES = [
  { code: "RO", prefix: "+40", label: "🇷🇴 România (+40)", maxDigits: 9 },
  { code: "IT", prefix: "+39", label: "🇮🇹 Italia (+39)", maxDigits: 10 },
  { code: "ES", prefix: "+34", label: "🇪🇸 Spania (+34)", maxDigits: 9 },
  { code: "DE", prefix: "+49", label: "🇩🇪 Germania (+49)", maxDigits: 11 },
  { code: "FR", prefix: "+33", label: "🇫🇷 Franța (+33)", maxDigits: 9 },
  { code: "GB", prefix: "+44", label: "🇬🇧 Marea Britanie (+44)", maxDigits: 10 },
  { code: "US", prefix: "+1", label: "🇺🇸 SUA (+1)", maxDigits: 10 },
  { code: "PT", prefix: "+351", label: "🇵🇹 Portugalia (+351)", maxDigits: 9 },
  { code: "NL", prefix: "+31", label: "🇳🇱 Olanda (+31)", maxDigits: 9 },
  { code: "BE", prefix: "+32", label: "🇧🇪 Belgia (+32)", maxDigits: 9 },
  { code: "AT", prefix: "+43", label: "🇦🇹 Austria (+43)", maxDigits: 10 },
  { code: "CH", prefix: "+41", label: "🇨🇭 Elveția (+41)", maxDigits: 9 },
  { code: "GR", prefix: "+30", label: "🇬🇷 Grecia (+30)", maxDigits: 10 },
  { code: "TR", prefix: "+90", label: "🇹🇷 Turcia (+90)", maxDigits: 10 },
  { code: "PL", prefix: "+48", label: "🇵🇱 Polonia (+48)", maxDigits: 9 },
  { code: "HU", prefix: "+36", label: "🇭🇺 Ungaria (+36)", maxDigits: 9 },
  { code: "RS", prefix: "+381", label: "🇷🇸 Serbia (+381)", maxDigits: 9 },
  { code: "HR", prefix: "+385", label: "🇭🇷 Croația (+385)", maxDigits: 9 },
  { code: "BG", prefix: "+359", label: "🇧🇬 Bulgaria (+359)", maxDigits: 9 },
  { code: "MD", prefix: "+373", label: "🇲🇩 Moldova (+373)", maxDigits: 8 },
  { code: "BR", prefix: "+55", label: "🇧🇷 Brazilia (+55)", maxDigits: 11 },
  { code: "AR", prefix: "+54", label: "🇦🇷 Argentina (+54)", maxDigits: 10 },
];

function AgentPhoneInput({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  // Parse existing value to extract prefix and number
  const findPrefix = (val: string) => {
    if (!val) return { prefix: COUNTRY_PHONE_PREFIXES[0], number: "" };
    for (const p of [...COUNTRY_PHONE_PREFIXES].sort((a, b) => b.prefix.length - a.prefix.length)) {
      if (val.startsWith(p.prefix)) {
        return { prefix: p, number: val.slice(p.prefix.length).replace(/\s/g, "") };
      }
    }
    return { prefix: COUNTRY_PHONE_PREFIXES[0], number: val.replace(/[^\d]/g, "") };
  };

  const parsed = findPrefix(value);
  const [selectedPrefix, setSelectedPrefix] = useState(parsed.prefix);
  const [phoneNumber, setPhoneNumber] = useState(parsed.number);

  const handlePrefixChange = (prefixCode: string) => {
    const found = COUNTRY_PHONE_PREFIXES.find(p => p.code === prefixCode);
    if (found) {
      setSelectedPrefix(found);
      onChange(phoneNumber ? `${found.prefix}${phoneNumber}` : "");
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^\d]/g, "").slice(0, selectedPrefix.maxDigits);
    setPhoneNumber(digits);
    onChange(digits ? `${selectedPrefix.prefix}${digits}` : "");
  };

  const isValid = !phoneNumber || phoneNumber.length === selectedPrefix.maxDigits;

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Select value={selectedPrefix.code} onValueChange={handlePrefixChange}>
          <SelectTrigger className="w-[180px] text-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {COUNTRY_PHONE_PREFIXES.map((p) => (
              <SelectItem key={p.code} value={p.code} className="text-sm">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="tel"
          value={phoneNumber}
          onChange={handleNumberChange}
          placeholder={`${"0".repeat(selectedPrefix.maxDigits)}`}
          className={`flex-1 text-white ${phoneNumber && !isValid ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
      </div>
      {phoneNumber && !isValid && (
        <p className="text-xs text-destructive">Numărul trebuie să aibă {selectedPrefix.maxDigits} cifre (ai introdus {phoneNumber.length})</p>
      )}
    </div>
  );
}



interface PersonalProfileProps {
  userId: string;
  readOnly?: boolean;
  onNavigateToChat?: (userId: string) => void;
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

type TabType = "stats" | "profile" | "video" | "posts";

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

export const getTechnicalTestsBySport = (sport: string | null | undefined): TechnicalTest[] => {
  if (sport === "basketball") return basketballTests;
  if (sport === "football") return footballTests;
  return footballTests; // default
};

export const getTestLabelByKey = (sport: string | null | undefined, key: string): string => {
  const tests = getTechnicalTestsBySport(sport);
  return tests.find((t) => t.key === key)?.label || key;
};

type EditingSection = "header" | "stats" | "technical" | "physical" | "agent" | "about" | "video" | "video_full_match" | "match_stats" | null;

interface CareerEntry {
  id?: string;
  team_name: string;
  start_date: string;
  end_date: string;
  currently_active: boolean;
  description: string;
}

interface AgentSuggestion {
  user_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  email: string | null;
}

const PersonalProfile = ({ userId, readOnly = false, onNavigateToChat }: PersonalProfileProps) => {
  const { toast } = useToast();
  const { lang, t } = useLanguage();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<PlayerProfile>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("stats");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [careerEntries, setCareerEntries] = useState<CareerEntry[]>([]);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [followStatus, setFollowStatus] = useState<"none" | "pending" | "accepted" | "rejected">("none");
  const [followLoading, setFollowLoading] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState(false);
  const { followers, count: followerCount, removeFollower } = useFollowers(userId);
  const currentSport = (form as any).sport || (profile as any)?.sport || "football";

  // Streak vizibil în header (atât pe profilul propriu cât și pentru scouteri)
  const headerTechnicalTests = getTechnicalTestsBySport(currentSport);
  const headerIsOwner = !readOnly || viewerUserId === userId;
  const unlocks = useTestUnlocks(
    userId,
    viewerUserId,
    headerTechnicalTests.map((t) => t.key),
    headerIsOwner,
  );

  // Agent autocomplete state
  const [agentSuggestions, setAgentSuggestions] = useState<AgentSuggestion[]>([]);
  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);
  const [selectedRegisteredAgent, setSelectedRegisteredAgent] = useState<AgentSuggestion | null>(null);
  const [agentSearchTimeout, setAgentSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [collaborationStatus, setCollaborationStatus] = useState<"none" | "pending" | "accepted" | "rejected">("none");
  const [collaborationLoading, setCollaborationLoading] = useState(false);
  const [acceptedAgent, setAcceptedAgent] = useState<AgentSuggestion | null>(null);

  // Fetch existing collaboration (pending or accepted) on mount — both for own and visited profiles
  useEffect(() => {
    if (!userId) return;
    const fetchCollab = async () => {
      // Prefer accepted collaboration; fallback to latest pending (only on own profile)
      const { data: acceptedData } = await supabase
        .from("agent_collaboration_requests")
        .select("*")
        .eq("player_user_id", userId)
        .eq("status", "accepted")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (acceptedData && acceptedData.length > 0) {
        const req = acceptedData[0];
        setCollaborationStatus("accepted");
        const { data: agentData } = await supabase
          .from("scout_profiles")
          .select("user_id, first_name, last_name, photo_url")
          .eq("user_id", req.agent_user_id)
          .maybeSingle();
        if (agentData) setAcceptedAgent({ ...agentData, email: null });
        return;
      }

      if (readOnly) return;

      const { data } = await supabase
        .from("agent_collaboration_requests")
        .select("*")
        .eq("player_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const req = data[0];
        setCollaborationStatus(req.status as any);
        if (req.status === "pending") {
          const { data: agentData } = await supabase
            .from("scout_profiles")
            .select("user_id, first_name, last_name, photo_url")
            .eq("user_id", req.agent_user_id)
            .maybeSingle();
          if (agentData) {
            setSelectedRegisteredAgent({ ...agentData, email: null });
          }
        }
      }
    };
    fetchCollab();
  }, [userId, readOnly]);

  const searchAgents = useCallback(async (term: string) => {
    if (term.length < 2) {
      setAgentSuggestions([]);
      return;
    }
    const { data } = await supabase.rpc("search_agents", { search_term: term });
    if (data) setAgentSuggestions(data as AgentSuggestion[]);
  }, []);

  const handleAgentNameChange = (value: string) => {
    updateForm("agent_name", value);
    if (selectedRegisteredAgent && value !== `${selectedRegisteredAgent.first_name} ${selectedRegisteredAgent.last_name}`) {
      setSelectedRegisteredAgent(null);
      setCollaborationStatus("none");
      updateForm("agent_email", "");
      updateForm("agent_phone", "");
    }
    if (agentSearchTimeout) clearTimeout(agentSearchTimeout);
    const timeout = setTimeout(() => searchAgents(value), 300);
    setAgentSearchTimeout(timeout);
    setShowAgentSuggestions(true);
  };

  const selectAgent = async (agent: AgentSuggestion) => {
    setSelectedRegisteredAgent(agent);
    setAgentSuggestions([]);
    setShowAgentSuggestions(false);
    setCollaborationLoading(true);

    try {
      const { error } = await supabase.rpc("send_collaboration_request", {
        _agent_user_id: agent.user_id,
        _player_user_id: userId,
        _initiated_by: "player",
      });

      if (error) {
        const msg = error.message || "";
        const cooldownMatch = msg.match(/COOLDOWN_ACTIVE:(\d+)/);
        if (cooldownMatch) {
          const days = cooldownMatch[1];
          toast({
            title: lang === "ro" ? "Așteaptă perioada de pauză" : "Cooldown active",
            description: lang === "ro"
              ? `Acest agent ți-a refuzat o cerere recentă. Mai poți trimite o cerere nouă în ${days} zile.`
              : `This agent recently rejected a request. You can send a new one in ${days} days.`,
            variant: "destructive",
          });
          setSelectedRegisteredAgent(null);
          setCollaborationStatus("none");
          return;
        }
        throw error;
      }

      setCollaborationStatus("pending");
      // Clear agent fields - they'll be filled when accepted
      updateForm("agent_name", "");
      updateForm("agent_email", "");
      updateForm("agent_phone", "");

      toast({
        title: lang === "ro" ? "Cerere trimisă!" : "Request sent!",
        description: lang === "ro"
          ? `O cerere de colaborare a fost trimisă către ${agent.first_name} ${agent.last_name}`
          : `A collaboration request was sent to ${agent.first_name} ${agent.last_name}`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: lang === "ro" ? "Eroare la trimiterea cererii" : "Failed to send request", variant: "destructive" });
    } finally {
      setCollaborationLoading(false);
    }
  };

  const cancelCollaborationRequest = async () => {
    setCollaborationLoading(true);
    try {
      await supabase
        .from("agent_collaboration_requests")
        .delete()
        .eq("player_user_id", userId);
      setCollaborationStatus("none");
      setSelectedRegisteredAgent(null);
      toast({ title: lang === "ro" ? "Cererea a fost anulată" : "Request cancelled" });
    } catch (err) {
      console.error(err);
    } finally {
      setCollaborationLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchCareerEntries();
    if (readOnly) checkFollowStatus();
  }, [userId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setViewerUserId(user?.id ?? null);
    });
  }, []);

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
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
      setFollowStatus("none");
    } else {
      const { error } = await supabase.rpc("request_follow", { _following_id: userId });
      if (!error) setFollowStatus("pending");
    }
    setFollowLoading(false);
  };

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
      // Validate agent email if editing agent section
      if (editingSection === "agent" && form.agent_email && !form.agent_email.includes("@")) {
        toast({ title: "Adresa de email a agentului trebuie să conțină simbolul @", variant: "destructive" });
        setSaving(false);
        return;
      }
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
          full_match_videos: (form as any).full_match_videos,
          full_match_descriptions: (form as any).full_match_descriptions,
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
        // Check for date overlaps
        const hasOverlap = careerEntries.some((entry, idx) => {
          if (!entry.start_date) return false;
          return careerEntries.some((other, otherIdx) => {
            if (idx >= otherIdx || !other.start_date) return false;
            const s1 = new Date(entry.start_date).getTime();
            const e1 = entry.currently_active ? Infinity : (entry.end_date ? new Date(entry.end_date).getTime() : s1);
            const s2 = new Date(other.start_date).getTime();
            const e2 = other.currently_active ? Infinity : (other.end_date ? new Date(other.end_date).getTime() : s2);
            return s1 <= e2 && s2 <= e1;
          });
        });
        if (hasOverlap) {
          toast({ title: "Perioadele echipelor se suprapun. Corectează datele înainte de a salva.", variant: "destructive" });
          setSaving(false);
          return;
        }
        // Delete existing entries
        await supabase.from("player_career_entries").delete().eq("user_id", userId);
        // Insert new entries
        if (careerEntries.length > 0) {
          // Sort chronologically by start_date before saving
          const sorted = [...careerEntries].sort((a, b) => {
            if (!a.start_date && !b.start_date) return 0;
            if (!a.start_date) return 1;
            if (!b.start_date) return -1;
            return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
          });
          setCareerEntries(sorted);
          const entries = sorted.map((e, i) => ({
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
        // Sync current_team from active career entry
        const activeEntry = careerEntries.find(e => e.currently_active);
        const newCurrentTeam = activeEntry?.team_name || "";
        await supabase.from("player_profiles").update({ current_team: newCurrentTeam }).eq("user_id", userId);
        updateForm("current_team", newCurrentTeam);
      }

      toast({ title: t.dashboard.profile.profileUpdated });
      setEditingSection(null);
      setAvatarFile(null);
      await fetchProfile();
      await fetchCareerEntries();
    } catch (err: any) {
      toast({ title: t.dashboard.profile.error, description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const SectionEditButton = ({ section }: { section: EditingSection }) => {
    if (readOnly || !section) return null;
    const isEditing = editingSection === section;
    if (isEditing) return null; // Save button is shown at section bottom
    return (
      <button
        onClick={() => setEditingSection(section)}
        className="text-muted-foreground hover:text-primary transition-colors p-1"
        aria-label="Editează"
      >
        <Edit2 className="h-4 w-4" />
      </button>
    );
  };

  const SectionSaveButton = () => {
    if (!editingSection || readOnly) return null;
    return (
      <div className="flex justify-end mt-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Salvați
        </Button>
      </div>
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
  const isOwnReadOnlyProfile = readOnly && viewerUserId === userId;

  if (!readOnly && showFollowersList) {
    return (
      <FollowersList
        followers={followers}
        onRemove={removeFollower}
        onViewProfile={() => {}}
        onClose={() => setShowFollowersList(false)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto relative">
      {/* SECTION 1: Header / Hero - sticky */}
      <div className="z-20 rounded-xl overflow-hidden">
      <div className="relative bg-gradient-to-br from-sidebar to-sidebar-accent rounded-t-xl overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)`,
          backgroundSize: '30px 30px'
        }} />
        <div className="relative flex flex-col sm:flex-row flex-wrap items-center sm:items-end gap-4 sm:gap-6 p-4 sm:p-8">
          {/* Info */}
          <div className="flex-1 min-w-0 w-full text-center sm:text-left order-2 sm:order-1">
            {editingSection === "header" ? (
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <Input value={form.first_name || ""} onChange={(e) => updateForm("first_name", e.target.value)} placeholder={t.dashboard.profile.firstName} className="bg-sidebar-accent border-sidebar-border text-white font-display text-lg sm:text-2xl h-auto py-1 min-w-0" />
                <Input value={form.last_name || ""} onChange={(e) => updateForm("last_name", e.target.value)} placeholder={t.dashboard.profile.lastName} className="bg-sidebar-accent border-sidebar-border text-white font-display text-lg sm:text-2xl h-auto py-1 min-w-0" />
              </div>
            ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-3xl sm:text-5xl text-white tracking-wide uppercase">
                {profile?.first_name || profile?.last_name
                  ? `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()
                  : t.dashboard.profile.completeProfile}
              </h1>
              {!unlocks.loading && unlocks.currentStreak > 0 && (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="relative h-12 w-12 flex items-center justify-center cursor-help select-none drop-shadow-[0_0_8px_rgba(251,146,60,0.5)] hover:scale-110 transition-transform shrink-0"
                        aria-label={`Streak activ: ${unlocks.currentStreak} zile consecutive`}
                      >
                        <span className="text-4xl leading-none" aria-hidden="true">🔥</span>
                        <span className="absolute inset-0 flex items-center justify-center pt-1.5 font-display text-[13px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                          {unlocks.currentStreak}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px]">
                      <p className="font-display text-xs uppercase tracking-wide">Streak activ</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {unlocks.currentStreak} {unlocks.currentStreak === 1 ? "zi consecutivă" : "zile consecutive"} de logare în aplicație — semn de disciplină și seriozitate.
                      </p>
                      {unlocks.bestStreak > unlocks.currentStreak && (
                        <p className="text-[10px] text-muted-foreground/80 mt-1">
                          Record personal: {unlocks.bestStreak} {unlocks.bestStreak === 1 ? "zi" : "zile"}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            )}

            {/* Gender display - only show if male or female */}
            {editingSection !== "header" && profile?.gender && profile.gender !== "prefer_not_to_say" && (
              <p className="text-primary-foreground/70 font-body text-sm mt-1">
                {profile.gender === "male" ? t.auth.genderMale : t.auth.genderFemale}
              </p>
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
                    {profile?.nationality ? getDisplayNationality(profile.nationality, lang) : (readOnly ? "" : <span className="italic text-muted-foreground font-normal">{t.dashboard.profile.addNationality || "Adaugă naționalitate"}</span>)}
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
            {/* Follower count */}
            {editingSection !== "header" && (
              <div className="mt-3">
                <button
                  onClick={() => !readOnly && setShowFollowersList(!showFollowersList)}
                  className={`flex items-center gap-1.5 text-sm font-body ${!readOnly ? "hover:text-primary cursor-pointer" : "cursor-default"} transition-colors`}
                >
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-white">{followerCount}</span>
                  <span className="text-muted-foreground">{lang === "ro" ? "urmăritori" : "followers"}</span>
                </button>
              </div>
            )}
            {/* Action buttons for readOnly */}
            {readOnly && !isOwnReadOnlyProfile && (
              <div className="mt-3 flex gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          onClick={(e) => { e.stopPropagation(); onNavigateToChat ? onNavigateToChat(userId) : setShowMessageDialog(true); }}
                          size="sm"
                          disabled={followStatus !== "accepted"}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-body gap-2 disabled:opacity-50"
                        >
                          {followStatus !== "accepted" ? <Lock className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                          {lang === "ro" ? "Mesaj" : "Message"}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {followStatus !== "accepted" && (
                      <TooltipContent>
                        {lang === "ro"
                          ? "Este nevoie să fii conectată cu această persoană pentru a trimite mesaj."
                          : "You need to be connected with this person to send a message."}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
                <Button
                  onClick={(e) => { e.stopPropagation(); toggleFollow(); }}
                  size="sm"
                  variant={followStatus === "accepted" ? "secondary" : "outline"}
                  disabled={followLoading}
                  className="font-body gap-2"
                >
                  {followLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : followStatus === "accepted" ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {followStatus === "accepted"
                    ? (lang === "ro" ? "Urmărești" : "Following")
                    : followStatus === "pending"
                      ? (lang === "ro" ? "Cerere trimisă" : "Request sent")
                      : (lang === "ro" ? "Urmărește" : "Follow")}
                </Button>
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
          {editingSection === "header" && (
            <div className="w-full flex justify-end mt-4 order-3">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Salvați
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs row (no edit button) */}
      <div className="flex items-stretch border-b border-border bg-card rounded-b-xl z-20">
        <div className="flex flex-1 overflow-x-auto">
          {([
            { key: "stats" as TabType, label: "Stats" },
            { key: "profile" as TabType, label: "Profile" },
            { key: "video" as TabType, label: "Video" },
            { key: "posts" as TabType, label: lang === "ro" ? "Postări" : "Posts" },
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
      </div>



      {/* SECTION 2: Tab content */}
      <div className="mt-6 px-2 sm:px-6 pb-8">
        {activeTab === "stats" && <StatsTab form={form} profile={profile} editingSection={editingSection} updateForm={updateForm} photoSrc={photoSrc} userId={userId} viewerUserId={viewerUserId} SectionEditButton={SectionEditButton} SectionSaveButton={SectionSaveButton} readOnly={readOnly} />}
        {activeTab === "profile" && <ProfileTab form={form} profile={profile} editingSection={editingSection} updateForm={updateForm} userId={userId} readOnly={readOnly} SectionEditButton={SectionEditButton} careerEntries={careerEntries} setCareerEntries={setCareerEntries} SectionSaveButton={SectionSaveButton} sport={currentSport} agentSuggestions={agentSuggestions} showAgentSuggestions={showAgentSuggestions} setShowAgentSuggestions={setShowAgentSuggestions} selectedRegisteredAgent={selectedRegisteredAgent} handleAgentNameChange={handleAgentNameChange} selectAgent={selectAgent} collaborationStatus={collaborationStatus} collaborationLoading={collaborationLoading} cancelCollaborationRequest={cancelCollaborationRequest} acceptedAgent={acceptedAgent} />}
        {activeTab === "profile" && (
          <div className="mt-6">
            <RecommendationsSection
              profileUserId={userId}
              viewerUserId={viewerUserId}
              isOwner={!readOnly || viewerUserId === userId}
            />
          </div>
        )}
        {activeTab === "video" && (
          <VideoTab
            form={form}
            profile={profile}
            editingSection={editingSection}
            newVideoUrl={newVideoUrl}
            setNewVideoUrl={setNewVideoUrl}
            addVideoUrl={addVideoUrl}
            removeVideoUrl={removeVideoUrl}
            updateForm={updateForm}
            SectionEditButton={SectionEditButton}
            SectionSaveButton={SectionSaveButton}
          />
        )}
        {activeTab === "posts" && <PostsTab userId={userId} readOnly={readOnly} />}
      </div>

      {/* Message Dialog */}
      {readOnly && (
        <MessageDialog
          open={showMessageDialog}
          onOpenChange={setShowMessageDialog}
          recipientUserId={userId}
          recipientName={`${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()}
        />
      )}
    </div>
  );
};

/* ======================== STATS TAB ======================== */
function StatsTab({ form, profile, editingSection, updateForm, photoSrc, userId, viewerUserId, SectionEditButton, SectionSaveButton, readOnly = false }: {
  form: Partial<PlayerProfile>; profile: PlayerProfile | null; editingSection: EditingSection; updateForm: (k: string, v: any) => void; photoSrc?: string | null; userId: string; viewerUserId: string | null; SectionEditButton: React.FC<{ section: EditingSection }>; SectionSaveButton: React.FC; readOnly?: boolean;
}) {
  const editing = editingSection === "stats";
  const editingMatchStats = editingSection === "match_stats";
  const editingTechnical = editingSection === "technical";
  const currentSport = (form as any).sport || (profile as any)?.sport || "football";
  const { t } = useLanguage();
  const { toast } = useToast();
  const [athleticRegOpen, setAthleticRegOpen] = useState(false);
  const technicalTests = getTechnicalTestsBySport(currentSport);
  const isOwner = !readOnly || viewerUserId === userId;
  const unlocks = useTestUnlocks(
    userId,
    viewerUserId,
    technicalTests.map((t) => t.key),
    isOwner,
  );
  const isUnlocked = (key: string) => unlocks.unlockedTests.includes(key);
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
    <>
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
            </div>
              <>
                <div className="space-y-4">
                  {stats.map((stat) => (
                    <div key={stat.key} className="group">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-body text-muted-foreground uppercase tracking-wide">{stat.icon} {stat.label}</span>
                        <span className="font-display text-xl text-foreground">?</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: '0%',
                            background: 'linear-gradient(90deg, hsl(var(--primary) / 0.7), hsl(var(--primary)))',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-body uppercase tracking-wide">Rating General</span>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-3xl text-primary">?</span>
                    <span className="text-xs text-muted-foreground font-body">/100</span>
                  </div>
                </div>

                {!readOnly && (
                  <div className="mt-6 pt-5 border-t border-border text-center space-y-4">
                    <p className="text-sm font-body text-muted-foreground leading-relaxed">
                      E momentul să treci la următorul nivel.<br />
                      Înscrie-te la testările atletice și demonstrează-ți<br />
                      abilitățile în fața evaluatorilor.
                    </p>
                    <Button
                      type="button"
                      onClick={() => setAthleticRegOpen(true)}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-display uppercase tracking-wider shadow-lg"
                    >
                      Înscrie-te gratuit aici
                    </Button>
                  </div>
                )}
              </>
          </div>
        </div>

        {/* Provocare săptămânală */}
        <WeeklyChallengeCard
          userId={userId}
          viewerUserId={viewerUserId}
          availableTests={technicalTests.map((t) => t.key)}
          isOwner={isOwner}
        />

        {/* Teste Tehnice Specifice section */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <h4 className="font-display text-lg text-foreground uppercase tracking-wide">Teste Tehnice Specifice</h4>
              {!unlocks.loading && unlocks.bestStreak >= 7 && (
                <StreakBadges bestStreak={unlocks.bestStreak} currentStreak={unlocks.currentStreak} />
              )}
            </div>
            {unlocks.unlockedTests.length > 0 && <SectionEditButton section="technical" />}
          </div>
          {/* Mesaj motivațional pentru următorul badge — doar pe profilul propriu */}
          {isOwner && !unlocks.loading && (() => {
            const next = getNextBadgeMilestone(unlocks.bestStreak);
            if (!next) return null;
            const remaining = next.threshold - unlocks.bestStreak;
            return (
              <p className="text-[11px] text-muted-foreground font-body mb-2">
                🏅 Încă {remaining} {remaining === 1 ? "zi" : "zile"} de streak până la badge-ul „{next.label}"
              </p>
            );
          })()}

          {/* Progress streak — vizibil doar pe profilul propriu și doar dacă mai sunt teste de deblocat */}
          {isOwner && !unlocks.loading && unlocks.unlockedTests.length < technicalTests.length && (
            <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border">
              {(() => {
                let previewKey = unlocks.nextTestPreview;
                if (!previewKey) {
                  const locked = technicalTests.filter((t) => !unlocks.unlockedTests.includes(t.key));
                  if (locked.length > 0) {
                    const seed = (userId || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
                    previewKey = locked[seed % locked.length].key;
                  }
                }
                const nextLabel = technicalTests.find((t) => t.key === previewKey)?.label;
                const days = unlocks.daysUntilNextUnlock;
                const firstLine =
                  days === 0
                    ? nextLabel
                      ? `Următoarea ta intrare deblochează testul: ${nextLabel}`
                      : "Următorul test se deblochează la următoarea ta intrare!"
                    : nextLabel
                      ? `încă ${days} ${days === 1 ? "zi" : "zile"} până la deblocarea testului: ${nextLabel}`
                      : `încă ${days} ${days === 1 ? "zi" : "zile"} până la următorul test deblocat`;
                return (
                  <div className="flex items-start gap-2 mb-2">
                    <Gift className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-xs font-body text-foreground font-semibold">
                      {firstLine}
                    </span>
                  </div>
                );
              })()}
              <Progress value={(unlocks.currentStreak / unlocks.required) * 100} className="h-2" />
              <p className="text-[10px] text-muted-foreground mt-1.5 font-body">
                {unlocks.currentStreak}/{unlocks.required} zile consecutive · Intră în aplicație în fiecare zi pentru a debloca teste noi 🎁
              </p>
            </div>
          )}
          {isOwner && !unlocks.loading && unlocks.unlockedTests.length === technicalTests.length && (
            <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <span className="text-xs font-body text-foreground">🏆 Felicitări! Ai deblocat toate testele tehnice.</span>
            </div>
          )}

          {editingTechnical ? (
            <div className="space-y-4">
              {technicalTests.map((test) => {
                const unlocked = isUnlocked(test.key);
                if (!unlocked) {
                  return (
                    <div key={test.key} className="opacity-60 p-3 rounded-lg bg-muted/20 border border-dashed border-border">
                      <div className="flex items-center gap-2">
                        <LockIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-body text-muted-foreground uppercase tracking-wide">??? — Test blocat</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-body">Continuă streak-ul ca să deblochezi acest test.</p>
                    </div>
                  );
                }
                return (
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
                );
              })}
              <SectionSaveButton />
            </div>
          ) : (
            <div className="space-y-4">
              {technicalTests.map((test) => {
                const unlocked = isUnlocked(test.key);
                if (!unlocked) {
                  return (
                    <div key={test.key} className="p-3 rounded-lg bg-muted/20 border border-dashed border-border">
                      <div className="flex items-center gap-2">
                        <LockIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-body text-muted-foreground uppercase tracking-wide">??? — Test blocat</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-body">
                        {isOwner ? "Continuă streak-ul zilnic ca să deblochezi acest test." : "Test încă nedeblocat de jucător."}
                      </p>
                    </div>
                  );
                }
                return (
                <div key={test.key}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-body text-muted-foreground uppercase tracking-wide">{test.icon} {test.label}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`text-muted-foreground hover:text-primary transition-colors p-1 ${readOnly ? 'hidden' : ''}`} aria-label={`Info ${test.label}`}>
                          <Info className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="text-sm font-body w-80" side="top">
                        <p className="font-semibold mb-1">{test.icon} {test.label}</p>
                        <p className="text-muted-foreground text-xs whitespace-pre-line">{test.description}</p>
                        {test.key === "control_pass_video" && (
                          <video
                            src="/videos/control-pass.mp4"
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full rounded-md mt-2"
                          />
                        )}
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
                );
              })}
            </div>
          )}
        </div>


    </div>
    <AthleticTestRegistrationDialog
      open={athleticRegOpen}
      onOpenChange={setAthleticRegOpen}
      userId={userId}
      defaultFirstName={(form as any).first_name || ""}
      defaultLastName={(form as any).last_name || ""}
    />
    </>
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
interface PalmaresItem {
  place: string;
  championship: string;
  category: string;
  year: string;
  document_url?: string;
}

function parsePalmaresList(description: string | undefined): PalmaresItem[] {
  if (!description) return [{ place: "", championship: "", category: "", year: "" }];
  try {
    const parsed = JSON.parse(description);
    if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [{ place: "", championship: "", category: "", year: "" }];
    return [{ place: parsed.place || "", championship: parsed.championship || "", category: parsed.category || "", year: parsed.year || "", document_url: parsed.document_url || "" }];
  } catch {
    return [{ place: "", championship: "", category: "", year: "" }];
  }
}

function PalmaresEditor({ entry, idx, careerEntries, setCareerEntries, sport }: {
  entry: CareerEntry; idx: number; careerEntries: CareerEntry[]; setCareerEntries: React.Dispatch<React.SetStateAction<CareerEntry[]>>; sport?: string;
}) {
  const palmaresList = parsePalmaresList(entry.description);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const updateList = (newList: PalmaresItem[]) => {
    setCareerEntries((prev) => {
      const updated = [...prev];
      const currentEntry = updated[idx] ?? entry;
      updated[idx] = { ...currentEntry, description: JSON.stringify(newList) };
      return updated;
    });
  };

  const addPalmares = () => {
    updateList([...palmaresList, { place: "", championship: "", category: "", year: "" }]);
  };

  const removePalmares = (pIdx: number) => {
    const newList = palmaresList.filter((_, i) => i !== pIdx);
    updateList(newList.length > 0 ? newList : [{ place: "", championship: "", category: "", year: "" }]);
  };

  const updatePalmaresItem = (pIdx: number, field: string, value: string) => {
    setCareerEntries((prev) => {
      const updated = [...prev];
      const currentEntry = updated[idx] ?? entry;
      const currentList = parsePalmaresList(currentEntry.description);
      const newList = [...currentList];
      newList[pIdx] = { ...newList[pIdx], [field]: value };
      updated[idx] = { ...currentEntry, description: JSON.stringify(newList) };
      return updated;
    });
  };

  const handleDragEnd = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      const newList = [...palmaresList];
      const [dragged] = newList.splice(dragIdx, 1);
      newList.splice(dragOverIdx, 0, dragged);
      updateList(newList);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="space-y-3 border-t border-border pt-3 mt-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-foreground font-semibold">🏆 Palmares</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addPalmares} className="h-6 px-2 text-xs text-foreground">
          <Plus className="h-3 w-3 mr-1" /> Adaugă rezultat
        </Button>
      </div>
      {palmaresList.map((palmares, pIdx) => (
        <SinglePalmaresRow
          key={pIdx}
          palmares={palmares}
          pIdx={pIdx}
          total={palmaresList.length}
          onUpdate={updatePalmaresItem}
          onRemove={removePalmares}
          isDragging={dragIdx === pIdx}
          isDragOver={dragOverIdx === pIdx}
          onDragStart={() => setDragIdx(pIdx)}
          onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDragOverIdx(pIdx); }}
          onDragEnd={handleDragEnd}
          entryStartDate={entry.start_date}
          entryEndDate={entry.end_date}
          sport={sport}
        />
      ))}
    </div>
  );
}

function ChampionshipCombobox({ value, customChampionship, setCustomChampionship, championshipOptions, onChange }: {
  value: string; customChampionship: boolean; setCustomChampionship: (v: boolean) => void;
  championshipOptions: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (customChampionship) {
    return (
      <div>
        <Label className="text-xs text-foreground font-medium">Campionat</Label>
        <div className="flex gap-1">
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Ex.: Campionat European" className="bg-background text-foreground placeholder:text-foreground/60" />
          <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomChampionship(false); onChange(""); }}><X className="h-3 w-3" /></Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label className="text-xs text-foreground font-medium">Campionat</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between bg-background text-foreground font-normal h-10 text-sm">
            {value || "Selectează..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Caută campionat..." />
            <CommandList>
              <CommandEmpty>Nu s-a găsit.</CommandEmpty>
              <CommandGroup>
                {championshipOptions.map((o, i) => (
                  <CommandItem key={o} value={`option_${i}_${o}`} keywords={[o]} onSelect={() => { onChange(o); setOpen(false); }}>
                    <Check className={`mr-2 h-4 w-4 ${value === o ? "opacity-100" : "opacity-0"}`} />
                    {o}
                  </CommandItem>
                ))}
                <CommandItem value="__custom__" onSelect={() => { setCustomChampionship(true); setOpen(false); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Altele...
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function PalmaresDocUpload({ documentUrl, onUpdate }: { documentUrl: string; onUpdate: (url: string) => void }) {
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
      const path = `${session.user.id}/palmares/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("player-documents").upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("player-documents").getPublicUrl(path);
      onUpdate(urlData.publicUrl);
      toast({ title: "Document încărcat!" });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (documentUrl) {
    return (
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 mt-1">
        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
        <button type="button" onClick={() => window.open(documentUrl, '_blank')} className="text-xs text-foreground font-body hover:text-primary truncate flex-1 text-left">
          Document atașat
        </button>
        <button type="button" onClick={() => onUpdate("")} className="text-destructive hover:text-destructive/80 shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <label className="block mt-1">
      <div className="flex items-center justify-center gap-1.5 border border-dashed border-border rounded-md p-1.5 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
        {uploading ? (
          <><Loader2 className="h-3.5 w-3.5 text-primary animate-spin" /><span className="text-xs text-muted-foreground font-body">Se încarcă...</span></>
        ) : (
          <><Upload className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground font-body">Atașează document</span></>
        )}
      </div>
      <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} disabled={uploading} />
    </label>
  );
}

const basketballCategories = ["U10", "U12", "U13", "U14", "U15", "U16", "U17", "U18", "U19", "U20"];

function SinglePalmaresRow({ palmares, pIdx, total, onUpdate, onRemove, isDragging, isDragOver, onDragStart, onDragOver, onDragEnd, entryStartDate, entryEndDate, sport }: {
  palmares: PalmaresItem; pIdx: number; total: number;
  onUpdate: (pIdx: number, field: string, value: string) => void;
  onRemove: (pIdx: number) => void;
  isDragging: boolean; isDragOver: boolean;
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDragEnd: () => void;
  entryStartDate?: string; entryEndDate?: string; sport?: string;
}) {
  const placeOptions = ["Locul 1", "Locul 2", "Locul 3"];
  const footballChampionshipOptions = [
    "SuperLiga - Sezon Regular", "SuperLiga - Play-Off", "SuperLiga - Play-Out",
    "Cupa României", "Super Cupa României",
    "Liga 2 Casa Pariurilor", "Liga 2 Casa Pariurilor - Play-Off", "Liga 2 Casa Pariurilor - Play-Out",
    "Liga 3", "Liga 3 - Play-Off", "Liga 3 - Play-Out", "Baraj Liga 3",
    "Liga de Tineret", "Cupa de Tineret",
    "Liga Elitelor U17", "Cupa - Elitelor U17",
    "Liga Elitelor U16", "Liga Elitelor U16 Play-Off", "Liga Elitelor U16 Play-Out", "Cupa - Elitelor U16",
    "Liga Elitelor U15 Play-Off", "Liga Elitelor U15", "Liga Elitelor U15 Play-Out", "Cupa - Elitelor U15",
    "Liga Elitelor U13", "Liga Elitelor U14",
    "Campionatul Național U19", "Cupa - Național U19",
    "Campionatul Național U17", "Cupa - Național U17",
    "Campionatul U16 Național", "Cupa - Național U16",
    "Campionatul U15 Național", "Cupa - Național U15",
    "Interliga de Iarnă U12", "Interliga de Iarnă U11",
  ];
  const basketballChampionshipOptions = [
    "Campionat Municipal", "Campionat Regional", "Campionat Național",
    "Cupa Federației", "Cupa României", "Liga II", "Liga I", "LNB",
  ];
  const championshipOptions = sport === "basketball" ? basketballChampionshipOptions : footballChampionshipOptions;

  const [customPlace, setCustomPlace] = useState(!!palmares.place && !placeOptions.includes(palmares.place));
  const [customChampionship, setCustomChampionship] = useState(!!palmares.championship && !championshipOptions.includes(palmares.championship));
  const seniorChampionships = ["Cupa Federației", "Cupa României", "Liga II", "Liga I", "LNB"];
  const isCategoryDisabled = sport === "basketball" && seniorChampionships.includes(palmares.championship);
  const [customCategory, setCustomCategory] = useState(!!palmares.category && !basketballCategories.includes(palmares.category) && !isCategoryDisabled);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`relative grid grid-cols-1 sm:grid-cols-2 gap-3 bg-background/30 rounded-md p-2 pl-7 border transition-all cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50 border-primary" : isDragOver ? "border-primary/60 bg-primary/5" : "border-border/50"}`}
    >
      <GripVertical className="absolute left-1.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      {total > 1 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(pIdx)} className="absolute top-1 right-1 h-6 w-6 p-0 text-destructive hover:text-destructive">
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
      <ChampionshipCombobox
        value={palmares.championship}
        customChampionship={customChampionship}
        setCustomChampionship={setCustomChampionship}
        championshipOptions={championshipOptions}
        onChange={(v) => { onUpdate(pIdx, "championship", v); if (sport === "basketball" && seniorChampionships.includes(v)) { onUpdate(pIdx, "category", ""); setCustomCategory(false); } }}
      />
      <div>
        <Label className="text-xs text-foreground font-medium">Loc</Label>
        {customPlace ? (
          <div className="flex gap-1">
            <Input value={palmares.place} onChange={(e) => onUpdate(pIdx, "place", e.target.value)} placeholder="Ex.: Locul 4" className="bg-background text-foreground placeholder:text-foreground/60" />
            <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomPlace(false); onUpdate(pIdx, "place", ""); }}><X className="h-3 w-3" /></Button>
          </div>
        ) : (
          <Select value={palmares.place} onValueChange={(v) => v === "__custom__" ? setCustomPlace(true) : onUpdate(pIdx, "place", v)}>
            <SelectTrigger className="bg-background text-foreground"><SelectValue placeholder="Selectează..." /></SelectTrigger>
            <SelectContent>
              {placeOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              <SelectItem value="__custom__">Altele...</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <div>
        <Label className="text-xs text-foreground font-medium">{sport === "basketball" ? "Categorie" : "Grupa/Serie"}</Label>
        {sport === "basketball" ? (
          isCategoryDisabled ? (
            <Input value="" disabled placeholder="—" className="bg-muted text-muted-foreground" />
          ) : customCategory ? (
            <div className="flex gap-1">
              <Input value={palmares.category} onChange={(e) => onUpdate(pIdx, "category", e.target.value)} placeholder="Ex.: U21" className="bg-background text-foreground placeholder:text-foreground/60" />
              <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomCategory(false); onUpdate(pIdx, "category", ""); }}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <Select value={palmares.category} onValueChange={(v) => v === "__custom__" ? setCustomCategory(true) : onUpdate(pIdx, "category", v)}>
              <SelectTrigger className="bg-background text-foreground"><SelectValue placeholder="Selectează..." /></SelectTrigger>
              <SelectContent>
                {basketballCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                <SelectItem value="__custom__">Altele...</SelectItem>
              </SelectContent>
            </Select>
          )
        ) : (
          <Input value={palmares.category} onChange={(e) => onUpdate(pIdx, "category", e.target.value)} placeholder="Ex.: Seria 1" className="bg-background text-foreground placeholder:text-foreground/60" />
        )}
      </div>
      <div>
        <Label className="text-xs text-foreground font-medium">Sezonul</Label>
        <Select value={palmares.year} onValueChange={(v) => onUpdate(pIdx, "year", v)}>
          <SelectTrigger className="bg-background text-foreground"><SelectValue placeholder="Selectează..." /></SelectTrigger>
          <SelectContent>
            {(() => {
              const currentYear = new Date().getFullYear();
              let startYear = 1970;
              let endYear = currentYear;
              if (entryStartDate) {
                const parsed = new Date(entryStartDate);
                if (!isNaN(parsed.getTime())) startYear = parsed.getFullYear();
              }
              if (entryEndDate) {
                const parsed = new Date(entryEndDate);
                if (!isNaN(parsed.getTime())) endYear = parsed.getFullYear();
              }
              const seasons: string[] = [];
              for (let y = endYear; y >= startYear; y--) {
                seasons.push(`${y}-${y + 1}`);
              }
              return seasons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>);
            })()}
          </SelectContent>
        </Select>
      </div>
      {/* Per-palmares document upload */}
      <div className="col-span-1 sm:col-span-2">
        <PalmaresDocUpload
          documentUrl={palmares.document_url || ""}
          onUpdate={(url) => onUpdate(pIdx, "document_url", url)}
        />
      </div>
    </div>
  );
}

function ProfileTab({ form, profile, editingSection, updateForm, userId, readOnly, SectionEditButton, careerEntries, setCareerEntries, SectionSaveButton, sport, agentSuggestions, showAgentSuggestions, setShowAgentSuggestions, selectedRegisteredAgent, handleAgentNameChange, selectAgent, collaborationStatus, collaborationLoading, cancelCollaborationRequest, acceptedAgent }: {
  form: Partial<PlayerProfile>; profile: PlayerProfile | null; editingSection: EditingSection; updateForm: (k: string, v: any) => void; userId: string; readOnly: boolean; SectionEditButton: React.FC<{ section: EditingSection }>; careerEntries: CareerEntry[]; setCareerEntries: React.Dispatch<React.SetStateAction<CareerEntry[]>>; SectionSaveButton: React.FC; sport?: string; agentSuggestions: AgentSuggestion[]; showAgentSuggestions: boolean; setShowAgentSuggestions: (v: boolean) => void; selectedRegisteredAgent: AgentSuggestion | null; handleAgentNameChange: (v: string) => void; selectAgent: (a: AgentSuggestion) => void; collaborationStatus: "none" | "pending" | "accepted" | "rejected"; collaborationLoading: boolean; cancelCollaborationRequest: () => void; acceptedAgent: AgentSuggestion | null;
}) {
  const { lang, t } = useLanguage();

  const editingPhysical = editingSection === "physical";
  const editingAgent = editingSection === "agent";
  const editingAbout = editingSection === "about";

  const aboutDocs = editingAbout ? (form.about_documents || []) : (profile?.about_documents || []);

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <PlayerStats userId={userId} isOwner={!readOnly} />

      {/* Physical + details */}
      <div className={`grid grid-cols-1 ${!readOnly || profile?.agent_name || profile?.agent_email || profile?.agent_phone ? "sm:grid-cols-2" : ""} gap-4`}>
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
              <div className="flex justify-between"><span className="text-muted-foreground">{t.dashboard.profile.nationality}</span><span className="text-foreground font-semibold">{profile?.nationality ? getDisplayNationality(profile.nationality, lang) : "—"}</span></div>
            </div>
           )}
          {editingPhysical && <SectionSaveButton />}
        </div>

        {(!readOnly || profile?.agent_name || profile?.agent_email || profile?.agent_phone || acceptedAgent) && (
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
          {editingAgent && (
            <p className="text-xs text-muted-foreground mb-3">
              {lang === "ro" ? "Selectează un agent înregistrat sau adaugă manual pentru a trimite o cerere de colaborare" : "Select a registered agent or add manually to send a collaboration request"}
            </p>
          )}
          {editingAgent ? (
            <div className="space-y-3">
              {/* Pending collaboration request */}
              {collaborationStatus === "pending" && selectedRegisteredAgent && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {selectedRegisteredAgent.photo_url ? (
                        <img src={selectedRegisteredAgent.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">{selectedRegisteredAgent.first_name?.[0]}{selectedRegisteredAgent.last_name?.[0]}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{selectedRegisteredAgent.first_name} {selectedRegisteredAgent.last_name}</p>
                      <p className="text-xs text-yellow-500">{lang === "ro" ? "⏳ Cerere în așteptare..." : "⏳ Request pending..."}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelCollaborationRequest}
                      disabled={collaborationLoading}
                      className="text-destructive hover:text-destructive text-xs"
                    >
                      {lang === "ro" ? "Anulează" : "Cancel"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Search field - only show when no pending request */}
              {collaborationStatus !== "pending" && (
                <div className="relative">
                  <Label className="text-xs text-muted-foreground">{t.dashboard.profile.agentName}</Label>
                  <Input
                    value={form.agent_name || ""}
                    onChange={(e) => handleAgentNameChange(e.target.value)}
                    onFocus={() => { if (agentSuggestions.length > 0) setShowAgentSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowAgentSuggestions(false), 200)}
                    className="text-foreground"
                    placeholder={lang === "ro" ? "Caută agent după nume..." : "Search agent by name..."}
                    autoComplete="off"
                  />
                  {showAgentSuggestions && agentSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {agentSuggestions.map((agent) => (
                        <button
                          key={agent.user_id}
                          type="button"
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent text-left transition-colors"
                          onMouseDown={(e) => { e.preventDefault(); selectAgent(agent); }}
                        >
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                            {agent.photo_url ? (
                              <img src={agent.photo_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-muted-foreground">{agent.first_name?.[0]}{agent.last_name?.[0]}</span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{agent.first_name} {agent.last_name}</p>
                            {agent.email && <p className="text-xs text-muted-foreground">{agent.email}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Manual agent email - only when NOT selecting a registered agent */}
              {collaborationStatus !== "pending" && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t.dashboard.profile.agentEmail}</Label>
                  <Input
                    type="email"
                    value={form.agent_email || ""}
                    onChange={(e) => updateForm("agent_email", e.target.value)}
                    className={`text-foreground ${form.agent_email && !form.agent_email.includes("@") ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    placeholder="agent@example.com"
                  />
                  {form.agent_email && !form.agent_email.includes("@") && (
                    <p className="text-xs text-destructive mt-1">{lang === "ro" ? "Adresa de email trebuie să conțină simbolul @" : "Email must contain @"}</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="font-body text-sm space-y-2">
              {acceptedAgent ? (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {acceptedAgent.photo_url ? (
                      <img src={acceptedAgent.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">{acceptedAgent.first_name?.[0]}{acceptedAgent.last_name?.[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {!readOnly && profile?.agent_email ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="text-foreground font-semibold hover:underline text-left">
                            {acceptedAgent.first_name} {acceptedAgent.last_name}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-3">
                          <p className="text-xs text-muted-foreground mb-1">{lang === "ro" ? "Email agent" : "Agent email"}</p>
                          <p className="text-sm text-foreground select-all">{profile.agent_email}</p>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <p className="text-foreground font-semibold">{acceptedAgent.first_name} {acceptedAgent.last_name}</p>
                    )}
                    <p className="text-xs text-primary">{lang === "ro" ? "✓ Colaborare activă" : "✓ Active collaboration"}</p>
                  </div>
                </div>
              ) : profile?.agent_name ? (
                <>
                  <p className="text-foreground font-semibold">{profile.agent_name}</p>
                  {!readOnly && profile.agent_email && <p className="text-muted-foreground">{profile.agent_email}</p>}
                  {!readOnly && profile.agent_phone && <p className="text-muted-foreground">{profile.agent_phone}</p>}
                </>
              ) : collaborationStatus === "pending" && selectedRegisteredAgent ? (
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500">⏳</span>
                  <span className="text-muted-foreground">
                    {lang === "ro" ? `Cerere trimisă către ${selectedRegisteredAgent.first_name} ${selectedRegisteredAgent.last_name}` : `Request sent to ${selectedRegisteredAgent.first_name} ${selectedRegisteredAgent.last_name}`}
                  </span>
                </div>
              ) : (
                <p className="text-muted-foreground">{t.dashboard.profile.noAgent}</p>
              )}
            </div>
          )}
          {editingAgent && collaborationStatus !== "pending" && <SectionSaveButton />}
        </div>
        )}
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
                      // Sync to header if this entry is currently active
                      if (entry.currently_active) {
                        updateForm("current_team", e.target.value);
                      }
                    }}
                    placeholder="Ex.: FC Barcelona"
                    className="bg-background"
                  />
                </div>
                {/* Date overlap validation */}
                {(() => {
                  const otherEntries = careerEntries.filter((_, i) => i !== idx).filter(e => e.start_date);
                  const hasOverlap = otherEntries.some(other => {
                    if (!entry.start_date) return false;
                    const s1 = new Date(entry.start_date).getTime();
                    const e1 = entry.currently_active ? Infinity : (entry.end_date ? new Date(entry.end_date).getTime() : s1);
                    const s2 = new Date(other.start_date).getTime();
                    const e2 = other.currently_active ? Infinity : (other.end_date ? new Date(other.end_date).getTime() : s2);
                    return s1 <= e2 && s2 <= e1;
                  });
                  return hasOverlap ? (
                    <p className="text-xs text-destructive font-medium">⚠ Perioadele se suprapun cu o altă echipă. Verifică datele.</p>
                  ) : null;
                })()}
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
                      className="bg-background text-foreground [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-foreground font-medium">Data sfârșit</Label>
                    <Input
                      type="date"
                      value={entry.end_date}
                      min={entry.start_date || undefined}
                      onChange={(e) => {
                        const updated = [...careerEntries];
                        updated[idx] = { ...entry, end_date: e.target.value };
                        setCareerEntries(updated);
                      }}
                      disabled={entry.currently_active}
                      className="bg-background text-foreground [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`currently-active-${idx}`}
                    checked={entry.currently_active}
                    onCheckedChange={(checked) => {
                      const updated = [...careerEntries];
                      // If checking this one, uncheck all others
                      if (checked) {
                        updated.forEach((e, i) => { if (i !== idx) updated[i] = { ...e, currently_active: false }; });
                      }
                      updated[idx] = { ...entry, currently_active: !!checked, end_date: checked ? "" : entry.end_date };
                      setCareerEntries(updated);
                      // Sync current_team in header
                      if (checked && entry.team_name) {
                        updateForm("current_team", entry.team_name);
                      } else if (!checked) {
                        // Check if any other entry is still active
                        const otherActive = updated.find((e, i) => i !== idx && e.currently_active);
                        updateForm("current_team", otherActive?.team_name || "");
                      }
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
                  sport={sport}
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
            <SectionSaveButton />
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
                  {entry.description && (() => {
                    try {
                      const parsed = JSON.parse(entry.description);
                      const items = Array.isArray(parsed) ? parsed : [parsed];
                      const validItems = items.filter((p: any) => p.place || p.championship || p.category || p.year);
                      if (validItems.length === 0) return null;
                      return validItems.map((p: any, pIdx: number) => {
                         const categoryLabel = sport === "basketball" ? "Categorie" : "Grupa/Seria";
                         const parts = [p.place, p.championship, p.category ? `${categoryLabel} ${p.category}` : null, p.year ? `Sezonul ${p.year}` : null].filter(Boolean);
                         return (
                           <div key={pIdx} className="mt-1">
                             <p className="text-xs text-foreground/70">🏆 {parts.join(" • ")}</p>
                             {p.document_url && (
                               <button type="button" onClick={() => window.open(p.document_url, '_blank')} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
                                 <FileText className="h-3 w-3" /> Document atașat
                               </button>
                             )}
                           </div>
                         );
                      });
                    } catch {
                      return <p className="text-xs text-foreground/70 mt-1">{entry.description}</p>;
                    }
                  })()}
                </div>
              ))
            ) : (
              <p className="italic text-muted-foreground text-sm">{t.dashboard.profile.noDescription}</p>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

/* ======================== VIDEO TAB ======================== */
function VideoTab({ form, profile, editingSection, newVideoUrl, setNewVideoUrl, addVideoUrl, removeVideoUrl, updateForm, SectionEditButton, SectionSaveButton }: {
  form: Partial<PlayerProfile>; profile: PlayerProfile | null; editingSection: EditingSection;
  newVideoUrl: string; setNewVideoUrl: (v: string) => void; addVideoUrl: () => void; removeVideoUrl: (i: number) => void; updateForm: (k: string, v: any) => void; SectionEditButton: React.FC<{ section: EditingSection }>; SectionSaveButton: React.FC;
}) {
  return (
    <div className="space-y-8">
      <VideoSection
        title="VIDEO HIGHLIGHTS"
        section="video"
        videosKey="video_highlights"
        descriptionsKey="video_descriptions"
        form={form}
        profile={profile}
        editing={editingSection === "video"}
        updateForm={updateForm}
        SectionEditButton={SectionEditButton}
        SectionSaveButton={SectionSaveButton}
        useSharedNewUrl
        newVideoUrl={newVideoUrl}
        setNewVideoUrl={setNewVideoUrl}
      />
      <VideoSection
        title="VIDEO FULL MATCH REPLAY"
        section="video_full_match"
        videosKey="full_match_videos"
        descriptionsKey="full_match_descriptions"
        form={form}
        profile={profile}
        editing={editingSection === "video_full_match"}
        updateForm={updateForm}
        SectionEditButton={SectionEditButton}
        SectionSaveButton={SectionSaveButton}
      />
    </div>
  );
}

function VideoSection({
  title,
  section,
  videosKey,
  descriptionsKey,
  form,
  profile,
  editing,
  updateForm,
  SectionEditButton,
  SectionSaveButton,
  useSharedNewUrl = false,
  newVideoUrl: externalNewUrl,
  setNewVideoUrl: setExternalNewUrl,
}: {
  title: string;
  section: EditingSection;
  videosKey: string;
  descriptionsKey: string;
  form: Partial<PlayerProfile>;
  profile: PlayerProfile | null;
  editing: boolean;
  updateForm: (k: string, v: any) => void;
  SectionEditButton: React.FC<{ section: EditingSection }>;
  SectionSaveButton: React.FC;
  useSharedNewUrl?: boolean;
  newVideoUrl?: string;
  setNewVideoUrl?: (v: string) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [localNewUrl, setLocalNewUrl] = useState("");
  const [newVideoDescription, setNewVideoDescription] = useState("");

  const newUrl = useSharedNewUrl ? (externalNewUrl ?? "") : localNewUrl;
  const setNewUrl = useSharedNewUrl ? (setExternalNewUrl ?? (() => {})) : setLocalNewUrl;

  const videos: string[] = editing ? ((form as any)[videosKey] || []) : ((profile as any)?.[videosKey] || []);
  const descriptions: string[] = editing ? ((form as any)[descriptionsKey] || []) : ((profile as any)?.[descriptionsKey] || []);

  const addVideoWithDescription = () => {
    if (!newUrl.trim()) return;
    const currentVideos: string[] = (form as any)[videosKey] || [];
    const currentDescs: string[] = (form as any)[descriptionsKey] || [];
    updateForm(videosKey, [...currentVideos, newUrl.trim()]);
    updateForm(descriptionsKey, [...currentDescs, newVideoDescription.trim()]);
    setNewUrl("");
    setNewVideoDescription("");
  };

  const removeVideoWithDescription = (index: number) => {
    const currentVideos: string[] = (form as any)[videosKey] || [];
    const currentDescs: string[] = (form as any)[descriptionsKey] || [];
    updateForm(videosKey, currentVideos.filter((_, i) => i !== index));
    updateForm(descriptionsKey, currentDescs.filter((_, i) => i !== index));
  };

  const updateDescription = (index: number, value: string) => {
    const currentDescs: string[] = [...((form as any)[descriptionsKey] || [])];
    while (currentDescs.length <= index) currentDescs.push("");
    currentDescs[index] = value;
    updateForm(descriptionsKey, currentDescs);
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
      const currentVideos: string[] = (form as any)[videosKey] || [];
      const currentDescs: string[] = (form as any)[descriptionsKey] || [];
      updateForm(videosKey, [...currentVideos, urlData.publicUrl]);
      updateForm(descriptionsKey, [...currentDescs, ""]);

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
        <h4 className="font-display text-lg text-foreground uppercase tracking-wide">{title}</h4>
        <SectionEditButton section={section} />
      </div>
      {editing && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground font-body mb-2 block">{t.dashboard.profile.addVideo}</Label>
            <div className="flex gap-2">
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder={t.dashboard.profile.videoPlaceholder}
                className="flex-1 text-foreground"
                onKeyDown={(e) => e.key === "Enter" && addVideoWithDescription()}
              />
              <Button onClick={addVideoWithDescription} size="sm"><Plus className="h-4 w-4 mr-1" />{t.dashboard.profile.addBtn}</Button>
            </div>
          </div>
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
      {editing && <SectionSaveButton />}
    </div>
  );
}


/* ======================== POSTS TAB ======================== */
function PostsTab({ userId, readOnly = false }: { userId: string; readOnly?: boolean }) {
  const { lang } = useLanguage();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authorInfo, setAuthorInfo] = useState<{ name: string; photo: string | null; role: string; title: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);

      // Fetch posts from both tables
      const [postsRes, scoutPostsRes] = await Promise.all([
        supabase.from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("scout_posts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);

      const allPosts = [
        ...(postsRes.data || []).map(p => ({ ...p, video_url: p.video_url || null })),
        ...(scoutPostsRes.data || []).map(p => ({ ...p, post_type: "scout", video_url: null })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setPosts(allPosts);

      // Fetch author info
      const [playerRes, scoutRes, roleRes] = await Promise.all([
        supabase.from("player_profiles").select("first_name, last_name, photo_url").eq("user_id", userId).maybeSingle(),
        supabase.from("scout_profiles").select("first_name, last_name, photo_url, title").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);

      const role = roleRes.data?.role || "player";
      if (role === "player" && playerRes.data) {
        setAuthorInfo({ name: `${playerRes.data.first_name} ${playerRes.data.last_name}`.trim(), photo: playerRes.data.photo_url, role, title: "" });
      } else if (scoutRes.data) {
        setAuthorInfo({ name: `${scoutRes.data.first_name} ${scoutRes.data.last_name}`.trim(), photo: scoutRes.data.photo_url, role, title: scoutRes.data.title || "" });
      }

      setLoading(false);
    };
    fetchPosts();
  }, [userId]);

  const handleDelete = useCallback(async (postId: string) => {
    await supabase.from("posts").delete().eq("id", postId);
    await supabase.from("scout_posts").delete().eq("id", postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const handleViewProfile = useCallback(() => {}, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12 font-body">
        {lang === "ro" ? "Nicio postare încă." : "No posts yet."}
      </p>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {posts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          author={{
            user_id: userId,
            name: authorInfo?.name || "",
            photo: authorInfo?.photo || null,
            role: authorInfo?.role || "player",
            title: authorInfo?.title || "",
          }}
          currentUserId={currentUserId}
          onDelete={handleDelete}
          onViewProfile={handleViewProfile}
        />
      ))}
    </div>
  );
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default PersonalProfile;
