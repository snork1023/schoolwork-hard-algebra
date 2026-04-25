import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const RATE_LIMIT = 30;

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Rate limit state
  const [usedMessages, setUsedMessages] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [resetsAt, setResetsAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auth guard
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session) { navigate("/auth"); return; }
      setUser(session.user);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) { navigate("/auth"); return; }
      setUser(session.user);
      setAuthReady(true);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, [navigate]);

  // Countdown ticker when rate limited
  useEffect(() => {
    if (!resetsAt) { setCountdown(""); return; }

    const tick = () => {
      const rem = resetsAt.getTime() - Date.now();
      if (rem <= 0) {
        setRateLimited(false);
        setResetsAt(null);
        setCountdown("");
        setUsedMessages(0);
        if (countdownRef.current) clearInterval(countdownRef.current);
      } else {
        setCountdown(formatCountdown(rem));
      }
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [resetsAt]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading || rateLimited) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Not signed in", description: "Please sign in to use the AI assistant.", variant: "destructive" });
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

      // ── Handle rate limit ────────────────────────────────────────────────
      if (response.status === 429) {
        const data = await response.json().catch(() => ({}));

        if (data.error === "rate_limited") {
          setRateLimited(true);
          if (data.resetsAt) setResetsAt(new Date(data.resetsAt));
          if (data.used != null) setUsedMessages(data.used);

          toast({
            title: "Message limit reached",
            description: data.message || `You've used all ${RATE_LIMIT} messages for this hour.`,
            variant: "destructive",
          });

          // Remove the user message we optimistically added since it wasn't sent
          setMessages(prev => prev.slice(0, -1));
          return;
        }

        toast({ title: "Rate limit exceeded", description: data.error || "Too many requests. Try again soon.", variant: "destructive" });
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: response.status === 402 ? "Payment required" : "Error",
          description: errorData.error || "Failed to get response",
          variant: "destructive",
        });
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      // ── Stream response ──────────────────────────────────────────────────
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      setUsedMessages(prev => Math.min(prev + 1, RATE_LIMIT));

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
              setMessages(prev =>
                prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m)
              );
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast({ title: "Error", description: "Failed to get response from AI.", variant: "destructive" });
      setMessages(prev => prev.filter((_, i) => i !== prev.length - 1));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, toast, navigate, rateLimited]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

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

  const remaining = Math.max(0, RATE_LIMIT - usedMessages);

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-6 flex flex-col">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">

          {/* Usage indicator */}
          <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground px-1">
            <span>Powered by Google Gemini</span>
            <span className={remaining <= 5 ? "text-destructive font-medium" : ""}>
              {rateLimited
                ? `Rate limited — resets in ${countdown}`
                : `${remaining} / ${RATE_LIMIT} messages remaining this hour`}
            </span>
          </div>

          <div className="flex-1 bg-card rounded-lg border border-border shadow-lg overflow-hidden flex flex-col hover-glow">
            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-muted-foreground">
                  <div className="space-y-2">
                    <p className="text-lg">Ask me anything!</p>
                    <p className="text-sm">Powered by Google Gemini</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg p-4 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                        <p className="whitespace-pre-wrap break-words">{formatMessage(message.content)}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-lg p-4 bg-secondary text-secondary-foreground">
                        <div className="flex gap-1">
                          {[0, 150, 300].map(delay => (
                            <div key={delay} className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Rate limited banner */}
            {rateLimited && (
              <div className="mx-4 mb-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Message limit reached. Resets in <span className="font-mono font-bold">{countdown}</span>.
                </span>
              </div>
            )}

            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={rateLimited ? "Rate limited — please wait..." : "Type your message..."}
                  disabled={isLoading || rateLimited}
                  className="flex-1 bg-background"
                />
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim() || rateLimited}
                  className="bg-gradient-to-r from-primary to-accent"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Chat;
