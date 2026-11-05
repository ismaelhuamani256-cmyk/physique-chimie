// =====================================================================================
// 20-temas.js — temas visuales: paleta, tiles, fondo en parallax (varias capas) y peligro de los fosos.
// Temas: 'laboratorio-neon', 'lava-fortaleza', 'cielo-ondas' y un fallback para cualquier otro string.
// Todo se dibuja por código en canvas offscreen una sola vez (al montar) y luego solo se blitea.
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const Temas = (J.Temas = {});
  const VW = 512, VH = 288, LW = 1024;   // ancho de cada capa de parallax (se repite)
  const SOL = (t) => t === 1 || t === 3 || t === 4 || t === 5 || t === 6 || t === 7 || t === 8;   // 5/6/7/8: bloque ?, tubería, puerta (los dibuja 45-quiz.js)

  // ---------- primitivas pixel (sin antialias) ----------
  function poli(ctx, pts, color) {
    ctx.fillStyle = color;
    let y0 = Infinity, y1 = -Infinity;
    pts.forEach((p) => { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5)) xs.push(a[0] + ((y + 0.5 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) ctx.fillRect(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i + 1]) - Math.round(xs[i])), 1);
    }
  }
  function disco(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); }
  }
  function linea(ctx, x0, y0, x1, y1, color, g) {
    ctx.fillStyle = color; g = g || 1;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), g, g);
  }
  /** Cielo en bandas (degradado "pixelado"). */
  function cielo(ctx, c0, c1, h, banda) {
    for (let y = 0; y < h; y += banda) { ctx.fillStyle = J.mezcla(c0, c1, y / h); ctx.fillRect(0, y, LW, banda); }
  }
  /** Ejecuta dibujar(ox) en 3 posiciones para que la capa sea continua al repetirse. */
  function envolver(f) { [-LW, 0, LW].forEach(f); }
  const rngDe = (s) => window.PCB.util.rng(s);

  // ---------- definiciones de tema ----------
  const DEFS = {
    'laboratorio-neon': {
      estilo: 'lab', musica: 'lab',
      pal: { cielo0: '#070b24', cielo1: '#241048', acento: '#19e3ff', acento2: '#ff3da6', marco: '#2a3d9a', fillA: '#141c47', fillB: '#1b2660', linea: '#0d1438', top: '#19e3ff', top2: '#0fa9c4', plat: '#2a3d9a', platLuz: '#7ff3ff', hz0: '#2ee59d', hz1: '#0b5d46', hzTop: '#b6ffe0', texto: '#eaf0ff' },
    },
    'lava-fortaleza': {
      estilo: 'castillo', musica: 'lava',
      pal: { cielo0: '#14040a', cielo1: '#6a1a0e', acento: '#ffb020', acento2: '#ff4d2e', marco: '#5a3236', fillA: '#2a1114', fillB: '#34161a', linea: '#170709', top: '#7a4a4e', top2: '#5a3236', plat: '#5a3236', platLuz: '#ff9f1c', hz0: '#ff5a14', hz1: '#8a1606', hzTop: '#ffe08a', texto: '#ffe9d2' },
    },
    'cielo-ondas': {
      estilo: 'nube', musica: 'cielo',
      pal: { cielo0: '#2a1066', cielo1: '#58c8f5', acento: '#ffe27a', acento2: '#9b5de5', marco: '#6d56c8', fillA: '#4a3a9c', fillB: '#5646b0', linea: '#35287c', top: '#f2eaff', top2: '#cdbfff', plat: '#7d68dc', platLuz: '#ffffff', hz0: '#3a1d86', hz1: '#1a0b4a', hzTop: '#9fe7ff', texto: '#ffffff' },
    },
    submarino: {
      estilo: 'agua', musica: 'agua',
      pal: { cielo0: '#021a38', cielo1: '#0a7a9a', acento: '#ffe27a', acento2: '#ff7aa8', marco: '#2a7a9a', fillA: '#16405a', fillB: '#1d5070', linea: '#0c2a40', top: '#35e0b8', top2: '#1a9a8a', plat: '#e0608a', platLuz: '#ffb3cc', hz0: '#0a2a50', hz1: '#041428', hzTop: '#3a7ab0', texto: '#e8fbff' },
    },
    _fallback: {
      estilo: 'natural', musica: 'base',
      pal: { cielo0: '#0f2f3f', cielo1: '#3aa0a0', acento: '#ffd166', acento2: '#ef476f', marco: '#6a4a2a', fillA: '#4a3420', fillB: '#58402a', linea: '#2e2012', top: '#4ed17a', top2: '#2e9a52', plat: '#8a6a3a', platLuz: '#c9a15e', hz0: '#2a6fd6', hz1: '#143a7a', hzTop: '#bfe0ff', texto: '#ffffff' },
    },
  };

  // ---------- tiles de 16x16 ----------
  function tilesDe(def) {
    const p = def.pal, r = rngDe(J.hash(def.estilo));
    const mk = () => { const c = J.canvas(16, 16); return [c, c.getContext('2d')]; };
    const out = { fill: [], top: [] };
    const textura = (x, base, alt, v) => {
      x.fillStyle = base; x.fillRect(0, 0, 16, 16);
      if (def.estilo === 'lab') {
        x.fillStyle = p.linea; x.fillRect(0, 0, 16, 1); x.fillRect(0, 0, 1, 16); x.fillRect(0, 8, 16, 1); x.fillRect(8, 0, 1, 16);
        x.fillStyle = alt; for (let i = 0; i < 5; i++) x.fillRect((r() * 14) | 0, (r() * 14) | 0, 1, 1);
        if (v) { x.fillStyle = p.acento2; x.fillRect(4, 4, 1, 1); }
      } else if (def.estilo === 'castillo') {
        x.fillStyle = p.linea; x.fillRect(0, 0, 16, 1); x.fillRect(0, 8, 16, 1);
        x.fillRect(v ? 4 : 10, 1, 1, 7); x.fillRect(v ? 12 : 4, 9, 1, 7); x.fillRect(v ? 12 : 0, 9, 1, 7);
        x.fillStyle = alt; for (let i = 0; i < 6; i++) x.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 1);
        if (v) { x.fillStyle = 'rgba(255,120,30,.25)'; x.fillRect(5, 11, 3, 1); }
      } else if (def.estilo === 'nube') {
        x.fillStyle = alt; for (let i = 0; i < 4; i++) { const cx = (r() * 12) | 0, cy = (r() * 12) | 0; x.fillRect(cx, cy, 4, 2); x.fillRect(cx + 1, cy - 1, 2, 1); }
        x.fillStyle = p.linea; x.fillRect(0, 15, 16, 1);
      } else if (def.estilo === 'agua') {
        x.fillStyle = alt; for (let i = 0; i < 7; i++) x.fillRect((r() * 13) | 0, (r() * 14) | 0, 2 + ((r() * 2) | 0), 1);
        x.fillStyle = p.linea; for (let i = 0; i < 4; i++) x.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 2);
        if (v) { x.fillStyle = 'rgba(180,240,255,.35)'; x.fillRect(11, 9, 2, 2); x.fillRect(4, 12, 1, 1); }
      } else {
        x.fillStyle = alt; for (let i = 0; i < 8; i++) x.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 2);
        x.fillStyle = p.linea; for (let i = 0; i < 4; i++) x.fillRect((r() * 14) | 0, (r() * 14) | 0, 1, 1);
      }
    };
    for (let v = 0; v < 2; v++) {
      let [c, x] = mk(); textura(x, v ? p.fillB : p.fillA, p.fillB, v); out.fill.push(c);
      [c, x] = mk(); textura(x, v ? p.fillB : p.fillA, p.fillB, v);
      x.fillStyle = p.top; x.fillRect(0, 0, 16, 3); x.fillStyle = p.top2; x.fillRect(0, 3, 16, 2);
      x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 0, 16, 1);
      if (def.estilo === 'natural') { x.fillStyle = p.top; for (let i = 0; i < 16; i += 3) x.fillRect(i, 5, 2, 1 + (r() * 2 | 0)); }
      if (def.estilo === 'castillo') { x.fillStyle = p.acento2; x.fillRect(2 + v * 7, 4, 3, 1); }
      if (def.estilo === 'agua') { x.fillStyle = p.top; for (let i = 0; i < 16; i += 2) x.fillRect(i, 5, 1, 1 + ((r() * 3) | 0)); }
      out.top.push(c);
    }
    // plataforma flotante: losa fina en la parte superior de la casilla
    let [c, x] = mk();
    x.fillStyle = '#0b1230'; x.fillRect(0, 0, 16, 8);
    x.fillStyle = p.plat; x.fillRect(0, 1, 16, 5); x.fillStyle = p.platLuz; x.fillRect(0, 1, 16, 1);
    x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, 5, 16, 1); x.fillStyle = p.acento; x.fillRect(0, 6, 16, 1);
    x.fillStyle = '#0b1230'; x.fillRect(2, 3, 1, 1); x.fillRect(13, 3, 1, 1);
    out.plat = c;
    // plataforma móvil (distinta: con luz de propulsión)
    [c, x] = mk();
    x.fillStyle = '#0b1230'; x.fillRect(0, 0, 16, 9);
    x.fillStyle = p.acento2; x.fillRect(0, 1, 16, 5); x.fillStyle = '#ffffff'; x.fillRect(0, 1, 16, 1);
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, 5, 16, 1); x.fillStyle = p.acento; x.fillRect(3, 6, 10, 2);
    out.movil = c;
    // plataforma que cae: losa ámbar agrietada con remaches
    [c, x] = mk();
    x.fillStyle = '#0b1230'; x.fillRect(0, 0, 16, 8);
    x.fillStyle = '#c98a3a'; x.fillRect(0, 1, 16, 5); x.fillStyle = '#ffd9a0'; x.fillRect(0, 1, 16, 1);
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, 5, 16, 1); x.fillStyle = '#7a4a1a'; x.fillRect(0, 6, 16, 1);
    x.fillStyle = '#0b1230'; x.fillRect(5, 2, 1, 3); x.fillRect(6, 4, 1, 2); x.fillRect(11, 1, 1, 3); x.fillRect(10, 3, 1, 2);
    out.cae = c;
    // bloque sólido
    [c, x] = mk(); textura(x, p.fillB, p.fillA, 1);
    x.fillStyle = p.top2; x.fillRect(0, 0, 16, 2); x.fillRect(0, 0, 2, 16); x.fillStyle = p.linea; x.fillRect(14, 0, 2, 16); x.fillRect(0, 14, 16, 2);
    out.bloque = c;
    // puente: tablones sobre vigas
    [c, x] = mk();
    x.fillStyle = '#0b1230'; x.fillRect(0, 0, 16, 7);
    x.fillStyle = def.estilo === 'castillo' ? '#8a5a3a' : p.plat; x.fillRect(0, 1, 16, 5);
    x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(0, 1, 16, 1);
    x.fillStyle = '#0b1230'; x.fillRect(7, 1, 1, 5); x.fillRect(15, 1, 1, 5); x.fillStyle = p.acento; x.fillRect(2, 3, 1, 1); x.fillRect(10, 3, 1, 1);
    x.fillStyle = '#0b1230'; x.fillRect(6, 7, 4, 2); x.fillRect(7, 9, 2, 3);
    out.puente = c;
    return out;
  }

  // ---------- capas de fondo ----------
  function capasDe(nombre, def) {
    const p = def.pal, capas = [];
    const nueva = (factor, dy) => { const c = J.canvas(LW, VH); capas.push({ img: c, f: factor, dy: dy || 0 }); return c.getContext('2d'); };
    const r = rngDe(J.hash(nombre) + 7);

    if (def.estilo === 'lab') {
      let x = nueva(0.06);      // estrellas y hexágonos lejanos
      for (let i = 0; i < 90; i++) { x.fillStyle = r() < 0.2 ? p.acento2 : '#6f7fd6'; x.globalAlpha = 0.3 + r() * 0.5; x.fillRect((r() * LW) | 0, (r() * 200) | 0, 1, 1); }
      x.globalAlpha = 1;
      for (let i = 0; i < 8; i++) {
        const cx = (i + 0.5) * (LW / 8) + r() * 40, cy = 40 + r() * 120, R = 14 + r() * 18;
        const pts = []; for (let k = 0; k < 6; k++) pts.push([cx + Math.cos(k * Math.PI / 3) * R, cy + Math.sin(k * Math.PI / 3) * R]);
        x.globalAlpha = 0.5; for (let k = 0; k < 6; k++) linea(x, pts[k][0], pts[k][1], pts[(k + 1) % 6][0], pts[(k + 1) % 6][1], '#1d2a74');
        disco(x, cx, cy, 2, p.acento); x.globalAlpha = 1;
      }
      x = nueva(0.18);          // silueta de material de laboratorio
      let px = 0;
      while (px < LW) {
        const tipo = (r() * 3) | 0, w = 40 + ((r() * 40) | 0), base = 232, col = '#0c1440';
        const liq = J.mezcla(r() < 0.5 ? p.acento2 : '#2ee59d', '#0c1440', 0.6);
        if (tipo === 0) {        // matraz Erlenmeyer
          poli(x, [[px + w / 2 - 5, base - 90], [px + w / 2 + 5, base - 90], [px + w / 2 + 5, base - 60], [px + w - 4, base], [px + 4, base], [px + w / 2 - 5, base - 60]], col);
          poli(x, [[px + w / 2 - 14, base - 30], [px + w / 2 + 14, base - 30], [px + w - 4, base], [px + 4, base]], liq); x.globalAlpha = 0.55; x.globalAlpha = 1;
          linea(x, px + w / 2 - 5, base - 90, px + w / 2 - 5, base - 60, p.acento, 1); linea(x, px + w / 2 - 5, base - 60, px + 4, base, p.acento, 1);
        } else if (tipo === 1) { // vaso de precipitados
          x.fillStyle = col; x.fillRect(px + 6, base - 70, w - 12, 70);
          x.fillStyle = liq; x.fillRect(px + 8, base - 36, w - 16, 36);
          x.fillStyle = p.acento; for (let k = 0; k < 5; k++) x.fillRect(px + 6, base - 70 + k * 12, 5, 1);
        } else {                 // gradilla de tubos
          for (let k = 0; k < 4; k++) { const tx = px + 4 + k * 10, th = 50 + ((r() * 30) | 0); x.fillStyle = col; x.fillRect(tx, base - th, 7, th); x.fillStyle = k % 2 ? liq : p.acento; x.fillRect(tx + 1, base - th / 2, 5, th / 2); }
        }
        px += w + 20 + ((r() * 40) | 0);
      }
      x.fillStyle = '#080d2c'; x.fillRect(0, 232, LW, 56);
      x.fillStyle = p.acento; x.globalAlpha = 0.35; x.fillRect(0, 232, LW, 1); x.globalAlpha = 1;
      x = nueva(0.42);          // tuberías y estructuras moleculares cercanas
      x.fillStyle = '#141f63'; x.fillRect(0, 22, LW, 8); x.fillStyle = '#1f2f8c'; x.fillRect(0, 22, LW, 2);
      for (let i = 0; i < 12; i++) { const jx = i * 90 + 20; x.fillStyle = '#2a3d9a'; x.fillRect(jx, 18, 8, 16); x.fillStyle = p.acento; x.fillRect(jx + 3, 20, 2, 2); }
      for (let i = 0; i < 6; i++) { const cx = 60 + i * 170 + r() * 40; x.fillStyle = '#0f1a55'; x.fillRect(cx, 30, 2, 40 + r() * 60); disco(x, cx + 1, 30 + 60 + r() * 20, 5, '#1d2a74'); }
    } else if (def.estilo === 'castillo') {
      let x = nueva(0.05);
      disco(x, 700, 110, 54, '#3a0d0b'); disco(x, 700, 110, 44, '#5a1510'); disco(x, 700, 110, 34, '#8a2412');
      for (let i = 0; i < 60; i++) { x.fillStyle = '#ff9f1c'; x.globalAlpha = 0.2 + r() * 0.4; x.fillRect((r() * LW) | 0, (r() * 150) | 0, 1, 1); } x.globalAlpha = 1;
      x = nueva(0.14);          // montañas negras
      const pm = [[0, 288]]; for (let i = 0; i <= 16; i++) pm.push([i * 64, 190 + (r() * 60 | 0) - (i % 2 ? 30 : 0)]); pm.push([LW, 288]);
      poli(x, pm, '#220808');
      x = nueva(0.3);           // castillos
      let px = 10;
      while (px < LW) {
        const w = 60 + ((r() * 50) | 0), h = 90 + ((r() * 60) | 0), base = 260;
        x.fillStyle = '#150506'; x.fillRect(px, base - h, w, h);
        for (let k = 0; k < w; k += 10) x.fillRect(px + k, base - h - 6, 6, 6);
        const tw = 16 + ((r() * 8) | 0), th = h + 40;
        x.fillRect(px + w - tw - 4, base - th, tw, th); poli(x, [[px + w - tw - 8, base - th], [px + w - 4 - tw / 2, base - th - 24], [px + w, base - th]], '#1d0809');
        for (let k = 0; k < 4; k++) { x.fillStyle = r() < 0.6 ? '#ff9f1c' : '#7a2a10'; x.fillRect(px + 8 + k * 12, base - h + 18 + ((r() * 40) | 0), 3, 5); }
        px += w + 30 + ((r() * 60) | 0);
      }
      x.fillStyle = '#150506'; x.fillRect(0, 258, LW, 30);
      x = nueva(0.55);          // columnas y cadenas
      for (let i = 0; i < 8; i++) {
        const cx = 40 + i * 128 + (r() * 30 | 0);
        x.fillStyle = '#0d0304'; x.fillRect(cx, 0, 14, VH); x.fillStyle = '#1d0809'; x.fillRect(cx + 2, 0, 3, VH);
        for (let k = 0; k < 7; k++) { x.fillStyle = '#2a0e10'; x.fillRect(cx - 3, k * 44 + 8, 20, 4); }
        if (i % 2) for (let k = 0; k < 16 + ((r() * 30) | 0); k++) { x.fillStyle = k % 2 ? '#4a3a3a' : '#2e2222'; x.fillRect(cx + 26 + (k % 2), k * 4, 2, 3); }
      }
    } else if (def.estilo === 'nube') {
      let x = nueva(0.05);
      disco(x, 760, 90, 40, '#fff3b8'); disco(x, 760, 90, 32, '#ffe27a');
      for (let i = 0; i < 80; i++) { x.fillStyle = '#fff'; x.globalAlpha = 0.3 + r() * 0.6; x.fillRect((r() * LW) | 0, (r() * 160) | 0, 1, 1); } x.globalAlpha = 1;
      x = nueva(0.16);          // nubes
      for (let i = 0; i < 9; i++) {
        const cx = i * 118 + r() * 50, cy = 50 + r() * 120;
        const colNube = J.mezcla(J.mezcla(p.cielo0, p.cielo1, cy / VH), '#ffffff', 0.28);   // opaco: sin manchas al solaparse
        envolver((ox) => { [[0, 0, 22], [24, -6, 26], [52, 2, 20], [22, 8, 24]].forEach(([dx, dy, rr]) => disco(x, cx + dx + ox, cy + dy, rr, colNube)); });
      }
      for (let k = 0; k < 2; k++) {   // ondas lejanas
        x = nueva(0.26 + k * 0.1);
        const col = k ? 'rgba(155,93,229,.55)' : 'rgba(76,201,240,.45)', base = 200 + k * 26;
        for (let xx = 0; xx < LW; xx++) { const y = base + Math.sin((xx / LW) * Math.PI * 2 * (5 + k * 2)) * 14 + Math.sin((xx / LW) * Math.PI * 2 * 11) * 4; x.fillStyle = col; x.fillRect(xx, Math.round(y), 1, VH); }
      }
      x = nueva(0.5);           // onda cercana con crestas
      for (let xx = 0; xx < LW; xx++) {
        const y = 250 + Math.sin((xx / LW) * Math.PI * 2 * 8) * 10;
        x.fillStyle = '#3a1d86'; x.fillRect(xx, Math.round(y), 1, VH);
        x.fillStyle = '#9fe7ff'; x.fillRect(xx, Math.round(y), 1, 1);
      }
    } else if (def.estilo === 'agua') {
      let x = nueva(0.05);      // rayos de luz desde la superficie + peces lejanos
      for (let i = 0; i < 7; i++) {
        const bx = i * 150 + r() * 60, wd = 24 + r() * 30;
        poli(x, [[bx, 0], [bx + wd, 0], [bx + wd - 90, 288], [bx - 90 - wd / 2, 288]], 'rgba(190,240,255,.06)');
      }
      for (let i = 0; i < 12; i++) { const fx = r() * LW, fy = 40 + r() * 140; x.fillStyle = 'rgba(120,200,230,.35)'; x.fillRect(fx | 0, fy | 0, 6, 2); x.fillRect((fx + 6) | 0, (fy - 1) | 0, 2, 4); }
      x = nueva(0.15);          // arrecife y arcos de roca lejanos
      for (let i = 0; i < 9; i++) {
        const cx = i * 118 + r() * 40, base = 262;
        for (let k = 0; k < 4; k++) { const hh = 40 + r() * 80, ww = 6 + r() * 6, ox = cx + k * 14; x.fillStyle = '#0a3450'; x.fillRect(ox, base - hh, ww, hh); x.fillRect(ox - 5, base - hh * 0.7, 6, 5); x.fillRect(ox + ww, base - hh * 0.5, 6, 5); disco(x, ox + ww / 2, base - hh, ww / 2 + 1, '#0a3450'); }
      }
      x.fillStyle = '#0a3450'; x.fillRect(0, 262, LW, 26);
      x = nueva(0.3);           // algas ondulantes y corales
      for (let i = 0; i < 16; i++) {
        const bx = i * 66 + r() * 30, hh = 70 + r() * 110;
        for (let y = 0; y < hh; y += 2) { const o = Math.round(Math.sin(y * 0.09 + i) * 4); x.fillStyle = y % 8 < 4 ? '#0f7a62' : '#0b5f4e'; x.fillRect(bx + o, 270 - y, 4, 2); }
      }
      for (let i = 0; i < 8; i++) { const bx = 30 + i * 125 + r() * 40; for (let k = 0; k < 5; k++) { x.fillStyle = k % 2 ? '#a03a6a' : '#7a2a58'; x.fillRect(bx + k * 4, 252 - ((r() * 18) | 0), 3, 40); disco(x, bx + k * 4 + 1, 252 - 10 - ((r() * 10) | 0), 3, '#c25a8a'); } }
      x = nueva(0.5);           // rocas y anémonas del primer plano
      for (let i = 0; i < 7; i++) {
        const bx = i * 150 + r() * 50, ww = 30 + r() * 40, hh = 20 + r() * 26;
        poli(x, [[bx, 288], [bx + ww * 0.2, 288 - hh], [bx + ww * 0.7, 288 - hh * 0.8], [bx + ww, 288]], '#0b2e48');
        for (let k = 0; k < 4; k++) { const ax = bx + ww * 0.25 + k * 5; x.fillStyle = '#4a2a7a'; x.fillRect(ax, 288 - hh - 8, 2, 10); x.fillStyle = '#6ff0ff'; x.fillRect(ax, 288 - hh - 10, 2, 2); }
      }
    } else {
      let x = nueva(0.06);
      for (let i = 0; i < 40; i++) { x.fillStyle = '#fff'; x.globalAlpha = 0.2 + r() * 0.4; x.fillRect((r() * LW) | 0, (r() * 150) | 0, 1, 1); } x.globalAlpha = 1;
      [[0.15, '#1d6a6a', 180, 40], [0.3, '#1a8a5a', 215, 30], [0.5, '#157a45', 250, 22]].forEach(([f, col, base, amp]) => {
        x = nueva(f);
        for (let xx = 0; xx < LW; xx++) { const y = base + Math.sin((xx / LW) * Math.PI * 2 * (3 + f * 6)) * amp * 0.5 + Math.sin((xx / LW) * Math.PI * 2 * 9) * 6; x.fillStyle = col; x.fillRect(xx, Math.round(y), 1, VH); }
      });
    }
    return capas;
  }

  // ---------- API ----------
  const cache = {};
  /** Devuelve (y cachea) el tema para un nombre de tema_visual. */
  Temas.get = function (nombre) {
    const id = DEFS[nombre] ? nombre : '_fallback';
    if (cache[id]) return cache[id];
    const def = DEFS[id];
    // cielo como primera capa fija
    const sky = J.canvas(VW, VH), sx = sky.getContext('2d');
    for (let y = 0; y < VH; y += 4) { sx.fillStyle = J.mezcla(def.pal.cielo0, def.pal.cielo1, Math.pow(y / VH, 1.3)); sx.fillRect(0, y, VW, 4); }
    const t = { id, estilo: def.estilo, musica: def.musica, pal: def.pal, sky, capas: capasDe(id, def), tiles: tilesDe(def), amb: [] };
    // partículas ambientales (en pantalla)
    const r = rngDe(J.hash(id) + 3);
    for (let i = 0; i < 38; i++) t.amb.push({ x: r() * VW, y: r() * VH, v: 4 + r() * 14, ph: r() * 6.28, s: r() < 0.25 ? 2 : 1 });
    cache[id] = t;
    return t;
  };

  /** Fondo: cielo + capas en parallax + partículas ambientales. */
  Temas.dibujarFondo = function (ctx, tema, camX, camY, t, reducido) {
    ctx.drawImage(tema.sky, 0, 0);
    for (const c of tema.capas) {
      const ox = -Math.floor((camX * c.f) % LW), oy = Math.round(c.dy - camY * c.f * 0.25);
      ctx.drawImage(c.img, ox, oy); ctx.drawImage(c.img, ox + LW, oy);
    }
    if (reducido) return;
    for (const a of tema.amb) {
      let x, y, col;
      if (tema.estilo === 'castillo') { y = ((a.y - t * a.v * 1.5) % VH + VH) % VH; x = (a.x + Math.sin(t + a.ph) * 8 - camX * 0.7 + 4000 * VW) % VW; col = a.s > 1 ? '#ffd166' : '#ff7a2a'; }
      else if (tema.estilo === 'lab') { y = ((a.y - t * a.v * 0.8) % VH + VH) % VH; x = (a.x + Math.sin(t * 0.8 + a.ph) * 6 - camX * 0.6 + 4000 * VW) % VW; col = a.s > 1 ? '#ff3da6' : '#19e3ff'; }
      else if (tema.estilo === 'nube') { y = (a.y + Math.sin(t + a.ph) * 6); x = ((a.x - t * a.v * 0.7 - camX * 0.5) % VW + VW) % VW; col = a.s > 1 ? '#fff' : '#cdbfff'; }
      else if (tema.estilo === 'agua') { y = ((a.y - t * a.v * 1.3) % VH + VH) % VH; x = ((a.x + Math.sin(t * 1.2 + a.ph) * 5 - camX * 0.55) % VW + VW) % VW; col = a.s > 1 ? '#d8f6ff' : '#8fd8f0'; }
      else { y = ((a.y + t * a.v * 0.3) % VH); x = ((a.x - camX * 0.5) % VW + VW) % VW; col = '#ffffff55'; }
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + a.ph);
      ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), a.s, a.s);
    }
    ctx.globalAlpha = 1;
  };

  /** Dibuja los tiles visibles. mundo.get(x,y) da el tipo. */
  Temas.dibujarTiles = function (ctx, mundo, tema, camX, camY) {
    const T = J.T, x0 = Math.floor(camX / T), x1 = Math.ceil((camX + VW) / T), y0 = Math.max(0, Math.floor(camY / T)), y1 = Math.min(mundo.alto - 1, Math.ceil((camY + VH) / T));
    const tl = tema.tiles;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = mundo.get(x, y); if (!t) continue;
      if (t >= 5) continue;   // bloque ?, tubería, puerta: entidades (45-quiz.js)
      const v = (x * 7 + y * 3) & 1;
      let img;
      if (t === 1) img = SOL(mundo.get(x, y - 1)) ? tl.fill[v] : tl.top[v];
      else if (t === 2) img = tl.plat;
      else if (t === 3) img = tl.puente;
      else img = tl.bloque;
      ctx.drawImage(img, x * T - camX, y * T - camY);
    }
  };

  /** Plataformas móviles (rectángulos de largo n). */
  Temas.dibujarMovil = function (ctx, tema, m, camX, camY) {
    const T = J.T;
    for (let i = 0; i < m.largo; i++) ctx.drawImage(tema.tiles.movil, Math.round(m.x * T - camX) + i * T, Math.round(m.y * T - camY));
  };

  /** Peligro bajo los fosos: ácido / lava / vacío, con ola animada. */
  Temas.dibujarPeligro = function (ctx, mundo, tema, camX, camY, t) {
    const T = J.T, p = tema.pal, x0 = Math.floor(camX / T), x1 = Math.ceil((camX + VW) / T);
    const ySup = (mundo.alto - 1.35) * T - camY, yBase = mundo.alto * T - camY;
    if (ySup > VH) return;
    for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0 || cx >= mundo.ancho || mundo.get(cx, mundo.alto - 1)) continue;
      for (let i = 0; i < T; i++) {
        const px = cx * T + i, o = Math.round(Math.sin(t * 2.4 + px * 0.45) * 1.6 + Math.sin(t * 1.3 + px * 0.2));
        const yy = Math.round(ySup + o), sx = Math.round(px - camX);
        ctx.fillStyle = p.hz0; ctx.fillRect(sx, yy, 1, Math.max(0, VH - yy + 8));
        ctx.fillStyle = p.hz1; ctx.fillRect(sx, yy + 8 + (i % 3), 1, Math.max(0, VH - yy));
        ctx.fillStyle = p.hzTop; ctx.fillRect(sx, yy, 1, 1);
      }
      // burbujas / chispas que saltan
      const k = Math.floor(t * 1.7 + cx * 1.3) % 5;
      if (k === 0) { const f = (t * 1.7 + cx * 1.3) % 1; ctx.fillStyle = p.hzTop; ctx.fillRect(Math.round(cx * T + 6 - camX), Math.round(ySup - Math.sin(f * Math.PI) * 14), 2, 2); }
    }
  };

  Temas.poli = poli; Temas.disco = disco; Temas.linea = linea;
})();
