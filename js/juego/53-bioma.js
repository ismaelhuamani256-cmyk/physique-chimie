// =====================================================================================
// 53-bioma.js — PELIGROS Y MECÁNICAS POR BIOMA (todo diseño propio)
//  LABORATORIO  matraz {x,y}                       explota al dispararle (onda de 2,3 tiles, encadena con otros matraces)
//               ventila {x,y,alto,periodo}         tubería de gas: sopla hacia arriba y te empuja (y = fila del suelo)
//  CUEVA        murcielago {x,y}                   cuelga del techo; si pasas debajo, pica; vuelve a colgarse
//               charco {x,y,largo}                 charco de ácido (quema al tocarlo)
//               cristal {x,y}  + bloque_onoff{grupo:"cristal"}   el cristal ilumina 12 s y revela plataformas ocultas
//  NUBES        nube {x,y,largo}                   se deshace 0,9 s tras pisarla y vuelve a los 3,2 s
//               tormenta {x,w,periodo}             rayos con aviso cerca de ti dentro de la zona
//               (viento lateral: zona_campo con fx)
//  ESPACIO      (gravedad invertida: zona_campo con fy < 0)
//               asteroide {x,y,recorrido,periodo}  roca giratoria en órbita
//               meteoros {x,w,periodo}             lluvia de meteoritos diagonales con estela
//  HIELO        zona_hielo {x,y,w}                 suelo resbaladizo (y = fila del suelo)
//               bola_nieve {x,y}                   bola gigante que rueda (se derrite a fuego)
//  HORNO        yunque {x,y,periodo}               cuelga; cuando pasas debajo avisa y cae
//               vapor {x,y,dir,largo,periodo}      pistón de vapor (u/l/r)
//               cadena {x,y,largo}                 ancla con cadena que se trepa (SALTO sube · ABAJO/S baja)
//  CAMPO        tornado {x,y,recorrido,periodo}    columna que te eleva y te lanza
//               espantapajaros {x,y}               parece decorado; al acercarte despierta y salta
//               trampolin {x,y}                    bala de heno: rebote 1,6×
//  CASTILLO     fantasma {x,y}                     intangible y peligroso si no lo miras; si lo miras se vuelve piedra y se puede pisar
//               tablon {x,y,largo}                 puente de tablones que se rompe 0,45 s tras pisarlos
//               espejo {x,y,alto}                  refleja disparos (tuyos y de torretas/jefes)
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const B = J.Bioma = {};
  const T = 16, OUT = '#0b1230', r = Math.round;
  const SOL = (t) => t === 1 || t === 3 || t === 4 || t === 5 || t === 6 || t === 7 || t === 8 || t === 9 || t === 10;
  const D = (...a) => J.Temas.disco(...a);
  const hash = (a, b) => J.hash('b' + a + ',' + b);
  const circ = (p, cx, cy, rad) => { const nx = Math.max(p.x, Math.min(cx, p.x + p.w)), ny = Math.max(p.y, Math.min(cy, p.y + p.h)); return Math.hypot(cx - nx, cy - ny) < rad; };

  B.iniciar = function (g) {
    const S = g.nivel.segmentos || [], w = g.w, f = (t) => S.filter((s) => s.tipo === t);
    const bio = g.bio = { fx: [] };
    bio.matraces = f('matraz').map((s) => ({ x: s.x + 0.5, y: s.y + 0.5, vivo: true }));
    bio.ventilas = f('ventila').map((s) => ({ x: s.x, y: s.y, alto: s.alto || 6, per: s.periodo || 3.6, ret: s.retardo || 0, on: false, aviso: false }));
    bio.charcos = f('charco').map((s) => ({ x: s.x, y: s.y, largo: s.largo || 3 }));
    bio.cristales = f('cristal').map((s) => ({ x: s.x + 0.5, y: s.y + 0.5, ph: hash(s.x, s.y) % 100 / 16 }));
    g.cristalT = 0;
    bio.efim = [];
    for (const s of f('nube')) bio.efim.push({ k: 'nube', x: Math.round(s.x), y: Math.round(s.y), w: s.largo || 3, estado: 'firme', t: 0 });
    for (const s of f('tablon')) for (let i = 0; i < (s.largo || 4); i++) bio.efim.push({ k: 'tablon', x: Math.round(s.x) + i, y: Math.round(s.y), w: 1, estado: 'firme', t: 0 });
    for (const e of bio.efim) setTiles(w, e, 4);
    bio.tormentas = f('tormenta').map((s) => ({ x: s.x, w: s.w || 20, per: s.periodo || 2.4, t: 0 }));
    bio.asteroides = f('asteroide').map((s) => ({ cx: s.x + 0.5, cy: s.y + 0.5, rec: s.recorrido || 3, per: s.periodo || 6, x: s.x, y: s.y, ang: hash(s.x, s.y) % 628 / 100, rad: s.radio || 0.8 }));
    bio.meteoros = f('meteoros').map((s) => ({ x: s.x, w: s.w || 24, per: s.periodo || 1.8, t: 0 }));
    bio.hielos = f('zona_hielo').map((s) => ({ x: s.x, y: s.y, w: s.w || 8 }));
    bio.bichos = [];
    const crea = (esp, s, w2, h2, hp) => bio.bichos.push({ esp, x: s.x + 0.5 - w2 / 2, y: esp === 'colgante' ? s.y : s.y + 1 - h2, w: w2, h: h2, x0: s.x + 0.5, y0: s.y, vx: 0, vy: 0, dir: -1, estado: 'espera', t: 0, hp, vivo: true, muertoT: 0, flash: 0, ph: hash(s.x, s.y) % 628 / 100, suelo: false, cd: 0 });
    for (const s of f('murcielago')) crea('colgante', s, 0.9, 0.8, 1);
    for (const s of f('bola_nieve')) crea('bola_nieve', s, 1.6, 1.6, 4);
    for (const s of f('espantapajaros')) crea('espantapajaros', s, 0.9, 1.7, 1);
    for (const s of f('fantasma')) crea('fantasma', s, 1.0, 1.2, 1);
    bio.yunques = f('yunque').map((s) => { let fy = Math.floor(s.y) + 2; while (fy < w.alto && !SOL(w.get(Math.floor(s.x), fy))) fy++; return { x: s.x, y0: s.y, y: s.y, floor: fy, per: s.periodo || 2.4, estado: 'arriba', t: 0, vy: 0, w: 1.6, h: 1.2 }; });
    bio.vapores = f('vapor').map((s) => ({ x: s.x, y: s.y, dir: s.dir || 'u', largo: s.largo || 4, per: s.periodo || 3.2, ret: s.retardo || 0, on: false, aviso: false }));
    bio.cadenas = f('cadena').map((s) => ({ x: s.x + 0.5, y: s.y, largo: s.largo || 6 }));
    bio.tornados = f('tornado').map((s) => ({ bx: s.x, y: s.y, rec: s.recorrido || 8, per: s.periodo || 9, x: s.x, alto: s.alto || 7 }));
    bio.trampolines = f('trampolin').map((s) => ({ x: s.x, y: s.y, sq: 0 }));
    bio.espejos = f('espejo').map((s) => ({ x: s.x, y: s.y, alto: s.alto || 5 }));
    p0(g);
  };
  function p0(g) { g.jugador.enHielo = false; }
  function setTiles(w, e, v) { for (let i = 0; i < e.w; i++) if (e.x + i >= 0 && e.x + i < w.ancho && e.y >= 0 && e.y < w.alto) w.tiles[e.y * w.ancho + e.x + i] = v; }

  const libre = (g, x, y, w, h) => { for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2]]) if (SOL(g.w.get(Math.floor(px), Math.floor(py)))) return false; return true; };
  const mover = (g, e, dx, dy) => { e.bloq = false; if (libre(g, e.x + dx, e.y, e.w, e.h)) e.x += dx; else e.bloq = true; const bx = e.bloq; if (libre(g, e.x, e.y + dy, e.w, e.h)) e.y += dy; else { e.bloq = true; e.bY = true; } e.bloq = e.bloq || bx; };
  const fis = (g, e, dt, vx, gr) => { e.vy = Math.min(14, (e.vy || 0) + gr * dt); e.bY = false; const x0 = e.x; mover(g, e, vx * dt, 0); const bx = e.bloq; mover(g, e, 0, e.vy * dt); if (e.bY) { if (e.vy > 0) e.suelo = true; e.vy = 0; } else e.suelo = false; e.bloq = bx || (!!vx && Math.abs(e.x - x0) < 1e-5); };
  const delante = (g, e) => SOL(g.w.get(Math.floor(e.x + (e.dir > 0 ? e.w + 0.2 : -0.2)), Math.floor(e.y + e.h + 0.4)));

  function boom(g, x, y, rad) {
    J.Audio.sfx('onda'); g.shake = Math.max(g.shake, 6); J.chispas(g, x * T, y * T, 22, '#ffb020', 5); J.chispas(g, x * T, y * T, 10, '#fff', 3);
    g.bio.fx.push({ x, y, rad, t: 0, dur: 0.4 });
    const p = g.jugador; if (!p.muriendo && Math.hypot(p.x + p.w / 2 - x, p.y + p.h / 2 - y) < rad) J.herir(g, x);
    for (const e of g.w.enemigos) if (e.vivo && e.muertoT === 0 && Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < rad) e.muertoT = 0.001;
    for (const m of g.bio.matraces) if (m.vivo && Math.hypot(m.x - x, m.y - y) < rad) { m.vivo = false; m.t = 0.15; }
    for (const b of g.bio.bichos) if (b.vivo && Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y) < rad && b.esp !== 'bola_nieve') matar(g, b);
  }
  function matar(g, b) { if (!b.vivo || b.muertoT > 0) return; b.muertoT = 0.001; J.Audio.sfx('pisoton'); J.chispas(g, (b.x + b.w / 2) * T, (b.y + b.h / 2) * T, 12, '#ffd166', 4); }

  /** Disparos del jugador. true si el disparo se gasta. */
  B.golpe = function (g, x, y, rad, por) {
    const bio = g.bio; if (!bio) return false;
    for (const m of bio.matraces) if (m.vivo && Math.hypot(x - m.x, y - m.y) < rad + 0.6) { m.vivo = false; m.t = 0.15; return true; }
    for (const c of bio.cristales) if (Math.hypot(x - c.x, y - c.y) < rad + 0.7) { activarCristal(g, c); return true; }
    for (const b of bio.bichos) {
      if (!b.vivo || b.muertoT > 0) continue;
      if (Math.abs(x - (b.x + b.w / 2)) < b.w / 2 + rad + 0.1 && Math.abs(y - (b.y + b.h / 2)) < b.h / 2 + rad + 0.1) {
        if (b.esp === 'bola_nieve') { if (por === 'hielo') return true; b.hp -= por === 'fuego' ? 1 : 0.5; b.flash = 0.15; if (b.hp <= 0) matar(g, b); return true; }
        if (b.esp === 'fantasma' && b.solido) return true;
        matar(g, b); return true;
      }
    }
    return false;
  };
  function activarCristal(g, c) { g.cristalT = 12; c.t = 12; J.Audio.sfx('premio'); J.chispas(g, c.x * T, c.y * T, 16, '#c9a6ff', 4); if (g.ui) g.ui.aviso('¡Cristal! Plataformas reveladas'); }

  B.paso = function (g, dt) {
    const bio = g.bio; if (!bio) return;
    if (!bio.fx) bio.fx = [];
    const p = g.jugador, w = g.w, F = g.F, pcx = p.x + p.w / 2, pcy = p.y + p.h / 2, vivoP = !p.muriendo, inp = g.inp;
    // ---- suelo resbaladizo ----
    p.enHielo = !!(p.suelo && (g.hieloGlobal || bio.hielos.some((h) => pcx >= h.x && pcx < h.x + h.w && Math.abs(p.y + p.h - h.y) < 0.4)));
    // ---- matraces (los rotos explotan tras 0,15 s) ----
    for (const m of bio.matraces) if (!m.vivo && m.t > 0) { m.t -= dt; if (m.t <= 0) { m.t = -1; boom(g, m.x, m.y, 2.3); } }
    // ---- tuberías de gas ----
    for (const v of bio.ventilas) {
      const k = (((g.tm + v.ret) % v.per) + v.per) % v.per / v.per; v.on = k > 0.45; v.aviso = k > 0.3 && k <= 0.45;
      if (v.on && vivoP && pcx > v.x && pcx < v.x + 1 && p.y + p.h > v.y - v.alto && p.y < v.y) { p.vy = Math.max(p.vy - 70 * dt, -7.5); p.suelo = false; }
    }
    // ---- charcos de ácido ----
    for (const c of bio.charcos) if (vivoP && p.x + p.w > c.x && p.x < c.x + c.largo && p.y + p.h > c.y + 0.5 && p.y + p.h < c.y + 1.4) J.herir(g, c.x + c.largo / 2);
    // ---- cristales ----
    g.cristalT = Math.max(0, (g.cristalT || 0) - dt);
    for (const c of bio.cristales) { c.t = Math.max(0, (c.t || 0) - dt); if (vivoP && c.t <= 0 && Math.hypot(pcx - c.x, pcy - c.y) < 0.9) activarCristal(g, c); }
    // ---- nubes y tablones ----
    for (const e of bio.efim) {
      e.t += dt;
      const pisa = vivoP && p.suelo && p.x + p.w > e.x + 0.05 && p.x < e.x + e.w - 0.05 && Math.abs(p.y + p.h - e.y) < 0.2;
      if (e.estado === 'firme' && pisa) { e.estado = 'cede'; e.t = 0; }
      else if (e.estado === 'cede' && e.t > (e.k === 'nube' ? 0.9 : 0.45)) { e.estado = 'ausente'; e.t = 0; setTiles(w, e, 0); J.chispas(g, (e.x + e.w / 2) * T, (e.y + 0.5) * T, 8, e.k === 'nube' ? '#ffffff' : '#a07a4a', 3, 1); }
      else if (e.estado === 'ausente' && e.t > (e.k === 'nube' ? 3.2 : 5.5) && !J.solapa(p, { x: e.x, y: e.y, w: e.w, h: 1 })) { e.estado = 'firme'; e.t = 0; setTiles(w, e, 4); }
    }
    // ---- tormentas ----
    for (const s of bio.tormentas) {
      if (!(pcx > s.x && pcx < s.x + s.w) || !vivoP) { s.t = 0; continue; }
      s.t += dt; if (s.t >= s.per) { s.t = 0; const x = J.clamp(pcx + (Math.random() - 0.5) * 10, s.x + 1, s.x + s.w - 1); let fy = Math.floor(p.y); while (fy < w.alto && !SOL(w.get(Math.floor(x), fy))) fy++; g.proy.push({ tipo: 'rayo', x, aviso: 0.9, t: 0, y: fy }); J.Audio.sfx('aviso'); }
    }
    // ---- asteroides ----
    for (const a of bio.asteroides) { a.ang += dt * 6.283 / a.per; a.x = a.cx + Math.cos(a.ang) * a.rec; a.y = a.cy + Math.sin(a.ang) * a.rec * 0.6; if (vivoP && Math.abs(a.x - pcx) < 3 && circ(p, a.x, a.y, a.rad)) J.herir(g, a.x); }
    // ---- meteoritos ----
    for (const m of bio.meteoros) {
      if (!(pcx > m.x && pcx < m.x + m.w) || !vivoP) { m.t = 0; continue; }
      m.t += dt; if (m.t >= m.per) { m.t = 0; g.proy.push({ tipo: 'bola', x: pcx - 4 + (Math.random() - 0.5) * 12, y: Math.max(-1, p.y - 11), vx: 3.6, vy: 8.4, grav: 0, t: 0, col: null }); J.Audio.sfx('fuego'); }
    }
    // ---- criaturas ----
    for (const b of bio.bichos) {
      if (!b.vivo) continue;
      if (b.muertoT > 0) { b.muertoT += dt; if (b.muertoT > 0.45) b.vivo = false; continue; }
      b.t += dt; b.flash = Math.max(0, b.flash - dt); b.cd -= dt;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = pcx - cx, dy = pcy - cy, d = Math.hypot(dx, dy);
      if (d > 45) continue;
      if (b.esp === 'colgante') {
        if (b.estado === 'espera') { b.x = b.x0 - b.w / 2; b.y = b.y0; if (Math.abs(dx) < 4.5 && dy > 0.5 && dy < 10 && vivoP && b.cd <= 0) { b.estado = 'aviso'; b.t = 0; J.Audio.sfx('aviso'); } }
        else if (b.estado === 'aviso') { if (b.t > 0.5) { b.estado = 'pica'; b.t = 0; const n = Math.hypot(dx, dy) || 1; b.vx = dx / n * 8; b.vy = dy / n * 8; } }
        else if (b.estado === 'pica') { mover(g, b, b.vx * dt, b.vy * dt); if (b.t > 1.0 || b.bloq) { b.estado = 'vuelve'; b.t = 0; } }
        else if (b.estado === 'vuelve') { const ox = b.x0 - b.w / 2 - b.x, oy = b.y0 - b.y, n = Math.hypot(ox, oy); if (n < 0.3) { b.estado = 'espera'; b.cd = 1.2; } else mover(g, b, ox / n * 4.5 * dt, oy / n * 4.5 * dt); }
        b.dir = dx >= 0 ? 1 : -1; contacto(g, b, p, false);
      } else if (b.esp === 'bola_nieve') {
        b.rot = (b.rot || 0) + b.dir * dt * 6; fis(g, b, dt, b.dir * 3.6, 26); if ((b.suelo && !delante(g, b)) || b.bloq) b.dir = -b.dir;
        if (vivoP && toca(p, b)) { if (p.vy > 0.3 && p.y + p.h - b.y < b.h * 0.4) { p.vy = -F.v0 * 0.8; p.suelo = false; p.coyote = 0; J.Audio.sfx('pisoton'); } else J.herir(g, cx); }
      } else if (b.esp === 'espantapajaros') {
        if (b.estado === 'espera') { if (d < 3.2 && vivoP) { b.estado = 'activo'; b.t = 0; J.Audio.sfx('aviso'); } fis(g, b, dt, 0, 26); }
        else { b.dir = dx >= 0 ? 1 : -1; b.cd -= 0; fis(g, b, dt, b.suelo ? 0 : b.dir * 3.4, 26); if (b.suelo && b.t > 0.7) { b.vy = -9; b.suelo = false; b.t = 0; } if (d > 16) { b.estado = 'espera'; } }
        contacto(g, b, p, false, b.estado === 'activo');
      } else if (b.esp === 'fantasma') {
        const mira = (p.dir > 0 && dx > 0) || (p.dir < 0 && dx < 0);
        b.solido = mira && d < 14; b.dir = dx >= 0 ? 1 : -1;
        if (!b.solido && d < 18 && vivoP) { b.x += dx / (d || 1) * 2.2 * dt; b.y += dy / (d || 1) * 2.2 * dt; }
        b.y += Math.sin(b.t * 3 + b.ph) * 0.25 * dt;
        if (b.solido && vivoP) {   // piedra: se puede pisar
          if (p.vy >= 0 && p.x + p.w > b.x + 0.1 && p.x < b.x + b.w - 0.1 && p.y + p.h > b.y - 0.05 && p.y + p.h < b.y + 0.55) { p.y = b.y - p.h; p.vy = 0; p.suelo = true; }
        } else if (!b.solido) contacto(g, b, p, false, true);
      }
    }
    // ---- yunques ----
    for (const y of bio.yunques) {
      y.t += dt; const cx = y.x + 0.5;
      if (y.estado === 'arriba') { if (vivoP && Math.abs(pcx - cx) < 1.3 && pcy > y.y0 + 1 && y.t > 0.8) { y.estado = 'aviso'; y.t = 0; J.Audio.sfx('aviso'); } }
      else if (y.estado === 'aviso') { if (y.t > 0.5) { y.estado = 'cae'; y.t = 0; y.vy = 2; } }
      else if (y.estado === 'cae') { y.vy += 40 * dt; y.y += y.vy * dt; if (vivoP && J.solapa(p, { x: cx - 0.8, y: y.y, w: 1.6, h: 1.2 })) J.herir(g, cx); if (y.y + 1.2 >= y.floor) { y.y = y.floor - 1.2; y.estado = 'suelo'; y.t = 0; g.shake = Math.max(g.shake, 5); J.Audio.sfx('onda'); J.chispas(g, cx * T, y.floor * T, 14, '#ffb020', 4); } }
      else if (y.estado === 'suelo') { if (y.t > 0.9) { y.estado = 'sube'; y.t = 0; } }
      else if (y.estado === 'sube') { y.y -= 2.2 * dt; if (y.y <= y.y0) { y.y = y.y0; y.estado = 'arriba'; y.t = 0; } }
    }
    // ---- vapor ----
    for (const v of bio.vapores) {
      const k = (((g.tm + v.ret) % v.per) + v.per) % v.per / v.per; v.on = k > 0.5; v.aviso = k > 0.35 && k <= 0.5;
      if (v.on && vivoP) { const rc = v.dir === 'u' ? { x: v.x, y: v.y - v.largo, w: 1, h: v.largo } : v.dir === 'l' ? { x: v.x - v.largo + 1, y: v.y, w: v.largo, h: 1 } : { x: v.x, y: v.y, w: v.largo, h: 1 }; if (J.solapa(p, rc)) J.herir(g, v.x); }
    }
    // ---- cadenas (se trepan) ----
    let enCadena = null;
    for (const c of bio.cadenas) if (vivoP && Math.abs(pcx - c.x) < 0.55 && p.y + p.h > c.y && p.y < c.y + c.largo) enCadena = c;
    if (enCadena) {
      if (!p.trepa && (inp.salto && !p.suelo || inp.accion && !p.suelo)) p.trepa = true;
      if (p.trepa) {
        p.x += (enCadena.x - pcx) * Math.min(1, dt * 12); p.vx = 0; p.vy = inp.salto ? -3.4 : inp.accion ? 3.4 : 0; p.suelo = false;
        if (inp.dir) { p.trepa = false; p.vx = inp.dir * 4; p.vy = -4; }
      }
    } else p.trepa = false;
    // ---- tornados ----
    for (const t of bio.tornados) {
      const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * g.tm) / t.per); t.x = t.bx + t.rec * k;
      if (vivoP && Math.abs(pcx - t.x) < 1.7 && p.y + p.h > t.y - t.alto && p.y < t.y) { p.vy = Math.max(p.vy - 60 * dt, -6.5); p.suelo = false; p.vx += Math.sin(g.t * 5) * 14 * dt; if (p.y < t.y - t.alto + 1) { p.vx = (pcx > t.x ? 1 : -1) * 7; p.vy = -2; } }
    }
    // ---- trampolines ----
    for (const t of bio.trampolines) { t.sq = Math.max(0, t.sq - dt); if (vivoP && p.vy > 0.5 && p.x + p.w > t.x && p.x < t.x + 1.6 && p.y + p.h > t.y + 0.1 && p.y + p.h < t.y + 0.9) { p.vy = -F.v0 * 1.6; p.suelo = false; p.coyote = 0; p.saltando = true; t.sq = 0.25; J.Audio.sfx('resorte'); J.chispas(g, (t.x + 0.8) * T, (t.y + 0.3) * T, 8, '#e6c34a', 3, 1); } }
    // ---- espejos: reflejan disparos ----
    for (const e of bio.espejos) {
      const dentro = (q) => Math.abs(q.x - e.x - 0.2) < 0.5 && q.y > e.y && q.y < e.y + e.alto;
      for (const q of g.fuegos || []) if (dentro(q) && !q.refl) { q.vx = -q.vx; q.refl = 1; }
      for (const q of g.fotones || []) if (dentro(q) && !q.refl) { q.vx = -q.vx; q.refl = 1; }
      for (const q of g.bolasT || []) if (dentro(q) && !q.refl) { q.vx = -q.vx; q.refl = 1; J.chispas(g, q.x * T, q.y * T, 6, '#cfe0ff', 2); }
      for (const q of g.proy) if (q.tipo === 'bola' && dentro(q) && !q.refl) { q.vx = -q.vx; q.refl = 1; }
    }
    if (g.gravT > 0) { g.gravT -= dt; if (g.gravT <= 0) { g.gravMult = null; g.gravT = 0; } }
    for (const f of bio.fx) f.t += dt;
    bio.fx = bio.fx.filter((f) => f.t < f.dur);
    // gravedad invertida temporal (jefe de gravedad)
    if (g.gravMult != null && g.gravMult < 0) { if (p.y < 0.2) { p.y = 0.2; p.vy = Math.max(p.vy, 0); } }
  };
  const toca = (p, e) => J.solapa(p, { x: e.x + 0.06, y: e.y + 0.06, w: e.w - 0.12, h: e.h - 0.12 });
  function contacto(g, e, p, blindado, mortal) {
    if (p.muriendo || !toca(p, e)) return;
    const encima = p.vy > 0.3 && p.y + p.h - e.y < e.h * 0.6;
    if (p.estrella > 0) { matar(g, e); return; }
    if (encima) { p.vy = -g.F.v0 * 0.7; p.suelo = false; p.coyote = 0; p.saltando = false; J.Audio.sfx('pisoton'); if (!blindado) matar(g, e); }
    else if (mortal !== false) J.herir(g, e.x + e.w / 2);
  }

  // ---------- dibujo ----------
  B.dibujar = function (ctx, g, camX, camY, vis) {
    const bio = g.bio; if (!bio) return; const t = g.t, tm = g.tm;
    for (const h of bio.hielos) if (vis(h.x, h.x + h.w)) { const x = r(h.x * T - camX), y = r(h.y * T - camY); ctx.fillStyle = '#bfefff'; ctx.fillRect(x, y - 1, h.w * T, 3); ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; for (let i = 0; i < h.w; i++) ctx.fillRect(x + i * T + 3 + (i % 3) * 3, y, 5, 1); ctx.globalAlpha = 1; }
    for (const c of bio.charcos) if (vis(c.x - 1, c.x + c.largo + 1)) { const x = r(c.x * T - camX), y = r((c.y + 1) * T - camY); ctx.fillStyle = OUT; ctx.fillRect(x, y - 7, c.largo * T, 7); ctx.fillStyle = '#9dff3a'; ctx.fillRect(x, y - 6, c.largo * T, 6); ctx.fillStyle = '#d6ff7a'; ctx.fillRect(x, y - 6, c.largo * T, 1); for (let i = 0; i < c.largo * 2; i++) { const ph = (t * 1.6 + i * 0.7) % 1.2; D(ctx, x + 4 + i * 8, y - 3 - ph * 8, 1 + (i % 2), 'rgba(214,255,122,' + (1 - ph / 1.2) + ')'); } }
    for (const m of bio.matraces) if (m.vivo && vis(m.x - 1, m.x + 1)) {
      const x = r(m.x * T - camX), y = r((m.y + 0.5) * T - camY);
      ctx.fillStyle = OUT; ctx.fillRect(x - 3, y - 15, 6, 7); ctx.fillRect(x - 8, y - 9, 16, 9); ctx.fillStyle = '#cfe0ff'; ctx.fillRect(x - 2, y - 14, 4, 6); ctx.fillStyle = '#e9f4ff'; ctx.fillRect(x - 7, y - 8, 14, 7);
      ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ff4d6d' : '#ff7a9a'; ctx.fillRect(x - 7, y - 5, 14, 4); for (let i = 0; i < 2; i++) D(ctx, x - 3 + i * 6, y - 7 - ((t * 8 + i * 3) % 3), 1, '#fff'); ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 7, 2, 4);
    }
    for (const v of bio.ventilas) if (vis(v.x - 1, v.x + 2)) {
      const x = r(v.x * T - camX), y = r(v.y * T - camY);
      ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 6, 18, 6); ctx.fillStyle = '#3fae6a'; ctx.fillRect(x, y - 5, 16, 4); ctx.fillStyle = '#7ad39a'; ctx.fillRect(x, y - 5, 16, 1); ctx.fillStyle = OUT; ctx.fillRect(x + 3, y - 7, 10, 2);
      if (v.on) { for (let i = 0; i < 16; i++) { const ph = (t * 2.2 + i * 0.37) % 1; D(ctx, x + 8 + Math.sin(i * 2 + t * 4) * 5, y - 8 - ph * v.alto * T, 2 + (i % 3), 'rgba(190,255,160,' + (0.55 - ph * 0.45) + ')'); } }
      else if (v.aviso) for (let i = 0; i < 3; i++) D(ctx, x + 8 + (i - 1) * 3, y - 9 - ((t * 20 + i * 4) % 8), 1, 'rgba(190,255,160,.7)');
    }
    for (const c of bio.cristales) if (vis(c.x - 1, c.x + 1)) {
      const x = r(c.x * T - camX), y = r(c.y * T - camY + Math.sin(t * 2 + c.ph) * 1.5), on = c.t > 0;
      if (on) { ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 6); D(ctx, x, y, 22, '#c9a6ff'); ctx.globalAlpha = 1; }
      ctx.fillStyle = OUT; ctx.fillRect(x - 5, y - 9, 10, 18); ctx.fillRect(x - 8, y - 3, 16, 9); ctx.fillStyle = on ? '#e6d4ff' : '#8d63d6'; ctx.fillRect(x - 3, y - 8, 6, 16); ctx.fillRect(x - 7, y - 2, 14, 7); ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 6, 2, 5);
    }
    for (const e of bio.efim) if (e.estado !== 'ausente' && vis(e.x - 1, e.x + e.w + 1)) {
      const x = r(e.x * T - camX), y = r(e.y * T - camY), ww = e.w * T, tem = e.estado === 'cede' ? r(Math.sin(t * 50) * 1.2) : 0;
      if (e.k === 'nube') { ctx.globalAlpha = e.estado === 'cede' ? 0.55 : 1; for (let i = 0; i < e.w * 2; i++) { const cx = x + 4 + i * 8 + tem; D(ctx, cx, y + 7 - (i % 2) * 2, 6 + (i % 3), '#d6e4ff'); D(ctx, cx, y + 6 - (i % 2) * 2, 5 + (i % 3), '#ffffff'); } ctx.fillStyle = '#d6e4ff'; ctx.fillRect(x + 4, y + 7, ww - 8, 5); ctx.globalAlpha = 1; }
      else { ctx.fillStyle = OUT; ctx.fillRect(x + tem, y, ww, 6); ctx.fillStyle = e.estado === 'cede' ? '#8a5a3a' : '#b07a4a'; ctx.fillRect(x + 1 + tem, y + 1, ww - 2, 4); ctx.fillStyle = '#d9a46a'; ctx.fillRect(x + 1 + tem, y + 1, ww - 2, 1); ctx.fillStyle = OUT; ctx.fillRect(x + 4 + tem, y + 2, 1, 2); ctx.fillRect(x + ww - 5 + tem, y + 2, 1, 2); }
    }
    for (const s of bio.tormentas) if (vis(s.x, s.x + s.w)) { const y = 0; ctx.globalAlpha = 0.65; for (let i = 0; i < s.w / 3; i++) { const x = r((s.x + i * 3) * T - camX); D(ctx, x, y + 6 + (i % 2) * 4, 14, '#3a3f5e'); D(ctx, x + 6, y + 10, 12, '#4a5078'); } ctx.globalAlpha = 1; }
    for (const a of bio.asteroides) if (vis(a.x - 2, a.x + 2)) {
      const x = r(a.x * T - camX), y = r(a.y * T - camY), R = r(a.rad * T);
      ctx.strokeStyle = 'rgba(180,170,200,.18)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.ellipse(r(a.cx * T - camX), r(a.cy * T - camY), a.rec * T, a.rec * T * 0.6, 0, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a.ang * 2); ctx.fillStyle = OUT; ctx.beginPath(); for (let i = 0; i < 9; i++) { const an = (i / 9) * 6.283, rr = R + 1 + (i % 3) * 1.5; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.fill(); ctx.fillStyle = '#8a7f9a'; ctx.beginPath(); for (let i = 0; i < 9; i++) { const an = (i / 9) * 6.283, rr = R - 1 + (i % 3) * 1.5; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.fill(); ctx.fillStyle = '#5a5068'; D(ctx, -3, -2, 2, '#5a5068'); D(ctx, 3, 3, 3, '#5a5068'); ctx.restore();
    }
    for (const y of bio.yunques) if (vis(y.x - 2, y.x + 3)) {
      const x = r((y.x + 0.5) * T - camX), py = r(y.y * T - camY), tem = y.estado === 'aviso' ? r(Math.sin(t * 60) * 1.5) : 0;
      ctx.fillStyle = '#4a5a78'; ctx.fillRect(x - 1, 0, 2, Math.max(0, py)); if (y.estado === 'aviso' && Math.floor(t * 14) % 2) { ctx.fillStyle = 'rgba(255,77,109,.5)'; ctx.fillRect(x - 13, r(y.floor * T - camY) - 2, 26, 2); }
      ctx.fillStyle = OUT; ctx.fillRect(x - 13 + tem, py, 26, 7); ctx.fillRect(x - 6 + tem, py + 6, 12, 7); ctx.fillRect(x - 10 + tem, py + 12, 20, 7); ctx.fillStyle = '#7d8aa8'; ctx.fillRect(x - 12 + tem, py + 1, 24, 5); ctx.fillRect(x - 5 + tem, py + 6, 10, 6); ctx.fillRect(x - 9 + tem, py + 12, 18, 6); ctx.fillStyle = '#b8c4dc'; ctx.fillRect(x - 12 + tem, py + 1, 24, 1);
    }
    for (const v of bio.vapores) if (vis(v.x - 2, v.x + v.largo + 2)) {
      const x = r(v.x * T - camX), y = r(v.y * T - camY), dx = v.dir === 'l' ? -1 : v.dir === 'r' ? 1 : 0, dy = v.dir === 'u' ? -1 : 0;
      ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 1, 18, 18); ctx.fillStyle = '#7d8aa8'; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = OUT; ctx.fillRect(x + (dx > 0 ? 12 : dx < 0 ? 0 : 3), y + (dy < 0 ? 0 : 3), dy ? 10 : 4, dy ? 4 : 10); ctx.fillStyle = v.aviso ? '#ffd166' : v.on ? '#ff4d6d' : '#2a3a5a'; ctx.fillRect(x + 7, y + 7, 2, 2);
      if (v.on || v.aviso) for (let i = 0; i < 12; i++) { const ph = (t * 3 + i * 0.31) % 1, dist = ph * v.largo * T * (v.on ? 1 : 0.3); D(ctx, x + 8 + dx * (10 + dist) + (dy ? Math.sin(i * 3) * 4 : 0), y + 8 + dy * (10 + dist) + (dx ? Math.sin(i * 3) * 4 : 0), 3 + ph * 4, 'rgba(235,245,255,' + ((v.on ? 0.6 : 0.3) - ph * 0.45) + ')'); }
    }
    for (const c of bio.cadenas) if (vis(c.x - 1, c.x + 1)) {
      const x = r(c.x * T - camX), y = r(c.y * T - camY); ctx.fillStyle = OUT; ctx.fillRect(x - 6, y - 5, 12, 6); ctx.fillStyle = '#c98a10'; ctx.fillRect(x - 5, y - 4, 10, 4);
      for (let i = 0; i < c.largo * 2; i++) { ctx.fillStyle = OUT; ctx.fillRect(x - 2 + (i % 2), y + i * 8, 4, 9); ctx.fillStyle = '#9aa7c4'; ctx.fillRect(x - 1 + (i % 2), y + 1 + i * 8, 2, 7); }
    }
    for (const t2 of bio.tornados) if (vis(t2.x - 3, t2.x + 3)) {
      const x = r((t2.x + 0.5) * T - camX), y = r(t2.y * T - camY);
      for (let i = 0; i < 12; i++) { const ph = i / 12, ww = 6 + ph * 22, yy = y - ph * t2.alto * T, ox = Math.sin(t * 6 + i) * (3 + ph * 5); ctx.globalAlpha = 0.75 - ph * 0.3; ctx.fillStyle = i % 2 ? '#cfd8e8' : '#9aa7c4'; ctx.fillRect(r(x + ox - ww / 2), r(yy - 4), r(ww), 6); } ctx.globalAlpha = 1;
    }
    for (const q of bio.trampolines) if (vis(q.x - 1, q.x + 3)) {
      const x = r(q.x * T - camX), y = r(q.y * T - camY), sq = q.sq > 0 ? 4 : 0; ctx.fillStyle = OUT; ctx.fillRect(x, y + 3 + sq, 26, 13 - sq); ctx.fillStyle = '#e6c34a'; ctx.fillRect(x + 1, y + 4 + sq, 24, 11 - sq); ctx.fillStyle = '#f5de7a'; ctx.fillRect(x + 1, y + 4 + sq, 24, 2); ctx.fillStyle = '#b8902a'; for (let i = 0; i < 5; i++) ctx.fillRect(x + 3 + i * 5, y + 6 + sq, 1, 8 - sq); ctx.fillStyle = '#c0392b'; ctx.fillRect(x + 10, y + 3 + sq, 6, 12 - sq);
    }
    for (const e of bio.espejos) if (vis(e.x - 1, e.x + 2)) {
      const x = r(e.x * T - camX), y = r(e.y * T - camY), h = e.alto * T; ctx.fillStyle = OUT; ctx.fillRect(x - 2, y - 2, 11, h + 4); ctx.fillStyle = '#7a8aa8'; ctx.fillRect(x - 1, y - 1, 9, h + 2); ctx.fillStyle = '#cfe9ff'; ctx.fillRect(x + 1, y + 1, 5, h - 2); ctx.fillStyle = '#fff'; for (let i = 0; i < h; i += 14) { ctx.fillRect(x + 2, y + 4 + i, 1, 7); ctx.fillRect(x + 3, y + 6 + i, 1, 5); }
    }
    for (const b of bio.bichos) {
      if (!b.vivo || !vis(b.x - 2, b.x + b.w + 2)) continue;
      const x = r(b.x * T - camX), y = r(b.y * T - camY), bl = b.flash > 0 && Math.floor(b.flash * 30) % 2 === 0, cx = x + r(b.w * T / 2), by = y + r(b.h * T), tt = t + b.ph;
      ctx.save(); if (b.muertoT > 0) ctx.globalAlpha = Math.max(0, 1 - b.muertoT / 0.45);
      if (b.esp === 'colgante') {
        const cy = y + 6, ala = Math.sin(tt * (b.estado === 'pica' ? 30 : b.estado === 'espera' ? 2 : 16)) * (b.estado === 'espera' ? 2 : 6);
        if (b.estado === 'espera') { ctx.fillStyle = OUT; ctx.fillRect(cx - 5, cy - 6, 10, 4); }
        ctx.fillStyle = OUT; ctx.fillRect(cx - 14, cy - 3 - ala, 12, 8); ctx.fillRect(cx + 2, cy - 3 - ala, 12, 8); ctx.fillRect(cx - 5, cy - 4, 10, 10); ctx.fillStyle = bl ? '#fff' : '#5a3a7a'; ctx.fillRect(cx - 13, cy - 2 - ala, 10, 6); ctx.fillRect(cx + 3, cy - 2 - ala, 10, 6); ctx.fillRect(cx - 4, cy - 3, 8, 8);
        ctx.fillStyle = b.estado === 'espera' ? '#ffd166' : '#ff4d6d'; ctx.fillRect(cx - 3, cy - 1, 2, 2); ctx.fillRect(cx + 1, cy - 1, 2, 2); ctx.fillStyle = OUT; ctx.fillRect(cx - 4, cy - 6, 2, 3); ctx.fillRect(cx + 2, cy - 6, 2, 3);
      } else if (b.esp === 'bola_nieve') {
        const R = r(b.w * T / 2), cy = y + R; D(ctx, cx, cy, R + 1, OUT); D(ctx, cx, cy, R, bl ? '#fff' : '#eef6ff'); ctx.fillStyle = '#bcd4f0'; for (let i = 0; i < 4; i++) { const a = (b.rot || 0) + i * 1.6; ctx.fillRect(r(cx + Math.cos(a) * R * 0.6) - 2, r(cy + Math.sin(a) * R * 0.6) - 1, 4, 3); } D(ctx, cx - 5, cy - 6, 3, '#fff');
        ctx.fillStyle = OUT; ctx.fillRect(cx + b.dir * 4 - 2, cy - 3, 3, 4); ctx.fillRect(cx + b.dir * 4 + 4, cy - 3, 3, 4); ctx.fillRect(cx + b.dir * 3, cy + 5, 8, 2);
      } else if (b.esp === 'espantapajaros') {
        const act = b.estado === 'activo'; ctx.fillStyle = OUT; if (!act) { ctx.fillRect(cx - 1, y + 4, 3, 24); ctx.fillRect(cx - 10, y + 12, 20, 3); ctx.fillStyle = '#8a5a3a'; ctx.fillRect(cx, y + 4, 1, 24); ctx.fillRect(cx - 9, y + 13, 18, 1); }
        ctx.fillStyle = OUT; ctx.fillRect(cx - 7, y + 8, 14, 12); ctx.fillStyle = bl ? '#fff' : '#d9b36a'; ctx.fillRect(cx - 6, y + 9, 12, 10); ctx.fillStyle = OUT; ctx.fillRect(cx - 4, y + 12, 2, 3); ctx.fillRect(cx + 2, y + 12, 2, 3); ctx.fillRect(cx - 3, y + 17, 6, 1);
        ctx.fillStyle = act ? '#ff4d6d' : OUT; if (act) { ctx.fillRect(cx - 4, y + 12, 2, 3); ctx.fillRect(cx + 2, y + 12, 2, 3); }
        ctx.fillStyle = OUT; ctx.fillRect(cx - 11, y + 5, 22, 4); ctx.fillRect(cx - 6, y, 12, 6); ctx.fillStyle = '#7a5a2a'; ctx.fillRect(cx - 10, y + 6, 20, 2); ctx.fillRect(cx - 5, y + 1, 10, 5); ctx.fillStyle = '#c0392b'; ctx.fillRect(cx - 5, y + 5, 10, 1);
        ctx.fillStyle = OUT; ctx.fillRect(cx - 8, y + 20, 16, 10); ctx.fillStyle = '#3d6fd1'; ctx.fillRect(cx - 7, y + 21, 14, 8); ctx.fillStyle = '#d9b36a'; ctx.fillRect(cx - 12, y + 20 + (act ? Math.sin(tt * 14) * 3 : 0), 4, 3); ctx.fillRect(cx + 8, y + 20 + (act ? Math.cos(tt * 14) * 3 : 0), 4, 3);
      } else if (b.esp === 'fantasma') {
        const cy = y + r(b.h * T / 2), sol = b.solido; ctx.globalAlpha = (b.muertoT > 0 ? Math.max(0, 1 - b.muertoT / 0.45) : 1) * (sol ? 1 : 0.5 + 0.2 * Math.sin(tt * 4));
        const col = sol ? '#a9a7b8' : '#c9c2ff', col2 = sol ? '#7d7b90' : '#8d83e0';
        ctx.fillStyle = OUT; ctx.fillRect(cx - 9, cy - 10, 18, 22); ctx.fillStyle = bl ? '#fff' : col; ctx.fillRect(cx - 8, cy - 9, 16, 19); ctx.fillStyle = col2; ctx.fillRect(cx - 8, cy + 4, 16, 6);
        for (let i = 0; i < 4; i++) { ctx.fillStyle = OUT; ctx.fillRect(cx - 9 + i * 5, cy + 11, 5, 3 + (sol ? 0 : Math.floor(tt * 8 + i) % 2)); ctx.fillStyle = col; ctx.fillRect(cx - 8 + i * 5, cy + 10, 4, 3); }
        if (sol) { ctx.fillStyle = OUT; ctx.fillRect(cx - 6, cy - 5, 4, 2); ctx.fillRect(cx + 2, cy - 5, 4, 2); ctx.fillRect(cx - 3, cy + 1, 6, 2); ctx.fillStyle = '#d9d7e6'; ctx.fillRect(cx - 7, cy - 8, 14, 1); }
        else { ctx.fillStyle = OUT; ctx.fillRect(cx - 6, cy - 6, 4, 5); ctx.fillRect(cx + 2, cy - 6, 4, 5); ctx.fillRect(cx - 3, cy + 1, 6, 5); ctx.fillStyle = '#ff4d6d'; ctx.fillRect(cx - 5, cy - 5, 2, 3); ctx.fillRect(cx + 3, cy - 5, 2, 3); }
      }
      ctx.restore();
    }
    for (const f of bio.fx) { const a = f.t / f.dur, x = r(f.x * T - camX), y = r(f.y * T - camY), R = r(f.rad * T * (0.3 + 0.7 * a)); ctx.globalAlpha = 1 - a * 0.75; D(ctx, x, y, R, '#ff7a1a'); D(ctx, x, y, r(R * 0.65), '#ffd166'); D(ctx, x, y, r(R * 0.3), '#fff3c0'); ctx.globalAlpha = 1; }
    if (g.cristalT > 0 && g.cristalT < 3 && Math.floor(t * 8) % 2) { ctx.fillStyle = 'rgba(201,166,255,.08)'; ctx.fillRect(0, 0, J.VW, J.VH); }
    if (g.jugador.enHielo && Math.floor(t * 6) % 3 === 0) { const pj = g.jugador; ctx.fillStyle = '#fff'; ctx.fillRect(r(pj.x * T - camX + pj.w * T / 2 - pj.dir * 6), r((pj.y + pj.h) * T - camY - 1), 2, 1); }
  };
})();
