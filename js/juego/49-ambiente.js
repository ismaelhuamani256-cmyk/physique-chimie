// =====================================================================================
// 49-ambiente.js — DECORACIÓN, PELIGROS DEL ENTORNO y ENEMIGOS CON COMPORTAMIENTO (todo diseño propio)
//   · Props procedurales según el ESTILO del tema (cueva, lab, castillo, espacio, hielo, horno, nube…): se colocan solos
//     sobre el suelo y colgando del techo, así que TODOS los niveles ganan ambiente sin reescribirlos.
//   · Segmentos de nivel:
//       {"tipo":"estalactita","x":30}                      cae cuando pasas debajo (tiembla 0.65 s antes de caer)
//       {"tipo":"lluvia_rocas","x":50,"w":10,"periodo":2.2} zona donde caen rocas con sombra de aviso
//       {"tipo":"bicho","x":40,"y":13,"bicho":"embestidor|demonio|murcielago|neutrino","nombre":"…","correccion":"…"}
//   · Bichos:  embestidor «Toro Basáltico» (te ve, resopla y EMBISTE), demonio «Diablillo de Entropía» (vuela y PICA en picado),
//              murcielago (zigzag veloz), neutrino (fantasma tímido: te persigue solo si NO lo miras; se mata con fotones o supernova).
//     Se pisan como los demás enemigos (muestran la corrección del error típico), salvo el neutrino.
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const A = (J.Ambiente = {});
  const T = 16, OUT = '#0b1230';
  const SOL = (t) => t === 1 || t === 3 || t === 4 || t === 5 || t === 6 || t === 7 || t === 8 || t === 9 || t === 10;
  const D = (...a) => J.Temas.disco(...a), P = (...a) => J.Temas.poli(...a);
  const r = Math.round;

  const PROPS = {
    cueva: ['estalagmita', 'cristal', 'hongo', 'charco', 'cristal'], lab: ['matraz', 'probetas', 'pantalla', 'bombona'], castillo: ['antorcha', 'estandarte', 'brasero', 'antorcha'],
    espacio: ['antena', 'crater', 'baliza', 'roca'], hielo: ['picos_hielo', 'monticulo', 'muneco', 'picos_hielo'], horno: ['tuberia_vapor', 'manometro', 'barril', 'tuberia_vapor'],
    nube: ['nubecita', 'antena_onda', 'nubecita'], agua: ['roca'], natural: ['arbusto', 'flor', 'roca', 'arbusto'],
  };
  const COLG = { cueva: ['estalactita_deco', 'estalactita_deco', 'gotera'], hielo: ['carambano', 'carambano'], castillo: ['cadena', 'cadena'], lab: ['cable', 'gotera'], horno: ['tuberia_techo'] };
  const BICHO = { embestidor: { w: 1.3, h: 1.0 }, demonio: { w: 1.0, h: 1.0 }, murcielago: { w: 0.9, h: 0.6 }, neutrino: { w: 1.0, h: 1.1 } };

  // ---------- utilidades ----------
  const sueloBajo = (w, x, y0) => { for (let y = Math.max(0, Math.floor(y0)); y < w.alto; y++) if (SOL(w.get(Math.floor(x), y))) return y; return w.alto; };
  function fragmentos(g, wx, wy, colores) {
    if (J.Quiz && J.Quiz.fragmentos) J.Quiz.fragmentos(g, wx, wy, colores); else J.chispas(g, wx * T, wy * T, 8, colores[0], 3);
  }

  // ---------- inicio ----------
  A.iniciar = function (g) {
    const w = g.w, segs = g.nivel.segmentos || [], est = g.tema.estilo;
    g.bichos = []; g.estal = []; g.lluvias = []; g.rocas = []; g.props = []; g.colgantes = [];
    for (const s of segs) {
      if (s.tipo === 'bicho') {
        const d = BICHO[s.bicho] || BICHO.embestidor, vuela = s.bicho === 'demonio' || s.bicho === 'murcielago' || s.bicho === 'neutrino';
        const y = vuela ? s.y : s.y + 1 - d.h;
        g.bichos.push({ tipo: BICHO[s.bicho] ? s.bicho : 'embestidor', x: s.x, y, x0: s.x, y0: y, w: d.w, h: d.h, vx: 0, vy: 0, dir: -1, suelo: false, estado: 'patrulla', t: 0, cd: 0, vivo: true, muertoT: 0,
          nombre: s.nombre || 'Error', correccion: s.correccion || '', ph: (J.hash(String(s.x) + s.bicho) % 628) / 100, alpha: 1, timido: false });
      } else if (s.tipo === 'estalactita') g.estal.push({ x: Math.floor(s.x), largo: 2, estado: 'quieta', t: 0, y: 0, vy: 0 });
      else if (s.tipo === 'lluvia_rocas') g.lluvias.push({ x: s.x, w: s.w || 8, periodo: s.periodo || 2.2, t: 1 });
    }
    // props deterministas por capítulo; no se ponen junto a objetos de juego
    const ocupado = segs.filter((s) => typeof s.x === 'number' && !['plataforma', 'foso', 'rastro_monedas', 'zona_campo', 'zona_agua', 'bicho', 'estalactita', 'lluvia_rocas'].includes(s.tipo)).map((s) => [s.x - 1.5, s.x + (s.largo || s.w || 2) + 1.5]);
    const rnd = window.PCB.util.rng(J.hash(g.capId || 'x') + 11);
    const kinds = PROPS[est] || PROPS.natural;
    for (let x = 3; x < w.ancho - 3; x += 3 + Math.floor(rnd() * 4)) {
      const top = w.topAt(x); if (top <= 2 || top >= w.alto - 1 || ocupado.some(([a, b]) => x >= a && x <= b)) continue;
      g.props.push({ k: kinds[Math.floor(rnd() * kinds.length)], x: x + rnd() * 0.6, y: top, fase: rnd() * 6.28, s: rnd() });
    }
    const ck = COLG[est] || [];
    if (ck.length) for (let x = 2; x < w.ancho; x += 3 + Math.floor(rnd() * 6)) g.colgantes.push({ k: ck[Math.floor(rnd() * ck.length)], x: x + rnd(), fase: rnd() * 6.28, s: rnd() });
  };

  // ---------- simulación ----------
  A.matar = function (g, e, por) {
    e.muertoT = 0.001; J.Audio.sfx('pisoton');
    J.chispas(g, (e.x + e.w / 2) * T, (e.y + e.h / 2) * T, 12, por === 'foton' ? '#6ff0ff' : '#ffd166', 4);
    if (g.ui && e.correccion) g.ui.error(e);
  };

  function mover(g, e, dt, pcx, pcy) {
    const w = g.w, p = g.jugador, F = g.F;
    e.t += dt; e.cd = Math.max(0, e.cd - dt);
    const cx = e.x + e.w / 2;
    if (e.tipo === 'embestidor') {
      e.vy = Math.min(J.FIS.CAIDA_MAX, e.vy + F.g * dt);
      const lineaVista = Math.abs(pcy - (e.y + e.h / 2)) < 1.7 && (pcx - cx) * e.dir > 0 && Math.abs(pcx - cx) < 10;
      let vx = 0;
      if (e.estado === 'patrulla') { vx = e.dir * 1.0; if (lineaVista && e.suelo && e.cd <= 0 && !p.muriendo) { e.estado = 'aviso'; e.t = 0; J.Audio.sfx('aviso'); } }
      else if (e.estado === 'aviso') { if (e.t > 0.65) { e.estado = 'carga'; e.t = 0; J.Audio.sfx('fuego'); } }
      else if (e.estado === 'carga') { vx = e.dir * 8.5; if (e.t > 1.8) { e.estado = 'cansado'; e.t = 0; } if (Math.random() < 0.4) J.chispas(g, (cx - e.dir * 0.7) * T, (e.y + e.h) * T, 1, '#cfd8f0', 1.5, 2); }
      else if (e.estado === 'cansado') { if (e.t > 1.0) { e.estado = 'patrulla'; e.cd = 1.4; } }
      const choco = J.moverX(w, e, vx * dt); e.suelo = false; e.sobre = null; J.moverY(w, e, e.vy * dt);
      if (choco) { if (e.estado === 'carga') { e.estado = 'cansado'; e.t = 0; g.shake = Math.max(g.shake, 4); J.Audio.sfx('onda'); } else e.dir *= -1; }
      if (e.suelo && e.estado !== 'aviso' && e.estado !== 'cansado') {
        const fx = e.dir > 0 ? e.x + e.w + 0.05 : e.x - 0.05, t = w.get(Math.floor(fx), Math.floor(e.y + e.h + 0.1));
        if (!(SOL(t) || t === 2)) { if (e.estado === 'carga') { e.estado = 'cansado'; e.t = 0; } else e.dir *= -1; }
        if (e.estado === 'patrulla' && Math.abs(e.x - e.x0) > 7) e.dir = e.x > e.x0 ? -1 : 1;
      }
      if (e.y > w.alto) e.vivo = false;
    } else if (e.tipo === 'demonio') {
      if (e.estado === 'patrulla') {
        e.x = e.x0 + Math.sin(e.t * 0.9 + e.ph) * 3; e.y = e.y0 + Math.sin(e.t * 1.7 + e.ph) * 0.5; e.dir = Math.cos(e.t * 0.9 + e.ph) > 0 ? 1 : -1;
        if (e.cd <= 0 && !p.muriendo && Math.abs(pcx - cx) < 6.5 && pcy > e.y && pcy - e.y < 8) { e.estado = 'aviso'; e.t = 0; e.tx = pcx - e.w / 2; e.ty = Math.min(pcy - e.h / 2, sueloBajo(w, pcx, e.y) - e.h); J.Audio.sfx('aviso'); }
      } else if (e.estado === 'aviso') { if (e.t > 0.55) { const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy) || 1; e.vx = (dx / d) * 10; e.vy = (dy / d) * 10; e.estado = 'pica'; e.t = 0; J.Audio.sfx('fuego'); } }
      else if (e.estado === 'pica') { e.x += e.vx * dt; e.y += e.vy * dt; e.dir = e.vx > 0 ? 1 : -1; if (Math.hypot(e.tx - e.x, e.ty - e.y) < 0.4 || e.t > 0.9) { e.estado = 'sube'; e.t = 0; } }
      else if (e.estado === 'sube') { const dx = e.x0 - e.x, dy = e.y0 - e.y, d = Math.hypot(dx, dy); if (d < 0.25) { e.estado = 'patrulla'; e.cd = 1.8; e.t = 0; } else { e.x += (dx / d) * 4.5 * dt; e.y += (dy / d) * 4.5 * dt; e.dir = dx > 0 ? 1 : -1; } }
    } else if (e.tipo === 'murcielago') {
      const nx = e.x0 + Math.sin(e.t * 1.1 + e.ph) * 5;
      e.dir = nx > e.x ? 1 : -1; e.x = nx; e.y = e.y0 + Math.sin(e.t * 3.2 + e.ph) * 0.8 + Math.sin(e.t * 0.7) * 1;
    } else if (e.tipo === 'neutrino') {
      // tímido: si el jugador lo mira (está de cara a él) se queda quieto, translúcido y inofensivo; si le das la espalda, te persigue
      const mirando = (cx - pcx) * p.dir > 0;
      e.timido = mirando && Math.abs(cx - pcx) < 14;
      e.alpha += ((e.timido ? 0.38 : 0.9) - e.alpha) * Math.min(1, dt * 6);
      if (!e.timido && !p.muriendo && Math.abs(cx - pcx) < 14) { const dx = pcx - cx, dy = pcy - (e.y + e.h / 2), d = Math.hypot(dx, dy) || 1; e.x += (dx / d) * 2.1 * dt; e.y += (dy / d) * 2.1 * dt; }
      e.dir = pcx > cx ? 1 : -1; e.y += Math.sin(e.t * 2 + e.ph) * 0.4 * dt;
    }
  }
  function contacto(g, e) {
    const p = g.jugador, F = g.F;
    if (p.muriendo || !J.solapa(p, e)) return;
    if (p.estrella > 0) { A.matar(g, e, 'estrella'); return; }
    if (e.tipo === 'neutrino') { if (!e.timido) J.herir(g, e.x + e.w / 2); return; }   // un fantasma no se pisa: usa fotones o la supernova
    if (p.vy > 0.5 && p.y + p.h - e.y < e.h * 0.65) {
      A.matar(g, e, 'pisoton'); p.vy = g.inp.salto ? -F.v0 * 0.95 : -F.v0 * 0.6; p.suelo = false; p.saltando = !!g.inp.salto; p.coyote = 0;
    } else J.herir(g, e.x + e.w / 2);
  }
  A.paso = function (g, dt) {
    const w = g.w, p = g.jugador; if (!g.bichos) return;
    const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    for (const e of g.bichos) {
      if (!e.vivo) continue;
      if (e.muertoT > 0) { e.muertoT += dt; if (e.muertoT > 0.5) e.vivo = false; continue; }
      if (Math.abs(e.x - p.x) > 30) continue;
      mover(g, e, dt, pcx, pcy); contacto(g, e);
    }
    // estalactitas: tiemblan y caen cuando pasas debajo
    for (const s of g.estal) {
      if (s.estado === 'quieta') { if (!p.muriendo && Math.abs(pcx - (s.x + 0.5)) < 1.4 && pcy > s.largo + 0.5) { s.estado = 'tiembla'; s.t = 0; J.Audio.sfx('aviso'); } }
      else if (s.estado === 'tiembla') { s.t += dt; if (Math.random() < 0.4) J.chispas(g, (s.x + 0.5) * T, 2 * T, 1, '#cfd8f0', 1, 2); if (s.t > 0.65) { s.estado = 'cae'; s.vy = 0; s.y = 0; } }
      else if (s.estado === 'cae') {
        s.vy = Math.min(18, s.vy + 26 * dt); s.y += s.vy * dt;
        const punta = s.y + s.largo;
        const rota = () => { s.estado = 'rota'; s.t = 0; g.shake = Math.max(g.shake, 3); J.Audio.sfx('romper'); fragmentos(g, s.x + 0.5, Math.min(punta, w.alto - 1), ['#cfd8f0', '#8a90b8', '#ffffff']); };
        if (!p.muriendo && J.solapa(p, { x: s.x + 0.15, y: s.y, w: 0.7, h: s.largo })) { J.herir(g, s.x + 0.5); rota(); }
        else if (punta >= w.alto || SOL(w.get(s.x, Math.floor(punta)))) rota();
      } else if (s.estado === 'rota') { s.t += dt; if (s.t > 5) { s.estado = 'quieta'; s.y = 0; } }
    }
    // lluvia de rocas: marca (sombra) y caída
    for (const z of g.lluvias) {
      if (pcx < z.x - 14 || pcx > z.x + z.w + 14) continue;
      z.t -= dt;
      if (z.t <= 0) { z.t = z.periodo * (0.6 + Math.random() * 0.8); const cx = z.x + Math.random() * z.w; g.rocas.push({ x: cx, y: -1, vy: 0, estado: 'marca', t: 0, suelo: sueloBajo(w, cx, 0) }); }
    }
    for (const k of g.rocas) {
      k.t += dt;
      if (k.estado === 'marca') { if (k.t > 0.8) { k.estado = 'cae'; k.vy = 3; } continue; }
      k.vy = Math.min(16, k.vy + 30 * dt); k.y += k.vy * dt;
      if (!p.muriendo && Math.hypot(pcx - k.x, pcy - k.y) < 0.65) { J.herir(g, k.x); k.muerto = true; fragmentos(g, k.x, k.y, ['#8a8aa0', '#5a5a74', '#cfd0e0']); }
      else if (k.y + 0.4 >= k.suelo) { k.muerto = true; g.shake = Math.max(g.shake, 2); J.Audio.sfx('romper'); fragmentos(g, k.x, k.suelo - 0.3, ['#8a8aa0', '#5a5a74', '#cfd0e0']); }
    }
    g.rocas = g.rocas.filter((k) => !k.muerto);
  };

  // ---------- dibujo: decoración (detrás de las entidades) ----------
  const px = (x, camX) => r(x * T - camX);
  const flame = (ctx, x, y, t, s) => { const h = 6 + Math.sin(t * 17 + s) * 2 + Math.sin(t * 29) * 1; P(ctx, [[x - 3, y], [x, y - h - 3], [x + 3, y]], '#ff7a2a'); P(ctx, [[x - 2, y], [x, y - h], [x + 2, y]], '#ffd166'); ctx.fillStyle = '#fff'; ctx.fillRect(x, y - 2, 1, 2); };
  const PROP = {
    estalagmita(ctx, x, b, t, o, pal) { P(ctx, [[x - 5, b], [x - 1, b - 9 - o.s * 10], [x + 5, b]], pal.linea); P(ctx, [[x - 4, b], [x - 1, b - 8 - o.s * 10], [x + 3, b]], pal.fillB); },
    cristal(ctx, x, b, t, o, pal) { const col = o.s < 0.5 ? pal.acento : pal.acento2; ctx.globalAlpha = 0.14 + 0.08 * Math.sin(t * 2 + o.fase); D(ctx, x + 3, b - 8, 14, col); ctx.globalAlpha = 1; for (let k = 0; k < 3; k++) { const hh = 8 + ((o.s * 10 + k * 7) % 10), ox = x + k * 5 - 4; P(ctx, [[ox, b], [ox + 2, b - hh], [ox + 5, b]], col); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.7; ctx.fillRect(ox + 2, b - hh + 2, 1, 3); ctx.globalAlpha = 1; } },
    hongo(ctx, x, b, t, o, pal) { ctx.fillStyle = '#d8c8b0'; ctx.fillRect(x - 1, b - 5, 3, 5); ctx.globalAlpha = 0.25; D(ctx, x, b - 7, 9, pal.acento2); ctx.globalAlpha = 1; D(ctx, x, b - 6, 5, OUT); D(ctx, x, b - 6, 4, pal.acento2); ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, b - 8, 1, 1); ctx.fillRect(x + 1, b - 7, 1, 1); },
    charco(ctx, x, b, t) { ctx.fillStyle = 'rgba(110,170,255,.35)'; ctx.fillRect(x - 7, b - 1, 14, 1); if (Math.floor(t * 2 + x) % 3 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 3 + (Math.floor(t * 3) % 6), b - 1, 1, 1); } },
    matraz(ctx, x, b, t, o, pal) { const col = o.s < 0.5 ? pal.acento : pal.acento2; P(ctx, [[x - 6, b], [x + 6, b], [x + 2, b - 10], [x - 2, b - 10]], OUT); P(ctx, [[x - 5, b - 1], [x + 5, b - 1], [x + 2, b - 8], [x - 2, b - 8]], 'rgba(200,230,255,.35)'); P(ctx, [[x - 5, b - 1], [x + 5, b - 1], [x + 3, b - 5], [x - 3, b - 5]], col); ctx.fillStyle = OUT; ctx.fillRect(x - 2, b - 14, 4, 5); ctx.fillStyle = 'rgba(220,240,255,.5)'; ctx.fillRect(x - 1, b - 13, 2, 4); for (let k = 0; k < 2; k++) { const f = (t * 0.9 + k * 0.5 + o.fase) % 1; ctx.fillStyle = '#fff'; ctx.fillRect(x - 2 + k * 3, r(b - 3 - f * 9), 1, 1); } },
    probetas(ctx, x, b, t, o, pal) { ctx.fillStyle = OUT; ctx.fillRect(x - 8, b - 2, 17, 2); for (let k = 0; k < 3; k++) { const ox = x - 7 + k * 6; ctx.fillStyle = OUT; ctx.fillRect(ox, b - 12, 4, 10); ctx.fillStyle = 'rgba(200,230,255,.4)'; ctx.fillRect(ox + 1, b - 11, 2, 8); ctx.fillStyle = [pal.acento, pal.acento2, '#ffe27a'][k]; ctx.fillRect(ox + 1, b - 3 - (3 + k * 2), 2, 3 + k * 2); } },
    pantalla(ctx, x, b, t, o, pal) { ctx.fillStyle = OUT; ctx.fillRect(x - 8, b - 15, 16, 12); ctx.fillRect(x - 1, b - 3, 3, 3); ctx.fillRect(x - 5, b - 1, 11, 1); ctx.fillStyle = '#0a1a3a'; ctx.fillRect(x - 7, b - 14, 14, 10); ctx.fillStyle = pal.acento; for (let k = 0; k < 13; k++) ctx.fillRect(x - 6 + k, b - 9 + r(Math.sin(k * 0.8 + t * 3 + o.fase) * 3), 1, 1); },
    bombona(ctx, x, b, t, o, pal) { ctx.fillStyle = OUT; ctx.fillRect(x - 4, b - 15, 8, 15); ctx.fillRect(x - 2, b - 18, 4, 3); ctx.fillStyle = '#9fb2dc'; ctx.fillRect(x - 3, b - 14, 6, 13); ctx.fillStyle = pal.acento2; ctx.fillRect(x - 3, b - 9, 6, 3); ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, b - 14, 1, 12); },
    antorcha(ctx, x, b, t, o) { ctx.fillStyle = '#3a2220'; ctx.fillRect(x - 1, b - 14, 3, 14); ctx.fillStyle = '#5a3a32'; ctx.fillRect(x - 3, b - 18, 7, 4); ctx.globalAlpha = 0.14 + 0.06 * Math.sin(t * 11 + o.fase); D(ctx, x, b - 22, 20, '#ff9f1c'); ctx.globalAlpha = 1; flame(ctx, x, b - 18, t, o.fase); },
    estandarte(ctx, x, b, t, o, pal) { ctx.fillStyle = '#3a2220'; ctx.fillRect(x - 1, b - 28, 2, 28); P(ctx, [[x + 1, b - 27], [x + 14, b - 27 + Math.sin(t * 3 + o.fase) * 1.5], [x + 14, b - 12], [x + 7, b - 15], [x + 1, b - 12]], '#8a1a2a'); D(ctx, x + 8, b - 21, 3, pal.acento); D(ctx, x + 8, b - 21, 1, '#fff'); },
    brasero(ctx, x, b, t, o) { P(ctx, [[x - 6, b - 8], [x + 6, b - 8], [x + 3, b - 3], [x - 3, b - 3]], '#3a2220'); ctx.fillStyle = '#3a2220'; ctx.fillRect(x - 1, b - 3, 3, 3); ctx.fillRect(x - 4, b - 1, 9, 1); ctx.globalAlpha = 0.16; D(ctx, x, b - 12, 16, '#ff9f1c'); ctx.globalAlpha = 1; flame(ctx, x, b - 8, t, o.fase); },
    antena(ctx, x, b, t, o, pal) { ctx.fillStyle = '#5a6aa0'; ctx.fillRect(x, b - 14, 2, 14); ctx.fillRect(x - 3, b - 2, 8, 2); P(ctx, [[x - 6, b - 15], [x + 8, b - 15], [x + 1, b - 9]], '#8aa0d0'); ctx.fillStyle = Math.floor(t * 2 + o.fase) % 2 ? pal.acento2 : '#ff4d6d'; ctx.fillRect(x, b - 17, 2, 2); },
    crater(ctx, x, b) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 8, b - 1, 16, 1); ctx.fillStyle = 'rgba(160,180,230,.3)'; ctx.fillRect(x - 6, b - 2, 12, 1); },
    baliza(ctx, x, b, t, o, pal) { ctx.fillStyle = '#5a6aa0'; ctx.fillRect(x, b - 10, 2, 10); const on = Math.floor(t * 1.5 + o.fase) % 2; ctx.fillStyle = on ? pal.acento : '#2a3a5a'; ctx.fillRect(x - 1, b - 13, 4, 3); if (on) { ctx.globalAlpha = 0.2; D(ctx, x + 1, b - 12, 8, pal.acento); ctx.globalAlpha = 1; } },
    roca(ctx, x, b, t, o, pal) { P(ctx, [[x - 6, b], [x - 4, b - 6], [x + 1, b - 8], [x + 5, b - 4], [x + 6, b]], OUT); P(ctx, [[x - 5, b], [x - 3, b - 5], [x + 1, b - 7], [x + 4, b - 3], [x + 5, b]], pal.top2); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x - 2, b - 6, 3, 1); },
    picos_hielo(ctx, x, b) { for (let k = 0; k < 3; k++) { const hh = 7 + ((k * 5) % 7); P(ctx, [[x - 6 + k * 4, b], [x - 4 + k * 4, b - hh], [x - 1 + k * 4, b]], k % 2 ? '#9fe7ff' : '#d8f4ff'); } },
    monticulo(ctx, x, b) { D(ctx, x, b, 8, '#e8f8ff'); ctx.fillStyle = '#b8dcf5'; ctx.fillRect(x - 5, b - 2, 10, 1); },
    muneco(ctx, x, b, t, o) { D(ctx, x, b - 4, 5, OUT); D(ctx, x, b - 4, 4, '#fff'); D(ctx, x, b - 11, 4, OUT); D(ctx, x, b - 11, 3, '#fff'); ctx.fillStyle = OUT; ctx.fillRect(x - 2, b - 12, 1, 1); ctx.fillRect(x + 1, b - 12, 1, 1); ctx.fillStyle = '#ff9f1c'; ctx.fillRect(x, b - 11, 3, 1); ctx.fillStyle = '#ff4d6d'; ctx.fillRect(x - 3, b - 8, 7, 2); ctx.fillRect(x + 2 + (Math.floor(t * 2 + o.fase) % 2), b - 7, 1, 3); },
    tuberia_vapor(ctx, x, b, t, o) { ctx.fillStyle = OUT; ctx.fillRect(x - 3, b - 14, 7, 14); ctx.fillStyle = '#6a5040'; ctx.fillRect(x - 2, b - 13, 5, 13); ctx.fillStyle = '#ffd9a0'; ctx.fillRect(x - 2, b - 13, 1, 13); for (let k = 0; k < 3; k++) { const f = (t * 0.7 + k / 3 + o.fase) % 1; ctx.globalAlpha = 0.5 * (1 - f); D(ctx, x + Math.sin(f * 4 + k) * 3, r(b - 16 - f * 16), 2 + f * 3, '#e8e8f0'); } ctx.globalAlpha = 1; },
    manometro(ctx, x, b, t, o) { ctx.fillStyle = OUT; ctx.fillRect(x - 1, b - 7, 3, 7); D(ctx, x, b - 11, 6, OUT); D(ctx, x, b - 11, 5, '#e8e8f0'); const a = -2.4 + (Math.sin(t * 0.8 + o.fase) * 0.5 + 0.5) * 2.2; ctx.strokeStyle = '#ff4d2e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, b - 11); ctx.lineTo(x + Math.cos(a) * 4, b - 11 + Math.sin(a) * 4); ctx.stroke(); },
    barril(ctx, x, b) { ctx.fillStyle = OUT; ctx.fillRect(x - 5, b - 11, 10, 11); ctx.fillStyle = '#7a4a2a'; ctx.fillRect(x - 4, b - 10, 8, 9); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 4, b - 8, 8, 1); ctx.fillRect(x - 4, b - 3, 8, 1); ctx.fillStyle = '#ffb020'; ctx.fillRect(x - 1, b - 6, 2, 2); },
    nubecita(ctx, x, b) { ctx.globalAlpha = 0.85; D(ctx, x - 4, b - 3, 5, '#f2eaff'); D(ctx, x + 2, b - 4, 6, '#ffffff'); D(ctx, x + 7, b - 2, 4, '#e0d4ff'); ctx.globalAlpha = 1; },
    antena_onda(ctx, x, b, t, o, pal) { ctx.fillStyle = '#6d56c8'; ctx.fillRect(x, b - 12, 2, 12); D(ctx, x + 1, b - 13, 2, pal.acento); for (let k = 0; k < 2; k++) { const f = (t * 0.8 + k * 0.5 + o.fase) % 1; ctx.strokeStyle = 'rgba(255,226,122,' + (0.7 * (1 - f)) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + 1, b - 13, 3 + f * 10, -2.4, -0.7); ctx.stroke(); } },
    arbusto(ctx, x, b) { D(ctx, x - 3, b - 3, 4, '#157a45'); D(ctx, x + 2, b - 4, 5, '#1a8a5a'); D(ctx, x + 7, b - 2, 3, '#157a45'); },
    flor(ctx, x, b, t, o) { ctx.fillStyle = '#157a45'; ctx.fillRect(x, b - 6, 1, 6); ctx.fillStyle = o.s < 0.5 ? '#ff3da6' : '#ffd166'; ctx.fillRect(x - 1, b - 8, 3, 3); ctx.fillStyle = '#fff'; ctx.fillRect(x, b - 7, 1, 1); },
  };
  const COLGANTE = {
    estalactita_deco(ctx, x, t, o, pal) { const hh = 12 + o.s * 22; P(ctx, [[x - 5, 0], [x + 5, 0], [x, hh]], pal.linea); P(ctx, [[x - 4, 0], [x + 3, 0], [x - 1, hh - 2]], pal.fillB); const f = (t * 0.45 + o.fase) % 1; if (f > 0.55) { ctx.fillStyle = 'rgba(160,210,255,.8)'; ctx.fillRect(x - 1, r(hh + (f - 0.55) * 180), 1, 2); } },
    carambano(ctx, x, t, o) { const hh = 14 + o.s * 30; P(ctx, [[x - 4, 0], [x + 4, 0], [x, hh]], '#a8d8f8'); P(ctx, [[x - 2, 0], [x + 1, 0], [x - 1, hh * 0.7]], '#e8f8ff'); },
    cadena(ctx, x, t, o) { const n = 3 + Math.floor(o.s * 7), sw = Math.sin(t * 1.2 + o.fase) * 1.5; for (let k = 0; k < n; k++) { ctx.fillStyle = k % 2 ? '#4a3a3a' : '#2e2222'; ctx.fillRect(r(x + sw * (k / n)), k * 4, 2, 3); } D(ctx, r(x + sw), n * 4 + 3, 3, '#4a3a3a'); },
    cable(ctx, x, t, o, pal) { const n = 8 + Math.floor(o.s * 22); ctx.fillStyle = OUT; for (let k = 0; k < n; k++) ctx.fillRect(r(x + Math.sin(k * 0.35 + o.fase) * 3 + Math.sin(t + o.fase) * 1.2), k * 2, 2, 2); if (Math.floor(t * 3 + o.fase * 5) % 6 === 0) { ctx.fillStyle = pal.acento; ctx.fillRect(r(x), n * 2, 3, 3); ctx.fillStyle = '#fff'; ctx.fillRect(r(x) + 1, n * 2 + 1, 1, 1); } },
    gotera(ctx, x, t, o, pal) { ctx.fillStyle = OUT; ctx.fillRect(x - 3, 0, 7, 5); ctx.fillStyle = '#6a7aa0'; ctx.fillRect(x - 2, 0, 5, 4); const f = (t * 0.6 + o.fase) % 1; if (f > 0.5) { ctx.fillStyle = pal.acento; ctx.fillRect(x, r(5 + (f - 0.5) * 220), 1, 2); } },
    tuberia_techo(ctx, x, t, o) { ctx.fillStyle = OUT; ctx.fillRect(x - 3, 0, 7, 8); ctx.fillStyle = '#6a5040'; ctx.fillRect(x - 2, 0, 5, 7); const f = (t * 0.7 + o.fase) % 1; if (f > 0.4) { ctx.fillStyle = '#ffb020'; ctx.fillRect(x, r(8 + (f - 0.4) * 200), 1, 2); } },
  };
  A.dibujarAtras = function (ctx, g, camX, camY) {
    if (!g.props) return;
    const pal = g.tema.pal, t = g.t, vis = (x) => x * T > camX - 30 && x * T < camX + J.VW + 30;
    for (const c of g.colgantes) if (vis(c.x)) { const f = COLGANTE[c.k]; if (f) f(ctx, px(c.x, camX), t, c, pal); }
    for (const q of g.props) if (vis(q.x)) { const f = PROP[q.k]; if (f) f(ctx, px(q.x, camX), r(q.y * T - camY), t, q, pal); }
  };

  // ---------- dibujo: peligros y bichos (delante) ----------
  const flip = (ctx, cx, dir, fn) => { ctx.save(); if (dir < 0) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); } fn(); ctx.restore(); };
  function dibBicho(ctx, e, t, camX, camY) {
    const x = r((e.x + e.w / 2) * T - camX), yb = r((e.y + e.h) * T - camY), yc = r((e.y + e.h / 2) * T - camY);
    if (e.muertoT > 0) { ctx.globalAlpha = Math.max(0, 1 - e.muertoT * 2); }
    if (e.tipo === 'embestidor') {
      const aviso = e.estado === 'aviso', carga = e.estado === 'carga', temblor = aviso ? r(Math.sin(t * 70) * 1.2) : 0, pata = carga ? Math.floor(t * 18) % 2 : Math.floor(t * 6) % 2;
      flip(ctx, x, e.dir, () => {
        ctx.fillStyle = OUT; ctx.fillRect(x - 10 + temblor, yb - 13, 21, 11); ctx.fillRect(x - 9, yb - 4 + 0, 4, 4); ctx.fillRect(x + 4, yb - 4, 4, 4);
        ctx.fillStyle = aviso ? '#c03a2a' : '#7a2a2a'; ctx.fillRect(x - 9 + temblor, yb - 12, 19, 9);
        ctx.fillStyle = '#9a3a3a'; ctx.fillRect(x - 9 + temblor, yb - 12, 19, 2);
        ctx.fillStyle = '#4a1a1a'; ctx.fillRect(x - 8, yb - 3 + (pata ? 0 : -1), 4, 3 + (pata ? 0 : 1)); ctx.fillRect(x + 4, yb - 3 + (pata ? -1 : 0), 4, 3 + (pata ? 1 : 0));
        // cabeza con cuernos hacia delante (derecha)
        ctx.fillStyle = OUT; ctx.fillRect(x + 6, yb - 13, 8, 9); ctx.fillStyle = '#8a3030'; ctx.fillRect(x + 7, yb - 12, 6, 7);
        P(ctx, [[x + 8, yb - 12], [x + 11, yb - 19], [x + 12, yb - 12]], '#f2eadb'); P(ctx, [[x + 12, yb - 11], [x + 17, yb - 15], [x + 14, yb - 9]], '#f2eadb');
        ctx.fillStyle = aviso || carga ? '#ffe27a' : '#ffffff'; ctx.fillRect(x + 10, yb - 10, 2, 2); ctx.fillStyle = OUT; ctx.fillRect(x + 11, yb - 10, 1, 1);
        ctx.fillStyle = '#ffd166'; ctx.fillRect(x + 13, yb - 6, 2, 1);
        ctx.fillStyle = '#2a0a0a'; ctx.fillRect(x - 10, yb - 11, 2, 2);   // cola
        if (aviso) { ctx.fillStyle = 'rgba(255,255,255,.75)'; for (let k = 0; k < 3; k++) { const f = (t * 3 + k / 3) % 1; ctx.fillRect(x + 15 + r(f * 6), yb - 8 - r(f * 5), 2, 2); } }
      });
      if (aviso) { ctx.fillStyle = '#ff4d6d'; ctx.font = '8px PixelHUD, monospace'; ctx.fillText('!', x - 2, yb - 24 + r(Math.sin(t * 20) * 1)); }
    } else if (e.tipo === 'demonio') {
      const aviso = e.estado === 'aviso', pica = e.estado === 'pica', ala = Math.sin(t * (pica ? 22 : 12)), tm = aviso ? r(Math.sin(t * 80) * 1.2) : 0;
      ctx.save(); ctx.translate(tm, 0);
      P(ctx, [[x - 3, yc], [x - 13, yc - 5 - ala * 4], [x - 9, yc + 2]], OUT); P(ctx, [[x - 3, yc], [x - 12, yc - 4 - ala * 4], [x - 8, yc + 1]], '#8a3ab0');
      P(ctx, [[x + 3, yc], [x + 13, yc - 5 - ala * 4], [x + 9, yc + 2]], OUT); P(ctx, [[x + 3, yc], [x + 12, yc - 4 - ala * 4], [x + 8, yc + 1]], '#8a3ab0');
      D(ctx, x, yc, 6, OUT); D(ctx, x, yc, 5, aviso ? '#c03a8a' : '#6a2a90');
      P(ctx, [[x - 4, yc - 4], [x - 3, yc - 9], [x - 1, yc - 5]], '#ffd166'); P(ctx, [[x + 4, yc - 4], [x + 3, yc - 9], [x + 1, yc - 5]], '#ffd166');
      ctx.fillStyle = aviso || pica ? '#ff4d6d' : '#ffe27a'; ctx.fillRect(x - 3, yc - 2, 2, 2); ctx.fillRect(x + 1, yc - 2, 2, 2);
      ctx.fillStyle = OUT; ctx.fillRect(x - 2, yc + 2, 5, 1); ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, yc + 2, 1, 1); ctx.fillRect(x + 2, yc + 2, 1, 1);
      ctx.fillStyle = '#6a2a90'; ctx.fillRect(x + 4, yc + 4, 2, 2); ctx.fillStyle = '#ffd166'; ctx.fillRect(x + 6, yc + 5, 2, 2);
      ctx.restore();
      if (aviso) { ctx.strokeStyle = 'rgba(255,77,109,.5)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, yc); ctx.lineTo(r((e.tx + e.w / 2) * T - camX), r((e.ty + e.h / 2) * T - camY)); ctx.stroke(); ctx.setLineDash([]); }
    } else if (e.tipo === 'murcielago') {
      const ala = Math.sin(t * 20 + e.ph);
      P(ctx, [[x - 2, yc], [x - 10, yc - 4 - ala * 4], [x - 7, yc + 2]], OUT); P(ctx, [[x + 2, yc], [x + 10, yc - 4 - ala * 4], [x + 7, yc + 2]], OUT);
      P(ctx, [[x - 2, yc], [x - 9, yc - 3 - ala * 4], [x - 6, yc + 1]], '#3a3a5a'); P(ctx, [[x + 2, yc], [x + 9, yc - 3 - ala * 4], [x + 6, yc + 1]], '#3a3a5a');
      D(ctx, x, yc, 4, OUT); D(ctx, x, yc, 3, '#2a2a46'); P(ctx, [[x - 3, yc - 2], [x - 2, yc - 6], [x - 1, yc - 3]], '#2a2a46'); P(ctx, [[x + 3, yc - 2], [x + 2, yc - 6], [x + 1, yc - 3]], '#2a2a46');
      ctx.fillStyle = '#6ff0ff'; ctx.fillRect(x - 2, yc - 1, 1, 1); ctx.fillRect(x + 1, yc - 1, 1, 1);
    } else if (e.tipo === 'neutrino') {
      const ond = Math.sin(t * 5 + e.ph);
      ctx.globalAlpha = (e.muertoT > 0 ? Math.max(0, 1 - e.muertoT * 2) : 1) * e.alpha;
      ctx.globalAlpha *= 0.35; D(ctx, x, yc, 14, '#9fe7ff'); ctx.globalAlpha = (e.muertoT > 0 ? Math.max(0, 1 - e.muertoT * 2) : 1) * e.alpha;
      D(ctx, x, yc - 1, 8, OUT); D(ctx, x, yc - 1, 7, '#e8f4ff');
      for (let k = -2; k <= 2; k++) { const h = 3 + (k % 2 ? 2 : 0) + ond * (k % 2 ? 1 : -1); ctx.fillStyle = OUT; ctx.fillRect(x + k * 3 - 1, yc + 6, 4, h + 1); ctx.fillStyle = '#e8f4ff'; ctx.fillRect(x + k * 3, yc + 6, 2, h); }
      if (e.timido) { ctx.fillStyle = '#e8f4ff'; D(ctx, x - 3, yc - 2, 3, OUT); D(ctx, x + 3, yc - 2, 3, OUT); D(ctx, x - 3, yc - 2, 2, '#fff'); D(ctx, x + 3, yc - 2, 2, '#fff'); ctx.fillStyle = '#ffb0c8'; ctx.fillRect(x - 6, yc + 1, 3, 1); ctx.fillRect(x + 4, yc + 1, 3, 1); }
      else { ctx.fillStyle = OUT; ctx.fillRect(x - 4, yc - 3, 3, 4); ctx.fillRect(x + 1, yc - 3, 3, 4); ctx.fillRect(x - 2, yc + 2, 4, 3); ctx.fillStyle = '#6ff0ff'; ctx.fillRect(x - 3, yc - 2, 1, 2); ctx.fillRect(x + 2, yc - 2, 1, 2); }
    }
    ctx.globalAlpha = 1;
  }
  A.dibujar = function (ctx, g, camX, camY, vis) {
    if (!g.bichos) return;
    const t = g.t, pal = g.tema.pal;
    // estalactitas peligrosas (más grandes y brillantes que las decorativas)
    for (const s of g.estal) {
      if (!vis(s.x, s.x + 1) || s.estado === 'rota') continue;
      const sx = r((s.x + 0.5) * T - camX), sh = s.estado === 'tiembla' ? r(Math.sin(t * 90) * 1.3) : 0, y0 = r(s.y * T - camY), L = s.largo * T;
      P(ctx, [[sx - 7 + sh, y0], [sx + 7 + sh, y0], [sx + sh, y0 + L]], OUT); P(ctx, [[sx - 5 + sh, y0], [sx + 5 + sh, y0], [sx + sh, y0 + L - 3]], s.estado === 'tiembla' ? '#ffd9d9' : '#cfd8f0');
      P(ctx, [[sx - 3 + sh, y0], [sx + sh, y0], [sx - 1 + sh, y0 + L - 8]], '#ffffff'); ctx.fillStyle = '#ff4d6d'; ctx.fillRect(sx - 1 + sh, y0 + L - 4, 2, 2);
      if (s.estado === 'tiembla') { ctx.fillStyle = 'rgba(255,77,109,.35)'; ctx.fillRect(sx - 6, r(sueloBajo(g.w, s.x, 0) * T - camY) - 1, 12, 1); }
    }
    // rocas: sombra de aviso en el suelo y roca cayendo
    for (const k of g.rocas) {
      const sx = r(k.x * T - camX), sy = r(k.suelo * T - camY);
      if (k.estado === 'marca') { const a = 0.25 + 0.35 * Math.abs(Math.sin(k.t * 16)); ctx.fillStyle = 'rgba(255,77,109,' + a + ')'; ctx.fillRect(sx - 7, sy - 1, 14, 2); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(sx - 1, 0, 2, 3); continue; }
      const ry = r(k.y * T - camY);
      P(ctx, [[sx - 6, ry + 4], [sx - 5, ry - 4], [sx + 1, ry - 6], [sx + 6, ry - 2], [sx + 5, ry + 5]], OUT); P(ctx, [[sx - 5, ry + 3], [sx - 4, ry - 3], [sx + 1, ry - 5], [sx + 5, ry - 1], [sx + 4, ry + 4]], '#8a8aa0'); ctx.fillStyle = '#cfd0e0'; ctx.fillRect(sx - 3, ry - 3, 3, 1); ctx.fillStyle = '#5a5a74'; ctx.fillRect(sx, ry + 1, 4, 2);
    }
    for (const e of g.bichos) if (e.vivo && vis(e.x - 2, e.x + 3)) dibBicho(ctx, e, t, camX, camY);
  };
})();
