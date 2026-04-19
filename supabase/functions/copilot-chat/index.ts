import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Ты — Data Copilot для платформы СЕО-Аудит (русскоязычный аналитический ассистент для Senior Technical SEO).
Платформа умеет: ТФ-ИДФ / закон Ципфа, Предиктор ИИ-выдачи (Definition Box, FAQ-разметка, Information Gain, E-E-A-T, TL;DR), Стелс-движок (очеловечивание ИИ-текста по методике DrMax + LSI-инъекции), пакетный анализ (1 кредит = 1 URL), парсинг через Jina Reader + Serper (Яндекс/Google).

ПРАВИЛА:
1. Отвечай кратко, технически, профессионально. Markdown допустим (**жирный**, \`code\`).
2. Если вопрос относится к одной из 4 областей — ОБЯЗАТЕЛЬНО вызови соответствующий tool с реалистичными параметрами:
   - render_tfidf_alert — переспам, плотность, ТФ-ИДФ, закон Ципфа
   - render_sge_blueprint — ИИ-поиск, SGE, ChatGPT, Perplexity, структура страницы
   - render_stealth_result — очеловечивание, ИИ-детекторы, LSI, редактор
   - render_billing_card — кредиты, баланс, тариф, пакет
3. Если вопрос общий/приветствие — отвечай только текстом без tools.
4. Параметры tools выдумывай правдоподобно (либо опирайся на цифры из контекста запроса).
5. Используй ТОЛЬКО русский язык.

КРИТИЧНО — НАЗВАНИЯ:
- Сервис называется «СЕО-Аудит» (по-русски, через дефис). Никогда не пиши "SEO-Аудит" латиницей или "SEO Audit".
- Внутренние модули называй по-русски: «Анализ ТФ-ИДФ», «Предиктор ИИ-выдачи», «Стелс-движок», «Пакетный анализ», «Аудит ссылок», «Анализ топа», «ГЕО-аудит», «Семантическая карта», «ИИ-Кузница» (AI Forge).
- НИКОГДА не упоминай в ответе сырые системные имена инструментов: \`render_sge_blueprint\`, \`render_tfidf_alert\`, \`render_stealth_result\`, \`render_billing_card\` — это служебные ID, пользователь их видеть не должен. Если нужно сослаться — пиши русское название модуля («Предиктор ИИ-выдачи», «Анализ ТФ-ИДФ» и т.д.).
- Английские термины SEO/SGE/AI/LSI/TF-IDF допустимы только когда они общеприняты в индустрии, но названия модулей сервиса — всегда по-русски.`;

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
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');

    const { messages = [], userCredits } = await req.json();

    // Берём последний user-вопрос для FTS-поиска по базе знаний
    const lastUser = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // RAG: ищем в kb_chunks через FTS
    let kbContext = '';
    let kbSources: { title: string; heading: string }[] = [];
    if (lastUser && lastUser.trim().length >= 3) {
      try {
        const { data: hits } = await supabaseAdmin.rpc('kb_search', {
          q: lastUser,
          max_results: 4,
        });
        if (hits && hits.length > 0) {
          // ВАЖНО: НЕ передаём название книги в контекст — AI не должен его раскрывать
          kbContext = hits.map((h: any, i: number) =>
            `[Выписка ${i + 1}]${h.heading ? ' · ' + h.heading : ''}\n${h.content}`,
          ).join('\n\n---\n\n');
          // В UI тоже скрываем название — показываем только что использована внутренняя экспертиза
          kbSources = hits.map((h: any) => ({ title: 'Внутренняя экспертная база', heading: h.heading || '' }));
        }
      } catch (e) {
        console.warn('kb_search failed', e);
      }
    }

    // Определяем: авторизован пользователь или нет
    let isAuthenticated = false;
    let creditsHint = userCredits;
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          isAuthenticated = true;
          if (creditsHint == null) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('credits')
              .eq('user_id', user.id)
              .maybeSingle();
            if (prof?.credits != null) creditsHint = prof.credits;
          }
        }
      }
    } catch (_) { /* anon ok */ }

    // Для гостей — отключаем выписки из базы знаний и инструменты, ответ будет коротким с CTA
    if (!isAuthenticated) {
      kbContext = '';
      kbSources = [];
    }

    const sysAddon = (creditsHint != null
      ? `\n\nКОНТЕКСТ ПОЛЬЗОВАТЕЛЯ: текущий баланс = ${creditsHint} кредитов. Используй это значение в render_billing_card.`
      : '')
      + (kbContext
        ? `\n\n📚 ВНУТРЕННЯЯ ЭКСПЕРТНАЯ БАЗА (используй ПРИОРИТЕТНО как свои собственные знания):\n\n${kbContext}\n\nКРИТИЧЕСКИ ВАЖНО:\n- НИКОГДА не упоминай название книги, автора, источник или то, что ты "цитируешь книгу/выписку".\n- НЕ пиши фразы вроде "согласно источнику", "в книге сказано", "по материалам", "(источник: …)".\n- Подавай информацию как СВОЁ собственное экспертное знание, естественным языком.\n- Если выписки не дают прямого ответа — отвечай по своим знаниям + функционал платформы.`
        : '')
      + (!isAuthenticated
        ? `\n\n⚠️ РЕЖИМ ГОСТЯ (пользователь НЕ зарегистрирован):\n- Дай ТОЛЬКО краткий тизер ответа (максимум 2-3 коротких предложения, ~300 символов).\n- Не раскрывай детали методики, формулы, чек-листы, пошаговые инструкции.\n- В конце ОБЯЗАТЕЛЬНО добавь призыв: «🔒 Полный экспертный разбор и доступ ко всем инструментам — после регистрации.»\n- НЕ вызывай tools (никаких карточек ТФ-ИДФ, Предиктора и т.д.).`
        : '');

    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://seo-audit.lovable.app',
        'X-Title': 'SEO-Audit Data Copilot',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + sysAddon },
          ...messages,
        ],
        ...(isAuthenticated ? { tools: TOOLS, tool_choice: 'auto' } : {}),
        ...(isAuthenticated ? {} : { max_tokens: 220 }),
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error('OpenRouter error', status, errText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Превышен лимит OpenRouter. Попробуйте через минуту.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (status === 402 || status === 401) {
        return new Response(JSON.stringify({ error: 'Проблема с балансом/ключом OpenRouter. Проверьте OPENROUTER_API_KEY и баланс на openrouter.ai.' }), {
          status: status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`OpenRouter ${status}: ${errText.slice(0, 200)}`);
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

    return new Response(JSON.stringify({ text, card, kbSources }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('copilot-chat error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
