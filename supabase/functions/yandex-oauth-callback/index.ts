// Yandex OAuth callback: обменивает code на токены и сохраняет в БД для текущего пользователя.
// Вызывается через redirect: пользователь возвращается из oauth.yandex.ru сюда с ?code=...&state=<jwt>
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLIENT_ID = Deno.env.get('YANDEX_OAUTH_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('YANDEX_OAUTH_CLIENT_SECRET')!;

function html(body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Яндекс.Вебмастер</title>
<body style="font-family:Inter,system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<div style="max-width:480px;padding:32px;border:1px solid #262626;border-radius:12px;text-align:center">${body}</div>
<script>setTimeout(()=>{ if(window.opener){window.opener.postMessage({type:'yandex-oauth-done'}, '*'); window.close();} else { window.location.href='/projects'; } }, 800);</script>
</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // user JWT
    const errParam = url.searchParams.get('error');
    if (errParam) return html(`<h2>Ошибка Яндекса</h2><p>${errParam}</p>`, 400);
    if (!code || !state) return html('<h2>Нет кода авторизации</h2>', 400);

    const supaUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${state}` } },
    });
    const { data: u } = await supaUser.auth.getUser();
    if (!u?.user) return html('<h2>Сессия истекла</h2><p>Войдите в систему и попробуйте снова.</p>', 401);

    // Exchange code -> tokens
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    const tokRes = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const tok = await tokRes.json();
    if (!tokRes.ok || !tok.access_token) {
      return html(`<h2>Не удалось получить токен</h2><pre>${JSON.stringify(tok)}</pre>`, 400);
    }

    // Optional: ник пользователя
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

    return html(`<h2>Готово!</h2><p>Яндекс${login ? ` (${login})` : ''} подключён. Возвращаю в проект…</p>`);
  } catch (e) {
    return html(`<h2>Ошибка</h2><pre>${(e as Error).message}</pre>`, 500);
  }
});