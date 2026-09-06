import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2, Trash2, Check, X, Smile } from "lucide-react";
import { Info } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type MessageActionsProps = {
  messageId: string;
  content: string;
  currentUserId: string;
  onEdit: (messageId: string, newContent: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  showEdit?: boolean;
  showDelete?: boolean;
  createdAt?: string;
  senderName?: string;
  readBy?: Array<{ username: string; read_at: string }>;
  className?: string;
  isEditing?: boolean;
  onEditingChange?: (value: boolean) => void;
};

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏"];

const MessageActions = ({ messageId, content, currentUserId, onEdit, onDelete, showEdit = true, showDelete = true, createdAt, senderName, readBy = [], className, isEditing: controlledIsEditing, onEditingChange }: MessageActionsProps) => {
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [loading, setLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const { toast } = useToast();

  const isEditing = controlledIsEditing ?? internalIsEditing;

  useEffect(() => {
    setEditContent(content);
  }, [content]);

  const updateEditingState = (value: boolean) => {
    if (onEditingChange) {
      onEditingChange(value);
      return;
    }
    setInternalIsEditing(value);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === content) {
      updateEditingState(false);
      return;
    }

    setLoading(true);
    try {
      await onEdit(messageId, editContent.trim());
      updateEditingState(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(content);
    updateEditingState(false);
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
      <div className="mt-2 flex w-full max-w-md items-center gap-2 rounded-2xl border border-primary/30 bg-background/70 p-2 shadow-lg backdrop-blur-sm">
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
          className="h-9 flex-1 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
          autoFocus
        />
        <Button
          size="icon"
          variant="default"
          onClick={handleSaveEdit}
          disabled={loading || !editContent.trim()}
          className="h-9 w-9 shrink-0 rounded-xl"
          title="Save edit"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={handleCancelEdit}
          disabled={loading}
          className="h-9 w-9 shrink-0 rounded-xl"
          title="Cancel edit"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className || "h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="z-50 min-w-[180px] rounded-2xl border border-border/60 bg-popover/80 p-1 shadow-2xl backdrop-blur-xl">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="rounded-lg focus:bg-accent/80">
            <Smile className="mr-2 h-4 w-4" />
            React
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="rounded-xl border border-border/60 bg-popover/90 p-2 shadow-xl backdrop-blur-md">
              <div className="grid grid-cols-4 gap-1">
                {COMMON_EMOJIS.map((emoji) => (
                  <Button
                    key={emoji}
                    variant="ghost"
                    className="h-8 w-8 p-0 text-lg hover:bg-secondary/80"
                    onClick={() => handleReaction(emoji)}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuItem
          onSelect={() => setInfoOpen(true)}
          className="rounded-lg focus:bg-accent/80"
        >
          <Info className="mr-2 h-4 w-4" />
          Message info
        </DropdownMenuItem>
        {showEdit && (
          <DropdownMenuItem onClick={() => updateEditingState(true)} className="rounded-lg focus:bg-accent/80">
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
        )}
        {showDelete && (
          <DropdownMenuItem
            onClick={handleDelete}
            className="rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
      <DialogContent className="max-w-sm border border-border/60 bg-card/90 shadow-xl backdrop-blur-md">
        <DialogHeader>
          <DialogTitle>Message info</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sent</p>
            <p className="mt-1 font-medium">{senderName || "Unknown"}</p>
            {createdAt && <p className="text-xs text-muted-foreground">{new Date(createdAt).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Seen by</p>
            {readBy.length > 0 ? (
              <div className="mt-2 space-y-2">
                {readBy.map((reader) => (
                  <div key={`${reader.username}-${reader.read_at}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2">
                    <span>{reader.username}</span>
                    <span className="text-xs text-muted-foreground">{new Date(reader.read_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-muted-foreground">No one has seen this yet.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default MessageActions;
