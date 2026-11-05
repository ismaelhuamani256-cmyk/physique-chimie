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
// gravitacion       M   1 … 100   · 0,01· 5,97 ×10²⁴ kg  masa del astro central
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
//                   V   5 … 50    · 0,5 · 25  L        volumen (posición del pistón)
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
  // Unidades en LaTeX (¡no usar «·» dentro de \text{}: KaTeX falla!)
  const U_MS = '\\text{m}\\cdot\\text{s}^{-1}', U_MS2 = '\\text{m}\\cdot\\text{s}^{-2}';

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
    o = Object.assign({}, o, { size: Math.max(o.size || 12, 10) }); // nunca por debajo de 10 px (móvil)
    ctx.font = FONT(o.size, o.weight || 600);
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
    if (o.label && o.lmid) {
      txt(ctx, o.label, (x0 + x1) / 2, (y0 + y1) / 2 - 12, { align: 'center', color: o.lcolor || color, size: o.lsize || 12, bg: 'rgba(10,15,32,0.65)' });
    } else if (o.label) {
      ctx.font = FONT(o.lsize || 12);
      const tw = ctx.measureText(o.label).width;
      // lside = ±1: etiqueta a la izquierda/derecha de la punta (para flechas verticales juntas)
      const lx = o.lside ? x1 + o.lside * (tw / 2 + 8) : x1 + ux * (8 + tw / 2 * Math.abs(ux));
      const ly = o.lside ? y1 + uy * 4 : y1 + uy * 10 - (Math.abs(uy) < 0.3 ? 9 : 0);
      txt(ctx, o.label, lx, ly,
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
  const kPant = (w, h) => clamp(Math.min(w / 720, h / 405), 0.7, 1.5);

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
      const sceneB = h * 0.46, sx0 = w * 0.09, sx1 = w * 0.92;
      const X = (m) => sx0 + ((m - lo) / (hi - lo)) * (sx1 - sx0);
      const rulerY = sceneB - 16 * k, gy = rulerY - 7 * k, cw = clamp(w * 0.1, 44, 100), ch = cw * 0.4;
      // suelo / regla
      ctx.fillStyle = '#16224a'; ctx.fillRect(0, gy, w, sceneB - gy + 4);
      ctx.strokeStyle = '#4b5da3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx0, rulerY); ctx.lineTo(sx1, rulerY); ctx.stroke();
      const dp = decPaso(step);
      for (let m = lo; m <= hi + 1e-9; m += step) {
        ctx.beginPath(); ctx.moveTo(X(m), rulerY - 5); ctx.lineTo(X(m), rulerY + 5); ctx.stroke();
        txt(ctx, num(m, dp), X(m), rulerY + 14 * k, { size: 10 * k + 1, align: 'center', color: C.tenue, weight: 400 });
      }
      txt(ctx, 'x (m)', 8, rulerY, { size: 10 * k + 1, color: C.tenue, weight: 400 });
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
      flecha(ctx, cx, vy, cx + vf(tau) * kv, vy, C.vel, { lw: 3.5 * k, label: `v = ${num(vf(tau), 1)} m/s`, lsize: 11 * k + 1, lmid: true });
      if (Math.abs(a) > 0.01) {
        const ay = vy - 20 * k;
        flecha(ctx, cx, ay, cx + a * w * 0.045, ay, C.acel, { lw: 3.5 * k, label: `a = ${num(a, 1)} m/s²`, lsize: 11 * k + 1, lmid: true });
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
      const gTop = h * 0.54, gH = h - gTop - 22 * k, estrecho = w < 520 && Math.abs(a) < 0.01;
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
        return `v=\\dfrac{\\Delta x}{\\Delta t}=\\dfrac{${tnum(dx, 1)}\\ \\text{m}}{${tnum(p.t, 1)}\\ \\text{s}}=${tnum(p.v, 1)}\\ ${U_MS}`;
      const vf = p.v + a * p.t;
      return `\\bar v=\\dfrac{\\Delta x}{\\Delta t}=\\dfrac{${tnum(dx, 1)}}{${tnum(p.t, 1)}}=${tnum(dx / p.t, 2)}\\ ${U_MS}\\qquad a=\\dfrac{\\Delta v}{\\Delta t}=\\dfrac{${tnum(vf, 1)}-${tnum(p.v, 1)}}{${tnum(p.t, 1)}}=${tnum(a, 1)}\\ ${U_MS2}`;
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
      const floorY = h * 0.66, rulerY = floorY + 16 * k;
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
      const Lmax = Math.min(0.3 * w, 0.22 * h), fm = Math.max(ph.P, p.F, ph.f, 1e-6), kF = Lmax / fm;
      const lab = (n, v) => `${n} = ${numA(v, 3)} N`;
      flecha(ctx, bx, cy, bx, cy + ph.P * kF, C.fuerza, { lw: 3.5 * k, label: lab('P', ph.P), lsize: 11 * k + 1 });
      flecha(ctx, bx, cy, bx, cy - ph.N * kF, C.fuerza, { lw: 3.5 * k, label: lab('N', ph.N), lsize: 11 * k + 1 });
      if (p.F > 0.01) flecha(ctx, bx + bw * 0.5, cy, bx + bw * 0.5 + p.F * kF, cy, C.fuerza, { lw: 3.5 * k, label: lab('F', p.F), lsize: 11 * k + 1 });
      if (ph.f > 0.01) flecha(ctx, bx - bw * 0.5, cy + bh * 0.28, bx - bw * 0.5 - ph.f * kF, cy + bh * 0.28, C.fuerza, { lw: 3.5 * k, label: lab('f', ph.f), lsize: 11 * k + 1 });
      // resultante y aceleración (banda superior)
      const yS = 14 + 10 * k, yA = yS + 26 * k + 4, xS = Math.max(bx - bw / 2, 10);
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
        return `a=\\dfrac{F-\\mu m g}{m}=\\dfrac{${tnum(p.F, 1)}-${tnum(p.mu, 2)}\\times${tnum(p.m, 1)}\\times9{,}81}{${tnum(p.m, 1)}}=${tnumA(ph.a)}\\ ${U_MS2}`;
      }
      return `\\sum F=ma\\;\\Rightarrow\\;a=\\dfrac{\\sum F}{m}=\\dfrac{${tnum(p.F, 1)}\\ \\text{N}}{${tnum(p.m, 1)}\\ \\text{kg}}=${tnumA(ph.a)}\\ ${U_MS2}`;
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
      const objetivo = Math.min((w * 0.8 - x0) / Math.max(f.R, 2), (gy - h * 0.2) / Math.max(f.H, 1));
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
      const kv = (0.13 * Math.min(w, h * 1.7)) / p.v0, vcol = '#7cc4ff';
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
      boton(s, ctx, 10, 10, 92, 26, '🚀 Lanzar', s.lanzar, false);
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

  // =====================================================================================
  // 4 · CARGA EN CAMPO ELÉCTRICO UNIFORME — F = q·E
  //   Condensador plano: placa superior (+) e inferior (−), campo E uniforme dirigido hacia abajo
  //   (sin efectos de borde; fuera de las placas E = 0). La partícula entra horizontalmente con v0.
  //   Dentro: a = |q|·E/m perpendicular a v0 → parábola  y = ½·a·(x/v0)².  Fuera: recta (MRU).
  //   Electrón (q = −e): F hacia la placa +, es decir hacia ARRIBA. Protón: hacia abajo.
  //   Si |y| supera d/2 la partícula choca con una placa. Geometría fija: L = 10 cm, d = 4 cm.
  //   El peso se desprecia; el parámetro opcional `peso`=1 muestra la comparación F/P.
  //   El tránsito real dura ns: se reproduce en cámara lenta (el cronómetro va en ns).
  // =====================================================================================
  const Q_E = 1.60e-19, M_E = 9.11e-31, M_P = 1.67e-27, PL_L = 0.10, PL_D = 0.04;
  function cargaFisica(p) {
    const sig = (p.signo || -1) < 0 ? -1 : 1, m = sig < 0 ? M_E : M_P, F = Q_E * p.E, a = F / m;
    const tT = PL_L / p.v0, ayUp = sig < 0 ? a : -a;           // aceleración en y (arriba +)
    let tImp = Infinity; if (Math.abs(0.5 * ayUp * tT * tT) > PL_D / 2) tImp = Math.sqrt(PL_D / Math.abs(ayUp));
    const yS = 0.5 * ayUp * tT * tT, vyS = ayUp * tT;
    return { sig, m, F, a, ayUp, tT, tImp, yS, vyS, choca: tImp < tT, P: m * G0 };
  }
  reg('carga-campo', {
    titulo: 'Carga en un campo eléctrico: F = q·E',
    params: [
      { id: 'E', label: 'Campo E', min: 500, max: 30000, step: 500, def: 5000, unit: 'V/m' },
      { id: 'v0', label: 'Velocidad de entrada v₀', min: 100000, max: 50000000, step: 100000, def: 20000000, unit: 'm/s' },
      { id: 'signo', label: 'Partícula (−1 electrón · +1 protón)', min: -1, max: 1, step: 2, def: -1, unit: '' },
    ],
    create(host, p) { return { t: 0, hold: 0, reduced: host.reduced, estela: [] }; },
    onParam(s) { s.t = 0; s.hold = 0; s.estela = []; },
    step(s, dt, p) {
      const f = cargaFisica(p), pre = 0.25 * PL_L / p.v0, tot = pre + f.tT + 0.45 * PL_L / p.v0;
      if (s._fin) { s.hold += dt; if (s.hold > 1.5) { s.t = 0; s.hold = 0; s._fin = false; s.estela = []; } return; }
      s.t += dt * tot / 4;                       // ~4 s de pantalla por pasada
      if (s.t >= tot) { s.t = tot; s._fin = true; s.hold = 0; }
    },
    draw(s, ctx, w, h, p) {
      fondo(ctx, w, h);
      const k = kPant(w, h), f = cargaFisica(p), L = PL_L, D = PL_D;
      const Sx = Math.min((0.54 * w) / L, (0.52 * h) / D), X0 = w * 0.25, cy = h * 0.5;
      const PX = (xm) => X0 + xm * Sx, PY = (ym) => cy - ym * Sx;
      const pre = 0.25 * L / p.v0, tIn = s.t - pre;          // tIn<0: aún no entra en las placas
      // posición de la partícula (m)
      let xm, ym, vx = p.v0, vy = 0, dentro = false, parada = false;
      if (tIn < 0) { xm = p.v0 * tIn; ym = 0; }
      else if (tIn <= Math.min(f.tT, f.tImp)) { xm = p.v0 * tIn; ym = 0.5 * f.ayUp * tIn * tIn; vy = f.ayUp * tIn; dentro = true; }
      else if (f.choca) { const ti = f.tImp; xm = p.v0 * ti; ym = sgn(f.ayUp) * D / 2; vx = 0; vy = 0; parada = true; dentro = true; }
      else { const tt = tIn - f.tT; xm = L + p.v0 * tt; ym = f.yS + f.vyS * tt; vy = f.vyS; }
      // --- placas ---
      const pw = L * Sx, pxl = PX(0), th = 9 * k, yT = PY(D / 2) - th, yB = PY(-D / 2);
      const gP = ctx.createLinearGradient(0, yT, 0, yT + th); gP.addColorStop(0, '#ff8aa0'); gP.addColorStop(1, '#c0344f');
      ctx.fillStyle = gP; rr(ctx, pxl, yT, pw, th, 3); ctx.fill();
      const gN = ctx.createLinearGradient(0, yB, 0, yB + th); gN.addColorStop(0, '#2a5fd0'); gN.addColorStop(1, '#6aa0ff');
      ctx.fillStyle = gN; rr(ctx, pxl, yB, pw, th, 3); ctx.fill();
      const nsig = Math.max(4, Math.floor(pw / (22 * k)));
      for (let i = 0; i < nsig; i++) {
        const sx = pxl + ((i + 0.5) * pw) / nsig;
        txt(ctx, '+', sx, yT - 8 * k, { align: 'center', size: 14 * k, color: '#ff8aa0' });
        txt(ctx, '−', sx, yB + th + 9 * k, { align: 'center', size: 15 * k, color: '#7fb0ff' });
      }
      // líneas de campo uniformes (↓), espaciado constante
      const nl = Math.max(5, Math.floor(pw / (30 * k)));
      for (let i = 0; i < nl; i++) {
        const sx = pxl + ((i + 0.5) * pw) / nl;
        flecha(ctx, sx, yT + th + 5, sx, yB - 4, 'rgba(255,209,102,.55)', { lw: 1.4, head: 7, dash: [5, 4] });
      }
      flecha(ctx, pxl + pw + 16 * k, cy - 22 * k, pxl + pw + 16 * k, cy + 22 * k, C.ambar, { lw: 3 * k, head: 9, label: 'E', lsize: 13 * k });
      // cañón de partículas
      const gx = PX(-0.25 * L) - 22 * k;
      ctx.fillStyle = '#26356b'; rr(ctx, gx - 18 * k, cy - 12 * k, 22 * k, 24 * k, 4); ctx.fill(); ctx.strokeStyle = '#8ea0cf'; ctx.lineWidth = 1.3; ctx.stroke();
      // estela y estroboscopia
      s.estela.push([xm, ym]); const maxE = s.reduced ? 60 : 400; if (s.estela.length > maxE) s.estela.shift();
      ctx.lineWidth = 2.2 * k; ctx.lineCap = 'round';
      for (let i = 1; i < s.estela.length; i++) {
        ctx.strokeStyle = `rgba(${f.sig < 0 ? '179,136,255' : '255,122,69'},${(i / s.estela.length) * 0.7})`;
        ctx.beginPath(); ctx.moveTo(PX(s.estela[i - 1][0]), PY(s.estela[i - 1][1])); ctx.lineTo(PX(s.estela[i][0]), PY(s.estela[i][1])); ctx.stroke();
      }
      const dtS = f.tT / 8;
      for (let t = 0; t <= Math.min(tIn, f.tT, f.tImp) + 1e-18; t += dtS) {
        ctx.fillStyle = 'rgba(255,209,102,.85)'; ctx.beginPath(); ctx.arc(PX(p.v0 * t), PY(0.5 * f.ayUp * t * t), 2.6 * k + 0.6, 0, TAU); ctx.fill();
      }
      // partícula
      const bx = PX(xm), by = PY(ym), pr = 8 * k + 1, col = f.sig < 0 ? C.violeta : '#ff7a45';
      const gp = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, pr + 2); gp.addColorStop(0, '#ffffff'); gp.addColorStop(1, col);
      ctx.fillStyle = gp; ctx.beginPath(); ctx.arc(bx, by, pr, 0, TAU); ctx.fill();
      txt(ctx, f.sig < 0 ? '−' : '+', bx, by + 0.5, { align: 'center', size: 13 * k, color: '#1a1030', weight: 700 });
      txt(ctx, f.sig < 0 ? 'électron' : 'proton', bx, by + pr + 12 * k, { align: 'center', size: 11 * k, color: col });
      // vectores: v siempre; F y a solo dentro del campo
      const kv = (0.16 * w) / p.v0;
      if (!parada) flecha(ctx, bx, by, bx + vx * kv, by - vy * kv * 1, C.vel, { lw: 3 * k, label: 'v', lsize: 12 * k + 1 });
      if (dentro) {
        const LF = 0.26 * D * Sx;
        flecha(ctx, bx, by, bx, by + (f.sig < 0 ? -LF : LF), C.fuerza, { lw: 3.4 * k, label: 'F = qE', lsize: 11 * k + 1, lside: -1 });
        flecha(ctx, bx + 12 * k, by, bx + 12 * k, by + (f.sig < 0 ? -LF * 1.55 : LF * 1.55), C.acel, { lw: 3.4 * k, label: 'a', lsize: 12 * k + 1 });
      }
      if (parada) txt(ctx, 'impacto en la placa', bx, by + (f.sig < 0 ? 30 : -30) * k, { align: 'center', size: 12 * k, color: C.ambar, bg: 'rgba(10,15,32,.75)' });
      // cotas: L, d
      ctx.strokeStyle = C.tenue; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pxl, yB + th + 26 * k); ctx.lineTo(pxl + pw, yB + th + 26 * k); ctx.stroke();
      txt(ctx, 'L = 10 cm', pxl + pw / 2, yB + th + 38 * k, { align: 'center', size: 11 * k, color: C.tenue, weight: 400 });
      ctx.beginPath(); ctx.moveTo(pxl - 14 * k, yT + th); ctx.lineTo(pxl - 14 * k, yB); ctx.moveTo(pxl - 18 * k, yT + th); ctx.lineTo(pxl - 10 * k, yT + th); ctx.moveTo(pxl - 18 * k, yB); ctx.lineTo(pxl - 10 * k, yB); ctx.stroke();
      txt(ctx, 'd = 4 cm', pxl - 20 * k, cy - 22 * k, { align: 'right', size: 11 * k, color: C.tenue, weight: 400 });
      // HUD
      const ns = Math.max(0, tIn) * 1e9;
      txt(ctx, `t = ${num(ns, ns < 10 ? 2 : 1)} ns`, 10, 14, { size: 12 * k, color: C.ambar });
      txt(ctx, `y = ${num(ym * 1000, 1)} mm`, 10, 14 + 16 * k, { size: 12 * k, color: C.tenue, weight: 400 });
      if (!f.choca && Math.abs(f.yS) < 0.03 * D) txt(ctx, 'desviación muy pequeña: masa grande → a pequeña', w - 10, 14, { align: 'right', size: 11 * k, color: C.ambar });
      if (p.peso) txt(ctx, `F / P = ${snum(f.F / f.P, 1)}  →  el peso es despreciable`, w - 10, h - 14, { align: 'right', size: 12 * k, color: C.fuerza });
    },
    formula(p) {
      const f = cargaFisica(p);
      return `F=|q|E=${tsci(Q_E, 2)}\\times${tsci(p.E, 1)}=${tsci(f.F, 1)}\\ \\text{N}\\;\\Rightarrow\\;a=\\dfrac{F}{m}=\\dfrac{${tsci(f.F, 1)}}{${tsci(f.m, 2)}}=${tsci(f.a, 1)}\\ ${U_MS2}`;
    },
    lecturas(p) {
      const f = cargaFisica(p), o = [
        { label: 'F = |q|E', valor: `${snum(f.F, 2)} N` }, { label: 'a', valor: `${snum(f.a, 2)} m·s⁻²` },
        { label: 'tiempo en placas', valor: `${snum(f.tT, 2)} s` }];
      o.push(f.choca ? { label: 'resultado', valor: 'choca con la placa' } : { label: 'desviación a la salida', valor: `${num(Math.abs(f.yS) * 1000, 2)} mm` });
      if (p.peso) o.push({ label: 'P = m·g', valor: `${snum(f.P, 2)} N` }, { label: 'F / P', valor: snum(f.F / f.P, 1) });
      return o;
    },
  });

  // =====================================================================================
  // 5 · GRAVITACIÓN — F = G·M·m / r²  y leyes de Kepler
  //   Unidades didácticas (indicadas en los sliders): M en 10²⁴ kg (Tierra = 5,97) y r en 10⁶ m
  //   (órbita geoestacionaria ≈ 42,2). Órbita circular (e = 0) o elíptica de semieje mayor r.
  //   Posición por la ecuación de Kepler (solución exacta, sin integración): E − e·sinE = 2π·t/T.
  //   v² = GM(2/r − 1/a) (vis-viva). Circular: v = √(GM/r). 3ª ley: T = 2π√(a³/GM).
  //   2ª ley: las 12 porciones coloreadas se barren en tiempos iguales (T/12) → áreas iguales.
  //   El periodo T se reproduce a ritmo fijo de 10 s de pantalla por órbita.
  // =====================================================================================
  const G_N = 6.67e-11;
  function gravFisica(p) {
    const M = p.M * 1e24, a = p.r * 1e6, m = p.m || 1000, e = clamp(p.e || 0, 0, 0.95), mu = G_N * M;
    return { M, a, m, e, mu, F: (mu * m) / (a * a), vc: Math.sqrt(mu / a), T: TAU * Math.sqrt((a * a * a) / mu), g: mu / (a * a), b: a * Math.sqrt(1 - e * e) };
  }
  function kepler(Mn, e) { let E = Mn + e * Math.sin(Mn); for (let i = 0; i < 10; i++) E -= (E - e * Math.sin(E) - Mn) / (1 - e * Math.cos(E)); return E; }
  function fmtT(sec) {
    if (sec < 7200) return `${num(sec / 60, 1)} min`;
    if (sec < 172800) return `${num(sec / 3600, 1)} h`;
    return `${num(sec / 86400, 1)} jours`;
  }
  reg('gravitacion', {
    titulo: 'Gravitación: F = G·M·m/r² y órbitas',
    params: [
      { id: 'M', label: 'Masa del astro M', min: 1, max: 100, step: 0.01, def: 5.97, unit: '×10²⁴ kg' },
      { id: 'r', label: 'Radio orbital r', min: 7, max: 100, step: 0.1, def: 42.2, unit: '×10⁶ m' },
      { id: 'm', label: 'Masa del satélite m (opcional)', min: 100, max: 5000, step: 100, def: 1000, unit: 'kg' },
      { id: 'e', label: 'Excentricidad e (opcional)', min: 0, max: 0.8, step: 0.05, def: 0, unit: '' },
    ],
    create(host, p) {
      const rng = host.rng || Math.random, est = [];
      for (let i = 0; i < 70; i++) est.push([rng(), rng(), 0.4 + rng() * 1.2, rng() * TAU]);
      return { fi: 0, est, reduced: host.reduced };
    },
    step(s, dt) { s.fi = (s.fi + dt / 10) % 1; },
    draw(s, ctx, w, h, p) {
      fondo(ctx, w, h);
      const k = kPant(w, h), f = gravFisica(p), e = f.e;
      // estrellas
      s.est.forEach((q) => { ctx.fillStyle = `rgba(200,215,255,${0.25 + 0.35 * (s.reduced ? 0.5 : (0.5 + 0.5 * Math.sin(performance.now() / 900 + q[3])))})`; ctx.fillRect(q[0] * w, q[1] * h, q[2], q[2]); });
      // escala: el elipse (semiejes a, b) centrado en la pantalla; foco desplazado a·e
      const sc = Math.min((0.4 * w) / f.a, (0.4 * h) / f.b), cx = w / 2, cy = h / 2;
      const fx = cx + f.a * e * sc, fy = cy;                       // foco = astro central
      const P = (E) => [fx + f.a * (Math.cos(E) - e) * sc, fy - f.b * Math.sin(E) * sc];
      // porciones de áreas iguales (2ª ley)
      const act = Math.floor(s.fi * 12);
      for (let j = 0; j < 12; j++) {
        ctx.beginPath(); ctx.moveTo(fx, fy);
        for (let i = 0; i <= 10; i++) { const q = P(kepler(TAU * (j + i / 10) / 12, e)); ctx.lineTo(q[0], q[1]); }
        ctx.closePath();
        ctx.fillStyle = j === act ? 'rgba(46,229,157,0.42)' : j % 2 ? 'rgba(61,165,255,0.09)' : 'rgba(255,209,102,0.08)'; ctx.fill();
        ctx.strokeStyle = j === act ? 'rgba(46,229,157,0.9)' : 'rgba(142,160,207,0.18)'; ctx.lineWidth = j === act ? 1.6 : 1; ctx.stroke();
      }
      // órbita
      ctx.strokeStyle = 'rgba(160,190,255,0.5)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const q = P((TAU * i) / 120); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      ctx.stroke(); ctx.setLineDash([]);
      // astro central (radio visual didáctico: crece con ∛M, nunca toca la órbita)
      const rPer = f.a * (1 - e) * sc, rp = clamp(6.4e6 * sc * Math.cbrt(p.M / 5.97), 11 * k, Math.max(11 * k, rPer * 0.6));
      const gl = ctx.createRadialGradient(fx, fy, rp * 0.9, fx, fy, rp * 1.8); gl.addColorStop(0, 'rgba(80,160,255,.35)'); gl.addColorStop(1, 'rgba(80,160,255,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(fx, fy, rp * 1.8, 0, TAU); ctx.fill();
      const gpn = ctx.createRadialGradient(fx - rp * 0.35, fy - rp * 0.35, rp * 0.1, fx, fy, rp); gpn.addColorStop(0, '#7fd6ff'); gpn.addColorStop(0.55, '#2a78d8'); gpn.addColorStop(1, '#0f2a6e');
      ctx.fillStyle = gpn; ctx.beginPath(); ctx.arc(fx, fy, rp, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(46,229,157,.55)'; ctx.beginPath(); ctx.ellipse(fx - rp * 0.25, fy + rp * 0.05, rp * 0.35, rp * 0.22, 0.5, 0, TAU); ctx.fill();
      txt(ctx, 'M', fx, fy + rp + 11 * k, { align: 'center', size: 12 * k, color: C.tenue });
      // satélite
      const E = kepler(TAU * s.fi, e), q = P(E), sx = q[0], sy = q[1];
      const r = f.a * (1 - e * Math.cos(E)), v = Math.sqrt(f.mu * (2 / r - 1 / f.a));
      // fuerza hacia el foco (rojo) ∝ 1/r² y velocidad tangente (azul) ∝ v
      const ux = (fx - sx), uy = (fy - sy), ul = Math.hypot(ux, uy) || 1, mn = Math.min(w, h);
      const lF = Math.min(0.2 * mn * (f.a / r) * (f.a / r), Math.max(10, ul - rp - 6));
      flecha(ctx, sx, sy, sx + (ux / ul) * lF, sy + (uy / ul) * lF, C.fuerza, { lw: 3.4 * k, label: 'F', lsize: 12 * k + 1 });
      const tx = -f.a * Math.sin(E), ty = f.b * Math.cos(E), tl = Math.hypot(tx, ty), lv = 0.2 * mn * (v / f.vc);
      flecha(ctx, sx, sy, sx + (tx / tl) * lv, sy - (ty / tl) * lv, C.vel, { lw: 3.4 * k, label: 'v', lsize: 12 * k + 1 });
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.atan2(ul ? uy : 0, ux));
      ctx.fillStyle = '#cfd8ff'; ctx.fillRect(-5 * k - 1, -4 * k - 1, 10 * k + 2, 8 * k + 2);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(-1.5, -11 * k, 3, 22 * k); ctx.restore();
      // barra de escala y HUD
      const barM = pasoNice((f.a * 0.5) / 1e6, 3), bpx = barM * 1e6 * sc;
      ctx.strokeStyle = C.tenue; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w - 12 - bpx, h - 16); ctx.lineTo(w - 12, h - 16);
      ctx.moveTo(w - 12 - bpx, h - 20); ctx.lineTo(w - 12 - bpx, h - 12); ctx.moveTo(w - 12, h - 20); ctx.lineTo(w - 12, h - 12); ctx.stroke();
      txt(ctx, `${num(barM, barM < 1 ? 1 : 0)} ×10⁶ m`, w - 12, h - 28, { align: 'right', size: 11 * k, color: C.tenue, weight: 400 });
      txt(ctx, `T = ${fmtT(f.T)}`, 10, 14, { size: 13 * k, color: C.ambar });
      txt(ctx, `v = ${num(v / 1000, 2)} km/s`, 10, 14 + 17 * k, { size: 12 * k, color: C.vel });
      txt(ctx, `r = ${num(r / 1e6, 1)} ×10⁶ m`, 10, 14 + 33 * k, { size: 12 * k, color: C.tenue, weight: 400 });
      if (e > 0.005) txt(ctx, 'aires iguales en tiempos iguales (T/12)', w / 2, h - 12, { align: 'center', size: 11 * k, color: '#7fe9bd' });
      else txt(ctx, 'escala didáctica · M en 10²⁴ kg, r en 10⁶ m', 10, h - 12, { size: 10.5 * k, color: C.tenue, weight: 400 });
    },
    formula(p) {
      const f = gravFisica(p);
      if (f.e > 0.005) return `\\dfrac{T^{2}}{a^{3}}=\\dfrac{4\\pi^{2}}{GM}\\;\\Rightarrow\\;T=2\\pi\\sqrt{\\dfrac{a^{3}}{GM}}=${tsci(f.T, 2)}\\ \\text{s}`;
      return `F=\\dfrac{G\\,M\\,m}{r^{2}}=\\dfrac{6{,}67\\times10^{-11}\\times${tsci(f.M, 2)}\\times${tsci(f.m, 1)}}{(${tsci(f.a, 2)})^{2}}=${tsci(f.F, 2)}\\ \\text{N}`;
    },
    lecturas(p) {
      const f = gravFisica(p), o = [{ label: 'F', valor: `${snum(f.F, 2)} N` }, { label: 'g(r) = GM/r²', valor: `${num(f.g, 2)} m·s⁻²` },
        { label: f.e > 0.005 ? 'v circular (r = a)' : 'v = √(GM/r)', valor: `${num(f.vc / 1000, 2)} km·s⁻¹` }, { label: 'T', valor: `${fmtT(f.T)} (${snum(f.T, 2)} s)` }];
      return o;
    },
  });


  // =====================================================================================
  // 6 · ENERGÍA MECÁNICA — Ec = ½mv², Ep = mgh, Em = Ec + Ep
  //   Bola en un tobogán parabólico (y = c·x²). Sale de la altura h con velocidad v cuesta abajo.
  //   Sin rozamiento Em es constante (la rapidez se calcula a partir de la energía: conservación
  //   exacta). Con rozamiento μ opcional: fuerza tangencial μ·m·g·cosθ (se desprecia el término
  //   centrífugo de la normal) y la energía disipada Q = ∫f·ds aparece como una 4ª barra.
  //   Referencia Ep = 0 en el punto más bajo del tobogán.
  // =====================================================================================
  const EM_C = 0.2; // curvatura del tobogán: y = c·x²  (x, y en metros)
  reg('energia-mecanica', {
    titulo: 'Energía mecánica: Ec + Ep = Em',
    params: [
      { id: 'm', label: 'Masa m', min: 0.2, max: 5, step: 0.1, def: 1, unit: 'kg' },
      { id: 'h', label: 'Altura inicial h', min: 0, max: 10, step: 0.5, def: 5, unit: 'm' },
      { id: 'v', label: 'Velocidad inicial v', min: 0, max: 15, step: 0.5, def: 0, unit: 'm/s' },
      { id: 'mu', label: 'Rozamiento μ (opcional)', min: 0, max: 0.3, step: 0.01, def: 0, unit: '' },
    ],
    create(host, p) {
      const s = { reduced: host.reduced }; ponerClicks(s, host);
      s.reinicia = (pp) => {
        const q = pp || s.p || {}, h0 = Math.max(q.h || 0, 0), v0 = q.v || 0;
        s.x = -Math.sqrt(h0 / EM_C); s.vs = v0; s.Q = 0; s.reposo = 0; s._acc = 0;
        s.E0 = (v0 * v0) / 2 + G0 * h0;                 // energía mecánica específica inicial (J/kg)
      };
      s.p = p; s.reinicia(p);
      return s;
    },
    onParam(s, id, v, p) { s.p = p; s.reinicia(p); },
    dispose(s) { quitarClicks(s); },
    step(s, dt, p) {
      s.p = p; const mu = p.mu || 0;
      if (s.reposo > 0) { s.reposo += dt; if (s.reposo > 2.5) s.reinicia(p); return; }
      pasos(s, dt, 1 / 1200, (hh) => {
        const sl = 2 * EM_C * s.x, cosT = 1 / Math.sqrt(1 + sl * sl), sinT = sl * cosT;
        // rozamiento estático: si la pendiente es menor que μ y la bola está parada, se queda
        if (mu > 0 && Math.abs(s.vs) < 1e-3 && Math.abs(sl) <= mu) { s.vs = 0; return; }
        // aceleración tangencial: gravedad + rozamiento (opuesto al movimiento)
        let at = -G0 * sinT;
        if (mu > 0 && Math.abs(s.vs) > 1e-3) at -= mu * G0 * cosT * sgn(s.vs);
        s.vs += at * hh; s.x += s.vs * cosT * hh;                 // Euler semi-implícito
        if (mu > 0) s.Q += mu * G0 * cosT * Math.abs(s.vs) * hh;  // J/kg disipados
        // conservación: con rapidez apreciable, |v| sale de la energía disponible (E0 − Q − g·y);
        // cerca de los puntos de retorno se deja la integración natural (así la bola puede dar la vuelta)
        if (Math.abs(s.vs) > 0.3) {
          const ek = s.E0 - s.Q - G0 * EM_C * s.x * s.x;
          s.vs = ek > 0 ? sgn(s.vs) * Math.sqrt(2 * ek) : 0;
        }
      });
      if (mu > 0 && s.vs === 0 && Math.abs(2 * EM_C * s.x) <= mu) s.reposo = 1e-6;
    },
    draw(s, ctx, w, h, p) {
      fondo(ctx, w, h); s._btns.length = 0;
      const k = kPant(w, h), m = p.m, mu = p.mu || 0;
      const Htop = Math.max(p.h + (p.v * p.v) / (2 * G0), 0.6), Xt = Math.sqrt(Htop / EM_C);
      const panW = clamp(w * 0.38, 150, 340), sceneW = w - panW;
      const sc = Math.min((0.46 * sceneW) / (Xt * 1.08), (h * 0.66) / (Htop * 1.1));
      const cx = sceneW * 0.5, base = h * 0.84, X = (xm) => cx + xm * sc, Y = (ym) => base - ym * sc;
      // línea de referencia Ep = 0
      ctx.strokeStyle = 'rgba(142,160,207,.45)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(6, base); ctx.lineTo(sceneW - 6, base); ctx.stroke(); ctx.setLineDash([]);
      // tobogán (relleno + borde)
      const xe = Xt * 1.08, N = 60;
      ctx.beginPath(); ctx.moveTo(X(-xe), base + 14 * k);
      for (let i = 0; i <= N; i++) { const x = -xe + (2 * xe * i) / N; ctx.lineTo(X(x), Y(EM_C * x * x)); }
      ctx.lineTo(X(xe), base + 14 * k); ctx.closePath();
      const gt = ctx.createLinearGradient(0, base - Htop * sc, 0, base + 14 * k); gt.addColorStop(0, '#2c3d78'); gt.addColorStop(1, '#16224a');
      ctx.fillStyle = gt; ctx.fill();
      ctx.strokeStyle = mu > 0 ? '#9aa8e0' : '#6a82d6'; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const x = -xe + (2 * xe * i) / N; i ? ctx.lineTo(X(x), Y(EM_C * x * x)) : ctx.moveTo(X(x), Y(EM_C * x * x)); }
      ctx.stroke();
      txt(ctx, 'Ep = 0 (referencia)', 8, base + 9 * k, { size: 10.5 * k, color: C.tenue, weight: 400 });
      // posición de la bola sobre la superficie (centro desplazado una distancia rb por la normal)
      const rb = (6 + 3 * Math.cbrt(m)) * k;
      const centro = (xm) => { const sl = 2 * EM_C * xm, c = 1 / Math.sqrt(1 + sl * sl), sn = sl * c; return [X(xm) - sn * rb, Y(EM_C * xm * xm) - c * rb, c, sn]; };
      const [bx, by, cosT, sinT] = centro(s.x), bym = EM_C * s.x * s.x;
      // marca de la posición de salida
      const q0 = centro(-Math.sqrt(Math.max(p.h, 0) / EM_C));
      ctx.strokeStyle = 'rgba(255,209,102,.5)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(q0[0], q0[1], rb, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      // altura actual (cota vertical)
      ctx.strokeStyle = 'rgba(0,212,255,.6)'; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, base); ctx.stroke(); ctx.setLineDash([]);
      if (bym * sc > 22) txt(ctx, `h = ${num(bym, 2)} m`, bx + 6, (by + base) / 2, { size: 11 * k, color: C.acento, bg: 'rgba(10,15,32,.7)' });
      const gb = ctx.createRadialGradient(bx - rb * 0.3, by - rb * 0.3, 1, bx, by, rb); gb.addColorStop(0, '#fff3c4'); gb.addColorStop(1, '#ff9f1c');
      ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(bx, by, rb, 0, TAU); ctx.fill();
      // peso (rojo) y velocidad tangente (azul)
      const vv = s.vs;
      flecha(ctx, bx, by, bx, by + 0.14 * h * Math.min(1, 0.4 + m / 5), C.fuerza, { lw: 3 * k, head: 9, label: 'P', lsize: 11 * k + 1 });
      if (Math.abs(vv) > 0.05) {
        const lv = clamp(Math.abs(vv) * 7 * k, 8, 0.2 * sceneW);
        flecha(ctx, bx, by, bx + cosT * sgn(vv) * lv, by - sinT * sgn(vv) * lv, C.vel, { lw: 3 * k, head: 9, label: 'v', lsize: 11 * k + 1 });
      }
      txt(ctx, `v = ${num(Math.abs(vv), 2)} m/s`, 10, h - 12, { size: 12 * k, color: C.vel });
      // --- panel de barras de energía ---
      const px0 = sceneW + 6, ph0 = panW - 12;
      ctx.fillStyle = 'rgba(16,26,58,.78)'; rr(ctx, px0, 8, ph0, h - 16, 12); ctx.fill(); ctx.strokeStyle = C.borde; ctx.lineWidth = 1; ctx.stroke();
      const Ec = 0.5 * m * vv * vv, Ep = m * G0 * bym, Q = m * s.Q, Emax = Math.max(m * s.E0, 1e-6);
      const nb = mu > 0 ? 4 : 3, bwid = Math.min(46 * k, (ph0 - 16) / nb - 10), gap = (ph0 - nb * bwid) / (nb + 1);
      const bBase = h - 38 * k, bTop = 44 * k, bh = bBase - bTop;
      const barra = (i, vals, nombre, col) => {
        const x = px0 + gap + i * (bwid + gap); let acc = 0;
        ctx.fillStyle = 'rgba(255,255,255,.05)'; rr(ctx, x, bTop, bwid, bh, 4); ctx.fill();
        vals.forEach(([val, c]) => { const hp = clamp(val / Emax, 0, 1.02) * bh; ctx.fillStyle = c; ctx.fillRect(x, bBase - acc - hp, bwid, hp); acc += hp; });
        txt(ctx, num(vals.reduce((a, b) => a + b[0], 0), 1) + ' J', x + bwid / 2, bBase - acc - 9 * k, { align: 'center', size: 11 * k, color: C.texto });
        txt(ctx, nombre, x + bwid / 2, bBase + 13 * k, { align: 'center', size: 12 * k, color: col });
      };
      barra(0, [[Ec, C.naranja]], 'Ec', C.naranja);
      barra(1, [[Ep, C.acento]], 'Ep', C.acento);
      barra(2, [[Ep, C.acento], [Ec, C.naranja]], 'Em', C.ambar);
      if (mu > 0) barra(3, [[Q, C.fuerza]], 'Q', C.fuerza);
      // línea de la energía mecánica inicial
      ctx.strokeStyle = 'rgba(255,209,102,.6)'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(px0 + 6, bTop); ctx.lineTo(px0 + ph0 - 6, bTop); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, mu > 0 ? 'Em = Ec + Ep disminuye (Q = calor)' : 'Em = Ec + Ep = constante', px0 + ph0 / 2, 24 * k, { align: 'center', size: 11.5 * k, color: C.ambar });
      boton(s, ctx, 10, 10, 84, 26, '↺ Relanzar', () => s.reinicia(p), false);
    },
    formula(p) {
      const Ec = 0.5 * p.m * p.v * p.v, Ep = p.m * G0 * p.h;
      return `E_m=E_c+E_p=\\dfrac{1}{2}mv^{2}+mgh=${tnumA(Ec)}+${tnumA(Ep)}=${tnumA(Ec + Ep)}\\ \\text{J}`;
    },
    lecturas(p) {
      const Ec = 0.5 * p.m * p.v * p.v, Ep = p.m * G0 * p.h, vb = Math.sqrt(p.v * p.v + 2 * G0 * p.h);
      return [{ label: 'Ec', valor: `${numA(Ec)} J` }, { label: 'Ep', valor: `${numA(Ep)} J` }, { label: 'Em', valor: `${numA(Ec + Ep)} J` },
        { label: 'v en el punto bajo (sin rozamiento)', valor: `${num(vb, 2)} m·s⁻¹` }];
    },
  });

  // =====================================================================================
  // 7 · ARQUÍMEDES — Π = ρ_fluido · V_sumergido · g
  //   Cubo de volumen V y masa volúmica ρc en un depósito de fluido (ρ). Dos modos:
  //   · DINAMÓMETRO: el cuerpo cuelga y se sumerge (slider «inm» o automáticamente al inicio).
  //     Lectura aparente T = P − Π. Si ρc < ρ el cuerpo no puede quedar totalmente sumergido
  //     (el hilo se destensa): se queda en la flotación, con T = 0.
  //   · LIBRE (botón «Soltar»): dinámica vertical con rozamiento viscoso lineal; flota
  //     (inmersión ρc/ρ) si ρc < ρ y se hunde si ρc > ρ (apoya en el fondo: reacción N).
  //   Simplificaciones: el nivel del fluido se mantiene fijo; cubo de arista V^(1/3); sin olas.
  // =====================================================================================
  const AR = { Wt: 0.4, Ht: 0.36, Lf: 0.28 }; // depósito: ancho, alto, nivel del fluido (m)
  function arqFisica(p, f) {
    const rhoc = p.rhoc || 2700, a = Math.cbrt(p.V), P = rhoc * p.V * G0, Pi = p.rho * p.V * G0 * f;
    return { rhoc, a, P, Pi, PiMax: p.rho * p.V * G0, T: Math.max(0, P - Pi), feq: rhoc / p.rho };
  }
  reg('arquimedes', {
    titulo: 'Principio de Arquímedes: Π = ρ·V·g',
    params: [
      { id: 'rho', label: 'Masa volúmica del fluido ρ', min: 600, max: 1600, step: 10, def: 1000, unit: 'kg/m³' },
      { id: 'V', label: 'Volumen del cuerpo V', min: 0.0002, max: 0.002, step: 0.0001, def: 0.001, unit: 'm³' },
      { id: 'rhoc', label: 'Masa volúmica del cuerpo ρc (opcional)', min: 200, max: 8000, step: 50, def: 2700, unit: 'kg/m³' },
      { id: 'inm', label: 'Inmersión (opcional)', min: 0, max: 100, step: 1, def: 100, unit: '%' },
    ],
    create(host, p) {
      const s = { modo: 'dina', f: 0, yb: AR.Lf, vy: 0, t: 0, reduced: host.reduced, burb: [] };
      ponerClicks(s, host);
      s.rng = host.rng || Math.random;
      return s;
    },
    onParam(s, id) { if (id === 'inm' && s.modo === 'libre') { s.modo = 'dina'; } if (s.modo === 'libre' && id !== 'inm') { s.vy = 0; } },
    dispose(s) { quitarClicks(s); },
    step(s, dt, p) {
      s.t += dt;
      const ph = arqFisica(p, 1), a = ph.a;
      if (s.modo === 'dina') {
        const ft = Math.min(p.inm / 100, ph.feq);
        s.f += clamp(ft - s.f, -dt * 0.55, dt * 0.55);                // desciende/asciende suavemente
        s.yb = AR.Lf - a * s.f; s.vy = 0;
      } else {
        // libre: m·dv/dt = Π(y) − P − c·v ; apoyo en el fondo
        const m = ph.rhoc * p.V, c = 6 * m;
        pasos(s, dt, 1 / 240, (hh) => {
          const f = clamp((AR.Lf - s.yb) / a, 0, 1), Pi = p.rho * p.V * G0 * f;
          s.vy += ((Pi - m * G0 - c * s.vy) / m) * hh; s.yb += s.vy * hh;
          if (s.yb <= 0) { s.yb = 0; if (s.vy < 0) s.vy = 0; }
        });
        s.f = clamp((AR.Lf - s.yb) / a, 0, 1);
      }
      // burbujas decorativas
      if (!s.reduced && s.burb.length < 14 && s.rng() < dt * 5) s.burb.push({ x: 0.03 + s.rng() * 0.34, y: 0.01, v: 0.03 + s.rng() * 0.05, r: 1 + s.rng() * 1.6 });
      s.burb.forEach((b) => (b.y += b.v * dt)); s.burb = s.burb.filter((b) => b.y < AR.Lf);
    },
    draw(s, ctx, w, h, p) {
      fondo(ctx, w, h); s._btns.length = 0;
      const k = kPant(w, h), ph = arqFisica(p, s.f), a = ph.a;
      const sceneW = w * (w < 520 ? 0.58 : 0.62);
      const sc = Math.min((0.88 * h) / 0.66, (0.52 * sceneW) / AR.Wt);
      const tx0 = (sceneW - AR.Wt * sc) / 2, tyB = h * 0.95, X = (xm) => tx0 + xm * sc, Y = (ym) => tyB - ym * sc;
      const cxm = AR.Wt / 2;
      // ---- depósito y fluido ----
      const yS = Y(AR.Lf);
      const gw = ctx.createLinearGradient(0, yS, 0, tyB); gw.addColorStop(0, '#2b79d6'); gw.addColorStop(1, '#123a7a');
      ctx.fillStyle = gw; ctx.fillRect(X(0), yS, AR.Wt * sc, tyB - yS);
      // burbujas
      s.burb.forEach((b) => { ctx.fillStyle = 'rgba(200,230,255,.45)'; ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), b.r * k, 0, TAU); ctx.fill(); });
      // ---- dinamómetro (solo modo dina) ----
      const ytopBar = Y(AR.Ht + 0.2 + 0.07), tubeL = 0.17 * sc, tubeW = 22 * k, tubeTop = ytopBar + 8 * k, tubeBot = tubeTop + tubeL;
      const bodyTop = Y(s.yb + a), bodyBot = Y(s.yb), bcx = X(cxm), bh = bodyBot - bodyTop;
      if (s.modo === 'dina') {
        ctx.strokeStyle = '#8ea0cf'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bcx - 40 * k, ytopBar); ctx.lineTo(bcx + 40 * k, ytopBar); ctx.stroke();
        ctx.strokeStyle = '#8ea0cf'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bcx, ytopBar); ctx.lineTo(bcx, tubeTop); ctx.stroke();
        ctx.fillStyle = 'rgba(220,235,255,.1)'; rr(ctx, bcx - tubeW / 2, tubeTop, tubeW, tubeL, 5); ctx.fill(); ctx.strokeStyle = '#b9c7ff'; ctx.lineWidth = 1.5; ctx.stroke();
        const Tmax = [2, 5, 10, 20, 50, 100, 200].find((v) => v >= ph.P * 1.05) || 300;
        const st = Tmax <= 5 ? 1 : Tmax <= 20 ? 5 : Tmax <= 100 ? 10 : 50;
        ctx.font = FONT(9 * k + 1, 400); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        for (let v = 0; v <= Tmax + 1e-9; v += st) {
          const yy = tubeTop + (v / Tmax) * tubeL; ctx.strokeStyle = '#b9c7ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bcx - tubeW / 2, yy); ctx.lineTo(bcx - tubeW / 2 + 5, yy); ctx.stroke();
          ctx.fillStyle = C.tenue; ctx.fillText(String(v), bcx - tubeW / 2 - 18 * k, yy);
        }
        const yT = tubeTop + (ph.T / Tmax) * tubeL;
        ctx.strokeStyle = C.fuerza; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bcx - tubeW / 2, yT); ctx.lineTo(bcx + tubeW / 2, yT); ctx.stroke();
        txt(ctx, `${num(ph.T, 1)} N`, bcx + tubeW / 2 + 6, yT, { size: 12 * k, color: C.fuerza, bg: 'rgba(10,15,32,.75)' });
        ctx.strokeStyle = '#8ea0cf'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bcx, tubeBot); ctx.lineTo(bcx, bodyTop); ctx.stroke();
      }
      // ---- cuerpo (cubo) ----
      const tcol = clamp((ph.rhoc - 200) / 7800, 0, 1);
      const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
      const c1 = mix([205, 160, 95], [150, 165, 190], tcol), c2 = mix([150, 105, 55], [85, 100, 130], tcol);
      const bw = a * sc, gcub = ctx.createLinearGradient(bcx - bw / 2, bodyTop, bcx + bw / 2, bodyBot);
      gcub.addColorStop(0, `rgb(${c1})`); gcub.addColorStop(1, `rgb(${c2})`);
      ctx.fillStyle = gcub; rr(ctx, bcx - bw / 2, bodyTop, bw, bh, 4); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.4; ctx.stroke();
      if (s.modo === 'dina') { ctx.fillStyle = '#8ea0cf'; ctx.beginPath(); ctx.arc(bcx, bodyTop, 3, 0, TAU); ctx.fill(); }
      txt(ctx, 'ρc', bcx - bw / 2 + 5, bodyTop + 9 * k + 2, { size: clamp(bw * 0.2, 10, 13), color: '#10162e', weight: 700 });
      // velo de fluido sobre la parte sumergida + superficie
      ctx.fillStyle = 'rgba(43,121,214,.30)'; ctx.fillRect(X(0), yS, AR.Wt * sc, tyB - yS);
      ctx.strokeStyle = '#7fc2ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(0), yS); ctx.lineTo(X(AR.Wt), yS); ctx.stroke();
      // vidrio del depósito
      ctx.strokeStyle = 'rgba(200,225,255,.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(0), Y(AR.Ht)); ctx.lineTo(X(0), tyB); ctx.lineTo(X(AR.Wt), tyB); ctx.lineTo(X(AR.Wt), Y(AR.Ht)); ctx.stroke();
      // ---- fuerzas (misma escala) ----
      const Lmax = 0.2 * h, kF = Lmax / Math.max(ph.P, ph.PiMax, 1e-6), cyb = (bodyTop + bodyBot) / 2;
      const off = Math.max(10, bw * 0.28), fl = (nom, v) => `${nom} = ${num(v, 1)} N`;
      flecha(ctx, bcx, cyb, bcx, cyb + ph.P * kF, C.fuerza, { lw: 3.4 * k, label: fl('P', ph.P), lsize: 11 * k + 1 });
      if (ph.Pi > 0.05) flecha(ctx, bcx - off, cyb, bcx - off, cyb - ph.Pi * kF, C.fuerza, { lw: 3.4 * k, label: fl('Π', ph.Pi), lsize: 11 * k + 1, lside: -1 });
      if (s.modo === 'dina' && ph.T > 0.05) flecha(ctx, bcx + off, cyb, bcx + off, cyb - ph.T * kF, C.fuerza, { lw: 3.4 * k, label: fl('T', ph.T), lsize: 11 * k + 1, lside: 1 });
      if (s.modo === 'libre' && s.yb <= 0 && ph.P - ph.Pi > 0.05) flecha(ctx, bcx + off, cyb, bcx + off, cyb - (ph.P - ph.Pi) * kF, C.fuerza, { lw: 3.4 * k, label: fl('N', ph.P - ph.Pi), lsize: 11 * k + 1, lside: 1 });
      // ---- panel de datos ----
      const px = sceneW + 8, pw = w - px - 8, lh = 17 * k + 1;
      let y = 16 * k;
      ctx.fillStyle = 'rgba(16,26,58,.7)'; rr(ctx, px, 8, pw, h - 16, 12); ctx.fill(); ctx.strokeStyle = C.borde; ctx.lineWidth = 1; ctx.stroke();
      const fila = (a1, b1, col) => { txt(ctx, a1, px + 10, y, { size: 11.5 * k, color: C.tenue, weight: 400 }); txt(ctx, b1, px + pw - 10, y, { align: 'right', size: 12 * k, color: col || C.texto }); y += lh; };
      fila('Fluide ρ', `${num(p.rho, 0)} kg/m³`, C.agua);
      fila('Corps ρc', `${num(ph.rhoc, 0)} kg/m³`, '#e0b878');
      fila('V', `${tsciPlano(p.V)} m³`);
      y += 4;
      const flota = ph.rhoc < p.rho;
      txt(ctx, flota ? 'ρc < ρ  →  flotte' : ph.rhoc > p.rho ? 'ρc > ρ  →  coule' : 'ρc = ρ  →  équilibre', px + pw / 2, y, { align: 'center', size: 12.5 * k, color: C.ambar }); y += lh + 2;
      fila('Immergé', `${num(s.f * 100, 0)} %`, C.acento);
      fila('Π', `${num(ph.Pi, 2)} N`, C.fuerza);
      fila('P', `${num(ph.P, 2)} N`, C.fuerza);
      if (s.modo === 'dina') fila('P apparent', `${num(ph.T, 2)} N`, C.fuerza);
      else if (s.yb <= 0) fila('Réaction N', `${num(Math.max(0, ph.P - ph.Pi), 2)} N`, C.fuerza);
      // botones
      const bw2 = Math.min(pw - 20, 110 * k + 20);
      boton(s, ctx, px + (pw - bw2) / 2, h - 66 * k, bw2, 26 * k, '⬇ Soltar', () => { s.modo = 'libre'; s.vy = 0; }, s.modo === 'libre');
      boton(s, ctx, px + (pw - bw2) / 2, h - 34 * k, bw2, 26 * k, '⚖ Dinamómetro', () => { s.modo = 'dina'; }, s.modo === 'dina');
    },
    formula(p) {
      const ph = arqFisica(p, 1);
      return `\\Pi=\\rho\\,V\\,g=${tnum(p.rho, 0)}\\times${tsci(p.V, 1)}\\times9{,}81=${tnumA(ph.PiMax)}\\ \\text{N}`;
    },
    lecturas(p) {
      const ph = arqFisica(p, 1), flota = ph.rhoc < p.rho;
      const o = [{ label: 'Π (cuerpo sumergido)', valor: `${num(ph.PiMax, 2)} N` }, { label: 'P = ρc·V·g', valor: `${num(ph.P, 2)} N` }];
      o.push(flota ? { label: 'resultado', valor: `flota (${num(ph.feq * 100, 0)} % sumergido)` } : { label: 'P aparente = P − Π', valor: `${num(ph.P - ph.PiMax, 2)} N` });
      return o;
    },
  });
  /** m³ en texto plano compacto (1,0×10⁻³) */
  const tsciPlano = (v) => snum(v, 1);

  // =====================================================================================
  // 8 · TORRICELLI — v = √(2·g·h)
  //   Depósito abierto con un orificio pequeño a la altura H0 del suelo y agua h por encima.
  //   Chorro: v = √(2gh) horizontal; luego tiro parabólico con alcance  d = v·√(2H0/g) = 2√(h·H0).
  //   El nivel baja despacio: dh/dt = −κ·√(2gh) con κ = (S_orificio/S_depósito) = 0,03
  //   (fijado para que se vea el efecto). Al llegar al 25 % de h se rellena (o botón «Rellenar»).
  //   El chorro se dibuja como flujo de partículas balísticas + línea translúcida.
  // =====================================================================================
  const TQ = { Wt: 0.9, kappa: 0.03 };
  reg('torricelli', {
    titulo: 'Teorema de Torricelli: v = √(2gh)',
    params: [
      { id: 'h', label: 'Altura de agua h', min: 0.1, max: 1.5, step: 0.05, def: 0.8, unit: 'm' },
      { id: 'H0', label: 'Altura del orificio H₀ (opcional)', min: 0.3, max: 2, step: 0.05, def: 1, unit: 'm' },
    ],
    create(host, p) {
      const s = { lv: p.h, parts: [], gotas: [], t: 0, ref: 0, reduced: host.reduced, rng: host.rng || Math.random, acc: 0 };
      ponerClicks(s, host); s.llenar = () => { s.ref = 1; };
      return s;
    },
    onParam(s, id, v, p) { if (id === 'h') { s.lv = p.h; s.ref = 0; } },
    dispose(s) { quitarClicks(s); },
    step(s, dt, p) {
      s.t += dt;
      if (s.ref) { s.lv += dt * (p.h - Math.max(p.h * 0.2, 0.1)) * 0.9 + dt * 0.3; if (s.lv >= p.h) { s.lv = p.h; s.ref = 0; } }
      else { s.lv -= TQ.kappa * Math.sqrt(2 * G0 * Math.max(s.lv, 0)) * dt; if (s.lv < Math.max(p.h * 0.25, 0.05)) s.llenar(); }
      const v = Math.sqrt(2 * G0 * Math.max(s.lv, 0)), rate = s.reduced ? 45 : 110;
      s.acc += dt * rate; let n = 0;
      while (s.acc >= 1 && n < 5) { s.acc -= 1; n++; s.parts.push({ x: 0, y: 0, vx: v * (1 + (s.rng() - 0.5) * 0.02), vy: (s.rng() - 0.5) * 0.03, t: 0 }); }
      s.parts.forEach((q) => { q.vy -= G0 * dt; q.x += q.vx * dt; q.y += q.vy * dt; });
      const H0 = p.H0 || 1;
      s.parts = s.parts.filter((q) => {
        if (q.y + H0 > 0) return true;
        if (s.gotas.length < 60 && s.rng() < (s.reduced ? 0.1 : 0.3)) s.gotas.push({ x: q.x, y: 0, vx: (s.rng() - 0.3) * 0.5, vy: 0.4 + s.rng() * 0.6, t: 0 });
        return false;
      });
      s.gotas.forEach((g) => { g.vy -= G0 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.t += dt; });
      s.gotas = s.gotas.filter((g) => g.y >= 0 && g.t < 0.6);
    },
    draw(s, ctx, w, h, p) {
      fondo(ctx, w, h); s._btns.length = 0;
      const k = kPant(w, h), H0 = p.H0 || 1, lv = Math.max(s.lv, 0), v = Math.sqrt(2 * G0 * lv);
      const Rmax = 2 * Math.sqrt(p.h * H0) + 0.3;
      const sc = Math.min((0.86 * h) / (H0 + p.h + 0.35), (w - 90 * k - 10) / (0.12 + TQ.Wt + Rmax));
      const gy = h * 0.9, tx0 = 0.12 * sc + 84 * k, X = (xm) => tx0 + xm * sc, Y = (ym) => gy - ym * sc; // ym = altura sobre el suelo
      const xO = TQ.Wt;                                    // pared del orificio
      // suelo y regla de alcances
      ctx.fillStyle = '#16224a'; ctx.fillRect(0, gy, w, h - gy);
      ctx.strokeStyle = '#5a6cb0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      const step = pasoNice(Rmax * 0.9, 5), dp = decPaso(step);
      for (let d = 0; X(xO + d) < w - 6; d += step) {
        ctx.strokeStyle = '#5a6cb0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(xO + d), gy); ctx.lineTo(X(xO + d), gy + 5); ctx.stroke();
        txt(ctx, num(d, dp), X(xO + d), gy + 14 * k, { size: 10 * k + 1, align: 'center', color: C.tenue, weight: 400 });
      }
      txt(ctx, 'distancia al depósito (m)', w - 8, gy + 28 * k, { align: 'right', size: 10 * k + 1, color: C.tenue, weight: 400 });
      // depósito: soporte, agua, paredes
      const topY = Y(H0 + p.h + 0.2), botY = Y(H0 - 0.1), yS = Y(H0 + lv);
      ctx.fillStyle = '#243462'; ctx.fillRect(X(0.1), botY, 0.15 * sc, gy - botY); ctx.fillRect(X(TQ.Wt - 0.25), botY, 0.15 * sc, gy - botY);
      const gw = ctx.createLinearGradient(0, yS, 0, botY); gw.addColorStop(0, '#2f86e6'); gw.addColorStop(1, '#14408a');
      ctx.fillStyle = gw; ctx.fillRect(X(0), yS, TQ.Wt * sc, botY - yS);
      if (!s.reduced) { ctx.strokeStyle = 'rgba(160,210,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 24; i++) { const xx = X(0) + (i / 24) * TQ.Wt * sc; const yy = yS + Math.sin(s.t * 3 + i * 0.8) * 1.4; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
      ctx.strokeStyle = 'rgba(200,225,255,.8)'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(X(0), topY); ctx.lineTo(X(0), botY); ctx.lineTo(X(TQ.Wt), botY); ctx.lineTo(X(TQ.Wt), topY); ctx.stroke();
      // orificio
      ctx.fillStyle = C.fondo; ctx.fillRect(X(xO) - 3, Y(H0) - 4 * k, 6, 8 * k);
      // chorro: línea translúcida + partículas
      const ox = X(xO), oy = Y(H0);
      ctx.strokeStyle = 'rgba(80,170,255,.35)'; ctx.lineWidth = 6 * k; ctx.lineCap = 'round'; ctx.beginPath();
      const tF = Math.sqrt((2 * H0) / G0);
      for (let i = 0; i <= 40; i++) { const t = (tF * i) / 40; const xx = ox + v * t * sc, yy = oy + 0.5 * G0 * t * t * sc; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(190,230,255,.9)';
      s.parts.forEach((q) => { ctx.beginPath(); ctx.arc(ox + q.x * sc, oy - q.y * sc, 1.7 * k + 0.4, 0, TAU); ctx.fill(); });
      ctx.fillStyle = 'rgba(190,230,255,.8)'; s.gotas.forEach((g) => { ctx.beginPath(); ctx.arc(X(xO + g.x), Y(g.y), 1.5 * k, 0, TAU); ctx.fill(); });
      // vector velocidad en el orificio
      flecha(ctx, ox + 4, oy, ox + 4 + v * 0.04 * w, oy, C.vel, { lw: 3.5 * k, label: `v = ${num(v, 2)} m/s`, lsize: 11.5 * k + 1 });
      // cotas: h (amarillo) y H0
      ctx.strokeStyle = C.ambar; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(X(0.12), yS); ctx.lineTo(X(0.12), oy); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(X(0.12) - 4, yS); ctx.lineTo(X(0.12) + 4, yS); ctx.moveTo(X(0.12) - 4, oy); ctx.lineTo(X(0.12) + 4, oy); ctx.stroke();
      txt(ctx, `h = ${num(lv, 2)} m`, X(0.12) + 8, (yS + oy) / 2, { size: 12 * k, color: C.ambar, bg: 'rgba(10,15,32,.7)' });
      const hx = X(TQ.Wt) + 0.0; ctx.strokeStyle = C.tenue; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(X(-0.12), oy); ctx.lineTo(X(-0.12), gy); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, `H₀ = ${num(H0, 2)} m`, X(-0.12) - 4, (oy + gy) / 2, { align: 'right', size: 11 * k, color: C.tenue, bg: 'rgba(10,15,32,.7)' });
      // alcance
      const R = v * tF, xr = X(xO + R);
      if (xr < w - 8) {
        ctx.strokeStyle = C.ambar; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(xr - 6, gy - 6); ctx.lineTo(xr + 6, gy + 6); ctx.moveTo(xr + 6, gy - 6); ctx.lineTo(xr - 6, gy + 6); ctx.stroke();
        txt(ctx, `d = ${num(R, 2)} m`, xr, gy - 16 * k, { align: 'center', size: 12 * k, color: C.ambar, bg: 'rgba(10,15,32,.7)' });
      }
      txt(ctx, `v = √(2·g·h) = ${num(v, 2)} m/s`, w - 10, 14, { align: 'right', size: 12.5 * k, color: C.vel });
      txt(ctx, `nivel ↓ ${num(lv, 2)} m`, w - 10, 14 + 17 * k, { align: 'right', size: 11.5 * k, color: C.tenue, weight: 400 });
      boton(s, ctx, 10, 10, 96, 26, '⟳ Rellenar', s.llenar, !!s.ref);
    },
    formula(p) {
      return `v=\\sqrt{2gh}=\\sqrt{2\\times9{,}81\\times${tnum(p.h, 2)}}=${tnum(Math.sqrt(2 * G0 * p.h), 2)}\\ ${U_MS}`;
    },
    lecturas(p) {
      const H0 = p.H0 || 1, v = Math.sqrt(2 * G0 * p.h);
      return [{ label: 'v', valor: `${num(v, 2)} m·s⁻¹` }, { label: 'alcance d = 2√(h·H₀)', valor: `${num(2 * Math.sqrt(p.h * H0), 2)} m` },
        { label: 'tiempo de caída', valor: `${num(Math.sqrt((2 * H0) / G0), 2)} s` }];
    },
  });

  // =====================================================================================
  // 9 · GAS IDEAL — P·V = n·R·T   (R = 8,314 J·K⁻¹·mol⁻¹)
  //   Cilindro con pistón móvil. Partículas 2D sin interacción entre sí (gas ideal), choques
  //   elásticos con las paredes y con el pistón (que cede su velocidad). Un termostato suave
  //   mantiene la energía cinética media ∝ T: rapidez eficaz ∝ √T. Nº de partículas = 40·n
  //   (cada punto ≈ 0,025 mol; escala visual). El manómetro marca P = n·R·T/V (valor exacto de
  //   la fórmula) y se enciende un destello en el pistón con cada choque. V en litros → m³.
  // =====================================================================================
  const R_GAS = 8.314, GAS_VMAX = 50;
  const gasP = (p) => (p.n * R_GAS * p.T) / (p.V / 1000); // Pa
  const niceMax = (v) => { for (let e = -1; e < 8; e++) for (const m of [1, 2, 5]) { const c = m * Math.pow(10, e); if (c >= v) return c; } return v; };
  reg('gas-ideal', {
    titulo: 'Gas ideal: P·V = n·R·T',
    params: [
      { id: 'n', label: 'Cantidad de gas n', min: 0.1, max: 2, step: 0.1, def: 1, unit: 'mol' },
      { id: 'T', label: 'Temperatura T', min: 100, max: 1000, step: 10, def: 300, unit: 'K' },
      { id: 'V', label: 'Volumen V', min: 5, max: 50, step: 0.5, def: 25, unit: 'L' },
    ],
    create(host, p) {
      const s = { parts: [], Vc: p.V, flash: 0, reduced: host.reduced, rng: host.rng || Math.random, pn: 0, t: 0 };
      s.pmax = niceMax((gasP(p) / 1000) * 1.2); s.pn = gasP(p) / 1000;
      s.Lb = host.w * 0.48; s.hb = clamp(Math.min(host.h * 0.46, s.Lb * 0.5), 70, 220); s.kpx = kPant(host.w, host.h); // se reajustan en draw
      return s;
    },
    onParam(s, id, v, p) { s.pmax = niceMax((gasP(p) / 1000) * 1.2); },
    step(s, dt, p) {
      s.t += dt;
      const target = Math.round(40 * p.n), rn = s.rng;
      s.Vc += clamp(p.V - s.Vc, -dt * 18, dt * 18);                     // el pistón se desplaza suave
      // altas/bajas de partículas hasta igualar n
      while (s.parts.length < target) s.parts.push({ x: rn() * s.Lb * (s.Vc / GAS_VMAX), y: rn() * s.hb, vx: 0, vy: 0, nuevo: true });
      while (s.parts.length > target) s.parts.splice((rn() * s.parts.length) | 0, 1);
      // geometría vigente (px) y rapidez eficaz objetivo
      const L = s.Lb * (s.Vc / GAS_VMAX), Lprev = s.Lprev == null ? L : s.Lprev, vp = (L - Lprev) / Math.max(dt, 1e-4); s.Lprev = L;
      const vrms = 7 * Math.sqrt(p.T) * s.kpx;                          // px/s ∝ √T
      let ke = 0;
      s.parts.forEach((q) => {
        if (q.nuevo) { const a = rn() * TAU; q.vx = Math.cos(a) * vrms; q.vy = Math.sin(a) * vrms; q.nuevo = false; }
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.x < 0) { q.x = -q.x; q.vx = Math.abs(q.vx); }
        if (q.x > L) { q.x = L - (q.x - L); q.vx = -Math.abs(q.vx) + 2 * vp; s.flash = 1; q.flash = 1; }
        if (q.x < 0) q.x = 0; if (q.x > L) q.x = L;
        if (q.y < 0) { q.y = -q.y; q.vy = Math.abs(q.vy); }
        if (q.y > s.hb) { q.y = 2 * s.hb - q.y; q.vy = -Math.abs(q.vy); }
        ke += q.vx * q.vx + q.vy * q.vy;
      });
      // termostato: relaja la rapidez eficaz hacia vrms (isoterma)
      if (s.parts.length) { const cur = Math.sqrt(ke / s.parts.length) || vrms, f = 1 + (vrms / cur - 1) * (1 - Math.exp(-dt / 0.35)); s.parts.forEach((q) => { q.vx *= f; q.vy *= f; }); }
      s.flash = Math.max(0, s.flash - dt * 6);
      s.pn += (gasP(p) / 1000 - s.pn) * (1 - Math.exp(-dt / 0.2));
    },
    draw(s, ctx, w, h, p) {
      fondo(ctx, w, h);
      const k = kPant(w, h), P = gasP(p) / 1000;                         // kPa
      // geometría: termómetro | cilindro | varilla | manómetro
      const cx0 = w * 0.14, Lmax = w * 0.48, cyc = h * 0.5, hb = clamp(Math.min(h * 0.46, Lmax * 0.5), 70, 220);
      s.Lb = Lmax; s.hb = hb; s.kpx = k;
      const L = Lmax * (s.Vc / GAS_VMAX), top = cyc - hb / 2, pxP = cx0 + L;
      // cilindro (cristal) y fondo
      ctx.fillStyle = 'rgba(40,60,120,.18)'; ctx.fillRect(cx0, top, Lmax, hb);
      ctx.strokeStyle = 'rgba(190,210,255,.7)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx0 + Lmax + 6, top); ctx.lineTo(cx0, top); ctx.lineTo(cx0, top + hb); ctx.lineTo(cx0 + Lmax + 6, top + hb); ctx.stroke();
      // regla de volumen bajo el cilindro
      ctx.strokeStyle = C.tenue; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx0, top + hb + 12 * k); ctx.lineTo(cx0 + Lmax, top + hb + 12 * k); ctx.stroke();
      for (let v = 0; v <= GAS_VMAX; v += 10) { const xx = cx0 + (v / GAS_VMAX) * Lmax; ctx.beginPath(); ctx.moveTo(xx, top + hb + 9 * k); ctx.lineTo(xx, top + hb + 15 * k); ctx.stroke(); txt(ctx, String(v), xx, top + hb + 26 * k, { align: 'center', size: 10 * k, color: C.tenue, weight: 400 }); }
      txt(ctx, 'V (L)', cx0 + Lmax + 10, top + hb + 26 * k, { size: 10 * k, color: C.tenue, weight: 400 });
      // partículas (color según T)
      const tt = clamp((p.T - 100) / 900, 0, 1), cr = Math.round(lerp(61, 255, tt)), cg = Math.round(lerp(165, 90, tt)), cb = Math.round(lerp(255, 100, tt));
      const rad = 3.2 * k + 0.6;
      s.parts.forEach((q) => {
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`; ctx.beginPath(); ctx.arc(cx0 + q.x, top + q.y, rad, 0, TAU); ctx.fill();
      });
      // pistón + varilla + mango
      const gpi = ctx.createLinearGradient(pxP - 5 * k, 0, pxP + 7 * k, 0); gpi.addColorStop(0, '#b9c7ff'); gpi.addColorStop(1, '#5a6cb0');
      ctx.fillStyle = gpi; rr(ctx, pxP, top + 2, 10 * k, hb - 4, 3); ctx.fill();
      if (s.flash > 0 && !s.reduced) { ctx.fillStyle = `rgba(255,209,102,${s.flash * 0.55})`; ctx.fillRect(pxP - 3 * k, top + 2, 4 * k, hb - 4); }
      ctx.strokeStyle = '#8ea0cf'; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.moveTo(pxP + 10 * k, cyc); ctx.lineTo(cx0 + Lmax + 22 * k, cyc); ctx.stroke();
      ctx.fillStyle = '#8ea0cf'; rr(ctx, cx0 + Lmax + 22 * k, cyc - 18 * k, 8 * k, 36 * k, 3); ctx.fill();
      // ---- termómetro (izquierda) ----
      const tx = w * 0.075, tT = top - 4, tB = top + hb + 4, tw = 11 * k + 2;
      ctx.fillStyle = 'rgba(220,235,255,.08)'; rr(ctx, tx - tw / 2, tT, tw, tB - tT - 8, tw / 2); ctx.fill(); ctx.strokeStyle = '#b9c7ff'; ctx.lineWidth = 1.6; ctx.stroke();
      const lvl = tB - 8 - clamp((p.T - 100) / 900, 0, 1) * (tB - tT - 22);
      ctx.fillStyle = C.fuerza; ctx.fillRect(tx - 2.2 * k, lvl, 4.4 * k, tB - 8 - lvl); ctx.beginPath(); ctx.arc(tx, tB - 4, 6.5 * k, 0, TAU); ctx.fill();
      for (let T = 100; T <= 1000; T += 300) { const yy = tB - 8 - ((T - 100) / 900) * (tB - tT - 22); ctx.strokeStyle = '#b9c7ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx + tw / 2, yy); ctx.lineTo(tx + tw / 2 + 5, yy); ctx.stroke(); txt(ctx, String(T), tx + tw / 2 + 7, yy, { size: 9.5 * k, color: C.tenue, weight: 400 }); }
      txt(ctx, `${num(p.T, 0)} K`, tx, tT - 14 * k, { align: 'center', size: 12 * k, color: C.fuerza });
      txt(ctx, `${num(p.T - 273.15, 0)} °C`, tx, tT - 1, { align: 'center', size: 10 * k, color: C.tenue, weight: 400 });
      // ---- manómetro (derecha) ----
      const gx = w * 0.855, Rg = Math.min(w * 0.125, h * 0.27), gyc = h * 0.42;
      const gg = ctx.createRadialGradient(gx, gyc, Rg * 0.2, gx, gyc, Rg); gg.addColorStop(0, '#1a2756'); gg.addColorStop(1, '#0d1530');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(gx, gyc, Rg, 0, TAU); ctx.fill(); ctx.strokeStyle = '#b9c7ff'; ctx.lineWidth = 3; ctx.stroke();
      const a0 = (135 * Math.PI) / 180, span = (270 * Math.PI) / 180, nt = 5;
      for (let i = 0; i <= nt; i++) {
        const ang = a0 + (i / nt) * span, c = Math.cos(ang), sn = Math.sin(ang), val = (s.pmax * i) / nt;
        ctx.strokeStyle = i > nt * 0.85 ? C.fuerza : '#b9c7ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx + c * Rg * 0.82, gyc + sn * Rg * 0.82); ctx.lineTo(gx + c * Rg * 0.95, gyc + sn * Rg * 0.95); ctx.stroke();
        txt(ctx, val === 0 ? '0' : val >= 100 ? num(val, 0) : num(val, val < 10 ? 1 : 0), gx + c * Rg * 0.62, gyc + sn * Rg * 0.62, { align: 'center', size: 9.5 * k + 0.5, color: C.tenue, weight: 400 });
      }
      const fr = clamp(s.pn / s.pmax, 0, 1.03), na = a0 + fr * span;
      flecha(ctx, gx, gyc, gx + Math.cos(na) * Rg * 0.8, gyc + Math.sin(na) * Rg * 0.8, C.ambar, { lw: 3 * k, head: 8 });
      ctx.fillStyle = '#e6eeff'; ctx.beginPath(); ctx.arc(gx, gyc, 4 * k + 1, 0, TAU); ctx.fill();
      txt(ctx, 'P (kPa)', gx, gyc + Rg * 0.38, { align: 'center', size: 10 * k, color: C.tenue, weight: 400 });
      txt(ctx, `P = ${num(P, P < 10 ? 2 : P < 100 ? 1 : 0)} kPa`, gx, gyc + Rg + 16 * k, { align: 'center', size: 13 * k, color: C.ambar });
      txt(ctx, `V = ${num(s.Vc, 1)} L`, gx, gyc + Rg + 34 * k, { align: 'center', size: 11.5 * k, color: C.tenue });
      txt(ctx, `n = ${num(p.n, 1)} mol  ·  ${s.parts.length} partículas (≈0,025 mol c/u)`, cx0, top - 14 * k, { size: 11 * k, color: C.tenue, weight: 400 });
      txt(ctx, 'vitesse moyenne ∝ √T', cx0 + Lmax, top - 14 * k, { align: 'right', size: 11 * k, color: C.tenue, weight: 400 });
    },
    formula(p) {
      const Pa = gasP(p);
      return `PV=nRT\\;\\Rightarrow\\;P=\\dfrac{nRT}{V}=\\dfrac{${tnum(p.n, 1)}\\times8{,}314\\times${tnum(p.T, 0)}}{${tnum(p.V, 1)}\\times10^{-3}}=${tsci(Pa, 2)}\\ \\text{Pa}`;
    },
    lecturas(p) {
      const Pa = gasP(p);
      return [{ label: 'P', valor: `${num(Pa / 1000, Pa < 1e4 ? 2 : 1)} kPa` }, { label: 'R', valor: '8,314 J·K⁻¹·mol⁻¹' }, { label: 'n·R·T', valor: `${num(p.n * R_GAS * p.T, 0)} J` }, { label: 'T', valor: `${num(p.T - 273.15, 0)} °C` }];
    },
  });
})();
