// =====================================================================================
// 60-ui.js — entrada (teclado, táctil, gamepad) y capa DOM del juego (HUD, avisos, preguntas, pausa, fin)
// El HUD usa la fuente PixelHUD; las fórmulas se renderizan con PCB.util.tex (KaTeX).
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const el = (...a) => window.PCB.util.el(...a);
  const tex = (l, h, o) => window.PCB.util.tex(l, h, o);

  // ---------- iconos de píxel en SVG (PixelHUD no trae ♥) ----------
  function iconoSVG(filas, color, px) {
    const w = filas[0].length, h = filas.length;
    let r = '';
    filas.forEach((f, y) => { for (let x = 0; x < w; x++) if (f[x] === 'X') r += `<rect x="${x}" y="${y}" width="1" height="1"/>`; });
    const s = document.createElement('span');
    s.className = 'jg-ico';
    s.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w * px}" height="${h * px}" shape-rendering="crispEdges" fill="${color}">${r}</svg>`;
    return s;
  }
  const CORAZON = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  const GEMA = ['..XX..', '.XXXX.', 'XXXXXX', 'XXXXXX', '.XXXX.', '..XX..'];

  /** PixelHUD (Press Start 2P) pinta mal algunas mayúsculas con tilde: las quitamos en el HUD. */
  const sinTildes = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¡¿]/g, (c) => c);

  // ---------- entrada ----------
  J.crearInput = function (onPausa) {
    const inp = { izq: false, der: false, salto: false, accion: false, saltoEdge: false, t: { izq: false, der: false, salto: false, acc: false }, dir: 0, destroy: null, bloqueado: false };
    const K = {
      izq: ['ArrowLeft', 'a', 'A'], der: ['ArrowRight', 'd', 'D'], salto: [' ', 'ArrowUp', 'w', 'W', 'z', 'Z'], acc: ['ArrowDown', 'e', 'E', 's', 'S'], pausa: ['Escape', 'p', 'P'],
    };
    const teclas = {};
    let gpPrev = { pausa: false };
    const gp = { izq: false, der: false, salto: false };
    const recalcular = () => {
      inp.dir = (inp.der || inp.t.der || gp.der ? 1 : 0) - (inp.izq || inp.t.izq || gp.izq ? 1 : 0);
      inp.salto = !!(teclas.salto || inp.t.salto || gp.salto);
      inp.accion = teclas.acc || inp.t.acc;
    };
    const kd = (e) => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (inp.onTecla && inp.onTecla(e)) { e.preventDefault(); return; }   // modales
      let usada = true;
      if (K.izq.includes(e.key)) inp.izq = true;
      else if (K.der.includes(e.key)) inp.der = true;
      else if (K.salto.includes(e.key)) { if (!teclas.salto) inp.saltoEdge = true; teclas.salto = true; }
      else if (K.acc.includes(e.key)) teclas.acc = true;
      else if (K.pausa.includes(e.key)) { if (!e.repeat) onPausa(); }
      else usada = false;
      if (usada) e.preventDefault();
      if (J.Audio) J.Audio.activar();
      recalcular();
    };
    const ku = (e) => {
      if (K.izq.includes(e.key)) inp.izq = false;
      else if (K.der.includes(e.key)) inp.der = false;
      else if (K.salto.includes(e.key)) teclas.salto = false;
      else if (K.acc.includes(e.key)) teclas.acc = false;
      recalcular();
    };
    const blur = () => { inp.izq = inp.der = false; teclas.salto = teclas.acc = false; Object.keys(inp.t).forEach((k) => (inp.t[k] = false)); recalcular(); };
    const gesto = () => { if (J.Audio) J.Audio.activar(); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    window.addEventListener('pointerdown', gesto);
    inp.recalcular = recalcular;
    inp.setToque = (k, v) => { if (k === 'salto' && v && !inp.t.salto) inp.saltoEdge = true; inp.t[k] = v; recalcular(); };
    /** Gamepad opcional: se consulta una vez por fotograma. */
    inp.sondear = function () {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = pads && pads[0];
      if (!pad) { if (gp.izq || gp.der || gp.salto) { gp.izq = gp.der = gp.salto = false; recalcular(); } return; }
      const ax = pad.axes[0] || 0, b = (i) => pad.buttons[i] && pad.buttons[i].pressed;
      const n = { izq: ax < -0.4 || b(14), der: ax > 0.4 || b(15), salto: b(0) || b(2) || b(12) }, pausa = b(9);
      if (n.salto && !gp.salto) inp.saltoEdge = true;
      if (pausa && !gpPrev.pausa) onPausa();
      gpPrev = { pausa };
      Object.assign(gp, n); recalcular();
    };
    inp.destroy = () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); window.removeEventListener('pointerdown', gesto); };
    return inp;
  };

  // ---------- texto con LaTeX en línea: "calcula $n=\dfrac{m}{M}$" ----------
  function textoConTex(s, host) {
    String(s).split('$').forEach((trozo, i) => {
      if (i % 2) { const sp = el('span', { class: 'jg-tex' }); tex(trozo, sp); host.append(sp); }
      else host.append(document.createTextNode(trozo));
    });
    return host;
  }

  // ---------- capa de interfaz ----------
  J.crearUI = function (host, g, cb) {
    const ui = {};
    const canvas = el('canvas', { class: 'jg-canvas', width: J.VW, height: J.VH });
    const hudVidas = el('div', { class: 'jg-vidas' }), hudTiempo = el('div', { class: 'jg-tiempo' }, '00:00'), hudItems = el('div', { class: 'jg-items' });
    const jefeBar = el('div', { class: 'jg-jefe', style: { display: 'none' } });
    const hud = el('div', { class: 'jg-hud' }, el('div', { class: 'jg-hud-fila' }, hudVidas, hudTiempo, hudItems), jefeBar);
    const pops = el('div', { class: 'jg-pops' }), aviso = el('div', { class: 'jg-aviso' });
    const capa = el('div', { class: 'jg-capa' });
    const wrap = el('div', { class: 'jg-wrap' }, canvas, hud, pops, aviso, capa);
    const tactil = el('div', { class: 'jg-touch' });
    const root = el('div', { class: 'jg-root' }, wrap, tactil);
    host.append(root);
    ui.canvas = canvas; ui.root = root; ui.wrap = wrap; ui.capa = capa;

    // --- tamaño: escala entera (si cabe) con imagen pixelada ---
    ui.ajustar = function () {
      const r = host.getBoundingClientRect();
      const w = r.width, h = r.height - (ui.tactilVisible ? 0 : 0);
      let s = Math.floor(Math.min(w / J.VW, h / J.VH));
      if (s < 1) s = Math.max(0.3, Math.min(w / J.VW, h / J.VH));
      ui.escala = s;
      wrap.style.width = J.VW * s + 'px'; wrap.style.height = J.VH * s + 'px';
      root.style.setProperty('--s', s);
    };
    const ro = new ResizeObserver(() => ui.ajustar()); ro.observe(host);
    ui.ajustar();

    // --- HUD ---
    let ultVidas = -1;
    ui.vidas = function (n) {
      if (n === ultVidas) return; ultVidas = n;
      hudVidas.replaceChildren();
      for (let i = 0; i < 3; i++) hudVidas.append(iconoSVG(CORAZON, i < n ? '#ff4d6d' : '#3a4266', 3));
    };
    let ultItems = '';
    ui.hud = function (gg) {
      const s = Math.floor(gg.tiempo), t = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      if (hudTiempo.textContent !== t) hudTiempo.textContent = t;
      const it = gg.coleccionados + '/' + gg.w.items.length;
      if (it !== ultItems) { ultItems = it; hudItems.replaceChildren(iconoSVG(GEMA, '#19e3ff', 3), document.createTextNode(' ' + it)); }
    };
    ui.vidas(g.vidas);

    ui.jefe = function (b) {
      jefeBar.style.display = ''; jefeBar.replaceChildren();
      jefeBar.append(el('span', { class: 'jg-jefe-n' }, sinTildes(b.nombre).toUpperCase()));
      const pips = el('span', { class: 'jg-pips' });
      for (let i = 0; i < 3; i++) pips.append(el('span', { class: 'jg-pip' + (i < b.aciertos ? ' on' : '') }));
      jefeBar.append(pips);
    };
    ui.ocultarJefe = () => { jefeBar.style.display = 'none'; };

    // --- mini-avisos ---
    function pop(nodo, ms) {
      pops.append(nodo);
      while (pops.children.length > 3) pops.firstChild.remove();
      setTimeout(() => nodo.remove(), ms);
    }
    ui.formula = function (it) {
      const f = el('div', { class: 'jg-pop jg-pop-f' });
      const tx = el('div', { class: 'jg-pop-tex' }); tex(it.latex, tx);
      f.append(el('div', { class: 'jg-pop-t' }, 'FÓRMULA'), tx, el('div', { class: 'jg-pop-n' }, it.nombre));
      pop(f, 3600);
    };
    ui.error = function (e) {
      pop(el('div', { class: 'jg-pop jg-pop-e' }, el('div', { class: 'jg-pop-t' }, 'ERROR: ' + (e.nombre || '')), el('div', { class: 'jg-pop-n' }, '✔ ' + (e.correccion || ''))), 5200);
    };
    let tAviso = 0;
    ui.aviso = function (txt) {
      aviso.textContent = sinTildes(txt); aviso.classList.remove('on'); void aviso.offsetWidth; aviso.classList.add('on');
      clearTimeout(tAviso); tAviso = setTimeout(() => aviso.classList.remove('on'), 1600);
    };

    // --- modales ---
    let teclaModal = null;
    function modal(contenido, onTecla) {
      capa.replaceChildren(el('div', { class: 'jg-modal' }, contenido));
      teclaModal = onTecla || null; cb.input.onTecla = (e) => (teclaModal ? teclaModal(e) : true);
      capa.style.pointerEvents = 'auto';
    }
    ui.cerrarModal = function () { capa.replaceChildren(); teclaModal = null; cb.input.onTecla = null; capa.style.pointerEvents = 'none'; };

    ui.pregunta = function (q, info, alResponder) {
      let respondida = false;
      const opts = el('div', { class: 'jg-opts' }), expl = el('div', { class: 'jg-expl' });
      const botones = q.opciones.map((o, i) => {
        const b = el('button', { class: 'jg-opt', on: { click: () => elegir(i) } }, el('span', { class: 'jg-k' }, String(i + 1)), textoConTex(o, el('span', {})));
        opts.append(b); return b;
      });
      const cont = el('button', { class: 'jg-btn jg-btn-p', style: { display: 'none' }, on: { click: () => seguir() } }, 'Continuar');
      let ok = false;
      function elegir(i) {
        if (respondida) return; respondida = true;
        ok = i === q.correcta;
        botones.forEach((b, k) => { b.disabled = true; if (k === q.correcta) b.classList.add('ok'); else if (k === i) b.classList.add('mal'); });
        expl.append(el('b', {}, ok ? '✔ ¡Correcto! ' : '✖ Incorrecto. '));
        if (q.explicacion) textoConTex(q.explicacion, expl);
        if (q.pagina_pdf) expl.append(el('span', { class: 'jg-pag' }, '  (p. ' + q.pagina_pdf + ')'));
        cont.style.display = ''; cont.focus();
        J.Audio.sfx(ok ? 'acierto' : 'fallo');
      }
      function seguir() { if (!respondida) return; ui.cerrarModal(); alResponder(ok); }
      const card = el('div', { class: 'jg-card' },
        el('div', { class: 'jg-card-h' }, `${info.jefe} · Pregunta ${info.n} de 3`),
        textoConTex(q.pregunta, el('div', { class: 'jg-q' })), opts, expl, cont);
      modal(card, (e) => {
        if (/^[1-9]$/.test(e.key) && !respondida && +e.key <= q.opciones.length) { elegir(+e.key - 1); return true; }
        if ((e.key === 'Enter' || e.key === ' ') && respondida) { seguir(); return true; }
        return true;   // bloquea el resto de teclas mientras hay pregunta
      });
    };

    ui.pausa = function (acciones) {
      const estado = () => ({ m: window.PCB.settings.musica, s: window.PCB.settings.sfx !== false });
      const filaM = el('button', { class: 'jg-btn' }), filaS = el('button', { class: 'jg-btn' });
      const act = () => { const e = estado(); filaM.textContent = 'Música: ' + (e.m ? 'sí' : 'no'); filaS.textContent = 'Efectos: ' + (e.s ? 'sí' : 'no'); };
      const guardar = () => { try { window.PCB.store.update((p) => { p.ajustes = window.PCB.settings; }); } catch (e) {} };
      filaM.onclick = () => { window.PCB.settings.musica = !window.PCB.settings.musica; guardar(); act(); };
      filaS.onclick = () => { window.PCB.settings.sfx = window.PCB.settings.sfx === false; guardar(); act(); };
      act();
      const card = el('div', { class: 'jg-card jg-card-c' },
        el('div', { class: 'jg-titulo' }, 'PAUSA'),
        el('button', { class: 'jg-btn jg-btn-p', on: { click: acciones.continuar } }, 'Continuar'),
        el('button', { class: 'jg-btn', on: { click: acciones.reiniciar } }, 'Reiniciar nivel'),
        filaM, filaS,
        el('div', { class: 'jg-ayuda' }, '← → / A D mover · Espacio / ↑ saltar · P / Esc pausa'));
      modal(card, (e) => { if (e.key === 'Enter') { acciones.continuar(); return true; } return false; });
    };

    ui.fin = function (res, acciones) {
      const xp = res.gano ? 50 + res.coleccionados * 5 + (res.jefeDerrotado ? 50 : 0) : 0;
      const card = el('div', { class: 'jg-card jg-card-c jg-fin ' + (res.gano ? 'gano' : 'perdio') },
        el('div', { class: 'jg-gran' }, res.gano ? '✔' : '✖'),
        el('div', { class: 'jg-titulo' }, res.gano ? '¡NIVEL SUPERADO!' : 'SIN VIDAS'),
        el('div', { class: 'jg-stats' },
          el('div', {}, 'Fórmulas: ' + res.coleccionados + ' / ' + res.total),
          el('div', {}, 'Vidas: ' + res.vidasRestantes + ' / 3'),
          res.jefeDerrotado ? el('div', {}, 'Jefe derrotado') : null,
          el('div', { class: 'jg-xp' }, res.gano ? '+' + xp + ' XP' : 'Sin XP esta vez')),
        el('button', { class: 'jg-btn jg-btn-p', on: { click: acciones.continuar } }, 'Continuar →'),
        res.gano ? null : el('button', { class: 'jg-btn', on: { click: acciones.reintentar } }, 'Reintentar'));
      modal(card, (e) => { if (e.key === 'Enter') { acciones.continuar(); return true; } return true; });
    };

    ui.pista = function (txt, ms) {
      const p = el('div', { class: 'jg-pista' }, txt); wrap.append(p); setTimeout(() => p.remove(), ms || 5000);
    };

    // --- controles táctiles ---
    const tactilOn = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0 || /[?&]touch=1/.test(location.search);
    if (tactilOn) {
      root.classList.add('con-touch');
      const boton = (txt, clase, tecla) => {
        const b = el('button', { class: 'jg-tb ' + clase, 'aria-label': tecla }, txt);
        const on = (v) => (e) => { e.preventDefault(); if (v) { try { b.setPointerCapture(e.pointerId); } catch (x) {} } cb.input.setToque(tecla, v); b.classList.toggle('on', v); };
        b.addEventListener('pointerdown', on(true)); b.addEventListener('pointerup', on(false)); b.addEventListener('pointercancel', on(false)); b.addEventListener('pointerleave', on(false));
        b.addEventListener('contextmenu', (e) => e.preventDefault());
        return b;
      };
      const pausaB = el('button', { class: 'jg-tb jg-tb-p', on: { click: () => cb.pausar() } }, 'II');
      tactil.append(el('div', { class: 'jg-tg izq' }, boton('◀', 'a', 'izq'), boton('▶', 'a', 'der')), el('div', { class: 'jg-tg der' }, boton('▲', 'b', 'salto')), pausaB);
    }

    ui.destroy = function () { ro.disconnect(); clearTimeout(tAviso); root.remove(); };
    return ui;
  };
})();
