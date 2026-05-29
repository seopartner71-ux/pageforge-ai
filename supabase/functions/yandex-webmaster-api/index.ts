// Прокси к Yandex Webmaster API v4 от имени текущего пользователя.
// Поддерживает авто-рефреш access_token через refresh_token.
// POST { action: 'hosts' | 'summary' | 'indexing' | 'queries', host_id?: string }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLIENT_ID = Deno.env.get('YANDEX_OAUTH_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('YANDEX_OAUTH_CLIENT_SECRET')!;
const API = 'https://api.webmaster.yandex.net/v4';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function refreshAccess(userId: string, refresh: string) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const res = await fetch('https://oauth.yandex.ru/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tok = await res.json();
  if (!res.ok || !tok.access_token) throw new Error('refresh_failed: ' + JSON.stringify(tok));
  const expiresAt = new Date(Date.now() + (Number(tok.expires_in) || 3600) * 1000).toISOString();
  const srv = createClient(SUPABASE_URL, SERVICE_KEY);
  await srv.from('yandex_tokens').update({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? refresh,
    expires_at: expiresAt,
  }).eq('user_id', userId);
  return tok.access_token as string;
}

async function yfetch(token: string, path: string) {
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `OAuth ${token}` },
  });
  const text = await r.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`yandex ${r.status}: ${text.slice(0, 400)}`);
  return data;
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

    const srv = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: tokRow } = await srv.from('yandex_tokens').select('*').eq('user_id', u.user.id).maybeSingle();
    if (!tokRow) return json({ error: 'not_connected' }, 400);

    let token = tokRow.access_token as string;
    if (new Date(tokRow.expires_at).getTime() < Date.now() + 60_000) {
      token = await refreshAccess(u.user.id, tokRow.refresh_token);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    // Получаем user_id Яндекса для запросов host-уровня
    const yu: any = await yfetch(token, '/user/');
    const yandexUserId = yu.user_id;

    if (action === 'hosts') {
      const data: any = await yfetch(token, `/user/${yandexUserId}/hosts/`);
      return json({ hosts: data.hosts ?? [], yandex_login: tokRow.yandex_login });
    }

    const hostId = String(body.host_id || '');
    if (!hostId) return json({ error: 'host_id required' }, 400);

    if (action === 'summary') {
      const data = await yfetch(token, `/user/${yandexUserId}/hosts/${encodeURIComponent(hostId)}/summary/`);
      return json({ summary: data });
    }
    if (action === 'indexing') {
      const data = await yfetch(token, `/user/${yandexUserId}/hosts/${encodeURIComponent(hostId)}/summary/`);
      const samples = await yfetch(token, `/user/${yandexUserId}/hosts/${encodeURIComponent(hostId)}/sitemaps/`).catch(() => ({}));
      return json({ summary: data, sitemaps: samples });
    }
    if (action === 'queries') {
      // ТОП-500 запросов за последние 7 дней
      const today = new Date();
      const to = today.toISOString().slice(0, 10);
      const from = new Date(today.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const data = await yfetch(
        token,
        `/user/${yandexUserId}/hosts/${encodeURIComponent(hostId)}/search-queries/popular/?order_by=TOTAL_SHOWS&query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS&query_indicator=AVG_SHOW_POSITION&query_indicator=AVG_CLICK_POSITION&date_from=${from}&date_to=${to}&limit=500`,
      );
      return json({ queries: data });
    }
    if (action === 'disconnect') {
      await srv.from('yandex_tokens').delete().eq('user_id', u.user.id);
      await srv.from('projects').update({ yandex_connected: false, yandex_host: null }).eq('user_id', u.user.id);
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('yandex-webmaster-api error', e);
    return json({ error: (e as Error).message }, 500);
  }
});