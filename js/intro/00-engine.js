// =====================================================================================
// 00-engine.js — Pantalla 3: motor de escenas de introducción (CONTRATO §5 y §5b)
//
//  · PCB.intro.registerStyle(id, {init(ctx) -> {update(S,dt), resize(w,h), dispose()}})
//  · PCB.intro.estilos()                      ids de estilos registrados
//  · PCB.intro.play(host, guion, {onFin, estilo}) -> {dispose, pause, resume, replay, seek, saltar}
//  · PCB.intro.kit                            utilidades compartidas por los estilos (opcional usarlas)
//  · PCB.screens.intro = {mount(host,{capId,guion,onFin}), unmount()}
//
// El MOTOR: reloj (play/pausa/repetir/saltar/buscar), compila el guion a "pistas" (tracks) y
// en cada frame resuelve el estado de escena S. Dibuja él mismo el overlay DOM (subtítulo,
// fórmula KaTeX, contadores `valor`, barra de control y tarjeta final). Los ESTILOS sólo
// dibujan actores, vectores, trayectorias, partículas, bocadillos, fondo y cámara.
//
// Convenciones del estado S (extienden el CONTRATO §5b sin romperlo):
//   · x,y        coordenadas normalizadas 0..1 (x derecha, y abajo) = punto de anclaje del actor.
//   · rot        RADIANES (rotGrados trae lo mismo en grados). Se acumula con `gira`.
//   · dir        +1 / -1: hacia dónde "mira" el actor (último movimiento horizontal).
//   · vx, vy     velocidad en unidades normalizadas por segundo (0 si la escena está congelada).
//   · alpha      0..1 (ya incluye aparece/desaparece y el fundido de `reaccion`).
//   · def        el objeto original del actor en el guion (para campos propios del tipo:
//                texto, formula, elemento, liquido, nivel, carga, ...).
//   · S.reloj    tiempo continuo del motor (s) para animaciones "idle" (cola, burbujas…);
//                se detiene con la pausa del usuario pero NO con `pausa` del guion.
//   · S.reducido true si hay que reducir movimiento (sin vibraciones/shake, menos partículas).
//   · S.aspecto  w/h del escenario (16/9).
//   · S.valores  {id:{valor,etiqueta,unidad}} con los contadores `valor` actuales.
//   · Vectores: dx,dy en unidades normalizadas (como las posiciones); longitud máx. 0.45.
//   · Partículas: {tipo,x,y,t0,dur,n}; el estilo calcula la edad con S.t - t0.
//   · Reacciones: los actores `de` se desvanecen en progreso 0..0.15 y los `a` aparecen en
//     0.85..1; entre medias el estilo dibuja los átomos viajando de reactivos a productos.
// =====================================================================================
(function () {
  'use strict';
  const PCB = (window.PCB = window.PCB || {});
  const intro = (PCB.intro = PCB.intro || {});
  const estilos = {};

  // ---------------------------------------------------------------------------------
  // Registro de estilos
  // ---------------------------------------------------------------------------------
  intro.registerStyle = function (id, def) {
    if (!id || !def || typeof def.init !== 'function') { console.warn('[intro] estilo inválido:', id); return; }
    estilos[String(id)] = def;
  };
  intro.estilos = () => Object.keys(estilos);

  // ---------------------------------------------------------------------------------
  // KIT de utilidades (compartido por monigotes y minimalista; otros estilos pueden usarlo)
  // ---------------------------------------------------------------------------------
  const K = (intro.kit = {});
  K.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  K.lerp = (a, b, u) => a + (b - a) * u;
  K.smooth = (u) => { u = K.clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  K.num = (v, d) => {
    if (typeof v === 'string') v = parseFloat(v.replace(',', '.'));
    return typeof v === 'number' && isFinite(v) ? v : d;
  };
  /** hash de cadena -> uint32 */
  K.hash = (s) => { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  /** hash entero -> [0,1) (sin estado: la misma entrada da la misma salida) */
  K.hrand = (n) => { n = n | 0; n = Math.imul(n ^ (n >>> 16), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
  /** ruido de valor suave en [-1,1] */
  K.noise = (x, seed) => {
    const i = Math.floor(x), f = x - i, s = (seed | 0) * 7919;
    const a = K.hrand(i * 374761 + s) * 2 - 1, b = K.hrand((i + 1) * 374761 + s) * 2 - 1;
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };

  // --- easings ---
  const EASES = {
    linear: (u) => u,
    inquad: (u) => u * u, outquad: (u) => 1 - (1 - u) * (1 - u),
    inoutquad: (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
    incubic: (u) => u * u * u, outcubic: (u) => 1 - Math.pow(1 - u, 3),
    inoutcubic: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    insine: (u) => 1 - Math.cos((u * Math.PI) / 2), outsine: (u) => Math.sin((u * Math.PI) / 2),
    inoutsine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
    outback: (u) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
    elastic: (u) => (u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    bounce: (u) => { const n = 7.5625, d = 2.75; if (u < 1 / d) return n * u * u; if (u < 2 / d) return n * (u -= 1.5 / d) * u + 0.75; if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + 0.9375; return n * (u -= 2.625 / d) * u + 0.984375; },
  };
  const ALIAS = { in: 'inquad', out: 'outquad', inout: 'inoutquad', suave: 'inoutsine', smooth: 'inoutsine', quad: 'inoutquad', cubic: 'inoutcubic', sine: 'inoutsine', back: 'outback', rebote: 'bounce', elastico: 'elastic', lineal: 'linear', entrada: 'inquad', salida: 'outquad' };
  /** devuelve una función u∈[0,1] -> [0,1] a partir de un nombre ('linear','inOutQuad','out', …) */
  K.ease = (nombre, defecto) => {
    if (typeof nombre === 'function') return nombre;
    let k = String(nombre == null ? '' : nombre).toLowerCase().replace(/[^a-z]/g, '').replace(/^ease/, '');
    if (!k) return EASES[defecto || 'linear'];
    k = ALIAS[k] || k;
    return EASES[k] || EASES[defecto || 'linear'];
  };

  // --- color ---
  let _cc = null;
  /** parsea cualquier color CSS a [r,g,b] (0..255) */
  K.rgb = (c) => {
    if (Array.isArray(c)) return c;
    c = String(c == null ? '' : c).trim();
    let m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return m[1].split('').map((h) => parseInt(h + h, 16));
    m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    m = /^rgba?\(([^)]+)\)/i.exec(c);
    if (m) { const p = m[1].split(',').map((x) => parseFloat(x)); return [p[0] | 0, p[1] | 0, p[2] | 0]; }
    try { // nombres CSS ('red', 'tomato'…) vía canvas
      _cc = _cc || document.createElement('canvas').getContext('2d');
      _cc.fillStyle = '#000'; _cc.fillStyle = c;
      return K.rgb(_cc.fillStyle);
    } catch (e) { return [128, 128, 128]; }
  };
  K.css = (rgb, a) => 'rgba(' + (rgb[0] | 0) + ',' + (rgb[1] | 0) + ',' + (rgb[2] | 0) + ',' + (a == null ? 1 : a) + ')';
  K.mix = (c1, c2, u) => { const a = K.rgb(c1), b = K.rgb(c2); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; };
  /** aclara (amt>0) u oscurece (amt<0) un color; devuelve cadena CSS */
  K.shade = (c, amt, a) => K.css(K.mix(c, amt >= 0 ? '#ffffff' : '#000000', Math.abs(amt)), a);

  // --- tabla periódica mínima (colores "de manual" y tamaño relativo) ---
  K.ELEMENTOS = {
    H: { Z: 1, c: '#f4f4f0', r: 0.7 }, He: { Z: 2, c: '#d9ffff', r: 0.7 }, Li: { Z: 3, c: '#b36bff', r: 1.15 }, Be: { Z: 4, c: '#8fbf3f', r: 1 },
    B: { Z: 5, c: '#ffb5b5', r: 0.95 }, C: { Z: 6, c: '#4a4f58', r: 1 }, N: { Z: 7, c: '#3a6fe0', r: 1 }, O: { Z: 8, c: '#e63946', r: 1 },
    F: { Z: 9, c: '#7fd957', r: 0.9 }, Ne: { Z: 10, c: '#b3e3f5', r: 0.9 }, Na: { Z: 11, c: '#ab5cf2', r: 1.3 }, Mg: { Z: 12, c: '#6fbf4a', r: 1.2 },
    Al: { Z: 13, c: '#bfa6a6', r: 1.15 }, Si: { Z: 14, c: '#c9a46a', r: 1.1 }, P: { Z: 15, c: '#ff8000', r: 1.05 }, S: { Z: 16, c: '#f2d21b', r: 1.1 },
    Cl: { Z: 17, c: '#2ecc71', r: 1.2 }, Ar: { Z: 18, c: '#80d1e3', r: 1.1 }, K: { Z: 19, c: '#8f40d4', r: 1.45 }, Ca: { Z: 20, c: '#3dff3d', r: 1.3 },
    Fe: { Z: 26, c: '#e06633', r: 1.15 }, Cu: { Z: 29, c: '#c88033', r: 1.15 }, Zn: { Z: 30, c: '#7d80b0', r: 1.15 }, Br: { Z: 35, c: '#a62929', r: 1.3 },
    Ag: { Z: 47, c: '#c0c0c0', r: 1.3 }, I: { Z: 53, c: '#940094', r: 1.4 }, Au: { Z: 79, c: '#ffd123', r: 1.3 }, Pb: { Z: 82, c: '#575961', r: 1.4 },
  };
  K.elem = (sym) => K.ELEMENTOS[sym] || { Z: 0, c: '#9aa3b2', r: 1 };
  /** capas electrónicas aproximadas [2,8,8,…] para dibujar un modelo de Bohr */
  K.capas = (Z) => { const cap = [2, 8, 8, 18, 18, 32], out = []; let z = Math.max(0, Math.min(Z | 0, 54)); for (let i = 0; i < cap.length && z > 0; i++) { const n = Math.min(cap[i], z); out.push(n); z -= n; } return out; };

  /** "H2O" / "C6H12O6" / "NaCl" -> [{el:'H',n:2},{el:'O',n:1}] (ignora coeficientes, cargas y paréntesis) */
  K.parseFormula = (f) => {
    const out = [], re = /([A-Z][a-z]?)(\d*)/g; let m;
    f = String(f || '').replace(/^\d+/, '').replace(/[()\[\]^+\-−⁺⁻]/g, '');
    while ((m = re.exec(f))) out.push({ el: m[1], n: m[2] ? +m[2] : 1 });
    return out;
  };

  /**
   * Disposición 2D de una molécula (unidades: altura de escena; y hacia abajo).
   * Admite def.atomos = ['O','H','H'] | [{el,x,y}] | def.formula = 'H2O' | def.molecula = 'CO2'.
   * Devuelve {atomos:[{el,x,y,r}], enlaces:[[i,j,orden]]} centrado en su centroide. Cacheado.
   */
  const _lay = new WeakMap();
  K.layoutMolecula = (def) => {
    def = def || {};
    if (_lay.has(def)) return _lay.get(def);
    const L = 0.058; // longitud de enlace
    const sym = [];
    let explicit = null;
    if (Array.isArray(def.atomos) && def.atomos.length) {
      if (typeof def.atomos[0] === 'object') explicit = def.atomos.map((a) => ({ el: String(a.el || a.elemento || 'C'), x: K.num(a.x, 0) * L, y: K.num(a.y, 0) * L }));
      else def.atomos.forEach((a) => sym.push(String(a)));
    } else {
      const comp = K.parseFormula(def.formula || def.molecula || def.simbolo || 'H2O');
      comp.forEach((c) => { for (let i = 0; i < Math.min(c.n, 12); i++) sym.push(c.el); });
    }
    let atomos = [], enlaces = [];
    if (explicit) {
      atomos = explicit;
      for (let i = 0; i < atomos.length; i++) for (let j = i + 1; j < atomos.length; j++) if (Math.hypot(atomos[i].x - atomos[j].x, atomos[i].y - atomos[j].y) < L * 1.3) enlaces.push([i, j, 1]);
    } else {
      // átomo central: el único no-H con mayor "valencia"; si no hay, anillo/cadena
      const prio = ['C', 'N', 'S', 'P', 'O', 'Si', 'Al', 'Mg', 'Ca', 'Fe', 'Cu', 'Zn'];
      let ci = -1;
      for (const p of prio) { const idx = sym.indexOf(p); if (idx >= 0 && sym.filter((s) => s === p).length === 1 && sym.length > 2) { ci = idx; break; } }
      if (sym.length === 1) atomos = [{ el: sym[0], x: 0, y: 0 }];
      else if (sym.length === 2) {
        atomos = [{ el: sym[0], x: -L / 2, y: 0 }, { el: sym[1], x: L / 2, y: 0 }];
        const orden = sym[0] === sym[1] ? (sym[0] === 'N' ? 3 : sym[0] === 'O' ? 2 : 1) : 1;
        enlaces = [[0, 1, orden]];
      } else if (ci >= 0) {
        const lig = sym.filter((_, i) => i !== ci);
        atomos = [{ el: sym[ci], x: 0, y: 0 }];
        const n = lig.length;
        const todosO = lig.every((s) => s === lig[0]);
        let ang;
        if (n === 2) ang = sym[ci] === 'C' && todosO && lig[0] === 'O' ? [Math.PI, 0] : [Math.PI / 2 + 0.91, Math.PI / 2 - 0.91]; // CO2 lineal; H2O doblada (104,5°)
        else if (n === 3) ang = [Math.PI / 2 + 2.09, Math.PI / 2, Math.PI / 2 - 2.09];
        else ang = lig.map((_, i) => (i / n) * Math.PI * 2 + Math.PI / 4);
        const orden = sym[ci] === 'C' && n === 2 && lig[0] === 'O' ? 2 : 1;
        lig.forEach((s, i) => { atomos.push({ el: s, x: Math.cos(ang[i]) * L, y: Math.sin(ang[i]) * L * (n === 2 && ang[0] !== Math.PI ? 0.85 : 1) }); enlaces.push([0, i + 1, orden]); });
        if (n === 2 && ang[0] !== Math.PI) atomos.forEach((a, i) => { if (i) a.y = Math.abs(a.y) * 0.9 - L * 0.28; else a.y -= L * 0.28; });
      } else {
        const n = sym.length, R = L * (n <= 3 ? 0.9 : 1.15);
        atomos = sym.map((s, i) => ({ el: s, x: Math.cos((i / n) * Math.PI * 2 - Math.PI / 2) * R, y: Math.sin((i / n) * Math.PI * 2 - Math.PI / 2) * R }));
        for (let i = 0; i < n; i++) enlaces.push([i, (i + 1) % n, 1]);
        if (n === 2) enlaces.length = 1;
      }
    }
    // centrar
    let cx = 0, cy = 0; atomos.forEach((a) => { cx += a.x; cy += a.y; }); cx /= atomos.length || 1; cy /= atomos.length || 1;
    atomos.forEach((a) => { a.x -= cx; a.y -= cy; a.r = 0.025 * K.elem(a.el).r; });
    const res = { atomos, enlaces };
    _lay.set(def, res);
    return res;
  };

  /**
   * Cajas de cada tipo (en alturas de escena, escala 1): [ancho, alto, ancla]
   * ancla 'base' = pos son los pies/ruedas · 'centro' · 'pivote' (pendulo, arriba) · 'izq' (resorte).
   */
  K.EXT = {
    auto: [0.32, 0.15, 'base'], perro: [0.18, 0.13, 'base'], humano: [0.11, 0.28, 'base'], cohete: [0.08, 0.24, 'centro'],
    planeta: [0.17, 0.17, 'centro'], luna: [0.09, 0.09, 'centro'], tubo_ensayo: [0.07, 0.24, 'base'], vaso: [0.13, 0.16, 'base'],
    bola: [0.07, 0.07, 'centro'], molecula: [0.15, 0.13, 'centro'], atomo: [0.15, 0.15, 'centro'], ion: [0.09, 0.09, 'centro'],
    electron: [0.035, 0.035, 'centro'], circuito: [0.36, 0.24, 'centro'], pendulo: [0.12, 0.34, 'pivote'], resorte: [0.34, 0.07, 'izq'],
    onda: [0.5, 0.13, 'centro'], lente: [0.09, 0.3, 'centro'], rayo: [0.28, 0.04, 'centro'], flecha: [0.16, 0.05, 'centro'],
    bloque: [0.12, 0.10, 'base'], fluido: [0.5, 0.2, 'centro'], termometro: [0.05, 0.24, 'base'], texto: [0.22, 0.06, 'centro'],
  };
  /** caja del actor en coordenadas normalizadas {cx,cy,hw,hh} (hw en x normalizado) */
  K.caja = (a, aspecto) => {
    const e = K.EXT[a.tipo] || [0.12, 0.12, 'centro'];
    const w = (e[0] * a.escala) / aspecto, h = e[1] * a.escala;
    let cx = a.x, cy = a.y;
    if (e[2] === 'base') cy = a.y - h / 2; else if (e[2] === 'pivote') cy = a.y + h / 2; else if (e[2] === 'izq') cx = a.x + w / 2;
    return { cx, cy, hw: w / 2, hh: h / 2 };
  };

  /** color por defecto de un vector según su etiqueta (F rojo, v azul, a verde, P violeta…) */
  K.colorVector = (et) => {
    const c = String(et || '').replace(/[\\$\s{}]|vec|overrightarrow/g, '').charAt(0);
    const tabla = { F: '#d62839', f: '#d62839', v: '#1d70e6', V: '#1d70e6', a: '#16a05a', A: '#16a05a', P: '#8e44ad', p: '#8e44ad', N: '#0e9aa7', R: '#0e9aa7', T: '#e67e22', g: '#8e44ad', E: '#e6a100', B: '#2c8cff' };
    if (tabla[c]) return tabla[c];
    const pal = ['#d62839', '#1d70e6', '#16a05a', '#e67e22', '#8e44ad', '#0e9aa7'];
    return pal[K.hash(et || 'x') % pal.length];
  };

  /** parte un texto en líneas que quepan en maxW px con el font actual de ctx */
  K.envuelve = (ctx, texto, maxW) => {
    const pal = String(texto == null ? '' : texto).split(/\s+/), lineas = []; let cur = '';
    for (const p of pal) {
      const t = cur ? cur + ' ' + p : p;
      if (cur && ctx.measureText(t).width > maxW) { lineas.push(cur); cur = p; } else cur = t;
    }
    if (cur) lineas.push(cur);
    return lineas.slice(0, 5);
  };

  const GRIEGO = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', lambda: 'λ', mu: 'μ', nu: 'ν', omega: 'ω', Omega: 'Ω', pi: 'π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', sum: 'Σ', tau: 'τ', theta: 'θ', phi: 'φ', varphi: 'φ', epsilon: 'ε', varepsilon: 'ε', eta: 'η', cdot: '·', times: '×', rightarrow: '→', Rightarrow: '⇒', approx: '≈', neq: '≠', infty: '∞', degree: '°' };
  /** LaTeX sencillo -> texto plano con Unicode (para etiquetas dibujadas en canvas): \vec F -> F⃗, v_0 -> v₀, \Delta -> Δ */
  K.texPlano = (s) => {
    s = String(s == null ? '' : s);
    const sub = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋' };
    const sup = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ' };
    const gr = GRIEGO;
    s = s.replace(/\$/g, '').replace(/\\(?:vec|overrightarrow)\s*\{([^}]*)\}/g, '$1⃗').replace(/\\(?:vec|overrightarrow)\s*([A-Za-z])/g, '$1⃗')
      .replace(/\\(?:text|mathrm|mathit|mathbf)\s*\{([^}]*)\}/g, '$1').replace(/\\([A-Za-z]+)/g, (m, k) => (gr[k] != null ? gr[k] : k))
      .replace(/_\{([^}]*)\}/g, (m, t) => t.split('').map((ch) => sub[ch] || ch).join('')).replace(/_([0-9a-z])/g, (m, ch) => sub[ch] || ch)
      .replace(/\^\{([^}]*)\}/g, (m, t) => t.split('').map((ch) => sup[ch] || ch).join('')).replace(/\^([0-9n+-])/g, (m, ch) => sup[ch] || ch)
      .replace(/[{}]/g, '').replace(/\\,|\\;|\\ /g, ' ');
    return s;
  };

  /** trocea un LaTeX sencillo en partes [{t,k:'n'|'sub'|'sup',vec?}] para dibujar subíndices/vectores en canvas */
  K.partesTex = (s) => {
    s = String(s == null ? '' : s).replace(/\$/g, '').replace(/\\(?:text|mathrm|mathit|mathbf)\s*\{([^}]*)\}/g, '$1');
    const parts = []; let buf = '', i = 0;
    const flush = () => { if (buf) { parts.push({ t: buf, k: 'n' }); buf = ''; } };
    const grupo = () => { let g; if (s[i] === '{') { const j = s.indexOf('}', i); g = s.slice(i + 1, j < 0 ? s.length : j); i = j < 0 ? s.length : j + 1; } else { g = s[i] || ''; i++; } return g; };
    const gr = (g) => g.replace(/\\([A-Za-z]+)/g, (m, k) => (GRIEGO[k] != null ? GRIEGO[k] : k));
    while (i < s.length) {
      if (s.startsWith('\\vec', i) || s.startsWith('\\overrightarrow', i)) { flush(); i += s.startsWith('\\vec', i) ? 4 : 15; while (s[i] === ' ') i++; parts.push({ t: gr(grupo()), k: 'n', vec: true }); continue; }
      if (s[i] === '\\') { const m = /^\\([A-Za-z]+)/.exec(s.slice(i)); if (m) { buf += GRIEGO[m[1]] != null ? GRIEGO[m[1]] : m[1]; i += m[0].length; } else i += 2; continue; }
      if (s[i] === '_' || s[i] === '^') { flush(); const k = s[i] === '_' ? 'sub' : 'sup'; i++; parts.push({ t: gr(grupo()), k }); continue; }
      if (s[i] === '{' || s[i] === '}') { i++; continue; }
      buf += s[i++];
    }
    flush(); return parts;
  };
  /** dibuja LaTeX sencillo en un canvas 2D con subíndices, superíndices y flechas de vector. o:{fill,halo,align,peso,fam} */
  K.textoRico = (ctx, str, x, y, px, o) => {
    o = o || {};
    const parts = K.partesTex(str), fam = o.fam || 'sans-serif', peso = o.peso || '700';
    const fs = (k) => (k === 'n' ? px : px * 0.66);
    let tot = 0;
    parts.forEach((p) => { ctx.font = peso + ' ' + fs(p.k) + 'px ' + fam; p.w = ctx.measureText(p.t).width; tot += p.w; });
    let cx = o.align === 'left' ? x : o.align === 'right' ? x - tot : x - tot / 2;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    parts.forEach((p) => {
      const yy = y + (p.k === 'sub' ? px * 0.24 : p.k === 'sup' ? -px * 0.36 : 0);
      ctx.font = peso + ' ' + fs(p.k) + 'px ' + fam;
      if (o.halo) { ctx.lineWidth = o.haloW || 5; ctx.strokeStyle = o.halo; ctx.lineJoin = 'round'; ctx.strokeText(p.t, cx, yy); }
      ctx.fillStyle = o.fill || '#000'; ctx.fillText(p.t, cx, yy);
      if (p.vec) { // flecha sobre la letra
        const ay = yy - px * 0.58, a0 = cx + p.w * 0.1, a1 = cx + p.w * 0.95;
        ctx.save(); ctx.strokeStyle = o.fill || '#000'; ctx.lineWidth = Math.max(1.2, px * 0.07); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a0, ay); ctx.lineTo(a1, ay); ctx.moveTo(a1 - px * 0.12, ay - px * 0.1); ctx.lineTo(a1, ay); ctx.lineTo(a1 - px * 0.12, ay + px * 0.1); ctx.stroke(); ctx.restore();
      }
      cx += p.w;
    });
    return tot;
  };

  /**
   * Partículas deterministas: dado un evento p={tipo,x,y,t0,dur,n} y el tiempo de escena t devuelve
   * una lista de {k:'burbuja'|'chispa'|'polvo', x, y, r, a, u, ang} (x,y normalizados; r en alturas).
   */
  K.particulas = (p, t, aspecto, reducido) => {
    const out = [], dur = p.dur || 2.5, base = K.hash(p.tipo + ':' + Math.round(p.t0 * 100));
    let n = Math.max(1, Math.round(p.n || 12)); if (reducido) n = Math.max(2, Math.round(n * 0.4));
    const tipo = p.tipo;
    for (let i = 0; i < n; i++) {
      const sd = base + i * 131;
      if (tipo === 'chispas') {
        const rondas = Math.max(1, Math.round(dur / 0.45));
        for (let k = 0; k < rondas; k++) {
          const age = t - p.t0 - k * 0.45 - K.hrand(sd + k) * 0.1, life = 0.55;
          if (age < 0 || age > life) continue;
          const u = age / life, ang = K.hrand(sd + 7 + k * 3) * Math.PI * 2, d = (0.02 + K.hrand(sd + 9) * 0.07) * Math.sqrt(u);
          out.push({ k: 'chispa', x: p.x + (Math.cos(ang) * d) / aspecto, y: p.y + Math.sin(ang) * d + u * u * 0.03, r: 0.004 + K.hrand(sd + 11) * 0.004, a: 1 - u, u, ang });
        }
      } else if (tipo === 'polvo') {
        const b = K.hrand(sd) * dur * 0.5, age = t - p.t0 - b, life = 1.3 + K.hrand(sd + 1) * 0.8;
        if (age < 0 || age > life) continue;
        const u = age / life;
        out.push({ k: 'polvo', x: p.x + ((K.hrand(sd + 2) - 0.5) * 0.07 + (K.hrand(sd + 3) - 0.5) * u * 0.05) / aspecto, y: p.y - u * 0.05 + (K.hrand(sd + 4) - 0.5) * 0.015, r: 0.008 + u * 0.03 * (0.6 + K.hrand(sd + 5)), a: 0.55 * (1 - u), u, ang: 0 });
      } else { // burbujas (por defecto)
        const b = K.hrand(sd) * dur * 0.7, age = t - p.t0 - b, life = 1.5 + K.hrand(sd + 1) * 1.2;
        if (age < 0 || age > life) continue;
        const u = age / life;
        out.push({ k: 'burbuja', x: p.x + ((K.hrand(sd + 2) - 0.5) * 0.07 + Math.sin(age * 4 + i) * 0.006) / aspecto, y: p.y - u * (0.12 + K.hrand(sd + 6) * 0.08), r: 0.005 + K.hrand(sd + 3) * 0.009, a: u < 0.85 ? 1 : (1 - u) / 0.15, u, ang: 0 });
      }
    }
    return out;
  };

  /**
   * Átomos "viajeros" de las reacciones activas: para cada reacción con 0<progreso<1 empareja los
   * átomos de los actores `de` con los de `a` (por elemento) y devuelve
   * [{el, esc0,esc1 (escala origen/destino), x0,y0, x1,y1, u, k:'viaja'|'sale'|'entra'}] en coordenadas normalizadas.
   */
  K.viajeros = (S, aspecto) => {
    const out = [];
    const atomosDe = (id) => {
      const a = S.actores[id]; if (!a) return [];
      const sc = a.escala || 1;
      if (a.tipo === 'molecula' || a.tipo === 'atomo' || a.tipo === 'ion') {
        const lay = a.tipo === 'molecula' ? K.layoutMolecula(a.def) : { atomos: [{ el: (a.def && (a.def.elemento || a.def.simbolo)) || 'C', x: 0, y: 0 }] };
        return lay.atomos.map((q) => ({ el: q.el, esc: sc, x: a.x + (q.x * sc) / aspecto, y: a.y + q.y * sc }));
      }
      return [{ el: null, esc: sc, x: a.x, y: a.y }];
    };
    (S.reacciones || []).forEach((r) => {
      if (!(r.progreso > 0 && r.progreso < 1)) return;
      const A = [].concat(...(r.de || []).map(atomosDe)), B = [].concat(...(r.a || []).map(atomosDe));
      if (!A.length && !B.length) return;
      const usado = new Array(B.length).fill(false);
      const cen = (L) => { let x = 0, y = 0; L.forEach((q) => { x += q.x; y += q.y; }); return { x: x / (L.length || 1), y: y / (L.length || 1) }; };
      const cA = cen(A), cB = cen(B);
      const u = K.smooth((r.progreso - 0.1) / 0.8);
      A.forEach((p) => {
        let best = -1, bd = 1e9;
        B.forEach((q, j) => { if (usado[j]) return; if (p.el && q.el && p.el !== q.el) return; const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = j; } });
        if (best >= 0) { usado[best] = true; out.push({ el: p.el || B[best].el, esc0: p.esc, esc1: B[best].esc, x0: p.x, y0: p.y, x1: B[best].x, y1: B[best].y, u, k: 'viaja' }); }
        else out.push({ el: p.el, esc0: p.esc, esc1: p.esc, x0: p.x, y0: p.y, x1: cB.x, y1: cB.y, u, k: 'sale' });
      });
      B.forEach((q, j) => { if (!usado[j]) out.push({ el: q.el, esc0: q.esc, esc1: q.esc, x0: cA.x, y0: cA.y, x1: q.x, y1: q.y, u, k: 'entra' }); });
    });
    return out;
  };

  /** crea un canvas dentro de host con soporte de dpr; devuelve {cv, ctx, resize(w,h)} */
  K.lienzo = (host, dpr) => {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.appendChild(cv);
    const ctx = cv.getContext('2d');
    const o = { cv, ctx, w: 0, h: 0, dpr: dpr || 1 };
    o.resize = (w, h, d) => { o.w = w; o.h = h; o.dpr = d || o.dpr; cv.width = Math.max(1, Math.round(w * o.dpr)); cv.height = Math.max(1, Math.round(h * o.dpr)); };
    return o;
  };

  // ---------------------------------------------------------------------------------
  // Compilación del guion -> pistas y listas de eventos
  // ---------------------------------------------------------------------------------
  const num = K.num;
  const esPunto = (p) => Array.isArray(p) && p.length >= 2 && isFinite(num(p[0], NaN)) && isFinite(num(p[1], NaN));
  const punto = (p) => (esPunto(p) ? [num(p[0], 0.5), num(p[1], 0.5)] : p && typeof p === 'object' && isFinite(num(p.x, NaN)) && isFinite(num(p.y, NaN)) ? [num(p.x, 0.5), num(p.y, 0.5)] : null);

  function nuevaPista(ini) { return { ini, tw: [] }; }
  function evalPista(tr, t) {
    for (let i = tr.tw.length - 1; i >= 0; i--) {
      const w = tr.tw[i];
      if (t >= w.t0) {
        if (t >= w.t1) return w.b;
        return w.a + (w.b - w.a) * w.e((t - w.t0) / (w.t1 - w.t0));
      }
    }
    return tr.ini;
  }
  function addTw(tr, t0, dur, to, e) {
    const from = evalPista(tr, t0);
    tr.tw.push({ t0, t1: t0 + Math.max(0, dur), a: from, b: to, e: e || EASES.linear });
  }
  function evalColor(tr, t) {
    for (let i = tr.tw.length - 1; i >= 0; i--) {
      const w = tr.tw[i];
      if (t >= w.t0) {
        if (t >= w.t1) return w.cb;
        const u = EASES.inoutquad((t - w.t0) / (w.t1 - w.t0));
        return K.css(K.mix(w.ca, w.cb, u));
      }
    }
    return tr.ini;
  }

  function compilar(guion) {
    const G = guion && typeof guion === 'object' ? guion : {};
    const defs = (Array.isArray(G.actores) ? G.actores : []).filter((a) => a && typeof a === 'object' && a.id != null);
    const A = {}; const lista = [];
    defs.forEach((d, i) => {
      const id = String(d.id); if (A[id]) return;
      const pos = punto(d.pos) || [num(d.x, 0.5), num(d.y, 0.5)];
      const a = {
        id, def: d, orden: i, tipo: String(d.tipo || 'bola'),
        x: nuevaPista(pos[0]), y: nuevaPista(pos[1]),
        rot: nuevaPista(((num(d.rot, num(d.angulo, num(d.grados, 0)))) * Math.PI) / 180),
        escala: nuevaPista(num(d.escala, 1)),
        alpha: nuevaPista(d.visible === false ? 0 : num(d.alpha, 1)),
        color: { ini: d.color || null, tw: [] },
        dirs: [], frenadas: [], habla: [], resalta: [], reac: [], primeraAlpha: null, tieneGiro: false,
        dirIni: d.mirar === 'izq' || d.espejo ? -1 : 1,
      };
      A[id] = a; lista.push(a);
    });

    const pasos = (Array.isArray(G.pasos) ? G.pasos : [])
      .filter((p) => p && typeof p === 'object' && p.accion)
      .map((p, i) => ({ p, i, t: Math.max(0, num(p.t, 0)), ac: String(p.accion).toLowerCase() }))
      .sort((a, b) => a.t - b.t || a.i - b.i);

    const ids = (p) => { const r = p.actor != null ? p.actor : p.actores; return (Array.isArray(r) ? r : [r]).map((x) => A[String(x)]).filter(Boolean); };

    // Pasada A: pistas de los actores (dependen del orden temporal)
    pasos.forEach(({ p, t, ac }) => {
      ids(p).forEach((a) => {
        if ((ac === 'aparece' || ac === 'desaparece') && a.primeraAlpha == null) a.primeraAlpha = ac;
        if (ac === 'mueve') {
          const dest = punto(p.a);
          if (!dest) return;
          const dur = num(p.dur, 1.5), e = K.ease(p.ease, 'linear');
          const x0 = evalPista(a.x, t);
          addTw(a.x, t, dur, dest[0], e); addTw(a.y, t, dur, dest[1], e);
          if (Math.abs(dest[0] - x0) > 1e-4) a.dirs.push({ t0: t, d: dest[0] > x0 ? 1 : -1 });
        } else if (ac === 'frena') {
          const T = Math.max(0.2, num(p.dur, 1.1)), h = 0.03;
          [a.x, a.y].forEach((tr) => {
            const v = (evalPista(tr, t) - evalPista(tr, t - h)) / h;
            if (Math.abs(v) > 1e-4) addTw(tr, t, T, evalPista(tr, t) + (v * T) / 2, EASES.outquad);
          });
          a.frenadas.push({ t0: t, t1: t + T + 0.3 });
        } else if (ac === 'aparece') addTw(a.alpha, t, num(p.dur, 0.5), 1, EASES.inoutquad);
        else if (ac === 'desaparece') addTw(a.alpha, t, num(p.dur, 0.5), 0, EASES.inoutquad);
        else if (ac === 'gira') { a.tieneGiro = true; addTw(a.rot, t, num(p.dur, 1), evalPista(a.rot, t) + (num(p.grados, 0) * Math.PI) / 180, K.ease(p.ease, 'inoutquad')); }
        else if (ac === 'escala') { const v = num(p.a, NaN); if (isFinite(v)) addTw(a.escala, t, num(p.dur, 0.6), v, K.ease(p.ease, 'inoutquad')); }
        else if (ac === 'color' && p.color) {
          const prev = a.color.tw.length ? a.color.tw[a.color.tw.length - 1].cb : a.color.ini || '#888888';
          a.color.tw.push({ t0: t, t1: t + 0.45, ca: prev, cb: p.color });
        }
      });
    });
    // actores que empiezan ocultos si su primera acción de alfa es `aparece`
    lista.forEach((a) => { if (a.primeraAlpha === 'aparece' && a.def.visible !== true) a.alpha.ini = a.def.alpha != null ? num(a.def.alpha, 0) : 0; });
    // si empiezan ocultos por `aparece`, la pista debe partir de 0: reconstruimos desde la ini
    lista.forEach((a) => { a.alpha.tw.forEach((w, i) => { if (i === 0) w.a = a.alpha.ini; }); });

    // Pasada B: eventos
    const E = { habla: [], vectores: [], trayec: [], part: [], reac: [], cam: { zoom: nuevaPista(1), cx: nuevaPista(0.5), cy: nuevaPista(0.5) }, formulas: [], subs: [], valores: [], pausas: [] };
    let fin = Math.max(0, num(G.duracion_seg, 0));
    pasos.forEach(({ p, t, ac }) => {
      fin = Math.max(fin, t + Math.max(0, num(p.dur, 0)));
      if (ac === 'habla') {
        const texto = p.texto != null ? String(p.texto) : ''; const dur = num(p.dur, Math.min(6, Math.max(2.2, 1.4 + texto.length * 0.06)));
        ids(p).forEach((a) => a.habla.push({ t0: t, t1: texto ? t + dur : t, texto }));
      } else if (ac === 'resalta') {
        ids(p).forEach((a) => a.resalta.push({ t0: t, dur: Math.max(0.6, num(p.dur, 1.8)) }));
      } else if (ac === 'vector') {
        ids(p).forEach((a) => {
          const dx = num(p.dx, 0), dy = num(p.dy, 0);
          E.vectores.push({ a, dx, dy, et: p.etiqueta != null ? String(p.etiqueta) : '', t0: t, t1: t + Math.max(0.8, num(p.dur, 5)), key: a.id + '|' + (p.etiqueta || '') });
        });
      } else if (ac === 'trayectoria') {
        const pts = (Array.isArray(p.puntos) ? p.puntos : []).map(punto).filter(Boolean);
        ids(p).forEach((a) => E.trayec.push({ a, pts, t0: t }));
      } else if (ac === 'particulas') {
        let pos = punto(p.pos);
        if (!pos && typeof p.pos === 'string' && A[p.pos]) pos = [evalPista(A[p.pos].x, t), evalPista(A[p.pos].y, t)];
        if (!pos && p.actor != null && A[String(p.actor)]) { const a = A[String(p.actor)]; pos = [evalPista(a.x, t), evalPista(a.y, t)]; }
        if (!pos) pos = [0.5, 0.5];
        const dur = Math.max(0.5, num(p.dur, 2.5));
        E.part.push({ tipo: String(p.tipo || 'burbujas'), x: pos[0], y: pos[1], t0: t, dur, n: num(p.n, 12) });
        fin = Math.max(fin, t + dur);
      } else if (ac === 'camara') {
        const dur = num(p.dur, 1.2), e = K.ease(p.ease, 'inoutsine');
        const z = num(p.zoom, NaN);
        if (isFinite(z)) addTw(E.cam.zoom, t, dur, K.clamp(z, 0.3, 6), e);
        let c = punto(p.centro);
        if (!c && typeof p.centro === 'string' && A[p.centro]) c = [evalPista(A[p.centro].x, t), evalPista(A[p.centro].y, t) - 0.04];
        if (c) { addTw(E.cam.cx, t, dur, c[0], e); addTw(E.cam.cy, t, dur, c[1], e); }
        else if (isFinite(z) && p.centro === undefined) { /* sólo zoom: se mantiene el centro */ }
      } else if (ac === 'formula') {
        if (p.latex != null) E.formulas.push({ latex: String(p.latex), pos: punto(p.pos), t0: t, dur: p.dur != null ? num(p.dur, 0) : 0 });
      } else if (ac === 'subtitulo') {
        if (p.texto != null) E.subs.push({ texto: String(p.texto), t0: t, dur: p.dur != null ? num(p.dur, 0) : 0 });
      } else if (ac === 'valor') {
        if (p.id != null) E.valores.push({ id: String(p.id), desde: num(p.desde, 0), hasta: num(p.hasta, num(p.desde, 0)), dur: Math.max(0, num(p.dur, 2)), et: p.etiqueta != null ? String(p.etiqueta) : '', unidad: p.unidad != null ? String(p.unidad) : '', dec: p.decimales != null ? num(p.decimales, 0) : null, t0: t });
      } else if (ac === 'reaccion') {
        const de = (Array.isArray(p.de) ? p.de : p.de != null ? [p.de] : []).map(String).filter((x) => A[x]);
        const a2 = (Array.isArray(p.a) ? p.a : p.a != null ? [p.a] : []).map(String).filter((x) => A[x]);
        const dur = Math.max(0.5, num(p.dur, 2.4));
        const r = { de, a: a2, t0: t, dur };
        E.reac.push(r);
        de.forEach((id) => A[id].reac.push({ t0: t, dur, rol: 'de' }));
        a2.forEach((id) => A[id].reac.push({ t0: t, dur, rol: 'a' }));
        fin = Math.max(fin, t + dur);
      } else if (ac === 'pausa') {
        const dur = Math.max(0, num(p.dur, 1));
        if (dur > 0) E.pausas.push({ t, dur });
      }
    });

    // Vigencias: subtítulos y fórmulas se reemplazan entre sí
    E.subs.forEach((s, i) => {
      const sig = E.subs[i + 1];
      const vida = s.dur > 0 ? s.dur : Math.max(3.5, 1.2 + s.texto.length * 0.075);
      s.t1 = Math.min(s.t0 + vida, sig ? sig.t0 : Infinity);
      fin = Math.max(fin, s.t0 + Math.min(vida, 6));
    });
    E.formulas.forEach((f, i) => {
      const k = f.pos ? f.pos.join(',') : 'def';
      let sig = null; for (let j = i + 1; j < E.formulas.length; j++) { const g = E.formulas[j]; if ((g.pos ? g.pos.join(',') : 'def') === k || !g.pos) { sig = g; break; } }
      f.t1 = f.dur > 0 ? f.t0 + f.dur : sig ? sig.t0 : Infinity;
      if (sig && f.dur > 0) f.t1 = Math.min(f.t1, sig.t0);
      fin = Math.max(fin, f.t0 + 2.5);
    });
    E.valores.forEach((v) => { fin = Math.max(fin, v.t0 + v.dur); });
    if (!pasos.length && !fin) fin = 6;
    fin = Math.max(fin, 2) + (num(G.duracion_seg, 0) > 0 ? 0 : 0.8);

    const pausaTotal = E.pausas.reduce((s, p) => s + p.dur, 0);
    return { G, A, lista, E, dur: fin, durTotal: fin + pausaTotal, titulo: G.titulo ? String(G.titulo) : '', estilo: G.estilo ? String(G.estilo) : 'monigotes' };
  }

  /** tiempo de motor T -> tiempo de escena t (las `pausa` del guion congelan la escena) */
  function escenaDe(C, T) {
    let acc = 0;
    for (const p of C.E.pausas) {
      if (T < p.t + acc) break;
      if (T < p.t + acc + p.dur) return { t: p.t, congelado: true };
      acc += p.dur;
    }
    return { t: Math.min(C.dur, T - acc), congelado: false };
  }

  // ---------------------------------------------------------------------------------
  // Resolución de la escena en el instante t -> S
  // ---------------------------------------------------------------------------------
  function sobre(t, t0, subida, t1, bajada) { // envolvente 0..1 con subida y bajada suaves
    if (t < t0 || t > t1 + bajada) return 0;
    const up = subida > 0 ? K.smooth((t - t0) / subida) : 1;
    const dn = bajada > 0 && t > t1 ? 1 - K.smooth((t - t1) / bajada) : 1;
    return Math.min(up, dn);
  }

  function resolver(C, t, reloj, congelado, reducido, aspecto) {
    const { A, lista, E } = C;
    const S = {
      t, dur: C.dur, reloj, reducido, aspecto, congelado,
      camara: { zoom: evalPista(E.cam.zoom, t), cx: evalPista(E.cam.cx, t), cy: evalPista(E.cam.cy, t) },
      actores: {}, vectores: [], trayectorias: {}, particulas: [], reacciones: [], valores: {},
    };
    const eps = 0.04;
    lista.forEach((a) => {
      let fRe = 1;
      a.reac.forEach((r) => {
        const p = K.clamp((t - r.t0) / r.dur, 0, 1);
        if (r.rol === 'de') fRe *= 1 - K.smooth(p / 0.15);
        else fRe *= K.smooth((p - 0.85) / 0.15);
      });
      const x = evalPista(a.x, t), y = evalPista(a.y, t), alpha = K.clamp(evalPista(a.alpha, t), 0, 1) * fRe;
      let vx = 0, vy = 0;
      if (!congelado) { vx = (evalPista(a.x, t + eps) - evalPista(a.x, Math.max(0, t - eps))) / (t + eps - Math.max(0, t - eps)); vy = (evalPista(a.y, t + eps) - evalPista(a.y, Math.max(0, t - eps))) / (t + eps - Math.max(0, t - eps)); }
      let dir = a.dirIni; for (const d of a.dirs) { if (d.t0 <= t) dir = d.d; else break; }
      let fren = false; for (const f of a.frenadas) if (t >= f.t0 && t <= f.t1) fren = true;
      let habl = null; for (let i = a.habla.length - 1; i >= 0; i--) { const h = a.habla[i]; if (t >= h.t0) { if (t < h.t1) habl = h.texto; break; } }
      let res = 0; for (const r of a.resalta) res = Math.max(res, sobre(t, r.t0, 0.3, r.t0 + r.dur, 0.4));
      const rot = evalPista(a.rot, t);
      S.actores[a.id] = {
        id: a.id, tipo: a.tipo, x, y, rot, rotGrados: (rot * 180) / Math.PI, escala: evalPista(a.escala, t), alpha,
        color: a.color.tw.length ? evalColor(a.color, t) : a.color.ini, visible: alpha > 0.01, vx, vy, dir,
        frenando: fren, hablando: habl, resaltado: res, def: a.def, orden: a.orden, tieneGiro: a.tieneGiro,
        texto: a.def.texto != null ? String(a.def.texto) : a.def.etiqueta != null ? String(a.def.etiqueta) : null,
      };
    });
    // valores (contadores)
    E.valores.forEach((v) => {
      if (t < v.t0) return;
      const u = v.dur > 0 ? K.clamp((t - v.t0) / v.dur, 0, 1) : 1;
      S.valores[v.id] = { valor: v.desde + (v.hasta - v.desde) * EASES.inoutquad(u), etiqueta: v.et, unidad: v.unidad, t0: v.t0 };
    });
    // vectores
    E.vectores.forEach((v) => {
      if (t < v.t0 || t > v.t1 + 0.4) return;
      // un vector con la misma clave posterior lo sustituye
      for (const w of E.vectores) if (w !== v && w.key === v.key && w.t0 > v.t0 && w.t0 <= t) return;
      const as = S.actores[v.a.id]; if (!as) return;
      let dx = v.dx, dy = v.dy; const L = Math.hypot(dx, dy);
      if (L < 1e-4) return;
      if (L > 0.45) { dx *= 0.45 / L; dy *= 0.45 / L; }
      const alpha = sobre(t, v.t0, 0.35, v.t1, 0.4) * as.alpha;
      if (alpha > 0.01) S.vectores.push({ actor: v.a.id, dx, dy, etiqueta: v.et, alpha });
    });
    // trayectorias (la última de cada actor; se "dibuja" en 1 s)
    E.trayec.forEach((tr) => {
      if (t < tr.t0) return;
      for (const w of E.trayec) if (w !== tr && w.a === tr.a && w.t0 > tr.t0 && w.t0 <= t) return;
      if (tr.pts.length < 2) return;
      const u = reducido ? 1 : K.clamp((t - tr.t0) / 1.0, 0, 1);
      if (u >= 1) { S.trayectorias[tr.a.id] = tr.pts; return; }
      const n = (tr.pts.length - 1) * u, k = Math.floor(n), f = n - k;
      const part = tr.pts.slice(0, k + 1);
      if (k + 1 < tr.pts.length) part.push([K.lerp(tr.pts[k][0], tr.pts[k + 1][0], f), K.lerp(tr.pts[k][1], tr.pts[k + 1][1], f)]);
      S.trayectorias[tr.a.id] = part;
    });
    // partículas
    E.part.forEach((p) => { if (t >= p.t0 && t < p.t0 + p.dur + 2.5) S.particulas.push({ tipo: p.tipo, x: p.x, y: p.y, t0: p.t0, dur: p.dur, n: p.n }); });
    // reacciones
    E.reac.forEach((r) => { if (t >= r.t0) S.reacciones.push({ de: r.de, a: r.a, progreso: K.clamp((t - r.t0) / r.dur, 0, 1) }); });
    return S;
  }

  // ---------------------------------------------------------------------------------
  // Reproductor: DOM, reloj, overlay, controles
  // ---------------------------------------------------------------------------------
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const fmtT = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const decs = (v) => { const m = /\.(\d+)/.exec(String(v)); return m ? Math.min(3, m[1].length) : 0; };

  intro.play = function (host, guion, opts) {
    opts = opts || {};
    const C = compilar(guion);
    const ASPECTO = 16 / 9;
    let T = 0, playing = true, ended = false, finLlamado = false, dirty = true, raf = 0, last = 0, disposed = false;
    let reducido = !!(PCB.util && PCB.util.reducedMotion && PCB.util.reducedMotion()), nFrames = 0;
    let estiloId = null, estilo = null, errUpdate = 0, sw = 0, sh = 0;

    // ---- DOM ----
    const root = el('div', 'intro-root');
    const area = el('div', 'intro-area');
    const stage = el('div', 'intro-stage');
    const lienzo = el('div', 'intro-lienzo');
    const ov = el('div', 'intro-overlay');
    const capaFormulas = el('div', 'intro-formulas'), capaValores = el('div', 'intro-valores'), capaSubs = el('div', 'intro-subs');
    ov.append(capaFormulas, capaValores, capaSubs);
    const fin = el('div', 'intro-fin');
    const card = el('div', 'intro-fin-card');
    card.append(el('div', 'intro-fin-tit', C.titulo || 'Introducción'));
    const btnIr = el('button', 'btn primario intro-ir', 'Ir al capítulo  →');
    const btnRep = el('button', 'btn intro-rep', '↺ Repetir');
    const filaFin = el('div', 'intro-fin-btns'); filaFin.append(btnIr, btnRep);
    card.append(filaFin, el('div', 'intro-fin-hint', 'Enter: ir al capítulo · R: repetir'));
    fin.append(card);
    stage.append(lienzo, ov, fin);
    area.append(stage);

    const bar = el('div', 'intro-bar');
    const btnPlay = el('button', 'btn intro-btn', '⏸'); btnPlay.title = 'Pausa / reanudar (espacio)';
    const btnReplay = el('button', 'btn intro-btn', '↺'); btnReplay.title = 'Repetir (R)';
    const prog = el('div', 'intro-prog'); const progFill = el('div', 'intro-prog-fill'); const progThumb = el('div', 'intro-prog-thumb'); prog.append(progFill, progThumb);
    prog.setAttribute('role', 'slider'); prog.setAttribute('aria-label', 'Progreso de la introducción');
    const tiempo = el('span', 'intro-tiempo', '0:00 / ' + fmtT(C.durTotal));
    const selEstilo = el('select', 'intro-estilo'); selEstilo.title = 'Estilo visual de la intro';
    const btnSaltar = el('button', 'btn mini intro-saltar', 'Saltar ⏭'); btnSaltar.title = 'Saltar al final (Esc)';
    bar.append(btnPlay, btnReplay, prog, tiempo, selEstilo, btnSaltar);
    root.append(area, bar);
    host.append(root);

    // ---- overlay: subtítulos, fórmulas, valores (nodos creados una vez) ----
    const nodosSub = C.E.subs.map((s) => { const n = el('div', 'intro-sub'); n.textContent = s.texto; n.style.opacity = 0; capaSubs.append(n); return n; });
    const nodosFor = C.E.formulas.map((f) => {
      const n = el('div', 'intro-formula'); const inner = el('span', 'intro-formula-in');
      try { (PCB.util && PCB.util.tex) ? PCB.util.tex(f.latex, inner, { display: true }) : (inner.textContent = f.latex); } catch (e) { inner.textContent = f.latex; }
      n.append(inner);
      const p = f.pos || [0.5, 0.19];
      n.style.left = p[0] * 100 + '%'; n.style.top = p[1] * 100 + '%'; n.style.opacity = 0;
      capaFormulas.append(n); return n;
    });
    const nodosVal = {};
    C.E.valores.forEach((v) => {
      if (nodosVal[v.id]) return;
      const n = el('div', 'intro-valor'); n.style.opacity = 0;
      const et = el('span', 'intro-valor-et'), num_ = el('span', 'intro-valor-num'), un = el('span', 'intro-valor-un');
      n.append(et, num_, un); capaValores.append(n); nodosVal[v.id] = { n, et, num: num_, un };
    });
    function ajustarFormulas() { // reduce la fórmula si no cabe a lo ancho del escenario
      if (!sw) return;
      nodosFor.forEach((n) => {
        n.style.setProperty('--fit', 1);
        const ancho = n.firstChild.getBoundingClientRect().width;
        n.style.setProperty('--fit', ancho > sw * 0.9 ? (sw * 0.9) / ancho : 1);
      });
    }

    function pintarOverlay(t) {
      C.E.subs.forEach((s, i) => { const a = sobre(t, s.t0, 0.3, s.t1 - 0.25, 0.25); nodosSub[i].style.opacity = a; nodosSub[i].style.display = a > 0 ? '' : 'none'; });
      C.E.formulas.forEach((f, i) => {
        const a = sobre(t, f.t0, 0.5, f.t1, 0.4), n = nodosFor[i];
        n.style.opacity = a; n.style.visibility = a > 0 ? 'visible' : 'hidden';
        n.style.transform = 'translate(-50%,-50%) scale(' + (reducido ? 1 : 0.94 + 0.06 * a) + ')';
      });
      const vistos = {};
      C.E.valores.forEach((v) => {
        if (t < v.t0 || vistos[v.id]) return;
        // usa el último evento de ese id que ya ha empezado
        let u = v; C.E.valores.forEach((w) => { if (w.id === v.id && w.t0 <= t && w.t0 >= u.t0) u = w; });
        vistos[v.id] = 1;
        const x = u.dur > 0 ? K.clamp((t - u.t0) / u.dur, 0, 1) : 1, val = u.desde + (u.hasta - u.desde) * EASES.inoutquad(x);
        const d = u.dec != null ? u.dec : Math.max(decs(u.desde), decs(u.hasta));
        const nd = nodosVal[u.id];
        nd.et.textContent = u.et; nd.num.textContent = (PCB.util && PCB.util.fmt ? PCB.util.fmt(val, d) : val.toFixed(d)); nd.un.textContent = u.unidad;
        nd.n.style.opacity = K.smooth((t - u.t0) / 0.4);
      });
      Object.keys(nodosVal).forEach((id) => { if (!vistos[id]) nodosVal[id].n.style.opacity = 0; });
    }

    // ---- selección de estilo ----
    function elegirEstilo(pedido) {
      const cfg = PCB.settings && PCB.settings.estiloIntro;
      let id = pedido || (cfg && cfg !== 'auto' ? cfg : C.estilo) || 'monigotes';
      if (!estilos[id]) id = estilos.monigotes ? 'monigotes' : Object.keys(estilos)[0];
      return id;
    }
    function crearEstilo(id) {
      if (estilo && estilo.dispose) { try { estilo.dispose(); } catch (e) { console.error(e); } }
      estilo = null; lienzo.replaceChildren(); errUpdate = 0;
      const tryInit = (sid) => {
        const reg = estilos[sid]; if (!reg) return null;
        try {
          const ctx = { host: lienzo, guion: C.G, w: sw || 640, h: sh || 360, dpr: Math.min(2, window.devicePixelRatio || 1), rng: (PCB.util && PCB.util.rng ? PCB.util.rng : K.rngFallback)(K.hash(C.titulo || 'intro')) };
          const inst = reg.init(ctx);
          if (inst && typeof inst.update === 'function') { estiloId = sid; return inst; }
        } catch (e) { console.error('[intro] fallo al iniciar el estilo', sid, e); lienzo.replaceChildren(); }
        return null;
      };
      estilo = tryInit(id) || (id !== 'monigotes' && tryInit('monigotes')) || null;
      if (estilo && estilo.resize && sw) { try { estilo.resize(sw, sh); } catch (e) { console.error(e); } }
      dirty = true;
    }
    K.rngFallback = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

    function llenarSelector() {
      selEstilo.replaceChildren();
      const o0 = el('option', null, 'Estilo: auto'); o0.value = 'auto'; selEstilo.append(o0);
      Object.keys(estilos).forEach((id) => { const o = el('option', null, (estilos[id].nombre || id)); o.value = id; selEstilo.append(o); });
      const cfg = PCB.settings && PCB.settings.estiloIntro;
      selEstilo.value = opts.estilo || !cfg ? (opts.estilo || 'auto') : cfg;
      if (!selEstilo.value) selEstilo.value = 'auto';
    }
    llenarSelector();
    selEstilo.addEventListener('change', () => {
      const v = selEstilo.value;
      if (PCB.settings) PCB.settings.estiloIntro = v;
      try { PCB.store && PCB.store.update((p) => { p.ajustes = PCB.settings; }); } catch (e) {}
      opts.estilo = v === 'auto' ? undefined : v;
      crearEstilo(elegirEstilo(opts.estilo));
      selEstilo.blur();
    });

    // ---- tamaño: escenario 16:9 con letterbox ----
    function medir() {
      const aw = area.clientWidth, ah = area.clientHeight; if (!aw || !ah) return;
      let w = Math.min(aw, ah * ASPECTO), h = w / ASPECTO;
      w = Math.floor(w / 2) * 2; h = Math.floor(h / 2) * 2;
      if (w === sw && h === sh) return;
      sw = w; sh = h;
      stage.style.width = w + 'px'; stage.style.height = h + 'px';
      stage.style.setProperty('--u', h / 100 + 'px');
      if (estilo && estilo.resize) { try { estilo.resize(w, h); } catch (e) { console.error(e); } }
      ajustarFormulas(); dirty = true;
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    if (ro) ro.observe(area); else window.addEventListener('resize', medir);
    medir();
    crearEstilo(elegirEstilo(opts.estilo));
    ajustarFormulas();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!disposed) ajustarFormulas(); });

    // ---- control ----
    function mostrarFin(v) { ended = v; fin.classList.toggle('on', v); if (v) { btnPlay.textContent = '▶'; setTimeout(() => { try { btnIr.focus({ preventScroll: true }); } catch (e) {} }, 0); } }
    function setPlaying(v) { playing = v && !ended; btnPlay.textContent = playing ? '⏸' : '▶'; last = 0; }
    function llamarFin() { if (finLlamado) return; finLlamado = true; if (typeof opts.onFin === 'function') { try { opts.onFin(); } catch (e) { console.error(e); } } }
    function seek(nuevo) {
      T = K.clamp(nuevo, 0, C.durTotal); dirty = true;
      if (T >= C.durTotal) { setPlaying(false); mostrarFin(true); } else if (ended) { mostrarFin(false); }
    }
    function replay() { finLlamado = false; mostrarFin(false); T = 0; setPlaying(true); dirty = true; }
    function saltar() { seek(C.durTotal); }
    btnPlay.addEventListener('click', () => { if (ended) replay(); else setPlaying(!playing); });
    btnReplay.addEventListener('click', replay);
    btnRep.addEventListener('click', replay);
    btnSaltar.addEventListener('click', saltar);
    btnIr.addEventListener('click', llamarFin);
    // barra de progreso: clic y arrastre
    let arrastrando = false;
    const desdeX = (ev) => { const r = prog.getBoundingClientRect(); seek(K.clamp((ev.clientX - r.left) / r.width, 0, 1) * C.durTotal); };
    prog.addEventListener('pointerdown', (ev) => { arrastrando = true; try { prog.setPointerCapture(ev.pointerId); } catch (e) {} desdeX(ev); });
    prog.addEventListener('pointermove', (ev) => { if (arrastrando) desdeX(ev); });
    const soltar = () => { arrastrando = false; };
    prog.addEventListener('pointerup', soltar); prog.addEventListener('pointercancel', soltar);
    function onKey(ev) {
      if (disposed) return;
      const tg = ev.target && ev.target.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
      if (ev.code === 'Space' || ev.key === ' ') {
        ev.preventDefault();
        if (ev.target === btnIr || ev.target === btnRep) return; // deja que el botón enfocado responda
        if (ended) llamarFin(); else setPlaying(!playing);
      } else if (ev.key === 'Escape') { ev.preventDefault(); if (!ended) saltar(); }
      else if (ev.key === 'Enter' && ended && ev.target !== btnRep) { ev.preventDefault(); llamarFin(); }
      else if (ev.key === 'r' || ev.key === 'R') replay();
      else if (ev.key === 'ArrowLeft') seek(T - 5);
      else if (ev.key === 'ArrowRight') seek(T + 5);
    }
    document.addEventListener('keydown', onKey);

    // ---- bucle ----
    function render(dt) {
      const { t, congelado } = escenaDe(C, T);
      if (nFrames++ % 30 === 0) reducido = !!(PCB.util && PCB.util.reducedMotion && PCB.util.reducedMotion());
      const S = resolver(C, t, T, congelado, reducido, ASPECTO);
      if (estilo) {
        try { estilo.update(S, dt); }
        catch (e) { if (errUpdate++ < 3) console.error('[intro] error en update del estilo', estiloId, e); if (errUpdate === 3 && estiloId !== 'monigotes' && estilos.monigotes) { console.warn('[intro] cambio a monigotes'); crearEstilo('monigotes'); } }
      }
      pintarOverlay(t);
      const f = C.durTotal > 0 ? T / C.durTotal : 1;
      progFill.style.width = f * 100 + '%'; progThumb.style.left = f * 100 + '%';
      prog.setAttribute('aria-valuenow', Math.round(f * 100));
      tiempo.textContent = fmtT(T) + ' / ' + fmtT(C.durTotal);
    }
    function frame(now) {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      if (playing) {
        T += dt; dirty = true;
        if (T >= C.durTotal) { T = C.durTotal; setPlaying(false); mostrarFin(true); }
      }
      if (dirty) { render(playing ? dt : 0); dirty = false; }
    }
    raf = requestAnimationFrame(frame);

    return {
      dispose() {
        if (disposed) return; disposed = true;
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', onKey);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', medir);
        if (estilo && estilo.dispose) { try { estilo.dispose(); } catch (e) { console.error(e); } }
        estilo = null; root.remove();
      },
      pause() { setPlaying(false); }, resume() { if (ended) replay(); else setPlaying(true); },
      replay, seek, saltar,
      get t() { return T; }, get dur() { return C.durTotal; }, get estilo() { return estiloId; }, get terminada() { return ended; },
    };
  };

  // ---------------------------------------------------------------------------------
  // Pantalla 3 del router
  // ---------------------------------------------------------------------------------
  let ctrl = null;
  PCB.screens = PCB.screens || {};
  PCB.screens.intro = {
    mount(host, ctx) {
      ctx = ctx || {};
      host.classList.add('intro-host');
      ctrl = intro.play(host, ctx.guion || {}, { onFin: ctx.onFin });
    },
    unmount() { if (ctrl) { ctrl.dispose(); ctrl = null; } },
    get ctrl() { return ctrl; }, // control del reproductor activo (pruebas / depuración)
  };
})();
