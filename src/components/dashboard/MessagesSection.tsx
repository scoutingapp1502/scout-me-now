import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, User, Loader2, ArrowLeft, Send, Search, X, Smile, Users, Check, CheckCheck } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePresence } from "@/hooks/usePresence";
import { useToast } from "@/hooks/use-toast";
import PersonalProfile from "@/components/dashboard/PersonalProfile";
import ScoutPersonalProfile from "@/components/dashboard/ScoutPersonalProfile";
import { censorMessageText } from "@/lib/messageModeration";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NewGroupChat from "./NewGroupChat";

interface ConversationItem {
  conversation_id: string;
  other_user_id: string;
  other_name: string;
  other_photo: string | null;
  other_role: string | null;
  last_message: string;
  last_message_at: string;
  last_message_sender_id: string | null;
  last_message_read: boolean;
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

interface GroupMember {
  userId: string;
  name: string;
  photo: string | null;
}

interface GroupItem {
  id: string;
  name: string;
  members: GroupMember[];
  lastMessage: string;
  lastMessageAt: string;
}

interface GroupMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  senderName?: string;
  senderPhoto?: string | null;
}

interface MessagesSectionProps {
  initialChatUserId?: string | null;
  onInitialChatHandled?: () => void;
  onNavigateToChat?: (userId: string) => void;
}

