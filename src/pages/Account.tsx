import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Camera, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db, storage } from "@/integrations/firebase/client";
import {
  validateDisplayName,
  validateBio,
  validatePassword,
  LIMITS,
} from "@/lib/chime/sanitize";
import { checkRateLimit, formatCountdown, LIMITS as RATE_LIMITS } from "@/lib/chime/rate-limit";
import type { User } from "@/lib/chime/types";

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const Account = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, ready, configured } = useFirebaseAuth();

  const [profile, setProfile] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [bioSaving, setBioSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      navigate("/community-chat");
    }
  }, [ready, user, navigate]);

  useEffect(() => {
    if (!user || !db) return;
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) {
        setProfile(null);
        return;
      }
      const data = { id: snap.id, ...(snap.data() as Omit<User, "id">) };
      setProfile(data);
      setDisplayName((prev) => (prev === "" ? data.displayName : prev));
      setBio((prev) => (prev === "" ? data.bio ?? "" : prev));
    });
    return () => unsubscribe();
  }, [user]);

  const handleSaveDisplayName = async () => {
    if (!user || !db) return;
    const r = validateDisplayName(displayName);
    if (!r.ok) {
      toast({ title: "Invalid display name", description: r.error, variant: "destructive" });
      return;
    }
    const rl = checkRateLimit("updateProfile", RATE_LIMITS.updateProfile);
    if (!rl.ok) {
      toast({
        title: "Slow down",
        description: `Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`,
        variant: "destructive",
      });
      return;
    }
    setProfileSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { displayName: r.value });
      toast({ title: "Display name updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Could not save.", variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveBio = async () => {
    if (!user || !db) return;
    const r = validateBio(bio);
    if (!r.ok) {
      toast({ title: "Invalid bio", description: r.error, variant: "destructive" });
      return;
    }
    const rl = checkRateLimit("updateProfile", RATE_LIMITS.updateProfile);
    if (!rl.ok) {
      toast({
        title: "Slow down",
        description: `Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`,
        variant: "destructive",
      });
      return;
    }
    setBioSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { bio: r.value });
      toast({ title: "Bio updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Could not save.", variant: "destructive" });
    } finally {
      setBioSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    const pwResult = validatePassword(newPassword);
    if (!pwResult.ok) {
      toast({ title: "Invalid password", description: pwResult.error, variant: "destructive" });
      return;
    }
    if (!user.email) {
      toast({ title: "Can't change password", description: "No email on account.", variant: "destructive" });
      return;
    }
    setPasswordSaving(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, pwResult.value);
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      toast({ title: "Password changed" });
    } catch (e: any) {
      const code = e?.code ?? "";
      const message =
        code === "auth/wrong-password" || code === "auth/invalid-credential"
          ? "Current password is incorrect."
          : code === "auth/requires-recent-login"
          ? "Please sign in again to change your password."
          : e?.message ?? "Could not change password.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !storage || !db) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast({ title: "File too large", description: "Max 4 MB.", variant: "destructive" });
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      toast({ title: "Unsupported file", description: "Use PNG, JPEG, WebP, or GIF.", variant: "destructive" });
      return;
    }
    const rl = checkRateLimit("uploadAvatar", RATE_LIMITS.uploadAvatar);
    if (!rl.ok) {
      toast({
        title: "Slow down",
        description: `Try again in ${formatCountdown(rl.resetsAt - Date.now())}.`,
        variant: "destructive",
      });
      return;
    }
    setAvatarSaving(true);
    try {
      const r = ref(storage, `avatars/${user.uid}`);
      const snap = await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(snap.ref);
      await updateDoc(doc(db, "users", user.uid), { avatarUrl: url });
      toast({ title: "Avatar updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setAvatarSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!configured) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 container mx-auto px-4 pt-32 pb-12">
          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <CardTitle>Firebase not configured</CardTitle>
              <CardDescription>
                Set up your Firebase env vars (see <code>/community-chat</code>) before you can manage your account.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  if (!ready || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const fallbackInitial = (profile?.displayName || profile?.username || user.email || "?")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 pt-32 pb-12">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Account</CardTitle>
              <CardDescription>
                Signed in as <span className="font-mono">{user.email}</span>
                {profile?.username && <> · @{profile.username}</>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                      {fallbackInitial}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={handleAvatarPick}
                    disabled={avatarSaving}
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow hover:bg-primary/90 disabled:opacity-60"
                    title="Upload avatar"
                  >
                    {avatarSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PNG, JPG, WebP, or GIF.</p>
                  <p className="text-xs text-muted-foreground/70">Max 4 MB.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <div className="flex gap-2">
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value.slice(0, LIMITS.DISPLAY_NAME_MAX))}
                    maxLength={LIMITS.DISPLAY_NAME_MAX}
                    placeholder="How others see you"
                  />
                  <Button onClick={handleSaveDisplayName} disabled={profileSaving}>
                    {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, LIMITS.BIO_MAX))}
                  maxLength={LIMITS.BIO_MAX}
                  rows={3}
                  placeholder="Tell people about you…"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {bio.length} / {LIMITS.BIO_MAX}
                  </span>
                  <Button onClick={handleSaveBio} disabled={bioSaving} size="sm">
                    {bioSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                You'll need your current password to confirm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value.slice(0, LIMITS.PASSWORD_MAX))}
                  maxLength={LIMITS.PASSWORD_MAX}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value.slice(0, LIMITS.PASSWORD_MAX))}
                  maxLength={LIMITS.PASSWORD_MAX}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.slice(0, LIMITS.PASSWORD_MAX))}
                  maxLength={LIMITS.PASSWORD_MAX}
                  autoComplete="new-password"
                />
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={passwordSaving || !newPassword || !currentPassword}
              >
                {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
            </CardContent>
          </Card>

          {!profile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5" /> Finish setup
                </CardTitle>
                <CardDescription>
                  Your profile hasn't been created yet. Open <code>/community-chat</code> and sign in to finish onboarding.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Account;
