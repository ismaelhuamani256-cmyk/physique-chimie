// =====================================================================================
// 11-quimica-b.js — presets de animación de química (parte B), ver CONTRATO.md §7
//
// Presets y parámetros EXACTOS (id · rango · paso · valor por defecto · unidad):
//
//  beer-lambert      A = ε·ℓ·c
//     eps  Coef. de absorción molaire ε   100 – 10000   (paso 100)    def 2000     L·mol⁻¹·cm⁻¹
//     l    Longueur de cuve ℓ             0,5 – 5       (paso 0,1)    def 1        cm
//     c    Concentration c                0,0001 – 0,002 (paso 0,0001) def 0,0004   mol·L⁻¹
//
//  avance            tableau d'avancement  a A + b B → c C   (por defecto 2 A + B → 3 C)
//     x    Avancement x                   0 – 2         (paso 0,01)   def 0,20     mol  (se bloquea en x_max)
//     n1   n(A) initial                   0,2 – 2       (paso 0,05)   def 1,00     mol
//     n2   n(B) initial                   0,2 – 2       (paso 0,05)   def 0,40     mol
//     a, b, c  (opcionales, sin slider)   coeficientes estequiométricos, def 2, 1, 3
//
//  quotient-equilibre   Qr vs K  (modelo didáctico A ⇌ B, Qr = [B]/[A])
//     K    Constante de equilibrio K      0,1 – 20      (paso 0,1)    def 4        (sin unidad)
//     Q    Cociente de reacción Qr        0,1 – 20      (paso 0,1)    def 1        (sin unidad)
//
//  cinetica          orden 1:  c = c0·e^(−kt),  v = k·c,  t½ = ln2/k
//     c0   Concentration initiale         0,1 – 1,5     (paso 0,05)   def 1,00     mol·L⁻¹
//     k    Constante de vitesse k         0,05 – 1      (paso 0,01)   def 0,20     s⁻¹
//     t    Temps t                        0 – 20        (paso 0,1)    def 5,0      s
//
//  pila              pila Daniell genérica  Zn | Zn²⁺ ‖ Cu²⁺ | Cu
//     E    Force électromotrice (inicial) 0,3 – 2       (paso 0,01)   def 1,10     V
//     t    Avance de la reacción (tiempo) 0 – 100       (paso 1)      def 30       %
//
//  radioactividad    N = N0·e^(−λt),  t½ = ln2/λ,  A = λN
//     N0   Núcleos iniciales              20 – 300      (paso 10)     def 150      núcleos
//     lam  Constante radiactiva λ         0,02 – 0,5    (paso 0,01)   def 0,10     s⁻¹
//     t    Temps t                        0 – 40        (paso 0,5)    def 10       s
//
//  gas-ideal-quimico  V = nRT/P
//     n    Cantidad de gas n              0,1 – 3       (paso 0,1)    def 1,0      mol
//     T    Temperatura T                  200 – 500     (paso 5)      def 300      K
//     P    Presión P                      50 – 300      (paso 5)      def 100      kPa
//
// Simplificaciones didácticas (también comentadas en cada preset):
//  · Beer-Lambert: la absorción de cada fotón sigue una ley exponencial (probabilidad ∝ ε·c·ln10 por cm).
//  · quotient-equilibre: reacción A ⇌ B de coeficientes 1, concentración total 1 mol·L⁻¹.
//  · pila: la f.é.m. cae a 0 cuando la pila se agota (Q → K) con una curva cualitativa.
//  · Radioactividad/cinética: los tiempos de desintegración se reparten de forma estratificada para que el
//    número de partículas coincida con la fórmula (sin ruido estadístico que confunda).
// Los helpers (dibujo, sprites, texto) están copiados aquí: el archivo es autocontenido.
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB;
  if (!PCB || !PCB.anim) return;

  // ---------- utilidades numéricas ----------
  const TAU = Math.PI * 2, LN10 = Math.LN10, PHI = 0.6180339887498949;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const frac = (v) => v - Math.floor(v);
  /** Suavizado exponencial independiente de los fps */
  const suav = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  /** Número con coma decimal para texto plano / para LaTeX ("0{,}20") */
  const num = (v, d = 2) => Number(v).toFixed(d).replace('.', ',');
  const tx = (v, d = 2) => Number(v).toFixed(d).replace('.', '{,}');
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function partesSci(v, d) {
    let e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e);
    if (Number(Math.abs(m).toFixed(d)) >= 10) { m /= 10; e++; }
    return { m, e };
  }
  /** 4,0×10⁻⁴ en LaTeX y en texto plano */
  const texSci = (v, d = 2) => { if (!v) return '0'; const { m, e } = partesSci(v, d); return e === 0 ? tx(m, d) : `${tx(m, d)}\\times10^{${e}}`; };
  const txtSci = (v, d = 2) => { if (!v) return '0'; const { m, e } = partesSci(v, d); return e === 0 ? num(m, d) : `${num(m, d)}×10${String(e).replace(/./g, (c) => SUP[c])}`; };
  /** Pseudo-aleatoriedad de baja discrepancia: cualquier prefijo i<N está bien repartido en [0,1) */
  const baja = (i) => frac((i + 1) * PHI);

  // ---------- color ----------
  function hex2rgb(h) {
    h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgbStr = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const rgba = (hex, a) => { const c = hex2rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  /** Mezcla de dos colores hex cuantizada (8 niveles) -> array rgb (clave estable para la caché de sprites) */
  function mezcla(a, b, t) {
    t = Math.round(clamp(t, 0, 1) * 8) / 8; const A = hex2rgb(a), B = hex2rgb(b);
    return A.map((v, i) => Math.round(lerp(v, B[i], t)));
  }

  // ---------- sprites de esferas sombreadas (caché) ----------
  const _spr = {}, _halo = {};
  function sprite(col) {
    const key = String(col); if (_spr[key]) return _spr[key];
    const c = Array.isArray(col) ? col : hex2rgb(col), S = 64, cv = document.createElement('canvas');
    cv.width = cv.height = S; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(S * 0.37, S * 0.33, S * 0.04, S * 0.5, S * 0.5, S * 0.5);
    gr.addColorStop(0, rgbStr(c.map((v) => lerp(v, 255, 0.8))));
    gr.addColorStop(0.38, rgbStr(c));
    gr.addColorStop(1, rgbStr(c.map((v) => v * 0.32)));
    g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, TAU); g.fill();
    return (_spr[key] = cv);
  }
  /** Halo luminoso (gradiente radial que se desvanece) */
  function halo(col) {
    const key = String(col); if (_halo[key]) return _halo[key];
    const c = Array.isArray(col) ? col : hex2rgb(col), S = 64, cv = document.createElement('canvas');
    cv.width = cv.height = S; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`); gr.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},.35)`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    return (_halo[key] = cv);
  }
  function bola(ctx, x, y, r, col, alpha = 1) {
    if (alpha <= 0.01 || r <= 0.2) return;
    ctx.globalAlpha = alpha; ctx.drawImage(sprite(col), x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = 1;
  }
  function brillo(ctx, x, y, r, col, alpha = 1) {
    if (alpha <= 0.01) return;
    ctx.globalAlpha = alpha; ctx.drawImage(halo(col), x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = 1;
  }

  // ---------- texto y formas ----------
  const FS = (w, h) => clamp(Math.min(w / 48, h / 22), 10, 15);
  function txt(ctx, s, x, y, size, color, align = 'left', weight = 600) {
    ctx.font = `${weight} ${size}px UI, system-ui, sans-serif`; ctx.fillStyle = color;
    ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fondo(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0d1530'); g.addColorStop(1, '#0a0f20');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function panel(ctx, x, y, w, h, r = 10, fill = 'rgba(255,255,255,.045)', stroke = 'rgba(255,255,255,.13)') {
    rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
  }
  /** Flecha de (x0,y0) a (x1,y1) con cabeza */
  function flecha(ctx, x0, y0, x1, y1, color, lw = 2, cab = 7) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * cab * 0.6, y1 - Math.sin(a) * cab * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - Math.cos(a - 0.45) * cab, y1 - Math.sin(a - 0.45) * cab);
    ctx.lineTo(x1 - Math.cos(a + 0.45) * cab, y1 - Math.sin(a + 0.45) * cab); ctx.closePath(); ctx.fill();
  }
  /** Contorno del vaso (abierto por arriba) como trazo cerrado para recortar el líquido */
  function trazoVaso(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h - r); ctx.arcTo(x, y + h, x + r, y + h, r);
    ctx.lineTo(x + w - r, y + h); ctx.arcTo(x + w, y + h, x + w, y + h - r, r); ctx.lineTo(x + w, y); ctx.closePath();
  }
  /**
   * Vaso de vidrio translúcido con líquido (nivel 0..1) y menisco. Devuelve el rectángulo interior del líquido.
   */
  function vaso(ctx, x, y, w, h, nivel, tint, alfa = 0.3) {
    const r = Math.min(w * 0.16, 18), ly = y + h * (1 - nivel);
    ctx.save(); trazoVaso(ctx, x, y, w, h, r); ctx.clip();
    const g = ctx.createLinearGradient(0, ly, 0, y + h);
    g.addColorStop(0, rgba(tint, alfa)); g.addColorStop(1, rgba(tint, alfa + 0.22));
    ctx.fillStyle = g; ctx.fillRect(x, ly, w, y + h - ly);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x, ly, w, 2); // menisco
    const gl = ctx.createLinearGradient(x, 0, x + w, 0); // reflejo del vidrio
    gl.addColorStop(0, 'rgba(255,255,255,.16)'); gl.addColorStop(0.18, 'rgba(255,255,255,.02)'); gl.addColorStop(0.85, 'rgba(255,255,255,.02)'); gl.addColorStop(1, 'rgba(255,255,255,.1)');
    ctx.fillStyle = gl; ctx.fillRect(x, y, w, h);
    ctx.restore();
    trazoVaso(ctx, x, y, w, h, r); ctx.strokeStyle = 'rgba(200,225,255,.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + w + 3, y); ctx.stroke(); // borde
    return { x0: x + 5, x1: x + w - 5, y0: ly + 5, y1: y + h - 5 };
  }
  /** Ejes de una gráfica; devuelve las funciones de mapeo X(v), Y(v) */
  function ejes(ctx, gx, gy, gw, gh, o) {
    const { x0 = 0, x1 = 1, y0 = 0, y1 = 1, xt = [], yt = [], fs = 11, xl = '', yl = '', fx = num, fy = num } = o;
    const X = (v) => gx + ((v - x0) / (x1 - x0)) * gw, Y = (v) => gy + gh - ((v - y0) / (y1 - y0)) * gh;
    panel(ctx, gx, gy, gw, gh, 6, 'rgba(255,255,255,.03)', 'rgba(255,255,255,.0)');
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.beginPath();
    xt.forEach((v) => { ctx.moveTo(X(v), gy); ctx.lineTo(X(v), gy + gh); });
    yt.forEach((v) => { ctx.moveTo(gx, Y(v)); ctx.lineTo(gx + gw, Y(v)); });
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,220,255,.6)'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    xt.forEach((v) => txt(ctx, fx(v), X(v), gy + gh + fs + 3, fs, '#9fb0d9', 'center', 400));
    yt.forEach((v) => txt(ctx, fy(v), gx - 5, Y(v) + fs * 0.35, fs, '#9fb0d9', 'right', 400));
    if (xl) txt(ctx, xl, gx + gw, gy + gh + 2 * fs + 6, fs, '#c9d6f5', 'right', 600);
    if (yl) txt(ctx, yl, gx - 2, gy - 6, fs, '#c9d6f5', 'left', 600);
    return { X, Y };
  }

  // ---------- botones dibujados en el canvas (clic sobre el contenedor) ----------
  /** Engancha un listener de puntero al contenedor; s.btns se rellena en cada draw */
  function clics(s, host) {
    s.btns = [];
    const el = host && host.host; if (!el) return;
    const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const busca = (x, y) => s.btns.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    const dn = (e) => { const [x, y] = pos(e), b = busca(x, y); if (b) { b.fn(); e.preventDefault(); } };
    const mv = (e) => { const [x, y] = pos(e); el.style.cursor = busca(x, y) ? 'pointer' : ''; };
    el.addEventListener('pointerdown', dn); el.addEventListener('pointermove', mv);
    s._offClics = () => { el.removeEventListener('pointerdown', dn); el.removeEventListener('pointermove', mv); el.style.cursor = ''; };
  }
  function boton(ctx, s, x, y, w, h, label, fn, color = '#2ee59d', fs = 12) {
    s.btns.push({ x, y, w, h, fn });
    rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = rgba(color, 0.18); ctx.fill();
    ctx.strokeStyle = rgba(color, 0.85); ctx.lineWidth = 1.4; ctx.stroke();
    txt(ctx, label, x + w / 2, y + h / 2 + fs * 0.35, fs, '#eaf0ff', 'center', 700);
  }

  // ---------- partículas que deambulan en el cuadro unidad (movimiento browniano) ----------
  function deambula(q, dt, vel, giro, rng) {
    q.a += (rng() - 0.5) * giro * dt * 6;
    q.u += Math.cos(q.a) * vel * dt; q.v += Math.sin(q.a) * vel * dt;
    if (q.u < 0.02) { q.u = 0.02; q.a = Math.PI - q.a; } else if (q.u > 0.98) { q.u = 0.98; q.a = Math.PI - q.a; }
    if (q.v < 0.02) { q.v = 0.02; q.a = -q.a; } else if (q.v > 0.98) { q.v = 0.98; q.a = -q.a; }
  }
  /** Lectura de tiempo con botón ▶: reproduce desde 0 hasta el valor del slider y termina exactamente en él */
  function tiempoPaso(s, dt, p, tmax, dur) {
    if (s.play) { s.tv += (dt * tmax) / dur; if (s.tv >= p.t) { s.tv = p.t; s.play = false; } }
    else s.tv = p.t;
  }

  // =====================================================================================
  // 1. BEER-LAMBERT — A = ε·ℓ·c
  // Simplificación: cada fotón que entra en la cubeta se absorbe a una profundidad aleatoria con ley
  // exponencial (prob. de absorción por cm = ln10·ε·c). Así T = I/I₀ = 10^(−A) sale estadísticamente exacto.
  // La luz es verde (≈530 nm) y la disolución magenta: absorbe el verde (color complementario).
  // =====================================================================================
  const VERDE = '#8dffb5', MAGENTA = '#ff3da6';
  function layBeer(w, h, p) {
    const compacto = w < 520 || h < 330;
    const gh = compacto ? 0 : h * 0.3, top = h * 0.08, bot = h - gh - h * 0.07;
    const yc = (top + bot) / 2, sh = bot - top, ch = sh * 0.78, bh = ch * 0.34;
    const cw = w * (0.1 + 0.07 * p.l), cx0 = w * 0.45 - cw / 2;
    return { w, h, compacto, gh, top, bot, yc, ch, bh, cw, cx0, cx1: cx0 + cw, lamp0: w * 0.03, lamp1: w * 0.13, detX: w * 0.77, detW: w * 0.21 };
  }
  const pctT = (T) => (T * 100 < 0.1 ? '< 0,1 %' : num(T * 100, T * 100 < 10 ? 1 : 0) + ' %');

  PCB.anim.register('beer-lambert', {
    titulo: 'Loi de Beer-Lambert', materia: 'chimie',
    params: [
      { id: 'eps', label: 'Coef. d’absorption ε', min: 100, max: 10000, step: 100, def: 2000, unit: 'L·mol⁻¹·cm⁻¹' },
      { id: 'l', label: 'Longueur de cuve ℓ', min: 0.5, max: 5, step: 0.1, def: 1, unit: 'cm' },
      { id: 'c', label: 'Concentration c', min: 0.0001, max: 0.002, step: 0.0001, def: 0.0004, unit: 'mol·L⁻¹' },
    ],
    create(host, p) {
      const rng = host.rng, M = host.reduced ? 90 : 200;
      const s = { t: 0, red: host.reduced, rng, M, ph: [], mol: [], fl: [], emit: 0, nIn: 0, nOut: 0, L: layBeer(host.w, host.h, p) };
      for (let i = 0; i < M; i++) s.mol.push({ u: rng(), v: rng(), a: rng() * TAU, vis: 0, glow: 0 });
      return s;
    },
    onParam(s) { s.nIn = 0; s.nOut = 0; },
    step(s, dt, p) {
      const L = s.L, rng = s.rng, ec = LN10 * p.eps * p.c; // probabilidad de absorción por cm (neperiana)
      s.t += dt;
      // número de moléculas visibles ∝ c (y algo con ℓ para mantener la densidad); sin saltos: aparecen/desaparecen en fundido
      const nObj = Math.round(lerp(5, s.M, clamp(p.c / 0.002, 0, 1)) * (0.4 + 0.6 * (p.l / 5)));
      s.mol.forEach((m, i) => {
        m.vis = suav(m.vis, i < nObj ? 1 : 0, 4, dt); m.glow = Math.max(0, m.glow - dt * 2.2);
        deambula(m, dt, 0.05, 1, rng);
      });
      // emisión de fotones
      s.emit += dt * (s.red ? 20 : 38);
      while (s.emit >= 1) { s.emit -= 1; s.ph.push({ x: L.lamp1, y: L.yc + (rng() * 2 - 1) * L.bh * 0.92, st: 0, xa: Infinity }); }
      const v = L.w * 0.32;
      for (let i = s.ph.length - 1; i >= 0; i--) {
        const f = s.ph[i]; f.x += v * dt;
        if (f.st === 0 && f.x >= L.cx0) {                    // entra en la cubeta: se decide dónde (si se absorbe)
          f.st = 1; s.nIn++;
          if (ec > 0) { const prof = -Math.log(1 - rng()) / ec; if (prof < p.l) f.xa = L.cx0 + (prof / p.l) * L.cw; }
        }
        if (f.st === 1 && f.x >= f.xa) {                     // absorbido por una molécula cercana
          let mejor = null, d = 1e9;
          for (const m of s.mol) { if (m.vis < 0.5) continue; const mx = L.cx0 + 6 + m.u * (L.cw - 12), dd = Math.abs(mx - f.x) + Math.abs((L.top + m.v * L.ch) - f.y) * 0.4; if (dd < d) { d = dd; mejor = m; } }
          if (mejor) mejor.glow = 1;
          s.fl.push({ x: f.xa, y: f.y, t: 0 }); s.ph.splice(i, 1); continue;
        }
        if (f.st === 1 && f.x >= L.cx1) { f.st = 2; s.nOut++; }
        if (f.x > L.detX + 4) s.ph.splice(i, 1);
      }
      for (let i = s.fl.length - 1; i >= 0; i--) { s.fl[i].t += dt; if (s.fl[i].t > 0.5) s.fl.splice(i, 1); }
      if (s.nIn > 400) { s.nIn = Math.round(s.nIn / 2); s.nOut = Math.round(s.nOut / 2); } // contadores acotados
    },
    draw(s, ctx, w, h, p) {
      const L = (s.L = layBeer(w, h, p)), fs = FS(w, h);
      const A = p.eps * p.l * p.c, T = Math.pow(10, -A), epsC = p.eps * p.c;
      fondo(ctx, w, h);
      const cy0 = L.yc - L.ch / 2, cy1 = L.yc + L.ch / 2, liq = cy0 + L.ch * 0.1;
      // --- lámpara
      const lh = L.ch * 0.5;
      rr(ctx, L.lamp0, L.yc - lh / 2, L.lamp1 - L.lamp0, lh, 8);
      const gl = ctx.createLinearGradient(0, L.yc - lh / 2, 0, L.yc + lh / 2); gl.addColorStop(0, '#26335e'); gl.addColorStop(1, '#141c3a');
      ctx.fillStyle = gl; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.stroke();
      brillo(ctx, L.lamp1, L.yc, L.bh * 1.7, VERDE, 0.85);
      bola(ctx, L.lamp1 - 2, L.yc, Math.min(lh * 0.28, 12), VERDE);
      txt(ctx, 'Source', (L.lamp0 + L.lamp1) / 2, L.yc + lh / 2 + fs + 2, fs, '#9fb0d9', 'center', 400);
      // --- haz (intensidad: I₀ antes, decae exponencialmente dentro, I después)
      const bg = ctx.createLinearGradient(0, L.yc - L.bh, 0, L.yc + L.bh);
      bg.addColorStop(0, 'rgba(141,255,181,0)'); bg.addColorStop(0.2, 'rgba(141,255,181,1)'); bg.addColorStop(0.8, 'rgba(141,255,181,1)'); bg.addColorStop(1, 'rgba(141,255,181,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = bg;
      ctx.globalAlpha = 0.2; ctx.fillRect(L.lamp1, L.yc - L.bh, L.cx0 - L.lamp1, 2 * L.bh);
      const NS = 30;
      for (let i = 0; i < NS; i++) {
        ctx.globalAlpha = 0.2 * Math.pow(10, -epsC * p.l * ((i + 0.5) / NS));
        ctx.fillRect(L.cx0 + (L.cw * i) / NS, L.yc - L.bh, L.cw / NS + 0.8, 2 * L.bh);
      }
      ctx.globalAlpha = 0.2 * T; ctx.fillRect(L.cx1, L.yc - L.bh, L.detX - L.cx1, 2 * L.bh);
      ctx.restore();
      // --- cubeta: disolución (color ∝ ε·c) y vidrio
      const aSol = 0.07 + 0.5 * (1 - Math.pow(10, -0.35 * epsC));
      ctx.save(); trazoVaso(ctx, L.cx0, cy0, L.cw, L.ch, 6); ctx.clip();
      ctx.fillStyle = rgba(MAGENTA, aSol); ctx.fillRect(L.cx0, liq, L.cw, cy1 - liq);
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(L.cx0, liq, L.cw, 2);
      ctx.restore();
      // moléculas absorbentes
      const rM = clamp(Math.min(L.cw, L.ch) * 0.045, 2.6, 5);
      for (const m of s.mol) {
        if (m.vis < 0.02) continue;
        const x = L.cx0 + 6 + m.u * (L.cw - 12), y = liq + 6 + m.v * (cy1 - liq - 12);
        if (m.glow > 0) brillo(ctx, x, y, rM * 4.2, '#ffd0e8', m.glow * 0.9);
        bola(ctx, x, y, rM, m.glow > 0.2 ? '#ffc2e0' : MAGENTA, m.vis);
      }
      // fotones (puntos con halo) y destellos de absorción
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const f of s.ph) { brillo(ctx, f.x, f.y, 9, VERDE, 0.85); }
      for (const f of s.fl) { const k = f.t / 0.5; ctx.strokeStyle = `rgba(255,190,225,${1 - k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, 3 + k * 13, 0, TAU); ctx.stroke(); }
      ctx.restore();
      for (const f of s.ph) { ctx.fillStyle = '#eafff2'; ctx.beginPath(); ctx.arc(f.x, f.y, 1.7, 0, TAU); ctx.fill(); }
      // vidrio delantero
      ctx.save(); trazoVaso(ctx, L.cx0, cy0, L.cw, L.ch, 6);
      const gv = ctx.createLinearGradient(L.cx0, 0, L.cx1, 0); gv.addColorStop(0, 'rgba(255,255,255,.14)'); gv.addColorStop(0.2, 'rgba(255,255,255,.02)'); gv.addColorStop(1, 'rgba(255,255,255,.08)');
      ctx.fillStyle = gv; ctx.fill(); ctx.strokeStyle = 'rgba(200,225,255,.65)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      // cota de ℓ bajo la cubeta
      const yl = cy1 + 9;
      ctx.strokeStyle = '#ffd166'; ctx.fillStyle = '#ffd166'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(L.cx0, yl); ctx.lineTo(L.cx1, yl); ctx.moveTo(L.cx0, yl - 4); ctx.lineTo(L.cx0, yl + 4); ctx.moveTo(L.cx1, yl - 4); ctx.lineTo(L.cx1, yl + 4); ctx.stroke();
      txt(ctx, 'ℓ = ' + num(p.l, 1) + ' cm', (L.cx0 + L.cx1) / 2, yl + fs + 3, fs, '#ffd166', 'center', 700);
      // etiquetas I₀ / I
      txt(ctx, 'I₀', (L.lamp1 + L.cx0) / 2, L.yc - L.bh - 6, fs + 2, VERDE, 'center', 700);
      txt(ctx, 'I', (L.cx1 + L.detX) / 2, L.yc - L.bh - 6, fs + 2, rgba(VERDE, clamp(0.4 + T, 0.4, 1)), 'center', 700);
      // contador de fotones medidos (convergen hacia T)
      if (s.nIn >= 12 && !L.compacto) txt(ctx, `${s.nOut} de ${s.nIn} fotones atraviesan`, (L.cx0 + L.cx1) / 2, cy0 - 7, fs - 1, '#9fb0d9', 'center', 400);
      // --- espectrofotómetro (detector)
      const dy0 = cy0, dh = L.ch;
      panel(ctx, L.detX, dy0, L.detW, dh, 10, 'rgba(255,255,255,.06)', 'rgba(255,255,255,.22)');
      brillo(ctx, L.detX + 2, L.yc, 14, VERDE, 0.25 + 0.6 * T);
      const sx = L.detX + L.detW * 0.14, sw = L.detW * 0.78;
      rr(ctx, sx, dy0 + dh * 0.08, sw, dh * 0.62, 6); ctx.fillStyle = '#04100c'; ctx.fill(); ctx.strokeStyle = 'rgba(46,229,157,.4)'; ctx.stroke();
      const big = clamp(sw / 4.2, 12, 26);
      txt(ctx, 'A', sx + 6, dy0 + dh * 0.08 + big * 0.9, fs, '#9fb0d9', 'left', 700);
      txt(ctx, A < 10 ? num(A, 2) : num(A, 1), sx + sw - 6, dy0 + dh * 0.08 + big * 1.05, big, '#7dffb0', 'right', 700);
      txt(ctx, 'T', sx + 6, dy0 + dh * 0.08 + big * 2.2, fs, '#9fb0d9', 'left', 700);
      txt(ctx, pctT(T), sx + sw - 6, dy0 + dh * 0.08 + big * 2.35, Math.max(11, big * 0.75), '#ffd166', 'right', 700);
      // barra de transmitancia
      rr(ctx, sx, dy0 + dh * 0.78, sw, 7, 3); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
      rr(ctx, sx, dy0 + dh * 0.78, Math.max(2, sw * T), 7, 3); ctx.fillStyle = '#ffd166'; ctx.fill();
      txt(ctx, 'Spectrophotomètre', L.detX + L.detW / 2, dy0 + dh + fs + 2, fs - 1, '#9fb0d9', 'center', 400);
      // --- gráfica A = f(c): recta de pendiente ε·ℓ
      if (!L.compacto) {
        const gy = L.bot + h * 0.07, gH = h - gy - 2.5 * fs, gx = w * 0.1, gW = w * 0.4;
        const ax = ejes(ctx, gx, gy, gW, gH, { x0: 0, x1: 2, y0: 0, y1: 3, xt: [0, 0.5, 1, 1.5, 2], yt: [0, 1, 2, 3], fs: fs - 1, xl: 'c (mmol·L⁻¹)', yl: 'A', fx: (v) => num(v, 1), fy: (v) => num(v, 0) });
        ctx.save(); ctx.beginPath(); ctx.rect(gx, gy, gW, gH); ctx.clip();
        ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(ax.X(0), ax.Y(0)); ctx.lineTo(ax.X(2), ax.Y(p.eps * p.l * 0.002)); ctx.stroke();
        ctx.restore();
        const cm = p.c * 1000, ym = Math.min(A, 3);
        ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,209,102,.6)'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(ax.X(cm), ax.Y(0)); ctx.lineTo(ax.X(cm), ax.Y(ym)); ctx.lineTo(ax.X(0), ax.Y(ym)); ctx.stroke(); ctx.setLineDash([]);
        brillo(ctx, ax.X(cm), ax.Y(ym), 14, '#ffd166', 0.8); bola(ctx, ax.X(cm), ax.Y(ym), 5, '#ffd166');
        txt(ctx, 'A = ε·ℓ·c  (recta)', gx + gW - 4, gy + fs + 2, fs - 1, '#00d4ff', 'right', 700);
        // leyenda
        const lx = w * 0.56, ly = gy + 6;
        brillo(ctx, lx, ly + 4, 12, VERDE, 0.9); ctx.fillStyle = '#eafff2'; ctx.beginPath(); ctx.arc(lx, ly + 4, 1.8, 0, TAU); ctx.fill();
        txt(ctx, 'fotón (verde, 530 nm)', lx + 14, ly + 8, fs, '#c9d6f5', 'left', 400);
        bola(ctx, lx, ly + fs * 2.3, 4.5, MAGENTA); txt(ctx, 'molécula que absorbe', lx + 14, ly + fs * 2.3 + 4, fs, '#c9d6f5', 'left', 400);
        txt(ctx, 'Más ε, ℓ o c  ⇒  más A, menos luz (T)', lx, ly + fs * 4.8, fs, '#9fb0d9', 'left', 400);
      }
    },
    formula(p) {
      const A = p.eps * p.l * p.c, T = Math.pow(10, -A);
      return `\\begin{gathered}A=\\varepsilon\\,\\ell\\,c=${tx(p.eps, 0)}\\times${tx(p.l, 1)}\\times${texSci(p.c, 1)}=${tx(A, 2)}\\\\[2pt] T=\\dfrac{I}{I_0}=10^{-A}=${T < 0.0001 ? texSci(T, 1) : tx(T * 100, 1) + '\\ \\%'}\\end{gathered}`;
    },
    lecturas(p) {
      const A = p.eps * p.l * p.c, T = Math.pow(10, -A);
      return [{ label: 'A', valor: num(A, 2) }, { label: 'T = I/I₀', valor: pctT(T) }, { label: 'c', valor: num(p.c * 1000, 2) + ' mmol·L⁻¹' }, { label: 'ε·ℓ', valor: num(p.eps * p.l, 0) + ' L·mol⁻¹' }];
    },
  });

  // =====================================================================================
  // 2. AVANCE — tableau d'avancement  a A + b B → c C   (por defecto 2 A + B → 3 C)
  //   n(A) = n1 − a·x ;  n(B) = n2 − b·x ;  n(C) = c·x ;  x_max = min(n1/a, n2/b)
  // Las moléculas son un "pool" por especie: al subir x, las de reactivos que sobran se consumen con un
  // destello y en ese mismo lugar aparecen moléculas de producto (≈ 30 partículas por mol).
  // =====================================================================================
  const COL_A = '#3d8bff', COL_B = '#ff9f1c', COL_C = '#2ee59d';
  const coef = (p) => ({ a: p.a || 2, b: p.b || 1, c: p.c || 3 });
  const cf = (k) => (k === 1 ? '' : String(k)); // coeficiente 1 no se escribe
  function estadoAvance(p) {
    const { a, b, c } = coef(p), xmax = Math.min(p.n1 / a, p.n2 / b), xe = Math.min(p.x, xmax);
    const lim = Math.abs(p.n1 / a - p.n2 / b) < 1e-9 ? 'ambos' : p.n1 / a < p.n2 / b ? 'A' : 'B';
    return { a, b, c, xmax, xe, lim, nA: p.n1 - a * xe, nB: p.n2 - b * xe, nC: c * xe, bloq: p.x > xmax + 1e-9 };
  }

  PCB.anim.register('avance', {
    titulo: 'Tableau d’avancement', materia: 'chimie',
    params: [
      { id: 'x', label: 'Avancement x', min: 0, max: 2, step: 0.01, def: 0.2, unit: 'mol' },
      { id: 'n1', label: 'n(A) initial', min: 0.2, max: 2, step: 0.05, def: 1, unit: 'mol' },
      { id: 'n2', label: 'n(B) initial', min: 0.2, max: 2, step: 0.05, def: 0.4, unit: 'mol' },
      { id: 'a', label: 'coef. a', min: 1, max: 4, step: 1, def: 2, unit: '', oculto: true },
      { id: 'b', label: 'coef. b', min: 1, max: 4, step: 1, def: 1, unit: '', oculto: true },
      { id: 'c', label: 'coef. c', min: 1, max: 4, step: 1, def: 3, unit: '', oculto: true },
    ],
    create(host, p) {
      const rng = host.rng, mk = (n) => Array.from({ length: n }, () => ({ u: rng(), v: rng(), a: rng() * TAU, vis: 0, want: false, fl: 0 }));
      const red = host.reduced;
      return { t: 0, rng, K: red ? 18 : 30, A: mk(70), B: mk(70), C: mk(110), burst: [], rings: [], red };
    },
    step(s, dt, p) {
      const e = estadoAvance(p), rng = s.rng, K = s.K;
      s.t += dt;
      const sync = (pool, n, nuevo) => {
        const obj = Math.min(pool.length, Math.max(0, Math.round(n * K)));
        pool.forEach((q, i) => {
          const quiere = i < obj;
          if (quiere !== q.want) { // cambio de estado: destello de reacción
            q.want = quiere;
            if (nuevo === 'C') {
              if (quiere) { const b = s.burst.pop(); if (b) { q.u = b.u; q.v = b.v; } q.vis = Math.max(q.vis, 0.05); s.rings.push({ u: q.u, v: q.v, t: 0, col: COL_C }); }
            } else if (!quiere && q.vis > 0.3) { s.burst.push({ u: q.u, v: q.v }); if (s.burst.length > 40) s.burst.shift(); s.rings.push({ u: q.u, v: q.v, t: 0, col: nuevo === 'A' ? COL_A : COL_B }); }
          }
          q.vis = suav(q.vis, quiere ? 1 : 0, 5, dt); deambula(q, dt, 0.07, 1, rng);
        });
      };
      sync(s.A, e.nA, 'A'); sync(s.B, e.nB, 'B'); sync(s.C, e.nC, 'C');
      for (let i = s.rings.length - 1; i >= 0; i--) { s.rings[i].t += dt; if (s.rings[i].t > 0.55) s.rings.splice(i, 1); }
    },
    draw(s, ctx, w, h, p) {
      const e = estadoAvance(p), fs = FS(w, h);
      fondo(ctx, w, h);
      const eq = `${cf(e.a)}A + ${cf(e.b)}B → ${cf(e.c)}C`;
      // ---------- vaso con moléculas (izquierda)
      const vx = w * 0.05, vw = w * 0.34, vy = h * 0.2, vh = h * 0.64;
      txt(ctx, eq, vx + vw / 2, h * 0.1, fs + 3, '#eaf0ff', 'center', 700);
      const r = vaso(ctx, vx, vy, vw, vh, 0.8, '#5fd0ff', 0.2);
      const pulso = 0.5 + 0.5 * Math.sin(s.t * 4);
      const rad = clamp(Math.min(vw, vh) * 0.034, 3.2, 6.6);
      const pos = (q) => [r.x0 + q.u * (r.x1 - r.x0), r.y0 + q.v * (r.y1 - r.y0)];
      const lim = (k) => e.lim === k || e.lim === 'ambos';
      for (const [pool, col, k, rr0] of [[s.A, COL_A, 'A', rad], [s.B, COL_B, 'B', rad * 1.12], [s.C, COL_C, 'C', rad * 0.92]]) {
        for (const q of pool) {
          if (q.vis < 0.02) continue; const [x, y] = pos(q);
          if (k !== 'C' && lim(k) && !e.bloq) brillo(ctx, x, y, rr0 * (3.2 + pulso), '#ff4d6d', 0.28 * q.vis); // reactivo limitante resaltado
          bola(ctx, x, y, rr0 * (0.6 + 0.4 * q.vis), col, q.vis);
        }
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const g of s.rings) { const [x, y] = pos(g), k = g.t / 0.55; ctx.strokeStyle = rgba(g.col, 0.9 * (1 - k)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 3 + k * 16, 0, TAU); ctx.stroke(); }
      ctx.restore();
      // leyenda bajo el vaso
      const ly = vy + vh + fs + 8, lw = vw / 3;
      [[COL_A, 'A', e.nA, 'A'], [COL_B, 'B', e.nB, 'B'], [COL_C, 'C', e.nC, 'C']].forEach(([col, nm, v, k], i) => {
        const lx = vx + i * lw + 6;
        bola(ctx, lx, ly - fs * 0.35, 4.5, col); txt(ctx, `${nm} ${num(v, 2)}`, lx + 9, ly, fs - 1, '#c9d6f5', 'left', 600);
      });
      // ---------- barra de avance + tableau (derecha)
      const rx = w * 0.45, rw = w * 0.52;
      txt(ctx, 'Avancement x', rx, h * 0.1, fs + 1, '#c9d6f5', 'left', 700);
      txt(ctx, 'x = ' + num(e.xe, 2) + ' mol', rx + rw, h * 0.1, fs + 1, '#ffd166', 'right', 700);
      const by = h * 0.15, bh = Math.max(12, h * 0.05);
      rr(ctx, rx, by, rw, bh, bh / 2); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
      const f = e.xmax > 0 ? clamp(e.xe / e.xmax, 0, 1) : 0;
      if (f > 0.001) { const gb = ctx.createLinearGradient(rx, 0, rx + rw, 0); gb.addColorStop(0, '#2ee59d'); gb.addColorStop(1, '#ff3da6'); rr(ctx, rx, by, Math.max(bh, rw * f), bh, bh / 2); ctx.fillStyle = gb; ctx.fill(); }
      brillo(ctx, rx + rw * f, by + bh / 2, bh * 1.8, '#ffd166', 0.6); bola(ctx, rx + rw * f, by + bh / 2, bh * 0.55, '#ffd166');
      txt(ctx, '0', rx, by + bh + fs + 2, fs - 1, '#9fb0d9', 'left', 400);
      const limTxt = e.lim === 'ambos' ? 'A y B (mezcla estequiométrica)' : e.lim + ' limitante';
      txt(ctx, 'x_max = ' + num(e.xmax, 2) + ' mol  ·  ' + limTxt, rx + rw, by + bh + fs + 2, fs - 1, '#ff8fb1', 'right', 700);
      if (e.bloq) txt(ctx, 'x > x_max: la reacción se detiene en x_max', rx + rw / 2, by + bh + 2 * fs + 6, fs - 1, '#ffd166', 'center', 600);
      // tableau
      const ty = h * 0.34, th = h * 0.6, rows = 4, rh = th / rows;
      const cw0 = rw * 0.25, cwi = (rw - cw0) / 4;
      panel(ctx, rx, ty, rw, th, 8);
      const fsT = clamp(rh * 0.34, 9.5, 15);
      const cols = ['x', `n(A)`, `n(B)`, `n(C)`], colC = ['#ffd166', COL_A, COL_B, COL_C];
      // cabecera
      txt(ctx, 'État', rx + cw0 / 2, ty + rh * 0.62, fsT, '#9fb0d9', 'center', 700);
      cols.forEach((c, i) => txt(ctx, c + (i ? ' (mol)' : ''), rx + cw0 + cwi * (i + 0.5), ty + rh * 0.62, fsT - (i ? 1.5 : 0), colC[i], 'center', 700));
      const filas = [
        ['Initial', 0, p.n1, p.n2, 0, ['0', 'n₁', 'n₂', '0'], 0],
        ['En cours', e.xe, e.nA, e.nB, e.nC, ['x', `n₁−${cf(e.a)}x`, `n₂−${cf(e.b)}x`, `${cf(e.c)}x`], 1],
        ['Final', e.xmax, p.n1 - e.a * e.xmax, p.n2 - e.b * e.xmax, e.c * e.xmax, ['x_max', 'n₁−a·x_max', 'n₂−b·x_max', 'c·x_max'], 2],
      ];
      filas.forEach((fl, i) => {
        const y = ty + rh * (i + 1);
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(rx + 6, y); ctx.lineTo(rx + rw - 6, y); ctx.stroke();
        if (i === 1) { rr(ctx, rx + 3, y + 2, rw - 6, rh - 4, 6); ctx.fillStyle = 'rgba(255,209,102,.10)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,209,102,.45)'; ctx.stroke(); }
        txt(ctx, fl[0], rx + cw0 / 2, y + rh * (rh > 34 ? 0.45 : 0.62), fsT, i === 1 ? '#ffd166' : '#c9d6f5', 'center', 700);
        for (let k = 0; k < 4; k++) {
          const cx = rx + cw0 + cwi * (k + 0.5), v = fl[1 + k], cero = Math.abs(v) < 1e-9;
          const esLim = i === 2 && ((k === 1 && lim('A')) || (k === 2 && lim('B')));
          if (esLim) { rr(ctx, cx - cwi / 2 + 3, y + 3, cwi - 6, rh - 6, 6); ctx.fillStyle = 'rgba(255,77,109,.2)'; ctx.fill(); ctx.strokeStyle = '#ff4d6d'; ctx.stroke(); }
          txt(ctx, num(cero ? 0 : v, 2), cx, y + rh * (rh > 34 ? 0.45 : 0.62), fsT + 1, esLim ? '#ff8fb1' : '#eaf0ff', 'center', 700);
          if (rh > 34) txt(ctx, esLim ? '★ limitante' : fl[5][k], cx, y + rh * 0.82, fsT - 3, esLim ? '#ff8fb1' : '#7f8fb8', 'center', 400);
        }
      });
      if (rh <= 34) txt(ctx, '★ = reactivo limitante (se agota)', rx + rw, ty + th + fs + 3, fs - 2, '#ff8fb1', 'right', 400);
    },
    formula(p) {
      const e = estadoAvance(p), A = e.a === 1 ? '' : `${e.a}\\times`, B = e.b === 1 ? '' : `${e.b}\\times`;
      return `\\begin{gathered}n(\\mathrm{A})=n_1-${cf(e.a)}x=${tx(p.n1)}-${A}${tx(e.xe)}=${tx(e.nA)}\\ \\text{mol}\\qquad n(\\mathrm{B})=n_2-${cf(e.b)}x=${tx(e.nB)}\\ \\text{mol}\\qquad n(\\mathrm{C})=${cf(e.c)}x=${tx(e.nC)}\\ \\text{mol}\\\\[2pt] x_{\\max}=\\min\\!\\left(\\dfrac{n_1}{${e.a}},\\dfrac{n_2}{${e.b}}\\right)=${tx(e.xmax)}\\ \\text{mol}\\end{gathered}`;
    },
    lecturas(p) {
      const e = estadoAvance(p);
      return [{ label: 'x', valor: num(e.xe, 2) + ' mol' }, { label: 'x_max', valor: num(e.xmax, 2) + ' mol' }, { label: 'limitante', valor: e.lim === 'ambos' ? 'A y B' : e.lim },
        { label: 'n(A)', valor: num(e.nA, 2) + ' mol' }, { label: 'n(B)', valor: num(e.nB, 2) + ' mol' }, { label: 'n(C)', valor: num(e.nC, 2) + ' mol' }];
    },
    dispose(s) { /* sin listeners */ },
  });
})();
