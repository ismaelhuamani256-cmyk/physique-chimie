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
      '.cpt-a-ctl button:hover{border-color:#2ee59d}.cpt-a-ctl button.on{border-color:#2ee59d;background:#143a2e}';
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
    function fit() { const r = host.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(2, (r.width * dpr) | 0); cv.height = Math.max(2, (r.height * dpr) | 0); sc = cv.width / W; }
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
          circ(c, hx, hy, 17, '#ffffff22', AM, 2.5); txt(c, 'H' + (p > 0.02 && p < 0.98 ? '⁺' : ''), hx, hy, { s: 15, b: 1, c: AM });
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
          txt(c, 'ν̃ (cm⁻¹)', 760, y1 + 14, { s: 11, c: T2, a: 'right' });
          if (n >= 4) { c.fillStyle = '#ff3da622'; c.fillRect(nuX(1300), y0 - 2, 760 - nuX(1300), y1 - y0 + 2); txt(c, 'zone des empreintes digitales', (nuX(1300) + 760) / 2, y0 + 8, { s: 12, c: MG, b: 1 }); }
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
            const bx = 90, by = 300, bw = 520, mx = (35 + 7.6) * 1e-3 * 20;
            txt(c, 'σ = Σ λᵢ·[Xᵢ]', 50, by - 14, { s: 13, c: T2, a: 'left', b: 1 });
            let x = bx; parts.forEach(([nm, v]) => { const w = (v / mx) * bw; rr(c, x, by, Math.max(2, w), 30, 4); c.fillStyle = COL[nm]; c.fill(); if (w > 70) txt(c, nm + ' ' + v.toFixed(3).replace('.', ','), x + w / 2, by + 15, { s: 12, b: 1, c: '#0a0f20' }); x += w; });
            txt(c, 'σ = ' + tot.toFixed(3).replace('.', ',') + ' S·m⁻¹', 630, by + 15, { s: 16, b: 1, c: AM, a: 'left' });
            const f = (nm, v) => String(L[nm]).replace('.', ',') + '·10⁻³ × ' + cc.toFixed(1).replace('.', ',') ; txt(c, parts.map(([nm]) => 'λ(' + nm + ')·[' + nm + ']').join(' + ') + '   ([X] = ' + cc.toFixed(1).replace('.', ',') + ' mol·m⁻³)', 90, by + 48, { s: 12, c: T2, a: 'left' });
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
          if (n >= 2) { lin(c, gx(0), gy(0), gx(5.4), gy(K * 5.4e-4), VE, 2); txt(c, 'A = k·c', gx(5.4) - 4, gy(K * 5.4e-4) - 12, { s: 13, c: VE, b: 1, a: 'right' }); }
          CS.forEach((cc, i) => { if (i < Math.floor(S.med + 0.001)) { circ(c, gx(cc), gy(K * cc * 1e-4), 5, MG, null); } });
          if (n >= 2) txt(c, 'dominio de validez: c < 10⁻² mol·L⁻¹', 600, 70, { s: 12, c: AM });
          if (n >= 3) {
            const fuera = A > 1.35, ya = gy(Math.min(A, 1.35)), xs = gx(cm);
            if (!fuera) { lin(c, gx(0), ya, xs, ya, MG, 1.5, [5, 4]); flecha(c, xs, ya, xs, gy(0) - 2, MG, 1.5); circ(c, xs, ya, 6, MG, '#fff', 1.5);
              txt(c, 'c_déduite = ' + cm.toFixed(1).replace('.', ',') + '·10⁻⁴', xs, gy(0) - 14, { s: 12, c: MG, b: 1, a: xs > 700 ? 'right' : 'center' });
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

  // @@FIN@@
})();
