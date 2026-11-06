// =====================================================================================
// 20-quimica-6a9.js — CONCEPTOS de química, capítulos 6 a 9 (agente CONCEPTOS-B)
//   6 sens-evolution        · equilibrio-dinamico · q-vs-k · pila
//   7 force-acides-bases    · fuerza-acido-base · pka-predominio
//   8 forcer-sens           · electrolisis · carga-materia
//   9 synthese-organique    · isomeria · etapas-sintesis · reflujo · velocidad-rendimiento
// Cada concepto: PCB.conceptos.registrar({...}) (API en 00-nucleo.js). Escenas en Canvas 2D (espacio virtual 800×450)
// o con el visor 3D PCB.mol3d (isomería). Un solo WebGL activo; dispose() lo libera todo.
// CSS propio con prefijo `cptb-` (inyectado desde aquí). Fuente de cada concepto: ver `pagina_pdf` / `resumen`.
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB;
  if (!PCB || !PCB.conceptos || !PCB.conceptos.registrar) { console.warn('[conceptos-b] núcleo de conceptos no disponible'); return; }
  const { el } = PCB.util;
  const registrar = (d) => PCB.conceptos.registrar(d);

  // ---------------------------------------------------------------- estilo común
  const K = { v: '#2ee59d', m: '#ff3da6', fondo: '#0a0f20', txt: '#e8ecff', tx2: '#9aa6d4', az: '#6aa7ff', am: '#ffd166', rojo: '#ff5d6c', gris: '#2a376b', panel: '#121a38' };
  (function css() {
    if (document.getElementById('cptb-css')) return;
    const s = document.createElement('style'); s.id = 'cptb-css';
    s.textContent = [
      '.cptb-bar{position:absolute;left:0;right:0;bottom:0;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;padding:14px 10px 6px;background:linear-gradient(rgba(10,15,32,0),rgba(10,15,32,.92) 38%);font:600 12px/1.2 system-ui,sans-serif;color:' + K.txt + ';z-index:3}',
      '.cptb-top{position:absolute;left:0;right:0;top:0;display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:6px 8px 12px;background:linear-gradient(rgba(10,15,32,.92) 55%,rgba(10,15,32,0));font:600 12px/1.2 system-ui,sans-serif;color:' + K.txt + ';z-index:3}',
      '.cptb-bar label{display:flex;gap:6px;align-items:center;white-space:nowrap}',
      '.cptb-bar input[type=range]{width:120px;accent-color:' + K.v + ';min-height:20px}',
      '.cptb-bar b,.cptb-top b{color:' + K.v + ';font-variant-numeric:tabular-nums}',
      '.cptb-btn{font:600 12px/1.1 system-ui,sans-serif;color:' + K.txt + ';background:#142046;border:1px solid ' + K.gris + ';border-radius:8px;padding:5px 9px;cursor:pointer;min-height:28px}',
      '.cptb-btn:hover{border-color:' + K.v + '}.cptb-btn[aria-pressed="true"]{background:#144a34;border-color:' + K.v + ';color:#eafff6}.cptb-btn:disabled{opacity:.45;cursor:default}',
      '.cptb-cap{position:absolute;z-index:2;pointer-events:none;font:600 13px/1.3 system-ui,sans-serif;color:' + K.txt + ';text-shadow:0 1px 3px #000}',
      '.cptb-cap small{display:block;font:italic 400 12px system-ui,sans-serif;color:' + K.tx2 + '}',
      '.cptb-cap .f{font:700 15px system-ui,sans-serif;color:' + K.v + '}',
      '.cptb-lect{position:absolute;left:8px;right:8px;z-index:2;pointer-events:none;text-align:center;font:600 13px/1.35 system-ui,sans-serif;color:' + K.txt + ';text-shadow:0 1px 3px #000}',
      '.cptb-fallo{padding:24px;color:' + K.tx2 + ';font:14px system-ui,sans-serif}',
    ].join('\n');
    document.head.appendChild(s);
  })();

  // Barra de controles superpuesta. items: {t:'slider',id,txt,min,max,step,val,fmt,on} · {t:'btn',txt,on,id} · {t:'tog',txt,on,id,val} · {t:'txt',id}
  function barra(host, items, cls) {
    const b = el('div', { class: cls || 'cptb-bar' }), refs = {};
    items.forEach((it) => {
      if (it.t === 'slider') {
        const out = el('b', {}, ''), inp = el('input', { type: 'range', min: it.min, max: it.max, step: it.step || 1, value: it.val, 'aria-label': it.txt });
        const f = it.fmt || ((v) => String(v));
        const act = () => { out.textContent = f(+inp.value); it.on && it.on(+inp.value); };
        inp.addEventListener('input', act); out.textContent = f(+it.val);
        refs[it.id || it.txt] = { inp, out, set(v) { inp.value = v; out.textContent = f(+v); }, get: () => +inp.value };
        b.append(el('label', {}, it.txt + ' ', inp, out));
      } else if (it.t === 'btn') {
        const bt = el('button', { type: 'button', class: 'cptb-btn', on: { click: () => it.on && it.on(bt) } }, it.txt);
        refs[it.id || it.txt] = bt; b.append(bt);
      } else if (it.t === 'tog') {
        const bt = el('button', { type: 'button', class: 'cptb-btn', 'aria-pressed': String(!!it.val), on: { click: () => { const v = bt.getAttribute('aria-pressed') !== 'true'; bt.setAttribute('aria-pressed', String(v)); it.on && it.on(v); } } }, it.txt);
        refs[it.id || it.txt] = bt; b.append(bt);
      } else if (it.t === 'txt') { const s = el('span', { class: 'cptb-t' }, it.txt || ''); refs[it.id] = s; b.append(s); }
    });
    host.append(b); refs.el = b; return refs;
  }

  // Lienzo 2D con espacio virtual 800×450. cfg {paso(dt)->bool seguir, dibujar(S)}; S.txt(str,x,y,{size,color,align,weight,font})
  function lienzo(host, api, cfg) {
    const cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    cv.setAttribute('role', 'img'); if (cfg.alt) cv.setAttribute('aria-label', cfg.alt);
    host.append(cv);
    const ctx = cv.getContext('2d'), VW = 800, VH = 450;
    const S = { ctx, VW, VH, sc: 1, t: 0, dt: 0, reducido: !!api.reducido };
    let raf = 0, muerto = false, ult = 0, dpr = 1;
    function medir() {
      const r = host.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(60, r.width), h = Math.max(34, r.height);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      S.sc = Math.min(w / VW, h / VH); S.ox = (w - VW * S.sc) / 2; S.oy = (h - VH * S.sc) / 2; pedir();
    }
    S.txt = (s, x, y, o) => {
      o = o || {}; const px = Math.max(o.size || 14, 12 / S.sc);
      ctx.font = (o.weight || 600) + ' ' + px + 'px ' + (o.font || 'system-ui,sans-serif');
      ctx.fillStyle = o.color || K.txt; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle';
      if (o.halo) { ctx.lineWidth = 3 / S.sc; ctx.strokeStyle = 'rgba(10,15,32,.9)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
      ctx.fillText(s, x, y);
    };
    S.limpiar = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = K.fondo; ctx.fillRect(0, 0, cv.width, cv.height); ctx.setTransform(dpr * S.sc, 0, 0, dpr * S.sc, dpr * S.ox, dpr * S.oy); };
    function frame(ts) {
      raf = 0; if (muerto || !host.isConnected) return;
      const dt = Math.min(0.05, ult ? (ts - ult) / 1000 : 0.016); ult = ts; S.dt = dt; S.t += dt;
      let seguir = false;
      try { seguir = cfg.paso ? !!cfg.paso(dt) : false; S.limpiar(); cfg.dibujar(S); } catch (e) { console.error('[conceptos-b]', e); }
      if (seguir || cfg.continuo) pedir(); else ult = 0;
    }
    function pedir() { if (!raf && !muerto) raf = requestAnimationFrame(frame); }
    S.pedir = pedir;
    api.onResize(medir); medir();
    S.dispose = () => { muerto = true; if (raf) cancelAnimationFrame(raf); cv.remove(); };
    return S;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const suave = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (n) => String(n).replace(/\d/g, (d) => SUB[+d]);
  const fnum = (x, d) => String(+x.toFixed(d == null ? 1 : d)).replace('.', ',');
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function flecha(ctx, x1, y1, x2, y2, col, lw, cab) {
    cab = cab || 9; const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw || 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * cab * 0.6, y2 - Math.sin(a) * cab * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - cab * Math.cos(a - 0.45), y2 - cab * Math.sin(a - 0.45)); ctx.lineTo(x2 - cab * Math.cos(a + 0.45), y2 - cab * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
  }
  function bola(ctx, x, y, r, col, etq, tc) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffffcc'); g.addColorStop(0.25, col); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
  }
  const rng = PCB.util.rng;

  // =============================================================================================================
  // 9 · ISOMERÍA  (PRIORIDAD)  — cours p. 232 (fig. 3: isomería de constitución). cis/trans y enantiómeros: ampliación
  //     apoyada en la fiche méthode 14 «Représenter des molécules» (pdf p. 566: modelos moleculares en 3D).
  // =============================================================================================================
  const TIPOS = {
    idea: { col: K.am, tit: 'Misma fórmula bruta, otra molécula', a: { smi: 'CCCC', nom: 'butano', fr: 'butane', sd: 'CH₃–CH₂–CH₂–CH₃' }, b: { smi: 'CC(C)C', nom: '2-metilpropano', fr: '2-méthylpropane', sd: 'CH₃–CH(CH₃)–CH₃' }, regla: 'Cadena lineal ↔ cadena ramificada' },
    cadena: { col: K.v, tit: 'Isómeros de cadena', a: { smi: 'COC(C)=O', nom: 'etanoato de metilo', fr: 'éthanoate de méthyle', sd: 'CH₃–CO–O–CH₃' }, b: { smi: 'O=COCC', nom: 'metanoato de etilo', fr: 'méthanoate d’éthyle', sd: 'H–CO–O–CH₂–CH₃' }, regla: 'Esqueleto carbonado distinto', frr: 'squelette carboné différent' },
    posicion: { col: K.rojo, tit: 'Isómeros de posición', a: { smi: 'CCC(C)=O', nom: 'butan-2-ona', fr: 'butan-2-one', sd: 'CH₃–CO–CH₂–CH₃' }, b: { smi: 'O=CCCC', nom: 'butanal', fr: 'butanal', sd: 'CH₃–CH₂–CH₂–CHO' }, regla: 'El grupo característico C=O está en otra posición', frr: 'position différente d’un groupe caractéristique' },
    funcion: { col: K.az, tit: 'Isómeros de función', a: { smi: 'COC(C)=O', nom: 'etanoato de metilo (éster)', fr: 'éthanoate de méthyle', sd: 'CH₃–CO–O–CH₃' }, b: { smi: 'CCC(=O)O', nom: 'ácido propanoico (ácido carboxílico)', fr: 'acide propanoïque', sd: 'CH₃–CH₂–CO₂H' }, regla: 'Grupos característicos diferentes: éster ≠ ácido carboxílico', frr: 'groupes caractéristiques différents' },
  };
  const ZZ = '#ff3da6';
  function hillFormula(atomos) {
    const n = {}; atomos.forEach((a) => (n[a.el] = (n[a.el] || 0) + 1));
    const ks = Object.keys(n).sort((a, b) => { const o = (x) => (x === 'C' ? 0 : x === 'H' ? 1 : 2); return o(a) - o(b) || (a < b ? -1 : 1); });
    return ks.map((k) => k + (n[k] > 1 ? sub(n[k]) : '')).join('');
  }
  function metiloH(at, en, c, u, add, bond) {
    // tres H de un CH3 con dirección de enlace u (C padre → este C)
    const p1 = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const p2 = [u[1] * p1[2] - u[2] * p1[1], u[2] * p1[0] - u[0] * p1[2], u[0] * p1[1] - u[1] * p1[0]];
    const l2 = Math.hypot(...p2); p2[0] /= l2; p2[1] /= l2; p2[2] /= l2;
    const P = at[c];
    for (let k = 0; k < 3; k++) {
      const f = (k * 2 * Math.PI) / 3 + 0.5, cs = Math.cos(f) * 0.943, sn = Math.sin(f) * 0.943;
      const d = [0.333 * u[0] + cs * p1[0] + sn * p2[0], 0.333 * u[1] + cs * p1[1] + sn * p2[1], 0.333 * u[2] + cs * p1[2] + sn * p2[2]];
      const h = add('H', [P.x + 1.09 * d[0], P.y + 1.09 * d[1], P.z + 1.09 * d[2]]); bond(c, h);
    }
  }
  function constructorMol() {
    const atomos = [], enlaces = [];
    const add = (el_, p) => { atomos.push({ el: el_, x: p[0], y: p[1], z: p[2], carga: 0 }); return atomos.length - 1; };
    const bond = (a, b, o) => enlaces.push({ a, b, orden: o || 1 });
    return { atomos, enlaces, add, bond };
  }
  function buteno(cis) {
    const m = constructorMol(), { add, bond, atomos, enlaces } = m;
    const c2 = add('C', [-0.67, 0, 0]), c3 = add('C', [0.67, 0, 0]); bond(c2, c3, 2);
    const U = [-0.5, 0.866, 0], D = [-0.5, -0.866, 0];
    const me2 = add('C', [-0.67 + 1.5 * U[0], 1.5 * U[1], 0]); bond(c2, me2); metiloH(atomos, enlaces, me2, U, add, bond);
    const h2 = add('H', [-0.67 + 1.09 * D[0], 1.09 * D[1], 0]); bond(c2, h2);
    const Ur = [0.5, 0.866, 0], Dr = [0.5, -0.866, 0];
    const mu = cis ? Ur : Dr, hu = cis ? Dr : Ur;
    const me3 = add('C', [0.67 + 1.5 * mu[0], 1.5 * mu[1], 0]); bond(c3, me3); metiloH(atomos, enlaces, me3, mu, add, bond);
    const h3 = add('H', [0.67 + 1.09 * hu[0], 1.09 * hu[1], 0]); bond(c3, h3);
    return { atomos, enlaces };
  }
  const DIRS = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => v.map((x) => x / Math.sqrt(3)));
  const LONG = { H: 1.09, F: 1.35, Cl: 1.77, Br: 1.94 };
  function tetra(sust, espejo) {
    const atomos = [{ el: 'C', x: 0, y: 0, z: 0, carga: 0 }], enlaces = [];
    sust.forEach((s, i) => { const d = DIRS[i], l = LONG[s]; atomos.push({ el: s, x: (espejo ? -1 : 1) * d[0] * l, y: d[1] * l, z: d[2] * l, carga: 0 }); enlaces.push({ a: 0, b: i + 1, orden: 1 }); });
    return { atomos, enlaces };
  }

  function montarIsomeria(host, api) {
    const M3 = api.mol3d || PCB.mol3d, nu = M3 && M3.nucleo, T = api.THREE || window.THREE;
    if (!nu || !T || !M3.vsepr) { host.append(el('p', { class: 'cptb-fallo' }, 'El visor 3D no está disponible.')); return { ir() {}, dispose() {} }; }
    const esc = nu.crearEscena(host, { rotar: false });
    if (!esc) { host.append(el('p', { class: 'cptb-fallo' }, 'WebGL no está disponible en este navegador: la escena 3D no puede mostrarse.')); return { ir() {}, dispose() {} }; }
    esc.orientacion = new T.Quaternion().setFromEuler(new T.Euler(0.3, -0.3, 0)); esc.resetVista();
    let vista = null, sinH = false, tipo = 'idea', quiral = true, s = 0, giro = true, anim = null, muerto = false, hookOn = false;
    const info = (lado) => el('div', { class: 'cptb-cap', style: { bottom: '46px', [lado]: '3%', textAlign: lado === 'left' ? 'left' : 'right', maxWidth: '45%' } });
    const capA = info('left'), capB = info('right');
    const lect = el('div', { class: 'cptb-lect', style: { top: '44px' } });
    const top = barra(host, [], 'cptb-top');
    const TABS = [['idea', 'Idea'], ['cadena', 'Cadena'], ['posicion', 'Posición'], ['funcion', 'Función'], ['cistrans', 'cis / trans'], ['enant', 'Imagen especular']];
    const botones = {};
    TABS.forEach(([id, txt]) => { const b = el('button', { type: 'button', class: 'cptb-btn', 'aria-pressed': 'false', on: { click: () => cargar(id) } }, txt); botones[id] = b; top.el.append(b); });
    host.append(capA, capB, lect);
    const ctr = barra(host, [
      { t: 'slider', id: 'sl', txt: 'Superponer B sobre A', min: 0, max: 100, step: 1, val: 0, fmt: (v) => v + ' %', on: (v) => { anim = null; setS(v / 100); } },
      { t: 'btn', id: 'play', txt: '▶ Animar', on: () => animar() },
      { t: 'btn', id: 'quiral', txt: 'Molécula: CHFClBr', on: () => { quiral = !quiral; if (tipo === 'enant') cargar('enant'); } },
      { t: 'tog', id: 'giro', txt: '↻ Girar', val: giro, on: (v) => { giro = v; if (v) hook(); esc.pedirRender(); } },
      { t: 'tog', id: 'sinH', txt: 'Ocultar los H de C (esqueleto)', val: false, on: (v) => { sinH = v; aplicarH(); } },
    ]);

    function limpiar() {
      if (!vista) return;
      vista.models.forEach((mo) => mo.dispose());
      vista.wraps.forEach((w) => esc.grupo.remove(w));
      vista.extra.forEach((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      vista = null;
    }
    function hook() {
      if (hookOn || muerto) return; hookOn = true;
      esc.agregarHook((dt) => {
        if (muerto || api.reducido || !giro || !vista || vista.fijo) { hookOn = false; return false; }
        vista.wraps.forEach((w) => (w.rotation.y += 0.5 * dt)); return true;
      });
    }
    function modeloDe(mol, orient) {
      const mo = nu.crearModelo(esc, mol.atomos, mol.enlaces, { estilo: 'bolas', etiquetas: true });
      if (orient) mo.grupo.quaternion.copy(nu.orientacionPCA(mo.atomos.map((a) => a.pos)));
      return mo;
    }
    function cargar(t) {
      tipo = t; limpiar(); anim = null; s = 0; sinH = t === 'cadena' || t === 'posicion' || t === 'funcion';
      TABS.forEach(([id]) => botones[id].setAttribute('aria-pressed', String(id === t)));
      const models = [], wraps = [], extra = [];
      let molA, molB, datos = null, fijo = false;
      if (t === 'cistrans') { molA = buteno(true); molB = buteno(false); fijo = false; }
      else if (t === 'enant') { molA = tetra(quiral ? ['H', 'F', 'Cl', 'Br'] : ['H', 'H', 'Cl', 'Br'], false); molB = tetra(quiral ? ['H', 'F', 'Cl', 'Br'] : ['H', 'H', 'Cl', 'Br'], true); fijo = true; }
      else { datos = TIPOS[t]; molA = M3.vsepr.desdeSMILES(datos.a.smi); molB = M3.vsepr.desdeSMILES(datos.b.smi); }
      const orient = t !== 'enant' && t !== 'cistrans';
      const mA = modeloDe(molA, orient), mB = modeloDe(molB, orient); models.push(mA, mB);
      const RA = mA.radio(), RB = mB.radio(), d = t === 'enant' ? 2.5 : Math.max(RA, RB) + 0.55;
      [[mA, -d], [mB, d]].forEach(([mo, x]) => { const w = new T.Group(); w.position.set(x, 0, 0); esc.grupo.add(w); w.add(mo.grupo); wraps.push(w); });
      vista = { models, wraps, extra, fijo, d, molA, molB, halos: [], plano: null };
      if (t === 'enant') {
        const geo = new T.PlaneGeometry(4.2, 4.2), mat = new T.MeshBasicMaterial({ color: 0xff3da6, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false });
        const pl = new T.Mesh(geo, mat); pl.rotation.y = Math.PI / 2; esc.grupo.add(pl); vista.plano = pl; extra.push(pl);
        const ln = new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: 0xff3da6 })); ln.rotation.y = Math.PI / 2; esc.grupo.add(ln); extra.push(ln);
        vista.linea = ln;
        const R = (a) => nu.radioAtomo(a, 'bolas') * 1.5;
        molB.atomos.forEach((a, i) => { const h = new T.Mesh(new T.SphereGeometry(R(a.el), 20, 14), new T.MeshBasicMaterial({ color: 0x2ee59d, transparent: true, opacity: 0.32, depthWrite: false })); h.position.set(a.x, a.y, a.z); h.visible = false; wraps[1].add(h); vista.halos.push(h); extra.push(h); });
        // rotación que lleva (Cl, Br) de B sobre (Cl, Br) de A
        const idx = (mol, el_) => mol.atomos.findIndex((a) => a.el === el_);
        const v = (mol, i) => new T.Vector3(mol.atomos[i].x, mol.atomos[i].y, mol.atomos[i].z);
        const fr = (u, w) => { const e1 = u.clone().normalize(), e3 = new T.Vector3().crossVectors(u, w).normalize(), e2 = new T.Vector3().crossVectors(e3, e1); return new T.Matrix4().makeBasis(e1, e2, e3); };
        const a1 = v(molA, idx(molA, 'Cl')), a2 = v(molA, idx(molA, 'Br')), b1 = v(molB, idx(molB, 'Cl')), b2 = v(molB, idx(molB, 'Br'));
        const Rm = fr(a1, a2).multiply(fr(b1, b2).invert());
        vista.qT = new T.Quaternion().setFromRotationMatrix(Rm);
        // átomos de B que caen sobre un átomo igual de A tras la rotación
        vista.coin = molB.atomos.map((a) => { const p = new T.Vector3(a.x, a.y, a.z).applyQuaternion(vista.qT); return molA.atomos.some((b) => b.el === a.el && p.distanceTo(new T.Vector3(b.x, b.y, b.z)) < 0.3); });
        vista.nCoin = vista.coin.filter(Boolean).length;
      }
      esc.setRotar(false);
      const total = d + Math.max(RA, RB);
      esc.ajustarA(total * 0.64); esc.resetVista();
      if (t === 'enant') { esc.orientacion = new T.Quaternion().setFromEuler(new T.Euler(0.25, -0.5, 0)); esc.resetVista(); }
      wraps.forEach((w) => w.updateMatrixWorld(true));
      pintarTextos(datos); ctr.sl.set(0); setS(0);
      ctr.giro.style.display = fijo ? 'none' : ''; ctr.sinH.style.display = fijo ? 'none' : ''; aplicarH();
      ctr.sl.inp.parentElement.style.display = fijo ? '' : 'none'; ctr.play.style.display = fijo ? '' : 'none'; ctr.quiral.style.display = fijo ? '' : 'none';
      ctr.quiral.textContent = 'Molécula: ' + (quiral ? 'CHFClBr' : 'CH₂ClBr');
      if (!fijo && giro) hook();
      esc.pedirRender();
    }
    function aplicarH() {
      if (!vista) return;
      ctr.sinH.setAttribute('aria-pressed', String(sinH));
      if (tipo !== 'enant') vista.models.forEach((mo) => {
        const hC = new Set(); mo.enlaces.forEach((b) => { const A = mo.atomos[b.a], B = mo.atomos[b.b]; if (A.el === 'H' && B.el === 'C') hC.add(b.a); if (B.el === 'H' && A.el === 'C') hC.add(b.b); });
        mo.atomos.forEach((a, i) => (a.visible = !(sinH && hC.has(i)))); mo.actualizar();
      });
      esc.pedirRender();
    }
    function nombre(c, mol) { return [el('span', { class: 'f' }, hillFormula(mol.atomos)), el('div', {}, c.nom), c.fr ? el('small', { lang: 'fr' }, c.fr) : null, c.sd ? el('small', {}, c.sd) : null].filter(Boolean); }
    function pintarTextos(datos) {
      capA.replaceChildren(); capB.replaceChildren(); lect.replaceChildren();
      if (tipo === 'cistrans') {
        capA.append(...nombre({ nom: '(Z)-but-2-eno · cis', fr: 'but-2-ène (Z)', sd: 'CH₃ del mismo lado' }, vista.molA)); capB.append(...nombre({ nom: '(E)-but-2-eno · trans', fr: 'but-2-ène (E)', sd: 'CH₃ de lados opuestos' }, vista.molB));
        lect.append(el('span', { style: { color: K.m } }, 'Misma fórmula y mismos enlaces · distinta disposición en el espacio (estereoisómeros)'));
      } else if (tipo === 'enant') {
        const f = hillFormula(vista.molA.atomos);
        capA.append(...nombre({ nom: quiral ? 'molécula A' : 'molécula A', sd: quiral ? '4 sustituyentes distintos' : 'dos H iguales' }, vista.molA));
        capB.append(...nombre({ nom: 'B = imagen especular de A', sd: 'reflejada en el plano rosa' }, vista.molB));
        lect.append(el('span', { style: { color: K.m } }, '¿Se puede superponer B sobre A? Prueba con el deslizador.'));
        void f;
      } else {
        capA.append(...nombre(datos.a, vista.molA)); capB.append(...nombre(datos.b, vista.molB));
        const fa = hillFormula(vista.molA.atomos), fb = hillFormula(vista.molB.atomos);
        lect.append(el('span', { style: { color: datos.col } }, datos.tit + ' · ' + (fa === fb ? '✔ misma fórmula bruta ' + fa : '✖ fórmulas distintas') + ' · ' + datos.regla));
      }
    }
    function animar() {
      if (tipo !== 'enant') return;
      if (api.reducido) { setS(s >= 1 ? 0 : 1); ctr.sl.set(Math.round(s * 100)); return; }
      anim = { desde: s >= 1 ? 0 : s, t: 0 }; s = anim.desde; hook2();
    }
    function hook2() {
      esc.agregarHook((dt) => { if (!anim || muerto) return false; anim.t += dt; const v = clamp(anim.desde + anim.t / 5, 0, 1); setS(v); ctr.sl.set(Math.round(v * 100)); if (v >= 1) { anim = null; return false; } return true; });
    }
    function setS(v) {
      s = v;
      if (!vista || tipo !== 'enant') return;
      const [wA, wB] = vista.wraps, d = vista.d;
      const f1 = clamp(v / 0.5, 0, 1), f2 = clamp((v - 0.5) / 0.5, 0, 1);
      wB.position.set(lerp(d, -d, suave(f1)), 0, 0);
      wB.quaternion.slerpQuaternions(new T.Quaternion(), vista.qT, suave(f2));
      void wA;
      vista.plano.visible = vista.linea.visible = v < 0.02;
      const fin = v >= 0.995;
      vista.halos.forEach((h, i) => { h.visible = fin; h.material.color.set(vista.coin[i] ? 0x2ee59d : 0xff3da6); h.material.opacity = vista.coin[i] ? 0.28 : 0.5; });
      vista.wraps.forEach((w) => w.updateMatrixWorld(true));
      lect.replaceChildren();
      const n = vista.molA.atomos.length;
      if (v < 0.02) lect.append(el('span', { style: { color: K.m } }, '¿Se puede superponer B sobre A? Prueba con el deslizador.'));
      else if (v < 0.5) lect.append('1 · Traslado B sobre A (sin girarla ni reflejarla)…');
      else if (!fin) lect.append('2 · Giro B para hacer coincidir el Cl y el Br…');
      else if (vista.nCoin === n) lect.append(el('span', { style: { color: K.v } }, '✔ Los ' + n + ' átomos coinciden: se superponen → B es la misma molécula (no es quiral: tiene dos H iguales).'));
      else lect.append(el('span', { style: { color: K.m } }, '✖ Solo coinciden ' + vista.nCoin + ' de ' + n + ' átomos (halo verde); H y F están intercambiados (halo rosa) → NO se superponen: son enantiómeros.'));
      esc.pedirRender();
    }
    cargar('idea');
    const ordenPasos = ['idea', 'cadena', 'posicion', 'funcion', 'cistrans', 'enant', 'enant'];
    return {
      ir(n) {
        const t = ordenPasos[clamp(n, 0, ordenPasos.length - 1)];
        if (t !== tipo) cargar(t);
        if (n === 5) { anim = null; ctr.sl.set(0); setS(0); }
        if (n === 6 && tipo === 'enant' && s < 0.02) { if (api.reducido) { setS(1); ctr.sl.set(100); } else animar(); }
      },
      dispose() { muerto = true; anim = null; limpiar(); esc.dispose(); host.replaceChildren(); },
    };
  }

  registrar({
    id: 'isomeria', capitulos: ['synthese-organique'],
    titulo: 'Isomería: misma fórmula, distinta molécula', fr: 'Isomérie',
    resumen: 'Isómeros de constitución (cadena, posición, función; cours p. 232, fig. 3) y, como ampliación, estereoisómeros: cis/trans y enantiómeros con la prueba de la imagen especular.',
    pagina_pdf: 232,
    pasos: [
      { titulo: 'Misma fórmula bruta, ¿misma molécula?', texto: 'Dos isómeros tienen la misma fórmula bruta pero átomos unidos de forma distinta. Ejemplo de apoyo (no sale en el cours): el butano y el 2-metilpropano son C₄H₁₀ los dos, y sin embargo uno es una cadena lineal y el otro una cadena ramificada. Gíralas con el ratón.', fr: 'Des isomères ont la même formule brute mais des formules développées différentes.' },
      { titulo: 'Isómeros de constitución: de cadena', texto: 'Cours p. 232, fig. 3. El esqueleto carbonado es distinto: etanoato de metilo (C–C(=O)–O–C) y metanoato de etilo (C(=O)–O–C–C) son ambos C₃H₆O₂. Cuenta los átomos: la fórmula bruta coincide, el encadenamiento no.', fr: 'Isomères de chaînes : squelette carboné différent.' },
      { titulo: 'Isómeros de constitución: de posición', texto: 'Cours p. 232, fig. 3: el grupo característico (aquí el C=O) o una insaturación ocupan otra posición. En la figura del cours: butan-2-ona frente a butanal, C₄H₈O los dos.', fr: 'Isomères de position : position différente d’un groupe caractéristique ou d’une insaturation.' },
      { titulo: 'Isómeros de constitución: de función', texto: 'Cours p. 232, fig. 3: los grupos característicos son diferentes. El etanoato de metilo (éster) y el ácido propanoico (ácido carboxílico) son C₃H₆O₂, pero sus propiedades físicas, químicas y biológicas difieren.', fr: 'Isomères de fonction : groupes caractéristiques différents.' },
      { titulo: 'Ampliación · cis / trans (estereoisomería)', texto: 'El cours de este capítulo solo desarrolla la isomería de constitución; esto es una ampliación apoyada en la fiche méthode 14 (p. 566: los modelos moleculares permiten ver la disposición 3D). En el but-2-eno el doble enlace C=C impide girar: los dos CH₃ pueden estar del mismo lado (cis, Z) o de lados opuestos (trans, E). Mismos enlaces, distinta disposición.', fr: 'Fiche méthode 14 : les modèles moléculaires rendent compte de l’arrangement en trois dimensions.' },
      { titulo: 'Ampliación · enantiómeros: imagen especular', texto: 'Un carbono con cuatro sustituyentes distintos (H, F, Cl, Br) puede colocarlos de dos maneras. La molécula B es la imagen de A en un espejo (plano rosa). ¿Serán la misma molécula? Gira la escena y compáralas.', fr: 'Deux molécules images l’une de l’autre dans un miroir.' },
      { titulo: 'La prueba: ¿se superponen?', texto: 'Desliza B sobre A y gírala. Con CHFClBr solo coinciden Cl, Br y C: H y F quedan intercambiados, así que A y B NO se superponen: son enantiómeros. Pulsa «Molécula» para cambiar a CH₂ClBr (dos H iguales): ahora sí coinciden los cinco átomos y no hay enantiómeros.', fr: 'Des énantiomères sont non superposables (molécule chirale).' },
    ],
    montar: montarIsomeria,
    test: [
      { pregunta: 'El etanoato de metilo (éster) y el ácido propanoico (ácido carboxílico) son ambos C₃H₆O₂. ¿Qué tipo de isómeros son?', opciones: ['De cadena', 'De función', 'Enantiómeros'], correcta: 1, explicacion: 'Tienen grupos característicos diferentes (éster / ácido carboxílico): isómeros de función (cours p. 232, fig. 3).' },
      { pregunta: 'En la escena del but-2-eno (cis y trans), ¿qué los distingue?', opciones: ['La fórmula bruta', 'El orden en que se unen los átomos', 'La disposición de los CH₃ en el espacio'], correcta: 2, explicacion: 'Tienen la misma fórmula y los mismos enlaces; lo que cambia es dónde están los CH₃ respecto al doble enlace (estereoisómeros).' },
      { pregunta: 'Al deslizar B (imagen especular de CHFClBr) sobre A y girarla, ¿qué pasa?', opciones: ['Coinciden los 5 átomos', 'Coinciden Cl y Br pero H y F quedan intercambiados: no se superponen', 'B se convierte en una molécula distinta con otra fórmula'], correcta: 1, explicacion: 'Una molécula quiral y su imagen especular no se superponen: son enantiómeros. Con dos H iguales (CH₂ClBr) sí se superpondrían.' },
    ],
  });

  // =============================================================================================================
  // 6 · sens-evolution
  // =============================================================================================================
  const sup = (n) => String(n).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
  const fK = (K) => {
    if (K >= 1000 || K < 0.01) { const e = Math.floor(Math.log10(K) + 1e-9), m = K / Math.pow(10, e); return (Math.abs(m - 1) < 0.05 ? '' : fnum(m, 1) + '×') + '10' + sup(e); }
    return fnum(K, K < 10 ? 2 : 1).replace(/,00$/, '').replace(/(,\d)0$/, '$1');
  };
  const poisson = (lam) => { if (lam <= 0) return 0; if (lam > 30) return Math.round(lam); let L = Math.exp(-lam), p = 1, k = 0; do { k++; p *= Math.random(); } while (p > L); return k - 1; };

  // ---------- 1 · Equilibrio dinámico (cours p. 160: transformation totale / non totale, état d'équilibre dynamique)
  function montarEquilibrio(host, api) {
    const N0 = 40, BX = { x0: 18, y0: 50, x1: 478, y1: 318 }, KF = 0.6;
    let logK = 4, desdeProd = false, P = [], cnt = {}, hist = [], ev = [], tSim = 0, ultH = 0, mostrarQ = false;
    const COL = { A: K.v, B: K.az, C: K.m, D: K.am };
    const R = rng(11);
    const contar = () => { cnt = { A: 0, B: 0, C: 0, D: 0 }; P.forEach((p) => cnt[p.tp]++); };
    function reiniciar() {
      P = []; tSim = 0; hist = []; ev = []; ultH = 0;
      const mk = (tp) => P.push({ tp, x: lerp(BX.x0 + 10, BX.x1 - 10, R()), y: lerp(BX.y0 + 10, BX.y1 - 10, R()), vx: 0, vy: 0, fl: 0 });
      for (let i = 0; i < N0; i++) { mk(desdeProd ? 'C' : 'A'); mk(desdeProd ? 'D' : 'B'); }
      contar(); hist.push([0, cnt.C]); S.pedir();
    }
    function cambiar(de, a, n) { // convierte n partículas del tipo `de` en `a`
      const l = P.filter((p) => p.tp === de); for (let i = 0; i < n && l.length; i++) { const j = Math.floor(Math.random() * l.length); const p = l.splice(j, 1)[0]; p.tp = a; p.fl = 0.45; }
    }
    function tick(dt) {
      contar(); const Kv = Math.pow(10, logK), kr = KF / Kv;
      let nf = poisson((KF * cnt.A * cnt.B / N0) * dt), nr = poisson((kr * cnt.C * cnt.D / N0) * dt);
      nf = Math.min(nf, cnt.A, cnt.B); nr = Math.min(nr, cnt.C, cnt.D);
      if (nf) { cambiar('A', 'C', nf); cambiar('B', 'D', nf); for (let i = 0; i < nf; i++) ev.push([tSim, 1]); }
      if (nr) { cambiar('C', 'A', nr); cambiar('D', 'B', nr); for (let i = 0; i < nr; i++) ev.push([tSim, -1]); }
      tSim += dt; contar();
      while (ev.length && ev[0][0] < tSim - 3) ev.shift();
      if (tSim - ultH >= 0.2) { hist.push([tSim, cnt.C]); ultH = tSim; }
    }
    function mover(dt) {
      P.forEach((p) => {
        p.vx = clamp(p.vx * 0.97 + (Math.random() - 0.5) * 900 * dt, -55, 55); p.vy = clamp(p.vy * 0.97 + (Math.random() - 0.5) * 900 * dt, -55, 55);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < BX.x0 + 8) { p.x = BX.x0 + 8; p.vx = Math.abs(p.vx); } if (p.x > BX.x1 - 8) { p.x = BX.x1 - 8; p.vx = -Math.abs(p.vx); }
        if (p.y < BX.y0 + 8) { p.y = BX.y0 + 8; p.vy = Math.abs(p.vy); } if (p.y > BX.y1 - 8) { p.y = BX.y1 - 8; p.vy = -Math.abs(p.vy); }
        if (p.fl > 0) p.fl -= dt;
      });
    }
    function avanzar(seg) { for (let t = 0; t < seg; t += 0.05) tick(0.05); }
    const ctl = barra(host, [
      { t: 'slider', id: 'k', txt: 'K', min: -1, max: 4, step: 0.1, val: logK, fmt: (v) => fK(Math.pow(10, v)), on: (v) => { logK = v; reiniciar(); } },
      { t: 'tog', id: 'prod', txt: 'Empezar con C y D', val: false, on: (v) => { desdeProd = v; reiniciar(); } },
      { t: 'btn', id: 'rei', txt: '↺ Reiniciar', on: () => reiniciar() },
      { t: 'btn', id: 'av', txt: 'Avanzar ▶▶', on: () => { avanzar(2); S.pedir(); } },
    ]);
    ctl.av.style.display = api.reducido ? '' : 'none';
    const S = lienzo(host, api, {
      alt: 'Reacción A + B ⇌ C + D: partículas que se convierten en los dos sentidos, curvas de cantidad y velocidades v1 y v2.',
      paso(dt) { if (!api.reducido) { tick(dt); } if (!api.reducido) mover(dt); return !api.reducido; },
      dibujar(S) {
        const c = S.ctx, Kv = Math.pow(10, logK);
        S.txt(Kv >= 300 ? 'A + B  →  C + D   (transformación total)' : 'A + B  ⇌  C + D   (no total)', 18, 26, { size: 18, weight: 700, color: Kv >= 300 ? K.v : K.m });
        c.fillStyle = '#0d1530'; c.strokeStyle = K.gris; c.lineWidth = 2; rrect(c, BX.x0, BX.y0, BX.x1 - BX.x0, BX.y1 - BX.y0, 10); c.fill(); c.stroke();
        P.forEach((p) => {
          if (p.fl > 0 && !api.reducido) { c.fillStyle = 'rgba(255,255,255,' + p.fl * 1.4 + ')'; c.beginPath(); c.arc(p.x, p.y, 11, 0, 6.3); c.fill(); }
          bola(c, p.x, p.y, 6.5, COL[p.tp]);
        });
        // leyenda
        ['A', 'B', 'C', 'D'].forEach((t, i) => { const x = 40 + i * 78; bola(c, x, 342, 6, COL[t]); S.txt(t + ' · ' + cnt[t], x + 12, 342, { size: 14 }); });
        const x = desdeProd ? N0 - cnt.C : cnt.C, tau = x / N0;
        const Qr = cnt.A * cnt.B > 0 ? (cnt.C * cnt.D) / (cnt.A * cnt.B) : Infinity;
        S.txt(desdeProd ? 'avance (sentido inverso) x = ' + x : 'x = ' + x + ' · xmax = ' + N0 + ' · τ = x/xmax = ' + fnum(tau, 2), 18, 368, { size: 14, color: K.txt });
        S.txt('Qr = ' + (isFinite(Qr) ? fnum(Qr, Qr < 100 ? 1 : 0) : '∞') + '   ·   K = ' + fK(Kv), 18, 390, { size: mostrarQ ? 17 : 14, weight: 700, color: mostrarQ ? K.am : K.tx2 });
        // gráfica n(t)
        const gx = 512, gy = 56, gw = 262, gh = 160, T0 = Math.max(0, tSim - 40), Tn = 40;
        S.txt('Cantidad de materia (nº de partículas)', gx, 40, { size: 13, color: K.tx2 });
        c.strokeStyle = K.gris; c.lineWidth = 1.5; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx, gy + gh); c.lineTo(gx + gw, gy + gh); c.stroke();
        S.txt('t →', gx + gw - 2, gy + gh + 13, { size: 12, color: K.tx2, align: 'right' });
        const Y = (n) => gy + gh - (n / N0) * gh, X = (t) => gx + ((t - T0) / Tn) * gw;
        c.setLineDash([5, 4]); c.strokeStyle = '#ffffff55'; c.beginPath(); c.moveTo(gx, Y(N0)); c.lineTo(gx + gw, Y(N0)); c.stroke();
        const eq = N0 * Math.sqrt(Kv) / (1 + Math.sqrt(Kv)); c.strokeStyle = K.m + '99'; c.beginPath(); c.moveTo(gx, Y(eq)); c.lineTo(gx + gw, Y(eq)); c.stroke(); c.setLineDash([]);
        S.txt('xmax', gx + gw, gy - 8, { size: 12, color: '#ffffffaa', align: 'right' });
        const curva = (f, col) => { c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); let ini = true; hist.forEach((h) => { if (h[0] < T0) return; const px = X(h[0]), py = Y(f(h)); if (ini) { c.moveTo(px, py); ini = false; } else c.lineTo(px, py); }); c.stroke(); };
        curva((h) => N0 - h[1], K.v); curva((h) => h[1], K.m);
        S.txt('reactivos', gx + gw - 4, gy + 14, { size: 13, color: K.v, align: 'right' }); S.txt('productos', gx + gw - 4, gy + 30, { size: 13, color: K.m, align: 'right' });
        // velocidades
        let v1 = 0, v2 = 0; ev.forEach((e) => { if (e[1] > 0) v1++; else v2++; }); const dtv = Math.max(0.5, Math.min(3, tSim)); v1 /= dtv; v2 /= dtv;
        S.txt('Velocidades (reacciones por segundo)', gx, 252, { size: 13, color: K.tx2 });
        [['v₁ directa →', v1, K.v, 274], ['v₂ inversa ←', v2, K.m, 308]].forEach(([n, v, col, y]) => {
          S.txt(n, gx, y, { size: 13, color: col }); c.fillStyle = '#16204a'; c.fillRect(gx + 92, y - 8, 140, 16); c.fillStyle = col; c.fillRect(gx + 92, y - 8, clamp(v / 6, 0, 1) * 140, 16);
          S.txt(fnum(v, 1), gx + 238, y, { size: 13 });
        });
        const igual = tSim > 6 && Kv < 300 && Math.abs(v1 - v2) < 1.6;
        if (igual) S.txt('v₁ ≈ v₂ : equilibrio dinámico', gx, 336, { size: 14, weight: 700, color: K.am });
      },
    });
    reiniciar();
    return {
      ir(n) {
        mostrarQ = n === 3;
        const fijar = (lk, prod) => { logK = lk; desdeProd = prod; ctl.k.set(lk); ctl.prod.setAttribute('aria-pressed', String(prod)); reiniciar(); };
        if (n === 0) fijar(4, false);
        else if (n === 1) fijar(Math.log10(4), false);
        else if (n === 2 || n === 3) { if (Math.abs(logK - Math.log10(4)) > 0.05 || desdeProd || tSim < 12) { fijar(Math.log10(4), false); avanzar(14); } }
        else if (n === 4) fijar(Math.log10(4), true);
        S.pedir();
      },
      dispose() { S.dispose(); host.replaceChildren(); },
    };
  }
  registrar({
    id: 'equilibrio-dinamico', capitulos: ['sens-evolution'],
    titulo: 'Equilibrio dinámico: la reacción nunca para', fr: 'État d’équilibre dynamique',
    resumen: 'Una transformación puede ser total (se agota el reactivo limitante) o no total (reactivos y productos a la vez). En el equilibrio las reacciones directa e inversa siguen ocurriendo con v₁ = v₂.',
    pagina_pdf: 160,
    pasos: [
      { titulo: 'Transformación total', texto: 'Con K muy grande, el reactivo limitante se consume por completo: el avance final es el máximo, xf = xmax y τ = 1. Las partículas verdes y azules se acaban. (Cours p. 160.)', fr: 'Transformation totale : xf = xmax.' },
      { titulo: 'Transformación no total (K = 4,0)', texto: 'Con K = 4,0 (valor de la esterificación del ejercicio 28, p. 168) la reacción se detiene antes: quedan reactivos y productos a la vez, xf < xmax, τ < 1. Se escribe con doble flecha ⇌. (p. 160)', fr: 'Transformation non totale : xf < xmax, τ < 1.' },
      { titulo: 'Equilibrio: v₁ = v₂, pero nada se detiene', texto: 'Las cantidades dejaron de cambiar, pero mira los destellos: siguen convirtiéndose partículas en los dos sentidos. Las barras de velocidad v₁ (directa) y v₂ (inversa) se igualan. Equilibrio ≠ «todo se detiene» (error típico, p. 170).', fr: 'Les réactions directe et opposée se compensent exactement (v₁ = v₂).' },
      { titulo: 'En el equilibrio, Qr = K', texto: 'El cociente de reacción Qr = [C][D]/([A][B]) fluctúa alrededor de K(T) en el equilibrio: K es precisamente el valor de Qr en el estado de equilibrio dinámico. (p. 161)', fr: 'K(T) est la valeur de Qr à l’équilibre.' },
      { titulo: 'El mismo equilibrio desde los productos', texto: 'Empezando solo con C y D, el sistema evoluciona en sentido inverso y acaba en el mismo reparto. K depende de la ecuación y de la temperatura, no de la composición inicial. Prueba a mover K.', fr: 'K ne dépend que de l’équation et de la température.' },
    ],
    montar: montarEquilibrio,
    test: [
      { pregunta: 'Cuando se alcanza el equilibrio, ¿qué ocurre con las reacciones directa e inversa?', opciones: ['Ambas se detienen', 'Siguen ocurriendo a la misma velocidad', 'Solo sigue la directa'], correcta: 1, explicacion: 'Equilibrio dinámico: v₁ = v₂; las cantidades no cambian pero las dos reacciones continúan.' },
      { pregunta: 'Si empiezas solo con C y D (misma K), ¿a qué reparto llega el sistema?', opciones: ['A todo reactivos', 'Al mismo reparto de equilibrio', 'A todo productos'], correcta: 1, explicacion: 'K(T) solo depende de la ecuación y de T, no de la composición inicial.' },
    ],
  });

  // ---------- 2 · Qr frente a K (cours p. 161: critère d'évolution spontanée)
  function montarQK(host, api) {
    let logK = 1, logQ = -2, b = 0, evol = false, showK = true, ultimo = 0, nombreQ = 'Qr,i';
    const b0 = () => { const q = Math.pow(10, logQ), r = Math.sqrt(q); return r / (1 + r); };
    const bEq = () => { const r = Math.sqrt(Math.pow(10, logK)); return r / (1 + r); };
    const Qb = () => Math.pow(b / (1 - b), 2);
    function reset() { b = b0(); evol = false; nombreQ = 'Qr,i'; S.pedir(); }
    const ctl = barra(host, [
      { t: 'slider', id: 'q', txt: 'Qr,i', min: -3, max: 3, step: 0.1, val: logQ, fmt: (v) => fK(Math.pow(10, v)), on: (v) => { logQ = v; reset(); } },
      { t: 'slider', id: 'k', txt: 'K', min: -2, max: 3, step: 0.1, val: logK, fmt: (v) => fK(Math.pow(10, v)), on: (v) => { logK = v; if (evol) { reset(); } S.pedir(); } },
      { t: 'btn', id: 'go', txt: '▶ Dejar evolucionar', on: () => { if (Math.abs(b - bEq()) < 0.002) reset(); evol = true; nombreQ = 'Qr'; if (api.reducido) { b = bEq(); evol = false; } S.pedir(); } },
      { t: 'btn', id: 'rei', txt: '↺', on: () => reset() },
    ]);
    const AX = { x0: 60, x1: 740, y: 150 }, LO = -3.4, HI = 3.4;
    const X = (lg) => lerp(AX.x0, AX.x1, (clamp(lg, LO, HI) - LO) / (HI - LO));
    const S = lienzo(host, api, {
      alt: 'Eje logarítmico con el valor de K y del cociente de reacción Qr; flecha del sentido de evolución.',
      paso(dt) { if (!evol) return false; b += (bEq() - b) * Math.min(1, 1.4 * dt); if (Math.abs(b - bEq()) < 0.0015) { b = bEq(); evol = false; } return evol; },
      dibujar(S) {
        const c = S.ctx, dif = logQ - logK, igual = Math.abs(dif) < 0.05;
        S.txt('A + B  ⇌  C + D        Qr = [C]·[D] / ([A]·[B])', 400, 28, { size: 18, weight: 700, align: 'center' });
        // banner de decisión
        let msg = 'Qr,i = K → ya está en equilibrio: no evoluciona', col = K.am, dir = 0;
        if (!igual) { if (dif < 0) { msg = 'Qr,i < K  →  evoluciona en el sentido directo (→)'; col = K.v; dir = 1; } else { msg = 'Qr,i > K  →  evoluciona en el sentido opuesto (←)'; col = K.m; dir = -1; } }
        if (!showK) { msg = 'Qr mide la composición del sistema en cada instante'; col = K.tx2; dir = 0; }
        S.txt(msg, 400, 66, { size: 17, weight: 700, color: col, align: 'center' });
        // eje log
        c.strokeStyle = K.tx2; c.lineWidth = 2; c.beginPath(); c.moveTo(AX.x0, AX.y); c.lineTo(AX.x1, AX.y); c.stroke();
        for (let e = -3; e <= 3; e++) { const x = X(e); c.beginPath(); c.moveTo(x, AX.y - 5); c.lineTo(x, AX.y + 5); c.stroke(); S.txt('10' + sup(e), x, AX.y + 22, { size: 13, color: K.tx2, align: 'center' }); }
        if (showK) {
          const xk = X(logK); c.strokeStyle = K.m; c.lineWidth = 3; c.beginPath(); c.moveTo(xk, AX.y - 46); c.lineTo(xk, AX.y + 8); c.stroke();
          S.txt('K(T) = ' + fK(Math.pow(10, logK)), xk, AX.y - 56, { size: 15, weight: 700, color: K.m, align: 'center' });
          if (dir && !evol && Math.abs(b - b0()) < 0.001) { const xq = X(logQ), xe = X(logK); flecha(c, xq + (dir > 0 ? 14 : -14), AX.y + 52, xe - (dir > 0 ? 8 : -8), AX.y + 52, col, 3, 11); }
        }
        const lq = Math.log10(Qb()), xq = X(lq);
        c.fillStyle = K.v; c.beginPath(); c.arc(xq, AX.y, 10, 0, 6.3); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
        S.txt(nombreQ + ' = ' + fK(Qb()), xq, AX.y - 26, { size: 14, weight: 700, color: K.v, align: 'center', halo: true });
        // recipientes: barras de reactivos y productos
        const bx = [[200, 1 - b, K.v, '[A] = [B]'], [440, b, K.m, '[C] = [D]']];
        bx.forEach(([x, v, col, n]) => {
          c.fillStyle = '#0d1530'; c.strokeStyle = K.gris; c.lineWidth = 2; rrect(c, x, 240, 160, 150, 6); c.fill(); c.stroke();
          c.fillStyle = col + 'cc'; const h = clamp(v, 0, 1) * 144; c.fillRect(x + 3, 387 - h, 154, h);
          S.txt(n + ' = ' + fnum(v, 2), x + 80, 262, { size: 14, weight: 700, align: 'center', halo: true });
        });
        S.txt('reactivos', 280, 405, { size: 13, color: K.v, align: 'center' }); S.txt('productos', 520, 405, { size: 13, color: K.m, align: 'center' });
        if (Math.abs(b - bEq()) < 0.002 && showK) S.txt('Qr = K: fin de la evolución', 400, 210, { size: 15, weight: 700, color: K.am, align: 'center' });
        else if (showK) flecha(c, 365, 316, 435, 316, K.v, 2.5, 9), flecha(c, 435, 340, 365, 340, K.m, 2.5, 9);
      },
    });
    reset();
    return {
      ir(n) {
        showK = n >= 1;
        const f = (lq, lk) => { logQ = lq; logK = lk; ctl.q.set(lq); ctl.k.set(lk); reset(); };
        if (n === 0) f(-1.5, 1); else if (n === 1) f(-1.5, 1);
        else if (n === 2) { f(-2.2, 1); if (!api.reducido) setTimeout(() => { if (!evol) ctl.go.click(); }, 900); else { ctl.go.click(); } }
        else if (n === 3) { f(2.4, 1); if (!api.reducido) setTimeout(() => { if (!evol) ctl.go.click(); }, 900); else { ctl.go.click(); } }
        else if (n === 4) f(1, 1);
        S.pedir();
      },
      dispose() { S.dispose(); host.replaceChildren(); },
    };
  }
  registrar({
    id: 'q-vs-k', capitulos: ['sens-evolution'],
    titulo: 'Qr frente a K: ¿hacia dónde evoluciona?', fr: 'Critère d’évolution spontanée',
    resumen: 'Se compara el cociente de reacción inicial Qr,i con K(T): si Qr,i < K evoluciona en sentido directo, si Qr,i > K en el opuesto, y se detiene cuando Qr = K.',
    pagina_pdf: 161,
    pasos: [
      { titulo: 'Qr: una fotografía de la composición', texto: 'El cociente de reacción Qr se calcula con las concentraciones de productos y reactivos (cada una elevada a su coeficiente; sólidos y disolvente se sustituyen por 1). Es la bolita verde sobre un eje logarítmico. (p. 160)', fr: 'Quotient de réaction Qr.' },
      { titulo: 'K(T): el valor de Qr en el equilibrio', texto: 'La línea rosa es la constante de equilibrio K(T): el valor que toma Qr en el equilibrio. Solo depende de la ecuación y de la temperatura. (p. 161)', fr: 'Constante d’équilibre K(T).' },
      { titulo: 'Qr,i < K → sentido directo', texto: 'Qr,i está a la izquierda de K: faltan productos, así que la reacción avanza en sentido directo (→), los productos aumentan y Qr sube hasta alcanzar K. Mira las barras. (p. 161)', fr: 'Qr,i < K : évolution dans le sens direct.' },
      { titulo: 'Qr,i > K → sentido opuesto', texto: 'Ahora Qr,i está a la derecha de K: sobran productos, y el sistema evoluciona en el sentido opuesto (←) hasta que Qr baja a K. (p. 161; error típico: invertir el criterio, p. 170.)', fr: 'Qr,i > K : évolution dans le sens opposé.' },
      { titulo: 'Qr,i = K → ya está en equilibrio', texto: 'Si Qr,i = K no hay evolución. Mueve tú los dos deslizadores (Qr,i y K) y pulsa «Dejar evolucionar»: la bolita siempre va hacia K y se para ahí.', fr: 'Qr,i = K : le système est déjà à l’équilibre.' },
    ],
    montar: montarQK,
    test: [
      { pregunta: 'Si Qr,i = 0,01 y K = 10, ¿en qué sentido evoluciona el sistema?', opciones: ['Directo (→)', 'Opuesto (←)', 'No evoluciona'], correcta: 0, explicacion: 'Qr,i < K → sentido directo; los productos aumentan hasta que Qr = K.' },
      { pregunta: 'Cuando el sistema evoluciona, ¿qué valor toma Qr al final?', opciones: ['Cero', 'K(T)', 'El valor inicial'], correcta: 1, explicacion: 'La evolución se detiene cuando Qr = K(T).' },
    ],
  });

  // ---------- 3 · Pila (cours p. 161–162: demi-piles, pont salin, mouvement des porteurs de charge, pile usée)
  function montarPila(host, api) {
    let cerrado = false, alfa = 0, alvo = 0, anim = false, hl = '', verEq = false, verI = false, aviso = 0;
    const KP = 37.3; // log10 K de Cu²⁺ + Zn ⇌ Cu + Zn²⁺ = 2×10³⁷ (p. 158)
    const R = rng(5);
    const iones = []; for (let i = 0; i < 26; i++) iones.push({ u: R(), v: R(), ph: R() * 6.28 });
    const ctl = barra(host, [
      { t: 'tog', id: 'sw', txt: 'Interruptor cerrado', val: false, on: (v) => { cerrado = v; S.pedir(); } },
      { t: 'slider', id: 'al', txt: 'Avance', min: 0, max: 100, step: 1, val: 0, fmt: (v) => v + ' %', on: (v) => { if (!cerrado) { ctl.al.set(Math.round(alfa * 100)); aviso = 2; } else { alfa = alvo = v / 100; } S.pedir(); } },
      { t: 'btn', id: 'run', txt: '▶ Funcionar', on: () => { if (!cerrado) { ctl.sw.click(); } alvo = 1; anim = true; S.pedir(); } },
      { t: 'btn', id: 'rei', txt: '↺', on: () => { alfa = alvo = 0; ctl.al.set(0); S.pedir(); } },
    ]);
    const Qlog = (a) => Math.log10((1 + a) / (1 - a + 1e-38));
    const S = lienzo(host, api, {
      alt: 'Pila cobre-zinc: dos semipilas, puente salino, hilo con lámpara, electrones del Zn al Cu y estado de la pila.',
      continuo: !api.reducido,
      paso(dt) {
        if (aviso > 0) aviso -= dt;
        if (anim || Math.abs(alvo - alfa) > 0.001) {
          const v = api.reducido ? 1 : 0.1; if (alvo > alfa) alfa = Math.min(alvo, alfa + v * dt * (anim ? 1 : 3)); else alfa = Math.max(alvo, alfa - 0.4 * dt);
          ctl.al.set(Math.round(alfa * 100)); if (alfa >= alvo) anim = false; if (api.reducido) { alfa = alvo; anim = false; }
        }
        return !api.reducido || anim;
      },
      dibujar(S) {
        const c = S.ctx, t = S.t, a = clamp(alfa, 0, 1), fin = a >= 0.999;
        const lq = a >= 0.999 ? KP : Math.min(KP, Qlog(a)), prog = lq / KP; // posición del marcador Qr en el medidor
        const flujo = cerrado && !fin;
        // vasos
        const vasos = [[70, 'Zn²⁺', K.az], [400, 'Cu²⁺', '#35c8ff']];
        vasos.forEach(([x, n, col], i) => {
          const conc = i === 0 ? 0.25 + 0.75 * a : 1 - a; // [Zn²⁺] sube, [Cu²⁺] baja
          c.fillStyle = col + Math.round(clamp(conc, 0.05, 1) * 70).toString(16).padStart(2, '0'); c.fillRect(x, 218, 220, 142);
          c.strokeStyle = '#c9d3ff'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, 190); c.lineTo(x, 360); c.lineTo(x + 220, 360); c.lineTo(x + 220, 190); c.stroke();
          const nI = Math.round((i === 0 ? 6 + 14 * a : 20 * (1 - a) + 1)); const jit = api.reducido ? 0 : 1;
          for (let k = 0; k < nI; k++) { const q = iones[(k + i * 9) % iones.length]; const px = x + 14 + q.u * 192 + Math.sin(t * 1.3 + q.ph) * 6 * jit, py = 232 + q.v * 118 + Math.cos(t * 1.1 + q.ph) * 6 * jit; if (Math.abs(px - (i === 0 ? 165 : 495)) < 22) continue; bola(c, px, py, 6, col); }
          S.txt(n + '(aq)', x + 110, 376, { size: 14, weight: 700, color: col, align: 'center' });
        });
        // electrodos
        const wz = 26 - 12 * a, wc = 20 + 18 * a;
        c.fillStyle = '#8f9bb8'; c.fillRect(165 - wz / 2, 110, wz, 250); c.fillStyle = '#d9822b'; c.fillRect(495 - wc / 2, 110, wc, 250);
        S.txt('Zn(s)', 165, 102, { size: 14, weight: 700, align: 'center', halo: true }); S.txt('Cu(s)', 495, 102, { size: 14, weight: 700, align: 'center', halo: true });
        S.txt('− borne negativo', 135, 80, { size: 12, color: K.m, align: 'center' }); S.txt('+ borne positivo', 540, 80, { size: 12, color: K.v, align: 'center' });
        // puente salino
        const hb = hl === 'puente' ? 1 : 0;
        c.strokeStyle = hb ? K.am : '#e0e6ff'; c.lineWidth = hb ? 5 : 3; c.fillStyle = '#3a4a85aa';
        c.beginPath(); c.moveTo(250, 250); c.lineTo(250, 196); c.lineTo(450, 196); c.lineTo(450, 250); c.lineWidth = 16; c.strokeStyle = hb ? K.am + '66' : '#3a4a85'; c.stroke();
        c.lineWidth = 3; c.strokeStyle = hb ? K.am : '#e0e6ff'; c.beginPath(); c.moveTo(242, 250); c.lineTo(242, 190); c.lineTo(458, 190); c.lineTo(458, 250); c.stroke(); c.beginPath(); c.moveTo(258, 250); c.lineTo(258, 202); c.lineTo(442, 202); c.lineTo(442, 250); c.stroke();
        S.txt('puente salino', 350, 178, { size: 13, color: hb ? K.am : K.tx2, align: 'center', weight: hb ? 700 : 600 });
        if (flujo) for (let k = 0; k < 6; k++) { // cationes → hacia Cu (+), aniones → hacia Zn (−)
          const u = (t * 0.25 + k / 6) % 1, len = 200, px = 250 + u * len; const y = 196;
          if (px > 250 && px < 450) { bola(c, px, y, 6, K.az); S.txt('+', px, y, { size: 12, color: '#001', align: 'center' }); const pa = 450 - u * len; bola(c, pa, y + 0.01, 0.1, '#000'); bola(c, pa, y, 6, K.am); S.txt('−', pa, y, { size: 12, color: '#001', align: 'center' }); }
        }
        // hilo y lámpara
        c.strokeStyle = '#e0e6ff'; c.lineWidth = 3; c.beginPath(); c.moveTo(165, 110); c.lineTo(165, 56); c.lineTo(285, 56); c.moveTo(375, 56); c.lineTo(495, 56); c.lineTo(495, 110); c.stroke();
        const on = flujo; c.fillStyle = on ? '#fff3b0' : '#1b2550'; c.strokeStyle = on ? K.am : '#e0e6ff'; c.lineWidth = 3; if (on) { c.shadowColor = K.am; c.shadowBlur = 22; } c.beginPath(); c.arc(330, 56, 17, 0, 6.3); c.fill(); c.stroke(); c.shadowBlur = 0;
        c.beginPath(); c.moveTo(318, 56); c.lineTo(342, 56); c.stroke();
        c.strokeStyle = '#e0e6ff'; c.lineWidth = 3; c.beginPath(); c.moveTo(285, 56); if (cerrado) c.lineTo(313, 56); else c.lineTo(305, 36); c.stroke(); c.beginPath(); c.moveTo(347, 56); c.lineTo(375, 56); c.stroke();
        S.txt(cerrado ? 'interruptor cerrado' : 'interruptor abierto: no circula corriente', 330, 24, { size: 13, color: cerrado ? K.v : K.tx2, align: 'center' });
        if (flujo) { // electrones: Zn → Cu
          const rec = [[165, 110, 165, 56, 54], [165, 56, 285, 56, 120], [375, 56, 495, 56, 120], [495, 56, 495, 110, 54]], tot = 348;
          for (let k = 0; k < 14; k++) {
            let dd = api.reducido ? k * (tot / 14) : (t * 60 + k * (tot / 14)) % tot, j = 0;
            while (j < 3 && dd > rec[j][4]) { dd -= rec[j][4]; j++; }
            const r = rec[j], f = dd / r[4];
            c.fillStyle = K.am; c.beginPath(); c.arc(lerp(r[0], r[2], f), lerp(r[1], r[3], f), 4.5, 0, 6.3); c.fill();
          }
          flecha(c, 190, 42, 262, 42, K.am, 3, 10); S.txt('e⁻', 226, 30, { size: 14, weight: 700, color: K.am, align: 'center' });
          if (verI) { flecha(c, 470, 72, 398, 72, K.m, 3, 10); S.txt('I', 434, 86, { size: 15, weight: 700, color: K.m, align: 'center' }); }
        } else if (!cerrado && verI) { S.txt('(sin circuito cerrado no hay I ni e⁻ circulando)', 330, 90, { size: 12, color: K.tx2, align: 'center' }); }
        if (verEq) { S.txt('Zn = Zn²⁺ + 2 e⁻ (oxidación)', 180, 397, { size: 13, color: K.m, align: 'center' }); S.txt('Cu²⁺ + 2 e⁻ = Cu (reducción)', 510, 397, { size: 13, color: K.v, align: 'center' }); }
        // medidor Qr → K
        const mx = 700, my0 = 110, my1 = 350;
        S.txt('Qr → K', mx, 82, { size: 14, weight: 700, align: 'center' });
        c.fillStyle = '#16204a'; rrect(c, mx - 12, my0, 24, my1 - my0, 8); c.fill(); c.strokeStyle = K.gris; c.stroke();
        const yq = my1 - prog * (my1 - my0); c.fillStyle = K.v + '88'; c.fillRect(mx - 10, yq, 20, my1 - yq); bola(c, mx, yq, 9, K.v);
        c.strokeStyle = K.m; c.lineWidth = 3; c.beginPath(); c.moveTo(mx - 24, my0); c.lineTo(mx + 24, my0); c.stroke(); S.txt('K = 2×10³⁷', mx, my0 - 12, { size: 12, color: K.m, align: 'center' });
        S.txt('Qr', mx + 18, yq - 2, { size: 13, color: K.v }); S.txt('inicio', mx + 22, my1 + 12, { size: 12, color: K.tx2 });
        S.txt(fin ? 'pila gastada' : 'U = ' + (cerrado || a > 0 ? '↓' : '1,10 V'), mx, 372, { size: 14, weight: 700, color: fin ? K.m : K.am, align: 'center' });
        if (fin) S.txt('Qr = K: pila gastada (U = 0)', 330, 150, { size: 17, weight: 700, color: K.m, align: 'center', halo: true });
        if (aviso > 0) S.txt('Cierra el interruptor: sin circuito no hay transformación', 330, 130, { size: 15, weight: 700, color: K.am, align: 'center', halo: true });
        if (hl === 'semi') { c.strokeStyle = K.am; c.setLineDash([6, 5]); c.lineWidth = 2; c.strokeRect(62, 182, 236, 196); c.strokeRect(392, 182, 236, 196); c.setLineDash([]); S.txt('2 semipilas: cada una = metal + su ion (Mⁿ⁺/M)', 345, 150, { size: 14, weight: 700, color: K.am, align: 'center', halo: true }); }
      },
    });
    return {
      ir(n) {
        hl = n === 0 ? 'semi' : n === 1 ? 'puente' : ''; verEq = n >= 2; verI = n >= 3;
        const cfg = (cer, al) => { cerrado = cer; ctl.sw.setAttribute('aria-pressed', String(cer)); alvo = al; if (n >= 2 && !api.reducido) { alfa = Math.min(alfa, al); } else alfa = al; ctl.al.set(Math.round(alfa * 100)); anim = false; };
        if (n === 0) cfg(false, 0); else if (n === 1) cfg(false, 0); else if (n === 2) cfg(true, 0.3); else if (n === 3) cfg(true, 0.6); else if (n === 4) { cfg(true, 1); if (!api.reducido) { anim = true; } }
        S.pedir();
      },
      dispose() { S.dispose(); host.replaceChildren(); },
    };
  }
  registrar({
    id: 'pila', capitulos: ['sens-evolution'],
    titulo: 'La pila: electrones por el circuito', fr: 'Pile, demi-piles et pont salin',
    resumen: 'Una pila es un sistema fuera de equilibrio: dos semipilas (metal + su ion) unidas por un puente salino. Mientras Qr < K los electrones circulan del reductor al oxidante por el circuito exterior; cuando Qr = K la pila está gastada.',
    pagina_pdf: 161,
    pasos: [
      { titulo: 'Dos semipilas', texto: 'Cada semipila es un metal sumergido en una disolución de su ion: Zn/Zn²⁺ y Cu/Cu²⁺ (pares Mⁿ⁺/M). Con el interruptor abierto no pasa nada: el sistema está fuera de equilibrio (Qr < K = 2×10³⁷) pero no puede evolucionar. (p. 161)', fr: 'Une pile : deux demi-piles reliées par un pont salin.' },
      { titulo: 'El puente salino cierra el circuito', texto: 'El puente salino (papel o membrana con una disolución iónica) cierra el circuito dentro de la pila y mantiene la neutralidad eléctrica de las disoluciones. Sin él (error típico, p. 167) no hay pila.', fr: 'Le pont salin ferme le circuit et assure la neutralité électrique.' },
      { titulo: 'Interruptor cerrado: los electrones salen del reductor', texto: 'Al cerrar, el zinc (reductor) cede electrones: Zn = Zn²⁺ + 2 e⁻ y la placa se gasta; el Cu²⁺ los capta: Cu²⁺ + 2 e⁻ = Cu y la placa crece. Los electrones circulan por el hilo del Zn al Cu y la lámpara se enciende; por el puente se mueven iones. (p. 162)', fr: 'Le réducteur cède des électrons à la borne −, l’oxydant en capte à la borne +.' },
      { titulo: 'Sentido de los electrones y de la corriente', texto: 'Fuera de la pila los electrones van del borne − al borne +; el sentido convencional de la corriente I es el opuesto, del + al −. No los confundas (error típico, p. 169). (p. 162)', fr: 'Le courant électrique va de la borne + à la borne −, les électrons circulent en sens opposé.' },
      { titulo: 'Qr → K: pila gastada', texto: 'Con el funcionamiento Qr crece hasta alcanzar K(T): la pila está gastada. Lo que la limita es el reactivo limitante (aquí casi todo el Cu²⁺ se consume antes de que Qr llegue a K). Pulsa «Funcionar» para verlo. (p. 161)', fr: 'Lorsque Qr = K, la pile est usée.' },
    ],
    montar: montarPila,
    test: [
      { pregunta: 'En el hilo exterior de la pila, ¿hacia dónde circulan los electrones?', opciones: ['Del Cu (+) al Zn (−)', 'Del Zn (−) al Cu (+)', 'No circulan: solo se mueven iones'], correcta: 1, explicacion: 'El reductor (Zn) cede e⁻ al borne −; viajan por el circuito exterior hacia el borne +. La corriente I va en sentido opuesto.' },
      { pregunta: '¿Para qué sirve el puente salino?', opciones: ['Para que circulen electrones', 'Para cerrar el circuito y mantener la neutralidad eléctrica con el movimiento de iones', 'Para calentar la pila'], correcta: 1, explicacion: 'Por el puente se mueven iones (no electrones); cierra el circuito y asegura la neutralidad de las disoluciones.' },
    ],
  });

  // @@MAS@@
})();
