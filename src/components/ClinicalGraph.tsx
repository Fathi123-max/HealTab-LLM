import React, { useState, useEffect, useRef } from 'react';
import { GraphNode, GraphLink, ClinicalGraphData } from '../types';
import { MEDICAL_CODES } from '../domain/clinical';
import { Card } from './ui/card';
import { Input } from './ui/input';

interface ClinicalGraphProps {
  graphData: ClinicalGraphData | null;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode | null) => void;
  isContextLocked: boolean;
  onToggleContextLock: (locked: boolean) => void;
}

export default function ClinicalGraph({
  graphData,
  selectedNodeId,
  onSelectNode,
  isContextLocked,
  onToggleContextLock
}: ClinicalGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [filterText, setFilterText] = useState<string>('');
  
  const canvasWidth = 600;
  const canvasHeight = 450;
  const animationRef = useRef<number | null>(null);
  const dragNodeRef = useRef<GraphNode | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Initialize nodes with positions when graphData changes
  useEffect(() => {
    if (!graphData) {
      setNodes([]);
      setLinks([]);
      return;
    }

    // Assign random initial positions near the center
    const initializedNodes = graphData.nodes.map((n, i) => {
      const angle = (i / graphData.nodes.length) * Math.PI * 2;
      const radius = 100 + Math.random() * 50;
      return {
        ...n,
        x: canvasWidth / 2 + Math.cos(angle) * radius,
        y: canvasHeight / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0
      };
    });

    setNodes(initializedNodes);
    setLinks(graphData.links);
  }, [graphData]);

  // Spring physics simulation tick loop
  useEffect(() => {
    if (nodes.length === 0) return;

    const tick = () => {
      setNodes(prevNodes => {
        if (prevNodes.length === 0) return prevNodes;

        // Copy nodes to avoid mutating state directly
        const nextNodes = prevNodes.map(n => ({ ...n }));

        const repulsionConstant = 6000;
        const springLength = 80;
        const springConstant = 0.04;
        const gravityConstant = 0.02;
        const damping = 0.85;

        // 1. Repulsion forces between all node pairs
        for (let i = 0; i < nextNodes.length; i++) {
          const n1 = nextNodes[i];
          for (let j = i + 1; j < nextNodes.length; j++) {
            const n2 = nextNodes[j];
            const dx = n2.x! - n1.x!;
            const dy = n2.y! - n1.y!;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;

            if (distance < 250) {
              const force = repulsionConstant / (distance * distance);
              const fx = (dx / distance) * force;
              const fy = (dy / distance) * force;

              // Pull away
              if (dragNodeRef.current?.id !== n1.id) {
                n1.vx = (n1.vx || 0) - fx;
                n1.vy = (n1.vy || 0) - fy;
              }
              if (dragNodeRef.current?.id !== n2.id) {
                n2.vx = (n2.vx || 0) + fx;
                n2.vy = (n2.vy || 0) + fy;
              }
            }
          }
        }

        // 2. Attraction forces along links
        links.forEach(link => {
          const sNode = nextNodes.find(n => n.id === (typeof link.source === 'string' ? link.source : (link.source as any).id));
          const tNode = nextNodes.find(n => n.id === (typeof link.target === 'string' ? link.target : (link.target as any).id));

          if (sNode && tNode) {
            const dx = tNode.x! - sNode.x!;
            const dy = tNode.y! - sNode.y!;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const displacement = distance - springLength;
            const force = displacement * springConstant;

            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;

            if (dragNodeRef.current?.id !== sNode.id) {
              sNode.vx = (sNode.vx || 0) + fx;
              sNode.vy = (sNode.vy || 0) + fy;
            }
            if (dragNodeRef.current?.id !== tNode.id) {
              tNode.vx = (tNode.vx || 0) - fx;
              tNode.vy = (tNode.vy || 0) - fy;
            }
          }
        });

        // 3. Gravity pulling toward center, damping and position update
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        nextNodes.forEach(node => {
          if (dragNodeRef.current?.id === node.id) return; // Skip updating currently dragged node

          // Pull to center
          const dx = centerX - node.x!;
          const dy = centerY - node.y!;
          node.vx = (node.vx || 0) + dx * gravityConstant;
          node.vy = (node.vy || 0) + dy * gravityConstant;

          // Apply friction
          node.vx *= damping;
          node.vy *= damping;

          // Update position
          node.x! += node.vx;
          node.y! += node.vy;

          // Bound within viewport
          node.x = Math.max(20, Math.min(canvasWidth - 20, node.x!));
          node.y = Math.max(20, Math.min(canvasHeight - 20, node.y!));
        });

        return nextNodes;
      });

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [nodes.length, links]);

  // Drag handlers
  const handleMouseDown = (node: GraphNode, _e: React.MouseEvent) => {
    dragNodeRef.current = node;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragNodeRef.current || !svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * canvasWidth;
    const mouseY = ((e.clientY - rect.top) / rect.height) * canvasHeight;

    setNodes(prev =>
      prev.map(n => {
        if (n.id === dragNodeRef.current?.id) {
          return { ...n, x: mouseX, y: mouseY, vx: 0, vy: 0 };
        }
        return n;
      })
    );
  };

  const handleMouseUpOrLeave = () => {
    dragNodeRef.current = null;
  };

  const getNodeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'patient': return '#00f2fe';
      case 'symptom': return '#fbbf24';
      case 'diagnosis': return '#a78bfa';
      case 'treatment': return '#38bdf8';
      case 'drug': return '#10b981';
      case 'test': return '#f472b6';
      default: return '#f43f5e';
    }
  };

  // Find selected node details
  const activeNode = nodes.find(n => n.id === selectedNodeId);

  // Look up coding values
  let codingBadge = null;
  if (activeNode) {
    const lookupKey = activeNode.label.toLowerCase().trim();
    const matchedKey = Object.keys(MEDICAL_CODES).find(
      k => lookupKey.includes(k) || k.includes(lookupKey)
    );
    if (matchedKey) {
      const codeInfo = MEDICAL_CODES[matchedKey];
      const isDrug = codeInfo.type === 'Drug';
      codingBadge = (
        <span
          className={`inline-block px-2.5 py-1 rounded text-xs font-bold border mb-3 ${
            isDrug
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/35'
              : 'bg-violet-500/10 text-violet-400 border-violet-500/35'
          }`}
        >
          {codeInfo.code} ({codeInfo.type})
        </span>
      );
    }
  }

  // Filter query matches
  const isMatch = (node: GraphNode) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase().trim();
    return (
      node.label.toLowerCase().includes(q) ||
      node.details.toLowerCase().includes(q) ||
      node.type.toLowerCase().includes(q)
    );
  };

  return (
    <div className="flex h-full p-6 gap-6 overflow-hidden">
      {/* Visual Canvas */}
      <Card className="flex-[1.4] bg-slate-950/45 border-white/5 shadow-2xl backdrop-blur-xl relative overflow-hidden flex items-center justify-center">
        {nodes.length === 0 ? (
          <div className="text-slate-500 text-sm font-medium">Extract graph to visualize relationships.</div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className="w-full h-full select-none"
          >
            {/* Draw Links */}
            {links.map((link, idx) => {
              const sNode = nodes.find(n => n.id === (typeof link.source === 'string' ? link.source : (link.source as any).id));
              const tNode = nodes.find(n => n.id === (typeof link.target === 'string' ? link.target : (link.target as any).id));

              if (!sNode || !tNode) return null;

              const matchSource = isMatch(sNode);
              const matchTarget = isMatch(tNode);
              const isFiltered = filterText.trim().length > 0;

              return (
                <g key={`l-${idx}`}>
                  <line
                    x1={sNode.x}
                    y1={sNode.y}
                    x2={tNode.x}
                    y2={tNode.y}
                    stroke="rgba(255, 255, 255, 0.12)"
                    strokeWidth={isFiltered && matchSource && matchTarget ? "2" : "1.2"}
                    strokeDasharray="4 4"
                    opacity={isFiltered && !(matchSource && matchTarget) ? 0.15 : 0.8}
                  />
                  {/* Midpoint relation text */}
                  {matchSource && matchTarget && (
                    <text
                      x={(sNode.x! + tNode.x!) / 2}
                      y={(sNode.y! + tNode.y!) / 2 - 4}
                      fill="rgba(255,255,255,0.4)"
                      fontSize="9"
                      fontWeight="500"
                      textAnchor="middle"
                      opacity={isFiltered && !(matchSource && matchTarget) ? 0.1 : 0.75}
                    >
                      {link.relation}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Draw Nodes */}
            {nodes.map(node => {
              const match = isMatch(node);
              const isFiltered = filterText.trim().length > 0;
              const color = getNodeColor(node.type);
              const isSelected = node.id === selectedNodeId;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleMouseDown(node, e)}
                  onClick={() => onSelectNode(node)}
                  className="cursor-pointer group"
                  opacity={isFiltered && !match ? 0.15 : 1}
                >
                  <circle
                    r={node.type === 'patient' ? 14 : 10}
                    fill={color}
                    stroke={isSelected ? '#00f2fe' : 'rgba(255,255,255,0.2)'}
                    strokeWidth={isSelected ? '4px' : '2px'}
                    className="transition-all duration-200 group-hover:scale-110"
                    style={{ filter: isSelected ? 'drop-shadow(0 0 10px #00f2fe)' : 'none' }}
                  />
                  <text
                    y={node.type === 'patient' ? 26 : 22}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="10"
                    fontWeight="600"
                    className="pointer-events-none select-none bg-slate-900 px-1 py-0.5 rounded"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </Card>

      {/* Info Sidebar */}
      <Card className="flex-[0.6] bg-slate-950/45 border-white/5 p-6 shadow-2xl backdrop-blur-xl flex flex-col gap-5 overflow-y-auto">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Clinical Search Filter</h3>
          <Input
            value={filterText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterText(e.target.value)}
            placeholder="Filter entities (e.g., 'drug')..."
            className="bg-slate-900 border-white/10 text-xs text-white"
          />
        </div>

        <div className="flex items-center gap-3 border-t border-white/5 pt-4">
          <input
            type="checkbox"
            id="chk-context"
            checked={isContextLocked}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onToggleContextLock(e.target.checked)}
            className="w-4 h-4 rounded border-white/10 bg-slate-900 text-cyan-400 focus:ring-0 cursor-pointer"
          />
          <label htmlFor="chk-context" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
            Lock context to selected node details
          </label>
        </div>

        <div className="flex-1 border-t border-white/5 pt-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Entity Details</h3>
            {activeNode ? (
              <div className="flex flex-col">
                <h4
                  className="text-base font-bold tracking-tight mb-2"
                  style={{ color: getNodeColor(activeNode.type) }}
                >
                  {activeNode.label}
                </h4>
                {codingBadge}
                <div className="text-slate-300 text-xs leading-relaxed mt-1">
                  <p className="mb-2"><strong>Category:</strong> {activeNode.type.toUpperCase()}</p>
                  <p><strong>Context Details:</strong> {activeNode.details}</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-xs italic">Select a node on the graph canvas to inspect clinical coding details.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
