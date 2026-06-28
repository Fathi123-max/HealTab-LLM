// Presentation Layer: Interactive SVG Force-Directed Medical Knowledge Graph.

class GraphRenderer {
  constructor(canvasId, detailTitleId, detailBodyId, detailsPanelId) {
    this.svg = document.getElementById(canvasId);
    this.detailTitle = document.getElementById(detailTitleId);
    this.detailBody = document.getElementById(detailBodyId);
    this.detailsPanel = document.getElementById(detailsPanelId);
    
    this.nodes = [];
    this.links = [];
    this.width = 600;
    this.height = 400;
    this.simulation = null;
    this.draggedNode = null;
  }

  // Set node colors based on medical entity type
  getNodeColor(type) {
    switch (type) {
      case 'patient': return '#ef4444'; // Red
      case 'symptom': return '#f59e0b'; // Amber/Yellow
      case 'diagnosis': return '#8b5cf6'; // Purple
      case 'treatment': return '#3b82f6'; // Blue
      case 'drug': return '#10b981'; // Emerald Green
      case 'test': return '#06b6d4'; // Cyan
      case 'recommendation': return '#ec4899'; // Pink
      default: return '#9ca3af';
    }
  }

  // Initialize the SVG Canvas and render nodes/links
  render(data) {
    if (!this.svg) return;
    
    // Clear canvas
    this.svg.innerHTML = '';
    this.nodes = JSON.parse(JSON.stringify(data.nodes || []));
    this.links = JSON.parse(JSON.stringify(data.links || []));
    
    if (this.nodes.length === 0) {
      this.svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="#6b7280" font-size="14">No clinical associations found. Upload files to generate graph.</text>`;
      return;
    }

    // Set viewbox
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    
    // Initialize node positions in a circle/randomly
    this.nodes.forEach((node, i) => {
      const angle = (i / this.nodes.length) * 2 * Math.PI;
      node.x = this.width / 2 + 120 * Math.cos(angle) + (Math.random() - 0.5) * 20;
      node.y = this.height / 2 + 120 * Math.sin(angle) + (Math.random() - 0.5) * 20;
      node.vx = 0;
      node.vy = 0;
    });

    // Create marker for link arrows
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
      </marker>
    `;
    this.svg.appendChild(defs);

    // Render link elements
    const linkGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    linkGroup.setAttribute('class', 'links');
    this.svg.appendChild(linkGroup);

    // Render node elements
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeGroup.setAttribute('class', 'nodes');
    this.svg.appendChild(nodeGroup);

    // Create DOM links
    this.linkElements = this.links.map(link => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'graph-link');
      line.setAttribute('stroke', '#475569');
      line.setAttribute('marker-end', 'url(#arrow)');
      linkGroup.appendChild(line);
      
      // Labeled relation text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('font-size', '8px');
      text.setAttribute('fill', '#94a3b8');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = link.relation;
      linkGroup.appendChild(text);

      return { line, text, source: link.source, target: link.target };
    });

    // Create DOM nodes
    this.nodeElements = this.nodes.map(node => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'graph-node');
      g.style.cursor = 'grab';
      
      // Node circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', node.type === 'patient' ? '14' : '10');
      circle.setAttribute('fill', this.getNodeColor(node.type));
      circle.setAttribute('stroke', 'rgba(255,255,255,0.2)');
      circle.setAttribute('stroke-width', '2px');
      g.appendChild(circle);

      // Label text
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('dx', '14');
      label.setAttribute('dy', '4');
      label.setAttribute('fill', '#f3f4f6');
      label.setAttribute('font-size', '10px');
      label.setAttribute('font-weight', '500');
      label.textContent = node.label;
      g.appendChild(label);

      nodeGroup.appendChild(g);

