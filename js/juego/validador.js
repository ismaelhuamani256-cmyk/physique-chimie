// =====================================================================================
// validador.js — constantes de física, geometría del nivel y VALIDADOR DE JUGABILIDAD
//
// Funciona en el navegador (PCB.juego.validar) y en Node:
//     node js/juego/validador.js contenido/niveles/x.json [otro.json ...]
//
// Es la ÚNICA fuente de verdad de la física (FIS) y de la construcción de tiles (geometria):
// el motor (40-mundo.js, 70-juego.js) las lee de aquí en tiempo de ejecución.
// Sistema de coordenadas y límites de salto: ver js/juego/README.md
// =====================================================================================
(function (root) {
  'use strict';
  const PCB = (root.PCB = root.PCB || {});
  const J = (PCB.juego = PCB.juego || {});

  // ---------- constantes de física (unidades: tiles y segundos) ----------
  const FIS = {
    G0: 20.57,          // gravedad con gravedad=1 (tiles/s²). Con salto=12 da altura = 12²/(2·20.57) = 3.50 tiles
    VMAX: 5.5,          // velocidad horizontal máxima (tiles/s) -> distancia plana = VMAX·(2·12/20.57) = 6.4 tiles
    ACC_SUELO: 55,      // aceleración en suelo (tiles/s²)
    ACC_AIRE: 34,       // aceleración en el aire
    GIRO: 2.2,          // multiplicador de aceleración al invertir el sentido
    CAIDA_MAX: 17,      // velocidad máxima de caída
    CORTE_SALTO: 0.45,  // al soltar el salto, vy se multiplica por esto (salto variable)
    COYOTE: 0.1,        // s de gracia para saltar tras dejar el borde
    BUFFER: 0.1,        // s que se recuerda un salto pulsado antes de tocar suelo
    RESORTE: 1.45,      // el resorte lanza a salto·1.45 (≈ 7.4 tiles de altura)
    W: 0.7, H: 0.9,     // hitbox del jugador (tiles)
    SUELO_PROF: 6,      // una plataforma con y >= alto_tiles-6 es "suelo" y se extiende hasta abajo
    MARGEN_ALTURA: 0.35, // el validador exige 0.35 tiles menos que el salto teórico
    MARGEN_GAP: 0.4,    // y 0.4 tiles menos de distancia horizontal
  };

  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  /** Valores derivados de fisica_juego: gravedad, impulso, alturas y distancias máximas. */
  function fisica(nivel) {
    const f = (nivel && nivel.fisica_juego) || {};
    const gravedad = num(f.gravedad, 1), salto = num(f.salto, 12);
    const g = FIS.G0 * gravedad, v0 = salto;
    const hMax = (v0 * v0) / (2 * g);
    const vR = v0 * FIS.RESORTE;
    return {
      gravedad, salto, g, v0, vmax: FIS.VMAX,
      friccion: num(f.friccion, 0.85), viento: num(f.viento, 0),
      hMax, hSeguro: hMax - FIS.MARGEN_ALTURA,
      tVuelo: (2 * v0) / g, distMax: FIS.VMAX * (2 * v0) / g,
      gapSeguro: FIS.VMAX * (2 * v0) / g - FIS.MARGEN_GAP,
      vResorte: vR, hResorte: (vR * vR) / (2 * g),
    };
  }

  /** Mayor hueco horizontal (borde a borde) salvable al saltar a una plataforma dy tiles más alta (dy<0: más baja). */
  function gapMax(F, dy, factorG, resorte) {
    const g = F.g * factorG, v = resorte ? F.vResorte : F.v0;
    const disc = v * v - 2 * g * dy;
    if (disc < 0) return -1;
    const t = (v + Math.sqrt(disc)) / g;
    return Math.max(0, F.vmax * t - FIS.MARGEN_GAP - 0.7 * Math.abs(F.viento));
  }
  /** Altura máxima segura (tiles) de un salto normal o de resorte con gravedad escalada. */
  function alturaSegura(F, factorG, resorte) {
    const v = resorte ? F.vResorte : F.v0;
    return (v * v) / (2 * F.g * factorG) - FIS.MARGEN_ALTURA;
  }

  // ---------- geometría: del JSON a una rejilla de tiles ----------
  // Tipos de tile: 0 aire, 1 suelo (se extiende hasta abajo, lo cortan los fosos), 2 plataforma flotante
  // (de un solo sentido: se atraviesa desde abajo), 3 puente, 4 bloque sólido.
  // 5 = bloque ? (bloque_pregunta), 6 = tubería, 7 = puerta, 8 = ladrillo, 9 = cinta, 10 = bloque_rebote: sólidos que dibuja el motor como entidades
  const SOLIDO = (t) => t === 1 || t === 3 || t === 4 || t === 5 || t === 6 || t === 7 || t === 8 || t === 9 || t === 10;
  const SUELO_T = (t) => t === 1 || t === 2 || t === 3 || t === 4 || t === 9 || t === 10;   // lo que cuenta como "suelo" para topAt
  const JEFES_QUIZ = ['rey_entropia', 'golem_formulas', 'pulpo_acido', 'dragon_tormenta'];
  const ACUATICOS = ['medusa', 'pez', 'erizo', 'anguila'];

  // ---------- química: fórmulas con cargas, conservación de átomos y de carga ----------
  const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', '−': '-', '–': '-' };
  const Quimica = {
    /** "H3O+", "HO⁻", "CO3^2-", "SO4 2-", "NH₄⁺(aq)", "(NH4)3PO4" -> {atomos:{H:3,O:1}, carga:1}. null si no se entiende. */
    parsear(f) {
      if (String(f).indexOf(',') >= 0) {   // "CO2(aq),H2O(ℓ)": especie compuesta del cours = suma de sus partes
        const ps = String(f).split(',').map((q) => Quimica.parsear(q));
        if (ps.some((q) => !q)) return null;
        const a = {}; let c = 0; ps.forEach((q) => { for (const e in q.atomos) a[e] = (a[e] || 0) + q.atomos[e]; c += q.carga; });
        return { atomos: a, carga: c };
      }
      let t = String(f == null ? '' : f).trim();
      t = t.replace(/\((aq|ℓ|l|g|s)\)/g, '').replace(/[₀-₉⁰-⁹⁺⁻−–]/g, (c) => (SUB[c] != null ? SUB[c] : SUP[c])).replace(/\s+/g, '');
      if (!t) return null;
      let carga = 0;
      // carga: explícita con ^ ("CO3^2-", "O^2-") o implícita al final ("NH4+", "HO-", "SO42-", "Fe2+")
      let m = /^(.+?)\^(\d*)([+-])$/.exec(t);
      if (m) { carga = (m[3] === '+' ? 1 : -1) * (m[2] ? parseInt(m[2], 10) : 1); t = m[1]; }
      else if ((m = /^(.+)([+-])$/.exec(t))) {
        let body = m[1], mag = 1;
        const d = /(\d+)$/.exec(body);
        if (d) {
          if (d[1].length >= 2) { mag = parseInt(d[1].slice(-1), 10); body = body.slice(0, -1); }          // SO42- -> SO4 2-
          else if (/[a-z]$/.test(body.slice(0, -1))) { mag = parseInt(d[1], 10); body = body.slice(0, -1); } // Fe2+, Ca2+, Al3+
        }
        carga = (m[2] === '+' ? 1 : -1) * mag; t = body;
      }
      let i = 0;
      const num = () => { let n = ''; while (i < t.length && /\d/.test(t[i])) n += t[i++]; return n ? parseInt(n, 10) : 1; };
      const grupo = () => {
        const cnt = {};
        while (i < t.length && t[i] !== ')') {
          if (t[i] === '(') { i++; const g = grupo(); if (t[i] !== ')') throw new Error('paréntesis'); i++; const k = num(); for (const e in g) cnt[e] = (cnt[e] || 0) + g[e] * k; }
          else if (/[A-Z]/.test(t[i])) { let e = t[i++]; if (i < t.length && /[a-z]/.test(t[i])) e += t[i++]; const k = num(); cnt[e] = (cnt[e] || 0) + k; }
          else throw new Error('carácter ' + t[i]);
        }
        return cnt;
      };
      try { const a = grupo(); if (i < t.length) return null; return { atomos: a, carga }; } catch (e) { return null; }
    },
    /** Quita especies repetidas de un lado (H2O + H2O -> una sola especie con coeficiente 2). */
    normalizar(eq) {
      const u = (l) => (l || []).filter((f, i, a) => a.indexOf(f) === i);
      return { reactivos: u(eq.reactivos), productos: u(eq.productos) };
    },
    /** Cuenta átomos y carga a cada lado con los coeficientes dados. */
    verificar(eq0, coef) {
      const eq = Quimica.normalizar(eq0);
      const lado = (lista, off) => {
        const a = {}; let q = 0;
        lista.forEach((f, k) => { const p = Quimica.parsear(f), c = coef[off + k] | 0; if (!p) return; for (const e in p.atomos) a[e] = (a[e] || 0) + p.atomos[e] * c; q += p.carga * c; });
        return { a, q };
      };
      const L = lado(eq.reactivos, 0), R = lado(eq.productos, eq.reactivos.length);
      const els = [...new Set([...Object.keys(L.a), ...Object.keys(R.a)])].sort();
      const atomos = {}; let ok = coef.every((c) => c >= 1);
      els.forEach((e) => { atomos[e] = [L.a[e] || 0, R.a[e] || 0]; if (atomos[e][0] !== atomos[e][1]) ok = false; });
      if (L.q !== R.q) ok = false;
      const gcd = (a, b) => (b ? gcd(b, a % b) : a), g = coef.reduce((a, b) => gcd(a, b), 0);
      return { ok, atomos, carga: [L.q, R.q], simplificada: g === 1 };
    },
    /** Coeficientes enteros mínimos que equilibran la ecuación (átomos y carga), o null si no existen. */
    resolver(eq0) {
      const eq = Quimica.normalizar(eq0);
      const esp = [...eq.reactivos, ...eq.productos].map((f) => Quimica.parsear(f));
      if (esp.some((x) => !x)) return null;
      const els = [...new Set(esp.flatMap((x) => Object.keys(x.atomos)))];
      const n = esp.length, filas = els.map((e) => esp.map((x, j) => (x.atomos[e] || 0) * (j < eq.reactivos.length ? 1 : -1)));
      filas.push(esp.map((x, j) => x.carga * (j < eq.reactivos.length ? 1 : -1)));
      // eliminación gaussiana con fracciones (numerador/denominador enteros pequeños)
      const M = filas.map((r) => r.map((v) => [v, 1]));
      const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
      const red = (f) => { const g = gcd(f[0], f[1]); const s = f[1] < 0 ? -1 : 1; return [(s * f[0]) / g, (s * f[1]) / g]; };
      const mul = (a, b) => red([a[0] * b[0], a[1] * b[1]]), sub = (a, b) => red([a[0] * b[1] - b[0] * a[1], a[1] * b[1]]), div = (a, b) => red([a[0] * b[1], a[1] * b[0]]);
      let fila = 0; const pivotes = [];
      for (let c = 0; c < n && fila < M.length; c++) {
        let p = -1; for (let r = fila; r < M.length; r++) if (M[r][c][0] !== 0) { p = r; break; }
        if (p < 0) continue;
        [M[fila], M[p]] = [M[p], M[fila]];
        const pv = M[fila][c]; M[fila] = M[fila].map((v) => div(v, pv));
        for (let r = 0; r < M.length; r++) if (r !== fila && M[r][c][0] !== 0) { const f = M[r][c]; M[r] = M[r].map((v, k) => sub(v, mul(f, M[fila][k]))); }
        pivotes.push(c); fila++;
      }
      const libres = []; for (let c = 0; c < n; c++) if (!pivotes.includes(c)) libres.push(c);
      if (libres.length !== 1) return null;
      const x = Array(n).fill(null).map(() => [0, 1]); x[libres[0]] = [1, 1];
      pivotes.forEach((c, r) => { x[c] = red([-M[r][libres[0]][0], M[r][libres[0]][1]]); });
      let mcm = 1; x.forEach((f) => { mcm = (mcm * f[1]) / gcd(mcm, f[1]); });
      let ent = x.map((f) => (f[0] * mcm) / f[1]);
      if (ent.every((v) => v <= 0)) ent = ent.map((v) => -v);
      if (!ent.every((v) => v > 0 && Number.isInteger(v))) return null;
      const g = ent.reduce((a, b) => gcd(a, b), 0); return ent.map((v) => v / g);
    },
    /** Fórmula → cuenta de átomos por elemento (sin carga): {H:2,O:1} */
    atomosDe(f) { const p = Quimica.parsear(f); return p ? p.atomos : null; },
    /** Geometría VSEPR del cours (nombre) para las moléculas/iones más comunes. */
    GEOMETRIA: { H2O: 'angular', NH3: 'pirámide trigonal', 'H3O+': 'pirámide trigonal', 'NH4+': 'tetraédrica', CH4: 'tetraédrica', CO2: 'lineal', HCl: 'lineal', 'HO-': 'lineal (diatómico)', H2: 'lineal (diatómico)' },
  };
  const ELEMENTOS = ['H', 'C', 'N', 'O', 'F', 'Cl', 'Na', 'S', 'P', 'Li', 'K', 'Ca', 'Mg', 'Br', 'I', 'Al', 'Fe', 'Cu'];

  function geometria(nivel, opts) {
    const ancho = Math.round(num(nivel.ancho_tiles, 0)), alto = Math.round(num(nivel.alto_tiles, 0));
    const segs = Array.isArray(nivel.segmentos) ? nivel.segmentos : [];
    const tiles = new Uint8Array(Math.max(0, ancho * alto));
    const G = { ancho, alto, tiles, movers: [], resortes: [], campos: [], fosos: [], puentes: [], palancas: [], bloques: [], tuberias: [], puertas: [], aguas: [], ladrillos: [], caes: [], plantas: [], minas: [], prensas: [], pendulos: [], cintas: [], picos: [], rebotes: [], sprints: [], rastros: [], carteles: [], atomos: [], estaciones: [], interruptores: [], platEstado: [], arena: null, meta: null, jefe: null };
    const get = (x, y) => (x < 0 || x >= ancho || y < 0 || y >= alto ? 0 : tiles[y * ancho + x]);
    const set = (x, y, v) => { if (x >= 0 && x < ancho && y >= 0 && y < alto) tiles[y * ancho + x] = v; };
    G.get = get;
    G.topAt = (x) => { for (let y = 0; y < alto; y++) if (SUELO_T(get(x, y))) return y; return -1; };
    /** Fila del primer suelo desde y hacia abajo (base de tuberías/puertas/resortes). */
    G.baseDesde = (x, y) => { for (let yy = Math.max(0, y); yy < alto; yy++) if (SUELO_T(get(x, yy))) return yy; return -1; };

    // 1) plataformas
    for (const s of segs) {
      if (s.tipo !== 'plataforma') continue;
      const x = Math.round(num(s.x, 0)), y = Math.round(num(s.y, 0)), l = Math.max(0, Math.round(num(s.largo, 0)));
      const suelo = s.solido === true || (s.grosor == null && s.solido !== false && y >= alto - FIS.SUELO_PROF);
      for (let i = 0; i < l; i++) {
        if (suelo) for (let yy = y; yy < alto; yy++) set(x + i, yy, 1);
        else if (s.grosor != null) for (let k = 0; k < Math.max(1, Math.round(s.grosor)); k++) set(x + i, y + k, 4);
        else set(x + i, y, 2);
      }
    }
    // 2) fosos: cortan el suelo
    for (const s of segs) {
      if (s.tipo !== 'foso') continue;
      const x = Math.round(num(s.x, 0)), l = Math.max(0, Math.round(num(s.largo, 0)));
      G.fosos.push({ x, largo: l });
      for (let i = 0; i < l; i++) for (let yy = 0; yy < alto; yy++) if (get(x + i, yy) === 1) set(x + i, yy, 0);
    }
    // 3) puentes (plataforma sólida de 1 tile sobre lava; pueden caer) y objetos
    for (const s of segs) {
      if (s.tipo !== 'puente') continue;
      const x = Math.round(num(s.x, 0)), y = Math.round(num(s.y, 0)), l = Math.max(0, Math.round(num(s.largo, 0)));
      if (!s.oculto || (opts && opts.revelar)) for (let i = 0; i < l; i++) { for (let yy = y; yy < alto; yy++) set(x + i, yy, 0); set(x + i, y, 3); }   // oculto:true -> aparece con una estacion_molecula
      G.puentes.push({ id: s.id || null, x, y, largo: l, caeCon: s.cae_con || null, oculto: !!s.oculto, seg: s });
    }
    for (const s of segs) {
      if (s.tipo === 'plataforma_movil') {
        G.movers.push({ x: num(s.x, 0), y: num(s.y, 0), largo: Math.max(1, Math.round(num(s.largo, 3))), rec: num(s.recorrido, 4),
          eje: s.eje === 'y' ? 'y' : 'x', per: Math.max(0.5, num(s.periodo, 3)), seg: s });
      } else if (s.tipo === 'resorte') G.resortes.push({ x: Math.round(num(s.x, 0)), y: Math.round(num(s.y, 0)), seg: s });
      else if (s.tipo === 'zona_campo') G.campos.push({ x: num(s.x, 0), y: num(s.y, 0), w: num(s.w, 1), h: num(s.h, 1), fx: num(s.fx, 0), fy: num(s.fy, 0), seg: s });
      else if (s.tipo === 'palanca') G.palancas.push({ id: s.id || null, x: num(s.x, 0), y: num(s.y, 0), objetivo: s.objetivo || null, seg: s })
      else if (s.tipo === 'meta' && !G.meta) G.meta = { x: Math.round(num(s.x, 0)), seg: s };
      else if ((s.tipo === 'jefe' || s.tipo === 'jefe_quiz') && !G.jefe) G.jefe = { x: Math.round(num(s.x, 0)), seg: s };
      else if (s.tipo === 'ladrillo') {
        const x0 = Math.round(num(s.x, 0)), y = Math.round(num(s.y, 0)), l = Math.max(1, Math.round(num(s.largo, 1)));
        for (let i = 0; i < l; i++) {
          if (s.contenido === 'pregunta') {   // un ladrillo con pregunta es un bloque_pregunta con aspecto de ladrillo
            G.bloques.push({ x: x0 + i, y, deLadrillo: true, seg: { tipo: 'bloque_pregunta', x: x0 + i, y, pregunta: s.pregunta, premio: s.premio || 'moneda', fallo: s.fallo || 'cierra', preguntas_reserva: s.preguntas_reserva } });
            set(x0 + i, y, 5);
          } else { G.ladrillos.push({ x: x0 + i, y, contenido: s.contenido || 'nada', seg: s }); set(x0 + i, y, 8); }
        }
      } else if (s.tipo === 'plataforma_cae') G.caes.push({ x: num(s.x, 0), y: num(s.y, 0), largo: Math.max(1, Math.round(num(s.largo, 3))), retardo: num(s.retardo, 0.6), reaparece: num(s.reaparece, 4), seg: s });
      else if (s.tipo === 'planta_carnivora') G.plantas.push({ x: Math.round(num(s.x, 0)), y: Math.round(num(s.y, 0)), ciclo: num(s.ciclo, 3), visible: num(s.visible, 1.2), seg: s });
      else if (s.tipo === 'mina') G.minas.push({ x: num(s.x, 0), y: num(s.y, 0), modo: s.modo === 'temporizador' ? 'temporizador' : 'contacto', radio: num(s.radio, s.modo === 'temporizador' ? 2 : 1.2), seg: s });
      else if (s.tipo === 'prensa') G.prensas.push({ x: Math.round(num(s.x, 0)), y: Math.round(num(s.y, 0)), largo: Math.max(1, Math.round(num(s.largo, 2))), periodo: num(s.periodo, 3), retardo: num(s.retardo, 0), seg: s });
      else if (s.tipo === 'pendulo') G.pendulos.push({ x: num(s.x, 0), y: num(s.y, 0), cuerda: num(s.cuerda, 4), periodo: num(s.periodo, 0), amplitud: num(s.amplitud, 50), seg: s });
      else if (s.tipo === 'cinta') { const x = Math.round(num(s.x, 0)), y = Math.round(num(s.y, 0)), l = Math.max(1, Math.round(num(s.largo, 4))); G.cintas.push({ x, y, largo: l, velocidad: num(s.velocidad, 2), seg: s }); for (let i = 0; i < l; i++) set(x + i, y, 9); }
      else if (s.tipo === 'picos') G.picos.push({ x: Math.round(num(s.x, 0)), y: Math.round(num(s.y, 0)), largo: Math.max(1, Math.round(num(s.largo, 2))), seg: s });
      else if (s.tipo === 'bloque_rebote') { const x = Math.round(num(s.x, 0)), y = Math.round(num(s.y, 0)), l = Math.max(1, Math.round(num(s.largo, 2))); G.rebotes.push({ x, y, largo: l, seg: s }); for (let i = 0; i < l; i++) set(x + i, y, 10); }
      else if (s.tipo === 'sprint') G.sprints.push({ ini: num(s.x_ini, 0), fin: num(s.x_fin, 0), velocidad: num(s.velocidad, 4), seg: s });
      else if (s.tipo === 'rastro_monedas') G.rastros.push({ puntos: Array.isArray(s.puntos) ? s.puntos : [], seg: s });
      else if (s.tipo === 'cartel') G.carteles.push({ x: num(s.x, 0), y: num(s.y, 0), texto: String(s.texto || ''), seg: s });
      else if (s.tipo === 'atomo') G.atomos.push({ x: Math.floor(num(s.x, 0)), y: Math.floor(num(s.y, 0)), elemento: s.elemento, seg: s });
      else if (s.tipo === 'estacion_molecula') G.estaciones.push({ x: Math.round(num(s.x, 0)), y: Math.round(num(s.y, 0)), seg: s });
      else if (s.tipo === 'interruptor_estado') G.interruptores.push({ x: Math.round(num(s.x, 0)), y: Math.round(num(s.y, 0)), variable: s.variable, valores: Array.isArray(s.valores) ? s.valores : [], seg: s });
      else if (s.tipo === 'plataforma_estado') G.platEstado.push({ x: num(s.x, 0), y: num(s.y, 0), largo: Math.max(1, Math.round(num(s.largo, 3))), requiere: s.requiere || {}, seg: s });
      else if (s.tipo === 'zona_agua') G.aguas.push({ x: num(s.x, 0), y: num(s.y, 0), w: num(s.w, 1), h: num(s.h, 1), cx: num(s.corriente_x, 0), cy: num(s.corriente_y, 0), seg: s });
      else if (s.tipo === 'bloque_pregunta') {
        const x = Math.round(num(s.x, 0)), y = Math.round(num(s.y, 0));
        G.bloques.push({ x, y, seg: s }); set(x, y, 5);
      } else if (s.tipo === 'tuberia') {
        const x = Math.round(num(s.x, 0)), alto2 = Math.max(1, Math.round(num(s.alto, 2))), base = G.baseDesde(x, Math.round(num(s.y, 0)));
        G.tuberias.push({ x, alto: alto2, base, top: base - alto2, seg: s });
        if (base >= 0) for (let k = 1; k <= alto2; k++) { set(x, base - k, 6); set(x + 1, base - k, 6); }
      } else if (s.tipo === 'puerta' || s.tipo === 'puerta_ecuacion') {
        const x = Math.round(num(s.x, 0)), alto2 = Math.max(1, Math.round(num(s.alto, 3))), base = G.baseDesde(x, Math.round(num(s.y, 0)));
        G.puertas.push({ x, alto: alto2, base, top: base - alto2, seg: s });
        if (base >= 0) for (let k = 1; k <= alto2; k++) set(x, base - k, 7);
      }
    }
    // 4) arena del jefe: paredes de energía en izq y der mientras dura el combate (ver README)
    if (G.jefe) {
      const fort = G.jefe.seg.jefe === 'rey_entropia' || (nivel.tipo_nivel === 'fortaleza' && G.jefe.seg.tipo === 'jefe');
      const metaX = G.meta ? G.meta.x : ancho - 2;
      G.arena = { izq: G.jefe.x - 12, der: metaX - 1, fort };
    }
    return G;
  }

  /** Posición de una plataforma móvil en el instante t (s): oscila entre su origen y origen+recorrido. */
  function posMovil(m, t) {
    const s = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / m.per);
    return m.eje === 'x' ? { x: m.x + m.rec * s, y: m.y } : { x: m.x, y: m.y + m.rec * s };
  }

  // ---------- superficies (zonas donde se puede estar de pie) ----------
  function superficies(G) {
    const out = [];
    for (let y = 0; y < G.alto; y++) {
      let ini = -1;
      for (let x = 0; x <= G.ancho; x++) {
        const vt = (xx, yy) => { const q = G.get(xx, yy); return q === 5 || q === 7 || q === 8 ? 0 : q; };   // bloques ? y puertas no cuentan (se abren / se golpean)
        const t = x < G.ancho ? vt(x, y) : 0;
        const esSup = t !== 0 && !SOLIDO(vt(x, y - 1));
        if (esSup && ini < 0) ini = x;
        if (!esSup && ini >= 0) { out.push({ tipo: 'estatica', y, x0: ini, x1: x, muestras: [{ x0: ini, x1: x, y }] }); ini = -1; }
      }
    }
    // resortes: apoyados sobre la superficie (si caen dentro de un sólido, se suben encima)
    for (const r of G.resortes) {
      let ry = r.y; while (ry > 0 && G.get(r.x, ry) !== 0) ry--;
      r.fila = ry;
      const s = out.find((o) => o.x0 <= r.x && r.x < o.x1 && o.y > ry && o.y <= ry + 3);
      if (s) s.resorte = true;
    }
    for (const r of G.rebotes) { const o = out.find((q) => q.tipo === 'estatica' && q.y === r.y && q.x0 <= r.x && r.x < q.x1); if (o) o.resorte = true; }
    for (const c of G.platEstado) out.push({ tipo: 'estatica', estado: true, y: Math.round(c.y), x0: c.x, x1: c.x + c.largo, muestras: [{ x0: c.x, x1: c.x + c.largo, y: Math.round(c.y) }] });
    for (const c of G.caes) out.push({ tipo: 'estatica', cae: true, y: Math.round(c.y), x0: c.x, x1: c.x + c.largo, muestras: [{ x0: c.x, x1: c.x + c.largo, y: Math.round(c.y) }] });
    for (const m of G.movers) {
      const muestras = [];
      for (let k = 0; k <= 8; k++) {
        const p = posMovil(m, (m.per * k) / 16);
        muestras.push({ x0: p.x, x1: p.x + m.largo, y: p.y });
      }
      out.push({ tipo: 'movil', y: m.y, x0: Math.min(...muestras.map((q) => q.x0)), x1: Math.max(...muestras.map((q) => q.x1)), muestras, mover: m });
    }
    return out;
  }

  // ---------- validador ----------
  function validar(nivel) {
    const err = [], av = [];
    const E = (m) => err.push(m), W = (m) => av.push(m);
    const fin = () => ({ ok: err.length === 0, errores: err, avisos: av });
    if (!nivel || typeof nivel !== 'object') { E('El nivel no es un objeto JSON.'); return fin(); }

    // --- campos básicos ---
    const ancho = nivel.ancho_tiles, alto = nivel.alto_tiles;
    if (!Number.isInteger(ancho) || ancho < 40 || ancho > 400) E(`ancho_tiles debe ser un entero entre 40 y 400 (vale ${ancho}).`);
    if (!Number.isInteger(alto) || alto < 12 || alto > 30) E(`alto_tiles debe ser un entero entre 12 y 30 (vale ${alto}).`);
    if (!Array.isArray(nivel.segmentos)) E('Falta el array "segmentos".');
    if (err.length) return fin();
    if (typeof nivel.capitulo_id !== 'string' || !nivel.capitulo_id) E('Falta capitulo_id.');
    const TIPOS_NIVEL = ['normal', 'fortaleza', 'quiz_tierra', 'quiz_agua', 'quiz_castillo'];
    if (!TIPOS_NIVEL.includes(nivel.tipo_nivel)) E(`tipo_nivel debe ser ${TIPOS_NIVEL.map((t) => '"' + t + '"').join(', ')} (vale ${JSON.stringify(nivel.tipo_nivel)}).`);
    const esQuiz = typeof nivel.tipo_nivel === 'string' && nivel.tipo_nivel.indexOf('quiz_') === 0, esAgua = nivel.tipo_nivel === 'quiz_agua';
    if (typeof nivel.tema_visual !== 'string' || !nivel.tema_visual) E('Falta tema_visual.');
    const fj = nivel.fisica_juego;
    if (!fj || typeof fj !== 'object') E('Falta fisica_juego {gravedad,friccion,salto,viento}.');
    else {
      const rango = (k, a, b) => { if (typeof fj[k] !== 'number' || !isFinite(fj[k]) || fj[k] < a || fj[k] > b) E(`fisica_juego.${k} debe ser un número entre ${a} y ${b} (vale ${JSON.stringify(fj[k])}).`); };
      rango('gravedad', 0.4, 2); rango('friccion', 0.5, 0.995); rango('salto', 8, 16); rango('viento', -5, 5);
    }
    if (err.length) return fin();

    const F = fisica(nivel);
    if (F.hSeguro < 2.2) E(`Con esta física el salto solo alcanza ${F.hMax.toFixed(2)} tiles: demasiado bajo para jugar.`);
    const segs = nivel.segmentos;
    const TIPOS = ['plataforma', 'puente', 'palanca', 'foso', 'plataforma_movil', 'resorte', 'coleccionable', 'enemigo', 'zona_campo', 'checkpoint', 'jefe', 'meta', 'bloque_pregunta', 'tuberia', 'puerta', 'zona_agua', 'jefe_quiz', 'ladrillo', 'plataforma_cae', 'planta_carnivora',
      'mina', 'prensa', 'pendulo', 'cinta', 'picos', 'bloque_rebote', 'sprint', 'rastro_monedas', 'cartel', 'atomo', 'estacion_molecula', 'puerta_ecuacion', 'interruptor_estado', 'plataforma_estado'];
    const G = geometria(nivel, { revelar: true });   // los puentes ocultos (que aparecen con una estación) cuentan como presentes
    const dentroX = (x) => x >= 0 && x < ancho, dentroY = (y) => y >= 0 && y < alto;
    const desc = (s, i) => `segmento #${i} (${s.tipo}${s.x != null ? ' x=' + s.x : ''}${s.y != null ? ' y=' + s.y : ''})`;
    const esNum = (v) => typeof v === 'number' && isFinite(v);

    // --- tipos y campos numéricos de cada segmento ---
    segs.forEach((s, i) => {
      if (!s || typeof s !== 'object' || !TIPOS.includes(s.tipo)) { E(`segmento #${i}: tipo desconocido ${JSON.stringify(s && s.tipo)}.`); return; }
      if (s.tipo === 'sprint' || s.tipo === 'rastro_monedas') return;   // se validan aparte (x_ini/x_fin, puntos)
      if (!esNum(s.x)) { E(`${desc(s, i)}: falta x numérica.`); return; }
      if (['plataforma', 'puente', 'palanca', 'plataforma_movil', 'resorte', 'coleccionable', 'enemigo', 'zona_campo', 'bloque_pregunta', 'tuberia', 'puerta', 'zona_agua', 'ladrillo', 'plataforma_cae', 'planta_carnivora', 'mina', 'prensa', 'pendulo', 'cinta', 'picos', 'bloque_rebote', 'cartel', 'atomo', 'estacion_molecula', 'puerta_ecuacion', 'interruptor_estado', 'plataforma_estado'].includes(s.tipo) && !esNum(s.y)) E(`${desc(s, i)}: falta y numérica.`);
      if (['plataforma', 'puente', 'foso', 'plataforma_movil', 'plataforma_cae', 'cinta', 'picos', 'bloque_rebote', 'plataforma_estado'].includes(s.tipo) && s.largo != null && !(esNum(s.largo) && s.largo >= 1)) E(`${desc(s, i)}: "largo" debe ser un número >= 1.`);
      if (s.x < 0 || s.x >= ancho) E(`${desc(s, i)}: x fuera de rango [0, ${ancho}).`);
      if (s.y != null && (s.y < 0 || s.y >= alto)) E(`${desc(s, i)}: y fuera de rango [0, ${alto}).`);
      if (esNum(s.largo) && s.x + s.largo > ancho) E(`${desc(s, i)}: se sale del nivel (x+largo=${s.x + s.largo} > ancho_tiles=${ancho}).`);
    });
    if (err.length) return fin();

    const por = (t) => segs.filter((s) => s.tipo === t);
    const platsSuelo = por('plataforma');
    if (!platsSuelo.length) E('No hay ninguna plataforma.');
    for (const s of platsSuelo) {
      const suelo = s.solido === true || (s.grosor == null && s.solido !== false && s.y >= alto - FIS.SUELO_PROF);
      if (suelo && s.y > alto - 3) E(`plataforma de suelo en x=${s.x}: y=${s.y} demasiado abajo (máximo alto_tiles-3 = ${alto - 3}).`);
      if (!suelo && s.y < 2) E(`plataforma flotante en x=${s.x}: y=${s.y} demasiado arriba (mínimo 2).`);
    }

    // --- metas, jefes ---
    const metas = por('meta'), jefes = segs.filter((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz');
    if (metas.length !== 1) E(`Debe haber exactamente 1 meta (hay ${metas.length}).`);
    if (jefes.length > 1) E('Solo se admite un segmento jefe por nivel.');
    const meta = metas[0];
    if (meta) {
      if (meta.x > ancho - 2) E(`La meta (x=${meta.x}) debe estar como mucho en ancho_tiles-2 = ${ancho - 2}.`);
      if (ancho - meta.x - 2 > 14) E(`ancho_tiles (${ancho}) incoherente: sobran ${ancho - meta.x - 2} tiles tras la meta (x=${meta.x}); ajusta ancho_tiles a ≈ ${meta.x + 4}.`);
      const t0 = G.topAt(meta.x), t1 = G.topAt(meta.x + 1);
      if (t0 < 0) E(`La meta (x=${meta.x}) no tiene suelo debajo.`);
      else if (t1 !== t0) E(`La meta (x=${meta.x}) necesita 2 columnas de suelo a la misma altura (suelo en x=${meta.x}: y=${t0}; en x=${meta.x + 1}: y=${t1}).`);
    }
    const maxExt = segs.reduce((m, s) => Math.max(m, (s.x || 0) + (s.largo || 0) + (s.tipo === 'plataforma_movil' && s.eje !== 'y' ? Math.max(0, s.recorrido || 0) : 0)), 0);
    if (maxExt > ancho) E(`Hay segmentos que llegan hasta x=${maxExt} > ancho_tiles=${ancho}.`);

    // --- punto de inicio ---
    const spawnX = 2, spawnY = G.topAt(spawnX);
    if (spawnY < 0) E(`No hay suelo bajo el punto de inicio (x=${spawnX}). Empieza el nivel con una plataforma que cubra x=0..4.`);

    // --- física: fosos, plataformas móviles, resortes, zonas ---
    if (!esAgua) for (const f of G.fosos) if (f.largo > F.gapSeguro) {
      const puenteado = G.movers.some((m) => m.x + m.largo + Math.abs(m.rec) > f.x && m.x < f.x + f.largo) ||
        platsSuelo.some((p) => p.y < alto - FIS.SUELO_PROF && p.x < f.x + f.largo && p.x + p.largo > f.x);
      if (!puenteado) E(`El foso en x=${f.x} mide ${f.largo} tiles y el salto máximo seguro es ${F.gapSeguro.toFixed(1)} tiles (teórico ${F.distMax.toFixed(1)}).`);
    }
    for (const m of G.movers) {
      const sg = m.seg;
      if (sg.eje !== 'x' && sg.eje !== 'y') E(`plataforma_movil en x=${sg.x}: eje debe ser "x" o "y".`);
      if (!(esNum(sg.periodo) && sg.periodo >= 1.5 && sg.periodo <= 12)) E(`plataforma_movil en x=${sg.x}: periodo debe estar entre 1.5 y 12 s (vale ${sg.periodo}).`);
      if (!esNum(sg.recorrido) || Math.abs(sg.recorrido) < 1 || Math.abs(sg.recorrido) > 20) E(`plataforma_movil en x=${sg.x}: recorrido debe ser un número con 1 <= |recorrido| <= 20.`);
      // el trayecto no puede atravesar sólidos
      for (let k = 0; k <= 16; k++) {
        const p = posMovil(m, (m.per * k) / 16);
        let choca = false;
        for (let xx = Math.floor(p.x); xx < Math.ceil(p.x + m.largo); xx++) if (SOLIDO(G.get(xx, Math.round(p.y) - 1)) || SOLIDO(G.get(xx, Math.round(p.y) - 2))) choca = true;
        if (choca) { E(`plataforma_movil en x=${sg.x}, y=${sg.y}: hay un bloque sólido justo encima de su recorrido (no cabe el jugador).`); break; }
      }
      if (m.eje === 'x' && (m.x + Math.max(0, m.rec) + m.largo > ancho || m.x + Math.min(0, m.rec) < 0)) E(`plataforma_movil en x=${sg.x}: su recorrido se sale del nivel.`);
      if (m.eje === 'y' && (m.y + m.rec < 1 || m.y + m.rec > alto - 1)) E(`plataforma_movil en x=${sg.x}: su recorrido vertical se sale del nivel.`);
    }
    for (const c of G.campos) {
      if (!(c.w > 0 && c.h > 0)) E(`zona_campo en x=${c.x}: w y h deben ser > 0.`);
      if (c.x + c.w > ancho || c.y + c.h > alto + 4) E(`zona_campo en x=${c.x}: se sale del nivel.`);
      if (!esNum(c.seg.fx) || !esNum(c.seg.fy)) E(`zona_campo en x=${c.x}: fx y fy deben ser numéricos.`);
      if (Math.abs(c.fx) > 3 || Math.abs(c.fy) > 3) E(`zona_campo en x=${c.x}: |fx|,|fy| <= 3 (múltiplos de la gravedad base).`);
    }

    // --- checkpoints ---
    for (const c of por('checkpoint')) if (G.topAt(Math.round(c.x)) < 0) E(`checkpoint en x=${c.x}: no hay suelo debajo.`);

    // --- coleccionables / enemigos: límites y no dentro de sólidos ---
    const cols = por('coleccionable'), enes = por('enemigo');
    if (!esQuiz && cols.length < 5) E(`Hay ${cols.length} coleccionables; el contrato exige >= 5.`);
    if (!esQuiz && enes.length < 3) E(`Hay ${enes.length} enemigos; el contrato exige >= 3.`);
    const refs = new Set();
    for (const c of cols) {
      const x = Math.floor(c.x), y = Math.floor(c.y);
      if (!dentroX(x) || !dentroY(y)) E(`coleccionable "${c.ref}" fuera de los límites del nivel.`);
      else if (G.get(x, y) !== 0) E(`coleccionable "${c.ref}" (x=${c.x}, y=${c.y}) está dentro de un sólido.`);
      if (typeof c.latex !== 'string' || !c.latex.trim()) E(`coleccionable "${c.ref}" sin latex.`);
      if (typeof c.nombre !== 'string' || !c.nombre.trim()) E(`coleccionable "${c.ref}" sin nombre.`);
      if (typeof c.ref !== 'string' || !c.ref) E(`coleccionable en x=${c.x} sin ref.`);
      else if (refs.has(c.ref)) E(`coleccionable con ref duplicado: ${c.ref}.`); else refs.add(c.ref);
    }
    for (const e of enes) {
      const x = Math.floor(e.x), y = Math.floor(e.y);
      if (!dentroX(x) || !dentroY(y)) { E(`enemigo "${e.enemigo}" fuera de los límites del nivel.`); continue; }
      if (G.get(x, y) !== 0) E(`enemigo "${e.enemigo}" (x=${e.x}, y=${e.y}) está dentro de un sólido.`);
      let apoyo = false; for (let k = 1; k <= 3; k++) if (G.get(x, y + k) !== 0) apoyo = true;
      const acuatico = ACUATICOS.includes(e.enemigo);
      if (acuatico && !G.aguas.length) W(`enemigo acuático "${e.enemigo}" (x=${e.x}) en un nivel sin zona_agua.`);
      if (!apoyo && !acuatico) E(`enemigo "${e.enemigo}" (x=${e.x}, y=${e.y}) flota: no hay suelo en los 3 tiles siguientes.`);
      if (typeof e.enemigo !== 'string' || !e.enemigo) E(`enemigo en x=${e.x} sin id "enemigo".`);
      if (typeof e.correccion !== 'string' || !e.correccion.trim()) E(`enemigo "${e.enemigo}" sin "correccion".`);
      if (typeof e.nombre !== 'string' || !e.nombre.trim()) E(`enemigo "${e.enemigo}" sin "nombre".`);
    }

    // --- puentes y palancas (fortaleza) ---
    const ids = new Set();
    G.puentes.forEach((b) => { if (b.id) { if (ids.has(b.id)) E(`puente con id duplicado: ${b.id}.`); ids.add(b.id); } });
    G.palancas.forEach((l) => { if (l.id) { if (ids.has(l.id)) E(`id duplicado: ${l.id}.`); ids.add(l.id); } });
    for (const l of G.palancas) {
      const x = Math.floor(l.x), y = Math.floor(l.y);
      if (l.seg.efecto !== 'cae_puente') E(`palanca en x=${l.x}: efecto debe ser "cae_puente" (vale ${JSON.stringify(l.seg.efecto)}).`);
      if (!G.puentes.length) E(`palanca en x=${l.x}: no hay ningún puente que pueda caer.`);
      else if (l.objetivo && !G.puentes.some((b) => b.id === l.objetivo)) E(`palanca en x=${l.x}: objetivo "${l.objetivo}" no es el id de ningún puente.`);
      if (G.get(x, y) !== 0) E(`palanca en x=${l.x}, y=${l.y}: está dentro de un sólido.`);
      let apoyo = false; for (let k = 1; k <= 2; k++) if (G.get(x, y + k) !== 0) apoyo = true;
      if (!apoyo) E(`palanca en x=${l.x}, y=${l.y}: flota (no hay suelo en los 2 tiles siguientes).`);
    }
    for (const b of G.puentes) {
      if (b.caeCon && !G.palancas.some((l) => l.id === b.caeCon)) E(`puente en x=${b.x}: cae_con "${b.caeCon}" no es el id de ninguna palanca.`);
      if (b.y > alto - 3) E(`puente en x=${b.x}: y=${b.y} demasiado abajo.`);
    }
    if (nivel.tipo_nivel === 'fortaleza' && (!G.puentes.length || !G.palancas.length)) W('Nivel fortaleza sin puente o sin palanca (el contrato pide ambos).');

    // --- preguntas (esquema §6 / §4b): opcion o numerico ---
    const valQ = (q, etq) => {
      const texto = q && typeof q === 'object' ? (q.enunciado != null ? q.enunciado : q.pregunta) : null;
      if (typeof texto !== 'string' || !texto.trim()) { E(`${etq}: falta el enunciado (enunciado).`); return false; }
      const tipo = q.tipo || 'opcion';
      if (tipo === 'numerico') {
        if (!esNum(q.valor)) { E(`${etq}: pregunta numérica sin "valor" numérico.`); return false; }
        if (q.unidad != null && typeof q.unidad !== 'string') { E(`${etq}: "unidad" debe ser texto.`); return false; }
        if (q.tolerancia_rel != null && !(esNum(q.tolerancia_rel) && q.tolerancia_rel > 0 && q.tolerancia_rel <= 0.5)) { E(`${etq}: tolerancia_rel debe estar en (0, 0.5].`); return false; }
      } else if (tipo === 'opcion') {
        if (!Array.isArray(q.opciones) || q.opciones.length < 2 || q.opciones.length > 6 || q.opciones.some((o) => typeof o !== 'string' || !o.trim())) { E(`${etq}: "opciones" debe ser un array de 2 a 6 textos.`); return false; }
        if (!Number.isInteger(q.correcta) || q.correcta < 0 || q.correcta >= q.opciones.length) { E(`${etq}: "correcta" (${q.correcta}) no es un índice válido de opciones (0..${q.opciones.length - 1}).`); return false; }
      } else { E(`${etq}: tipo de pregunta desconocido "${tipo}".`); return false; }
      return true;
    };
    const valQs = (s, etq) => {
      if (!s.pregunta) E(`${etq}: falta "pregunta".`); else valQ(s.pregunta, etq);
      if (s.preguntas_reserva != null) { if (!Array.isArray(s.preguntas_reserva)) E(`${etq}: preguntas_reserva debe ser un array.`); else s.preguntas_reserva.forEach((q, i) => valQ(q, `${etq}, reserva #${i + 1}`)); }
    };

    // ecuaciones de las puertas (química jugable): se parsean las fórmulas y se exige que se puedan equilibrar
    const validarEcuacion = (sg, id) => {
      const eq = sg.ecuacion;
      if (!eq || !Array.isArray(eq.reactivos) || !Array.isArray(eq.productos) || !eq.reactivos.length || !eq.productos.length) { E(`${id}: falta ecuacion {reactivos:[…],productos:[…]}.`); return; }
      const todas = [...eq.reactivos, ...eq.productos];
      const mal = todas.find((f) => typeof f !== 'string' || !Quimica.parsear(f));
      if (mal !== undefined) { E(`${id}: no se entiende la fórmula ${JSON.stringify(mal)} (usa H3O+, HO-, CO3^2-, NH4+…).`); return; }
      const c = Quimica.resolver(eq);
      if (!c) E(`${id}: la ecuación no se puede equilibrar con coeficientes enteros positivos (átomos y carga).`);
      else if (Math.max(...c) > 6) E(`${id}: los coeficientes mínimos (${c.join(',')}) son demasiado grandes (máx. 6).`);
      if (typeof sg.ayuda !== 'string' || !sg.ayuda.trim()) W(`${id}: sin "ayuda" para el jugador.`);
    };
    // --- jefe ---
    const jefe = jefes[0];
    if (nivel.tipo_nivel === 'fortaleza' && (!jefe || jefe.jefe !== 'rey_entropia')) E('Un nivel "fortaleza" necesita un segmento jefe con jefe:"rey_entropia".');
    if (nivel.tipo_nivel === 'normal' && jefe && jefe.jefe === 'rey_entropia') W('rey_entropia en un nivel "normal": se tratará como fortaleza.');
    if (nivel.tipo_nivel === 'quiz_castillo' && !(jefe && jefe.tipo === 'jefe_quiz')) E('Un nivel "quiz_castillo" necesita un segmento jefe_quiz.');
    if (jefe) {
      const quizJ = jefe.tipo === 'jefe_quiz', ps = jefe.preguntas, minQ = quizJ ? 5 : 3, conFases = quizJ && Array.isArray(jefe.fases);
      if (quizJ) {
        if (!JEFES_QUIZ.includes(jefe.jefe)) E(`jefe_quiz: jefe "${jefe.jefe}" desconocido (${JEFES_QUIZ.join(' | ')}).`);
        if (jefe.vidas != null && !(Number.isInteger(jefe.vidas) && jefe.vidas >= 1 && jefe.vidas <= 6)) E('jefe_quiz: "vidas" debe ser un entero entre 1 y 6.');
      } else if (jefe.jefe === 'pulpo_acido' || jefe.jefe === 'dragon_tormenta') W(`${jefe.jefe} como "jefe" normal se comporta como jefe_quiz.`);
      if (conFases) {
        const PAT = { rey_entropia: ['bola', 'arco', 'onda', 'abanico', 'lluvia'], golem_formulas: ['carga', 'salto'], pulpo_acido: ['tinta', 'chorro', 'tentaculos'], dragon_tormenta: ['rayo', 'embestida', 'rafaga'] }[jefe.jefe] || [];
        if (jefe.fases.length < 2 || jefe.fases.length > 5) E(`jefe_quiz: "fases" debe tener entre 2 y 5 fases (tiene ${jefe.fases.length}).`);
        jefe.fases.forEach((f, k) => {
          const idf = `jefe, fase ${k + 1}`;
          if (!f || !Array.isArray(f.preguntas) || f.preguntas.length < 2) { E(`${idf}: necesita >= 2 preguntas.`); return; }
          f.preguntas.forEach((q, i) => valQ(q, `${idf}, pregunta #${i + 1}`));
          if (f.dificultad != null && !(Number.isInteger(f.dificultad) && f.dificultad >= 1 && f.dificultad <= 3)) E(`${idf}: dificultad debe ser 1, 2 o 3.`);
          if (f.patron != null) {
            if (typeof f.patron !== 'string') E(`${idf}: patron debe ser texto (ataques separados por + o coma).`);
            else { const mal = f.patron.split(/[+,]/).map((q) => q.trim()).filter(Boolean).filter((q) => !PAT.includes(q)); if (mal.length) E(`${idf}: patron con ataques desconocidos para ${jefe.jefe}: ${mal.join(', ')} (válidos: ${PAT.join(', ')}).`); }
          }
        });
      } else if (!Array.isArray(ps) || ps.length < minQ) E(`El jefe necesita >= ${minQ} preguntas (tiene ${Array.isArray(ps) ? ps.length : 0}).`);
      else ps.forEach((q, i) => valQ(q, `jefe, pregunta #${i + 1}`));
      const A = G.arena;
      if (A) {
        if (A.izq < 4) E(`jefe en x=${jefe.x}: la arena empezaría en x=${A.izq}; mueve el jefe a x >= 16.`);
        const ancho_int = A.der - (A.izq + 1);
        if (ancho_int < 14) E(`Arena del jefe demasiado estrecha (${ancho_int} tiles interiores, mínimo 14). La arena va de jefe.x-12 a meta.x-1.`);
        const ref = G.topAt(A.izq + 1);
        for (let x = A.izq; x <= A.der; x++) {
          if (G.topAt(x) !== ref) { E(`Arena del jefe: el suelo debe ser plano y continuo entre x=${A.izq} y x=${A.der} (falla en x=${x}).`); break; }
        }
        if (G.movers.some((m) => m.x < A.der + 1 && m.x + m.largo + Math.abs(m.rec) > A.izq)) W('Hay plataformas móviles dentro de la arena del jefe.');
      }
    }

    // --- alcanzabilidad (BFS sobre superficies) ---
    const sup = superficies(G);
    const zonasPara = (A, B) => {
      const x0 = Math.min(A.x0, B.x0) - 1, x1 = Math.max(A.x1, B.x1) + 1, y0 = Math.min(A.y, B.y) - 5, y1 = Math.max(A.y, B.y) + 1;
      let fy = 0;
      for (const c of G.campos) if (c.x < x1 && c.x + c.w > x0 && c.y < y1 && c.y + c.h > y0) fy += c.fy;
      return Math.min(3, Math.max(0.15, 1 + fy));
    };
    /** ¿se puede ir de la superficie A a la B? (probando todas las posiciones muestreadas de las móviles) */
    const puede = (A, B) => {
      for (const a of A.muestras) for (const b of B.muestras) {
        const dx = Math.max(0, b.x0 - a.x1, a.x0 - b.x1), dy = a.y - b.y;    // dy>0: B más alta
        const f = zonasPara(a, b);
        const solapa = a.x0 < b.x1 && b.x0 < a.x1;
        for (const res of A.resorte ? [false, true] : [false]) {
          if (dy > 0 && dy > alturaSegura(F, f, res)) continue;
          if (dx === 0) {
            if (dy > 0 || !solapa || b.x0 < a.x0 || b.x1 > a.x1) return true;   // más alta (salto), contigua, o más baja asomando
          } else if (dx <= gapMax(F, dy, f, res)) return true;
        }
      }
      return false;
    };
    const ini = esAgua ? null : sup.find((s) => s.tipo === 'estatica' && s.x0 <= spawnX && spawnX < s.x1 && s.y === spawnY);
    const vis = new Set();
    if (ini) {
      const cola = [ini]; vis.add(ini);
      while (cola.length) {
        const a = cola.shift();
        if (a.cae) continue;   // una plataforma que cae no cuenta como camino hacia otras
        for (const b of sup) if (!vis.has(b) && puede(a, b)) { vis.add(b); cola.push(b); }
      }
      for (const s of sup) if (!vis.has(s)) {
        if (s.tipo === 'movil') E(`La plataforma móvil en x=${s.mover.seg.x}, y=${s.mover.seg.y} es inalcanzable (altura ≤ ${F.hSeguro.toFixed(1)} tiles, hueco ≤ ${F.gapSeguro.toFixed(1)} tiles).`);
        else E(`La plataforma${s.cae ? ' que cae' : ''} en x=${s.x0}..${s.x1 - 1}, y=${s.y} es inalcanzable desde el inicio (altura segura ${F.hSeguro.toFixed(1)}, hueco seguro ${F.gapSeguro.toFixed(1)} tiles${s.cae ? '; las plataformas que caen no cuentan como único camino' : ''}).`);
      }
      if (meta) {
        const ty = G.topAt(meta.x);
        const sm = sup.find((s) => s.tipo === 'estatica' && s.x0 <= meta.x && meta.x < s.x1 && s.y === ty);
        if (sm && !vis.has(sm)) E(`La meta (x=${meta.x}) no es accesible desde el inicio.`);
      }
      // coleccionables alcanzables desde alguna superficie visitada
      const alcanzables = sup.filter((s) => vis.has(s));
      for (const c of cols.concat(G.atomos.map((a) => ({ x: a.x, y: a.y, ref: 'átomo ' + a.elemento })))) {
        const cx = Math.floor(c.x) + 0.5, cy = Math.floor(c.y) + 0.5;
        let ok = false;
        for (const s of alcanzables) {
          for (const m of s.muestras) {
            const d = Math.max(0, m.x0 - cx, cx - m.x1), dh = m.y - cy;
            if (dh < -0.2) continue;                      // la superficie está más alta que el objeto: se toca desde otra
            const f = zonasPara(m, m);
            for (const res of s.resorte ? [false, true] : [false]) {
              const t = d / F.vmax, v = res ? F.vResorte : F.v0, g = F.g * f;
              const tAp = v / g;
              const yAlc = (t <= tAp ? (v * v) / (2 * g) : Math.max(0, v * t - 0.5 * g * t * t)) * 0.92;
              if (d <= 6.5 && dh <= yAlc + FIS.H + 0.1) ok = true;
            }
          }
        }
        if (!ok) E(`${String(c.ref).indexOf('átomo') === 0 ? '' : 'coleccionable '}"${c.ref}" (x=${c.x}, y=${c.y}) no se puede alcanzar con el salto (altura máx. ≈ ${(F.hSeguro + FIS.H).toFixed(1)} tiles sobre el suelo).`);
      }
    }

    // ===== Quiz Quest: zonas de agua, bloques ?, tuberías, puertas =====
    for (const a of G.aguas) {
      if (!(a.w > 0 && a.h > 0)) E(`zona_agua en x=${a.x}: w y h deben ser > 0.`);
      if (a.x < 0 || a.y < 0 || a.x + a.w > ancho || a.y + a.h > alto) E(`zona_agua en x=${a.x}: se sale del nivel (0..${ancho} x 0..${alto}).`);
      if (Math.abs(a.cx) > 6 || Math.abs(a.cy) > 6) E(`zona_agua en x=${a.x}: |corriente_x|,|corriente_y| <= 6 (tiles/s²).`);
    }
    if (esAgua && !G.aguas.length) E('Un nivel "quiz_agua" necesita al menos una zona_agua.');
    const enAgua = (cx, cy) => G.aguas.some((a) => cx >= a.x && cx < a.x + a.w && cy >= a.y && cy < a.y + a.h);
    const alc = sup.filter((q) => vis.has(q));
    const bloquesVistos = new Set();
    for (const b of G.bloques) {
      const sg = b.seg, id = `bloque_pregunta (x=${sg.x}, y=${sg.y})`;
      if (b.x < 0 || b.x >= ancho || b.y < 1 || b.y >= alto - 1) { E(`${id}: fuera de los límites del nivel.`); continue; }
      const k = b.x + ',' + b.y; if (bloquesVistos.has(k)) E(`${id}: dos bloques en la misma casilla.`); bloquesVistos.add(k);
      if (!['moneda', 'vida', 'pista', 'escudo', 'estrella', 'reloj'].includes(sg.premio)) E(`${id}: premio debe ser moneda|vida|pista|escudo|estrella|reloj (vale ${JSON.stringify(sg.premio)}).`);
      if (sg.fallo != null && !['cierra', 'enemigo'].includes(sg.fallo)) E(`${id}: fallo debe ser cierra|enemigo.`);
      valQs(sg, id);
      for (const o of [...G.tuberias, ...G.puertas]) if (b.x >= o.x && b.x < o.x + (o.seg.tipo === 'tuberia' ? 2 : 1) && b.y >= o.top && b.y < o.base) E(`${id}: solapa con ${o.seg.tipo} en x=${o.x}.`);
      if (esAgua) continue;   // en el agua se golpea nadando (comprobado abajo)
      if (!ini) continue;
      let ok = false;
      for (const q of alc) for (const m of q.muestras) {
        if (!(m.x0 < b.x + 1.3 && m.x1 > b.x - 0.3)) continue;
        const h = m.y - b.y, lim = F.hSeguro + 1.9 + (q.resorte ? F.hResorte - F.hMax : 0);
        if (m.y >= b.y + 2 && h <= lim) ok = true;
      }
      if (!ok) E(`${id}: no se puede golpear desde abajo (hace falta una superficie alcanzable debajo, entre 2 y ${(F.hSeguro + 1.9).toFixed(1)} tiles por debajo del bloque).`);
    }
    // ladrillos: se rompen golpeándolos desde abajo (misma comprobación que los bloques ?)
    const golpeable = (bx, by) => {
      for (const q of alc) for (const m of q.muestras) {
        if (!(m.x0 < bx + 1.3 && m.x1 > bx - 0.3)) continue;
        const h = m.y - by, lim = F.hSeguro + 1.9 + (q.resorte ? F.hResorte - F.hMax : 0);
        if (m.y >= by + 2 && h <= lim) return true;
      }
      return false;
    };
    const CONT = ['nada', 'moneda', 'moneda_multi', 'pregunta'];
    for (const sg of segs.filter((q) => q.tipo === 'ladrillo')) {
      const id = `ladrillo (x=${sg.x}, y=${sg.y})`;
      if (sg.largo != null && !(Number.isInteger(sg.largo) && sg.largo >= 1 && sg.largo <= 12)) E(`${id}: largo debe ser un entero entre 1 y 12.`);
      if (sg.contenido != null && !CONT.includes(sg.contenido)) E(`${id}: contenido debe ser ${CONT.join('|')} (vale ${JSON.stringify(sg.contenido)}).`);
      if (sg.contenido === 'pregunta') valQs(sg, id);
      if (sg.x + (sg.largo || 1) > ancho) E(`${id}: se sale del nivel.`);
    }
    for (const b of G.ladrillos) {
      const id = `ladrillo (x=${b.x}, y=${b.y})`;
      if (b.y < 1 || b.y >= alto - 1) { E(`${id}: fuera de los límites del nivel.`); continue; }
      if (esAgua || !ini) continue;
      if (!golpeable(b.x, b.y)) E(`${id}: no se puede romper desde abajo (hace falta una superficie alcanzable entre 2 y ${(F.hSeguro + 1.9).toFixed(1)} tiles por debajo).`);
    }
    // plataformas que caen
    for (const c of G.caes) {
      const sg = c.seg, id = `plataforma_cae (x=${sg.x}, y=${sg.y})`;
      if (!(c.retardo >= 0.2 && c.retardo <= 3) || (sg.retardo != null && !esNum(sg.retardo))) E(`${id}: retardo debe estar entre 0.2 y 3 s (vale ${sg.retardo}).`);
      if (!(c.reaparece >= 1 && c.reaparece <= 15) || (sg.reaparece != null && !esNum(sg.reaparece))) E(`${id}: reaparece debe estar entre 1 y 15 s (vale ${sg.reaparece}).`);
      if (c.y < 2 || c.y >= alto - 2) E(`${id}: y fuera de rango [2, ${alto - 2}).`);
      if (c.x + c.largo > ancho) E(`${id}: se sale del nivel.`);
      for (let i = 0; i < c.largo; i++) if (G.get(Math.floor(c.x) + i, Math.round(c.y)) !== 0) { E(`${id}: está dentro de un sólido.`); break; }
    }
    // plantas carnívoras
    for (const pl of G.plantas) {
      const sg = pl.seg, id = `planta_carnivora (x=${sg.x}, y=${sg.y})`;
      if (!(pl.ciclo >= 1.5 && pl.ciclo <= 12)) E(`${id}: ciclo debe estar entre 1.5 y 12 s (vale ${sg.ciclo}).`);
      if (!(pl.visible >= 0.3 && pl.visible <= pl.ciclo - 0.5)) E(`${id}: visible debe estar entre 0.3 y ciclo-0.5 (vale ${sg.visible}).`);
      const tubo = G.tuberias.find((t) => t.x <= pl.x && pl.x < t.x + 2), base = tubo ? tubo.base : G.baseDesde(pl.x, pl.y);
      if (base < 0) E(`${id}: no hay tubería ni suelo debajo.`);
      else if (!tubo && (SOLIDO(G.get(pl.x, base - 1)) || SOLIDO(G.get(pl.x, base - 2)))) E(`${id}: el suelo sobre el que sale está tapado por un sólido.`);
      if (pl.x < 8 && pl.x >= 0) W(`${id}: muy cerca del inicio.`);
    }
    for (const t of G.tuberias) {
      const sg = t.seg, id = `tuberia (x=${sg.x}, y=${sg.y})`;
      if (t.base < 0) { E(`${id}: no hay suelo debajo.`); continue; }
      if (t.x + 1 >= ancho) E(`${id}: ocupa 2 columnas y se sale del nivel.`);
      if (!(t.alto >= 1 && t.alto <= 3)) E(`${id}: "alto" debe estar entre 1 y 3 (hay que poder subirse encima; vale ${sg.alto}).`);
      if (G.get(t.x + 1, t.base) === 0 || G.topAt(t.x + 1) !== t.base) E(`${id}: necesita suelo a la misma altura bajo sus 2 columnas.`);
      if (sg.destino !== 'atajo' && sg.destino !== 'bonus') E(`${id}: destino debe ser "atajo" o "bonus" (vale ${JSON.stringify(sg.destino)}).`);
      if (sg.destino === 'atajo') {
        if (!esNum(sg.salida_x) || !esNum(sg.salida_y)) E(`${id}: el atajo necesita salida_x y salida_y numéricos.`);
        else {
          const sx = Math.round(sg.salida_x), sb = G.baseDesde(sx, Math.round(sg.salida_y));
          if (sx < 0 || sx >= ancho || sb < 0) E(`${id}: la salida (${sg.salida_x}, ${sg.salida_y}) no tiene suelo debajo o está fuera del nivel.`);
          else if (SOLIDO(G.get(sx, sb - 1)) || SOLIDO(G.get(sx, sb - 2))) E(`${id}: la salida (${sg.salida_x}, ${sg.salida_y}) está tapada por un sólido.`);
          else if (sx <= t.x) W(`${id}: el atajo sale por detrás de la tubería.`);
        }
      }
      valQs(sg, id);
    }
    for (const d of G.puertas) {
      const sg = d.seg, id = `puerta (x=${sg.x}, y=${sg.y})`;
      if (d.base < 0) { E(`${id}: no hay suelo debajo.`); continue; }
      if (!(d.alto >= 2 && d.alto <= 6)) E(`${id}: "alto" debe estar entre 2 y 6 (vale ${sg.alto}).`);
      if (sg.tipo === 'puerta_ecuacion') validarEcuacion(sg, id); else valQs(sg, id);
    }
    // natación: alcanzabilidad por flood-fill en celdas (4 vecinos; se sube solo dentro del agua)
    if (esAgua && G.aguas.length && spawnY > 0) {
      const libre = (x, y) => x >= 0 && x < ancho && y >= 0 && y < alto && (!SOLIDO(G.get(x, y)) || G.get(x, y) === 7);
      const visto = new Uint8Array(ancho * alto), cola = [[spawnX, spawnY - 1]];
      visto[(spawnY - 1) * ancho + spawnX] = 1;
      while (cola.length) {
        const [x, y] = cola.pop();
        const sumergido = enAgua(x + 0.5, y + 0.5);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!libre(nx, ny) || visto[ny * ancho + nx]) continue;
          if (dy < 0 && !(sumergido && enAgua(nx + 0.5, ny + 0.5))) continue;
          visto[ny * ancho + nx] = 1; cola.push([nx, ny]);
        }
      }
      const alcanza = (x, y) => visto[Math.min(alto - 1, Math.max(0, y)) * ancho + Math.min(ancho - 1, Math.max(0, x))] === 1;
      for (const b of G.ladrillos) if (!alcanza(b.x, b.y + 1)) E(`ladrillo (x=${b.x}, y=${b.y}): no se llega nadando a la casilla de debajo.`);
      if (meta) { const my = G.topAt(meta.x) - 1; if (!alcanza(meta.x, my)) E(`La meta (x=${meta.x}) no es accesible nadando desde el inicio.`); }
      for (const c of cols) if (!alcanza(Math.floor(c.x), Math.floor(c.y))) E(`coleccionable "${c.ref}" no es accesible nadando.`);
      for (const a of G.atomos) if (!alcanza(a.x, a.y)) E(`átomo ${a.elemento} (x=${a.x}, y=${a.y}) no es accesible nadando.`);
      for (const b of G.bloques) if (!alcanza(b.x, b.y + 1)) E(`bloque_pregunta (x=${b.x}, y=${b.y}): no se llega nadando a la casilla de debajo (hay que golpearlo desde abajo).`);
      for (const t of G.tuberias) if (t.base >= 0 && !alcanza(t.x, t.top - 1)) E(`tuberia (x=${t.x}): no se llega nadando a su boca.`);
      for (const d of G.puertas) if (d.base >= 0 && !alcanza(d.x - 1, d.base - 1)) E(`puerta (x=${d.x}): no se llega nadando hasta ella.`);
    }

    // ===== Etapa 1: peligros / parkour y química jugable =====
    const suelo1 = (x, y) => SUELO_T(G.get(Math.floor(x), Math.floor(y) + 1));
    const libre = (x, y) => G.get(Math.floor(x), Math.floor(y)) === 0;
    // minas, picos: apoyados, fuera de la zona de inicio, y el grupo contiguo se puede saltar
    const peligros = [];
    for (const m of G.minas) {
      const id = `mina (x=${m.seg.x}, y=${m.seg.y})`;
      if (m.seg.modo != null && m.seg.modo !== 'contacto' && m.seg.modo !== 'temporizador') E(`${id}: modo debe ser "contacto" o "temporizador".`);
      if (!(m.radio >= 0.8 && m.radio <= 4)) E(`${id}: radio debe estar entre 0.8 y 4 tiles.`);
      if (!libre(m.x, m.y)) E(`${id}: está dentro de un sólido.`); else if (!suelo1(m.x, m.y)) E(`${id}: no hay suelo justo debajo.`);
      if (m.x < 6) E(`${id}: demasiado cerca del inicio (x>=6).`);
      peligros.push({ x: Math.floor(m.x), y: Math.floor(m.y), a: 1, id });
    }
    for (const pc of G.picos) {
      const id = `picos (x=${pc.seg.x}, y=${pc.seg.y})`;
      if (pc.largo > 4) E(`${id}: largo ${pc.largo} > 4 (un salto seguro cubre ~4 tiles de pinchos).`);
      for (let i = 0; i < pc.largo; i++) { if (!libre(pc.x + i, pc.y)) { E(`${id}: está dentro de un sólido.`); break; } if (!suelo1(pc.x + i, pc.y)) { E(`${id}: no hay suelo bajo todos los pinchos.`); break; } }
      if (pc.x < 6) E(`${id}: demasiado cerca del inicio (x>=6).`);
      for (let i = 0; i < pc.largo; i++) peligros.push({ x: pc.x + i, y: pc.y, a: 1, id });
    }
    for (const pl of G.plantas) peligros.push({ x: pl.x, y: pl.y, a: 2, id: `planta (x=${pl.x})` });
    // agrupar peligros de suelo contiguos (misma fila, separados < 2.5 tiles): el bloque no puede superar 4 tiles
    peligros.sort((a, b) => a.y - b.y || a.x - b.x);
    for (let i = 0; i < peligros.length;) {
      let j = i; while (j + 1 < peligros.length && peligros[j + 1].y === peligros[i].y && peligros[j + 1].x - peligros[j].x - 1 < 2) j++;
      const span = peligros[j].x - peligros[i].x + 1;
      if (span > 4) E(`Peligros de suelo en x=${peligros[i].x}..${peligros[j].x} (y=${peligros[i].y}): bloque infranqueable de ${span} tiles; sepáralos al menos 2 tiles o deja un camino alternativo (máx. 4).`);
      i = j + 1;
    }
    // minas en superficies demasiado estrechas (el jugador no puede esquivarlas)
    for (const m of G.minas) {
      const s0 = sup.find((q) => q.tipo === 'estatica' && q.x0 <= Math.floor(m.x) && Math.floor(m.x) < q.x1 && q.y === Math.floor(m.y) + 1);
      if (s0 && s0.x1 - s0.x0 < 3) E(`mina (x=${m.seg.x}) sobre una plataforma de ${s0.x1 - s0.x0} tiles: no se puede esquivar.`);
    }
    for (const pr of G.prensas) {
      const id = `prensa (x=${pr.seg.x}, y=${pr.seg.y})`;
      if (!(pr.largo >= 1 && pr.largo <= 6)) E(`${id}: largo entre 1 y 6.`);
      if (!(pr.periodo >= 2.2 && pr.periodo <= 8)) E(`${id}: periodo entre 2.2 y 8 s (vale ${pr.seg.periodo}).`);
      if (pr.seg.retardo != null && !esNum(pr.seg.retardo)) E(`${id}: retardo numérico.`);
      const bases = []; for (let i = 0; i < pr.largo; i++) bases.push(G.baseDesde(pr.x + i, pr.y + 1));
      if (bases.some((b) => b < 0)) { E(`${id}: no hay suelo debajo.`); continue; }
      if (new Set(bases).size > 1) E(`${id}: el suelo bajo la prensa no es plano.`);
      else if (bases[0] - (pr.y + 1) < 2) E(`${id}: poco hueco (${bases[0] - (pr.y + 1)} tiles) bajo la prensa levantada: hacen falta >= 2 para pasar.`);
      else if (bases[0] - pr.y > 7) W(`${id}: la prensa está muy alta sobre el suelo.`);
      if (pr.x < 6) E(`${id}: demasiado cerca del inicio (x>=6).`);
    }
    for (const pe of G.pendulos) {
      const id = `pendulo (x=${pe.seg.x}, y=${pe.seg.y})`;
      if (!(pe.cuerda >= 2 && pe.cuerda <= 9)) E(`${id}: cuerda entre 2 y 9 tiles.`);
      if (!(pe.amplitud >= 20 && pe.amplitud <= 80)) E(`${id}: amplitud entre 20° y 80°.`);
      if (!(pe.periodo === 0 || (pe.periodo >= 1.6 && pe.periodo <= 7))) E(`${id}: periodo entre 1.6 y 7 s (o 0 para T=2π√(L/g)).`);
      const base = G.baseDesde(Math.floor(pe.x), Math.floor(pe.y) + 1);
      if (base < 0) E(`${id}: no hay suelo bajo el péndulo.`);
      else if (pe.y + 0.5 + pe.cuerda > base + 0.2) E(`${id}: la maza llegaría por debajo del suelo (y+cuerda <= suelo).`);
      if (pe.x < 6) E(`${id}: demasiado cerca del inicio (x>=6).`);
    }
    for (const c of G.cintas) {
      const id = `cinta (x=${c.seg.x}, y=${c.seg.y})`;
      if (!esNum(c.seg.velocidad) || Math.abs(c.velocidad) < 0.5 || Math.abs(c.velocidad) > 4.5) E(`${id}: |velocidad| debe estar entre 0.5 y 4.5 tiles/s (el jugador corre a 5.5).`);
      if (c.largo < 2 || c.largo > 20) E(`${id}: largo entre 2 y 20.`);
      if (c.y < 2 || c.y >= alto - 1) E(`${id}: y fuera de rango.`);
    }
    for (const r of G.rebotes) { const id = `bloque_rebote (x=${r.seg.x}, y=${r.seg.y})`; if (r.largo > 8) E(`${id}: largo máximo 8.`); if (r.y < 3 || r.y >= alto - 1) E(`${id}: y fuera de rango.`); }
    for (const rs of G.rastros) {
      const id = 'rastro_monedas';
      if (!rs.puntos.length || rs.puntos.length > 60) { E(`${id}: "puntos" debe tener entre 1 y 60 puntos [x,y].`); continue; }
      rs.puntos.forEach((q, i) => {
        if (!Array.isArray(q) || !esNum(q[0]) || !esNum(q[1])) E(`${id}, punto #${i + 1}: debe ser [x,y] numérico.`);
        else if (q[0] < 0 || q[0] >= ancho || q[1] < 0 || q[1] >= alto) E(`${id}, punto #${i + 1}: fuera de los límites.`);
        else if (G.get(Math.floor(q[0]), Math.floor(q[1])) !== 0) E(`${id}, punto #${i + 1} (${q[0]},${q[1]}): dentro de un sólido.`);
      });
    }
    for (const c of G.carteles) {
      const id = `cartel (x=${c.seg.x}, y=${c.seg.y})`;
      if (!c.texto.trim() || c.texto.length > 220) E(`${id}: texto entre 1 y 220 caracteres.`);
      if (!libre(c.x, c.y)) E(`${id}: está dentro de un sólido.`);
    }
    // sprint: tramo de carrera con cámara empujando
    G.sprints.forEach((sp, k) => {
      const id = `sprint #${k + 1} (x ${sp.seg.x_ini}..${sp.seg.x_fin})`;
      if (!esNum(sp.seg.x_ini) || !esNum(sp.seg.x_fin) || !esNum(sp.seg.velocidad)) { E(`${id}: x_ini, x_fin y velocidad numéricos.`); return; }
      if (sp.ini < 8 || sp.fin > ancho - 6 || sp.fin - sp.ini < 16) { E(`${id}: x_ini>=8, x_fin<=ancho-6 y longitud >= 16 tiles.`); return; }
      if (sp.velocidad < 2.5 || sp.velocidad > 4.8) E(`${id}: velocidad entre 2.5 y 4.8 tiles/s (el jugador corre a ${F.vmax}).`);
      if (G.sprints.some((o, j) => j !== k && o.ini < sp.fin && o.fin > sp.ini)) E(`${id}: se solapa con otro sprint.`);
      if (G.arena && sp.fin > G.arena.izq - 2 && sp.ini < G.arena.der) E(`${id}: no puede invadir la arena del jefe.`);
      // el terreno debe poder correrse sin parar: huecos <= 4.5, sin mover/cae/estado en el camino, densidad de trampas
      for (const f of G.fosos) if (f.x < sp.fin && f.x + f.largo > sp.ini && f.largo > 4.5) E(`${id}: el foso en x=${f.x} (${f.largo} tiles) es demasiado ancho para correr con la cámara empujando (máx. 4.5).`);
      for (const m of G.movers) if (m.x < sp.fin && m.x + m.largo > sp.ini) E(`${id}: plataformas móviles en el tramo (x=${m.x}): mejor terreno fijo.`);
      for (const c of G.caes) if (c.x < sp.fin && c.x + c.largo > sp.ini) W(`${id}: plataforma que cae en x=${c.x} dentro del sprint.`);
      const trampas = G.minas.filter((m) => m.x >= sp.ini && m.x < sp.fin).length + G.prensas.filter((q) => q.x >= sp.ini && q.x < sp.fin).length + G.picos.filter((q) => q.x >= sp.ini && q.x < sp.fin).length + G.pendulos.filter((q) => q.x >= sp.ini && q.x < sp.fin).length;
      if (trampas > (sp.fin - sp.ini) / 3.5) E(`${id}: demasiadas trampas (${trampas}) para ${sp.fin - sp.ini} tiles (máx. 1 cada 3.5).`);
      // el suelo debe ser continuo salvo fosos: sin escalones > 2
      let prev = -1;
      for (let x = Math.ceil(sp.ini); x < sp.fin; x++) { const t = G.topAt(x); if (t < 0) continue; if (prev >= 0 && prev - t > 2) { E(`${id}: escalón de ${prev - t} tiles en x=${x}: no se puede subir corriendo.`); break; } prev = t; }
      if (!por('checkpoint').some((c) => c.x >= sp.fin - 10 && c.x <= sp.fin + 6)) W(`${id}: sin checkpoint cerca del final del tramo.`);
      if (G.aguas.some((a) => a.x < sp.fin && a.x + a.w > sp.ini)) E(`${id}: no puede cruzar una zona de agua.`);
    });
    // química: átomos, estaciones, ecuaciones, estados
    for (const a of G.atomos) {
      const id = `atomo ${a.elemento} (x=${a.seg.x}, y=${a.seg.y})`;
      if (!ELEMENTOS.includes(a.elemento)) E(`${id}: elemento desconocido (${ELEMENTOS.join(' ')}).`);
      if (a.x < 0 || a.x >= ancho || a.y < 0 || a.y >= alto) E(`${id}: fuera de los límites.`);
      else if (G.get(a.x, a.y) !== 0) E(`${id}: está dentro de un sólido.`);
    }
    const oferta = {}; G.atomos.forEach((a) => { oferta[a.elemento] = (oferta[a.elemento] || 0) + 1; });
    const demanda = {};
    const idsPuertas = new Set(G.puertas.map((d) => d.seg.id).filter(Boolean)), idsPuentes = new Set(G.puentes.map((b) => b.id).filter(Boolean));
    for (const e of G.estaciones) {
      const sg = e.seg, id = `estacion_molecula (x=${sg.x}, y=${sg.y})`;
      const pf = typeof sg.molecula === 'string' ? Quimica.parsear(sg.molecula) : null;
      if (!pf) { E(`${id}: molecula "${sg.molecula}" no es una fórmula válida.`); continue; }
      const req = sg.requiere;
      if (!req || typeof req !== 'object') { E(`${id}: falta "requiere" {H:2,O:1}.`); continue; }
      const igual = Object.keys(pf.atomos).length === Object.keys(req).length && Object.keys(pf.atomos).every((k) => req[k] === pf.atomos[k]);
      if (!igual) E(`${id}: "requiere" ${JSON.stringify(req)} no coincide con la fórmula ${sg.molecula} (${JSON.stringify(pf.atomos)}).`);
      for (const k in req) demanda[k] = (demanda[k] || 0) + req[k];
      if (!['abre', 'checkpoint', 'vida', 'puente'].includes(sg.recompensa)) E(`${id}: recompensa debe ser abre|checkpoint|vida|puente.`);
      if (sg.recompensa === 'abre' && !idsPuertas.has(sg.objetivo)) E(`${id}: objetivo "${sg.objetivo}" no es el id de ninguna puerta.`);
      if (sg.recompensa === 'puente' && !G.puentes.some((b) => b.id === sg.objetivo && b.oculto)) E(`${id}: objetivo "${sg.objetivo}" no es el id de un puente con oculto:true.`);
      if (!libre(e.x, e.y)) E(`${id}: está dentro de un sólido.`); else if (!suelo1(e.x, e.y)) E(`${id}: no hay suelo debajo.`);
    }
    for (const k in demanda) if ((oferta[k] || 0) < demanda[k]) E(`Las estaciones necesitan ${demanda[k]} átomos de ${k} y el nivel solo reparte ${oferta[k] || 0}.`);
    G.interruptores.forEach((it) => {
      const sg = it.seg, id = `interruptor_estado (x=${sg.x}, y=${sg.y})`;
      if (!['temperatura', 'ph', 'carga'].includes(it.variable)) E(`${id}: variable debe ser temperatura|ph|carga.`);
      if (it.valores.length < 2 || it.valores.length > 4 || it.valores.some((v) => typeof v !== 'string' || !v)) E(`${id}: valores = 2 a 4 textos.`);
      if (!libre(it.x, it.y)) E(`${id}: está dentro de un sólido.`); else if (!suelo1(it.x, it.y)) E(`${id}: no hay suelo debajo.`);
    });
    for (const pe of G.platEstado) {
      const sg = pe.seg, id = `plataforma_estado (x=${sg.x}, y=${sg.y})`, ks = Object.keys(pe.requiere || {});
      if (ks.length !== 1) { E(`${id}: "requiere" debe ser {variable:valor}.`); continue; }
      const it = G.interruptores.find((q) => q.variable === ks[0]);
      if (!it) E(`${id}: no hay ningún interruptor_estado de la variable "${ks[0]}".`);
      else if (!it.valores.includes(pe.requiere[ks[0]])) E(`${id}: el valor "${pe.requiere[ks[0]]}" no lo da el interruptor (${it.valores.join('|')}).`);
      if (pe.y < 2 || pe.y >= alto - 2) E(`${id}: y fuera de rango.`);
      for (let i = 0; i < pe.largo; i++) if (G.get(Math.floor(pe.x) + i, Math.round(pe.y)) !== 0) { E(`${id}: está dentro de un sólido.`); break; }
    }

    return fin();
  }

  // ---------- exportación ----------
  J.Quimica = Quimica; J.FIS = FIS; J.fisica = fisica; J.geometria = geometria; J.posMovil = posMovil; J.validar = validar; J.gapMax = gapMax;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Quimica, validar, geometria, fisica, FIS, posMovil, superficies, gapMax, alturaSegura };
    // CLI: node js/juego/validador.js nivel.json [...]
    if (typeof require !== 'undefined' && require.main === module) {
      const fs = require('fs');
      const archivos = process.argv.slice(2);
      if (!archivos.length) { console.log('Uso: node js/juego/validador.js contenido/niveles/x.json [otro.json ...]'); process.exit(2); }
      let malos = 0;
      for (const a of archivos) {
        let nivel;
        try { nivel = JSON.parse(fs.readFileSync(a, 'utf8')); } catch (e) { console.log(`✖ ${a}: JSON inválido (${e.message})`); malos++; continue; }
        const r = validar(nivel);
        if (r.ok) console.log(`✔ ${a}: nivel jugable${r.avisos.length ? ' (' + r.avisos.length + ' avisos)' : ''}`);
        else { malos++; console.log(`✖ ${a}: ${r.errores.length} error(es)`); r.errores.forEach((e) => console.log('   - ' + e)); }
        r.avisos.forEach((w) => console.log('   · aviso: ' + w));
      }
      process.exit(malos ? 1 : 0);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
