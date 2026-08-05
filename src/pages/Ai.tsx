import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DotmCircular10 } from "@/components/ui/dotm-circular-10";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserSettings } from "@/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const RATE_LIMIT = 30;
const THINKING_MESSAGES = [
  "Triangulating...",
  "Thinking...",
  "Polishing the response...",
  "Almost there...",
  "Sifting though the prompt...",
  "Pondering...",
  "Extrapolating...",
  "Connecting the dots...",
  "Putting the pieces together...",
];

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const Ai = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [resetsAt, setResetsAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");
  const [usedMessages, setUsedMessages] = useState(0);
  const [limitMessages, setLimitMessages] = useState(RATE_LIMIT);
  const [thinkingMessage, setThinkingMessage] = useState(
  () => THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setAuthReady(true);
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

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (!isLoading) return;

    const pickRandomMessage = () =>
      THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];

    setThinkingMessage(pickRandomMessage());
    const interval = window.setInterval(() => {
      setThinkingMessage(pickRandomMessage());
    }, 2200);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading || rateLimited) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: "Not signed in",
          description: "Please sign in to use the AI assistant.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
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

          setMessages((prev) => prev.slice(0, -1));
          return;
        }

        toast({
          title: "Rate limit exceeded",
          description: data.error || "Too many requests. Try again soon.",
          variant: "destructive",
        });
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: response.status === 402 ? "Payment required" : "Error",
          description: errorData.error || "Failed to get response",
          variant: "destructive",
        });
        setMessages((prev) => prev.slice(0, -1));
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
      console.error("Chat error:", error);
      toast({
        title: "Error",
        description: "Failed to get response from AI.",
        variant: "destructive",
      });
      setMessages((prev) => prev.filter((_, i) => i !== prev.length - 1));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, toast, navigate, rateLimited, usedMessages, limitMessages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const remainingMessages = Math.max(0, limitMessages - usedMessages);
  const isAssistantThinking = isLoading;
  const isUserWaitingForResponse = isLoading && messages[messages.length - 1]?.role === "user";
  const glassBlockStyle = {
    background: `linear-gradient(135deg, hsl(${settings.accentColor} / 0.18), transparent 55%), hsl(var(--card) / 0.9)`,
  } as const;

  const formatMessage = (text: string) =>
    text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    );

  if (!authReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      <style>{`
        @keyframes float-glow {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.5; }
          50% { transform: translate3d(16px, -10px, 0) scale(1.08); opacity: 0.75; }
          100% { transform: translate3d(-12px, 10px, 0) scale(0.96); opacity: 0.55; }
        }
        @keyframes drift-glow {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.3; }
          50% { transform: translate3d(-14px, 8px, 0) scale(1.1); opacity: 0.5; }
          100% { transform: translate3d(8px, -10px, 0) scale(0.94); opacity: 0.42; }
        }
      `}</style>

      <Navigation />

      <main className="container mx-auto flex min-h-0 flex-1 px-4 pb-6 pt-24">
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          <div className="relative h-[calc(100vh-11rem)] max-h-[760px] min-h-[560px] w-full shrink-0">
            <div className="absolute inset-0 rounded-[30px] border border-white/10 bg-background/10 backdrop-blur-[30px] shadow-[0_30px_120px_rgba(0,0,0,0.24)]" />
            <div
              className="absolute -top-8 right-7 h-40 w-40 rounded-full blur-3xl"
              style={{
                background: `radial-gradient(circle, hsl(${settings.accentColor} / 0.42), transparent 72%)`,
                animation: "float-glow 10s ease-in-out infinite alternate",
              }}
            />
            <div
              className="absolute bottom-0 left-0 h-48 w-48 rounded-full blur-3xl"
              style={{
                background: `radial-gradient(circle, hsl(${settings.accentColor} / 0.4), transparent 72%)`,
                animation: "drift-glow 13s ease-in-out infinite alternate",
              }}
            />

            <div
              className="relative z-10 flex h-full flex-col overflow-hidden rounded-[30px] border border-border/50 bg-card/10 backdrop-blur-[26px]"
              style={glassBlockStyle}
            >
              <div className="border-b border-border/40 bg-background/40 px-4 py-3 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-xl border border-primary/20 bg-primary/10 p-2 shadow-[0_0_30px_hsl(var(--primary)/0.14)]">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      {isAssistantThinking ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <DotmCircular10 size={18} dotSize={3} speed={1.2} bloom className="text-primary" />
                          <span className="truncate text-sm font-semibold text-foreground">{thinkingMessage}</span>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-foreground">Kepler AI</p>
                          <p className="text-xs text-muted-foreground">Your partner for everyday chats</p>
                        </>
                      )}
                    </div>
                  </div>

                  <span className={`shrink-0 text-right text-[11px] font-medium tracking-[0.24em] uppercase text-muted-foreground ${rateLimited ? "text-destructive" : ""}`}>
                    {rateLimited
                      ? `Limit reached — ${countdown}`
                      : `${remainingMessages} messages remaining / ${limitMessages}`}
                  </span>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 overflow-hidden">
                <div ref={scrollRef} className="h-full flex-1 overflow-y-auto px-4 py-5 pb-24">
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                      <div className="space-y-2">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                          <Sparkles className="h-7 w-7 text-primary" />
                        </div>
                        <p className="text-sm font-medium text-foreground">Ask me anything</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-2">
                      {messages.map((message, index) => (
                        <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm backdrop-blur-md ${message.role === "user"
                              ? "bg-primary/95 text-primary-foreground"
                              : "bg-secondary/70 text-secondary-foreground"}`}
                          >
                            <p className="whitespace-pre-wrap break-words">{formatMessage(message.content)}</p>
                          </div>
                        </div>
                      ))}

                      {isUserWaitingForResponse && (
                        <div className="flex justify-start">
                          <div className="max-w-[80%] rounded-2xl bg-secondary/70 px-4 py-3 text-secondary-foreground shadow-sm backdrop-blur-md">
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-40 rounded-full" />
                              <Skeleton className="h-4 w-56 rounded-full" />
                              <Skeleton className="h-4 w-28 rounded-full" />
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              </div>

              <div className="fixed bottom-4 left-1/2 z-50 w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 rounded-full border border-primary/20 bg-background/30 p-1 backdrop-blur-[22px] shadow-[0_10px_40px_rgba(0,0,0,0.22)]">
                <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-background/55 px-2 py-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={rateLimited ? "Message limit reached" : "Type your message..."}
                    disabled={isLoading || rateLimited}
                    className="flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim() || rateLimited}
                    className="h-10 w-10 rounded-full bg-gradient-to-r from-primary to-accent p-0 shadow-sm"
                    style={{
                      backgroundImage: `linear-gradient(135deg, hsl(${settings.accentColor}), hsl(${settings.accentColor} / 0.72))`,
                    }}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {rateLimited && (
                <div className="absolute left-4 right-4 top-16 z-20 flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive backdrop-blur-[24px]">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    Message limit reached. Resets in <span className="font-mono font-bold">{countdown}</span>.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Ai;
