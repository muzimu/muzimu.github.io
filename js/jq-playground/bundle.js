/**
 * JQ Playground - Enhanced with JSON/YAML/XML/CSV format support,
 * Tree View, Graph View, and Generate Types functionality.
 */
(()=>{

// ===== Format Converter =====
class FormatConverter {
  static async toJson(value, format) {
    if (!value || !value.trim()) return {};
    try {
      if (format === 'json') {
        return JSON.parse(value);
      }
      if (format === 'yaml') {
        if (typeof jsyaml === 'undefined') throw new Error('js-yaml not loaded');
        return jsyaml.load(value);
      }
      if (format === 'xml') {
        const domParser = new DOMParser();
        // Strip XML declaration and try to detect multiple root elements
        const stripped = value.replace(/<\?xml[^?]*\?>/i, '').trim();
        // Wrap in a root if multiple top-level elements detected
        const wrappedValue = /^<[^/!?][^>]*>[\s\S]*<\/[^>]+>\s*<[^/!?]/.test(stripped)
          ? `<__root__>${stripped}</__root__>` : value;
        const doc = domParser.parseFromString(wrappedValue, 'text/xml');
        const parseError = doc.querySelector('parsererror');
        if (parseError) throw new Error('XML parse error: ' + parseError.textContent);
        function xmlNodeToObj(node) {
          if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
            const text = node.textContent.trim();
            return text || undefined;
          }
          if (node.nodeType !== Node.ELEMENT_NODE) return undefined;
          const obj = {};
          // attributes
          for (const attr of node.attributes) {
            obj['$' + attr.name] = attr.value;
          }
          // children
          const children = Array.from(node.childNodes).filter(n =>
            (n.nodeType === Node.ELEMENT_NODE) ||
            (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) ||
            n.nodeType === Node.CDATA_SECTION_NODE
          );
          if (children.length === 0) {
            const text = node.textContent.trim();
            if (Object.keys(obj).length === 0) return text || '';
            if (text) obj['#text'] = text;
            return obj;
          }
          const elementChildren = children.filter(n => n.nodeType === Node.ELEMENT_NODE);
          if (elementChildren.length === 0) {
            const text = node.textContent.trim();
            if (Object.keys(obj).length === 0) return text;
            obj['#text'] = text;
            return obj;
          }
          const tagNames = elementChildren.map(n => n.nodeName);
          const hasDuplicates = tagNames.length !== new Set(tagNames).size;
          if (hasDuplicates) {
            const grouped = {};
            for (const child of elementChildren) {
              const key = child.nodeName;
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(xmlNodeToObj(child));
            }
            Object.assign(obj, grouped);
          } else {
            for (const child of elementChildren) {
              obj[child.nodeName] = xmlNodeToObj(child);
            }
          }
          return obj;
        }
        const root = doc.documentElement;
        if (!root) return {};
        // If we wrapped in __root__, return its children as a flat object
        if (root.nodeName === '__root__') {
          const result = {};
          for (const child of Array.from(root.childNodes)) {
            if (child.nodeType === Node.ELEMENT_NODE) {
              const key = child.nodeName;
              if (key in result) {
                if (!Array.isArray(result[key])) result[key] = [result[key]];
                result[key].push(xmlNodeToObj(child));
              } else {
                result[key] = xmlNodeToObj(child);
              }
            }
          }
          return result;
        }
        return { [root.nodeName]: xmlNodeToObj(root) };
      }
      if (format === 'csv') {
        if (typeof Papa === 'undefined') throw new Error('PapaParse not loaded');
        const result = Papa.parse(value, { header: true, skipEmptyLines: true, dynamicTyping: true });
        return result.data;
      }
    } catch (e) {
      throw new Error(`Parse error (${format}): ${e.message}`);
    }
    return {};
  }

  static async fromJson(json, format) {
    try {
      const obj = typeof json === 'string' ? JSON.parse(json) : json;
      if (format === 'json') return JSON.stringify(obj, null, 2);
      if (format === 'yaml') {
        if (typeof jsyaml === 'undefined') throw new Error('js-yaml not loaded');
        return jsyaml.dump(obj);
      }
      if (format === 'xml') {
        function jsonToXml(obj, indent) {
          indent = indent || 0;
          const pad = '  '.repeat(indent);
          if (obj === null || obj === undefined) return '';
          if (typeof obj !== 'object') return String(obj);
          if (Array.isArray(obj)) {
            return obj.map(item => jsonToXml(item, indent)).join('\n');
          }
          return Object.keys(obj).map(key => {
            const val = obj[key];
            if (Array.isArray(val)) {
              return val.map(item => {
                if (typeof item === 'object' && item !== null) {
                  return `${pad}<${key}>\n${jsonToXml(item, indent+1)}\n${pad}</${key}>`;
                }
                return `${pad}<${key}>${item}</${key}>`;
              }).join('\n');
            }
            if (typeof val === 'object' && val !== null) {
              return `${pad}<${key}>\n${jsonToXml(val, indent+1)}\n${pad}</${key}>`;
            }
            return `${pad}<${key}>${val === null ? '' : val}</${key}>`;
          }).join('\n');
        }
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + jsonToXml(obj, 0);
      }
      if (format === 'csv') {
        if (typeof Papa === 'undefined') throw new Error('PapaParse not loaded');
        const data = Array.isArray(obj) ? obj : [obj];
        return Papa.unparse(data);
      }
    } catch(e) {
      throw new Error(`Serialize error (${format}): ${e.message}`);
    }
    return json;
  }
}

// ===== Tree Renderer =====
class TreeRenderer {
  constructor(container) {
    this.container = container;
    this.container.classList.add('jq-tree-view');
  }

  render(data) {
    this.container.innerHTML = '';
    const root = this._buildNode(data, null, true);
    this.container.appendChild(root);
  }

  _buildNode(value, key, isRoot) {
    const wrapper = document.createElement('div');
    wrapper.className = 'jq-tree-node';

    const isObject = value !== null && typeof value === 'object';
    const isArray = Array.isArray(value);

    if (isObject) {
      const entries = isArray ? value.map((v,i)=>[i,v]) : Object.entries(value);
      const count = entries.length;

      const header = document.createElement('div');
      header.className = 'jq-tree-row jq-tree-collapsible';

      const toggle = document.createElement('span');
      toggle.className = 'jq-tree-toggle';
      toggle.textContent = '▾';
      header.appendChild(toggle);

      if (key !== null) {
        const keyEl = document.createElement('span');
        keyEl.className = 'jq-tree-key';
        keyEl.textContent = isRoot ? '' : (isArray ? `[${key}]` : `"${key}"`);
        if (!isRoot) {
          header.appendChild(keyEl);
          const colon = document.createElement('span');
          colon.className = 'jq-tree-colon';
          colon.textContent = ': ';
          header.appendChild(colon);
        }
      }

      const typeLabel = document.createElement('span');
      typeLabel.className = 'jq-tree-type';
      typeLabel.textContent = isArray ? `Array[${count}]` : `Object{${count}}`;
      header.appendChild(typeLabel);

      wrapper.appendChild(header);

      const children = document.createElement('div');
      children.className = 'jq-tree-children';

      for (const [k, v] of entries) {
        children.appendChild(this._buildNode(v, k, false));
      }

      wrapper.appendChild(children);

      header.addEventListener('click', () => {
        const collapsed = children.style.display === 'none';
        children.style.display = collapsed ? '' : 'none';
        toggle.textContent = collapsed ? '▾' : '▸';
        toggle.style.transform = '';
      });
    } else {
      const row = document.createElement('div');
      row.className = 'jq-tree-row';

      const indent = document.createElement('span');
      indent.className = 'jq-tree-indent';
      indent.textContent = '  ';
      row.appendChild(indent);

      if (key !== null) {
        const keyEl = document.createElement('span');
        keyEl.className = 'jq-tree-key';
        keyEl.textContent = typeof key === 'number' ? `[${key}]` : `"${key}"`;
        row.appendChild(keyEl);
        const colon = document.createElement('span');
        colon.className = 'jq-tree-colon';
        colon.textContent = ': ';
        row.appendChild(colon);
      }

      const valEl = document.createElement('span');
      if (value === null) {
        valEl.className = 'jq-tree-value jq-tree-null';
        valEl.textContent = 'null';
      } else if (typeof value === 'boolean') {
        valEl.className = 'jq-tree-value jq-tree-bool';
        valEl.textContent = String(value);
      } else if (typeof value === 'number') {
        valEl.className = 'jq-tree-value jq-tree-number';
        valEl.textContent = String(value);
      } else {
        valEl.className = 'jq-tree-value jq-tree-string';
        valEl.textContent = `"${value}"`;
      }
      row.appendChild(valEl);
      wrapper.appendChild(row);
    }

    return wrapper;
  }
}

// ===== Graph Renderer =====
class GraphRenderer {
  constructor(container) {
    this.container = container;
    this.container.classList.add('jq-graph-view');
    this.nodes = [];
    this.edges = [];
    this.nodeId = 0;
    this.svg = null;
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStart = {x:0,y:0};
  }

  render(data) {
    this.nodes = [];
    this.edges = [];
    this.nodeId = 0;
    this._parseData(data, null);
    this._layout();
    this._draw();
  }

  _parseData(value, parentId) {
    const id = this.nodeId++;
    const isArray = Array.isArray(value);
    const isObject = value !== null && typeof value === 'object';

    if (isObject) {
      const entries = isArray ? value.map((v,i)=>[String(i),v]) : Object.entries(value);
      const preview = isArray
        ? `Array[${entries.length}]`
        : Object.keys(value).slice(0,3).join(', ') + (Object.keys(value).length > 3 ? '...' : '');

      this.nodes.push({ id, label: isArray ? `[]` : `{}`, preview, type: isArray ? 'array' : 'object', width: 160, height: 60 });
      if (parentId !== null) this.edges.push({ from: parentId, to: id });

      for (const [k, v] of entries) {
        const childIsObj = v !== null && typeof v === 'object';
        if (childIsObj) {
          const childId = this.nodeId++;
          const childIsArr = Array.isArray(v);
          const childPreview = childIsArr
            ? `Array[${v.length}]`
            : Object.keys(v).slice(0,3).join(', ') + (Object.keys(v).length > 3 ? '...' : '');
          this.nodes.push({ id: childId, label: k, preview: childPreview, type: childIsArr ? 'array' : 'object', width: 160, height: 60 });
          this.edges.push({ from: id, to: childId });
          // Recurse into value
          for (const [k2, v2] of (childIsArr ? v.map((vi,ii)=>[String(ii),vi]) : Object.entries(v))) {
            if (v2 !== null && typeof v2 === 'object') {
              this._parseDataFrom(v2, childId);
            }
          }
        } else {
          // Leaf values: batch them into parent node's preview
        }
      }

      // Add leaf properties as a single node
      const leaves = entries.filter(([,v]) => v === null || typeof v !== 'object');
      if (leaves.length > 0) {
        const leafId = this.nodeId++;
        const leafContent = leaves.slice(0,5).map(([k,v]) => `${k}: ${JSON.stringify(v)}`).join('\n') + (leaves.length > 5 ? `\n+${leaves.length-5} more` : '');
        this.nodes.push({ id: leafId, label: leafContent, preview: '', type: 'leaf', width: 180, height: Math.min(20 + leaves.length * 18, 120) });
        this.edges.push({ from: id, to: leafId });
      }
    } else {
      this.nodes.push({ id, label: JSON.stringify(value), preview: '', type: 'leaf', width: 140, height: 44 });
      if (parentId !== null) this.edges.push({ from: parentId, to: id });
    }

    return id;
  }

  _parseDataFrom(value, parentId) {
    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((v,i)=>[String(i),v]) : Object.entries(value);
    const leaves = entries.filter(([,v]) => v === null || typeof v !== 'object');
    const objects = entries.filter(([,v]) => v !== null && typeof v === 'object');

    if (leaves.length > 0) {
      const leafId = this.nodeId++;
      const leafContent = leaves.slice(0,5).map(([k,v]) => `${k}: ${JSON.stringify(v)}`).join('\n') + (leaves.length > 5 ? `\n+${leaves.length-5} more` : '');
      this.nodes.push({ id: leafId, label: leafContent, preview: '', type: 'leaf', width: 180, height: Math.min(20 + leaves.length * 18, 120) });
      this.edges.push({ from: parentId, to: leafId });
    }
  }

  _layout() {
    // Simple layered layout using BFS
    const nodeMap = {};
    for (const n of this.nodes) nodeMap[n.id] = n;

    const inDegree = {};
    for (const n of this.nodes) inDegree[n.id] = 0;
    for (const e of this.edges) inDegree[e.to] = (inDegree[e.to] || 0) + 1;

    const roots = this.nodes.filter(n => inDegree[n.id] === 0);
    const layers = [];
    const visited = new Set();
    let queue = roots.map(n => n.id);
    visited.add(...(queue.length ? queue : []));

    while (queue.length > 0) {
      layers.push([...queue]);
      const next = [];
      for (const id of queue) {
        for (const e of this.edges) {
          if (e.from === id && !visited.has(e.to)) {
            visited.add(e.to);
            next.push(e.to);
          }
        }
      }
      queue = next;
    }

    const HGAP = 40, VGAP = 60;
    for (let l = 0; l < layers.length; l++) {
      const layer = layers[l];
      const totalH = layer.reduce((s, id) => s + (nodeMap[id] ? nodeMap[id].height : 60), 0) + (layer.length - 1) * VGAP;
      let y = -totalH / 2;
      for (const id of layer) {
        const n = nodeMap[id];
        if (n) {
          n.x = l * (180 + HGAP);
          n.y = y;
          y += n.height + VGAP;
        }
      }
    }
  }

  _draw() {
    this.container.innerHTML = '';

    const isDark = document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';

    // Controls
    const controls = document.createElement('div');
    controls.className = 'jq-graph-controls';
    controls.innerHTML = `
      <button class="jq-graph-ctrl-btn" id="jq-graph-zoom-in">+</button>
      <button class="jq-graph-ctrl-btn" id="jq-graph-zoom-out">-</button>
      <button class="jq-graph-ctrl-btn" id="jq-graph-reset">⟳</button>
    `;
    this.container.appendChild(controls);

    const svgContainer = document.createElement('div');
    svgContainer.className = 'jq-graph-svg-container';
    this.container.appendChild(svgContainer);

    if (this.nodes.length === 0) {
      svgContainer.innerHTML = '<div class="jq-graph-empty">No data to visualize</div>';
      return;
    }

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    this.svg = svg;

    const defs = document.createElementNS(NS, 'defs');
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', 'arrow');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points', '0 0, 10 3.5, 0 7');
    poly.setAttribute('fill', isDark ? '#555' : '#aaa');
    marker.appendChild(poly);
    defs.appendChild(marker);
    svg.appendChild(defs);

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('id', 'jq-graph-g');
    svg.appendChild(g);

    const nodeMap = {};
    for (const n of this.nodes) nodeMap[n.id] = n;

    // Draw edges
    for (const e of this.edges) {
      const from = nodeMap[e.from];
      const to = nodeMap[e.to];
      if (!from || !to) continue;

      const x1 = (from.x || 0) + from.width;
      const y1 = (from.y || 0) + from.height / 2;
      const x2 = to.x || 0;
      const y2 = (to.y || 0) + to.height / 2;
      const cx = (x1 + x2) / 2;

      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', isDark ? '#555' : '#ccc');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('marker-end', 'url(#arrow)');
      g.appendChild(path);
    }

    // Draw nodes
    for (const n of this.nodes) {
      const x = n.x || 0;
      const y = n.y || 0;

      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', n.width);
      rect.setAttribute('height', n.height);
      rect.setAttribute('rx', '6');
      rect.setAttribute('ry', '6');

      if (n.type === 'leaf') {
        rect.setAttribute('fill', isDark ? '#2d2d2d' : '#f8f9fa');
        rect.setAttribute('stroke', isDark ? '#404040' : '#dee2e6');
      } else if (n.type === 'array') {
        rect.setAttribute('fill', isDark ? '#1e3a5f' : '#e7f3ff');
        rect.setAttribute('stroke', isDark ? '#2d5fa3' : '#4a9eed');
      } else {
        rect.setAttribute('fill', isDark ? '#1e3a1e' : '#e8f5e9');
        rect.setAttribute('stroke', isDark ? '#2d6b2d' : '#4caf50');
      }
      rect.setAttribute('stroke-width', '1');
      g.appendChild(rect);

      if (n.type !== 'leaf') {
        // Header
        const headerRect = document.createElementNS(NS, 'rect');
        headerRect.setAttribute('x', x);
        headerRect.setAttribute('y', y);
        headerRect.setAttribute('width', n.width);
        headerRect.setAttribute('height', 28);
        headerRect.setAttribute('rx', '6');
        headerRect.setAttribute('ry', '6');
        headerRect.setAttribute('fill', n.type === 'array' ? (isDark ? '#2d5fa3' : '#4a9eed') : (isDark ? '#2d6b2d' : '#4caf50'));
        g.appendChild(headerRect);

        // Fix rounded bottom of header
        const headerFix = document.createElementNS(NS, 'rect');
        headerFix.setAttribute('x', x);
        headerFix.setAttribute('y', y + 14);
        headerFix.setAttribute('width', n.width);
        headerFix.setAttribute('height', 14);
        headerFix.setAttribute('fill', n.type === 'array' ? (isDark ? '#2d5fa3' : '#4a9eed') : (isDark ? '#2d6b2d' : '#4caf50'));
        g.appendChild(headerFix);

        const labelText = document.createElementNS(NS, 'text');
        labelText.setAttribute('x', x + n.width / 2);
        labelText.setAttribute('y', y + 19);
        labelText.setAttribute('text-anchor', 'middle');
        labelText.setAttribute('fill', '#fff');
        labelText.setAttribute('font-size', '12');
        labelText.setAttribute('font-weight', '600');
        labelText.setAttribute('font-family', 'monospace');
        const displayLabel = n.label.length > 20 ? n.label.slice(0, 18) + '...' : n.label;
        labelText.textContent = displayLabel;
        g.appendChild(labelText);

        const previewText = document.createElementNS(NS, 'text');
        previewText.setAttribute('x', x + 8);
        previewText.setAttribute('y', y + 48);
        previewText.setAttribute('fill', isDark ? '#aaa' : '#666');
        previewText.setAttribute('font-size', '11');
        previewText.setAttribute('font-family', 'monospace');
        const previewStr = n.preview.length > 22 ? n.preview.slice(0,20) + '...' : n.preview;
        previewText.textContent = previewStr;
        g.appendChild(previewText);
      } else {
        // Leaf node: multi-line text
        const lines = n.label.split('\n');
        lines.forEach((line, i) => {
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', x + 8);
          t.setAttribute('y', y + 16 + i * 18);
          t.setAttribute('fill', isDark ? '#ccc' : '#333');
          t.setAttribute('font-size', '11');
          t.setAttribute('font-family', 'monospace');
          const displayLine = line.length > 24 ? line.slice(0,22) + '…' : line;
          t.textContent = displayLine;
          g.appendChild(t);
        });
      }
    }

    svgContainer.appendChild(svg);

    // Pan/zoom
    this.scale = 1;
    this.panX = 40;
    this.panY = 200;
    this._updateTransform(g);

    svgContainer.addEventListener('mousedown', e => {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
      svgContainer.style.cursor = 'grabbing';
    });
    svgContainer.addEventListener('mousemove', e => {
      if (!this.isPanning) return;
      this.panX = e.clientX - this.panStart.x;
      this.panY = e.clientY - this.panStart.y;
      this._updateTransform(g);
    });
    svgContainer.addEventListener('mouseup', () => { this.isPanning = false; svgContainer.style.cursor = 'grab'; });
    svgContainer.addEventListener('mouseleave', () => { this.isPanning = false; svgContainer.style.cursor = 'grab'; });
    svgContainer.style.cursor = 'grab';

    svgContainer.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale = Math.max(0.2, Math.min(3, this.scale * delta));
      this._updateTransform(g);
    }, { passive: false });

    document.getElementById('jq-graph-zoom-in').addEventListener('click', () => {
      this.scale = Math.min(3, this.scale * 1.2);
      this._updateTransform(g);
    });
    document.getElementById('jq-graph-zoom-out').addEventListener('click', () => {
      this.scale = Math.max(0.2, this.scale / 1.2);
      this._updateTransform(g);
    });
    document.getElementById('jq-graph-reset').addEventListener('click', () => {
      this.scale = 1;
      this.panX = 40;
      this.panY = 200;
      this._updateTransform(g);
    });
  }

  _updateTransform(g) {
    g.setAttribute('transform', `translate(${this.panX},${this.panY}) scale(${this.scale})`);
  }
}

