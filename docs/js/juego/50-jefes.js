// =====================================================================================
// 50-jefes.js — jefes de nivel
//   · "Gran Ejercicio" (ejercicio_bac_N): golem de ecuaciones. Embiste y salta; al chocar con la pared
//     queda ATURDIDO: píscalo y sale una pregunta del cours. 3 aciertos = derrotado; fallar lo enfurece.
//   · "Rey Entropía" (rey_entropia, nivel fortaleza): criatura de lava y engranajes, 3 fases (según aciertos).
//     Lanza bolas de fuego, ondas de choque y lluvia de brasas; cada ronda de ataques se SOBRECALIENTA
//     (aturdido) y hay que pisarlo y responder una pregunta.
//   · "Pulpo Ácido" (pulpo_acido, jefe de agua): calamar-pulpo de ácido con tinta, chorro y tentáculos.
//   · "Dragón de Tormenta" (dragon_tormenta): dragón de nubes y rayos que embiste y lanza rayos.
//   MODO QUIZ (jefe_quiz, y siempre pulpo/dragón): el jefe está BLINDADO; solo se le pisa tras acertar una pregunta
//   (acierto = −1 vida del jefe y rebote; fallo = el escudo destella, contraataca y pierdes 1 corazón).
// Diseños propios. Estados: entra · espera · aviso_* · carga · choque · salto · aturdido · pregunta · golpeado · vencido
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const Jefe = (J.Jefe = {});
  const BG = 22;   // gravedad propia de los jefes (independiente de la del nivel)

  const GOLEM = ['carga', 'salto', 'carga', 'salto'];
  const PULPO = ['tinta', 'chorro', 'tentaculos', 'tinta'];
  const DRAGON = ['rayo', 'embestida', 'rafaga', 'rayo'];
  const TAM = { golem: { w: 2.2, h: 2.6, hAt: 2.2 }, rey: { w: 3, h: 3.6, hAt: 2.6 }, bomba: { w: 3, h: 3, hAt: 2.2 }, calavera: { w: 1.8, h: 2.4, hAt: 1.7 }, pulpo: { w: 3.2, h: 3, hAt: 3, flota: 1.0 }, dragon: { w: 3.6, h: 2, hAt: 2, flota: 0.7 } };
  const NOMBRE = { golem: 'Gran Ejercicio', rey: 'Rey Entropía', bomba: 'Rey Bomba', calavera: 'Maestro Calavera', pulpo: 'Pulpo Ácido', dragon: 'Dragón de Tormenta' };
  // Jefes de física moderna: reutilizan la IA del dragón (flotante) con otra piel, otros ataques y otro nombre.
  const SKIN_ID = { isotopo_inestable: 'isotopo', foton_veloz: 'foton', bombardero_neutron: 'bombardero' };
  const SKIN_NOMBRE = { isotopo: 'Isótopo Inestable', foton: 'Fotón Veloz', bombardero: 'Bombardero Neutrón' };
  const SKIN_ATAQUES = { isotopo: ['rafaga', 'rayo', 'rafaga', 'embestida'], foton: ['embestida', 'embestida', 'rafaga', 'rayo', 'embestida'], bombardero: ['bombardeo', 'rafaga', 'bombardeo', 'rayo'] };
  const SKIN_TAM = { isotopo: { w: 3.2, h: 3.0 }, foton: { w: 2.4, h: 2.4 }, bombardero: { w: 4.6, h: 1.9 } };
  const CAL = ['huesos', 'blink', 'rayos', 'huesos', 'rayos', 'blink'];
  const BOMBA = ['lanzar', 'rodar', 'lanzar', 'salto', 'mecha'];
  const REY = [['bola', 'bola', 'arco'], ['onda', 'abanico', 'lluvia'], ['onda', 'abanico', 'lluvia', 'arco']];

  Jefe.crear = function (g) {
    const w = g.w, A = w.arena, seg = w.jefeSeg;
    const skin = SKIN_ID[seg.jefe] || null;
    let kind = skin ? 'dragon' : seg.jefe === 'rey_entropia' ? 'rey' : seg.jefe === 'rey_bomba' ? 'bomba' : seg.jefe === 'maestro_calavera' ? 'calavera' : seg.jefe === 'pulpo_acido' ? 'pulpo' : seg.jefe === 'dragon_tormenta' ? 'dragon' : 'golem';
    if (A.fort && kind === 'golem' && seg.tipo !== 'jefe_quiz') kind = 'rey';
    const rey = kind === 'rey', tam = skin ? Object.assign({}, TAM.dragon, SKIN_TAM[skin]) : TAM[kind], quiz = kind !== 'bomba' && (seg.tipo === 'jefe_quiz' || kind === 'pulpo' || kind === 'dragon');
    const floorY = w.topAt(A.izq + 1);
    const b = {
      kind, skin, rey, quiz, flota: tam.flota != null, hover: tam.flota || 0, w: tam.w, h: tam.h, hNormal: tam.h, hAt: tam.hAt,
      floorY, xmin: A.izq + 1, xmax: A.der, vx: 0, vy: 0, dir: -1, estado: 'entra', t: 0, anim: 0, flash: 0, reloj: 0, cdPreg: 0, escudoFlash: 0,
      aire: tam.flota == null, aciertos: A.progreso.aciertos, furia: A.progreso.furia, pIdx: A.progreso.pIdx, ciclo: 0, ronda: 0, prog: [],
      vidasMax: Array.isArray(seg.fases) && seg.fases.length ? seg.fases.length : quiz ? Math.max(1, seg.vidas || 3) : 3, yObj: 0,
      fases: Array.isArray(seg.fases) && seg.fases.length ? seg.fases : null,
      preguntas: seg.preguntas || (Array.isArray(seg.fases) ? seg.fases.flatMap((f) => f.preguntas || []) : []), titulo: seg.titulo || (skin ? SKIN_NOMBRE[skin] : NOMBRE[kind]),
      disp: kind === 'bomba', coraza: 8, corazaMax: 8,
      nombre: skin ? SKIN_NOMBRE[skin] : seg.jefe === 'golem_formulas' ? 'Golem de Fórmulas' : NOMBRE[kind],
    };
    b.x = J.clamp(seg.x, b.xmin + 2, b.xmax - b.w - 1);
    b.yBase = floorY - b.h - b.hover;
    b.y = b.flota ? floorY - b.h - 9 : floorY - b.h - 9;
    if (b.disp) {   // jefe de disparo: asegura munición y avisa
      b.corazaMax = b.coraza = 8;
      if (g.it && !(g.it.fuego || g.it.escopeta > 0 || g.it.canon > 0) && J.Items) J.Items.dar(g, 'fuego');
      if (g.ui) setTimeout(() => g.jefe === b && g.ui.aviso('¡Dispara al Rey Bomba! (X)'), 1200);
    }
    if (g.ui) g.ui.jefe(b);
    return b;
  };

  const guardar = (g, b) => { g.w.arena.progreso = { aciertos: b.aciertos, furia: b.furia, pIdx: b.pIdx }; };
  /** Fase actual (objeto de seg.fases) o null. Cada acierto rompe una fase. */
  const faseObj = (b) => (b.fases ? b.fases[Math.min(b.aciertos, b.fases.length - 1)] : null);
  const furia = (b) => { const f = faseObj(b); return 1 + 0.2 * b.furia + (f && f.dificultad ? 0.18 * (f.dificultad - 1) : 0) + (b.skin === 'foton' ? 0.45 : 0); };
  /** Pregunta para la fase actual: las de fases[i].preguntas (más difíciles en fases avanzadas). */
  Jefe.siguientePregunta = function (b) {
    const f = faseObj(b), lista = f && f.preguntas && f.preguntas.length ? f.preguntas : b.preguntas, q = lista[b.pIdx % lista.length];
    b.pIdx++; return q;
  };
  /** Lista de ataques de la fase (campo patron: "bola+onda+lluvia") o null para usar la de por defecto. */
  const patronFase = (b) => { const f = faseObj(b); return f && typeof f.patron === 'string' ? f.patron.split(/[+,]/).map((q) => q.trim()).filter(Boolean) : null; };
  const mirar = (b, p) => { b.dir = p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1; };
  const fase = (b) => Math.min(2, Math.floor((b.aciertos * 3) / b.vidasMax));

  function estado(b, e, t) { b.estado = e; b.t = t || 0; }
  function ponerAltura(b, h) { b.y += b.h - h; b.h = h; }

  // ---------- proyectiles ----------
  function bola(g, b, x, y, vx, vy, grav) { g.proy.push({ tipo: 'bola', x, y, vx, vy, grav: grav || 0, t: 0, col: b.kind === 'dragon' ? 'azul' : null }); J.Audio.sfx('fuego'); }
  function ondas(g, b) {
    const y = b.floorY, cx = b.x + b.w / 2, v = (b.kind === 'pulpo' ? 5 : 6.5) + furia(b), tent = b.kind === 'pulpo';
    g.proy.push({ tipo: 'onda', x: cx - 1, y, vx: -v, vida: 4, t: 0, tent }, { tipo: 'onda', x: cx + 1, y, vx: v, vida: 4, t: 0, tent });
    g.shake = 7; J.Audio.sfx('onda');
    J.chispas(g, cx * J.T, y * J.T, 14, '#ffd166', 4);
  }
  function programar(b, dt, fn) { b.prog.push({ t: b.reloj + dt, fn }); }

  // ---------- IA ----------
  function elegirAtaque(g, b) {
    const p = g.jugador;
    mirar(b, p);
    const pat = patronFase(b);
    if (b.kind === 'pulpo') { const l = pat || PULPO; estado(b, 'aviso_' + l[b.ciclo++ % l.length]); return; }
    if (b.kind === 'dragon') { const l = pat || (b.skin ? SKIN_ATAQUES[b.skin] : DRAGON); estado(b, 'aviso_' + l[b.ciclo++ % l.length]); return; }
    if (b.kind === 'calavera') {   // 4 ataques y se cansa: aturdido -> pisotón -> pregunta
      if (b.ronda >= 4) { b.ronda = 0; ponerAltura(b, b.hAt); estado(b, 'aturdido'); J.Audio.sfx('fallo'); J.chispas(g, (b.x + b.w / 2) * J.T, (b.y + 1) * J.T, 16, '#e8f0ff', 2, -3); return; }
      b.ronda++; const l = pat || CAL; estado(b, 'aviso_' + l[b.ciclo++ % l.length]); return;
    }
    if (b.kind === 'bomba') { const l = pat || BOMBA; estado(b, 'aviso_' + l[b.ciclo++ % l.length]); return; }
    if (!b.rey) { const l = pat || GOLEM, a = l[b.ciclo++ % l.length]; estado(b, a === 'carga' ? 'aviso_carga' : 'aviso_salto'); return; }
    const lim = 3 + (fase(b) > 0 ? 1 : 0);
    if (b.ronda >= lim && b.quiz) { b.ronda = 0; estado(b, 'espera', -1.2); return; }   // en modo quiz no hay aturdimiento: descansa un poco
    if (b.ronda >= lim) { b.ronda = 0; ponerAltura(b, b.hAt); estado(b, 'aturdido'); J.Audio.sfx('fallo'); J.chispas(g, (b.x + b.w / 2) * J.T, (b.y + 1) * J.T, 16, '#cfd8f0', 2, -3); return; }
    const lista = pat || REY[fase(b)], a = lista[b.ciclo++ % lista.length];
    b.ronda++;
    estado(b, 'aviso_' + a);
  }

  Jefe.update = function (g, dt) {
    const b = g.jefe, p = g.jugador, F = g.F, w = g.w;
    if (!b) return;
    b.t += dt; b.anim += dt; b.reloj += dt; b.flash = Math.max(0, b.flash - dt); b.cdPreg = Math.max(0, b.cdPreg - dt); b.escudoFlash = Math.max(0, b.escudoFlash - dt);
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
        } else if (b.disp) {   // el Rey Bomba camina hacia el jugador
          const dx = p.x + p.w / 2 - cx;
          b.vx = Math.abs(dx) > 4 ? Math.sign(dx) * (1.7 + 0.25 * b.furia) : 0;
        } else if (b.flota) {   // pulpo/dragón: flotan hacia el jugador sin llegar a embestir
          const dx = p.x + p.w / 2 - cx;
          b.vx = Math.abs(dx) > 3 ? Math.sign(dx) * (b.kind === 'dragon' ? 2.2 : 1.6) : 0;
        } else b.vx = 0;
        if (b.t > (b.rey ? 1.4 : b.disp ? 0.9 : 1.1) / f) { b.vx = 0; elegirAtaque(g, b); }
        break;
      }
      case 'aviso_carga': case 'aviso_chorro': case 'aviso_embestida':
        b.vx = 0; if (b.t > 0.85 / f) { estado(b, 'carga'); b.vx = b.dir * ((b.kind === 'dragon' ? (b.skin === 'foton' ? 13 : 9) : b.kind === 'pulpo' ? 8 : 7.5) + f); J.Audio.sfx('fuego'); }
        break;
      case 'aviso_tinta':
        b.vx = 0; if (b.t > 0.6 / f) {
          for (let i = -1; i <= 1; i++) g.proy.push({ tipo: 'tinta', x: cx + b.dir * 1.2, y: b.y + b.h * 0.6, vx: b.dir * (4.2 + f), vy: i * 1.6, r: 0.85, vida: 4.5, t: 0 });
          J.Audio.sfx('onda'); J.chispas(g, cx * J.T, (b.y + b.h * 0.6) * J.T, 14, '#4a1a7a', 3, 0);
          estado(b, 'espera', 0.5);
        }
        break;
      case 'aviso_tentaculos':
        b.vx = 0; if (b.t > 0.7 / f) { ondas(g, b); estado(b, 'espera', 0.5); }
        break;
      case 'aviso_rayo':
        b.vx = 0; b.yObj = b.yBase - 3.8;      // el dragón sube a las nubes y desde allí lanza rayos
        if (b.t > 1.0 / f) {
          const px = p.x + p.w / 2;
          [0, -3.4, 3.4].forEach((o, i) => g.proy.push({ tipo: 'rayo', x: J.clamp(px + o, b.xmin + 0.5, b.xmax - 0.5), aviso: 0.75 + i * 0.1, t: 0, y: b.floorY }));
          J.Audio.sfx('aviso'); estado(b, 'espera', -0.6);
        }
        break;
      case 'aviso_bombardeo':   // el bombardero sube y se prepara para cruzar la arena soltando cargas
        b.vx = 0; b.yObj = b.yBase - 3.6;
        if (b.t > 0.9 / f) { b.pases = 0; b.tBomba = 0; b.vx = b.dir * (7.5 + f); estado(b, 'bombardeo'); J.Audio.sfx('onda'); }
        break;
      case 'bombardeo':         // dos pasadas: cada ~0.4 s suelta una carga que cae por gravedad
        b.yObj = b.yBase - 3.6; b.tBomba -= dt;
        if (b.tBomba <= 0) { b.tBomba = 0.42 / f; g.proy.push({ tipo: 'bola', x: cx, y: b.y + b.h, vx: 0, vy: 1.5, grav: 15, t: 0, col: null }); J.Audio.sfx('aviso'); }
        break;
      case 'aviso_lanzar': {   // lanza 2-3 bombas en arco hacia el jugador (mecha 2 s): se pueden DISPARAR para detonarlas lejos... o contra el rey
        b.vx = 0; if (b.t > 0.6 / f) {
          const n = 2 + (b.aciertos > 0 ? 1 : 0) + (b.aciertos > 1 ? 1 : 0), x0 = cx + b.dir * 0.8, y0 = b.y + 0.2;
          for (let i = 0; i < n; i++) programar(b, i * 0.32, () => {
            if (g.jefe !== b || b.estado === 'pregunta' || b.estado === 'aturdido') return;
            const T = 1.0 + 0.1 * i, xt = J.clamp(g.jugador.x + g.jugador.w / 2 + (i - (n - 1) / 2) * 2.3 + (Math.random() - 0.5), b.xmin + 0.8, b.xmax - 0.8), yt = b.floorY - 0.4;
            g.proy.push({ tipo: 'bomba', x: x0, y: y0, vx: (xt - x0) / T, vy: (yt - y0 - 0.5 * 17 * T * T) / T, grav: 17, fuse: 2.0, t: 0, rad: 2.3 });
            J.Audio.sfx('aviso');
          });
          estado(b, 'espera', 0.1 - 0.2 / f);
        }
        break;
      }
      case 'aviso_huesos': {   // oleada de huesos que recorren el suelo: salta los bajos y los altos
        b.vx = 0; if (b.t > 0.7 / f) {
          const dir = b.dir, x0 = dir < 0 ? b.xmax - 0.5 : b.xmin + 0.5, hs = [1.0, 1.0, 1.7, 1.0, 1.7];
          hs.forEach((h, i) => programar(b, (i * 0.62) / f, () => { if (g.jefe !== b || b.estado === 'pregunta' || b.estado === 'aturdido') return; g.proy.push({ tipo: 'hueso', x: dir < 0 ? b.xmax - 0.3 : b.xmin + 0.3, y: b.floorY, vx: -dir * (5.2 + f), h, t: 0 }); J.Audio.sfx('aviso'); }));
          estado(b, 'espera', 0.2 - 3.0 / f);
        }
        break;
      }
      case 'aviso_blink':   // se teletransporta al otro lado
        b.vx = 0; if (b.t > 0.45 / f) {
          J.chispas(g, (b.x + b.w / 2) * J.T, (b.y + b.h / 2) * J.T, 16, '#e8f0ff', 3);
          const lado = (p.x + p.w / 2) < (b.xmin + b.xmax) / 2 ? 1 : -1; b.x = lado > 0 ? b.xmax - b.w - 1.5 : b.xmin + 1.5; b.dir = -lado; b.flash = 0.2;
          J.chispas(g, (b.x + b.w / 2) * J.T, (b.y + b.h / 2) * J.T, 16, '#e8f0ff', 3); J.Audio.sfx('aviso');
          estado(b, 'espera', 0.4);
        }
        break;
      case 'aviso_rayos':   // calaveras láser: uno bajo (salta) y/o uno alto (agáchate: quédate en el suelo)
        b.vx = 0; if (b.t > 0.5 / f) {
          const alto = b.floorY - 2.0, bajo = b.floorY - 0.45, orden = Math.random() < 0.5 ? [bajo, alto] : [alto, bajo];
          orden.forEach((y, i) => g.proy.push({ tipo: 'haz', y, x0: b.xmin, x1: b.xmax, aviso: 0.85 + i * 0.7, t: 0, dur: 0.45, h: 0.8, lado: i % 2 ? 1 : -1 }));
          J.Audio.sfx('aviso'); estado(b, 'espera', 0.1 - 2.2 / f);
        }
        break;
      case 'aviso_rodar':
        b.vx = 0; if (b.t > 0.8 / f) { estado(b, 'carga'); b.vx = b.dir * (7.5 + f); J.Audio.sfx('fuego'); }
        break;
      case 'aviso_mecha':   // la mecha arde: nova de explosión alrededor del rey (se esquiva saltando o alejándose)
        b.vx = 0; if (b.t > 1.0 / f) {
          g.proy.push({ tipo: 'nova', x: cx, y: b.y + b.h / 2, rad: 4.3, t: 0, dur: 0.45, hecho: false });
          g.shake = 8; J.Audio.sfx('onda'); estado(b, 'espera', 0.2 - 0.5 / f);
        }
        break;
      case 'aviso_rafaga':
        b.vx = 0; b.yObj = b.yBase - 0.8;
        if (b.t > 0.55 / f) {
          [0, 0.4, 0.8].forEach((dt2, i) => programar(b, dt2 / f, () => {
            if (g.jefe !== b || b.estado === 'pregunta') return;
            bola(g, b, b.x + b.w / 2 + b.dir * 1.6, b.floorY - (i === 1 ? 1.9 : 0.55), b.dir * (6.5 + f), 0);
          }));
          estado(b, 'espera', 0.2 - 0.6 / f);
        }
        break;
      case 'carga':
        if (Math.random() < 0.5) J.chispas(g, cx * J.T - b.dir * 14, b.floorY * J.T, 1, '#cfd8f0', 1.5, 2);
        break;
      case 'choque':
        if (b.t > 0.5) { if (b.quiz || b.disp) estado(b, 'espera', 0); else estado(b, 'aturdido'); }
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
        if (b.t > dur) { ponerAltura(b, b.hNormal); estado(b, 'espera'); b.ronda = 0; if (b.disp) b.coraza = Math.ceil(b.corazaMax * 0.6); }
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
      if (pared && b.estado === 'bombardeo') { b.pases++; g.shake = Math.max(g.shake, 3); if (b.pases >= 2) { b.vx = 0; estado(b, 'espera', 0.2); } else { b.dir = -b.dir; b.vx = b.dir * (7.5 + f); } }
      if (b.flota) {   // flotan: suavizado hacia su altura objetivo + vaivén
        if (!['aviso_rayo', 'aviso_bombardeo', 'bombardeo'].includes(b.estado)) b.yObj = b.yBase;
        const meta = b.estado === 'entra' ? b.yBase : b.yObj + Math.sin(b.anim * 1.7) * 0.35;
        b.y += (meta - b.y) * Math.min(1, dt * (b.estado === 'entra' ? 3 : 6));
        if (b.estado === 'entra' && b.t > 1.2) { estado(b, 'espera'); g.shake = 5; J.Audio.sfx('onda'); }
      }
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
    const encima = p.vy > 0.3 && p.y + p.h - b.y < 0.9;
    if (b.quiz) {   // jefe blindado: el pisotón solo cuenta tras acertar una pregunta
      if (b.estado === 'golpeado') return;
      if (encima && b.cdPreg <= 0) {
        p.vy = -F.v0 * 0.5; p.suelo = false; p.coyote = 0; p.saltando = false;
        J.Audio.sfx('pisoton'); b.escudoFlash = 0.3; b.estado = 'pregunta'; b.t = 0; b.prog.length = 0;
        g.preguntar(b);
      } else if (encima) { p.vy = -F.v0 * 0.7; p.suelo = false; p.coyote = 0; p.saltando = false; J.Audio.sfx('pisoton'); }
      else J.herir(g, b.x + b.w / 2);
      return;
    }
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
    const p = g.jugador, F = g.F;
    if (b.quiz) {
      b.cdPreg = 1.6;
      if (ok) {   // pisotón efectivo: −1 vida del jefe, rebote y el jefe se aturde un instante
        b.aciertos++; b.flash = 0.8; J.Audio.sfx('acierto'); guardar(g, b);
        J.chispas(g, (b.x + b.w / 2) * J.T, (b.y + b.h / 2) * J.T, 24, '#2ee59d', 5);
        p.vy = -F.v0 * 0.95; p.vx = (p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1) * 3.5; p.suelo = false; p.saltando = false;
        if (b.aciertos >= b.vidasMax) derrotar(g, b);
        else { estado(b, 'golpeado'); b.vx = 0; b.ronda = 0; if (g.ui) g.ui.aviso(b.fases ? `¡Fase ${b.aciertos} rota! Fase ${b.aciertos + 1}/${b.vidasMax}` : `¡Pisotón! ${b.vidasMax - b.aciertos} restantes`); }
      } else {    // el escudo destella, contraataque y pierdes 1 corazón
        b.furia++; b.escudoFlash = 0.9; J.Audio.sfx('fallo'); guardar(g, b);
        g.shake = 6; if (g.ui) g.ui.aviso('¡El escudo resiste!');
        J.herir(g, b.x + b.w / 2, true);
        const cx = b.x + b.w / 2; mirar(b, p);
        estado(b, { golem: 'aviso_onda', rey: 'aviso_lluvia', pulpo: 'aviso_tinta', dragon: 'aviso_rayo' }[b.kind], 0.35);
      }
      if (g.ui) g.ui.jefe(b);
      return;
    }
    if (ok) {
      b.aciertos++; b.flash = 0.8; J.Audio.sfx('acierto'); if (b.disp) { b.corazaMax = 8 + 2 * b.aciertos; b.coraza = b.corazaMax; }
      J.chispas(g, (b.x + b.w / 2) * J.T, (b.y + b.h / 2) * J.T, 22, '#2ee59d', 5);
      guardar(g, b);
      if (b.aciertos >= b.vidasMax) derrotar(g, b);
      else {
        ponerAltura(b, b.hNormal); estado(b, 'golpeado'); b.vx = 0; b.ronda = 0; b.ciclo = 0;
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
    b.estado = 'vencido'; b.t = 0; b.aciertos = b.vidasMax; b.vx = 0;
    A.derrotado = true; A.activa = false; w.bloqueos.forEach((k) => (k.activo = false));
    if (w.meta) w.meta.bloqueada = false;
    g.jefeDerrotado = true; guardar(g, b);
    J.Audio.sfx('victoria'); g.shake = 10;
    if (g.ui) { g.ui.aviso(b.rey ? '¡Rey Entropía derrotado!' : b.disp ? '¡Rey Bomba derrotado!' : b.quiz ? '¡' + b.nombre + ' derrotado!' : '¡Ejercicio resuelto!'); g.ui.jefe(b); }
    if (A.fort && !b.quiz) g.victoriaEn = 2.8;
  }

  /** Daño de un disparo del jugador. Devuelve true si lo absorbe el jefe o una bomba. */
  const DANO = { fuego: 1, perdigon: 0.35, foton: 1 };
  Jefe.danar = function (g, d) {
    const b = g.jefe; if (!b || !b.disp || ['entra', 'vencido', 'cayendo', 'pregunta', 'golpeado', 'aturdido'].includes(b.estado)) return false;
    b.coraza -= d; b.flash = 0.15; J.Audio.sfx('pisoton');
    J.chispas(g, (b.x + b.w / 2) * J.T, (b.y + b.h / 2) * J.T, 8, '#ffd166', 4);
    if (b.coraza <= 0) {   // coraza rota: se apaga la mecha y queda aturdido -> píscalo y responde
      b.coraza = 0; b.prog.length = 0; b.vx = 0; b.ronda = 0; ponerAltura(b, b.hAt); estado(b, 'aturdido');
      J.Audio.sfx('fallo'); g.shake = 7; if (g.ui) g.ui.aviso('¡Coraza rota! ¡Písalo!');
      J.chispas(g, (b.x + b.w / 2) * J.T, (b.y + 1) * J.T, 22, '#cfd8f0', 4, -3);
    }
    return true;
  };
  Jefe.recibirDisparo = function (g, x, y, por) {
    for (const q of g.proy) if (q.tipo === 'bomba' && !q.muerto && Math.hypot(x - q.x, y - q.y) < 0.75) { q.fuse = 0; q.disparada = true; return true; }   // detona la bomba en el aire
    const b = g.jefe; if (!b || !b.disp) return false;
    if (x < b.x - 0.15 || x > b.x + b.w + 0.15 || y < b.y - 0.15 || y > b.y + b.h + 0.15) return false;
    Jefe.danar(g, DANO[por] != null ? DANO[por] : 1);
    return true;
  };

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
    if (b.kind === 'calavera') dibujarCalavera(ctx, b, px + tiembla, py, wpx, hpx, t, blanco);
    else if (b.kind === 'bomba') dibujarBomba(ctx, b, px + tiembla, py, wpx, hpx, t, blanco);
    else if (b.kind === 'rey') dibujarRey(ctx, b, px + tiembla, py, wpx, hpx, t, blanco);
    else if (b.kind === 'pulpo') dibujarPulpo(ctx, b, px + tiembla, py, wpx, hpx, t, blanco);
    else if (b.kind === 'dragon' && b.skin) ({ isotopo: dibujarIsotopo, foton: dibujarFoton, bombardero: dibujarBombardero }[b.skin])(ctx, b, px + tiembla, py, wpx, hpx, t, blanco);
    else if (b.kind === 'dragon') dibujarDragon(ctx, b, px + tiembla, py, wpx, hpx, t, blanco);
    else dibujarGolem(ctx, b, px + tiembla, py, wpx, hpx, t, blanco);
    ctx.restore();
    if (b.disp && b.estado !== 'vencido' && b.estado !== 'aturdido' && b.estado !== 'pregunta') {   // barra de coraza
      const bw = 36, bx = px + wpx / 2 - bw / 2, by = py - 9;
      ctx.fillStyle = OUT; ctx.fillRect(bx - 1, by - 1, bw + 2, 5); ctx.fillStyle = '#39456e'; ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = b.coraza / b.corazaMax > 0.4 ? '#ffd166' : '#ff4d6d'; ctx.fillRect(bx, by, Math.round(bw * b.coraza / b.corazaMax), 3);
    }
    if (b.quiz && b.estado !== 'vencido') dibujarEscudo(ctx, b, px, py, wpx, hpx, t);
    if (b.estado === 'aturdido' || b.estado === 'pregunta') {   // estrellitas mareadas
      for (let i = 0; i < 4; i++) {
        const a = t * 4 + (i * Math.PI) / 2;
        ctx.fillStyle = '#ffd166'; ctx.fillRect(Math.round(px + wpx / 2 + Math.cos(a) * 16 - 1), Math.round(py - 6 + Math.sin(a) * 4), 3, 3);
        ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(px + wpx / 2 + Math.cos(a) * 16), Math.round(py - 5 + Math.sin(a) * 4), 1, 1);
      }
      if (b.estado === 'aturdido' && Math.floor(t * 3) % 2 === 0) txt(ctx, '▼', px + wpx / 2 - 4, py - 12 + Math.round(Math.sin(t * 8) * 2), '#ffd166');
    }
  };

  /** Escudo hexagonal del jefe blindado: cian en calma, blanco/rojo cuando una respuesta falla. Con «?» encima. */
  function dibujarEscudo(ctx, b, x, y, w, h, t) {
    const cx = x + w / 2, cy = y + h / 2, rx = w / 2 + 7, ry = h / 2 + 6, f = b.escudoFlash > 0;
    const col = f ? (Math.floor(t * 20) % 2 ? '#ffffff' : '#ff4d6d') : 'rgba(111,240,255,' + (0.5 + 0.2 * Math.sin(t * 3)) + ')';
    const pts = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    ctx.globalAlpha = f ? 0.22 : 0.07; J.Temas.poli(ctx, pts, f ? '#ff4d6d' : '#6ff0ff'); ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) { const a = pts[i], c = pts[(i + 1) % 6]; J.Temas.linea(ctx, a[0], a[1], c[0], c[1], col, 1); }
    if (!f) { ctx.fillStyle = 'rgba(255,255,255,.55)'; const k = Math.floor(t * 3) % 6, a = pts[k]; ctx.fillRect(Math.round(a[0]) - 1, Math.round(a[1]) - 1, 3, 3); }
    if (b.estado !== 'entra' && b.estado !== 'pregunta') {
      ctx.font = '8px PixelHUD, monospace'; ctx.fillStyle = '#0b1230'; ctx.fillText('?', Math.round(cx) - 3, Math.round(y - 5 + Math.sin(t * 5) * 2) + 1);
      ctx.fillStyle = '#ffe27a'; ctx.fillText('?', Math.round(cx) - 4, Math.round(y - 6 + Math.sin(t * 5) * 2));
    }
  }

  /** Pulpo Ácido: cúpula violeta con manchas de ácido, ojos amarillos y 8 tentáculos que ondulan. */
  function dibujarPulpo(ctx, b, x, y, w, h, t, blanco) {
    const D = J.Temas.disco, cx = x + w / 2, ink = b.estado === 'aviso_tinta';
    const cuerpo = blanco ? '#ffffff' : b.furia > 1 ? '#b0289a' : '#7a2bd6', claro = blanco ? '#fff' : '#a56bff', osc = '#4a1a8a';
    const sq = ink ? 1.12 : 1 + Math.sin(t * 3) * 0.04;
    // tentáculos
    for (let k = 0; k < 8; k++) {
      const bx = x + 5 + k * ((w - 10) / 7);
      for (let j = 0; j < 11; j++) {
        const o = Math.sin(t * 2.4 + k * 0.8 + j * 0.55) * (1.5 + j * 0.45) * (b.estado === 'carga' ? 0.3 : 1);
        const tx = Math.round(bx + o), ty = Math.round(y + h * 0.55 + j * 2.4);
        ctx.fillStyle = OUT; ctx.fillRect(tx - 2, ty - 1, 5, 4);
        ctx.fillStyle = j > 8 ? '#9dff3a' : j % 3 === 0 ? claro : cuerpo; ctx.fillRect(tx - 1, ty, 3, 3);
      }
    }
    // cúpula
    const dy = y + h * 0.34;
    D(ctx, cx, dy, Math.round(16 * sq), OUT); D(ctx, cx, dy, Math.round(15 * sq), cuerpo);
    D(ctx, cx - 5, dy - 6, 6, claro); D(ctx, cx + 6, dy + 2, 4, osc);
    [[-8, 3, 2], [9, -3, 2], [2, -9, 2], [-2, 6, 1], [12, 5, 1]].forEach(([ox, oy, r]) => D(ctx, cx + ox, dy + oy, r, '#9dff3a'));
    // ojos: dos elipses amarillas con pupila vertical
    const mira = b.dir < 0 ? -1 : 1;
    [-6, 6].forEach((ox) => { ctx.fillStyle = OUT; ctx.fillRect(cx + ox - 4, dy + 1, 8, 8); ctx.fillStyle = b.estado === 'pregunta' ? '#fff' : '#ffe27a'; ctx.fillRect(cx + ox - 3, dy + 2, 6, 6); ctx.fillStyle = OUT; ctx.fillRect(cx + ox - 1 + mira, dy + 2, 2, 6); });
    ctx.fillStyle = OUT; ctx.fillRect(cx - 3, dy + 12, 6, 2);
    if (Math.floor(t * 2) % 3 === 0) { ctx.fillStyle = '#9dff3a'; ctx.fillRect(Math.round(cx + 10), Math.round(y + h * 0.5 + (t * 20) % 8), 1, 2); }   // goteo ácido
  }

  /** Dragón de Tormenta: cuerpo de nubes con venas de rayo, alas que baten y cola de chispas. Mira a la izquierda; se espeja. */
  // ---------- jefes de física moderna (diseños propios) ----------
  /** Isótopo Inestable: núcleo radiactivo con cara. Cada acierto pierde la mitad de sus nucleones (semivida): 12 → 6 → 3. */
  function dibujarIsotopo(ctx, b, x, y, w, h, t, bl) {
    const D = J.Temas.disco, r = Math.round, cx = r(x + w / 2), cy = r(y + h / 2 + Math.sin(t * 3) * 2), R = Math.round(Math.min(w, h) * 0.3);
    for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i / 3) % 1; ctx.strokeStyle = 'rgba(125,255,74,' + (0.55 * (1 - k)) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R + 4 + k * 18, 0, Math.PI * 2); ctx.stroke(); }
    const n = [12, 6, 3, 2][Math.min(3, b.aciertos)];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * (1.2 + (i % 2) * 0.6), rr = R + 7 + (i % 3) * 3, px = cx + Math.cos(a) * rr * 1.05, py = cy + Math.sin(a) * rr * 0.8;
      D(ctx, r(px), r(py), 5, OUT); D(ctx, r(px), r(py), 4, i % 2 ? '#ff5a5a' : '#8aa0d0'); D(ctx, r(px) - 1, r(py) - 1, 1, '#fff');
    }
    D(ctx, cx, cy, R + 2, OUT); D(ctx, cx, cy, R, bl ? '#ffffff' : '#7dff4a'); D(ctx, cx - Math.round(R * 0.3), cy - Math.round(R * 0.3), Math.round(R * 0.35), '#c9ff9a');
    const enojado = b.furia > 0 || String(b.estado).startsWith('aviso') || b.estado === 'carga';
    ctx.fillStyle = OUT; ctx.fillRect(cx - 7, cy - 4, 5, 6); ctx.fillRect(cx + 2, cy - 4, 5, 6);
    ctx.fillStyle = b.estado === 'pregunta' ? '#fff' : enojado ? '#ff4d6d' : '#ffe27a'; ctx.fillRect(cx - 6, cy - 2, 3, 3); ctx.fillRect(cx + 3, cy - 2, 3, 3);
    ctx.fillStyle = OUT; ctx.fillRect(cx - 6, cy + 4, 12, 4); ctx.fillStyle = '#fff'; ctx.fillRect(cx - 5, cy + 4, 2, 2); ctx.fillRect(cx - 1, cy + 4, 2, 2); ctx.fillRect(cx + 3, cy + 4, 2, 2);
  }
  /** Fotón Veloz: orbe de luz con rayos y cola de onda; deja estelas al embestir. */
  function dibujarFoton(ctx, b, x, y, w, h, t, bl) {
    const D = J.Temas.disco, r = Math.round, cx = r(x + w / 2), cy = r(y + h / 2), dash = b.estado === 'carga' || b.estado === 'aviso_embestida';
    if (b.estado === 'carga') for (let i = 3; i >= 1; i--) { ctx.globalAlpha = 0.14 * (4 - i); D(ctx, cx - b.dir * i * 11, cy, 10, '#9fe9ff'); }
    ctx.globalAlpha = 1;
    for (let i = 1; i < 11; i++) { const px = cx - b.dir * (11 + i * 4), py = cy + Math.sin(t * 14 - i * 0.9) * (2 + i * 0.4); ctx.fillStyle = 'rgba(255,226,122,' + (1 - i / 12) + ')'; ctx.fillRect(r(px), r(py), 3, 2); }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + t * (dash ? 9 : 3), r1 = 11, r2 = (i % 2 ? 17 : 22) + (dash ? 4 : 0);
      ctx.strokeStyle = i % 2 ? '#ffe27a' : '#6ff0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
    }
    D(ctx, cx, cy, 12, OUT); D(ctx, cx, cy, 10, bl ? '#ffffff' : '#fff6c8'); D(ctx, cx, cy, 7, '#ffe27a');
    ctx.fillStyle = OUT; ctx.fillRect(cx - 9, cy - 3, 18, 6);
    ctx.fillStyle = b.estado === 'pregunta' ? '#fff' : dash ? '#ff4d6d' : '#6ff0ff'; ctx.fillRect(cx - 7, cy - 2, 5, 3); ctx.fillRect(cx + 2, cy - 2, 5, 3);
  }
  /** Bombardero Neutrón: reactor volador. Cruza la arena soltando cargas que caen por gravedad; solo se le pisa cuando baja. */
  function dibujarBombardero(ctx, b, x, y, w, h, t, bl) {
    const r = Math.round, D = J.Temas.disco, P = J.Temas.poli, cx = r(x + w / 2), cy = r(y + h / 2);
    ctx.save();
    if (b.dir > 0) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }   // dibujado mirando a la izquierda
    const casco = bl ? '#ffffff' : '#6b7da8', claro = bl ? '#ffffff' : '#a9bbe6', osc = '#39456e', bombardeando = b.estado === 'bombardeo' || b.estado === 'aviso_bombardeo';
    const fl = 5 + Math.sin(t * 40) * 2;
    P(ctx, [[cx + w * 0.44, cy - 3], [cx + w * 0.44 + fl + 5, cy + 1], [cx + w * 0.44, cy + 4]], '#ff7a2a'); P(ctx, [[cx + w * 0.44, cy - 1], [cx + w * 0.44 + fl, cy + 1], [cx + w * 0.44, cy + 3]], '#ffe27a');
    P(ctx, [[cx - w / 2 - 1, cy + 1], [cx - w * 0.26, cy - 8], [cx + w * 0.4, cy - 8], [cx + w * 0.48, cy - 3], [cx + w * 0.48, cy + 6], [cx - w * 0.2, cy + 8]], OUT);
    P(ctx, [[cx - w / 2, cy + 1], [cx - w * 0.25, cy - 7], [cx + w * 0.39, cy - 7], [cx + w * 0.46, cy - 3], [cx + w * 0.46, cy + 5], [cx - w * 0.2, cy + 7]], casco);
    P(ctx, [[cx - w * 0.2, cy - 6], [cx + w * 0.38, cy - 6], [cx + w * 0.44, cy - 3], [cx - w * 0.1, cy - 3]], claro);
    P(ctx, [[cx + w * 0.05, cy + 3], [cx + w * 0.34, cy + 3], [cx + w * 0.22, cy + 14], [cx - w * 0.1, cy + 12]], OUT); P(ctx, [[cx + w * 0.07, cy + 3], [cx + w * 0.32, cy + 3], [cx + w * 0.21, cy + 12], [cx - w * 0.06, cy + 11]], osc);   // ala delta
    P(ctx, [[cx + w * 0.3, cy - 7], [cx + w * 0.44, cy - 15], [cx + w * 0.47, cy - 7]], OUT); P(ctx, [[cx + w * 0.33, cy - 7], [cx + w * 0.44, cy - 13], [cx + w * 0.45, cy - 7]], osc);   // aleta de cola
    D(ctx, cx - w * 0.18, cy - 3, 4, OUT); D(ctx, cx - w * 0.18, cy - 3, 3, b.estado === 'pregunta' ? '#fff' : (b.furia > 0 || bombardeando) ? '#ff4d6d' : '#6ff0ff');   // cabina
    ctx.fillStyle = '#ff4d6d'; ctx.fillRect(r(cx - w / 2), cy - 1, 5, 3);                                                                                                       // morro
    ctx.fillStyle = OUT; ctx.fillRect(r(cx - 2), cy + 5, 12, bombardeando ? 5 : 2);   // compuerta de carga
    if (bombardeando) { D(ctx, r(cx + 4), cy + 8, 3, '#222a4a'); ctx.fillStyle = '#ffe27a'; ctx.fillRect(r(cx + 4), cy + 3, 1, 2); }
    ctx.restore();
  }

  function dibujarDragon(ctx, b, x, y, w, h, t, blanco) {
    const D = J.Temas.disco, cx = x + w / 2;
    ctx.save();
    if (b.dir > 0) { ctx.translate(Math.round(cx), 0); ctx.scale(-1, 1); ctx.translate(-Math.round(cx), 0); }
    const nube = blanco ? '#ffffff' : '#eef0ff', sombra = '#aab2e8', oscuro = '#6f78c2', flap = Math.sin(t * 7);
    const cargando = b.estado === 'carga' || b.estado === 'aviso_embestida';
    // cola (nubes decrecientes + chispas)
    for (let i = 0; i < 4; i++) { const r = 7 - i * 1.3; D(ctx, cx + 14 + i * 7, y + 18 + Math.sin(t * 4 + i) * 3, Math.round(r), OUT); D(ctx, cx + 14 + i * 7, y + 18 + Math.sin(t * 4 + i) * 3, Math.round(r - 1), i % 2 ? sombra : nube); }
    if (Math.floor(t * 12) % 2) { ctx.fillStyle = '#ffe27a'; ctx.fillRect(Math.round(cx + 40), Math.round(y + 14 + Math.sin(t * 4 + 3) * 3), 2, 2); }
    // ala trasera y delantera
    [[-2, 7], [10, 4]].forEach(([ox, oy], i) => { const ay = y + oy - flap * (4 + i); D(ctx, cx + ox, ay, 10, OUT); D(ctx, cx + ox, ay, 9, i ? nube : sombra); D(ctx, cx + ox - 3, ay - 2, 5, nube); });
    // cuerpo
    D(ctx, cx, y + 19, 12, OUT); D(ctx, cx, y + 19, 11, nube); D(ctx, cx + 3, y + 23, 8, sombra); D(ctx, cx - 7, y + 17, 7, nube);
    ctx.fillStyle = oscuro; ctx.fillRect(Math.round(cx - 8), Math.round(y + 25), 22, 2);
    // venas de rayo en el vientre
    ctx.fillStyle = '#ffe27a';
    for (let i = 0; i < 5; i++) { const zx = cx - 6 + i * 4 + (i % 2) * 2, zy = y + 18 + (i % 2) * 3; ctx.fillRect(Math.round(zx), Math.round(zy), 2, 2); ctx.fillRect(Math.round(zx + 2), Math.round(zy + 2), 2, 2); }
    // cabeza (a la izquierda), cuerno, ojo
    const hx = cx - 20, hy = y + 11 + (cargando ? 3 : 0);
    D(ctx, hx, hy, 8, OUT); D(ctx, hx, hy, 7, nube); ctx.fillStyle = OUT; ctx.fillRect(Math.round(hx - 12), Math.round(hy), 8, 6); ctx.fillStyle = nube; ctx.fillRect(Math.round(hx - 11), Math.round(hy + 1), 7, 4);
    ctx.fillStyle = '#ffe27a'; J.Temas.poli(ctx, [[hx - 2, hy - 6], [hx + 3, hy - 14], [hx + 4, hy - 5]], '#ffe27a');
    ctx.fillStyle = b.estado === 'pregunta' ? '#fff' : cargando || b.furia > 1 ? '#ff4d6d' : '#6ff0ff'; ctx.fillRect(Math.round(hx - 3), Math.round(hy - 2), 3, 3);
    ctx.fillStyle = OUT; ctx.fillRect(Math.round(hx - 11), Math.round(hy + 4), 6, 1);
    if (cargando) { ctx.fillStyle = '#6ff0ff'; ctx.fillRect(Math.round(hx - 16), Math.round(hy + 1), 4, 2); }
    ctx.restore();
  }

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

  /** Rey Bomba (diseño propio): bomba redonda con corona dorada y mecha encendida. */
  function dibujarBomba(ctx, b, x, y, w, h, t, bl) {
    const D = J.Temas.disco, r = Math.round, cx = r(x + w / 2), aturdido = b.estado === 'aturdido' || b.estado === 'pregunta', mecha = b.estado === 'aviso_mecha';
    const cuerpo = bl ? '#ffffff' : mecha && Math.floor(t * 14) % 2 ? '#7a1020' : '#232a48', brillo = bl ? '#fff' : '#3a4470';
    const cy = r(y + h * 0.55) + (aturdido ? 4 : r(Math.sin(t * 6) * (b.estado === 'carga' ? 0 : 1))), R = r(w / 2 - 1);
    // patas
    if (!aturdido) { const pa = b.estado === 'carga' ? Math.floor(t * 16) % 2 * 3 : 0; ctx.fillStyle = OUT; ctx.fillRect(cx - 15, y + h - 7 + pa, 11, 7); ctx.fillRect(cx + 4, y + h - 7 + (3 - pa) % 4, 11, 7); ctx.fillStyle = '#e07a2a'; ctx.fillRect(cx - 14, y + h - 6 + pa, 9, 5); ctx.fillRect(cx + 5, y + h - 6 + (3 - pa) % 4, 9, 5); }
    D(ctx, cx, cy, R + 1, OUT); D(ctx, cx, cy, R, cuerpo); D(ctx, cx - 7, cy - 8, 5, brillo); ctx.fillStyle = bl ? '#fff' : '#fff'; ctx.fillRect(cx - 9, cy - 11, 3, 3);
    // cara
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 12, cy - 5, 9, 8); ctx.fillRect(cx + 3, cy - 5, 9, 8);
    if (aturdido) { ctx.fillStyle = OUT; ctx.fillRect(cx - 11, cy - 4, 7, 1); ctx.fillRect(cx - 9, cy - 3, 3, 3); ctx.fillRect(cx + 4, cy - 4, 7, 1); ctx.fillRect(cx + 6, cy - 3, 3, 3); }
    else { const enojo = b.furia > 0 || String(b.estado).startsWith('aviso') || b.estado === 'carga'; ctx.fillStyle = enojo ? '#ff4d6d' : OUT; ctx.fillRect(cx - 9 + b.dir, cy - 3, 4, 5); ctx.fillRect(cx + 5 + b.dir, cy - 3, 4, 5); ctx.fillStyle = OUT; ctx.fillRect(cx - 13, cy - 8, 11, 2); ctx.fillRect(cx + 2, cy - 8, 11, 2); ctx.fillRect(cx - 4, cy - 9, 3, 2); ctx.fillRect(cx + 1, cy - 9, 3, 2); }
    ctx.fillStyle = OUT; ctx.fillRect(cx - 7, cy + 7, 14, 3); ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) ctx.fillRect(cx - 6 + i * 4, cy + 7, 2, 2);
    // corona
    const ky = cy - R - 3; ctx.fillStyle = OUT; ctx.fillRect(cx - 11, ky + 1, 22, 8);
    ctx.fillStyle = bl ? '#fff' : '#ffd166'; ctx.fillRect(cx - 10, ky + 3, 20, 5); [-10, -3, 4].forEach((o) => { ctx.fillRect(cx + o, ky - 2, 5, 5); ctx.fillStyle = OUT; ctx.fillRect(cx + o, ky - 3, 5, 1); ctx.fillStyle = bl ? '#fff' : '#ffd166'; });
    ctx.fillStyle = '#e8453c'; ctx.fillRect(cx - 2, ky + 4, 4, 3);
    // mecha
    const fx = cx + 12, fy = ky - 5; ctx.fillStyle = OUT; ctx.fillRect(cx + 9, ky - 2, 3, 3); ctx.fillRect(cx + 11, ky - 5, 3, 4);
    if (!aturdido) { const ch = Math.floor(t * 18) % 3; D(ctx, fx + 2, fy - 3, 3 + (mecha ? 2 : 0), ch === 0 ? '#fff3c0' : ch === 1 ? '#ffb020' : '#ff4d2e'); if (mecha) D(ctx, fx + 2, fy - 3, 8, 'rgba(255,200,80,.3)'); }
    // brazos
    ctx.fillStyle = OUT; ctx.fillRect(cx - R - 3, cy + 1, 5, 9); ctx.fillRect(cx + R - 2, cy + 1, 5, 9); ctx.fillStyle = cuerpo; ctx.fillRect(cx - R - 2, cy + 2, 3, 7); ctx.fillRect(cx + R - 1, cy + 2, 3, 7);
  }

  /** Maestro Calavera (diseño propio): esqueleto con birrete, gafas redondas y capa verde. */
  function dibujarCalavera(ctx, b, x, y, w, h, t, bl) {
    const D = J.Temas.disco, cx = Math.round(x + w / 2), aturdido = b.estado === 'aturdido' || b.estado === 'pregunta', atq = String(b.estado).startsWith('aviso');
    const hueso = bl ? '#fff' : '#f2efe4', capa = bl ? '#fff' : '#2f7a56', capa2 = bl ? '#fff' : '#43a578';
    const by = Math.round(y + h) + (aturdido ? 0 : Math.round(Math.sin(t * 3) * 1)), dy = aturdido ? 8 : 0;
    // capa y cuerpo
    ctx.fillStyle = OUT; ctx.fillRect(cx - 11, by - 24 + dy, 22, 24 - dy); ctx.fillStyle = capa; ctx.fillRect(cx - 10, by - 23 + dy, 20, 23 - dy); ctx.fillStyle = capa2; ctx.fillRect(cx - 10, by - 23 + dy, 20, 3);
    ctx.fillStyle = hueso; ctx.fillRect(cx - 3, by - 22 + dy, 6, 8); ctx.fillStyle = OUT; for (let i = 0; i < 3; i++) ctx.fillRect(cx - 3, by - 21 + dy + i * 3, 6, 1);
    // piernas
    ctx.fillStyle = OUT; ctx.fillRect(cx - 7, by - 3, 5, 3); ctx.fillRect(cx + 2, by - 3, 5, 3); ctx.fillStyle = hueso; ctx.fillRect(cx - 6, by - 3, 3, 2); ctx.fillRect(cx + 3, by - 3, 3, 2);
    // manos
    const al = atq ? -6 : 0; ctx.fillStyle = OUT; ctx.fillRect(cx - 15, by - 17 + al + dy, 5, 6); ctx.fillRect(cx + 10, by - 17 + al + dy, 5, 6); ctx.fillStyle = hueso; ctx.fillRect(cx - 14, by - 16 + al + dy, 3, 4); ctx.fillRect(cx + 11, by - 16 + al + dy, 3, 4);
    // cráneo
    const hy = by - 38 + dy; ctx.fillStyle = OUT; ctx.fillRect(cx - 11, hy, 22, 17); ctx.fillStyle = hueso; ctx.fillRect(cx - 10, hy + 1, 20, 15);
    ctx.fillStyle = OUT; ctx.fillRect(cx - 8, hy + 5, 6, 6); ctx.fillRect(cx + 2, hy + 5, 6, 6); ctx.fillRect(cx - 1, hy + 11, 2, 2);
    if (aturdido) { ctx.fillStyle = '#fff'; ctx.fillRect(cx - 7, hy + 6, 4, 1); ctx.fillRect(cx + 3, hy + 6, 4, 1); ctx.fillRect(cx - 6, hy + 8, 2, 2); ctx.fillRect(cx + 4, hy + 8, 2, 2); }
    else { ctx.fillStyle = atq ? '#ff4d6d' : '#8fe3ff'; ctx.fillRect(cx - 6 + b.dir, hy + 7, 2, 2); if (atq || Math.floor(t * 2) % 2) ctx.fillRect(cx + 4 + b.dir, hy + 7, 2, 2); if (atq) { ctx.globalAlpha = 0.4; D(ctx, cx + 5, hy + 8, 6, '#ff4d6d'); ctx.globalAlpha = 1; } }
    ctx.fillStyle = OUT; for (let i = 0; i < 4; i++) ctx.fillRect(cx - 5 + i * 3, hy + 13, 1, 3);
    // gafas redondas y birrete
    ctx.strokeStyle = '#c9a43a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx - 5, hy + 8, 4.5, 0, 6.3); ctx.arc(cx + 5, hy + 8, 4.5, 0, 6.3); ctx.stroke();
    ctx.fillStyle = OUT; ctx.fillRect(cx - 12, hy - 4, 24, 5); ctx.fillRect(cx - 7, hy - 8, 14, 5); ctx.fillStyle = '#26304f'; ctx.fillRect(cx - 11, hy - 3, 22, 3); ctx.fillRect(cx - 6, hy - 7, 12, 4); ctx.fillStyle = '#ffd166'; ctx.fillRect(cx + 9, hy - 2, 2, 8); ctx.fillRect(cx + 8, hy + 5, 4, 2);
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
      ctx.fillStyle = OUT; ctx.fillRect(ax, ty + 6 + levanta + (kneel ? 3 : 0), 14, 22);
      ctx.fillStyle = roca2; ctx.fillRect(ax + 1, ty + 7 + levanta + (kneel ? 3 : 0) + s * sw, 12, 20);
      ctx.fillStyle = lava; ctx.fillRect(ax + 1, ty + 21 + levanta + (kneel ? 3 : 0) + s * sw, 12, 6); ctx.fillStyle = lava2; ctx.fillRect(ax + 3, ty + 22 + levanta + (kneel ? 3 : 0) + s * sw, 8, 2);
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
      } else if (q.tipo === 'tinta') {
        const sx = Math.round(q.x * T - camX), sy = Math.round(q.y * T - camY), r = Math.round(q.r * T);
        ctx.globalAlpha = Math.min(1, q.vida / 1.2);
        [[0, 0, 1], [-6, 3, 0.7], [6, -3, 0.7], [-2, -7, 0.6], [3, 7, 0.55]].forEach(([ox, oy, k], i) => { J.Temas.disco(ctx, sx + ox + Math.round(Math.sin(t * 5 + i) * 1.5), sy + oy, Math.round(r * k), i % 2 ? '#2a0f4a' : '#4a1a7a'); });
        ctx.fillStyle = '#9dff3a'; ctx.fillRect(sx - 3, sy - 2, 2, 2); ctx.fillRect(sx + 4, sy + 3, 1, 1);
        ctx.globalAlpha = 1;
      } else if (q.tipo === 'rayo') {
        const sx = Math.round(q.x * T - camX), gy = Math.round(q.y * T - camY);
        if (q.t <= q.aviso) {   // aviso: marca parpadeante en el suelo y línea tenue
          ctx.fillStyle = Math.floor(q.t * 16) % 2 ? '#ffe27a' : '#6ff0ff'; ctx.fillRect(sx - 8, gy - 2, 16, 2); ctx.fillRect(sx - 4, gy - 4, 8, 2);
          ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(sx - 1, 0, 2, gy);
        } else {
          let px = sx; ctx.fillStyle = 'rgba(111,240,255,.35)'; ctx.fillRect(sx - 7, 0, 14, gy);
          for (let y = 0; y < gy; y += 6) { const nx = sx + Math.round(Math.sin(y * 0.7 + t * 40) * 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.min(px, nx) - 1, y, Math.abs(nx - px) + 3, 7); ctx.fillStyle = '#ffe27a'; ctx.fillRect(Math.min(px, nx), y, Math.abs(nx - px) + 1, 7); px = nx; }
        }
      } else if (q.tipo === 'bola') {
        const sx = Math.round(q.x * T - camX), sy = Math.round(q.y * T - camY);
        if (q.col === 'azul') {
          for (let i = 3; i > 0; i--) { ctx.globalAlpha = 0.18 * (4 - i); ctx.fillStyle = '#6ff0ff'; ctx.fillRect(sx - Math.round(q.vx * i * 1.2) - 3, sy - Math.round(q.vy * i * 0.6) - 3, 6, 6); }
          ctx.globalAlpha = 1; J.Temas.disco(ctx, sx, sy, 6, OUT); J.Temas.disco(ctx, sx, sy, 5, '#35a8ff'); J.Temas.disco(ctx, sx, sy, 3, '#bff6ff'); ctx.fillStyle = '#fff'; ctx.fillRect(sx - 1, sy - 1, 2, 2);
          continue;
        }
        for (let i = 3; i > 0; i--) { ctx.globalAlpha = 0.18 * (4 - i); ctx.fillStyle = '#ff7a1a'; ctx.fillRect(sx - Math.round(q.vx * i * 1.2) - 3, sy - Math.round(q.vy * i * 0.6) - 3, 6, 6); }
        ctx.globalAlpha = 1;
        J.Temas.disco(ctx, sx, sy, 6, OUT); J.Temas.disco(ctx, sx, sy, 5, '#ff4d2e'); J.Temas.disco(ctx, sx + (Math.floor(t * 12) % 2) - 1, sy, 3, '#ffb020'); ctx.fillStyle = '#fff3c0'; ctx.fillRect(sx - 1, sy - 1, 2, 2);
      } else if (q.tipo === 'hueso') {
        const sx = Math.round(q.x * T - camX), gy = Math.round(q.y * T - camY), hh = Math.round(q.h * T);
        ctx.fillStyle = OUT; ctx.fillRect(sx - 4, gy - hh - 1, 8, hh + 1); ctx.fillStyle = '#f2efe4'; ctx.fillRect(sx - 2, gy - hh + 2, 4, hh - 2);
        ctx.fillStyle = OUT; ctx.fillRect(sx - 5, gy - hh - 3, 10, 4); ctx.fillStyle = '#f2efe4'; ctx.fillRect(sx - 4, gy - hh - 2, 8, 3); ctx.fillStyle = OUT; ctx.fillRect(sx - 5, gy - 2, 10, 3); ctx.fillStyle = '#f2efe4'; ctx.fillRect(sx - 4, gy - 2, 8, 2);
      } else if (q.tipo === 'haz') {
        const y = Math.round(q.y * T - camY), xa = Math.round(q.x0 * T - camX), xb = Math.round(q.x1 * T - camX), hh = Math.round(q.h * T), act = q.t > q.aviso;
        const sx = q.lado > 0 ? xa : xb;
        ctx.fillStyle = OUT; ctx.fillRect(sx - 8, y - 8, 16, 14); ctx.fillStyle = '#f2efe4'; ctx.fillRect(sx - 7, y - 7, 14, 12); ctx.fillStyle = OUT; ctx.fillRect(sx - 5, y - 5, 4, 4); ctx.fillRect(sx + 1, y - 5, 4, 4); ctx.fillStyle = act ? '#ff4d6d' : '#ffd166'; ctx.fillRect(sx - 4, y - 4, 2, 2); ctx.fillRect(sx + 2, y - 4, 2, 2);
        if (!act) { if (Math.floor(q.t * 14) % 2) { ctx.fillStyle = 'rgba(255,209,102,.55)'; ctx.fillRect(xa, y - 1, xb - xa, 2); } }
        else { ctx.fillStyle = 'rgba(255,77,109,.4)'; ctx.fillRect(xa, y - hh / 2 - 3, xb - xa, hh + 6); ctx.fillStyle = '#ff4d6d'; ctx.fillRect(xa, y - hh / 2, xb - xa, hh); ctx.fillStyle = '#fff'; ctx.fillRect(xa, y - 2, xb - xa, 4); }
      } else if (q.tipo === 'bomba') {
        const sx = Math.round(q.x * T - camX), sy = Math.round(q.y * T - camY), parp = q.fuse < 0.7 && Math.floor(q.t * 18) % 2;
        J.Temas.disco(ctx, sx, sy, 6, OUT); J.Temas.disco(ctx, sx, sy, 5, parp ? '#ff4d6d' : '#232a48'); ctx.fillStyle = parp ? '#ffd0d0' : '#3a4470'; ctx.fillRect(sx - 3, sy - 3, 2, 2);
        ctx.fillStyle = OUT; ctx.fillRect(sx - 1, sy - 8, 3, 3); J.Temas.disco(ctx, sx + 1, sy - 10, 2 + (Math.floor(q.t * 20) % 2), Math.floor(q.t * 20) % 2 ? '#ffb020' : '#fff3c0');
        if (q.fuse < 1.0) { ctx.strokeStyle = 'rgba(255,77,109,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy, Math.round(q.rad * T * (1 - q.fuse)), 0, 6.3); ctx.stroke(); }
      } else if (q.tipo === 'nova') {
        const sx = Math.round(q.x * T - camX), sy = Math.round(q.y * T - camY), a = Math.min(1, q.t / q.dur), rr = Math.round(q.rad * T * (0.25 + 0.75 * a));
        ctx.globalAlpha = 1 - a * 0.7; J.Temas.disco(ctx, sx, sy, rr, '#ff7a1a'); J.Temas.disco(ctx, sx, sy, Math.round(rr * 0.7), '#ffd166'); J.Temas.disco(ctx, sx, sy, Math.round(rr * 0.4), '#fff3c0'); ctx.globalAlpha = 1;
      } else if (q.tipo === 'onda') {
        const sx = Math.round(q.x * T - camX), sy = Math.round(q.y * T - camY), d = Math.sign(q.vx);
        if (q.tent) {   // tentáculo de ácido que azota el suelo
          for (let j = 0; j < 9; j++) { const o = Math.round(Math.sin(t * 12 + j * 0.6) * 2); ctx.fillStyle = OUT; ctx.fillRect(sx - 3 + o, sy - 2 - j * 1.4, 7, 3); ctx.fillStyle = j > 6 ? '#9dff3a' : '#a56bff'; ctx.fillRect(sx - 2 + o, sy - 2 - j * 1.4, 5, 2); }
          continue;
        }
        for (let i = 0; i < 6; i++) { ctx.fillStyle = i < 2 ? '#fff3c0' : i < 4 ? '#ffd166' : '#ff7a1a'; ctx.fillRect(sx - d * i * 3 - 3, sy - 11 + i * 2, 4, 11 - i * 2); }
        ctx.fillStyle = OUT; ctx.fillRect(sx - 4, sy - 1, 8, 1);
      }
    }
  };
})();
