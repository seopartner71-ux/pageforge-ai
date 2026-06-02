import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const API_BASE = 'https://api.direct.yandex.com/json/v5';
const REPORTS_URL = `${API_BASE}/reports`;
const CAMPAIGNS_URL = `${API_BASE}/campaigns`;
const YANDEX_TOKEN_URL = 'https://oauth.yandex.ru/token';

async function refreshAccessToken(admin: ReturnType<typeof createClient>, tokenRow: any) {
  if (!tokenRow.refresh_token || !tokenRow.oauth_client_id || !tokenRow.oauth_client_secret) return tokenRow.access_token as string;
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
  if (expiresAt && expiresAt - Date.now() > 60_000) return tokenRow.access_token as string;

  const res = await fetch(YANDEX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRow.refresh_token,
      client_id: tokenRow.oauth_client_id,
      client_secret: tokenRow.oauth_client_secret,
    }),
  });
  const refreshed = await res.json();
  if (!res.ok || !refreshed.access_token) return tokenRow.access_token as string;

  const nextExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
    : tokenRow.expires_at;
  await admin.from('ads_oauth_tokens').update({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? tokenRow.refresh_token,
    token_type: refreshed.token_type ?? tokenRow.token_type ?? 'Bearer',
    scope: refreshed.scope ?? tokenRow.scope ?? null,
    expires_at: nextExpiresAt,
  }).eq('id', tokenRow.id);
  return refreshed.access_token as string;
}

async function callJson(path: string, token: string, login: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Login': login,
      'Accept-Language': 'ru',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

async function callReport(token: string, login: string, body: unknown): Promise<string> {
  // Yandex Reports API requires polling for asynchronous reports; for small <90d ranges
  // we use processingMode=auto which is synchronous within ~minute.
  for (let i = 0; i < 10; i++) {
    const res = await fetch(REPORTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Login': login,
        'Accept-Language': 'ru',
        'Content-Type': 'application/json; charset=utf-8',
        processingMode: 'auto',
        returnMoneyInMicros: 'false',
        skipReportHeader: 'true',
        skipReportSummary: 'true',
      },
      body: JSON.stringify(body),
    });
    if (res.status === 200) return await res.text();
    if (res.status === 201 || res.status === 202) {
      const retry = Number(res.headers.get('retryIn') ?? 5);
      await new Promise((r) => setTimeout(r, Math.min(retry, 10) * 1000));
      continue;
    }
    const txt = await res.text();
    throw new Error(`Reports ${res.status}: ${txt.slice(0, 400)}`);
  }
  throw new Error('Report timed out');
}

