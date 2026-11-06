// =====================================================================================
// 00-nucleo.js — pestaña «🧠 Conceptos» (solo capítulos de química 1–9): visualizaciones paso a paso de los CONCEPTOS del cours
//   (no de las fórmulas: eso ya lo hacen las animaciones de fórmula). Cada concepto = escena interactiva + narración por pasos + mini-test.
//
//   PCB.conceptos.registrar({
//     id:'isomeria', capitulos:['synthese-organique'],           // ids de capítulo donde aparece
//     titulo:'Isomería: misma fórmula, distinta molécula', fr:'Isomérie',
//     resumen:'1-2 frases en español', pagina_pdf: 232,          // página del cours (pdf) de donde sale; 0 si es de las «fiches»
//     pasos:[ { titulo:'…', texto:'explicación en español (términos del cours en francés)', fr:'opcional: frase del cours en francés' }, … ],
//     montar(host, api){ …dibuja en host (div 16:9)…; return { ir(n, dir){…}, dispose(){…} }; },   // ir(n) se llama al cambiar de paso (n = 0..pasos-1)
//     test:[ { pregunta:'…', opciones:['a','b','c'], correcta:1, explicacion:'…' } ],                // 1–3 preguntas (opcional)
//   });
//   api = { THREE, mol3d: PCB.mol3d, anim: PCB.anim, el: PCB.util.el, tex: PCB.util.tex, reducido: bool, onResize(fn) }
//   El núcleo pinta la lista, el reproductor (◀ ▶ ▶▶ auto), los puntos de progreso, el mini-test y guarda en PCB.store.cap(id).conceptosVistos.
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB, { el } = PCB.util;
  const C = (PCB.conceptos = { _def: [] });
  C.registrar = (d) => { C._def = C._def.filter((x) => x.id !== d.id); C._def.push(d); };
  C.delCapitulo = (capId) => C._def.filter((d) => (d.capitulos || []).includes(capId));
  const CAPS_QUIMICA = ['acide-base', 'methodes-physiques', 'methodes-chimiques', 'evolution-temporelle', 'nucleaires', 'sens-evolution', 'force-acides-bases', 'forcer-sens', 'synthese-organique'];

  const E = (PCB.estudio = PCB.estudio || {});
  const T = (E.tabs = E.tabs || {});
  E.tabsExtra = E.tabsExtra || [];
  E.tabsExtra.push({ id: 'conceptos', ico: '🧠', txt: 'Conceptos', corto: 'Conceptos', visible: (ctx) => CAPS_QUIMICA.includes(ctx.capId) && C.delCapitulo(ctx.capId).length > 0 });

  T.conceptos = function (ctx) {
    const lista = C.delCapitulo(ctx.capId), cap = () => PCB.store.cap(ctx.capId);
    let actual = null, inst = null, paso = 0, auto = null;
    const izq = el('div', { class: 'cpt-lista' }), der = el('div', { class: 'cpt-der' });
    const raiz = el('div', { class: 'est-conceptos' }, el('p', { class: 'cpt-intro' }, 'Aquí se ven los conceptos del capítulo, no solo las fórmulas: pulsa uno, avanza paso a paso y juega con la escena. Al final hay un mini-test.'), el('div', { class: 'cpt' }, izq, der));

    const visto = (id) => (cap().conceptosVistos || []).includes(id);
    const marcarVisto = (d) => { if (!visto(d.id)) { PCB.store.update(() => { const c = cap(); (c.conceptosVistos = c.conceptosVistos || []).push(d.id); }); PCB.store.addXP(5, 'concepto'); PCB.util.toast('🧠 Concepto visto · +5 XP'); } pintarLista(); };
    function pintarLista() {
      izq.replaceChildren(el('h3', {}, 'Conceptos · ' + lista.length + ' (' + lista.filter((d) => visto(d.id)).length + ' vistos)'),
        ...lista.map((d) => el('button', { type: 'button', class: 'cpt-it' + (actual === d ? ' sel' : ''), 'aria-pressed': String(actual === d), on: { click: () => abrir(d) } },
          el('span', { class: 'k' }, visto(d.id) ? '✔' : '○'), el('span', { class: 't' }, d.titulo), d.fr ? el('span', { class: 'fr' }, d.fr) : null)));
    }
    function parar() { clearInterval(auto); auto = null; }
    function cerrarEscena() { parar(); if (inst) { try { inst.dispose(); } catch (e) {} inst = null; } }
    function abrir(d) {
      cerrarEscena(); actual = d; paso = 0; pintarLista();
      const escena = el('div', { class: 'cpt-escena' });
      const titulo = el('h4', {}), texto = el('p', { class: 'cpt-texto' }), fr = el('p', { class: 'cpt-fr', lang: 'fr' }), puntos = el('div', { class: 'cpt-puntos' });
      const bPrev = el('button', { type: 'button', class: 'btn mini', on: { click: () => ir(paso - 1) } }, '◀'), bNext = el('button', { type: 'button', class: 'btn mini primario', on: { click: () => ir(paso + 1) } }, '▶ Siguiente');
      const bAuto = el('button', { type: 'button', class: 'btn mini', on: { click: () => { if (auto) { parar(); bAuto.textContent = '⏵ Auto'; } else { bAuto.textContent = '⏸ Auto'; auto = setInterval(() => { if (paso >= d.pasos.length - 1) { parar(); bAuto.textContent = '⏵ Auto'; } else ir(paso + 1); }, 5000); } } } }, '⏵ Auto');
      const testHost = el('div', { class: 'cpt-test' });
      function ir(n) {
        paso = Math.max(0, Math.min(d.pasos.length - 1, n));
        const p = d.pasos[paso];
        titulo.textContent = (paso + 1) + '/' + d.pasos.length + ' · ' + p.titulo; texto.textContent = p.texto; fr.textContent = p.fr || '';
        puntos.replaceChildren(...d.pasos.map((_, i) => el('i', { class: i === paso ? 'on' : i < paso ? 'hecho' : '', on: { click: () => ir(i) } })));
        bPrev.disabled = paso === 0; bNext.disabled = paso === d.pasos.length - 1;
        try { inst && inst.ir && inst.ir(paso); } catch (e) { console.error('[conceptos]', d.id, e); }
        if (paso === d.pasos.length - 1) { marcarVisto(d); mostrarTest(); }
      }
      function mostrarTest() {
        if (!d.test || !d.test.length || testHost.childElementCount) return;
        const hechas = {};
        testHost.append(el('h4', {}, '¿Lo entendiste?'), ...d.test.map((q, qi) => {
          const fb = el('div', { class: 'fb' });
          return el('div', { class: 'cpt-q' }, el('p', {}, q.pregunta), ...q.opciones.map((o, oi) => el('button', { type: 'button', class: 'btn mini', on: { click: (e) => { if (hechas[qi]) return; hechas[qi] = true; const ok = oi === q.correcta; e.target.classList.add(ok ? 'ok' : 'mal'); fb.textContent = (ok ? '✔ ' : '✖ ') + (q.explicacion || ''); } } }, o)), fb);
        }));
      }
      der.replaceChildren(el('h3', {}, d.titulo), el('p', { class: 'cpt-res' }, d.resumen || '', d.pagina_pdf ? el('span', { class: 'pg' }, ' 📖 p. ' + d.pagina_pdf) : null), escena,
        el('div', { class: 'cpt-ctrl' }, bPrev, bNext, bAuto, puntos), titulo, texto, fr, testHost);
      try { inst = d.montar(escena, { THREE: window.THREE, mol3d: PCB.mol3d, anim: PCB.anim, el, tex: PCB.util.tex, reducido: PCB.util.reducedMotion(), onResize: (f) => new ResizeObserver(f).observe(escena) }); } catch (e) { console.error('[conceptos]', d.id, e); escena.textContent = 'No se pudo montar la escena.'; }
      ir(0);
    }
    pintarLista();
    return { el: raiz, onShow() { if (!actual && lista[0]) abrir(lista[0]); }, onHide() { cerrarEscena(); actual = null; }, dispose() { cerrarEscena(); } };
  };
})();
