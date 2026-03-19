import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Plus, Trash2, Loader2, Save, GraduationCap, BadgeCheck, Languages, Info, X, Upload, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const ALL_LANGUAGES = [
  "Română", "Engleză", "Franceză", "Spaniolă", "Germană", "Italiană", "Portugheză",
  "Olandeză", "Rusă", "Ucraineană", "Poloneză", "Cehă", "Slovacă", "Bulgară",
  "Sârbă", "Croată", "Maghiară", "Turcă", "Arabă", "Chineză (Mandarină)",
  "Japoneză", "Coreeană", "Hindi", "Greacă", "Suedeză", "Norvegiană", "Daneză",
  "Finlandeză", "Catalană", "Bască", "Galiciană", "Ebraică", "Persană",
];

const PROFICIENCY_LEVELS = [
  { value: "Nativ", label: "Nativ sau bilingv" },
  { value: "Avansat", label: "Competență profesională completă" },
  { value: "Intermediar-Avansat", label: "Competență profesională limitată" },
  { value: "Intermediar", label: "Competență elementară profesională" },
  { value: "Începător", label: "Competență elementară" },
];

interface ScoutExtraSectionsProps {
  userId: string;
  readOnly?: boolean;
}

type Education = {
  id?: string;
  user_id: string;
  institution: string;
  degree: string;
  field_of_study?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  sort_order: number;
};

type Certification = {
  id?: string;
  user_id: string;
  name: string;
  issuing_organization: string;
  issue_date?: string | null;
  expiry_date?: string | null;
  credential_url?: string | null;
  documents?: string[] | null;
  sort_order: number;
};

type EditingSection = "education" | "certifications" | "languages" | null;

