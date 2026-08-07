import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Trash2, RotateCcw, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import PostCard from "./PostCard";

interface DeletedPost {
  id: string;
  table: "posts" | "scout_posts";
  user_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  post_type: string;
  created_at: string;
  deleted_at: string;
  comments_disabled: boolean;
  authorName: string;
  authorPhoto: string | null;
  authorRole: string;
}

interface RecentlyDeletedSectionProps {
  userId: string;
  onBack: () => void;
  onViewProfile: (userId: string, role: string) => void;
}

const RETENTION_DAYS = 30;

function daysLeft(deletedAt: string): number {
  const expiresAt = new Date(deletedAt).getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default function RecentlyDeletedSection({ userId, onBack, onViewProfile }: RecentlyDeletedSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [items, setItems] = useState<DeletedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<DeletedPost | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { error: purgeError } = await (supabase as any).rpc("purge_expired_deleted_posts");
    if (purgeError) console.error("Purge failed:", purgeError);

    const [{ data: posts }, { data: scoutPosts }, { data: player }, { data: scout }, { data: roleRow }] = await Promise.all([
      (supabase as any)
        .from("posts")
        .select("id, user_id, content, image_url, video_url, post_type, created_at, deleted_at, comments_disabled")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      (supabase as any)
        .from("scout_posts")
        .select("id, user_id, content, image_url, created_at, deleted_at")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase.from("player_profiles").select("first_name, last_name, photo_url").eq("user_id", userId).maybeSingle(),
      supabase.from("scout_profiles").select("first_name, last_name, photo_url").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);

    const authorName = player ? `${player.first_name} ${player.last_name}`.trim() : scout ? `${scout.first_name} ${scout.last_name}`.trim() : "";
    const authorPhoto = player?.photo_url ?? scout?.photo_url ?? null;
    const authorRole = roleRow?.role || "player";

    const combined: DeletedPost[] = [
      ...(posts || []).map((p: any) => ({ ...p, table: "posts" as const, video_url: p.video_url ?? null, post_type: p.post_type ?? "general", comments_disabled: p.comments_disabled ?? false, authorName, authorPhoto, authorRole })),
      ...(scoutPosts || []).map((p: any) => ({ ...p, table: "scout_posts" as const, video_url: null, post_type: "general", comments_disabled: false, authorName, authorPhoto, authorRole })),
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
    setSelectedItem(null);
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
    setSelectedItem(null);
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
          <div className="grid grid-cols-3 gap-0.5">
            {items.map(item => (
              <button
                key={`${item.table}-${item.id}`}
                onClick={() => setSelectedItem(item)}
                className="aspect-square overflow-hidden bg-muted relative"
              >
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                ) : item.video_url ? (
                  <div className="w-full h-full bg-muted/60 flex items-center justify-center"><Video className="h-6 w-6 text-white/80" /></div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-2 bg-muted/40">
                    <p className="text-[10px] text-muted-foreground font-body text-center line-clamp-4">{item.content}</p>
                  </div>
                )}
                {item.authorPhoto && (
                  <div className="absolute bottom-1 left-1 w-5 h-5 rounded-full overflow-hidden border border-white/30">
                    <img src={item.authorPhoto} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-white text-[9px] font-body">
                  {lang === "ro" ? `${daysLeft(item.deleted_at)}z` : `${daysLeft(item.deleted_at)}d`}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <Dialog open={!!selectedItem} onOpenChange={(open) => { if (!open) setSelectedItem(null); }}>
          <DialogContent className="max-w-sm p-0 overflow-hidden">
            <DialogTitle className="sr-only">{lang === "ro" ? "Postare ștearsă" : "Deleted post"}</DialogTitle>
            <div className="flex items-center justify-center gap-8 px-4 py-3 border-b border-border shrink-0">
              <button
                disabled={busyId === selectedItem.id}
                onClick={() => handleRestore(selectedItem)}
                className="p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-50"
                aria-label={lang === "ro" ? "Restaurează" : "Restore"}
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <button
                disabled={busyId === selectedItem.id}
                onClick={() => handleDeleteForever(selectedItem)}
                className="p-2 rounded-full hover:bg-muted text-destructive transition-colors disabled:opacity-50"
                aria-label={lang === "ro" ? "Șterge definitiv" : "Delete forever"}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[75vh]">
              <PostCard
                post={{
                  id: selectedItem.id, user_id: selectedItem.user_id, content: selectedItem.content,
                  image_url: selectedItem.image_url, video_url: selectedItem.video_url,
                  post_type: selectedItem.post_type, created_at: selectedItem.created_at, comments_disabled: selectedItem.comments_disabled,
                }}
                author={{ user_id: selectedItem.user_id, name: selectedItem.authorName, photo: selectedItem.authorPhoto, role: selectedItem.authorRole, title: "" }}
                currentUserId={userId}
                onDelete={() => handleDeleteForever(selectedItem)}
                onViewProfile={(uid, role) => { setSelectedItem(null); onViewProfile(uid, role); }}
                hideMenu
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
