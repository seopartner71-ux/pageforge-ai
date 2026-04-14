const RAW_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function normalizeOrigin(value?: string) {
  return value?.replace(/\/$/, '') || '';
}

export const BACKEND_ORIGIN = normalizeOrigin(RAW_SUPABASE_URL);
export const SAME_ORIGIN_BACKEND_PREFIX = '/backend';

export function toBackendProxyUrl(input: string): string {
  if (!input || !BACKEND_ORIGIN) return input;

  const normalizedInput = input.startsWith(BACKEND_ORIGIN)
    ? input
    : input.replace(BACKEND_ORIGIN.replace(/^https?:/, ''), BACKEND_ORIGIN);

  if (!normalizedInput.startsWith(BACKEND_ORIGIN)) return input;

  const path = normalizedInput.slice(BACKEND_ORIGIN.length);
  return `${SAME_ORIGIN_BACKEND_PREFIX}${path}`;
}

export function patchFetchForBackendProxy() {
  if (typeof window === 'undefined' || !(window.location.hostname === 'audit.seo-modul.pro' || window.location.hostname.endsWith('.seo-modul.pro'))) {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    const proxiedUrl = toBackendProxyUrl(rawUrl);

    if (proxiedUrl === rawUrl) {
      return originalFetch(input as any, init);
    }

    if (typeof input === 'string' || input instanceof URL) {
      return originalFetch(proxiedUrl, init);
    }

    const proxiedRequest = new Request(proxiedUrl, input);
    return originalFetch(proxiedRequest, init);
  };
}

export function rewritePublicStorageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return toBackendProxyUrl(url);
}
