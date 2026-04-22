import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Plus, Trash2, Loader2, BadgeCheck, Languages, Info, X, Upload, FileText } from "lucide-react";
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

const ScoutExtraSections = ({ userId, readOnly = false }: ScoutExtraSectionsProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingEduDoc, setUploadingEduDoc] = useState(false);

  // Education
  const [education, setEducation] = useState<Education[]>([]);
  const [showEduDialog, setShowEduDialog] = useState(false);
  const [eduForm, setEduForm] = useState<Partial<Education>>({});

  // Certifications
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [showCertDialog, setShowCertDialog] = useState(false);
  const [certForm, setCertForm] = useState<Partial<Certification>>({});

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

  const notifyProfileUpdated = () => {
    window.dispatchEvent(new Event("profile-updated"));
  };

  const fetchAll = async () => {
    const [eduRes, certRes, profileRes] = await Promise.all([
      supabase.from("scout_education").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
      supabase.from("scout_certifications").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
      supabase.from("scout_profiles").select("languages").eq("user_id", userId).maybeSingle(),
    ]);
    if (eduRes.data) setEducation(eduRes.data as Education[]);
    if (certRes.data) setCertifications(certRes.data as Certification[]);
    const langs = (profileRes.data as any)?.languages as string[] | null;
    if (langs) setLanguages(langs);
  };

  // === Education ===
  const openEduDialog = () => {
    setEduForm({ user_id: userId, institution: "", degree: "", field_of_study: "", start_date: "", end_date: "", description: "", documents: [] });
    setShowEduDialog(true);
  };

  const handleSaveEducation = async () => {
    if (!eduForm.institution && !eduForm.degree) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("scout_education").insert({
        user_id: userId,
        institution: eduForm.institution || "",
        degree: eduForm.degree || "",
        field_of_study: eduForm.field_of_study || null,
        start_date: eduForm.start_date || null,
        end_date: eduForm.end_date || null,
        description: eduForm.description || null,
        documents: eduForm.documents || [],
        sort_order: education.length,
      });
      if (error) throw error;
      const { data } = await supabase.from("scout_education").select("*").eq("user_id", userId).order("sort_order", { ascending: true });
      if (data) setEducation(data as Education[]);
      setShowEduDialog(false);
      notifyProfileUpdated();
      toast({ title: "Studiu adăugat!" });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeleteEducation = async (id: string) => {
    try {
      await supabase.from("scout_education").delete().eq("id", id);
      setEducation(prev => prev.filter(e => e.id !== id));
      notifyProfileUpdated();
      toast({ title: "Studiu eliminat!" });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    }
  };

  const handleEduDocUpload = async (file: File) => {
    setUploadingEduDoc(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/edu-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("scout-documents").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("scout-documents").getPublicUrl(path);
      const currentDocs = eduForm.documents || [];
      setEduForm(prev => ({ ...prev, documents: [...currentDocs, urlData.publicUrl] }));
      toast({ title: "Document încărcat!" });
    } catch (err: any) {
      toast({ title: "Eroare la încărcare", description: err.message, variant: "destructive" });
    } finally { setUploadingEduDoc(false); }
  };

  const removeEduDoc = (docIndex: number) => {
    const currentDocs = eduForm.documents || [];
    setEduForm(prev => ({ ...prev, documents: currentDocs.filter((_, i) => i !== docIndex) }));
  };

  // === Certifications ===
  const openCertDialog = () => {
    setCertForm({ user_id: userId, name: "", issuing_organization: "", issue_date: "", expiry_date: "", credential_url: "", documents: [] });
    setShowCertDialog(true);
  };

  const handleSaveCertification = async () => {
    if (!certForm.name && !certForm.issuing_organization) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("scout_certifications").insert({
        user_id: userId,
        name: certForm.name || "",
        issuing_organization: certForm.issuing_organization || "",
        issue_date: certForm.issue_date || null,
        expiry_date: certForm.expiry_date || null,
        credential_url: certForm.credential_url || null,
        documents: certForm.documents || [],
        sort_order: certifications.length,
      });
      if (error) throw error;
      const { data } = await supabase.from("scout_certifications").select("*").eq("user_id", userId).order("sort_order", { ascending: true });
      if (data) setCertifications(data as Certification[]);
      setShowCertDialog(false);
      notifyProfileUpdated();
      toast({ title: "Licență/atestat adăugat!" });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeleteCertification = async (id: string) => {
    try {
      await supabase.from("scout_certifications").delete().eq("id", id);
      setCertifications(prev => prev.filter(c => c.id !== id));
      notifyProfileUpdated();
      toast({ title: "Licență/atestat eliminat!" });
    } catch (err: any) {
      toast({ title: "Eroare", description: err.message, variant: "destructive" });
    }
  };

  const handleCertDocUpload = async (file: File) => {
    setUploadingDoc(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/cert-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("scout-documents").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("scout-documents").getPublicUrl(path);
      const currentDocs = certForm.documents || [];
      setCertForm(prev => ({ ...prev, documents: [...currentDocs, urlData.publicUrl] }));
      toast({ title: "Document încărcat!" });
    } catch (err: any) {
      toast({ title: "Eroare la încărcare", description: err.message, variant: "destructive" });
    } finally { setUploadingDoc(false); }
  };

  const removeCertDoc = (docIndex: number) => {
    const currentDocs = certForm.documents || [];
    setCertForm(prev => ({ ...prev, documents: currentDocs.filter((_, i) => i !== docIndex) }));
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
      notifyProfileUpdated();
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
      notifyProfileUpdated();
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
      {/* ===== LICENȚE ȘI ATESTATE ===== */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl text-foreground">Licențe și Atestate</h2>
            {!readOnly && <Popover>
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
            </Popover>}
          </div>
          {!readOnly && (
            <button onClick={openCertDialog} className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-accent/50" title="Adaugă licență">
              <Edit2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          {certifications.length === 0 && (
            <p className="text-muted-foreground italic text-sm font-body">Nicio licență sau atestat adăugat.</p>
          )}
          {certifications.map((cert) => (
            <div key={cert.id} className="flex gap-4 group">
              <div className="flex-shrink-0 mt-1">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <BadgeCheck className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
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
                {cert.documents && cert.documents.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {cert.documents.map((doc, di) => (
                      <button key={di} onClick={() => openDocSafely(doc)} className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-md text-xs text-foreground/70 hover:text-primary transition-colors font-body">
                        <FileText className="h-3.5 w-3.5" />
                        {decodeURIComponent(doc.split("/").pop() || "Document")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!readOnly && cert.id && (
                <button onClick={() => handleDeleteCertification(cert.id!)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 self-start">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ===== LIMBI CUNOSCUTE ===== */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl text-foreground">Limbi cunoscute</h2>
            {!readOnly && <Popover>
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
            </Popover>}
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

      {/* === Education Dialog === */}
      <Dialog open={showEduDialog} onOpenChange={setShowEduDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground font-display text-xl">Adaugă studiu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Instituție*</Label>
              <Input value={eduForm.institution || ""} onChange={e => setEduForm(p => ({ ...p, institution: e.target.value }))} placeholder="Ex: Universitatea din București" className="bg-background border-border text-foreground text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Diplomă*</Label>
              <Input value={eduForm.degree || ""} onChange={e => setEduForm(p => ({ ...p, degree: e.target.value }))} placeholder="Ex: Licență, Master" className="bg-background border-border text-foreground text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Domeniu de studiu</Label>
              <Input value={eduForm.field_of_study || ""} onChange={e => setEduForm(p => ({ ...p, field_of_study: e.target.value }))} placeholder="Ex: Management sportiv" className="bg-background border-border text-foreground text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Data început</Label>
                <Input value={eduForm.start_date || ""} onChange={e => setEduForm(p => ({ ...p, start_date: e.target.value }))} placeholder="Ex: 2018" className="bg-background border-border text-foreground text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Data sfârșit</Label>
                <Input value={eduForm.end_date || ""} onChange={e => setEduForm(p => ({ ...p, end_date: e.target.value }))} placeholder="Ex: 2022" className="bg-background border-border text-foreground text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Descriere (opțional)</Label>
              <Textarea value={eduForm.description || ""} onChange={e => setEduForm(p => ({ ...p, description: e.target.value }))} placeholder="Descriere scurtă..." className="bg-background border-border text-foreground text-sm min-h-[60px]" />
            </div>

            {/* Documents */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-foreground text-sm">Documente</Label>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded-md text-sm text-muted-foreground hover:text-primary hover:border-primary/50 cursor-pointer transition-colors">
                  {uploadingEduDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadingEduDoc ? "Se încarcă..." : "Încarcă document"}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => { if (e.target.files?.[0]) handleEduDocUpload(e.target.files[0]); e.target.value = ""; }} disabled={uploadingEduDoc} />
                </label>
              </div>
              {(eduForm.documents || []).map((doc, di) => (
                <div key={di} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-foreground/70 truncate flex-1 font-body">{decodeURIComponent(doc.split("/").pop() || "Document")}</span>
                  <button type="button" onClick={() => removeEduDoc(di)} className="text-destructive hover:text-destructive/80">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEduDialog(false)} className="border-border text-foreground">Anulează</Button>
              <Button onClick={handleSaveEducation} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Salvează
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* === Certification Dialog === */}
      <Dialog open={showCertDialog} onOpenChange={setShowCertDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground font-display text-xl">Adaugă licență / atestat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Denumire*</Label>
              <Input value={certForm.name || ""} onChange={e => setCertForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: UEFA B License" className="bg-background border-border text-foreground text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">Organizație emitentă*</Label>
              <Input value={certForm.issuing_organization || ""} onChange={e => setCertForm(p => ({ ...p, issuing_organization: e.target.value }))} placeholder="Ex: UEFA" className="bg-background border-border text-foreground text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Data obținerii</Label>
                <Input value={certForm.issue_date || ""} onChange={e => setCertForm(p => ({ ...p, issue_date: e.target.value }))} placeholder="Ex: 2023" className="bg-background border-border text-foreground text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">Data expirării</Label>
                <Input value={certForm.expiry_date || ""} onChange={e => setCertForm(p => ({ ...p, expiry_date: e.target.value }))} placeholder="Opțional" className="bg-background border-border text-foreground text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground text-sm">URL verificare</Label>
              <Input value={certForm.credential_url || ""} onChange={e => setCertForm(p => ({ ...p, credential_url: e.target.value }))} placeholder="https://..." className="bg-background border-border text-foreground text-sm" />
            </div>

            {/* Documents */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-foreground text-sm">Documente</Label>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded-md text-sm text-muted-foreground hover:text-primary hover:border-primary/50 cursor-pointer transition-colors">
                  {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadingDoc ? "Se încarcă..." : "Încarcă document"}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => { if (e.target.files?.[0]) handleCertDocUpload(e.target.files[0]); e.target.value = ""; }} disabled={uploadingDoc} />
                </label>
              </div>
              {(certForm.documents || []).map((doc, di) => (
                <div key={di} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-foreground/70 truncate flex-1 font-body">{decodeURIComponent(doc.split("/").pop() || "Document")}</span>
                  <button type="button" onClick={() => removeCertDoc(di)} className="text-destructive hover:text-destructive/80">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCertDialog(false)} className="border-border text-foreground">Anulează</Button>
              <Button onClick={handleSaveCertification} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Salvează
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* === Language Dialog === */}
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
