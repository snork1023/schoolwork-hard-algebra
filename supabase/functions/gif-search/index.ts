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

function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function pickGifFromPost(post: any): GifResult | null {
  const id = String(post?.data?.id ?? "");
  if (!id) return null;

  const title = String(post?.data?.title ?? "GIF");

  // Prefer Reddit preview's GIF variant (usually a direct .gif URL)
  const previewImg = post?.data?.preview?.images?.[0];
  const gifUrlRaw = previewImg?.variants?.gif?.source?.url;
  const thumbUrlRaw =
    previewImg?.resolutions?.[2]?.url ??
    previewImg?.resolutions?.[1]?.url ??
    previewImg?.resolutions?.[0]?.url ??
    previewImg?.source?.url ??
    post?.data?.thumbnail;

  const url = typeof gifUrlRaw === "string" ? decodeHtmlEntities(gifUrlRaw) : "";
  const thumbnail = typeof thumbUrlRaw === "string" ? decodeHtmlEntities(thumbUrlRaw) : url;

  if (!url || !thumbnail) return null;

  return {
    id,
    title,
    url,
    thumbnail,
  };
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      // Reddit can 429/deny without a UA
      "User-Agent": "LovableCloud-GIFPicker/1.0",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upstream error ${res.status}: ${text.slice(0, 200)}`);
  }

  return await res.json();
}

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

    const subreddits = ["gifs", "reactiongifs", "HighQualityGifs"];

    let posts: any[] = [];

    if (!query) {
      // Trending
      const url = `https://www.reddit.com/r/gifs/hot.json?limit=50`;
      const data = await fetchJson(url);
      posts = Array.isArray(data?.data?.children) ? data.data.children : [];
    } else {
      const searches = subreddits.map((sub) => {
        const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=25&sort=relevance&t=all`;
        return fetchJson(url).catch(() => null);
      });

      const results = await Promise.all(searches);
      posts = results
        .filter(Boolean)
        .flatMap((r: any) => (Array.isArray(r?.data?.children) ? r.data.children : []));
    }

    const gifs = posts
      .map(pickGifFromPost)
      .filter((x): x is GifResult => Boolean(x));

    // unique by id, keep first, limit 20
    const unique = Array.from(new Map(gifs.map((g) => [g.id, g])).values()).slice(0, 20);

    return new Response(JSON.stringify({ gifs: unique, source: "reddit" }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // light caching to keep UI snappy
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
