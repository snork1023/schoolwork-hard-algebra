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

    // If LiveURL is available, return it
    if (result.data?.liveURL?.liveURL) {
      const live = result.data.liveURL.liveURL;
      console.log('Successfully created interactive browser session with liveURL:', live);
      return new Response(
        JSON.stringify({ 
          liveURL: live, 
          url: url,
          status: result.data.goto?.status 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fallback: If plan doesn't support LiveURL or it's unavailable, return rendered HTML snapshot
    console.warn('LiveURL unavailable, attempting HTML fallback');
    if (result?.errors) {
      console.warn('BrowserQL errors:', JSON.stringify(result.errors));
    }

    const contentResponse = await fetch(`https://production-sfo.browserless.io/content?token=${browserlessApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, waitFor: 2000 }),
    });

    if (!contentResponse.ok) {
      const errorText = await contentResponse.text();
      console.error('Browserless content API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch website content' }),
        { status: contentResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const htmlContent = await contentResponse.text();
    console.log('HTML fallback successful');

    return new Response(
      JSON.stringify({ html: htmlContent, url }),
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
