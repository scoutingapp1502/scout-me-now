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
import { useLanguage } from "@/i18n/LanguageContext";

const LOCALE_BY_LANG: Record<string, string> = {
  ro: "ro-RO", en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT",
};

const LANGUAGE_CODES = [
  "ro", "en", "fr", "es", "de", "it", "pt", "nl", "ru", "uk", "pl", "cs", "sk",
  "bg", "sr", "hr", "hu", "tr", "ar", "zh", "ja", "ko", "hi", "el", "sv", "no",
  "da", "fi", "ca", "eu", "gl", "he", "fa",
];

function getLanguageNames(locale: string): string[] {
  try {
    const dn = new Intl.DisplayNames([locale], { type: "language" });
    return LANGUAGE_CODES.map((code) => dn.of(code) || code);
  } catch {
    return LANGUAGE_CODES;
  }
}

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
  const { lang, t } = useLanguage();
  const te = t.dashboard.scoutExtra;
  const ALL_LANGUAGES = getLanguageNames(LOCALE_BY_LANG[lang] || "en-US");
  const PROFICIENCY_LEVELS = te.proficiencyLevels;
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

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
    const [certRes, profileRes] = await Promise.all([
      supabase.from("scout_certifications").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
      supabase.from("scout_profiles").select("languages").eq("user_id", userId).maybeSingle(),
    ]);
    if (certRes.data) setCertifications(certRes.data as Certification[]);
    const langs = (profileRes.data as any)?.languages as string[] | null;
    if (langs) setLanguages(langs);
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
      toast({ title: te.certAddedToast });
    } catch (err: any) {
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeleteCertification = async (id: string) => {
    try {
      const { error } = await supabase.from("scout_certifications").delete().eq("id", id);
      if (error) throw error;
      setCertifications(prev => prev.filter(c => c.id !== id));
      notifyProfileUpdated();
      toast({ title: te.certRemovedToast });
    } catch (err: any) {
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: err.message, variant: "destructive" });
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
      toast({ title: te.docUploadedToast });
    } catch (err: any) {
      toast({ title: te.docUploadErrorTitle, description: err.message, variant: "destructive" });
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
    if (!langInput.trim()) { setLangError(te.langRequiredError); return; }
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
      toast({ title: te.langAddedToast });
    } catch (err: any) {
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleRemoveLanguage = async (index: number) => {
    const updated = languages.filter((_, i) => i !== index);
    try {
      const { error } = await supabase.from("scout_profiles").update({ languages: updated } as any).eq("user_id", userId);
      if (error) throw error;
      setLanguages(updated);
      notifyProfileUpdated();
      toast({ title: te.langRemovedToast });
    } catch (err: any) {
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: err.message, variant: "destructive" });
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
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl text-gray-900">{te.certTitle}</h2>
            {!readOnly && <Popover>
              <PopoverTrigger asChild>
                <button className="text-gray-500 hover:text-orange-500 transition-colors" aria-label={te.certTipsAria}>
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" className="w-80 text-sm bg-white border-gray-200">
                <p className="font-semibold text-gray-900 mb-2">{te.certTipsTitle}</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-500">
                  <li>{te.certTip1}</li>
                  <li>{te.certTip2}</li>
                  <li>{te.certTip3}</li>
                  <li>{te.certTip4}</li>
                  <li>{te.certTip5}</li>
                </ul>
              </PopoverContent>
            </Popover>}
          </div>
          {!readOnly && (
            <button onClick={openCertDialog} className="group text-gray-900 hover:text-gray-400 transition-colors p-1" aria-label={te.addCertAria}>
              <Edit2 className="h-4 w-4 stroke-[2.5] group-hover:stroke-[1.5]" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          {certifications.length === 0 && (
            <p className="text-gray-500 italic text-sm font-body">{te.noCertsYet}</p>
          )}
          {certifications.map((cert) => (
            <div key={cert.id} className="flex gap-4 group">
              <div className="flex-shrink-0 mt-1">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <BadgeCheck className="h-6 w-6 text-orange-500" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-body font-semibold text-gray-900">{cert.name || te.certUnspecified}</h3>
                <p className="text-gray-600 font-body text-sm">{cert.issuing_organization}</p>
                <p className="text-gray-500 font-body text-xs mt-0.5">
                  {cert.issue_date && <span>{te.obtainedLabel} {cert.issue_date}</span>}
                  {cert.expiry_date && <span> · {te.expiresLabel} {cert.expiry_date}</span>}
                </p>
                {cert.credential_url && (
                  <a href={cert.credential_url} target="_blank" rel="noopener noreferrer" className="text-orange-500 text-xs hover:underline mt-1 inline-block">
                    {te.verifyCredentialLink}
                  </a>
                )}
                {cert.documents && cert.documents.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {cert.documents.map((doc, di) => (
                      <button key={di} onClick={() => openDocSafely(doc)} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-md text-xs text-gray-600 hover:text-orange-500 transition-colors font-body">
                        <FileText className="h-3.5 w-3.5" />
                        {decodeURIComponent(doc.split("/").pop() || "Document")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!readOnly && cert.id && (
                <button onClick={() => handleDeleteCertification(cert.id!)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-destructive transition-all p-1 self-start">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ===== LIMBI CUNOSCUTE ===== */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl text-gray-900">{te.langTitle}</h2>
            {!readOnly && <Popover>
              <PopoverTrigger asChild>
                <button className="text-gray-500 hover:text-orange-500 transition-colors" aria-label={te.langTipsAria}>
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" className="w-80 text-sm bg-white border-gray-200">
                <p className="font-semibold text-gray-900 mb-2">{te.langTipsTitle}</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-500">
                  <li>{te.langTip1}</li>
                  <li>{te.langTip2}</li>
                  <li>{te.langTip3}</li>
                </ul>
              </PopoverContent>
            </Popover>}
          </div>
          {!readOnly && (
            <button onClick={() => { setLangInput(""); setLangLevel(""); setLangError(""); setLangSuggestions([]); setShowLangDialog(true); }} className="group text-gray-900 hover:text-gray-400 transition-colors p-1" aria-label={t.dashboard.scoutProfile.editAria}>
              <Edit2 className="h-4 w-4 stroke-[2.5] group-hover:stroke-[1.5]" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {languages.length > 0 ? languages.map((langEntry, i) => (
            <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-body">
              <Languages className="h-3.5 w-3.5 text-orange-500" />
              {langEntry}
              {!readOnly && (
                <button onClick={() => handleRemoveLanguage(i)} className="ml-1 hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          )) : (
            <p className="text-gray-500 italic text-sm font-body">{te.noLangsYet}</p>
          )}
        </div>
      </div>

      {/* === Certification Dialog === */}
      <Dialog open={showCertDialog} onOpenChange={setShowCertDialog}>
        <DialogContent className="sm:max-w-md bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900 font-display text-xl">{te.addCertDialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-gray-900 text-sm">{te.nameLabel}</Label>
              <Input value={certForm.name || ""} onChange={e => setCertForm(p => ({ ...p, name: e.target.value }))} placeholder={te.namePlaceholder} className="bg-white border-gray-200 text-gray-900 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-900 text-sm">{te.issuingOrgLabel}</Label>
              <Input value={certForm.issuing_organization || ""} onChange={e => setCertForm(p => ({ ...p, issuing_organization: e.target.value }))} placeholder={te.issuingOrgPlaceholder} className="bg-white border-gray-200 text-gray-900 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-gray-900 text-sm">{te.issueDateLabel}</Label>
                <Input value={certForm.issue_date || ""} onChange={e => setCertForm(p => ({ ...p, issue_date: e.target.value }))} placeholder={te.issueDatePlaceholder} className="bg-white border-gray-200 text-gray-900 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-900 text-sm">{te.expiryDateLabel}</Label>
                <Input value={certForm.expiry_date || ""} onChange={e => setCertForm(p => ({ ...p, expiry_date: e.target.value }))} placeholder={te.expiryDatePlaceholder} className="bg-white border-gray-200 text-gray-900 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-900 text-sm">{te.verificationUrlLabel}</Label>
              <Input value={certForm.credential_url || ""} onChange={e => setCertForm(p => ({ ...p, credential_url: e.target.value }))} placeholder="https://..." className="bg-white border-gray-200 text-gray-900 text-sm" />
            </div>

            {/* Documents */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-gray-900 text-sm">{te.documentsLabel}</Label>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:text-orange-500 hover:border-orange-300 cursor-pointer transition-colors">
                  {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadingDoc ? te.uploadingDocText : te.uploadDocBtn}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => { if (e.target.files?.[0]) handleCertDocUpload(e.target.files[0]); e.target.value = ""; }} disabled={uploadingDoc} />
                </label>
              </div>
              {(certForm.documents || []).map((doc, di) => (
                <div key={di} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  <span className="text-gray-600 truncate flex-1 font-body">{decodeURIComponent(doc.split("/").pop() || "Document")}</span>
                  <button type="button" onClick={() => removeCertDoc(di)} className="text-destructive hover:text-destructive/80">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCertDialog(false)} className="border-gray-200 text-gray-900">{t.dashboard.settings.cancelBtn}</Button>
              <Button onClick={handleSaveCertification} disabled={saving} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {t.dashboard.profile.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* === Language Dialog === */}
      <Dialog open={showLangDialog} onOpenChange={setShowLangDialog}>
        <DialogContent className="sm:max-w-md bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900 font-display text-xl">{te.addLangDialogTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-gray-500 text-sm">{te.addLangDialogDesc}</p>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5 relative">
              <Label className="text-gray-900 text-sm">{te.languageLabel}</Label>
              <Input
                ref={langInputRef}
                value={langInput}
                onChange={e => handleLangInputChange(e.target.value)}
                placeholder={te.searchLanguagePlaceholder}
                className="bg-white border-gray-200 text-gray-900 text-sm"
              />
              {langError && (
                <p className="text-destructive text-xs flex items-center gap-1">
                  <span className="inline-block w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-center text-xs leading-4">⊘</span>
                  {langError}
                </p>
              )}
              {langSuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                  {langSuggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setLangInput(s); setLangSuggestions([]); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-gray-900 text-sm">{te.proficiencyLabel}</Label>
              <Select value={langLevel} onValueChange={setLangLevel}>
                <SelectTrigger className="bg-white border-gray-200 text-gray-900 text-sm">
                  <SelectValue placeholder={te.selectProficiencyPlaceholder} />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  {PROFICIENCY_LEVELS.map(l => (
                    <SelectItem key={l.value} value={l.value} className="text-gray-900">
                      <div>
                        <span className="font-medium">{l.value}</span>
                        <span className="text-gray-500 text-xs ml-2">— {l.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowLangDialog(false)} className="border-gray-200 text-gray-900">{t.dashboard.settings.cancelBtn}</Button>
              <Button onClick={handleAddLanguage} disabled={saving} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {t.dashboard.profile.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScoutExtraSections;
