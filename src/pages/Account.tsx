import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/layout/card";
import { Input } from "@/components/ui/forms/input";
import { Button, buttonVariants } from "@/components/ui/buttons/button";
import { Button as StatefulButton } from "@/components/ui/buttons/stateful-button";
import { Label } from "@/components/ui/forms/label";
import Switch from "@/components/ui/buttons/switch";
import { Textarea } from "@/components/ui/forms/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/data-display/avatar";
import CodeSlots, { type CodeSlotsStatus } from "@/components/ui/forms/codeslots";
import PasswordGuide from "@/components/ui/forms/PasswordGuide";
import { getPasswordChecks } from "@/components/ui/forms/password-rules";
import HCaptchaWidget from "@/components/ui/forms/HCaptchaWidget";
import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Camera, User, Eye, EyeOff, X, ShieldCheck } from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router";
import { useToast } from "@/hooks/use-toast";
import { ScrollRevealCard } from "@/components/ui/data-display/scrollcard";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/overlays/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/overlays/dialog";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { compressImageFile } from "@/lib/image-utils";

const usernameSchema = z.string().trim().min(1, "Username is required").max(20, "Username must be 20 characters or less");

const DELETE_HOLD_DURATION_MS = 3000;
const DISCOVERABLE_SAVE_DELAY_MS = 15000;
const discoverableStorageKey = (userId: string) => `pending-discoverable:${userId}`;

interface PendingDiscoverable {
  value: boolean;
  saveAt: number;
}

const isPendingDiscoverable = (value: unknown): value is PendingDiscoverable =>
  typeof value === "object" &&
  value !== null &&
  "value" in value &&
  typeof value.value === "boolean" &&
  "saveAt" in value &&
  typeof value.saveAt === "number" &&
  Number.isFinite(value.saveAt);

