import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/buttons/button";
import {
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Pencil,
  X,
  RotateCcw,
  Search,
  Trash2,
  MoreHorizontal,
  Pin,
  Settings,
  Gauge,
  History,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Input } from "@/components/ui/forms/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/data-display/avatar";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownPortal,
  DropdownSub,
  DropdownSubContent,
  DropdownSubTrigger,
  DropdownTrigger,
} from "@/components/ui/menus/dropdown";
import {
  AI_PROMPT_MAX_CHARS,
  AiPromptBar,
  type AiEffort,
  type AiModelId,
  type AiPromptOptions,
} from "@/components/ai/AiPromptBar";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError, type User } from "@supabase/supabase-js";
import {
  AiChat,
  AiChatMessage,
  deleteAiChatHistory,
  loadAiChatHistory,
  saveAiChatHistory,
  sortAiChatHistory,
} from "@/lib/aiChatStorage";

type Message = AiChatMessage;

interface EdgeErrorPayload {
  code?: string;
  error?: string;
  quota?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readEdgeError(error: unknown): Promise<EdgeErrorPayload | null> {
  if (!(error instanceof FunctionsHttpError) || !(error.context instanceof Response)) return null;

  const body: unknown = await error.context.clone().json().catch(() => null);
  if (!isRecord(body)) return null;

  return {
    code: typeof body.code === "string" ? body.code : undefined,
    error: typeof body.error === "string" ? body.error : undefined,
    quota: isRecord(body.quota) ? body.quota : undefined,
  };
}

const RATE_LIMIT = 25;
const TOKEN_LIMIT = 30_000;
const DAILY_REQUEST_LIMIT = 75;
const DAILY_TOKEN_LIMIT = 90_000;
const AI_GREETINGS = [
  "How can I help today?",
  "What would you like to explore?",
  "Let’s work through something together.",
  "Ask a question or share an idea.",
];

interface ChatQuotaSnapshot {
  tokensUsed: number;
  tokenLimit: number;
  requestsUsed: number;
  requestLimit: number;
  resetAt: string | null;
  dailyTokensUsed: number;
  dailyTokenLimit: number;
  dailyRequestsUsed: number;
  dailyRequestLimit: number;
  dailyResetAt: string | null;
}

function getNextUtcMidnight(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function isQuotaBlocked(quota: ChatQuotaSnapshot): boolean {
  return (
    quota.tokensUsed >= quota.tokenLimit ||
    quota.requestsUsed >= quota.requestLimit ||
    quota.dailyTokensUsed >= quota.dailyTokenLimit ||
    quota.dailyRequestsUsed >= quota.dailyRequestLimit
  );
}

function getQuotaResetAt(quota: ChatQuotaSnapshot): Date | null {
  const now = Date.now();
  const resetTimes: number[] = [];

  if (quota.tokensUsed >= quota.tokenLimit || quota.requestsUsed >= quota.requestLimit) {
    const resetAt = quota.resetAt ? new Date(quota.resetAt).getTime() : NaN;
    if (Number.isFinite(resetAt) && resetAt > now) resetTimes.push(resetAt);
  }

  if (quota.dailyTokensUsed >= quota.dailyTokenLimit || quota.dailyRequestsUsed >= quota.dailyRequestLimit) {
    const dailyResetAt = quota.dailyResetAt ? new Date(quota.dailyResetAt).getTime() : NaN;
    if (Number.isFinite(dailyResetAt) && dailyResetAt > now) resetTimes.push(dailyResetAt);
  }

  return resetTimes.length ? new Date(Math.min(...resetTimes)) : null;
}

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function UsageLimitBar({
  label,
  tokensUsed,
  tokenLimit,
  requestsUsed,
  requestLimit,
  blocked,
}: {
  label: string;
  tokensUsed: number;
  tokenLimit: number;
  requestsUsed: number;
  requestLimit: number;
  blocked: boolean;
}) {
  const percentage = tokenLimit > 0 ? Math.min(100, (tokensUsed / tokenLimit) * 100) : 0;

  return (
    <div className="rounded-xl border border-border/50 bg-background/35 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{Math.round(percentage)}%</span>
      </div>
      <div
        role="meter"
        aria-label={`${label} token usage`}
        aria-valuemin={0}
        aria-valuemax={tokenLimit}
        aria-valuenow={Math.min(tokensUsed, tokenLimit)}
        className="h-2 overflow-hidden rounded-full bg-muted/70"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${blocked ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          {tokensUsed.toLocaleString()} / {tokenLimit.toLocaleString()} tokens
        </span>
        <span className="tabular-nums">
          {requestsUsed} / {requestLimit} requests
        </span>
      </div>
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\\\(.+?\\\)|(?<!\\)\$(?!\$)[^\n$]+?(?<!\\)\$(?!\$)|\*\*[^*]+?\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\+\+.+?\+\+|\*[^*]+\*)/g);
  return parts.filter(Boolean).map((part, i) => {
    if (part.startsWith("\\(") && part.endsWith("\\)")) {
      return (
        <span
          key={i}
          className="whitespace-normal"
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(part.slice(2, -2), {
              displayMode: false,
              throwOnError: false,
              trust: false,
            }),
          }}
        />
      );
    }
    if (part.startsWith("$") && part.endsWith("$")) {
      return (
        <span
          key={i}
          className="whitespace-normal"
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(part.slice(1, -1), {
              displayMode: false,
              throwOnError: false,
              trust: false,
            }),
          }}
        />
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("++") && part.endsWith("++")) {
      return <u key={i}>{part.slice(2, -2)}</u>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      let href: string | null = null;
      try {
        const parsed = new URL(linkMatch[2], "https://kepler.invalid");
        if (["http:", "https:", "mailto:"].includes(parsed.protocol)) href = linkMatch[2];
      } catch {
        href = null;
      }
      if (!href) return <span key={i}>{linkMatch[1]}</span>;
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-primary/60 underline-offset-2 hover:decoration-primary">
          {linkMatch[1]}
        </a>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 1) {
      return (
        <em key={i}>
          {part.slice(1, -1)}
        </em>
      );
    }
    return (
      <span key={i}>
        {part}
      </span>
    );
  });
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function isTableDivider(line: string): boolean {
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderInlineBlock(text: string, keyPrefix: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={key} className="my-1 ml-4 list-disc space-y-0.5">
        {listBuffer.map((item, idx) => (
          <li key={idx}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    if (line.includes("|") && idx + 1 < lines.length && isTableDivider(lines[idx + 1])) {
      flushList(`${keyPrefix}-list-before-table-${idx}`);
      const headers = parseTableRow(line);
      const rows: string[][] = [];
      idx += 2;
      while (idx < lines.length && lines[idx].includes("|") && lines[idx].trim()) {
        rows.push(parseTableRow(lines[idx]));
        idx += 1;
      }
      idx -= 1;
      elements.push(
        <div
          key={`${keyPrefix}-table-${idx}`}
          className="my-3 max-w-full overflow-x-auto rounded-xl border border-border/70 bg-background/40 shadow-sm"
        >
          <table className="w-full min-w-[360px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {headers.map((cell, cellIndex) => (
                  <th
                    key={cellIndex}
                    scope="col"
                    className="border-b border-border/70 bg-muted/60 px-4 py-3 text-sm font-semibold"
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="even:bg-muted/25">
                  {headers.map((_, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-4 py-3 align-top text-sm leading-relaxed"
                    >
                      {renderInline(row[cellIndex] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (headingMatch) {
      flushList(`${keyPrefix}-list-before-heading-${idx}`);
      const heading = renderInline(headingMatch[2]);
      const className = ["my-2 text-xl font-bold", "my-2 text-lg font-semibold", "my-1.5 text-base font-semibold"][
        Math.min(headingMatch[1].length - 1, 2)
      ];
      const key = `${keyPrefix}-heading-${idx}`;
      if (headingMatch[1].length === 1) elements.push(<h1 key={key} className={className}>{heading}</h1>);
      else if (headingMatch[1].length === 2) elements.push(<h2 key={key} className={className}>{heading}</h2>);
      else elements.push(<h3 key={key} className={className}>{heading}</h3>);
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.*)/);
    if (bulletMatch) {
      listBuffer.push(bulletMatch[1]);
      continue;
    }
    flushList(`${keyPrefix}-list-${idx}`);
    if (line.trim().length === 0) {
      elements.push(<br key={`${keyPrefix}-br-${idx}`} />);
    } else {
      elements.push(
        <p key={`${keyPrefix}-p-${idx}`} className="whitespace-pre-wrap break-words">
          {renderInline(line)}
        </p>
      );
    }
  }
  flushList(`${keyPrefix}-list-end`);

  return <div key={keyPrefix}>{elements}</div>;
}

function renderMarkdown(text: string, keyPrefix: string) {
  const blocks = text.split("```");
  return blocks.map((block, i) => {
    if (i % 2 === 1) {
      const firstLineBreak = block.indexOf("\n");
      const lang = firstLineBreak === -1 ? "" : block.slice(0, firstLineBreak).trim();
      const code = firstLineBreak === -1 ? block : block.slice(firstLineBreak + 1);
      return (
        <pre
          key={`${keyPrefix}-code-${i}`}
          className="my-2 overflow-x-auto rounded-lg border border-border bg-black/40 p-3 text-xs"
        >
          {lang && (
            <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {lang}
            </div>
          )}
          <code className="whitespace-pre font-mono">{code.replace(/\n$/, "")}</code>
        </pre>
      );
    }
    const mathBlocks = /\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let mathIndex = 0;
    while ((match = mathBlocks.exec(block)) !== null) {
      const before = block.slice(lastIndex, match.index);
      if (before) elements.push(renderInlineBlock(before, `${keyPrefix}-${i}-${mathIndex}-text`));
      const math = match[1] ?? match[2] ?? "";
      elements.push(
        <div
          key={`${keyPrefix}-${i}-math-${mathIndex}`}
          className="my-3 max-w-full overflow-x-auto text-center text-base"
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(math.trim(), {
              displayMode: true,
              throwOnError: false,
              trust: false,
            }),
          }}
        />
      );
      lastIndex = mathBlocks.lastIndex;
      mathIndex += 1;
    }
    const remaining = block.slice(lastIndex);
    if (remaining || elements.length === 0) {
      elements.push(renderInlineBlock(remaining, `${keyPrefix}-${i}-${mathIndex}-text`));
    }
    return elements;
  });
}

const Ai = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatHistory, setChatHistory] = useState<AiChat[]>([]);
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historySearch, setHistorySearch] = useState("");
  const [historySearchOpen, setHistorySearchOpen] = useState(false);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [selectedModel, setSelectedModel] = useState<AiModelId>("openai/gpt-oss-20b");
  const [selectedEffort, setSelectedEffort] = useState<AiEffort>("balanced");
  const [webSearch, setWebSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ username: string; avatarUrl: string | null }>({
    username: "",
    avatarUrl: null,
  });
  const [authReady, setAuthReady] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [resetsAt, setResetsAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");
  const [dailyResetsAt, setDailyResetsAt] = useState<Date | null>(null);
  const [dailyCountdown, setDailyCountdown] = useState("");
  const [usedMessages, setUsedMessages] = useState(0);
  const [limitMessages, setLimitMessages] = useState(RATE_LIMIT);
  const [usedTokens, setUsedTokens] = useState(0);
  const [dailyUsedMessages, setDailyUsedMessages] = useState(0);
  const [dailyUsedTokens, setDailyUsedTokens] = useState(0);
  const [quotaLoadError, setQuotaLoadError] = useState(false);
  const [lastFailed, setLastFailed] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dailyCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const openedChatSnapshotRef = useRef<{ chatId: string; messages: Message[] } | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordStartRef = useRef<number>(0);
  const maxRecordTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useUserSettings();
  const reduceMotion = useReducedMotion();

  useEffect(() => () => {
    if (maxRecordTimerRef.current) window.clearTimeout(maxRecordTimerRef.current);
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state === "recording") recorder.stop();
    }
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    recordingStreamRef.current = null;
  }, []);

  const updateQuotaState = useCallback((quota: ChatQuotaSnapshot) => {
    setUsedMessages(quota.requestsUsed);
    setLimitMessages(quota.requestLimit);
    setUsedTokens(quota.tokensUsed);
    setDailyUsedMessages(quota.dailyRequestsUsed);
    setDailyUsedTokens(quota.dailyTokensUsed);
    const blocked = isQuotaBlocked(quota);
    setRateLimited(blocked);
    const windowReset = quota.resetAt ? new Date(quota.resetAt) : null;
    setResetsAt(
      blocked
        ? getQuotaResetAt(quota)
        : windowReset && Number.isFinite(windowReset.getTime())
          ? windowReset
          : null
    );
    const dailyReset = quota.dailyResetAt ? new Date(quota.dailyResetAt) : null;
    setDailyResetsAt(
      dailyReset && Number.isFinite(dailyReset.getTime()) ? dailyReset : null
    );
  }, []);

  const syncQuotaFromServer = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("ai_user_quota")
        .select("tokens_used, requests_used, window_reset_at, daily_tokens_used, daily_requests_used, daily_window_date")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setQuotaLoadError(true);
        return;
      }

      const now = Date.now();
      const resetAt = data.window_reset_at ? new Date(data.window_reset_at) : null;
      const windowExpired = !resetAt || now >= resetAt.getTime();
      const todayUtc = new Date(now).toISOString().slice(0, 10);
      const dailyExpired = data.daily_window_date !== todayUtc;

      updateQuotaState({
        tokensUsed: windowExpired ? 0 : Number(data.tokens_used ?? 0),
        tokenLimit: TOKEN_LIMIT,
        requestsUsed: windowExpired ? 0 : Number(data.requests_used ?? 0),
        requestLimit: RATE_LIMIT,
        resetAt: windowExpired ? null : resetAt?.toISOString() ?? null,
        dailyTokensUsed: dailyExpired ? 0 : Number(data.daily_tokens_used ?? 0),
        dailyTokenLimit: DAILY_TOKEN_LIMIT,
        dailyRequestsUsed: dailyExpired ? 0 : Number(data.daily_requests_used ?? 0),
        dailyRequestLimit: DAILY_REQUEST_LIMIT,
        dailyResetAt: getNextUtcMidnight(new Date(now)).toISOString(),
      });
      setQuotaLoadError(false);
    } catch (error) {
      console.error("Failed to load chat quota:", error);
      setQuotaLoadError(true);
    }
  }, [user, updateQuotaState]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session) {
        setAuthReady(true);
        setNeedsAuth(true);
        return;
      }
      setUser(session.user);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setUser(null);
        setProfile({ username: "", avatarUrl: null });
        setAuthReady(true);
        setNeedsAuth(true);
        setHistoryUserId(null);
        setChatHistory([]);
        setActiveChatId(null);
        setMessages([]);
        return;
      }
      setProfile({ username: "", avatarUrl: null });
      setUser(session.user);
      setAuthReady(true);
      setNeedsAuth(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!authReady || !user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize remote quota after authentication
    syncQuotaFromServer();
  }, [authReady, user, syncQuotaFromServer]);

  useEffect(() => {
    if (!user) return;

    let active = true;
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        console.error("Failed to load AI sidebar profile:", error);
        return;
      }
      if (active && data) {
        setProfile({ username: data.username, avatarUrl: data.avatar_url });
      }
    };

    void fetchProfile();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!authReady || !user) return;

    try {
      const history = loadAiChatHistory(user.id);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate browser history once the authenticated user is known
      setChatHistory(history);
      setActiveChatId(null);
      setMessages([]);
      setHistoryUserId(user.id);
    } catch (error) {
      console.error("Failed to load local AI chat history:", error);
      toast({
        title: "Couldn't load chat history",
        description: "Your local AI chat history could not be read.",
        variant: "destructive",
      });
      setChatHistory([]);
      setActiveChatId(null);
      setMessages([]);
    }
  }, [authReady, user, toast]);

  useEffect(() => {
    const openedChatSnapshot = openedChatSnapshotRef.current;
    if (openedChatSnapshot) {
      openedChatSnapshotRef.current = null;
      if (
        openedChatSnapshot.chatId === activeChatId &&
        openedChatSnapshot.messages === messages
      ) {
        return;
      }
    }

    if (!user || historyUserId !== user.id || !activeChatId || messages.length === 0) return;

    const now = Date.now();
    const firstUserMessage = messages.find((message) => message.role === "user")?.content;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize the local history entry with the active transcript
    setChatHistory((history) => {
      const existing = history.find((chat) => chat.id === activeChatId);
      const updatedChat: AiChat = {
        id: activeChatId,
        title: existing?.title || firstUserMessage?.trim().slice(0, 60) || "New chat",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        messages,
        pinned: existing?.pinned,
      };
      return sortAiChatHistory([updatedChat, ...history.filter((chat) => chat.id !== activeChatId)]);
    });
  }, [messages, activeChatId, user, historyUserId]);

  useEffect(() => {
    if (!user || historyUserId !== user.id) return;

    const timeout = setTimeout(() => {
      try {
        const savedHistory = saveAiChatHistory(user.id, chatHistory);
        if (savedHistory.length !== chatHistory.length) setChatHistory(savedHistory);
      } catch (error) {
        console.error("Failed to save local AI chat history:", error);
        toast({
          title: "Couldn't save chat history",
          description: "Your browser may be out of storage space.",
          variant: "destructive",
        });
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [chatHistory, user, historyUserId, toast]);

  useEffect(() => {
    if (!resetsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the countdown when no reset time exists
      setCountdown("");
      return;
    }

    const tick = () => {
      const rem = resetsAt.getTime() - Date.now();
      if (rem <= 0) {
        setResetsAt(null);
        setCountdown("");
        void syncQuotaFromServer();
        if (countdownRef.current) clearInterval(countdownRef.current);
      } else {
        setCountdown(formatCountdown(rem));
      }
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [resetsAt, syncQuotaFromServer]);

  useEffect(() => {
    if (!dailyResetsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the daily countdown when no reset time exists
      setDailyCountdown("");
      return;
    }

    const tick = () => {
      const remaining = dailyResetsAt.getTime() - Date.now();
      if (remaining <= 0) {
        setDailyResetsAt(null);
        setDailyCountdown("");
        void syncQuotaFromServer();
        if (dailyCountdownRef.current) clearInterval(dailyCountdownRef.current);
      } else {
        setDailyCountdown(formatCountdown(remaining));
      }
    };

    tick();
    dailyCountdownRef.current = setInterval(tick, 1000);
    return () => {
      if (dailyCountdownRef.current) clearInterval(dailyCountdownRef.current);
    };
  }, [dailyResetsAt, syncQuotaFromServer]);

  // Track whether the user is near the bottom of the transcript, so
  // streamed tokens don't yank them back down if they scrolled up to reread.
  const hasMessages = messages.length > 0;
  useEffect(() => {
    if (hasMessages) return;
    const timer = window.setInterval(() => {
      setGreetingIndex((index) => (index + 1) % AI_GREETINGS.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [hasMessages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setIsNearBottom(distance < 120);
    };
    el.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [hasMessages]);

  useEffect(() => {
    if (!isNearBottom) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isNearBottom]);

  const sendToApi = useCallback(
    async (
      history: Message[],
      model = selectedModel,
      effort = selectedEffort,
      useWebSearch = webSearch
    ) => {
      if (isLoading || rateLimited) return;

      setMessages(history);
      setLastFailed(false);
      setIsLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast({
            title: "Not signed in",
            description: "Please sign in to use the AI assistant.",
            variant: "destructive",
          });
          setNeedsAuth(true);
          return;
        }

        const cleanedHistory = history.map((message) => ({
          role: message.role,
          content: message.content.trim(),
        }));

        const latestText = (cleanedHistory[cleanedHistory.length - 1]?.content || "").trim();
        if (!latestText || latestText.length > AI_PROMPT_MAX_CHARS) {
          throw new Error(`Prompt must be between 1 and ${AI_PROMPT_MAX_CHARS.toLocaleString()} characters.`);
        }

        const { data, error: functionError } = await supabase.functions.invoke("ai-chat", {
          body: {
            messages: cleanedHistory,
            selectedModel: model,
            effort,
            webSearch: useWebSearch,
          },
        });

        if (functionError || data?.error) {
          const edgeError = functionError ? await readEdgeError(functionError) : null;
          const errorCode = typeof data?.code === "string" ? data.code : edgeError?.code;
          const message =
            (typeof data?.error === "string" ? data.error : null) ||
            edgeError?.error ||
            (functionError instanceof FunctionsHttpError
              ? "The AI service couldn't process your request. Please try again."
              : functionError
                ? "We couldn't connect to the AI service. Check your connection and try again."
                : null) ||
            "The request couldn't be completed. Please try again.";
          const quota: unknown = data?.quota ?? edgeError?.quota;

          if (isRecord(quota)) {
            updateQuotaState({
              tokensUsed: Number(quota.tokensUsed ?? 0),
              tokenLimit: Number(quota.tokenLimit ?? TOKEN_LIMIT),
              requestsUsed: Number(quota.requestsUsed ?? 0),
              requestLimit: Number(quota.requestLimit ?? RATE_LIMIT),
              resetAt: typeof quota.resetAt === "string" ? quota.resetAt : null,
              dailyTokensUsed: Number(quota.dailyTokensUsed ?? 0),
              dailyTokenLimit: Number(quota.dailyTokenLimit ?? DAILY_TOKEN_LIMIT),
              dailyRequestsUsed: Number(quota.dailyRequestsUsed ?? 0),
              dailyRequestLimit: Number(quota.dailyRequestLimit ?? DAILY_REQUEST_LIMIT),
              dailyResetAt: typeof quota.dailyResetAt === "string" ? quota.dailyResetAt : null,
            });
          } else if (functionError && errorCode !== "provider_rate_limited") {
            await syncQuotaFromServer();
          }

          toast({
            title: errorCode === "provider_rate_limited"
              ? "Slow down"
              : errorCode === "prompt_blocked"
              ? "Message blocked"
              : errorCode === "daily_limit_reached" || errorCode === "two_hour_limit_reached"
                ? "AI usage limit reached"
                : "AI request failed",
            description: message,
            variant: "destructive",
          });
          setLastFailed(true);
          return;
        }

        const quota = data?.quota;
        if (quota) {
          updateQuotaState({
            tokensUsed: Number(quota.tokensUsed ?? 0),
            tokenLimit: Number(quota.tokenLimit ?? TOKEN_LIMIT),
            requestsUsed: Number(quota.requestsUsed ?? 0),
            requestLimit: Number(quota.requestLimit ?? RATE_LIMIT),
            resetAt: typeof quota.resetAt === "string" ? quota.resetAt : null,
            dailyTokensUsed: Number(quota.dailyTokensUsed ?? 0),
            dailyTokenLimit: Number(quota.dailyTokenLimit ?? DAILY_TOKEN_LIMIT),
            dailyRequestsUsed: Number(quota.dailyRequestsUsed ?? 0),
            dailyRequestLimit: Number(quota.dailyRequestLimit ?? DAILY_REQUEST_LIMIT),
            dailyResetAt: typeof quota.dailyResetAt === "string" ? quota.dailyResetAt : null,
          });
        } else {
          await syncQuotaFromServer();
        }

        const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
        if (!reply) {
          console.error("AI chat completed without returning a reply.");
          toast({
            title: "No response received",
            description: "The AI service didn't return a reply. Your usage may still have been counted; please try again.",
            variant: "destructive",
          });
          setLastFailed(true);
          return;
        }

        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        console.error("Chat error:", error);
        toast({
          title: "Error",
          description: "Failed to get response from AI.",
          variant: "destructive",
        });
        setLastFailed(true);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      isLoading,
      rateLimited,
      selectedModel,
      selectedEffort,
      syncQuotaFromServer,
      toast,
      updateQuotaState,
      webSearch,
    ]
  );

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      const recorder = mediaRecorderRef.current;
      if (recorder?.state === "recording") recorder.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      return;
    }

    if (isLoading || isTranscribing) return;

    let acquiredStream: MediaStream | null = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      acquiredStream = stream;
      recordingStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordStartRef.current = Date.now();

      return await new Promise<string | void>((resolve) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        recorder.onstop = async () => {
          if (maxRecordTimerRef.current) {
            window.clearTimeout(maxRecordTimerRef.current);
            maxRecordTimerRef.current = null;
          }
          stream.getTracks().forEach((track) => track.stop());
          if (recordingStreamRef.current === stream) recordingStreamRef.current = null;
          if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
          setIsRecording(false);

          if (Date.now() - recordStartRef.current < 500) {
            toast({
              title: "Voice input too short",
              description: "Hold the mic for at least 0.5 seconds.",
              variant: "destructive",
            });
            resolve();
            return;
          }

          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");

          setIsTranscribing(true);
          try {
            const { data, error } = await supabase.functions.invoke("ai-transcribe", { body: formData });
            if (error || data?.error) {
              const edgeError = error ? await readEdgeError(error) : null;
              toast({
                title: edgeError?.code === "voice_limit_reached" ? "Voice limit reached" : "Transcription failed",
                description:
                  (typeof data?.error === "string" ? data.error : null) ||
                  edgeError?.error ||
                  (error instanceof FunctionsHttpError
                    ? "The transcription service couldn't process your recording. Please try again."
                    : error
                      ? "We couldn't connect to the transcription service. Check your connection and try again."
                      : null) ||
                  "Voice transcription couldn't complete. Please try again.",
                variant: "destructive",
              });
              resolve();
              return;
            }

            resolve(typeof data?.text === "string" ? data.text : undefined);
          } catch (error) {
            console.error("Voice transcription error:", error);
            toast({
              title: "Transcription failed",
              description: "Voice transcription couldn't complete. Please try again.",
              variant: "destructive",
            });
            resolve();
          } finally {
            setIsTranscribing(false);
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);

        maxRecordTimerRef.current = window.setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 60_000);
      });
    } catch {
      acquiredStream?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      toast({
        title: "Microphone access denied",
        description: "Allow microphone access to use voice input.",
        variant: "destructive",
      });
    }
  }, [isLoading, isRecording, isTranscribing, toast]);

  const handleSend = useCallback((text: string, options: AiPromptOptions) => {
    const trimmedInput = text.trim();
    if (!trimmedInput || trimmedInput.length > AI_PROMPT_MAX_CHARS || isLoading || rateLimited) return;
    const history: Message[] = [...messages, { role: "user", content: trimmedInput }];
    if (!activeChatId) setActiveChatId(crypto.randomUUID());
    setSelectedModel(options.model);
    setSelectedEffort(options.effort);
    setWebSearch(options.webSearch);
    sendToApi(history, options.model, options.effort, options.webSearch);
  }, [isLoading, rateLimited, messages, activeChatId, sendToApi]);

  const stopGenerating = () => {
    abortControllerRef.current?.abort();
  };

  const retryLast = useCallback(() => {
    const trimmed =
      messages[messages.length - 1]?.role === "assistant" ? messages.slice(0, -1) : messages;
    sendToApi(trimmed);
  }, [messages, sendToApi]);

  const regenerate = useCallback(
    (index: number) => {
      sendToApi(messages.slice(0, index));
    },
    [messages, sendToApi]
  );

  const startEdit = (index: number, content: string) => {
    setEditingIndex(index);
    setEditValue(content);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const submitEdit = (index: number) => {
    if (!editValue.trim()) return;
    const history: Message[] = [...messages.slice(0, index), { role: "user", content: editValue }];
    setEditingIndex(null);
    setEditValue("");
    sendToApi(history);
  };

  const copyMessage = async (index: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((c) => (c === index ? null : c)), 1500);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Clipboard access was blocked.",
        variant: "destructive",
      });
    }
  };

  const startNewChat = () => {
    if (isLoading) return;
    setActiveChatId(null);
    setMessages([]);
    setLastFailed(false);
    setHistorySearch("");
    setHistorySearchOpen(false);
  };

  const openSavedChat = (chat: AiChat) => {
    if (isLoading) return;
    openedChatSnapshotRef.current = { chatId: chat.id, messages: chat.messages };
    setActiveChatId(chat.id);
    setMessages(chat.messages);
    setLastFailed(false);
    setHistorySearchOpen(false);
  };

  const removeSavedChat = (chatId: string) => {
    const updatedHistory = chatHistory.filter((chat) => chat.id !== chatId);
    setChatHistory(updatedHistory);
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMessages([]);
      setLastFailed(false);
    }
    if (user && historyUserId === user.id) {
      try {
        saveAiChatHistory(user.id, updatedHistory);
      } catch (error) {
        console.error("Failed to delete local AI chat:", error);
        toast({
          title: "Couldn't delete chat",
          description: "Your local AI chat history could not be updated.",
          variant: "destructive",
        });
      }
    }
  };

  const togglePinnedChat = (chatId: string) => {
    const updatedHistory = sortAiChatHistory(
      chatHistory.map((chat) =>
        chat.id === chatId ? { ...chat, pinned: !chat.pinned } : chat
      )
    );
    setChatHistory(updatedHistory);
    if (user && historyUserId === user.id) {
      try {
        saveAiChatHistory(user.id, updatedHistory);
      } catch (error) {
        console.error("Failed to update AI chat pin:", error);
        toast({
          title: "Couldn't update chat",
          description: "The chat pin setting could not be saved.",
          variant: "destructive",
        });
      }
    }
  };

  const clearSavedChats = () => {
    if (!user || historyUserId !== user.id) return;
    try {
      deleteAiChatHistory(user.id);
      setChatHistory([]);
      setActiveChatId(null);
      setMessages([]);
      setLastFailed(false);
    } catch (error) {
      console.error("Failed to clear local AI chat history:", error);
      toast({
        title: "Couldn't clear chat history",
        description: "Your local AI chat history could not be deleted.",
        variant: "destructive",
      });
    }
  };

  const filteredChats = chatHistory.filter((chat) => {
    const query = historySearch.trim().toLowerCase();
    return (
      !query ||
      chat.title.toLowerCase().includes(query) ||
      chat.messages.some((message) => message.content.toLowerCase().includes(query))
    );
  });

  const profileName = profile.username || user?.email?.split("@")[0] || "Your account";
  const hourlyLimitReached = usedTokens >= TOKEN_LIMIT || usedMessages >= limitMessages;
  const dailyLimitReached =
    dailyUsedTokens >= DAILY_TOKEN_LIMIT || dailyUsedMessages >= DAILY_REQUEST_LIMIT;
  const isUserWaitingForResponse = isLoading && messages[messages.length - 1]?.role === "user";
  if (!authReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold glow-text">You must be signed in</h1>
        <p className="max-w-sm text-muted-foreground">Sign in to chat with Kepler AI.</p>
        <Button asChild>
          <Link to="/auth">Go to Sign In</Link>
        </Button>
      </div>
    );
  }

  const composerBlock = (
    <div className="w-full">
      <AiPromptBar
        busy={isLoading}
        disabled={rateLimited || isTranscribing}
        placeholder={rateLimited ? `Limit reached · resets in ${countdown}` : "Message Kepler AI..."}
        initialModel={selectedModel}
        initialEffort={selectedEffort}
        initialWebSearch={webSearch}
        onSend={handleSend}
        onStop={stopGenerating}
        onDictate={toggleRecording}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-transparent">
      <style>{`
        @keyframes msg-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .msg-in { animation: msg-in 0.25s ease-out; }

        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        .dot { animation: dot-bounce 1.2s infinite ease-in-out; }
        .dot:nth-child(2) { animation-delay: 0.15s; }
        .dot:nth-child(3) { animation-delay: 0.3s; }

        .msg-text { text-shadow: 0 1px 3px rgba(0,0,0,0.35); }

        @media (prefers-reduced-motion: reduce) {
          .msg-in, .dot { animation: none; }
        }
      `}</style>

      <div className="relative z-10 flex h-full min-h-0 w-full px-3 pb-3 pt-24 sm:px-5 sm:pb-5">
        <div className="relative flex h-full min-h-0 w-full overflow-hidden rounded-xl border border-border bg-card/90 shadow-sm backdrop-blur-md">
          <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 288, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={reduceMotion
                ? { duration: 0 }
                : { width: { duration: 0.24, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.18 } }}
              className="absolute inset-y-0 left-0 z-30 max-w-[86vw] shrink-0 overflow-hidden border-r border-border/50 bg-transparent backdrop-blur-xl md:relative md:z-auto md:max-w-none"
            >
            <div className="flex h-full w-[min(18rem,86vw)] flex-col md:w-72">
              <div className="flex items-center justify-between gap-2 px-3 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-base font-semibold text-white">Kepler AI</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (historySearchOpen) setHistorySearch("");
                      setHistorySearchOpen((open) => !open);
                    }}
                    aria-label={historySearchOpen ? "Close chat search" : "Search chats"}
                    aria-expanded={historySearchOpen}
                    className={`cursor-pointer rounded-lg p-1.5 transition hover:text-foreground ${historySearchOpen ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={startNewChat}
                    disabled={isLoading}
                    aria-label="New chat"
                    title="New chat"
                    className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Collapse sidebar"
                    className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition hover:text-foreground"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {historySearchOpen && (
                <div className="px-3 pb-3">
                  <Input
                    autoFocus
                    type="search"
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                    placeholder="Search chats"
                    aria-label="Search chats"
                    className="h-9 rounded-xl"
                  />
                </div>
              )}

              <section className="flex min-h-0 flex-1 flex-col px-3 py-3">
                <span className="mb-2 px-1 text-xs font-medium text-muted-foreground">Recent</span>
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                  {filteredChats.length === 0 ? (
                    <p className="px-2 py-10 text-center text-sm text-muted-foreground">
                      {chatHistory.length === 0 ? "No saved chats on this device." : "No chats match your search."}
                    </p>
                  ) : (
                    filteredChats.map((chat) => (
                      <div
                        key={chat.id}
                        className={`group flex items-center gap-2 rounded-xl transition ${activeChatId === chat.id ? "bg-primary/10" : "hover:bg-accent/60"}`}
                      >
                        <button
                          type="button"
                          onClick={() => openSavedChat(chat)}
                          disabled={isLoading}
                          className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:opacity-50"
                        >
                          <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-foreground">
                            {chat.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />}
                            <span className="truncate">{chat.title}</span>
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {chat.messages[chat.messages.length - 1]?.content || "No messages"} · {new Date(chat.updatedAt).toLocaleDateString()}
                          </span>
                        </button>
                        <Dropdown>
                          <DropdownTrigger asChild>
                            <button
                              type="button"
                              disabled={isLoading}
                              aria-label={`Options for ${chat.title}`}
                              title="Chat options"
                              className="mr-2 rounded-lg p-1.5 text-muted-foreground opacity-100 transition hover:bg-accent hover:text-foreground focus:opacity-100 disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownTrigger>
                          <DropdownContent
                            align="end"
                            side="bottom"
                            sideOffset={4}
                            className="min-w-[150px] rounded-xl border border-border/60 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
                          >
                            <DropdownItem
                              onSelect={() => togglePinnedChat(chat.id)}
                              disabled={isLoading}
                              className="rounded-lg"
                            >
                              <Pin className="mr-2 h-4 w-4" />
                              {chat.pinned ? "Unpin chat" : "Pin chat"}
                            </DropdownItem>
                            <DropdownItem
                              onSelect={() => removeSavedChat(chat.id)}
                              disabled={isLoading}
                              className="rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete chat
                            </DropdownItem>
                          </DropdownContent>
                        </Dropdown>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <div className="flex items-center gap-2 border-t border-border/50 p-3">
                <Avatar className="h-8 w-8 border border-border/50">
                  {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={profileName} />}
                  <AvatarFallback className="text-xs font-medium">
                    {profileName.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={profileName}>
                  {profileName}
                </span>
                <Dropdown>
                  <DropdownTrigger asChild>
                    <button
                      type="button"
                      aria-label="Settings"
                      title="Settings"
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:text-foreground"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </DropdownTrigger>
                  <DropdownContent
                    align="end"
                    side="top"
                    sideOffset={8}
                    className="min-w-[180px] rounded-xl border border-border/60 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
                  >
                    <DropdownSub>
                      <DropdownSubTrigger className="rounded-lg focus:bg-accent/80">
                        <Gauge className="mr-2 h-4 w-4" />
                        Limits
                      </DropdownSubTrigger>
                      <DropdownPortal>
                        <DropdownSubContent
                          sideOffset={6}
                          className="w-[min(20rem,80vw)] rounded-xl border border-border/60 bg-popover/95 p-2 shadow-xl backdrop-blur-xl"
                        >
                          <DropdownLabel className="px-2 text-xs text-muted-foreground">
                            Current usage
                          </DropdownLabel>
                          {quotaLoadError && (
                            <p role="alert" className="px-2 py-1 text-[11px] text-destructive">
                              AI usage couldn’t be loaded.{" "}
                              <button
                                type="button"
                                className="font-medium underline underline-offset-2"
                                onClick={() => void syncQuotaFromServer()}
                              >
                                Retry
                              </button>
                            </p>
                          )}
                          <div className="space-y-2 p-1">
                            <UsageLimitBar
                              label="Current usage"
                              tokensUsed={usedTokens}
                              tokenLimit={TOKEN_LIMIT}
                              requestsUsed={usedMessages}
                              requestLimit={limitMessages}
                              blocked={hourlyLimitReached}
                            />
                            <UsageLimitBar
                              label="Daily usage"
                              tokensUsed={dailyUsedTokens}
                              tokenLimit={DAILY_TOKEN_LIMIT}
                              requestsUsed={dailyUsedMessages}
                              requestLimit={DAILY_REQUEST_LIMIT}
                              blocked={dailyLimitReached}
                            />
                          </div>
                          <p
                            className={`whitespace-nowrap px-2 pb-2 text-center text-[11px] font-semibold ${
                              rateLimited ? "text-destructive" : "text-foreground"
                            }`}
                          >
                            <span>{rateLimited ? "Limit reset" : "Next reset"}: {countdown || "—"}</span>
                            <span className="px-1.5 text-muted-foreground" aria-hidden="true">·</span>
                            <span>Daily reset: {dailyCountdown || "—"}</span>
                          </p>
                        </DropdownSubContent>
                      </DropdownPortal>
                    </DropdownSub>
                    <DropdownSub>
                      <DropdownSubTrigger className="rounded-lg focus:bg-accent/80">
                        <History className="mr-2 h-4 w-4" />
                        History
                      </DropdownSubTrigger>
                      <DropdownPortal>
                        <DropdownSubContent
                          sideOffset={6}
                          className="min-w-[220px] rounded-xl border border-border/60 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
                        >
                          <DropdownLabel className="px-2 text-xs text-muted-foreground">
                            Conversations
                          </DropdownLabel>
                          <DropdownItem
                            onSelect={clearSavedChats}
                            disabled={isLoading || chatHistory.length === 0}
                            className="rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Clear history
                          </DropdownItem>
                        </DropdownSubContent>
                      </DropdownPortal>
                    </DropdownSub>
                  </DropdownContent>
                </Dropdown>
              </div>
            </div>
            </motion.aside>
          )}
          </AnimatePresence>

          <main className="relative flex min-w-0 flex-1 flex-col">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
                className="absolute left-3 top-3 z-20 cursor-pointer rounded-lg p-2 text-muted-foreground transition hover:text-foreground"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}

          {!hasMessages ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
              <div className="mb-6 flex min-h-12 items-center justify-center text-center">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={greetingIndex}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: reduceMotion ? 0 : 0.28 }}
                    className="max-w-2xl text-2xl font-semibold text-foreground sm:text-3xl"
                  >
                    {AI_GREETINGS[greetingIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="w-full max-w-3xl">{composerBlock}</div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className={`flex-1 overflow-y-auto px-4 sm:px-6 ${sidebarOpen ? "py-4 sm:py-5" : "pb-4 pt-14 sm:pb-5"}`}>
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
                  {messages.map((message, index) => (
                    <div key={index} className={`msg-in group flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      {message.role === "user" ? (
                        editingIndex === index ? (
                          <div className="w-full max-w-[85%]">
                            <textarea
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  submitEdit(index);
                                }
                                if (e.key === "Escape") cancelEdit();
                              }}
                              rows={2}
                              className="w-full resize-none rounded-2xl border border-primary/50 bg-card px-3 py-2 text-sm text-foreground focus:outline-none"
                            />
                            <div className="mt-1 flex justify-end gap-3">
                              <button onClick={cancelEdit} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                                <X className="h-3 w-3" /> Cancel
                              </button>
                              <button onClick={() => submitEdit(index)} className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80">
                                <Check className="h-3 w-3" /> Save & resend
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group flex max-w-[85%] flex-col items-end gap-1">
                            <div
                              className="rounded-2xl px-4 py-2.5 text-sm text-primary-foreground"
                              style={{ backgroundColor: `hsl(${settings.accentColor})` }}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                            <div className="flex items-center gap-3 px-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                              <button
                                type="button"
                                onClick={() => void copyMessage(index, message.content)}
                                aria-label="Copy prompt"
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                {copiedIndex === index ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copiedIndex === index ? "Copied" : "Copy prompt"}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEdit(index, message.content)}
                                aria-label="Edit prompt"
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="flex max-w-[85%] flex-col gap-1">
                          <div className="msg-text rounded-xl border border-border bg-card/90 px-4 py-3 text-sm leading-relaxed text-card-foreground shadow-sm">
                            {renderMarkdown(message.content, `m-${index}`)}
                          </div>
                          {message.content && (
                            <div className="flex items-center gap-3 px-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                              <button
                                type="button"
                                onClick={() => copyMessage(index, message.content)}
                                aria-label="Copy AI response"
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                {copiedIndex === index ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copiedIndex === index ? "Copied" : "Copy"}
                              </button>
                              <button
                                type="button"
                                onClick={() => regenerate(index)}
                                disabled={isLoading}
                                aria-label="Retry this response"
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                              >
                                <RotateCcw className="h-3 w-3" /> Retry
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {isUserWaitingForResponse && (
                    <div className="msg-in flex justify-start">
                      <div className="flex items-center gap-1 py-2">
                        <span className="dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                        <span className="dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                        <span className="dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      </div>
                    </div>
                  )}

                  {lastFailed && !isLoading && (
                    <div className="msg-in flex items-center gap-2 self-start rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Message failed to send.</span>
                      <button onClick={retryLast} className="ml-1 font-medium underline underline-offset-2 hover:text-destructive/80">
                        Retry
                      </button>
                    </div>
                  )}
                </div>

                {!isNearBottom && (
                  <button
                    type="button"
                    onClick={() =>
                      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
                    }
                    className="sticky bottom-2 left-1/2 z-20 mt-3 block -translate-x-1/2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs text-foreground shadow-sm transition hover:bg-muted"
                  >
                    ↓ New messages
                  </button>
                )}
              </div>

              <div className="px-4 py-4 sm:px-6">
                <motion.div
                  initial={{ opacity: 0, y: reduceMotion ? 0 : -24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 28 }}
                  className="mx-auto w-full max-w-3xl"
                >
                  {composerBlock}
                </motion.div>
              </div>
            </>
          )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Ai;