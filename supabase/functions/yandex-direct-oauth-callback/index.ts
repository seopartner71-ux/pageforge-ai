import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const YANDEX_TOKEN_URL = 'https://oauth.yandex.ru/token';
const YANDEX_LOGIN_INFO = 'https://login.yandex.ru/info?format=json';
const REDIRECT_URI = 'https://oauth.yandex.ru/verification_code';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // POST-only: frontend sends { code, project_id } after user pastes the
  // verification code from oauth.yandex.ru/verification_code.
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
    authHeader.replace('Bearer ', ''),
  );
  if (claimsErr || !claimsData?.claims?.sub) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const userId = claimsData.claims.sub as string;

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? '').trim();
  const projectId = String(body.project_id ?? '').trim();
  if (!code || !projectId) {
    return json({ error: 'code and project_id are required' }, 400);
  }

  const clientId = Deno.env.get('YANDEX_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('YANDEX_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return json({ error: 'OAuth not configured' }, 500);
  }

  try {
    // Exchange code → tokens
    const tokenRes = await fetch(YANDEX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.access_token) {
      return json({ error: 'token_exchange_failed', details: token }, 400);
    }

    // Get Yandex login
    const infoRes = await fetch(YANDEX_LOGIN_INFO, {
      headers: { Authorization: `OAuth ${token.access_token}` },
    });
    const info = await infoRes.json();
    const login = String(info?.login ?? info?.default_email ?? 'unknown');
    const displayName = String(info?.real_name ?? info?.display_name ?? login);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Upsert account
    const { data: existing } = await admin
      .from('ads_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'yandex_direct')
      .eq('external_id', login)
      .maybeSingle();

    let accountId = existing?.id as string | undefined;
    if (!accountId) {
      const { data: inserted, error: insErr } = await admin
        .from('ads_accounts')
        .insert({
          user_id: userId, project_id: projectId,
          provider: 'yandex_direct', external_id: login,
          name: displayName, status: 'connected', currency: 'RUB',
        })
        .select('id').single();
      if (insErr) throw insErr;
      accountId = inserted.id;
    } else {
      await admin.from('ads_accounts')
        .update({ status: 'connected', name: displayName })
        .eq('id', accountId);
    }

    // Upsert token
    const expiresAt = token.expires_in
      ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
      : null;
    await admin.from('ads_oauth_tokens').upsert({
      user_id: userId, account_id: accountId, provider: 'yandex_direct',
      external_login: login, access_token: token.access_token,
      refresh_token: token.refresh_token ?? null, token_type: token.token_type ?? 'Bearer',
      scope: token.scope ?? null, expires_at: expiresAt,
    }, { onConflict: 'user_id,provider,external_login' });

    // Create import job + fire-and-forget import
    const { data: job } = await admin.from('ads_import_jobs').insert({
      user_id: userId, project_id: projectId, account_id: accountId,
      provider: 'yandex_direct', status: 'pending', step: 'queued',
    }).select('id').single();

    if (job?.id) {
      // Fire-and-forget call to import function
      const importUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/yandex-direct-import`;
      fetch(importUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ job_id: job.id }),
      }).catch(() => {});
    }

    return json({
      ok: true,
      account: { id: accountId, login, name: displayName },
      job_id: job?.id ?? null,
    });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});