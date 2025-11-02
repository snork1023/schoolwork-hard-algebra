import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const browserbaseApiKey = Deno.env.get('BROWSERBASE_API_KEY');
    
    if (!browserbaseApiKey) {
      console.error('BROWSERBASE_API_KEY not found');
      return new Response(
        JSON.stringify({ error: 'Browserbase API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching website:', url);

    // Create a Browserbase session
    const createSessionResponse = await fetch('https://api.browserbase.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BB-API-Key': browserbaseApiKey,
      },
      body: JSON.stringify({
        browserSettings: {
          viewport: {
            width: 1920,
            height: 1080
          }
        }
      }),
    });

    if (!createSessionResponse.ok) {
      const errorText = await createSessionResponse.text();
      console.error('Browserbase session creation error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create browser session' }),
        { status: createSessionResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionData = await createSessionResponse.json();
    console.log('Browserbase session created:', sessionData.id);

    const sessionId = sessionData.id;

    // Fetch Live View URLs (debugger links)
    const liveViewResp = await fetch(`https://api.browserbase.com/v1/sessions/${sessionId}/debug`, {
      method: 'GET',
      headers: {
        'X-BB-API-Key': browserbaseApiKey,
      },
    });

    if (!liveViewResp.ok) {
      console.error('Failed to get live view URLs:', await liveViewResp.text());
      // Fallback to connectUrl if available
      const fallbackUrl = sessionData.connectUrl || null;
      return new Response(
        JSON.stringify({
          liveURL: fallbackUrl,
          url,
          sessionId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const liveViewData = await liveViewResp.json();
    const liveURL = liveViewData.debuggerFullscreenUrl || liveViewData.debuggerUrl || sessionData.connectUrl || '';

    // Try to auto-navigate the session to the requested URL via CDP WebSocket (best-effort)
    try {
      const wsUrl = liveViewData.wsUrl as string | undefined;
      if (wsUrl && url) {
        console.log('Connecting to CDP WebSocket to navigate:', wsUrl);
        const ws = new WebSocket(wsUrl);
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('WS open timeout')), 3000);
          ws.onopen = () => {
            clearTimeout(timeout);
            resolve();
          };
          ws.onerror = (e) => {
            clearTimeout(timeout);
            reject(e);
          };
        });
        // Enable the Page domain then navigate
        ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
        ws.send(JSON.stringify({ id: 2, method: 'Page.navigate', params: { url } }));
        // Give the browser a moment, then close
        await new Promise((r) => setTimeout(r, 500));
        ws.close();
      }
    } catch (navErr) {
      console.warn('CDP navigation failed; continuing with live view URL:', navErr);
    }

    console.log('Returning live view URL for interactive browsing:', liveURL);
    return new Response(
      JSON.stringify({
        liveURL,
        url,
        sessionId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-website function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
