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
    // ---- temas con identidad propia (cada capítulo elige el suyo con tema_visual) ----
    caverna: { estilo: 'cueva', musica: 'base', pal: { cielo0: '#0a0814', cielo1: '#1d1536', acento: '#b48cff', acento2: '#4cf0c8', marco: '#4a3d6a', fillA: '#2a2140', fillB: '#33294f', linea: '#150f24', top: '#6a5a96', top2: '#4a3d6a', plat: '#4a3d6a', platLuz: '#cdb8ff', hz0: '#4a9aff', hz1: '#0b2a5a', hzTop: '#bfe0ff', texto: '#eaf0ff' } },
    'mina-uranio': { estilo: 'cueva', musica: 'base', pal: { cielo0: '#06120a', cielo1: '#12301a', acento: '#7dff4a', acento2: '#ffe27a', marco: '#3a4a2a', fillA: '#1c2a1a', fillB: '#243822', linea: '#0c160c', top: '#5a7a3a', top2: '#3a5a2a', plat: '#3a4a2a', platLuz: '#c9ff9a', hz0: '#7dff4a', hz1: '#2a7a1a', hzTop: '#d8ffb8', texto: '#eaf0ff' } },
    'pista-hielo-newton': { estilo: 'hielo', musica: 'cielo', pal: { cielo0: '#0a1a3a', cielo1: '#7ac8f0', acento: '#9fe7ff', acento2: '#ffffff', marco: '#6a9ac8', fillA: '#3a6a9a', fillB: '#4a7aaa', linea: '#2a4a74', top: '#e8f8ff', top2: '#b8e0f8', plat: '#8ac0e8', platLuz: '#ffffff', hz0: '#4a9aff', hz1: '#0b3a7a', hzTop: '#d0ecff', texto: '#0b1230' } },
    'espacio-orbital': { estilo: 'espacio', musica: 'cielo', pal: { cielo0: '#02030d', cielo1: '#1a1040', acento: '#6ff0ff', acento2: '#ffb020', marco: '#3a4a7a', fillA: '#1a2040', fillB: '#222a54', linea: '#0b0f26', top: '#8aa0d0', top2: '#5a6aa0', plat: '#3a4a7a', platLuz: '#cfe0ff', hz0: '#9b5de5', hz1: '#2a1070', hzTop: '#e0c8ff', texto: '#eaf0ff' } },
    'horno-termico': { estilo: 'horno', musica: 'lava', pal: { cielo0: '#1a0804', cielo1: '#5a2008', acento: '#ffb020', acento2: '#ff4d2e', marco: '#4a3a34', fillA: '#2e211c', fillB: '#3a2a24', linea: '#140a08', top: '#8a6a4a', top2: '#5a4a3a', plat: '#5a4a3a', platLuz: '#ffd9a0', hz0: '#ff9f1c', hz1: '#8a2a0a', hzTop: '#ffe27a', texto: '#eaf0ff' } },
    'laboratorio-verde': { estilo: 'lab', musica: 'lab', pal: { cielo0: '#04140e', cielo1: '#0c3a2a', acento: '#2ee59d', acento2: '#ffe27a', marco: '#1f6a4a', fillA: '#0f2a22', fillB: '#16382c', linea: '#08170f', top: '#2ee59d', top2: '#1aa070', plat: '#1f6a4a', platLuz: '#b6ffe0', hz0: '#ff3da6', hz1: '#5a0f40', hzTop: '#ffc0e0', texto: '#eaf0ff' } },
    'laboratorio-ambar': { estilo: 'lab', musica: 'lab', pal: { cielo0: '#140a04', cielo1: '#3a1a08', acento: '#ffb020', acento2: '#19e3ff', marco: '#7a4a1a', fillA: '#2a1a0c', fillB: '#382412', linea: '#150c04', top: '#ffb020', top2: '#c07a10', plat: '#7a4a1a', platLuz: '#ffe0a0', hz0: '#2ee59d', hz1: '#0b5d46', hzTop: '#b6ffe0', texto: '#eaf0ff' } },
    'laboratorio-violeta': { estilo: 'lab', musica: 'lab', pal: { cielo0: '#0c0420', cielo1: '#2a0f5a', acento: '#b48cff', acento2: '#19e3ff', marco: '#4a2a9a', fillA: '#1a1040', fillB: '#241658', linea: '#0a0620', top: '#b48cff', top2: '#7a52d0', plat: '#4a2a9a', platLuz: '#e0d0ff', hz0: '#ff3da6', hz1: '#5a0f40', hzTop: '#ffc0e0', texto: '#eaf0ff' } },
    'camara-fotoelectrica': { estilo: 'lab', musica: 'lab', pal: { cielo0: '#06061a', cielo1: '#2a1850', acento: '#ffe27a', acento2: '#6ff0ff', marco: '#6a5a1a', fillA: '#1c1a3a', fillB: '#26224c', linea: '#0a0a20', top: '#ffe27a', top2: '#c0a020', plat: '#6a5a1a', platLuz: '#fff0b0', hz0: '#6ff0ff', hz1: '#0b4a5a', hzTop: '#d0faff', texto: '#eaf0ff' } },
    'pista-campo-uniforme': { estilo: 'lab', musica: 'lab', pal: { cielo0: '#030a24', cielo1: '#0a2a6a', acento: '#4a9aff', acento2: '#ff4d6d', marco: '#1a4aaa', fillA: '#0c1c4a', fillB: '#12286a', linea: '#060e2a', top: '#4a9aff', top2: '#2a6ad0', plat: '#1a4aaa', platLuz: '#b0d4ff', hz0: '#ff4d6d', hz1: '#5a1020', hzTop: '#ffc0cc', texto: '#eaf0ff' } },
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
      } else if (def.estilo === 'cueva') {       // roca con vetas y fisuras
        x.fillStyle = alt; for (let i = 0; i < 6; i++) x.fillRect((r() * 13) | 0, (r() * 14) | 0, 2 + ((r() * 3) | 0), 2);
        x.fillStyle = p.linea; for (let i = 0; i < 3; i++) { const a = (r() * 12) | 0, b = (r() * 12) | 0; x.fillRect(a, b, 1, 3); x.fillRect(a + 1, b + 2, 2, 1); }
        if (v) { x.fillStyle = p.acento; x.globalAlpha = 0.7; x.fillRect(5, 6, 1, 1); x.fillRect(11, 11, 1, 1); x.globalAlpha = 1; }
      } else if (def.estilo === 'hielo') {       // hielo: vetas claras y burbujas
        x.fillStyle = alt; for (let i = 0; i < 5; i++) x.fillRect((r() * 12) | 0, (r() * 14) | 0, 3 + ((r() * 4) | 0), 1);
        x.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 4; i++) x.fillRect((r() * 14) | 0, (r() * 14) | 0, 1, 1);
        x.fillStyle = p.linea; x.fillRect(0, 15, 16, 1);
      } else if (def.estilo === 'espacio') {     // paneles metálicos con remaches
        x.fillStyle = p.linea; x.fillRect(0, 0, 16, 1); x.fillRect(0, 0, 1, 16); x.fillRect(0, 8, 16, 1);
        x.fillStyle = alt; x.fillRect(2, 2, 12, 1); x.fillRect(2, 10, 12, 1);
        x.fillStyle = p.top; x.fillRect(2, 5, 1, 1); x.fillRect(13, 5, 1, 1); x.fillRect(2, 13, 1, 1); x.fillRect(13, 13, 1, 1);
        if (v) { x.fillStyle = p.acento; x.fillRect(7, 4, 2, 1); }
      } else if (def.estilo === 'horno') {       // ladrillo refractario con brasas
        x.fillStyle = p.linea; x.fillRect(0, 0, 16, 1); x.fillRect(0, 8, 16, 1); x.fillRect(v ? 5 : 10, 1, 1, 7); x.fillRect(v ? 12 : 4, 9, 1, 7);
        x.fillStyle = alt; for (let i = 0; i < 5; i++) x.fillRect((r() * 14) | 0, (r() * 14) | 0, 2, 1);
        x.fillStyle = 'rgba(255,140,30,.3)'; x.fillRect(v ? 6 : 1, 12, 4, 1); x.fillRect(v ? 2 : 9, 4, 3, 1);
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
      if (def.estilo === 'hielo') { x.fillStyle = '#ffffff'; for (let i = 0; i < 16; i += 4) x.fillRect(i + (v ? 1 : 0), 3, 3, 2); }
      if (def.estilo === 'cueva') { x.fillStyle = p.acento; x.globalAlpha = 0.8; x.fillRect(3 + v * 8, 3, 1, 1); x.fillRect(9 - v * 4, 5, 1, 1); x.globalAlpha = 1; }
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
    } else if (def.estilo === 'cueva') {
      let x = nueva(0.06);      // pared lejana: manchas de roca y esporas luminosas
      for (let i = 0; i < 70; i++) { x.fillStyle = r() < 0.5 ? p.fillA : p.linea; x.globalAlpha = 0.25 + r() * 0.3; const rr = 4 + r() * 16; disco(x, r() * LW, 20 + r() * 230, rr, x.fillStyle); }
      x.globalAlpha = 1; for (let i = 0; i < 50; i++) { x.fillStyle = r() < 0.5 ? p.acento : p.acento2; x.globalAlpha = 0.25 + r() * 0.5; x.fillRect((r() * LW) | 0, (r() * 240) | 0, 1, 1); } x.globalAlpha = 1;
      x = nueva(0.2);           // estalactitas y estalagmitas lejanas
      for (let i = 0; i < 16; i++) { const cx = i * (LW / 16) + r() * 30, hh = 20 + r() * 60, ww = 10 + r() * 14; envolver((ox) => { poli(x, [[cx + ox, 0], [cx + ww + ox, 0], [cx + ww / 2 + ox, hh]], p.linea); poli(x, [[cx + 4 + ox, 288], [cx + ww + 8 + ox, 288], [cx + ww / 2 + 4 + ox, 288 - hh * 0.8]], p.fillA); }); }
      x = nueva(0.4);           // cristales luminosos
      for (let i = 0; i < 10; i++) {
        const bx = 20 + i * 100 + r() * 40, col = r() < 0.5 ? p.acento : p.acento2;
        for (let k = 0; k < 3; k++) { const hh = 14 + r() * 26, ox = bx + k * 7; x.globalAlpha = 0.18; disco(x, ox + 3, 270 - hh / 2, 14, col); x.globalAlpha = 1; poli(x, [[ox, 272], [ox + 3, 272 - hh], [ox + 6, 272]], col); x.fillStyle = '#ffffff'; x.globalAlpha = 0.6; x.fillRect(ox + 2, 272 - hh + 2, 1, 4); x.globalAlpha = 1; }
      }
    } else if (def.estilo === 'hielo') {
      let x = nueva(0.04);      // estrellas y aurora
      for (let i = 0; i < 60; i++) { x.fillStyle = '#fff'; x.globalAlpha = 0.3 + r() * 0.6; x.fillRect((r() * LW) | 0, (r() * 120) | 0, 1, 1); } x.globalAlpha = 1;
      for (let k = 0; k < 3; k++) for (let xx = 0; xx < LW; xx++) { const y = 40 + k * 14 + Math.sin((xx / LW) * Math.PI * 2 * (2 + k)) * 14; x.fillStyle = ['rgba(120,255,200,.14)', 'rgba(120,200,255,.14)', 'rgba(200,160,255,.12)'][k]; x.fillRect(xx, Math.round(y), 1, 26); }
      x = nueva(0.14);          // montañas nevadas
      for (let i = 0; i < 9; i++) { const cx = i * 118 + r() * 40, hh = 70 + r() * 70, ww = 60 + r() * 40; envolver((ox) => { poli(x, [[cx - ww + ox, 262], [cx + ox, 262 - hh], [cx + ww + ox, 262]], '#6a90c0'); poli(x, [[cx - ww * 0.3 + ox, 262 - hh * 0.72], [cx + ox, 262 - hh], [cx + ww * 0.3 + ox, 262 - hh * 0.72]], '#ffffff'); }); }
      x.fillStyle = '#6a90c0'; x.fillRect(0, 262, LW, 26);
      x = nueva(0.34);          // carámbanos colgando y cristales de hielo
      for (let i = 0; i < 18; i++) { const cx = i * 57 + r() * 25, hh = 18 + r() * 52; envolver((ox) => { poli(x, [[cx + ox, 0], [cx + 9 + ox, 0], [cx + 4 + ox, hh]], '#a8d8f8'); poli(x, [[cx + 2 + ox, 0], [cx + 5 + ox, 0], [cx + 3 + ox, hh * 0.7]], '#e8f8ff'); }); }
      for (let i = 0; i < 9; i++) { const bx = 30 + i * 112 + r() * 40; for (let k = 0; k < 3; k++) { const hh = 14 + r() * 24; poli(x, [[bx + k * 7, 276], [bx + k * 7 + 3, 276 - hh], [bx + k * 7 + 6, 276]], k % 2 ? '#9fe7ff' : '#d8f4ff'); } }
      x = nueva(0.55);          // ventisqueros
      for (let xx = 0; xx < LW; xx++) { const y = 268 + Math.sin((xx / LW) * Math.PI * 2 * 6) * 6; x.fillStyle = '#e8f8ff'; x.fillRect(xx, Math.round(y), 1, VH); x.fillStyle = '#b8dcf5'; x.fillRect(xx, Math.round(y) + 3, 1, 1); }
    } else if (def.estilo === 'espacio') {
      let x = nueva(0.03);      // estrellas, nebulosa y planeta anillado
      for (let i = 0; i < 160; i++) { x.fillStyle = r() < 0.15 ? p.acento : '#ffffff'; x.globalAlpha = 0.3 + r() * 0.7; x.fillRect((r() * LW) | 0, (r() * 288) | 0, 1, r() < 0.1 ? 2 : 1); } x.globalAlpha = 1;
      for (let i = 0; i < 6; i++) { x.globalAlpha = 0.07; disco(x, r() * LW, 40 + r() * 160, 40 + r() * 50, i % 2 ? '#9b5de5' : '#4cc9f0'); } x.globalAlpha = 1;
      disco(x, 700, 110, 44, '#3a2a70'); disco(x, 700, 110, 40, '#6a4ab8'); disco(x, 690, 100, 14, '#8a6ad8');
      x.strokeStyle = 'rgba(255,226,122,.6)'; x.lineWidth = 3; x.beginPath(); x.ellipse(700, 110, 72, 16, -0.35, 0, Math.PI * 2); x.stroke();
      x = nueva(0.12);          // asteroides lejanos
      for (let i = 0; i < 14; i++) { const cx = r() * LW, cy = 30 + r() * 200, rr = 5 + r() * 12; poli(x, [[cx - rr, cy], [cx - rr * 0.3, cy - rr * 0.8], [cx + rr * 0.8, cy - rr * 0.4], [cx + rr, cy + rr * 0.3], [cx, cy + rr * 0.8]], '#2a3260'); disco(x, cx - rr * 0.3, cy - rr * 0.2, 2, '#1a2040'); }
      x = nueva(0.3);           // estación orbital lejana: vigas y luces
      for (let i = 0; i < 4; i++) { const bx = 80 + i * 260 + r() * 60, by = 150 + r() * 70; x.fillStyle = '#1a2040'; x.fillRect(bx, by, 90, 6); x.fillRect(bx + 40, by - 40, 6, 80); x.fillStyle = '#2a3a78'; x.fillRect(bx - 28, by - 14, 22, 34); x.fillRect(bx + 96, by - 14, 22, 34); x.fillStyle = p.acento; x.fillRect(bx + 43, by - 40, 1, 1); x.fillStyle = p.acento2; x.fillRect(bx + 2, by + 2, 1, 1); x.fillRect(bx + 86, by + 2, 1, 1); }
    } else if (def.estilo === 'horno') {
      let x = nueva(0.05);      // resplandor del horno
      for (let y = 140; y < 288; y += 4) { x.fillStyle = 'rgba(255,120,20,' + ((y - 140) / 148) * 0.35 + ')'; x.fillRect(0, y, LW, 4); }
      x = nueva(0.18);          // chimeneas y depósitos
      for (let i = 0; i < 7; i++) { const bx = i * 150 + r() * 50, hh = 90 + r() * 80, ww = 22 + r() * 20; x.fillStyle = '#1a0c08'; x.fillRect(bx, 262 - hh, ww, hh + 26); x.fillStyle = '#2a1410'; x.fillRect(bx + 3, 262 - hh, 3, hh + 26); x.fillStyle = '#3a1a10'; x.fillRect(bx - 3, 262 - hh, ww + 6, 5); for (let k = 0; k < 3; k++) { x.fillStyle = r() < 0.6 ? '#ffb020' : '#7a2a10'; x.fillRect(bx + 5 + k * 6, 262 - hh + 14 + k * 18, 3, 5); } }
      x = nueva(0.42);          // red de tuberías con válvulas
      for (let i = 0; i < 6; i++) { const by = 40 + i * 38 + r() * 10; x.fillStyle = '#1a0c08'; x.fillRect(0, by, LW, 7); x.fillStyle = '#4a2a1c'; x.fillRect(0, by + 1, LW, 2); for (let k = 0; k < 8; k++) { const vx = (r() * LW) | 0; x.fillStyle = '#2a140c'; x.fillRect(vx, by - 5, 8, 17); x.fillStyle = p.acento2; x.fillRect(vx + 2, by - 7, 4, 3); } }
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
      else if (tema.estilo === 'cueva') { y = ((a.y - t * a.v * 0.35) % VH + VH) % VH; x = ((a.x + Math.sin(t * 0.7 + a.ph) * 9 - camX * 0.6) % VW + VW) % VW; col = a.s > 1 ? tema.pal.acento2 : tema.pal.acento; }
      else if (tema.estilo === 'hielo') { y = ((a.y + t * a.v * 0.9) % VH); x = ((a.x + Math.sin(t * 0.9 + a.ph) * 12 - camX * 0.6) % VW + VW) % VW; col = '#ffffff'; }
      else if (tema.estilo === 'espacio') { y = a.y; x = ((a.x - camX * 0.3) % VW + VW) % VW; col = a.s > 1 ? tema.pal.acento : '#ffffff'; }
      else if (tema.estilo === 'horno') { y = ((a.y - t * a.v * 2.2) % VH + VH) % VH; x = ((a.x + Math.sin(t * 1.4 + a.ph) * 7 - camX * 0.7) % VW + VW) % VW; col = a.s > 1 ? '#ffd166' : '#ff7a2a'; }
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
