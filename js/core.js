// =====================================================================================
// core.js — núcleo de la app: utilidades, bus de eventos, datos, progreso, router y flujo
// Todo cuelga de window.PCB. Ver CONTRATO.md §2.
// =====================================================================================
(function () {
  const PCB = (window.PCB = window.PCB || {});

  // ---------- util ----------
  const util = (PCB.util = {});
  /** Crea un elemento DOM: el('div',{class:'x',on:{click:f},style:{color:'red'}}, 'texto', hijoEl) */
  util.el = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => c != null && c !== false && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  };
  /** Renderiza LaTeX con KaTeX (local). Nunca lanza error. */
  util.tex = function (latex, host, opts) {
    try { window.katex.render(latex, host, { throwOnError: false, displayMode: !!(opts && opts.display), strict: 'ignore' }); }
    catch (e) { host.textContent = latex; }
    return host;
  };
  const _cache = {};
  util.fetchJSON = (url) => (_cache[url] ||= fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  util.reducedMotion = () => !!(PCB.settings && PCB.settings.reducirAnimaciones) || matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** PRNG determinista (mulberry32) */
  util.rng = (seed = 1) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  util.toast = (msg, ms = 2200) => { const t = util.el('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), ms); };
  util.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  util.fmt = (v, dec = 2) => Number(v).toFixed(dec).replace('.', ','); // coma decimal como en el cours

  // ---------- bus ----------
  const _ev = {};
  PCB.bus = {
    on: (e, f) => ((_ev[e] ||= []).push(f), f),
    off: (e, f) => { _ev[e] = (_ev[e] || []).filter((x) => x !== f); },
    emit: (e, d) => (_ev[e] || []).slice().forEach((f) => { try { f(d); } catch (err) { console.error(err); } }),
  };

  // ---------- datos (contenido ya generado, solo lectura) ----------
  // Si existe contenido/bundle.js (window.PCB_CONTENIDO) se lee de ahí: la app funciona abriendo index.html sin servidor.
  // Si no, se pide por fetch a contenido/*.json (modo servidor).
  const B = () => window.PCB_CONTENIDO;
  const del = (tipo, carpeta, id) => (B() ? Promise.resolve((B()[tipo] || {})[id] || null) : util.fetchJSON(`contenido/${carpeta}/${id}.json`));
  PCB.data = {
    indice: () => (B() ? Promise.resolve(B().indice) : util.fetchJSON('contenido/indice.json')),
    capitulo: (id) => del('capitulos', 'capitulos', id),
    nivel: (id) => del('niveles', 'niveles', id),
    intro: (id) => del('intros', 'intros', id),
    quiz: (id) => del('quizzes', 'quizzes', id),
    // {capitulos:[ids], niveles:[...], intros:[...], quizzes:[...]}
    disponibles: () => (B()
      ? Promise.resolve({ capitulos: Object.keys(B().capitulos), niveles: Object.keys(B().niveles), intros: Object.keys(B().intros), quizzes: Object.keys(B().quizzes) })
      : util.fetchJSON('/api/contenido')),
  };
  // /api/progreso solo existe con el servidor (http); abriendo index.html (file://) el progreso va a localStorage
  const hayServidor = location.protocol === 'http:' || location.protocol === 'https:';

  // ---------- ajustes ----------
  PCB.settings = { reducirAnimaciones: false, estiloIntro: 'auto', musica: false, sfx: true };

  // ---------- progreso (data/progreso.json vía servidor; copia en localStorage) ----------
  const vacio = () => ({ version: 1, xp: 0, racha: { dias: 0, ultimo: null }, ajustes: {}, capitulos: {} });
  let prog = vacio(), saveT = null;
  const persist = () => {
    const s = JSON.stringify(prog);
    try { localStorage.setItem('pcb_progreso', s); } catch (e) {}
    if (hayServidor) fetch('/api/progreso', { method: 'POST', body: s }).catch(() => {});
  };
  PCB.store = {
    get: () => prog,
    update(fn) { fn(prog); clearTimeout(saveT); saveT = setTimeout(persist, 250); PCB.bus.emit('store', prog); },
    cap(id) {
      return (prog.capitulos[id] ||= { nivelJugado: false, nivelGanado: false, jefeDerrotado: false, introVista: false, formulasDominadas: [], ejerciciosResueltos: [], quizMejor: 0, estrellas: 0, estado: 'disponible' });
    },
    addXP(n, motivo) { PCB.store.update((p) => { p.xp += n; }); PCB.bus.emit('xp', { n, motivo }); },
    /** Mantiene la racha diaria; llamar al abrir la app */
    tocarRacha() {
      const hoy = new Date().toISOString().slice(0, 10);
      PCB.store.update((p) => {
        if (p.racha.ultimo === hoy) return;
        const ayer = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        p.racha.dias = p.racha.ultimo === ayer ? p.racha.dias + 1 : 1; p.racha.ultimo = hoy;
      });
    },
    exportar() { const b = new Blob([JSON.stringify(prog, null, 1)], { type: 'application/json' }); const a = util.el('a', { href: URL.createObjectURL(b), download: 'progreso-physique-chimie.json' }); a.click(); },
    importar(obj) { if (obj && obj.version) { prog = Object.assign(vacio(), obj); persist(); PCB.bus.emit('store', prog); return true; } return false; },
  };
  async function cargarProgreso() {
    let p = null;
    if (hayServidor) { try { p = await (await fetch('/api/progreso')).json(); } catch (e) {} }
    if (!p) { try { p = JSON.parse(localStorage.getItem('pcb_progreso')); } catch (e) {} }
    if (p && p.version) prog = Object.assign(vacio(), p);
    PCB.settings = Object.assign(PCB.settings, prog.ajustes || {});
  }

  // ---------- router ----------
  PCB.screens = PCB.screens || {};
  let actual = null, hostActual = null;
  PCB.router = {
    get pantalla() { return actual && actual.nombre; },
    async go(nombre, ctx) {
      const S = PCB.screens[nombre];
      if (!S) { util.toast('Pantalla no disponible: ' + nombre); return; }
      if (actual && PCB.screens[actual.nombre].unmount) { try { PCB.screens[actual.nombre].unmount(); } catch (e) { console.error(e); } }
      if (hostActual) hostActual.remove();
      hostActual = util.el('div', { class: 'pantalla pantalla-' + nombre, id: 'pantalla-' + nombre });
      document.getElementById('app').append(hostActual);
      actual = { nombre, ctx };
      document.body.dataset.pantalla = nombre;
      try { await S.mount(hostActual, ctx || {}); } catch (e) { console.error(e); hostActual.append(util.el('pre', { style: { padding: '20px', color: '#ff8' } }, 'Error en ' + nombre + ': ' + e.message)); }
      PCB.bus.emit('pantalla', nombre); renderTopbar();
    },
  };

  // ---------- flujo: mapa -> nivel -> intro -> capítulo ----------
  PCB.flow = {
    /** Clic en un nodo del mapa */
    async entrarCapitulo(capId) {
      const [nivel, capitulo] = await Promise.all([PCB.data.nivel(capId), PCB.data.capitulo(capId)]);
      if (nivel && PCB.screens.juego) return PCB.router.go('juego', { capId, nivel, capitulo });
      return PCB.flow.saltarJuego(capId);
    },
    /** El juego avisa al terminar (morir o ganar) */
    finNivel(res) {
      const { capId, gano, coleccionados = 0, jefeDerrotado = false } = res;
      const bonus = { xp: 0, pista: false };
      if (gano) { bonus.xp = 50 + coleccionados * 5 + (jefeDerrotado ? 50 : 0); bonus.pista = true; }
      PCB.store.update((p) => { const c = PCB.store.cap(capId); c.nivelJugado = true; if (gano) c.nivelGanado = true; if (jefeDerrotado) c.jefeDerrotado = true; });
      if (bonus.xp) PCB.store.addXP(bonus.xp, 'nivel');
      PCB.flow._bonus = bonus;
      return PCB.flow.saltarJuego(capId);
    },
    /** "Saltar juego" o fin de nivel: va a la intro (si existe) y luego al capítulo */
    async saltarJuego(capId) {
      const guion = await PCB.data.intro(capId);
      if (guion && PCB.screens.intro) return PCB.router.go('intro', { capId, guion, onFin: () => PCB.flow.finIntro(capId) });
      return PCB.flow.finIntro(capId);
    },
    async finIntro(capId) {
      PCB.store.update(() => { PCB.store.cap(capId).introVista = true; });
      const [capitulo, quiz] = await Promise.all([PCB.data.capitulo(capId), PCB.data.quiz(capId)]);
      const bonus = PCB.flow._bonus; PCB.flow._bonus = null;
      return PCB.router.go('capitulo', { capId, capitulo, quiz, bonus });
    },
    /** Directo al capítulo sin juego ni intro (p. ej. desde la pestaña del mapa) */
    async irCapituloDirecto(capId) { return PCB.flow.finIntro(capId); },
    volverMapa() { return PCB.router.go('mapa'); },
  };

  // ---------- barra superior (global) ----------
  function renderTopbar() {
    const tb = document.getElementById('topbar'); const n = actual && actual.nombre; const c = actual && actual.ctx;
    tb.replaceChildren(...[
      util.el('span', { class: 'marca' }, 'SUPER CLAUDE BROS'),
      n && n !== 'mapa' ? util.el('button', { class: 'btn mini', on: { click: () => PCB.flow.volverMapa() } }, '← Mapa') : null,
      n === 'juego' ? util.el('button', { class: 'btn mini', title: 'Ir directo al capítulo', on: { click: () => PCB.flow.saltarJuego(c.capId) } }, 'Saltar juego → capítulo') : null,
      n === 'intro' ? util.el('button', { class: 'btn mini', on: { click: () => PCB.flow.finIntro(c.capId) } }, 'Saltar intro ⏭') : null,
      util.el('span', { class: 'sp' }),
      util.el('span', { class: 'chip' }, '🔥 ' + prog.racha.dias + ' d'),
      util.el('span', { class: 'xp' }, '★ ' + prog.xp + ' XP'),
      util.el('button', { class: 'btn mini', title: 'Reducir animaciones', on: { click: () => { PCB.settings.reducirAnimaciones = !PCB.settings.reducirAnimaciones; PCB.store.update((p) => { p.ajustes = PCB.settings; }); util.toast('Animaciones reducidas: ' + (PCB.settings.reducirAnimaciones ? 'sí' : 'no')); } } }, '🐢')
    ].filter(Boolean));
  }
  PCB.bus.on('store', () => document.getElementById('topbar') && renderTopbar());

  // ---------- arranque ----------
  PCB.boot = async function () {
    await cargarProgreso();
    PCB.store.tocarRacha();
    renderTopbar();
    PCB.router.go(PCB.screens.mapa ? 'mapa' : 'capitulo', {});
  };
})();
