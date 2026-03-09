import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProfileViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

interface Profile {
  username: string;
  avatar_url: string | null;
  bio: string | null;
  status: string | null;
  status_message: string | null;
}

export const ProfileViewDialog = ({ open, onOpenChange, userId }: ProfileViewDialogProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !userId) return;

    const fetchProfile = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url, bio, status, status_message")
        .eq("id", userId)
        .single();

      if (data) {
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [open, userId]);

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : profile ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  {profile.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.username} />
                  ) : (
                    <AvatarFallback>
                      <User className="h-12 w-12" />
                    </AvatarFallback>
                  )}
                </Avatar>
                {profile.status && (
                  <div className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-background ${getStatusColor(profile.status)}`} />
                )}
              </div>

              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold">{profile.username}</h2>
                {profile.status_message && (
                  <p className="text-sm text-muted-foreground italic">
                    "{profile.status_message}"
                  </p>
                )}
              </div>
            </div>

            {profile.bio && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">About</h3>
                <p className="text-sm whitespace-pre-wrap break-words bg-muted/50 p-3 rounded-lg">
                  {profile.bio}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Profile not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
