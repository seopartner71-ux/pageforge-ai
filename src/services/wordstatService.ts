// ============================================
// WORDSTAT SERVICE
// Mock mode: active when no API key in settings (system_settings.wordstat_api_key)
// To enable real API: add key in Settings → API Keys
// Real API docs: https://yandex.ru/dev/wordstat/
// ============================================
import { supabase } from '@/integrations/supabase/client';

export interface WordstatResult {
  keyword: string;
  wsFrequency: number;
  exactFrequency: number;
}

let _cachedHasKey: boolean | null = null;
let _cacheTs = 0;

export async function isWordstatRealMode(): Promise<boolean> {
  // 30s cache
  if (_cachedHasKey !== null && Date.now() - _cacheTs < 30_000) return _cachedHasKey;
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('key_value')
      .eq('key_name', 'wordstat_api_key')
      .maybeSingle();
    const v = (data?.key_value || '').trim();
    _cachedHasKey = v.length > 5;
  } catch {
    _cachedHasKey = false;
  }
  _cacheTs = Date.now();
  return _cachedHasKey;
}

function seedHash(s: string): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
}

function seededRandom(seed: number): () => number {
  let x = seed || 1;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

async function getMockFrequencies(keywords: string[]): Promise<WordstatResult[]> {
  console.info('[Wordstat] Mock mode active. Add API key in Settings to use real data.');
  await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
  return keywords.map((keyword) => {
    const rng = seededRandom(seedHash(keyword));
    const r1 = rng();
    const r2 = rng();
    const ws = Math.floor(Math.pow(r1, 2) * 50000) + 100;
    const exactRatio = 0.1 + r2 * 0.5;
    const exact = Math.floor(ws * exactRatio);
    return { keyword, wsFrequency: ws, exactFrequency: exact };
  });
}

export async function getFrequencies(keywords: string[]): Promise<WordstatResult[]> {
  if (!keywords.length) return [];
  const real = await isWordstatRealMode();
  if (real) {
    // TODO: implement real Wordstat API call
    throw new Error('NotImplementedError: real Wordstat API call not implemented yet');
  }
  return getMockFrequencies(keywords);
}