import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const YANDEX_LOGIN_INFO = 'https://login.yandex.ru/info?format=json';
const MANUAL_CLIENT_MARKER = 'manual-token';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims, error: clErr } = await userClient.auth.getClaims(
    authHeader.replace('Bearer ', ''),
  );
  if (clErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
  const userId = claims.claims.sub as string;

  const body = await req.json().catch(() => ({}));
  const accessToken = String(body.access_token ?? '').trim();
  const projectId = String(body.project_id ?? '').trim();
  const overrideLogin = String(body.login ?? '').trim();
  if (!accessToken || !projectId) {
    return json({ error: 'access_token and project_id are required' }, 400);
  }
  if (accessToken.length < 10 || accessToken.length > 4096) {
    return json({ error: 'invalid access_token length' }, 400);
  }

  try {
    // Validate token by fetching login info from Yandex
    const infoRes = await fetch(YANDEX_LOGIN_INFO, {
      headers: { Authorization: `OAuth ${accessToken}` },
    });
    if (!infoRes.ok) {
      const txt = await infoRes.text();
      return json({ error: 'invalid_token', details: txt.slice(0, 300) }, 400);
    }
    const info = await infoRes.json();
    const login = overrideLogin || String(info?.login ?? info?.default_email ?? 'unknown');
    const displayName = String(info?.real_name ?? info?.display_name ?? login);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Upsert account (manual-token marker so it co-exists with OAuth-app accounts)
    const { data: existing } = await admin
      .from('ads_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'yandex_direct')
      .eq('external_id', login)
      .eq('oauth_client_id', MANUAL_CLIENT_MARKER)
      .maybeSingle();

    let accountId = existing?.id as string | undefined;
    if (!accountId) {
      const { data: inserted, error: insErr } = await admin
        .from('ads_accounts')
        .insert({
          user_id: userId, project_id: projectId,
          provider: 'yandex_direct', external_id: login,
          name: displayName, status: 'connected', currency: 'RUB',
          oauth_client_id: MANUAL_CLIENT_MARKER,
        })
        .select('id').single();
      if (insErr) throw insErr;
      accountId = inserted.id;
    } else {
      await admin.from('ads_accounts')
        .update({ status: 'connected', name: displayName, project_id: projectId })
        .eq('id', accountId);
    }

    await admin.from('ads_oauth_tokens').upsert({
      user_id: userId, account_id: accountId, provider: 'yandex_direct',
      external_login: login, access_token: accessToken,
      refresh_token: null, token_type: 'Bearer',
      scope: 'direct:api', expires_at: null,
      oauth_client_id: MANUAL_CLIENT_MARKER, oauth_client_secret: null,
    }, { onConflict: 'user_id,provider,external_login,oauth_client_id' });

    const { data: job } = await admin.from('ads_import_jobs').insert({
      user_id: userId, project_id: projectId, account_id: accountId,
      provider: 'yandex_direct', status: 'pending', step: 'queued',
    }).select('id').single();

    if (job?.id) {
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