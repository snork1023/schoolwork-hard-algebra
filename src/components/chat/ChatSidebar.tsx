import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Users, Edit2, Trash2, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
type ChatSidebarProps = {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onCreateNew: () => void;
  onRename: (conversation: Conversation) => void;
  onDelete: (conversationId: string) => void;
  onLeave: (conversationId: string) => void;
  currentUserId: string;
};
const ChatSidebar = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onCreateNew,
  onRename,
  onDelete,
  onLeave,
  currentUserId
}: ChatSidebarProps) => {
  const getConversationDisplay = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.type === 'dm' && conv.participants) {
      return conv.participants.map(p => p.username).join(', ');
    }
    return 'Unnamed';
  };
  return <div className="w-72 p-3 flex flex-col h-full">
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl flex flex-col h-full shadow-lg">
        <div className="p-4 border-b border-border/50">
          <Button onClick={onCreateNew} className="w-full rounded-xl" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map(conv => <div key={conv.id} className={`group flex items-center gap-2 p-3 rounded-xl cursor-pointer hover:bg-accent/50 transition-colors ${selectedConversationId === conv.id ? 'bg-accent' : ''}`} onClick={() => onSelectConversation(conv.id)}>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10">
                    {conv.type === 'group' ? <Users className="h-4 w-4 text-primary" /> : <MessageSquare className="h-4 w-4 text-primary" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-left">
                    {getConversationDisplay(conv)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {conv.type === 'dm' ? 'Direct Message' : 'Group Chat'}
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  {conv.type === 'group' && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => {
                e.stopPropagation();
                onRename(conv);
              }}>
                      <Edit2 className="h-3 w-3" />
                    </Button>}
                  {conv.created_by === currentUserId ? <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={e => {
                e.stopPropagation();
                onDelete(conv.id);
              }}>
                      <Trash2 className="h-3 w-3" />
                    </Button> : <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={e => {
                e.stopPropagation();
                onLeave(conv.id);
              }}>
                      <LogOut className="h-3 w-3" />
                    </Button>}
                </div>
              </div>)}
          </div>
        </ScrollArea>
      </div>
    </div>;
};
export default ChatSidebar;