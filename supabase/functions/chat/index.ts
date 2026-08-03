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

    // ── Parse request ────────────────────────────────────────────────────────
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages array is required" }, 400);
    }

    // ── Rate limiting (server-enforced, atomic) ─────────────────────────────
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: limitData, error: limitError } = await adminClient.rpc(
      "consume_chat_request",
      {
        p_user_id: user.id,
        p_limit: RATE_LIMIT,
        p_window_minutes: WINDOW_MINUTES,
      }
    );

    if (limitError) {
      console.error("Rate limit RPC error:", limitError);
      return json({ error: "Unable to validate message quota." }, 500);
    }

    const quota = Array.isArray(limitData) ? limitData[0] : limitData;
    if (!quota?.allowed) {
      return json(
        {
          error: "rate_limited",
          message: `You've used all ${RATE_LIMIT} messages for this hour. Try again when the limit resets.`,
          resetsAt: quota?.resets_at ?? null,
          used: quota?.used_count ?? RATE_LIMIT,
          limit: quota?.limit_count ?? RATE_LIMIT,
        },
        429
      );
    }

    // ── Call Groq Cloud ──────────────────────────────────────────────────────
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are a helpful AI assistant." },
          ...messages,
        ],
        stream: true,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!groqResp.ok) {
      const errText = await groqResp.text();
      console.error("Groq API error:", groqResp.status, errText);

      if (groqResp.status === 429) {
        return json({ error: "Groq rate limit hit. Please wait a moment." }, 429);
      }

      return json({ error: "AI service error. Please try again." }, 500);
    }

    // ── Stream Groq SSE → client (already OpenAI format) ─────────────────────
    return new Response(groqResp.body, {
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
