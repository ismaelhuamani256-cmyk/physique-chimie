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

  // @@FIN@@
})();
