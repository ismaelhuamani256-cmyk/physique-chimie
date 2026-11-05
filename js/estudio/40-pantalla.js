// =====================================================================================
// 40-pantalla.js — Pantalla 4: el capítulo (estudio).
//   PCB.screens.capitulo = {mount(host,{capId,capitulo,quiz,bonus,tab}), unmount()}
// Cabecera + 7 pestañas accesibles (teclado, aria) con montaje perezoso.
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB, { el } = PCB.util;
  const E = PCB.estudio, H = E.h;

  const TABS = [
    { id: 'resumen', ico: '📘', txt: 'Resumen' },
    { id: 'formulas', ico: '∑', txt: 'Fórmulas' },
    { id: 'metodos', ico: '🧭', txt: 'Métodos' },
    { id: 'errores', ico: '👾', txt: 'Errores típicos', corto: 'Errores' },
    { id: 'lab', ico: '🧪', txt: 'Laboratorio', corto: 'Lab' },
    { id: 'quiz', ico: '🎯', txt: 'Ponme a prueba', corto: 'Quiz' },
    { id: 'progreso', ico: '🏆', txt: 'Progreso' },
  ];
  let limpiar = []; // funciones a ejecutar en unmount

  async function mount(host, ctx) {
    ctx = ctx || {};
    host.replaceChildren();
    const capId = ctx.capId;
    let cap = ctx.capitulo, quiz = ctx.quiz;
    if (capId && !cap) cap = await PCB.data.capitulo(capId);
    if (capId && !quiz) quiz = await PCB.data.quiz(capId);
    const indice = (await PCB.data.indice()) || { capitulos: [] };

    // --- sin capId: selector de capítulos + panel global ---
    if (!capId) return montarSelector(host, indice);

    const info = (indice.capitulos || []).find((c) => c.id === capId) || {};
    const materiaId = (cap && cap.materia) || info.materia;
    const mat = H.materia(materiaId);
    const root = el('div', { class: 'est', 'data-mat': mat.id });
    host.append(root);
    const volver = () => (PCB.flow && PCB.flow.volverMapa ? PCB.flow.volverMapa() : PCB.router.go('mapa'));

    // --- sin contenido generado todavía ---
    if (!cap) {
      root.append(el('div', { class: 'est-scroll' }, el('div', { class: 'est-vacio-cap card' },
        el('h1', {}, info.titulo || capId),
        el('p', {}, 'El contenido de este capítulo aún no está disponible. Cuando se genere aparecerá aquí.'),
        el('div', { class: 'est-fila-btn' }, el('button', { class: 'btn primario', on: { click: volver } }, '← Volver al mapa'))),
        el('div', { class: 'est-glob-host' })));
      E.panelProgreso(root.querySelector('.est-glob-host'));
      return;
    }

    // --- visita: 1ª estrella (+XP) ---
    PCB.store.cap(capId);
    H.actualizarEstrellas(capId, cap, true);

    // --- cabecera ---
    const estrellasHost = el('div', { class: 'est-cab-est' });
    const progHost = el('div', { class: 'est-cab-prog' });
    function refrescarCab() {
      const c = PCB.store.cap(capId), p = H.progresoCap(capId, cap);
      estrellasHost.replaceChildren(H.estrellas(c.estrellas || 0));
      progHost.replaceChildren(el('span', {}, H.pct(p * 100) + ' del capítulo'), H.barra(p, 'Progreso del capítulo'));
    }
    const nPdf = cap.pdf_ini && cap.pdf_fin ? 'pp. ' + cap.pdf_ini + '–' + cap.pdf_fin : null;
    const cab = el('header', { class: 'est-cab' },
      el('button', { class: 'btn est-volver', on: { click: volver }, 'aria-label': 'Volver al mapa' }, '← Mapa'),
      el('div', { class: 'est-cab-t' },
        el('div', { class: 'est-kicker' }, (info.num ? 'Capítulo ' + info.num : 'Capítulo') + (cap.mundo ? ' · ' + cap.mundo : '')),
        el('h1', { lang: 'fr' }, cap.titulo || info.titulo || capId),
        el('div', { class: 'est-chips' },
          el('span', { class: 'est-chip mat' }, mat.nombre),
          nPdf ? el('span', { class: 'est-chip', title: 'Páginas del cours en el PDF' }, '📖 ' + nPdf) : null,
          el('span', { class: 'est-chip' }, (cap.formulas || []).length + ' fórmulas'),
          (cap.ejercicios_bac || []).length ? el('span', { class: 'est-chip' }, cap.ejercicios_bac.length + ' ejercicios') : null)),
      el('div', { class: 'est-cab-r' }, estrellasHost, progHost));
    refrescarCab();
    const onStore = () => refrescarCab();
    PCB.bus.on('store', onStore); limpiar.push(() => PCB.bus.off('store', onStore));

    // --- banner de bienvenida (viene del nivel ganado) ---
    const bonus = ctx.bonus;
    let banner = null;
    if (bonus && (bonus.xp || bonus.pista)) {
      banner = el('div', { class: 'est-banner', role: 'status' },
        el('span', { class: 'est-banner-ico', 'aria-hidden': 'true' }, '🎉'),
        el('div', {}, el('b', {}, '¡Nivel superado! '), bonus.xp ? 'Ganaste ' : '', bonus.xp ? el('b', {}, '+' + bonus.xp + ' XP') : '', bonus.xp ? '. ' : '',
          bonus.pista ? 'Tienes ' : '', bonus.pista ? el('b', {}, '1 pista gratis') : '', bonus.pista ? ' esperándote en el quiz.' : ''),
        el('button', { class: 'btn mini', on: { click: () => irA('quiz') } }, 'Ir al quiz'),
        el('button', { class: 'est-x', 'aria-label': 'Cerrar aviso', on: { click: () => banner.remove() } }, '✕'));
    }

    // --- pestañas ---
    const tablist = el('div', { class: 'est-tabs', role: 'tablist', 'aria-label': 'Secciones del capítulo' });
    const paneles = el('div', { class: 'est-paneles' });
    const scroll = el('div', { class: 'est-scroll' }, paneles);
    const tctx = { capId, cap, quiz, bonus, irA: (id) => irA(id) };
    const inst = {}; // pestañas ya construidas
    let activa = null;
    const btn = {}, pan = {};

    TABS.forEach((t, i) => {
      btn[t.id] = el('button', { class: 'est-tab', role: 'tab', id: 'est-tab-' + t.id, 'aria-controls': 'est-panel-' + t.id, 'aria-selected': 'false', tabindex: '-1',
        on: { click: () => irA(t.id), keydown: (e) => teclado(e, i) } },
        el('span', { class: 'est-tab-ico', 'aria-hidden': 'true' }, t.ico), el('span', { class: 'est-tab-n' }, t.corto || t.txt), el('kbd', { 'aria-hidden': 'true' }, String(i + 1)));
      btn[t.id].title = t.txt + ' (' + (i + 1) + ')';
      pan[t.id] = el('section', { class: 'est-panel', role: 'tabpanel', id: 'est-panel-' + t.id, 'aria-labelledby': 'est-tab-' + t.id, hidden: true, tabindex: '0' });
      tablist.append(btn[t.id]); paneles.append(pan[t.id]);
    });

    function teclado(e, i) {
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = TABS.length - 1;
      if (j == null) return;
      e.preventDefault(); irA(TABS[j].id); btn[TABS[j].id].focus();
    }
    function construir(id) {
      if (inst[id]) return inst[id];
      let r;
      try {
        if (id === 'progreso') r = pestanaProgreso();
        else r = E.tabs[id](tctx);
      } catch (err) { console.error(err); r = { el: el('p', { class: 'est-vacio' }, 'Error al cargar esta sección: ' + err.message) }; }
      pan[id].append(r.el); inst[id] = r;
      if (id === 'resumen' && banner) pan[id].prepend(banner); // el aviso de bienvenida vive en la pestaña inicial
      return r;
    }
    function pestanaProgreso() {
      const aq = el('div', { class: 'est-trk card' }), glob = el('div', { class: 'est-globwrap' });
      const dg = E.panelProgreso(glob); limpiar.push(() => dg.dispose());
      return { el: el('div', { class: 'est-progreso' }, el('h2', {}, 'Este capítulo'), aq, el('h2', {}, 'Tu progreso global'), glob), onShow: () => E.trackerCapitulo(aq, capId, cap) };
    }
    function irA(id) {
      if (!pan[id] || id === activa) { if (id === activa) scroll.scrollTo({ top: 0 }); return; }
      if (activa) { const prev = inst[activa]; if (prev && prev.onHide) prev.onHide(); pan[activa].hidden = true; btn[activa].setAttribute('aria-selected', 'false'); btn[activa].tabIndex = -1; btn[activa].classList.remove('on'); }
      activa = id;
      const r = construir(id);
      pan[id].hidden = false; btn[id].setAttribute('aria-selected', 'true'); btn[id].tabIndex = 0; btn[id].classList.add('on');
      if (r.onShow) r.onShow();
      scroll.scrollTo({ top: 0 });
      btn[id].scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    // atajos 1..7 (fuera de campos de texto)
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !/^[1-7]$/.test(e.key)) return;
      const t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (document.querySelector('.anim-modal')) return;
      irA(TABS[+e.key - 1].id);
    };
    document.addEventListener('keydown', onKey); limpiar.push(() => document.removeEventListener('keydown', onKey));
    limpiar.push(() => Object.values(inst).forEach((r) => { try { r.dispose && r.dispose(); } catch (e) { console.error(e); } }));

    root.append(cab, tablist, scroll);
    let inicial = 'resumen';
    if (ctx.tab != null) inicial = typeof ctx.tab === 'number' ? (TABS[ctx.tab - 1] || TABS[0]).id : (pan[ctx.tab] ? ctx.tab : 'resumen');
    else if (bonus && bonus.pista) inicial = 'resumen';
    irA(inicial);
  }

  /** Sin capítulo concreto: lista de capítulos + panel global */
  function montarSelector(host, indice) {
    const root = el('div', { class: 'est', 'data-mat': 'fisica' }), glob = el('div');
    const lista = el('div', { class: 'est-cap-selector' }, (indice.capitulos || []).map((c) => el('button', { class: 'btn', on: { click: () => PCB.flow.irCapituloDirecto(c.id) } }, c.num + '. ' + c.titulo)));
    root.append(el('div', { class: 'est-scroll' }, el('h1', { class: 'est-h1s' }, 'Estudio'), el('p', { class: 'est-intro' }, 'Elige un capítulo:'), lista, glob));
    host.append(root);
    const d = E.panelProgreso(glob); limpiar.push(() => d.dispose());
  }

  PCB.screens.capitulo = {
    mount,
    unmount() {
      limpiar.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
      limpiar = [];
    },
  };
})();
