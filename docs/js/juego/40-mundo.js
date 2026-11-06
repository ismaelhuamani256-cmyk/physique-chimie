// =====================================================================================
// 40-mundo.js — el mundo del nivel y la simulación (paso fijo de 1/60 s)
//   · crearMundo(nivel): rejilla de tiles + entidades a partir del esquema del CONTRATO §4
//   · colisiones AABB por tiles con barrido por ejes (moverX / moverY), plataformas móviles de un solo sentido
//   · jugador (aceleración, fricción, salto variable, coyote time, jump buffer), enemigos, resortes,
//     coleccionables, checkpoints, zonas de campo, puentes que caen, palancas, meta y arena del jefe
// Unidades: tiles y segundos. Constantes de física: PCB.juego.FIS (validador.js).
// =====================================================================================
(function () {
  const J = window.PCB.juego;
  const EPS = 1e-4;
  const SOL = (t) => t === 1 || t === 3 || t === 4 || t === 5 || t === 6 || t === 7 || t === 8 || t === 9 || t === 10;   // 5 bloque ?, 6 tubería, 7 puerta, 8 ladrillo, 9 cinta, 10 bloque de onda

  // ---------- creación del mundo ----------
  J.crearMundo = function (nivel) {
    const G = J.geometria(nivel), FIS = J.FIS;
    const w = { nivel, G, ancho: G.ancho, alto: G.alto, tiles: G.tiles, fort: nivel.tipo_nivel === 'fortaleza' };
    // fuera del nivel por los lados hay muro sólido; por arriba y abajo, aire
    w.get = (x, y) => (x < 0 || x >= w.ancho ? (y < 0 ? 0 : 4) : y < 0 || y >= w.alto ? 0 : w.tiles[y * w.ancho + x]);
    w.topAt = (x) => G.topAt(x);
    w.movers = G.movers.map((m) => ({ x: m.x, y: m.y, bx: m.x, by: m.y, largo: m.largo, rec: m.rec, eje: m.eje, per: m.per, dx: 0, dy: 0 }));
    w.resortes = G.resortes.map((r) => {
      let fila = r.y; while (fila > 0 && w.get(r.x, fila) !== 0) fila--;
      return { cx: r.x, fila, comp: 0 };
    });
    w.campos = G.campos.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h, fx: c.fx, fy: c.fy }));
    w.items = [];
    w.enemigos = [];
    w.checks = [];
    w.puentes = G.puentes.map((b) => ({ id: b.id, caeCon: b.caeCon, x: b.x, y: b.y, largo: b.largo, estado: 'firme', cola: [], t: 0, k: 0, oculto: b.oculto }));
    w.palancas = G.palancas.map((l) => ({ id: l.id, x: Math.floor(l.x), y: Math.floor(l.y), objetivo: l.objetivo, estado: 0, usada: false, nombre: l.seg.nombre }));
    w.escombros = [];
    w.quiz = String(nivel.tipo_nivel || '').indexOf('quiz_') === 0;
    // Quiz Quest: bloques ?, tuberías, puertas y zonas de agua (lo que el motor dibuja como entidades sobre tiles 5/6/7)
    w.bloques = G.bloques.map((b) => ({ x: b.x, y: b.y, q: b.seg.pregunta, premio: b.seg.premio || 'moneda', fallo: b.seg.fallo || 'cierra', estado: 'listo', bump: 0, reserva: (b.seg.preguntas_reserva || []).slice() }));
    w.tuberias = G.tuberias.filter((t) => t.base >= 0).map((t) => ({ x: t.x, top: t.top, base: t.base, alto: t.alto, q: t.seg.pregunta, reserva: (t.seg.preguntas_reserva || []).slice(), destino: t.seg.destino || 'atajo',
      sx: t.seg.salida_x, sy: t.seg.salida_y, abierta: false, usada: false, cooldown: 0, agotada: false }));
    w.puertas = G.puertas.filter((d) => d.base >= 0).map((d) => ({ id: d.seg.id || null, eq: d.seg.ecuacion || null, ayuda: d.seg.ayuda || '', x: d.x, top: d.top, base: d.base, alto: d.alto, q: d.seg.pregunta, reserva: (d.seg.preguntas_reserva || []).slice(), abierta: false, cooldown: 0, disolver: 0, intentos: 0 }));
    // ladrillos rompibles, plataformas que caen (viven en w.movers con cae:true) y plantas carnívoras
    w.ladrillos = G.ladrillos.map((b) => ({ x: b.x, y: b.y, contenido: b.contenido, monedas: b.contenido === 'moneda_multi' ? 6 : b.contenido === 'moneda' ? 1 : 0, bump: 0, roto: false }));
    for (const c of G.caes) w.movers.push({ x: c.x, y: c.y, bx: c.x, by: c.y, largo: c.largo, rec: 0, eje: 'x', per: 1, dx: 0, dy: 0, cae: true, retardo: c.retardo, reaparece: c.reaparece, estado: 'firme', t: 0, vy: 0, ausente: false });
    w.plantas = G.plantas.map((pl) => {
      const tubo = w.tuberias.find((t) => t.x <= pl.x && pl.x < t.x + 2);
      const base = tubo ? tubo.top : G.baseDesde(pl.x, pl.y);
      return { cx: tubo ? tubo.x + 1 : pl.x + 0.5, baseY: base, tubo: tubo || null, ciclo: pl.ciclo, visible: pl.visible, fase: ((J.hash('pl' + pl.x) % 100) / 100) * pl.ciclo, alt: 0, forzar: 0, mordio: false };
    });
    // Etapa 1: parkour y química
    const celda = (v) => Math.floor(v);
    w.minas = G.minas.map((m) => ({ x: celda(m.x) + 0.5, y: celda(m.y) + 0.5, modo: m.modo, radio: m.radio, estado: 'lista', t: 0, k: (J.hash('mina' + m.x + m.y) % 100) / 10 }));
    w.prensas = G.prensas.map((pr) => ({ x: pr.x, y: pr.y, largo: pr.largo, base: G.baseDesde(pr.x, pr.y + 1), periodo: pr.periodo, retardo: pr.retardo, cab: pr.y, fase: 'sube', sono: false }));
    w.pendulos = G.pendulos.map((pe) => { const T0 = pe.periodo > 0 ? pe.periodo : 2 * Math.PI * Math.sqrt(pe.cuerda / 9.81); return { px: pe.x + 0.5, py: pe.y + 0.5, L: pe.cuerda, T: T0, A: (pe.amplitud * Math.PI) / 180, mx: pe.x + 0.5, my: pe.y + 0.5 + pe.cuerda }; });
    w.cintas = G.cintas.map((c) => ({ x: c.x, y: c.y, largo: c.largo, v: c.velocidad }));
    w.picos = G.picos.map((c) => ({ x: c.x, y: c.y, largo: c.largo }));
    w.rebotes = G.rebotes.map((r) => ({ x: r.x, y: r.y, largo: r.largo, comp: 0 }));
    w.sprints = G.sprints.map((sp) => ({ ini: sp.ini, fin: sp.fin, v: sp.velocidad, activo: false, hecho: false, cam: 0 }));
    w.carteles = G.carteles.map((c) => ({ x: celda(c.x), y: celda(c.y), texto: c.texto, cerca: false }));
    for (const rs of G.rastros) rs.puntos.forEach((q, i) => w.items.push({ x: celda(q[0]), y: celda(q[1]), moneda: true, tomado: false, fase: i * 0.4, ref: null }));
    w.atomos = G.atomos.map((a) => ({ x: a.x, y: a.y, el: a.elemento, tomado: false, fase: (J.hash('at' + a.x + a.y) % 60) / 10 }));
    w.estaciones = G.estaciones.map((e) => ({ x: e.x, y: e.y, molecula: e.seg.molecula, requiere: e.seg.requiere || {}, recompensa: e.seg.recompensa, objetivo: e.seg.objetivo || null, hecha: false, nombre: e.seg.nombre || null }));
    w.interruptores = G.interruptores.map((it) => ({ x: it.x, y: it.y, variable: it.variable, valores: it.valores, idx: 0, cd: 0 }));
    for (const pe of G.platEstado) { const k = Object.keys(pe.requiere)[0]; w.movers.push({ x: pe.x, y: pe.y, bx: pe.x, by: pe.y, largo: pe.largo, rec: 0, eje: 'x', per: 1, dx: 0, dy: 0, est: true, variable: k, valor: pe.requiere[k], ausente: true }); }
    w.aguas = G.aguas.map((a) => ({ x: a.x, y: a.y, w: a.w, h: a.h, cx: a.cx, cy: a.cy }));
    for (const s of nivel.segmentos) {
      if (s.tipo === 'coleccionable') w.items.push({ x: Math.floor(s.x), y: Math.floor(s.y), ref: s.ref, latex: s.latex, nombre: s.nombre, tomado: false, fase: (J.hash(s.ref || '') % 100) / 16 });
      else if (s.tipo === 'enemigo') {
        const h = J.hash(s.enemigo || s.nombre || '');
        const ac = ['medusa', 'pez', 'erizo', 'anguila'].indexOf(s.enemigo) >= 0 ? s.enemigo : null;
        w.enemigos.push({ x: s.x + (ac ? 0.05 : 0.1), y: s.y + (ac ? 0.05 : 0.2), w: ac ? 0.9 : 0.8, h: ac ? 0.9 : 0.8, vx: 0, vy: 0, dir: h & 1 ? 1 : -1, vel: 1.1 + (h % 7) * 0.08, skin: h % J.Sprites.NSKINS,
          vivo: true, muertoT: 0, suelo: false, nombre: s.nombre, correccion: s.correccion, id: s.enemigo, x0: s.x, y0: s.y, acuatico: ac, ph: (h % 628) / 100 });
      } else if (s.tipo === 'checkpoint') {
        const top = w.topAt(Math.round(s.x));
        w.checks.push({ x: Math.round(s.x), top, activo: false });
      }
    }
    // meta: portal de 2x3 tiles sobre el suelo
    const mt = G.meta;
    w.meta = mt ? { x: mt.x, top: w.topAt(mt.x), y: w.topAt(mt.x) - 3, bloqueada: !!G.jefe, fase: 0 } : null;
    // arena del jefe: muros de energía
    w.jefeSeg = G.jefe ? G.jefe.seg : null;
    w.arena = null; w.bloqueos = [];
    if (G.arena) {
      const A = G.arena;
      w.arena = { izq: A.izq, der: A.der, fort: A.fort, activa: false, derrotado: false, progreso: { aciertos: 0, furia: 0, pIdx: 0 } };
      w.bloqueos.push({ x: A.izq, y: 0, w: 1, h: w.alto, activo: false, lado: 'izq' });
      w.bloqueos.push({ x: A.der, y: 0, w: 1, h: w.alto, activo: true, lado: 'der' });
    }
    // punto de inicio
    const sy = w.topAt(2);
    w.spawn = { x: 2.5 - FIS.W / 2, y: sy - FIS.H };
    return w;
  };

  // ---------- colisiones ----------
  /** Mueve el cuerpo b en X dx tiles resolviendo contra sólidos y bloqueos. Devuelve true si chocó. */
  J.moverX = function (w, b, dx) {
    if (!dx) return false;
    b.x += dx;
    let choco = false;
    const x0 = Math.floor(b.x + EPS), x1 = Math.floor(b.x + b.w - EPS), y0 = Math.floor(b.y + EPS), y1 = Math.floor(b.y + b.h - EPS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!SOL(w.get(tx, ty))) continue;
      b.x = dx > 0 ? tx - b.w - EPS : tx + 1 + EPS; choco = true;
    }
    for (const k of w.bloqueos) {
      if (!k.activo) continue;
      if (b.x < k.x + k.w && b.x + b.w > k.x && b.y < k.y + k.h && b.y + b.h > k.y) { b.x = dx > 0 ? k.x - b.w - EPS : k.x + k.w + EPS; choco = true; }
    }
    if (choco) b.vx = 0;
    return choco;
  };
  /** Mueve en Y. Marca b.suelo / b.sobre al aterrizar. Las plataformas flotantes y móviles son de un solo sentido. */
  J.moverY = function (w, b, dy) {
    const prevB = b.y + b.h, prevT = b.y;
    b.y += dy; b.techo = null;
    let choco = false;
    const x0 = Math.floor(b.x + EPS), x1 = Math.floor(b.x + b.w - EPS);
    if (dy >= 0) {
      let mejor = Infinity, mov = null;
      const y0 = Math.floor(prevB - EPS), y1 = Math.floor(b.y + b.h - EPS);
      for (let ty = Math.max(y0, 0); ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const t = w.get(tx, ty);
        if (SOL(t) || (t === 2 && prevB <= ty + 0.001)) mejor = Math.min(mejor, ty);
      }
      for (const m of w.movers) {
        if (!m.ausente && b.x + b.w > m.x && b.x < m.x + m.largo && prevB <= m.y + 0.06 && b.y + b.h >= m.y && m.y < mejor) { mejor = m.y; mov = m; }
      }
      if (mejor < Infinity) { b.y = mejor - b.h; b.vy = 0; b.suelo = true; b.sobre = mov; choco = true; }
    } else {
      const y0 = Math.floor(b.y), y1 = Math.floor(prevT - EPS);
      let mejor = -Infinity;
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (SOL(w.get(tx, ty))) mejor = Math.max(mejor, ty + 1);
      if (mejor > -Infinity) {
        b.y = mejor; b.vy = 0; choco = true;
        let golpeX = -1, dMin = 9;   // casilla golpeada: la más centrada en la fila del techo
        for (let tx = x0; tx <= x1; tx++) if (SOL(w.get(tx, mejor - 1))) { const d = Math.abs(tx + 0.5 - (b.x + b.w / 2)); if (d < dMin) { dMin = d; golpeX = tx; } }
        b.techo = { x: golpeX, y: mejor - 1 };
      }
    }
    return choco;
  };
  const solapa = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  J.solapa = solapa;

  // ---------- partículas ----------
  J.chispas = function (g, x, y, n, color, v, grav) {
    if (g.reducido) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (v || 3) * (0.3 + Math.random() * 0.7);
      g.part.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (v || 3) * 0.3, vida: 0.4 + Math.random() * 0.4, max: 0.8, color, size: Math.random() < 0.3 ? 2 : 1, grav: grav == null ? 14 : grav });
    }
  };
  const polvo = (g, x, y, n) => J.chispas(g, x, y, n, '#cfd8f0', 1.6, 2);

  // ---------- constantes de natación (zona_agua) ----------
  J.NAT = {
    GRAV: 0.16,        // fracción de la gravedad del nivel dentro del agua
    ARRASTRE_Y: 0.97,  // factor por fotograma de vy (resistencia + flotabilidad: hundimiento ≈ 1.8 tiles/s)
    ARRASTRE_X: 0.93,  // al soltar, el avance se frena en ~0.4 s
    ACC: 18, VMAX: 3.6, // aceleración y velocidad horizontal máxima nadando (tiles/s², tiles/s)
    BRAZADA: 7,        // impulso vertical de cada pulsación de salto (tiles/s) -> ≈ 2.1 tiles por brazada
    CORRIENTE: 0.8,    // velocidad de deriva (tiles/s) por unidad de corriente_x / corriente_y
    BUCEO: 9,          // aceleración hacia abajo al mantener ↓
    VY_MAX: 7, VY_MAX_ABAJO: 4,
  };
  function burbujas(g, cx, y, n) {
    if (g.reducido) n = 1;
    for (let i = 0; i < n; i++) g.part.push({ x: (cx + (Math.random() - 0.5) * 0.3) * J.T, y: y * J.T, vx: (Math.random() - 0.5) * 0.4, vy: -1.2 - Math.random() * 1.2, vida: 0.8 + Math.random() * 0.8, max: 1.4, color: '#d8f6ff', size: Math.random() < 0.4 ? 2 : 1, grav: -1.5, burbuja: true });
  }
  J.burbujas = burbujas;

  // ---------- jugador ----------
  J.crearJugador = function (w) {
    const FIS = J.FIS;
    return { x: w.spawn.x, y: w.spawn.y, w: FIS.W, h: FIS.H, vx: 0, vy: 0, dir: 1, suelo: false, sobre: null, coyote: 0, buffer: 0, saltando: false,
      inv: 0, muriendo: false, tMuerte: 0, tAnim: 0 };
  };

  /** motivo: 'golpe' | 'foso'; fuerza: ignora la invulnerabilidad (castigo de jefe por fallar una pregunta). */
  function perderVida(g, motivo, desdeX, fuerza) {
    const p = g.jugador;
    if (p.muriendo || g.estado === 'fin') return;
    if (motivo !== 'foso' && p.inv > 0 && !fuerza) return;
    if (motivo !== 'foso' && p.estrella > 0) return;                 // estrella: invulnerable
    if (motivo !== 'foso' && g.escudo) {                             // el escudo absorbe un golpe
      g.escudo = false; p.inv = 1.2; g.shake = 3;
      J.Audio.sfx('golpe'); J.chispas(g, (p.x + p.w / 2) * J.T, (p.y + p.h / 2) * J.T, 16, '#6ff0ff', 4);
      if (g.ui) { g.ui.estados(g); g.ui.aviso('¡Escudo roto!'); }
      return;
    }
    if (motivo !== 'foso' && J.Items && J.Items.alGolpear && J.Items.alGolpear(g)) return;   // «grande»: aguanta un golpe y se encoge
    g.vidas--;
    g.shake = 4;
    if (motivo === 'foso' || g.vidas <= 0) {
      p.muriendo = true; p.tMuerte = 0; p.vx = 0; p.vy = motivo === 'foso' ? -9 : -11;
      J.Audio.sfx('muerte');
      if (g.ui) g.ui.vidas(g.vidas);
      return;
    }
    p.inv = 1.8; p.suelo = false; p.saltando = false;
    p.vx = (p.x + p.w / 2 < desdeX ? -1 : 1) * 5; p.vy = -7;
    J.Audio.sfx('golpe'); J.chispas(g, (p.x + p.w / 2) * J.T, (p.y + p.h / 2) * J.T, 10, '#ff4d6d', 3.5);
    if (g.ui) g.ui.vidas(g.vidas);
  }
  J.herir = (g, desdeX, fuerza) => perderVida(g, 'golpe', desdeX, fuerza);
  J.caerEnFoso = (g) => perderVida(g, 'foso');

  /** Tras la animación de muerte: reaparece en el último checkpoint o termina el juego. */
  function alMorir(g) {
    if (g.vidas <= 0) { g.terminar(false); return; }
    const p = g.jugador, w = g.w;
    Object.assign(p, { x: g.respawn.x, y: g.respawn.y, vx: 0, vy: 0, muriendo: false, inv: 2, suelo: false, sobre: null, saltando: false, coyote: 0, buffer: 0 });
    if (J.Items && J.Items.alReaparecer) J.Items.alReaparecer(g);   // al morir se pierde el tamaño grande y la flor de plasma
    g.proy.length = 0;
    if (J.Parkour) J.Parkour.alMorir(g);
    const A = w.arena;
    if (A && !A.derrotado && p.x < A.izq + 3) {   // morir en la arena: el jefe se reinicia (conserva el progreso)
      A.activa = false; w.bloqueos[0].activo = false; g.jefe = null;
    }
    g.snapCamara = true;
  }

  function pasoJugador(g, dt) {
    const p = g.jugador, F = g.F, w = g.w, inp = g.inp, FIS = J.FIS;
    if (p.muriendo) {
      p.tMuerte += dt; p.vy = Math.min(p.vy + F.g * dt * 0.9, FIS.CAIDA_MAX); p.y += p.vy * dt;
      if (p.tMuerte > 1.3) alMorir(g);
      return;
    }
    p.inv = Math.max(0, p.inv - dt);
    const dir = g.congelado ? 0 : inp.dir;
    if (dir) p.dir = dir;
    // arrastre de la plataforma móvil sobre la que estaba
    const m = p.sobre; p.sobre = null;
    if (m) { J.moverX(w, p, m.dx); p.y += m.dy; }
    const suelo = p.suelo;
    // --- ¿está en una zona de agua? (física de natación) ---
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    let zona = null, corX = 0, corY = 0;
    for (const a of w.aguas) if (cx >= a.x && cx < a.x + a.w && cy >= a.y && cy < a.y + a.h) { zona = zona || a; corX += a.cx; corY += a.cy; }
    if (!!zona !== !!p.agua) { J.Audio.sfx('splash'); J.chispas(g, cx * J.T, (zona ? zona.y : cy) * J.T, 12, '#9fe7ff', 4); }
    p.agua = zona;
    const NAD = J.NAT;
    // --- horizontal ---
    const grip = J.clamp(Math.sqrt((1 - F.friccion) / 0.15), 0.3, 1.3);
    const corre = !!inp.correr && !zona;                      // botón de correr (Shift): +50 % de velocidad máxima
    const acc = (zona ? NAD.ACC : suelo ? FIS.ACC_SUELO * grip : FIS.ACC_AIRE) * (corre ? 1.3 : 1);
    const vmaxH = zona ? NAD.VMAX : F.vmax * (corre ? 1.5 : 1);
    p.corriendo = corre && Math.abs(p.vx) > 3;
    if (p.corriendo && suelo && Math.random() < 0.25) polvo(g, (p.x + p.w / 2) * J.T - p.dir * 5, (p.y + p.h) * J.T, 1);
    const vcx = zona ? corX * NAD.CORRIENTE : 0;   // la corriente arrastra el agua: velocidad de deriva ≈ corriente_x·0.8 tiles/s
    if (dir) {
      const aa = acc * (p.vx * dir < 0 ? FIS.GIRO : 1) * dt, obj = dir * vmaxH + vcx;
      if (p.vx < obj) p.vx = Math.min(obj, p.vx + aa); else p.vx = Math.max(obj, p.vx - aa);
    } else if (zona) p.vx = vcx + (p.vx - vcx) * Math.pow(NAD.ARRASTRE_X, dt * 60);
    else if (suelo) {
      p.vx *= Math.pow(F.friccion, dt * 60);
      if (Math.abs(p.vx) < 0.05) p.vx = 0;
    } else p.vx *= Math.pow(0.996, dt * 60);
    if (!zona) p.vx += F.viento * dt;
    // --- zonas de campo: aceleración extra (múltiplos de la gravedad base) ---
    let fyZona = 0;
    for (const c of w.campos) if (cx >= c.x && cx < c.x + c.w && cy >= c.y && cy < c.y + c.h) { p.vx += c.fx * FIS.G0 * dt; fyZona += c.fy; }
    let vyPrev;
    if (zona) {
      // NATACIÓN: gravedad suave + resistencia vertical (velocidad de hundimiento ≈ 1.8 tiles/s);
      // cada pulsación de salto da una brazada hacia arriba; ↓ (mantener) bucea; corriente = aceleración constante.
      if (inp.saltoEdge) { inp.saltoEdge = false; if (!g.congelado) {
        const enSuperficie = zona.y > 0.5 && p.y < zona.y + 0.35;
        p.vy = enSuperficie ? -F.v0 * 0.9 : Math.min(p.vy, -NAD.BRAZADA);
        p.suelo = false; J.Audio.sfx('nadar'); burbujas(g, cx, p.y + 0.2, 3);
      } }
      p.buffer = 0; p.coyote = 0; p.saltando = false;
      vyPrev = p.vy;
      const vcy = corY * NAD.CORRIENTE;
      let ay = F.g * NAD.GRAV + fyZona * FIS.G0;
      if (inp.accion && !g.congelado) ay += NAD.BUCEO;
      p.vy = vcy + (p.vy - vcy + ay * dt) * Math.pow(NAD.ARRASTRE_Y, dt * 60);
      p.vy = J.clamp(p.vy, -NAD.VY_MAX, NAD.VY_MAX_ABAJO);
      if (zona.y <= 0 && p.y < 0.05) { p.y = 0.05; p.vy = Math.max(0, p.vy); }          // el techo del nivel sumergido
      if (Math.random() < 0.02 + Math.abs(p.vx) * 0.004) burbujas(g, cx + (Math.random() - 0.5) * 0.4, p.y + 0.2, 1);
    } else {
      // --- salto: buffer + coyote + variable ---
      if (inp.saltoEdge) { p.buffer = FIS.BUFFER; inp.saltoEdge = false; }
      p.buffer -= dt;
      p.coyote = suelo ? FIS.COYOTE : p.coyote - dt;
      if (g.congelado) p.buffer = 0;
      if (p.buffer > 0 && p.coyote > 0) {
        p.vy = -F.v0 * (J.Items ? J.Items.saltoMult(g) : 1); p.buffer = 0; p.coyote = 0; p.suelo = false; p.saltando = true;
        J.Audio.sfx('salto'); polvo(g, cx * J.T, (p.y + p.h) * J.T, 4);
      }
      if (p.saltando && !inp.salto && p.vy < 0) { p.vy *= FIS.CORTE_SALTO; p.saltando = false; }
      if (p.vy >= 0) p.saltando = false;
      vyPrev = p.vy;
      p.vy = Math.min(FIS.CAIDA_MAX, p.vy + (F.g + fyZona * FIS.G0) * dt);
    }
    // --- movimiento (integración con velocidad media: la altura del salto sale exacta, v²/2g) ---
    const vyAntes = p.vy;
    p.suelo = false;
    J.moverX(w, p, p.vx * dt);
    J.moverY(w, p, ((vyPrev + p.vy) / 2) * dt);
    // suelo invisible al fondo de una zona de agua que llega hasta abajo (se puede volver a subir nadando)
    if (zona && zona.y + zona.h >= w.alto && p.y + p.h > w.alto - 0.05) { p.y = w.alto - 0.05 - p.h; p.vy = Math.min(0, p.vy); p.suelo = true; }
    // golpe de cabeza contra un bloque ? (desde abajo)
    if (p.techo && J.Quiz) { const tt = w.get(p.techo.x, p.techo.y); if (tt === 5) J.Quiz.golpeBloque(g, p.techo.x, p.techo.y); else if (tt === 8) J.Quiz.golpeLadrillo(g, p.techo.x, p.techo.y); }
    if (p.suelo && !suelo && vyAntes > 5) polvo(g, cx * J.T, (p.y + p.h) * J.T, 5);
    if (Math.abs(p.vx) > 0.5) p.tAnim += dt * (0.6 + Math.abs(p.vx) / F.vmax); else p.tAnim = 0;
    // foso (en el agua no mata: se puede volver a subir nadando)
    if (!p.agua && p.y + p.h > w.alto - 1.0 && !p.suelo) J.caerEnFoso(g);
    // polvo al correr
    if (p.suelo && Math.abs(p.vx) > 4 && Math.random() < 0.12) polvo(g, cx * J.T - p.dir * 4, (p.y + p.h) * J.T, 1);
  }

  // ---------- el resto de entidades ----------
  function pasoMundo(g, dt) {
    const w = g.w, p = g.jugador, F = g.F, T = J.T, inp = g.inp;
    // animaciones que congelan el mundo (entrar en una tubería)
    if (g.anim) { J.Quiz.pasoAnim(g, dt); inp.accionEdge = inp.arribaEdge = false; pasoCamara(g, dt); return; }
    // relojes de premios; "reloj" ralentiza enemigos, jefes y plataformas (dtM)
    if (g.lento > 0) g.lento = Math.max(0, g.lento - dt);
    if (p.estrella > 0) { p.estrella = Math.max(0, p.estrella - dt); p.inv = Math.max(p.inv, 0.2); if (p.estrella === 0 && g.ui) g.ui.estados(g); }
    if (g.lento === 0 && g.lentoActivo) { g.lentoActivo = false; if (g.ui) g.ui.estados(g); }
    const dtM = g.lento > 0 ? dt * 0.5 : dt;
    g.tm += dtM;
    // plataformas móviles
    for (const m of w.movers) {
      if (m.cae) { J.Quiz.pasoCae(g, m, dtM); continue; }
      if (m.est) { m.ausente = g.vars[m.variable] !== m.valor; m.dx = m.dy = 0; continue; }
      const s = 0.5 - 0.5 * Math.cos((2 * Math.PI * g.tm) / m.per);
      const nx = m.eje === 'x' ? m.bx + m.rec * s : m.bx, ny = m.eje === 'y' ? m.by + m.rec * s : m.by;
      m.dx = nx - m.x; m.dy = ny - m.y; m.x = nx; m.y = ny;
    }
    if (J.Quiz) J.Quiz.preJugador(g);
    pasoJugador(g, dt);
    // puentes que caen
    for (const b of w.puentes) {
      if (b.estado !== 'cae') continue;
      b.t += dt;
      while (b.k < b.cola.length && b.t >= b.k * 0.07) {
        const col = b.cola[b.k++];
        w.tiles[b.y * w.ancho + col] = 0;
        w.escombros.push({ x: col, y: b.y, vy: 0, rot: 0, vr: (Math.random() - 0.5) * 6 });
        J.chispas(g, (col + 0.5) * T, (b.y + 0.5) * T, 3, '#ffb020', 2);
      }
    }
    for (const e of w.escombros) { e.vy += F.g * dt; e.y += e.vy * dt; e.rot += e.vr * dt; }
    w.escombros = w.escombros.filter((e) => e.y < w.alto + 1);
    // resortes
    for (const r of w.resortes) {
      r.comp = Math.max(0, r.comp - dt * 4);
      if (p.muriendo) continue;
      if (p.x + p.w > r.cx && p.x < r.cx + 1 && p.vy >= 0 && p.y + p.h >= r.fila + 0.4 && p.y + p.h <= r.fila + 1.1) {
        p.vy = -F.vResorte; p.suelo = false; p.coyote = 0; p.saltando = false; p.y = r.fila + 0.4 - p.h; r.comp = 1;
        J.Audio.sfx('resorte'); J.chispas(g, (r.cx + 0.5) * T, (r.fila + 0.5) * T, 8, '#ff3da6', 3);
      }
    }
    if (!p.muriendo) {
      // coleccionables
      for (const it of w.items) if (!it.tomado && p.x + p.w > it.x + 0.1 && p.x < it.x + 0.9 && p.y + p.h > it.y + 0.1 && p.y < it.y + 0.9) {
        it.tomado = true; J.Audio.sfx('moneda');
        if (it.moneda) { g.premios.moneda++; J.chispas(g, (it.x + 0.5) * T, (it.y + 0.5) * T, 8, '#ffd166', 3, 4); if (g.ui) g.ui.estados(g); continue; }
        g.coleccionados++;
        J.chispas(g, (it.x + 0.5) * T, (it.y + 0.5) * T, 14, g.tema.pal.acento, 4, 4);
        if (g.ui) g.ui.formula(it);
      }
      // checkpoints
      for (const c of w.checks) if (!c.activo && p.x + p.w / 2 >= c.x + 0.5 && c.top >= 0 && Math.abs(p.y + p.h - c.top) < 3) {
        c.activo = true; g.respawn = { x: c.x + 0.5 - p.w / 2, y: c.top - p.h };
        J.Audio.sfx('checkpoint'); J.chispas(g, (c.x + 0.5) * T, (c.top - 1) * T, 12, '#2ee59d', 3);
        if (g.ui) g.ui.aviso('Checkpoint');
      }
      // palancas
      for (const l of w.palancas) if (!l.usada) {
        const cerca = p.x + p.w > l.x - 0.2 && p.x < l.x + 1.2 && p.y + p.h > l.y && p.y < l.y + 1.2;
        const cerca2 = Math.abs(p.x + p.w / 2 - (l.x + 0.5)) < 1.6 && Math.abs(p.y + p.h - (l.y + 1)) < 1.2;
        if (cerca || (cerca2 && inp_accion(g))) activarPalanca(g, l);
      }
      for (const l of w.palancas) l.estado += ((l.usada ? 1 : 0) - l.estado) * Math.min(1, dt * 8);
      // meta
      const mt = w.meta;
      if (mt && !mt.bloqueada && g.estado === 'jugando' && solapa(p, { x: mt.x + 0.2, y: mt.y, w: 1.6, h: 3 })) g.terminar(true);
    }
    pasoEnemigos(g, dtM);
    // arena del jefe
    const A = w.arena;
    if (A && !A.derrotado) {
      if (!A.activa && !p.muriendo && p.x > A.izq + 3 && p.x < A.der - 2) {
        A.activa = true; w.bloqueos[0].activo = true; g.jefe = J.Jefe.crear(g);
        J.Audio.sfx('onda'); g.shake = 6;
      }
    }
    if (g.jefe) J.Jefe.update(g, dtM);
    pasoProyectiles(g, dtM);
    if (J.Quiz) J.Quiz.paso(g, dt);
    if (J.Parkour) J.Parkour.paso(g, dt);
    if (J.Quim) J.Quim.paso(g, dt);
    if (J.Items) J.Items.paso(g, dt);
    if (J.Ambiente) J.Ambiente.paso(g, dt);
    if (J.Peligros) J.Peligros.paso(g, dt);
    if (J.Fauna) J.Fauna.paso(g, dt);
    inp.accionEdge = inp.arribaEdge = false;
    // partículas
    for (const q of g.part) { q.vida -= dt; q.vy += q.grav * dt; q.x += q.vx * dt * 16; q.y += q.vy * dt * 16; }
    g.part = g.part.filter((q) => q.vida > 0);
    g.shake = Math.max(0, g.shake - dt * 14);
    if (w.meta) w.meta.fase += dt;
    g.tiempo += dt; g.t += dt;
    pasoCamara(g, dt);
  }
  const inp_accion = (g) => g.inp.accion;

  function activarPalanca(g, l) {
    const w = g.w;
    l.usada = true; J.Audio.sfx('palanca'); g.shake = 8;
    let b = w.puentes.find((q) => q.id && q.id === l.objetivo) || w.puentes.find((q) => q.caeCon && l.id && q.caeCon === l.id);
    if (!b) b = w.puentes[w.puentes.length - 1];
    if (!b) return;
    if (b.estado === 'firme') {
      b.estado = 'cae';
      for (let i = 0; i < b.largo; i++) b.cola.push(b.x + i);
      b.cola.sort((a, c) => Math.abs(a + 0.5 - l.x) - Math.abs(c + 0.5 - l.x));
    }
    if (g.ui) g.ui.aviso('¡El puente cae!');
    // ¿el jefe está encima del puente? entonces cae con él y queda derrotado
    if (g.jefe && J.Jefe.sobrePuente) J.Jefe.sobrePuente(g, b);
  }

  function pasoEnemigos(g, dt) {
    const w = g.w, p = g.jugador, F = g.F;
    for (const e of w.enemigos) {
      if (!e.vivo) continue;
      if (e.muertoT > 0) { e.muertoT += dt; if (e.muertoT > 0.5) e.vivo = false; continue; }
      if (Math.abs(e.x - p.x) > 26) continue;
      if (e.acuatico) J.Quiz.moverAcuatico(g, e, dt);
      else {
        e.vy = Math.min(J.FIS.CAIDA_MAX, e.vy + F.g * dt);
        e.vx = e.suelo ? e.dir * e.vel : e.vx;
        const choco = J.moverX(w, e, e.vx * dt);
        e.suelo = false; e.sobre = null;
        J.moverY(w, e, e.vy * dt);
        if (choco) e.dir *= -1;
        if (e.suelo) {
          const fx = e.dir > 0 ? e.x + e.w + 0.05 : e.x - 0.05, t = w.get(Math.floor(fx), Math.floor(e.y + e.h + 0.1));
          const hayMovil = w.movers.some((m) => fx > m.x && fx < m.x + m.largo && Math.abs(m.y - (e.y + e.h)) < 0.3);
          if (!(SOL(t) || t === 2) && !hayMovil) e.dir *= -1;
          if (Math.abs(e.x - e.x0) > 14) e.dir = e.x > e.x0 ? -1 : 1;
        }
        if (e.y > w.alto) e.vivo = false;
      }
      if (!p.muriendo && solapa(p, e)) {
        if (p.estrella > 0) {   // estrella: todo enemigo que tocas cae
          e.muertoT = 0.001; J.Audio.sfx('pisoton'); J.chispas(g, (e.x + e.w / 2) * J.T, (e.y + e.h / 2) * J.T, 12, '#ffd166', 4);
          if (g.ui) g.ui.error(e);
        } else if (p.vy > (e.acuatico ? 0.3 : 0.5) && p.y + p.h - e.y < e.h * 0.65 && e.acuatico !== 'erizo') {
          e.muertoT = 0.001; p.vy = g.inp.salto ? -F.v0 * 0.95 : -F.v0 * 0.6; p.suelo = false; p.saltando = !!g.inp.salto; p.coyote = 0;
          J.Audio.sfx('pisoton'); J.chispas(g, (e.x + e.w / 2) * J.T, (e.y + e.h) * J.T, 10, '#ffffff', 3);
          if (g.ui) g.ui.error(e);
        } else { J.herir(g, e.x + e.w / 2); if (e.acuatico === 'erizo' && g.ui && p.inv > 1.7) g.ui.error(e); }
      }
    }
  }

  function pasoProyectiles(g, dt) {
    const p = g.jugador, w = g.w, F = g.F;
    for (const q of g.proy) {
      q.t += dt;
      if (q.tipo === 'marca') { if (q.t > q.dur) { q.muerto = true; if (q.luego) q.luego(); } continue; }
      if (q.tipo === 'bola') {
        q.vy += (q.grav || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (SOL(w.get(Math.floor(q.x), Math.floor(q.y + 0.2)))) { q.muerto = true; J.chispas(g, q.x * J.T, q.y * J.T, 8, '#ffb020', 3); }
        if (q.x < -2 || q.x > w.ancho + 2 || q.y > w.alto + 1) q.muerto = true;
        if (!q.muerto && !p.muriendo && Math.hypot(p.x + p.w / 2 - q.x, p.y + p.h / 2 - q.y) < 0.55) { q.muerto = true; J.herir(g, q.x); }
      } else if (q.tipo === 'bomba') {   // bomba del Rey Bomba: rebota, mecha de 2 s, explota (o se detona de un disparo)
        q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.fuse -= dt;
        if (SOL(w.get(Math.floor(q.x), Math.floor(q.y + 0.3))) && q.vy > 0) { q.y = Math.floor(q.y + 0.3) - 0.3; q.vy *= -0.35; q.vx *= 0.55; if (Math.abs(q.vy) < 1) q.vy = 0; }
        if (SOL(w.get(Math.floor(q.x + Math.sign(q.vx) * 0.35), Math.floor(q.y)))) q.vx = -q.vx * 0.5;
        if (q.fuse <= 0 || q.y > w.alto + 1) {
          q.muerto = true; g.shake = Math.max(g.shake, 5); J.Audio.sfx('onda'); J.chispas(g, q.x * J.T, q.y * J.T, 18, '#ffb020', 5);
          g.proy.push({ tipo: 'nova', x: q.x, y: q.y, rad: q.rad, t: 0, dur: 0.35, hecho: false, deBomba: true, disparada: !!q.disparada });
        }
      } else if (q.tipo === 'nova') {    // explosión: daña una vez al jugador dentro del radio (y al Rey Bomba si la causó un disparo)
        if (!q.hecho) {
          q.hecho = true;
          if (!p.muriendo && Math.hypot(p.x + p.w / 2 - q.x, p.y + p.h / 2 - q.y) < q.rad) J.herir(g, q.x);
          const b = g.jefe;
          if (q.deBomba && q.disparada && b && b.disp && Math.hypot(b.x + b.w / 2 - q.x, b.y + b.h / 2 - q.y) < q.rad + 1) { J.Jefe.danar(g, 3); }
        }
        if (q.t > q.dur) q.muerto = true;
      } else if (q.tipo === 'tinta') {   // nube de tinta de ácido (pulpo): lenta, grande, se disipa
        q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= Math.pow(0.985, dt * 60); q.vy *= Math.pow(0.985, dt * 60); q.vida -= dt;
        if (q.vida <= 0 || SOL(w.get(Math.floor(q.x), Math.floor(q.y)))) q.muerto = true;
        if (!q.muerto && !p.muriendo && Math.hypot(p.x + p.w / 2 - q.x, p.y + p.h / 2 - q.y) < q.r) { J.herir(g, q.x); }
      } else if (q.tipo === 'rayo') {   // rayo vertical con aviso (dragón)
        const act = q.t > q.aviso;
        if (act && !q.sono) { q.sono = true; J.Audio.sfx('onda'); g.shake = 5; }
        if (act && !p.muriendo && Math.abs(p.x + p.w / 2 - q.x) < 0.65 && q.t < q.aviso + 0.3) J.herir(g, q.x);
        if (q.t > q.aviso + 0.38) q.muerto = true;
      } else if (q.tipo === 'onda') {
        q.x += q.vx * dt; q.vida -= dt;
        const A = w.arena;
        if (q.vida <= 0 || (A && (q.x < A.izq + 1 || q.x > A.der))) q.muerto = true;
        const r = { x: q.x - 0.45, y: q.y - 0.7, w: 0.9, h: 0.7 };
        if (!q.muerto && !p.muriendo && solapa(p, r)) { J.herir(g, q.x); }
        if (!q.muerto && Math.random() < 0.5) J.chispas(g, q.x * J.T, q.y * J.T - 2, 1, '#ffd166', 1.5);
      }
    }
    g.proy = g.proy.filter((q) => !q.muerto);
  }

  function pasoCamara(g, dt) {
    const w = g.w, p = g.jugador, T = J.T, cam = g.cam;
    let objX = (p.x + p.w / 2) * T - J.VW / 2 + p.dir * 28;
    const A = w.arena;
    if (A && A.activa && !A.derrotado) objX = ((A.izq + A.der) / 2) * T - J.VW / 2 + 8;
    objX = J.clamp(objX, 0, Math.max(0, w.ancho * T - J.VW));
    let objY = w.alto * T - J.VH;
    if (w.alto * T > J.VH) objY = J.clamp((p.y + p.h / 2) * T - J.VH / 2 + 10, 0, w.alto * T - J.VH);
    const sp = g.sprintActivo;
    if (sp) {   // sprint: la cámara avanza sola y empuja al jugador
      objX = J.clamp(sp.cam * T, 0, Math.max(0, w.ancho * T - J.VW)); cam.x = objX;
      cam.y += (objY - cam.y) * (1 - Math.pow(1 - 0.1, dt * 60)); return;
    }
    if (g.snapCamara) { cam.x = objX; cam.y = objY; g.snapCamara = false; return; }
    const k = 1 - Math.pow(1 - 0.1, dt * 60);
    cam.x += (objX - cam.x) * k; cam.y += (objY - cam.y) * k;
  }

  /** Un paso de simulación de dt segundos. */
  J.paso = function (g, dt) {
    if (g.estado !== 'jugando' && g.estado !== 'victoria') return;
    pasoMundo(g, dt);
  };
  J.pasoCamara = pasoCamara;
})();
