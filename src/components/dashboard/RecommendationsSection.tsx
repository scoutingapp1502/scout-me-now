import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit2,
  Quote,
  PenSquare,
  Loader2,
  Check,
  X as XIcon,
  EyeOff,
  Trash2,
  Search,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

const LOCALE_BY_LANG: Record<Language, string> = {
  ro: "ro-RO", en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT",
};

type RecStatus = "pending" | "submitted" | "accepted" | "rejected";
type Initiated = "request" | "offer";

interface Recommendation {
  id: string;
  recipient_user_id: string;
  author_user_id: string;
  content: string;
  status: RecStatus;
  initiated_by: Initiated;
  created_at: string;
  updated_at: string;
}

interface ExternalRecommendation {
  id: string;
  request_id: string;
  recipient_user_id: string;
  author_name: string;
  author_email: string;
  content: string;
  status: "submitted" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
}

interface PersonInfo {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role?: string;
}

interface Props {
  /** Profilul vizitat (recipient) */
  profileUserId: string;
  /** Vizitatorul autentificat */
  viewerUserId: string | null;
  /** True dacă vizitatorul este chiar proprietarul profilului */
  isOwner: boolean;
  /** Rolul profilului vizitat: "player" | "scout" | "agent" etc. */
  profileRole?: string;
  /** Callback pentru navigare la profilul unui utilizator */
  onViewProfile?: (userId: string, role: string) => void;
}

