import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

const OPENROUTER_API_KEY = defineSecret("OPENROUTER_API_KEY");

const RATE_LIMIT = 30;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_MESSAGES_IN_HISTORY = 50;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 40_000;
const MAX_BODY_BYTES = 256 * 1024;

const ALLOWED_ORIGINS = [
  "https://schoolwork-hard-algebra.pages.dev",
  "http://localhost:8080",
  "http://localhost:5173",
];

function setCors(req: { header: (n: string) => string | undefined }, resHeaders: Map<string, string>) {
  const origin = req.header("Origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    resHeaders.set("Access-Control-Allow-Origin", origin);
    resHeaders.set("Vary", "Origin");
  }
  resHeaders.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  resHeaders.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  resHeaders.set("Access-Control-Max-Age", "3600");
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function validateMessages(raw: unknown): { ok: true; messages: ChatMessage[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "messages must be an array" };
  if (raw.length === 0) return { ok: false, error: "messages is empty" };
  if (raw.length > MAX_MESSAGES_IN_HISTORY) {
    return { ok: false, error: `messages history too long (max ${MAX_MESSAGES_IN_HISTORY})` };
  }
  let totalChars = 0;
  const messages: ChatMessage[] = [];
  for (const m of raw) {
    if (
      !m ||
      typeof m !== "object" ||
      typeof (m as any).role !== "string" ||
      typeof (m as any).content !== "string"
    ) {
      return { ok: false, error: "invalid message shape" };
    }
    const role = (m as any).role;
    if (role !== "user" && role !== "assistant" && role !== "system") {
      return { ok: false, error: "invalid message role" };
    }
    const content = (m as any).content as string;
    if (content.length > MAX_MESSAGE_CHARS) {
      return { ok: false, error: `message too long (max ${MAX_MESSAGE_CHARS} chars)` };
    }
    totalChars += content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return { ok: false, error: "conversation history too long" };
    }
    messages.push({ role, content });
  }
  return { ok: true, messages };
}

export const aiChat = onRequest(
  {
    region: "us-central1",
    cors: false,
    secrets: [OPENROUTER_API_KEY],
    timeoutSeconds: 300,
    memory: "512MiB",
    maxInstances: 20,
    concurrency: 40,
  },
  async (req, res) => {
    const headers = new Map<string, string>();
    setCors(req, headers);
    headers.forEach((v, k) => res.setHeader(k, v));

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const contentLength = Number(req.header("content-length") ?? "0");
    if (contentLength > MAX_BODY_BYTES) {
      res.status(413).json({ error: "Request too large" });
      return;
    }

    const authHeader = req.header("Authorization") ?? req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const idToken = authHeader.slice(7).trim();
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (err) {
      logger.warn("Firebase token verification failed", err);
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    const uid = decoded.uid;

    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const usageRef = db.collection("aiChatUsage").doc(uid);

    const usage = await db.runTransaction(async (tx) => {
      const snap = await tx.get(usageRef);
      const data = snap.exists
        ? (snap.data() as { timestamps?: number[] })
        : { timestamps: [] };
      const recent = (data.timestamps ?? []).filter((t) => t > cutoff);
      if (recent.length >= RATE_LIMIT) {
        return { allowed: false, count: recent.length, oldest: recent[0] ?? now };
      }
      recent.push(now);
      tx.set(usageRef, { timestamps: recent, updatedAt: now });
      return { allowed: true, count: recent.length, oldest: recent[0] ?? now };
    });

    if (!usage.allowed) {
      res.status(429).json({
        error: "rate_limited",
        message: `You've used all ${RATE_LIMIT} messages for this hour.`,
        resetsAt: new Date(usage.oldest + WINDOW_MS).toISOString(),
        used: usage.count,
        limit: RATE_LIMIT,
      });
      return;
    }

    const validated = validateMessages((req.body as { messages?: unknown })?.messages);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const apiKey = OPENROUTER_API_KEY.value();
    if (!apiKey) {
      logger.error("OPENROUTER_API_KEY secret is not set");
      res.status(500).json({ error: "AI service not configured." });
      return;
    }

    let openrouterResp: Response;
    try {
      openrouterResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat",
          messages: [
            { role: "system", content: "You are a helpful AI assistant." },
            ...validated.messages,
          ],
          stream: true,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });
    } catch (err) {
      logger.error("OpenRouter fetch failed", err);
      res.status(502).json({ error: "AI service unreachable." });
      return;
    }

    if (!openrouterResp.ok) {
      const errText = await openrouterResp.text().catch(() => "");
      logger.error("OpenRouter error", { status: openrouterResp.status, body: errText });
      if (openrouterResp.status === 429) {
        res.status(429).json({ error: "Upstream rate limit hit. Try again shortly." });
        return;
      }
      res.status(502).json({ error: "AI service error." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const reader = openrouterResp.body?.getReader();
    if (!reader) {
      res.end();
      return;
    }

    let aborted = false;
    req.on("close", () => {
      aborted = true;
      reader.cancel().catch(() => {});
    });

    try {
      while (true) {
        if (aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch (err) {
      logger.error("Stream relay error", err);
    } finally {
      res.end();
    }
  }
);