const MessagesSection = ({ initialChatUserId, onInitialChatHandled, onNavigateToChat }: MessagesSectionProps = {}) => {
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
  const [canMessageSelected, setCanMessageSelected] = useState(true);
  const [restrictedByOther, setRestrictedByOther] = useState(false);
  const { toast } = useToast();

  // Group states
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupItem | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupMsgInput, setGroupMsgInput] = useState("");
  const [groupChatLoading, setGroupChatLoading] = useState(false);

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

    // Last message + unread count for every conversation in a single round
    // trip (previously: 2 sequential queries per conversation in a loop).
    const convIds = convs.map((c) => c.id);
    const { data: previews } = await (supabase as any).rpc("get_conversation_previews", {
      p_conversation_ids: convIds,
      p_user_id: user.id,
    });
    const previewMap = new Map<string, any>((previews || []).map((p: any) => [p.conversation_id, p]));

    const items: ConversationItem[] = [];
    for (const conv of convs) {
      const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
      const profile = profileMap.get(otherUserId);
      const preview = previewMap.get(conv.id);
      const draft = localStorage.getItem(`draft-${conv.id}`);

      if (preview && preview.last_content != null) {
        items.push({
          conversation_id: conv.id,
          other_user_id: otherUserId,
          other_name: profile?.name || (lang === "ro" ? "Utilizator necunoscut" : "Unknown user"),
          other_photo: profile?.photo || null,
          other_role: roleMap.get(otherUserId) || null,
          last_message: draft ? `[${lang === "ro" ? "Ciornă" : "Draft"}] ${draft}` : preview.last_content,
          last_message_at: preview.last_created_at,
          last_message_sender_id: draft ? null : preview.last_sender_id,
          last_message_read: preview.last_read,
          unread_count: preview.unread_count || 0,
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
            last_message_sender_id: null,
            last_message_read: false,
            unread_count: 0,
          });
        }
      }
    }

    setConversations(items);
    setLoading(false);
  };

  const fetchGroups = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: myMemberships } = await (supabase as any)
      .from("group_members").select("group_id").eq("user_id", user.id);
    if (!myMemberships?.length) { setGroups([]); return; }

    const groupIds = myMemberships.map((m: any) => m.group_id);

    // Batch everything that was previously fetched per-group in a loop
    // (members, profiles, last message) into a fixed number of queries.
    const [{ data: groupsData }, { data: allMembers }, { data: previews }] = await Promise.all([
      (supabase as any).from("group_conversations").select("id, name, updated_at").in("id", groupIds).order("updated_at", { ascending: false }),
      (supabase as any).from("group_members").select("group_id, user_id").in("group_id", groupIds),
      (supabase as any).rpc("get_group_message_previews", { p_group_ids: groupIds }),
    ]);
    if (!groupsData?.length) { setGroups([]); return; }

    const memberIdsByGroup = new Map<string, string[]>();
    (allMembers ?? []).forEach((m: any) => {
      const arr = memberIdsByGroup.get(m.group_id) ?? [];
      arr.push(m.user_id);
      memberIdsByGroup.set(m.group_id, arr);
    });
    const allMemberIds = [...new Set((allMembers ?? []).map((m: any) => m.user_id))];

    const [{ data: players }, { data: scouts }] = await Promise.all([
      (supabase as any).from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", allMemberIds),
      (supabase as any).from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", allMemberIds),
    ]);
    const pMap = new Map<string, { name: string; photo: string | null }>();
    for (const p of [...(players ?? []), ...(scouts ?? [])]) {
      if (!pMap.has(p.user_id)) pMap.set(p.user_id, { name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), photo: p.photo_url ?? null });
    }

    const previewByGroup = new Map<string, any>((previews ?? []).map((p: any) => [p.group_id, p]));

    const result: GroupItem[] = groupsData.map((g: any) => {
      const memberIds = memberIdsByGroup.get(g.id) ?? [];
      const preview = previewByGroup.get(g.id);
      return {
        id: g.id,
        name: g.name || (lang === "ro" ? "Grup fără nume" : "Unnamed group"),
        members: memberIds.map((uid: string) => ({ userId: uid, name: pMap.get(uid)?.name ?? "", photo: pMap.get(uid)?.photo ?? null })),
        lastMessage: preview?.content ?? (lang === "ro" ? "Grup nou" : "New group"),
        lastMessageAt: preview?.created_at ?? g.updated_at,
      };
    });
    setGroups(result);
  };

  useEffect(() => {
    fetchConversations();
    fetchGroups();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    // messages has no recipient column to filter on directly (only
    // sender_id + conversation_id), so we exclude our own sends and
    // debounce bursts instead of rebuilding the whole inbox on every event.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`messages-inbox-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=neq.${currentUserId}` },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchConversations(), 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

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
      const { data: convId, error } = await supabase.rpc("get_or_create_conversation", {
        other_user_id: initialChatUserId,
      });
      if (!convId) {
        if (error?.message?.includes("FOLLOW_REQUIRED")) {
          toast({ title: lang === "ro" ? "Mesaj indisponibil" : "Messaging unavailable", description: lang === "ro" ? "Poți trimite mesaje doar după ce cererea ta de urmărire este acceptată." : "You can send messages only after your follow request is accepted.", variant: "destructive" });
        }
        onInitialChatHandled?.();
        return;
      }

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
        last_message_sender_id: null,
        last_message_read: false,
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
    // Guards against a stale response overwriting state after the user has
    // already switched to a different conversation (e.g. clicking A then B
    // in quick succession, where A's fetch resolves after B's).
    let cancelled = false;
    const load = async () => {
      setChatLoading(true);
      const { data: allowed } = await supabase.rpc("can_message_user", { _other_user_id: selectedConversation.other_user_id });
      if (cancelled) return;
      setCanMessageSelected(!!allowed);

      // If the other person restricted me, don't show their online status to me.
      const { data: restricted } = await (supabase as any).rpc("am_i_restricted_by", {
        _other_user_id: selectedConversation.other_user_id,
      });
      if (cancelled) return;
      setRestrictedByOther(!!restricted);
      // Always load existing messages so historical conversation is visible,
      // even when the follow relationship no longer permits sending new ones.
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversation.conversation_id)
        .order("created_at", { ascending: true });

      if (cancelled) return;
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
      if (cancelled) return;
      setChatLoading(false);
      // Load draft
      const draft = localStorage.getItem(`draft-${selectedConversation.conversation_id}`);
      if (draft) setNewMessage(draft);
    };
    load();
    return () => { cancelled = true; };
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
    if (!newMessage.trim() || !selectedConversation || !currentUserId || !canMessageSelected) return;
    const content = censorMessageText(newMessage.trim());
    setNewMessage("");
    // Clear draft on send
    localStorage.removeItem(`draft-${selectedConversation.conversation_id}`);

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
      if (error.message?.includes("FOLLOW_REQUIRED")) {
        setCanMessageSelected(false);
        toast({ title: lang === "ro" ? "Mesaj blocat" : "Message blocked", description: lang === "ro" ? "Ai nevoie de o urmărire acceptată pentru a trimite mesaje." : "You need an accepted follow to send messages.", variant: "destructive" });
      }
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
    // Save draft if there's unsent text
    if (selectedConversation && newMessage.trim()) {
      localStorage.setItem(`draft-${selectedConversation.conversation_id}`, newMessage.trim());
    } else if (selectedConversation) {
      localStorage.removeItem(`draft-${selectedConversation.conversation_id}`);
    }
    setSelectedConversation(null);
    setMessages([]);
    setNewMessage("");
    fetchConversations();
  };

  const loadGroupMessages = async (group: GroupItem) => {
    setGroupChatLoading(true);
    const { data: msgs } = await (supabase as any)
      .from("group_messages").select("id, group_id, sender_id, content, created_at").eq("group_id", group.id).order("created_at", { ascending: true });

    const memberMap = new Map(group.members.map(m => [m.userId, m]));
    setGroupMessages((msgs ?? []).map((m: any) => ({
      ...m,
      senderName: memberMap.get(m.sender_id)?.name ?? "",
      senderPhoto: memberMap.get(m.sender_id)?.photo ?? null,
    })));
    setGroupChatLoading(false);
  };

  const handleSendGroupMessage = async () => {
    if (!groupMsgInput.trim() || !selectedGroup || !currentUserId) return;
    const content = censorMessageText(groupMsgInput.trim());
    setGroupMsgInput("");
    const optimisticId = `opt-${Date.now()}`;
    const me = selectedGroup.members.find(m => m.userId === currentUserId);
    setGroupMessages(prev => [...prev, { id: optimisticId, sender_id: currentUserId, content, created_at: new Date().toISOString(), senderName: me?.name ?? "", senderPhoto: me?.photo ?? null }]);
    const { data, error } = await (supabase as any).from("group_messages").insert({ group_id: selectedGroup.id, sender_id: currentUserId, content }).select().single();
    if (error) {
      setGroupMessages(prev => prev.filter(m => m.id !== optimisticId));
      setGroupMsgInput(content);
      toast({ title: lang === "ro" ? "Mesajul nu a putut fi trimis" : "Message could not be sent", variant: "destructive" });
      return;
    }
    setGroupMessages(prev => prev.map(m => m.id === optimisticId ? { ...data, senderName: me?.name ?? "", senderPhoto: me?.photo ?? null } : m));
    await (supabase as any).from("group_conversations").update({ updated_at: new Date().toISOString() }).eq("id", selectedGroup.id);
  };

  // ---- NEW GROUP VIEW ----
  if (showNewGroup) {
    return <NewGroupChat currentUserId={currentUserId!} lang={lang} onBack={() => setShowNewGroup(false)} onCreated={(g) => { setShowNewGroup(false); fetchGroups(); setSelectedGroup(g); loadGroupMessages(g); }} />;
  }

  // ---- GROUP CHAT VIEW ----
  if (selectedGroup) {
    return (
      <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] -mt-4 -mb-4 sm:-mt-8 sm:-mb-8">
        <div className="flex items-center gap-3 pb-3 border-b border-border shrink-0">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedGroup(null); setGroupMessages([]); fetchGroups(); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-base text-foreground truncate">{selectedGroup.name}</p>
            <p className="text-xs text-muted-foreground">{selectedGroup.members.length} {lang === "ro" ? "membri" : "members"}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
          {groupChatLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : groupMessages.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">{lang === "ro" ? "Niciun mesaj încă." : "No messages yet."}</p>
          ) : (
            groupMessages.map(msg => {
              const isMine = msg.sender_id === currentUserId;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                  {!isMine && (
                    <Avatar className="h-7 w-7 shrink-0 mt-1">
                      <AvatarImage src={msg.senderPhoto ?? undefined} />
                      <AvatarFallback className="text-xs">{(msg.senderName || "?")[0]}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-[70%] ${isMine ? "" : ""}`}>
                    {!isMine && <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">{msg.senderName}</p>}
                    <div className={`rounded-2xl px-4 py-2 text-sm ${isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(msg.created_at).toLocaleTimeString(lang === "ro" ? "ro-RO" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t border-border pt-3 shrink-0 flex gap-2">
          <Input value={groupMsgInput} onChange={e => setGroupMsgInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendGroupMessage(); } }} placeholder={lang === "ro" ? "Scrie un mesaj..." : "Type a message..."} className="flex-1" autoFocus />
          <Button onClick={handleSendGroupMessage} disabled={!groupMsgInput.trim()} size="icon"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  }

  // ---- PROFILE VIEW from chat ----
  if (viewProfileUserId) {
    return (
      <div className="space-y-0">
        <Button variant="ghost" size="sm" onClick={() => { setViewProfileUserId(null); setViewProfileRole(null); }} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" />
          {lang === "ro" ? "Înapoi la conversație" : "Back to conversation"}
        </Button>
        {viewProfileRole === "player" ? (
          <PersonalProfile userId={viewProfileUserId} readOnly onNavigateToChat={onNavigateToChat} />
        ) : (
          <ScoutPersonalProfile userId={viewProfileUserId} readOnly onNavigateToChat={onNavigateToChat} />
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
              <span className={`w-2 h-2 rounded-full ${!restrictedByOther && isOnline(selectedConversation.other_user_id) ? "bg-green-500" : "bg-muted-foreground/40"}`} />
              <span className="text-xs text-muted-foreground">
                {!restrictedByOther && isOnline(selectedConversation.other_user_id)
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
              placeholder={canMessageSelected ? (lang === "ro" ? "Scrie un mesaj..." : "Type a message...") : (lang === "ro" ? "Trebuie să ai o urmărire acceptată" : "Accepted follow required")}
              className="flex-1"
              autoFocus
              disabled={!canMessageSelected}
            />
            <Button onClick={handleSend} disabled={!newMessage.trim() || !canMessageSelected} size="icon" className="shrink-0">
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
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-foreground">
          {lang === "ro" ? "Mesaje" : "Messages"}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => setShowNewGroup(true)} title={lang === "ro" ? "Grup nou" : "New group"}>
          <Users className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{lang === "ro" ? "Grupuri" : "Groups"}</p>
          <div className="divide-y divide-border/50">
            {groups.map(g => (
              <div key={g.id} onClick={() => { setSelectedGroup(g); loadGroupMessages(g); }} className="flex items-center gap-3 py-3 px-1 hover:bg-muted/50 cursor-pointer transition-colors">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-display text-foreground truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{g.members.length} {lang === "ro" ? "membri" : "members"} · {g.lastMessage}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={lang === "ro" ? "Caută sau începe o conversație nouă" : "Search or start a new chat"}
          className="pl-10 rounded-full border-0 bg-muted focus-visible:ring-1"
        />
      </div>

      {/* Role filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
        {ROLE_FILTERS.map((f) => {
          const count = f.key === "club" ? 0 : conversations.filter((c) => c.other_role === f.key).length;
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`shrink-0 flex items-center gap-1.5 text-sm font-medium py-1.5 px-4 rounded-full border transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {lang === "ro" ? f.labelRo : f.labelEn}
              {count > 0 && (
                <span className={`text-xs ${isActive ? "text-primary-foreground/80" : "text-muted-foreground/70"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
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
        <div className="divide-y divide-border/50">
          {filteredConversations.map((conv) => (
            <div
              key={conv.conversation_id}
              onClick={() => setSelectedConversation(conv)}
              className="flex items-center gap-3 py-3 px-1 hover:bg-muted/50 cursor-pointer transition-colors"
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
                <div className="flex items-center gap-1 min-w-0">
                  {conv.last_message_sender_id === currentUserId && (
                    conv.last_message_read ? (
                      <CheckCheck className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )
                  )}
                  <p className={`text-xs truncate ${conv.unread_count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    {conv.last_message}
                  </p>
                </div>
              </div>
              {conv.unread_count > 0 && (
                <div className="min-w-5 h-5 px-1 rounded-full bg-primary flex items-center justify-center shrink-0">
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