// ===== Type Generator =====
class TypeGenerator {
  static async generate(json, language) {
    if (!json || !json.trim()) return '';
    try {
      const obj = JSON.parse(json);
      if (language === 'go') return TypeGenerator._json2go(json);
      if (language === 'typescript' || language === 'typescript/typealias') return TypeGenerator._json2ts(obj, 'Root');
      if (language === 'kotlin') return TypeGenerator._json2kotlin(obj, 'Root');
      if (language === 'rust') return TypeGenerator._json2rust(obj, 'Root');
      if (language === 'json_schema') return TypeGenerator._json2schema(obj, 'Root');
      return `// Unsupported language: ${language}`;
    } catch(e) {
      return `// Error: ${e.message}`;
    }
  }

  // TypeScript generator
  static _json2ts(obj, name, interfaces = []) {
    const lines = [`interface ${name} {`];
    for (const [k, v] of Object.entries(obj)) {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : `"${k}"`;
      lines.push(`  ${safeKey}: ${TypeGenerator._tsType(v, name + TypeGenerator._cap(k), interfaces)};`);
    }
    lines.push('}');
    interfaces.unshift(lines.join('\n'));
    return interfaces.join('\n\n');
  }

  static _tsType(v, name, interfaces) {
    if (v === null) return 'null';
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'string') return 'string';
    if (Array.isArray(v)) {
      if (v.length === 0) return 'unknown[]';
      const t = TypeGenerator._tsType(v[0], name + 'Item', interfaces);
      return `${t}[]`;
    }
    if (typeof v === 'object') {
      TypeGenerator._json2ts(v, name, interfaces);
      return name;
    }
    return 'unknown';
  }

  // Kotlin generator
  static _json2kotlin(obj, name, classes = []) {
    const lines = [`data class ${name}(`];
    const fields = [];
    for (const [k, v] of Object.entries(obj)) {
      const fieldName = TypeGenerator._camel(k);
      const typeName = TypeGenerator._kotlinType(v, name + TypeGenerator._cap(k), classes);
      fields.push(`    @SerializedName("${k}") val ${fieldName}: ${typeName}`);
    }
    lines.push(fields.join(',\n'));
    lines.push(')');
    classes.unshift(lines.join('\n'));
    return classes.join('\n\n');
  }

  static _kotlinType(v, name, classes) {
    if (v === null) return 'Any?';
    if (typeof v === 'boolean') return 'Boolean';
    if (typeof v === 'number') return Number.isInteger(v) ? 'Int' : 'Double';
    if (typeof v === 'string') return 'String';
    if (Array.isArray(v)) {
      if (v.length === 0) return 'List<Any>';
      return `List<${TypeGenerator._kotlinType(v[0], name + 'Item', classes)}>`;
    }
    if (typeof v === 'object') {
      TypeGenerator._json2kotlin(v, name, classes);
      return name;
    }
    return 'Any';
  }

  // Rust generator
  static _json2rust(obj, name) {
    const structs = [];
    TypeGenerator._rustStruct(obj, name, structs);
    return 'use serde::{Serialize, Deserialize};\n\n' + structs.reverse().join('\n\n');
  }

  static _rustStruct(obj, name, structs) {
    const lines = ['#[derive(Debug, Serialize, Deserialize)]', `pub struct ${name} {`];
    for (const [k, v] of Object.entries(obj)) {
      const fieldName = k.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const typeName = TypeGenerator._rustType(v, name + TypeGenerator._cap(k), structs);
      if (fieldName !== k) lines.push(`    #[serde(rename = "${k}")]`);
      lines.push(`    pub ${fieldName}: ${typeName},`);
    }
    lines.push('}');
    structs.push(lines.join('\n'));
  }

  static _rustType(v, name, structs) {
    if (v === null) return 'Option<serde_json::Value>';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'number') return Number.isInteger(v) ? 'i64' : 'f64';
    if (typeof v === 'string') return 'String';
    if (Array.isArray(v)) {
      if (v.length === 0) return 'Vec<serde_json::Value>';
      return `Vec<${TypeGenerator._rustType(v[0], name + 'Item', structs)}>`;
    }
    if (typeof v === 'object') {
      TypeGenerator._rustStruct(v, name, structs);
      return name;
    }
    return 'serde_json::Value';
  }

  // JSON Schema generator
  static _json2schema(obj, title) {
    function toSchema(v) {
      if (v === null) return { type: 'null' };
      if (typeof v === 'boolean') return { type: 'boolean' };
      if (typeof v === 'number') return { type: Number.isInteger(v) ? 'integer' : 'number' };
      if (typeof v === 'string') return { type: 'string' };
      if (Array.isArray(v)) {
        return { type: 'array', items: v.length > 0 ? toSchema(v[0]) : {} };
      }
      if (typeof v === 'object') {
        const props = {};
        for (const [k, val] of Object.entries(v)) props[k] = toSchema(val);
        return { type: 'object', properties: props, required: Object.keys(v) };
      }
      return {};
    }
    const schema = { $schema: 'http://json-schema.org/draft-07/schema#', title, ...toSchema(obj) };
    return JSON.stringify(schema, null, 2);
  }

  // Simple Go type generator
  static _json2go(jsonStr) {
    try {
      const obj = JSON.parse(jsonStr);
      const structs = [];
      TypeGenerator._goStruct(obj, 'Root', structs);
      return structs.join('\n\n');
    } catch(e) {
      return `// Error parsing JSON: ${e.message}`;
    }
  }

  static _goStruct(obj, name, structs) {
    if (obj === null || typeof obj !== 'object') return TypeGenerator._goType(obj);
    if (Array.isArray(obj)) {
      const item = obj[0];
      if (item && typeof item === 'object') {
        TypeGenerator._goStruct(item, name + 'Item', structs);
        return '[]' + name + 'Item';
      }
      return '[]' + TypeGenerator._goType(item);
    }

    const lines = [`type ${name} struct {`];
    for (const [k, v] of Object.entries(obj)) {
      const fieldName = k.charAt(0).toUpperCase() + k.slice(1).replace(/[^a-zA-Z0-9]/g, '');
      let typeName;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const subName = name + fieldName;
        TypeGenerator._goStruct(v, subName, structs);
        typeName = subName;
      } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        const subName = name + fieldName + 'Item';
        TypeGenerator._goStruct(v[0], subName, structs);
        typeName = '[]' + subName;
      } else {
        typeName = TypeGenerator._goType(v);
      }
      lines.push(`\t${fieldName} ${typeName} \`json:"${k}"\``);
    }
    lines.push('}');
    structs.push(lines.join('\n'));
    return name;
  }

  static _goType(v) {
    if (v === null) return 'interface{}';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float64';
    if (typeof v === 'string') return 'string';
    if (Array.isArray(v)) return '[]interface{}';
    return 'interface{}';
  }

  // Capitalize first letter, strip non-alphanumeric
  static _cap(s) {
    if (!s) return 'Field';
    const clean = s.replace(/[^a-zA-Z0-9]/g, '_');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  // camelCase converter
  static _camel(s) {
    if (!s) return 'field';
    return s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
            .replace(/^[^a-zA-Z]/, '_');
  }
}

