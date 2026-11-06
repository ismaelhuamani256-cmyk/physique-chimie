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
  const ESCUDO = ['XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '.XXXXX.', '..XXX..', '...X...'];
  const ESTRELLA = ['...X...', '...X...', 'XXXXXXX', '.XXXXX.', '..XXX..', '.XX.XX.', '.X...X.'];
  const RELOJ = ['.XXXXX.', 'X..X..X', 'X..X..X', 'X..XXXX', 'X.....X', 'X.....X', '.XXXXX.'];
  const MONEDA = ['.XXXX.', 'XXXXXX', 'XXXXXX', 'XXXXXX', 'XXXXXX', '.XXXX.'];
  const CHECK = ['......X', '.....XX', 'X...XX.', 'XX.XX..', '.XXX...', '..X....'];

  /** PixelHUD (Press Start 2P) pinta mal algunas mayúsculas con tilde: las quitamos en el HUD. */
  const sinTildes = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¡¿]/g, (c) => c);

  // ---------- entrada ----------
  J.crearInput = function (onPausa) {
    const inp = { izq: false, der: false, salto: false, accion: false, saltoEdge: false, accionEdge: false, arribaEdge: false, t: { izq: false, der: false, salto: false, acc: false }, dir: 0, destroy: null, bloqueado: false };
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
      else if (K.salto.includes(e.key)) { if (!teclas.salto) inp.saltoEdge = true; if (!e.repeat && ['ArrowUp', 'w', 'W'].includes(e.key)) inp.arribaEdge = true; teclas.salto = true; }
      else if (K.acc.includes(e.key)) { if (!e.repeat) inp.accionEdge = true; teclas.acc = true; }
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
    inp.setToque = (k, v) => { if (k === 'salto' && v && !inp.t.salto) { inp.saltoEdge = true; inp.arribaEdge = true; } if (k === 'acc' && v && !inp.t.acc) inp.accionEdge = true; inp.t[k] = v; recalcular(); };
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
    const estadosEl = el('div', { class: 'jg-estados' });
    const wrap = el('div', { class: 'jg-wrap' }, canvas, hud, estadosEl, pops, aviso);
    const tactil = el('div', { class: 'jg-touch' });
    const root = el('div', { class: 'jg-root' }, wrap, tactil, capa);
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
      for (let i = 0; i < Math.max(3, n); i++) hudVidas.append(iconoSVG(CORAZON, i < n ? '#ff4d6d' : '#3a4266', 3));
    };
    let ultItems = '';
    ui.hud = function (gg) {
      const s = Math.floor(gg.tiempo), t = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      if (hudTiempo.textContent !== t) hudTiempo.textContent = t;
      const nGemas = gg.w.items.filter((k) => !k.moneda).length;
      const it = nGemas ? gg.coleccionados + '/' + nGemas : '';
      if (it !== ultItems) { ultItems = it; hudItems.replaceChildren(...(it ? [iconoSVG(GEMA, '#19e3ff', 3), document.createTextNode(' ' + it)] : [])); }
      ui.estados(gg, false);
    };
    // insignias: escudo, estrella, reloj, monedas y respuestas ✔ c/t (se reconstruyen solo si cambian)
    let ultEst = null, ultG = null;
    ui.estados = function (gg, forzar) {
      gg = gg || ultG; if (!gg) return; ultG = gg;
      const p = gg.jugador, sig = [gg.escudo ? 1 : 0, p && p.estrella > 0 ? Math.ceil(p.estrella) : 0, gg.lento > 0 ? Math.ceil(gg.lento) : 0, gg.premios.moneda, gg.premios.pista, gg.resp.correctas, gg.resp.total, gg.modoQuiz ? 1 : 0, JSON.stringify(gg.inv || {}), JSON.stringify(gg.vars || {})].join('|');
      if (sig === ultEst && forzar !== true) return; ultEst = sig;
      const ins = (ico, col, txt) => el('span', { class: 'jg-ins' }, iconoSVG(ico, col, 3), txt != null ? document.createTextNode(' ' + txt) : null);
      estadosEl.replaceChildren(...[
        gg.escudo ? ins(ESCUDO, '#35d6ff') : null,
        p && p.estrella > 0 ? ins(ESTRELLA, '#ffe27a', Math.ceil(p.estrella)) : null,
        gg.lento > 0 ? ins(RELOJ, '#e8f0ff', Math.ceil(gg.lento)) : null,
        gg.premios.moneda > 0 ? ins(MONEDA, '#ffd166', gg.premios.moneda) : null,
        gg.premios.pista > 0 ? ins(['..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'], '#fff0a0', gg.premios.pista) : null,
        gg.modoQuiz || gg.resp.total > 0 ? ins(CHECK, '#2ee59d', gg.resp.correctas + '/' + gg.resp.total) : null,
        ...Object.keys(gg.inv || {}).filter((k) => gg.inv[k] > 0).map((k) => el('span', { class: 'jg-ins jg-atomo-chip' }, el('span', { class: 'jg-esfera', style: { background: J.Sprites.colorCPK(k) } }, k), document.createTextNode('×' + gg.inv[k]))),
        ...Object.keys(gg.vars || {}).map((k) => el('span', { class: 'jg-ins jg-var' }, el('span', { class: 'jg-punto', style: { background: J.Quim.colorValor(gg.vars[k]) } }), document.createTextNode(k + ': ' + gg.vars[k]))),
      ].filter(Boolean));
    };
    ui.pop = function (txt) { pop(el('div', { class: 'jg-pop jg-pop-s' }, txt), 1400); };
    ui.vidas(g.vidas);

    ui.jefe = function (b) {
      jefeBar.style.display = ''; jefeBar.replaceChildren();
      jefeBar.append(el('span', { class: 'jg-jefe-n' }, sinTildes(b.nombre).toUpperCase()));
      const pips = el('span', { class: 'jg-pips' });
      for (let i = 0; i < (b.vidasMax || 3); i++) pips.append(el('span', { class: 'jg-pip' + (i < b.aciertos ? ' on' : '') }));
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

    /** Modal de pregunta (CONTRATO §4b): opción múltiple (teclas 1–6 o clic) o numérica (valor + unidad, corregida por
     *  PCB.estudio.corregirNumerico). Texto y opciones admiten LaTeX en línea entre $…$; con q.latex_opciones las opciones
     *  son LaTeX puro. Tras responder muestra explicación y pasos. alResponder(ok) se llama al pulsar «Continuar». */
    ui.preguntaQ = function (q, info, alResponder) {
      const tipo = q.tipo === 'numerico' ? 'numerico' : 'opcion';
      const texto = q.enunciado != null ? q.enunciado : q.pregunta;
      let respondida = false, ok = false;
      const fb = el('div', { class: 'jg-expl', role: 'status', 'aria-live': 'polite' });
      const cont = el('button', { class: 'jg-btn jg-btn-p', style: { display: 'none' }, on: { click: () => seguir() } }, 'Continuar');
      function cerrar(esOk, mensaje) {
        respondida = true; ok = esOk;
        fb.append(el('b', { class: esOk ? 'jg-ok' : 'jg-mal' }, esOk ? '✔ ¡Correcto! ' : '✖ Incorrecto. '));
        if (mensaje) fb.append(document.createTextNode(mensaje + ' '));
        if (!esOk && tipo === 'numerico') fb.append(el('div', { class: 'jg-sol' }, 'Respuesta: ' + String(q.valor).replace('.', ',') + (q.unidad ? ' ' + q.unidad : '')));
        if (q.explicacion) textoConTex(q.explicacion, fb);
        if (Array.isArray(q.pasos) && q.pasos.length) { const ol = el('ol', { class: 'jg-pasos' }); q.pasos.forEach((p) => ol.append(textoConTex(p, el('li', {})))); fb.append(ol); }
        if (q.pagina_pdf) fb.append(el('span', { class: 'jg-pag' }, '  (p. ' + q.pagina_pdf + ')'));
        cont.style.display = ''; cont.focus();
        J.Audio.sfx(esOk ? 'acierto' : 'fallo');
      }
      function seguir() { if (!respondida) return; ui.cerrarModal(); alResponder(ok); }
      let cuerpo, atajo;
      if (tipo === 'opcion') {
        const opts = el('div', { class: 'jg-opts', role: 'group', 'aria-label': 'Opciones' });
        const botones = (q.opciones || []).map((o, i) => {
          const txt = el('span', { class: 'jg-ot' });
          if (q.latex_opciones) tex(o, txt); else textoConTex(o, txt);
          const b = el('button', { class: 'jg-opt', on: { click: () => elegir(i) } }, el('span', { class: 'jg-k' }, String(i + 1)), txt);
          opts.append(b); return b;
        });
        const elegir = (i) => {
          if (respondida) return;
          botones.forEach((b, k) => { b.disabled = true; if (k === q.correcta) b.classList.add('ok'); else if (k === i) b.classList.add('mal'); });
          cerrar(i === q.correcta);
        };
        cuerpo = opts;
        atajo = (e) => { if (/^[1-6]$/.test(e.key) && !respondida && +e.key <= botones.length) { elegir(+e.key - 1); return true; } return false; };
        setTimeout(() => { if (botones[0] && !respondida) botones[0].focus(); }, 60);
      } else {
        const vi = el('input', { class: 'jg-in', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: 'valor', 'aria-label': 'Valor numérico' });
        const ui2 = el('input', { class: 'jg-in jg-in-u', type: 'text', autocomplete: 'off', autocapitalize: 'off', placeholder: q.unidad ? 'unidad' : 'unidad (opcional)', 'aria-label': 'Unidad' });
        const comprobar = () => {
          if (respondida) return;
          if (!vi.value.trim()) { vi.focus(); return; }
          const E = window.PCB.estudio;
          let r;
          if (E && E.corregirNumerico) { try { r = E.corregirNumerico({ valor: vi.value, unidad: ui2.value }, { valor: q.valor, unidad: q.unidad || '', tolerancia_rel: q.tolerancia_rel, cifras_sig: q.cifras_sig }); } catch (x) { r = null; } }
          if (!r) { const v = parseFloat(String(vi.value).replace(',', '.')); r = { ok: isFinite(v) && Math.abs(v - q.valor) <= Math.abs(q.valor) * (q.tolerancia_rel || 0.02), mensaje: '' }; }
          vi.disabled = ui2.disabled = true; bt.disabled = true;
          cerrar(!!r.ok, r.mensaje);
        };
        const bt = el('button', { class: 'jg-btn jg-btn-p', on: { click: comprobar } }, 'Comprobar');
        [vi, ui2].forEach((n) => n.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); comprobar(); } }));
        cuerpo = el('div', { class: 'jg-num' }, vi, ui2, bt);
        atajo = () => false;
        setTimeout(() => vi.focus(), 60);
      }
      const titulo = info.titulo + (info.n ? ` · Pregunta ${info.n} de ${info.total || 3}` : '');
      const card = el('div', { class: 'jg-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
        el('div', { class: 'jg-card-h' }, titulo),
        textoConTex(texto || '', el('div', { class: 'jg-q' })), cuerpo, fb, cont);
      modal(card, (e) => {
        if (atajo(e)) return true;
        if ((e.key === 'Enter' || e.key === ' ') && respondida) { seguir(); return true; }
        return true;   // bloquea el resto de teclas mientras hay pregunta
      });
    };
    ui.pregunta = (q, info, cb2) => ui.preguntaQ(q, { titulo: info.jefe, n: info.n, total: info.total || 3 }, cb2);

    // --- cartel tutorial dentro del nivel ---
    const cartelEl = el('div', { class: 'jg-cartel', style: { display: 'none' } });
    wrap.append(cartelEl);
    ui.cartel = function (texto) { if (!texto) { cartelEl.style.display = 'none'; return; } cartelEl.replaceChildren(el('span', { class: 'jg-cartel-i' }, 'i'), textoConTex(texto, el('span', {}))); cartelEl.style.display = ''; };

    /** Fórmula química en HTML: subíndices y carga en superíndice ("H3O+" -> H₃O⁺). */
    function formulaHTML(f) {
      const txt = J.Quim.bonita(f);   // ya con ₂ y ⁺
      return el('span', { class: 'jg-formula' }, txt);
    }

    /** Modal de coeficientes: el código comprueba conservación de átomos y de carga. cb(true) al resolverla. */
    ui.ecuacion = function (eq0, ayuda, cb2) {
      const Qm = J.Quimica, eq = Qm.normalizar(eq0), nR = eq.reactivos.length, n = nR + eq.productos.length;
      const coef = Array(n).fill(1), nodos = [];
      const panel = el('div', { class: 'jg-balance' }), msg = el('div', { class: 'jg-expl jg-msgeq' }), cont = el('button', { class: 'jg-btn jg-btn-p', style: { display: 'none' }, on: { click: () => fin(true) } }, 'Continuar');
      let resuelta = false;
      function fin(ok) { ui.cerrarModal(); cb2(ok); }
      function pintar() {
        nodos.forEach((nd, i) => { nd.textContent = coef[i]; });
        const v = Qm.verificar(eq, coef);
        panel.replaceChildren(el('div', { class: 'jg-bal-fila jg-bal-h' }, el('span', {}, ''), el('span', {}, 'Reactivos'), el('span', {}, 'Productos'), el('span', {}, '')));
        Object.keys(v.atomos).forEach((e) => { const [a, b] = v.atomos[e]; panel.append(el('div', { class: 'jg-bal-fila ' + (a === b ? 'ok' : 'mal') }, el('span', {}, e), el('span', {}, String(a)), el('span', {}, String(b)), el('span', {}, a === b ? '✔' : '✖'))); });
        panel.append(el('div', { class: 'jg-bal-fila ' + (v.carga[0] === v.carga[1] ? 'ok' : 'mal') }, el('span', {}, 'carga'), el('span', {}, (v.carga[0] > 0 ? '+' : '') + v.carga[0]), el('span', {}, (v.carga[1] > 0 ? '+' : '') + v.carga[1]), el('span', {}, v.carga[0] === v.carga[1] ? '✔' : '✖')));
        return v;
      }
      function comprobar() {
        if (resuelta) return;
        const v = pintar();
        if (v.ok && v.simplificada) { resuelta = true; msg.replaceChildren(el('b', { class: 'jg-ok' }, '✔ ¡Equilibrada! '), document.createTextNode('Se conservan los átomos de cada elemento y la carga eléctrica.')); cont.style.display = ''; cont.focus(); J.Audio.sfx('acierto'); }
        else if (v.ok) { msg.replaceChildren(el('b', { class: 'jg-mal' }, 'Casi: '), document.createTextNode('está equilibrada, pero se pueden dividir todos los coeficientes (usa los más pequeños).')); J.Audio.sfx('aviso'); }
        else { const mal = Object.keys(v.atomos).filter((e) => v.atomos[e][0] !== v.atomos[e][1]); msg.replaceChildren(el('b', { class: 'jg-mal' }, '✖ No se conserva '), document.createTextNode(mal.length ? 'el número de átomos de ' + mal.join(', ') + (v.carga[0] !== v.carga[1] ? ' ni la carga.' : '.') : 'la carga eléctrica.')); J.Audio.sfx('fallo'); }
      }
      const fila = el('div', { class: 'jg-eq' });
      const celda = (f, i) => {
        const num = el('span', { class: 'jg-coef' }, '1'); nodos[i] = num;
        const paso = (d) => () => { if (resuelta) return; coef[i] = J.clamp(coef[i] + d, 1, 9); pintar(); msg.replaceChildren(); J.Audio.sfx('menu'); };
        return el('span', { class: 'jg-esp' }, el('span', { class: 'jg-step' }, el('button', { class: 'jg-mini', 'aria-label': 'menos', on: { click: paso(-1) } }, '−'), num, el('button', { class: 'jg-mini', 'aria-label': 'más', on: { click: paso(1) } }, '+')), formulaHTML(f));
      };
      eq.reactivos.forEach((f, i) => { if (i) fila.append(el('span', { class: 'jg-op' }, '+')); fila.append(celda(f, i)); });
      fila.append(el('span', { class: 'jg-op jg-flecha' }, '→'));
      eq.productos.forEach((f, k) => { if (k) fila.append(el('span', { class: 'jg-op' }, '+')); fila.append(celda(f, nR + k)); });
      const card = el('div', { class: 'jg-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ajusta la ecuación' },
        el('div', { class: 'jg-card-h' }, 'Puerta de ecuación · ajusta los coeficientes'),
        el('div', { class: 'jg-q' }, 'Equilibra la ecuación: debe conservarse cada elemento y la carga.'), fila, panel,
        ayuda ? el('div', { class: 'jg-ayudaeq' }, '💡 ' + ayuda) : null, msg,
        el('div', { class: 'jg-botones' }, el('button', { class: 'jg-btn jg-btn-p', on: { click: comprobar } }, 'Comprobar'), el('button', { class: 'jg-btn', on: { click: () => fin(false) } }, 'Cerrar'), cont));
      pintar();
      modal(card, (e) => { if (e.key === 'Escape') { fin(false); return true; } if (e.key === 'Enter') { if (resuelta) fin(true); else comprobar(); return true; } return false; });
    };

    /** Estación de moléculas: usa PCB.mol3d.constructor si existe; si no, un puzle propio (átomo central + geometría). */
    ui.constructor = function (e, atomos, alResolver, alCerrar) {
      const M = window.PCB.mol3d, host = el('div', { class: 'jg-mol3d' });
      let inst = null, hecho = false;
      const msg = el('div', { class: 'jg-expl' }), cont = el('button', { class: 'jg-btn jg-btn-p', style: { display: 'none' }, on: { click: () => terminar(true) } }, 'Continuar');
      function terminar(ok) { try { if (inst && inst.dispose) inst.dispose(); } catch (x) {} ui.cerrarModal(); if (ok) alResolver(); alCerrar(); }
      function exito() { if (hecho) return; hecho = true; msg.replaceChildren(el('b', { class: 'jg-ok' }, '✔ ¡Molécula montada! '), document.createTextNode(e.molecula + ': geometría ' + (J.Quimica.GEOMETRIA[e.molecula] || 'según VSEPR') + '.')); cont.style.display = ''; cont.focus(); J.Audio.sfx('acierto'); }
      const card = el('div', { class: 'jg-card jg-card-mol', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Estación de moléculas' },
        el('div', { class: 'jg-card-h' }, 'Estación de moléculas · ' + J.Quim.bonita(e.molecula)),
        el('div', { class: 'jg-q' }, 'Monta la molécula con los átomos recogidos (' + atomos.join(' ') + ').'), host, msg,
        el('div', { class: 'jg-botones' }, cont, el('button', { class: 'jg-btn', on: { click: () => terminar(false) } }, 'Cerrar')));
      modal(card, (ev) => { if (ev.key === 'Escape') { terminar(false); return true; } if (ev.key === 'Enter' && hecho) { terminar(true); return true; } return false; });
      const tiene = M && Object.prototype.hasOwnProperty.call(M, 'constructor') && typeof M.constructor === 'function' && M.constructor !== Object;
      if (tiene) {
        try { inst = M.constructor(host, { molecula: e.molecula, atomos, onResuelto: exito, onCerrar: () => terminar(false) }); return; }
        catch (err) { console.warn('[juego] PCB.mol3d.constructor falló; uso el puzle propio.', err); host.replaceChildren(); }
      }
      fallbackConstructor(host, e, atomos, exito);
    };

    /** Puzle propio mínimo: 1) átomo central, 2) geometría VSEPR; dibuja el resultado. */
    function fallbackConstructor(host, e, atomos, exito) {
      const els = [...new Set(atomos)], pf = J.Quimica.parsear(e.molecula), geo = J.Quimica.GEOMETRIA[e.molecula] || 'lineal';
      const centro = els.filter((k) => k !== 'H').sort((a, b) => (pf.atomos[a] - pf.atomos[b]) || (a < b ? -1 : 1))[0] || els[0];
      const cv = el('canvas', { width: 220, height: 130, class: 'jg-mol-cv' }), ctx = cv.getContext('2d');
      const dibujar = (conCentro, conGeo) => {
        ctx.clearRect(0, 0, 220, 130); ctx.fillStyle = '#0a1030'; ctx.fillRect(0, 0, 220, 130);
        const lig = atomos.filter((a, i) => !(a === centro && i === atomos.indexOf(centro)));
        const esfera = (x, y, el2, r) => { ctx.fillStyle = '#0b1230'; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.fill(); ctx.fillStyle = J.Sprites.colorCPK(el2); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.fillStyle = '#0b1230'; ctx.font = 'bold 12px UI, sans-serif'; ctx.fillText(el2, x - 4 * el2.length, y + 4); };
        if (!conCentro) { atomos.forEach((a, i) => esfera(30 + i * 36, 65, a, 13)); return; }
        const cx = 110, cy = 65, n = lig.length;
        const ang = !conGeo ? lig.map((_, i) => (i / n) * Math.PI * 2) : geo === 'lineal' || n === 1 ? lig.map((_, i) => i * Math.PI) : geo === 'angular' ? [Math.PI / 2 + 0.9, Math.PI / 2 - 0.9] : geo.indexOf('pirámide') === 0 ? lig.map((_, i) => Math.PI / 2 + (i - (n - 1) / 2) * 1.5) : lig.map((_, i) => (i / n) * Math.PI * 2 + 0.4);
        lig.forEach((a, i) => { const x = cx + Math.cos(ang[i]) * 52, y = cy + Math.sin(ang[i]) * 40; ctx.strokeStyle = '#cfd8f0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); esfera(x, y, a, 10); });
        esfera(cx, cy, centro, 15);
      };
      dibujar(false, false);
      const fase = el('div', { class: 'jg-mol-fase' }, '1) ¿Qué átomo va en el centro?');
      const opts = el('div', { class: 'jg-mol-op' });
      host.append(cv, fase, opts);
      function paso2() {
        dibujar(true, false); fase.textContent = '2) ¿Qué geometría (VSEPR) tiene ' + J.Quim.bonita(e.molecula) + '?'; opts.replaceChildren();
        const gs = [...new Set(['lineal', 'angular', 'pirámide trigonal', 'tetraédrica', geo])].slice(0, 4);
        gs.sort(); gs.forEach((g2) => opts.append(el('button', { class: 'jg-btn', on: { click: (ev) => { if (g2 === geo || geo.indexOf(g2) === 0) { dibujar(true, true); fase.textContent = '✔ ' + geo; opts.replaceChildren(); exito(); } else { ev.target.disabled = true; ev.target.classList.add('jg-mal'); J.Audio.sfx('fallo'); } } } }, g2)));
      }
      if (els.length === 1 || atomos.length < 3) { dibujar(true, false); fase.textContent = 'Molécula diatómica: lineal.'; exito(); return; }
      els.forEach((k) => opts.append(el('button', { class: 'jg-btn jg-esferab', style: { background: J.Sprites.colorCPK(k), color: '#0b1230' }, on: { click: (ev) => { if (k === centro) paso2(); else { ev.target.disabled = true; J.Audio.sfx('fallo'); msg2.textContent = 'Pista: el átomo central es el que se une a los demás (en el cours: dobletes liants/no liantes: H 1/0, C 4/0, N 3/1, O 2/2).'; } } } }, k)));
      const msg2 = el('div', { class: 'jg-pag' }); host.append(msg2);
    }

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
          res.total ? el('div', {}, 'Fórmulas: ' + res.coleccionados + ' / ' + res.total) : null,
          res.respuestas && res.respuestas.total ? el('div', {}, 'Respuestas correctas: ' + res.respuestas.correctas + ' / ' + res.respuestas.total) : null,
          res.premios && res.premios.moneda ? el('div', {}, 'Monedas: ' + res.premios.moneda) : null,
          el('div', {}, 'Vidas: ' + res.vidasRestantes),
          res.jefeDerrotado ? el('div', {}, 'Jefe derrotado') : null,
          res.modoQuiz ? null : el('div', { class: 'jg-xp' }, res.gano ? '+' + xp + ' XP' : 'Sin XP esta vez')),
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
      tactil.append(el('div', { class: 'jg-tg izq' }, boton('◀', 'a', 'izq'), boton('▶', 'a', 'der')), el('div', { class: 'jg-tg der' }, boton('⬇', 'c', 'acc'), boton('▲', 'b', 'salto')), pausaB);
    }

    ui.destroy = function () { ro.disconnect(); clearTimeout(tAviso); root.remove(); };
    return ui;
  };
})();
