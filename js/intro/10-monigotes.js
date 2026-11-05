// =====================================================================================
// 10-monigotes.js — estilo de intro "monigotes": figuras de palitos con TRAZO A MANO
// (líneas temblorosas con jitter determinista, grosor variable, relleno de rotulador
// ligeramente desplazado) sobre papel de cuaderno cuadriculado con margen rojo.
//
// Dibuja los 24 tipos de actor del CONTRATO §5 + bocadillos, vectores, trayectorias,
// partículas, reacciones, resaltado y cámara. Recibe el estado S del motor (00-engine.js).
// Convenciones de anclaje (pos del actor):
//   · pies/ruedas/base: auto, perro, humano, bloque, tubo_ensayo, vaso, termometro
//   · pivote (arriba): pendulo · extremo izquierdo (pared): resorte · centro: el resto
// Las unidades locales de dibujo son "alturas de escena" (1 = alto del lienzo × escala).
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB;
  const K = PCB.intro.kit;
  const TAU = Math.PI * 2;
  const FUENTE = '"Segoe Print","Bradley Hand","Chalkboard SE","Comic Sans MS","Marker Felt","Comic Neue",UI,system-ui,sans-serif';
  const TINTA = '#262b36';
  const DEFECTO = {
    auto: '#e63946', perro: '#c98a4b', humano: '#3a86ff', cohete: '#f4f6fb', planeta: '#3d8bd9', luna: '#e9e5d0', tubo_ensayo: '#5ad1a0',
    vaso: '#4cc9f0', bola: '#ff7b00', molecula: '#9aa3b2', atomo: '#9aa3b2', ion: '#ff7b00', electron: '#2f6bff', circuito: '#f4a300',
    pendulo: '#8e44ad', resorte: '#16a05a', onda: '#2f6bff', lente: '#7cc4ff', rayo: '#f5a300', flecha: '#1d70e6', bloque: '#c8913f',
    fluido: '#4aa8e8', termometro: '#e63946', texto: TINTA,
  };
  const SUELO = ['auto', 'perro', 'humano', 'bloque', 'tubo_ensayo', 'vaso', 'termometro'];

  PCB.intro.registerStyle('monigotes', {
    nombre: 'Monigotes (cuaderno)',
    init(ic) {
      const L = K.lienzo(ic.host, ic.dpr);
      const c = L.ctx;
      let W = ic.w, H = ic.h, dpr = ic.dpr || 1;
      L.resize(W, H, dpr);
      let bg = null, bgW = 0, bgH = 0;
      let S = null;                           // estado de escena del frame actual
      const humo = [];                        // bocanadas de humo (estado propio del estilo)
      const rumbo = {};                       // orientación suavizada de cohetes
      let ultimoReloj = 0, sueloY = null;
      const pen = { s: 1, sd: 1, fr: 0, lw: 4, alpha: 1, red: false };

      // ---------------------------------------------------------------------------
      // Fondo: cuaderno cuadriculado con margen rojo (se cachea en un canvas 1.6×)
      // ---------------------------------------------------------------------------
      function hacerFondo() {
        bgW = Math.round(W * 1.6); bgH = Math.round(H * 1.6);
        bg = document.createElement('canvas'); bg.width = Math.round(bgW * dpr); bg.height = Math.round(bgH * dpr);
        const g = bg.getContext('2d'); g.scale(dpr, dpr);
        g.fillStyle = '#fcfaf1'; g.fillRect(0, 0, bgW, bgH);
        const paso = H / 22, ox = W * 0.3, oy = H * 0.3;
        g.lineWidth = 1;
        for (let x = ox % paso; x < bgW; x += paso) { g.strokeStyle = (Math.round((x - ox) / paso) % 5 === 0) ? 'rgba(120,165,215,.42)' : 'rgba(140,180,225,.30)'; g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, bgH); g.stroke(); }
        for (let y = oy % paso; y < bgH; y += paso) { g.strokeStyle = (Math.round((y - oy) / paso) % 5 === 0) ? 'rgba(120,165,215,.42)' : 'rgba(140,180,225,.30)'; g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(bgW, y + 0.5); g.stroke(); }
        // margen rojo (doble)
        g.strokeStyle = 'rgba(226,90,102,.75)'; g.lineWidth = 2;
        const mx = ox + W * 0.07; g.beginPath(); g.moveTo(mx, 0); g.lineTo(mx, bgH); g.stroke();
        g.lineWidth = 1; g.beginPath(); g.moveTo(mx + 5, 0); g.lineTo(mx + 5, bgH); g.stroke();
        // viñeta de papel
        const gr = g.createRadialGradient(bgW / 2, bgH / 2, Math.min(W, H) * 0.5, bgW / 2, bgH / 2, Math.max(bgW, bgH) * 0.62);
        gr.addColorStop(0, 'rgba(180,150,90,0)'); gr.addColorStop(1, 'rgba(160,130,70,.14)');
        g.fillStyle = gr; g.fillRect(0, 0, bgW, bgH);
      }

      // ---------------------------------------------------------------------------
      // Primitivas de trazo a mano (coordenadas locales: escaladas por pen.s px/unidad)
      // ---------------------------------------------------------------------------
      /** polilínea temblorosa; o:{c color, w ancho px, close, fill, amp px, dbl, seed} */
      function trazo(pts, o) {
        o = o || {};
        const n = pts.length; if (n < 2) return;
        const s = pen.s, amp = ((o.amp != null ? o.amp : 1.25) * (S && S.reducido ? 0.5 : 1)) / s, lw = (o.w || pen.lw) / s, seg = 15 / s;
        const dense = [], lim = o.close ? n : n - 1;
        for (let i = 0; i < lim; i++) {
          const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1];
          const k = Math.max(1, Math.ceil(Math.hypot(dx, dy) / seg));
          for (let j = 0; j < k; j++) { const u = j / k; dense.push([a[0] + dx * u, a[1] + dy * u]); }
        }
        const ult = o.close ? pts[0] : pts[n - 1]; dense.push([ult[0], ult[1]]);
        const sd = pen.sd + (o.seed || 0), fr = pen.fr * 13, m = dense.length, P = new Array(m);
        for (let i = 0; i < m; i++) {
          const f = o.close && i === m - 1 ? 1.7 : 1;
          P[i] = [dense[i][0] + K.noise(i * 0.55, sd + fr) * amp * f, dense[i][1] + K.noise(i * 0.55 + 31.7, sd + fr + 5) * amp * f];
        }
        if (o.fill) {
          c.beginPath(); c.moveTo(P[0][0] + 0.9 / s, P[0][1] + 1.2 / s);
          for (let i = 1; i < m; i++) c.lineTo(P[i][0] + 0.9 / s, P[i][1] + 1.2 / s);
          c.closePath(); c.fillStyle = o.fill; c.fill();
        }
        if (o.nostroke) return;
        c.strokeStyle = o.c || pen.ink; c.lineCap = 'round'; c.lineJoin = 'round';
        for (let i = 0; i < m - 1; i++) {
          c.lineWidth = lw * (0.8 + 0.4 * (K.noise(i * 0.3, sd + 99) * 0.5 + 0.5));
          c.beginPath(); c.moveTo(P[i][0], P[i][1]); c.lineTo(P[i + 1][0], P[i + 1][1]); c.stroke();
        }
        const dbl = o.dbl != null ? o.dbl : (o.close || m > 6) && !o.fino;
        if (dbl) { // segundo trazo más fino y desfasado: efecto "repasado con bolígrafo"
          const a0 = c.globalAlpha; c.globalAlpha = a0 * 0.4; c.lineWidth = lw * 0.5; c.beginPath();
          for (let i = 0; i < m; i++) {
            const x = dense[i][0] + K.noise(i * 0.5, sd + 57 + fr) * amp * 1.4, y = dense[i][1] + K.noise(i * 0.5 + 9, sd + 58 + fr) * amp * 1.4;
            if (i) c.lineTo(x, y); else c.moveTo(x, y);
          }
          c.stroke(); c.globalAlpha = a0;
        }
      }
      const linea = (x1, y1, x2, y2, o) => trazo([[x1, y1], [x2, y2]], Object.assign({ dbl: false }, o));
      /** círculo a mano con ligero sobretrazo; o.fill rellena (desplazado como un rotulador) */
      function circulo(cx, cy, r, o) {
        o = o || {};
        const s = pen.s, N = K.clamp(Math.round((r * s) / 3.4), 9, 38), a0 = K.hrand(pen.sd + ((cx * 977) | 0) + ((cy * 331) | 0)) * TAU;
        if (o.fill) { c.beginPath(); c.arc(cx + 0.9 / s, cy + 1.2 / s, r * 0.985, 0, TAU); c.fillStyle = o.fill; c.fill(); }
        const tot = N + Math.max(1, Math.round(N * 0.1)), pts = [];
        for (let k = 0; k <= tot; k++) { const an = a0 + (k / N) * TAU, rr = r * (1 + 0.03 * K.noise(k * 0.8, pen.sd + 3)); pts.push([cx + Math.cos(an) * rr, cy + Math.sin(an) * rr]); }
        if (!o.nostroke) trazo(pts, Object.assign({}, o, { fill: null, close: false, dbl: r * s > 14 }));
      }
      function elipse(cx, cy, rx, ry, rot, o) {
        const N = K.clamp(Math.round((Math.max(rx, ry) * pen.s) / 3.4), 10, 40), pts = [], cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
        for (let k = 0; k <= N; k++) { const an = (k / N) * TAU, x = Math.cos(an) * rx, y = Math.sin(an) * ry; pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]); }
        trazo(pts, Object.assign({}, o, { close: true }));
      }
      const rect = (x, y, w, h, o) => trazo([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], Object.assign({ close: true }, o));
      /** puntos de un arco */
      function arcoPts(cx, cy, r, a0, a1, n) { const p = []; n = n || 12; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; }
      const fillC = (col, amt, a) => K.shade(col, amt == null ? 0.12 : amt, a == null ? 0.95 : a);
      /** relleno liso (sin trazo) de un polígono, con el mismo desplazamiento de rotulador */
      function rellena(pts, col) { trazo(pts, { close: true, fill: col, nostroke: true }); }

      /** texto en pantalla a partir de coordenadas locales (el texto no se escala con la transformación) */
      function etiqueta(str, lx, ly, px, col, o) {
        o = o || {};
        const m = c.getTransform(), x = m.a * lx + m.c * ly + m.e, y = m.b * lx + m.d * ly + m.f;
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
        c.font = (o.peso || '700') + ' ' + Math.max(8, px * dpr) + 'px ' + FUENTE;
        c.textAlign = o.align || 'center'; c.textBaseline = o.base || 'middle';
        if (o.halo) { c.lineWidth = 4 * dpr; c.strokeStyle = o.halo; c.lineJoin = 'round'; c.strokeText(str, x, y); }
        c.fillStyle = col || TINTA; c.fillText(str, x, y); c.restore();
      }

      // ---------------------------------------------------------------------------
      // Dibujo de cada tipo de actor (origen = punto de anclaje; y negativa = arriba)
      // ---------------------------------------------------------------------------
      const D = {};
      const ang2 = (a) => [Math.sin(a), Math.cos(a)];

      D.auto = (a, col) => {
        const sp = Math.abs(a.vx) * S.aspecto, ruedaR = 0.032;
        // líneas de velocidad detrás del coche
        if (sp > 0.06) {
          const largo = K.clamp(sp * 0.4, 0.03, 0.1);
          [-0.13, -0.095, -0.06].forEach((y, i) => linea(-0.17 - largo * 0.2 - i * 0.012, y, -0.17 - largo - i * 0.012, y, { w: 2.2, c: 'rgba(80,90,110,.55)', amp: 0.6 }));
        }
        const cuerpo = [[-0.155, -0.04], [-0.155, -0.088], [-0.105, -0.097], [-0.068, -0.142], [0.045, -0.142], [0.09, -0.098], [0.155, -0.088], [0.155, -0.04]];
        trazo(cuerpo, { close: true, fill: fillC(col, 0.05), seed: 1 });
        const vent = 'rgba(190,230,255,.92)';
        trazo([[-0.055, -0.098], [-0.038, -0.132], [-0.003, -0.132], [-0.003, -0.098]], { close: true, fill: vent, w: 2.6, seed: 2 });
        trazo([[0.012, -0.098], [0.012, -0.132], [0.043, -0.132], [0.074, -0.098]], { close: true, fill: vent, w: 2.6, seed: 3 });
        linea(0.004, -0.092, 0.004, -0.048, { w: 2.2 });
        linea(0.02, -0.075, 0.034, -0.075, { w: 2.4 }); // tirador
        circulo(0.143, -0.072, 0.011, { fill: '#ffe27a', w: 2.4 });
        // piloto de freno
        if (a.frenando) { circulo(-0.147, -0.07, 0.016, { fill: 'rgba(255,60,60,.35)', nostroke: true }); }
        circulo(-0.147, -0.07, 0.009, { fill: a.frenando ? '#ff2d2d' : '#b04040', w: 2.2 });
        // ruedas (giran según el desplazamiento horizontal)
        const giro = a.x * S.aspecto * a.dir / (ruedaR * a.escala);
        [-0.09, 0.09].forEach((wx, i) => {
          c.save(); c.translate(wx, -0.03); c.rotate(giro);
          circulo(0, 0, ruedaR, { fill: '#3b3f4a', w: 3, seed: 5 + i });
          circulo(0, 0, 0.015, { fill: '#cfd5e0', w: 2, seed: 8 + i });
          for (let k = 0; k < 4; k++) { const an = (k / 4) * TAU; linea(Math.cos(an) * 0.004, Math.sin(an) * 0.004, Math.cos(an) * 0.014, Math.sin(an) * 0.014, { w: 1.8, amp: 0.3 }); }
          c.restore();
        });
      };

      D.perro = (a, col) => {
        const sp = Math.hypot(a.vx * S.aspecto, a.vy), w = K.smooth(sp / 0.04);
        const fase = (a.x * S.aspecto / 0.12) * TAU, balanceo = a.frenando ? 0 : w;
        const sube = Math.abs(Math.sin(fase)) * 0.012 * w;
        const clar = fillC(col, 0.18), osc = fillC(col, -0.25);
        // patas traseras y delanteras (detrás del cuerpo / delante)
        const pata = (x, off, delante) => {
          let an = Math.sin(fase + off) * 0.75 * balanceo;
          if (a.frenando && sp > 0.01) an = delante ? -0.7 : -0.45; // patas estiradas hacia delante al frenar
          const [sx, cy] = ang2(an), top = -0.058 - sube;
          linea(x, top, x + sx * 0.058, top + cy * 0.058 + sube, { w: 4.4, c: osc, amp: 0.7 });
          circulo(x + sx * 0.058 + 0.004, top + cy * 0.058 + sube, 0.007, { fill: osc, w: 2, nostroke: true });
        };
        pata(-0.05, 0, false); pata(0.05, Math.PI, true);
        // cola: se menea
        const meneo = Math.sin(S.reloj * (sp > 0.03 ? 14 : 9)) * 0.55;
        const colaA = -2.35 + meneo;
        trazo([[-0.066, -0.098 - sube], [-0.066 + Math.cos(colaA) * 0.03, -0.098 - sube + Math.sin(colaA) * 0.03], [-0.066 + Math.cos(colaA + 0.5) * 0.055, -0.098 - sube + Math.sin(colaA + 0.5) * 0.055]], { w: 4.4, c: osc, dbl: false });
        // cuerpo
        trazo([[-0.07, -0.09 - sube], [-0.045, -0.11 - sube], [0.04, -0.112 - sube], [0.072, -0.095 - sube], [0.07, -0.068 - sube], [0.04, -0.054 - sube], [-0.04, -0.054 - sube], [-0.07, -0.066 - sube]], { close: true, fill: clar, seed: 11 });
        pata(-0.028, Math.PI, false); pata(0.028, 0, true);
        // cabeza
        const hy = -0.128 - sube;
        trazo([[0.1, hy + 0.012], [0.128, hy + 0.003], [0.136, hy + 0.016], [0.124, hy + 0.03], [0.1, hy + 0.03]], { close: true, fill: fillC(col, 0.35), seed: 13 }); // hocico
        circulo(0.082, hy, 0.03, { fill: clar, seed: 14 });
        circulo(0.135, hy + 0.007, 0.007, { fill: TINTA, w: 1.5, nostroke: true });
        circulo(0.093, hy - 0.006, 0.0055, { fill: TINTA, w: 1.5, nostroke: true });
        // oreja caída
        const bote = Math.sin(fase * 2) * 0.006 * w;
        trazo([[0.07, hy - 0.022], [0.052, hy + 0.008 + bote], [0.07, hy + 0.024 + bote], [0.082, hy - 0.004]], { close: true, fill: osc, seed: 15 });
        // lengua cuando está quieto
        if (sp < 0.02) trazo([[0.12, hy + 0.03], [0.124, hy + 0.046 + Math.sin(S.reloj * 6) * 0.004], [0.13, hy + 0.03]], { close: true, fill: '#ff6b81', w: 1.8, fino: true });
      };

      D.humano = (a, col) => {
        const sp = Math.hypot(a.vx * S.aspecto, a.vy), w = K.smooth(sp / 0.03);
        const fase = (a.x * S.aspecto / 0.09) * TAU, resp = Math.sin(S.reloj * 2.2) * 0.002;
        const bote = Math.abs(Math.sin(fase)) * 0.006 * w;
        const cadera = [0, -0.125 - bote], hombro = [0, -0.2 - bote + resp];
        // piernas
        [0, 1].forEach((i) => {
          const an = Math.sin(fase + i * Math.PI) * 0.6 * w + (i ? 0.06 : -0.06) * (1 - w);
          const [sx, cy] = ang2(an), rodilla = [cadera[0] + sx * 0.06, cadera[1] + cy * 0.06], pie = [cadera[0] + sx * 0.06 + Math.sin(an * 0.3) * 0.03, 0 - (i && w > 0.1 ? Math.max(0, Math.sin(fase + Math.PI)) * 0.02 : 0)];
          trazo([cadera, rodilla, pie, [pie[0] + 0.03, pie[1]]], { w: 4.6, dbl: false });
        });
        // torso (camiseta) y cuello
        trazo([[-0.026, hombro[1]], [0.026, hombro[1]], [0.032, cadera[1]], [-0.032, cadera[1]]], { close: true, fill: fillC(col, 0.05), seed: 21 });
        linea(0, hombro[1] - 0.004, 0, hombro[1] - 0.03, { w: 4 });
        // brazos
        const hablando = !!a.hablando;
        [0, 1].forEach((i) => {
          let an = Math.sin(fase + (i ? 0 : Math.PI)) * 0.65 * w + (i ? 0.18 : -0.18);
          let flex = 0.3;
          if (i === 1 && hablando) { an = 2.3 + Math.sin(S.reloj * 6) * 0.45; flex = -0.5; }  // gesticula
          if (a.resaltado > 0.2 && i === 0) { an = -2.6; flex = 0.2; }
          const [sx, cy] = ang2(an), codo = [hombro[0] + sx * 0.052, hombro[1] + cy * 0.052], [sx2, cy2] = ang2(an + flex), mano = [codo[0] + sx2 * 0.05, codo[1] + cy2 * 0.05];
          trazo([hombro, codo, mano], { w: 4.2, dbl: false });
          circulo(mano[0], mano[1], 0.007, { fill: '#f6cfa4', w: 1.8, nostroke: true });
        });
        // cabeza
        const cy0 = -0.235 - bote + resp;
        circulo(0, cy0, 0.033, { fill: '#fde7c8', seed: 22 });
        // pelo
        for (let k = 0; k < 5; k++) { const an = -Math.PI + 0.35 + k * 0.6; linea(Math.cos(an) * 0.03, cy0 + Math.sin(an) * 0.03, Math.cos(an) * 0.043, cy0 + Math.sin(an) * 0.044, { w: 3, amp: 0.5, c: '#5a3b24' }); }
        circulo(0.012, cy0 - 0.004, 0.0045, { fill: TINTA, nostroke: true }); circulo(-0.009, cy0 - 0.004, 0.0045, { fill: TINTA, nostroke: true });
        if (hablando) { const ab = 0.004 + Math.abs(Math.sin(S.reloj * 13)) * 0.007; elipse(0.002, cy0 + 0.014, 0.008, ab, 0, { fill: '#8a2a35', w: 1.8, fino: true }); }
        else trazo(arcoPts(0.002, cy0 + 0.006, 0.012, 0.3, Math.PI - 0.3, 6), { w: 2, dbl: false });
      };

      D.cohete = (a, col) => {
        const sp = Math.hypot(a.vx * S.aspecto, a.vy);
        const encendido = a.def.encendido !== false && (sp > 0.012 || a.def.encendido === true);
        // llama
        if (encendido || a.def.encendido !== false) {
          const f = (encendido ? 1 : 0.45) * (0.8 + 0.2 * Math.sin(S.reloj * 31) + 0.1 * Math.sin(S.reloj * 17)), Lf = (0.06 + K.clamp(sp * 0.3, 0, 0.07)) * f;
          const z = [[-0.022, 0.05], [-0.012, 0.05 + Lf * 0.7], [0, 0.05 + Lf * 0.5], [0.006, 0.05 + Lf], [0.014, 0.05 + Lf * 0.6], [0.022, 0.05]];
          trazo(z, { close: true, fill: 'rgba(255,150,30,.95)', w: 3, c: '#e8590c', seed: 31 });
          trazo([[-0.01, 0.05], [0, 0.05 + Lf * 0.55], [0.01, 0.05]], { close: true, fill: 'rgba(255,230,90,.95)', nostroke: true });
        }
        // aletas
        trazo([[-0.03, 0.0], [-0.066, 0.075], [-0.03, 0.05]], { close: true, fill: '#e63946', seed: 32 });
        trazo([[0.03, 0.0], [0.066, 0.075], [0.03, 0.05]], { close: true, fill: '#e63946', seed: 33 });
        // cuerpo
        trazo([[0, -0.125], [0.028, -0.085], [0.034, 0.05], [-0.034, 0.05], [-0.028, -0.085]], { close: true, fill: fillC(col, 0.05), seed: 34 });
        trazo([[0, -0.125], [0.028, -0.085], [-0.028, -0.085]], { close: true, fill: '#e63946', seed: 35 });
        circulo(0, -0.03, 0.016, { fill: 'rgba(160,215,255,.95)', seed: 36 });
        linea(-0.032, 0.025, 0.032, 0.025, { w: 2.4 });
      };

      D.planeta = (a, col) => {
        const R = 0.078;
        c.save();
        c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = fillC(col, 0.05); c.fill(); c.clip();
        // continentes que se desplazan (rotación)
        const off = ((S.reloj * 0.012 * (S.reducido ? 0.3 : 1)) % (R * 2));
        for (let rep = -1; rep <= 1; rep++) {
          const bx = rep * R * 2 - off;
          const cont = fillC(col, -0.28, 0.9);
          trazo([[bx - 0.05, -0.03], [bx - 0.02, -0.055], [bx + 0.02, -0.04], [bx + 0.03, -0.01], [bx, 0.01], [bx - 0.04, 0.0]], { close: true, fill: cont, nostroke: true });
          trazo([[bx + 0.02, 0.035], [bx + 0.06, 0.025], [bx + 0.07, 0.055], [bx + 0.03, 0.06]], { close: true, fill: cont, nostroke: true });
        }
        // sombra
        c.beginPath(); c.arc(0.03, 0.03, R * 1.05, 0, TAU); c.arc(0, 0, R, 0, TAU, true); c.fillStyle = 'rgba(15,25,60,.2)'; c.fill('evenodd');
        c.restore();
        circulo(0, 0, R, { seed: 41, w: 4 });
        if (a.def.anillos) { c.save(); c.rotate(-0.35); elipse(0, 0, R * 1.7, R * 0.4, 0, { w: 3, c: '#c9923b', seed: 42 }); c.restore(); }
      };

      D.luna = (a, col) => {
        const R = 0.042;
        circulo(0, 0, R, { fill: fillC(col, 0.0), seed: 51 });
        c.save(); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.clip();
        c.beginPath(); c.arc(-0.012, -0.006, R * 1.08, 0, TAU); c.arc(0, 0, R, 0, TAU, true); c.fillStyle = 'rgba(70,70,90,.18)'; c.fill('evenodd'); c.restore();
        circulo(-0.012, -0.01, 0.008, { w: 2, seed: 52 }); circulo(0.014, 0.012, 0.0055, { w: 2, seed: 53 }); circulo(0.006, -0.022, 0.004, { w: 1.8, seed: 54 });
      };

      /** recipiente de líquido: tubo de ensayo o vaso; mismo código para ambos */
      function recipiente(a, col, kind) {
        const tubo = kind === 'tubo';
        const hw = tubo ? 0.027 : 0.05, hwB = tubo ? 0.027 : 0.045, Ht = tubo ? 0.22 : 0.13, rB = tubo ? 0.027 : 0;
        const liq = a.def.liquido || col, nivel = K.clamp(K.num(a.def.nivel, tubo ? 0.55 : 0.6), 0.05, 0.95);
        const yb = tubo ? -rB : 0, ytop = yb - nivel * (Ht - (tubo ? rB : 0)), oscila = S.reducido ? 0 : 1;
        // líquido
        const sup = [];
        for (let i = 0; i <= 10; i++) { const x = K.lerp(-hw, hw, i / 10) * (kind === 'vaso' ? K.lerp(1, hwB / hw, (ytop / -Ht)) : 1); sup.push([x, ytop + Math.sin(i * 0.9 + S.reloj * 3) * 0.0022 * oscila]); }
        const fondo = tubo ? arcoPts(0, -rB, rB, 0, Math.PI, 10).map((p) => p) : [[hwB, 0], [-hwB, 0]];
        const poly = sup.concat(tubo ? fondo : fondo);
        rellena(poly, K.shade(liq, 0.05, 0.78));
        // burbujas dentro
        if (a.def.burbujas || S.particulas.some((p) => p.tipo === 'burbujas')) {
          for (let i = 0; i < 4; i++) {
            const u = ((S.reloj * 0.35 + i * 0.27) % 1), by = yb - u * (yb - ytop) * 0.95, bx = Math.sin(i * 2.3 + S.reloj * 2) * hw * 0.55;
            circulo(bx, by, 0.004 + i * 0.0012, { w: 1.5, c: 'rgba(255,255,255,.9)', fino: true, amp: 0.3 });
          }
        }
        // vidrio
        if (tubo) {
          const g = [[-hw, -Ht]].concat([[-hw, -rB]]).concat(arcoPts(0, -rB, rB, Math.PI, 0, 10).map((p) => p)).concat([[hw, -Ht]]);
          trazo(g, { w: 3.6, seed: 61 });
          linea(-hw - 0.007, -Ht, hw + 0.007, -Ht, { w: 3.4, seed: 62 });
          for (let k = 1; k <= 4; k++) linea(hw - 0.001, -rB - k * 0.036, hw - 0.011, -rB - k * 0.036, { w: 1.8, amp: 0.3 });
          linea(-hw + 0.007, -Ht + 0.03, -hw + 0.007, -rB - 0.03, { w: 2.2, c: 'rgba(255,255,255,.85)', amp: 0.3, dbl: false });
        } else {
          trazo([[-hw, -Ht], [-hwB, 0], [hwB, 0], [hw, -Ht]], { w: 3.6, seed: 63 });
          linea(-hw - 0.01, -Ht - 0.005, -hw + 0.004, -Ht, { w: 3.2, amp: 0.3 });
          for (let k = 1; k <= 4; k++) { const y = -k * 0.025, x = K.lerp(hwB, hw, (-y) / Ht); linea(x - 0.016, y, x, y, { w: 1.8, amp: 0.3 }); }
          linea(-hw + 0.011, -Ht + 0.02, -hwB + 0.009, -0.02, { w: 2.4, c: 'rgba(255,255,255,.85)', amp: 0.3, dbl: false });
        }
      }
      D.tubo_ensayo = (a, col) => recipiente(a, col, 'tubo');
      D.vaso = (a, col) => recipiente(a, col, 'vaso');

      D.bola = (a, col) => {
        const R = 0.036, giro = a.x * S.aspecto / (R * a.escala);
        circulo(0, 0, R, { fill: fillC(col, 0.02), seed: 71 });
        c.save(); c.rotate(giro);
        trazo(arcoPts(0, 0, R * 0.98, -0.7, 0.7, 6), { w: 2.4, dbl: false, amp: 0.6 });
        trazo(arcoPts(0, 0, R * 0.98, Math.PI - 0.7, Math.PI + 0.7, 6), { w: 2.4, dbl: false, amp: 0.6 });
        linea(-R, 0, R, 0, { w: 2, amp: 0.5, dbl: false });
        c.restore();
        circulo(-R * 0.35, -R * 0.4, R * 0.18, { fill: 'rgba(255,255,255,.7)', nostroke: true });
      };

      function dibujaAtomoBola(el, x, y, r, ox, oy) {
        const e = K.elem(el);
        circulo(x + (ox || 0), y + (oy || 0), r, { fill: fillC(e.c, 0, 0.97), w: 2.8, seed: K.hash(el) % 50 });
        const oscuro = el === 'H' || el === 'He' || el === 'Ne' || el === 'F' || el === 'Cl' || el === 'S' || el === 'Ar' || el === 'Be' || el === 'Mg' || el === 'Ca' ? TINTA : '#fff';
        etiqueta(el, x + (ox || 0), y + (oy || 0), Math.max(10, r * pen.s * 1.05), oscuro, { peso: '700' });
      }
      function dibujaMolecula(def, esc) {
        const lay = K.layoutMolecula(def), vib = S.reducido ? 0 : 0.0025;
        const off = lay.atomos.map((p, i) => [Math.sin(S.reloj * 9 + i * 2.1) * vib, Math.cos(S.reloj * 8 + i * 1.7) * vib]);
        lay.enlaces.forEach((b) => {
          const A = lay.atomos[b[0]], B = lay.atomos[b[1]], oa = off[b[0]], ob = off[b[1]];
          const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, n = b[2] || 1;
          for (let k = 0; k < n; k++) { const d = (k - (n - 1) / 2) * 0.009; linea(A.x + oa[0] + nx * d, A.y + oa[1] + ny * d, B.x + ob[0] + nx * d, B.y + ob[1] + ny * d, { w: 4, amp: 0.6, c: '#4a4f58' }); }
        });
        lay.atomos.forEach((p, i) => dibujaAtomoBola(p.el, p.x, p.y, p.r, off[i][0], off[i][1]));
      }
      D.molecula = (a) => dibujaMolecula(a.def);

      D.atomo = (a, col) => {
        const sym = String(a.def.elemento || a.def.simbolo || 'C'), Z = K.num(a.def.Z, K.elem(sym).Z || 6), capas = K.capas(Z);
        capas.forEach((n, k) => {
          const R = 0.045 + k * 0.026;
          circulo(0, 0, R, { w: 1.8, c: 'rgba(60,70,100,.45)', fino: true, amp: 0.5 });
          const vel = (0.9 - k * 0.15) * (S.reducido ? 0.5 : 1);
          for (let e = 0; e < n; e++) {
            const an = S.reloj * vel + (e / n) * TAU + k;
            circulo(Math.cos(an) * R, Math.sin(an) * R, 0.0085, { fill: '#2f6bff', w: 1.8, nostroke: false, fino: true });
          }
        });
        circulo(0, 0, 0.026, { fill: fillC(a.color || '#e76f51', 0.05), w: 3, seed: 81 });
        etiqueta(sym, 0, 0, Math.max(11, 0.026 * pen.s * 1.1), '#fff', { peso: '700' });
      };

      D.ion = (a, col) => {
        const sym = String(a.def.elemento || a.def.simbolo || 'Na').replace(/[+\-−⁺⁻\d]/g, '') || 'Na';
        let carga = a.def.carga != null ? a.def.carga : /[+⁺]/.test(String(a.def.simbolo || '')) ? 1 : /[-−⁻]/.test(String(a.def.simbolo || '')) ? -1 : 1;
        if (typeof carga === 'string') { const m = /(\d*)\s*([+\-−⁺⁻])/.exec(carga); carga = m ? (m[1] ? +m[1] : 1) * (/[+⁺]/.test(m[2]) ? 1 : -1) : parseFloat(carga) || 1; }
        const pos = carga > 0, cc = a.color || (pos ? '#ff7b00' : '#3a86ff'), R = 0.034;
        circulo(0, 0, R * 1.35 + Math.sin(S.reloj * 3) * 0.002, { w: 1.8, c: pos ? 'rgba(255,123,0,.45)' : 'rgba(58,134,255,.45)', fino: true });
        circulo(0, 0, R, { fill: fillC(cc, 0.08), seed: 91 });
        etiqueta(sym, -0.004, 0.001, Math.max(11, R * pen.s * 0.9), '#fff', { peso: '700' });
        const txt = (Math.abs(carga) > 1 ? Math.abs(carga) : '') + (pos ? '+' : '−');
        etiqueta(txt, R * 0.78, -R * 0.82, Math.max(10, R * pen.s * 0.75), TINTA, { halo: '#fffbe9' });
      };

      D.electron = (a, col) => {
        const R = 0.0135, jit = S.reducido ? 0 : 0.0018;
        circulo(0, 0, R * 1.9, { fill: 'rgba(47,107,255,.15)', nostroke: true });
        circulo(Math.sin(S.reloj * 17) * jit, Math.cos(S.reloj * 13) * jit, R, { fill: fillC(col, 0.0), seed: 95, w: 2.4 });
        etiqueta('−', 0, -0.0005, Math.max(9, R * pen.s * 1.5), '#fff', { peso: '700' });
      };

      D.circuito = (a, col) => {
        const w = 0.16, h = 0.1;
        const cab = '#3a3f4a';
        // cables (con huecos para los componentes)
        trazo([[-w, -0.022], [-w, -h], [-0.04, -h]], { w: 3.6, c: cab }); trazo([[0.04, -h], [w, -h], [w, -0.04]], { w: 3.6, c: cab });
        trazo([[w, 0.04], [w, h], [-w, h], [-w, 0.022]], { w: 3.6, c: cab });
        // pila (izquierda)
        linea(-w - 0.028, -0.022, -w + 0.028, -0.022, { w: 4.6, amp: 0.4 }); linea(-w - 0.016, 0.022, -w + 0.016, 0.022, { w: 3, amp: 0.4 });
        etiqueta('+', -w + 0.045, -0.026, 11, TINTA); etiqueta('−', -w + 0.045, 0.026, 11, TINTA);
        // resistencia (arriba): zigzag
        const z = [[-0.04, -h]]; for (let i = 0; i < 6; i++) z.push([-0.04 + (i + 0.5) * (0.08 / 6), -h + (i % 2 ? 0.014 : -0.014)]); z.push([0.04, -h]);
        trazo(z, { w: 3.2, c: '#b5651d', dbl: false });
        etiqueta('R', 0, -h - 0.035, 13, TINTA);
        // bombilla (derecha)
        const on = 0.5 + 0.5 * Math.sin(S.reloj * 4);
        circulo(w, 0, 0.04, { fill: 'rgba(255,235,120,' + (0.55 + 0.25 * on) + ')', w: 3 });
        circulo(w, 0, 0.062, { fill: 'rgba(255,225,90,' + (0.1 + 0.1 * on) + ')', nostroke: true });
        linea(w - 0.022, -0.022, w + 0.022, 0.022, { w: 2.4, amp: 0.3 }); linea(w + 0.022, -0.022, w - 0.022, 0.022, { w: 2.4, amp: 0.3 });
        // cargas circulando (sentido horario)
        const camino = [[-w, -0.022], [-w, -h], [w, -h], [w, h], [-w, h], [-w, 0.022]], tl = []; let tot = 0;
        for (let i = 0; i < camino.length - 1; i++) { const l = Math.hypot(camino[i + 1][0] - camino[i][0], camino[i + 1][1] - camino[i][1]); tl.push(l); tot += l; }
        const N = S.reducido ? 8 : 16;
        for (let k = 0; k < N; k++) {
          let d = ((S.reloj * 0.07 + k / N) % 1) * tot, i = 0; while (i < tl.length - 1 && d > tl[i]) { d -= tl[i]; i++; }
          const u = d / tl[i];
          circulo(K.lerp(camino[i][0], camino[i + 1][0], u), K.lerp(camino[i][1], camino[i + 1][1], u), 0.0065, { fill: '#2f6bff', nostroke: true });
        }
        etiqueta('I', -0.06, -h - 0.002 + 0.0, 0, 'transparent');
      };

      D.pendulo = (a, col) => {
        const Lr = 0.27, amp = ((K.num(a.def.amplitud, 28)) * Math.PI) / 180, T = K.num(a.def.periodo, 2.2);
        const th = amp * Math.cos((TAU * S.reloj) / T), bx = Math.sin(th) * Lr, by = Math.cos(th) * Lr;
        linea(-0.06, 0, 0.06, 0, { w: 4 });
        for (let i = -3; i <= 3; i++) linea(i * 0.02, 0, i * 0.02 + 0.012, -0.014, { w: 2, amp: 0.3 });
        trazo(arcoPts(0, 0, Lr, Math.PI / 2 - amp, Math.PI / 2 + amp, 18), { w: 1.8, c: 'rgba(60,70,100,.4)', fino: true, dbl: false });
        linea(0, 0, bx, by, { w: 3 });
        circulo(bx, by, 0.03, { fill: fillC(col, 0.05), seed: 101 });
        circulo(0, 0, 0.005, { fill: TINTA, nostroke: true });
      };

      D.resorte = (a, col) => {
        const osc = a.def.oscila === false ? 0 : 1, Lr = 0.22 * (1 + 0.16 * Math.sin(S.reloj * 3) * osc * (S.reducido ? 0.4 : 1)), x0 = 0.012, x1 = x0 + Lr;
        linea(0, -0.045, 0, 0.045, { w: 4 }); for (let i = -3; i <= 3; i++) linea(0, i * 0.013, -0.014, i * 0.013 - 0.01, { w: 2, amp: 0.3 });
        const z = [[x0, 0]]; const N = 10;
        for (let i = 0; i < N; i++) z.push([x0 + 0.02 + (i + 0.5) * ((Lr - 0.04) / N), i % 2 ? 0.026 : -0.026]); z.push([x1, 0]);
        trazo(z, { w: 3.2, c: '#4a6b4a', dbl: false });
        rect(x1, -0.028, 0.05, 0.056, { fill: fillC(col, 0.05), seed: 111 });
        linea(-0.02, 0.03, x1 + 0.09, 0.03, { w: 2.4, c: 'rgba(60,70,100,.5)', dbl: false });
        if (a.def.texto) etiqueta(a.def.texto, x1 + 0.025, 0, 13, TINTA);
      };

      D.onda = (a, col) => {
        const Wd = 0.44 * 1, A = K.num(a.def.amplitud, 0.035), lam = K.num(a.def.longitud, 0.12), f = K.num(a.def.frecuencia, 0.55) * (S.reducido ? 0.5 : 1);
        const pts = [];
        for (let i = 0; i <= 60; i++) { const x = -Wd / 2 + (Wd * i) / 60, env = Math.sin(Math.PI * (i / 60)) ** 0.5; pts.push([x, Math.sin(TAU * (x / lam - S.reloj * f)) * A * env]); }
        linea(-Wd / 2, 0, Wd / 2, 0, { w: 1.6, c: 'rgba(60,70,100,.35)', dbl: false, amp: 0.3 });
        trazo(pts, { w: 4.4, c: fillC(col, -0.1, 1), dbl: false, amp: 0.8 });
        if (a.texto) etiqueta(a.texto, 0, -A - 0.035, 14, TINTA);
      };

      D.lente = (a, col) => {
        const Hh = 0.14, bul = 0.045, pts = [];
        for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push([Math.sin(Math.PI * u) * bul, -Hh + u * 2 * Hh]); }
        for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push([-Math.sin(Math.PI * u) * bul, Hh - u * 2 * Hh]); }
        trazo(pts, { close: true, fill: K.shade(col, 0.1, 0.4), w: 3.4, seed: 121 });
        const fo = K.num(a.def.f, 0.14);
        linea(-0.32, 0, 0.32, 0, { w: 1.8, c: 'rgba(60,70,100,.5)', dbl: false, amp: 0.3 });
        [-fo, fo].forEach((x, i) => { linea(x, -0.01, x, 0.01, { w: 2.4, amp: 0.2 }); etiqueta(i ? 'F′' : 'F', x, 0.03, 13, TINTA); });
      };

      D.rayo = (a, col) => {
        const Lr = K.num(a.def.largo, 0.26) * 0.5;
        linea(-Lr, 0, Lr, 0, { w: 9, c: K.shade(col, 0.4, 0.28), dbl: false, amp: 0.2 });
        linea(-Lr, 0, Lr - 0.012, 0, { w: 3.6, c: col, dbl: false, amp: 0.5 });
        for (let k = 0; k < 4; k++) { const x = -Lr + (((S.reloj * 0.25 * (S.reducido ? 0.3 : 1) + k / 4) % 1)) * 2 * Lr; circulo(x, 0, 0.006, { fill: '#fff6c8', nostroke: true }); }
        trazo([[Lr - 0.026, -0.016], [Lr, 0], [Lr - 0.026, 0.016]], { w: 3.6, c: col, dbl: false });
      };

      D.flecha = (a, col) => {
        const Lr = K.num(a.def.largo, 0.15) * 0.5;
        trazo([[-Lr, -0.009], [Lr - 0.03, -0.009], [Lr - 0.03, -0.026], [Lr, 0], [Lr - 0.03, 0.026], [Lr - 0.03, 0.009], [-Lr, 0.009]], { close: true, fill: fillC(col, 0.05), seed: 131 });
        if (a.texto) etiqueta(a.texto, 0, -0.04, 14, TINTA);
      };

      D.bloque = (a, col) => {
        const w = 0.11, h = 0.085;
        rect(-w / 2, -h, w, h, { fill: fillC(col, 0.02), seed: 141 });
        for (let k = 1; k <= 3; k++) linea(-w / 2 + 0.01, -h * (k / 4), w / 2 - 0.012 - k * 0.006, -h * (k / 4) + (k % 2 ? 0.003 : -0.003), { w: 1.6, c: 'rgba(90,50,10,.4)', amp: 0.6, dbl: false });
        etiqueta(a.texto || a.def.masa || 'm', 0, -h / 2, Math.max(13, 0.04 * pen.s), TINTA, { peso: '700' });
      };

      D.fluido = (a, col) => {
        const Wd = 0.46, Hh = 0.17, top = -Hh / 2 + 0.02;
        const sup = []; for (let i = 0; i <= 24; i++) { const x = -Wd / 2 + (Wd * i) / 24; sup.push([x, top + Math.sin(i * 0.7 + S.reloj * 2.2) * 0.005 + Math.sin(i * 1.7 - S.reloj * 1.3) * 0.003]); }
        rellena(sup.concat([[Wd / 2, Hh / 2], [-Wd / 2, Hh / 2]]), K.shade(col, 0.05, 0.6));
        trazo(sup, { w: 3.4, c: fillC(col, -0.3, 1), dbl: false, amp: 0.4 });
        trazo([[-Wd / 2, top - 0.05], [-Wd / 2, Hh / 2], [Wd / 2, Hh / 2], [Wd / 2, top - 0.05]], { w: 3.6, seed: 151 });
        if (a.def.flujo !== false) for (let k = 0; k < 3; k++) {
          const y = top + 0.04 + k * 0.035, x0 = -Wd / 2 + 0.02 + (((S.reloj * 0.08 * (S.reducido ? 0.3 : 1) + k * 0.31) % 1)) * (Wd - 0.12);
          linea(x0, y, x0 + 0.08, y, { w: 2, c: 'rgba(255,255,255,.8)', dbl: false, amp: 0.5 });
        }
      };

      D.termometro = (a, col) => {
        const Ht = 0.22, hw = 0.011;
        let nivel = K.num(a.def.nivel, 0.5);
        if (a.def.valor && S.valores[a.def.valor]) { const mn = K.num(a.def.min, 0), mx = K.num(a.def.max, 100); nivel = (S.valores[a.def.valor].valor - mn) / (mx - mn || 1); }
        nivel = K.clamp(nivel, 0.03, 1);
        const altura = (Ht - 0.04) * nivel;
        rellena([[-hw * 0.55, -0.03], [hw * 0.55, -0.03], [hw * 0.55, -0.03 - altura], [-hw * 0.55, -0.03 - altura]], K.shade(col, 0, 0.95));
        trazo([[-hw, -0.03], [-hw, -Ht + hw], [-hw * 0.4, -Ht], [hw * 0.4, -Ht], [hw, -Ht + hw], [hw, -0.03]], { w: 3.2, seed: 161 });
        circulo(0, -0.02, 0.02, { fill: K.shade(col, 0, 0.95), seed: 162 });
        for (let k = 1; k <= 6; k++) linea(hw, -0.04 - k * 0.028, hw + (k % 2 ? 0.012 : 0.007), -0.04 - k * 0.028, { w: 1.8, amp: 0.2 });
      };

      D.texto = (a, col) => {
        const px = Math.max(14, 0.052 * pen.s / 1.0 * K.num(a.def.tam, 1) * 1);
        const t = String(a.texto != null ? a.texto : a.def.texto || '');
        const lineas = t.split('\n');
        if (a.def.resaltar) { const w = Math.max(...lineas.map((l) => l.length)) * 0.018; rellena([[-w / 2 - 0.01, -0.025 * lineas.length], [w / 2 + 0.01, -0.025 * lineas.length], [w / 2 + 0.01, 0.025 * lineas.length], [-w / 2 - 0.01, 0.025 * lineas.length]], 'rgba(255,225,0,.5)'); }
        lineas.forEach((l, i) => etiqueta(K.texPlano(l), 0, (i - (lineas.length - 1) / 2) * 0.054, px, col, { peso: '700' }));
      };

      D.generico = (a, col) => { circulo(0, 0, 0.04, { fill: fillC(col, 0.1), seed: 171 }); etiqueta('?', 0, 0, 18, TINTA); };

      // ---------------------------------------------------------------------------
      // Capas de la escena
      // ---------------------------------------------------------------------------
      let cam = { z: 1, cx: 0.5, cy: 0.5 };
      const PX = (x) => (x - cam.cx) * cam.z * W + W / 2;
      const PY = (y) => (y - cam.cy) * cam.z * H + H / 2;

      function suelo() {
        if (sueloY == null) return;
        const y = PY(sueloY), x0 = PX(-0.1), x1 = PX(1.1);
        pen.s = 1; pen.sd = 777; pen.alpha = 1; c.globalAlpha = 1;
        trazo([[x0, y], [PX(0.3), y + 1.5], [PX(0.6), y - 1], [x1, y + 1]], { w: Math.max(2.5, pen.lw * 0.9), amp: 1.2, c: '#3a3f4a' });
        for (let i = -4; i < 40; i++) {
          const x = PX(i * 0.035) + K.hrand(i * 7 + 3) * 8;
          if (x < -20 || x > W + 20) continue;
          linea(x, y + 5, x - 9, y + 5 + 9, { w: 1.6, c: 'rgba(60,70,100,.4)', amp: 0.5, dbl: false });
        }
      }

      function actor(a) {
        const e = K.EXT[a.tipo]; const draw = D[a.tipo] || D.generico;
        const esc = a.escala * (1 + 0.05 * a.resaltado);
        const col = a.color || DEFECTO[a.tipo] || '#8899aa';
        pen.s = H * cam.z * esc; pen.sd = (K.hash(a.id) % 997) + 1; pen.alpha = K.clamp(a.alpha, 0, 1);
        c.save();
        c.globalAlpha = pen.alpha;
        c.translate(PX(a.x), PY(a.y));
        let rot = a.rot;
        if (a.tipo === 'cohete') { // el cohete se orienta hacia donde vuela, salvo que el guion lo gire
          const sp = Math.hypot(a.vx * S.aspecto, a.vy);
          let r = rumbo[a.id]; if (r == null) r = 0;
          if (!a.tieneGiro && sp > 0.02) { const obj = Math.atan2(a.vx * S.aspecto, -a.vy); let d = obj - r; d = Math.atan2(Math.sin(d), Math.cos(d)); r += d * 0.12; rumbo[a.id] = r; }
          rot += r;
        }
        if (rot) c.rotate(rot);
        const dirTipos = a.tipo === 'auto' || a.tipo === 'perro' || a.tipo === 'humano';
        if (dirTipos && a.dir < 0) c.scale(-1, 1);
        c.scale(pen.s, pen.s);
        c.lineJoin = 'round'; c.lineCap = 'round';
        try { draw(a, col); } catch (err) { if (!actor._e) { actor._e = 1; console.error('[monigotes]', a.tipo, err); } }
        c.restore();
      }

      /** bocanadas de humo al frenar */
      function actualizaHumo(dt) {
        S.reloj < ultimoReloj - 0.3 && (humo.length = 0);
        ultimoReloj = S.reloj;
        if (dt > 0) {
          for (const id in S.actores) {
            const a = S.actores[id];
            if (a.tipo === 'auto' && a.frenando && a.visible && Math.abs(a.vx) > 0.01 && !S.reducido) {
              if (Math.random() < Math.min(1, dt * 22)) humo.push({ x: a.x - a.dir * 0.13 * a.escala / S.aspecto, y: a.y - 0.03 * a.escala, t0: S.reloj, dx: -a.dir * 0.01 * (0.4 + Math.random()), r: 0.012 + Math.random() * 0.01 });
            }
          }
        }
        for (let i = humo.length - 1; i >= 0; i--) if (S.reloj - humo[i].t0 > 1) humo.splice(i, 1);
        if (humo.length > 80) humo.splice(0, humo.length - 80);
      }
      function pintaHumo() {
        pen.s = 1; pen.sd = 31;
        humo.forEach((h) => {
          const u = (S.reloj - h.t0) / 1, r = (h.r + u * 0.03) * H * cam.z;
          c.globalAlpha = 0.55 * (1 - u);
          circulo2(PX(h.x + h.dx * u * 3), PY(h.y - u * 0.06), r, 'rgba(120,125,135,1)');
        });
        c.globalAlpha = 1;
      }
      function circulo2(x, y, r, fill) { c.beginPath(); c.arc(x, y, Math.max(0.5, r), 0, TAU); c.fillStyle = fill; c.fill(); }

      function resalta(a) {
        const b = K.caja(a, S.aspecto), r = Math.max(b.hw * W, b.hh * H) * cam.z * 1.25 + 8, x = PX(b.cx), y = PY(b.cy), k = a.resaltado;
        pen.s = 1; pen.sd = 55; c.globalAlpha = K.clamp(a.alpha, 0, 1) * k;
        c.beginPath(); c.arc(x + 2, y + 2, r, 0, TAU); c.fillStyle = 'rgba(255,224,60,.45)'; c.fill();
        const pts = arcoPts(x, y, r * (1 + 0.06 * Math.sin(S.reloj * 6)), -2.2, 4.4, 28);
        trazo(pts, { w: 3.6, c: '#f59f00', amp: 1.2, dbl: false });
        if (!S.reducido) for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + 0.3, r0 = r * 1.12, r1 = r * (1.28 + 0.06 * Math.sin(S.reloj * 6 + i)); linea(x + Math.cos(an) * r0, y + Math.sin(an) * r0, x + Math.cos(an) * r1, y + Math.sin(an) * r1, { w: 3, c: '#f59f00', amp: 0.8 }); }
        c.globalAlpha = 1;
      }

      function trayectorias() {
        pen.s = 1; pen.sd = 91;
        for (const id in S.trayectorias) {
          const pts = S.trayectorias[id].map((p) => [PX(p[0]), PY(p[1])]);
          if (pts.length < 2) continue;
          const a = S.actores[id], col = a && a.color ? a.color : '#4a5a85';
          c.globalAlpha = 0.9;
          // puntos equiespaciados a lo largo de la polilínea
          let acc = 0, paso = Math.max(11, H * 0.022), n = 0;
          for (let i = 0; i < pts.length - 1; i++) {
            const x0 = pts[i][0], y0 = pts[i][1], dx = pts[i + 1][0] - x0, dy = pts[i + 1][1] - y0, l = Math.hypot(dx, dy);
            let d = acc ? paso - acc : 0;
            for (; d < l; d += paso) { const u = d / (l || 1); circulo2(x0 + dx * u + (K.hrand(n * 3) - 0.5) * 1.6, y0 + dy * u + (K.hrand(n * 3 + 1) - 0.5) * 1.6, 2.6 + (n % 2) * 0.5, col); n++; }
            acc = (l - (d - paso)) % paso;
          }
          const f = pts[pts.length - 1], g = pts[pts.length - 2], an = Math.atan2(f[1] - g[1], f[0] - g[0]);
          trazo([[f[0] - Math.cos(an - 0.5) * 14, f[1] - Math.sin(an - 0.5) * 14], f, [f[0] - Math.cos(an + 0.5) * 14, f[1] - Math.sin(an + 0.5) * 14]], { w: 3.4, c: col, dbl: false, amp: 0.5 });
        }
        c.globalAlpha = 1;
      }

      function vectores() {
        S.vectores.forEach((v) => {
          const a = S.actores[v.actor]; if (!a) return;
          const b = K.caja(a, S.aspecto), x0 = PX(b.cx), y0 = PY(b.cy), x1 = x0 + v.dx * W * cam.z, y1 = y0 + v.dy * H * cam.z;
          const col = K.colorVector(v.etiqueta), an = Math.atan2(y1 - y0, x1 - x0), cab = Math.max(11, H * 0.026);
          pen.s = 1; pen.sd = 4242 + (K.hash(v.etiqueta) % 99); c.globalAlpha = v.alpha;
          const xe = x1 - Math.cos(an) * cab * 0.6, ye = y1 - Math.sin(an) * cab * 0.6;
          linea(x0, y0, xe, ye, { w: Math.max(4, pen.lw * 1.25), c: col, amp: 1.2 });
          trazo([[x1 - Math.cos(an - 0.42) * cab, y1 - Math.sin(an - 0.42) * cab], [x1, y1], [x1 - Math.cos(an + 0.42) * cab, y1 - Math.sin(an + 0.42) * cab]], { w: Math.max(4, pen.lw * 1.25), c: col, close: true, fill: col, dbl: false, amp: 0.5 });
          if (v.etiqueta) {
            c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
            const px = Math.max(15, H * 0.04), nx = -Math.sin(an), ny = Math.cos(an);
            c.font = '700 ' + px + 'px ' + FUENTE; c.textAlign = 'center'; c.textBaseline = 'middle';
            const tx = (x0 + x1) / 2 + nx * px * 0.95, ty = (y0 + y1) / 2 + ny * px * 0.95 - (Math.abs(ny) < 0.5 ? 0 : 0);
            c.lineWidth = 5; c.strokeStyle = 'rgba(252,250,241,.95)'; c.lineJoin = 'round'; c.strokeText(K.texPlano(v.etiqueta), tx, ty);
            c.fillStyle = col; c.fillText(K.texPlano(v.etiqueta), tx, ty); c.restore();
          }
        });
        c.globalAlpha = 1;
      }

      function particulas() {
        pen.s = 1; pen.sd = 303;
        S.particulas.forEach((p) => {
          K.particulas(p, S.t, S.aspecto, S.reducido).forEach((q) => {
            const x = PX(q.x), y = PY(q.y), r = Math.max(1.5, q.r * H * cam.z);
            c.globalAlpha = K.clamp(q.a, 0, 1);
            if (q.k === 'burbuja') { circulo(x, y, r, { w: 2, c: '#4a90c2', fino: true, amp: 0.4, fill: 'rgba(200,235,255,.45)' }); circulo2(x - r * 0.3, y - r * 0.3, r * 0.22, 'rgba(255,255,255,.9)'); }
            else if (q.k === 'chispa') {
              const l = r * 3.2; linea(x, y, x + Math.cos(q.ang) * l, y + Math.sin(q.ang) * l, { w: 3, c: '#f59f00', amp: 0.4, dbl: false });
              circulo2(x, y, r * 0.8, '#ffd43b');
            } else circulo2(x, y, r, 'rgba(120,125,135,.6)');
          });
        });
        c.globalAlpha = 1;
      }

      function viajeros() {
        const V = K.viajeros(S, S.aspecto); if (!V.length) return;
        V.forEach((v) => {
          const u = v.u, arco = Math.sin(u * Math.PI) * 0.05;
          const x = K.lerp(v.x0, v.x1, u), y = K.lerp(v.y0, v.y1, u) - arco;
          const col = v.el ? K.elem(v.el).c : '#9aa3b2', r = 0.021 * (v.el ? K.elem(v.el).r : 1) * H * cam.z;
          pen.s = 1; pen.sd = 600 + (K.hash(v.el || 'x') % 30);
          c.globalAlpha = v.k === 'viaja' ? 1 : v.k === 'sale' ? 1 - u : u;
          const rr = r * (v.k === 'viaja' ? 1 : v.k === 'sale' ? 1 - 0.5 * u : 0.5 + 0.5 * u);
          circulo(PX(x), PY(y), rr, { fill: fillC(col, 0, 0.97), w: 2.8 });
          if (v.el) { c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.font = '700 ' + Math.max(10, rr * 1.0) + 'px ' + FUENTE; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ['H', 'He', 'F', 'Cl', 'S', 'Be', 'Mg', 'Ca'].includes(v.el) ? TINTA : '#fff'; c.fillText(v.el, PX(x), PY(y)); c.restore(); }
        });
        c.globalAlpha = 1;
      }

      function bocadillos() {
        const fs = Math.max(13, H * 0.033), pad = fs * 0.7;
        c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.font = '700 ' + fs + 'px ' + FUENTE; c.textBaseline = 'middle'; c.textAlign = 'center';
        for (const id in S.actores) {
          const a = S.actores[id]; if (!a.hablando || a.alpha < 0.1) continue;
          const b = K.caja(a, S.aspecto), ax = PX(b.cx), top = PY(b.cy - b.hh), maxW = Math.min(W * 0.34, 330);
          const lns = K.envuelve(c, K.texPlano(a.hablando), maxW), lh = fs * 1.2, tw = Math.max(...lns.map((l) => c.measureText(l).width));
          const bw = tw + pad * 2, bh = lns.length * lh + pad * 1.2, bob = S.reducido ? 0 : Math.sin(S.reloj * 2.5) * 2;
          let bx = K.clamp(ax - bw / 2, 8, W - bw - 8), by = top - bh - fs * 1.1 + bob;
          if (by < 8) by = 8;
          const tailX = K.clamp(ax, bx + 14, bx + bw - 14);
          c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
          c.restore();
          pen.s = 1; pen.sd = K.hash(id) % 500; pen.alpha = 1; c.globalAlpha = K.clamp(a.alpha, 0, 1);
          const caja = [[bx + 8, by], [bx + bw - 8, by], [bx + bw, by + 8], [bx + bw, by + bh - 8], [bx + bw - 8, by + bh], [tailX + 12, by + bh], [tailX, Math.min(by + bh + fs * 1.0, Math.max(top - 2, by + bh + 8))], [tailX - 8, by + bh], [bx + 8, by + bh], [bx, by + bh - 8], [bx, by + 8]];
          trazo(caja, { close: true, fill: 'rgba(255,255,255,.97)', w: 3, c: TINTA, amp: 1 });
          c.fillStyle = TINTA; c.font = '700 ' + fs + 'px ' + FUENTE; c.textAlign = 'center'; c.textBaseline = 'middle';
          lns.forEach((l, i) => c.fillText(l, bx + bw / 2, by + pad * 0.6 + lh * (i + 0.5)));
          c.globalAlpha = 1;
        }
        c.restore();
      }

      // ---------------------------------------------------------------------------
      // update: dibuja un frame
      // ---------------------------------------------------------------------------
      function update(St, dt) {
        S = St;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.globalAlpha = 1;
        if (!bg) hacerFondo();
        if (sueloY == null) { // altura del suelo = mediana de las bases iniciales de actores "de suelo"
          const ys = []; for (const id in S.actores) { const a = S.actores[id]; if (SUELO.indexOf(a.tipo) >= 0) ys.push(a.def && a.def.pos ? K.num(a.def.pos[1], a.y) : a.y); }
          ys.sort((a, b) => a - b); sueloY = ys.length ? ys[Math.floor(ys.length / 2)] : -1;
          if (sueloY < 0) sueloY = -1;
        }
        const z = K.clamp(S.camara.zoom, 0.3, 6); cam = { z, cx: S.camara.cx, cy: S.camara.cy };
        pen.fr = S.reducido ? 0 : Math.floor(S.reloj * 7);
        pen.lw = Math.max(2.4, H * 0.0062 * Math.sqrt(z));
        // fondo con paralaje suave
        const f = 1 + (z - 1) * 0.35, bw = bgW * f, bh = bgH * f;
        c.drawImage(bg, W / 2 - bw / 2 + (0.5 - cam.cx) * W * 0.5, H / 2 - bh / 2 + (0.5 - cam.cy) * H * 0.5, bw, bh);
        if (sueloY >= 0) suelo();
        trayectorias();
        const lista = Object.keys(S.actores).map((id) => S.actores[id]).sort((a, b) => a.orden - b.orden);
        lista.forEach((a) => { if (a.visible && a.resaltado > 0.01) resalta(a); });
        actualizaHumo(dt); pintaHumo();
        lista.forEach((a) => { if (a.visible) actor(a); });
        particulas(); viajeros(); vectores(); bocadillos();
        c.globalAlpha = 1;
      }

      return {
        update,
        resize(w, h) { W = w; H = h; dpr = Math.min(2, window.devicePixelRatio || 1); L.resize(w, h, dpr); bg = null; },
        dispose() { L.cv.remove(); bg = null; },
      };
    },
  });
})();
