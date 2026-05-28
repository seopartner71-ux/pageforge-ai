// Canvas-based chart renderers that produce PNG Uint8Array for embedding into DOCX via ImageRun.
// No external chart deps — keeps bundle small and rendering deterministic.

const PALETTE = [
  '#2E75B6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#EC4899', '#6B7280',
  '#84CC16', '#F97316', '#0EA5E9', '#A855F7',
];

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('canvas.toBlob failed'));
      const buf = await blob.arrayBuffer();
      resolve(new Uint8Array(buf));
    }, 'image/png');
  });
}

function setupCanvas(width: number, height: number, dpr = 2) {
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'middle';
  (ctx as any).font = '12px Arial, sans-serif';
  return { canvas, ctx };
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid + 1;
    else hi = mid;
  }
  return text.slice(0, Math.max(1, lo - 1)) + '…';
}

export interface HBarItem { label: string; value: number; color?: string }

/** Horizontal bar chart (good for top-N keyword/domain lists). */
export async function renderHBarChartPng(
  items: HBarItem[],
  opts: { width?: number; height?: number; title?: string; valueSuffix?: string } = {},
): Promise<Uint8Array> {
  const width = opts.width ?? 900;
  const rowH = 26;
  const padTop = opts.title ? 44 : 16;
  const padBottom = 16;
  const height = opts.height ?? padTop + padBottom + items.length * rowH;
  const { canvas, ctx } = setupCanvas(width, height);

  if (opts.title) {
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillText(opts.title, 16, 22);
  }

  const labelW = 220;
  const valueW = 60;
  const chartX = 16 + labelW + 8;
  const chartW = width - chartX - valueW - 16;
  const max = Math.max(1, ...items.map((i) => i.value));

  ctx.font = '12px Arial, sans-serif';
  items.forEach((it, i) => {
    const y = padTop + i * rowH;
    const barH = rowH - 10;
    const barW = Math.max(2, (it.value / max) * chartW);

    ctx.fillStyle = '#374151';
    ctx.textAlign = 'left';
    ctx.fillText(truncate(ctx, it.label, labelW), 16, y + barH / 2 + 1);

    // track
    ctx.fillStyle = '#F3F4F6';
    ctx.fillRect(chartX, y, chartW, barH);
    // bar
    ctx.fillStyle = it.color || PALETTE[i % PALETTE.length];
    ctx.fillRect(chartX, y, barW, barH);

    ctx.fillStyle = '#1F2937';
    ctx.textAlign = 'right';
    ctx.fillText(`${it.value.toLocaleString('ru-RU')}${opts.valueSuffix || ''}`, width - 16, y + barH / 2 + 1);
  });

  return canvasToPngBytes(canvas);
}

export interface DonutSlice { label: string; value: number; color?: string }

/** Donut chart with right-side legend. */
export async function renderDonutChartPng(
  slices: DonutSlice[],
  opts: { width?: number; height?: number; title?: string } = {},
): Promise<Uint8Array> {
  const width = opts.width ?? 720;
  const height = opts.height ?? 360;
  const { canvas, ctx } = setupCanvas(width, height);

  if (opts.title) {
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(opts.title, 16, 22);
  }

  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const cy = (opts.title ? 36 : 16) + (height - (opts.title ? 36 : 16) - 16) / 2;
  const cx = 170;
  const rOuter = 130;
  const rInner = 72;

  let start = -Math.PI / 2;
  slices.forEach((s, i) => {
    const angle = (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.fillStyle = s.color || PALETTE[i % PALETTE.length];
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rOuter, start, start + angle);
    ctx.closePath();
    ctx.fill();
    start += angle;
  });
  // inner hole
  ctx.beginPath();
  ctx.fillStyle = '#FFFFFF';
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.fill();

  // center total
  ctx.fillStyle = '#1F2937';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText(total.toLocaleString('ru-RU'), cx, cy - 4);
  ctx.fillStyle = '#6B7280';
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText('всего', cx, cy + 14);

  // legend
  const legendX = cx + rOuter + 32;
  const legendY = (opts.title ? 44 : 16);
  const lh = 22;
  ctx.textAlign = 'left';
  ctx.font = '12px Arial, sans-serif';
  slices.forEach((s, i) => {
    const y = legendY + i * lh;
    ctx.fillStyle = s.color || PALETTE[i % PALETTE.length];
    ctx.fillRect(legendX, y, 12, 12);
    const pct = Math.round((s.value / total) * 100);
    ctx.fillStyle = '#1F2937';
    const label = truncate(ctx, s.label, width - legendX - 90);
    ctx.fillText(label, legendX + 18, y + 6);
    ctx.fillStyle = '#6B7280';
    ctx.textAlign = 'right';
    ctx.fillText(`${s.value} · ${pct}%`, width - 16, y + 6);
    ctx.textAlign = 'left';
  });

  return canvasToPngBytes(canvas);
}

/** Vertical grouped progress bars — used for per-model SOM. */
export async function renderVBarChartPng(
  items: HBarItem[],
  opts: { width?: number; height?: number; title?: string; maxValue?: number; valueSuffix?: string } = {},
): Promise<Uint8Array> {
  const width = opts.width ?? 900;
  const height = opts.height ?? 320;
  const { canvas, ctx } = setupCanvas(width, height);

  if (opts.title) {
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(opts.title, 16, 22);
  }

  const padTop = opts.title ? 44 : 20;
  const padBottom = 40;
  const padLeft = 40;
  const padRight = 20;
  const chartH = height - padTop - padBottom;
  const chartW = width - padLeft - padRight;

  const max = opts.maxValue ?? Math.max(1, ...items.map((i) => i.value));
  // grid
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1;
  ctx.font = '10px Arial, sans-serif';
  ctx.fillStyle = '#6B7280';
  ctx.textAlign = 'right';
  for (let g = 0; g <= 4; g++) {
    const y = padTop + (chartH * g) / 4;
    ctx.beginPath();
    ctx.moveTo(padLeft, y); ctx.lineTo(padLeft + chartW, y); ctx.stroke();
    const v = Math.round(max - (max * g) / 4);
    ctx.fillText(`${v}${opts.valueSuffix || ''}`, padLeft - 6, y + 3);
  }

  const slot = chartW / items.length;
  const barW = Math.min(60, slot * 0.6);
  items.forEach((it, i) => {
    const x = padLeft + slot * i + (slot - barW) / 2;
    const h = (it.value / max) * chartH;
    const y = padTop + chartH - h;
    ctx.fillStyle = it.color || PALETTE[i % PALETTE.length];
    ctx.fillRect(x, y, barW, h);
    // value above
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${it.value}${opts.valueSuffix || ''}`, x + barW / 2, y - 8);
    // label below
    ctx.fillStyle = '#374151';
    ctx.font = '11px Arial, sans-serif';
    ctx.fillText(truncate(ctx, it.label, slot - 4), x + barW / 2, padTop + chartH + 16);
  });

  return canvasToPngBytes(canvas);
}