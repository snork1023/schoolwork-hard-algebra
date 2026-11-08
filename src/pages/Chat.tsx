import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/buttons/button";
import { Textarea } from "@/components/ui/forms/textarea";
import { ScrollArea } from "@/components/ui/layout/scroll-area";
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
import { VoiceRecord } from "@/components/chat/VoiceRecord";
import { ImagePreviewDialog } from "@/components/chat/ImagePreviewDialog";
import { AttachmentRenderer } from "@/components/chat/AttachmentRenderer";
import { CreatePollDialog } from "@/components/chat/CreatePollDialog";
import { PollCard } from "@/components/chat/PollCard";
import { ProfileViewDialog } from "@/components/chat/ProfileViewDialog";
import { useAutoIdle } from "@/hooks/useAutoIdle";
import { Camera, Send, FileText, Loader2, MessageSquare, Users, Mic, Image as ImageIcon, Video, Sparkles, Paperclip } from "lucide-react";
import { motion } from "motion/react";
import { getUserFriendlyError } from "@/lib/error-utils";
import { removeChatAttachmentObjects } from "@/lib/chat-attachments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/overlays/alert-dialog";
type Attachment = {
  path?: string;
  url?: string;
  type: string;
  name: string;
  duration?: number;
};

const getAttachmentPresentation = (attachment: Attachment) => {
  const type = attachment.type.toLowerCase();
  const name = attachment.name.toLowerCase();

  if (type.startsWith("audio/") || name.startsWith("voice_")) {
    return { label: "Voice recording", Icon: Mic };
  }
  if (type === "image/gif" || name.endsWith(".gif")) {
    return { label: "GIF", Icon: Sparkles };
  }
  if (type.startsWith("image/")) {
    return { label: "Image", Icon: ImageIcon };
  }
  if (type.startsWith("video/")) {
    return { label: "Video", Icon: Video };
  }
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return { label: "PDF", Icon: FileText };
  }
  return { label: "File", Icon: Paperclip };
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
  const [messagesInfoOpen, setMessagesInfoOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const draftAttachmentsRef = useRef<Attachment[]>([]);
  const currentUserIdRef = useRef<string | null>(null);
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
  draftAttachmentsRef.current = attachments;
  currentUserIdRef.current = user?.id ?? null;

  const updateDraftAttachments = (next: Attachment[]) => {
    draftAttachmentsRef.current = next;
    setAttachments(next);
  };

  const removeUnsentAttachments = async (items: Attachment[], userId: string | null) => {
    if (!userId) return;
    await removeChatAttachmentObjects(
      items.flatMap(item => typeof item.path === "string" ? [item.path] : []),
      userId,
    );
  };

  const discardDraftAttachments = async () => {
    await removeUnsentAttachments(draftAttachmentsRef.current, currentUserIdRef.current);
    updateDraftAttachments([]);
  };

  const handleSelectConversation = async (conversationId: string) => {
    if (conversationId === selectedConversationId) return;
    try {
      await discardDraftAttachments();
      setNewMessage("");
      setSelectedConversationId(conversationId);
    } catch (error: unknown) {
      toast({
        title: "Couldn't discard unsent attachments",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    }
  };

  const handleRemoveDraftAttachment = async (index: number) => {
    const attachment = draftAttachmentsRef.current[index];
    if (!attachment) return;
    try {
      await removeUnsentAttachments([attachment], currentUserIdRef.current);
      updateDraftAttachments(draftAttachmentsRef.current.filter(item => item !== attachment));
    } catch (error: unknown) {
      toast({
        title: "Couldn't remove attachment",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    }
  };

  useEffect(() => () => {
    void removeUnsentAttachments(draftAttachmentsRef.current, currentUserIdRef.current)
      .catch(error => console.error("Failed to remove unsent chat attachments:", error));
  }, []);

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
      let parsedAttachments: unknown = payload.new.attachments;
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
      const typing = Object.values(state).flat().filter((presence) => presence.typing && presence.user_id !== user.id).map((presence) => presence.username);
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
      }, (payload) => {
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

  async function fetchPolls() {
    if (!selectedConversationId) return;
    
    const { data, error } = await supabase
      .from("polls")
      .select("*")
      .eq("conversation_id", selectedConversationId)
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        title: "Couldn't refresh polls",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
      return;
    }
    
    const formattedPolls = (data || []).map(p => ({
      ...p,
      options: Array.isArray(p.options) ? p.options : []
    })) as Poll[];
    setPolls(formattedPolls);
    
    if (formattedPolls.length === 0) {
      setPollVotes([]);
      return;
    }

    const pollIds = formattedPolls.map(p => p.id);
    const { data: votesData, error: votesError } = await supabase
      .from("poll_votes")
      .select("*, profiles(username)")
      .in("poll_id", pollIds);
    
    if (votesError) {
      toast({
        title: "Couldn't refresh poll votes",
        description: getUserFriendlyError(votesError),
        variant: "destructive",
      });
      return;
    }
    setPollVotes((votesData || []) as PollVote[]);
  }
  async function fetchPollVotesForConversation() {
    if (!selectedConversationId) return;
    
    // Get all poll IDs for this conversation first
    const { data: pollsData } = await supabase
      .from("polls")
      .select("id")
      .eq("conversation_id", selectedConversationId);
    
    if (!pollsData || pollsData.length === 0) {
      setPollVotes([]);
      return;
    }
    
    const pollIds = pollsData.map(p => p.id);
    const { data } = await supabase
      .from("poll_votes")
      .select("*, profiles(username)")
      .in("poll_id", pollIds);
    
    if (data) {
      setPollVotes(data as PollVote[]);
    }
  }
  async function fetchParticipantCount() {
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
  }
  async function fetchConversations() {
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
      const formattedConversations = (data || []).map((conv) => ({
        id: conv.id,
        name: conv.name,
        type: conv.type,
        created_at: conv.created_at,
        created_by: conv.created_by,
        participants: (conv.conversation_participants || []).filter((p) => p.user_id !== user?.id).map((p) => ({
          username: p.profiles?.username || "Unknown",
          user_id: p.user_id,
          status: p.profiles?.status || 'offline',
          status_message: p.profiles?.status_message || null
        }))
      }));
      setConversations(formattedConversations);
    }
  }
  async function fetchMessages() {
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
      const formattedMessages = (data || []).map((msg) => {
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
        }
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
      updateDraftAttachments([]);

      // Stop typing indicator
      const channel = supabase.channel(`presence_${selectedConversationId}`);
      await channel.track({
        user_id: user.id,
        typing: false
      });
    } catch (error: unknown) {
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
      if (selectedConversationId === conversationId) await discardDraftAttachments();
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
    } catch (error: unknown) {
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
      if (selectedConversationId === conversationId) await discardDraftAttachments();
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      toast({
        title: "Error updating message",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    }
  };
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { data: message, error: fetchError } = await supabase
        .from("chat_messages")
        .select("attachments, conversation_id")
        .eq("id", messageId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!message) throw new Error("Message not found or you do not have permission to delete it.");

      let attachments: unknown = message.attachments;
      if (typeof attachments === "string") {
        try {
          attachments = JSON.parse(attachments);
        } catch {
          attachments = [];
        }
      }

      const paths = new Set<string>();
      if (Array.isArray(attachments)) {
        for (const attachment of attachments) {
          if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) continue;
          const path = (attachment as { path?: unknown }).path;
          if (typeof path !== "string") continue;

          const segments = path.split("/");
          if (
            segments.length !== 3 ||
            segments.some(segment => !segment || segment === "." || segment === "..") ||
            segments[0] !== message.conversation_id
          ) {
            continue;
          }
          if (!user?.id || segments[1] !== user.id) {
            throw new Error("You do not have permission to delete one or more message attachments.");
          }
          paths.add(path);
        }
      }

      if (paths.size > 0) {
        const { error: storageError } = await supabase.storage
          .from("chat-attachments")
          .remove([...paths]);
        if (storageError) throw storageError;
      }

      const {
        error
      } = await supabase.from("chat_messages").delete().eq("id", messageId);
      if (error) throw error;

      // Update local state
      setMessages(current => current.filter(msg => msg.id !== messageId));
      toast({
        title: "Message deleted"
      });
    } catch (error: unknown) {
      toast({
        title: "Error deleting message",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    }
  };
  const hasDraft = Boolean(newMessage.trim() || attachments.length > 0);
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
        <ChatSidebar conversations={conversations} selectedConversationId={selectedConversationId} onSelectConversation={handleSelectConversation} onCreateNew={() => setCreateDialogOpen(true)} onRename={handleRenameClick} onDelete={handleDeleteConversation} onLeave={handleLeaveConversation} currentUserId={user?.id || ""} userEmail={user?.email} username={username} userStatus={userStatus} userStatusMessage={userStatusMessage} onUserStatusChange={(status, message) => { setManualStatus(status); setUserStatus(status); setUserStatusMessage(message); }} />
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
                  <form onSubmit={handleSendMessage} className={`relative ${attachments.length > 0 ? "rounded-2xl" : "rounded-full"} border border-border/50 bg-background/90 shadow-lg shadow-black/5 backdrop-blur-xl transition-colors focus-within:border-primary/40`}>
                    {attachments.length > 0 && <div className="flex flex-wrap gap-2 border-b border-border/30 p-3 pb-2">
                                        {attachments.map((attachment, idx) => {
                          const { label, Icon } = getAttachmentPresentation(attachment);
                          return <div key={`${attachment.path ?? attachment.url ?? attachment.name}-${idx}`} className="relative">
                            <div className="flex min-w-[136px] max-w-[190px] items-center gap-2 rounded-xl border border-border/40 bg-secondary/60 px-3 py-2 pr-8">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80 text-muted-foreground">
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs font-medium leading-4">{label}</span>
                                <span className="block max-w-[110px] truncate text-[11px] leading-4 text-muted-foreground">{attachment.name}</span>
                              </span>
                            </div>
                            <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => void handleRemoveDraftAttachment(idx)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground shadow-sm hover:bg-destructive/90">
                              ×
                            </button>
                          </div>;
                        })}
                      </div>}
                    
                    <div className="flex min-h-[52px] items-center gap-1.5 px-2 py-1 sm:gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Add a photo or file"
                        onClick={() => document.getElementById("camera-capture")?.click()}
                        className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                      >
                        <Camera className="h-[18px] w-[18px]" />
                      </Button>
                      <div className="order-2 flex min-h-[44px] flex-1 items-center px-1 py-2">
                        <Textarea value={newMessage} onChange={e => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }} onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }} className="min-h-[24px] max-h-[120px] flex-1 resize-none border-0 bg-transparent p-0 text-[15px] leading-6 placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0" rows={1} placeholder="Message..." />
                      </div>
                      
                      <div className="relative order-3 flex h-10 w-[76px] shrink-0 items-center justify-center">
                        <motion.div
                          aria-hidden={hasDraft}
                          inert={hasDraft}
                          className={`flex w-[76px] items-center justify-end gap-0 ${hasDraft ? "pointer-events-none" : ""}`}
                          animate={{ opacity: hasDraft ? 0 : 1, scale: hasDraft ? 0.85 : 1 }}
                          style={{ transformOrigin: "right center" }}
                          transition={{ duration: 0.14, ease: "easeOut" }}
                        >
                          <VoiceRecord
                            conversationId={selectedConversationId || ""}
                            disabled={hasDraft}
                            onRecordingComplete={file => updateDraftAttachments([...draftAttachmentsRef.current, file])}
                          />
                          <FileUpload
                            conversationId={selectedConversationId || ""}
                            disabled={hasDraft}
                            onFilesSelected={files => updateDraftAttachments([...draftAttachmentsRef.current, ...files])}
                            onCreatePoll={() => setCreatePollOpen(true)}
                          />
                        </motion.div>
                        <motion.div
                          aria-hidden={!hasDraft}
                          inert={!hasDraft}
                          className={`absolute right-0 flex w-[76px] justify-end ${hasDraft ? "" : "pointer-events-none"}`}
                          animate={{ opacity: hasDraft ? 1 : 0, scale: hasDraft ? 1 : 0.8 }}
                          style={{ transformOrigin: "right center" }}
                          transition={{ duration: 0.14, ease: "easeOut" }}
                        >
                          <Button
                            type="submit"
                            size="icon"
                            disabled={!hasDraft}
                            aria-label="Send message"
                            className="h-9 w-12 rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/20 transition-transform hover:scale-105 hover:bg-primary/90 active:scale-95"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </form>
              </div>
              </div>
            </> : <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-sm rounded-3xl border border-black/10 bg-card/65 p-8 text-center shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-card/60">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <h1 className="text-lg font-semibold">
                  Start or open a conversation
                </h1>

                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Select a conversation from the sidebar or create a new chat to get started.
                </p>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 h-8 px-3 text-xs"
                  onClick={() => setMessagesInfoOpen(true)}
                >
                  Where did my messages go?
                </Button>
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

      <AlertDialog
        open={messagesInfoOpen}
        onOpenChange={setMessagesInfoOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Where did my messages go?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Messages older than 3 days will be deleted automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogAction>
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
};
export default Chat;