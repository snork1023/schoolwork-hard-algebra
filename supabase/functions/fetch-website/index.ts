import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Verify JWT authentication to protect the endpoint
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT token using Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Invalid or expired token:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const browserbaseApiKey = Deno.env.get('BROWSERBASE_API_KEY');
    const browserbaseProjectId = Deno.env.get('BROWSERBASE_PROJECT_ID');
    
    if (!browserbaseApiKey) {
      console.error('BROWSERBASE_API_KEY not found');
      return new Response(
        JSON.stringify({ error: 'Browserbase API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!browserbaseProjectId) {
      console.error('BROWSERBASE_PROJECT_ID not found');
      return new Response(
        JSON.stringify({ error: 'Browserbase project ID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching website:', url);

    // First, close any existing sessions to avoid hitting the concurrent limit
    try {
      const listSessionsResponse = await fetch('https://api.browserbase.com/v1/sessions', {
        method: 'GET',
        headers: {
          'X-BB-API-Key': browserbaseApiKey,
        },
      });

      if (listSessionsResponse.ok) {
        const sessions = await listSessionsResponse.json();
        console.log(`Found ${sessions.length} existing sessions`);
        
        // Close all running sessions
        for (const session of sessions) {
          if (session.status === 'RUNNING' || session.status === 'NEW') {
            console.log(`Closing session ${session.id}`);
            await fetch(`https://api.browserbase.com/v1/sessions/${session.id}/stop`, {
              method: 'POST',
              headers: {
                'X-BB-API-Key': browserbaseApiKey,
              },
            });
          }
        }
        
        // Wait a moment for sessions to fully close
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (cleanupErr) {
      console.warn('Failed to cleanup old sessions:', cleanupErr);
      // Continue anyway - the session creation might still work
    }

    // Create a Browserbase session
    const createSessionResponse = await fetch('https://api.browserbase.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BB-API-Key': browserbaseApiKey,
      },
      body: JSON.stringify({
        projectId: browserbaseProjectId,
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
      
      // If rate limited, provide helpful error message
      if (createSessionResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Browser session limit reached. Your Browserbase account allows 1 concurrent session. Please wait a moment and try again, or contact Browserbase support to increase your limit.' 
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
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
