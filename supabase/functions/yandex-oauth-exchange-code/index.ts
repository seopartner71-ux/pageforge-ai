import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLIENT_ID = Deno.env.get('YANDEX_OAUTH_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('YANDEX_OAUTH_CLIENT_SECRET')!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'unauthorized' }, 401);

    const supaUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supaUser.auth.getUser();
    if (!u?.user) return json({ error: 'unauthorized' }, 401);

    const { code } = await req.json().catch(() => ({ code: '' }));
    const cleanCode = String(code || '').trim();
    if (!cleanCode) return json({ error: 'code_required' }, 400);

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: cleanCode,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: 'https://oauth.yandex.ru/verification_code',
    });

    const tokRes = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const tok = await tokRes.json();
    if (!tokRes.ok || !tok.access_token) {
      return json({ error: 'token_exchange_failed', details: tok }, 400);
    }

    let login: string | null = null;
    try {
      const info = await fetch('https://login.yandex.ru/info?format=json', {
        headers: { Authorization: `OAuth ${tok.access_token}` },
      }).then((r) => r.json());
      login = info?.login ?? null;
    } catch { /* ignore */ }

    const expiresAt = new Date(Date.now() + (Number(tok.expires_in) || 3600) * 1000).toISOString();
    const supaSrv = createClient(SUPABASE_URL, SERVICE_KEY);
    await supaSrv.from('yandex_tokens').upsert({
      user_id: u.user.id,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: expiresAt,
      yandex_login: login,
    });

    return json({ ok: true, yandex_login: login });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});