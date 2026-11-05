// =====================================================================================
// 10-nucleo.js — utilidades compartidas del estudio: texto con LaTeX, chips de página,
// registro de progreso (estrellas, XP, estado) y paneles de seguimiento (tracker).
//   PCB.estudio.h            helpers
//   PCB.estudio.panelProgreso(host)       panel global (XP, racha, capítulos, respaldo)
//   PCB.estudio.trackerCapitulo(host, capId, capitulo)
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB, { el, tex } = PCB.util;
  const E = (PCB.estudio = PCB.estudio || {});
  const H = (E.h = {});

  /** Sin tildes ni mayúsculas, para buscar */
  H.norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /** Texto con matemáticas en línea: "la concentración $C=n/V$ se mide…" -> fragmento DOM (KaTeX en los $…$) */
  H.txt = function (s) {
    const frag = document.createDocumentFragment();
    String(s == null ? '' : s).split(/\$([^$]+)\$/).forEach((parte, i) => {
      if (i % 2) frag.append(tex(parte, el('span', { class: 'est-m' })));
      else if (parte) frag.append(document.createTextNode(parte));
    });
    return frag;
  };
  /** Elemento con texto enriquecido */
  H.p = (clase, s, tag) => el(tag || 'p', { class: clase || '' }, H.txt(s));

  /** Chip de página del cours (pdf) */
  H.pag = function (n, extra) {
    if (!n) return null;
    return el('span', { class: 'est-pag', title: 'Página ' + n + ' del PDF del cours (página impresa ' + (n - 18) + ')' }, '📖 p. ' + n + (extra || ''));
  };

  /** Etiqueta de materia */
  H.materia = (m) => (m === 'chimie' ? { id: 'quimica', nombre: 'Chimie · Química' } : { id: 'fisica', nombre: 'Physique · Física' });

  /** Pone el LaTeX de una fórmula en un contenedor (modo display) */
  H.formula = (latex, host) => tex(latex || '', host || el('div'), { display: true });

  /** Número 0-100 legible */
  H.pct = (v) => Math.round(v) + ' %';

  /** Concede XP con aviso en pantalla */
  H.xp = function (n, motivo) {
    if (!(n > 0)) return;
    PCB.store.addXP(n, motivo);
    PCB.util.toast('+' + n + ' XP · ' + motivo);
  };

  /** Estrellas con texto accesible: ★★☆ */
  H.estrellas = function (n, max) {
    max = max || 3;
    return el('span', { class: 'est-estrellas', role: 'img', 'aria-label': n + ' de ' + max + ' estrellas' },
      Array.from({ length: max }, (_, i) => el('span', { class: i < n ? 'on' : '' }, i < n ? '★' : '☆')));
  };

  /** Barra de progreso accesible */
  H.barra = function (frac, etiqueta) {
    const f = Math.max(0, Math.min(1, frac || 0));
    return el('div', { class: 'est-barra', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(f * 100), 'aria-label': etiqueta || 'Progreso' },
      el('i', { style: { width: (f * 100).toFixed(1) + '%' } }));
  };

  // ---------------------------------------------------------------------------
  // Registro del capítulo en el store
  // ---------------------------------------------------------------------------
  const XP_ESTRELLA = [0, 10, 30, 60]; // XP por alcanzar la 1ª, 2ª y 3ª estrella
  const idsFormulas = (cap) => ((cap && cap.formulas) || []).map((f) => f.id);

  /** Fórmulas dominadas que realmente existen en este capítulo */
  H.dominadas = function (capId, cap) {
    const c = PCB.store.cap(capId), ids = idsFormulas(cap);
    return ids.length ? c.formulasDominadas.filter((id) => ids.includes(id)) : c.formulasDominadas.slice();
  };

  /**
   * Estrellas según reglas: 1★ visitar · 2★ quiz ≥ 70 % · 3★ quiz ≥ 90 % y ≥ 80 % de fórmulas dominadas.
   * Nunca bajan (se guarda el máximo). Concede XP por cada estrella nueva y fija el estado.
   */
  H.actualizarEstrellas = function (capId, cap, visitado) {
    const c = PCB.store.cap(capId), nF = idsFormulas(cap).length;
    const domRatio = nF ? H.dominadas(capId, cap).length / nF : 1;
    let n = visitado || c.estrellas >= 1 ? 1 : 0;
    if (c.quizMejor >= 70) n = Math.max(n, 2);
    if (c.quizMejor >= 90 && domRatio >= 0.8) n = 3;
    const antes = c.estrellas || 0;
    if (n > antes) {
      let xp = 0; for (let i = antes + 1; i <= n; i++) xp += XP_ESTRELLA[i];
      PCB.store.update(() => { c.estrellas = n; if (n >= 3) c.estado = 'dominado'; else if (n >= 2 && c.estado !== 'dominado') c.estado = 'completado'; });
      H.xp(xp, '⭐ ' + n + ' estrella' + (n > 1 ? 's' : ''));
    }
    return Math.max(n, antes);
  };

  /** Porcentaje global del capítulo (0..1): quiz 3, fórmulas 3, ejercicios 2, nivel 1, intro 1 */
  H.progresoCap = function (capId, cap) {
    const c = PCB.store.cap(capId), nF = idsFormulas(cap).length, nE = ((cap && cap.ejercicios_bac) || []).length;
    const parts = [[c.quizMejor / 100, 3], [nF ? H.dominadas(capId, cap).length / nF : 0, 3], [nE ? Math.min(1, c.ejerciciosResueltos.length / nE) : 0, 2], [c.nivelGanado ? 1 : 0, 1], [c.introVista ? 1 : 0, 1]];
    let s = 0, w = 0; parts.forEach(([v, p]) => { s += Math.max(0, Math.min(1, v)) * p; w += p; });
    return s / w;
  };

  /** Marca/desmarca una fórmula como dominada (+5 XP la primera vez que se marca) */
  H.toggleDominada = function (capId, cap, fid) {
    const c = PCB.store.cap(capId);
    const ya = c.formulasDominadas.includes(fid);
    PCB.store.update(() => {
      if (ya) c.formulasDominadas = c.formulasDominadas.filter((x) => x !== fid);
      else { c.formulasDominadas.push(fid); }
    });
    if (!ya) {
      c.xpFormulas = c.xpFormulas || [];
      if (!c.xpFormulas.includes(fid)) { PCB.store.update(() => c.xpFormulas.push(fid)); H.xp(5, 'fórmula dominada'); }
    }
    H.actualizarEstrellas(capId, cap);
    return !ya;
  };

  // ---------------------------------------------------------------------------
  // Tracker de un capítulo
  // ---------------------------------------------------------------------------
  E.trackerCapitulo = function (host, capId, cap) {
    const c = PCB.store.cap(capId), nF = idsFormulas(cap).length, nE = ((cap && cap.ejercicios_bac) || []).length;
    const dom = H.dominadas(capId, cap).length, res = c.ejerciciosResueltos.length;
    const fila = (ok, titulo, detalle, frac) => el('li', { class: 'est-trk-fila' + (ok ? ' ok' : '') },
      el('span', { class: 'est-trk-ico', 'aria-hidden': 'true' }, ok ? '✔' : '○'),
      el('div', { class: 'est-trk-txt' }, el('b', {}, titulo), el('span', {}, detalle), frac != null ? H.barra(frac, titulo) : null),
      el('span', { class: 'sr-only' }, ok ? 'Completado' : 'Pendiente'));
    host.replaceChildren(
      el('div', { class: 'est-trk-cab' },
        H.estrellas(c.estrellas || 0),
        el('div', {}, el('b', {}, 'Estado: '), el('span', { class: 'est-estado ' + c.estado }, c.estado)),
        el('div', { class: 'est-trk-pct' }, el('b', {}, H.pct(H.progresoCap(capId, cap) * 100)), el('span', {}, ' del capítulo')),
      ),
      H.barra(H.progresoCap(capId, cap), 'Progreso del capítulo'),
      el('ul', { class: 'est-trk-lista' },
        fila(c.nivelJugado, 'Nivel de plataformas jugado', c.nivelJugado ? 'Ya exploraste el nivel.' : 'Aún no lo juegas (o lo saltaste).'),
        fila(c.nivelGanado, 'Nivel ganado', c.nivelGanado ? 'Llegaste a la meta.' : 'Llega a la meta para ganar XP y una pista en el quiz.'),
        fila(c.jefeDerrotado, 'Jefe derrotado', c.jefeDerrotado ? 'Jefe vencido.' : 'Pendiente (solo en niveles con jefe).'),
        fila(c.introVista, 'Intro vista', c.introVista ? 'Viste la animación de introducción.' : 'Pendiente.'),
        fila(nF > 0 && dom >= nF, 'Fórmulas dominadas', dom + ' / ' + nF + (nF ? ' (para 3★ se necesita ≥ 80 %)' : ''), nF ? dom / nF : 0),
        fila(nE > 0 && res >= nE, 'Ejercicios tipo bac resueltos', res + ' / ' + nE, nE ? res / nE : 0),
        fila(c.quizMejor >= 70, 'Mejor resultado del quiz', c.quizMejor + ' %   ·  2★ ≥ 70 %  ·  3★ ≥ 90 %', c.quizMejor / 100),
      ),
    );
  };

  // ---------------------------------------------------------------------------
  // Panel global (reutilizable por otras pantallas)
  // ---------------------------------------------------------------------------
  E.panelProgreso = function (host) {
    let visto = false;
    async function pintar() {
      const p = PCB.store.get(), indice = (await PCB.data.indice()) || { capitulos: [] };
      const caps = Object.entries(p.capitulos || {});
      const sum = (f) => caps.reduce((a, [, c]) => a + f(c), 0);
      const nivel = Math.floor(p.xp / 200) + 1, enNivel = (p.xp % 200) / 200;
      const tile = (v, l) => el('div', { class: 'est-tile' }, el('b', {}, String(v)), el('span', {}, l));
      const input = el('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'est-imp-' + Math.random().toString(36).slice(2), on: { change: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { const obj = JSON.parse(await f.text()); PCB.util.toast(PCB.store.importar(obj) ? 'Respaldo importado ✔' : 'Ese archivo no parece un respaldo válido'); }
        catch (err) { PCB.util.toast('No pude leer el archivo'); }
      } } });
      const filas = (indice.capitulos || []).map((ci) => {
        const c = p.capitulos[ci.id];
        return el('li', {}, el('button', { class: 'est-cap-fila', on: { click: () => PCB.flow && PCB.flow.irCapituloDirecto(ci.id) }, 'aria-label': 'Abrir ' + ci.titulo },
          el('span', { class: 'est-punto ' + (ci.materia === 'chimie' ? 'quimica' : 'fisica') }),
          el('span', { class: 'est-cap-n' }, String(ci.num)),
          el('span', { class: 'est-cap-t' }, ci.titulo),
          el('span', { class: 'est-cap-q' }, c ? c.quizMejor + ' %' : '—'),
          H.estrellas(c ? c.estrellas : 0)));
      });
      host.replaceChildren(
        el('div', { class: 'est-glob' },
          el('div', { class: 'est-nivel' }, el('div', { class: 'est-nivel-n' }, 'Nv ' + nivel),
            el('div', { class: 'est-nivel-b' }, el('b', {}, p.xp + ' XP'), H.barra(enNivel, 'Progreso hacia el siguiente nivel'), el('span', {}, (200 - (p.xp % 200)) + ' XP para el nivel ' + (nivel + 1)))),
          el('div', { class: 'est-tiles' },
            tile('🔥 ' + p.racha.dias, 'días de racha'),
            tile(sum((c) => c.estrellas || 0) + ' ★', 'estrellas'),
            tile(caps.filter(([, c]) => c.estado === 'completado' || c.estado === 'dominado').length + ' / ' + ((indice.capitulos || []).length || '—'), 'capítulos completados'),
            tile(sum((c) => c.formulasDominadas.length), 'fórmulas dominadas'),
            tile(sum((c) => c.ejerciciosResueltos.length), 'ejercicios resueltos')),
          filas.length ? el('ul', { class: 'est-cap-lista' }, filas) : null,
          el('div', { class: 'est-respaldo' },
            el('h4', {}, 'Respaldo del progreso'),
            el('p', {}, 'Guarda tu progreso en un archivo .json (o recupéralo en otro equipo).'),
            el('div', { class: 'est-fila-btn' },
              el('button', { class: 'btn', on: { click: () => PCB.store.exportar() } }, '⬇ Exportar respaldo'),
              el('label', { class: 'btn', for: input.id, tabindex: '0', on: { keydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.click()) } }, '⬆ Importar respaldo'), input))));
    }
    const onStore = () => {
      if (host.isConnected) visto = true;
      else if (visto) { PCB.bus.off('store', onStore); return; }
      pintar();
    };
    PCB.bus.on('store', onStore);
    pintar();
    return { dispose() { PCB.bus.off('store', onStore); } };
  };
})();
