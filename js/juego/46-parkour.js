// =====================================================================================
// 46-parkour.js — peligros y parkour (CONTRATO §4c): mina, prensa, péndulo, cinta, pinchos,
// bloque de onda (rebote), sprint (cámara empujando), rastro de monedas (en crearMundo) y cartel.
// Todo con diseño propio: «radicales libres» pulsantes, prensas hidráulicas de laboratorio con sombra de aviso,
// péndulos con T = 2π√(L/g) (guiño al cours), cintas transportadoras y bloques de onda.
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const P = (J.Parkour = {});
  const T = 16;

  /** Al reaparecer tras morir: los sprints en curso se reinician (se reactivan al pasar x_ini). */
  P.alMorir = function (g) {
    for (const sp of g.w.sprints) if (!sp.hecho) sp.activo = false;
    g.sprintActivo = null;
  };

  function explotar(g, m) {
    const p = g.jugador;
    m.estado = 'fin';
    J.Audio.sfx('explosion'); g.shake = Math.max(g.shake, 9);
    J.chispas(g, m.x * T, m.y * T, 30, '#ffb020', 7, 4); J.chispas(g, m.x * T, m.y * T, 14, '#ff4d6d', 5, 2); J.chispas(g, m.x * T, m.y * T, 10, '#ffffff', 4, 0);
    g.fx.push({ tipo: 'explosion', x: m.x, y: m.y, r: m.radio, t: 0 });
    const d = Math.hypot(p.x + p.w / 2 - m.x, p.y + p.h / 2 - m.y);
    if (!p.muriendo && d < m.radio) J.herir(g, m.x);
  }

  P.paso = function (g, dt) {
    const w = g.w, p = g.jugador, inp = g.inp, F = g.F;
    const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2, vivo = !p.muriendo;
    // ---- minas ----
    for (const m of w.minas) {
      if (m.estado === 'fin') continue;
      const d = Math.hypot(pcx - m.x, pcy - m.y);
      if (m.estado === 'lista') {
        if (!vivo) continue;
        if (m.modo === 'contacto') { if (J.solapa(p, { x: m.x - 0.45, y: m.y - 0.45, w: 0.9, h: 0.9 })) explotar(g, m); }
        else if (d < m.radio + 0.7) { m.estado = 'armada'; m.t = 0; J.Audio.sfx('aviso'); }
      } else { m.t += dt; if (Math.floor(m.t * 8) !== Math.floor((m.t - dt) * 8)) J.Audio.sfx('aviso'); if (m.t >= 1.0) explotar(g, m); }
    }
    // ---- prensas: ritmo = subir · aviso (sombra) · golpe · mantener · subir ----
    for (const pr of w.prensas) {
      if (pr.base < 0) continue;
      const tt = ((g.tm + pr.retardo) % pr.periodo) / pr.periodo, up = pr.y, down = pr.base - 1;
      let pos = up; pr.aviso = false;
      if (tt < 0.5) pos = up;
      else if (tt < 0.7) { pos = up + Math.sin(g.tm * 60) * 0.04; pr.aviso = true; }
      else if (tt < 0.76) { const k = (tt - 0.7) / 0.06; pos = up + (down - up) * k * k; }
      else if (tt < 0.9) pos = down;
      else { const k = (tt - 0.9) / 0.1; pos = down - (down - up) * k; }
      pr.cab = pos;
      if (tt >= 0.76 && tt < 0.9) { if (!pr.sono) { pr.sono = true; J.Audio.sfx('prensa'); if (Math.abs(pcx - (pr.x + pr.largo / 2)) < 12) g.shake = Math.max(g.shake, 4); J.chispas(g, (pr.x + pr.largo / 2) * T, pr.base * T, 8, '#cfd8f0', 3, 2); } } else if (tt < 0.7) pr.sono = false;
      if (vivo && tt >= 0.68 && tt < 0.98 && J.solapa(p, { x: pr.x, y: pos, w: pr.largo, h: 1 })) J.herir(g, pr.x + pr.largo / 2);
    }
    // ---- péndulos ----
    for (const pe of w.pendulos) {
      const ang = pe.A * Math.cos((2 * Math.PI * g.tm) / pe.T);
      pe.mx = pe.px + pe.L * Math.sin(ang); pe.my = pe.py + pe.L * Math.cos(ang);
      if (vivo && Math.hypot(pcx - pe.mx, pcy - pe.my) < 0.95) J.herir(g, pe.mx);
    }
    // ---- pinchos ----
    if (vivo) for (const s of w.picos) if (J.solapa(p, { x: s.x + 0.1, y: s.y + 0.5, w: s.largo - 0.2, h: 0.5 })) J.herir(g, s.x + s.largo / 2);
    // ---- cinta transportadora y bloque de onda (según lo que haya bajo los pies) ----
    for (const r of w.rebotes) r.comp = Math.max(0, r.comp - dt * 5);
    if (vivo && p.suelo) {
      const tx = Math.floor(pcx), ty = Math.floor(p.y + p.h + 0.03), tb = w.get(tx, ty);
      if (tb === 9) { const c = w.cintas.find((q) => q.y === ty && tx >= q.x && tx < q.x + q.largo); if (c) J.moverX(w, p, c.v * dt); }
      else if (tb === 10) {
        const r = w.rebotes.find((q) => q.y === ty && tx >= q.x && tx < q.x + q.largo);
        p.vy = -F.vResorte * (inp.salto ? 1 : 0.88); p.suelo = false; p.coyote = 0; p.saltando = false;
        if (r) r.comp = 1;
        J.Audio.sfx('resorte'); J.chispas(g, pcx * T, (p.y + p.h) * T, 8, '#7ff3ff', 3, 3);
      }
    }
    // ---- sprint: la cámara avanza sola y empuja ----
    for (const sp of w.sprints) {
      if (sp.hecho) continue;
      if (!sp.activo && !g.sprintActivo && vivo && p.x >= sp.ini && p.x < sp.fin) {
        sp.activo = true; g.sprintActivo = sp;
        sp.cam = g.snapCamara ? Math.max(0, p.x - 10) : Math.max(0, g.cam.x / T);
        J.Audio.sfx('sprint'); g.ui.aviso('¡CORRE!');
      }
      if (sp.activo) {
        sp.cam = Math.min(sp.cam + sp.v * dt, Math.max(0, w.ancho - J.VW / T));
        const izq = sp.cam, der = sp.cam + J.VW / T;
        if (vivo) {
          if (p.x + p.w < izq + 0.6) { g.ui.aviso('¡La oleada te alcanzó!'); J.caerEnFoso(g); }
          else if (p.x < izq + 0.25) { p.x = izq + 0.25; if (p.vx < 0) p.vx = 0; }
          if (p.x + p.w > der - 0.3) { p.x = der - 0.3 - p.w; if (p.vx > sp.v) p.vx = sp.v; }
        }
        if (vivo && p.x >= sp.fin) { sp.activo = false; sp.hecho = true; g.sprintActivo = null; g.ui.aviso('¡Tramo superado!'); J.Audio.sfx('checkpoint'); J.chispas(g, pcx * T, pcy * T, 20, '#2ee59d', 5, 3); }
      }
    }
    // ---- carteles ----
    let cerca = null;
    for (const c of w.carteles) { c.cerca = vivo && Math.abs(pcx - (c.x + 0.5)) < 2.2 && Math.abs(pcy - (c.y + 0.5)) < 2.6; if (c.cerca && !cerca) cerca = c; }
    if (cerca !== g.cartelActual) { g.cartelActual = cerca; if (g.ui.cartel) g.ui.cartel(cerca ? cerca.texto : null); }
    // ---- efectos (explosiones) ----
    for (const e of g.fx) e.t += dt;
    g.fx = g.fx.filter((e) => e.t < 0.5);
  };

  P.dibujar = function (ctx, g, camX, camY, vis) {
    const w = g.w, S = J.Sprites, t = g.t;
    for (const c of w.cintas) {
      if (!vis(c.x, c.x + c.largo)) continue;
      for (let i = 0; i < c.largo; i++) S.dibujarCinta(ctx, (c.x + i) * T - camX, c.y * T - camY, c.v, t, i === 0, i === c.largo - 1);
    }
    for (const r of w.rebotes) { if (!vis(r.x, r.x + r.largo)) continue; for (let i = 0; i < r.largo; i++) S.dibujarRebote(ctx, (r.x + i) * T - camX, r.y * T - camY, t + i * 0.3, r.comp); }
    for (const s of w.picos) { if (!vis(s.x, s.x + s.largo)) continue; for (let i = 0; i < s.largo; i++) S.dibujarPicos(ctx, (s.x + i) * T - camX, s.y * T - camY); }
    for (const c of w.carteles) if (vis(c.x, c.x + 1)) S.dibujarCartel(ctx, c.x * T - camX, c.y * T - camY, c.cerca, t);
    for (const m of w.minas) if (m.estado !== 'fin' && vis(m.x - 1, m.x + 1)) S.dibujarMina(ctx, m.x * T - camX, m.y * T - camY, m.estado, t, m.k);
    for (const pr of w.prensas) {
      if (pr.base < 0 || !vis(pr.x, pr.x + pr.largo)) continue;
      if (pr.aviso || pr.cab > pr.y + 0.2) {   // sombra de aviso en el suelo
        const a = pr.aviso ? 0.25 + 0.2 * Math.abs(Math.sin(t * 16)) : 0.2;
        ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.fillRect(Math.round(pr.x * T - camX), Math.round(pr.base * T - camY) - 2, pr.largo * T, 3);
        if (pr.aviso) { ctx.fillStyle = Math.floor(t * 14) % 2 ? '#ff4d6d' : '#ffd166'; ctx.fillRect(Math.round(pr.x * T - camX), Math.round(pr.base * T - camY) - 3, pr.largo * T, 1); }
      }
      S.dibujarPrensa(ctx, pr.x * T - camX, (pr.y - 1) * T - camY, pr.cab * T - camY, pr.largo * T, pr.aviso, t);
    }
    for (const pe of w.pendulos) if (vis(pe.px - pe.L, pe.px + pe.L)) S.dibujarPendulo(ctx, pe.px * T - camX, pe.py * T - camY, pe.mx * T - camX, pe.my * T - camY, t);
  };

  /** Capa final (por encima del jugador): explosiones y la «oleada» del sprint. */
  P.dibujarFinal = function (ctx, g, camX, camY) {
    for (const e of g.fx) {
      const k = e.t / 0.5, r = e.r * T * (0.3 + k * 0.9), x = Math.round(e.x * T - camX), y = Math.round(e.y * T - camY);
      ctx.globalAlpha = 1 - k;
      for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; ctx.fillStyle = i % 2 ? '#ffd166' : '#ff7a2a'; ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 3, 3); }
      ctx.globalAlpha = (1 - k) * 0.35; J.Temas.disco(ctx, x, y, Math.round(r * 0.8), '#ffb020'); ctx.globalAlpha = 1;
    }
    const sp = g.sprintActivo;
    if (sp) {   // oleada de radicales por la izquierda
      const t = g.t, izq = Math.round(sp.cam * T - camX);
      for (let y = 0; y < J.VH; y += 2) {
        const o = Math.round(Math.sin(t * 9 + y * 0.12) * 3 + Math.sin(t * 5 + y * 0.3) * 2), ancho = 12 + o;
        ctx.fillStyle = 'rgba(255,61,166,.55)'; ctx.fillRect(izq - 6, y, ancho, 2);
        ctx.fillStyle = 'rgba(255,230,120,.9)'; ctx.fillRect(izq + ancho - 8, y, 2, 2);
      }
      ctx.fillStyle = 'rgba(255,61,166,.14)'; ctx.fillRect(izq, 0, 40, J.VH);
      const prog = Math.min(1, (g.jugador.x - sp.ini) / (sp.fin - sp.ini));   // barra de progreso del tramo
      ctx.fillStyle = '#0b1230'; ctx.fillRect(J.VW / 2 - 52, J.VH - 12, 104, 6); ctx.fillStyle = '#ffd166'; ctx.fillRect(J.VW / 2 - 51, J.VH - 11, Math.round(102 * prog), 4);
    }
  };
})();
