import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Rate limit config ──────────────────────────────────────────────────────
const RATE_LIMIT = 30;
const WINDOW_MINUTES = 60;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Authentication required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: "Invalid or expired token" }, 401);
    }

    // ── Rate limiting ────────────────────────────────────────────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    const { count, error: countError } = await adminClient
      .from("chat_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", windowStart);

    if (countError) {
      console.error("Rate limit count error:", countError);
    }

    const messageCount = count ?? 0;

    if (messageCount >= RATE_LIMIT) {
      const { data: oldest } = await adminClient
        .from("chat_rate_limits")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      const resetsAt = oldest
        ? new Date(new Date(oldest.created_at).getTime() + WINDOW_MINUTES * 60 * 1000).toISOString()
        : null;

      return json(
        {
          error: "rate_limited",
          message: `You've used all ${RATE_LIMIT} messages for this hour. Try again when the limit resets.`,
          resetsAt,
          used: messageCount,
          limit: RATE_LIMIT,
        },
        429
      );
    }

    // ── Parse request ────────────────────────────────────────────────────────
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages array is required" }, 400);
    }

    // ── Call OpenRouter ──────────────────────────────────────────────────────
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const openrouterResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat", // free + high quality
        messages: [
          { role: "system", content: "You are a helpful AI assistant." },
          ...messages,
        ],
        stream: true,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!openrouterResp.ok) {
      const errText = await openrouterResp.text();
      console.error("OpenRouter API error:", openrouterResp.status, errText);

      if (openrouterResp.status === 429) {
        return json({ error: "OpenRouter rate limit hit. Please wait a moment." }, 429);
      }

      return json({ error: "AI service error. Please try again." }, 500);
    }

    // ── Record usage AFTER successful call ───────────────────────────────────
    adminClient
      .from("chat_rate_limits")
      .insert({ user_id: user.id })
      .then(({ error }) => {
        if (error) console.error("Failed to record rate limit entry:", error);
      });

    // ── Stream OpenRouter SSE → client (already OpenAI format) ───────────────
    return new Response(openrouterResp.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });

  } catch (err) {
    console.error("chat function error:", err);
    return json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
