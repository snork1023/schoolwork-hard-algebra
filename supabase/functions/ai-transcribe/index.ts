import { createClient } from "npm:@supabase/supabase-js@2";
import Groq from "npm:groq-sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HALLUCINATIONS = new Set(["thank you for watching", "thanks for watching", "you"]);

function errorResponse(status: number, code: string, error: string): Response {
  return Response.json({ code, error }, { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Use POST to send an audio recording.");
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(401, "auth_required", "Please sign in to use voice input.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("Required Supabase Edge Function environment variables are missing.");
      return errorResponse(503, "service_not_configured", "Voice input is temporarily unavailable.");
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return errorResponse(401, "invalid_session", "Your session has expired. Please sign in again.");
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return errorResponse(400, "invalid_audio", "We couldn't read the audio recording. Please record again.");
    }

    const audio = formData.get("audio");
    if (!(audio instanceof File) || audio.size < 2_000 || audio.size > 5_000_000) {
      return errorResponse(
        400,
        "invalid_audio",
        "Please record a 0.5–60 second clip between 2 KB and 5 MB, then try again."
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: allowed, error: quotaError } = await adminClient.rpc("ai_consume_voice_quota", {
      p_user_id: user.id,
    });
    if (quotaError) {
      console.error("Voice quota check failed:", quotaError);
      return errorResponse(503, "voice_quota_unavailable", "We couldn't check your voice limit. Please try again.");
    }
    if (allowed !== true) {
      return errorResponse(
        429,
        "voice_limit_reached",
        "You've used all 15 voice recordings for this hour. Please try again later."
      );
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      console.error("GROQ_API_KEY is not configured.");
      return errorResponse(503, "ai_service_not_configured", "Voice input is temporarily unavailable.");
    }

    let transcriptionText: string;
    try {
      const groq = new Groq({ apiKey: groqApiKey });
      const transcription = await groq.audio.transcriptions.create({
        file: audio,
        model: "whisper-large-v3-turbo",
        response_format: "json",
        temperature: 0.0,
      });
      transcriptionText = transcription.text || "";
    } catch (error) {
      console.error("Groq transcription request failed:", error);
      return errorResponse(
        503,
        "transcription_failed",
        "We couldn't transcribe that recording. Please try again in a moment."
      );
    }

    const text = transcriptionText.trim().slice(0, 2_000);
    const normalized = text.toLowerCase().replace(/[.!?]/g, "");

    return Response.json(
      { text: HALLUCINATIONS.has(normalized) ? "" : text },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Unexpected ai-transcribe error:", error);
    return errorResponse(
      500,
      "unexpected_error",
      "Something went wrong while processing the recording. Please try again."
    );
  }
});
