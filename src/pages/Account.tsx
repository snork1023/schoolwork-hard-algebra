import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Button as StatefulButton } from "@/components/ui/stateful-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Camera, User, Eye, EyeOff, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router";
import { useToast } from "@/hooks/use-toast";
import { ScrollRevealCard } from "@/components/ScrollRevealCard";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { compressImageFile } from "@/lib/image-utils";

const usernameSchema = z.string().trim().min(1, "Username is required").max(20, "Username must be 20 characters or less");

const DELETE_HOLD_DURATION_MS = 3000;

// A single settings row: label/description on the left, control on the right
const SettingsRow = ({
  label,
  description,
  children,
  align = "center",
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  align?: "center" | "start";
}) => (
  <div className={cn("flex gap-4 py-4", align === "start" ? "items-start" : "items-center", "flex-col sm:flex-row sm:justify-between")}>
    <div className="min-w-0">
      <Label className="text-sm font-medium">{label}</Label>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
    <div className="w-full sm:w-auto sm:max-w-[280px] shrink-0">{children}</div>
  </div>
);

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
  const [avatarHovering, setAvatarHovering] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteHoldProgress, setDeleteHoldProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deleteHoldFrameRef = useRef<number | null>(null);
  const deleteHoldStartRef = useRef<number | null>(null);
  const deleteStartedRef = useRef(false);

  // Last-saved values. The profile form is "dirty" (and shows the single
  // Save bar) when either of these differs from current state.
  const [savedProfile, setSavedProfile] = useState({ username: "", bio: "" });

  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchProfile = useCallback(async (uid: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, discoverable, bio, avatar_url")
      .eq("id", uid)
      .single();
    if (profile) {
      const savedUsername = profile.username || "";
      const savedBio = profile.bio || "";
      setUsername(savedUsername);
      setSavedProfile({ username: savedUsername, bio: savedBio });
      setDiscoverable(profile.discoverable ?? true);
      setBio(savedBio);
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

  // Single save action for the whole profile form (username + bio).
  const handleSaveProfile = async () => {
    if (!userId) return;

    const updates: { username?: string; bio?: string } = {};

    const trimmedUsername = username.trim();
    if (trimmedUsername !== savedProfile.username) {
      const result = usernameSchema.safeParse(trimmedUsername);
      if (!result.success) {
        toast({
          title: "Validation Error",
          description: result.error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
      updates.username = result.data;
    }

    const trimmedBio = bio.trim();
    if (trimmedBio !== savedProfile.bio) {
      if (bio.length > 500) {
        toast({
          title: "Error",
          description: "Bio must be 500 characters or less",
          variant: "destructive",
        });
        return;
      }
      updates.bio = trimmedBio;
    }

    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
      return;
    }

    if (updates.username !== undefined) {
      setUsername(updates.username);
    }
    if (updates.bio !== undefined) {
      setBio(updates.bio);
    }
    setSavedProfile((profile) => ({
      username: updates.username ?? profile.username,
      bio: updates.bio ?? profile.bio,
    }));
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
      const compressedFile = await compressImageFile(file, {
        maxWidth: 1200,
        quality: 0.75,
        maxSizeMB: 1,
      });

      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("avatars").remove([`${userId}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = compressedFile.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressedFile);

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

  // Removes the current profile picture entirely (storage object + profile column)
  const handleRemoveAvatar = async () => {
    if (!userId || !avatarUrl || avatarLoading) return;

    setAvatarLoading(true);

    try {
      const oldPath = avatarUrl.split("/").pop();
      if (oldPath) {
        await supabase.storage.from("avatars").remove([`${userId}/${oldPath}`]);
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);

      if (updateError) throw updateError;

      setAvatarUrl(null);
      toast({
        title: "Success",
        description: "Profile picture removed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    
    setLoading(true);

    const { error } = await supabase.functions.invoke("delete-account", {
      body: {},
    });

    if (error) {
      deleteStartedRef.current = false;
      cancelDeleteHold();
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
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
    deleteStartedRef.current = false;
    setDeleteHoldProgress(0);
  }, []);

  // Tracks a press-and-hold on the delete button; only fires the actual
  // deletion once the user has held for the full DELETE_HOLD_DURATION_MS
  const startDeleteHold = useCallback(() => {
    if (loading || deleteStartedRef.current || deleteHoldStartRef.current !== null) return;
    deleteHoldStartRef.current = Date.now();

    const tick = () => {
      if (deleteHoldStartRef.current === null) return;
      const elapsed = Date.now() - deleteHoldStartRef.current;
      const progress = Math.min((elapsed / DELETE_HOLD_DURATION_MS) * 100, 100);
      setDeleteHoldProgress(progress);

      if (progress >= 100) {
        deleteHoldFrameRef.current = null;
        deleteHoldStartRef.current = null;
        deleteStartedRef.current = true;
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
    cancelDeleteHold();
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

  const usernameDirty = username.trim() !== savedProfile.username;
  const bioDirty = bio.trim() !== savedProfile.bio;
  const profileDirty = usernameDirty || bioDirty;

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 glow-text">Account</h1>
          <p className="text-muted-foreground mb-8">
            Manage your account settings
          </p>

          <div className="space-y-6">
            {/* Profile: identity fields share one form and one Save action */}
            <ScrollRevealCard delay={0}>
              <Card className="border-black/10 bg-card/85 shadow-lg backdrop-blur-sm hover-glow dark:border-white/15">
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>
                    Your public identity and account information
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                <div className="flex items-center gap-4 pb-4">
                  <div
                    className="relative group shrink-0"
                    onMouseEnter={() => setAvatarHovering(true)}
                    onMouseLeave={() => setAvatarHovering(false)}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarLoading}
                      className="relative block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Change profile picture"
                    >
                      <Avatar className="h-20 w-20">
                        {avatarUrl ? (
                          <AvatarImage src={avatarUrl} alt={username} />
                        ) : (
                          <AvatarFallback>
                            <User className="h-10 w-10" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div
                        className={cn(
                          "absolute inset-0 flex items-center justify-center rounded-full bg-black/50 transition-opacity",
                          avatarLoading || avatarHovering ? "opacity-100" : "opacity-0"
                        )}
                      >
                        {avatarLoading ? (
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        ) : (
                          <Camera className="h-6 w-6 text-white" />
                        )}
                      </div>
                    </button>

                    {avatarUrl && !avatarLoading && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Remove profile picture"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Profile Picture</p>
                    <p className="text-xs text-muted-foreground">
                      Click to change
                    </p>
                  </div>
                </div>

                <div className="py-4 space-y-1.5">
                  <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                  />
                </div>

                <div className="py-4 space-y-1.5">
                  <Label className="text-sm font-medium">Email</Label>
                  <Input value={userEmail} disabled />
                </div>

                <div className="py-4 space-y-1.5">
                  <Label htmlFor="bio" className="text-sm font-medium">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    className="resize-none min-h-[100px]"
                    maxLength={150}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {bio.length}/150 characters
                  </p>
                </div>

                {profileDirty && (
                  <div className="pt-4 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">You have unsaved changes</p>
                    <StatefulButton onClick={handleSaveProfile} className="min-w-[110px] px-4 py-1.5 text-sm">
                      Save changes
                    </StatefulButton>
                  </div>
                )}
                </CardContent>
              </Card>
            </ScrollRevealCard>

            {/* Privacy & Security: settings that take effect immediately, no Save needed */}
            <ScrollRevealCard delay={80}>
              <Card className="border-black/10 bg-card/85 shadow-lg backdrop-blur-sm hover-glow dark:border-white/15">
                <CardHeader>
                  <CardTitle>Privacy & Security</CardTitle>
                  <CardDescription>
                    Control who can find you and keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                <SettingsRow
                  label="Allow message requests"
                  description="When off, you won't appear in user searches and others can't start new chats with you"
                  align="start"
                >
                  <div className="flex justify-end sm:block">
                    <Switch
                      id="discoverable"
                      checked={discoverable}
                      onCheckedChange={handleToggleDiscoverable}
                      disabled={discoverableLoading}
                    />
                  </div>
                </SettingsRow>

                <SettingsRow label="Password" description="Change the password used to sign in">
                  <Dialog open={passwordDialogOpen} onOpenChange={handlePasswordDialogChange}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full sm:w-auto">
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
                </SettingsRow>
                </CardContent>
              </Card>
            </ScrollRevealCard>

            {/* Account Actions: Sign out is a plain row; Delete Account is boxed
                off in destructive styling so it visually reads as the one
                irreversible action on the page. */}
            <ScrollRevealCard delay={160}>
              <Card className="border-black/10 bg-card/85 shadow-lg backdrop-blur-sm hover-glow dark:border-white/15">
                <CardHeader>
                  <CardTitle>Account Actions</CardTitle>
                  <CardDescription>
                    Sign out or delete your account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <SettingsRow label="Sign out" description="Sign out of your account on this device">
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="w-full sm:w-auto"
                  >
                    Sign Out
                  </Button>
                </SettingsRow>

                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
                  <SettingsRow label="Delete account" description="Permanently delete your account and all your data">
                    <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogChange}>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full sm:w-auto">
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
                            onPointerDown={(event) => {
                              event.currentTarget.setPointerCapture(event.pointerId);
                              startDeleteHold();
                            }}
                            onPointerUp={(event) => {
                              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                event.currentTarget.releasePointerCapture(event.pointerId);
                              }
                              if (!deleteStartedRef.current) cancelDeleteHold();
                            }}
                            onPointerCancel={() => {
                              if (!deleteStartedRef.current) cancelDeleteHold();
                            }}
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
                              ) : null}
                              {loading
                                ? "Deleting..."
                                : deleteHoldProgress > 0
                                  ? "Keep holding..."
                                  : "Hold to Delete Account"}
                            </span>
                          </button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </SettingsRow>
                </div>
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