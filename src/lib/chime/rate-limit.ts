type Bucket = { timestamps: number[]; lockUntil: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Max actions allowed within the window. */
  limit: number;
  /** Sliding window in milliseconds. */
  windowMs: number;
  /** Cooldown after the limit is exceeded, in milliseconds. */
  cooldownMs?: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** When the next action will be allowed, ms epoch. */
  resetsAt: number;
  /** Actions remaining in the current window. */
  remaining: number;
}

function loadBucket(key: string): Bucket {
  const cached = buckets.get(key);
  if (cached) return cached;
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(`chime:rl:${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Bucket;
        if (parsed && Array.isArray(parsed.timestamps) && typeof parsed.lockUntil === "number") {
          buckets.set(key, parsed);
          return parsed;
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }
  const fresh: Bucket = { timestamps: [], lockUntil: 0 };
  buckets.set(key, fresh);
  return fresh;
}

function persistBucket(key: string, bucket: Bucket): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`chime:rl:${key}`, JSON.stringify(bucket));
  } catch {
    // storage full or blocked — ignore
  }
}

/**
 * Best-effort client-side rate limiter using localStorage.
 * This is NOT real DDoS protection — it only stops the same browser tab
 * from hammering an endpoint. Enable Firebase App Check + reCAPTCHA on the
 * server for real protection.
 */
export function checkRateLimit(key: string, cfg: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const bucket = loadBucket(key);

  if (bucket.lockUntil > now) {
    return { ok: false, resetsAt: bucket.lockUntil, remaining: 0 };
  }

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < cfg.windowMs);

  if (bucket.timestamps.length >= cfg.limit) {
    bucket.lockUntil = now + (cfg.cooldownMs ?? cfg.windowMs);
    persistBucket(key, bucket);
    return { ok: false, resetsAt: bucket.lockUntil, remaining: 0 };
  }

  bucket.timestamps.push(now);
  persistBucket(key, bucket);
  return {
    ok: true,
    resetsAt: now + cfg.windowMs,
    remaining: cfg.limit - bucket.timestamps.length,
  };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(`chime:rl:${key}`);
    } catch {
      // ignore
    }
  }
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export const LIMITS = {
  signIn: { limit: 5, windowMs: 5 * 60_000, cooldownMs: 15 * 60_000 },
  signUp: { limit: 3, windowMs: 30 * 60_000, cooldownMs: 60 * 60_000 },
  sendMessage: { limit: 20, windowMs: 30_000, cooldownMs: 60_000 },
  createServer: { limit: 5, windowMs: 60 * 60_000, cooldownMs: 60 * 60_000 },
  createChannel: { limit: 20, windowMs: 60 * 60_000 },
  joinServer: { limit: 10, windowMs: 60 * 60_000, cooldownMs: 30 * 60_000 },
  friendRequest: { limit: 15, windowMs: 60 * 60_000, cooldownMs: 30 * 60_000 },
  uploadAvatar: { limit: 5, windowMs: 10 * 60_000 },
  uploadServerIcon: { limit: 5, windowMs: 10 * 60_000 },
  updateProfile: { limit: 10, windowMs: 5 * 60_000 },
  createGroup: { limit: 5, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitConfig>;
