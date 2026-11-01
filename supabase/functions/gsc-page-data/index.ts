// Выгрузка данных Search Console (страницы и запрос+страница) для аудита перелинковки.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_search_console';
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({ domain: z.string().min(3).max(255), siteUrl: z.string().max(500).optional(), days: z.number().int().min(7).max(480).optional() });

function covers(siteUrl: string, host: string) {
  if (siteUrl.startsWith('sc-domain:')) {
    const d = siteUrl.slice(10).toLowerCase();
    return host === d || host.endsWith(`.${d}`);
  }
  try {
    const h = new URL(siteUrl).hostname.toLowerCase();
    return h === host || h.replace(/^www\./, '') === host.replace(/^www\./, '');
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser(auth.replace('Bearer ', ''));
    if (!user) return json({ error: 'Нужно войти в аккаунт' }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Неверные параметры' }, 400);
    const { domain, siteUrl: chosen, days = 90 } = parsed.data;

    const LK = Deno.env.get('LOVABLE_API_KEY'), GK = Deno.env.get('GOOGLE_SEARCH_CONSOLE_API_KEY');
    if (!LK || !GK) return json({ error: 'Search Console не подключён' }, 400);
    const headers = { Authorization: `Bearer ${LK}`, 'X-Connection-Api-Key': GK, 'Content-Type': 'application/json' };

    const host = (() => { try { return new URL(domain.includes('://') ? domain : `https://${domain}`).hostname.toLowerCase(); } catch { return domain.toLowerCase(); } })();
    const sr = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers });
    if (!sr.ok) return json({ error: `Search Console: ошибка ${sr.status}`, details: await sr.text() }, 502);
    const entries: { siteUrl: string; permissionLevel?: string }[] = (await sr.json()).siteEntry ?? [];
    const matches = entries.filter((e) => e.permissionLevel !== 'siteUnverifiedUser' && covers(e.siteUrl, host)).map((e) => e.siteUrl);
    if (!matches.length) return json({ error: `Сайт ${host} не найден среди подтверждённых в вашем Search Console` }, 404);
    let site: string;
    if (chosen) {
      if (!matches.includes(chosen)) return json({ error: 'Выбранный ресурс недоступен' }, 400);
      site = chosen;
    } else if (matches.length === 1) site = matches[0];
    else return json({ status: 'selection_required', candidates: matches });

    const end = new Date(Date.now() - 3 * 86400e3);
    const start = new Date(end.getTime() - days * 86400e3);
    const d = (x: Date) => x.toISOString().slice(0, 10);

    const query = async (dimensions: string[], maxRows: number) => {
      const out: any[] = [];
      for (let startRow = 0; startRow < maxRows; startRow += 25000) {
        const r = await fetch(`${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
          method: 'POST', headers,
          body: JSON.stringify({ startDate: d(start), endDate: d(end), dimensions, rowLimit: 25000, startRow, dataState: 'final' }),
        });
        if (r.status === 403) throw new Error('Нет доступа к этому ресурсу Search Console');
        if (!r.ok) throw new Error(`Search Console: ошибка ${r.status}: ${await r.text()}`);
        const rows = (await r.json()).rows ?? [];
        out.push(...rows);
        if (rows.length < 25000) break;
      }
      return out;
    };

    const [pRows, qpRows] = await Promise.all([query(['page'], 25000), query(['query', 'page'], 100000)]);
    return json({
      status: 'ok', siteUrl: site, startDate: d(start), endDate: d(end),
      pages: pRows.map((r) => ({ page: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position })),
      queryPages: qpRows.map((r) => ({ query: r.keys[0], page: r.keys[1], clicks: r.clicks, impressions: r.impressions, position: r.position })),
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
