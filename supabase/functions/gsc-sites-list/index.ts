import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
const GSC_KEY = Deno.env.get('GOOGLE_SEARCH_CONSOLE_API_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY || !GSC_KEY) {
      return new Response(JSON.stringify({ error: 'gsc_not_connected', hint: 'Подключите Google Search Console в коннекторах.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const r = await fetch('https://connector-gateway.lovable.dev/google_search_console/webmasters/v3/sites', {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GSC_KEY,
      },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return new Response(JSON.stringify({ error: `gsc_${r.status}`, details: j }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const sites = (j.siteEntry ?? []).map((s: any) => ({
      siteUrl: s.siteUrl,
      permissionLevel: s.permissionLevel,
    }));
    return new Response(JSON.stringify({ sites }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});