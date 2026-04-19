// Knowledge Base ingest: принимает текст, режет на чанки и сохраняет в kb_chunks.
// Парсинг PDF/DOCX делается на клиенте (pdfjs/mammoth) — сюда приходит уже текст.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHUNK_SIZE = 1000;   // символов
const CHUNK_OVERLAP = 150; // нахлёст для контекста

function chunkText(raw: string): { content: string; heading: string }[] {
  // Нормализация
  const text = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return [];

  // Пытаемся резать по абзацам, сохраняя ближайший заголовок (строка короче 100 символов и начинающаяся с заглавной)
  const paragraphs = text.split(/\n\n+/);
  const chunks: { content: string; heading: string }[] = [];
  let buf = '';
  let currentHeading = '';

  const flush = () => {
    if (buf.trim().length > 50) {
      chunks.push({ content: buf.trim(), heading: currentHeading });
    }
    buf = '';
  };

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    // Эвристика: короткая строка без точки в конце = заголовок
    if (trimmed.length < 120 && !/[.!?]$/.test(trimmed) && /^[A-ZА-ЯЁ0-9]/.test(trimmed)) {
      flush();
      currentHeading = trimmed.slice(0, 200);
      continue;
    }

    if ((buf + '\n\n' + trimmed).length > CHUNK_SIZE) {
      flush();
      // overlap: последние CHUNK_OVERLAP символов предыдущего буфера для контекста
      const tail = chunks.length > 0 ? chunks[chunks.length - 1].content.slice(-CHUNK_OVERLAP) : '';
      buf = (tail ? tail + '\n\n' : '') + trimmed;
    } else {
      buf = buf ? buf + '\n\n' + trimmed : trimmed;
    }
  }
  flush();

  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Проверяем, что вызывает админ
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin } = await userClient.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const title: string = (body.title || '').toString().trim().slice(0, 300);
    const author: string = (body.author || '').toString().trim().slice(0, 200);
    const sourceType: string = (body.source_type || 'manual').toString().slice(0, 20);
    const text: string = (body.text || '').toString();

    if (!title || !text || text.length < 100) {
      return new Response(JSON.stringify({ error: 'title и text (≥100 символов) обязательны' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return new Response(JSON.stringify({ error: 'Не удалось извлечь чанки' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role для вставки большого объёма
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: doc, error: docErr } = await admin
      .from('kb_documents')
      .insert({
        title,
        author,
        source_type: sourceType,
        total_chunks: chunks.length,
        created_by: user.id,
      })
      .select()
      .single();

    if (docErr) throw docErr;

    // Батчевая вставка чанков по 200
    const BATCH = 200;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH).map((c, j) => ({
        document_id: doc.id,
        chunk_index: i + j,
        content: c.content,
        heading: c.heading,
      }));
      const { error: chErr } = await admin.from('kb_chunks').insert(slice);
      if (chErr) throw chErr;
    }

    return new Response(JSON.stringify({
      ok: true,
      document_id: doc.id,
      total_chunks: chunks.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('kb-ingest error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