// ===== Main JQPlayground Class =====
class JQPlayground {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container "${containerId}" not found`);
    this.worker = null;
    this.runId = 0;
    this.debounceTimer = null;
    this.editors = {};
    this.currentFormat = 'json';
    this.currentView = 'editor'; // editor | tree | graph
    this.treeRenderer = null;
    this.graphRenderer = null;
    this.typesVisible = false;
    this.currentTypeLang = 'typescript';
    // i18n labels from data attributes
    const d = this.container.dataset;
    this.i18n = {
      format: d.i18nFormat || 'Format',
      view: d.i18nView || 'View',
      editor: d.i18nEditor || 'Editor',
      tree: d.i18nTree || 'Tree',
      graph: d.i18nGraph || 'Graph',
      generateTypes: d.i18nGenerateTypes || 'Generate Types',
      prettify: d.i18nPrettify || 'Prettify',
    };
    this.init();
  }

  init() {
    this.render();
    this.initMonaco();
    this.initWorker();
    this.attachEventListeners();
    setTimeout(() => this.run(), 300);
  }

  render() {
    this.container.innerHTML = `
      <div class="jq-playground">
        <div class="jq-toolbar">
          <div class="jq-toolbar-group">
            <span class="jq-toolbar-label">${this.i18n.format}:</span>
            <div class="jq-tab-group" id="jq-format-tabs">
              <button class="jq-tab active" data-format="json">JSON</button>
              <button class="jq-tab" data-format="yaml">YAML</button>
              <button class="jq-tab" data-format="xml">XML</button>
              <button class="jq-tab" data-format="csv">CSV</button>
            </div>
          </div>
          <div class="jq-toolbar-group">
            <span class="jq-toolbar-label">${this.i18n.view}:</span>
            <div class="jq-tab-group" id="jq-view-tabs">
              <button class="jq-tab active" data-view="editor">${this.i18n.editor}</button>
              <button class="jq-tab" data-view="tree">${this.i18n.tree}</button>
              <button class="jq-tab" data-view="graph">${this.i18n.graph}</button>
            </div>
          </div>
          <div class="jq-toolbar-group jq-toolbar-right">
            <button class="jq-btn jq-btn-primary" id="jq-gen-types-btn">${this.i18n.generateTypes}</button>
          </div>
        </div>

