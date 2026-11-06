// =====================================================================================
// 10-vsepr.js — MOL3D · geometría VSEPR y construcción de moléculas en 3D
//
//  PCB.mol3d.vsepr = {
//    plantilla(X, E, ang?)      direcciones unitarias de X ligandos + E pares libres (notación AXₓEₑ)
//    nombreGeometria(X, E)      {es, fr, axe}
//    porAXE('AX2E2', {central:'O', ligando:'H'}) -> molécula 3D de un solo centro
//    desdeSMILES(smiles, opt)   -> molécula 3D a partir de una notación SMILES simplificada
//    angulo(mol, i, j, k)       ángulo i–j–k en grados     ·  distancia(mol, i, j)
//    formula(txt)               'CH3CO2H' -> 'CH₃CO₂H'   ·   'SO4^2-' -> 'SO₄²⁻'
//    longitud(elA, elB, orden)  longitud de enlace estándar (Å)
//  }
//
// Molécula 3D (salida de los constructores):
//   { atomos:[{el,x,y,z,carga}], enlaces:[{a,b,orden}], centros:[{i,el,X,E,axe,geometria,geometriaFr,angulos:[{i,j,k,deg}]}],
//     axe, geometria, geometriaFr, angulosTxt }
// Unidades: Å. Los ángulos y longitudes son DATOS FÍSICOS ESTÁNDAR (no son contenido del cours):
//   AX4 109,5° · AX3E 107° (NH₃) · AX2E2 104,5° (H₂O) · AX3 120° · AX2 180° …
// Método: cada átomo central recibe una «plantilla» VSEPR (direcciones ideales de sus ligandos);
// la molécula se construye recorriendo el grafo, alineando la plantilla de cada átomo con el enlace
// que lo une a su padre y girándola (diedro) en conformación alternada. Los anillos (benceno, glucosa
// en silla, anillo de cinco miembros) se colocan primero como polígono y se les cuelgan los sustituyentes.
// =====================================================================================
(function () {
  'use strict';
  const PCB = (window.PCB = window.PCB || {});
  const M = (PCB.mol3d = PCB.mol3d || {});
  const D = M.datos;
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;

  // ---------- álgebra vectorial mínima (vectores = [x,y,z]) ----------
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  /** Rotación de Rodrigues de v alrededor del eje unitario `eje` un ángulo `ang` (rad) */
  function rotar(v, eje, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), d = dot(eje, v) * (1 - c), cr = cross(eje, v);
    return [v[0] * c + cr[0] * s + eje[0] * d, v[1] * c + cr[1] * s + eje[1] * d, v[2] * c + cr[2] * s + eje[2] * d];
  }
  /** Devuelve la rotación mínima que lleva `de` sobre `a` (función v -> v') */
  function alinear(de, a) {
    de = unit(de); a = unit(a);
    const d = dot(de, a);
    if (d > 0.999999) return (v) => v;
    if (d < -0.999999) {
      const p = Math.abs(de[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], ax = unit(cross(de, p));
      return (v) => rotar(v, ax, Math.PI);
    }
    const ax = unit(cross(de, a)), ang = Math.acos(d);
    return (v) => rotar(v, ax, ang);
  }
  const perp = (v, eje) => sub(v, mul(eje, dot(v, eje))); // componente de v perpendicular al eje unitario

  // ---------- plantillas VSEPR ----------
  // Cada plantilla devuelve las direcciones unitarias de los X ligandos (los pares libres no se dibujan,
  // pero ocupan su sitio: por eso H₂O no es lineal). `ang` = ángulo entre ligandos cuando los pares libres lo comprimen.
  const S3 = Math.sqrt(3) / 2;
  function plantilla(X, E, ang) {
    E = E || 0;
    switch (X) {
      case 0: return [];
      case 1: return [[0, 0, 1]];
      case 2:
        if (E === 0 || E >= 3) return [[0, 0, 1], [0, 0, -1]];                       // AX2 / AX2E3 lineal
        { const h = ((ang || (E === 1 ? 117 : 104.5)) / 2) * RAD;                    // AX2E / AX2E2 angular
          return [[Math.sin(h), 0, Math.cos(h)], [-Math.sin(h), 0, Math.cos(h)]]; }
      case 3:
        if (E === 0) return [[1, 0, 0], [-0.5, S3, 0], [-0.5, -S3, 0]];              // AX3 trigonal plana (120°)
        if (E === 1) {                                                              // AX3E piramidal trigonal
          const g = (ang || 107) * RAD, cb2 = (Math.cos(g) + 0.5) / 1.5, cb = Math.sqrt(Math.max(0, cb2)), sb = Math.sqrt(1 - cb2);
          return [0, 1, 2].map((k) => [sb * Math.cos(k * 2 * Math.PI / 3), sb * Math.sin(k * 2 * Math.PI / 3), -cb]);
        }
        return [[0, 0, 1], [0, 0, -1], [1, 0, 0]];                                   // AX3E2 forma de T
      case 4: {
        if (E === 0) { const t = 1 / Math.sqrt(3); return [[t, t, t], [t, -t, -t], [-t, t, -t], [-t, -t, t]]; } // tetraedro 109,47°
        if (E === 1) return [[0, 0, 1], [0, 0, -1], [0.5, S3, 0], [0.5, -S3, 0]];    // AX4E balancín
        return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];                       // AX4E2 plana cuadrada
      }
      case 5:
        if (E === 0) return [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-0.5, S3, 0], [-0.5, -S3, 0]]; // bipirámide trigonal
        return [[0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];            // AX5E pirámide cuadrada
      case 6: return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]; // octaedro
      default: throw new Error('VSEPR: número de ligandos no soportado: ' + X);
    }
  }

  const NOMBRES = {
    '1': ['diatómica (lineal)', 'diatomique (linéaire)'],
    '2,0': ['lineal', 'linéaire'], '2,1': ['angular (trigonal plana con un par libre)', 'coudée'],
    '2,2': ['angular', 'coudée'], '2,3': ['lineal', 'linéaire'],
    '3,0': ['trigonal plana', 'trigonale plane'], '3,1': ['piramidal trigonal', 'pyramidale à base triangulaire'],
    '3,2': ['en forma de T', 'en forme de T'],
    '4,0': ['tetraédrica', 'tétraédrique'], '4,1': ['balancín (tetraedro distorsionado)', 'en bascule'], '4,2': ['plana cuadrada', 'plan carré'],
    '5,0': ['bipirámide trigonal', 'bipyramide à base triangulaire'], '5,1': ['pirámide cuadrada', 'pyramide à base carrée'],
    '6,0': ['octaédrica', 'octaédrique'],
  };
  /** Notación AXE: 'AX2E2' */
  const axeTxt = (X, E) => 'AX' + (X > 1 ? X : '') + (E ? 'E' + (E > 1 ? E : '') : '');
  function nombreGeometria(X, E) {
    const n = X <= 1 ? NOMBRES['1'] : NOMBRES[X + ',' + (E || 0)] || ['—', '—'];
    return { es: n[0], fr: n[1], axe: axeTxt(X, E || 0) };
  }
  const parseAXE = (s) => { const m = /^AX(\d*)(?:E(\d*))?$/.exec(s); if (!m) throw new Error('AXE no válido: ' + s); return { X: m[1] === '' ? 1 : +m[1], E: m[2] === undefined ? 0 : (m[2] === '' ? 1 : +m[2]) }; };

  // ---------- longitudes de enlace estándar (Å) ----------
  const L1 = { 'H-H': 0.74, 'C-H': 1.09, 'N-H': 1.01, 'O-H': 0.96, 'S-H': 1.34, 'P-H': 1.42, 'Cl-H': 1.27, 'F-H': 0.92, 'B-H': 1.19, 'Br-H': 1.41, 'I-H': 1.61,
    'C-C': 1.54, 'C-N': 1.47, 'C-O': 1.43, 'C-S': 1.82, 'C-Cl': 1.77, 'C-F': 1.35, 'C-Br': 1.94, 'N-N': 1.45, 'N-O': 1.40, 'O-O': 1.48, 'O-S': 1.58, 'O-P': 1.60,
    'Cl-S': 2.07, 'Cl-P': 2.04, 'B-F': 1.31, 'F-S': 1.56, 'Cl-F': 1.63, 'F-Xe': 1.98, 'Cl-N': 1.75, 'Cl-O': 1.70, 'F-P': 1.57, 'F-N': 1.36, 'F-Br': 1.76, 'Cl-Cl': 1.99, 'O-Xe': 1.75 };
  const L2 = { 'C-C': 1.34, 'C-O': 1.21, 'C-N': 1.28, 'N-O': 1.21, 'O-S': 1.43, 'O-P': 1.48, 'O-O': 1.21, 'N-N': 1.25, 'C-S': 1.60, 'N-S': 1.55, 'O-Xe': 1.75 };
  const L3 = { 'C-C': 1.20, 'C-N': 1.16, 'N-N': 1.10, 'C-O': 1.13 };
  const L15 = { 'C-C': 1.40, 'C-O': 1.26, 'C-N': 1.34, 'N-O': 1.25, 'O-S': 1.47, 'O-P': 1.53 };
  const clave = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
  /** Longitud de enlace (Å) entre elementos a y b con orden 1, 1.5, 2 o 3 */
  function longitud(a, b, orden) {
    const k = clave(a, b), o = orden || 1;
    const t = o === 3 ? L3 : o === 2 ? L2 : o === 1.5 ? L15 : L1;
    if (t[k]) return t[k];
    if (o === 1.5 && L1[k] && L2[k]) return (L1[k] + L2[k]) / 2;
    const base = L1[k] || (D.el(a).rc + D.el(b).rc);
    return base * (1 - 0.09 * (Math.round(o * 2) / 2 - 1));
  }

  // ---------- fórmulas con subíndices ----------
  const SUB = '₀₁₂₃₄₅₆₇₈₉', SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };
  /** 'CH3CO2H' -> 'CH₃CO₂H'; 'SO4^2-' -> 'SO₄²⁻'; 'H3O+' -> 'H₃O⁺' */
  function formula(t) {
    let out = '', i = 0;
    while (i < t.length) {
      const c = t[i];
      if (c === '^') { i++; while (i < t.length && /[0-9+\-]/.test(t[i])) out += SUP[t[i++]]; continue; }
      if ((c === '+' || c === '-') ) { out += SUP[c]; i++; continue; }
      if (/[0-9]/.test(c)) { const prev = out.slice(-1); out += (/[A-Za-z)]/.test(prev) || SUB.includes(prev) ? SUB[+c] : c); i++; continue; }
      out += c; i++;
    }
    return out;
  }

  // ---------- ángulos de referencia cuando hay pares libres (datos estándar) ----------
  function anguloLigandos(a, g) {
    // a: átomo {el, X, E, vec:[índices de vecinos]} · g: grafo
    const els = a.vec.map((j) => g.atomos[j].el), nH = els.filter((e) => e === 'H').length;
    const X = a.vec.length, E = a.E;
    if (X === 2 && E === 1) return a.el === 'S' && els.every((e) => e === 'O') ? 119 : (a.el === 'N' ? 115 : 117);
    if (X === 2 && E === 2) {
      if (a.el === 'S' || a.el === 'Se') return nH === 2 ? 92 : 99;
      if (a.el === 'O') return nH === 2 ? 104.5 : nH === 1 ? 108.5 : 111;
      return 104.5;
    }
    if (X === 3 && E === 1) {
      if (a.el === 'N') return 107;
      if (a.el === 'P') return nH === 3 ? 93.5 : 100;
      return 106;
    }
    return undefined;
  }

  // ---------- SMILES simplificado ----------
  // Admite: átomos del subconjunto orgánico (B C N O P S F Cl Br I), aromáticos en minúscula (c n o s),
  // átomos entre corchetes [OH3+] [NH4+] [O-] [H] [Xe], enlaces - = # y ~ (orden 1,5: carboxilatos, benceno),
  // ramas ( ), cierres de anillo (dígitos). Los H implícitos se añaden como átomos reales.
  const VALENCIAS = { B: [3], C: [4], N: [3, 5], O: [2], P: [3, 5], S: [2, 4, 6], F: [1], Cl: [1, 3, 5, 7], Br: [1, 3, 5, 7], I: [1, 3, 5, 7] };
  function parseSMILES(smi) {
    const atomos = [], bonds = []; // atomos:{el,q,aro,nH|null}, bonds:{a,b,o}
    const pila = []; let prev = -1, orden = null; const anillos = {};
    let i = 0;
    const nuevo = (at) => {
      const id = atomos.length; atomos.push(at);
      if (prev >= 0) {
        let o = orden;
        if (o == null) o = atomos[prev].aro && at.aro ? 1.5 : 1;
        bonds.push({ a: prev, b: id, o });
      }
      orden = null; prev = id;
    };
    while (i < smi.length) {
      const c = smi[i];
      if (c === '[') {
        const j = smi.indexOf(']', i), s = smi.slice(i + 1, j);
        const m = /^(\d*)([A-Z][a-z]?|[a-z])(?:H(\d*))?([+-]+|[+-]\d)?$/.exec(s);
        if (!m) throw new Error('SMILES: átomo no válido [' + s + ']');
        let q = 0; if (m[4]) q = /^[+-]\d$/.test(m[4]) ? (m[4][0] === '+' ? 1 : -1) * +m[4][1] : (m[4][0] === '+' ? 1 : -1) * m[4].length;
        const aro = /^[a-z]$/.test(m[2]);
        nuevo({ el: aro ? m[2].toUpperCase() : m[2], q, aro, nH: m[3] === undefined ? 0 : (m[3] === '' ? 1 : +m[3]) });
        i = j + 1;
      } else if (/[A-Z]/.test(c)) {
        const dos = smi.substr(i, 2);
        if (dos === 'Cl' || dos === 'Br') { nuevo({ el: dos, q: 0, aro: false, nH: null }); i += 2; } else { nuevo({ el: c, q: 0, aro: false, nH: null }); i++; }
      } else if (/[a-z]/.test(c)) { nuevo({ el: c.toUpperCase(), q: 0, aro: true, nH: null }); i++; }
      else if (c === '(') { pila.push(prev); i++; }
      else if (c === ')') { prev = pila.pop(); i++; }
      else if (c === '-') { orden = 1; i++; } else if (c === '=') { orden = 2; i++; } else if (c === '#') { orden = 3; i++; } else if (c === '~') { orden = 1.5; i++; }
      else if (/[0-9]/.test(c)) {
        if (anillos[c] != null) { const a = anillos[c]; let o = orden; if (o == null) o = atomos[a].aro && atomos[prev].aro ? 1.5 : 1; bonds.push({ a, b: prev, o }); delete anillos[c]; orden = null; }
        else anillos[c] = prev;
        i++;
      } else throw new Error('SMILES: carácter no válido «' + c + '» en ' + smi);
    }
    return { atomos, bonds };
  }

  /** Convierte el SMILES en grafo completo: añade H implícitos, calcula pares libres E de cada átomo */
  function grafoDe(smi) {
    const p = parseSMILES(smi);
    const nHeavy = p.atomos.length;
    const suma = new Array(nHeavy).fill(0);
    p.bonds.forEach((b) => { suma[b.a] += b.o; suma[b.b] += b.o; });
    const atomos = p.atomos.map((a) => ({ el: a.el, q: a.q, aro: a.aro, vec: [], ord: [], E: 0 }));
    const bonds = p.bonds.slice();
    p.atomos.forEach((a, i) => {
      let nH = a.nH;
      if (nH == null) {
        const vs = VALENCIAS[a.el] || [4], s = Math.ceil(suma[i] - 1e-9);
        const v = vs.find((x) => x >= s);
        nH = v == null ? 0 : v - s;
      }
      for (let k = 0; k < nH; k++) { atomos.push({ el: 'H', q: 0, aro: false, vec: [], ord: [], E: 0 }); bonds.push({ a: i, b: atomos.length - 1, o: 1 }); }
    });
    bonds.forEach((b) => { atomos[b.a].vec.push(b.b); atomos[b.a].ord.push(b.o); atomos[b.b].vec.push(b.a); atomos[b.b].ord.push(b.o); });
    atomos.forEach((a) => {
      const s = a.ord.reduce((x, y) => x + y, 0);
      a.E = Math.max(0, Math.round((D.el(a.el).ve - a.q - s) / 2));
      // los átomos de hidrógeno: sin pares libres; los metales sueltos tampoco
      if (a.el === 'H') a.E = 0;
    });
    return { atomos, bonds, nHeavy };
  }

  // ---------- construcción 3D ----------
  function construir(grafo, opt) {
    opt = opt || {};
    const g = grafo, n = g.atomos.length, pos = new Array(n).fill(null), padre = new Array(n).fill(-1);
    const ordenEntre = (i, j) => g.atomos[i].ord[g.atomos[i].vec.indexOf(j)];
    const dist = (i, j) => longitud(g.atomos[i].el, g.atomos[j].el, ordenEntre(i, j));
    const esH = (i) => g.atomos[i].el === 'H';

    // 1) anillos: DFS con detección de aristas de retroceso (solo anillos simples y disjuntos)
    const anillos = [];
    { const col = new Array(n).fill(0), pa = new Array(n).fill(-1);
      const dfs = (u) => {
        col[u] = 1;
        for (const v of g.atomos[u].vec) {
          if (v === pa[u]) continue;
          if (col[v] === 0) { pa[v] = u; dfs(v); }
          else if (col[v] === 1) { const c = [u]; let x = u; while (x !== v) { x = pa[x]; c.push(x); } anillos.push(c.reverse()); }
        }
        col[u] = 2;
      };
      for (let u = 0; u < n; u++) if (col[u] === 0 && !esH(u)) dfs(u);
    }
    if (anillos.length > 1) throw new Error('Solo se admite un anillo por molécula');
    const enAnillo = new Set(anillos[0] || []);
    const tamPlan = (a) => ({ ...a }); // (marcador)

    // 2) vecinos «pesados primero» para repartir ligandos en la plantilla
    const hijosDe = (i) => g.atomos[i].vec.filter((j) => pos[j] == null).sort((a, b) => (esH(a) - esH(b)) || a - b);
    const plantillaDe = (i) => { const a = g.atomos[i]; return plantilla(a.vec.length, a.E, anguloLigandos({ el: a.el, vec: a.vec, E: a.E }, g)); };

    const cola = [];
    if (anillos.length) {
      const anillo = anillos[0], k = anillo.length;
      const bl = anillo.reduce((s, a, idx) => s + dist(a, anillo[(idx + 1) % k]), 0) / k;
      const silla = opt.silla != null ? opt.silla : (k === 6 && anillo.every((a) => g.atomos[a].vec.length + g.atomos[a].E === 4));
      const h = 0.25, r = silla ? Math.sqrt(bl * bl - 4 * h * h) : bl / (2 * Math.sin(Math.PI / k));
      anillo.forEach((a, idx) => { const t = -2 * Math.PI * idx / k; pos[a] = [r * Math.cos(t), r * Math.sin(t), silla ? (idx % 2 ? h : -h) : 0]; });
      anillo.forEach((a) => cola.push(a));
      anillo.forEach((a, idx) => { padre[a] = -2; });
    } else {
      // raíz: el átomo pesado con más vecinos (el centro de la molécula)
      let raiz = 0, mejor = -1;
      for (let i = 0; i < n; i++) if (!esH(i) && g.atomos[i].vec.length > mejor) { mejor = g.atomos[i].vec.length; raiz = i; }
      pos[raiz] = [0, 0, 0]; padre[raiz] = -1;
      const T = plantillaDe(raiz), hs = hijosDe(raiz);
      hs.forEach((j, idx) => { pos[j] = mul(T[idx] || [0, 0, 1], dist(raiz, j)); padre[j] = raiz; cola.push(j); });
    }

    // 3) recorrido en anchura: cada átomo coloca a sus vecinos pendientes
    while (cola.length) {
      const A = cola.shift(), a = g.atomos[A];
      const hs = hijosDe(A);
      if (!hs.length) continue;
      const conocidos = a.vec.filter((j) => pos[j] != null);
      if (conocidos.length === 1 || (conocidos.length === 0)) {
        const P = conocidos[0];
        const T0 = plantillaDe(A);
        const eje = unit(sub(pos[P], pos[A]));
        const R1 = alinear(T0[0], eje);
        let T = T0.map(R1);
        // diedro: el primer hijo queda «anti» respecto a un vecino de P (conformación alternada / plana)
        const G = a.vec.length > 1 && padre[P] >= 0 ? padre[P] : g.atomos[P].vec.filter((j) => j !== A && pos[j] != null).sort((x, y) => (esH(x) - esH(y)) || x - y)[0];
        if (G != null && T.length > 1) {
          const gp = perp(sub(pos[G], pos[P]), eje), cp = perp(T[1], eje);
          if (len(gp) > 1e-6 && len(cp) > 1e-6) {
            const th = Math.atan2(dot(eje, cross(gp, cp)), dot(gp, cp));
            const deseado = (opt.diedros && opt.diedros[A] != null ? opt.diedros[A] : 180) * RAD;
            T = T.map((v) => rotar(v, eje, deseado - th));
          }
        }
        hs.forEach((j, idx) => { pos[j] = add(pos[A], mul(T[idx + 1] || T[T.length - 1], dist(A, j))); padre[j] = A; cola.push(j); });
      } else if (conocidos.length >= 2) {
        // átomo de anillo: ya tiene 2 vecinos; los sustituyentes salen en el plano perpendicular al anillo
        const u1 = unit(sub(pos[conocidos[0]], pos[A])), u2 = unit(sub(pos[conocidos[1]], pos[A]));
        const bis = unit(add(u1, u2)), nrm = unit(cross(u1, u2));
        if (hs.length === 1) {
          const tilt = (a.vec.length + a.E === 4 && a.vec.length === 3) ? 0.35 : 0;
          const s = unit(add(mul(bis, -1), mul(nrm, tilt)));
          pos[hs[0]] = add(pos[A], mul(s, dist(A, hs[0]))); padre[hs[0]] = A; cola.push(hs[0]);
        } else {
          const ph = (109.47 / 2) * RAD, base = mul(bis, -1);
          const sp = add(mul(base, Math.cos(ph)), mul(nrm, Math.sin(ph))), sm = add(mul(base, Math.cos(ph)), mul(nrm, -Math.sin(ph)));
          // el sustituyente pesado va en la posición ecuatorial (silla) o «hacia arriba» (anillo plano)
          const ecu = Math.abs(sp[2]) < Math.abs(sm[2]) - 1e-6 ? sp : Math.abs(sm[2]) < Math.abs(sp[2]) - 1e-6 ? sm : (sp[2] >= sm[2] ? sp : sm);
          const otro = ecu === sp ? sm : sp;
          const dirs = [ecu, otro];
          hs.forEach((j, idx) => { pos[j] = add(pos[A], mul(unit(dirs[idx] || dirs[1]), dist(A, j))); padre[j] = A; cola.push(j); });
        }
      }
    }
    // 4) centrar en el centroide
    const c = pos.reduce((s, p) => add(s, p), [0, 0, 0]).map((x) => x / n);
    return pos.map((p) => sub(p, c));
  }

  /** Une grafo + posiciones en una «molécula 3D» con la información VSEPR de cada centro */
  function empaquetar(g, pos) {
    const atomos = g.atomos.map((a, i) => ({ el: a.el, x: +pos[i][0].toFixed(4), y: +pos[i][1].toFixed(4), z: +pos[i][2].toFixed(4), carga: a.q || 0 }));
    const enlaces = g.bonds.map((b) => ({ a: b.a, b: b.b, orden: b.o }));
    const mol = { atomos, enlaces, centros: [] };
    g.atomos.forEach((a, i) => {
      if (a.vec.length < 2 && !(a.vec.length === 1 && false)) return;
      const nm = nombreGeometria(a.vec.length, a.E), angs = [];
      for (let p = 0; p < a.vec.length; p++) for (let q = p + 1; q < a.vec.length; q++) angs.push({ i: a.vec[p], j: i, k: a.vec[q], deg: angulo(mol, a.vec[p], i, a.vec[q]) });
      mol.centros.push({ i, el: a.el, X: a.vec.length, E: a.E, axe: nm.axe, geometria: nm.es, geometriaFr: nm.fr, angulos: angs });
    });
    return mol;
  }

  /** Principal centro VSEPR (el de más vecinos; en empate, el primero) y resumen */
  function resumir(mol) {
    const c = mol.centros.slice().sort((a, b) => b.X - a.X)[0];
    if (!c) { mol.axe = 'AX'; mol.geometria = 'diatómica (lineal)'; mol.geometriaFr = 'diatomique (linéaire)'; return mol; }
    mol.axe = c.axe; mol.geometria = c.geometria; mol.geometriaFr = c.geometriaFr; mol.centro = c.i;
    return mol;
  }

  function angulo(mol, i, j, k) {
    const a = mol.atomos, u = [a[i].x - a[j].x, a[i].y - a[j].y, a[i].z - a[j].z], v = [a[k].x - a[j].x, a[k].y - a[j].y, a[k].z - a[j].z];
    return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (len(u) * len(v))))) * DEG;
  }
  const distancia = (mol, i, j) => { const a = mol.atomos; return Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y, a[i].z - a[j].z); };

  /** Molécula 3D desde SMILES: opt {silla, diedros:{índiceÁtomo:grados}} */
  function desdeSMILES(smi, opt) {
    const g = grafoDe(smi);
    const mol = empaquetar(g, construir(g, opt));
    return resumir(mol);
  }

  /** Molécula de un solo centro por notación AXE, p. ej. porAXE('AX3E',{central:'N',ligando:'H'}) */
  function porAXE(axe, opt) {
    opt = opt || {};
    const { X, E } = parseAXE(axe), cen = opt.central || 'X', lig = opt.ligando || 'F';
    const T = plantilla(X, E, opt.angulo), l = longitud(cen, lig, 1);
    const atomos = [{ el: cen, x: 0, y: 0, z: 0, carga: 0 }].concat(T.map((v) => ({ el: lig, x: v[0] * l, y: v[1] * l, z: v[2] * l, carga: 0 })));
    const enlaces = T.map((v, i) => ({ a: 0, b: i + 1, orden: 1 }));
    const mol = { atomos, enlaces, centros: [] };
    const nm = nombreGeometria(X, E), angs = [];
    for (let p = 1; p <= X; p++) for (let q = p + 1; q <= X; q++) angs.push({ i: p, j: 0, k: q, deg: angulo(mol, p, 0, q) });
    mol.centros.push({ i: 0, el: cen, X, E, axe: nm.axe, geometria: nm.es, geometriaFr: nm.fr, angulos: angs });
    return resumir(mol);
  }

  M.vsepr = { plantilla, nombreGeometria, porAXE, desdeSMILES, grafoDe, construir, empaquetar, angulo, distancia, formula, longitud, parseAXE, axeTxt };
})();
