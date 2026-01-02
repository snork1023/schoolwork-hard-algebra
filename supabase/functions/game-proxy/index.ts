const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const gameUrl = url.searchParams.get('url');

    if (!gameUrl) {
      // Try to get from body for POST requests
      if (req.method === 'POST') {
        const body = await req.json();
        if (body.url) {
          return await proxyGame(body.url);
        }
      }
      return new Response(
        JSON.stringify({ error: 'URL parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return await proxyGame(gameUrl);
  } catch (error) {
    console.error('Error in game-proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function proxyGame(gameUrl: string): Promise<Response> {
  console.log('Proxying game URL:', gameUrl);

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(gameUrl);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid URL' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Fetch the game content
  const response = await fetch(gameUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch game:', response.status, response.statusText);
    return new Response(
      JSON.stringify({ error: `Failed to fetch game: ${response.status}` }),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const contentType = response.headers.get('content-type') || 'text/html';
  let content = await response.text();

  // If it's HTML, rewrite relative URLs to absolute
  if (contentType.includes('text/html')) {
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    const basePath = parsedUrl.pathname.substring(0, parsedUrl.pathname.lastIndexOf('/') + 1);

    // Inject a <base> tag to handle relative URLs
    content = content.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${baseUrl}${basePath}">`
    );

    // If no <head> tag, add it at the start
    if (!content.includes('<head')) {
      content = `<head><base href="${baseUrl}${basePath}"></head>${content}`;
    }
  }

  // Return the content with permissive headers (no X-Frame-Options, no CSP blocking)
  return new Response(content, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': contentType,
      // Remove any frame-blocking headers
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': '',
    },
  });
}
