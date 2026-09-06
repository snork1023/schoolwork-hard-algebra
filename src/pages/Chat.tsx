import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import ChatSidebar from "@/components/chat/ChatSidebar";
import CreateConversationDialog from "@/components/chat/CreateConversationDialog";
import RenameConversationDialog from "@/components/chat/RenameConversationDialog";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ReadReceipts from "@/components/chat/ReadReceipts";
import MessageActions from "@/components/chat/MessageActions";
import { MessageReactions } from "@/components/chat/MessageReactions";
import { FileUpload } from "@/components/chat/FileUpload";
import { VoiceRecorderInline } from "@/components/chat/VoiceRecorder";
import { ImagePreviewDialog } from "@/components/chat/ImagePreviewDialog";
import { AttachmentRenderer } from "@/components/chat/AttachmentRenderer";
import { CreatePollDialog } from "@/components/chat/CreatePollDialog";
import { PollCard } from "@/components/chat/PollCard";
import { ProfileViewDialog } from "@/components/chat/ProfileViewDialog";
import { useAutoIdle } from "@/hooks/useAutoIdle";
import { Send, FileText, Loader2, MessageSquare, Users } from "lucide-react";
import { getUserFriendlyError } from "@/lib/error-utils";
type Attachment = {
  path?: string;
  url?: string;
  type: string;
  name: string;
};
type Message = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  conversation_id: string;
  edited_at: string | null;
  attachments?: Attachment[];
  profiles?: {
    username: string;
  };
  message_read_receipts?: Array<{
    user_id: string;
    read_at: string;
    profiles?: {
      username: string;
    };
  }>;
};
type Conversation = {
  id: string;
  name: string | null;
  type: 'dm' | 'group';
  created_at: string;
  created_by: string;
  participants?: Array<{
    username: string;
    user_id: string;
    status?: 'online' | 'idle' | 'dnd' | 'offline';
    status_message?: string | null;
  }>;
};

type Poll = {
  id: string;
  conversation_id: string;
  created_by: string;
  question: string;
  options: string[];
  multiple_choice: boolean;
  anonymous: boolean;
  expires_at: string | null;
  created_at: string;
};

