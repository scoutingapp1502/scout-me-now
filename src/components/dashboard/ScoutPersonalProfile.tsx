import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, Edit2, MapPin, Building2, Plus, Trash2, Loader2, Briefcase, Award } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type ScoutProfile = Tables<"scout_profiles">;
type ScoutExperience = Tables<"scout_experiences">;

interface ScoutPersonalProfileProps {
  userId: string;
  readOnly?: boolean;
}

const ScoutPersonalProfile = ({ userId, readOnly = false }: ScoutPersonalProfileProps) => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<ScoutProfile | null>(null);
  const [experiences, setExperiences] = useState<ScoutExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ScoutProfile>>({});
  const [expForms, setExpForms] = useState<Partial<ScoutExperience>[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    const [profileRes, expRes] = await Promise.all([
      supabase.from("scout_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("scout_experiences").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
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
    setLoading(false);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      let photoUrl = form.photo_url;
      let coverUrl = form.cover_photo_url;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${userId}/scout-avatar.${ext}`;
        await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `${userId}/scout-cover.${ext}`;
        await supabase.storage.from("avatars").upload(path, coverFile, { upsert: true });
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        coverUrl = urlData.publicUrl;
      }

      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        title: form.title,
        organization: form.organization,
        country: form.country,
        bio: form.bio,
        skills: form.skills,
        photo_url: photoUrl,
        cover_photo_url: coverUrl,
      };

      const { error } = await supabase.from("scout_profiles").update(payload).eq("user_id", userId);
      if (error) throw error;

      // Save experiences
      // Delete removed ones
      const existingIds = experiences.map(e => e.id);
      const keptIds = expForms.filter(e => e.id).map(e => e.id!);
      const removedIds = existingIds.filter(id => !keptIds.includes(id));
      if (removedIds.length > 0) {
        await supabase.from("scout_experiences").delete().in("id", removedIds);
      }

      // Upsert experiences
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
          await supabase.from("scout_experiences").update(expPayload).eq("id", exp.id);
        } else {
          await supabase.from("scout_experiences").insert(expPayload);
        }
      }

      toast({ title: "Profil actualizat cu succes!" });
      setEditing(false);
      setAvatarFile(null);
      setCoverFile(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const photoSrc = avatarPreview || profile?.photo_url;
  const coverSrc = coverPreview || profile?.cover_photo_url;
  const skillsArray = form.skills || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ===== HEADER CARD (LinkedIn-style) ===== */}
      <div className="bg-card rounded-xl overflow-hidden border border-border">
        {/* Cover Photo */}
        <div className="relative h-40 sm:h-52 bg-gradient-to-r from-primary/30 via-primary/10 to-sidebar overflow-hidden">
          {coverSrc && <img src={coverSrc} alt="Cover" className="w-full h-full object-cover" />}
          {!coverSrc && (
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)`,
              backgroundSize: '30px 30px'
            }} />
          )}
          {editing && (
            <label className="absolute top-3 right-3 bg-background/80 rounded-lg p-2 cursor-pointer hover:bg-background transition-colors">
              <Camera className="h-5 w-5 text-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
            </label>
          )}
        </div>

        {/* Profile Info Section */}
        <div className="relative px-6 pb-6">
          {/* Avatar - overlapping cover */}
          <div className="relative -mt-16 sm:-mt-20 mb-4">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-card overflow-hidden bg-muted shadow-lg">
              {photoSrc ? (
                <img src={photoSrc} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Camera className="h-10 w-10" />
                </div>
              )}
            </div>
            {editing && (
              <label className="absolute bottom-1 left-20 sm:left-24 bg-primary rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors shadow-md">
                <Camera className="h-4 w-4 text-primary-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            )}
          </div>

          {/* Name & Title */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              {editing ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input value={form.first_name || ""} onChange={e => updateForm("first_name", e.target.value)} placeholder="Prenume" className="bg-muted border-border text-foreground font-display text-xl h-auto py-1" />
                    <Input value={form.last_name || ""} onChange={e => updateForm("last_name", e.target.value)} placeholder="Nume" className="bg-muted border-border text-foreground font-display text-xl h-auto py-1" />
                  </div>
                  <Input value={form.title || ""} onChange={e => updateForm("title", e.target.value)} placeholder="Titlu (ex: First team scout)" className="bg-muted border-border text-foreground text-sm" />
                  <Input value={form.organization || ""} onChange={e => updateForm("organization", e.target.value)} placeholder="Organizație" className="bg-muted border-border text-foreground text-sm" />
                  <Input value={form.country || ""} onChange={e => updateForm("country", e.target.value)} placeholder="Locație (ex: București, România)" className="bg-muted border-border text-foreground text-sm" />
                </div>
              ) : (
                <>
                  <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-wide">
                    {profile?.first_name || profile?.last_name
                      ? `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()
                      : "Completează profilul"}
                  </h1>
                  {profile?.title && (
                    <p className="text-foreground/80 font-body text-base mt-1">
                      {profile.title}
                      {profile.organization && <span> @{profile.organization}</span>}
                    </p>
                  )}
                  {profile?.country && (
                    <p className="flex items-center gap-1 text-muted-foreground text-sm font-body mt-1">
                      <MapPin className="h-4 w-4" /> {profile.country}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Organization badge */}
            {!editing && profile?.organization && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="text-sm font-body text-foreground">{profile.organization}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            {!readOnly && (
              <Button
                onClick={() => editing ? handleSave() : setEditing(true)}
                disabled={saving}
                className={editing
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground font-body"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground font-body"
                }
              >
                {editing ? (
                  <>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}{saving ? "..." : "Salvează"}</>
                ) : (
                  <><Edit2 className="h-4 w-4 mr-2" />Editează Profilul</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ===== DESPRE / BIO ===== */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="font-display text-2xl text-foreground mb-3">Despre</h2>
        {editing ? (
          <Textarea
            value={form.bio || ""}
            onChange={e => updateForm("bio", e.target.value)}
            placeholder="Descrie-te pe scurt... Ce te motivează? Care este filosofia ta de scouting?"
            className="bg-muted border-border text-foreground min-h-[120px]"
          />
        ) : (
          <p className="text-foreground/80 font-body text-sm leading-relaxed whitespace-pre-line">
            {profile?.bio || <span className="italic text-muted-foreground">Nicio descriere adăugată.</span>}
          </p>
        )}

        {/* Skills */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg text-foreground">Aptitudini de top</h3>
          </div>
          {editing ? (
            <Input
              value={(form.skills || []).join(", ")}
              onChange={e => updateForm("skills", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              placeholder="Recruitment analysis, Scouting, Video analysis... (separate cu virgulă)"
              className="bg-muted border-border text-foreground text-sm"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {skillsArray.length > 0 ? skillsArray.map((skill, i) => (
                <span key={i} className="px-3 py-1 bg-muted text-foreground/80 rounded-full text-sm font-body">
                  {skill}
                </span>
              )) : (
                <span className="text-muted-foreground italic text-sm">Nicio aptitudine adăugată.</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== EXPERIENȚĂ ===== */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-foreground">Experiență</h2>
          {editing && (
            <Button variant="outline" size="sm" onClick={addExperience} className="text-primary border-primary/30 hover:bg-primary/10">
              <Plus className="h-4 w-4 mr-1" /> Adaugă
            </Button>
          )}
        </div>

        <div className="space-y-6">
          {expForms.length === 0 && !editing && (
            <p className="text-muted-foreground italic text-sm font-body">Nicio experiență adăugată.</p>
          )}
          {expForms.map((exp, index) => (
            <div key={exp.id || `new-${index}`} className="flex gap-4">
              {/* Icon */}
              <div className="flex-shrink-0 mt-1">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input value={exp.role || ""} onChange={e => updateExp(index, "role", e.target.value)} placeholder="Rol (ex: First team scout)" className="bg-muted border-border text-foreground text-sm flex-1" />
                      <Button variant="ghost" size="icon" onClick={() => removeExperience(index)} className="text-destructive hover:text-destructive/80 flex-shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input value={exp.organization || ""} onChange={e => updateExp(index, "organization", e.target.value)} placeholder="Organizație" className="bg-muted border-border text-foreground text-sm" />
                    <div className="flex gap-2">
                      <Input value={exp.location || ""} onChange={e => updateExp(index, "location", e.target.value)} placeholder="Locație" className="bg-muted border-border text-foreground text-sm" />
                      <Input value={exp.start_date || ""} onChange={e => updateExp(index, "start_date", e.target.value)} placeholder="Data început (ex: Jan 2023)" className="bg-muted border-border text-foreground text-sm" />
                      <Input value={exp.end_date || ""} onChange={e => updateExp(index, "end_date", e.target.value)} placeholder="Data sfârșit (sau Prezent)" className="bg-muted border-border text-foreground text-sm" />
                    </div>
                    <Textarea value={exp.description || ""} onChange={e => updateExp(index, "description", e.target.value)} placeholder="Descriere activitate..." className="bg-muted border-border text-foreground text-sm min-h-[60px]" />
                    <Input
                      value={(exp.skills || []).join(", ")}
                      onChange={e => updateExp(index, "skills", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                      placeholder="Competențe (separate cu virgulă)"
                      className="bg-muted border-border text-foreground text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <h3 className="font-body font-semibold text-foreground">{exp.role || "Rol nespecificat"}</h3>
                    <p className="text-foreground/70 font-body text-sm">{exp.organization}</p>
                    <p className="text-muted-foreground font-body text-xs mt-0.5">
                      {exp.start_date && <span>{exp.start_date}</span>}
                      {exp.start_date && exp.end_date && <span> – </span>}
                      {exp.end_date && <span>{exp.end_date}</span>}
                      {exp.location && <span> · {exp.location}</span>}
                    </p>
                    {exp.description && (
                      <p className="text-foreground/70 font-body text-sm mt-2 whitespace-pre-line">{exp.description}</p>
                    )}
                    {exp.skills && exp.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {exp.skills.map((skill, si) => (
                          <span key={si} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-body">{skill}</span>
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
    </div>
  );
};

export default ScoutPersonalProfile;
