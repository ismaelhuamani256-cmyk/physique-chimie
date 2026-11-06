// =====================================================================================
// 45-quiz.js — mecánicas del modo QUIZ QUEST (CONTRATO §4b): responder bien es la mecánica.
//   · bloque_pregunta : se golpea desde abajo; acierto = premio (moneda/vida/pista/escudo/estrella/reloj)
//   · tuberia         : ↓/E encima; acierto = atajo (teletransporte) o sala de monedas (bonus)
//   · puerta          : ↑/E delante; acierto = la puerta se abre; fallo = cooldown y reintento
//   · zona_agua       : la física de natación está en 40-mundo.js (pasoJugador); aquí el dibujo y los enemigos acuáticos
// Todo el modal de pregunta lo pone 60-ui.js (ui.preguntaQ); aquí se cuenta {correctas,total}.
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const Q = (J.Quiz = {});
  const T = 16;

  /** Hace la pregunta con el modal y cuenta la respuesta. cb(ok) se llama al cerrar el modal. */
  Q.preguntar = function (g, q, info, cb) {
    g.estado = 'quiz'; g.qActual = q;   // (g.qActual: solo para depuración/tests)
    g.inp.saltoEdge = false; g.inp.accionEdge = false; g.inp.arribaEdge = false;
    g.ui.preguntaQ(q, info, (ok) => {
      g.resp.total++; if (ok) g.resp.correctas++;
      // racha de aciertos seguidos (y la mejor de la partida) para el resumen del Quiz Quest
      g.resp.racha = ok ? (g.resp.racha || 0) + 1 : 0; g.resp.mejorRacha = Math.max(g.resp.mejorRacha || 0, g.resp.racha);
      g.estado = 'jugando'; g.ui.estados(g);
      cb(ok);
    });
  };
  /** Pregunta para un objeto con reserva: tras fallar se usa la siguiente de preguntas_reserva (si hay). */
  function elegir(o) { return o.intentos > 0 && o.reserva && o.reserva.length ? o.reserva.shift() : o.q; }

  // ---------- premios ----------
  Q.premio = function (g, tipo, wx, wy) {
    const p = g.jugador;
    if (['zapatos', 'iman', 'mochila', 'canon', 'fuego', 'hielo', 'escopeta', 'grande'].includes(tipo) && J.Items) { J.Items.dar(g, tipo); return; }   // ítems con temporizador (48-items.js)
    g.premios[tipo] = (g.premios[tipo] || 0) + 1;
    g.flot.push({ tipo, x: wx, y: wy, t: 0 });
    J.Audio.sfx(tipo === 'moneda' ? 'moneda' : 'premio');
    J.chispas(g, wx * T, wy * T, 16, '#ffe27a', 4, 3);
    const msg = { moneda: '+1 moneda', vida: '¡+1 vida!', pista: 'Pista conseguida', escudo: '¡Escudo!', estrella: '¡Estrella! invulnerable', reloj: '¡Reloj! todo va más lento' }[tipo];
    if (tipo === 'vida') { g.vidas = Math.min(5, g.vidas + 1); g.ui.vidas(g.vidas); }
    else if (tipo === 'escudo') g.escudo = true;
    else if (tipo === 'estrella') { p.estrella = 8; p.inv = Math.max(p.inv, 8); }
    else if (tipo === 'reloj') { g.lento = 8; g.lentoActivo = true; }
    g.ui.estados(g);
    if (tipo !== 'moneda') g.ui.aviso(msg); else g.ui.pop(msg);
  };

  // ---------- ladrillos: se rompen desde abajo ----------
  /** Fragmentos de cerámica que caen con gravedad. */
  Q.fragmentos = function (g, wx, wy, colores) {
    const n = g.reducido ? 4 : 10;
    for (let i = 0; i < n; i++) g.part.push({ x: wx * T + (Math.random() - 0.5) * 10, y: wy * T + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 3, vida: 0.9 + Math.random() * 0.5, max: 1.4, color: colores[i % colores.length], size: 3, grav: 26 });
  };
  Q.golpeLadrillo = function (g, tx, ty) {
    const w = g.w, b = w.ladrillos.find((k) => k.x === tx && k.y === ty && !k.roto);
    if (!b) return;
    const pal = g.tema.pal, colores = [J.mezcla(pal.marco, '#8fd8e8', 0.45), '#ffffff', J.mezcla(pal.marco, '#0b1230', 0.35)];
    b.bump = 1;
    if (b.contenido === 'moneda_multi' && b.monedas > 1) {   // varias monedas: el ladrillo aguanta hasta agotarlas
      b.monedas--; Q.premio(g, 'moneda', tx + 0.5, ty - 0.2); J.Audio.sfx('tonk'); return;
    }
    if (b.contenido === 'moneda_multi') {   // última moneda: queda como bloque usado
      Q.premio(g, 'moneda', tx + 0.5, ty - 0.2);
      b.roto = true; w.tiles[ty * w.ancho + tx] = 5;
      w.bloques.push({ x: tx, y: ty, q: null, premio: 'moneda', fallo: 'cierra', estado: 'abierto', bump: 1, reserva: [] });
      return;
    }
    b.roto = true; w.tiles[ty * w.ancho + tx] = 0;
    g.shake = Math.max(g.shake, 2); J.Audio.sfx('romper'); Q.fragmentos(g, tx + 0.5, ty + 0.5, colores);
    if (b.contenido === 'moneda') Q.premio(g, 'moneda', tx + 0.5, ty - 0.2);
  };

  // ---------- plataformas que caen ----------
  Q.pasoCae = function (g, m, dt) {
    const w = g.w, p = g.jugador;
    m.dx = 0; m.dy = 0;
    if (m.estado === 'firme') { if (p.sobre === m) { m.estado = 'tiembla'; m.t = 0; J.Audio.sfx('tiembla'); } }
    else if (m.estado === 'tiembla') { m.t += dt; if (Math.random() < 0.3) J.chispas(g, (m.x + Math.random() * m.largo) * T, (m.y + 0.5) * T, 1, '#ffd9a0', 1.2, 6); if (m.t >= m.retardo) { m.estado = 'cae'; m.vy = 0; m.t = 0; } }
    else if (m.estado === 'cae') {
      m.vy = Math.min(14, m.vy + 24 * dt); const d = m.vy * dt; m.y += d; m.dy = d; m.t += dt;
      if (m.y > w.alto + 1) { m.estado = 'ausente'; m.ausente = true; m.t = 0; m.dy = 0; }
    } else if (m.estado === 'ausente') {
      m.t += dt;
      if (m.t >= m.reaparece) { m.estado = 'firme'; m.ausente = false; m.x = m.bx; m.y = m.by; J.chispas(g, (m.x + m.largo / 2) * T, (m.y + 0.5) * T, 10, '#ffd9a0', 3, 0); }
    }
  };

  // ---------- plantas carnívoras ----------
  function pasoPlantas(g, dt) {
    const p = g.jugador, w = g.w;
    for (const pl of w.plantas) {
      const t = (g.tm + pl.fase) % pl.ciclo;
      let quiere = t < pl.visible;
      const pcx = p.x + p.w / 2, pegado = Math.abs(pcx - pl.cx) < 1.6 && p.y + p.h > pl.baseY - 3 && p.y + p.h < pl.baseY + 4;
      if (pl.forzar > 0) { pl.forzar -= dt; quiere = true; }
      else if (pegado && pl.alt < 0.05) quiere = false;     // no sale si estás pegado al borde de su tubería
      pl.alt += ((quiere ? 1 : 0) - pl.alt) * Math.min(1, dt * (quiere ? 12 : 8));
      if (pl.alt > 0.35 && !pl.mordio) { pl.mordio = true; J.Audio.sfx('mordisco'); }
      if (pl.alt < 0.1) pl.mordio = false;
      if (pl.alt > 0.3 && !p.muriendo) {
        const h = 1.75 * pl.alt, r = { x: pl.cx - 0.55, y: pl.baseY - h, w: 1.1, h };
        if (J.solapa(p, r)) J.herir(g, pl.cx);
      }
    }
  }

  // ---------- bloques ? ----------
  Q.golpeBloque = function (g, tx, ty) {
    const b = g.w.bloques.find((k) => k.x === tx && k.y === ty);
    if (!b) return;
    b.bump = 1; J.Audio.sfx('tonk');
    if (b.estado !== 'listo') return;
    b.estado = 'preguntando';
    Q.preguntar(g, b.q, { titulo: 'Bloque ?' }, (ok) => {
      if (ok) { b.estado = 'abierto'; Q.premio(g, b.premio, b.x + 0.5, b.y - 0.2); }
      else {
        b.estado = 'cerrado'; g.shake = 3; J.Audio.sfx('fallo'); J.chispas(g, (b.x + 0.5) * T, (b.y + 0.5) * T, 14, '#c9b3ff', 3);
        if (b.fallo === 'enemigo') {   // suelta un bichito que, al pisarlo, enseña la explicación
          const h = J.hash(b.q && (b.q.id || b.q.enunciado) || 'x');
          g.w.enemigos.push({ x: b.x + 0.1, y: b.y - 0.85, w: 0.8, h: 0.8, vx: 0, vy: -4, dir: h & 1 ? 1 : -1, vel: 1.6, skin: h % J.Sprites.NSKINS, vivo: true, muertoT: 0, suelo: false,
            nombre: 'Error suelto', correccion: (b.q && b.q.explicacion) || 'Repasa la respuesta correcta.', id: 'bicho_bloque', x0: b.x, y0: b.y, acuatico: null, ph: 0 });
        }
      }
    });
  };

  // ---------- puertas (↑ / E) y tuberías (↓ / E) ----------
  function puertaCerca(g, d) {
    const p = g.jugador, cx = p.x + p.w / 2;
    return cx > d.x - 1.5 && cx < d.x + 2.5 && p.y + p.h > d.top && p.y < d.base;
  }
  function pedirPuerta(g, d) {
    d.intentos++;
    const q = elegir({ q: d.q, reserva: d.reserva, intentos: d.intentos - 1 });
    Q.preguntar(g, q, { titulo: 'Puerta cerrada' }, (ok) => {
      if (ok) abrirPuerta(g, d);
      else { d.cooldown = 3; g.shake = 3; J.Audio.sfx('fallo'); g.ui.aviso('La puerta sigue cerrada'); }
    });
  }
  function abrirPuerta(g, d) {
    const w = g.w;
    d.abierta = true; d.disolver = 0.001;
    for (let k = d.top; k < d.base; k++) w.tiles[k * w.ancho + d.x] = 0;
    J.Audio.sfx('puerta'); g.shake = 4;
    J.chispas(g, (d.x + 0.5) * T, ((d.top + d.base) / 2) * T, 26, '#6ff0ff', 4, 0);
  }
  Q.abrirPuerta = abrirPuerta;
  Q.preJugador = function (g) {
    const inp = g.inp, w = g.w, p = g.jugador;
    if (!w.puertas.length || p.muriendo || g.congelado) return;
    if (!(inp.arribaEdge || inp.accionEdge)) return;
    for (const d of w.puertas) {
      if (d.abierta || !puertaCerca(g, d)) continue;
      inp.saltoEdge = false;   // ↑ aquí no es un salto: es llamar a la puerta
      if (d.llave) { g.ui.aviso('Necesitas la llave'); J.Audio.sfx('aviso'); inp.arribaEdge = inp.accionEdge = false; return; }
      if (d.cooldown > 0) { g.ui.aviso('Espera ' + Math.ceil(d.cooldown) + ' s'); J.Audio.sfx('aviso'); }
      else if (d.eq) J.Quim.pedirEcuacion(g, d);
      else pedirPuerta(g, d);
      inp.arribaEdge = inp.accionEdge = false;
      return;
    }
  };

  function sobreTubo(g, t) {
    const p = g.jugador, cx = p.x + p.w / 2;
    return p.suelo && Math.abs(p.y + p.h - t.top) < 0.2 && cx > t.x - 0.05 && cx < t.x + 2.05;
  }
  function entrarTubo(g, t) {
    const p = g.jugador;
    p.vx = 0; p.vy = 0;
    g.anim = { tipo: 'tubo', fase: 'entra', t: 0, dur: 0.7, pipe: t };
    J.Audio.sfx('tubo');
  }
  Q.pasoAnim = function (g, dt) {
    const a = g.anim, p = g.jugador; a.t += dt;
    if (a.tipo === 'tubo' && a.fase === 'entra') {
      const k = Math.min(1, a.t / a.dur);
      p.x += ((a.pipe.x + 1 - p.w / 2) - p.x) * Math.min(1, dt * 14);
      p.hundido = k;
      if (a.t >= a.dur) {
        p.hundido = 0;
        const t = a.pipe;
        if (t.salida) volverBonus(g);
        else if (t.destino === 'bonus') { t.abierta = true; t.agotada = true; entrarBonus(g, t); }
        else {
          const sx = Math.round(t.sx), sb = g.w.topAt ? baseDesde(g.w, sx, Math.round(t.sy)) : Math.round(t.sy);
          p.x = sx + 0.5 - p.w / 2; p.y = sb - p.h; p.vx = p.vy = 0; p.suelo = true;
          g.respawn = { x: p.x, y: p.y }; g.snapCamara = true; g.flash = 1; J.Audio.sfx('teletransporte');
          J.chispas(g, (sx + 0.5) * T, (sb - 0.5) * T, 20, '#6ff0ff', 4, 0);
        }
        g.anim = { tipo: 'sale', t: 0, dur: 0.35 };
      }
    } else if (a.t >= a.dur) { g.anim = null; p.inv = Math.max(p.inv, 0.6); p.hundido = 0; }
  };
  function baseDesde(w, x, y) { for (let yy = Math.max(0, y); yy < w.alto; yy++) { const t = w.get(x, yy); if (t === 1 || t === 2 || t === 3 || t === 4) return yy; } return y; }

  function pedirTubo(g, t) {
    t.intentos = (t.intentos || 0) + 1;
    const q = elegir({ q: t.q, reserva: t.reserva, intentos: t.intentos - 1 });
    Q.preguntar(g, q, { titulo: 'Tubería' }, (ok) => {
      if (ok) { t.abierta = true; entrarTubo(g, t); }
      else {
        g.shake = 3;
        // la tubería escupe una planta carnívora (la suya, o una temporal si no tenía)
        let pl = g.w.plantas.find((q) => q.tubo === t);
        if (!pl) { pl = { cx: t.x + 1, baseY: t.top, tubo: t, ciclo: 9999, visible: 0, fase: 0, alt: 0, forzar: 0, mordio: false }; g.w.plantas.push(pl); }
        pl.forzar = 1.9;
        if (t.reserva.length) { t.cooldown = 2.5; g.ui.aviso('La tubería se cierra… reinténtalo'); }
        else { t.agotada = true; g.ui.aviso('La tubería se atasca'); }
      }
    });
  }

  // ---------- sala de monedas (bonus) ----------
  function crearBonus(g) {
    const niv = { capitulo_id: '_bonus', tipo_nivel: 'normal', tema_visual: g.nivel.tema_visual, fisica_juego: g.nivel.fisica_juego, ancho_tiles: 44, alto_tiles: 18,
      segmentos: [{ tipo: 'plataforma', x: 0, y: 14, largo: 44 }, { tipo: 'plataforma', x: 8, y: 11, largo: 5 }, { tipo: 'plataforma', x: 18, y: 8, largo: 6 },
        { tipo: 'plataforma', x: 28, y: 11, largo: 5 }] };
    const w2 = J.crearMundo(niv);
    w2.items = []; w2.meta = null; w2.checks = []; w2.enemigos = []; w2.bonus = true;
    const mon = (x, y) => w2.items.push({ x, y, moneda: true, tomado: false, fase: (x * 7 + y) % 9, ref: null });
    for (let i = 0; i < 5; i++) mon(9 + i, 10);
    for (let i = 0; i < 6; i++) mon(18 + i, 7);
    for (let i = 0; i < 5; i++) mon(28 + i, 10);
    for (let i = 0; i < 6; i++) mon(14 + i * 2, 13 - Math.round(Math.sin(i / 5 * Math.PI) * 2));
    // tubería de salida
    for (let k = 12; k < 14; k++) { w2.tiles[k * 44 + 38] = 6; w2.tiles[k * 44 + 39] = 6; }
    w2.tuberias = [{ x: 38, top: 12, base: 14, alto: 2, abierta: true, salida: true, destino: 'salida', reserva: [], cooldown: 0 }];
    return w2;
  }
  function entrarBonus(g, t) {
    const w2 = crearBonus(g), p = g.jugador;
    g.bonus = { vuelta: { w: g.w, tubo: t, jugador: { x: t.x + 1 - p.w / 2, y: t.top - p.h } }, t: 30, monedas0: g.premios.moneda };
    g.w = w2; p.x = 2.5; p.y = 14 - p.h; p.vx = p.vy = 0; p.suelo = true;
    g.respawnPrevio = g.respawn; g.respawn = { x: p.x, y: p.y }; g.snapCamara = true; g.flash = 1;
    g.ui.aviso('¡Sala de monedas!'); J.Audio.sfx('teletransporte');
  }
  function volverBonus(g) {
    const b = g.bonus, p = g.jugador; if (!b) return;
    g.w = b.vuelta.w; p.x = b.vuelta.jugador.x; p.y = b.vuelta.jugador.y; p.vx = p.vy = 0; p.suelo = true;
    g.respawn = g.respawnPrevio || g.respawn; g.snapCamara = true; g.flash = 1;
    g.ui.aviso('+' + (g.premios.moneda - b.monedas0) + ' monedas');
    g.bonus = null;
  }

  // ---------- paso de los elementos del modo quiz ----------
  Q.paso = function (g, dt) {
    const w = g.w, p = g.jugador, inp = g.inp;
    for (const b of w.bloques) b.bump = Math.max(0, b.bump - dt * 6);
    for (const d of w.puertas) { d.cooldown = Math.max(0, d.cooldown - dt); if (d.disolver > 0 && d.disolver < 1) d.disolver = Math.min(1, d.disolver + dt * 1.6); }
    for (const t of w.tuberias) {
      t.cooldown = Math.max(0, t.cooldown - dt);
      if (!p.muriendo && inp.accionEdge && sobreTubo(g, t) && !g.anim) {
        if (t.salida) entrarTubo(g, t);
        else if (t.agotada && t.destino === 'bonus' && t.abierta) g.ui.aviso('La sala ya está vacía');
        else if (t.agotada) g.ui.aviso('La tubería está atascada');
        else if (t.cooldown > 0) g.ui.aviso('Espera ' + Math.ceil(t.cooldown) + ' s');
        else if (t.abierta) entrarTubo(g, t);
        else pedirTubo(g, t);
        inp.accionEdge = false;
      }
    }
    if (g.bonus) { g.bonus.t -= dt; if (g.bonus.t <= 0 && !g.anim) { const t = w.tuberias[0]; entrarTubo(g, t); } }
    pasoPlantas(g, dt);
    for (const l of w.ladrillos) l.bump = Math.max(0, l.bump - dt * 6);
    for (const f of g.flot) f.t += dt;
    g.flot = g.flot.filter((f) => f.t < 1.1);
    if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 2.5);
    // sonido amortiguado bajo el agua
    if (J.Audio.agua) J.Audio.agua(!!p.agua);
  };

  // ---------- enemigos acuáticos ----------
  Q.moverAcuatico = function (g, e, dt) {
    const w = g.w, p = g.jugador;
    e.t = (e.t || 0) + dt;
    const t = e.t + e.ph;
    let nx = e.x, ny = e.y;
    if (e.acuatico === 'medusa') { ny = e.y0 + 0.05 + Math.sin(t * 1.3) * 2.2; nx = e.x0 + 0.05 + Math.sin(t * 0.4) * 0.6; e.dir = 1; }
    else if (e.acuatico === 'pez') { nx = e.x0 + Math.sin(t * 0.6) * 4.5; ny = e.y0 + Math.sin(t * 1.7) * 0.5; e.dir = Math.cos(t * 0.6) >= 0 ? 1 : -1; }
    else if (e.acuatico === 'erizo') { nx = e.x0 + Math.sin(t * 0.5) * 1.5; ny = e.y0 + Math.sin(t * 1.5) * 0.25; }
    else {   // anguila: persecución lenta con ondulación; si el jugador está lejos, patrulla
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
      if (d < 10 && !p.muriendo) {
        e.dir = dx >= 0 ? 1 : -1;
        const vx = Math.sign(dx) * 1.6, vy = J.clamp(dy, -1.2, 1.2) + Math.sin(t * 4) * 1.2;
        nx = e.x + vx * dt; ny = e.y + vy * dt;
      } else { nx = e.x0 + Math.sin(t * 0.5) * 3; ny = e.y0 + Math.sin(t * 1.6) * 0.5; e.dir = Math.cos(t * 0.5) >= 0 ? 1 : -1; }
      const SOLID = (xx, yy) => { const k = w.get(Math.floor(xx), Math.floor(yy)); return k === 1 || k === 3 || k === 4 || k === 5 || k === 6 || k === 7; };
      if (SOLID(nx + e.w / 2, e.y + e.h / 2)) nx = e.x;
      if (SOLID(e.x + e.w / 2, ny + e.h / 2)) ny = e.y;
    }
    e.x = nx; e.y = ny;
    if (e.acuatico !== 'anguila') e.suelo = false;
  };

  // ---------- dibujo ----------
  Q.dibujar = function (ctx, g, camX, camY, vis) {
    const w = g.w, t = g.t, S = J.Sprites, tema = g.tema;
    for (const pl of w.plantas) if (vis(pl.cx - 1, pl.cx + 1) && pl.alt > 0.02) S.dibujarPlanta(ctx, pl.cx * T - camX, pl.baseY * T - camY, pl.alt, t, pl.alt > 0.3);
    for (const l of w.ladrillos) if (!l.roto && vis(l.x, l.x + 1)) S.dibujarLadrillo(ctx, l.x * T - camX, l.y * T - camY, tema.pal, l.bump);
    for (const m of w.movers) if (m.cae && vis(m.x, m.x + m.largo + 1)) Q.dibujarCae(ctx, g, m, camX, camY);
    for (const d of w.puertas) {
      if (!vis(d.x, d.x + 1)) continue;
      if (d.abierta && d.disolver >= 1) continue;
      S.dibujarPuerta(ctx, d.x * T - camX, d.top * T - camY, d.alto, t, d.abierta ? d.disolver : 0, tema.pal.marco, !!d.eq);
      if (d.llave && !d.abierta) {   // cerradura dorada
        const kx = Math.round(d.x * T - camX + 8), ky = Math.round(((d.top + d.base) / 2) * T - camY);
        J.Temas.disco(ctx, kx, ky - 2, 6, '#0b1230'); J.Temas.disco(ctx, kx, ky - 2, 5, '#ffd166'); ctx.fillStyle = '#0b1230'; ctx.fillRect(kx - 1, ky - 3, 3, 3); ctx.fillRect(kx - 1, ky - 1, 2, 6);
      }
    }
    for (const tu of w.tuberias) {
      if (!vis(tu.x, tu.x + 2)) continue;
      const estado = tu.salida ? 'salida' : tu.agotada && !tu.abierta ? 'agotada' : tu.abierta ? 'abierta' : 'cerrada';
      S.dibujarTuberia(ctx, tu.x * T - camX, tu.top * T - camY, tu.alto, estado, t);
      // flecha ▼ cuando Ato está encima y se puede entrar
      if (!g.anim && sobreTubo(g, tu) && (tu.salida || tu.abierta || (!tu.agotada && tu.cooldown <= 0))) {
        const ax = Math.round(tu.x * T - camX + 16), ay = Math.round(tu.top * T - camY - 14 + Math.sin(t * 8) * 2);
        ctx.fillStyle = '#0b1230'; ctx.fillRect(ax - 4, ay - 1, 9, 3); ctx.fillRect(ax - 3, ay + 2, 7, 2); ctx.fillRect(ax - 2, ay + 4, 5, 2); ctx.fillRect(ax - 1, ay + 6, 3, 2);
        ctx.fillStyle = '#ffe27a'; ctx.fillRect(ax - 3, ay, 7, 2); ctx.fillRect(ax - 2, ay + 2, 5, 2); ctx.fillRect(ax - 1, ay + 4, 3, 2);
      }
    }
    for (const b of w.bloques) if (vis(b.x, b.x + 1)) S.dibujarBloque(ctx, b.x * T - camX, b.y * T - camY, b.estado, t, b.bump);
    // aviso ↑/E sobre una puerta cercana
    for (const d of w.puertas) if (!d.abierta && !d.llave && vis(d.x, d.x + 1) && !g.anim && puertaCerca(g, d) && d.cooldown <= 0) {
      const ax = Math.round(d.x * T - camX + 8), ay = Math.round(d.top * T - camY - 10 + Math.sin(t * 8) * 2);
      ctx.fillStyle = '#0b1230'; ctx.fillRect(ax - 4, ay + 5, 9, 3); ctx.fillRect(ax - 3, ay + 3, 7, 2); ctx.fillRect(ax - 2, ay + 1, 5, 2); ctx.fillRect(ax - 1, ay - 1, 3, 2);
      ctx.fillStyle = '#ffe27a'; ctx.fillRect(ax - 3, ay + 5, 7, 2); ctx.fillRect(ax - 2, ay + 3, 5, 2); ctx.fillRect(ax - 1, ay + 1, 3, 2);
    }
    for (const f of g.flot) {
      const k = f.t / 1.1, y = f.y * T - camY - k * 22 - 6, x = f.x * T - camX;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      S.dibujarPremio(ctx, f.tipo, x, y, 1.5 + (k < 0.2 ? k : 0.2) * 2);
      ctx.globalAlpha = 1;
    }
  };

  /** Plataforma que cae: tiembla al pisarla; cuando falta, deja un fantasma tenue donde reaparecerá. */
  Q.dibujarCae = function (ctx, g, m, camX, camY) {
    const img = g.tema.tiles.cae;
    if (m.estado === 'ausente') {
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(g.t * 6) + (m.t > m.reaparece - 1 ? 0.3 : 0);
      for (let i = 0; i < m.largo; i++) ctx.drawImage(img, Math.round(m.bx * T - camX) + i * T, Math.round(m.by * T - camY));
      ctx.globalAlpha = 1; return;
    }
    const sh = m.estado === 'tiembla' ? Math.round(Math.sin(g.t * 90) * 1.2) : 0;
    for (let i = 0; i < m.largo; i++) ctx.drawImage(img, Math.round(m.x * T - camX) + i * T + sh, Math.round(m.y * T - camY));
  };

  /** Capa de agua: tinte, rayos de luz, superficie y corrientes. Se dibuja encima de las entidades. */
  Q.dibujarAgua = function (ctx, g, camX, camY) {
    const w = g.w, t = g.t, VW = J.VW, VH = J.VH;
    for (const a of w.aguas) {
      const x0 = Math.max(0, Math.round(a.x * T - camX)), x1 = Math.min(VW, Math.round((a.x + a.w) * T - camX));
      const y0 = Math.max(0, Math.round(a.y * T - camY)), y1 = Math.min(VH, Math.round((a.y + a.h) * T - camY));
      if (x1 <= x0 || y1 <= y0) continue;
      ctx.fillStyle = 'rgba(8,96,150,.20)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = 'rgba(8,60,120,.10)'; ctx.fillRect(x0, Math.max(y0, y0 + (y1 - y0) * 0.55), x1 - x0, (y1 - y0) * 0.45);
      if (!g.reducido) {   // rayos de luz que cuelgan de la superficie
        ctx.fillStyle = 'rgba(190,240,255,.06)';
        for (let i = 0; i < 6; i++) {
          const bx = ((i * 97 + Math.sin(t * 0.3 + i) * 12 - camX * 0.3) % (VW + 80) + VW + 80) % (VW + 80) - 40;
          for (let y = y0; y < Math.min(y1, y0 + 150); y += 3) ctx.fillRect(Math.round(bx + (y - y0) * 0.25), y, 10 + i * 2, 3);
        }
      }
      const tapada = w.aguas.some((o) => o !== a && a.x + a.w / 2 >= o.x && a.x + a.w / 2 < o.x + o.w && a.y - 0.5 >= o.y && a.y - 0.5 < o.y + o.h);
      if (a.y > 0.5 && !tapada) {   // superficie ondulante (solo si arriba no hay más agua)
        for (let x = x0; x < x1; x++) { const o = Math.round(Math.sin(t * 2.5 + (x + camX) * 0.18) * 1.5); ctx.fillStyle = 'rgba(200,245,255,.7)'; ctx.fillRect(x, y0 + o, 1, 1); ctx.fillStyle = 'rgba(120,210,245,.25)'; ctx.fillRect(x, y0 + o + 1, 1, 3); }
      }
      if ((a.cx || a.cy) && !g.reducido) {   // corriente: rayitas que se mueven en su sentido
        const len = Math.hypot(a.cx, a.cy) || 1, dx = a.cx / len, dy = a.cy / len;
        ctx.fillStyle = 'rgba(220,250,255,.35)';
        for (let i = 0; i < Math.min(60, (x1 - x0) * (y1 - y0) / 1500); i++) {
          const ww = x1 - x0, hh = y1 - y0, bx = (i * 61) % ww, by = (i * 37) % hh;
          const px = (((bx + dx * t * 50 * len) % ww) + ww) % ww, py = (((by + dy * t * 50 * len) % hh) + hh) % hh;
          ctx.fillRect(x0 + Math.round(px), y0 + Math.round(py), Math.max(2, Math.round(Math.abs(dx) * 7)), Math.max(1, Math.round(Math.abs(dy) * 7)));
        }
      }
    }
  };
})();
