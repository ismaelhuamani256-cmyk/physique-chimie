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
  const SOLIDO = (t) => t === 1 || t === 3 || t === 4;

  function geometria(nivel) {
    const ancho = Math.round(num(nivel.ancho_tiles, 0)), alto = Math.round(num(nivel.alto_tiles, 0));
    const segs = Array.isArray(nivel.segmentos) ? nivel.segmentos : [];
    const tiles = new Uint8Array(Math.max(0, ancho * alto));
    const G = { ancho, alto, tiles, movers: [], resortes: [], campos: [], fosos: [], arena: null, puente: null, meta: null, jefe: null, palanca: null };
    const get = (x, y) => (x < 0 || x >= ancho || y < 0 || y >= alto ? 0 : tiles[y * ancho + x]);
    const set = (x, y, v) => { if (x >= 0 && x < ancho && y >= 0 && y < alto) tiles[y * ancho + x] = v; };
    G.get = get;
    G.topAt = (x) => { for (let y = 0; y < alto; y++) if (get(x, y)) return y; return -1; };

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
    // 3) objetos
    for (const s of segs) {
      if (s.tipo === 'plataforma_movil') {
        G.movers.push({ x: num(s.x, 0), y: num(s.y, 0), largo: Math.max(1, Math.round(num(s.largo, 3))), rec: num(s.recorrido, 4),
          eje: s.eje === 'y' ? 'y' : 'x', per: Math.max(0.5, num(s.periodo, 3)), seg: s });
      } else if (s.tipo === 'resorte') G.resortes.push({ x: Math.round(num(s.x, 0)), y: Math.round(num(s.y, 0)), seg: s });
      else if (s.tipo === 'zona_campo') G.campos.push({ x: num(s.x, 0), y: num(s.y, 0), w: num(s.w, 1), h: num(s.h, 1), fx: num(s.fx, 0), fy: num(s.fy, 0), seg: s });
      else if (s.tipo === 'meta' && !G.meta) G.meta = { x: Math.round(num(s.x, 0)), seg: s };
      else if (s.tipo === 'jefe' && !G.jefe) G.jefe = { x: Math.round(num(s.x, 0)), seg: s };
    }
    // 4) arena del jefe: paredes en izq y der; en fortaleza el suelo de la arena es un puente
    if (G.jefe) {
      const fort = nivel.tipo_nivel === 'fortaleza' || G.jefe.seg.jefe === 'rey_entropia';
      const metaX = G.meta ? G.meta.x : ancho - 2;
      const palancaX = fort ? metaX - 4 : null;
      G.arena = { izq: G.jefe.x - 12, der: fort ? palancaX - 1 : metaX - 1, fort, palancaX };
      if (fort) {
        const y = G.topAt(Math.max(0, G.arena.izq + 1));
        if (y >= 0) {
          for (let x = G.arena.izq; x < palancaX; x++) {
            if (G.topAt(x) !== y) continue;   // columna no uniforme: lo reportará el validador
            for (let yy = y; yy < alto; yy++) set(x, yy, 0);
            set(x, y, 3);
          }
          G.puente = { x0: G.arena.izq, x1: palancaX, y };
        }
        const ty = G.topAt(palancaX);
        if (ty >= 0) G.palanca = { x: palancaX, y: ty - 1 };
      }
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
        const t = x < G.ancho ? G.get(x, y) : 0;
        const esSup = t !== 0 && !SOLIDO(G.get(x, y - 1));
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
    if (nivel.tipo_nivel !== 'normal' && nivel.tipo_nivel !== 'fortaleza') E(`tipo_nivel debe ser "normal" o "fortaleza" (vale ${JSON.stringify(nivel.tipo_nivel)}).`);
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
    const TIPOS = ['plataforma', 'foso', 'plataforma_movil', 'resorte', 'coleccionable', 'enemigo', 'zona_campo', 'checkpoint', 'jefe', 'meta'];
    const G = geometria(nivel);
    const dentroX = (x) => x >= 0 && x < ancho, dentroY = (y) => y >= 0 && y < alto;
    const desc = (s, i) => `segmento #${i} (${s.tipo}${s.x != null ? ' x=' + s.x : ''}${s.y != null ? ' y=' + s.y : ''})`;
    const esNum = (v) => typeof v === 'number' && isFinite(v);

    // --- tipos y campos numéricos de cada segmento ---
    segs.forEach((s, i) => {
      if (!s || typeof s !== 'object' || !TIPOS.includes(s.tipo)) { E(`segmento #${i}: tipo desconocido ${JSON.stringify(s && s.tipo)}.`); return; }
      if (!esNum(s.x)) { E(`${desc(s, i)}: falta x numérica.`); return; }
      if (['plataforma', 'plataforma_movil', 'resorte', 'coleccionable', 'enemigo', 'zona_campo'].includes(s.tipo) && !esNum(s.y)) E(`${desc(s, i)}: falta y numérica.`);
      if (['plataforma', 'foso', 'plataforma_movil'].includes(s.tipo) && !(esNum(s.largo) && s.largo >= 1)) E(`${desc(s, i)}: "largo" debe ser un número >= 1.`);
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
    const metas = por('meta'), jefes = por('jefe');
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
    const maxExt = segs.reduce((m, s) => Math.max(m, s.x + (s.largo || 0) + (s.tipo === 'plataforma_movil' && s.eje !== 'y' ? Math.max(0, s.recorrido || 0) : 0)), 0);
    if (maxExt > ancho) E(`Hay segmentos que llegan hasta x=${maxExt} > ancho_tiles=${ancho}.`);

    // --- punto de inicio ---
    const spawnX = 2, spawnY = G.topAt(spawnX);
    if (spawnY < 0) E(`No hay suelo bajo el punto de inicio (x=${spawnX}). Empieza el nivel con una plataforma que cubra x=0..4.`);

    // --- física: fosos, plataformas móviles, resortes, zonas ---
    for (const f of G.fosos) if (f.largo > F.gapSeguro) {
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
        for (let xx = Math.floor(p.x); xx < Math.ceil(p.x + m.largo); xx++) if (SOLIDO(G.get(xx, Math.round(p.y)))) choca = true;
        if (choca) { E(`plataforma_movil en x=${sg.x}, y=${sg.y}: su recorrido atraviesa un bloque sólido.`); break; }
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
    if (cols.length < 5) E(`Hay ${cols.length} coleccionables; el contrato exige >= 5.`);
    if (enes.length < 3) E(`Hay ${enes.length} enemigos; el contrato exige >= 3.`);
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
      if (!apoyo) E(`enemigo "${e.enemigo}" (x=${e.x}, y=${e.y}) flota: no hay suelo en los 3 tiles siguientes.`);
      if (typeof e.enemigo !== 'string' || !e.enemigo) E(`enemigo en x=${e.x} sin id "enemigo".`);
      if (typeof e.correccion !== 'string' || !e.correccion.trim()) E(`enemigo "${e.enemigo}" sin "correccion".`);
      if (typeof e.nombre !== 'string' || !e.nombre.trim()) E(`enemigo "${e.enemigo}" sin "nombre".`);
    }

    // --- jefe ---
    const jefe = jefes[0];
    if (nivel.tipo_nivel === 'fortaleza' && (!jefe || jefe.jefe !== 'rey_entropia')) E('Un nivel "fortaleza" necesita un segmento jefe con jefe:"rey_entropia".');
    if (nivel.tipo_nivel === 'normal' && jefe && jefe.jefe === 'rey_entropia') W('rey_entropia en un nivel "normal": se tratará como fortaleza.');
    if (jefe) {
      const ps = jefe.preguntas;
      if (!Array.isArray(ps) || ps.length < 3) E(`El jefe necesita >= 3 preguntas (tiene ${Array.isArray(ps) ? ps.length : 0}).`);
      else ps.forEach((q, i) => {
        if (!q || typeof q.pregunta !== 'string' || !q.pregunta.trim()) E(`jefe, pregunta #${i + 1}: falta el enunciado.`);
        else if (!Array.isArray(q.opciones) || q.opciones.length < 2 || q.opciones.length > 6 || q.opciones.some((o) => typeof o !== 'string' || !o.trim())) E(`jefe, pregunta #${i + 1}: "opciones" debe ser un array de 2 a 6 textos.`);
        else if (!Number.isInteger(q.correcta) || q.correcta < 0 || q.correcta >= q.opciones.length) E(`jefe, pregunta #${i + 1}: "correcta" (${q.correcta}) no es un índice válido de opciones (0..${q.opciones.length - 1}).`);
      });
      const A = G.arena;
      if (A) {
        if (A.izq < 4) E(`jefe en x=${jefe.x}: la arena empezaría en x=${A.izq}; mueve el jefe a x >= 16.`);
        const ancho_int = A.der - (A.izq + 1);
        if (ancho_int < 14) E(`Arena del jefe demasiado estrecha (${ancho_int} tiles interiores, mínimo 14). La arena va de jefe.x-12 a ${A.fort ? 'meta.x-5' : 'meta.x-1'}.`);
        const y0 = G.fosos.length ? null : null; void y0;
        const ref = G.puente ? G.puente.y : G.topAt(A.izq + 1);
        for (let x = A.izq; x <= (A.fort ? A.palancaX : A.der); x++) {
          const t = A.fort && x < A.palancaX ? (G.get(x, ref) === 3 ? ref : -1) : G.topAt(x);
          if (t !== ref) { E(`Arena del jefe: el suelo debe ser plano y continuo entre x=${A.izq} y x=${A.fort ? A.palancaX : A.der} (falla en x=${x}).`); break; }
        }
        if (G.movers.some((m) => m.x < A.der + 1 && m.x + m.largo + Math.abs(m.rec) > A.izq)) W('Hay plataformas móviles dentro de la arena del jefe.');
        if (A.fort && G.palanca == null) E('Fortaleza: no hay suelo en la posición de la palanca (meta.x-4).');
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
    const ini = sup.find((s) => s.tipo === 'estatica' && s.x0 <= spawnX && spawnX < s.x1 && s.y === spawnY);
    const vis = new Set();
    if (ini) {
      const cola = [ini]; vis.add(ini);
      while (cola.length) {
        const a = cola.shift();
        for (const b of sup) if (!vis.has(b) && puede(a, b)) { vis.add(b); cola.push(b); }
      }
      for (const s of sup) if (!vis.has(s)) {
        if (s.tipo === 'movil') E(`La plataforma móvil en x=${s.mover.seg.x}, y=${s.mover.seg.y} es inalcanzable (altura ≤ ${F.hSeguro.toFixed(1)} tiles, hueco ≤ ${F.gapSeguro.toFixed(1)} tiles).`);
        else E(`La plataforma en x=${s.x0}..${s.x1 - 1}, y=${s.y} es inalcanzable desde el inicio (altura segura ${F.hSeguro.toFixed(1)}, hueco seguro ${F.gapSeguro.toFixed(1)} tiles).`);
      }
      if (meta) {
        const ty = G.topAt(meta.x);
        const sm = sup.find((s) => s.tipo === 'estatica' && s.x0 <= meta.x && meta.x < s.x1 && s.y === ty);
        if (sm && !vis.has(sm)) E(`La meta (x=${meta.x}) no es accesible desde el inicio.`);
      }
      // coleccionables alcanzables desde alguna superficie visitada
      const alcanzables = sup.filter((s) => vis.has(s));
      for (const c of cols) {
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
        if (!ok) E(`coleccionable "${c.ref}" (x=${c.x}, y=${c.y}) no se puede alcanzar con el salto (altura máx. ≈ ${(F.hSeguro + FIS.H).toFixed(1)} tiles sobre el suelo).`);
      }
    }

    return fin();
  }

  // ---------- exportación ----------
  J.FIS = FIS; J.fisica = fisica; J.geometria = geometria; J.posMovil = posMovil; J.validar = validar; J.gapMax = gapMax;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validar, geometria, fisica, FIS, posMovil, superficies, gapMax, alturaSegura };
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