        <div id="jq-types-panel" class="jq-types-panel" style="display:none;">
          <div class="jq-types-header">
            <span>${this.i18n.generateTypes}</span>
            <div class="jq-types-lang-group">
              <select id="jq-types-lang">
                <option value="typescript">TypeScript</option>
                <option value="typescript/typealias">TypeScript (combined)</option>
                <option value="go">Go</option>
                <option value="json_schema">JSON Schema</option>
                <option value="kotlin">Kotlin</option>
                <option value="rust">Rust</option>
              </select>
            </div>
            <button class="jq-btn jq-btn-icon" id="jq-types-copy">Copy</button>
            <button class="jq-btn jq-btn-icon" id="jq-types-close">✕</button>
          </div>
          <div id="jq-types-output" class="jq-types-output"></div>
        </div>

        <div class="jq-playground-grid">
          <div class="jq-playground-left">
            <div class="jq-editor-container jq-query-container">
              <div class="jq-editor-header">
                <span>Query (jq)</span>
              </div>
              <div id="jq-query-editor" class="jq-editor"></div>
            </div>
            <div class="jq-editor-container jq-input-container">
              <div class="jq-editor-header">
                <span id="jq-input-label">JSON Input</span>
              </div>
              <div id="jq-json-editor" class="jq-editor"></div>
            </div>
          </div>
          <div class="jq-playground-right">
            <div class="jq-editor-container jq-output-container">
              <div class="jq-editor-header">
                <span>Output</span>
                <span id="jq-status" class="jq-status"></span>
              </div>
              <div id="jq-output-editor" class="jq-editor" style="display:none;"></div>
              <div id="jq-tree-container" class="jq-editor jq-view-container" style="display:none;overflow:auto;"></div>
              <div id="jq-graph-container" class="jq-editor jq-view-container" style="display:none;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  initMonaco() {
    if (typeof monaco === 'undefined') { console.error('Monaco not loaded'); return; }
    const theme = document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs';

