// =====================================================================================
// 44-relieve.js — RELIEVE: esculpe el terreno de un nivel para que no sea una tira plana (navegador y Node)
//   Rel.aplicar(nivel, {seed, intensidad:0..1, techo:bool}) -> nivel NUEVO (el original no se toca):
//     1) perfil de alturas del suelo (colinas y escalones de ±1/±2 tiles) con tramos protegidos (inicio, fosos, puentes,
//        sprint, arena del jefe y objetos de varias casillas);
//     2) todo lo que estaba sobre el suelo se recoloca con el desnivel (enemigos, átomos, ítems, carteles, minas…);
//     3) islas flotantes escalonadas con rastro de monedas, escalinatas/pirámides de bloques y, en cuevas/hornos, techo irregular.
//   Es determinista por (seed). Úsalo siempre junto con validar() y quédate con el original si no pasa.
// =====================================================================================
(function (root) {
  'use strict';
  const Rel = {};

  // ---------- utilidades ----------
  const hash = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // tipos que se recolocan con el desnivel (y relativa al suelo)
  const SHIFT = ['puente', 'enemigo', 'coleccionable', 'atomo', 'item', 'bicho', 'cartel', 'estacion_molecula', 'puerta_ecuacion', 'interruptor_estado', 'plataforma_estado', 'mina', 'picos', 'resorte',
    'bloque_pregunta', 'ladrillo', 'tuberia', 'puerta', 'palanca', 'planta_carnivora', 'zona_campo', 'plataforma_movil', 'plataforma_cae', 'prensa', 'pendulo', 'cinta', 'bloque_rebote'];
  // tipos que ocupan varias casillas o necesitan suelo estable: el perfil no cambia a su alrededor
  const PROTEGE = { checkpoint: 1, cartel: 1, estacion_molecula: 2, puerta_ecuacion: 2, tuberia: 2, puerta: 2, palanca: 2, prensa: 2, cinta: 2, picos: 2, pendulo: 2, bloque_rebote: 2, interruptor_estado: 1, plataforma_cae: 1, planta_carnivora: 2, mina: 1, resorte: 1 };

  Rel.aplicar = function (nivel, opts) {
    opts = opts || {};
    const N = JSON.parse(JSON.stringify(nivel)), alto = N.alto_tiles || 18, ancho = N.ancho_tiles || 160;
    const segs = N.segmentos, SMIN = alto - 6, SMAX = alto - 3;
    const rnd = rng(hash(String(opts.seed != null ? opts.seed : N.capitulo_id) + '|relieve')), inten = clamp(opts.intensidad == null ? 1 : opts.intensidad, 0, 1);
    const esSuelo = (s) => s.tipo === 'plataforma' && s.grosor == null && s.solido !== false && s.y >= SMIN;
    const suelos = segs.filter(esSuelo);
    if (!suelos.length || inten <= 0) return N;

    // altura base (la más frecuente) y altura original por columna
    const cuenta = {}; const hb = new Array(ancho).fill(null);
    for (const s of suelos) for (let i = 0; i < s.largo; i++) { const x = Math.round(s.x) + i; if (x >= 0 && x < ancho) hb[x] = s.y; cuenta[s.y] = (cuenta[s.y] || 0) + 1; }
    const h0 = +Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];
    const hmin = Math.max(SMIN, h0 - 2), hmax = Math.min(SMAX, h0 + 1);

    // ---- zonas: protegidas (no cambia el perfil) y forzadas a altura base ----
    const hold = new Array(ancho).fill(false), cero = new Array(ancho).fill(false);
    const marca = (arr, a, b) => { for (let x = Math.max(0, Math.floor(a)); x <= Math.min(ancho - 1, Math.ceil(b)); x++) arr[x] = true; };
    marca(cero, 0, 9);
    const jefe = segs.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz'), meta = segs.find((s) => s.tipo === 'meta');
    const finAntes = jefe ? jefe.x - 14 : (meta ? meta.x - 8 : ancho - 12);
    marca(cero, finAntes, ancho);
    for (const s of segs) {
      if (s.tipo === 'sprint') marca(cero, s.x_ini - 3, s.x_fin + 3);
      else if (s.tipo === 'foso') marca(hold, s.x - 2, s.x + s.largo + 1);
      else if (s.tipo === 'puente') marca(hold, s.x - 3, s.x + s.largo + 3);
      else if ((s.tipo === 'plataforma' && !esSuelo(s)) || s.tipo === 'plataforma_movil' || s.tipo === 'plataforma_estado') marca(hold, s.x - 1, s.x + (s.largo || 1) + (s.eje === 'x' && s.recorrido > 0 ? s.recorrido : 0) + 1);
      else if (PROTEGE[s.tipo] != null && typeof s.x === 'number') marca(hold, s.x - PROTEGE[s.tipo], s.x + (s.largo || s.w || 1) + PROTEGE[s.tipo]);
    }
    // ---- perfil de alturas ----
    const H = new Array(ancho); let h = h0, ult = -99, minRun = 4 + Math.floor(rnd() * 5);
    for (let x = 0; x < ancho; x++) {
      if (cero[x]) h = h0;
      else if (!hold[x] && x - ult >= minRun && (rnd() < 0.4 * inten || x - ult >= 14)) {
        let paso = rnd() < 0.5 ? 1 : -1;
        if (rnd() < 0.2 * inten) paso *= 2;
        if (h + paso < hmin || h + paso > hmax) paso = -paso;                  // rebota en los límites
        if (h - h0 <= -2 && paso < 0) paso = 1;
        if (h + paso >= hmin && h + paso <= hmax && h + paso !== h) { h += paso; ult = x; minRun = 4 + Math.floor(rnd() * 6); }
      }
      H[x] = h;
    }
    // desnivel EFECTIVO por columna (respeta los límites del suelo) y H[x] = fila real del suelo tras esculpir
    const D = new Array(ancho);
    for (let x = 0; x < ancho; x++) { if (hb[x] != null) { const yn = clamp(hb[x] + H[x] - h0, SMIN, SMAX); D[x] = yn - hb[x]; H[x] = yn; } else D[x] = H[x] - h0; }
    const dy = (x) => D[clamp(Math.floor(x), 0, ancho - 1)];

    // ---- nuevos tramos de suelo ----
    const nuevosSuelos = [];
    for (const s of suelos) {
      let ini = null, alt = null;
      const cierra = (fin) => { if (ini != null) nuevosSuelos.push({ tipo: 'plataforma', x: ini, y: alt, largo: fin - ini }); ini = null; };
      const x0 = Math.round(s.x);
      for (let i = 0; i < s.largo; i++) {
        const x = x0 + i, y = hb[clamp(x, 0, ancho - 1)] != null ? H[clamp(x, 0, ancho - 1)] : s.y;
        if (ini == null) { ini = x; alt = y; } else if (y !== alt) { cierra(x); ini = x; alt = y; }
      }
      cierra(x0 + s.largo);
    }
    const out = segs.filter((s) => !esSuelo(s));
    // ---- recolocar lo que había sobre el suelo ----
    // plataformas flotantes: se mueven primero; lo que va encima (enemigos, monedas, ítems…) hereda el mismo desplazamiento
    const planchas = [];
    for (const s of out) {
      if (!((s.tipo === 'plataforma' && s.grosor == null) || s.tipo === 'plataforma_movil' || s.tipo === 'plataforma_cae' || s.tipo === 'plataforma_estado')) continue;
      const d = dy(s.x + (s.largo ? s.largo / 2 : 0)), y0 = s.y, yN = clamp(y0 + d, 2, SMIN - 1);
      planchas.push({ x0: s.x, x1: s.x + (s.largo || 1) + (s.eje === 'x' && s.recorrido > 0 ? s.recorrido : 0), y0, d: yN - y0 }); s.y = yN; s._hecho = true;
    }
    const sobre = (x, y) => planchas.find((q) => x >= q.x0 - 0.01 && x < q.x1 && y >= q.y0 - 4 && y <= q.y0 + 0.01);
    for (const s of out) {
      if (typeof s.x !== 'number') { if (s.tipo === 'rastro_monedas' && Array.isArray(s.puntos)) s.puntos = s.puntos.map(([x, y]) => { const q = sobre(x, y); return [x, clamp(y + (q ? q.d : dy(x)), 1, alto - 2)]; }); continue; }
      if (s._hecho) { delete s._hecho; continue; }
      const flotante = s.tipo === 'plataforma';
      if (SHIFT.includes(s.tipo) || flotante) {
        const q = typeof s.y === 'number' ? sobre(s.x, s.y) : null, d = q ? q.d : dy(s.x + (s.largo ? s.largo / 2 : 0));
        if (typeof s.y === 'number' && d) s.y = clamp(s.y + d, flotante ? 2 : 1, alto - 2);
      }
    }
    // ---- ocupación: [x0, x1, yMin, yMax] de cada cosa, para colocar extras sin pisar nada y SIN mirar solo la x ----
    const ocup = [];
    const filas = (s) => { const y = s.y == null ? null : s.y; if (y == null) return null; const ext = s.tipo === 'prensa' ? 9 : s.tipo === 'pendulo' ? 5 : (s.tipo === 'tuberia' || s.tipo === 'puerta' || s.tipo === 'puerta_ecuacion') ? (s.alto || 3) : s.tipo === 'palanca' ? 2 : 1; return [y - 1, y + ext]; };
    for (const s of out) if (typeof s.x === 'number' && !['foso', 'estalactita', 'lluvia_rocas', 'checkpoint', 'meta', 'sprint', 'puente'].includes(s.tipo)) ocup.push([s.x, s.x + (s.largo || s.w || 1), ...(filas(s) || [alto - 8, alto])]);
    for (const s of out) if (s.tipo === 'checkpoint' || s.tipo === 'puente') ocup.push([s.x, s.x + (s.largo || 1), alto - 8, alto]);   // a ras de suelo
    for (const s of out) if (s.tipo === 'rastro_monedas') for (const [x, y] of s.puntos || []) ocup.push([x, x, y - 1, y + 1]);
    const pits = out.filter((s) => s.tipo === 'foso').map((s) => [s.x, s.x + s.largo - 1]);
    // libre(a,b,y0,y1): no hay foso ni otra cosa en esas columnas y filas
    const libre = (a, b, y0, y1, mx, my) => { mx = mx || 0; my = my || 0; if (a < 10 || b > finAntes - 2) return false; for (const [p, q] of pits) if (!(b + mx < p || a - mx > q)) return false; for (const [p, q, u, v] of ocup) if (!(b + mx < p || a - mx > q) && !(v + my < y0 || u - my > y1)) return false; return true; };
    // plano(a,b): el suelo está a la misma altura (y existe) en todas esas columnas
    const plano = (a, b) => { for (let x = a; x <= b; x++) if (x >= ancho || H[x] !== H[a] || hb[x] == null) return false; return true; };
    const reservar = (a, b, y0, y1) => ocup.push([a - 1, b + 1, y0, y1]);
    const extra = [], sol = [];
    const casi = Math.max(1, Math.round(inten * 10));
    // ¿hay algo sólido (o una losa flotante) en la casilla? sirve para que las monedas no caigan dentro de nada
    const celdaOcupada = (px, py) => {
      for (const s of [...out, ...nuevosSuelos, ...extra]) {
        if (s.tipo === 'plataforma') {
          if (px < s.x || px >= s.x + s.largo) continue;
          if (s.grosor != null) { if (py >= s.y && py < s.y + s.grosor) return true; }
          else if (s.y >= SMIN && s.solido !== false) { if (py >= s.y) return true; }
          else if (py === s.y) return true;
        } else if (s.tipo === 'ladrillo' && px >= s.x && px < s.x + (s.largo || 1) && py === s.y) return true;
      }
      return false;
    };

    // ---- escalinatas / pirámides de bloques (suelo plano ancho) ----
    let pirs = 0;
    const objPir = Math.max(1, Math.round(casi * 0.4));
    for (let x = 12; x < finAntes - 8 && pirs < objPir; x += 2 + Math.floor(rnd() * 3)) {
      if (rnd() > 0.45) continue;
      // de la más grande a la más pequeña: pirámide 1-2-3-2-1, colina 1-2-1 o escalón 1-2
      const forma = [[1, 2, 3, 2, 1], [1, 2, 1], [1, 2]].find((f) => { const w = f.length * 2 + 1; return plano(x, x + w) && libre(x, x + w, H[x] - 4, H[x], 1, 0); });
      if (!forma) continue;
      const base = H[x], w = forma.length * 2 + 1;
      forma.forEach((k, i) => { extra.push({ tipo: 'plataforma', x: x + 1 + i * 2, y: base - k, largo: 2, grosor: k }); sol.push([x + 1 + i * 2, x + 2 + i * 2, base - k, base - 1]); });
      reservar(x, x + w, base - 4, base); pirs++; x += w + 2;
    }
    // ---- hileras de ladrillos sobre la cabeza (se rompen desde abajo; algunos dan monedas) ----
    let nFilas = 0;
    const objFilas = Math.max(3, Math.round(casi * 0.7));
    for (let x = 14; x < finAntes - 12 && nFilas < objFilas; x += 6 + Math.floor(rnd() * 6)) {
      const l = 4 + Math.floor(rnd() * 4);
      if (!plano(x, x + l)) continue;
      const y = H[x] - 4;
      if (y < 3 || !libre(x, x + l, y, y, 0, 0)) continue;
      for (let i = 0; i < l; i++) { extra.push({ tipo: 'ladrillo', x: x + i, y, largo: 1, contenido: (i === 1 || i === l - 2 || (i === 3 && l > 5)) ? 'moneda' : 'nada' }); sol.push([x + i, x + i, y, y]); }
      reservar(x, x + l, y, y); nFilas++;
    }
    // ---- islas flotantes escalonadas con rastro de monedas ----
    let islas = 0;
    const objetivoIslas = Math.max(4, Math.round(casi * 1.2));
    for (let x = 14; x < finAntes - 10 && islas < objetivoIslas; x += 3 + Math.floor(rnd() * 4)) {
      const l1 = 3 + Math.floor(rnd() * 3);
      if (!plano(x, x + 3)) continue;
      const g = H[x];
      let y1 = null, tier2 = false, tier3 = false, y0 = 0, ancho2 = 0;
      for (const subida of [3, 2]) {            // primero 3 tiles sobre el suelo (reto), si no cabe 2
        const yy = g - subida; if (yy < 3) continue;
        const t2 = !opts.techo && rnd() < 0.6 && yy - 3 >= 3, t3 = t2 && rnd() < 0.4 && yy - 6 >= 3;
        const a0 = yy - (t3 ? 8 : t2 ? 5 : 2), a2 = l1 + (t3 ? 12 : t2 ? 7 : 2);
        if (libre(x, x + a2, a0, yy, 0, 0)) { y1 = yy; tier2 = t2; tier3 = t3; y0 = a0; ancho2 = a2; break; }
      }
      if (y1 == null) continue;
      extra.push({ tipo: 'plataforma', x: x + 1, y: y1, largo: l1 });
      const pts = []; for (let k = 0; k < l1; k++) pts.push([x + 1 + k, y1 - 2]);
      if (tier2) {
        const x2 = x + l1 + 3; extra.push({ tipo: 'plataforma', x: x2, y: y1 - 3, largo: 3 }); for (let k = 0; k < 3; k++) pts.push([x2 + k, y1 - 5]);
        if (tier3) { const x3 = x2 + 6; extra.push({ tipo: 'plataforma', x: x3, y: y1 - 6, largo: 3 }); for (let k = 0; k < 3; k++) pts.push([x3 + k, Math.max(2, y1 - 8)]); }
      }
      extra.push({ tipo: 'rastro_monedas', puntos: pts });
      reservar(x, x + ancho2, y0, y1); islas++;
    }
    // ---- arcos de monedas sobre cada foso: dibujan la trayectoria del salto ----
    for (const f of out.filter((q) => q.tipo === 'foso')) {
      const a = f.x, b = f.x + f.largo;
      if (a < 10 || b > finAntes) continue;
      const yE = Math.min(H[clamp(a - 1, 0, ancho - 1)], H[clamp(b, 0, ancho - 1)]), n = f.largo + 2, pts = [];
      for (let k = 0; k <= n; k++) { const t = k / n; pts.push([Math.round(a - 1 + t * (f.largo + 2)), Math.round(yE - 2 - 2.4 * 4 * t * (1 - t))]); }
      const buenos = pts.filter(([px, py]) => !celdaOcupada(px, py));
      if (buenos.length >= 3) extra.push({ tipo: 'rastro_monedas', puntos: buenos });
    }
    // ---- techo irregular (cuevas y hornos) ----
    if (opts.techo) {
      let x = 11;
      while (x < finAntes - 20) {
        const l = 5 + Math.floor(rnd() * 9), gr = 2 + Math.floor(rnd() * 2);   // bajan hasta la fila 2+gr (<= 5)
        let ok = true; for (const [p, q, y] of ocup) if (!(x + l < p || x > q) && y <= 2 + gr + 2) { ok = false; break; }
        if (ok) { extra.push({ tipo: 'plataforma', x, y: 2, largo: l, grosor: gr, techo: true }); sol.push([x, x + l - 1, 2, 1 + gr]); }
        x += l + 1 + Math.floor(rnd() * 3);
      }
    }
    N.segmentos = [...out, ...nuevosSuelos, ...extra];
    N.relieve = true;
    return Rel.colgarEstalactitas(N);
  };

  /** Las estalactitas que quedan bajo un bloque de techo cuelgan de su borde inferior (y = fila donde termina el techo). */
  Rel.colgarEstalactitas = function (N) {
    const techos = N.segmentos.filter((s) => s.tipo === 'plataforma' && s.techo === true);
    for (const s of N.segmentos) {
      if (s.tipo !== 'estalactita') continue;
      const t = techos.find((q) => s.x >= q.x && s.x < q.x + q.largo);
      if (t) s.y = t.y + (t.grosor || 1); else delete s.y;
    }
    return N;
  };

  /**
   * poblarAire(nivel, {seed, intensidad, errores, ambiente}) -> nivel NUEVO con más vida en el aire:
   *   · plataformas móviles: ascensores verticales (llevan a las islas altas) y lanzaderas horizontales;
   *   · enemigos voladores (murciélago zigzagueante, diablillo que pica en picado y, en laboratorios/espacio, el neutrino fantasma)
   *     con el nombre y la corrección de un error típico del capítulo (`errores`: [{nombre, correccion}]).
   * Se coloca solo en huecos libres (ni foso, ni otra cosa en esas casillas y filas). Úsalo con validar().
   */
  Rel.poblarAire = function (nivel, opts) {
    opts = opts || {};
    const N = JSON.parse(JSON.stringify(nivel)), alto = N.alto_tiles || 18, ancho = N.ancho_tiles || 160, segs = N.segmentos;
    const rnd = rng(hash(String(opts.seed != null ? opts.seed : N.capitulo_id) + '|aire')), inten = clamp(opts.intensidad == null ? 1 : opts.intensidad, 0, 1);
    const SMIN = alto - 6;
    const esSuelo = (s) => s.tipo === 'plataforma' && s.grosor == null && s.solido !== false && s.y >= SMIN;
    const G = new Array(ancho).fill(null);                         // fila del suelo por columna (null = foso o sin suelo)
    for (const s of segs.filter(esSuelo)) for (let i = 0; i < s.largo; i++) { const x = Math.round(s.x) + i; if (x >= 0 && x < ancho) G[x] = s.y; }
    for (const s of segs) if (s.tipo === 'foso') for (let i = 0; i < s.largo; i++) if (s.x + i >= 0 && s.x + i < ancho) G[s.x + i] = null;
    const jefe = segs.find((q) => q.tipo === 'jefe' || q.tipo === 'jefe_quiz'), meta = segs.find((q) => q.tipo === 'meta');
    const finAntes = jefe ? jefe.x - 14 : (meta ? meta.x - 8 : ancho - 12);
    const sprint = segs.filter((q) => q.tipo === 'sprint').map((q) => [q.x_ini - 2, q.x_fin + 2]);

    // ocupación [x0, x1, yMin, yMax] de todo lo que ya hay (incluye plataformas, bloques, techos, monedas y recorridos de móviles)
    const ocup = [];
    const caja = (s) => {
      if (s.tipo === 'plataforma' && s.grosor != null) return [s.x, s.x + s.largo, s.y - 1, s.y + s.grosor];
      if (s.tipo === 'plataforma') return [s.x, s.x + s.largo, s.y - 1, s.y + 1];
      if (s.tipo === 'plataforma_movil') { const r = s.recorrido || 0; return s.eje === 'y' ? [s.x, s.x + s.largo, Math.min(s.y, s.y + r) - 1, Math.max(s.y, s.y + r) + 1] : [Math.min(s.x, s.x + r), Math.max(s.x, s.x + r) + s.largo, s.y - 1, s.y + 1]; }
      const y = s.y == null ? null : s.y, ext = s.tipo === 'prensa' ? 9 : s.tipo === 'pendulo' ? 5 : (s.tipo === 'tuberia' || s.tipo === 'puerta' || s.tipo === 'puerta_ecuacion') ? (s.alto || 3) : s.tipo === 'palanca' ? 2 : 1;
      return [s.x, s.x + (s.largo || s.w || 1), ...(y == null ? [alto - 8, alto] : [y - 1, y + ext])];
    };
    // dur = true si es una estructura/enemigo que de verdad estorba; las monedas, gemas y carteles se pueden sobrevolar
    const DURO = ['plataforma', 'plataforma_movil', 'plataforma_cae', 'plataforma_estado', 'ladrillo', 'bloque_pregunta', 'tuberia', 'puerta', 'puerta_ecuacion', 'prensa', 'pendulo', 'cinta', 'puente', 'bloque_rebote', 'picos', 'palanca', 'interruptor_estado', 'estacion_molecula', 'bicho', 'planta_carnivora', 'mina'];
    for (const s of segs) {
      if (s.tipo === 'rastro_monedas') { for (const [x, y] of s.puntos || []) ocup.push([x, x, y - 1, y + 1, false]); continue; }
      if (typeof s.x !== 'number' || esSuelo(s) || ['foso', 'estalactita', 'lluvia_rocas', 'sprint', 'meta'].includes(s.tipo)) continue;
      ocup.push([...caja(s), DURO.includes(s.tipo)]);
    }
    for (const q of sprint) ocup.push([q[0], q[1], 0, alto, true]);
    // soloDur: ignora lo que se puede sobrevolar (monedas, gemas, carteles)
    const libre = (a, b, y0, y1, soloDur) => { if (a < 22 || b > finAntes - 2) return false; for (const [p, q, u, v, d] of ocup) { if (soloDur && d === false) continue; if (!(b < p || a > q) && !(v < y0 || u > y1)) return false; } return true; };
    const reservar = (a, b, y0, y1) => ocup.push([a, b, y0, y1, true]);
    const suelo = (a, b) => { let g = null; for (let x = a; x <= b; x++) { if (G[x] == null) return null; g = g == null ? G[x] : Math.min(g, G[x]); } return g; };   // el suelo más alto de esas columnas

    const extra = [], objMov = Math.max(2, Math.round(inten * 5)), objAire = Math.max(3, Math.round(inten * 7));
    // ---- plataformas móviles ----
    let nMov = 0, vertical = rnd() < 0.5;
    for (let x = 24; x < finAntes - 8 && nMov < objMov; x += 3 + Math.floor(rnd() * 5)) {
      const largo = 3, per = +(3.5 + rnd() * 3).toFixed(1);
      // suelo de referencia: el de la columna más cercana que tenga (la trayectoria puede cruzar fosos)
      let g = null; for (let d = 0; d <= 4 && g == null; d++) g = G[x - d] != null ? G[x - d] : (G[x + d] != null ? G[x + d] : null);
      if (g == null) continue;
      let puesto = false;
      for (const subida of [3, 2]) {                                     // a 3 (o 2) tiles del suelo: alcanzable de un salto
        const y = g - subida;
        if (vertical) {                                                  // ascensor: sube y baja hacia las islas altas
          const rec = -(3 + Math.floor(rnd() * 2));
          if (y + rec < 4 || !libre(x, x + largo, y + rec - 1, y, true)) continue;
          extra.push({ tipo: 'plataforma_movil', x, y, largo, recorrido: rec, eje: 'y', periodo: per }); reservar(x, x + largo, y + rec - 1, y); puesto = true;
        } else {                                                         // lanzadera: cruza el aire (y los fosos) de lado a lado
          const rec = 5 + Math.floor(rnd() * 4);
          if (y < 4 || !libre(x, x + largo + rec, y - 1, y, true)) continue;
          extra.push({ tipo: 'plataforma_movil', x, y, largo, recorrido: rec, eje: 'x', periodo: per }); reservar(x, x + largo + rec, y - 1, y); puesto = true;
        }
        if (puesto) break;
      }
      if (!puesto) continue;
      vertical = !vertical;
      nMov++; x += 6;
    }
    // ---- enemigos voladores ----
    const errores = (opts.errores && opts.errores.length) ? opts.errores : [{ nombre: 'Error', correccion: '' }];
    const fantasma = ['lab', 'espacio', 'campo'].includes(opts.ambiente);
    let nAire = 0, ie = Math.floor(rnd() * errores.length);
    const usados = [];
    for (let x = 26; x < finAntes - 4 && nAire < objAire; x += 3 + Math.floor(rnd() * 4)) {
      if (usados.some((u) => Math.abs(u - x) < 9)) continue;
      const g = suelo(x - 1, x + 1) == null ? (G[x] != null ? G[x] : null) : suelo(x - 1, x + 1);
      const gg = g == null ? alto - 4 : g;
      const y = Math.max(4, gg - 5 - Math.floor(rnd() * 3));
      if (!libre(x - 2, x + 2, y - 1, y + 1, true)) continue;
      const r = rnd(), bicho = fantasma && r < 0.25 ? 'neutrino' : r < 0.65 ? 'murcielago' : 'demonio';
      const e = errores[ie++ % errores.length];
      extra.push({ tipo: 'bicho', x, y, bicho, nombre: e.nombre, correccion: e.correccion }); reservar(x - 2, x + 2, y - 1, y + 1); usados.push(x); nAire++;
    }
    N.segmentos = [...segs, ...extra];
    N.aire = true;
    return N;
  };

  /**
   * poblarPeligros(nivel, {seed, intensidad, errores, ambiente, objetivo}) -> nivel NUEVO con muchos más peligros del entorno:
   *   suelo: picos, minas, sierras (fijas o en raíl), torretas, cañones de bala gigante, géiseres, prensas, plantas carnívoras;
   *   aire: láseres, sierras en raíl, plantas que cuelgan del techo.
   * Reparte según el ambiente, con huecos de seguridad (nada junto a fosos, checkpoints, carteles, estaciones ni la arena del jefe)
   * y llega a `objetivo` peligros en total (por defecto 14). Úsalo con validar().
   */
  Rel.poblarPeligros = function (nivel, opts) {
    opts = opts || {};
    const N = JSON.parse(JSON.stringify(nivel)), alto = N.alto_tiles || 18, ancho = N.ancho_tiles || 160, segs = N.segmentos;
    const rnd = rng(hash(String(opts.seed != null ? opts.seed : N.capitulo_id) + '|peligros')), inten = clamp(opts.intensidad == null ? 1 : opts.intensidad, 0.2, 1);
    const SMIN = alto - 6, HAZ = ['mina', 'prensa', 'pendulo', 'picos', 'planta_carnivora', 'estalactita', 'lluvia_rocas', 'sierra', 'torreta', 'canon_bala', 'geiser', 'laser', 'planta_techo'];
    const esSuelo = (q) => q.tipo === 'plataforma' && q.grosor == null && q.solido !== false && q.y >= SMIN;
    const G = new Array(ancho).fill(null);
    for (const q of segs.filter(esSuelo)) for (let i = 0; i < q.largo; i++) { const x = Math.round(q.x) + i; if (x >= 0 && x < ancho) G[x] = q.y; }
    for (const q of segs) if (q.tipo === 'foso') for (let i = 0; i < q.largo; i++) if (q.x + i >= 0 && q.x + i < ancho) G[q.x + i] = null;
    const jefe = segs.find((q) => q.tipo === 'jefe' || q.tipo === 'jefe_quiz'), meta = segs.find((q) => q.tipo === 'meta');
    const finAntes = jefe ? jefe.x - 14 : (meta ? meta.x - 8 : ancho - 12);
    const existentes = segs.filter((q) => HAZ.includes(q.tipo)).length;
    const total = Math.round((opts.objetivo || 14) * inten), objetivo = Math.max(6, total - existentes);
    const amb = opts.ambiente || N.ambiente || 'lab';
    const PESOS = {
      lab: { laser: 3, torreta: 3, sierra: 2, mina: 2, canon: 2, picos: 2, prensa: 1, planta_techo: 2, geiser: 1, planta: 1 },
      castillo: { geiser: 4, sierra: 3, picos: 2, torreta: 2, prensa: 2, canon: 2, mina: 1, laser: 1, planta_techo: 1 },
      cueva: { picos: 3, sierra: 2, mina: 2, torreta: 2, geiser: 3, canon: 1, planta_techo: 2, laser: 1 },
      hielo: { picos: 3, torreta: 2, canon: 3, geiser: 2, sierra: 1, mina: 1 },
      espacio: { laser: 4, torreta: 3, canon: 3, mina: 3, sierra: 2, geiser: 1 },
      nube: { laser: 3, torreta: 3, canon: 3, sierra: 2, planta_techo: 2, mina: 1 },
    };
    PESOS.horno = PESOS.castillo; PESOS.campo = PESOS.lab;
    const pesos = PESOS[amb] || PESOS.lab, bolsa = []; Object.keys(pesos).forEach((k) => { for (let i = 0; i < pesos[k]; i++) bolsa.push(k); });
    const errores = (opts.errores && opts.errores.length) ? opts.errores : [{ nombre: 'Error', correccion: '' }];
    let ie = Math.floor(rnd() * errores.length);

    // zonas vetadas: inicio, arena, sprint y todo lo que necesita suelo estable o que se interactúa
    const veto = [[0, 23], [finAntes - 2, ancho]];
    for (const q of segs) {
      if (typeof q.x !== 'number' && q.tipo !== 'sprint') continue;
      if (q.tipo === 'sprint') veto.push([q.x_ini - 2, q.x_fin + 2]);
      else if (['checkpoint', 'cartel', 'estacion_molecula', 'puerta_ecuacion', 'tuberia', 'puerta', 'palanca', 'puente', 'resorte', 'interruptor_estado', 'meta', 'plataforma_cae', 'bloque_rebote', 'cinta'].includes(q.tipo)) veto.push([q.x - 3, q.x + (q.largo || 1) + 3]);
      else if (HAZ.includes(q.tipo)) veto.push([q.x - 2, q.x + (q.largo || q.w || 1) + 2]);
      else if (q.tipo === 'enemigo') veto.push([q.x - 1, q.x + 1]);
    }
    const vetado = (a, b) => veto.some(([p, q]) => !(b < p || a > q));
    // tramos de suelo llano ≥ 9 columnas
    const tramos = []; { let i = 0; while (i < ancho) { if (G[i] == null) { i++; continue; } let j = i; while (j + 1 < ancho && G[j + 1] === G[i]) j++; if (j - i + 1 >= 4) tramos.push([i, j, G[i]]); i = j + 1; } }
    // estructuras del aire (para no chocar con láseres/sierras/plantas del techo)
    const DURO = ['plataforma', 'plataforma_movil', 'plataforma_cae', 'plataforma_estado', 'ladrillo', 'bloque_pregunta', 'tuberia', 'puerta', 'prensa', 'pendulo', 'puente'];
    const aire = [];
    for (const q of segs) {
      if (q.tipo === 'plataforma' && !esSuelo(q)) aire.push([q.x, q.x + q.largo, q.y - 1, q.y + (q.grosor || 1)]);
      else if (q.tipo === 'plataforma_movil') { const rr = q.recorrido || 0; aire.push(q.eje === 'y' ? [q.x, q.x + q.largo, Math.min(q.y, q.y + rr) - 1, Math.max(q.y, q.y + rr) + 1] : [Math.min(q.x, q.x + rr), Math.max(q.x, q.x + rr) + q.largo, q.y - 1, q.y + 1]); }
      else if (q.tipo === 'ladrillo' || q.tipo === 'bloque_pregunta') aire.push([q.x, q.x + 1, q.y, q.y]);
    }
    const aireLibre = (a, b, y0, y1) => !aire.some(([p, q, u, v]) => !(b < p || a > q) && !(v < y0 || u > y1));
    const usados = []; const lejos = (x, sep) => usados.every((u) => Math.abs(u - x) >= (sep || 5));
    const extra = [];
    const sitio = (min, margen) => {            // posición en un tramo llano con `margen` columnas libres a cada lado
      for (let intento = 0; intento < 80; intento++) {
        const t = tramos[Math.floor(rnd() * tramos.length)]; if (!t) return null;
        const a = t[0] + Math.min(margen, 2), b = t[1] - Math.min(margen, 2) - (min - 1); if (b < a) continue;
        const x = a + Math.floor(rnd() * (b - a + 1));
        if (vetado(x, x + min) || !lejos(x, 4)) continue;
        return { x, g: t[2] };
      }
      return null;
    };
    const sitioAire = (min) => {
      for (let intento = 0; intento < 80; intento++) {
        const x = 24 + Math.floor(rnd() * Math.max(1, finAntes - 28));
        let g = null; for (let d = 0; d <= 3 && g == null; d++) g = G[x - d] != null ? G[x - d] : G[x + d];
        if (g == null || vetado(x, x + min) || !lejos(x, 4)) continue;
        return { x, g };
      }
      return null;
    };
    const poner = (seg, a, b) => { extra.push(seg); veto.push([a - 1, b + 1]); usados.push(a); };
    const hacer = {
      picos() { const l = 2 + Math.floor(rnd() * 2), q = sitio(l, 3); if (!q) return false; poner({ tipo: 'picos', x: q.x, y: q.g - 1, largo: l }, q.x, q.x + l); return true; },
      mina() { const q = sitio(1, 3); if (!q) return false; poner({ tipo: 'mina', x: q.x, y: q.g - 1, modo: rnd() < 0.5 ? 'contacto' : 'temporizador', radio: 1.4 }, q.x, q.x + 1); return true; },
      sierra() {
        if (rnd() < 0.5) { const q = sitio(5, 3); if (!q) return false; poner({ tipo: 'sierra', x: q.x, y: q.g - 1, eje: 'x', recorrido: 3, periodo: +(3 + rnd() * 2).toFixed(1) }, q.x, q.x + 4); return true; }   // sierra que recorre el suelo
        const q = sitioAire(5); if (!q) return false;                                                                                                                                              // sierra aérea en raíl vertical
        const y = q.g - 6; if (y < 4 || !aireLibre(q.x, q.x + 1, y - 1, y + 5)) return false; poner({ tipo: 'sierra', x: q.x + 2, y, eje: 'y', recorrido: 4, periodo: +(3 + rnd() * 2).toFixed(1) }, q.x, q.x + 4); return true;
      },
      torreta() { const q = sitio(1, 3); if (!q) return false; const e = errores[ie++ % errores.length]; poner({ tipo: 'torreta', x: q.x, y: q.g - 1, periodo: +(2.4 + rnd() * 0.8).toFixed(1), nombre: e.nombre, correccion: e.correccion }, q.x, q.x + 1); return true; },
      canon() { const q = sitio(1, 2); if (!q) return false; const t = tramos.find((u) => q.x >= u[0] && q.x <= u[1]); const dir = (q.x - t[0]) < (t[1] - q.x) ? 1 : -1; poner({ tipo: 'canon_bala', x: q.x, y: q.g - 1, dir, periodo: +(3.4 + rnd() * 1.2).toFixed(1), retardo: +(rnd() * 3).toFixed(1) }, q.x, q.x + 1); return true; },
      geiser() { const q = sitio(1, 3); if (!q) return false; poner({ tipo: 'geiser', x: q.x, y: q.g, alto: 4 + Math.floor(rnd() * 2), periodo: +(3.6 + rnd() * 1.4).toFixed(1), retardo: +(rnd() * 3).toFixed(1) }, q.x, q.x + 1); return true; },
      prensa() { const q = sitio(2, 3); if (!q) return false; if (!aireLibre(q.x, q.x + 2, q.g - 6, q.g - 1)) return false; poner({ tipo: 'prensa', x: q.x, y: q.g - 5, largo: 2, periodo: +(3 + rnd() * 1).toFixed(1), retardo: +(rnd() * 2).toFixed(1) }, q.x, q.x + 2); return true; },
      planta() { const q = sitio(2, 3); if (!q) return false; poner({ tipo: 'planta_carnivora', x: q.x, y: q.g - 1, ciclo: +(3.2 + rnd() * 0.8).toFixed(1), visible: 1.2 }, q.x, q.x + 2); return true; },
      laser() {
        const q = rnd() < 0.5 ? sitio(5, 2) : sitioAire(5); if (!q) return false;
        if (rnd() < 0.5) { poner({ tipo: 'laser', x: q.x, y: q.g - 1, eje: 'h', largo: 5, periodo: +(3.2 + rnd() * 1.2).toFixed(1), retardo: +(rnd() * 3).toFixed(1) }, q.x, q.x + 5); return true; }
        const y = q.g - 5; if (y < 3 || !aireLibre(q.x + 2, q.x + 3, y, q.g)) return false;
        poner({ tipo: 'laser', x: q.x + 2, y, eje: 'v', largo: 5, periodo: +(3.2 + rnd() * 1.2).toFixed(1), retardo: +(rnd() * 3).toFixed(1) }, q.x, q.x + 5); return true;
      },
      planta_techo() { const q = sitioAire(1); if (!q) return false; const largo = q.g - 6; if (largo < 3 || !aireLibre(q.x - 1, q.x + 1, 0, largo + 2)) return false; poner({ tipo: 'planta_techo', x: q.x, largo, ciclo: +(3.2 + rnd() * 0.8).toFixed(1), visible: 1.3 }, q.x, q.x + 1); return true; },
    };
    let n = 0, fallos = 0;
    while (n < objetivo && fallos < 400) { const k = bolsa[Math.floor(rnd() * bolsa.length)]; if (hacer[k] && hacer[k]()) n++; else fallos++; }
    N.segmentos = [...segs, ...extra];
    N.peligros = true;
    return N;
  };

  // ---------- exportación ----------
  if (typeof module !== 'undefined' && module.exports) module.exports = Rel;
  if (root.PCB && root.PCB.juego) root.PCB.juego.Relieve = Rel;
})(typeof window !== 'undefined' ? window : globalThis);
