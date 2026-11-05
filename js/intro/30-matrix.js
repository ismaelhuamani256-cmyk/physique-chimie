// =====================================================================================
// 30-matrix.js — INTRO-B · estilo de intro "matrix" (Canvas 2D)
//
// Lluvia de código verde fósforo sobre negro. Los actores "se forman" del código: cada
// actor es una nube de glifos distribuidos sobre su contorno que caen de la lluvia y se
// estabilizan. Vectores = líneas de glifos; trayectorias = rastros de puntos; `resalta`
// = brillo blanco + marco de "objetivo". Post: bloom barato (copia reducida en 'lighter'),
// scanlines y viñeta.
//
// API (CONTRATO §5b):  PCB.intro.registerStyle('matrix', { init(ctx) -> {update(S,dt),resize(w,h),dispose()} })
// Coordenadas de S: 0..1 (x derecha, y abajo) sobre un rectángulo 16:9 que se ajusta
// al host (el fondo de lluvia llena todo el host).
// =====================================================================================
(function () {
  'use strict';
  const PCB = (window.PCB = window.PCB || {});
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const fract = (x) => x - Math.floor(x);
  const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const reducedMotion = () => { try { return PCB.util && PCB.util.reducedMotion ? PCB.util.reducedMotion() : false; } catch (e) { return false; } };

  function registrar(id, def) {
    PCB.intro = PCB.intro || {};
    if (typeof PCB.intro.registerStyle === 'function') PCB.intro.registerStyle(id, def);
    else (PCB.intro._pendientes = PCB.intro._pendientes || []).push([id, def]);
  }

  // ---------- conjunto de glifos ----------
  const KATA = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
  const BASE = '0123456789ABCDEFHKMNPRSTVXZ:.=*+-<>|¦Δ∑π∫∂√Ωλμνρθφ≈±∞';
  // fragmentos de fórmulas/unidades que a veces caen por una columna
  const FRAGS = ['F=ma', 'E=mc2', 'PV=nRT', 'pH', 'mol', 'm/s', 'Δx/Δt', 'C=n/V', 'ΣF=0', 'λ=v/f', 'Q=mcΔT', 'U=RI', 'kg', 'N.m', 'Ec', 'Hz', 'eV', 'H2O', 'Ka', 'A=εlc'];
  let GL = null;           // lista de glifos (strings de 1 carácter)
  let GI = null;           // carácter -> índice
  function inicGlifos() {
    if (GL) return;
    let kata = '';
    try { // detecta si hay fuente con katakana (si no, se dibujaría "tofu")
      const c = document.createElement('canvas'); c.width = c.height = 24; const g = c.getContext('2d'); g.font = '20px monospace';
      g.fillText('ｱ', 2, 20); const a = g.getImageData(0, 0, 24, 24).data.join(); g.clearRect(0, 0, 24, 24); g.fillText('ﾈ', 2, 20); const b = g.getImageData(0, 0, 24, 24).data.join();
      if (a !== b && /[1-9]/.test(a)) kata = KATA;
    } catch (e) {}
    const set = new Set([...(kata + BASE + 'oO°·x#abcdefghijklmnopqrstuvwxyz')]);
    FRAGS.join('').split('').forEach((c) => set.add(c));
    GL = [...set]; GI = {}; GL.forEach((c, i) => { GI[c] = i; });
  }
  const gi = (ch) => (GI[ch] != null ? GI[ch] : 0);

  // ---------- atlas de glifos por color (caché con límite) ----------
  const CELL = 30;
  const atlas = {}, atlasOrden = [];
  function atlasDe(hex) {
    let a = atlas[hex]; if (a) return a;
    const cols = 16, rows = Math.ceil(GL.length / cols), cv = document.createElement('canvas'); cv.width = cols * CELL; cv.height = rows * CELL;
    const g = cv.getContext('2d'); g.font = `bold ${CELL - 8}px "MS Gothic","Noto Sans Mono CJK JP","DejaVu Sans Mono",monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = hex;
    GL.forEach((ch, i) => g.fillText(ch, (i % cols) * CELL + CELL / 2, ((i / cols) | 0) * CELL + CELL / 2 + 1));
    a = atlas[hex] = { cv, cols }; atlasOrden.push(hex);
    if (atlasOrden.length > 28) { const v = atlasOrden.shift(); delete atlas[v]; }
    return a;
  }
  const hex2 = (n) => (n < 16 ? '0' : '') + n.toString(16);
  /** Mezcla verde-matrix con el color del actor (35 %) y cuantiza para no crear mil atlas */
  function tinte(color, k, base) {
    base = base || [43, 255, 106];
    let r = base[0], g = base[1], b = base[2];
    if (color && /^#[0-9a-f]{6}$/i.test(color)) {
      const cr = parseInt(color.slice(1, 3), 16), cg = parseInt(color.slice(3, 5), 16), cb = parseInt(color.slice(5, 7), 16);
      const esBlanco = cr > 235 && cg > 235 && cb > 235;
      if (!esBlanco) { r = lerp(r, cr, k); g = lerp(g, cg, k); b = lerp(b, cb, k); }
    }
    const q = (v) => Math.min(255, Math.round(v / 51) * 51);
    return '#' + hex2(q(r)) + hex2(q(g)) + hex2(q(b));
  }

  // =====================================================================================
  //  Siluetas: nubes de puntos [x, y, categoría] en coordenadas locales (unidad ≈ 1, y hacia abajo)
  //   categoría 0 = cuerpo (verde), 1 = detalle (verde claro), 2 = acento brillante (blanco), 3 = alerta (rojo)
  // =====================================================================================
  const ST = 0.1; // separación entre glifos del contorno
  const P_ = { // primitivas que rellenan un array plano
    line(o, x0, y0, x1, y1, k, st) { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / (st || ST))); for (let i = 0; i <= n; i++) o.push(lerp(x0, x1, i / n), lerp(y0, y1, i / n), k); },
    arc(o, cx, cy, rx, ry, a0, a1, k, st) { const n = Math.max(3, Math.round(Math.abs(a1 - a0) * Math.max(rx, ry) / (st || ST))); for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); o.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, k); } },
    poly(o, pts, k, cerrar, st) { for (let i = 0; i < pts.length - (cerrar ? 0 : 1); i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; P_.line(o, p[0], p[1], q[0], q[1], k, st); } },
    disco(o, cx, cy, r, k, st) { st = st || ST * 1.7; for (let rr = 0; rr <= r; rr += st) { const n = Math.max(1, Math.round(TAU * rr / st)); for (let i = 0; i < (rr ? n : 1); i++) { const a = (i / n) * TAU + rr * 3; o.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, k); } } },
    relleno(o, x, y, w, h, k, st) { st = st || ST * 1.8; for (let yy = y; yy <= y + h + 1e-6; yy += st) for (let xx = x; xx <= x + w + 1e-6; xx += st) o.push(xx + (hash(xx * 13 + yy * 7) - 0.5) * st * 0.5, yy + (hash(xx * 5 + yy * 17) - 0.5) * st * 0.5, k); },
  };
  const FORMAS = {
    auto(o) {
      P_.poly(o, [[-1.1, 0.25], [1.1, 0.25], [1.1, -0.05], [0.65, -0.12], [0.32, -0.55], [-0.55, -0.55], [-0.82, -0.12], [-1.1, -0.05]], 0, true);
      P_.poly(o, [[-0.45, -0.46], [0.24, -0.46], [0.5, -0.15], [-0.62, -0.15]], 1, true); P_.line(o, -0.1, -0.46, -0.1, -0.15, 1);
      [-0.65, 0.65].forEach((x) => { P_.arc(o, x, 0.3, 0.28, 0.28, 0, TAU, 0); P_.disco(o, x, 0.3, 0.1, 2); });
      P_.relleno(o, 0.95, -0.02, 0.15, 0.14, 2); P_.relleno(o, -1.1, -0.02, 0.1, 0.14, 3, 0.07);
    },
    perro(o) {
      P_.poly(o, [[-0.7, -0.22], [0.35, -0.22], [0.35, 0.2], [-0.7, 0.2]], 0, true); P_.relleno(o, -0.6, -0.12, 0.85, 0.22, 0);
      P_.arc(o, 0.62, -0.32, 0.27, 0.25, 0, TAU, 0); P_.relleno(o, 0.82, -0.28, 0.3, 0.16, 1); P_.disco(o, 1.1, -0.26, 0.05, 2);
      P_.poly(o, [[0.45, -0.52], [0.5, -0.8], [0.62, -0.52]], 1, true); P_.disco(o, 0.7, -0.38, 0.04, 2);
      P_.arc(o, -0.95, -0.15, 0.3, 0.35, -PI * 0.6, -PI * 0.05, 1);
    },
    humano(o) {
      P_.arc(o, 0, -1.05, 0.26, 0.26, 0, TAU, 0); P_.disco(o, 0.1, -1.08, 0.03, 2); P_.disco(o, -0.1, -1.08, 0.03, 2);
      P_.line(o, 0, -0.78, 0, 0.05, 0); P_.line(o, -0.3, -0.62, 0.3, -0.62, 0); P_.relleno(o, -0.17, -0.55, 0.34, 0.5, 1, 0.16);
    },
    cohete(o) {
      P_.poly(o, [[0, -1.6], [0.36, -0.8], [0.4, 0.5], [0.3, 0.9], [-0.3, 0.9], [-0.4, 0.5], [-0.36, -0.8]], 0, true);
      P_.arc(o, 0, -0.35, 0.17, 0.17, 0, TAU, 2); P_.relleno(o, -0.1, -0.5, 0.2, 0.3, 1, 0.1);
      P_.poly(o, [[-0.4, 0.2], [-0.75, 0.95], [-0.4, 0.75]], 1, true); P_.poly(o, [[0.4, 0.2], [0.75, 0.95], [0.4, 0.75]], 1, true);
    },
    planeta(o) {
      P_.arc(o, 0, 0, 1.1, 1.1, 0, TAU, 0); P_.disco(o, 0, 0, 1.0, 0, 0.16);
      for (let i = -2; i <= 2; i++) { const y = i * 0.38, hw = Math.sqrt(Math.max(0, 1.1 * 1.1 - y * y)); P_.line(o, -hw, y, hw, y, 1, 0.14); }
      P_.arc(o, 0, 0, 1.7, 0.45, 0, TAU, 2, 0.12);
    },
    luna(o) {
      P_.arc(o, 0, 0, 0.62, 0.62, 0, TAU, 0); P_.disco(o, 0, 0, 0.55, 0, 0.15);
      [[-0.2, -0.15, 0.14], [0.22, 0.12, 0.1], [0.05, 0.3, 0.07]].forEach((c) => P_.arc(o, c[0], c[1], c[2], c[2], 0, TAU, 1, 0.07));
    },
    bola(o) { P_.arc(o, 0, 0, 0.5, 0.5, 0, TAU, 0); P_.disco(o, 0, 0, 0.42, 0, 0.14); P_.disco(o, -0.17, -0.17, 0.08, 2); },
    vaso(o) {
      P_.poly(o, [[-0.8, -0.95], [-0.7, 0.95], [0.7, 0.95], [0.8, -0.95]], 0, false);
      P_.relleno(o, -0.66, -0.1, 1.32, 1.0, 1, 0.16); P_.line(o, -0.74, -0.1, 0.74, -0.1, 2);
    },
    tubo_ensayo(o) {
      P_.line(o, -0.4, -1.5, -0.4, 0.8, 0); P_.line(o, 0.4, -1.5, 0.4, 0.8, 0); P_.arc(o, 0, 0.8, 0.4, 0.4, 0, PI, 0);
      P_.relleno(o, -0.33, -0.2, 0.66, 1.0, 1, 0.15); P_.line(o, -0.38, -0.2, 0.38, -0.2, 2); P_.line(o, -0.46, -1.5, 0.46, -1.5, 1);
    },
    lente(o) {
      P_.arc(o, -0.9, 0, 1.2, 1.3, -0.62, 0.62, 0); P_.arc(o, 0.9, 0, 1.2, 1.3, PI - 0.62, PI + 0.62, 0);
      P_.line(o, -1.8, 0, 1.8, 0, 1, 0.18); [-1.6, 1.6].forEach((x) => P_.disco(o, x, 0, 0.05, 2));
    },
    flecha(o) { P_.line(o, -1.1, 0, 0.7, 0, 0); P_.poly(o, [[0.6, -0.3], [1.2, 0], [0.6, 0.3]], 2, true); },
    bloque(o) { P_.poly(o, [[-0.8, -0.5], [0.8, -0.5], [0.8, 0.5], [-0.8, 0.5]], 0, true); P_.relleno(o, -0.7, -0.4, 1.4, 0.8, 1, 0.2); P_.line(o, -0.8, -0.5, 0.8, 0.5, 2, 0.16); },
    rayo(o) { P_.line(o, -1.5, 0, 1.4, 0, 2, 0.12); P_.poly(o, [[1.2, -0.18], [1.6, 0], [1.2, 0.18]], 2, false); },
  };
  // formas con partes dinámicas (se calculan cada frame): reciben (emit, t, a, estado)
  const DINAMICAS = {
    perro(em, t, a, st) {
      const v = Math.hypot(a.vx || 0, a.vy || 0) * 14, amp = clamp(v * 0.25, 0, 0.7), f = t * (2 + v * 3);
      [[-0.6, 0], [-0.3, 1], [0.1, 1], [0.35, 0]].forEach(([x, fase]) => { const s = Math.sin(f + fase * PI) * amp * 0.4; P_.line(emS(em), x, 0.2, x + s, 0.78, 0, 0.1); });
    },
    humano(em, t, a) {
      const v = Math.hypot(a.vx || 0, a.vy || 0) * 14, amp = clamp(v * 0.25, 0, 0.7), f = t * (2 + v * 2.4), s = Math.sin(f) * amp * 0.5;
      const o = emS(em);
      P_.line(o, 0, 0.05, -0.1 + s, 0.95, 0, 0.1); P_.line(o, 0, 0.05, 0.1 - s, 0.95, 0, 0.1);
      const h = a.hablando ? Math.sin(t * 6) * 0.3 : 0;
      P_.line(o, -0.3, -0.62, -0.38 - s * 0.6, -0.05 - h, 0, 0.1); P_.line(o, 0.3, -0.62, 0.38 + s * 0.6, -0.05, 0, 0.1);
    },
    cohete(em, t, a, st) {
      const o = emS(em), v = Math.hypot(a.vx || 0, a.vy || 0), I = v > 0.015 ? 1 : 0.55, fl = 0.8 + 0.25 * Math.sin(t * 38) + 0.1 * Math.sin(t * 23);
      for (let i = 0; i < 26; i++) { const u = fract(t * 2.6 + hash(i) ), w = (1 - u) * 0.34 * (hash(i + 5) - 0.5) * 2; o.push(w, 0.95 + u * 1.5 * I * fl, u < 0.35 ? 2 : 3); }
    },
    atomo(em, t, a, st) {
      const o = emS(em), Z = clamp(st.Z || 6, 1, 18);
      P_.disco(o, 0, 0, 0.24, 2, 0.1);
      const capas = []; let r = Z; for (const c of [2, 8, 8]) { if (r <= 0) break; capas.push(Math.min(c, r)); r -= c; }
      capas.forEach((n, k) => {
        const rx = 0.85 + 0.55 * k, ry = rx * 0.38, ang = k * 1.05 - 0.5, ca = Math.cos(ang), sa = Math.sin(ang);
        for (let i = 0; i < 26 + 8 * k; i++) { const u = (i / (26 + 8 * k)) * TAU, x = Math.cos(u) * rx, y = Math.sin(u) * ry; o.push(x * ca - y * sa, x * sa + y * ca, 0); }
        for (let e = 0; e < Math.min(n, 4); e++) { const u = t * (1.8 / (1 + 0.5 * k)) + (e / Math.min(n, 4)) * TAU, x = Math.cos(u) * rx, y = Math.sin(u) * ry; o.push(x * ca - y * sa, x * sa + y * ca, 2); o.push(x * ca - y * sa + 0.05, x * sa + y * ca, 2); }
      });
    },
    electron(em, t) { const o = emS(em); P_.disco(o, 0, 0, 0.2, 2, 0.1); P_.arc(o, 0, 0, 0.32 + 0.04 * Math.sin(t * 8), 0.32, 0, TAU, 0, 0.12); },
    pendulo(em, t, a) {
      const o = emS(em), th = Math.abs(a.rot || 0) > 0.01 ? 0 : 0.5 * Math.sin(t * 2.4), L = 1.9, px = 0, py = -1.45;
      const bx = px + Math.sin(th) * L, by = py + Math.cos(th) * L;
      P_.line(o, -0.7, py, 0.7, py, 1, 0.12); P_.line(o, px, py, bx, by, 0, 0.1); P_.arc(o, bx, by, 0.3, 0.3, 0, TAU, 0, 0.1); P_.disco(o, bx, by, 0.22, 2, 0.14);
    },
    resorte(em, t) {
      const o = emS(em), len = 2.2 * (1 + 0.25 * Math.sin(t * 3.2)), x0 = -1.2, n = 18;
      P_.line(o, x0 - 0.1, -0.6, x0 - 0.1, 0.6, 1, 0.1);
      for (let i = 0; i <= n * 3; i++) { const u = i / (n * 3); o.push(x0 + u * len, Math.sin(u * n * PI) * 0.3, 0); }
      P_.relleno(o, x0 + len, -0.33, 0.6, 0.66, 2, 0.13);
    },
    onda(em, t, a, st) {
      const o = emS(em), red = st.red ? 0 : 1;
      for (let i = 0; i <= 56; i++) { const x = -1.9 + (i / 56) * 3.8, y = 0.45 * Math.sin(x * 4.2 - t * 3.2 * red); o.push(x, y, i % 9 === 0 ? 2 : 0); if (i % 4 === 0) o.push(x, y * 0.5, 1); }
    },
    resorteDummy() {},
    circuito(em, t) {
      const o = emS(em), w = 1.7, h = 1.0;
      P_.line(o, -w, -h, w, -h, 0); P_.line(o, -w, h, -0.3, h, 0); P_.line(o, 0.3, h, w, h, 0); P_.line(o, -w, -h, -w, -0.2, 0); P_.line(o, -w, 0.2, -w, h, 0); P_.line(o, w, -h, w, -0.35, 0); P_.line(o, w, 0.35, w, h, 0);
      P_.line(o, -w - 0.28, -0.2, -w + 0.28, -0.2, 2, 0.1); P_.line(o, -w - 0.15, 0.2, -w + 0.15, 0.2, 1, 0.1);
      P_.arc(o, 0, h, 0.3, 0.3, 0, TAU, 1, 0.09); P_.disco(o, 0, h, 0.12 + 0.05 * Math.sin(t * 5), 2, 0.12);
      for (let i = 0; i <= 6; i++) o.push(w + (i % 2 ? 0.2 : -0.2), -0.35 + (i / 6) * 0.7, 1);
      const per = 4 * w + 4 * h; for (let i = 0; i < 12; i++) { let d = fract(t * 0.1 + i / 12) * per, x, y; if (d < 2 * w) { x = -w + d; y = -h; } else if ((d -= 2 * w) < 2 * h) { x = w; y = -h + d; } else if ((d -= 2 * h) < 2 * w) { x = w - d; y = h; } else { d -= 2 * w; x = -w; y = h - d; } o.push(x, y, 2); }
    },
    fluido(em, t) {
      const o = emS(em), rad = (x) => 0.55 - 0.25 * Math.exp(-Math.pow(x / 0.75, 2));
      for (let i = 0; i <= 40; i++) { const x = -2.1 + (i / 40) * 4.2; o.push(x, -rad(x), 0, x, rad(x), 0); }
      for (let i = 0; i < 40; i++) { let x = fract(t * 0.12 * (i % 3 + 1) * 0.35 + hash(i)) * 4.2 - 2.1; const r = rad(x); o.push(x, (hash(i + 9) - 0.5) * 1.5 * r, 2); }
    },
    termometro(em, t) {
      const o = emS(em), lv = 0.55 + 0.4 * Math.sin(t * 0.7 - 1.2);
      P_.line(o, -0.14, -1.3, -0.14, 0.95, 0); P_.line(o, 0.14, -1.3, 0.14, 0.95, 0); P_.arc(o, 0, -1.2 + 2.2, 0.3, 0.3, 0, TAU, 0, 0.1); P_.arc(o, 0, -1.3, 0.14, 0.14, PI, TAU, 0);
      P_.disco(o, 0, 1.2, 0.22, 3, 0.12); P_.line(o, 0, 0.95, 0, 0.95 - (0.3 + lv * 2.0), 3, 0.09);
      for (let i = 0; i < 8; i++) P_.line(o, 0.2, -1.1 + i * 0.28, i % 4 ? 0.3 : 0.4, -1.1 + i * 0.28, 1, 0.1);
    },
    tubo_ensayo(em, t, a) { burbujasDin(em, t, 0.28, -0.2, 0.8, 5); },
    vaso(em, t, a) { burbujasDin(em, t, 0.55, -0.1, 0.9, 7); },
    texto() {},
  };
  const emS = (em) => em; // alias (los emisores escriben directo en el array plano)
  function burbujasDin(o, t, ancho, y0, y1, n) { for (let i = 0; i < n; i++) { const u = fract(t * (0.25 + 0.2 * hash(i)) + hash(i + 3)); o.push((hash(i + 8) - 0.5) * 2 * ancho + Math.sin(t * 3 + i) * 0.03, y1 - u * (y1 - y0), 2); } }
  const RADIO = { auto: 1.25, perro: 1.1, humano: 1.2, cohete: 1.6, planeta: 1.8, luna: 0.7, bola: 0.55, vaso: 1.1, tubo_ensayo: 1.6, lente: 1.9, flecha: 1.3, bloque: 1.0, rayo: 1.6, atomo: 2.0, ion: 0.7, electron: 0.45, molecula: 1.3, circuito: 2.1, pendulo: 1.9, resorte: 1.9, onda: 2.1, fluido: 2.3, termometro: 1.5, texto: 1 };

  // ---------- moléculas en 2D (usa la biblioteca de 40-quimica3d.js si está) ----------
  function moleculaPlana(spec) {
    const L = PCB.intro3d;
    let m = null;
    if (L && L.resolverMolecula) { try { m = L.resolverMolecula(spec); } catch (e) {} }
    if (!m) m = { atomos: [{ el: 'O', p: [0, 0.2, 0] }, { el: 'H', p: [-0.78, -0.4, 0] }, { el: 'H', p: [0.78, -0.4, 0] }], enlaces: [[0, 1, 1], [0, 2, 1]], carga: 0 };
    return m;
  }
  const RAT = { H: 0.3, C: 0.45, N: 0.43, O: 0.42, Cl: 0.55, Na: 0.6, S: 0.52 };

  // =====================================================================================
  //  Estilo
  // =====================================================================================
  registrar('matrix', {
    init(ctx) {
      inicGlifos();
      const reduced = ctx.reduced !== undefined ? !!ctx.reduced : reducedMotion();
      const host = ctx.host, defs = {};
      ((ctx.guion && ctx.guion.actores) || []).forEach((d) => { defs[d.id] = d; });
      const wrap = document.createElement('div');
      wrap.className = 'intro-matrix-wrap';
      wrap.style.cssText = 'position:absolute;inset:0;overflow:hidden;z-index:0;background:#000';
      const cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      wrap.appendChild(cv);
      try { if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; } catch (e) {}
      host.insertBefore(wrap, host.firstChild);
      const g = cv.getContext('2d');
      const dpr = Math.min(ctx.dpr || window.devicePixelRatio || 1, 1.5);

      // lienzos auxiliares: bloom (copia reducida), scanlines, viñeta
      const bloom = document.createElement('canvas'), bg = bloom.getContext('2d');
      const scan = document.createElement('canvas'), vig = document.createElement('canvas');
      let Wd = 0, Hd = 0;            // tamaño CSS
      let bx = 0, by = 0, bw = 0, bh = 0; // rectángulo 16:9
      let cols = 0, cw = 16, rows = 0, ch = 18, drops = [];

      // ---------- lluvia ----------
      function nuevaGota(c, inicial) {
        const d = drops[c] || (drops[c] = { chars: [], frag: null });
        d.y = inicial ? Math.random() * rows * 1.2 - rows * 0.2 : -Math.random() * rows * 0.6;
        d.v = (reduced ? 4 : 7) + Math.random() * (reduced ? 9 : 20); d.len = 8 + Math.floor(Math.random() * 20);
        d.frag = Math.random() < 0.13 ? FRAGS[(Math.random() * FRAGS.length) | 0] : null;
        if (!d.chars.length) for (let r = 0; r < rows + 30; r++) d.chars[r] = (Math.random() * GL.length) | 0;
        d.alpha = 0.45 + Math.random() * 0.5;
      }
      function resize(w, h) {
        Wd = w || wrap.clientWidth || 960; Hd = h || wrap.clientHeight || 540;
        cv.width = Math.round(Wd * dpr); cv.height = Math.round(Hd * dpr);
        const aspect = 16 / 9; bw = Math.min(Wd, Hd * aspect); bh = bw / aspect; bx = (Wd - bw) / 2; by = (Hd - bh) / 2;
        cw = clamp(Wd / (reduced ? 44 : 66), 11, 24); ch = cw * 1.15; cols = Math.ceil(Wd / cw); rows = Math.ceil(Hd / ch);
        drops = []; for (let c = 0; c < cols; c++) nuevaGota(c, true);
        bloom.width = Math.max(2, Math.round(cv.width / 7)); bloom.height = Math.max(2, Math.round(cv.height / 7));
        scan.width = 4; scan.height = Math.max(3, Math.round(3 * dpr)); const sg = scan.getContext('2d'); sg.clearRect(0, 0, 4, scan.height); sg.fillStyle = 'rgba(0,0,0,.22)'; sg.fillRect(0, scan.height - Math.max(1, Math.round(dpr)), 4, Math.max(1, Math.round(dpr)));
        vig.width = 256; vig.height = 144; const vg = vig.getContext('2d'), gr = vg.createRadialGradient(128, 72, 40, 128, 72, 150); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.7)'); vg.fillStyle = gr; vg.fillRect(0, 0, 256, 144);
      }
      resize(ctx.w, ctx.h);
      let ro = null, rw = 0, rh = 0;
      if (window.ResizeObserver) { ro = new ResizeObserver(() => { if (wrap.clientWidth !== rw || wrap.clientHeight !== rh) { rw = wrap.clientWidth; rh = wrap.clientHeight; if (rw && rh) resize(rw, rh); } }); ro.observe(wrap); }

      const aRain = atlasDe('#2bff6b'), aHead = atlasDe('#e6ffee');
      function lluvia(dt, t) {
        const sz = cw * 0.95, glifoDe = (c, r) => drops[c].chars[((r % drops[c].chars.length) + drops[c].chars.length) % drops[c].chars.length];
        for (let c = 0; c < cols; c++) {
          const d = drops[c]; d.y += d.v * dt;
          if (d.y - d.len > rows + 2) { nuevaGota(c, false); continue; }
          const x = c * cw + cw / 2, head = Math.floor(d.y);
          for (let k = 0; k < d.len; k++) {
            const r = head - k; if (r < 0 || r >= rows) continue;
            let idx = glifoDe(c, r);
            if (d.frag && k < d.frag.length) idx = gi(d.frag[d.frag.length - 1 - k]);
            else if (!reduced && Math.random() < 0.012) { idx = (Math.random() * GL.length) | 0; d.chars[r] = idx; }
            const f = 1 - k / d.len, a = (k === 0 ? 0.95 : Math.pow(f, 1.5) * d.alpha) * 0.62;
            const at = k === 0 ? aHead : aRain;
            g.globalAlpha = a; g.drawImage(at.cv, (idx % at.cols) * CELL, ((idx / at.cols) | 0) * CELL, CELL, CELL, x - sz / 2, r * ch + ch / 2 - sz / 2, sz, sz);
          }
        }
        g.globalAlpha = 1;
      }

      // ---------- proyección de coordenadas ----------
      let camZ = 1, camX = 0.5, camY = 0.5, U = 70;
      const px = (nx) => bx + ((nx - camX) * camZ + 0.5) * bw;
      const py = (ny) => by + ((ny - camY) * camZ + 0.5) * bh;

      // ---------- actores ----------
      const ents = {}; let lastT = 0;
      const tmp = [];
      function crearEnt(id, a) {
        const spec = Object.assign({}, defs[id] || {}); for (const k in a) if (a[k] != null) spec[k] = a[k];
        const tipo = spec.tipo; const e = { id, spec, tipo, t0: null, face: 1, ang: 0, st: {}, radio: RADIO[tipo] || 1.2, pts: null, ov: null, hablaTxt: null, hablaT: 0, mol: null };
        const o = [];
        if (FORMAS[tipo]) FORMAS[tipo](o);
        if (tipo === 'molecula') {
          const m = e.mol = moleculaPlana(spec); let rm = 0.6;
          m.atomos.forEach((at) => { rm = Math.max(rm, Math.hypot(at.p[0], at.p[1]) * 1.1 + 0.5); });
          e.radio = rm + 0.3;
        }
        if (tipo === 'ion') {
          const p = PCB.intro3d && PCB.intro3d.parseFormula ? PCB.intro3d.parseFormula(spec.formula || spec.texto || spec.etiqueta || spec.nombre || spec.id) : null;
          let carga = spec.carga != null ? (typeof spec.carga === 'number' ? spec.carga : (PCB.intro3d && PCB.intro3d.parseFormula && (PCB.intro3d.parseFormula('X' + spec.carga) || {}).carga) || 1) : p ? p.carga : 0;
          e.el = (p && p.orden[0]) || 'Na'; e.carga = carga || (/^(Cl|F|Br|I|O)/.test(e.el) ? -1 : 1);
          P_.arc(o, 0, 0, 0.55, 0.55, 0, TAU, 0); P_.disco(o, 0, 0, 0.48, 0, 0.15); P_.arc(o, 0, 0, 0.8, 0.8, 0, TAU, 1, 0.16);
        }
        if (tipo === 'atomo') { const L = PCB.intro3d; const Z = +(spec.Z || spec.z) || 0; let z = Z; if (!z) { for (const c of [spec.elemento, spec.simbolo, spec.formula, spec.texto, spec.etiqueta, spec.nombre]) { if (!c) continue; const SYM = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar'.split(' '); const i = SYM.indexOf(String(c).replace(/[^A-Za-z]/g, '')); if (i >= 0) { z = i + 1; break; } } } e.st.Z = z || 6; }
        e.pts = new Float32Array(o); e.n = o.length / 3;
        return e;
      }
      function glifoActor(at, idx, x, y, sz, alpha) { g.globalAlpha = alpha; g.drawImage(at.cv, (idx % at.cols) * CELL, ((idx / at.cols) | 0) * CELL, CELL, CELL, x - sz / 2, y - sz / 2, sz, sz); }

      /** Dibuja una nube de puntos locales. fm = formación 0..1; res = resaltado */
      function nube(e, arr, n, X, Y, rot, sc, flipX, alpha, fm, res, t, a, offset, tintes) {
        const cr = Math.cos(rot), sr = Math.sin(rot), gs = clamp(U * 0.17 * (1 + 0.3 * res), 8, 26) * Math.max(0.6, Math.min(1.4, sc / U));
        for (let i = 0; i < n; i++) {
          let lx = arr[i * 3] * flipX, ly = arr[i * 3 + 1]; const k = arr[i * 3 + 2];
          const seed = (i + offset) * 1.37, d = hash(seed), u = smooth(0, 1, clamp((fm * 1.6 - d * 0.9) / 0.7, 0, 1));
          if (u <= 0) continue;
          let X0 = X + (lx * cr - ly * sr) * sc, Y0 = Y + (lx * sr + ly * cr) * sc;
          let al = alpha * (0.3 + 0.7 * u);
          if (u < 1) { const e2 = 1 - u; X0 += (hash(seed + 3) - 0.5) * U * 1.2 * e2; Y0 -= e2 * e2 * (120 + hash(seed + 5) * 260); }
          const flick = reduced ? 0 : Math.floor(t * (1.4 + hash(seed + 1) * 2) + hash(seed + 2) * 20);
          const idx = (Math.floor(hash(seed + 4) * 997) + flick * 31) % GL.length;
          let at;
          if (u < 0.999) at = tintes.blanco; else if (res > 0.5 && k < 2) at = tintes.blanco; else at = k === 0 ? tintes.cuerpo : k === 1 ? tintes.claro : k === 2 ? tintes.blanco : tintes.rojo;
          if (k === 3 && !a.frenando && e.tipo === 'auto') at = tintes.cuerpo;
          glifoActor(at, idx, X0, Y0, gs * (k === 2 ? 1.15 : 1), al * (k === 1 ? 0.8 : 1));
        }
      }

      function dibujarActor(e, a, t, dt, zi) {
        const alphaS = a.alpha != null ? a.alpha : 1;
        let vis = a.visible !== false && alphaS > 0.01;
        if (e.forzar) vis = true;
        if (e.oculto) vis = false;
        if (!vis) { e.t0 = null; return; }
        if (e.t0 == null) e.t0 = t;
        let fm = clamp((t - e.t0) / 1.5, 0, 1);
        if (e.ov != null) fm = e.ov;
        const X = px(a.x), Y = py(a.y), sc = U * (a.escala != null ? a.escala : 1) * camZ;
        let rot = (a.rot || 0) * PI / 180;
        const vx = a.vx || 0, vy = a.vy || 0, sp = Math.hypot(vx * 16, vy * 9);
        if (Math.abs(vx) > 0.01 && (e.tipo === 'auto' || e.tipo === 'perro' || e.tipo === 'humano')) e.face += ((vx < 0 ? -1 : 1) - e.face) * Math.min(1, dt * 8);
        const flipX = e.tipo === 'auto' || e.tipo === 'perro' || e.tipo === 'humano' ? (e.face < 0 ? -1 : 1) : 1;
        if (e.tipo === 'cohete') { const tgt = sp > 0.4 ? Math.atan2(-vy * 9, vx * 16) - 0 : PI / 2; const rel = PI / 2 - tgt; let d = ((rel - e.ang + PI) % TAU + TAU) % TAU - PI; e.ang += d * Math.min(1, dt * 5); rot += e.ang; }
        const res = clamp(a.resaltado || 0, 0, 1);
        const col = a.color || e.spec.color;
        const tintes = { cuerpo: atlasDe(tinte(col, 0.35)), claro: atlasDe(tinte(col, 0.2, [184, 255, 203])), blanco: atlasDe('#f2fff6'), rojo: atlasDe('#ff5a5a') };
        const al = e.forzar && alphaS < 0.01 ? 1 : alphaS;
        // sacudida/estela al moverse
        if (!reduced && sp > 0.5 && e.n) {
          for (let k = 1; k <= 3; k++) {
            const gx = X - vx * 16 * U * 0.035 * k * camZ, gy = Y - vy * 9 * U * 0.035 * k * camZ;
            const sub = Math.max(1, Math.floor(e.n / 7));
            nubeFantasma(e, e.pts, e.n, gx, gy, rot, sc, flipX, al * 0.5 / k, t, tintes, k, sub);
          }
        }
        if (e.tipo === 'texto') { dibujarTexto(e, a, X, Y, sc, fm, res, al, t); }
        else if (e.tipo === 'molecula') { dibujarMolecula(e, a, X, Y, sc, rot, fm, res, al, t, tintes); }
        else {
          if (e.n) nube(e, e.pts, e.n, X, Y, rot, sc, flipX, al, fm, res, t, a, 0, tintes);
          if (DINAMICAS[e.tipo] && fm > 0.35) {
            const em = e.dyn || (e.dyn = []); em.length = 0; e.st.red = reduced;
            DINAMICAS[e.tipo](em, t, a, e.st);
            // los puntos dinámicos comparten la formación (aparecen tras la estática)
            const cat = em; nube(e, cat, cat.length / 3, X, Y, rot, sc, flipX, al, Math.min(1, (fm - 0.35) / 0.65 + 0.001), res, t, a, 1000, tintes);
          }
          if (e.tipo === 'ion') dibujarIon(e, X, Y, sc, al, fm, t);
          if (e.tipo === 'auto' && a.frenando && !reduced) { for (let i = 0; i < 6; i++) { const u = fract(t * 3 + i / 6); glifoActor(tintes.rojo, gi('#'), X - flipX * (U * 1.0 + u * U * 1.4) * camZ, Y + sc * 0.58, 9, (1 - u) * 0.8 * al); } }
        }
        // marco de objetivo al resaltar
        if (res > 0.02) marco(X, Y, e.radio * sc * 1.25, res, t);
        // bocadillo
        e.hablaPend = a.hablando ? { txt: String(a.hablando), X, Y: Y - e.radio * sc * 0.95, al } : null;
        if (a.hablando !== e.hablaTxt) { e.hablaTxt = a.hablando || null; e.hablaT = t; }
      }
      function nubeFantasma(e, arr, n, X, Y, rot, sc, flipX, alpha, t, tintes, k, sub) {
        const cr = Math.cos(rot), sr = Math.sin(rot), gs = clamp(U * 0.15, 7, 22);
        for (let i = k % sub; i < n; i += sub) {
          const lx = arr[i * 3] * flipX, ly = arr[i * 3 + 1];
          glifoActor(tintes.cuerpo, ((i * 13 + k * 7) % GL.length), X + (lx * cr - ly * sr) * sc, Y + (lx * sr + ly * cr) * sc, gs, alpha);
        }
      }
      function marco(X, Y, r, res, t) {
        const p = 1 + 0.06 * Math.sin(t * 8), s = r * p, L = s * 0.35;
        g.globalAlpha = res; g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath();
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { g.moveTo(X + sx * s, Y + sy * (s - L)); g.lineTo(X + sx * s, Y + sy * s); g.lineTo(X + sx * (s - L), Y + sy * s); });
        g.stroke(); g.globalAlpha = 1;
      }
      function dibujarTexto(e, a, X, Y, sc, fm, res, al, t) {
        const txt = String(e.spec.texto || e.spec.etiqueta || e.spec.formula || e.spec.nombre || ''); if (!txt) return;
        g.save(); g.globalAlpha = al; g.font = `bold ${Math.round(clamp(sc * 0.42, 14, 60))}px "DejaVu Sans Mono",monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
        // "descifrado": los caracteres se resuelven de izquierda a derecha
        const n = txt.length, fijos = Math.floor(fm * (n + 2)); let s = '';
        for (let i = 0; i < n; i++) s += i < fijos || txt[i] === ' ' ? txt[i] : GL[(Math.floor(hash(i + Math.floor(t * 12)) * GL.length))];
        g.shadowColor = '#2bff6b'; g.shadowBlur = 10; g.fillStyle = res > 0.5 ? '#ffffff' : '#9dffb9'; g.fillText(s, X, Y); g.restore();
      }
      function dibujarIon(e, X, Y, sc, al, fm, t) {
        if (fm < 0.6) return;
        const q = e.carga, txt = (Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '−');
        g.save(); g.globalAlpha = al; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#fff'; g.shadowBlur = 8;
        g.fillStyle = '#ffffff'; g.font = `bold ${Math.round(sc * 0.5)}px "DejaVu Sans Mono",monospace`; g.fillText(e.el, X, Y);
        g.font = `bold ${Math.round(sc * 0.42)}px "DejaVu Sans Mono",monospace`; g.fillStyle = q > 0 ? '#ff8aa0' : '#8ab4ff'; g.fillText(txt, X + sc * 0.62, Y - sc * 0.62); g.restore();
      }
      function dibujarMolecula(e, a, X, Y, sc, rot, fm, res, al, t, tintes) {
        const m = e.mol, K = 0.95, cr = Math.cos(rot), sr = Math.sin(rot), ang = t * 0.5, ca = Math.cos(ang), sa = Math.sin(ang);
        const P = m.atomos.map((at) => { const x = at.p[0] * ca + at.p[2] * sa, z = -at.p[0] * sa + at.p[2] * ca, y = at.p[1]; return { x: (x * cr - y * sr) * K, y: (x * sr + y * cr) * K, z, el: at.el }; });
        const pp = [];
        (m.enlaces || []).forEach(([i, j, ord]) => {
          if (!ord) return; const dx = P[j].x - P[i].x, dy = P[j].y - P[i].y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
          const offs = ord === 1 ? [0] : ord === 2 ? [-0.07, 0.07] : [-0.12, 0, 0.12];
          offs.forEach((o) => P_.line(pp, P[i].x + nx * o, P[i].y + ny * o, P[j].x + nx * o, P[j].y + ny * o, 1, 0.1));
        });
        const orden = P.map((p, i) => i).sort((p, q) => P[p].z - P[q].z);
        nube(e, pp, pp.length / 3, X, Y, 0, sc, 1, al, fm, res, t, a, 500, tintes);
        orden.forEach((i) => {
          const r = (RAT[P[i].el] || 0.5) * 0.85, o = []; P_.arc(o, P[i].x, P[i].y, r, r, 0, TAU, 0, 0.1); P_.disco(o, P[i].x, P[i].y, r * 0.75, 0, 0.17);
          nube(e, o, o.length / 3, X, Y, 0, sc, 1, al * (0.8 + 0.2 * P[i].z), fm, res, t, a, 100 + i * 200, tintes);
          if (fm > 0.7) { g.save(); g.globalAlpha = al; g.fillStyle = '#ffffff'; g.shadowColor = '#2bff6b'; g.shadowBlur = 8; g.font = `bold ${Math.round(sc * 0.4)}px "DejaVu Sans Mono",monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(P[i].el, X + P[i].x * sc, Y + P[i].y * sc); g.restore(); }
        });
        if (m.carga && fm > 0.7) { const q = m.carga, txt = (Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '−'); g.save(); g.globalAlpha = al; g.fillStyle = q > 0 ? '#ff8aa0' : '#8ab4ff'; g.font = `bold ${Math.round(sc * 0.45)}px "DejaVu Sans Mono",monospace`; g.fillText(txt, X + e.radio * sc * 0.75, Y - e.radio * sc * 0.75); g.restore(); }
      }

      // ---------- vectores, trayectorias, partículas, bocadillos, reacciones ----------
      const GV = gi('='), GA = gi('>'), GP = gi('+'), GD = gi('-');
      const aBlanco = atlasDe('#f2fff6'), aClaro = atlasDe('#b8ffcb'), aVerde = atlasDe('#2bff6b');
      function vectores(S, t) {
        (S.vectores || []).forEach((v, vi) => {
          const e = ents[v.actor], a = S.actores && S.actores[v.actor]; if (!e || !a || a.visible === false) return;
          const al = v.alpha != null ? v.alpha : 1; if (al < 0.02) return;
          const x0 = px(a.x), y0 = py(a.y); let dx = (v.dx || 0) * bw * camZ, dy = (v.dy || 0) * bh * camZ; const L = Math.hypot(dx, dy); if (L < 2) return;
          const ux = dx / L, uy = dy / L, off = e.radio * U * (a.escala || 1) * camZ * 0.45, sx = x0 + ux * off, sy = y0 + uy * off, len = Math.min(L, Math.min(bw, bh) * 0.7);
          const n = Math.max(2, Math.floor(len / (U * 0.14))), gs = clamp(U * 0.2, 9, 24);
          for (let i = 0; i <= n; i++) {
            const f = i / n, flow = fract(f * 6 - t * 1.2), cx = sx + ux * len * f, cy = sy + uy * len * f;
            glifoActor(i === n ? aBlanco : flow < 0.15 ? aBlanco : aClaro, flow < 0.15 ? GP : Math.abs(ux) > Math.abs(uy) ? GV : GP, cx, cy, gs, al * (0.45 + 0.55 * f));
          }
          const tx = sx + ux * len, ty = sy + uy * len, ca = Math.cos(PI * 0.82), sa = Math.sin(PI * 0.82);
          for (let s = -1; s <= 1; s += 2) for (let i = 1; i <= 4; i++) {
            const rx = ux * Math.cos(s * 0.5) - uy * Math.sin(s * 0.5), ry = ux * Math.sin(s * 0.5) + uy * Math.cos(s * 0.5);
            glifoActor(aBlanco, GA, tx - rx * i * gs * 0.8, ty - ry * i * gs * 0.8, gs, al);
          }
          if (v.etiqueta) {
            const txt = String(v.etiqueta).replace(/\$/g, ''); g.save(); g.globalAlpha = al; const fs = Math.round(clamp(bh * 0.034, 12, 22)); g.font = `bold ${fs}px "DejaVu Sans Mono",monospace`;
            const tw = g.measureText(txt).width + 12, lx = tx + ux * 18 - tw / 2 + (Math.abs(ux) < 0.3 ? 0 : ux * tw / 2), ly = ty + uy * 18 - fs / 2 - 8;
            g.fillStyle = 'rgba(0,10,4,.82)'; g.fillRect(lx, ly - fs / 2 - 3, tw, fs + 8); g.strokeStyle = '#2bff6b'; g.lineWidth = 1; g.strokeRect(lx, ly - fs / 2 - 3, tw, fs + 8);
            g.fillStyle = '#eafff0'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(txt, lx + tw / 2, ly + 1); g.restore();
          }
        });
      }
      function trayectorias(S, t) {
        const T0 = S.trayectorias || {};
        for (const id in T0) {
          const pts = T0[id]; if (!pts || pts.length < 2) continue;
          const a = S.actores && S.actores[id]; const at = atlasDe(tinte(a && a.color, 0.4, [190, 255, 205]));
          let total = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot((pts[i][0] - pts[i - 1][0]) * bw, (pts[i][1] - pts[i - 1][1]) * bh); seg.push(d); total += d; }
          const paso = Math.max(11, U * 0.2), n = Math.floor(total / paso); let k = 0, acc = 0;
          for (let s = 0; s <= n; s++) {
            const dist = s * paso; while (k < seg.length - 1 && acc + seg[k] < dist) { acc += seg[k]; k++; }
            const f = seg[k] ? (dist - acc) / seg[k] : 0, x = lerp(pts[k][0], pts[k + 1][0], clamp(f, 0, 1)), y = lerp(pts[k][1], pts[k + 1][1], clamp(f, 0, 1));
            const q = s / Math.max(1, n); glifoActor(at, (s % 3 === 0) ? gi('*') : gi('·'), px(x), py(y), clamp(U * 0.2, 9, 20), 0.3 + 0.7 * q);
          }
        }
      }
      const SIMB = { burbujas: ['o', 'O', '°'], chispas: ['*', '+', 'x'], polvo: ['.', ':', '·'] };
      function particulas(S, t) {
        const ult = {}; (S.particulas || []).forEach((p) => { if (p.t0 <= t) (ult[p.tipo] = ult[p.tipo] || []).push(p); });
        for (const tipo in ult) {
          const lista = ult[tipo].slice(-8), N = reduced ? 10 : 24, life = tipo === 'chispas' ? 1.2 : tipo === 'burbujas' ? 3.4 : 2.8, sp = tipo === 'chispas' ? 0.025 : 0.09;
          const sy = SIMB[tipo] || SIMB.polvo, at = tipo === 'chispas' ? atlasDe('#ffe9a0') : aBlanco;
          lista.forEach((p, e) => {
            for (let k = 0; k < N; k++) {
              const age = t - (p.t0 + k * sp); if (age < 0 || age > life) continue; const u = age / life, sd = e * 97 + k * 13.7;
              let x = px(p.x), y = py(p.y), al = 1 - u;
              if (tipo === 'burbujas') { x += ((hash(sd) - 0.5) * 0.04 * bw) + Math.sin(age * 4 + sd) * 4; y -= age * U * (0.8 + hash(sd + 1) * 0.8); al = Math.sin(u * PI); }
              else if (tipo === 'chispas') { const a = hash(sd) * TAU, v = (1.5 + hash(sd + 1) * 3) * U; x += Math.cos(a) * v * age; y += Math.sin(a) * v * age + 3 * U * age * age; al = (1 - u) * (1 - u); }
              else { x += (hash(sd) - 0.5) * U * 1.2 * (0.3 + u); y -= age * U * 0.4; al = Math.sin(u * PI) * 0.6; }
              glifoActor(at, gi(sy[(k + e) % sy.length]), x, y, clamp(U * 0.2, 9, 20), al);
            }
          });
        }
      }
      function bocadillos(S, t) {
        for (const id in ents) {
          const e = ents[id]; const h = e.hablaPend; if (!h) continue;
          const txt = h.txt, nCar = Math.min(txt.length, Math.floor((t - e.hablaT) * 32)), fs = Math.round(clamp(bh * 0.032, 12, 20));
          g.save(); g.font = `bold ${fs}px "DejaVu Sans Mono",monospace`;
          const maxW = bw * 0.34, palabras = txt.split(' '), lin = []; let cur = '';
          palabras.forEach((w) => { const tt = cur ? cur + ' ' + w : w; if (g.measureText(tt).width > maxW && cur) { lin.push(cur); cur = w; } else cur = tt; }); if (cur) lin.push(cur);
          const tw = Math.max(...lin.map((l) => g.measureText(l).width)) + 20, th = lin.length * fs * 1.3 + 14;
          const bxx = clamp(h.X - tw / 2, bx + 6, bx + bw - tw - 6), byy = clamp(h.Y - th - 14, by + 6, by + bh - th - 6);
          g.globalAlpha = Math.min(1, h.al) * smooth(0, 0.25, t - e.hablaT);
          g.fillStyle = 'rgba(0,12,5,.9)'; g.fillRect(bxx, byy, tw, th); g.strokeStyle = '#2bff6b'; g.lineWidth = 2; g.strokeRect(bxx, byy, tw, th);
          g.fillStyle = '#2bff6b'; g.beginPath(); g.moveTo(h.X - 7, byy + th); g.lineTo(h.X, byy + th + 11); g.lineTo(h.X + 7, byy + th); g.fill();
          g.fillStyle = '#eafff0'; g.textBaseline = 'top'; let usados = 0;
          lin.forEach((l, i) => { const mostrar = l.slice(0, Math.max(0, nCar - usados)); usados += l.length + 1; g.fillText(mostrar, bxx + 10, byy + 8 + i * fs * 1.3); });
          if (nCar < txt.length && Math.floor(t * 4) % 2) { g.fillStyle = '#2bff6b'; g.fillRect(bxx + tw - 14, byy + th - 14, 7, 9); }
          g.restore();
        }
      }
      const hechas = new Set();
      function reaccionesPre(S) {
        for (const id in ents) { const e = ents[id]; e.ov = null; e.oculto = false; e.forzar = false; }
        const act = [];
        (S.reacciones || []).forEach((r, idx) => {
          const key = (r.de || []).join() + '>' + (r.a || []).join() + '#' + idx, p = r.progreso || 0;
          const de = (r.de || []).map((i) => ents[i]).filter(Boolean), pr = (r.a || []).map((i) => ents[i]).filter(Boolean);
          if (p >= 1) hechas.add(key);
          if (p > 0 && p < 1) { de.forEach((e) => { e.ov = 1 - smooth(0, 0.55, p); }); pr.forEach((e) => { e.ov = smooth(0.45, 1, p); e.forzar = true; }); act.push({ de, pr, p }); }
          else if (hechas.has(key)) { de.forEach((e) => { e.oculto = true; }); pr.forEach((e) => { e.forzar = true; }); }
        });
        return act;
      }
      function reaccionesDib(act, S, t) {
        act.forEach((r) => {
          const c = (arr) => { let x = 0, y = 0, n = 0; arr.forEach((e) => { const a = S.actores[e.id]; if (a) { x += px(a.x); y += py(a.y); n++; } }); return n ? [x / n, y / n] : null; };
          const A = c(r.de), B = c(r.pr); if (!A || !B) return;
          for (let i = 0; i < (reduced ? 12 : 30); i++) {
            const u = fract(t * 0.9 + i / 30), x = lerp(A[0], B[0], u) + Math.sin(u * 9 + i) * U * 0.25, y = lerp(A[1], B[1], u) + Math.cos(u * 7 + i * 2) * U * 0.25;
            glifoActor(i % 4 ? aClaro : aBlanco, gi(i % 3 ? '=' : '>'), x, y, clamp(U * 0.22, 10, 22), Math.sin(u * PI) * 0.9);
          }
          const f = Math.exp(-Math.pow((r.p - 0.5) / 0.15, 2)); if (f > 0.02) { const gr = g.createRadialGradient((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, 0, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2, U * 2.2); gr.addColorStop(0, `rgba(220,255,230,${0.5 * f})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(bx, by, bw, bh); }
        });
      }

      // ---------- bucle ----------
      function update(S, dt) {
        dt = clamp(dt || 0.016, 0, 0.1); const t = S.t || 0;
        if (t < lastT - 0.4) { hechas.clear(); for (const id in ents) ents[id].t0 = null; }
        lastT = t;
        const c = S.camara || {}; camZ = clamp(c.zoom || 1, 0.3, 6); camX = c.cx != null ? c.cx : 0.5; camY = c.cy != null ? c.cy : 0.5;
        U = bh * 0.135;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        g.fillStyle = '#010a04'; g.fillRect(0, 0, Wd, Hd);
        lluvia(dt, t);
        const acts = S.actores || {};
        for (const id in acts) if (!ents[id]) ents[id] = crearEnt(id, acts[id]);
        const act = reaccionesPre(S);
        // los actores que se forman oscurecen un poco la lluvia detrás para que se lean mejor
        let zi = 0;
        for (const id in ents) {
          const a = acts[id]; if (!a) continue; const e = ents[id];
          if (a.visible !== false && (a.alpha == null || a.alpha > 0.05) && !e.oculto && e.t0 != null) { const r = e.radio * U * (a.escala || 1) * camZ * 1.1; const gr = g.createRadialGradient(px(a.x), py(a.y), r * 0.2, px(a.x), py(a.y), r * 1.5); gr.addColorStop(0, 'rgba(0,6,2,.55)'); gr.addColorStop(1, 'rgba(0,6,2,0)'); g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(px(a.x) - r * 1.5, py(a.y) - r * 1.5, r * 3, r * 3); }
        }
        for (const id in ents) { const a = acts[id]; if (a) dibujarActor(ents[id], a, t, dt, zi++); }
        g.globalAlpha = 1;
        reaccionesDib(act, S, t); trayectorias(S, t); vectores(S, t); particulas(S, t); bocadillos(S, t);
        g.globalAlpha = 1;
        // post: bloom + scanlines + viñeta
        g.setTransform(1, 0, 0, 1, 0, 0);
        bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, bloom.width, bloom.height); bg.drawImage(cv, 0, 0, bloom.width, bloom.height);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.85; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(bloom, 0, 0, cv.width, cv.height);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        g.fillStyle = g.createPattern(scan, 'repeat'); g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(vig, 0, 0, cv.width, cv.height);
        if (!reduced) { g.fillStyle = `rgba(0,255,90,${0.012 + 0.01 * Math.sin(t * 40)})`; g.fillRect(0, 0, cv.width, cv.height); }
      }
      function dispose() {
        if (ro) ro.disconnect();
        wrap.remove();
        for (const k in atlas) delete atlas[k]; atlasOrden.length = 0;
      }
      return { update, resize, dispose };
    },
  });
})();
