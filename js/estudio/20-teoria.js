// =====================================================================================
// 20-teoria.js — pestañas de teoría: Resumen · Fórmulas · Métodos · Errores · Laboratorio
// Cada constructor recibe el contexto {capId, cap, quiz, bonus, irA(tab)} y devuelve
//   {el, onShow?(), onHide?(), dispose?()}
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB, { el, tex } = PCB.util;
  const E = PCB.estudio, H = E.h;
  const T = (E.tabs = E.tabs || {});

  // ---------------------------------------------------------------------------
  // 1. RESUMEN
  // ---------------------------------------------------------------------------
  T.resumen = function (ctx) {
    const cap = ctx.cap;
    const secciones = [];
    secciones.push(el('section', { class: 'est-sec' },
      el('h2', {}, 'En resumen'),
      H.p('est-lead', cap.resumen || 'Este capítulo aún no tiene resumen.'),
      cap.resumen_fr ? el('details', { class: 'est-det' }, el('summary', {}, '🇫🇷 En français'), H.p('est-fr', cap.resumen_fr)) : null));

    const nociones = cap.nociones_clave || [];
    if (nociones.length) {
      secciones.push(el('section', { class: 'est-sec' },
        el('h2', {}, 'Nociones clave', el('small', {}, ' · ' + nociones.length)),
        el('ul', { class: 'est-nociones' }, nociones.map((n) => el('li', { class: 'est-noc' },
          el('div', { class: 'est-noc-fr', lang: 'fr' }, H.txt(n.fr)),
          el('div', { class: 'est-noc-es' }, H.txt(n.es)),
          H.pag(n.pagina_pdf))))));
    }
    const consts = cap.constantes || [];
    if (consts.length) {
      secciones.push(el('section', { class: 'est-sec' },
        el('h2', {}, 'Constantes del cours'),
        el('div', { class: 'est-consts' }, consts.map((k) => el('div', { class: 'est-const', title: 'Pág. ' + (k.pagina_pdf || '?') },
          el('span', { class: 'est-const-n' }, H.txt(k.nombre)), el('span', { class: 'est-const-v' }, k.valor + (k.unidad ? ' ' + k.unidad : '')), H.pag(k.pagina_pdf))))));
    }
    const exps = cap.experiencias || [];
    if (exps.length) {
      secciones.push(el('section', { class: 'est-sec' },
        el('h2', {}, 'Experiencias y TP'),
        el('ul', { class: 'est-exps' }, exps.map((x) => el('li', {}, el('b', { lang: 'fr' }, x.titulo), ' — ', H.txt(x.descripcion || ''), ' ', H.pag(x.pagina_pdf))))));
    }
    secciones.push(el('div', { class: 'est-cta' },
      el('button', { class: 'btn primario', on: { click: () => ctx.irA('formulas') } }, 'Ir a las fórmulas →'),
      el('button', { class: 'btn', on: { click: () => ctx.irA('quiz') } }, 'Ponme a prueba')));
    return { el: el('div', { class: 'est-resumen' }, secciones) };
  };

  // ---------------------------------------------------------------------------
  // 2. FÓRMULAS — lo más importante: tarjetas grandes con animación
  // ---------------------------------------------------------------------------
  /** Abre el modal de animación; si falta animación o preset usa el genérico */
  function abrirAnim(f) {
    const a = f.animacion || { preset: 'generico', params: {} };
    let preset = a.preset || 'generico', params = Object.assign({}, a.params);
    if (!PCB.anim.get(preset)) { preset = 'generico'; if (!params.expr) params.expr = 'x'; }
    PCB.anim.open(preset, { params, leyenda: a.leyenda && String(a.leyenda).replace(/\$([^$]*)\$/g, '$1'), latexBase: f.latex, titulo: f.nombre_fr || f.nombre });
  }
  E.abrirAnimacion = abrirAnim;

  T.formulas = function (ctx) {
    const { capId, cap } = ctx;
    const fs = cap.formulas || [];
    const st = { q: '', filtro: 'todas', flash: false, dir: 'formula' }, reveladas = new Set();
    const lista = el('div', { class: 'est-fgrid' });
    const contador = el('span', { class: 'est-fcount', 'aria-live': 'polite' });
    const buscador = el('input', { type: 'search', class: 'est-input', placeholder: 'Buscar fórmula, variable…', 'aria-label': 'Buscar fórmulas', on: { input: (e) => { st.q = e.target.value; pintar(); } } });
    const selFiltro = el('select', { class: 'est-input', 'aria-label': 'Filtrar fórmulas', on: { change: (e) => { st.filtro = e.target.value; pintar(); } } },
      el('option', { value: 'todas' }, 'Todas'), el('option', { value: 'pendientes' }, 'Por dominar'), el('option', { value: 'dominadas' }, 'Dominadas'));
    const selDir = el('select', { class: 'est-input', 'aria-label': 'Dirección de la flashcard', style: { display: 'none' }, on: { change: (e) => { st.dir = e.target.value; reveladas.clear(); pintar(); } } },
      el('option', { value: 'formula' }, 'Veo la fórmula → adivino el nombre'), el('option', { value: 'nombre' }, 'Veo el nombre → adivino la fórmula'));
    const bFlash = el('button', { class: 'btn', 'aria-pressed': 'false', on: { click: () => {
      st.flash = !st.flash; reveladas.clear(); bFlash.setAttribute('aria-pressed', String(st.flash));
      bFlash.textContent = st.flash ? '🎴 Flashcards: sí' : '🎴 Modo flashcard'; selDir.style.display = st.flash ? '' : 'none'; pintar();
    } } }, '🎴 Modo flashcard');

    const coincide = (f) => {
      if (!st.q.trim()) return true;
      const hay = H.norm([f.nombre, f.nombre_fr, f.latex, f.explicacion, (f.variables || []).map((v) => v.simbolo + ' ' + v.significado).join(' ')].join(' '));
      return H.norm(st.q).split(/\s+/).every((w) => hay.includes(w));
    };

    function tarjeta(f) {
      const c = PCB.store.cap(capId), dom = c.formulasDominadas.includes(f.id);
      const oculta = st.flash && !reveladas.has(f.id);
      const titulo = f.nombre_fr || f.nombre || 'Formule';
      const sub = f.nombre_fr && f.nombre && f.nombre !== f.nombre_fr ? f.nombre : '';
      const tieneAnim = true; // siempre hay animación: el preset específico o el genérico
      const texBtn = el('button', { class: 'est-ftex', title: 'Pulsa para ver la animación', 'aria-label': 'Ver la animación de ' + titulo, on: { click: () => abrirAnim(f) } });
      if (oculta && st.dir === 'nombre') texBtn.append(el('span', { class: 'est-oculto' }, '¿Cuál es la fórmula?'));
      else H.formula(f.latex, texBtn.appendChild(el('div', { class: 'est-ftex-in' })));
      texBtn.append(el('span', { class: 'est-ftex-hint', 'aria-hidden': 'true' }, '▶ animación'));

      const vars = (f.variables || []).length ? el('table', { class: 'est-vars' },
        el('caption', { class: 'sr-only' }, 'Variables'),
        el('tbody', {}, f.variables.map((v) => el('tr', {},
          el('th', { scope: 'row' }, tex(v.simbolo || '', el('span'))), el('td', {}, H.txt(v.significado)), el('td', { class: 'u' }, v.unidad || '—'))))) : null;

      const ejId = 'ej-' + f.id + '-' + Math.random().toString(36).slice(2, 7);
      const ej = f.ejemplo ? el('div', { class: 'est-ej' },
        el('button', { class: 'btn mini', 'aria-expanded': 'false', 'aria-controls': ejId, on: { click: (e) => {
          const b = e.currentTarget, panel = document.getElementById(ejId), abre = panel.hidden;
          panel.hidden = !abre; b.setAttribute('aria-expanded', String(abre)); b.textContent = abre ? '▾ Ocultar ejemplo' : '▸ Ver ejemplo numérico';
        } } }, '▸ Ver ejemplo numérico'),
        el('div', { class: 'est-ej-cuerpo', id: ejId, hidden: true },
          H.p('', f.ejemplo.enunciado), f.ejemplo.resultado ? el('p', { class: 'est-ej-res' }, el('b', {}, '→ '), H.txt(f.ejemplo.resultado)) : null, H.pag(f.ejemplo.pagina_pdf))) : null;

      const detalles = el('div', { class: 'est-fdet' }, vars, f.explicacion ? H.p('est-fexp', f.explicacion) : null, ej);
      const botones = [];
      if (st.flash && oculta) botones.push(el('button', { class: 'btn primario', on: { click: () => { reveladas.add(f.id); pintar(f.id); } } }, '👁 Revelar'));
      else {
        botones.push(el('button', { class: 'btn primario est-anim-btn', on: { click: () => abrirAnim(f) } }, '▶ Ver la animación'));
        botones.push(el('button', { class: 'btn est-dom-btn' + (dom ? ' on' : ''), 'aria-pressed': String(dom), on: { click: () => { H.toggleDominada(capId, cap, f.id); pintar(f.id); } } }, dom ? '✔ Dominada' : '☐ Marcar dominada'));
      }
      const art = el('article', { class: 'est-fcard' + (dom ? ' dominada' : '') + (oculta ? ' oculta oculta-' + st.dir : ''), id: 'f-' + f.id },
        el('header', {}, el('div', {},
          oculta && st.dir === 'formula' ? el('h3', { class: 'est-oculto' }, 'Fórmula ' + (fs.indexOf(f) + 1) + ' · ¿cómo se llama?') : el('h3', { lang: 'fr' }, titulo),
          sub && !(oculta && st.dir === 'formula') ? el('div', { class: 'est-fsub' }, sub) : null),
          el('div', { class: 'est-fhead-r' }, H.pag(f.pagina_pdf), dom ? el('span', { class: 'est-badge' }, '✔') : null)),
        texBtn,
        oculta ? null : detalles,
        el('div', { class: 'est-facc' }, botones));
      return art;
    }

    function pintar(foco) {
      const c = PCB.store.cap(capId);
      const visibles = fs.filter((f) => coincide(f) && (st.filtro === 'todas' || (st.filtro === 'dominadas') === c.formulasDominadas.includes(f.id)));
      lista.replaceChildren(...(visibles.length ? visibles.map(tarjeta) : [el('p', { class: 'est-vacio' }, fs.length ? 'Ninguna fórmula coincide con el filtro.' : 'Este capítulo no tiene fórmulas registradas.')]));
      contador.textContent = H.dominadas(capId, cap).length + ' / ' + fs.length + ' dominadas · mostrando ' + visibles.length;
      if (foco) { const n = lista.querySelector('#f-' + CSS.escape(foco) + ' .est-facc button:last-child, #f-' + CSS.escape(foco) + ' .est-facc button'); if (n) n.focus({ preventScroll: true }); }
    }
    pintar();
    return { el: el('div', { class: 'est-formulas' },
      el('div', { class: 'est-ftools' }, buscador, selFiltro, bFlash, selDir, contador), lista), onShow: () => pintar() };
  };

  // ---------------------------------------------------------------------------
  // 3. MÉTODOS — pasos numerados desplegables
  // ---------------------------------------------------------------------------
  T.metodos = function (ctx) {
    const ms = ctx.cap.metodos || [];
    if (!ms.length) return { el: el('p', { class: 'est-vacio' }, 'Este capítulo no tiene métodos registrados.') };
    return { el: el('div', { class: 'est-metodos' }, ms.map((m, i) => el('details', { class: 'est-metodo', open: i === 0 },
      el('summary', {}, el('span', { class: 'est-num' }, String(i + 1)), el('span', { class: 'est-met-t', lang: 'fr' }, H.txt(m.titulo)), el('span', { class: 'est-met-n' }, (m.pasos || []).length + ' pasos'), H.pag(m.pagina_pdf)),
      el('ol', { class: 'est-pasos' }, (m.pasos || []).map((p) => el('li', {}, H.txt(p))))))) };
  };

  // ---------------------------------------------------------------------------
  // 4. ERRORES TÍPICOS — los mismos "enemigos" del nivel
  // ---------------------------------------------------------------------------
  T.errores = function (ctx) {
    const es = ctx.cap.errores_tipicos || [];
    if (!es.length) return { el: el('p', { class: 'est-vacio' }, 'Este capítulo no tiene errores típicos registrados.') };
    return { el: el('div', { class: 'est-errores' },
      el('p', { class: 'est-intro' }, 'Son los enemigos del nivel de plataformas: aprende a reconocerlos y evítalos en el examen.'),
      el('div', { class: 'est-egrid' }, es.map((e) => el('article', { class: 'est-err' },
        el('div', { class: 'est-err-mal' }, el('span', { 'aria-hidden': 'true' }, '👾'), el('h3', {}, H.txt(e.nombre))),
        el('div', { class: 'est-err-flecha', 'aria-hidden': 'true' }, '⬇'),
        el('div', { class: 'est-err-bien' }, el('span', { 'aria-hidden': 'true' }, '✔'), H.p('', e.correccion)),
        H.pag(e.pagina_pdf))))) };
  };

  // ---------------------------------------------------------------------------
  // 5. LABORATORIO — simuladores grandes con sliders (montaje perezoso)
  // ---------------------------------------------------------------------------
  const plano = (s) => (s == null ? s : String(s).replace(/\$([^$]*)\$/g, '$1')); // leyenda del motor es texto plano

  T.lab = function (ctx) {
    const cap = ctx.cap, fs = cap.formulas || [];
    // Elementos: laboratorio[] + fórmulas con animación (sin duplicar preset+params iguales)
    const items = [], vistos = new Set();
    const clave = (preset, params) => preset + '|' + JSON.stringify(params || {});
    (cap.laboratorio || []).forEach((l) => {
      const f = fs.find((x) => x.animacion && x.animacion.preset === l.preset);
      vistos.add(clave(l.preset, l.params));
      items.push({ titulo: l.titulo || l.preset, sub: l.relacion, preset: l.preset, params: l.params, leyenda: plano(l.relacion), latexBase: f && f.latex, tipo: 'lab' });
    });
    fs.forEach((f) => {
      if (!f.animacion || !f.animacion.preset) return;
      const k = clave(f.animacion.preset, f.animacion.params); if (vistos.has(k)) return; vistos.add(k);
      items.push({ titulo: f.nombre_fr || f.nombre, sub: f.animacion.leyenda || 'Fórmula del capítulo', preset: f.animacion.preset, params: f.animacion.params, leyenda: plano(f.animacion.leyenda), latexBase: f.latex, tipo: 'formula' });
    });
    if (!items.length) return { el: el('p', { class: 'est-vacio' }, 'Este capítulo aún no tiene simuladores.') };

    let sel = 0, sim = null, montado = false;
    const stage = el('div', { class: 'est-stage', role: 'region', 'aria-label': 'Simulador', 'aria-live': 'polite' });
    const cab = el('div', { class: 'est-stage-cab' });
    const lista = el('div', { class: 'est-lablist', role: 'listbox', 'aria-label': 'Simuladores del capítulo' });

    function soltar() { if (sim) { try { sim.dispose(); } catch (e) { console.error(e); } sim = null; } stage.replaceChildren(); }
    function montar() {
      soltar();
      const it = items[sel];
      cab.replaceChildren(el('h3', {}, it.titulo), it.sub ? el('p', {}, H.txt(it.sub)) : null);
      let preset = it.preset, params = Object.assign({}, it.params);
      if (!PCB.anim.get(preset)) { preset = 'generico'; if (!params.expr) params.expr = 'x'; }
      try { sim = PCB.anim.mountInline(stage, preset, { params, leyenda: it.leyenda, latexBase: it.latexBase }); }
      catch (e) { console.error(e); stage.replaceChildren(el('p', { class: 'est-vacio' }, 'No se pudo cargar este simulador (' + preset + ').')); }
      [...lista.children].forEach((b, i) => { b.setAttribute('aria-selected', String(i === sel)); b.tabIndex = i === sel ? 0 : -1; b.classList.toggle('on', i === sel); });
    }
    items.forEach((it, i) => lista.append(el('button', { class: 'est-labitem', role: 'option', 'aria-selected': 'false', tabindex: '-1', on: {
      click: () => { sel = i; montar(); },
      keydown: (e) => { const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); sel = (sel + d + items.length) % items.length; montar(); lista.children[sel].focus(); } },
    } }, el('span', { class: 'est-labic', 'aria-hidden': 'true' }, it.tipo === 'lab' ? '🧪' : '∑'), el('span', {}, el('b', {}, it.titulo), el('small', {}, it.preset)))));

    return {
      el: el('div', { class: 'est-lab' }, lista, el('div', { class: 'est-labmain' }, cab, stage)),
      onShow() { if (!montado || !sim) { montado = true; montar(); } },
      onHide() { soltar(); },
      dispose() { soltar(); },
    };
  };
})();
