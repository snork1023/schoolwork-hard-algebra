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
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(64, "Password must be at most 64 characters")
  .regex(/\d/, "Password must contain at least one number")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter");

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
  password: passwordSchema,
});

// Sign-in: email + password
const signInSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Password reset step 3: just the new password
const resetPasswordSchema = z.object({
  password: passwordSchema,
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

function getPasswordChecks(password: string) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };
}

const Auth = () => {
  // Sign-up: which step of the request-otp -> verify-otp -> set-password flow we're on
  const [signUpStep, setSignUpStep] = useState<"request" | "otp" | "password">("request");
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpOtp, setSignUpOtp] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpAgreementChecked, setSignUpAgreementChecked] = useState(false);
  const [signUpResendCooldown, setSignUpResendCooldown] = useState(0);
  const [showSignUpResendModal, setShowSignUpResendModal] = useState(false);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // Password reset: same three-step shape as sign-up (request -> otp -> new password)
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "otp" | "password">("request");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetResendCooldown, setResetResendCooldown] = useState(0);
  const [showResetResendModal, setShowResetResendModal] = useState(false);

  // Password visibility
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Password checks
  const signUpPasswordChecks = getPasswordChecks(signUpPassword);
  const resetPasswordChecks = getPasswordChecks(resetPassword);

  // Password focus
  const [signUpPasswordFocused, setSignUpPasswordFocused] = useState(false);
  const [resetPasswordFocused, setResetPasswordFocused] = useState(false);

  const showSignUpPasswordRequirements = signUpPasswordFocused || signUpPassword.length > 0;
  const showResetPasswordRequirements = resetPasswordFocused || resetPassword.length > 0;

  const signUpPasswordValid =
    signUpPasswordChecks.length &&
    signUpPasswordChecks.uppercase &&
    signUpPasswordChecks.lowercase &&
    signUpPasswordChecks.number;

  const resetPasswordValid =
    resetPasswordChecks.length &&
    resetPasswordChecks.uppercase &&
    resetPasswordChecks.lowercase &&
    resetPasswordChecks.number;

  // Controlled so we can animate a sliding indicator behind the active tab
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");

  // hCaptcha containers + state. Each "request an OTP" action (sign-up send,
  // sign-up resend, reset send, reset resend) gets its own widget rather than
  // one shared widget moved between steps — the container can't be relocated
  // between conditionally-hidden forms without breaking the injected iframe,
  // same reason forms stay permanently mounted below instead of conditionally
  // rendered.
  const signInCaptchaRef = useRef<HTMLDivElement>(null);
  const signUpCaptchaRef = useRef<HTMLDivElement>(null);
  const signUpResendCaptchaRef = useRef<HTMLDivElement>(null);
  const resetCaptchaRef = useRef<HTMLDivElement>(null);
  const resetResendCaptchaRef = useRef<HTMLDivElement>(null);

  const signInCaptcha = useHCaptchaWidget(signInCaptchaRef);
  const signUpCaptcha = useHCaptchaWidget(signUpCaptchaRef);
  const signUpResendCaptcha = useHCaptchaWidget(signUpResendCaptchaRef);
  const resetCaptcha = useHCaptchaWidget(resetCaptchaRef);
  const resetResendCaptcha = useHCaptchaWidget(resetResendCaptchaRef);

  const navigate = useNavigate();
  const { toast } = useToast();

  // verifyOtp signs the user in (sign-up flow) or starts a recovery session
  // (reset flow) before the password step is done. This ref stops the
  // redirect-on-SIGNED_IN below from firing mid-flow, so we can send the user
  // onward ourselves once the password step actually completes.
  const skipAuthRedirectRef = useRef(false);

  // Redirect if already signed in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session) {
        if (skipAuthRedirectRef.current) return;
        navigate("/chat");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Resend cooldown countdowns
  useEffect(() => {
    if (signUpResendCooldown <= 0) return;
    const timer = setTimeout(() => setSignUpResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [signUpResendCooldown]);

  useEffect(() => {
    if (resetResendCooldown <= 0) return;
    const timer = setTimeout(() => setResetResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resetResendCooldown]);

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
  const requestSignUpOtp = async (captchaToken: string, email: string) => {
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
      setSignUpResendCooldown(60);
      toast({ title: "Code sent", description: "Check your email for the 6-digit code." });
    } catch (error: any) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendSignUpOtp = async (e: React.FormEvent) => {
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
    await requestSignUpOtp(signUpCaptcha.token, validation.data.email);
    signUpCaptcha.reset();
  };

  const handleOpenResendModal = () => {
    if (signUpResendCooldown > 0 || loading) return;
    setShowSignUpResendModal(true);
  };

  // Once the resend-modal's captcha is solved, fire the resend automatically
  // and close the popup — the user shouldn't have to click anything else.
  // Closing the modal synchronously (before the await) keeps this effect
  // from firing a second time while the request is in flight.
  useEffect(() => {
    if (!showSignUpResendModal || !signUpResendCaptcha.token) return;
    const token = signUpResendCaptcha.token;
    setShowSignUpResendModal(false);
    (async () => {
      await requestSignUpOtp(token, signUpEmail);
      signUpResendCaptcha.reset();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signUpResendCaptcha.token, showSignUpResendModal]);

  const handleChangeSignUpEmail = () => {
    setSignUpStep("request");
    setSignUpOtp("");
    setSignUpResendCooldown(0);
    setShowSignUpResendModal(false);
    signUpResendCaptcha.reset();
  };

  // ── Sign Up: step 2 — verify the OTP ──────────────────────────────────────────
  const handleVerifySignUpOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = signUpOtp.trim();
    if (code.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    skipAuthRedirectRef.current = true;
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: signUpEmail,
        token: code,
        type: "email",
      });
      if (error) throw error;

      // signInWithOtp doesn't distinguish new vs. returning users at request
      // time — an existing user's OTP verifies here too. If a profile
      // already exists for this id, they already have an account, so don't
      // let this flow continue on to overwrite their password.
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (existingProfile) {
          await supabase.auth.signOut();
          skipAuthRedirectRef.current = false;
          toast({
            title: "Account already exists",
            description: "An account with this email already exists. Please sign in instead.",
            variant: "destructive",
          });
          setSignUpStep("request");
          setSignUpEmail("");
          setSignUpOtp("");
          setSignInEmail(signUpEmail);
          setActiveTab("signin");
          return;
        }
      }

      setSignUpStep("password");
    } catch (error: any) {
      skipAuthRedirectRef.current = false;
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
          .upsert(
            { id: userData.user.id, username: validation.data.username },
            { onConflict: "id" }
          );

        if (profileError) {
          if (profileError.code === "23505") {
            // Unique violation on username — someone else already has it.
            // The user is already authenticated at this point, so just let
            // them try a different one instead of losing the session.
            toast({
              title: "Username taken",
              description: "That username is already in use. Please choose another.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
          console.error("Profile insert error:", profileError);
          toast({
            title: "Profile error",
            description: "Your account was created, but we couldn't set up your profile.",
            variant: "destructive",
          });
        }
      }

      toast({ title: "Account created!" });
      skipAuthRedirectRef.current = false;
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

  // ── Password Reset: step 1 — request the OTP ──────────────────────────────────
  const requestPasswordResetOtp = async (captchaToken: string, email: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        captchaToken,
      });
      if (error) throw error;
      setResetOtp("");
      setResetStep("otp");
      setResetResendCooldown(60);
      toast({ title: "Code sent", description: "Check your email for the 6-digit code." });
    } catch (error: any) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCaptcha.token) {
      toast({ title: "Please complete the CAPTCHA", variant: "destructive" });
      return;
    }
    const validation = z.string().trim().email("Invalid email address").safeParse(resetEmail);
    if (!validation.success) {
      toast({ title: "Invalid email", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }
    setResetEmail(validation.data);
    await requestPasswordResetOtp(resetCaptcha.token, validation.data);
    resetCaptcha.reset();
  };

  const handleOpenResetResendModal = () => {
    if (resetResendCooldown > 0 || loading) return;
    setShowResetResendModal(true);
  };

  // Same pattern as the sign-up resend modal: once the popup's captcha is
  // solved, fire the resend automatically and close it. Closing synchronously
  // (before the await) stops this effect from firing twice while in flight.
  useEffect(() => {
    if (!showResetResendModal || !resetResendCaptcha.token) return;
    const token = resetResendCaptcha.token;
    setShowResetResendModal(false);
    (async () => {
      await requestPasswordResetOtp(token, resetEmail);
      resetResendCaptcha.reset();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetResendCaptcha.token, showResetResendModal]);

  const handleChangeResetEmail = () => {
    setResetStep("request");
    setResetOtp("");
    setResetResendCooldown(0);
    setShowResetResendModal(false);
    resetResendCaptcha.reset();
  };

  // ── Password Reset: step 2 — verify the OTP ───────────────────────────────────
  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = resetOtp.trim();
    if (code.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    skipAuthRedirectRef.current = true;
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: resetEmail,
        token: code,
        type: "recovery",
      });
      if (error) throw error;
      setResetStep("password");
    } catch (error: any) {
      skipAuthRedirectRef.current = false;
      toast({ title: "Invalid code", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Password Reset: step 3 — set the new password ─────────────────────────────
  const handleCancelReset = () => {
    setShowResetForm(false);
    setResetStep("request");
    setResetEmail("");
    setResetOtp("");
    setResetPassword("");
    setResetResendCooldown(0);
    setShowResetResendModal(false);
    resetCaptcha.reset();
    resetResendCaptcha.reset();
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = resetPasswordSchema.safeParse({ password: resetPassword });
    if (!validation.success) {
      toast({ title: "Validation error", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: validation.data.password });
      if (error) throw error;
      toast({ title: "Password updated!" });
      skipAuthRedirectRef.current = false;
      setShowResetForm(false);
      setResetStep("request");
      setResetEmail("");
      setResetOtp("");
      setResetPassword("");
      setShowResetResendModal(false);
      navigate("/chat");
    } catch (error: any) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
    } finally {
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
            {/* ── Password Reset ── */}
            {/* This block and the Tabs block below stay mounted at all times.
                Visibility is toggled with CSS rather than a conditional render,
                because hcaptcha.render() injects DOM (an iframe) into the captcha
                container that React doesn't manage — unmounting that container
                breaks the widget and it can't cleanly come back. */}
            <div className={`space-y-5 ${showResetForm ? "" : "hidden"}`}>
              {/* Step 1: email + captcha, request the code */}
              <form onSubmit={handleSendResetOtp} className={`space-y-4 ${resetStep === "request" ? "" : "hidden"}`}>
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
                    {loading ? "Sending…" : "Send Code"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelReset}>
                    Cancel
                  </Button>
                </div>
              </form>

              {/* Step 2: enter the 6-digit code */}
              <form onSubmit={handleVerifyResetOtp} className={`space-y-4 ${resetStep === "otp" ? "" : "hidden"}`}>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to{" "}
                  <span className="font-medium text-foreground">{resetEmail}</span>.
                </p>

                <div className="space-y-1">
                  <Label htmlFor="reset-otp">Verification code</Label>
                  <Input
                    id="reset-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="text-center text-lg tracking-[0.5em]"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={loading || resetOtp.length !== 6}>
                    {loading ? "Verifying…" : "Verify Code"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelReset}>
                    Cancel
                  </Button>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <Button type="button" variant="link" className="px-0" onClick={handleChangeResetEmail}>
                    Use a different email
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0"
                    onClick={handleOpenResetResendModal}
                    disabled={resetResendCooldown > 0 || loading}
                  >
                    {resetResendCooldown > 0 ? `Resend code (${resetResendCooldown}s)` : "Resend code"}
                  </Button>
                </div>
              </form>

              {/* Resend captcha popup — always laid out at full size (never
                  display:none), just faded/disabled when closed, so hCaptcha
                  never measures a 0x0 container when it renders the iframe. */}
              <div
                className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity duration-150 ${
                  showResetResendModal ? "opacity-100" : "opacity-0 invisible pointer-events-none"
                }`}
              >
                <div className="relative w-full max-w-xs rounded-lg border border-border bg-card p-4 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-muted-foreground">
                      Complete the CAPTCHA to resend your code
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowResetResendModal(false)}
                      className="text-muted-foreground hover:text-foreground shrink-0 ml-2"
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex justify-center" ref={resetResendCaptchaRef} />
                </div>
              </div>

              {/* Step 3: set the new password */}
              <form onSubmit={handleSetNewPassword} className={`space-y-4 ${resetStep === "password" ? "" : "hidden"}`}>
                <div className="space-y-2">
                  <Label htmlFor="reset-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="reset-password"
                      type={showResetPassword ? "text" : "password"}
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      onFocus={() => setResetPasswordFocused(true)}
                      onBlur={() => setResetPasswordFocused(false)}
                      placeholder="Enter a new password"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showResetPassword ? "Hide password" : "Show password"}
                    >
                      {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      showResetPasswordRequirements ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="space-y-2 rounded-lg border bg-muted/30 p-3 mt-2">
                      <PasswordRequirement valid={resetPasswordChecks.length} text="At least 8 characters" />
                      <PasswordRequirement valid={resetPasswordChecks.uppercase} text="One uppercase letter" />
                      <PasswordRequirement valid={resetPasswordChecks.lowercase} text="One lowercase letter" />
                      <PasswordRequirement valid={resetPasswordChecks.number} text="One number" />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading || !resetPasswordValid}>
                  {loading ? "Updating…" : "Update Password"}
                </Button>
              </form>
            </div>

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
                      onClick={() => {
                        setResetStep("request");
                        setShowResetForm(true);
                      }}
                    >
                      Forgot password?
                    </Button>
                  </form>
                </TabsContent>

                {/* ── Sign Up ── */}
                <TabsContent value="signup" forceMount className="data-[state=inactive]:hidden">
                  <div className="space-y-5">
                    {/* Step 1: email + captcha, request the code */}
                    <form onSubmit={handleSendSignUpOtp} className={`space-y-5 ${signUpStep === "request" ? "" : "hidden"}`}>
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
                        {loading ? "Confirming Email…" : "Confirm Email"}
                      </Button>
                    </form>

                    {/* Step 2: enter the 6-digit code */}
                    <form onSubmit={handleVerifySignUpOtp} className={`space-y-5 ${signUpStep === "otp" ? "" : "hidden"}`}>
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

                      <div className="flex items-center justify-between text-sm">
                        <Button type="button" variant="link" className="px-0" onClick={handleChangeSignUpEmail}>
                          Use a different email
                        </Button>
                        <Button
                          type="button"
                          variant="link"
                          className="px-0"
                          onClick={handleOpenResendModal}
                          disabled={signUpResendCooldown > 0 || loading}
                        >
                          {signUpResendCooldown > 0 ? `Resend code (${signUpResendCooldown}s)` : "Resend code"}
                        </Button>
                      </div>
                    </form>

                    {/* Resend captcha popup — always laid out at full size (never
                        display:none), just faded/disabled when closed, so hCaptcha
                        never measures a 0x0 container when it renders the iframe. */}
                    <div
                      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity duration-150 ${
                        showSignUpResendModal ? "opacity-100" : "opacity-0 invisible pointer-events-none"
                      }`}
                    >
                      <div className="relative w-full max-w-xs rounded-lg border border-border bg-card p-4 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs text-muted-foreground">
                            Complete the CAPTCHA to resend your code
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowSignUpResendModal(false)}
                            className="text-muted-foreground hover:text-foreground shrink-0 ml-2"
                            aria-label="Close"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex justify-center" ref={signUpResendCaptchaRef} />
                      </div>
                    </div>

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
                            onFocus={() => setSignUpPasswordFocused(true)}
                            onBlur={() => setSignUpPasswordFocused(false)}
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
                            showSignUpPasswordRequirements
                              ? "max-h-48 opacity-100"
                              : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 mt-2">

                            <PasswordRequirement
                              valid={signUpPasswordChecks.length}
                              text="At least 8 characters"
                            />

                            <PasswordRequirement
                              valid={signUpPasswordChecks.uppercase}
                              text="One uppercase letter"
                            />

                            <PasswordRequirement
                              valid={signUpPasswordChecks.lowercase}
                              text="One lowercase letter"
                            />

                            <PasswordRequirement
                              valid={signUpPasswordChecks.number}
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
                          !signUpPasswordValid
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