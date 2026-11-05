// =====================================================================================
// 30-quiz.js — pestaña "Ponme a prueba": quiz (opción + numérico) y ejercicios tipo bac.
// La corrección numérica la hace el código (PCB.estudio.corregirNumerico), nunca una IA.
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB, { el, tex } = PCB.util;
  const E = PCB.estudio, H = E.h;
  const T = (E.tabs = E.tabs || {});
  const LETRAS = 'ABCDEFGH';

  /** Campo valor + unidad. onEnviar se dispara con Enter. */
  function campoNumerico(onEnviar, idBase) {
    const v = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', class: 'est-input est-in-valor', id: idBase + '-v', placeholder: 'valor (ej. 0,25 · 1,5e-3)', 'aria-label': 'Valor numérico' });
    const u = el('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', class: 'est-input est-in-unidad', id: idBase + '-u', placeholder: 'unidad (ej. mol/L)', 'aria-label': 'Unidad' });
    [v, u].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onEnviar(); } }));
    return {
      el: el('div', { class: 'est-numfila' }, el('label', { for: v.id, class: 'sr-only' }, 'Valor'), v, el('label', { for: u.id, class: 'sr-only' }, 'Unidad'), u),
      valor: () => ({ valor: v.value, unidad: u.value }),
      bloquear: (b) => { v.disabled = u.disabled = b; },
      foco: () => v.focus(),
    };
  }
  /** Solución legible de un esperado {valor, unidad} */
  const solTxt = (e) => E.formatearNumero(e.valor, e.cifras_sig || 6) + (e.unidad ? ' ' + e.unidad : '');
  /** Caja de resultado de corrección numérica */
  function cajaResultado(r) {
    const clase = r.ok ? 'ok' : r.valorOk || r.unidadOk ? 'parcial' : 'mal';
    return el('div', { class: 'est-res ' + clase, role: 'status' },
      el('b', {}, r.ok ? '✔ ' : r.valorOk ? '◐ ' : '✘ '), r.mensaje);
  }
  const listaPasos = (pasos) => (pasos && pasos.length ? el('div', { class: 'est-solpasos' }, el('h4', {}, 'Resolución paso a paso'), el('ol', {}, pasos.map((p) => el('li', {}, H.txt(p))))) : null);

  T.quiz = function (ctx) {
    const { capId, cap, quiz, bonus } = ctx;
    const preguntas = (quiz && quiz.preguntas) || [];
    const ejercicios = cap.ejercicios_bac || [];
    let modo = preguntas.length || !ejercicios.length ? 'quiz' : 'ejercicios';
    const raiz = el('div', { class: 'est-quiz' });
    const cuerpo = el('div', { class: 'est-quiz-cuerpo' });
    const barraModo = el('div', { class: 'est-seg', role: 'group', 'aria-label': 'Tipo de práctica' });
    let pistas = bonus && bonus.pista ? 1 : 0;           // la pista gratis del nivel ganado
    let Q = null;                                        // estado de la partida de quiz

    function pintarModo() {
      barraModo.replaceChildren(
        el('button', { class: modo === 'quiz' ? 'on' : '', 'aria-pressed': String(modo === 'quiz'), on: { click: () => { modo = 'quiz'; render(); } } }, '📝 Quiz (' + preguntas.length + ')'),
        el('button', { class: modo === 'ejercicios' ? 'on' : '', 'aria-pressed': String(modo === 'ejercicios'), on: { click: () => { modo = 'ejercicios'; render(); } } }, '🎓 Ejercicios tipo bac (' + ejercicios.length + ')'));
    }
    function render() { pintarModo(); cuerpo.replaceChildren(); (modo === 'quiz' ? pintarQuiz : pintarEjercicios)(); }

    // =================== QUIZ ===================
    function pintarQuiz() {
      if (!preguntas.length) { cuerpo.append(el('p', { class: 'est-vacio' }, 'Este capítulo aún no tiene quiz. Prueba los ejercicios tipo bac.')); return; }
      if (!Q) return pantallaInicio();
      if (Q.idx >= preguntas.length) return pantallaFin();
      pantallaPregunta();
    }
    function pantallaInicio() {
      const c = PCB.store.cap(capId), nNum = preguntas.filter((p) => p.tipo === 'numerico').length;
      cuerpo.append(el('div', { class: 'est-inicio card' },
        el('h2', {}, 'Ponme a prueba'),
        el('p', {}, preguntas.length + ' preguntas (' + (preguntas.length - nNum) + ' de opción · ' + nNum + ' numéricas). Las respuestas numéricas las corrige el programa: acepta coma o punto decimal, notación científica y unidades equivalentes.'),
        el('p', { class: 'est-mejor' }, 'Tu mejor resultado: ', el('b', {}, c.quizMejor + ' %'), '  ', H.estrellas(c.estrellas || 0)),
        el('ul', { class: 'est-reglas' }, el('li', {}, '★ 2 estrellas con ≥ 70 %'), el('li', {}, '★★★ 3 estrellas con ≥ 90 % y ≥ 80 % de fórmulas dominadas')),
        pistas ? el('p', { class: 'est-pista-av' }, '💡 Ganaste el nivel: tienes ', el('b', {}, '1 pista gratis'), ' (descarta una opción incorrecta).') : null,
        el('button', { class: 'btn primario grande', on: { click: () => { Q = { idx: 0, puntos: 0, racha: 0, mejorRacha: 0, fallos: [], perm: null, resp: null }; render(); } } }, '▶ Empezar el quiz')));
    }
    function pantallaPregunta() {
      const p = preguntas[Q.idx], total = preguntas.length;
      Q.resp = null;
      const cab = el('div', { class: 'est-q-cab' },
        el('span', {}, 'Pregunta ', el('b', {}, Q.idx + 1), ' / ' + total),
        H.barra(Q.idx / total, 'Avance del quiz'),
        el('span', { class: 'est-racha' + (Q.racha >= 2 ? ' on' : ''), title: 'Aciertos seguidos' }, '🔥 ' + Q.racha));
      const caja = el('div', { class: 'est-q card' }, el('div', { class: 'est-q-enun' }, H.p('', p.enunciado), H.pag(p.pagina_pdf)));
      const feedback = el('div', { class: 'est-feedback', 'aria-live': 'polite' });
      const sig = () => el('button', { class: 'btn primario', on: { click: () => { Q.idx++; render(); } } }, Q.idx + 1 >= total ? 'Ver resultado →' : 'Siguiente →');
      const registrar = (pts, ok) => {
        Q.puntos += pts;
        if (ok) { Q.racha++; Q.mejorRacha = Math.max(Q.mejorRacha, Q.racha); } else { Q.racha = 0; Q.fallos.push(p); }
        cab.querySelector('.est-racha').textContent = '🔥 ' + Q.racha; cab.querySelector('.est-racha').classList.toggle('on', Q.racha >= 2);
      };

      if (p.tipo === 'numerico') {
        const esperado = { valor: p.valor, unidad: p.unidad, tolerancia_rel: p.tolerancia_rel, cifras_sig: p.cifras_sig };
        const campo = campoNumerico(comprobar, 'q' + Q.idx);
        const bOk = el('button', { class: 'btn primario', on: { click: comprobar } }, 'Comprobar');
        const bNs = el('button', { class: 'btn', on: { click: verSolucion } }, 'No lo sé · ver solución');
        function cierra(r, pts) {
          campo.bloquear(true); bOk.remove(); bNs.remove();
          feedback.replaceChildren(r ? cajaResultado(r) : el('div', { class: 'est-res mal' }, '✘ Sin respuesta.'),
            el('div', { class: 'est-sol' }, el('b', {}, 'Respuesta del cours: '), el('span', { class: 'est-sol-v' }, solTxt(esperado)), H.pag(p.pagina_pdf)),
            listaPasos(p.pasos), el('div', { class: 'est-fila-btn' }, sig()));
          registrar(pts, pts === 1);
        }
        function comprobar() {
          if (!campo.valor().valor.trim()) { feedback.replaceChildren(el('div', { class: 'est-res parcial' }, 'Escribe un valor primero.')); return; }
          const r = E.corregirNumerico(campo.valor(), esperado);
          cierra(r, r.ok ? 1 : r.valorOk ? 0.5 : 0);
        }
        function verSolucion() { cierra(null, 0); }
        caja.append(campo.el, el('div', { class: 'est-fila-btn' }, bOk, bNs), feedback);
        cuerpo.replaceChildren(cab, caja);
        setTimeout(() => campo.foco(), 30);
        return;
      }

      // ----- opción múltiple (opciones barajadas por partida; guardamos el índice original) -----
      const ops = (p.opciones || []).map((t, i) => ({ t, i }));
      for (let i = ops.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ops[i], ops[j]] = [ops[j], ops[i]]; }
      const lista = el('div', { class: 'est-opciones', role: 'group', 'aria-label': 'Opciones de respuesta' });
      const botones = ops.map((o, k) => el('button', { class: 'est-opc', 'data-i': o.i, on: { click: () => responder(o.i, k) } },
        el('span', { class: 'est-letra' }, LETRAS[k]), el('span', { class: 'est-opc-t' }, H.txt(o.t)), el('span', { class: 'est-marca', 'aria-hidden': 'true' })));
      botones.forEach((b) => lista.append(b));
      function responder(i) {
        if (Q.resp != null) return; Q.resp = i;
        const ok = i === p.correcta;
        botones.forEach((b) => {
          const bi = +b.dataset.i; b.disabled = true;
          if (bi === p.correcta) { b.classList.add('correcta'); b.querySelector('.est-marca').textContent = '✔'; }
          else if (bi === i) { b.classList.add('incorrecta'); b.querySelector('.est-marca').textContent = '✘'; }
        });
        if (pistaBtn) pistaBtn.remove();
        feedback.replaceChildren(el('div', { class: 'est-res ' + (ok ? 'ok' : 'mal'), role: 'status' }, el('b', {}, ok ? '✔ ¡Correcto! ' : '✘ No es esa. '), p.explicacion ? H.txt(p.explicacion) : null, ' ', H.pag(p.pagina_pdf)), el('div', { class: 'est-fila-btn' }, sig()));
        registrar(ok ? 1 : 0, ok);
      }
      // pista gratis (nivel ganado): descarta una opción incorrecta
      const pistaBtn = pistas > 0 ? el('button', { class: 'btn mini pista', title: 'Descarta una opción incorrecta', on: { click: () => {
        const malas = botones.filter((b) => +b.dataset.i !== p.correcta && !b.disabled);
        if (!malas.length) return;
        const b = malas[Math.floor(Math.random() * malas.length)]; b.disabled = true; b.classList.add('descartada'); b.querySelector('.est-marca').textContent = '—';
        pistas = 0; pistaBtn.remove();
        feedback.replaceChildren(el('div', { class: 'est-res parcial' }, '💡 Descarté una opción incorrecta.'));
      } } }, '💡 Usar pista gratis') : null;
      caja.append(lista, pistaBtn ? el('div', { class: 'est-fila-btn' }, pistaBtn) : null, feedback);
      cuerpo.replaceChildren(cab, caja);
    }
    function pantallaFin() {
      const total = preguntas.length, pct = Math.round((Q.puntos / total) * 100);
      const c = PCB.store.cap(capId), antes = c.quizMejor;
      let xp = 0;
      if (pct > antes) {
        xp = Math.round((pct - antes) * 0.4);
        PCB.store.update(() => { c.quizMejor = pct; });
        H.xp(xp, 'mejor quiz ' + pct + ' %');
      }
      PCB.store.update(() => { c.quizIntentos = (c.quizIntentos || 0) + 1; });
      const estrellasAntes = c.estrellas || 0;
      H.actualizarEstrellas(capId, cap, true);
      const nF = (cap.formulas || []).length, dom = H.dominadas(capId, cap).length;
      const falta3 = pct >= 90 && nF && dom / nF < 0.8;
      const veredicto = pct >= 90 ? '¡Excelente! 🏆' : pct >= 70 ? '¡Muy bien! 👏' : pct >= 50 ? 'Vas por buen camino' : 'A repasar con calma';
      cuerpo.append(el('div', { class: 'est-fin card' },
        el('div', { class: 'est-fin-pct' }, pct + ' %'),
        el('h2', {}, veredicto),
        el('p', {}, Q.puntos.toFixed(Q.puntos % 1 ? 1 : 0).replace('.', ',') + ' / ' + total + ' puntos · mejor racha 🔥 ' + Q.mejorRacha + (pct > antes ? ' · ¡nuevo récord!' : ' · tu récord es ' + c.quizMejor + ' %')),
        el('div', { class: 'est-fin-est' }, H.estrellas(c.estrellas || 0)),
        xp ? el('p', { class: 'est-xp-g' }, '+' + xp + ' XP por mejorar tu marca') : null,
        falta3 ? el('p', { class: 'est-aviso' }, 'Para la 3ª estrella marca como dominadas al menos el 80 % de las fórmulas (llevas ' + dom + ' / ' + nF + ').') : null,
        Q.fallos.length ? el('div', { class: 'est-repaso' }, el('h3', {}, 'A repasar'), el('ul', {}, Q.fallos.map((f) => el('li', {}, H.txt(f.enunciado.length > 110 ? f.enunciado.slice(0, 107) + '…' : f.enunciado), ' ', H.pag(f.pagina_pdf))))) : el('p', {}, '¡Sin fallos!'),
        el('div', { class: 'est-fila-btn' },
          el('button', { class: 'btn primario', on: { click: () => { Q = null; render(); } } }, '↺ Repetir el quiz'),
          ejercicios.length ? el('button', { class: 'btn', on: { click: () => { modo = 'ejercicios'; render(); } } }, '🎓 Ejercicios tipo bac') : null,
          el('button', { class: 'btn', on: { click: () => ctx.irA('formulas') } }, 'Repasar fórmulas'),
          el('button', { class: 'btn', on: { click: () => ctx.irA('progreso') } }, 'Ver mi progreso'))));
      if (estrellasAntes < (c.estrellas || 0) && !PCB.util.reducedMotion()) cuerpo.firstChild.classList.add('celebra');
    }

    // =================== EJERCICIOS TIPO BAC ===================
    const exEstado = {}; // por ejercicio: {revelado, resultado, textoLibre}
    let exSel = 0;
    function pintarEjercicios() {
      if (!ejercicios.length) { cuerpo.append(el('p', { class: 'est-vacio' }, 'Este capítulo no tiene ejercicios tipo bac registrados.')); return; }
      const c = PCB.store.cap(capId);
      const nav = el('div', { class: 'est-exnav', role: 'tablist', 'aria-label': 'Ejercicios' }, ejercicios.map((e, i) => el('button', {
        class: 'est-exbtn' + (i === exSel ? ' on' : '') + (c.ejerciciosResueltos.includes(e.id) ? ' hecho' : ''), role: 'tab', 'aria-selected': String(i === exSel),
        on: { click: () => { exSel = i; render(); } } }, (c.ejerciciosResueltos.includes(e.id) ? '✔ ' : '') + 'Ejercicio ' + (i + 1))));
      cuerpo.append(nav, ejercicio(ejercicios[exSel], exSel));
    }
    function ejercicio(e, n) {
      const est = (exEstado[e.id] ||= { revelado: false, resultado: null, texto: '' });
      const c = PCB.store.cap(capId);
      const hecho = () => c.ejerciciosResueltos.includes(e.id);
      const marcarResuelto = () => {
        if (!hecho()) PCB.store.update(() => c.ejerciciosResueltos.push(e.id));
        c.xpEjercicios = c.xpEjercicios || [];
        if (!c.xpEjercicios.includes(e.id)) { PCB.store.update(() => c.xpEjercicios.push(e.id)); H.xp(15, 'ejercicio resuelto'); }
        H.actualizarEstrellas(capId, cap);
      };
      const datos = e.datos && Object.keys(e.datos).length ? el('dl', { class: 'est-datos' }, Object.entries(e.datos).map(([k, v]) => el('div', {},
        el('dt', {}, /^[A-Za-zΑ-ω_\\{}^0-9]{1,8}$/.test(k) ? tex(k, el('span')) : k), el('dd', {}, H.txt(String(v)))))) : null;
      const zonaSol = el('div', { class: 'est-exsol', 'aria-live': 'polite' });
      const raizEj = el('article', { class: 'est-ejercicio card' },
        el('header', {}, el('h2', {}, 'Ejercicio ' + (n + 1)), H.pag(e.pagina_pdf, ' · enunciado'), hecho() ? el('span', { class: 'est-badge' }, '✔ resuelto') : null),
        H.p('est-exenun', e.enunciado), datos);

      const mostrarCorrige = () => {
        est.revelado = true;
        zonaSol.replaceChildren(
          el('div', { class: 'est-sol' }, el('b', {}, 'Corrigé del cours: '), H.txt(e.respuesta || (e.respuesta_numerica ? solTxt(e.respuesta_numerica) : 'no está en el cours')), H.pag(e.corrige_pagina_pdf || e.pagina_pdf, ' · corrigé')),
          listaPasos(e.pasos));
      };
      if (e.respuesta_numerica) {
        const campo = campoNumerico(comprobar, 'ex' + n);
        function comprobar() {
          if (!campo.valor().valor.trim()) { zonaSol.replaceChildren(el('div', { class: 'est-res parcial' }, 'Escribe un valor primero.')); return; }
          const r = E.corregirNumerico(campo.valor(), e.respuesta_numerica); est.resultado = r;
          if (r.ok) { marcarResuelto(); campo.bloquear(true); }
          mostrarCorrige();
          zonaSol.prepend(cajaResultado(r));
          if (!r.ok) zonaSol.append(el('div', { class: 'est-fila-btn' }, el('button', { class: 'btn', on: { click: () => { zonaSol.replaceChildren(); campo.foco(); } } }, '↺ Intentar de nuevo')));
          else raizEj.querySelector('header').append(el('span', { class: 'est-badge' }, '✔ resuelto'));
        }
        raizEj.append(el('p', { class: 'est-ayuda' }, 'Escribe el resultado final con su unidad:'), campo.el,
          el('div', { class: 'est-fila-btn' }, el('button', { class: 'btn primario', on: { click: comprobar } }, 'Comprobar'),
            el('button', { class: 'btn', on: { click: mostrarCorrige } }, 'Ver el corrigé')), zonaSol);
      } else {
        const ta = el('textarea', { class: 'est-input est-libre', rows: '5', placeholder: 'Escribe aquí tu razonamiento y tu respuesta…', 'aria-label': 'Tu respuesta', on: { input: (ev) => { est.texto = ev.target.value; } } });
        ta.value = est.texto;
        const decide = (lo) => {
          if (lo) { marcarResuelto(); PCB.util.toast('¡Genial! Ejercicio registrado como resuelto'); render(); }
          else { zonaSol.append(el('p', { class: 'est-res parcial' }, 'Sin problema: repasa los pasos y vuelve a intentarlo más tarde.')); }
        };
        const bVer = el('button', { class: 'btn primario', on: { click: () => { mostrarCorrige(); bVer.remove(); zonaSol.append(el('p', { class: 'est-ayuda' }, '¿Cómo te fue?'), el('div', { class: 'est-fila-btn' },
          el('button', { class: 'btn', on: { click: () => decide(false) } }, '😅 Me equivoqué'), el('button', { class: 'btn primario', on: { click: () => decide(true) } }, '😎 Lo tenía'))); } } }, 'Ver el corrigé');
        raizEj.append(ta, el('div', { class: 'est-fila-btn' }, bVer), zonaSol);
      }
      if (est.revelado) { /* conserva el corrigé al volver a pintar */ mostrarCorrige(); if (est.resultado) zonaSol.prepend(cajaResultado(est.resultado)); }
      return raizEj;
    }

    raiz.append(barraModo, cuerpo);
    render();
    return { el: raiz };
  };
})();