const SAVED_FLASH_VISIBLE_MS = 1400;
const SAVED_FLASH_FADE_MS = 300;

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
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStep, setPasswordStep] = useState<"send" | "otp" | "password">("send");
  const [passwordOtp, setPasswordOtp] = useState("");
  const [passwordOtpStatus, setPasswordOtpStatus] = useState<CodeSlotsStatus>("idle");
  const [passwordCaptchaToken, setPasswordCaptchaToken] = useState<string | null>(null);
  const [passwordCaptchaAttempt, setPasswordCaptchaAttempt] = useState(0);
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [discoverable, setDiscoverable] = useState(true);
  const [discoverableLoading, setDiscoverableLoading] = useState(false);
  const discoverableUpdateRef = useRef(false);
  const discoverableSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [discoverableSaveAt, setDiscoverableSaveAt] = useState<number | null>(null);
  const pendingDiscoverableRef = useRef(true);
  const savedDiscoverableRef = useRef(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const profileSaveRef = useRef(false);
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

  // Keeps the save bar mounted after a save completes, so the button has time
  // to play its checkmark. "visible" holds it in place, "fading" runs the
  // exit transition. Without this the bar would unmount the instant
  // savedProfile updates, killing the animation before it starts.
  const [savedFlash, setSavedFlash] = useState<"none" | "visible" | "fading">("none");
  const flashHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashUnmountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const captchaTheme = resolvedTheme === "dark" ? "dark" : "light";
  const newPasswordChecks = getPasswordChecks(newPassword);
  const newPasswordIsValid =
    newPasswordChecks.length &&
    newPasswordChecks.uppercase &&
    newPasswordChecks.lowercase &&
    newPasswordChecks.number &&
    newPassword.length <= 64;
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const showNewPasswordRequirements = newPasswordFocused || newPassword.length > 0;

  const clearFlashTimers = useCallback(() => {
    if (flashHideTimeoutRef.current) {
      clearTimeout(flashHideTimeoutRef.current);
      flashHideTimeoutRef.current = null;
    }
    if (flashUnmountTimeoutRef.current) {
      clearTimeout(flashUnmountTimeoutRef.current);
      flashUnmountTimeoutRef.current = null;
    }
  }, []);

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
      const savedDiscoverable = profile.discoverable ?? true;
      savedDiscoverableRef.current = savedDiscoverable;
      let pendingDiscoverable: PendingDiscoverable | null = null;
      try {
        const pendingValue = sessionStorage.getItem(discoverableStorageKey(uid));
        if (pendingValue) {
          const parsedValue: unknown = JSON.parse(pendingValue);
          if (isPendingDiscoverable(parsedValue)) {
            pendingDiscoverable = parsedValue;
          } else {
            sessionStorage.removeItem(discoverableStorageKey(uid));
          }
        }
      } catch (error: unknown) {
        toast({
          title: "Error",
          description: getUserFriendlyError(error),
          variant: "destructive",
        });
      }
      if (pendingDiscoverable) {
        setDiscoverable(pendingDiscoverable.value);
        pendingDiscoverableRef.current = pendingDiscoverable.value;
        setDiscoverableSaveAt(pendingDiscoverable.saveAt);
      } else {
        setDiscoverable(savedDiscoverable);
        pendingDiscoverableRef.current = savedDiscoverable;
      }
      setBio(savedBio);
      setAvatarUrl(profile.avatar_url);
    }
  }, [toast]);

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

  const sendDiscoverableUpdate = useCallback(async (uid: string) => {
    if (discoverableUpdateRef.current) return;

    discoverableSaveTimerRef.current = null;
    discoverableUpdateRef.current = true;
    setDiscoverableLoading(true);
    const valueToSave = pendingDiscoverableRef.current;
    const clearPendingValue = () => {
      try {
        sessionStorage.removeItem(discoverableStorageKey(uid));
      } catch (error: unknown) {
        toast({
          title: "Error",
          description: getUserFriendlyError(error),
          variant: "destructive",
        });
      }
      setDiscoverableSaveAt(null);
    };
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ discoverable: valueToSave })
        .eq("id", uid);

      if (error) throw error;
      savedDiscoverableRef.current = valueToSave;
      savedDiscoverableRef.current = valueToSave;
      clearPendingValue();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
      setDiscoverable(savedDiscoverableRef.current);
      pendingDiscoverableRef.current = savedDiscoverableRef.current;
      clearPendingValue();
    } finally {
      discoverableUpdateRef.current = false;
      setDiscoverableLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!userId || discoverableSaveAt === null) return;

    const remainingDelay = Math.max(0, discoverableSaveAt - Date.now());
    discoverableSaveTimerRef.current = setTimeout(() => {
      void sendDiscoverableUpdate(userId);
    }, remainingDelay);
    return () => {
      if (discoverableSaveTimerRef.current) clearTimeout(discoverableSaveTimerRef.current);
      discoverableSaveTimerRef.current = null;
    };
  }, [userId, discoverableSaveAt, sendDiscoverableUpdate]);

  const handleToggleDiscoverable = (checked: boolean) => {
    if (!userId || discoverableUpdateRef.current) return;

    setDiscoverable(checked);
    pendingDiscoverableRef.current = checked;
    try {
      const storedPending = sessionStorage.getItem(discoverableStorageKey(userId));
      const parsedPending: unknown = storedPending ? JSON.parse(storedPending) : null;
      const previousPending = isPendingDiscoverable(parsedPending) ? parsedPending : null;
      const saveAt = previousPending
        ? previousPending.saveAt
        : Date.now() + DISCOVERABLE_SAVE_DELAY_MS;
      sessionStorage.setItem(discoverableStorageKey(userId), JSON.stringify({ value: checked, saveAt }));
      setDiscoverableSaveAt(saveAt);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
      setDiscoverable(savedDiscoverableRef.current);
      pendingDiscoverableRef.current = savedDiscoverableRef.current;
    }
  };

  // Single save action for the whole profile form (username + bio).
  const handleSaveProfile = async () => {
    if (!userId || profileSaveRef.current) return;

    profileSaveRef.current = true;
    setProfileSaving(true);
    try {
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

      // The form is clean now, so profileDirty is about to go false. Hold the
      // bar on screen anyway until the checkmark has had its moment, then fade.
      clearFlashTimers();
      setSavedFlash("visible");
      flashHideTimeoutRef.current = setTimeout(() => {
        setSavedFlash("fading");
        flashUnmountTimeoutRef.current = setTimeout(() => {
          setSavedFlash("none");
        }, SAVED_FLASH_FADE_MS);
      }, SAVED_FLASH_VISIBLE_MS);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      profileSaveRef.current = false;
      setProfileSaving(false);
    }
  };

  const handleSendPasswordOtp = async () => {
    if (!userEmail) {
      toast({
        title: "Unable to send verification code",
        description: "Your account email could not be found. Please sign in again and retry.",
        variant: "destructive",
      });
      return;
    }

    if (!passwordCaptchaToken) {
      toast({
        title: "Complete the CAPTCHA",
        description: "Verify that you’re human before requesting a recovery code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        captchaToken: passwordCaptchaToken,
      });
      if (error) throw error;

      setPasswordCaptchaToken(null);
      setPasswordOtp("");
      setPasswordOtpStatus("idle");
      setPasswordStep("otp");
      toast({
        title: "Verification code sent",
        description: `Check ${userEmail} for your 6-digit code.`,
      });
    } catch (error: unknown) {
      toast({
        title: "Could not send verification code",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
      setPasswordCaptchaToken(null);
      setPasswordCaptchaAttempt((attempt) => attempt + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPasswordOtp = async (submittedCode = passwordOtp) => {
    const code = submittedCode.trim();
    if (code.length !== 6) {
      toast({
        title: "Enter the 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: code,
        type: "recovery",
      });
      if (error) throw error;

      setPasswordOtpStatus("success");
      setPasswordStep("password");
    } catch (error: unknown) {
      setPasswordOtpStatus("error");
      toast({
        title: "Invalid verification code",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Resend goes back to the captcha step, since tokens are single use
  const handleResendPasswordOtp = () => {
    setPasswordOtp("");
    setPasswordOtpStatus("idle");
    setPasswordCaptchaToken(null);
    setPasswordCaptchaAttempt((attempt) => attempt + 1);
    setPasswordStep("send");
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Enter the same new password in both fields.",
        variant: "destructive",
      });
      return;
    }

    if (!newPasswordIsValid) {
      toast({
        title: "Password does not meet the requirements",
        description: "Follow the password guide before continuing.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      handlePasswordDialogChange(false);
    } catch (error: unknown) {
      const rawMessage =
        typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
          ? error.message
          : "";
      const passwordReuseError = /same password|different from the old password|old password/i.test(rawMessage);
      toast({
        title: passwordReuseError ? "Choose a different password" : "Could not update password",
        description: passwordReuseError
          ? "Your new password must be different from your current password."
          : getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setAvatarLoading(false);
    }
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

  const handleDeleteAccount = useCallback(async () => {
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
  }, [userId, cancelDeleteHold, toast, navigate]);

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
  }, [loading, handleDeleteAccount]);

  // Reset hold progress whenever the delete dialog is closed
  const handleDeleteDialogChange = (open: boolean) => {
    setDeleteDialogOpen(open);
    cancelDeleteHold();
  };

  // Reset password fields whenever the dialog is closed (cancel, success, or outside click)
  const handlePasswordDialogChange = (open: boolean) => {
    setPasswordDialogOpen(open);
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setNewPasswordFocused(false);
      setShowConfirmPassword(false);
      setPasswordStep("send");
      setPasswordOtp("");
      setPasswordOtpStatus("idle");
      setPasswordCaptchaToken(null);
      setPasswordCaptchaAttempt((attempt) => attempt + 1);
    }
  };

  // Ensure any in-flight hold animation frame + flash timers are cancelled on unmount
  useEffect(() => {
    return () => {
      if (deleteHoldFrameRef.current !== null) {
        cancelAnimationFrame(deleteHoldFrameRef.current);
      }
      clearFlashTimers();
    };
  }, [clearFlashTimers]);

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

  // Dirty state always wins: if the user starts editing again during the
  // post-save flash, the bar snaps back to full opacity as a live Save bar.
  const showSaveBar = profileDirty || savedFlash !== "none";
  const saveBarFading = !profileDirty && savedFlash === "fading";

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

                {showSaveBar && (
                  <div
                    className={cn(
                      "pt-4 flex items-center justify-between transition-all duration-300 ease-out",
                      saveBarFading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
                    )}
                  >
                    <p className="text-xs text-muted-foreground">
                      {profileDirty ? "You have unsaved changes" : "All changes saved"}
                    </p>
                    <StatefulButton onClick={handleSaveProfile} disabled={profileSaving} className="min-w-[110px] px-4 py-1.5 text-sm">
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
                      checked={discoverable}
                      onChange={handleToggleDiscoverable}
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
                      <DialogHeader className="space-y-2 text-center sm:text-center">
                        <DialogTitle className="text-2xl font-semibold tracking-tight">
                          {passwordStep === "send"
                            ? "Change password"
                            : passwordStep === "otp"
                              ? "Check your email"
                              : "Choose a new password"}
                        </DialogTitle>
                        <DialogDescription>
                          {passwordStep === "send"
                            ? (
                              <>
                                We’ll email a verification code to{" "}
                                <strong className="font-semibold text-foreground">{userEmail}</strong>
                                {" "}before you can change your password.
                              </>
                            )
                            : passwordStep === "otp"
                              ? (
                                <>
                                  Enter the 6-digit code sent to{" "}
                                  <span className="font-medium text-foreground">{userEmail}</span>.
                                </>
                              )
                              : "Set a strong password you haven’t used before."}
                        </DialogDescription>
                        {passwordStep === "send"}
                      </DialogHeader>

                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (passwordStep === "otp") {
                            void handleVerifyPasswordOtp();
                          } else if (passwordStep === "password") {
                            void handleUpdatePassword();
                          }
                        }}
                        className="space-y-5"
                      >
                        {/* Step 1: captcha */}
                        {passwordStep === "send" && (
                          <div className="space-y-3">
                            <HCaptchaWidget
                              key={passwordCaptchaAttempt}
                              theme={captchaTheme}
                              onToken={setPasswordCaptchaToken}
                              onError={(error) => {
                                toast({
                                  title: "CAPTCHA unavailable",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              }}
                            />
                          </div>
                        )}

                        {/* Step 2: enter the code */}
                        {passwordStep === "otp" && (
                          <>
                            <div className="space-y-1">
                              <CodeSlots
                                id="account-password-otp"
                                name="account-password-otp"
                                aria-label="6-digit recovery code"
                                length={6}
                                autoComplete="one-time-code"
                                value={passwordOtp}
                                status={passwordOtpStatus}
                                onChange={(code) => {
                                  setPasswordOtp(code);
                                  setPasswordOtpStatus("idle");
                                }}
                                onComplete={(code) => void handleVerifyPasswordOtp(code)}
                                disabled={loading}
                                required
                              />
                            </div>

                            <div className="flex justify-center text-sm">
                              <Button
                                type="button"
                                variant="link"
                                className="px-0"
                                onClick={handleResendPasswordOtp}
                                disabled={loading}
                              >
                                Resend code
                              </Button>
                            </div>
                          </>
                        )}

                        {/* Step 3: new password */}
                        {passwordStep === "password" && (
                          <>
                            <div className="space-y-3">
                              <Label htmlFor="new-password" className="-translate-y-1">New password</Label>
                              <div className="relative">
                                <Input
                                  id="new-password"
                                  type={showNewPassword ? "text" : "password"}
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  onFocus={() => setNewPasswordFocused(true)}
                                  onBlur={() => setNewPasswordFocused(false)}
                                  placeholder="Enter a new password"
                                  autoComplete="new-password"
                                  maxLength={64}
                                  className="pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewPassword((prev) => !prev)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                                >
                                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>

                              <div
                                className={cn(
                                  "overflow-hidden transition-all duration-300 ease-out",
                                  showNewPasswordRequirements ? "max-h-48 opacity-100" : "max-h-0 opacity-0",
                                )}
                              >
                                <div className="mt-2">
                                  <PasswordGuide password={newPassword} />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <Label htmlFor="confirm-password" className="-translate-y-1">Confirm new password</Label>
                              <div className="relative">
                                <Input
                                  id="confirm-password"
                                  type={showConfirmPassword ? "text" : "password"}
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  placeholder="Enter the new password again"
                                  autoComplete="new-password"
                                  maxLength={64}
                                  className={cn(
                                    "pr-10",
                                    confirmPassword && !passwordsMatch && "border-destructive focus-visible:ring-destructive",
                                    passwordsMatch && "border-emerald-500 focus-visible:ring-emerald-500",
                                  )}
                                  aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                                  aria-describedby={confirmPassword ? "password-match-status" : undefined}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                                >
                                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                              {confirmPassword && (
                                <p
                                  id="password-match-status"
                                  className={cn(
                                    "text-xs",
                                    passwordsMatch ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                                  )}
                                  aria-live="polite"
                                >
                                  {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                                </p>
                              )}
                            </div>
                          </>
                        )}

                        {/* No footer buttons on the code step, it auto submits */}
                        {passwordStep !== "otp" && (
                          <DialogFooter className="gap-2 sm:gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handlePasswordDialogChange(false)}
                              disabled={loading}
                            >
                              Cancel
                            </Button>
                            {passwordStep === "send" && (
                              <Button
                                type="button"
                                onClick={() => void handleSendPasswordOtp()}
                                disabled={loading || !userEmail || !passwordCaptchaToken}
                              >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Send code
                              </Button>
                            )}
                            {passwordStep === "password" && (
                              <Button
                                type="submit"
                                disabled={loading || !newPasswordIsValid || !passwordsMatch}
                              >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Update password
                              </Button>
                            )}
                          </DialogFooter>
                        )}
                      </form>
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
                              "relative overflow-hidden select-none touch-none hover:scale-100 active:scale-100"
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