// =====================================================================================
// 20-minimalista.js — estilo de intro "minimalista": formas geométricas limpias, trazos
// finos y vectores animados con suavidad sobre fondo oscuro y paleta sobria.
// Cubre los mismos 24 tipos de actor que "monigotes" (CONTRATO §5) con formas simples.
// Anclaje de pos igual que monigotes: base (auto, perro, humano, bloque, tubo_ensayo, vaso,
// termometro), pivote (pendulo), extremo izquierdo (resorte) y centro para el resto.
// =====================================================================================
(function () {
  'use strict';
  const PCB = window.PCB;
  const K = PCB.intro.kit;
  const TAU = Math.PI * 2;
  const FUENTE = 'UI, system-ui, -apple-system, "Segoe UI", sans-serif';
  const INK = '#e8eefc', SUAVE = 'rgba(232,238,252,.45)';
  const PAL = { azul: '#5b8cff', cian: '#4fd1e8', verde: '#4ade80', ambar: '#fbbf24', rosa: '#f472b6', rojo: '#f87171', violeta: '#a78bfa' };
  const DEFECTO = {
    auto: PAL.azul, perro: PAL.ambar, humano: PAL.cian, cohete: PAL.rojo, planeta: PAL.azul, luna: '#cbd5e1', tubo_ensayo: PAL.verde, vaso: PAL.cian,
    bola: PAL.ambar, molecula: PAL.cian, atomo: PAL.violeta, ion: PAL.ambar, electron: PAL.cian, circuito: PAL.ambar, pendulo: PAL.violeta,
    resorte: PAL.verde, onda: PAL.cian, lente: PAL.cian, rayo: PAL.ambar, flecha: PAL.rosa, bloque: PAL.ambar, fluido: PAL.azul, termometro: PAL.rojo, texto: INK,
  };

  PCB.intro.registerStyle('minimalista', {
    nombre: 'Minimalista',
    init(ic) {
      const L = K.lienzo(ic.host, ic.dpr);
      const c = L.ctx;
      let W = ic.w, H = ic.h, dpr = ic.dpr || 1;
      L.resize(W, H, dpr);
      let bg = null, S = null, cam = { z: 1, cx: 0.5, cy: 0.5 };
      const rumbo = {};
      let sueloY = null;
      const SUELO = ['auto', 'perro', 'humano', 'bloque', 'tubo_ensayo', 'vaso', 'termometro'];
      let pen = { s: 1, lw: 2.2 };

      const PX = (x) => (x - cam.cx) * cam.z * W + W / 2;
      const PY = (y) => (y - cam.cy) * cam.z * H + H / 2;

      function hacerFondo() {
        bg = document.createElement('canvas'); bg.width = Math.round(W * dpr); bg.height = Math.round(H * dpr);
        const g = bg.getContext('2d'); g.scale(dpr, dpr);
        const gr = g.createRadialGradient(W / 2, H * 0.45, H * 0.1, W / 2, H / 2, Math.max(W, H) * 0.75);
        gr.addColorStop(0, '#182345'); gr.addColorStop(1, '#0a0f1f');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(160,185,255,.09)';
        const paso = H / 18;
        for (let x = paso / 2; x < W; x += paso) for (let y = paso / 2; y < H; y += paso) g.fillRect(x - 1, y - 1, 2, 2);
      }

      // ---- primitivas limpias (coordenadas locales, escala pen.s) ----
      const lw = (px) => (px || pen.lw) / pen.s;
      function linea(x1, y1, x2, y2, col, px) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col || INK; c.lineWidth = lw(px); c.stroke(); }
      function poli(pts, o) {
        o = o || {}; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); if (o.close) c.closePath();
        if (o.fill) { c.fillStyle = o.fill; c.fill(); }
        if (o.stroke !== false) { c.strokeStyle = o.c || INK; c.lineWidth = lw(o.w); c.stroke(); }
      }
      function circ(x, y, r, o) {
        o = o || {}; c.beginPath(); c.arc(x, y, Math.max(0.0001, r), 0, TAU);
        if (o.fill) { c.fillStyle = o.fill; c.fill(); }
        if (o.stroke !== false) { c.strokeStyle = o.c || INK; c.lineWidth = lw(o.w); c.stroke(); }
      }
      function rrect(x, y, w, h, r, o) {
        o = o || {}; c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h);
        if (o.fill) { c.fillStyle = o.fill; c.fill(); }
        if (o.stroke !== false) { c.strokeStyle = o.c || INK; c.lineWidth = lw(o.w); c.stroke(); }
      }
      const arco = (cx, cy, r, a0, a1, n) => { const p = []; n = n || 14; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };
      const tint = (col, a) => K.shade(col, 0, a);
      function etiqueta(str, lx, ly, px, col, peso) {
        const m = c.getTransform(), x = m.a * lx + m.c * ly + m.e, y = m.b * lx + m.d * ly + m.f;
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
        c.font = (peso || '600') + ' ' + Math.max(8, px * dpr) + 'px ' + FUENTE; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = col || INK; c.fillText(str, x, y); c.restore();
      }
      const ang2 = (a) => [Math.sin(a), Math.cos(a)];

      // ---- actores ----
      const D = {};
      D.auto = (a, col) => {
        const sp = Math.abs(a.vx) * S.aspecto;
        if (sp > 0.06) [-0.12, -0.085, -0.055].forEach((y, i) => linea(-0.16 - i * 0.012, y, -0.16 - K.clamp(sp * 0.35, 0.03, 0.09) - i * 0.012, y, 'rgba(232,238,252,.35)', 1.6));
        poli([[-0.14, -0.04], [-0.14, -0.08], [-0.1, -0.088], [-0.07, -0.13], [0.04, -0.13], [0.08, -0.09], [0.14, -0.082], [0.14, -0.04]], { close: true, fill: tint(col, 0.42), c: col, w: 2.4 });
        poli([[-0.055, -0.09], [-0.035, -0.12], [0.0, -0.12], [0.0, -0.09]], { close: true, fill: 'rgba(232,238,252,.2)', c: INK, w: 1.4 });
        poli([[0.012, -0.09], [0.012, -0.12], [0.038, -0.12], [0.064, -0.09]], { close: true, fill: 'rgba(232,238,252,.2)', c: INK, w: 1.4 });
        circ(0.132, -0.066, 0.008, { fill: PAL.ambar, stroke: false });
        circ(-0.133, -0.066, 0.008, { fill: a.frenando ? '#ff4d4d' : '#7a3b3b', stroke: false });
        if (a.frenando) { c.save(); c.shadowColor = '#ff4d4d'; c.shadowBlur = 14; circ(-0.133, -0.066, 0.008, { fill: '#ff4d4d', stroke: false }); c.restore(); }
        const giro = a.x * S.aspecto * a.dir / (0.03 * a.escala);
        [-0.085, 0.085].forEach((x) => {
          c.save(); c.translate(x, -0.03); c.rotate(giro);
          circ(0, 0, 0.03, { fill: '#0a0f1f', c: INK, w: 2.4 });
          for (let k = 0; k < 3; k++) { const an = (k / 3) * Math.PI; linea(Math.cos(an) * 0.02, Math.sin(an) * 0.02, -Math.cos(an) * 0.02, -Math.sin(an) * 0.02, SUAVE, 1.6); }
          c.restore();
        });
      };

      D.perro = (a, col) => {
        const sp = Math.hypot(a.vx * S.aspecto, a.vy), w = K.smooth(sp / 0.04), fase = (a.x * S.aspecto / 0.12) * TAU, bal = a.frenando ? 0 : w;
        const sube = Math.abs(Math.sin(fase)) * 0.01 * w;
        const pata = (x, off, delante) => {
          let an = Math.sin(fase + off) * 0.7 * bal; if (a.frenando && sp > 0.01) an = delante ? -0.65 : -0.4;
          const [sx, cy] = ang2(an); linea(x, -0.05 - sube, x + sx * 0.05, -0.05 - sube + cy * 0.05 + sube, col, 3.4);
        };
        pata(-0.045, 0, false); pata(0.045, Math.PI, true);
        const ct = -2.4 + Math.sin(S.reloj * (sp > 0.03 ? 14 : 9)) * 0.5;
        poli([[-0.062, -0.088 - sube], [-0.062 + Math.cos(ct) * 0.04, -0.088 - sube + Math.sin(ct) * 0.04]], { c: col, w: 3.2 });
        c.beginPath(); c.ellipse(0, -0.082 - sube, 0.07, 0.03, 0, 0, TAU); c.fillStyle = tint(col, 0.3); c.fill(); c.strokeStyle = col; c.lineWidth = lw(2.4); c.stroke();
        pata(-0.025, Math.PI, false); pata(0.025, 0, true);
        circ(0.082, -0.118 - sube, 0.026, { fill: tint(col, 0.3), c: col, w: 2.4 });
        poli([[0.075, -0.14 - sube], [0.062, -0.116 - sube], [0.085, -0.126 - sube]], { close: true, fill: col, c: col, w: 1.5 });
        poli([[0.103, -0.122 - sube], [0.125, -0.115 - sube], [0.103, -0.106 - sube]], { close: true, fill: tint(col, 0.5), c: col, w: 2 });
        circ(0.092, -0.124 - sube, 0.004, { fill: INK, stroke: false });
      };

      D.humano = (a, col) => {
        const sp = Math.hypot(a.vx * S.aspecto, a.vy), w = K.smooth(sp / 0.03), fase = (a.x * S.aspecto / 0.09) * TAU;
        const bote = Math.abs(Math.sin(fase)) * 0.005 * w, cad = -0.125 - bote, hom = -0.2 - bote;
        [0, 1].forEach((i) => {
          const an = Math.sin(fase + i * Math.PI) * 0.6 * w + (i ? 0.12 : -0.12) * (1 - w), [sx, cy] = ang2(an);
          poli([[0, cad], [sx * 0.06, cad + cy * 0.06], [sx * 0.12, Math.min(0, cad + cy * 0.125)]], { c: INK, w: 3.2 });
        });
        rrect(-0.024, hom, 0.048, cad - hom, 0.012, { fill: tint(col, 0.35), c: col, w: 2.4 });
        [0, 1].forEach((i) => {
          let an = Math.sin(fase + (i ? 0 : Math.PI)) * 0.65 * w + (i ? 0.2 : -0.2), fl = 0.3;
          if (i === 1 && a.hablando) { an = 2.3 + Math.sin(S.reloj * 6) * 0.45; fl = -0.5; }
          if (a.resaltado > 0.2 && i === 0) { an = -2.6; fl = 0.2; }
          const [sx, cy] = ang2(an), e = [sx * 0.052, hom + 0.006 + cy * 0.052], [sx2, cy2] = ang2(an + fl);
          poli([[0, hom + 0.006], e, [e[0] + sx2 * 0.05, e[1] + cy2 * 0.05]], { c: INK, w: 3 });
        });
        const hy = -0.232 - bote;
        circ(0, hy, 0.03, { fill: tint(INK, 0.15), c: INK, w: 2.4 });
        if (a.hablando) c.beginPath(), c.ellipse(0.002, hy + 0.012, 0.007, 0.003 + Math.abs(Math.sin(S.reloj * 13)) * 0.006, 0, 0, TAU), c.fillStyle = '#0a0f1f', c.fill();
        else poli(arco(0.002, hy + 0.004, 0.011, 0.3, Math.PI - 0.3, 6), { c: '#0a0f1f', w: 1.6 });
        circ(0.011, hy - 0.004, 0.0035, { fill: '#0a0f1f', stroke: false }); circ(-0.009, hy - 0.004, 0.0035, { fill: '#0a0f1f', stroke: false });
      };

      D.cohete = (a, col) => {
        const sp = Math.hypot(a.vx * S.aspecto, a.vy), on = a.def.encendido !== false;
        if (on) {
          const f = (sp > 0.012 || a.def.encendido === true ? 1 : 0.45) * (0.8 + 0.2 * Math.sin(S.reloj * 31)), Lf = (0.06 + K.clamp(sp * 0.3, 0, 0.07)) * f;
          c.save(); c.shadowColor = PAL.ambar; c.shadowBlur = 16;
          poli([[-0.018, 0.05], [0, 0.05 + Lf], [0.018, 0.05]], { close: true, fill: PAL.ambar, stroke: false }); c.restore();
          poli([[-0.01, 0.05], [0, 0.05 + Lf * 0.55], [0.01, 0.05]], { close: true, fill: '#fff3c4', stroke: false });
        }
        poli([[-0.03, 0.0], [-0.062, 0.07], [-0.03, 0.05]], { close: true, fill: tint(col, 0.5), c: col, w: 2 });
        poli([[0.03, 0.0], [0.062, 0.07], [0.03, 0.05]], { close: true, fill: tint(col, 0.5), c: col, w: 2 });
        poli([[0, -0.125], [0.03, -0.07], [0.032, 0.05], [-0.032, 0.05], [-0.03, -0.07]], { close: true, fill: 'rgba(232,238,252,.14)', c: INK, w: 2.4 });
        poli([[0, -0.125], [0.03, -0.07], [-0.03, -0.07]], { close: true, fill: col, c: col, w: 2 });
        circ(0, -0.03, 0.014, { fill: tint(PAL.cian, 0.5), c: INK, w: 1.8 });
      };

      D.planeta = (a, col) => {
        const R = 0.075; const g = c.createRadialGradient(-R * 0.4, -R * 0.4, R * 0.1, 0, 0, R); g.addColorStop(0, K.shade(col, 0.35)); g.addColorStop(1, K.shade(col, -0.45));
        c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = g; c.fill();
        if (a.def.anillos) { c.save(); c.rotate(-0.35); c.beginPath(); c.ellipse(0, 0, R * 1.7, R * 0.4, 0, 0, TAU); c.strokeStyle = PAL.ambar; c.lineWidth = lw(2); c.stroke(); c.restore(); }
        c.beginPath(); c.arc(0, 0, R, 0, TAU); c.strokeStyle = INK; c.lineWidth = lw(1.6); c.stroke();
      };
      D.luna = (a, col) => {
        const R = 0.04; const g = c.createRadialGradient(-R * 0.4, -R * 0.4, R * 0.1, 0, 0, R); g.addColorStop(0, '#f1f5f9'); g.addColorStop(1, '#64748b');
        c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = g; c.fill();
        circ(-0.01, -0.008, 0.007, { c: 'rgba(15,23,42,.35)', w: 1.4 }); circ(0.013, 0.012, 0.005, { c: 'rgba(15,23,42,.35)', w: 1.4 });
      };

      function recipiente(a, col, tubo) {
        const hw = tubo ? 0.026 : 0.05, hwB = tubo ? 0.026 : 0.045, Ht = tubo ? 0.22 : 0.13, rB = tubo ? 0.026 : 0;
        const liq = a.color || a.def.liquido || col, nivel = K.clamp(K.num(a.def.nivel, tubo ? 0.55 : 0.6), 0.05, 0.95);
        const yb = tubo ? -rB : 0, ytop = yb - nivel * (Ht - rB);
        const sup = []; for (let i = 0; i <= 12; i++) sup.push([K.lerp(-hw, hw, i / 12), ytop + (S.reducido ? 0 : Math.sin(i * 0.9 + S.reloj * 3) * 0.002)]);
        const fondo = tubo ? arco(0, -rB, rB, 0, Math.PI, 12) : [[hwB, 0], [-hwB, 0]];
        poli(sup.concat(fondo), { close: true, fill: tint(liq, 0.55), stroke: false });
        poli(sup, { c: liq, w: 2 });
        if (a.def.burbujas || S.particulas.some((p) => p.tipo === 'burbujas')) for (let i = 0; i < 4; i++) { const u = (S.reloj * 0.35 + i * 0.27) % 1; circ(Math.sin(i * 2.3 + S.reloj * 2) * hw * 0.5, yb - u * (yb - ytop), 0.004 + i * 0.001, { c: 'rgba(255,255,255,.8)', w: 1.2 }); }
        if (tubo) {
          poli([[-hw, -Ht], [-hw, -rB]].concat(arco(0, -rB, rB, Math.PI, 0, 12)).concat([[hw, -Ht]]), { c: INK, w: 2.4 });
          linea(-hw - 0.006, -Ht, hw + 0.006, -Ht, INK, 2.4);
          for (let k = 1; k <= 4; k++) linea(hw, -rB - k * 0.036, hw - 0.01, -rB - k * 0.036, SUAVE, 1.4);
        } else {
          poli([[-hw, -Ht], [-hwB, 0], [hwB, 0], [hw, -Ht]], { c: INK, w: 2.4 });
          for (let k = 1; k <= 4; k++) { const y = -k * 0.025, x = K.lerp(hwB, hw, -y / Ht); linea(x - 0.015, y, x, y, SUAVE, 1.4); }
        }
      }
      D.tubo_ensayo = (a, col) => recipiente(a, col, true);
      D.vaso = (a, col) => recipiente(a, col, false);

      D.bola = (a, col) => {
        const R = 0.034, giro = a.x * S.aspecto / (R * a.escala);
        const g = c.createRadialGradient(-R * 0.4, -R * 0.4, R * 0.1, 0, 0, R); g.addColorStop(0, K.shade(col, 0.4)); g.addColorStop(1, K.shade(col, -0.35));
        c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fillStyle = g; c.fill();
        c.save(); c.rotate(giro); linea(-R, 0, R, 0, 'rgba(10,15,31,.55)', 1.6); c.restore();
      };

      function atomoBola(el, x, y, r) {
        const e = K.elem(el), g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, K.shade(e.c, 0.35)); g.addColorStop(1, K.shade(e.c, -0.25));
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = g; c.fill();
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.strokeStyle = 'rgba(232,238,252,.7)'; c.lineWidth = lw(1.4); c.stroke();
        etiqueta(el, x, y, Math.max(9, r * pen.s * 1.0), ['H', 'He', 'F', 'Cl', 'S', 'Ne', 'Ar'].includes(el) ? '#0f172a' : '#fff', '700');
      }
      D.molecula = (a) => {
        const lay = K.layoutMolecula(a.def), vib = S.reducido ? 0 : 0.002;
        const off = lay.atomos.map((p, i) => [Math.sin(S.reloj * 9 + i * 2.1) * vib, Math.cos(S.reloj * 8 + i * 1.7) * vib]);
        lay.enlaces.forEach((b) => {
          const A = lay.atomos[b[0]], B = lay.atomos[b[1]], dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, n = b[2] || 1;
          for (let k = 0; k < n; k++) { const d = (k - (n - 1) / 2) * 0.008; linea(A.x + off[b[0]][0] + nx * d, A.y + off[b[0]][1] + ny * d, B.x + off[b[1]][0] + nx * d, B.y + off[b[1]][1] + ny * d, 'rgba(232,238,252,.8)', 3); }
        });
        lay.atomos.forEach((p, i) => atomoBola(p.el, p.x + off[i][0], p.y + off[i][1], p.r));
      };
      D.atomo = (a, col) => {
        const sym = String(a.def.elemento || a.def.simbolo || 'C'), Z = K.num(a.def.Z, K.elem(sym).Z || 6), capas = K.capas(Z);
        capas.forEach((n, k) => {
          const R = 0.045 + k * 0.026; circ(0, 0, R, { c: 'rgba(232,238,252,.25)', w: 1.2 });
          for (let e = 0; e < n; e++) { const an = S.reloj * (0.9 - k * 0.15) * (S.reducido ? 0.5 : 1) + (e / n) * TAU + k; circ(Math.cos(an) * R, Math.sin(an) * R, 0.0075, { fill: PAL.cian, stroke: false }); }
        });
        c.save(); c.shadowColor = col; c.shadowBlur = 14; circ(0, 0, 0.025, { fill: tint(a.color || PAL.violeta, 0.9), c: a.color || PAL.violeta, w: 2 }); c.restore();
        etiqueta(sym, 0, 0, Math.max(10, 0.025 * pen.s), '#fff', '700');
      };
      D.ion = (a, col) => {
        const sym = String(a.def.elemento || a.def.simbolo || 'Na').replace(/[+\-−⁺⁻\d]/g, '') || 'Na';
        let carga = a.def.carga != null ? a.def.carga : /[+⁺]/.test(String(a.def.simbolo || '')) ? 1 : /[-−⁻]/.test(String(a.def.simbolo || '')) ? -1 : 1;
        if (typeof carga === 'string') { const m = /(\d*)\s*([+\-−⁺⁻])/.exec(carga); carga = m ? (m[1] ? +m[1] : 1) * (/[+⁺]/.test(m[2]) ? 1 : -1) : parseFloat(carga) || 1; }
        const pos = carga > 0, cc = a.color || (pos ? PAL.ambar : PAL.azul), R = 0.032;
        c.save(); c.shadowColor = cc; c.shadowBlur = 16; circ(0, 0, R, { fill: tint(cc, 0.85), c: cc, w: 2 }); c.restore();
        circ(0, 0, R * 1.4 + Math.sin(S.reloj * 3) * 0.002, { c: tint(cc, 0.35), w: 1.2 });
        etiqueta(sym, -0.003, 0, Math.max(10, R * pen.s * 0.85), '#fff', '700');
        etiqueta((Math.abs(carga) > 1 ? Math.abs(carga) : '') + (pos ? '+' : '−'), R * 0.85, -R * 0.85, Math.max(10, R * pen.s * 0.7), cc, '700');
      };
      D.electron = (a, col) => {
        c.save(); c.shadowColor = col; c.shadowBlur = 14; circ(0, 0, 0.012, { fill: col, stroke: false }); c.restore();
        etiqueta('−', 0, -0.0004, Math.max(9, 0.012 * pen.s * 1.5), '#0a0f1f', '700');
      };
      D.circuito = (a, col) => {
        const w = 0.16, h = 0.1;
        poli([[-w, -0.022], [-w, -h], [-0.04, -h]], { c: INK, w: 2 }); poli([[0.04, -h], [w, -h], [w, -0.04]], { c: INK, w: 2 }); poli([[w, 0.04], [w, h], [-w, h], [-w, 0.022]], { c: INK, w: 2 });
        linea(-w - 0.026, -0.022, -w + 0.026, -0.022, INK, 3.2); linea(-w - 0.015, 0.022, -w + 0.015, 0.022, INK, 2);
        etiqueta('+', -w + 0.045, -0.026, 10, SUAVE); etiqueta('−', -w + 0.045, 0.026, 10, SUAVE);
        const z = [[-0.04, -h]]; for (let i = 0; i < 6; i++) z.push([-0.04 + (i + 0.5) * (0.08 / 6), -h + (i % 2 ? 0.013 : -0.013)]); z.push([0.04, -h]);
        poli(z, { c: PAL.ambar, w: 2 }); etiqueta('R', 0, -h - 0.032, 12, SUAVE);
        const on = 0.5 + 0.5 * Math.sin(S.reloj * 4);
        c.save(); c.shadowColor = PAL.ambar; c.shadowBlur = 20 * (0.5 + on); circ(w, 0, 0.036, { fill: 'rgba(251,191,36,' + (0.3 + 0.3 * on) + ')', c: PAL.ambar, w: 2 }); c.restore();
        const cam_ = [[-w, -0.022], [-w, -h], [w, -h], [w, h], [-w, h], [-w, 0.022]], tl = []; let tot = 0;
        for (let i = 0; i < cam_.length - 1; i++) { const l = Math.hypot(cam_[i + 1][0] - cam_[i][0], cam_[i + 1][1] - cam_[i][1]); tl.push(l); tot += l; }
        const N = S.reducido ? 8 : 16;
        for (let k = 0; k < N; k++) { let d = ((S.reloj * 0.07 + k / N) % 1) * tot, i = 0; while (i < tl.length - 1 && d > tl[i]) { d -= tl[i]; i++; } const u = d / tl[i]; circ(K.lerp(cam_[i][0], cam_[i + 1][0], u), K.lerp(cam_[i][1], cam_[i + 1][1], u), 0.006, { fill: PAL.cian, stroke: false }); }
      };
      D.pendulo = (a, col) => {
        const Lr = 0.27, amp = (K.num(a.def.amplitud, 28) * Math.PI) / 180, T = K.num(a.def.periodo, 2.2), th = amp * Math.cos((TAU * S.reloj) / T), bx = Math.sin(th) * Lr, by = Math.cos(th) * Lr;
        linea(-0.05, 0, 0.05, 0, INK, 3);
        poli(arco(0, 0, Lr, Math.PI / 2 - amp, Math.PI / 2 + amp, 20), { c: 'rgba(232,238,252,.22)', w: 1.2 });
        linea(0, 0, bx, by, INK, 1.8);
        c.save(); c.shadowColor = col; c.shadowBlur = 12; circ(bx, by, 0.028, { fill: tint(col, 0.85), c: col, w: 2 }); c.restore();
      };
      D.resorte = (a, col) => {
        const osc = a.def.oscila === false ? 0 : 1, Lr = 0.22 * (1 + 0.16 * Math.sin(S.reloj * 3) * osc * (S.reducido ? 0.4 : 1)), x0 = 0.012, x1 = x0 + Lr;
        linea(0, -0.04, 0, 0.04, INK, 3);
        const z = [[x0, 0]]; for (let i = 0; i < 10; i++) z.push([x0 + 0.02 + (i + 0.5) * ((Lr - 0.04) / 10), i % 2 ? 0.024 : -0.024]); z.push([x1, 0]);
        poli(z, { c: col, w: 2.2 }); rrect(x1, -0.026, 0.05, 0.052, 0.006, { fill: tint(col, 0.35), c: col, w: 2 });
        if (a.def.texto) etiqueta(a.def.texto, x1 + 0.025, 0, 12, INK);
      };
      D.onda = (a, col) => {
        const Wd = 0.44, A = K.num(a.def.amplitud, 0.035), lam = K.num(a.def.longitud, 0.12), f = K.num(a.def.frecuencia, 0.55) * (S.reducido ? 0.5 : 1), pts = [];
        for (let i = 0; i <= 80; i++) { const x = -Wd / 2 + (Wd * i) / 80, env = Math.sin(Math.PI * (i / 80)) ** 0.5; pts.push([x, Math.sin(TAU * (x / lam - S.reloj * f)) * A * env]); }
        linea(-Wd / 2, 0, Wd / 2, 0, 'rgba(232,238,252,.2)', 1);
        c.save(); c.shadowColor = col; c.shadowBlur = 10; poli(pts, { c: col, w: 3 }); c.restore();
        if (a.texto) etiqueta(a.texto, 0, -A - 0.035, 12, INK);
      };
      D.lente = (a, col) => {
        const Hh = 0.14, bul = 0.042, pts = [];
        for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push([Math.sin(Math.PI * u) * bul, -Hh + u * 2 * Hh]); }
        for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push([-Math.sin(Math.PI * u) * bul, Hh - u * 2 * Hh]); }
        poli(pts, { close: true, fill: tint(col, 0.18), c: col, w: 2.2 });
        const fo = K.num(a.def.f, 0.14);
        linea(-0.32, 0, 0.32, 0, 'rgba(232,238,252,.3)', 1.2);
        [-fo, fo].forEach((x, i) => { linea(x, -0.008, x, 0.008, INK, 1.6); etiqueta(i ? "F'" : 'F', x, 0.028, 12, SUAVE); });
      };
      D.rayo = (a, col) => {
        const Lr = K.num(a.def.largo, 0.26) * 0.5;
        c.save(); c.shadowColor = col; c.shadowBlur = 14; linea(-Lr, 0, Lr - 0.01, 0, col, 3); c.restore();
        for (let k = 0; k < 4; k++) circ(-Lr + ((S.reloj * 0.25 * (S.reducido ? 0.3 : 1) + k / 4) % 1) * 2 * Lr, 0, 0.005, { fill: '#fff', stroke: false });
        poli([[Lr - 0.024, -0.014], [Lr, 0], [Lr - 0.024, 0.014]], { c: col, w: 3 });
      };
      D.flecha = (a, col) => {
        const Lr = K.num(a.def.largo, 0.15) * 0.5;
        poli([[-Lr, -0.007], [Lr - 0.03, -0.007], [Lr - 0.03, -0.022], [Lr, 0], [Lr - 0.03, 0.022], [Lr - 0.03, 0.007], [-Lr, 0.007]], { close: true, fill: tint(col, 0.5), c: col, w: 2 });
        if (a.texto) etiqueta(a.texto, 0, -0.038, 13, INK);
      };
      D.bloque = (a, col) => {
        rrect(-0.055, -0.085, 0.11, 0.085, 0.008, { fill: tint(col, 0.28), c: col, w: 2.4 });
        etiqueta(a.texto || a.def.masa || 'm', 0, -0.0425, Math.max(12, 0.036 * pen.s), INK, '700');
      };
      D.fluido = (a, col) => {
        const Wd = 0.46, Hh = 0.17, top = -Hh / 2 + 0.02, sup = [];
        for (let i = 0; i <= 28; i++) sup.push([-Wd / 2 + (Wd * i) / 28, top + Math.sin(i * 0.7 + S.reloj * 2.2) * 0.005 + Math.sin(i * 1.7 - S.reloj * 1.3) * 0.003]);
        poli(sup.concat([[Wd / 2, Hh / 2], [-Wd / 2, Hh / 2]]), { close: true, fill: tint(col, 0.35), stroke: false });
        poli(sup, { c: col, w: 2.2 });
        poli([[-Wd / 2, top - 0.05], [-Wd / 2, Hh / 2], [Wd / 2, Hh / 2], [Wd / 2, top - 0.05]], { c: INK, w: 2 });
        if (a.def.flujo !== false) for (let k = 0; k < 3; k++) { const y = top + 0.04 + k * 0.035, x0 = -Wd / 2 + 0.02 + ((S.reloj * 0.08 * (S.reducido ? 0.3 : 1) + k * 0.31) % 1) * (Wd - 0.12); linea(x0, y, x0 + 0.08, y, 'rgba(255,255,255,.55)', 1.4); }
      };
      D.termometro = (a, col) => {
        const Ht = 0.22, hw = 0.01; let nivel = K.num(a.def.nivel, 0.5);
        if (a.def.valor && S.valores[a.def.valor]) { const mn = K.num(a.def.min, 0), mx = K.num(a.def.max, 100); nivel = (S.valores[a.def.valor].valor - mn) / (mx - mn || 1); }
        nivel = K.clamp(nivel, 0.03, 1);
        const alt = (Ht - 0.04) * nivel;
        rrect(-hw, -Ht, hw * 2, Ht - 0.025, hw, { c: INK, w: 2 });
        circ(0, -0.02, 0.02, { fill: tint(col, 0.9), c: col, w: 2 });
        rrect(-hw * 0.45, -0.03 - alt, hw * 0.9, alt + 0.01, 0.003, { fill: col, stroke: false });
        for (let k = 1; k <= 6; k++) linea(hw, -0.04 - k * 0.028, hw + (k % 2 ? 0.011 : 0.006), -0.04 - k * 0.028, SUAVE, 1.2);
      };
      D.texto = (a, col) => {
        const lineas = String(a.texto != null ? a.texto : a.def.texto || '').split('\n'), px = Math.max(14, 0.05 * pen.s * K.num(a.def.tam, 1));
        lineas.forEach((l, i) => {
          const m = c.getTransform(), ly = (i - (lineas.length - 1) / 2) * 0.054;
          c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
          K.textoRico(c, l, m.c * ly + m.e, m.d * ly + m.f, px * dpr, { fill: col, fam: FUENTE, peso: '600' });
          c.restore();
        });
      };
      D.generico = (a, col) => { circ(0, 0, 0.035, { fill: tint(col, 0.3), c: col, w: 2 }); etiqueta('?', 0, 0, 16, INK); };

      // ---- capas ----
      function actor(a) {
        const draw = D[a.tipo] || D.generico, esc = a.escala * (1 + 0.05 * a.resaltado), col = a.color || DEFECTO[a.tipo] || PAL.azul;
        pen.s = H * cam.z * esc; pen.lw = Math.max(2, H * 0.0034 * Math.sqrt(cam.z));
        c.save(); c.globalAlpha = K.clamp(a.alpha, 0, 1); c.translate(PX(a.x), PY(a.y));
        let rot = a.rot;
        if (a.tipo === 'cohete') {
          const sp = Math.hypot(a.vx * S.aspecto, a.vy); let r = rumbo[a.id] || 0;
          if (!a.tieneGiro && sp > 0.02) { let d = Math.atan2(a.vx * S.aspecto, -a.vy) - r; d = Math.atan2(Math.sin(d), Math.cos(d)); r += d * 0.12; rumbo[a.id] = r; }
          rot += r;
        }
        if (rot) c.rotate(rot);
        if ((a.tipo === 'auto' || a.tipo === 'perro' || a.tipo === 'humano') && a.dir < 0) c.scale(-1, 1);
        c.scale(pen.s, pen.s); c.lineJoin = 'round'; c.lineCap = 'round';
        try { draw(a, col); } catch (e) { if (!actor._e) { actor._e = 1; console.error('[minimalista]', a.tipo, e); } }
        c.restore();
      }
      function suelo() {
        let al = 0;
        for (const id in S.actores) { const a = S.actores[id]; if (a.visible && SUELO.indexOf(a.tipo) >= 0) al = Math.max(al, K.smooth(1 - Math.abs(a.y - sueloY) / 0.08) * a.alpha); }
        if (al < 0.02) return;
        const y = PY(sueloY); c.save(); c.globalAlpha = al; c.strokeStyle = 'rgba(232,238,252,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(PX(-0.1), y); c.lineTo(PX(1.1), y); c.stroke(); c.restore();
      }
      function trayectorias() {
        for (const id in S.trayectorias) {
          const pts = S.trayectorias[id]; if (pts.length < 2) continue;
          const a = S.actores[id], col = a && a.color ? a.color : PAL.cian;
          c.save(); c.setLineDash([2, 9]); c.lineDashOffset = -S.reloj * 14; c.lineCap = 'round'; c.strokeStyle = col; c.lineWidth = 2.4; c.globalAlpha = 0.85;
          c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(PX(p[0]), PY(p[1])) : c.moveTo(PX(p[0]), PY(p[1])))); c.stroke(); c.restore();
        }
      }
      function resalta(a) {
        const b = K.caja(a, S.aspecto), r = Math.max(b.hw * W, b.hh * H) * cam.z * 1.25 + 8, x = PX(b.cx), y = PY(b.cy), k = a.resaltado;
        c.save(); c.globalAlpha = K.clamp(a.alpha, 0, 1) * k;
        const g = c.createRadialGradient(x, y, r * 0.2, x, y, r * 1.2); g.addColorStop(0, 'rgba(251,191,36,.28)'); g.addColorStop(1, 'rgba(251,191,36,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.2, 0, TAU); c.fill();
        c.strokeStyle = PAL.ambar; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * (1 + 0.04 * Math.sin(S.reloj * 6)), 0, TAU); c.stroke(); c.restore();
      }
      function vectores() {
        S.vectores.forEach((v) => {
          const a = S.actores[v.actor]; if (!a) return;
          const b = K.caja(a, S.aspecto), x0 = PX(b.cx), y0 = PY(b.cy), x1 = x0 + v.dx * W * cam.z, y1 = y0 + v.dy * H * cam.z;
          const col = K.colorVector(v.etiqueta), an = Math.atan2(y1 - y0, x1 - x0), cab = Math.max(10, H * 0.024);
          c.save(); c.globalAlpha = v.alpha; c.shadowColor = col; c.shadowBlur = 10; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(3, H * 0.0055); c.lineCap = 'round';
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1 - Math.cos(an) * cab * 0.7, y1 - Math.sin(an) * cab * 0.7); c.stroke();
          c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - Math.cos(an - 0.4) * cab, y1 - Math.sin(an - 0.4) * cab); c.lineTo(x1 - Math.cos(an + 0.4) * cab, y1 - Math.sin(an + 0.4) * cab); c.closePath(); c.fill();
          c.restore();
          if (v.etiqueta) {
            c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalAlpha = v.alpha;
            const px = Math.max(14, H * 0.038), nx = -Math.sin(an), ny = Math.cos(an);
            K.textoRico(c, v.etiqueta, (x0 + x1) / 2 + nx * px * 1.0, (y0 + y1) / 2 + ny * px * 1.0, px, { fill: K.shade(col, 0.3), halo: 'rgba(10,15,31,.85)', fam: FUENTE });
            c.restore();
          }
        });
      }
      function particulas() {
        S.particulas.forEach((p) => K.particulas(p, S.t, S.aspecto, S.reducido).forEach((q) => {
          const x = PX(q.x), y = PY(q.y), r = Math.max(1.5, q.r * H * cam.z);
          c.save(); c.globalAlpha = K.clamp(q.a, 0, 1);
          if (q.k === 'burbuja') { c.strokeStyle = 'rgba(160,220,255,.9)'; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); }
          else if (q.k === 'chispa') { c.shadowColor = PAL.ambar; c.shadowBlur = 8; c.strokeStyle = PAL.ambar; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(q.ang) * r * 3, y + Math.sin(q.ang) * r * 3); c.stroke(); }
          else { c.fillStyle = 'rgba(200,210,235,.5)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
          c.restore();
        }));
      }
      function viajeros() {
        K.viajeros(S, S.aspecto).forEach((v) => {
          const u = v.u, x = K.lerp(v.x0, v.x1, u), y = K.lerp(v.y0, v.y1, u) - Math.sin(u * Math.PI) * 0.05;
          const r = 0.025 * (v.el ? K.elem(v.el).r : 1) * K.lerp(v.esc0 || 1, v.esc1 || 1, u) * H * cam.z * (v.k === 'viaja' ? 1 : v.k === 'sale' ? 1 - 0.5 * u : 0.5 + 0.5 * u);
          c.save(); c.globalAlpha = v.k === 'viaja' ? 1 : v.k === 'sale' ? 1 - u : u;
          const e = K.elem(v.el), g = c.createRadialGradient(PX(x) - r * 0.35, PY(y) - r * 0.35, r * 0.1, PX(x), PY(y), r); g.addColorStop(0, K.shade(e.c, 0.35)); g.addColorStop(1, K.shade(e.c, -0.25));
          c.shadowColor = e.c; c.shadowBlur = 12; c.fillStyle = g; c.beginPath(); c.arc(PX(x), PY(y), r, 0, TAU); c.fill(); c.shadowBlur = 0;
          if (v.el) { c.font = '700 ' + Math.max(9, r) + 'px ' + FUENTE; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ['H', 'He', 'F', 'Cl', 'S'].includes(v.el) ? '#0f172a' : '#fff'; c.fillText(v.el, PX(x), PY(y)); }
          c.restore();
        });
      }
      function bocadillos() {
        const fs = Math.max(13, H * 0.032), pad = fs * 0.75;
        c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.font = '600 ' + fs + 'px ' + FUENTE; c.textBaseline = 'middle'; c.textAlign = 'center';
        for (const id in S.actores) {
          const a = S.actores[id]; if (!a.hablando || a.alpha < 0.1) continue;
          const b = K.caja(a, S.aspecto), ax = PX(b.cx), top = PY(b.cy - b.hh), maxW = Math.min(W * 0.34, 330);
          const lns = K.envuelve(c, K.texPlano(a.hablando), maxW), lh = fs * 1.25, tw = Math.max(...lns.map((l) => c.measureText(l).width));
          const bw = tw + pad * 2, bh = lns.length * lh + pad * 1.1;
          const bx = K.clamp(ax - bw / 2, 8, W - bw - 8); let by = top - bh - fs * 0.9 + (S.reducido ? 0 : Math.sin(S.reloj * 2.5) * 2); if (by < 8) by = 8;
          const tx = K.clamp(ax, bx + 16, bx + bw - 16);
          c.save(); c.globalAlpha = K.clamp(a.alpha, 0, 1); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 12;
          c.beginPath(); c.roundRect ? c.roundRect(bx, by, bw, bh, 12) : c.rect(bx, by, bw, bh);
          c.moveTo(tx - 8, by + bh); c.lineTo(tx, Math.min(by + bh + fs * 0.8, Math.max(top - 2, by + bh + 8))); c.lineTo(tx + 8, by + bh);
          c.fillStyle = 'rgba(20,28,56,.95)'; c.fill(); c.shadowBlur = 0; c.strokeStyle = 'rgba(111,194,255,.7)'; c.lineWidth = 1.5; c.stroke();
          c.fillStyle = INK; c.font = '600 ' + fs + 'px ' + FUENTE; lns.forEach((l, i) => c.fillText(l, bx + bw / 2, by + pad * 0.55 + lh * (i + 0.5)));
          c.restore();
        }
        c.restore();
      }

      function update(St) {
        S = St; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalAlpha = 1;
        if (!bg) hacerFondo();
        if (sueloY == null) {
          const ys = []; for (const id in S.actores) { const a = S.actores[id]; if (SUELO.indexOf(a.tipo) >= 0) ys.push(a.def && a.def.pos ? K.num(a.def.pos[1], a.y) : a.y); }
          ys.sort((a, b) => a - b); sueloY = ys.length ? ys[Math.floor(ys.length / 2)] : -1;
        }
        cam = { z: K.clamp(S.camara.zoom, 0.3, 6), cx: S.camara.cx, cy: S.camara.cy };
        c.drawImage(bg, 0, 0, W, H);
        if (sueloY >= 0) suelo();
        trayectorias();
        const lista = Object.keys(S.actores).map((id) => S.actores[id]).sort((a, b) => a.orden - b.orden);
        lista.forEach((a) => { if (a.visible && a.resaltado > 0.01) resalta(a); });
        lista.forEach((a) => { if (a.visible) actor(a); });
        particulas(); viajeros(); vectores(); bocadillos();
      }

      return {
        update,
        resize(w, h) { W = w; H = h; dpr = Math.min(2, window.devicePixelRatio || 1); L.resize(w, h, dpr); bg = null; },
        dispose() { L.cv.remove(); bg = null; },
      };
    },
  });
})();
