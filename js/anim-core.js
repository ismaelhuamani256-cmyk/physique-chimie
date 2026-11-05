// =====================================================================================
// anim-core.js — motor de animaciones de fórmulas (CONTRATO.md §7)
// Los presets (js/anim/quimica.js, js/anim/fisica.js) se registran con PCB.anim.register.
// Al pulsar una fórmula: PCB.anim.open(presetId, {params, leyenda, latexBase, titulo}).
// =====================================================================================
(function () {
  const PCB = window.PCB, { el, tex } = PCB.util;
  const presets = {};
  const A = (PCB.anim = {
    register(id, def) { presets[id] = Object.assign({ id, params: [] }, def); },
    presets: () => Object.keys(presets),
    get: (id) => presets[id],
    open, mountInline,
  });

  /** Valores iniciales: def del preset, sobrescritos por opts.params */
  function valoresIniciales(def, over) {
    const p = {};
    (def.params || []).forEach((q) => (p[q.id] = q.def));
    Object.assign(p, over || {});
    return p;
  }
  const fmtVal = (q, v) => {
    const dec = q.step && q.step < 1 ? Math.min(4, Math.ceil(-Math.log10(q.step))) : 0;
    return Number(v).toFixed(dec).replace('.', ',') + (q.unit ? ' ' + q.unit : '');
  };

  /**
   * Monta un preset dentro de `host` (sin modal). Devuelve {dispose, setParam, reset}.
   * opts: {params, leyenda, latexBase, controles:true}
   */
  function mountInline(host, presetId, opts = {}) {
    let def = presets[presetId];
    if (!def) { def = presets.generico; opts = Object.assign({}, opts, { params: Object.assign({ expr: opts.latexBase || 'x' }, opts.params) }); }
    if (!def) { host.textContent = 'Animación no disponible: ' + presetId; return { dispose() {} }; }
    // generico: los sliders salen de params.vars = {nombre:{min,max,step,def,label,unit}}
    if (def.id === 'generico' && opts.params && opts.params.vars) def = Object.assign({}, def, { params: A.genericoParams(opts.params.vars) });
    const p = valoresIniciales(def, opts.params);
    const formulaEl = el('div', { class: 'anim-formula' });
    const wrap = el('div', { class: 'anim-canvas-wrap' });
    const lect = el('div', { class: 'anim-lect' });
    const ctrl = el('div', { class: 'anim-ctrl' });
    const ley = opts.leyenda ? el('div', { class: 'anim-leyenda' }, opts.leyenda) : null;
    host.replaceChildren(...[formulaEl, wrap, ley, lect, ctrl].filter(Boolean));
    let canvas = null, ctx = null, state = null, inst = null, raf = 0, last = 0, play = true, w = 0, h = 0, dead = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rng = PCB.util.rng(7);
    const hostInfo = () => ({ w, h, dpr, rng, host: wrap, reduced: PCB.util.reducedMotion() });

    function refrescarTextos() {
      if (def.formula) tex(def.formula(p), formulaEl, { display: true });
      else tex(opts.latexBase || '', formulaEl, { display: true });
      lect.replaceChildren();
      if (def.lecturas) def.lecturas(p).forEach((l) => lect.append(el('span', {}, l.label + ' = ', el('b', {}, l.valor))));
    }
    function construir() {
      wrap.replaceChildren();
      if (def.mount) { inst = def.mount(wrap, p, hostInfo()); return; }
      canvas = el('canvas'); wrap.append(canvas); ctx = canvas.getContext('2d');
      redim(); state = def.create(hostInfo(), p);
    }
    function redim() {
      if (!canvas) return;
      const r = wrap.getBoundingClientRect(); w = Math.max(200, r.width); h = Math.max(150, r.height);
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function bucle(t) {
      if (dead) return;
      raf = requestAnimationFrame(bucle);
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
      if (!ctx || !state) return;
      if (play && def.step) def.step(state, dt, p);
      def.draw(state, ctx, w, h, p);
    }
    // controles (sliders)
    (def.params || []).forEach((q) => {
      if (q.oculto) return;
      const out = el('b', {}, fmtVal(q, p[q.id]));
      const inp = el('input', { type: 'range', class: 'slider', min: q.min, max: q.max, step: q.step, value: p[q.id], 'aria-label': q.label });
      inp.addEventListener('input', () => {
        p[q.id] = parseFloat(inp.value); out.textContent = fmtVal(q, p[q.id]);
        if (def.onParam && state) def.onParam(state, q.id, p[q.id], p);
        if (inst && inst.setParam) inst.setParam(q.id, p[q.id], p);
        refrescarTextos();
      });
      ctrl.append(el('label', {}, el('span', {}, q.label + ': ', out), inp));
    });
    const bPlay = el('button', { class: 'btn mini', on: { click: () => { play = !play; bPlay.textContent = play ? '⏸ Pausa' : '▶ Seguir'; } } }, '⏸ Pausa');
    const bReset = el('button', { class: 'btn mini', on: { click: () => { if (def.dispose && state) def.dispose(state); if (inst && inst.dispose) inst.dispose(); inst = null; construir(); } } }, '↺ Reiniciar');
    ctrl.append(el('div', { style: { display: 'flex', gap: '8px', alignItems: 'end' } }, bPlay, bReset));
    if (opts.controles === false) ctrl.style.display = 'none';
    const ro = new ResizeObserver(() => { if (!def.mount) { redim(); if (def.onResize && state) def.onResize(state, hostInfo(), p); } });
    ro.observe(wrap);
    refrescarTextos(); construir();
    raf = requestAnimationFrame(bucle);
    return {
      setParam(id, v) { p[id] = v; if (def.onParam && state) def.onParam(state, id, v, p); if (inst && inst.setParam) inst.setParam(id, v, p); refrescarTextos(); },
      reset() { bReset.click(); },
      dispose() { dead = true; cancelAnimationFrame(raf); ro.disconnect(); if (def.dispose && state) def.dispose(state); if (inst && inst.dispose) inst.dispose(); host.replaceChildren(); },
    };
  }

  /** Abre el modal con la animación de una fórmula */
  function open(presetId, opts = {}) {
    const def = presets[presetId] || presets.generico;
    const titulo = opts.titulo || (def && def.titulo) || 'Animación';
    const body = el('div', { style: { display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' } });
    let m;
    const cerrar = () => { m.dispose(); box.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => e.key === 'Escape' && cerrar();
    const box = el('div', { class: 'anim-modal', on: { click: (e) => e.target === box && cerrar() }, role: 'dialog', 'aria-label': titulo },
      el('div', { class: 'anim-box' },
        el('div', { class: 'anim-head' }, el('h3', {}, '🔬 ' + titulo), el('button', { class: 'btn mini', on: { click: cerrar } }, '✕ Cerrar')),
        body));
    document.getElementById('overlay').append(box);
    document.addEventListener('keydown', esc);
    m = mountInline(body, presetId, opts);
    return { close: cerrar };
  }

  // ---------- preset genérico: y = f(x) con sliders ----------
  // params.expr: expresión JS en x y otras variables (solo caracteres seguros). params.vars: {nombre:{min,max,step,def,label,unit}}
  A.register('generico', {
    titulo: 'Gráfica interactiva',
    params: [],
    create(host, p) { return { t: 0 }; },
    draw(s, ctx, w, h, p) {
      ctx.fillStyle = '#0a0f20'; ctx.fillRect(0, 0, w, h);
      const expr = String(p.expr || 'x'); const seguro = /^[0-9a-zA-Z_+\-*/().,\s^<>=?:]*$/.test(expr);
      const X0 = p.xmin ?? 0, X1 = p.xmax ?? 10;
      let f = () => 0;
      if (seguro) { try { const vars = Object.keys(p).filter((k) => /^[a-zA-Z_]\w*$/.test(k) && typeof p[k] === 'number'); const fn = new Function('x', 'Math', ...vars, `with(Math){return (${expr.replace(/\^/g, '**')});}`); f = (x) => fn(x, Math, ...vars.map((k) => p[k])); } catch (e) {} }
      const N = 200, ys = []; let mn = Infinity, mx = -Infinity;
      for (let i = 0; i <= N; i++) { const y = f(X0 + ((X1 - X0) * i) / N); ys.push(y); if (isFinite(y)) { mn = Math.min(mn, y); mx = Math.max(mx, y); } }
      if (!isFinite(mn) || mn === mx) { mn = 0; mx = 1; }
      const pad = 40, X = (x) => pad + ((x - X0) / (X1 - X0)) * (w - 2 * pad), Y = (y) => h - pad - ((y - mn) / (mx - mn)) * (h - 2 * pad);
      ctx.strokeStyle = '#2a376b'; ctx.lineWidth = 1; ctx.strokeRect(pad, pad / 2, w - 2 * pad, h - 1.5 * pad);
      ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 3; ctx.beginPath();
      ys.forEach((y, i) => { const x = X(X0 + ((X1 - X0) * i) / N); i ? ctx.lineTo(x, Y(y)) : ctx.moveTo(x, Y(y)); }); ctx.stroke();
      ctx.fillStyle = '#9fb0d9'; ctx.font = '12px UI,sans-serif'; ctx.fillText(X0, pad - 4, h - pad + 16); ctx.fillText(X1, w - pad - 8, h - pad + 16);
      ctx.fillText(mx.toPrecision(3), 4, pad / 2 + 10); ctx.fillText(mn.toPrecision(3), 4, h - pad);
    },
  });
  // Los presets con `vars` en params generan sliders: se resuelve en mountInline vía def.params; aquí el helper:
  A.genericoParams = (vars) => Object.entries(vars || {}).map(([id, q]) => ({ id, label: q.label || id, min: q.min, max: q.max, step: q.step || 0.1, def: q.def, unit: q.unit || '' }));
})();
