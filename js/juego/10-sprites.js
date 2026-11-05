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
    if (p.inv > 0 && !p.muriendo && Math.floor(t * 14) % 2 === 0) return;
    const px = (p.x + p.w / 2) * T - 8 - cx, py = (p.y + p.h) * T - 16 - cy + 1;
    J.dibujarVolteado(ctx, img, px, py, p.dir < 0);
    if (!p.muriendo) S.dibujarAtomo(ctx, px + 8, py - 3, t);
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
})();
