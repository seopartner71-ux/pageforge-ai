import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Russian + English stop-words ───
const STOP_WORDS = new Set([
  "и","в","на","с","по","не","что","это","как","а","но","для","из","к","от","до","за","о","у",
  "же","бы","то","все","его","её","их","мы","вы","они","он","она","оно","так","уже","тоже",
  "только","ещё","при","во","со","без","или","ни","да","нет","был","была","были","будет",
  "было","быть","есть","мне","мной","себя","свой","свою","своё","которые","который","которая",
  "которое","где","когда","чем","кто","чтобы","если","ли","между","через","после","перед",
  "под","над","об","этот","эта","эти","этих","тот","та","те","тех","такой","такая","такие",
  "каждый","один","два","три","более","менее","очень","также","можно","нужно","может","должен",
  // Extended RU: pronouns, particles, short forms
  "мой","моя","моё","мои","моей","моего","моему","моим","моих",
  "наш","наша","наше","наши","нашей","нашего","нашему","нашим","наших",
  "ваш","ваша","ваше","ваши","вашей","вашего","вашему","вашим","ваших",
  "свои","своей","своего","своему","своим","своих",
  "этого","этому","этом","этой",
  "того","тому","том","той",
  "просто","всего","будут","будем","будете","буду","будешь",
  "ведь","лишь","вот","вон","даже","именно","пока","ещё","уж","разве","неужели",
  "надо","нибудь","либо","нему","ней","ним","них","ему","ему",
  "чего","чему","чём","кого","кому","ком","кем",
  "тут","там","сюда","туда","откуда","куда","зачем","почему","потому",
  "весь","вся","всё","всех","всем","всему","всей",
  "сам","сама","само","сами","самого","самой","самому","самих",
  "другой","другая","другое","другие","других","другому",
  "какой","какая","какое","какие","каких","какому",
  "иной","иная","иное","иные","иных",
  "чей","чья","чьё","чьи",
  "тел","телефон",
  "the","a","an","is","are","was","were","be","been","being","have","has","had","do","does",
  "did","will","would","could","should","may","might","shall","can","to","of","in","for",
  "on","with","at","by","from","as","into","through","during","before","after","above","below",
  "between","out","off","over","under","again","further","then","once","here","there","when",
  "where","why","how","all","each","every","both","few","more","most","other","some","such",
  "no","nor","not","only","own","same","so","than","too","very","just","because","but","or",
  "and","if","while","about","up","it","its","this","that","these","those","i","me","my","we",
  "our","you","your","he","him","his","she","her","they","them","their","what","which","who",
]);

// ─── Technical blacklist: protocols, TLDs, URL paths, nav junk, HTML attrs ───
const TECH_BLACKLIST = new Set([
  "www","http","https","ftp","mailto",
  "com","ru","net","org","info","by","kz","ua","su","рф","biz","pro","edu","gov","io","dev","app","me",
  "index","php","html","htm","aspx","asp","cgi","bin","xml","json","css","jsp","action","api","wp",
  "wordpress","joomla","bitrix","modx","noindex","nofollow","utm","source","medium","campaign","content","ref",
  "glavnaya","page","nashi","vse","eto","stranica","razdel","katalog","category","tag","archive",
  "uploads","includes","plugins","themes","static","assets","dist","build","node","modules",
  "sidebar","footer","header","wrapper","container","widget","block","section","div","span",
  "onclick","onload","script","noscript","iframe","style","class","type","href","src",
  "vidy","novosti","price","prices","kontakty","uslugi","stati","blog","news","about",
  "dostavka","oplata","otzyvy","faq","contacts","sitemap","login","register","search",
  // HTML attribute words that leak from parsing
  "image","img","tel","phone","call","email","mail","loading","lazy","srcset","sizes","alt","title",
  "width","height","data","aria","role","tabindex","placeholder","autocomplete","readonly",
  "target","blank","noopener","noreferrer","display","none","hidden","visible","overflow",
  // JSON-LD / schema.org / microdata technical terms
  "product","products","category","categories","item","items","element","elements",
  "schema","name","description","variant","variants","metadata","attributes","attribute",
  "context","offer","offers","review","reviews","rating","availability","brand",
  "aggregaterating","breadcrumblist","listitem","itemlistelement","organization",
  "webpage","website","imageobject","postaladdress","openinghours","pricecurrency",
  "mainentityofpage","speakable","potentialaction","searchaction","readaction",
  // Additional CSS/JS/HTML junk
  "undefined","null","true","false","function","object","array","string","number","boolean",
  "return","const","var","let","export","import","default","module","require",
  "padding","margin","border","color","background","font","text","align","flex","grid",
  "position","absolute","relative","fixed","static","inline","important",
  "click","hover","focus","active","visited","disabled","checked","selected",
  "viewport","responsive","media","query","breakpoint","transition","animation","transform",
  "prev","next","close","open","toggle","collapse","expand","show","hide",
  "list","menu","nav","link","btn","button","icon","logo","form","input","label","select","option",
]);

// ─── Regex: strip URLs, emails, file extensions, phone numbers, tel: links ───
const URL_STRIP_RE = /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9._/-]+\.(ru|com|net|org|info|by|kz|ua|html|php|aspx|htm|jpg|jpeg|png|gif|svg|webp|pdf|css|js|xml)\b|tel:[^\s]+|\+?\d[\d\s\-()]{6,}/gi;

// ─── Filter: pure digits, phone fragments, digit+prefix combos ───
const DIGIT_ONLY_RE = /^\d+$/;
const DIGIT_HEAVY_RE = /\d{5,}/;  // 5+ digits in a row = phone/code junk
const TECH_PREFIX_DIGIT_RE = /^(tel|id|ref|sid|uid|pid|gid|cid)\d*$/i;

// ─── Regex: split Cyrillic from Latin when glued together (e.g. "КупитьiPhone" → "Купить iPhone") ───
const CYRLAT_SPLIT_RE = /([\u0400-\u04FF])([A-Za-z])/g;
const LATCYR_SPLIT_RE = /([A-Za-z])([\u0400-\u04FF])/g;

// ─── Latin word filter for RU content ───
const LATIN_RE = /^[a-z]+$/;         // fully lowercase latin
const UPPER_ABBR_RE = /^[A-Z]{2,5}$/; // uppercase abbreviation (SEO, API, GSC, DIN, ISO)
const BRAND_RE = /^[A-Z][a-z]{2,}/;   // Capitalized word (Apple, Sika, Nikon)
const SPEC_RE = /^[A-Za-z0-9]+$/;     // Alphanumeric spec (4MATIC, VGA, WiFi, iPhone)

function isLatinJunk(originalWord: string): boolean {
  // Already lowercased in tokenize — we need original casing for brand detection
  // So this function works on the ORIGINAL (pre-lowercase) word
  const lower = originalWord.toLowerCase();

  // Always block if in tech blacklist
  if (TECH_BLACKLIST.has(lower)) return true;

  // Check if the word is pure Latin
  if (!/[a-zA-Z]/.test(originalWord)) return false; // Not Latin at all — keep
  if (/[\u0400-\u04FF]/.test(originalWord)) return false; // Mixed cyr+lat — keep (brand in context)

  // WHITELIST: uppercase abbreviations (SEO, API, GSC, DIN, ISO, VGA)
  if (UPPER_ABBR_RE.test(originalWord)) return false;

  // WHITELIST: Capitalized brand names (Apple, Sika, Nikon, iPhone)
  if (BRAND_RE.test(originalWord)) return false;

  // WHITELIST: Alphanumeric specs with digits (4MATIC, H2O, WiFi5)
  if (/\d/.test(originalWord) && SPEC_RE.test(originalWord)) return false;

  // Everything else in Latin (lowercase transliteration, junk) → BLOCK
  return true;
}

// ─── Sanitize markdown: strip JSON-LD, script/style blocks, JSON fragments ───
function sanitizeMarkdown(text: string): string {
  let s = text;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.split('\n').filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return false;
    if (/"@type"/i.test(trimmed) || /"@context"/i.test(trimmed)) return false;
    if (/^\s*"[a-zA-Z]+"\s*:/.test(trimmed)) return false;
    return true;
  }).join('\n');
  return s;
}

// ─── Detect if text is primarily Russian ───
function isRussianContent(text: string): boolean {
  const sample = text.slice(0, 5000);
  const cyrChars = (sample.match(/[\u0400-\u04FF]/g) || []).length;
  const latChars = (sample.match(/[a-zA-Z]/g) || []).length;
  return cyrChars > latChars * 1.5;
}

// ─── Check if a token is numeric/phone junk ───
function isNumericJunk(word: string): boolean {
  if (DIGIT_ONLY_RE.test(word)) return true;
  if (DIGIT_HEAVY_RE.test(word)) return true;
  if (TECH_PREFIX_DIGIT_RE.test(word)) return true;
  return false;
}

