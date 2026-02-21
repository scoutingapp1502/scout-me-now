import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, Edit2, MapPin, Briefcase, Plus, Trash2, Diamond } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface ScoutProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  bio: string | null;
  country: string | null;
  organization: string | null;
  photo_url: string | null;
  cover_photo_url: string | null;
  title: string | null;
  skills: string[] | null;
  created_at: string;
  updated_at: string;
}

interface ScoutExperience {
  id: string;
  user_id: string;
  organization: string;
  role: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  skills: string[] | null;
  sort_order: number;
}

interface ScoutPersonalProfileProps {
  userId: string;
  readOnly?: boolean;
}

const ScoutPersonalProfile = ({ userId, readOnly = false }: ScoutPersonalProfileProps) => {
  const { toast } = useToast();
  const { lang } = useLanguage();
  const [profile, setProfile] = useState<ScoutProfile | null>(null);
  const [experiences, setExperiences] = useState<ScoutExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ScoutProfile>>({});
  const [expForm, setExpForm] = useState<ScoutExperience[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    const [profileRes, expRes] = await Promise.all([
      supabase.from("scout_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("scout_experiences").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
    ]);

    if (!profileRes.data && !profileRes.error && !readOnly) {
      const { data: newData } = await supabase
        .from("scout_profiles")
        .insert({ user_id: userId, first_name: "", last_name: "" })
        .select("*")
        .single();
      if (newData) {
        setProfile(newData as ScoutProfile);
        setForm(newData as ScoutProfile);
      }
    } else if (profileRes.data) {
      setProfile(profileRes.data as ScoutProfile);
      setForm(profileRes.data as ScoutProfile);
    }

    if (expRes.data) {
      setExperiences(expRes.data as ScoutExperience[]);
      setExpForm(expRes.data as ScoutExperience[]);
    }
    setLoading(false);
  };

  const updateForm = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); }
  };

  const addSkill = () => {
    if (!newSkill.trim()) return;
    const current = form.skills || [];
    updateForm("skills", [...current, newSkill.trim()]);
    setNewSkill("");
  };

  const removeSkill = (idx: number) => {
    const current = form.skills || [];
    updateForm("skills", current.filter((_, i) => i !== idx));
  };

  const addExperience = () => {
    setExpForm([...expForm, {
      id: crypto.randomUUID(),
      user_id: userId,
      organization: "",
      role: "",
      location: null,
      start_date: null,
      end_date: null,
      description: null,
      skills: null,
      sort_order: expForm.length,
    }]);
  };

  const updateExp = (idx: number, key: string, value: any) => {
    setExpForm((prev) => prev.map((e, i) => i === idx ? { ...e, [key]: value } : e));
  };

  const removeExp = (idx: number) => {
    setExpForm((prev) => prev.filter((_, i) => i !== idx));
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

      const { error } = await supabase.from("scout_profiles").update({
        first_name: form.first_name,
        last_name: form.last_name,
        bio: form.bio,
        country: form.country,
        organization: form.organization,
        title: form.title,
        skills: form.skills,
        photo_url: photoUrl,
        cover_photo_url: coverUrl,
      }).eq("user_id", userId);

      if (error) throw error;

      // Save experiences: delete all, re-insert
      await supabase.from("scout_experiences").delete().eq("user_id", userId);
      if (expForm.length > 0) {
        const toInsert = expForm.map((e, i) => ({
          user_id: userId,
          organization: e.organization,
          role: e.role,
          location: e.location,
          start_date: e.start_date,
          end_date: e.end_date,
          description: e.description,
          skills: e.skills,
          sort_order: i,
        }));
        const { error: expError } = await supabase.from("scout_experiences").insert(toInsert);
        if (expError) throw expError;
      }

      toast({ title: lang === "ro" ? "Profil actualizat cu succes!" : "Profile updated successfully!" });
      setEditing(false);
      setAvatarFile(null);
      setCoverFile(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground font-body">
      {lang === "ro" ? "Se încarcă..." : "Loading..."}
    </div>;
  }

  const photoSrc = avatarPreview || profile?.photo_url;
  const coverSrc = coverPreview || profile?.cover_photo_url;
  const fullName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Cover + Avatar header */}
      <div className="relative bg-card border border-border rounded-xl overflow-hidden">
        {/* Cover photo */}
        <div className="relative h-40 sm:h-52 bg-gradient-to-br from-sidebar to-sidebar-accent overflow-hidden group">
          {coverSrc && <img src={coverSrc} alt="Cover" className="w-full h-full object-cover" />}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)`,
            backgroundSize: '30px 30px'
          }} />
          {editing && (
            <label className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera className="h-8 w-8 text-primary" />
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
            </label>
          )}
        </div>

        {/* Avatar overlapping cover */}
        <div className="relative px-6 pb-5">
          <div className="relative -mt-16 group w-fit">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-card overflow-hidden bg-muted shadow-lg">
              {photoSrc ? (
                <img src={photoSrc} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Camera className="h-10 w-10" />
                </div>
              )}
            </div>
            {editing && (
              <label className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-primary" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            )}
          </div>

          {/* Name & info */}
          <div className="mt-3">
            {editing ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input value={form.first_name || ""} onChange={(e) => updateForm("first_name", e.target.value)} placeholder={lang === "ro" ? "Prenume" : "First name"} className="font-display text-xl h-auto py-1" />
                  <Input value={form.last_name || ""} onChange={(e) => updateForm("last_name", e.target.value)} placeholder={lang === "ro" ? "Nume" : "Last name"} className="font-display text-xl h-auto py-1" />
                </div>
                <Input value={form.title || ""} onChange={(e) => updateForm("title", e.target.value)} placeholder={lang === "ro" ? "Titlu (ex: First team scout)" : "Title (e.g. First team scout)"} className="text-sm" />
                <Input value={form.organization || ""} onChange={(e) => updateForm("organization", e.target.value)} placeholder={lang === "ro" ? "Organizație/Club" : "Organization/Club"} className="text-sm" />
                <Input value={form.country || ""} onChange={(e) => updateForm("country", e.target.value)} placeholder={lang === "ro" ? "Țară, Oraș" : "Country, City"} className="text-sm" />
              </div>
            ) : (
              <>
                <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-wide uppercase">
                  {fullName || (lang === "ro" ? "Completează profilul" : "Complete your profile")}
                </h1>
                {profile?.title && (
                  <p className="text-primary font-body text-sm font-semibold mt-1">
                    {profile.title}
                    {profile.organization && <span className="text-foreground"> @{profile.organization}</span>}
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

          {/* Edit/Save button */}
          {!readOnly && (
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => editing ? handleSave() : setEditing(true)}
                disabled={saving}
                size="sm"
                className={editing
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground font-display"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground font-display"
                }
              >
                {editing ? (
                  <><Save className="h-4 w-4 mr-2" />{saving ? "..." : (lang === "ro" ? "Salvează" : "Save")}</>
                ) : (
                  <><Edit2 className="h-4 w-4 mr-2" />{lang === "ro" ? "Editează" : "Edit"}</>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* About / Despre */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
        <h3 className="font-display text-xl text-foreground mb-3 uppercase">
          {lang === "ro" ? "Despre" : "About"}
        </h3>
        {editing ? (
          <Textarea
            value={form.bio || ""}
            onChange={(e) => updateForm("bio", e.target.value)}
            placeholder={lang === "ro" ? "Descrie experiența ta ca scouter..." : "Describe your scouting experience..."}
            rows={5}
          />
        ) : (
          <p className="text-foreground font-body text-sm leading-relaxed whitespace-pre-line">
            {profile?.bio || (lang === "ro" ? "Nicio descriere adăugată." : "No description added.")}
          </p>
        )}

        {/* Skills / Aptitudini de top */}
        {((form.skills && form.skills.length > 0) || editing) && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Diamond className="h-4 w-4 text-primary" />
              <span className="font-display text-sm text-foreground uppercase">
                {lang === "ro" ? "Aptitudini de top" : "Top skills"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(editing ? form.skills : profile?.skills)?.map((skill, i) => (
                <span key={i} className="bg-muted text-foreground text-xs font-body px-3 py-1.5 rounded-full flex items-center gap-1">
                  {skill}
                  {editing && (
                    <button onClick={() => removeSkill(i)} className="text-muted-foreground hover:text-destructive ml-1">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {editing && (
                <div className="flex gap-1">
                  <Input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder={lang === "ro" ? "Aptitudine nouă" : "New skill"}
                    className="w-32 h-8 text-xs"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                  />
                  <Button onClick={addSkill} size="sm" variant="ghost" className="h-8 px-2">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Experience / Experiență */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-foreground uppercase">
            {lang === "ro" ? "Experiență" : "Experience"}
          </h3>
          {editing && (
            <Button onClick={addExperience} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              {lang === "ro" ? "Adaugă" : "Add"}
            </Button>
          )}
        </div>

        <div className="space-y-0">
          {(editing ? expForm : experiences).map((exp, idx) => (
            <div key={exp.id || idx} className={`relative py-4 ${idx > 0 ? "border-t border-border" : ""}`}>
              {/* Timeline dot */}
              <div className="absolute left-0 top-6 w-2 h-2 rounded-full bg-muted-foreground" />

              <div className="pl-6">
                {editing ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input value={exp.role} onChange={(e) => updateExp(idx, "role", e.target.value)} placeholder={lang === "ro" ? "Rol (ex: First team scout)" : "Role"} className="flex-1" />
                      <Button variant="ghost" size="sm" onClick={() => removeExp(idx)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input value={exp.organization} onChange={(e) => updateExp(idx, "organization", e.target.value)} placeholder={lang === "ro" ? "Organizație/Club" : "Organization/Club"} />
                    <div className="flex gap-2">
                      <Input value={exp.start_date || ""} onChange={(e) => updateExp(idx, "start_date", e.target.value)} placeholder={lang === "ro" ? "Data început (ex: oct. 2025)" : "Start date"} className="flex-1" />
                      <Input value={exp.end_date || ""} onChange={(e) => updateExp(idx, "end_date", e.target.value)} placeholder={lang === "ro" ? "Data sfârșit (sau 'prezent')" : "End date (or 'present')"} className="flex-1" />
                    </div>
                    <Input value={exp.location || ""} onChange={(e) => updateExp(idx, "location", e.target.value)} placeholder={lang === "ro" ? "Locație" : "Location"} />
                    <Textarea value={exp.description || ""} onChange={(e) => updateExp(idx, "description", e.target.value)} placeholder={lang === "ro" ? "Descriere activitate..." : "Activity description..."} rows={3} />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Briefcase className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-foreground font-semibold text-sm">{exp.role}</p>
                        <p className="font-body text-muted-foreground text-sm">{exp.organization}</p>
                        <p className="font-body text-muted-foreground text-xs">
                          {exp.start_date && <span>{exp.start_date}</span>}
                          {exp.end_date && <span> - {exp.end_date}</span>}
                          {exp.location && <span> · {exp.location}</span>}
                        </p>
                        {exp.description && (
                          <p className="text-foreground font-body text-sm mt-2 leading-relaxed">{exp.description}</p>
                        )}
                        {exp.skills && exp.skills.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground font-body">
                            <Diamond className="h-3 w-3" />
                            {exp.skills.join(" · ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          {!editing && experiences.length === 0 && (
            <p className="text-muted-foreground font-body text-sm py-4">
              {lang === "ro" ? "Nicio experiență adăugată." : "No experience added."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScoutPersonalProfile;
