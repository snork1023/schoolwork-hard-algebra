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
    const createSessionResponse = await fetch('https://www.browserbase.com/v1/sessions', {
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

    // Use Puppeteer-like approach to navigate and get live URL
    const sessionId = sessionData.id;
    const liveURL = `https://connect.browserbase.com?apiKey=${browserbaseApiKey}&sessionId=${sessionId}`;

    // Navigate to the URL using Browserbase's debug endpoint
    try {
      const navigateResponse = await fetch(`https://www.browserbase.com/v1/sessions/${sessionId}/debug`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BB-API-Key': browserbaseApiKey,
        },
        body: JSON.stringify({
          method: 'Page.navigate',
          params: { url }
        }),
      });

      if (navigateResponse.ok) {
        console.log('Successfully created interactive browser session with liveURL:', liveURL);
        return new Response(
          JSON.stringify({ 
            liveURL: liveURL, 
            url: url,
            sessionId: sessionId
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } catch (navError) {
      console.warn('Navigation error, but returning liveURL anyway:', navError);
    }

    // Return the liveURL regardless
    console.log('Returning liveURL for interactive browsing');
    return new Response(
      JSON.stringify({ 
        liveURL: liveURL, 
        url: url,
        sessionId: sessionId
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
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
