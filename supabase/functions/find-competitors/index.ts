import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/dist/module/lib/constants.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BLOCKED_DOMAINS = [
  "facebook.com", "fb.com", "vk.com", "vkontakte.ru",
  "instagram.com", "twitter.com", "x.com", "pinterest.com",
  "youtube.com", "youtu.be", "tiktok.com", "linkedin.com",
  "reddit.com", "t.me", "telegram.me", "ok.ru",
  "wikipedia.org", "wikimedia.org",
];

function isBlocked(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_DOMAINS.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return true;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { url, query } = await req.json();
    const serperKey = Deno.env.get("SERPER_API_KEY");
    if (!serperKey) {
      return new Response(JSON.stringify({ error: "SERPER_API_KEY not configured" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Determine search query: use provided query, or extract from URL
    let searchQuery = query?.trim();
    if (!searchQuery && url) {
      // Fetch page title via Jina
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
          headers: { Accept: "text/plain" },
        });
        const text = await jinaRes.text();
        // Extract title from first line (Jina format: "Title: ...")
        const titleMatch = text.match(/^Title:\s*(.+)/m);
        searchQuery = titleMatch?.[1]?.trim() || extractDomain(url);
      } catch {
        searchQuery = extractDomain(url);
      }
    }

    if (!searchQuery) {
      return new Response(JSON.stringify({ error: "No URL or query provided" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const sourceDomain = url ? extractDomain(url) : "";

    // Call Serper.dev
    const serperRes = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: searchQuery, num: 20, gl: "ru", hl: "ru" }),
    });

    if (!serperRes.ok) {
      const errText = await serperRes.text();
      return new Response(JSON.stringify({ error: `Serper error: ${errText}` }), {
        status: 502, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const serperData = await serperRes.json();
    const organic = serperData.organic || [];

    // Filter: remove blocked domains, ads, and the source domain itself
    const competitors: { url: string; title: string; domain: string }[] = [];
    const seenDomains = new Set<string>();
    if (sourceDomain) seenDomains.add(sourceDomain);

    for (const item of organic) {
      if (competitors.length >= 10) break;
      const itemUrl = item.link || item.url;
      if (!itemUrl) continue;
      if (isBlocked(itemUrl)) continue;

      const domain = extractDomain(itemUrl);
      if (!domain || seenDomains.has(domain)) continue;
      seenDomains.add(domain);

      competitors.push({
        url: itemUrl,
        title: item.title || domain,
        domain,
      });
    }

    return new Response(JSON.stringify({ query: searchQuery, competitors }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