const RecommendationsSection = ({ profileUserId, viewerUserId, isOwner, profileRole, onViewProfile }: Props) => {
  const { toast } = useToast();
  const { lang, t } = useLanguage();
  const rt = t.dashboard.recommendations;

  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [externalRecs, setExternalRecs] = useState<ExternalRecommendation[]>([]);
  const [people, setPeople] = useState<Record<string, PersonInfo>>({});
  const [canConnect, setCanConnect] = useState(false); // viewer ↔ profile sunt conectați
  const [tab, setTab] = useState<"primite" | "oferite" | "asteptare">("primite");

  // Dialog state
  const [askOpen, setAskOpen] = useState(false);
  const [giveOpen, setGiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [respondOpen, setRespondOpen] = useState(false);
  const [respondRecId, setRespondRecId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Settings
      const { data: settingRow } = await supabase
        .from("recommendations_settings")
        .select("enabled")
        .eq("user_id", profileUserId)
        .maybeSingle();
      const isEnabled = settingRow?.enabled ?? true;
      setEnabled(isEnabled);

      // Recommendations: pe profilul curent (primite) + pentru viewer pe acest profil (oferite/asteptare)
      const filters: string[] = [`recipient_user_id.eq.${profileUserId}`];
      if (viewerUserId && viewerUserId !== profileUserId) {
        filters.push(`author_user_id.eq.${viewerUserId}`);
      }
      let query = supabase.from("recommendations").select("*");
      if (isOwner) {
        // Owner vede tot ce ține de el
        query = query.or(
          `recipient_user_id.eq.${profileUserId},author_user_id.eq.${profileUserId}`
        );
      } else {
        // Vizitator: doar accepted pe profil + propriile interacțiuni cu acest profil
        query = query.or(filters.join(","));
      }
      const { data: rows, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      const list = (rows || []) as Recommendation[];
      setRecs(list);

      // External recommendations (persoane fara cont)
      if (isOwner) {
        const { data: extRows } = await supabase
          .from("external_recommendations")
          .select("*")
          .eq("recipient_user_id", profileUserId)
          .order("created_at", { ascending: false });
        setExternalRecs((extRows || []) as ExternalRecommendation[]);
      } else {
        // Vizitatorii vad doar cele acceptate
        const { data: extRows } = await supabase
          .from("external_recommendations")
          .select("*")
          .eq("recipient_user_id", profileUserId)
          .eq("status", "accepted")
          .order("created_at", { ascending: false });
        setExternalRecs((extRows || []) as ExternalRecommendation[]);
      }

      // Fetch people info
      const ids = new Set<string>();
      list.forEach((r) => {
        ids.add(r.author_user_id);
        ids.add(r.recipient_user_id);
      });
      ids.delete("");
      if (ids.size > 0) {
        const idsArr = Array.from(ids);
        const [profilesRows, rolesRows, playerPhotos, scoutPhotos] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name").in("user_id", idsArr),
          supabase.from("user_roles").select("user_id, role").in("user_id", idsArr),
          supabase.from("player_profiles").select("user_id, photo_url").in("user_id", idsArr),
          supabase.from("scout_profiles").select("user_id, photo_url").in("user_id", idsArr),
        ]);
        const roleMap: Record<string, string> = {};
        (rolesRows.data || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });
        const photoMap: Record<string, string | null> = {};
        (playerPhotos.data || []).forEach((r: any) => { photoMap[r.user_id] = r.photo_url; });
        (scoutPhotos.data || []).forEach((r: any) => { photoMap[r.user_id] = r.photo_url; });
        const map: Record<string, PersonInfo> = {};
        (profilesRows.data || []).forEach((p: any) => {
          map[p.user_id] = {
            user_id: p.user_id,
            full_name: p.full_name || rt.defaultUserName,
            avatar_url: photoMap[p.user_id] ?? null,
            role: roleMap[p.user_id],
          };
        });
        setPeople(map);
      }

      // Verifică dacă viewer-ul poate trimite (conexiune mutuală existentă)
      if (viewerUserId && viewerUserId !== profileUserId) {
        const { data: follows } = await supabase
          .from("follows")
          .select("id")
          .eq("status", "accepted")
          .or(
            `and(follower_id.eq.${viewerUserId},following_id.eq.${profileUserId}),` +
              `and(follower_id.eq.${profileUserId},following_id.eq.${viewerUserId})`
          )
          .limit(1);
        setCanConnect((follows || []).length > 0);
      } else {
        setCanConnect(false);
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: rt.errorTitle, description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUserId, viewerUserId, isOwner]);

  // Derive lists
  const accepted = useMemo(
    () => recs.filter((r) => r.recipient_user_id === profileUserId && r.status === "accepted"),
    [recs, profileUserId]
  );
  const acceptedExternal = useMemo(
    () => externalRecs.filter((r) => r.status === "accepted"),
    [externalRecs]
  );
  const allAccepted = useMemo(
    () => [...accepted, ...acceptedExternal].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [accepted, acceptedExternal]
  );
  // Pentru owner editor:
  const ownerPrimite = useMemo(
    () => recs.filter((r) => r.recipient_user_id === profileUserId && (r.status === "submitted" || r.status === "accepted")),
    [recs, profileUserId]
  );
  const ownerPrimiteExt = useMemo(
    () => externalRecs.filter((r) => r.status === "submitted" || r.status === "accepted"),
    [externalRecs]
  );
  const ownerOferite = useMemo(
    () => recs.filter(
      (r) => r.author_user_id === profileUserId && !(r.status === "pending" && r.initiated_by === "request")
    ),
    [recs, profileUserId]
  );
  const ownerAsteptare = useMemo(
    () =>
      recs.filter(
        (r) =>
          (r.recipient_user_id === profileUserId && r.status === "pending") ||
          (r.author_user_id === profileUserId && r.status === "submitted") ||
          (r.author_user_id === profileUserId && r.status === "pending" && r.initiated_by === "request")
      ),
    [recs, profileUserId]
  );

  // ====== ACTIONS ======
  const requestRecommendation = async (authorUserId: string, content: string) => {
    if (!viewerUserId) return;
    // viewer = recipient (cere recomandare), authorUserId = cel care scrie
    const { error } = await supabase.from("recommendations").insert({
      recipient_user_id: viewerUserId,
      author_user_id: authorUserId,
      content: content || "",
      status: "pending",
      initiated_by: "request",
    });
    if (error) {
      toast({ title: rt.errorTitle, description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: rt.requestSentTitle, description: rt.requestSentDesc });
    setAskOpen(false);
    fetchAll();
  };

  const offerRecommendation = async (recipientId: string, content: string) => {
    if (!viewerUserId) return;
    if (!content.trim()) {
      toast({ title: rt.writeFirst, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("recommendations").insert({
      recipient_user_id: recipientId,
      author_user_id: viewerUserId,
      content: content.trim(),
      status: "submitted",
      initiated_by: "offer",
    });
    if (error) {
      toast({ title: rt.errorTitle, description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: rt.offerSentTitle,
      description: rt.offerSentDesc,
    });
    setGiveOpen(false);
    fetchAll();
  };

  const updateStatus = async (id: string, status: RecStatus) => {
    const { error } = await supabase.from("recommendations").update({ status }).eq("id", id);
    if (error) {
      toast({ title: rt.errorTitle, description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  const removeRec = async (id: string) => {
    const { error } = await supabase.from("recommendations").delete().eq("id", id);
    if (error) {
      toast({ title: rt.errorTitle, description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  const updateExtStatus = async (id: string, status: ExternalRecommendation["status"]) => {
    const { error } = await supabase.from("external_recommendations").update({ status }).eq("id", id);
    if (error) {
      toast({ title: rt.errorTitle, description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  const removeExtRec = async (id: string) => {
    const { error } = await supabase.from("external_recommendations").delete().eq("id", id);
    if (error) {
      toast({ title: rt.errorTitle, description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  const respondToRequest = async (id: string, content: string) => {
    if (!content.trim()) {
      toast({ title: rt.writeFirst, variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("recommendations")
      .update({ content: content.trim(), status: "submitted" })
      .eq("id", id)
      .eq("author_user_id", profileUserId);
    if (error) {
      toast({ title: rt.errorTitle, description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: rt.offerSentTitle, description: rt.offerSentDesc });
    setRespondOpen(false);
    setRespondRecId(null);
    fetchAll();
  };

  const toggleEnabled = async (next: boolean) => {
    if (!isOwner) return;
    setEnabled(next);
    const { error } = await supabase
      .from("recommendations_settings")
      .upsert({ user_id: profileUserId, enabled: next }, { onConflict: "user_id" });
    if (error) {
      toast({ title: rt.errorTitle, description: error.message, variant: "destructive" });
      setEnabled(!next);
    }
  };

  // Dacă secțiunea e dezactivată și nu suntem proprietari -> ascunde complet
  if (!isOwner && !enabled) return null;

  const PersonRow = ({ userId, date, light }: { userId: string; date?: string; light?: boolean }) => {
    const p = people[userId];
    const canClick = !!onViewProfile && !!p?.role;
    const inner = (
      <>
        <div className={cn("h-10 w-10 rounded-full overflow-hidden flex-shrink-0", light ? "bg-gray-100" : "bg-gray-100")}>
          {p?.avatar_url ? (
            <img src={p.avatar_url} alt={p.full_name} className="h-full w-full object-cover" />
          ) : (
            <div className={cn("h-full w-full flex items-center justify-center text-xs", light ? "text-gray-500" : "text-gray-500")}>
              {(p?.full_name?.[0] || "?").toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className={cn("font-body font-semibold text-sm truncate", light ? "text-gray-900" : "text-gray-900", canClick && "hover:underline")}>
            {p?.full_name || rt.defaultUserName}
          </p>
          {date && (
            <p className={cn("text-xs font-body", light ? "text-gray-500" : "text-gray-500")}>
              {new Date(date).toLocaleDateString(LOCALE_BY_LANG[lang], { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
      </>
    );
    if (canClick) {
      return (
        <button
          className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
          onClick={() => onViewProfile!(userId, p!.role!)}
        >
          {inner}
        </button>
      );
    }
    return <div className="flex items-center gap-3">{inner}</div>;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="font-display text-2xl text-gray-900 tracking-wide">{rt.title}</h2>

        <div className="flex items-center gap-2">
          {/* + buton pentru vizitatori conectați sau owner */}
          {((!isOwner && viewerUserId && canConnect) || isOwner) && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="group text-gray-900 hover:text-gray-400 transition-colors p-1"
                  aria-label={rt.addLabel}
                >
                  <Plus className="h-5 w-5 stroke-[2.5] group-hover:stroke-[1.5]" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2 bg-white border-gray-200">
                <button
                  className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 text-left"
                  onClick={() => setAskOpen(true)}
                >
                  <Quote className="h-5 w-5 text-orange-500" />
                  <span className="text-sm font-body text-gray-900">{rt.requestAction}</span>
                </button>
                <button
                  className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 text-left"
                  onClick={() => setGiveOpen(true)}
                >
                  <PenSquare className="h-5 w-5 text-orange-500" />
                  <span className="text-sm font-body text-gray-900">{rt.offerAction}</span>
                </button>
              </PopoverContent>
            </Popover>
          )}

          {/* Creion = manager pentru proprietar */}
          {isOwner && (
            <button
              onClick={() => setEditOpen(true)}
              className="group text-gray-900 hover:text-gray-400 transition-colors p-1"
              aria-label={rt.manageAriaLabel}
            >
              <Edit2 className="h-4 w-4 stroke-[2.5] group-hover:stroke-[1.5]" />
            </button>
          )}
        </div>
      </div>

      {isOwner && !enabled && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-md bg-gray-100 text-gray-500 text-sm">
          <EyeOff className="h-4 w-4" />
          <span className="font-body">
            {rt.hiddenBanner}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : allAccepted.length === 0 ? (
        <p className="text-gray-500 italic text-sm font-body">
          {isOwner
            ? rt.emptyOwner
            : rt.emptyVisitor}
        </p>
      ) : (
        <div className="space-y-5">
          {allAccepted.map((r) => {
            const isExt = "author_name" in r;
            if (isExt) {
              const ext = r as ExternalRecommendation;
              return (
                <div key={ext.id} className="border-b border-gray-200 last:border-b-0 pb-4 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                      {ext.author_name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-body font-semibold text-gray-900 text-sm">{ext.author_name}</p>
                      <p className="text-xs text-gray-500 font-body">
                        {new Date(ext.created_at).toLocaleDateString(LOCALE_BY_LANG[lang], { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-700 font-body text-sm whitespace-pre-line mt-3">
                    {ext.content}
                  </p>
                </div>
              );
            }
            const rec = r as Recommendation;
            return (
              <div key={rec.id} className="border-b border-gray-200 last:border-b-0 pb-4 last:pb-0">
                <PersonRow userId={rec.author_user_id} date={rec.updated_at} light />
                <p className="text-gray-700 font-body text-sm whitespace-pre-line mt-3">
                  {rec.content}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ========= DIALOG: SOLICITĂ ========= */}
      <RequestDialog
        open={askOpen}
        onOpenChange={setAskOpen}
        recipientName={people[profileUserId]?.full_name || ""}
        onSubmit={requestRecommendation}
        viewerUserId={viewerUserId}
        defaultAuthorId={!isOwner ? profileUserId : undefined}
        profileRole={profileRole}
      />

      {/* ========= DIALOG: OFERĂ ========= */}
      <OfferDialog
        open={giveOpen}
        onOpenChange={setGiveOpen}
        onSubmit={offerRecommendation}
        viewerUserId={viewerUserId}
        defaultRecipientId={!isOwner ? profileUserId : undefined}
        defaultRecipientName={people[profileUserId]?.full_name || ""}
      />

      {/* ========= DIALOG: RĂSPUNDE LA CERERE ========= */}
      <RespondDialog
        open={respondOpen}
        onOpenChange={(v) => { setRespondOpen(v); if (!v) setRespondRecId(null); }}
        requesterName={respondRecId ? (people[recs.find((r) => r.id === respondRecId)?.recipient_user_id || ""]?.full_name || "") : ""}
        requestMsg={respondRecId ? (recs.find((r) => r.id === respondRecId)?.content || "") : ""}
        onSubmit={(content) => { if (respondRecId) respondToRequest(respondRecId, content); }}
      />

      {/* ========= DIALOG: GESTIONEAZĂ (owner) ========= */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white text-gray-900 border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900 font-display tracking-wide">{rt.title}</DialogTitle>
            <DialogDescription className="text-gray-500 font-bold">
              {rt.manageDesc}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between p-3 rounded-md border border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-900 font-body">
                {rt.showSection}
              </p>
              <p className="text-xs text-gray-500 font-body">
                {rt.showSectionDesc}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleEnabled} className="data-[state=checked]:bg-gray-900 data-[state=unchecked]:bg-gray-300" />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            {([
              ["primite", `${rt.receivedTab} (${ownerPrimite.length + ownerPrimiteExt.length})`],
              ["oferite", `${rt.offeredTab} (${ownerOferite.length})`],
              ["asteptare", `${rt.pendingTab} (${ownerAsteptare.length})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "px-3 py-2 text-sm font-body transition-colors border-b-2",
                  tab === key
                    ? "border-orange-500 text-gray-900 font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Lista per tab */}
          <div className="space-y-3 mt-2">
            {tab === "primite" &&
              (ownerPrimite.length === 0 && ownerPrimiteExt.length === 0 ? (
                <p className="text-gray-500 italic text-sm font-body py-4 text-center">
                  {rt.noReceived}
                </p>
              ) : (
                <>
                  {ownerPrimite.map((r) => (
                    <div key={r.id} className="border border-gray-200 rounded-md p-3">
                      <div className="flex items-start justify-between gap-2">
                        <PersonRow userId={r.author_user_id} date={r.updated_at} light />
                        <span
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full font-body font-semibold",
                            r.status === "accepted"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-500"
                          )}
                        >
                          {r.status === "accepted" ? rt.statusPublic : rt.statusPending}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-line font-body">
                        {r.content}
                      </p>
                      <div className="flex gap-2 mt-3 justify-end">
                        {r.status === "submitted" && (
                          <>
                            <Button size="sm" variant="outline" className="bg-white border-gray-300 text-gray-900 hover:bg-gray-100" onClick={() => updateStatus(r.id, "rejected")}>
                              <XIcon className="h-4 w-4 mr-1" /> {rt.reject}
                            </Button>
                            <Button size="sm" onClick={() => updateStatus(r.id, "accepted")}>
                              <Check className="h-4 w-4 mr-1" /> {rt.approve}
                            </Button>
                          </>
                        )}
                        {r.status === "accepted" && (
                          <Button size="sm" variant="ghost" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100" onClick={() => updateStatus(r.id, "submitted")}>
                            <EyeOff className="h-4 w-4 mr-1" /> {rt.hide}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-gray-500 hover:text-destructive hover:bg-gray-100" onClick={() => removeRec(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {ownerPrimiteExt.map((r) => (
                    <div key={r.id} className="border border-gray-200 rounded-md p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                            {r.author_name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-body font-semibold text-gray-900 text-sm">{r.author_name}</p>
                            <p className="text-xs text-gray-500 font-body">{r.author_email}</p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full font-body font-semibold shrink-0",
                            r.status === "accepted"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-500"
                          )}
                        >
                          {r.status === "accepted" ? rt.statusPublic : rt.statusPending}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-line font-body">
                        {r.content}
                      </p>
                      <div className="flex gap-2 mt-3 justify-end">
                        {r.status === "submitted" && (
                          <>
                            <Button size="sm" variant="outline" className="bg-white border-gray-300 text-gray-900 hover:bg-gray-100" onClick={() => updateExtStatus(r.id, "rejected")}>
                              <XIcon className="h-4 w-4 mr-1" /> {rt.reject}
                            </Button>
                            <Button size="sm" onClick={() => updateExtStatus(r.id, "accepted")}>
                              <Check className="h-4 w-4 mr-1" /> {rt.approve}
                            </Button>
                          </>
                        )}
                        {r.status === "accepted" && (
                          <Button size="sm" variant="ghost" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100" onClick={() => updateExtStatus(r.id, "submitted")}>
                            <EyeOff className="h-4 w-4 mr-1" /> {rt.hide}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-gray-500 hover:text-destructive hover:bg-gray-100" onClick={() => removeExtRec(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              ))}

            {tab === "oferite" &&
              (ownerOferite.length === 0 ? (
                <p className="text-gray-500 italic text-sm font-body py-4 text-center">
                  {rt.noOffered}
                </p>
              ) : (
                ownerOferite.map((r) => (
                  <div key={r.id} className="border border-gray-200 rounded-md p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-gray-500 font-body">{rt.forLabel}</p>
                        <PersonRow userId={r.recipient_user_id} date={r.updated_at} light />
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-body capitalize">
                        {r.status === "accepted"
                          ? rt.statusApproved
                          : r.status === "rejected"
                          ? rt.statusRejected
                          : r.status === "pending"
                          ? rt.statusToWrite
                          : rt.statusPending}
                      </span>
                    </div>
                    {r.content && (
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-line font-body">
                        {r.content}
                      </p>
                    )}
                    <div className="flex justify-end mt-2">
                      <Button size="sm" variant="ghost" className="text-gray-500 hover:text-destructive hover:bg-gray-100" onClick={() => removeRec(r.id)}>
                        <Trash2 className="h-4 w-4 mr-1" /> {rt.withdraw}
                      </Button>
                    </div>
                  </div>
                ))
              ))}

            {tab === "asteptare" &&
              (ownerAsteptare.length === 0 ? (
                <p className="text-gray-500 italic text-sm font-body py-4 text-center">
                  {rt.noPending}
                </p>
              ) : (
                ownerAsteptare.map((r) => {
                  const isPendingRequest = r.author_user_id === profileUserId && r.status === "pending" && r.initiated_by === "request";
                  const iAmRecipient = r.recipient_user_id === profileUserId;
                  return (
                    <div key={r.id} className="border border-gray-200 rounded-md p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-gray-500 font-body">
                            {isPendingRequest
                              ? rt.requestReceivedFrom
                              : iAmRecipient
                              ? rt.awaitingResponseFrom
                              : rt.awaitingYourApprovalFrom}
                          </p>
                          <PersonRow
                            userId={isPendingRequest ? r.recipient_user_id : iAmRecipient ? r.author_user_id : r.recipient_user_id}
                            date={r.updated_at}
                            light
                          />
                        </div>
                        {isPendingRequest && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-body shrink-0">
                            {rt.statusToWrite}
                          </span>
                        )}
                      </div>
                      {r.content && (
                        <p className="text-sm text-gray-700 mt-2 whitespace-pre-line font-body italic">
                          „{r.content}"
                        </p>
                      )}
                      <div className="flex gap-2 mt-3 justify-end">
                        {isPendingRequest && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setRespondRecId(r.id);
                              setRespondOpen(true);
                            }}
                          >
                            <PenSquare className="h-4 w-4 mr-1" /> {rt.recommendBtn}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-gray-500 hover:text-destructive hover:bg-gray-100" onClick={() => removeRec(r.id)}>
                          <Trash2 className="h-4 w-4 mr-1" /> {rt.cancelRequest}
                        </Button>
                      </div>
                    </div>
                  );
                })
              ))}
          </div>

          <DialogFooter>
            <Button variant="outline" className="bg-white border-gray-300 text-gray-900 hover:bg-gray-100" onClick={() => setEditOpen(false)}>
              {rt.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const RequestDialog = ({
  open,
  onOpenChange,
  recipientName,
  onSubmit,
  viewerUserId,
  defaultAuthorId,
  profileRole,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipientName: string;
  onSubmit: (authorUserId: string, msg: string) => void;
  viewerUserId: string | null;
  defaultAuthorId?: string;
  profileRole?: string;
}) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const rt = t.dashboard.recommendations;
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<{ user_id: string; full_name: string; avatar_url: string | null; roleLabel?: string; org?: string; loc?: string; _needsLoc?: boolean }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<{ user_id: string; full_name: string; avatar_url: string | null } | null>(null);
  const [relationship, setRelationship] = useState("");
  const [club, setClub] = useState("");
  const [clubCustom, setClubCustom] = useState("");
  const [myClubs, setMyClubs] = useState<string[]>([]);
  const [seasonFrom, setSeasonFrom] = useState("");
  const [seasonTo, setSeasonTo] = useState("");
  const [msg, setMsg] = useState("");

  const relationshipOptions = profileRole === "scout" ? rt.scoutRelationshipOptions : rt.playerRelationshipOptions;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => String(currentYear - i));

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSearchTerm("");
      setEmail("");
      setResults([]);
      setSelectedPerson(null);
      setRelationship("");
      setClub("");
      setClubCustom("");
      setSeasonFrom("");
      setSeasonTo("");
      setMsg("");
    }
  }, [open]);

  // Load viewer's career clubs
  useEffect(() => {
    if (!open || !viewerUserId) return;
    (async () => {
      const [careerRes, profileRes] = await Promise.all([
        supabase
          .from("player_career_entries")
          .select("team_name, sort_order")
          .eq("user_id", viewerUserId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("player_profiles")
          .select("current_team")
          .eq("user_id", viewerUserId)
          .maybeSingle(),
      ]);
      const set = new Set<string>();
      (careerRes.data || []).forEach((r: any) => {
        if (r.team_name?.trim()) set.add(r.team_name.trim());
      });
      if (profileRes.data?.current_team?.trim()) set.add(profileRes.data.current_team.trim());
      setMyClubs(Array.from(set));
    })();
  }, [open, viewerUserId]);

  // If opened from someone else's profile, skip step 1
  useEffect(() => {
    if (open && defaultAuthorId && defaultAuthorId !== viewerUserId) {
      setSelectedPerson({ user_id: defaultAuthorId, full_name: recipientName, avatar_url: null });
      setStep(2);
    }
  }, [open, defaultAuthorId, viewerUserId, recipientName]);

  const effectiveClub = club === "__altele__" ? clubCustom.trim() : club.trim();

  // Auto-fill message template when moving to step 3
  const generateTemplate = useCallback(() => {
    const name = selectedPerson?.full_name || rt.selectedPersonFallback;
    const clubText = effectiveClub ? effectiveClub : "[Club]";
    return rt.greetingTemplate.replace("{name}", name).replace("{club}", clubText);
  }, [selectedPerson, effectiveClub, rt]);

  const searchPeople = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .ilike("full_name", `%${term.trim()}%`)
      .neq("user_id", viewerUserId || "")
      .limit(12);

    if (!data || data.length === 0) {
      setResults([]);
      setSearching(false);
      return;
    }

    const userIds = data.map((p) => p.user_id);

    const [rolesRes, playerRes, scoutRes] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      supabase.from("player_profiles").select("user_id, current_team, nationality").in("user_id", userIds),
      supabase.from("scout_profiles").select("user_id, organization, country").in("user_id", userIds),
    ]);

    const rolesMap = new Map<string, string>();
    (rolesRes.data || []).forEach((r: any) => {
      if (r.role !== "admin") rolesMap.set(r.user_id, r.role);
    });
    const playerMap = new Map<string, { team?: string; nationality?: string }>();
    (playerRes.data || []).forEach((p: any) => playerMap.set(p.user_id, { team: p.current_team, nationality: p.nationality }));
    const scoutMap = new Map<string, { org?: string; country?: string }>();
    (scoutRes.data || []).forEach((s: any) => scoutMap.set(s.user_id, { org: s.organization, country: s.country }));

    const roleLabels = rt.roleLabels;

    const enriched = data.map((p) => {
      const role = rolesMap.get(p.user_id);
      const roleLabel = role ? (roleLabels as Record<string, string>)[role] || role : undefined;
      const org = role === "player" ? playerMap.get(p.user_id)?.team : scoutMap.get(p.user_id)?.org;
      const loc = role === "player" ? playerMap.get(p.user_id)?.nationality : scoutMap.get(p.user_id)?.country;
      return { ...p, roleLabel, org, loc, _needsLoc: false };
    });

    const nameGroups = new Map<string, typeof enriched>();
    enriched.forEach((p) => {
      const key = p.full_name?.toLowerCase() || "";
      if (!nameGroups.has(key)) nameGroups.set(key, []);
      nameGroups.get(key)!.push(p);
    });
    enriched.forEach((p) => {
      const group = nameGroups.get(p.full_name?.toLowerCase() || "") || [];
      p._needsLoc = group.length > 1 && group.filter((g) => g.roleLabel === p.roleLabel && g.org === p.org).length > 1;
    });

    setResults(enriched);
    setSearching(false);
  }, [viewerUserId, rt]);

  useEffect(() => {
    const timer = setTimeout(() => searchPeople(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, searchPeople]);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const stepLabel = `${step} ${rt.ofWord} 3`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white text-gray-900 border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900 font-display tracking-wide">{rt.requestDialogTitle}</DialogTitle>
          {step === 1 && (
            <DialogDescription className="text-gray-500">
              {rt.personalizeHelp}
            </DialogDescription>
          )}
          {step === 2 && selectedPerson && (
            <DialogDescription className="text-gray-500">
              {rt.personalizeHelp}
            </DialogDescription>
          )}
          {step === 3 && (
            <DialogDescription className="text-gray-500">
              {rt.includeMsgHelp}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900 font-body mb-1">
                {rt.whoToAsk}
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedPerson(null);
                  }}
                  placeholder={rt.searchPeoplePlaceholder}
                  className="pl-9 bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900"
                />
              </div>

              {searchTerm.trim().length >= 2 && (
                <div className="mt-2 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  ) : results.length > 0 ? (
                    results.map((p) => (
                      <button
                        key={p.user_id}
                        onClick={() => {
                          setSelectedPerson(p);
                          setSearchTerm(p.full_name);
                          setResults([]);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 text-left transition-colors",
                          selectedPerson?.user_id === p.user_id && "bg-gray-100"
                        )}
                      >
                        <div className="h-8 w-8 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt={p.full_name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
                              {(p.full_name?.[0] || "?").toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-body text-gray-900 block truncate">{p.full_name}</span>
                          {(p.roleLabel || p.org) && (
                            <span className="text-xs text-gray-500 font-body block truncate">
                              {[p.roleLabel, p.org, p._needsLoc ? p.loc : null].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 py-3 px-3 font-body">
                      {rt.noResultsFound}
                    </p>
                  )}
                </div>
              )}
            </div>

            {!selectedPerson && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-body">{rt.orEnterEmail}</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={rt.emailPlaceholder}
                    className="pl-9 bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900"
                    type="email"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500 font-body">
                {stepLabel}
              </span>
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={!selectedPerson && !isValidEmail(email)}
                onClick={() => setStep(2)}
              >
                {rt.continueBtn}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {selectedPerson && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-gray-100 border border-gray-200">
                <div className="h-8 w-8 rounded-full bg-white overflow-hidden flex-shrink-0">
                  {selectedPerson.avatar_url ? (
                    <img src={selectedPerson.avatar_url} alt={selectedPerson.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
                      {(selectedPerson.full_name?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-sm font-body text-gray-900 font-medium">{selectedPerson.full_name}</span>
                <button
                  onClick={() => { setSelectedPerson(null); setStep(1); setSearchTerm(""); }}
                  className="ml-auto text-gray-500 hover:text-gray-900"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            <p className="text-xs text-gray-500 font-body">{rt.requiredFieldNote}</p>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 font-body">
                {rt.howDoYouKnowPrefix} {selectedPerson?.full_name?.split(" ")[0] || rt.selectedPersonFallback}? *
              </label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-900">
                  <SelectValue placeholder={rt.pleaseSelect} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-gray-900">
                  {relationshipOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="focus:bg-gray-100 focus:text-gray-900">
                      {opt.template.replace("{name}", selectedPerson?.full_name?.split(" ")[0] || "X")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 font-body">
                {rt.whichClub}
              </label>
              <Select
                value={club}
                onValueChange={(v) => {
                  setClub(v);
                  if (v !== "__altele__") setClubCustom("");
                }}
              >
                <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-900">
                  <SelectValue placeholder={myClubs.length > 0 ? rt.selectClub : rt.noClubChooseOther} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-gray-900">
                  {myClubs.map((c) => (
                    <SelectItem key={c} value={c} className="focus:bg-gray-100 focus:text-gray-900">{c}</SelectItem>
                  ))}
                  <SelectItem value="__altele__" className="focus:bg-gray-100 focus:text-gray-900">{rt.otherManual}</SelectItem>
                </SelectContent>
              </Select>
              {club === "__altele__" && (
                <Input
                  value={clubCustom}
                  onChange={(e) => setClubCustom(e.target.value)}
                  placeholder={rt.clubCustomPlaceholder}
                  className="bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900"
                />
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 font-body">
                {rt.whichPeriod}
              </label>
              <div className="flex items-center gap-2">
                <Select value={seasonFrom} onValueChange={(v) => { setSeasonFrom(v); if (seasonTo && v > seasonTo) setSeasonTo(v); }}>
                  <SelectTrigger className="flex-1 bg-gray-100 border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-900">
                    <SelectValue placeholder={rt.fromWord} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 text-gray-900">
                    {years.map((y) => (
                      <SelectItem key={y} value={y} className="focus:bg-gray-100 focus:text-gray-900">{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-500 shrink-0">—</span>
                <Select value={seasonTo} onValueChange={setSeasonTo} disabled={!seasonFrom}>
                  <SelectTrigger className="flex-1 bg-gray-100 border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-900">
                    <SelectValue placeholder={rt.toWord} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 text-gray-900">
                    {years.filter((y) => y >= (seasonFrom || "")).map((y) => (
                      <SelectItem key={y} value={y} className="focus:bg-gray-100 focus:text-gray-900">{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500 font-body">
                {stepLabel}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" className="bg-white border-gray-300 text-gray-900 hover:bg-gray-100" onClick={() => setStep(1)}>
                  {rt.backBtn}
                </Button>
                <Button
                  disabled={!relationship || !effectiveClub || !seasonFrom || !seasonTo}
                  onClick={() => {
                    if (!msg.trim()) setMsg(generateTemplate());
                    setStep(3);
                  }}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {rt.continueBtn}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {selectedPerson && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-gray-100 border border-gray-200">
                <div className="h-8 w-8 rounded-full bg-white overflow-hidden flex-shrink-0">
                  {selectedPerson.avatar_url ? (
                    <img src={selectedPerson.avatar_url} alt={selectedPerson.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
                      {(selectedPerson.full_name?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-body text-gray-900 font-medium block">{selectedPerson.full_name}</span>
                  <span className="text-xs text-gray-500 font-body block">{relationshipOptions.find((o) => o.value === relationship)?.label}</span>
                  <span className="text-xs text-gray-500 font-body block">{effectiveClub} · {seasonFrom === seasonTo ? seasonFrom : `${rt.fromWord} ${seasonFrom} ${rt.toWord} ${seasonTo}`}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 font-body">
                {rt.includeCustomMsgLabel}
              </label>
              <Textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder={rt.writeRecForPlaceholder.replace("{name}", selectedPerson?.full_name || "")}
                className="min-h-[120px] bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500 font-body">
                {stepLabel}
              </span>
              <DialogFooter className="flex-row gap-2 sm:justify-end">
                <Button variant="outline" className="bg-white border-gray-300 text-gray-900 hover:bg-gray-100" onClick={() => setStep(2)} disabled={sending}>
                  {rt.backBtn}
                </Button>
                <Button
                  disabled={sending || !msg.trim()}
                  onClick={async () => {
                    if (selectedPerson) {
                      onSubmit(selectedPerson.user_id, msg);
                      return;
                    }
                    // Email path – call edge function
                    if (!isValidEmail(email)) return;
                    setSending(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await supabase.functions.invoke("request-recommendation-by-email", {
                        body: {
                          targetEmail: email,
                          message: msg,
                          relationship,
                          club: effectiveClub,
                          seasonFrom,
                          seasonTo,
                        },
                        headers: { Authorization: `Bearer ${session?.access_token}` },
                      });
                      if (res.error) throw new Error(res.error.message);
                      const result = res.data as { ok: boolean; method: string };
                      toast({
                        title: result.method === "email_invite"
                          ? rt.invitationSentTitle
                          : rt.requestSentInAppTitle,
                        description: result.method === "email_invite"
                          ? `${email} ${rt.invitationSentDescSuffix}`
                          : rt.requestSentInAppDesc,
                      });
                      onOpenChange(false);
                    } catch (err: any) {
                      toast({ title: rt.errorTitle, description: err.message, variant: "destructive" });
                    } finally {
                      setSending(false);
                    }
                  }}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {rt.sendBtn}
                </Button>
              </DialogFooter>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const OfferDialog = ({
  open,
  onOpenChange,
  onSubmit,
  viewerUserId,
  defaultRecipientId,
  defaultRecipientName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (recipientId: string, msg: string) => void;
  viewerUserId: string | null;
  defaultRecipientId?: string;
  defaultRecipientName?: string;
}) => {
  const { t } = useLanguage();
  const rt = t.dashboard.recommendations;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<{ user_id: string; full_name: string; avatar_url: string | null; roleLabel?: string; org?: string; loc?: string; _needsLoc?: boolean }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<{ user_id: string; full_name: string; avatar_url: string | null } | null>(null);
  const [msg, setMsg] = useState("");
  const [calitate, setCalitate] = useState("");
  const [calitateCustom, setCalitateCustom] = useState("");
  const [bazaEvaluarii, setBazaEvaluarii] = useState("");
  const [bazaEvaluariiCustom, setBazaEvaluariiCustom] = useState("");

  const calitateOptions = rt.qualityOptions;
  const bazaEvaluariiOptions = rt.evaluationBasisOptions;

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSearchTerm("");
      setResults([]);
      setSelectedPerson(null);
      setMsg("");
      setCalitate("");
      setCalitateCustom("");
      setBazaEvaluarii("");
      setBazaEvaluariiCustom("");
    }
  }, [open]);

  // If opened from someone else's profile, skip search
  useEffect(() => {
    if (open && defaultRecipientId && defaultRecipientId !== viewerUserId) {
      setSelectedPerson({ user_id: defaultRecipientId, full_name: defaultRecipientName || "", avatar_url: null });
      setStep(2);
    }
  }, [open, defaultRecipientId, viewerUserId, defaultRecipientName]);

  const searchPeople = useCallback(async (term: string) => {
    if (term.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .ilike("full_name", `%${term.trim()}%`)
      .neq("user_id", viewerUserId || "")
      .limit(12);

    if (!data || data.length === 0) { setResults([]); setSearching(false); return; }

    const userIds = data.map((p) => p.user_id);
    const [rolesRes, playerRes, scoutRes] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      supabase.from("player_profiles").select("user_id, current_team, nationality").in("user_id", userIds),
      supabase.from("scout_profiles").select("user_id, organization, country").in("user_id", userIds),
    ]);

    const rolesMap = new Map<string, string>();
    (rolesRes.data || []).forEach((r: any) => { if (r.role !== "admin") rolesMap.set(r.user_id, r.role); });
    const playerMap = new Map<string, { team?: string; nationality?: string }>();
    (playerRes.data || []).forEach((p: any) => playerMap.set(p.user_id, { team: p.current_team, nationality: p.nationality }));
    const scoutMap = new Map<string, { org?: string; country?: string }>();
    (scoutRes.data || []).forEach((s: any) => scoutMap.set(s.user_id, { org: s.organization, country: s.country }));

    const roleLabels = rt.roleLabels as Record<string, string>;
    const enriched = data.map((p) => {
      const role = rolesMap.get(p.user_id);
      const roleLabel = role ? roleLabels[role] || role : undefined;
      const org = role === "player" ? playerMap.get(p.user_id)?.team : scoutMap.get(p.user_id)?.org;
      const loc = role === "player" ? playerMap.get(p.user_id)?.nationality : scoutMap.get(p.user_id)?.country;
      return { ...p, roleLabel, org, loc, _needsLoc: false };
    });

    const nameGroups = new Map<string, typeof enriched>();
    enriched.forEach((p) => { const key = p.full_name?.toLowerCase() || ""; if (!nameGroups.has(key)) nameGroups.set(key, []); nameGroups.get(key)!.push(p); });
    enriched.forEach((p) => { const group = nameGroups.get(p.full_name?.toLowerCase() || "") || []; p._needsLoc = group.length > 1 && group.filter((g) => g.roleLabel === p.roleLabel && g.org === p.org).length > 1; });

    setResults(enriched);
    setSearching(false);
  }, [viewerUserId, rt]);

  useEffect(() => {
    const timer = setTimeout(() => searchPeople(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, searchPeople]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white text-gray-900 border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900 font-display tracking-wide">{rt.offerDialogTitle}</DialogTitle>
        {step === 1 && (
          <DialogDescription className="text-gray-500">{rt.searchPersonToRecommend}</DialogDescription>
          )}
          {step === 2 && selectedPerson && (
            <DialogDescription className="text-gray-500">
              {rt.selectQualityForPrefix} {selectedPerson.full_name}
            </DialogDescription>
          )}
          {step === 3 && selectedPerson && (
            <DialogDescription className="text-gray-500">
              {rt.writeRecForPrefix} {selectedPerson.full_name}. {rt.willAppearAfterApproval}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900 font-body mb-1">
                {rt.whoToRecommend}
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setSelectedPerson(null); }}
                  placeholder={rt.searchPeoplePlaceholder}
                  className="pl-9 bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900"
                />
              </div>

              {searchTerm.trim().length >= 2 && (
                <div className="mt-2 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  ) : results.length > 0 ? (
                    results.map((p) => (
                      <button
                        key={p.user_id}
                        onClick={() => { setSelectedPerson(p); setSearchTerm(p.full_name); setResults([]); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 text-left transition-colors",
                          selectedPerson?.user_id === p.user_id && "bg-gray-100"
                        )}
                      >
                        <div className="h-8 w-8 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt={p.full_name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
                              {(p.full_name?.[0] || "?").toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-body text-gray-900 block truncate">{p.full_name}</span>
                          {(p.roleLabel || p.org) && (
                            <span className="text-xs text-gray-500 font-body block truncate">
                              {[p.roleLabel, p.org, p._needsLoc ? p.loc : null].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 py-3 px-3 font-body">{rt.noResultsFound}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500 font-body">
                {selectedPerson ? rt.personSelectedCount : ""}
              </span>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white" disabled={!selectedPerson} onClick={() => setStep(2)}>
                {rt.continueBtn}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {selectedPerson && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-gray-100 border border-gray-200">
                <div className="h-8 w-8 rounded-full bg-white overflow-hidden flex-shrink-0">
                  {selectedPerson.avatar_url ? (
                    <img src={selectedPerson.avatar_url} alt={selectedPerson.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
                      {(selectedPerson.full_name?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-sm font-body text-gray-900 font-medium">{selectedPerson.full_name}</span>
                <button
                  onClick={() => { setSelectedPerson(null); setStep(1); setSearchTerm(""); }}
                  className="ml-auto text-gray-500 hover:text-gray-900"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 font-body">
                {rt.offerAsQuality}
              </label>
              <Select value={calitate} onValueChange={(v) => { setCalitate(v); if (v !== "altele") setCalitateCustom(""); }}>
                <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-900">
                  <SelectValue placeholder={rt.selectQuality} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-gray-900">
                  {calitateOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="focus:bg-gray-100 focus:text-gray-900">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {calitate === "altele" && (
                <Input
                  value={calitateCustom}
                  onChange={(e) => setCalitateCustom(e.target.value)}
                  placeholder={rt.qualityCustomPlaceholder}
                  className="mt-2 bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900"
                />
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 font-body">
                {rt.evaluationBasis}
              </label>
              <Select value={bazaEvaluarii} onValueChange={(v) => { setBazaEvaluarii(v); if (v !== "altele") setBazaEvaluariiCustom(""); }}>
                <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900 focus:ring-1 focus:ring-gray-900">
                  <SelectValue placeholder={rt.selectEvaluationBasis} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-gray-900">
                  {bazaEvaluariiOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="focus:bg-gray-100 focus:text-gray-900">
                      <div className="flex flex-col">
                        <span>{opt.label}</span>
                        <span className="text-xs text-gray-500">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bazaEvaluarii === "altele" && (
                <Input
                  value={bazaEvaluariiCustom}
                  onChange={(e) => setBazaEvaluariiCustom(e.target.value)}
                  placeholder={rt.evaluationBasisCustomPlaceholder}
                  className="mt-2 bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900"
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500 font-body">{rt.stepWord} 2 {rt.ofWord} 3</span>
              <div className="flex gap-2">
                <Button variant="outline" className="bg-white border-gray-300 text-gray-900 hover:bg-gray-100" onClick={() => setStep(1)}>{rt.backBtn}</Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={!calitate || (calitate === "altele" && !calitateCustom.trim()) || !bazaEvaluarii || (bazaEvaluarii === "altele" && !bazaEvaluariiCustom.trim())}
                  onClick={() => setStep(3)}
                >
                  {rt.continueBtn}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {selectedPerson && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-gray-100 border border-gray-200">
                <div className="h-8 w-8 rounded-full bg-white overflow-hidden flex-shrink-0">
                  {selectedPerson.avatar_url ? (
                    <img src={selectedPerson.avatar_url} alt={selectedPerson.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
                      {(selectedPerson.full_name?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-body text-gray-900 font-medium block">{selectedPerson.full_name}</span>
                  <span className="text-xs text-gray-500 font-body block truncate">
                    {calitate === "altele" ? calitateCustom : calitateOptions.find((o) => o.value === calitate)?.label}
                  </span>
                </div>
              </div>
            )}
            <Textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder={rt.recWritePlaceholder}
              className="min-h-[160px] bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900"
            />
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500 font-body">{rt.stepWord} 3 {rt.ofWord} 3</span>
              <DialogFooter className="flex-row gap-2 sm:justify-end">
                <Button variant="outline" className="bg-white border-gray-300 text-gray-900 hover:bg-gray-100" onClick={() => setStep(2)}>{rt.backBtn}</Button>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => {
                  if (selectedPerson) onSubmit(selectedPerson.user_id, msg);
                }}>
                  {rt.sendRecommendation}
                </Button>
              </DialogFooter>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const RespondDialog = ({
  open,
  onOpenChange,
  requesterName,
  requestMsg,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requesterName: string;
  requestMsg: string;
  onSubmit: (content: string) => void;
}) => {
  const { t } = useLanguage();
  const rt = t.dashboard.recommendations;
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open) setContent("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white text-gray-900 border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900 font-display tracking-wide">{rt.respondDialogTitle}</DialogTitle>
          {requesterName && (
            <DialogDescription className="text-gray-500">
              {requesterName} {rt.requestedYouRecSuffix}
            </DialogDescription>
          )}
        </DialogHeader>

        {requestMsg && (
          <div className="p-3 rounded-md bg-gray-100 border border-gray-200 text-sm font-body text-gray-700 italic">
            „{requestMsg}"
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900 font-body">
            {rt.yourRecommendationLabel}
          </label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`${rt.respondPlaceholderPrefix} ${requesterName || rt.thisPersonFallback}...`}
            className="min-h-[160px] bg-gray-100 border-gray-300 text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" className="bg-white border-gray-300 text-gray-900 hover:bg-gray-100" onClick={() => onOpenChange(false)}>
            {rt.cancelRequest}
          </Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" disabled={!content.trim()} onClick={() => onSubmit(content)}>
            <Check className="h-4 w-4 mr-1" /> {rt.sendRecommendation}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecommendationsSection;
