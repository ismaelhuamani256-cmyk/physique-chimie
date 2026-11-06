// =====================================================================================
// 10-generador.js — QUIZ QUEST · generador de niveles por código (CONTRATO §4b)
//
//   PCB.quizquest.generar(capId, banco, semilla) -> { tierra, agua, castillo, meta }
//
// Tres niveles JSON (mismo esquema que contenido/niveles/*.json + segmentos de §4b):
//   · tierra    tipo_nivel "quiz_tierra"    tema del capítulo · bloques ?, tuberías (atajo + bonus), puertas
//   · agua      tipo_nivel "quiz_agua"      tema "submarino"   · zona_agua que cubre todo el nivel, enemigos acuáticos
//   · castillo  tipo_nivel "quiz_castillo"  tema "lava-fortaleza" · puente + palanca opcional y jefe_quiz con ≥ 5 preguntas
//
// Elementos de plataformas (CONTRATO §4b «Más elementos»): hileras de `ladrillo` (nada / moneda / moneda_multi y un `?` escondido),
// 1–2 `plataforma_cae` sobre fosos cortos (la alternativa segura es saltar el foso) en tierra y castillo, y `planta_carnivora`
// en ~45 % de las tuberías (el motor suelta además una planta si la pregunta de la tubería se falla).
//
// Elección del jefe (documentada, ver JEFES más abajo):
//   mundo constitucion -> castillo: rey_entropia   (criatura de lava y engranajes; es el jefe de las fortalezas)
//   mundo mouvement    -> castillo: golem_formulas (un golem de ecuaciones: fuerzas, vectores…)
//   mundo energie      -> AGUA: pulpo_acido (jefe de agua) y castillo: golem_formulas
//   mundo ondes        -> castillo: dragon_tormenta (rayos y nubes: ondas y señales)
//   Extra de criterio: los dos capítulos de ácidos y bases (acide-base, force-acides-bases) añaden además
//   el pulpo_acido como jefe de la fase de agua, porque es un «calamar de ácido».
//
// Todo es determinista respecto a (capId, semilla): la misma semilla da la misma partida; otra semilla
// cambia posiciones, orden de tramos, premios, enemigos, fórmulas y preguntas.
// Cada nivel se valida con PCB.quizquest.validar (motor `PCB.juego.validar` si ya entiende los segmentos
// nuevos; si no, una «vista compatible» que quita los segmentos nuevos y comprueba la geometría de salto).
//
// Convenciones de coordenadas (README del motor): 1 tile = 1 unidad, y crece hacia abajo, alto_tiles = 18,
// superficie del suelo en y = 14.  Objetos con extensión (tuberia, puerta, bloque_pregunta): (x, y) = casilla
// SUPERIOR-IZQUIERDA; ocupan las filas y … y+alto-1.  Una tubería de alto 2 sobre el suelo y=14 lleva y = 12.
// Criaturas y objetos de 1 casilla (enemigo, resorte, palanca, coleccionable): (x, y) = la casilla que ocupan.
// =====================================================================================
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const PCB = (root.PCB = root.PCB || {});
  const QQ = (PCB.quizquest = PCB.quizquest || {});
  const U = (QQ.util = QQ.util || {});

  const ALTO = 18;          // alto_tiles de todas las fases
  const GY = 14;            // fila de la superficie del suelo (y de las plataformas de suelo)
  const MAX_INTENTOS = 12;  // reintentos de generación si algún nivel no valida

  // ---------------------------------------------------------------------------------
  // Jefes por mundo
  // ---------------------------------------------------------------------------------
  const JEFES = {
    constitucion: { agua: null, castillo: 'rey_entropia' },
    mouvement: { agua: null, castillo: 'golem_formulas' },
    energie: { agua: 'pulpo_acido', castillo: 'golem_formulas' },
    ondes: { agua: null, castillo: 'dragon_tormenta' },
  };
  const JEFE_TITULO = {
    rey_entropia: 'Rey Entropía, señor de la lava y los engranajes',
    golem_formulas: 'Gólem de Fórmulas, guardián de las ecuaciones',
    pulpo_acido: 'Pulpo Ácido, el calamar de las profundidades',
    dragon_tormenta: 'Dragón de la Tormenta, jinete de rayos',
    isotopo_inestable: 'Isótopo Inestable, núcleo que se desintegra',
    foton_veloz: 'Fotón Veloz, la luz hecha rayo',
    bombardero_neutron: 'Bombardero Neutrón, reactor volador',
  };
  /** Jefes de física moderna por capítulo (sustituyen al del mundo). */
  const JEFE_CAP = { nucleaires: 'bombardero_neutron', photons: 'foton_veloz' };
  /** Capítulos con jefe de agua extra por afinidad temática (criterio documentado arriba). */
  const AGUA_EXTRA = { 'acide-base': 'pulpo_acido', 'force-acides-bases': 'pulpo_acido' };
  const jefesDe = (capId, mundo) => {
    const b = JEFES[mundo] || JEFES.constitucion;
    return { agua: AGUA_EXTRA[capId] || b.agua, castillo: JEFE_CAP[capId] || b.castillo };
  };

  const ACUATICOS = ['medusa', 'pez', 'erizo', 'anguila'];
  const slug = (s) => U.quita(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 28) || 'error';

  // ---------------------------------------------------------------------------------
  // Física: valores seguros de salto del nivel (copia de PCB.juego.fisica si está cargado)
  // ---------------------------------------------------------------------------------
  function fisica(fj) {
    if (PCB.juego && PCB.juego.fisica) return PCB.juego.fisica({ fisica_juego: fj });
    const G0 = 20.57, VMAX = 5.5, g = G0 * fj.gravedad, v0 = fj.salto, hMax = (v0 * v0) / (2 * g);
    return { hMax, hSeguro: hMax - 0.35, distMax: (VMAX * 2 * v0) / g, gapSeguro: (VMAX * 2 * v0) / g - 0.4, hResorte: Math.pow(v0 * 1.45, 2) / (2 * g) };
  }

  // ---------------------------------------------------------------------------------
  // Bolsa de preguntas: reparte el banco SIN REPETIR dentro de la partida
  // ---------------------------------------------------------------------------------
  const PESO = { quiz: 3, nocion: 2, formula: 2, nombre: 1, simbolo: 2, inverso: 1, unidad: 1.4, error: 1, constante: 0.7 };
  function crearBolsa(banco, rnd) {
    const grupos = {};
    for (const q of banco.preguntas) (grupos[q.cat] = grupos[q.cat] || []).push(q);
    const seq = [];
    for (const cat of Object.keys(grupos)) U.shuffle(grupos[cat], rnd).forEach((q, i) => seq.push({ q, k: (i + rnd()) / (PESO[cat] || 1) }));
    seq.sort((a, b) => a.k - b.k);
    const opc = seq.map((s) => s.q).filter((q) => q.tipo === 'opcion');
    const num = seq.map((s) => s.q).filter((q) => q.tipo === 'numerico');
    const usadas = [];
    const B = {
      repeticiones: 0,
      /** Siguiente pregunta de opción (si se agotase el banco, recicla la más antigua). */
      opcion() { const q = opc.shift(); if (q) { usadas.push(q); return q; } B.repeticiones++; return usadas[(B.repeticiones - 1) % usadas.length]; },
      /** Para puertas: a veces una numérica (se escribe el valor; el motor usa PCB.estudio.corregirNumerico). */
      puerta(permiteNum) { return permiteNum && num.length && rnd() < 0.5 ? (usadas.push(num[0]), num.shift()) : B.opcion(); },
      /** Preguntas de un jefe: `curadas` primero (las del nivel original) y se completa hasta n con el banco. */
      jefe(n, curadas) {
        const sel = (curadas || []).slice(0, n);
        while (sel.length < n) sel.push(B.opcion());
        return U.shuffle(sel, rnd).map((q) => Object.assign({}, q, { pregunta: q.enunciado }));   // alias `pregunta`: validadores antiguos
      },
    };
    return B;
  }

  // ---------------------------------------------------------------------------------
  // Lienzo: acumula segmentos de una fase
  // ---------------------------------------------------------------------------------
  function lienzo(fase, ctx) {
    const { rnd, F, B } = ctx;
    const L = {
      fase, segs: [], x: 0, rnd, F, B,
      bloques: 0, objetivoBloques: 5 + (rnd() < 0.4 ? 1 : 0), cols: 0, enes: 0, puertas: 0, tuberias: 0, bonus: 0,
      cellsUsadas: new Set(),
    };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));        // entero en [a,b]
    L.ri = ri;
    // premios variados por fase, en orden barajado
    const PREMIOS = {
      tierra: ['moneda', 'vida', 'pista', 'estrella', 'moneda', 'escudo', 'reloj'],
      agua: ['moneda', 'escudo', 'reloj', 'pista', 'estrella', 'vida', 'moneda'],
      castillo: ['escudo', 'vida', 'pista', 'estrella', 'reloj', 'moneda', 'escudo'],
    }[fase];
    const colaPremios = U.shuffle(PREMIOS.slice(0, 5), rnd).concat(U.shuffle(PREMIOS.slice(5), rnd));
    let ip = 0;
    const premio = () => colaPremios[ip++ % colaPremios.length];

    L.suelo = (len) => { const x0 = L.x; L.segs.push({ tipo: 'plataforma', x: x0, y: GY, largo: len }); L.x += len; return x0; };
    L.foso = (len) => { const x0 = L.x; L.segs.push({ tipo: 'foso', x: x0, largo: len }); L.x += len; return x0; };
    L.checkpoint = (x) => L.segs.push({ tipo: 'checkpoint', x });
    L.flotante = (x, y, largo) => L.segs.push({ tipo: 'plataforma', x, y, largo });
    L.refs = new Set();
    L.col = (x, y) => {
      // siguiente fórmula que aún no esté en ESTE nivel (los `ref` deben ser únicos por nivel)
      let f = null;
      for (let k = 0; k < ctx.formulas.length && !f; k++) { const c = ctx.formulas[ctx.iForm++ % ctx.formulas.length]; if (!L.refs.has(c.id)) f = c; }
      if (!f) return;
      L.refs.add(f.id);
      L.segs.push({ tipo: 'coleccionable', x, y, ref: f.id, latex: f.latex, nombre: f.nombre }); L.cols++;
    };
    L.ene = (x, y) => {
      const e = ctx.errores[ctx.iErr++ % ctx.errores.length];
      let kind;
      if (fase === 'agua') kind = ACUATICOS[ctx.iAcu++ % ACUATICOS.length];
      else kind = slug(e.id && /^[a-z_]+$/i.test(e.id) && e.id.length > 4 ? e.id : e.nombre);
      L.segs.push({ tipo: 'enemigo', x, y: y == null ? GY - 1 : y, enemigo: kind, nombre: e.nombre, correccion: e.correccion }); L.enes++;
    };
    /** Bloque ? a 4 tiles sobre el suelo (se golpea desde abajo; caben 3 tiles libres debajo). */
    L.bloque = (x, y) => {
      if (L.bloques >= 9) return false;
      L.segs.push({ tipo: 'bloque_pregunta', x, y: y == null ? GY - 4 : y, pregunta: B.opcion(), premio: premio(), fallo: rnd() < (fase === 'castillo' ? 0.5 : 0.35) ? 'enemigo' : 'cierra' });
      L.bloques++; return true;
    };
    /** Reparte hasta n bloques (sin pasar del objetivo de la fase) entre x0+d0 con separación 3. */
    L.bloquesEn = (x0, d0, n) => { for (let i = 0; i < n && L.bloques < L.objetivoBloques; i++) L.bloque(x0 + d0 + i * 3); };
    L.puerta = (x, numerica) => {
      // altura suficiente para que NO se pueda saltar por encima (en agua: de techo a suelo)
      // el validador del motor admite alto 2..6; con 6 no se puede saltar por encima (salto máx. ≈ 3.5 tiles)
      const alto = 6;
      const reserva = [B.opcion(), B.opcion()];
      L.segs.push({ tipo: 'puerta', x, y: GY - alto, alto, pregunta: B.puerta(numerica), preguntas_reserva: reserva });
      L.puertas++;
    };
    L.tuberia = (x, destino, salidaX) => {
      const alto = 2;
      const reserva = [B.opcion()];
      L.segs.push({
        tipo: 'tuberia', x, y: GY - alto, alto, pregunta: B.opcion(), destino,
        salida_x: destino === 'atajo' ? salidaX : x, salida_y: GY - 1, preguntas: reserva, preguntas_reserva: reserva,
      });
      L.tuberias++; if (destino === 'bonus') L.bonus++;
      // planta carnívora que sale de ESTA tubería (a veces; un fallo en la pregunta también suelta una, lo hace el motor)
      if (rnd() < (destino === 'bonus' ? 0.5 : 0.4)) L.segs.push({ tipo: 'planta_carnivora', x, y: GY - alto, ciclo: Math.round((2.8 + rnd() * 1.2) * 10) / 10, visible: 1.2 });
    };
    /** Hilera de ladrillos (rompibles desde abajo) con contenido variado y, a veces, un `?` escondido. */
    L.ladrillos = (x0, y) => {
      const patron = U.shuffle(['nada', 'moneda', 'pregunta', 'moneda_multi', 'nada'], rnd);
      patron.forEach((c, i) => {
        const seg = { tipo: 'ladrillo', x: x0 + i, y, largo: 1, contenido: c };
        if (c === 'pregunta') Object.assign(seg, { pregunta: B.opcion(), premio: premio(), fallo: 'cierra' });
        L.segs.push(seg);
      });
    };
    return L;
  }

  // ---------------------------------------------------------------------------------
  // Tramos (cada uno empieza con suelo y deja siempre el cursor L.x al final de su último elemento)
  // ---------------------------------------------------------------------------------
  const T = {
    /** Salida: suelo largo, un bloque y una fórmula (sin enemigos). */
    inicio(L) {
      const x0 = L.suelo(18);
      L.bloquesEn(x0, 9, 1);
      L.col(x0 + 14, GY - 2);
    },
    /** Tramo llano con bloques seguidos y un enemigo que patrulla. */
    llano(L, o) {
      o = o || {};
      const len = L.ri(20, 25), x0 = L.suelo(len);
      L.bloquesEn(x0, L.ri(3, 5), o.bloques == null ? 3 : o.bloques);
      L.ene(x0 + len - L.ri(5, 7));
      L.col(x0 + L.ri(8, 12), GY - 2);
    },
    /** Foso simple (el suelo siguiente lo pone el tramo que venga). Fórmula flotando sobre el hueco. */
    foso(L) {
      const gmax = Math.max(2, Math.min(5, Math.floor(L.F.gapSeguro - 1.6)));
      const g = L.ri(Math.min(3, gmax), gmax);
      const x0 = L.suelo(L.ri(7, 10));
      const f = L.foso(g);
      L.col(f + Math.floor(g / 2), GY - 3);
      return x0;
    },
    /** Escalera de plataformas flotantes (corales en el agua) sobre un foso largo. */
    escalera(L) {
      // OJO: una plataforma con y >= alto_tiles-6 (=12) el motor la trata como SUELO (se extiende hacia abajo);
      // las flotantes de un solo sentido tienen que estar en y <= 11. Primer escalón desde el suelo: 3 tiles.
      const alturas = L.rnd() < 0.5 ? [GY - 3, GY - 5, GY - 3] : [GY - 3, GY - 5, GY - 7, GY - 5].slice(0, L.rnd() < 0.5 ? 4 : 3);
      const gap = Math.max(1, Math.min(2, Math.floor(L.F.gapSeguro / 3)));
      L.suelo(L.ri(6, 8));
      const f0 = L.x, ancho = 3;
      let x = f0 + gap;
      alturas.forEach((y, i) => { L.flotante(x, Math.max(3, y), ancho); if (i === Math.floor(alturas.length / 2)) L.col(x + 1, Math.max(3, y) - 2); x += ancho + 1; });
      const fin = x - 1 + gap;
      L.segs.push({ tipo: 'foso', x: f0, largo: fin - f0 }); L.x = fin;
    },
    /** Hilera de ladrillos sobre suelo llano (golpéalos desde abajo: monedas, nada o un ? escondido). */
    ladrillos(L) {
      const len = L.ri(14, 16), x0 = L.suelo(len);
      L.ladrillos(x0 + L.ri(4, 6), GY - 4);
      L.col(x0 + len - 3, GY - 2);
    },
    /** Foso corto con una plataforma que CAE al pisarla: la alternativa segura es saltar el foso (≤ salto seguro). */
    cae(L) {
      const gmax = Math.max(3, Math.min(4, Math.floor(L.F.gapSeguro - 2)));
      const g = L.ri(3, gmax);
      L.suelo(L.ri(7, 9));
      const fx = L.foso(g);
      L.segs.push({ tipo: 'plataforma_cae', x: fx, y: GY - 3, largo: 3, retardo: 0.7, reaparece: 4 });
      L.col(fx + 1, GY - 5);
    },
    /** Foso ancho cubierto por una plataforma móvil. */
    movil(L) {
      const hueco = L.ri(6, 7);
      L.suelo(L.ri(6, 8));
      const fx = L.foso(hueco);
      const largo = 3, rec = hueco - largo + 2;
      L.segs.push({ tipo: 'plataforma_movil', x: fx, y: GY - 2, largo, recorrido: rec, eje: 'x', periodo: L.ri(35, 50) / 10 });
      L.col(fx + Math.floor(hueco / 2), GY - 5);
    },
    /** Muro con puerta: checkpoint, enemigo y puerta; después una fórmula. */
    puerta(L, o) {
      const x0 = L.suelo(L.ri(15, 18));
      L.checkpoint(x0 + 2);
      if (o && o.enemigo !== false) L.ene(x0 + 6);
      L.puerta(x0 + 11, o && o.numerica);
      L.col(x0 + 14, GY - 2);
    },
    /** Tubería con sala de monedas: el suelo es llano y hay un bloque en la salida. */
    bonus(L) {
      const x0 = L.suelo(L.ri(12, 14));
      L.tuberia(x0 + 5, 'bonus');
      L.bloquesEn(x0, 9, 1);
      L.col(x0 + 3, GY - 2);
    },
    /** Tubería-atajo: la entrada salta un tramo de plataformas hasta una salida más adelante. */
    atajo(L) {
      const x0 = L.suelo(L.ri(10, 12));
      const entrada = x0 + 4;
      L.ene(x0 + 8);
      // el tramo que el atajo permite saltarse: escalera o móvil
      (L.rnd() < 0.5 ? T.escalera : T.movil)(L);
      const y0 = L.suelo(L.ri(10, 12));
      L.checkpoint(y0 + 1);
      L.tuberia(entrada, 'atajo', y0 + 4);
      L.col(y0 + 7, GY - 2);
    },
    /** Resorte hacia una plataforma alta con fórmula (solo si el capítulo usa resortes). */
    resorte(L) {
      const x0 = L.suelo(14);
      L.segs.push({ tipo: 'resorte', x: x0 + 3, y: GY - 1 });
      const alto = Math.min(6, Math.floor(L.F.hResorte - 1.2));
      L.flotante(x0 + 6, GY - alto, 5);
      L.col(x0 + 8, GY - alto - 2);
      L.ene(x0 + 12);
    },
    /** Zona de campo (la del capítulo): empuja o aligera, sobre suelo llano. */
    campo(L) {
      const c = L.ctx.campo || { fx: 0.5, fy: 0 };
      const x0 = L.suelo(L.ri(14, 16));
      L.segs.push({ tipo: 'zona_campo', x: x0 + 2, y: GY - 8, w: 10, h: 8, fx: c.fx, fy: Math.min(0, c.fy) });
      L.col(x0 + 7, GY - 4);
      L.bloquesEn(x0, 3, 1);
    },
    /** Puente sobre lava con palanca de Entropía situada DESPUÉS del puente (cae sin bloquear el avance). */
    puente(L) {
      const largo = Math.max(4, Math.min(5, Math.floor(L.F.gapSeguro - 1)));
      const x0 = L.suelo(L.ri(8, 10));
      L.ene(x0 + 4);
      const fx = L.foso(largo);
      L.segs.push({ tipo: 'puente', x: fx, y: GY, largo, id: 'puente1' });
      const y0 = L.suelo(10);
      L.segs.push({ tipo: 'palanca', x: y0 + 3, y: GY - 1, efecto: 'cae_puente', objetivo: 'puente1' });
      L.col(y0 + 6, GY - 2);
    },
    /** Final de fase normal: checkpoint, suelo llano y meta (2 columnas de suelo a la misma altura). */
    final(L) {
      const resto = Math.max(0, L.objetivoBloques - L.bloques);
      const len = 16 + Math.min(resto, 3) * 3;
      const x0 = L.suelo(len);
      L.checkpoint(x0 + 1);
      L.bloquesEn(x0, 4, resto);
      L.segs.push({ tipo: 'meta', x: x0 + len - 6 });
      return x0 + len;
    },
    /** Arena de jefe + meta: suelo plano desde jefe.x-12 hasta la meta (+4 de margen). */
    arena(L, jefe, preguntas, vidas) {
      L.suelo(4);                                     // colchón antes de la arena
      const resto = Math.max(0, L.objetivoBloques - L.bloques);
      L.bloquesEn(L.x - 4, 1, Math.min(resto, 2));
      L.checkpoint(L.x - 2);
      const ini = L.x, jx = ini + 12, mx = jx + 8;
      L.suelo(mx + 6 - ini);                          // arena + meta + margen
      L.segs.push({ tipo: 'jefe_quiz', x: jx, y: GY - 3, jefe, vidas: vidas || 3, titulo: JEFE_TITULO[jefe] || jefe, preguntas });
      L.segs.push({ tipo: 'meta', x: mx });
    },
  };

  // ---------------------------------------------------------------------------------
  // Construcción de cada fase
  // ---------------------------------------------------------------------------------
  const NOMBRES = {
    tierra: { nombre_fase: 'Fase 1 · Tierra', descripcion_fase: 'Cruza el laboratorio: golpea los bloques ?, entra en las tuberías y abre las puertas respondiendo bien.' },
    agua: { nombre_fase: 'Fase 2 · Aguas profundas', descripcion_fase: 'Nada entre medusas, peces y erizos. Cada acierto abre el camino.' },
    castillo: { nombre_fase: 'Fase 3 · Castillo', descripcion_fase: 'La fortaleza del jefe: solo podrás pisarlo si aciertas.' },
  };

  function plan(fase, ctx) {
    const { rnd, base } = ctx;
    const libres = U.shuffle(['foso', 'escalera', 'movil', 'llano', 'foso'], rnd);
    const extras = [];
    if (base.resorte) extras.push('resorte');
    if (base.campo) extras.push('campo');
    // los fosos simples se convierten (el 1.º siempre, el 2.º a veces) en fosos con plataforma que cae
    const conCae = (arr, max) => { let n = 0; return arr.map((t) => (t === 'foso' && n < max && rnd() < 0.5 ? (n++, 'cae') : t)); };
    if (fase === 'tierra') {
      const s = ['inicio', 'llano', 'ladrillos', libres[0], 'bonus', libres[1], 'puerta', libres[2], 'atajo', extras.length ? U.pick(extras, rnd) : libres[3], 'cae', 'puerta2', 'final'];
      return conCae(s, 1);   // + un segundo foso con plataforma que cae, a veces
    }
    if (fase === 'agua') {
      const s = ['inicio', 'llano', 'ladrillos', 'escalera', 'llano', 'puerta', libres[0] === 'movil' ? 'foso' : libres[0], 'llano'];
      s.push(ctx.jefeAgua ? 'arena' : 'final');
      return s;
    }
    return conCae(['inicio', 'llano', libres[0], 'ladrillos', 'cae', 'movil', 'puerta', libres[1] === 'movil' ? 'escalera' : libres[1], 'llano', 'puente', 'arena'], 0);
  }

  function construirFase(fase, ctx) {
    const L = lienzo(fase, ctx); L.ctx = ctx;
    const jefeFase = fase === 'castillo' ? ctx.jefeCastillo : ctx.jefeAgua;
    let jefeAplicado = false;
    for (const t of plan(fase, ctx)) {
      if (t === 'arena') {
        // preguntas del jefe: el castillo usa las del nivel original del capítulo; el pulpo, preguntas del banco
        const qs = ctx.B.jefe(fase === 'castillo' ? 6 : 5, fase === 'castillo' ? ctx.banco.jefe : []);
        T.arena(L, jefeFase, qs, 3); jefeAplicado = true;
      } else if (t === 'puerta2') T.puerta(L, { numerica: true });
      else if (t === 'puerta') T.puerta(L, { numerica: fase === 'tierra' });
      else if (t === 'final') T.final(L);
      else T[t](L);
    }
    // seguridad: ≥ 5 coleccionables y ≥ 3 enemigos aunque el plan sea corto
    const ultimoSuelo = L.segs.filter((s) => s.tipo === 'plataforma' && s.y === GY && s.largo >= 12 && !(s.x < 20 && fase !== 'x'));
    let guard = 0;
    while ((L.cols < 6 || L.enes < 3) && ultimoSuelo.length && guard++ < 20) {
      const s = ultimoSuelo[guard % ultimoSuelo.length];
      if (L.cols < 6) L.col(s.x + 3 + (guard % 3) * 2, GY - 2);
      else L.ene(s.x + Math.floor(s.largo / 2));
    }
    const meta = L.segs.find((s) => s.tipo === 'meta');
    const nivel = {
      capitulo_id: ctx.capId,
      tipo_nivel: 'quiz_' + fase,
      tema_visual: fase === 'agua' ? 'submarino' : fase === 'castillo' ? 'lava-fortaleza' : ctx.temaTierra,
      fisica_juego: fase === 'agua' ? { gravedad: 1, friccion: 0.9, salto: 12, viento: 0 } : Object.assign({}, ctx.fisica),
      ancho_tiles: meta.x + 6,
      alto_tiles: ALTO,
      nombre_fase: NOMBRES[fase].nombre_fase,
      descripcion_fase: NOMBRES[fase].descripcion_fase,
      jefe: jefeAplicado ? jefeFase : null,
      segmentos: L.segs,
    };
    if (fase === 'agua') {
      const corriente = ctx.rnd() < 0.5 ? 0 : Math.round((0.2 + ctx.rnd() * 0.25) * 100) / 100;
      nivel.segmentos.unshift({ tipo: 'zona_agua', x: 0, y: 0, w: nivel.ancho_tiles, h: ALTO, corriente_x: corriente, corriente_y: 0 });
    }
    return nivel;
  }

  // ---------------------------------------------------------------------------------
  // Validación: motor si entiende los segmentos nuevos; si no, «vista compatible»
  // ---------------------------------------------------------------------------------
  const NUEVOS = ['bloque_pregunta', 'tuberia', 'puerta', 'zona_agua', 'jefe_quiz'];
  /** Copia del nivel que el validador ANTIGUO entiende: sin segmentos nuevos y con jefe_quiz como jefe clásico. */
  QQ.vistaCompatible = function (nivel) {
    const v = JSON.parse(JSON.stringify(nivel));
    v.tipo_nivel = 'normal';
    v.segmentos = v.segmentos.filter((s) => !['bloque_pregunta', 'tuberia', 'puerta', 'zona_agua', 'ladrillo', 'planta_carnivora'].includes(s.tipo)).map((s) => {
      if (s.tipo === 'plataforma_cae') return { tipo: 'plataforma', x: s.x, y: s.y, largo: s.largo };   // para la alcanzabilidad cuenta como plataforma
      if (s.tipo !== 'jefe_quiz') return s;
      return { tipo: 'jefe', x: s.x, y: s.y, jefe: 'ejercicio_bac_1', titulo: s.titulo, preguntas: s.preguntas.map((q) => ({ pregunta: q.enunciado, opciones: q.opciones, correcta: q.correcta, explicacion: q.explicacion })) };
    });
    return v;
  };
  /** -> {ok, errores[], avisos[], via:'motor'|'compat'|'ninguno'} */
  QQ.validar = function (nivel) {
    const J = PCB.juego;
    if (!J || !J.validar) return { ok: true, errores: [], avisos: ['PCB.juego.validar no está cargado'], via: 'ninguno' };
    const r = J.validar(nivel);
    const desconoce = r.errores.some((e) => /tipo desconocido|tipo_nivel debe ser/.test(e));
    if (!desconoce) return Object.assign({ via: 'motor' }, r);
    return Object.assign({ via: 'compat' }, J.validar(QQ.vistaCompatible(nivel)));
  };
  /** Comprobaciones propias del contrato §4b (independientes del motor). */
  QQ.revisarContrato = function (nivel) {
    const e = [];
    const por = (t) => nivel.segmentos.filter((s) => s.tipo === t);
    const qOk = (q, donde) => {
      if (!q || !q.id || !q.enunciado) { e.push(donde + ': pregunta incompleta'); return; }
      if (q.tipo === 'opcion') { if (!Array.isArray(q.opciones) || q.opciones.length < 2 || !(q.correcta >= 0 && q.correcta < q.opciones.length)) e.push(donde + ': opciones/correcta inválidas (' + q.id + ')'); }
      else if (q.tipo === 'numerico') { if (typeof q.valor !== 'number') e.push(donde + ': numérica sin valor (' + q.id + ')'); }
      else e.push(donde + ': tipo de pregunta desconocido');
    };
    por('bloque_pregunta').forEach((s) => { qOk(s.pregunta, 'bloque'); if (!['moneda', 'vida', 'pista', 'escudo', 'estrella', 'reloj'].includes(s.premio)) e.push('premio inválido ' + s.premio); });
    por('tuberia').forEach((s) => qOk(s.pregunta, 'tuberia'));
    por('ladrillo').forEach((s) => { if (s.contenido === 'pregunta') qOk(s.pregunta, 'ladrillo'); });
    if (nivel.tipo_nivel !== 'quiz_agua' && !por('plataforma_cae').length) e.push('fase sin plataforma_cae');
    if (!por('ladrillo').length) e.push('fase sin ladrillos');
    por('puerta').forEach((s) => qOk(s.pregunta, 'puerta'));
    por('jefe_quiz').forEach((s) => { if (!s.preguntas || s.preguntas.length < 5) e.push('jefe_quiz con < 5 preguntas'); (s.preguntas || []).forEach((q) => qOk(q, 'jefe')); });
    if (nivel.tipo_nivel === 'quiz_tierra' && (!por('tuberia').length || !por('puerta').length)) e.push('tierra sin tubería o sin puerta');
    if (nivel.tipo_nivel !== 'quiz_tierra' && !por('puerta').length) e.push('fase sin puerta');
    if (nivel.tipo_nivel === 'quiz_agua' && !por('zona_agua').length) e.push('agua sin zona_agua');
    if (nivel.tipo_nivel === 'quiz_castillo' && !por('jefe_quiz').length) e.push('castillo sin jefe_quiz');
    if (por('bloque_pregunta').length < 4) e.push('menos de 4 bloques ?');
    return e;
  };

  // ---------------------------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------------------------
  QQ.generar = function (capId, banco, semilla) {
    semilla = semilla | 0;
    const cap = (banco.ctx && banco.ctx.cap) || {}, nb = (banco.ctx && banco.ctx.nivelBase) || {};
    const mundo = cap.mundo || (nb.tipo_nivel === 'fortaleza' ? 'constitucion' : 'constitucion');
    const jefes = jefesDe(capId, mundo);

    // mecánica del capítulo (se reutiliza de su nivel original)
    const fj0 = nb.fisica_juego || {};
    const clamp = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? Math.max(a, Math.min(b, v)) : d);
    const fisicaBase = { gravedad: clamp(fj0.gravedad, 0.7, 1.0, 1), friccion: clamp(fj0.friccion, 0.55, 0.97, 0.85), salto: clamp(fj0.salto, 10, 14, 12), viento: clamp(fj0.viento, -1, 1, 0) };
    const segsBase = nb.segmentos || [];
    const base = {
      resorte: segsBase.some((s) => s.tipo === 'resorte'),
      campo: segsBase.find((s) => s.tipo === 'zona_campo') || null,
    };
    let tema = nb.tema_visual || (cap.nivel_juego && cap.nivel_juego.tema_visual) || 'laboratorio-neon';
    if (tema === 'lava-fortaleza' || tema === 'submarino') tema = mundo === 'ondes' ? 'cielo-ondas' : 'laboratorio-neon';   // el castillo ya usa la lava
    const formulas = (cap.formulas || []).filter((f) => f && f.id && f.latex && f.nombre);
    const errores = (cap.errores_tipicos || []).filter((e) => e && e.nombre && e.correccion);
    if (formulas.length < 5 || errores.length < 3) {
      // datos insuficientes: rellenar con nociones clave para no romper el contrato (≥5 coleccionables, ≥3 enemigos)
      (cap.nociones_clave || []).forEach((n, i) => { if (formulas.length < 5) formulas.push({ id: 'n' + i, latex: '\\text{' + String(n.fr).replace(/[{}\\]/g, '') + '}', nombre: n.fr }); });
    }

    let ultimo = null; const fallos = [];
    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      const s = (semilla + Math.imul(intento, 7919)) | 0;
      const rnd = U.rng(U.hash('nivel|' + capId) ^ Math.imul(s, 2246822519));
      const B = crearBolsa(banco, rnd);
      const ctx = {
        capId, rnd, B, banco, F: null, fisica: fisicaBase, base, campo: base.campo, temaTierra: tema,
        jefeAgua: jefes.agua, jefeCastillo: jefes.castillo,
        formulas: U.shuffle(formulas, rnd), iForm: 0, errores: U.shuffle(errores, rnd), iErr: 0, iAcu: Math.floor(rnd() * 4),
      };
      const res = {};
      for (const fase of ['tierra', 'agua', 'castillo']) {
        ctx.F = fisica(fase === 'agua' ? { gravedad: 1, friccion: 0.9, salto: 12, viento: 0 } : fisicaBase);
        res[fase] = construirFase(fase, ctx);
      }
      const errores_ = [];
      for (const fase of ['tierra', 'agua', 'castillo']) {
        const v = QQ.validar(res[fase]);
        v.errores.forEach((m) => errores_.push(fase + ': ' + m));
        QQ.revisarContrato(res[fase]).forEach((m) => errores_.push(fase + ': ' + m));
      }
      res.meta = { capId, semilla, intento, mundo, jefeAgua: jefes.agua, jefeCastillo: jefes.castillo, errores: errores_, repeticiones: B.repeticiones, fallosPrevios: fallos };
      ultimo = res;
      if (!errores_.length) return res;
      fallos.push(errores_[0]);
    }
    return ultimo;      // mejor esfuerzo: meta.errores explica qué falla
  };
})();