const ScoutExtraSections = ({ userId, readOnly = false }: ScoutExtraSectionsProps) => {
  const { toast } = useToast();
  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingDocIndex, setUploadingDocIndex] = useState<number | null>(null);

  // Education
  const [education, setEducation] = useState<Education[]>([]);
  const [eduForms, setEduForms] = useState<Partial<Education>[]>([]);

  // Certifications
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [certForms, setCertForms] = useState<Partial<Certification>[]>([]);

  // Languages
  const [languages, setLanguages] = useState<string[]>([]);
  const [showLangDialog, setShowLangDialog] = useState(false);
  const [langInput, setLangInput] = useState("");
  const [langLevel, setLangLevel] = useState("");
  const [langError, setLangError] = useState("");
  const [langSuggestions, setLangSuggestions] = useState<string[]>([]);
  const langInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAll();
  }, [userId]);

  const fetchAll = async () => {
    const [eduRes, certRes, profileRes] = await Promise.all([
      supabase.from("scout_education").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
      supabase.from("scout_certifications").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
      supabase.from("scout_profiles").select("languages").eq("user_id", userId).maybeSingle(),
    ]);
    if (eduRes.data) { setEducation(eduRes.data as Education[]); setEduForms(eduRes.data as Education[]); }
    if (certRes.data) { setCertifications(certRes.data as Certification[]); setCertForms(certRes.data as Certification[]); }
    const langs = (profileRes.data as any)?.languages as string[] | null;
    if (langs) { setLanguages(langs); }
  };

  // === Education ===
  const addEducation = () => setEduForms(prev => [...prev, { user_id: userId, institution: "", degree: "", sort_order: prev.length }]);
  const removeEducation = (i: number) => setEduForms(prev => prev.filter((_, idx) => idx !== i));
  const updateEdu = (i: number, key: string, val: any) => setEduForms(prev => prev.map((e, idx) => idx === i ? { ...e, [key]: val } : e));

  const handleSaveEducation = async () => {
    setSaving(true);
    try {
      await supabase.from("scout_education").delete().eq("user_id", userId);
      const toInsert = eduForms.filter(e => e.institution || e.degree).map((e, i) => ({
        user_id: userId,
        institution: e.institution || "",
        degree: e.degree || "",
        field_of_study: e.field_of_study || null,
        start_date: e.start_date || null,
        end_date: e.end_date || null,
        description: e.description || null,
        sort_order: i,
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from("scout_education").insert(toInsert);
        if (error) throw error;
      }
      const { data } = await supabase.from("scout_education").select("*").eq("user_id", userId).order("sort_order", { ascending: true });
      if (data) { setEducation(data as Education[]); setEduForms(data as Education[]); }
      setEditingSection(null);
      toast({ title: "Studii salvate!" });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // === Certifications ===
  const addCertification = () => setCertForms(prev => [...prev, { user_id: userId, name: "", issuing_organization: "", sort_order: prev.length }]);
  const removeCertification = (i: number) => setCertForms(prev => prev.filter((_, idx) => idx !== i));
  const updateCert = (i: number, key: string, val: any) => setCertForms(prev => prev.map((c, idx) => idx === i ? { ...c, [key]: val } : c));

  const handleSaveCertifications = async () => {
    setSaving(true);
    try {
      await supabase.from("scout_certifications").delete().eq("user_id", userId);
      const toInsert = certForms.filter(c => c.name || c.issuing_organization).map((c, i) => ({
        user_id: userId,
        name: c.name || "",
        issuing_organization: c.issuing_organization || "",
        issue_date: c.issue_date || null,
        expiry_date: c.expiry_date || null,
        credential_url: c.credential_url || null,
        documents: c.documents || [],
        sort_order: i,
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from("scout_certifications").insert(toInsert);
        if (error) throw error;
      }
      const { data } = await supabase.from("scout_certifications").select("*").eq("user_id", userId).order("sort_order", { ascending: true });
      if (data) { setCertifications(data as Certification[]); setCertForms(data as Certification[]); }
      setEditingSection(null);
      toast({ title: "Licențe și atestate salvate!" });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleCertDocUpload = async (certIndex: number, file: File) => {
    setUploadingDocIndex(certIndex);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/cert-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("scout-documents").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("scout-documents").getPublicUrl(path);
      const currentDocs = certForms[certIndex].documents || [];
      updateCert(certIndex, "documents", [...currentDocs, urlData.publicUrl]);
      toast({ title: "Document încărcat!" });
    } catch (err: any) {
      toast({ title: "Eroare la încărcare", description: err.message, variant: "destructive" });
    } finally { setUploadingDocIndex(null); }
  };

  const handleRemoveCertDoc = (certIndex: number, docIndex: number) => {
    const currentDocs = certForms[certIndex].documents || [];
    updateCert(certIndex, "documents", currentDocs.filter((_, i) => i !== docIndex));
  };

  const openDocSafely = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch {
      window.open(url, "_blank");
    }
  };

  // === Languages ===
  const handleAddLanguage = async () => {
    if (!langInput.trim()) { setLangError("Acest câmp este obligatoriu"); return; }
    const entry = langLevel ? `${langInput.trim()} - ${langLevel}` : langInput.trim();
    const updated = [...languages, entry];
    setSaving(true);
    try {
      const { error } = await supabase.from("scout_profiles").update({ languages: updated } as any).eq("user_id", userId);
      if (error) throw error;
      setLanguages(updated);
      setShowLangDialog(false);
      setLangInput(""); setLangLevel(""); setLangError(""); setLangSuggestions([]);
      toast({ title: "Limbă adăugată!" });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleRemoveLanguage = async (index: number) => {
    const updated = languages.filter((_, i) => i !== index);
    try {
      const { error } = await supabase.from("scout_profiles").update({ languages: updated } as any).eq("user_id", userId);
      if (error) throw error;
      setLanguages(updated);
      toast({ title: "Limbă eliminată!" });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    }
  };

  const handleLangInputChange = (val: string) => {
    setLangInput(val);
    setLangError("");
    if (val.trim().length > 0) {
      const filtered = ALL_LANGUAGES.filter(l => 
        l.toLowerCase().startsWith(val.toLowerCase()) && 
        !languages.some(existing => existing.split(" - ")[0] === l)
      );
      setLangSuggestions(filtered.slice(0, 5));
    } else {
      setLangSuggestions([]);
    }
  };

  return (
    <>
      {/* ===== STUDII ===== */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl text-foreground">Studii</h2>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-primary transition-colors" aria-label="Sfaturi pentru studii">
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" className="w-80 text-sm bg-card border-border">
                <p className="font-semibold text-foreground mb-2">💡 Sfaturi pentru secțiunea Studii:</p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li>Adaugă studiile universitare și postuniversitare relevante</li>
                  <li>Menționează cursuri de specialitate în sport sau management sportiv</li>
                  <li>Include instituția, diploma obținută și domeniul de studiu</li>
                  <li>Adaugă perioada studiilor pentru un profil complet</li>
                </ul>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            {editingSection === "education" && (
              <>
                <Button variant="outline" size="sm" onClick={addEducation} className="text-primary border-primary/30 hover:bg-primary/10">
                  <Plus className="h-4 w-4 mr-1" /> Adaugă
                </Button>
                <Button size="sm" onClick={handleSaveEducation} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-body">
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  {saving ? "..." : "Salvează"}
                </Button>
              </>
            )}
            {!readOnly && editingSection !== "education" && (
              <button onClick={() => setEditingSection("education")} className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-accent/50" title="Editează">
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {eduForms.length === 0 && editingSection !== "education" && (
            <p className="text-muted-foreground italic text-sm font-body">Niciun studiu adăugat.</p>
          )}
          {eduForms.map((edu, index) => (
            <div key={edu.id || `new-${index}`} className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {editingSection === "education" ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input value={edu.institution || ""} onChange={e => updateEdu(index, "institution", e.target.value)} placeholder="Instituție" className="bg-muted border-border text-white text-sm flex-1" />
                      <Button variant="ghost" size="icon" onClick={() => removeEducation(index)} className="text-destructive hover:text-destructive/80 flex-shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input value={edu.degree || ""} onChange={e => updateEdu(index, "degree", e.target.value)} placeholder="Diploma (ex: Licență, Master)" className="bg-muted border-border text-white text-sm" />
                    <Input value={edu.field_of_study || ""} onChange={e => updateEdu(index, "field_of_study", e.target.value)} placeholder="Domeniu de studiu" className="bg-muted border-border text-white text-sm" />
                    <div className="flex gap-2">
                      <Input value={edu.start_date || ""} onChange={e => updateEdu(index, "start_date", e.target.value)} placeholder="Data început" className="bg-muted border-border text-white text-sm" />
                      <Input value={edu.end_date || ""} onChange={e => updateEdu(index, "end_date", e.target.value)} placeholder="Data sfârșit" className="bg-muted border-border text-white text-sm" />
                    </div>
                    <Textarea value={edu.description || ""} onChange={e => updateEdu(index, "description", e.target.value)} placeholder="Descriere (opțional)" className="bg-muted border-border text-white text-sm min-h-[60px]" />
                  </div>
                ) : (
                  <>
                    <h3 className="font-body font-semibold text-foreground">{edu.degree || "Diplomă nespecificată"}</h3>
                    <p className="text-foreground/70 font-body text-sm">{edu.institution}</p>
                    {edu.field_of_study && <p className="text-muted-foreground font-body text-xs">{edu.field_of_study}</p>}
                    <p className="text-muted-foreground font-body text-xs mt-0.5">
                      {edu.start_date && <span>{edu.start_date}</span>}
                      {edu.start_date && edu.end_date && <span> – </span>}
                      {edu.end_date && <span>{edu.end_date}</span>}
                    </p>
                    {edu.description && <p className="text-foreground/70 font-body text-sm mt-2 whitespace-pre-line">{edu.description}</p>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== LICENȚE ȘI ATESTATE ===== */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl text-foreground">Licențe și Atestate</h2>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-primary transition-colors" aria-label="Sfaturi pentru licențe">
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" className="w-80 text-sm bg-card border-border">
                <p className="font-semibold text-foreground mb-2">💡 Sfaturi pentru licențe și atestate:</p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li>Adaugă licențele de antrenor/scouter (ex: UEFA A, B, Pro)</li>
                  <li>Include atestatele de scouting sau analiză sportivă</li>
                  <li>Menționează organizația care a emis certificarea</li>
                  <li>Adaugă link-ul de verificare dacă este disponibil</li>
                  <li>Include data obținerii și data expirării (dacă e cazul)</li>
                </ul>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            {editingSection === "certifications" && (
              <>
                <Button variant="outline" size="sm" onClick={addCertification} className="text-primary border-primary/30 hover:bg-primary/10">
                  <Plus className="h-4 w-4 mr-1" /> Adaugă
                </Button>
                <Button size="sm" onClick={handleSaveCertifications} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-body">
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  {saving ? "..." : "Salvează"}
                </Button>
              </>
            )}
            {!readOnly && editingSection !== "certifications" && (
              <button onClick={() => setEditingSection("certifications")} className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-accent/50" title="Editează">
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {certForms.length === 0 && editingSection !== "certifications" && (
            <p className="text-muted-foreground italic text-sm font-body">Nicio licență sau atestat adăugat.</p>
          )}
          {certForms.map((cert, index) => (
            <div key={cert.id || `new-${index}`} className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <BadgeCheck className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {editingSection === "certifications" ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input value={cert.name || ""} onChange={e => updateCert(index, "name", e.target.value)} placeholder="Denumire (ex: UEFA B License)" className="bg-muted border-border text-white text-sm flex-1" />
                      <Button variant="ghost" size="icon" onClick={() => removeCertification(index)} className="text-destructive hover:text-destructive/80 flex-shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input value={cert.issuing_organization || ""} onChange={e => updateCert(index, "issuing_organization", e.target.value)} placeholder="Organizație emitentă" className="bg-muted border-border text-white text-sm" />
                    <div className="flex gap-2">
                      <Input value={cert.issue_date || ""} onChange={e => updateCert(index, "issue_date", e.target.value)} placeholder="Data obținerii" className="bg-muted border-border text-white text-sm" />
                      <Input value={cert.expiry_date || ""} onChange={e => updateCert(index, "expiry_date", e.target.value)} placeholder="Data expirării (opțional)" className="bg-muted border-border text-white text-sm" />
                    </div>
                    <Input value={cert.credential_url || ""} onChange={e => updateCert(index, "credential_url", e.target.value)} placeholder="URL verificare (opțional)" className="bg-muted border-border text-white text-sm" />
                  </div>
                ) : (
                  <>
                    <h3 className="font-body font-semibold text-foreground">{cert.name || "Certificare nespecificată"}</h3>
                    <p className="text-foreground/70 font-body text-sm">{cert.issuing_organization}</p>
                    <p className="text-muted-foreground font-body text-xs mt-0.5">
                      {cert.issue_date && <span>Obținut: {cert.issue_date}</span>}
                      {cert.expiry_date && <span> · Expiră: {cert.expiry_date}</span>}
                    </p>
                    {cert.credential_url && (
                      <a href={cert.credential_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline mt-1 inline-block">
                        Verifică acreditarea →
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== LIMBI CUNOSCUTE ===== */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl text-foreground">Limbi cunoscute</h2>
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-primary transition-colors" aria-label="Sfaturi pentru limbi">
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" className="w-80 text-sm bg-card border-border">
                <p className="font-semibold text-foreground mb-2">💡 Sfaturi pentru limbi cunoscute:</p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li>Adaugă toate limbile pe care le vorbești</li>
                  <li>Limbile străine sunt un avantaj major în scouting internațional</li>
                  <li>Specifică nivelul de competență pentru fiecare limbă</li>
                </ul>
              </PopoverContent>
            </Popover>
          </div>
          {!readOnly && (
            <button onClick={() => { setLangInput(""); setLangLevel(""); setLangError(""); setLangSuggestions([]); setShowLangDialog(true); }} className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-accent/50" title="Editează">
              <Edit2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {languages.length > 0 ? languages.map((lang, i) => (
            <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-foreground/80 rounded-full text-sm font-body">
              <Languages className="h-3.5 w-3.5 text-primary" />
              {lang}
              {!readOnly && (
                <button onClick={() => handleRemoveLanguage(i)} className="ml-1 hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          )) : (
            <p className="text-muted-foreground italic text-sm font-body">Nicio limbă adăugată.</p>
          )}
        </div>
      </div>

      {/* Language Dialog */}
      <Dialog open={showLangDialog} onOpenChange={setShowLangDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground font-display text-xl">Adăugați o limbă cunoscută</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">Identificați-vă singur limba și competențele.</p>
          
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5 relative">
              <Label className="text-foreground text-sm">Limbă*</Label>
              <Input
                ref={langInputRef}
                value={langInput}
                onChange={e => handleLangInputChange(e.target.value)}
                placeholder="Căutați o limbă..."
                className="bg-background border-border text-foreground text-sm"
              />
              {langError && (
                <p className="text-destructive text-xs flex items-center gap-1">
                  <span className="inline-block w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-center text-xs leading-4">⊘</span>
                  {langError}
                </p>
              )}
              {langSuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                  {langSuggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setLangInput(s); setLangSuggestions([]); }}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent/50 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Nivel de competență</Label>
              <Select value={langLevel} onValueChange={setLangLevel}>
                <SelectTrigger className="bg-background border-border text-foreground text-sm">
                  <SelectValue placeholder="Selectați competența" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {PROFICIENCY_LEVELS.map(l => (
                    <SelectItem key={l.value} value={l.value} className="text-foreground">
                      <div>
                        <span className="font-medium">{l.value}</span>
                        <span className="text-muted-foreground text-xs ml-2">— {l.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowLangDialog(false)} className="border-border text-foreground">Anulează</Button>
              <Button onClick={handleAddLanguage} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Salvează
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScoutExtraSections;
