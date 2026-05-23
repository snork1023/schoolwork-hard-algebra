import { useState } from "react";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import clsx from "clsx";
import { useChime } from "./ChimeProvider";
import { LIMITS } from "@/lib/chime/sanitize";

const HCAPTCHA_SITE_KEY =
  import.meta.env.VITE_HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000001";

export function ChimeAuthPanel() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-mesh px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="pointer-events-none absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-primary/30 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-accent/30 blur-3xl animate-float-slow [animation-delay:2s]" />

      <section className="relative z-10 w-full max-w-md">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground glow-text">
              Chime
            </span>
          </div>
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {mode === "login" ? "Need an account? " : "Have one? "}
            <span className="text-primary underline-offset-4 hover:underline">
              {mode === "login" ? "Sign up" : "Log in"}
            </span>
          </button>
        </div>

        <div className="gradient-border p-8">
          {mode === "login" ? <LoginForm /> : <SignupForm />}
        </div>
      </section>
    </main>
  );
}

function LoginForm() {
  const { signIn } = useChime();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const r = await signIn(email, password);
    setSubmitting(false);
    if (!r.ok) setError(r.error ?? "Could not sign in.");
  };

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Sign in to keep chiming.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" autoComplete="on">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(v) => setEmail(v.slice(0, LIMITS.EMAIL_MAX))}
          placeholder="you@chime.app"
          maxLength={LIMITS.EMAIL_MAX}
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(v) => setPassword(v.slice(0, LIMITS.PASSWORD_MAX))}
          placeholder="••••••••"
          maxLength={LIMITS.PASSWORD_MAX}
          autoComplete="current-password"
          required
        />
        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/30">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="mt-7 text-center text-xs text-muted-foreground/70">
        Be kind. Don't spam. Repeated failed sign-ins are rate-limited.
      </p>
    </>
  );
}

function SignupForm() {
  const { signUp } = useChime();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!captchaToken) {
      setError("Please complete the captcha.");
      return;
    }
    setSubmitting(true);
    const r = await signUp(email, username, displayName, password, captchaToken);
    setSubmitting(false);
    if (!r.ok) {
      setError(r.error ?? "Could not sign up.");
      setCaptchaToken(null);
    }
  };

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Pick a name, pick a vibe. Start chiming.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" autoComplete="on">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(v) => setEmail(v.slice(0, LIMITS.EMAIL_MAX))}
          placeholder="you@chime.app"
          maxLength={LIMITS.EMAIL_MAX}
          autoComplete="email"
          required
        />
        <Field
          label="Username"
          type="text"
          value={username}
          onChange={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, LIMITS.USERNAME_MAX))}
          placeholder="lowercase, letters, numbers, _"
          maxLength={LIMITS.USERNAME_MAX}
          autoComplete="username"
          required
          minLength={LIMITS.USERNAME_MIN}
          hint={`${LIMITS.USERNAME_MIN}–${LIMITS.USERNAME_MAX} chars, lowercase letters + numbers + _`}
        />
        <Field
          label="Display name"
          type="text"
          value={displayName}
          onChange={(v) => setDisplayName(v.slice(0, LIMITS.DISPLAY_NAME_MAX))}
          placeholder="How others see you"
          maxLength={LIMITS.DISPLAY_NAME_MAX}
          autoComplete="name"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(v) => setPassword(v.slice(0, LIMITS.PASSWORD_MAX))}
          placeholder="••••••••"
          maxLength={LIMITS.PASSWORD_MAX}
          autoComplete="new-password"
          required
          minLength={LIMITS.PASSWORD_MIN}
          hint={`At least ${LIMITS.PASSWORD_MIN} characters`}
        />

        <div className="flex justify-center">
          <HCaptcha
            sitekey={HCAPTCHA_SITE_KEY}
            onVerify={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
            theme="dark"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/30">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !captchaToken}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </form>

      <p className="mt-7 text-center text-xs text-muted-foreground/70">
        By signing up, you agree to be a kind member of the community.
      </p>
    </>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  minLength,
  maxLength,
  autoComplete,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={false}
        className={clsx(
          "mt-1.5 w-full rounded-xl border border-border bg-card/70 px-3.5 py-2.5 text-sm text-foreground outline-none transition",
          "placeholder:text-muted-foreground/40",
          "focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/20"
        )}
      />
      {hint && (
        <span className="mt-1 block text-[10px] text-muted-foreground/70">{hint}</span>
      )}
    </label>
  );
}
