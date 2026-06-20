import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { loadHCaptcha, waitForHCaptcha } from "@/lib/hcaptcha-loader";

const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY as string | undefined;

if (!HCAPTCHA_SITEKEY) {
  // Fails loudly in dev instead of silently passing `undefined` to hcaptcha.render()
  console.error(
    "VITE_HCAPTCHA_SITEKEY is not set. Add it to your .env file and restart the dev server."
  );
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
// Sign-up: username + email + password
const signUpSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(50)
    .regex(/^[a-zA-Z0-9_\- ]+$/, "Username can only contain letters, numbers, spaces, hyphens, and underscores"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

// Sign-in: email + password
const signInSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ─── hCaptcha hook ───────────────────────────────────────────────────────────
// Renders an hCaptcha widget into the given container ref and tracks its token.
// Assumes the container stays mounted for the lifetime of the component
// (visibility toggled with CSS, not conditional render) since hcaptcha.render()
// injects DOM that React doesn't manage, and unmount/remount cycles break it.
function useHCaptchaWidget(containerRef: React.RefObject<HTMLDivElement>) {
  const [token, setToken] = useState<string | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tryRender = () => {
      if (cancelled || widgetIdRef.current !== null) return;
      if (!containerRef.current) {
        requestAnimationFrame(tryRender);
        return;
      }
      waitForHCaptcha().then((hcaptcha) => {
        if (cancelled || widgetIdRef.current !== null || !HCAPTCHA_SITEKEY) return;
        const id = hcaptcha.render(containerRef.current!, {
          sitekey: HCAPTCHA_SITEKEY,
          callback: (t: string) => setToken(t),
          "expired-callback": () => setToken(null),
          "error-callback": () => setToken(null),
        });
        widgetIdRef.current = id;
      });
    };

    loadHCaptcha();
    tryRender();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setToken(null);
    if (widgetIdRef.current !== null) {
      waitForHCaptcha().then((hcaptcha) => hcaptcha.reset(widgetIdRef.current));
    }
  };

  return { token, reset };
}

const Auth = () => {
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpAgreementChecked, setSignUpAgreementChecked] = useState(false);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // Password reset
  const [resetEmail, setResetEmail] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);

  // Controlled so we can animate a sliding indicator behind the active tab
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");

  // hCaptcha containers + state, one widget per form
  const signInCaptchaRef = useRef<HTMLDivElement>(null);
  const signUpCaptchaRef = useRef<HTMLDivElement>(null);
  const resetCaptchaRef = useRef<HTMLDivElement>(null);

  const signInCaptcha = useHCaptchaWidget(signInCaptchaRef);
  const signUpCaptcha = useHCaptchaWidget(signUpCaptchaRef);
  const resetCaptcha = useHCaptchaWidget(resetCaptchaRef);

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

  // ── Sign In ────────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInCaptcha.token) {
      toast({ title: "Please complete the CAPTCHA", variant: "destructive" });
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
        options: { captchaToken: signInCaptcha.token },
      });
      if (error) throw error;
      toast({ title: "Welcome back!" });
    } catch (error: any) {
      toast({ title: "Sign in failed", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      signInCaptcha.reset();
      setLoading(false);
    }
  };

 // ── Sign Up ────────────────────────────────────────────────────────────────
const handleSignUp = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!signUpAgreementChecked) {
    toast({
      title: "Agreement required",
      description: "You must agree to the Privacy Policy and Terms of Service to create an account.",
      variant: "destructive",
    });
    return;
  }
  if (!signUpCaptcha.token) {
    toast({ title: "Please complete the CAPTCHA", variant: "destructive" });
    return;
  }

  const validation = signUpSchema.safeParse({
    username: signUpUsername,
    email: signUpEmail,
    password: signUpPassword,
  });
  if (!validation.success) {
    toast({
      title: "Validation error",
      description: validation.error.errors[0].message,
      variant: "destructive",
    });
    return;
  }

  setLoading(true);
  try {
    const { data, error } = await supabase.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
      options: {
        data: { username: validation.data.username },
        emailRedirectTo: `${window.location.origin}/`,
        captchaToken: signUpCaptcha.token,
      },
    });

    if (error) {
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

    // Duplicate email detection when email confirmation is ON
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      toast({
        title: "Email already in use",
        description: "An account with that email already exists. Please sign in instead.",
        variant: "destructive",
      });
      return;
    }

    // Insert profile row so username actually exists
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          username: validation.data.username,
        });

      if (profileError) {
        console.error("Profile insert error:", profileError);
        toast({
          title: "Profile error",
          description: "Your account was created, but we couldn't set up your profile.",
          variant: "destructive",
        });
      }
    }

    toast({
      title: "Account created!",
      description: "Check your email to verify your account.",
    });

    setSignUpUsername("");
    setSignUpEmail("");
    setSignUpPassword("");
    setSignUpAgreementChecked(false);
  } catch (error: any) {
    toast({
      title: "Error",
      description: getUserFriendlyError(error),
      variant: "destructive",
    });
  } finally {
    signUpCaptcha.reset();
    setLoading(false);
  }
};

  // ── Password Reset ─────────────────────────────────────────────────────────
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetCaptcha.token) {
      toast({ title: "Please complete the CAPTCHA", variant: "destructive" });
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
        captchaToken: resetCaptcha.token,
      });
      if (error) throw error;

      toast({ title: "Check your email", description: "We sent you a password reset link." });
      setResetEmail("");
      setShowResetForm(false);
    } catch (error: any) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      resetCaptcha.reset();
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
            {/* Both this form and the Tabs block below stay mounted at all times.
                Visibility is toggled with `hidden` rather than a conditional render,
                because hcaptcha.render() injects DOM (an iframe) into the captcha
                container that React doesn't manage — unmounting that container
                breaks the widget and it can't cleanly come back. */}
            <form onSubmit={handlePasswordReset} className={`space-y-4 ${showResetForm ? "" : "hidden"}`}>
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

              <div className="flex justify-center" ref={resetCaptchaRef} />

              <div className="flex gap-2">
                <Button type="submit" disabled={loading || !resetCaptcha.token} className="flex-1">
                  {loading ? "Sending…" : "Send Reset Link"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowResetForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>

            <div className={showResetForm ? "hidden" : ""}>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "signin" | "signup")}>
                <TabsList className="relative grid w-full grid-cols-2">
                  <div
                    aria-hidden
                    className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-sm bg-background shadow-sm transition-transform duration-300 ease-out"
                    style={{
                      transform: activeTab === "signup" ? "translateX(100%)" : "translateX(0%)",
                    }}
                  />
                  <TabsTrigger value="signin" className="relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                {/* ── Sign In ── */}
                <TabsContent value="signin" forceMount className="data-[state=inactive]:hidden">
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
                      />
                    </div>

                    <div className="flex justify-center" ref={signInCaptchaRef} />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading || !signInCaptcha.token}
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
                <TabsContent value="signup" forceMount className="data-[state=inactive]:hidden">
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
                    <div className="flex items-center justify-center gap-2">
                      <Checkbox
                        id="signup-agreement"
                        checked={signUpAgreementChecked}
                        onCheckedChange={(v) => setSignUpAgreementChecked(v === true)}
                      />
                      <Label htmlFor="signup-agreement" className="text-sm cursor-pointer">
                        I have read, understood, and agree to Kepler's <Link to="/termsofservice" className="underline">Terms of Service</Link> and <Link to="/privacypolicy" className="underline">Privacy Policy</Link>.
                      </Label>
                    </div>

                    <div className="flex justify-center" ref={signUpCaptchaRef} />

                    <Button type="submit" className="w-full" disabled={loading || !signUpAgreementChecked || !signUpCaptcha.token}>
                      {loading ? "Creating account…" : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;