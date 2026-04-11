import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, User, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import MessageDialog from "./MessageDialog";

interface ConversationItem {
  conversation_id: string;
  other_user_id: string;
  other_name: string;
  other_photo: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

const MessagesSection = () => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const { lang } = useLanguage();

  const fetchConversations = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get all conversations for the user
    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (!convs || convs.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Get other user IDs
    const otherUserIds = convs.map((c) =>
      c.user1_id === user.id ? c.user2_id : c.user1_id
    );

    // Fetch profiles for all other users (both player and scout profiles)
    const [playerRes, scoutRes] = await Promise.all([
      supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", otherUserIds),
      supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", otherUserIds),
    ]);

    const profileMap = new Map<string, { name: string; photo: string | null }>();
    (playerRes.data || []).forEach((p) => {
      profileMap.set(p.user_id, { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url });
    });
    (scoutRes.data || []).forEach((s) => {
      if (!profileMap.has(s.user_id)) {
        profileMap.set(s.user_id, { name: `${s.first_name} ${s.last_name}`.trim(), photo: s.photo_url });
      }
    });

    // Get last message and unread count for each conversation
    const items: ConversationItem[] = [];
    for (const conv of convs) {
      const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
      const profile = profileMap.get(otherUserId);

      // Last message
      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("content, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);

      // Unread count
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .eq("read", false)
        .neq("sender_id", user.id);

      if (lastMsgs && lastMsgs.length > 0) {
        items.push({
          conversation_id: conv.id,
          other_user_id: otherUserId,
          other_name: profile?.name || (lang === "ro" ? "Utilizator necunoscut" : "Unknown user"),
          other_photo: profile?.photo || null,
          last_message: lastMsgs[0].content,
          last_message_at: lastMsgs[0].created_at,
          unread_count: count || 0,
        });
      }
    }

    setConversations(items);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Realtime: refresh when new messages arrive
  useEffect(() => {
    const channel = supabase
      .channel("messages-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl text-foreground">
        {lang === "ro" ? "Mesaje" : "Messages"}
      </h2>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-body">
            {lang === "ro" ? "Niciun mesaj încă." : "No messages yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.conversation_id}
              onClick={() => setSelectedConversation(conv)}
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/50 cursor-pointer transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {conv.other_photo ? (
                  <img src={conv.other_photo} alt={conv.other_name} className="w-full h-full object-cover" />
                ) : (
                  <User className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-display truncate ${conv.unread_count > 0 ? "text-foreground font-bold" : "text-foreground"}`}>
                    {conv.other_name}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {new Date(conv.last_message_at).toLocaleDateString(lang === "ro" ? "ro-RO" : "en-US", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <p className={`text-xs truncate ${conv.unread_count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                  {conv.last_message}
                </p>
              </div>
              {conv.unread_count > 0 && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="text-[10px] text-primary-foreground font-bold">{conv.unread_count}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedConversation && (
        <MessageDialog
          open={!!selectedConversation}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedConversation(null);
              fetchConversations();
            }
          }}
          recipientUserId={selectedConversation.other_user_id}
          recipientName={selectedConversation.other_name}
        />
      )}
    </div>
  );
};

export default MessagesSection;
