import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Camera, User, KeyRound, LogOut, Trash2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router";
import { useToast } from "@/hooks/use-toast";
import { ScrollRevealCard } from "@/components/ScrollRevealCard";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";

const usernameSchema = z.string().trim().min(1, "Username is required").max(20, "Username must be 20 characters or less");

const DELETE_HOLD_DURATION_MS = 3000;

const Account = () => {
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteHoldProgress, setDeleteHoldProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deleteHoldFrameRef = useRef<number | null>(null);
  const deleteHoldStartRef = useRef<number | null>(null);
  
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
        setPageLoading(false);
        setNeedsAuth(true);
      }
    });

    // Fallback: explicitly fetch the current session so we never get stuck
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;

      if (!session) {
        setPageLoading(false);
        setNeedsAuth(true);
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email || "");
      fetchProfile(session.user.id);
      setPageLoading(false);
    }).catch(() => {
      if (!active) return;
      setPageLoading(false);
      setNeedsAuth(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

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
    if (!currentPassword) {
      toast({
        title: "Error",
        description: "Please enter your current password",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 8) { 
      toast({ 
        title: "Error", 
        description: "New password must be at least 8 characters", 
        variant: "destructive", 
      }); 
      return; 
    }

    // Check for at least one number
    if (!/\d/.test(newPassword)) {
      toast({
        title: "Error",
        description: "New password must contain at least one number",
        variant: "destructive",
      });
      return;
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(newPassword)) {
      toast({
        title: "Error",
        description: "New password must contain at least one lowercase letter",
        variant: "destructive",
      });
      return;
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(newPassword)) {
      toast({
        title: "Error",
        description: "New password must contain at least one uppercase letter",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    // This project requires the current password when setting a new one.
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordDialogOpen(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setNeedsAuth(true);
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

  // Cancels the hold-to-delete progress and resets the fill bar
  const cancelDeleteHold = useCallback(() => {
    if (deleteHoldFrameRef.current !== null) {
      cancelAnimationFrame(deleteHoldFrameRef.current);
      deleteHoldFrameRef.current = null;
    }
    deleteHoldStartRef.current = null;
    setDeleteHoldProgress(0);
  }, []);

  // Tracks a press-and-hold on the delete button; only fires the actual
  // deletion once the user has held for the full DELETE_HOLD_DURATION_MS
  const startDeleteHold = useCallback(() => {
    if (loading) return;
    deleteHoldStartRef.current = Date.now();

    const tick = () => {
      if (deleteHoldStartRef.current === null) return;
      const elapsed = Date.now() - deleteHoldStartRef.current;
      const progress = Math.min((elapsed / DELETE_HOLD_DURATION_MS) * 100, 100);
      setDeleteHoldProgress(progress);

      if (progress >= 100) {
        deleteHoldFrameRef.current = null;
        deleteHoldStartRef.current = null;
        handleDeleteAccount();
        return;
      }

      deleteHoldFrameRef.current = requestAnimationFrame(tick);
    };

    deleteHoldFrameRef.current = requestAnimationFrame(tick);
  }, [loading]);

  // Reset hold progress whenever the delete dialog is closed
  const handleDeleteDialogChange = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      cancelDeleteHold();
    }
  };

  // Reset password fields whenever the dialog is closed (cancel, success, or outside click)
  const handlePasswordDialogChange = (open: boolean) => {
    setPasswordDialogOpen(open);
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  };

  // Ensure any in-flight hold animation frame is cancelled on unmount
  useEffect(() => {
    return () => {
      if (deleteHoldFrameRef.current !== null) {
        cancelAnimationFrame(deleteHoldFrameRef.current);
      }
    };
  }, []);

  if (pageLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Loading account…</p>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen">
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-bold glow-text">You must be signed in</h1>
          <p className="text-muted-foreground max-w-sm">
            Sign in to view and manage your account settings.
          </p>
          <Button asChild>
            <Link to="/auth">Go to Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 glow-text">Account</h1>
          <p className="text-muted-foreground mb-8">
            Manage your account settings
          </p>

          <div className="space-y-6">
            {/* Profile: identity-related fields grouped together */}
            <ScrollRevealCard delay={0}>
              <Card className="bg-card border-border shadow-lg hover-glow">
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>
                    Your public identity and account information
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
                        Max 5MB • JPG, PNG, JPEG, WEBP
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="flex gap-2">
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
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

                {/* Email moved below the editable fields since it's read-only */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label>Email</Label>
                  <Input value={userEmail} disabled />
                </div>
                </CardContent>
              </Card>
            </ScrollRevealCard>

            {/* Privacy & Security combined: both are "who can access my account" concerns */}
            <ScrollRevealCard delay={80}>
              <Card className="bg-card border-border shadow-lg hover-glow">
                <CardHeader>
                  <CardTitle>Privacy & Security</CardTitle>
                  <CardDescription>
                    Control who can find you and keep your account secure
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

                {/* Password change now lives in a popup so it doesn't clutter the page with two extra fields */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="space-y-0.5">
                    <Label>Password</Label>
                    <p className="text-sm text-muted-foreground">
                      Change the password used to sign in
                    </p>
                  </div>
                  <Dialog open={passwordDialogOpen} onOpenChange={handlePasswordDialogChange}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <KeyRound className="h-4 w-4 mr-2" />
                        Change Password
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>
                          Enter your current password and a new password (at least 8 characters).
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="current-password">Current Password</Label>
                          <div className="relative">
                            <Input
                              id="current-password"
                              type={showCurrentPassword ? "text" : "password"}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="Enter current password"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword((prev) => !prev)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                              aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                            >
                              {showCurrentPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <div className="relative">
                            <Input
                              id="new-password"
                              type={showNewPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Enter new password"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword((prev) => !prev)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                              aria-label={showNewPassword ? "Hide password" : "Show password"}
                            >
                              {showNewPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">Confirm Password</Label>
                          <div className="relative">
                            <Input
                              id="confirm-password"
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Confirm new password"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword((prev) => !prev)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => handlePasswordDialogChange(false)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleUpdatePassword} disabled={loading}>
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Update Password
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                </CardContent>
              </Card>
            </ScrollRevealCard>

            {/* Account Actions: destructive/session actions kept separate and last */}
            <ScrollRevealCard delay={160}>
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
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
                
                <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your
                        account and remove all your data from our servers. Press and hold
                        the button below for 3 seconds to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <button
                        type="button"
                        disabled={loading}
                        onPointerDown={startDeleteHold}
                        onPointerUp={cancelDeleteHold}
                        onPointerLeave={cancelDeleteHold}
                        onPointerCancel={cancelDeleteHold}
                        className={cn(
                          buttonVariants({ variant: "destructive" }),
                          "relative overflow-hidden select-none touch-none"
                        )}
                      >
                        <span
                          className="absolute inset-y-0 left-0 bg-white/25"
                          style={{
                            width: `${deleteHoldProgress}%`,
                            transition: deleteHoldProgress === 0 ? "width 150ms ease-out" : "none",
                          }}
                        />
                        <span className="relative flex items-center gap-2">
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          {deleteHoldProgress > 0 ? "Keep holding…" : "Hold to Delete Account"}
                        </span>
                      </button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                </CardContent>
              </Card>
            </ScrollRevealCard>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Account;