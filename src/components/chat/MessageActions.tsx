import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Trash2, Check, X, Smile } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type MessageActionsProps = {
  messageId: string;
  content: string;
  currentUserId: string;
  onEdit: (messageId: string, newContent: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  showEdit?: boolean;
  showDelete?: boolean;
};

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏"];

const MessageActions = ({ messageId, content, currentUserId, onEdit, onDelete, showEdit = true, showDelete = true }: MessageActionsProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === content) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    try {
      await onEdit(messageId, editContent.trim());
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this message?")) {
      return;
    }

    setLoading(true);
    try {
      await onDelete(messageId);
    } finally {
      setLoading(false);
    }
  };

  const handleReaction = async (emoji: string) => {
    // Check if user already reacted with this emoji
    const { data: existing } = await supabase
      .from("message_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", currentUserId)
      .eq("emoji", emoji)
      .single();

    if (existing) {
      // Remove reaction
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("id", existing.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to remove reaction",
          variant: "destructive",
        });
      }
    } else {
      // Add reaction
      const { error } = await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: currentUserId,
        emoji,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to add reaction",
          variant: "destructive",
        });
      }
    }
  };

  if (isEditing) {
    return (
      <div className="flex gap-2 items-center mt-2">
        <Input
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSaveEdit();
            } else if (e.key === "Escape") {
              handleCancelEdit();
            }
          }}
          disabled={loading}
          className="flex-1"
          autoFocus
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSaveEdit}
          disabled={loading || !editContent.trim()}
          className="h-8 w-8"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCancelEdit}
          disabled={loading}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover z-50">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Smile className="mr-2 h-4 w-4" />
            React
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="bg-popover">
              <div className="grid grid-cols-4 gap-1 p-2">
                {COMMON_EMOJIS.map((emoji) => (
                  <Button
                    key={emoji}
                    variant="ghost"
                    className="h-8 w-8 p-0 text-lg hover:bg-secondary"
                    onClick={() => handleReaction(emoji)}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        {showEdit && (
          <DropdownMenuItem onClick={() => setIsEditing(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
        )}
        {showDelete && (
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MessageActions;
