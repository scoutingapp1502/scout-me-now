import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAnnouncements, type Announcement, type AnnouncementTranslation } from "@/hooks/useAnnouncements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit2, Loader2, Megaphone, X, ImagePlus, Video, Paperclip, FileText } from "lucide-react";
import { SignedImg, SignedVideo, SignedLink } from "@/components/SignedSrc";
import type { Language } from "@/i18n/translations";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const TRANSLATABLE_LANGS: { code: Language; label: string }[] = [
  { code: "en", label: "EN" },
];

const getFileName = (url: string) => {
  try {
    const raw = decodeURIComponent(url.split("/").pop() || "");
    return raw.replace(/^\d+-[a-z0-9]+\./, "") || raw;
  } catch {
    return "Document";
  }
};

export default function AdminAnnouncements({ embedded }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { announcements, loading, createAnnouncement, updateAnnouncement, removeAnnouncement } = useAnnouncements(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [translations, setTranslations] = useState<Record<string, AnnouncementTranslation>>({});
  const [activeLangTab, setActiveLangTab] = useState<"ro" | Language>("ro");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminUserId(data.user?.id ?? null));
  }, []);

  const startEdit = (a: Announcement) => {
    setEditing(a);
    setTitle(a.title);
    setContent(a.content);
    setTranslations(a.translations || {});
    setActiveLangTab("ro");
    setImageFile(null);
    setImagePreview(a.image_url);
    setVideoFile(null);
    setVideoPreview(a.video_url);
    setDocumentUrls(a.document_urls || []);
  };

  const cancelEdit = () => {
    setEditing(null);
    setTitle("");
    setContent("");
    setTranslations({});
    setActiveLangTab("ro");
    setImageFile(null);
    setImagePreview(null);
    setVideoFile(null);
    setVideoPreview(null);
    setDocumentUrls([]);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const updateTranslation = (lang: Language, field: "title" | "content", value: string) => {
    setTranslations((prev) => ({
      ...prev,
      [lang]: { title: prev[lang]?.title || "", content: prev[lang]?.content || "", [field]: value },
    }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Format nesuportat. Folosește JPG, PNG, WebP sau GIF.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Imaginea trebuie să fie sub 10MB.", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      toast({ title: "Format nesuportat. Folosește MP4, WebM, OGG sau MOV.", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Videoclipul trebuie să fie sub 50MB.", variant: "destructive" });
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adminUserId) return;
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      toast({ title: "Format nesuportat. Folosește PDF, JPG, PNG sau WebP.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Fișierul trebuie să fie sub 10MB.", variant: "destructive" });
      return;
    }
    setUploadingDoc(true);
    const ext = file.name.split(".").pop();
    const path = `${adminUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("player-documents").upload(path, file);
    setUploadingDoc(false);
    if (error) {
      toast({ title: "Nu s-a putut încărca documentul.", variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("player-documents").getPublicUrl(path);
    setDocumentUrls((prev) => [...prev, urlData.publicUrl]);
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const removeDocument = (index: number) => {
    setDocumentUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const trimmedEnTitle = translations.en?.title?.trim() || "";
    const trimmedEnContent = translations.en?.content?.trim() || "";
    if (!trimmedTitle || !trimmedContent) {
      toast({ title: "Titlul și conținutul sunt obligatorii (RO)", variant: "destructive" });
      setActiveLangTab("ro");
      return;
    }
    if (!trimmedEnTitle || !trimmedEnContent) {
      toast({ title: "Titlul și conținutul sunt obligatorii (EN)", variant: "destructive" });
      setActiveLangTab("en");
      return;
    }
    if (!adminUserId) return;

    setSaving(true);

    let imageUrl = editing ? editing.image_url : null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${adminUserId}/${Date.now()}-announcement.${ext}`;
      const { error } = await supabase.storage.from("player-documents").upload(path, imageFile);
      if (error) {
        toast({ title: "Nu s-a putut încărca imaginea.", variant: "destructive" });
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("player-documents").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    } else if (imagePreview === null) {
      imageUrl = null;
    }

    let videoUrl = editing ? editing.video_url : null;
    if (videoFile) {
      const ext = videoFile.name.split(".").pop();
      const path = `${adminUserId}/${Date.now()}-announcement-video.${ext}`;
      const { error } = await supabase.storage.from("player-videos").upload(path, videoFile);
      if (error) {
        toast({ title: "Nu s-a putut încărca videoclipul.", variant: "destructive" });
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("player-videos").getPublicUrl(path);
      videoUrl = urlData.publicUrl;
    } else if (videoPreview === null) {
      videoUrl = null;
    }

    const cleanedTranslations: Record<string, AnnouncementTranslation> = {};
    for (const { code } of TRANSLATABLE_LANGS) {
      const tr = translations[code];
      const trTitle = tr?.title?.trim() || "";
      const trContent = tr?.content?.trim() || "";
      if (trTitle || trContent) cleanedTranslations[code] = { title: trTitle, content: trContent };
    }

    const fields = { title: trimmedTitle, content: trimmedContent, translations: cleanedTranslations, image_url: imageUrl, video_url: videoUrl, document_urls: documentUrls };
    const { error } = editing
      ? await updateAnnouncement(editing.id, fields)
      : await createAnnouncement(fields, adminUserId);

    setSaving(false);
    if (error) {
      toast({ title: "Eroare la salvare", variant: "destructive" });
    } else {
      toast({ title: editing ? "Anunț actualizat!" : "Anunț publicat!" });
      cancelEdit();
    }
  };

  const handleToggleActive = async (a: Announcement) => {
    const { error } = await updateAnnouncement(a.id, { is_active: !a.is_active });
    if (error) toast({ title: "Eroare la salvare", variant: "destructive" });
  };

  const handleRemove = async (id: string) => {
    const { error } = await removeAnnouncement(id);
    if (error) {
      toast({ title: "Eroare la ștergere", variant: "destructive" });
    } else {
      toast({ title: "Anunț șters." });
      if (editing?.id === id) cancelEdit();
    }
  };

  return (
    <div className={embedded ? "text-gray-900" : "min-h-screen bg-gray-200 text-gray-900"}>
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        {embedded && (
          <h1 className="text-2xl font-heading font-bold mb-2 flex items-center gap-2">
            <Megaphone className="h-6 w-6" /> Știri și Anunțuri
          </h1>
        )}
        <p className="text-sm text-gray-500 mb-6">
          Anunțurile active apar în panoul „Știri și anunțuri" din paginile Activitate și Postări ale utilizatorilor.
        </p>

        {/* Add new / Edit existing */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3 mb-6">
          {editing && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-500 uppercase tracking-wider">Editează anunț</span>
              <button type="button" onClick={cancelEdit} className="text-gray-500 hover:text-gray-900 transition-colors" title="Anulează">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1 flex-wrap border-b border-gray-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveLangTab("ro")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${activeLangTab === "ro" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900"}`}
            >
              RO
            </button>
            {TRANSLATABLE_LANGS.map(({ code, label }) => {
              const hasContent = !!(translations[code]?.title?.trim() || translations[code]?.content?.trim());
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setActiveLangTab(code)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${activeLangTab === code ? "bg-orange-500 text-white" : hasContent ? "bg-green-100 text-green-700 hover:text-green-900" : "bg-gray-100 text-gray-500 hover:text-gray-900"}`}
                >
                  {label}
                </button>
              );
            })}
            <span className="text-[11px] text-gray-400 ml-auto">
              Obligatoriu
            </span>
          </div>
          {activeLangTab === "ro" ? (
            <>
              <Input
                placeholder="Titlu anunț"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Conținut anunț"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
              />
            </>
          ) : (
            <>
              <Input
                placeholder={`Titlu (${activeLangTab.toUpperCase()})`}
                value={translations[activeLangTab]?.title || ""}
                onChange={(e) => updateTranslation(activeLangTab, "title", e.target.value)}
              />
              <Textarea
                placeholder={`Conținut (${activeLangTab.toUpperCase()})`}
                value={translations[activeLangTab]?.content || ""}
                onChange={(e) => updateTranslation(activeLangTab, "content", e.target.value)}
                rows={4}
              />
            </>
          )}

          {imagePreview && (
            <div className="relative inline-block">
              <img src={imagePreview} alt="" className="max-h-40 rounded-lg object-cover" />
              <button type="button" onClick={removeImage} className="absolute top-1 right-1 bg-black/60 rounded-full p-1"><X className="h-3 w-3 text-white" /></button>
            </div>
          )}
          {videoPreview && (
            <div className="relative inline-block">
              <video src={videoPreview} className="max-h-40 rounded-lg" controls />
              <button type="button" onClick={removeVideo} className="absolute top-1 right-1 bg-black/60 rounded-full p-1"><X className="h-3 w-3 text-white" /></button>
            </div>
          )}
          {documentUrls.length > 0 && (
            <div className="space-y-1.5">
              {documentUrls.map((url, i) => (
                <div key={url} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
                  <FileText className="h-4 w-4 text-orange-500 shrink-0" />
                  <span className="text-xs text-gray-700 truncate flex-1">{getFileName(url)}</span>
                  <button type="button" onClick={() => removeDocument(i)} className="text-gray-500 hover:text-destructive shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
            <input ref={docInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleDocumentSelect} />
            <Button type="button" variant="ghost" size="sm" onClick={() => imageInputRef.current?.click()} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
              <ImagePlus className="h-4 w-4 mr-1" />Fotografie
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => videoInputRef.current?.click()} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
              <Video className="h-4 w-4 mr-1" />Videoclip
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={uploadingDoc} onClick={() => docInputRef.current?.click()} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
              {uploadingDoc ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Paperclip className="h-4 w-4 mr-1" />}Document
            </Button>
          </div>

          <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            {editing ? "Salvează modificările" : "Publică anunțul"}
          </Button>
        </div>

        {/* Existing list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : announcements.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Niciun anunț publicat încă.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{a.title}</p>
                    <p className="text-sm text-gray-500 whitespace-pre-wrap mt-1">{a.content}</p>
                    {a.image_url && <SignedImg src={a.image_url} alt="" className="max-h-32 rounded-lg object-cover mt-2" />}
                    {a.video_url && <SignedVideo src={a.video_url} className="max-h-32 rounded-lg mt-2" controls />}
                    {a.document_urls?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {a.document_urls.map((url) => (
                          <SignedLink key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-orange-600 hover:underline bg-gray-100 rounded-full px-2 py-1">
                            <FileText className="h-3 w-3" />{getFileName(url)}
                          </SignedLink>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 mt-2">
                      {new Date(a.created_at).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => startEdit(a)} title="Editează">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="destructive" className="h-7 w-7" onClick={() => handleRemove(a.id)} title="Șterge">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <Switch checked={a.is_active} onCheckedChange={() => handleToggleActive(a)} />
                  <span className="text-xs text-gray-500">{a.is_active ? "Activ (vizibil utilizatorilor)" : "Inactiv (ascuns)"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
