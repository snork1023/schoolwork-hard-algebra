import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BarChart3, Check, Users, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Poll {
  id: string;
  question: string;
  options: string[];
  multiple_choice: boolean;
  anonymous: boolean;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  profiles?: {
    username: string;
  };
}

interface PollVote {
  id: string;
  poll_id: string;
  user_id: string;
  option_index: number;
  profiles?: {
    username: string;
  };
}

interface PollCardProps {
  poll: Poll;
  currentUserId: string;
  votes: PollVote[];
  onVotesChange: () => void;
  creatorUsername?: string;
}

export const PollCard = ({ poll, currentUserId, votes, onVotesChange, creatorUsername }: PollCardProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);

  const userVotes = votes.filter(v => v.user_id === currentUserId);
  const hasVoted = userVotes.length > 0;
  const totalVoters = new Set(votes.map(v => v.user_id)).size;
  const isCreator = poll.created_by === currentUserId;

  useEffect(() => {
    // Pre-select user's existing votes
    setSelectedOptions(userVotes.map(v => v.option_index));
  }, [votes, currentUserId]);

  const getVotesForOption = (index: number) => {
    return votes.filter(v => v.option_index === index).length;
  };

  const getPercentage = (index: number) => {
    const total = votes.length;
    if (total === 0) return 0;
    return Math.round((getVotesForOption(index) / total) * 100);
  };

  const getVotersForOption = (index: number) => {
    if (poll.anonymous) return [];
    return votes
      .filter(v => v.option_index === index)
      .map(v => v.profiles?.username || "Unknown");
  };

  const handleVote = async (optionIndex: number) => {
    setLoading(true);
    try {
      const alreadyVoted = userVotes.some(v => v.option_index === optionIndex);
      
      if (alreadyVoted) {
        // Remove vote
        await supabase
          .from("poll_votes")
          .delete()
          .eq("poll_id", poll.id)
          .eq("user_id", currentUserId)
          .eq("option_index", optionIndex);
      } else {
        // For single choice, remove existing votes first
        if (!poll.multiple_choice && hasVoted) {
          await supabase
            .from("poll_votes")
            .delete()
            .eq("poll_id", poll.id)
            .eq("user_id", currentUserId);
        }
        
        // Add new vote
        await supabase.from("poll_votes").insert({
          poll_id: poll.id,
          user_id: currentUserId,
          option_index: optionIndex,
        });
      }
      
      onVotesChange();
    } catch (error) {
      console.error("Vote error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this poll?")) return;
    
    try {
      await supabase.from("polls").delete().eq("id", poll.id);
      onVotesChange();
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  return (
    <div className={cn(
      "border rounded-lg p-4 max-w-md w-full",
      isCreator ? "bg-primary/10 border-primary/30" : "bg-card"
    )}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-purple-500 shrink-0" />
          <span className="text-xs text-muted-foreground">
            {creatorUsername || (poll.profiles?.username) || "Someone"} created a poll
          </span>
        </div>
        {isCreator && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>
      
      <h3 className="font-semibold text-sm mb-3">{poll.question}</h3>

      <div className="space-y-2">
        {poll.options.map((option, index) => {
          const isSelected = selectedOptions.includes(index);
          const voteCount = getVotesForOption(index);
          const percentage = getPercentage(index);
          const voters = getVotersForOption(index);

          return (
            <button
              key={index}
              onClick={() => handleVote(index)}
              disabled={loading}
              className={cn(
                "w-full text-left p-2 rounded-lg border transition-all relative overflow-hidden",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              {/* Background progress bar */}
              {hasVoted && (
                <div
                  className="absolute inset-0 bg-primary/10 transition-all"
                  style={{ width: `${percentage}%` }}
                />
              )}
              
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                    poll.multiple_choice ? "rounded" : "rounded-full",
                    isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                  )}>
                    {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </div>
                  <span className="text-sm truncate">{option}</span>
                </div>
                
                {hasVoted && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-muted-foreground">{voteCount}</span>
                    <span className="text-xs font-medium">{percentage}%</span>
                  </div>
                )}
              </div>

              {/* Show voters on hover if not anonymous */}
              {!poll.anonymous && voters.length > 0 && hasVoted && (
                <div className="relative mt-1 text-xs text-muted-foreground truncate">
                  {voters.slice(0, 3).join(", ")}
                  {voters.length > 3 && ` +${voters.length - 3} more`}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span>{totalVoters} vote{totalVoters !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          {poll.multiple_choice && (
            <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">Multiple choice</span>
          )}
          {poll.anonymous && (
            <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">Anonymous</span>
          )}
        </div>
      </div>
    </div>
  );
};
