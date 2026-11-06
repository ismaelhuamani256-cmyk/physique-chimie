// NIVEL 4 «Parkour extremo» (<cap>--4) y NIVEL 5 «Batalla final» (<cap>--5) por capítulo.
//  --4  carrera de obstáculos: pilares y islotes sobre lava, plataformas que caen y móviles, sierras, láseres, cañones,
//       géiseres, viento, magma saltarín. Pocos descansos (checkpoint + cápsula). Sin jefe: meta al final.
//  --5  persecución (muro que te mata, tramo sprint) + arena con bombardeo de meteoritos, tormenta y lluvia de rocas
//       y un jefe en modo difícil (5 preguntas, furia +2). Jefe según el capítulo.
// Uso: node tools/niveles-parkour.js [capitulo…]
const fs = require('fs'), path = require('path'), V = require('../js/juego/validador.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles');
const hash = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const JEFE = {
  rey_bomba: ['methodes-chimiques', 'thermodynamique', 'gaz-parfait', 'ondulatoires'], maestro_calavera: ['forcer-sens', 'force-acides-bases', 'sens-evolution', 'description-mouvement'],
  pozo_gravitatorio: ['champ-gravitation', 'images', 'champ-uniforme', 'systeme-electrique'], yeti_criogenico: ['newton-2', 'ecoulement-fluide', 'evolution-temporelle', 'acide-base'],
  bombardero_neutron: ['nucleaires'], foton_veloz: ['photons'], isotopo_inestable: ['methodes-physiques', 'synthese-organique'],
};
const jefeDe = (id) => Object.keys(JEFE).find((k) => JEFE[k].includes(id)) || 'rey_bomba';

