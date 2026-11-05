// =====================================================================================
// 21-fisica-b.js — presets de animación de fórmulas · FÍSICA (parte B)   [ANIM-FIS-B]
// Se registran con PCB.anim.register (js/anim-core.js). Fondo #0a0f20, Canvas2D, 60 fps.
//
// PARÁMETROS (id · rango · unidad · defecto). Los marcados (opc.) son extras opcionales;
// los demás son los ids canónicos del CONTRATO §7.
//
//  bernoulli          v1  0,5–3   m/s   (2)      velocidad en la sección 1
//                     S1  10–40   cm²   (30)     sección 1 (la sección es circular: diámetro ∝ √S)
//                     S2  6–40    cm²   (8)      sección 2 (estrechamiento)
//                     Constantes del modelo (se indican en pantalla): ρ = 1000 kg·m⁻³, P₁ = 1,50×10⁵ Pa
//  termodinamica      Q   −500–500 J    (300)    calor recibido (+) o cedido (−)
//                     W   −500–500 J   (−100)    trabajo recibido (+: compresión) o cedido (−: expansión)
//  enfriamiento-newton T0 20–100  °C    (90)     temperatura inicial
//                     Text −10–40 °C    (20)     temperatura exterior
//                     tau 20–600  s     (120)    constante de tiempo
//  ondas              f   1–2000  Hz    (440)    frecuencia
//                     v   1–1500  m/s   (340)    celeridad de la onda
//                     modo (opc., oculto) 0 = onda viajera · 1 | 'dB' = fuente sonora y atenuación
//                     L0  (opc.) 40–110 dB (80)   nivel sonoro a 1 m de la fuente (modo dB)
//                     d   (opc.) 1–25  m   (8)    distancia del 1.er sonómetro (modo dB; el 2.º está a 2d)
//  difraccion         lam 380–780 nm    (550)    longitud de onda
//                     a   10–200  µm    (50)     anchura de la rendija
//                     modo (opc., oculto) 0 = una rendija · 1 | 'dos' = dos rendijas (interferencias)
//                     b   (opc.) 100–500 µm (250) separación de las dos rendijas
//                     D   (opc.) 1–5  m   (2)     distancia rendija–pantalla
//  doppler            f0  100–1000 Hz   (440)    frecuencia de la fuente
//                     vs  0–300   m/s   (100)    celeridad de la fuente (v = 340 m·s⁻¹, dato típico del sonido en el aire)
//  lente              f   5–20    cm    (10)     distancia focal imagen f′ (lente convergente)
//                     OA  2–40    cm    (25)     distancia objeto–lente (|OA|; algebraicamente OA = −|OA|)
//  fotones            nu  200–1500 THz  (700)    frecuencia de la radiación
//                     W0  0,5–6   eV    (2,3)    trabajo de extracción del metal
//                     Constantes del cours: h = 6,63×10⁻³⁴ J·s ; 1 eV = 1,60×10⁻¹⁹ J
//  condensador-rc     R   100–2000 Ω    (1000)
//                     C   50–1000 µF    (500)
//                     E   1–12    V     (6)
//
// Convenciones comunes: `formula(p)` devuelve LaTeX con valores en vivo (coma decimal);
// `lecturas(p)` las lecturas numéricas. Los presets con magnitudes que cambian con el tiempo
// (Newton, RC) refrescan además la fórmula y las lecturas ~5 veces/s (ayudante `vivo`).
// Los diagramas son DIDÁCTICOS: donde la escala real no se vería (difracción, Doppler, ondas)
// se exagera o se ralentiza, y se dice en el propio dibujo.
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB;
  if (!PCB || !PCB.anim) return;
  const tex = PCB.util.tex, el = PCB.util.el;

  // ---------------------------------------------------------------------------------
  // Ayudantes pequeños (copiados/propios: este archivo es autocontenido)
  // ---------------------------------------------------------------------------------
  const C = { bg: '#0a0f20', panel: '#121a33', panel2: '#1d2850', borde: '#2a376b', txt: '#eaf0ff', txt2: '#9fb0d9',
    azul: '#2f6bff', cian: '#00d4ff', cian2: '#4cc9f0', violeta: '#9b5de5', naranja: '#ff9f1c', ambar: '#ffd166',
    verde: '#2ee59d', rojo: '#ff4d6d', magenta: '#ff3da6', calor: '#ff6b4a', frio: '#4cc9f0' };
  const FONT = 'UI, system-ui, sans-serif';
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;
  const num = (v, def) => { v = +v; return isFinite(v) ? v : def; };

  /** Número en texto de canvas: coma decimal y signo menos tipográfico. */
  const fmt = (x, d = 2) => { const s = (Math.abs(x) < Math.pow(10, -d) / 2 ? 0 : x).toFixed(d); return s.replace('.', ',').replace('-', '−'); };
  /** Número en LaTeX: coma decimal (con llaves, para que KaTeX no añada espacio). */
  const tx = (x, d = 2) => (Math.abs(x) < Math.pow(10, -d) / 2 ? 0 : x).toFixed(d).replace('.', '{,}');
  const sgn = (x, d = 0) => (x >= 0 ? '+' : '−') + fmt(Math.abs(x), d);
  const sgnTx = (x, d = 0) => (x >= 0 ? '+' : '-') + tx(Math.abs(x), d);
  const mant = (x, d) => { if (x === 0) return { m: 0, e: 0 }; let e = Math.floor(Math.log10(Math.abs(x))), m = x / Math.pow(10, e); if (Number(Math.abs(m).toFixed(d)) >= 10) { m /= 10; e++; } return { m, e }; };
  const sup = (n) => String(n).replace(/-/g, '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
  const sci = (x, d = 2) => { const q = mant(x, d); return fmt(q.m, d) + '×10' + sup(q.e); };
  const texSci = (x, d = 2) => { const q = mant(x, d); return tx(q.m, d) + '\\times10^{' + q.e + '}'; };
  /** Duración legible (s → µs/ms/s). */
  const tfmt = (s, d = 2) => (s < 1e-3 ? fmt(s * 1e6, d - 1 < 0 ? 0 : 1) + ' µs' : s < 1 ? fmt(s * 1e3, s < 0.01 ? 2 : 1) + ' ms' : fmt(s, d) + ' s');
  const ttex = (s, d = 2) => (s < 1e-3 ? tx(s * 1e6, 1) + '\\ \\mu\\text{s}' : s < 1 ? tx(s * 1e3, s < 0.01 ? 2 : 1) + '\\ \\text{ms}' : tx(s, d) + '\\ \\text{s}');
  /** Longitud legible (m → mm/cm/m). */
  const lfmt = (m, d = 2) => (m < 0.01 ? fmt(m * 1e3, 2) + ' mm' : m < 1 ? fmt(m * 100, 1) + ' cm' : fmt(m, d) + ' m');
  const ltex = (m, d = 2) => (m < 0.01 ? tx(m * 1e3, 2) + '\\ \\text{mm}' : m < 1 ? tx(m * 100, 1) + '\\ \\text{cm}' : tx(m, d) + '\\ \\text{m}');

  const fsz = (w) => clamp(w / 56, 10.5, 14.5);

  /** Texto con opciones {size,color,align,base,w,halo}. */
  function txt(ctx, s, x, y, o) {
    o = o || {};
    ctx.font = (o.w || 400) + ' ' + (o.size || 12) + 'px ' + FONT;
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
    if (o.halo) { ctx.lineWidth = 3.5; ctx.strokeStyle = C.bg; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = o.color || C.txt; ctx.fillText(s, x, y);
  }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  /** Etiqueta con fondo. Devuelve su anchura. */
  function chip(ctx, s, x, y, o) {
    o = o || {}; const size = o.size || 12;
    ctx.font = (o.w || 600) + ' ' + size + 'px ' + FONT; const tw = ctx.measureText(s).width, pw = 8, ph = size + 8;
    const al = o.align || 'left'; const x0 = al === 'center' ? x - (tw + 2 * pw) / 2 : al === 'right' ? x - tw - 2 * pw : x;
    ctx.fillStyle = o.bg || 'rgba(18,26,51,.88)'; rr(ctx, x0, y - ph / 2, tw + 2 * pw, ph, 7); ctx.fill();
    if (o.border !== false) { ctx.strokeStyle = o.border || C.borde; ctx.lineWidth = 1; ctx.stroke(); }
    txt(ctx, s, x0 + pw, y, { size, color: o.color || C.txt, w: o.w || 600, base: 'middle' });
    return tw + 2 * pw;
  }
  /** Flecha con cabeza triangular. */
  function arrow(ctx, x0, y0, x1, y1, col, lw, head) {
    const L = Math.hypot(x1 - x0, y1 - y0); if (L < 1.5) return;
    lw = lw || 2; head = Math.min(head || 4 + lw * 2.2, L * 0.7); const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * head * 0.6, y1 - Math.sin(a) * head * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.45) * head, y1 - Math.sin(a - 0.45) * head);
    ctx.lineTo(x1 - Math.cos(a + 0.45) * head, y1 - Math.sin(a + 0.45) * head); ctx.closePath(); ctx.fill();
  }
  /** Cota (flecha de doble punta con texto centrado). */
  function cota(ctx, x0, y0, x1, y1, label, col, size, above) {
    arrow(ctx, (x0 + x1) / 2, (y0 + y1) / 2, x0, y0, col, 1.6, 7); arrow(ctx, (x0 + x1) / 2, (y0 + y1) / 2, x1, y1, col, 1.6, 7);
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (label) txt(ctx, label, mx, my + (above === false ? size + 5 : -6), { size, color: col, align: 'center', w: 700, halo: true });
  }
  /** Fondo oscuro común con un ligero halo. */
  function fondo(ctx, w, h) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(36,52,110,.38)'); g.addColorStop(1, 'rgba(10,15,32,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function niceStep(range, n) { const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }
  function ticks(a, b, n) { const s = niceStep(b - a, n || 5), out = []; for (let k = Math.ceil(a / s - 1e-9); k * s <= b + 1e-9; k++) out.push(Math.round(k * s * 1e9) / 1e9); return out; }
  /** Rejilla + ejes en el rectángulo R={x,y,w,h}. Devuelve {X,Y} (datos → píxeles). */
  function ejes(ctx, R, x0, x1, y0, y1, o) {
    o = o || {}; const size = o.size || 10.5;
    const X = (x) => R.x + ((x - x0) / (x1 - x0)) * R.w, Y = (y) => R.y + R.h - ((y - y0) / (y1 - y0)) * R.h;
    ctx.fillStyle = 'rgba(10,15,32,.55)'; rr(ctx, R.x, R.y, R.w, R.h, 6); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(42,55,107,.7)';
    const tx_ = o.xt || ticks(x0, x1, o.nx || 5), ty_ = o.yt || ticks(y0, y1, o.ny || 4);
    ctx.beginPath(); tx_.forEach((v) => { ctx.moveTo(X(v), R.y); ctx.lineTo(X(v), R.y + R.h); }); ty_.forEach((v) => { ctx.moveTo(R.x, Y(v)); ctx.lineTo(R.x + R.w, Y(v)); }); ctx.stroke();
    ctx.strokeStyle = C.borde; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(R.x, R.y); ctx.lineTo(R.x, R.y + R.h); ctx.lineTo(R.x + R.w, R.y + R.h); ctx.stroke();
    const fx = o.fx || ((v) => fmt(v, v % 1 ? 1 : 0)), fy = o.fy || ((v) => fmt(v, v % 1 ? 1 : 0));
    tx_.forEach((v) => txt(ctx, fx(v), X(v), R.y + R.h + size + 3, { size, color: C.txt2, align: 'center' }));
    ty_.forEach((v) => txt(ctx, fy(v), R.x - 5, Y(v), { size, color: C.txt2, align: 'right', base: 'middle' }));
    if (o.xl) txt(ctx, o.xl, R.x + R.w, R.y + R.h + size * 2 + 6, { size, color: C.txt2, align: 'right' });
    if (o.yl) txt(ctx, o.yl, R.x - 2, R.y - 6, { size, color: C.txt2, align: 'left' });
    return { X, Y };
  }
  /** Color (rgb) de una longitud de onda visible en nm (aprox. de Bruton). UV → violeta pálido, IR → rojo oscuro. */
  function nmRGB(nm) {
    if (nm < 380) return [176, 140, 255]; if (nm > 780) return [160, 50, 50];
    let r = 0, g = 0, b = 0;
    if (nm < 440) { r = -(nm - 440) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = -(nm - 645) / 65; } else { r = 1; }
    const f = nm < 420 ? 0.35 + (0.65 * (nm - 380)) / 40 : nm > 700 ? 0.35 + (0.65 * (780 - nm)) / 80 : 1;
    return [r, g, b].map((c) => Math.round(255 * Math.pow(c * f, 0.8)));
  }
  const rgb = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')';
  /** Mapa termográfico (t 0..1): azul → cian → verde → amarillo → naranja → rojo → blanco. */
  function termo(t) {
    const st = [[0, [40, 60, 255]], [0.2, [0, 190, 255]], [0.4, [46, 229, 157]], [0.6, [255, 220, 60]], [0.8, [255, 120, 30]], [0.93, [255, 50, 50]], [1, [255, 235, 225]]];
    t = clamp(t, 0, 1); for (let i = 1; i < st.length; i++) if (t <= st[i][0]) { const u = (t - st[i - 1][0]) / (st[i][0] - st[i - 1][0]), a = st[i - 1][1], b = st[i][1]; return [0, 1, 2].map((k) => Math.round(lerp(a[k], b[k], u))); }
    return st[st.length - 1][1];
  }

  /** Botones dibujados en el canvas. Se registran en S.btns en cada draw y se pulsan con el puntero. */
  function btn(S, ctx, b) {
    const act = !!b.active; S.btns.push(b);
    ctx.fillStyle = act ? 'rgba(0,212,255,.22)' : 'rgba(18,26,51,.9)'; rr(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.strokeStyle = act ? C.cian : C.borde; ctx.lineWidth = act ? 1.6 : 1; ctx.stroke();
    txt(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 0.5, { size: b.size || 12, color: act ? C.txt : C.txt2, w: 600, align: 'center', base: 'middle' });
  }
  /** Punteros (clic en botones del canvas + arrastre opcional). h = {down(x,y)->bool, move(x,y), up()}. */
  function punteros(S, h) {
    const wrap = S.host && S.host.host; if (!wrap) return; h = h || {};
    const pos = (e) => { const r = wrap.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const hit = (x, y) => (S.btns || []).find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    const down = (e) => { const [x, y] = pos(e); const b = hit(x, y); if (b) { b.on(); return; } S.drag = !!(h.down && h.down(x, y)); if (S.drag) { try { wrap.setPointerCapture(e.pointerId); } catch (_) {} } };
    const move = (e) => { const [x, y] = pos(e); if (S.drag && h.move) h.move(x, y); else wrap.style.cursor = hit(x, y) || (h.hover && h.hover(x, y)) ? 'pointer' : 'default'; };
    const up = () => { if (S.drag && h.up) h.up(); S.drag = false; };
    wrap.addEventListener('pointerdown', down); wrap.addEventListener('pointermove', move); wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
    S._off = () => { wrap.removeEventListener('pointerdown', down); wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerup', up); wrap.removeEventListener('pointercancel', up); wrap.style.cursor = ''; };
  }
  /** Refresca fórmula y lecturas del modal ~5 veces/s (la fórmula depende del tiempo de la animación). */
  function vivo(S, def, p, dt) {
    S._vt = (S._vt || 0) + dt; if (S._vt < 0.2) return; S._vt = 0;
    const wrap = S.host && S.host.host; if (!wrap || !wrap.parentElement) return;
    const fe = wrap.parentElement.querySelector('.anim-formula'), le = wrap.parentElement.querySelector('.anim-lect');
    const f = def.formula(p); if (fe && f !== S._lf) { S._lf = f; tex(f, fe, { display: true }); }
    if (le && def.lecturas) { const ls = def.lecturas(p), key = ls.map((l) => l.label + l.valor).join('|'); if (key !== S._ll) { S._ll = key; le.replaceChildren(...ls.map((l) => el('span', {}, l.label + ' = ', el('b', {}, l.valor)))); } }
  }
  const disposeComun = (S) => { if (S._off) S._off(); };

  // =====================================================================================
  // 1. BERNOULLI — continuidad S₁v₁ = S₂v₂ y Bernoulli (tubo horizontal, fluido ideal)
  //    Simplificaciones: fluido perfecto e incompresible (ρ = 1000 kg·m⁻³, agua), flujo estacionario,
  //    tubo horizontal (sin término ρgz), velocidad uniforme en cada sección, sin pérdidas de carga.
  //    Presión de referencia P₁ = 1,50×10⁵ Pa. Si P₂ < 0 el modelo deja de valer (cavitación).
  // =====================================================================================
  const RHO = 1000, P1B = 1.5e5;
  const bernCalc = (p) => {
    const v1 = Math.max(0.05, num(p.v1, 2)), S1 = Math.max(1, num(p.S1, 30)), S2 = Math.max(1, num(p.S2, 8));
    const v2 = (S1 * v1) / S2, P2 = P1B + 0.5 * RHO * (v1 * v1 - v2 * v2);
    return { v1, S1, S2, v2, P2, dP: P2 - P1B };
  };
  // forma del estrechamiento: 0 = sección 1, 1 = sección 2 (suavizado)
  const shapeB = (x) => smooth((x - 0.28) / 0.16) * (1 - smooth((x - 0.58) / 0.16));
  PCB.anim.register('bernoulli', {
    titulo: 'Continuidad y relación de Bernoulli', materia: 'physique',
    params: [
      { id: 'v1', label: 'Velocidad en la sección 1 (v₁)', min: 0.5, max: 3, step: 0.1, def: 2, unit: 'm/s' },
      { id: 'S1', label: 'Sección 1 (S₁)', min: 10, max: 40, step: 1, def: 30, unit: 'cm²' },
      { id: 'S2', label: 'Sección 2 (S₂)', min: 6, max: 40, step: 1, def: 8, unit: 'cm²' }],
    create(host, p) {
      const rnd = host.rng, N = host.reduced ? 36 : 96, parts = [];
      for (let i = 0; i < N; i++) parts.push({ x: rnd(), yf: (rnd() * 2 - 1) * 0.86 });
      const k = bernCalc(p);
      return { host, parts, Lt: 600, lv: [P1B, k.P2, P1B], t: 0 };
    },
    step(S, dt, p) {
      const k = bernCalc(p), kv = (S.host.w || 600) * 0.022; S.t += dt;
      const area = (x) => k.S1 + (k.S2 - k.S1) * shapeB(x);
      for (const q of S.parts) { q.x += ((k.v1 * k.S1) / area(q.x)) * kv * dt / S.Lt; if (q.x > 1) { q.x -= 1; q.yf = (S.host.rng() * 2 - 1) * 0.86; } }
      const tgt = [P1B, k.P2, P1B]; for (let i = 0; i < 3; i++) S.lv[i] += (tgt[i] - S.lv[i]) * Math.min(1, dt * 6);
    },
    draw(S, ctx, w, h, p) {
      fondo(ctx, w, h); const k = bernCalc(p), fs = fsz(w), compact = w < 520;
      const x0 = w * 0.06, Lt = w * 0.88; S.Lt = Lt; S.host.w = w;
      const cy = h * 0.66, Hmax = Math.min(h * 0.27, Lt * 0.15), Smax = Math.max(k.S1, k.S2);
      const area = (x) => k.S1 + (k.S2 - k.S1) * shapeB(x), half = (x) => 0.5 * Hmax * Math.sqrt(area(x) / Smax);
      const yBase = cy - Hmax / 2 - 6, yTop = h * (compact ? 0.17 : 0.15), Hcol = yBase - yTop, Psc = 1.6e5;
      const taps = [0.14, 0.5, 0.88];
      // --- manómetros (tubos piezométricos): la columna sube con la presión
      taps.forEach((fx, i) => {
        const cx = x0 + fx * Lt, ylev = yBase - clamp(S.lv[i] / Psc, 0, 1) * Hcol, ytube = cy - half(fx) + 1;
        ctx.fillStyle = 'rgba(47,107,255,.55)'; ctx.fillRect(cx - 7, ylev, 14, ytube - ylev);
        ctx.fillStyle = 'rgba(160,220,255,.9)'; ctx.fillRect(cx - 7, ylev, 14, 2);
        ctx.strokeStyle = 'rgba(159,176,217,.75)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - 8, yTop - 4); ctx.lineTo(cx - 8, ytube); ctx.moveTo(cx + 8, yTop - 4); ctx.lineTo(cx + 8, ytube); ctx.stroke();
        const P = i === 1 ? k.P2 : P1B, lab = (i === 1 ? 'P₂' : i === 0 ? 'P₁' : 'P₃') + ' = ' + fmt(P / 1000, P < 1e5 ? 1 : 0) + ' kPa';
        txt(ctx, lab, cx, yTop - 14, { size: fs, color: i === 1 ? C.ambar : C.cian2, align: 'center', w: 700 });
      });
      // referencia: nivel de P₁ (cuánto baja la presión en el estrechamiento)
      const yref = yBase - (P1B / Psc) * Hcol; ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,209,102,.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0 + taps[0] * Lt - 14, yref); ctx.lineTo(x0 + taps[2] * Lt + 14, yref); ctx.stroke(); ctx.setLineDash([]);
      if (!compact) { txt(ctx, 'Presión', x0 - 2, yTop + 4, { size: fs - 1, color: C.txt2 }); }
      // --- tubo
      const N = 70; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const fx = i / N; ctx.lineTo(x0 + fx * Lt, cy - half(fx)); }
      for (let i = N; i >= 0; i--) { const fx = i / N; ctx.lineTo(x0 + fx * Lt, cy + half(fx)); }
      ctx.closePath(); const gt = ctx.createLinearGradient(0, cy - Hmax / 2, 0, cy + Hmax / 2); gt.addColorStop(0, 'rgba(47,107,255,.30)'); gt.addColorStop(1, 'rgba(0,212,255,.12)');
      ctx.fillStyle = gt; ctx.fill(); ctx.strokeStyle = C.cian2; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke();
      // --- partículas de fluido (color y estela ∝ velocidad local)
      const vmax = Math.max(k.v1, k.v2), kv = w * 0.022;
      for (const q of S.parts) {
        const a = area(q.x), v = (k.v1 * k.S1) / a, px = x0 + q.x * Lt, py = cy + q.yf * half(q.x), t = clamp(v / (vmax * 1.05), 0, 1);
        const col = [Math.round(lerp(60, 255, t * t)), Math.round(lerp(140, 255, t)), 255];
        const len = Math.min(26, v * kv * 0.06); ctx.strokeStyle = rgb(col, 0.35); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px - len, py); ctx.lineTo(px, py); ctx.stroke(); ctx.fillStyle = rgb(col, 0.95); ctx.beginPath(); ctx.arc(px, py, 2.6, 0, TAU); ctx.fill();
      }
      // --- flechas de velocidad y etiquetas bajo el tubo
      [[taps[0], k.v1, 'v₁', 'S₁', k.S1], [taps[1], k.v2, 'v₂', 'S₂', k.S2], [taps[2], k.v1, 'v₃ = v₁', 'S₃ = S₁', k.S1]].forEach((s, i) => {
        const cx = x0 + s[0] * Lt, L = clamp(12 + s[1] * 7, 16, Lt * 0.1), yy = cy;
        arrow(ctx, cx - L / 2, yy, cx + L / 2, yy, C.ambar, 3, 10);
        const yb = cy + Hmax / 2 + fs + 8;
        txt(ctx, s[2] + ' = ' + fmt(s[1], 1) + ' m/s', cx, yb, { size: fs, color: C.ambar, align: 'center', w: 700 });
        txt(ctx, (i === 2 ? s[3] : s[3] + ' = ' + fmt(s[4], 0) + ' cm²'), cx, yb + fs + 4, { size: fs - 0.5, color: C.txt2, align: 'center' });
      });
      // --- resumen
      const msg = k.P2 < 0 ? 'P₂ < 0: cavitación, el modelo ideal deja de valer' : (k.S2 < k.S1 ? 'S ↓  ⇒  v ↑  ⇒  P ↓' : k.S2 > k.S1 ? 'S ↑  ⇒  v ↓  ⇒  P ↑' : 'S₂ = S₁: nada cambia');
      chip(ctx, msg, w / 2, h - 14, { size: fs, color: k.P2 < 0 ? C.rojo : C.verde, align: 'center', border: k.P2 < 0 ? C.rojo : C.verde });
      if (!compact) txt(ctx, 'ρ = 1000 kg·m⁻³ · P₁ = 1,50×10⁵ Pa · horizontal, sin pérdidas', w - 8, h - 10, { size: fs - 2, color: C.txt2, align: 'right' });
    },
    formula(p) {
      const k = bernCalc(p);
      return '\\begin{aligned}S_1v_1=S_2v_2&\\Rightarrow v_2=\\dfrac{S_1v_1}{S_2}=\\dfrac{' + tx(k.S1, 0) + '\\times' + tx(k.v1, 1) + '}{' + tx(k.S2, 0) + '}=' + tx(k.v2, 1) + '\\ \\text{m}\\cdot\\text{s}^{-1}\\\\[3pt]'
        + 'P_2&=P_1+\\tfrac12\\rho\\,(v_1^2-v_2^2)=' + (k.P2 / 1000).toFixed(1).replace('.', '{,}') + '\\ \\text{kPa}\\end{aligned}';
    },
    lecturas(p) {
      const k = bernCalc(p);
      return [{ label: 'v₂', valor: fmt(k.v2, 2) + ' m·s⁻¹' }, { label: 'P₂', valor: sci(Math.max(k.P2, 0), 3) + ' Pa' },
        { label: 'ΔP = P₂ − P₁', valor: fmt(k.dP / 1000, 1) + ' kPa' }, { label: 'S₁/S₂', valor: fmt(k.S1 / k.S2, 2) },
        { label: 'ρ (dato)', valor: '1000 kg·m⁻³' }, { label: 'P₁ (dato)', valor: sci(P1B, 2) + ' Pa' }];
    },
  });

  // =====================================================================================
  // 2. TERMODINÁMICA — primer principio ΔU = W + Q  (convenio: lo RECIBIDO por el sistema es positivo)
  //    Didáctico: la animación no supone ningún proceso concreto (isobaro, isotermo…); solo el balance.
  //    U de referencia = 1200 J y escala de 0 a 2400 J; la agitación de las partículas ∝ √U
  //    (gas perfecto monoatómico: U ∝ T, v_cuadrática ∝ √T). Bucle: estado inicial → proceso → pausa → reinicio.
  // =====================================================================================
  const U0T = 1200, UMAXT = 2400;
  PCB.anim.register('termodinamica', {
    titulo: 'Primer principio: ΔU = W + Q', materia: 'physique',
    params: [
      { id: 'Q', label: 'Calor Q recibido (+) / cedido (−)', min: -500, max: 500, step: 10, def: 300, unit: 'J' },
      { id: 'W', label: 'Trabajo W recibido (+) / cedido (−)', min: -500, max: 500, step: 10, def: -100, unit: 'J' }],
    create(host, p) {
      const rnd = host.rng, N = host.reduced ? 22 : 48, parts = [];
      for (let i = 0; i < N; i++) parts.push({ u: rnd(), v: rnd(), a: rnd() * TAU });
      const S = { host, parts, t: 0, s: 0, cw: 130, gh: 100, btns: [] };
      return S;
    },
    step(S, dt, p) {
      S.t += dt; const ph = S.t % 6.2;
      S.s = ph < 3.2 ? smooth(ph / 3.2) : ph < 5.2 ? 1 : 1 - smooth((ph - 5.2) / 1);
      S.flujo = ph < 5.2 ? 1 : 0; // flechas visibles mientras ocurre el proceso
      const dU = num(p.Q, 0) + num(p.W, 0), U = clamp(U0T + dU * S.s, 120, UMAXT), sp = 0.34 * Math.sqrt(U / U0T) * (S.host.reduced ? 0.7 : 1);
      for (const q of S.parts) {
        q.u += Math.cos(q.a) * sp * dt; q.v += Math.sin(q.a) * sp * dt * (S.cw / Math.max(30, S.gh));
        if (q.u < 0.03) { q.u = 0.03; q.a = Math.PI - q.a; } if (q.u > 0.97) { q.u = 0.97; q.a = Math.PI - q.a; }
        if (q.v < 0.03) { q.v = 0.03; q.a = -q.a; } if (q.v > 0.97) { q.v = 0.97; q.a = -q.a; }
        if (Math.random() < dt * 0.4) q.a += (Math.random() - 0.5) * 1.2;
      }
    },
    draw(S, ctx, w, h, p) {
      fondo(ctx, w, h); S.btns = []; const fs = fsz(w), compact = w < 520;
      const Q = num(p.Q, 0), W = num(p.W, 0), dU = Q + W, s = S.s, U = clamp(U0T + dU * s, 120, UMAXT), fl = S.flujo ? 1 : 0;
      // --- cilindro
      const cw = clamp(w * 0.27, 96, 210), cx = w * 0.3, xl = cx - cw / 2, xr = cx + cw / 2;
      const yb = h * 0.72, yt = h * 0.2, ch = yb - yt;
      const yp0 = yt + ch * 0.42, yp = yp0 + clamp(W / 500, -1, 1) * ch * 0.3 * s; // W>0 comprime: el pistón baja
      S.cw = cw; S.gh = yb - yp;
      // fuente de calor / sumidero bajo el cilindro
      const t = S.t;
      if (Math.abs(Q) < 1) { ctx.fillStyle = 'rgba(159,176,217,.2)'; ctx.fillRect(xl - 8, yb, cw + 16, 12); txt(ctx, 'Q = 0 (pared adiabática)', cx, yb + 30, { size: fs, color: C.txt2, align: 'center' }); }
      else if (Q > 0) {
        for (let i = 0; i < 5; i++) { const fx = xl + 10 + (i + 0.5) * (cw - 20) / 5, fh = 24 + 10 * Math.sin(t * 9 + i * 1.7) + 12 * Math.sin(t * 5.3 + i);
          const g = ctx.createLinearGradient(0, yb + 14 + fh, 0, yb + 14); g.addColorStop(0, '#ffd166'); g.addColorStop(0.5, '#ff6b4a'); g.addColorStop(1, 'rgba(255,60,40,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(fx, yb + 14 + fh * 0.0 + 6, (cw / 12), fh * 0.55 + 4, 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#3a2a2a'; rr(ctx, xl - 8, yb + 2, cw + 16, 10, 4); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(76,201,240,.35)'; rr(ctx, xl - 6, yb + 4, cw + 12, 34, 6); ctx.fill(); ctx.strokeStyle = 'rgba(190,240,255,.8)'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.moveTo(xl + 10, yb + 12); ctx.lineTo(xl + 26, yb + 26); ctx.moveTo(xr - 30, yb + 10); ctx.lineTo(xr - 16, yb + 22); ctx.stroke();
      }
      // gas (color según U) y paredes de vidrio
      const tU = clamp((U - 200) / 2000, 0, 1), gc = termo((U / UMAXT) * 0.8);
      ctx.fillStyle = rgb(gc, 0.16 + 0.1 * tU); ctx.fillRect(xl, yp, cw, yb - yp);
      ctx.strokeStyle = 'rgba(190,210,255,.85)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(xl, yt - 10); ctx.lineTo(xl, yb); ctx.lineTo(xr, yb); ctx.lineTo(xr, yt - 10); ctx.stroke();
      // partículas
      for (const q of S.parts) { const px = xl + 6 + q.u * (cw - 12), py = yp + 6 + q.v * (yb - yp - 12); ctx.fillStyle = rgb(gc, 0.95); ctx.beginPath(); ctx.arc(px, py, 3.2, 0, TAU); ctx.fill(); }
      // pistón + vástago + mango
      ctx.fillStyle = '#5c6a96'; rr(ctx, xl + 2, yp - 9, cw - 4, 11, 3); ctx.fill(); ctx.strokeStyle = '#9fb0d9'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#7e8cb8'; ctx.fillRect(cx - 3, yt - 34 + (yp - yp0) * 0.0, 6, yp - 9 - (yt - 34)); rr(ctx, cx - 22, yt - 42, 44, 9, 4); ctx.fill();
      // --- flecha de calor Q (guiones que se mueven en el sentido del flujo)
      if (Math.abs(Q) >= 1) {
        const lw = 2 + 5 * Math.abs(Q) / 500, a = 0.35 + 0.65 * fl; ctx.globalAlpha = a;
        for (let i = 0; i < 3; i++) {
          const ax = xl + (i + 0.5) * cw / 3, y0 = Q > 0 ? yb + 54 : yb + 6, y1 = Q > 0 ? yb + 6 : yb + 54;
          ctx.setLineDash([9, 7]); ctx.lineDashOffset = Q > 0 ? t * 26 : -t * 26; ctx.strokeStyle = C.calor; ctx.lineWidth = lw; ctx.beginPath();
          ctx.moveTo(ax, y0); ctx.lineTo(ax, y0 + (y1 - y0) * 0.8); ctx.stroke(); ctx.setLineDash([]);
          arrow(ctx, ax, y0 + (y1 - y0) * 0.7, ax, y1, C.calor, lw, 6 + lw * 1.6);
        }
        ctx.globalAlpha = 1;
        txt(ctx, 'Q = ' + sgn(Q) + ' J', xl - 8, yb + 36, { size: fs + 1, color: C.calor, align: 'right', w: 700, halo: true });
        txt(ctx, Q > 0 ? 'recibido' : 'cedido', xl - 8, yb + 36 + fs + 3, { size: fs - 1, color: C.txt2, align: 'right' });
      }
      // --- flecha de trabajo W sobre el pistón
      if (Math.abs(W) >= 1) {
        const L = 26 + 40 * Math.abs(W) / 500, ax = cx + cw * 0.3, a = 0.35 + 0.65 * fl; ctx.globalAlpha = a;
        if (W > 0) arrow(ctx, ax, yp - 12 - L, ax, yp - 12, C.ambar, 4, 16); else arrow(ctx, ax, yp - 12, ax, yp - 12 - L, C.ambar, 4, 16);
        ctx.globalAlpha = 1;
        txt(ctx, 'W = ' + sgn(W) + ' J', xl - 8, yp - 22, { size: fs + 1, color: C.ambar, align: 'right', w: 700, halo: true });
        txt(ctx, W > 0 ? 'recibido (compresión)' : 'cedido (expansión)', xl - 8, yp - 22 + fs + 3, { size: fs - 1, color: C.txt2, align: 'right' });
      }
      // --- balance de energía interna (cascada U_i → +Q → +W → U_f), misma escala vertical
      const bx0 = w * 0.585, bw = (w * 0.965 - bx0) / 5.5, gap = bw * 0.5, yU = (v) => yb - (clamp(v, 0, UMAXT) / UMAXT) * (yb - yt);
      ctx.strokeStyle = C.borde; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(bx0 - 8, yt - 6); ctx.lineTo(bx0 - 8, yb); ctx.lineTo(w * 0.975, yb); ctx.stroke();
      ticks(0, UMAXT, 4).forEach((v) => { txt(ctx, String(v), bx0 - 12, yU(v), { size: fs - 2, color: C.txt2, align: 'right', base: 'middle' }); });
      txt(ctx, 'U (J)', bx0 - 8, yt - 12, { size: fs, color: C.verde, w: 700 });
      const colx = (i) => bx0 + i * (bw + gap);
      const barras = [
        { i: 0, a: 0, b: U0T, col: C.verde, lab: 'Uᵢ', v: fmt(U0T, 0) },
        { i: 1, a: U0T, b: U0T + Q * s, col: C.calor, lab: 'Q', v: sgn(Q) },
        { i: 2, a: U0T + Q * s, b: U0T + (Q + W) * s, col: C.ambar, lab: 'W', v: sgn(W) },
        { i: 3, a: 0, b: U, col: C.verde, lab: 'U_f', v: fmt(U0T + dU, 0) }];
      barras.forEach((b) => {
        const y1 = yU(b.a), y2 = yU(b.b), top = Math.min(y1, y2), hh = Math.max(2, Math.abs(y2 - y1));
        ctx.fillStyle = b.col; ctx.globalAlpha = b.i === 3 || b.i === 0 ? 0.85 : 0.9; rr(ctx, colx(b.i), top, bw, hh, 4); ctx.fill(); ctx.globalAlpha = 1;
        txt(ctx, b.lab, colx(b.i) + bw / 2, yb + fs + 4, { size: fs, color: b.col, align: 'center', w: 700 });
        if (b.i > 0 && b.i < 3 && (b.i === 1 ? Q : W) !== 0) txt(ctx, b.v, colx(b.i) + bw / 2, top - 5, { size: fs - 1, color: b.col, align: 'center', w: 700 });
        if (b.i === 0 || b.i === 3) txt(ctx, b.v, colx(b.i) + bw / 2, top - 5, { size: fs - 1, color: C.verde, align: 'center', w: 700 });
        if (b.i < 3) { /* línea de enlace */ ctx.strokeStyle = 'rgba(159,176,217,.35)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); const yy = yU(b.b); ctx.moveTo(colx(b.i) + bw, yy); ctx.lineTo(colx(b.i + 1), yy); ctx.stroke(); ctx.setLineDash([]); }
      });
      txt(ctx, 'ΔU = ' + sgn(dU) + ' J', (colx(0) + colx(3) + bw) / 2, yt - 12, { size: fs + 2, color: dU > 0 ? C.verde : dU < 0 ? C.frio : C.txt2, align: 'center', w: 700 });
      txt(ctx, dU > 0.5 ? 'U aumenta · T sube' : dU < -0.5 ? 'U disminuye · T baja' : 'U no cambia', (colx(0) + colx(3) + bw) / 2, yt + 4, { size: fs - 1, color: C.txt2, align: 'center' });
      // --- convenio de signos
      chip(ctx, 'Convenio: lo que RECIBE el sistema es positivo (+)', w / 2, h - 30, { size: fs, align: 'center', color: C.ambar, border: C.ambar });
      txt(ctx, 'Q > 0 calor recibido · W > 0 compresión (el entorno trabaja sobre el gas)', w / 2, h - 10, { size: fs - 1.5, color: C.txt2, align: 'center' });
    },
    formula(p) {
      const Q = num(p.Q, 0), W = num(p.W, 0);
      return '\\Delta U=W+Q=(' + sgnTx(W) + ')+(' + sgnTx(Q) + ')=' + sgnTx(Q + W) + '\\ \\text{J}';
    },
    lecturas(p) {
      const Q = num(p.Q, 0), W = num(p.W, 0), d = Q + W;
      return [{ label: 'ΔU', valor: sgn(d) + ' J' }, { label: 'Q', valor: sgn(Q) + ' J' }, { label: 'W', valor: sgn(W) + ' J' },
        { label: 'Efecto', valor: d > 0 ? 'U sube (el sistema gana energía)' : d < 0 ? 'U baja (el sistema pierde energía)' : 'U constante' }];
    },
    dispose(S) { disposeComun(S); },
  });

//@@FIN_PARTE_1@@
})();
