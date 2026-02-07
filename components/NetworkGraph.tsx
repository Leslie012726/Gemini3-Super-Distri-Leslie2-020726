import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MedFlowRow } from '../types';

interface NetworkGraphProps {
  data: MedFlowRow[];
  width?: number;
  height?: number;
  topN: number;
  onNodeClick?: (node: { id: string, type: 'supplier' | 'category' | 'customer' } | null) => void;
  selectedNodeId?: string | null;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ 
  data, 
  width = 800, 
  height = 600, 
  topN, 
  onNodeClick,
  selectedNodeId 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    // 1. Process Data
    const nodes = new Map<string, { id: string, type: 'supplier' | 'category' | 'customer', val: number }>();
    const links: { source: string, target: string, value: number }[] = [];

    // Aggregate flows based on filtered data subset
    data.slice(0, topN * 10).forEach(row => { 
      const sup = row.SupplierID;
      const cat = row.Category;
      const cust = row.CustomerID;
      const val = row.Number;

      if (!nodes.has(sup)) nodes.set(sup, { id: sup, type: 'supplier', val: 0 });
      if (!nodes.has(cat)) nodes.set(cat, { id: cat, type: 'category', val: 0 });
      if (!nodes.has(cust)) nodes.set(cust, { id: cust, type: 'customer', val: 0 });

      nodes.get(sup)!.val += val;
      nodes.get(cat)!.val += val;
      nodes.get(cust)!.val += val;

      links.push({ source: sup, target: cat, value: val });
      links.push({ source: cat, target: cust, value: val });
    });

    // Consolidate links
    const linkMap = new Map<string, { source: string, target: string, value: number }>();
    links.forEach(l => {
      const key = `${l.source}-${l.target}`;
      if (linkMap.has(key)) {
        linkMap.get(key)!.value += l.value;
      } else {
        linkMap.set(key, { ...l });
      }
    });

    const graphNodes = Array.from(nodes.values());
    const graphLinks = Array.from(linkMap.values());

    // 2. D3 Force Simulation
    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    // Add click handler to background to deselect
    svg.on('click', (e) => {
       if (e.target === svgRef.current && onNodeClick) {
           onNodeClick(null);
       }
    });

    const simulation = d3.forceSimulation(graphNodes as any)
      .force("link", d3.forceLink(graphLinks).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(30));

    // 3. Render Links
    const link = svg.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(graphLinks)
      .join("line")
      .attr("stroke-width", d => Math.sqrt(d.value) * 0.1 + 1);

    // 4. Render Nodes
    const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(graphNodes)
      .join("circle")
      .attr("r", d => 5 + Math.sqrt(d.val) * 0.2)
      .attr("fill", d => {
        if (d.type === 'supplier') return "#ef476f";
        if (d.type === 'category') return "#ffd166";
        return "#06d6a0";
      })
      .attr("stroke", d => d.id === selectedNodeId ? "#ffffff" : "#fff")
      .attr("stroke-width", d => d.id === selectedNodeId ? 4 : 1.5)
      .attr("stroke-opacity", d => d.id === selectedNodeId ? 1 : 0.8)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
          event.stopPropagation(); // Prevent background click
          if (onNodeClick) onNodeClick(d);
      })
      .call(drag(simulation) as any);

    // Node Titles (Tooltip)
    node.append("title")
      .text(d => `${d.id} (${d.type})\nVol: ${d.val}`);

    // Labels
    const text = svg.append("g")
        .selectAll("text")
        .data(graphNodes)
        .join("text")
        .text(d => d.id.substring(0, 12) + (d.id.length > 12 ? '...' : ''))
        .attr("font-size", d => d.id === selectedNodeId ? "14px" : "10px")
        .attr("font-weight", d => d.id === selectedNodeId ? "bold" : "normal")
        .attr("dx", 12)
        .attr("dy", 4)
        .attr("fill", "currentColor")
        .attr("class", "dark:fill-white fill-gray-800 pointer-events-none opacity-80");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);

      text
          .attr("x", (d: any) => d.x)
          .attr("y", (d: any) => d.y);
    });

    function drag(sim: any) {
      function dragstarted(event: any) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event: any) {
        if (!event.active) sim.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [data, width, height, topN, onNodeClick, selectedNodeId]);

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden border border-white/20 rounded-xl bg-white/10 dark:bg-black/20 backdrop-blur-sm relative">
       <svg ref={svgRef} width={width} height={height} className="max-w-full max-h-full" />
       {!selectedNodeId && (
         <div className="absolute bottom-4 left-4 text-xs opacity-50 pointer-events-none bg-black/50 p-2 rounded">
            Click a node to view details
         </div>
       )}
    </div>
  );
};

export default NetworkGraph;