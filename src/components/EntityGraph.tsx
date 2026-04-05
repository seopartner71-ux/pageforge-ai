import { useRef, useEffect, useMemo } from 'react';
import { useLang } from '@/contexts/LangContext';
import * as d3Force from 'd3-force';
import * as d3Selection from 'd3-selection';
import * as d3Zoom from 'd3-zoom';
import * as d3Drag from 'd3-drag';
import { CheckCircle2, AlertTriangle, Network, Target, TrendingUp } from 'lucide-react';

interface EntityNode {
  id: string;
  label: string;
  type: 'found' | 'gap';
  category?: string;
  importance?: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  index?: number;
}

interface EntityLink {
  source: string | EntityNode;
  target: string | EntityNode;
}

interface Props {
  foundEntities: string[];
  gapEntities: string[];
  categories?: Record<string, string>;
}

const CATEGORY_COLORS: Record<string, string> = {
  brand: '#3b82f6',
  geo: '#10b981',
  material: '#f59e0b',
  standard: '#8b5cf6',
  service: '#ec4899',
  default: '#6366f1',
};

const GAP_COLOR = '#ef4444';
const FOUND_GLOW = '#6366f1';

export function EntityGraph({ foundEntities, gapEntities, categories = {} }: Props) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const coverage = foundEntities.length + gapEntities.length > 0
    ? Math.round(foundEntities.length / (foundEntities.length + gapEntities.length) * 100)
    : 0;

  const coverageColor = coverage >= 70 ? 'text-green-400' : coverage >= 40 ? 'text-yellow-400' : 'text-red-400';
  const coverageBg = coverage >= 70 ? 'bg-green-500/20 border-green-500/30' : coverage >= 40 ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-red-500/20 border-red-500/30';

  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map<string, EntityNode>();

    foundEntities.forEach(e => {
      const id = e.toLowerCase();
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id, label: e, type: 'found', category: categories[e] || categories[id] || 'default', importance: 0.8 });
      }
    });

    gapEntities.forEach(e => {
      const id = e.toLowerCase();
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id, label: e, type: 'gap', category: categories[e] || categories[id] || 'default', importance: 0.5 });
      }
    });

    const nodesArr = Array.from(nodeMap.values());
    const catGroups = new Map<string, EntityNode[]>();
    nodesArr.forEach(n => {
      const cat = n.category || 'default';
      if (!catGroups.has(cat)) catGroups.set(cat, []);
      catGroups.get(cat)!.push(n);
    });

    const linksArr: EntityLink[] = [];
    catGroups.forEach(group => {
      for (let i = 0; i < group.length - 1 && i < 5; i++) {
        linksArr.push({ source: group[i].id, target: group[i + 1].id });
      }
    });

    const foundNodes = nodesArr.filter(n => n.type === 'found');
    const gapNodes = nodesArr.filter(n => n.type === 'gap');
    gapNodes.forEach((gap, gi) => {
      if (foundNodes.length > 0) {
        linksArr.push({ source: foundNodes[gi % foundNodes.length].id, target: gap.id });
      }
    });

    return { nodes: nodesArr, links: linksArr };
  }, [foundEntities, gapEntities, categories]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const svg = d3Selection.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const tooltipEl = tooltipRef.current;

    // Defs for glow effect
    const defs = svg.append('defs');
    const glowFilter = defs.append('filter').attr('id', 'glow');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const gapGlow = defs.append('filter').attr('id', 'gap-glow');
    gapGlow.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'coloredBlur');
    const gapMerge = gapGlow.append('feMerge');
    gapMerge.append('feMergeNode').attr('in', 'coloredBlur');
    gapMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g');
    const zoomBehavior = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoomBehavior);

    const simNodes: EntityNode[] = nodes.map(n => ({ ...n }));
    const simLinks: EntityLink[] = links.map(l => ({ ...l }));

    const simulation = d3Force.forceSimulation(simNodes)
      .force('link', d3Force.forceLink<EntityNode, any>(simLinks).id((d: any) => d.id).distance(100).strength(0.3))
      .force('charge', d3Force.forceManyBody().strength(-250))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      .force('collision', d3Force.forceCollide().radius(45));

    // Links with gradient opacity
    const link = g.append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', (d: any) => {
        const src = typeof d.source === 'string' ? simNodes.find(n => n.id === d.source) : d.source;
        const tgt = typeof d.target === 'string' ? simNodes.find(n => n.id === d.target) : d.target;
        if (src?.type === 'gap' || tgt?.type === 'gap') return '#ef444480';
        return '#6366f180';
      })
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', (d: any) => {
        const tgt = typeof d.target === 'string' ? simNodes.find(n => n.id === d.target) : d.target;
        return tgt?.type === 'gap' ? '6,4' : 'none';
      });

    const node = g.append('g')
      .selectAll<SVGGElement, EntityNode>('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'grab');

    const dragBehavior = d3Drag.drag<SVGGElement, EntityNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(dragBehavior as any);

    // Outer ring for found nodes
    node.filter(d => d.type === 'found').append('circle')
      .attr('r', 24)
      .attr('fill', 'none')
      .attr('stroke', d => CATEGORY_COLORS[d.category || 'default'] || FOUND_GLOW)
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.3)
      .attr('filter', 'url(#glow)');

    // Main circles
    node.append('circle')
      .attr('r', d => d.type === 'found' ? 20 : 16)
      .attr('fill', d => {
        if (d.type === 'found') {
          const c = CATEGORY_COLORS[d.category || 'default'] || FOUND_GLOW;
          return c;
        }
        return 'transparent';
      })
      .attr('stroke', d => d.type === 'found'
        ? (CATEGORY_COLORS[d.category || 'default'] || FOUND_GLOW)
        : GAP_COLOR)
      .attr('stroke-width', d => d.type === 'found' ? 2.5 : 2)
      .attr('stroke-dasharray', d => d.type === 'gap' ? '5,3' : 'none')
      .attr('fill-opacity', d => d.type === 'found' ? 0.25 : 0)
      .attr('filter', d => d.type === 'gap' ? 'url(#gap-glow)' : 'none')
      .on('mouseenter', function (event, d) {
        d3Selection.select(this).attr('r', d.type === 'found' ? 24 : 20).attr('fill-opacity', d.type === 'found' ? 0.4 : 0.1);
        if (tooltipEl) {
          const svgRect = svgRef.current!.getBoundingClientRect();
          tooltipEl.style.left = `${event.clientX - svgRect.left}px`;
          tooltipEl.style.top = `${event.clientY - svgRect.top - 12}px`;
          tooltipEl.style.display = 'block';

          const icon = d.type === 'found' ? '✅' : '❌';
          const statusLabel = d.type === 'found'
            ? (isRu ? 'Найдена на странице' : 'Found on page')
            : (isRu ? 'Отсутствует — добавьте!' : 'Missing — add it!');
          const statusColor = d.type === 'found' ? '#4ade80' : '#f87171';
          const catLabel = d.category && d.category !== 'default'
            ? `<div style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.1);color:#94a3b8;font-size:10px">${isRu ? 'Категория' : 'Category'}: <span style="text-transform:capitalize;color:#cbd5e1">${d.category}</span></div>` : '';
          const actionText = d.type === 'gap'
            ? `<div style="margin-top:6px;padding:3px 6px;background:rgba(239,68,68,0.15);border-radius:4px;color:#fca5a5;font-size:10px">${isRu ? '💡 Рекомендация: упомяните эту сущность в тексте' : '💡 Tip: mention this entity in your content'}</div>` : '';

          tooltipEl.innerHTML = `
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${icon} ${d.label}</div>
            <div style="color:${statusColor};font-size:11px">${statusLabel}</div>
            ${catLabel}${actionText}
          `;
        }
      })
      .on('mousemove', function (event) {
        if (tooltipEl) {
          const svgRect = svgRef.current!.getBoundingClientRect();
          tooltipEl.style.left = `${event.clientX - svgRect.left}px`;
          tooltipEl.style.top = `${event.clientY - svgRect.top - 12}px`;
        }
      })
      .on('mouseleave', function (_, d) {
        d3Selection.select(this).attr('r', d.type === 'found' ? 20 : 16).attr('fill-opacity', d.type === 'found' ? 0.25 : 0);
        if (tooltipEl) tooltipEl.style.display = 'none';
      });

    // Icon inside node: checkmark for found, X for gap
    node.filter(d => d.type === 'found').append('text')
      .text('✓')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#fff')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none');

    node.filter(d => d.type === 'gap').append('text')
      .text('+')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', GAP_COLOR)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none');

    // Labels - more visible, with background
    node.append('text')
      .text(d => d.label.length > 16 ? d.label.slice(0, 15) + '…' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => (d.type === 'found' ? 36 : 30))
      .attr('fill', d => d.type === 'found' ? '#e2e8f0' : '#f87171')
      .attr('font-size', '11px')
      .attr('font-weight', d => d.type === 'found' ? '500' : '400')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [nodes, links, isRu]);

  if (nodes.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground text-sm">
        {isRu ? 'Нет данных для графа сущностей.' : 'No entity data for graph.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with explanation */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">
            {isRu ? 'Карта сущностей страницы' : 'Page Entity Map'}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isRu
            ? 'Граф показывает какие ключевые сущности (бренды, локации, термины) есть на вашей странице, а какие используют конкуренты из ТОП-10, но у вас они отсутствуют. Добавьте недостающие сущности в контент для улучшения релевантности.'
            : 'This graph shows which key entities (brands, locations, terms) are present on your page, and which are used by TOP-10 competitors but missing from yours. Add missing entities to improve relevance.'}
        </p>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {isRu ? 'Найдено' : 'Found'}
              </span>
            </div>
            <span className="text-xl font-bold text-green-400">{foundEntities.length}</span>
          </div>
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {isRu ? 'Пробелы' : 'Gaps'}
              </span>
            </div>
            <span className="text-xl font-bold text-red-400">{gapEntities.length}</span>
          </div>
          <div className={`rounded-lg border p-3 text-center ${coverageBg}`}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {isRu ? 'Покрытие' : 'Coverage'}
              </span>
            </div>
            <span className={`text-xl font-bold ${coverageColor}`}>{coverage}%</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-primary/30 border-2 border-primary flex items-center justify-center text-[8px] text-white font-bold">✓</span>
          {isRu ? 'Найдено на странице' : 'Found on page'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full border-2 border-dashed border-red-400 flex items-center justify-center text-[10px] text-red-400 font-bold">+</span>
          {isRu ? 'Отсутствует (Gap)' : 'Missing (Gap)'}
        </span>
        <span className="ml-auto text-muted-foreground flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {isRu ? 'Перетаскивайте узлы · Колёсико для масштаба' : 'Drag nodes · Scroll to zoom'}
        </span>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="glass-card overflow-hidden relative rounded-xl border border-border/50" style={{ height: 500 }}>
        <svg ref={svgRef} className="w-full h-full" />
        <div
          ref={tooltipRef}
          className="absolute z-50 rounded-lg bg-popover/95 backdrop-blur-md px-4 py-3 text-xs pointer-events-none shadow-xl border border-border/60"
          style={{ display: 'none', transform: 'translate(-50%, -100%)', maxWidth: 260 }}
        />
      </div>

      {/* Gap entities list */}
      {gapEntities.length > 0 && (
        <div className="glass-card p-4 space-y-2">
          <h4 className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {isRu ? 'Рекомендуемые сущности для добавления:' : 'Recommended entities to add:'}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {gapEntities.slice(0, 15).map(e => (
              <span key={e} className="px-2.5 py-1 rounded-md text-[11px] bg-red-500/10 border border-red-500/20 text-red-300">
                + {e}
              </span>
            ))}
            {gapEntities.length > 15 && (
              <span className="px-2.5 py-1 rounded-md text-[11px] bg-muted/50 text-muted-foreground">
                +{gapEntities.length - 15} {isRu ? 'ещё' : 'more'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
