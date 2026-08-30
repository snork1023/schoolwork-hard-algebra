import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";
import { getUserFriendlyError } from "@/lib/error-utils";
import { loadHCaptcha, waitForHCaptcha } from "@/lib/hcaptcha-loader";

const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY as string | undefined;

if (!HCAPTCHA_SITEKEY) {
  console.error(
    "VITE_HCAPTCHA_SITEKEY is not set. Add it to your .env file and restart the dev server."
  );
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
// Sign-up step 1: just the email, used to request the OTP
const signUpEmailSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

// Sign-up step 3: username + password, collected once the email is verified
const signUpProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_\- ]+$/, "Username can only contain letters, numbers, spaces, hyphens, and underscores"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(64, "Password must be at most 64 characters")
    .regex(/\d/, "Password must contain at least one number")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter"),
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

function PasswordRequirement({
  valid,
  text,
}: {
  valid: boolean;
  text: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 transition-all duration-300 ${
        valid
          ? "text-green-500"
          : "text-muted-foreground"
      }`}
    >
      <div
        className={`transition-all duration-300 ${
          valid
            ? "rotate-0 scale-100"
            : "-rotate-90 scale-75"
        }`}
      >
        {valid ? (
          <Check className="h-4 w-4" />
        ) : (
          <X className="h-4 w-4" />
        )}
      </div>

      <span>{text}</span>
    </div>
  );
}

const Auth = () => {
  // Sign-up: which step of the request-otp -> verify-otp -> set-password flow we're on
  const [signUpStep, setSignUpStep] = useState<"request" | "otp" | "password">("request");
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpOtp, setSignUpOtp] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpAgreementChecked, setSignUpAgreementChecked] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // Password reset
  const [resetEmail, setResetEmail] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);

  // Password visibility
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // Password checks
  const passwordChecks = {
    length: signUpPassword.length >= 8,
    uppercase: /[A-Z]/.test(signUpPassword),
    lowercase: /[a-z]/.test(signUpPassword),
    number: /\d/.test(signUpPassword),
  };

  // Password focus
  const [passwordFocused, setPasswordFocused] = useState(false);

  const showPasswordRequirements =
  passwordFocused || signUpPassword.length > 0;

  const passwordValid =
    passwordChecks.length &&
    passwordChecks.uppercase &&
    passwordChecks.lowercase &&
    passwordChecks.number;

  // Controlled so we can animate a sliding indicator behind the active tab
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");

  // hCaptcha containers + state. Sign-up gets two separate widgets (one for the
  // initial "send code" request, one for "resend code") instead of one shared
  // widget moved between steps — the container can't be relocated between
  // conditionally-hidden forms without breaking the injected iframe, same
  // reason the reset-password form below stays permanently mounted.
  const signInCaptchaRef = useRef<HTMLDivElement>(null);
  const signUpCaptchaRef = useRef<HTMLDivElement>(null);
  const resendCaptchaRef = useRef<HTMLDivElement>(null);
  const resetCaptchaRef = useRef<HTMLDivElement>(null);

  const signInCaptcha = useHCaptchaWidget(signInCaptchaRef);
  const signUpCaptcha = useHCaptchaWidget(signUpCaptchaRef);
  const resendCaptcha = useHCaptchaWidget(resendCaptchaRef);
  const resetCaptcha = useHCaptchaWidget(resetCaptchaRef);

  const navigate = useNavigate();
  const { toast } = useToast();

  // verifyOtp signs the user in before they've set a password. This ref stops
  // the redirect-on-SIGNED_IN below from firing mid-signup, so we can send
  // them to /chat ourselves once the password step actually completes.
  const signupInProgressRef = useRef(false);

  // Redirect if already signed in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session) {
        if (signupInProgressRef.current) return;
        navigate("/chat");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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

  // ── Sign Up: step 1 — request the OTP ────────────────────────────────────────
  // Shared by both "Send Code" and "Resend Code" — each caller passes its own
  // captcha token since hCaptcha tokens are single-use.
  const requestOtp = async (captchaToken: string, email: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          captchaToken,
        },
      });
      if (error) throw error;
      setSignUpOtp("");
      setSignUpStep("otp");
      setResendCooldown(30);
      toast({ title: "Code sent", description: "Check your email for the 6-digit code." });
    } catch (error: any) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpCaptcha.token) {
      toast({ title: "Please complete the CAPTCHA", variant: "destructive" });
      return;
    }
    const validation = signUpEmailSchema.safeParse({ email: signUpEmail });
    if (!validation.success) {
      toast({ title: "Validation error", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSignUpEmail(validation.data.email);
    await requestOtp(signUpCaptcha.token, validation.data.email);
    signUpCaptcha.reset();
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    if (!resendCaptcha.token) {
      toast({ title: "Please complete the CAPTCHA", variant: "destructive" });
      return;
    }
    await requestOtp(resendCaptcha.token, signUpEmail);
    resendCaptcha.reset();
  };

  const handleChangeEmail = () => {
    setSignUpStep("request");
    setSignUpOtp("");
    setResendCooldown(0);
    resendCaptcha.reset();
  };

  // ── Sign Up: step 2 — verify the OTP ──────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = signUpOtp.trim();
    if (code.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    signupInProgressRef.current = true;
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: signUpEmail,
        token: code,
        type: "email",
      });
      if (error) throw error;
      setSignUpStep("password");
    } catch (error: any) {
      signupInProgressRef.current = false;
      toast({ title: "Invalid code", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up: step 3 — set username + password ─────────────────────────────────
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpAgreementChecked) {
      toast({
        title: "Agreement required",
        description: "You must agree to the Privacy Policy and Terms of Service to create an account.",
        variant: "destructive",
      });
      return;
    }

    const validation = signUpProfileSchema.safeParse({
      username: signUpUsername,
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
      const { error: updateError } = await supabase.auth.updateUser({
        password: validation.data.password,
        data: { username: validation.data.username },
      });
      if (updateError) throw updateError;

      const { data: userData, error: getUserError } = await supabase.auth.getUser();
      if (getUserError) throw getUserError;

      if (userData.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: userData.user.id,
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

      toast({ title: "Account created!" });
      signupInProgressRef.current = false;
      navigate("/account");
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
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
                  <form onSubmit={handleSignIn} className="space-y-5">
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
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showSignInPassword ? "text" : "password"}
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="pr-10"
                        />

                        <button
                          type="button"
                          onClick={() => setShowSignInPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showSignInPassword ? "Hide password" : "Show password"}
                        >
                          {showSignInPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
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
                  <div className="space-y-5">
                    {/* Step 1: email + captcha, request the code */}
                    <form onSubmit={handleSendOtp} className={`space-y-5 ${signUpStep === "request" ? "" : "hidden"}`}>
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

                      <div className="flex justify-center" ref={signUpCaptchaRef} />

                      <Button type="submit" className="w-full" disabled={loading || !signUpCaptcha.token}>
                        {loading ? "Conforming Email…" : "Conform Email"}
                      </Button>
                    </form>

                    {/* Step 2: enter the 6-digit code */}
                    <form onSubmit={handleVerifyOtp} className={`space-y-5 ${signUpStep === "otp" ? "" : "hidden"}`}>
                      <p className="text-sm text-muted-foreground">
                        Enter the 6-digit code sent to{" "}
                        <span className="font-medium text-foreground">{signUpEmail}</span>.
                      </p>

                      <div className="space-y-1">
                        <Label htmlFor="signup-otp">Verification code</Label>
                        <Input
                          id="signup-otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={signUpOtp}
                          onChange={(e) => setSignUpOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="123456"
                          className="text-center text-lg tracking-[0.5em]"
                          required
                        />
                      </div>

                      <Button type="submit" className="w-full" disabled={loading || signUpOtp.length !== 6}>
                        {loading ? "Verifying…" : "Verify Code"}
                      </Button>

                      <div className="space-y-1">
                        <div className="flex justify-center" ref={resendCaptchaRef} />
                        <div className="flex items-center justify-between text-sm">
                          <Button type="button" variant="link" className="px-0" onClick={handleChangeEmail}>
                            Use a different email
                          </Button>
                          <Button
                            type="button"
                            variant="link"
                            className="px-0"
                            onClick={handleResendOtp}
                            disabled={resendCooldown > 0 || loading || !resendCaptcha.token}
                          >
                            {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
                          </Button>
                        </div>
                      </div>
                    </form>

                    {/* Step 3: username + password */}
                    <form onSubmit={handleCreateAccount} className={`space-y-5 ${signUpStep === "password" ? "" : "hidden"}`}>
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
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                          <Input
                            id="signup-password"
                            type={showSignUpPassword ? "text" : "password"}
                            value={signUpPassword}
                            onChange={(e) => setSignUpPassword(e.target.value)}
                            onFocus={() => setPasswordFocused(true)}
                            onBlur={() => setPasswordFocused(false)}
                            placeholder="Create a password"
                            required
                            className="pr-10"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              setShowSignUpPassword((prev) => !prev)
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={
                              showSignUpPassword
                                ? "Hide password"
                                : "Show password"
                            }
                          >
                            {showSignUpPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        <div
                          className={`overflow-hidden transition-all duration-300 ease-out ${
                            showPasswordRequirements
                              ? "max-h-48 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 mt-2">

                            <PasswordRequirement
                              valid={passwordChecks.length}
                              text="At least 8 characters"
                            />

                            <PasswordRequirement
                              valid={passwordChecks.uppercase}
                              text="One uppercase letter"
                            />

                            <PasswordRequirement
                              valid={passwordChecks.lowercase}
                              text="One lowercase letter"
                            />

                            <PasswordRequirement
                              valid={passwordChecks.number}
                              text="One number"
                            />

                          </div>
                        </div>
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

                      <Button
                        type="submit"
                        className="
                          w-full
                          transition-all
                          duration-300
                        "
                        disabled={
                          loading ||
                          !signUpAgreementChecked ||
                          !passwordValid
                        }
                      >
                        {loading
                          ? "Creating account..."
                          : "Create Account"
                      }
                      </Button>
                    </form>
                  </div>
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