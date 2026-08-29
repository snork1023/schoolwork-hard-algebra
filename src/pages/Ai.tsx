import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Send,
  Loader2,
  AlertCircle,
  Sparkles,
  Square,
  Copy,
  Check,
  Pencil,
  X,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserSettings } from "@/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const AI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai`;
const RATE_LIMIT = 30;
const SOFT_CHAR_LIMIT = 4000;

const SUGGESTION_POOL = [
  "Explain how black holes bend light",
  "Help me plan out a weekend project",
  "Give me a short creative writing prompt",
  "Summarize the plot of a classic sci-fi novel",
  "Help me debug a tricky piece of code",
  "Suggest a name for a new project",
  "Explain a concept like I'm five",
  "Help me write a birthday message",
];

function pickSuggestions(pool: string[], count: number) {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// --- lightweight markdown (no external deps) ---

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g);
  return parts.filter(Boolean).map((part, i) => {
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
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="underline decoration-primary/60 underline-offset-2 hover:decoration-primary">
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

  lines.forEach((line, idx) => {
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)/);
    if (bulletMatch) {
      listBuffer.push(bulletMatch[1]);
      return;
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
  });
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
    return renderInlineBlock(block, `${keyPrefix}-${i}`);
  });
}

const Ai = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [resetsAt, setResetsAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");
  const [usedMessages, setUsedMessages] = useState(0);
  const [limitMessages, setLimitMessages] = useState(RATE_LIMIT);
  const [lastFailed, setLastFailed] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [suggestions] = useState(() => pickSuggestions(SUGGESTION_POOL, 3));

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useUserSettings();

  const syncQuotaFromServer = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc("get_chat_quota", {
        p_user_id: user.id,
        p_limit: RATE_LIMIT,
        p_window_minutes: 60,
      });

      if (error) throw error;

      const quota = Array.isArray(data) ? data[0] : data;
      if (!quota) return;

      setUsedMessages(typeof quota.used_count === "number" ? quota.used_count : 0);
      setLimitMessages(typeof quota.limit_count === "number" ? quota.limit_count : RATE_LIMIT);
      setRateLimited(!quota.allowed);
      setResetsAt(quota.resets_at ? new Date(quota.resets_at) : null);
    } catch (error) {
      console.error("Failed to load chat quota:", error);
    }
  }, [user]);

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
        setAuthReady(true);
        setNeedsAuth(true);
        return;
      }
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
    syncQuotaFromServer();
  }, [authReady, user, syncQuotaFromServer]);

  useEffect(() => {
    if (!resetsAt) {
      setCountdown("");
      return;
    }

    const tick = () => {
      const rem = resetsAt.getTime() - Date.now();
      if (rem <= 0) {
        setRateLimited(false);
        setResetsAt(null);
        setCountdown("");
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
  }, [resetsAt]);

  // Track whether the user is near the bottom of the transcript, so
  // streamed tokens don't yank them back down if they scrolled up to reread.
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
  }, [messages.length > 0]);

  useEffect(() => {
    if (!isNearBottom) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isNearBottom]);

  // Auto-grow the composer as the user types, capped at 160px.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const sendToApi = useCallback(
    async (history: Message[]) => {
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

        const response = await fetch(AI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        if (response.status === 429) {
          const data = await response.json().catch(() => ({}));

          if (data.error === "rate_limited") {
            const serverUsed = typeof data.used === "number" ? data.used : usedMessages;
            const serverLimit = typeof data.limit === "number" ? data.limit : limitMessages;
            setUsedMessages(serverUsed);
            setLimitMessages(serverLimit);
            setRateLimited(true);
            if (data.resetsAt) setResetsAt(new Date(data.resetsAt));

            toast({
              title: "Message limit reached",
              description: data.message || `You've used all ${RATE_LIMIT} messages for this hour.`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Rate limit exceeded",
              description: data.error || "Too many requests. Try again soon.",
              variant: "destructive",
            });
            setLastFailed(true);
          }
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          toast({
            title: response.status === 402 ? "Payment required" : "Error",
            description: errorData.error || "Failed to get response",
            variant: "destructive",
          });
          setLastFailed(true);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";

        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;

          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
            buffer = buffer.slice(newlineIndex + 1);
            if (!line.startsWith("data: ") || line.startsWith(":")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const content = JSON.parse(jsonStr).choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages((prev) =>
                  prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m))
                );
              }
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        setUsedMessages((prev) => Math.min(prev + 1, limitMessages));
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
    [isLoading, rateLimited, toast, usedMessages, limitMessages]
  );

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading || rateLimited) return;
    const history: Message[] = [...messages, { role: "user", content: input }];
    setInput("");
    sendToApi(history);
  }, [input, isLoading, rateLimited, messages, sendToApi]);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) handleSend();
    }
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  const remainingMessages = Math.max(0, limitMessages - usedMessages);
  const isUserWaitingForResponse = isLoading && messages[messages.length - 1]?.role === "user";
  const hasMessages = messages.length > 0;

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
      {rateLimited && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            Message limit reached. Resets in <span className="font-mono font-semibold">{countdown}</span>.
          </span>
        </div>
      )}
      <div className="flex items-end gap-2 rounded-2xl border border-black/10 bg-white/60 p-2 pl-4 shadow-sm transition-all focus-within:border-primary/40 focus-within:shadow-md dark:border-white/10 dark:bg-black/40">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={rateLimited ? "Message limit reached" : "Message Kepler AI..."}
          disabled={isLoading || rateLimited}
          rows={1}
          className="max-h-[160px] flex-1 resize-none overflow-y-auto bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
        />
        <Button
          type="button"
          onClick={isLoading ? stopGenerating : handleSend}
          disabled={!isLoading && (!input.trim() || rateLimited)}
          size="icon"
          className={`h-9 w-9 shrink-0 rounded-full transition-all ${
            input.trim() || isLoading ? "scale-100 opacity-100" : "scale-95 opacity-60"
          }`}
          style={{ backgroundColor: `hsl(${settings.accentColor})` }}
        >
          {isLoading ? <Square className="h-3.5 w-3.5 fill-current" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <div className="mt-1 flex justify-end px-1">
        <span className={`text-[11px] ${input.length > SOFT_CHAR_LIMIT ? "text-amber-400" : "text-muted-foreground/60"}`}>
          {input.length > 0 ? `${input.length} characters` : ""}
        </span>
      </div>
    </div>
  );

  return (
    <div className="relative flex min-h-screen flex-col">
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

      <div className="relative z-10 flex min-h-screen flex-1 items-center justify-center px-4 py-24">
        <div className="flex h-[min(760px,calc(100vh-8rem))] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-black/5 bg-white/20 shadow-2xl shadow-black/20 backdrop-blur-[24px] dark:border-white/10 dark:bg-black/20">
          {!hasMessages ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10">
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground">Kepler AI</h1>
                <p className="mt-1 text-sm text-muted-foreground">Ask anything</p>
              </div>

              <div className="w-full max-w-lg">{composerBlock}</div>

              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="rounded-full border border-black/10 bg-white/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground dark:border-white/10 dark:bg-black/30"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-black/5 px-5 py-3 text-xs dark:border-white/10">
                <span className="font-medium text-muted-foreground">Kepler AI</span>
                <span className={rateLimited ? "font-medium text-destructive" : "text-muted-foreground"}>
                  {rateLimited ? `Resets in ${countdown}` : `${remainingMessages}/${limitMessages} messages`}
                </span>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
                <div className="flex flex-col gap-5">
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
                          <div className="flex max-w-[85%] flex-col items-end gap-1">
                            <div
                              className="rounded-2xl px-4 py-2.5 text-sm text-primary-foreground"
                              style={{ backgroundColor: `hsl(${settings.accentColor})` }}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                            <button
                              onClick={() => startEdit(index, message.content)}
                              className="flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                            >
                              <Pencil className="h-3 w-3" /> Edit
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="flex max-w-[85%] flex-col gap-1">
                          <div className="msg-text rounded-2xl border border-black/10 bg-slate-200/60 px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm dark:border-white/10 dark:bg-black/60">
                            {renderMarkdown(message.content, `m-${index}`)}
                          </div>
                          {message.content && (
                            <div className="flex items-center gap-3 px-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => copyMessage(index, message.content)}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                {copiedIndex === index ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copiedIndex === index ? "Copied" : "Copy"}
                              </button>
                              {index === messages.length - 1 && !isLoading && (
                                <button
                                  onClick={() => regenerate(index)}
                                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                >
                                  <RotateCcw className="h-3 w-3" /> Regenerate
                                </button>
                              )}
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
                    className="sticky bottom-2 left-1/2 z-20 mt-3 block -translate-x-1/2 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-xs text-foreground shadow-md transition hover:bg-white dark:border-white/10 dark:bg-black/70 dark:hover:bg-black/90"
                  >
                    ↓ New messages
                  </button>
                )}
              </div>

              <div className="border-t border-black/5 px-4 py-4 dark:border-white/10">
                {composerBlock}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Ai;