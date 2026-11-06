// =====================================================================================
// 44-cueva.js — CUEVA SUBMARINA: convierte un nivel de agua «abierto» en una cueva con techo rocoso, jorobas en el fondo
//   y fauna peligrosa (navegador y Node; determinista por seed).
//   Cueva.aplicar(nivel, {seed, intensidad:0..1}) -> nivel NUEVO (el original no se toca). Úsalo con validar() y quédate
//   con el original si no pasa.
//     · techo irregular de 0..5 tiles (segmentos plataforma{techo:true, grosor}) y jorobas de 0..3 tiles en el suelo;
//       siempre queda un pasillo de ≥ 6 tiles; el inicio, las puertas, tuberías, bloques, checkpoints y la arena del jefe no se tocan;
//     · fauna (52-fauna.js): bancos de pirañas, tiburón gigante, langostas, submarinos, peces globo, magos, minas flotantes;
//       y sierras sobre raíl y láseres horizontales (51-peligros.js).
// =====================================================================================
(function (root) {
  'use strict';
  const Cueva = {};
  const hash = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  Cueva.aplicar = function (nivel, opts) {
    opts = opts || {};
    const N = JSON.parse(JSON.stringify(nivel)), alto = N.alto_tiles || 18, ancho = N.ancho_tiles || 160, segs = N.segmentos;
    const inten = clamp(opts.intensidad == null ? 1 : opts.intensidad, 0, 1), rnd = rng(hash(String(opts.seed != null ? opts.seed : N.capitulo_id) + '|cueva'));
    const zona = segs.find((s) => s.tipo === 'zona_agua');
    const cuenta = {}; for (const s of segs) if (s.tipo === 'plataforma' && s.grosor == null && s.y >= alto - 6) cuenta[s.y] = (cuenta[s.y] || 0) + s.largo;
    const SUELO = +Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];   // fila de la superficie del suelo (la más frecuente)
    if (!(SUELO > 0)) return N;
    if (!zona || inten <= 0) return N;
    const jefe = segs.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz');
    const finLibre = jefe ? Math.floor(jefe.x) - 14 : ancho - 8;     // hasta aquí hay cueva; la arena queda despejada
    const meta = segs.find((s) => s.tipo === 'meta');
    const fin = Math.min(finLibre, meta ? meta.x - 6 : ancho);

    // ---- columnas protegidas y altura libre máxima del techo por columna ----
    const prot = new Uint8Array(ancho + 2), techoMax = new Array(ancho + 2).fill(5);
    const marca = (a, b, v) => { for (let x = Math.max(0, Math.floor(a)); x <= Math.min(ancho + 1, Math.floor(b)); x++) prot[x] = Math.max(prot[x], v); };
    marca(0, 17, 2);
    for (const s of segs) {
      if (s.tipo === 'zona_agua' || s.tipo === 'plataforma' && s.y >= alto - 6 && s.grosor == null) continue;
      if (typeof s.x !== 'number') continue;
      const ext = s.tipo === 'plataforma' || s.tipo === 'plataforma_movil' || s.tipo === 'plataforma_cae' || s.tipo === 'ladrillo' ? (s.largo || 1) : s.tipo === 'foso' ? (s.largo || 1) : s.tipo === 'zona_campo' ? (s.w || 1) : 1;
      const m = ['tuberia', 'puerta', 'checkpoint', 'foso', 'bloque_pregunta', 'ladrillo', 'planta_carnivora', 'palanca', 'prensa', 'cartel', 'estacion_molecula', 'puerta_ecuacion', 'sierra', 'torreta', 'canon_bala', 'laser', 'geiser', 'fauna'].includes(s.tipo) ? 2 : 1;
      marca(s.x - m, s.x + ext + m - 1, 1);
      if (typeof s.y === 'number' && !['foso'].includes(s.tipo)) {
        const yTop = s.tipo === 'puerta' ? s.y : s.y, lim = Math.max(0, Math.floor(yTop) - 3);
        for (let x = Math.max(0, Math.floor(s.x) - 1); x <= Math.min(ancho + 1, Math.floor(s.x + ext)); x++) techoMax[x] = Math.min(techoMax[x], lim);
      }
    }
    // suelo existente por columna (solo hay cueva donde hay suelo normal a la altura base)
    const hSuelo = new Array(ancho + 2).fill(null);
    for (const s of segs) if (s.tipo === 'plataforma' && s.grosor == null && s.y >= alto - 6) for (let i = 0; i < s.largo; i++) { const x = Math.round(s.x) + i; if (x >= 0 && x <= ancho) hSuelo[x] = s.y; }

    // ---- perfil del techo (ruido de senos) y de las jorobas ----
    const f1 = 0.09 + rnd() * 0.05, f2 = 0.21 + rnd() * 0.08, p1 = rnd() * 6.28, p2 = rnd() * 6.28, f3 = 0.06 + rnd() * 0.04, p3 = rnd() * 6.28;
    const d = new Array(ancho + 2).fill(0), hh = new Array(ancho + 2).fill(0);
    for (let x = 18; x < fin; x++) {
      const v = 0.5 + 0.28 * Math.sin(x * f1 + p1) + 0.16 * Math.sin(x * f2 + p2), u = 0.5 + 0.35 * Math.sin(x * f3 + p3) + 0.12 * Math.sin(x * f2 * 1.3 + p1);
      d[x] = clamp(Math.round(v * 6 * (0.55 + 0.45 * inten)) - 0, 0, Math.min(5, techoMax[x]));
      hh[x] = hSuelo[x] === SUELO && !prot[x] ? clamp(Math.round((u - 0.38) * 7 * inten), 0, 3) : 0;
    }
    // suavizado: saltos máximos de 2 y pasillo mínimo de 6 tiles
    for (let k = 0; k < 3; k++) for (let x = 19; x < fin; x++) { d[x] = Math.min(d[x], d[x - 1] + 2); hh[x] = prot[x] ? 0 : Math.min(hh[x], hh[x - 1] + 2); }
    for (let x = fin - 2; x >= 18; x--) { d[x] = Math.min(d[x], d[x + 1] + 2); if (!prot[x]) hh[x] = Math.min(hh[x], hh[x + 1] + 2); }
    for (let x = 18; x < fin; x++) { while (d[x] + hh[x] > 8) { if (hh[x] > 0) hh[x]--; else d[x]--; } if (prot[x]) hh[x] = 0; }
    // las jorobas tienen al menos 2 columnas de ancho (evita pinchos de 1 tile)
    for (let x = 19; x < fin - 1; x++) if (hh[x] > 0 && hh[x - 1] === 0 && hh[x + 1] === 0) hh[x] = 0;

    // ---- emitir segmentos ----
    const nuevos = [];
    const corre = (arr, f) => { let x = 18; while (x < fin) { const v = arr[x]; let y = x; while (y + 1 < fin && arr[y + 1] === v) y++; if (v > 0) f(x, y - x + 1, v); x = y + 1; } };
    corre(d, (x, largo, v) => nuevos.push({ tipo: 'plataforma', x, y: 0, largo, grosor: v, techo: true }));
    corre(hh, (x, largo, v) => nuevos.push({ tipo: 'plataforma', x, y: SUELO - v, largo, grosor: v }));
    const libreCol = (x, y) => y > d[x] && y < SUELO - hh[x];

    // ---- fauna ----
    const ocupados = segs.filter((s) => typeof s.x === 'number' && ['enemigo', 'coleccionable', 'bloque_pregunta', 'tuberia', 'puerta', 'checkpoint', 'atomo', 'item', 'bicho', 'ladrillo'].includes(s.tipo));
    const puestos = [];
    const apto = (x, y, sep) => ocupados.every((s) => Math.hypot(s.x - x, (s.y == null ? y : s.y) - y) > 2.5) && puestos.every((q) => Math.abs(q.x - x) > sep || Math.abs(q.y - y) > 3);
    const lista = [];
    const n = Math.round(((fin - 24) / 6.2) * (0.5 + 0.5 * inten));
    const bolsa = ['pirana', 'pirana', 'pirana', 'globo', 'globo', 'langosta', 'langosta', 'mina', 'mina', 'mina', 'submarino', 'mago', 'tiburon', 'sierra', 'laser', 'sierra'];
    const cuentas = {}, tope = { tiburon: Math.max(1, Math.round(fin / 90)), submarino: 3, mago: 3, laser: 3, sierra: 4 };
    let intentos = 0;
    while (lista.length < n && intentos++ < n * 40) {
      const esp = bolsa[Math.floor(rnd() * bolsa.length)];
      if (tope[esp] && (cuentas[esp] || 0) >= tope[esp]) continue;
      const x = 20 + Math.floor(rnd() * (fin - 22));
      if (prot[x] > 1 || x < 20) continue;
      const alt = SUELO - hh[x] - d[x];   // espacio libre vertical
      if (alt < 6) continue;
      const y = Math.floor(d[x] + 2 + rnd() * (alt - 4));
      if (!libreCol(x, y)) continue;
      const sep = esp === 'tiburon' ? 12 : esp === 'submarino' ? 9 : 6;
      if (esp === 'langosta') {
        if (!(hh[x - 1] === hh[x] && hh[x] === hh[x + 1] && hh[x + 1] === hh[x + 2] && hh[x - 2] === hh[x])) continue;
        const yy = SUELO - hh[x] - 1; if (!apto(x, yy, sep) || prot[x]) continue;
        lista.push({ tipo: 'fauna', especie: 'langosta', x, y: yy }); puestos.push({ x, y: yy }); cuentas[esp] = (cuentas[esp] || 0) + 1; continue;
      }
      if (!apto(x, y, sep)) continue;
      if (esp === 'pirana') { [[0, 0], [2, -1], [2, 1]].forEach(([ox, oy], k) => { const px = x + ox, py = clamp(y + oy, d[px] + 1, SUELO - hh[px] - 2); if (libreCol(px, py)) lista.push({ tipo: 'fauna', especie: 'pirana', x: px, y: py }); }); }
      else if (esp === 'sierra') { if (!(libreCol(x, y) && libreCol(x + 3, y) && alt >= 7)) continue; lista.push({ tipo: 'sierra', x, y, eje: 'x', recorrido: 3, periodo: 3.4 + rnd() * 1.4 }); }
      else if (esp === 'laser') { let ok = true; for (let k = 0; k < 5; k++) if (!libreCol(x + k, y)) ok = false; if (!ok) continue; lista.push({ tipo: 'laser', x, y, eje: 'h', largo: 5, periodo: 3.4 + rnd() * 0.8, retardo: rnd() * 2 }); }
      else lista.push({ tipo: 'fauna', especie: esp, x, y });
      puestos.push({ x, y }); cuentas[esp] = (cuentas[esp] || 0) + 1;
    }
    N.segmentos = segs.concat(nuevos, lista);
    N.cueva = { techoMax: Math.max(...d), jorobas: Math.max(...hh), fauna: lista.length };
    return N;
  };

  root.Cueva = Cueva;
  if (typeof module !== 'undefined' && module.exports) module.exports = Cueva;
  else if (root.PCB && root.PCB.juego) root.PCB.juego.Cueva = Cueva;
})(typeof window !== 'undefined' ? window : globalThis);
