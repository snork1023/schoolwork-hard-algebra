import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/error-utils";

// ─── Rate limit constants ─────────────────────────────────────────────────────
const WINDOW_MS = 10 * 60 * 1000; // 10-minute sliding window
const CAPTCHA_AFTER = 3;
const LOCKOUT_5_AFTER = 5;
const LOCKOUT_15_AFTER = 10;
const LOCKOUT_5_MS = 5 * 60 * 1000;
const LOCKOUT_15_MS = 15 * 60 * 1000;
const RL_KEY = "auth_attempts";

// Password reset: 1 request per minute (client-side gate)
const RESET_RL_KEY = "pw_reset_last";
const RESET_COOLDOWN_MS = 60 * 1000;

interface AttemptRecord {
  timestamps: number[];
  lockedUntil: number;
}

function loadRecord(): AttemptRecord {
  try {
    const raw = localStorage.getItem(RL_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { timestamps: [], lockedUntil: 0 };
}
function saveRecord(r: AttemptRecord) {
  localStorage.setItem(RL_KEY, JSON.stringify(r));
}
function recentAttempts(r: AttemptRecord): number[] {
  return r.timestamps.filter((t) => t > Date.now() - WINDOW_MS);
}
function recordFailedAttempt(): AttemptRecord {
  const r = loadRecord();
  const recent = [...recentAttempts(r), Date.now()];
  let lockedUntil = 0;
  if (recent.length >= LOCKOUT_15_AFTER) lockedUntil = Date.now() + LOCKOUT_15_MS;
  else if (recent.length >= LOCKOUT_5_AFTER) lockedUntil = Date.now() + LOCKOUT_5_MS;
  const updated = { timestamps: recent, lockedUntil };
  saveRecord(updated);
  return updated;
}
function clearAttempts() { localStorage.removeItem(RL_KEY); }
function lockoutRemaining(r: AttemptRecord): number {
  if (!r.lockedUntil) return 0;
  return Math.max(0, r.lockedUntil - Date.now());
}
function formatCountdown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}
function generateChallenge() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { question: `${a} + ${b}`, answer: a + b };
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
// Sign-up: username + email + password
const signUpSchema = z.object({
  username: z.string().trim().min(2, "Username must be at least 2 characters").max(50),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

// Sign-in: email + password
const signInSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const Auth = () => {
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(true);

  const [loading, setLoading] = useState(false);

  // Login rate limit
  const [attemptCount, setAttemptCount] = useState(() => recentAttempts(loadRecord()).length);
  const [lockoutMs, setLockoutMs] = useState(() => lockoutRemaining(loadRecord()));
  const [countdown, setCountdown] = useState("");
  const [challenge, setChallenge] = useState(() => generateChallenge());
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaPassed, setCaptchaPassed] = useState(false);

  // Password reset
  const [resetEmail, setResetEmail] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetCooldownMs, setResetCooldownMs] = useState(0);
  const [resetCountdown, setResetCountdown] = useState("");

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already signed in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session) {
        navigate("/community-chat");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Login lockout countdown
  useEffect(() => {
    if (lockoutMs <= 0) { setCountdown(""); return; }
    setCountdown(formatCountdown(lockoutMs));
    countdownRef.current = setInterval(() => {
      const rem = lockoutRemaining(loadRecord());
      if (rem <= 0) { setLockoutMs(0); setCountdown(""); clearInterval(countdownRef.current!); }
      else setCountdown(formatCountdown(rem));
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [lockoutMs]);

  // Password reset cooldown countdown
  useEffect(() => {
    if (resetCooldownMs <= 0) { setResetCountdown(""); return; }
    setResetCountdown(formatCountdown(resetCooldownMs));
    resetCountdownRef.current = setInterval(() => {
      const last = parseInt(localStorage.getItem(RESET_RL_KEY) || "0", 10);
      const rem = Math.max(0, last + RESET_COOLDOWN_MS - Date.now());
      if (rem <= 0) { setResetCooldownMs(0); setResetCountdown(""); clearInterval(resetCountdownRef.current!); }
      else setResetCountdown(formatCountdown(rem));
    }, 1000);
    return () => { if (resetCountdownRef.current) clearInterval(resetCountdownRef.current); };
  }, [resetCooldownMs]);

  const needsCaptcha = attemptCount >= CAPTCHA_AFTER && !captchaPassed;
  const isLockedOut = lockoutMs > 0;

  const handleCaptchaCheck = () => {
    if (parseInt(captchaInput, 10) === challenge.answer) {
      setCaptchaPassed(true);
    } else {
      toast({ title: "Incorrect answer", variant: "destructive" });
      setChallenge(generateChallenge());
      setCaptchaInput("");
    }
  };

  // ── Sign In ────────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) {
      toast({ title: "Too many attempts", description: `Wait ${formatCountdown(lockoutMs)}`, variant: "destructive" });
      return;
    }
    if (needsCaptcha) {
      toast({ title: "Complete the CAPTCHA first", variant: "destructive" });
      return;
    }
    const validation = signInSchema.safeParse({ email: signInEmail, password: signInPassword });
    if (!validation.success) {
      toast({ title: "Validation error", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });
      if (error) throw error;
      clearAttempts();
      setAttemptCount(0);
      setCaptchaPassed(false);
      toast({ title: "Welcome back!" });
    } catch (error: any) {
      const updated = recordFailedAttempt();
      const newCount = recentAttempts(updated).length;
      setAttemptCount(newCount);
      const newRem = lockoutRemaining(updated);
      if (newRem > 0) setLockoutMs(newRem);
      setCaptchaPassed(false);
      setChallenge(generateChallenge());
      setCaptchaInput("");
      toast({ title: "Sign in failed", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up ────────────────────────────────────────────────────────────────
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = signUpSchema.safeParse({
      username: signUpUsername,
      email: signUpEmail,
      password: signUpPassword,
    });
    if (!validation.success) {
      toast({ title: "Validation error", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Check if email is already registered before calling signUp.
      // We do this by attempting to sign in with a dummy password and checking
      // the specific error code. If Supabase returns anything other than
      // "Invalid login credentials" it means the email doesn't exist yet.
      // More reliably: just attempt signUp and handle the duplicate error.
      const { data, error } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          data: { username: validation.data.username },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        // Supabase returns "User already registered" for duplicate emails
        // when email confirmation is disabled in the dashboard.
        if (
          error.message?.toLowerCase().includes("already registered") ||
          error.message?.toLowerCase().includes("already exists") ||
          error.status === 422
        ) {
          toast({
            title: "Email already in use",
            description: "An account with that email already exists. Please sign in instead.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      // When email confirmation is ON, Supabase returns a user with
      // identities[] empty to signal the email is already taken.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        toast({
          title: "Email already in use",
          description: "An account with that email already exists. Please sign in instead.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Account created!",
        description: "You can now sign in with your credentials.",
      });
      // Clear sign-up fields
      setSignUpUsername("");
      setSignUpEmail("");
      setSignUpPassword("");
    } catch (error: any) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Password Reset ─────────────────────────────────────────────────────────
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side rate limit: 1 request per minute
    const last = parseInt(localStorage.getItem(RESET_RL_KEY) || "0", 10);
    const remaining = last + RESET_COOLDOWN_MS - Date.now();
    if (remaining > 0) {
      setResetCooldownMs(remaining);
      toast({
        title: "Please wait",
        description: `You can request another reset in ${formatCountdown(remaining)}.`,
        variant: "destructive",
      });
      return;
    }

    const emailValidation = z.string().trim().email("Invalid email address").safeParse(resetEmail);
    if (!emailValidation.success) {
      toast({ title: "Invalid email", description: emailValidation.error.errors[0].message, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailValidation.data, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;

      // Record timestamp for cooldown
      localStorage.setItem(RESET_RL_KEY, String(Date.now()));
      setResetCooldownMs(RESET_COOLDOWN_MS);

      toast({ title: "Check your email", description: "We sent you a password reset link." });
      setResetEmail("");
      setShowResetForm(false);
    } catch (error: any) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 pt-24 pb-12 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>Sign in or create an account</CardDescription>
          </CardHeader>
          <CardContent>
            {/* ── Password Reset Form ── */}
            {showResetForm ? (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="reset-email">Email address</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                  />
                </div>

                {resetCooldownMs > 0 && (
                  <p className="text-sm text-destructive">
                    Next reset available in <span className="font-mono font-bold">{resetCountdown}</span>
                  </p>
                )}

                <div className="flex gap-2">
                  <Button type="submit" disabled={loading || resetCooldownMs > 0} className="flex-1">
                    {loading ? "Sending…" : "Send Reset Link"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowResetForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                {/* ── Sign In ── */}
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        disabled={isLockedOut}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        disabled={isLockedOut}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="stay-logged-in"
                        checked={stayLoggedIn}
                        onCheckedChange={(v) => setStayLoggedIn(v === true)}
                      />
                      <Label htmlFor="stay-logged-in" className="text-sm cursor-pointer">Stay logged in</Label>
                    </div>

                    {/* Lockout banner */}
                    {isLockedOut && (
                      <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive text-center">
                        Too many attempts. Wait <span className="font-mono font-bold">{countdown}</span>.
                      </div>
                    )}

                    {/* CAPTCHA */}
                    {!isLockedOut && needsCaptcha && (
                      <div className="rounded-md border border-border bg-muted/50 px-4 py-3 space-y-2">
                        <p className="text-sm font-medium">
                          Security check: what is <span className="font-mono">{challenge.question}</span>?
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Answer"
                            value={captchaInput}
                            onChange={(e) => setCaptchaInput(e.target.value)}
                            className="w-24"
                          />
                          <Button type="button" variant="outline" size="sm" onClick={handleCaptchaCheck}>
                            Verify
                          </Button>
                        </div>
                        {captchaPassed && <p className="text-xs text-green-600 font-medium">✓ Verified</p>}
                        <p className="text-xs text-muted-foreground">
                          {attemptCount} failed attempt{attemptCount !== 1 ? "s" : ""} in the last 10 min.
                        </p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading || isLockedOut || (needsCaptcha && !captchaPassed)}
                    >
                      {loading ? "Signing in…" : "Sign In"}
                    </Button>

                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-sm"
                      onClick={() => setShowResetForm(true)}
                    >
                      Forgot password?
                    </Button>
                  </form>
                </TabsContent>

                {/* ── Sign Up ── */}
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="signup-username">Username</Label>
                      <Input
                        id="signup-username"
                        type="text"
                        value={signUpUsername}
                        onChange={(e) => setSignUpUsername(e.target.value)}
                        placeholder="Choose a username"
                        required
                        maxLength={50}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        required
                        minLength={6}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Creating account…" : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
