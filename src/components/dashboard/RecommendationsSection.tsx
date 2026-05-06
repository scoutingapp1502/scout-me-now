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

interface PersonInfo {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Props {
  /** Profilul vizitat (recipient) */
  profileUserId: string;
  /** Vizitatorul autentificat */
  viewerUserId: string | null;
  /** True dacă vizitatorul este chiar proprietarul profilului */
  isOwner: boolean;
}

const RecommendationsSection = ({ profileUserId, viewerUserId, isOwner }: Props) => {
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [people, setPeople] = useState<Record<string, PersonInfo>>({});
  const [canConnect, setCanConnect] = useState(false); // viewer ↔ profile sunt conectați
  const [tab, setTab] = useState<"primite" | "oferite" | "asteptare">("primite");

  // Dialog state
  const [askOpen, setAskOpen] = useState(false);
  const [giveOpen, setGiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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

      // Fetch people info
      const ids = new Set<string>();
      list.forEach((r) => {
        ids.add(r.author_user_id);
        ids.add(r.recipient_user_id);
      });
      ids.delete("");
      if (ids.size > 0) {
        const { data: profilesRows } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", Array.from(ids));
        const map: Record<string, PersonInfo> = {};
        (profilesRows || []).forEach((p: any) => {
          map[p.user_id] = {
            user_id: p.user_id,
            full_name: p.full_name || "Utilizator",
            avatar_url: p.avatar_url,
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
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
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
  // Pentru owner editor:
  const ownerPrimite = useMemo(
    () => recs.filter((r) => r.recipient_user_id === profileUserId && (r.status === "submitted" || r.status === "accepted")),
    [recs, profileUserId]
  );
  const ownerOferite = useMemo(
    () => recs.filter((r) => r.author_user_id === profileUserId),
    [recs, profileUserId]
  );
  const ownerAsteptare = useMemo(
    () =>
      recs.filter(
        (r) =>
          (r.recipient_user_id === profileUserId && r.status === "pending") ||
          (r.author_user_id === profileUserId && r.status === "submitted")
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
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cerere trimisă", description: "Persoana va putea răspunde cu o recomandare." });
    setAskOpen(false);
    fetchAll();
  };

  const offerRecommendation = async (content: string) => {
    if (!viewerUserId || viewerUserId === profileUserId) return;
    if (!content.trim()) {
      toast({ title: "Scrie mai întâi recomandarea", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("recommendations").insert({
      recipient_user_id: profileUserId,
      author_user_id: viewerUserId,
      content: content.trim(),
      status: "submitted",
      initiated_by: "offer",
    });
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Recomandare trimisă",
      description: "Va apărea pe profil după ce este aprobată.",
    });
    setGiveOpen(false);
    fetchAll();
  };

  const updateStatus = async (id: string, status: RecStatus) => {
    const { error } = await supabase.from("recommendations").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  const removeRec = async (id: string) => {
    const { error } = await supabase.from("recommendations").delete().eq("id", id);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  const toggleEnabled = async (next: boolean) => {
    if (!isOwner) return;
    setEnabled(next);
    const { error } = await supabase
      .from("recommendations_settings")
      .upsert({ user_id: profileUserId, enabled: next }, { onConflict: "user_id" });
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      setEnabled(!next);
    }
  };

  // Dacă secțiunea e dezactivată și nu suntem proprietari -> ascunde complet
  if (!isOwner && !enabled) return null;

  const PersonRow = ({ userId, date }: { userId: string; date?: string }) => {
    const p = people[userId];
    return (
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
          {p?.avatar_url ? (
            <img src={p.avatar_url} alt={p.full_name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
              {(p?.full_name?.[0] || "?").toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-body font-semibold text-foreground text-sm truncate">
            {p?.full_name || "Utilizator"}
          </p>
          {date && (
            <p className="text-xs text-muted-foreground font-body">
              {new Date(date).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="font-display text-2xl text-foreground">Recomandări</h2>

        <div className="flex items-center gap-2">
          {/* + buton pentru vizitatori conectați sau owner */}
          {((!isOwner && viewerUserId && canConnect) || isOwner) && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-accent/50"
                  aria-label="Recomandare"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2 bg-card">
                <button
                  className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent/50 text-left"
                  onClick={() => setAskOpen(true)}
                >
                  <Quote className="h-5 w-5 text-primary" />
                  <span className="text-sm font-body text-foreground">Solicitați o recomandare</span>
                </button>
                <button
                  className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent/50 text-left"
                  onClick={() => setGiveOpen(true)}
                >
                  <PenSquare className="h-5 w-5 text-primary" />
                  <span className="text-sm font-body text-foreground">Oferiți o recomandare</span>
                </button>
              </PopoverContent>
            </Popover>
          )}

          {/* Creion = manager pentru proprietar */}
          {isOwner && (
            <button
              onClick={() => setEditOpen(true)}
              className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-accent/50"
              aria-label="Gestionează recomandările"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {isOwner && !enabled && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-md bg-muted text-muted-foreground text-sm">
          <EyeOff className="h-4 w-4" />
          <span className="font-body">
            Secțiunea „Recomandări” este ascunsă vizitatorilor. Doar tu o vezi aici.
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : accepted.length === 0 ? (
        <p className="text-muted-foreground italic text-sm font-body">
          {isOwner
            ? "Nu ai încă recomandări publicate. Cere sau primește una de la o conexiune."
            : "Nicio recomandare încă."}
        </p>
      ) : (
        <div className="space-y-5">
          {accepted.map((r) => (
            <div key={r.id} className="border-b border-border last:border-b-0 pb-4 last:pb-0">
              <PersonRow userId={r.author_user_id} date={r.updated_at} />
              <p className="text-foreground/80 font-body text-sm whitespace-pre-line mt-3">
                {r.content}
              </p>
            </div>
          ))}
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
      />

      {/* ========= DIALOG: OFERĂ ========= */}
      <OfferDialog
        open={giveOpen}
        onOpenChange={setGiveOpen}
        recipientName={people[profileUserId]?.full_name || ""}
        onSubmit={offerRecommendation}
      />

      {/* ========= DIALOG: GESTIONEAZĂ (owner) ========= */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recomandări</DialogTitle>
            <DialogDescription>
              Gestionează recomandările tale și vizibilitatea secțiunii.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between p-3 rounded-md border border-border">
            <div>
              <p className="text-sm font-semibold text-foreground font-body">
                Afișează secțiunea pe profil
              </p>
              <p className="text-xs text-muted-foreground font-body">
                Dacă o dezactivezi, secțiunea nu va mai fi vizibilă vizitatorilor.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleEnabled} />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-border">
            {([
              ["primite", `Primite (${ownerPrimite.length})`],
              ["oferite", `Oferite (${ownerOferite.length})`],
              ["asteptare", `În așteptare (${ownerAsteptare.length})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "px-3 py-2 text-sm font-body transition-colors border-b-2",
                  tab === key
                    ? "border-primary text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Lista per tab */}
          <div className="space-y-3 mt-2">
            {tab === "primite" &&
              (ownerPrimite.length === 0 ? (
                <p className="text-muted-foreground italic text-sm font-body py-4 text-center">
                  Nicio recomandare primită.
                </p>
              ) : (
                ownerPrimite.map((r) => (
                  <div key={r.id} className="border border-border rounded-md p-3">
                    <div className="flex items-start justify-between gap-2">
                      <PersonRow userId={r.author_user_id} date={r.updated_at} />
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded font-body",
                          r.status === "accepted"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {r.status === "accepted" ? "Publică" : "În așteptare"}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 mt-2 whitespace-pre-line font-body">
                      {r.content}
                    </p>
                    <div className="flex gap-2 mt-3 justify-end">
                      {r.status === "submitted" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "rejected")}>
                            <XIcon className="h-4 w-4 mr-1" /> Refuză
                          </Button>
                          <Button size="sm" onClick={() => updateStatus(r.id, "accepted")}>
                            <Check className="h-4 w-4 mr-1" /> Aprobă
                          </Button>
                        </>
                      )}
                      {r.status === "accepted" && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "submitted")}>
                          <EyeOff className="h-4 w-4 mr-1" /> Ascunde
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => removeRec(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ))}

            {tab === "oferite" &&
              (ownerOferite.length === 0 ? (
                <p className="text-muted-foreground italic text-sm font-body py-4 text-center">
                  Nu ai oferit încă nicio recomandare.
                </p>
              ) : (
                ownerOferite.map((r) => (
                  <div key={r.id} className="border border-border rounded-md p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground font-body">Pentru</p>
                        <PersonRow userId={r.recipient_user_id} date={r.updated_at} />
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-body capitalize">
                        {r.status === "accepted"
                          ? "Aprobată"
                          : r.status === "rejected"
                          ? "Refuzată"
                          : r.status === "pending"
                          ? "De scris"
                          : "În așteptare"}
                      </span>
                    </div>
                    {r.content && (
                      <p className="text-sm text-foreground/80 mt-2 whitespace-pre-line font-body">
                        {r.content}
                      </p>
                    )}
                    <div className="flex justify-end mt-2">
                      <Button size="sm" variant="ghost" onClick={() => removeRec(r.id)}>
                        <Trash2 className="h-4 w-4 mr-1" /> Retrage
                      </Button>
                    </div>
                  </div>
                ))
              ))}

            {tab === "asteptare" &&
              (ownerAsteptare.length === 0 ? (
                <p className="text-muted-foreground italic text-sm font-body py-4 text-center">
                  Nicio cerere în așteptare.
                </p>
              ) : (
                ownerAsteptare.map((r) => {
                  const iAmRecipient = r.recipient_user_id === profileUserId;
                  return (
                    <div key={r.id} className="border border-border rounded-md p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground font-body">
                            {iAmRecipient ? "Aștepți răspunsul de la" : "Așteaptă aprobarea ta de la"}
                          </p>
                          <PersonRow
                            userId={iAmRecipient ? r.author_user_id : r.recipient_user_id}
                            date={r.updated_at}
                          />
                        </div>
                      </div>
                      {r.content && (
                        <p className="text-sm text-foreground/80 mt-2 whitespace-pre-line font-body">
                          {r.content}
                        </p>
                      )}
                      <div className="flex justify-end mt-2">
                        <Button size="sm" variant="ghost" onClick={() => removeRec(r.id)}>
                          <Trash2 className="h-4 w-4 mr-1" /> Anulează
                        </Button>
                      </div>
                    </div>
                  );
                })
              ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Închide
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipientName: string;
  onSubmit: (authorUserId: string, msg: string) => void;
  viewerUserId: string | null;
  defaultAuthorId?: string;
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<{ user_id: string; full_name: string; avatar_url: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<{ user_id: string; full_name: string; avatar_url: string | null } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSearchTerm("");
      setEmail("");
      setResults([]);
      setSelectedPerson(null);
      setMsg("");
    }
  }, [open]);

  // If opened from someone else's profile, skip step 1
  useEffect(() => {
    if (open && defaultAuthorId && defaultAuthorId !== viewerUserId) {
      setSelectedPerson({ user_id: defaultAuthorId, full_name: recipientName, avatar_url: null });
      setStep(2);
    }
  }, [open, defaultAuthorId, viewerUserId, recipientName]);

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

    const roleLabels: Record<string, string> = { player: "Jucător", scout: "Scouter", agent: "Agent", club_rep: "Reprezentant Club" };

    const enriched = data.map((p) => {
      const role = rolesMap.get(p.user_id);
      const roleLabel = role ? roleLabels[role] || role : undefined;
      const org = role === "player" ? playerMap.get(p.user_id)?.team : scoutMap.get(p.user_id)?.org;
      const loc = role === "player" ? playerMap.get(p.user_id)?.nationality : scoutMap.get(p.user_id)?.country;
      return { ...p, roleLabel, org, loc, _needsLoc: false };
    });

    // Check for duplicates needing extra disambiguation
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
  }, [viewerUserId]);

  useEffect(() => {
    const timer = setTimeout(() => searchPeople(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, searchPeople]);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitați o recomandare</DialogTitle>
          {step === 1 && (
            <DialogDescription>
              Ajutați-ne să vă personalizăm solicitarea
            </DialogDescription>
          )}
          {step === 2 && selectedPerson && (
            <DialogDescription>
              Trimite o solicitare către {selectedPerson.full_name}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground font-body mb-1">
                Pe cine doriți să întrebați?
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedPerson(null);
                  }}
                  placeholder="Căutați persoane..."
                  className="pl-9"
                />
              </div>

              {/* Search results */}
              {searchTerm.trim().length >= 2 && (
                <div className="mt-2 border border-border rounded-md max-h-48 overflow-y-auto">
                  {searching ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                          "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 text-left transition-colors",
                          selectedPerson?.user_id === p.user_id && "bg-accent/30"
                        )}
                      >
                        <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt={p.full_name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                              {(p.full_name?.[0] || "?").toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-body text-foreground block truncate">{p.full_name}</span>
                          {(p.roleLabel || p.org) && (
                            <span className="text-xs text-muted-foreground font-body block truncate">
                              {[p.roleLabel, p.org, p._needsLoc ? p.loc : null].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground py-3 px-3 font-body">
                      Niciun rezultat găsit
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Email fallback */}
            {!selectedPerson && searchTerm.trim().length >= 2 && results.length === 0 && !searching && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-body">sau introduceți adresa de email</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplu.com"
                    className="pl-9"
                    type="email"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground font-body">
                {selectedPerson ? "1 persoană selectată" : ""}
              </span>
              <Button
                disabled={!selectedPerson && !isValidEmail(email)}
                onClick={() => setStep(2)}
              >
                Continuați
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {selectedPerson && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-accent/20 border border-border">
                <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                  {selectedPerson.avatar_url ? (
                    <img src={selectedPerson.avatar_url} alt={selectedPerson.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                      {(selectedPerson.full_name?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-sm font-body text-foreground font-medium">{selectedPerson.full_name}</span>
                <button
                  onClick={() => { setSelectedPerson(null); setStep(1); setSearchTerm(""); }}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            )}
            <Textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Mesaj opțional (ex: Salut! Mi-ar plăcea o recomandare despre colaborarea noastră.)"
              className="min-h-[120px]"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>
                Înapoi
              </Button>
              <Button onClick={() => {
                if (selectedPerson) {
                  onSubmit(selectedPerson.user_id, msg);
                }
                // TODO: email invite flow could be added later
              }}>
                Trimite cererea
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const OfferDialog = ({
  open,
  onOpenChange,
  recipientName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipientName: string;
  onSubmit: (msg: string) => void;
}) => {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!open) setMsg("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Oferiți o recomandare</DialogTitle>
          <DialogDescription>
            Scrie o recomandare pentru {recipientName || "această persoană"}. Va apărea pe profil după ce este aprobată.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Scrie aici recomandarea ta..."
          className="min-h-[160px]"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anulează
          </Button>
          <Button onClick={() => onSubmit(msg)}>Trimite recomandarea</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecommendationsSection;
