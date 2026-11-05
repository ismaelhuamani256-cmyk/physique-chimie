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

  // =====================================================================================
  // 3. ENFRIAMIENTO DE NEWTON — T(t) = T_ext + (T₀ − T_ext)·e^(−t/τ)
  //    Didáctico: el tiempo de la animación está acelerado para recorrer 5τ en ~20 s reales
  //    (se indica el factor). La pérdida de calor ∝ (T − T_ext) se dibuja con flechas.
  //    La gráfica incluye la asíntota T_ext, la marca t = τ (63 % del descenso) y la tangente en t = 0
  //    (que corta la asíntota exactamente en t = τ).
  // =====================================================================================
  const nwCalc = (p) => {
    const T0 = num(p.T0, 90), Te = num(p.Text, 20), tau = Math.max(1, num(p.tau, 120));
    return { T0, Te, tau, T: (t) => Te + (T0 - Te) * Math.exp(-t / tau) };
  };
  const NEWTON = {
    titulo: 'Ley de enfriamiento de Newton', materia: 'physique',
    params: [
      { id: 'T0', label: 'Temperatura inicial T₀', min: 20, max: 100, step: 1, def: 90, unit: '°C' },
      { id: 'Text', label: 'Temperatura exterior T_ext', min: -10, max: 40, step: 1, def: 20, unit: '°C' },
      { id: 'tau', label: 'Constante de tiempo τ', min: 20, max: 600, step: 10, def: 120, unit: 's' }],
    create(host, p) { return { host, t: 0, hold: 0, steam: [], btns: [] }; },
    onParam(S, id, v, p) { S.t = Math.min(S.t, 5 * nwCalc(p).tau); },
    step(S, dt, p) {
      const k = nwCalc(p), Tend = 5 * k.tau, rate = Tend / 20;
      if (S.t >= Tend) { S.hold += dt; if (S.hold > 2) { S.t = 0; S.hold = 0; } } else S.t = Math.min(Tend, S.t + dt * rate);
      p._t = S.t; S.rate = rate;
      // vapor: más intenso cuanto más caliente
      const lvl = clamp((k.T(S.t) - 35) / 65, 0, 1), max = S.host.reduced ? 14 : 42;
      if (S.steam.length < max && Math.random() < lvl * dt * 22) S.steam.push({ x: (Math.random() - 0.5) * 0.8, y: 0, vy: 0.35 + Math.random() * 0.3, ph: Math.random() * 6, life: 0, size: 0.6 + Math.random() * 0.6, lvl });
      for (const q of S.steam) { q.y += q.vy * dt; q.life += dt * 0.55; q.x += Math.sin(q.ph + q.y * 5) * dt * 0.12; }
      S.steam = S.steam.filter((q) => q.life < 1);
      vivo(S, NEWTON, p, dt);
    },
    draw(S, ctx, w, h, p) {
      fondo(ctx, w, h); const k = nwCalc(p), fs = fsz(w), wide = w >= 560, t = S.t, T = k.T(t), tau = k.tau;
      const R = wide ? { x: 8, y: 8, w: w * 0.38, h: h - 16 } : { x: 8, y: 6, w: w - 16, h: h * 0.42 };
      const G = wide ? { x: w * 0.38 + 66, y: 34, w: w * 0.62 - 86, h: h - 100 } : { x: 46, y: h * 0.42 + 34, w: w - 66, h: h * 0.58 - 74 };
      // --- escena: aire del entorno, taza, termómetro, flechas de pérdida
      const tint = termo(clamp((k.Te + 10) / 110, 0, 1)); ctx.fillStyle = rgb(tint, 0.1); rr(ctx, R.x, R.y, R.w, R.h, 12); ctx.fill(); ctx.strokeStyle = 'rgba(42,55,107,.9)'; ctx.lineWidth = 1; ctx.stroke();
      txt(ctx, 'Aire: T_ext = ' + fmt(k.Te, 0) + ' °C', R.x + 10, R.y + fs + 4, { size: fs, color: C.txt2 });
      const mw = Math.min(R.w * 0.34, R.h * 0.36), mh = mw * 1.08, cx = R.x + R.w * 0.46, yb = R.y + R.h * (wide ? 0.82 : 0.9);
      const tc = termo(clamp((T + 5) / 105, 0, 1));
      // vapor
      for (const q of S.steam) { const a = (1 - q.life) * 0.5 * q.lvl * Math.sin(Math.min(1, q.life * 4) * Math.PI / 2), r = (6 + q.life * 22) * q.size * (mw / 90);
        const px = cx + q.x * mw * 0.5, py = yb - mh * 0.86 - q.y * mh * 0.9; const g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(235,240,255,' + a + ')'); g.addColorStop(1, 'rgba(235,240,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); }
      // asa
      ctx.strokeStyle = '#cfd8ff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx + mw / 2, yb - mh * 0.5, mh * 0.2, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      // líquido + cuerpo
      const lx = cx - mw / 2, ly = yb - mh * 0.86; ctx.save(); rr(ctx, lx, yb - mh, mw, mh, 10); ctx.clip();
      const gl = ctx.createLinearGradient(lx, 0, lx + mw, 0); gl.addColorStop(0, rgb(tc.map((c) => c * 0.8 | 0))); gl.addColorStop(0.5, rgb(tc)); gl.addColorStop(1, rgb(tc.map((c) => c * 0.75 | 0)));
      ctx.fillStyle = gl; ctx.fillRect(lx, ly, mw, yb - ly); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(lx + mw * 0.12, ly + 6, mw * 0.08, mh * 0.7); ctx.restore();
      ctx.fillStyle = rgb(tc.map((c) => Math.min(255, c * 1.12 | 0))); ctx.beginPath(); ctx.ellipse(cx, ly, mw / 2 - 1, mw * 0.07, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#dfe6ff'; ctx.lineWidth = 3.5; rr(ctx, lx, yb - mh, mw, mh, 10); ctx.stroke();
      // termómetro (escala −10 … 110 °C)
      const tx0 = cx - mw / 2 - Math.min(48, R.w * 0.14), th = mh * 1.25, ty1 = yb - th, tyb = yb - 10, tyv = (v) => tyb - clamp((v + 10) / 120, 0, 1) * (tyb - ty1 - 6);
      ctx.fillStyle = 'rgba(223,230,255,.14)'; rr(ctx, tx0 - 5, ty1, 10, tyb - ty1, 5); ctx.fill(); ctx.strokeStyle = '#dfe6ff'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = rgb(tc); ctx.fillRect(tx0 - 2.5, tyv(T), 5, tyb - tyv(T)); ctx.beginPath(); ctx.arc(tx0, tyb + 4, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = '#dfe6ff'; ctx.stroke();
      for (let v = 0; v <= 100; v += 20) { ctx.strokeStyle = 'rgba(223,230,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx0 + 6, tyv(v)); ctx.lineTo(tx0 + 11, tyv(v)); ctx.stroke(); if (wide || v % 40 === 0) txt(ctx, String(v), tx0 - 9, tyv(v), { size: fs - 2.5, color: C.txt2, align: 'right', base: 'middle' }); }
      // flechas de pérdida de calor (∝ T − T_ext)
      const dT = T - k.Te, sc = clamp(Math.abs(dT) / Math.max(Math.abs(k.T0 - k.Te), 5), 0, 1);
      if (Math.abs(dT) > 0.3) { const L = 6 + 30 * sc, ax = cx + mw / 2 + mh * 0.2 + 12, out = dT > 0, col = out ? C.calor : C.frio; ctx.globalAlpha = 0.45 + 0.55 * sc;
        for (let i = 0; i < 3; i++) { const y = yb - mh * (0.25 + i * 0.25); if (out) arrow(ctx, ax, y, ax + L, y, col, 2.4, 9); else arrow(ctx, ax + L, y, ax, y, col, 2.4, 9); } ctx.globalAlpha = 1;
        txt(ctx, out ? 'pierde calor' : 'gana calor', ax + 2, yb - mh * 1.0 - 4, { size: fs - 1.5, color: col }); }
      // lecturas del termómetro
      chip(ctx, 'T = ' + fmt(T, 1) + ' °C', cx, R.y + R.h * (wide ? 0.13 : 0.2), { size: fs + 3, w: 700, align: 'center', color: C.txt, border: rgb(tc) });
      chip(ctx, 't = ' + fmt(t, 0) + ' s  (×' + fmt(S.rate || 1, 1) + ' más rápido)', cx, yb + (wide ? 22 : 0) + (wide ? 0 : 0) - (wide ? 0 : 0) + (wide ? 0 : 0) - (wide ? 0 : 0), { size: fs - 1, align: 'center', color: C.txt2, w: 400 });
      // --- gráfica T(t)
      const lo = Math.min(k.T0, k.Te), hi = Math.max(k.T0, k.Te), pad = Math.max(2, 0.12 * (hi - lo)), Tend = 5 * tau;
      const ax = ejes(ctx, G, 0, Tend, lo - pad, hi + pad, { xt: [0, 1, 2, 3, 4, 5].map((i) => i * tau), fx: (v) => fmt(v, 0), fy: (v) => fmt(v, 0), xl: 't (s)', yl: 'T (°C)', ny: 4 });
      ctx.save(); ctx.beginPath(); ctx.rect(G.x, G.y - 2, G.w, G.h + 4); ctx.clip();
      // asíntota
      ctx.setLineDash([6, 5]); ctx.strokeStyle = C.frio; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(G.x, ax.Y(k.Te)); ctx.lineTo(G.x + G.w, ax.Y(k.Te)); ctx.stroke(); ctx.setLineDash([]);
      // tangente en t = 0 (corta la asíntota en t = τ)
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,209,102,.7)'; ctx.beginPath(); ctx.moveTo(ax.X(0), ax.Y(k.T0)); ctx.lineTo(ax.X(tau), ax.Y(k.Te)); ctx.stroke(); ctx.setLineDash([]);
      // curva completa (tenue) y curva recorrida
      const curva = (tmax, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.beginPath(); const n = 90; for (let i = 0; i <= n; i++) { const tt = (tmax * i) / n; i ? ctx.lineTo(ax.X(tt), ax.Y(k.T(tt))) : ctx.moveTo(ax.X(tt), ax.Y(k.T(tt))); } ctx.stroke(); };
      curva(Tend, 'rgba(0,212,255,.22)', 2); curva(t, C.cian, 3.2);
      ctx.restore();
      // marca t = τ
      const xT = ax.X(tau), yT = ax.Y(k.T(tau)); ctx.setLineDash([3, 4]); ctx.strokeStyle = C.ambar; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(xT, G.y + G.h); ctx.lineTo(xT, yT); ctx.lineTo(G.x, yT); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.ambar; ctx.beginPath(); ctx.arc(xT, yT, 4.5, 0, TAU); ctx.fill();
      txt(ctx, 'τ = ' + fmt(tau, 0) + ' s', xT + 6, G.y + G.h - 6, { size: fs, color: C.ambar, w: 700, halo: true });
      txt(ctx, 'T(τ) = ' + fmt(k.T(tau), 1) + ' °C  (63 % del cambio)', Math.min(xT + 8, G.x + G.w - 6), yT + (k.T0 > k.Te ? -8 : fs + 8), { size: fs - 1, color: C.ambar, align: xT + 8 > G.x + G.w * 0.55 ? 'right' : 'left', halo: true });
      txt(ctx, 'T_ext', G.x + G.w - 4, ax.Y(k.Te) + (k.T0 > k.Te ? -6 : fs + 5), { size: fs, color: C.frio, align: 'right', w: 700, halo: true });
      txt(ctx, 'tangente en t = 0', ax.X(tau * 0.5) + 8, ax.Y(lerp(k.T0, k.Te, 0.5)) - 6, { size: fs - 2, color: 'rgba(255,209,102,.8)', halo: true });
      // punto móvil
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ax.X(t), ax.Y(T), 5.5, 0, TAU); ctx.fill(); ctx.strokeStyle = C.cian; ctx.lineWidth = 2.5; ctx.stroke();
    },
    formula(p) {
      const k = nwCalc(p), t = p._t || 0, d = k.T0 - k.Te;
      return '\\begin{aligned}T(t)&=T_{\\text{ext}}+(T_0-T_{\\text{ext}})\\,e^{-t/\\tau}=' + tx(k.Te, 0) + (d >= 0 ? '+' : '-') + tx(Math.abs(d), 0) + '\\,e^{-t/' + tx(k.tau, 0) + '}\\\\[3pt]'
        + 'T(' + tx(t, 0) + '\\ \\text{s})&=' + tx(k.T(t), 1) + '\\ {}^{\\circ}\\text{C}\\end{aligned}';
    },
    lecturas(p) {
      const k = nwCalc(p), t = p._t || 0;
      return [{ label: 't', valor: fmt(t, 0) + ' s' }, { label: 'T(t)', valor: fmt(k.T(t), 1) + ' °C' }, { label: 'τ', valor: fmt(k.tau, 0) + ' s' },
        { label: 'T(τ)', valor: fmt(k.T(k.tau), 1) + ' °C' }, { label: 'T(5τ)', valor: fmt(k.T(5 * k.tau), 1) + ' °C' }];
    },
  };
  PCB.anim.register('enfriamiento-newton', NEWTON);

  // =====================================================================================
  // 4. ONDAS — λ = v/f ; periodo T = 1/f ; atenuación en dB
  //    Modo 0: onda viajera transversal (representación: también vale para el sonido, que en realidad
  //            es longitudinal) con las "partículas del medio" oscilando. Escala: la ventana muestra
  //            ≈3,3 λ de los valores con que se abre; después, λ en pantalla cambia con f y v.
  //            El tiempo está ralentizado (≈0,5 Hz en pantalla); T real se indica en la cota.
  //    Modo 1: fuente sonora puntual en campo libre: L(d) = L₀ − 20·log(d/d₀), d₀ = 1 m
  //            (solo atenuación geométrica; sin absorción). Los círculos no están a escala de λ.
  // =====================================================================================
  const modoOnda = (p) => (p.modo === 1 || p.modo === true || String(p.modo).toLowerCase() === 'db' || p.modo === '1' ? 1 : 0);
  const ondCalc = (p) => {
    const f = Math.max(0.1, num(p.f, 440)), v = Math.max(0.1, num(p.v, 340)), L0 = num(p.L0, 80), d = Math.max(1, num(p.d, 8));
    return { f, v, lam: v / f, T: 1 / f, L0, d, d2: 2 * d, L1: L0 - 20 * Math.log10(d), L2: L0 - 20 * Math.log10(2 * d) };
  };
  const ONDAS = {
    titulo: 'Ondas: λ = v/f y atenuación', materia: 'physique',
    params: [
      { id: 'f', label: 'Frecuencia f', min: 1, max: 2000, step: 1, def: 440, unit: 'Hz' },
      { id: 'v', label: 'Celeridad v', min: 1, max: 1500, step: 1, def: 340, unit: 'm/s' },
      { id: 'modo', label: 'Modo', min: 0, max: 1, step: 1, def: 0, oculto: true },
      { id: 'L0', label: 'Nivel a 1 m (modo dB)', min: 40, max: 110, step: 1, def: 80, unit: 'dB' },
      { id: 'd', label: 'Distancia d (modo dB)', min: 1, max: 25, step: 0.5, def: 8, unit: 'm' }],
    create(host, p) {
      const k = ondCalc(p);
      const S = { host, ph: 0, t: 0, lam0: k.lam, f0: k.f, btns: [], rings: [], emit: 0, pend: 0 };
      punteros(S, {
        down: (x, y) => { if (modoOnda(p) !== 1 || !S.geo) return false; return Math.abs(x - S.geo.xd1) < 22 && y > S.geo.yTop - 10 && y < S.geo.yAx + 20; },
        move: (x) => { const g = S.geo; if (!g) return; const d = ((x - g.xSrc) / g.axLen) * g.Dmax; p.d = clamp(Math.round(d * 2) / 2, 1, 25); S._vt = 9; vivo(S, ONDAS, p, 0); const inp = S.host.host.parentElement.querySelector('.anim-ctrl input[aria-label="Distancia d (modo dB)"]'); if (inp) { inp.value = p.d; const b = inp.parentElement.querySelector('b'); if (b) b.textContent = fmt(p.d, 1) + ' m'; } },
        hover: (x, y) => modoOnda(p) === 1 && S.geo && Math.abs(x - S.geo.xd1) < 22 && y > S.geo.yTop - 10 && y < S.geo.yAx + 20,
      });
      return S;
    },
    step(S, dt, p) {
      const k = ondCalc(p); S.t += dt;
      const fv = clamp(0.5 * Math.pow(k.f / S.f0, 0.6), 0.12, 3); S.fv = fv; S.ph += TAU * fv * dt;
      // círculos del modo dB: uno cada 0,55 s
      S.emit += dt; if (S.emit > 0.55) { S.emit = 0; S.rings.push(S.t); if (S.rings.length > 9) S.rings.shift(); }
    },
    draw(S, ctx, w, h, p) {
      fondo(ctx, w, h); S.btns = []; const k = ondCalc(p), fs = fsz(w), modo = modoOnda(p);
      const setModo = (m) => () => { p.modo = m; S._vt = 9; vivo(S, ONDAS, p, 0); };
      btn(S, ctx, { x: 10, y: 8, w: 92, h: 26, label: 'Onda viajera', active: modo === 0, on: setModo(0), size: fs });
      btn(S, ctx, { x: 108, y: 8, w: 120, h: 26, label: 'Sonido · dB', active: modo === 1, on: setModo(1), size: fs });
      const mx = w * 0.05;
      if (modo === 0) {
        // ---------------- modo 0: onda viajera + periodo ----------------
        const Rw = { x: mx, y: h * 0.17, w: w - 2 * mx, h: h * 0.42 }, yc = Rw.y + Rw.h * 0.58, Ap = Rw.h * 0.24, pxm = Rw.w / 3.3 / S.lam0, lampx = k.lam * pxm, kx = TAU / lampx;
        ctx.strokeStyle = 'rgba(159,176,217,.35)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Rw.x, yc); ctx.lineTo(Rw.x + Rw.w, yc); ctx.stroke(); ctx.setLineDash([]);
        const yw = (x) => yc - Ap * Math.sin(kx * (x - Rw.x) - S.ph);
        const grad = ctx.createLinearGradient(Rw.x, 0, Rw.x + Rw.w, 0); grad.addColorStop(0, C.violeta); grad.addColorStop(1, C.cian2);
        ctx.strokeStyle = grad; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.beginPath(); for (let x = 0; x <= Rw.w; x += 3) { const X = Rw.x + x; x ? ctx.lineTo(X, yw(X)) : ctx.moveTo(X, yw(X)); } ctx.stroke();
        // partículas del medio
        const M = S.host.reduced ? 28 : 60; for (let i = 0; i <= M; i++) { const X = Rw.x + (i / M) * Rw.w; ctx.fillStyle = 'rgba(234,240,255,.9)'; ctx.beginPath(); ctx.arc(X, yw(X), 3.3, 0, TAU); ctx.fill(); }
        // dos partículas en fase: separadas λ
        let xa = Rw.x + Rw.w * 0.1; if (xa + lampx > Rw.x + Rw.w - 6) xa = Rw.x + 8; const xb = xa + lampx, okLam = xb <= Rw.x + Rw.w - 4;
        [xa, okLam ? xb : null].forEach((X) => { if (X == null) return; ctx.strokeStyle = C.ambar; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, yw(X), 7, 0, TAU); ctx.stroke(); ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X, yw(X) - 8); ctx.lineTo(X, Rw.y + 6); ctx.stroke(); ctx.setLineDash([]); });
        if (okLam) cota(ctx, xa, Rw.y + 12, xb, Rw.y + 12, 'λ = ' + lfmt(k.lam), C.ambar, fs + 1, true); else txt(ctx, 'λ = ' + lfmt(k.lam) + ' (mayor que la ventana)', xa, Rw.y + 12, { size: fs, color: C.ambar, w: 700 });
        // sentido de propagación
        arrow(ctx, Rw.x + Rw.w - 80, Rw.y + Rw.h + 10, Rw.x + Rw.w - 10, Rw.y + Rw.h + 10, C.cian2, 3, 11); txt(ctx, 'v = ' + fmt(k.v, 0) + ' m/s', Rw.x + Rw.w - 85, Rw.y + Rw.h + 14, { size: fs, color: C.cian2, w: 700, align: 'right' });
        // gráfica de la partícula resaltada: y(t) con el periodo T
        const G = { x: mx + 34, y: h * 0.7, w: w - 2 * mx - 34, h: h * 0.2 }, fv = S.fv || 0.5, win = 3 / fv;
        ctx.fillStyle = 'rgba(10,15,32,.55)'; rr(ctx, G.x, G.y, G.w, G.h, 6); ctx.fill(); ctx.strokeStyle = C.borde; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = 'rgba(159,176,217,.3)'; ctx.beginPath(); ctx.moveTo(G.x, G.y + G.h / 2); ctx.lineTo(G.x + G.w, G.y + G.h / 2); ctx.stroke();
        const ka = kx * (xa - Rw.x), Xt = (tt) => G.x + ((tt - (S.t - win)) / win) * G.w, ph_t = (tt) => S.ph - TAU * fv * (S.t - tt);
        ctx.save(); ctx.beginPath(); ctx.rect(G.x, G.y, G.w, G.h); ctx.clip(); ctx.strokeStyle = C.ambar; ctx.lineWidth = 2.6; ctx.beginPath();
        for (let i = 0; i <= 120; i++) { const tt = S.t - win + (win * i) / 120, y = G.y + G.h / 2 - Math.sin(ka - ph_t(tt)) * G.h * 0.36; i ? ctx.lineTo(Xt(tt), y) : ctx.moveTo(Xt(tt), y); } ctx.stroke(); ctx.restore();
        const d = (((S.ph - (ka - Math.PI / 2)) % TAU) + TAU) % TAU, tp0 = S.t - d / (TAU * fv), tp1 = tp0 - 1 / fv;
        if (Xt(tp1) > G.x) { const yy = G.y + G.h / 2 - G.h * 0.36 - 7; [tp1, tp0].forEach((tt) => { ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(255,209,102,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Xt(tt), yy - 4); ctx.lineTo(Xt(tt), G.y + G.h / 2 - G.h * 0.36 + 2); ctx.stroke(); ctx.setLineDash([]); }); cota(ctx, Xt(tp1), yy, Xt(tp0), yy, 'T = 1/f = ' + tfmt(k.T), C.ambar, fs, true); }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(G.x + G.w, G.y + G.h / 2 - Math.sin(ka - S.ph) * G.h * 0.36, 4.5, 0, TAU); ctx.fill();
        txt(ctx, 'posición de la partícula anaranjada', G.x + 4, G.y + G.h + fs + 4, { size: fs - 1, color: C.txt2 }); txt(ctx, 'tiempo (cámara lenta)', G.x + G.w, G.y + G.h + fs + 4, { size: fs - 1, color: C.txt2, align: 'right' });
        txt(ctx, 'y', G.x - 8, G.y + G.h / 2, { size: fs, color: C.txt2, align: 'right', base: 'middle' });
        chip(ctx, 'f = ' + fmt(k.f, 0) + ' Hz', w - 10, 21, { size: fs, align: 'right', color: C.violeta, border: C.violeta });
      } else {
        // ---------------- modo 1: sonido y atenuación en dB ----------------
        const xSrc = w * 0.09, axLen = w * 0.84, Dmax = 50, yAx = h * 0.4, xd = (d) => xSrc + (d / Dmax) * axLen, yTop = h * 0.14;
        S.geo = { xSrc, axLen, Dmax, yAx, yTop, xd1: xd(k.d) };
        // eje de distancias
        ctx.strokeStyle = C.borde; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(xSrc, yAx); ctx.lineTo(xSrc + axLen, yAx); ctx.stroke();
        [0, 10, 20, 30, 40, 50].forEach((d) => { ctx.beginPath(); ctx.moveTo(xd(d), yAx - 3); ctx.lineTo(xd(d), yAx + 3); ctx.stroke(); txt(ctx, d + (d === 50 ? ' m' : ''), xd(d), yAx + fs + 6, { size: fs - 1.5, color: C.txt2, align: 'center' }); });
        // círculos que se alejan; opacidad ∝ nivel sonoro a esa distancia
        const spd = axLen / 3.6;
        S.rings.forEach((tb) => { const r = (S.t - tb) * spd; if (r < 4 || r > axLen) return; const d = Math.max(1, (r / axLen) * Dmax), Ld = k.L0 - 20 * Math.log10(d), a = clamp((Ld - 15) / (k.L0 - 15), 0.04, 1);
          ctx.strokeStyle = 'rgba(0,212,255,' + (0.8 * a) + ')'; ctx.lineWidth = 1 + 3 * a; ctx.beginPath(); ctx.arc(xSrc, yAx, r, -1.0, 1.0); ctx.stroke(); ctx.beginPath(); ctx.arc(xSrc, yAx, r, Math.PI - 1.0, Math.PI + 1.0); ctx.stroke(); });
        // fuente (altavoz)
        ctx.fillStyle = '#7e8cb8'; ctx.beginPath(); ctx.moveTo(xSrc - 14, yAx - 7); ctx.lineTo(xSrc - 4, yAx - 7); ctx.lineTo(xSrc + 8, yAx - 16); ctx.lineTo(xSrc + 8, yAx + 16); ctx.lineTo(xSrc - 4, yAx + 7); ctx.lineTo(xSrc - 14, yAx + 7); ctx.closePath(); ctx.fill();
        txt(ctx, 'L₀ = ' + fmt(k.L0, 0) + ' dB a 1 m', xSrc - 14, yAx - 24, { size: fs, color: C.cian2, w: 700 });
        // sonómetros a d y 2d
        const sono = (d, L, col, lab) => {
          const x = xd(d); if (d > Dmax + 0.1) return; ctx.strokeStyle = col; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, yAx); ctx.lineTo(x, yTop + 40); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(18,26,51,.95)'; rr(ctx, x - 34, yTop, 68, 40, 7); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke();
          txt(ctx, fmt(L, 1) + ' dB', x, yTop + 15, { size: fs + 1, color: col, align: 'center', w: 700, base: 'middle' }); txt(ctx, lab, x, yTop + 32, { size: fs - 2, color: C.txt2, align: 'center', base: 'middle' });
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, yAx, 5, 0, TAU); ctx.fill();
        };
        sono(k.d, k.L1, C.ambar, 'd = ' + fmt(k.d, 1) + ' m'); sono(k.d2, k.L2, C.magenta, '2d = ' + fmt(k.d2, 1) + ' m');
        if (k.d2 <= Dmax) cota(ctx, xd(k.d), yAx + fs * 2 + 14, xd(k.d2), yAx + fs * 2 + 14, 'A = ' + fmt(k.L1 - k.L2, 1) + ' dB', C.verde, fs, false);
        txt(ctx, 'arrastra el sonómetro ◂ ▸', xSrc + axLen, yAx - 24, { size: fs - 1.5, color: C.txt2, align: 'right' });
        // curva L(d)
        const G = { x: w * 0.1, y: h * 0.62, w: w * 0.84, h: h * 0.24 }, ylo = Math.max(0, k.L0 - 50), yhi = k.L0 + 6;
        const ax = ejes(ctx, G, 0, Dmax, ylo, yhi, { xt: [0, 10, 20, 30, 40, 50], fx: (v) => fmt(v, 0), fy: (v) => fmt(v, 0), xl: 'distancia d (m)', yl: 'L (dB)', ny: 3 });
        ctx.strokeStyle = C.cian; ctx.lineWidth = 2.8; ctx.beginPath(); for (let i = 0; i <= 100; i++) { const d = 1 + (49 * i) / 100, L = clamp(k.L0 - 20 * Math.log10(d), ylo, yhi); i ? ctx.lineTo(ax.X(d), ax.Y(L)) : ctx.moveTo(ax.X(d), ax.Y(L)); } ctx.stroke();
        [[k.d, k.L1, C.ambar], [k.d2, k.L2, C.magenta]].forEach((q) => { if (q[0] > Dmax) return; ctx.fillStyle = q[2]; ctx.beginPath(); ctx.arc(ax.X(q[0]), ax.Y(clamp(q[1], ylo, yhi)), 5, 0, TAU); ctx.fill(); });
        chip(ctx, 'Duplicar la distancia = −6 dB (atenuación geométrica)', w - 10, 21, { size: fs - 1, align: 'right', color: C.verde, border: C.verde });
      }
    },
    formula(p) {
      const k = ondCalc(p);
      if (modoOnda(p) === 1) return '\\begin{aligned}L(d)&=L_0-20\\log\\dfrac{d}{d_0}\\quad(d_0=1\\ \\text{m})\\\\[3pt]A&=L_1-L_2=20\\log\\dfrac{' + tx(k.d2, 1) + '}{' + tx(k.d, 1) + '}=' + tx(k.L1 - k.L2, 1) + '\\ \\text{dB}\\end{aligned}';
      return '\\lambda=\\dfrac{v}{f}=\\dfrac{' + tx(k.v, 0) + '}{' + tx(k.f, 0) + '}=' + ltex(k.lam) + '\\qquad T=\\dfrac1f=' + ttex(k.T);
    },
    lecturas(p) {
      const k = ondCalc(p);
      if (modoOnda(p) === 1) return [{ label: 'L(d)', valor: fmt(k.L1, 1) + ' dB' }, { label: 'L(2d)', valor: fmt(k.L2, 1) + ' dB' }, { label: 'Atenuación A', valor: fmt(k.L1 - k.L2, 1) + ' dB' }, { label: 'L₀ a 1 m', valor: fmt(k.L0, 0) + ' dB' }];
      return [{ label: 'λ', valor: lfmt(k.lam) }, { label: 'T', valor: tfmt(k.T) }, { label: 'f', valor: fmt(k.f, 0) + ' Hz' }, { label: 'v', valor: fmt(k.v, 0) + ' m·s⁻¹' }];
    },
    dispose(S) { disposeComun(S); },
  };
  PCB.anim.register('ondas', ONDAS);

  // =====================================================================================
  // 5. DIFRACCIÓN — θ ≈ λ/a ; anchura de la tache centrale L = 2λD/a ; interfranja i = λD/b
  //    El campo de ondas se calcula sumando fuentes de Huygens repartidas en cada rendija
  //    (cada celda: Σ cos(kr − ωt)/√r) y se pinta como imagen: es una simulación real, no un dibujo.
  //    ESCALA DIDÁCTICA: con a ≈ 50 µm y λ ≈ 550 nm (a/λ ≈ 90) la difracción no se vería en un esquema.
  //    Se exagera la proporción rendija/longitud de onda con una función monótona
  //    (a/λ)_dibujo = 1,2 + 6·(a/λ / 90)^0,6 — misma para a y b — y el esquema lo avisa.
  //    Las LECTURAS (θ, L, i) usan siempre los valores reales (λ, a, b, D).
  // =====================================================================================
  const modoDif = (p) => (p.modo === 1 || p.modo === 2 || p.modo === true || p.modo === '1' || /dos|2/i.test(String(p.modo)) ? 1 : 0);
  const difCalc = (p) => {
    const lam = Math.max(100, num(p.lam, 550)), a = Math.max(1, num(p.a, 50)), b = Math.max(a * 1.2, num(p.b, 250)), D = Math.max(0.1, num(p.D, 2));
    return { lam, a, b, D, th: (lam * 1e-9) / (a * 1e-6), Lc: (2 * lam * 1e-9 * D) / (a * 1e-6), i: (lam * 1e-9 * D) / (b * 1e-6), modo: modoDif(p) };
  };
  const visR = (rho) => 1.2 + 6 * Math.pow(rho / 90, 0.6);
  const sinc2 = (x) => { if (Math.abs(x) < 1e-6) return 1; const s = Math.sin(x) / x; return s * s; };
  const DIFR = {
    titulo: 'Difracción e interferencias', materia: 'physique',
    params: [
      { id: 'lam', label: 'Longitud de onda λ', min: 380, max: 780, step: 5, def: 550, unit: 'nm' },
      { id: 'a', label: 'Anchura de la rendija a', min: 10, max: 200, step: 5, def: 50, unit: 'µm' },
      { id: 'modo', label: 'Modo', min: 0, max: 1, step: 1, def: 0, oculto: true },
      { id: 'b', label: 'Separación de rendijas b (2 rendijas)', min: 100, max: 500, step: 10, def: 250, unit: 'µm' },
      { id: 'D', label: 'Distancia a la pantalla D', min: 1, max: 5, step: 0.1, def: 2, unit: 'm' }],
    create(host, p) {
      const S = { host, t: 0, btns: [], key: '', off: document.createElement('canvas') };
      punteros(S, {}); return S;
    },
    step(S, dt) { S.t += dt; },
    /** Geometría del esquema (px) a partir del tamaño y de los parámetros. */
    geo(S, w, h, p) {
      const k = difCalc(p), sc = clamp(Math.min(w / 700, h / 340), 0.5, 1.3);
      const y0 = h * 0.14, y1 = h * 0.9, Hs = y1 - y0, xb = w * 0.26, xs = w * 0.7, cyc = (y0 + y1) / 2;
      let lamv = clamp(14 * (k.lam / 550) * sc, 4, 22), aR = visR((k.a * 1000) / k.lam), bR = Math.max(visR((k.b * 1000) / k.lam), aR * 1.6 + 1);
      let aV = aR * lamv, bV = bR * lamv; const need = k.modo ? bV + aV : aV, lim = Hs * (k.modo ? 0.86 : 0.62);
      if (need > lim) { const f = lim / need; lamv *= f; aV *= f; bV *= f; }
      return { k, sc, y0, y1, Hs, xb, xs, cyc, lamv, aV, bV, aR: aV / lamv, bR: bV / lamv, Dv: xs - xb };
    },
    /** Precalcula Σ cos(kr), Σ sin(kr) (con compensación 1/√r) para cada celda del campo difractado. */
    campo(S, g, w, h) {
      const cs = Math.max(3, Math.round(4 * g.sc)), nx = Math.ceil(g.xs / cs), ny = Math.ceil(g.Hs / cs), kk = TAU / g.lamv;
      const slits = g.k.modo ? [g.cyc - g.bV / 2, g.cyc + g.bV / 2] : [g.cyc], src = [];
      slits.forEach((yc) => { const n = clamp(Math.ceil(g.aV / (g.lamv * 0.4)), 3, 14); for (let i = 0; i < n; i++) src.push(yc - g.aV / 2 + ((i + 0.5) * g.aV) / n); });
      const c = new Float32Array(nx * ny), s = new Float32Array(nx * ny), amps = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = i * cs + cs / 2, y = g.y0 + j * cs + cs / 2; if (x <= g.xb) continue;
        let sc_ = 0, ss = 0; for (const ys of src) { const r = Math.hypot(x - g.xb, y - ys) + 1e-3, a = 1 / Math.sqrt(r + g.lamv * 2); sc_ += Math.cos(kk * r) * a; ss += Math.sin(kk * r) * a; }
        const comp = Math.sqrt(x - g.xb + g.lamv * 3); c[j * nx + i] = sc_ * comp; s[j * nx + i] = ss * comp; amps.push(Math.hypot(sc_, ss) * comp);
      }
      amps.sort((a, b) => a - b); const ref = (amps[Math.floor(amps.length * 0.96)] || 1) * 1.05;
      for (let q = 0; q < c.length; q++) { c[q] /= ref; s[q] /= ref; }
      S.cmp = { c, s, nx, ny, cs }; S.off.width = nx; S.off.height = ny; S.img = S.off.getContext('2d').createImageData(nx, ny); S.d32 = new Uint32Array(S.img.data.buffer);
    },
    draw(S, ctx, w, h, p) {
      fondo(ctx, w, h); S.btns = []; const g = DIFR.geo(S, w, h, p), k = g.k, fs = fsz(w), hue = nmRGB(k.lam);
      const key = [w | 0, h | 0, k.lam, k.a, k.b, k.modo].join('|'); if (key !== S.key) { S.key = key; DIFR.campo(S, g, w, h); }
      const { c, s, nx, ny, cs } = S.cmp, om = (TAU * S.t) / 0.8, co = Math.cos(om), si = Math.sin(om), kk = TAU / g.lamv;
      // paleta E∈[−1,1] → color (cresta = color de la luz, valle = fondo)
      if (S.palKey !== hue.join()) { S.palKey = hue.join(); S.pal = new Uint32Array(256); for (let i = 0; i < 256; i++) { const f = Math.pow(i / 255, 1.7), r = Math.round(lerp(12, hue[0], f)), gg = Math.round(lerp(18, hue[1], f)), b = Math.round(lerp(36, hue[2], f)); S.pal[i] = (255 << 24) | (b << 16) | (gg << 8) | r; } }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = i * cs + cs / 2; let E;
        if (x <= g.xb) E = 0.85 * Math.cos(kk * (x - g.xb) - om); else { const q = j * nx + i; E = c[q] * co + s[q] * si; }
        S.d32[j * nx + i] = S.pal[clamp(Math.round((E * 0.5 + 0.5) * 255), 0, 255)];
      }
      S.off.getContext('2d').putImageData(S.img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(S.off, 0, g.y0, nx * cs, ny * cs);
      ctx.fillStyle = C.bg; ctx.fillRect(nx * cs - 1, g.y0, w - nx * cs + 1, g.Hs + 1); // limpia el sobrante a la derecha de xs
      // pared con la(s) rendija(s)
      const slits = k.modo ? [g.cyc - g.bV / 2, g.cyc + g.bV / 2] : [g.cyc]; ctx.fillStyle = '#5c6a96'; let yy = g.y0 - 6;
      slits.forEach((yc) => { ctx.fillRect(g.xb - 4, yy, 8, yc - g.aV / 2 - yy); yy = yc + g.aV / 2; }); ctx.fillRect(g.xb - 4, yy, 8, g.y1 + 6 - yy);
      ctx.strokeStyle = '#9fb0d9'; ctx.lineWidth = 1; ctx.strokeRect(g.xb - 4, g.y0 - 6, 8, g.Hs + 12);
      // abanico: primeros mínimos (sen θ = λ/a) — solo en una rendija
      const yfan = g.Dv * Math.tan(Math.asin(Math.min(1, 1 / g.aR)));
      if (!k.modo) {
        ctx.setLineDash([6, 5]); ctx.strokeStyle = C.ambar; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(g.xb, g.cyc); ctx.lineTo(g.xs, g.cyc - yfan); ctx.moveTo(g.xb, g.cyc); ctx.lineTo(g.xs, g.cyc + yfan); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = C.ambar; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(g.xb, g.cyc, g.Dv * 0.17, -Math.asin(Math.min(1, 1 / g.aR)), 0); ctx.stroke();
        txt(ctx, 'θ ≈ λ/a = ' + fmt(k.th, 4) + ' rad', g.xb + g.Dv * 0.19, g.cyc - 6 - fs * 0.2, { size: fs, color: C.ambar, w: 700, halo: true });
      }
      // ---- pantalla con el patrón de intensidad
      const I = (y) => { const s_ = (y - g.cyc) / Math.hypot(y - g.cyc, g.Dv); let v = sinc2(Math.PI * g.aR * s_); if (k.modo) { const cc = Math.cos(Math.PI * g.bR * s_); v *= cc * cc; } return v; };
      const cw = Math.max(40, w - 12 - (g.xs + 20)), x0c = g.xs + 18;
      for (let y = g.y0; y <= g.y1; y += 2) { const v = I(y); ctx.fillStyle = rgb(hue, 0.08 + 0.92 * Math.pow(v, 0.65)); ctx.fillRect(g.xs, y, 10, 2.2); }
      ctx.strokeStyle = '#9fb0d9'; ctx.lineWidth = 1.4; ctx.strokeRect(g.xs - 0.5, g.y0 - 0.5, 11, g.Hs + 1);
      ctx.beginPath(); for (let y = g.y0; y <= g.y1; y += 2) { const X = x0c + I(y) * cw; y === g.y0 ? ctx.moveTo(X, y) : ctx.lineTo(X, y); } ctx.strokeStyle = rgb(hue, 1); ctx.lineWidth = 2.4; ctx.stroke();
      ctx.lineTo(x0c, g.y1); ctx.lineTo(x0c, g.y0); ctx.closePath(); ctx.fillStyle = rgb(hue, 0.18); ctx.fill();
      txt(ctx, 'Pantalla', g.xs + 5, g.y0 - 9, { size: fs - 1, color: C.txt2, align: 'center' }); txt(ctx, 'Intensidad', x0c + cw / 2, g.y0 - 9, { size: fs - 1, color: C.txt2, align: 'center' });
      // cotas sobre la pantalla (valores reales)
      if (!k.modo) {
        cota(ctx, g.xs - 10, g.cyc - yfan, g.xs - 10, g.cyc + yfan, null, C.ambar, fs);
        txt(ctx, 'L = 2λD/a', g.xs - 16, g.cyc - 4, { size: fs, color: C.ambar, align: 'right', w: 700, halo: true }); txt(ctx, '= ' + lfmt(k.Lc, 1), g.xs - 16, g.cyc + fs, { size: fs, color: C.ambar, align: 'right', w: 700, halo: true });
      } else {
        const yi = g.Dv * Math.tan(Math.asin(Math.min(1, 1 / g.bR)));
        if (g.cyc - yi > g.y0 + 4) { cota(ctx, g.xs - 10, g.cyc, g.xs - 10, g.cyc - yi, null, C.ambar, fs); txt(ctx, 'i = λD/b', g.xs - 16, g.cyc - yi / 2 - 3, { size: fs, color: C.ambar, align: 'right', w: 700, halo: true }); txt(ctx, '= ' + lfmt(k.i, 1), g.xs - 16, g.cyc - yi / 2 + fs, { size: fs, color: C.ambar, align: 'right', w: 700, halo: true }); }
      }
      txt(ctx, 'onda plana →', g.xb * 0.5, g.y0 - 9, { size: fs - 1, color: C.txt2, align: 'center' });
      btn(S, ctx, { x: 10, y: 6, w: 96, h: 26, label: 'Una rendija', active: !k.modo, on: () => { p.modo = 0; S._vt = 9; vivo(S, DIFR, p, 0); }, size: fs });
      btn(S, ctx, { x: 112, y: 6, w: 104, h: 26, label: 'Dos rendijas', active: !!k.modo, on: () => { p.modo = 1; S._vt = 9; vivo(S, DIFR, p, 0); }, size: fs });
      txt(ctx, 'Esquema no a escala: proporciones exageradas', w - 10, h - 6, { size: fs - 2, color: C.txt2, align: 'right' });
      chip(ctx, 'λ = ' + fmt(k.lam, 0) + ' nm', w - 10, 19, { size: fs, align: 'right', color: rgb(hue), border: rgb(hue, 0.8) });
    },
    formula(p) {
      const k = difCalc(p);
      if (k.modo) return '\\begin{aligned}i&=\\dfrac{\\lambda D}{b}=\\dfrac{' + tx(k.lam, 0) + '\\times10^{-9}\\times' + tx(k.D, 1) + '}{' + tx(k.b, 0) + '\\times10^{-6}}=' + ltex(k.i, 2) + '\\\\[3pt]\\theta&\\approx\\dfrac{\\lambda}{a}=' + tx(k.th, 4) + '\\ \\text{rad}\\end{aligned}';
      return '\\begin{aligned}\\theta&\\approx\\dfrac{\\lambda}{a}=\\dfrac{' + tx(k.lam, 0) + '\\times10^{-9}}{' + tx(k.a, 0) + '\\times10^{-6}}=' + tx(k.th, 4) + '\\ \\text{rad}=' + tx((k.th * 180) / Math.PI, 2) + '^{\\circ}\\\\[3pt]L&=\\dfrac{2\\lambda D}{a}=' + ltex(k.Lc, 1) + '\\end{aligned}';
    },
    lecturas(p) {
      const k = difCalc(p);
      const r = [{ label: 'θ ≈ λ/a', valor: fmt(k.th, 4) + ' rad (' + fmt((k.th * 180) / Math.PI, 2) + '°)' }, { label: 'L = 2λD/a', valor: lfmt(k.Lc, 1) }, { label: 'D', valor: fmt(k.D, 1) + ' m' }];
      if (k.modo) r.push({ label: 'i = λD/b', valor: lfmt(k.i, 2) }, { label: 'b', valor: fmt(k.b, 0) + ' µm' });
      return r;
    },
    dispose(S) { disposeComun(S); },
  };
  PCB.anim.register('difraccion', DIFR);

  // =====================================================================================
  // 6. DOPPLER — f = f₀·v/(v ∓ vs). Fuente móvil a velocidad vs; v = 340 m·s⁻¹ (dato típico del sonido en el aire).
  //    Geometría EXACTA a escala relativa (v y vs en proporción): cada frente es un círculo centrado
  //    en el punto de emisión. Tiempo ralentizado ×200 (f₀ en pantalla = f₀/200). Los dos observadores
  //    CUENTAN los frentes que llegan: la "f medida" sale del intervalo entre llegadas y coincide con la fórmula.
  //    Solo régimen subsónico (vs < v). La fuente recorre la escena y vuelve a empezar.
  // =====================================================================================
  const VSON = 340, SLOW = 200;
  const dopCalc = (p) => {
    const f0 = Math.max(10, num(p.f0, 440)), vs = clamp(num(p.vs, 100), 0, 330);
    return { f0, vs, fF: (f0 * VSON) / (VSON - vs), fB: (f0 * VSON) / (VSON + vs), lF: (VSON - vs) / f0, lB: (VSON + vs) / f0, l0: VSON / f0 };
  };
  const CF = 0.2; // celeridad de las ondas en la pantalla: fracción de la anchura de la escena por segundo
  const DOPPLER = {
    titulo: 'Efecto Doppler', materia: 'physique',
    params: [
      { id: 'f0', label: 'Frecuencia de la fuente f₀', min: 100, max: 1000, step: 10, def: 440, unit: 'Hz' },
      { id: 'vs', label: 'Celeridad de la fuente vₛ', min: 0, max: 250, step: 5, def: 100, unit: 'm/s' }],
    create(host, p) { return { host, t: 0, sx: 0.2, ems: [], eacc: 1e9, last: { A: null, B: null }, meas: { A: 0, B: 0 }, flash: { A: 0, B: 0 } }; },
    onParam(S) { S.last = { A: null, B: null }; S.meas = { A: 0, B: 0 }; },
    step(S, dt, p) {
      const k = dopCalc(p), xo = { A: 0.06, B: 0.94 }; S.t += dt;
      S.sx += (k.vs / VSON) * CF * dt; if (S.sx > 0.72) { S.sx = 0.2; S.ems = []; S.last = { A: null, B: null }; S.eacc = 1e9; }
      S.eacc += dt; const T0 = SLOW / k.f0; while (S.eacc >= T0) { S.eacc -= T0; S.ems.push({ x: S.sx, t: S.t - S.eacc, hit: {} }); }
      for (const e of S.ems) ['A', 'B'].forEach((o) => { if (e.hit[o]) return; const ta = e.t + Math.abs(xo[o] - e.x) / CF; if (S.t >= ta) { e.hit[o] = 1; if (S.last[o] != null && ta > S.last[o]) S.meas[o] = (1 / (ta - S.last[o])) * SLOW; S.last[o] = ta; S.flash[o] = 1; } });
      S.ems = S.ems.filter((e) => (S.t - e.t) * CF < 1.1); S.flash.A *= Math.pow(0.02, dt); S.flash.B *= Math.pow(0.02, dt);
    },
    draw(S, ctx, w, h, p) {
      fondo(ctx, w, h); const k = dopCalc(p), fs = fsz(w), wide = w >= 560;
      const R = wide ? { x: 6, y: 6, w: w * 0.64, h: h - 12 } : { x: 6, y: 4, w: w - 12, h: h * 0.56 };
      const G = wide ? { x: w * 0.64 + 54, y: 34, w: w * 0.36 - 70, h: h - 96 } : { x: 48, y: h * 0.56 + 26, w: w - 66, h: h * 0.44 - 66 };
      const cy = R.y + R.h * (wide ? 0.5 : 0.56), X = (f) => R.x + f * R.w, rad = Math.min(R.h * 0.34, 36);
      ctx.fillStyle = 'rgba(18,26,51,.5)'; rr(ctx, R.x, R.y, R.w, R.h, 12); ctx.fill(); ctx.strokeStyle = 'rgba(42,55,107,.9)'; ctx.stroke();
      ctx.strokeStyle = 'rgba(159,176,217,.2)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(R.x + 6, cy); ctx.lineTo(R.x + R.w - 6, cy); ctx.stroke(); ctx.setLineDash([]);
      // frentes de onda (círculos centrados en el punto de emisión)
      ctx.save(); rr(ctx, R.x, R.y, R.w, R.h, 12); ctx.clip();
      S.ems.forEach((e) => { const r = (S.t - e.t) * CF * R.w, a = clamp(1 - ((S.t - e.t) * CF) / 1.1, 0.05, 1); if (r < 1) return; ctx.strokeStyle = 'rgba(0,212,255,' + (0.85 * a) + ')'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(X(e.x), cy, r, 0, TAU); ctx.stroke(); });
      ctx.restore();
      // cotas de longitud de onda delante y detrás (entre dos frentes consecutivos)
      const ahead = S.ems.map((e) => X(e.x) + (S.t - e.t) * CF * R.w).filter((x) => x > X(S.sx) + 20 && x < R.x + R.w - 14).sort((a, b) => a - b), behind = S.ems.map((e) => X(e.x) - (S.t - e.t) * CF * R.w).filter((x) => x < X(S.sx) - 20 && x > R.x + 14).sort((a, b) => b - a);
      if (ahead.length >= 2) cota(ctx, ahead[0], cy + rad + 14, ahead[1], cy + rad + 14, 'λ′ = ' + lfmt(k.lF), C.magenta, fs, false);
      if (behind.length >= 2) cota(ctx, behind[1], cy + rad + 14, behind[0], cy + rad + 14, 'λ″ = ' + lfmt(k.lB), C.verde, fs, false);
      // fuente móvil
      const sx = X(S.sx), gS = ctx.createRadialGradient(sx, cy, 0, sx, cy, 15); gS.addColorStop(0, '#fff3c4'); gS.addColorStop(1, C.ambar); ctx.fillStyle = gS; ctx.beginPath(); ctx.arc(sx, cy, 10, 0, TAU); ctx.fill();
      if (k.vs > 0) arrow(ctx, sx + 14, cy - 22, sx + 14 + 14 + k.vs * 0.18, cy - 22, C.ambar, 3, 10);
      txt(ctx, 'fuente f₀ = ' + fmt(k.f0, 0) + ' Hz · vₛ = ' + fmt(k.vs, 0) + ' m/s', sx, cy - 34, { size: fs, color: C.ambar, align: 'center', w: 700, halo: true });
      // observadores (A detrás, B delante)
      const obs = (xf, o, col, lab, fth) => { const x = X(xf), fl = S.flash[o]; const y = cy + 2;
        ctx.fillStyle = 'rgba(' + (o === 'A' ? '0,212,255' : '255,61,166') + ',' + (0.12 + 0.4 * fl) + ')'; ctx.beginPath(); ctx.arc(x, y, 20 + 14 * fl, 0, TAU); ctx.fill();
        ctx.fillStyle = '#cfd8ff'; ctx.beginPath(); ctx.arc(x, y - 4, 7, 0, TAU); ctx.fill(); ctx.fillStyle = col; rr(ctx, x - 9, y + 4, 18, 14, 5); ctx.fill();
        const tx_ = clamp(x, R.x + 62, R.x + R.w - 62); txt(ctx, lab, tx_, R.y + R.h - (wide ? 40 : 30), { size: fs, color: col, align: 'center', w: 700, halo: true });
        txt(ctx, 'f = ' + fmt(fth, 0) + ' Hz', tx_, R.y + R.h - (wide ? 24 : 14), { size: fs + 1, color: C.txt, align: 'center', w: 700, halo: true });
        if (S.meas[o] > 0) txt(ctx, 'medida: ' + fmt(S.meas[o], 0) + ' Hz', tx_, R.y + R.h - (wide ? 8 : -2), { size: fs - 1.5, color: C.txt2, align: 'center', halo: true }); };
      obs(0.06, 'A', C.verde, k.vs > 0 ? 'A (detrás): más grave' : 'A', k.fB); obs(0.94, 'B', C.magenta, k.vs > 0 ? 'B (delante): más agudo' : 'B', k.fF);
      chip(ctx, 'v = 340 m/s (sonido en el aire) · tiempo ÷200', R.x + R.w / 2, R.y + 16, { size: fs - 1.5, align: 'center', color: C.txt2, border: C.borde, w: 400 });
      // gráfica f(vs)
      const ymax = 4 * k.f0, ax = ejes(ctx, G, 0, 250, 0, ymax, { xt: [0, 50, 100, 150, 200, 250], fx: (v) => fmt(v, 0), fy: (v) => fmt(v, 0), xl: 'vₛ (m/s)', yl: 'f percibida (Hz)', ny: 4 });
      ctx.save(); ctx.beginPath(); ctx.rect(G.x, G.y, G.w, G.h); ctx.clip();
      ctx.setLineDash([5, 5]); ctx.strokeStyle = C.txt2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(G.x, ax.Y(k.f0)); ctx.lineTo(G.x + G.w, ax.Y(k.f0)); ctx.stroke(); ctx.setLineDash([]);
      [[(v) => (k.f0 * VSON) / (VSON - v), C.magenta], [(v) => (k.f0 * VSON) / (VSON + v), C.verde]].forEach(([fn, col]) => { ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.beginPath(); for (let i = 0; i <= 100; i++) { const v = (250 * i) / 100; i ? ctx.lineTo(ax.X(v), ax.Y(fn(v))) : ctx.moveTo(ax.X(v), ax.Y(fn(v))); } ctx.stroke(); });
      ctx.restore();
      [[k.fF, C.magenta], [k.fB, C.verde]].forEach(([f, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ax.X(k.vs), ax.Y(Math.min(f, ymax)), 5.5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); });
      ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255,209,102,.6)'; ctx.beginPath(); ctx.moveTo(ax.X(k.vs), G.y + G.h); ctx.lineTo(ax.X(k.vs), G.y); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, 'delante: f₀v/(v−vₛ)', G.x + 6, G.y + 14, { size: fs - 1, color: C.magenta, w: 700 }); txt(ctx, 'detrás: f₀v/(v+vₛ)', G.x + G.w - 6, G.y + G.h - 8, { size: fs - 1, color: C.verde, w: 700, align: 'right' });
      txt(ctx, 'f₀', G.x + G.w - 4, ax.Y(k.f0) - 5, { size: fs - 1, color: C.txt2, align: 'right' });
    },
    formula(p) {
      const k = dopCalc(p);
      return '\\begin{aligned}f_{\\text{delante}}&=f_0\\dfrac{v}{v-v_s}=' + tx(k.f0, 0) + '\\cdot\\dfrac{340}{340-' + tx(k.vs, 0) + '}=' + tx(k.fF, 1) + '\\ \\text{Hz}\\\\[3pt]'
        + 'f_{\\text{detrás}}&=f_0\\dfrac{v}{v+v_s}=' + tx(k.f0, 0) + '\\cdot\\dfrac{340}{340+' + tx(k.vs, 0) + '}=' + tx(k.fB, 1) + '\\ \\text{Hz}\\end{aligned}';
    },
    lecturas(p) {
      const k = dopCalc(p);
      return [{ label: 'f delante', valor: fmt(k.fF, 1) + ' Hz' }, { label: 'f detrás', valor: fmt(k.fB, 1) + ' Hz' }, { label: 'f₀', valor: fmt(k.f0, 0) + ' Hz' }, { label: 'v (dato típico)', valor: '340 m·s⁻¹' }, { label: 'Δf delante', valor: sgn(k.fF - k.f0, 1) + ' Hz' }];
    },
  };
  PCB.anim.register('doppler', DOPPLER);

//@@FIN_PARTE_3@@
})();