function parseTsv(text: string): string[][] {
  return text.split('\n').filter(Boolean).map((line) => line.split('\t'));
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Accept either service-role calls (from oauth-callback) or authenticated users
  // triggering a manual resync from the UI.
  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const isService = serviceKey && auth.includes(serviceKey);
  let callerUserId: string | null = null;
  if (!isService) {
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims, error: clErr } = await userClient.auth.getClaims(
      auth.replace('Bearer ', ''),
    );
    if (clErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    callerUserId = claims.claims.sub as string;
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let jobId = '';
  try {
    const body = await req.json();
    jobId = String(body.job_id ?? '');
    if (!jobId) throw new Error('job_id required');

    const { data: job, error: jobErr } = await admin
      .from('ads_import_jobs').select('*').eq('id', jobId).single();
    if (jobErr || !job) throw new Error('job not found');
    if (callerUserId && job.user_id !== callerUserId) {
      throw new Error('forbidden');
    }

    const { data: tokenRow } = await admin
      .from('ads_oauth_tokens')
      .select('access_token, external_login')
      .eq('account_id', job.account_id)
      .maybeSingle();
    if (!tokenRow?.access_token) throw new Error('token not found');
    const token = tokenRow.access_token as string;
    const login = tokenRow.external_login as string;

    await admin.from('ads_import_jobs').update({
      status: 'running', step: 'campaigns', progress: 5,
      started_at: new Date().toISOString(),
    }).eq('id', jobId);

    // 1. Campaigns
    const camps = await callJson(CAMPAIGNS_URL, token, login, {
      method: 'get',
      params: {
        SelectionCriteria: {},
        FieldNames: ['Id', 'Name', 'Status', 'State', 'Type'],
      },
    });
    const campaigns: Array<{ Id: number; Name: string; Status: string; State: string }>
      = camps?.result?.Campaigns ?? [];

    const campaignIdMap = new Map<string, string>(); // externalId -> uuid
    for (const c of campaigns) {
      const ext = String(c.Id);
      const statusLower = (c.Status || c.State || '').toLowerCase();
      const mapped =
        statusLower.includes('suspend') || statusLower.includes('off') || statusLower.includes('archive') ? 'paused' :
        statusLower.includes('draft') ? 'paused' : 'working';
      const { data: up } = await admin.from('ads_campaigns').upsert({
        user_id: job.user_id, account_id: job.account_id,
        external_id: ext, name: c.Name ?? `Кампания ${ext}`, status: mapped,
      }, { onConflict: 'account_id,external_id' }).select('id').single();
      if (up?.id) campaignIdMap.set(ext, up.id);
    }

    await admin.from('ads_import_jobs').update({
      step: 'daily_metrics', progress: 30, imported_campaigns: campaigns.length,
    }).eq('id', jobId);

    const dateTo = new Date();
    const dateFrom = new Date(); dateFrom.setDate(dateTo.getDate() - 89);
    const dateFromS = ymd(dateFrom);
    const dateToS = ymd(dateTo);

    // 2. Daily metrics report
    const perfTsv = await callReport(token, login, {
      params: {
        SelectionCriteria: { DateFrom: dateFromS, DateTo: dateToS },
        FieldNames: ['Date', 'CampaignId', 'Impressions', 'Clicks', 'Cost', 'Conversions'],
        ReportName: `daily_${jobId}`,
        ReportType: 'CAMPAIGN_PERFORMANCE_REPORT',
        DateRangeType: 'CUSTOM_DATE',
        Format: 'TSV',
        IncludeVAT: 'YES',
      },
    });
    const perfRows = parseTsv(perfTsv);
    // First row is header
    const perfHeader = perfRows.shift() ?? [];
    const idx = (name: string) => perfHeader.indexOf(name);
    const iDate = idx('Date'), iCamp = idx('CampaignId'), iImp = idx('Impressions'),
      iClk = idx('Clicks'), iCost = idx('Cost'), iConv = idx('Conversions');

    const metricBatch: any[] = [];
    for (const r of perfRows) {
      const ext = r[iCamp];
      const campaignUuid = campaignIdMap.get(ext);
      if (!campaignUuid) continue;
      metricBatch.push({
        user_id: job.user_id, account_id: job.account_id, campaign_id: campaignUuid,
        date: r[iDate],
        impressions: Number(r[iImp] ?? 0) | 0,
        clicks: Number(r[iClk] ?? 0) | 0,
        spend: Number(r[iCost] ?? 0),
        conversions: Number(r[iConv] ?? 0) | 0,
        revenue: 0,
      });
    }
    // Chunk upserts
    for (let i = 0; i < metricBatch.length; i += 500) {
      const chunk = metricBatch.slice(i, i + 500);
      const { error } = await admin.from('ads_daily_metrics')
        .upsert(chunk, { onConflict: 'account_id,campaign_id,date' });
      if (error) throw error;
    }

    await admin.from('ads_import_jobs').update({
      step: 'search_queries', progress: 70, imported_metric_rows: metricBatch.length,
    }).eq('id', jobId);

    // 3. Search queries report (last 30 days only — full 90d is heavy)
    const sqFrom = new Date(); sqFrom.setDate(dateTo.getDate() - 29);
    let sqRowsCount = 0;
    try {
      const sqTsv = await callReport(token, login, {
        params: {
          SelectionCriteria: { DateFrom: ymd(sqFrom), DateTo: dateToS },
          FieldNames: ['Date', 'Query', 'Cost', 'Conversions'],
          ReportName: `queries_${jobId}`,
          ReportType: 'SEARCH_QUERY_PERFORMANCE_REPORT',
          DateRangeType: 'CUSTOM_DATE',
          Format: 'TSV',
          IncludeVAT: 'YES',
        },
      });
      const sqRows = parseTsv(sqTsv);
      const sqHeader = sqRows.shift() ?? [];
      const sqIdx = (n: string) => sqHeader.indexOf(n);
      const qDate = sqIdx('Date'), qQuery = sqIdx('Query'),
        qCost = sqIdx('Cost'), qConv = sqIdx('Conversions');
      const sqBatch: any[] = sqRows.map((r) => ({
        user_id: job.user_id, account_id: job.account_id,
        date: r[qDate],
        query: r[qQuery] ?? '',
        spend: Number(r[qCost] ?? 0),
        conversions: Number(r[qConv] ?? 0) | 0,
        is_negative: false,
      })).filter((x) => x.query);
      for (let i = 0; i < sqBatch.length; i += 500) {
        const chunk = sqBatch.slice(i, i + 500);
        const { error } = await admin.from('ads_search_queries')
          .upsert(chunk, { onConflict: 'account_id,query,date' });
        if (error) throw error;
      }
      sqRowsCount = sqBatch.length;
    } catch (e) {
      console.warn('Search queries import failed:', e);
    }

    await admin.from('ads_accounts')
      .update({ last_synced_at: new Date().toISOString(), status: 'connected' })
      .eq('id', job.account_id);

    await admin.from('ads_import_jobs').update({
      status: 'completed', step: 'done', progress: 100,
      imported_query_rows: sqRowsCount,
      finished_at: new Date().toISOString(),
    }).eq('id', jobId);

    return new Response(JSON.stringify({ ok: true, jobId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    console.error('Import failed:', msg);
    if (jobId) {
      await admin.from('ads_import_jobs').update({
        status: 'failed', error: msg.slice(0, 1000),
        finished_at: new Date().toISOString(),
      }).eq('id', jobId);
    }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});