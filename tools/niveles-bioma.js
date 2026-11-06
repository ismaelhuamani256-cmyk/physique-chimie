// NIVELES EXTRA 3 (contenido/niveles/<cap>--3.json): un nivel por capítulo con los peligros de su BIOMA (js/juego/53-bioma.js).
//  lab      matraces, tuberías de gas, cintas · cueva  murciélagos, charcos de ácido, cristales que revelan plataformas
//  nube     nubes que se deshacen, tormenta, viento · espacio  gravedad invertida, asteroides, meteoritos
//  hielo    suelo resbaladizo, bolas de nieve, estalactitas · horno  yunques, vapor, cadenas
//  campo    tornados, espantapájaros, trampolines de heno · castillo  fantasmas, tablones, espejos
// Jefes: Pozo Gravitatorio (invierte la gravedad), Yeti Criogénico (pista de hielo), Maestro Calavera, Rey Bomba o el Gran Ejercicio.
const fs = require('fs'), path = require('path'), V = require('../js/juego/validador.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles');
const hash = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const JEFE = { 'champ-gravitation': 'pozo_gravitatorio', images: 'pozo_gravitatorio', photons: 'pozo_gravitatorio', 'newton-2': 'yeti_criogenico', 'ecoulement-fluide': 'yeti_criogenico', nucleaires: 'yeti_criogenico' };
const JEFE_AMB = { lab: 'rey_bomba', cueva: 'maestro_calavera', castillo: 'maestro_calavera', horno: 'rey_bomba', campo: 'ejercicio_bac_1', nube: 'pozo_gravitatorio', espacio: 'pozo_gravitatorio', hielo: 'yeti_criogenico' };
const NOMBRE = { lab: 'El laboratorio inestable', cueva: 'La cueva de cristal', nube: 'La tormenta de nubes', espacio: 'El campo de asteroides', hielo: 'La ventisca', horno: 'La forja de vapor', campo: 'El campo de tornados', castillo: 'El castillo encantado' };

