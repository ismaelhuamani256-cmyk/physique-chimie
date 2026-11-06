// =====================================================================================
// 10-quimica-1a5.js — CONCEPTOS (química, capítulos 1–5): escenas interactivas Canvas 2D + pasos + mini-test.
//   Registra en PCB.conceptos (js/conceptos/00-nucleo.js). Todo el dibujo es propio (sin imágenes externas).
//   Cap. 1 acide-base          : transfert-h · amphotere-eau · lewis-doublets
//   Cap. 2 methodes-physiques  : ir-vibraciones · conductimetria-iones · etalonnage
//   Cap. 3 methodes-chimiques  : dilucion-moleculas · titrage-limitante · equivalence-ph · titrage-conducti
//   Cap. 4 evolution-temporelle: chocs-efficaces · catalyse-barrera · mecanisme-fleche · vitesse-tangente
//   Cap. 5 nucleaires          : diagramme-nz · desintegraciones · decaimiento-aleatorio · datation-c14
//   Página = pdf (impresa + 18). Valores numéricos tomados del cours (indicados en cada concepto).
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB;
  if (!PCB || !PCB.conceptos) return;
  const reg = (d) => PCB.conceptos.registrar(d);
  const W = 800, H = 450;
  const VE = '#2ee59d', MG = '#ff3da6', BG = '#0a0f20', TX = '#eaf0ff', T2 = '#9fb0d9', AM = '#ffd166', AZ = '#4cc9f0', GR = '#2a376b', OR = '#ff9f1c';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sgn = (q) => (q === 0 ? '' : q > 0 ? (q > 1 ? q : '') + '⁺' : (q < -1 ? -q : '') + '⁻');

  // ---------- CSS propio (prefijo cpt-a-) ----------
  (function () {
    if (document.getElementById('cpt-a-css')) return;
    const s = document.createElement('style');
    s.id = 'cpt-a-css';
    s.textContent =
      '.cpt-a-ctl{position:absolute;left:0;right:0;bottom:0;display:flex;flex-wrap:wrap;gap:5px 14px;align-items:center;padding:5px 10px;background:#0a0f20ee;border-top:1px solid #2a376b;font:12px/1.2 UI,system-ui,sans-serif;color:#eaf0ff}' +
      '.cpt-a-ctl label{display:flex;align-items:center;gap:6px;white-space:nowrap}' +
      '.cpt-a-ctl input[type=range]{width:min(150px,26vw);accent-color:#2ee59d}' +
      '.cpt-a-ctl output{min-width:3.4em;color:#ffd166;font-weight:600}' +
      '.cpt-a-ctl select{font:12px UI,system-ui,sans-serif;background:#1d2850;color:#eaf0ff;border:1px solid #2a376b;border-radius:6px;padding:2px 4px;max-width:46vw}' +
      '.cpt-a-ctl button{font:600 12px UI,system-ui,sans-serif;background:#1d2850;border:1px solid #2a376b;color:#eaf0ff;border-radius:8px;padding:4px 9px;cursor:pointer}' +
      '.cpt-a-ctl button:hover{border-color:#2ee59d}.cpt-a-ctl button.on{border-color:#2ee59d;background:#143a2e}' +
      '.cpt-a-ctl.cpt-a-estrecho{flex-wrap:nowrap;overflow-x:auto;gap:8px;padding:3px 6px;scrollbar-width:none}.cpt-a-estrecho input[type=range]{width:64px}.cpt-a-estrecho label,.cpt-a-estrecho button{flex:0 0 auto;font-size:11px}.cpt-a-estrecho output{min-width:2.6em}.cpt-a-estrecho select{max-width:120px}';
    document.head.appendChild(s);
  })();

  // ---------- Helpers de dibujo ----------
  function txt(c, s, x, y, o) {
    o = o || {};
    c.font = (o.b ? '700 ' : '400 ') + (o.i ? 'italic ' : '') + (o.s || 14) + 'px ' + (o.f || 'UI,system-ui,sans-serif');
    c.fillStyle = o.c || TX; c.textAlign = o.a || 'center'; c.textBaseline = o.v || 'middle';
    if (o.al != null) c.globalAlpha = o.al;
    c.fillText(s, x, y);
    c.globalAlpha = 1;
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function circ(c, x, y, r, fill, stroke, lw) { c.beginPath(); c.arc(x, y, r, 0, 6.2832); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); } }
  function lin(c, x1, y1, x2, y2, col, w, dash) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = w || 2; c.setLineDash(dash || []); c.stroke(); c.setLineDash([]); }
  function punta(c, x, y, ang, col, n) { n = n || 9; c.beginPath(); c.moveTo(x, y); c.lineTo(x - n * Math.cos(ang - 0.45), y - n * Math.sin(ang - 0.45)); c.lineTo(x - n * Math.cos(ang + 0.45), y - n * Math.sin(ang + 0.45)); c.closePath(); c.fillStyle = col; c.fill(); }
  function flecha(c, x1, y1, x2, y2, col, w) { lin(c, x1, y1, x2, y2, col, w || 2); punta(c, x2, y2, Math.atan2(y2 - y1, x2 - x1), col, 10); }
  function curva(c, x1, y1, cx, cy, x2, y2, col, w) { c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(cx, cy, x2, y2); c.strokeStyle = col; c.lineWidth = w || 2; c.stroke(); punta(c, x2, y2, Math.atan2(y2 - cy, x2 - cx), col, 10); }
  function chip(c, s, x, y, col, o) {
    o = o || {}; c.font = '700 ' + (o.s || 12) + 'px UI,system-ui,sans-serif';
    const w = c.measureText(s).width + 14, h = (o.s || 12) + 9;
    c.globalAlpha = o.al == null ? 1 : o.al; rr(c, x - w / 2, y - h / 2, w, h, h / 2); c.fillStyle = col + '33'; c.fill(); c.strokeStyle = col; c.lineWidth = 1.4; c.stroke();
    txt(c, s, x, y + 0.5, { c: col, b: 1, s: o.s || 12 }); c.globalAlpha = 1;
  }
  function pareja(c, x, y, vert, col, al, r) { // doblete (dos puntos)
    c.globalAlpha = al == null ? 1 : al; r = r || 3; const d = r + 2;
    circ(c, vert ? x : x - d, vert ? y - d : y, r, col); circ(c, vert ? x : x + d, vert ? y + d : y, r, col); c.globalAlpha = 1;
  }
  function panel(c, x, y, w, h, col) { rr(c, x, y, w, h, 10); c.fillStyle = '#10183a'; c.fill(); c.strokeStyle = col || GR; c.lineWidth = 1.5; c.stroke(); }

  // ---------- Motor de escena (canvas 800×450 lógico + controles superpuestos) ----------
  // o: { estado, controles:[{tipo:'rango'|'btn'|'sel', id, txt, min,max,paso,val,fmt, opciones, al(S,E)}], alCambiar(id,v,S,E), paso(dt,S,E), dibujar(c,S,E), ir(n,S,E), fin(S) }
  function escena(host, api, o) {
    const S = o.estado || {}; S.red = !!api.reducido; S.t = 0; S.n = 0;
    const cv = document.createElement('canvas'); host.appendChild(cv);
    const c = cv.getContext('2d'); let sc = 1, vivo = true, raf = 0, last = performance.now();
    const E = { S, el: {}, canvas: cv, ctl: null };
    function fit() { const r = host.getBoundingClientRect(); if (E.ctl) E.ctl.classList.toggle('cpt-a-estrecho', r.width < 560); const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(2, (r.width * dpr) | 0); cv.height = Math.max(2, (r.height * dpr) | 0); sc = cv.width / W; }
    api.onResize(fit); fit();
    if (o.controles && o.controles.length) {
      const bar = document.createElement('div'); bar.className = 'cpt-a-ctl'; E.ctl = bar; host.appendChild(bar);
      o.controles.forEach((k) => {
        if (k.tipo === 'btn') { const b = document.createElement('button'); b.type = 'button'; b.textContent = k.txt; b.addEventListener('click', () => k.al && k.al(S, E, b)); bar.appendChild(b); if (k.id) E.el[k.id] = b; return; }
        const lab = document.createElement('label'); lab.append(k.txt + ' ');
        if (k.tipo === 'sel') {
          const s = document.createElement('select'); k.opciones.forEach((t, i) => { const op = document.createElement('option'); op.value = i; op.textContent = t; s.appendChild(op); });
          s.value = k.val || 0; S[k.id] = +s.value;
          s.addEventListener('change', () => { S[k.id] = +s.value; o.alCambiar && o.alCambiar(k.id, S[k.id], S, E); });
          lab.appendChild(s); E.el[k.id] = s;
        } else {
          const r = document.createElement('input'); r.type = 'range'; r.min = k.min; r.max = k.max; r.step = k.paso || 'any'; r.value = k.val; S[k.id] = +k.val;
          const out = document.createElement('output'); const f = k.fmt || ((v) => String(v)); out.textContent = f(+k.val);
          r.setAttribute('aria-label', k.txt);
          r.addEventListener('input', () => { S[k.id] = +r.value; out.textContent = f(S[k.id]); o.alCambiar && o.alCambiar(k.id, S[k.id], S, E); });
          lab.append(r, out); E.el[k.id] = r; r._out = out; r._f = f;
        }
        bar.appendChild(lab);
      });
    }
    E.set = (id, v) => { const r = E.el[id]; S[id] = v; if (r) { r.value = v; if (r._out) r._out.textContent = r._f(+v); } };
    function loop(now) {
      if (!vivo) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; S.t += dt;
      try { o.paso && o.paso(dt, S, E); c.setTransform(sc, 0, 0, sc, 0, 0); c.fillStyle = BG; c.fillRect(0, 0, W, H); o.dibujar(c, S, E); } catch (e) { console.error('[conceptos-a]', e); vivo = false; return; }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return {
      E,
      ir(n) { S.n = n; o.ir && o.ir(n, S, E); },
      dispose() { vivo = false; cancelAnimationFrame(raf); o.fin && o.fin(S); host.replaceChildren(); },
    };
  }
  const aviso = (c, S, s) => { /* texto de ayuda pequeño arriba */ txt(c, s, W / 2, 22, { c: T2, s: 13 }); };

  // =====================================================================================
  // CAP. 1 · acide-base
  // =====================================================================================

  // ---- 1.1 Transferencia de H⁺ entre dos pares (p. 42, ejemplos 1 y 2) ----
  reg({
    id: 'transfert-h', capitulos: ['acide-base'], titulo: 'El protón que viaja: transferencia de H⁺', fr: 'Réaction acide-base = transfert d’ion H⁺', pagina_pdf: 42,
    resumen: 'Una reacción ácido-base es el viaje de un ion H⁺ desde el ácido de un par hasta la base de otro par. Mira cómo se «reparten» los papeles antes y después.',
    pasos: [
      { titulo: 'Dos pares en juego', texto: 'Una transformación ácido-base pone en juego dos pares distintos. A la izquierda el ácido A₁H del par 1; a la derecha la base A₂⁻ (o la molécula que hace de base) del par 2. Cambia de reacción con el selector de abajo.', fr: 'Deux couples acide-base différents : A₁H/A₁⁻ et A₂H/A₂.' },
      { titulo: 'Quién da y quién recibe', texto: 'El ácido tiene un H que puede «dejar» (se queda el doblete del enlace). La base tiene un doblete no ligante libre que puede formar un enlace nuevo con H⁺. Fíjate en los dos sitios resaltados.', fr: 'Acide : espèce capable de céder H⁺. Base : espèce capable de capter H⁺.' },
      { titulo: 'El H⁺ se transfiere', texto: 'Pulsa «Transferir» (o arrastra el deslizador H⁺): el ion hidrógeno sale del ácido y se fija en la base. El enlace antiguo se rompe y el nuevo se forma casi a la vez.', fr: 'On peut modéliser une transformation acide-base par un transfert d’ion hydrogène H⁺.' },
      { titulo: 'Aparecen los pares conjugados', texto: 'Tras el viaje, el ácido se ha convertido en su base conjugada A₁⁻ (par 1) y la base en su ácido conjugado A₂H (par 2). Cada especie ha cambiado de papel y de carga.', fr: 'A₁H devient A₁⁻ ; A₂⁻ devient A₂H.' },
      { titulo: 'En la ecuación el H⁺ desaparece', texto: 'Se escriben las dos semiecuaciones en el sentido de la reacción y se suman: el H⁺ está a los dos lados y se simplifica. Por eso no aparece en la ecuación de reacción. La flecha doble ⇌ indica que la transformación no siempre es total.', fr: 'L’hydrogène H⁺ échangé n’apparaît donc pas dans l’équation de réaction.' },
    ],
    montar(host, api) {
      const R = [
        { n: 'HCl + H₂O → Cl⁻ + H₃O⁺ (total)', a1: 'HCl', g1: 'Cl', q1: 0, b1: 'Cl⁻', b2: 'H₂O', g2: 'H₂O', q2: 0, a2: 'H₃O⁺', total: true, c1: 'HCl / Cl⁻', c2: 'H₃O⁺ / H₂O' },
        { n: 'CH₃CO₂H + H₂O ⇌ CH₃CO₂⁻ + H₃O⁺', a1: 'CH₃CO₂H', g1: 'CH₃CO₂', q1: 0, b1: 'CH₃CO₂⁻', b2: 'H₂O', g2: 'H₂O', q2: 0, a2: 'H₃O⁺', total: false, c1: 'CH₃CO₂H / CH₃CO₂⁻', c2: 'H₃O⁺ / H₂O' },
      ];
      const S = { r: 0, p: 0, meta: null };
      const LX = 190, RX = 610, Y = 190, HX0 = LX + 76, HX1 = RX - 76;
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'sel', id: 'r', txt: 'Reacción', opciones: R.map((x) => x.n), val: 0 },
          { tipo: 'rango', id: 'p', txt: 'H⁺', min: 0, max: 1, paso: 0.01, val: 0, fmt: (v) => Math.round(v * 100) + ' %' },
          { tipo: 'btn', txt: '▶ Transferir', al: (S, E) => { if (S.p >= 0.99) E.set('p', 0); S.meta = 1; if (S.red) { E.set('p', 1); S.meta = null; } } },
          { tipo: 'btn', txt: '↺', al: (S, E) => { S.meta = null; E.set('p', 0); } },
        ],
        alCambiar(id, v, S) { if (id === 'p') S.meta = null; },
        paso(dt, S, E) { if (S.meta != null) { const d = S.meta - S.p, k = dt * 0.5; E.set('p', Math.abs(d) <= k ? S.meta : S.p + Math.sign(d) * k); if (S.p === S.meta) S.meta = null; } },
        ir(n, S, E) { if (n <= 1) { S.meta = null; E.set('p', 0); } else if (n === 2) { E.set('p', 0); S.meta = S.red ? null : 1; if (S.red) E.set('p', 1); } else { S.meta = null; E.set('p', 1); } },
        dibujar(c, S) {
          const r = R[S.r], p = S.p, n = S.n, desp = p >= 0.5;
          // pares (cabecera)
          txt(c, 'par 1 : ' + r.c1, LX, 34, { c: MG, s: 14, b: 1 }); txt(c, 'par 2 : ' + r.c2, RX, 34, { c: VE, s: 14, b: 1 });
          // moléculas
          const molec = (x, g, role, fillcol) => { rr(c, x - 56, Y - 38, 112, 76, 16); c.fillStyle = fillcol + '22'; c.fill(); c.strokeStyle = fillcol; c.lineWidth = 2.5; c.stroke(); txt(c, g, x, Y, { s: 22, b: 1 }); };
          molec(LX, r.g1, 0, desp ? VE : MG); molec(RX, r.g2, 0, desp ? MG : VE);
          // cargas (insignias en la esquina de cada especie)
          [[LX, desp ? r.q1 - 1 : r.q1], [RX, desp ? r.q2 + 1 : r.q2]].forEach(([x, q]) => { if (q) { circ(c, x + 56, Y - 38, 12, '#0a0f20', AM, 2); txt(c, q > 0 ? '+' : '−', x + 56, Y - 38, { c: AM, s: 16, b: 1 }); } });
          // dobletes: base 2 (izquierda de su caja) / base 1 tras ceder
          pareja(c, RX - 68, Y, 1, VE, 1 - p, 4.5); pareja(c, LX + 68, Y, 1, VE, p, 4.5);
          // trayecto del H⁺
          const hx = lerp(HX0, HX1, p), hy = Y - Math.sin(Math.PI * p) * 95;
          c.setLineDash([5, 6]); curva(c, HX0 + 14, Y - 30, W / 2, Y - 150, HX1 - 14, Y - 30, GR, 1.5); c.setLineDash([]);
          c.globalAlpha = clamp(1 - p * 1.1, 0, 1); lin(c, LX + 56, Y, hx, hy, MG, 3); c.globalAlpha = clamp(p * 1.1, 0, 1); lin(c, RX - 56, Y, hx, hy, MG, 3); c.globalAlpha = 1;
          circ(c, hx, hy, 17, '#2a2a1a', AM, 2.5); txt(c, 'H' + (p > 0.02 && p < 0.98 ? '⁺' : ''), hx, hy, { s: 15, b: 1, c: AM });
          if (n === 1) { // resaltar sitios
            const k = 0.5 + 0.5 * Math.sin(S.t * 4);
            circ(c, HX0, Y, 24 + k * 4, null, AM, 2); txt(c, 'H que se cede', HX0 - 10, Y - 62, { c: AM, s: 13 });
            c.beginPath(); c.arc(RX - 68, Y, 18 + k * 3, 0, 6.2832); c.strokeStyle = VE; c.lineWidth = 2; c.stroke();
            txt(c, 'doublet non liant', RX - 40, Y - 66, { c: VE, s: 13 }); txt(c, '(acepta el H⁺)', RX - 40, Y - 50, { c: VE, s: 12 });
          }
          // roles
          chip(c, desp ? 'base 1' : 'acide 1', LX, Y + 62, desp ? VE : MG); chip(c, desp ? 'acide 2' : 'base 2', RX, Y + 62, desp ? MG : VE);
          txt(c, desp ? r.b1 : r.a1, LX, Y + 96, { s: 20, b: 1 }); txt(c, desp ? r.a2 : r.b2, RX, Y + 96, { s: 20, b: 1 });
          // flecha de reacción centro
          txt(c, r.total ? '→' : '⇌', W / 2, Y + 30, { s: 28, c: T2 });
          // zona inferior: ecuación o pares
          if (n >= 4) {
            panel(c, 100, 308, 600, 92, VE);
            txt(c, r.a1 + '  =  ' + r.b1 + '  +  H⁺', 230, 326, { s: 15, c: T2 }); txt(c, 'H₂O  +  H⁺  =  H₃O⁺', 560, 326, { s: 15, c: T2 });
            txt(c, r.a1 + ' + H₂O ' + (r.total ? '→' : '⇌') + ' ' + r.b1 + ' + H₃O⁺', 400, 366, { s: 18, b: 1 });
            txt(c, 'H⁺ se simplifica', 400, 388, { c: AM, s: 12 });
            lin(c, 330, 346, 470, 346, T2, 1);
          } else {
            txt(c, 'A₁H + A₂⁻ ⇌ A₁⁻ + A₂H', W / 2, 352, { s: 16, c: T2 }); txt(c, 'el H⁺ viaja de A₁H hacia la base A₂⁻', W / 2, 376, { c: T2, s: 13 });
          }
        },
      });
    },
    test: [
      { pregunta: 'En HCl + H₂O → Cl⁻ + H₃O⁺, ¿quién cede el H⁺ y quién lo capta?', opciones: ['HCl lo cede, H₂O lo capta', 'H₂O lo cede, HCl lo capta', 'Los dos lo ceden'], correcta: 0, explicacion: 'HCl es el ácido del par HCl/Cl⁻; el agua es la base del par H₃O⁺/H₂O (p. 42, ejemplo 2).' },
      { pregunta: '¿Por qué el H⁺ no aparece en la ecuación de reacción?', opciones: ['Porque no existe', 'Porque aparece a los dos lados al sumar las semiecuaciones y se simplifica', 'Porque es un catalizador'], correcta: 1, explicacion: 'Se cede en una semiecuación y se capta en la otra: al sumarlas se cancela.' },
      { pregunta: 'Antes de la transferencia, ¿qué debe tener la base para capturar el H⁺?', opciones: ['Un doblete no ligante', 'Un neutrón libre', 'Una carga positiva'], correcta: 0, explicacion: 'Ese doblete forma el nuevo enlace con H⁺ (Lewis, p. 41).' },
    ],
  });

  // helper común: desliza S.p hacia S.meta (0..1) y sincroniza el deslizador
  const mueveP = (dt, S, E, vel) => { if (S.meta != null) { const d = S.meta - S.p, k = dt * (vel || 0.5); E.set('p', Math.abs(d) <= k ? S.meta : S.p + Math.sign(d) * k); if (S.p === S.meta) S.meta = null; } };
  const irP = (S, E, p, anim) => { if (anim && !S.red) { E.set('p', 0); S.meta = 1; } else { S.meta = null; E.set('p', p); } };
  const ctlP = (txt) => [
    { tipo: 'rango', id: 'p', txt: txt || 'H⁺', min: 0, max: 1, paso: 0.01, val: 0, fmt: (v) => Math.round(v * 100) + ' %' },
    { tipo: 'btn', txt: '▶ Transferir', al: (S, E) => { if (S.p >= 0.99) E.set('p', 0); S.meta = 1; if (S.red) { E.set('p', 1); S.meta = null; } } },
    { tipo: 'btn', txt: '↺', al: (S, E) => { S.meta = null; E.set('p', 0); } },
  ];
  const atomo = (c, x, y, r, col, s, tc) => { circ(c, x, y, r, col + '33', col, 2.5); txt(c, s, x, y, { s: r > 18 ? 18 : 13, b: 1, c: tc || TX }); };

  // ---- 1.2 El agua, anfótero (p. 40) ----
  reg({
    id: 'amphotere-eau', capitulos: ['acide-base'], titulo: 'El agua: ácido o base según con quién esté', fr: 'Espèce amphotère : l’eau', pagina_pdf: 40,
    resumen: 'El agua pertenece a dos pares ácido-base. Frente a un ácido capta un H⁺ (es base); frente a una base lo cede (es ácido). Esa doble cara se llama anfótera.',
    pasos: [
      { titulo: 'Una molécula, dos pares', texto: 'El agua es la base del par H₃O⁺/H₂O (puede captar un H⁺ con un doblete del O) y el ácido del par H₂O/HO⁻ (puede ceder uno de sus H). Todavía no ha pasado nada: elige un compañero abajo.', fr: 'Couples de l’eau : H₃O⁺(aq)/H₂O(ℓ) et H₂O(ℓ)/HO⁻(aq).' },
      { titulo: 'Con un ácido: el agua es la base', texto: 'HCl cede su H⁺ y el agua lo capta: se forma H₃O⁺. Aquí el agua actúa como base del par H₃O⁺/H₂O (ejemplo 2, p. 42).', fr: 'HCl(g) + H₂O(ℓ) → Cl⁻(aq) + H₃O⁺(aq)' },
      { titulo: 'Con una base: el agua es el ácido', texto: 'Ahora el compañero es una base (NH₃, con su doblete no ligante). Es el agua quien cede un H⁺ y queda HO⁻: el agua actúa como ácido del par H₂O/HO⁻.', fr: 'Une espèce amphotère est l’acide d’un couple et la base d’un autre couple.' },
      { titulo: 'Anfótero = los dos papeles en la misma especie', texto: 'Escala de acidez: H₃O⁺ arriba, HO⁻ abajo y el agua en medio, entre sus dos pares. También el ion hydrogénocarbonate HCO₃⁻ es anfótero: base del par CO₂(aq),H₂O(ℓ)/HCO₃⁻(aq) y ácido de otro par.', fr: 'L’eau et l’ion hydrogénocarbonate sont des espèces amphotères.' },
    ],
    montar(host, api) {
      const S = { p: 0, meta: null, modo: 0 }; // modo 0 = ácido compañero (HCl), 1 = base compañera (NH₃)
      const WX = 400, WY = 215;
      const agua = (c, x, y, Hs) => { // Hs: qué hidrógenos dibujar [izq, der, arriba]
        const hs = [[x - 38, y + 32], [x + 38, y + 32], [x, y - 54]];
        hs.forEach((h, i) => { if (Hs[i] > 0) { c.globalAlpha = Hs[i]; lin(c, x, y, h[0], h[1], T2, 3); circ(c, h[0], h[1], 14, '#e8eefc', null); txt(c, 'H', h[0], h[1], { s: 13, b: 1, c: '#0a0f20' }); c.globalAlpha = 1; } });
        circ(c, x, y, 28, '#ff5a5a44', '#ff5a5a', 2.5); txt(c, 'O', x, y, { s: 19, b: 1 });
      };
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'sel', id: 'modo', txt: 'Compañero', opciones: ['HCl (un ácido)', 'NH₃ (una base)'], val: 0 },
          ...ctlP('H⁺'),
        ],
        alCambiar(id, v, S, E) { if (id === 'p') S.meta = null; if (id === 'modo') { S.meta = null; E.set('p', 0); } },
        paso(dt, S, E) { mueveP(dt, S, E); },
        ir(n, S, E) { if (n === 1) { S.modo = 0; E.el.modo.value = 0; irP(S, E, 1, 1); } else if (n === 2) { S.modo = 1; E.el.modo.value = 1; irP(S, E, 1, 1); } else { irP(S, E, 0); } },
        dibujar(c, S) {
          const p = S.p, n = S.n, desp = p >= 0.5, ac = S.modo === 0;
          if (n >= 3) { // escala de anfóteros
            txt(c, 'Dos pares: el agua está en los dos', W / 2, 30, { c: T2, s: 14 });
            const ladder = (x, arr, titulo, col) => { txt(c, titulo, x, 66, { c: col, s: 14, b: 1 }); arr.forEach((a, i) => { const y = 120 + i * 92; panel(c, x - 110, y - 26, 220, 52, a[1] ? col : GR); txt(c, a[0], x, y, { s: 18, b: 1, c: a[1] ? TX : T2 }); if (a[2]) txt(c, a[2], x, y + 38, { c: a[1] ? col : T2, s: 12 }); }); flecha(c, x + 124, 120 + 20, x + 124, 120 + 92 * 2 - 20, T2, 1.5); };
            ladder(210, [['H₃O⁺', 0, 'ácido'], ['H₂O', 1, 'BASE del par de arriba · ÁCIDO del de abajo'], ['HO⁻', 0, 'base']], 'El agua', MG);
            ladder(600, [['CO₂(aq),H₂O(ℓ)', 0, 'ácido'], ['HCO₃⁻', 1, 'anfótero: base del par de arriba'], ['(otra base conjugada)', 0, '']], 'El ion hydrogénocarbonate', VE);
            return;
          }
          // compañero y agua; el H viajero se dibuja una sola vez
          const px = ac ? 130 : 670, py = WY;
          const a0 = ac ? [px + 48, py] : [WX + 38, WY + 32], a1 = ac ? [WX, WY - 54] : [px - 46, py];
          const hx = lerp(a0[0], a1[0], p), hy = lerp(a0[1], a1[1], p) - Math.sin(Math.PI * p) * 40;
          if (ac) {
            atomo(c, px, py, 30, VE, 'Cl'); txt(c, desp ? 'Cl⁻' : 'HCl', px, py + 56, { s: 18, b: 1 }); chip(c, desp ? 'base 1' : 'acide 1', px, py + 84, desp ? VE : MG);
            pareja(c, px + 44, py, 1, VE, p, 4.5);
            agua(c, WX, WY, [1, 1, 0]); pareja(c, WX, WY - 44, 0, VE, 1 - p, 4.5);
            c.globalAlpha = 1 - p; lin(c, px + 30, py, hx, hy, MG, 3); c.globalAlpha = p; lin(c, WX, WY, hx, hy, MG, 3); c.globalAlpha = 1;
          } else {
            atomo(c, px, py, 30, AZ, 'N'); [[0, -46], [0, 46], [46, 0]].forEach(([dx, dy]) => { lin(c, px, py, px + dx, py + dy, T2, 2.5); circ(c, px + dx, py + dy, 12, '#e8eefc', null); txt(c, 'H', px + dx, py + dy, { s: 12, b: 1, c: '#0a0f20' }); });
            pareja(c, px - 44, py, 1, VE, 1 - p, 4.5); txt(c, desp ? 'NH₄⁺' : 'NH₃', px, py + 76, { s: 18, b: 1 }); chip(c, desp ? 'acide 2' : 'base 2', px, py + 104, desp ? MG : VE);
            agua(c, WX, WY, [1, 0, 0]); pareja(c, WX + 52, WY + 30, 1, VE, p, 4.5);
            c.globalAlpha = 1 - p; lin(c, WX, WY, hx, hy, MG, 3); c.globalAlpha = p; lin(c, px, py, hx, hy, MG, 3); c.globalAlpha = 1;
          }
          circ(c, hx, hy, 14, '#2a2a10', AM, 2.5); txt(c, 'H', hx, hy, { s: 13, b: 1, c: AM });
          const nom = ac ? (desp ? 'H₃O⁺' : 'H₂O') : (desp ? 'HO⁻' : 'H₂O');
          txt(c, nom, WX, WY + 92, { s: 20, b: 1 });
          chip(c, ac ? (desp ? 'acide 2' : 'agua = BASE') : (desp ? 'base 1' : 'agua = ACIDE'), WX, WY + 122, ac ? (desp ? MG : VE) : (desp ? VE : MG), { s: 13 });
          if (n > 0) txt(c, ac ? 'el agua actúa en el par H₃O⁺ / H₂O' : 'el agua actúa en el par H₂O / HO⁻', W / 2, 30, { c: T2, s: 14 });
          txt(c, ac ? 'HCl + H₂O → Cl⁻ + H₃O⁺' : 'NH₃ + H₂O ⇌ NH₄⁺ + HO⁻', W / 2, 372, { s: 16, c: T2 });
          if (n === 0) txt(c, 'El agua tiene un doblete en el O (capta H⁺) y H que puede ceder', W / 2, 30, { c: T2, s: 14 });
        },
      });
    },
    test: [
      { pregunta: 'En HCl + H₂O → Cl⁻ + H₃O⁺, ¿qué papel hace el agua?', opciones: ['Ácido', 'Base', 'Ni una ni otra'], correcta: 1, explicacion: 'Capta un H⁺ de HCl: es la base del par H₃O⁺/H₂O.' },
      { pregunta: 'Cuando el agua cede un H⁺ a una base, ¿en qué se convierte?', opciones: ['H₃O⁺', 'HO⁻', 'H₂'], correcta: 1, explicacion: 'Es el ácido del par H₂O/HO⁻: al ceder H⁺ queda HO⁻.' },
      { pregunta: '«Espèce amphotère» significa…', opciones: ['Es ácido de un par y base de otro', 'Es neutra siempre', 'No reacciona con H⁺'], correcta: 0, explicacion: 'Según la especie con la que reaccione, actúa como ácido o como base.' },
    ],
  });

  // ---- 1.3 Dobletes de Lewis: por qué RCO₂H es ácido y R–NH₂ es base (p. 41) ----
  reg({
    id: 'lewis-doublets', capitulos: ['acide-base'], titulo: 'Los dobletes de Lewis explican ácido y base', fr: 'Doublets liants et non liants', pagina_pdf: 41,
    resumen: 'Cuenta los dobletes: un ácido carboxílico pierde H⁺ y el O se queda con un doblete no ligante más (carga −); una amina capta H⁺ con su doblete no ligante y el N queda con carga +.',
    pasos: [
      { titulo: 'Contar dobletes por átomo', texto: 'Cada átomo neutro tiene un número fijo de dobletes ligantes y no ligantes: H 1 y 0, C 4 y 0, N 3 y 1, O 2 y 2. Si el recuento cambia, el átomo está cargado.', fr: 'Nombre de doublets liants et non liants : H (1;0), C (4;0), N (3;1), O (2;2).' },
      { titulo: 'El ácido carboxílico', texto: 'En R–C(=O)–O–H el oxígeno atrae el doblete del enlace O–H (más electronegativo): eso favorece que el H se vaya como H⁺. Cuenta el O de abajo: 2 ligantes y 2 no ligantes (neutro).', fr: 'L’électronégativité de l’oxygène est supérieure à celle de l’hydrogène.' },
      { titulo: 'Cede H⁺: nace el carboxilato', texto: 'Pulsa «Transferir»: el H sale sin su electrón y el doblete del enlace se queda en el O, que pasa a 1 ligante y 3 no ligantes: un electrón de más → carga −. Es el ion carboxylate RCO₂⁻.', fr: 'Le doublet liant de l’oxygène se transforme en doublet non liant ; l’oxygène porte une charge négative.' },
      { titulo: 'La amina: un doblete libre en el N', texto: 'Una amina deriva del NH₃: el N tiene 3 ligantes y 1 doblete no ligante. Ese doblete es la «mano» que puede capturar un H⁺: por eso las aminas son bases.', fr: 'Les amines sont des espèces capables de capter un ion H⁺ : ce sont des bases.' },
      { titulo: 'Capta H⁺: nace el amonio', texto: 'El doblete no ligante pasa a ser un enlace N–H: el N queda con 4 ligantes y 0 no ligantes, un electrón menos de los que le corresponden → carga +. Es el ion ammonium.', fr: 'L’azote N se retrouve avec un électron en moins : il porte une charge positive.' },
    ],
    montar(host, api) {
      const S = { p: 0, meta: null, fam: 0 };
      return escena(host, api, {
        estado: S,
        controles: [{ tipo: 'sel', id: 'fam', txt: 'Familia', opciones: ['Ácido carboxílico ⇄ carboxilato', 'Amina ⇄ amonio'], val: 0 }, ...ctlP('H⁺')],
        alCambiar(id, v, S, E) { if (id === 'p') S.meta = null; if (id === 'fam') { S.meta = null; E.set('p', 0); } },
        paso(dt, S, E) { mueveP(dt, S, E); },
        ir(n, S, E) { S.fam = n >= 3 ? 1 : 0; E.el.fam.value = S.fam; if (n === 2 || n === 4) irP(S, E, 1, 1); else irP(S, E, 0); },
        dibujar(c, S) {
          const p = S.p, n = S.n, fam = S.fam, desp = p >= 0.5;
          const O = (x, y, col) => atomo(c, x, y, 17, col || '#ff5a5a', 'O');
          const tabla = (a, b) => { panel(c, 566, 70, 212, 162, GR); txt(c, 'doublets de l’atome', 672, 88, { s: 13, c: T2 }); txt(c, a[0], 672, 114, { s: 15, b: 1, c: AM });
            txt(c, 'liants', 620, 146, { s: 12, c: T2 }); txt(c, 'non liants', 725, 146, { s: 12, c: T2 }); txt(c, String(a[1]), 620, 176, { s: 34, b: 1, c: VE }); txt(c, String(a[2]), 725, 176, { s: 34, b: 1, c: MG }); txt(c, b, 672, 214, { s: 12, c: T2 }); };
          if (n === 0) {
            panel(c, 150, 70, 500, 250, VE); txt(c, 'Nombre de doublets (atome neutre)', W / 2, 96, { s: 16, b: 1 });
            [['H', 1, 0, 1], ['C', 4, 0, 6], ['N', 3, 1, 7], ['O', 2, 2, 8]].forEach((r, i) => { const x = 215 + i * 123; atomo(c, x, 160, 26, i === 2 ? AZ : i === 3 ? '#ff5a5a' : i === 1 ? '#aab4d4' : '#e8eefc', r[0]); txt(c, 'Z = ' + r[3], x, 200, { s: 12, c: T2 }); txt(c, 'liants', x - 24, 232, { s: 11, c: T2 }); txt(c, 'non liants', x + 28, 232, { s: 11, c: T2 }); txt(c, String(r[1]), x - 24, 262, { s: 28, b: 1, c: VE }); txt(c, String(r[2]), x + 28, 262, { s: 28, b: 1, c: MG }); });
            txt(c, 'Si el recuento de un átomo no coincide → el átomo lleva carga', W / 2, 346, { s: 14, c: AM }); return;
          }
          if (fam === 0) {
            const cx = 330, cy = 210;
            txt(c, 'R', 190, cy, { s: 24, b: 1, c: T2 }); lin(c, 205, cy, cx - 16, cy, TX, 3); atomo(c, cx, cy, 17, '#aab4d4', 'C');
            lin(c, cx + 12, cy - 12, 410, 150, TX, 3); lin(c, cx + 18, cy - 4, 416, 158, TX, 3); O(420, 140); pareja(c, 420, 104, 0, MG, 1, 3.5); pareja(c, 455, 140, 1, MG, 1, 3.5);
            lin(c, cx + 12, cy + 12, 408, 268, TX, 3); O(420, 280);
            pareja(c, 420, 316, 0, MG, 1, 3.5); pareja(c, 386, 286, 1, MG, 1, 3.5);
            // enlace O–H y H
            const hx = lerp(500, 560, p), hy = 280 - Math.sin(Math.PI * p) * 40; // H que se aleja (hacia la derecha/arriba)
            c.globalAlpha = 1 - p; lin(c, 437, 280, 484, 280, TX, 3); c.globalAlpha = 1;
            // doblete extra: nace en el enlace y pasa al O
            pareja(c, lerp(462, 454, p), 280, 1, VE, p, 3.8);
            circ(c, hx, hy, 15, '#ffd16633', AM, 2.5); txt(c, 'H' + (p > 0.5 ? '⁺' : ''), hx, hy, { s: 13, b: 1, c: AM });
            if (desp) { circ(c, 466, 258, 12, '#0a0f20', AM, 2); txt(c, '−', 466, 258, { c: AM, s: 16, b: 1 }); }
            txt(c, desp ? 'ion carboxylate RCO₂⁻' : 'acide carboxylique RCO₂H', 330, 372, { s: 17, b: 1, c: desp ? VE : MG });
            tabla(['O del grupo –OH', desp ? 1 : 2, desp ? 3 : 2], desp ? '1 liante · 3 no ligantes → carga −' : '2 liantes · 2 no ligantes → neutro');
          } else {
            const cx = 330, cy = 215;
            atomo(c, cx, cy, 22, AZ, 'N'); txt(c, 'R₁', 215, cy, { s: 20, b: 1, c: T2 }); lin(c, 232, cy, cx - 22, cy, TX, 3);
            txt(c, 'R₂', cx, 110, { s: 20, b: 1, c: T2 }); lin(c, cx, 124, cx, cy - 22, TX, 3); txt(c, 'R₃', cx, 320, { s: 20, b: 1, c: T2 }); lin(c, cx, 306, cx, cy + 22, TX, 3);
            const hx = lerp(515, 428, p), hy = 215 - Math.sin(Math.PI * p) * 50;
            pareja(c, 372, cy, 1, MG, 1 - p, 4.5);
            c.globalAlpha = p; lin(c, cx + 22, cy, 410, cy, TX, 3); c.globalAlpha = 1;
            circ(c, hx, hy, 15, '#ffd16633', AM, 2.5); txt(c, 'H' + (p < 0.5 ? '⁺' : ''), hx, hy, { s: 13, b: 1, c: AM });
            if (desp) { circ(c, cx + 20, cy - 24, 12, '#0a0f20', AM, 2); txt(c, '+', cx + 20, cy - 24, { c: AM, s: 16, b: 1 }); }
            txt(c, desp ? 'ion ammonium R₁R₂R₃NH⁺' : 'amine R₁R₂R₃N', 330, 372, { s: 17, b: 1, c: desp ? MG : VE });
            tabla(['N', desp ? 4 : 3, desp ? 0 : 1], desp ? '4 liantes · 0 no ligantes → carga +' : '3 liantes · 1 no ligante → neutro');
          }
        },
      });
    },
    test: [
      { pregunta: 'Cuando RCO₂H cede H⁺, ¿qué ocurre en el oxígeno del grupo –OH?', opciones: ['Pasa a 1 doblete ligante y 3 no ligantes: carga −', 'Pierde un doblete no ligante: carga +', 'No cambia nada'], correcta: 0, explicacion: 'El doblete del enlace O–H se queda en el O → un doblete no ligante más → ion carboxylate (−).' },
      { pregunta: '¿Por qué una amina es una base?', opciones: ['Tiene un doblete no ligante en el N que capta H⁺', 'Tiene un H muy ácido', 'Tiene un grupo carboxilo'], correcta: 0, explicacion: 'Ese doblete forma el enlace N–H con el H⁺ capturado.' },
      { pregunta: 'El N de un ion ammonium tiene…', opciones: ['3 ligantes y 1 no ligante', '4 ligantes y 0 no ligantes', '2 ligantes y 2 no ligantes'], correcta: 1, explicacion: 'Al captar H⁺ el doblete libre pasa a ser ligante: carga +.' },
    ],
  });

  // =====================================================================================
  // CAP. 2 · methodes-physiques
  // =====================================================================================

  // ---- 2.1 Espectroscopía IR: los enlaces vibran y absorben (p. 64, 65, 72) ----
  reg({
    id: 'ir-vibraciones', capitulos: ['methodes-physiques'], titulo: 'Espectroscopía IR: cada enlace vibra a su frecuencia', fr: 'Spectroscopie IR : groupes caractéristiques', pagina_pdf: 64,
    resumen: 'Un fotón infrarrojo solo se absorbe si su energía coincide con la de una vibración de un enlace. Barre el número de onda y mira qué enlace se «enciende» y cómo nace la banda del espectro.',
    pasos: [
      { titulo: 'Los niveles de energía están cuantificados', texto: 'Una molécula solo puede absorber un fotón si su energía hν coincide exactamente con el salto entre dos niveles (ΔE = E_f − E_i = h·ν). Mueve el deslizador ν̃: la flecha del fotón solo «encaja» en el salto cuando ν̃ está en una banda.', fr: 'Un photon ne peut être absorbé que si son énergie correspond exactement à un changement de niveau d’énergie.' },
      { titulo: 'En el IR, los enlaces vibran', texto: 'Los fotones infrarrojos hacen vibrar los átomos alrededor de los enlaces covalentes. Con ν̃ ≈ 3 500 cm⁻¹ vibra el enlace O–H de 5-hidroxipentan-2-ona; con ν̃ ≈ 1 720 cm⁻¹, el C=O. Fuera de esas bandas el fotón atraviesa sin ser absorbido (T ≈ 100 %).', fr: 'L’énergie absorbée fait vibrer les atomes autour des liaisons covalentes.' },
      { titulo: 'Barrido: nace el espectro', texto: 'Pulsa «Barrer»: cada vez que el haz coincide con un enlace, la transmitancia T cae y dibuja un pico (banda). El espectro IR representa T (%) en función del número de onda ν̃ = 1/λ en cm⁻¹.', fr: 'Un spectre IR représente la transmittance T en fonction du nombre d’onde ν̃.' },
      { titulo: 'Bandas → grupos característicos', texto: 'Cada banda se atribuye con la tabla de datos: O–H de alcohol, ancho y fuerte, 3 200–3 700 cm⁻¹; C=O de cetona, fino y fuerte, 1 705–1 725 cm⁻¹. Cambia de molécula: ácido pentanoico (O–H ancho hacia 3 000 y C=O hacia 1 740) o butanal (C=O y C–H de aldehído hacia 2 830 cm⁻¹).', fr: 'Les bandes d’absorption sont attribuées à des groupes caractéristiques à l’aide d’une table.' },
      { titulo: 'La zona de las «huellas dactilares»', texto: 'Por debajo de 1 300 cm⁻¹ las bandas son difíciles de explotar una a una, pero esa zona sirve para identificar una molécula comparándola con un espectro de referencia.', fr: 'Zone des empreintes digitales : ν̃ < 1 300 cm⁻¹.' },
    ],
    montar(host, api) {
      const MOL = {
        0: { n: '5-hidroxipentan-2-ona', at: [['H', 60, 190], ['O', 100, 215], ['C', 160, 190], ['C', 220, 215], ['C', 280, 190], ['C', 340, 215], ['O', 340, 170], ['C', 400, 190]],
          en: [[0, 1, 1, 0], [1, 2, 1, -1], [2, 3, 1, -1], [3, 4, 1, -1], [4, 5, 1, -1], [5, 6, 2, 1], [5, 7, 1, -1]],
          ba: [{ g: 'O–H (alcool)', c: 3500, w: 300, d: 0.78 }, { g: 'C=O (cétone)', c: 1720, w: 60, d: 0.82 }] },
        1: { n: 'ácido pentanoico', at: [['C', 40, 215], ['C', 100, 190], ['C', 160, 215], ['C', 220, 190], ['C', 280, 215], ['O', 280, 170], ['O', 340, 235], ['H', 395, 215]],
          en: [[0, 1, 1, -1], [1, 2, 1, -1], [2, 3, 1, -1], [3, 4, 1, -1], [4, 5, 2, 1], [4, 6, 1, -1], [6, 7, 1, 0]],
          ba: [{ g: 'O–H (acide carboxylique)', c: 2980, w: 520, d: 0.75 }, { g: 'C=O (acide carboxylique)', c: 1740, w: 60, d: 0.85 }] },
        2: { n: 'butanal', at: [['C', 50, 215], ['C', 110, 190], ['C', 170, 215], ['C', 230, 190], ['O', 230, 148], ['H', 290, 215]],
          en: [[0, 1, 1, -1], [1, 2, 1, -1], [2, 3, 1, -1], [3, 4, 2, 1], [3, 5, 1, 0]],
          ba: [{ g: 'C–H (aldéhyde)', c: 2830, w: 90, d: 0.35 }, { g: 'C=O (aldéhyde)', c: 1720, w: 60, d: 0.82 }] },
      };
      const huella = [[1250, 14, 0.25], [1180, 16, 0.3], [1100, 14, 0.4], [1030, 18, 0.28], [940, 12, 0.22], [880, 15, 0.3], [790, 12, 0.35], [700, 14, 0.26], [610, 14, 0.2]];
      const nuX = (v) => 60 + ((4000 - v) / 3500) * 700;
      const absorb = (m, v) => { let a = 0; MOL[m].ba.forEach((b) => { a += b.d * Math.exp(-Math.pow((v - b.c) / (b.w / 2.2), 2)); }); huella.forEach((h) => { a += h[2] * Math.exp(-Math.pow((v - h[0]) / h[1], 2)) * (m === 1 ? 1 : m === 2 ? 0.8 : 0.9); }); return clamp(a, 0, 0.97); };
      const S = { mol: 0, nu: 3900, barrer: false };
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'sel', id: 'mol', txt: 'Molécula', opciones: [MOL[0].n, MOL[1].n, MOL[2].n], val: 0 },
          { tipo: 'rango', id: 'nu', txt: 'ν̃', min: 500, max: 4000, paso: 10, val: 3900, fmt: (v) => Math.round(v) + ' cm⁻¹' },
          { tipo: 'btn', txt: '▶ Barrer', al: (S, E) => { S.barrer = true; E.set('nu', 4000); } },
        ],
        alCambiar(id, v, S) { if (id === 'nu') S.barrer = false; },
        paso(dt, S, E) { if (S.barrer) { const v = S.nu - dt * (S.red ? 900 : 480); if (v <= 520) { S.barrer = false; E.set('nu', 520); } else E.set('nu', v); } },
        ir(n, S, E) {
          S.barrer = false;
          if (n === 0) { E.el.mol.value = 0; S.mol = 0; E.set('nu', 3900); }
          else if (n === 1) { E.el.mol.value = 0; S.mol = 0; E.set('nu', 3500); }
          else if (n === 2) { E.el.mol.value = 0; S.mol = 0; E.set('nu', 4000); if (S.red) E.set('nu', 1720); else S.barrer = true; }
          else if (n === 3) { E.set('nu', 1740); E.el.mol.value = 1; S.mol = 1; }
          else if (n === 4) { E.set('nu', 900); }
        },
        dibujar(c, S) {
          const m = MOL[S.mol], nu = S.nu, n = S.n;
          const T = 1 - absorb(S.mol, nu);
          // haz de fotones (arriba)
          txt(c, 'haz IR', 38, 50, { s: 12, c: T2 });
          c.beginPath(); for (let x = 70; x <= 470; x += 3) { const am = (x < 230 ? 11 : 11 * Math.sqrt(T)); const y = 50 + am * Math.sin(x * (0.05 + nu / 60000) - S.t * 9); x === 70 ? c.moveTo(x, y) : c.lineTo(x, y); } c.strokeStyle = AM; c.lineWidth = 2; c.stroke();
          rr(c, 225, 72, 14, 10, 3); c.fillStyle = GR; c.fill();
          // molécula
          const A = m.at.map((a) => ({ e: a[0], x: a[1], y: a[2] }));
          let absG = -1, ag = 0; m.ba.forEach((b, i) => { const a = b.d * Math.exp(-Math.pow((nu - b.c) / (b.w / 2.2), 2)); if (a > ag) { ag = a; absG = i; } });
          const amp = (absG >= 0 ? ag : 0) * (S.red ? 5 : 11) * Math.sin(S.t * (10 + nu / 120));
          m.en.forEach((e) => { if (e[3] === absG && absG >= 0 && ag > 0.05) { const [i, j] = e, dx = A[j].x - A[i].x, dy = A[j].y - A[i].y, L = Math.hypot(dx, dy); A[i].x -= (dx / L) * amp; A[i].y -= (dy / L) * amp; A[j].x += (dx / L) * amp; A[j].y += (dy / L) * amp; } });
          m.en.forEach((e) => { const a = A[e[0]], b = A[e[1]], vib = e[3] === absG && absG >= 0 && ag > 0.05; const L = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L; const col = vib ? MG : T2; if (e[2] === 2) { lin(c, a.x + nx * 3, a.y + ny * 3, b.x + nx * 3, b.y + ny * 3, col, 2.5); lin(c, a.x - nx * 3, a.y - ny * 3, b.x - nx * 3, b.y - ny * 3, col, 2.5); } else lin(c, a.x, a.y, b.x, b.y, col, vib ? 4 : 2.5); });
          A.forEach((a) => { const col = a.e === 'O' ? '#ff5a5a' : a.e === 'H' ? '#e8eefc' : '#aab4d4'; atomo(c, a.x, a.y, a.e === 'H' ? 11 : 14, col, a.e === 'H' ? '' : a.e, TX); if (a.e === 'H') txt(c, 'H', a.x, a.y, { s: 11, b: 1, c: TX }); });
          if (absG >= 0 && ag > 0.15) { const [i, j] = m.en.find((e) => e[3] === absG); const mx = (A[i].x + A[j].x) / 2; flecha(c, mx, 66, mx, A[i].y < A[j].y ? A[i].y - 22 : A[j].y - 22, MG, 2); txt(c, m.ba[absG].g, mx, 108, { s: 13, b: 1, c: MG }); }
          txt(c, m.n, 250, 250, { s: 13, c: T2 });
          // inset: niveles de energía
          panel(c, 500, 40, 280, 208, GR); txt(c, 'niveaux d’énergie quantifiés', 640, 56, { s: 12, c: T2 });
          const nb = m.ba.reduce((p, b) => (Math.abs(nu - b.c) < Math.abs(nu - p.c) ? b : p), m.ba[0]);
          const gap = 40 + (nb.c / 4000) * 110, yi = 220, yf = yi - gap;
          lin(c, 540, yi, 740, yi, T2, 3); txt(c, 'Eᵢ', 524, yi, { s: 12, c: T2 }); lin(c, 540, yf, 740, yf, T2, 3); txt(c, 'E_f', 524, yf, { s: 12, c: T2 });
          const hv = 40 + (nu / 4000) * 110, ok = ag > 0.3;
          if (ok) { flecha(c, 640, yi, 640, yf + 2, AM, 3); txt(c, 'ΔE = h·ν ✔', 694, (yi + yf) / 2, { s: 13, c: AM, b: 1 }); } else { flecha(c, 600, yi, 600, yi - hv, '#7b86ad', 2); lin(c, 600, yi - hv, 600 + 24, yi - hv, '#7b86ad', 1); txt(c, 'no encaja', 690, 150, { s: 13, c: T2 }); lin(c, 660, yf, 680, yf - 0, MG, 0.1); }
          // espectro
          const x0 = 60, y0 = 276, y1 = 366;
          txt(c, 'T (%)', 30, 268, { s: 12, c: T2 }); lin(c, x0, y0 - 2, x0, y1, T2, 1); lin(c, x0, y1, 760, y1, T2, 1);
          [4000, 3500, 3000, 2500, 2000, 1500, 1000, 500].forEach((v) => { lin(c, nuX(v), y1, nuX(v), y1 + 4, T2, 1); txt(c, String(v), nuX(v), y1 + 14, { s: 11, c: T2 }); });
          txt(c, 'ν̃ (cm⁻¹)', 760, y1 + 29, { s: 11, c: T2, a: 'right' });
          if (n >= 4) { c.fillStyle = '#ff3da622'; c.fillRect(nuX(1300), y0 - 2, 760 - nuX(1300), y1 - y0 + 2); txt(c, 'zone des empreintes digitales', nuX(1300) - 90, y1 + 29, { s: 12, c: MG, b: 1, a: 'left' }); }
          if (n >= 3) { lin(c, nuX(1300), y0 - 2, nuX(1300), y1, MG, 1, [4, 4]); txt(c, '1 300', nuX(1300), y0 - 10, { s: 11, c: MG }); }
          c.beginPath(); for (let v = 4000; v >= 500; v -= 10) { const T2v = 1 - absorb(S.mol, v), x = nuX(v), y = y1 - T2v * (y1 - y0 - 6); v === 4000 ? c.moveTo(x, y) : c.lineTo(x, y); } c.strokeStyle = VE; c.lineWidth = 2.2; c.stroke();
          if (n >= 3) m.ba.forEach((b) => { const x = nuX(b.c); txt(c, b.g, x, y1 - (1 - absorb(S.mol, b.c)) * (y1 - y0 - 6) + (b.c > 2500 ? 16 : 14), { s: 12, c: AM, b: 1 }); });
          const cx = nuX(nu), cy = y1 - T * (y1 - y0 - 6);
          lin(c, cx, y0 - 2, cx, y1, AM, 1.4, [3, 3]); circ(c, cx, cy, 5, AM);
          txt(c, 'ν̃ = ' + Math.round(nu) + ' cm⁻¹  (λ = ' + (10000 / nu).toFixed(2).replace('.', ',') + ' µm)   T = ' + Math.round(T * 100) + ' %', 410, 262, { s: 13, c: TX });
        },
      });
    },
    test: [
      { pregunta: 'Una banda fina y fuerte hacia 1 720 cm⁻¹ en un espectro IR corresponde a…', opciones: ['un enlace C=O', 'un enlace O–H de alcohol', 'la zona de las huellas dactilares'], correcta: 0, explicacion: 'El C=O de una cetona está en 1 705–1 725 cm⁻¹ (tabla de datos).' },
      { pregunta: '¿Por qué un fotón IR de energía cualquiera no es absorbido por la molécula?', opciones: ['Porque los niveles están cuantificados: solo se absorbe si hν = ΔE', 'Porque el IR no tiene energía', 'Porque las moléculas no vibran'], correcta: 0, explicacion: 'La absorción exige coincidencia exacta con el salto entre dos niveles.' },
      { pregunta: 'En el eje horizontal de un espectro IR se representa…', opciones: ['La longitud de onda λ en nm', 'El número de onda ν̃ = 1/λ en cm⁻¹', 'La absorbancia A'], correcta: 1, explicacion: 'Se representa T (%) en función de ν̃ (cm⁻¹).' },
    ],
  });

  // ---- 2.2 Conductimetría: los iones migran, cada uno a su ritmo (p. 66) ----
  reg({
    id: 'conductimetria-iones', capitulos: ['methodes-physiques'], titulo: 'Conductividad: los iones que migran', fr: 'Loi de Kohlrausch : σ = Σ λᵢ·[Xᵢ]', pagina_pdf: 66,
    resumen: 'La corriente en una disolución la llevan los iones: cationes hacia un electrodo, aniones hacia el otro. Cada ion aporta según su conductividad molar iónica λ y su concentración.',
    pasos: [
      { titulo: 'Iones libres, sin orden', texto: 'Una disolución de NaCl contiene Na⁺ y Cl⁻ que se agitan al azar. Sin tensión entre los electrodos no hay corriente neta: no hay movimiento de conjunto.', fr: 'La conductance traduit la capacité de la solution à conduire le courant.' },
      { titulo: 'Con tensión: migración', texto: 'Pulsa «Tensión»: los cationes van hacia el electrodo negativo y los aniones hacia el positivo. Ese desplazamiento ordenado de cargas es lo que mide el conductímetro (G = I/U).', fr: 'G = 1/R = I/U' },
      { titulo: 'Cada ion corre a su ritmo', texto: 'Elige «HCl»: el ion H₃O⁺ (λ = 35,0·10⁻³ S·m²·mol⁻¹) va mucho más rápido que Na⁺ (5,0·10⁻³). La velocidad de la animación es proporcional a λ (valores de la fig. 10, a 25 °C).', fr: 'λ(H₃O⁺) = 35,0·10⁻³ ; λ(Na⁺) = 5,0·10⁻³ ; λ(HO⁻) = 19,8·10⁻³ S·m²·mol⁻¹' },
      { titulo: 'Ley de Kohlrausch', texto: 'σ es la suma de lo que aporta cada ion: λᵢ·[Xᵢ], con la concentración en mol·m⁻³ (1 mmol·L⁻¹ = 1 mol·m⁻³). Mueve la concentración y mira cómo crecen las barras de cada ion: σ es proporcional a c.', fr: 'σ = Σ λᵢ·[Xᵢ]  (σ en S·m⁻¹, [Xᵢ] en mol·m⁻³)' },
      { titulo: 'Solo vale para c < 10⁻² mol·L⁻¹', texto: 'Sube la concentración por encima de 10 mmol·L⁻¹: la ley deja de ser válida (los iones se estorban). Dentro del dominio, σ y G son proporcionales a c, y eso permite dosar por calibrado.', fr: 'La loi de Kohlrausch n’est valable que pour des concentrations inférieures à 10⁻² mol·L⁻¹.' },
    ],
    montar(host, api) {
      const L = { 'H₃O⁺': 35.0, 'Na⁺': 5.0, 'K⁺': 7.4, 'HO⁻': 19.8, 'Cl⁻': 7.6, 'Br⁻': 7.8 };
      const SAL = [{ n: 'NaCl', i: [['Na⁺', 1], ['Cl⁻', 1]] }, { n: 'HCl', i: [['H₃O⁺', 1], ['Cl⁻', 1]] }, { n: 'NaOH', i: [['Na⁺', 1], ['HO⁻', 1]] }, { n: 'KBr', i: [['K⁺', 1], ['Br⁻', 1]] }];
      const COL = { 'H₃O⁺': MG, 'Na⁺': AZ, 'K⁺': '#9b5de5', 'HO⁻': OR, 'Cl⁻': VE, 'Br⁻': '#c0a060' };
      const S = { sal: 0, c: 5, v: false, ions: [] };
      const X0 = 90, X1 = 710, Y0 = 70, Y1 = 238;
      const rng = PCB.util.rng ? PCB.util.rng(7) : Math.random;
      function reparto(S) { S.ions = []; SAL[S.sal].i.forEach(([nm]) => { const q = Math.max(2, Math.round(S.c * 2.2)); for (let k = 0; k < q; k++) S.ions.push({ nm, x: X0 + 6 + rng() * (X1 - X0 - 12), y: Y0 + 10 + rng() * (Y1 - Y0 - 20), ph: rng() * 6 }); }); }
      reparto(S);
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'sel', id: 'sal', txt: 'Soluto', opciones: SAL.map((s) => s.n), val: 0 },
          { tipo: 'rango', id: 'c', txt: 'c', min: 0.5, max: 20, paso: 0.5, val: 5, fmt: (v) => v.toFixed(1).replace('.', ',') + ' mmol/L' },
          { tipo: 'btn', id: 'bv', txt: '⚡ Tensión', al: (S, E, b) => { S.v = !S.v; b.classList.toggle('on', S.v); } },
        ],
        alCambiar(id, v, S) { if (id === 'sal' || id === 'c') reparto(S); },
        paso(dt, S) {
          const k = S.red ? 2.2 : 4.5;
          S.ions.forEach((p) => { const neg = p.nm.endsWith('⁻'), v = S.v ? (neg ? -1 : 1) * L[p.nm] * k : 0; p.x += v * dt + Math.sin(S.t * 3 + p.ph) * (S.red ? 5 : 14) * dt; p.y += Math.cos(S.t * 2.3 + p.ph * 1.7) * (S.red ? 5 : 16) * dt; if (p.x > X1 - 6) p.x = X0 + 6; if (p.x < X0 + 6) p.x = X1 - 6; p.y = clamp(p.y, Y0 + 8, Y1 - 8); });
        },
        ir(n, S, E) { const set = (sal, c, v) => { E.el.sal.value = sal; S.sal = sal; E.set('c', c); S.v = v; E.el.bv.classList.toggle('on', v); reparto(S); };
          if (n === 0) set(0, 5, false); else if (n === 1) set(0, 5, true); else if (n === 2) set(1, 5, true); else if (n === 3) set(0, 5, true); else set(0, 14, true); },
        dibujar(c, S) {
          const n = S.n, sal = SAL[S.sal];
          // célula
          rr(c, X0, Y0, X1 - X0, Y1 - Y0, 6); c.fillStyle = '#103a4a55'; c.fill(); c.strokeStyle = AZ; c.lineWidth = 2; c.stroke();
          c.fillStyle = '#ff3da6'; c.fillRect(X0 - 12, Y0, 12, Y1 - Y0); c.fillStyle = '#4cc9f0'; c.fillRect(X1, Y0, 12, Y1 - Y0);
          txt(c, '+', X0 - 6, Y0 - 10, { s: 16, b: 1, c: MG }); txt(c, '−', X1 + 6, Y0 - 10, { s: 16, b: 1, c: AZ });
          if (S.v) { flecha(c, X0 + 60, Y0 - 12, X1 - 60, Y0 - 12, AM, 1.5); txt(c, 'champ électrique', W / 2, Y0 - 24, { s: 12, c: AM }); }
          S.ions.forEach((p) => { const neg = p.nm.endsWith('⁻'); circ(c, p.x, p.y, 7, COL[p.nm] + '88', COL[p.nm], 1.5); txt(c, neg ? '−' : '+', p.x, p.y, { s: 10, b: 1 }); });
          // leyenda
          sal.i.forEach(([nm], k) => { circ(c, 150 + k * 190, Y1 + 20, 7, COL[nm] + '88', COL[nm], 1.5); txt(c, nm + '  λ = ' + String(L[nm]).replace('.', ',') + '·10⁻³', 168 + k * 190, Y1 + 20, { s: 12, a: 'left', c: TX }); });
          // barras de σ
          const cc = S.c; let tot = 0; const parts = sal.i.map(([nm]) => { const v = L[nm] * 1e-3 * cc; tot += v; return [nm, v]; });
          const valido = cc < 10;
          if (n >= 3 || n === 2) {
            const bx = 90, by = 300, bw = 520, mx = 0.3;
            txt(c, 'σ = Σ λᵢ·[Xᵢ]', 50, by - 14, { s: 13, c: T2, a: 'left', b: 1 });
            let x = bx; parts.forEach(([nm, v]) => { const w = Math.min(bw, (v / mx) * bw); rr(c, x, by, Math.max(2, w), 30, 4); c.fillStyle = COL[nm]; c.fill(); if (w > 70) txt(c, nm + ' ' + v.toFixed(3).replace('.', ','), x + w / 2, by + 15, { s: 12, b: 1, c: '#0a0f20' }); x += w; });
            txt(c, 'σ = ' + tot.toFixed(3).replace('.', ',') + ' S·m⁻¹', 630, by + 15, { s: 16, b: 1, c: AM, a: 'left' });
            const f = (nm, v) => String(L[nm]).replace('.', ',') + '·10⁻³ × ' + cc.toFixed(1).replace('.', ',') ; txt(c, parts.map(([nm]) => 'λ(' + nm + ')·[' + nm + ']').join(' + ') + ' = ' + parts.map(([nm]) => String(L[nm]).replace('.', ',') + '·10⁻³ × ' + cc.toFixed(1).replace('.', ',')).join(' + '), 90, by + 48, { s: 12, c: T2, a: 'left' });
          } else txt(c, n === 1 ? 'los iones migran: cationes → (−) · aniones → (+)' : 'sin tensión: movimiento al azar, sin corriente neta', W / 2, 330, { s: 14, c: T2 });
          if (n >= 4) { chip(c, valido ? 'c < 10 mmol/L : ley válida' : 'c ≥ 10 mmol/L : fuera del dominio', 590, 268, valido ? VE : MG, { s: 13 }); lin(c, X0, Y0 - 0.5, X1, Y0, 'rgba(0,0,0,0)', 0.1); }
        },
      });
    },
    test: [
      { pregunta: 'En una disolución de HCl con tensión aplicada, ¿qué ion se mueve más deprisa?', opciones: ['H₃O⁺ (λ = 35,0·10⁻³)', 'Cl⁻ (λ = 7,6·10⁻³)', 'Los dos igual'], correcta: 0, explicacion: 'La velocidad de migración va con λ: H₃O⁺ tiene el λ más grande de la tabla.' },
      { pregunta: 'Si se duplica la concentración de NaCl (dentro del dominio de validez), σ…', opciones: ['se duplica', 'se divide por dos', 'no cambia'], correcta: 0, explicacion: 'σ = Σ λᵢ·[Xᵢ] es proporcional a c.' },
      { pregunta: 'En la ley de Kohlrausch, ¿en qué unidad hay que poner [Xᵢ]?', opciones: ['mol·L⁻¹', 'mol·m⁻³', 'g·L⁻¹'], correcta: 1, explicacion: 'Con λ en S·m²·mol⁻¹ y σ en S·m⁻¹ las concentraciones van en mol·m⁻³.' },
    ],
  });

  // ---- 2.3 Dosaje por etalonnage (p. 66, 67, 73) ----
  reg({
    id: 'etalonnage', capitulos: ['methodes-physiques'], titulo: 'Dosar por calibrado: gama patrón y recta de etalonnage', fr: 'Dosage par étalonnage', pagina_pdf: 66,
    resumen: 'Se prepara por dilución una gama de disoluciones de concentración conocida, se mide su absorbancia, se traza A = f(c) y se lee en la recta la concentración de la muestra desconocida.',
    pasos: [
      { titulo: 'La gama patrón por dilución', texto: 'A partir de una solución madre de concentración conocida se preparan por dilución soluciones hijas S₁…S₅ de concentraciones crecientes y conocidas. Cuanto más concentrada, más intenso el color.', fr: 'On prépare par dilution une gamme de solutions filles de concentrations connues.' },
      { titulo: 'Se mide la absorbancia de cada una', texto: 'Pulsa «Medir»: el espectrofotómetro da A para cada tubo (a la λ del máximo de absorción) y cada medida es un punto (c, A) en la gráfica.', fr: 'Mesurer l’absorbance à λ_max.' },
      { titulo: 'Los puntos se alinean: A = k·c', texto: 'Dentro del dominio (c < 10⁻² mol·L⁻¹) los puntos caen sobre una recta por el origen: es la ley de Beer-Lambert. Esa recta es la curva de etalonnage.', fr: 'Loi de Beer-Lambert : A = k·c, valable pour c < 10⁻² mol·L⁻¹.' },
      { titulo: 'La muestra desconocida', texto: 'Mide la absorbancia de la muestra (tubo X) y proyecta horizontalmente hasta la recta y luego hacia abajo: así lees c_déduite. Mueve el deslizador y comprueba que la lectura sigue a la concentración real.', fr: 'Pour déterminer la concentration inconnue, on mesure l’absorbance et on la lit sur la courbe d’étalonnage.' },
      { titulo: 'Trampa: fuera de la gama, hay que diluir', texto: 'Si A sale por encima de la gama patrón, no se puede leer. Diluye la muestra ×2 o ×5, lee c y no olvides multiplicar por el factor de dilución para volver a la muestra original.', fr: 'Erreur typique : oublier le facteur de dilution lors de la lecture de la courbe d’étalonnage.' },
    ],
    montar(host, api) {
      const K = 2200; // L·mol⁻¹ (valor ilustrativo coherente con la fig. de la fiche mémo p. 67)
      const CS = [1, 2, 3, 4, 5]; // ×10⁻⁴ mol/L
      const FD = [1, 2, 5];
      const S = { c0: 3.2, fd: 0, med: 0, medir: false };
      const gx = (cc) => 470 + (cc / 6) * 290, gy = (A) => 330 - (A / 1.4) * 250;
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'rango', id: 'c0', txt: 'c (muestra)', min: 0.5, max: 12, paso: 0.1, val: 3.2, fmt: (v) => v.toFixed(1).replace('.', ',') + '·10⁻⁴' },
          { tipo: 'sel', id: 'fd', txt: 'Diluir', opciones: ['no (×1)', '×2', '×5'], val: 0 },
          { tipo: 'btn', txt: '▶ Medir patrones', al: (S) => { S.med = 0; S.medir = true; } },
        ],
        alCambiar() {},
        paso(dt, S) { if (S.medir) { S.med = Math.min(5, S.med + dt * (S.red ? 20 : 1.3)); if (S.med >= 5) S.medir = false; } },
        ir(n, S, E) { S.medir = false; S.fd = 0; E.el.fd.value = 0; if (n === 0) S.med = 0; else if (n === 1) { S.med = 0; S.medir = !S.red; if (S.red) S.med = 5; } else if (n === 2) S.med = 5; else if (n === 3) { S.med = 5; E.set('c0', 3.2); } else { S.med = 5; E.set('c0', 8.5); S.fd = 2; E.el.fd.value = 2; } },
        dibujar(c, S) {
          const n = S.n, f = FD[S.fd], cm = S.c0 / f, A = K * cm * 1e-4;
          // tubos
          const tubo = (x, cc, et, col) => { const lv = 0.62; rr(c, x - 17, 90, 34, 130, 8); c.fillStyle = '#12204a'; c.fill(); c.strokeStyle = '#7b86ad'; c.lineWidth = 2; c.stroke(); const a = clamp(cc / 5, 0.04, 1); c.save(); rr(c, x - 15, 90 + 130 * (1 - lv), 30, 130 * lv - 2, 6); c.clip(); c.fillStyle = col || AZ; c.globalAlpha = 0.12 + 0.75 * a; c.fillRect(x - 15, 90, 30, 140); c.restore(); c.globalAlpha = 1; txt(c, et, x, 236, { s: 13, b: 1, c: col || TX }); txt(c, cc.toFixed(1).replace('.', ',').replace(',0', ''), x, 254, { s: 12, c: T2 }); };
          txt(c, 'c en 10⁻⁴ mol·L⁻¹', 190, 70, { s: 12, c: T2 });
          CS.forEach((cc, i) => { c.globalAlpha = n === 0 ? clamp((S.t - i * 0.25) * 2, 0, 1) : 1; tubo(50 + i * 56, cc, 'S' + (i + 1)); c.globalAlpha = 1; });
          if (n >= 3) tubo(360, cm, 'X', MG);
          // espectrofotómetro lectura
          if (n >= 1) { const ult = Math.min(5, Math.ceil(S.med)); const Ai = ult > 0 ? K * CS[Math.max(0, ult - 1)] * 1e-4 : 0; txt(c, n >= 3 ? 'A(X) = ' + A.toFixed(2).replace('.', ',') : 'A = ' + Ai.toFixed(2).replace('.', ','), 200, 290, { s: 18, b: 1, c: AM }); }
          // gráfica
          lin(c, gx(0), gy(0), gx(6), gy(0), T2, 1); lin(c, gx(0), gy(0), gx(0), gy(1.4), T2, 1); txt(c, 'A', gx(0) - 12, gy(1.4), { s: 13, c: T2 }); txt(c, 'c (10⁻⁴ mol·L⁻¹)', gx(6) - 10, gy(0) + 28, { s: 12, c: T2, a: 'right' });
          for (let i = 0; i <= 6; i++) { lin(c, gx(i), gy(0), gx(i), gy(0) + 4, T2, 1); txt(c, String(i), gx(i), gy(0) + 14, { s: 11, c: T2 }); } [0.5, 1.0].forEach((a) => { lin(c, gx(0) - 4, gy(a), gx(0), gy(a), T2, 1); txt(c, String(a).replace('.', ','), gx(0) - 16, gy(a), { s: 11, c: T2 }); });
          if (n >= 2) { lin(c, gx(0), gy(0), gx(5.4), gy(K * 5.4e-4), VE, 2); txt(c, 'A = k·c', gx(4.6), gy(K * 4.6e-4) + 24, { s: 13, c: VE, b: 1, a: 'left' }); }
          CS.forEach((cc, i) => { if (i < Math.floor(S.med + 0.001)) { circ(c, gx(cc), gy(K * cc * 1e-4), 5, MG, null); } });
          if (n >= 2) txt(c, 'dominio de validez: c < 10⁻² mol·L⁻¹', 600, 70, { s: 12, c: AM });
          if (n >= 3) {
            const fuera = A > 1.35, ya = gy(Math.min(A, 1.35)), xs = gx(cm);
            if (!fuera) { lin(c, gx(0), ya, xs, ya, MG, 1.5, [5, 4]); flecha(c, xs, ya, xs, gy(0) - 2, MG, 1.5); circ(c, xs, ya, 6, MG, '#fff', 1.5);
              txt(c, 'c_déduite = ' + cm.toFixed(1).replace('.', ',') + '·10⁻⁴', xs + 8, gy(0) - 14, { s: 12, c: MG, b: 1, a: 'left' });
              if (f > 1) { chip(c, 'c muestra = ' + cm.toFixed(1).replace('.', ',') + ' × ' + f + ' = ' + (cm * f).toFixed(1).replace('.', ',') + '·10⁻⁴', 590, 100, AM, { s: 13 }); } else txt(c, 'muestra: c = ' + S.c0.toFixed(1).replace('.', ',') + '·10⁻⁴', 590, 100, { s: 13, c: T2 });
            } else { chip(c, 'A fuera de la gama patrón → diluir la muestra', 590, 100, MG, { s: 13 }); lin(c, gx(0), gy(1.35), gx(6), gy(1.35), MG, 1.2, [6, 4]); }
          }
        },
      });
    },
    test: [
      { pregunta: '¿Para qué se prepara una gama patrón?', opciones: ['Para trazar la curva A = f(c) con concentraciones conocidas', 'Para cambiar el pH de la muestra', 'Para eliminar la absorbancia'], correcta: 0, explicacion: 'Las soluciones hijas dan los puntos de la curva de etalonnage.' },
      { pregunta: 'La muestra desconocida se diluyó ×5 y la curva da c = 1,4·10⁻⁴ mol·L⁻¹. La muestra original tiene…', opciones: ['1,4·10⁻⁴ mol·L⁻¹', '7,0·10⁻⁴ mol·L⁻¹', '0,28·10⁻⁴ mol·L⁻¹'], correcta: 1, explicacion: 'Hay que multiplicar por el factor de dilución: 1,4 × 5 = 7,0.' },
      { pregunta: 'La ley A = k·c solo es válida para…', opciones: ['c < 10⁻² mol·L⁻¹', 'cualquier concentración', 'c > 1 mol·L⁻¹'], correcta: 0, explicacion: 'Beer-Lambert y Kohlrausch valen para c < 10⁻² mol·L⁻¹.' },
    ],
  });

  // =====================================================================================
  // CAP. 3 · methodes-chimiques
  // =====================================================================================

  // Nube de partículas que se agitan dentro de un recinto (b = {x0,y0,x1,y1}, mutable)
  function nube(b, seed) {
    const rng = PCB.util.rng ? PCB.util.rng(seed || 3) : Math.random, sp = {}, fl = [];
    return {
      b, sp,
      sync(k, n, col, lab) { const a = (sp[k] = sp[k] || []); while (a.length < n) a.push({ x: b.x0 + rng() * (b.x1 - b.x0), y: b.y0 + rng() * (b.y1 - b.y0), vx: (rng() - 0.5) * 30, vy: (rng() - 0.5) * 30, col, lab }); while (a.length > n) { const q = a.pop(); fl.push({ x: q.x, y: q.y, t: 0, col: q.col }); } },
      step(dt, ag) { Object.keys(sp).forEach((k) => sp[k].forEach((p) => { p.vx += (rng() - 0.5) * 260 * dt * ag; p.vy += (rng() - 0.5) * 260 * dt * ag; const v = Math.hypot(p.vx, p.vy), m = 38 * ag; if (v > m) { p.vx *= m / v; p.vy *= m / v; } p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < b.x0) { p.x = b.x0; p.vx = Math.abs(p.vx); } if (p.x > b.x1) { p.x = b.x1; p.vx = -Math.abs(p.vx); } if (p.y < b.y0) { p.y = b.y0; p.vy = Math.abs(p.vy); } if (p.y > b.y1) { p.y = b.y1; p.vy = -Math.abs(p.vy); } })); fl.forEach((f) => (f.t += dt)); while (fl.length && fl[0].t > 0.5) fl.shift(); },
      draw(c, r) { r = r || 6; Object.keys(sp).forEach((k) => sp[k].forEach((p) => { circ(c, p.x, p.y, r, p.col + 'aa', p.col, 1.5); if (p.lab) txt(c, p.lab, p.x, p.y, { s: 9, b: 1 }); })); fl.forEach((f) => { c.globalAlpha = 1 - f.t / 0.5; circ(c, f.x, f.y, 6 + f.t * 30, null, '#ffffff', 2); c.globalAlpha = 1; }); },
    };
  }
  const matraz = (c, x, y, w, h, col) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + h - 14); c.quadraticCurveTo(x, y + h, x + 14, y + h); c.lineTo(x + w - 14, y + h); c.quadraticCurveTo(x + w, y + h, x + w, y + h - 14); c.lineTo(x + w, y); c.strokeStyle = col || '#7b86ad'; c.lineWidth = 3; c.stroke(); };

  // ---- 3.1 Dilución: se conserva n (p. 88) ----
  reg({
    id: 'dilucion-moleculas', capitulos: ['methodes-chimiques'], titulo: 'Diluir: las mismas moléculas en más volumen', fr: 'Dilution : conservation de la quantité de matière', pagina_pdf: 88,
    resumen: 'Al diluir se añade agua pero no soluto: la cantidad de materia n que se pipetea es la misma que acaba en la fiole. Lo que baja es la concentración, porque esas moléculas se reparten en más volumen.',
    pasos: [
      { titulo: 'La solución madre', texto: 'La solución-mère es la concentrada: muchas moléculas de soluto por mL. Es la que se quiere diluir para obtener una solution-fille de concentración menor.', fr: 'Solution-mère / solution-fille.' },
      { titulo: 'Se pipetea un volumen V₀', texto: 'Con la pipette jaugée se toma un volumen V₀ de la madre. Ojo a los puntos del interior de la pipeta: esos son todos los que habrá en la solución hija. Cambia V₀ con el deslizador.', fr: 'On pipette un volume de solution-mère avec une pipette jaugée.' },
      { titulo: 'Se vierte en la fiole y se completa con agua', texto: 'Pulsa «Diluir»: el volumen sube hasta la marca de la fiole jaugée (V_f) con agua destilada. El agua no trae soluto: el número de puntos no cambia.', fr: 'Compléter avec de l’eau distillée dans une fiole jaugée.' },
      { titulo: 'n se conserva, c no', texto: 'Cuenta los puntos: son los mismos antes y después. Como c = n/V, al crecer V la concentración baja. Se cumple c₀·V₀ = c_f·V_f.', fr: 'Lors d’une dilution, la quantité de matière de soluto ne change pas : c₀·V₀ = c_f·V_f.' },
      { titulo: 'Factor de dilución', texto: 'Prueba con distintos V₀ y V_f: la concentración se divide por F = V_f / V₀. Con V₀ = 10 mL y V_f = 100 mL, F = 10: la hija es 10 veces menos concentrada, aunque tenga los mismos puntos.', fr: 'c_mère / c_fille = V_fille / V_mère' },
    ],
    montar(host, api) {
      const C0 = 0.5, DENS = 0.8; // c₀ ilustrativa (mol·L⁻¹); 0,8 puntos por mL de madre
      const S = { fase: 0, V0: 10, Vf: 100, Va: 10, anim: false };
      const rng = PCB.util.rng ? PCB.util.rng(5) : Math.random;
      const madre = nube({ x0: 62, y0: 150, x1: 190, y1: 296 }, 11);
      madre.sync('m', 40, MG);
      const pts = []; for (let i = 0; i < 40; i++) pts.push({ u: rng(), w: rng(), ph: rng() * 6 });
      const FY0 = 118, FH = 190, FX = 470, FW = 150, VMAX = 250; // fiole
      const Hn = (V) => (V / VMAX) * FH;
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'rango', id: 'V0', txt: 'V₀ (pipeta)', min: 5, max: 50, paso: 5, val: 10, fmt: (v) => v + ' mL' },
          { tipo: 'rango', id: 'Vf', txt: 'V_f (fiole)', min: 50, max: 250, paso: 50, val: 100, fmt: (v) => v + ' mL' },
          { tipo: 'btn', txt: '▶ Diluir', al: (S) => { S.fase = 2; S.Va = S.V0; S.anim = true; if (S.red) { S.Va = S.Vf; S.anim = false; } } },
        ],
        alCambiar(id, v, S) { if (S.fase === 2) { S.Va = S.Vf; S.anim = false; } else S.Va = S.V0; if (S.Vf < S.V0) { /* V_f ≥ V₀ siempre en los pasos permitidos (50 ≥ 50) */ } },
        paso(dt, S) { madre.step(dt, S.red ? 0.4 : 1); if (S.anim) { S.Va += dt * 45; if (S.Va >= S.Vf) { S.Va = S.Vf; S.anim = false; } } },
        ir(n, S, E) { S.anim = false; S.fase = n === 0 ? 0 : n === 1 ? 1 : 2; if (n === 2) { S.Va = S.V0; S.anim = !S.red; if (S.red) S.Va = S.Vf; } else if (n >= 3) { S.Va = S.Vf; } else S.Va = S.V0; if (n === 4) { E.set('V0', 10); E.set('Vf', 100); S.Va = S.Vf; } },
        dibujar(c, S) {
          const nT = Math.round(DENS * S.V0), n = S.n;
          // madre
          txt(c, 'solution-mère', 126, 120, { s: 14, b: 1, c: MG }); txt(c, '50 mL', 126, 136, { s: 12, c: T2 });
          matraz(c, 50, 150, 152, 150, '#c9628f'); madre.b.y0 = 150; madre.sync('m', 40 - (S.fase >= 1 ? nT : 0), MG); madre.draw(c, 6);
          txt(c, 'C₀ = ' + String(C0).replace('.', ',') + ' mol·L⁻¹', 126, 322, { s: 13, c: T2 });
          // pipeta
          const px = 305;
          rr(c, px - 14, 100, 28, 190, 8); c.fillStyle = '#12204a'; c.fill(); c.strokeStyle = '#7b86ad'; c.lineWidth = 2; c.stroke();
          txt(c, 'pipette jaugée', px, 84, { s: 12, c: T2 }); txt(c, S.V0 + ' mL', px, 303, { s: 13, b: 1, c: AM });
          if (S.fase === 1) { c.save(); rr(c, px - 12, 102, 24, 186, 6); c.clip(); c.fillStyle = '#ff3da633'; c.fillRect(px - 12, 100, 24, 190); c.restore(); for (let i = 0; i < nT; i++) { const q = pts[i]; circ(c, px - 6 + (i % 2) * 12 + Math.sin(S.t * 2 + q.ph) * 1.5, 280 - ((i + 0.5) / Math.max(nT, 1)) * 170, 4.5, MG + 'aa', MG, 1.2); } if (n >= 1) flecha(c, 196, 210, 280, 210, T2, 1.5); }
          if (S.fase >= 2) flecha(c, 336, 150, 440, 150, T2, 1.5);
          // fiole
          const lv = S.fase >= 2 ? S.Va : 0, hh = Hn(lv), top = FY0 + FH - hh;
          matraz(c, FX, FY0, FW, FH, '#7b86ad'); lin(c, FX + 40, FY0 - 22, FX + 40, FY0, '#7b86ad', 3); lin(c, FX + FW - 40, FY0 - 22, FX + FW - 40, FY0, '#7b86ad', 3);
          txt(c, 'fiole jaugée', FX + FW / 2, FY0 - 34, { s: 13, b: 1, c: VE });
          const mk = Hn(S.Vf); lin(c, FX - 4, FY0 + FH - mk, FX + 18, FY0 + FH - mk, AM, 2); txt(c, S.Vf + ' mL (trait de jauge)', FX - 8, FY0 + FH - mk, { s: 12, c: AM, a: 'right' });
          if (S.fase >= 2 && hh > 1) {
            c.save(); rr(c, FX + 2, top, FW - 4, hh - 1, 6); c.clip(); const a = clamp(S.V0 / S.Va, 0.06, 1); c.fillStyle = MG; c.globalAlpha = 0.1 + 0.4 * a; c.fillRect(FX, top, FW, hh); c.restore(); c.globalAlpha = 1;
            for (let i = 0; i < nT; i++) { const q = pts[i], x = FX + 10 + q.u * (FW - 20) + Math.sin(S.t * 2 + q.ph) * 2, y = top + 8 + (1 - q.w) * Math.max(0, hh - 18) + Math.cos(S.t * 1.7 + q.ph) * 2; circ(c, x, y, 4.5, MG + 'aa', MG, 1.2); }
            lin(c, FX + 2, top, FX + FW - 2, top, '#7fd0ff', 2);
          }
          const Vx = S.fase >= 2 ? S.Va : S.V0, cf = (C0 * S.V0) / Vx;
          if (S.fase >= 2) { txt(c, 'V = ' + Math.round(Vx) + ' mL', FX + FW / 2, FY0 + FH + 16, { s: 13, c: TX }); txt(c, 'c = n/V = ' + cf.toFixed(3).replace('.', ',') + ' mol·L⁻¹', FX + FW + 6, FY0 + FH - 40, { s: 13, b: 1, c: VE, a: 'left' }); }
          if (n >= 3) { chip(c, 'mismos puntos: ' + nT + ' en la pipeta = ' + nT + ' en la fiole', FX + FW / 2, 50, AM, { s: 13 }); }
          if (n >= 3 && S.fase >= 2) txt(c, 'c₀·V₀ = ' + (C0 * S.V0).toFixed(1).replace('.', ',') + ' = c_f·V_f = ' + (cf * Vx).toFixed(1).replace('.', ',') + '  (mmol)', 400, 375, { s: 14, c: TX, b: 1 });
          if (n >= 4) txt(c, 'F = V_f / V₀ = ' + Math.round((S.Vf / S.V0) * 10) / 10 + '   →   c_f = c₀ / F', 400, 398, { s: 14, c: AM, b: 1 });
        },
      });
    },
    test: [
      { pregunta: 'Al diluir una solución con agua destilada, ¿qué se conserva?', opciones: ['La cantidad de materia de soluto n', 'La concentración c', 'El volumen'], correcta: 0, explicacion: 'El agua no aporta soluto: n no cambia, lo que baja es c.' },
      { pregunta: 'Se pipetean 10 mL de madre y se completa a 100 mL. La concentración de la hija es…', opciones: ['10 veces menor', '10 veces mayor', 'igual'], correcta: 0, explicacion: 'F = 100/10 = 10: c_f = c₀/10.' },
      { pregunta: '«Creer que diluir cambia n» es un error. ¿Por qué?', opciones: ['Porque los puntos de la pipeta son los mismos que quedan en la fiole', 'Porque el agua tiene soluto', 'Porque n = c'], correcta: 0, explicacion: 'Solo se reparten en más volumen: c₀V₀ = c_fV_f.' },
    ],
  });

  // ---- 3.2 Valoración: el reactivo limitante que se agota (p. 88–90) ----
  reg({
    id: 'titrage-limitante', capitulos: ['methodes-chimiques'], titulo: 'Valoración: quién limita y qué es la equivalencia', fr: 'Titrage : réactif limitant et équivalence', pagina_pdf: 89,
    resumen: 'Cada HO⁻ vertido reacciona con una molécula de ácido etanoico hasta que se acaba: en el volumen equivalente V_E las dos cantidades se anulan a la vez; después sobra titrante.',
    pasos: [
      { titulo: 'Montaje del titrage', texto: 'En el erlenmeyer, la solution titrée: 10 mL de ácido etanoico CH₃CO₂H (c_A desconocida); en la bureta, la solution titrante: soda (HO⁻) de c_B = 1,0·10⁻² mol·L⁻¹. Reacción soporte: CH₃CO₂H + HO⁻ → CH₃CO₂⁻ + H₂O (total, rápida y única).', fr: 'Solution titrante / solution titrée ; réaction support du titrage : totale, rapide et unique.' },
      { titulo: 'Antes de la equivalencia: el titrante limita', texto: 'Vierte soda (deslizador V_B): cada HO⁻ que cae encuentra un ácido y desaparece. Mientras V_B < V_E, el HO⁻ (titrante) es el reactivo limitante: no queda nada de él y el ácido va disminuyendo.', fr: 'Avant l’équivalence, le réactif titrant est limitant.' },
      { titulo: 'Equivalencia: se anulan los dos', texto: 'En V_E = 20 mL se han mezclado ácido y base en proporciones estequiométricas: ya no queda ni ácido ni HO⁻. El avance vale x_E y n_A = c_B·V_E.', fr: 'À l’équivalence, titrant et titré sont totalement consommés : n_A = n_B.' },
      { titulo: 'Después de V_E: el titrante sobra', texto: 'Si sigues vertiendo, el ácido ya no está: el limitante pasa a ser el titrado y el HO⁻ queda en exceso. Mira cómo aparece de nuevo en la gráfica de cantidades (fig. 4 del cours).', fr: 'Après l’équivalence, le titrant n’est plus limitant : il est en excès.' },
      { titulo: 'De V_E a la concentración', texto: 'Como en la equivalencia c_A·V_A = c_B·V_E: c_A = c_B·V_E / V_A = 1,0·10⁻² × 20 / 10 = 2,0·10⁻² mol·L⁻¹, es decir n_A = 2,0·10⁻⁴ mol (ejemplo del cours).', fr: 'c_A·V_A = c_B·V_E' },
    ],
    montar(host, api) {
      const VE_ = 20, FX = 70, FW = 250, FY = 190, FH = 150;
      const S = { V: 0, meta: null };
      const nb = nube({ x0: FX + 12, y0: FY + 40, x1: FX + FW - 12, y1: FY + FH - 12 }, 21);
      const gx = (v) => 450 + (v / 30) * 310, gy = (n) => 320 - (n / 20) * 220; // n en «unidades» (1 u = 1,0·10⁻⁵ mol)
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'rango', id: 'V', txt: 'V_B (soda)', min: 0, max: 30, paso: 0.5, val: 0, fmt: (v) => v.toFixed(1).replace('.', ',') + ' mL' },
          { tipo: 'btn', txt: '▶ Verter', al: (S, E) => { if (S.V >= 29.9) E.set('V', 0); S.meta = 30; if (S.red) { E.set('V', 30); S.meta = null; } } },
          { tipo: 'btn', txt: '↺', al: (S, E) => { S.meta = null; E.set('V', 0); } },
        ],
        alCambiar(id, v, S) { S.meta = null; },
        paso(dt, S, E) { nb.step(dt, S.red ? 0.4 : 1); if (S.meta != null) { const v = S.V + dt * 3; if (v >= S.meta) { E.set('V', S.meta); S.meta = null; } else E.set('V', v); } },
        ir(n, S, E) { S.meta = null; const t = [0, 8, 20, 28, 20][n]; E.set('V', t); if (n === 1 && !S.red) { E.set('V', 0); S.meta = 8; } if (n === 3 && !S.red) { E.set('V', 20); S.meta = 28; } },
        dibujar(c, S) {
          const V = S.V, n = S.n, nA = Math.max(0, VE_ - V), nHO = Math.max(0, V - VE_), nP = Math.min(V, VE_);
          // bureta
          rr(c, 160, 40, 24, 120, 6); c.fillStyle = '#12204a'; c.fill(); c.strokeStyle = '#7b86ad'; c.lineWidth = 2; c.stroke();
          const lv = clamp(1 - V / 40, 0, 1); c.fillStyle = VE + '66'; c.fillRect(162, 42 + 116 * (1 - lv), 20, 116 * lv); txt(c, 'bureta : HO⁻ 1,0·10⁻² mol·L⁻¹', 172, 26, { s: 12, c: VE });
          lin(c, 172, 160, 172, 176, '#7b86ad', 3); if (S.meta != null || (V > 0 && V < 30 && S.t % 0.5 < 0.25 && false)) circ(c, 172, 182 + (S.t * 120) % 20, 3, VE);
          // erlenmeyer
          c.beginPath(); c.moveTo(FX + 90, FY - 10); c.lineTo(FX + 90, FY + 30); c.lineTo(FX, FY + FH - 14); c.quadraticCurveTo(FX - 4, FY + FH, FX + 14, FY + FH); c.lineTo(FX + FW - 14, FY + FH); c.quadraticCurveTo(FX + FW + 4, FY + FH, FX + FW, FY + FH - 14); c.lineTo(FX + FW - 90, FY + 30); c.lineTo(FX + FW - 90, FY - 10); c.strokeStyle = '#7b86ad'; c.lineWidth = 3; c.stroke();
          nb.sync('A', Math.round(nA), MG, 'AH'); nb.sync('B', Math.round(nHO), VE, 'HO⁻'); nb.sync('P', Math.round(nP), AZ, 'A⁻'); nb.draw(c, 9);
          txt(c, 'CH₃CO₂H (titrado)', FX + FW, FY - 24, { s: 12, c: MG, a: 'right' });
          // leyenda
          [['CH₃CO₂H', MG], ['HO⁻', VE], ['CH₃CO₂⁻', AZ]].forEach((l, i) => { circ(c, 88 + i * 100, 396, 6, l[1] + 'aa', l[1], 1.5); txt(c, l[0], 98 + i * 100, 396, { s: 12, a: 'left' }); });
          // gráfica de cantidades (fig. 4)
          lin(c, gx(0), gy(0), gx(30), gy(0), T2, 1); lin(c, gx(0), gy(0), gx(0), gy(20), T2, 1);
          txt(c, 'n (10⁻⁵ mol)', gx(0), gy(20) - 12, { s: 12, c: T2 }); txt(c, 'V_B (mL)', gx(30), gy(0) + 28, { s: 12, c: T2, a: 'right' });
          [0, 10, 20, 30].forEach((v) => { lin(c, gx(v), gy(0), gx(v), gy(0) + 4, T2, 1); txt(c, String(v), gx(v), gy(0) + 14, { s: 11, c: T2 }); });
          const curva2 = (f, col) => { c.beginPath(); for (let v = 0; v <= 30; v += 0.5) { const x = gx(v), y = gy(f(v)); v === 0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.strokeStyle = col; c.lineWidth = 2.5; c.stroke(); };
          curva2((v) => Math.max(0, VE_ - v), MG); curva2((v) => Math.max(0, v - VE_), VE); curva2((v) => Math.min(v, VE_), AZ);
          lin(c, gx(V), gy(0), gx(V), gy(20), AM, 1.4, [3, 3]);
          if (n >= 2) { lin(c, gx(VE_), gy(0), gx(VE_), gy(20), AM, 1.2, [6, 4]); txt(c, 'V_E = 20 mL', gx(VE_), gy(20) - 12, { s: 12, b: 1, c: AM }); }
          const lim = Math.abs(V - VE_) < 0.3 ? 'équivalence : tout consommé' : V < VE_ ? 'HO⁻ (titrant) limitant' : 'HO⁻ en excès · limitant = CH₃CO₂H';
          chip(c, V === 0 ? 'V_B = 0 : solo ácido' : lim, 195, 366, Math.abs(V - VE_) < 0.3 ? AM : V < VE_ ? VE : MG, { s: 13 });
          if (n === 4) { panel(c, 440, 18, 330, 54, AM); txt(c, 'c_A = c_B·V_E / V_A = 1,0·10⁻² × 20 / 10', 605, 36, { s: 13, c: TX }); txt(c, '= 2,0·10⁻² mol·L⁻¹', 605, 58, { s: 14, c: AM, b: 1 }); }
          txt(c, 'V_B = ' + V.toFixed(1).replace('.', ',') + ' mL', 605, 396, { s: 12, c: T2 });
        },
      });
    },
    test: [
      { pregunta: 'Antes de la equivalencia, ¿qué reactivo es limitante?', opciones: ['El titrante (HO⁻ vertido)', 'El titrado (CH₃CO₂H)', 'Ninguno'], correcta: 0, explicacion: 'Cada HO⁻ vertido reacciona y desaparece: es el que se agota primero.' },
      { pregunta: 'En el volumen equivalente…', opciones: ['Quedan 0 mol de titrante y 0 mol de titrado', 'Hay exceso de titrante', 'La reacción se detiene'], correcta: 0, explicacion: 'Se mezclaron en proporciones estequiométricas y se consumieron totalmente: n_A = n_B.' },
      { pregunta: 'Con V_A = 10 mL, c_B = 1,0·10⁻² mol·L⁻¹ y V_E = 20 mL, c_A vale…', opciones: ['2,0·10⁻² mol·L⁻¹', '0,5·10⁻² mol·L⁻¹', '1,0·10⁻² mol·L⁻¹'], correcta: 0, explicacion: 'c_A = c_B·V_E/V_A = 1,0·10⁻²×20/10 = 2,0·10⁻² mol·L⁻¹.' },
    ],
  });

  // ---- 3.3 Hallar V_E en la curva de pH: tangentes y derivada (p. 89) ----
  reg({
    id: 'equivalence-ph', capitulos: ['methodes-chimiques'], titulo: 'Localizar la equivalencia en la curva de pH', fr: 'Méthode des tangentes · méthode de la dérivée', pagina_pdf: 89,
    resumen: 'La equivalencia es el punto del gran salto de pH. Se ve con dos métodos: las dos tangentes paralelas y su recta equidistante, o el máximo de la derivada dpH/dV.',
    pasos: [
      { titulo: 'La curva pH = f(V)', texto: 'Al titular un ácido con una base, el pH de la mezcla crece al verter la base. Es una curva ilustrativa calculada para el mismo montaje (10 mL de ácido etanoico 2,0·10⁻² mol·L⁻¹, soda 1,0·10⁻² mol·L⁻¹); el cours da el método.', fr: 'La courbe est croissante lors du titrage d’un acide par une base.' },
      { titulo: 'El salto de pH', texto: 'Cerca de la equivalencia el pH sube de golpe con muy poca base: es el salto de pH. El volumen buscado V_E está en medio de ese salto.', fr: 'À l’équivalence, on observe un saut important de pH.' },
      { titulo: 'Método de las tangentes', texto: 'Se trazan dos tangentes paralelas a cada lado del salto (mueve el deslizador para cambiar la primera; la segunda se ajusta para ser paralela). La recta paralela y equidistante a ambas corta la curva en el punto de abscisa V_E.', fr: 'On trace deux tangentes parallèles de part et d’autre du saut de pH, puis une droite parallèle et équidistante.' },
      { titulo: 'La lectura', texto: 'La abscisa de ese punto de corte es el volumen equivalente. Comprueba que, aunque muevas las tangentes, la lectura casi no cambia: el método es robusto.', fr: 'Cette droite coupe la courbe de titrage au point d’abscisse V_E.' },
      { titulo: 'Método de la derivada', texto: 'Pulsa «dpH/dV»: se dibuja la derivada de la curva (su pendiente en cada punto). El extremo de esa curva —un máximo al titular un ácido con una base— tiene por abscisa V_E.', fr: 'L’abscisse de l’extremum de dpH/dV est le volume équivalent.' },
    ],
    montar(host, api) {
      const VA = 10, CA = 0.02, CB = 0.01, KA = Math.pow(10, -4.76);
      const pHde = (V) => { const Ca = (CA * VA) / (VA + V), Cb = (CB * V) / (VA + V); let lo = -3, hi = 0; // bisección en log h
        let a = 1e-13, b = 1; for (let i = 0; i < 80; i++) { const h = Math.sqrt(a * b), f = Cb + h - 1e-14 / h - Ca / (1 + h / KA); if (f > 0) b = h; else a = h; } return -Math.log10(Math.sqrt(a * b)); };
      const N = 600, VV = [], PH = [], D = [];
      for (let i = 0; i <= N; i++) { VV.push((i / N) * 30); PH.push(pHde(VV[i])); }
      for (let i = 0; i <= N; i++) { const a = Math.max(0, i - 1), b = Math.min(N, i + 1); D.push((PH[b] - PH[a]) / (VV[b] - VV[a])); }
      const iMax = D.indexOf(Math.max.apply(null, D)), VEreal = VV[iMax];
      const gx = (v) => 90 + (v / 30) * 650, gy = (p) => 372 - ((p - 2) / 11) * 280, gd = (d) => 372 - (d / Math.max.apply(null, D)) * 260;
      const S = { v1: 17, der: false };
      const pend = (i) => D[i];
      function tang(v1) { const i1 = Math.round((v1 / 30) * N), m = pend(i1); // buscar punto del otro lado con la misma pendiente
        let i2 = iMax, best = 1e9; for (let i = iMax + 1; i < N - 5; i++) { const d = Math.abs(D[i] - m); if (d < best) { best = d; i2 = i; } } return { i1, i2, m, b1: PH[i1] - m * VV[i1], b2: PH[i2] - m * VV[i2] }; }
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'rango', id: 'v1', txt: 'tangente 1 en V =', min: 11, max: 19, paso: 0.5, val: 17, fmt: (v) => v.toFixed(1).replace('.', ',') + ' mL' },
          { tipo: 'btn', id: 'bd', txt: 'dpH/dV', al: (S, E, b) => { S.der = !S.der; b.classList.toggle('on', S.der); } },
        ],
        ir(n, S, E) { S.der = n === 4; E.el.bd.classList.toggle('on', S.der); },
        dibujar(c, S) {
          const n = S.n;
          lin(c, gx(0), gy(2), gx(30), gy(2), T2, 1); lin(c, gx(0), gy(2), gx(0), gy(13), T2, 1);
          txt(c, 'pH', gx(0) - 14, gy(13), { s: 13, c: T2 }); txt(c, 'V_soude (mL)', gx(30), gy(2) + 28, { s: 12, c: T2, a: 'right' });
          [0, 5, 10, 15, 20, 25, 30].forEach((v) => { lin(c, gx(v), gy(2), gx(v), gy(2) + 4, T2, 1); txt(c, String(v), gx(v), gy(2) + 14, { s: 11, c: T2 }); }); [4, 6, 8, 10, 12].forEach((p) => { txt(c, String(p), gx(0) - 12, gy(p), { s: 11, c: T2 }); });
          if (n >= 1 && n < 4) { const a = Math.round((17 / 30) * N), b = Math.round((23 / 30) * N); c.fillStyle = '#ffd16618'; c.fillRect(gx(VV[a]), gy(13), gx(VV[b]) - gx(VV[a]), gy(2) - gy(13)); txt(c, 'saut de pH', gx(20), gy(12.4), { s: 13, c: AM, b: 1 }); }
          c.beginPath(); VV.forEach((v, i) => { const x = gx(v), y = gy(PH[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.strokeStyle = n >= 4 && S.der ? '#3b5a8a' : MG; c.lineWidth = 3; c.stroke();
          if (n >= 2 && !S.der) {
            const T = tang(S.v1), seg = (b, col) => lin(c, gx(0), gy(b), gx(30), gy(T.m * 30 + b), col, 1.6);
            const clipRect = () => { c.save(); c.beginPath(); c.rect(gx(0), gy(13), gx(30) - gx(0), gy(2) - gy(13)); c.clip(); };
            clipRect(); seg(T.b1, AZ); seg(T.b2, AZ); const bm = (T.b1 + T.b2) / 2; seg(bm, VE);
            // punto de corte con la curva
            let k = 0, bestd = 1e9; for (let i = 0; i < VV.length; i++) { const d = Math.abs(PH[i] - (T.m * VV[i] + bm)); if (VV[i] > 12 && VV[i] < 28 && d < bestd) { bestd = d; k = i; } }
            c.restore();
            circ(c, gx(T.i1 * 30 / N), gy(PH[T.i1]), 5, AZ); circ(c, gx(VV[T.i2]), gy(PH[T.i2]), 5, AZ);
            txt(c, 'tangente 1', gx(VV[T.i1]) - 8, gy(PH[T.i1]) + 22, { s: 12, c: AZ, a: 'right' }); txt(c, 'tangente 2', gx(VV[T.i2]) + 8, gy(PH[T.i2]) - 20, { s: 12, c: AZ, a: 'left' });
            if (n >= 3) { lin(c, gx(VV[k]), gy(PH[k]), gx(VV[k]), gy(2), AM, 1.6, [5, 4]); circ(c, gx(VV[k]), gy(PH[k]), 6, AM, '#fff', 1.5); txt(c, 'V_E ≈ ' + VV[k].toFixed(1).replace('.', ',') + ' mL', gx(VV[k]) + 10, gy(2) - 12, { s: 14, c: AM, b: 1, a: 'left' }); txt(c, 'recta equidistante', gx(2.5), gy(T.m * 2.5 + bm) - 18, { s: 12, c: VE, a: 'left' }); }
          }
          if (n >= 4 && S.der) {
            lin(c, gx(0), gd(0), gx(30), gd(0), '#3b5a8a', 1);
            c.beginPath(); VV.forEach((v, i) => { const x = gx(v), y = gd(D[i]); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.strokeStyle = VE; c.lineWidth = 3; c.stroke();
            lin(c, gx(VEreal), gd(D[iMax]), gx(VEreal), gy(2), AM, 1.6, [5, 4]); circ(c, gx(VEreal), gd(D[iMax]), 6, AM, '#fff', 1.5);
            txt(c, 'dpH/dV', gx(VEreal) + 14, gd(D[iMax]) + 6, { s: 13, b: 1, c: VE, a: 'left' }); txt(c, 'máximo → V_E ≈ ' + VEreal.toFixed(1).replace('.', ',') + ' mL', gx(VEreal) - 12, gy(2) - 28, { s: 14, c: AM, b: 1, a: 'right' });
          }
          if (n === 0) txt(c, 'titrage d’un acide par une base : pH croissant', 410, 60, { s: 14, c: T2 });
        },
      });
    },
    test: [
      { pregunta: 'En el método de las tangentes, la recta que corta la curva en V_E es…', opciones: ['paralela a las dos tangentes y equidistante de ellas', 'perpendicular a la curva', 'horizontal en pH = 7'], correcta: 0, explicacion: 'Es la paralela equidistante (Point méthode, p. 89).' },
      { pregunta: 'En el método de la derivada, V_E es…', opciones: ['la abscisa del extremo de dpH/dV', 'el valor máximo de pH', 'el punto donde dpH/dV = 0'], correcta: 0, explicacion: 'Un máximo si se titula un ácido con una base; un mínimo en el caso contrario.' },
      { pregunta: 'El salto de pH ocurre…', opciones: ['alrededor de la equivalencia', 'al inicio del titrage', 'solo al final'], correcta: 0, explicacion: 'Con muy poca base añadida cambia mucho el pH justo en la equivalencia.' },
    ],
  });

  // ---- 3.4 Conductimetría del titrage: por qué cambia la pendiente (p. 90) ----
  reg({
    id: 'titrage-conducti', capitulos: ['methodes-chimiques'], titulo: 'Titrage conductimétrico: iones que salen y entran', fr: 'Titrage conductimétrique', pagina_pdf: 90,
    resumen: 'Titulando HCl con soda, los H₃O⁺ (muy conductores) se cambian por Na⁺ (poco conductores): σ baja. Tras la equivalencia sobran HO⁻ y σ sube. El cruce de las dos rectas da V_E.',
    pasos: [
      { titulo: 'Los iones del principio', texto: 'La solución de ácido clorhídrico contiene H₃O⁺ y Cl⁻. El H₃O⁺ tiene una conductividad molar iónica enorme (35,0·10⁻³ S·m²·mol⁻¹) frente a Cl⁻ (7,6·10⁻³): σ parte alta. Cada punto = 0,4 mol·m⁻³ (ilustrativo).', fr: 'Valeurs de λ (fig. 7) : H₃O⁺ 35,0 ; Na⁺ 5,0 ; HO⁻ 19,8 ; Cl⁻ 7,6 (×10⁻³ S·m²·mol⁻¹).' },
      { titulo: 'Se añade soda: un ion por otro', texto: 'Cada HO⁻ vertido reacciona con un H₃O⁺ (desaparece) y llega un Na⁺ que no reacciona. Cambiamos un ion que conduce 35 por otro que conduce 5: σ disminuye. Cl⁻ se queda como espectador.', fr: 'Les ions H₃O⁺ sont remplacés par des ions Na⁺ : la conductivité de la solution diminue.' },
      { titulo: 'Equivalencia: el mínimo', texto: 'En V_E ya no queda H₃O⁺ ni HO⁻ libres; solo Na⁺ y Cl⁻. σ es mínima: es el cambio de pendiente.', fr: 'L’équivalence est repérée par le changement de pente de la courbe.' },
      { titulo: 'Después: HO⁻ de más', texto: 'Ahora el HO⁻ que se vierte ya no tiene con quién reaccionar y se acumula (λ = 19,8): además entra Na⁺. Los dos suman: σ sube más rápido.', fr: 'Après l’équivalence, on continue de verser des ions qui ne réagissent plus : la conductivité augmente.' },
      { titulo: 'V_E = cruce de las dos rectas', texto: 'Con la dilución despreciable, los puntos caen en dos rectas. Su intersección da V_E. Mueve V_B para ver cómo se construye la curva σ = f(V).', fr: 'Le volume équivalent V_E correspond à l’abscisse du point d’intersection des deux droites.' },
    ],
    montar(host, api) {
      const L = { H: 35.0, Na: 5.0, HO: 19.8, Cl: 7.6 }, VEq = 10, U = 0.4e-3; // 1 punto = 0,4 mol·m⁻³
      const S = { V: 0, meta: null };
      const FX = 40, FW = 250, FY = 120, FH = 190;
      const nb = nube({ x0: FX + 12, y0: FY + 14, x1: FX + FW - 12, y1: FY + FH - 12 }, 31);
      const gx = (v) => 400 + (v / 20) * 360, gy = (s) => 350 - (s / 0.18) * 250;
      const sig = (V) => U * (L.H * Math.max(0, VEq - V) + L.Cl * VEq + L.Na * V + L.HO * Math.max(0, V - VEq));
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'rango', id: 'V', txt: 'V_B (soda)', min: 0, max: 20, paso: 0.5, val: 0, fmt: (v) => v.toFixed(1).replace('.', ',') + ' mL' },
          { tipo: 'btn', txt: '▶ Verter', al: (S, E) => { if (S.V >= 19.9) E.set('V', 0); S.meta = 20; if (S.red) { E.set('V', 20); S.meta = null; } } },
          { tipo: 'btn', txt: '↺', al: (S, E) => { S.meta = null; E.set('V', 0); } },
        ],
        alCambiar(id, v, S) { S.meta = null; },
        paso(dt, S, E) { nb.step(dt, S.red ? 0.4 : 1); if (S.meta != null) { const v = S.V + dt * 2; if (v >= S.meta) { E.set('V', S.meta); S.meta = null; } else E.set('V', v); } },
        ir(n, S, E) { S.meta = null; E.set('V', [0, 5, 10, 16, 20][n]); if (n === 1 && !S.red) { E.set('V', 0); S.meta = 5; } },
        dibujar(c, S) {
          const V = S.V, n = S.n;
          matraz(c, FX, FY, FW, FH, '#7b86ad'); c.fillStyle = '#103a4a55'; c.fillRect(FX + 2, FY + 6, FW - 4, FH - 8);
          nb.sync('H', Math.round(Math.max(0, VEq - V)), MG, 'H₃O⁺'); nb.sync('Cl', VEq, VE, 'Cl⁻'); nb.sync('Na', Math.round(V), AZ, 'Na⁺'); nb.sync('HO', Math.round(Math.max(0, V - VEq)), OR, 'HO⁻');
          nb.draw(c, 9);
          txt(c, 'solution titrée : HCl(aq) + soude ajoutée', FX + FW / 2, FY - 14, { s: 12, c: T2 });
          [['H₃O⁺ 35,0', MG], ['Cl⁻ 7,6', VE], ['Na⁺ 5,0', AZ], ['HO⁻ 19,8', OR]].forEach((l, i) => { circ(c, FX + 8 + (i % 2) * 120, FY + FH + 28 + Math.floor(i / 2) * 22, 6, l[1] + 'aa', l[1], 1.5); txt(c, l[0] + ' ·10⁻³', FX + 20 + (i % 2) * 120, FY + FH + 28 + Math.floor(i / 2) * 22, { s: 12, a: 'left' }); });
          // gráfica
          lin(c, gx(0), gy(0), gx(20), gy(0), T2, 1); lin(c, gx(0), gy(0), gx(0), gy(0.18), T2, 1);
          txt(c, 'σ (S·m⁻¹)', gx(0) + 6, gy(0.18) - 8, { s: 12, c: T2, a: 'left' }); txt(c, 'V_soude (mL)', gx(20), gy(0) + 28, { s: 12, c: T2, a: 'right' });
          [0, 5, 10, 15, 20].forEach((v) => { lin(c, gx(v), gy(0), gx(v), gy(0) + 4, T2, 1); txt(c, String(v), gx(v), gy(0) + 14, { s: 11, c: T2 }); }); [0.05, 0.10, 0.15].forEach((s) => { txt(c, s.toFixed(2).replace('.', ','), gx(0) - 20, gy(s), { s: 11, c: T2 }); lin(c, gx(0) - 3, gy(s), gx(0), gy(s), T2, 1); });
          if (n >= 4) { const f1 = (v) => sig(0) + (sig(VEq) - sig(0)) / VEq * v, f2 = (v) => sig(VEq) + (sig(20) - sig(VEq)) / (20 - VEq) * (v - VEq); c.save(); c.beginPath(); c.rect(gx(0), gy(0.18), gx(20) - gx(0), gy(0) - gy(0.18)); c.clip(); lin(c, gx(0), gy(f1(0)), gx(15), gy(f1(15)), '#7b86ad', 1.4, [6, 4]); lin(c, gx(0), gy(f2(0)), gx(20), gy(f2(20)), '#7b86ad', 1.4, [6, 4]); c.restore(); lin(c, gx(VEq), gy(sig(VEq)), gx(VEq), gy(0), AM, 1.5, [5, 4]); circ(c, gx(VEq), gy(sig(VEq)), 6, AM, '#fff', 1.5); txt(c, 'V_E = 10 mL', gx(VEq) + 8, gy(0) - 12, { s: 13, b: 1, c: AM, a: 'left' }); }
          c.beginPath(); for (let v = 0; v <= V + 0.001; v += 0.25) { const x = gx(v), y = gy(sig(v)); v === 0 ? c.moveTo(x, y) : c.lineTo(x, y); } c.strokeStyle = VE; c.lineWidth = 3; c.stroke();
          circ(c, gx(V), gy(sig(V)), 6, MG, '#fff', 1.5); txt(c, 'σ = ' + sig(V).toFixed(3).replace('.', ','), gx(V) + (V > 14 ? -10 : 10), gy(sig(V)) - 14, { s: 12, c: TX, a: V > 14 ? 'right' : 'left' });
          const pend = V < VEq ? '(λ(Na⁺) − λ(H₃O⁺)) < 0 : σ baja' : V > VEq ? '(λ(Na⁺) + λ(HO⁻)) > 0 : σ sube' : 'cambio de pendiente';
          txt(c, V === 0 ? 'σ inicial alta: H₃O⁺ conduce mucho' : V === VEq ? 'équivalence : mínimo de σ' : pend, 580, 70, { s: 13, c: AM, b: 1 });
        },
      });
    },
    test: [
      { pregunta: 'Antes de la equivalencia, ¿por qué baja σ al añadir soda?', opciones: ['H₃O⁺ (λ = 35) se sustituye por Na⁺ (λ = 5)', 'Porque se añade agua pura', 'Porque desaparece el Cl⁻'], correcta: 0, explicacion: 'Cada HO⁻ consume un H₃O⁺ y entra un Na⁺, mucho menos conductor.' },
      { pregunta: 'Después de la equivalencia, σ sube porque…', opciones: ['se acumulan HO⁻ y Na⁺ que ya no reaccionan', 'sube la temperatura', 'se forma más H₃O⁺'], correcta: 0, explicacion: 'Los iones vertidos ya no tienen con quién reaccionar.' },
      { pregunta: 'En la curva σ = f(V), V_E se lee…', opciones: ['en la intersección de las dos rectas', 'en el máximo de σ', 'cuando σ = 0'], correcta: 0, explicacion: 'El cambio de pendiente marca la equivalencia.' },
    ],
  });

  // =====================================================================================
  // CAP. 4 · evolution-temporelle
  // =====================================================================================

  // ---- 4.1 Choques eficaces: temperatura y concentración (p. 114) ----
  reg({
    id: 'chocs-efficaces', capitulos: ['evolution-temporelle'], titulo: 'Choques eficaces: por qué T y c aceleran', fr: 'Interprétation microscopique des facteurs cinétiques', pagina_pdf: 114,
    resumen: 'Dos entidades solo reaccionan si chocan y el choque modifica sus enlaces (choc efficace). Subir la temperatura o la concentración multiplica los choques eficaces por segundo.',
    pasos: [
      { titulo: 'Para reaccionar hay que chocar', texto: 'A (magenta) y B (verde) se agitan al azar. Para transformarse deben encontrarse: cada encuentro es un choque. Mira el contador de choques por segundo.', fr: 'Un choc entre deux entités réactives…' },
      { titulo: 'No todos los choques son eficaces', texto: 'Un choque es eficaz solo si modifica los enlaces químicos de las dos entidades (aquí: si llegan con suficiente energía). Los choques eficaces se marcan con un destello verde; los demás son simples rebotes grises.', fr: 'Un choc est efficace s’il entraîne une modification des liaisons chimiques de ces deux entités.' },
      { titulo: 'Más temperatura: choques más frecuentes y más violentos', texto: 'Sube la temperatura: la agitación térmica aumenta, hay más choques y además con más energía, por tanto muchos más son eficaces. Observa cómo salta el número de eficaces por segundo.', fr: 'Lorsque la température augmente, les chocs efficaces sont plus fréquents.' },
      { titulo: 'Más concentración: más choques', texto: 'Ahora vuelve a la temperatura baja y añade moléculas: con más entidades por unidad de volumen se encuentran más a menudo, así que hay más choques eficaces por segundo.', fr: 'Lorsque la concentration augmente, les chocs efficaces sont plus fréquents.' },
      { titulo: 'Los dos factores cinéticos', texto: 'Temperatura y concentración de los reactivos son factores cinéticos: modifican la duración de la transformación porque cambian el número de choques eficaces por segundo. Juega con los dos deslizadores.', fr: 'Les facteurs cinétiques : la température et la concentration.' },
    ],
    montar(host, api) {
      const rng = PCB.util.rng ? PCB.util.rng(9) : Math.random;
      const B = { x0: 50, y0: 60, x1: 520, y1: 372 }, R = 10, EA = api.reducido ? 10800 : 30000; // umbral (px/s)²
      const S = { T: 20, nc: 8, ps: [], hist: [], tot: 0, efi: 0, flash: [] };
      const sig = (T) => (T + 273) * (api.reducido ? 0.12 : 0.2);
      const gauss = () => { let a = 0; for (let i = 0; i < 6; i++) a += rng(); return (a - 3) * 1.4142; };
      function poblar(S) { S.ps = []; for (let k = 0; k < 2; k++) for (let i = 0; i < S.nc; i++) S.ps.push({ k, x: B.x0 + R + rng() * (B.x1 - B.x0 - 2 * R), y: B.y0 + R + rng() * (B.y1 - B.y0 - 2 * R), vx: gauss() * sig(S.T), vy: gauss() * sig(S.T), cd: 0 }); S.hist = []; S.tot = 0; S.efi = 0; S.t0 = S.t; }
      poblar(S);
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'rango', id: 'T', txt: 'Temperatura', min: 0, max: 200, paso: 5, val: 20, fmt: (v) => v + ' °C' },
          { tipo: 'rango', id: 'nc', txt: 'Concentración', min: 4, max: 16, paso: 1, val: 8, fmt: (v) => v + '+' + v },
          { tipo: 'btn', txt: '↺', al: (S) => poblar(S) },
        ],
        alCambiar(id, v, S) { if (id === 'nc') poblar(S); else { const k = sig(S.T) / (S.sT || sig(S.T)); S.ps.forEach((p) => { p.vx *= k; p.vy *= k; }); S.hist = []; S.t0 = S.t; } S.sT = sig(S.T); },
        paso(dt, S) {
          S.sT = S.sT || sig(S.T);
          const m = 2, sub = 2; dt /= sub;
          for (let s = 0; s < sub; s++) {
            S.ps.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < B.x0 + R) { p.x = B.x0 + R; p.vx = Math.abs(p.vx); } if (p.x > B.x1 - R) { p.x = B.x1 - R; p.vx = -Math.abs(p.vx); } if (p.y < B.y0 + R) { p.y = B.y0 + R; p.vy = Math.abs(p.vy); } if (p.y > B.y1 - R) { p.y = B.y1 - R; p.vy = -Math.abs(p.vy); } p.cd -= dt; });
            for (let i = 0; i < S.ps.length; i++) for (let j = i + 1; j < S.ps.length; j++) { const a = S.ps[i], b = S.ps[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy; if (d2 < 4 * R * R && d2 > 0.01) { const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { const vr2 = Math.pow(b.vx - a.vx, 2) + Math.pow(b.vy - a.vy, 2); a.vx += rv * nx; a.vy += rv * ny; b.vx -= rv * nx; b.vy -= rv * ny; const ov = (2 * R - d) / 2; a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov; if (a.k !== b.k && a.cd <= 0 && b.cd <= 0) { S.tot++; a.cd = b.cd = 0.15; const ef = vr2 > EA; if (ef) { S.efi++; S.flash.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0, ok: 1 }); S.hist.push([S.t, 1, 1]); } else { S.flash.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0, ok: 0 }); S.hist.push([S.t, 1, 0]); } } } } }
          }
          S.flash.forEach((f) => (f.t += dt * sub)); while (S.flash.length && S.flash[0].t > 0.45) S.flash.shift();
          while (S.hist.length && S.hist[0][0] < S.t - 6) S.hist.shift();
        },
        ir(n, S, E) { const set = (T, nn) => { E.set('T', T); E.set('nc', nn); S.sT = sig(S.T); poblar(S); }; if (n <= 1) set(20, 8); else if (n === 2) set(180, 8); else if (n === 3) set(20, 16); else set(120, 12); },
        dibujar(c, S) {
          const n = S.n;
          rr(c, B.x0 - 4, B.y0 - 4, B.x1 - B.x0 + 8, B.y1 - B.y0 + 8, 10); c.fillStyle = '#0d1530'; c.fill(); c.strokeStyle = GR; c.lineWidth = 2; c.stroke();
          S.ps.forEach((p) => { const col = p.k ? VE : MG; circ(c, p.x, p.y, R, col + '99', col, 1.8); txt(c, p.k ? 'B' : 'A', p.x, p.y, { s: 10, b: 1 }); });
          S.flash.forEach((f) => { c.globalAlpha = 1 - f.t / 0.45; circ(c, f.x, f.y, 8 + f.t * (f.ok ? 70 : 30), null, f.ok ? '#7dffc8' : '#9aa3c4', f.ok ? 3 : 2); c.globalAlpha = 1; });
          // panel de contadores
          const win = Math.max(1, Math.min(6, S.t - (S.t0 || 0))), rates = (k) => (S.hist.length ? S.hist.filter((h) => h[1] && (k === 0 || h[2])).length / win : 0);
          panel(c, 546, 60, 236, 312, GR);
          txt(c, 'últimos 6 s', 664, 80, { s: 12, c: T2 });
          txt(c, 'choques A–B / s', 664, 112, { s: 13, c: T2 }); txt(c, rates(0).toFixed(1).replace('.', ','), 664, 142, { s: 30, b: 1, c: TX });
          txt(c, 'choques EFICACES / s', 664, 186, { s: 13, c: VE, b: 1 }); txt(c, rates(1).toFixed(1).replace('.', ','), 664, 218, { s: 36, b: 1, c: VE });
          const tr = rates(0), ef = rates(1), fr = tr > 0 ? ef / tr : 0;
          rr(c, 566, 262, 196, 14, 7); c.fillStyle = '#1b2650'; c.fill(); rr(c, 566, 262, Math.max(4, 196 * fr), 14, 7); c.fillStyle = VE; c.fill();
          txt(c, 'fracción eficaz: ' + Math.round(fr * 100) + ' %', 664, 296, { s: 13, c: TX });
          txt(c, 'T = ' + S.T + ' °C · ' + S.nc + ' A + ' + S.nc + ' B', 664, 336, { s: 13, c: AM, b: 1 });
          txt(c, 'destello verde = eficaz · gris = rebote', 664, 356, { s: 11, c: T2 });
          if (n === 0) txt(c, 'A + B → …', 285, 48, { s: 14, c: T2 });
        },
      });
    },
    test: [
      { pregunta: '¿Cuándo es eficaz un choque?', opciones: ['Cuando modifica los enlaces químicos de las dos entidades', 'Siempre que dos moléculas se tocan', 'Solo cuando hay catalizador'], correcta: 0, explicacion: 'Un choque es eficaz si entraña una modificación de los enlaces de las dos entidades (p. 114).' },
      { pregunta: 'Al subir la temperatura, los choques eficaces por segundo…', opciones: ['aumentan: más choques y más violentos', 'disminuyen', 'no cambian'], correcta: 0, explicacion: 'La agitación térmica aumenta: choques más frecuentes y de mayor energía.' },
      { pregunta: 'Doblar la concentración de los reactivos hace que…', opciones: ['haya más choques por segundo y más eficaces', 'el catalizador se consuma', 'baje la velocidad'], correcta: 0, explicacion: 'Más entidades por unidad de volumen: se encuentran más a menudo.' },
    ],
  });

  // ---- 4.2 Catálisis: otro camino con barrera más baja (p. 112, 114) ----
  reg({
    id: 'catalyse-barrera', capitulos: ['evolution-temporelle'], titulo: 'Catálisis: un camino con menos barrera', fr: 'Catalyseur · intermédiaire réactionnel', pagina_pdf: 114,
    resumen: 'El catalizador cambia el mecanismo: abre un camino con intermediarios más reactivos y barreras más bajas. Acelera, pero no altera el estado final, y se regenera.',
    pasos: [
      { titulo: 'La barrera de energía', texto: 'Para pasar de reactivos a productos hay que superar una barrera. Cada molécula recibe energía térmica al azar; solo las que superan la barrera cruzan. A temperatura baja casi ninguna lo logra. (Perfil energético esquemático: no está en el cours.)', fr: 'Une transformation lente : la durée se compte en minutes, heures…' },
      { titulo: 'Más temperatura: más moléculas cruzan', texto: 'Sube la temperatura: la energía media de agitación sube y más moléculas superan la barrera, la transformación va más deprisa (factor cinético).', fr: 'La température est un facteur cinétique.' },
      { titulo: 'El catalizador abre otro camino', texto: 'Activa «Catalizador»: el mecanismo cambia y el camino pasa por un intermediario con dos barreras más bajas. Con la misma temperatura cruzan muchas más moléculas. Fíjate: el nivel de reactivos y de productos es el mismo, no cambia el estado final.', fr: 'L’ajout d’un catalyseur modifie le mécanisme réactionnel de la transformation.' },
      { titulo: 'Se consume y se regenera', texto: 'El catalizador se consume en una etapa y se regenera en una etapa posterior: por eso no aparece en el balance. El intermediario, en cambio, se forma y luego se consume.', fr: 'Un catalyseur est consommé au cours d’une étape puis régénéré au cours d’une étape ultérieure.' },
      { titulo: 'Intermediario ≠ catalizador', texto: 'No confundas los dos: intermediario = se forma y luego se consume; catalizador = se consume y luego se regenera. Ninguno de los dos va en la ecuación de la reacción.', fr: 'Intermédiaire réactionnel : formé puis consommé. Catalyseur : consommé puis régénéré.' },
    ],
    montar(host, api) {
      const rng = PCB.util.rng ? PCB.util.rng(13) : Math.random;
      const S = { kT: 0.1, cat: false, mol: [], hechas: 0, t0: 0 };
      const X0 = 50, X1 = 530, Y0 = 350, Y1 = 90;
      const base = (s) => 0.35 + (0.12 - 0.35) * (s * s * (3 - 2 * s));
      const Ep = (s, cat) => (cat ? base(s) + 0.3 * Math.pow(Math.sin(2 * Math.PI * s), 2) * (1 - 0.1) : base(s) + 0.62 * Math.pow(Math.sin(Math.PI * s), 2));
      const pos = (s, cat) => [X0 + s * (X1 - X0), Y0 - Ep(s, cat) * (Y0 - Y1) / 1.1];
      const barrera = (cat) => (cat ? 0.3 : 0.62);
      function poblar(S) { S.mol = []; for (let i = 0; i < 24; i++) S.mol.push({ s: rng() * 0.12, v: 0, estado: 0, ph: rng() * 6, dx: (rng() - 0.5) * 0.1, tm: rng() * 0.2 }); S.hechas = 0; S.t0 = S.t; }
      poblar(S);
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'rango', id: 'kT', txt: 'Temperatura', min: 0.08, max: 0.24, paso: 0.01, val: 0.1, fmt: (v) => Math.round(300 + (v - 0.08) * 1500) + ' K' },
          { tipo: 'btn', id: 'cat', txt: '⚗ Catalizador', al: (S, E, b) => { S.cat = !S.cat; b.classList.toggle('on', S.cat); poblar(S); } },
          { tipo: 'btn', txt: '↺', al: (S) => poblar(S) },
        ],
        alCambiar(id, v, S) { if (id === 'kT') poblar(S); },
        paso(dt, S) {
          S.mol.forEach((m) => {
            if (m.estado === 0) { m.tm -= dt; if (m.tm <= 0) { m.tm = 0.12; const E = -Math.log(1 - rng()) * S.kT; if (E > barrera(S.cat)) { m.estado = 1; } } }
            else if (m.estado === 1) { m.s += dt * (S.red ? 0.9 : 0.55); if (m.s >= 0.98) { m.s = 1; m.estado = 2; S.hechas++; } }
          });
        },
        ir(n, S, E) { const set = (kT, cat) => { if (S.kT === kT && S.cat === cat) return; E.set('kT', kT); S.cat = cat; E.el.cat.classList.toggle('on', cat); poblar(S); }; if (n === 0) set(0.1, false); else if (n === 1) set(0.2, false); else if (n >= 2) set(0.1, true); },
        dibujar(c, S) {
          const n = S.n;
          lin(c, X0 - 8, Y0 + 8, X0 - 8, Y1 - 24, T2, 1.4); punta(c, X0 - 8, Y1 - 24, -Math.PI / 2, T2, 8); txt(c, 'énergie', X0 + 14, Y1 - 24, { s: 12, c: T2 }); lin(c, X0 - 8, Y0 + 8, X1 + 8, Y0 + 8, T2, 1.4); txt(c, 'coordenada de reacción (esquema)', X1, Y0 + 24, { s: 12, c: T2, a: 'right' });
          const trazo = (cat, col, w, al) => { c.globalAlpha = al; c.beginPath(); for (let i = 0; i <= 120; i++) { const [x, y] = pos(i / 120, cat); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = col; c.lineWidth = w; c.stroke(); c.globalAlpha = 1; };
          trazo(false, '#7b86ad', 2, S.cat ? 0.35 : 1); if (S.cat) trazo(true, VE, 3.2, 1); else trazo(false, MG, 3.2, 1);
          // niveles reactivos / productos
          lin(c, X0, pos(0, false)[1], X1, pos(0, false)[1], '#ffffff22', 1, [4, 5]); lin(c, X0, pos(1, false)[1], X1, pos(1, false)[1], '#ffffff22', 1, [4, 5]);
          txt(c, 'réactifs', X0 + 24, pos(0, false)[1] + 22, { s: 13, b: 1 }); txt(c, 'produits', X1 - 24, pos(1, false)[1] + 22, { s: 13, b: 1 });
          // alturas de las barreras
          const bx = (X0 + X1) / 2, y0 = pos(0, false)[1];
          const yb = S.cat ? pos(0.25, true)[1] : pos(0.5, false)[1];
          lin(c, X0 + 90, y0, X0 + 90, yb, AM, 2); punta(c, X0 + 90, yb, -Math.PI / 2, AM, 8); txt(c, 'barrera', X0 + 100, (y0 + yb) / 2, { s: 13, c: AM, b: 1, a: 'left' });
          if (S.cat) { const [ix, iy] = pos(0.5, true); chip(c, 'intermédiaire', ix, iy + 24, AZ, { s: 12 }); }
          // moléculas
          S.mol.forEach((m) => { const [x, y] = pos(m.s, S.cat && true); const jit = m.estado === 0 ? Math.sin(S.t * 14 + m.ph) * 2 : 0; const col = m.estado === 2 ? AZ : MG; circ(c, x + (m.dx * 80) + jit, y - 9 - (m.estado === 0 ? ((m.ph * 7) % 3) * 8 : 0), 6, col + 'aa', col, 1.6); });
          // panel
          panel(c, 560, 90, 220, 190, GR);
          txt(c, 'moléculas que han cruzado', 670, 110, { s: 12, c: T2 }); txt(c, S.hechas + ' / 24', 670, 144, { s: 32, b: 1, c: VE });
          const el = Math.max(0.5, S.t - S.t0); txt(c, (S.hechas / el).toFixed(1).replace('.', ',') + ' cruces / s', 670, 186, { s: 15, b: 1, c: AM });
          txt(c, S.cat ? 'con catalizador' : 'sin catalizador', 670, 224, { s: 13, b: 1, c: S.cat ? VE : MG });
          txt(c, 'Ea ' + (S.cat ? '↓ (2 barreras bajas)' : 'alta'), 670, 248, { s: 12, c: T2 });
          if (n >= 3) { // ciclo del catalizador
            panel(c, 560, 292, 220, 96, GR); [['① C + R → I₁', 'C consumido', MG], ['② I₁ → I₂', 'intermediarios', T2], ['③ I₂ → P + C', 'C regenerado', VE]].forEach((t, i) => { txt(c, t[0], 600, 314 + i * 28, { s: 13, b: 1, c: t[2], a: 'left' }); txt(c, t[1], 770, 314 + i * 28, { s: 11, c: t[2], a: 'right' }); });
          }
        },
      });
    },
    test: [
      { pregunta: '¿Qué hace un catalizador con el estado final de la transformación?', opciones: ['No lo modifica: solo acelera el camino', 'Lo desplaza hacia los productos', 'Lo hace imposible'], correcta: 0, explicacion: 'Un catalizador acelera sin modificar el estado final (p. 112).' },
      { pregunta: 'Un catalizador se diferencia de un intermediario porque…', opciones: ['se consume y luego se regenera', 'se forma y luego se consume', 'aparece en la ecuación'], correcta: 0, explicacion: 'Catalizador: consumido y regenerado; intermediario: formado y consumido.' },
      { pregunta: 'Con catalizador, la barrera de energía…', opciones: ['se divide en etapas con barreras más bajas', 'sube', 'desaparece sin intermediarios'], correcta: 0, explicacion: 'Modifica el mecanismo: pasa por intermediarios más reactivos.' },
    ],
  });

  // ---- 4.3 Mecanismo con flechas curvas (p. 114, fig. 5 y 6) ----
  reg({
    id: 'mecanisme-fleche', capitulos: ['evolution-temporelle'], titulo: 'Mecanismo: la flecha curva mueve el doblete', fr: 'Mécanisme réactionnel · flèche courbe', pagina_pdf: 114,
    resumen: 'Un mecanismo descompone una transformación en actos elementales. Cada flecha curva parte de un sitio donor de doblete (doblete no ligante o enlace) y apunta a un sitio aceptor (H⁺, C⁺).',
    pasos: [
      { titulo: 'Sitio donor y sitio aceptor', texto: 'Reactivos de la fig. 5: el alcohol (CH₃)₃C–OH y el ion H⁺ (catalizador). El oxígeno tiene dobletes no ligantes (sitio donor: alta densidad electrónica); H⁺ tiene una lacune électronique (sitio aceptor). Mira cómo se marcan.', fr: 'Site donneur / site accepteur de doublet d’électrons.' },
      { titulo: 'Etapa 1: la flecha va del donor al aceptor', texto: 'La flecha curva nace en un doblete del O y apunta a H⁺: se forma el enlace O–H. Aparece el alcohol protonado, un intermediario reaccional (O con carga +).', fr: 'La flèche courbe part d’un site donneur et pointe vers un site accepteur.' },
      { titulo: 'Etapa 2: el enlace C–O se rompe', texto: 'Ahora la flecha nace en el enlace C–O y termina en el O: el doblete del enlace se queda con el oxígeno. Sale una molécula de agua y queda un carbocation (C⁺), el segundo intermediario.', fr: 'Une flèche courbe unique peut modéliser la rupture d’une liaison.' },
      { titulo: 'Etapa 3: se forma el doble enlace', texto: 'La flecha nace en un enlace C–H vecino y apunta al C⁺: se forma C=C (el alqueno) y se libera H⁺. El catalizador H⁺ se ha regenerado.', fr: 'La transformation d’un alcool en alcène, catalysée par H⁺, suit un mécanisme en trois étapes élémentaires.' },
      { titulo: 'Balance: sin intermediarios ni catalizador', texto: 'Se suman las tres etapas: lo formado y consumido (intermediarios) y lo consumido y regenerado (H⁺) se cancelan. Queda (CH₃)₃C–OH → (CH₃)₂C=CH₂ + H₂O.', fr: 'On retrouve l’équation en faisant le bilan de tout ce qui est consommé et produit.' },
    ],
    montar(host, api) {
      const S = { u: 0, meta: null };
      const CX = 250, CY = 240, ease = (t) => t * t * (3 - 2 * t), ph = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
      const arco = (c, P, p, col) => { // P=[x1,y1,qx,qy,x2,y2]; dibuja la flecha hasta el progreso p
        if (p <= 0) return; const N = 28, k = Math.max(1, Math.round(N * p)); c.beginPath(); let ax = P[0], ay = P[1], lx = P[0], ly = P[1]; c.moveTo(P[0], P[1]);
        for (let i = 1; i <= k; i++) { const t = (i / N) * (p >= 1 ? 1 : 1), x = (1 - t) * (1 - t) * P[0] + 2 * (1 - t) * t * P[2] + t * t * P[4], y = (1 - t) * (1 - t) * P[1] + 2 * (1 - t) * t * P[3] + t * t * P[5]; c.lineTo(x, y); ax = lx; ay = ly; lx = x; ly = y; }
        c.strokeStyle = col; c.lineWidth = 3.2; c.stroke(); if (p >= 0.98) punta(c, lx, ly, Math.atan2(ly - ay, lx - ax), col, 12);
      };
      const hat = (c, x, y, s, col, al) => { c.globalAlpha = al == null ? 1 : al; circ(c, x, y, 12, col || '#e8eefc', null); txt(c, s || 'H', x, y, { s: 12, b: 1, c: '#0a0f20' }); c.globalAlpha = 1; };
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'rango', id: 'u', txt: 'Mecanismo', min: 0, max: 3, paso: 0.01, val: 0, fmt: (v) => (v >= 3 ? 'fin' : 'etapa ' + (Math.floor(v) + 1) + ' · ' + Math.round((v % 1) * 100) + ' %') },
          { tipo: 'btn', txt: '▶ Animar', al: (S, E) => { if (S.u >= 2.99) E.set('u', 0); S.meta = 3; if (S.red) { E.set('u', 3); S.meta = null; } } },
          { tipo: 'btn', txt: '↺', al: (S, E) => { S.meta = null; E.set('u', 0); } },
        ],
        alCambiar(id, v, S) { S.meta = null; },
        paso(dt, S, E) { if (S.meta != null) { const v = S.u + dt * 0.3; if (v >= S.meta) { E.set('u', S.meta); S.meta = null; } else E.set('u', v); } },
        ir(n, S, E) { S.meta = null; if (n === 0) E.set('u', 0); else if (n >= 4) E.set('u', 3); else { E.set('u', n - 1 + (S.red ? 1 : 0.02)); if (!S.red) S.meta = n; } },
        dibujar(c, S) {
          const u = S.u, n = S.n, et = Math.min(2, Math.floor(u)), pe = u >= 3 ? 1 : u - et;
          const p1 = et > 0 ? 1 : pe, p2 = et > 1 ? 1 : et === 1 ? pe : 0, p3 = et === 2 ? pe : 0, fin = u >= 3 ? 1 : p3;
          const q1 = ph(p1, 0, 0.5), m1 = ph(p1, 0.4, 1), q2 = ph(p2, 0, 0.5), m2 = ph(p2, 0.4, 1), q3 = ph(p3, 0, 0.5), m3 = ph(u >= 3 ? 1 : p3, 0.4, 1);
          const Wx = 120 * ease(m2), Wy = 26 * ease(m2), Ox = CX + 96 + Wx, Oy = CY + Wy;
          const wal = p3 > 0 || u >= 3 ? 0.5 : 1;
          // esqueleto de C y grupos
          lin(c, CX - 66, CY, CX - 18, CY, TX, 3); txt(c, 'H₃C', CX - 90, CY, { s: 19, b: 1 });
          lin(c, CX, CY + 18, CX, CY + 60, TX, 3); txt(c, 'CH₃', CX, CY + 80, { s: 19, b: 1 });
          lin(c, CX, CY - 18, CX, CY - 52, TX, 3); txt(c, 'CH₂', CX, CY - 72, { s: 19, b: 1 });
          atomo(c, CX, CY, 17, '#aab4d4', 'C');
          // H del grupo superior (C–H que se rompe en la etapa 3)
          const h0 = [CX + 50, CY - 100], h1 = [CX + 210, CY - 170], hx = lerp(h0[0], h1[0], ease(m3)), hy = lerp(h0[1], h1[1], ease(m3));
          c.globalAlpha = 1 - ease(q3); lin(c, CX + 12, CY - 80, hx - 10, hy + 6, TX, 3); c.globalAlpha = 1;
          // doble enlace C=C
          if (q3 > 0) { c.globalAlpha = ease(q3); lin(c, CX - 6, CY - 18, CX - 6, CY - 52, TX, 3); lin(c, CX + 6, CY - 18, CX + 6, CY - 52, TX, 3); c.globalAlpha = 1; }
          // enlace C–O
          c.globalAlpha = 1 - ease(q2); lin(c, CX + 18, CY, Ox - 20, Oy, TX, 3); c.globalAlpha = 1;
          // carga + sobre C (carbocation)
          if (p2 > 0.5 && p3 < 0.5 && u < 3) { circ(c, CX + 26, CY - 24, 11, '#0a0f20', AM, 2); txt(c, '+', CX + 26, CY - 24, { c: AM, s: 15, b: 1 }); }
          // grupo agua / OH
          c.globalAlpha = wal;
          atomo(c, Ox, Oy, 17, '#ff5a5a', 'O');
          lin(c, Ox + 17, Oy, Ox + 46, Oy, TX, 3); hat(c, Ox + 56, Oy, 'H', null, wal);
          pareja(c, Ox, Oy + 30, 0, MG, 1, 4);               // doblete inferior (siempre)
          pareja(c, Ox, Oy - 30, 0, MG, 1 - q1, 4);          // doblete superior (donor, se usa en 1)
          if (q1 > 0) { c.globalAlpha = wal * ease(q1); lin(c, Ox, Oy - 17, Ox, Oy - 44, TX, 3); c.globalAlpha = wal; }
          if (p2 > 0.2) pareja(c, Ox - 30, Oy - 2, 1, VE, ph(q2, 0.2, 1), 4);   // doblete nuevo (ex enlace C–O)
          if (p1 > 0.9 && p2 < 0.4) { circ(c, Ox + 24, Oy - 28, 11, '#0a0f20', AM, 2); txt(c, '+', Ox + 24, Oy - 28, { c: AM, s: 15, b: 1 }); }
          c.globalAlpha = 1;
          // H⁺ catalizador (llega a O en la etapa 1)
          const hp0 = [CX + 250, CY - 110], hpx = lerp(hp0[0], Ox, ease(m1)), hpy = lerp(hp0[1], Oy - 56, ease(m1));
          c.globalAlpha = wal; hat(c, hpx, hpy, 'H', '#ffd16688', 1); c.globalAlpha = 1;
          if (u < 0.05 || p1 < 0.4) txt(c, 'H⁺', hp0[0] + 26, hp0[1], { s: 14, b: 1, c: AM, a: 'left' });
          // H⁺ saliente (etapa 3)
          if (p3 > 0.6 || u >= 3) txt(c, 'H⁺', hx + 22, hy, { s: 14, b: 1, c: AM, a: 'left' });
          // flechas curvas
          if (et === 0 && u < 3) arco(c, [Ox, Oy - 34, Ox + 80, Oy - 120, hpx - 4, hpy - 2], q1, AM);
          if (et === 1) arco(c, [CX + 50, CY - 4, CX + 80, CY - 60, Ox - 14, Oy - 14], q2, AM);
          if (et === 2 && u < 3) arco(c, [CX + 32, CY - 100, CX + 62, CY - 50, CX + 8, CY - 36], q3, AM);
          // rótulos
          if (n === 0) { txt(c, 'site donneur', Ox, Oy - 66, { s: 13, c: MG, b: 1 }); txt(c, '(doublets non liants)', Ox + 8, Oy - 50, { s: 12, c: MG }); txt(c, 'site accepteur', hp0[0] + 10, hp0[1] - 58, { s: 13, c: AM, b: 1 }); txt(c, '(lacune électronique)', hp0[0] + 10, hp0[1] - 42, { s: 12, c: AM }); }
          chip(c, u >= 3 ? 'mecanismo completo' : 'étape ' + (et + 1) + ' / 3', 90, 40, VE, { s: 13 });
          if (p1 > 0.98 && p2 < 0.5 && u < 3) chip(c, 'intermédiaire 1 : alcool protoné', 330, 396, AZ, { s: 12 });
          if (p2 > 0.95 && p3 < 0.5 && u < 3) chip(c, 'intermédiaire 2 : carbocation', 330, 396, AZ, { s: 12 });
          if (u >= 3) { chip(c, 'alcène formé', 160, 396, VE, { s: 12 }); chip(c, 'H⁺ régénéré (catalyseur)', 460, 396, AM, { s: 12 }); txt(c, 'H₂O', Ox + 10, Oy + 62, { s: 14, b: 1, c: T2 }); }
          if (n === 4) { panel(c, 40, 60, 330, 62, AM); txt(c, 'bilan : (CH₃)₃C–OH → (CH₃)₂C=CH₂ + H₂O', 205, 82, { s: 14, b: 1 }); txt(c, 'sin H⁺ ni intermédiaires', 205, 106, { s: 12, c: T2 }); }
          chip(c, u < 0.05 ? 'catalyseur H⁺ : disponible' : u >= 3 ? 'H⁺ régénéré' : 'H⁺ consommé', 650, 40, u >= 3 || u < 0.05 ? AM : MG, { s: 12 });
        },
      });
    },
    test: [
      { pregunta: 'Una flecha curva siempre parte de…', opciones: ['un sitio donor de doblete (doblete no ligante o enlace) y apunta a un sitio aceptor', 'un sitio aceptor y apunta a un donor', 'un átomo cualquiera'], correcta: 0, explicacion: 'Modela el desplazamiento de un doblete: del donor al aceptor.' },
      { pregunta: 'En el mecanismo, el H⁺ es…', opciones: ['un catalizador: consumido en la etapa 1 y regenerado en la 3', 'un intermediario', 'un producto'], correcta: 0, explicacion: 'H⁺ se consume y se regenera, así que no está en el balance.' },
      { pregunta: 'El carbocation (C⁺) formado en la etapa 2 es…', opciones: ['un intermediario reaccional', 'el catalizador', 'un reactivo'], correcta: 0, explicacion: 'Se forma en una etapa y se consume en la siguiente.' },
    ],
  });

  // ---- 4.4 Velocidad = pendiente de la tangente; t½ (p. 113) ----
  reg({
    id: 'vitesse-tangente', capitulos: ['evolution-temporelle'], titulo: 'La velocidad es la pendiente (y t½ la mitad)', fr: 'Vitesse volumique · temps de demi-réaction', pagina_pdf: 113,
    resumen: 'La velocidad volúmica es la pendiente de la tangente a la curva [I₂](t): empieza alta y cae al agotarse los reactivos. El tiempo de semirreacción t½ es el instante en que x = x_f/2.',
    pasos: [
      { titulo: 'Seguimiento temporal', texto: 'Se sigue [I₂] en el tiempo en la reacción S₂O₈²⁻ + 2 I⁻ → I₂ + 2 SO₄²⁻: crece rápido al principio y se estabiliza. (Curva ilustrativa con la forma de la fig. 3 del cours.)', fr: 'Évolution de la concentration en diiode en fonction du temps.' },
      { titulo: 'v = pendiente de la tangente', texto: 'Mueve el instante t: la tangente a la curva en ese punto tiene un coeficiente director; ése es v = d[I₂]/dt. En t = 0 la tangente es muy inclinada.', fr: 'La vitesse volumique d’apparition du diiode est le coefficient directeur de la tangente à la courbe.' },
      { titulo: 'La velocidad disminuye con el tiempo', texto: 'Pulsa «Recorrer»: la tangente se va aplanando. Según avanza la reacción hay menos reactivos, menos choques eficaces, y la velocidad baja hasta casi cero.', fr: 'Les tangentes à t = 0, 20 et 80 min.' },
      { titulo: 'Reactivo: el signo menos', texto: 'Para un reactivo la concentración baja, su pendiente es negativa: por eso v = −d[R]/dt (con el signo menos la velocidad sale positiva).', fr: 'v = −d[Réactif]/dt' },
      { titulo: 'El tiempo de semirreacción t½', texto: 'Es la duración para que x valga x_f/2. En la curva es la abscisa del punto de ordenada x_f/2. Ojo: en t½ la reacción no ha terminado; se considera terminada hacia 6 a 7 t½.', fr: 't½ : durée au bout de laquelle l’avancement vaut la moitié de l’avancement final.' },
    ],
    montar(host, api) {
      const XF = 47, TAU = 20, TH = TAU * Math.LN2; // mmol/L, min
      const f = (t) => XF * (1 - Math.exp(-t / TAU)), df = (t) => (XF / TAU) * Math.exp(-t / TAU);
      const gx = (t) => 90 + (t / 80) * 640, gy = (v) => 360 - (v / 55) * 290;
      const S = { tm: 0, meta: null, reac: false };
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'rango', id: 'tm', txt: 't', min: 0, max: 80, paso: 0.5, val: 0, fmt: (v) => v.toFixed(0) + ' min' },
          { tipo: 'btn', txt: '▶ Recorrer', al: (S, E) => { E.set('tm', 0); S.meta = 80; if (S.red) { S.meta = null; E.set('tm', 40); } } },
        ],
        alCambiar(id, v, S) { S.meta = null; },
        paso(dt, S, E) { if (S.meta != null) { const v = S.tm + dt * 11; if (v >= S.meta) { E.set('tm', S.meta); S.meta = null; } else E.set('tm', v); } },
        ir(n, S, E) { S.meta = null; S.reac = n === 3; E.set('tm', [0, 0, 0, 10, TH][n]); if (n === 2 && !S.red) S.meta = 80; },
        dibujar(c, S) {
          const t = S.tm, n = S.n;
          lin(c, gx(0), gy(0), gx(80), gy(0), T2, 1); lin(c, gx(0), gy(0), gx(0), gy(55), T2, 1);
          txt(c, S.reac ? 'concentración (mmol·L⁻¹)' : '[I₂] (mmol·L⁻¹)', gx(0) + 4, gy(55) - 10, { s: 12, c: T2, a: 'left' }); txt(c, 't (min)', gx(80), gy(0) + 28, { s: 12, c: T2, a: 'right' });
          [0, 20, 40, 60, 80].forEach((v) => { lin(c, gx(v), gy(0), gx(v), gy(0) + 4, T2, 1); txt(c, String(v), gx(v), gy(0) + 14, { s: 11, c: T2 }); }); [10, 20, 30, 40, 50].forEach((v) => { lin(c, gx(0) - 4, gy(v), gx(0), gy(v), T2, 1); txt(c, String(v), gx(0) - 16, gy(v), { s: 11, c: T2 }); });
          const fr = (tt) => (S.reac ? XF - f(tt) : f(tt)), dfr = (tt) => (S.reac ? -df(tt) : df(tt));
          lin(c, gx(0), gy(XF), gx(80), gy(XF), '#ffffff22', 1, [5, 5]);
          if (S.reac) { c.beginPath(); for (let tt = 0; tt <= 80; tt += 1) { const x = gx(tt), y = gy(f(tt)); tt ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = '#2a6a58'; c.lineWidth = 2; c.stroke(); txt(c, '[I₂]', gx(80) - 4, gy(f(80)) - 10, { s: 12, c: '#2a8a68', a: 'right' }); }
          c.beginPath(); for (let tt = 0; tt <= 80; tt += 1) { const x = gx(tt), y = gy(fr(tt)); tt ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = S.reac ? MG : VE; c.lineWidth = 3.2; c.stroke();
          if (S.reac) txt(c, '[S₂O₈²⁻]', gx(60), gy(fr(60)) - 16, { s: 12, c: MG, b: 1 });
          // t½
          if (n >= 4) { lin(c, gx(0), gy(XF / 2), gx(TH), gy(XF / 2), AM, 1.5, [5, 4]); lin(c, gx(TH), gy(XF / 2), gx(TH), gy(0), AM, 1.5, [5, 4]); circ(c, gx(TH), gy(XF / 2), 6, AM); txt(c, 'x_f / 2', gx(0) + 6, gy(XF / 2) - 12, { s: 12, c: AM, a: 'left' }); txt(c, 't½ ≈ ' + TH.toFixed(0) + ' min', gx(TH) + 6, gy(0) - 12, { s: 13, c: AM, b: 1, a: 'left' }); txt(c, 'x_f', gx(80) - 4, gy(XF) - 10, { s: 12, c: T2, a: 'right' }); txt(c, 'la reacción no ha terminado en t½', gx(TH) + 14, gy(XF / 2) + 26, { s: 12, c: T2, a: 'left' }); if (!S.reac) { const k = clamp(6.5 * TH, 0, 80); } }
          // tangente
          const y0 = fr(t), m = dfr(t), x1 = Math.max(0, t - 18), x2 = Math.min(80, t + 18);
          c.save(); c.beginPath(); c.rect(gx(0), gy(55), gx(80) - gx(0), gy(0) - gy(55)); c.clip(); lin(c, gx(x1), gy(y0 + m * (x1 - t)), gx(x2), gy(y0 + m * (x2 - t)), AM, 2.2); c.restore();
          circ(c, gx(t), gy(y0), 6, AM, '#fff', 1.5);
          panel(c, 500, 190, 270, 74, GR);
          txt(c, S.reac ? 'v = −d[S₂O₈²⁻]/dt' : 'v = d[I₂]/dt', 635, 210, { s: 13, c: T2 });
          txt(c, (Math.abs(m)).toFixed(2).replace('.', ',') + ' mmol·L⁻¹·min⁻¹' + (S.reac ? '  (pendiente ' + m.toFixed(2).replace('.', ',') + ')' : ''), 635, 238, { s: 14, b: 1, c: AM });
          txt(c, 't = ' + t.toFixed(0) + ' min', 635, 256, { s: 12, c: T2 });
        },
      });
    },
    test: [
      { pregunta: 'Gráficamente, la velocidad volúmica de aparición de un producto en un instante es…', opciones: ['el coeficiente director de la tangente a la curva en ese instante', 'la altura de la curva', 'el área bajo la curva'], correcta: 0, explicacion: 'v = d[P]/dt es la pendiente de la tangente (p. 113).' },
      { pregunta: '¿Por qué hay un signo menos en v = −d[R]/dt?', opciones: ['Porque [R] disminuye y la velocidad debe ser positiva', 'Porque R es un catalizador', 'Porque el tiempo va hacia atrás'], correcta: 0, explicacion: 'La derivada de una concentración que baja es negativa.' },
      { pregunta: 'En t½ la reacción…', opciones: ['ha alcanzado la mitad del avance final, no ha terminado', 'ha terminado', 'ha avanzado un 75 %'], correcta: 0, explicacion: 't½: x = x_f/2. Se considera terminada hacia 6–7 t½.' },
    ],
  });

  // =====================================================================================
  // CAP. 5 · nucleaires
  // =====================================================================================
  const SIMB = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U'.split(' ');
  const sup = (n) => String(n).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('');
  const sub = (n) => String(n).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');
  const nuc = (Z, A) => sup(A) + sub(Z) + (SIMB[Z - 1] || '?');
  // valle de estabilidad (esquema aproximado: N = Z hasta Z = 20 y exceso de neutrones después)
  const nEst = (Z) => (Z <= 20 ? Z + Math.min(1, Z / 12) : Z + 1 + 0.6263 * (Z - 20) + 0.001344 * (Z - 20) * (Z - 20));
  const tolN = (Z) => 0.7 + 0.01 * Z;
  const diagnostico = (Z, N) => { const d = N - nEst(Z); if (Z >= 84) return 'alpha'; if (d > tolN(Z)) return 'beta-'; if (d < -tolN(Z)) return 'beta+'; return 'estable'; };

  // ---- 5.1 Diagrama (N, Z): valle de estabilidad (p. 136) ----
  reg({
    id: 'diagramme-nz', capitulos: ['nucleaires'], titulo: 'El valle de estabilidad: ¿qué núcleo se desintegra y cómo?', fr: 'Diagramme (N, Z) et vallée de la stabilité', pagina_pdf: 136,
    resumen: 'En el diagrama (N, Z) los núcleos estables forman una banda estrecha, el valle de estabilidad. Fuera de él, el exceso de neutrones, de protones o de nucleones decide si el núcleo emite β⁻, β⁺ o α.',
    pasos: [
      { titulo: 'El diagrama (N, Z)', texto: 'Cada casilla es un núcleo: Z (protones) en el eje horizontal, N (neutrones) en el vertical. La línea de puntos N = Z es la de los núcleos con tantos neutrones como protones. Pulsa en el diagrama para elegir un núcleo.', fr: 'Diagramme N = f(Z) : N le nombre de neutrons, Z le nombre de protons.' },
      { titulo: 'La banda estable', texto: 'Los núcleos ligeros (Z ≤ 20) son estables si N = Z. Los más pesados necesitan un exceso de neutrones, y por eso la banda se curva hacia arriba: es la vallée de la stabilité. El ¹²C está dentro; el ¹⁴C, no. (Banda esquemática y aproximada.)', fr: 'Les noyaux légers jusqu’à Z ≤ 20 sont stables si N = Z ; les plus lourds ont un excès de neutrons.' },
      { titulo: 'Exceso de neutrones → β⁻', texto: 'Por encima del valle sobran neutrones. El ¹⁴C (Z = 6, N = 8) transforma un neutrón en protón: Z sube 1 y N baja 1. En el diagrama la flecha va hacia abajo y a la derecha, de vuelta al valle.', fr: 'Un noyau qui possède un excès de neutrons peut subir une désintégration β⁻.' },
      { titulo: 'Exceso de protones → β⁺', texto: 'Por debajo del valle sobran protones. El ³⁰P (Z = 15, N = 15) transforma un protón en neutrón: Z baja 1 y N sube 1; la flecha va arriba y a la izquierda (se emite un positón).', fr: 'Un noyau qui possède un excès de protons peut subir une désintégration β⁺.' },
      { titulo: 'Núcleos muy pesados → α', texto: 'Más allá del plomo/bismuto, los núcleos tienen demasiados nucleones: emiten un núcleo de helio ⁴₂He y pierden 4 nucleones (Z − 2, N − 2). Ejemplo: ²²⁶₈₈Ra. Prueba con cualquier casilla y mira qué desintegración corresponde.', fr: 'Un noyau lourd contenant trop de nucléons peut subir une désintégration α.' },
    ],
    montar(host, api) {
      const S = { Z: 6, N: 6 };
      const PX0 = 70, PX1 = 540, PY0 = 380, PY1 = 40, ZM = 92, NM = 146;
      const gx = (z) => PX0 + (z / ZM) * (PX1 - PX0), gy = (n) => PY0 - (n / NM) * (PY0 - PY1);
      const PRE = [['¹²₆C (estable)', 6, 6], ['¹⁴₆C', 6, 8], ['³⁰₁₅P', 15, 15], ['²²⁶₈₈Ra', 88, 138], ['²⁰⁸₈₂Pb (estable)', 82, 126]];
      let eh = null;
      const E = escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'sel', id: 'pre', txt: 'Ejemplos', opciones: PRE.map((x) => x[0]), val: 0 },
          { tipo: 'rango', id: 'Z', txt: 'Z', min: 1, max: 92, paso: 1, val: 6, fmt: (v) => String(v) },
          { tipo: 'rango', id: 'N', txt: 'N', min: 0, max: 146, paso: 1, val: 6, fmt: (v) => String(v) },
        ],
        alCambiar(id, v, S, E) { if (id === 'pre') { E.set('Z', PRE[v][1]); E.set('N', PRE[v][2]); } },
        ir(n, S, E) { const k = [0, 0, 1, 2, 3][n]; E.el.pre.value = k; S.pre = k; E.set('Z', PRE[k][1]); E.set('N', PRE[k][2]); },
        dibujar(c, S) {
          const n = S.n, Z = S.Z, N = S.N, A = Z + N, dg = diagnostico(Z, N);
          // fondo por zonas
          c.save(); c.beginPath(); c.rect(PX0, PY1, PX1 - PX0, PY0 - PY1); c.clip();
          const banda = (k) => { c.beginPath(); for (let z = 0; z <= 92; z++) { const x = gx(z), y = gy(nEst(z) + k * tolN(z)); z ? c.lineTo(x, y) : c.moveTo(x, y); } };
          if (n >= 1) { c.beginPath(); for (let z = 0; z <= 92; z++) { const x = gx(z), y = gy(nEst(z) + tolN(z) + 1.6); z ? c.lineTo(x, y) : c.moveTo(x, y); } for (let z = 92; z >= 0; z--) c.lineTo(gx(z), gy(nEst(z) - tolN(z) - 1.6)); c.closePath(); c.fillStyle = '#2ee59d44'; c.fill();
            c.beginPath(); for (let z = 0; z <= 92; z++) { const x = gx(z), y = gy(nEst(z) + tolN(z)); z ? c.lineTo(x, y) : c.moveTo(x, y); } c.lineTo(gx(92), gy(NM)); c.lineTo(gx(0), gy(NM)); c.closePath(); c.fillStyle = '#4cc9f018'; c.fill();
            c.beginPath(); for (let z = 0; z <= 92; z++) { const x = gx(z), y = gy(nEst(z) - tolN(z)); z ? c.lineTo(x, y) : c.moveTo(x, y); } c.lineTo(gx(92), gy(0)); c.lineTo(gx(0), gy(0)); c.closePath(); c.fillStyle = '#ff3da618'; c.fill();
            c.fillStyle = '#ffd16618'; c.fillRect(gx(83.5), PY1, PX1 - gx(83.5), PY0 - PY1);
            for (let z = 1; z <= 83; z++) { const nn = Math.round(nEst(z)); c.fillStyle = '#2ee59dcc'; c.fillRect(gx(z) - 2, gy(nn) - 2, 4, 4); } }
          c.restore();
          lin(c, PX0, PY0, PX1, PY0, T2, 1.2); lin(c, PX0, PY0, PX0, PY1, T2, 1.2);
          [0, 20, 40, 60, 80].forEach((z) => { lin(c, gx(z), PY0, gx(z), PY0 + 4, T2, 1); txt(c, String(z), gx(z), PY0 + 14, { s: 11, c: T2 }); }); [0, 40, 80, 120].forEach((v) => { lin(c, PX0 - 4, gy(v), PX0, gy(v), T2, 1); txt(c, String(v), PX0 - 16, gy(v), { s: 11, c: T2 }); });
          txt(c, 'Z (protons)', PX1, PY0 + 28, { s: 12, c: T2, a: 'right' }); txt(c, 'N (neutrons)', PX0 + 6, PY1 - 10, { s: 12, c: T2, a: 'left' });
          lin(c, gx(0), gy(0), gx(60), gy(60), '#e8eefc', 1.4, [3, 4]); txt(c, 'N = Z', gx(60) + 6, gy(60) + 12, { s: 12, c: '#e8eefc', a: 'left' });
          if (n >= 1) { txt(c, 'vallée de la stabilité', gx(64), gy(108), { s: 12, c: VE, b: 1, a: 'left' }); lin(c, gx(64) + 6, gy(108) + 8, gx(52), gy(nEst(52)) - 4, VE, 1); txt(c, 'excès de neutrons', gx(10), gy(110), { s: 12, c: AZ, a: 'left' }); txt(c, 'excès de protons', gx(52), gy(18), { s: 12, c: MG, a: 'left' }); txt(c, 'noyaux lourds', gx(88), gy(140) + 4, { s: 12, c: AM, a: 'right' }); }
          // flecha de desintegración
          const dZ = dg === 'beta-' ? 1 : dg === 'beta+' ? -1 : dg === 'alpha' ? -2 : 0, dN = dg === 'beta-' ? -1 : dg === 'beta+' ? 1 : dg === 'alpha' ? -2 : 0;
          if (dg !== 'estable') { const k = 1 + 0.2 * Math.sin(S.t * 5); const x1 = gx(Z), y1 = gy(N), x2 = gx(Z + dZ), y2 = gy(N + dN); const L = Math.hypot(x2 - x1, y2 - y1) || 1; flecha(c, x1, y1, x1 + (x2 - x1) * 4 * k, y1 + (y2 - y1) * 4 * k, dg === 'alpha' ? AM : dg === 'beta-' ? AZ : MG, 3); }
          const k2 = 0.5 + 0.5 * Math.sin(S.t * 4); circ(c, gx(Z), gy(N), 7 + k2 * 2, '#ffffff22', '#ffffff', 2); circ(c, gx(Z), gy(N), 3.5, AM);
          // panel
          panel(c, 560, 40, 222, 340, GR);
          txt(c, nuc(Z, A), 671, 84, { s: 36, b: 1, c: TX });
          txt(c, 'A = ' + A + ' · Z = ' + Z + ' · N = ' + N, 671, 120, { s: 13, c: T2 }); txt(c, 'N/Z = ' + (N / Z).toFixed(2).replace('.', ','), 671, 140, { s: 13, c: T2 });
          const info = { 'estable': ['estable', 'dentro del valle', VE], 'beta-': ['radiactivo β⁻', 'exceso de neutrones', AZ], 'beta+': ['radiactivo β⁺', 'exceso de protones', MG], 'alpha': ['radiactivo α', 'demasiados nucleones', AM] }[dg];
          chip(c, info[0], 671, 176, info[2], { s: 14 }); txt(c, info[1], 671, 204, { s: 13, c: info[2] });
          if (dg !== 'estable') {
            const Zh = Z + dZ, Ah = dg === 'alpha' ? A - 4 : A, part = dg === 'alpha' ? '⁴₂He' : dg === 'beta-' ? '⁰₋₁e' : '⁰₁e';
            txt(c, nuc(Z, A) + ' →', 671, 248, { s: 15, b: 1 }); txt(c, nuc(Zh, Ah) + ' + ' + part, 671, 272, { s: 15, b: 1, c: info[2] });
            txt(c, 'Z : ' + Z + ' = ' + Zh + ' + ' + (dg === 'alpha' ? 2 : dg === 'beta-' ? -1 : 1), 671, 306, { s: 12, c: T2 }); txt(c, 'A : ' + A + ' = ' + Ah + ' + ' + (dg === 'alpha' ? 4 : 0), 671, 324, { s: 12, c: T2 });
            txt(c, dg === 'beta-' ? 'n → p' : dg === 'beta+' ? 'p → n' : '−4 nucléons', 671, 352, { s: 13, c: info[2], b: 1 });
          } else txt(c, 'no se desintegra', 671, 262, { s: 14, c: T2 });
        },
      });
      E.E.canvas.style.cursor = 'crosshair';
      E.E.canvas.addEventListener('pointerdown', (ev) => { const r = E.E.canvas.getBoundingClientRect(), lx = ((ev.clientX - r.left) / r.width) * W, ly = ((ev.clientY - r.top) / r.height) * H; if (lx >= PX0 - 6 && lx <= PX1 + 6 && ly >= PY1 - 6 && ly <= PY0 + 6) { const z = clamp(Math.round(((lx - PX0) / (PX1 - PX0)) * ZM), 1, 92), nn = clamp(Math.round(((PY0 - ly) / (PY0 - PY1)) * NM), 0, 146); E.E.set('Z', z); E.E.set('N', nn); } });
      return E;
    },
    test: [
      { pregunta: 'El ¹⁴₆C (6 protones, 8 neutrones) está por encima del valle. ¿Cómo se desintegra?', opciones: ['β⁻: un neutrón se transforma en protón', 'β⁺: un protón se transforma en neutrón', 'α: emite helio'], correcta: 0, explicacion: 'Exceso de neutrones → β⁻ (p. 136): ¹⁴₆C → ¹⁴₇N + ⁰₋₁e.' },
      { pregunta: 'Los núcleos ligeros (Z ≤ 20) son estables si…', opciones: ['N = Z', 'N = 2Z', 'N = 0'], correcta: 0, explicacion: 'Los más pesados necesitan exceso de neutrones.' },
      { pregunta: 'Un núcleo muy pesado con demasiados nucleones suele emitir…', opciones: ['una partícula α (⁴₂He)', 'un fotón γ únicamente', 'un neutrón del átomo vecino'], correcta: 0, explicacion: 'La desintegración α elimina 4 nucleones.' },
    ],
  });

  // ---- 5.2 α, β⁻, β⁺, γ: qué sale del núcleo y cómo cambian Z y A (p. 136–137) ----
  reg({
    id: 'desintegraciones', capitulos: ['nucleaires'], titulo: 'α, β⁻, β⁺, γ: qué sale del núcleo', fr: 'Radioactivités α, β⁻, β⁺ et γ · lois de conservation', pagina_pdf: 136,
    resumen: 'Cada radiactividad expulsa algo distinto del núcleo. Cuenta protones y neutrones antes y después: la carga (Z) y el número de nucleones (A) siempre se conservan.',
    pasos: [
      { titulo: 'Un núcleo inestable', texto: 'Aquí ves un núcleo como un racimo de protones (magenta) y neutrones (gris). Un núcleo inestable es radiactivo: se transforma espontáneamente en otro más estable emitiendo una radiación. Elige un tipo con el selector o con los pasos.', fr: 'Les noyaux instables se transforment spontanément en d’autres noyaux plus stables lors de désintégrations.' },
      { titulo: 'α: sale un núcleo de helio', texto: '²²⁶₈₈Ra emite ⁴₂He (2 protones + 2 neutrones): se pierden 4 nucleones, Z baja 2 y A baja 4. Resultado: ²²²₈₆Rn. (El racimo está dibujado con pocas esferas representativas.)', fr: '²²⁶₈₈Ra → ²²²₈₆Rn + ⁴₂He' },
      { titulo: 'β⁻: un neutrón se hace protón', texto: '¹⁴₆C tiene exceso de neutrones: un neutrón se transforma en protón y se emite un electrón. Z sube 1 y A no cambia: ¹⁴₇N.', fr: '¹⁴₆C → ¹⁴₇N + ⁰₋₁e' },
      { titulo: 'β⁺: un protón se hace neutrón', texto: '³⁰₁₅P tiene exceso de protones: un protón se transforma en neutrón y se emite un positón (misma masa que el electrón, carga opuesta). Z baja 1 y A no cambia: ³⁰₁₄Si.', fr: '³⁰₁₅P → ³⁰₁₄Si + ⁰₁e' },
      { titulo: 'γ: el núcleo hijo se relaja', texto: 'Tras una desintegración, el núcleo hijo suele quedar excitado (X*). Vuelve al estado fundamental emitiendo uno o varios fotones γ: no hay cambio de Z ni de A. γ es una onda electromagnética, no una partícula.', fr: 'Le noyau fils excité X* revient à l’état fondamental en émettant des photons γ.' },
    ],
    montar(host, api) {
      const TIPOS = [
        { id: 'a', n: 'α · ²²⁶₈₈Ra', Z: 88, A: 226, p: 12, nn: 14, hijo: [86, 222], part: '⁴₂He', col: AM, eq: '²²⁶₈₈Ra → ²²²₈₆Rn + ⁴₂He', z2: 2, a2: 4 },
        { id: 'b-', n: 'β⁻ · ¹⁴₆C', Z: 6, A: 14, p: 6, nn: 8, hijo: [7, 14], part: '⁰₋₁e', col: AZ, eq: '¹⁴₆C → ¹⁴₇N + ⁰₋₁e', z2: -1, a2: 0 },
        { id: 'b+', n: 'β⁺ · ³⁰₁₅P', Z: 15, A: 30, p: 15, nn: 15, hijo: [14, 30], part: '⁰₁e', col: MG, eq: '³⁰₁₅P → ³⁰₁₄Si + ⁰₁e', z2: 1, a2: 0 },
        { id: 'g', n: 'γ · núcleo excitado', Z: 7, A: 14, p: 7, nn: 7, hijo: [7, 14], part: 'γ', col: '#ffffff', eq: '¹⁴₇N* → ¹⁴₇N + γ', z2: 0, a2: 0 },
      ];
      const S = { tipo: 0, p: 0, meta: null };
      const rng0 = PCB.util.rng ? PCB.util.rng : (s) => Math.random;
      const bolas = TIPOS.map((t, ti) => { const rg = rng0(40 + ti);
        const lista = []; for (let i = 0; i < t.p; i++) lista.push('p'); for (let i = 0; i < t.nn; i++) lista.push('n'); for (let i = lista.length - 1; i > 0; i--) { const j = Math.floor(rg() * (i + 1)); [lista[i], lista[j]] = [lista[j], lista[i]]; }
        return lista.map((k, i) => { const R = (t.A > 100 ? 9 : 14) * Math.sqrt(i + 0.5) * (t.A > 100 ? 1.0 : 1.0), a = i * 2.39996; return { k, x: Math.cos(a) * R, y: Math.sin(a) * R }; }); });
      const CX = 270, CY = 215;
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'sel', id: 'tipo', txt: 'Radiactividad', opciones: TIPOS.map((t) => t.n), val: 0 },
          { tipo: 'rango', id: 'p', txt: 'avance', min: 0, max: 1, paso: 0.01, val: 0, fmt: (v) => Math.round(v * 100) + ' %' },
          { tipo: 'btn', txt: '▶ Desintegrar', al: (S, E) => { if (S.p >= 0.99) E.set('p', 0); S.meta = 1; if (S.red) { E.set('p', 1); S.meta = null; } } },
          { tipo: 'btn', txt: '↺', al: (S, E) => { S.meta = null; E.set('p', 0); } },
        ],
        alCambiar(id, v, S, E) { if (id === 'p') S.meta = null; if (id === 'tipo') { S.meta = null; E.set('p', 0); } },
        paso(dt, S, E) { if (S.meta != null) { const v = S.p + dt * 0.35; if (v >= S.meta) { E.set('p', S.meta); S.meta = null; } else E.set('p', v); } },
        ir(n, S, E) { S.meta = null; if (n === 0) { E.el.tipo.value = 1; S.tipo = 1; E.set('p', 0); } else { S.tipo = n - 1; E.el.tipo.value = n - 1; E.set('p', 0); if (S.red) E.set('p', 1); else S.meta = 1; } },
        dibujar(c, S) {
          const T = TIPOS[S.tipo], p = S.p, B = bolas[S.tipo], big = T.A > 100, r = big ? 8 : 12, ease = p * p * (3 - 2 * p);
                    // marca de los emitidos (α: dos p y dos n)
          let idxA = [];
          if (T.id === 'a') { let pp = 0, nn = 0; B.forEach((b, i) => { if (b.k === 'p' && pp < 2 && Math.hypot(b.x, b.y) > 22) { idxA.push(i); pp++; } else if (b.k === 'n' && nn < 2 && Math.hypot(b.x, b.y) > 22) { idxA.push(i); nn++; } }); }
          let cambio = -1; if (T.id === 'b-') cambio = B.findIndex((b) => b.k === 'n'); if (T.id === 'b+') cambio = B.findIndex((b) => b.k === 'p');
          const glow = T.id === 'g' ? 0.5 + 0.5 * Math.sin(S.t * 6) * (1 - ease) : 0;
          if (T.id === 'g' && p < 1) { c.globalAlpha = 0.1 + 0.12 * glow; circ(c, CX, CY, 78, '#ffffff', null); c.globalAlpha = 1; circ(c, CX, CY, 78, null, '#ffffff66', 1.5); }
          B.forEach((b, i) => { let x = CX + b.x, y = CY + b.y, k = b.k, a = 1; if (T.id === 'a' && idxA.includes(i)) { const j = idxA.indexOf(i), tx = CX + 150 + (j % 2) * 15 + 150 * ease * 0.0, ty = CY - 90 + (j >> 1) * 15; x = lerp(CX + b.x, tx + 30 * ease, ease); y = lerp(CY + b.y, ty - 10 * ease, ease); } if (i === cambio && p > 0.4) k = T.id === 'b-' ? 'p' : 'n'; const col = k === 'p' ? MG : '#9aa3c4'; circ(c, x, y, r, col + 'cc', col, 1.6); });
          // partículas emitidas
          if (T.id === 'b-' || T.id === 'b+') { const q = ph2(p, 0.3, 1); if (q > 0) { const x = CX + 40 + q * 260, y = CY - 30 - q * 60, col = T.col; circ(c, x, y, 7, col + 'aa', col, 2); txt(c, T.id === 'b-' ? 'e⁻' : 'e⁺', x, y - 18, { s: 13, c: col, b: 1 }); } if (cambio >= 0 && p > 0.3 && p < 0.9) { const b = B[cambio]; circ(c, CX + b.x, CY + b.y, r + 5 + 3 * Math.sin(S.t * 10), null, AM, 2); } }
          if (T.id === 'g') { const q = ph2(p, 0.3, 1); if (q > 0) { c.beginPath(); for (let x = 0; x < q * 300; x += 3) { const xx = CX + 70 + x, yy = CY - 20 - x * 0.2 + 10 * Math.sin(x * 0.28 - S.t * 12); x ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.strokeStyle = '#ffffff'; c.lineWidth = 2.5; c.stroke(); txt(c, 'γ', CX + 80 + q * 300, CY - 40 - q * 60, { s: 18, c: '#fff', b: 1 }); } }
          if (T.id === 'a' && p > 0.3) txt(c, '⁴₂He (α)', CX + 190, CY - 126, { s: 15, c: AM, b: 1 });
          // etiquetas del núcleo
          const desp = p > 0.5, Zc = desp ? T.hijo[0] : T.Z, Ac = desp ? T.hijo[1] : T.A;
          txt(c, T.id === 'g' && !desp ? '¹⁴₇N*' : nuc(Zc, Ac), CX, CY + 128, { s: 26, b: 1, c: TX });
          // panel de conservación
          panel(c, 520, 56, 262, 300, GR);
          txt(c, 'Lois de conservation', 651, 78, { s: 14, b: 1, c: VE });
          txt(c, T.eq, 651, 110, { s: 16, b: 1, c: T.col });
          const z1 = T.Z, a1 = T.A, z2 = T.hijo[0] + T.z2, a2 = T.hijo[1] + T.a2;
          txt(c, 'carga (Z)', 651, 146, { s: 12, c: T2 }); txt(c, z1 + ' = ' + T.hijo[0] + ' + ' + (T.z2 < 0 ? '(' + T.z2 + ')' : T.z2) + '  ✔', 651, 168, { s: 16, b: 1, c: TX });
          txt(c, 'nucleones (A)', 651, 206, { s: 12, c: T2 }); txt(c, a1 + ' = ' + T.hijo[1] + ' + ' + T.a2 + '  ✔', 651, 228, { s: 16, b: 1, c: TX });
          txt(c, T.id === 'a' ? 'sale: 2 p + 2 n' : T.id === 'b-' ? 'n → p + e⁻' : T.id === 'b+' ? 'p → n + e⁺' : 'ni Z ni A cambian', 651, 270, { s: 14, b: 1, c: T.col });
          txt(c, T.id === 'a' ? '(se eliminan 4 nucleones)' : T.id === 'g' ? 'γ = onda electromagnética' : 'positón = antielectrón', 651, 296, { s: 12, c: T2 });
          txt(c, 'p ● protón   n ● neutrón', 651, 336, { s: 12, c: T2 });
        },
      });
      function ph2(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
    },
    test: [
      { pregunta: 'En una desintegración β⁻ del ¹⁴₆C, ¿qué le pasa al núcleo?', opciones: ['Un neutrón se transforma en protón: Z + 1, A igual', 'Pierde dos protones y dos neutrones', 'Un protón se transforma en neutrón'], correcta: 0, explicacion: '¹⁴₆C → ¹⁴₇N + ⁰₋₁e.' },
      { pregunta: 'La radiación α está formada por…', opciones: ['un núcleo de helio ⁴₂He', 'un electrón', 'un fotón'], correcta: 0, explicacion: 'Se eliminan 4 nucleones (2 p + 2 n).' },
      { pregunta: 'Una ecuación nuclear correcta debe conservar…', opciones: ['la carga (Z) y el número de nucleones (A)', 'solo la masa en gramos', 'solo el número de neutrones'], correcta: 0, explicacion: 'Lois de conservation de la charge et du nombre de nucléons.' },
    ],
  });

  // ---- 5.3 Decaimiento aleatorio y t½ (p. 137–138) ----
  reg({
    id: 'decaimiento-aleatorio', capitulos: ['nucleaires'], titulo: 'Cada núcleo decae al azar, el conjunto sigue la ley', fr: 'Phénomène aléatoire · loi de décroissance · temps de demi-vie', pagina_pdf: 137,
    resumen: 'No se puede prever cuándo se desintegra un núcleo concreto, pero con muchos núcleos la curva N(t) es suave y exponencial: cada t½ se desintegra la mitad de los que quedan.',
    pasos: [
      { titulo: 'Una muestra radiactiva', texto: 'Cada casilla es un núcleo radiactivo (N₀ en total). Tienen la misma probabilidad por unidad de tiempo de desintegrarse, que depende solo del tipo de núcleo: la constante radiactiva λ.', fr: 'N₀ est le nombre de noyaux radioactifs initialement présents.' },
      { titulo: 'La desintegración es aleatoria', texto: 'Con pocos núcleos (N₀ = 20) pulsa «Iniciar»: se apagan en desorden y la curva roja (la simulación) se desvía de la teórica. Es imposible saber cuál se desintegrará ni cuándo.', fr: 'La désintégration d’un noyau est un phénomène aléatoire.' },
      { titulo: 'Muchos núcleos: ley de decaimiento', texto: 'Con N₀ = 400 la curva simulada se pega a N(t) = N₀·e^(−λt). El azar individual se promedia: el comportamiento colectivo es predecible.', fr: 'N(t) = N₀·e^(−λ·t)' },
      { titulo: 'Tiempo de semivida t½', texto: 'Tras t½ queda N₀/2; tras 2 t½ queda N₀/4 (¡no cero!); tras 3 t½, N₀/8. La semivida es una propiedad del núcleo, no depende de cuántos haya.', fr: 'N(t½) = N₀/2 ; t½ = ln 2 / λ' },
      { titulo: 'Actividad: desintegraciones por segundo', texto: 'La actividad A = λ·N es el número medio de desintegraciones por segundo (becquerel). Se ve en las barras: baja al mismo ritmo que N, porque quedan menos núcleos que puedan decaer.', fr: 'A(t) = A₀·e^(−λ·t) ; 1 Bq = 1 désintégration par seconde.' },
    ],
    montar(host, api) {
      const rng = PCB.util.rng ? PCB.util.rng(99) : Math.random;
      const TV = 3; // segundos de pantalla por t½
      const S = { N0: 20, tau: 0, vivos: [], hist: [], corre: false, hechas: [], act: 0, bin: [] };
      function reinicia(S) { S.vivos = []; for (let i = 0; i < S.N0; i++) S.vivos.push(true); S.tau = 0; S.hist = [[0, S.N0]]; S.bin = []; S.corre = false; S.flash = []; }
      reinicia(S);
      const gx = (t) => 400 + (t / 5) * 370, gy = (f) => 330 - f * 250;
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'rango', id: 'N0', txt: 'N₀', min: 10, max: 400, paso: 10, val: 20, fmt: (v) => String(v) },
          { tipo: 'btn', id: 'go', txt: '▶ Iniciar', al: (S, E) => { if (S.tau > 4.9 || !S.corre && S.tau > 0 && S.vivos.every((v) => !v)) reinicia(S); S.corre = true; } },
          { tipo: 'btn', txt: '↺ Reiniciar', al: (S) => reinicia(S) },
        ],
        alCambiar(id, v, S) { reinicia(S); },
        paso(dt, S) {
          if (!S.corre) return; const dtau = dt / TV * (S.red ? 0.7 : 1), pr = 1 - Math.pow(0.5, dtau); let k = 0;
          for (let i = 0; i < S.vivos.length; i++) if (S.vivos[i] && rng() < pr) { S.vivos[i] = false; k++; S.flash.push({ i, t: 0 }); }
          S.tau += dtau; S.hist.push([S.tau, S.vivos.filter(Boolean).length]); S.act = k / dt; S.bin.push([S.tau, k / dtau / TV * 0 + k]); if (S.tau >= 5) S.corre = false;
          S.flash.forEach((f) => (f.t += dt)); S.flash = S.flash.filter((f) => f.t < 0.4);
        },
        ir(n, S, E) { S.corre = false; if (n === 0) { E.set('N0', 20); reinicia(S); } else if (n === 1) { E.set('N0', 20); reinicia(S); S.corre = !S.red; if (S.red) { for (let i = 0; i < 40; i++) { /* sin animación: curva teórica */ } } } else if (n === 2) { E.set('N0', 400); reinicia(S); S.corre = true; } else if (n === 3) { E.set('N0', 200); reinicia(S); S.corre = true; } else { E.set('N0', 200); reinicia(S); S.corre = true; } },
        dibujar(c, S) {
          const n = S.n, N0 = S.N0, Nt = S.vivos.filter(Boolean).length;
          // rejilla de núcleos
          const cols = Math.ceil(Math.sqrt(N0 * 1.2)), cell = Math.min(270 / cols, 270 / Math.ceil(N0 / cols), 26), gx0 = 40, gy0 = 70;
          txt(c, 'noyaux radioactifs', gx0 + 135, 52, { s: 13, c: T2 });
          for (let i = 0; i < N0; i++) { const x = gx0 + (i % cols) * cell + cell / 2, y = gy0 + Math.floor(i / cols) * cell + cell / 2; const vivo = S.vivos[i]; circ(c, x, y, cell * 0.38, vivo ? '#ff3da6cc' : '#1b2650', vivo ? MG : '#2a376b', 1.2); }
          S.flash.forEach((f) => { const x = gx0 + (f.i % cols) * cell + cell / 2, y = gy0 + Math.floor(f.i / cols) * cell + cell / 2; c.globalAlpha = 1 - f.t / 0.4; circ(c, x, y, cell * 0.4 + f.t * 40, null, '#fff', 1.6); c.globalAlpha = 1; });
          txt(c, 'N(t) = ' + Nt + ' / ' + N0, 175, 360, { s: 16, b: 1, c: TX });
          // gráfica N/N0 vs t/t½
          lin(c, gx(0), gy(0), gx(5), gy(0), T2, 1); lin(c, gx(0), gy(0), gx(0), gy(1), T2, 1); txt(c, 'N / N₀', gx(0) + 4, gy(1) - 10, { s: 12, c: T2, a: 'left' }); txt(c, 't / t½', gx(5), gy(0) + 28, { s: 12, c: T2, a: 'right' });
          for (let i = 0; i <= 5; i++) { lin(c, gx(i), gy(0), gx(i), gy(0) + 4, T2, 1); txt(c, String(i), gx(i), gy(0) + 14, { s: 11, c: T2 }); } [0.25, 0.5, 0.75, 1].forEach((f) => { lin(c, gx(0) - 4, gy(f), gx(0), gy(f), T2, 1); txt(c, String(f).replace('.', ','), gx(0) - 18, gy(f), { s: 11, c: T2 }); });
          c.beginPath(); for (let t = 0; t <= 5.001; t += 0.05) { const x = gx(t), y = gy(Math.pow(0.5, t)); t ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = '#7b86ad'; c.lineWidth = 2; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]);
          txt(c, 'N₀·e^(−λt)', gx(2.2), gy(0.5) - 24, { s: 12, c: '#aab4d4', a: 'left' });
          c.beginPath(); S.hist.forEach((h, i) => { const x = gx(h[0]), y = gy(h[1] / N0); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.strokeStyle = MG; c.lineWidth = 2.6; c.stroke(); txt(c, 'simulación', gx(3.2), gy(0.5) + 38, { s: 12, c: MG, b: 1, a: 'left' });
          if (n >= 3) { [[1, '1/2'], [2, '1/4'], [3, '1/8']].forEach(([k, f]) => { lin(c, gx(k), gy(0), gx(k), gy(Math.pow(0.5, k)), AM, 1.2, [4, 4]); lin(c, gx(0), gy(Math.pow(0.5, k)), gx(k), gy(Math.pow(0.5, k)), AM, 1.2, [4, 4]); circ(c, gx(k), gy(Math.pow(0.5, k)), 4, AM); txt(c, k === 1 ? 't½ → N₀/2' : k === 2 ? '2 t½ → N₀/4' : '3 t½ → N₀/8', gx(k) + 8, gy(Math.pow(0.5, k)) - 12, { s: 12, c: AM, b: 1, a: 'left' }); }); }
          if (n >= 4) { const mx = 28; const tmax = 5; panel(c, 40, 380, 300, 26, GR); txt(c, 'A = λ·N ≈ ' + (S.corre ? Math.round(Nt * Math.LN2 / TV * 10) / 10 : 0).toFixed(1).replace('.', ',') + ' désint./s (en pantalla)', 190, 393, { s: 12, c: TX }); }
          txt(c, S.tau.toFixed(2).replace('.', ',') + ' t½', gx(5), gy(1) - 10, { s: 13, c: AM, b: 1, a: 'right' });
        },
      });
    },
    test: [
      { pregunta: 'Si empiezas con N₀ núcleos, ¿cuántos quedan tras 2 t½?', opciones: ['N₀/4', 'cero', 'N₀/2'], correcta: 0, explicacion: 'Cada t½ queda la mitad de los que había: N₀/2 y después N₀/4.' },
      { pregunta: 'La desintegración de un núcleo concreto…', opciones: ['es aleatoria: no se puede predecir cuándo', 'ocurre siempre en t½', 'depende de cuántos núcleos haya'], correcta: 0, explicacion: 'Solo el conjunto sigue una ley estadística (p. 137).' },
      { pregunta: 'La semivida t½ depende de…', opciones: ['el tipo de núcleo (λ)', 'el número inicial de núcleos', 'la temperatura de la muestra'], correcta: 0, explicacion: 't½ = ln2/λ es característica del núcleo radiactivo.' },
    ],
  });

  // ---- 5.4 Datación por carbono 14 (p. 134, 138, 143 ex. 23) ----
  reg({
    id: 'datation-c14', capitulos: ['nucleaires'], titulo: 'Datación con carbono 14: un reloj que se apaga', fr: 'Principe de la datation au carbone 14', pagina_pdf: 138,
    resumen: 'Un ser vivo renueva su ¹⁴C y mantiene constante la proporción ¹⁴C/¹²C. Al morir, el ¹⁴C ya no se renueva y su actividad cae como e^(−λt): midiéndola se deduce la edad.',
    pasos: [
      { titulo: 'En vida: proporción constante', texto: 'Mientras vive, el organismo intercambia carbono con el entorno: cada ¹⁴C que decae es reemplazado por otro nuevo. La proporción ¹⁴C/¹²C permanece prácticamente constante.', fr: 'La proportion ¹⁴C/¹²C est quasi constante chez les êtres vivants.' },
      { titulo: 'Al morir: se corta la renovación', texto: 'Tras la muerte (t = 0) ya no entra ¹⁴C nuevo. El ¹²C, estable, no cambia; el ¹⁴C, radiactivo, empieza a decaer. Mueve el deslizador «Edad» para ver cómo se apaga.', fr: 'À sa mort, le ¹⁴C n’est plus renouvelé.' },
      { titulo: 'La actividad cae como e^(−λt)', texto: 'La actividad A(t) = A₀·e^(−λt) cae a la mitad cada t½. Con λ(¹⁴C) = 3,87·10⁻¹² s⁻¹ (ex. 23) sale t½ ≈ 5,7·10³ años: cada ≈ 5 700 años se pierde la mitad del ¹⁴C.', fr: 'A(t) = A₀·e^(−λ·t)' },
      { titulo: 'Medir A y despejar la edad', texto: 'Ejemplo del cours (ex. 23): un trozo de madera de un drakkar tiene A = 12,0 desint./min por gramo de carbono, frente a A₀ = 13,6 del carbono vivo. De t = (1/λ)·ln(A₀/A) sale t ≈ 1,03·10³ años. Pulsa «Madera del drakkar».', fr: 't = (1/λ)·ln(A₀ / A(t))' },
      { titulo: 'Un reloj con ritmo fijo', texto: 'Cada t½ la actividad se divide por 2: 1/2, 1/4, 1/8… Por eso el método sirve para edades de algunos miles de años; con muy poco ¹⁴C restante la medida deja de ser fiable.', fr: 'La loi de décroissance permet de dater un échantillon.' },
    ],
    montar(host, api) {
      const LAM = 3.87e-12, AN = 365.25 * 86400, T12 = Math.LN2 / LAM / AN, A0 = 13.6; // años, desint/min/g
      const rng = PCB.util.rng ? PCB.util.rng(21) : Math.random;
      const S = { edad: 0, meta: null, vivo: true };
      const gx = (t) => 410 + (t / 20000) * 350, gy = (a) => 298 - (a / 14) * 215;
      const C12 = []; for (let i = 0; i < 30; i++) C12.push({ x: 70 + rng() * 270, y: 118 + rng() * 150, ph: rng() * 6 });
      const C14 = []; for (let i = 0; i < 24; i++) C14.push({ x: 70 + rng() * 270, y: 118 + rng() * 150, ph: rng() * 6, u: rng() });
      return escena(host, api, {
        estado: S,
        controles: [
          { tipo: 'rango', id: 'edad', txt: 'Edad', min: 0, max: 20000, paso: 50, val: 0, fmt: (v) => Math.round(v).toLocaleString('es') + ' años' },
          { tipo: 'btn', txt: '🛶 Madera del drakkar', al: (S, E) => { S.vivo = false; S.meta = null; E.set('edad', 1025); S.drak = true; } },
          { tipo: 'btn', txt: '▶ Recorrer', al: (S, E) => { S.vivo = false; E.set('edad', 0); S.meta = 20000; S.drak = false; if (S.red) { S.meta = null; E.set('edad', 5700); } } },
        ],
        alCambiar(id, v, S) { S.meta = null; S.drak = false; S.vivo = false; },
        paso(dt, S, E) { if (S.meta != null) { const v = S.edad + dt * 2600; if (v >= S.meta) { E.set('edad', S.meta); S.meta = null; } else E.set('edad', v); } },
        ir(n, S, E) { S.meta = null; S.drak = false; S.vivo = n === 0; if (n === 0) E.set('edad', 0); else if (n === 1) E.set('edad', 0); else if (n === 2) { E.set('edad', 0); if (S.red) E.set('edad', 5700); else S.meta = 11500; } else if (n === 3) { E.set('edad', 1025); S.drak = true; } else { E.set('edad', 0); if (S.red) E.set('edad', 17100); else S.meta = 17200; } },
        dibujar(c, S) {
          const n = S.n, t = S.edad, f = Math.exp(-LAM * t * AN), A = A0 * f, vivo = S.vivo && n === 0;
          // organismo
          rr(c, 50, 86, 310, 210, 18); c.fillStyle = vivo ? '#143a2e66' : '#2a1a2e66'; c.fill(); c.strokeStyle = vivo ? VE : '#7b86ad'; c.lineWidth = 2.5; c.stroke();
          txt(c, vivo ? 'ser vivo : renueva su carbono' : 'ser muerto : sin renovación', 205, 70, { s: 13, b: 1, c: vivo ? VE : T2 });
          C12.forEach((p) => { circ(c, p.x + Math.sin(S.t * 1.5 + p.ph) * 4, p.y + Math.cos(S.t * 1.2 + p.ph) * 4, 6, '#aab4d4aa', '#aab4d4', 1.2); });
          const rest = vivo ? 24 : Math.round(24 * f);
          C14.forEach((p, i) => { if (i < rest) { c.globalAlpha = 1; circ(c, p.x + Math.sin(S.t * 1.7 + p.ph) * 4, p.y + Math.cos(S.t * 1.3 + p.ph) * 4, 6.5, '#ff3da6cc', MG, 1.5); } else if (!vivo) { c.globalAlpha = 0.12; circ(c, p.x, p.y, 6.5, null, MG, 1); c.globalAlpha = 1; } });
          c.globalAlpha = 1;
          if (vivo) { const k = 0.5 + 0.5 * Math.sin(S.t * 3); c.globalAlpha = k; flecha(c, 40, 190, 70, 190, VE, 2); c.globalAlpha = 1; txt(c, 'entra ¹⁴C nuevo', 40, 308, { s: 12, c: VE, a: 'left' }); }
          [['¹²C (estable)', '#aab4d4'], ['¹⁴C (radiactivo)', MG]].forEach((l, i) => { circ(c, 62 + i * 160, 322, 6, l[1] + 'aa', l[1], 1.3); txt(c, l[0], 74 + i * 160, 322, { s: 12, a: 'left' }); });
          txt(c, '¹⁴C/¹²C : ' + (vivo ? '100' : Math.round(f * 100)) + ' % del valor en vida', 205, 350, { s: 14, b: 1, c: TX });
          // gráfica A(t)
          lin(c, gx(0), gy(0), gx(20000), gy(0), T2, 1); lin(c, gx(0), gy(0), gx(0), gy(14), T2, 1);
          txt(c, 'A (desint./min/g de C)', gx(0) + 4, gy(14) - 12, { s: 12, c: T2, a: 'left' }); txt(c, 'edad (años)', gx(20000), gy(0) + 27, { s: 12, c: T2, a: 'right' });
          [0, 5000, 10000, 15000, 20000].forEach((v) => { lin(c, gx(v), gy(0), gx(v), gy(0) + 4, T2, 1); txt(c, v / 1000 + ' k', gx(v), gy(0) + 14, { s: 11, c: T2 }); }); [0, 5, 10].forEach((v) => { lin(c, gx(0) - 4, gy(v), gx(0), gy(v), T2, 1); txt(c, String(v), gx(0) - 14, gy(v), { s: 11, c: T2 }); });
          lin(c, gx(0), gy(A0), gx(20000), gy(A0), '#ffffff22', 1, [5, 5]); txt(c, 'A₀ = 13,6', gx(20000) - 4, gy(A0) - 10, { s: 12, c: T2, a: 'right' });
          c.beginPath(); for (let tt = 0; tt <= 20000; tt += 200) { const x = gx(tt), y = gy(A0 * Math.exp(-LAM * tt * AN)); tt ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = MG; c.lineWidth = 3; c.stroke();
          if (n >= 2) { [1, 2, 3].forEach((k) => { const tk = k * T12, ak = A0 * Math.pow(0.5, k); if (tk < 20000) { lin(c, gx(tk), gy(0), gx(tk), gy(ak), AM, 1.2, [4, 4]); lin(c, gx(0), gy(ak), gx(tk), gy(ak), AM, 1.2, [4, 4]); circ(c, gx(tk), gy(ak), 3.5, AM); txt(c, (k === 1 ? 't½ ' : k + ' t½ ') + '→ ' + (ak).toFixed(1).replace('.', ','), gx(tk) + 6, gy(ak) - 10, { s: 11, c: AM, a: 'left' }); } }); }
          if (!vivo) { circ(c, gx(t), gy(A), 6, '#fff', MG, 2); lin(c, gx(t), gy(A), gx(t), gy(0), '#fff', 1, [3, 3]); }
          if (S.drak || n === 3) { lin(c, gx(0), gy(12.0), gx(1025), gy(12.0), VE, 1.5, [5, 4]); txt(c, 'A = 12,0', gx(1025) + 150, gy(12.0) - 14, { s: 12, c: VE, b: 1 }); }
          panel(c, 410, 332 - 0, 350, 74, GR);
          txt(c, 'A(t) = ' + A0.toString().replace('.', ',') + ' · e^(−λt) = ' + A.toFixed(1).replace('.', ',') + ' desint./min/g', 585, 350, { s: 13, b: 1, c: TX });
          txt(c, vivo ? 'ser vivo: A ≈ A₀ (se renueva)' : 'edad = ' + Math.round(t).toLocaleString('es') + ' años  ·  t½ ≈ ' + Math.round(T12).toLocaleString('es') + ' años', 585, 372, { s: 13, c: AM });
          txt(c, S.drak ? 't = (1/λ)·ln(13,6/12,0) ≈ 1,03·10³ años' : 't = (1/λ)·ln(A₀/A)', 585, 394, { s: 12, c: T2 });
        },
      });
    },
    test: [
      { pregunta: '¿Por qué en un ser vivo la proporción ¹⁴C/¹²C es constante?', opciones: ['Porque renueva su carbono y el ¹⁴C que decae se reemplaza', 'Porque el ¹⁴C no es radiactivo', 'Porque no hay ¹²C'], correcta: 0, explicacion: 'Al morir ya no se renueva y la proporción baja (p. 134).' },
      { pregunta: 'Si un resto tiene A = A₀/2, su edad es…', opciones: ['un t½ del ¹⁴C (≈ 5,7·10³ años)', '2 t½', 'cero'], correcta: 0, explicacion: 'La actividad se divide por 2 en cada t½.' },
      { pregunta: 'Para fechar con ¹⁴C hay que conocer…', opciones: ['A₀ (o N₀) y medir A(t) (o N(t))', 'solo la masa de la muestra', 'solo la temperatura'], correcta: 0, explicacion: 'La ley de decaimiento permite fechar si se conoce A₀ y se mide A(t) (p. 138).' },
    ],
  });

  // @@FIN@@
})();
