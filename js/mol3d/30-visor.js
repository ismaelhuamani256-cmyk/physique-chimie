// =====================================================================================
// 30-visor.js — MOL3D · visor 3D de moléculas (Three.js r159 clásico, global THREE, sin addons)
//
//  PCB.mol3d.montar(host, {molecula|id, rotar:true, etiquetas:true, modelo:'bolas', panel:true, controles:true})
//      -> {dispose, setMolecula(molObjOId), setModelo('bolas'|'varillas'|'espacio'), setRotar(b), setEtiquetas(b), molecula()}
//  Bolas y varillas / varillas / espacio lleno · colores CPK · giro suave · arrastre con inercia · rueda y pellizco = zoom
//  · doble clic = recentrar · teclado: flechas giran, +/− zoom, espacio alterna el giro.
//
//  Utilidades reutilizadas por 40-reaccion.js y 50-constructor.js (PCB.mol3d.nucleo):
//     crearEscena(host, {rotar, onError}) -> escena   (renderer único, bucle bajo demanda, pausa si la pestaña está oculta)
//     crearModelo(escena, atomos, enlaces, opt) -> modelo  (átomos y enlaces como mallas compartidas)
//     panelInfo(mol) -> nodo DOM con nombre, fórmula, geometría VSEPR y ángulos
//
// Ligero: UN solo WebGL activo (las escenas se apilan: solo la de arriba dibuja), pixelRatio ≤ 1,5, geometrías y
// materiales compartidos, render bajo demanda cuando nada se mueve. `dispose()` libera renderer, texturas y listeners.
// =====================================================================================
(function () {
  'use strict';
  const PCB = (window.PCB = window.PCB || {});
  const M = (PCB.mol3d = PCB.mol3d || {});
  const T = window.THREE;
  const D = M.datos;
  const el = (tag, attrs, ...kids) => (PCB.util && PCB.util.el ? PCB.util.el(tag, attrs, ...kids) : (() => { const e = document.createElement(tag); kids.flat().forEach((k) => e.append(k)); return e; })());
  const reducido = () => { try { return PCB.util.reducedMotion(); } catch (e) { return false; } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  if (!T) { console.warn('[mol3d] THREE no disponible: el visor mostrará solo texto'); }

  // ---------------------------------------------------------------------------
  // Recursos compartidos (geometrías y materiales se reutilizan entre moléculas)
  // ---------------------------------------------------------------------------
  const comp = { esfera: null, cilindro: null, mats: {}, labels: {} };
  function recursos() {
    if (!comp.esfera) {
      comp.esfera = new T.SphereGeometry(1, 28, 20);
      comp.cilindro = new T.CylinderGeometry(1, 1, 1, 14, 1, false);
    }
    return comp;
  }
  function matAtomo(simbolo) {
    const k = 'a' + simbolo;
    if (!comp.mats[k]) comp.mats[k] = new T.MeshStandardMaterial({ color: new T.Color(D.el(simbolo).color), roughness: 0.34, metalness: 0.04 });
    return comp.mats[k];
  }
  function liberarCompartidos() {
    if (comp.esfera) { comp.esfera.dispose(); comp.cilindro.dispose(); comp.esfera = comp.cilindro = null; }
    Object.values(comp.mats).forEach((m) => m.dispose()); comp.mats = {};
    Object.values(comp.labels).forEach((t) => t.dispose()); comp.labels = {};
  }
  /** Textura del símbolo del elemento (cache). Texto oscuro sobre fondos claros (H, F, Cl, S…) */
  function texturaEtiqueta(sim, carga) {
    const k = sim + '|' + (carga || 0);
    if (comp.labels[k]) return comp.labels[k];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const col = new T.Color(D.el(sim).color), lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
    const claro = lum > 0.5;
    g.font = '700 70px system-ui,Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 12;
    const sup = carga ? (carga > 0 ? (carga > 1 ? carga : '') + '+' : (carga < -1 ? -carga : '') + '−') : '';
    const w = g.measureText(sim).width, ancho = sup ? w + 36 : w, x0 = 64 - ancho / 2 + w / 2;
    g.strokeStyle = claro ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.65)'; g.strokeText(sim, x0, 66);
    g.fillStyle = claro ? '#10162b' : '#ffffff'; g.fillText(sim, x0, 66);
    if (sup) { g.font = '700 40px system-ui,Arial,sans-serif'; g.strokeText(sup, x0 + w / 2 + 20, 38); g.fillText(sup, x0 + w / 2 + 20, 38); }
    const tex = new T.CanvasTexture(c); tex.anisotropy = 2;
    return (comp.labels[k] = tex);
  }

  // ---------------------------------------------------------------------------
  // Escena: renderer + cámara + luces + controles (arrastre con inercia, zoom) + bucle bajo demanda
  // ---------------------------------------------------------------------------
  const pila = []; // escenas activas: solo dibuja la de arriba (un único WebGL en marcha)
  function crearEscena(host, opt) {
    opt = opt || {};
    if (!T) return null;
    recursos();
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' }); }
    catch (e) { console.warn('[mol3d] WebGL no disponible', e); return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.className = 'm3d-canvas';
    const lienzo = el('div', { class: 'm3d-lienzo', tabindex: '0' }, canvas);
    host.append(lienzo);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(36, 1, 0.1, 200);
    const grupo = new T.Group(); scene.add(grupo);
    // luces: hemisférica suave + luz principal cálida + relleno frío + contraluz
    scene.add(new T.HemisphereLight(0xffffff, 0x3a4468, 1.25));
    const key = new T.DirectionalLight(0xfff3e0, 2.6); key.position.set(3.5, 5, 6); scene.add(key);
    const fill = new T.DirectionalLight(0x8fb4ff, 0.9); fill.position.set(-5, -2, 3); scene.add(fill);
    const rim = new T.DirectionalLight(0xff9de0, 0.8); rim.position.set(-2, 4, -6); scene.add(rim);

    const e = {
      host, lienzo, canvas, renderer, scene, camera, grupo, radio: 3, zoom: 1, rotar: opt.rotar !== false && !reducido(),
      hooks: [], muerta: false, visible: true, suspendida: false, frames: 0, vel: { x: 0, y: 0 }, recursos: [], onRender: [],
    };
    let raf = 0, ultimoT = 0, interaccion = 0, arrastrando = false, w = 0, h = 0;
    const punteros = new Map(); let pinch0 = 0, zoom0 = 1;
    const ejeY = new T.Vector3(0, 1, 0), ejeX = new T.Vector3(1, 0, 0);
    const qa = new T.Quaternion(), qb = new T.Quaternion();

    e.rotarPantalla = (dx, dy) => {
      qa.setFromAxisAngle(ejeY, dx); qb.setFromAxisAngle(ejeX, dy);
      grupo.quaternion.premultiply(qa).premultiply(qb);
    };
    function ajustarCamara() {
      const asp = w / Math.max(1, h), f = (camera.fov * Math.PI) / 180;
      const dist = (e.radio * 1.18) / Math.sin(f / 2) / Math.min(1, asp * 1.0 + 0.35);
      camera.position.set(0, 0, dist * e.zoom); camera.near = Math.max(0.05, dist * e.zoom - e.radio * 4); camera.far = dist * e.zoom + e.radio * 6;
      camera.aspect = asp; camera.updateProjectionMatrix();
    }
    e.ajustarA = (radio) => { e.radio = Math.max(0.8, radio); ajustarCamara(); e.pedirRender(); };
    e.orientacion = null; // cuaternión de la vista inicial (PCA de la molécula); si es null, una inclinación genérica
    e.resetVista = () => {
      e.zoom = 1; e.vel.x = e.vel.y = 0;
      if (e.orientacion) grupo.quaternion.copy(e.orientacion); else grupo.quaternion.setFromEuler(new T.Euler(0.25, -0.5, 0));
      ajustarCamara(); interaccion = performance.now(); e.pedirRender();
    };
    function medir() {
      const r = host.getBoundingClientRect(); const nw = Math.max(50, Math.round(r.width)), nh = Math.max(50, Math.round(r.height));
      if (nw === w && nh === h) return;
      w = nw; h = nh; renderer.setSize(w, h, false); ajustarCamara(); e.pedirRender();
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => medir()) : null;
    if (ro) ro.observe(host); else window.addEventListener('resize', medir);
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => { e.visible = es[es.length - 1].isIntersecting; if (e.visible) e.pedirRender(); }, { threshold: 0.01 }) : null;
    if (io) io.observe(host);

    function activa() { return !e.muerta && !e.suspendida && e.visible && !document.hidden && host.isConnected; }
    function seguir() {
      if (e.rotar && performance.now() - interaccion > 1400 && !arrastrando) return true;
      if (Math.abs(e.vel.x) > 0.01 || Math.abs(e.vel.y) > 0.01) return true;
      return e.hooks.length > 0;
    }
    function frame(t) {
      raf = 0;
      if (!activa()) return;
      const dt = Math.min(0.05, ultimoT ? (t - ultimoT) / 1000 : 0.016); ultimoT = t;
      if (!arrastrando) {
        if (Math.abs(e.vel.x) > 0.01 || Math.abs(e.vel.y) > 0.01) {
          e.rotarPantalla(e.vel.x * dt, e.vel.y * dt);
          const k = Math.exp(-3.2 * dt); e.vel.x *= k; e.vel.y *= k;
        } else if (e.rotar && performance.now() - interaccion > 1400) e.rotarPantalla(0.38 * dt, 0);
      }
      for (let i = e.hooks.length - 1; i >= 0; i--) { let sigue = false; try { sigue = e.hooks[i](dt, t); } catch (err) { console.error(err); } if (!sigue) e.hooks.splice(i, 1); }
      dibujar();
      if (seguir()) pedir(); else ultimoT = 0;
    }
    function dibujar() {
      e.onRender.forEach((f) => f(camera));
      renderer.render(scene, camera); e.frames++;
    }
    function pedir() { if (!raf && activa()) raf = requestAnimationFrame(frame); }
    e.pedirRender = pedir;
    e.reactivar = () => { ultimoT = 0; pedir(); };
    e.agregarHook = (f) => { e.hooks.push(f); pedir(); };
    e.setRotar = (b) => { e.rotar = !!b; interaccion = 0; pedir(); };
    e.tocar = () => { interaccion = performance.now(); };

    // --- interacción con punteros ---
    const cierre = [];
    const on = (obj, ev, fn, o) => { obj.addEventListener(ev, fn, o); cierre.push(() => obj.removeEventListener(ev, fn, o)); };
    let ult = null;
    on(lienzo, 'pointerdown', (ev) => {
      if (ev.button > 0) return;
      if (opt.sobreClic && opt.sobreClic(ev) === true) return; // el constructor puede interceptar el clic (colocar átomo)
      lienzo.setPointerCapture && lienzo.setPointerCapture(ev.pointerId);
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      arrastrando = true; e.vel.x = e.vel.y = 0; interaccion = performance.now(); lienzo.classList.add('arrastrando');
      ult = { x: ev.clientX, y: ev.clientY, t: performance.now() };
      if (punteros.size === 2) { const [a, b] = [...punteros.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = e.zoom; }
    });
    on(lienzo, 'pointermove', (ev) => {
      if (!punteros.has(ev.pointerId)) return;
      const p = punteros.get(ev.pointerId), dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
      interaccion = performance.now();
      if (punteros.size >= 2) {
        const [a, b] = [...punteros.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0) { e.zoom = clamp(zoom0 * pinch0 / Math.max(10, d), 0.35, 3); ajustarCamara(); pedir(); }
        return;
      }
      const k = 0.0095, now = performance.now(), dtm = Math.max(1, now - (ult ? ult.t : now - 16)) / 1000;
      e.rotarPantalla(dx * k, dy * k);
      e.vel.x = clamp(0.6 * e.vel.x + 0.4 * (dx * k) / dtm, -9, 9); e.vel.y = clamp(0.6 * e.vel.y + 0.4 * (dy * k) / dtm, -9, 9);
      ult = { x: ev.clientX, y: ev.clientY, t: now };
      pedir();
    });
    const soltar = (ev) => {
      if (!punteros.has(ev.pointerId)) return;
      punteros.delete(ev.pointerId); pinch0 = 0;
      if (!punteros.size) { arrastrando = false; lienzo.classList.remove('arrastrando'); interaccion = performance.now(); if (ult && performance.now() - ult.t > 90) e.vel.x = e.vel.y = 0; pedir(); }
    };
    on(lienzo, 'pointerup', soltar); on(lienzo, 'pointercancel', soltar);
    on(lienzo, 'wheel', (ev) => { ev.preventDefault(); e.zoom = clamp(e.zoom * Math.exp(ev.deltaY * 0.0012), 0.35, 3); interaccion = performance.now(); ajustarCamara(); pedir(); }, { passive: false });
    on(lienzo, 'dblclick', () => e.resetVista());
    on(lienzo, 'keydown', (ev) => {
      const paso = 0.14; let ok = true;
      if (ev.key === 'ArrowLeft') e.rotarPantalla(-paso, 0); else if (ev.key === 'ArrowRight') e.rotarPantalla(paso, 0);
      else if (ev.key === 'ArrowUp') e.rotarPantalla(0, -paso); else if (ev.key === 'ArrowDown') e.rotarPantalla(0, paso);
      else if (ev.key === '+' || ev.key === '=') { e.zoom = clamp(e.zoom * 0.88, 0.35, 3); ajustarCamara(); }
      else if (ev.key === '-' || ev.key === '_') { e.zoom = clamp(e.zoom / 0.88, 0.35, 3); ajustarCamara(); }
      else if (ev.key === ' ') { e.setRotar(!e.rotar); if (opt.onRotar) opt.onRotar(e.rotar); }
      else if (ev.key === '0') e.resetVista(); else ok = false;
      if (ok) { ev.preventDefault(); interaccion = performance.now(); pedir(); }
    });
    on(lienzo, 'contextmenu', (ev) => ev.preventDefault());
    on(document, 'visibilitychange', () => { if (!document.hidden) e.reactivar(); });
    // si el contexto WebGL se pierde (poco frecuente) avisamos sin romper nada
    on(canvas, 'webglcontextlost', (ev) => { ev.preventDefault(); if (opt.onError) opt.onError(new Error('contexto WebGL perdido')); });
    on(canvas, 'webglcontextrestored', () => e.pedirRender());

    // --- apilado: solo una escena dibuja a la vez ---
    const previa = pila[pila.length - 1]; if (previa) previa.suspendida = true;
    pila.push(e);

    e.dispose = function () {
      if (e.muerta) return; e.muerta = true;
      if (raf) cancelAnimationFrame(raf); raf = 0;
      cierre.forEach((f) => f()); if (ro) ro.disconnect(); else window.removeEventListener('resize', medir); if (io) io.disconnect();
      e.hooks.length = 0;
      scene.traverse((o) => { if (o.isSprite && o.material) o.material.dispose(); });
      e.recursos.forEach((r) => { try { r.dispose(); } catch (err) {} }); e.recursos.length = 0;
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (err) {}
      lienzo.remove();
      const i = pila.indexOf(e); if (i >= 0) pila.splice(i, 1);
      const top = pila[pila.length - 1]; if (top) { top.suspendida = false; top.reactivar(); } else liberarCompartidos();
    };
    medir(); e.resetVista();
    return e;
  }

  // ---------------------------------------------------------------------------
  // Modelo: átomos (esferas) + enlaces (cilindros bicolores) de una lista de átomos/enlaces
  // ---------------------------------------------------------------------------
  const ESTILOS = {
    bolas: { esfera: 0.3, enlace: 0.085, offset: 0.16, etiq: 1.45 },
    varillas: { esfera: 0.0, enlace: 0.12, offset: 0.2, etiq: 0 },
    espacio: { esfera: 1.0, enlace: 0, offset: 0, etiq: 0.7 },
  };
  /** Radio de la esfera de un átomo según el estilo */
  function radioAtomo(sim, estilo) {
    const E = D.el(sim), s = ESTILOS[estilo] || ESTILOS.bolas;
    return estilo === 'varillas' ? s.enlace * 1.15 : E.rv * s.esfera;
  }
  /**
   * @param atomos [{el,x,y,z,carga}] · enlaces [{a,b,orden}]
   * opt {estilo, etiquetas, desvanecible (enlaces con material propio para animar opacidad), ocultarH}
   */
  function crearModelo(esc, atomos, enlaces, opt) {
    opt = opt || {};
    const g = recursos(), grupo = new T.Group(); esc.grupo.add(grupo);
    const mo = { grupo, estilo: opt.estilo || 'bolas', etiquetas: opt.etiquetas !== false, atomos: [], enlaces: [], esc };
    const sprites = new T.Group(); esc.scene.add(sprites); // las etiquetas viven fuera del grupo que gira
    const dirTmp = new T.Vector3(), mid = new T.Vector3(), up = new T.Vector3(0, 1, 0), qd = new T.Quaternion(), pw = new T.Vector3(), cd = new T.Vector3();

    atomos.forEach((a, i) => {
      const mesh = new T.Mesh(g.esfera, matAtomo(a.el)); mesh.userData.i = i; grupo.add(mesh);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: texturaEtiqueta(a.el, a.carga), transparent: true, depthWrite: false, depthTest: true }));
      sprites.add(sp);
      mo.atomos.push({ el: a.el, mesh, sprite: sp, pos: new T.Vector3(a.x || 0, a.y || 0, a.z || 0), carga: a.carga || 0, visible: true, escala: 1 });
    });
    // plano de dibujo de cada enlace (para las líneas paralelas de los dobles/triples)
    const vecinos = atomos.map(() => []); enlaces.forEach((b) => { vecinos[b.a].push(b.b); vecinos[b.b].push(b.a); });
    enlaces.forEach((b) => {
      const A = mo.atomos[b.a], B = mo.atomos[b.b];
      const u = B.pos.clone().sub(A.pos).normalize();
      let ref = null;
      [b.a, b.b].forEach((x, idx) => { if (ref) return; const otro = idx ? b.a : b.b; const n = vecinos[x].find((v) => v !== otro); if (n != null) { const w = mo.atomos[n].pos.clone().sub(mo.atomos[x].pos); if (w.clone().cross(u).length() > 0.2) ref = w; } });
      const p0 = ref ? u.clone().cross(ref).cross(u).normalize() : (Math.abs(u.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0)).cross(u).normalize();
      const orden = b.orden || 1, comps = orden === 3 ? [-1, 0, 1] : orden === 2 ? [-0.5, 0.5] : orden === 1.5 ? [-0.5, 0.5] : [0];
      const meshes = comps.map((off, k) => [A, B].map((at) => {
        let mat = matAtomo(at.el);
        if (opt.desvanecible || (orden === 1.5 && k === 1)) { mat = mat.clone(); mat.transparent = true; esc.recursos.push(mat); }
        const m = new T.Mesh(g.cilindro, mat); grupo.add(m); return m;
      }));
      mo.enlaces.push({ a: b.a, b: b.b, orden, comps, meshes, p0, alpha: 1, grosor: 1, visible: true });
    });

    mo.actualizar = function () {
      const s = ESTILOS[mo.estilo];
      mo.atomos.forEach((a) => {
        a.mesh.position.copy(a.pos);
        const r = radioAtomo(a.el, mo.estilo) * a.escala; a.mesh.scale.setScalar(Math.max(0.0001, r)); a.mesh.visible = a.visible && r > 0.001;
      });
      mo.enlaces.forEach((b) => {
        const A = mo.atomos[b.a], B = mo.atomos[b.b];
        const ver = b.visible && s.enlace > 0 && b.alpha > 0.01 && A.visible && B.visible;
        b.meshes.forEach((par) => par.forEach((m) => (m.visible = ver)));
        if (!ver) return;
        dirTmp.copy(B.pos).sub(A.pos); const L = dirTmp.length() || 1e-6; dirTmp.multiplyScalar(1 / L);
        // perpendicular transportada (por si los átomos se han movido)
        let p = b.p0.clone().sub(dirTmp.clone().multiplyScalar(b.p0.dot(dirTmp)));
        if (p.lengthSq() < 1e-6) p = new T.Vector3(1, 0, 0).cross(dirTmp);
        p.normalize();
        qd.setFromUnitVectors(up, dirTmp);
        b.comps.forEach((off, k) => {
          const orden = b.orden, rr = s.enlace * b.grosor * (orden === 3 ? 0.62 : orden === 2 ? 0.72 : orden === 1.5 ? (k === 0 ? 0.8 : 0.5) : 1);
          const o = p.clone().multiplyScalar(off * s.offset * (orden === 1.5 ? 1.0 : 1.0));
          [0, 1].forEach((h) => {
            const m = b.meshes[k][h];
            // mitad 0: de A al punto medio · mitad 1: del punto medio a B
            mid.copy(A.pos).add(B.pos).multiplyScalar(0.5);
            m.position.copy(h ? B.pos : A.pos).add(mid).multiplyScalar(0.5).add(o);
            m.scale.set(rr, L / 2, rr); m.quaternion.copy(qd);
            if (m.material.transparent) m.material.opacity = b.alpha * (orden === 1.5 && k === 1 ? 0.55 : 1);
          });
        });
      });
    };
    const camDir = new T.Vector3();
    mo.actualizarEtiquetas = function (camera) {
      grupo.updateMatrixWorld();
      const nGrande = mo.atomos.length > 14;
      mo.atomos.forEach((a) => {
        const s = ESTILOS[mo.estilo], r = radioAtomo(a.el, mo.estilo) * a.escala;
        const ver = mo.etiquetas && a.visible && !(nGrande && a.el === 'H') && a.escala > 0.05;
        a.sprite.visible = ver; if (!ver) return;
        a.mesh.getWorldPosition(pw);
        cd.copy(camera.position).sub(pw).normalize();
        const tam = mo.estilo === 'varillas' ? 0.42 : mo.estilo === 'espacio' ? Math.min(r * 0.9, 1.1) : r * s.etiq;
        a.sprite.position.copy(pw).addScaledVector(cd, Math.max(r, 0.18) * 1.02);
        a.sprite.scale.set(tam, tam, 1);
      });
    };
    mo.setEstilo = (e2) => { if (ESTILOS[e2]) { mo.estilo = e2; mo.actualizar(); esc.pedirRender(); } };
    mo.setEtiquetas = (b) => { mo.etiquetas = !!b; esc.pedirRender(); };
    mo.radio = () => mo.atomos.reduce((m, a) => Math.max(m, a.pos.length() + D.el(a.el).rv * (mo.estilo === 'espacio' ? 1 : 0.35)), 0.6);
    mo.dispose = () => {
      esc.grupo.remove(grupo); esc.scene.remove(sprites);
      mo.atomos.forEach((a) => a.sprite.material.dispose());
      mo.enlaces.forEach((b) => b.meshes.forEach((par) => par.forEach((m) => { if (m.material.transparent) m.material.dispose(); })));
    };
    esc.onRender.push(mo.actualizarEtiquetas);
    mo.actualizar();
    return mo;
  }

  // ---------------------------------------------------------------------------
  // Panel de información + barra de controles
  // ---------------------------------------------------------------------------
  const fnum = (x) => String(x).replace('.', ',');
  function panelInfo(mol) {
    const centros = mol.centros.filter((c) => c.el !== 'H');
    const ang = M.resumenAngulos ? M.resumenAngulos(mol) : [];
    const sim = centros.length > 1;
    const filas = [];
    if (!centros.length) filas.push(el('p', { class: 'm3d-geo' }, 'Molécula o ion diatómico/monoatómico: ', el('b', {}, mol.geometria)));
    else if (!sim) filas.push(el('p', { class: 'm3d-geo' }, 'VSEPR ', el('b', {}, mol.axe), ' · ', el('b', {}, mol.geometria), ' ', el('span', { class: 'm3d-fr', lang: 'fr' }, '(' + mol.geometriaFr + ')')));
    else {
      filas.push(el('p', { class: 'm3d-geo' }, 'Geometría alrededor de cada átomo central (VSEPR):'));
      const grupos = {}; centros.forEach((c) => { const k = c.el + '|' + c.axe + '|' + c.geometria; (grupos[k] = grupos[k] || { c, n: 0 }).n++; });
      filas.push(el('ul', { class: 'm3d-centros' }, Object.values(grupos).slice(0, 6).map((g) => el('li', {}, el('b', {}, g.c.el + (g.n > 1 ? ' ×' + g.n : '') + ' '), g.c.axe + ' · ' + g.c.geometria.replace(/ \(.*\)/, '')))));
    }
    if (ang.length) filas.push(el('p', { class: 'm3d-ang' }, el('span', {}, 'Ángulos: '), ang.join(' · ')));
    return el('div', { class: 'm3d-info' },
      el('div', { class: 'm3d-formula', 'aria-label': 'Fórmula ' + mol.formulaAscii }, mol.formula),
      el('div', { class: 'm3d-nombre' }, mol.nombre ? mol.nombre.charAt(0).toUpperCase() + mol.nombre.slice(1) : '', mol.nombre_fr ? el('small', { lang: 'fr' }, ' · ' + mol.nombre_fr) : null),
      ...filas);
  }
  /**
   * Orientación inicial «didáctica»: gira la molécula para que su plano principal (el de mayor dispersión de
   * átomos, por análisis de componentes principales) mire a la cámara, con una ligera inclinación que deja ver el relieve.
   */
  function orientacionPCA(pts) {
    const n = pts.length; if (n < 2) return new T.Quaternion().setFromEuler(new T.Euler(0.25, -0.5, 0));
    const c = [0, 0, 0]; pts.forEach((p) => { c[0] += p.x / n; c[1] += p.y / n; c[2] += p.z / n; });
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    pts.forEach((p) => { const v = [p.x - c[0], p.y - c[1], p.z - c[2]]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += v[i] * v[j]; });
    // Jacobi para matriz simétrica 3x3
    const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], A = C.map((r) => r.slice());
    for (let it = 0; it < 24; it++) {
      let p = 0, q = 1, m = Math.abs(A[0][1]); if (Math.abs(A[0][2]) > m) { p = 0; q = 2; m = Math.abs(A[0][2]); } if (Math.abs(A[1][2]) > m) { p = 1; q = 2; m = Math.abs(A[1][2]); }
      if (m < 1e-10) break;
      const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), cs = Math.cos(th), sn = Math.sin(th);
      for (let k = 0; k < 3; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = cs * a - sn * b; A[k][q] = sn * a + cs * b; }
      for (let k = 0; k < 3; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = cs * a - sn * b; A[q][k] = sn * a + cs * b; }
      for (let k = 0; k < 3; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = cs * a - sn * b; V[k][q] = sn * a + cs * b; }
    }
    const val = [A[0][0], A[1][1], A[2][2]], ord = [0, 1, 2].sort((a, b) => val[b] - val[a]);
    const col = (k) => new T.Vector3(V[0][ord[k]], V[1][ord[k]], V[2][ord[k]]);
    const ex = col(0), ey = col(1), ez = new T.Vector3().crossVectors(ex, ey); // ex: mayor dispersión → eje x de pantalla
    const base = new T.Matrix4().makeBasis(ex, ey, ez); // columnas = ejes de la molécula expresados en el mundo
    const q = new T.Quaternion().setFromRotationMatrix(base).invert();      // lleva ex→x, ey→y, ez→z
    const tilt = new T.Quaternion().setFromEuler(new T.Euler(0.38, -0.5, 0.0));
    return tilt.multiply(q);
  }
  M.nucleo = { crearEscena, crearModelo, panelInfo, radioAtomo, orientacionPCA, ESTILOS, reducido };

  // ---------------------------------------------------------------------------
  // API pública: montar
  // ---------------------------------------------------------------------------
  /**
   * Monta un visor 3D de una molécula en `host` (un <div> con altura; si no la tiene se le da 340 px).
   * opts: molecula (objeto) | id (fórmula) · rotar · etiquetas · modelo · panel · controles
   */
  function montar(host, opts) {
    opts = opts || {};
    if (!host.style.minHeight && host.clientHeight < 80) host.style.minHeight = '340px';
    host.classList.add('m3d');
    let mol = typeof opts.molecula === 'object' && opts.molecula ? opts.molecula : M.molecula(opts.molecula || opts.id);
    let estilo = opts.modelo || 'bolas', etiquetas = opts.etiquetas !== false, modelo = null, fallo = null;
    const alt = el('p', { class: 'm3d-alt', id: 'm3d-alt-' + Math.random().toString(36).slice(2, 8) });
    const panelHost = el('div', { class: 'm3d-panel' });
    const barra = el('div', { class: 'm3d-barra', role: 'toolbar', 'aria-label': 'Controles del visor 3D' });
    let esc = null;
    esc = crearEscena(host, { rotar: opts.rotar !== false, onError: (err) => (fallo = err), onRotar: (b) => marcar() });
    host.append(alt);
    if (opts.panel !== false) host.append(panelHost);
    const botones = {};
    function marcar() { if (botones.rotar) botones.rotar.setAttribute('aria-pressed', String(!!(esc && esc.rotar))); if (botones.etiq) botones.etiq.setAttribute('aria-pressed', String(etiquetas)); ['bolas', 'varillas', 'espacio'].forEach((k) => botones[k] && botones[k].setAttribute('aria-pressed', String(estilo === k))); }
    if (opts.controles !== false) {
      const mk = (clave, txt, tit, fn) => (botones[clave] = el('button', { type: 'button', class: 'm3d-btn', title: tit, 'aria-pressed': 'false', on: { click: fn } }, txt));
      barra.append(
        el('div', { class: 'm3d-grupo', role: 'group', 'aria-label': 'Modelo molecular' },
          mk('bolas', 'Bolas', 'Modelo de bolas y varillas', () => setModelo('bolas')),
          mk('varillas', 'Varillas', 'Modelo de varillas', () => setModelo('varillas')),
          mk('espacio', 'Espacio lleno', 'Modelo de espacio lleno (radios de van der Waals)', () => setModelo('espacio'))),
        mk('rotar', '↻ Girar', 'Giro automático (espacio)', () => { if (esc) { esc.setRotar(!esc.rotar); marcar(); } }),
        mk('etiq', 'Aa', 'Mostrar u ocultar los símbolos de los elementos', () => setEtiquetas(!etiquetas)),
        mk('centrar', '⌖', 'Recentrar la vista (doble clic o tecla 0)', () => esc && esc.resetVista()));
      host.append(barra);
    }
    function pintarTexto() {
      if (!mol) return;
      alt.textContent = M.describir(mol);
      if (esc) { esc.lienzo.setAttribute('role', 'img'); esc.lienzo.setAttribute('aria-label', M.describir(mol) + ' Modelo 3D interactivo: flechas para girar, más y menos para el zoom, espacio para pausar el giro.'); }
      panelHost.replaceChildren(panelInfo(mol));
    }
    function cargar() {
      if (modelo) { modelo.dispose(); modelo = null; }
      if (!mol) { alt.textContent = 'Molécula no disponible.'; return; }
      pintarTexto();
      if (!esc) { host.classList.add('m3d-sin-webgl'); return; }
      modelo = crearModelo(esc, mol.atomos, mol.enlaces, { estilo, etiquetas });
      esc.orientacion = orientacionPCA(modelo.atomos.map((a) => a.pos));
      esc.ajustarA(modelo.radio());
      esc.resetVista(); marcar();
    }
    function setModelo(s) { estilo = s; if (modelo) { modelo.setEstilo(s); esc.ajustarA(modelo.radio()); } marcar(); }
    function setEtiquetas(b) { etiquetas = !!b; if (modelo) modelo.setEtiquetas(b); marcar(); }
    cargar();
    if (esc) { esc.setRotar(opts.rotar !== false && !reducido()); marcar(); }
    return {
      dispose() { if (modelo) { modelo.dispose(); modelo = null; } if (esc) { esc.dispose(); esc = null; } host.classList.remove('m3d', 'm3d-sin-webgl'); host.replaceChildren(); },
      setMolecula(x) { mol = typeof x === 'object' && x ? x : M.molecula(x); cargar(); },
      setModelo, setEtiquetas, setRotar(b) { if (esc) { esc.setRotar(b); marcar(); } },
      molecula: () => mol, get escena() { return esc; }, get modelo() { return modelo; },
    };
  }
  M.montar = montar;
})();