function construir(o, id, seed) {
  const amb = o.ambiente || 'lab', rnd = rng(hash(id + '|bio|' + seed)), ALTO = 18, GY = ALTO - 4, S = [], sup = [], huecos = [];
  const cols = o.segmentos.filter((s) => s.tipo === 'coleccionable').slice(0, 10), enes = o.segmentos.filter((s) => s.tipo === 'enemigo');
  const jefe0 = o.segmentos.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz'), cartel = o.segmentos.find((s) => s.tipo === 'cartel');
  const piso = (x, w, h) => { const y = GY - h; S.push(h <= 2 ? { tipo: 'plataforma', x, y, largo: w } : { tipo: 'plataforma', x, y, largo: w, grosor: ALTO - y }); sup.push({ x, w, y }); };
  piso(0, 12, 0); let X = 12, h = 0;
  const nCol = 20;
  for (let i = 0; i < nCol; i++) {
    const w = 6 + Math.floor(rnd() * 3), objetivo = i < nCol - 3 ? clamp(h + Math.floor(rnd() * 5) - 2, 0, 3) : 0;
    if (i > 2 && i % 5 === 3) { const gp = 2 + Math.floor(rnd() * 2); S.push({ tipo: 'foso', x: X, largo: gp }); huecos.push({ x: X, w: gp, y: GY - h }); X += gp; }
    const hn = Math.min(objetivo, h + 2); piso(X, w, hn); h = hn; X += w;
  }
  piso(X, 4, 0); X += 4;
  const Xe = X; S.push({ tipo: 'plataforma', x: Xe, y: GY, largo: 38 });
  const jid = JEFE[id] || JEFE_AMB[amb];
  const jefe = Object.assign({}, jefe0, { x: Xe + 17, jefe: jid }); if (jefe.tipo === 'jefe_quiz') jefe.tipo = 'jefe';
  if (!jefe.preguntas && Array.isArray(jefe.fases)) jefe.preguntas = jefe.fases.flatMap((f) => f.preguntas || []); delete jefe.fases; delete jefe.vidas;
  jefe.titulo = (jefe.titulo || '').replace(/^Ejercicio BAC/i, { rey_bomba: 'Rey Bomba', maestro_calavera: 'Maestro Calavera', pozo_gravitatorio: 'Pozo Gravitatorio', yeti_criogenico: 'Yeti Criogénico' }[jid] || 'Ejercicio BAC');
  S.push(jefe); S.push({ tipo: 'meta', x: Xe + 32 });
  const ancho = Xe + 38;
  const util = sup.filter((s) => s.x >= 14 && s.x + s.w < Xe && s.w >= 5);
  const usados = [];
  const libre = (x, r) => usados.every((q) => Math.abs(q - x) > r);
  const poner = (x, r) => { if (!libre(x, r || 2)) return false; usados.push(x); return true; };
  if (cartel) S.push(Object.assign({}, cartel, { x: 5, y: GY - 1 }));
  let k = 0; for (const s of util.slice().sort(() => rnd() - 0.5)) { if (k >= cols.length) break; const x = Math.floor(s.x + s.w / 2) + 1; S.push(Object.assign({}, cols[k++], { x, y: s.y - 2 })); poner(x, 0); }
  let e = 0; util.forEach((s, i) => { if (i % 3 === 1 && enes.length) { const x = Math.floor(s.x + 2); S.push(Object.assign({}, enes[e++ % enes.length], { x, y: s.y - 1 })); } });
  [util[Math.floor(util.length * 0.4)], util[Math.floor(util.length * 0.75)]].filter(Boolean).forEach((s) => S.push({ tipo: 'checkpoint', x: Math.floor(s.x + 1) }));
  const cap = (item, i) => { const s = util[Math.min(util.length - 1, i)]; if (s) S.push({ tipo: 'item', x: Math.floor(s.x + 1), y: s.y - 2, item }); };
  const F = (esp, x, y) => S.push({ tipo: 'fauna', especie: esp, x, y });
  const ext = (s, d) => Math.floor(s.x + d);
  // ---- peligros del bioma ----
  if (amb === 'lab') {
    util.forEach((s, i) => {
      if (i % 3 === 0) S.push({ tipo: 'matraz', x: ext(s, s.w - 2), y: s.y - 1 }), S.push({ tipo: 'matraz', x: ext(s, s.w - 3), y: s.y - 1 });
      if (i % 4 === 2) S.push({ tipo: 'ventila', x: ext(s, 2), y: s.y, alto: 6, periodo: 3.4 + rnd(), retardo: rnd() * 2 });
      if (i % 5 === 4 && s.w >= 6) S.push({ tipo: 'cinta', x: ext(s, 1), y: s.y, largo: s.w - 2, velocidad: (i % 2 ? 1 : -1) * 1.8 });
    });
    cap('escopeta', 3); cap('fuego', 8); cap('doble', 11);
  } else if (amb === 'cueva') {
    S.push({ tipo: 'plataforma', x: 14, y: 0, largo: Xe - 16, grosor: 3, techo: true });
    util.forEach((s, i) => {
      if (i % 2 === 0) S.push({ tipo: 'murcielago', x: ext(s, s.w / 2), y: 3 });
      if (i % 4 === 1 && s.w >= 6) S.push({ tipo: 'charco', x: ext(s, 2), y: s.y - 1, largo: 3 });
      if (i % 5 === 2) { S.push({ tipo: 'cristal', x: ext(s, 1), y: s.y - 2 }); S.push({ tipo: 'bloque_onoff', x: ext(s, 3), y: s.y - 4, largo: 3, alto: 1, grupo: 'cristal' }); S.push({ tipo: 'bloque_onoff', x: ext(s, s.w - 2), y: s.y - 7, largo: 2, alto: 1, grupo: 'cristal' }); }
    });
    cap('hielo', 4); cap('fuego', 9);
  } else if (amb === 'nube') {
    S.push({ tipo: 'tormenta', x: 20, w: Xe - 24, periodo: 2.0 }); S.push({ tipo: 'zona_campo', x: 20, y: 0, w: Xe - 22, h: ALTO, fx: 0.5, fy: 0 });
    util.forEach((s, i) => { if (i % 2 === 0) { S.push({ tipo: 'nube', x: ext(s, 1), y: s.y - 4, largo: 3 }); S.push({ tipo: 'nube', x: ext(s, s.w - 4), y: s.y - 7, largo: 3 }); } });
    huecos.forEach((hp) => S.push({ tipo: 'nube', x: hp.x, y: hp.y, largo: hp.w }));
    cap('doble', 3); cap('luna', 7); cap('escopeta', 11);
  } else if (amb === 'espacio') {
    S.push({ tipo: 'meteoros', x: 20, w: Xe - 24, periodo: 1.7 });
    util.forEach((s, i) => { if (i % 3 === 1) S.push({ tipo: 'zona_campo', x: ext(s, 1), y: 2, w: 5, h: GY - 1, fx: 0, fy: -2.2 }); if (i % 3 === 2) S.push({ tipo: 'asteroide', x: ext(s, s.w / 2), y: s.y - 5, recorrido: 3, periodo: 5 + i % 3 }); });
    cap('luna', 3); cap('fuego', 8);
  } else if (amb === 'hielo') {
    S.push({ tipo: 'plataforma', x: 14, y: 0, largo: Xe - 16, grosor: 2, techo: true });
    util.forEach((s, i) => { S.push({ tipo: 'zona_hielo', x: s.x, y: s.y, w: s.w }); if (i % 3 === 1) S.push({ tipo: 'bola_nieve', x: ext(s, s.w / 2), y: s.y - 1 }); if (i % 2 === 0) S.push({ tipo: 'estalactita', x: ext(s, 3) }); });
    cap('fuego', 3); cap('grande', 8);
  } else if (amb === 'horno') {
    util.forEach((s, i) => {
      if (i % 2 === 0) S.push({ tipo: 'yunque', x: ext(s, 3), y: 2, periodo: 2.4 });
      if (i % 3 === 1) S.push({ tipo: 'vapor', x: ext(s, 1), y: s.y - 1, dir: 'u', largo: 4, periodo: 3 + rnd(), retardo: rnd() * 2 });
    });
    huecos.forEach((hp) => S.push({ tipo: 'cadena', x: hp.x + 1, y: 4, largo: 8 }));
    cap('escopeta', 4); cap('fuego', 9); cap('hielo', 12);
  } else if (amb === 'campo') {
    util.forEach((s, i) => {
      if (i % 3 === 0) S.push({ tipo: 'tornado', x: ext(s, 1), y: s.y, recorrido: s.w - 4, periodo: 8, alto: 7 });
      if (i % 3 === 1) S.push({ tipo: 'espantapajaros', x: ext(s, s.w - 2), y: s.y - 1 });
      if (i % 4 === 2) S.push({ tipo: 'trampolin', x: ext(s, 2), y: s.y - 1 });
    });
    cap('doble', 2); cap('fuego', 7);
  } else if (amb === 'castillo') {
    util.forEach((s, i) => { if (i % 2 === 0) S.push({ tipo: 'fantasma', x: ext(s, s.w / 2), y: s.y - 3 }); if (i % 4 === 1) { S.push({ tipo: 'espejo', x: ext(s, 3), y: s.y - 5, alto: 5 }); S.push({ tipo: 'torreta', x: ext(s, s.w - 2), y: s.y - 1, periodo: 2.8, nombre: (enes[0] || {}).nombre || 'Error', correccion: (enes[0] || {}).correccion || '' }); } });
    huecos.forEach((hp) => S.push({ tipo: 'tablon', x: hp.x, y: hp.y, largo: hp.w }));
    cap('escopeta', 3); cap('grande', 8);
  }
  const N = Object.assign({}, o, { ancho_tiles: ancho, alto_tiles: ALTO, segmentos: S, nombre_fase: (o.nombre_fase ? o.nombre_fase.replace(/\s*·.*$/, '') + ' · ' : '') + NOMBRE[amb], extra: 'bioma-' + amb, tipo_nivel: 'normal' });
  delete N.vertical; delete N.cueva; delete N.lava_parkour; N.relieve = N.aire = N.peligros = true;
  if (amb === 'espacio') N.fisica_juego = Object.assign({}, N.fisica_juego, { gravedad: Math.max(0.7, (N.fisica_juego || {}).gravedad || 1) });
  return N;
}
const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.includes('--') && f[0] !== '_').map((f) => f.replace('.json', ''));
for (const id of ids) {
  const o = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
  let ok = null, err = [];
  for (let seed = 0; seed < 30 && !ok; seed++) { const n = construir(o, id, seed), r = V.validar(n); if (!r.errores.length) ok = n; else err = r.errores; }
  if (ok) { fs.writeFileSync(path.join(dir, id + '--3.json'), JSON.stringify(ok, null, 1) + '\n'); console.log('✔', id, ok.extra, ok.segmentos.length); } else console.log('✖', id, err.slice(0, 3));
}
