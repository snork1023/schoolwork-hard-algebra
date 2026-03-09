import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Camera, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/error-utils";

const usernameSchema = z.string().trim().min(1, "Username is required").max(50, "Username must be 50 characters or less");

const Account = () => {
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [discoverable, setDiscoverable] = useState(true);
  const [discoverableLoading, setDiscoverableLoading] = useState(false);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchProfile = useCallback(async (uid: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, discoverable, bio, avatar_url")
      .eq("id", uid)
      .single();
    if (profile) {
      setUsername(profile.username || "");
      setDiscoverable(profile.discoverable ?? true);
      setBio(profile.bio || "");
      setAvatarUrl(profile.avatar_url);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "SIGNED_IN" && session) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || "");
        fetchProfile(session.user.id);
        setPageLoading(false);
      } else if (event === "SIGNED_OUT") {
        setUserId(null);
        setUserEmail("");
        navigate("/auth");
      }
    });

    // Fallback: explicitly fetch the current session so we never get stuck
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;

      if (!session) {
        setPageLoading(false);
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email || "");
      fetchProfile(session.user.id);
      setPageLoading(false);
    }).catch(() => {
      if (!active) return;
      setPageLoading(false);
      navigate("/auth");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate, fetchProfile]);

  const handleToggleDiscoverable = async (checked: boolean) => {
    if (!userId) return;
    
    setDiscoverableLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ discoverable: checked })
      .eq("id", userId);
    
    setDiscoverableLoading(false);
    
    if (error) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } else {
      setDiscoverable(checked);
      toast({
        title: "Privacy updated",
        description: checked 
          ? "Others can now find you when creating new chats" 
          : "You are now hidden from new chat searches",
      });
    }
  };

  const handleUpdateUsername = async () => {
    if (!userId) return;
    
    // Validate username with zod schema
    const result = usernameSchema.safeParse(username);
    if (!result.success) {
      toast({
        title: "Validation Error",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: result.data })
      .eq("id", userId);
    
    setLoading(false);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to update username",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Username updated successfully",
      });
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    setLoading(false);
    
    if (error) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setAvatarLoading(true);

    try {
      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("avatars").remove([`${userId}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast({
        title: "Success",
        description: "Profile picture updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUpdateBio = async () => {
    if (!userId) return;

    if (bio.length > 500) {
      toast({
        title: "Error",
        description: "Bio must be 500 characters or less",
        variant: "destructive",
      });
      return;
    }

    setBioLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ bio: bio.trim() })
      .eq("id", userId);

    setBioLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Bio updated successfully",
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    
    setLoading(true);
    
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);
    
    if (profileError) {
      toast({
        title: "Error",
        description: "Failed to delete account",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    
    await supabase.auth.signOut();
    setLoading(false);
    
    toast({
      title: "Account Deleted",
      description: "Your account has been permanently deleted",
    });
    
    navigate("/auth");
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Loading account…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 glow-text">Account</h1>
          <p className="text-muted-foreground mb-8">
            Manage your account settings
          </p>

          <div className="space-y-6">
            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  Your account information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Profile Picture</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt={username} />
                      ) : (
                        <AvatarFallback>
                          <User className="h-10 w-10" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarLoading}
                      >
                        {avatarLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Camera className="h-4 w-4 mr-2" />
                        )}
                        Upload Picture
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Max 5MB • JPG, PNG, GIF
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={userEmail} disabled />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="username">Nickname</Label>
                  <div className="flex gap-2">
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your nickname"
                    />
                    <Button onClick={handleUpdateUsername} disabled={loading}>
                      Update
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    className="resize-none min-h-[100px]"
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {bio.length}/500 characters
                    </p>
                    <Button 
                      size="sm" 
                      onClick={handleUpdateBio} 
                      disabled={bioLoading}
                    >
                      {bioLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Update Bio
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle>Privacy</CardTitle>
                <CardDescription>
                  Control who can find and message you
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="discoverable">Allow message requests</Label>
                    <p className="text-sm text-muted-foreground">
                      When off, you won't appear in user searches and others can't start new chats with you
                    </p>
                  </div>
                  <Switch
                    id="discoverable"
                    checked={discoverable}
                    onCheckedChange={handleToggleDiscoverable}
                    disabled={discoverableLoading}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                  Update your password
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
                <Button onClick={handleUpdatePassword} disabled={loading}>
                  Update Password
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle>Account Actions</CardTitle>
                <CardDescription>
                  Sign out or delete your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  variant="outline" 
                  onClick={handleSignOut}
                  className="w-full"
                >
                  Sign Out
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your
                        account and remove all your data from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} disabled={loading}>
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Account;