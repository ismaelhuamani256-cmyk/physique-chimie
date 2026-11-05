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
      const red = host.reduced, K = red ? 18 : 30, e = estadoAvance(p);
      const s = { t: 0, rng, K, A: mk(70), B: mk(70), C: mk(110), burst: [], rings: [], red };
      // estado inicial coherente con los parámetros (sin ráfaga de destellos al abrir)
      [[s.A, e.nA], [s.B, e.nB], [s.C, e.nC]].forEach(([pool, n]) => { const obj = Math.min(pool.length, Math.max(0, Math.round(n * K))); pool.forEach((q, i) => { q.want = i < obj; q.vis = q.want ? 1 : 0; }); });
      return s;
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
      const peq = w < 520; // pantalla estrecha: vaso más pequeño y tabla sin subtítulos
      const vx = w * (peq ? 0.03 : 0.05), vw = w * (peq ? 0.31 : 0.34), vy = h * 0.2, vh = h * 0.64;
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
      const rx = w * (peq ? 0.39 : 0.45), rw = w * (peq ? 0.59 : 0.52);
      txt(ctx, 'Avancement x', rx, h * 0.1, fs + 1, '#c9d6f5', 'left', 700);
      txt(ctx, 'x = ' + num(e.xe, 2) + ' mol', rx + rw, h * 0.1, fs + 1, '#ffd166', 'right', 700);
      const by = h * 0.15, bh = Math.max(12, h * 0.05);
      rr(ctx, rx, by, rw, bh, bh / 2); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
      const f = e.xmax > 0 ? clamp(e.xe / e.xmax, 0, 1) : 0;
      if (f > 0.001) { const gb = ctx.createLinearGradient(rx, 0, rx + rw, 0); gb.addColorStop(0, '#2ee59d'); gb.addColorStop(1, '#ff3da6'); rr(ctx, rx, by, Math.max(bh, rw * f), bh, bh / 2); ctx.fillStyle = gb; ctx.fill(); }
      brillo(ctx, rx + rw * f, by + bh / 2, bh * 1.8, '#ffd166', 0.6); bola(ctx, rx + rw * f, by + bh / 2, bh * 0.55, '#ffd166');
      txt(ctx, '0', rx, by + bh + fs + 2, fs - 1, '#9fb0d9', 'left', 400);
      const limTxt = e.lim === 'ambos' ? (peq ? 'A y B' : 'A y B (mezcla estequiométrica)') : e.lim + ' limitante';
      txt(ctx, 'x_max = ' + num(e.xmax, 2) + ' mol  ·  ' + limTxt, rx + rw, by + bh + fs + 2, fs - 1, '#ff8fb1', 'right', 700);
      if (e.bloq) txt(ctx, 'x > x_max: la reacción se detiene en x_max', rx + rw / 2, by + bh + 2 * fs + 6, fs - 1, '#ffd166', 'center', 600);
      // tableau
      const ty = h * 0.34, th = h * 0.6, rows = 4, rh = th / rows;
      const cw0 = rw * (peq ? 0.23 : 0.25), cwi = (rw - cw0) / 4, sub = rh > 34 && !peq;
      panel(ctx, rx, ty, rw, th, 8);
      const fsT = clamp(rh * 0.34, 9.5, 15);
      const cols = ['x', `n(A)`, `n(B)`, `n(C)`], colC = ['#ffd166', COL_A, COL_B, COL_C];
      // cabecera
      txt(ctx, 'État', rx + cw0 / 2, ty + rh * 0.62, fsT, '#9fb0d9', 'center', 700);
      cols.forEach((c, i) => txt(ctx, c + (i && !peq ? ' (mol)' : ''), rx + cw0 + cwi * (i + 0.5), ty + rh * 0.62, fsT - (i ? 1.5 : 0), colC[i], 'center', 700));
      const filas = [
        ['Initial', 0, p.n1, p.n2, 0, ['0', 'n₁', 'n₂', '0'], 0],
        ['En cours', e.xe, e.nA, e.nB, e.nC, ['x', `n₁−${cf(e.a)}x`, `n₂−${cf(e.b)}x`, `${cf(e.c)}x`], 1],
        ['Final', e.xmax, p.n1 - e.a * e.xmax, p.n2 - e.b * e.xmax, e.c * e.xmax, ['x_max', 'n₁−a·x_max', 'n₂−b·x_max', 'c·x_max'], 2],
      ];
      filas.forEach((fl, i) => {
        const y = ty + rh * (i + 1);
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(rx + 6, y); ctx.lineTo(rx + rw - 6, y); ctx.stroke();
        if (i === 1) { rr(ctx, rx + 3, y + 2, rw - 6, rh - 4, 6); ctx.fillStyle = 'rgba(255,209,102,.10)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,209,102,.45)'; ctx.stroke(); }
        txt(ctx, fl[0], rx + cw0 / 2, y + rh * (sub ? 0.45 : 0.62), fsT, i === 1 ? '#ffd166' : '#c9d6f5', 'center', 700);
        for (let k = 0; k < 4; k++) {
          const cx = rx + cw0 + cwi * (k + 0.5), v = fl[1 + k], cero = Math.abs(v) < 1e-9;
          const esLim = i === 2 && ((k === 1 && lim('A')) || (k === 2 && lim('B')));
          if (esLim) { rr(ctx, cx - cwi / 2 + 3, y + 3, cwi - 6, rh - 6, 6); ctx.fillStyle = 'rgba(255,77,109,.2)'; ctx.fill(); ctx.strokeStyle = '#ff4d6d'; ctx.stroke(); }
          txt(ctx, num(cero ? 0 : v, 2), cx, y + rh * (sub ? 0.45 : 0.62), fsT + 1, esLim ? '#ff8fb1' : '#eaf0ff', 'center', 700);
          if (sub) txt(ctx, esLim ? '★ limitante' : fl[5][k], cx, y + rh * 0.82, fsT - 3, esLim ? '#ff8fb1' : '#7f8fb8', 'center', 400);
        }
      });
      if (!sub) txt(ctx, '★ = reactivo limitante (se agota)', rx + rw, ty + th + fs + 3, fs - 2, '#ff8fb1', 'right', 400);
    },
    formula(p) {
      const e = estadoAvance(p), A = e.a === 1 ? '' : `${e.a}\\times`, B = e.b === 1 ? '' : `${e.b}\\times`;
      if (window.innerWidth < 640) { // pantalla estrecha: una relación por línea y sin desarrollo numérico largo
        return `\\begin{gathered}n(\\mathrm{A})=n_1-${cf(e.a)}x=${tx(e.nA)}\\ \\text{mol}\\\\ n(\\mathrm{B})=n_2-${cf(e.b)}x=${tx(e.nB)}\\ \\text{mol}\\\\ n(\\mathrm{C})=${cf(e.c)}x=${tx(e.nC)}\\ \\text{mol}\\\\ x_{\\max}=${tx(e.xmax)}\\ \\text{mol}\\end{gathered}`;
      }
      return `\\begin{gathered}n(\\mathrm{A})=n_1-${cf(e.a)}x=${tx(p.n1)}-${A}${tx(e.xe)}=${tx(e.nA)}\\ \\text{mol}\\qquad n(\\mathrm{B})=n_2-${cf(e.b)}x=${tx(e.nB)}\\ \\text{mol}\\qquad n(\\mathrm{C})=${cf(e.c)}x=${tx(e.nC)}\\ \\text{mol}\\\\[2pt] x_{\\max}=\\min\\!\\left(\\dfrac{n_1}{${e.a}},\\dfrac{n_2}{${e.b}}\\right)=${tx(e.xmax)}\\ \\text{mol}\\end{gathered}`;
    },
    lecturas(p) {
      const e = estadoAvance(p);
      return [{ label: 'x', valor: num(e.xe, 2) + ' mol' }, { label: 'x_max', valor: num(e.xmax, 2) + ' mol' }, { label: 'limitante', valor: e.lim === 'ambos' ? 'A y B' : e.lim },
        { label: 'n(A)', valor: num(e.nA, 2) + ' mol' }, { label: 'n(B)', valor: num(e.nB, 2) + ' mol' }, { label: 'n(C)', valor: num(e.nC, 2) + ' mol' }];
    },
    dispose(s) { /* sin listeners */ },
  });

  // =====================================================================================
  // 3. QUOTIENT-EQUILIBRE — Qr vs K   (modelo didáctico A ⇌ B,  Qr = [B]/[A],  [A]+[B] = 1 mol·L⁻¹)
  //   Qr < K → la reacción evoluciona en sentido directo (A → B);  Qr > K → sentido inverso (B → A);  Qr = K → equilibrio.
  // Cinética del modelo: v_directa = k_d·[A], v_inversa = k_i·[B] con k_d/k_i = K, de modo que en el equilibrio
  // ambas se igualan (equilibrio dinámico: las moléculas siguen intercambiándose sin cambio neto).
  // Mientras no se pulsa «Dejar evolucionar», el dibujo es una "foto" del instante con el Qr del slider.
  // =====================================================================================
  const COL_QA = '#3d8bff', COL_QB = '#ff3da6';
  const qNow = (f) => f / Math.max(1e-9, 1 - f);
  const sentido = (Q, K) => (Math.abs(Math.log(Q / K)) < 0.04 ? 0 : Q < K ? 1 : -1); // 1 directo, -1 inverso, 0 equilibrio

  PCB.anim.register('quotient-equilibre', {
    titulo: 'Quotient de réaction et équilibre', materia: 'chimie',
    params: [
      { id: 'K', label: 'Constante K', min: 0.1, max: 20, step: 0.1, def: 4, unit: '' },
      { id: 'Q', label: 'Quotient Qr (état initial)', min: 0.1, max: 20, step: 0.1, def: 1, unit: '' },
    ],
    create(host, p) {
      const rng = host.rng, N = host.reduced ? 70 : 120, ord = [];
      for (let i = 0; i < N; i++) ord.push(i);
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
      // type = (ord < nB): al cambiar nB se transforman las moléculas cuyo "orden" cruza el umbral
      const q = ord.map((o) => ({ u: rng(), v: rng(), a: rng() * TAU, ord: o, cb: 0, fl: 0 }));
      const porOrd = []; q.forEach((m) => (porOrd[m.ord] = m));
      const f0 = p.Q / (1 + p.Q), s = { t: 0, rng, N, q, porOrd, f: f0, nB: Math.round(f0 * N), evol: false, swapAcc: 0, red: host.reduced };
      q.forEach((m) => (m.cb = m.ord < s.nB ? 1 : 0));
      clics(s, host);
      return s;
    },
    onParam(s, id, v, p) { if (id === 'Q') s.evol = false; },
    step(s, dt, p) {
      const K = p.K, kd = 0.4 * Math.sqrt(K), ki = 0.4 / Math.sqrt(K), rng = s.rng, N = s.N;
      s.t += dt;
      if (s.evol) s.f += dt * (kd * (1 - s.f) - ki * s.f);            // evolución cinética hacia Qr = K
      else s.f = suav(s.f, p.Q / (1 + p.Q), 7, dt);                   // sigue al slider (foto del instante)
      const Qn = qNow(s.f), eq = sentido(Qn, K) === 0;
      s.dirFlux = kd * (1 - s.f); s.invFlux = ki * s.f;
      // moléculas que cambian de tipo para ajustar nB al valor objetivo (como mucho unas pocas por frame)
      const obj = Math.round(s.f * N); let guard = 4;
      while (s.nB < obj && guard-- > 0) { const m = s.porOrd[s.nB]; if (m) m.fl = 1; s.nB++; }
      while (s.nB > obj && guard-- > 0) { s.nB--; const m = s.porOrd[s.nB]; if (m) m.fl = 1; }
      // equilibrio dinámico: intercambios A→B y B→A simultáneos (sin cambio neto)
      if (s.evol || eq) {
        s.swapAcc += dt * clamp(s.dirFlux * N * 0.35, 1.5, s.red ? 6 : 12);
        while (s.swapAcc >= 1 && s.nB > 0 && s.nB < N) {
          s.swapAcc -= 1;
          const oA = s.nB + Math.floor(rng() * (N - s.nB)), oB = Math.floor(rng() * s.nB); // un orden de A y uno de B
          const mA = s.porOrd[oA], mB = s.porOrd[oB];
          mA.ord = oB; mB.ord = oA; s.porOrd[oB] = mA; s.porOrd[oA] = mB; mA.fl = 1; mB.fl = 1;
        }
      } else s.swapAcc = 0;
      s.q.forEach((m) => { m.cb = suav(m.cb, m.ord < s.nB ? 1 : 0, 9, dt); m.fl = Math.max(0, m.fl - dt * 2.5); deambula(m, dt, 0.08, 1, rng); });
    },
    draw(s, ctx, w, h, p) {
      const K = p.K, f = s.f, Qn = qNow(f), sen = sentido(Qn, K), fs = FS(w, h), peq = w < 520;
      fondo(ctx, w, h); s.btns.length = 0;
      const sh = clamp(h * 0.26, 56, 96), sy = h - sh;          // franja inferior: escala logarítmica
      // ---------- botón + estado
      const bw = peq ? 128 : 160, bh = 26;
      if (!s.evol) boton(ctx, s, 8, 6, bw, bh, '▶ Dejar evolucionar', () => { s.evol = true; }, '#2ee59d', fs);
      else boton(ctx, s, 8, 6, bw, bh, '↺ Volver al Qr inicial', () => { s.evol = false; s.f = p.Q / (1 + p.Q); }, '#ffd166', fs);
      // ---------- vaso con moléculas
      const vx = w * 0.05, vy = bh + 16, vw = w * (peq ? 0.4 : 0.38), vh = sy - vy - 12;
      const r = vaso(ctx, vx, vy, vw, vh, 0.82, '#7aa8ff', 0.16);
      const rad = clamp(Math.min(vw, vh) * 0.034, 3.2, 6.4);
      for (const m of s.q) {
        const x = r.x0 + m.u * (r.x1 - r.x0), y = r.y0 + m.v * (r.y1 - r.y0);
        if (m.fl > 0) brillo(ctx, x, y, rad * 4, '#ffffff', m.fl * 0.55);
        bola(ctx, x, y, rad, mezcla(COL_QA, COL_QB, m.cb));
      }
      // ---------- columna derecha: sentido, flujos y barras
      const rx = vx + vw + w * 0.05, rw = w - rx - w * 0.03;
      const colSen = sen === 1 ? '#2ee59d' : sen === -1 ? '#ff3da6' : '#ffd166';
      const cmp = sen === 1 ? 'Qr < K' : sen === -1 ? 'Qr > K' : 'Qr = K';
      txt(ctx, cmp, rx + rw / 2, vy + fs + 4, fs + 6, colSen, 'center', 700);
      const msg = sen === 1 ? 'sentido directo  A → B' : sen === -1 ? 'sentido inverso  B → A' : 'equilibrio dinámico';
      txt(ctx, msg, rx + rw / 2, vy + 2 * fs + 12, fs, '#c9d6f5', 'center', 600);
      // flechas de velocidades (anchura ∝ velocidad): directa → e inversa ←
      const ay = vy + 2 * fs + 26, jd = clamp(s.dirFlux / 0.6, 0.02, 1), ji = clamp(s.invFlux / 0.6, 0.02, 1);
      const mx = rw * 0.12;
      flecha(ctx, rx + mx, ay, rx + rw - mx, ay, '#2ee59d', 1.5 + 6 * jd, 6 + 6 * jd);
      flecha(ctx, rx + rw - mx, ay + 14 + 4 * jd, rx + mx, ay + 14 + 4 * jd, '#ff3da6', 1.5 + 6 * ji, 6 + 6 * ji);
      if (!peq) {
        txt(ctx, 'v directa', rx + mx, ay - 6 - 3 * jd, fs - 2, '#8fe9c4', 'left', 400);
        txt(ctx, 'v inversa', rx + rw - mx, ay + 14 + 4 * jd + 11 + 3 * ji + fs * 0.6, fs - 2, '#ff9cc9', 'right', 400);
      }
      // barras de concentración
      const by0 = ay + (peq ? 36 : 14 + 4 + 28 + fs), by1 = sy - fs * 2.2, bwid = Math.min(rw * 0.28, 52);
      if (by1 - by0 > 24) {
        [['[A]', 1 - f, COL_QA, rx + rw * 0.27], ['[B]', f, COL_QB, rx + rw * 0.73]].forEach(([nm, v, col, cx]) => {
          rr(ctx, cx - bwid / 2, by0, bwid, by1 - by0, 5); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill();
          const hh = Math.max(2, (by1 - by0) * v);
          const gb = ctx.createLinearGradient(0, by1 - hh, 0, by1); gb.addColorStop(0, col); gb.addColorStop(1, rgba(col, 0.55));
          rr(ctx, cx - bwid / 2, by1 - hh, bwid, hh, 5); ctx.fillStyle = gb; ctx.fill();
          txt(ctx, nm, cx, by1 + fs + 2, fs, col, 'center', 700);
          txt(ctx, num(v, 2), cx, Math.min(by1 - 4, by1 - hh - 4), fs - 1, '#eaf0ff', 'center', 700);
        });
        txt(ctx, 'mol·L⁻¹', rx + rw / 2, by1 + fs + 2, fs - 2, '#7f8fb8', 'center', 400);
      }
      // ---------- escala logarítmica de Qr y K (10⁻² … 10²)
      const gx = w * 0.06, gw = w * 0.88, gy = sy + sh * 0.42, lg = (v) => gx + ((Math.log10(clamp(v, 0.01, 100)) + 2) / 4) * gw;
      panel(ctx, w * 0.02, sy + 2, w * 0.96, sh - 6, 10);
      txt(ctx, 'Escala logarítmica de Qr y K', w * 0.04, sy + fs + 6, fs - 1, '#9fb0d9', 'left', 600);
      // zonas: izquierda de K (directo) / derecha (inverso)
      const kx = lg(K), zh = 7;
      rr(ctx, gx, gy - zh / 2, Math.max(0, kx - gx), zh, 3); ctx.fillStyle = 'rgba(46,229,157,.35)'; ctx.fill();
      rr(ctx, kx, gy - zh / 2, Math.max(0, gx + gw - kx), zh, 3); ctx.fillStyle = 'rgba(255,61,166,.35)'; ctx.fill();
      [0.01, 0.1, 1, 10, 100].forEach((v, i) => {
        const x = lg(v); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, gy + 5); ctx.lineTo(x, gy + 10); ctx.stroke();
        txt(ctx, ['0,01', '0,1', '1', '10', '100'][i], x, gy + 10 + fs, fs - 2, '#7f8fb8', 'center', 400);
      });
      // marcador de K (triángulo cian) y de Qr (círculo)
      ctx.fillStyle = '#00d4ff'; ctx.beginPath(); ctx.moveTo(kx, gy - 5); ctx.lineTo(kx - 6, gy - 15); ctx.lineTo(kx + 6, gy - 15); ctx.closePath(); ctx.fill();
      txt(ctx, 'K = ' + num(K, 1), kx, gy - 19, fs - 1, '#00d4ff', 'center', 700);
      const qx = lg(Qn);
      if (Math.abs(qx - kx) > 10) flecha(ctx, qx + (kx > qx ? 8 : -8), gy, kx + (kx > qx ? -8 : 8), gy, colSen, 2, 7);
      brillo(ctx, qx, gy, 16, colSen, 0.7); bola(ctx, qx, gy, 6.5, colSen);
      txt(ctx, 'Qr = ' + num(Qn, Qn < 10 ? 2 : 1), qx, gy + 10 + fs + fs + 1 > sy + sh - 6 ? gy - 19 : gy + 10 + 2 * fs + 2, fs - 1, colSen, 'center', 700);
    },
    formula(p) {
      const sen = sentido(p.Q, p.K), cmp = sen === 1 ? '<' : sen === -1 ? '>' : '=';
      const txtS = sen === 1 ? '\\text{sentido directo}' : sen === -1 ? '\\text{sentido inverso}' : '\\text{equilibrio}';
      const sep = window.innerWidth < 640 ? '\\\\' : '\\ \\Rightarrow\\ '; // en pantalla estrecha, el sentido pasa a otra línea
      return `\\begin{gathered}Q_r=\\dfrac{[\\mathrm{B}]}{[\\mathrm{A}]}=${tx(p.Q, 1)}\\ ${cmp}\\ K=${tx(p.K, 1)}${sep}${txtS}\\end{gathered}`;
    },
    lecturas(p) {
      const sen = sentido(p.Q, p.K);
      return [{ label: 'Qr', valor: num(p.Q, 2) }, { label: 'K', valor: num(p.K, 2) }, { label: 'evolución', valor: sen === 1 ? 'directa (→)' : sen === -1 ? 'inversa (←)' : 'equilibrio (Qr = K)' },
        { label: '[B]/[A] en equilibrio', valor: num(p.K, 2) }];
    },
    dispose(s) { if (s._offClics) s._offClics(); },
  });

  // =====================================================================================
  // 4. CINÉTICA — reacción de orden 1 (A → productos):  c(t) = c0·e^(−kt),  v = −dc/dt = k·c,  t½ = ln2/k
  // Cada molécula tiene un umbral u_i (secuencia de baja discrepancia) y reacciona cuando e^(−kt) < u_i,
  // es decir, en el instante t_i = −ln(u_i)/k: así el nº de moléculas de reactivo sigue exactamente c(t)/c0.
  // El botón ▶ reproduce el tiempo desde 0 hasta el valor del slider t.
  // =====================================================================================
  const COL_R = '#3d8bff', COL_P = '#2ee59d';
  const TMAX_C = 20, CMAX_C = 1.5;
  PCB.anim.register('cinetica', {
    titulo: 'Cinétique chimique (ordre 1)', materia: 'chimie',
    params: [
      { id: 'c0', label: 'Concentration initiale c₀', min: 0.1, max: 1.5, step: 0.05, def: 1, unit: 'mol·L⁻¹' },
      { id: 'k', label: 'Constante de vitesse k', min: 0.05, max: 1, step: 0.01, def: 0.2, unit: 's⁻¹' },
      { id: 't', label: 'Temps t', min: 0, max: TMAX_C, step: 0.1, def: 5, unit: 's' },
    ],
    create(host, p) {
      const rng = host.rng, N = 120;
      const q = Array.from({ length: N }, (_, i) => ({ u: rng(), v: rng(), a: rng() * TAU, th: baja(i), cb: baja(i) > Math.exp(-p.k * p.t) ? 1 : 0, fl: 0, vis: 0, estado: baja(i) > Math.exp(-p.k * p.t) ? 1 : 0 }));
      const s = { t: 0, rng, q, tv: p.t, play: false, red: host.reduced };
      clics(s, host); return s;
    },
    onParam(s, id, v, p) { if (id === 't') s.play = false; },
    step(s, dt, p) {
      s.t += dt; tiempoPaso(s, dt, p, TMAX_C, 8);
      const Nact = Math.round(p.c0 * (s.red ? 55 : 80)), surv = Math.exp(-p.k * s.tv);
      s.q.forEach((m, i) => {
        m.vis = suav(m.vis, i < Nact ? 1 : 0, 5, dt);
        const prod = m.th > surv ? 1 : 0;                      // ya reaccionó (e^(−kt) < u_i)
        if (prod !== m.estado) { m.estado = prod; m.fl = 1; }
        m.cb = suav(m.cb, prod, 10, dt); m.fl = Math.max(0, m.fl - dt * 2.2);
        deambula(m, dt, 0.09, 1, s.rng);
      });
    },
    draw(s, ctx, w, h, p) {
      const fs = FS(w, h), peq = w < 520, tv = s.tv, c = p.c0 * Math.exp(-p.k * tv), thalf = Math.LN2 / p.k, v = p.k * c;
      s.btns.length = 0; fondo(ctx, w, h);
      // ---------- tubo de ensayo (izquierda)
      const tw = Math.min(w * (peq ? 0.2 : 0.17), 78), tx0 = w * (peq ? 0.04 : 0.07), ty0 = h * 0.1, th = h * 0.74;
      ctx.save();
      const rad = tw / 2;
      const trazo = () => { ctx.beginPath(); ctx.moveTo(tx0, ty0); ctx.lineTo(tx0, ty0 + th - rad); ctx.arc(tx0 + rad, ty0 + th - rad, rad, Math.PI, 0, true); ctx.lineTo(tx0 + tw, ty0); ctx.closePath(); };
      trazo(); ctx.clip();
      const ly = ty0 + th * 0.22, gl = ctx.createLinearGradient(0, ly, 0, ty0 + th);
      gl.addColorStop(0, 'rgba(95,208,255,.16)'); gl.addColorStop(1, 'rgba(95,208,255,.34)');
      ctx.fillStyle = gl; ctx.fillRect(tx0, ly, tw, th); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(tx0, ly, tw, 2);
      const g2 = ctx.createLinearGradient(tx0, 0, tx0 + tw, 0); g2.addColorStop(0, 'rgba(255,255,255,.18)'); g2.addColorStop(0.22, 'rgba(255,255,255,.02)'); g2.addColorStop(1, 'rgba(255,255,255,.08)');
      ctx.fillStyle = g2; ctx.fillRect(tx0, ty0, tw, th);
      ctx.restore();
      trazo(); ctx.strokeStyle = 'rgba(200,225,255,.65)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx0 - 4, ty0); ctx.lineTo(tx0 + tw + 4, ty0); ctx.stroke();
      const r0 = clamp(tw * 0.055, 2.6, 4.6), ix0 = tx0 + 5, ix1 = tx0 + tw - 5, iy0 = ly + 6, iy1 = ty0 + th - rad * 0.4;
      for (const m of s.q) {
        if (m.vis < 0.02) continue;
        const x = ix0 + m.u * (ix1 - ix0), y = iy0 + m.v * (iy1 - iy0);
        if (m.fl > 0) brillo(ctx, x, y, r0 * 4.2, m.cb > 0.5 ? '#baffdf' : '#bcd6ff', m.fl * 0.7);
        bola(ctx, x, y, r0 * (1 + 0.15 * m.cb), mezcla(COL_R, COL_P, m.cb), m.vis);
      }
      // leyenda
      bola(ctx, tx0 - 1, ty0 + th + fs + 6, 4.5, COL_R); txt(ctx, 'A', tx0 + 7, ty0 + th + fs + 10, fs, '#c9d6f5', 'left', 700);
      bola(ctx, tx0 + tw * 0.55, ty0 + th + fs + 6, 4.5, COL_P); txt(ctx, 'produits', tx0 + tw * 0.55 + 8, ty0 + th + fs + 10, fs - 1, '#c9d6f5', 'left', 400);
      // ---------- gráfica c(t)
      const gx = w * (peq ? 0.30 : 0.34), gw = w * (peq ? 0.66 : 0.62), gy = h * 0.14, gh = h * 0.62;
      const ax = ejes(ctx, gx, gy, gw, gh, { x0: 0, x1: TMAX_C, y0: 0, y1: CMAX_C, xt: [0, 5, 10, 15, 20], yt: [0, 0.5, 1, 1.5], fs: fs - 1, xl: 't (s)', yl: 'c (mol·L⁻¹)', fx: (z) => num(z, 0), fy: (z) => num(z, 1) });
      ctx.save(); ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
      // marcas de t½ (y 2·t½)
      [1, 2].forEach((n) => {
        const th2 = n * thalf; if (th2 > TMAX_C) return;
        const cc = p.c0 / Math.pow(2, n);
        ctx.setLineDash([5, 4]); ctx.strokeStyle = n === 1 ? 'rgba(255,209,102,.85)' : 'rgba(255,209,102,.4)'; ctx.lineWidth = 1.2; ctx.beginPath();
        ctx.moveTo(ax.X(th2), ax.Y(0)); ctx.lineTo(ax.X(th2), ax.Y(cc)); ctx.lineTo(ax.X(0), ax.Y(cc)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = n === 1 ? '#ffd166' : 'rgba(255,209,102,.6)'; ctx.beginPath(); ctx.arc(ax.X(th2), ax.Y(cc), 3.5, 0, TAU); ctx.fill();
      });
      // curva completa (tenue) y tramo recorrido (brillante)
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,212,255,.35)'; ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const t = (TMAX_C * i) / 120, y = p.c0 * Math.exp(-p.k * t); i ? ctx.lineTo(ax.X(t), ax.Y(y)) : ctx.moveTo(ax.X(t), ax.Y(y)); }
      ctx.stroke();
      ctx.lineWidth = 3.2; ctx.strokeStyle = '#00d4ff'; ctx.beginPath();
      const n = Math.max(2, Math.round(120 * tv / TMAX_C));
      for (let i = 0; i <= n; i++) { const t = (tv * i) / n, y = p.c0 * Math.exp(-p.k * t); i ? ctx.lineTo(ax.X(t), ax.Y(y)) : ctx.moveTo(ax.X(t), ax.Y(y)); }
      ctx.stroke();
      // tangente en el instante t: pendiente −k·c  (v = −dc/dt); corta el eje c=0 en t + 1/k
      const X0 = ax.X(tv), Y0 = ax.Y(c), sx = (gw / TMAX_C), sy = (gh / CMAX_C), m = (p.k * c * sy) / sx; // en pantalla y crece hacia abajo
      ctx.strokeStyle = '#ff9f1c'; ctx.lineWidth = 2; ctx.beginPath();
      const dx0 = -Math.min(60, X0 - gx + 30), dx1 = Math.min(1 / p.k, TMAX_C - tv + 1) * sx;
      ctx.moveTo(X0 + dx0, Y0 + m * dx0); ctx.lineTo(X0 + dx1, Y0 + m * dx1); ctx.stroke();
      ctx.restore();
      brillo(ctx, X0, Y0, 18, '#ffd166', 0.75); bola(ctx, X0, Y0, 6, '#ffd166');
      // etiquetas
      const lx = clamp(X0 + 12, gx + 4, gx + gw - 150);
      txt(ctx, 'v = k·c = ' + num(v, 3) + ' mol·L⁻¹·s⁻¹', lx, clamp(Y0 - 12, gy + fs + 2, gy + gh - 8), fs - 1, '#ff9f1c', 'left', 700);
      if (thalf <= TMAX_C) txt(ctx, 't½ = ' + num(thalf, 1) + ' s', clamp(ax.X(thalf), gx + 30, gx + gw - 30), gy + gh - 8, fs, '#ffd166', 'center', 700);
      txt(ctx, 'c = ' + num(c, 2), gx + gw - 6, gy + gh * 0.46, fs, '#00d4ff', 'right', 700);
      txt(ctx, 't = ' + num(tv, 1) + ' s', gx + gw - 6, gy + gh * 0.46 + fs + 3, fs, '#eaf0ff', 'right', 700);
      // botón de reproducción
      if (!s.play) boton(ctx, s, gx + gw - (peq ? 100 : 140), 4, peq ? 100 : 140, 24, '▶ Reproducir t', () => { s.tv = 0; s.play = p.t > 0; }, '#2ee59d', fs - 1);
      else boton(ctx, s, gx + gw - (peq ? 100 : 140), 4, peq ? 100 : 140, 24, '⏹ Parar', () => { s.play = false; s.tv = p.t; }, '#ffd166', fs - 1);
    },
    formula(p) {
      const c = p.c0 * Math.exp(-p.k * p.t), v = p.k * c, th = Math.LN2 / p.k, UC = '\\text{mol}\\cdot\\text{L}^{-1}', UV = UC + '\\cdot\\text{s}^{-1}';
      if (window.innerWidth < 640) { // pantalla estrecha: líneas cortas
        return `\\begin{gathered}c(t)=c_0\\,e^{-kt}=${tx(c)}\\ ${UC}\\\\ v=kc=${tx(v, 3)}\\ ${UV}\\\\ t_{1/2}=\\dfrac{\\ln 2}{k}=${tx(th, 2)}\\ \\text{s}\\end{gathered}`;
      }
      return `\\begin{gathered}c(t)=c_0\\,e^{-kt}=${tx(p.c0)}\\,e^{-${tx(p.k)}\\times${tx(p.t, 1)}}=${tx(c)}\\ ${UC}\\\\[2pt] v=-\\dfrac{\\mathrm{d}c}{\\mathrm{d}t}=kc=${tx(v, 3)}\\ ${UV}\\qquad t_{1/2}=\\dfrac{\\ln 2}{k}=${tx(th, 2)}\\ \\text{s}\\end{gathered}`;
    },
    lecturas(p) {
      const c = p.c0 * Math.exp(-p.k * p.t);
      return [{ label: 'c(t)', valor: num(c, 3) + ' mol·L⁻¹' }, { label: 'v', valor: num(p.k * c, 3) + ' mol·L⁻¹·s⁻¹' }, { label: 't½', valor: num(Math.LN2 / p.k, 2) + ' s' }, { label: 'c/c₀', valor: num((100 * c) / p.c0, 0) + ' %' }];
    },
    dispose(s) { if (s._offClics) s._offClics(); },
  });

  // =====================================================================================
  // 5. PILA — pila Daniell genérica:  (−) Zn | Zn²⁺ ‖ Cu²⁺ | Cu (+)
  //   Ánodo (−): oxydation  Zn → Zn²⁺ + 2 e⁻      Cátodo (+): réduction  Cu²⁺ + 2 e⁻ → Cu
  //   Los electrones circulan por el circuito externo del ánodo al cátodo; la corriente convencional I va al revés.
  //   En el puente salino los aniones migran hacia el ánodo y los cationes hacia el cátodo (neutralidad eléctrica).
  // Simplificación: E(t) = E·(1 − (t/100)³) con t el avance en %: la f.é.m. cae a 0 al agotarse la pila (Qr → K).
  // =====================================================================================
  const COL_ZN = '#b9c3dc', COL_CU = '#e08a3c', COL_CU2 = '#2f9dff', COL_ZN2 = '#c6a6ff', COL_E = '#ffe27a';
  const Epila = (p) => p.E * (1 - Math.pow(clamp(p.t, 0, 100) / 100, 3));

  /** Geometría de la escena (todo en función de w,h) */
  function layPila(w, h) {
    const yW = h * 0.14, bT = h * 0.42, bB = h * 0.84, bw = w * 0.31;
    const L = { w, h, yW, bT, bB, bw, bx: [w * 0.06, w * 0.63], liq: h * 0.52, xz: w * 0.14, xc: w * 0.86, yTop: h * 0.3, yPlateB: h * 0.78, yBr: h * 0.31, brX: [w * 0.29, w * 0.71] };
    L.bulb = { x: w * 0.5, y: yW, r: clamp(Math.min(w, h) * 0.065, 11, 26) };
    L.amp = { x: w * 0.31, y: yW, r: clamp(Math.min(w, h) * 0.04, 8, 15) };
    // camino de los electrones: placa Zn ↑ cable → lámpara → cable ↓ placa Cu
    L.cam = [[L.xz, L.yTop], [L.xz, yW], [L.bulb.x, yW], [L.xc, yW], [L.xc, L.yTop]];
    // camino del puente salino: brazo izquierdo ↑, tramo horizontal →, brazo derecho ↓
    L.puente = [[L.brX[0], L.liq + h * 0.1], [L.brX[0], L.yBr], [L.brX[1], L.yBr], [L.brX[1], L.liq + h * 0.1]];
    return L;
  }
  /** Punto a fracción f (0..1) de la longitud total de una polilínea */
  function enCamino(cam, f) {
    let tot = 0; const ls = [];
    for (let i = 1; i < cam.length; i++) { const l = Math.hypot(cam[i][0] - cam[i - 1][0], cam[i][1] - cam[i - 1][1]); ls.push(l); tot += l; }
    let d = frac(f) * tot;
    for (let i = 0; i < ls.length; i++) { if (d <= ls[i]) { const k = d / ls[i]; return [lerp(cam[i][0], cam[i + 1][0], k), lerp(cam[i][1], cam[i + 1][1], k)]; } d -= ls[i]; }
    return cam[cam.length - 1];
  }

  PCB.anim.register('pila', {
    titulo: 'Pile électrochimique', materia: 'chimie',
    params: [
      { id: 'E', label: 'Force électromotrice E', min: 0.3, max: 2, step: 0.01, def: 1.1, unit: 'V' },
      { id: 't', label: 'Avance de la réaction', min: 0, max: 100, step: 1, def: 30, unit: '%' },
    ],
    create(host, p) {
      const rng = host.rng, red = host.reduced, mk = (n) => Array.from({ length: n }, () => ({ u: rng(), v: rng(), vis: 0, a: rng() * TAU }));
      return { t: 0, rng, red, flow: 0, brig: 0, zn: mk(red ? 22 : 36), cu: mk(red ? 22 : 36), kp: [], an: [], L: layPila(host.w, host.h), eNo: 0 };
    },
    step(s, dt, p) {
      const L = s.L, rng = s.rng, Et = Epila(p), irel = clamp(Et / 1.1, 0, 1.8); // corriente relativa ∝ f.é.m. actual
      s.t += dt; s.flow = frac(s.flow + dt * 0.2 * irel); s.irel = irel;
      s.brig = suav(s.brig, clamp(Et / 1.4, 0, 1), 4, dt);
      const prog = clamp(p.t / 100, 0, 1);
      // Zn²⁺: nº ∝ avance; nacen en la placa y se alejan. Cu²⁺: nº ∝ (1−avance); migran hacia la placa de Cu y se depositan
      const nZ = Math.round((s.red ? 4 : 6) + (s.zn.length - 8) * prog), nC = Math.round(2 + (s.cu.length - 2) * (1 - prog));
      s.zn.forEach((q, i) => {
        q.vis = suav(q.vis, i < nZ ? 1 : 0, 4, dt);
        q.u += dt * (0.05 + 0.05 * irel) + (rng() - 0.5) * dt * 0.5; q.v += (rng() - 0.5) * dt * 0.8;
        if (q.u > 0.95) { q.u = 0.26 + rng() * 0.06; q.v = 0.2 + rng() * 0.7; q.vis *= 0.2; }  // se recicla junto al electrodo (flujo continuo de salida)
        q.v = clamp(q.v, 0.04, 0.96); q.u = Math.max(0.1, q.u);
      });
      s.cu.forEach((q, i) => {
        q.vis = suav(q.vis, i < nC ? 1 : 0, 4, dt);
        q.u += dt * (0.05 + 0.08 * irel) + (rng() - 0.5) * dt * 0.5; q.v += (rng() - 0.5) * dt * 0.8;
        if (q.u > 0.76) { s.an.push({ x: q.u, y: q.v, t: 0 }); q.u = 0.05 + rng() * 0.15; q.v = rng(); q.vis *= 0.2; } // se deposita: destello en la placa
        q.v = clamp(q.v, 0.04, 0.96); q.u = Math.max(0.02, q.u);
      });
      for (let i = s.an.length - 1; i >= 0; i--) { s.an[i].t += dt; if (s.an[i].t > 0.5) s.an.splice(i, 1); }
    },
    draw(s, ctx, w, h, p) {
      const L = (s.L = layPila(w, h)), fs = FS(w, h), Et = Epila(p), prog = clamp(p.t / 100, 0, 1), irel = s.irel || 0;
      fondo(ctx, w, h);
      // ---------- vasos (Zn²⁺ incoloro a la izquierda, Cu²⁺ azul a la derecha que se decolora con el avance)
      const rI = vaso(ctx, L.bx[0], L.bT, L.bw, L.bB - L.bT, (L.bB - L.liq) / (L.bB - L.bT), '#cfe6ff', 0.1);
      const rD = vaso(ctx, L.bx[1], L.bT, L.bw, L.bB - L.bT, (L.bB - L.liq) / (L.bB - L.bT), COL_CU2, 0.1 + 0.3 * (1 - prog * 0.85));
      // ---------- placas
      const pw0 = clamp(w * 0.03, 8, 22), pZ = pw0 * (1 - 0.5 * prog), pC = pw0 * (0.7 + 0.9 * prog), y0 = L.yTop, y1 = L.yPlateB;
      const placa = (cx, ww, c1, c2) => { const g = ctx.createLinearGradient(cx - ww / 2, 0, cx + ww / 2, 0); g.addColorStop(0, c1); g.addColorStop(0.5, c2); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(cx - ww / 2, y0, ww, y1 - y0); };
      placa(L.xz, pZ, '#6c7694', COL_ZN);
      placa(L.xc, pC, '#9a5420', COL_CU);
      // erosión del Zn / depósito de Cu: pequeños dentados a los lados de la zona sumergida
      ctx.fillStyle = 'rgba(10,15,32,.8)';
      for (let y = L.liq; y < y1; y += 7) { const k = prog * 2.2 * (0.6 + 0.4 * Math.sin(y * 1.7)); if (k > 0.2) ctx.fillRect(L.xz - pZ / 2 - 0.5, y, Math.min(k, 3), 3.2), ctx.fillRect(L.xz + pZ / 2 - Math.min(k, 3) + 0.5, y + 3, Math.min(k, 3), 3.2); }
      ctx.fillStyle = COL_CU;
      for (let y = L.liq; y < y1; y += 6) { const k = prog * 2.4 * (0.6 + 0.4 * Math.sin(y * 2.3)); if (k > 0.2) ctx.fillRect(L.xc - pC / 2 - k, y, k, 3), ctx.fillRect(L.xc + pC / 2, y + 3, k, 3); }
      txt(ctx, 'Zn', L.xz, y1 + fs + 2, fs, COL_ZN, 'center', 700);
      txt(ctx, 'Cu', L.xc, y1 + fs + 2, fs, COL_CU, 'center', 700);
      // ---------- iones en los vasos
      const rad = clamp(w * 0.0085, 2.8, 5.2);
      for (const q of s.zn) if (q.vis > 0.02) { const x = rI.x0 + q.u * (rI.x1 - rI.x0), y = rI.y0 + q.v * (rI.y1 - rI.y0); bola(ctx, x, y, rad, COL_ZN2, q.vis); }
      for (const q of s.cu) if (q.vis > 0.02) { const x = rD.x0 + q.u * (rD.x1 - rD.x0), y = rD.y0 + q.v * (rD.y1 - rD.y0); bola(ctx, x, y, rad, '#5fb6ff', q.vis); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const g of s.an) { const x = rD.x0 + g.x * (rD.x1 - rD.x0), y = rD.y0 + g.y * (rD.y1 - rD.y0), k = g.t / 0.5; ctx.strokeStyle = `rgba(255,170,90,${1 - k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 2 + k * 9, 0, TAU); ctx.stroke(); }
      ctx.restore();
      // ---------- puente salino (gel) con iones que migran
      const P = L.puente, bwid = clamp(h * 0.035, 7, 14);
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
      ctx.beginPath(); P.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.strokeStyle = 'rgba(190,215,255,.55)'; ctx.lineWidth = bwid + 4; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,200,.28)'; ctx.lineWidth = bwid; ctx.stroke(); ctx.restore();
      const nI = s.red ? 5 : 7;
      for (let i = 0; i < nI; i++) { // cationes (K⁺) hacia el cátodo (→), aniones (NO₃⁻) hacia el ánodo (←)
        const [x1, y1b] = enCamino(P, i / nI + s.flow * 0.9), [x2, y2] = enCamino(P, 1 - frac(i / nI + 0.5 / nI + s.flow * 0.9));
        bola(ctx, x1, y1b - 1.5, bwid * 0.3, '#ff9ccf'); bola(ctx, x2, y2 + 1.5, bwid * 0.3, '#7fe3ff');
      }
      txt(ctx, 'pont salin', w * 0.5, L.yBr - bwid / 2 - 6, fs - 1, '#c9d6f5', 'center', 600);
      if (w > 480) { txt(ctx, 'K⁺ →', w * 0.5 - 6, L.yBr + bwid + fs + 2, fs - 2, '#ff9ccf', 'right', 700); txt(ctx, '← anions', w * 0.5 + 6, L.yBr + bwid + fs + 2, fs - 2, '#7fe3ff', 'left', 700); }
      // ---------- circuito externo: cables, lámpara, amperímetro
      ctx.strokeStyle = '#7f8fb8'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath();
      L.cam.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke();
      // lámpara
      const B = L.bulb, br = s.brig;
      brillo(ctx, B.x, B.y, B.r * (2.4 + 2 * br), '#ffe27a', 0.1 + 0.8 * br);
      ctx.beginPath(); ctx.arc(B.x, B.y, B.r, 0, TAU); ctx.fillStyle = `rgba(255,${200 + 40 * br | 0},${100 + 100 * br | 0},${0.25 + 0.6 * br})`; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = br > 0.05 ? '#fff3c4' : '#8a93ad'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(B.x - B.r * 0.5, B.y + B.r * 0.55); ctx.lineTo(B.x - B.r * 0.25, B.y - B.r * 0.1); ctx.lineTo(B.x, B.y + B.r * 0.2); ctx.lineTo(B.x + B.r * 0.25, B.y - B.r * 0.1); ctx.lineTo(B.x + B.r * 0.5, B.y + B.r * 0.55); ctx.stroke();
      // amperímetro
      const Am = L.amp; ctx.beginPath(); ctx.arc(Am.x, Am.y, Am.r, 0, TAU); ctx.fillStyle = '#0d1530'; ctx.fill(); ctx.strokeStyle = '#c9d6f5'; ctx.lineWidth = 1.6; ctx.stroke();
      txt(ctx, 'A', Am.x, Am.y + Am.r * 0.38, Am.r * 1.1, '#eaf0ff', 'center', 700);
      // electrones (ánodo → lámpara → cátodo)
      const nE = s.red ? 14 : 22;
      for (let i = 0; i < nE; i++) {
        const [x, y] = enCamino(L.cam, i / nE + s.flow);
        if (Math.hypot(x - B.x, y - B.y) < B.r * 0.95 || Math.hypot(x - Am.x, y - Am.y) < Am.r) continue; // pasan "por dentro"
        brillo(ctx, x, y, 8, COL_E, 0.55 * clamp(irel, 0.2, 1)); bola(ctx, x, y, 3, COL_E);
      }
      if (irel > 0.02) { // sentido de e⁻ y de la corriente convencional I
        const ya = L.yW - Math.max(L.bulb.r, 12) - 6;
        flecha(ctx, w * 0.36, ya, w * 0.44, ya, COL_E, 2, 6); txt(ctx, 'e⁻', w * 0.4, ya - 4, fs - 1, COL_E, 'center', 700);
        flecha(ctx, w * 0.64, ya, w * 0.56, ya, '#ff8fa3', 2, 6); txt(ctx, 'I', w * 0.6, ya - 4, fs - 1, '#ff8fa3', 'center', 700);
      }
      // ---------- polos y etiquetas
      const polo = (x, signo, col) => { ctx.beginPath(); ctx.arc(x, L.yTop - 11, 9, 0, TAU); ctx.fillStyle = rgba(col, 0.2); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke(); txt(ctx, signo, x, L.yTop - 11 + 5, 15, col, 'center', 700); };
      polo(L.xz, '−', '#ff8fa3'); polo(L.xc, '+', '#7fe3ff');
      const cxI = L.bx[0] + L.bw / 2, cxD = L.bx[1] + L.bw / 2, yl = L.bB + fs * 2.4;
      txt(ctx, 'ANODE (−) · oxydation', cxI, yl, fs, '#ff8fa3', 'center', 700);
      txt(ctx, 'Zn → Zn²⁺ + 2 e⁻', cxI, yl + fs + 3, fs - 1, '#c9d6f5', 'center', 400);
      txt(ctx, 'CATHODE (+) · réduction', cxD, yl, fs, '#7fe3ff', 'center', 700);
      txt(ctx, 'Cu²⁺ + 2 e⁻ → Cu', cxD, yl + fs + 3, fs - 1, '#c9d6f5', 'center', 400);
      // lectura de E
      txt(ctx, 'E = ' + num(Et, 2) + ' V', w * 0.5, L.yBr + bwid * 0.5 + fs * 2.6 + (w > 480 ? fs + 4 : 0), fs + 2, '#ffd166', 'center', 700);
      txt(ctx, 'avance ' + num(p.t, 0) + ' %', w * 0.5, L.bB - 4, fs - 1, '#9fb0d9', 'center', 400);
    },
    formula(p) {
      const Et = Epila(p);
      return `\\begin{gathered}\\text{Zn}_{(s)}+\\text{Cu}^{2+}_{(aq)}\\rightarrow\\text{Zn}^{2+}_{(aq)}+\\text{Cu}_{(s)}\\\\[2pt] E=${tx(Et, 2)}\\ \\text{V}\\qquad \\xi\\ \\text{(avance)}=${tx(p.t, 0)}\\ \\%\\end{gathered}`;
    },
    lecturas(p) {
      return [{ label: 'E (f.é.m.)', valor: num(Epila(p), 2) + ' V' }, { label: 'avance', valor: num(p.t, 0) + ' %' }, { label: 'e⁻', valor: 'ánodo (−) → cátodo (+)' }, { label: 'I', valor: 'cátodo (+) → ánodo (−)' }];
    },
  });

  // =====================================================================================
  // 6. RADIOACTIVIDAD — N(t) = N0·e^(−λt),  t½ = ln2/λ,  actividad A = λ·N
  // Cada núcleo tiene un umbral u_i (baja discrepancia, posiciones en la rejilla mezcladas) y se desintegra en
  // t_i = −ln(u_i)/λ; así el nº de núcleos sin desintegrar coincide con la fórmula (decaimiento estratificado,
  // sin el ruido estadístico de una muestra pequeña). El botón ▶ reproduce el tiempo de 0 al valor de t.
  // =====================================================================================
  const COL_PADRE = '#ff3da6', COL_HIJO = '#4a6a9c', TMAX_R = 40;
  PCB.anim.register('radioactividad', {
    titulo: 'Décroissance radioactive', materia: 'chimie',
    params: [
      { id: 'N0', label: 'Noyaux initiaux N₀', min: 20, max: 300, step: 10, def: 150, unit: '' },
      { id: 'lam', label: 'Constante radioactive λ', min: 0.02, max: 0.5, step: 0.01, def: 0.1, unit: 's⁻¹' },
      { id: 't', label: 'Temps t', min: 0, max: TMAX_R, step: 0.5, def: 10, unit: 's' },
    ],
    create(host, p) {
      const rng = host.rng, M = host.reduced ? 220 : 300;
      const perm = Array.from({ length: M }, (_, i) => i);
      for (let i = M - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
      const sv0 = Math.exp(-p.lam * p.t); // estado inicial coherente con el slider: sin ráfaga de destellos al abrir
      const nu = perm.map((cell, i) => ({ cell, th: baja(i), vis: 0, dec: baja(i) > sv0, fl: 0 }));
      const s = { t: 0, rng, nu, tv: p.t, play: false, part: [], red: host.reduced, M };
      clics(s, host); return s;
    },
    onParam(s, id) { if (id === 't') s.play = false; },
    step(s, dt, p) {
      s.t += dt; tiempoPaso(s, dt, p, TMAX_R, 9);
      const N0 = Math.min(p.N0, s.M), surv = Math.exp(-p.lam * s.tv), rng = s.rng;
      s.nu.forEach((n, i) => {
        n.vis = suav(n.vis, i < N0 ? 1 : 0, 6, dt);
        const dec = n.th > surv;                      // ya se desintegró (e^(−λt) < u_i)
        if (dec !== n.dec) {
          n.dec = dec; n.fl = 1;
          if (dec && i < N0 && s.part.length < 80) { const a = rng() * TAU; s.part.push({ i, a, d: 0, t: 0 }); } // partícula emitida
        }
        n.fl = Math.max(0, n.fl - dt * 2.4);
      });
      for (let i = s.part.length - 1; i >= 0; i--) { const q = s.part[i]; q.t += dt; q.d += dt * 60; if (q.t > 0.9) s.part.splice(i, 1); }
    },
    draw(s, ctx, w, h, p) {
      const fs = FS(w, h), peq = w < 520, tv = s.tv, N0 = Math.min(p.N0, s.M), thalf = Math.LN2 / p.lam;
      s.btns.length = 0; fondo(ctx, w, h);
      // ---------- rejilla de núcleos (izquierda)
      const gx0 = w * 0.04, gy0 = h * 0.16, gW = w * (peq ? 0.38 : 0.4), gH = h * 0.66;
      panel(ctx, gx0 - 4, gy0 - 4, gW + 8, gH + 8, 10);
      const cols = Math.max(1, Math.ceil(Math.sqrt((N0 * gW) / gH))), rows = Math.ceil(N0 / cols), cell = Math.min(gW / cols, gH / rows);
      const ox = gx0 + (gW - cell * cols) / 2, oy = gy0 + (gH - cell * rows) / 2, rn = cell * 0.36;
      const cen = (cellIdx) => { const k = cellIdx % (cols * Math.max(rows, 1)); return [ox + ((k % cols) + 0.5) * cell, oy + (Math.floor(k / cols) + 0.5) * cell]; };
      // el índice de celda se re-compacta a las N0 casillas visibles según el orden de las celdas permutadas
      if (s._n0 !== N0) { const orden = s.nu.slice(0, N0).map((n, i) => [n.cell, i]).sort((a, b) => a[0] - b[0]); orden.forEach(([, i], rank) => (s.nu[i].slot = rank)); s._n0 = N0; }
      let vivos = 0;
      for (let i = 0; i < N0; i++) {
        const n = s.nu[i]; if (!n.dec) vivos++;
        if (n.vis < 0.02) continue;
        const [x, y] = cen(n.slot);
        if (n.fl > 0) brillo(ctx, x, y, rn * 5, n.dec ? '#fff2a8' : '#ffffff', n.fl * 0.85);
        if (n.dec) bola(ctx, x, y, rn * 0.62, '#5b7db3', n.vis); else { brillo(ctx, x, y, rn * 2.2, COL_PADRE, 0.22 * n.vis); bola(ctx, x, y, rn, COL_PADRE, n.vis); }
      }
      // partículas emitidas (α/β didácticas): salen del núcleo y se desvanecen
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const q of s.part) { const n = s.nu[q.i]; if (n.slot == null) continue; const [x, y] = cen(n.slot), k = q.t / 0.9; brillo(ctx, x + Math.cos(q.a) * q.d, y + Math.sin(q.a) * q.d, 7, '#ffe27a', 1 - k); }
      ctx.restore();
      txt(ctx, 'N(t) = ' + vivos, gx0, h * 0.1, fs + 4, COL_PADRE, 'left', 700);
      txt(ctx, 't = ' + num(tv, 1) + ' s', gx0 + gW, h * 0.1, fs + 1, '#eaf0ff', 'right', 700);
      const ly = gy0 + gH + fs + 10;
      bola(ctx, gx0 + 4, ly - fs * 0.35, 4.5, COL_PADRE); txt(ctx, 'noyau père', gx0 + 12, ly, fs - 1, '#c9d6f5', 'left', 400);
      bola(ctx, gx0 + gW * 0.52, ly - fs * 0.35, 3.5, '#5b7db3'); txt(ctx, 'noyau fils', gx0 + gW * 0.52 + 8, ly, fs - 1, '#c9d6f5', 'left', 400);
      // ---------- gráfica N(t)
      const gx = w * (peq ? 0.5 : 0.53), gw = w * (peq ? 0.46 : 0.43), gy = h * 0.16, gh = h * 0.62;
      const ax = ejes(ctx, gx, gy, gw, gh, { x0: 0, x1: TMAX_R, y0: 0, y1: p.N0, xt: [0, 10, 20, 30, 40], yt: [0, p.N0 / 2, p.N0], fs: fs - 1, xl: 't (s)', yl: 'N', fx: (z) => num(z, 0), fy: (z) => num(z, 0) });
      ctx.save(); ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
      [1, 2, 3].forEach((k) => { // marcas t½, 2t½, 3t½ con N0/2, N0/4, N0/8
        const tk = k * thalf; if (tk > TMAX_R) return; const nk = p.N0 / Math.pow(2, k);
        ctx.setLineDash([5, 4]); ctx.strokeStyle = `rgba(255,209,102,${k === 1 ? 0.85 : 0.5})`; ctx.lineWidth = 1.2; ctx.beginPath();
        ctx.moveTo(ax.X(tk), ax.Y(0)); ctx.lineTo(ax.X(tk), ax.Y(nk)); ctx.lineTo(ax.X(0), ax.Y(nk)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(ax.X(tk), ax.Y(nk), 3.4, 0, TAU); ctx.fill();
      });
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,212,255,.35)'; ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const t = (TMAX_R * i) / 120, y = p.N0 * Math.exp(-p.lam * t); i ? ctx.lineTo(ax.X(t), ax.Y(y)) : ctx.moveTo(ax.X(t), ax.Y(y)); }
      ctx.stroke();
      ctx.lineWidth = 3.2; ctx.strokeStyle = '#00d4ff'; ctx.beginPath(); const nn = Math.max(2, Math.round((120 * tv) / TMAX_R));
      for (let i = 0; i <= nn; i++) { const t = (tv * i) / nn, y = p.N0 * Math.exp(-p.lam * t); i ? ctx.lineTo(ax.X(t), ax.Y(y)) : ctx.moveTo(ax.X(t), ax.Y(y)); }
      ctx.stroke(); ctx.restore();
      const Nt = p.N0 * Math.exp(-p.lam * tv);
      brillo(ctx, ax.X(tv), ax.Y(Nt), 18, '#ffd166', 0.75); bola(ctx, ax.X(tv), ax.Y(Nt), 6, '#ffd166');
      [1, 2, 3].forEach((k) => { const tk = k * thalf; if (tk <= TMAX_R && (k === 1 || !peq)) txt(ctx, k === 1 ? 't½' : k + 't½', ax.X(tk), gy + gh - 5, fs - 1, '#ffd166', 'center', 700); });
      txt(ctx, 't½ = ' + num(thalf, 1) + ' s', gx + gw - 6, gy + fs + 4, fs, '#ffd166', 'right', 700);
      txt(ctx, 'A = λN = ' + num(p.lam * Nt, 1) + ' Bq', gx + gw - 6, gy + 2 * fs + 8, fs - 1, '#ff9f1c', 'right', 700);
      if (!s.play) boton(ctx, s, gx + gw - (peq ? 100 : 140), h - 30, peq ? 100 : 140, 24, '▶ Reproducir t', () => { s.tv = 0; s.play = p.t > 0; }, '#2ee59d', fs - 1);
      else boton(ctx, s, gx + gw - (peq ? 100 : 140), h - 30, peq ? 100 : 140, 24, '⏹ Parar', () => { s.play = false; s.tv = p.t; }, '#ffd166', fs - 1);
    },
    formula(p) {
      const Nt = p.N0 * Math.exp(-p.lam * p.t), th = Math.LN2 / p.lam;
      if (window.innerWidth < 640) return `\\begin{gathered}N(t)=N_0\\,e^{-\\lambda t}=${tx(Nt, 0)}\\\\ t_{1/2}=\\dfrac{\\ln 2}{\\lambda}=${tx(th, 2)}\\ \\text{s}\\end{gathered}`;
      return `\\begin{gathered}N(t)=N_0\\,e^{-\\lambda t}=${tx(p.N0, 0)}\\,e^{-${tx(p.lam)}\\times${tx(p.t, 1)}}=${tx(Nt, 0)}\\ \\text{noyaux}\\\\[2pt] t_{1/2}=\\dfrac{\\ln 2}{\\lambda}=\\dfrac{0{,}693}{${tx(p.lam)}}=${tx(th, 2)}\\ \\text{s}\\end{gathered}`;
    },
    lecturas(p) {
      const Nt = p.N0 * Math.exp(-p.lam * p.t);
      return [{ label: 'N(t)', valor: num(Nt, 0) + ' noyaux' }, { label: 't½', valor: num(Math.LN2 / p.lam, 2) + ' s' }, { label: 'N/N₀', valor: num((100 * Nt) / p.N0, 0) + ' %' }, { label: 'A = λN', valor: num(p.lam * Nt, 1) + ' Bq' }];
    },
    dispose(s) { if (s._offClics) s._offClics(); },
  });

  // =====================================================================================
  // 7. GAS-IDEAL-QUIMICO — ley del gas ideal:  P·V = n·R·T  →  V = n·R·T / P
  //   R = 8,314 J·K⁻¹·mol⁻¹ (constante del cours). Unidades SI en el cálculo: P en Pa (kPa·10³), V en m³ (1 m³ = 1000 L).
  // Simplificación visual: el nº de partículas dibujadas es ∝ n (≈ 55 por mol) y su velocidad ∝ √T (v_rms ∝ √(T/M));
  // la altura del pistón usa una escala NO lineal (∝ √V) para que se vea tanto 0,5 L como 250 L; la regla lateral
  // marca los volúmenes reales. El pistón soporta la presión exterior P (flechas hacia abajo).
  // =====================================================================================
  const R_GAS = 8.314, V_REF = 250;
  const Vgas = (p) => (p.n * R_GAS * p.T) / (p.P * 1000) * 1000; // en litros
  const hFrac = (V) => 0.08 + 0.92 * Math.sqrt(clamp(V, 0, V_REF) / V_REF);

  PCB.anim.register('gas-ideal-quimico', {
    titulo: 'Gaz parfait : V = nRT/P', materia: 'chimie',
    params: [
      { id: 'n', label: 'Quantité de gaz n', min: 0.1, max: 3, step: 0.1, def: 1, unit: 'mol' },
      { id: 'T', label: 'Température T', min: 200, max: 500, step: 5, def: 300, unit: 'K' },
      { id: 'P', label: 'Pression P', min: 50, max: 300, step: 5, def: 100, unit: 'kPa' },
    ],
    create(host, p) {
      const rng = host.rng, M = host.reduced ? 100 : 180;
      const q = Array.from({ length: M }, () => ({ x: rng(), y: rng(), a: rng() * TAU, f: 0.55 + (rng() + rng() + rng()) / 3 * 0.9, vis: 0 }));
      return { t: 0, rng, q, M, H: hFrac(Vgas(p)), vp: 0, red: host.reduced };
    },
    step(s, dt, p) {
      s.t += dt;
      const Hobj = hFrac(Vgas(p)), Hn = suav(s.H, Hobj, 4, dt); s.vp = (Hn - s.H) / Math.max(dt, 1e-3); s.H = Hn; // vp: velocidad del pistón (fracción/s)
      const nObj = Math.round(p.n * (s.red ? 30 : 55)), vT = Math.sqrt(p.T / 300);
      s.q.forEach((q, i) => {
        q.vis = suav(q.vis, i < nObj ? 1 : 0, 5, dt);
        const v = 0.55 * q.f * vT; // en fracciones del ancho/s
        q.x += Math.cos(q.a) * v * dt; q.y += Math.sin(q.a) * v * dt * 0.8;
        if (q.x < 0.03) { q.x = 0.03; q.a = Math.PI - q.a; } else if (q.x > 0.97) { q.x = 0.97; q.a = Math.PI - q.a; }
        if (q.y > 0.97) { q.y = 0.97; q.a = -q.a; }                                           // suelo
        if (q.y < 0.03) { q.y = 0.03; q.a = -q.a; if (s.vp < 0) q.a = Math.atan2(Math.abs(Math.sin(q.a)) + 0.4, Math.cos(q.a)); } // pistón (empuja si baja)
      });
    },
    draw(s, ctx, w, h, p) {
      const fs = FS(w, h), peq = w < 520, V = Vgas(p);
      fondo(ctx, w, h);
      // ---------- cilindro con pistón (izquierda)
      const cw = Math.min(w * (peq ? 0.34 : 0.3), h * 0.55), cx = w * (peq ? 0.12 : 0.1), yB = h * 0.9, Hmax = h * 0.7;
      const Hc = Hmax * s.H, yP = yB - Hc;
      // calor bajo el cilindro ∝ (T − 200)
      const calor = clamp((p.T - 200) / 300, 0, 1);
      brillo(ctx, cx + cw / 2, yB + 4, cw * 0.9, mezcla('#ff9f1c', '#ff3d3d', calor), 0.15 + 0.5 * calor);
      // paredes de vidrio
      const gg = ctx.createLinearGradient(cx, 0, cx + cw, 0); gg.addColorStop(0, 'rgba(255,255,255,.14)'); gg.addColorStop(0.2, 'rgba(255,255,255,.03)'); gg.addColorStop(1, 'rgba(255,255,255,.07)');
      ctx.fillStyle = gg; ctx.fillRect(cx, yP, cw, Hc);
      ctx.strokeStyle = 'rgba(200,225,255,.65)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(cx, h * 0.18); ctx.lineTo(cx, yB); ctx.lineTo(cx + cw, yB); ctx.lineTo(cx + cw, h * 0.18); ctx.stroke();
      // regla de volúmenes reales (escala no lineal)
      [1, 5, 25, 50, 100, 250].forEach((v) => {
        const y = yB - Hmax * hFrac(v); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx + cw, y); ctx.lineTo(cx + cw + 6, y); ctx.stroke();
        if (!(peq && (v === 5))) txt(ctx, v + ' L', cx + cw + 9, y + fs * 0.35, fs - 2, '#7f8fb8', 'left', 400);
      });
      // partículas (color según su velocidad: azul frío → rojo caliente)
      const rp = clamp(cw * 0.026, 2.4, 4.4);
      for (const q of s.q) {
        if (q.vis < 0.02) continue;
        const x = cx + 4 + q.x * (cw - 8), y = yP + 4 + q.y * (Hc - 8), k = clamp((q.f * Math.sqrt(p.T / 300) - 0.4) / 1.6, 0, 1);
        bola(ctx, x, y, rp, mezcla('#4cc9f0', '#ff4d5e', k), q.vis);
      }
      // pistón (placa + vástago) y flechas de presión exterior
      const pg = ctx.createLinearGradient(0, yP - 9, 0, yP); pg.addColorStop(0, '#8d97b5'); pg.addColorStop(1, '#4b5575');
      rr(ctx, cx - 3, yP - 9, cw + 6, 9, 3); ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#6b7596'; ctx.fillRect(cx + cw / 2 - 3, h * 0.1, 6, yP - 9 - h * 0.1);
      const na = clamp(Math.ceil(p.P / 60), 1, 5), la = clamp(h * 0.07 + (p.P - 50) / 250 * h * 0.05, 14, h * 0.14);
      for (let i = 0; i < na; i++) {
        const ax = cx + cw * ((i + 0.5) / na); const ya = Math.max(h * 0.1, yP - 9 - la - 4);
        if (Math.abs(ax - (cx + cw / 2)) < 5) continue;
        flecha(ctx, ax, ya, ax, yP - 11, '#ffd166', 2.2, 6);
      }
      txt(ctx, 'P = ' + num(p.P, 0) + ' kPa', cx + cw / 2, h * 0.07, fs + 1, '#ffd166', 'center', 700);
      txt(ctx, 'T = ' + num(p.T, 0) + ' K', cx + cw / 2, yB + fs + 4, fs, rgbStr(mezcla('#7ad7ff', '#ff6b6b', calor)), 'center', 700);
      // ---------- panel de cálculo (derecha)
      const px = cx + cw + (peq ? 38 : 56), pw = w - px - w * 0.03, py = h * 0.08, ph = h * 0.84;
      panel(ctx, px, py, pw, ph, 12);
      const lh = clamp(ph / 9, fs + 6, 38);
      let y = py + lh * 0.8;
      const fila = (nm, val, col) => { txt(ctx, nm, px + 14, y, fs + 1, '#9fb0d9', 'left', 600); txt(ctx, val, px + pw - 14, y, fs + 2, col, 'right', 700); y += lh; };
      fila('n', num(p.n, 1) + ' mol', '#2ee59d');
      fila('T', num(p.T, 0) + ' K', '#ff9f9f');
      fila('P', num(p.P, 0) + ' kPa', '#ffd166');
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.moveTo(px + 12, y - lh * 0.45); ctx.lineTo(px + pw - 12, y - lh * 0.45); ctx.stroke();
      txt(ctx, 'V = n·R·T / P', px + pw / 2, y + lh * 0.1, fs + 2, '#c9d6f5', 'center', 600); y += lh * 1.15;
      const big = clamp(pw / 7, 16, 34);
      txt(ctx, (V >= 100 ? num(V, 0) : V >= 10 ? num(V, 1) : num(V, 2)) + ' L', px + pw / 2, y + big * 0.4, big, '#00d4ff', 'center', 700); y += big * 1.0 + lh * 0.2;
      txt(ctx, 'Vm = V/n = ' + num(V / p.n, 1) + ' L·mol⁻¹', px + pw / 2, y, fs, '#9fb0d9', 'center', 400); y += lh * 0.9;
      txt(ctx, 'R = 8,314 J·K⁻¹·mol⁻¹', px + pw / 2, y, fs, '#ff9f1c', 'center', 700);
      txt(ctx, '(constante du cours)', px + pw / 2, y + fs + 3, fs - 2, '#c9a56a', 'center', 400);
    },
    formula(p) {
      const V = Vgas(p), Vm3 = V / 1000;
      if (window.innerWidth < 640) return `\\begin{gathered}V=\\dfrac{nRT}{P}=${V >= 10 ? tx(V, 1) : tx(V, 2)}\\ \\text{L}\\\\ R=8{,}314\\ \\text{J}\\cdot\\text{K}^{-1}\\cdot\\text{mol}^{-1}\\end{gathered}`;
      return `\\begin{gathered}V=\\dfrac{nRT}{P}=\\dfrac{${tx(p.n, 1)}\\times8{,}314\\times${tx(p.T, 0)}}{${texSci(p.P * 1000, 1)}}=${texSci(Vm3, 2)}\\ \\text{m}^3=${V >= 10 ? tx(V, 1) : tx(V, 2)}\\ \\text{L}\\\\[2pt] R=8{,}314\\ \\text{J}\\cdot\\text{K}^{-1}\\cdot\\text{mol}^{-1}\\ \\text{(constante)}\\qquad P\\ \\text{en Pa},\\ V\\ \\text{en m}^3\\end{gathered}`;
    },
    lecturas(p) {
      const V = Vgas(p);
      return [{ label: 'V', valor: num(V, V >= 10 ? 1 : 2) + ' L' }, { label: 'V', valor: txtSci(V / 1000, 2) + ' m³' }, { label: 'Vm = V/n', valor: num(V / p.n, 1) + ' L·mol⁻¹' }, { label: 'R', valor: '8,314 J·K⁻¹·mol⁻¹' }];
    },
  });
})();
