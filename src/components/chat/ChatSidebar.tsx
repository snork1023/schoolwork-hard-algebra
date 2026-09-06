import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Users, Edit2, Trash2, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusIndicator, getStatusLabel, type Status } from "./StatusIndicator";
import { StatusSelector } from "./StatusSelector";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  const getOtherParticipantStatusInfo = (conv: Conversation): { status: Status; message: string | null } => {
    if (conv.type === 'dm' && conv.participants) {
      const other = conv.participants.find(p => p.user_id !== currentUserId);
      return {
        status: (other?.status as Status) || 'offline',
        message: other?.status_message || null
      };
    }
    return { status: 'offline', message: null };
  };

  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split('@');
    if (!domain) return '••••••••';
    return '••••••••@' + domain;
  };

  return (
    <div className="flex h-full w-[min(20rem,30vw)] min-w-[17rem] flex-col">
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-black/10 bg-card/75 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-card/70">
        <div className="border-b border-border/50 p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Messages</p>
              <p className="truncate text-lg font-semibold">{username || 'User'}</p>
              <button
                onClick={() => setShowEmail(!showEmail)}
                className="block w-full truncate text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {userEmail ? (showEmail ? userEmail : maskEmail(userEmail)) : '••••••••'}
              </button>
            </div>
            <Button
              onClick={onCreateNew}
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl border border-primary/30 bg-card/75 text-primary shadow-sm backdrop-blur-md hover:bg-card/90"
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
          <div className="space-y-1 p-3">
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={`group flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-all ${selectedConversationId === conv.id ? 'border-primary/30 bg-primary/10 shadow-sm' : 'border-transparent hover:border-border/50 hover:bg-accent/50'}`}
                onClick={() => onSelectConversation(conv.id)}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative cursor-pointer">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
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
                  </TooltipTrigger>
                  {conv.type === 'dm' && (
                    <TooltipContent side="right" className="max-w-[200px]">
                      <div className="flex items-center gap-2">
                        <StatusIndicator status={getOtherParticipantStatusInfo(conv).status} size="sm" />
                        <span className="font-medium">{getStatusLabel(getOtherParticipantStatusInfo(conv).status)}</span>
                      </div>
                      {getOtherParticipantStatusInfo(conv).message && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          "{getOtherParticipantStatusInfo(conv).message}"
                        </p>
                      )}
                    </TooltipContent>
                  )}
                </Tooltip>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-left text-sm font-semibold">
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