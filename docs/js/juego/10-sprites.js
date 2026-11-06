// =====================================================================================
// 10-sprites.js — todo el pixel-art del juego, generado por código (sin imágenes externas)
//   · Ato (robot-científico redondo, casco-burbuja, átomo orbitando) 16x16 con poses
//   · 6 "skins" originales de enemigos-error (12x12) elegidos por hash del id
//   · objetos: coleccionable-fórmula, resorte, checkpoint, portal-meta, palanca, engranajes
// Diseños 100 % propios. Nada de personajes de ninguna franquicia.
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const S = (J.Sprites = {});
  const OUT = '#0b1230';

  // ---------- Ato: trama de 16x16 píxeles construida con formas simples ----------
  function construirAto(p) {
    const b = new Array(256).fill(null);
    const P = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < 16 && y >= 0 && y < 16) b[y * 16 + x] = c; };
    const R = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(x + i, y + j, c); };
    const E = (cx, cy, rx, ry, c) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) P(x, y, c); };
    const bob = p.bob || 0;
    const f1 = p.pie1 || { dx: 0, dy: 0 }, f2 = p.pie2 || { dx: 0, dy: 0 };
    const a1 = p.brazo1 || { dx: 0, dy: 0 }, a2 = p.brazo2 || { dx: 0, dy: 0 };
    // brazos (sobresalen del cuerpo)
    R(0 + a1.dx, 10 + bob + a1.dy, 3, 3, '#c9d3ea'); R(13 + a2.dx, 10 + bob + a2.dy, 3, 3, '#c9d3ea');
    // cuerpo redondo
    E(8, 10.9 + bob, 5.8, 3.0, '#eef2fa');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (b[y * 16 + x] === '#eef2fa' && y >= 12 + bob) b[y * 16 + x] = '#b8c4de';
    // pies (encima del cuerpo para que se vean al correr)
    R(4 + f1.dx, 13 + f1.dy, 3, 2, '#2b3a6b'); R(9 + f2.dx, 13 + f2.dy, 3, 2, '#2b3a6b');
    // luz del pecho
    R(7, 12, 2, 2, '#ffb020'); P(7, 12, '#fff1b0');
    // casco-burbuja: aro claro + pantalla oscura
    E(8, 6 + bob, 6, 5.2, '#bfeeff');
    E(8, 6.1 + bob, 5, 4.3, '#16275a');
    P(4, 3 + bob, '#ffffff'); P(5, 2 + bob, '#ffffff'); P(3, 4 + bob, '#e8fbff');
    // cara
    const ojo = '#6ff0ff', ey = 5 + bob;
    if (p.ojos === 'x') { [7, 10].forEach((x) => { P(x, ey, ojo); P(x + 1, ey + 1, ojo); P(x + 1, ey, ojo); P(x, ey + 1, ojo); }); }
    else if (p.ojos === 'abiertos') { [7, 10].forEach((x) => R(x, ey - 1, 2, 3, ojo)); }
    else { [7, 10].forEach((x) => R(x, ey, 1, 2, ojo)); }
    if (p.boca === 'o') R(9, 8 + bob, 1, 1, ojo); else { P(8, 8 + bob, ojo); P(9, 8 + bob, ojo); P(10, 8 + bob, '#3bb8c9'); }
    // contorno
    const o = b.slice();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (b[y * 16 + x]) continue;
      if ((x > 0 && b[y * 16 + x - 1]) || (x < 15 && b[y * 16 + x + 1]) || (y > 0 && b[(y - 1) * 16 + x]) || (y < 15 && b[(y + 1) * 16 + x])) o[y * 16 + x] = OUT;
    }
    const c = J.canvas(16, 16), x = c.getContext('2d');
    for (let i = 0; i < 256; i++) if (o[i]) { x.fillStyle = o[i]; x.fillRect(i % 16, (i / 16) | 0, 1, 1); }
    return c;
  }

  // ---------- skins de enemigos (12x12). O contorno, A principal, B sombra, C acento, W blanco, K negro ----------
  const ESKINS = [
    { nombre: 'slime', pal: { A: '#43d17a', B: '#238a4f', C: '#b6f7cf' }, arte: [
      '............', '....OOOO....', '...OAAAAO...', '..OACAAAAO..', '.OAAAAAAAAO.', '.OAOAAAAOAO.',
      '.OAWKAAWKAO.', '.OAAAAAAAAO.', '.OAKAKAKAAO.', 'OAAAAAAAAAAO', 'OBBBBBBBBBBO', '.OOOOOOOOOO.'] },
    { nombre: 'bicho', pal: { A: '#ff3da6', B: '#a8176d', C: '#ffb3dc' }, arte: [
      '.O........O.', '..O..OO..O..', '...OOAAOO...', '..OAAAAAAO..', '.OAWKAAWKAO.', '.OAAAAAAAAO.',
      'OABAAAAAABAO', 'OAAAABBAAAAO', 'OAABAAAABAAO', '.OAAAAAAAAO.', 'O.OO.OO.OO.O', 'O..O....O..O'] },
    { nombre: 'calculadora', pal: { A: '#ffb020', B: '#b36b00', C: '#9be8a8' }, arte: [
      '.OOOOOOOOOO.', 'OAAAAAAAAAAO', 'OAOOOOOOOOAO', 'OAOCCCCCCOAO', 'OAOCWKCWKOAO', 'OAOCCKKKCOAO',
      'OAOOOOOOOOAO', 'OABABABABAAO', 'OAAAAAAAAAAO', 'OBBBBBBBBBBO', '.OO......OO.', '.OO......OO.'] },
    { nombre: 'fantasma', pal: { A: '#a98bff', B: '#6a47d6', C: '#e3d9ff' }, arte: [
      '....OOOO....', '..OOAAAAOO..', '.OAAAAAAAAO.', 'OAAAAAAAAAAO', 'OAAWWAAWWAAO', 'OAAWKAAWKAAO',
      'OAAAAAAAAAAO', 'OAAAKKKKAAAO', 'OAAAAAAAAAAO', 'OAAAAAAAAAAO', 'OAOAAOAAOAAO', '.O.OO.OO.OO.'] },
    { nombre: 'cíclope', pal: { A: '#2ec4e6', B: '#1478a0', C: '#b5f1ff' }, arte: [
      '..OO....OO..', '..OAO..OAO..', '..OAOOOOAO..', '.OAAAAAAAAO.', 'OAAAWWWWAAAO', 'OAAWWKKWWAAO',
      'OAAWWKKWWAAO', 'OAAAWWWWAAAO', 'OAAAAAAAAAAO', 'OABBBBBBBBAO', '.OAAO..OAAO.', '.OOO....OOO.'] },
    { nombre: 'matraz', pal: { A: '#ffd166', B: '#c98a10', C: '#fff0b8', W: '#e8fbff' }, arte: [
      '....OOOO....', '....OWWO....', '....OWWO....', '....OWWO....', '...OWWWWO...', '..OWWWWWWO..',
      '.OWAAAAAAWO.', '.OAWKAAWKAO.', '.OAAAAAAAAO.', '.OABBBBBBAO.', '..OOOOOOOO..', '..O.O..O.O..'] },
  ];
  S.NSKINS = ESKINS.length;

  const cache = { ato: null, ene: [] };

  /** Construye todos los sprites (se llama en cada mount; es barato). */
  S.init = function () {
    if (cache.ato) return;
    const a = {};
    const pie = (dx, dy) => ({ dx, dy });
    a.idle = [construirAto({ bob: 0 }), construirAto({ bob: 1 })];
    a.correr = [
      construirAto({ pie1: pie(2, 0), pie2: pie(-2, 0), brazo1: pie(-1, 0), brazo2: pie(1, -1), bob: 0 }),
      construirAto({ pie1: pie(0, 0), pie2: pie(0, -1), brazo1: pie(0, 0), brazo2: pie(0, 0), bob: 1 }),
      construirAto({ pie1: pie(-2, 0), pie2: pie(2, 0), brazo1: pie(1, -1), brazo2: pie(-1, 0), bob: 0 }),
      construirAto({ pie1: pie(0, -1), pie2: pie(0, 0), brazo1: pie(0, 0), brazo2: pie(0, 0), bob: 1 }),
    ];
    a.saltar = construirAto({ pie1: pie(1, -1), pie2: pie(-1, -1), brazo1: pie(-1, -3), brazo2: pie(1, -3), ojos: 'abiertos', boca: 'o' });
    a.caer = construirAto({ pie1: pie(-1, 0), pie2: pie(1, 0), brazo1: pie(-1, -1), brazo2: pie(1, -1), ojos: 'abiertos', boca: 'o', bob: 1 });
    a.morir = [
      construirAto({ pie1: pie(-1, -1), pie2: pie(1, -1), brazo1: pie(-1, -3), brazo2: pie(1, -3), ojos: 'x', boca: 'o' }),
      construirAto({ pie1: pie(1, 0), pie2: pie(-1, 0), brazo1: pie(0, -2), brazo2: pie(0, -2), ojos: 'x', boca: 'o', bob: 1 }),
    ];
    cache.ato = a;
    cache.ene = ESKINS.map((k) => J.arte(k.arte, Object.assign({ O: '#10131f', W: '#ffffff', K: '#10131f' }, k.pal)));
  };

  /** Dibuja a Ato. p: jugador; (cx,cy): cámara en píxeles. */
  S.dibujarAto = function (ctx, p, t, cx, cy) {
    const a = cache.ato, T = J.T;
    let img;
    if (p.muriendo) img = a.morir[Math.floor(p.tMuerte * 6) % 2];
    else if (!p.suelo) img = p.vy < -1 ? a.saltar : a.caer;
    else if (Math.abs(p.vx) > 0.6) img = a.correr[Math.floor(p.tAnim * 11) % 4];
    else img = a.idle[Math.floor(t * 2.2) % 2];
    // parpadeo de invulnerabilidad
    if (p.inv > 0 && !p.muriendo && !(p.estrella > 0) && Math.floor(t * 14) % 2 === 0) return;
    const px = (p.x + p.w / 2) * T - 8 - cx, py = (p.y + p.h) * T - 16 - cy + 1;
    ctx.save();
    if (p.grande) { ctx.translate(px + 8, py + 16); ctx.scale(1.4, 1.4); ctx.translate(-(px + 8), -(py + 16)); }
    J.dibujarVolteado(ctx, img, px, py, p.dir < 0);
    if (!p.muriendo) S.dibujarAtomo(ctx, px + 8, py - 3, t);
    ctx.restore();
  };

  /** El átomo que orbita sobre la cabeza de Ato: núcleo + 2 electrones en órbitas inclinadas. */
  S.dibujarAtomo = function (ctx, x, y, t) {
    x = Math.round(x); y = Math.round(y);
    // órbitas tenues
    ctx.fillStyle = 'rgba(111,240,255,.22)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 2), 1, 1);
      ctx.fillRect(Math.round(x + Math.cos(a + 0.8) * 5), Math.round(y + Math.sin(a + 0.8) * 3.2), 1, 1);
    }
    ctx.fillStyle = '#ffb020'; ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.fillStyle = '#fff1b0'; ctx.fillRect(x - 1, y - 1, 1, 1);
    const w = t * 4.2;
    ctx.fillStyle = '#6ff0ff';
    ctx.fillRect(Math.round(x + Math.cos(w) * 6), Math.round(y + Math.sin(w) * 2), 1, 1);
    ctx.fillRect(Math.round(x + Math.cos(w) * 6) + (Math.sin(w) > 0 ? -1 : 1), Math.round(y + Math.sin(w) * 2), 1, 1);
    ctx.fillStyle = '#ff3da6';
    ctx.fillRect(Math.round(x + Math.cos(-w * 1.3 + 2) * 5), Math.round(y + Math.sin(-w * 1.3 + 2 + 0.8) * 3.2), 1, 1);
  };

  /** Enemigo-error. e: {x,y,w,h,dir,skin,muertoT}. */
  S.dibujarEnemigo = function (ctx, e, t, cx, cy) {
    const T = J.T, img = cache.ene[e.skin % cache.ene.length];
    const px = e.x * T + (e.w * T - 12) / 2 - cx, py = (e.y + e.h) * T - 12 - cy;
    if (e.muertoT > 0) {   // aplastado
      ctx.globalAlpha = Math.max(0, 1 - e.muertoT / 0.5);
      ctx.drawImage(img, 0, 0, 12, 12, Math.round(px), Math.round(py + 9), 12, 3);
      ctx.globalAlpha = 1; return;
    }
    const bob = Math.floor(t * 5 + e.x) % 2;
    J.dibujarVolteado(ctx, img, px, py - (e.suelo ? bob : 0), Math.floor(t * 3 + e.x) % 2 === 0);
  };

  // ---------- objetos ----------
  /** Coleccionable-fórmula: gema girando con destellos. (x,y) en píxeles de pantalla (centro). */
  S.dibujarFormula = function (ctx, x, y, t, tema, fase) {
    const bob = Math.round(Math.sin(t * 3 + fase) * 2), cw = Math.abs(Math.cos(t * 2.2 + fase));
    y += bob;
    const halo = 0.18 + 0.1 * Math.sin(t * 4 + fase);
    ctx.fillStyle = tema.pal.acento; ctx.globalAlpha = halo;
    ctx.fillRect(Math.round(x - 8), Math.round(y - 4), 16, 8); ctx.fillRect(Math.round(x - 4), Math.round(y - 8), 8, 16); ctx.globalAlpha = 1;
    for (let dy = -6; dy <= 5; dy++) {
      const half = Math.max(1, Math.round((6 - Math.abs(dy + 0.5)) * (0.35 + 0.65 * cw)));
      ctx.fillStyle = OUT; ctx.fillRect(Math.round(x - half - 1), Math.round(y + dy), half * 2 + 2, 1);
    }
    for (let dy = -5; dy <= 4; dy++) {
      const half = Math.max(1, Math.round((5 - Math.abs(dy + 0.5)) * (0.35 + 0.65 * cw)));
      ctx.fillStyle = dy < 0 ? '#e8fbff' : tema.pal.acento; ctx.fillRect(Math.round(x - half), Math.round(y + dy), half * 2, 1);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x - 1), Math.round(y - 3), 2, 2);
    if (Math.floor(t * 3 + fase) % 3 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x + 7), Math.round(y - 6), 1, 3); ctx.fillRect(Math.round(x + 6), Math.round(y - 5), 3, 1); }
  };

  /** Resorte (cell de 16x16 en pantalla). c: compresión 0..1. */
  S.dibujarResorte = function (ctx, x, y, c) {
    const base = y + 16 - 2, h = Math.round(9 - c * 5), top = base - h - 2;
    ctx.fillStyle = OUT; ctx.fillRect(x + 1, base - 1, 14, 3); ctx.fillRect(x + 1, top - 1, 14, 4);
    ctx.fillStyle = '#7d8bb3'; ctx.fillRect(x + 2, base, 12, 2);
    ctx.fillStyle = '#ff3da6'; ctx.fillRect(x + 2, top, 12, 2); ctx.fillStyle = '#ffa6d6'; ctx.fillRect(x + 2, top, 12, 1);
    ctx.fillStyle = '#cfd8f0';
    const n = 4;
    for (let i = 0; i < n; i++) { const yy = top + 2 + Math.round((h * i) / n); ctx.fillRect(x + 4 + (i % 2) * 4, yy, 6, 1); ctx.fillRect(x + 4 + (i % 2) * 4 + (i % 2 ? 0 : 5), yy, 1, Math.max(1, Math.round(h / n))); }
  };

  /** Checkpoint: poste con bandera de átomo. (x,y): base en píxeles. */
  S.dibujarCheckpoint = function (ctx, x, y, activo, t) {
    ctx.fillStyle = OUT; ctx.fillRect(x + 6, y - 31, 4, 32);
    ctx.fillStyle = '#9fb0d9'; ctx.fillRect(x + 7, y - 30, 2, 30);
    ctx.fillStyle = activo ? '#2ee59d' : '#5b6b92';
    for (let i = 0; i < 12; i++) {
      const w = 10 - Math.abs(i - 5) * 1.3;
      ctx.fillRect(x + 9, y - 30 + i, Math.max(1, Math.round(w + (activo ? Math.sin(t * 6 + i * 0.4) : 0))), 1);
    }
    ctx.fillStyle = activo ? '#fff' : '#98a6cc'; ctx.fillRect(x + 12, y - 25, 2, 2);
    ctx.fillStyle = '#ffb020'; ctx.fillRect(x + 6, y - 33, 4, 3);
  };

  /** Portal de meta (2x3 tiles = 32x48). bloqueado: barrera de energía roja. */
  S.dibujarMeta = function (ctx, x, y, t, tema, bloqueado, abrir) {
    // (x,y): esquina superior izquierda en pantalla
    const pal = tema.pal;
    ctx.fillStyle = OUT; ctx.fillRect(x, y, 32, 48);
    ctx.fillStyle = pal.marco; ctx.fillRect(x + 1, y + 1, 30, 46);
    ctx.fillStyle = OUT; ctx.fillRect(x + 4, y + 6, 24, 42);
    // interior: remolino de órbitas
    ctx.fillStyle = '#05081a'; ctx.fillRect(x + 5, y + 7, 22, 41);
    const cxp = x + 16, cyp = y + 28;
    for (let k = 0; k < 3; k++) {
      const ang = t * (1.2 + k * 0.5) + k * 1.1;
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const ex = Math.cos(a) * (10 - k * 1.5), ey = Math.sin(a) * (3.2 + k * 4.2);
        const rx = ex * Math.cos(ang) - ey * Math.sin(ang), ry = ex * Math.sin(ang) + ey * Math.cos(ang);
        ctx.fillStyle = k === 0 ? pal.acento : k === 1 ? pal.acento2 : '#ffffff';
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(a * 2 + t * 3 + k);
        ctx.fillRect(Math.round(cxp + rx * 0.9), Math.round(cyp + ry), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffb020'; ctx.fillRect(cxp - 2, cyp - 2, 4, 4); ctx.fillStyle = '#fff1b0'; ctx.fillRect(cxp - 2, cyp - 2, 2, 2);
    if (bloqueado) {   // barrera de energía
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = (Math.floor(t * 8) + i) % 2 ? '#ff4d6d' : '#8a1d35';
        ctx.fillRect(x + 6 + i * 4, y + 7, 2, 41);
      }
    }
  };

  /** Palanca de Entropía. activa: 0 (arriba/rojo) .. 1 (abajo/verde); lista: ya se puede usar. */
  S.dibujarPalanca = function (ctx, x, y, estado, lista, t) {
    // (x,y): esquina superior izquierda de la casilla 16x16
    ctx.fillStyle = OUT; ctx.fillRect(x + 1, y + 11, 14, 5);
    ctx.fillStyle = '#7d8bb3'; ctx.fillRect(x + 2, y + 12, 12, 4);
    const ang = (-0.9 + 1.8 * estado), len = 11;
    const bx = x + 8, by = y + 12, tx = bx + Math.sin(ang) * len, ty = by - Math.cos(ang) * len;
    ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#cfd8f0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = estado > 0.5 ? '#2ee59d' : lista ? (Math.floor(t * 6) % 2 ? '#ffd166' : '#ff9f1c') : '#ff4d6d';
    ctx.fillRect(Math.round(tx) - 2, Math.round(ty) - 2, 5, 5);
  };

  /** Engranaje de píxeles: n dientes, radio r, rotación rot. */
  S.engranaje = function (ctx, cx, cy, r, n, rot, color, hueco) {
    ctx.fillStyle = color;
    for (let y = -r - 2; y <= r + 2; y++) for (let x = -r - 2; x <= r + 2; x++) {
      const d = Math.hypot(x, y);
      if (d > r + 2.5) continue;
      const a = Math.atan2(y, x) - rot;
      const diente = Math.cos(a * n) > 0.2 ? 2.2 : 0;
      if (d <= r - 0.5 + diente && d >= (hueco || 0)) ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  };

  // =====================================================================================
  // Quiz Quest: bloque ?, tubería de laboratorio, puerta-portal, premios, enemigos acuáticos
  // =====================================================================================
  const GLIFO_Q = ['.XXX.', 'X...X', '....X', '..XX.', '..X..', '.....', '..X..'];

  /** Bloque ? : cristal facetado violeta/cian con «?» brillante. estado: listo | abierto | cerrado. (x,y) = esquina en pantalla. */
  S.dibujarBloque = function (ctx, x, y, estado, t, bump) {
    y -= Math.round(Math.sin(Math.min(1, bump) * Math.PI) * 4);
    x = Math.round(x); y = Math.round(y);
    const viva = estado === 'listo' || estado === 'preguntando';
    const pal = viva ? { a: '#8f5bff', b: '#5d2fd6', c: '#b995ff', d: '#35d6ff', e: '#7ff3ff' }
      : estado === 'abierto' ? { a: '#4a4a78', b: '#33335a', c: '#5d5d90', d: '#3a3a66', e: '#6a6aa0' }
      : { a: '#6b3a48', b: '#4a2430', c: '#85505e', d: '#3a1e28', e: '#a05a6a' };
    ctx.fillStyle = OUT; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = pal.a; ctx.fillRect(x + 1, y + 1, 14, 14);
    // facetas: arriba-izquierda clara (cian), arriba-derecha media, abajo oscura
    for (let i = 0; i < 6; i++) { ctx.fillStyle = pal.d; ctx.fillRect(x + 1, y + 1 + i, 6 - i, 1); }
    for (let i = 0; i < 6; i++) { ctx.fillStyle = pal.c; ctx.fillRect(x + 15 - (6 - i), y + 1 + i, 6 - i, 1); }
    for (let i = 0; i < 6; i++) { ctx.fillStyle = pal.b; ctx.fillRect(x + 1 + i, y + 14 - i, 14 - 2 * i, 1); }
    ctx.fillStyle = pal.e; ctx.fillRect(x + 1, y + 1, 5, 1); ctx.fillRect(x + 1, y + 1, 1, 5);
    ctx.fillStyle = pal.b; ctx.fillRect(x + 14, y + 8, 1, 6); ctx.fillRect(x + 8, y + 14, 6, 1);
    if (viva) {
      const br = 0.6 + 0.4 * Math.sin(t * 5 + x * 0.3);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + 0.25 * br) + ')'; ctx.fillRect(x + 3, y + 3, 10, 10);
      for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (GLIFO_Q[j][i] === 'X') {
        ctx.fillStyle = OUT; ctx.fillRect(x + 5 + i + 1, y + 4 + j + 1, 1, 1);
        ctx.fillStyle = br > 0.8 ? '#ffffff' : '#e8fbff'; ctx.fillRect(x + 5 + i, y + 4 + j, 1, 1);
      }
      if (Math.floor(t * 2 + x) % 4 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 12, y + 2, 1, 3); ctx.fillRect(x + 11, y + 3, 3, 1); }
    } else if (estado === 'cerrado') {   // agrietado
      ctx.fillStyle = OUT; [[3, 2], [4, 4], [5, 6], [4, 8], [6, 10], [7, 12], [9, 7], [10, 5], [12, 4]].forEach(([a, b]) => ctx.fillRect(x + a, y + b, 1, 2));
    } else { ctx.fillStyle = pal.e; ctx.fillRect(x + 6, y + 6, 4, 4); ctx.fillStyle = pal.b; ctx.fillRect(x + 7, y + 7, 2, 2); }
  };

  /** Tubería de laboratorio de 2 tiles de ancho: cuerpo metálico, brida, válvula y luz de estado.
   *  px,py: esquina superior izquierda (boca); alto en tiles; estado: cerrada | abierta | agotada | salida. */
  S.dibujarTuberia = function (ctx, px, py, alto, estado, t) {
    px = Math.round(px); py = Math.round(py);
    const h = alto * 16, w = 32;
    ctx.fillStyle = OUT; ctx.fillRect(px - 2, py, w + 4, 8); ctx.fillRect(px, py + 7, w, h - 7);
    ctx.fillStyle = '#3aa6b8'; ctx.fillRect(px - 1, py + 1, w + 2, 6);
    ctx.fillStyle = '#7fe3f0'; ctx.fillRect(px - 1, py + 1, w + 2, 2);
    ctx.fillStyle = '#1f6f82'; ctx.fillRect(px - 1, py + 6, w + 2, 1);
    ctx.fillStyle = '#2a8aa0'; ctx.fillRect(px + 1, py + 8, w - 2, h - 8);
    ctx.fillStyle = '#5fc6d6'; ctx.fillRect(px + 3, py + 8, 4, h - 8);
    ctx.fillStyle = '#1b5e70'; ctx.fillRect(px + w - 7, py + 8, 6, h - 8);
    // boca oscura con brillo según estado
    const luz = estado === 'abierta' || estado === 'salida' ? '#2ee59d' : estado === 'agotada' ? '#ff4d6d' : '#ffb020';
    ctx.fillStyle = '#05081a'; ctx.fillRect(px + 3, py + 2, w - 6, 3);
    ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 4); ctx.fillStyle = luz; ctx.fillRect(px + 6, py + 3, w - 12, 1); ctx.globalAlpha = 1;
    // tornillos de la brida
    ctx.fillStyle = OUT; [2, 8, 22, 28].forEach((o) => ctx.fillRect(px + o, py + 6, 2, 1));
    // válvula en el cuerpo (si hay sitio) y ventanilla con luz
    if (alto >= 2) {
      const vy = py + 8 + Math.floor((h - 8) / 2);
      ctx.fillStyle = OUT; ctx.fillRect(px + 10, vy - 6, 12, 12);
      ctx.fillStyle = '#0b2a35'; ctx.fillRect(px + 11, vy - 5, 10, 10);
      ctx.fillStyle = luz; ctx.globalAlpha = 0.85; ctx.fillRect(px + 13, vy - 3, 6, 6); ctx.globalAlpha = 1;
      const a = estado === 'abierta' ? t * 2 : 0.4;
      ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px + 16 - Math.cos(a) * 8, vy - Math.sin(a) * 8); ctx.lineTo(px + 16 + Math.cos(a) * 8, vy + Math.sin(a) * 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + 16 + Math.sin(a) * 8, vy - Math.cos(a) * 8); ctx.lineTo(px + 16 - Math.sin(a) * 8, vy + Math.cos(a) * 8); ctx.stroke();
    }
    ctx.fillStyle = OUT; ctx.fillRect(px + 15, py + h - 2, 2, 2);
  };

  /** Puerta-portal: marco de piedra con barrera de energía y runa «?». disolver 0..1 al abrirse. */
  S.dibujarPuerta = function (ctx, px, py, alto, t, disolver, marco, eq) {
    px = Math.round(px); py = Math.round(py);
    const h = alto * 16;
    ctx.globalAlpha = 1 - (disolver || 0);
    ctx.fillStyle = OUT; ctx.fillRect(px, py, 16, h);
    ctx.fillStyle = marco || '#5b6b92'; ctx.fillRect(px + 1, py, 3, h); ctx.fillRect(px + 12, py, 3, h);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(px + 1, py, 1, h);
    ctx.fillStyle = '#0a0f2a'; ctx.fillRect(px + 4, py, 8, h);
    for (let i = 0; i < 8; i++) {     // barrera de energía vertical que ondula
      const o = Math.sin(t * 5 + i * 0.9) * 0.5 + 0.5;
      ctx.fillStyle = i % 2 ? 'rgba(111,240,255,' + (0.35 + 0.4 * o) + ')' : 'rgba(181,140,255,' + (0.35 + 0.4 * o) + ')';
      ctx.fillRect(px + 4 + i, py + 1, 1, h - 2);
    }
    const cy = py + Math.floor(h / 2);
    ctx.fillStyle = OUT; ctx.fillRect(px + 3, cy - 6, 10, 12);
    ctx.fillStyle = '#35d6ff'; ctx.fillRect(px + 4, cy - 5, 8, 10);
    ctx.fillStyle = '#0a0f2a'; ctx.fillRect(px + 5, cy - 4, 6, 8);
    if (eq) { ctx.fillStyle = '#fff'; ctx.fillRect(px + 5, cy - 3, 6, 1); ctx.fillRect(px + 5, cy, 6, 1); ctx.fillRect(px + 9, cy - 4, 1, 1); ctx.fillRect(px + 10, cy - 3, 1, 1); ctx.fillRect(px + 6, cy + 1, 1, 1); ctx.fillRect(px + 5, cy + 2, 1, 1); ctx.fillRect(px + 5, cy + 3, 1, 1); }
    else for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (GLIFO_Q[j][i] === 'X') { ctx.fillStyle = '#fff'; ctx.fillRect(px + 5 + i * 0.99, cy - 4 + j * 0.99, 1, 1); }
    ctx.fillStyle = marco || '#5b6b92'; ctx.fillRect(px, py, 16, 2);
    ctx.globalAlpha = 1;
  };

  const PREMIOS = {
    moneda: { arte: ['..XXXX..', '.XYYYYX.', 'XYYZZYYX', 'XYZYYZYX', 'XYZYYZYX', 'XYYZZYYX', '.XYYYYX.', '..XXXX..'], pal: { X: '#7a4a00', Y: '#ffd166', Z: '#fff3b8' } },
    vida: { arte: ['.XX..XX.', 'XYYXXYYX', 'XYZYYYYX', 'XYYYYYYX', '.XYYYYX.', '..XYYX..', '...XX...', '........'], pal: { X: '#5a0a1a', Y: '#ff4d6d', Z: '#ffc2cf' } },
    pista: { arte: ['..XXXX..', '.XYYYYX.', 'XYZYYYYX', 'XYZYYYYX', '.XYYYYX.', '..XWWX..', '..XXXX..', '...XX...'], pal: { X: '#6b5200', Y: '#ffe27a', Z: '#fffbe0', W: '#9fb0d9' } },
    escudo: { arte: ['XXXXXXXX', 'XYYZYYYX', 'XYZYYYYX', 'XYYYYYYX', '.XYYYYX.', '.XYYYYX.', '..XYYX..', '...XX...'], pal: { X: '#0b4a60', Y: '#35d6ff', Z: '#d8fbff' } },
    estrella: { arte: ['...XX...', '...XX...', 'XXXYYXXX', '.XYZZYX.', '..XYYX..', '.XYXXYX.', '.XX..XX.', '........'], pal: { X: '#8a5a00', Y: '#ffe27a', Z: '#ffffff' } },
    reloj: { arte: ['..XXXX..', '.XYYYYX.', 'XYYWYYYX', 'XYYWYYYX', 'XYYWWWYX', 'XYYYYYYX', '.XYYYYX.', '..XXXX..'], pal: { X: '#2a2a5a', Y: '#e8f0ff', W: '#ff4d6d' } },
  };
  const premioCache = {};
  /** Icono de premio 8x8 (se escala x1.5 al dibujarlo). */
  S.dibujarPremio = function (ctx, tipo, x, y, esc) {
    const k = PREMIOS[tipo] || PREMIOS.moneda;
    if (!premioCache[tipo]) premioCache[tipo] = J.arte(k.arte, k.pal);
    const e = esc || 1.5, im = premioCache[tipo];
    ctx.drawImage(im, Math.round(x - 4 * e), Math.round(y - 4 * e), Math.round(8 * e), Math.round(8 * e));
  };

  /** Enemigos acuáticos (medusa, pez, erizo, anguila) dibujados con primitivas animadas. e: {x,y,w,h,acuatico,dir,ph}. */
  S.dibujarAcuatico = function (ctx, e, t, cx, cy) {
    const T = J.T, px = Math.round(e.x * T - cx), py = Math.round(e.y * T - cy), w = Math.round(e.w * T), h = Math.round(e.h * T);
    const a = t * 6 + e.ph * 3;
    if (e.muertoT > 0) ctx.globalAlpha = Math.max(0, 1 - e.muertoT / 0.5);
    if (e.acuatico === 'medusa') {
      ctx.fillStyle = OUT; ctx.fillRect(px + 1, py, w - 2, 9); ctx.fillRect(px, py + 2, w, 6);
      ctx.fillStyle = '#d98cff'; ctx.fillRect(px + 2, py + 1, w - 4, 7); ctx.fillRect(px + 1, py + 3, w - 2, 4);
      ctx.fillStyle = '#f2c9ff'; ctx.fillRect(px + 3, py + 2, 4, 2);
      ctx.fillStyle = OUT; ctx.fillRect(px + 4, py + 5, 2, 2); ctx.fillRect(px + w - 6, py + 5, 2, 2);
      for (let i = 0; i < 4; i++) { const tx = px + 2 + i * 3; for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#b25be0' : '#d98cff'; ctx.fillRect(tx + Math.round(Math.sin(a + i + k * 0.7) * 1.5), py + 9 + k, 1, 1); } }
      if (Math.floor(t * 4 + e.ph) % 3 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(px + w - 3, py + 1, 1, 1); }
    } else if (e.acuatico === 'pez') {
      const d = e.dir >= 0 ? 1 : -1, bx = d > 0 ? px : px + w;
      const X = (o, ww) => (d > 0 ? bx + o : bx - o - ww);
      ctx.fillStyle = OUT; ctx.fillRect(X(2, 11), py + 3, 11, 9); ctx.fillRect(X(0, 3), py + 4 + Math.round(Math.sin(a) * 1), 3, 7);
      ctx.fillStyle = '#ff9f1c'; ctx.fillRect(X(3, 9), py + 4, 9, 7); ctx.fillStyle = '#ffd166'; ctx.fillRect(X(4, 7), py + 4, 7, 2);
      ctx.fillStyle = '#ff9f1c'; ctx.fillRect(X(0, 3), py + 5 + Math.round(Math.sin(a) * 1), 2, 5);
      ctx.fillStyle = '#fff'; ctx.fillRect(X(9, 2), py + 5, 2, 2); ctx.fillStyle = OUT; ctx.fillRect(X(10, 1), py + 6, 1, 1);
      ctx.fillStyle = '#e26a00'; ctx.fillRect(X(5, 1), py + 7, 1, 3); ctx.fillRect(X(7, 1), py + 7, 1, 3);
    } else if (e.acuatico === 'erizo') {
      const c = px + w / 2, m = py + h / 2;
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) { const an = (i / 10) * Math.PI * 2 + Math.sin(a * 0.3) * 0.1; ctx.beginPath(); ctx.moveTo(c + Math.cos(an) * 4, m + Math.sin(an) * 4); ctx.lineTo(c + Math.cos(an) * 8, m + Math.sin(an) * 8); ctx.stroke(); }
      ctx.strokeStyle = '#ff5d8f'; ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) { const an = (i / 10) * Math.PI * 2 + Math.sin(a * 0.3) * 0.1; ctx.beginPath(); ctx.moveTo(c + Math.cos(an) * 4, m + Math.sin(an) * 4); ctx.lineTo(c + Math.cos(an) * 7.5, m + Math.sin(an) * 7.5); ctx.stroke(); }
      J.Temas.disco(ctx, c, m, 5, OUT); J.Temas.disco(ctx, c, m, 4, '#6a2a8a');
      ctx.fillStyle = '#fff'; ctx.fillRect(c - 3, m - 2, 2, 2); ctx.fillRect(c + 1, m - 2, 2, 2); ctx.fillStyle = '#ff4d6d'; ctx.fillRect(c - 2, m + 1, 4, 1);
    } else {   // anguila
      const d = e.dir >= 0 ? 1 : -1;
      for (let i = 9; i >= 0; i--) {
        const sx = px + (d > 0 ? w - 3 - i * 2 : 3 + i * 2) - (d > 0 ? 0 : 0), sy = py + 6 + Math.round(Math.sin(a * 0.8 - i * 0.7) * 3);
        ctx.fillStyle = OUT; ctx.fillRect(sx - 1, sy - 1, 4, 6);
        ctx.fillStyle = i % 2 ? '#b8e03a' : '#7fc21e'; ctx.fillRect(sx, sy, 3, 4);
      }
      const hx = px + (d > 0 ? w - 3 : 3), hy = py + 6 + Math.round(Math.sin(a * 0.8) * 3);
      ctx.fillStyle = '#fff'; ctx.fillRect(hx + (d > 0 ? 1 : 0), hy, 2, 2); ctx.fillStyle = OUT; ctx.fillRect(hx + (d > 0 ? 2 : 0), hy + 1, 1, 1);
      ctx.fillStyle = '#ffe27a'; ctx.fillRect(hx + (d > 0 ? 2 : -1), hy + 3, 2, 1);
    }
    ctx.globalAlpha = 1;
  };

  // =====================================================================================
  // Ladrillo de cerámica de laboratorio, plantas carnívoras de ácido
  // =====================================================================================
  /** Ladrillo de cerámica/cristal esmaltado (propio): dos baldosas con junta, brillo diagonal y remaches. */
  S.dibujarLadrillo = function (ctx, x, y, pal, bump) {
    x = Math.round(x); y = Math.round(y - Math.sin(Math.min(1, bump || 0) * Math.PI) * 4);
    const base = J.mezcla(pal.marco, '#8fd8e8', 0.45), osc = J.mezcla(pal.marco, '#0b1230', 0.35), luz = '#ffffff';
    ctx.fillStyle = OUT; ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = base; ctx.fillRect(x + 1, y + 1, 14, 14);
    ctx.fillStyle = OUT; ctx.fillRect(x + 1, y + 7, 14, 1); ctx.fillRect(x + 7, y + 1, 1, 6); ctx.fillRect(x + 3, y + 8, 1, 7); ctx.fillRect(x + 11, y + 8, 1, 7);   // juntas
    ctx.fillStyle = osc; ctx.fillRect(x + 1, y + 14, 14, 1); ctx.fillRect(x + 14, y + 8, 1, 6); ctx.fillRect(x + 6, y + 6, 1, 1);
    // esmalte: brillo diagonal en cada baldosa
    ctx.fillStyle = luz; [[2, 2], [3, 2], [2, 3], [9, 2], [10, 2], [9, 3], [5, 9], [4, 9], [4, 10], [12, 9], [13, 9], [12, 10]].forEach(([a, b]) => ctx.fillRect(x + a, y + b, 1, 1));
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x + 1, y + 1, 6, 2); ctx.fillRect(x + 8, y + 1, 6, 2);
  };

  /** Planta carnívora ácida: tallo con espinas, bulbo turquesa con dos mandíbulas, colmillos y gotas de ácido.
   *  (cx, baseY): píxeles de pantalla donde nace; alt 0..1 = cuánto ha salido. Se recorta por debajo de baseY. */
  S.dibujarPlanta = function (ctx, cx, baseY, alt, t, mordiendo) {
    if (alt <= 0.02) return;
    cx = Math.round(cx); baseY = Math.round(baseY);
    ctx.save(); ctx.beginPath(); ctx.rect(cx - 20, baseY - 60, 40, 60 + 2); ctx.clip();
    const subida = Math.round(26 * alt), abre = mordiendo ? 0.5 + 0.5 * Math.sin(t * 16) : 0.4 + 0.2 * Math.sin(t * 5);
    const hy = baseY - subida + 8;                    // centro del bulbo
    // tallo
    for (let y = baseY + 2; y > hy + 4; y -= 2) { const o = Math.round(Math.sin(t * 3 + y * 0.2) * 1); ctx.fillStyle = OUT; ctx.fillRect(cx - 3 + o, y - 2, 6, 3); ctx.fillStyle = '#2a8a4a'; ctx.fillRect(cx - 2 + o, y - 2, 4, 2); }
    ctx.fillStyle = '#1b5a30'; ctx.fillRect(cx + 2, baseY - Math.round(subida * 0.45), 4, 2); ctx.fillRect(cx - 6, baseY - Math.round(subida * 0.7), 4, 2);   // espinas
    const gap = Math.round(3 + abre * 7);
    // mandíbula inferior
    ctx.fillStyle = OUT; ctx.fillRect(cx - 9, hy + gap - 1, 18, 7);
    ctx.fillStyle = '#1d9a8a'; ctx.fillRect(cx - 8, hy + gap, 16, 5); ctx.fillStyle = '#0f5a56'; ctx.fillRect(cx - 8, hy + gap + 3, 16, 2);
    ctx.fillStyle = '#ffffff'; [-6, -2, 2, 6].forEach((o) => ctx.fillRect(cx + o - 1, hy + gap - 3, 2, 3));        // colmillos inferiores
    // interior de la boca
    ctx.fillStyle = '#ff3da6'; ctx.fillRect(cx - 7, hy - 1, 14, gap + 1);
    ctx.fillStyle = '#9b1f66'; ctx.fillRect(cx - 5, hy + 1, 10, Math.max(1, gap - 2));
    // mandíbula superior (cúpula) con manchas
    ctx.fillStyle = OUT; ctx.fillRect(cx - 9, hy - 9, 18, 9); ctx.fillRect(cx - 7, hy - 11, 14, 3);
    ctx.fillStyle = '#25b8a4'; ctx.fillRect(cx - 8, hy - 9, 16, 8); ctx.fillRect(cx - 6, hy - 10, 12, 2);
    ctx.fillStyle = '#7ff0dc'; ctx.fillRect(cx - 6, hy - 9, 5, 2);
    ctx.fillStyle = '#9dff3a'; ctx.fillRect(cx + 2, hy - 7, 3, 3); ctx.fillRect(cx - 4, hy - 5, 2, 2);
    ctx.fillStyle = '#ffffff'; [-6, -2, 2, 6].forEach((o) => ctx.fillRect(cx + o - 1, hy - 1, 2, 3));              // colmillos superiores
    ctx.fillStyle = '#ffe27a'; ctx.fillRect(cx - 3, hy - 7, 2, 2); ctx.fillRect(cx + 3, hy - 7, 2, 2);               // ojitos
    // gotas de ácido que caen de la boca
    for (let i = 0; i < 3; i++) { const f = (t * 1.5 + i * 0.37) % 1; ctx.fillStyle = '#b6ff3a'; ctx.fillRect(cx - 6 + i * 6, Math.round(hy + gap + 5 + f * 9), 1, 2); }
    ctx.restore();
  };

  // =====================================================================================
  // Etapa 1: parkour (mina, prensa, péndulo, cinta, pinchos, bloque de onda, cartel) y química (átomos, estación, interruptor)
  // =====================================================================================
  /** Mina «radical libre»: esfera oscura con un electrón desapareado que orbita. estado: lista | armada. (cx,cy) = centro. */
  S.dibujarMina = function (ctx, cx, cy, estado, t, k) {
    cx = Math.round(cx); cy = Math.round(cy);
    const rapido = estado === 'armada', pul = 0.5 + 0.5 * Math.sin(t * (rapido ? 22 : 4) + k);
    ctx.fillStyle = rapido ? 'rgba(255,60,60,' + (0.25 + 0.3 * pul) + ')' : 'rgba(255,61,166,' + (0.12 + 0.15 * pul) + ')';
    J.Temas.disco(ctx, cx, cy, 9 + Math.round(pul * 2), ctx.fillStyle);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.fillStyle = OUT; ctx.fillRect(Math.round(cx + Math.cos(a) * 6) - 1, Math.round(cy + Math.sin(a) * 6) - 1, 3, 3); }
    J.Temas.disco(ctx, cx, cy, 6, OUT); J.Temas.disco(ctx, cx, cy, 5, rapido && pul > 0.5 ? '#ff4d4d' : '#2a1648');
    ctx.fillStyle = rapido ? '#fff' : '#ff3da6'; ctx.fillRect(cx - 1, cy - 1, 3, 3);
    const a = t * (rapido ? 9 : 3) + k;   // el electrón desapareado
    ctx.fillStyle = '#ffe27a'; ctx.fillRect(Math.round(cx + Math.cos(a) * 8) - 1, Math.round(cy + Math.sin(a) * 3.5) - 1, 3, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(cx + Math.cos(a) * 8), Math.round(cy + Math.sin(a) * 3.5), 1, 1);
  };

  /** Prensa hidráulica: vástago desde el techo, cabeza con franjas de aviso. x,y,w en píxeles de pantalla; yCabeza = borde superior de la cabeza. */
  S.dibujarPrensa = function (ctx, x, yMontaje, yCabeza, w, aviso, t) {
    x = Math.round(x); yMontaje = Math.round(yMontaje); yCabeza = Math.round(yCabeza);
    ctx.fillStyle = OUT; ctx.fillRect(x, yMontaje - 4, w, 6); ctx.fillStyle = '#5a6a8c'; ctx.fillRect(x + 1, yMontaje - 3, w - 2, 4);
    for (let i = 0; i < Math.max(1, Math.floor(w / 24)); i++) {   // vástagos
      const rx = x + Math.round(((i + 0.5) * w) / Math.max(1, Math.floor(w / 24))) - 3;
      ctx.fillStyle = OUT; ctx.fillRect(rx - 1, yMontaje, 8, Math.max(0, yCabeza - yMontaje)); ctx.fillStyle = '#9fb0d9'; ctx.fillRect(rx, yMontaje, 6, Math.max(0, yCabeza - yMontaje)); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(rx + 1, yMontaje, 1, Math.max(0, yCabeza - yMontaje));
    }
    const h = 16;
    ctx.fillStyle = OUT; ctx.fillRect(x - 1, yCabeza, w + 2, h); ctx.fillStyle = '#6b7aa0'; ctx.fillRect(x, yCabeza + 1, w, h - 2);
    ctx.fillStyle = '#8fa0c8'; ctx.fillRect(x, yCabeza + 1, w, 3);
    for (let i = 0; i < w; i += 8) { ctx.fillStyle = (i / 8) % 2 ? '#ffd166' : '#1a1f3a'; ctx.fillRect(x + i, yCabeza + h - 5, 8, 3); }   // franjas de peligro
    ctx.fillStyle = aviso && Math.floor(t * 14) % 2 ? '#ff4d6d' : '#2a3560'; ctx.fillRect(x + 3, yCabeza + 6, 3, 3); ctx.fillRect(x + w - 6, yCabeza + 6, 3, 3);   // remaches/luces
  };

  /** Péndulo-maza: cuerda desde el pivote (px,py) hasta la maza (mx,my). */
  S.dibujarPendulo = function (ctx, px, py, mx, my, t) {
    px = Math.round(px); py = Math.round(py); mx = Math.round(mx); my = Math.round(my);
    const n = Math.max(2, Math.round(Math.hypot(mx - px, my - py) / 3));
    for (let i = 0; i <= n; i++) { const q = i / n; ctx.fillStyle = i % 2 ? '#6b7aa0' : '#aab6d6'; ctx.fillRect(Math.round(px + (mx - px) * q) - 1, Math.round(py + (my - py) * q) - 1, 2, 2); }
    ctx.fillStyle = OUT; ctx.fillRect(px - 3, py - 3, 7, 7); ctx.fillStyle = '#ffd166'; ctx.fillRect(px - 2, py - 2, 5, 5);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + t * 1.5; ctx.fillStyle = OUT; ctx.fillRect(Math.round(mx + Math.cos(a) * 8) - 1, Math.round(my + Math.sin(a) * 8) - 1, 3, 3); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(Math.round(mx + Math.cos(a) * 8), Math.round(my + Math.sin(a) * 8), 1, 1); }
    J.Temas.disco(ctx, mx, my, 7, OUT); J.Temas.disco(ctx, mx, my, 6, '#7d8bb3'); J.Temas.disco(ctx, mx - 1, my - 1, 3, '#cfd8f0');
    ctx.fillStyle = 'rgba(255,77,109,' + (0.5 + 0.4 * Math.sin(t * 6)) + ')'; ctx.fillRect(mx - 1, my + 1, 3, 3);
  };

  /** Cinta transportadora (un tile 16x16 en (x,y)); v = velocidad con signo. */
  S.dibujarCinta = function (ctx, x, y, v, t, primera, ultima) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = OUT; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = '#2a3560'; ctx.fillRect(x, y + 1, 16, 8);
    ctx.fillStyle = '#4a5a8c'; ctx.fillRect(x, y + 1, 16, 2);
    const off = Math.floor(((t * Math.abs(v) * 8) % 8) * (v < 0 ? -1 : 1) + 8) % 8;
    for (let i = -8; i < 16; i += 8) {   // chevrones que avanzan
      const cx = x + i + off; ctx.fillStyle = '#ffd166';
      for (let k = 0; k < 4; k++) { const px = cx + (v > 0 ? k : 3 - k); if (px >= x && px < x + 16) ctx.fillRect(px, y + 3 + k, 1, 1), ctx.fillRect(px, y + 7 - k, 1, 1); }
    }
    ctx.fillStyle = '#10163a'; ctx.fillRect(x, y + 9, 16, 7);
    for (const rx of [x + 4, x + 12]) { J.Temas.disco(ctx, rx, y + 12, 3, '#6b7aa0'); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(rx - 1 + Math.round(Math.cos(t * v * 4)), y + 11 + Math.round(Math.sin(t * v * 4)), 1, 1); }
  };

  /** Pinchos metálicos en una casilla (x,y esquina). */
  S.dibujarPicos = function (ctx, x, y) {
    x = Math.round(x); y = Math.round(y);
    for (let i = 0; i < 3; i++) {
      const bx = x + 1 + i * 5;
      ctx.fillStyle = OUT; ctx.fillRect(bx, y + 10, 5, 6); ctx.fillRect(bx + 1, y + 7, 3, 3); ctx.fillRect(bx + 2, y + 5, 1, 2);
      ctx.fillStyle = '#b8c4de'; ctx.fillRect(bx + 1, y + 11, 3, 5); ctx.fillRect(bx + 2, y + 8, 1, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + 1, y + 11, 1, 5);
      ctx.fillStyle = '#ff4d6d'; ctx.fillRect(bx + 2, y + 6, 1, 2);
    }
    ctx.fillStyle = OUT; ctx.fillRect(x, y + 15, 16, 1);
  };

  /** Bloque de onda (rebote): cristal con ondas concéntricas; comp = compresión 0..1. */
  S.dibujarRebote = function (ctx, x, y, t, comp) {
    x = Math.round(x); y = Math.round(y + Math.round(comp * 3));
    const alto = 16 - Math.round(comp * 3);
    ctx.fillStyle = OUT; ctx.fillRect(x, y, 16, alto); ctx.fillStyle = '#3a9aff'; ctx.fillRect(x + 1, y + 1, 14, alto - 2);
    ctx.fillStyle = '#7ff3ff'; ctx.fillRect(x + 1, y + 1, 14, 2); ctx.fillStyle = '#1f5fc0'; ctx.fillRect(x + 1, y + alto - 3, 14, 2);
    for (let k = 0; k < 3; k++) {   // ondas que salen hacia arriba
      const f = (t * 1.2 + k / 3) % 1, w = 3 + Math.round(f * 9);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * (1 - f)) + ')'; ctx.fillRect(x + 8 - w, y + 4 + Math.round((1 - f) * 3), w * 2, 1);
    }
    ctx.fillStyle = '#fff'; ctx.fillRect(x + 7, y + 7 - Math.round(comp * 2), 2, 4); ctx.fillRect(x + 5, y + 9, 6, 1);   // flecha ↑
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 6, y + 6, 4, 1);
  };

  /** Cartel tutorial: poste con tablón e «i». (x,y) = esquina de la casilla. */
  S.dibujarCartel = function (ctx, x, y, cerca, t) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = OUT; ctx.fillRect(x + 7, y + 8, 3, 8); ctx.fillRect(x + 1, y + 1, 14, 10);
    ctx.fillStyle = '#7a4a1a'; ctx.fillRect(x + 8, y + 9, 1, 7); ctx.fillStyle = cerca ? '#ffe9b0' : '#d9b36a'; ctx.fillRect(x + 2, y + 2, 12, 8);
    ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x + 2, y + 9, 12, 1);
    ctx.fillStyle = '#1b5e70'; ctx.fillRect(x + 7, y + 3, 2, 2); ctx.fillRect(x + 7, y + 6, 2, 3);
    if (!cerca && Math.floor(t * 2) % 2) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 13, y, 1, 3); ctx.fillRect(x + 12, y + 1, 3, 1); }
  };

  const CPK = { H: ['#f5f7ff', '#b8c0d8'], C: ['#4a4a55', '#22222a'], N: ['#4a6bff', '#2236a8'], O: ['#ff4d4d', '#b01c1c'], F: ['#9dff7a', '#4a9a2a'], Cl: ['#3ee05a', '#1a8a30'], Na: ['#a56bff', '#5a2bb0'], S: ['#ffe14a', '#b09a10'], P: ['#ff9f1c', '#b0600a'], Li: ['#c9a0ff', '#7a50b0'], K: ['#b080ff', '#5a2ba0'], Ca: ['#6adf8a', '#2a8a4a'], Mg: ['#7adf3a', '#3a8a10'], Br: ['#b03a2a', '#601410'], I: ['#9a2ad6', '#4a1080'], Al: ['#b8c4de', '#6a768f'], Fe: ['#d9853a', '#8a4a10'], Cu: ['#e0883a', '#8a4a18'] };
  S.colorCPK = (el) => (CPK[el] || ['#cfd8f0', '#7d8bb3'])[0];
  /** Átomo recogible: esfera CPK con brillo y la letra del elemento. (cx,cy) = centro en pantalla. */
  S.dibujarAtomo3 = function (ctx, cx, cy, el, t, fase) {
    const [c1, c2] = CPK[el] || ['#cfd8f0', '#7d8bb3'];
    cx = Math.round(cx); cy = Math.round(cy + Math.sin(t * 3 + fase) * 2);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.1 + 0.08 * Math.sin(t * 4 + fase)) + ')'; J.Temas.disco(ctx, cx, cy, 9, ctx.fillStyle);
    J.Temas.disco(ctx, cx, cy, 7, OUT); J.Temas.disco(ctx, cx, cy, 6, c2); J.Temas.disco(ctx, cx - 1, cy - 1, 5, c1);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(cx - 3, cy - 4, 2, 2);
    ctx.font = '6px PixelHUD, monospace'; ctx.fillStyle = OUT; ctx.fillText(el.length > 1 ? el[0] : el, cx - 2, cy + 3);
  };

  /** Estación de moléculas: mesa de laboratorio con holograma. lista = el jugador tiene los átomos. */
  S.dibujarEstacion = function (ctx, x, y, lista, hecha, t, formula) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = OUT; ctx.fillRect(x, y + 7, 16, 9); ctx.fillStyle = '#4a5a8c'; ctx.fillRect(x + 1, y + 8, 14, 7); ctx.fillStyle = '#8fa0c8'; ctx.fillRect(x + 1, y + 8, 14, 2);
    ctx.fillStyle = hecha ? '#2ee59d' : lista ? '#ffd166' : '#ff4d6d'; ctx.fillRect(x + 6, y + 11, 4, 2);
    ctx.fillStyle = OUT; ctx.fillRect(x + 4, y + 5, 8, 3); ctx.fillStyle = '#35d6ff'; ctx.fillRect(x + 5, y + 6, 6, 1);
    const a = t * 2.4, col = hecha ? '#2ee59d' : '#35d6ff';   // holograma: 3 esferas orbitando
    for (let i = 0; i < 3; i++) { const q = a + (i * Math.PI * 2) / 3; ctx.fillStyle = col; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(q); ctx.fillRect(x + 7 + Math.round(Math.cos(q) * 5), y + 1 + Math.round(Math.sin(q) * 2), 2, 2); }
    ctx.globalAlpha = 1;
  };

  /** Interruptor de estado: panel con lámpara del color del valor actual. */
  S.dibujarInterruptor = function (ctx, x, y, color, t) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = OUT; ctx.fillRect(x + 3, y + 2, 10, 14); ctx.fillStyle = '#4a5a8c'; ctx.fillRect(x + 4, y + 3, 8, 12); ctx.fillStyle = '#8fa0c8'; ctx.fillRect(x + 4, y + 3, 8, 2);
    ctx.fillStyle = OUT; ctx.fillRect(x + 5, y + 6, 6, 6); ctx.fillStyle = color; ctx.fillRect(x + 6, y + 7, 4, 4);
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 5); J.Temas.disco(ctx, x + 8, y + 9, 7, color); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd166'; ctx.fillRect(x + 7, y + 13, 2, 1);
  };

  /** Losa de plataforma de estado (16x8 por tile). activa=false -> fantasma discontinuo. */
  S.dibujarPlatEstado = function (ctx, x, y, largo, color, activa, t, etiqueta) {
    x = Math.round(x); y = Math.round(y);
    if (!activa) {
      ctx.fillStyle = color; ctx.globalAlpha = 0.28;
      for (let i = 0; i < largo * 16; i += 4) ctx.fillRect(x + i, y + 1, 2, 1), ctx.fillRect(x + i, y + 6, 2, 1);
      ctx.fillRect(x, y + 1, 1, 6); ctx.fillRect(x + largo * 16 - 1, y + 1, 1, 6); ctx.globalAlpha = 1; return;
    }
    for (let i = 0; i < largo; i++) {
      const px = x + i * 16;
      ctx.fillStyle = OUT; ctx.fillRect(px, y, 16, 8); ctx.fillStyle = color; ctx.fillRect(px, y + 1, 16, 5); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(px, y + 1, 16, 1);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(px, y + 5, 16, 1);
      if (Math.floor(t * 3 + i) % 4 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(px + 4 + ((i * 5) % 8), y + 2, 1, 1); }
    }
  };
})();
