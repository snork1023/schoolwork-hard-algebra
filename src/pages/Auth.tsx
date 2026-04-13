import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/error-utils";

// ─── Rate-limit constants ────────────────────────────────────────────────────
const WINDOW_MS = 10 * 60 * 1000;   // 10-minute sliding window
const CAPTCHA_AFTER = 3;             // show CAPTCHA after 3 attempts
const LOCKOUT_5_AFTER = 5;           // 5-min lockout after 5 attempts
const LOCKOUT_15_AFTER = 10;         // 15-min lockout after 10 attempts
const LOCKOUT_5_MS = 5 * 60 * 1000;
const LOCKOUT_15_MS = 15 * 60 * 1000;

// Stored in localStorage under this key (client-side only — server-side
const RL_KEY = "auth_attempts";

interface AttemptRecord {
  timestamps: number[];   // epoch ms of each failed attempt in the window
  lockedUntil: number;    // epoch ms when lockout expires (0 = not locked)
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

/** Returns attempts inside the 10-minute window */
function recentAttempts(r: AttemptRecord): number[] {
  const cutoff = Date.now() - WINDOW_MS;
  return r.timestamps.filter((t) => t > cutoff);
}

function recordFailedAttempt(): AttemptRecord {
  const r = loadRecord();
  const recent = recentAttempts(r);
  recent.push(Date.now());

  let lockedUntil = 0;
  if (recent.length >= LOCKOUT_15_AFTER) {
    lockedUntil = Date.now() + LOCKOUT_15_MS;
  } else if (recent.length >= LOCKOUT_5_AFTER) {
    lockedUntil = Date.now() + LOCKOUT_5_MS;
  }

  const updated: AttemptRecord = { timestamps: recent, lockedUntil };
  saveRecord(updated);
  return updated;
}

function clearAttempts() {
  localStorage.removeItem(RL_KEY);
}

/** Returns ms remaining in lockout, or 0 if not locked */
function lockoutRemaining(r: AttemptRecord): number {
  if (!r.lockedUntil) return 0;
  const remaining = r.lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Simple inline CAPTCHA ───────────────────────────────────────────────────
function generateChallenge() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { question: `${a} + ${b}`, answer: a + b };
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
const signUpSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72, "Password too long"),
  username: z.string().trim().max(50, "Username too long").optional(),
});

const signInSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ─── Component ───────────────────────────────────────────────────────────────
const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);

  // Rate-limit state
  const [attemptCount, setAttemptCount] = useState(() => recentAttempts(loadRecord()).length);
  const [lockoutMs, setLockoutMs] = useState(() => lockoutRemaining(loadRecord()));
  const [countdown, setCountdown] = useState("");

  // CAPTCHA state
  const [challenge, setChallenge] = useState(() => generateChallenge());
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaPassed, setCaptchaPassed] = useState(false);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Countdown ticker
  useEffect(() => {
    if (lockoutMs <= 0) {
      setCountdown("");
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }
    setCountdown(formatCountdown(lockoutMs));
    countdownRef.current = setInterval(() => {
      const r = loadRecord();
      const rem = lockoutRemaining(r);
      if (rem <= 0) {
        setLockoutMs(0);
        setCountdown("");
        if (countdownRef.current) clearInterval(countdownRef.current);
      } else {
        setCountdown(formatCountdown(rem));
      }
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [lockoutMs]);

  const needsCaptcha = attemptCount >= CAPTCHA_AFTER && !captchaPassed;

  const handleCaptchaCheck = () => {
    if (parseInt(captchaInput, 10) === challenge.answer) {
      setCaptchaPassed(true);
    } else {
      toast({ title: "Incorrect answer", description: "Please solve the math problem correctly.", variant: "destructive" });
      setChallenge(generateChallenge());
      setCaptchaInput("");
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check lockout
    const r = loadRecord();
    const rem = lockoutRemaining(r);
    if (rem > 0) {
      setLockoutMs(rem);
      toast({ title: "Too many attempts", description: `Please wait ${formatCountdown(rem)} before trying again.`, variant: "destructive" });
      return;
    }

    // Check CAPTCHA
    if (needsCaptcha) {
      toast({ title: "Complete the CAPTCHA first", variant: "destructive" });
      return;
    }

    const validation = signInSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({ title: "Validation Error", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (error) throw error;

      // Success — clear rate-limit record
      clearAttempts();
      setAttemptCount(0);
      setCaptchaPassed(false);
      toast({ title: "Welcome back!", description: "You have successfully signed in." });
    } catch (error: any) {
      // Record failed attempt
      const updated = recordFailedAttempt();
      const newCount = recentAttempts(updated).length;
      setAttemptCount(newCount);
      const newRem = lockoutRemaining(updated);
      if (newRem > 0) setLockoutMs(newRem);

      // Reset captcha so they have to solve it again
      setCaptchaPassed(false);
      setChallenge(generateChallenge());
      setCaptchaInput("");

      toast({ title: "Sign in failed", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = signUpSchema.safeParse({ email, password, username: username || undefined });
    if (!validation.success) {
      toast({ title: "Validation Error", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { username: validation.data.username || validation.data.email.split("@")[0] },
        },
      });
      if (error) throw error;
      toast({ title: "Account created!", description: "You can now sign in with your credentials." });
    } catch (error: any) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const emailValidation = z.string().trim().email("Invalid email address").safeParse(recoveryEmail);
    if (!emailValidation.success) {
      toast({ title: "Error", description: emailValidation.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailValidation.data, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast({ title: "Check your email", description: "We've sent you a password reset link." });
      setRecoveryEmail("");
    } catch (error: any) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  const isLockedOut = lockoutMs > 0;

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="container mx-auto px-4 pt-24 pb-12 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>Sign in or create an account to start chatting</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              {/* ── Sign In ── */}
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLockedOut}
                    />
                  </div>
                  <div>
                    <Input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLockedOut}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="stay-logged-in"
                      checked={stayLoggedIn}
                      onCheckedChange={(checked) => setStayLoggedIn(checked === true)}
                    />
                    <Label htmlFor="stay-logged-in" className="text-sm cursor-pointer">
                      Stay logged in
                    </Label>
                  </div>

                  {/* Lockout banner */}
                  {isLockedOut && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive text-center">
                      Too many failed attempts. Please wait <span className="font-mono font-bold">{countdown}</span> before trying again.
                    </div>
                  )}

                  {/* CAPTCHA — shown after 3 failed attempts */}
                  {!isLockedOut && needsCaptcha && (
                    <div className="rounded-md border border-border bg-muted/50 px-4 py-3 space-y-2">
                      <p className="text-sm font-medium">Security check: What is <span className="font-mono">{challenge.question}</span>?</p>
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
                        {attemptCount} failed attempt{attemptCount !== 1 ? "s" : ""} in the last 10 minutes.
                        {attemptCount < LOCKOUT_5_AFTER
                          ? ` ${LOCKOUT_5_AFTER - attemptCount} more before a 5-minute lockout.`
                          : attemptCount < LOCKOUT_15_AFTER
                          ? ` ${LOCKOUT_15_AFTER - attemptCount} more before a 15-minute lockout.`
                          : ""}
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || isLockedOut || (needsCaptcha && !captchaPassed)}
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>

                <div className="mt-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="link" className="w-full">Forgot Password?</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset Password</AlertDialogTitle>
                        <AlertDialogDescription>
                          Enter your email and we'll send you a password reset link.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="recovery-email">Email</Label>
                          <Input
                            id="recovery-email"
                            type="email"
                            value={recoveryEmail}
                            onChange={(e) => setRecoveryEmail(e.target.value)}
                            placeholder="Enter your email"
                          />
                        </div>
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePasswordReset} disabled={loading}>
                          Send Reset Link
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TabsContent>

              {/* ── Sign Up ── */}
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Input
                      type="text"
                      placeholder="Username (optional)"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      type="password"
                      placeholder="Password (min 6 characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
