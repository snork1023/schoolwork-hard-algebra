import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Users, Edit2, Trash2, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusIndicator, type Status } from "./StatusIndicator";
import { StatusSelector } from "./StatusSelector";

type Conversation = {
  id: string;
  name: string | null;
  type: 'dm' | 'group';
  created_at: string;
  created_by: string;
  participants?: Array<{
    username: string;
    user_id: string;
    status?: Status;
    status_message?: string | null;
  }>;
};

type ChatSidebarProps = {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onCreateNew: () => void;
  onRename: (conversation: Conversation) => void;
  onDelete: (conversationId: string) => void;
  onLeave: (conversationId: string) => void;
  currentUserId: string;
  userEmail?: string;
  username?: string;
  userStatus?: Status;
  userStatusMessage?: string | null;
  onUserStatusChange?: (status: Status, message: string | null) => void;
};

const ChatSidebar = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onCreateNew,
  onRename,
  onDelete,
  onLeave,
  currentUserId,
  userEmail,
  username,
  userStatus = 'offline',
  userStatusMessage,
  onUserStatusChange
}: ChatSidebarProps) => {
  const [showEmail, setShowEmail] = useState(false);

  const getConversationDisplay = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.type === 'dm' && conv.participants) {
      return conv.participants.map(p => p.username).join(', ');
    }
    return 'Unnamed';
  };

  const getOtherParticipantStatus = (conv: Conversation): Status => {
    if (conv.type === 'dm' && conv.participants) {
      const other = conv.participants.find(p => p.user_id !== currentUserId);
      return (other?.status as Status) || 'offline';
    }
    return 'offline';
  };

  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split('@');
    if (!domain) return '••••••••';
    return '••••••••@' + domain;
  };

  return (
    <div className="w-72 p-3 flex flex-col h-full">
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl flex flex-col h-full shadow-lg">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{username || 'User'}</p>
              <button
                onClick={() => setShowEmail(!showEmail)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate block w-full text-left"
              >
                {userEmail ? (showEmail ? userEmail : maskEmail(userEmail)) : '••••••••'}
              </button>
            </div>
            <Button
              onClick={onCreateNew}
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {onUserStatusChange && (
            <StatusSelector
              currentStatus={userStatus}
              statusMessage={userStatusMessage}
              userId={currentUserId}
              onStatusChange={onUserStatusChange}
            />
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 p-3 rounded-xl cursor-pointer hover:bg-accent/50 transition-colors ${selectedConversationId === conv.id ? 'bg-accent' : ''}`}
                onClick={() => onSelectConversation(conv.id)}
              >
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10">
                      {conv.type === 'group' ? <Users className="h-4 w-4 text-primary" /> : <MessageSquare className="h-4 w-4 text-primary" />}
                    </AvatarFallback>
                  </Avatar>
                  {conv.type === 'dm' && (
                    <StatusIndicator
                      status={getOtherParticipantStatus(conv)}
                      size="sm"
                      className="absolute -bottom-0.5 -right-0.5"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-left">
                    {getConversationDisplay(conv)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {conv.type === 'dm' ? 'Direct Message' : 'Group Chat'}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  {conv.type === 'group' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={e => {
                        e.stopPropagation();
                        onRename(conv);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                  {conv.created_by === currentUserId ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:text-destructive"
                      onClick={e => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:text-destructive"
                      onClick={e => {
                        e.stopPropagation();
                        onLeave(conv.id);
                      }}
                    >
                      <LogOut className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ChatSidebar;