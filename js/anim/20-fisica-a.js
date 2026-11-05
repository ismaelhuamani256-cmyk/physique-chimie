// =====================================================================================
// 20-fisica-a.js — presets de animación de FÍSICA (parte A) · ANIM-FIS-A
// Se registran con PCB.anim.register (ver CONTRATO.md §7). Cada preset *muestra* lo que
// dice la fórmula: movimiento, vectores proporcionales y valores en vivo.
//
// CÓDIGO DE COLORES (coherente en todos los presets)
//   fuerzas = rojo #ff4d6d · velocidad = azul #3da5ff · aceleración = verde #2ee59d
//
// PARÁMETROS (id · rango · paso · defecto · unidad).  Los ids canónicos del CONTRATO van
// primero; los marcados "(opc.)" son extras opcionales que los capítulos pueden ignorar.
// -------------------------------------------------------------------------------------
// cinematica        v   0,5 … 20  · 0,5 · 5   m/s      velocidad (inicial si a≠0)
//                   t   1 … 10    · 0,5 · 4   s        duración Δt del recorrido
//                   a   -3 … 3    · 0,1 · 0   m/s²     (opc.) aceleración constante
// newton2           m   0,5 … 10  · 0,1 · 2   kg       masa
//                   F   0 … 30    · 0,5 · 6   N        fuerza aplicada (horizontal)
//                   mu  0 … 0,8   · 0,05· 0            (opc.) coeficiente de rozamiento
// proyectil         v0  2 … 30    · 0,5 · 15  m/s      velocidad inicial
//                   alpha 5 … 85  · 1   · 45  °        ángulo de tiro
//                   g   1,6 … 25  · 0,01· 9,81 m/s²    campo de gravedad uniforme
// carga-campo       E   500 … 30000 · 500 · 5000  V/m  campo eléctrico uniforme (↓)
//                   v0  1e5 … 5e7 · 1e5 · 2e7   m/s    velocidad de entrada (horizontal)
//                   signo -1 | 1  · 2   · -1           (opc.) -1 = electrón, +1 = protón
//                   peso  0 | 1   · 1   · 0            (opc.) 1 = muestra la comparación F/P
// gravitacion       M   1 … 100   · 0,1 · 5,97 ×10²⁴ kg  masa del astro central
//                   r   7 … 100   · 0,1 · 42,2  ×10⁶ m   radio orbital (semieje mayor si e>0)
//                   m   100…5000  · 100 · 1000  kg     (opc.) masa del satélite
//                   e   0 … 0,8   · 0,05· 0            (opc.) excentricidad (0 = círculo)
// energia-mecanica  m   0,2 … 5   · 0,1 · 1   kg       masa de la bola
//                   h   0 … 10    · 0,5 · 5   m        altura inicial sobre el punto más bajo
//                   v   0 … 15    · 0,5 · 0   m/s      velocidad inicial (cuesta abajo)
//                   mu  0 … 0,3   · 0,01· 0            (opc.) rozamiento (disipa energía)
// arquimedes        rho 600 … 1600 · 10 · 1000 kg/m³   masa volúmica del fluido
//                   V   0,0002…0,002 · 0,0001 · 0,001 m³  volumen del cuerpo
//                   rhoc 200 … 8000 · 50 · 2700 kg/m³  (opc.) masa volúmica del cuerpo
//                   inm 0 … 100   · 1   · 100  %        (opc.) inmersión (modo dinamómetro)
// torricelli        h   0,1 … 1,5 · 0,05· 0,8  m       altura de agua sobre el orificio
//                   H0  0,3 … 2   · 0,05· 1   m        (opc.) altura del orificio sobre el suelo
// gas-ideal         n   0,1 … 2   · 0,1 · 1   mol      cantidad de gas
//                   T   100 … 1000 · 10 · 300 K        temperatura
//                   V   1 … 50    · 0,5 · 25  L        volumen (posición del pistón)
//
// SIMPLIFICACIONES DIDÁCTICAS (detalladas en cada preset): sin rozamiento del aire,
// campos uniformes, sin efectos de borde, partículas del gas sin interacción (gas ideal).
// Constantes: g = 9,81 m·s⁻² · G = 6,67×10⁻¹¹ · R = 8,314 J·K⁻¹·mol⁻¹ · e = 1,60×10⁻¹⁹ C
//             m_e = 9,11×10⁻³¹ kg · m_p = 1,67×10⁻²⁷ kg
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB;
  if (!PCB || !PCB.anim) return;

  const TAU = Math.PI * 2;
  const G0 = 9.81; // m·s⁻²

  // ---------- paleta ----------
  const C = {
    fondo: '#0a0f20', texto: '#e6eeff', tenue: '#8ea0cf', rejilla: '#1b2750', borde: '#2a376b',
    fuerza: '#ff4d6d', vel: '#3da5ff', acel: '#2ee59d', acento: '#00d4ff', ambar: '#ffd166',
    naranja: '#ff9f1c', violeta: '#b388ff', agua: '#3aa0ff', suelo: '#243462', panel: '#101a3a',
  };

  // ---------- utilidades numéricas ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const sgn = (v) => (v < 0 ? -1 : 1);

  /** Número con coma decimal (texto plano) */
  function num(v, d = 2) {
    if (!isFinite(v)) return '—';
    if (Math.abs(v) < 0.5 * Math.pow(10, -d)) v = 0;
    return v.toFixed(d).replace('.', ',');
  }
  /** Número con coma para LaTeX: 9{,}81 */
  const tnum = (v, d = 2) => num(v, d).replace(',', '{,}');
  /** Decimales adaptados a la magnitud para ~sig cifras significativas */
  function dec(v, sig = 3) {
    const a = Math.abs(v);
    if (a === 0) return 1;
    return clamp(sig - 1 - Math.floor(Math.log10(a)), 0, 4);
  }
  const numA = (v, sig = 3) => num(v, dec(v, sig));
  const tnumA = (v, sig = 3) => tnum(v, dec(v, sig));
  /** Notación científica: {m:'8,8', e:14} */
  function sci(v, d = 2) {
    if (v === 0) return { m: num(0, d), e: 0 };
    let e = Math.floor(Math.log10(Math.abs(v)));
    let m = v / Math.pow(10, e);
    if (+Math.abs(m).toFixed(d) >= 10) { m /= 10; e++; }
    return { m: num(m, d), e };
  }
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  const sup = (n) => String(n).replace(/[-0-9]/g, (c) => SUP[c]);
  /** 8,8×10¹⁴ (texto plano) */
  const snum = (v, d = 2) => { const s = sci(v, d); return s.e === 0 ? s.m : `${s.m}×10${sup(s.e)}`; };
  /** 8{,}8\times10^{14} (LaTeX) */
  const tsci = (v, d = 2) => { const s = sci(v, d); const m = s.m.replace(',', '{,}'); return s.e === 0 ? m : `${m}\\times10^{${s.e}}`; };

  /** Paso "bonito" (1, 2, 5 × 10ⁿ) para marcas de ejes */
  function pasoNice(span, n = 5) {
    const raw = Math.max(span, 1e-12) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }
  const decPaso = (step) => (step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step) - 1e-9)));

  /** Integración con paso fijo: llama a fn(h) las veces necesarias (acotado) */
  function pasos(s, dt, h, fn) {
    s._acc = (s._acc || 0) + dt;
    let n = 0;
    while (s._acc >= h && n < 40) { fn(h); s._acc -= h; n++; }
    if (n >= 40) s._acc = 0;
  }

  // ---------- dibujo ----------
  const FONT = (px, wt = 600) => `${wt} ${px}px UI, system-ui, sans-serif`;

  function fondo(ctx, w, h) {
    ctx.fillStyle = C.fondo; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h * 0.4, Math.max(w, h) * 0.8);
    g.addColorStop(0, 'rgba(32,52,120,0.30)'); g.addColorStop(1, 'rgba(10,15,32,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  /** Rectángulo redondeado (path) */
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function txt(ctx, s, x, y, o = {}) {
    ctx.font = FONT(o.size || 12, o.weight || 600);
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle';
    if (o.bg) {
      const tw = ctx.measureText(s).width, sz = o.size || 12, pad = 3;
      const x0 = o.align === 'center' ? x - tw / 2 : o.align === 'right' ? x - tw : x;
      ctx.fillStyle = o.bg; rr(ctx, x0 - pad, y - sz * 0.75, tw + pad * 2, sz * 1.5, 4); ctx.fill();
    }
    ctx.fillStyle = o.color || C.texto; ctx.fillText(s, x, y);
  }
  /** Flecha (vector) de (x0,y0) a (x1,y1). o: {lw, head, label, dash, lcolor} */
  function flecha(ctx, x0, y0, x1, y1, color, o = {}) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    if (L < 2) return;
    const lw = o.lw || 3, hl = Math.min(o.head || 11, L * 0.7), ang = Math.atan2(dy, dx), ux = dx / L, uy = dy / L;
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hl * 0.6, y1 - uy * hl * 0.6); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - hl * Math.cos(ang - 0.42), y1 - hl * Math.sin(ang - 0.42));
    ctx.lineTo(x1 - hl * Math.cos(ang + 0.42), y1 - hl * Math.sin(ang + 0.42)); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (o.label) {
      ctx.font = FONT(o.lsize || 12);
      const tw = ctx.measureText(o.label).width;
      txt(ctx, o.label, x1 + ux * (8 + tw / 2 * Math.abs(ux)), y1 + uy * 10 - (Math.abs(uy) < 0.3 ? 9 : 0),
        { align: 'center', color: o.lcolor || color, size: o.lsize || 12, bg: 'rgba(10,15,32,0.65)' });
    }
  }
  /** Rejilla + ejes de una gráfica. R:{x,y,w,h}. Devuelve {X(x), Y(y)} */
  function ejes(ctx, R, x0, x1, y0, y1, o = {}) {
    const X = (v) => R.x + ((v - x0) / (x1 - x0)) * R.w, Y = (v) => R.y + R.h - ((v - y0) / (y1 - y0)) * R.h;
    ctx.fillStyle = 'rgba(13,21,48,0.85)'; ctx.fillRect(R.x, R.y, R.w, R.h);
    const sx = pasoNice(x1 - x0, o.nx || 4), sy = pasoNice(y1 - y0, o.ny || 3);
    const dx = decPaso(sx), dy = decPaso(sy), fs = o.fs || 10;
    ctx.lineWidth = 1;
    for (let v = Math.ceil(x0 / sx - 1e-9) * sx; v <= x1 + 1e-9; v += sx) {
      ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(X(v), R.y); ctx.lineTo(X(v), R.y + R.h); ctx.stroke();
      txt(ctx, num(v, dx), X(v), R.y + R.h + 9, { size: fs, align: 'center', color: C.tenue, weight: 400 });
    }
    for (let v = Math.ceil(y0 / sy - 1e-9) * sy; v <= y1 + 1e-9; v += sy) {
      ctx.strokeStyle = C.rejilla; ctx.beginPath(); ctx.moveTo(R.x, Y(v)); ctx.lineTo(R.x + R.w, Y(v)); ctx.stroke();
      txt(ctx, num(v, dy), R.x - 4, Y(v), { size: fs, align: 'right', color: C.tenue, weight: 400 });
    }
    ctx.strokeStyle = '#3b4a85'; ctx.lineWidth = 1.5;
    if (y0 < 0 && y1 > 0) { ctx.beginPath(); ctx.moveTo(R.x, Y(0)); ctx.lineTo(R.x + R.w, Y(0)); ctx.stroke(); }
    ctx.strokeRect(R.x, R.y, R.w, R.h);
    if (o.titulo) txt(ctx, o.titulo, R.x + 6, R.y + 10, { size: fs + 1, color: o.tcolor || C.texto });
    if (o.xl) txt(ctx, o.xl, R.x + R.w - 4, R.y + R.h - 8, { size: fs, align: 'right', color: C.tenue });
    return { X, Y };
  }

  // ---------- clics sobre el canvas (botones dibujados dentro de la escena) ----------
  function ponerClicks(s, host) {
    s._btns = []; s._el = host && host.host && host.host.addEventListener ? host.host : null;
    s._onClick = (e) => {
      const r = s._el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      for (const b of s._btns) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { b.fn(); break; }
    };
    if (s._el) s._el.addEventListener('click', s._onClick);
  }
  function quitarClicks(s) { if (s._el) s._el.removeEventListener('click', s._onClick); }
  function boton(s, ctx, x, y, w, h, label, fn, activo) {
    s._btns.push({ x, y, w, h, fn });
    ctx.fillStyle = activo ? 'rgba(0,212,255,0.28)' : 'rgba(29,40,80,0.92)'; rr(ctx, x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = activo ? C.acento : C.borde; ctx.lineWidth = 1.2; ctx.stroke();
    txt(ctx, label, x + w / 2, y + h / 2 + 0.5, { align: 'center', size: 12, color: C.texto });
  }

  /** Escala de longitudes de tamaño de pantalla: 1 en 720 px de ancho */
  const kPant = (w, h) => clamp(Math.min(w / 720, h / 405), 0.55, 1.5);

  /** Cada preset llama a esto para registrarse (todos materia: physique) */
  const reg = (id, def) => PCB.anim.register(id, Object.assign({ materia: 'physique' }, def));

  // =====================================================================================
  // 1 · CINEMÁTICA — v = Δx/Δt  (y a = Δv/Δt)
  //   Movimiento rectilíneo uniformemente variado: x = v·τ + ½·a·τ², v(τ) = v + a·τ.
  //   Si a = 0 es un MRU y la velocidad media coincide con v. El carrito recorre Δt (segundos
  //   simulados; el reloj va a un ritmo cómodo de ver), se detiene un instante mostrando Δx y
  //   vuelve a empezar.
  // =====================================================================================
  function carrito(ctx, cx, gy, cw, ch, color, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    const x = cx - cw / 2, rueda = ch * 0.26;
    const g = ctx.createLinearGradient(0, gy - ch, 0, gy);
    g.addColorStop(0, color); g.addColorStop(1, '#14307a');
    ctx.fillStyle = g; rr(ctx, x, gy - ch * 0.95, cw, ch * 0.62, ch * 0.18); ctx.fill();
    rr(ctx, x + cw * 0.22, gy - ch * 1.35, cw * 0.5, ch * 0.5, ch * 0.16); ctx.fill();
    ctx.fillStyle = 'rgba(200,235,255,0.55)'; rr(ctx, x + cw * 0.3, gy - ch * 1.26, cw * 0.34, ch * 0.3, ch * 0.08); ctx.fill();
    ctx.fillStyle = '#0a0f20'; ctx.strokeStyle = '#9fb0d9'; ctx.lineWidth = 1.5;
    [0.25, 0.75].forEach((f) => { ctx.beginPath(); ctx.arc(x + cw * f, gy - rueda, rueda, 0, TAU); ctx.fill(); ctx.stroke(); });
    ctx.restore();
  }

  reg('cinematica', {
    titulo: 'Cinemática: velocidad y aceleración',
    params: [
      { id: 'v', label: 'Velocidad v', min: 0.5, max: 20, step: 0.5, def: 5, unit: 'm/s' },
      { id: 't', label: 'Duración Δt', min: 1, max: 10, step: 0.5, def: 4, unit: 's' },
      { id: 'a', label: 'Aceleración a (opcional)', min: -3, max: 3, step: 0.1, def: 0, unit: 'm/s²' },
    ],
    create(host, p) { const s = { tau: 0, hold: 0, reduced: host.reduced }; return s; },
    onParam(s) { s.tau = 0; s.hold = 0; },
    step(s, dt, p) {
      const T = p.t, dur = clamp(T, 2.5, 6); // segundos reales que dura el recorrido
      if (s.tau < T) { s.tau = Math.min(T, s.tau + dt * T / dur); if (s.tau >= T) s.hold = 0; }
      else { s.hold += dt; if (s.hold > 1.8) { s.tau = 0; s.hold = 0; } }
    },
    draw(s, ctx, w, h, p) {
      fondo(ctx, w, h);
      const k = kPant(w, h), v0 = p.v, T = p.t, a = p.a || 0, tau = s.tau;
      const xf = (u) => v0 * u + 0.5 * a * u * u, vf = (u) => v0 + a * u;
      // --- extremos para escalar ---
      const xs = [0, xf(T)], vs = [v0, vf(T)];
      if (a !== 0) { const u = -v0 / a; if (u > 0 && u < T) xs.push(xf(u)); }
      const xmin = Math.min(...xs), xmax = Math.max(...xs);
      const step = pasoNice(Math.max(xmax - Math.min(0, xmin), 1), 6);
      const lo = Math.floor(Math.min(0, xmin) / step) * step; let hi = Math.ceil(Math.max(0, xmax) / step) * step; if (hi <= lo) hi = lo + step;
      // --- escena (arriba) ---
      const sceneB = h * 0.5, sx0 = w * 0.09, sx1 = w * 0.92;
      const X = (m) => sx0 + ((m - lo) / (hi - lo)) * (sx1 - sx0);
      const rulerY = sceneB - 16 * k, gy = rulerY - 7 * k, cw = clamp(w * 0.085, 40, 90), ch = cw * 0.4;
      // suelo / regla
      ctx.fillStyle = '#16224a'; ctx.fillRect(0, gy, w, h * 0.5 - gy);
      ctx.strokeStyle = '#4b5da3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx0, rulerY); ctx.lineTo(sx1, rulerY); ctx.stroke();
      const dp = decPaso(step);
      for (let m = lo; m <= hi + 1e-9; m += step) {
        ctx.beginPath(); ctx.moveTo(X(m), rulerY - 5); ctx.lineTo(X(m), rulerY + 5); ctx.stroke();
        txt(ctx, num(m, dp), X(m), rulerY + 14 * k, { size: 10 * k + 1, align: 'center', color: C.tenue, weight: 400 });
      }
      txt(ctx, 'x (m)', sx1 + 2, rulerY + 14 * k, { size: 10 * k + 1, color: C.tenue, align: 'right', base: 'middle' });
      // fotografía estroboscópica: siluetas cada dtG
      const dtG = T <= 2 ? 0.25 : T <= 5 ? 0.5 : 1;
      for (let u = 0; u <= tau + 1e-9; u += dtG) {
        const px = X(xf(u));
        if (u < tau - 1e-9 || s.tau >= T) {
          carrito(ctx, px, gy, cw, ch, '#3da5ff', 0.16);
          ctx.fillStyle = C.ambar; ctx.beginPath(); ctx.arc(px, rulerY, 3.2, 0, TAU); ctx.fill();
        }
      }
      // carrito actual
      const cx = X(xf(tau));
      carrito(ctx, cx, gy, cw, ch, '#3da5ff', 1);
      ctx.fillStyle = C.ambar; ctx.beginPath(); ctx.moveTo(cx, rulerY - 2); ctx.lineTo(cx - 5, rulerY - 11); ctx.lineTo(cx + 5, rulerY - 11); ctx.closePath(); ctx.fill();
      // vectores v (azul) y a (verde), escala común para v dentro de la pantalla
      const vmax = Math.max(1, ...vs.map(Math.abs));
      const vy = gy - ch * 1.35 - 14 * k, kv = (w * 0.2) / vmax;
      flecha(ctx, cx, vy, cx + vf(tau) * kv, vy, C.vel, { lw: 3.5 * k, label: `v = ${num(vf(tau), 1)} m/s`, lsize: 11 * k + 1 });
      if (Math.abs(a) > 0.01) {
        const ay = vy - 20 * k;
        flecha(ctx, cx, ay, cx + a * w * 0.045, ay, C.acel, { lw: 3.5 * k, label: `a = ${num(a, 1)} m/s²`, lsize: 11 * k + 1 });
      }
      // cronómetro
      const cwid = 98 * k, cxx = 10, cyy = 10;
      ctx.fillStyle = 'rgba(16,26,58,0.9)'; rr(ctx, cxx, cyy, cwid, 28 * k, 8); ctx.fill(); ctx.strokeStyle = C.borde; ctx.lineWidth = 1; ctx.stroke();
      txt(ctx, '⏱ ' + num(tau, 2) + ' s', cxx + cwid / 2, cyy + 14 * k, { align: 'center', size: 14 * k, color: C.ambar });
      // cota Δx al terminar
      if (tau >= T) {
        const xa = X(0), xb = X(xf(T)), yb = rulerY - ch * 0.5;
        ctx.strokeStyle = C.ambar; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(xa, yb); ctx.lineTo(xb, yb); ctx.stroke(); ctx.setLineDash([]);
        txt(ctx, `Δx = ${num(xf(T), 1)} m`, (xa + xb) / 2, yb - 11, { align: 'center', size: 12 * k + 1, color: C.ambar, bg: 'rgba(10,15,32,.7)' });
      }

      // --- gráficas (abajo) ---
      const gTop = h * 0.56, gH = h - gTop - 22 * k, estrecho = w < 520 && Math.abs(a) < 0.01;
      const gW = estrecho ? w - 58 : (w - 100) / 2;
      const R1 = { x: 42, y: gTop, w: gW, h: gH };
      const xr = [Math.min(0, xmin) - 0.05 * Math.abs(xmax - Math.min(0, xmin)), Math.max(0, xmax) + 0.08 * Math.abs(xmax - Math.min(0, xmin))];
      if (xr[1] - xr[0] < 1e-6) xr[1] = xr[0] + 1;
      const g1 = ejes(ctx, R1, 0, T, xr[0], xr[1], { titulo: 'x(t)', xl: 't (s)', fs: 10 * k + 1, nx: gW > 250 ? 5 : 3, ny: 3 });
      // curva teórica tenue + trazo en vivo
      const trazo = (hasta, col, lw) => {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
        for (let i = 0; i <= 60; i++) { const u = (hasta * i) / 60; (i ? ctx.lineTo : ctx.moveTo).call(ctx, g1.X(u), g1.Y(xf(u))); }
        ctx.stroke();
      };
      ctx.setLineDash([3, 4]); trazo(T, 'rgba(61,165,255,.35)', 1.5); ctx.setLineDash([]);
      trazo(tau, C.vel, 3 * k);
      const px = g1.X(tau), py = g1.Y(xf(tau));
      ctx.fillStyle = C.ambar; ctx.beginPath(); ctx.arc(px, py, 5, 0, TAU); ctx.fill();
      if (tau >= T) { // triángulo de pendiente: Δx / Δt
        const y0 = g1.Y(0);
        ctx.strokeStyle = C.ambar; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(g1.X(0), y0); ctx.lineTo(px, y0); ctx.lineTo(px, py); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(g1.X(0), y0); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);
        txt(ctx, `Δt = ${num(T, 1)} s`, (g1.X(0) + px) / 2, y0 - 9, { align: 'center', size: 11 * k, color: C.ambar });
        txt(ctx, `Δx = ${num(xf(T), 1)} m`, px - 5, (y0 + py) / 2, { align: 'right', size: 11 * k, color: C.ambar });
        txt(ctx, `pendiente = ${num(xf(T) / T, 2)} m/s`, g1.X(T * 0.05), g1.Y(xr[1]) + 26 * k, { size: 11 * k, color: C.vel });
      }
      // v(t)
      if (!estrecho) {
        const vmn = Math.min(0, ...vs), vmx = Math.max(0, ...vs), pad = (vmx - vmn) * 0.1 || 1;
        const R2 = { x: R1.x + gW + 48, y: gTop, w: gW, h: gH };
        const g2 = ejes(ctx, R2, 0, T, vmn - (vmn < 0 ? pad : 0), vmx + pad, { titulo: 'v(t)', xl: 't (s)', fs: 10 * k + 1, nx: gW > 250 ? 5 : 3, ny: 3, tcolor: C.vel });
        // área bajo la curva = Δx
        ctx.fillStyle = 'rgba(61,165,255,.22)'; ctx.beginPath(); ctx.moveTo(g2.X(0), g2.Y(0));
        for (let i = 0; i <= 40; i++) { const u = (tau * i) / 40; ctx.lineTo(g2.X(u), g2.Y(vf(u))); }
        ctx.lineTo(g2.X(tau), g2.Y(0)); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = C.vel; ctx.lineWidth = 3 * k; ctx.beginPath();
        for (let i = 0; i <= 40; i++) { const u = (tau * i) / 40; (i ? ctx.lineTo : ctx.moveTo).call(ctx, g2.X(u), g2.Y(vf(u))); }
        ctx.stroke();
        ctx.fillStyle = C.ambar; ctx.beginPath(); ctx.arc(g2.X(tau), g2.Y(vf(tau)), 5, 0, TAU); ctx.fill();
        txt(ctx, 'aire = Δx', R2.x + R2.w * 0.5, g2.Y(0) - 8, { align: 'center', size: 11 * k, color: '#8fcaff' });
      }
    },
    formula(p) {
      const a = p.a || 0, dx = p.v * p.t + 0.5 * a * p.t * p.t;
      if (Math.abs(a) < 0.005)
        return `v=\\dfrac{\\Delta x}{\\Delta t}=\\dfrac{${tnum(dx, 1)}\\ \\text{m}}{${tnum(p.t, 1)}\\ \\text{s}}=${tnum(p.v, 1)}\\ \\text{m·s}^{-1}`;
      const vf = p.v + a * p.t;
      return `\\bar v=\\dfrac{\\Delta x}{\\Delta t}=\\dfrac{${tnum(dx, 1)}}{${tnum(p.t, 1)}}=${tnum(dx / p.t, 2)}\\ \\text{m·s}^{-1}\\qquad a=\\dfrac{\\Delta v}{\\Delta t}=\\dfrac{${tnum(vf, 1)}-${tnum(p.v, 1)}}{${tnum(p.t, 1)}}=${tnum(a, 1)}\\ \\text{m·s}^{-2}`;
    },
    lecturas(p) {
      const a = p.a || 0, dx = p.v * p.t + 0.5 * a * p.t * p.t, out = [
        { label: 'Δx', valor: `${num(dx, 1)} m` }, { label: 'Δt', valor: `${num(p.t, 1)} s` },
        { label: Math.abs(a) < 0.005 ? 'v' : 'v moy', valor: `${num(dx / p.t, 2)} m·s⁻¹` }];
      if (Math.abs(a) >= 0.005) out.push({ label: 'v final', valor: `${num(p.v + a * p.t, 1)} m·s⁻¹` }, { label: 'a', valor: `${num(a, 1)} m·s⁻²` });
      return out;
    },
    dispose() {},
  });

  // =====================================================================================
  // 2 · NEWTON 2 — ΣF = m·a
  //   Bloque sobre un plano horizontal. Fuerzas: peso P = m·g, normal N = P, fuerza aplicada F
  //   y rozamiento f = μ·N (modelo de Coulomb: μ estático = μ cinético, didáctico).
  //   Si F ≤ μ·m·g el bloque no se mueve (rozamiento estático f = F). Si no, ΣF = F − μ·m·g.
  //   Las flechas de fuerza comparten escala (longitud ∝ módulo). El vector a tiene escala propia.
  //   Cronofotografía: una silueta cada 0,5 s; si a ≠ 0 la separación crece (movimiento acelerado).
  // =====================================================================================
  const NW_RUN = 3; // segundos simulados por ensayo
  function newtonFisica(p) {
    const P = p.m * G0, mu = p.mu || 0, fmax = mu * P;
    const mueve = p.F > fmax + 1e-9;
    const f = mueve ? fmax : Math.min(p.F, fmax); // rozamiento (estático = F cuando no se mueve)
    const sumF = p.F - f, a = sumF / p.m;
    return { P, N: P, f, sumF, a, mueve, fmax };
  }
  reg('newton2', {
    titulo: 'Segunda ley de Newton: ΣF = m·a',
    params: [
      { id: 'm', label: 'Masa m', min: 0.5, max: 10, step: 0.1, def: 2, unit: 'kg' },
      { id: 'F', label: 'Fuerza aplicada F', min: 0, max: 30, step: 0.5, def: 6, unit: 'N' },
      { id: 'mu', label: 'Rozamiento μ (opcional)', min: 0, max: 0.8, step: 0.05, def: 0, unit: '' },
    ],
    create(host, p) { return { t: 0, x: 0, v: 0, hold: 0, ghosts: [], reduced: host.reduced, acc: 0, gk: 1 }; },
    onParam(s) { s.t = 0; s.x = 0; s.v = 0; s.hold = 0; s.ghosts = []; s.gk = 1; },
    step(s, dt, p) {
      const ph = newtonFisica(p);
      if (s.t >= NW_RUN) { s.hold += dt; if (s.hold > 1.3) { s.t = 0; s.x = 0; s.v = 0; s.hold = 0; s.ghosts = []; s.gk = 1; } return; }
      pasos(s, dt, 1 / 240, (h) => {
        if (s.t >= NW_RUN) return;
        s.v += ph.a * h; s.x += s.v * h; s.t += h;       // Euler semi-implícito
        if (s.t >= s.gk * 0.5 - 1e-9) { s.ghosts.push({ x: s.x, t: s.gk * 0.5 }); s.gk++; }
      });
      if (s.t > NW_RUN) s.t = NW_RUN;
    },
    draw(s, ctx, w, h, p) {
      fondo(ctx, w, h);
      const k = kPant(w, h), ph = newtonFisica(p);
      const floorY = h * 0.62, rulerY = floorY + 16 * k;
      // escala de distancias: que el recorrido a los 3 s ocupe ~70 % del ancho
      const dEnd = Math.max(0.5 * ph.a * NW_RUN * NW_RUN, 0.4), x0 = w * 0.11;
      const sc = (w * 0.7) / dEnd;
      // bloque (el tamaño crece con la masa, solo visual)
      const tam = 0.7 + 0.3 * Math.cbrt(p.m / 2), bw = clamp(w * 0.1, 40, 84) * tam, bh = bw * 0.78;
      const bx = x0 + s.x * sc, cy = floorY - bh / 2;
      // suelo con rayado
      ctx.fillStyle = '#16224a'; ctx.fillRect(0, floorY, w, h - floorY);
      ctx.strokeStyle = (p.mu || 0) > 0 ? '#7a8dd6' : '#4b5da3'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(w, floorY); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,140,220,0.18)'; ctx.lineWidth = 1;
      for (let i = -h; i < w; i += 14) { ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + 16, floorY + 3); ctx.stroke(); }
      // regla de distancias
      const step = pasoNice(dEnd * 1.3, 6), dp = decPaso(step);
      ctx.strokeStyle = '#6a7cc0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, rulerY); ctx.lineTo(w, rulerY); ctx.stroke();
      for (let m = 0; x0 + m * sc < w - 10; m += step) {
        ctx.beginPath(); ctx.moveTo(x0 + m * sc, rulerY - 4); ctx.lineTo(x0 + m * sc, rulerY + 4); ctx.stroke();
        txt(ctx, num(m, dp), x0 + m * sc, rulerY + 14 * k, { size: 10 * k + 1, align: 'center', color: C.tenue, weight: 400 });
      }
      txt(ctx, 'x (m)', w - 6, rulerY + 14 * k + 12 * k, { align: 'right', size: 10 * k + 1, color: C.tenue, weight: 400 });
      // cronofotografía
      s.ghosts.forEach((g) => {
        const gx = x0 + g.x * sc;
        ctx.strokeStyle = 'rgba(160,180,255,0.35)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2;
        rr(ctx, gx - bw / 2, floorY - bh, bw, bh, 6); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.ambar; ctx.beginPath(); ctx.arc(gx, rulerY, 2.8, 0, TAU); ctx.fill();
      });
      // bloque
      const gr = ctx.createLinearGradient(0, floorY - bh, 0, floorY);
      gr.addColorStop(0, '#5b7cff'); gr.addColorStop(1, '#2748b8');
      ctx.fillStyle = gr; rr(ctx, bx - bw / 2, floorY - bh, bw, bh, 7); ctx.fill();
      ctx.strokeStyle = '#a9bcff'; ctx.lineWidth = 1.5; ctx.stroke();
      txt(ctx, `m = ${num(p.m, 1)} kg`, bx, cy - 0.5, { align: 'center', size: clamp(bw * 0.17, 10, 14), color: '#fff' });
      // fuerzas (misma escala)
      const Lmax = Math.min(0.3 * w, 0.27 * h), fm = Math.max(ph.P, p.F, ph.f, 1e-6), kF = Lmax / fm;
      const lab = (n, v) => `${n} = ${numA(v, 3)} N`;
      flecha(ctx, bx, cy, bx, cy + ph.P * kF, C.fuerza, { lw: 3.5 * k, label: lab('P', ph.P), lsize: 11 * k + 1 });
      flecha(ctx, bx, cy, bx, cy - ph.N * kF, C.fuerza, { lw: 3.5 * k, label: lab('N', ph.N), lsize: 11 * k + 1 });
      if (p.F > 0.01) flecha(ctx, bx + bw * 0.5, cy, bx + bw * 0.5 + p.F * kF, cy, C.fuerza, { lw: 3.5 * k, label: lab('F', p.F), lsize: 11 * k + 1 });
      if (ph.f > 0.01) flecha(ctx, bx - bw * 0.5, cy + bh * 0.28, bx - bw * 0.5 - ph.f * kF, cy + bh * 0.28, C.fuerza, { lw: 3.5 * k, label: lab('f', ph.f), lsize: 11 * k + 1 });
      // resultante y aceleración (banda superior)
      const yS = h * 0.1 + 8, yA = yS + h * 0.1 + 6, xS = Math.max(bx - bw / 2, 10);
      txt(ctx, 'ΣF', xS - 6, yS, { align: 'right', size: 12 * k + 1, color: C.fuerza });
      txt(ctx, 'a', xS - 6, yA, { align: 'right', size: 12 * k + 1, color: C.acel });
      if (ph.sumF > 0.01) {
        flecha(ctx, xS, yS, xS + ph.sumF * kF, yS, C.fuerza, { lw: 5 * k, head: 13, label: lab('ΣF', ph.sumF), lsize: 11 * k + 1 });
        flecha(ctx, xS, yA, xS + clamp(ph.a * w * 0.03, 6, w * 0.4), yA, C.acel, { lw: 5 * k, head: 13, label: `a = ${numA(ph.a, 3)} m/s²`, lsize: 11 * k + 1 });
      } else {
        txt(ctx, 'ΣF = 0  →  a = 0', xS, (yS + yA) / 2, { size: 12 * k + 1, color: C.tenue });
      }
      if (!ph.mueve && (p.mu || 0) > 0 && p.F > 0.01)
        txt(ctx, `reposo: F ≤ μ·m·g = ${numA(ph.fmax, 3)} N`, w - 10, 16, { align: 'right', size: 12 * k, color: C.ambar });
      // cronómetro
      txt(ctx, `⏱ ${num(s.t, 1)} s   v = ${num(s.v, 1)} m/s`, 12, h - 12, { size: 12 * k + 1, color: C.ambar });
    },
    formula(p) {
      const ph = newtonFisica(p);
      if ((p.mu || 0) > 0.005) {
        if (!ph.mueve) return `F\\le\\mu m g=${tnumA(ph.fmax)}\\ \\text{N}\\;\\Rightarrow\\;\\sum F=0\\;\\Rightarrow\\;a=0`;
        return `a=\\dfrac{F-\\mu m g}{m}=\\dfrac{${tnum(p.F, 1)}-${tnum(p.mu, 2)}\\times${tnum(p.m, 1)}\\times9{,}81}{${tnum(p.m, 1)}}=${tnumA(ph.a)}\\ \\text{m·s}^{-2}`;
      }
      return `\\sum F=ma\\;\\Rightarrow\\;a=\\dfrac{\\sum F}{m}=\\dfrac{${tnum(p.F, 1)}\\ \\text{N}}{${tnum(p.m, 1)}\\ \\text{kg}}=${tnumA(ph.a)}\\ \\text{m·s}^{-2}`;
    },
    lecturas(p) {
      const ph = newtonFisica(p), o = [
        { label: 'P = m·g', valor: `${numA(ph.P)} N` }, { label: 'ΣF', valor: `${numA(ph.sumF)} N` }, { label: 'a', valor: `${numA(ph.a)} m·s⁻²` }];
      if (ph.f > 0.005) o.splice(1, 0, { label: 'f', valor: `${numA(ph.f)} N` });
      return o;
    },
  });

  // =====================================================================================
  // 3 · PROYECTIL — tiro oblicuo en campo uniforme
  //   x = v0·cosα·t,  y = v0·sinα·t − ½·g·t²  (sin rozamiento del aire; suelo horizontal, y0 = 0)
  //   Altura máx.  H = v0²·sin²α / (2g)   · Tiempo de vuelo  T = 2·v0·sinα / g
  //   Alcance      R = v0²·sin(2α) / g
  //   La trayectoria se resuelve con la solución analítica (exacta); el tiempo simulado se
  //   reescala para que el vuelo dure entre 2 y 5 s en pantalla. Clic en «Lanzar» relanza.
  // =====================================================================================
  function proyFisica(p) {
    const a = (p.alpha * Math.PI) / 180, vx = p.v0 * Math.cos(a), vy = p.v0 * Math.sin(a), g = p.g;
    return { a, vx, vy0: vy, T: (2 * vy) / g, H: (vy * vy) / (2 * g), R: (p.v0 * p.v0 * Math.sin(2 * a)) / g };
  }
  reg('proyectil', {
    titulo: 'Proyectil: tiro oblicuo',
    params: [
      { id: 'v0', label: 'Velocidad inicial v₀', min: 2, max: 30, step: 0.5, def: 15, unit: 'm/s' },
      { id: 'alpha', label: 'Ángulo α', min: 5, max: 85, step: 1, def: 45, unit: '°' },
      { id: 'g', label: 'Gravedad g', min: 1.6, max: 25, step: 0.01, def: 9.81, unit: 'm/s²' },
    ],
    create(host, p) {
      const s = { t: 0, hold: 0, esc: 0, reduced: host.reduced, splash: 0 };
      ponerClicks(s, host);
      s.lanzar = () => { s.t = 0; s.hold = 0; s.splash = 0; };
      return s;
    },
    onParam(s) { s.lanzar(); },
    dispose(s) { quitarClicks(s); },
    step(s, dt, p) {
      const f = proyFisica(p);
      if (s.t < f.T) { s.t = Math.min(f.T, s.t + dt * f.T / clamp(f.T, 2.2, 5)); if (s.t >= f.T) { s.hold = 0; s.splash = 1; } }
      else { s.hold += dt; s.splash = Math.max(0, s.splash - dt * 1.2); if (s.hold > 1.8) s.lanzar(); }
    },
    draw(s, ctx, w, h, p) {
      fondo(ctx, w, h); s._btns.length = 0;
      const k = kPant(w, h), f = proyFisica(p), g = p.g;
      const x0 = w * 0.07, gy = h * 0.8;
      // escala (px por metro), suavizada: igual en x e y para respetar el ángulo
      const objetivo = Math.min((w * 0.9 - x0) / Math.max(f.R, 2), (gy - h * 0.2) / Math.max(f.H, 1));
      s.esc = s.esc ? lerp(s.esc, objetivo, 0.12) : objetivo;
      const E = s.esc, X = (m) => x0 + m * E, Y = (m) => gy - m * E;
      // suelo y regla
      ctx.fillStyle = '#16224a'; ctx.fillRect(0, gy, w, h - gy);
      ctx.strokeStyle = '#5a6cb0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      const step = pasoNice((w - x0) / E, 8), dp = decPaso(step);
      ctx.lineWidth = 1.2;
      for (let m = 0; X(m) < w - 8; m += step) {
        ctx.beginPath(); ctx.moveTo(X(m), gy); ctx.lineTo(X(m), gy + 5); ctx.stroke();
        txt(ctx, num(m, dp), X(m), gy + 14 * k, { size: 10 * k + 1, align: 'center', color: C.tenue, weight: 400 });
      }
      txt(ctx, 'x (m)', w - 6, gy + 28 * k, { size: 10 * k + 1, align: 'right', color: C.tenue, weight: 400 });
      // parábola teórica (tenue) y estroboscopia
      ctx.strokeStyle = 'rgba(160,190,255,.28)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= 80; i++) { const t = (f.T * i) / 80; (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(f.vx * t), Y(f.vy0 * t - 0.5 * g * t * t)); }
      ctx.stroke(); ctx.setLineDash([]);
      const dtS = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2].find((d) => f.T / d <= 16) || 2;
      for (let t = 0; t <= s.t + 1e-9; t += dtS) {
        ctx.fillStyle = 'rgba(255,209,102,.8)'; ctx.beginPath(); ctx.arc(X(f.vx * t), Y(f.vy0 * t - 0.5 * g * t * t), 3 * k + 0.8, 0, TAU); ctx.fill();
      }
      // cañón (el origen de coordenadas es el cubo; la bala sale deslizando por el tubo)
      const bl = 30 * k, bwid = 12 * k;
      ctx.save(); ctx.translate(x0, gy); ctx.rotate(-f.a);
      const gb = ctx.createLinearGradient(0, -bwid / 2, 0, bwid / 2); gb.addColorStop(0, '#7f93d6'); gb.addColorStop(1, '#3a4a8a');
      ctx.fillStyle = gb; rr(ctx, -4, -bwid / 2, bl, bwid, 3); ctx.fill(); ctx.strokeStyle = '#b9c7ff'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#26356b'; ctx.beginPath(); ctx.arc(x0, gy, 9 * k, Math.PI, 0); ctx.fill(); ctx.strokeStyle = '#9fb0d9'; ctx.stroke();
      // cotas: altura máxima y alcance
      const tA = f.T / 2;
      if (s.t >= tA - 1e-9) {
        const xa = X(f.vx * tA);
        ctx.strokeStyle = C.ambar; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(xa, Y(f.H)); ctx.lineTo(xa, gy); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.ambar; ctx.beginPath(); ctx.arc(xa, Y(f.H), 4.5, 0, TAU); ctx.fill();
        txt(ctx, `H = ${numA(f.H)} m`, xa + 7, (Y(f.H) + gy) / 2, { size: 12 * k, color: C.ambar, bg: 'rgba(10,15,32,.7)' });
      }
      if (s.t >= f.T - 1e-9) {
        const yc = gy + 40 * k;
        if (yc < h - 8) {
          ctx.strokeStyle = C.ambar; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(X(0), yc); ctx.lineTo(X(f.R), yc);
          ctx.moveTo(X(0), yc - 4); ctx.lineTo(X(0), yc + 4); ctx.moveTo(X(f.R), yc - 4); ctx.lineTo(X(f.R), yc + 4); ctx.stroke();
          txt(ctx, `R = ${numA(f.R)} m`, (X(0) + X(f.R)) / 2, yc - 9, { align: 'center', size: 12 * k, color: C.ambar });
        }
        const sp = s.splash; if (!s.reduced && sp > 0) {
          ctx.strokeStyle = `rgba(255,209,102,${sp})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(X(f.R), gy, 8 + (1 - sp) * 34, 3 + (1 - sp) * 9, 0, 0, TAU); ctx.stroke();
        }
        ctx.strokeStyle = C.ambar; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(f.R) - 6, gy - 6); ctx.lineTo(X(f.R) + 6, gy + 6); ctx.moveTo(X(f.R) + 6, gy - 6); ctx.lineTo(X(f.R) - 6, gy + 6); ctx.stroke();
      }
      // proyectil y vectores en el punto actual
      const t = s.t, bxm = f.vx * t, bym = Math.max(0, f.vy0 * t - 0.5 * g * t * t), vyn = f.vy0 - g * t;
      const bx = X(bxm), by = Y(bym);
      const kv = (0.17 * Math.min(w, h * 1.7)) / p.v0, vcol = '#7cc4ff';
      flecha(ctx, bx, by, bx + f.vx * kv, by, vcol, { lw: 2.4 * k, head: 8, label: 'vx', lsize: 11 * k + 1, lcolor: vcol });
      flecha(ctx, bx, by, bx, by - vyn * kv, vcol, { lw: 2.4 * k, head: 8, label: 'vy', lsize: 11 * k + 1, lcolor: vcol });
      flecha(ctx, bx, by, bx + f.vx * kv, by - vyn * kv, C.vel, { lw: 3.6 * k, head: 11, label: 'v', lsize: 12 * k + 1 });
      flecha(ctx, bx, by, bx, by + clamp((g / 9.81) * 0.1 * Math.min(w, h * 1.7), 14, 0.3 * h), C.acel, { lw: 3.2 * k, head: 10, label: 'g', lsize: 12 * k + 1 });
      const gb2 = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, 8 * k + 2); gb2.addColorStop(0, '#fff6c9'); gb2.addColorStop(1, '#ff9f1c');
      ctx.fillStyle = gb2; ctx.beginPath(); ctx.arc(bx, by, 6.5 * k + 1, 0, TAU); ctx.fill();
      // HUD
      const hx = w - 10, v = Math.hypot(f.vx, vyn);
      txt(ctx, `t = ${num(t, 2)} s  /  T = ${num(f.T, 2)} s`, hx, 14, { align: 'right', size: 12 * k, color: C.ambar });
      txt(ctx, `v = ${num(v, 1)} m/s`, hx, 14 + 17 * k, { align: 'right', size: 12 * k, color: C.vel });
      txt(ctx, `vx = ${num(f.vx, 1)}  vy = ${num(vyn, 1)} m/s`, hx, 14 + 34 * k, { align: 'right', size: 11 * k + 0.5, color: vcol, weight: 400 });
      boton(s, ctx, 10, h - 34, 92, 26, '🚀 Lanzar', s.lanzar, false);
    },
    formula(p) {
      const f = proyFisica(p);
      return `R=\\dfrac{v_0^{2}\\sin(2\\alpha)}{g}=\\dfrac{${tnum(p.v0, 1)}^{2}\\sin(2\\times${tnum(p.alpha, 0)}^{\\circ})}{${tnum(p.g, 2)}}=${tnumA(f.R)}\\ \\text{m}`;
    },
    lecturas(p) {
      const f = proyFisica(p);
      return [{ label: 'R (alcance)', valor: `${numA(f.R)} m` }, { label: 'H (altura máx.)', valor: `${numA(f.H)} m` },
        { label: 'T (vuelo)', valor: `${num(f.T, 2)} s` }, { label: 'vx', valor: `${num(f.vx, 1)} m·s⁻¹` }, { label: 'vy0', valor: `${num(f.vy0, 1)} m·s⁻¹` }];
    },
  });
})();
