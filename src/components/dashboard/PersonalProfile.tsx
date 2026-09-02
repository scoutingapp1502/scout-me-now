import { Fragment, useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TeamNameInput from "@/components/ui/team-name-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, Edit2, MapPin, Instagram, Twitter, Youtube, Plus, Trash2, Upload, Loader2, FileText, X, Info, Calendar, GripVertical, ChevronsUpDown, Check, MessageCircle, UserPlus, UserCheck, Users, Lock, Clock, CheckCircle, XCircle, Play } from "lucide-react";
import MessageDialog from "./MessageDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import PostCard from "./PostCard";
import NewPostComposer from "./NewPostComposer";
import NewsAnnouncementsPanel from "./NewsAnnouncementsPanel";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKeys, Language } from "@/i18n/translations";
import { translatePosition, translateFootHandValue } from "@/lib/positionTranslations";
import { translateTestLabel, translateTestDescription } from "@/lib/testTranslations";
import PlayerStats from "./PlayerStats";
import NationalityInput, { getDisplayNationality } from "@/components/ui/nationality-input";
import { useFollowers } from "@/hooks/useFollowers";
import { useAccountLock } from "@/hooks/useAccountLock";
import FollowersList from "./FollowersList";
import { useTestUnlocks } from "@/hooks/useTestUnlocks";
import { Progress } from "@/components/ui/progress";
import { Lock as LockIcon, Gift } from "lucide-react";
import RecommendationsSection from "./RecommendationsSection";
const LazyPersonalProfile = lazy(() => import("./PersonalProfile"));
const LazyScoutPersonalProfile = lazy(() => import("./ScoutPersonalProfile"));
import StreakBadges, { getNextBadgeMilestone } from "./StreakBadges";
import ScoutPlayerNoteDialog from "./ScoutPlayerNoteDialog";
import ScoutPlayerReportDialog from "./ScoutPlayerReportDialog";
import { ClipboardList, ChevronDown, ChevronUp, FileBarChart, RotateCcw } from "lucide-react";
import InviteFriendsModal from "./InviteFriendsModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useVideoSubmissions, submitVideoSubmission } from "@/hooks/useVideoSubmissions";
import { useTestReferenceVideos } from "@/hooks/useTestReferenceVideos";
import { useClubLogos } from "@/hooks/useClubLogos";
import AddStoryModal from "./AddStoryModal";
import StoryViewer from "./StoryViewer";
import StoryArchiveModal from "./StoryArchiveModal";

// Stories feature is temporarily disabled. Flip back to true to re-enable.
const STORIES_ENABLED = false;

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
  forceActiveTab?: TabType | null;
  onForceTabHandled?: () => void;
}

const LOCALE_BY_LANG: Record<string, string> = {
  ro: "ro-RO", en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT",
};

// Career dates only ever store a year now (e.g. "2019"); pull the year out directly
// instead of round-tripping through Date/toLocaleDateString to avoid timezone drift.
const careerYear = (dateStr: string | undefined | null): string => (dateStr ? dateStr.slice(0, 4) : "");

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

export interface TechnicalTest {
  key: string;
  label: string;
  icon: string;
  description: string;
  inputKey: string;
  uploadId: string;
  storagePath: string;
}

export interface AthleticTest extends TechnicalTest {
  videoKey: string;
}

export const athleticTests: AthleticTest[] = [
  { key: "speed", label: "Pro Line Drill", icon: "⚡", description: "Configurare: Un traseu drept, marcat cu jaloane la fiecare 5 metri, pe o distanță totală de 20-30 metri.\n\nExercițiu: Sportivul aleargă la viteză maximă pe toată distanța. Se cronometrează timpul de execuție pentru a evalua viteza de sprint.", videoKey: "speed_video", inputKey: "_speed_video_input", uploadId: "speed-video-upload", storagePath: "pro-line-drill" },
  { key: "jumping", label: "2 Foots Vertical Jump", icon: "🦘", description: "Configurare: Sportivul se poziționează cu picioarele apropiate, lângă un perete sau un dispozitiv de măsurare a săriturii.\n\nExercițiu: Din poziție statică, cu ambele picioare, sportivul sare pe verticală cât mai sus posibil. Se măsoară înălțimea săriturii.", videoKey: "jumping_video", inputKey: "_jumping_video_input", uploadId: "jumping-video-upload", storagePath: "vertical-jump" },
  { key: "endurance", label: "Shuttle Run", icon: "💪", description: "Configurare: Două linii marcate la o distanță de 10 metri una de cealaltă.\n\nExercițiu: Sportivul aleargă dus-întors între cele două linii de mai multe ori, la viteză maximă, schimbând direcția la fiecare linie. Se cronometrează timpul total.", videoKey: "endurance_video", inputKey: "_endurance_video_input", uploadId: "endurance-video-upload", storagePath: "shuttle-run" },
  { key: "acceleration", label: "2 Foots Vertical Jump in action", icon: "🚀", description: "Configurare: Similar cu săritura pe verticală, dar precedată de o alergare scurtă de acumulare (3-5 metri).\n\nExercițiu: Sportivul realizează o cursă scurtă de elan, apoi sare pe verticală cu ambele picioare cât mai sus posibil. Se măsoară înălțimea săriturii din mișcare.", videoKey: "acceleration_video", inputKey: "_acceleration_video_input", uploadId: "acceleration-video-upload", storagePath: "vertical-jump-action" },
];

const athleticTestUnits: Record<string, string> = {
  speed_video: "s",
  jumping_video: "cm",
  endurance_video: "s",
  acceleration_video: "cm",
};

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

export const getTestLabelByKey = (sport: string | null | undefined, key: string, lang: Language = "ro"): string => {
  const tests = getTechnicalTestsBySport(sport);
  const test = tests.find((t) => t.key === key);
  return test ? translateTestLabel(test.key, test.label, lang) : key;
};

export const getTestRefKey = (test: TechnicalTest): string => (test as AthleticTest).videoKey || test.key;

