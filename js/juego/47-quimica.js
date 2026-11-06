// =====================================================================================
// 47-quimica.js — química JUGABLE (CONTRATO §4c/§4d)
//   · atomo: esferas CPK recolectables; el HUD lleva el inventario por elemento
//   · estacion_molecula: con los átomos recogidos abre el constructor 3D (PCB.mol3d.constructor; fallback propio si no existe)
//   · puerta_ecuacion: modal de coeficientes ± ; el CÓDIGO comprueba conservación de átomos y de carga (PCB.juego.Quimica)
//   · interruptor_estado + plataforma_estado: plataformas que dependen de una propiedad (temperatura, pH, carga)
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const Q = (J.Quim = {});
  const T = 16;

  const SUBS = '₀₁₂₃₄₅₆₇₈₉';
  /** "H3O+" -> "H₃O⁺" (para rótulos en el canvas) */
  Q.bonita = function (f) {
    f = String(f); let cuerpo = f, carga = '', m = /^(.+)\^(\d*)([+-])$/.exec(f);
    if (m) { cuerpo = m[1]; carga = (m[2] || '') + m[3]; }
    else if ((m = /^(.+)([+-])$/.exec(f))) {
      let b = m[1], mag = ''; const d = /(\d+)$/.exec(b);
      if (d) { if (d[1].length >= 2) { mag = d[1].slice(-1); b = b.slice(0, -1); } else if (/[a-z]$/.test(b.slice(0, -1))) { mag = d[1]; b = b.slice(0, -1); } }
      cuerpo = b; carga = mag + m[2];
    }
    cuerpo = cuerpo.replace(/\(aq\)|\(g\)|\(s\)|\(ℓ\)/g, '').replace(/(?<=[A-Za-z)])\d+/g, (ds) => ds.replace(/\d/g, (d) => SUBS[+d]));
    return cuerpo + carga.replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).replace('+', '⁺').replace('-', '⁻');
  };

  const COLORES = { frio: '#9fe7ff', 'frío': '#9fe7ff', caliente: '#ff7a1a', solido: '#9fe7ff', 'sólido': '#9fe7ff', liquido: '#4a9aff', 'líquido': '#4a9aff', gas: '#e8e8ff', acido: '#9dff3a', 'ácido': '#9dff3a', basico: '#a56bff', 'básico': '#a56bff', neutro: '#e8f0ff', positiva: '#ff6b6b', negativa: '#6b9bff', neutra: '#e8f0ff', '+': '#ff6b6b', '-': '#6b9bff', '−': '#6b9bff' };
  Q.colorValor = function (v) { v = String(v).toLowerCase(); if (COLORES[v]) return COLORES[v]; return 'hsl(' + (J.hash(v) % 360) + ',80%,62%)'; };

  Q.iniciar = function (g) {
    g.inv = {}; g.vars = {}; g.ecuaciones = 0;
    for (const it of g.w.interruptores) if (g.vars[it.variable] == null) g.vars[it.variable] = it.valores[0];
  };

  function cerca(g, x, y, rx, ry) { const p = g.jugador; return Math.abs(p.x + p.w / 2 - (x + 0.5)) < rx && Math.abs(p.y + p.h / 2 - (y + 0.5)) < ry; }
  const lista = (req) => Object.keys(req).map((k) => req[k] + '×' + k).join(' ');

  // ---------- recompensas de las estaciones ----------
  function recompensa(g, e) {
    const w = g.w, p = g.jugador;
    if (e.recompensa === 'abre') {
      const d = w.puertas.find((q) => q.id === e.objetivo);
      if (d && !d.abierta) J.Quiz.abrirPuerta(g, d);
    } else if (e.recompensa === 'checkpoint') { g.respawn = { x: e.x + 0.5 - p.w / 2, y: e.y + 1 - p.h }; g.ui.aviso('Checkpoint'); }
    else if (e.recompensa === 'vida') { g.vidas = Math.min(5, g.vidas + 1); g.ui.vidas(g.vidas); g.ui.aviso('¡+1 vida!'); }
    else if (e.recompensa === 'puente') {
      const b = w.puentes.find((q) => q.id === e.objetivo && q.oculto);
      if (b) {
        b.oculto = false;
        for (let i = 0; i < b.largo; i++) { for (let yy = b.y; yy < w.alto; yy++) w.tiles[yy * w.ancho + b.x + i] = 0; w.tiles[b.y * w.ancho + b.x + i] = 3; J.chispas(g, (b.x + i + 0.5) * T, (b.y + 0.5) * T, 4, '#6ff0ff', 3, 0); }
        g.ui.aviso('¡Aparece un puente!');
      }
    }
  }

  function abrirConstructor(g, e) {
    const atomosArr = Object.keys(e.requiere).flatMap((k) => Array(e.requiere[k]).fill(k));
    g.estado = 'quiz'; g.inp.accionEdge = false; g.inp.saltoEdge = false;
    const cierre = () => { g.estado = 'jugando'; g.inp.accionEdge = false; };
    g.ui.constructor(e, atomosArr, () => {   // resuelto
      for (const k in e.requiere) g.inv[k] = Math.max(0, (g.inv[k] || 0) - e.requiere[k]);
      e.hecha = true; J.Audio.sfx('estacion'); g.shake = 3;
      J.chispas(g, (e.x + 0.5) * T, (e.y + 0.3) * T, 30, '#6ff0ff', 5, 2);
      g.ui.estados(g, true);
      g.molecula = (g.molecula || 0) + 1;
      recompensa(g, e);
    }, cierre);
  }

  Q.pedirEcuacion = function (g, d) {
    g.estado = 'quiz'; g.inp.accionEdge = false; g.inp.saltoEdge = false; g.inp.arribaEdge = false;
    g.ui.ecuacion(d.eq, d.ayuda, (ok) => {
      g.estado = 'jugando'; g.inp.accionEdge = false;
      if (ok) { g.ecuaciones++; J.Audio.sfx('estacion'); J.Quiz.abrirPuerta(g, d); }
    });
  };

  Q.paso = function (g, dt) {
    const w = g.w, p = g.jugador, inp = g.inp;
    if (p.muriendo) return;
    for (const a of w.atomos) {
      if (a.tomado) continue;
      if (p.x + p.w > a.x + 0.05 && p.x < a.x + 0.95 && p.y + p.h > a.y + 0.05 && p.y < a.y + 0.95) {
        a.tomado = true; g.inv[a.el] = (g.inv[a.el] || 0) + 1; J.Audio.sfx('atomo');
        J.chispas(g, (a.x + 0.5) * T, (a.y + 0.5) * T, 12, J.Sprites.colorCPK(a.el), 3.5, 2);
        g.ui.estados(g, true); g.ui.pop('+ ' + a.el);
      }
    }
    for (const it of w.interruptores) {
      it.cd = Math.max(0, it.cd - dt);
      if (inp.accionEdge && it.cd <= 0 && cerca(g, it.x, it.y, 1.4, 1.8)) {
        it.idx = (it.idx + 1) % it.valores.length; it.cd = 0.3; g.vars[it.variable] = it.valores[it.idx];
        J.Audio.sfx('interruptor'); g.shake = Math.max(g.shake, 2);
        J.chispas(g, (it.x + 0.5) * T, (it.y + 0.5) * T, 14, Q.colorValor(g.vars[it.variable]), 4, 1);
        g.ui.aviso(it.variable + ': ' + g.vars[it.variable]); g.ui.estados(g, true);
        inp.accionEdge = false;
      }
    }
    for (const e of w.estaciones) {
      if (inp.accionEdge && cerca(g, e.x, e.y, 1.5, 1.8) && !g.anim) {
        inp.accionEdge = false;
        if (e.hecha) { g.ui.pop('Ya está montada'); continue; }
        const falta = {}; for (const k in e.requiere) if ((g.inv[k] || 0) < e.requiere[k]) falta[k] = e.requiere[k] - (g.inv[k] || 0);
        if (Object.keys(falta).length) { g.ui.aviso('Faltan: ' + lista(falta)); J.Audio.sfx('fallo'); continue; }
        abrirConstructor(g, e);
      }
    }
  };

  Q.dibujar = function (ctx, g, camX, camY, vis) {
    const w = g.w, S = J.Sprites, t = g.t, p = g.jugador;
    for (const m of w.movers) {
      if (!m.est || !vis(m.x, m.x + m.largo)) continue;
      S.dibujarPlatEstado(ctx, m.x * T - camX, m.y * T - camY, m.largo, Q.colorValor(m.valor), !m.ausente, t);
    }
    for (const a of w.atomos) if (!a.tomado && vis(a.x, a.x + 1)) S.dibujarAtomo3(ctx, (a.x + 0.5) * T - camX, (a.y + 0.5) * T - camY, a.el, t, a.fase);
    for (const it of w.interruptores) {
      if (!vis(it.x, it.x + 1)) continue;
      S.dibujarInterruptor(ctx, it.x * T - camX, it.y * T - camY, Q.colorValor(g.vars[it.variable]), t);
      if (cerca(g, it.x, it.y, 3, 2.5)) { ctx.font = '7px UI, sans-serif'; ctx.fillStyle = '#0b1230'; ctx.fillText(it.variable + ': ' + g.vars[it.variable], Math.round(it.x * T - camX - 14), Math.round(it.y * T - camY - 4)); ctx.fillStyle = '#fff'; ctx.fillText(it.variable + ': ' + g.vars[it.variable], Math.round(it.x * T - camX - 15), Math.round(it.y * T - camY - 5)); }
    }
    for (const e of w.estaciones) {
      if (!vis(e.x, e.x + 1)) continue;
      const ok = Object.keys(e.requiere).every((k) => (g.inv[k] || 0) >= e.requiere[k]);
      S.dibujarEstacion(ctx, e.x * T - camX, e.y * T - camY, ok, e.hecha, t, e.molecula);
      const near = cerca(g, e.x, e.y, 3.5, 2.5);
      if (near || e.hecha) {
        ctx.font = '8px UI, sans-serif'; const txt = Q.bonita(e.molecula), tx = Math.round(e.x * T - camX + 8 - ctx.measureText(txt).width / 2), ty = Math.round(e.y * T - camY - 6);
        ctx.fillStyle = '#0b1230'; ctx.fillText(txt, tx + 1, ty + 1); ctx.fillStyle = e.hecha ? '#2ee59d' : ok ? '#ffe27a' : '#ff9aa8'; ctx.fillText(txt, tx, ty);
        if (!e.hecha && near && !g.anim) { const ax = Math.round(e.x * T - camX + 8), ay = Math.round(e.y * T - camY - 20 + Math.sin(t * 8) * 2); ctx.fillStyle = '#0b1230'; ctx.fillRect(ax - 4, ay, 9, 3); ctx.fillRect(ax - 3, ay + 3, 7, 2); ctx.fillRect(ax - 2, ay + 5, 5, 2); ctx.fillStyle = ok ? '#ffe27a' : '#8a96b8'; ctx.fillRect(ax - 3, ay, 7, 2); ctx.fillRect(ax - 2, ay + 2, 5, 2); ctx.fillRect(ax - 1, ay + 4, 3, 2); }
      }
    }
  };
})();