function base(o, id, tipo, seed) {
  const rnd = rng(hash(id + '|' + tipo + '|' + seed)), ALTO = 18, GY = 14, S = [];
  const cols = o.segmentos.filter((s) => s.tipo === 'coleccionable').slice(0, 10), enes = o.segmentos.filter((s) => s.tipo === 'enemigo');
  const jefe0 = o.segmentos.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz'), cartel = o.segmentos.find((s) => s.tipo === 'cartel');
  const C = { rnd, ALTO, GY, S, cols, enes, jefe0, cartel, X: 0, k: 0, e: 0, descansos: [], sup: [] };
  const R = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  C.R = R;
  C.suelo = (x, w, h) => { const y = GY - h; S.push(h <= 2 ? { tipo: 'plataforma', x, y, largo: w } : { tipo: 'plataforma', x, y, largo: w, grosor: ALTO - y }); C.sup.push({ x, w, y }); };
  C.foso = (x, w) => { S.push({ tipo: 'foso', x, largo: w }); S.push({ tipo: 'magma', x: x + Math.floor(w / 2), y: ALTO - 1, altura: R(6, 8), periodo: +(2.6 + rnd() * 1.4).toFixed(1), retardo: +(rnd() * 3).toFixed(1) }); };
  C.col = (x, y) => { if (C.k < cols.length) S.push(Object.assign({}, cols[C.k++], { x, y })); };
  C.enemigo = (x, y) => { if (enes.length) S.push(Object.assign({}, enes[C.e++ % enes.length], { x, y })); };
  C.descanso = (cap) => {   // 7 tiles de suelo llano con checkpoint, un enemigo/fórmula y a veces una cápsula
    const x0 = C.X; C.suelo(x0, 8, 0); S.push({ tipo: 'checkpoint', x: x0 + 1 }); C.enemigo(x0 + 5, GY - 1); C.col(x0 + 3, GY - 2);
    if (cap) S.push({ tipo: 'item', x: x0 + 3, y: GY - 2, item: cap }); C.X += 8; C.descansos.push(x0);
  };
  // ---- piezas ----
  C.islotes = (n, maxd) => { let hp = 0; for (let i = 0; i < n; i++) { const h = Math.max(0, Math.min(2, hp + R(-2, 1))), g = h > hp ? 3 : R(3, 4); hp = h; C.foso(C.X, g); C.X += g; C.suelo(C.X, 2, h); if (i % 2 === 0) C.col(C.X, GY - h - 2); C.X += 2; } };
  C.pilares = (n, subeMax) => {
    let h = 0; for (let i = 0; i < n; i++) { const r = Math.max(-3, Math.min(Math.min(2, subeMax), R(-3, 2))), hn = Math.max(0, Math.min(4, h + r)), g = hn > h ? 3 : R(3, 4); C.foso(C.X, g); C.X += g; C.suelo(C.X, 2, hn); h = hn; if (i % 3 === 1) C.col(C.X, GY - hn - 2); C.X += 2; }
    C.foso(C.X, 3); C.X += 3; C.suelo(C.X, 2, 0); C.X += 2;
  };
  C.caen = (n) => { for (let i = 0; i < n; i++) { C.foso(C.X, 2); C.X += 2; S.push({ tipo: 'plataforma_cae', x: C.X, y: GY, largo: 2, retardo: 0.5, reaparece: 4 }); C.X += 2; C.foso(C.X, 2); C.X += 2; C.suelo(C.X, 2, 0); C.X += 2; } };
  C.moviles = () => { C.foso(C.X, 5); S.push({ tipo: 'plataforma_movil', x: C.X, y: GY, largo: 3, recorrido: 5, eje: 'x', periodo: +(4 + rnd()).toFixed(1) }); C.X += 5; C.suelo(C.X, 2, 0); C.X += 2; C.foso(C.X, 5); S.push({ tipo: 'plataforma_movil', x: C.X, y: GY, largo: 3, recorrido: 5, eje: 'x', periodo: +(4.5 + rnd()).toFixed(1) }); C.X += 5; C.suelo(C.X, 3, 0); C.X += 3; };
  C.sierras = (n) => { const x0 = C.X, L = n * 5 + 4; C.suelo(x0, L, 0); for (let i = 0; i < n; i++) S.push({ tipo: 'sierra', x: x0 + 4 + i * 5, y: GY - 1, eje: 'x', recorrido: 3, periodo: +(2.4 + rnd()).toFixed(1) }); C.col(x0 + L - 2, GY - 3); C.X += L; };
  C.lasers = (n) => { const x0 = C.X, L = n * 6 + 4; C.suelo(x0, L, 0); for (let i = 0; i < n; i++) S.push({ tipo: 'laser', x: x0 + 4 + i * 6, y: GY - 4, eje: 'v', largo: 4, periodo: +(2.8 + rnd()).toFixed(1), retardo: +(rnd() * 2).toFixed(1) }); C.X += L; };
  C.canones = () => { const x0 = C.X, L = 22; C.suelo(x0, L, 0); S.push({ tipo: 'canon_bala', x: x0, y: GY - 1, dir: 1, periodo: 3.2, retardo: 0.4 }); S.push({ tipo: 'canon_bala', x: x0 + 3, y: GY - 3, dir: 1, periodo: 3.6, retardo: 1.4 }); S.push({ tipo: 'sierra', x: x0 + 14, y: GY - 1, eje: 'x', recorrido: 3, periodo: 2.6 }); C.col(x0 + 19, GY - 2); C.X += L; };
  C.geiseres = () => { const x0 = C.X, L = 20; C.suelo(x0, L, 0); for (let i = 0; i < 3; i++) S.push({ tipo: 'geiser', x: x0 + 4 + i * 6, y: GY, alto: 5, periodo: 3.6, retardo: +(i * 1.1).toFixed(1) }); C.X += L; };
  C.viento = (x0, w) => S.push({ tipo: 'zona_campo', x: x0, y: 0, w, h: ALTO, fx: -0.45, fy: 0 });
  C.rellenar = () => {   // asegura >= 5 fórmulas y >= 4 enemigos del capítulo
    const grandes = C.sup.filter((s) => s.w >= 2 && s.x > 15);
    let g = 0; while (grandes.length && C.k < cols.length && g++ < 40) { const s = grandes[Math.floor(rnd() * grandes.length)]; C.col(s.x + Math.floor(rnd() * s.w), s.y - 2); }
    const anchas = C.sup.filter((s) => s.w >= 6 && s.x > 15); g = 0; while (C.e < 4 && g++ < 40 && anchas.length) { const s = anchas[Math.floor(rnd() * anchas.length)]; C.enemigo(s.x + 1 + Math.floor(rnd() * (s.w - 2)), s.y - 1); }
  };
  C.cierre = (N) => { const x = C.X; S.push({ tipo: 'meta', x: x + 4 }); C.suelo(x, 8, 0); C.X += 8; return Object.assign({}, o, { ancho_tiles: C.X + 6, alto_tiles: ALTO, segmentos: S, tipo_nivel: 'normal', relieve: true, aire: true, peligros: true, extra: tipo }, N || {}); };
  return C;
}
function parkour(o, id, seed) {
  const C = base(o, id, 'p4', seed), { S, rnd } = C;
  C.suelo(0, 14, 0); C.X = 14; if (C.cartel) S.push(Object.assign({}, C.cartel, { x: 5, y: C.GY - 1 }));
  const piezas = [() => C.islotes(C.R(4, 6)), () => C.pilares(C.R(5, 7), 3), () => C.caen(C.R(2, 3)), () => C.moviles(), () => C.sierras(C.R(3, 4)), () => C.lasers(C.R(3, 4)), () => C.canones(), () => C.geiseres()];
  const orden = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => rnd() - 0.5), caps = ['doble', 'luna', 'escudo', 'fuego'];
  orden.forEach((pi, i) => { const a = C.X; piezas[pi](); if (pi === 1 || pi === 0) C.viento(a, C.X - a); if (i % 2 === 1) C.descanso(caps[(i >> 1) % caps.length]); });
  C.suelo(C.X, 1, 0); C.X += 1; C.rellenar();
  const N = C.cierre({ nombre_fase: (o.nombre_fase ? o.nombre_fase.replace(/\s*·.*$/, '') + ' · ' : '') + 'Parkour extremo' });
  // enemigos en el aire para más presión
  S.push({ tipo: 'fauna', especie: 'espectro', x: Math.floor(C.X * 0.3), y: 8 }, { tipo: 'fauna', especie: 'mago', x: Math.floor(C.X * 0.55), y: 7 }, { tipo: 'fauna', especie: 'espectro', x: Math.floor(C.X * 0.8), y: 8 });
  return N;
}
function batalla(o, id, seed) {
  const C = base(o, id, 'p5', seed), { S, rnd, GY } = C;
  C.suelo(0, 14, 0); C.X = 14; if (C.cartel) S.push(Object.assign({}, C.cartel, { x: 5, y: GY - 1 }));
  const ini = C.X; const piezas = [() => C.islotes(C.R(4, 5)), () => C.sierras(3), () => C.canones(), () => C.lasers(3), () => C.pilares(4, 2), () => C.geiseres(), () => C.islotes(4)];
  const orden = [0, 1, 2, 3, 4, 5, 6].sort(() => rnd() - 0.5).slice(0, 5);
  orden.forEach((pi, i) => { piezas[pi](); if (i === 1 || i === 3) { const x0 = C.X; C.suelo(x0, 6, 0); S.push({ tipo: 'checkpoint', x: x0 + 1 }); C.X += 6; } });
  C.suelo(C.X, 1, 0); C.X += 1; C.rellenar();
  const fin = C.X;   // el sprint termina aquí
  const x0 = C.X; C.suelo(x0, 12, 0); S.push({ tipo: 'checkpoint', x: x0 + 2 }); ['escopeta', 'fuego', 'grande'].forEach((it, i) => S.push({ tipo: 'item', x: x0 + 3 + i * 2, y: GY - 2, item: it })); S.push({ tipo: 'item', x: x0 + 9, y: GY - 2, item: 'vida' });
  C.X += 12; C.enemigo(x0 + 6, GY - 1);
  const Xa = C.X; S.push({ tipo: 'plataforma', x: Xa, y: GY, largo: 42 });
  S.push({ tipo: 'sprint', x_ini: ini, x_fin: fin, velocidad: 4.1, perseguidor: jefeDe(id) });
  // jefe en modo difícil + eventos del entorno
  const jid = jefeDe(id), j0 = C.jefe0, jefe = Object.assign({}, j0, { x: Xa + 17, jefe: jid, vidas: 5, furia: 2 });
  if (jefe.tipo === 'jefe_quiz') jefe.tipo = 'jefe';
  if (!jefe.preguntas && Array.isArray(jefe.fases)) jefe.preguntas = jefe.fases.flatMap((f) => f.preguntas || []); delete jefe.fases;
  const NJ = { rey_bomba: 'Rey Bomba', maestro_calavera: 'Maestro Calavera', pozo_gravitatorio: 'Pozo Gravitatorio', yeti_criogenico: 'Yeti Criogénico', bombardero_neutron: 'Bombardero Neutrón', foton_veloz: 'Fotón Veloz', isotopo_inestable: 'Isótopo Inestable' };
  jefe.titulo = 'BATALLA FINAL · ' + NJ[jid];
  S.push(jefe); S.push({ tipo: 'meta', x: Xa + 36 });
  S.push({ tipo: 'meteoros', x: Xa + 4, w: 36, periodo: 1.3 }, { tipo: 'tormenta', x: Xa + 4, w: 36, periodo: 2.0 }, { tipo: 'lluvia_rocas', x: Xa + 6, w: 30, periodo: 2.1 });
  const N = Object.assign({}, o, { ancho_tiles: Xa + 42, alto_tiles: 18, segmentos: S, tipo_nivel: 'normal', relieve: true, aire: true, peligros: true, extra: 'batalla', nombre_fase: (o.nombre_fase ? o.nombre_fase.replace(/\s*·.*$/, '') + ' · ' : '') + 'Batalla final' });
  if (jid === 'yeti_criogenico') { /* pista de hielo en la arena la pone el jefe */ }
  return N;
}
const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.includes('--') && f[0] !== '_').map((f) => f.replace('.json', ''));
for (const id of ids) {
  const o = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
  for (const [suf, fn] of [['--4', parkour], ['--5', batalla]]) {
    let ok = null, err = [];
    for (let seed = 0; seed < 60 && !ok; seed++) { const n = fn(o, id, seed), r = V.validar(n); if (!r.errores.length) ok = n; else err = r.errores; }
    if (ok) { fs.writeFileSync(path.join(dir, id + suf + '.json'), JSON.stringify(ok, null, 1) + '\n'); console.log('✔', id + suf, ok.ancho_tiles + '×' + ok.alto_tiles, ok.segmentos.length); } else console.log('✖', id + suf, err.slice(0, 3));
  }
}
