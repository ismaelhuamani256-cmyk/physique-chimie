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

  // @@MAS@@
})();
