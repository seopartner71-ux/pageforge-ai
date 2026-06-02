import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = auth.replace(/^Bearer\s+/i, '');
    const clientId = Deno.env.get('YANDEX_OAUTH_CLIENT_ID');
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'YANDEX_OAUTH_CLIENT_ID not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callback = 'https://oauth.yandex.ru/verification_code';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callback,
      state: token,
      force_confirm: 'yes',
    });
    return new Response(
      JSON.stringify({ url: `https://oauth.yandex.ru/authorize?${params.toString()}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});