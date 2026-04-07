import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SEARCH_ENGINES: Record<string, string> = {
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
  brave: "https://search.brave.com/search?q=",
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
    const body = await req.json().catch(() => ({}));
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const engine = typeof body?.engine === "string" ? body.engine : "duckduckgo";
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    let targetUrl = url;
    if (!targetUrl) {
      if (!query) {
        return new Response(JSON.stringify({ error: "No search query or target URL provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const engineBase = SEARCH_ENGINES[engine] || SEARCH_ENGINES.duckduckgo;
      targetUrl = engineBase + encodeURIComponent(query);
    }

    // Instead of returning a proxy URL, fetch the content directly
    console.log('Fetching URL:', targetUrl);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const content = await response.text();
    const contentType = response.headers.get('content-type') || 'text/html';

    // Create a simple HTML wrapper that displays the content
    const htmlWrapper = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Proxied Content</title>
    <style>
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        .proxy-notice { 
            background: #f0f0f0; 
            padding: 10px; 
            margin-bottom: 20px; 
            border-radius: 4px;
            font-size: 14px;
            color: #666;
        }
        iframe { width: 100%; height: calc(100vh - 100px); border: none; }
    </style>
</head>
<body>
    <div class="proxy-notice">
        <strong>Proxied Content:</strong> ${targetUrl}
    </div>
    <div style="width: 100%; height: calc(100vh - 100px); overflow: auto;">
        ${content}
    </div>
</body>
</html>`;

    return new Response(htmlWrapper, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'X-Proxied-URL': targetUrl,
      },
    });
  } catch (error) {
    console.error("search-proxy error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