function tokenize(text: string, filterLatin = false): string[] {
  let cleaned = sanitizeMarkdown(text);
  cleaned = cleaned.replace(CYRLAT_SPLIT_RE, "$1 $2").replace(LATCYR_SPLIT_RE, "$1 $2");
  cleaned = cleaned.replace(URL_STRIP_RE, " ").replace(/[^\p{L}\p{N}\s]/gu, " ");

  const rawWords = cleaned.split(/\s+/).filter(w => w.length > 2);
  const result: string[] = [];

  for (const w of rawWords) {
    const lower = w.toLowerCase();
    if (STOP_WORDS.has(lower)) continue;
    if (TECH_BLACKLIST.has(lower)) continue;
    if (isNumericJunk(lower)) continue;
    if (filterLatin && isLatinJunk(w)) continue;
    result.push(lower);
  }

  // ── Density auto-exclude: if any single word > 15% of total, it's a parsing error ──
  if (result.length > 0) {
    const freq: Record<string, number> = {};
    for (const w of result) freq[w] = (freq[w] || 0) + 1;
    const threshold = result.length * 0.15;
    const junkWords = new Set<string>();
    for (const [w, count] of Object.entries(freq)) {
      if (count > threshold) {
        console.log(`Density auto-exclude: "${w}" (${count}/${result.length} = ${(count/result.length*100).toFixed(1)}%)`);
        junkWords.add(w);
      }
    }
    if (junkWords.size > 0) {
      return result.filter(w => !junkWords.has(w));
    }
  }

  return result;
}

// ─── Progress helper ───
async function updateProgress(
  supabase: any,
  analysisId: string,
  stages: { name: string; status: "pending" | "running" | "done" | "error"; time?: string }[]
) {
  await supabase.from("analyses").update({ progress: stages }).eq("id", analysisId);
}

// ─── TF-IDF: TF = n/N, IDF = log(10 / df), Score = TF × IDF ───
function calculateTFIDF(targetWords: string[], competitorWordArrays: string[][]) {
  const totalDocs = competitorWordArrays.length;
  const targetLen = targetWords.length || 1;

  // Target TF
  const targetTfRaw: Record<string, number> = {};
  for (const w of targetWords) targetTfRaw[w] = (targetTfRaw[w] || 0) + 1;
  const targetTf: Record<string, number> = {};
  for (const w in targetTfRaw) targetTf[w] = targetTfRaw[w] / targetLen;

  if (totalDocs === 0) {
    return Object.entries(targetTf)
      .map(([term, tf]) => ({ term, tf, idf: 1, tfidf: tf, competitorMedianTfidf: 0, status: "OK" as const, density: tf * 100 }))
      .sort((a, b) => b.tfidf - a.tfidf).slice(0, 40);
  }

  // Competitor TFs
  const compTfs = competitorWordArrays.map(words => {
    const len = words.length || 1;
    const tf: Record<string, number> = {};
    for (const w of words) tf[w] = (tf[w] || 0) + 1;
    for (const w in tf) tf[w] /= len;
    return tf;
  });

  // All unique terms
  const allTerms = new Set<string>();
  for (const w of Object.keys(targetTf)) allTerms.add(w);
  for (const ctf of compTfs) for (const w of Object.keys(ctf)) allTerms.add(w);

  // Document frequency: how many competitor docs contain the term
  const docFreq: Record<string, number> = {};
  for (const term of allTerms) {
    let count = 0;
    for (const ctf of compTfs) { if (ctf[term]) count++; }
    docFreq[term] = count;
  }

  const median = (arr: number[]) => {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const results: any[] = [];
  for (const term of allTerms) {
    const df = docFreq[term] || 0;
    // IDF = log(totalDocs / df) — classic formula; smooth to avoid log(0)
    const idf = df > 0 ? Math.log10(totalDocs / df) : Math.log10(totalDocs + 1);
    const userTf = targetTf[term] || 0;
    const userTfidf = userTf * idf;

    // Competitor median TF-IDF
    const compScores = compTfs.map(ctf => (ctf[term] || 0) * idf);
    const compMedian = median(compScores);

    // Status determination
    let status: "Missing" | "OK" | "Spam" = "OK";
    if (userTf === 0 && df >= Math.max(2, Math.floor(totalDocs * 0.3))) {
      status = "Missing"; // High IDF among competitors, absent from target
    } else if (compMedian > 0 && userTfidf > compMedian * 1.3) {
      status = "Spam"; // User TF-IDF exceeds median by >30%
    }

    results.push({
      term, tf: userTf, idf, tfidf: userTfidf,
      competitorMedianTfidf: compMedian,
      status, density: userTf * 100,
    });
  }

  // Sort: Missing first (by comp median desc), then by combined score
  results.sort((a: any, b: any) => {
    if (a.status === "Missing" && b.status !== "Missing") return -1;
    if (b.status === "Missing" && a.status !== "Missing") return 1;
    return (b.tfidf + b.competitorMedianTfidf) - (a.tfidf + a.competitorMedianTfidf);
  });

  return results.slice(0, 40);
}

// ─── UI navigation words: never flag as spam on landing pages ───
const ZIPF_SAFE_WORDS = new Set([
  "подробнее","заявка","контакты","купить","заказать","перезвоните","каталог",
  "корзина","оформить","подписаться","узнать","отзывы","гарантия","доставка",
]);

// ─── Zipf's Law: P(r) = C/r ───
// isRU flag: if true, skip all Latin words from Zipf output
function calculateZipf(words: string[], isRU = false) {
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  // For RU content, remove all purely-Latin words from Zipf analysis
  let sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  if (isRU) {
    sorted = sorted.filter(([word]) => !/^[a-z]+$/.test(word));
  }
  if (!sorted.length) return [];

  const C = sorted[0][1];

  return sorted.slice(0, 30).map(([word, count], i) => {
    const rank = i + 1;
    const idealFrequency = Math.round(C / rank);
    const deviation = idealFrequency > 0 ? Math.round((count - idealFrequency) / idealFrequency * 100) : 0;
    const isSpam = deviation > 200 && rank > 3 && !ZIPF_SAFE_WORDS.has(word);
    return { rank, word, frequency: count, idealFrequency, deviation, isSpam };
  });
}

// ─── N-grams: sliding window ───
// ─── N-gram sanity check: reject if ANY component is junk ───
function isCleanNgram(parts: string[]): boolean {
  for (const p of parts) {
    if (p.length <= 2) return false;
    if (TECH_BLACKLIST.has(p)) return false;
    if (isNumericJunk(p)) return false;
  }
  return true;
}

function extractNgrams(words: string[], n: number) {
  const grams: Record<string, number> = {};
  for (let i = 0; i <= words.length - n; i++) {
    const w = words.slice(i, i + n);
    if (!isCleanNgram(w)) continue;
    const gram = w.join(" ");
    grams[gram] = (grams[gram] || 0) + 1;
  }
  return Object.entries(grams)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([text, count]) => ({ text, count }));
}

// ─── Topical Gap: competitor n-grams missing from target ───
function findTopicalGaps(targetWords: string[], competitorWordArrays: string[][], n: number) {
  const targetGrams = new Set<string>();
  for (let i = 0; i <= targetWords.length - n; i++) {
    targetGrams.add(targetWords.slice(i, i + n).join(" "));
  }

  const compGramCounts: Record<string, number> = {};
  for (const words of competitorWordArrays) {
    const seen = new Set<string>();
    for (let i = 0; i <= words.length - n; i++) {
      const parts = words.slice(i, i + n);
      if (!isCleanNgram(parts)) continue;
      const gram = parts.join(" ");
      if (!seen.has(gram)) { compGramCounts[gram] = (compGramCounts[gram] || 0) + 1; seen.add(gram); }
    }
  }

  return Object.entries(compGramCounts)
    .filter(([gram, count]) => count >= 2 && !targetGrams.has(gram))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([text, competitorCount]) => ({ text, competitorCount }));
}

// ─── Readability Score (Flesch-Kincaid adapted for RU) ───
function calculateReadability(text: string, isRU: boolean) {
  const cleanText = text.replace(/[#*_\[\]()>|`~]/g, '').replace(/\s+/g, ' ').trim();
  const sentences = cleanText.split(/[.!?…]+/).filter(s => s.trim().length > 5);
  const words = cleanText.split(/\s+/).filter(w => w.length > 1);
  const sentenceCount = Math.max(sentences.length, 1);
  const wordCount = Math.max(words.length, 1);

  // Syllable estimation
  const countSyllables = (word: string): number => {
    if (isRU) {
      return (word.match(/[аеёиоуыэюяАЕЁИОУЫЭЮЯ]/g) || []).length || 1;
    }
    const w = word.toLowerCase().replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    return Math.max((w.match(/[aeiouy]{1,2}/g) || []).length, 1);
  };

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / wordCount;

  // Flesch Reading Ease (adapted)
  const fleschScore = Math.round(206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord);
  const clampedScore = Math.max(0, Math.min(100, fleschScore));

  // Complex words (3+ syllables)
  const complexWords = words.filter(w => countSyllables(w) >= 3).length;
  const complexPercent = Math.round((complexWords / wordCount) * 100);

  // Grade level
  let grade: string;
  if (clampedScore >= 80) grade = isRU ? 'Очень лёгкий' : 'Very Easy';
  else if (clampedScore >= 60) grade = isRU ? 'Лёгкий' : 'Easy';
  else if (clampedScore >= 40) grade = isRU ? 'Средний' : 'Average';
  else if (clampedScore >= 20) grade = isRU ? 'Сложный' : 'Difficult';
  else grade = isRU ? 'Очень сложный' : 'Very Difficult';

  return {
    score: clampedScore,
    grade,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
    sentenceCount,
    wordCount,
    complexWords,
    complexPercent,
    totalSyllables,
  };
}

// ─── Heading Hierarchy (H1-H6) ───
function parseHeadingHierarchy(html: string) {
  const headings: { level: number; text: string; issues: string[] }[] = [];
  const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const level = parseInt(m[1]);
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    headings.push({ level, text, issues: [] });
  }
  // Check hierarchy issues
  const issues: string[] = [];
  let prevLevel = 0;
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    if (h.level > prevLevel + 1 && prevLevel > 0) {
      const msg = `H${h.level} после H${prevLevel} — пропуск уровня`;
      h.issues.push(msg);
      issues.push(msg);
    }
    prevLevel = h.level;
  }
  const h1Count = headings.filter(h => h.level === 1).length;
  if (h1Count > 1) issues.push(`${h1Count} тегов H1 (должен быть 1)`);
  if (h1Count === 0) issues.push('Отсутствует H1');
  return { headings, issues, counts: { h1: h1Count, h2: headings.filter(h => h.level === 2).length, h3: headings.filter(h => h.level === 3).length, h4: headings.filter(h => h.level === 4).length, h5: headings.filter(h => h.level === 5).length, h6: headings.filter(h => h.level === 6).length } };
}

