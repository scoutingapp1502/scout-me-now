import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface DeletedPost {
  id: string;
  table: "posts" | "scout_posts";
  content: string;
  image_url: string | null;
  deleted_at: string;
}

interface RecentlyDeletedSectionProps {
  userId: string;
  onBack: () => void;
}

const RETENTION_DAYS = 30;

function daysLeft(deletedAt: string): number {
  const expiresAt = new Date(deletedAt).getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default function RecentlyDeletedSection({ userId, onBack }: RecentlyDeletedSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [items, setItems] = useState<DeletedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    await (supabase as any).rpc("purge_expired_deleted_posts").catch((err: unknown) => console.error("Purge failed:", err));

    const [{ data: posts }, { data: scoutPosts }] = await Promise.all([
      (supabase as any)
        .from("posts")
        .select("id, content, image_url, deleted_at")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      (supabase as any)
        .from("scout_posts")
        .select("id, content, image_url, deleted_at")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
    ]);

    const combined: DeletedPost[] = [
      ...(posts || []).map((p: any) => ({ ...p, table: "posts" as const })),
      ...(scoutPosts || []).map((p: any) => ({ ...p, table: "scout_posts" as const })),
    ].sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

    setItems(combined);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleRestore = async (item: DeletedPost) => {
    setBusyId(item.id);
    const { error } = await (supabase as any).from(item.table).update({ deleted_at: null }).eq("id", item.id);
    setBusyId(null);
    if (error) {
      toast({ title: lang === "ro" ? "Eroare la restaurare." : "Restore failed.", variant: "destructive" });
      return;
    }
    setItems(prev => prev.filter(i => i.id !== item.id));
    toast({ title: lang === "ro" ? "Postare restaurată." : "Post restored." });
  };

  const handleDeleteForever = async (item: DeletedPost) => {
    setBusyId(item.id);
    const { error } = await supabase.from(item.table).delete().eq("id", item.id);
    setBusyId(null);
    if (error) {
      toast({ title: lang === "ro" ? "Eroare la ștergere." : "Delete failed.", variant: "destructive" });
      return;
    }
    setItems(prev => prev.filter(i => i.id !== item.id));
    toast({ title: lang === "ro" ? "Postare ștearsă definitiv." : "Post permanently deleted." });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Șters recent" : "Recently deleted"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="text-xs text-muted-foreground font-body px-5 pt-4 pb-2 leading-relaxed">
          {lang === "ro"
            ? `Postările sunt păstrate aici ${RETENTION_DAYS} de zile, apoi sunt șterse definitiv.`
            : `Posts stay here for ${RETENTION_DAYS} days, then they're permanently deleted.`}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-8 text-center">
            <Trash2 className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground font-body">
              {lang === "ro" ? "Nimic șters recent" : "Nothing recently deleted"}
            </p>
            <p className="text-xs text-muted-foreground font-body">
              {lang === "ro" ? "Postările șterse vor apărea aici." : "Deleted posts will appear here."}
            </p>
          </div>
        ) : (
          <div className="px-4 py-2 space-y-3">
            {items.map(item => (
              <div key={`${item.table}-${item.id}`} className="flex items-center gap-3 bg-card border border-border rounded-lg p-3">
                <div className="w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <p className="text-[10px] text-muted-foreground font-body text-center line-clamp-3 px-1">{item.content}</p>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-body truncate">{item.content || (lang === "ro" ? "Postare" : "Post")}</p>
                  <p className="text-xs text-muted-foreground font-body">
                    {lang === "ro" ? `${daysLeft(item.deleted_at)} zile rămase` : `${daysLeft(item.deleted_at)} days left`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    disabled={busyId === item.id}
                    onClick={() => handleRestore(item)}
                    className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    aria-label={lang === "ro" ? "Restaurează" : "Restore"}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    disabled={busyId === item.id}
                    onClick={() => handleDeleteForever(item)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    aria-label={lang === "ro" ? "Șterge definitiv" : "Delete forever"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
