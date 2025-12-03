import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import { User } from "@supabase/supabase-js";
import ChatSidebar from "@/components/chat/ChatSidebar";
import CreateConversationDialog from "@/components/chat/CreateConversationDialog";
import RenameConversationDialog from "@/components/chat/RenameConversationDialog";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ReadReceipts from "@/components/chat/ReadReceipts";
import MessageActions from "@/components/chat/MessageActions";
import { FileUpload } from "@/components/chat/FileUpload";
import { MessageReactions } from "@/components/chat/MessageReactions";
import { Send, Image as ImageIcon, FileText, Video } from "lucide-react";

type Message = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  conversation_id: string;
  edited_at: string | null;
  attachments?: Array<{ url: string; type: string; name: string }>;
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
  participants?: Array<{ username: string }>;
};

const CommunityChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState<Array<{ url: string; type: string; name: string }>>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [conversationToRename, setConversationToRename] = useState<Conversation | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    fetchConversations();

    // Subscribe to conversation changes
    const conversationsChannel = supabase
      .channel("conversations_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    // Subscribe to participant changes (for when new DMs/groups are created)
    const participantsChannel = supabase
      .channel("participants_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [user, toast]);

  useEffect(() => {
    if (!user || !selectedConversationId) return;

    fetchMessages();
    fetchParticipantCount();

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel(`chat_messages_${selectedConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        async (payload) => {
          // Fetch the profile for the new message
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", payload.new.user_id)
            .single();

          setMessages((current) => [
            ...current,
            { ...payload.new, profiles: profile, message_read_receipts: [] } as Message,
          ]);
        }
      )
      .subscribe();

    // Subscribe to presence for typing indicators
    const presenceChannel = supabase
      .channel(`presence_${selectedConversationId}`, {
        config: { presence: { key: user.id } },
      })
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const typing = Object.values(state)
          .flat()
          .filter((presence: any) => presence.typing && presence.user_id !== user.id)
          .map((presence: any) => presence.username);
        setTypingUsers(typing);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user, selectedConversationId, toast]);

  const fetchParticipantCount = async () => {
    if (!selectedConversationId) return;

    const { count, error } = await supabase
      .from("conversation_participants")
      .select("*", { count: 'exact', head: true })
      .eq("conversation_id", selectedConversationId);

    if (!error && count !== null) {
      setParticipantCount(count);
    }
  };

  const fetchConversations = async () => {
    if (!user) return;

    // First get conversation IDs where user is a participant
    const { data: participantData, error: participantError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (participantError) {
      toast({
        title: "Error loading conversations",
        description: participantError.message,
        variant: "destructive",
      });
      return;
    }

    if (!participantData || participantData.length === 0) {
      setConversations([]);
      return;
    }

    const conversationIds = participantData.map((p) => p.conversation_id);

    // Then get full conversation details with all participants
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        *,
        conversation_participants(
          user_id,
          profiles(username)
        )
      `)
      .in("id", conversationIds)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading conversations",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const formattedConversations = (data || []).map((conv: any) => ({
        id: conv.id,
        name: conv.name,
        type: conv.type,
        created_at: conv.created_at,
        created_by: conv.created_by,
        participants: (conv.conversation_participants || [])
          .filter((p: any) => p.user_id !== user?.id)
          .map((p: any) => ({ username: p.profiles?.username || "Unknown" })),
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

    const { data, error } = await supabase
      .from("chat_messages")
      .select(`
        *,
        profiles(username),
        message_read_receipts(
          user_id,
          read_at,
          profiles(username)
        )
      `)
      .eq("conversation_id", selectedConversationId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      toast({
        title: "Error loading messages",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const formattedMessages = (data || []).map((msg: any) => ({
        ...msg,
        attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
      }));
      setMessages(formattedMessages);
      
      // Mark messages as read
      const unreadMessages = formattedMessages.filter(
        (msg) => msg.user_id !== user.id && 
        !msg.message_read_receipts?.some((r) => r.user_id === user.id)
      );

      if (unreadMessages.length > 0) {
        const receipts = unreadMessages.map((msg) => ({
          message_id: msg.id,
          user_id: user.id,
        }));

        await supabase.from("message_read_receipts").insert(receipts);
      }
    }
  };

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleTyping = async () => {
    if (!user || !selectedConversationId) return;

    const channel = supabase.channel(`presence_${selectedConversationId}`);
    
    await channel.track({
      user_id: user.id,
      username: (await supabase.from("profiles").select("username").eq("id", user.id).single()).data?.username,
      typing: true,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      await channel.track({
        user_id: user.id,
        typing: false,
      });
    }, 2000);
  };

  const MAX_MESSAGE_LENGTH = 5000;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && attachments.length === 0) || !user || !selectedConversationId) return;

    if (newMessage.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: "Message too long",
        description: `Maximum ${MAX_MESSAGE_LENGTH} characters allowed`,
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("chat_messages").insert({
        user_id: user.id,
        content: newMessage.trim(),
        conversation_id: selectedConversationId,
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
      });

      if (error) throw error;

      setNewMessage("");
      setAttachments([]);
      
      // Stop typing indicator
      const channel = supabase.channel(`presence_${selectedConversationId}`);
      await channel.track({
        user_id: user.id,
        typing: false,
      });
    } catch (error: any) {
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive",
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
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);

      if (error) throw error;

      toast({
        title: "Conversation deleted",
      });

      // Clear selection if deleted conversation was selected
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }

      fetchConversations();
    } catch (error: any) {
      toast({
        title: "Error deleting conversation",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLeaveConversation = async (conversationId: string) => {
    if (!window.confirm("Are you sure you want to leave this conversation?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("conversation_participants")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", user?.id);

      if (error) throw error;

      toast({
        title: "Left conversation",
      });

      // Clear selection if left conversation was selected
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }

      fetchConversations();
    } catch (error: any) {
      toast({
        title: "Error leaving conversation",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      const { error } = await supabase
        .from("chat_messages")
        .update({ 
          content: newContent,
          edited_at: new Date().toISOString(),
        })
        .eq("id", messageId);

      if (error) throw error;

      // Update local state
      setMessages((current) =>
        current.map((msg) =>
          msg.id === messageId
            ? { ...msg, content: newContent, edited_at: new Date().toISOString() }
            : msg
        )
      );

      toast({
        title: "Message updated",
      });
    } catch (error: any) {
      toast({
        title: "Error updating message",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("chat_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;

      // Update local state
      setMessages((current) => current.filter((msg) => msg.id !== messageId));

      toast({
        title: "Message deleted",
      });
    } catch (error: any) {
      toast({
        title: "Error deleting message",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <Navigation />
      <div className="flex-1 pt-16 flex overflow-hidden">
        <ChatSidebar
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          onCreateNew={() => setCreateDialogOpen(true)}
          onRename={handleRenameClick}
          onDelete={handleDeleteConversation}
          onLeave={handleLeaveConversation}
          currentUserId={user?.id || ""}
        />

        <div className="flex-1 flex flex-col">
          {selectedConversationId ? (
            <>
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full p-4" ref={scrollRef}>
                  <div className="space-y-4 max-w-4xl mx-auto">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`group flex flex-col ${
                          message.user_id === user?.id ? "items-end" : "items-start"
                        }`}
                      >
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {message.profiles?.username || "Anonymous"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.created_at).toLocaleTimeString()}
                            {message.edited_at && " (edited)"}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div
                            className={`inline-block rounded-lg px-4 py-2 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg ${
                              message.user_id === user?.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
                            
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {message.attachments.map((attachment, idx) => (
                                  <div key={idx}>
                                    {attachment.type.startsWith("image/") ? (
                                      <img
                                        src={attachment.url}
                                        alt={attachment.name}
                                        className="rounded-lg max-w-xs max-h-64 object-cover"
                                      />
                                    ) : attachment.type.startsWith("video/") ? (
                                      <video
                                        src={attachment.url}
                                        controls
                                        className="rounded-lg max-w-xs max-h-64"
                                      />
                                    ) : (
                                      <a
                                        href={attachment.url}
                                        download
                                        className="flex items-center gap-2 p-2 bg-background/50 rounded hover:bg-background/80 transition-colors"
                                      >
                                        <FileText className="h-4 w-4" />
                                        <span className="text-sm">{attachment.name}</span>
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {message.user_id === user?.id && (
                            <MessageActions
                              messageId={message.id}
                              content={message.content}
                              onEdit={handleEditMessage}
                              onDelete={handleDeleteMessage}
                            />
                          )}
                        </div>
                        <ReadReceipts
                          messageId={message.id}
                          readBy={message.message_read_receipts?.map(r => ({
                            user_id: r.user_id,
                            username: r.profiles?.username || "Unknown",
                            read_at: r.read_at,
                          })) || []}
                          totalParticipants={participantCount}
                          isSender={message.user_id === user?.id}
                        />
                        <MessageReactions
                          messageId={message.id}
                          currentUserId={user?.id || ""}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <TypingIndicator typingUsers={typingUsers} />

              <form onSubmit={handleSendMessage} className="p-4 border-t max-w-4xl mx-auto w-full">
                {attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {attachments.map((attachment, idx) => (
                      <div key={idx} className="relative inline-block">
                        {attachment.type.startsWith("image/") ? (
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="h-20 w-20 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="h-20 w-20 bg-secondary rounded-lg flex items-center justify-center">
                            <FileText className="h-8 w-8" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <FileUpload
                    onFilesSelected={(files) => {
                      setAttachments([...attachments, ...files]);
                    }}
                  />
                  <Textarea
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder="Type your message... (Shift+Enter for new line)"
                    className="flex-1 min-h-[40px] max-h-[120px] resize-none"
                    rows={1}
                  />
                  <Button type="submit" disabled={!newMessage.trim() && attachments.length === 0} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Select a conversation or create a new one to start chatting</p>
            </div>
          )}
        </div>
      </div>

      <CreateConversationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        currentUserId={user?.id || ""}
        onConversationCreated={fetchConversations}
      />

      <RenameConversationDialog
        conversation={conversationToRename}
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        onRenamed={fetchConversations}
      />
    </div>
  );
};

export default CommunityChat;