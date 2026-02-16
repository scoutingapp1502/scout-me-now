import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, MapPin, Calendar, Ruler, Weight, Star, Trophy, Youtube, Instagram, Twitter, Edit2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type PlayerProfile = Tables<"player_profiles">;

interface PersonalProfileProps {
  userId: string;
}

const positions = [
  "Portar", "Fundaș Central", "Fundaș Dreapta", "Fundaș Stânga",
  "Mijlocaș Defensiv", "Mijlocaș Central", "Mijlocaș Ofensiv",
  "Extremă Dreapta", "Extremă Stânga", "Atacant", "Atacant Fals"
];

const PersonalProfile = ({ userId }: PersonalProfileProps) => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<PlayerProfile>>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("player_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

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

      const { error } = await supabase
        .from("player_profiles")
        .update({
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
        })
        .eq("user_id", userId);

      if (error) throw error;

      toast({ title: "Profil actualizat cu succes!" });
      setEditing(false);
      setAvatarFile(null);
      fetchProfile();
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const age = form.date_of_birth
    ? Math.floor((Date.now() - new Date(form.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground font-body">Se încarcă...</div>;
  }

  const photoSrc = avatarPreview || profile?.photo_url;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header / Hero */}
      <div className="relative bg-gradient-to-r from-pitch to-sidebar rounded-xl overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)`,
          backgroundSize: '30px 30px'
        }} />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 p-4 sm:p-8">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-28 h-28 rounded-xl border-2 border-primary overflow-hidden bg-muted">
              {photoSrc ? (
                <img src={photoSrc} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Camera className="h-8 w-8" />
                </div>
              )}
            </div>
            {editing && (
              <label className="absolute inset-0 flex items-center justify-center bg-pitch/60 rounded-xl cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-primary" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            )}
          </div>

          {/* Name & basic info */}
          <div className="flex-1 pb-2 text-center sm:text-left w-full">
            {editing ? (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-2">
                <Input value={form.first_name || ""} onChange={(e) => updateForm("first_name", e.target.value)} placeholder="Prenume" className="bg-sidebar-accent border-sidebar-border text-foreground font-display text-xl sm:text-2xl h-auto py-1" />
                <Input value={form.last_name || ""} onChange={(e) => updateForm("last_name", e.target.value)} placeholder="Nume" className="bg-sidebar-accent border-sidebar-border text-foreground font-display text-xl sm:text-2xl h-auto py-1" />
              </div>
            ) : (
              <h1 className="font-display text-2xl sm:text-4xl text-primary-foreground tracking-wide">
                {profile?.first_name} {profile?.last_name}
              </h1>
            )}
            <div className="flex items-center justify-center sm:justify-start gap-3 sm:gap-4 text-primary-foreground/70 text-xs sm:text-sm font-body mt-1 flex-wrap">
              {form.position && (
                <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-semibold">
                  ⊕ {form.position}
                </span>
              )}
              {form.nationality && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{form.nationality}</span>}
              {age && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{age} ani</span>}
            </div>
          </div>

          {/* Edit button */}
          <Button
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
            className={editing ? "bg-primary hover:bg-primary/90" : "bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-foreground"}
          >
            {editing ? (
              <><Save className="h-4 w-4 mr-2" />{saving ? "Salvare..." : "Salvează"}</>
            ) : (
              <><Edit2 className="h-4 w-4 mr-2" />Editează</>
            )}
          </Button>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Despre mine */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-xl">DESPRE MINE</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <Textarea value={form.bio || ""} onChange={(e) => updateForm("bio", e.target.value)} placeholder="Descrie-te ca jucător..." rows={4} />
              ) : (
                <p className="text-muted-foreground font-body text-sm leading-relaxed">{profile?.bio || "Nicio descriere adăugată."}</p>
              )}
              {!editing && form.position && (
                <div className="flex gap-2 mt-4 flex-wrap">
                  <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-body">{form.position}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistici */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-xl">STATISTICI</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><Label className="font-body text-xs">Goluri</Label><Input type="number" value={form.goals ?? 0} onChange={(e) => updateForm("goals", parseInt(e.target.value) || 0)} /></div>
                  <div><Label className="font-body text-xs">Assisturi</Label><Input type="number" value={form.assists ?? 0} onChange={(e) => updateForm("assists", parseInt(e.target.value) || 0)} /></div>
                  <div><Label className="font-body text-xs">Meciuri jucate</Label><Input type="number" value={form.matches_played ?? 0} onChange={(e) => updateForm("matches_played", parseInt(e.target.value) || 0)} /></div>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4">
                  {[
                    { label: "Goluri", value: profile?.goals ?? 0, icon: "⚽" },
                    { label: "Assisturi", value: profile?.assists ?? 0, icon: "🅰️" },
                    { label: "Meciuri", value: profile?.matches_played ?? 0, icon: "🏟️" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-muted rounded-lg p-4 text-center">
                      <span className="text-2xl">{stat.icon}</span>
                      <p className="font-display text-3xl text-foreground mt-1">{stat.value}</p>
                      <p className="text-xs text-muted-foreground font-body">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Palmares */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-xl flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />PALMARES</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <Textarea value={form.palmares || ""} onChange={(e) => updateForm("palmares", e.target.value)} placeholder="Trofee, realizări..." rows={3} />
              ) : (
                <p className="text-muted-foreground font-body text-sm">{profile?.palmares || "Niciun trofeu adăugat."}</p>
              )}
            </CardContent>
          </Card>

          {/* Video Highlights */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-xl flex items-center gap-2"><Youtube className="h-5 w-5 text-primary" />VIDEO HIGHLIGHTS</CardTitle></CardHeader>
            <CardContent>
              {profile?.video_highlights && profile.video_highlights.length > 0 ? (
                <div className="space-y-3">
                  {profile.video_highlights.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Youtube className="h-5 w-5 text-primary" /></div>
                      <span className="font-body text-sm text-foreground truncate">{url}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground font-body text-sm">Niciun video adăugat.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - 1/3 */}
        <div className="space-y-6">
          {/* Date fizice */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-xl">DATE FIZICE</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div><Label className="font-body text-xs">Înălțime (cm)</Label><Input type="number" value={form.height_cm ?? ""} onChange={(e) => updateForm("height_cm", parseInt(e.target.value) || null)} /></div>
                  <div><Label className="font-body text-xs">Greutate (kg)</Label><Input type="number" value={form.weight_kg ?? ""} onChange={(e) => updateForm("weight_kg", parseInt(e.target.value) || null)} /></div>
                  <div>
                    <Label className="font-body text-xs">Picior preferat</Label>
                    <Select value={form.preferred_foot || ""} onValueChange={(v) => updateForm("preferred_foot", v)}>
                      <SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Drept">Drept</SelectItem>
                        <SelectItem value="Stâng">Stâng</SelectItem>
                        <SelectItem value="Ambele">Ambele</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="font-body text-xs">Data nașterii</Label><Input type="date" value={form.date_of_birth || ""} onChange={(e) => updateForm("date_of_birth", e.target.value)} /></div>
                  <div><Label className="font-body text-xs">Naționalitate</Label><Input value={form.nationality || ""} onChange={(e) => updateForm("nationality", e.target.value)} /></div>
                  <div>
                    <Label className="font-body text-xs">Poziție</Label>
                    <Select value={form.position || ""} onValueChange={(v) => updateForm("position", v)}>
                      <SelectTrigger><SelectValue placeholder="Selectează poziția" /></SelectTrigger>
                      <SelectContent>
                        {positions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground font-body text-sm"><Ruler className="h-4 w-4" />Înălțime</span><span className="font-semibold text-foreground font-body">{profile?.height_cm ? `${(profile.height_cm / 100).toFixed(2)}m` : "—"}</span></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground font-body text-sm"><Weight className="h-4 w-4" />Greutate</span><span className="font-semibold text-foreground font-body">{profile?.weight_kg ? `${profile.weight_kg}kg` : "—"}</span></div>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground font-body text-sm"><Star className="h-4 w-4" />Picior Preferat</span><span className="font-semibold text-foreground font-body">{profile?.preferred_foot || "—"}</span></div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Club actual */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-xl">CLUB ACTUAL</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <Input value={form.current_team || ""} onChange={(e) => updateForm("current_team", e.target.value)} placeholder="Numele clubului" />
              ) : (
                <p className="font-semibold text-foreground font-body">{profile?.current_team || "Fără club"}</p>
              )}
            </CardContent>
          </Card>

          {/* Social media */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-xl">SOCIAL MEDIA</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <>
                  <div><Label className="font-body text-xs flex items-center gap-1"><Instagram className="h-3 w-3" />Instagram</Label><Input value={form.instagram_url || ""} onChange={(e) => updateForm("instagram_url", e.target.value)} placeholder="URL Instagram" /></div>
                  <div><Label className="font-body text-xs flex items-center gap-1"><Twitter className="h-3 w-3" />Twitter/X</Label><Input value={form.twitter_url || ""} onChange={(e) => updateForm("twitter_url", e.target.value)} placeholder="URL Twitter" /></div>
                  <div><Label className="font-body text-xs">TikTok</Label><Input value={form.tiktok_url || ""} onChange={(e) => updateForm("tiktok_url", e.target.value)} placeholder="URL TikTok" /></div>
                </>
              ) : (
                <div className="space-y-2">
                  {profile?.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline font-body"><Instagram className="h-4 w-4" />Instagram</a>}
                  {profile?.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline font-body"><Twitter className="h-4 w-4" />Twitter/X</a>}
                  {profile?.tiktok_url && <a href={profile.tiktok_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline font-body">TikTok</a>}
                  {!profile?.instagram_url && !profile?.twitter_url && !profile?.tiktok_url && <p className="text-muted-foreground text-sm font-body">Niciun link adăugat.</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact agent */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display text-xl">CONTACT AGENT</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <>
                  <div><Label className="font-body text-xs">Nume agent</Label><Input value={form.agent_name || ""} onChange={(e) => updateForm("agent_name", e.target.value)} placeholder="Nume agent" /></div>
                  <div><Label className="font-body text-xs">Email agent</Label><Input value={form.agent_email || ""} onChange={(e) => updateForm("agent_email", e.target.value)} placeholder="Email" /></div>
                  <div><Label className="font-body text-xs">Telefon agent</Label><Input value={form.agent_phone || ""} onChange={(e) => updateForm("agent_phone", e.target.value)} placeholder="Telefon" /></div>
                </>
              ) : (
                <>
                  {profile?.agent_name ? (
                    <div className="space-y-1 font-body text-sm">
                      <p className="font-semibold text-foreground">{profile.agent_name}</p>
                      {profile.agent_email && <p className="text-muted-foreground">{profile.agent_email}</p>}
                      {profile.agent_phone && <p className="text-muted-foreground">{profile.agent_phone}</p>}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm font-body">Niciun agent adăugat.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PersonalProfile;
