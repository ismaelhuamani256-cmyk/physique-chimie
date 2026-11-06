// =====================================================================================
// 40-reaccion.js — MOL3D · reacciones animadas: los átomos se reordenan de reactivos a productos
//
//  PCB.mol3d.reaccion(host, {id | reactivos:['NH3','H3O+'], productos:['NH4+','H2O'], mapa:'0.0>0.0 1.0>1.0', eq, nota,
//                            autoplay:true, velocidad:1})
//      -> {dispose, play(), pause(), reset(), setProgreso(0..1), progreso(), reaccion}
//  Los enlaces que se ROMPEN se estiran y se desvanecen (en rojo); los que se FORMAN aparecen (en verde); cada átomo
//  recorre un camino suave desde su posición en el reactivo hasta su posición en el producto (mapa átomo→átomo).
//  Controles: ▶ ⏸ ↺ y deslizador de progreso. Con «reducir animaciones» no se reproduce sola: el ▶ salta al final.
//
//  Cómo se reparten los átomos: la biblioteca (20-biblioteca.js) da el mapa de los átomos no-H; aquí se orientan los
//  reactivos (búsqueda de orientaciones + ajuste rígido de Horn/Kabsch) para que cada producto se parezca lo más posible
//  a los átomos de partida, y los H «sueltos» (los que pasan de una molécula a otra, como el H⁺) se asignan al sitio de
//  producto más cercano. Resultado: recorridos cortos y fáciles de seguir.
// =====================================================================================
(function () {
  'use strict';
  const PCB = (window.PCB = window.PCB || {});
  const M = (PCB.mol3d = PCB.mol3d || {});
  const T = window.THREE;
  const D = M.datos;
  const el = (tag, attrs, ...kids) => PCB.util.el(tag, attrs, ...kids);
  const reducido = () => { try { return PCB.util.reducedMotion(); } catch (e) { return false; } };

  // ---------- álgebra: cuaterniones, Jacobi simétrico y ajuste rígido de Horn ----------
  const qMat = (q) => { const [w, x, y, z] = q; return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]; };
  const mv = (R, v) => [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]];
  /** Autovalores/autovectores de una matriz simétrica n×n por rotaciones de Jacobi. Devuelve {val, vec[k] = autovector k} */
  function jacobi(A0) {
    const n = A0.length, A = A0.map((r) => r.slice()), V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 30; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-18) break;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-14) continue;
        const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), c = Math.cos(th), s = Math.sin(th);
        for (let k = 0; k < n; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - s * b; A[k][q] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - s * b; A[q][k] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
      }
    }
    return { val: A.map((r, i) => r[i]), vec: A.map((_, k) => V.map((r) => r[k])) };
  }
  /** Mejor rotación+traslación que lleva los puntos A sobre B (método de Horn). Devuelve {R, ca, cb, rmsd2} */
  function ajusteRigido(A, B) {
    const n = A.length, ca = [0, 0, 0], cb = [0, 0, 0];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { ca[k] += A[i][k] / n; cb[k] += B[i][k] / n; }
    let Sxx = 0, Sxy = 0, Sxz = 0, Syx = 0, Syy = 0, Syz = 0, Szx = 0, Szy = 0, Szz = 0;
    for (let i = 0; i < n; i++) {
      const a = [A[i][0] - ca[0], A[i][1] - ca[1], A[i][2] - ca[2]], b = [B[i][0] - cb[0], B[i][1] - cb[1], B[i][2] - cb[2]];
      Sxx += a[0] * b[0]; Sxy += a[0] * b[1]; Sxz += a[0] * b[2]; Syx += a[1] * b[0]; Syy += a[1] * b[1]; Syz += a[1] * b[2]; Szx += a[2] * b[0]; Szy += a[2] * b[1]; Szz += a[2] * b[2];
    }
    const N = [[Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx], [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz], [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy], [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz]];
    const J = jacobi(N); let k = 0; for (let i = 1; i < 4; i++) if (J.val[i] > J.val[k]) k = i;
    const q = J.vec[k], R = qMat(q);
    let r2 = 0;
    for (let i = 0; i < n; i++) { const a = mv(R, [A[i][0] - ca[0], A[i][1] - ca[1], A[i][2] - ca[2]]); for (let c = 0; c < 3; c++) r2 += (a[c] + cb[c] - B[i][c]) ** 2; }
    return { R, ca, cb, rmsd2: r2 / n };
  }

  // ---------- disposición espacial de reactivos y productos ----------
  function disponer(def) {
    const R = def.reactivos, P = def.productos;
    const centrar = (mol) => { const n = mol.atomos.length, c = [0, 0, 0]; mol.atomos.forEach((a) => { c[0] += a.x / n; c[1] += a.y / n; c[2] += a.z / n; }); return mol.atomos.map((a) => [a.x - c[0], a.y - c[1], a.z - c[2]]); };
    const locR = R.map((r) => centrar(r.mol)), locP = P.map((p) => centrar(p.mol));
    const radio = (loc, mol) => loc.reduce((m, v, i) => Math.max(m, Math.hypot(v[0], v[1], v[2]) + D.el(mol.atomos[i].el).rv * 0.45), 0.5);
    const rR = R.map((r, i) => radio(locR[i], r.mol)), rP = P.map((p, i) => radio(locP[i], p.mol));
    // centros de los reactivos en fila (x), con holgura
    const cx = []; { let x = 0; R.forEach((r, i) => { if (i) x += rR[i - 1] + rR[i] + 0.9; cx.push(x); }); const mid = (cx[cx.length - 1] || 0) / 2; for (let i = 0; i < cx.length; i++) cx[i] -= mid; }
    const nR = def.atomosR.length, nP = def.atomosP.length;
    const mapa = def.mapa.slice();
    // candidatos de orientación: identidad + cuaterniones pseudoaleatorios (semilla fija → resultado reproducible)
    const rnd = (PCB.util && PCB.util.rng) ? PCB.util.rng(20240611) : Math.random;
    const cands = [[1, 0, 0, 0]]; for (let i = 0; i < 150; i++) { const g = () => (rnd() + rnd() + rnd() + rnd() - 2); const q = [g(), g(), g(), g()], l = Math.hypot(...q) || 1; cands.push(q.map((v) => v / l)); }
    let orient = R.map(() => [1, 0, 0, 0]);
    const posRde = (or) => { const out = new Array(nR); R.forEach((r, k) => { const Rm = qMat(or[k]); locR[k].forEach((v, i) => { const w = mv(Rm, v); out[r.base + i] = [w[0] + cx[k], w[1], w[2]]; }); }); return out; };
    const inv = () => { const x = new Array(nP); mapa.forEach((b, a) => { x[b] = a; }); return x; };
    const ajustarProductos = (posR) => {
      const x = inv(), res = []; let coste = 0;
      P.forEach((p, k) => {
        const A = locP[k], B = locP[k].map((_, i) => posR[x[p.base + i]]);
        const fit = ajusteRigido(A, B); coste += fit.rmsd2 * A.length; res.push(fit);
      });
      return { coste, fits: res };
    };
    const reasignarH = (posR, fits) => {
      // posiciones objetivo de los H del «pozo» tras el ajuste; asignación voraz por distancia mínima
      const pozo = def.pozoH, objetivos = pozo.map((a) => mapa[a]);
      const posDeP = (g) => { const k = P.findIndex((p) => g >= p.base && g < p.base + p.mol.atomos.length), p = P[k], f = fits[k], v = mv(f.R, locP[k][g - p.base].map((c, i) => c - f.ca[i])); return [v[0] + f.cb[0], v[1] + f.cb[1], v[2] + f.cb[2]]; };
      const pares = []; pozo.forEach((a, ia) => objetivos.forEach((b, ib) => { const q = posDeP(b), s = posR[a]; pares.push([Math.hypot(q[0] - s[0], q[1] - s[1], q[2] - s[2]), ia, ib]); }));
      pares.sort((x, y) => x[0] - y[0]);
      const ua = new Set(), ub = new Set(), nuevo = [];
      pares.forEach(([d, ia, ib]) => { if (ua.has(ia) || ub.has(ib)) return; ua.add(ia); ub.add(ib); nuevo.push([pozo[ia], objetivos[ib]]); });
      nuevo.forEach(([a, b]) => { mapa[a] = b; });
    };
    // 3 vueltas: optimizar orientaciones (descenso por coordenadas) y reasignar H sueltos
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      for (let pase = 0; pase < 2; pase++) {
        for (let k = 0; k < R.length; k++) {
          if (R[k].mol.atomos.length < 2) continue;
          let mejor = orient[k], mc = Infinity;
          cands.forEach((q) => { const o2 = orient.slice(); o2[k] = q; const c = ajustarProductos(posRde(o2)).coste; if (c < mc - 1e-9) { mc = c; mejor = q; } });
          orient[k] = mejor;
        }
      }
      if (def.pozoH.length > 1) { const pr = posRde(orient); reasignarH(pr, ajustarProductos(pr).fits); }
    }
    const posR = posRde(orient), { fits } = ajustarProductos(posR);
    // posiciones de los productos (ajuste rígido) y separación de moléculas que se solapan
    const posP = new Array(nP);
    const cent = P.map((p, k) => { const f = fits[k]; return f.cb.slice(); });
    for (let it = 0; it < 60; it++) {
      let mov = false;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const d = [cent[j][0] - cent[i][0], cent[j][1] - cent[i][1], cent[j][2] - cent[i][2]], L = Math.hypot(...d) || 1e-3, need = rP[i] + rP[j] + 0.5;
        if (L < need) { const s = (need - L) / 2 / L; for (let c = 0; c < 3; c++) { cent[i][c] -= d[c] * s; cent[j][c] += d[c] * s; } mov = true; }
      }
      if (!mov) break;
    }
    P.forEach((p, k) => { const f = fits[k]; locP[k].forEach((v, i) => { const w = mv(f.R, v); posP[p.base + i] = [w[0] + cent[k][0], w[1] + cent[k][1], w[2] + cent[k][2]]; }); });
    // recentrado global
    const all = posR.concat(posP), g = [0, 0, 0]; all.forEach((v) => { g[0] += v[0] / all.length; g[1] += v[1] / all.length; g[2] += v[2] / all.length; });
    const rest = (a) => a.map((v) => [v[0] - g[0], v[1] - g[1], v[2] - g[2]]);
    return { posR: rest(posR), posP: rest(posP), mapa };
  }

  // ---------- clasificación de enlaces ----------
  function clasificarEnlaces(def, mapa) {
    const clave = (a, b) => (a < b ? a + '_' + b : b + '_' + a);
    const inv = new Array(mapa.length); mapa.forEach((b, a) => { inv[b] = a; });
    const pR = new Map(def.enlacesR.map((e) => [clave(e.a, e.b), e]));
    const pP = new Map(def.enlacesP.map((e) => [clave(inv[e.a], inv[e.b]), { a: inv[e.a], b: inv[e.b], orden: e.orden }]));
    const out = [];
    // un cambio de orden de ±0,5 (p. ej. C=O ↔ C–O⁻ resonante del carboxilato) no es romper ni formar: se funde un enlace en otro
    const resonante = (x, y) => Math.abs(x - y) <= 0.5;
    pR.forEach((e, k) => {
      const q = pP.get(k);
      if (q && q.orden === e.orden) out.push({ a: e.a, b: e.b, orden: e.orden, tipo: 'sigue' });
      else if (q && resonante(q.orden, e.orden)) { out.push({ a: e.a, b: e.b, orden: e.orden, tipo: 'orden-sale' }); out.push({ a: q.a, b: q.b, orden: q.orden, tipo: 'orden-entra' }); }
      else out.push({ a: e.a, b: e.b, orden: e.orden, tipo: 'rompe' });
    });
    pP.forEach((q, k) => { const e = pR.get(k); if (!e || (e.orden !== q.orden && !resonante(q.orden, e.orden))) out.push({ a: q.a, b: q.b, orden: q.orden, tipo: 'forma' }); });
    return out;
  }
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function describirCambios(def, bonds) {
    const sim = (g) => def.atomosR[g].el;
    const mol = (g) => def.reactivos[def.atomosR[g].m].mol.formula;
    const molP = (g) => def.productos[def.atomosP[def.mapa[g]].m].mol.formula;
    const etq = (b) => { const e = [sim(b.a), sim(b.b)].sort(D.ordenHill); return e[0] + (b.orden === 2 ? '=' : b.orden === 3 ? '≡' : '–') + e[1]; };
    const uniq = (arr) => Array.from(new Set(arr));
    return {
      rompen: uniq(bonds.filter((b) => b.tipo === 'rompe').map((b) => etq(b) + ' de ' + mol(b.a))),
      forman: uniq(bonds.filter((b) => b.tipo === 'forma').map((b) => etq(b) + ' de ' + molP(b.a))),
    };
  }

  // ---------- API ----------
  function reaccion(host, opts) {
    opts = opts || {};
    let def = null;
    try { def = opts.id ? M.reaccionDef(opts.id) : M.resolverReaccion({ id: opts.id, reactivos: opts.reactivos, productos: opts.productos, mapa: opts.mapa, eq: opts.eq, nota: opts.nota, tipo: opts.tipo }); }
    catch (e) { console.warn('[mol3d] reacción no válida', e); }
    host.classList.add('m3d');
    if (!host.style.minHeight && host.clientHeight < 80) host.style.minHeight = '380px';
    if (!def) { host.append(el('p', { style: { padding: '16px' } }, 'Reacción no disponible.')); return { dispose() { host.replaceChildren(); host.classList.remove('m3d'); }, play() {}, pause() {}, reset() {}, setProgreso() {}, progreso: () => 0 }; }

    const lay = disponer(def), mapa = lay.mapa;
    const bonds = clasificarEnlaces(def, mapa), cambios = describirCambios(def, bonds);
    const N = M.nucleo;
    // texto accesible
    const altTxt = 'Reacción: ' + def.ecuacion + '. ' + (def.tipo ? def.tipo + '. ' : '') + (cambios.rompen.length ? 'Se rompen: ' + cambios.rompen.join(', ') + '. ' : '') + (cambios.forman.length ? 'Se forman: ' + cambios.forman.join(', ') + '. ' : '') + (def.nota || '');
    const alt = el('p', { class: 'm3d-alt' }, altTxt);

    // ---------- DOM de la cabecera ----------
    const coefHtml = (list, defs) => { const out = []; let i = 0; while (i < list.length) { let j = i; while (j < list.length && list[j].id === list[i].id) j++; if (out.length) out.push(' + '); out.push((j - i > 1 ? (j - i) + ' ' : '') + list[i].mol.formula); i = j; } return out.join(''); };
    const cab = el('div', { class: 'm3d-rx-cab' },
      el('div', { class: 'm3d-rx-ecu', 'aria-hidden': 'true' }, coefHtml(def.reactivos), el('span', { class: 'rx-flecha' }, def.eq ? '⇌' : '→'), coefHtml(def.productos)),
      def.tipo ? el('div', { class: 'm3d-rx-tipo' }, def.tipo) : null);
    const ley = el('div', { class: 'm3d-rx-leyenda', 'aria-hidden': 'true' },
      el('span', { class: 'rota' }, el('i'), 'se rompe' + (cambios.rompen.length ? ': ' + cambios.rompen.map((c) => c.split(' de ')[0]).join(', ') : '')),
      el('span', { class: 'forma' }, el('i'), 'se forma' + (cambios.forman.length ? ': ' + cambios.forman.map((c) => c.split(' de ')[0]).join(', ') : '')));
    const nota = def.nota ? el('div', { class: 'm3d-rx-nota' }, def.nota) : null;
    const bPlay = el('button', { type: 'button', class: 'm3d-btn', 'aria-label': 'Reproducir', title: 'Reproducir / pausa (espacio)' }, '▶');
    const bReset = el('button', { type: 'button', class: 'm3d-btn', 'aria-label': 'Volver al inicio', title: 'Reiniciar' }, '↺');
    const slider = el('input', { type: 'range', class: 'm3d-rx-slider', min: '0', max: '1000', value: '0', 'aria-label': 'Progreso de la reacción' });
    const fase = el('span', { class: 'm3d-rx-fase', 'aria-live': 'off' }, 'Reactivos');
    const ctrl = el('div', { class: 'm3d-rx-ctrl' }, bPlay, bReset, slider, fase);

    let esc = N && T ? N.crearEscena(host, { rotar: false }) : null;
    cab.append(ley); host.append(alt, cab);
    if (nota) host.append(nota);
    host.append(ctrl);
    if (!esc) host.classList.add('m3d-sin-webgl');
    const atomos = def.atomosR.map((a, i) => ({ el: a.el, x: lay.posR[i][0], y: lay.posR[i][1], z: lay.posR[i][2] }));
    let modelo = null;
    if (esc) {
      modelo = N.crearModelo(esc, atomos, bonds.map((b) => ({ a: b.a, b: b.b, orden: b.orden })), { estilo: 'bolas', etiquetas: true, desvanecible: true });
      let rad = 1; lay.posR.concat(lay.posP).forEach((v) => { rad = Math.max(rad, Math.hypot(v[0], v[1], v[2]) + 0.9); });
      esc.ajustarA(rad); esc.orientacion = new T.Quaternion().setFromEuler(new T.Euler(0.28, -0.3, 0)); esc.resetVista();
      esc.lienzo.setAttribute('role', 'img'); esc.lienzo.setAttribute('aria-label', altTxt + ' Animación 3D: ▶ para reproducir, el deslizador recorre la reacción.');
    }
    const cRoja = T ? new T.Color(0xff3355) : null, cVerde = T ? new T.Color(0x33ff99) : null, cNegro = T ? new T.Color(0x000000) : null;

    // ---------- línea de tiempo ----------
    let prog = 0, jugando = false, muerto = false, acumulado = 0;
    const DUR = 7.0 / (opts.velocidad || 1); // segundos
    function aplicar(p) {
      prog = Math.max(0, Math.min(1, p));
      slider.value = String(Math.round(prog * 1000));
      const s = sm(0.22, 0.8, prog);
      fase.textContent = prog < 0.1 ? 'Reactivos' : prog < 0.42 ? 'Se rompen enlaces' : prog < 0.62 ? 'Los átomos se reordenan' : prog < 0.9 ? 'Se forman enlaces' : 'Productos';
      slider.setAttribute('aria-valuetext', fase.textContent);
      if (!modelo) return;
      modelo.atomos.forEach((a, i) => { const p0 = lay.posR[i], p1 = lay.posP[mapa[i]]; a.pos.set(p0[0] + (p1[0] - p0[0]) * s, p0[1] + (p1[1] - p0[1]) * s, p0[2] + (p1[2] - p0[2]) * s); });
      modelo.enlaces.forEach((mb, k) => {
        const b = bonds[k];
        let alpha = 1, gro = 1, emis = 0, col = null;
        if (b.tipo === 'rompe') { const u = sm(0.12, 0.44, prog); alpha = 1 - u; gro = 1 - 0.7 * u; emis = Math.sin(Math.min(1, u * 1.15) * Math.PI) * 0.9 + (u > 0 ? 0.15 : 0); col = cRoja; if (u >= 1) mb.visible = false; else mb.visible = true; }
        else if (b.tipo === 'forma') { const u = sm(0.56, 0.9, prog); alpha = u; gro = 0.3 + 0.7 * u; emis = Math.sin(u * Math.PI) * 0.9; col = cVerde; mb.visible = u > 0; }
        else if (b.tipo === 'orden-sale') { alpha = 1 - sm(0.3, 0.7, prog); }
        else if (b.tipo === 'orden-entra') { const u = sm(0.3, 0.7, prog); alpha = u; mb.visible = u > 0; }
        mb.alpha = alpha; mb.grosor = gro;
        mb.meshes.forEach((par) => par.forEach((m) => { if (m.material.emissive) { if (col) m.material.emissive.copy(col).multiplyScalar(emis); else m.material.emissive.copy(cNegro); } }));
      });
      modelo.actualizar(); esc.pedirRender();
    }
    function bucle(dt) { if (!jugando) return false; acumulado = prog + dt / DUR; if (acumulado >= 1) { aplicar(1); parar(); return false; } aplicar(acumulado); return true; }
    function play() {
      if (muerto) return;
      if (reducido()) { aplicar(prog >= 1 ? 0 : 1); return; }
      if (prog >= 1) aplicar(0);
      jugando = true; bPlay.textContent = '⏸'; bPlay.setAttribute('aria-label', 'Pausa');
      esc && esc.agregarHook(bucle);
    }
    function parar() { jugando = false; bPlay.textContent = '▶'; bPlay.setAttribute('aria-label', 'Reproducir'); }
    function pause() { parar(); }
    function reset() { parar(); aplicar(0); }
    bPlay.addEventListener('click', () => (jugando ? pause() : play()));
    bReset.addEventListener('click', reset);
    slider.addEventListener('input', () => { parar(); aplicar(+slider.value / 1000); });
    host.addEventListener('keydown', (e) => { if (e.key === ' ' && e.target === (esc && esc.lienzo)) { /* el visor ya usa espacio para el giro */ } });
    aplicar(0);
    let t0 = null;
    if (opts.autoplay !== false && !reducido()) { t0 = setTimeout(() => { if (!muerto) play(); }, 700); }
    return {
      dispose() { muerto = true; clearTimeout(t0); jugando = false; if (modelo) modelo.dispose(); if (esc) esc.dispose(); host.replaceChildren(); host.classList.remove('m3d', 'm3d-sin-webgl'); },
      play, pause, reset, setProgreso: (p) => { parar(); aplicar(p); }, progreso: () => prog, reaccion: def, cambios, get escena() { return esc; },
    };
  }
  M.reaccion = reaccion;
  M._util = Object.assign(M._util || {}, { ajusteRigido, jacobi });
})();
