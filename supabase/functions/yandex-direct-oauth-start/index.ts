import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const YANDEX_OAUTH_AUTHORIZE = 'https://oauth.yandex.ru/authorize';

async function sign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const projectId = String(body.project_id ?? '').trim();
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'project_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get('YANDEX_OAUTH_CLIENT_ID');
    const stateSecret = Deno.env.get('CRAWLER_SECRET');
    if (!clientId || !stateSecret) {
      return new Response(JSON.stringify({ error: 'OAuth not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nonce = crypto.randomUUID();
    const ts = Date.now().toString();
    const raw = `${userId}.${projectId}.${nonce}.${ts}`;
    const sig = await sign(raw, stateSecret);
    const state = btoa(JSON.stringify({ u: userId, p: projectId, n: nonce, t: ts, s: sig }))
      .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

    // Out-of-band redirect URI: Yandex shows the verification code to the user
    // on its own page, the user pastes it back into our app.
    const redirectUri = 'https://oauth.yandex.ru/verification_code';
    const url = new URL(YANDEX_OAUTH_AUTHORIZE);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('force_confirm', 'yes');

    return new Response(JSON.stringify({ authorize_url: url.toString(), redirect_uri: redirectUri }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});