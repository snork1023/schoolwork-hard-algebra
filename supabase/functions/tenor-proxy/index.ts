import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query, trending } = await req.json();
    const GIPHY_API_KEY = Deno.env.get("GIPHY_API_KEY");

    if (!GIPHY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Giphy API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = trending
      ? `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=30&rating=g`
      : `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query || "")}&limit=30&rating=g`;

    const response = await fetch(url);
    const responseData = await response.json();

    // Normalize to a simple format for the client
    const results = (responseData.data || []).map((gif: any) => ({
      id: gif.id,
      title: gif.title || "",
      preview_url: gif.images?.fixed_height_small?.url || gif.images?.fixed_height?.url,
      full_url: gif.images?.original?.url || gif.images?.fixed_height?.url,
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("giphy-proxy error:", e);
    return new Response(
      JSON.stringify({ error: "Failed to fetch GIFs" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
