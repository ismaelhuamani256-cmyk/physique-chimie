// =====================================================================================
// 50-constructor.js — MOL3D · puzzle «construye la molécula en 3D»
//
//  PCB.mol3d.constructor(host, {molecula, atomos, onResuelto, onCerrar, ayuda, clave, titulo})  -> {dispose, reiniciar, estado}
//     molecula   id de la biblioteca ('H2O') u objeto molécula 3D
//     atomos     átomos disponibles: {H:2, O:1} ó ['H','H','O'] (los que recogió el alumno en el juego).
//                Si se omite, hay los justos (los de la molécula). Pueden sobrar átomos «señuelo».
//     onResuelto(info)  se llama UNA vez al completar bien: info={id, formula, usados:{H:2,O:1}, errores, ayuda}
//                La ventana sigue abierta mostrando la molécula girando con su nombre y su geometría VSEPR.
//     onCerrar() se llama al pulsar ✕ / Cerrar (el estado queda guardado: al reabrir la misma molécula con la
//                misma `clave` se recupera lo colocado, sin perder el progreso del nivel).
//  Cómo se juega: se ve el esqueleto de la molécula con SITIOS VACÍOS (esferas tenues numeradas, del tamaño del átomo
//  esperado). Se elige un átomo de la bandeja (clic o teclado) y se pulsa un sitio, o se ARRASTRA la ficha hasta él.
//  Acierto: el átomo «aparece» con su enlace y sonido; fallo: la ficha tiembla y un mensaje explica por qué
//  (valencia / tamaño). 💡 Ayuda muestra el símbolo esperado en cada sitio. Accesible: los sitios y fichas son botones.
// =====================================================================================
(function () {
  'use strict';
  const PCB = (window.PCB = window.PCB || {});
  const M = (PCB.mol3d = PCB.mol3d || {});
  const T = window.THREE;
  const D = M.datos;
  const el = (tag, attrs, ...kids) => PCB.util.el(tag, attrs, ...kids);
  const reducido = () => { try { return PCB.util.reducedMotion(); } catch (e) { return false; } };
  const sfx = (n) => { try { const A = PCB.juego && PCB.juego.Audio; if (A && A.sfx) A.sfx(n); } catch (e) {} };
  const estados = (M._puzzle = M._puzzle || {}); // progreso recordado por clave

  /** Normaliza los átomos disponibles a {El: n} */
  function contar(a) {
    const c = {};
    if (Array.isArray(a)) a.forEach((s) => { c[s] = (c[s] || 0) + 1; });
    else if (a && typeof a === 'object') Object.keys(a).forEach((s) => { if (a[s] > 0) c[s] = a[s]; });
    return c;
  }
  const bolaCSS = (s) => { const c = D.el(s).color; return { background: 'radial-gradient(circle at 32% 30%, #fff9, ' + c + ' 55%, #0007 140%)', backgroundColor: c, color: ['H', 'F', 'Cl', 'S', 'Si', 'B', 'Mg', 'Ca'].includes(s) ? '#10162b' : '#fff' }; };

  function constructor(host, opts) {
    opts = opts || {};
    const mol = typeof opts.molecula === 'object' && opts.molecula ? opts.molecula : M.molecula(opts.molecula || opts.id);
    host.classList.add('m3d-con-host');
    host.replaceChildren();
    if (!mol) { host.append(el('p', { class: 'm3d-con-hint' }, 'Molécula desconocida: ' + (opts.molecula || '?'))); return { dispose() { host.replaceChildren(); }, reiniciar() {}, estado: () => ({}) }; }

    const n = mol.atomos.length;
    const necesarios = contar(mol.atomos.map((a) => a.el));
    const disponibles = opts.atomos == null ? Object.assign({}, necesarios) : contar(opts.atomos);
    const clave = opts.clave || mol.id;
    // estado guardado (colocados[i] = símbolo o null)
    let st = estados[clave];
    if (!st || st.mol !== mol.id) st = estados[clave] = { mol: mol.id, colocados: new Array(n).fill(null), errores: 0, ayuda: false, resuelto: false, avisado: false };
    const stock = Object.assign({}, disponibles);
    st.colocados.forEach((s) => { if (s) stock[s] = (stock[s] || 0) - 1; });
    let seleccion = null, ayuda = !!st.ayuda, muerto = false, completoMostrado = false;

    // ---------- DOM ----------
    const prog = el('div', { class: 'm3d-con-prog', role: 'img', 'aria-label': '' });
    const btnAyuda = el('button', { type: 'button', class: 'm3d-btn', 'aria-pressed': String(ayuda), title: 'Muestra qué átomo va en cada sitio', on: { click: () => setAyuda(!ayuda) } }, '💡 Ayuda');
    const btnCerrar = opts.onCerrar ? el('button', { type: 'button', class: 'm3d-btn', 'aria-label': 'Cerrar el constructor', on: { click: () => cerrar() } }, '✕') : null;
    const cab = el('div', { class: 'm3d-con-cab' },
      el('div', { class: 'm3d-con-tit' }, opts.titulo || 'Construye ', el('span', {}, mol.formula), el('small', {}, mol.nombre)), prog, btnAyuda, btnCerrar);
    const escHost = el('div', { class: 'm3d-con-esc' });
    const msg = el('div', { class: 'm3d-con-msg', role: 'status', 'aria-live': 'polite', style: { display: 'none' } });
    const listo = el('div', { class: 'm3d-con-listo m3d-info-wrap', style: { display: 'none' } });
    escHost.append(msg, listo);
    const fichasHost = el('div', { class: 'm3d-fichas', role: 'group', 'aria-label': 'Átomos disponibles' });
    const sitiosHost = el('ul', { class: 'm3d-sitios' });
    const pista = el('p', { class: 'm3d-con-hint' }, 'Elige un átomo y pulsa un sitio vacío (o arrástralo hasta él). El número de enlaces de cada sitio te dice qué átomo cabe.');
    const lado = el('div', { class: 'm3d-con-lado' }, el('h3', {}, 'Tus átomos'), fichasHost, el('h3', {}, 'Sitios de la molécula'), sitiosHost, pista);
    const raiz = el('div', { class: 'm3d-con' }, cab, el('div', { class: 'm3d-con-cuerpo' }, escHost, lado));
    host.append(raiz);
    // layout según el ancho real del host (no del navegador): en ventanas estrechas la bandeja pasa debajo de la escena
    const medirAncho = () => raiz.classList.toggle('estrecho', (host.clientWidth || raiz.clientWidth) < 600);
    medirAncho();
    const roAncho = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medirAncho) : null;
    if (roAncho) roAncho.observe(host);

    // ---------- escena 3D ----------
    const N = M.nucleo;
    let esc = null, modelo = null;
    const sitios = []; // {i, ghost, wire, hit, num, lab, lista}
    const lisBtn = [];
    if (T && N) esc = N.crearEscena(escHost, { rotar: false, sobreClic: (ev) => clicEscena(ev) });
    if (!esc) escHost.append(el('p', { class: 'm3d-con-hint', style: { padding: '16px' } }, 'Tu navegador no puede mostrar 3D: usa la lista de sitios para colocar los átomos. ' + M.describir(mol)));
    const camvec = T ? new T.Vector3() : null;
    if (esc) {
      esc.lienzo.setAttribute('role', 'application');
      esc.lienzo.setAttribute('aria-label', 'Escena 3D del constructor de ' + mol.formulaAscii + '. Usa la lista de sitios y la bandeja de átomos para jugar con teclado.');
      const posiciones = mol.atomos.map((a) => new T.Vector3(a.x, a.y, a.z));
      modelo = N.crearModelo(esc, mol.atomos, mol.enlaces, { estilo: 'bolas', etiquetas: true, desvanecible: true });
      modelo.atomos.forEach((a) => { a.visible = false; a.escala = 0; });
      modelo.enlaces.forEach((b) => { b.visible = false; b.grosor = 0; });
      modelo.actualizar();
      // esqueleto fantasma: esferas tenues (tamaño del átomo esperado) + varillas finas
      const gE = new T.SphereGeometry(1, 22, 16), gW = new T.SphereGeometry(1, 12, 8), gC = new T.CylinderGeometry(1, 1, 1, 8, 1, true);
      esc.recursos.push(gE, gW, gC);
      const mCil = new T.MeshBasicMaterial({ color: 0x9fb4ff, transparent: true, opacity: 0.28, depthWrite: false }); esc.recursos.push(mCil);
      const up = new T.Vector3(0, 1, 0);
      mol.enlaces.forEach((b) => {
        const A = posiciones[b.a], B = posiciones[b.b], d = B.clone().sub(A), L = d.length();
        const m = new T.Mesh(gC, mCil); m.position.copy(A).add(B).multiplyScalar(0.5); m.scale.set(0.035, L, 0.035); m.quaternion.setFromUnitVectors(up, d.normalize());
        esc.grupo.add(m);
      });
      mol.atomos.forEach((a, i) => {
        const r = N.radioAtomo(a.el, 'bolas');
        const mg = new T.MeshBasicMaterial({ color: 0xbfd0ff, transparent: true, opacity: 0.1, depthWrite: false });
        const mw = new T.MeshBasicMaterial({ color: 0x9fb4ff, transparent: true, opacity: 0.45, wireframe: true, depthWrite: false });
        esc.recursos.push(mg, mw);
        const g = new T.Mesh(gE, mg), w = new T.Mesh(gW, mw);
        g.position.copy(posiciones[i]); w.position.copy(posiciones[i]); g.scale.setScalar(r * 0.95); w.scale.setScalar(r * 1.02);
        esc.grupo.add(g, w);
        const num = numeroSprite(i + 1), lab = etiquetaSprite(a.el);
        esc.scene.add(num, lab);
        sitios.push({ i, ghost: g, wire: w, mg, mw, num, lab, r, pos: posiciones[i], flash: 0, flashColor: 0 });
      });
      esc.onRender.push((camera) => {
        esc.grupo.updateMatrixWorld();
        sitios.forEach((s) => {
          const lleno = !!st.colocados[s.i];
          s.num.visible = !lleno && !st.resuelto; s.lab.visible = !lleno && ayuda && !st.resuelto;
          s.ghost.visible = s.wire.visible = !lleno && !st.resuelto;
          if (lleno || st.resuelto) return;
          s.ghost.getWorldPosition(camvec);
          const dir = camera.position.clone().sub(camvec).normalize();
          const p = camvec.clone().addScaledVector(dir, s.r * 1.05);
          s.num.position.copy(p); s.lab.position.copy(p);
          const k = Math.max(0.34, s.r * 0.95); s.num.scale.set(k * 0.8, k * 0.8, 1); s.lab.scale.set(k * 1.5, k * 1.5, 1);
        });
      });
      esc.orientacion = N.orientacionPCA(posiciones);
      esc.ajustarA(modelo.radio()); esc.resetVista();
      animarGhosts();
    }
    function numeroSprite(k) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      g.font = '700 38px system-ui,Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 7; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(8,12,30,.9)'; g.strokeText(String(k), 32, 34); g.fillStyle = '#dfe8ff'; g.fillText(String(k), 32, 34);
      const tx = new T.CanvasTexture(c); esc.recursos.push(tx);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthWrite: false })); esc.recursos.push(sp.material); return sp;
    }
    function etiquetaSprite(sim) {
      const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
      g.font = '800 54px system-ui,Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 9; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(8,12,30,.9)'; g.strokeText(sim, 48, 50); g.fillStyle = D.el(sim).color === '#ffffff' ? '#ffffff' : D.el(sim).color; g.fillText(sim, 48, 50);
      const tx = new T.CanvasTexture(c); esc.recursos.push(tx);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, opacity: 0.95 })); esc.recursos.push(sp.material); return sp;
    }
    /** Pulso de los sitios vacíos cuando hay una ficha elegida y destello de acierto/fallo */
    function animarGhosts() {
      if (!esc) return;
      let t0 = null;
      esc.agregarHook((dt, t) => {
        if (muerto || st.resuelto && !sitios.some((s) => s.flash > 0)) return false;
        if (t0 == null) t0 = t;
        const pulso = seleccion && !reducido() ? 0.5 + 0.5 * Math.sin((t - t0) / 170) : seleccion ? 1 : 0;
        let sigue = !!seleccion;
        sitios.forEach((s) => {
          if (s.flash > 0) { s.flash = Math.max(0, s.flash - dt * 2.2); sigue = true; }
          const base = 0.35 + 0.45 * pulso;
          s.mw.opacity = s.flash > 0 ? 0.5 + 0.5 * s.flash : base; s.mg.opacity = s.flash > 0 ? 0.1 + 0.3 * s.flash : 0.08 + 0.1 * pulso;
          s.mw.color.setHex(s.flash > 0 ? s.flashColor : seleccion ? 0x6bffc0 : 0x9fb4ff);
        });
        return sigue || (!st.resuelto && false);
      });
    }
    function reanimar() { if (esc) { animarGhosts(); esc.pedirRender(); } }

    // ---------- bandeja, sitios, progreso ----------
    const fichas = {};
    function pintarFichas() {
      fichasHost.replaceChildren();
      const els = Object.keys(Object.assign({}, disponibles, necesarios)).sort(D.ordenHill);
      els.forEach((s) => {
        const k = Math.max(0, stock[s] || 0);
        const b = el('button', { type: 'button', class: 'm3d-ficha', 'data-el': s, 'aria-pressed': String(seleccion === s), disabled: k === 0 || null, title: D.nombreEl(s) + ' · quedan ' + k,
          'aria-label': 'Átomo de ' + D.nombreEl(s) + ', quedan ' + k + (seleccion === s ? ', seleccionado' : '') },
          el('span', { class: 'bola', style: bolaCSS(s) }, s), el('span', { class: 'cuenta' }, '× ' + k));
        b.addEventListener('pointerdown', (ev) => empezarArrastre(ev, s, b));
        b.addEventListener('click', (ev) => { if (b._arrastrado) { b._arrastrado = false; return; } elegir(seleccion === s ? null : s); });
        fichas[s] = b; fichasHost.append(b);
      });
    }
    function pintarSitios() {
      sitiosHost.replaceChildren(); lisBtn.length = 0;
      mol.atomos.forEach((a, i) => {
        const ocupado = st.colocados[i], grado = mol.enlaces.reduce((s, b) => s + (b.a === i || b.b === i ? (b.orden || 1) : 0), 0);
        const vec = mol.enlaces.filter((b) => b.a === i || b.b === i).map((b) => (b.a === i ? b.b : b.a) + 1);
        const txt = ocupado ? ('Sitio ' + (i + 1) + ': ' + D.nombreEl(ocupado)) : ('Sitio ' + (i + 1) + ' · ' + (Math.round(grado) === 1 ? '1 enlace' : Math.round(grado * 10) / 10 + ' enlaces') + (vec.length ? ' (con ' + vec.join(', ') + ')' : ''));
        const b = el('button', { type: 'button', class: 'm3d-sitio' + (ocupado ? ' lleno' : ''), disabled: ocupado ? true : null, 'aria-label': txt, on: { click: () => intentar(i) } },
          el('span', { class: 'pt', style: ocupado ? bolaCSS(ocupado) : {} }), el('span', {}, ocupado ? (i + 1) + ' · ' + ocupado : txt.replace('Sitio ', '')));
        lisBtn.push(b); sitiosHost.append(el('li', {}, b));
      });
    }
    function pintarProgreso() {
      const hechos = st.colocados.filter(Boolean).length;
      prog.replaceChildren(...mol.atomos.map((a, i) => el('i', { class: st.colocados[i] ? 'on' : '' })));
      prog.setAttribute('aria-label', hechos + ' de ' + n + ' átomos colocados');
    }
    function elegir(s) {
      seleccion = s;
      Object.keys(fichas).forEach((k) => { fichas[k].setAttribute('aria-pressed', String(k === s)); });
      if (s) mostrar('Ahora pulsa el sitio donde va el ' + D.nombreEl(s) + ' (' + s + ').', '', 2600);
      reanimar();
    }

    // ---------- mensajes ----------
    let tMsg = 0;
    function mostrar(txt, clase, ms) {
      msg.textContent = txt; msg.className = 'm3d-con-msg ' + (clase || ''); msg.style.display = '';
      clearTimeout(tMsg); if (ms !== 0) tMsg = setTimeout(() => { if (!muerto && !st.resuelto) msg.style.display = 'none'; }, ms || 3600);
    }

    // ---------- lógica del puzle ----------
    function motivoFallo(i, s) {
      const esp = mol.atomos[i], E = D.el(s);
      const grado = Math.round(mol.enlaces.reduce((x, b) => x + (b.a === i || b.b === i ? (b.orden || 1) : 0), 0));
      const maxV = Math.max(...E.valencias), minV = Math.min(...E.valencias);
      const enl = (k) => k + (k === 1 ? ' enlace' : ' enlaces');
      if (maxV < grado) return 'El ' + D.nombreEl(s) + ' (' + s + ') solo forma ' + enl(maxV) + ' y este sitio tiene ' + enl(grado) + '. Prueba con un átomo que forme más enlaces.';
      if (minV > grado) return 'Este sitio solo tiene ' + enl(grado) + ' y el ' + D.nombreEl(s) + ' forma ' + enl(minV) + '. Prueba con un átomo que forme menos enlaces.';
      if (E.valencias.includes(grado) && s !== esp.el) {
        const mayor = D.el(esp.el).rv > E.rv;
        return 'Con ' + enl(grado) + ' cabrían varios átomos, pero la esfera de este sitio es más ' + (mayor ? 'grande' : 'pequeña') + ' que la del ' + D.nombreEl(s) + '. Fíjate en el tamaño (o pulsa 💡 Ayuda).';
      }
      return 'Ahí no va el ' + D.nombreEl(s) + '. Cuenta los enlaces del sitio y mira el tamaño de la esfera.';
    }
    function intentar(i, s) {
      s = s || seleccion;
      if (muerto || st.resuelto) return false;
      if (st.colocados[i]) { mostrar('Ese sitio ya está ocupado.', 'mal'); return false; }
      if (!s) { mostrar('Primero elige un átomo de la bandeja.', '', 2200); return false; }
      if ((stock[s] || 0) <= 0) { mostrar('Ya no te quedan átomos de ' + D.nombreEl(s) + '.', 'mal'); sacudir(s); return false; }
      if (mol.atomos[i].el === s) {
        st.colocados[i] = s; stock[s]--;
        colocarVisual(i, true);
        sfx('atomo');
        const hechos = st.colocados.filter(Boolean).length;
        if (hechos < n) mostrar('✔ ' + s + ' en su sitio (' + hechos + '/' + n + ')', 'ok', 1800);
        pintarFichas(); pintarSitios(); pintarProgreso();
        if (stock[s] <= 0 && seleccion === s) seleccion = null;
        if (hechos === n) completar();
        reanimar();
        return true;
      }
      st.errores++; sacudir(s); sfx('fallo');
      sitios[i] && (sitios[i].flash = 1, sitios[i].flashColor = 0xff4d6d);
      mostrar('✖ ' + motivoFallo(i, s), 'mal', 6000);
      if (st.errores >= 3 && !ayuda) btnAyuda.animate && btnAyuda.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 700, iterations: 3 });
      reanimar();
      return false;
    }
    function sacudir(s) { const b = fichas[s]; if (b) { b.classList.remove('sacude'); void b.offsetWidth; b.classList.add('sacude'); } }
    /** Muestra el átomo i en el modelo con una animación de «pop» y hace crecer sus enlaces */
    function colocarVisual(i, animar) {
      if (!modelo) return;
      const a = modelo.atomos[i]; a.visible = true;
      const sitio = sitios[i]; if (sitio && animar) { sitio.flash = 1; sitio.flashColor = 0x6bffc0; }
      const dur = reducido() || !animar ? 0.0001 : 0.45; let t = 0;
      const enl = modelo.enlaces.filter((b) => (b.a === i || b.b === i) && modelo.atomos[b.a].visible && modelo.atomos[b.b].visible);
      enl.forEach((b) => { b.visible = true; });
      esc.agregarHook((dt) => {
        t += dt; const k = Math.min(1, t / dur), e = k >= 1 ? 1 : 1 + 2.4 * Math.pow(k - 1, 3) + 1.6 * Math.pow(k - 1, 2); // easeOutBack
        a.escala = e; enl.forEach((b) => { b.grosor = Math.min(1, k * 1.4); });
        modelo.actualizar(); return k < 1;
      });
    }
    function completar() {
      if (st.resuelto) return;
      st.resuelto = true; completoMostrado = true;
      sfx('estacion');
      mostrarCompleto();
      if (!st.avisado) {
        st.avisado = true;
        const usados = contar(st.colocados);
        try { opts.onResuelto && opts.onResuelto({ id: mol.id, formula: mol.formula, usados, errores: st.errores, ayuda: !!st.ayuda }); } catch (e) { console.error(e); }
      }
    }
    function mostrarCompleto() {
      seleccion = null;
      if (esc) { modelo.atomos.forEach((a) => { a.visible = true; a.escala = 1; }); modelo.enlaces.forEach((b) => { b.visible = true; b.grosor = 1; }); modelo.actualizar(); esc.setRotar(!reducido()); esc.resetVista(); esc.pedirRender(); }
      mostrar('🎉 ¡Molécula completa! Es ' + mol.nombre + ' (' + mol.formula + ').', 'ok', 0);
      listo.style.display = '';
      listo.replaceChildren(N.panelInfo(mol));
      lado.replaceChildren(el('h3', {}, 'Resultado'), el('p', { class: 'm3d-con-hint' }, 'Arrastra para girarla, rueda o pellizco para el zoom. Así se ordenan los átomos según la teoría VSEPR: ' + mol.axe + ', ' + mol.geometria + '.'),
        el('div', { class: 'm3d-con-pie' }, opts.onCerrar ? el('button', { type: 'button', class: 'm3d-btn', on: { click: () => cerrar() } }, 'Cerrar') : null,
          el('button', { type: 'button', class: 'm3d-btn', title: 'Vuelve a montarla desde cero', on: { click: () => reiniciar() } }, '↺ Repetir')));
      cab.querySelector('.m3d-con-tit').firstChild.textContent = 'Montada: ';
      btnAyuda.style.display = 'none';
      pintarProgreso();
    }
    function setAyuda(b) { ayuda = !!b; if (ayuda) st.ayuda = true; btnAyuda.setAttribute('aria-pressed', String(ayuda)); if (ayuda) mostrar('💡 Los sitios muestran ahora el átomo que va en cada uno.', '', 3200); reanimar(); }
    function cerrar() { if (opts.onCerrar) { try { opts.onCerrar(); } catch (e) { console.error(e); } } else dispose(); }
    function reiniciar() {
      delete estados[clave];
      dispose(true);
      return constructor(host, opts);
    }

    // ---------- interacción con la escena: toque/clic en un sitio ----------
    /** Sitio vacío más cercano (en píxeles) a un punto de pantalla, o -1 */
    function sitioCercano(cx, cy, maxPx) {
      if (!esc) return -1;
      const r = esc.canvas.getBoundingClientRect(); let mejor = -1, dm = maxPx;
      esc.grupo.updateMatrixWorld();
      sitios.forEach((s) => {
        if (st.colocados[s.i]) return;
        s.ghost.getWorldPosition(camvec); camvec.project(esc.camera);
        if (camvec.z > 1) return;
        const px = r.left + (camvec.x * 0.5 + 0.5) * r.width, py = r.top + (-camvec.y * 0.5 + 0.5) * r.height;
        const d = Math.hypot(px - cx, py - cy);
        if (d < dm) { dm = d; mejor = s.i; }
      });
      return mejor;
    }
    function clicEscena(ev) {
      if (st.resuelto || !seleccion) return false;
      const i = sitioCercano(ev.clientX, ev.clientY, 46);
      if (i < 0) return false;
      intentar(i); return true;
    }

    // ---------- arrastrar una ficha hasta un sitio ----------
    let burbuja = null;
    function empezarArrastre(ev, s, b) {
      if (ev.button > 0 || b.disabled) return;
      const x0 = ev.clientX, y0 = ev.clientY; let activo = false;
      const mover = (e2) => {
        if (!activo && Math.hypot(e2.clientX - x0, e2.clientY - y0) > 7) { activo = true; b._arrastrado = true; elegir(s); burbuja = el('div', { class: 'm3d-arrastre', style: bolaCSS(s) }, s); document.body.append(burbuja); }
        if (activo && burbuja) { burbuja.style.left = e2.clientX + 'px'; burbuja.style.top = e2.clientY + 'px'; }
      };
      const soltar = (e2) => {
        window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); window.removeEventListener('pointercancel', soltar);
        if (burbuja) { burbuja.remove(); burbuja = null; }
        if (activo) {
          const r = esc ? esc.canvas.getBoundingClientRect() : null;
          if (r && e2.clientX >= r.left && e2.clientX <= r.right && e2.clientY >= r.top && e2.clientY <= r.bottom) {
            const i = sitioCercano(e2.clientX, e2.clientY, 64);
            if (i >= 0) intentar(i, s); else mostrar('Suelta el átomo encima de un sitio (esfera tenue).', '', 2400);
          }
          setTimeout(() => { b._arrastrado = false; }, 0);
        }
      };
      window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar); window.addEventListener('pointercancel', soltar);
    }

    // atajos de teclado dentro del constructor: 1..9 eligen sitio, Esc quita la selección
    raiz.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && seleccion) { elegir(null); ev.stopPropagation(); }
    });

    function dispose(silencioso) {
      if (muerto) return; muerto = true; clearTimeout(tMsg);
      if (burbuja) burbuja.remove();
      if (roAncho) roAncho.disconnect();
      if (modelo) { modelo.dispose(); modelo = null; }
      if (esc) { esc.dispose(); esc = null; }
      host.replaceChildren(); host.classList.remove('m3d-con-host');
    }

    // ---------- arranque ----------
    pintarFichas(); pintarSitios(); pintarProgreso();
    st.colocados.forEach((s, i) => { if (s) colocarVisual(i, false); });
    if (st.resuelto) { completoMostrado = true; mostrarCompleto(); }
    else {
      const faltan = Object.keys(necesarios).filter((s) => (necesarios[s] - (disponibles[s] || 0)) > 0).map((s) => (necesarios[s] - (disponibles[s] || 0)) + '×' + s);
      if (faltan.length) mostrar('Te faltan átomos (' + faltan.join(', ') + '): sigue recogiéndolos en el nivel. Puedes colocar los que tienes.', '', 7000);
      else if (!st.colocados.some(Boolean)) mostrar('Monta ' + mol.formula + ': elige un átomo y pulsa un sitio.', '', 4200);
    }
    if (esc) esc.pedirRender();
    return { dispose, reiniciar, estado: () => ({ colocados: st.colocados.slice(), errores: st.errores, resuelto: st.resuelto, ayuda: st.ayuda }), colocar: (i, s) => intentar(i, s), get escena() { return esc; } };
  }

  // OJO: `constructor` es una propiedad propia de PCB.mol3d (la API pedida); sobrescribe Object.prototype.constructor solo ahí.
  M.constructor = constructor;
})();
