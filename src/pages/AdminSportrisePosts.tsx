import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Rocket, ImagePlus, X, Trash2, Send } from "lucide-react";
import { SignedImg } from "@/components/SignedSrc";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface SportrisePost {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

export default function AdminSportrisePosts({ embedded }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [posts, setPosts] = useState<SportrisePost[]>([]);
  const [loading, setLoading] = useState(true);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminUserId(data.user?.id ?? null));
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("sportrise_posts")
      .select("id, content, image_url, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setPosts(data || []);
    setLoading(false);
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

  const handlePublish = async () => {
    if (!content.trim() || !adminUserId) return;
    setPosting(true);
    let imageUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${adminUserId}/${Date.now()}-sportrise.${ext}`;
      const { error: uploadError } = await supabase.storage.from("player-documents").upload(path, imageFile);
      if (uploadError) {
        toast({ title: "Nu s-a putut încărca imaginea.", variant: "destructive" });
        setPosting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("player-documents").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }
    const { error } = await (supabase as any).from("sportrise_posts").insert({
      content: content.trim(),
      image_url: imageUrl,
      created_by: adminUserId,
    });
    setPosting(false);
    if (error) {
      toast({ title: "Eroare la publicare", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Postare SportRise publicată!" });
    setContent("");
    removeImage();
    fetchPosts();
  };

  const handleDelete = async (postId: string) => {
    const { error } = await (supabase as any)
      .from("sportrise_posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", postId);
    if (error) {
      toast({ title: "Eroare la ștergere", variant: "destructive" });
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div className={embedded ? "text-gray-900" : "min-h-screen bg-gray-200 text-gray-900"}>
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        {!embedded && (
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-heading font-bold">🚀 Postări SportRise</h1>
          </div>
        )}
        {embedded && (
          <h1 className="text-2xl font-heading font-bold mb-2 flex items-center gap-2">
            <Rocket className="h-6 w-6" /> Postări SportRise
          </h1>
        )}
        <p className="text-sm text-gray-500 mb-6">
          Aceste postări apar în feed-ul de Activitate al tuturor utilizatorilor, marcate ca oficiale SportRise.
        </p>

        {/* Composer */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3 mb-6">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Scrie o postare explicativă sau un anunț SportRise..."
            rows={4}
          />
          {imagePreview && (
            <div className="relative inline-block">
              <img src={imagePreview} alt="" className="max-h-40 rounded-lg object-cover" />
              <button type="button" onClick={removeImage} className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            <Button type="button" variant="ghost" size="sm" onClick={() => imageInputRef.current?.click()} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
              <ImagePlus className="h-4 w-4 mr-1" />Fotografie
            </Button>
            <Button type="button" size="sm" onClick={handlePublish} disabled={posting || !content.trim()} className="bg-orange-500 hover:bg-orange-600 text-white">
              {posting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Publică
            </Button>
          </div>
        </div>

        {/* Existing list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Nicio postare SportRise publicată încă.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <div key={p.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{p.content}</p>
                    {p.image_url && <SignedImg src={p.image_url} alt="" className="max-h-32 rounded-lg object-cover mt-2" />}
                    <p className="text-[11px] text-gray-400 mt-2">
                      {new Date(p.created_at).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Button type="button" size="icon" variant="destructive" className="h-7 w-7 shrink-0" onClick={() => handleDelete(p.id)} title="Șterge">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
