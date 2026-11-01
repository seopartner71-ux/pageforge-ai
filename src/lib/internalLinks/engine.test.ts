import { describe, it, expect } from 'vitest';
import { runAudit, pagerank, norm } from './engine';

const page = (path: string, code = 200) => ({ Address: `https://Site.ru${path}`, 'Content Type': 'text/html', 'Status Code': code, 'Title 1': path, 'H1-1': path });
const link = (s: string, d: string, extra: Record<string, unknown> = {}) => ({ Type: 'Hyperlink', Source: `https://site.ru${s}`, Destination: `https://site.ru${d}`, Anchor: 'текст', 'Alt Text': null, 'Link Position': 'Content', 'Status Code': 200, Follow: true, ...extra });

describe('аудит перелинковки', () => {
  it('нормализует URL: хост в нижнем регистре, без якоря', () => {
    expect(norm('https://Site.RU/a/#x')).toBe('https://site.ru/a/');
    expect(norm('https://site.ru')).toBe('https://site.ru/');
  });

  it('PageRank нормирован: среднее по сайту = 1', () => {
    const pr = pagerank(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]);
    const vals = [...pr.values()];
    expect(vals.reduce((x, y) => x + y, 0) / vals.length).toBeCloseTo(1, 6);
  });

  it('сирота — страница без входящих, кроме главной', () => {
    const r = runAudit({ internal: [page('/'), page('/a/'), page('/lonely/')], inlinks: [link('/', '/a/')], rules: [] });
    expect(r.orphans.map((o) => o.url)).toEqual(['https://site.ru/lonely/']);
  });

  it('анкор с датой и картинка без текста — шаблонные, не «из текста»', () => {
    const r = runAudit({
      internal: [page('/'), page('/a/'), page('/b/')],
      inlinks: [link('/', '/a/', { Anchor: '06 Окт 2026 Новость' }), link('/', '/b/', { Anchor: '', 'Alt Text': 'фото' })],
      rules: [],
    });
    expect(r.pages.find((p) => p.url.endsWith('/a/'))!.in_text).toBe(0);
    expect(r.pages.find((p) => p.url.endsWith('/b/'))!.in_text).toBe(0);
    expect(r.summary.templateLinks).toBe(2);
  });

  it('битые и редиректы считаются только для внутреннего хоста', () => {
    const r = runAudit({
      internal: [page('/'), page('/a/')],
      inlinks: [link('/', '/old/', { 'Status Code': 301 }), link('/', '/gone/', { 'Status Code': 404 }),
        { ...link('/', '/x/', { 'Status Code': 404 }), Destination: 'https://other.ru/x/' }],
      rules: [],
    });
    expect(r.redirects.map((g) => g.dst)).toEqual(['https://site.ru/old/']);
    expect(r.broken.map((g) => g.dst)).toEqual(['https://site.ru/gone/']);
  });

  it('nofollow-ссылки не попадают в граф', () => {
    const r = runAudit({ internal: [page('/'), page('/a/')], inlinks: [link('/', '/a/', { Follow: false })], rules: [] });
    expect(r.pages.find((p) => p.url.endsWith('/a/'))!.in_all).toBe(0);
  });

  it('нет обязательной колонки — понятная ошибка с её названием', () => {
    expect(() => runAudit({ internal: [{ URL: 'x' }], inlinks: [], rules: [] })).toThrow('Address');
  });
});
