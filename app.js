/* Autoresearch: a buildless, evidence-backed interactive report. */
'use strict';
(() => {
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const colors = {a1: getComputedStyle(document.documentElement).getPropertyValue('--a1').trim() || '#a3432a', hysparse2: '#247a73', neutral: '#7b7b6e'};
  const labels = {a1: 'A1', hysparse2: 'HySparse2'};
  const state = {architecture: 'a1', layer: 3, gate: 'output', denseContext: 16384, denseMetric: 'hits', trainingView: 'late', benchmark: 'corpora', contextCorpus: 'fwedu_val', passkey: '32k', induction: 'natural'};
  let data = null;
  const fmt = (n, digits = 3) => Number(n).toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits});
  const count = n => Number(n).toLocaleString('en-US', {maximumFractionDigits: 0});
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function svgNode(tag, attrs = {}, text) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function add(parent, tag, attrs = {}, text) { const n = svgNode(tag, attrs, text); parent.appendChild(n); return n; }
  function chartWidth(host) { return Math.max(200, Math.round(host.clientWidth || 300)); }
  function wrappedText(parent, attrs, value, maxWidth, lineHeight = 16) {
    const text = add(parent, 'text', attrs);
    let line = [], span = add(text, 'tspan', {x: attrs.x, dy: 0});
    String(value).split(/\s+/).forEach(word => {
      line.push(word); span.textContent = line.join(' ');
      if (line.length > 1 && span.getComputedTextLength() > maxWidth) {
        line.pop(); span.textContent = line.join(' ');
        line = [word]; span = add(text, 'tspan', {x: attrs.x, dy: lineHeight}, word);
      }
    });
    return text;
  }
  function activate(attribute, value) {
    $$(`[${attribute}]`).forEach(b => { const on = b.getAttribute(attribute) === String(value); b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); });
  }
  function controls(attribute, callback) {
    $$(`[${attribute}]`).forEach(b => b.addEventListener('click', () => { activate(attribute, b.getAttribute(attribute)); callback(b.getAttribute(attribute)); }));
  }
  function makeLayer(kind, i, text, name) {
    return `<button class="layer-node ${kind}" data-layer="${i}" aria-label="${esc(name)}" aria-pressed="${i === state.layer}" title="${esc(name)}">${text}</button>`;
  }
  function renderArchitecture() {
    const a1 = state.architecture === 'a1';
    let html = `<div class="architecture-topline"><strong>${a1 ? '18 recurrent + 6 global layers' : '25 self + 24 cross-decoder layers'}</strong><span>${a1 ? '1.269B TOTAL PARAMETERS · WIDTH 2,048' : '1.265B TOTAL PARAMETERS · WIDTH 1,024'}</span></div>`;
    if (a1) {
      html += '<div class="layer-groups">';
      for (let group = 0; group < 6; group++) {
        html += '<div class="layer-group"><div class="layer-group-inner">';
        for (let j = 0; j < 4; j++) {
          const i = group * 4 + j, global = j === 3;
          html += makeLayer(global ? 'mla' : 'kda', i, global ? 'A' : 'K', `Layer ${i + 1} of 24: ${global ? 'output-gated dense MLA' : 'Kimi Delta Attention'}`);
        }
        html += `</div><span class="group-index">BLOCK ${group + 1}</span></div>`;
      }
      html += '</div><div class="layer-key"><span><i class="kda"></i>K · KDA recurrent memory</span><span><i class="mla"></i>A · global MLA attention</span></div>';
    } else {
      html += '<div class="hy-label"><span>SELF DECODER · 25 LAYERS</span><span>01 → 25</span></div><div class="hy-self">';
      for (let i = 0; i < 25; i++) html += makeLayer(i === 12 ? 'full' : 'swa', i, i === 12 ? 'F' : 'L', `Self layer ${i + 1}: ${i === 12 ? 'full attention; its input supplies the KV bridge' : 'local attention, window 128'}`);
      html += '</div><div class="hy-bridge">↓ Layer 13 input → independent KV projections for each cross group ↓</div><div class="hy-label"><span>CROSS DECODER · FOUR GROUPS OF SIX</span><span>26 → 49</span></div><div class="hy-cross">';
      for (let group = 0; group < 4; group++) {
        html += '<div><div class="layer-group-inner">';
        for (let j = 0; j < 6; j++) {
          const i = 25 + group * 6 + j;
          html += makeLayer(j === 0 ? 'full' : 'sparse', i, j === 0 ? 'F' : 'S', `Layer ${i + 1}, cross group ${group + 1}: ${j === 0 ? 'full cross-attention and token selection' : 'sparse attention with shared KV and indices'}`);
        }
        html += `</div><span class="group-index">GROUP ${group + 1}</span></div>`;
      }
      html += '</div><div class="layer-key"><span><i class="swa"></i>L · local window</span><span><i class="full"></i>F · full attention</span><span><i class="sparse"></i>S · selected tokens</span></div>';
    }
    $('#architecture-diagram').innerHTML = html;
    $$('[data-layer]').forEach(b => b.addEventListener('click', () => {
      state.layer = Number(b.dataset.layer);
      $$('[data-layer]').forEach(n => n.setAttribute('aria-pressed', String(Number(n.dataset.layer) === state.layer)));
      renderLayerDetail();
    }));
    renderLayerDetail();
  }
  function renderLayerDetail() {
    const i = state.layer;
    let title, body;
    if (state.architecture === 'a1') {
      if (i % 4 === 3) {
        title = 'Dense MLA · token-addressable global attention';
        body = 'Stores a compressed representation for each earlier token. Original MLA with an output gate; no learned forget gate. Six global layers connect the recurrent blocks.';
      } else {
        title = 'KDA · fixed-size recurrent memory';
        body = 'Content-dependent, channel-wise decay and delta-rule updates maintain a fixed-size state. Three KDA layers precede each global MLA layer.';
      }
    } else if (i < 25) {
      if (i === 12) {
        title = 'Full self-attention · the bridge source';
        body = 'The input to this full-attention layer supplies independently projected keys and values to all four cross-decoder groups. It is the layer input, not its output or a reused self-attention KV projection.';
      } else {
        title = 'Local self-attention · a 128-token window';
        body = 'Uses sliding-window attention and partial rotary positions. The self decoder contains 24 such local layers and one full-attention layer.';
      }
    } else if ((i - 25) % 6 === 0) {
      title = `Cross group ${Math.floor((i - 25) / 6) + 1} · full attention and selection`;
      body = 'For each query, retains the local 128-token window plus up to 1,024 nonlocal tokens ranked by mean head probabilities. The next five sparse layers reuse the group’s keys, values and these selected indices.';
    } else {
      title = `Cross group ${Math.floor((i - 25) / 6) + 1} · sparse token attention`;
      body = 'Recomputes its own query and attention weights over the group’s shared token support, using shared bridged keys and values. The experiment uses a masked reference backend, not the paper’s optimized sparse kernels.';
    }
    $('#layer-detail').innerHTML = `<span class="mono">LAYER ${String(i + 1).padStart(2, '0')} / ${state.architecture === 'a1' ? '24' : '49'}</span><div><h4>${title}</h4><p>${body}</p></div>`;
  }
  function renderGate() {
    const host = $('#gate-diagram'), w = chartWidth(host), stacked = w < 520, h = stacked ? 292 : 170;
    host.replaceChildren();
    const svg = add(host, 'svg', {viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': state.gate === 'forget' ? 'Forget gate modifies attention scores before the weighted readout' : 'Output gate scales the attention output'});
    const pad = 20, gap = 28, bw = stacked ? Math.min(240, w - 24) : (w - 2 * pad - 2 * gap) / 3;
    const names = [['Attention', 'scores'], ['Weighted', 'values'], ['Layer', 'output']];
    names.forEach((lines, i) => {
      const x = stacked ? (w - bw) / 2 : pad + i * (bw + gap), y = stacked ? 10 + i * 96 : 78, bh = stacked ? 72 : 62;
      const selected = state.gate === 'forget' ? i === 0 : i === 2;
      add(svg, 'rect', {x, y, width: bw, height: bh, fill: selected ? '#e8c7b5' : '#f6f4ee', stroke: selected ? colors.a1 : '#c9c8bb'});
      if (stacked) {
        add(svg, 'text', {x: x + bw / 2, y: y + (selected ? 55 : 42), 'text-anchor': 'middle', fill: '#272924', class: 'diagram-label'}, lines.join(' '));
      } else {
        lines.forEach((t, j) => add(svg, 'text', {x: x + bw / 2, y: y + 26 + j * 18, 'text-anchor': 'middle', fill: '#272924', class: 'diagram-label'}, t));
      }
      if (i < 2) {
        const path = stacked ? `M${w / 2},${y + bh + 4}v16m-4,-4 4,4 4,-4` : `M${x + bw + 4},${y + bh / 2}h${gap - 9}m-4,-4 4,4 -4,4`;
        add(svg, 'path', {d: path, fill: 'none', stroke: '#85877b', 'stroke-width': 1});
      }
      if (selected) {
        const gy = stacked ? y + 8 : 23;
        add(svg, 'rect', {x: x + bw / 2 - 60, y: gy, width: 120, height: 28, fill: colors.a1});
        add(svg, 'text', {x: x + bw / 2, y: gy + 19, 'text-anchor': 'middle', fill: '#fff', class: 'gate-label'}, state.gate === 'forget' ? 'FORGET GATE' : 'OUTPUT GATE');
        if (!stacked) add(svg, 'path', {d: `M${x + bw / 2},51V73m-4,-4 4,4 4,-4`, fill: 'none', stroke: colors.a1});
      }
    });
    $('#gate-description').textContent = state.gate === 'forget' ? 'The forget gate modifies attention scores, changing how much earlier information can be read. The tested MoE arm lost long-range passkey retrieval during extension.' : 'The output gate scales the attention result. This was the gate carried into the A1 recipe after the MoE comparison.';
  }
  function domain(values) {
    let lo = Math.min(...values), hi = Math.max(...values);
    const span = Math.max(hi - lo, 0.02), raw = span / 4, mag = 10 ** Math.floor(Math.log10(raw));
    const unit = [1, 2, 2.5, 5, 10].find(k => k * mag >= raw) * mag;
    lo = Math.floor((lo - span * .06) / unit) * unit;
    hi = Math.ceil((hi + span * .08) / unit) * unit;
    return [Math.max(0, lo), hi, unit];
  }
  function lineChart(host, series, opt) {
    if (!host) return;
    const width = chartWidth(host), small = width < 500;
    const height = Math.max(opt.height || 350, small ? 320 : 0);
    const xDomain = opt.xDomain;
    const visibleSeries = series.map(s => ({...s, points: s.points.filter(p => p.x >= xDomain[0] && p.x <= xDomain[1])}));
    const ys = visibleSeries.flatMap(s => s.points.map(p => p.y));
    const [y0, y1, step] = opt.yDomain || domain(ys);
    const tickDigits = Math.min(4, (step.toFixed(6).replace(/0+$/, "").split(".")[1] || "").length);
    const yFormat = opt.yFormat || (tick => fmt(tick, tickDigits));
    const labelWidth = Math.max(yFormat(y0).length, yFormat(y1).length) * 7.5;
    const m = {l: Math.max(48, labelWidth + 12), r: small ? 14 : 24, t: opt.marker ? (small ? 88 : 70) : 40, b: small ? 88 : 70};
    const plotW = width - m.l - m.r, plotH = height - m.t - m.b;
    const xFun = opt.logX ? x => Math.log2(x) : x => x;
    const x = v => m.l + (xFun(v) - xFun(xDomain[0])) / (xFun(xDomain[1]) - xFun(xDomain[0])) * plotW;
    const y = v => m.t + plotH - (v - y0) / (y1 - y0) * plotH;
    host.replaceChildren(); host.style.minHeight = `${height}px`;
    const svg = add(host, 'svg', {viewBox: `0 0 ${width} ${height}`, role: 'img', tabindex: '0', 'aria-label': `${opt.title}. Use left and right arrows to inspect measured points.`, 'aria-describedby': opt.readout});
    add(svg, 'title', {}, opt.title);
    add(svg, 'desc', {}, 'Measured observations joined by straight segments. The accompanying readout gives exact selected values.');
    if (opt.marker) {
      const mx = x(opt.marker.x);
      add(svg, 'rect', {x: mx, y: m.t, width: Math.max(0, width - m.r - mx), height: plotH, fill: '#eaf0e9'});
      add(svg, 'line', {x1: mx, x2: mx, y1: m.t - 12, y2: m.t + plotH, stroke: '#8d9d8c', 'stroke-dasharray': '3 4'});
      const markerLabelWidth = 2 * Math.min(mx - m.l, width - m.r - mx);
      wrappedText(svg, {x: mx, y: 40, 'text-anchor': 'middle', class: 'axis-note'}, '4K training window · reference', markerLabelWidth);
    }
    for (let tick = y0, n = 0; tick <= y1 + step / 10 && n < 20; tick += step, n++) {
      const py = y(tick);
      add(svg, 'line', {x1: m.l, y1: py, x2: width - m.r, y2: py, class: 'chart-grid'});
      add(svg, 'text', {x: m.l - 10, y: py + 4, 'text-anchor': 'end'}, yFormat(tick));
    }
    add(svg, 'text', {x: m.l, y: 15, class: 'axis-title'}, opt.yTitle || 'CROSS-ENTROPY · NATS');
    add(svg, 'line', {x1: m.l, y1: height - m.b, x2: width - m.r, y2: height - m.b, class: 'baseline'});
    const tickRightEdges = [-Infinity, -Infinity];
    opt.xTicks.forEach((tick, i) => {
      const px = x(tick);
      add(svg, 'line', {x1: px, y1: height - m.b, x2: px, y2: height - m.b + 5, class: 'baseline'});
      const label = add(svg, 'text', {x: px, y: height - m.b + 22, 'text-anchor': i === 0 ? 'start' : i === opt.xTicks.length - 1 ? 'end' : 'middle'}, opt.xFormat(tick));
      const bounds = label.getBBox(), row = bounds.x >= tickRightEdges[0] + 8 ? 0 : 1;
      label.setAttribute('y', height - m.b + 22 + row * 16);
      tickRightEdges[row] = bounds.x + bounds.width;
    });
    wrappedText(svg, {x: width / 2, y: height - 27, 'text-anchor': 'middle', class: 'axis-title'}, opt.xTitle, width - 20);
    visibleSeries.forEach(s => {
      add(svg, 'path', {d: s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(2)},${y(p.y).toFixed(2)}`).join(' '), class: 'plot-line', stroke: colors[s.id], 'stroke-dasharray': s.id === 'hysparse2' ? '5 5' : ''});
      if (s.points.length <= 8) s.points.forEach(p => add(svg, s.id === 'hysparse2' ? 'rect' : 'circle', s.id === 'hysparse2' ? {x: x(p.x) - 3.5, y: y(p.y) - 3.5, width: 7, height: 7, fill: '#fcfbf8', stroke: colors[s.id], 'stroke-width': 2} : {cx: x(p.x), cy: y(p.y), r: 3.5, fill: '#fcfbf8', stroke: colors[s.id], 'stroke-width': 2}));
    });
    const cursor = add(svg, 'g', {'pointer-events': 'none'}), tooltip = add(svg, 'g', {'pointer-events': 'none', visibility: 'hidden'});
    const xs = [...new Set(visibleSeries.flatMap(s => s.points.map(p => p.x)))].sort((a, b) => a - b);
    let selected = xs.length - 1, hovering = false;
    function show(i, showTooltip = false) {
      selected = Math.max(0, Math.min(xs.length - 1, i));
      const selectedX = xs[selected], px = x(selectedX);
      const chosen = visibleSeries.map(s => ({...s, point: s.points.reduce((a, b) => Math.abs(a.x - selectedX) <= Math.abs(b.x - selectedX) ? a : b)}));
      cursor.replaceChildren();
      add(cursor, 'line', {x1: px, y1: m.t, x2: px, y2: height - m.b, stroke: '#9b9f92', 'stroke-dasharray': '3 4', opacity: .8});
      chosen.forEach(s => add(cursor, s.id === 'hysparse2' ? 'rect' : 'circle', s.id === 'hysparse2' ? {x: x(s.point.x) - 4, y: y(s.point.y) - 4, width: 8, height: 8, fill: '#fcfbf8', stroke: colors[s.id], 'stroke-width': 2} : {cx: x(s.point.x), cy: y(s.point.y), r: 4, fill: '#fcfbf8', stroke: colors[s.id], 'stroke-width': 2}));
      const coordinate = opt.coordinate(selectedX);
      const readout = document.getElementById(opt.readout);
      readout.innerHTML = `<span class="readout-coordinate">${esc(coordinate)}</span>` + chosen.map(s => `<span class="readout-value"><i class="swatch ${s.id === 'a1' ? 'a1' : 'hy dashed'}"></i>${labels[s.id]} <b>${fmt(s.point.y, 5)}</b></span>`).join('');
      tooltip.replaceChildren();
      if (showTooltip) {
        const tw = Math.min(250, width - 16);
        const heading = wrappedText(tooltip, {x: 12, y: 20, fill: '#d8dacf', class: 'tooltip-heading'}, coordinate, tw - 24);
        const rowY = 36 + heading.childElementCount * 16, th = rowY + (chosen.length - 1) * 22 + 14;
        const tx = Math.max(8, Math.min(width - tw - 8, px + (px > width * .6 ? -tw - 12 : 12)));
        const ty = Math.max(m.t + 4, Math.min(height - m.b - th - 4, Math.min(...chosen.map(s => y(s.point.y))) - th - 12));
        tooltip.setAttribute('transform', `translate(${tx},${ty})`);
        const background = add(tooltip, 'rect', {x: 0, y: 0, width: tw, height: th, rx: 2, fill: '#272924'});
        tooltip.insertBefore(background, heading);
        chosen.forEach((s, j) => {
          add(tooltip, 'line', {x1: 12, x2: 24, y1: rowY - 4 + j * 22, y2: rowY - 4 + j * 22, stroke: s.id === 'a1' ? '#ef9c77' : '#8bc4b3', 'stroke-width': 2, 'stroke-dasharray': s.id === 'hysparse2' ? '4 3' : ''});
          add(tooltip, 'text', {x: 32, y: rowY + j * 22, fill: '#f6f4ee', class: 'tooltip-label'}, labels[s.id]);
          add(tooltip, 'text', {x: tw - 12, y: rowY + j * 22, 'text-anchor': 'end', fill: '#f6f4ee', class: 'tooltip-value'}, fmt(s.point.y, 5));
        });
        tooltip.setAttribute('visibility', 'visible');
      } else tooltip.setAttribute('visibility', 'hidden');
    }
    const target = add(svg, 'rect', {x: m.l, y: m.t, width: plotW, height: plotH, fill: 'transparent', style: 'cursor:crosshair'});
    // Keep visual overlays above the pointer target, without intercepting it.
    svg.appendChild(cursor); svg.appendChild(tooltip);
    function pointer(event) {
      const r = svg.getBoundingClientRect(), px = (event.clientX - r.left) * width / r.width;
      let closest = 0;
      xs.forEach((v, i) => { if (Math.abs(x(v) - px) < Math.abs(x(xs[closest]) - px)) closest = i; });
      hovering = true; show(closest, true);
    }
    target.addEventListener('pointermove', pointer);
    target.addEventListener('pointerdown', pointer);
    target.addEventListener('pointerleave', () => { hovering = false; tooltip.setAttribute('visibility', 'hidden'); });
    svg.addEventListener('keydown', event => {
      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (delta || event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); show(event.key === 'Home' ? 0 : event.key === 'End' ? xs.length - 1 : selected + delta, true);
      }
    });
    svg.addEventListener('focus', () => show(selected, true));
    svg.addEventListener('blur', () => { if (!hovering) tooltip.setAttribute('visibility', 'hidden'); });
    show(selected);
  }
  function renderTraining() {
    if (!data) return;
    const late = state.trainingView === 'late', small = $('#training-chart').clientWidth < 500;
    const series = ['a1', 'hysparse2'].map(id => ({id, points: data.training.curves[id].validation.map(p => ({x: p.tokens, y: p.ce}))}));
    lineChart($('#training-chart'), series, {title: 'Training validation cross-entropy versus processed training tokens', readout: 'training-readout', xDomain: [late ? 1e9 : 0, 30e9], xTicks: (small ? (late ? [1, 10, 20, 30] : [0, 10, 20, 30]) : (late ? [1, 5, 10, 15, 20, 25, 30] : [0, 5, 10, 15, 20, 25, 30])).map(x => x * 1e9), xFormat: v => `${v / 1e9}B`, xTitle: 'PROCESSED TRAINING TOKENS', yTitle: 'VALIDATION CE · NATS', coordinate: v => `${fmt(v / 1e9, 3)}B tokens · update ${count(v / 262144)}`});
  }
  function renderContext() {
    if (!data) return;
    const corpus = data.context32k.corpora.find(c => c.id === state.contextCorpus), prefixes = data.context32k.prefixes;
    const series = ['a1', 'hysparse2'].map(id => ({id, points: prefixes.map((x, i) => ({x, y: corpus[id][i]}))}));
    lineChart($('#context-chart'), series, {title: `${corpus.label}: matched-target cross-entropy across visible prefix lengths in the 32K cohort`, readout: 'context-readout', xDomain: [prefixes[0], prefixes.at(-1)], xTicks: prefixes, xFormat: v => v === 2048 ? '2,048' : v === 4096 ? '4,096' : count(v), xTitle: 'VISIBLE PREFIX TOKENS · LOG₂ SPACING', logX: true, marker: {x: 4096}, coordinate: v => `${corpus.label} · ${count(v)} prefix tokens`});
    const da = corpus.a1[3] - corpus.a1[2], dh = corpus.hysparse2[3] - corpus.hysparse2[2];
    $('#context-takeaway').innerHTML = `From 4,096 to 32,513 prefix tokens, loss <b>increases for both</b>: +${fmt(da)} nats for A1 and +${fmt(dh)} for HySparse2. On this ${esc(corpus.label)} cohort, HySparse2 degrades less.`;
  }
  function renderBenchmarks() {
    if (!data) return;
    const corpus = state.benchmark === 'corpora', rows = data.quality4k[corpus ? 'corpora' : 'downstream'];
    $('#benchmark-direction').textContent = corpus ? 'LOWER IS BETTER' : 'HIGHER IS BETTER';
    const max = corpus ? 3 : 1;
    $('#benchmark-chart').innerHTML = rows.map(r => {
      const difference = r.hysparse2 - r.a1, hyBetter = corpus ? difference < 0 : difference > 0;
      const values = ['a1', 'hysparse2'].map(id => {
        const value = r[id], label = corpus ? fmt(value, 4) : `${fmt(value * 100, 1)}%`;
        return `<div class="benchmark-bar-row" aria-label="${labels[id]}: ${label}${corpus ? ' nats' : `, ${Math.round(value * r.count)} of ${r.count} cases`}"><div class="benchmark-track" aria-hidden="true"><div class="benchmark-fill ${id === 'a1' ? 'a1-fill' : 'hy-fill'}" style="width:${value / max * 100}%"></div></div><b>${label}</b></div>`;
      }).join('');
      return `<div class="benchmark-row"><div class="benchmark-name"><h4>${esc(r.label)}</h4><p>${count(corpus ? r.targets : r.count)} ${corpus ? 'targets' : 'paired cases'}</p></div><div class="benchmark-pair">${values}</div><div class="benchmark-difference ${hyBetter ? 'hy-better' : 'a1-better'}">${difference >= 0 ? '+' : '−'}${fmt(Math.abs(difference) * (corpus ? 1 : 100), corpus ? 4 : 1)}${corpus ? '' : ' pp'}<small>HySparse2 − A1</small></div></div>`;
    }).join('') + `<p class="benchmark-scale">Bar scale: 0–${corpus ? '3 nats' : '100%'} · first row A1, second row HySparse2</p>`;
    $('#benchmark-caption').textContent = corpus ? 'Raw corpus CE excludes the MoE auxiliary loss. Each corpus has 262,144 matched targets. The corpora have different target populations; compare models within a row.' : 'LAMBADA: exact greedy continuation for the gold token count. HellaSwag: length-normalized option likelihood. Both use the first 1,000 frozen records. Passkey: a five-digit substring hit within six greedy tokens. Case counts differ; these percentages do not form a combined score.';
  }
  function renderPasskey() {
    if (!data) return;
    const rows = data.passkey[state.passkey], lengths = [...new Set(rows.map(r => r.length))], depths = [...new Set(rows.map(r => r.depth))];
    $('#passkey-matrix').innerHTML = ['a1', 'hysparse2'].map(id => {
      const total = rows.reduce((n, r) => n + r[`${id}hits`], 0), trials = rows.reduce((n, r) => n + r.trials, 0);
      let html = `<div><div class="matrix-model-header"><span class="legend-label"><i class="swatch ${id === 'a1' ? 'a1' : 'hy'}"></i>${labels[id]}</span><strong>${total}<small> / ${trials} hits</small></strong></div><div class="matrix-table"><span class="column-heading">Tokens</span>${depths.map(d => `<span class="column-heading">${d * 100}% depth</span>`).join('')}`;
      lengths.forEach(n => {
        html += `<span class="row-heading">${count(n)}</span>`;
        depths.forEach(d => {
          const row = rows.find(r => r.length === n && r.depth === d), hits = row[`${id}hits`];
          html += `<button class="matrix-cell ${id === 'a1' ? 'a1' : 'hy'} ${hits === 0 ? 'empty' : ''}" data-cell="${id}|${n}|${d}" aria-label="${labels[id]}, ${count(n)} prompt tokens, key at ${d * 100} percent depth: ${hits} of ${row.trials} hits" aria-pressed="false">${hits} / ${row.trials}</button>`;
        });
      });
      return html + '</div><div class="matrix-axis">KEY POSITION WITHIN THE PROMPT →</div></div>';
    }).join('');
    const buttons = $$('[data-cell]');
    function select(button) {
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      const [id, n, d] = button.dataset.cell.split('|'), row = rows.find(r => r.length === Number(n) && r.depth === Number(d));
      $('#passkey-detail').textContent = `${labels[id]}: ${row[`${id}hits`]} of ${row.trials} hits at ${count(n)} prompt tokens, with the key at ${Number(d) * 100}% depth. ${row[`${id}hits`] === 0 ? 'Every retained trial in this cell missed the key.' : 'These are the fixed retained trials, not a population estimate.'}`;
    }
    buttons.forEach(b => b.addEventListener('click', () => select(b)));
    select(buttons.find(b => b.classList.contains('empty')) || buttons[0]);
  }
  function renderInduction() {
    if (!data) return;
    const rows = data.induction['32k'][state.induction];
    const series = ['a1', 'hysparse2'].map(id => ({id, points: rows.map(r => ({x: r.gap, y: r[id].second}))}));
    lineChart($('#induction-chart'), series, {title: `${state.induction === 'natural' ? 'Natural text' : 'Random token'} copying loss at two tested gaps`, readout: 'induction-readout', height: 280, xDomain: [0, rows.at(-1).gap], xTicks: rows.map(r => r.gap), xFormat: count, xTitle: 'FILLER TOKENS BETWEEN COPIES · TWO TESTED GAPS', yTitle: 'SECOND-COPY NLL · NATS', coordinate: v => `${state.induction === 'natural' ? 'Natural text' : 'Random tokens'} · gap ${count(v)}`});
  }
  const historical = {
    4096: {hits: [87.40, 54.07], ce: [1.308914, 4.097597], latency: [75.870, 871.377]},
    16384: {hits: [79.53, 31.76], ce: [1.918298, 6.649621], latency: [101.271, 3304.879]}
  };
  function renderDense() {
    const host = $('#dense-chart'), w = chartWidth(host), small = w < 500, h = small ? 245 : 230;
    const key = state.denseMetric, values = historical[state.denseContext][key];
    const maximum = key === 'hits' ? 100 : key === 'ce' ? 8 : state.denseContext === 4096 ? 1000 : 4000;
    const unit = key === 'hits' ? '%' : key === 'ce' ? ' nats' : ' ms';
    const left = small ? 12 : 100, right = small ? 12 : 85, plotW = w - left - right, baseline = 168;
    host.replaceChildren(); host.style.minHeight = `${h}px`;
    const svg = add(host, 'svg', {viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': `At ${count(state.denseContext)} tokens, A1 ${values[0]}${unit} and A2 ${values[1]}${unit}. ${key === 'hits' ? 'Higher' : 'Lower'} is better.`});
    const intervals = small ? 2 : 4;
    for (let t = 0; t <= intervals; t++) {
      const v = maximum * t / intervals, px = left + plotW * t / intervals;
      add(svg, 'line', {x1: px, x2: px, y1: small ? 42 : 27, y2: baseline, class: 'chart-grid'});
      add(svg, 'text', {x: px, y: baseline + 22, 'text-anchor': t === 0 ? 'start' : t === intervals ? 'end' : 'middle'}, count(v));
    }
    ['A1 dense', 'A2 sparse'].forEach((name, i) => {
      const y = (small ? 45 : 55) + i * 72, bw = values[i] / maximum * plotW;
      add(svg, 'text', {x: small ? left : left - 10, y: small ? y - 10 : y + 18, 'text-anchor': small ? 'start' : 'end', class: 'bar-label'}, name);
      add(svg, 'rect', {x: left, y, width: bw, height: 25, fill: i ? colors.neutral : colors.a1});
      add(svg, 'text', {x: small ? w - right : left + bw + 8, y: small ? y - 10 : y + 18, 'text-anchor': small ? 'end' : 'start', class: 'bar-value'}, `${fmt(values[i], key === 'hits' ? 2 : key === 'ce' ? 3 : 1)}${key === 'hits' ? '%' : ''}`);
    });
    wrappedText(svg, {x: w / 2, y: h - 29, 'text-anchor': 'middle', class: 'axis-title'}, key === 'hits' ? 'TEACHER-FORCED TARGET HITS · %' : key === 'ce' ? 'PRESENT-REFERENCE CROSS-ENTROPY · NATS' : 'NATIVE FORWARD LATENCY · MILLISECONDS', w - 24);
    $('#dense-readout').innerHTML = `<span class="readout-coordinate">${count(state.denseContext)}-token context</span><span>${key === 'latency' ? `<b>${fmt(values[1] / values[0], 1)}×</b> observed A2 latency relative to A1` : key === 'hits' ? `<b>+${fmt(values[0] - values[1], 2)} percentage points</b> for A1` : `<b>${fmt(values[1] - values[0], 3)} nats</b> lower copy loss for A1`}</span>`;
  }
  function renderSources() {
    const names = {
      'summary-0-cc5b385a91ba.json': 'A1 terminal training summary',
      'summary-0-a114f444c14d.json': 'HySparse2 terminal training summary',
      'log-0-cc5b385a91ba.jsonl': 'A1 recorded training and validation curve',
      'log-0-a114f444c14d.jsonl': 'HySparse2 recorded training and validation curve',
      'comparison.json': 'Final paired comparison and all case identities',
      'scheduler-observation.json': 'Recorded allocation accounting'
    };
    $('#source-list').innerHTML = `<p class="source-entry">Original evidence links below require access to the research repository. The <a href="data.json" download>public figure dataset</a> contains the plotted values and original file hashes.</p>` + data.sources.map(s => `<div class="source-entry"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(names[s.path.split('/').at(-1)] || s.path.replace(/^epoch5\/results\/20261013\/artifacts\//, ''))} ↗</a><small>SHA256 ${esc(s.sha256)}</small></div>`).join('');
  }
  function updateReading() {
    const sections = $$('.chapter, #conclusion'), edge = window.innerWidth < 900 ? 100 : 160;
    let current = sections[0];
    sections.forEach(s => { if (s.getBoundingClientRect().top <= edge) current = s; });
    $$('#chapter-nav a').forEach(a => a.classList.toggle('active', a.hash === `#${current.id}`));
    const span = document.documentElement.scrollHeight - innerHeight;
    const p = Math.min(100, Math.max(0, scrollY / Math.max(1, span) * 100));
    $('#reading-progress').style.width = `${p}%`;
    $('#reading-label').textContent = p < 3 ? 'At the beginning' : p > 97 ? 'End of report.' : `${Math.round(p)}% through the report`;
  }
  controls('data-architecture', value => { state.architecture = value; state.layer = value === 'a1' ? 3 : 12; renderArchitecture(); });
  controls('data-gate', value => { state.gate = value; renderGate(); });
  controls('data-dense-context', value => { state.denseContext = Number(value); renderDense(); });
  $('#dense-metric').addEventListener('change', e => { state.denseMetric = e.target.value; renderDense(); });
  controls('data-training-view', value => { state.trainingView = value; renderTraining(); });
  controls('data-benchmark', value => { state.benchmark = value; renderBenchmarks(); });
  $('#context-corpus').addEventListener('change', e => { state.contextCorpus = e.target.value; renderContext(); });
  controls('data-passkey', value => { state.passkey = value; renderPasskey(); });
  controls('data-induction', value => { state.induction = value; renderInduction(); });
  renderArchitecture(); renderGate(); renderDense(); updateReading();
  let scrolling = false;
  addEventListener('scroll', () => { if (!scrolling) { scrolling = true; requestAnimationFrame(() => { updateReading(); scrolling = false; }); } }, {passive: true});
  let resizeTimer;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { renderGate(); renderDense(); renderTraining(); renderContext(); renderInduction(); updateReading(); }, 120); });
  document.fonts.ready.then(() => { renderGate(); renderDense(); renderTraining(); renderContext(); renderInduction(); });
  fetch('data.json').then(response => { if (!response.ok) throw new Error('Figure data unavailable'); return response.json(); }).then(payload => {
    data = payload;
    renderTraining(); renderContext(); renderBenchmarks(); renderPasskey(); renderInduction(); renderSources();
    $('#data-status').textContent = 'Recorded figure data loaded. Research complete; no live experiment or model connection.';
  }).catch(() => {
    $('#data-status').classList.add('error');
    $('#data-status').textContent = 'Figure data could not be loaded. Please reload, or use the PDF and downloadable data for the complete results.';
    $$('.training-figure button, .benchmark-figure button, .context-figure select, .passkey-figure button, .induction-figure button').forEach(control => { control.disabled = true; });
  });
})();
