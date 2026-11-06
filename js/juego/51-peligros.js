// =====================================================================================
// 51-peligros.js — PELIGROS NUEVOS del nivel (todo diseño propio; referencias de género, nada copiado)
//   {"tipo":"sierra","x","y","eje":"x|y|o","recorrido","periodo"}   sierra giratoria; fija o recorriendo un raíl (eje x/y) o en círculo (o)
//   {"tipo":"torreta","x","y","periodo","nombre","correccion"}      te apunta y dispara bolas de energía (se pisa o se dispara)
//   {"tipo":"canon_bala","x","y","dir":-1|1,"periodo","retardo"}    cañón que lanza una «bala cometa» gigante (se pisa o se dispara)
//   {"tipo":"geiser","x","y","alto","periodo","retardo"}            columna de lava/ácido/agua que avisa (burbujea) y brota; y = fila del suelo
//   {"tipo":"laser","x","y","eje":"h|v","largo","periodo","retardo"} barrera láser intermitente con parpadeo de aviso
//   {"tipo":"planta_techo","x","largo","ciclo","visible"}            tubería del techo con una planta carnívora que baja a morder
//   Peligros que ya existían (mina, prensa, pendulo, picos, planta_carnivora, estalactita, lluvia_rocas) siguen en 45/46/49.
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const P = J.Peligros = {};
  const T = 16, OUT = '#0b1230', r = Math.round;
  const SOL = (t) => t === 1 || t === 3 || t === 4 || t === 5 || t === 6 || t === 7 || t === 8 || t === 9 || t === 10;
  const D = (...a) => J.Temas.disco(...a), Pl = (...a) => J.Temas.poli(...a);

  // círculo (cx,cy,rad) contra la caja del jugador
  const circuloContra = (p, cx, cy, rad) => { const nx = Math.max(p.x, Math.min(cx, p.x + p.w)), ny = Math.max(p.y, Math.min(cy, p.y + p.h)); return Math.hypot(cx - nx, cy - ny) < rad; };

  P.iniciar = function (g) {
    const S = g.nivel.segmentos || [];
    g.sierras = S.filter((s) => s.tipo === 'sierra').map((s) => ({ bx: s.x + 0.5, by: s.y + 0.5, eje: s.eje || null, rec: s.recorrido || 0, per: s.periodo || 4, cx: s.x + 0.5, cy: s.y + 0.5, ang: (J.hash('s' + s.x + s.y) % 628) / 100 }));
    g.torretas = S.filter((s) => s.tipo === 'torreta').map((s) => ({ x: s.x, y: s.y, w: 1, h: 1, per: s.periodo || 2.6, cd: 1 + (J.hash('t' + s.x) % 100) / 60, estado: 'espera', t: 0, ang: -0.6, vivo: true, muertoT: 0, nombre: s.nombre || 'Error', correccion: s.correccion || '' }));
    g.canones = S.filter((s) => s.tipo === 'canon_bala').map((s) => ({ x: s.x, y: s.y, dir: s.dir === 1 ? 1 : -1, per: s.periodo || 3.6, t: (s.retardo || 0) % (s.periodo || 3.6), cargando: false }));
    g.balas = [];
    g.geiseres = S.filter((s) => s.tipo === 'geiser').map((s) => ({ x: s.x, y: s.y, alto: s.alto || 5, per: s.periodo || 4, ret: s.retardo || 0, k: 0, fase: 'quieto' }));
    g.lasers = S.filter((s) => s.tipo === 'laser').map((s) => ({ x: s.x, y: s.y, eje: s.eje === 'v' ? 'v' : 'h', largo: s.largo || 5, per: s.periodo || 3.6, ret: s.retardo || 0, on: false, aviso: false }));
    g.plantasT = S.filter((s) => s.tipo === 'planta_techo').map((s) => ({ x: s.x, largo: s.largo || 3, ciclo: s.ciclo || 3.4, vis: s.visible || 1.3, fase: (J.hash('pt' + s.x) % 100) / 100, alt: 0 }));
    g.bolasT = [];
    g.llaves = S.filter((s) => s.tipo === 'llave').map((s) => ({ x: s.x + 0.5, y: s.y + 0.5, id: s.id || null, tomada: false, fase: (J.hash('k' + s.x + s.y) % 100) / 16 }));
  };

  /** Disparos del jugador (fotones, fuego, balas): ¿matan algo de aquí? Devuelve true si el disparo se gasta. */
  P.golpe = function (g, px, py, rad) {
    for (const e of g.torretas || []) if (e.vivo && e.muertoT === 0 && Math.hypot(px - (e.x + 0.5), py - (e.y + 0.5)) < rad + 0.5) { P.matarTorreta(g, e); return true; }
    for (const b of g.balas || []) if (!b.muerta && Math.abs(px - b.x) < 0.9 + rad && Math.abs(py - b.y) < 0.6 + rad) { b.muerta = true; J.Audio.sfx('pisoton'); J.chispas(g, b.x * T, b.y * T, 14, '#ffb020', 4); return true; }
    return false;
  };
  P.matarTorreta = function (g, e) { e.muertoT = 0.001; J.Audio.sfx('pisoton'); J.chispas(g, (e.x + 0.5) * T, (e.y + 0.5) * T, 14, '#ffd166', 4); if (g.ui && e.correccion) g.ui.error(e); };

  P.paso = function (g, dt) {
    if (!g.sierras) return;
    const w = g.w, p = g.jugador, F = g.F, t = g.t, pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    for (const k of g.llaves || []) {   // llave dorada: abre las puertas con llave del nivel
      if (k.tomada || p.muriendo || Math.hypot(pcx - k.x, pcy - k.y) > 0.9) continue;
      k.tomada = true; J.Audio.sfx('premio'); J.chispas(g, k.x * T, k.y * T, 16, '#ffd166', 4, 2);
      let abiertas = 0; for (const d of w.puertas) if (d.llave && !d.abierta && (d.llave === true || !k.id || d.llave === k.id)) { J.Quiz.abrirPuerta(g, d); abiertas++; }
      if (g.ui) g.ui.aviso(abiertas ? '¡Llave! Puerta abierta' : '¡Llave!');
    }
    // ---- sierras ----
    for (const s of g.sierras) {
      s.ang += dt * 11;
      if (s.eje) { const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * g.tm) / s.per); if (s.eje === 'x') { s.cx = s.bx + s.rec * k; s.cy = s.by; } else if (s.eje === 'y') { s.cx = s.bx; s.cy = s.by + s.rec * k; } else { const a = (2 * Math.PI * g.tm) / s.per; s.cx = s.bx + Math.cos(a) * s.rec; s.cy = s.by + Math.sin(a) * s.rec; } }
      if (!p.muriendo && Math.abs(s.cx - pcx) < 3 && circuloContra(p, s.cx, s.cy, 0.62)) J.herir(g, s.cx);
    }
    // ---- torretas ----
    for (const e of g.torretas) {
      if (!e.vivo) continue;
      if (e.muertoT > 0) { e.muertoT += dt; if (e.muertoT > 0.5) e.vivo = false; continue; }
      const dx = pcx - (e.x + 0.5), dy = pcy - (e.y + 0.5), cerca = Math.abs(dx) < 13 && Math.abs(dy) < 8 && !p.muriendo;
      if (cerca) e.ang += (Math.atan2(dy, dx) - e.ang) * Math.min(1, dt * 6);
      e.t += dt;
      if (e.estado === 'espera') { e.cd -= dt; if (e.cd <= 0 && cerca) { e.estado = 'carga'; e.t = 0; J.Audio.sfx('aviso'); } }
      else if (e.estado === 'carga' && e.t > 0.55) { e.estado = 'espera'; e.cd = e.per; g.bolasT.push({ x: e.x + 0.5 + Math.cos(e.ang) * 0.7, y: e.y + 0.5 + Math.sin(e.ang) * 0.7, vx: Math.cos(e.ang) * 5.2, vy: Math.sin(e.ang) * 5.2, t: 0 }); J.Audio.sfx('fuego'); }
      if (!p.muriendo && J.solapa(p, { x: e.x, y: e.y, w: 1, h: 1 })) {
        if (p.estrella > 0) P.matarTorreta(g, e);
        else if (p.vy > 0.5 && p.y + p.h - e.y < 0.6) { P.matarTorreta(g, e); p.vy = g.inp.salto ? -F.v0 * 0.95 : -F.v0 * 0.6; p.suelo = false; p.saltando = !!g.inp.salto; p.coyote = 0; }
        else J.herir(g, e.x + 0.5);
      }
    }
    for (const b of g.bolasT) {
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.t > 3.2 || SOL(w.get(Math.floor(b.x), Math.floor(b.y)))) { b.muerta = true; J.chispas(g, b.x * T, b.y * T, 5, '#ff7a2a', 2); }
      else if (!p.muriendo && Math.hypot(pcx - b.x, pcy - b.y) < 0.55) { b.muerta = true; J.herir(g, b.x); }
    }
    g.bolasT = g.bolasT.filter((b) => !b.muerta);
    // ---- cañones de bala gigante ----
    for (const c of g.canones) {
      if (Math.abs(c.x - pcx) > 22) continue;
      c.t += dt;
      c.cargando = c.t > c.per - 0.7;
      if (c.t >= c.per) { c.t = 0; g.balas.push({ x: c.x + 0.5 + c.dir * 1.1, y: c.y + 0.5, dir: c.dir, t: 0, muerta: false }); J.Audio.sfx('fuego'); J.chispas(g, (c.x + 0.5 + c.dir) * T, (c.y + 0.5) * T, 8, '#ffd166', 3); }
    }
    for (const b of g.balas) {
      b.t += dt; b.x += b.dir * 4.3 * dt;
      if (b.t > 9 || b.x < -3 || b.x > w.ancho + 3 || SOL(w.get(Math.floor(b.x + b.dir * 0.8), Math.floor(b.y)))) { if (!b.muerta) J.chispas(g, b.x * T, b.y * T, 10, '#ff7a2a', 3); b.muerta = true; continue; }
      if (!p.muriendo && J.solapa(p, { x: b.x - 0.8, y: b.y - 0.45, w: 1.6, h: 0.9 })) {
        if (p.estrella > 0) { b.muerta = true; J.chispas(g, b.x * T, b.y * T, 12, '#ffd166', 4); }
        else if (p.vy > 0.5 && p.y + p.h - (b.y - 0.45) < 0.7) { b.muerta = true; J.Audio.sfx('pisoton'); J.chispas(g, b.x * T, b.y * T, 14, '#ffb020', 4); p.vy = g.inp.salto ? -F.v0 * 0.95 : -F.v0 * 0.6; p.suelo = false; p.saltando = !!g.inp.salto; p.coyote = 0; }
        else { J.herir(g, b.x); }
      }
    }
    g.balas = g.balas.filter((b) => !b.muerta);
    // ---- géiseres: quieto → aviso (burbujea) → brota → baja ----
    for (const q of g.geiseres) {
      const ph = ((t + q.ret) % q.per) / q.per;
      q.fase = ph < 0.55 ? 'quieto' : ph < 0.7 ? 'aviso' : ph < 0.88 ? 'brota' : 'baja';
      q.k = q.fase === 'brota' ? Math.min(1, (ph - 0.7) / 0.06) : q.fase === 'baja' ? Math.max(0, 1 - (ph - 0.88) / 0.12) : 0;
      if (q.k > 0.15 && !p.muriendo && J.solapa(p, { x: q.x + 0.15, y: q.y - q.alto * q.k, w: 0.7, h: q.alto * q.k })) J.herir(g, q.x + 0.5);
      if (q.fase === 'aviso' && Math.abs(q.x - pcx) < 14 && Math.random() < 0.18) J.chispas(g, (q.x + 0.5) * T, q.y * T, 1, g.tema.pal.hzTop, 1.5, -3);
    }
    // ---- láseres: apagado → parpadeo → encendido ----
    for (const l of g.lasers) {
      const ph = ((t + l.ret) % l.per) / l.per;
      l.aviso = ph > 0.48 && ph < 0.62 && Math.floor(t * 14) % 2 === 0; l.on = ph >= 0.62;
      if (l.on && !p.muriendo) { const caja = l.eje === 'h' ? { x: l.x + 0.5, y: l.y + 0.35, w: l.largo - 1, h: 0.3 } : { x: l.x + 0.35, y: l.y + 0.5, w: 0.3, h: l.largo - 1 }; if (J.solapa(p, caja)) J.herir(g, l.x + 0.5); }
    }
    // ---- plantas del techo ----
    for (const q of g.plantasT) {
      const ph = ((t / q.ciclo) + q.fase) % 1, vis = q.vis / q.ciclo;
      const obj = ph < vis ? Math.min(1, ph / (vis * 0.25), (vis - ph) / (vis * 0.25) + 0.001) : 0;
      q.alt += (obj - q.alt) * Math.min(1, dt * 12);
      if (q.alt > 0.5 && !p.muriendo && J.solapa(p, { x: q.x - 0.5, y: q.largo, w: 1, h: 1.9 * q.alt })) J.herir(g, q.x);
    }
  };

  // ---------- dibujo ----------
  function dibSierra(ctx, x, y, ang) {
    const rad = 11;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6, a0 = a - 0.17, a1 = a + 0.17; Pl(ctx, [[Math.cos(a0) * rad * 0.74, Math.sin(a0) * rad * 0.74], [Math.cos(a) * rad, Math.sin(a) * rad], [Math.cos(a1) * rad * 0.74, Math.sin(a1) * rad * 0.74]], '#dfe7ff'); }
    D(ctx, 0, 0, 9, OUT); D(ctx, 0, 0, 8, '#8fa2c8'); D(ctx, 0, 0, 5, '#4a5a86'); D(ctx, 0, 0, 2, '#e8f0ff');
    for (let k = 0; k < 3; k++) { const a = (k * 2 * Math.PI) / 3; D(ctx, r(Math.cos(a) * 5.5), r(Math.sin(a) * 5.5), 1, OUT); }
    ctx.restore();
  }
  function dibTorreta(ctx, e, x, y, t) {
    const muerta = e.muertoT > 0; if (muerta) ctx.globalAlpha = Math.max(0, 1 - e.muertoT * 2);
    ctx.fillStyle = OUT; ctx.fillRect(x - 7, y + 6, 14, 10); ctx.fillStyle = '#4a5a86'; ctx.fillRect(x - 6, y + 7, 12, 8); ctx.fillStyle = '#8fa2c8'; ctx.fillRect(x - 6, y + 7, 12, 2);
    ctx.save(); ctx.translate(x, y + 6); ctx.rotate(e.ang);
    ctx.fillStyle = OUT; ctx.fillRect(0, -3, 12, 6); ctx.fillStyle = e.estado === 'carga' ? '#ff7a2a' : '#6a7aa8'; ctx.fillRect(1, -2, 10, 4); if (e.estado === 'carga') { ctx.fillStyle = '#ffe27a'; ctx.fillRect(9, -1, 3, 2); }
    ctx.restore();
    D(ctx, x, y + 6, 6, OUT); D(ctx, x, y + 6, 5, e.estado === 'carga' ? '#ff4d6d' : '#6a7aa8'); D(ctx, x, y + 6, 2, '#ffffff');
    ctx.globalAlpha = 1;
  }
  function dibCanon(ctx, c, x, y, t) {
    ctx.fillStyle = OUT; ctx.fillRect(x - 8, y - 8, 16, 16); ctx.fillStyle = '#39456e'; ctx.fillRect(x - 7, y - 7, 14, 14); ctx.fillStyle = '#5a6aa0'; ctx.fillRect(x - 7, y - 7, 14, 2);
    const bx = x + c.dir * 7; ctx.fillStyle = OUT; ctx.fillRect(c.dir > 0 ? bx - 2 : bx - 6, y - 5, 8, 10); ctx.fillStyle = c.cargando ? (Math.floor(t * 16) % 2 ? '#ff4d6d' : '#ffd166') : '#0b1230'; ctx.fillRect(c.dir > 0 ? bx : bx - 4, y - 3, 4, 6);
    ctx.fillStyle = '#ffd166'; ctx.fillRect(x - 5, y + 3, 2, 2); ctx.fillRect(x + 3, y + 3, 2, 2);
  }
  function dibBala(ctx, b, x, y, t) {   // «bala cometa»: proyectil gigante con aletas y cara furiosa (diseño propio)
    ctx.save(); if (b.dir > 0) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
    for (let i = 1; i < 6; i++) { ctx.fillStyle = 'rgba(255,170,40,' + (0.5 - i * 0.08) + ')'; ctx.fillRect(x + 12 + i * 4, y - 3 + Math.round(Math.sin(t * 20 + i) * 1.5), 4, 6); }
    Pl(ctx, [[x + 8, y - 4], [x + 14, y - 9], [x + 14, y - 3]], '#ff4d2e'); Pl(ctx, [[x + 8, y + 4], [x + 14, y + 9], [x + 14, y + 3]], '#ff4d2e');
    ctx.fillStyle = OUT; ctx.fillRect(x - 12, y - 8, 22, 16); D(ctx, x - 11, y, 8, OUT); ctx.fillStyle = '#20284a'; ctx.fillRect(x - 11, y - 7, 20, 14); D(ctx, x - 11, y, 7, '#20284a');
    ctx.fillStyle = '#4a5a86'; ctx.fillRect(x - 6, y - 7, 15, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 10, y - 4, 5, 4); ctx.fillStyle = '#ff4d6d'; ctx.fillRect(x - 9, y - 3, 3, 2);
    ctx.fillStyle = '#fff'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 11 + k * 3, y + 2, 2, 3);
    ctx.restore();
  }
  function dibGeiser(ctx, q, pal, x, ySuelo, t) {
    ctx.fillStyle = OUT; ctx.fillRect(x - 6, ySuelo - 1, 12, 3); ctx.fillStyle = pal.hz1; ctx.fillRect(x - 5, ySuelo - 1, 10, 2);
    const col = pal.hz0, tope = pal.hzTop;
    if (q.fase === 'aviso') { const sh = r(Math.sin(t * 60) * 1); ctx.fillStyle = col; ctx.fillRect(x - 4 + sh, ySuelo - 3, 8, 3); for (let i = 0; i < 3; i++) { const f = (t * 2 + i / 3) % 1; ctx.fillStyle = tope; ctx.fillRect(x - 3 + i * 3, r(ySuelo - 3 - f * 8), 2, 2); } }
    if (q.k > 0.02) { const h = r(q.alto * T * q.k); for (let yy = 0; yy < h; yy += 2) { const ond = r(Math.sin(t * 18 + yy * 0.4) * 1.5), a = 1 - yy / (h + 6) * 0.35; ctx.globalAlpha = a; ctx.fillStyle = yy % 8 < 4 ? col : tope; ctx.fillRect(x - 5 + ond, ySuelo - 2 - yy, 10 - r(yy / h * 3), 2); } ctx.globalAlpha = 1; D(ctx, x + r(Math.sin(t * 12) * 2), ySuelo - h - 2, 6, tope); }
  }
  function dibLaser(ctx, l, x, y, t) {
    const a = l.eje === 'h' ? [x, y, x + (l.largo - 1) * T, y] : [x, y, x, y + (l.largo - 1) * T];
    for (const [ex, ey] of [[a[0], a[1]], [a[2], a[3]]]) { ctx.fillStyle = OUT; ctx.fillRect(ex - 5, ey - 5, 10, 10); ctx.fillStyle = '#5a6aa0'; ctx.fillRect(ex - 4, ey - 4, 8, 8); ctx.fillStyle = l.on ? '#ff4d6d' : l.aviso ? '#ffd166' : '#2a3a5a'; ctx.fillRect(ex - 2, ey - 2, 4, 4); }
    if (l.on) { ctx.fillStyle = 'rgba(255,77,109,.35)'; if (l.eje === 'h') ctx.fillRect(a[0], y - 4, a[2] - a[0], 8); else ctx.fillRect(x - 4, a[1], 8, a[3] - a[1]); ctx.fillStyle = '#ff4d6d'; if (l.eje === 'h') ctx.fillRect(a[0], y - 2, a[2] - a[0], 4); else ctx.fillRect(x - 2, a[1], 4, a[3] - a[1]); ctx.fillStyle = '#fff'; if (l.eje === 'h') ctx.fillRect(a[0], y - 1, a[2] - a[0], 2); else ctx.fillRect(x - 1, a[1], 2, a[3] - a[1]); }
    else if (l.aviso) { ctx.fillStyle = 'rgba(255,209,102,.6)'; if (l.eje === 'h') ctx.fillRect(a[0], y, a[2] - a[0], 1); else ctx.fillRect(x, a[1], 1, a[3] - a[1]); }
  }
  P.dibujar = function (ctx, g, camX, camY, vis) {
    for (const k of g.llaves || []) {   // llave dorada flotante con destello
      if (k.tomada || !vis(k.x - 1, k.x + 1)) continue;
      const x = r(k.x * T - camX), y = r(k.y * T - camY + Math.sin(g.t * 3 + k.fase) * 2);
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(g.t * 5 + k.fase); D(ctx, x, y, 11, '#ffd166'); ctx.globalAlpha = 1;
      ctx.fillStyle = OUT; ctx.fillRect(x - 7, y - 5, 10, 10); ctx.fillRect(x + 1, y - 2, 8, 4); ctx.fillRect(x + 6, y + 1, 3, 5);
      D(ctx, x - 3, y, 4, '#ffd166'); D(ctx, x - 3, y, 1, OUT); ctx.fillStyle = '#ffd166'; ctx.fillRect(x + 1, y - 1, 7, 2); ctx.fillRect(x + 6, y + 1, 2, 4); ctx.fillRect(x + 3, y + 1, 2, 3);
    }
    if (!g.sierras) return;
    const t = g.t, S = J.Sprites;
    for (const s of g.sierras) if (vis(s.bx - 1, s.bx + 1 + Math.abs(s.rec))) {
      if (s.eje && s.eje !== 'o') { ctx.strokeStyle = 'rgba(11,18,48,.8)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r(s.bx * T - camX), r(s.by * T - camY)); ctx.lineTo(r((s.bx + (s.eje === 'x' ? s.rec : 0)) * T - camX), r((s.by + (s.eje === 'y' ? s.rec : 0)) * T - camY)); ctx.stroke(); ctx.setLineDash([]); }
      dibSierra(ctx, r(s.cx * T - camX), r(s.cy * T - camY), s.ang);
    }
    for (const e of g.torretas) if (e.vivo && vis(e.x - 1, e.x + 2)) dibTorreta(ctx, e, r((e.x + 0.5) * T - camX), r(e.y * T - camY), t);
    for (const c of g.canones) if (vis(c.x - 1, c.x + 2)) dibCanon(ctx, c, r((c.x + 0.5) * T - camX), r((c.y + 0.5) * T - camY), t);
    for (const b of g.balas) dibBala(ctx, b, r(b.x * T - camX), r(b.y * T - camY), t);
    for (const b of g.bolasT) { const x = r(b.x * T - camX), y = r(b.y * T - camY); ctx.fillStyle = 'rgba(255,122,42,.4)'; D(ctx, x, y, 6, 'rgba(255,122,42,.4)'); D(ctx, x, y, 4, '#ff7a2a'); D(ctx, x, y, 2, '#ffe27a'); }
    for (const q of g.geiseres) if (vis(q.x - 1, q.x + 2)) dibGeiser(ctx, q, g.tema.pal, r((q.x + 0.5) * T - camX), r(q.y * T - camY), t);
    for (const l of g.lasers) if (vis(l.x - 1, l.x + l.largo + 1)) dibLaser(ctx, l, r((l.x + 0.5) * T - camX), r((l.y + 0.5) * T - camY), t);
    for (const q of g.plantasT) if (vis(q.x - 1, q.x + 1)) {
      const x = r(q.x * T - camX), yEnd = r(q.largo * T - camY);
      ctx.fillStyle = OUT; ctx.fillRect(x - 8, -camY, 16, yEnd + camY - 2); ctx.fillStyle = '#2a9a52'; ctx.fillRect(x - 7, -camY, 14, yEnd + camY - 2); ctx.fillStyle = '#7af0a0'; ctx.fillRect(x - 7, -camY, 3, yEnd + camY - 2);
      ctx.fillStyle = OUT; ctx.fillRect(x - 10, yEnd - 6, 20, 6); ctx.fillStyle = '#35c26a'; ctx.fillRect(x - 9, yEnd - 5, 18, 4); ctx.fillStyle = '#7af0a0'; ctx.fillRect(x - 9, yEnd - 5, 18, 1);
      if (q.alt > 0.02) { ctx.save(); ctx.translate(0, yEnd - 1); ctx.scale(1, -1); S.dibujarPlanta(ctx, x, 0, q.alt, t, q.alt > 0.3); ctx.restore(); }
    }
  };
})();
