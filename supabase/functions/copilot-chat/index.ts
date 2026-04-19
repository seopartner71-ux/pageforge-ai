import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Ты — Data Copilot для платформы SEO-Аудит (русскоязычный аналитический ассистент для Senior Technical SEO).
Платформа умеет: TF-IDF / закон Ципфа, SGE Predictor (Definition Box, FAQ Schema, Information Gain, E-E-A-T, TL;DR), Stealth Engine (очеловечивание AI-текста по методике DrMax + LSI-инъекции), Batch-анализ (1 кредит = 1 URL), парсинг через Jina Reader + Serper.dev (Яндекс/Google).

ПРАВИЛА:
1. Отвечай кратко, технически, профессионально. Markdown допустим (**жирный**, \`code\`).
2. Если вопрос относится к одной из 4 областей — ОБЯЗАТЕЛЬНО вызови соответствующий tool с реалистичными параметрами:
   - render_tfidf_alert — переспам, плотность, TF-IDF, закон Ципфа
   - render_sge_blueprint — SGE, AI-поиск, ChatGPT, Perplexity, структура страницы
   - render_stealth_result — очеловечивание, AI-детекторы, LSI, редактор
   - render_billing_card — кредиты, баланс, тариф, batch
3. Если вопрос общий/приветствие — отвечай только текстом без tools.
4. Параметры tools выдумывай правдоподобно (либо опирайся на цифры из контекста запроса).
5. Используй русский язык.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'render_tfidf_alert',
      description: 'Render a TF-IDF / Zipf violation alert card. Use when user asks about keyword spam, density, TF-IDF, or Zipf law.',
      parameters: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            description: '3-5 token rows ordered by severity (most spammy first)',
            items: {
              type: 'object',
              properties: {
                word: { type: 'string', description: 'Token / keyword in Russian' },
                freq: { type: 'string', description: 'Density on the page in percent, e.g. "9.0%"' },
                median: { type: 'string', description: 'Median density across TOP-10 competitors, e.g. "2.6%"' },
                status: { type: 'string', enum: ['spam', 'ok', 'low'], description: 'spam = overstuffed, low = deficit, ok = balanced' },
              },
              required: ['word', 'freq', 'median', 'status'],
              additionalProperties: false,
            },
          },
        },
        required: ['rows'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'render_sge_blueprint',
      description: 'Render Golden Blueprint SGE audit checklist. Use for AI-search / SGE / ChatGPT / Perplexity questions.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: '4-6 ranking factors with status',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'Factor name in Russian' },
                status: { type: 'string', enum: ['valid', 'missing', 'low'] },
              },
              required: ['label', 'status'],
              additionalProperties: false,
            },
          },
          readiness: { type: 'number', description: 'SGE readiness score 0-100' },
        },
        required: ['items', 'readiness'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'render_stealth_result',
      description: 'Render Stealth Engine before/after diff card. Use for humanization / AI-detector / LSI / editor queries.',
      parameters: {
        type: 'object',
        properties: {
          before: { type: 'string', description: 'Original AI-generated sentence in Russian (~100 chars)' },
          after: { type: 'string', description: 'Humanized version in Russian (~100 chars)' },
          humanness: { type: 'number', description: 'Humanness score 0-100' },
          seo_health: { type: 'number', description: 'SEO health score 0-100' },
          lsi_added: { type: 'number', description: 'Number of LSI keywords injected' },
        },
        required: ['before', 'after', 'humanness', 'seo_health', 'lsi_added'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'render_billing_card',
      description: 'Render billing / credits card. Use for credits, balance, plan, batch pricing questions.',
      parameters: {
        type: 'object',
        properties: {
          credits: { type: 'number', description: 'Remaining credits' },
          plan: { type: 'string', description: 'Plan name e.g. "PRO · monthly"' },
        },
        required: ['credits', 'plan'],
        additionalProperties: false,
      },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const { messages = [], userCredits } = await req.json();

    // Try to enrich billing context from authed user
    let creditsHint = userCredits;
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && !creditsHint) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('credits')
            .eq('user_id', user.id)
            .maybeSingle();
          if (prof?.credits != null) creditsHint = prof.credits;
        }
      }
    } catch (_) { /* anon ok */ }

    const sysAddon = creditsHint != null
      ? `\n\nКОНТЕКСТ ПОЛЬЗОВАТЕЛЯ: текущий баланс = ${creditsHint} кредитов. Используй это значение в render_billing_card.`
      : '';

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + sysAddon },
          ...messages,
        ],
        tools: TOOLS,
        tool_choice: 'auto',
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error('AI gateway error', status, errText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Превышен лимит запросов. Попробуйте через минуту.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Закончились кредиты Lovable AI. Пополните баланс в Settings → Workspace → Usage.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway ${status}`);
    }

    const data = await aiResponse.json();
    const choice = data.choices?.[0]?.message;
    const text = choice?.content || '';
    const toolCalls = choice?.tool_calls || [];

    let card: { name: string; args: any } | null = null;
    if (toolCalls.length > 0) {
      const tc = toolCalls[0];
      try {
        card = { name: tc.function.name, args: JSON.parse(tc.function.arguments || '{}') };
      } catch (e) {
        console.error('Failed to parse tool args', e);
      }
    }

    return new Response(JSON.stringify({ text, card }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('copilot-chat error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
