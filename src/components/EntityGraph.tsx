import { useRef, useEffect, useState, useMemo } from 'react';
import { useLang } from '@/contexts/LangContext';
import * as d3Force from 'd3-force';
import * as d3Selection from 'd3-selection';
import * as d3Zoom from 'd3-zoom';
import * as d3Drag from 'd3-drag';

interface EntityNode {
  id: string;
  label: string;
  type: 'found' | 'gap';
  category?: string;
  importance?: number;
  // d3 simulation fields
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

const GAP_COLOR = '#6b7280';
const GAP_STROKE_DASH = '4,3';

export function EntityGraph({ foundEntities, gapEntities, categories = {} }: Props) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: EntityNode } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Build nodes and links
  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map<string, EntityNode>();

    foundEntities.forEach(e => {
      const id = e.toLowerCase();
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          label: e,
          type: 'found',
          category: categories[e] || categories[id] || 'default',
          importance: 0.8,
        });
      }
    });

    gapEntities.forEach(e => {
      const id = e.toLowerCase();
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          label: e,
          type: 'gap',
          category: categories[e] || categories[id] || 'default',
          importance: 0.5,
        });
      }
    });

    const nodesArr = Array.from(nodeMap.values());

    // Create links between nodes of same category
    const catGroups = new Map<string, EntityNode[]>();
    nodesArr.forEach(n => {
      const cat = n.category || 'default';
      if (!catGroups.has(cat)) catGroups.set(cat, []);
      catGroups.get(cat)!.push(n);
    });

    const linksArr: EntityLink[] = [];
    catGroups.forEach(group => {
      // Connect nodes within a category in a chain
      for (let i = 0; i < group.length - 1 && i < 5; i++) {
        linksArr.push({ source: group[i].id, target: group[i + 1].id });
      }
    });

    // Also link found nodes to nearby gap nodes (max 2 links per gap)
    const foundNodes = nodesArr.filter(n => n.type === 'found');
    const gapNodes = nodesArr.filter(n => n.type === 'gap');
    gapNodes.forEach((gap, gi) => {
      if (foundNodes.length > 0) {
        linksArr.push({ source: foundNodes[gi % foundNodes.length].id, target: gap.id });
      }
    });

    return { nodes: nodesArr, links: linksArr };
  }, [foundEntities, gapEntities, categories]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0) setDimensions({ width, height: Math.max(400, height) });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // D3 force simulation
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3Selection.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;

    // Zoom
    const g = svg.append('g');
    const zoomBehavior = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoomBehavior);

    // Clone nodes for simulation
    const simNodes: EntityNode[] = nodes.map(n => ({ ...n }));
    const simLinks: EntityLink[] = links.map(l => ({ ...l }));

    const simulation = d3Force.forceSimulation(simNodes)
      .force('link', d3Force.forceLink<EntityNode, any>(simLinks).id((d: any) => d.id).distance(80).strength(0.3))
      .force('charge', d3Force.forceManyBody().strength(-200))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      .force('collision', d3Force.forceCollide().radius(35));

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#4b5563')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1);

    // Node groups
    const node = g.append('g')
      .selectAll<SVGGElement, EntityNode>('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer');

    // Drag behavior
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

    // Circles
    node.append('circle')
      .attr('r', d => d.type === 'found' ? 18 : 14)
      .attr('fill', d => d.type === 'found' ? (CATEGORY_COLORS[d.category || 'default'] || CATEGORY_COLORS.default) : 'transparent')
      .attr('stroke', d => d.type === 'found' ? (CATEGORY_COLORS[d.category || 'default'] || CATEGORY_COLORS.default) : GAP_COLOR)
      .attr('stroke-width', d => d.type === 'found' ? 2 : 1.5)
      .attr('stroke-dasharray', d => d.type === 'gap' ? GAP_STROKE_DASH : 'none')
      .attr('fill-opacity', d => d.type === 'found' ? 0.2 : 0)
      .on('mouseenter', function (event, d) {
        d3Selection.select(this).transition().duration(150).attr('r', d.type === 'found' ? 22 : 18);
        const svgRect = svgRef.current!.getBoundingClientRect();
        setTooltip({ x: event.clientX - svgRect.left, y: event.clientY - svgRect.top - 10, node: d });
      })
      .on('mouseleave', function (_, d) {
        d3Selection.select(this).transition().duration(150).attr('r', d.type === 'found' ? 18 : 14);
        setTooltip(null);
      });

    // Labels
    node.append('text')
      .text(d => d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => (d.type === 'found' ? 30 : 24))
      .attr('fill', d => d.type === 'found' ? '#e2e8f0' : '#9ca3af')
      .attr('font-size', '10px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('pointer-events', 'none');

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [nodes, links, dimensions]);

  if (nodes.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground text-sm">
        {isRu ? 'Нет данных для графа сущностей.' : 'No entity data for graph.'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-primary/30 border-2 border-primary" />
          {isRu ? 'Найдено на странице' : 'Found on page'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-dashed border-muted-foreground" />
          {isRu ? 'Есть у конкурентов (Gap)' : 'Competitor gap'}
        </span>
        <span className="ml-auto text-muted-foreground">
          {isRu ? 'Перетаскивайте узлы · Колёсико для масштаба' : 'Drag nodes · Scroll to zoom'}
        </span>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="glass-card overflow-hidden relative" style={{ height: 500 }}>
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full"
        />
        {tooltip && (
          <div
            className="absolute z-50 glass-card px-3 py-2 text-xs pointer-events-none shadow-lg border border-border"
            style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
          >
            <p className="font-bold text-foreground">{tooltip.node.label}</p>
            <p className="text-muted-foreground">
              {tooltip.node.type === 'found'
                ? (isRu ? '✅ Присутствует на странице' : '✅ Present on page')
                : (isRu ? '⚠️ Отсутствует — есть у конкурентов ТОП-10' : '⚠️ Missing — found in TOP-10 competitors')}
            </p>
            {tooltip.node.category && tooltip.node.category !== 'default' && (
              <p className="text-muted-foreground capitalize">{isRu ? 'Тип' : 'Type'}: {tooltip.node.category}</p>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>🔵 {isRu ? 'Найдено' : 'Found'}: <strong className="text-foreground">{foundEntities.length}</strong></span>
        <span>⚪ {isRu ? 'Пробелы' : 'Gaps'}: <strong className="text-foreground">{gapEntities.length}</strong></span>
        <span>{isRu ? 'Покрытие' : 'Coverage'}: <strong className="text-foreground">{foundEntities.length + gapEntities.length > 0 ? Math.round(foundEntities.length / (foundEntities.length + gapEntities.length) * 100) : 0}%</strong></span>
      </div>
    </div>
  );
}
