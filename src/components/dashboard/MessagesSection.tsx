import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, User, Loader2, ArrowLeft, Send, Search, X, Smile } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePresence } from "@/hooks/usePresence";
import PersonalProfile from "@/components/dashboard/PersonalProfile";
import ScoutPersonalProfile from "@/components/dashboard/ScoutPersonalProfile";

interface ConversationItem {
  conversation_id: string;
  other_user_id: string;
  other_name: string;
  other_photo: string | null;
  other_role: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

const getRoleLabel = (role: string | null, lang: string) => {
  if (!role) return "";
  const labels: Record<string, Record<string, string>> = {
    player: { ro: "Jucător", en: "Player" },
    scout: { ro: "Scouter", en: "Scout" },
    agent: { ro: "Agent", en: "Agent" },
  };
  return labels[role]?.[lang] || role;
};

type RoleFilter = "player" | "scout" | "agent" | "club";

const ROLE_FILTERS: { key: RoleFilter; labelRo: string; labelEn: string }[] = [
  { key: "player", labelRo: "Jucători", labelEn: "Players" },
  { key: "scout", labelRo: "Scouteri", labelEn: "Scouts" },
  { key: "agent", labelRo: "Agenți", labelEn: "Agents" },
  { key: "club", labelRo: "Cluburi", labelEn: "Clubs" },
];

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

interface MessagesSectionProps {
  initialChatUserId?: string | null;
  onInitialChatHandled?: () => void;
}

const MessagesSection = ({ initialChatUserId, onInitialChatHandled }: MessagesSectionProps = {}) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const { lang } = useLanguage();

  // Filter state
  const [activeFilter, setActiveFilter] = useState<RoleFilter>("player");
  const [searchQuery, setSearchQuery] = useState("");

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const { isOnline } = usePresence(currentUserId);
  const [photoModal, setPhotoModal] = useState<{ url: string; name: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [viewProfileRole, setViewProfileRole] = useState<string | null>(null);

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

    const [playerRes, scoutRes, rolesRes] = await Promise.all([
      supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", otherUserIds),
      supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", otherUserIds),
      supabase.from("user_roles").select("user_id, role").in("user_id", otherUserIds),
    ]);

    const roleMap = new Map<string, string>();
    (rolesRes.data || []).forEach((r: any) => { roleMap.set(r.user_id, r.role); });

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

      const draft = localStorage.getItem(`draft-${conv.id}`);

      if (lastMsgs && lastMsgs.length > 0) {
        items.push({
          conversation_id: conv.id,
          other_user_id: otherUserId,
          other_name: profile?.name || (lang === "ro" ? "Utilizator necunoscut" : "Unknown user"),
          other_photo: profile?.photo || null,
          other_role: roleMap.get(otherUserId) || null,
          last_message: draft ? `[${lang === "ro" ? "Ciornă" : "Draft"}] ${draft}` : lastMsgs[0].content,
          last_message_at: lastMsgs[0].created_at,
          unread_count: count || 0,
        });
      } else {
        // Empty conversation — show if created within 24h or has draft
        const createdAt = new Date(conv.created_at).getTime();
        const isRecent = Date.now() - createdAt < 24 * 60 * 60 * 1000;
        if (isRecent || draft) {
          items.push({
            conversation_id: conv.id,
            other_user_id: otherUserId,
            other_name: profile?.name || (lang === "ro" ? "Utilizator necunoscut" : "Unknown user"),
            other_photo: profile?.photo || null,
            other_role: roleMap.get(otherUserId) || null,
            last_message: draft ? `[${lang === "ro" ? "Ciornă" : "Draft"}] ${draft}` : (lang === "ro" ? "Conversație nouă" : "New conversation"),
            last_message_at: conv.created_at,
            unread_count: 0,
          });
        }
      }
    }

