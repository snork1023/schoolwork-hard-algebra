import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GifResult = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Require auth to reduce abuse
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired authentication token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    const giphyApiKey = Deno.env.get("GIPHY_API_KEY");
    if (!giphyApiKey) {
      throw new Error("GIPHY_API_KEY not configured");
    }

    // Use Giphy SDK endpoint
    const endpoint = query
      ? `https://api.giphy.com/v1/gifs/search`
      : `https://api.giphy.com/v1/gifs/trending`;

    const params = new URLSearchParams({
      api_key: giphyApiKey,
      limit: "20",
      rating: "g",
      ...(query && { q: query }),
    });

    const url = `${endpoint}?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Giphy API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const gifs: GifResult[] = (data.data || []).map((item: any) => ({
      id: item.id,
      title: item.title || "GIF",
      url: item.images?.original?.url || item.images?.downsized?.url || "",
      thumbnail: item.images?.fixed_width_small?.url || item.images?.preview_gif?.url || "",
    })).filter((g: GifResult) => g.url && g.thumbnail);

    return new Response(JSON.stringify({ gifs, source: "giphy" }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    console.error("gif-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
