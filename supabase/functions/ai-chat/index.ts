import { createClient } from "npm:@supabase/supabase-js@2";
import Groq from "npm:groq-sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DAILY_TOKEN_LIMIT = 90_000;
const DAILY_REQUEST_LIMIT = 75;
const MAX_PROMPT_CHARS = 2_000;

const EFFORT_SETTINGS = {
  low: {
    maxCompletionTokens: 1024,
    instruction: "Answer directly and concisely, using only the reasoning needed for accuracy.",
  },
  balanced: {
    maxCompletionTokens: 4096,
    instruction: "Use an appropriate amount of reasoning and keep the final answer focused.",
  },
  high: {
    maxCompletionTokens: 8192,
    instruction: "Be thorough when the task needs it, while avoiding unnecessary repetition.",
  },
} as const;

const ALLOWED_MODELS: Record<string, { isReasoning: boolean; supportsSearch: boolean }> = {
  "openai/gpt-oss-20b": { isReasoning: true, supportsSearch: true },
  "qwen/qwen3.8-27b": { isReasoning: false, supportsSearch: false },
  "openai/gpt-oss-120b": { isReasoning: true, supportsSearch: true },
};

const SYSTEM_PROMPT = {
  role: "system" as const,
  content: `You are kepler ai`,
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-4).map((message) => ({
    role: message.role,
    content: message.role === "user"
      ? message.content.trim().slice(-MAX_PROMPT_CHARS)
      : message.content.trim().slice(-2048),
  }));
}

function estimateReservationTokens(
  messages: ChatMessage[],
  maxCompletionTokens: number,
  useWebSearch: boolean,
  effortInstruction: string
): number {
  const prompt = [
    SYSTEM_PROMPT.content,
    `Response depth: ${effortInstruction}`,
    ...messages.map((message) =>
      message.role === "user"
        ? `<user_input>${message.content}</user_input>`
        : message.content
    ),
  ].join("\n");
  const promptBytes = new TextEncoder().encode(prompt).length;
  const formattingAllowance = (messages.length + 1) * 16 + 32;
  const searchAllowance = useWebSearch ? 4096 : 0;

  return Math.ceil(promptBytes / 2) + formattingAllowance + maxCompletionTokens + searchAllowance;
}

function isQuickGreeting(text: string): boolean {
  return /^(hi|hello|hey)[.!?]*$/i.test(text);
}