    this.editors.query = monaco.editor.create(document.getElementById('jq-query-editor'), {
      value: '.', language: 'plaintext', theme, minimap: { enabled: false },
      lineNumbers: 'off', scrollBeyondLastLine: false, fontSize: 14,
      automaticLayout: true, wordWrap: 'on',
      lineDecorationsWidth: 0, lineNumbersMinChars: 0, glyphMargin: false,
      folding: false, scrollbar: { vertical: 'auto', horizontal: 'auto', verticalScrollbarSize: 10, horizontalScrollbarSize: 10 }
    });

    this.editors.json = monaco.editor.create(document.getElementById('jq-json-editor'), {
      value: `{\n  "name": "John",\n  "age": 30,\n  "city": "New York"\n}`,
      language: 'json', theme, minimap: { enabled: false },
      lineNumbers: 'on', scrollBeyondLastLine: false, fontSize: 13,
      automaticLayout: true, scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 }
    });

    this.editors.output = monaco.editor.create(document.getElementById('jq-output-editor'), {
      value: '', language: 'json', theme, minimap: { enabled: false },
      lineNumbers: 'on', scrollBeyondLastLine: false, fontSize: 13,
      readOnly: true, automaticLayout: true,
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 }
    });

    this.editors.query.onDidChangeModelContent(() => this.scheduleRun());
    this.editors.json.onDidChangeModelContent(() => this.scheduleRun());

    // Show editor view by default
    document.getElementById('jq-output-editor').style.display = '';
  }

  initWorker() {
    const url = this.container.dataset.workerUrl || '/js/jq-playground/worker.js';
    this.worker = new Worker(url);
    this.worker.addEventListener('message', e => {
      const { id, success, output, error } = e.data;
      if (id !== this.runId) return;
      const status = document.getElementById('jq-status');
      if (success) {
        if (this.currentView === 'editor') {
          this.editors.output.setValue(output);
        } else {
          this._renderView(output);
        }
        status.textContent = '✓';
        status.className = 'jq-status jq-status-success';
      } else {
        if (this.currentView === 'editor') this.editors.output.setValue(`Error: ${error}`);
        status.textContent = '✗';
        status.className = 'jq-status jq-status-error';
      }
    });
    this.worker.addEventListener('error', e => {
      console.error('Worker error:', e);
    });
  }

  scheduleRun() {
    clearTimeout(this.debounceTimer);
    const s = document.getElementById('jq-status');
    s.textContent = '⋯'; s.className = 'jq-status jq-status-running';
    this.debounceTimer = setTimeout(() => this.run(), 500);
  }

  async run() {
    let input = this.editors.json.getValue();
    const query = this.editors.query.getValue();
    if (!input.trim() || !query.trim()) { this.editors.output.setValue(''); return; }

    // Convert non-JSON formats to JSON for jq processing
    if (this.currentFormat !== 'json') {
      try {
        const obj = await FormatConverter.toJson(input, this.currentFormat);
        input = JSON.stringify(obj, null, 2);
      } catch(e) {
        const s = document.getElementById('jq-status');
        s.textContent = '✗'; s.className = 'jq-status jq-status-error';
        if (this.currentView === 'editor') this.editors.output.setValue(`Parse Error: ${e.message}`);
        return;
      }
    }

    this.runId++;
    this.worker.postMessage({ id: this.runId, json: input, query, options: [] });
  }

  async _renderView(jsonOutput) {
    try {
      const obj = JSON.parse(jsonOutput);
      if (this.currentView === 'tree') {
        const container = document.getElementById('jq-tree-container');
        if (!this.treeRenderer) this.treeRenderer = new TreeRenderer(container);
        this.treeRenderer.render(obj);
      } else if (this.currentView === 'graph') {
        const container = document.getElementById('jq-graph-container');
        if (!this.graphRenderer) this.graphRenderer = new GraphRenderer(container);
        this.graphRenderer.render(obj);
      }
    } catch(e) {
      // If parse fails, just show in editor
      this.editors.output.setValue(jsonOutput);
    }
  }

  switchView(view) {
    this.currentView = view;
    const editorEl = document.getElementById('jq-output-editor');
    const treeEl = document.getElementById('jq-tree-container');
    const graphEl = document.getElementById('jq-graph-container');

    editorEl.style.display = 'none';
    treeEl.style.display = 'none';
    graphEl.style.display = 'none';

    if (view === 'editor') {
      editorEl.style.display = '';
    } else if (view === 'tree') {
      treeEl.style.display = '';
      // Re-render with current output
      const currentJson = this.editors.output.getValue();
      if (currentJson.trim()) this._renderView(currentJson);
    } else if (view === 'graph') {
      graphEl.style.display = '';
      const currentJson = this.editors.output.getValue();
      if (currentJson.trim()) this._renderView(currentJson);
    }
  }

  async switchFormat(format) {
    if (format === this.currentFormat) return;

    const currentValue = this.editors.json.getValue();
    const oldFormat = this.currentFormat;
    this.currentFormat = format;

    // Update input label
    document.getElementById('jq-input-label').textContent = format.toUpperCase() + ' Input';

    // Update Monaco language
    const langMap = { json: 'json', yaml: 'yaml', xml: 'xml', csv: 'plaintext' };
    const model = this.editors.json.getModel();
    if (model) monaco.editor.setModelLanguage(model, langMap[format] || 'plaintext');

    if (currentValue.trim()) {
      try {
        // Convert current content to new format
        const obj = await FormatConverter.toJson(currentValue, oldFormat);
        const newContent = await FormatConverter.fromJson(JSON.stringify(obj), format);
        this.editors.json.setValue(newContent);
      } catch(e) {
        // Keep existing content if conversion fails
        console.warn('Format conversion failed:', e.message);
      }
    }

    this.scheduleRun();
  }

  async showTypesPanel() {
    const panel = document.getElementById('jq-types-panel');
    panel.style.display = '';
    this.typesVisible = true;
    await this.generateTypes();
  }

  hideTypesPanel() {
    document.getElementById('jq-types-panel').style.display = 'none';
    this.typesVisible = false;
  }

  async generateTypes() {
    const output = document.getElementById('jq-types-output');
    output.textContent = 'Generating...';

    // Get JSON content (convert if needed)
    let jsonStr = this.editors.json.getValue();
    if (this.currentFormat !== 'json') {
      try {
        const obj = await FormatConverter.toJson(jsonStr, this.currentFormat);
        jsonStr = JSON.stringify(obj, null, 2);
      } catch(e) {
        output.textContent = `// Error: ${e.message}`;
        return;
      }
    }

    const lang = this.currentTypeLang;
    const result = await TypeGenerator.generate(jsonStr, lang);
    output.textContent = result;

    // Syntax highlight via Monaco if available
    if (typeof monaco !== 'undefined') {
      const langMap = {
        'typescript': 'typescript',
        'typescript/typealias': 'typescript',
        'go': 'go',
        'json_schema': 'json',
        'kotlin': 'kotlin',
        'rust': 'rust',
      };
      // Simple keyword coloring via CSS class
      output.className = 'jq-types-output language-' + (langMap[lang] || 'plaintext');
    }
  }

  attachEventListeners() {
    // Format tabs
    document.getElementById('jq-format-tabs').addEventListener('click', async e => {
      const btn = e.target.closest('[data-format]');
      if (!btn) return;
      document.querySelectorAll('#jq-format-tabs .jq-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await this.switchFormat(btn.dataset.format);
    });

    // View tabs
    document.getElementById('jq-view-tabs').addEventListener('click', e => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;
      document.querySelectorAll('#jq-view-tabs .jq-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.switchView(btn.dataset.view);
    });

    // Generate Types button
    document.getElementById('jq-gen-types-btn').addEventListener('click', () => {
      if (this.typesVisible) {
        this.hideTypesPanel();
      } else {
        this.showTypesPanel();
      }
    });

    // Types close button
    document.getElementById('jq-types-close').addEventListener('click', () => this.hideTypesPanel());

    // Types language select
    document.getElementById('jq-types-lang').addEventListener('change', async e => {
      this.currentTypeLang = e.target.value;
      await this.generateTypes();
    });

    // Types copy button
    document.getElementById('jq-types-copy').addEventListener('click', () => {
      const text = document.getElementById('jq-types-output').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('jq-types-copy');
        const orig = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(() => btn.textContent = orig, 2000);
      });
    });
  }

  destroy() {
    this.worker && this.worker.terminate();
    Object.values(this.editors).forEach(e => e.dispose());
  }
}

window.JQPlayground = JQPlayground;

})();
