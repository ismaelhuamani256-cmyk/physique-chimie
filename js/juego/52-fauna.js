// =====================================================================================
// 52-fauna.js — FAUNA y PELIGROS de las CUEVAS SUBMARINAS (todo diseño propio)
//   {"tipo":"fauna","especie":"…","x","y"}   x,y = casilla del centro (langosta: casilla sobre la que se apoya)
//   pirana     banco de pirañas: patrullan; si te huelen a < 9 tiles te PERSIGUEN y se lanzan en picado (se pisan o se disparan)
//   tiburon    tiburón gigante: ronda, te avisa (ojos rojos, «!») y embiste en línea recta; cansado tras chocar. Solo se hiere a tiros
//   langosta   langosta del fondo: alza la pinza y suelta una CAVITACIÓN (onda de choque/burbuja que crece). Se pisa o se dispara
//   submarino  sumergible que te persigue y lanza torpedos que te buscan. Solo se destruye a tiros
//   globo      pez globo: se HINCHA cuando te acercas (hinchado = púas, no se pisa); deshinchado se pisa o se dispara
//   mago       mago de coral: se teletransporta cerca de ti y lanza orbes teledirigidos. Se pisa o se dispara
//   mina       mina flotante con cadena: al tocarla o dispararla explota y arrastra a la fauna cercana
//   Sierras, láseres y cañones de 51-peligros.js también funcionan bajo el agua.
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const F = J.Fauna = {};
  const T = 16, OUT = '#0b1230', r = Math.round;
  const SOL = (t) => t === 1 || t === 3 || t === 4 || t === 5 || t === 6 || t === 7 || t === 8 || t === 9 || t === 10;
  const D = (...a) => J.Temas.disco(...a);
  const ESP = {
    pirana: { w: 0.95, h: 0.6, hp: 1 }, tiburon: { w: 4, h: 1.5, hp: 6 }, langosta: { w: 1.5, h: 1.0, hp: 2 },
    submarino: { w: 2.6, h: 1.3, hp: 4 }, globo: { w: 0.9, h: 0.9, hp: 1 }, mago: { w: 0.9, h: 1.3, hp: 1 }, mina: { w: 1, h: 1, hp: 1 },
  };
  F.ESPECIES = Object.keys(ESP);
  const DANO = { fuego: 1, perdigon: 0.6, foton: 1 };
  const nom = { pirana: 'Piraña', tiburon: 'Tiburón gigante', langosta: 'Langosta', submarino: 'Submarino', globo: 'Pez globo', mago: 'Mago de coral', mina: 'Mina' };

  F.iniciar = function (g) {
    const S = g.nivel.segmentos || [];
    g.fauna = S.filter((s) => s.tipo === 'fauna' && ESP[s.especie]).map((s) => {
      const d = ESP[s.especie], cx = s.x + 0.5, cy = s.especie === 'langosta' ? s.y + 1 - d.h / 2 : s.y + 0.5;
      return { esp: s.especie, w: d.w, h: d.h, x: cx - d.w / 2, y: cy - d.h / 2, x0: cx, y0: cy, dir: -1, vx: 0, vy: 0, estado: 'nada', t: 0, cd: 1 + (J.hash('f' + s.x + s.y) % 100) / 50, hp: d.hp, vivo: true, muertoT: 0, flash: 0, infl: 0, oculto: 0, ph: (J.hash('p' + s.x + s.y) % 628) / 100 };
    });
    g.faunaProy = []; g.faunaFx = [];
  };

  // ---------- utilidades ----------
  const libre = (g, x, y, w, h) => {
    for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2]]) if (SOL(g.w.get(Math.floor(px), Math.floor(py)))) return false;
    return true;
  };
  const mover = (g, e, dx, dy) => { if (libre(g, e.x + dx, e.y, e.w, e.h)) e.x += dx; else e.bloq = true; if (libre(g, e.x, e.y + dy, e.w, e.h)) e.y += dy; else e.bloq = true; };
  const centro = (e) => [e.x + e.w / 2, e.y + e.h / 2];
  const hacia = (e, tx, ty, v, dt) => { const [cx, cy] = centro(e), d = Math.hypot(tx - cx, ty - cy) || 1; return [((tx - cx) / d) * v * dt, ((ty - cy) / d) * v * dt]; };
  const toca = (p, e) => J.solapa(p, { x: e.x + 0.06, y: e.y + 0.06, w: e.w - 0.12, h: e.h - 0.12 });
  const circuloContra = (p, cx, cy, rad) => { const nx = Math.max(p.x, Math.min(cx, p.x + p.w)), ny = Math.max(p.y, Math.min(cy, p.y + p.h)); return Math.hypot(cx - nx, cy - ny) < rad; };

  function matar(g, e, por) {
    if (!e.vivo || e.muertoT > 0) return;
    e.muertoT = 0.001; J.Audio.sfx('pisoton'); const [cx, cy] = centro(e);
    J.chispas(g, cx * T, cy * T, e.esp === 'tiburon' ? 26 : 12, e.esp === 'mina' ? '#ffb020' : '#9fe7ff', 4);
    if (e.esp === 'tiburon') g.shake = Math.max(g.shake, 6);
    if (g.ui && g.ui.aviso && e.esp === 'tiburon') g.ui.aviso('¡Tiburón gigante vencido!');
  }
  function boom(g, x, y, rad, quien) {
    J.Audio.sfx('onda'); g.shake = Math.max(g.shake, 6); J.chispas(g, x * T, y * T, 22, '#ffb020', 5); J.chispas(g, x * T, y * T, 10, '#ffffff', 3);
    g.faunaFx.push({ x, y, rad, t: 0, dur: 0.4 });
    const p = g.jugador; if (!p.muriendo && Math.hypot(p.x + p.w / 2 - x, p.y + p.h / 2 - y) < rad) J.herir(g, x);
    for (const e of g.fauna) { if (e === quien || !e.vivo || e.muertoT > 0) continue; const [cx, cy] = centro(e); if (Math.hypot(cx - x, cy - y) < rad + e.w / 2) { if (e.esp === 'mina') { e.t = 0.12; e.estado = 'mecha'; } else damage(g, e, e.esp === 'tiburon' ? 3 : 9); } }
  }
  function damage(g, e, d) {
    if (!e.vivo || e.muertoT > 0 || e.oculto > 0) return false;
    e.hp -= d; e.flash = 0.15;
    if (e.hp <= 0) { if (e.esp === 'mina') { e.muertoT = 0.001; const [cx, cy] = centro(e); boom(g, cx, cy, 2.3, e); } else matar(g, e); }
    else J.Audio.sfx('pisoton');
    return true;
  }

  /** Disparos del jugador: true si el disparo se gasta aquí. */
  F.golpe = function (g, x, y, rad, por) {
    if (por === 'hielo') {
      for (const e of g.fauna || []) { if (!e.vivo || e.muertoT > 0 || e.oculto > 0 || e.esp === 'mina') continue; const [cx, cy] = centro(e); if (Math.abs(x - cx) < e.w / 2 + rad + 0.15 && Math.abs(y - cy) < e.h / 2 + rad + 0.15) { e.helado = 5; e.flash = 0.15; J.Audio.sfx('premio'); J.chispas(g, cx * T, cy * T, 12, '#d8f6ff', 3); return true; } }
      for (const q of g.faunaProy || []) if (!q.muerto && q.tipo !== 'cavit' && Math.hypot(x - q.x, y - q.y) < 0.7 + rad) { q.muerto = true; return true; }
      return false;
    }
    for (const q of g.faunaProy || []) if (!q.muerto && q.tipo !== 'cavit' && Math.hypot(x - q.x, y - q.y) < 0.7 + rad) { q.muerto = true; J.Audio.sfx('pisoton'); J.chispas(g, q.x * T, q.y * T, 8, '#ffffff', 3); return true; }
    for (const e of g.fauna || []) {
      if (!e.vivo || e.muertoT > 0 || e.oculto > 0) continue;
      const [cx, cy] = centro(e);
      if (Math.abs(x - cx) < e.w / 2 + rad + 0.15 && Math.abs(y - cy) < e.h / 2 + rad + 0.15) { damage(g, e, DANO[por] != null ? DANO[por] : 1); return true; }
    }
    return false;
  };

  /** Pisotón o contacto. blindado = no se puede pisar (rebota sin hacer daño al caer desde arriba). */
  function contacto(g, e, p, blindado, mortal) {
    if (p.muriendo || !toca(p, e)) return;
    const encima = p.vy > 0.3 && p.y + p.h - e.y < e.h * 0.6;
    if (p.estrella > 0 && !blindado) { matar(g, e); return; }
    if (encima) {
      p.vy = -g.F.v0 * 0.7; p.suelo = false; p.coyote = 0; p.saltando = false; J.Audio.sfx('pisoton');
      if (!blindado) { if (g.ui && g.ui.error) g.ui.error({ nombre: nom[e.esp], correccion: '' }); matar(g, e); }
    } else if (mortal !== false) J.herir(g, e.x + e.w / 2);
  }

  F.paso = function (g, dt) {
    if (!g.fauna) return;
    const p = g.jugador, pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    for (const e of g.fauna) {
      if (!e.vivo) continue;
      if (e.muertoT > 0) { e.muertoT += dt; if (e.muertoT > 0.45) e.vivo = false; continue; }
      e.t += dt; e.flash = Math.max(0, e.flash - dt); e.bloq = false;
      if (e.helado > 0) {   // congelado: inmóvil e inofensivo; se puede pisar (incluso los blindados salvo el tiburón)
        e.helado -= dt; if (!p.muriendo && e.esp !== 'mina' && toca(p, e) && p.vy > 0.3 && p.y + p.h - e.y < e.h * 0.7) { p.vy = -g.F.v0 * 0.7; p.suelo = false; p.coyote = 0; p.saltando = false; if (e.esp === 'tiburon') damage(g, e, 2); else matar(g, e); }
        continue;
      }
      const [cx, cy] = centro(e), dx = pcx - cx, dy = pcy - cy, d = Math.hypot(dx, dy), vivoP = !p.muriendo;
      if (d > 40) continue;
      switch (e.esp) {
        case 'pirana': {
          if (e.estado === 'nada') {
            const [mx, my] = hacia(e, e.x0 + Math.sin((e.t + e.ph) * 0.7) * 3, e.y0 + Math.sin((e.t + e.ph) * 1.3) * 0.7, 1.6, dt); e.dir = mx >= 0 ? 1 : -1; mover(g, e, mx, my);
            if (d < 9 && vivoP) { e.estado = 'caza'; e.t = 0; e.cd = 1.4 + (J.hash('c' + e.x0) % 100) / 100; }
          } else {
            e.cd -= dt; const lunge = e.cd < 0 && e.cd > -0.45, v = lunge ? 7.5 : 3.1 + Math.sin(e.t * 9 + e.ph) * 0.4; if (e.cd < -0.45) e.cd = 1.6;
            const [mx, my] = hacia(e, pcx, pcy + Math.sin(e.t * 6 + e.ph) * 0.3, v, dt); e.dir = mx >= 0 ? 1 : -1; mover(g, e, mx, my);
            if (d > 15 || !vivoP) { e.estado = 'nada'; e.t = 0; }
          }
          contacto(g, e, p, false); break;
        }
        case 'tiburon': {
          if (e.estado === 'nada') {
            const nx = e.x0 + Math.sin((e.t + e.ph) * 0.35) * 6; e.dir = Math.cos((e.t + e.ph) * 0.35) >= 0 ? 1 : -1;
            mover(g, e, J.clamp(nx - cx, -2.2 * dt, 2.2 * dt), J.clamp(e.y0 + Math.sin(e.t * 0.8) * 0.6 - cy, -1 * dt, 1 * dt));
            if (Math.abs(dy) < 3.6 && Math.abs(dx) < 13 && vivoP) { e.estado = 'aviso'; e.t = 0; e.dir = dx >= 0 ? 1 : -1; J.Audio.sfx('aviso'); }
          } else if (e.estado === 'aviso') { e.vy = 0; mover(g, e, 0, J.clamp(dy, -1.2, 1.2) * dt); if (e.t > 0.75) { e.estado = 'embiste'; e.t = 0; e.vx = e.dir * 9.5; J.Audio.sfx('fuego'); } }
          else if (e.estado === 'embiste') { mover(g, e, e.vx * dt, 0); if (e.bloq) { e.estado = 'cansado'; e.t = 0; g.shake = Math.max(g.shake, 7); J.Audio.sfx('onda'); } else if (e.t > 1.25) { e.estado = 'cansado'; e.t = -0.6; } }
          else if (e.estado === 'cansado' && e.t > 1.6) { e.estado = 'nada'; e.t = 0; e.y0 = J.clamp(e.y, 2, g.w.alto - 5); e.x0 = cx; }
          contacto(g, e, p, true); break;
        }
        case 'langosta': {
          if (e.estado === 'nada') {
            e.vx = e.dir * 0.9; const ax = e.x + e.vx * dt + (e.dir > 0 ? e.w : 0), suelo = SOL(g.w.get(Math.floor(ax), Math.floor(e.y + e.h + 0.3)));
            if (libre(g, e.x + e.vx * dt, e.y, e.w, e.h) && suelo && Math.abs(e.x + e.w / 2 - e.x0) < 2.5) e.x += e.vx * dt; else e.dir = -e.dir;
            if (Math.abs(dx) < 9 && Math.abs(dy) < 3.2 && vivoP) { e.dir = dx >= 0 ? 1 : -1; e.cd -= dt; if (e.cd <= 0) { e.estado = 'aviso'; e.t = 0; J.Audio.sfx('aviso'); } }
          } else if (e.estado === 'aviso') { if (e.t > 0.65) { g.faunaProy.push({ tipo: 'cavit', x: cx + e.dir * 1.0, y: cy - 0.1, vx: e.dir * 7.2, rad: 0.3, t: 0 }); J.Audio.sfx('onda'); e.estado = 'recarga'; e.t = 0; } }
          else if (e.estado === 'recarga' && e.t > 2.3) { e.estado = 'nada'; e.cd = 0.4; }
          contacto(g, e, p, false); break;
        }
        case 'submarino': {
          e.dir = dx >= 0 ? 1 : -1;
          if (d < 14 && vivoP) { const vx = Math.abs(dx) > 3.5 ? Math.sign(dx) * 2.3 : -Math.sign(dx) * 0.8; mover(g, e, vx * dt, J.clamp(dy, -1.6, 1.6) * dt); e.cd -= dt; if (e.cd <= 0 && d < 11) { e.cd = 3.2; g.faunaProy.push({ tipo: 'torpedo', x: cx + e.dir * 1.5, y: cy + 0.15, vx: e.dir * 5.2, vy: 0, t: 0 }); J.Audio.sfx('fuego'); } }
          else mover(g, e, Math.sin(e.t * 0.5 + e.ph) * 1.2 * dt, Math.sin(e.t * 1.1) * 0.5 * dt);
          contacto(g, e, p, true); break;
        }
        case 'globo': {
          const obj = d < 3.6 && vivoP ? 1 : 0; e.infl = J.clamp(e.infl + (obj ? 3 : -0.7) * dt * (obj > e.infl ? 1 : 1), 0, 1);
          const [mx, my] = hacia(e, e.x0 + Math.sin((e.t + e.ph) * 0.6) * 2.4, e.y0 + Math.sin((e.t + e.ph) * 1.1) * 0.8, 1.1, dt); e.dir = mx >= 0 ? 1 : -1; mover(g, e, mx, my);
          if (e.infl > 0.6) { const rad = 0.45 + 0.7 * e.infl; if (vivoP && circuloContra(p, cx, cy, rad)) { if (p.estrella > 0) matar(g, e); else J.herir(g, cx); } }
          else contacto(g, e, p, false);
          break;
        }
        case 'mago': {
          if (e.oculto > 0) { e.oculto -= dt; if (e.oculto <= 0) { e.estado = 'aparece'; e.t = 0; J.chispas(g, (e.x + e.w / 2) * T, (e.y + e.h / 2) * T, 14, '#c9a6ff', 3); J.Audio.sfx('premio'); } break; }
          e.y += Math.sin(e.t * 2 + e.ph) * 0.25 * dt; e.dir = dx >= 0 ? 1 : -1;
          if (e.estado === 'aparece' && e.t > 0.5) { e.estado = 'carga'; e.t = 0; J.Audio.sfx('aviso'); }
          else if (e.estado === 'carga' && e.t > 0.7) { g.faunaProy.push({ tipo: 'orbe', x: cx, y: cy - 0.2, vx: Math.sign(dx || 1) * 3.4, vy: J.clamp(dy, -1, 1) * 2, t: 0 }); J.Audio.sfx('fuego'); e.estado = 'nada'; e.t = 0; }
          else if (e.estado === 'nada' && e.t > 3.2 && d < 16 && vivoP) {   // se teletransporta cerca del jugador
            for (let k = 0; k < 14; k++) { const nx = pcx + (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 4), ny = pcy + (Math.random() - 0.5) * 4; if (libre(g, nx - e.w / 2, ny - e.h / 2, e.w, e.h)) { J.chispas(g, cx * T, cy * T, 14, '#c9a6ff', 3); e.x = nx - e.w / 2; e.y = ny - e.h / 2; e.oculto = 0.5; break; } }
            e.t = 0; if (e.oculto <= 0) e.t = 2;
          }
          if (e.oculto <= 0) contacto(g, e, p, false);
          break;
        }
        case 'mina': {
          const by = e.y0 + Math.sin((e.t + e.ph) * 1.4) * 0.3; e.y = by - e.h / 2; e.x = e.x0 - e.w / 2;
          if (e.estado === 'mecha') { if (e.t > 0.25) { e.muertoT = 0.001; boom(g, e.x0, by, 2.3, e); } break; }
          if (vivoP && toca(p, e)) { if (p.estrella > 0) matar(g, e); else { e.muertoT = 0.001; boom(g, e.x0, by, 2.3, e); } }
          break;
        }
      }
    }
    // proyectiles de la fauna
    for (const q of g.faunaProy) {
      q.t += dt;
      if (q.tipo === 'cavit') { q.x += q.vx * dt; q.rad = 0.3 + q.t * 0.7; if (q.t > 1.35 || SOL(g.w.get(Math.floor(q.x), Math.floor(q.y)))) q.muerto = true; else if (!p.muriendo && circuloContra(p, q.x, q.y, q.rad * 0.9)) { q.muerto = true; J.herir(g, q.x); } }
      else {
        const vel = q.tipo === 'torpedo' ? 5.4 : 4.2, hom = q.tipo === 'torpedo' ? 1.6 : 2.4;
        if (!p.muriendo && q.t < 3.2) { const tx = pcx - q.x, ty = pcy - q.y, d = Math.hypot(tx, ty) || 1; q.vx += (tx / d) * vel * hom * dt; q.vy += (ty / d) * vel * hom * dt; const v = Math.hypot(q.vx, q.vy) || 1; q.vx = (q.vx / v) * vel; q.vy = (q.vy / v) * vel; }
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.t > 4.2 || SOL(g.w.get(Math.floor(q.x), Math.floor(q.y)))) { q.muerto = true; if (q.tipo === 'torpedo') J.chispas(g, q.x * T, q.y * T, 10, '#ffb020', 3); }
        else if (!p.muriendo && Math.hypot(pcx - q.x, pcy - q.y) < (q.tipo === 'torpedo' ? 0.65 : 0.55)) { q.muerto = true; J.herir(g, q.x); }
      }
    }
    g.faunaProy = g.faunaProy.filter((q) => !q.muerto);
    for (const f of g.faunaFx) f.t += dt;
    g.faunaFx = g.faunaFx.filter((f) => f.t < f.dur);
  };

  // ---------- dibujo ----------
  function dPirana(ctx, e, x, y, t, bl) {
    const dir = e.dir, cx = r(x + e.w * T / 2), cy = r(y + e.h * T / 2), cuerpo = bl ? '#fff' : '#d93a3a', vientre = bl ? '#fff' : '#ffb02e', aleta = Math.floor(t * 14) % 2;
    ctx.fillStyle = OUT; ctx.fillRect(cx - 8, cy - 5, 16, 10);
    ctx.fillStyle = cuerpo; ctx.fillRect(cx - 7, cy - 4, 14, 7); ctx.fillStyle = vientre; ctx.fillRect(cx - 6, cy + 1, 12, 3);
    ctx.fillStyle = OUT; ctx.fillRect(cx - dir * 11, cy - 4 - aleta, 4, 3); ctx.fillRect(cx - dir * 11, cy + 1 + aleta, 4, 3); ctx.fillStyle = cuerpo; ctx.fillRect(cx - dir * 10, cy - 3 - aleta, 3, 2); ctx.fillRect(cx - dir * 10, cy + 1 + aleta, 3, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(cx + dir * 4 - 1, cy - 3, 3, 3); ctx.fillStyle = OUT; ctx.fillRect(cx + dir * 5, cy - 2, 1, 2);
    ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) ctx.fillRect(cx + dir * 6 - (dir > 0 ? 0 : 1), cy + i * 2, 1, 1);
    ctx.fillStyle = OUT; ctx.fillRect(cx + dir * 5 - 2, cy - 5, 5, 1);
    if (e.estado === 'caza') { ctx.fillStyle = '#ff4d6d'; ctx.fillRect(cx + dir * 4, cy - 4, 1, 1); }
  }
  function dTiburon(ctx, e, x, y, t, bl) {
    const dir = e.dir, w = r(e.w * T), h = r(e.h * T), cx = x + w / 2, cy = y + h / 2, az = bl ? '#fff' : '#4e6f99', az2 = bl ? '#fff' : '#6e91bd', ve = bl ? '#fff' : '#e6eef8';
    const s = (px, py, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(r(cx + dir * px - (dir < 0 ? ww : 0)), r(cy + py), ww, hh); };
    const col = Math.sin(t * 6) * 2;
    s(-31, -9 + col, 14, 18, OUT); s(-29, -8 + col, 12, 16, az);   // cola
    s(-31, -14 + col, 7, 7, OUT); s(-29, -13 + col, 5, 5, az2); s(-31, 7 + col, 7, 7, OUT); s(-29, 8 + col, 5, 5, az2);
    s(-20, -12, 44, 25, OUT); s(-19, -11, 42, 23, az); s(-19, 3, 42, 8, ve); s(-12, -11, 20, 3, az2);
    s(-2, -21, 12, 11, OUT); s(0, -20, 8, 9, az2);   // aleta dorsal
    s(22, -9, 8, 18, OUT); s(23, -8, 7, 14, az); s(23, 3, 7, 5, ve);
    s(-6, 8, 12, 7, OUT); s(-4, 8, 8, 5, az2);   // aleta pectoral
    const rojo = e.estado === 'aviso' || e.estado === 'embiste'; s(15, -7, 5, 5, OUT); s(16, -6, 3, 3, rojo ? '#ff4d6d' : '#fff'); s(17, -5, 1, 1, OUT);
    if (e.estado === 'cansado') { s(14, -8, 8, 2, OUT); }
    s(19, 5, 11, 3, OUT); ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) ctx.fillRect(r(cx + dir * (20 + i * 2) - (dir < 0 ? 1 : 0)), r(cy + 5), 1, 2);
    if (e.estado === 'aviso' && Math.floor(t * 12) % 2) { ctx.fillStyle = '#ff4d6d'; ctx.fillRect(r(cx + dir * 14), r(cy - 32), 4, 11); ctx.fillRect(r(cx + dir * 14), r(cy - 18), 4, 4); }
  }
  function dLangosta(ctx, e, x, y, t, bl) {
    const dir = e.dir, cx = r(x + e.w * T / 2), by = r(y + e.h * T), cu = bl ? '#fff' : '#d9542b', cu2 = bl ? '#fff' : '#f0824a', alza = e.estado === 'aviso' ? -5 : 0, pat = Math.floor(t * 6) % 2;
    ctx.fillStyle = OUT; ctx.fillRect(cx - 11, by - 12, 22, 12);
    ctx.fillStyle = cu; ctx.fillRect(cx - 10, by - 11, 20, 10); ctx.fillStyle = cu2; ctx.fillRect(cx - 9, by - 11, 18, 3);
    ctx.fillStyle = OUT; for (let i = -1; i <= 1; i++) { ctx.fillRect(cx + i * 6 - 1, by, 3, 3 + (pat && i === 0 ? 1 : 0)); }
    // pinzas
    ctx.fillStyle = OUT; ctx.fillRect(cx + dir * 10 - (dir < 0 ? 9 : 0), by - 14 + alza, 9, 9); ctx.fillRect(cx - dir * 10 - (dir > 0 ? 9 : 0), by - 11, 8, 7);
    ctx.fillStyle = cu; ctx.fillRect(cx + dir * 11 - (dir < 0 ? 7 : 0), by - 13 + alza, 7, 7); ctx.fillStyle = cu2; ctx.fillRect(cx + dir * 11 - (dir < 0 ? 7 : 0), by - 13 + alza, 7, 2);
    ctx.fillStyle = OUT; ctx.fillRect(cx + dir * 13 - (dir < 0 ? 3 : 0), by - 11 + alza, 3, 4);
    ctx.fillStyle = '#fff'; ctx.fillRect(cx + dir * 4, by - 14, 3, 3); ctx.fillRect(cx + dir * 4 - dir * 6, by - 14, 3, 3); ctx.fillStyle = OUT; ctx.fillRect(cx + dir * 5, by - 13, 1, 2); ctx.fillRect(cx + dir * 5 - dir * 6, by - 13, 1, 2);
    ctx.fillStyle = cu; ctx.fillRect(cx - dir * 16 - (dir > 0 ? 3 : 0), by - 8, 5, 4);
    if (e.estado === 'aviso') { ctx.strokeStyle = 'rgba(159,231,255,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx + dir * 16, by - 10, 3 + (e.t * 20) % 5, 0, 6.3); ctx.stroke(); }
  }
  function dSubmarino(ctx, e, x, y, t, bl) {
    const dir = e.dir, w = r(e.w * T), h = r(e.h * T), cx = x + w / 2, cy = y + h / 2, ca = bl ? '#fff' : '#d4a72c', ca2 = bl ? '#fff' : '#f2cf5a', osc = bl ? '#fff' : '#8a6a14';
    const s = (px, py, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(r(cx + dir * px - (dir < 0 ? ww : 0)), r(cy + py), ww, hh); };
    const el = Math.floor(t * 20) % 2;
    s(-24, -3, 8, 6, OUT); s(-23, -2 + el, 7, 4, osc); s(-22, -9 - el, 3, 4, OUT); s(-22, 3 + el, 3, 4, OUT);   // hélice
    s(-19, -9, 38, 18, OUT); s(-18, -8, 36, 16, ca); s(-18, -8, 36, 4, ca2); s(-18, 4, 36, 4, osc);
    s(-6, -16, 14, 8, OUT); s(-5, -15, 12, 7, ca); s(2, -20, 3, 5, OUT); s(2, -20, 8, 3, OUT); s(3, -19, 6, 1, ca2);   // torre y periscopio
    s(5, -5, 7, 7, OUT); s(6, -4, 5, 5, '#9fe7ff'); s(7, -3, 2, 2, '#fff');   // ojo de buey
    s(-13, -5, 5, 5, OUT); s(-12, -4, 3, 3, '#9fe7ff');
    const lamp = e.cd < 0.6 ? '#ff4d6d' : '#7dffb0'; s(19, -3, 4, 6, OUT); s(20, -2, 2, 4, lamp);
    s(-18, 8, 3, 3, osc); s(8, 8, 3, 3, osc);
  }
  function dGlobo(ctx, e, x, y, t, bl) {
    const dir = e.dir, cx = r(x + e.w * T / 2), cy = r(y + e.h * T / 2), R = r(5 + 11 * e.infl), cu = bl ? '#fff' : e.infl > 0.6 ? '#ffb53a' : '#f2c14e', vi = bl ? '#fff' : '#fff0b8';
    if (e.infl > 0.3) { ctx.fillStyle = bl ? '#fff' : '#c4701a'; for (let a = 0; a < 12; a++) { const an = (a / 12) * 6.283 + t * 0.4; ctx.fillRect(r(cx + Math.cos(an) * (R + 3) - 1), r(cy + Math.sin(an) * (R + 3) - 1), 3, 3); } }
    D(ctx, cx, cy, R + 1, OUT); D(ctx, cx, cy, R, cu); ctx.fillStyle = vi; ctx.fillRect(cx - R + 2, cy + 1, R * 2 - 4, r(R * 0.5));
    ctx.fillStyle = '#fff'; ctx.fillRect(cx + dir * r(R * 0.4) - 1, cy - 3, 4, 4); ctx.fillStyle = OUT; ctx.fillRect(cx + dir * r(R * 0.4) + (dir > 0 ? 1 : 0), cy - 2, 2, 3);
    ctx.fillStyle = OUT; ctx.fillRect(cx + dir * r(R * 0.5), cy + 3, e.infl > 0.5 ? 4 : 2, e.infl > 0.5 ? 3 : 1);
    const a = Math.floor(t * 10) % 2; ctx.fillStyle = OUT; ctx.fillRect(cx - dir * (R + 3), cy - 2 + a, 4, 5); ctx.fillStyle = cu; ctx.fillRect(cx - dir * (R + 2), cy - 1 + a, 3, 3);
  }
  function dMago(ctx, e, x, y, t, bl) {
    const dir = e.dir, cx = r(x + e.w * T / 2), by = r(y + e.h * T), tun = bl ? '#fff' : '#6a3fb5', tun2 = bl ? '#fff' : '#8d63d6', carga = e.estado === 'carga';
    if (e.estado === 'aparece') ctx.globalAlpha = Math.min(1, e.t / 0.5);
    ctx.fillStyle = OUT; ctx.fillRect(cx - 8, by - 14, 16, 15); ctx.fillStyle = tun; ctx.fillRect(cx - 7, by - 13, 14, 13); ctx.fillStyle = tun2; ctx.fillRect(cx - 7, by - 13, 14, 3);
    ctx.fillStyle = OUT; ctx.fillRect(cx - 6, by - 22, 12, 10); ctx.fillRect(cx - 3, by - 27, 7, 6); ctx.fillStyle = tun; ctx.fillRect(cx - 5, by - 21, 10, 8); ctx.fillRect(cx - 2, by - 26, 5, 5);
    ctx.fillStyle = '#ffd166'; ctx.fillRect(cx - 5, by - 15, 10, 2); ctx.fillRect(cx - 1, by - 24, 2, 2);
    ctx.fillStyle = '#ffe9c9'; ctx.fillRect(cx - 4, by - 12, 8, 5); ctx.fillStyle = OUT; ctx.fillRect(cx + dir * 2 - 1, by - 11, 1, 2); ctx.fillRect(cx + dir * 2 - dir * 3 - 1, by - 11, 1, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 4, by - 7, 8, 3);
    ctx.fillStyle = OUT; ctx.fillRect(cx + dir * 9 - 1, by - 22, 3, 22); ctx.fillStyle = '#b07a3a'; ctx.fillRect(cx + dir * 9, by - 21, 1, 20);
    D(ctx, cx + dir * 9 + 1, by - 24, carga ? 4 + (Math.floor(t * 20) % 2) : 3, carga ? '#ffffff' : '#c9a6ff'); D(ctx, cx + dir * 9 + 1, by - 24, 2, '#ff8ad8');
    ctx.globalAlpha = 1;
  }
  function dMina(ctx, e, x, y, t, bl, g, camY) {
    const cx = r(x + e.w * T / 2), cy = r(y + e.h * T / 2), mecha = e.estado === 'mecha';
    let fila = Math.floor(e.y0); while (fila < g.w.alto && !SOL(g.w.get(Math.floor(e.x0), fila))) fila++;
    const sy = r(fila * T - camY);   // cadena hasta el fondo
    ctx.fillStyle = '#4a5a78'; for (let yy = cy + 8; yy < sy; yy += 4) ctx.fillRect(cx - 1, yy, 2, 2);
    for (let a = 0; a < 8; a++) { const an = (a / 8) * 6.283; ctx.fillStyle = OUT; ctx.fillRect(r(cx + Math.cos(an) * 9 - 2), r(cy + Math.sin(an) * 9 - 2), 4, 4); ctx.fillStyle = '#8fa3c8'; ctx.fillRect(r(cx + Math.cos(an) * 9 - 1), r(cy + Math.sin(an) * 9 - 1), 2, 2); }
    D(ctx, cx, cy, 7, OUT); D(ctx, cx, cy, 6, bl || (mecha && Math.floor(t * 20) % 2) ? '#ffd0d0' : '#2a3350'); ctx.fillStyle = '#4c5a84'; ctx.fillRect(cx - 3, cy - 4, 3, 2);
    D(ctx, cx, cy, 2, Math.floor(t * 4) % 2 || mecha ? '#ff4d6d' : '#7a1d33');
  }
  F.dibujar = function (ctx, g, camX, camY, vis) {
    if (!g.fauna) return;
    for (const e of g.fauna) {
      if (!e.vivo || !vis(e.x - 2, e.x + e.w + 2) || e.oculto > 0) continue;
      const x = r(e.x * T - camX), y = r(e.y * T - camY), bl = e.flash > 0 && Math.floor(e.flash * 30) % 2 === 0, t = g.t + e.ph;
      ctx.save();
      if (e.muertoT > 0) { ctx.globalAlpha = Math.max(0, 1 - e.muertoT / 0.45); }
      ({ pirana: dPirana, tiburon: dTiburon, langosta: dLangosta, submarino: dSubmarino, globo: dGlobo, mago: dMago, mina: dMina })[e.esp](ctx, e, x, y, t, bl, g, camY);
      ctx.restore();
      if (e.helado > 0) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#bfefff'; ctx.fillRect(x - 1, y - 1, r(e.w * T) + 2, r(e.h * T) + 2); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(x + 2, y + 1, 3, 1); ctx.fillRect(x + r(e.w * T) - 6, y + r(e.h * T) - 3, 4, 1); }
    }
    for (const q of g.faunaProy) {
      const x = r(q.x * T - camX), y = r(q.y * T - camY);
      if (q.tipo === 'cavit') { const R = r(q.rad * T), a = Math.max(0.15, 1 - q.t / 1.4); ctx.globalAlpha = a; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.3); ctx.stroke(); ctx.strokeStyle = '#6fd0ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, Math.max(1, R - 3), 0, 6.3); ctx.stroke(); ctx.globalAlpha = a * 0.35; D(ctx, x, y, R, '#9fe7ff'); ctx.globalAlpha = 1; }
      else if (q.tipo === 'torpedo') { const a = Math.atan2(q.vy, q.vx); ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = OUT; ctx.fillRect(-7, -3, 14, 6); ctx.fillStyle = '#c9d4e8'; ctx.fillRect(-6, -2, 11, 4); ctx.fillStyle = '#ff4d6d'; ctx.fillRect(4, -2, 3, 4); ctx.fillStyle = '#ffb020'; ctx.fillRect(-9 - (Math.floor(q.t * 20) % 2) * 2, -1, 3, 2); ctx.restore(); }
      else { D(ctx, x, y, 6, 'rgba(201,166,255,.35)'); D(ctx, x, y, 4, '#8d63d6'); D(ctx, x, y, 2, '#ffffff'); }
    }
    for (const f of g.faunaFx) { const a = f.t / f.dur, x = r(f.x * T - camX), y = r(f.y * T - camY), R = r(f.rad * T * (0.3 + 0.7 * a)); ctx.globalAlpha = 1 - a * 0.75; D(ctx, x, y, R, '#ff7a1a'); D(ctx, x, y, r(R * 0.65), '#ffd166'); D(ctx, x, y, r(R * 0.3), '#fff3c0'); ctx.globalAlpha = 1; }
  };
})();
