// =====================================================================================
// 48-items.js — ÍTEMS y reserva (inspirado en las referencias de género; todo diseño propio)
//   Cápsulas `item` en el nivel ({"tipo":"item","x","y","item":"zapatos|iman|mochila|canon|escudo|estrella|reloj|vida"}).
//   · zapatos  «Botas de Hooke»        : salto +35 % durante 15 s (ley de Hooke: el muelle devuelve la energía)
//   · iman     «Imán»                  : atrae átomos, gemas y monedas cercanos durante 15 s
//   · mochila  «Mochila propulsora»    : mantén SALTO en el aire para propulsarte (acción-reacción de Newton)
//   · canon    «Cañón de fotones»      : X / F dispara fotones: matan enemigos, rompen ladrillos y detonan minas a distancia
//   · escudo / estrella / reloj        : van a la RESERVA (3 casillas, abajo en el centro); Q (o clic en la casilla) usa la primera
//   Los premios de los bloques ? (Quiz Quest) pueden dar también estos ítems.
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const I = (J.Items = {});
  const T = 16;

  const DEF = {
    zapatos: { nombre: 'Botas de Hooke', col: '#ff3da6', letra: 'H', dur: 15, aviso: '¡Botas de Hooke! Salto +35 %' },
    iman: { nombre: 'Imán', col: '#ff4d6d', letra: 'N', dur: 15, aviso: '¡Imán! Atrae átomos, gemas y monedas' },
    mochila: { nombre: 'Mochila propulsora', col: '#ffb020', letra: 'P', dur: 25, aviso: '¡Mochila! Mantén SALTO en el aire' },
    canon: { nombre: 'Cañón de fotones', col: '#6ff0ff', letra: 'F', dur: 30, municion: 10, aviso: '¡Cañón de fotones! Pulsa X / F' },
    escudo: { nombre: 'Escudo', col: '#35d6ff', letra: 'E', reserva: true, aviso: 'Escudo guardado en la reserva (Q)' },
    estrella: { nombre: 'Supernova', col: '#ffe27a', letra: '★', reserva: true, aviso: 'Supernova guardada en la reserva (Q)' },
    reloj: { nombre: 'Reloj', col: '#e8f0ff', letra: 'R', reserva: true, aviso: 'Reloj guardado en la reserva (Q)' },
    vida: { nombre: 'Vida', col: '#ff4d6d', letra: '♥', aviso: '¡+1 vida!' },
    fuego: { nombre: 'Flor de plasma', col: '#ff7a2a', letra: 'L', persistente: true, aviso: '¡Flor de plasma! Disparas bolas rebotantes (X / F / J)' },
    escopeta: { nombre: 'Escopeta de iones', col: '#b0b8d8', letra: 'S', municion: 10, aviso: '¡Escopeta de iones! 10 cartuchos (X / F / J)' },
    grande: { nombre: 'Núcleo expansivo', col: '#2ee59d', letra: 'G', persistente: true, aviso: '¡Núcleo expansivo! Creces y aguantas un golpe' },
  };
  I.def = (tipo) => DEF[tipo] || null;
  I.TIPOS = Object.keys(DEF);

  // ---------- estado por partida ----------
  I.iniciar = function (g) {
    g.it = { zapatos: 0, iman: 0, mochila: 0, canon: 0, fuel: 2.8, municion: 0, cd: 0, fuego: false, escopeta: 0, grande: false };
    g.reserva = [];
    g.fotones = []; g.fuegos = []; g.perdigones = [];
    g.itemsMundo = (g.nivel.segmentos || []).filter((s) => s.tipo === 'item' && DEF[s.item]).map((s) => ({ x: Math.floor(s.x), y: Math.floor(s.y), item: s.item, tomado: false, fase: (J.hash('it' + s.x + s.y) % 100) / 16 }));
    montarHUD(g);
  };

  /** Aplica un ítem (capsula del nivel o premio de bloque). */
  I.dar = function (g, tipo) {
    const d = DEF[tipo], p = g.jugador; if (!d) return;
    if (tipo === 'vida') { g.vidas = Math.min(5, g.vidas + 1); g.ui.vidas(g.vidas); }
    else if (d.reserva) { if (g.reserva.length < 3) g.reserva.push(tipo); else usarTipo(g, tipo); }
    else if (tipo === 'grande') crecer(g);
    else if (tipo === 'fuego') { g.it.fuego = true; crecer(g); }
    else if (tipo === 'escopeta') g.it.escopeta = Math.min(20, g.it.escopeta + d.municion);
    else { g.it[tipo] = d.dur; if (tipo === 'canon') g.it.municion = d.municion; if (tipo === 'mochila') g.it.fuel = 2.8; }
    J.Audio.sfx('premio'); J.chispas(g, (p.x + p.w / 2) * T, (p.y + p.h / 2) * T, 18, d.col, 4, 3);
    g.ui.aviso(d.aviso); hud(g, true);
  };

  // ---------- «grande»: Ato crece (hitbox mayor, aguanta un golpe) ----------
  const GW = 0.95, GH = 1.35;
  function cabe(g, x, y, w, h) { const W = g.w; for (let ty = Math.floor(y + 0.02); ty <= Math.floor(y + h - 0.02); ty++) for (let tx = Math.floor(x + 0.02); tx <= Math.floor(x + w - 0.02); tx++) { const t = W.get(tx, ty); if (t === 1 || t === 3 || t === 4 || t === 5 || t === 6 || t === 7 || t === 8 || t === 9 || t === 10) return false; } return true; }
  function crecer(g) {
    const p = g.jugador, it = g.it; if (it.grande) return;
    const nx = p.x + p.w / 2 - GW / 2, ny = p.y + p.h - GH;
    if (!cabe(g, nx, ny, GW, GH)) { g.crecerPendiente = true; return; }          // no cabe aquí (techo bajo): crece en cuanto haya sitio
    p.x = nx; p.y = ny; p.w = GW; p.h = GH; it.grande = true; p.grande = true; g.crecerPendiente = false;
    J.chispas(g, (p.x + p.w / 2) * T, (p.y + p.h / 2) * T, 22, '#2ee59d', 5, 2); g.shake = Math.max(g.shake, 2);
  }
  function encoger(g) {
    const p = g.jugador, it = g.it, FIS = J.FIS;
    const nx = p.x + p.w / 2 - FIS.W / 2, ny = p.y + p.h - FIS.H;
    p.x = nx; p.y = ny; p.w = FIS.W; p.h = FIS.H; it.grande = false; it.fuego = false; p.grande = false; p.inv = 1.5;
    J.Audio.sfx('golpe'); J.chispas(g, (p.x + p.w / 2) * T, (p.y + p.h / 2) * T, 18, '#2ee59d', 4); g.shake = Math.max(g.shake, 3);
    if (g.ui) g.ui.aviso('¡Te encoges!'); hud(g, true);
  }
  /** Lo llama perderVida: si Ato es grande, el golpe lo encoge en vez de quitarle una vida. */
  I.alReaparecer = function (g) {
    const p = g.jugador, it = g.it, FIS = J.FIS; if (!it) return;
    if (it.grande || it.fuego) { p.w = FIS.W; p.h = FIS.H; p.grande = false; it.grande = false; it.fuego = false; g.crecerPendiente = false; hud(g, true); }
  };
  I.alGolpear = function (g) { if (g.it && g.it.grande) { encoger(g); return true; } return false; };

  // ---------- impacto de los disparos del jugador (fuego, perdigones…) ----------
  function impacto(g, x, y, rad, por) {
    const w = g.w, col = por === 'fuego' ? '#ff7a2a' : '#ffe27a';
    for (const e of w.enemigos) { if (!e.vivo || e.muertoT > 0) continue; if (Math.hypot(x - (e.x + e.w / 2), y - (e.y + e.h / 2)) < rad + 0.55) { e.muertoT = 0.001; J.Audio.sfx('pisoton'); J.chispas(g, (e.x + e.w / 2) * T, (e.y + e.h / 2) * T, 12, col, 4); if (g.ui) g.ui.error(e); return true; } }
    for (const e of g.bichos || []) { if (!e.vivo || e.muertoT > 0) continue; if (Math.hypot(x - (e.x + e.w / 2), y - (e.y + e.h / 2)) < rad + 0.6) { J.Ambiente.matar(g, e, 'foton'); return true; } }
    if (J.Peligros && J.Peligros.golpe(g, x, y, rad)) return true;
    if (J.Fauna && J.Fauna.golpe(g, x, y, rad, por)) return true;
    for (const m of w.minas || []) if (m.estado === 'lista' && Math.hypot(x - m.x, y - m.y) < 0.8) { m.estado = 'armada'; m.t = 0.9; return true; }
    if (J.Jefe && J.Jefe.recibirDisparo && g.jefe && J.Jefe.recibirDisparo(g, x, y, por)) return true;
    return false;
  }
  I.impacto = impacto;

  function usarTipo(g, tipo) {
    const p = g.jugador;
    if (tipo === 'escudo') g.escudo = true;
    else if (tipo === 'estrella') { p.estrella = 8; p.inv = Math.max(p.inv, 8); }
    else if (tipo === 'reloj') { g.lento = 8; g.lentoActivo = true; }
    J.Audio.sfx('premio'); g.ui.estados(g, true);
  }
  I.usarReserva = function (g, idx) {
    if (!g.reserva || !g.reserva.length || g.estado !== 'jugando') return;
    const t = g.reserva.splice(idx || 0, 1)[0]; usarTipo(g, t); g.ui.aviso(DEF[t].nombre + ' activado'); hud(g, true);
  };

  /** Multiplicador de salto (lo lee el motor al saltar). */
  I.saltoMult = (g) => (g.it && g.it.zapatos > 0 ? 1.35 : 1);

  // ---------- paso de simulación ----------
  I.paso = function (g, dt) {
    const w = g.w, p = g.jugador, inp = g.inp, it = g.it; if (!it) return;
    const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    for (const k of ['zapatos', 'iman', 'mochila', 'canon']) if (it[k] > 0) { it[k] = Math.max(0, it[k] - dt); if (it[k] === 0) { g.ui.aviso(DEF[k].nombre + ': se acabó'); hud(g, true); } }
    it.cd = Math.max(0, it.cd - dt);
    // capsulas del nivel
    if (!p.muriendo) for (const c of g.itemsMundo) if (!c.tomado && Math.abs(pcx - (c.x + 0.5)) < 0.9 && Math.abs(pcy - (c.y + 0.5)) < 1.0) { c.tomado = true; I.dar(g, c.item); }
    // entrada
    if (inp.usarEdge) { inp.usarEdge = false; I.usarReserva(g, 0); }
    // imán: atrae gemas, monedas y átomos cercanos
    if (it.iman > 0 && !p.muriendo) {
      const atraer = (o) => {
        const dx = pcx - (o.x + 0.5), dy = pcy - (o.y + 0.5), d = Math.hypot(dx, dy);
        if (d < 5.5 && d > 0.05) { const v = Math.min(9, 3 + (5.5 - d) * 2) * dt; o.x += (dx / d) * v; o.y += (dy / d) * v; }
      };
      for (const o of w.items) if (!o.tomado) atraer(o);
      for (const a of w.atomos) if (!a.tomado) atraer(a);
      if (Math.random() < 0.3) J.chispas(g, pcx * T + (Math.random() - 0.5) * 60, pcy * T + (Math.random() - 0.5) * 40, 1, Math.random() < 0.5 ? '#ff4d6d' : '#4a9aff', 1, 0);
    }
    // mochila propulsora: acción-reacción. Se recarga al pisar suelo.
    if (p.suelo || p.sobre) it.fuel = 2.8;
    p.propulsando = false;
    if (it.mochila > 0 && !p.muriendo && inp.salto && !p.suelo && p.vy > -1.5 && it.fuel > 0 && !p.enAgua) {
      p.propulsando = true; it.fuel -= dt;
      p.vy = Math.max(p.vy - 46 * dt, -4.6);
      if (Math.random() < 0.7) J.chispas(g, (pcx - p.dir * 0.3) * T, (p.y + p.h) * T, 1, Math.random() < 0.5 ? '#ffb020' : '#ff7a2a', 2, 3);
    }
    // cañón de fotones
    if (g.crecerPendiente) crecer(g);
    if (inp.dispEdge) {
      inp.dispEdge = false;
      if (!p.muriendo && g.estado === 'jugando' && it.cd <= 0 && it.escopeta > 0) {                       // escopeta de iones: 5 perdigones en abanico y retroceso
        it.escopeta--; it.cd = 0.5;
        for (let k = 0; k < 5; k++) { const ang = (k - 2) * 0.11 + (Math.random() - 0.5) * 0.05; g.perdigones.push({ x: pcx + p.dir * 0.7, y: pcy - 0.15, vx: p.dir * Math.cos(ang) * 16, vy: Math.sin(ang) * 16, t: 0 }); }
        p.vx -= p.dir * 3.2; g.shake = Math.max(g.shake, 2); J.Audio.sfx('onda'); J.chispas(g, (pcx + p.dir * 0.9) * T, (pcy - 0.15) * T, 10, '#ffe27a', 3, 0);
        if (it.escopeta === 0) g.ui.aviso('Sin cartuchos'); hud(g, true);
      } else if (!p.muriendo && g.estado === 'jugando' && it.cd <= 0 && it.fuego && g.fuegos.length < 3) {   // flor de plasma: bolas rebotantes
        it.cd = 0.3; g.fuegos.push({ x: pcx + p.dir * 0.6, y: pcy, vx: p.dir * 9, vy: 2, t: 0, reb: 0 }); J.Audio.sfx('fuego');
      } else if (it.canon > 0 && it.municion > 0 && it.cd <= 0 && !p.muriendo && g.estado === 'jugando') {
        it.municion--; it.cd = 0.22; g.fotones.push({ x: pcx + p.dir * 0.6, y: pcy - 0.1, vx: p.dir * 13, t: 0 });
        J.Audio.sfx('fuego'); J.chispas(g, (pcx + p.dir * 0.7) * T, (pcy - 0.1) * T, 4, '#6ff0ff', 2, 0);
        if (it.municion === 0) { it.canon = 0; g.ui.aviso('Sin fotones'); }
        hud(g, true);
      }
    }
    for (const f of g.fotones) {
      f.t += dt; f.x += f.vx * dt;
      const tx = Math.floor(f.x), ty = Math.floor(f.y), t = w.get(tx, ty);
      if (t === 8 && J.Quiz) { J.Quiz.golpeLadrillo(g, tx, ty); f.muerto = true; }                 // ladrillo: se rompe
      else if (t === 1 || t === 3 || t === 4 || t === 6 || t === 7 || t === 9 || t === 10) f.muerto = true;   // sólido: el fotón se disipa
      else if (t === 5 && J.Quiz) { J.Quiz.golpeBloque(g, tx, ty); f.muerto = true; }              // bloque ?: se abre
      if (f.muerto || f.t > 1.2 || f.x < -2 || f.x > w.ancho + 2) { f.muerto = true; continue; }
      for (const e of w.enemigos) {
        if (!e.vivo || e.muertoT > 0) continue;
        if (Math.abs(f.x - (e.x + e.w / 2)) < 0.7 && Math.abs(f.y - (e.y + e.h / 2)) < 0.7) {
          e.muertoT = 0.001; f.muerto = true; J.Audio.sfx('pisoton'); J.chispas(g, (e.x + e.w / 2) * T, (e.y + e.h / 2) * T, 12, '#6ff0ff', 4);
          if (g.ui) g.ui.error(e);
          break;
        }
      }
      if (!f.muerto && g.jefe && J.Jefe.recibirDisparo && J.Jefe.recibirDisparo(g, f.x, f.y, 'foton')) f.muerto = true;
      if (J.Fauna && J.Fauna.golpe(g, f.x, f.y, 0.3, 'foton')) f.muerto = true;
      if (J.Peligros && J.Peligros.golpe(g, f.x, f.y, 0.3)) f.muerto = true;   // torretas y balas gigantes (51-peligros.js)
      for (const e of g.bichos || []) {   // bichos del entorno (49-ambiente.js)
        if (!e.vivo || e.muertoT > 0) continue;
        if (Math.abs(f.x - (e.x + e.w / 2)) < 0.8 && Math.abs(f.y - (e.y + e.h / 2)) < 0.8) { J.Ambiente.matar(g, e, 'foton'); f.muerto = true; break; }
      }
      for (const m of w.minas || []) if (m.estado === 'lista' && Math.hypot(f.x - m.x, f.y - m.y) < 0.8) { m.estado = 'armada'; m.t = 0.9; f.muerto = true; }   // detona la mina a distancia
    }
    g.fotones = g.fotones.filter((f) => !f.muerto);
    // perdigones de la escopeta (alcance corto, 0.3 s) y bolas de plasma (rebotan en el suelo)
    for (const q of g.perdigones) {
      q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const tx = Math.floor(q.x), ty = Math.floor(q.y), tt = w.get(tx, ty);
      if (tt === 8 && J.Quiz) { J.Quiz.golpeLadrillo(g, tx, ty); q.muerto = true; }
      else if (tt === 5 && J.Quiz) { J.Quiz.golpeBloque(g, tx, ty); q.muerto = true; }
      else if (tt === 1 || tt === 3 || tt === 4 || tt === 6 || tt === 7 || tt === 9 || tt === 10) q.muerto = true;
      else if (q.t > 0.3 || impacto(g, q.x, q.y, 0.15, 'perdigon')) q.muerto = true;
    }
    g.perdigones = g.perdigones.filter((q) => !q.muerto);
    for (const f of g.fuegos) {
      f.t += dt; f.vy += 30 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
      const suelo = w.get(Math.floor(f.x), Math.floor(f.y + 0.3)), pared = w.get(Math.floor(f.x + Math.sign(f.vx) * 0.35), Math.floor(f.y));
      if (f.vy > 0 && (suelo === 1 || suelo === 3 || suelo === 4 || suelo === 6 || suelo === 9 || suelo === 10 || suelo === 2)) { f.vy = -6.5; f.y = Math.floor(f.y + 0.3) - 0.3; f.reb++; }
      if (pared === 1 || pared === 3 || pared === 4 || pared === 6 || pared === 7 || pared === 9 || pared === 10 || pared === 8) { if (pared === 8 && J.Quiz) J.Quiz.golpeLadrillo(g, Math.floor(f.x + Math.sign(f.vx) * 0.35), Math.floor(f.y)); f.muerto = true; }
      if (f.t > 3.5 || f.reb > 6 || f.x < -2 || f.x > w.ancho + 2 || f.y > w.alto + 1) f.muerto = true;
      if (!f.muerto && impacto(g, f.x, f.y, 0.25, 'fuego')) f.muerto = true;
      if (f.muerto) J.chispas(g, f.x * T, f.y * T, 6, '#ff7a2a', 2, 0);
    }
    g.fuegos = g.fuegos.filter((f) => !f.muerto);
    hud(g);
  };

  // ---------- dibujo ----------
  function capsula(ctx, x, y, d, t, fase) {
    const bob = Math.round(Math.sin(t * 3 + fase) * 2), cx = Math.round(x), cy = Math.round(y + bob);
    // halo
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + t * 2; ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.2 * Math.sin(a * 3 + t * 5)) + ')'; ctx.fillRect(Math.round(cx + Math.cos(a) * 9), Math.round(cy + Math.sin(a) * 9), 1, 1); }
    // cuerpo: capsula de laboratorio (dos mitades) con el color del ítem
    ctx.fillStyle = '#0b1230'; ctx.fillRect(cx - 7, cy - 5, 14, 10); ctx.fillRect(cx - 6, cy - 6, 12, 12);
    ctx.fillStyle = d.col; ctx.fillRect(cx - 6, cy - 5, 12, 10); ctx.fillRect(cx - 5, cy - 6, 10, 12);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(cx - 5, cy - 5, 4, 2); ctx.fillRect(cx - 5, cy - 3, 2, 3);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(cx - 6, cy + 3, 12, 2);
    ctx.font = '8px PixelHUD, monospace'; ctx.fillStyle = '#0b1230'; ctx.fillText(d.letra, cx - 4, cy + 4);
  }
  I.dibujar = function (ctx, g, camX, camY, vis) {
    if (!g.it) return;
    for (const c of g.itemsMundo) if (!c.tomado && vis(c.x, c.x + 1)) capsula(ctx, (c.x + 0.5) * T - camX, (c.y + 0.5) * T - camY, DEF[c.item], g.t, c.fase);
    // fotones: bolas de luz con estela
    for (const f of g.fotones) {
      const x = Math.round(f.x * T - camX), y = Math.round(f.y * T - camY), s = f.vx > 0 ? -1 : 1;
      for (let i = 1; i < 6; i++) { ctx.fillStyle = 'rgba(111,240,255,' + (0.5 - i * 0.08) + ')'; ctx.fillRect(x + s * i * 3, y - 1, 3, 2); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#6ff0ff'; ctx.fillRect(x - 3, y - 1, 6, 2); ctx.fillRect(x - 1, y - 3, 2, 6);
    }
    for (const q of g.perdigones) { const x = Math.round(q.x * T - camX), y = Math.round(q.y * T - camY); ctx.fillStyle = 'rgba(255,226,122,.5)'; ctx.fillRect(x - Math.round(q.vx * 0.012), y, Math.round(q.vx * 0.012) || 1, 1); ctx.fillStyle = '#fff'; ctx.fillRect(x, y - 1, 2, 2); ctx.fillStyle = '#ffe27a'; ctx.fillRect(x - 1, y, 1, 1); }
    for (const f of g.fuegos) { const x = Math.round(f.x * T - camX), y = Math.round(f.y * T - camY); ctx.globalAlpha = 0.35; J.Temas.disco(ctx, x, y, 7, '#ff7a2a'); ctx.globalAlpha = 1; J.Temas.disco(ctx, x, y, 4, '#ff4d2e'); J.Temas.disco(ctx, x, y, 3, '#ff9f1c'); J.Temas.disco(ctx, x - 1, y - 1, 1, '#fff'); }
  };
  /** Efectos sobre Ato (se llama justo después de dibujarlo). */
  I.dibujarJugador = function (ctx, g, camX, camY) {
    const p = g.jugador, it = g.it, t = g.t; if (!it || p.muriendo) return;
    const cx = Math.round((p.x + p.w / 2) * T - camX), cy = Math.round((p.y + p.h / 2) * T - camY), pie = Math.round((p.y + p.h) * T - camY);
    if (it.zapatos > 0) { ctx.fillStyle = '#ff3da6'; ctx.fillRect(cx - 5, pie - 2, 4, 2); ctx.fillRect(cx + 1, pie - 2, 4, 2); if (Math.floor(t * 8) % 2) { ctx.fillStyle = '#fff'; ctx.fillRect(cx - 6 + ((t * 20) % 12), pie - 1, 1, 1); } }
    if (it.iman > 0) for (let k = 0; k < 2; k++) { ctx.strokeStyle = k ? 'rgba(74,154,255,.55)' : 'rgba(255,77,109,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx + (k ? 3 : -3), cy, 12 + Math.sin(t * 5 + k) * 3, Math.PI * (k ? -0.5 : 0.5), Math.PI * (k ? 0.5 : 1.5)); ctx.stroke(); }
    if (it.mochila > 0) { const sx = cx - p.dir * 7; ctx.fillStyle = '#0b1230'; ctx.fillRect(sx - 2, cy - 3, 4, 8); ctx.fillStyle = '#ffb020'; ctx.fillRect(sx - 1, cy - 2, 2, 6); if (p.propulsando) { ctx.fillStyle = Math.floor(t * 30) % 2 ? '#ffe27a' : '#ff7a2a'; ctx.fillRect(sx - 1, cy + 5, 2, 4 + Math.floor(Math.random() * 3)); } }
    if (it.escopeta > 0) { const bx = cx + p.dir * 6; ctx.fillStyle = '#0b1230'; ctx.fillRect(Math.min(bx, bx + p.dir * 11) - 1, cy - 1, 13, 5); ctx.fillStyle = '#b0b8d8'; ctx.fillRect(Math.min(bx, bx + p.dir * 11), cy, 11, 3); ctx.fillStyle = '#7a4a2a'; ctx.fillRect(p.dir > 0 ? bx - 3 : bx + 1, cy, 3, 4); }
    if (it.fuego && it.escopeta <= 0) { ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 9); J.Temas.disco(ctx, cx + p.dir * 7, cy, 7, '#ff7a2a'); ctx.globalAlpha = 1; J.Temas.disco(ctx, cx + p.dir * 7, cy, 2, '#ffd166'); }
    if (it.canon > 0 && it.escopeta <= 0 && !it.fuego) { const bx = cx + p.dir * 7; ctx.fillStyle = '#0b1230'; ctx.fillRect(bx - 3, cy, 6, 4); ctx.fillStyle = '#6ff0ff'; ctx.fillRect(bx - 2, cy + 1, 4, 2); ctx.fillStyle = '#fff'; ctx.fillRect(bx + p.dir * 3 - (p.dir < 0 ? 1 : 0), cy + 1, 1, 2); }
  };

  // ---------- HUD (insignias con cuenta atrás y casillas de reserva) ----------
  function montarHUD(g) {
    const root = g.ui && g.ui.root; if (!root) return;
    root.querySelectorAll('.jg-itemhud, .jg-reserva').forEach((n) => n.remove());
    g.hudItems = document.createElement('div'); g.hudItems.className = 'jg-itemhud'; root.append(g.hudItems);
    g.hudReserva = document.createElement('div'); g.hudReserva.className = 'jg-reserva'; root.append(g.hudReserva);
    g._sigHud = ''; hud(g, true);
  }
  function hud(g, forzar) {
    if (!g.hudItems) return;
    const it = g.it, sig = ['zapatos', 'iman', 'mochila', 'canon'].map((k) => Math.ceil(it[k])).join(',') + '|' + it.municion + '|' + it.escopeta + '|' + it.fuego + '|' + it.grande + '|' + Math.round(it.fuel * 3) + '|' + g.reserva.join(',');
    if (sig === g._sigHud && !forzar) return; g._sigHud = sig;
    g.hudItems.replaceChildren(...['grande', 'fuego', 'escopeta', 'zapatos', 'iman', 'mochila', 'canon'].filter((k) => it[k] > 0 || it[k] === true).map((k) => {
      const d = DEF[k], s = document.createElement('span'); s.className = 'jg-itemchip'; s.style.borderColor = d.col;
      s.innerHTML = '<b style="background:' + d.col + '">' + d.letra + '</b>' + d.nombre + ' <i>' + (k === 'canon' ? '×' + it.municion : k === 'escopeta' ? '×' + it.escopeta : (k === 'fuego' || k === 'grande') ? '' : k === 'mochila' ? Math.round(Math.max(0, it.fuel) / 2.8 * 100) + '%' : Math.ceil(it[k]) + 's') + '</i>';
      return s;
    }));
    g.hudReserva.replaceChildren(...[0, 1, 2].map((i) => {
      const t = g.reserva[i], d = t && DEF[t], c = document.createElement('button'); c.type = 'button'; c.className = 'jg-slot' + (d ? ' llena' : ''); c.title = d ? d.nombre + ' (Q)' : 'Reserva vacía';
      if (d) { c.innerHTML = '<b style="background:' + d.col + '">' + d.letra + '</b>'; c.addEventListener('click', () => I.usarReserva(g, i)); }
      return c;
    }));
  }
})();
