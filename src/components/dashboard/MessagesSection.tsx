import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, User, Loader2, ArrowLeft, Send } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ConversationItem {
  conversation_id: string;
  other_user_id: string;
  other_name: string;
  other_photo: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

const MessagesSection = () => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const { lang } = useLanguage();

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

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

    const otherUserIds = convs.map((c) =>
      c.user1_id === user.id ? c.user2_id : c.user1_id
    );

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

    const items: ConversationItem[] = [];
    for (const conv of convs) {
      const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
      const profile = profileMap.get(otherUserId);

      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("content, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);

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

  // Realtime: refresh inbox
  useEffect(() => {
    const channel = supabase
      .channel("messages-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          if (!selectedConversation) fetchConversations();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedConversation]);

  // Load chat messages when conversation selected
  useEffect(() => {
    if (!selectedConversation) return;
    const load = async () => {
      setChatLoading(true);
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversation.conversation_id)
        .order("created_at", { ascending: true });

      setMessages((msgs as Message[]) || []);

      // Mark unread as read
      if (msgs && currentUserId) {
        const unread = msgs.filter((m: any) => !m.read && m.sender_id !== currentUserId);
        if (unread.length > 0) {
          await supabase
            .from("messages")
            .update({ read: true })
            .in("id", unread.map((m: any) => m.id));
        }
      }
      setChatLoading(false);
    };
    load();
  }, [selectedConversation, currentUserId]);

  // Realtime for active chat
  useEffect(() => {
    if (!selectedConversation) return;
    const channel = supabase
      .channel(`chat-${selectedConversation.conversation_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversation.conversation_id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.sender_id !== currentUserId) {
            supabase.from("messages").update({ read: true }).eq("id", newMsg.id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedConversation, currentUserId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUserId) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedConversation.conversation_id,
      sender_id: currentUserId,
      content,
    });

    if (error) setNewMessage(content);
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setMessages([]);
    fetchConversations();
  };

  // ---- CHAT VIEW (inline, full area) ----
  if (selectedConversation) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-border shrink-0">
          <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {selectedConversation.other_photo ? (
              <img src={selectedConversation.other_photo} alt={selectedConversation.other_name} className="w-full h-full object-cover" />
            ) : (
              <User className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <h2 className="font-display text-lg text-foreground truncate">{selectedConversation.other_name}</h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
          {chatLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              {lang === "ro" ? "Niciun mesaj încă. Trimite primul mesaj!" : "No messages yet. Send the first message!"}
            </p>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === currentUserId;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString(lang === "ro" ? "ro-RO" : "en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border pt-3 flex gap-2 shrink-0">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={lang === "ro" ? "Scrie un mesaj..." : "Type a message..."}
            className="flex-1"
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon" className="shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  }

  // ---- INBOX VIEW ----
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
    </div>
  );
};

export default MessagesSection;