function errorResponse(
  status: number,
  code: string,
  error: string,
  extra: Record<string, unknown> = {}
): Response {
  return Response.json({ code, error, ...extra }, { status, headers: corsHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getProviderStatus(error: unknown): number | null {
  if (!isRecord(error)) return null;
  if (typeof error.status === "number") return error.status;
  if (isRecord(error.response) && typeof error.response.status === "number") {
    return error.response.status;
  }
  return null;
}

function providerRateLimitResponse(): Response {
  return errorResponse(
    429,
    "provider_rate_limited",
    "The AI service is receiving too many requests. Please slow down and try again shortly."
  );
}

Deno.serve(async (req) => {
  let adminClient: ReturnType<typeof createClient> | null = null;
  let reservationId: string | null = null;

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Use POST to send a chat message.");
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(401, "auth_required", "Please sign in to use the AI assistant.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("Required Supabase Edge Function environment variables are missing.");
      return errorResponse(503, "service_not_configured", "The AI service is temporarily unavailable.");
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return errorResponse(401, "invalid_session", "Your session has expired. Please sign in again.");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "invalid_json", "The request could not be read. Please try again.");
    }

    if (!isRecord(body) || !Array.isArray(body.messages) || body.messages.length === 0) {
      return errorResponse(400, "invalid_messages", "Send a chat message before submitting.");
    }
    if (!body.messages.every(isChatMessage)) {
      return errorResponse(400, "invalid_messages", "The chat history contains an invalid message.");
    }

    const messages = body.messages;
    const selectedModel = body.selectedModel ?? "openai/gpt-oss-20b";
    if (typeof selectedModel !== "string" || !ALLOWED_MODELS[selectedModel]) {
      return errorResponse(400, "invalid_model", "Choose one of the available AI models.");
    }
    const effort = body.effort ?? "balanced";
    if (effort !== "low" && effort !== "balanced" && effort !== "high") {
      return errorResponse(400, "invalid_effort", "Choose low, balanced, or high reasoning effort.");
    }
    if (body.webSearch !== undefined && typeof body.webSearch !== "boolean") {
      return errorResponse(400, "invalid_search_setting", "The search setting is invalid.");
    }

    const latestMessage = messages[messages.length - 1];
    const latestText = latestMessage.content.trim();
    if (
      latestMessage.role !== "user" ||
      latestText.length < 1 ||
      latestText.length > MAX_PROMPT_CHARS
    ) {
      return errorResponse(
        400,
        "invalid_prompt",
        `Your message must contain between 1 and ${MAX_PROMPT_CHARS.toLocaleString()} characters.`
      );
    }

    const modelSpec = ALLOWED_MODELS[selectedModel];
    const useWebSearch = body.webSearch === true && modelSpec.supportsSearch;
    const quickGreeting = isQuickGreeting(latestText);
    const effortSettings = EFFORT_SETTINGS[effort];
    const safeMessages = trimHistory(messages).map((message) => ({
      role: message.role,
      content: message.role === "user"
        ? `<user_input>${message.content}</user_input>`
        : message.content,
    }));

    let groq: Groq | null = null;
    if (!quickGreeting) {
      const groqApiKey = Deno.env.get("GROQ_API_KEY");
      if (!groqApiKey) {
        console.error("GROQ_API_KEY is not configured.");
        return errorResponse(503, "service_unavailable", "The AI service is temporarily unavailable.");
      }
      groq = new Groq({ apiKey: groqApiKey });
    }

    const quotaClient = createClient(supabaseUrl, supabaseServiceKey);
    adminClient = quotaClient;
    const reservedTokens = quickGreeting
      ? 1
      : estimateReservationTokens(
          safeMessages,
          effortSettings.maxCompletionTokens,
          useWebSearch,
          effortSettings.instruction
        );
    const { data: quotaReservation, error: reservationError } = await quotaClient.rpc(
      "ai_reserve_chat_quota",
      { p_user_id: user.id, p_reserved_tokens: reservedTokens }
    );
    if (reservationError) {
      console.error("AI quota reservation failed:", reservationError);
      return errorResponse(
        503,
        "usage_unavailable",
        "We couldn't check your AI usage. Please try again."
      );
    }
    if (!isRecord(quotaReservation) || typeof quotaReservation.allowed !== "boolean") {
      console.error("AI quota reservation returned an invalid response.");
      return errorResponse(
        503,
        "usage_unavailable",
        "AI usage is temporarily unavailable. Please try again later."
      );
    }
    if (!quotaReservation.allowed) {
      const dailyBlocked =
        Number(quotaReservation.dailyTokensUsed) >= DAILY_TOKEN_LIMIT ||
        Number(quotaReservation.dailyRequestsUsed) >= DAILY_REQUEST_LIMIT;
      return errorResponse(
        429,
        dailyBlocked ? "daily_limit_reached" : "two_hour_limit_reached",
        typeof quotaReservation.reason === "string"
          ? quotaReservation.reason
          : "You've reached the current AI usage limit. Please try again after it resets.",
        { quota: quotaReservation }
      );
    }
    if (typeof quotaReservation.reservationId !== "string") {
      console.error("AI quota reservation did not include a reservation ID.");
      return errorResponse(
        503,
        "usage_unavailable",
        "AI usage is temporarily unavailable. Please try again later."
      );
    }
    reservationId = quotaReservation.reservationId;

    if (quickGreeting) {
      const { data: greetingQuota, error: greetingSettleError } = await quotaClient.rpc(
        "ai_settle_chat_quota",
        {
          p_reservation_id: reservationId,
          p_actual_tokens: 0,
          p_succeeded: true,
        }
      );
      if (greetingSettleError || !isRecord(greetingQuota) || greetingQuota.settled !== true) {
        console.error("Quick greeting quota settlement failed:", greetingSettleError);
        return errorResponse(
          503,
          "usage_update_pending",
          "We couldn't finish updating your usage. Please try again."
        );
      }
      reservationId = null;
      return Response.json(
        { reply: "Hi! What can I help you with?", quota: greetingQuota },
        { headers: corsHeaders }
      );
    }

    if (!groq) {
      console.error("Groq client was not initialized for a non-greeting request.");
      return errorResponse(
        503,
        "service_unavailable",
        "The AI service is temporarily unavailable."
      );
    }

    let attackScore: number;
    try {
      const guardResponse = await groq.chat.completions.create({
        model: "meta-llama/llama-prompt-guard-2-86m",
        messages: [{ role: "user", content: latestText }],
      });
      const scoreText = guardResponse.choices[0]?.message?.content;
      attackScore = typeof scoreText === "string" && scoreText.trim() !== ""
        ? Number(scoreText)
        : NaN;
    } catch (error) {
      console.error("Prompt safety check failed:", error);
      if (getProviderStatus(error) === 429) return providerRateLimitResponse();
      return errorResponse(
        503,
        "safety_check_unavailable",
        "We couldn't complete the safety check. Please try again in a moment."
      );
    }

    if (!Number.isFinite(attackScore) || attackScore < 0 || attackScore > 1) {
      console.error("Prompt safety check returned an invalid score.");
      return errorResponse(
        503,
        "safety_check_unavailable",
        "We couldn't complete the safety check. Please try again in a moment."
      );
    }
    if (attackScore > 0.5) {
      return errorResponse(
        403,
        "prompt_blocked",
        "This message was blocked by the safety check. Please rephrase it and try again."
      );
    }

    const reasoningEffort = effort === "balanced" ? "medium" : effort;
    let chatResponse;
    try {
      chatResponse = await groq.chat.completions.create({
        model: selectedModel,
        messages: [
          {
            ...SYSTEM_PROMPT,
            content: `${SYSTEM_PROMPT.content}\n\nResponse depth: ${effortSettings.instruction}`,
          },
          ...safeMessages,
        ],
        max_completion_tokens: effortSettings.maxCompletionTokens,
        ...(modelSpec.isReasoning && { reasoning_effort: reasoningEffort }),
        ...(useWebSearch && { tools: [{ type: "browser_search" }] }),
      });
    } catch (error) {
      console.error("Groq chat request failed:", error);
      if (getProviderStatus(error) === 429) return providerRateLimitResponse();
      return errorResponse(
        503,
        "response_unavailable",
        "The AI couldn't respond right now. Please try again shortly."
      );
    }

    const reply = chatResponse.choices[0]?.message?.content?.trim() || "";
    if (!reply) {
      console.error("Groq returned an empty chat response.", {
        finishReason: chatResponse.choices[0]?.finish_reason,
      });
      return errorResponse(
        502,
        "empty_response",
        "The AI couldn't complete a response. Try a shorter prompt or lower reasoning effort."
      );
    }

    const cachedTokens = chatResponse.usage?.prompt_tokens_details?.cached_tokens || 0;
    const billableTokens = Math.max(
      0,
      (chatResponse.usage?.prompt_tokens || 0) -
        cachedTokens +
        (chatResponse.usage?.completion_tokens || 0)
    );

    const { data: updatedQuota, error: settleError } = await quotaClient.rpc(
      "ai_settle_chat_quota",
      {
        p_reservation_id: reservationId,
        p_actual_tokens: billableTokens,
        p_succeeded: true,
      }
    );
    if (settleError || !isRecord(updatedQuota) || updatedQuota.settled !== true) {
      console.error("AI quota settlement failed:", settleError);
      return errorResponse(
        503,
        "usage_update_pending",
        "Your response is ready, but we couldn't finish updating your usage. Please try again later."
      );
    }
    if (updatedQuota.reservationExceeded === true) {
      console.error("Actual token usage exceeded the reserved quota estimate.");
    }
    reservationId = null;

    return Response.json(
      {
        reply,
        quota: updatedQuota,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Unexpected ai-chat error:", error);
    return errorResponse(
      500,
      "unexpected_error",
      "Something went wrong while handling your message. Please try again."
    );
  } finally {
    if (adminClient && reservationId) {
      try {
        const { error } = await adminClient.rpc("ai_settle_chat_quota", {
          p_reservation_id: reservationId,
          p_actual_tokens: 0,
          p_succeeded: false,
        });
        if (error) console.error("Failed to release unused AI quota reservation:", error);
      } catch (error) {
        console.error("Failed to release unused AI quota reservation:", error);
      }
    }
  }
});
