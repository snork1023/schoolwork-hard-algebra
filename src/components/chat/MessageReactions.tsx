import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
  count: number;
}

interface MessageReactionsProps {
  messageId: string;
  currentUserId: string;
  showTrigger?: boolean;
}

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏"];

export const MessageReactions = ({ messageId, currentUserId, showTrigger = true }: MessageReactionsProps) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchReactions();

    const channel = supabase
      .channel(`reactions-${messageId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `message_id=eq.${messageId}`,
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId]);

  const fetchReactions = async () => {
    const { data, error } = await supabase
      .from("message_reactions")
      .select("id, emoji, user_id")
      .eq("message_id", messageId);

    if (error) {
      console.error("Error fetching reactions:", error);
      return;
    }

    // Group reactions by emoji
    const grouped = data.reduce((acc: Record<string, Reaction>, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          id: reaction.id,
          emoji: reaction.emoji,
          user_id: reaction.user_id,
          count: 0,
        };
      }
      acc[reaction.emoji].count++;
      return acc;
    }, {});

    setReactions(Object.values(grouped));
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

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          variant="ghost"
          size="sm"
          className={`h-7 rounded-full border px-2.5 text-xs shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
            reaction.user_id === currentUserId
              ? "border-primary/50 bg-primary/15 text-foreground"
              : "border-border/50 bg-background/45 text-muted-foreground"
          }`}
          onClick={() => handleReaction(reaction.emoji)}
          title={`React with ${reaction.emoji}`}
        >
          {reaction.emoji} {reaction.count}
        </Button>
      ))}
      {showTrigger && <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Smile className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
          <PopoverContent className="w-64 rounded-2xl border-border/50 bg-popover/95 p-3 shadow-xl backdrop-blur-md">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Add a reaction</p>
          <div className="grid grid-cols-4 gap-1.5">
            {COMMON_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                className="h-10 rounded-xl text-xl transition-transform hover:scale-110 hover:bg-secondary"
                onClick={() => handleReaction(emoji)}
                title={`React with ${emoji}`}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>}
    </div>
  );
};
