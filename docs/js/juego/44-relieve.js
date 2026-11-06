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

  // ---------- exportación ----------
  if (typeof module !== 'undefined' && module.exports) module.exports = Rel;
  if (root.PCB && root.PCB.juego) root.PCB.juego.Relieve = Rel;
})(typeof window !== 'undefined' ? window : globalThis);
