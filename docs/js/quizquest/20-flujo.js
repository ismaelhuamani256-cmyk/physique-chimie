// =====================================================================================
// 20-flujo.js — QUIZ QUEST · pantallas y encadenado de las 3 fases
//
//   PCB.quizquest.iniciar(capId)   abre la pantalla de bienvenida de «Quiz Quest» para ese capítulo
//   PCB.screens.quizquest          pantalla del router: bienvenida · cargando · transición · derrota · resumen final
//
// Cada fase se juega con el motor de plataformas (js/juego/*):
//     PCB.router.go('juego', { capId, nivel, capitulo, modoQuiz:true, fase, onFin })
// y el motor llama a  ctx.onFin(res)  al terminar la fase, con (CONTRATO §4b)
//     res = { capId, gano, vidasRestantes, coleccionados, jefeDerrotado,
//             respuestas:{ correctas, total [, mejorRacha] }, premios:{ vida, pista, escudo, … } }
// `respuestas.mejorRacha` es OPCIONAL: si el motor la informa se muestra en el resumen; si no, aparece «—».
//
// Puntos (XP): +10 por acierto · +40 por fase superada · +100 por jefe derrotado · +60 por aventura completa.
// Sólo cuenta el intento que SUPERA la fase (los reintentos tras perder todas las vidas no suman XP aparte).
// Si el capítulo ya se había completado antes, el XP se reduce a la mitad (práctica) para no «cultivar» puntos.
//
// Guarda en PCB.store.cap(capId):  quizQuestMejor (% de aciertos, mejor partida completa), quizQuestCompleto (bool),
//   quizQuestEstrellas (0‥3), quizQuestPartidas (nº de aventuras completadas), quizQuestSemilla (última semilla).
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB, QQ = (PCB.quizquest = PCB.quizquest || {});
  const { el } = PCB.util;

  // ---------------------------------------------------------------------------------
  // Constantes de presentación
  // ---------------------------------------------------------------------------------
  const FASES = [
    { id: 'tierra', n: 1, ico: '🌿', nombre: 'Tierra', largo: 'Fase 1 · Tierra', sub: 'Bloques ?, tuberías y puertas del laboratorio' },
    { id: 'agua', n: 2, ico: '🌊', nombre: 'Aguas profundas', largo: 'Fase 2 · Aguas profundas', sub: 'Nada entre medusas, peces y erizos' },
    { id: 'castillo', n: 3, ico: '🏰', nombre: 'Castillo', largo: 'Fase 3 · Castillo', sub: 'El jefe solo cae si aciertas' },
  ];
  const PREMIO = { moneda: ['🪙', 'Monedas'], vida: ['❤️', 'Vidas'], pista: ['💡', 'Pistas'], escudo: ['🛡️', 'Escudos'], estrella: ['⭐', 'Estrellas'], reloj: ['⏱️', 'Relojes'] };
  const JEFE_NOMBRE = { rey_entropia: 'Rey Entropía', golem_formulas: 'Gólem de Fórmulas', pulpo_acido: 'Pulpo Ácido', dragon_tormenta: 'Dragón de la Tormenta' };
  const XP = { acierto: 10, fase: 40, jefe: 100, completa: 60 };

  // ---------------------------------------------------------------------------------
  // Estado de la partida en curso (vive mientras se navega entre pantallas)
  // ---------------------------------------------------------------------------------
  let P = null;          // {capId, cap, semilla, niveles, banco, resultados:[res|null ×3], xp:[…], i, ...}
  let semillaPendiente = null;   // semilla elegida en la pantalla de bienvenida (se mantiene al volver)
  let semillaCap = null;         // capítulo al que pertenece semillaPendiente
  let limpiar = [];      // funciones a ejecutar en unmount

  const nuevaSemilla = () => 1000 + Math.floor(Math.random() * 98999);
  const pct = (a, b) => (b > 0 ? Math.round((100 * a) / b) : 0);
  const estrellasTxt = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

  /** Normaliza el resultado que manda el motor (defiende contra campos ausentes). */
  function normalizar(res) {
    res = res || {};
    const r = res.respuestas || {};
    return {
      gano: !!res.gano, vidas: res.vidasRestantes == null ? 0 : res.vidasRestantes, coleccionados: res.coleccionados || 0,
      jefe: !!res.jefeDerrotado, correctas: r.correctas || 0, total: r.total || 0,
      racha: typeof r.mejorRacha === 'number' ? r.mejorRacha : typeof r.racha === 'number' ? r.racha : null,
      premios: res.premios || {},
    };
  }

  // ---------------------------------------------------------------------------------
  // Cabecera común y utilidades de DOM
  // ---------------------------------------------------------------------------------
  const corazones = (n, max) => el('span', { class: 'qq-vidas', 'aria-label': n + ' vidas' }, Array.from({ length: max || 3 }, (_, k) => el('i', { class: k < n ? 'on' : '' }, '♥')));
  const logo = () => el('div', { class: 'qq-logo', role: 'img', 'aria-label': 'Quiz Quest' }, el('span', { class: 'qq-bloq' }, '?'), el('b', {}, 'QUIZ'), el('b', { class: 'q2' }, 'QUEST'), el('span', { class: 'qq-bloq b2' }, '?'));
  const fondo = (tema) => el('div', { class: 'qq-fondo qq-fondo-' + tema, 'aria-hidden': 'true' }, el('div', { class: 'qq-estrellas' }), el('div', { class: 'qq-suelo' }));
  const ruta = (actual, hechas) => el('ol', { class: 'qq-ruta', 'aria-label': 'Las tres fases' }, FASES.map((f, k) =>
    el('li', { class: (k === actual ? 'act ' : '') + (hechas && hechas[k] ? 'ok' : '') },
      el('span', { class: 'qq-ruta-ico' }, hechas && hechas[k] ? '✔' : f.ico), el('span', { class: 'qq-ruta-t' }, el('b', {}, 'Fase ' + f.n), el('small', {}, f.nombre)))));
  const premiosChips = (premios) => {
    const k = Object.keys(premios || {}).filter((p) => PREMIO[p] && premios[p] > 0);
    if (!k.length) return el('span', { class: 'qq-nada' }, 'ninguno esta vez');
    return el('span', { class: 'qq-premios' }, k.map((p) => el('span', { class: 'qq-premio', title: PREMIO[p][1] }, PREMIO[p][0], el('b', {}, '×' + premios[p]))));
  };
  const caja = (cls, ...kids) => el('div', { class: 'qq ' + cls }, ...kids);

  /** Vuelve al capítulo con la pestaña «Ponme a prueba» abierta. */
  async function volverCapitulo(capId) {
    try {
      const [capitulo, quiz] = await Promise.all([PCB.data.capitulo(capId), PCB.data.quiz(capId)]);
      return PCB.router.go('capitulo', { capId, capitulo, quiz, tab: 'quiz' });
    } catch (e) { return PCB.flow.irCapituloDirecto(capId); }
  }

  // ---------------------------------------------------------------------------------
  // Pantalla: BIENVENIDA
  // ---------------------------------------------------------------------------------
  function vistaBienvenida(host, ctx) {
    const { capId } = ctx, cap = ctx.cap || {};
    const reg = PCB.store.cap(capId);
    if (semillaPendiente == null || semillaCap !== capId) { semillaCap = capId; semillaPendiente = reg.quizQuestSemilla ? reg.quizQuestSemilla + 1 : nuevaSemilla(); }
    const entrada = el('input', { type: 'number', class: 'qq-semilla-in', min: '1', max: '999999', value: String(semillaPendiente), inputmode: 'numeric', 'aria-label': 'Número de partida (semilla)', on: { input: (e) => { const v = parseInt(e.target.value, 10); if (v > 0) semillaPendiente = v; } } });
    const mejor = reg.quizQuestMejor || 0, comp = !!reg.quizQuestCompleto;
    const reglas = [
      ['❓', el('span', {}, el('b', {}, 'Golpea los bloques ? desde abajo'), ' y contesta: si aciertas sale el premio (monedas, vidas, escudos, pistas, estrellas o relojes).')],
      ['🟢', el('span', {}, el('b', {}, 'Tuberías (↓) y puertas (↑)'), ' solo se abren si respondes bien. Una tubería te lleva a un atajo o a una sala de monedas.')],
      ['🌊', el('span', {}, el('b', {}, 'Tres fases:'), ' Tierra, Aguas profundas y Castillo. Al final espera un jefe blindado: ', el('b', {}, 'solo puedes pisarlo cuando aciertas'), '.')],
      ['❤', el('span', {}, el('b', {}, '3 vidas por fase.'), ' Un fallo en el jefe cuesta un corazón; si los pierdes todos puedes reintentar la fase. Cada acierto suma XP.')],
    ];
    const jugar = el('button', { class: 'qq-btn jugar', on: { click: () => empezar(capId) } }, '▶  JUGAR');
    host.append(caja('qq-bienvenida',
      fondo('tierra'),
      el('div', { class: 'qq-wrap' },
        logo(),
        el('p', { class: 'qq-cap', lang: 'fr' }, cap.titulo || capId),
        ruta(-1, null),
        el('ul', { class: 'qq-reglas card' }, reglas.map(([ic, tx]) => el('li', {}, el('span', { class: 'qq-ico' }, ic), tx))),
        el('p', { class: 'qq-teclas' }, el('kbd', {}, '←'), el('kbd', {}, '→'), ' mover · ', el('kbd', {}, 'Espacio'), ' saltar · ', el('kbd', {}, '↓'), ' tubería · ', el('kbd', {}, '↑'), ' puerta · ', el('kbd', {}, '1'), '–', el('kbd', {}, '4'), ' responder'),
        el('div', { class: 'qq-fila' },
          el('div', { class: 'qq-dato' }, el('small', {}, 'Vidas por fase'), corazones(3)),
          el('div', { class: 'qq-dato' }, el('small', {}, 'Tu mejor resultado'),
            mejor || comp ? el('span', { class: 'qq-mejor' }, el('b', {}, mejor + ' %'), ' ', el('span', { class: 'qq-est' }, estrellasTxt(reg.quizQuestEstrellas || 0)), comp ? el('em', {}, ' · completado ✔') : null)
              : el('span', { class: 'qq-nada' }, 'aún sin jugar')),
          el('div', { class: 'qq-dato qq-seed' }, el('small', {}, 'Partida nº'), el('span', { class: 'qq-seed-fila' }, entrada,
            el('button', { class: 'qq-btn mini', title: 'Nueva partida: otras posiciones, premios y preguntas', on: { click: () => { semillaPendiente = nuevaSemilla(); entrada.value = String(semillaPendiente); } } }, '🎲 Nueva')))),
        jugar,
        el('p', { class: 'qq-nota' }, 'La misma partida nº genera siempre el mismo recorrido; cámbiala para tener otras preguntas y otro mapa.'))));
    setTimeout(() => jugar.focus(), 50);
    const onKey = (e) => { if (e.key === 'Enter' && document.activeElement && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); empezar(capId); } };
    document.addEventListener('keydown', onKey); limpiar.push(() => document.removeEventListener('keydown', onKey));
  }

  // ---------------------------------------------------------------------------------
  // Preparación de la aventura (banco + generador) y arranque de la fase 1
  // ---------------------------------------------------------------------------------
  async function empezar(capId) {
    const semilla = semillaPendiente || nuevaSemilla();
    await PCB.router.go('quizquest', { vista: 'cargando', capId });
    try {
      const banco = await QQ.banco(capId, semilla);
      const niveles = QQ.generar(capId, banco, semilla);
      if (niveles.meta && niveles.meta.errores && niveles.meta.errores.length) console.warn('[QuizQuest] niveles con avisos de validación:', niveles.meta.errores);
      PCB.store.update(() => { PCB.store.cap(capId).quizQuestSemilla = semilla; });
      P = { capId, cap: banco.ctx.cap, semilla, banco, niveles, meta: niveles.meta, resultados: [null, null, null], xp: [0, 0, 0], intentos: [0, 0, 0], i: 0, xpTotal: 0, yaCompleto: !!PCB.store.cap(capId).quizQuestCompleto };
      return jugarFase(0);
    } catch (e) {
      console.error(e);
      return PCB.router.go('quizquest', { vista: 'error', capId, mensaje: e.message });
    }
  }

  /** Lanza el motor de plataformas con el nivel generado de la fase i. */
  function jugarFase(i) {
    P.i = i; P.intentos[i]++;
    const fase = FASES[i];
    const nivel = P.niveles[fase.id];
    return PCB.router.go('juego', {
      capId: P.capId, nivel, capitulo: P.cap, modoQuiz: true, fase: fase.id, faseNumero: fase.n, tituloFase: fase.largo,
      onFin: (res) => setTimeout(() => finFase(i, res), 0),     // fuera del bucle del motor, para que pueda desmontarse limpiamente
    });
  }

  /** El motor avisa del fin de la fase i. */
  function finFase(i, res) {
    if (!P) return;
    const n = normalizar(res);
    if (!n.gano) { P.ultimaDerrota = { i, n }; return PCB.router.go('quizquest', { vista: 'derrota', capId: P.capId, i, n }); }
    P.resultados[i] = n;
    // XP de esta fase (sólo el intento que la supera)
    let xp = n.correctas * XP.acierto + XP.fase + (n.jefe ? XP.jefe : 0);
    if (P.yaCompleto) xp = Math.round(xp / 2);
    P.xp[i] = xp; P.xpTotal += xp;
    PCB.store.addXP(xp, 'quizquest');
    if (i < 2) return PCB.router.go('quizquest', { vista: 'transicion', capId: P.capId, i, n, xp });
    return terminarAventura();
  }

  /** Fin de la fase 3: guarda marcas, suma el bonus y muestra el resumen. */
  function terminarAventura() {
    const rs = P.resultados.map((r) => r || { correctas: 0, total: 0 });
    const ok = rs.reduce((a, r) => a + r.correctas, 0), tot = rs.reduce((a, r) => a + r.total, 0);
    const porcentaje = pct(ok, tot);
    const completo = P.resultados.every(Boolean);
    const estrellas = completo ? (porcentaje >= 90 ? 3 : porcentaje >= 70 ? 2 : 1) : 0;
    const bonus = completo ? (P.yaCompleto ? Math.round(XP.completa / 2) : XP.completa) : 0;
    if (bonus) { P.xpTotal += bonus; PCB.store.addXP(bonus, 'quizquest-completo'); }
    const reg = PCB.store.cap(P.capId), antes = reg.quizQuestMejor || 0;
    const record = porcentaje > antes;
    PCB.store.update(() => {
      const c = PCB.store.cap(P.capId);
      c.quizQuestMejor = Math.max(c.quizQuestMejor || 0, porcentaje);
      c.quizQuestCompleto = !!c.quizQuestCompleto || completo;
      c.quizQuestEstrellas = Math.max(c.quizQuestEstrellas || 0, estrellas);
      c.quizQuestPartidas = (c.quizQuestPartidas || 0) + (completo ? 1 : 0);
    });
    const racha = Math.max(-1, ...P.resultados.filter(Boolean).map((r) => (r.racha == null ? -1 : r.racha)));
    P.resumen = { ok, tot, porcentaje, estrellas, bonus, record, racha: racha >= 0 ? racha : null };
    return PCB.router.go('quizquest', { vista: 'fin', capId: P.capId });
  }

  // ---------------------------------------------------------------------------------
  // Pantalla: CARGANDO / ERROR
  // ---------------------------------------------------------------------------------
  const vistaCargando = (host) => host.append(caja('qq-cargando', fondo('tierra'), el('div', { class: 'qq-wrap centro' }, logo(), el('p', { class: 'qq-pulso' }, 'Preparando la aventura…'))));
  const vistaError = (host, ctx) => host.append(caja('qq-cargando', fondo('castillo'), el('div', { class: 'qq-wrap centro' }, logo(),
    el('p', {}, 'No se pudo preparar la aventura: ' + (ctx.mensaje || 'error desconocido')),
    el('button', { class: 'qq-btn', on: { click: () => volverCapitulo(ctx.capId) } }, '📘 Volver al capítulo'))));

  // ---------------------------------------------------------------------------------
  // Pantalla: TRANSICIÓN entre fases
  // ---------------------------------------------------------------------------------
  function vistaTransicion(host, ctx) {
    const { i, n, xp } = ctx, f = FASES[i], sig = FASES[i + 1];
    const hechas = P.resultados.map(Boolean);
    const jefeSig = sig && P.niveles[sig.id].jefe;
    host.append(caja('qq-transicion', fondo(i === 0 ? 'agua' : 'castillo'),
      el('div', { class: 'qq-wrap' },
        el('p', { class: 'qq-kicker' }, '¡Fase superada!'),
        el('h2', { class: 'qq-titulo' }, f.ico + '  ' + f.largo),
        ruta(i + 1, hechas),
        el('div', { class: 'qq-stats card' },
          stat('Aciertos', n.correctas + ' / ' + n.total, n.total ? pct(n.correctas, n.total) + ' %' : ''),
          stat('Fórmulas', String(n.coleccionados), 'recogidas'),
          stat('Vidas', '', corazones(n.vidas)),
          stat('Premios', '', premiosChips(n.premios)),
          n.jefe ? stat('Jefe', '✔', 'derrotado') : null,
          stat('XP', '+' + xp, P.yaCompleto ? 'práctica (½)' : '')),
        sig ? el('div', { class: 'qq-prox card' }, el('span', { class: 'qq-prox-ico' }, sig.ico), el('div', {},
          el('b', {}, 'A continuación: ' + sig.largo), el('p', {}, sig.sub + (jefeSig ? ' · jefe: ' + (JEFE_NOMBRE[jefeSig] || jefeSig) : '') + '.'))) : null,
        el('div', { class: 'qq-botones' },
          el('button', { class: 'qq-btn jugar', autofocus: true, on: { click: () => jugarFase(i + 1) } }, 'CONTINUAR  ▶'),
          el('button', { class: 'qq-btn sec', on: { click: () => volverCapitulo(P.capId) } }, 'Salir al capítulo')))));
    foco(host, '.jugar');
  }
  function stat(titulo, valor, extra) {
    return el('div', { class: 'qq-stat' }, el('small', {}, titulo), valor ? el('b', {}, valor) : null, extra ? (extra.nodeType ? extra : el('span', {}, extra)) : null);
  }
  const foco = (host, sel) => setTimeout(() => { const b = host.querySelector(sel); if (b) b.focus(); }, 60);

  // ---------------------------------------------------------------------------------
  // Pantalla: DERROTA (sin vidas) → reintentar la fase
  // ---------------------------------------------------------------------------------
  function vistaDerrota(host, ctx) {
    const { i, n } = ctx, f = FASES[i];
    host.append(caja('qq-derrota', fondo('castillo'),
      el('div', { class: 'qq-wrap centro' },
        el('p', { class: 'qq-kicker mal' }, 'Te quedaste sin vidas'),
        el('h2', { class: 'qq-titulo' }, f.ico + '  ' + f.largo),
        el('div', { class: 'qq-stats card' }, stat('Aciertos', n.correctas + ' / ' + n.total, n.total ? pct(n.correctas, n.total) + ' %' : ''), stat('Fórmulas', String(n.coleccionados), 'recogidas')),
        el('p', { class: 'qq-nota' }, 'Cada fallo es una pista de qué repasar. Reintenta la fase: las preguntas son las mismas, ahora ya las conoces.'),
        el('div', { class: 'qq-botones' },
          el('button', { class: 'qq-btn jugar', on: { click: () => jugarFase(i) } }, '↻  REINTENTAR FASE ' + f.n),
          el('button', { class: 'qq-btn sec', on: { click: () => volverCapitulo(P.capId) } }, 'Salir al capítulo'),
          el('button', { class: 'qq-btn sec', on: { click: () => PCB.flow.volverMapa() } }, '🗺 Mapa')))));
    foco(host, '.jugar');
  }

  // ---------------------------------------------------------------------------------
  // Pantalla: RESUMEN FINAL
  // ---------------------------------------------------------------------------------
  function vistaFin(host) {
    const R = P.resumen, reg = PCB.store.cap(P.capId);
    const veredicto = R.porcentaje >= 90 ? '¡Aventura perfecta!' : R.porcentaje >= 70 ? '¡Gran aventura!' : R.porcentaje >= 50 ? 'Aventura superada' : 'Aventura superada, ¡a repasar!';
    const filas = FASES.map((f, k) => {
      const r = P.resultados[k];
      return el('tr', {}, el('td', {}, f.ico + ' ' + f.nombre), el('td', {}, r ? r.correctas + ' / ' + r.total : '—'), el('td', {}, r ? String(r.coleccionados) : '—'),
        el('td', {}, r ? corazones(r.vidas) : '—'), el('td', {}, r ? premiosChips(r.premios) : '—'), el('td', { class: 'xp' }, '+' + P.xp[k]));
    });
    host.append(caja('qq-fin', fondo('castillo'),
      el('div', { class: 'qq-wrap' },
        el('p', { class: 'qq-kicker' }, R.record && R.porcentaje > 0 ? '¡Nuevo récord!' : 'Fin de la aventura'),
        el('h2', { class: 'qq-titulo' }, veredicto),
        el('div', { class: 'qq-grande' }, el('b', {}, String(R.porcentaje), el('small', {}, '%')), el('span', { class: 'qq-est' }, estrellasTxt(R.estrellas))),
        el('div', { class: 'qq-stats card' },
          stat('Aciertos', R.ok + ' / ' + R.tot, 'respuestas'),
          stat('Mejor racha', R.racha == null ? '—' : '🔥 ' + R.racha, R.racha == null ? '' : 'seguidas'),
          stat('XP ganado', '+' + P.xpTotal, P.yaCompleto ? 'práctica (½)' : (R.bonus ? 'incluye +' + R.bonus + ' de bonus' : '')),
          stat('Tu récord', (reg.quizQuestMejor || 0) + ' %', R.record ? 'superado' : 'a batir')),
        el('div', { class: 'qq-tabla-wrap card' }, el('table', { class: 'qq-tabla' },
          el('thead', {}, el('tr', {}, ['Fase', 'Aciertos', 'Fórmulas', 'Vidas', 'Premios', 'XP'].map((h) => el('th', {}, h)))), el('tbody', {}, filas))),
        el('div', { class: 'qq-botones' },
          el('button', { class: 'qq-btn jugar', on: { click: () => { semillaCap = P.capId; semillaPendiente = nuevaSemilla(); QQ.iniciar(P.capId); } } }, '🔁  REPETIR'),
          el('button', { class: 'qq-btn', on: { click: () => volverCapitulo(P.capId) } }, '📘 Volver al capítulo'),
          el('button', { class: 'qq-btn sec', on: { click: () => PCB.flow.volverMapa() } }, '🗺 Mapa')))));
    foco(host, '.jugar');
  }

  // ---------------------------------------------------------------------------------
  // Registro de la pantalla en el router
  // ---------------------------------------------------------------------------------
  PCB.screens.quizquest = {
    async mount(host, ctx) {
      ctx = ctx || {};
      host.classList.add('qq-host');
      const vista = ctx.vista || 'bienvenida';
      if (vista === 'cargando') return vistaCargando(host);
      if (vista === 'error') return vistaError(host, ctx);
      if (vista === 'transicion' && P) return vistaTransicion(host, ctx);
      if (vista === 'derrota' && P) return vistaDerrota(host, ctx);
      if (vista === 'fin' && P) return vistaFin(host, ctx);
      const cap = ctx.cap || (await PCB.data.capitulo(ctx.capId));
      return vistaBienvenida(host, Object.assign({}, ctx, { cap }));
    },
    unmount() { limpiar.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); limpiar = []; },
  };

  // ---------------------------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------------------------
  /** Abre «Quiz Quest» para un capítulo (pantalla de bienvenida). */
  QQ.iniciar = function (capId) {
    if (!capId) return null;
    if (P && P.capId !== capId) P = null;
    return PCB.router.go('quizquest', { vista: 'bienvenida', capId });
  };
  /** Para depuración y pruebas: partida en curso. */
  QQ.estado = () => P;
  /** Salta a una fase concreta de la partida en curso (pruebas). */
  QQ.jugarFase = (i) => (P ? jugarFase(i) : null);
  /** Arranca directamente una partida con una semilla (pruebas). */
  QQ.empezarCon = (capId, semilla) => { semillaCap = capId; semillaPendiente = semilla; return empezar(capId); };
  QQ._finFase = finFase;
})();
