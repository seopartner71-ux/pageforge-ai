import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const YANDEX_TOKEN_URL = 'https://oauth.yandex.ru/token';
const YANDEX_LOGIN_INFO = 'https://login.yandex.ru/info?format=json';

async function sign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function htmlPage(title: string, message: string, ok: boolean, account?: { id: string; login: string }) {
  const payload = JSON.stringify({
    type: 'yandex-direct-oauth',
    ok, message, account: account ?? null,
  });
  return `<!doctype html><html lang="ru"><head>
<meta charset="utf-8"><title>${title}</title>
<style>
  html,body{margin:0;height:100%;background:#0B0F19;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;}
  .wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;}
  .badge{width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;
         background:${ok ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'};
         color:${ok ? '#10B981' : '#EF4444'};font-size:28px;margin-bottom:16px;}
  h1{font-size:18px;margin:0 0 8px;}
  p{font-size:13px;color:#94A3B8;max-width:340px;line-height:1.5;}
  button{margin-top:18px;background:#3B82F6;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer;}
</style></head>
<body><div class="wrap">
  <div class="badge">${ok ? '✓' : '!'}</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <button onclick="window.close()">Закрыть окно</button>
</div>
<script>
  try { window.opener && window.opener.postMessage(${payload}, '*'); } catch(e){}
  setTimeout(function(){ try{window.close();}catch(e){} }, 1500);
</script>
</body></html>`;
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    return htmlResponse(htmlPage('Подключение отменено', errorParam, false), 400);
  }
  if (!code || !stateParam) {
    return htmlResponse(htmlPage('Ошибка', 'Отсутствует code или state.', false), 400);
  }

  // Verify state
  let userId = '', projectId = '';
  try {
    const padded = stateParam.replaceAll('-', '+').replaceAll('_', '/');
    const decoded = JSON.parse(atob(padded + '==='.slice((padded.length + 3) % 4)));
    const stateSecret = Deno.env.get('CRAWLER_SECRET')!;
    const raw = `${decoded.u}.${decoded.p}.${decoded.n}.${decoded.t}`;
    const expected = await sign(raw, stateSecret);
    if (expected !== decoded.s) throw new Error('bad signature');
    if (Date.now() - Number(decoded.t) > 15 * 60_000) throw new Error('state expired');
    userId = decoded.u;
    projectId = decoded.p;
  } catch (e) {
    return htmlResponse(htmlPage('Ошибка', `Невалидный state: ${(e as Error).message}`, false), 400);
  }

  const clientId = Deno.env.get('YANDEX_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('YANDEX_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return htmlResponse(htmlPage('Ошибка', 'OAuth не сконфигурирован.', false), 500);
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
      }),
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.access_token) {
      return htmlResponse(
        htmlPage('Ошибка', `Не удалось получить токен: ${JSON.stringify(token)}`, false),
        400,
      );
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

    return htmlResponse(htmlPage(
      'Аккаунт подключён',
      `Яндекс.Директ «${login}» подключён. Импорт за 90 дней запущен в фоне.`,
      true,
      { id: accountId!, login },
    ));
  } catch (e) {
    return htmlResponse(htmlPage('Ошибка', String((e as Error).message ?? e), false), 500);
  }
});