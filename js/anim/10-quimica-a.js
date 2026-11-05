// =====================================================================================
// 10-quimica-a.js — presets de animación de química (ANIM-QUIM-A)
// Presets: concentracion · dilucion · masa-molar · ph · acido-base · titrage · conductimetria
//
// PARÁMETROS (id · rango · paso · valor por defecto · unidad). Los ids canónicos son los del
// CONTRATO §7; los marcados (extra) son opcionales y tienen valor por defecto, así que un
// capítulo puede omitirlos.
//
//  concentracion   n  0,01 – 1      (0,01)  def 0,2   mol      cantidad de soluto
//                  V  0,1  – 1      (0,05)  def 0,5   L        volumen de la disolución
//  dilucion        C0 0,1  – 2      (0,05)  def 1,0   mol/L    concentración de la solución madre
//                  V0 1    – 50     (1)     def 10    mL       volumen tomado con la pipeta aforada
//                  Vf 20   – 250    (5)     def 100   mL       volumen final de la fiola aforada (≥ V0)
//                  paso (extra) 0 – 4 (0,01) def 4             etapa: 0 inicio · 1 pipeta llena · 2 vertido ·
//                                                              3 enrasado con agua · 4 agitado
//  masa-molar      m  1    – 200    (0,5)   def 30    g        masa de la muestra
//                  M  1    – 250    (0,5)   def 60    g/mol    masa molar
//  ph              pH 0    – 14     (0,1)   def 4     (sin unidad)
//  acido-base      pKa 0   – 14     (0,1)   def 4,8   (sin unidad)  pKa del par AH/A⁻
//                  pH  0   – 14     (0,1)   def 6     (sin unidad)
//  titrage         Ca 0,02 – 0,5    (0,01)  def 0,10  mol/L    ácido fuerte (HCl) valorado
//                  Va 5    – 50     (1)     def 20    mL       volumen de ácido en el erlenmeyer
//                  Cb 0,02 – 0,5    (0,01)  def 0,10  mol/L    base fuerte (NaOH) de la bureta
//                  Vb (extra) 0 – 60 (0,1)  def 12    mL       volumen de base vertido
//  conductimetria  c  0,5  – 100    (0,5)   def 10    mmol/L   concentración del electrolito (NaCl)
//
// SIMPLIFICACIONES DIDÁCTICAS (también señaladas junto al código correspondiente):
//  · El número de partículas dibujadas es proporcional a la cantidad de materia, pero con una
//    constante de escala muy pequeña (un mol real son 6,02·10²³ entidades).
//  · En `ph` el número de iones sigue una escala logarítmica (la real daría 10⁷ veces menos iones).
//  · Movimiento browniano: proceso de Ornstein–Uhlenbeck, velocidades muy exageradas.
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB;
  if (!PCB || !PCB.anim) return;
  const reg = (id, def) => PCB.anim.register(id, def);

  // ---------------------------------------------------------------------------------
  // 1. Utilidades matemáticas y de formato
  // ---------------------------------------------------------------------------------
  const TAU = Math.PI * 2;
  const rnd = Math.random;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };      // smoothstep
  const seg = (x, a, b) => sm((x - a) / (b - a));                              // progreso suave de x en [a,b]
  const approach = (cur, tgt, k, dt) => cur + (tgt - cur) * (1 - Math.exp(-k * dt)); // suavizado exp. (independiente de los fps)
  const rn = () => (rnd() + rnd() + rnd() - 1.5) * 2;                          // ≈ N(0,1), barato

  // Formato: coma decimal francesa. T → texto plano, L → LaTeX ({,} evita el espacio de KaTeX).
  const T = (x, d = 2) => Number(x).toFixed(d).replace('.', ',');
  const L = (x, d = 2) => Number(x).toFixed(d).replace('.', '{,}');
  /** Cadena con k cifras significativas (sin notación científica). */
  function sigStr(x, k) {
    if (!isFinite(x)) return '—';
    if (x === 0) return '0';
    const e = Math.floor(Math.log10(Math.abs(x)));
    return Number(x).toFixed(clamp(k - 1 - e, 0, 8));
  }
  const Ts = (x, k = 3) => sigStr(x, k).replace('.', ',');
  const Ls = (x, k = 3) => sigStr(x, k).replace('.', '{,}');
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function sciParts(x, d) {
    if (!(x > 0)) return { m: 0, e: 0 };
    let e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e);
    if (Number(m.toFixed(d)) >= 10) { m /= 10; e++; }
    return { m, e };
  }
  /** 1,0×10⁻⁴ en texto plano / en LaTeX. */
  const sciT = (x, d = 1) => { const s = sciParts(x, d); return T(s.m, d) + '×10' + String(s.e).split('').map((c) => SUP[c]).join(''); };
  const sciL = (x, d = 1) => { const s = sciParts(x, d); return L(s.m, d) + '\\times10^{' + s.e + '}'; };

  // Colores como [r,g,b]
  const hex = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const shade = (c, f) => [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255)];
  const rgba = (c, a = 1) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';

  const COL = {
    txt: '#eaf0ff', txt2: '#9fb0d9', cyan: '#00d4ff', green: '#2ee59d', pink: '#ff3da6', amber: '#ffd166', red: '#ff5a5f',
    water: [120, 190, 255], violet: [172, 72, 236],
  };
  const FONT = 'UI, system-ui, sans-serif';
  const MONO = 'ui-monospace, Menlo, Consolas, monospace';

  // ---------------------------------------------------------------------------------
  // 2. Esferas sombreadas (sprites con caché) y moléculas
  // ---------------------------------------------------------------------------------
  const spriteCache = new Map();
  /** Esfera con brillo, sombreado y halo; r en px lógicos; glyph '+' | '-' | null dibujado encima. */
  function sprite(c, r, glyph) {
    r = Math.max(1.5, Math.round(r * 2) / 2);
    const key = [c[0] | 0, c[1] | 0, c[2] | 0, r, glyph || ''].join(',');
    let s = spriteCache.get(key);
    if (s) return s;
    if (spriteCache.size > 400) spriteCache.clear();
    const S = 2, pad = 2, size = Math.ceil(r * 2 + pad * 2);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size * S;
    const g = cv.getContext('2d');
    g.scale(S, S);
    const cx = size / 2, cy = size / 2;
    // halo suave (da sensación de "brillo" sobre el líquido oscuro)
    const halo = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r + pad);
    halo.addColorStop(0, rgba(c, 0.30)); halo.addColorStop(1, rgba(c, 0));
    g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, r + pad, 0, TAU); g.fill();
    // cuerpo con luz arriba a la izquierda
    const gr = g.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.06, cx, cy, r);
    gr.addColorStop(0, rgba(mixC(c, [255, 255, 255], 0.78))); gr.addColorStop(0.38, rgba(c)); gr.addColorStop(1, rgba(shade(c, 0.42)));
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    // brillo especular
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.beginPath(); g.ellipse(cx - r * 0.36, cy - r * 0.42, r * 0.2, r * 0.12, -0.7, 0, TAU); g.fill();
    if (glyph) {
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = Math.max(1.1, r * 0.2); g.lineCap = 'round';
      const k = r * 0.46;
      g.beginPath(); g.moveTo(cx - k, cy + r * 0.04); g.lineTo(cx + k, cy + r * 0.04);
      if (glyph === '+') { g.moveTo(cx, cy + r * 0.04 - k); g.lineTo(cx, cy + r * 0.04 + k); }
      g.stroke();
    }
    s = { cv, size, half: size / 2 };
    spriteCache.set(key, s);
    return s;
  }
  function blit(ctx, c, r, x, y, glyph) {
    const s = sprite(c, r, glyph);
    ctx.drawImage(s.cv, x - s.half, y - s.half, s.size, s.size);
  }

  // Especies: color principal, radio relativo, glifo de carga y "satélites" (átomos unidos).
  // Satélite: {c, r (relativo al principal), d (distancia/radio principal), off (ángulo respecto a la rotación)}
  const HC = hex('#fff1b8'); // color del protón H⁺
  const SPC = {
    soluto: { c: hex('#ff4fb0'), r: 1.25, sat: [{ c: hex('#ffe08a'), r: 0.52, d: 1.12, off: 0 }] },
    h3o: { c: hex('#ff5a5f'), r: 1.18, glyph: '+' },
    ho: { c: hex('#4aa3ff'), r: 1.18, glyph: '-' },
    agua: { c: hex('#8fc8ff'), r: 1.0, al: 0.9, sat: [{ c: hex('#f2f8ff'), r: 0.5, d: 0.98, off: 0 }, { c: hex('#f2f8ff'), r: 0.5, d: 0.98, off: 1.82 }] },
    aguaTenue: { c: hex('#8fc8ff'), r: 0.7, al: 0.28, sat: [{ c: hex('#f2f8ff'), r: 0.45, d: 0.95, off: 0 }, { c: hex('#f2f8ff'), r: 0.45, d: 0.95, off: 1.82 }] },
    na: { c: hex('#a78bfa'), r: 1.02, glyph: '+' },
    cl: { c: hex('#35d07f'), r: 1.3, glyph: '-' },
    AH: { c: hex('#2ee59d'), r: 1.75, sat: [{ c: HC, r: 0.34, d: 1.02, off: 0 }] },
    A: { c: hex('#ff4fb0'), r: 1.75, glyph: '-' },
    grano: { c: hex('#52c7ff'), r: 1.0 },
    grano2: { c: hex('#7ee8c6'), r: 1.0 },
    grano3: { c: hex('#ffd27a'), r: 1.0 },
  };

  /** Dibuja una molécula (esfera principal + satélites con orden de profundidad). */
  function drawMol(ctx, sp, x, y, r, ang, al) {
    if (al < 0.02) return;
    ctx.globalAlpha = al * (sp.al || 1);
    const R = r * sp.r, sats = sp.sat;
    if (sats) {
      for (let i = 0; i < sats.length; i++) {
        const t = sats[i], a = ang + t.off;
        if (Math.sin(a) < 0) blit(ctx, t.c, Math.max(1.5, R * t.r), x + Math.cos(a) * R * t.d, y + Math.sin(a) * R * t.d * 0.8, null);
      }
    }
    blit(ctx, sp.c, R, x, y, sp.glyph);
    if (sats) {
      for (let i = 0; i < sats.length; i++) {
        const t = sats[i], a = ang + t.off;
        if (Math.sin(a) >= 0) blit(ctx, t.c, Math.max(1.5, R * t.r), x + Math.cos(a) * R * t.d, y + Math.sin(a) * R * t.d * 0.8, null);
      }
    }
  }

  // ---------------------------------------------------------------------------------
  // 3. Enjambre de partículas con movimiento browniano y altas/bajas con fundido
  //    Posiciones en "unidades de recipiente": 1 unidad = altura del recipiente (x centrado en 0, y desde el fondo).
  // ---------------------------------------------------------------------------------
  class Swarm {
    constructor(specs) { this.sp = specs; this.q = []; }
    add(s, x, y, extra) {
      const q = { s, x, y, vx: 0, vy: 0, a: 0, dying: false, ang: rnd() * TAU, w: (rnd() - 0.5) * 1.6, z: 0.92 + rnd() * 0.2, hasH: false, glow: 0, busy: false };
      if (extra) Object.assign(q, extra);
      this.q.push(q);
      return q;
    }
    alive(s) { let n = 0; for (const q of this.q) if (!q.dying && (s === undefined || q.s === s)) n++; return n; }
    /** Acerca el nº de partículas vivas de cada especie a `targets[s]` sin saltos (fundido de entrada/salida). */
    sync(targets, spawn, dt) {
      for (let s = 0; s < targets.length; s++) {
        const diff = targets[s] - this.alive(s);
        if (diff === 0) continue;
        const lim = Math.max(1, Math.ceil(Math.abs(diff) * dt * 5));
        if (diff > 0) {
          for (let k = 0; k < Math.min(diff, lim); k++) spawn(s, this);
        } else {
          let kill = Math.min(-diff, lim), tries = 0;
          while (kill > 0 && tries++ < 60) { const q = this.q[(rnd() * this.q.length) | 0]; if (q && q.s === s && !q.dying) { q.dying = true; kill--; } }
          for (let i = this.q.length - 1; i >= 0 && kill > 0; i--) { const q = this.q[i]; if (q.s === s && !q.dying) { q.dying = true; kill--; } }
        }
      }
    }
    /** o: {hw(y) semiancho útil, ymin, ymax, ru (radio base en unidades), speed (desv. típica de la velocidad, u/s), drift(q) → u/s en x} */
    step(dt, o) {
      const g = 2.4, sg = Math.sqrt(2 * g), sdt = Math.sqrt(dt), q = this.q;
      for (let i = q.length - 1; i >= 0; i--) {
        const p = q[i];
        p.a = clamp(p.a + (p.dying ? -3.5 : 3.2) * dt, 0, 1);
        if (p.dying && p.a <= 0) { q[i] = q[q.length - 1]; q.pop(); continue; }
        const sp = this.sp[p.s], vs = o.speed * (sp.vs || 1);
        // Ornstein–Uhlenbeck: v += −γ·v·dt + σ·√dt·ξ  (velocidad con memoria → trayectoria browniana suave)
        p.vx += -g * p.vx * dt + vs * sg * sdt * rn();
        p.vy += -g * p.vy * dt + vs * sg * sdt * rn();
        p.w = clamp(p.w + (-1.2 * p.w) * dt + 1.3 * sdt * rn(), -2.2, 2.2);
        p.ang += p.w * dt;
        p.x += (p.vx + (o.drift ? o.drift(p) : 0)) * dt;
        p.y += p.vy * dt;
        if (p.glow > 0) p.glow = Math.max(0, p.glow - dt * 2.5);
        // paredes y superficie del líquido (reflexión; si el nivel baja, la partícula es empujada hacia abajo con suavidad)
        const m = o.ru * (sp.r || 1) * 1.05, lo = o.ymin + m, hi = Math.max(lo, o.ymax - m);
        if (p.y < lo) { p.y = lo; p.vy = Math.abs(p.vy); }
        else if (p.y > hi) { p.y += (hi - p.y) * Math.min(1, dt * 9); if (p.vy > 0) p.vy = -p.vy * 0.5; }
        const hw = Math.max(0, o.hw(p.y) - m);
        if (p.x > hw) { p.x = hw; p.vx = -Math.abs(p.vx); } else if (p.x < -hw) { p.x = -hw; p.vx = Math.abs(p.vx); }
      }
    }
    /** Dibuja con el mapeo del recipiente V; `pick` permite elegir la especie dibujada. */
    draw(ctx, V, rpx, pick) {
      for (const p of this.q) {
        drawMol(ctx, this.sp[pick ? pick(p) : p.s], V.cx + p.x * V.H, V.yb - V.tw - p.y * (V.H - V.tw), rpx * p.z, p.ang, p.a);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------------------------
  // 4. Recipientes de vidrio: perfiles, líquido con menisco y ondas, vidrio con brillos, graduaciones
  //    Un perfil es y∈[0,1] (0 = fondo) → semiancho en unidades de altura.
  // ---------------------------------------------------------------------------------
  const PROF = {
    /** Vaso de precipitados con esquina inferior redondeada. */
    beaker: (hw0, rc) => (y) => y >= rc ? hw0 : (hw0 - rc) + rc * Math.sqrt(Math.max(0, 1 - ((rc - y) / rc) ** 2)),
    /** Caja (cubeta) ancha: semiancho constante. */
    box: (hw0, rc) => PROF.beaker(hw0, rc),
    /** Fiola aforada: bulbo inferior (superelipse de fondo casi plano), hombro suave y cuello largo. */
    fiole: () => {
      const R = 0.30, yc = 0.30, neck = 0.052, y1 = 0.62;
      return (y) => {
        if (y < yc) { const u = (yc - y) / yc; return R * Math.pow(Math.max(0, 1 - Math.pow(u, 2.6)), 1 / 2.6); }
        if (y < y1) { const t = (y - yc) / (y1 - yc); return neck + (R - neck) * (0.5 + 0.5 * Math.cos(Math.PI * t)); }
        return neck;
      };
    },
    /** Erlenmeyer: cono truncado + cuello. */
    erlen: () => {
      const hb = 0.43, hn = 0.1, ys = 0.62, rc = 0.06;
      return (y) => {
        let w = y < ys ? hn + (hb - hn) * Math.pow(1 - y / ys, 1.25) : hn;
        if (y < rc) { const u = (rc - y) / rc; w -= rc * (1 - Math.sqrt(Math.max(0, 1 - u * u))); }
        return w;
      };
    },
    /** Pipeta aforada (y=0 en la punta): punta fina, bulbo, tubo largo. */
    pipeta: (bulb) => (y) => {
      const tube = 0.012;
      if (y < 0.28) return 0.008 + (tube - 0.008) * (y / 0.28);
      if (y < 0.66) return tube + (bulb - tube) * Math.pow(Math.max(0, Math.sin(Math.PI * clamp((y - 0.3) / 0.34, 0, 1))), 0.55);
      return tube;
    },
    /** Tubo fino de semiancho constante (bureta). */
    tubo: (hw) => () => hw,
  };
  /** Tabla de volumen acumulado (∝ ∫ semiancho² dy) para convertir volumen ↔ nivel en recipientes no cilíndricos. */
  function volTable(prof, N = 160) {
    const c = new Float32Array(N + 1);
    let a = 0;
    for (let i = 1; i <= N; i++) { const y = (i - 0.5) / N; a += prof(y) * prof(y) / N; c[i] = a; }
    return c;
  }
  const volAt = (c, y) => { const N = c.length - 1, f = clamp(y, 0, 1) * N, i = Math.min(N - 1, f | 0); return lerp(c[i], c[i + 1], f - i); };
  /** Nivel y (0..1) que corresponde a un volumen v (en las unidades de la tabla). */
  function levelForVol(c, v) {
    const N = c.length - 1;
    if (v <= 0) return 0;
    if (v >= c[N]) return 1;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (c[mid] <= v) lo = mid; else hi = mid; }
    return (lo + (v - c[lo]) / Math.max(1e-12, c[hi] - c[lo])) / N;
  }

  /** Crea el objeto recipiente. cx: centro x; yb: y del fondo (px); H: altura (px); tw: grosor del vidrio (px). */
  function makeVessel(prof, cx, yb, H, tw) {
    tw = tw == null ? 3 : tw;
    let mx = 0;
    for (let i = 0; i <= 40; i++) mx = Math.max(mx, prof(i / 40));
    return { prof, cx, yb, H, tw, maxHW: mx, hwIn: (y) => prof(y) - tw / H, Y: (y) => yb - tw - y * (H - tw) };
  }
  /** Trazado cerrado del contorno (inset px hacia dentro). */
  function poly(ctx, V, inset) {
    const N = 64, H = V.H;
    for (let i = 0; i <= N; i++) {
      const y = i / N, w = Math.max(0, V.prof(y) * H - inset), py = V.yb - inset - y * (H - inset);
      if (i) ctx.lineTo(V.cx - w, py); else ctx.moveTo(V.cx - w, py);
    }
    for (let i = N; i >= 0; i--) {
      const y = i / N, w = Math.max(0, V.prof(y) * H - inset), py = V.yb - inset - y * (H - inset);
      ctx.lineTo(V.cx + w, py);
    }
    ctx.closePath();
  }
  /** Trazado abierto por arriba (para el borde de vidrio). */
  function sides(ctx, V, inset) {
    const N = 64, H = V.H;
    ctx.beginPath();
    for (let i = N; i >= 0; i--) {
      const y = i / N, w = Math.max(0, V.prof(y) * H - inset), py = V.yb - inset - y * (H - inset);
      if (i === N) ctx.moveTo(V.cx - w, py); else ctx.lineTo(V.cx - w, py);
    }
    for (let i = 0; i <= N; i++) {
      const y = i / N, w = Math.max(0, V.prof(y) * H - inset), py = V.yb - inset - y * (H - inset);
      ctx.lineTo(V.cx + w, py);
    }
  }

  /**
   * Líquido dentro del recipiente: relleno con degradado vertical, superficie ondulante con menisco
   * (el líquido "trepa" por las paredes), sombreado lateral para dar volumen y reflejo en la superficie.
   * o: {level (0..1), stops:[{p (0 fondo..1 superficie), c, a}], t, amp (px), cb(ctx) dibuja partículas ya recortadas}
   */
  function drawLiquid(ctx, V, o) {
    if (o.level <= 0.002) return;
    const H = V.H, ys = V.yb - V.tw - o.level * (H - V.tw), amp = o.amp || 0;
    ctx.save();
    ctx.beginPath(); poly(ctx, V, V.tw); ctx.clip();
    const W = V.maxHW * H, xl = V.cx - W - 2, xr = V.cx + W + 2;
    const inW = Math.max(1, V.prof(Math.min(1, o.level)) * H - V.tw), xa = V.cx - inW, xb = V.cx + inW;
    const M = clamp(H * 0.014, 2, 4.5);
    const surf = (x) => {
      let y = ys + amp * (Math.sin(x * 0.05 + o.t * 2.1) + 0.55 * Math.sin(x * 0.11 - o.t * 1.7));
      const dl = x - xa, dr = xb - x;
      if (dl > -4 && dr > -4) y -= M * (Math.exp(-Math.max(0, dl) / 5) + Math.exp(-Math.max(0, dr) / 5)); // menisco
      return y;
    };
    ctx.beginPath();
    ctx.moveTo(xl, surf(xl));
    for (let x = xl + 3; x < xr; x += 3) ctx.lineTo(x, surf(x));
    ctx.lineTo(xr, surf(xr)); ctx.lineTo(xr, V.yb + 2); ctx.lineTo(xl, V.yb + 2); ctx.closePath();
    const g = ctx.createLinearGradient(0, V.yb, 0, ys - amp - 1);
    for (const s of o.stops) g.addColorStop(clamp(s.p, 0, 1), rgba(shade(s.c, lerp(0.7, 1, s.p)), clamp(s.a * lerp(1.22, 1, s.p), 0, 1)));
    ctx.fillStyle = g; ctx.fill();
    // volumen: bordes más oscuros, banda de luz cerca de la pared izquierda
    const sh = ctx.createLinearGradient(V.cx - W, 0, V.cx + W, 0);
    sh.addColorStop(0, 'rgba(0,0,0,.30)'); sh.addColorStop(0.1, 'rgba(0,0,0,0)'); sh.addColorStop(0.24, 'rgba(255,255,255,.07)');
    sh.addColorStop(0.4, 'rgba(255,255,255,0)'); sh.addColorStop(0.9, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.28)');
    ctx.fillStyle = sh; ctx.fillRect(xl, ys - M - amp - 2, xr - xl, V.yb - ys + M + amp + 4);
    // partículas (recortadas por debajo de la superficie: el path del líquido sigue activo)
    if (o.cb) { ctx.save(); ctx.clip(); o.cb(ctx); ctx.restore(); }
    // reflejo de la superficie
    ctx.beginPath();
    for (let x = xl; x <= xr; x += 3) { if (x === xl) ctx.moveTo(x, surf(x)); else ctx.lineTo(x, surf(x)); }
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.restore();
  }

  /** Vidrio translúcido: espesor con degradado, contornos, base gruesa, labio y brillos. */
  function drawGlass(ctx, V, o) {
    o = o || {};
    const H = V.H, cx = V.cx, W = V.maxHW * H;
    ctx.save();
    ctx.beginPath(); poly(ctx, V, 0); poly(ctx, V, V.tw);
    const g = ctx.createLinearGradient(cx - W, 0, cx + W, 0);
    g.addColorStop(0, 'rgba(215,236,255,.40)'); g.addColorStop(0.2, 'rgba(170,205,255,.12)');
    g.addColorStop(0.8, 'rgba(150,190,255,.09)'); g.addColorStop(1, 'rgba(220,240,255,.36)');
    ctx.fillStyle = g; ctx.fill('evenodd');
    // base de vidrio más gruesa
    ctx.save();
    ctx.beginPath(); poly(ctx, V, V.tw); ctx.clip();
    ctx.fillStyle = 'rgba(200,225,255,.16)'; ctx.fillRect(cx - W, V.yb - V.tw - Math.max(4, H * 0.022), 2 * W, 30);
    ctx.restore();
    // contornos
    sides(ctx, V, 0); ctx.strokeStyle = 'rgba(212,234,255,.62)'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.stroke();
    sides(ctx, V, V.tw); ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1; ctx.stroke();
    // labio superior
    if (!o.noLip) {
      const wt = V.prof(1) * H;
      ctx.beginPath(); ctx.moveTo(cx - wt - 2.5, V.yb - H); ctx.lineTo(cx + wt + 2.5, V.yb - H);
      ctx.strokeStyle = 'rgba(228,244,255,.72)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.stroke();
    }
    // brillos verticales (siguen la forma del recipiente)
    if (!o.noHi && H > 60) {
      const streak = (xoff, y0, y1, a, lw) => {
        ctx.beginPath();
        for (let i = 0; i <= 26; i++) {
          const y = y0 + (y1 - y0) * i / 26, x = cx + xoff * (V.prof(y) * H - V.tw - (xoff < 0 ? 5 : 4)), py = V.yb - V.tw - y * (H - V.tw);
          if (i) ctx.lineTo(x, py); else ctx.moveTo(x, py);
        }
        const hg = ctx.createLinearGradient(0, V.yb - y1 * H, 0, V.yb - y0 * H);
        hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.25, 'rgba(255,255,255,' + a + ')');
        hg.addColorStop(0.75, 'rgba(255,255,255,' + a * 0.8 + ')'); hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = hg; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
      };
      streak(-1, 0.1, 0.93, 0.5, clamp(H * 0.012, 2, 4.5));
      streak(1, 0.16, 0.8, 0.22, 1.5);
    }
    ctx.restore();
  }

  /** Graduaciones en la pared derecha: lista de {y (0..1), lab, big}. */
  function drawTicks(ctx, V, list, fs) {
    ctx.save();
    ctx.lineWidth = 1;
    for (const t of list) {
      const py = V.Y(t.y), xr = V.cx + V.prof(t.y) * V.H - V.tw, len = t.big ? 12 : 6;
      ctx.strokeStyle = 'rgba(225,238,255,.72)';
      ctx.beginPath(); ctx.moveTo(xr, py); ctx.lineTo(xr - len, py); ctx.stroke();
      if (t.lab) txt(ctx, t.lab, xr + 6, py, { s: Math.max(9, fs - 2), c: COL.txt2, bl: 'middle' });
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------------
  // 5. Utilidades de dibujo de interfaz
  // ---------------------------------------------------------------------------------
  const fsOf = (w, h) => clamp(Math.min(w / 62, h / 21), 10.5, 15);
  function txt(ctx, s, x, y, o) {
    o = o || {};
    ctx.font = (o.w || 400) + ' ' + (o.s || 13) + 'px ' + (o.f || FONT);
    ctx.fillStyle = o.c || '#cfd9f7';
    ctx.textAlign = o.al || 'left';
    ctx.textBaseline = o.bl || 'alphabetic';
    ctx.fillText(s, x, y);
  }
  /** Texto que reduce su tamaño hasta caber en maxW. */
  function txtFit(ctx, s, x, y, maxW, o) {
    o = Object.assign({}, o);
    let size = o.s || 13;
    ctx.font = (o.w || 400) + ' ' + size + 'px ' + (o.f || FONT);
    while (size > 8.5 && ctx.measureText(s).width > maxW) { size -= 0.5; ctx.font = (o.w || 400) + ' ' + size + 'px ' + (o.f || FONT); }
    o.s = size;
    txt(ctx, s, x, y, o);
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function card(ctx, x, y, w, h, r) {
    rr(ctx, x, y, w, h, r == null ? 12 : r);
    ctx.fillStyle = 'rgba(22,31,61,.74)'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,150,230,.30)'; ctx.lineWidth = 1; ctx.stroke();
  }
  /** Etiqueta redondeada centrada en (x,y). Devuelve el ancho. */
  function pill(ctx, s, x, y, o) {
    o = o || {};
    const size = o.s || 13;
    ctx.font = (o.w || 600) + ' ' + size + 'px ' + (o.f || FONT);
    const tw = ctx.measureText(s).width, w = tw + 18, h = size + 11;
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fillStyle = o.bg || 'rgba(20,30,66,.88)'; ctx.fill();
    ctx.strokeStyle = o.border || 'rgba(120,160,255,.45)'; ctx.lineWidth = 1; ctx.stroke();
    txt(ctx, s, x, y + 0.5, { s: size, w: o.w || 600, c: o.c || COL.txt, al: 'center', bl: 'middle', f: o.f });
    return w;
  }
  function arrowV(ctx, x, y0, y1, col) {
    ctx.save();
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    const d = y1 < y0 ? 1 : -1; // flecha en y1 hacia arriba si y1<y0
    [[y1, d], [y0, -d]].forEach(([yy, dd]) => { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x - 3.5, yy + 6 * dd); ctx.lineTo(x + 3.5, yy + 6 * dd); ctx.closePath(); ctx.fill(); });
    ctx.restore();
  }
  function bg(ctx, w, h) {
    ctx.fillStyle = '#0a0f20'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(48,72,150,.20)'); g.addColorStop(1, 'rgba(10,15,32,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  /** Mesa de laboratorio (suelo degradado + línea de luz). */
  function table(ctx, w, h, yb) {
    const g = ctx.createLinearGradient(0, yb, 0, h);
    g.addColorStop(0, '#17234c'); g.addColorStop(1, '#0a0f20');
    ctx.fillStyle = g; ctx.fillRect(0, yb, w, h - yb);
    ctx.fillStyle = 'rgba(150,180,255,.28)'; ctx.fillRect(0, yb, w, 1);
  }
  /** Sombra de un recipiente sobre la mesa + resplandor coloreado del líquido. */
  function shadow(ctx, yb, cx, rad, glow, ga) {
    ctx.save();
    ctx.translate(cx, yb + 2); ctx.scale(1, 0.13);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, rad * 1.2);
    sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, rad * 1.2, 0, TAU); ctx.fill();
    if (glow) {
      const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, rad * 1.1);
      gl.addColorStop(0, rgba(glow, ga)); gl.addColorStop(1, rgba(glow, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, rad * 1.1, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  /** Color del líquido (agua → soluto) para una intensidad I∈[0,1] y su opacidad. */
  const liq = (I, tint) => ({ c: mixC(COL.water, tint || COL.violet, I), a: lerp(0.15, 0.8, I) });
  const nice = (x) => { const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; };

  // =================================================================================
  // 1) CONCENTRACION — C = n / V
  //   Un vaso de 1 L con graduaciones. El nivel del líquido sube con V; las moléculas de soluto
  //   (nº ∝ n: 200 por mol, escala didáctica) se agitan dentro del líquido; el color se intensifica con C.
  // =================================================================================
  const LV_C = (V) => 0.035 + 0.82 * V;                 // V (L) → nivel (0..1) del vaso de 1 L
  const intensC = (C) => clamp(1 - Math.exp(-C / 1.1), 0.03, 1);   // C (mol/L) → intensidad de color (saturación suave)

  function layC(w, h) {
    const wide = w >= 560, fs = fsOf(w, h), top = 44, bot = 40;
    const H = Math.max(80, Math.min(h - top - bot, (wide ? w * 0.42 : w * 0.56) / 0.8));
    const cx = wide ? w * 0.34 : Math.max(0.4 * H + 66, w * 0.4), yb = h - bot;
    return { wide, fs, top, bot, H, cx, yb, V: makeVessel(PROF.beaker(0.4, 0.07), cx, yb, H, 3.5), rpx: clamp(H / 56, 3.8, 8) };
  }

  reg('concentracion', {
    titulo: 'Concentración molar', materia: 'chimie',
    params: [
      { id: 'n', label: 'Cantidad de soluto n', min: 0.01, max: 1, step: 0.01, def: 0.2, unit: 'mol' },
      { id: 'V', label: 'Volumen de la disolución V', min: 0.1, max: 1, step: 0.05, def: 0.5, unit: 'L' },
    ],
    create(host, p) {
      return { t: 0, red: !!host.reduced, level: LV_C(p.V), I: intensC(p.n / p.V), slosh: 0, sw: new Swarm([SPC.soluto]), lay: layC(host.w, host.h) };
    },
    step(s, dt, p) {
      s.t += dt;
      const prev = s.level;
      s.level = approach(s.level, LV_C(p.V), 6, dt);
      s.slosh = Math.min(3.2, s.slosh * Math.exp(-2.4 * dt) + Math.abs(s.level - prev) * 80);  // el líquido "chapotea" al cambiar V
      s.I = approach(s.I, intensC(p.n / p.V), 5, dt);
      const L0 = s.lay, N = Math.max(2, Math.round(p.n * 200 * (s.red ? 0.5 : 1)));
      s.sw.sync([N], (k, sw) => sw.add(k, (rnd() - 0.5) * 0.5, 0.04 + rnd() * Math.max(0.05, s.level - 0.08)), dt);
      s.sw.step(dt, { hw: L0.V.hwIn, ymin: 0, ymax: s.level, ru: L0.rpx / L0.V.H, speed: s.red ? 0.045 : 0.085 });
    },
    draw(s, ctx, w, h, p) {
      const L0 = (s.lay = layC(w, h)), V = L0.V, fs = L0.fs, C = p.n / p.V;
      const lq = liq(s.I);
      bg(ctx, w, h);
      table(ctx, w, h, L0.yb);
      shadow(ctx, L0.yb, L0.cx, 0.4 * L0.H, lq.c, 0.08 + 0.3 * s.I);
      drawLiquid(ctx, V, { level: s.level, stops: [{ p: 0, c: lq.c, a: lq.a }, { p: 1, c: lq.c, a: lq.a * 0.85 }], t: s.t, amp: s.red ? 0 : 0.8 + s.slosh, cb: (c) => s.sw.draw(c, V, L0.rpx) });
      drawGlass(ctx, V);
      // graduaciones del vaso (L)
      const tk = [];
      for (let i = 1; i <= 10; i++) tk.push({ y: LV_C(i / 10), big: i % 2 === 0, lab: i % 2 === 0 ? (i === 10 ? '1 L' : T(i / 10, 1)) : null });
      drawTicks(ctx, V, tk, fs);
      // cota de V (flecha a la izquierda, texto girado)
      const yTop = V.Y(s.level), ax = L0.cx - 0.4 * L0.H - 18;
      arrowV(ctx, ax, V.Y(0), yTop, 'rgba(0,212,255,.85)');
      ctx.save(); ctx.translate(ax - 7, (V.Y(0) + yTop) / 2); ctx.rotate(-Math.PI / 2);
      txt(ctx, 'V = ' + T(p.V, 2) + ' L', 0, 0, { s: fs, w: 600, c: COL.cyan, al: 'center' }); ctx.restore();
      // etiqueta de la fórmula sobre el vaso
      pill(ctx, 'C = n / V', L0.cx, 22, { s: fs + 2, c: COL.green, border: 'rgba(46,229,157,.55)' });
      // panel derecho con la lectura
      const x0 = L0.cx + 0.4 * L0.H + 46, pw = w - x0 - 12, cyMid = (L0.top + L0.yb) / 2;
      if (pw > 70) {
        const big = clamp(pw / 7.2, 15, 30), ph = L0.wide ? 168 : 128;
        card(ctx, x0, cyMid - ph / 2, pw, ph, 12);
        txt(ctx, 'concentración', x0 + 12, cyMid - ph / 2 + 18, { s: fs - 1, c: COL.txt2 });
        txtFit(ctx, 'C = ' + T(C, C < 10 ? 2 : 1), x0 + 12, cyMid - ph / 2 + 18 + big + 4, pw - 20, { s: big, w: 700, c: lq.c[0] > 0 ? COL.amber : COL.amber });
        txt(ctx, 'mol·L⁻¹', x0 + 12, cyMid - ph / 2 + 18 + big + fs + 8, { s: fs, c: COL.txt2 });
        // barra de color: el tono del líquido crece con C
        const by = cyMid - ph / 2 + 18 + big + fs + 24, bw = pw - 24;
        const bgd = ctx.createLinearGradient(x0 + 12, 0, x0 + 12 + bw, 0);
        const c0 = liq(0.02), c1 = liq(1);
        bgd.addColorStop(0, rgba(c0.c, c0.a)); bgd.addColorStop(1, rgba(c1.c, c1.a));
        rr(ctx, x0 + 12, by, bw, 9, 4.5); ctx.fillStyle = bgd; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();
        const mx = x0 + 12 + bw * s.I;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(mx, by - 2); ctx.lineTo(mx - 4, by - 8); ctx.lineTo(mx + 4, by - 8); ctx.closePath(); ctx.fill();
        if (L0.wide) {
          const ly = by + 28;
          blit(ctx, SPC.soluto.c, 5, x0 + 18, ly - 4, null);
          txt(ctx, 'soluto: ∝ n (' + s.sw.alive() + ' partículas)', x0 + 30, ly, { s: fs - 1, c: COL.txt2 });
          txt(ctx, 'color y densidad ↑ con C = n/V', x0 + 12, ly + fs + 6, { s: fs - 1, c: COL.txt2 });
        }
      }
    },
    formula(p) {
      const C = p.n / p.V;
      return 'C=\\dfrac{n}{V}=\\dfrac{' + L(p.n, 2) + '}{' + L(p.V, 2) + '}=' + L(C, C < 10 ? 2 : 1) + '\\ \\mathrm{mol\\cdot L^{-1}}';
    },
    lecturas(p) {
      const C = p.n / p.V;
      return [{ label: 'C', valor: T(C, 2) + ' mol·L⁻¹' }, { label: 'n', valor: T(p.n, 2) + ' mol' }, { label: 'V', valor: T(p.V, 2) + ' L' }];
    },
  });

  // =================================================================================
  // 2) DILUCION — C0·V0 = Cf·Vf   (F = Vf/V0 = C0/Cf)
  //   Pipeta aforada: aspira V0 de solución madre → la vierte en la fiola aforada → se enrasa con agua
  //   hasta Vf → se agita. El nº de moléculas se conserva (nº total ∝ C0·Vm, reparto por volumen).
  //   Todo es función del "progreso" s.prog (0..4) que persigue el slider `paso`.
  // =================================================================================
  const DIL = { Vm: 80, kappa: 1.2 };                   // volumen de solución madre (mL) y partículas por mmol
  const LV_M = (V) => 0.03 + 0.85 * V / 100;            // vaso madre de 100 mL
  const intensD = (C) => clamp(Math.pow(Math.max(C, 0) / 2.0, 0.6), 0.015, 1);
  const FIOLE = PROF.fiole(), FIOLE_TBL = volTable(FIOLE), FIOLE_MARK = 0.74, FIOLE_VMARK = volAt(FIOLE_TBL, FIOLE_MARK);
  /** nivel de la fiola cuando contiene la fracción `frac` del volumen aforado Vf */
  const lvFiole = (frac) => levelForVol(FIOLE_TBL, clamp(frac, 0, 1) * FIOLE_VMARK);

  /** Estado numérico de la dilución en función del progreso P (compartido por step y draw). */
  function kinD(P, p) {
    const V0 = p.V0, Vf = Math.max(p.Vf, p.V0), C0 = p.C0;
    const k = { V0, Vf, C0 };
    k.aspir = seg(P, 0.30, 0.80); k.drain = seg(P, 1.70, 2.0); k.water = seg(P, 2.45, 3.2); k.mix = seg(P, 2.9, 3.8);
    k.Vm = DIL.Vm - V0 * k.aspir;                                  // volumen restante en la solución madre
    k.Vf_cur = V0 * k.drain + (Vf - V0) * k.water;                 // volumen en la fiola
    k.Cf = k.Vf_cur > 1e-6 ? C0 * V0 * k.drain / k.Vf_cur : C0;    // C0V0 = C·V  (la cantidad de soluto no cambia)
    k.lvM = LV_M(k.Vm); k.lvF = lvFiole(k.Vf_cur / Vf); k.yConc = lvFiole(V0 * k.drain / Vf);
    k.lvP = 0.82 * k.aspir * (1 - k.drain);                        // nivel dentro de la pipeta (hasta la marca 0,82)
    k.Nm = Math.round(DIL.kappa * C0 * k.Vm); k.Np = Math.round(DIL.kappa * C0 * V0 * k.aspir * (1 - k.drain)); k.Nf = Math.round(DIL.kappa * C0 * V0 * k.drain);
    return k;
  }
  function layD(w, h, Vf) {
    const wide = w >= 560, fs = fsOf(w, h), yb = h - 44;
    const sF = 0.7 + 0.3 * Math.cbrt(clamp(Vf, 1, 250) / 250);     // el matraz crece con Vf
    const Hf = Math.min(h * 0.46, w * 0.5) * sF, Hm = Math.min(h * 0.34, w * 0.3), Hp = h * 0.3;
    const xm = Math.max(0.4 * Hm + 10, w * 0.17), xf = w * (wide ? 0.76 : 0.74);
    return { wide, fs, yb, Hf, Hm, Hp, xm, xf, rpx: clamp(h / 62, 3.4, 7),
      M: makeVessel(PROF.beaker(0.4, 0.07), xm, yb, Hm, 3), F: makeVessel(FIOLE, xf, yb, Hf, 2.5),
      yUp: yb - Hf - 16, yIn: yb - Hm * 0.12, yHov: yb - Hm - 18, yNeck: yb - Hf + 14 };
  }

  reg('dilucion', {
    titulo: 'Dilución (C₀V₀ = CfVf)', materia: 'chimie',
    params: [
      { id: 'C0', label: 'Concentración de la solución madre C₀', min: 0.1, max: 2, step: 0.05, def: 1, unit: 'mol/L' },
      { id: 'V0', label: 'Volumen tomado V₀ (pipeta aforada)', min: 1, max: 50, step: 1, def: 10, unit: 'mL' },
      { id: 'Vf', label: 'Volumen final Vf (fiola aforada)', min: 20, max: 250, step: 5, def: 100, unit: 'mL' },
      { id: 'paso', label: 'Etapa del procedimiento (0 → 4)', min: 0, max: 4, step: 0.01, def: 4, unit: '' },
    ],
    create(host, p) {
      return { t: 0, red: !!host.reduced, prog: 0, slosh: 0, lvM: LV_M(DIL.Vm), lvF: 0,
        swM: new Swarm([SPC.soluto]), swP: new Swarm([SPC.soluto]), swF: new Swarm([SPC.soluto]), lay: layD(host.w, host.h, p.Vf), k: kinD(0, p) };
    },
    step(s, dt, p) {
      s.t += dt;
      // el progreso persigue al slider: hacia delante a ritmo de "película", hacia atrás más rápido
      const d = (p.paso == null ? 4 : p.paso) - s.prog, vmax = d > 0 ? 0.6 : 2.5;
      const prevF = s.k.lvF;
      s.prog += clamp(d, -vmax * dt, vmax * dt);
      const k = (s.k = kinD(s.prog, p)), L0 = s.lay, red = s.red ? 0.55 : 1, sp = s.red ? 0.04 : 0.075;
      s.slosh = Math.min(3, s.slosh * Math.exp(-2.4 * dt) + Math.abs(k.lvF - prevF) * 60);
      // mezcla: las partículas ocupan toda la columna sólo cuando se agita
      const ymaxF = lerp(Math.max(k.yConc, 0.03), k.lvF, k.mix);
      s.swM.sync([Math.round(k.Nm * red)], (q, sw) => sw.add(q, (rnd() - 0.5) * 0.5, 0.03 + rnd() * Math.max(0.04, k.lvM - 0.06)), dt);
      s.swM.step(dt, { hw: L0.M.hwIn, ymin: 0, ymax: k.lvM, ru: L0.rpx / L0.M.H, speed: sp });
      s.swP.sync([Math.round(k.Np * red)], (q, sw) => sw.add(q, (rnd() - 0.5) * 0.05, 0.34 + rnd() * 0.25), dt);
      const pf = PROF.pipeta(0.085 + 0.05 * clamp(k.V0 / 50, 0, 1));
      s.swP.step(dt, { hw: (y) => pf(y) - 1 / L0.Hp, ymin: 0.31, ymax: Math.min(k.lvP, 0.64), ru: L0.rpx * 0.55 / L0.Hp, speed: sp * 0.7 });
      s.swF.sync([Math.round(k.Nf * red)], (q, sw) => sw.add(q, (rnd() - 0.5) * 0.2, 0.02 + rnd() * 0.04), dt);
      s.swF.step(dt, { hw: L0.F.hwIn, ymin: 0, ymax: Math.max(ymaxF, 0.05), ru: L0.rpx / L0.F.H, speed: sp });
    },
    draw(s, ctx, w, h, p) {
      const L0 = (s.lay = layD(w, h, p.Vf)), k = s.k = kinD(s.prog, p), fs = L0.fs, P = s.prog, M = L0.M, F = L0.F;
      bg(ctx, w, h);
      const lM = liq(intensD(k.C0)), amp = s.red ? 0 : 0.8 + s.slosh;
      table(ctx, w, h, L0.yb);
      shadow(ctx, L0.yb, M.cx, 0.4 * L0.Hm, lM.c, 0.15);
      shadow(ctx, L0.yb, F.cx, 0.3 * L0.Hf, liq(intensD(k.Cf)).c, 0.1 + 0.2 * intensD(k.Cf));
      // --- solución madre
      drawLiquid(ctx, M, { level: k.lvM, stops: [{ p: 0, c: lM.c, a: lM.a }, { p: 1, c: lM.c, a: lM.a * 0.85 }], t: s.t, amp, cb: (c) => s.swM.draw(c, M, L0.rpx) });
      drawGlass(ctx, M);
      // --- fiola aforada (con balanceo al agitar)
      const f0 = k.Vf_cur > 1e-6 ? clamp(k.V0 * k.drain / k.Vf_cur, 0, 1) : 1;
      const hasTop = k.water > 0.001, Ib = lerp(intensD(k.C0), intensD(k.Cf), k.mix), It = hasTop ? lerp(0, intensD(k.Cf), k.mix) : Ib;
      const sb = liq(Ib), st = liq(It);
      const shake = !s.red && P > 3.5 && P < 4.0 ? Math.sin((P - 3.5) * 46) * 0.05 * Math.sin(Math.PI * (P - 3.5) / 0.5) : 0;
      ctx.save();
      ctx.translate(F.cx, F.yb); ctx.rotate(shake); ctx.translate(-F.cx, -F.yb);
      drawLiquid(ctx, F, { level: k.lvF, stops: [{ p: 0, c: sb.c, a: sb.a }, { p: f0 * 0.9, c: sb.c, a: sb.a }, { p: Math.min(1, f0 * 1.1 + 0.03), c: st.c, a: st.a }, { p: 1, c: st.c, a: st.a }], t: s.t, amp, cb: (c) => s.swF.draw(c, F, L0.rpx) });
      drawGlass(ctx, F);
      // marca de aforo en el cuello
      const my = F.Y(FIOLE_MARK), mw = FIOLE(FIOLE_MARK) * F.H + 3;
      ctx.strokeStyle = 'rgba(255,209,102,.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(F.cx - mw, my); ctx.lineTo(F.cx + mw, my); ctx.stroke();
      if (P > 3.5) { // tapón
        const tw = FIOLE(1) * F.H + 3;
        rr(ctx, F.cx - tw, F.yb - F.H - 12, tw * 2, 14, 3); ctx.fillStyle = '#5b6fb5'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke();
      }
      ctx.restore();
      // --- chorro de agua destilada
      if (k.water > 0.002 && k.water < 0.998) {
        const sx = F.cx, y0 = 14, y1 = F.Y(k.lvF);
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, 'rgba(160,215,255,.0)'); g.addColorStop(0.15, 'rgba(160,215,255,.85)'); g.addColorStop(1, 'rgba(200,235,255,.9)');
        ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx, y0); ctx.lineTo(sx, y1); ctx.stroke();
        ctx.fillStyle = 'rgba(235,248,255,.9)';
        for (let i = 0; i < 5; i++) { const yy = y0 + ((i * 0.2 + s.t * 1.6) % 1) * (y1 - y0); ctx.beginPath(); ctx.ellipse(sx, yy, 2.2, 3.4, 0, 0, TAU); ctx.fill(); }
        rr(ctx, sx - 16, 0, 32, 14, 4); ctx.fillStyle = '#2a4a8a'; ctx.fill();
        txt(ctx, 'H₂O', sx, 7.5, { s: 10, w: 700, c: '#cfe8ff', al: 'center', bl: 'middle' });
      }
      // --- pipeta aforada (su posición depende de la etapa)
      const xm = M.cx, xf = F.cx;
      let x, y;
      if (P <= 0.30) { x = xm; y = lerp(L0.yHov, L0.yIn, sm(P / 0.30)); }
      else if (P <= 0.80) { x = xm; y = L0.yIn; }
      else if (P <= 1.05) { x = xm; y = lerp(L0.yIn, L0.yUp, sm((P - 0.8) / 0.25)); }
      else if (P <= 1.50) { x = lerp(xm, xf, sm((P - 1.05) / 0.45)); y = L0.yUp; }
      else if (P <= 1.70) { x = xf; y = lerp(L0.yUp, L0.yNeck, sm((P - 1.5) / 0.2)); }
      else if (P <= 2.0) { x = xf; y = L0.yNeck; }
      else if (P <= 2.25) { x = xf; y = lerp(L0.yNeck, L0.yUp, sm((P - 2.0) / 0.25)); }
      else { x = lerp(xf, xm, sm((P - 2.25) / 0.5)); y = L0.yUp; }
      const bulb = 0.085 + 0.05 * clamp(k.V0 / 50, 0, 1);
      const PP = makeVessel(PROF.pipeta(bulb), x, y, L0.Hp, 1);
      const lp = liq(intensD(k.C0));
      // hilo de líquido que cae de la punta a la fiola durante el vertido
      if (k.drain > 0.01 && k.drain < 0.99) {
        ctx.strokeStyle = rgba(lp.c, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, F.Y(Math.max(k.lvF, 0.01))); ctx.stroke();
      }
      drawLiquid(ctx, PP, { level: k.lvP, stops: [{ p: 0, c: lp.c, a: Math.min(1, lp.a + 0.15) }, { p: 1, c: lp.c, a: Math.min(1, lp.a + 0.1) }], t: s.t, amp: 0, cb: (c) => s.swP.draw(c, PP, L0.rpx * 0.55) });
      drawGlass(ctx, PP, { noHi: true, noLip: true });
      const gy = PP.Y(0.82), gw = PP.prof(0.82) * PP.H + 2;      // marca de aforo de la pipeta
      ctx.strokeStyle = 'rgba(255,209,102,.9)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x - gw, gy); ctx.lineTo(x + gw, gy); ctx.stroke();
      // --- rótulos
      const stage = P < 0.95 ? 'Tomar V₀ con la pipeta aforada' : P < 1.95 ? 'Verter V₀ en la fiola aforada' : P < 3.15 ? 'Añadir agua hasta la marca de aforo' : P < 3.9 ? 'Agitar: la disolución se homogeneiza' : 'Disolución hija lista: Cf = C₀·V₀ / Vf';
      const nStage = P < 0.95 ? 1 : P < 1.95 ? 2 : P < 3.15 ? 3 : 4;
      const ly = L0.yb + 17;
      txtFit(ctx, 'Solución madre · C₀ = ' + T(k.C0, 2) + ' mol/L', M.cx, ly, Math.max(90, 2.6 * L0.Hm * 0.7), { s: fs - 0.5, c: COL.txt2, al: 'center' });
      txtFit(ctx, 'Fiola aforada Vf = ' + T(k.Vf, 0) + ' mL', F.cx, ly, Math.max(90, 0.9 * L0.Hf), { s: fs - 0.5, c: COL.txt2, al: 'center' });
      txtFit(ctx, (k.Cf < 0.1 ? 'C = ' + T(k.Cf, 3) : 'C = ' + T(k.Cf, 2)) + ' mol/L', F.cx, F.yb - F.H * 0.30, 0.55 * F.H, { s: fs, w: 700, c: COL.amber, al: 'center', bl: 'middle' });
      const F_ = k.Vf / k.V0, fTxt = 'F = Vf/V₀ = ' + T(F_, F_ < 10 ? 2 : 1);
      ctx.font = '700 ' + (fs + 1) + 'px ' + FONT;
      const fw = ctx.measureText(fTxt).width + 20;
      pill(ctx, fTxt, w - fw / 2 - 8, h - 14, { s: fs + 1, c: COL.green, border: 'rgba(46,229,157,.55)' });
      txtFit(ctx, nStage + ' · ' + stage, 10, h - 10, w - fw - 36, { s: fs + 0.5, w: 600, c: COL.txt });
      // etiqueta del volumen de la pipeta
      txtFit(ctx, 'V₀ = ' + T(k.V0, 0) + ' mL', x + 14 + PP.prof(0.5) * PP.H, y - L0.Hp * 0.5, 80, { s: fs - 1, c: COL.cyan });
    },
    formula(p) {
      const Vf = Math.max(p.Vf, p.V0), Cf = p.C0 * p.V0 / Vf, F = Vf / p.V0;
      return 'C_0V_0=C_fV_f\\ \\Rightarrow\\ C_f=\\dfrac{C_0V_0}{V_f}=\\dfrac{' + L(p.C0, 2) + '\\times' + L(p.V0, 1) + '}{' + L(Vf, 1) + '}=' + Ls(Cf, 3) + '\\ \\mathrm{mol\\cdot L^{-1}}\\qquad F=\\dfrac{V_f}{V_0}=' + L(F, F < 10 ? 2 : 1);
    },
    lecturas(p) {
      const Vf = Math.max(p.Vf, p.V0), Cf = p.C0 * p.V0 / Vf;
      return [{ label: 'Cf', valor: Ts(Cf, 3) + ' mol·L⁻¹' }, { label: 'F', valor: T(Vf / p.V0, 2) }, { label: 'n tomada', valor: T(p.C0 * p.V0, 1) + ' mmol' }];
    },
  });

  // =================================================================================
  // 3) MASA-MOLAR — n = m / M
  //   Balanza con un montón de moléculas (nº ∝ n = m/M: 12 por mol, escala didáctica) a la izquierda,
  //   y a la derecha frascos de "1 mol" que se llenan: cada frasco contiene M gramos.
  // =================================================================================
  function layM(w, h) {
    const fs = fsOf(w, h), yb = h - 36, Lw = Math.max(150, w * 0.46);
    const bw = Math.min(Lw * 0.92, 290), bh = bw * 0.3, cxB = Lw / 2 + 4;
    const yPan = yb - bh - bw * 0.26;
    return { fs, yb, Lw, bw, bh, cxB, yPan, panW: bw * 0.84 };
  }
  /** Posición (x,y) y tamaño del grano i en el montón triangular de G granos. */
  function pileXY(i, G, L0, M) {
    const L1 = Math.max(1, Math.ceil((Math.sqrt(8 * G + 1) - 1) / 2));
    const availH = L0.yPan - 16;
    const dmax = clamp(L0.fs * 1.55, 12, 24) * (0.8 + 0.35 * Math.pow(M / 250, 0.4));
    const d = Math.min(dmax, (L0.panW * 0.94) / L1, availH / (0.87 * L1 + 0.6));
    let r = 0, c = i;
    while (c >= L1 - r && r < L1) { c -= L1 - r; r++; }
    const len = L1 - r;
    return { x: L0.cxB + (c - (len - 1) / 2) * d + Math.sin(i * 12.9898) * 0.05 * d, y: L0.yPan - d * 0.5 - r * d * 0.866, d };
  }

  reg('masa-molar', {
    titulo: 'Cantidad de materia y masa molar', materia: 'chimie',
    params: [
      { id: 'm', label: 'Masa de la muestra m', min: 1, max: 200, step: 0.5, def: 30, unit: 'g' },
      { id: 'M', label: 'Masa molar M', min: 1, max: 250, step: 0.5, def: 60, unit: 'g/mol' },
    ],
    create(host, p) {
      return { t: 0, red: !!host.reduced, g: [], disp: 0, jf: new Array(14).fill(0), lay: layM(host.w, host.h), dsz: 14 };
    },
    step(s, dt, p) {
      s.t += dt;
      const n = p.m / p.M, G = clamp(Math.round(n * 12), 2, 150), L0 = s.lay;
      s.disp = approach(s.disp, p.m, 4, dt);
      // altas/bajas de granos (los de arriba del montón se van primero)
      let alive = 0; for (const g of s.g) if (!g.dying) alive++;
      for (let k = alive; k < G; k++) { const t = pileXY(s.g.length, G, L0, p.M); s.g.push({ x: t.x + (rnd() - 0.5) * 8, y: t.y - 70, a: 0, dying: false, sp: (() => { const r = rnd(); return r < 0.62 ? SPC.grano : r < 0.9 ? SPC.grano2 : SPC.grano3; })() }); }
      if (alive > G) { let kill = alive - G; for (let i = s.g.length - 1; i >= 0 && kill > 0; i--) if (!s.g[i].dying) { s.g[i].dying = true; kill--; } }
      let slot = 0;
      for (let i = 0; i < s.g.length; i++) {
        const g = s.g[i];
        if (g.dying) { g.a -= dt * 3; g.y -= dt * 14; continue; }
        const t = pileXY(slot++, G, L0, p.M);
        g.a = Math.min(1, g.a + dt * 3);
        g.x = approach(g.x, t.x, 9, dt); g.y = approach(g.y, t.y, 9, dt); g.d = approach(g.d || t.d, t.d, 6, dt);
      }
      s.g = s.g.filter((g) => !(g.dying && g.a <= 0));
      // frascos: fracción de llenado de cada uno
      const u = n <= 12 ? 1 : n <= 120 ? 10 : 100;
      for (let k = 0; k < s.jf.length; k++) s.jf[k] = approach(s.jf[k], k < Math.ceil(n / u) ? clamp(n / u - k, 0, 1) : 0, 6, dt);
    },
    draw(s, ctx, w, h, p) {
      const L0 = (s.lay = layM(w, h)), fs = L0.fs, n = p.m / p.M, u = n <= 12 ? 1 : n <= 120 ? 10 : 100;
      bg(ctx, w, h);
      table(ctx, w, h, L0.yb);
      // ---------- balanza
      const { cxB: cx, yb, bw, bh, yPan } = L0;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(cx, yb + 3, bw * 0.55, 6, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
      // base metálica
      rr(ctx, cx - bw / 2, yb - bh, bw, bh, 12);
      const gb = ctx.createLinearGradient(0, yb - bh, 0, yb);
      gb.addColorStop(0, '#3a4a86'); gb.addColorStop(0.15, '#2b3868'); gb.addColorStop(1, '#161e3f');
      ctx.fillStyle = gb; ctx.fill(); ctx.strokeStyle = 'rgba(150,180,255,.4)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, cx - bw / 2 + 5, yb - bh + 3, bw - 10, 3, 1.5); ctx.fill();
      // pantalla LCD
      const dw = bw * 0.62, dh = bh * 0.5, dx = cx - dw / 2, dy = yb - bh + bh * 0.28;
      rr(ctx, dx, dy, dw, dh, 5); ctx.fillStyle = '#071410'; ctx.fill(); ctx.strokeStyle = 'rgba(120,255,190,.35)'; ctx.stroke();
      txtFit(ctx, T(s.disp, 1) + ' g', cx + dw / 2 - 8, dy + dh / 2 + 1, dw - 16, { s: dh * 0.7, f: MONO, w: 700, c: '#7dffb0', al: 'right', bl: 'middle' });
      // columna + plato
      const pw = L0.panW;
      ctx.fillStyle = '#26325f'; ctx.fillRect(cx - 5, yPan, 10, yb - bh - yPan + 2);
      const gp = ctx.createLinearGradient(0, yPan, 0, yPan + 9);
      gp.addColorStop(0, '#b7c6f0'); gp.addColorStop(1, '#5d6ea8');
      rr(ctx, cx - pw / 2, yPan, pw, 8, 4); ctx.fillStyle = gp; ctx.fill();
      ctx.restore();
      // ---------- granos (moléculas) sobre el plato
      for (const g of s.g) {
        if (g.a <= 0.02) continue;
        const dd = g.d || 12;
        drawMol(ctx, g.sp, g.x, g.y, dd * 0.5 * 0.92, 0, g.a);
      }
      ctx.globalAlpha = 1;
      txtFit(ctx, 'm = ' + T(p.m, 1) + ' g', 12, fs + 8, L0.Lw - 16, { s: fs + 1, w: 700, c: COL.cyan });
      txtFit(ctx, 'N = ' + sciT(n * 6.022e23, 2) + ' moléculas', cx, yb + 19, L0.Lw - 6, { s: fs - 1, c: COL.txt2, al: 'center' });
      // ---------- frascos de 1 mol
      const ax0 = L0.Lw + 14, ax1 = w - 12, ay0 = 52, ay1 = yb - 10, aw = ax1 - ax0, ah = ay1 - ay0;
      const J = Math.max(1, Math.ceil(n / u));
      let best = { cell: 0, cols: 1 };
      for (let c = 1; c <= 6; c++) { const r = Math.ceil(J / c), cell = Math.min(aw / c, ah / r / 1.25); if (cell > best.cell) best = { cell, cols: c }; }
      const cell = Math.min(best.cell, 96), cols = best.cols, rowsN = Math.ceil(J / cols);
      const jw = cell * 0.74, jh = jw * 1.18;
      const gx0 = ax0 + (aw - cols * cell) / 2, gy0 = ay0 + (ah - rowsN * cell * 1.25) / 2;
      txtFit(ctx, u === 1 ? '1 frasco = 1 mol = M = ' + T(p.M, 1) + ' g' : '1 frasco = ' + u + ' mol = ' + T(p.M * u, 0) + ' g', (ax0 + ax1) / 2, 22, aw, { s: fs + 0.5, w: 700, c: COL.amber, al: 'center' });
      txtFit(ctx, '(' + (u === 1 ? '6,02×10²³' : u + ' × 6,02×10²³') + ' entidades en cada frasco)', (ax0 + ax1) / 2, 22 + fs + 5, aw, { s: fs - 1.5, c: COL.txt2, al: 'center' });
      for (let k = 0; k < J; k++) {
        const col = k % cols, row = (k / cols) | 0, jx = gx0 + col * cell + (cell - jw) / 2, jy = gy0 + row * cell * 1.25 + (cell * 1.25 - jh) / 2, f = s.jf[k] || 0;
        // vidrio del frasco + cuello
        rr(ctx, jx, jy + jh * 0.12, jw, jh * 0.88, jw * 0.16);
        ctx.fillStyle = 'rgba(160,200,255,.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(205,230,255,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
        rr(ctx, jx + jw * 0.16, jy, jw * 0.68, jh * 0.16, 2.5); ctx.fillStyle = 'rgba(120,150,230,.55)'; ctx.fill();
        // granos dentro (3 columnas × 4 filas = 12 granos = 1 mol)
        const cnt = Math.round(12 * f), gr = jw * 0.1;
        for (let i = 0; i < cnt; i++) {
          const ci = i % 3, ri = (i / 3) | 0;
          drawMol(ctx, i % 3 === 2 ? SPC.grano2 : SPC.grano, jx + jw * (0.22 + 0.28 * ci), jy + jh * (0.86 - 0.17 * ri), gr * 1.15, 0, 1);
        }
        ctx.globalAlpha = 1;
        if (f > 0.01 && f < 0.99) txt(ctx, T(f, 2) + ' mol', jx + jw / 2, jy + jh + 12, { s: fs - 2, c: COL.txt2, al: 'center' });
        else if (k === 0) txt(ctx, T(u, 0) + ' mol', jx + jw / 2, jy + jh + 12, { s: fs - 2, c: COL.txt2, al: 'center' });
        const gl = ctx.createLinearGradient(jx, 0, jx + jw, 0); gl.addColorStop(0, 'rgba(255,255,255,.28)'); gl.addColorStop(0.18, 'rgba(255,255,255,0)');
        rr(ctx, jx + 1, jy + jh * 0.16, jw * 0.45, jh * 0.8, jw * 0.12); ctx.fillStyle = gl; ctx.fill();
      }
      if (aw > 130) txtFit(ctx, 'n = m / M = ' + T(n, n < 10 ? 3 : 1) + ' mol  →  ' + T(n / u, 2) + ' frasco' + (n / u >= 1.5 ? 's' : ''), (ax0 + ax1) / 2, yb + 19, aw, { s: fs, w: 600, c: COL.green, al: 'center' });
    },
    formula(p) {
      const n = p.m / p.M;
      return 'n=\\dfrac{m}{M}=\\dfrac{' + L(p.m, 1) + '\\ \\mathrm{g}}{' + L(p.M, 1) + '\\ \\mathrm{g\\cdot mol^{-1}}}=' + Ls(n, 3) + '\\ \\mathrm{mol}';
    },
    lecturas(p) {
      const n = p.m / p.M;
      return [{ label: 'n', valor: Ts(n, 3) + ' mol' }, { label: 'N = n·N_A', valor: sciT(n * 6.022e23, 2) + ' entidades' }];
    },
  });

  // =================================================================================
  // 4) PH — pH = −log([H₃O⁺]/c°)       (c° = 1 mol/L; a 25 °C: [H₃O⁺]·[HO⁻] = Ke = 10⁻¹⁴)
  //   Vaso con indicador universal (colores aproximados), iones H₃O⁺ (rojo) y HO⁻ (azul) y tira de pH.
  //   SIMPLIFICACIÓN: el nº de iones dibujados sigue la escala LOGARÍTMICA log([ion]/Ke):
  //   H₃O⁺ ∝ (14 − pH), HO⁻ ∝ pH. Con la escala real, a pH 7 habría 10⁷ veces menos iones que a pH 0.
  // =================================================================================
  const UNIV = [[229, 25, 43], [233, 52, 43], [240, 92, 35], [244, 138, 30], [248, 178, 28], [252, 222, 31], [190, 214, 48], [63, 174, 73], [28, 158, 140], [37, 120, 190], [58, 84, 170], [92, 63, 152], [112, 48, 140], [124, 38, 128], [130, 32, 120]];
  /** Color del indicador universal para un pH continuo (0..14). */
  function univ(pH) {
    const x = clamp(pH, 0, 14), i = Math.min(13, x | 0);
    return mixC(UNIV[i], UNIV[i + 1], x - i);
  }
  function layP(w, h) {
    const wide = w >= 560, fs = fsOf(w, h);
    let strip, vTop;
    if (wide) { strip = { x0: w * 0.5, x1: w - 26, pillY: 30, y: 52, h: 24 }; vTop = 20; }
    else { strip = { x0: 14, x1: w - 14, pillY: 15, y: 34, h: 16 }; vTop = 74; }
    const bot = 40, yb = h - bot;
    const H = Math.max(80, Math.min(yb - vTop, (wide ? w * 0.36 : w * 0.5) / 0.8));
    const cx = wide ? w * 0.26 : Math.max(0.4 * H + 12, w * 0.3);
    return { wide, fs, strip, yb, H, cx, V: makeVessel(PROF.beaker(0.4, 0.07), cx, yb, H, 3.5), rpx: clamp(H / 56, 3.6, 7.5) };
  }

  reg('ph', {
    titulo: 'pH de una disolución', materia: 'chimie',
    params: [{ id: 'pH', label: 'pH', min: 0, max: 14, step: 0.1, def: 4, unit: '' }],
    create(host, p) {
      return { t: 0, red: !!host.reduced, pHd: p.pH, sw: new Swarm([SPC.h3o, SPC.ho, SPC.aguaTenue]), lay: layP(host.w, host.h) };
    },
    step(s, dt, p) {
      s.t += dt;
      s.pHd = approach(s.pHd, p.pH, 6, dt);
      const L0 = s.lay, Nmax = s.red ? 34 : 64, Nw = s.red ? 14 : 38;
      const sp = (k, sw) => sw.add(k, (rnd() - 0.5) * 0.6, 0.04 + rnd() * 0.5);
      s.sw.sync([Math.round(Nmax * (14 - p.pH) / 14), Math.round(Nmax * p.pH / 14), Nw], sp, dt);
      s.sw.step(dt, { hw: L0.V.hwIn, ymin: 0, ymax: 0.62, ru: L0.rpx / L0.V.H, speed: s.red ? 0.045 : 0.085 });
    },
    draw(s, ctx, w, h, p) {
      const L0 = (s.lay = layP(w, h)), V = L0.V, fs = L0.fs, pH = s.pHd, st = L0.strip;
      bg(ctx, w, h);
      table(ctx, w, h, L0.yb);
      const ci = univ(pH);
      shadow(ctx, L0.yb, L0.cx, 0.4 * L0.H, ci, 0.32);
      drawLiquid(ctx, V, { level: 0.62, stops: [{ p: 0, c: ci, a: 0.62 }, { p: 1, c: ci, a: 0.5 }], t: s.t, amp: s.red ? 0 : 0.9, cb: (c) => s.sw.draw(c, V, L0.rpx) });
      drawGlass(ctx, V);
      drawTicks(ctx, V, [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((y, i) => ({ y, big: i % 2 === 0 })), fs);
      // ---- tira de pH
      const sw = st.x1 - st.x0, X = (v) => st.x0 + sw * v / 14;
      const gr = ctx.createLinearGradient(st.x0, 0, st.x1, 0);
      UNIV.forEach((c, i) => gr.addColorStop(i / 14, rgba(c, 1)));
      rr(ctx, st.x0, st.y, sw, st.h, st.h / 2); ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(ctx, st.x0 + 4, st.y + 2, sw - 8, st.h * 0.28, st.h * 0.14); ctx.fill();
      const step = L0.wide ? 1 : 2;
      for (let v = 0; v <= 14; v += step) txt(ctx, String(v), X(v), st.y + st.h + 13, { s: fs - 1.5, c: COL.txt2, al: 'center' });
      if (L0.wide) {
        txt(ctx, 'ÁCIDA', X(3.5), st.y + st.h + 31, { s: fs - 1, w: 700, c: '#ff8a8a', al: 'center' });
        txt(ctx, 'NEUTRA', X(7), st.y + st.h + 31, { s: fs - 1, w: 700, c: '#7be0a0', al: 'center' });
        txt(ctx, 'BÁSICA', X(10.5), st.y + st.h + 31, { s: fs - 1, w: 700, c: '#8fb0ff', al: 'center' });
      }
      // marcador
      const mx = X(pH);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.beginPath(); ctx.moveTo(mx, st.y - 1); ctx.lineTo(mx - 6, st.y - 9); ctx.lineTo(mx + 6, st.y - 9); ctx.closePath(); ctx.fill();
      ctx.fillRect(mx - 1, st.y - 2, 2, st.h + 4);
      pill(ctx, 'pH = ' + T(pH, 1), clamp(mx, st.x0 + 40, st.x1 - 40), st.pillY, { s: fs + 2, c: COL.txt, border: rgba(ci, 0.9) });
      // ---- lecturas de concentración
      const hc = Math.pow(10, -pH), oc = Math.pow(10, pH - 14);
      const nP = s.sw.alive(0), nM = s.sw.alive(1);
      if (L0.wide) {
        const x0 = st.x0, cw = st.x1 - st.x0, y0 = st.y + st.h + 52, ch = Math.min(L0.yb - y0 - 4, 150);
        card(ctx, x0, y0, cw, ch, 12);
        blit(ctx, SPC.h3o.c, 6.5, x0 + 22, y0 + 28, '+');
        txtFit(ctx, '[H₃O⁺] = ' + sciT(hc, 1) + ' mol·L⁻¹', x0 + 40, y0 + 33, cw - 56, { s: fs + 3, w: 700, c: '#ff8a8e' });
        blit(ctx, SPC.ho.c, 6.5, x0 + 22, y0 + 62, '-');
        txtFit(ctx, '[HO⁻] = ' + sciT(oc, 1) + ' mol·L⁻¹', x0 + 40, y0 + 67, cw - 56, { s: fs + 3, w: 700, c: '#8fc3ff' });
        txtFit(ctx, '[H₃O⁺] · [HO⁻] = Ke = 1,0×10⁻¹⁴  (25 °C)', x0 + 16, y0 + 96, cw - 30, { s: fs, c: COL.txt2 });
        txtFit(ctx, 'iones dibujados: ' + nP + ' H₃O⁺ · ' + nM + ' HO⁻  (escala log, ilustrativa)', x0 + 16, y0 + 118, cw - 30, { s: fs - 1, c: COL.txt2 });
        if (ch > 140) txtFit(ctx, pH < 6.95 ? 'Medio ácido: [H₃O⁺] > [HO⁻]' : pH > 7.05 ? 'Medio básico: [HO⁻] > [H₃O⁺]' : 'Medio neutro: [H₃O⁺] = [HO⁻]', x0 + 16, y0 + 140, cw - 30, { s: fs, w: 600, c: COL.green });
      } else {
        const x0 = L0.cx + 0.4 * L0.H + 36, cw = w - x0 - 8, y0 = L0.yb - L0.H * 0.62 - 6;
        if (cw > 70) {
          txtFit(ctx, '[H₃O⁺]', x0, y0 + 10, cw, { s: fs - 1, c: '#ff8a8e', w: 700 });
          txtFit(ctx, sciT(hc, 1), x0, y0 + 10 + fs + 2, cw, { s: fs + 2, c: COL.txt, w: 700 });
          txtFit(ctx, '[HO⁻]', x0, y0 + 10 + 2 * fs + 16, cw, { s: fs - 1, c: '#8fc3ff', w: 700 });
          txtFit(ctx, sciT(oc, 1), x0, y0 + 10 + 3 * fs + 18, cw, { s: fs + 2, c: COL.txt, w: 700 });
          txt(ctx, 'mol·L⁻¹', x0, y0 + 10 + 4 * fs + 24, { s: fs - 1.5, c: COL.txt2 });
        }
      }
    },
    formula(p) {
      const hc = Math.pow(10, -p.pH);
      return '\\mathrm{pH}=-\\log\\left(\\dfrac{[\\mathrm{H_3O^+}]}{c^\\circ}\\right)=-\\log\\left(\\dfrac{' + sciL(hc, 1) + '}{1}\\right)=' + L(p.pH, 1);
    },
    lecturas(p) {
      return [{ label: '[H₃O⁺]', valor: sciT(Math.pow(10, -p.pH), 1) + ' mol·L⁻¹' }, { label: '[HO⁻]', valor: sciT(Math.pow(10, p.pH - 14), 1) + ' mol·L⁻¹' },
        { label: 'medio', valor: p.pH < 6.95 ? 'ácido' : p.pH > 7.05 ? 'básico' : 'neutro' }];
    },
  });

  // =================================================================================
  // 5) ACIDO-BASE — AH + H₂O ⇌ A⁻ + H₃O⁺ ;  pH = pKa + log([A⁻]/[AH])  (Henderson–Hasselbalch)
  //   Moléculas AH (con su protón H⁺ visible) y A⁻ en una cubeta. Los protones saltan de un AH a un A⁻
  //   pasando por una molécula de agua (mecanismo de relevo, simplificado): el equilibrio es DINÁMICO,
  //   las proporciones de AH/A⁻ se mantienen mientras intercambian protones sin cesar.
  //   Debajo, el diagrama de predominio: frontera en pH = pKa, marcador en el pH de la disolución.
  // =================================================================================
  function layAB(w, h) {
    const fs = fsOf(w, h), top = 10, H = clamp(h * 0.58 - 10, 110, 400), yb = top + H, hw0 = (w - 28) / 2 / H;
    const barH = clamp(h * 0.065, 14, 22), barY = yb + 46;
    return { fs, top, H, yb, barH, barY, x0: 28, x1: w - 28, V: makeVessel(PROF.box(hw0, 0.05), w / 2, yb, H, 3), rpx: clamp(H / 24, 4.6, 9) };
  }
  const nearest = (list, ref) => { let b = null, bd = 1e9; for (const q of list) { const d = (q.x - ref.x) ** 2 + (q.y - ref.y) ** 2; if (d < bd) { bd = d; b = q; } } return b; };

  reg('acido-base', {
    titulo: 'Par ácido/base: pKa y pH', materia: 'chimie',
    params: [
      { id: 'pKa', label: 'pKa del par AH/A⁻', min: 0, max: 14, step: 0.1, def: 4.8, unit: '' },
      { id: 'pH', label: 'pH de la disolución', min: 0, max: 14, step: 0.1, def: 6, unit: '' },
    ],
    create(host, p) {
      const L0 = layAB(host.w, host.h), red = !!host.reduced, N = red ? 22 : 34, NW = red ? 8 : 14;
      const s = { t: 0, red, N, NW, pHd: p.pH, ex: 0, cv: 0, hops: [], sw: new Swarm([SPC.AH, SPC.A, SPC.aguaTenue]), lay: L0 };
      const R = Math.pow(10, p.pH - p.pKa), alpha = R / (1 + R), hw = L0.V.hwIn(0.4) * 0.92;
      for (let i = 0; i < N; i++) { const q = s.sw.add(0, (rnd() * 2 - 1) * hw, 0.05 + rnd() * 0.78); q.hasH = i >= Math.round(N * alpha); }
      for (let i = 0; i < NW; i++) s.sw.add(2, (rnd() * 2 - 1) * hw, 0.05 + rnd() * 0.78);
      return s;
    },
    step(s, dt, p) {
      s.t += dt;
      s.pHd = approach(s.pHd, p.pH, 6, dt);
      const L0 = s.lay, V = L0.V, red = s.red;
      const R = Math.pow(10, p.pH - p.pKa), alpha = R / (1 + R);
      const mols = [], wat = [];
      for (const q of s.sw.q) (q.s === 2 ? wat : mols).push(q);
      const N = mols.length, tgtAH = Math.round(N * (1 - alpha));
      let ah = 0, pend = 0;
      for (const m of mols) if (m.hasH) ah++;
      for (const h of s.hops) if (h.gain) pend++;
      const eff = ah + pend;                      // protones ligados + los que están a punto de ligarse
      // 1) ajuste de la proporción cuando cambia el pH o el pKa: un protón pasa a/de una molécula de agua
      s.cv += dt;
      if (s.cv > 0.1 && wat.length) {
        s.cv = 0;
        if (eff > tgtAH) {
          const c = mols.filter((m) => m.hasH && !m.busy);
          if (c.length) { const d = c[(rnd() * c.length) | 0]; d.hasH = false; d.busy = true; s.hops.push({ from: d, via: null, to: nearest(wat, d), gain: false, t: 0, dur: 0.85 }); }
        } else if (eff < tgtAH) {
          const c = mols.filter((m) => !m.hasH && !m.busy);
          if (c.length) { const a = c[(rnd() * c.length) | 0]; a.busy = true; s.hops.push({ from: nearest(wat, a), via: null, to: a, gain: true, t: 0, dur: 0.85 }); }
        }
      }
      // 2) intercambio de equilibrio AH → A⁻ (el nº de AH y A⁻ no cambia, sólo cambian de "identidad")
      s.ex += dt * (red ? 1.2 : 2.6);
      if (s.ex >= 1 && wat.length) {
        s.ex = 0;
        const dn = mols.filter((m) => m.hasH && !m.busy), ac = mols.filter((m) => !m.hasH && !m.busy);
        if (dn.length && ac.length) {
          const d = dn[(rnd() * dn.length) | 0];
          let a = null, bd = 1e9;
          for (let k = 0; k < 4; k++) { const c = ac[(rnd() * ac.length) | 0], dd = (c.x - d.x) ** 2 + (c.y - d.y) ** 2; if (dd < bd) { bd = dd; a = c; } }
          d.hasH = false; d.busy = true; a.busy = true;
          s.hops.push({ from: d, via: nearest(wat, { x: (d.x + a.x) / 2, y: (d.y + a.y) / 2 }), to: a, gain: true, t: 0, dur: 1.05 });
        }
      }
      // 3) avance de los saltos
      for (let i = s.hops.length - 1; i >= 0; i--) {
        const h = s.hops[i];
        h.t += dt;
        const u = h.t / h.dur;
        if (h.via) h.via.glow = Math.max(h.via.glow, clamp(1 - Math.abs(u - 0.5) * 3.4, 0, 1));
        if (h.from.s === 2) h.from.glow = Math.max(h.from.glow, 1 - u);
        if (u >= 1) {
          if (h.gain) h.to.hasH = true;
          if (h.to.s === 2) h.to.glow = 1; else h.to.busy = false;
          if (h.from.s !== 2) h.from.busy = false;
          s.hops.splice(i, 1);
        }
      }
      s.sw.step(dt, { hw: V.hwIn, ymin: 0, ymax: 0.9, ru: L0.rpx / V.H, speed: red ? 0.05 : 0.09 });
    },
    draw(s, ctx, w, h, p) {
      const L0 = (s.lay = layAB(w, h)), V = L0.V, fs = L0.fs, pH = s.pHd, pKa = p.pKa;
      const R = Math.pow(10, p.pH - pKa), alpha = R / (1 + R);
      bg(ctx, w, h);
      // estante
      ctx.fillStyle = 'rgba(150,180,255,.22)'; ctx.fillRect(10, L0.yb + 2, w - 20, 1);
      const tint = mixC(hex('#2ee59d'), hex('#ff4fb0'), alpha);
      drawLiquid(ctx, V, { level: 0.9, stops: [{ p: 0, c: tint, a: 0.2 }, { p: 1, c: tint, a: 0.13 }], t: s.t, amp: s.red ? 0 : 0.9, cb: (c) => {
        const pick = (q) => (q.s === 2 ? 2 : q.hasH ? 0 : 1);
        // brillo rojizo sobre el agua que hace de relevo (H₃O⁺ transitorio)
        for (const q of s.sw.q) if (q.s === 2 && q.glow > 0.02) {
          const gx = V.cx + q.x * V.H, gy = V.Y(q.y);
          c.globalAlpha = q.glow * 0.9; blit(c, SPC.h3o.c, L0.rpx * 1.35, gx, gy, '+'); c.globalAlpha = 1;
        }
        s.sw.draw(c, V, L0.rpx, pick);
        // protones en vuelo (con estela)
        for (const hp of s.hops) {
          const pos = (u) => {
            const e = sm(clamp(u, 0, 1)), a = hp.from, b = hp.to, v = hp.via;
            let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y, t = e;
            if (v) { if (e < 0.5) { x1 = v.x; y1 = v.y; t = e * 2; } else { x0 = v.x; y0 = v.y; t = (e - 0.5) * 2; } }
            return [V.cx + lerp(x0, x1, sm(t)) * V.H, V.Y(lerp(y0, y1, sm(t))) - Math.sin(Math.PI * t) * L0.rpx * 2.4];
          };
          const u = hp.t / hp.dur;
          for (let k = 3; k >= 1; k--) { const pp = pos(u - k * 0.05); c.globalAlpha = 0.18 * (4 - k); blit(c, HC, L0.rpx * 0.55, pp[0], pp[1], null); }
          c.globalAlpha = 1;
          const pp = pos(u); blit(c, HC, L0.rpx * 0.7, pp[0], pp[1], null);
        }
      } });
      drawGlass(ctx, V, { noHi: false });
      // leyenda dentro de la cubeta
      const lx = V.cx - V.hwIn(0.5) * V.H + 14, ly = L0.top + 6 + fs;
      let xx = lx;
      const leg = [[SPC.AH.c, 'AH (ácido)', null], [SPC.A.c, 'A⁻ (base conjugada)', '-'], [HC, 'H⁺ (protón)', null], [SPC.aguaTenue.c, 'H₂O', null]];
      leg.forEach(([c, t, g]) => {
        blit(ctx, c, fs * 0.55, xx + 5, ly - fs * 0.32, g);
        ctx.font = '600 ' + (fs - 1) + 'px ' + FONT;
        txt(ctx, t, xx + 14, ly, { s: fs - 1, w: 600, c: COL.txt2 });
        xx += 14 + ctx.measureText(t).width + 16;
      });
      // ---- diagrama de predominio
      const x0 = L0.x0, x1 = L0.x1, bw = x1 - x0, X = (v) => x0 + bw * v / 14, by = L0.barY, bh = L0.barH;
      const cAH = hex('#2ee59d'), cA = hex('#ff4fb0');
      const xk = X(clamp(pKa, 0, 14));
      ctx.save();
      rr(ctx, x0, by, bw, bh, 5); ctx.clip();
      let g1 = ctx.createLinearGradient(x0, 0, xk, 0); g1.addColorStop(0, rgba(cAH, 0.55)); g1.addColorStop(1, rgba(cAH, 0.32));
      ctx.fillStyle = g1; ctx.fillRect(x0, by, xk - x0, bh);
      let g2 = ctx.createLinearGradient(xk, 0, x1, 0); g2.addColorStop(0, rgba(cA, 0.32)); g2.addColorStop(1, rgba(cA, 0.55));
      ctx.fillStyle = g2; ctx.fillRect(xk, by, x1 - xk, bh);
      ctx.restore();
      rr(ctx, x0, by, bw, bh, 5); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1; ctx.stroke();
      if (xk - x0 > 60) txt(ctx, 'AH predomina', (x0 + xk) / 2, by + bh / 2 + 1, { s: fs - 0.5, w: 700, c: '#bdf7dc', al: 'center', bl: 'middle' });
      if (x1 - xk > 60) txt(ctx, 'A⁻ predomina', (xk + x1) / 2, by + bh / 2 + 1, { s: fs - 0.5, w: 700, c: '#ffc2e3', al: 'center', bl: 'middle' });
      for (let v = 0; v <= 14; v += (w < 560 ? 2 : 1)) txt(ctx, String(v), X(v), by + bh + 13, { s: fs - 1.5, c: COL.txt2, al: 'center' });
      // frontera pKa
      ctx.setLineDash([4, 3]); ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(xk, by - 6); ctx.lineTo(xk, by + bh + 3); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, 'pKa = ' + T(pKa, 1), xk, by - 10, { s: fs, w: 700, c: COL.amber, al: 'center' });
      // marcador de pH
      const mx = X(pH);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(mx, by + bh + 1); ctx.lineTo(mx - 6, by + bh + 10); ctx.lineTo(mx + 6, by + bh + 10); ctx.closePath(); ctx.fill();
      ctx.fillRect(mx - 1, by - 2, 2, bh + 4);
      pill(ctx, 'pH = ' + T(pH, 1), clamp(mx, x0 + 42, x1 - 42), L0.yb + 21, { s: fs + 1, border: 'rgba(255,255,255,.5)' });
      // lecturas
      const ratioT = R >= 0.01 && R < 1000 ? Ts(R, 3) : sciT(R, 1);
      const yL = by + bh + 34, pc = Math.round(alpha * 100);
      txtFit(ctx, 'pH − pKa = ' + T(p.pH - pKa, 1) + '   →   [A⁻]/[AH] = 10^' + T(p.pH - pKa, 1) + ' = ' + ratioT, w / 2, yL, w - 30, { s: fs + 1, w: 700, c: COL.txt, al: 'center' });
      txtFit(ctx, 'AH: ' + (100 - pc) + ' %     A⁻: ' + pc + ' %     ·     ' + (p.pH < pKa - 0.05 ? 'predomina AH (pH < pKa)' : p.pH > pKa + 0.05 ? 'predomina A⁻ (pH > pKa)' : 'pH = pKa: [A⁻] = [AH]'), w / 2, yL + fs + 8, w - 30, { s: fs, c: COL.txt2, al: 'center' });
    },
    formula(p) {
      const d = p.pH - p.pKa, R = Math.pow(10, d);
      const Rl = R >= 0.01 && R < 1000 ? Ls(R, 3) : sciL(R, 1);
      return '\\mathrm{pH}=\\mathrm{p}K_a+\\log\\dfrac{[\\mathrm{A^-}]}{[\\mathrm{AH}]}\\ \\Rightarrow\\ \\dfrac{[\\mathrm{A^-}]}{[\\mathrm{AH}]}=10^{\\mathrm{pH}-\\mathrm{p}K_a}=10^{' + L(p.pH, 1) + '-' + L(p.pKa, 1) + '}=' + Rl;
    },
    lecturas(p) {
      const R = Math.pow(10, p.pH - p.pKa), a = R / (1 + R);
      return [{ label: '[A⁻]/[AH]', valor: R >= 0.01 && R < 1000 ? Ts(R, 3) : sciT(R, 1) }, { label: 'A⁻', valor: Math.round(a * 100) + ' %' }, { label: 'AH', valor: (100 - Math.round(a * 100)) + ' %' },
        { label: 'predomina', valor: p.pH < p.pKa - 0.05 ? 'AH' : p.pH > p.pKa + 0.05 ? 'A⁻' : 'AH = A⁻' }];
    },
  });

  // =================================================================================
  // 6) TITRAGE — valoración de un ácido fuerte (HCl, Ca, Va) con una base fuerte (NaOH, Cb) en el erlenmeyer
  //   Reacción de valoración:  H₃O⁺ + HO⁻ → 2 H₂O   (total, K = 1/Ke = 10¹⁴)
  //   Cálculo del pH (25 °C), con n_a = Ca·Va y n_b = Cb·Vb (mmol), V_total = Va + Vb (mL):
  //     x = [H₃O⁺] − [HO⁻] = (n_a − n_b)/V_total ;  con Ke = [H₃O⁺][HO⁻]  →  [H₃O⁺]² − x[H₃O⁺] − Ke = 0
  //   · Vb < Véq : [H₃O⁺] ≈ (n_a − n_b)/V_total          → pH = −log[H₃O⁺]
  //   · Vb = Véq : [H₃O⁺] = [HO⁻] = √Ke                  → pH = 7
  //   · Vb > Véq : [HO⁻] ≈ (n_b − n_a)/V_total           → pH = 14 + log[HO⁻]
  //   (la resolución de la cuadrática da las tres zonas en una sola fórmula continua). Véq = Ca·Va/Cb.
  //   Indicador: azul de bromotimol (zona de viraje 6,0 – 7,6): amarillo → verde → azul.
  //   SIMPLIFICACIÓN: nº de partículas relativo (28 H₃O⁺ iniciales ↔ n_a); los iones Cl⁻ y Na⁺ son espectadores.
  //   LÍMITE CONOCIDO: el deslizador Vb llega a 60 mL; si Véq = Ca·Va/Cb > 60 mL la equivalencia no se alcanza.
  // =================================================================================
  const ERL = PROF.erlen(), ERL_TBL = volTable(ERL), ERL_VCAP = volAt(ERL_TBL, 0.62);
  const lvErl = (V) => levelForVol(ERL_TBL, clamp(V / 125, 0, 1.3) * ERL_VCAP);   // erlenmeyer de 125 mL
  const KE = 1e-14;
  /** pH exacto (incluye la autoprotólisis del agua) en función del volumen versado. */
  function pHtit(Ca, Va, Cb, Vb) {
    const x = (Ca * Va - Cb * Vb) / (Va + Vb);                // [H₃O⁺] − [HO⁻]  (mol/L, porque mmol/mL)
    const hh = x >= 0 ? (x + Math.sqrt(x * x + 4 * KE)) / 2 : (2 * KE) / (-x + Math.sqrt(x * x + 4 * KE)); // forma estable
    return -Math.log10(hh);
  }
  const BBT = { y: [255, 214, 30], g: [76, 190, 90], b: [40, 110, 220] };
  /** Color del azul de bromotimol según el pH. */
  function bbt(pH) {
    if (pH <= 6) return BBT.y;
    if (pH < 6.8) return mixC(BBT.y, BBT.g, sm((pH - 6) / 0.8));
    if (pH < 7.6) return mixC(BBT.g, BBT.b, sm((pH - 6.8) / 0.8));
    return BBT.b;
  }
  const TSPC = [SPC.h3o, SPC.cl, SPC.na, SPC.ho, SPC.agua];     // H₃O⁺, Cl⁻, Na⁺, HO⁻, H₂O (producto)

  function layT(w, h) {
    const wide = w >= 560, fs = fsOf(w, h), appW = clamp(w * (wide ? 0.34 : 0.4), 130, 330), cx = appW / 2 + (wide ? 18 : 6);
    const yb = h - 34, yTop = 12, yTip = Math.round(h * 0.44), yS = yTip - 12, Hb = yS - yTop, Hv = yb - (yTip + 20);
    const hwB = clamp(h * 0.02, 4.5, 8);
    return { wide, fs, appW, cx, yb, yTop, yTip, yS, Hb, Hv, hwB,
      B: makeVessel(PROF.tubo(hwB / Hb), cx, yS, Hb, 1.6), E: makeVessel(ERL, cx, yb, Hv, 3),
      plot: { x0: appW + (wide ? 62 : 54), x1: w - (wide ? 24 : 12), y0: wide ? 34 : 30, y1: h - (wide ? 92 : 64) }, rpx: clamp(Hv / 46, 3.4, 6.5) };
  }
  const LVB = (v) => 0.98 - 0.96 * v / 60;           // volumen leído en la bureta → altura en la bureta

  reg('titrage', {
    titulo: 'Valoración ácido fuerte / base fuerte', materia: 'chimie',
    params: [
      { id: 'Ca', label: 'Concentración del ácido Ca (HCl)', min: 0.02, max: 0.5, step: 0.01, def: 0.1, unit: 'mol/L' },
      { id: 'Va', label: 'Volumen de ácido Va', min: 5, max: 50, step: 1, def: 20, unit: 'mL' },
      { id: 'Cb', label: 'Concentración de la base Cb (NaOH)', min: 0.02, max: 0.5, step: 0.01, def: 0.1, unit: 'mol/L' },
      { id: 'Vb', label: 'Volumen de base vertido Vb', min: 0, max: 60, step: 0.1, def: 12, unit: 'mL' },
    ],
    create(host, p) {
      return { t: 0, red: !!host.reduced, vb: 0, lvl: lvErl(p.Va), slosh: 0, drops: [], dropT: 0, sw: new Swarm(TSPC), lay: layT(host.w, host.h) };
    },
    step(s, dt, p) {
      s.t += dt;
      // el volumen "mostrado" persigue al deslizador: al versar cae gota a gota (5 mL/s); al retroceder se rebobina rápido
      const d = p.Vb - s.vb;
      s.dispensing = d > 0.002;
      s.vb = d > 0 ? Math.min(p.Vb, s.vb + 5 * dt) : Math.max(p.Vb, s.vb - 25 * dt);
      const L0 = s.lay, E = L0.E;
      s.lvl = approach(s.lvl, lvErl(p.Va + s.vb), 8, dt);
      s.slosh = Math.max(0, s.slosh - dt * 3);
      // gotas
      if (s.dispensing) {
        s.dropT += dt;
        while (s.dropT > 0.09) { s.dropT -= 0.09; s.drops.push({ y: L0.yTip + 3, v: 0 }); }
      } else s.dropT = 0;
      const ySurf = E.Y(s.lvl);
      for (let i = s.drops.length - 1; i >= 0; i--) {
        const g = s.drops[i];
        g.v += L0.Hv * 6 * dt; g.y += g.v * dt;
        if (g.y >= ySurf) { s.slosh = Math.min(2.4, s.slosh + 0.7); s.drops.splice(i, 1); }
      }
      // partículas: la reacción consume H₃O⁺ y HO⁻ y crea H₂O (relativas a n_a = Ca·Va)
      const na = p.Ca * p.Va, nb = p.Cb * s.vb, r = nb / na, A0 = s.red ? 18 : 28, react = Math.min(r, 1);
      const sp = (k, sw) => {
        const near = k >= 2;      // los productos y los iones que llegan aparecen donde cae la gota
        sw.add(k, near ? (rnd() - 0.5) * 0.08 : (rnd() - 0.5) * 0.3, near ? Math.max(0.03, s.lvl - 0.03) : 0.03 + rnd() * Math.max(0.04, s.lvl - 0.06));
      };
      s.sw.sync([Math.round(A0 * (1 - react)), A0, Math.round(A0 * Math.min(r, 3)), Math.round(A0 * clamp(r - 1, 0, 3)), Math.round(A0 * react)], sp, dt);
      s.sw.step(dt, { hw: E.hwIn, ymin: 0, ymax: s.lvl, ru: L0.rpx / E.H, speed: s.red ? 0.045 : 0.085 });
    },
    draw(s, ctx, w, h, p) {
      const L0 = (s.lay = layT(w, h)), fs = L0.fs, E = L0.E, B = L0.B, cx = L0.cx;
      const Veq = p.Ca * p.Va / p.Cb, pHn = pHtit(p.Ca, p.Va, p.Cb, s.vb), ind = bbt(pHn);
      bg(ctx, w, h);
      table(ctx, w, h, L0.yb);
      // soporte (varilla + pinza) y erlenmeyer
      const rx = cx - Math.max(L0.Hv * 0.5, 54);
      ctx.fillStyle = '#2a3566'; ctx.fillRect(rx - 2, 4, 4, L0.yb - 4);
      ctx.fillRect(rx - 2, L0.yTop + L0.Hb * 0.35, cx - rx - L0.hwB - 1, 4);
      rr(ctx, cx - L0.hwB - 5, L0.yTop + L0.Hb * 0.35 - 3, 2 * L0.hwB + 10, 10, 3); ctx.fillStyle = '#7e8fcf'; ctx.fill();
      shadow(ctx, L0.yb, cx, 0.43 * L0.Hv, ind, 0.30);
      drawLiquid(ctx, E, { level: s.lvl, stops: [{ p: 0, c: ind, a: 0.62 }, { p: 1, c: ind, a: 0.5 }], t: s.t, amp: s.red ? 0 : 0.8 + s.slosh, cb: (c) => s.sw.draw(c, E, L0.rpx) });
      drawGlass(ctx, E);
      drawTicks(ctx, E, [{ y: lvErl(25), big: true, lab: null }, { y: lvErl(50), big: false }, { y: lvErl(75), big: true }, { y: lvErl(100), big: false }], fs);
      // bureta
      drawLiquid(ctx, B, { level: LVB(s.vb), stops: [{ p: 0, c: [190, 215, 255], a: 0.34 }, { p: 1, c: [190, 215, 255], a: 0.26 }], t: s.t, amp: 0 });
      drawGlass(ctx, B, { noHi: true });
      const tk = [];
      for (let v = 0; v <= 60; v += 5) tk.push({ y: LVB(v), big: v % 10 === 0, lab: v % 10 === 0 ? String(v) : null });
      drawTicks(ctx, B, tk, fs);
      // llave y punta
      ctx.fillStyle = 'rgba(210,230,255,.6)'; ctx.fillRect(cx - 1.2, L0.yS, 2.4, L0.yTip - L0.yS);
      rr(ctx, cx - 6, L0.yS - 3, 12, 8, 2.5); ctx.fillStyle = '#c9a23a'; ctx.fill();
      ctx.fillStyle = s.dispensing ? '#ffd166' : '#8a7a45'; rr(ctx, cx + 4, L0.yS - 1.5, 15, 3.4, 1.7); ctx.fill();
      // gota colgante y gotas cayendo
      if (s.dispensing) { const ph = (s.dropT / 0.09), rd = 1.3 + 2.1 * ph; ctx.fillStyle = 'rgba(210,230,255,.9)'; ctx.beginPath(); ctx.ellipse(cx, L0.yTip + rd * 0.9, rd * 0.85, rd, 0, 0, TAU); ctx.fill(); }
      for (const g of s.drops) { ctx.fillStyle = 'rgba(215,235,255,.95)'; ctx.beginPath(); ctx.ellipse(cx, g.y, 2.3, 3.6, 0, 0, TAU); ctx.fill(); }
      txtFit(ctx, 'NaOH ' + T(p.Cb, 2) + ' mol/L', rx + 8, L0.yTop + 8, L0.cx - rx - L0.hwB - 22, { s: fs - 1.5, c: COL.txt2 });
      txtFit(ctx, 'HCl ' + T(p.Ca, 2) + ' mol/L · ' + T(p.Va, 0) + ' mL + BBT', cx, L0.yb + 18, L0.appW + 10, { s: fs - 1, c: COL.txt2, al: 'center' });
      // ---------------- curva pH = f(Vb)
      const P = L0.plot, px0 = P.x0 + 30, px1 = P.x1, py0 = P.y0, py1 = P.y1;
      const xmax = clamp(Math.ceil(2 * Veq / 5) * 5, 20, 60);
      const X = (v) => px0 + (px1 - px0) * Math.min(v, xmax) / xmax, Y = (v) => py1 - (py1 - py0) * v / 14;
      card(ctx, P.x0 - 8, py0 - 24, px1 - P.x0 + 16, py1 - py0 + (L0.wide ? 62 : 50) + 24, 12);
      // zona de viraje del indicador
      ctx.fillStyle = rgba(BBT.g, 0.22); ctx.fillRect(px0, Y(7.6), px1 - px0, Y(6) - Y(7.6));
      if (L0.wide) txt(ctx, 'zona de viraje del BBT (6,0 – 7,6)', px1 - 4, Y(7.6) - 4, { s: fs - 2, c: '#9bd9a8', al: 'right' });
      ctx.strokeStyle = 'rgba(140,165,235,.18)'; ctx.lineWidth = 1;
      for (let v = 0; v <= 14; v += 2) {
        ctx.beginPath(); ctx.moveTo(px0, Y(v)); ctx.lineTo(px1, Y(v)); ctx.stroke();
        txt(ctx, String(v), px0 - 6, Y(v), { s: fs - 1.5, c: COL.txt2, al: 'right', bl: 'middle' });
      }
      const xs = nice(xmax / 5);
      for (let v = 0; v <= xmax + 1e-6; v += xs) { txt(ctx, T(v, 0), X(v), py1 + 14, { s: fs - 1.5, c: COL.txt2, al: 'center' }); ctx.beginPath(); ctx.moveTo(X(v), py1); ctx.lineTo(X(v), py1 + 3); ctx.stroke(); }
      txt(ctx, 'pH', px0 - 8, py0 - 8, { s: fs, w: 700, c: COL.txt2, al: 'right' });
      txt(ctx, 'Vb (mL)', px1, py1 + 28, { s: fs, w: 700, c: COL.txt2, al: 'right' });
      // equivalencia
      const xe = X(Veq);
      if (Veq <= xmax) {
        ctx.setLineDash([4, 3]); ctx.strokeStyle = COL.amber; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(xe, py0); ctx.lineTo(xe, py1); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(xe, Y(7), 5, 0, TAU); ctx.fillStyle = COL.amber; ctx.fill(); ctx.strokeStyle = '#0a0f20'; ctx.lineWidth = 1.5; ctx.stroke();
        txtFit(ctx, 'equivalencia · Véq = ' + T(Veq, 1) + ' mL', xe + (xe > (px0 + px1) / 2 ? -6 : 6), py0 + 10, px1 - px0 - 10, { s: fs - 0.5, w: 700, c: COL.amber, al: xe > (px0 + px1) / 2 ? 'right' : 'left' });
      }
      // curva completa (tenue) y tramo recorrido (sólido)
      const NS = 360, vmaxC = xmax;
      ctx.beginPath();
      for (let i = 0; i <= NS; i++) { const v = vmaxC * i / NS, pp = pHtit(p.Ca, p.Va, p.Cb, v); if (i) ctx.lineTo(X(v), Y(pp)); else ctx.moveTo(X(v), Y(pp)); }
      ctx.strokeStyle = 'rgba(120,160,255,.22)'; ctx.lineWidth = 2; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
      const vEnd = Math.min(s.vb, vmaxC), nTr = Math.max(2, Math.ceil(NS * vEnd / vmaxC));
      ctx.beginPath();
      for (let i = 0; i <= nTr; i++) { const v = vEnd * i / nTr, pp = pHtit(p.Ca, p.Va, p.Cb, v); if (i) ctx.lineTo(X(v), Y(pp)); else ctx.moveTo(X(v), Y(pp)); }
      ctx.strokeStyle = COL.cyan; ctx.lineWidth = 2.8; ctx.lineJoin = 'round'; ctx.stroke();
      // punto actual coloreado con el indicador
      const cxp = X(s.vb), cyp = Y(pHn);
      ctx.beginPath(); ctx.arc(cxp, cyp, 7, 0, TAU); ctx.fillStyle = rgba(ind, 1); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, 'pH ' + T(pHn, 2), cxp + (cxp > (px0 + px1) / 2 ? -11 : 11), cyp + (pHn > 9 ? 16 : -10), { s: fs, w: 700, c: COL.txt, al: cxp > (px0 + px1) / 2 ? 'right' : 'left' });
      // leyenda de especies
      let lx = P.x0, ly = py1 + (L0.wide ? 54 : 46);
      const names = ['H₃O⁺', 'Cl⁻', 'Na⁺', 'HO⁻', 'H₂O'];
      names.forEach((nm, i) => {
        const sp = TSPC[i];
        blit(ctx, sp.c, 4.5, lx + 5, ly - 4, sp.glyph);
        txt(ctx, nm, lx + 14, ly, { s: fs - 1, c: COL.txt2 });
        ctx.font = '400 ' + (fs - 1) + 'px ' + FONT;
        lx += 14 + ctx.measureText(nm).width + 10;
      });
      if (L0.wide) txt(ctx, 'H₃O⁺ + HO⁻ → 2 H₂O', px1, ly, { s: fs, w: 700, c: COL.green, al: 'right' });
    },
    formula(p) {
      const Veq = p.Ca * p.Va / p.Cb, na = p.Ca * p.Va, nb = p.Cb * p.Vb, Vt = p.Va + p.Vb, x = (na - nb) / Vt;
      const pH = pHtit(p.Ca, p.Va, p.Cb, p.Vb);
      const l1 = 'C_aV_a=C_bV_{\\mathrm{eq}}\\ \\Rightarrow\\ V_{\\mathrm{eq}}=\\dfrac{' + L(p.Ca, 2) + '\\times' + L(p.Va, 1) + '}{' + L(p.Cb, 2) + '}=' + L(Veq, 1) + '\\ \\mathrm{mL}';
      let l2;
      if (Math.abs(x) < 2e-6) l2 = 'V_b=V_{\\mathrm{eq}}\\ \\Rightarrow\\ [\\mathrm{H_3O^+}]=[\\mathrm{HO^-}]=\\sqrt{K_e}\\ \\Rightarrow\\ \\mathrm{pH}=' + L(pH, 1);
      else if (x > 0) l2 = '\\mathrm{pH}=-\\log\\dfrac{C_aV_a-C_bV_b}{V_a+V_b}=-\\log\\dfrac{' + L(p.Ca, 2) + '\\times' + L(p.Va, 1) + '-' + L(p.Cb, 2) + '\\times' + L(p.Vb, 1) + '}{' + L(p.Va, 1) + '+' + L(p.Vb, 1) + '}=' + L(pH, 2);
      else l2 = '\\mathrm{pH}=14+\\log\\dfrac{C_bV_b-C_aV_a}{V_a+V_b}=14+\\log\\dfrac{' + L(p.Cb, 2) + '\\times' + L(p.Vb, 1) + '-' + L(p.Ca, 2) + '\\times' + L(p.Va, 1) + '}{' + L(p.Va, 1) + '+' + L(p.Vb, 1) + '}=' + L(pH, 2);
      return '\\begin{gathered}' + l1 + '\\\\ ' + l2 + '\\end{gathered}';
    },
    lecturas(p) {
      const Veq = p.Ca * p.Va / p.Cb, pH = pHtit(p.Ca, p.Va, p.Cb, p.Vb), x = p.Ca * p.Va - p.Cb * p.Vb;
      const c = bbt(pH);
      return [{ label: 'Vb', valor: T(p.Vb, 1) + ' mL' }, { label: 'pH', valor: T(pH, 2) }, { label: 'Véq', valor: T(Veq, 1) + ' mL' },
        { label: 'BBT', valor: c === BBT.y || pH <= 6 ? 'amarillo' : pH >= 7.6 ? 'azul' : 'verde (viraje)' },
        { label: 'estado', valor: Math.abs(x) < 1e-3 * p.Ca * p.Va + 1e-9 ? 'equivalencia' : x > 0 ? 'antes de la equivalencia' : 'después de la equivalencia' }];
    },
  });

  // =================================================================================
  // 7) CONDUCTIMETRIA — σ = Σ λᵢ·[Xᵢ]      (ley de Kohlrausch)
  //   Celda con dos electrodos y NaCl disuelto: Na⁺ (λ = 5,01 mS·m²·mol⁻¹) y Cl⁻ (λ = 7,63 mS·m²·mol⁻¹)
  //   a 25 °C. [Xᵢ] en mol·m⁻³ (= mmol·L⁻¹ numéricamente) → σ en mS·m⁻¹.
  //   SIMPLIFICACIONES: (1) la tensión es alterna (como en los conductímetros reales, evita la electrólisis):
  //   los iones oscilan hacia el electrodo de signo opuesto. (2) La velocidad de deriva se exagera un poco con c
  //   para que se perciba la mayor intensidad de corriente; en realidad σ crece porque hay MÁS portadores de carga.
  //   (3) La ley lineal sólo es válida en disolución diluida (c ≲ 10 mmol/L); aquí se extiende por claridad.
  // =================================================================================
  const LAM = { na: 5.01, cl: 7.63 };                 // mS·m²·mol⁻¹ a 25 °C
  const sigma = (c) => (LAM.na + LAM.cl) * c;          // mS·m⁻¹
  const fmtSig = (v) => v < 10 ? T(v, 2) : v < 100 ? T(v, 1) : T(v, 0);
  const fmtSigL = (v) => v < 10 ? L(v, 2) : v < 100 ? L(v, 1) : L(v, 0);
  function layK(w, h) {
    const wide = w >= 560, fs = fsOf(w, h), H = Math.max(90, Math.min(h - 112, (wide ? w * 0.36 : w * 0.5) / 0.8)), yb = h - 40;
    const cx = wide ? w * 0.27 : Math.max(0.4 * H + 12, w * 0.3);
    return { wide, fs, H, yb, cx, V: makeVessel(PROF.beaker(0.4, 0.07), cx, yb, H, 3.5), rpx: clamp(H / 40, 3.6, 7.5),
      g: { x0: cx + 0.4 * H + (wide ? 70 : 52), x1: w - (wide ? 28 : 14), y0: wide ? 54 : 46, y1: yb - 26 } };
  }
  const KLV = 0.66, KPL = 0.30, KGAP = 0.286;      // nivel del líquido, posición de los electrodos y semi-separación útil (unidades de H)

  reg('conductimetria', {
    titulo: 'Conductimetría', materia: 'chimie',
    params: [{ id: 'c', label: 'Concentración del electrolito (NaCl) c', min: 0.5, max: 100, step: 0.5, def: 10, unit: 'mmol/L' }],
    create(host, p) {
      return { t: 0, red: !!host.reduced, ac: 0, ph: 0, sw: new Swarm([SPC.na, SPC.cl]), lay: layK(host.w, host.h) };
    },
    step(s, dt, p) {
      s.t += dt;
      const per = s.red ? 8 : 5.2;
      s.ph += dt * TAU / per;
      s.ac = Math.tanh(3.2 * Math.sin(s.ph));                  // tensión alterna "casi cuadrada"
      const L0 = s.lay, V = L0.V, N = Math.max(1, Math.round(clamp(p.c * 0.7, 1, 70) * (s.red ? 0.6 : 1)));
      const f = (0.55 + 0.45 * Math.sqrt(p.c / 100)) * (s.red ? 0.5 : 1);
      const vNa = -0.078 * s.ac * f, vCl = 0.119 * s.ac * f;    // ∝ λ: el Cl⁻ es más móvil (7,63 vs 5,01); cationes hacia el electrodo negativo
      s.sw.sync([N, N], (k, sw) => sw.add(k, (rnd() * 2 - 1) * KGAP * 0.9, 0.08 + rnd() * (KLV - 0.14)), dt);
      s.sw.step(dt, { hw: () => KGAP, ymin: 0.1, ymax: KLV, ru: L0.rpx / V.H, speed: s.red ? 0.03 : 0.06, drift: (q) => (q.s === 0 ? vNa : vCl) });
    },
    draw(s, ctx, w, h, p) {
      const L0 = (s.lay = layK(w, h)), V = L0.V, H = L0.H, fs = L0.fs, cx = L0.cx, c = p.c, sg = sigma(c);
      bg(ctx, w, h);
      table(ctx, w, h, L0.yb);
      shadow(ctx, L0.yb, cx, 0.4 * H, COL.water, 0.14);
      const lq = { c: COL.water, a: 0.15 + 0.1 * c / 100 };
      drawLiquid(ctx, V, { level: KLV, stops: [{ p: 0, c: lq.c, a: lq.a }, { p: 1, c: lq.c, a: lq.a * 0.85 }], t: s.t, amp: s.red ? 0 : 0.8, cb: (cc) => s.sw.draw(cc, V, L0.rpx) });
      drawGlass(ctx, V);
      // electrodos (placas metálicas) y cables hasta el conductímetro
      const pos = s.ac > 0; // izquierdo negativo
      const yPlTop = V.yb - 1.06 * H, yPlBot = V.yb - 0.12 * H, pwid = Math.max(5, H * 0.028);
      const boxW = Math.max(150, Math.min(0.9 * H, 230)), boxY = 6, boxH = 40;
      [-1, 1].forEach((sd) => {
        const x = cx + sd * KPL * H;
        const gp = ctx.createLinearGradient(x - pwid / 2, 0, x + pwid / 2, 0);
        gp.addColorStop(0, '#6f7fb8'); gp.addColorStop(0.45, '#d5defa'); gp.addColorStop(1, '#5a69a0');
        ctx.globalAlpha = 0.9; ctx.fillStyle = gp; ctx.fillRect(x - pwid / 2, yPlTop, pwid, yPlBot - yPlTop); ctx.globalAlpha = 1;
        // cable
        ctx.strokeStyle = sd < 0 ? '#ff7a8a' : '#6aa8ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, yPlTop); ctx.bezierCurveTo(x, boxY + boxH + 14, cx + sd * boxW * 0.3, boxY + boxH + 10, cx + sd * boxW * 0.3, boxY + boxH); ctx.stroke();
        // signo instantáneo
        const neg = sd < 0 ? pos : !pos;
        ctx.beginPath(); ctx.arc(x, yPlTop + 12, 8, 0, TAU); ctx.fillStyle = neg ? '#3b6cff' : '#ff4d6d'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(x - 3.5, yPlTop + 12); ctx.lineTo(x + 3.5, yPlTop + 12); if (!neg) { ctx.moveTo(x, yPlTop + 8.5); ctx.lineTo(x, yPlTop + 15.5); } ctx.stroke();
      });
      // flecha del campo eléctrico (de + a −), intensidad según |u|
      const ey = V.yb - 0.82 * H, ea = Math.abs(s.ac), dirL = s.ac > 0, xA = cx - (KPL - 0.04) * H, xB = cx + (KPL - 0.04) * H;
      ctx.save(); ctx.globalAlpha = 0.25 + 0.6 * ea; ctx.strokeStyle = COL.amber; ctx.fillStyle = COL.amber; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(dirL ? xB : xA, ey); ctx.lineTo(dirL ? xA + 7 : xB - 7, ey); ctx.stroke(); ctx.setLineDash([]);
      const hx = dirL ? xA : xB, dd = dirL ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(hx, ey); ctx.lineTo(hx + 8 * dd, ey - 4.5); ctx.lineTo(hx + 8 * dd, ey + 4.5); ctx.closePath(); ctx.fill();
      txt(ctx, 'E', cx, ey - 8, { s: fs, w: 700, c: COL.amber, al: 'center' }); ctx.restore();
      // conductímetro
      rr(ctx, cx - boxW / 2, boxY, boxW, boxH, 9);
      const gb = ctx.createLinearGradient(0, boxY, 0, boxY + boxH); gb.addColorStop(0, '#34437e'); gb.addColorStop(1, '#1a2347');
      ctx.fillStyle = gb; ctx.fill(); ctx.strokeStyle = 'rgba(150,180,255,.45)'; ctx.lineWidth = 1.2; ctx.stroke();
      rr(ctx, cx - boxW / 2 + 8, boxY + 6, boxW - 16, boxH - 12, 5); ctx.fillStyle = '#071410'; ctx.fill(); ctx.strokeStyle = 'rgba(120,255,190,.35)'; ctx.stroke();
      txtFit(ctx, 'σ = ' + fmtSig(sg) + ' mS·m⁻¹', cx, boxY + boxH / 2 + 1, boxW - 28, { s: fs + 2, f: MONO, w: 700, c: '#7dffb0', al: 'center', bl: 'middle' });
      // leyenda de iones
      let lx = Math.max(8, cx - 0.4 * H);
      const leg = [[SPC.na, 'Na⁺ (' + T(LAM.na, 2) + ')'], [SPC.cl, 'Cl⁻ (' + T(LAM.cl, 2) + ')']];
      ctx.font = '400 ' + (fs - 1) + 'px ' + FONT;
      leg.forEach(([sp, t]) => { blit(ctx, sp.c, 5, lx + 5, L0.yb + 14, sp.glyph); txt(ctx, t, lx + 14, L0.yb + 18, { s: fs - 1, c: COL.txt2 }); lx += 14 + ctx.measureText(t).width + 14; });
      txt(ctx, 'λ en mS·m²·mol⁻¹ · tensión alterna', Math.max(8, cx - 0.4 * H), L0.yb + 33, { s: fs - 2, c: COL.txt2 });
      // gráfica σ = f(c)
      const G = L0.g;
      if (G.x1 - G.x0 > 90) {
        const gx0 = G.x0 + 34, gx1 = G.x1, gy0 = G.y0, gy1 = G.y1, smax = 1300;
        const X = (v) => gx0 + (gx1 - gx0) * v / 100, Y = (v) => gy1 - (gy1 - gy0) * v / smax;
        card(ctx, G.x0 - 4, gy0 - 30, G.x1 - G.x0 + 12, gy1 - gy0 + 62, 12);
        ctx.strokeStyle = 'rgba(140,165,235,.18)'; ctx.lineWidth = 1;
        for (let v = 0; v <= smax; v += 250) { ctx.beginPath(); ctx.moveTo(gx0, Y(v)); ctx.lineTo(gx1, Y(v)); ctx.stroke(); txt(ctx, String(v), gx0 - 5, Y(v), { s: fs - 2, c: COL.txt2, al: 'right', bl: 'middle' }); }
        for (let v = 0; v <= 100; v += 25) txt(ctx, String(v), X(v), gy1 + 14, { s: fs - 2, c: COL.txt2, al: 'center' });
        txt(ctx, 'σ (mS·m⁻¹)', gx0 - 5, gy0 - 14, { s: fs - 1, w: 700, c: COL.txt2, al: 'right' });
        txt(ctx, 'c (mmol·L⁻¹)', gx1, gy1 + 28, { s: fs - 1, w: 700, c: COL.txt2, al: 'right' });
        ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(100), Y(sigma(100)));
        ctx.strokeStyle = 'rgba(0,212,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(c), Y(sg));
        ctx.strokeStyle = COL.cyan; ctx.lineWidth = 3; ctx.stroke();
        ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,209,102,.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X(c), gy1); ctx.lineTo(X(c), Y(sg)); ctx.lineTo(gx0, Y(sg)); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(X(c), Y(sg), 6, 0, TAU); ctx.fillStyle = COL.amber; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke();
        txtFit(ctx, 'σ = (λ₊ + λ₋)·c   (recta por el origen)', gx0 + 6, gy0 - 14, gx1 - gx0 - 10, { s: fs - 0.5, w: 700, c: COL.green });
      }
    },
    formula(p) {
      const sg = sigma(p.c);
      return '\\sigma=\\sum_i\\lambda_i[X_i]=\\lambda_{\\mathrm{Na^+}}[\\mathrm{Na^+}]+\\lambda_{\\mathrm{Cl^-}}[\\mathrm{Cl^-}]=(' + L(LAM.na, 2) + '+' + L(LAM.cl, 2) + ')\\ \\mathrm{mS\\,m^2\\,mol^{-1}}\\times' + L(p.c, 1) + '\\ \\mathrm{mol\\,m^{-3}}=' + fmtSigL(sg) + '\\ \\mathrm{mS\\,m^{-1}}';
    },
    lecturas(p) {
      const sg = sigma(p.c);
      return [{ label: 'σ', valor: fmtSig(sg) + ' mS·m⁻¹' }, { label: 'c', valor: T(p.c, 1) + ' mmol·L⁻¹' }, { label: 'σ/c', valor: T(LAM.na + LAM.cl, 2) + ' mS·m²·mol⁻¹' }];
    },
  });
})();