const TestInfoContent = ({ test, referenceVideoUrl }: { test: TechnicalTest; referenceVideoUrl?: string | null }) => {
  const { lang, t } = useLanguage();
  const tt = t.dashboard.tests;
  const [showVideo, setShowVideo] = useState(false);
  const [videoError, setVideoError] = useState(false);

  if (showVideo) {
    return (
      <div>
        {referenceVideoUrl && !videoError ? (
          <video
            src={referenceVideoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full rounded-md"
            onError={() => setVideoError(true)}
          />
        ) : (
          <div className="w-full rounded-md bg-gray-100 flex items-center justify-center py-8 text-xs text-gray-500 text-center px-4">
            {tt.videoUnavailable}
          </div>
        )}
        <button
          onClick={() => { setShowVideo(false); setVideoError(false); }}
          className="mt-2 text-xs text-gray-900 hover:font-semibold font-body"
        >
          {tt.backToDescription}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="font-semibold mb-1 text-gray-900">{test.icon} {translateTestLabel(test.key, test.label, lang)}</p>
      <p className="text-gray-500 text-xs whitespace-pre-line">{translateTestDescription(test.key, test.description, lang)}</p>
      <div className="flex justify-end mt-3">
        <Button
          size="sm"
          className="text-xs gap-1.5 h-7 px-3 bg-orange-500 hover:bg-orange-600 text-white"
          onClick={() => setShowVideo(true)}
        >
          <Play className="h-3 w-3 fill-current" />
          {tt.videoBtn}
        </Button>
      </div>
    </div>
  );
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

const PersonalProfile = ({ userId, readOnly = false, onNavigateToChat, forceActiveTab, onForceTabHandled }: PersonalProfileProps) => {
  const { toast } = useToast();
  const { lang, t } = useLanguage();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<PlayerProfile>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  useEffect(() => {
    if (forceActiveTab) {
      setActiveTab(forceActiveTab);
      onForceTabHandled?.();
    }
  }, [forceActiveTab]);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [careerEntries, setCareerEntries] = useState<CareerEntry[]>([]);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const { isLocked: viewerLocked } = useAccountLock(viewerUserId, viewerRole);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showAddStory, setShowAddStory] = useState(false);
  const [hasStory, setHasStory] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [followStatus, setFollowStatus] = useState<"none" | "pending" | "accepted" | "rejected">("none");
  const [followLoading, setFollowLoading] = useState(false);
  const [recAuthorView, setRecAuthorView] = useState<{ userId: string; role: string } | null>(null);
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
  const { logos: clubLogosList, getLogoForTeam } = useClubLogos();
  const currentTeamLogoUrl = getLogoForTeam(form.current_team, currentSport);
  const teamNameSuggestions = clubLogosList.filter((l) => l.sport === currentSport).map((l) => l.club_name);

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
      const { error } = await supabase
        .from("agent_collaboration_requests")
        .delete()
        .eq("player_user_id", userId);
      if (error) throw error;
      setCollaborationStatus("none");
      setSelectedRegisteredAgent(null);
      toast({ title: lang === "ro" ? "Cererea a fost anulată" : "Request cancelled" });
    } catch (err) {
      console.error(err);
      toast({ title: lang === "ro" ? "Eroare" : "Error", description: lang === "ro" ? "Cererea nu a putut fi anulată." : "Failed to cancel the request.", variant: "destructive" });
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
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setViewerUserId(user?.id ?? null);
      if (user?.id) {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
        setViewerRole((data?.role as string) ?? null);
      }
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
      const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
      if (!error) setFollowStatus("none");
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

      // Technical test video fields are sport-specific (basketball vs.
      // football tests use different columns). Resolve them dynamically
      // instead of hardcoding one sport's set, and fall back to a typed
      // URL the user forgot to confirm with the "+" button so it isn't
      // silently dropped.
      const technicalVideoFields: Record<string, any> = {};
      getTechnicalTestsBySport((form as any).sport || currentSport).forEach((t) => {
        const pendingUrl = (form as any)[t.inputKey]?.trim();
        technicalVideoFields[t.key] = (form as any)[t.key] || pendingUrl || (profile as any)?.[t.key] || null;
      });

      const payload = {
          first_name: form.first_name,
          last_name: form.last_name,
          bio: form.bio,
          position: form.position,
          jersey_number: (form as any).jersey_number ?? null,
          preferred_foot: form.preferred_foot,
          nationality: form.nationality,
          date_of_birth: form.date_of_birth,
          height_cm: form.height_cm,
          weight_kg: form.weight_kg,
          wingspan_cm: form.wingspan_cm,
          father_height_cm: (form as any).father_height_cm ?? null,
          mother_height_cm: (form as any).mother_height_cm ?? null,
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
          avatar_pos_x: (form as any).avatar_pos_x ?? 50,
          avatar_pos_y: (form as any).avatar_pos_y ?? 50,
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
          ...technicalVideoFields,
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

      // Technical test videos are saved as plain player_profiles columns
      // above, but the admin review queue is a separate video_submissions
      // row per test — submit one for every technical test video that was
      // actually changed in this save (skip unchanged ones so we don't
      // reset an already-reviewed submission back to "pending").
      if (editingSection === "technical") {
        for (const [testKey, videoUrl] of Object.entries(technicalVideoFields)) {
          const previousUrl = (profile as any)?.[testKey];
          if (videoUrl && videoUrl !== previousUrl) {
            await submitVideoSubmission(testKey, videoUrl, userId);
          }
        }
      }

      // Save career entries if editing about section
      if (editingSection === "about") {
        // Drop entries the player left blank (added by mistake, never filled in)
        const filledEntries = careerEntries.filter((e) => e.team_name.trim());
        // Check for date overlaps
        const hasOverlap = filledEntries.some((entry, idx) => {
          if (!entry.start_date) return false;
          return filledEntries.some((other, otherIdx) => {
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
        if (filledEntries.length > 0) {
          // Sort chronologically by start_date before saving
          const sorted = [...filledEntries].sort((a, b) => {
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
        } else {
          setCareerEntries([]);
        }
        // Sync current_team from active career entry
        const activeEntry = filledEntries.find(e => e.currently_active);
        const newCurrentTeam = activeEntry?.team_name || "";
        await supabase.from("player_profiles").update({ current_team: newCurrentTeam }).eq("user_id", userId);
        updateForm("current_team", newCurrentTeam);
      }

      toast({ title: t.dashboard.profile.profileUpdated });
      setEditingSection(null);
      setAvatarFile(null);
      await fetchProfile();
      await fetchCareerEntries();
      window.dispatchEvent(new Event("profile-updated"));
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
        className="group text-gray-900 hover:text-gray-400 transition-colors p-1"
        aria-label="Editează"
      >
        <Edit2 className="h-4 w-4 stroke-[2.5] group-hover:stroke-[1.5]" />
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
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-5"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          {t.dashboard.tests.saveBtn}
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

  // Check active stories — must be before any early returns (Rules of Hooks)
  useEffect(() => {
    if (!STORIES_ENABLED) return;
    (supabase as any)
      .from("stories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .then(({ count }: { count: number | null }) => setHasStory((count ?? 0) > 0))
      .catch((err: unknown) => console.error("Failed to check active stories:", err));
  }, [userId]);

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
        isLocked={viewerLocked}
      />
    );
  }

  return (
    <div className={`relative isolate ${activeTab === "posts" || activeTab === "profile" || activeTab === "stats" || activeTab === "video" ? "w-full" : "max-w-4xl mx-auto"}`}>
      <div className={activeTab === "profile" || activeTab === "stats" || activeTab === "video" ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start" : ""}>
      <div className="min-w-0">
      {/* SECTION 1: Header / Hero - sticky */}
      <div className="z-20 rounded-xl overflow-hidden">
      {activeTab !== "posts" && (
      <div className="relative bg-white rounded-t-xl overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)`,
          backgroundSize: '30px 30px'
        }} />
        <div className="relative flex flex-col sm:flex-row flex-wrap items-center sm:items-start gap-4 sm:gap-6 p-4 sm:p-8">
          {/* FIFA-style card - always visible, top-left */}
          <div className="order-0 shrink-0">
            <FifaPlayerCard
              form={form}
              profile={profile}
              photoSrc={photoSrc}
              userId={userId}
              hasStory={STORIES_ENABLED && hasStory}
              onOpenStory={() => setShowStoryViewer(true)}
              onAddStory={() => setShowAddStory(true)}
              showAddStoryButton={STORIES_ENABLED && !readOnly && editingSection !== "header"}
              isEditingHeader={editingSection === "header"}
              onAvatarChange={handleAvatarChange}
              avatarPosX={(form as any).avatar_pos_x}
              avatarPosY={(form as any).avatar_pos_y}
              onAvatarPositionChange={(x, y) => { updateForm("avatar_pos_x", x); updateForm("avatar_pos_y", y); }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 w-full text-center sm:text-left order-2 sm:order-1 flex flex-col sm:self-stretch relative">
            {currentTeamLogoUrl && editingSection !== "header" && (
              <div className="hidden sm:flex absolute top-0 right-0 h-28 w-28 items-center justify-center bg-white rounded-lg shadow-sm p-2">
                <img
                  src={currentTeamLogoUrl}
                  alt={form.current_team || ""}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            {editingSection === "header" ? (
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <Input value={form.first_name || ""} onChange={(e) => updateForm("first_name", e.target.value)} placeholder={t.dashboard.profile.firstName} className="bg-gray-100 border-gray-300 text-gray-900 font-display text-lg sm:text-2xl h-auto py-1 min-w-0 focus-visible:ring-1 focus-visible:ring-gray-900" />
                <Input value={form.last_name || ""} onChange={(e) => updateForm("last_name", e.target.value)} placeholder={t.dashboard.profile.lastName} className="bg-gray-100 border-gray-300 text-gray-900 font-display text-lg sm:text-2xl h-auto py-1 min-w-0 focus-visible:ring-1 focus-visible:ring-gray-900" />
              </div>
            ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-3xl sm:text-5xl text-gray-900 tracking-wide uppercase leading-tight">
                {(() => {
                  const fullName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
                  if (!fullName) return t.dashboard.profile.completeProfile;
                  const words = fullName.split(/\s+/).filter(Boolean);
                  if (words.length >= 3) {
                    return (
                      <>
                        <span className="block">{words.slice(0, -1).join(" ")}</span>
                        <span className="block">{words[words.length - 1]}</span>
                      </>
                    );
                  }
                  return fullName;
                })()}
              </h1>
              {!unlocks.loading && unlocks.loginStreak > 0 && (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="relative h-12 w-12 flex items-center justify-center cursor-help select-none drop-shadow-[0_0_8px_rgba(251,146,60,0.5)] hover:scale-110 transition-transform shrink-0"
                        aria-label={`${t.dashboard.tests.activeStreakTitle}: ${unlocks.loginStreak} ${t.dashboard.tests.daysConsecutiveWord}`}
                      >
                        <span className="text-4xl leading-none" aria-hidden="true">🔥</span>
                        <span className="absolute inset-0 flex items-center justify-center pt-1.5 font-display text-[13px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                          {unlocks.loginStreak}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px] bg-white border-gray-200 text-gray-900 shadow-lg">
                      <p className="font-display text-xs uppercase tracking-wide text-gray-900">{t.dashboard.tests.activeStreakTitle}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {unlocks.loginStreak} {unlocks.loginStreak === 1 ? t.dashboard.tests.dayConsecutiveWord : t.dashboard.tests.daysConsecutiveWord} {t.dashboard.tests.activeStreakDescSuffix}
                      </p>
                      {unlocks.bestLoginStreak > unlocks.loginStreak && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          {t.dashboard.tests.personalRecordLabel} {unlocks.bestLoginStreak} {unlocks.bestLoginStreak === 1 ? t.dashboard.tests.dayWord : t.dashboard.tests.daysWord}
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
              <p className="text-gray-500 font-body text-sm mt-1">
                {profile.gender === "male" ? t.auth.genderMale : t.auth.genderFemale}
              </p>
            )}

            {editingSection === "header" ? (
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <Select value={form.position || ""} onValueChange={(v) => updateForm("position", v)}>
                  <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900 w-full sm:w-48 focus:ring-1 focus:ring-gray-900">
                    <SelectValue placeholder={t.dashboard.profile.position} />
                    <SelectValue placeholder="Poziție" />
                  </SelectTrigger>
                  <SelectContent>
                    {(positionsBySport[form.sport || profile?.sport || "football"] || positionsBySport["football"]).map((p) => <SelectItem key={p} value={p}>{translatePosition(p, lang)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  max={99}
                  value={(form as any).jersey_number ?? ""}
                  onChange={(e) => updateForm("jersey_number", e.target.value ? parseInt(e.target.value, 10) : null)}
                  placeholder={lang === "ro" ? "Nr. tricou" : "Shirt no."}
                  className="bg-gray-100 border-gray-300 text-gray-900 w-full sm:w-24 focus-visible:ring-1 focus-visible:ring-gray-900"
                />
              </div>
            ) : (
              <p className="text-gray-500 font-body text-sm sm:text-base mt-1">
                {form.position ? <span className="text-gray-500 font-semibold">{translatePosition(form.position, lang)}</span> : (readOnly ? null : <span className="text-muted-foreground italic">{t.dashboard.profile.addPosition}</span>)}
                {form.current_team && <span> · {form.current_team}</span>}
              </p>
            )}

            {/* Nationality, DOB & Social icons */}
            {editingSection !== "header" && (
              <div className="flex items-center justify-center sm:justify-between gap-6 mt-4 pt-3 sm:pt-[calc(0.75rem+0.8cm)] border-t border-gray-200 flex-wrap sm:pr-[calc(2.5rem+0.5cm)]">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 font-body">{t.dashboard.profile.nationality}</span>
                  <span className="text-base font-semibold text-gray-900 font-body mt-0.5">
                    {profile?.nationality ? getDisplayNationality(profile.nationality, lang, profile?.gender) : (readOnly ? "" : <span className="italic text-muted-foreground font-normal">{t.dashboard.profile.addNationality || "Adaugă naționalitate"}</span>)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 font-body">{t.dashboard.profile.birthDate}</span>
                  <span className="text-base font-semibold text-gray-900 font-body mt-0.5">
                    {profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : (readOnly ? "" : <span className="italic text-muted-foreground font-normal">{t.dashboard.profile.addDob || "Adaugă data nașterii"}</span>)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 font-body">{t.dashboard.profile.addSocial || "Rețele de socializare"}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {profile?.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:text-primary transition-colors"><Instagram className="h-5 w-5" /></a>}
                    {profile?.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:text-primary transition-colors"><Twitter className="h-5 w-5" /></a>}
                    {!profile?.instagram_url && !profile?.twitter_url && !readOnly && <span className="text-muted-foreground italic text-sm font-body font-normal">—</span>}
                  </div>
                </div>
              </div>
            )}
            {editingSection === "header" && (
              <div className="flex flex-col gap-2 mt-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <NationalityInput value={form.nationality || ""} onChange={(val) => updateForm("nationality", val)} placeholder={t.dashboard.profile.nationality} gender={form.gender} className="bg-gray-100 border-gray-300 text-gray-900 text-xs min-w-0 focus-visible:ring-1 focus-visible:ring-gray-900" />
                  <Input type="date" value={form.date_of_birth || ""} onChange={(e) => updateForm("date_of_birth", e.target.value)} placeholder={t.dashboard.profile.birthDate} className="bg-gray-100 border-gray-300 text-gray-900 text-xs min-w-0 focus-visible:ring-1 focus-visible:ring-gray-900" />
                </div>
                <div className="flex flex-col gap-2">
                  <Input value={form.instagram_url || ""} onChange={(e) => updateForm("instagram_url", e.target.value)} placeholder="Instagram URL" className="bg-gray-100 border-gray-300 text-gray-900 text-xs min-w-0 focus-visible:ring-1 focus-visible:ring-gray-900" />
                  <Input value={form.twitter_url || ""} onChange={(e) => updateForm("twitter_url", e.target.value)} placeholder="Twitter/X URL" className="bg-gray-100 border-gray-300 text-gray-900 text-xs min-w-0 focus-visible:ring-1 focus-visible:ring-gray-900" />
                  <Input value={form.tiktok_url || ""} onChange={(e) => updateForm("tiktok_url", e.target.value)} placeholder="TikTok URL" className="bg-gray-100 border-gray-300 text-gray-900 text-xs min-w-0 focus-visible:ring-1 focus-visible:ring-gray-900" />
                </div>
              </div>
            )}
            {/* Follower count */}
            {editingSection !== "header" && (
              <div className="mt-3 sm:mt-auto">
                <button
                  onClick={() => !readOnly && setShowFollowersList(!showFollowersList)}
                  className={`flex items-center gap-1.5 text-sm font-body ${!readOnly ? "hover:text-primary cursor-pointer" : "cursor-default"} transition-colors`}
                >
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-gray-900">{followerCount}</span>
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
                          disabled={followStatus !== "accepted" || viewerLocked}
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-body gap-2 disabled:opacity-50"
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
                  {followStatus === "accepted"
                    ? (lang === "ro" ? "Urmărești" : "Following")
                    : followStatus === "pending"
                      ? (lang === "ro" ? "Cerere trimisă" : "Request sent")
                      : (lang === "ro" ? "Urmărește" : "Follow")}
                </Button>
                {viewerRole === "cauta_jucator" && viewerUserId && viewerUserId !== userId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={viewerLocked}
                        className="font-body gap-2 border-purple-300 text-purple-600 hover:bg-purple-50 hover:text-purple-600"
                      >
                        <ClipboardList className="h-4 w-4" />
                        {lang === "ro" ? "Acțiuni" : "Actions"}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowNoteDialog(true)} className="gap-2 cursor-pointer">
                        <ClipboardList className="h-4 w-4" />
                        {lang === "ro" ? "Notiță jucător" : "Player note"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowReportDialog(true)} className="gap-2 cursor-pointer">
                        <FileBarChart className="h-4 w-4" />
                        {lang === "ro" ? "Raport jucător" : "Player report"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>



          {/* Edit pencil for header */}
          {!readOnly && (
            <div className="absolute top-3 right-3 z-10" data-tour="profile-edit">
              <SectionEditButton section="header" />
            </div>
          )}
          {editingSection === "header" && (
            <div className="w-full flex justify-end mt-4 order-3">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                {t.dashboard.tests.saveBtn}
              </Button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Tabs row (no edit button) */}
      <div className={`flex items-stretch border-b border-gray-200 bg-white z-20 ${activeTab === "posts" ? "rounded-xl" : "rounded-b-xl"}`}>
        <div className="flex flex-1 overflow-x-auto">
          {([
            { key: "profile" as TabType, label: lang === "ro" ? "Profil" : "Profile" },
            { key: "stats" as TabType, label: lang === "ro" ? "Teste" : "Tests" },
            { key: "video" as TabType, label: "Video" },
            { key: "posts" as TabType, label: lang === "ro" ? "Postări" : "Posts" },
          ]).map((tab) => (
            <button
              key={tab.key}
              data-tour={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 sm:px-6 py-3 font-display text-base sm:text-lg tracking-wide transition-colors relative whitespace-nowrap
                ${activeTab === tab.key
                  ? "text-orange-500"
                  : "text-gray-900 hover:text-orange-500"
                }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-orange-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Decorative geometric shape between hero and stats */}
      {activeTab !== "video" && activeTab !== "posts" && (
        <div className="relative h-0 overflow-visible">
          <div
            className="absolute -z-10 pointer-events-none"
            style={{
              top: "-40px",
              left: "-60px",
              width: "150px",
              height: "150px",
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              clipPath: "polygon(0 0, 100% 0, 0 100%)",
              opacity: 0.9,
            }}
          />
          <div
            className="absolute -z-10 pointer-events-none"
            style={{
              top: "-120px",
              right: "-24px",
              width: "460px",
              height: "460px",
              background: "linear-gradient(135deg, #f97316, #fb923c)",
              clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
              opacity: 0.9,
            }}
          />
        </div>
      )}

      {/* SECTION 2: Tab content */}
      <div className={`mt-6 pb-8 ${activeTab === "stats" || activeTab === "profile" || activeTab === "video" ? "" : "px-2 sm:px-6"}`}>
        {activeTab === "stats" && <StatsTab form={form} profile={profile} editingSection={editingSection} setEditingSection={setEditingSection} updateForm={updateForm} photoSrc={photoSrc} userId={userId} viewerUserId={viewerUserId} SectionEditButton={SectionEditButton} SectionSaveButton={SectionSaveButton} readOnly={readOnly} />}
        {activeTab === "profile" && <ProfileTab form={form} profile={profile} editingSection={editingSection} updateForm={updateForm} userId={userId} readOnly={readOnly} SectionEditButton={SectionEditButton} careerEntries={careerEntries} setCareerEntries={setCareerEntries} SectionSaveButton={SectionSaveButton} sport={currentSport} agentSuggestions={agentSuggestions} showAgentSuggestions={showAgentSuggestions} setShowAgentSuggestions={setShowAgentSuggestions} selectedRegisteredAgent={selectedRegisteredAgent} handleAgentNameChange={handleAgentNameChange} selectAgent={selectAgent} collaborationStatus={collaborationStatus} collaborationLoading={collaborationLoading} cancelCollaborationRequest={cancelCollaborationRequest} acceptedAgent={acceptedAgent} photoSrc={photoSrc} teamNameSuggestions={teamNameSuggestions} />}
        {activeTab === "profile" && (
          <div className="mt-6">
            <RecommendationsSection
              profileUserId={userId}
              viewerUserId={viewerUserId}
              isOwner={!readOnly || viewerUserId === userId}
              onViewProfile={(uid, role) => setRecAuthorView({ userId: uid, role })}
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
        {activeTab === "posts" && (
          <>
          {/* Decorative geometric shapes above the posts feed, matching the Activitate page */}
          <div className="relative h-0 overflow-visible">
            <div
              className="absolute -z-10 pointer-events-none"
              style={{
                top: "-150px",
                right: "60px",
                width: "170px",
                height: "170px",
                background: "linear-gradient(135deg, #f97316, #fb923c)",
                clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                opacity: 0.9,
              }}
            />
            <div
              className="absolute -z-10 pointer-events-none"
              style={{
                top: "-100px",
                left: "-40px",
                width: "120px",
                height: "120px",
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                clipPath: "polygon(0 0, 100% 0, 0 100%)",
                opacity: 0.9,
              }}
            />
            <div
              className="absolute -z-10 pointer-events-none"
              style={{
                top: "-220px",
                left: "40%",
                width: "110px",
                height: "110px",
                background: "#a3e635",
                clipPath: "polygon(0 0, 100% 0, 0 100%)",
                opacity: 0.9,
              }}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_360px] gap-4 items-start">
            {/* Left: sticky personal info */}
            <div className="hidden lg:block lg:sticky lg:top-6">
              <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <button type="button" onClick={() => setActiveTab("profile")} className="flex justify-center w-full cursor-pointer">
                  <FifaPlayerCard form={form} profile={profile} photoSrc={photoSrc} userId={userId} mini />
                </button>
                {(form.position || form.current_team) && (
                  <p className="text-xs text-gray-500 mt-3">
                    {[translatePosition(form.position, lang), form.current_team].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="border-t border-gray-200 mt-4 pt-3 flex items-center justify-center gap-1.5 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-gray-900">{followerCount}</span>
                  <span className="text-gray-500">{lang === "ro" ? "urmăritori" : "followers"}</span>
                </div>
              </div>
            </div>

            {/* Center: posts feed */}
            <div className="min-w-0">
              <PostsTab userId={userId} readOnly={readOnly} />
            </div>

            {/* Right: news & announcements placeholder */}
            <div className="hidden lg:block lg:sticky lg:top-6 relative">
              <div
                className="absolute -z-10 pointer-events-none"
                style={{
                  top: "-30px",
                  right: "-20px",
                  width: "140px",
                  height: "140px",
                  background: "#a3e635",
                  clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                  opacity: 0.9,
                }}
              />
              <div
                className="absolute -z-10 pointer-events-none"
                style={{
                  bottom: "-24px",
                  left: "-16px",
                  width: "110px",
                  height: "110px",
                  background: "linear-gradient(135deg, #f97316, #fb923c)",
                  clipPath: "polygon(0 100%, 100% 100%, 0 0)",
                  opacity: 0.9,
                }}
              />
              <NewsAnnouncementsPanel />
            </div>
          </div>

          {/* Decorative geometric shapes below the page content */}
          <div className="relative h-0 overflow-visible">
            <div
              className="absolute -z-10 pointer-events-none"
              style={{
                top: "40px",
                right: "80px",
                width: "150px",
                height: "150px",
                background: "#a3e635",
                clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                opacity: 0.9,
              }}
            />
            <div
              className="absolute -z-10 pointer-events-none"
              style={{
                top: "100px",
                left: "40px",
                width: "120px",
                height: "120px",
                background: "linear-gradient(135deg, #f97316, #fb923c)",
                clipPath: "polygon(0 100%, 100% 100%, 0 0)",
                opacity: 0.9,
              }}
            />
            <div
              className="absolute -z-10 pointer-events-none"
              style={{
                top: "260px",
                right: "260px",
                width: "110px",
                height: "110px",
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                clipPath: "polygon(0 0, 100% 0, 0 100%)",
                opacity: 0.9,
              }}
            />
            <div
              className="absolute -z-10 pointer-events-none"
              style={{
                top: "320px",
                left: "220px",
                width: "100px",
                height: "100px",
                background: "#a3e635",
                clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                opacity: 0.9,
              }}
            />
          </div>
          </>
        )}
      </div>
      </div>
      {(activeTab === "profile" || activeTab === "stats" || activeTab === "video") && (
        <div className="hidden lg:block lg:sticky lg:top-6 relative">
          <div
            className="absolute -z-10 pointer-events-none"
            style={{
              top: "-32px",
              right: "-22px",
              width: "150px",
              height: "150px",
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
              opacity: 0.9,
            }}
          />
          <div
            className="absolute -z-10 pointer-events-none"
            style={{
              bottom: "-26px",
              left: "-18px",
              width: "120px",
              height: "120px",
              background: "#a3e635",
              clipPath: "polygon(0 100%, 100% 100%, 0 0)",
              opacity: 0.9,
            }}
          />
          <NewsAnnouncementsPanel />
        </div>
      )}
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

      {/* Scout Player Note Dialog */}
      {viewerRole === "cauta_jucator" && viewerUserId && viewerUserId !== userId && (
        <ScoutPlayerNoteDialog
          open={showNoteDialog}
          onOpenChange={setShowNoteDialog}
          scoutUserId={viewerUserId}
          playerUserId={userId}
          playerName={`${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || (lang === "ro" ? "Jucător" : "Player")}
          playerSubtitle={[translatePosition(form.position, lang), profile?.nationality, currentSport].filter(Boolean).join(" · ")}
          playerPhotoUrl={photoSrc}
        />
      )}

      {/* Scout Player Report Dialog */}
      {viewerRole === "cauta_jucator" && viewerUserId && viewerUserId !== userId && (
        <ScoutPlayerReportDialog
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
          scoutUserId={viewerUserId}
          playerUserId={userId}
          playerName={`${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || (lang === "ro" ? "Jucător" : "Player")}
          playerPhotoUrl={photoSrc}
        />
      )}

      {/* Dialog: vizualizare profil autor recomandare */}
      <Dialog open={!!recAuthorView} onOpenChange={(open) => !open && setRecAuthorView(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {recAuthorView && (
            <Suspense fallback={<div className="flex items-center justify-center py-16"><span className="text-muted-foreground text-sm">Se încarcă...</span></div>}>
              {recAuthorView.role === "player"
                ? <LazyPersonalProfile userId={recAuthorView.userId} readOnly />
                : <LazyScoutPersonalProfile userId={recAuthorView.userId} readOnly />}
            </Suspense>
          )}
        </DialogContent>
      </Dialog>

      {STORIES_ENABLED && (
        <>
          <AddStoryModal
            userId={userId}
            open={showAddStory}
            onClose={() => setShowAddStory(false)}
            onPosted={() => setHasStory(true)}
            userPhoto={photoSrc}
          />
          <StoryViewer
            userId={userId}
            open={showStoryViewer}
            onClose={() => setShowStoryViewer(false)}
            displayName={`${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || undefined}
            avatarUrl={photoSrc}
            currentUserId={viewerUserId ?? undefined}
          />
          <StoryArchiveModal
            userId={userId}
            open={showArchive}
            onClose={() => setShowArchive(false)}
          />
        </>
      )}
    </div>
  );
};

/* ======================== FIFA-STYLE PLAYER CARD ======================== */
export function FifaPlayerCard({ form, profile, photoSrc, userId, hasStory, onOpenStory, onAddStory, showAddStoryButton, isEditingHeader, onAvatarChange, avatarPosX, avatarPosY, onAvatarPositionChange, mini = false }: {
  form: Partial<PlayerProfile>; profile: PlayerProfile | null; photoSrc?: string | null; userId?: string;
  hasStory?: boolean; onOpenStory?: () => void; onAddStory?: () => void; showAddStoryButton?: boolean;
  isEditingHeader?: boolean; onAvatarChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  avatarPosX?: number; avatarPosY?: number; onAvatarPositionChange?: (x: number, y: number) => void; mini?: boolean;
}) {
  const { getSubmissionForTest } = useVideoSubmissions(userId);
  const dragState = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const dragMovedRef = useRef(false);
  const photoFrameRef = useRef<HTMLDivElement>(null);
  const posX = avatarPosX ?? 50;
  const posY = avatarPosY ?? 50;

  const handlePhotoPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditingHeader || !onAvatarPositionChange) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragMovedRef.current = false;
    dragState.current = { startX: e.clientX, startY: e.clientY, startPosX: posX, startPosY: posY };
  };

  const handlePhotoPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current || !onAvatarPositionChange) return;
    const frame = photoFrameRef.current;
    if (!frame) return;
    const { width, height } = frame.getBoundingClientRect();
    const rawDeltaX = e.clientX - dragState.current.startX;
    const rawDeltaY = e.clientY - dragState.current.startY;
    if (Math.abs(rawDeltaX) > 3 || Math.abs(rawDeltaY) > 3) dragMovedRef.current = true;
    const deltaXPct = (rawDeltaX / width) * 100;
    const deltaYPct = (rawDeltaY / height) * 100;
    const nextX = Math.min(100, Math.max(0, dragState.current.startPosX - deltaXPct));
    const nextY = Math.min(100, Math.max(0, dragState.current.startPosY - deltaYPct));
    onAvatarPositionChange(nextX, nextY);
  };

  const handlePhotoPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.current) e.currentTarget.releasePointerCapture(e.pointerId);
    dragState.current = null;
  };

  return (
    <div className={`mx-auto sm:mx-0 relative ${mini ? "w-[140px]" : "w-[220px]"} shrink-0 rounded-2xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(249,115,22,0.5)]`}
      style={{
        background: 'linear-gradient(155deg, #ea580c 0%, #f97316 45%, #fb923c 100%)',
      }}
    >
      <div className="absolute inset-0" style={{
        backgroundImage: `
          radial-gradient(circle at 18% 12%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 26%),
          radial-gradient(circle at 88% 8%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 22%),
          radial-gradient(circle at 78% 62%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 32%),
          radial-gradient(circle at 8% 78%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 28%),
          radial-gradient(circle at 55% 95%, rgba(124,45,18,0.35) 0%, rgba(124,45,18,0) 40%)
        `,
      }} />
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.5) 8px, rgba(255,255,255,0.5) 9px)`,
      }} />
      <div className="relative">
        <div className={mini ? "flex items-start px-2 pt-2" : "flex items-start px-4 pt-4"}>
          <div className="flex flex-col items-center">
            <span className={`font-display text-primary-foreground leading-none drop-shadow-lg ${mini ? "text-[20px]" : "text-[42px]"}`}>{(profile as any)?.jersey_number ?? "—"}</span>
          </div>
        </div>
        <div className={mini ? "flex justify-center mt-0.5 px-3" : "flex justify-center mt-1 px-5"}>
          <div className="relative group">
            {hasStory && (
              <div className="absolute inset-[-4px] rounded-[14px] z-0 overflow-hidden">
                <div
                  className="absolute inset-[-40%] story-ring-spin"
                  style={{ background: "conic-gradient(from 0deg, #22c55e 0%, #4ade80 30%, #86efac 50%, transparent 55%, transparent 75%, #22c55e 100%)" }}
                />
              </div>
            )}
            <div
              ref={photoFrameRef}
              className={`relative z-10 rounded-xl overflow-hidden shadow-lg ${mini ? "w-[95px] h-[95px]" : "w-[130px] h-[130px]"} ${hasStory ? "border-[3px] border-background cursor-pointer" : "border-2 border-primary-foreground/20"}`}
              onClick={hasStory && !isEditingHeader ? onOpenStory : undefined}
            >
              {photoSrc ? (
                <img src={photoSrc} alt="Player" className="w-full h-full object-cover" style={{ objectPosition: `${posX}% ${posY}%` }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary-foreground/10">
                  <Camera className={mini ? "h-6 w-6 text-primary-foreground/40" : "h-8 w-8 text-primary-foreground/40"} />
                </div>
              )}
            </div>
            {isEditingHeader && (
              <label
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 rounded-xl cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                onPointerDown={handlePhotoPointerDown}
                onPointerMove={handlePhotoPointerMove}
                onPointerUp={handlePhotoPointerUp}
                onClickCapture={(e) => {
                  if (dragMovedRef.current) {
                    e.preventDefault();
                    dragMovedRef.current = false;
                  }
                }}
              >
                <Camera className="h-6 w-6 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              </label>
            )}
            {showAddStoryButton && (
              <button
                onClick={onAddStory}
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center z-20 hover:bg-primary/80 transition-colors shadow-md"
              >
                <Plus className="h-3.5 w-3.5 text-primary-foreground" />
              </button>
            )}
          </div>
        </div>
        <div className={mini ? "text-center mt-1 pb-2 mx-2" : "text-center mt-2 pb-2 mx-4"}>
          <div className="border-t border-primary-foreground/20 pt-2">
            <p className={`font-display text-primary-foreground uppercase tracking-[0.15em] ${mini ? "text-[10px]" : "text-sm"}`}>{profile?.first_name || ""} {profile?.last_name || "PLAYER"}</p>
          </div>
        </div>
        <div className={mini ? "grid grid-cols-2 gap-x-2 gap-y-1 px-3 pb-3" : "grid grid-cols-2 gap-x-3 gap-y-1.5 px-5 pb-4"}>
          {[
            { label: "PLD", key: "speed_video" },
            { label: "2FVJ", key: "jumping_video" },
            { label: "SHR", key: "endurance_video" },
            { label: "2FVJA", key: "acceleration_video" },
          ].map((stat) => {
            const sub = getSubmissionForTest(stat.key);
            const verified = sub?.status === "verified" && sub.grade !== null;
            return (
              <div key={stat.label} className="flex items-center gap-1.5">
                <span className={`font-display text-primary-foreground leading-none ${mini ? "text-xs" : "text-lg"}`}>
                  {verified ? `${sub!.grade}${athleticTestUnits[stat.key] || ""}` : "—"}
                </span>
                <span className={`text-primary-foreground/60 font-body uppercase tracking-wider ${mini ? "text-[8px]" : "text-[10px]"}`}>{stat.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ======================== STATS TAB ======================== */
function StatsTab({ form, profile, editingSection, setEditingSection, updateForm, photoSrc, userId, viewerUserId, SectionEditButton, SectionSaveButton, readOnly = false }: {
  form: Partial<PlayerProfile>; profile: PlayerProfile | null; editingSection: EditingSection; setEditingSection: (s: EditingSection) => void; updateForm: (k: string, v: any) => void; photoSrc?: string | null; userId: string; viewerUserId: string | null; SectionEditButton: React.FC<{ section: EditingSection }>; SectionSaveButton: React.FC; readOnly?: boolean;
}) {
  const editing = editingSection === "stats";
  const editingMatchStats = editingSection === "match_stats";
  const editingTechnical = editingSection === "technical";
  const currentSport = (form as any).sport || (profile as any)?.sport || "football";
  const { t, lang } = useLanguage();
  const tt = t.dashboard.tests;
  const { toast } = useToast();
  const [inlineEditTest, setInlineEditTest] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const toggleTestExpanded = (key: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const { submissions: videoSubmissions, submitVideo, getSubmissionForTest } = useVideoSubmissions(userId);
  const { videos: testReferenceVideos } = useTestReferenceVideos();
  const technicalTests = getTechnicalTestsBySport(currentSport);
  const isOwner = !readOnly || viewerUserId === userId;
  const unlocks = useTestUnlocks(
    userId,
    viewerUserId,
    technicalTests.map((t) => t.key),
    isOwner,
  );
  const isUnlocked = (key: string) => unlocks.unlockedTests.includes(key);

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6 items-center">
          {/* Stat bars / edit inputs */}
          <div className="flex-1 w-full bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-display text-lg text-gray-900 uppercase tracking-wide">{tt.athleticTitle}</h4>
            </div>
              <>
                <div className="space-y-5">
                  {athleticTests.map((test) => {
                    const videoUrl = (form as any)[test.videoKey] || (profile as any)?.[test.videoKey] || "";
                    const sub = getSubmissionForTest(test.videoKey);
                    const testLabel = translateTestLabel(test.key, test.label, lang);
                    return (
                      <div key={test.key} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-body text-gray-900 uppercase tracking-wide">{test.icon} {testLabel}</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className={`group text-purple-600 hover:text-purple-700 transition-colors p-1 ${readOnly ? 'hidden' : ''}`} aria-label={`${tt.infoAriaPrefix} ${testLabel}`}>
                                  <Info className="h-4 w-4 group-hover:stroke-[2.5]" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="text-sm font-body w-80 bg-white border-gray-200 text-gray-900" side="top">
                                <TestInfoContent test={test} referenceVideoUrl={testReferenceVideos[test.videoKey]} />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-xl text-gray-900">
                              {sub?.status === "verified" && sub.grade !== null
                                ? `${sub.grade}${athleticTestUnits[test.videoKey] || ""}`
                                : "?"}
                            </span>
                            {isOwner && !videoUrl && inlineEditTest !== test.videoKey && (
                              <button
                                className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-900 transition-colors"
                                aria-label={`${tt.addVideoAriaPrefix} ${testLabel}`}
                                onClick={() => setInlineEditTest(test.videoKey)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {videoUrl && sub?.status !== "rejected" && (
                              <button
                                className="flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                aria-label={expandedTests.has(test.videoKey) ? `${tt.hideVideoAriaPrefix} ${testLabel}` : `${tt.showVideoAriaPrefix} ${testLabel}`}
                                onClick={() => toggleTestExpanded(test.videoKey)}
                              >
                                {expandedTests.has(test.videoKey) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: sub?.status === "verified" ? "100%" : sub?.status === "pending" ? "50%" : "0%",
                              background: sub?.status === "verified" ? 'linear-gradient(90deg, #84cc16, #a3e635)' : 'linear-gradient(90deg, #9ca3af, #6b7280)',
                            }}
                          />
                        </div>

                        {videoUrl && sub?.status !== "rejected" && expandedTests.has(test.videoKey) && (
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
                        )}

                        {!readOnly && sub && (
                          <>
                            {sub.status === "pending" && (
                              <div className="mt-2 flex items-center gap-2 bg-yellow-100 border border-yellow-300 rounded-lg px-3 py-2">
                                <Clock className="h-4 w-4 text-yellow-600 shrink-0" />
                                <span className="text-xs text-yellow-800 font-body">{tt.videoVerifying}</span>
                              </div>
                            )}
                            {sub.status === "verified" && sub.grade !== null && (
                              <div className="mt-2 bg-green-100 border border-green-300 rounded-lg px-3 py-2 space-y-1">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                                  <span className="text-xs text-green-800 font-body">
                                    {tt.videoVerifiedResultPrefix} <strong className="text-green-900">{sub.grade}{athleticTestUnits[test.videoKey] || ""}</strong>
                                  </span>
                                </div>
                                {sub.reviewer_notes && (
                                  <p className="text-xs text-green-700 font-body pl-6">{sub.reviewer_notes}</p>
                                )}
                                {getVerifiedCooldownDaysLeft(sub) > 0 && (
                                  <p className="text-xs text-green-600 font-body pl-6">
                                    {tt.canResubmitInPrefix} <strong>{Math.ceil(getVerifiedCooldownDaysLeft(sub))} {Math.ceil(getVerifiedCooldownDaysLeft(sub)) === 1 ? tt.dayWord : tt.daysWord}</strong>.
                                  </p>
                                )}
                              </div>
                            )}
                            {sub.status === "rejected" && (
                              <div className="mt-2 bg-red-100 border border-red-300 rounded-lg px-3 py-2 space-y-1">
                                <div className="flex items-center gap-2">
                                  <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                                  <span className="text-xs text-red-800 font-body font-semibold">{tt.videoRejected}</span>
                                </div>
                                {sub.reviewer_notes && (
                                  <p className="text-xs text-red-700 font-body pl-6">{sub.reviewer_notes}</p>
                                )}
                                {getRejectionDaysLeft(sub) > 0 ? (
                                  <p className="text-xs text-orange-600 font-body pl-6">
                                    {tt.canResubmitInPrefix} <strong>{Math.ceil(getRejectionDaysLeft(sub))} {Math.ceil(getRejectionDaysLeft(sub)) === 1 ? tt.dayWord : tt.daysWord}</strong>.
                                  </p>
                                ) : (
                                  <p className="text-xs text-green-700 font-body pl-6">
                                    {tt.deadlineExpired}
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {inlineEditTest === test.videoKey && (() => {
                          const daysLeft = getUploadCooldownDaysLeft(sub);
                          if (daysLeft > 0) {
                            return (
                              <div className="mt-2 bg-orange-100 border border-orange-300 rounded-lg px-3 py-2">
                                <p className="text-xs text-orange-800 font-body">
                                  {tt.canResubmitInPrefix} <strong>{Math.ceil(daysLeft)} {Math.ceil(daysLeft) === 1 ? tt.dayWord : tt.daysWord}</strong>.
                                </p>
                              </div>
                            );
                          }
                          return (
                            <div className="mt-3 space-y-2">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                  placeholder={tt.videoUrlPlaceholder}
                                  value={(form as any)[test.inputKey] || ""}
                                  onChange={(e) => updateForm(test.inputKey as any, e.target.value)}
                                  className="bg-gray-100 border-gray-300 text-gray-900 flex-1 min-w-0 focus-visible:ring-1 focus-visible:ring-gray-900"
                                />
                                <Button type="button" variant="outline" size="sm" className="shrink-0 border-gray-300 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 hover:text-white hover:border-transparent" onClick={() => {
                                  const val = (form as any)[test.inputKey]?.trim();
                                  if (val) {
                                    updateForm(test.videoKey as any, val);
                                    updateForm(test.inputKey as any, "");
                                  }
                                }}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="relative">
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
                                  onClick={() => document.getElementById(`inline-${test.uploadId}`)?.click()}>
                                  <Upload className="h-5 w-5 text-muted-foreground mx-auto" />
                                  <span className="text-xs text-muted-foreground font-body block mt-1">{tt.orUploadVideo}</span>
                                </div>
                                <input
                                  id={`inline-${test.uploadId}`}
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
                                      toast({ title: tt.uploadErrorTitle, description: tt.uploadErrorDesc, variant: "destructive" });
                                      return;
                                    }
                                    const { data: urlData } = supabase.storage.from("player-videos").getPublicUrl(path);
                                    updateForm(test.videoKey as any, urlData.publicUrl);
                                    toast({ title: tt.videoUploadedSuccess });
                                  }}
                                />
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                                  onClick={async () => {
                                    const dl = getUploadCooldownDaysLeft(sub);
                                    if (dl > 0) {
                                      toast({ title: tt.cannotSubmitYetTitle, description: `${tt.canResubmitAgainInPrefix} ${Math.ceil(dl)} ${tt.daysWord}.`, variant: "destructive" });
                                      return;
                                    }
                                    // If the user typed a link but never clicked the small "+" to
                                    // confirm it, fall back to that pending value instead of silently
                                    // saving nothing.
                                    const pendingInputUrl = (form as any)[test.inputKey]?.trim();
                                    const newVideoUrl = (form as any)[test.videoKey] || pendingInputUrl || null;
                                    if (!newVideoUrl) {
                                      updateForm(test.inputKey as any, "");
                                      setInlineEditTest(null);
                                      return;
                                    }
                                    const payload: any = {};
                                    payload[test.videoKey] = newVideoUrl;
                                    const { error } = await supabase
                                      .from("player_profiles")
                                      .update(payload)
                                      .eq("user_id", userId);
                                    if (error) {
                                      toast({ title: tt.saveErrorTitle, variant: "destructive" });
                                    } else {
                                      const result = await submitVideo(test.videoKey, newVideoUrl, userId);
                                      if (result.error) {
                                        toast({ title: tt.videoSavedButSubmitFailed, variant: "destructive" });
                                      } else {
                                        updateForm(test.videoKey as any, newVideoUrl);
                                        updateForm(test.inputKey as any, "");
                                        toast({ title: tt.videoSavedPendingReview });
                                      }
                                      setInlineEditTest(null);
                                    }
                                  }}
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  {tt.saveBtn}
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-500 font-body uppercase tracking-wide">{tt.ratingGeneral}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-3xl text-gray-900">?</span>
                    <span className="text-xs text-muted-foreground font-body">/100</span>
                  </div>
                </div>
              </>
          </div>
        </div>

        {/* Decorative geometric shapes between the two test cards */}
        <div className="relative h-0 overflow-visible">
          <div
            className="absolute -z-10 pointer-events-none"
            style={{
              top: "-90px",
              right: "0px",
              width: "360px",
              height: "360px",
              background: "#a3e635",
              clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
              opacity: 0.9,
            }}
          />
          <div
            className="absolute -z-10 pointer-events-none"
            style={{
              top: "-40px",
              left: "-16px",
              width: "260px",
              height: "260px",
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              clipPath: "polygon(0 0, 100% 0, 0 100%)",
              opacity: 0.9,
            }}
          />
        </div>

        {/* Teste Tehnice Specifice section */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6" data-tour="tests-list">
          <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <h4 className="font-display text-lg text-gray-900 uppercase tracking-wide">{tt.technicalTitle}</h4>
              {!unlocks.loading && unlocks.bestStreak >= 7 && (
                <StreakBadges bestStreak={unlocks.bestStreak} currentStreak={unlocks.currentStreak} />
              )}
            </div>
            {unlocks.unlockedTests.length > 0 && <SectionEditButton section="technical" />}
          </div>
          {/* Mesaj motivațional pentru următorul badge — doar pe profilul propriu */}
          {isOwner && !unlocks.loading && (() => {
            const next = getNextBadgeMilestone(unlocks.bestStreak, tt);
            if (!next) return null;
            const remaining = next.threshold - unlocks.bestStreak;
            const dayWord = remaining === 1 ? tt.dayWord : tt.daysWord;
            return (
              <p className="text-[11px] text-gray-500 font-body mb-2">
                {tt.nextBadgeTemplate.replace("{n}", String(remaining)).replace("{day}", dayWord).replace("{label}", next.label)}
              </p>
            );
          })()}

          {/* Progress streak — vizibil doar pe profilul propriu și doar dacă mai sunt teste de deblocat */}
          {isOwner && !unlocks.loading && unlocks.unlockedTests.length < technicalTests.length && (
            <div className="mb-4 p-3 rounded-lg bg-gray-100 border border-gray-200">
              {(() => {
                let previewKey = unlocks.nextTestPreview;
                if (!previewKey) {
                  const locked = technicalTests.filter((t) => !unlocks.unlockedTests.includes(t.key));
                  if (locked.length > 0) {
                    const seed = (userId || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
                    previewKey = locked[seed % locked.length].key;
                  }
                }
                const previewTest = technicalTests.find((t) => t.key === previewKey);
                const nextLabel = previewTest ? translateTestLabel(previewTest.key, previewTest.label, lang) : undefined;
                const days = unlocks.daysUntilNextUnlock;
                const dayWord = days === 1 ? tt.dayWord : tt.daysWord;
                const firstLine =
                  days === 0
                    ? nextLabel
                      ? tt.nextTestUnlocksNowTemplate.replace("{label}", nextLabel)
                      : tt.nextTestUnlocksNowGenericTemplate
                    : nextLabel
                      ? tt.nextTestUnlocksInTemplate.replace("{n}", String(days)).replace("{day}", dayWord).replace("{label}", nextLabel)
                      : tt.nextTestUnlocksInGenericTemplate.replace("{n}", String(days)).replace("{day}", dayWord);
                return (
                  <div className="flex items-start gap-2 mb-2">
                    <Gift className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-xs font-body text-gray-900 font-semibold">
                      {firstLine}
                    </span>
                  </div>
                );
              })()}
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.min(100, (unlocks.currentStreak / unlocks.required) * 100)}%`,
                    background: 'linear-gradient(90deg, #9ca3af, #6b7280)',
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5 font-body">
                {tt.streakProgressTemplate.replace("{cur}", String(unlocks.currentStreak)).replace("{req}", String(unlocks.required))}
              </p>
            </div>
          )}
          {isOwner && !unlocks.loading && unlocks.unlockedTests.length === technicalTests.length && (
            <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <span className="text-xs font-body text-gray-900">{tt.allTestsUnlockedCongrats}</span>
            </div>
          )}

          {isOwner && !unlocks.loading && unlocks.unlockedTests.length < technicalTests.length && (
            <div className="mb-4 p-3 rounded-xl bg-orange-50 border border-orange-200 flex items-center gap-3">
              <div className="text-2xl shrink-0">🤝</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-body font-semibold text-gray-900 leading-tight">
                  {tt.inviteUnlockTitle}
                </p>
                <p className="text-[10px] text-gray-500 font-body mt-0.5 leading-relaxed">
                  {tt.inviteUnlockDesc}
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0 text-xs font-body bg-orange-500 hover:bg-orange-600 text-white h-7 px-3"
                onClick={() => setShowInviteModal(true)}
              >
                {tt.inviteNowBtn}
              </Button>
            </div>
          )}

          {editingTechnical ? (
            <div className="space-y-4">
              {technicalTests.map((test) => {
                const unlocked = isUnlocked(test.key);
                const testLabel = translateTestLabel(test.key, test.label, lang);
                if (!unlocked) {
                  return (
                    <div key={test.key} className="opacity-60 p-3 rounded-lg bg-gray-100 border border-dashed border-gray-300">
                      <div className="flex items-center gap-2">
                        <LockIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-body text-gray-500 uppercase tracking-wide">{test.icon} {testLabel} — {tt.testLockedSuffix}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 font-body">{tt.continueStreakToUnlock}</p>
                    </div>
                  );
                }
                return (
                <div key={test.key}>
                  <p className="text-xs text-muted-foreground font-body mb-2">🎥 {tt.videoLabelPrefix} {testLabel}</p>
                  {(form as any)[test.key] ? (
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-body truncate flex-1">{(form as any)[test.key]}</span>
                      <Button type="button" variant="ghost" size="icon" onClick={() => updateForm(test.key as any, null)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (() => {
                    const sub = getSubmissionForTest(test.key);
                    const daysLeft = getUploadCooldownDaysLeft(sub);
                    if (daysLeft > 0) {
                      return (
                        <div className="bg-orange-100 border border-orange-300 rounded-lg px-3 py-2">
                          <p className="text-xs text-orange-800 font-body">
                            {tt.canResubmitInPrefix} <strong>{Math.ceil(daysLeft)} {Math.ceil(daysLeft) === 1 ? tt.dayWord : tt.daysWord}</strong>.
                          </p>
                        </div>
                      );
                    }
                    return (
                    <>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder={tt.videoUrlPlaceholder}
                          value={(form as any)[test.inputKey] || ""}
                          onChange={(e) => updateForm(test.inputKey as any, e.target.value)}
                          className="bg-gray-100 border-gray-300 text-gray-900 flex-1 min-w-0 focus-visible:ring-1 focus-visible:ring-gray-900"
                        />
                        <Button type="button" variant="outline" size="sm" className="shrink-0 border-gray-300 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 hover:text-white hover:border-transparent" onClick={() => {
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
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => document.getElementById(test.uploadId)?.click()}>
                          <Upload className="h-5 w-5 text-muted-foreground mx-auto" />
                          <span className="text-xs text-muted-foreground font-body block mt-1">{tt.orUploadVideo}</span>
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
                              toast({ title: tt.uploadErrorTitle, description: tt.uploadErrorDesc, variant: "destructive" });
                              return;
                            }
                            const { data: urlData } = supabase.storage.from("player-videos").getPublicUrl(path);
                            updateForm(test.key as any, urlData.publicUrl);
                            toast({ title: tt.videoUploadedSuccess });
                          }}
                        />
                      </div>
                    </>
                    );
                  })()}
                </div>
                );
              })}
              <SectionSaveButton />
            </div>
          ) : (
            <div className="space-y-4">
              {technicalTests.map((test) => {
                const unlocked = isUnlocked(test.key);
                const testLabel = translateTestLabel(test.key, test.label, lang);
                if (!unlocked) {
                  return (
                    <div key={test.key} className="p-3 rounded-lg bg-gray-100 border border-dashed border-gray-300">
                      <div className="flex items-center gap-2">
                        <LockIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-body text-gray-500 uppercase tracking-wide">
                          {test.icon} {testLabel} — {tt.testLockedSuffix}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 font-body">
                        {isOwner ? tt.continueStreakToUnlockDaily : tt.notUnlockedByAthlete}
                      </p>
                    </div>
                  );
                }
                return (
                <div key={test.key}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-body text-gray-900 uppercase tracking-wide">{test.icon} {testLabel}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={`group text-purple-600 hover:text-purple-700 transition-colors p-1 ${readOnly ? 'hidden' : ''}`} aria-label={`${tt.infoAriaPrefix} ${testLabel}`}>
                          <Info className="h-4 w-4 group-hover:stroke-[2.5]" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="text-sm font-body w-80 bg-white border-gray-200 text-gray-900" side="top">
                        <TestInfoContent test={test} referenceVideoUrl={testReferenceVideos[test.key]} />
                      </PopoverContent>
                    </Popover>
                    {isOwner && !((form as any)[test.key] || (profile as any)?.[test.key]) && !editingTechnical && (
                      <button
                        className="ml-auto flex items-center justify-center h-7 w-7 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-900 transition-colors"
                        aria-label={`${tt.addVideoAriaPrefix} ${testLabel}`}
                        onClick={() => setInlineEditTest(inlineEditTest === test.key ? null : test.key)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                    {((form as any)[test.key] || (profile as any)?.[test.key]) && getSubmissionForTest(test.key)?.status !== "rejected" && (
                      <button
                        className="ml-auto flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        aria-label={expandedTests.has(test.key) ? `${tt.hideVideoAriaPrefix} ${testLabel}` : `${tt.showVideoAriaPrefix} ${testLabel}`}
                        onClick={() => toggleTestExpanded(test.key)}
                      >
                        {expandedTests.has(test.key) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                  {(() => {
                    const videoUrl = (form as any)[test.key] || (profile as any)?.[test.key] || "";
                    const sub = getSubmissionForTest(test.key);
                    if (sub?.status === "rejected") return null;
                    if (!videoUrl) return <p className="text-xs text-muted-foreground mt-2 font-body">{tt.noVideoUploaded}</p>;
                    if (!expandedTests.has(test.key)) return null;
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
                   {/* Video verification status */}
                   {(() => {
                     if (readOnly) return null;
                     const sub = getSubmissionForTest(test.key);
                     if (!sub) return null;
                     if (sub.status === "pending") {
                       return (
                         <div className="mt-2 flex items-center gap-2 bg-yellow-100 border border-yellow-300 rounded-lg px-3 py-2">
                           <Clock className="h-4 w-4 text-yellow-600 shrink-0" />
                           <span className="text-xs text-yellow-800 font-body">{tt.videoVerifying}</span>
                         </div>
                       );
                     }
                     if (sub.status === "verified" && sub.grade !== null) {
                       const daysLeft = getVerifiedCooldownDaysLeft(sub);
                       return (
                         <div className="mt-2 bg-green-100 border border-green-300 rounded-lg px-3 py-2 space-y-1">
                           <div className="flex items-center gap-2">
                             <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                             <span className="text-xs text-green-800 font-body">
                               {tt.videoVerifiedNotePrefix} <strong className="text-green-900">{sub.grade}</strong>
                             </span>
                           </div>
                           {sub.reviewer_notes && (
                             <p className="text-xs text-green-700 font-body pl-6">{sub.reviewer_notes}</p>
                           )}
                           {daysLeft > 0 && (
                             <p className="text-xs text-green-600 font-body pl-6">
                               {tt.canResubmitInPrefix} <strong>{Math.ceil(daysLeft)} {Math.ceil(daysLeft) === 1 ? tt.dayWord : tt.daysWord}</strong>.
                             </p>
                           )}
                         </div>
                       );
                     }
                     if (sub.status === "rejected") {
                       if (readOnly) return null;
                       const daysLeft = getRejectionDaysLeft(sub);
                       return (
                         <div className="mt-2 bg-red-100 border border-red-300 rounded-lg px-3 py-2 space-y-1">
                           <div className="flex items-center gap-2">
                             <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                             <span className="text-xs text-red-800 font-body font-semibold">{tt.videoRejected}</span>
                           </div>
                           {sub.reviewer_notes && (
                             <p className="text-xs text-red-700 font-body pl-6">{sub.reviewer_notes}</p>
                           )}
                           {daysLeft > 0 ? (
                             <p className="text-xs text-orange-600 font-body pl-6">
                               {tt.canResubmitInPrefix} <strong>{Math.ceil(daysLeft)} {Math.ceil(daysLeft) === 1 ? tt.dayWord : tt.daysWord}</strong>.
                             </p>
                           ) : (
                             <p className="text-xs text-green-700 font-body pl-6">
                               {tt.deadlineExpired}
                             </p>
                           )}
                         </div>
                       );
                     }
                     return null;
                   })()}
                   {/* Inline editor triggered by "+" button */}
                  {inlineEditTest === test.key && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder={tt.videoUrlPlaceholder}
                          value={(form as any)[test.inputKey] || ""}
                          onChange={(e) => updateForm(test.inputKey as any, e.target.value)}
                          className="bg-gray-100 border-gray-300 text-gray-900 flex-1 min-w-0 focus-visible:ring-1 focus-visible:ring-gray-900"
                        />
                        <Button type="button" variant="outline" size="sm" className="shrink-0 border-gray-300 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 hover:text-white hover:border-transparent" onClick={() => {
                          const val = (form as any)[test.inputKey]?.trim();
                          if (val) {
                            updateForm(test.key as any, val);
                            updateForm(test.inputKey as any, "");
                          }
                        }}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="relative">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => document.getElementById(`inline-${test.uploadId}`)?.click()}>
                          <Upload className="h-5 w-5 text-muted-foreground mx-auto" />
                          <span className="text-xs text-muted-foreground font-body block mt-1">{tt.orUploadVideo}</span>
                        </div>
                        <input
                          id={`inline-${test.uploadId}`}
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
                              toast({ title: tt.uploadErrorTitle, description: tt.uploadErrorDesc, variant: "destructive" });
                              return;
                            }
                            const { data: urlData } = supabase.storage.from("player-videos").getPublicUrl(path);
                            updateForm(test.key as any, urlData.publicUrl);
                            toast({ title: tt.videoUploadedSuccess });
                          }}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                          onClick={async () => {
                            const sub = getSubmissionForTest(test.key);
                            const daysLeft = getUploadCooldownDaysLeft(sub);
                            if (daysLeft > 0) {
                              toast({ title: tt.cannotSubmitYetTitle, description: `${tt.canResubmitAgainInPrefix} ${Math.ceil(daysLeft)} ${tt.daysWord}.`, variant: "destructive" });
                              return;
                            }
                            const payload: any = {};
                            const videoUrl = (form as any)[test.key] || null;
                            payload[test.key] = videoUrl;
                            const { error } = await supabase
                              .from("player_profiles")
                              .update(payload)
                              .eq("user_id", userId);
                            if (error) {
                              toast({ title: tt.saveErrorTitle, variant: "destructive" });
                            } else {
                              // Submit for verification
                              if (videoUrl) {
                                await submitVideo(test.key, videoUrl, userId);
                              }
                              toast({ title: tt.videoSavedPendingReview });
                              setInlineEditTest(null);
                            }
                          }}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          {tt.saveBtn}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>


    </div>
    <InviteFriendsModal
      open={showInviteModal}
      onOpenChange={setShowInviteModal}
      userId={userId}
      unlockedTests={unlocks.unlockedTests}
      availableTests={technicalTests.map((test) => ({ ...test, label: translateTestLabel(test.key, test.label, lang) }))}
      onUnlocked={() => {
        setShowInviteModal(false);
        unlocks.refetch();
      }}
    />
    </>
  );
}

/* ======================== DOCUMENT UPLOAD HELPER ======================== */
function DocumentUploader({ documents, onAdd, onRemove, editing, label }: {
  documents: string[]; onAdd: (url: string) => void; onRemove: (index: number) => void; editing: boolean; label: string;
}) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const tp = t.dashboard.palmares;
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
      <p className="text-xs text-gray-900 font-medium font-body mb-2">{label}</p>
      {documents.length > 0 && (
        <div className="space-y-2 mb-2">
          {documents.map((url, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
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
                className="text-sm text-gray-900 font-body hover:text-primary truncate flex-1 text-left"
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
          <div className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:border-primary/50 hover:bg-gray-100 transition-colors">
            {uploading ? (
              <><Loader2 className="h-4 w-4 text-primary animate-spin" /><span className="text-sm text-muted-foreground font-body">{t.dashboard.scoutExtra.uploadingDocText}</span></>
            ) : (
              <><Upload className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground font-body">{tp.uploadDocMaxSizeBtn}</span></>
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
  if (!description) return [];
  try {
    const parsed = JSON.parse(description);
    if (Array.isArray(parsed)) return parsed;
    return [{ place: parsed.place || "", championship: parsed.championship || "", category: parsed.category || "", year: parsed.year || "", document_url: parsed.document_url || "" }];
  } catch {
    return [];
  }
}

function PalmaresEditor({ entry, idx, careerEntries, setCareerEntries, sport }: {
  entry: CareerEntry; idx: number; careerEntries: CareerEntry[]; setCareerEntries: React.Dispatch<React.SetStateAction<CareerEntry[]>>; sport?: string;
}) {
  const { t } = useLanguage();
  const tp = t.dashboard.palmares;
  const palmaresList = parsePalmaresList(entry.description);
  const hasRealData = palmaresList.some(p => p.place || p.championship || p.document_url);
  const [isOpen, setIsOpen] = useState(hasRealData);
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
    setIsOpen(true);
    updateList([...palmaresList, { place: "", championship: "", category: "", year: "" }]);
  };

  const removePalmares = (pIdx: number) => {
    const newList = palmaresList.filter((_, i) => i !== pIdx);
    if (newList.length === 0) setIsOpen(false);
    updateList(newList);
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
    <div className="space-y-3 border-t border-gray-200 pt-3 mt-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-900 font-semibold">🏆 {tp.title}</Label>
        <Button type="button" size="sm" onClick={addPalmares} className="h-6 px-2 text-xs bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-3 w-3 mr-1" /> {tp.addResultBtn}
        </Button>
      </div>
      {isOpen && palmaresList.map((palmares, pIdx) => (
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
  const { t } = useLanguage();
  const tp = t.dashboard.palmares;
  const [open, setOpen] = useState(false);

  if (customChampionship) {
    return (
      <div>
        <Label className="text-xs text-gray-900 font-medium">{tp.championshipLabel}</Label>
        <div className="flex gap-1">
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={tp.championshipCustomPlaceholder} className="bg-gray-100 text-gray-900 placeholder:text-gray-400" />
          <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomChampionship(false); onChange(""); }}><X className="h-3 w-3" /></Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label className="text-xs text-gray-900 font-medium">{tp.championshipLabel}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between bg-gray-100 text-gray-900 font-normal h-10 text-sm">
            {value || tp.selectPlaceholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder={tp.searchChampionshipPlaceholder} />
            <CommandList>
              <CommandEmpty>{tp.noChampionshipFound}</CommandEmpty>
              <CommandGroup>
                {championshipOptions.map((o, i) => (
                  <CommandItem key={o} value={`option_${i}_${o}`} keywords={[o]} onSelect={() => { onChange(o); setOpen(false); }}>
                    <Check className={`mr-2 h-4 w-4 ${value === o ? "opacity-100" : "opacity-0"}`} />
                    {o}
                  </CommandItem>
                ))}
                <CommandItem value="__custom__" onSelect={() => { setCustomChampionship(true); setOpen(false); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  {tp.otherOption}
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
  const { t } = useLanguage();
  const tp = t.dashboard.palmares;
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: tp.unsupportedFormatError, variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: tp.fileTooLargeError, variant: "destructive" });
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
      toast({ title: tp.documentUploadedToast });
    } catch (err: any) {
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (documentUrl) {
    return (
      <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 mt-1">
        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
        <button type="button" onClick={() => window.open(documentUrl, '_blank')} className="text-xs text-gray-900 font-body hover:text-primary truncate flex-1 text-left">
          {tp.documentAttachedText}
        </button>
        <button type="button" onClick={() => onUpdate("")} className="text-destructive hover:text-destructive/80 shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <label className="block mt-1">
      <div className="flex items-center justify-center gap-1.5 border border-dashed border-gray-300 rounded-md p-1.5 cursor-pointer hover:border-primary/50 hover:bg-gray-100 transition-colors">
        {uploading ? (
          <><Loader2 className="h-3.5 w-3.5 text-primary animate-spin" /><span className="text-xs text-muted-foreground font-body">{t.dashboard.scoutExtra.uploadingDocText}</span></>
        ) : (
          <><Upload className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground font-body">{tp.attachDocumentBtn}</span></>
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
  const { t } = useLanguage();
  const tp = t.dashboard.palmares;
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
      className={`relative grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-md p-2 pl-7 border transition-all cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50 border-primary" : isDragOver ? "border-primary/60 bg-primary/5" : "border-gray-200"}`}
    >
      <GripVertical className="absolute left-1.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <button type="button" onClick={() => onRemove(pIdx)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors">
        <Trash2 className="h-4 w-4" />
      </button>
      <ChampionshipCombobox
        value={palmares.championship}
        customChampionship={customChampionship}
        setCustomChampionship={setCustomChampionship}
        championshipOptions={championshipOptions}
        onChange={(v) => { onUpdate(pIdx, "championship", v); if (sport === "basketball" && seniorChampionships.includes(v)) { onUpdate(pIdx, "category", ""); setCustomCategory(false); } }}
      />
      <div>
        <Label className="text-xs text-gray-900 font-medium">{tp.placeLabel}</Label>
        {customPlace ? (
          <div className="flex gap-1">
            <Input value={palmares.place} onChange={(e) => onUpdate(pIdx, "place", e.target.value)} placeholder={tp.placeCustomPlaceholder} className="bg-gray-100 text-gray-900 placeholder:text-gray-400" />
            <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomPlace(false); onUpdate(pIdx, "place", ""); }}><X className="h-3 w-3" /></Button>
          </div>
        ) : (
          <Select value={palmares.place} onValueChange={(v) => v === "__custom__" ? setCustomPlace(true) : onUpdate(pIdx, "place", v)}>
            <SelectTrigger className="bg-gray-100 text-gray-900"><SelectValue placeholder={tp.selectPlaceholder} /></SelectTrigger>
            <SelectContent>
              {placeOptions.map((o, i) => <SelectItem key={o} value={o}>{tp.placeOptions[i] || o}</SelectItem>)}
              <SelectItem value="__custom__">{tp.otherOption}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <div>
        <Label className="text-xs text-gray-900 font-medium">{sport === "basketball" ? tp.categoryLabelBasketball : tp.categoryLabelFootball}</Label>
        {sport === "basketball" ? (
          isCategoryDisabled ? (
            <Input value="" disabled placeholder="—" className="bg-gray-100 text-gray-400" />
          ) : customCategory ? (
            <div className="flex gap-1">
              <Input value={palmares.category} onChange={(e) => onUpdate(pIdx, "category", e.target.value)} placeholder={tp.categoryCustomPlaceholderBasketball} className="bg-gray-100 text-gray-900 placeholder:text-gray-400" />
              <Button type="button" variant="ghost" size="sm" onClick={() => { setCustomCategory(false); onUpdate(pIdx, "category", ""); }}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <Select value={palmares.category} onValueChange={(v) => v === "__custom__" ? setCustomCategory(true) : onUpdate(pIdx, "category", v)}>
              <SelectTrigger className="bg-gray-100 text-gray-900"><SelectValue placeholder={tp.selectPlaceholder} /></SelectTrigger>
              <SelectContent>
                {basketballCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                <SelectItem value="__custom__">{tp.otherOption}</SelectItem>
              </SelectContent>
            </Select>
          )
        ) : (
          <Input value={palmares.category} onChange={(e) => onUpdate(pIdx, "category", e.target.value)} placeholder={tp.categoryPlaceholderFootball} className="bg-gray-100 text-gray-900 placeholder:text-gray-400" />
        )}
      </div>
      <div>
        <Label className="text-xs text-gray-900 font-medium">{tp.seasonLabel}</Label>
        <Select value={palmares.year} onValueChange={(v) => onUpdate(pIdx, "year", v)}>
          <SelectTrigger className="bg-gray-100 text-gray-900"><SelectValue placeholder={tp.selectPlaceholder} /></SelectTrigger>
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

function ProfileTab({ form, profile, editingSection, updateForm, userId, readOnly, SectionEditButton, careerEntries, setCareerEntries, SectionSaveButton, sport, agentSuggestions, showAgentSuggestions, setShowAgentSuggestions, selectedRegisteredAgent, handleAgentNameChange, selectAgent, collaborationStatus, collaborationLoading, cancelCollaborationRequest, acceptedAgent, photoSrc, teamNameSuggestions }: {
  form: Partial<PlayerProfile>; profile: PlayerProfile | null; editingSection: EditingSection; updateForm: (k: string, v: any) => void; userId: string; readOnly: boolean; SectionEditButton: React.FC<{ section: EditingSection }>; careerEntries: CareerEntry[]; setCareerEntries: React.Dispatch<React.SetStateAction<CareerEntry[]>>; SectionSaveButton: React.FC; sport?: string; agentSuggestions: AgentSuggestion[]; showAgentSuggestions: boolean; setShowAgentSuggestions: (v: boolean) => void; selectedRegisteredAgent: AgentSuggestion | null; handleAgentNameChange: (v: string) => void; selectAgent: (a: AgentSuggestion) => void; collaborationStatus: "none" | "pending" | "accepted" | "rejected"; collaborationLoading: boolean; cancelCollaborationRequest: () => void; acceptedAgent: AgentSuggestion | null; photoSrc?: string | null; teamNameSuggestions: string[];
}) {
  const { lang, t } = useLanguage();
  const tp = t.dashboard.palmares;

  const editingPhysical = editingSection === "physical";
  const editingAgent = editingSection === "agent";
  const editingAbout = editingSection === "about";
  const [expandedCareerIdx, setExpandedCareerIdx] = useState<number | null>(null);

  const aboutDocs = editingAbout ? (form.about_documents || []) : (profile?.about_documents || []);

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <PlayerStats userId={userId} isOwner={!readOnly} />

      {/* Physical + details */}
      <div className={`grid grid-cols-1 ${!readOnly || profile?.agent_name || profile?.agent_email || profile?.agent_phone ? "sm:grid-cols-2" : ""} gap-4`}>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg text-gray-900 uppercase">{t.dashboard.profile.physicalData}</h3>
            <div className="flex items-center gap-1">
              {!readOnly && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="group text-purple-600 hover:text-purple-700 transition-colors" aria-label={t.dashboard.profile.physicalDataTipsLabel}>
                      <Info className="h-4 w-4 group-hover:stroke-[2.5]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="text-sm font-body bg-white border-gray-200 text-gray-900" side="top">
                    <p className="font-semibold mb-1 text-gray-900">💡 {t.dashboard.profile.tips}</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-500 text-xs">
                      <li>{t.dashboard.profile.physicalTip1}</li>
                      <li>{t.dashboard.profile.physicalTip2}</li>
                      <li>{t.dashboard.profile.physicalTip3}</li>
                    </ul>
                  </PopoverContent>
                </Popover>
              )}
              <SectionEditButton section="physical" />
            </div>
          </div>
          {editingPhysical ? (
            <div className="space-y-3">
              <div><Label className="text-xs text-gray-500">{t.dashboard.profile.heightLabel}</Label><Input type="text" inputMode="numeric" pattern="[0-9]*" value={form.height_cm ?? ""} onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault(); }} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); updateForm("height_cm", v ? parseInt(v) : null); }} className="bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900" /></div>
              <div><Label className="text-xs text-gray-500">{t.dashboard.profile.weightLabel}</Label><Input type="text" inputMode="numeric" pattern="[0-9]*" value={form.weight_kg ?? ""} onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault(); }} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); updateForm("weight_kg", v ? parseInt(v) : null); }} className="bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900" /></div>
              <div><Label className="text-xs text-gray-500">{t.dashboard.profile.wingspanLabel}</Label><Input type="text" inputMode="numeric" pattern="[0-9]*" value={form.wingspan_cm ?? ""} onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault(); }} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); updateForm("wingspan_cm", v ? parseInt(v) : null); }} className="bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900" /></div>
              <div>
                <Label className="text-xs text-gray-500">{(form.sport || profile?.sport) === "basketball" ? t.dashboard.profile.preferredHand : t.dashboard.profile.preferredFoot}</Label>
                <Select value={form.preferred_foot || ""} onValueChange={(v) => updateForm("preferred_foot", v)}>
                  <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-900"><SelectValue placeholder={t.dashboard.profile.selectFoot} /></SelectTrigger>
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
              <div><Label className="text-xs text-gray-500">{t.dashboard.profile.birthDate}</Label><Input type="date" value={form.date_of_birth || ""} onChange={(e) => updateForm("date_of_birth", e.target.value)} className="bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900" /></div>
              <div><Label className="text-xs text-gray-500">{t.dashboard.profile.nationality}</Label><NationalityInput value={form.nationality || ""} onChange={(val) => updateForm("nationality", val)} gender={form.gender} className="bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900" /></div>
              <div className="border-t border-gray-200 pt-3 mt-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">{t.dashboard.profile.geneticData}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">{t.dashboard.profile.fatherHeight} (cm)</Label>
                    <Input
                      type="text" inputMode="numeric" pattern="[0-9]*"
                      value={(form as any).father_height_cm ?? ""}
                      placeholder="ex: 185"
                      onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault(); }}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); updateForm("father_height_cm", v ? parseInt(v) : null); }}
                      className="bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">{t.dashboard.profile.motherHeight} (cm)</Label>
                    <Input
                      type="text" inputMode="numeric" pattern="[0-9]*"
                      value={(form as any).mother_height_cm ?? ""}
                      placeholder="ex: 165"
                      onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault(); }}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); updateForm("mother_height_cm", v ? parseInt(v) : null); }}
                      className="bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 font-body text-sm">
              <div className="flex justify-between"><span className="text-gray-500">{t.dashboard.profile.height}</span><span className="text-gray-900 font-semibold">{profile?.height_cm ? `${(profile.height_cm / 100).toFixed(2)}m` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t.dashboard.profile.weight}</span><span className="text-gray-900 font-semibold">{profile?.weight_kg ? `${profile.weight_kg}kg` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t.dashboard.profile.wingspan}</span><span className="text-gray-900 font-semibold">{profile?.wingspan_cm ? `${(profile.wingspan_cm / 100).toFixed(2)}m` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{(profile?.sport) === "basketball" ? t.dashboard.profile.preferredHand : t.dashboard.profile.preferredFoot}</span><span className="text-gray-900 font-semibold">{translateFootHandValue(profile?.preferred_foot, (profile?.sport) === "basketball", t) || "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t.dashboard.profile.nationality}</span><span className="text-gray-900 font-semibold">{profile?.nationality ? getDisplayNationality(profile.nationality, lang, profile?.gender) : "—"}</span></div>
              <div className="border-t border-gray-200 pt-3 mt-1 space-y-3">
                <div className="flex justify-between"><span className="text-gray-500">{t.dashboard.profile.motherHeight}</span><span className="text-gray-900 font-semibold">{(profile as any)?.mother_height_cm ? `${((profile as any).mother_height_cm / 100).toFixed(2)}m` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">{t.dashboard.profile.fatherHeight}</span><span className="text-gray-900 font-semibold">{(profile as any)?.father_height_cm ? `${((profile as any).father_height_cm / 100).toFixed(2)}m` : "—"}</span></div>
              </div>
            </div>
           )}
          {editingPhysical && <SectionSaveButton />}
        </div>

        {(!readOnly || profile?.agent_name || profile?.agent_email || profile?.agent_phone || acceptedAgent) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg text-gray-900 uppercase">{t.dashboard.profile.agentContact}</h3>
            <div className="flex items-center gap-1">
              {!readOnly && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="group text-purple-600 hover:text-purple-700 transition-colors" aria-label={t.dashboard.profile.agentTipsLabel}>
                      <Info className="h-4 w-4 group-hover:stroke-[2.5]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="text-sm font-body bg-white border-gray-200 text-gray-900" side="top">
                    <p className="font-semibold mb-1 text-gray-900">💡 {t.dashboard.profile.tips}</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-500 text-xs">
                      <li>{t.dashboard.profile.agentTip1}</li>
                      <li>{t.dashboard.profile.agentTip2}</li>
                      <li>{t.dashboard.profile.agentTip3}</li>
                    </ul>
                  </PopoverContent>
                </Popover>
              )}
              <SectionEditButton section="agent" />
            </div>
          </div>
          {editingAgent && (
            <p className="text-xs text-gray-500 mb-3">
              {lang === "ro" ? "Selectează un agent înregistrat sau adaugă manual pentru a trimite o cerere de colaborare" : "Select a registered agent or add manually to send a collaboration request"}
            </p>
          )}
          {editingAgent ? (
            <div className="space-y-3">
              {/* Pending collaboration request */}
              {collaborationStatus === "pending" && selectedRegisteredAgent && (
                <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {selectedRegisteredAgent.photo_url ? (
                        <img src={selectedRegisteredAgent.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold text-gray-500">{selectedRegisteredAgent.first_name?.[0]}{selectedRegisteredAgent.last_name?.[0]}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{selectedRegisteredAgent.first_name} {selectedRegisteredAgent.last_name}</p>
                      <p className="text-xs text-yellow-700">{lang === "ro" ? "⏳ Cerere în așteptare..." : "⏳ Request pending..."}</p>
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
                  <Label className="text-xs text-gray-500">{t.dashboard.profile.agentName}</Label>
                  <Input
                    value={form.agent_name || ""}
                    onChange={(e) => handleAgentNameChange(e.target.value)}
                    onFocus={() => { if (agentSuggestions.length > 0) setShowAgentSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowAgentSuggestions(false), 200)}
                    className="bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900"
                    placeholder={lang === "ro" ? "Caută agent după nume..." : "Search agent by name..."}
                    autoComplete="off"
                  />
                  {showAgentSuggestions && agentSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {agentSuggestions.map((agent) => (
                        <button
                          key={agent.user_id}
                          type="button"
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 text-left transition-colors"
                          onMouseDown={(e) => { e.preventDefault(); selectAgent(agent); }}
                        >
                          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {agent.photo_url ? (
                              <img src={agent.photo_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-gray-500">{agent.first_name?.[0]}{agent.last_name?.[0]}</span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{agent.first_name} {agent.last_name}</p>
                            {agent.email && <p className="text-xs text-gray-500">{agent.email}</p>}
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
                  <Label className="text-xs text-gray-500">{t.dashboard.profile.agentEmail}</Label>
                  <Input
                    type="email"
                    value={form.agent_email || ""}
                    onChange={(e) => updateForm("agent_email", e.target.value)}
                    className={`bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900 ${form.agent_email && !form.agent_email.includes("@") ? "border-destructive focus-visible:ring-destructive" : ""}`}
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
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {acceptedAgent.photo_url ? (
                      <img src={acceptedAgent.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold text-gray-500">{acceptedAgent.first_name?.[0]}{acceptedAgent.last_name?.[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {!readOnly && profile?.agent_email ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="text-gray-900 font-semibold hover:underline text-left">
                            {acceptedAgent.first_name} {acceptedAgent.last_name}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-3 bg-white border-gray-200 text-gray-900">
                          <p className="text-xs text-gray-500 mb-1">{lang === "ro" ? "Email agent" : "Agent email"}</p>
                          <p className="text-sm text-gray-900 select-all">{profile.agent_email}</p>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <p className="text-gray-900 font-semibold">{acceptedAgent.first_name} {acceptedAgent.last_name}</p>
                    )}
                    <p className="text-xs text-primary">{lang === "ro" ? "✓ Colaborare activă" : "✓ Active collaboration"}</p>
                  </div>
                </div>
              ) : profile?.agent_name ? (
                <>
                  <p className="text-gray-900 font-semibold">{profile.agent_name}</p>
                  {!readOnly && profile.agent_email && <p className="text-gray-500">{profile.agent_email}</p>}
                  {!readOnly && profile.agent_phone && <p className="text-gray-500">{profile.agent_phone}</p>}
                </>
              ) : collaborationStatus === "pending" && selectedRegisteredAgent ? (
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600">⏳</span>
                  <span className="text-gray-500">
                    {lang === "ro" ? `Cerere trimisă către ${selectedRegisteredAgent.first_name} ${selectedRegisteredAgent.last_name}` : `Request sent to ${selectedRegisteredAgent.first_name} ${selectedRegisteredAgent.last_name}`}
                  </span>
                </div>
              ) : (
                <p className="text-gray-500">{t.dashboard.profile.noAgent}</p>
              )}
            </div>
          )}
          {editingAgent && collaborationStatus !== "pending" && <SectionSaveButton />}
        </div>
        )}
      </div>

      {/* Decorative geometric shapes between the physical/agent row and career */}
      <div className="relative h-0 overflow-visible">
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "-40px",
            right: "0px",
            width: "260px",
            height: "260px",
            background: "#a3e635",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "0px",
            left: "-16px",
            width: "200px",
            height: "200px",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            opacity: 0.9,
          }}
        />
      </div>

      {/* About */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-2xl text-gray-900">{t.dashboard.profile.about}</h3>
            {!readOnly && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="group text-purple-600 hover:text-purple-700 transition-colors" aria-label={t.dashboard.profile.aboutTipsLabel}>
                    <Info className="h-4 w-4 group-hover:stroke-[2.5]" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="text-sm font-body bg-white border-gray-200 text-gray-900" side="top">
                  <p className="font-semibold mb-1 text-gray-900">💡 {t.dashboard.profile.tips}</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-500 text-xs">
                    <li>{t.dashboard.profile.aboutTip1}</li>
                    <li>{t.dashboard.profile.aboutTip2}</li>
                    <li>{t.dashboard.profile.aboutTip3}</li>
                  </ul>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <SectionEditButton section="about" />
        </div>
        {editingAbout ? (
          <div className="space-y-4">
            {careerEntries.map((entry, idx) => {
              const isExpanded = expandedCareerIdx === idx;
              return (
              <div key={idx} className="bg-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedCareerIdx(isExpanded ? null : idx)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{entry.team_name || (lang === "ro" ? "Echipă nouă" : "New team")}</p>
                    <p className="text-xs text-gray-500">
                      {entry.start_date ? careerYear(entry.start_date) : "—"}
                      {" — "}
                      {entry.currently_active ? t.dashboard.scoutProfile.presentWord : entry.end_date ? careerYear(entry.end_date) : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCareerEntries(careerEntries.filter((_, i) => i !== idx));
                        if (isExpanded) setExpandedCareerIdx(null);
                      }}
                      className="text-gray-500 hover:text-destructive transition-colors p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>
                {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
                <div>
                  <Label className="text-xs text-gray-900 font-medium">{tp.teamLabel}</Label>
                  <TeamNameInput
                    value={entry.team_name}
                    onChange={(val) => {
                      const updated = [...careerEntries];
                      updated[idx] = { ...entry, team_name: val };
                      setCareerEntries(updated);
                      // Sync to header if this entry is currently active
                      if (entry.currently_active) {
                        updateForm("current_team", val);
                      }
                    }}
                    suggestions={teamNameSuggestions}
                    placeholder={tp.teamPlaceholder}
                    className="bg-white border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900"
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
                    <p className="text-xs text-destructive font-medium">{tp.overlapWarning}</p>
                  ) : null;
                })()}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-900 font-medium">{lang === "ro" ? "Anul de început" : "Start year"}</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder={lang === "ro" ? "ex: 2019" : "e.g. 2019"}
                      value={careerYear(entry.start_date)}
                      min={1950}
                      max={new Date().getFullYear() + 1}
                      onChange={(e) => {
                        const updated = [...careerEntries];
                        updated[idx] = { ...entry, start_date: e.target.value ? `${e.target.value}-01-01` : "" };
                        setCareerEntries(updated);
                      }}
                      className="bg-white border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-900 font-medium">{lang === "ro" ? "Anul de sfârșit" : "End year"}</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder={lang === "ro" ? "ex: 2021" : "e.g. 2021"}
                      value={careerYear(entry.end_date)}
                      min={entry.start_date ? careerYear(entry.start_date) : 1950}
                      max={new Date().getFullYear() + 1}
                      onChange={(e) => {
                        const updated = [...careerEntries];
                        updated[idx] = { ...entry, end_date: e.target.value ? `${e.target.value}-01-01` : "" };
                        setCareerEntries(updated);
                      }}
                      disabled={entry.currently_active}
                      className="bg-white border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900"
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
                  <Label htmlFor={`currently-active-${idx}`} className="text-xs text-gray-900 cursor-pointer">
                    {tp.currentlyActiveLabel}
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
                )}
              </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCareerEntries([...careerEntries, { team_name: "", start_date: "", end_date: "", currently_active: false, description: "" }]);
                setExpandedCareerIdx(careerEntries.length);
              }}
              className="w-full bg-white text-gray-900 border-gray-300 hover:text-gray-900 hover:bg-gray-100"
            >
              <Plus className="h-4 w-4 mr-1" /> {tp.addTeamBtn}
            </Button>
            <SectionSaveButton />
          </div>
        ) : (
          <div className="space-y-3">
            {careerEntries.filter((e) => e.team_name.trim()).length > 0 ? (
              careerEntries.filter((e) => e.team_name.trim()).map((entry, idx) => (
                <div key={idx} className="border-l-2 border-primary/30 pl-3">
                  <p className="font-semibold text-gray-900 text-sm">{entry.team_name}</p>
                  <p className="text-xs text-gray-500">
                    {entry.start_date ? careerYear(entry.start_date) : "—"}
                    {" — "}
                    {entry.currently_active ? t.dashboard.scoutProfile.presentWord : entry.end_date ? careerYear(entry.end_date) : "—"}
                  </p>
                  {entry.description && (() => {
                    try {
                      const parsed = JSON.parse(entry.description);
                      const items = Array.isArray(parsed) ? parsed : [parsed];
                      const validItems = items.filter((p: any) => p.place || p.championship || p.category || p.year);
                      if (validItems.length === 0) return null;
                      return validItems.map((p: any, pIdx: number) => {
                         const categoryLabel = sport === "basketball" ? tp.categoryLabelBasketball : tp.categoryLabelFootball;
                         const parts = [p.place, p.championship, p.category ? `${categoryLabel} ${p.category}` : null, p.year ? `${tp.seasonPrefix} ${p.year}` : null].filter(Boolean);
                         return (
                           <div key={pIdx} className="mt-1">
                             <p className="text-xs text-gray-500">🏆 {parts.join(" • ")}</p>
                             {p.document_url && (
                               <button type="button" onClick={() => window.open(p.document_url, '_blank')} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
                                 <FileText className="h-3 w-3" /> {tp.documentAttachedText}
                               </button>
                             )}
                           </div>
                         );
                      });
                    } catch {
                      return <p className="text-xs text-gray-500 mt-1">{entry.description}</p>;
                    }
                  })()}
                </div>
              ))
            ) : (
              <p className="italic text-gray-500 text-sm">{t.dashboard.profile.noDescription}</p>
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
    <div className="space-y-8" data-tour="video-add">
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
      <div className={`flex items-center justify-between ${videos.length === 1 ? "sm:max-w-[calc(50%-0.5rem)]" : ""}`}>
        <h4 className="font-display text-lg text-gray-900 uppercase tracking-wide">{title}</h4>
        <SectionEditButton section={section} />
      </div>
      {editing && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-500 font-body mb-2 block">{t.dashboard.profile.addVideo}</Label>
            <div className="flex gap-2">
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder={t.dashboard.profile.videoPlaceholder}
                className="flex-1 bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900"
                onKeyDown={(e) => e.key === "Enter" && addVideoWithDescription()}
              />
              <Button onClick={addVideoWithDescription} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white"><Plus className="h-4 w-4 mr-1" />{t.dashboard.profile.addBtn}</Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500 font-body mb-1 block">Descriere video (opțional)</Label>
            <Textarea
              value={newVideoDescription}
              onChange={(e) => setNewVideoDescription(e.target.value)}
              placeholder="Ex: Liga 1 - Etapa 12, vs FC Steaua, gol din minutul 34..."
              rows={2}
              className="bg-gray-100 border-gray-300 text-gray-900 text-sm focus-visible:ring-1 focus-visible:ring-gray-900"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <div className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-3 cursor-pointer hover:border-primary/50 hover:bg-gray-100 transition-colors">
                {uploading ? (
                  <><Loader2 className="h-5 w-5 text-primary animate-spin" /><span className="text-sm text-gray-500 font-body">Se încarcă...</span></>
                ) : (
                  <><Upload className="h-5 w-5 text-gray-500" /><span className="text-sm text-gray-500 font-body">Încarcă video de pe calculator (MP4, WebM, MOV, max 100MB)</span></>
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
              <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden group relative">
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
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Youtube className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-body text-sm text-gray-900 truncate">{url}</span>
                  </a>
                )}
                <div className="px-4 py-3 border-t border-gray-200">
                  {editing ? (
                    <Textarea
                      value={description}
                      onChange={(e) => updateDescription(i, e.target.value)}
                      placeholder="Descriere: competiție, adversar, stagiu meci..."
                      rows={2}
                      className="bg-gray-100 border-gray-300 text-gray-900 text-xs focus-visible:ring-1 focus-visible:ring-gray-900"
                    />
                  ) : description ? (
                    <p className="text-gray-700 font-body text-sm leading-relaxed">{description}</p>
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
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <Youtube className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 font-body text-sm">{t.dashboard.profile.noVideos}</p>
        </div>
      )}
      {editing && (
        <div className={videos.length === 1 ? "sm:max-w-[calc(50%-0.5rem)]" : ""}>
          <SectionSaveButton />
        </div>
      )}
    </div>
  );
}


/* ======================== POSTS TAB ======================== */
// Decorative geometric accents scattered between feed cards, alternating
// sides and colors so they don't all pile up on the same edge.
const feedDividerVariants = [
  { side: "left" as const, background: "linear-gradient(135deg, #7c3aed, #a855f7)", clipPath: "polygon(0 0, 100% 0, 0 100%)" },
  { side: "right" as const, background: "#a3e635", clipPath: "polygon(100% 0, 100% 100%, 0 100%)" },
  { side: "left" as const, background: "linear-gradient(135deg, #f97316, #fb923c)", clipPath: "polygon(0 100%, 100% 100%, 0 0)" },
];

const FeedDivider = ({ index }: { index: number }) => {
  const variant = feedDividerVariants[index % feedDividerVariants.length];
  return (
    <div className="relative h-0 overflow-visible">
      <div
        className="absolute -z-10 pointer-events-none"
        style={{
          top: "-20px",
          [variant.side]: "-20px",
          width: "120px",
          height: "120px",
          background: variant.background,
          clipPath: variant.clipPath,
          opacity: 0.9,
        }}
      />
    </div>
  );
};

function PostsTab({ userId, readOnly = false }: { userId: string; readOnly?: boolean }) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authorInfo, setAuthorInfo] = useState<{ name: string; photo: string | null; role: string; title: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
      .catch((err) => console.error("Failed to get current user:", err));
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);

    // Fetch posts from both tables
    const [postsRes, scoutPostsRes] = await Promise.all([
      (supabase as any).from("posts").select("*").eq("user_id", userId).is("deleted_at", null).eq("is_archived", false).order("created_at", { ascending: false }),
      (supabase as any).from("scout_posts").select("*").eq("user_id", userId).is("deleted_at", null).eq("is_archived", false).order("created_at", { ascending: false }),
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
  }, [userId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleDelete = useCallback(async (postId: string) => {
    const deletedAt = new Date().toISOString();
    const [postsRes, scoutPostsRes] = await Promise.all([
      (supabase as any).from("posts").update({ deleted_at: deletedAt }).eq("id", postId).select("id"),
      (supabase as any).from("scout_posts").update({ deleted_at: deletedAt }).eq("id", postId).select("id"),
    ]);
    // The post lives in exactly one of the two tables, so one call always
    // affects 0 rows — that's expected. Only treat this as a failure if
    // neither call actually updated a row (both errored, or both matched
    // nothing), so a real failure doesn't silently remove the post from the
    // UI while leaving it un-deleted in the database.
    const succeeded = (postsRes.data?.length ?? 0) > 0 || (scoutPostsRes.data?.length ?? 0) > 0;
    if (!succeeded) {
      toast({ title: lang === "ro" ? "Eroare la ștergere." : "Failed to delete.", variant: "destructive" });
      return;
    }
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, [lang, toast]);

  const handleViewProfile = useCallback(() => {}, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!readOnly && currentUserId && (
        <NewPostComposer currentUserId={currentUserId} myPhoto={authorInfo?.photo} onPosted={fetchPosts} />
      )}

      {/* Decorative geometric shape between composer and feed */}
      <div className="relative h-0 overflow-visible">
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "-30px",
            right: "-16px",
            width: "180px",
            height: "180px",
            background: "linear-gradient(135deg, #f97316, #fb923c)",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            opacity: 0.9,
          }}
        />
      </div>

      {posts.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 font-body">
          {lang === "ro" ? "Nicio postare încă." : "No posts yet."}
        </p>
      ) : (
        <div className="space-y-4">
          {posts.map((post, idx) => (
            <Fragment key={post.id}>
              <PostCard
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
              {idx < posts.length - 1 && <FeedDivider index={idx} />}
            </Fragment>
          ))}
        </div>
      )}

      {/* Decorative geometric shapes below the feed */}
      <div className="relative h-0 overflow-visible">
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "-20px",
            right: "0px",
            width: "160px",
            height: "160px",
            background: "#a3e635",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "20px",
            left: "-16px",
            width: "130px",
            height: "130px",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            opacity: 0.9,
          }}
        />
      </div>
    </div>
  );
}

function getRejectionDaysLeft(sub: { status: string; reviewed_at: string | null } | undefined): number {
  if (!sub || sub.status !== "rejected" || !sub.reviewed_at) return 0;
  const elapsed = (Date.now() - new Date(sub.reviewed_at).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, 3 - elapsed);
}

function getVerifiedCooldownDaysLeft(sub: { status: string; reviewed_at: string | null } | undefined): number {
  if (!sub || sub.status !== "verified" || !sub.reviewed_at) return 0;
  const elapsed = (Date.now() - new Date(sub.reviewed_at).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, 30 - elapsed);
}

function getUploadCooldownDaysLeft(sub: { status: string; reviewed_at: string | null } | undefined): number {
  return getRejectionDaysLeft(sub) || getVerifiedCooldownDaysLeft(sub);
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default PersonalProfile;
