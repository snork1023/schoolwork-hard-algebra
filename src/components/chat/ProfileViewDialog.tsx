import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/overlays/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/data-display/avatar";
import { Button } from "@/components/ui/buttons/button";
import { Loader2, User, UserCheck, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-utils";
import ProfileCard from "@/components/chat/ProfileCard";

interface ProfileViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentUserId?: string;
}

interface Profile {
  username: string;
  avatar_url: string | null;
  bio: string | null;
  pronouns: string;
  follower_count: number;
  status: string | null;
  status_message: string | null;
}

export const ProfileViewDialog = ({ open, onOpenChange, userId, currentUserId }: ProfileViewDialogProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingFollow, setUpdatingFollow] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !userId) return;

    const fetchProfile = async () => {
      setLoading(true);
      setProfile(null);
      try {
        const [profileResult, followingResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("username, avatar_url, bio, pronouns, follower_count, status, status_message")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("profile_follows")
            .select("followed_id", { count: "exact", head: true })
            .eq("follower_id", userId),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (followingResult.error) throw followingResult.error;

        setProfile(profileResult.data);
        setFollowerCount(profileResult.data?.follower_count ?? 0);
        setFollowingCount(followingResult.count ?? 0);

        if (currentUserId && currentUserId !== userId) {
          const { data, error } = await supabase
            .from("profile_follows")
            .select("follower_id")
            .eq("follower_id", currentUserId)
            .eq("followed_id", userId)
            .maybeSingle();
          if (error) throw error;
          setIsFollowing(Boolean(data));
        } else {
          setIsFollowing(false);
        }
      } catch (error: unknown) {
        toast({
          title: "Error loading profile",
          description: getUserFriendlyError(error),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [open, userId, currentUserId, toast]);

  const handleToggleFollow = async () => {
    if (!currentUserId || !userId || currentUserId === userId || updatingFollow) return;

    setUpdatingFollow(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("profile_follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("followed_id", userId);
        if (error) throw error;
        setIsFollowing(false);
        setFollowerCount((count) => Math.max(0, count - 1));
      } else {
        const { error } = await supabase
          .from("profile_follows")
          .insert({ follower_id: currentUserId, followed_id: userId });
        if (error) throw error;
        setIsFollowing(true);
        setFollowerCount((count) => count + 1);
      }
    } catch (error: unknown) {
      toast({
        title: "Error updating follow",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setUpdatingFollow(false);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "idle": return "bg-yellow-500";
      case "dnd": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-0 bg-transparent p-0 shadow-none [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-background/70 [&>button]:p-1">
        <DialogHeader className="sr-only">
          <DialogTitle>Contact card</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center rounded-3xl bg-background py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : profile ? (
          <ProfileCard className="space-y-5">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24 ring-2 ring-[var(--profile-card-subtle)] ring-offset-2 ring-offset-[var(--profile-card-surface)]">
                  {profile.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.username} />
                  ) : (
                    <AvatarFallback>
                      <User className="h-12 w-12" />
                    </AvatarFallback>
                  )}
                </Avatar>
                {profile.status && (
                  <div className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-[var(--profile-card-surface)] ${getStatusColor(profile.status)}`} />
                )}
              </div>

              <div className="space-y-1 text-center">
                <h2 className="text-2xl font-bold">{profile.username}</h2>
                {profile.status_message && (
                  <p className="text-sm italic text-[var(--profile-card-muted)]">
                    “{profile.status_message}”
                  </p>
                )}
              </div>
            </div>

            {profile.bio && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-[var(--profile-card-muted)]">About</h3>
                <p className="whitespace-pre-wrap break-words rounded-xl bg-[var(--profile-card-subtle)] p-3 text-sm">
                  {profile.bio}
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 py-2 text-center">
              <div className="space-y-1 px-2">
                <p className="font-semibold">{followerCount.toLocaleString()}</p>
                <p className="text-xs text-[var(--profile-card-muted)]">Followers</p>
              </div>
              <div className="space-y-1 px-2">
                <p className="font-semibold">{followingCount.toLocaleString()}</p>
                <p className="text-xs text-[var(--profile-card-muted)]">Following</p>
              </div>
              <div className="space-y-1 px-2">
                <p className="truncate font-semibold" title={profile.pronouns || "N/A"}>
                  {profile.pronouns || "N/A"}
                </p>
                <p className="text-xs text-[var(--profile-card-muted)]">Pronouns</p>
              </div>
            </div>

            {currentUserId && currentUserId !== userId && (
              <div className="pt-1">
                <Button
                  type="button"
                  onClick={handleToggleFollow}
                  disabled={updatingFollow}
                  variant={isFollowing ? "outline" : "default"}
                  className="h-11 w-full rounded-lg"
                >
                  {updatingFollow ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isFollowing ? (
                    <UserCheck className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              </div>
            )}
          </ProfileCard>
        ) : (
          <div className="flex items-center justify-center rounded-3xl bg-background py-12 text-muted-foreground">
            Profile not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
