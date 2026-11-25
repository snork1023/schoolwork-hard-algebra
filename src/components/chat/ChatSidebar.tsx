import { useState } from "react";
import { Button } from "@/components/ui/buttons/button";
import { ScrollArea } from "@/components/ui/layout/scroll-area";
import { MessageSquare, MessageSquarePlus, Users, Edit2, Trash2, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/data-display/avatar";
import { StatusIndicator, getStatusLabel, type Status } from "./StatusIndicator";
import { StatusSelector } from "./StatusSelector";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/overlays/tooltip";

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
  onContacts: () => void;
  onCreateGroup: () => void;
  contactsOpen: boolean;
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
  onContacts,
  onCreateGroup,
  contactsOpen,
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
    <div className="flex h-full w-[min(19rem,32vw)] min-w-[16rem] flex-col">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/60 px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback>
                  <User className="h-4 w-4 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{username || "User"}</p>
                <button
                  type="button"
                  onClick={() => setShowEmail(!showEmail)}
                  className="block w-full truncate text-left text-xs text-muted-foreground hover:text-foreground"
                >
                  {userEmail ? (showEmail ? userEmail : maskEmail(userEmail)) : "••••••••"}
                </button>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={onContacts}
                  variant="ghost"
                  size="icon"
                  aria-label="Contacts"
                  aria-pressed={contactsOpen}
                  className={`h-9 w-9 shrink-0 rounded-lg ${contactsOpen ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                >
                  <Users className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Contacts</TooltipContent>
            </Tooltip>
            {onUserStatusChange && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                    <StatusSelector
                      currentStatus={userStatus}
                      statusMessage={userStatusMessage ?? null}
                      userId={currentUserId}
                      onStatusChange={onUserStatusChange}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">Set your status</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex items-center justify-between px-3 pb-2 pt-4">
            <p className="text-xs font-semibold text-muted-foreground">Messages</p>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={onCreateGroup}
                    variant="ghost"
                    size="icon"
                    aria-label="Create group chat"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Create group chat</TooltipContent>
              </Tooltip>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {conversations.length}
              </span>
            </div>
          </div>
          <div className="space-y-0.5 px-2 pb-3">
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={`group flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 transition-colors ${selectedConversationId === conv.id ? 'bg-primary/10 text-foreground' : 'hover:bg-accent/60'}`}
                onClick={() => onSelectConversation(conv.id)}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative cursor-pointer">
                      <Avatar className="h-9 w-9">
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
                <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
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