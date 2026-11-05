// =====================================================================================
// 70-juego.js — PCB.screens.juego: montaje, bucle de paso fijo (60 Hz con acumulador) y render
// Resolución interna 512x288 (32x18 tiles de 16 px) escalada con imagen pixelada.
// =====================================================================================
(function () {
  const PCB = window.PCB, J = PCB.juego;
  const STEP = 1 / 60;
  let S = null;   // sesión activa (solo hay una pantalla de juego a la vez)

  // ---------- inicio / reinicio de una partida ----------
  function iniciar() {
    const nivel = S.nivel, w = J.crearMundo(nivel), tema = S.tema;
    const g = (S.g = {
      capId: S.capId, nivel, w, F: J.fisica(nivel), tema, jugador: J.crearJugador(w), inp: S.input, ui: S.ui,
      vidas: 3, coleccionados: 0, tiempo: 0, t: 0, estado: 'jugando', cam: { x: 0, y: 0 }, part: [], proy: [], shake: 0,
      jefe: null, jefeDerrotado: false, respawn: { x: w.spawn.x, y: w.spawn.y }, snapCamara: true, congelado: false, victoriaEn: 0, tVic: 0,
      reducido: PCB.util.reducedMotion(), acc: 0,
    });
    J._g = g;
    S.input.onTecla = null;
    S.ui.cerrarModal(); S.ui.ocultarJefe(); S.ui.vidas(-1); S.ui.vidas(3);
    g.terminar = (gano) => terminar(g, gano);
    g.preguntar = (b) => preguntar(g, b);
    J.pasoCamara(g, 0);
    J.Audio.musica(tema.musica);
  }

  function preguntar(g, b) {
    const qs = b.preguntas, q = qs[b.pIdx % qs.length];
    b.pIdx++;
    g.estado = 'quiz';
    g.ui.pregunta(q, { jefe: b.nombre, n: Math.min(3, b.aciertos + 1) }, (ok) => { g.estado = 'jugando'; J.Jefe.respuesta(g, b, ok); });
  }

  function terminar(g, gano) {
    if (g.estado === 'fin' || g.estado === 'victoria') return;
    if (gano) {
      g.estado = 'victoria'; g.congelado = true; g.tVic = 0; g.inp.saltoEdge = false;
      J.Audio.sfx('victoria'); J.chispas(g, (g.jugador.x + 0.4) * J.T, g.jugador.y * J.T, 30, g.tema.pal.acento, 6, 6);
    } else mostrarFin(g, false);
  }

  function mostrarFin(g, gano) {
    g.estado = 'fin';
    if (!gano) J.Audio.sfx('derrota');
    const res = { capId: g.capId, gano, vidasRestantes: Math.max(0, g.vidas), coleccionados: g.coleccionados, jefeDerrotado: g.jefeDerrotado, total: g.w.items.length };
    let hecho = false;
    g.ui.fin(res, {
      continuar: () => {
        if (hecho) return; hecho = true;
        PCB.flow.finNivel({ capId: res.capId, gano: res.gano, vidasRestantes: res.vidasRestantes, coleccionados: res.coleccionados, jefeDerrotado: res.jefeDerrotado });
      },
      reintentar: () => iniciar(),
    });
  }

  function pausar() {
    const g = S && S.g; if (!g) return;
    if (g.estado === 'jugando') {
      g.estado = 'pausa'; J.Audio.pausarMusica(true);
      g.ui.pausa({ continuar: () => pausar(), reiniciar: () => { J.Audio.pausarMusica(false); iniciar(); } });
    } else if (g.estado === 'pausa') {
      g.estado = 'jugando'; g.ui.cerrarModal(); J.Audio.pausarMusica(false); S.last = performance.now() / 1000;
    }
  }

  // ---------- bucle ----------
  function frame(ms) {
    S.raf = requestAnimationFrame(frame);
    const g = S.g, now = ms / 1000;
    const dt = Math.min(0.25, now - S.last); S.last = now;
    S.input.sondear();
    if (g.estado === 'jugando' || g.estado === 'victoria') {
      g.acc += dt;
      let n = 0;
      while (g.acc >= STEP && n < 6) {
        J.paso(g, STEP); g.acc -= STEP; n++;
        if (g.estado === 'jugando' && g.victoriaEn > 0) { g.victoriaEn -= STEP; if (g.victoriaEn <= 0) terminar(g, true); }
        if (g.estado === 'victoria') { g.tVic += STEP; if (g.tVic > 1.3) { mostrarFin(g, true); break; } }
      }
      if (n >= 6) g.acc = 0;
    }
    dibujar(g, S.ctx);
    g.ui.hud(g);
  }

  // ---------- render ----------
  function dibujar(g, ctx) {
    const T = J.T, w = g.w, tema = g.tema, S2 = J.Sprites, t = g.t;
    let sx = 0, sy = 0;
    if (g.shake > 0 && !g.reducido) { sx = Math.round((Math.random() - 0.5) * g.shake); sy = Math.round((Math.random() - 0.5) * g.shake); }
    const camX = Math.round(g.cam.x) + sx, camY = Math.round(g.cam.y) + sy;
    const vis = (x0, x1) => x1 * T > camX - 40 && x0 * T < camX + J.VW + 40;

    J.Temas.dibujarFondo(ctx, tema, camX, camY, t, g.reducido);
    // zonas de campo
    for (const c of w.campos) if (vis(c.x, c.x + c.w)) dibujarCampo(ctx, c, camX, camY, t, tema);
    J.Temas.dibujarPeligro(ctx, w, tema, camX, camY, t);
    J.Temas.dibujarTiles(ctx, w, tema, camX, camY);
    for (const m of w.movers) if (vis(m.x, m.x + m.largo)) J.Temas.dibujarMovil(ctx, tema, m, camX, camY);
    for (const e of w.escombros) { ctx.save(); ctx.translate(Math.round((e.x + 0.5) * T - camX), Math.round((e.y + 0.5) * T - camY)); ctx.rotate(e.rot); ctx.drawImage(tema.tiles.puente, -8, -8); ctx.restore(); }
    // meta, checkpoints, palancas, resortes
    if (w.meta && vis(w.meta.x, w.meta.x + 2)) S2.dibujarMeta(ctx, w.meta.x * T - camX, w.meta.y * T - camY, t, tema, w.meta.bloqueada);
    for (const c of w.checks) if (vis(c.x, c.x + 1) && c.top >= 0) S2.dibujarCheckpoint(ctx, c.x * T - camX, c.top * T - camY, c.activo, t);
    for (const l of w.palancas) if (vis(l.x, l.x + 1)) S2.dibujarPalanca(ctx, l.x * T - camX, l.y * T - camY, l.estado, !l.usada, t);
    for (const r of w.resortes) if (vis(r.cx, r.cx + 1)) S2.dibujarResorte(ctx, r.cx * T - camX, r.fila * T - camY, r.comp);
    for (const it of w.items) if (!it.tomado && vis(it.x, it.x + 1)) S2.dibujarFormula(ctx, (it.x + 0.5) * T - camX, (it.y + 0.5) * T - camY, t, tema, it.fase);
    for (const k of w.bloqueos) if (k.activo && vis(k.x, k.x + 1)) dibujarMuro(ctx, k, camX, camY, t, w);
    for (const e of w.enemigos) if (e.vivo && vis(e.x, e.x + 1)) S2.dibujarEnemigo(ctx, e, t, camX, camY);
    J.Jefe.dibujar(ctx, g, camX, camY);
    S2.dibujarAto(ctx, g.jugador, t, camX, camY);
    J.Jefe.dibujarProy(ctx, g, camX, camY);
    for (const q of g.part) {
      ctx.globalAlpha = Math.min(1, q.vida * 2.5); ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), q.size, q.size);
    }
    ctx.globalAlpha = 1;
    // destello al ser herido / viñeta de peligro
    if (g.jugador.inv > 0 && g.jugador.inv > 1.6) { ctx.fillStyle = 'rgba(255,77,109,.18)'; ctx.fillRect(0, 0, J.VW, J.VH); }
  }

  function dibujarCampo(ctx, c, camX, camY, t, tema) {
    const T = J.T, x = Math.round(c.x * T - camX), y = Math.round(c.y * T - camY), ww = Math.round(c.w * T), hh = Math.round(c.h * T);
    const col = c.fy < -0.01 ? '111,240,255' : c.fy > 0.01 ? '255,61,166' : '255,209,102';
    ctx.fillStyle = `rgba(${col},.10)`; ctx.fillRect(x, y, ww, hh);
    ctx.fillStyle = `rgba(${col},.45)`; ctx.fillRect(x, y, ww, 1); ctx.fillRect(x, y + hh - 1, ww, 1); ctx.fillRect(x, y, 1, hh); ctx.fillRect(x + ww - 1, y, 1, hh);
    const len = Math.hypot(c.fx, c.fy) || 1, dx = c.fx / len, dy = c.fy / len, sp = 26 + 20 * Math.min(1.5, len);
    for (let i = 0; i < c.w * c.h * 0.45; i++) {
      const bx = (i * 37) % ww, by = (i * 53) % hh;
      const px = (((bx + dx * t * sp) % ww) + ww) % ww, py = (((by + dy * t * sp) % hh) + hh) % hh;
      ctx.fillStyle = `rgba(${col},.8)`; ctx.fillRect(x + Math.round(px), y + Math.round(py), 2, 2);
      ctx.fillStyle = `rgba(${col},.35)`; ctx.fillRect(x + Math.round(px - dx * 3), y + Math.round(py - dy * 3), 1, 1);
    }
  }

  function dibujarMuro(ctx, k, camX, camY, t, w) {
    const T = J.T, x = Math.round(k.x * T - camX);
    const y0 = Math.max(0, Math.round(-camY)), y1 = Math.min(J.VH, Math.round(w.alto * T - camY));
    for (let y = y0; y < y1; y += 4) {
      const f = (Math.floor(y / 4 + t * 12) % 4);
      ctx.fillStyle = f === 0 ? 'rgba(255,255,255,.65)' : f === 1 ? 'rgba(255,61,166,.5)' : 'rgba(111,240,255,.3)';
      ctx.fillRect(x + 5 + (f === 2 ? 1 : 0), y, 6, 3);
    }
    ctx.fillStyle = 'rgba(255,61,166,.16)'; ctx.fillRect(x, y0, 16, y1 - y0);
  }

  // ---------- pantalla ----------
  PCB.screens.juego = {
    mount(host, ctx) {
      const nivel = ctx && ctx.nivel;
      if (!nivel || !nivel.ancho_tiles) { host.append(PCB.util.el('pre', { style: { padding: '20px', color: '#ff8' } }, 'Nivel no disponible.')); return; }
      const v = J.validar(nivel);
      if (!v.ok) console.warn('[juego] el nivel no pasa el validador de jugabilidad:', v.errores);
      J.Sprites.init();
      S = { host, capId: ctx.capId, nivel, capitulo: ctx.capitulo || {}, tema: J.Temas.get(nivel.tema_visual), raf: 0, last: performance.now() / 1000, g: null };
      S.input = J.crearInput(pausar);
      S.ui = J.crearUI(host, { vidas: 3 }, { input: S.input, pausar });
      S.ctx = S.ui.canvas.getContext('2d');
      S.ctx.imageSmoothingEnabled = false;
      S.vis = () => { if (document.hidden && S && S.g && S.g.estado === 'jugando') pausar(); };
      document.addEventListener('visibilitychange', S.vis);
      iniciar();
      if (!S.root_touch) S.ui.pista('← → / A D mover  ·  Espacio / ↑ saltar  ·  P pausa', 6000);
      S.raf = requestAnimationFrame(frame);
    },
    unmount() {
      if (!S) return;
      cancelAnimationFrame(S.raf);
      document.removeEventListener('visibilitychange', S.vis);
      S.input.destroy(); S.ui.destroy(); J.Audio.cerrar(); J._g = null;
      S = null;
    },
  };

  /** Utilidad de depuración/tests: devuelve el estado interno de la partida. */
  J.estado = () => (S && S.g) || null;
  J.pausar = pausar;
})();
