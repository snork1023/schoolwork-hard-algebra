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

    const browserlessApiKey = Deno.env.get('BROWSERLESS_API_KEY');
    
    if (!browserlessApiKey) {
      console.error('BROWSERLESS_API_KEY not found');
      return new Response(
        JSON.stringify({ error: 'Browserless API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching website:', url);

    // Use BrowserQL to get an interactive liveURL
    const browserlessResponse = await fetch(`https://production-sfo.browserless.io/chromium/bql?token=${browserlessApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation LiveURL($url: String!) {
            goto(url: $url, waitUntil: load) {
              status
            }
            liveURL {
              liveURL
            }
          }
        `,
        variables: {
          url: url
        }
      }),
    });

    if (!browserlessResponse.ok) {
      const errorText = await browserlessResponse.text();
      console.error('Browserless API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create interactive browser session' }),
        { status: browserlessResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await browserlessResponse.json();
    console.log('BrowserQL response:', JSON.stringify(result));

    if (!result.data?.liveURL?.liveURL) {
      console.error('No liveURL received. Full response:', JSON.stringify(result));
      return new Response(
        JSON.stringify({ error: 'Failed to get interactive browser URL', details: result }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully created interactive browser session with liveURL:', result.data.liveURL.liveURL);

    return new Response(
      JSON.stringify({ 
        liveURL: result.data.liveURL.liveURL, 
        url: url,
        status: result.data.goto.status 
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
