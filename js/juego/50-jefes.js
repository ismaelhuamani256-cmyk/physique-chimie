// =====================================================================================
// 50-jefes.js — jefes de nivel
//   · "Gran Ejercicio" (ejercicio_bac_N): golem de ecuaciones. Embiste y salta; al chocar con la pared
//     queda ATURDIDO: píscalo y sale una pregunta del cours. 3 aciertos = derrotado; fallar lo enfurece.
//   · "Rey Entropía" (rey_entropia, nivel fortaleza): criatura de lava y engranajes, 3 fases (según aciertos).
//     Lanza bolas de fuego, ondas de choque y lluvia de brasas; cada ronda de ataques se SOBRECALIENTA
//     (aturdido) y hay que pisarlo y responder una pregunta.
// Diseños propios. Estados: entra · espera · aviso_* · carga · choque · salto · aturdido · pregunta · golpeado · vencido
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const Jefe = (J.Jefe = {});
  const BG = 22;   // gravedad propia de los jefes (independiente de la del nivel)

  const GOLEM = ['carga', 'salto', 'carga', 'salto'];
  const REY = [['bola', 'bola', 'arco'], ['onda', 'abanico', 'lluvia'], ['onda', 'abanico', 'lluvia', 'arco']];

  Jefe.crear = function (g) {
    const w = g.w, A = w.arena, seg = w.jefeSeg, rey = !!A.fort;
    const floorY = w.topAt(A.izq + 1);
    const b = {
      rey, w: rey ? 3 : 2.2, h: rey ? 3.6 : 2.6, hNormal: rey ? 3.6 : 2.6, hAt: rey ? 2.2 : 2.0,
      floorY, xmin: A.izq + 1, xmax: A.der, vx: 0, vy: 0, dir: -1, estado: 'entra', t: 0, anim: 0, flash: 0, reloj: 0,
      aire: true, aciertos: A.progreso.aciertos, furia: A.progreso.furia, pIdx: A.progreso.pIdx, ciclo: 0, ronda: 0, prog: [],
      preguntas: seg.preguntas || [], titulo: seg.titulo || (rey ? 'Rey Entropía' : 'Gran Ejercicio'), nombre: rey ? 'Rey Entropía' : 'Gran Ejercicio',
    };
    b.x = J.clamp(seg.x, b.xmin + 2, b.xmax - b.w - 1);
    b.y = floorY - b.h - 9;
    if (g.ui) g.ui.jefe(b);
    return b;
  };

  const guardar = (g, b) => { g.w.arena.progreso = { aciertos: b.aciertos, furia: b.furia, pIdx: b.pIdx }; };
  const furia = (b) => 1 + 0.2 * b.furia;
  const mirar = (b, p) => { b.dir = p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1; };
  const fase = (b) => Math.min(2, b.aciertos);

  function estado(b, e, t) { b.estado = e; b.t = t || 0; }
  function ponerAltura(b, h) { b.y += b.h - h; b.h = h; }

  // ---------- proyectiles ----------
  function bola(g, b, x, y, vx, vy, grav) { g.proy.push({ tipo: 'bola', x, y, vx, vy, grav: grav || 0, t: 0 }); J.Audio.sfx('fuego'); }
  function ondas(g, b) {
    const y = b.floorY, cx = b.x + b.w / 2, v = 6.5 + furia(b);
    g.proy.push({ tipo: 'onda', x: cx - 1, y, vx: -v, vida: 4, t: 0 }, { tipo: 'onda', x: cx + 1, y, vx: v, vida: 4, t: 0 });
    g.shake = 7; J.Audio.sfx('onda');
    J.chispas(g, cx * J.T, y * J.T, 14, '#ffd166', 4);
  }
  function programar(b, dt, fn) { b.prog.push({ t: b.reloj + dt, fn }); }

  // ---------- IA ----------
  function elegirAtaque(g, b) {
    const p = g.jugador;
    mirar(b, p);
    if (!b.rey) { const a = GOLEM[b.ciclo++ % GOLEM.length]; estado(b, a === 'carga' ? 'aviso_carga' : 'aviso_salto'); return; }
    const lim = 3 + (fase(b) > 0 ? 1 : 0);
    if (b.ronda >= lim) { b.ronda = 0; ponerAltura(b, b.hAt); estado(b, 'aturdido'); J.Audio.sfx('fallo'); J.chispas(g, (b.x + b.w / 2) * J.T, (b.y + 1) * J.T, 16, '#cfd8f0', 2, -3); return; }
    const lista = REY[fase(b)], a = lista[b.ciclo++ % lista.length];
    b.ronda++;
    estado(b, 'aviso_' + a);
  }

  Jefe.update = function (g, dt) {
    const b = g.jefe, p = g.jugador, F = g.F, w = g.w;
    if (!b) return;
    b.t += dt; b.anim += dt; b.reloj += dt; b.flash = Math.max(0, b.flash - dt);
    const f = furia(b);
    for (const pr of b.prog.slice()) if (b.reloj >= pr.t) { pr.fn(); b.prog.splice(b.prog.indexOf(pr), 1); }
    const cx = b.x + b.w / 2;
    switch (b.estado) {
      case 'entra': break;
      case 'espera': {
        mirar(b, p);
        if (b.rey) {   // el Rey patrulla despacio cerca del lado derecho
          const objetivo = J.clamp(p.x + 9, b.xmax - 14, b.xmax - b.w - 1);
          b.vx = Math.abs(objetivo - b.x) > 0.6 ? Math.sign(objetivo - b.x) * (1.3 + 0.3 * b.furia) : 0;
        } else b.vx = 0;
        if (b.t > (b.rey ? 1.4 : 1.1) / f) { b.vx = 0; elegirAtaque(g, b); }
        break;
      }
      case 'aviso_carga':
        b.vx = 0; if (b.t > 0.85 / f) { estado(b, 'carga'); b.vx = b.dir * (7.5 + f); J.Audio.sfx('fuego'); }
        break;
      case 'carga':
        if (Math.random() < 0.5) J.chispas(g, cx * J.T - b.dir * 14, b.floorY * J.T, 1, '#cfd8f0', 1.5, 2);
        break;
      case 'choque':
        if (b.t > 0.5) { estado(b, 'aturdido'); }
        break;
      case 'aviso_salto':
        b.vx = 0;
        if (b.t > 0.55 / f) {
          const T = (2 * 15) / BG;
          b.vy = -15; b.aire = true; b.vx = J.clamp((p.x + p.w / 2 - cx) / T, -6, 6); estado(b, 'salto');
        }
        break;
      case 'salto': break;
      case 'aviso_bola':
        b.vx = 0; if (b.t > 0.55 / f) {
          bola(g, b, cx + b.dir * 1.2, b.floorY - 0.55, b.dir * (6.5 + f), 0);
          estado(b, 'espera', 0.7);
        }
        break;
      case 'aviso_arco':
        b.vx = 0; if (b.t > 0.6 / f) {
          const T = 1.25, x0 = cx + b.dir * 0.5, y0 = b.y + 0.6, xt = J.clamp(p.x + p.w / 2, b.xmin, b.xmax), yt = b.floorY - 0.4;
          bola(g, b, x0, y0, (xt - x0) / T, (yt - y0 - 0.5 * 16 * T * T) / T, 16);
          estado(b, 'espera', 0.7);
        }
        break;
      case 'aviso_onda':
        b.vx = 0; if (b.t > 0.8 / f) { ondas(g, b); estado(b, 'espera', 0.6); }
        break;
      case 'aviso_abanico':
        b.vx = 0; if (b.t > 0.55 / f) {
          [0, 0.4, 0.8].forEach((dt2, i) => programar(b, dt2 / f, () => {
            if (g.jefe !== b || b.estado === 'pregunta') return;
            const alta = i === 1;
            bola(g, b, b.x + b.w / 2 + b.dir * 1.3, b.floorY - (alta ? 1.9 : 0.55), b.dir * (6 + f), 0);
          }));
          estado(b, 'espera', 0.2 - 0.6 / f);
        }
        break;
      case 'aviso_lluvia':
        b.vx = 0; if (b.t > 0.5 / f) {
          for (let i = 0; i < 4 + fase(b); i++) {
            const x = J.clamp(p.x + p.w / 2 + (i - 1.5) * 2.4 + (Math.random() - 0.5), b.xmin + 0.8, b.xmax - 0.8);
            g.proy.push({ tipo: 'marca', x, y: b.floorY, t: 0, dur: 0.85, luego: () => bola(g, b, x, b.floorY - 10, 0, 9, 0) });
          }
          J.Audio.sfx('aviso'); estado(b, 'espera', 0.1);
        }
        break;
      case 'aturdido': {
        b.vx = 0;
        const dur = (b.rey ? 6.5 : 5.2) / (1 + 0.08 * b.furia);
        if (b.rey && Math.random() < 0.25) J.chispas(g, (cx + (Math.random() - 0.5) * b.w) * J.T, (b.y + 0.5) * J.T, 1, '#e8f0ff', 1.5, -4);
        if (b.t > dur) { ponerAltura(b, b.hNormal); estado(b, 'espera'); b.ronda = 0; }
        break;
      }
      case 'golpeado':
        if (b.t > 1.1) { ponerAltura(b, b.hNormal); estado(b, 'espera', 0); }
        break;
      case 'cayendo':
        b.vy += BG * dt; b.y += b.vy * dt; b.vx = 0;
        if (b.y > w.alto + 1) derrotar(g, b);
        break;
      case 'vencido':
        if (Math.random() < 0.5) J.chispas(g, (b.x + Math.random() * b.w) * J.T, (b.y + Math.random() * b.h) * J.T, 4, ['#ffd166', '#ff7a2a', '#fff'][(Math.random() * 3) | 0], 4, 0);
        if (b.t > 1.5) { g.jefe = null; return; }
        break;
      case 'pregunta': b.vx = 0; break;
    }
    // física del jefe
    if (b.estado !== 'cayendo') {
      b.x += b.vx * dt;
      let pared = 0;
      if (b.x < b.xmin) { b.x = b.xmin; pared = -1; } else if (b.x + b.w > b.xmax) { b.x = b.xmax - b.w; pared = 1; }
      if (pared && b.estado === 'carga') { estado(b, 'choque'); b.vx = 0; g.shake = 8; J.Audio.sfx('onda'); J.chispas(g, (pared > 0 ? b.x + b.w : b.x) * J.T, (b.y + b.h / 2) * J.T, 16, '#cfd8f0', 4); }
      if (pared && b.estado === 'salto') b.vx = 0;
      if (b.aire) {
        b.vy += BG * dt; b.y += b.vy * dt;
        if (b.y + b.h >= b.floorY) {
          b.y = b.floorY - b.h; b.vy = 0; b.aire = false;
          g.shake = 8; J.Audio.sfx('onda'); J.chispas(g, (b.x + b.w / 2) * J.T, b.floorY * J.T, 14, '#cfd8f0', 3);
          if (b.estado === 'entra') estado(b, 'espera');
          else if (b.estado === 'salto') { ondas(g, b); estado(b, 'espera', 0.5); }
        }
      }
    }
    contacto(g, b);
  };

  /** Pisotón (aturdido -> pregunta), rebote o daño según el estado. */
  function contacto(g, b) {
    const p = g.jugador, F = g.F;
    if (p.muriendo || !J.solapa(p, b) || ['vencido', 'cayendo', 'pregunta', 'entra'].includes(b.estado)) return;
    const encima = p.vy > 0.3 && p.y + p.h - b.y < 0.85;
    if (b.estado === 'aturdido') {
      if (!encima) return;                      // aturdido: inofensivo de lado
      p.vy = -F.v0 * 0.8; p.suelo = false; p.coyote = 0; p.saltando = false;
      J.Audio.sfx('pisoton'); b.flash = 0.3; b.estado = 'pregunta'; b.t = 0;
      g.preguntar(b);
    } else if (b.estado === 'golpeado') { /* intocable */ }
    else if (encima) { p.vy = -F.v0 * 0.7; p.suelo = false; p.coyote = 0; p.saltando = false; J.Audio.sfx('pisoton'); }
    else J.herir(g, b.x + b.w / 2);
  }

  /** Resultado de la pregunta (lo llama la UI). */
  Jefe.respuesta = function (g, b, ok) {
    if (!g.jefe || g.jefe !== b) return;
    if (ok) {
      b.aciertos++; b.flash = 0.8; J.Audio.sfx('acierto');
      J.chispas(g, (b.x + b.w / 2) * J.T, (b.y + b.h / 2) * J.T, 22, '#2ee59d', 5);
      guardar(g, b);
      if (b.aciertos >= 3) derrotar(g, b);
      else {
        estado(b, 'golpeado'); b.vx = 0; b.ronda = 0; b.ciclo = 0;
        if (g.ui) g.ui.aviso(b.rey ? `¡Fase ${b.aciertos + 1}!` : '¡Acierto!');
      }
    } else {
      b.furia++; J.Audio.sfx('fallo'); guardar(g, b);
      ponerAltura(b, b.hNormal); estado(b, 'espera', 0); b.ronda = 0;
      g.shake = 5; if (g.ui) g.ui.aviso('¡El jefe se enfurece!');
    }
    if (g.ui) g.ui.jefe(b);
  };

  function derrotar(g, b) {
    const w = g.w, A = w.arena;
    b.estado = 'vencido'; b.t = 0; b.aciertos = 3; b.vx = 0;
    A.derrotado = true; A.activa = false; w.bloqueos.forEach((k) => (k.activo = false));
    if (w.meta) w.meta.bloqueada = false;
    g.jefeDerrotado = true; guardar(g, b);
    J.Audio.sfx('victoria'); g.shake = 10;
    if (g.ui) { g.ui.aviso(b.rey ? '¡Rey Entropía derrotado!' : '¡Ejercicio resuelto!'); g.ui.jefe(b); }
    if (A.fort) g.victoriaEn = 2.8;
  }

  /** La palanca tira el puente: si el jefe está encima, cae con él y queda derrotado. */
  Jefe.sobrePuente = function (g, br) {
    const b = g.jefe;
    if (!b || ['vencido', 'cayendo'].includes(b.estado)) return;
    const cx = b.x + b.w / 2;
    if (cx >= br.x && cx <= br.x + br.largo && Math.abs(b.y + b.h - br.y) < 0.4) { estado(b, 'cayendo'); b.vy = 0; b.aire = false; }
  };

  // ---------- dibujo ----------
  const OUT = '#0b1230';
  function txt(ctx, s, x, y, color) { ctx.font = '8px PixelHUD, monospace'; ctx.fillStyle = color; ctx.fillText(s, Math.round(x), Math.round(y)); }

  Jefe.dibujar = function (ctx, g, camX, camY) {
    const b = g.jefe; if (!b) return;
    const T = J.T, px = Math.round(b.x * T - camX), py = Math.round(b.y * T - camY), wpx = Math.round(b.w * T), hpx = Math.round(b.h * T), t = b.anim;
    const tiembla = (b.estado === 'aviso_carga' || b.estado === 'aviso_salto' || b.estado === 'aviso_onda') ? Math.round(Math.sin(t * 60) * 1.5) : 0;
    const blanco = b.flash > 0 && Math.floor(b.flash * 20) % 2 === 0;
    ctx.save();
    if (b.estado === 'vencido') ctx.globalAlpha = Math.max(0, 1 - b.t / 1.5);
    if (b.rey) dibujarRey(ctx, b, px + tiembla, py, wpx, hpx, t, blanco); else dibujarGolem(ctx, b, px + tiembla, py, wpx, hpx, t, blanco);
    ctx.restore();
    if (b.estado === 'aturdido' || b.estado === 'pregunta') {   // estrellitas mareadas
      for (let i = 0; i < 4; i++) {
        const a = t * 4 + (i * Math.PI) / 2;
        ctx.fillStyle = '#ffd166'; ctx.fillRect(Math.round(px + wpx / 2 + Math.cos(a) * 16 - 1), Math.round(py - 6 + Math.sin(a) * 4), 3, 3);
        ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(px + wpx / 2 + Math.cos(a) * 16), Math.round(py - 5 + Math.sin(a) * 4), 1, 1);
      }
      if (b.estado === 'aturdido' && Math.floor(t * 3) % 2 === 0) txt(ctx, '▼', px + wpx / 2 - 4, py - 12 + Math.round(Math.sin(t * 8) * 2), '#ffd166');
    }
  };

  function dibujarGolem(ctx, b, x, y, w, h, t, blanco) {
    const piedra = blanco ? '#ffffff' : b.furia > 1 ? '#8a5a78' : '#6b7390', claro = blanco ? '#fff' : b.furia > 1 ? '#b9789c' : '#8f98b8', osc = blanco ? '#ddd' : '#434a68';
    const corre = b.estado === 'carga' ? Math.floor(t * 14) % 2 : Math.floor(t * 2) % 2;
    const ojo = b.estado === 'aturdido' || b.estado === 'pregunta' ? null : b.furia > 0 || b.estado === 'carga' || b.estado === 'aviso_carga' ? '#ff4d6d' : '#ffd166';
    const arriba = b.estado === 'aviso_salto' || b.estado === 'aviso_carga' ? -6 : 0;
    // piernas
    ctx.fillStyle = OUT; ctx.fillRect(x + 4, y + h - 13, 11, 13); ctx.fillRect(x + w - 15, y + h - 13, 11, 13);
    ctx.fillStyle = osc; ctx.fillRect(x + 5, y + h - 12 - (corre ? 2 : 0), 9, 11); ctx.fillRect(x + w - 14, y + h - 12 - (corre ? 0 : 2), 9, 11);
    // torso
    const ty = y + 12;
    ctx.fillStyle = OUT; ctx.fillRect(x + 2, ty - 1, w - 4, h - 24);
    ctx.fillStyle = piedra; ctx.fillRect(x + 3, ty, w - 6, h - 26);
    ctx.fillStyle = claro; ctx.fillRect(x + 3, ty, w - 6, 2); ctx.fillRect(x + 3, ty, 2, h - 26);
    // placa del pecho con ecuaciones
    ctx.fillStyle = '#121a3c'; ctx.fillRect(x + 8, ty + 4, w - 16, h - 34);
    const s = ['Σ', '∫', '='][Math.floor(t * 1.5) % 3];
    txt(ctx, s, x + w / 2 - 3, ty + 14, '#19e3ff');
    ctx.fillStyle = '#19e3ff'; ctx.fillRect(x + 10, ty + 6, 3, 1); ctx.fillRect(x + w - 13, ty + h - 33, 3, 1);
    // brazos
    const sw = b.estado === 'carga' ? 6 : Math.round(Math.sin(t * 2) * 2);
    ctx.fillStyle = OUT; ctx.fillRect(x - 5, ty + 2 + arriba, 9, 22); ctx.fillRect(x + w - 4, ty + 2 + arriba, 9, 22);
    ctx.fillStyle = piedra; ctx.fillRect(x - 4, ty + 3 + arriba + sw, 7, 20); ctx.fillRect(x + w - 3, ty + 3 + arriba - sw, 7, 20);
    ctx.fillStyle = osc; ctx.fillRect(x - 4, ty + 19 + arriba + sw, 7, 4); ctx.fillRect(x + w - 3, ty + 19 + arriba - sw, 7, 4);
    // cabeza
    const hy = y + 2 - Math.round(Math.sin(t * 3) * 1);
    ctx.fillStyle = OUT; ctx.fillRect(x + 8, hy, w - 16, 15);
    ctx.fillStyle = piedra; ctx.fillRect(x + 9, hy + 1, w - 18, 13); ctx.fillStyle = claro; ctx.fillRect(x + 9, hy + 1, w - 18, 2);
    if (ojo) { ctx.fillStyle = ojo; ctx.fillRect(x + 12, hy + 5, 4, 3); ctx.fillRect(x + w - 16, hy + 5, 4, 3); }
    else { txt(ctx, 'x', x + 11, hy + 12, '#ffd166'); txt(ctx, 'x', x + w - 17, hy + 12, '#ffd166'); }
    ctx.fillStyle = OUT; ctx.fillRect(x + 14, hy + 10, w - 28, 2);
    // símbolos que orbitan
    ['x²', '∑', 'Δ'].forEach((sy, i) => { const a = t * 1.6 + i * 2.1; txt(ctx, sy, x + w / 2 + Math.cos(a) * (w / 2 + 6) - 4, y + h / 2 + Math.sin(a) * 6, 'rgba(111,240,255,.8)'); });
  }

  function dibujarRey(ctx, b, x, y, w, h, t, blanco) {
    const S = J.Sprites;
    const roca = blanco ? '#fff' : '#2a0f10', roca2 = blanco ? '#eee' : '#3d1816', lava = blanco ? '#fff' : '#ff7a1a', lava2 = '#ffd166';
    const kneel = b.estado === 'aturdido' || b.estado === 'pregunta';
    const pulso = 0.5 + 0.5 * Math.sin(t * (kneel ? 3 : 7));
    const levanta = b.estado.startsWith('aviso_') ? -8 : 0;
    // patas
    ctx.fillStyle = OUT; ctx.fillRect(x + 4, y + h - 14, 14, 14); ctx.fillRect(x + w - 18, y + h - 14, 14, 14);
    ctx.fillStyle = roca2; ctx.fillRect(x + 5, y + h - 13, 12, 12); ctx.fillRect(x + w - 17, y + h - 13, 12, 12);
    ctx.fillStyle = lava; ctx.fillRect(x + 7, y + h - 6, 8, 1); ctx.fillRect(x + w - 15, y + h - 6, 8, 1);
    // torso
    const ty = y + (kneel ? 6 : 14), th = h - (kneel ? 18 : 28);
    ctx.fillStyle = OUT; ctx.fillRect(x + 3, ty - 1, w - 6, th + 2);
    ctx.fillStyle = roca; ctx.fillRect(x + 4, ty, w - 8, th);
    ctx.fillStyle = roca2; ctx.fillRect(x + 4, ty, w - 8, 3);
    // grietas de lava
    ctx.fillStyle = lava;
    [[10, 4, 1, 8], [w - 14, 6, 1, 10], [14, th - 10, 8, 1], [w - 22, th - 14, 1, 8], [w / 2, 2, 1, 5]].forEach(([a, c, ww, hh]) => ctx.fillRect(x + a, ty + c, ww, hh));
    // núcleo con engranaje
    const kx = x + w / 2, ky = ty + th / 2;
    ctx.fillStyle = OUT; ctx.fillRect(kx - 10, ky - 10, 20, 20);
    ctx.globalAlpha *= 0.55 + 0.45 * pulso; ctx.fillStyle = lava; ctx.fillRect(kx - 9, ky - 9, 18, 18); ctx.globalAlpha = 1;
    S.engranaje(ctx, kx, ky, 7, 8, t * (kneel ? 0.3 : 2), lava2, 2);
    // engranajes en los hombros
    S.engranaje(ctx, x + 3, ty + 4, 8, 8, t * 1.2, '#8a5a3a', 3);
    S.engranaje(ctx, x + w - 3, ty + 4, 8, 8, -t * 1.2, '#8a5a3a', 3);
    // brazos / puños de lava
    const sw = Math.round(Math.sin(t * 2.5) * 2);
    [[x - 9, 1], [x + w - 5, -1]].forEach(([ax, s]) => {
      ctx.fillStyle = OUT; ctx.fillRect(ax, ty + 6 + levanta + (kneel ? 14 : 0), 14, 22);
      ctx.fillStyle = roca2; ctx.fillRect(ax + 1, ty + 7 + levanta + (kneel ? 14 : 0) + s * sw, 12, 20);
      ctx.fillStyle = lava; ctx.fillRect(ax + 1, ty + 21 + levanta + (kneel ? 14 : 0) + s * sw, 12, 6); ctx.fillStyle = lava2; ctx.fillRect(ax + 3, ty + 22 + levanta + (kneel ? 14 : 0) + s * sw, 8, 2);
    });
    // cabeza con corona de engranaje en llamas
    const hy = y + (kneel ? 0 : 2);
    ctx.fillStyle = OUT; ctx.fillRect(x + 12, hy + 8, w - 24, 18);
    ctx.fillStyle = roca2; ctx.fillRect(x + 13, hy + 9, w - 26, 16);
    ctx.fillStyle = kneel ? '#7a8aa8' : lava2; ctx.fillRect(x + 15, hy + 13, 6, 3); ctx.fillRect(x + w - 21, hy + 13, 6, 3);
    ctx.fillStyle = OUT; ctx.fillRect(x + 17, hy + 14, 2, 1);
    ctx.fillStyle = '#fff'; ctx.fillRect(x + 16, hy + 20, 3, 3); ctx.fillRect(x + w - 19, hy + 20, 3, 3); ctx.fillRect(x + w / 2 - 1, hy + 21, 3, 3);
    S.engranaje(ctx, x + w / 2, hy + 4, 7, 6, -t * 1.6, '#c98a10', 2);
    if (!kneel) for (let i = 0; i < 5; i++) { const fh = 4 + Math.round(Math.abs(Math.sin(t * 9 + i * 2)) * 6); ctx.fillStyle = i % 2 ? lava2 : lava; ctx.fillRect(x + w / 2 - 10 + i * 5, hy - 4 - fh + 8, 3, fh); }
  }

  /** Proyectiles, marcas de peligro y muros de energía. */
  Jefe.dibujarProy = function (ctx, g, camX, camY) {
    const T = J.T, t = g.t;
    for (const q of g.proy) {
      if (q.tipo === 'marca') {
        const a = q.t / q.dur, sx = Math.round(q.x * T - camX), sy = Math.round(q.y * T - camY);
        ctx.fillStyle = Math.floor(q.t * 14) % 2 ? '#ff4d6d' : '#ffd166';
        ctx.fillRect(sx - 8, sy - 2, 16, 2); ctx.fillRect(sx - 5, sy - 5, 10, 2); ctx.fillRect(sx - 2, sy - 8 - Math.round(a * 3), 4, 2);
      } else if (q.tipo === 'bola') {
        const sx = Math.round(q.x * T - camX), sy = Math.round(q.y * T - camY);
        for (let i = 3; i > 0; i--) { ctx.globalAlpha = 0.18 * (4 - i); ctx.fillStyle = '#ff7a1a'; ctx.fillRect(sx - Math.round(q.vx * i * 1.2) - 3, sy - Math.round(q.vy * i * 0.6) - 3, 6, 6); }
        ctx.globalAlpha = 1;
        J.Temas.disco(ctx, sx, sy, 6, OUT); J.Temas.disco(ctx, sx, sy, 5, '#ff4d2e'); J.Temas.disco(ctx, sx + (Math.floor(t * 12) % 2) - 1, sy, 3, '#ffb020'); ctx.fillStyle = '#fff3c0'; ctx.fillRect(sx - 1, sy - 1, 2, 2);
      } else if (q.tipo === 'onda') {
        const sx = Math.round(q.x * T - camX), sy = Math.round(q.y * T - camY), d = Math.sign(q.vx);
        for (let i = 0; i < 6; i++) { ctx.fillStyle = i < 2 ? '#fff3c0' : i < 4 ? '#ffd166' : '#ff7a1a'; ctx.fillRect(sx - d * i * 3 - 3, sy - 11 + i * 2, 4, 11 - i * 2); }
        ctx.fillStyle = OUT; ctx.fillRect(sx - 4, sy - 1, 8, 1);
      }
    }
  };
})();