      // Setup interaction
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectNode(node);
      });

      // Mouse drag events
      g.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.draggedNode = node;
        g.style.cursor = 'grabbing';
      });

      return { g, circle, label, node };
    });

    // Mouse movement inside SVG
    this.svg.addEventListener('mousemove', (e) => {
      if (this.draggedNode) {
        const rect = this.svg.getBoundingClientRect();
        // Translate client space to SVG space
        const x = ((e.clientX - rect.left) / rect.width) * this.width;
        const y = ((e.clientY - rect.top) / rect.height) * this.height;
        this.draggedNode.x = x;
        this.draggedNode.y = y;
        this.ticked();
      }
    });

    this.svg.addEventListener('mouseup', () => {
      if (this.draggedNode) {
        this.draggedNode = null;
        this.nodeElements.forEach(ne => ne.g.style.cursor = 'grab');
      }
    });

    // Select the first node as default
    if (this.nodes.length > 0) {
      this.selectNode(this.nodes[0]);
    }

    // Run force simulation
    this.startSimulation();
  }

  // Force simulation loop (simple Verlet integration + spring force + center gravity)
  startSimulation() {
    let ticks = 0;
    const maxTicks = 180;
    
    const step = () => {
      if (ticks >= maxTicks) return;
      
      // Repulsion force between all nodes (Coulomb-like)
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const n1 = this.nodes[i];
          const n2 = this.nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          
          // Repel force
          const force = (1200 / distSq);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          if (n1 !== this.draggedNode) {
            n1.vx -= fx;
            n1.vy -= fy;
          }
          if (n2 !== this.draggedNode) {
            n2.vx += fx;
            n2.vy += fy;
          }
        }
      }

      // Spring forces along links (Hooke's Law)
      this.linkElements.forEach(link => {
        const sourceNode = this.nodes.find(n => n.id === link.source);
        const targetNode = this.nodes.find(n => n.id === link.target);
        if (!sourceNode || !targetNode) return;
        
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const desiredDist = 110;
        
        const k = 0.04; // Spring stiffness
        const force = k * (dist - desiredDist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (sourceNode !== this.draggedNode) {
          sourceNode.vx += fx;
          sourceNode.vy += fy;
        }
        if (targetNode !== this.draggedNode) {
          targetNode.vx -= fx;
          targetNode.vy -= fy;
        }
      });

      // Gravity towards center + velocity updates
      const centerGravity = 0.02;
      this.nodes.forEach(n => {
        if (n === this.draggedNode) return;
        
        // Pull to center
        n.vx += (this.width / 2 - n.x) * centerGravity;
        n.vy += (this.height / 2 - n.y) * centerGravity;

        // Apply friction
        n.vx *= 0.85;
        n.vy *= 0.85;

        // Update positions
        n.x += n.vx;
        n.y += n.vy;
      });

      this.ticked();
      ticks++;
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }

  // Update SVGs positions
  ticked() {
    // Draw links
    this.linkElements.forEach(le => {
      const s = this.nodes.find(n => n.id === le.source);
      const t = this.nodes.find(n => n.id === le.target);
      if (s && t) {
        le.line.setAttribute('x1', s.x);
        le.line.setAttribute('y1', s.y);
        le.line.setAttribute('x2', t.x);
        le.line.setAttribute('y2', t.y);
        
        // Midpoint for relationship text label
        le.text.setAttribute('x', (s.x + t.x) / 2);
        le.text.setAttribute('y', (s.y + t.y) / 2 - 4);
      }
    });

    // Draw nodes
    this.nodeElements.forEach(ne => {
      ne.g.setAttribute('transform', `translate(${ne.node.x}, ${ne.node.y})`);
    });
  }

  // Select node and display in info panel
  selectNode(node) {
    if (!this.detailTitle) return;
    
    // Highlight node circle
    this.nodeElements.forEach(ne => {
      if (ne.node.id === node.id) {
        ne.circle.setAttribute('stroke', '#00f2fe');
        ne.circle.setAttribute('stroke-width', '4px');
        ne.circle.setAttribute('r', node.type === 'patient' ? '16' : '12');
      } else {
        ne.circle.setAttribute('stroke', 'rgba(255,255,255,0.2)');
        ne.circle.setAttribute('stroke-width', '2px');
        ne.circle.setAttribute('r', ne.node.type === 'patient' ? '14' : '10');
      }
    });

    this.detailTitle.textContent = node.label;
    this.detailTitle.style.color = this.getNodeColor(node.type);
    
    // Medical Code Mapping Table lookup
    const lookupKey = node.label.toLowerCase().trim();
    const MEDICAL_CODES = {
      'proliferative diabetic retinopathy': { code: 'ICD-10-CM: E11.359', type: 'Diagnosis' },
      'diabetic retinopathy': { code: 'ICD-10-CM: E11.319', type: 'Diagnosis' },
      'macular edema': { code: 'ICD-10-CM: H35.81', type: 'Diagnosis' },
      'alzheimer\'s disease': { code: 'ICD-10-CM: G30.9', type: 'Diagnosis' },
      'essential hypertension': { code: 'ICD-10-CM: I10', type: 'Diagnosis' },
      'hyperlipidemia': { code: 'ICD-10-CM: E78.5', type: 'Diagnosis' },
      'neovascular glaucoma': { code: 'ICD-10-CM: H40.59', type: 'Diagnosis' },
      'vitreous hemorrhage': { code: 'ICD-10-CM: H43.13', type: 'Diagnosis' },
      'diabetic macular edema': { code: 'ICD-10-CM: E11.351', type: 'Diagnosis' },
      'mild cognitive impairment': { code: 'ICD-10-CM: G31.84', type: 'Diagnosis' },
      'aflibercept': { code: 'RxNorm: 1150495', type: 'Drug' },
      'eylea': { code: 'RxNorm: 1150495', type: 'Drug' },
      'lisinopril': { code: 'RxNorm: 29046', type: 'Drug' },
      'atorvastatin': { code: 'RxNorm: 83367', type: 'Drug' },
      'solanezumab-beta': { code: 'RxNorm: 1443577', type: 'Drug' },
      'gnt-889': { code: 'RxNorm: 1443577', type: 'Drug' },
    };

    let codeHtml = '';
    const matchedKey = Object.keys(MEDICAL_CODES).find(k => lookupKey.includes(k) || k.includes(lookupKey));
    if (matchedKey) {
      const info = MEDICAL_CODES[matchedKey];
      const isDrug = info.type === 'Drug';
      const badgeStyle = isDrug 
        ? "background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);" 
        : "background: rgba(139, 92, 246, 0.15); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.3);";
      
      codeHtml = `<div style="margin-bottom: 12px; padding: 6px 10px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 700; display: inline-block; ${badgeStyle}">${info.code} (${info.type})</div>`;
    }

    this.detailBody.innerHTML = `
      ${codeHtml}
      <div style="font-size:12.5px; color:var(--text-secondary); line-height:1.5;">
        <strong>Entity Type:</strong> ${node.type.toUpperCase()}<br><br>
        <strong>Description & Context:</strong><br>
        ${node.details}
      </div>
    `;
    this.selectedNodeId = node.id;
    this.selectedNodeLabel = node.label;
    this.selectedNodeType = node.type;
    this.selectedNodeDetails = node.details;
  }

  // Filter nodes interactively on search input
  filterNodes(searchText) {
    if (!this.nodeElements) return;
    const searchLower = searchText.trim().toLowerCase();
    
    this.nodeElements.forEach(ne => {
      const match = !searchLower || 
        ne.node.label.toLowerCase().includes(searchLower) || 
        ne.node.details.toLowerCase().includes(searchLower) ||
        ne.node.type.toLowerCase().includes(searchLower);
      
      ne.g.style.opacity = match ? '1' : '0.15';
    });

    if (this.linkElements) {
      this.linkElements.forEach(le => {
        const sourceNode = this.nodes.find(n => n.id === le.source);
        const targetNode = this.nodes.find(n => n.id === le.target);
        const match = !searchLower || 
          (sourceNode && (sourceNode.label.toLowerCase().includes(searchLower) || sourceNode.details.toLowerCase().includes(searchLower))) ||
          (targetNode && (targetNode.label.toLowerCase().includes(searchLower) || targetNode.details.toLowerCase().includes(searchLower)));
        
        le.line.style.opacity = match ? '1' : '0.1';
        le.text.style.opacity = match ? '1' : '0.1';
      });
    }
  }
}

// Export class globally
window.GraphRenderer = GraphRenderer;
