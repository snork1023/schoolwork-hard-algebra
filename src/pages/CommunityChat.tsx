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
import { VoiceRecorderInline } from "@/components/chat/VoiceRecorder";
import { ImagePreviewDialog } from "@/components/chat/ImagePreviewDialog";
import { AttachmentRenderer } from "@/components/chat/AttachmentRenderer";
import { Send, FileText } from "lucide-react";
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
  }>;
};
const CommunityChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState(true);
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();

  // Fetch username from profile
  useEffect(() => {
    if (!user) return;
    
    const fetchUsername = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      
      if (data?.username) {
        setUsername(data.username);
      }
    };
    
    fetchUsername();
  }, [user]);
  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
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
    const conversationsChannel = supabase.channel("conversations_changes").on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "conversations"
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
    const messagesChannel = supabase.channel(`chat_messages_${selectedConversationId}`).on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "chat_messages",
      filter: `conversation_id=eq.${selectedConversationId}`
    }, async payload => {
      // Fetch the profile for the new message
      const {
        data: profile
      } = await supabase.from("profiles").select("username").eq("id", payload.new.user_id).single();

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
        profiles: profile,
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
          profiles(username)
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
          username: p.profiles?.username || "Unknown"
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
  const MAX_MESSAGE_LENGTH = 5000;
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
    navigate("/auth");
  };
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>;
  }
  return <div className="h-screen bg-background flex flex-col">
      <Navigation />
      <div className="flex-1 pt-16 flex overflow-hidden">
        <ChatSidebar conversations={conversations} selectedConversationId={selectedConversationId} onSelectConversation={setSelectedConversationId} onCreateNew={() => setCreateDialogOpen(true)} onRename={handleRenameClick} onDelete={handleDeleteConversation} onLeave={handleLeaveConversation} currentUserId={user?.id || ""} userEmail={user?.email} username={username} />

        <div className="flex-1 flex flex-col">
          {selectedConversationId ? <>
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full p-4" ref={scrollRef}>
                  <div className="space-y-1 max-w-4xl mx-auto">
                    {messages.map((message, index) => {
                  const prevMessage = messages[index - 1];
                  const nextMessage = messages[index + 1];

                  // Check if this message is part of a rapid succession (within 2 minutes)
                  const isSameUserAsPrev = prevMessage?.user_id === message.user_id;
                  const isSameUserAsNext = nextMessage?.user_id === message.user_id;
                  const timeDiffFromPrev = prevMessage ? (new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) / 1000 / 60 : Infinity;
                  const timeDiffToNext = nextMessage ? (new Date(nextMessage.created_at).getTime() - new Date(message.created_at).getTime()) / 1000 / 60 : Infinity;
                  const isGroupedWithPrev = isSameUserAsPrev && timeDiffFromPrev < 2;
                  const isGroupedWithNext = isSameUserAsNext && timeDiffToNext < 2;

                  // Show header (username + time) only for first message in a group
                  const showHeader = !isGroupedWithPrev;

                  // Add extra spacing before a new group
                  const showExtraSpacing = !isGroupedWithPrev && index > 0;
                  return <div key={message.id} className={`group flex flex-col ${message.user_id === user?.id ? "items-end" : "items-start"} ${showExtraSpacing ? "mt-4" : ""}`}>
                          {showHeader && <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-sm font-medium">
                                {message.profiles?.username || "Anonymous"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(message.created_at).toLocaleTimeString()}
                                {message.edited_at && " (edited)"}
                              </span>
                            </div>}
                          <div className="flex items-start gap-2">
                            <div className={`inline-block px-4 py-2 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg ${message.user_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"} ${isGroupedWithPrev && isGroupedWithNext ? message.user_id === user?.id ? "rounded-l-lg rounded-r-md" : "rounded-r-lg rounded-l-md" : isGroupedWithPrev ? message.user_id === user?.id ? "rounded-l-lg rounded-tr-md rounded-br-lg" : "rounded-r-lg rounded-tl-md rounded-bl-lg" : isGroupedWithNext ? message.user_id === user?.id ? "rounded-l-lg rounded-tr-lg rounded-br-md" : "rounded-r-lg rounded-tl-lg rounded-bl-md" : "rounded-lg"}`}>
                              {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
                              
                              {message.attachments && message.attachments.length > 0 && <div className="mt-2 space-y-2">
                                  {message.attachments.map((attachment, idx) => <div key={idx}>
                                      <AttachmentRenderer attachment={attachment} onImageClick={(url, name) => setPreviewImage({
                              url,
                              name
                            })} />
                                    </div>)}
                                </div>}
                            </div>
                            {message.user_id === user?.id && <MessageActions messageId={message.id} content={message.content} currentUserId={user?.id || ""} onEdit={handleEditMessage} onDelete={handleDeleteMessage} showEdit={!!message.content?.trim()} />}
                          </div>
                          {!isGroupedWithNext && <ReadReceipts messageId={message.id} readBy={message.message_read_receipts?.map(r => ({
                      user_id: r.user_id,
                      username: r.profiles?.username || "Unknown",
                      read_at: r.read_at
                    })) || []} totalParticipants={participantCount} isSender={message.user_id === user?.id} />}
                        </div>;
                })}
                  </div>
                </ScrollArea>
              </div>

              <TypingIndicator typingUsers={typingUsers} />

              <div className="p-4 max-w-4xl mx-auto w-full">
                <div className="bg-secondary/30 backdrop-blur-lg rounded-2xl border border-border/30 shadow-lg">
                  <form onSubmit={handleSendMessage} className="relative">
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
                     
                    <div className="flex items-center gap-2 p-3">
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
                  }} voiceRecorderOpen={voiceRecorderOpen} setVoiceRecorderOpen={setVoiceRecorderOpen} />
                      
                      <div className="flex-1 flex items-center bg-background/60 rounded-xl border border-border/20 px-3 py-2 min-h-[44px]">
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
                      
                      <Button type="submit" disabled={!newMessage.trim() && attachments.length === 0} size="icon" className="h-10 w-10 self-center rounded-full shrink-0 bg-primary hover:bg-primary/90 shadow-md flex items-center justify-center">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </> : <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Select a conversation or create a new one to start chatting</p>
            </div>}
        </div>
      </div>

      <CreateConversationDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} currentUserId={user?.id || ""} onConversationCreated={fetchConversations} />

      <RenameConversationDialog conversation={conversationToRename} open={renameDialogOpen} onOpenChange={setRenameDialogOpen} onRenamed={fetchConversations} />

      <ImagePreviewDialog imageUrl={previewImage?.url || null} imageName={previewImage?.name} onClose={() => setPreviewImage(null)} />
    </div>;
};
export default CommunityChat;