type PollVote = {
  id: string;
  poll_id: string;
  user_id: string;
  option_index: number;
  profiles?: {
    username: string;
  };
};

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string>("");
  const [userStatus, setUserStatus] = useState<'online' | 'idle' | 'dnd' | 'offline'>('offline');
  const [userStatusMessage, setUserStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [conversationToRename, setConversationToRename] = useState<Conversation | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [voiceRecorderOpen, setVoiceRecorderOpen] = useState(false);
  const [createPollOpen, setCreatePollOpen] = useState(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollVotes, setPollVotes] = useState<PollVote[]>([]);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    toast
  } = useToast();

  // Auto-idle detection
  const handleStatusChange = useCallback((status: 'online' | 'idle' | 'dnd' | 'offline') => {
    setUserStatus(status);
  }, []);

  const { setManualStatus } = useAutoIdle(user?.id, userStatus, handleStatusChange);

  // Fetch username and status from profile
  useEffect(() => {
    if (!user) return;
    
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, status, status_message")
        .eq("id", user.id)
        .maybeSingle();
      
      if (data?.username) {
        setUsername(data.username);
      }
      if (data?.status) {
        setUserStatus(data.status as 'online' | 'idle' | 'dnd' | 'offline');
      }
      if (data?.status_message !== undefined) {
        setUserStatusMessage(data.status_message);
      }

      // Set user as online when they open chat
      await supabase
        .from("profiles")
        .update({ status: 'online', last_seen: new Date().toISOString() })
        .eq("id", user.id);
      setUserStatus('online');
    };
    
    fetchProfile();

    // Set offline when leaving
    return () => {
      if (user?.id) {
        supabase
          .from("profiles")
          .update({ status: 'offline', last_seen: new Date().toISOString() })
          .eq("id", user.id);
      }
    };
  }, [user]);
  useEffect(() => {
    let active = true;

    // Listener for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "SIGNED_IN") {
        setUser(session?.user ?? null);
        setLoading(false);
        setNeedsAuth(false);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
        setNeedsAuth(true);
      }
    });

    // Explicit initial fetch so we don't depend on INITIAL_SESSION firing
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;

      if (!session) {
        setUser(null);
        setLoading(false);
        setNeedsAuth(true);
        return;
      }

      setUser(session.user);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setLoading(false);
      setNeedsAuth(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    fetchConversations();

    // Subscribe to conversation changes
    const conversationsChannel = supabase.channel("conversations_changes").on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "conversation_participants",
      filter: `user_id=eq.${user.id}`
    }, () => {
      fetchConversations();
    }).subscribe();

    // Subscribe to participant changes (for when new DMs/groups are created)
    const participantsChannel = supabase.channel("participants_changes").on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "conversation_participants",
      filter: `user_id=eq.${user.id}`
    }, () => {
      fetchConversations();
    }).subscribe();

    // Subscribe to profile status changes for real-time status updates
    const profilesChannel = supabase.channel("profiles_status_changes").on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "profiles"
    }, (payload) => {
      // Update conversation participants' status in real-time
      setConversations(current => 
        current.map(conv => ({
          ...conv,
          participants: conv.participants?.map(p => 
            p.user_id === payload.new.id 
              ? { ...p, status: payload.new.status, status_message: payload.new.status_message }
              : p
          )
        }))
      );
    }).subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(participantsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [user, toast]);
  useEffect(() => {
    if (!user || !selectedConversationId) return;
    fetchMessages();
    fetchParticipantCount();

    // Subscribe to new messages
    const messagesChannel = supabase.channel(`chat_messages_${selectedConversationId}`).on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "chat_messages",
      filter: `conversation_id=eq.${selectedConversationId}`
    }, async payload => {
      // Fetch the profile for the new message
      const {
        data: profile,
        error: profileError
      } = await supabase.from("profiles").select("username").eq("id", payload.new.user_id).single();

      // Log error if profile fetch fails
      if (profileError) {
        console.error("Failed to fetch profile for message:", profileError);
      }

      // Normalize attachments (can arrive as JSON, stringified JSON, or null)
      let parsedAttachments: any = (payload.new as any).attachments;
      if (typeof parsedAttachments === "string") {
        try {
          parsedAttachments = JSON.parse(parsedAttachments);
        } catch {
          parsedAttachments = [];
        }
      }

      setMessages(current => [...current, {
        ...payload.new,
        attachments: Array.isArray(parsedAttachments) ? parsedAttachments : [],
        profiles: profile || { username: "Unknown" },
        message_read_receipts: []
      } as Message]);
    }).subscribe();

    // Subscribe to presence for typing indicators
    const presenceChannel = supabase.channel(`presence_${selectedConversationId}`, {
      config: {
        presence: {
          key: user.id
        }
      }
    }).on('presence', {
      event: 'sync'
    }, () => {
      const state = presenceChannel.presenceState();
      const typing = Object.values(state).flat().filter((presence: any) => presence.typing && presence.user_id !== user.id).map((presence: any) => presence.username);
      setTypingUsers(typing);
    }).subscribe();
    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user, selectedConversationId, toast]);

  // Fetch polls for selected conversation
  useEffect(() => {
    if (!selectedConversationId) return;
    
    fetchPolls();

    // Subscribe to poll changes with separate channels for faster updates
    const pollsChannel = supabase
      .channel(`polls_${selectedConversationId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "polls",
        filter: `conversation_id=eq.${selectedConversationId}`
      }, () => {
        fetchPolls();
      })
      .subscribe();

    // Poll votes subscription - we refresh votes when polls change
    // The polls channel already filters by conversation_id
    const votesChannel = supabase
      .channel(`poll_votes_${selectedConversationId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "poll_votes"
      }, (payload: any) => {
        const pollId = payload.new?.poll_id || payload.old?.poll_id;
        if (!pollId || polls.some(p => p.id === pollId)) {
          fetchPollVotesForConversation();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(pollsChannel);
      supabase.removeChannel(votesChannel);
    };
  }, [selectedConversationId]);

  const fetchPolls = async () => {
    if (!selectedConversationId) return;
    
    const { data } = await supabase
      .from("polls")
      .select("*")
      .eq("conversation_id", selectedConversationId)
      .order("created_at", { ascending: true });
    
    if (data) {
      const formattedPolls = data.map(p => ({
        ...p,
        options: Array.isArray(p.options) ? p.options : []
      })) as Poll[];
      setPolls(formattedPolls);
      
      // Fetch votes for these polls immediately
      if (formattedPolls.length > 0) {
        const pollIds = formattedPolls.map(p => p.id);
        const { data: votesData } = await supabase
          .from("poll_votes")
          .select("*, profiles(username)")
          .in("poll_id", pollIds);
        
        if (votesData) {
          setPollVotes(votesData as PollVote[]);
        }
      }
    }
  };

  const fetchPollVotesForConversation = async () => {
    if (!selectedConversationId) return;
    
    // Get all poll IDs for this conversation first
    const { data: pollsData } = await supabase
      .from("polls")
      .select("id")
      .eq("conversation_id", selectedConversationId);
    
    if (!pollsData || pollsData.length === 0) return;
    
    const pollIds = pollsData.map(p => p.id);
    const { data } = await supabase
      .from("poll_votes")
      .select("*, profiles(username)")
      .in("poll_id", pollIds);
    
    if (data) {
      setPollVotes(data as PollVote[]);
    }
  };
  const fetchParticipantCount = async () => {
    if (!selectedConversationId) return;
    const {
      count,
      error
    } = await supabase.from("conversation_participants").select("*", {
      count: 'exact',
      head: true
    }).eq("conversation_id", selectedConversationId);
    if (!error && count !== null) {
      setParticipantCount(count);
    }
  };
  const fetchConversations = async () => {
    if (!user) return;

    // First get conversation IDs where user is a participant
    const {
      data: participantData,
      error: participantError
    } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", user.id);
    if (participantError) {
      toast({
        title: "Error loading conversations",
        description: getUserFriendlyError(participantError),
        variant: "destructive"
      });
      return;
    }
    if (!participantData || participantData.length === 0) {
      setConversations([]);
      return;
    }
    const conversationIds = participantData.map(p => p.conversation_id);

    // Then get full conversation details with all participants
    const {
      data,
      error
    } = await supabase.from("conversations").select(`
        *,
        conversation_participants(
          user_id,
          profiles(username, status, status_message)
        )
      `).in("id", conversationIds).order("created_at", {
      ascending: false
    });
    if (error) {
      toast({
        title: "Error loading conversations",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    } else {
      const formattedConversations = (data || []).map((conv: any) => ({
        id: conv.id,
        name: conv.name,
        type: conv.type,
        created_at: conv.created_at,
        created_by: conv.created_by,
        participants: (conv.conversation_participants || []).filter((p: any) => p.user_id !== user?.id).map((p: any) => ({
          username: p.profiles?.username || "Unknown",
          user_id: p.user_id,
          status: p.profiles?.status || 'offline',
          status_message: p.profiles?.status_message || null
        }))
      }));
      setConversations(formattedConversations);

      // Auto-select first conversation if none selected
      if (!selectedConversationId && formattedConversations.length > 0) {
        setSelectedConversationId(formattedConversations[0].id);
      }
    }
  };
  const fetchMessages = async () => {
    if (!selectedConversationId || !user) return;
    const {
      data,
      error
    } = await supabase.from("chat_messages").select(`
        *,
        profiles(username),
        message_read_receipts(
          user_id,
          read_at,
          profiles(username)
        )
      `).eq("conversation_id", selectedConversationId).order("created_at", {
      ascending: true
    }).limit(100);
    if (error) {
      toast({
        title: "Error loading messages",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    } else {
      const formattedMessages = (data || []).map((msg: any) => {
        // Handle attachments that may be a string (double-stringified) or array
        let parsedAttachments = msg.attachments;
        if (typeof parsedAttachments === 'string') {
          try {
            parsedAttachments = JSON.parse(parsedAttachments);
          } catch {
            parsedAttachments = [];
          }
        }
        return {
          ...msg,
          attachments: Array.isArray(parsedAttachments) ? parsedAttachments : []
        };
      });
      setMessages(formattedMessages);

      // Mark messages as read
      const unreadMessages = formattedMessages.filter(msg => msg.user_id !== user.id && !msg.message_read_receipts?.some(r => r.user_id === user.id));
      if (unreadMessages.length > 0) {
        const receipts = unreadMessages.map(msg => ({
          message_id: msg.id,
          user_id: user.id
        }));
        await supabase.from("message_read_receipts").insert(receipts);
      }
    }
  };
  // Scroll to bottom when messages change or conversation is selected
  useEffect(() => {
    if (scrollRef.current) {
      // Use setTimeout to ensure DOM has rendered
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [messages, selectedConversationId]);
  const handleTyping = async () => {
    if (!user || !selectedConversationId) return;
    const channel = supabase.channel(`presence_${selectedConversationId}`);
    await channel.track({
      user_id: user.id,
      username: (await supabase.from("profiles").select("username").eq("id", user.id).single()).data?.username,
      typing: true
    });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(async () => {
      await channel.track({
        user_id: user.id,
        typing: false
      });
    }, 2000);
  };
  const MAX_MESSAGE_LENGTH = 160;
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && attachments.length === 0 || !user || !selectedConversationId) return;
    if (newMessage.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: "Message too long",
        description: `Maximum ${MAX_MESSAGE_LENGTH} characters allowed`,
        variant: "destructive"
      });
      return;
    }
    try {
      const {
        error
      } = await supabase.from("chat_messages").insert({
        user_id: user.id,
        content: newMessage.trim(),
        conversation_id: selectedConversationId,
        attachments: attachments.length > 0 ? attachments : null
      });
      if (error) throw error;
      setNewMessage("");
      setAttachments([]);

      // Stop typing indicator
      const channel = supabase.channel(`presence_${selectedConversationId}`);
      await channel.track({
        user_id: user.id,
        typing: false
      });
    } catch (error: any) {
      toast({
        title: "Error sending message",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    }
  };
  const handleRenameClick = (conversation: Conversation) => {
    setConversationToRename(conversation);
    setRenameDialogOpen(true);
  };
  const handleDeleteConversation = async (conversationId: string) => {
    if (!window.confirm("Are you sure you want to delete this conversation? This will delete all messages.")) {
      return;
    }
    try {
      const {
        error
      } = await supabase.from("conversations").delete().eq("id", conversationId);
      if (error) throw error;
      toast({
        title: "Conversation deleted"
      });

      // Clear selection if deleted conversation was selected
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }
      fetchConversations();
    } catch (error: any) {
      toast({
        title: "Error deleting conversation",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    }
  };
  const handleLeaveConversation = async (conversationId: string) => {
    if (!window.confirm("Are you sure you want to leave this conversation?")) {
      return;
    }
    try {
      const {
        error
      } = await supabase.from("conversation_participants").delete().eq("conversation_id", conversationId).eq("user_id", user?.id);
      if (error) throw error;
      toast({
        title: "Left conversation"
      });

      // Clear selection if left conversation was selected
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }
      fetchConversations();
    } catch (error: any) {
      toast({
        title: "Error leaving conversation",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    }
  };
  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      const {
        error
      } = await supabase.from("chat_messages").update({
        content: newContent,
        edited_at: new Date().toISOString()
      }).eq("id", messageId);
      if (error) throw error;

      // Update local state
      setMessages(current => current.map(msg => msg.id === messageId ? {
        ...msg,
        content: newContent,
        edited_at: new Date().toISOString()
      } : msg));
      toast({
        title: "Message updated"
      });
    } catch (error: any) {
      toast({
        title: "Error updating message",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    }
  };
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const {
        error
      } = await supabase.from("chat_messages").delete().eq("id", messageId);
      if (error) throw error;

      // Update local state
      setMessages(current => current.filter(msg => msg.id !== messageId));
      toast({
        title: "Message deleted"
      });
    } catch (error: any) {
      toast({
        title: "Error deleting message",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    }
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setNeedsAuth(true);
  };
  if (loading) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4 animate-fade-in">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Loading your conversations…</p>
      </div>;
  }
  if (needsAuth) {
    return <div className="min-h-screen">
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-bold glow-text">You must be signed in</h1>
          <p className="text-muted-foreground max-w-sm">
            Sign in to access your conversations.
          </p>
          <Button asChild>
            <Link to="/auth">Go to Sign In</Link>
          </Button>
        </div>
      </div>;
  }

  const selectedConversation = conversations.find(conversation => conversation.id === selectedConversationId);
  const selectedConversationName = selectedConversation?.name || selectedConversation?.participants?.map(participant => participant.username).join(", ") || "Conversation";
  const selectedConversationType = selectedConversation?.type === "group" ? "Group conversation" : "Direct conversation";

  return <div className="h-screen flex flex-col">
      <div className="flex min-h-0 flex-1 overflow-hidden bg-background/20 pt-20">
        <div className="shrink-0 pb-3 pl-4 pt-3">
        <ChatSidebar conversations={conversations} selectedConversationId={selectedConversationId} onSelectConversation={setSelectedConversationId} onCreateNew={() => setCreateDialogOpen(true)} onRename={handleRenameClick} onDelete={handleDeleteConversation} onLeave={handleLeaveConversation} currentUserId={user?.id || ""} userEmail={user?.email} username={username} userStatus={userStatus} userStatusMessage={userStatusMessage} onUserStatusChange={(status, message) => { setManualStatus(status); setUserStatus(status); setUserStatusMessage(message); }} />
        </div>
        <div className="min-w-0 flex-1 flex min-h-0 flex-col">
          {selectedConversationId ? <>
              <div className="mx-3 mb-3 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-black/10 bg-card/65 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-card/60">
              <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    {selectedConversation?.type === "group" ? <Users className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{selectedConversationType}</p>
                    <h1 className="truncate text-base font-semibold text-foreground">{selectedConversationName}</h1>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="hidden sm:inline">{participantCount} {participantCount === 1 ? "participant" : "participants"}</span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden px-4 pt-3">
                <ScrollArea className="h-full" ref={scrollRef}>
                  <div className="mx-auto max-w-4xl px-1 pb-3">
                    <div className="space-y-1 max-w-4xl mx-auto">
                    {/* Combined timeline of messages and polls */}
                    {(() => {
                      // Merge messages and polls into a single timeline
                      type TimelineItem = 
                        | { type: 'message'; data: Message; created_at: string }
                        | { type: 'poll'; data: Poll; created_at: string };
                      
                      const timeline: TimelineItem[] = [
                        ...messages.map(m => ({ type: 'message' as const, data: m, created_at: m.created_at })),
                        ...polls.map(p => ({ type: 'poll' as const, data: p, created_at: p.created_at }))
                      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                      return timeline.map((item, index) => {
                        if (item.type === 'poll') {
                          const poll = item.data;
                          const isPollCreator = poll.created_by === user?.id;
                          return (
                            <div key={`poll-${poll.id}`} className={`flex flex-col ${isPollCreator ? "items-end" : "items-start"} mt-4`}>
                              <PollCard
                                poll={poll}
                                currentUserId={user?.id || ""}
                                votes={pollVotes.filter(v => v.poll_id === poll.id)}
                                onVotesChange={fetchPolls}
                              />
                            </div>
                          );
                        }

                        const message = item.data;
                        const messageIndex = messages.indexOf(message);
                        const prevMessage = messages[messageIndex - 1];
                        const nextMessage = messages[messageIndex + 1];

                        // Check if this message is part of a rapid succession (within 2 minutes)
                        const isSameUserAsPrev = prevMessage?.user_id === message.user_id;
                        const isSameUserAsNext = nextMessage?.user_id === message.user_id;
                        const timeDiffFromPrev = prevMessage ? (new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) / 1000 / 60 : Infinity;
                        const timeDiffToNext = nextMessage ? (new Date(nextMessage.created_at).getTime() - new Date(message.created_at).getTime()) / 1000 / 60 : Infinity;
                        const isGroupedWithPrev = isSameUserAsPrev && timeDiffFromPrev < 10;
                        const isGroupedWithNext = isSameUserAsNext && timeDiffToNext < 10;
                        const isLatestOutgoingMessage = message.user_id === user?.id &&
                          !messages.slice(messageIndex + 1).some(next => next.user_id === user?.id);

                        // Show header (username + time) only for first message in a group
                        const showHeader = !isGroupedWithPrev;

                        // Add extra spacing before a new group
                        const showExtraSpacing = !isGroupedWithPrev && messageIndex > 0;
                        const messageBubbleTone = message.user_id === user?.id
                          ? "border border-primary/40 bg-primary/90 text-primary-foreground shadow-lg shadow-primary/15"
                          : "border border-border/50 bg-background/70 text-foreground shadow-sm dark:bg-black/30";
                        
                        const isThisMessageBeingEdited = editingMessageId === message.id && message.user_id === user?.id;

                        return (
                          <div key={message.id} className={`group flex flex-col ${message.user_id === user?.id ? "items-end" : "items-start"} ${showExtraSpacing ? "mt-4" : ""}`}>
                            {showHeader && (
                              <div className="mb-1 flex items-center gap-2 rounded-full border border-border/40 bg-background/45 px-2.5 py-1 text-xs backdrop-blur-sm">
                                <button
                                  onClick={() => {
                                    setSelectedUserId(message.user_id);
                                    setProfileDialogOpen(true);
                                  }}
                                  className="cursor-pointer font-semibold hover:underline"
                                >
                                  {message.profiles?.username || "Anonymous"}
                                </button>
                                <span className="text-muted-foreground">
                                  {new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                  {message.edited_at && " (edited)"}
                                </span>
                              </div>
                            )}
                            <div className={message.user_id === user?.id
                              ? "group/message relative flex w-full items-start justify-end gap-2"
                              : "flex items-start gap-2"}>
                              {message.user_id !== user?.id && (
                                <MessageActions 
                                  messageId={message.id} 
                                  content={message.content} 
                                  currentUserId={user?.id || ""} 
                                  onEdit={handleEditMessage} 
                                  onDelete={handleDeleteMessage} 
                                  showEdit={false}
                                  showDelete={false}
                                  createdAt={message.created_at}
                                  senderName={message.profiles?.username || "Anonymous"}
                                  readBy={message.message_read_receipts?.map(r => ({
                                    username: r.profiles?.username || "Unknown",
                                    read_at: r.read_at,
                                  })) || []}
                                />
                              )}
                              {!isThisMessageBeingEdited ? (
                                <div className={`inline-block max-w-xs px-4 py-2.5 transition-transform duration-200 hover:shadow-md sm:max-w-sm md:max-w-md lg:max-w-lg ${message.user_id === user?.id ? "group-hover/message:-translate-x-8" : ""} ${messageBubbleTone} ${isGroupedWithPrev && isGroupedWithNext ? message.user_id === user?.id ? "rounded-l-2xl rounded-r-md" : "rounded-r-2xl rounded-l-md" : isGroupedWithPrev ? message.user_id === user?.id ? "rounded-l-2xl rounded-tr-md rounded-br-2xl" : "rounded-r-2xl rounded-tl-md rounded-bl-2xl" : isGroupedWithNext ? message.user_id === user?.id ? "rounded-l-2xl rounded-tr-2xl rounded-br-md" : "rounded-r-2xl rounded-tl-2xl rounded-bl-md" : "rounded-2xl"}`}>
                                  {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}

                                  {message.attachments && message.attachments.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                      {message.attachments.map((attachment, idx) => (
                                        <div key={idx}>
                                          <AttachmentRenderer
                                            attachment={attachment}
                                            onImageClick={(url, name) => setPreviewImage({ url, name })}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="w-full max-w-md">
                                  <MessageActions
                                    messageId={message.id}
                                    content={message.content}
                                    currentUserId={user?.id || ""}
                                    onEdit={handleEditMessage}
                                    onDelete={handleDeleteMessage}
                                    showEdit={!!message.content?.trim()}
                                    showDelete={true}
                                    createdAt={message.created_at}
                                    senderName={message.profiles?.username || "Anonymous"}
                                    readBy={message.message_read_receipts?.map(r => ({
                                      username: r.profiles?.username || "Unknown",
                                      read_at: r.read_at,
                                    })) || []}
                                    className="absolute right-0 top-1/2 h-7 w-7 -translate-y-1/2 opacity-0 transition-opacity group-hover/message:opacity-100"
                                    isEditing={true}
                                    onEditingChange={(value) => setEditingMessageId(value ? message.id : null)}
                                  />
                                </div>
                              )}
                              {message.user_id === user?.id && !isThisMessageBeingEdited && (
                                <MessageActions
                                  messageId={message.id}
                                  content={message.content}
                                  currentUserId={user?.id || ""}
                                  onEdit={handleEditMessage}
                                  onDelete={handleDeleteMessage}
                                  showEdit={!!message.content?.trim()}
                                  showDelete={true}
                                  createdAt={message.created_at}
                                  senderName={message.profiles?.username || "Anonymous"}
                                  readBy={message.message_read_receipts?.map(r => ({
                                    username: r.profiles?.username || "Unknown",
                                    read_at: r.read_at,
                                  })) || []}
                                  className="absolute right-0 top-1/2 h-7 w-7 -translate-y-1/2 opacity-0 transition-opacity group-hover/message:opacity-100"
                                  onEditingChange={(value) => setEditingMessageId(value ? message.id : null)}
                                />
                              )}
                            </div>
                            <MessageReactions messageId={message.id} currentUserId={user?.id || ""} showTrigger={false} />
                            {!isGroupedWithNext && isLatestOutgoingMessage && (
                              <ReadReceipts 
                                messageId={message.id} 
                                readBy={message.message_read_receipts?.map(r => ({
                                  user_id: r.user_id,
                                  username: r.profiles?.username || "Unknown",
                                  read_at: r.read_at
                                })) || []} 
                                totalParticipants={participantCount} 
                                isSender={message.user_id === user?.id} 
                              />
                            )}
                          </div>
                        );
                      });
                    })()}
                    </div>
                  </div>
                </ScrollArea>
              </div>

              <TypingIndicator typingUsers={typingUsers} />

              <div className="mx-auto w-full max-w-4xl px-4 pb-4 pt-2">
                  <form onSubmit={handleSendMessage} className="relative rounded-2xl border border-border/40 bg-background/35 shadow-sm backdrop-blur-sm">
                    {attachments.length > 0 && <div className="p-3 pb-0 flex flex-wrap gap-2 border-b border-border/30">
                        {attachments.map((attachment, idx) => <div key={idx} className="relative inline-block">
                            <div className="h-16 w-16 bg-background/50 rounded-xl flex items-center justify-center border border-border/20">
                              {attachment.type.startsWith("image/") ? <span className="text-xs text-center p-1 truncate">{attachment.name}</span> : <FileText className="h-6 w-6 text-muted-foreground" />}
                            </div>
                            <button type="button" onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-destructive/90 shadow-sm">
                              ×
                            </button>
                          </div>)}
                      </div>}
                    
                    {/* Voice recorder overlay */}
                    {voiceRecorderOpen && <div className="absolute inset-0 z-10">
                        <VoiceRecorderInline conversationId={selectedConversationId || ""} onClose={() => setVoiceRecorderOpen(false)} onSend={async file => {
                      if (!user?.id || !selectedConversationId) {
                        toast({
                          title: "Can't send voice message",
                          description: "Please select a conversation and make sure you're signed in.",
                          variant: "destructive"
                        });
                        throw new Error("Missing user or conversation");
                      }

                      const {
                        error
                      } = await supabase.from("chat_messages").insert({
                        user_id: user.id,
                        content: "",
                        conversation_id: selectedConversationId,
                        attachments: [file]
                      });

                      if (error) throw error;
                    }} />
                      </div>}
                     
                    <div className="flex items-end gap-2 p-2 sm:p-3">
                      <FileUpload conversationId={selectedConversationId || ""} onFilesSelected={async files => {
                    // Auto-send voice messages immediately
                    if (files.length === 1 && files[0].type?.startsWith("audio/")) {
                      if (!user?.id || !selectedConversationId) {
                        toast({
                          title: "Can't send voice message",
                          description: "Please select a conversation and make sure you're signed in.",
                          variant: "destructive"
                        });
                        return;
                      }
                      try {
                        const {
                          error
                        } = await supabase.from("chat_messages").insert({
                          user_id: user.id,
                          content: "",
                          conversation_id: selectedConversationId,
                          attachments: files
                        });
                        if (error) throw error;
                      } catch (error: any) {
                        toast({
                          title: "Error sending voice message",
                          description: getUserFriendlyError(error),
                          variant: "destructive"
                        });
                      }
                    } else {
                      setAttachments([...attachments, ...files]);
                    }
                  }} voiceRecorderOpen={voiceRecorderOpen} setVoiceRecorderOpen={setVoiceRecorderOpen} onCreatePoll={() => setCreatePollOpen(true)} />
                      
                      <div className="flex min-h-[46px] flex-1 items-center rounded-2xl border border-border/30 bg-background/55 px-3 py-2 transition-colors focus-within:border-primary/50 focus-within:bg-background/70">
                        <Textarea value={newMessage} onChange={e => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }} onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }} className="flex-1 min-h-[24px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50 p-0 text-sm" rows={1} placeholder="Message..." />
                      </div>
                      
                      <Button 
                        type="submit" 
                        disabled={!newMessage.trim() && attachments.length === 0} 
                        size="icon" 
                        className="h-10 w-10 self-center rounded-xl shrink-0 bg-background/40 hover:bg-background/70 border border-white/10 text-foreground shadow-md transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center group"
                      >
                        <Send className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                      </Button>
                    </div>
                  </form>
              </div>
              </div>
            </> : <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-sm rounded-3xl border border-black/10 bg-card/65 p-8 text-center shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-card/60">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <h1 className="text-lg font-semibold">Your conversations</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Select a conversation from the rail or create a new chat to get started.</p>
              </div>
            </div>}
        </div>
      </div>

      <CreateConversationDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} currentUserId={user?.id || ""} onConversationCreated={fetchConversations} />

      <RenameConversationDialog conversation={conversationToRename} open={renameDialogOpen} onOpenChange={setRenameDialogOpen} onRenamed={fetchConversations} />

      <ImagePreviewDialog imageUrl={previewImage?.url || null} imageName={previewImage?.name} onClose={() => setPreviewImage(null)} />

      <CreatePollDialog open={createPollOpen} onOpenChange={setCreatePollOpen} conversationId={selectedConversationId || ""} userId={user?.id || ""} />

      <ProfileViewDialog 
        open={profileDialogOpen} 
        onOpenChange={setProfileDialogOpen} 
        userId={selectedUserId}
        currentUserId={user?.id}
        onConversationCreated={fetchConversations}
      />
    </div>;
};
export default Chat;