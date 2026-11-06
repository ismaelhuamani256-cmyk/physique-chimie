// =====================================================================================
// 35-moleculas.js — pestaña «🧬 Moléculas 3D» del capítulo (integración de js/mol3d/ en la teoría)
//
// Se registra en PCB.estudio.tabsExtra (la pantalla del capítulo, 40-pantalla.js, la añade a las pestañas) y su
// contenido en PCB.estudio.tabs.moleculas(ctx) -> {el, onShow, onHide, dispose}.
// Solo aparece en los capítulos para los que PCB.mol3d.delCapitulo(capId) devuelve moléculas o reacciones
// (las que salen literalmente en el texto del cours de ese capítulo). Los demás no muestran la pestaña.
// Contenido: lista de moléculas/iones del capítulo + visor 3D grande + selector de reacciones animadas.
// Un solo WebGL: el visor se destruye al salir de la pestaña y se recrea al volver (sin gastar recursos ocultos).
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB, { el } = PCB.util;
  const E = (PCB.estudio = PCB.estudio || {});
  const T = (E.tabs = E.tabs || {});
  E.tabsExtra = E.tabsExtra || [];

  const hay = (capId) => {
    const M = PCB.mol3d;
    if (!M || !M.delCapitulo || !window.THREE || !capId) return false;
    const d = M.delCapitulo(capId);
    return d.moleculas.length + d.reacciones.length > 0;
  };
  E.tabsExtra.push({ id: 'moleculas', ico: '🧬', txt: 'Moléculas 3D', corto: 'Moléculas 3D', visible: (ctx) => hay(ctx.capId) });

  /** Puntitos CPK con los elementos de una molécula (mini-icono de la lista) */
  function puntos(mol) {
    const els = Array.from(new Set(mol.atomos.map((a) => a.el))).sort(PCB.mol3d.datos.ordenHill);
    return el('span', { class: 'pts', 'aria-hidden': 'true' }, els.map((s) => el('i', { style: { background: PCB.mol3d.datos.el(s).color } })));
  }

  T.moleculas = function (ctx) {
    const M = PCB.mol3d, d = M.delCapitulo(ctx.capId);
    const mols = d.moleculas.map((id) => M.molecula(id)).filter(Boolean);
    const rxs = d.reacciones.map((id) => M.reaccionDef(id)).filter(Boolean);
    let sel = mols.length ? { t: 'm', id: mols[0].id } : { t: 'r', id: rxs[0] && rxs[0].id };
    let visor = null, activo = false;
    const visorHost = el('div', { class: 'm3d-tab-visor' });
    const caja = el('div'); visorHost.append(caja);
    const pie = el('p', { class: 'm3d-tab-nota', role: 'status' });
    const botones = [];

    function marcar() { botones.forEach((b) => b.el.setAttribute('aria-pressed', String(b.t === sel.t && b.id === sel.id))); }
    function pintar() {
      if (visor) { try { visor.dispose(); } catch (e) { console.error(e); } visor = null; }
      caja.replaceChildren();
      if (!activo || !sel.id) return;
      const host = el('div'); caja.append(host);
      if (sel.t === 'm') {
        const mol = M.molecula(sel.id);
        visor = M.montar(host, { molecula: mol, rotar: true });
        pie.textContent = 'Arrastra para girar la molécula, rueda (o pellizco) para acercar, doble clic para recentrar. Cambia entre bolas, varillas y espacio lleno con los botones.';
      } else {
        const r = M.reaccionDef(sel.id);
        visor = M.reaccion(host, { id: sel.id });
        pie.textContent = 'Reacción del capítulo' + (r && r.fuente ? ' (fuente: ' + r.fuente + ')' : '') + '. ▶ reproduce; el deslizador recorre la reacción; los enlaces rojos se rompen y los verdes se forman.';
      }
    }
    function elegir(t, id) { sel = { t, id }; marcar(); pintar(); }

    const lista = el('div', { class: 'm3d-tab-lista', role: 'group', 'aria-label': 'Moléculas y reacciones de este capítulo' });
    if (mols.length) {
      lista.append(el('h3', {}, 'Moléculas e iones · ' + mols.length));
      mols.forEach((m) => {
        const b = el('button', { type: 'button', class: 'm3d-it', 'aria-pressed': 'false', on: { click: () => elegir('m', m.id) } },
          puntos(m), el('span', { class: 'f' }, m.formula), el('span', { class: 'n' }, m.nombre));
        botones.push({ t: 'm', id: m.id, el: b }); lista.append(b);
      });
    }
    if (rxs.length) {
      lista.append(el('h3', {}, 'Reacciones animadas · ' + rxs.length));
      rxs.forEach((r) => {
        const b = el('button', { type: 'button', class: 'm3d-it rx', 'aria-pressed': 'false', title: r.tipo, on: { click: () => elegir('r', r.id) } },
          el('span', { class: 'f' }, r.ecuacion));
        botones.push({ t: 'r', id: r.id, el: b }); lista.append(b);
      });
    }
    const intro = el('p', { class: 'm3d-tab-intro' }, 'Las moléculas e iones de este capítulo en 3D, con colores CPK (H blanco, C gris, N azul, O rojo, Cl verde, S amarillo) y la geometría que predice la teoría VSEPR. Las reacciones muestran cómo se rompen y se forman los enlaces.');
    const raiz = el('div', { class: 'est-moleculas' }, intro, el('div', { class: 'm3d-tab' }, lista, el('div', {}, visorHost, pie)));
    marcar();
    return {
      el: raiz,
      onShow() { activo = true; pintar(); },
      onHide() { activo = false; pintar(); },
      dispose() { activo = false; if (visor) { try { visor.dispose(); } catch (e) {} visor = null; } },
    };
  };
})();