// ─── Canonical / Hreflang / Robots ───
function parseMetaDirectives(html: string) {
  const headMatch = html.match(/<head[\s>]([\s\S]*?)<\/head>/i);
  const headHtml = headMatch ? headMatch[1] : '';

  const canonical = headHtml.match(/rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']*)["']/i)?.[1] || null;

  // Hreflang
  const hreflangs: { lang: string; url: string }[] = [];
  const hlRe = /rel\s*=\s*["']alternate["'][^>]*hreflang\s*=\s*["']([^"']*)["'][^>]*href\s*=\s*["']([^"']*)["']/gi;
  let hlm;
  while ((hlm = hlRe.exec(headHtml)) !== null) {
    hreflangs.push({ lang: hlm[1], url: hlm[2] });
  }
  // Also try reversed attribute order
  const hlRe2 = /hreflang\s*=\s*["']([^"']*)["'][^>]*href\s*=\s*["']([^"']*)["'][^>]*rel\s*=\s*["']alternate["']/gi;
  while ((hlm = hlRe2.exec(headHtml)) !== null) {
    if (!hreflangs.find(h => h.lang === hlm[1])) {
      hreflangs.push({ lang: hlm[1], url: hlm[2] });
    }
  }

  // Meta robots
  const robotsMatch = headHtml.match(/name\s*=\s*["']robots["'][^>]*content\s*=\s*["']([^"']*)["']/i) ||
                       headHtml.match(/content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']robots["']/i);
  const metaRobots = robotsMatch?.[1] || null;

  // X-Robots (can't get from HTML, note as unknown)
  const hasNoindex = metaRobots ? /noindex/i.test(metaRobots) : false;
  const hasNofollow = metaRobots ? /nofollow/i.test(metaRobots) : false;

  const issues: string[] = [];
  if (!canonical) issues.push('Нет canonical URL');
  if (hasNoindex) issues.push('Страница помечена noindex!');
  if (hasNofollow) issues.push('Страница помечена nofollow');
  if (hreflangs.length === 0) issues.push('Нет hreflang (мультиязычность)');

  return { canonical, hreflangs, metaRobots, hasNoindex, hasNofollow, issues };
}

// ─── URL Structure Score ───
function analyzeUrlStructure(url: string) {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return { score: 0, issues: ['Невалидный URL'], path: url, depth: 0, length: url.length, hasTrailingSlash: false, hasCyrillic: false, hasUppercase: false, hasUnderscores: false, hasStopWords: false }; }

  const path = parsed.pathname;
  const depth = path.split('/').filter(Boolean).length;
  const length = url.length;
  const hasTrailingSlash = path.length > 1 && path.endsWith('/');
  const hasCyrillic = /[\u0400-\u04FF]/.test(path);
  const hasUppercase = /[A-Z]/.test(path);
  const hasUnderscores = /_/.test(path);
  const hasStopWords = /\/(and|the|or|of|in|to|for|a|an|is)\//i.test(path);
  const hasParams = parsed.search.length > 1;
  const hasNumbers = /\/\d{5,}/.test(path); // long numeric IDs

  const issues: string[] = [];
  let score = 100;
  if (length > 75) { issues.push(`URL слишком длинный (${length} символов)`); score -= 15; }
  if (depth > 4) { issues.push(`Глубокая вложенность (${depth} уровней)`); score -= 10; }
  if (hasCyrillic) { issues.push('Кириллица в URL (может вызвать проблемы)'); score -= 10; }
  if (hasUppercase) { issues.push('Заглавные буквы в URL'); score -= 10; }
  if (hasUnderscores) { issues.push('Нижние подчёркивания вместо дефисов'); score -= 10; }
  if (hasStopWords) { issues.push('Стоп-слова в URL'); score -= 5; }
  if (hasParams) { issues.push('Параметры в URL'); score -= 10; }
  if (hasNumbers) { issues.push('Длинные числовые ID в URL'); score -= 10; }
  if (!hasTrailingSlash && path !== '/') { issues.push('Нет trailing slash (проверьте консистентность)'); }

  return { score: Math.max(0, score), issues, path, depth, length, hasTrailingSlash, hasCyrillic, hasUppercase, hasUnderscores, hasStopWords };
}

// ─── Content Freshness ───
function parseContentFreshness(html: string) {
  // Look for dates in JSON-LD
  const jsonLdBlocks = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  let datePublished: string | null = null;
  let dateModified: string | null = null;

  for (const block of jsonLdBlocks) {
    const content = block.replace(/<\/?script[^>]*>/gi, '');
    try {
      const data = JSON.parse(content);
      if (data.datePublished) datePublished = data.datePublished;
      if (data.dateModified) dateModified = data.dateModified;
    } catch {}
  }

  // Fallback: meta tags
  const headMatch = html.match(/<head[\s>]([\s\S]*?)<\/head>/i);
  const headHtml = headMatch ? headMatch[1] : '';
  if (!datePublished) {
    datePublished = headHtml.match(/property\s*=\s*["']article:published_time["'][^>]*content\s*=\s*["']([^"']*)["']/i)?.[1] || null;
  }
  if (!dateModified) {
    dateModified = headHtml.match(/property\s*=\s*["']article:modified_time["'][^>]*content\s*=\s*["']([^"']*)["']/i)?.[1] || null;
  }

  // Calculate age
  let ageInDays: number | null = null;
  const refDate = dateModified || datePublished;
  if (refDate) {
    try {
      ageInDays = Math.floor((Date.now() - new Date(refDate).getTime()) / 86400000);
    } catch {}
  }

  let freshness: string;
  if (ageInDays === null) freshness = 'unknown';
  else if (ageInDays <= 30) freshness = 'fresh';
  else if (ageInDays <= 180) freshness = 'recent';
  else if (ageInDays <= 365) freshness = 'aging';
  else freshness = 'stale';

  return { datePublished, dateModified, ageInDays, freshness };
}

// ─── Schema Markup Validator ───
function validateSchemaMarkup(html: string, pageType: string) {
  const jsonLdBlocks = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const schemas: { type: string; fields: string[]; missingRequired: string[] }[] = [];

  const requiredFieldsMap: Record<string, string[]> = {
    'Product': ['name', 'description', 'image', 'offers'],
    'Article': ['headline', 'author', 'datePublished', 'image'],
    'FAQPage': ['mainEntity'],
    'HowTo': ['name', 'step'],
    'LocalBusiness': ['name', 'address', 'telephone'],
    'Organization': ['name', 'url', 'logo'],
    'BreadcrumbList': ['itemListElement'],
    'WebPage': ['name'],
    'WebSite': ['name', 'url'],
  };

  const recommendedForPage: Record<string, string[]> = {
    'product': ['Product', 'BreadcrumbList', 'Organization'],
    'article': ['Article', 'BreadcrumbList', 'Organization'],
    'service': ['LocalBusiness', 'FAQPage', 'BreadcrumbList'],
    'homepage': ['Organization', 'WebSite', 'BreadcrumbList'],
    'category': ['BreadcrumbList', 'Organization', 'CollectionPage'],
    'landing': ['Organization', 'FAQPage', 'WebPage'],
  };

  for (const block of jsonLdBlocks) {
    const content = block.replace(/<\/?script[^>]*>/gi, '');
    try {
      const data = JSON.parse(content);
      const processSchema = (obj: any) => {
        const type = obj['@type'];
        if (!type) return;
        const types = Array.isArray(type) ? type : [type];
        for (const t of types) {
          const fields = Object.keys(obj).filter(k => !k.startsWith('@'));
          const required = requiredFieldsMap[t] || [];
          const missing = required.filter(f => !obj[f]);
          schemas.push({ type: t, fields, missingRequired: missing });
        }
        // Check @graph
        if (obj['@graph'] && Array.isArray(obj['@graph'])) {
          for (const item of obj['@graph']) processSchema(item);
        }
      };
      processSchema(data);
    } catch {}
  }

  const foundTypes = schemas.map(s => s.type);
  const recommended = recommendedForPage[pageType] || recommendedForPage['homepage'] || [];
  const missingSchemas = recommended.filter(r => !foundTypes.includes(r));

  // Check for microdata
  const hasMicrodata = /itemscope/i.test(html);
  // Check for RDFa
  const hasRdfa = /typeof\s*=\s*["']/i.test(html);

  return { schemas, missingSchemas, recommended, hasMicrodata, hasRdfa, totalSchemas: schemas.length };
}

// ─── Content Metrics ───
function calculateContentMetrics(html: string, markdown: string, targetWords: string[]) {
  const bodyMatch = html.match(/<body[\s>]([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;

  const wordCount = targetWords.length;
  const htmlLength = html.length;
  const textLength = markdown.replace(/[#*_\[\]()>|`~\n]/g, '').replace(/\s+/g, ' ').trim().length;
  const textToHtmlRatio = htmlLength > 0 ? Math.round((textLength / htmlLength) * 100) : 0;

  // Paragraphs
  const paragraphs = (bodyHtml.match(/<p[\s>]/gi) || []).length;
  // Lists
  const ulCount = (bodyHtml.match(/<ul[\s>]/gi) || []).length;
  const olCount = (bodyHtml.match(/<ol[\s>]/gi) || []).length;
  const listItems = (bodyHtml.match(/<li[\s>]/gi) || []).length;
  // Tables
  const tables = (bodyHtml.match(/<table[\s>]/gi) || []).length;
  // Videos
  const videos = (bodyHtml.match(/<video[\s>]|<iframe[^>]*(?:youtube|vimeo|rutube)/gi) || []).length;
  // Images
  const images = (bodyHtml.match(/<img[\s]/gi) || []).length;
  // Forms
  const forms = (bodyHtml.match(/<form[\s>]/gi) || []).length;

  // Media ratio (images + videos per 1000 words)
  const mediaRatio = wordCount > 0 ? Math.round(((images + videos) / wordCount) * 1000 * 10) / 10 : 0;

  return { wordCount, htmlLength, textLength, textToHtmlRatio, paragraphs, ulCount, olCount, listItems, tables, videos, images, forms, mediaRatio };
}

// ─── Internal Linking Score ───
function calculateInternalLinkingScore(anchorsData: any[], url: string) {
  const internal = anchorsData.filter((a: any) => a.type === 'internal');
  const external = anchorsData.filter((a: any) => a.type === 'external');

  const uniqueInternalHrefs = new Set(internal.map((a: any) => a.href));
  const emptyAnchors = internal.filter((a: any) => !a.text || a.text === '(без текста)');
  const nofollowInternal = internal.filter((a: any) => a.hasNofollow);

  const issues: string[] = [];
  let score = 100;

  if (internal.length < 3) { issues.push('Менее 3 внутренних ссылок'); score -= 25; }
  if (emptyAnchors.length > 0) { issues.push(`${emptyAnchors.length} ссылок без анкорного текста`); score -= 10; }
  if (nofollowInternal.length > 0) { issues.push(`${nofollowInternal.length} внутренних ссылок с nofollow`); score -= 15; }
  if (uniqueInternalHrefs.size < internal.length * 0.5 && internal.length > 5) { issues.push('Много дублирующихся внутренних ссылок'); score -= 10; }

  return {
    score: Math.max(0, score),
    totalInternal: internal.length,
    totalExternal: external.length,
    uniqueInternalUrls: uniqueInternalHrefs.size,
    emptyAnchors: emptyAnchors.length,
    nofollowInternal: nofollowInternal.length,
    issues,
  };
}

// ─── SERP Snippet Preview ───
function buildSnippetPreview(audit: any, url: string) {
  const title = audit.metaTitle || '';
  const description = audit.metaDesc || '';

  const titleLength = title.length;
  const descLength = description.length;

  const titleTruncated = titleLength > 60 ? title.slice(0, 57) + '...' : title;
  const descTruncated = descLength > 160 ? description.slice(0, 157) + '...' : description;

  let displayUrl = url;
  try { const u = new URL(url); displayUrl = u.hostname + u.pathname; } catch {}
  if (displayUrl.length > 60) displayUrl = displayUrl.slice(0, 57) + '...';

  const issues: string[] = [];
  if (!title) issues.push('Нет meta title');
  else if (titleLength < 30) issues.push(`Title слишком короткий (${titleLength} символов, рекомендуется 50-60)`);
  else if (titleLength > 60) issues.push(`Title обрезается (${titleLength}/60 символов)`);

  if (!description) issues.push('Нет meta description');
  else if (descLength < 70) issues.push(`Description слишком короткий (${descLength} символов, рекомендуется 120-160)`);
  else if (descLength > 160) issues.push(`Description обрезается (${descLength}/160 символов)`);

  return {
    title, titleTruncated, titleLength,
    description, descTruncated, descLength,
    displayUrl, issues,
  };
}

// ─── Technical Audit (HTML-based, hard logic — no AI guessing) ───
function technicalAudit(html: string, markdown: string) {
  // ── H1 tags: parse from HTML, filter hidden ones ──
  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  const allH1s: { text: string; hidden: boolean }[] = [];
  let h1m;
  while ((h1m = h1Regex.exec(html)) !== null) {
    const tag = h1m[0];
    const text = h1m[1].replace(/<[^>]+>/g, '').trim();
    const hidden = /display\s*:\s*none/i.test(tag) ||
                   /aria-hidden\s*=\s*["']true["']/i.test(tag) ||
                   /visibility\s*:\s*hidden/i.test(tag) ||
                   /class\s*=\s*["'][^"']*\b(hidden|sr-only|visually-hidden)\b/i.test(tag);
    allH1s.push({ text, hidden });
  }
  const visibleH1s = allH1s.filter(h => !h.hidden);

  // ── Images: only <img> inside <body>, skip tiny SVG decorations ──
  const bodyMatch = html.match(/<body[\s>]([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  const imgRegex = /<img\s[^>]*?>/gi;
  let totalImages = 0;
  let imagesWithoutAlt = 0;
  let im;
  while ((im = imgRegex.exec(bodyHtml)) !== null) {
    const tag = im[0];
    // Skip SVG-based icons and tiny decorative images
    if (/\.(svg|ico)\b/i.test(tag) && /width\s*=\s*["']?\d{1,2}["']?/i.test(tag)) continue;
    if (/role\s*=\s*["']presentation["']/i.test(tag)) continue;
    totalImages++;
    const altMatch = tag.match(/alt\s*=\s*["']([^"']*)["']/i);
    if (!altMatch || altMatch[1].trim() === '') imagesWithoutAlt++;
  }

  // ── JSON-LD: programmatic check ──
  const hasJsonLd = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/i.test(html);

  // ── OpenGraph: check <head> section only ──
  const headMatch = html.match(/<head[\s>]([\s\S]*?)<\/head>/i);
  const headHtml = headMatch ? headMatch[1] : '';
  const hasOgTitle = /property\s*=\s*["']og:title["']/i.test(headHtml);
  const hasOgDesc = /property\s*=\s*["']og:description["']/i.test(headHtml);
  const hasOgImage = /property\s*=\s*["']og:image["']/i.test(headHtml);
  const hasOpenGraph = hasOgTitle || hasOgDesc;

  // ── Meta tags ──
  const metaTitle = headHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || null;
  const metaDesc = headHtml.match(/name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i)?.[1] ||
                   headHtml.match(/content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["']/i)?.[1] || null;
  const canonical = headHtml.match(/rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']*)["']/i)?.[1] || null;

  // ── Build issues list ──
  const issues: string[] = [];
  if (visibleH1s.length === 0) issues.push("Отсутствует H1");
  if (visibleH1s.length > 1) issues.push(`${visibleH1s.length} видимых тегов H1 (должен быть 1)`);
  if (imagesWithoutAlt > 0) issues.push(`${imagesWithoutAlt} изображений без alt`);
  if (!hasJsonLd) issues.push("Нет JSON-LD разметки");
  if (!hasOgTitle) issues.push("Нет og:title");
  if (!hasOgDesc) issues.push("Нет og:description");
  if (!hasOgImage) issues.push("Нет og:image");
  if (!metaDesc) issues.push("Нет meta description");
  if (!canonical) issues.push("Нет canonical");

  return {
    h1Count: visibleH1s.length,
    h1Tags: visibleH1s.map(h => h.text),
    h1Hidden: allH1s.filter(h => h.hidden).map(h => h.text),
    totalImages,
    imagesWithoutAlt,
    hasJsonLd,
    hasOpenGraph,
    hasOgTitle, hasOgDesc, hasOgImage,
    metaTitle, metaDesc, canonical,
    issues,
  };
}

// ─── HTML Parser helpers (regex-based, no external deps) ───
function parseImages(html: string, baseUrl: string): any[] {
  const imgs: any[] = [];
  const re = /<img\s[^>]*?>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const src = tag.match(/src=["']([^"']+)["']/i)?.[1] || '';
    const alt = tag.match(/alt=["']([^"']*?)["']/i)?.[1] ?? null;
    const title = tag.match(/title=["']([^"']*?)["']/i)?.[1] ?? null;
    const hasLazy = /loading=["']lazy["']/i.test(tag);
    const hasAlt = alt !== null && alt.trim().length > 0;
    let fullSrc = src;
    try {
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        fullSrc = new URL(src, baseUrl).href;
      }
    } catch {}
    imgs.push({ src: fullSrc, alt: alt || '', title, hasAlt, hasLazy, critical: !hasAlt });
  }
  return imgs;
}

function parseAnchors(html: string, baseUrl: string): any[] {
  const anchors: any[] = [];
  let baseDomain = '';
  try { baseDomain = new URL(baseUrl).hostname.replace(/^www\./, ''); } catch {}
  const re = /<a\s[^>]*?>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1] || '';
    const hasNofollow = /rel=["'][^"']*nofollow[^"']*["']/i.test(tag);
    const hasBlank = /target=["']_blank["']/i.test(tag);
    let type: 'internal' | 'external' = 'internal';
    try {
      if (href.startsWith('http')) {
        const linkDomain = new URL(href).hostname.replace(/^www\./, '');
        if (linkDomain !== baseDomain) type = 'external';
      } else if (href.startsWith('mailto:') || href.startsWith('tel:')) {
        type = 'external';
      }
    } catch {}
    if (!href || href === '#' || href.startsWith('javascript:')) continue;
    anchors.push({ href, text: text || '(без текста)', type, hasNofollow, hasBlank });
  }
  return anchors;
}

// ─── Fetch raw HTML (with timeout) ───
async function fetchRawHtml(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    return (await res.text()).slice(0, 500000);
  } catch { return ''; }
}

// ─── Jina Reader (with timeout) ───
async function fetchPage(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/markdown", "X-Return-Format": "markdown" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    return (await res.text()).slice(0, 50000);
  } catch { return ""; }
}

// ─── Serper.dev SERP ───
async function findCompetitors(keyword: string, apiKey: string, region?: string): Promise<string[]> {
  try {
    const body: any = { q: keyword, num: 10, gl: "ru", hl: "ru" };
    if (region) body.location = `${region}, Russia`;
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.organic || []).map((r: any) => r.link).filter(Boolean).slice(0, 10);
  } catch { return []; }
}

// ─── Serper.dev extended SERP for cluster analysis ───
async function findClusterData(keyword: string, apiKey: string, region?: string): Promise<{
  competitors: string[];
  relatedSearches: string[];
  peopleAlsoAsk: string[];
}> {
  const result = { competitors: [] as string[], relatedSearches: [] as string[], peopleAlsoAsk: [] as string[] };
  try {
    const body: any = { q: keyword, num: 10, gl: "ru", hl: "ru" };
    if (region) body.location = `${region}, Russia`;
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return result;
    const data = await res.json();
    result.competitors = (data.organic || []).map((r: any) => r.link).filter(Boolean).slice(0, 10);
    result.relatedSearches = (data.relatedSearches || []).map((r: any) => r.query).filter(Boolean).slice(0, 15);
    result.peopleAlsoAsk = (data.peopleAlsoAsk || []).map((r: any) => r.question).filter(Boolean).slice(0, 15);
  } catch {}
  return result;
}

// ─── Extract H2/H3 headings from markdown for cluster structure ───
function extractHeadings(markdown: string): string[] {
  const headings = markdown.match(/^#{2,3}\s+(.+)$/gm) || [];
  return headings.map(h => h.replace(/^#{2,3}\s+/, '').trim());
}

// ─── Fetch with timeout ───
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Main ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const GLOBAL_TIMEOUT = 90000; // 90s hard limit
  const globalTimer = setTimeout(() => {
    console.error("GLOBAL TIMEOUT reached (90s)");
  }, GLOBAL_TIMEOUT);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      clearTimeout(globalTimer);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: cd, error: ce } = await supabase.auth.getUser(token);
    if (ce || !cd?.user) {
      clearTimeout(globalTimer);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Server-side approval + credit check ──
    const { data: profile } = await supabase.from("profiles").select("credits, is_approved").eq("user_id", cd.user.id).single();
    if (!profile || !profile.is_approved) {
      clearTimeout(globalTimer);
      return new Response(JSON.stringify({ error: "Account not approved" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (profile.credits <= 0) {
      clearTimeout(globalTimer);
      return new Response(JSON.stringify({ error: "Insufficient credits" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { url, pageType, competitors: manualComp, aiContext, analysisId, clusterMode, region } = await req.json();
    if (!url || !analysisId) {
      clearTimeout(globalTimer);
      return new Response(JSON.stringify({ error: "url and analysisId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Cache check: same URL by same user within 1 hour ──
    const { data: cachedAnalysis } = await supabase
      .from("analyses")
      .select("id")
      .eq("user_id", cd.user.id)
      .eq("url", url)
      .eq("status", "completed")
      .neq("id", analysisId)
      .gte("created_at", new Date(Date.now() - 3600000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (cachedAnalysis) {
      const { data: cachedResult } = await supabase
        .from("analysis_results")
        .select("*")
        .eq("analysis_id", cachedAnalysis.id)
        .limit(1)
        .single();

      if (cachedResult) {
        console.log("Cache hit for", url);
        // Clone cached result to new analysis
        await supabase.from("analysis_results").insert({
          analysis_id: analysisId,
          scores: cachedResult.scores,
          quick_wins: cachedResult.quick_wins,
          tab_data: cachedResult.tab_data,
          modules: cachedResult.modules,
        });
        await supabase.from("analyses").update({ status: "completed" }).eq("id", analysisId);
        // Deduct credit
        await supabase.from("profiles").update({ credits: profile.credits - 1 }).eq("user_id", cd.user.id);
        clearTimeout(globalTimer);
        return new Response(JSON.stringify({ success: true, cached: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Performance timing
    const perfTiming: Record<string, number> = {};
    const tGlobalStart = Date.now();

    // Fetch API keys from system_settings (admin panel), fallback to env vars
    const { data: settingsData } = await supabase.from("system_settings").select("key_name, key_value");
    const dbKeys: Record<string, string> = {};
    for (const s of settingsData || []) { if (s.key_value) dbKeys[s.key_name] = s.key_value; }

    const OPENROUTER_API_KEY = dbKeys["openai_api_key"] || Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OpenRouter API key not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Define stages
    const stages: { name: string; status: "pending" | "running" | "done" | "error"; time: string }[] = [
      { name: "Content Fetch", status: "pending", time: "" },
      { name: "HTML Parse (Images & Anchors)", status: "pending", time: "" },
      ...(clusterMode ? [{ name: "Semantic Cluster", status: "pending" as const, time: "" }] : []),
      { name: "SERP & Competitors", status: "pending", time: "" },
      { name: "Competitor Fetch", status: "pending", time: "" },
      { name: "TF-IDF Engine", status: "pending", time: "" },
      { name: "Zipf's Law", status: "pending", time: "" },
      { name: "N-Grams & Topical Gap", status: "pending", time: "" },
      { name: "Technical Audit", status: "pending", time: "" },
      { name: "AI Analyst (GPT-4o)", status: "pending", time: "" },
      { name: "Save Results", status: "pending", time: "" },
    ];

    const setStage = async (idx: number, status: "running" | "done" | "error", time?: string) => {
      stages[idx] = { ...stages[idx], status, time: time || stages[idx].time };
      await updateProgress(supabase, analysisId, stages);
    };

    await supabase.from("analyses").update({ status: "running", progress: stages }).eq("id", analysisId);

    // ── Stage 0: Content Fetch ──
    await setStage(0, "running");
    console.log("Fetching:", url);
    const t0 = Date.now();
    const targetContent = await fetchPage(url);
    perfTiming.fetch_ms = Date.now() - t0;
    await setStage(0, targetContent ? "done" : "error", `${((Date.now() - t0) / 1000).toFixed(1)}s`);

    if (!targetContent) {
      await supabase.from("analyses").update({ status: "failed" }).eq("id", analysisId);
      return new Response(JSON.stringify({ error: "Failed to fetch page content" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Stage 1: HTML Parse (Images & Anchors) ──
    await setStage(1, "running");
    const tHtml = Date.now();
    console.log("Fetching raw HTML:", url);
    const rawHtml = await fetchRawHtml(url);
    let imagesData: any[] = [];
    let anchorsData: any[] = [];
    if (rawHtml) {
      imagesData = parseImages(rawHtml, url);
      anchorsData = parseAnchors(rawHtml, url);
      console.log(`Parsed ${imagesData.length} images, ${anchorsData.length} anchors`);
    }
    await setStage(1, "done", `${((Date.now() - tHtml) / 1000).toFixed(1)}s`);

    // Use a dynamic stage index counter since cluster mode adds an extra stage
    let si = 2;
    let competitorUrls: string[] = (manualComp || []).filter((c: string) => c.trim());
    const SERPER_KEY = dbKeys["serper_api_key"] || Deno.env.get("SERPER_API_KEY");

    // ── Cluster: Semantic Cluster collection ──
    let clusterData: { semanticCluster: string[]; relatedSearches: string[]; peopleAlsoAsk: string[]; competitorHeadings: string[] } | null = null;
    if (clusterMode) {
      await setStage(si, "running");
      const tCluster = Date.now();
      if (SERPER_KEY) {
        const titleMatch = targetContent.match(/^#\s+(.+)$/m);
        const keyword = titleMatch?.[1]?.slice(0, 100) || url;
        console.log("Cluster SERP keyword:", keyword);
        const cluster = await findClusterData(keyword, SERPER_KEY, region);
        const semanticCluster = [...new Set([...cluster.relatedSearches, ...cluster.peopleAlsoAsk])].slice(0, 30);
        clusterData = {
          semanticCluster,
          relatedSearches: cluster.relatedSearches,
          peopleAlsoAsk: cluster.peopleAlsoAsk,
          competitorHeadings: [],
        };
        if (competitorUrls.length === 0) {
          competitorUrls = cluster.competitors;
          try { competitorUrls = competitorUrls.filter(u => !u.includes(new URL(url).hostname)); } catch {}
        }
      }
      await setStage(si, "done", `${((Date.now() - tCluster) / 1000).toFixed(1)}s`);
      si++;
    }

    // ── SERP & Competitors ──
    await setStage(si, "running");
    const t1 = Date.now();

    if (competitorUrls.length === 0 && SERPER_KEY) {
      const titleMatch = targetContent.match(/^#\s+(.+)$/m);
      const keyword = titleMatch?.[1]?.slice(0, 100) || url;
      console.log("SERP keyword:", keyword);
      competitorUrls = await findCompetitors(keyword, SERPER_KEY, region);
      try { competitorUrls = competitorUrls.filter(u => !u.includes(new URL(url).hostname)); } catch {}
    }
    await setStage(si, "done", `${((Date.now() - t1) / 1000).toFixed(1)}s`);
    si++;

    // ── Competitor Fetch (markdown + raw HTML in parallel) ──
    await setStage(si, "running");
    const t2 = Date.now();
    const fetchUrls = competitorUrls.slice(0, 10);
    console.log(`Fetching ${fetchUrls.length} competitors in parallel (markdown + HTML)...`);
    const compContents: string[] = [];
    const compRawHtmls: string[] = [];
    const [compMdRes, compHtmlRes] = await Promise.all([
      Promise.allSettled(fetchUrls.map(u => fetchPage(u))),
      Promise.allSettled(fetchUrls.map(u => fetchRawHtml(u))),
    ]);
    for (const r of compMdRes) { compContents.push(r.status === "fulfilled" && r.value ? r.value : ''); }
    for (const r of compHtmlRes) { compRawHtmls.push(r.status === "fulfilled" && r.value ? r.value : ''); }
    perfTiming.competitor_fetch_ms = Date.now() - t2;
    await setStage(si, "done", `${((Date.now() - t2) / 1000).toFixed(1)}s`);
    si++;

    // Filter out empty competitor fetches
    const validCompContents = compContents.filter(c => c.length > 0);
    const validCompHtmls = compRawHtmls.filter(c => c.length > 0);

    // Extract competitor headings for cluster analysis
    if (clusterMode && clusterData) {
      const allHeadings: string[] = [];
      for (const content of validCompContents) {
        allHeadings.push(...extractHeadings(content));
      }
      const headingCounts: Record<string, number> = {};
      for (const h of allHeadings) {
        const normalized = h.toLowerCase().trim();
        headingCounts[normalized] = (headingCounts[normalized] || 0) + 1;
      }
      clusterData.competitorHeadings = Object.entries(headingCounts)
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([heading]) => heading);
    }

    // ── Detect language for Latin filtering ──
    const isRU = isRussianContent(targetContent);
    if (isRU) console.log("Detected RU content — Latin junk filter ACTIVE");

    // ── TF-IDF ──
    await setStage(si, "running");
    const t3 = Date.now();
    const targetWords = tokenize(targetContent, isRU);
    const compWordArrays = validCompContents.map(c => tokenize(c, isRU));
    const tfidfResults = calculateTFIDF(targetWords, compWordArrays);
    await setStage(si, "done", `${((Date.now() - t3) / 1000).toFixed(1)}s`);
    si++;

    // ── Zipf's Law ──
    await setStage(si, "running");
    const t4 = Date.now();
    const zipfData = calculateZipf(targetWords, isRU);
    await setStage(si, "done", `${((Date.now() - t4) / 1000).toFixed(1)}s`);
    si++;

    // ── N-Grams ──
    await setStage(si, "running");
    const t5 = Date.now();
    const bigrams = extractNgrams(targetWords, 2);
    const trigrams = extractNgrams(targetWords, 3);
    const bigramGaps = findTopicalGaps(targetWords, compWordArrays, 2);
    const trigramGaps = findTopicalGaps(targetWords, compWordArrays, 3);
    await setStage(si, "done", `${((Date.now() - t5) / 1000).toFixed(1)}s`);
    si++;

    // ── Technical Audit ──
    await setStage(si, "running");
    const t6 = Date.now();
    const audit = technicalAudit(rawHtml, targetContent);

    // ── New On-Page modules (computed in parallel, same stage) ──
    const readabilityData = calculateReadability(targetContent, isRU);
    const headingHierarchy = parseHeadingHierarchy(rawHtml);
    const metaDirectives = parseMetaDirectives(rawHtml);
    const urlStructure = analyzeUrlStructure(url);
    const contentFreshness = parseContentFreshness(rawHtml);
    const schemaValidation = validateSchemaMarkup(rawHtml, pageType || 'homepage');
    const contentMetrics = calculateContentMetrics(rawHtml, targetContent, targetWords);
    const internalLinking = calculateInternalLinkingScore(anchorsData, url);
    const snippetPreview = buildSnippetPreview(audit, url);

    // ── Competitor Comparison Metrics ──
    const compMetrics = validCompHtmls.map((cHtml, idx) => {
      const cHeadings = parseHeadingHierarchy(cHtml);
      const cImages = parseImages(cHtml, fetchUrls[idx] || '');
      const cSchema = validateSchemaMarkup(cHtml, pageType || 'homepage');
      const cWords = compWordArrays[idx]?.length || 0;
      const cBodyMatch = cHtml.match(/<body[\s>]([\s\S]*)<\/body>/i);
      const cBody = cBodyMatch ? cBodyMatch[1] : cHtml;
      const cParagraphs = (cBody.match(/<p[\s>]/gi) || []).length;
      const cUl = (cBody.match(/<ul[\s>]/gi) || []).length;
      const cOl = (cBody.match(/<ol[\s>]/gi) || []).length;
      const cTables = (cBody.match(/<table[\s>]/gi) || []).length;
      const cVideos = (cBody.match(/<video[\s>]|<iframe[^>]*(?:youtube|vimeo|rutube)/gi) || []).length;
      return {
        url: fetchUrls[idx] || '',
        wordCount: cWords,
        headingCount: cHeadings.headings.length,
        h1Count: cHeadings.counts.h1,
        h2Count: cHeadings.counts.h2,
        h3Count: cHeadings.counts.h3,
        imageCount: cImages.length,
        imagesWithoutAlt: cImages.filter(img => !img.hasAlt).length,
        schemaCount: cSchema.totalSchemas,
        schemaTypes: cSchema.schemas.map(s => s.type),
        paragraphs: cParagraphs,
        lists: cUl + cOl,
        tables: cTables,
        videos: cVideos,
      };
    });

    const medianOf = (arr: number[]) => {
      const valid = arr.filter(n => n > 0);
      if (!valid.length) return 0;
      const s = valid.slice().sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
    };

    const competitorComparison = {
      competitors: compMetrics,
      medians: {
        wordCount: medianOf(compMetrics.map(c => c.wordCount)),
        headingCount: medianOf(compMetrics.map(c => c.headingCount)),
        h2Count: medianOf(compMetrics.map(c => c.h2Count)),
        h3Count: medianOf(compMetrics.map(c => c.h3Count)),
        imageCount: medianOf(compMetrics.map(c => c.imageCount)),
        schemaCount: medianOf(compMetrics.map(c => c.schemaCount)),
        paragraphs: medianOf(compMetrics.map(c => c.paragraphs)),
        lists: medianOf(compMetrics.map(c => c.lists)),
        tables: medianOf(compMetrics.map(c => c.tables)),
        videos: medianOf(compMetrics.map(c => c.videos)),
      },
      yours: {
        wordCount: targetWords.length,
        headingCount: headingHierarchy.headings.length,
        h2Count: headingHierarchy.counts.h2,
        h3Count: headingHierarchy.counts.h3,
        imageCount: imagesData.length,
        schemaCount: schemaValidation.totalSchemas,
        paragraphs: contentMetrics.paragraphs,
        lists: contentMetrics.ulCount + contentMetrics.olCount,
        tables: contentMetrics.tables,
        videos: contentMetrics.videos,
      },
    };

    console.log(`On-Page modules: readability=${readabilityData.score}, urlScore=${urlStructure.score}, schemas=${schemaValidation.totalSchemas}, headings=${headingHierarchy.headings.length}`);
    console.log(`Competitor comparison: ${compMetrics.length} competitors analyzed, median wordCount=${competitorComparison.medians.wordCount}`);
    await setStage(si, "done", `${((Date.now() - t6) / 1000).toFixed(1)}s`);
    si++;

    // ── AI Analyst ──
    await setStage(si, "running");
    const t7 = Date.now();

    const missingTerms = tfidfResults.filter((t: any) => t.status === "Missing").slice(0, 20)
      .map((t: any) => `${t.term} (IDF:${t.idf.toFixed(2)})`).join(", ");
    const spamTerms = tfidfResults.filter((t: any) => t.status === "Spam").slice(0, 10)
      .map((t: any) => `${t.term} (density:${t.density.toFixed(2)}%)`).join(", ");

    // Build system prompt — different for cluster mode
    let systemPrompt: string;
    let userPrompt: string;
    const regionContext = region ? `\n\nРЕГИОН АНАЛИЗА: ${region}. Проводи анализ с учётом локации "${region}". Проверь наличие локальных сущностей (адреса, телефоны с кодом города, упоминание районов) у конкурентов в этом регионе. GEO Score должен учитывать оптимизацию под этот регион (карта, локальные ключи, микроразметка LocalBusiness). Если у конкурентов есть локальная привязка, а у пользователя нет — помечай как критическую ошибку P1.\n` : '';

    if (clusterMode && clusterData) {
      systemPrompt = `Ты — Senior SEO Architect по методологии "Доказательное SEO 2026", эксперт по тематическому проектированию (Topic Authority). Тебе дан основной запрос и список смежных фраз (семантический кластер).${regionContext}

ПРАВИЛА ДОКАЗАТЕЛЬНОГО SEO 2026 (ВЫСШИЙ ПРИОРИТЕТ):

1. CONTENT EFFORT: Оцени, насколько сложно было создать контент. Ищи оригинальные исследования, таблицы, инструкции, экспертные цитаты. Если рерайт — требуй блок "Личный опыт".
2. INFORMATION GAIN: Сравни сущности с ТОП-3 конкурентами. Найди минимум 3 факта/подтемы, которые конкуренты упустили.
3. SEMANTIC CHUNKING: Один H1, строгая H2→H3. Каждый абзац = концентрированный ответ для Passage Indexing и AI Overviews.
4. NAVBOOST: Первые 200 знаков = прямой ответ на интент. Удаляй "В современном мире", "Ни для кого не секрет" — P1 ошибка.
5. QBST: Проверяй Salient Terms (термины выраженности сущности). Без них Google считает текст поверхностным.

Задачи:
1. Проанализируй текст на «полноту раскрытия темы» с учётом Content Effort и Information Gain.
2. Найди «информационные дыры» — подтемы из кластера, которые пользователь не упомянул.
3. Сформируй «Semantic Map» — 5-7 обязательных H2 для E-E-A-T.
4. Оцени «Topic Coverage Score» от 0 до 100%.

Верни JSON:
{
  "scores": { "seoHealth": <0-100>, "llmFriendly": <0-100>, "humanTouch": <0-100>, "sgeAdapt": <0-100> },
  "quickWins": [{"text": "<рекомендация>"}],
  "aiReport": {
    "summary": "<2-3 абзаца с учётом кластерного анализа>",
    "strengths": ["..."], "weaknesses": ["..."], "recommendations": ["..."],
    "missingEntities": ["<LSI-сущности + Salient Terms>"],
    "geoScore": <0-100>,
    "sgeReadiness": "<оценка>",
    "contentEffort": "<low|medium|high>",
    "informationGain": ["<3+ уникальных фактов>"],
    "navboostIssues": ["<проблемы Lede-абзаца>"]
  },
  "priorities": [{"task": "<задача>", "impact": <1-10>, "effort": <1-10>, "category": "<Technical|Content|Links>"}],
  "blueprint": {
    "h1": "<H1>", "metaTitle": "<title>", "metaDescription": "<desc>",
    "sections": [{"tag": "h2|h3", "text": "<заголовок>", "wordCount": <число>}],
    "requiredBlocks": ["FAQ", "Отзывы", "Цены"]
  },
  "clusterAnalysis": {
    "topicCoverageScore": <0-100>,
    "semanticMap": [{"heading": "<H2 заголовок>", "description": "<зачем нужен>", "present": <true|false>}],
    "informationGaps": ["<подтема, которой нет на странице>"],
    "coveredTopics": ["<подтема, которая уже раскрыта>"],
    "suggestedFaqQuestions": ["<вопросы из People Also Ask для FAQ блока>"]
  },
  "implementationPlan": [
    {
      "priority": "P1|P2|P3",
      "title": "<Конкретное действие>",
      "where": "<Где именно на странице>",
      "action": "<Что конкретно сделать>",
      "expectedResult": "<Ожидаемый результат>",
      "rule": "<Content Effort|Information Gain|Semantic Chunking|NavBoost|QBST|Technical>",
      "weight": <1-10>
    }
  ]
}
P1 = Критично (техошибки, NavBoost нарушения, Content Effort = low, Missing Entities). P2 = Важно (структура, переспам, Semantic Chunking). P3 = Лидерство (таблицы, FAQ, GEO, Information Gain).
Используй формулировки: "Согласно фактору Content Effort...", "Для Information Gain внедрите...". Минимум 8-15 задач.
КРИТИЧНО: Программный парсер уже посчитал все теги. НИКОГДА не пересчитывай — доверяй ТОЛЬКО входным данным парсера.
ФИЛЬТР ЛАТИНИЦЫ: Если контент на русском языке, ЗАПРЕЩЕНО рекомендовать слова на латинице в missingEntities, quickWins, recommendations, informationGain. Исключения: официальные бренды (Apple, Bosch), стандарты (ISO, DIN, ГОСТ), аббревиатуры (SEO, API). Транслит (vybora, novosti, tovar) — ЗАПРЕЩЁН. Все рекомендации — только на кириллице.
Будь конкретен. Пиши на русском.`;

      userPrompt = `URL: ${url}\nТип: ${pageType || "не указан"}\n${aiContext ? `Контекст: ${aiContext}\n` : ""}
─── Контент (15k) ───\n${targetContent.slice(0, 15000)}
─── Семантический кластер (${clusterData.semanticCluster.length} фраз) ───\n${clusterData.semanticCluster.join("\n")}
─── People Also Ask ───\n${clusterData.peopleAlsoAsk.join("\n") || "нет"}
─── Частые заголовки H2-H3 у конкурентов ───\n${clusterData.competitorHeadings.join("\n") || "нет"}
─── Missing Entities ───\n${missingTerms || "нет"}
─── Spam Terms ───\n${spamTerms || "нет"}
─── Topical Gaps ───\n${bigramGaps.slice(0, 10).map((g: any) => `"${g.text}" (${g.competitorCount} конк.)`).join(", ") || "нет"}
─── Техаудит (ПРОГРАММНЫЙ ПАРСЕР — доверяй только этим данным, НЕ пересчитывай теги!) ───
H1 видимых: ${audit.h1Count}${audit.h1Tags.length ? `\nТексты H1: ${audit.h1Tags.map((t: string, i: number) => `#${i + 1}: "${t}"`).join(', ')}` : ''}${audit.h1Hidden.length ? `\nСкрытых H1: ${audit.h1Hidden.map((t: string) => `"${t}"`).join(', ')}` : ''}
Изображений в body: ${audit.totalImages}, без alt: ${audit.imagesWithoutAlt}
JSON-LD: ${audit.hasJsonLd ? "Есть" : "Нет"}, og:title: ${audit.hasOgTitle ? "Есть" : "Нет"}, og:description: ${audit.hasOgDesc ? "Есть" : "Нет"}, og:image: ${audit.hasOgImage ? "Есть" : "Нет"}
Meta title: ${audit.metaTitle ? `"${audit.metaTitle}"` : "Нет"}, Meta desc: ${audit.metaDesc ? `"${audit.metaDesc.slice(0, 100)}..."` : "Нет"}, Canonical: ${audit.canonical || "Нет"}
Проблемы: ${audit.issues.join("; ") || "нет"}
Конкурентов: ${compContents.length}`;
    } else {
      systemPrompt = `Ты — Senior SEO Architect, работающий по методологии "Доказательное SEO 2026".${regionContext} Данные:
1. Markdown страницы (до 15000 символов)
2. TF-IDF: Missing Entities, Spam Terms
3. Topical Gaps (N-gram сравнение с конкурентами)
4. Технический аудит

ПРАВИЛА ДОКАЗАТЕЛЬНОГО SEO 2026 (ВЫСШИЙ ПРИОРИТЕТ P1):

1. CONTENT EFFORT (Уровень усилия):
   - Оцени сложность создания контента: наличие оригинальных исследований, сложных HTML-таблиц, пошаговых инструкций, экспертных цитат.
   - Если текст похож на стандартный рерайт — требуй блок "Личный опыт" или "Технические нюансы".
   - Добавь в implementationPlan: "Согласно фактору Content Effort, добавьте [конкретное действие]".

2. INFORMATION GAIN (Добавочная ценность):
   - Сравни сущности (Entities) пользователя с ТОП конкурентами.
   - Найди минимум 3 факта или подтемы, которые конкуренты упустили — внеси в aiReport.missingEntities и implementationPlan.
   - Без Information Gain оптимизация считается неуспешной.

3. SEMANTIC CHUNKING (Архитектура):
   - Один H1. Строгая иерархия H2 → H3 без пропусков.
   - Каждый абзац под заголовком = "концентрированный ответ", пригодный для Passage Indexing и AI Overviews (SGE).
   - Запрещены длинные вступления. Если найдены — P1 задача.

4. NAVBOOST (Поведенческие):
   - Lede-абзац: первые 200 знаков ОБЯЗАНЫ содержать прямой ответ на главный интент.
   - Фразы-паразиты ("В современном мире", "Ни для кого не секрет", "Как известно") — P1 ошибка, требуй замену на конкретные данные.

5. QBST — СЕМАНТИЧЕСКАЯ ПЛОТНОСТЬ:
   - Проверяй не просто ключи, а Salient Terms (термины выраженности сущности).
   - Пример: страница про "Солярий" ОБЯЗАНА содержать "фототип", "инсоляция", "эритемная лампа", "меланин". Без них Google сочтёт текст поверхностным.
   - Добавляй такие термины в missingEntities.

6. ФОРМАТ implementationPlan:
   - Используй формулировки: "Согласно фактору Content Effort, добавьте таблицу сравнения...", "Для Information Gain внедрите описание технологии X, которой нет у конкурентов".
   - Каждая задача P1 должна ссылаться на конкретное правило Доказательного SEO.

Верни JSON:
{
  "scores": { "seoHealth": <0-100>, "llmFriendly": <0-100>, "humanTouch": <0-100>, "sgeAdapt": <0-100> },
  "quickWins": [{"text": "<рекомендация>"}],
  "aiReport": {
    "summary": "<2-3 абзаца>",
    "strengths": ["..."], "weaknesses": ["..."], "recommendations": ["..."],
    "missingEntities": ["<10 LSI-сущностей + Salient Terms, критичных для ниши, но отсутствующих>"],
    "geoScore": <0-100>,
    "sgeReadiness": "<оценка готовности к AI Overviews>",
    "contentEffort": "<low|medium|high — оценка уровня усилия>",
    "informationGain": ["<3+ фактов/подтем, которых нет у конкурентов>"],
    "navboostIssues": ["<проблемы Lede-абзаца и фразы-паразиты>"]
  },
  "priorities": [{"task": "<задача>", "impact": <1-10>, "effort": <1-10>, "category": "<Technical|Content|Links>"}],
  "blueprint": {
    "h1": "<H1>", "metaTitle": "<title>", "metaDescription": "<desc>",
    "sections": [{"tag": "h2|h3", "text": "<заголовок>", "wordCount": <число>}],
    "requiredBlocks": ["FAQ", "Отзывы", "Цены"]
  },
  "implementationPlan": [
    {
      "priority": "P1|P2|P3",
      "title": "<Конкретное действие>",
      "where": "<Где именно на странице>",
      "action": "<Что конкретно сделать>",
      "expectedResult": "<Ожидаемый результат>",
      "rule": "<Content Effort|Information Gain|Semantic Chunking|NavBoost|QBST|Technical>",
      "weight": <1-10>
    }
  ]
}
P1 = Критично (техошибки, пустые Alt, Missing Entities, NavBoost нарушения, Content Effort = low). P2 = Важно для роста (структура, переспам, Semantic Chunking). P3 = Для лидерства (таблицы, FAQ, GEO, Information Gain).
Будь хирургически точен в implementationPlan: пиши 'Замени А на Б', 'Добавь 3 картинки с Alt такими-то'. Избегай общих фраз. Минимум 8-15 задач.
КРИТИЧНО: Программный парсер уже посчитал все теги (H1, img, JSON-LD, OG). НИКОГДА не пересчитывай их сам — доверяй ТОЛЬКО входным данным парсера.
ФИЛЬТР ЛАТИНИЦЫ: Если контент на русском языке, ЗАПРЕЩЕНО рекомендовать слова на латинице в missingEntities, quickWins, recommendations, informationGain. Исключения: официальные бренды (Apple, Bosch), стандарты (ISO, DIN, ГОСТ), аббревиатуры (SEO, API). Транслит (vybora, novosti, tovar) — ЗАПРЕЩЁН. Все рекомендации — только на кириллице.
Будь конкретен. Пиши на русском.`;

      userPrompt = `URL: ${url}\nТип: ${pageType || "не указан"}\n${aiContext ? `Контекст: ${aiContext}\n` : ""}
─── Контент (15k) ───\n${targetContent.slice(0, 15000)}
─── Missing Entities ───\n${missingTerms || "нет"}
─── Spam Terms ───\n${spamTerms || "нет"}
─── Topical Gaps (биграммы у конкурентов, нет у вас) ───\n${bigramGaps.slice(0, 10).map((g: any) => `"${g.text}" (${g.competitorCount} конк.)`).join(", ") || "нет"}
─── Техаудит (ПРОГРАММНЫЙ ПАРСЕР — доверяй только этим данным, НЕ пересчитывай теги!) ───
H1 видимых: ${audit.h1Count}${audit.h1Tags.length ? `\nТексты H1: ${audit.h1Tags.map((t: string, i: number) => `#${i + 1}: "${t}"`).join(', ')}` : ''}${audit.h1Hidden.length ? `\nСкрытых H1: ${audit.h1Hidden.map((t: string) => `"${t}"`).join(', ')}` : ''}
Изображений в body: ${audit.totalImages}, без alt: ${audit.imagesWithoutAlt}
JSON-LD: ${audit.hasJsonLd ? "Есть" : "Нет"}, og:title: ${audit.hasOgTitle ? "Есть" : "Нет"}, og:description: ${audit.hasOgDesc ? "Есть" : "Нет"}, og:image: ${audit.hasOgImage ? "Есть" : "Нет"}
Meta title: ${audit.metaTitle ? `"${audit.metaTitle}"` : "Нет"}, Meta desc: ${audit.metaDesc ? `"${audit.metaDesc.slice(0, 100)}..."` : "Нет"}, Canonical: ${audit.canonical || "Нет"}
Проблемы: ${audit.issues.join("; ") || "нет"}
Конкурентов: ${compContents.length}`;
    }

    console.log("Calling OpenRouter...");
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "" },
      body: JSON.stringify({
        model: "openai/gpt-4o", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" }, temperature: 0.3,
      }),
    });

    let aiParsed: any = {};
    if (aiRes.ok) {
      const j = await aiRes.json();
      const c = j.choices?.[0]?.message?.content;
      if (c) { try { aiParsed = JSON.parse(c); } catch { console.error("AI JSON parse fail"); } }
    } else { console.error("OpenRouter error:", aiRes.status, await aiRes.text()); }
    perfTiming.ai_ms = Date.now() - t7;
    await setStage(si, aiParsed.scores ? "done" : "error", `${((Date.now() - t7) / 1000).toFixed(1)}s`);
    si++;

    // ── Save ──
    await setStage(si, "running");

    const moduleStatuses = stages.map(s => ({ name: s.name, time: s.time, done: s.status === "done" }));

    // ── Compute page stats for before/after verification ──
    const targetH2Count = (targetContent.match(/^## /gm) || []).length;
    const targetH3Count = (targetContent.match(/^### /gm) || []).length;
    const targetWordCount = targetWords.length;
    const targetImgCount = imagesData.length;
    const targetLinkCount = anchorsData.length;

    // Competitor medians
    const compH2Counts = compContents.map(c => (c.match(/^## /gm) || []).length);
    const compWordCounts = compWordArrays.map(w => w.length);
    const medianFn = (arr: number[]) => {
      if (!arr.length) return 0;
      const s = arr.slice().sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
    };

    const pageStats = {
      target: { wordCount: targetWordCount, h2Count: targetH2Count, h3Count: targetH3Count, imgCount: targetImgCount, linkCount: targetLinkCount },
      competitorMedian: { wordCount: medianFn(compWordCounts), h2Count: medianFn(compH2Counts) },
    };

    // ── Competitor sources data (URL + snippet of content for transparency) ──
    const sourcesData = fetchUrls.map((u, i) => ({
      url: u,
      fetched: !!compContents[i],
      contentPreview: compContents[i]?.slice(0, 500) || '',
      rawContent: compContents[i]?.slice(0, 15000) || '',
      wordCount: compWordArrays[i]?.length || 0,
    }));

    const finalResult = {
      scores: aiParsed.scores || { seoHealth: 50, llmFriendly: 50, humanTouch: 50, sgeAdapt: 50 },
      quick_wins: aiParsed.quickWins || [],
      tab_data: {
        aiReport: aiParsed.aiReport || {},
        priorities: aiParsed.priorities || [],
        blueprint: aiParsed.blueprint || {},
        implementationPlan: aiParsed.implementationPlan || [],
        tfidf: tfidfResults,
        ngrams: { bigrams, trigrams, bigramGaps, trigramGaps },
        zipf: zipfData,
        technicalAudit: audit,
        readability: readabilityData,
        headingHierarchy,
        metaDirectives,
        urlStructure,
        contentFreshness,
        schemaValidation,
        contentMetrics,
        internalLinking,
        snippetPreview,
        competitorComparison,
        imagesData,
        anchorsData,
        competitorUrls: competitorUrls.slice(0, 10),
        competitorCount: validCompContents.length,
        sourcesData,
        pageStats,
        perfTiming: { ...perfTiming, total_ms: Date.now() - tGlobalStart },
        ...(clusterMode && clusterData ? {
          clusterData: {
            semanticCluster: clusterData.semanticCluster,
            relatedSearches: clusterData.relatedSearches,
            peopleAlsoAsk: clusterData.peopleAlsoAsk,
            competitorHeadings: clusterData.competitorHeadings,
            clusterAnalysis: aiParsed.clusterAnalysis || null,
          },
        } : {}),
      },
      modules: moduleStatuses,
    };

    const { error: insertErr } = await supabase.from("analysis_results").insert({
      analysis_id: analysisId, scores: finalResult.scores,
      quick_wins: finalResult.quick_wins, tab_data: finalResult.tab_data, modules: finalResult.modules,
    });

    if (insertErr) {
      console.error("Save error:", insertErr);
      await setStage(si, "error");
      await supabase.from("analyses").update({ status: "failed" }).eq("id", analysisId);
      clearTimeout(globalTimer);
      return new Response(JSON.stringify({ error: "Failed to save" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Deduct 1 credit server-side
    await supabase.from("profiles").update({ credits: Math.max(0, profile.credits - 1) }).eq("user_id", cd.user.id);

    await setStage(si, "done", "0.1s");
    await supabase.from("analyses").update({ status: "completed" }).eq("id", analysisId);

    // Create notification for user
    try {
      await supabase.from("notifications").insert({
        user_id: cd.user.id,
        type: "analysis_complete",
        title: `Анализ завершён: ${new URL(url).hostname}`,
        message: `SEO Health: ${finalResult.scores?.seoHealth || 0}% | Total: ${((Date.now() - tGlobalStart) / 1000).toFixed(1)}s`,
        metadata: { analysis_id: analysisId, url },
      });
    } catch (notifErr) {
      console.warn("Notification insert failed:", notifErr);
    }

    // Check low credits and notify
    const newCredits = Math.max(0, profile.credits - 1);
    if (newCredits <= 2 && newCredits >= 0) {
      try {
        await supabase.from("notifications").insert({
          user_id: cd.user.id,
          type: "credits_low",
          title: newCredits === 0 ? "Кредиты закончились!" : `Осталось кредитов: ${newCredits}`,
          message: "Обратитесь к администратору для пополнения.",
        });
      } catch (_) {}
    }

    console.log("Done:", url, `Total: ${((Date.now() - tGlobalStart) / 1000).toFixed(1)}s`);

    clearTimeout(globalTimer);
    return new Response(JSON.stringify({ success: true, data: finalResult }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    clearTimeout(globalTimer);
    console.error("seo-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