    setConversations(items);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();
  }, []);

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

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Auto-open chat when initialChatUserId is provided
  useEffect(() => {
    if (!initialChatUserId || !currentUserId || loading) return;

    // Check if we already have a conversation with this user
    const existing = conversations.find(c => c.other_user_id === initialChatUserId);
    if (existing) {
      setSelectedConversation(existing);
      onInitialChatHandled?.();
      return;
    }

    // Create conversation and open it
    const openChat = async () => {
      const { data: convId } = await supabase.rpc("get_or_create_conversation", {
        other_user_id: initialChatUserId,
      });
      if (!convId) return;

      // Fetch profile info for the other user
      const [playerRes, scoutRes, roleRes] = await Promise.all([
        supabase.from("player_profiles").select("first_name, last_name, photo_url").eq("user_id", initialChatUserId).maybeSingle(),
        supabase.from("scout_profiles").select("first_name, last_name, photo_url").eq("user_id", initialChatUserId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", initialChatUserId).maybeSingle(),
      ]);

      const p = playerRes.data || scoutRes.data;
      const newConv: ConversationItem = {
        conversation_id: convId,
        other_user_id: initialChatUserId,
        other_name: p ? `${p.first_name} ${p.last_name}`.trim() : "Unknown",
        other_photo: p?.photo_url || null,
        other_role: roleRes.data?.role || null,
        last_message: lang === "ro" ? "Conversație nouă" : "New conversation",
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      };

      setConversations(prev => [newConv, ...prev.filter(c => c.conversation_id !== convId)]);
      setSelectedConversation(newConv);
      onInitialChatHandled?.();
    };

    openChat();
  }, [initialChatUserId, currentUserId, loading]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    // Filter by role
    if (activeFilter === "club") {
      filtered = []; // No club role yet
    } else {
      filtered = filtered.filter((c) => c.other_role === activeFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((c) => c.other_name.toLowerCase().includes(q));
    }

    return filtered;
  }, [conversations, activeFilter, searchQuery]);

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

  useEffect(() => {
    if (!selectedConversation) return;
    const channel = supabase
      .channel(`chat-${selectedConversation.conversation_id}-${Date.now()}`)
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
            // Skip if already present (real id) or replace optimistic with same content from same sender
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            // If it's our own message, it was already added optimistically - skip realtime duplicate
            if (newMsg.sender_id === currentUserId) {
              const hasOptimistic = prev.some((m) => m.id.startsWith("optimistic-") && m.content === newMsg.content);
              if (hasOptimistic) return prev;
            }
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    chatInputRef.current?.focus();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUserId) return;
    const content = newMessage.trim();
    setNewMessage("");

    // Optimistic: add message instantly
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      read: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { data, error } = await supabase.from("messages").insert({
      conversation_id: selectedConversation.conversation_id,
      sender_id: currentUserId,
      content,
    }).select().single();

    if (error) {
      // Remove optimistic message on error, restore input
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setNewMessage(content);
    } else if (data) {
      // Replace optimistic with real message
      setMessages((prev) => prev.map((m) => m.id === optimisticId ? (data as Message) : m));
    }
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

  // ---- PROFILE VIEW from chat ----
  if (viewProfileUserId) {
    return (
      <div className="space-y-0">
        <Button variant="ghost" size="sm" onClick={() => { setViewProfileUserId(null); setViewProfileRole(null); }} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" />
          {lang === "ro" ? "Înapoi la conversație" : "Back to conversation"}
        </Button>
        {viewProfileRole === "player" ? (
          <PersonalProfile userId={viewProfileUserId} readOnly />
        ) : (
          <ScoutPersonalProfile userId={viewProfileUserId} readOnly />
        )}
      </div>
    );
  }

  // ---- CHAT VIEW ----
  if (selectedConversation) {
    const openPhotoModal = () => {
      if (selectedConversation.other_photo) {
        setPhotoModal({ url: selectedConversation.other_photo, name: selectedConversation.other_name });
      }
    };

    const openProfile = () => {
      setViewProfileUserId(selectedConversation.other_user_id);
      setViewProfileRole(selectedConversation.other_role);
    };

    return (
      <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] -mt-4 -mb-4 sm:-mt-8 sm:-mb-8">
        {/* Photo modal */}
        {photoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setPhotoModal(null)}>
            <div className="relative max-w-lg max-h-[80vh] w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" onClick={() => setPhotoModal(null)} className="absolute -top-10 right-0 text-white hover:text-white/80">
                <X className="h-5 w-5" />
              </Button>
              <img src={photoModal.url} alt={photoModal.name} className="w-full h-auto rounded-xl object-contain max-h-[80vh]" />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pb-3 border-b border-border shrink-0">
          <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div
            className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 ${selectedConversation.other_photo ? "cursor-pointer hover:ring-2 hover:ring-primary" : ""}`}
            onClick={openPhotoModal}
          >
            {selectedConversation.other_photo ? (
              <img src={selectedConversation.other_photo} alt={selectedConversation.other_name} className="w-full h-full object-cover" />
            ) : (
              <User className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col">
            <h2
              className="font-display text-lg text-foreground truncate cursor-pointer hover:text-primary transition-colors"
              onClick={openProfile}
            >
              {selectedConversation.other_name}
            </h2>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isOnline(selectedConversation.other_user_id) ? "bg-green-500" : "bg-muted-foreground/40"}`} />
              <span className="text-xs text-muted-foreground">
                {isOnline(selectedConversation.other_user_id)
                  ? "Online"
                  : "Offline"}
              </span>
              {selectedConversation.other_role && (
                <span className="text-xs text-muted-foreground ml-1">· {getRoleLabel(selectedConversation.other_role, lang)}</span>
              )}
            </div>
          </div>
        </div>

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

        <div className="border-t border-border pt-3 shrink-0">
          {/* Emoji picker */}
          {showEmojiPicker && (
            <div className="mb-2 p-2 bg-card border border-border rounded-lg flex flex-wrap gap-1 max-h-36 overflow-y-auto">
              {["😀","😂","😍","🥰","😎","🤩","😢","😡","🔥","❤️","👍","👎","👏","🙌","💪","⚽","🏀","🏆","🥇","🎯","✅","❌","💬","🎉","🤝","👋","🙏","💯","⭐","🚀","😊","🤔","😅","🥺","😏","🤣","😘","😁","🫡","🤗","😤","💀","🫶","👀","🤞","✌️","🫰","💥","💫","🎶"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="text-xl hover:bg-muted rounded p-1 transition-colors"
                  onClick={() => {
                    setNewMessage((prev) => prev + emoji);
                    chatInputRef.current?.focus();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="shrink-0"
            >
              <Smile className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Input
              ref={chatInputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={lang === "ro" ? "Scrie un mesaj..." : "Type a message..."}
              className="flex-1"
              autoFocus
            />
            <Button onClick={handleSend} disabled={!newMessage.trim()} size="icon" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
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

      {/* Role filter tabs */}
      <div className="flex rounded-lg bg-muted p-1 gap-1">
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`flex-1 text-xs sm:text-sm font-medium py-2 px-2 rounded-md transition-colors ${
              activeFilter === f.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {lang === "ro" ? f.labelRo : f.labelEn}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={lang === "ro" ? "Caută după nume..." : "Search by name..."}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-body">
            {lang === "ro" ? "Niciun mesaj în această categorie." : "No messages in this category."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map((conv) => (
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
                  <div className="flex items-center gap-2 min-w-0">
                    <p className={`text-sm font-display truncate ${conv.unread_count > 0 ? "text-foreground font-bold" : "text-foreground"}`}>
                      {conv.other_name}
                    </p>
                    {conv.other_role && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                        {getRoleLabel(conv.other_role, lang)}
                      </span>
                    )}
                  </div>
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
