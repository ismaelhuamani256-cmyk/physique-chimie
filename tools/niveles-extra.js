// NIVELES EXTRA: crea un 2.º nivel por capítulo (contenido/niveles/<cap>--2.json) con un arquetipo según el bioma.
// Se encadenan solos tras ganar el nivel principal (js/core.js, PCB.flow.finNivel). Reutilizan del nivel original las fórmulas,
// los errores (enemigos), las preguntas del jefe, el tema visual y la física.
//   montana     colinas de hasta 9 tiles, cabras locas, flores de hielo, botas de doble salto/gravedad lunar
//   granja      colinas suaves, vacas (al pisarlas aparece un OVNI que te abduce), flores y cabras
//   martilleros terreno escalonado con mecánicos lanzallaves en plataformas altas (Rey Bomba al final)
//   laberinto   salas con techo, puertas con llave y alcobas con la llave (Maestro Calavera al final)
//   onoff       interruptores ON/OFF: muros y cañones que solo existen en un estado
// Uso: node tools/niveles-extra.js [capitulo…]
const fs = require('fs'), path = require('path'), V = require('../js/juego/validador.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles');
const hash = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const PLAN = {
  'acide-base': 'onoff', 'champ-gravitation': 'granja', 'champ-uniforme': 'montana', 'description-mouvement': 'martilleros', 'ecoulement-fluide': 'laberinto',
  'evolution-temporelle': 'laberinto', 'force-acides-bases': 'onoff', 'forcer-sens': 'laberinto', 'gaz-parfait': 'martilleros', 'images': 'granja',
  'methodes-chimiques': 'martilleros', 'methodes-physiques': 'onoff', 'newton-2': 'montana', 'nucleaires': 'onoff', 'ondulatoires': 'martilleros',
  'photons': 'granja', 'sens-evolution': 'laberinto', 'synthese-organique': 'montana', 'systeme-electrique': 'onoff', 'thermodynamique': 'martilleros',
};
const JEFE_ARQ = { montana: 'ejercicio_bac_1', granja: 'ejercicio_bac_1', martilleros: 'rey_bomba', laberinto: 'maestro_calavera', onoff: 'rey_bomba' };
const NOMBRE_ARQ = { montana: 'Las montañas', granja: 'La granja del OVNI', martilleros: 'La fundición', laberinto: 'El laberinto de llaves', onoff: 'El circuito ON/OFF' };

function construir(o, arq, seed) {
  const rnd = rng(hash(o.capitulo_id + '|extra|' + seed)), ALTO = arq === 'montana' ? 24 : 18, GY = ALTO - 4;
  const S = [], sup = [];                                   // sup: superficies pisables {x,w,y}
  const cols = o.segmentos.filter((s) => s.tipo === 'coleccionable').slice(0, 10), enes = o.segmentos.filter((s) => s.tipo === 'enemigo');
  const jefe0 = o.segmentos.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz'), cartel = o.segmentos.find((s) => s.tipo === 'cartel');
  const piso = (x, w, h) => { const y = GY - h; S.push(h <= 2 ? { tipo: 'plataforma', x, y, largo: w } : { tipo: 'plataforma', x, y, largo: w, grosor: ALTO - y }); sup.push({ x, w, y }); };
  let X = 0;
  const huecos = [];
  // ---------- terreno ----------
  if (arq === 'montana' || arq === 'granja' || arq === 'martilleros') {
    const amp = arq === 'montana' ? 9 : arq === 'martilleros' ? 4 : 2, nCol = arq === 'montana' ? 22 : 18;
    piso(0, 12, 0); X = 12; let h = 0;
    for (let i = 0; i < nCol; i++) {
      const w = (arq === 'granja' ? 6 : 4) + Math.floor(rnd() * 3);
      let paso = Math.floor(rnd() * 7) - 3; if (arq !== 'montana') paso = clamp(paso, -2, 2);
      const objetivo = i < nCol - 3 ? clamp(h + paso + (i % 5 === 4 ? 2 : 0), 0, amp) : 0;
      if (i > 2 && i % 6 === 3 && h <= amp - 1) { const g = 2 + Math.floor(rnd() * 2); S.push({ tipo: 'foso', x: X, largo: g }); huecos.push(X); X += g; }   // un hueco con lava/vacío
      const hn = Math.min(objetivo, h + 3);
      piso(X, w, hn); h = hn; X += w;
    }
    piso(X, 4, 0); X += 4;
  } else if (arq === 'laberinto') {
    piso(0, 12, 0); X = 12;
    const salas = 4;
    for (let k = 0; k < salas; k++) {
      const x0 = X, L = 24;
      piso(x0, L, 0);
      // alcoba con la llave: escalera de 3 plataformas hasta una repisa alta
      S.push({ tipo: 'plataforma', x: x0 + 3, y: GY - 3, largo: 3 }); S.push({ tipo: 'plataforma', x: x0 + 7, y: GY - 6, largo: 3 }); S.push({ tipo: 'plataforma', x: x0 + 11, y: GY - 9, largo: 4 });
      sup.push({ x: x0 + 3, w: 3, y: GY - 3 }, { x: x0 + 7, w: 3, y: GY - 6 }, { x: x0 + 11, w: 4, y: GY - 9 });
      S.push({ tipo: 'llave', x: x0 + 13, y: GY - 11, id: 'k' + k });
      S.push({ tipo: 'puerta', x: x0 + L - 2, y: GY - 6, alto: 6, llave: 'k' + k });
      S.push({ tipo: 'plataforma', x: x0, y: 0, largo: L, grosor: 2, techo: true });   // techo de la sala
      X += L;
    }
    S.push({ tipo: 'plataforma', x: 12, y: 0, largo: 1, grosor: 1, techo: true });
    piso(X, 6, 0); X += 6;
  } else if (arq === 'onoff') {
    piso(0, 14, 0); X = 14;
    const secs = 4;
    for (let k = 0; k < secs; k++) {
      const x0 = X, L = 26, esON = k % 2 === 0;   // muro que solo existe en el estado actual del tramo
      piso(x0, L, 0); sup.pop(); sup.push({ x: x0 + 3, w: 4, y: GY }, { x: x0 + 17, w: 4, y: GY }, { x: x0 + 10, w: 3, y: GY });
      // cañones que disparan en el estado en que estás (callan al accionar el interruptor)
      const cs = esON ? 'on' : 'off';
      S.push({ tipo: 'canon_bala', x: x0 + 1, y: GY - 2, dir: 1, periodo: 3.4, retardo: 0.5, onoff: cs }); S.push({ tipo: 'canon_bala', x: x0 + 12, y: GY - 1, dir: -1, periodo: 3.9, retardo: 1.6, onoff: cs });
      S.push({ tipo: 'interruptor_onoff', x: x0 + 8, y: GY - 1 });
      S.push({ tipo: 'bloque_onoff', x: x0 + 22, y: GY - 5, largo: 2, alto: 5, grupo: esON ? 'on' : 'off' });
      // plataformas ON/OFF opcionales con fórmulas (flotan en el estado contrario)
      S.push({ tipo: 'bloque_onoff', x: x0 + 14, y: GY - 4, largo: 3, alto: 1, grupo: esON ? 'off' : 'on' });
      X += L;
    }
    piso(X, 6, 0); X += 6;
  }
  // ---------- arena del jefe ----------
  const Xe = X;
  S.push({ tipo: 'plataforma', x: Xe, y: GY, largo: 38 });
  const jefe = Object.assign({}, jefe0, { x: Xe + 17, jefe: JEFE_ARQ[arq] });
  if (!jefe.preguntas && Array.isArray(jefe.fases)) jefe.preguntas = jefe.fases.flatMap((f) => f.preguntas || []);
  delete jefe.fases; delete jefe.vidas;
  if (jefe.tipo === 'jefe_quiz') jefe.tipo = 'jefe';
  if (jefe.titulo) jefe.titulo = jefe.titulo.replace(/^Ejercicio BAC/i, JEFE_ARQ[arq] === 'rey_bomba' ? 'Rey Bomba' : JEFE_ARQ[arq] === 'maestro_calavera' ? 'Maestro Calavera' : 'Ejercicio BAC');
  S.push(jefe); S.push({ tipo: 'meta', x: Xe + 32 });
  const ancho = Xe + 38;
  // ---------- población común ----------
  const util = sup.filter((s) => s.x >= 14 && s.x + s.w < Xe && s.w >= 3);
  const slots = [];   // x centrales libres
  const libreX = (x, r) => slots.every((q) => Math.abs(q - x) > r);
  const poner = (s, fn, r) => { const x = Math.floor(s.x + s.w / 2); if (!libreX(x, r || 2)) return false; slots.push(x); fn(x, s); return true; };
  if (cartel) S.push(Object.assign({}, cartel, { x: 5, y: GY - 1 }));
  // fórmulas sobre superficies elevadas o repartidas
  let k = 0; const orden = util.slice().sort(() => rnd() - 0.5);
  for (const s of orden) { if (k >= cols.length) break; const x = Math.floor(s.x + s.w / 2) + (s.w > 5 ? 1 : 0); S.push(Object.assign({}, cols[k++], { x, y: s.y - 2 })); }
  let e = 0; for (const s of util.filter((_, i) => i % 3 === 1)) { if (!enes.length) break; poner(s, (x) => S.push(Object.assign({}, enes[e++ % enes.length], { x, y: s.y - 1 })), 3); }
  // checkpoints (pocos)
  const cp = [util[Math.floor(util.length * 0.38)], util[Math.floor(util.length * 0.72)]].filter(Boolean);
  cp.forEach((s) => S.push({ tipo: 'checkpoint', x: Math.floor(s.x + 1) }));
  // ---------- por arquetipo ----------
  const F = (esp, x, y) => S.push({ tipo: 'fauna', especie: esp, x, y });
  const cap = (item, i) => { const s = util[Math.min(util.length - 1, i)]; if (s) S.push({ tipo: 'item', x: Math.floor(s.x + 1), y: s.y - 2, item }); };
  if (arq === 'montana') {
    util.forEach((s, i) => { if (s.w >= 5 && i % 3 === 2) poner(s, (x) => F('cabra', x, s.y - 1), 4); if (i % 4 === 1 && s.w >= 4) poner(s, (x) => F('flor', x + 1, s.y - 1), 3); });
    cap('doble', 3); cap('luna', 9); cap('fuego', 14); cap('grande', 6);
    huecos.forEach((hx) => S.push({ tipo: 'magma', x: hx + 1, y: ALTO - 1, altura: 6, periodo: 3.2, retardo: (hx % 3) }));
  } else if (arq === 'granja') {
    util.forEach((s, i) => { if (s.w >= 6 && i % 2 === 0) poner(s, (x) => F('vaca', x, s.y - 1), 5); if (i % 5 === 3) poner(s, (x) => F('flor', x + 1, s.y - 1), 3); if (i === 7) poner(s, (x) => F('cabra', x, s.y - 1), 4); });
    cap('grande', 4); cap('hielo', 8); cap('fuego', 12);
  } else if (arq === 'martilleros') {
    util.forEach((s, i) => {
      if (i % 3 === 0 && s.w >= 4) { S.push({ tipo: 'plataforma', x: s.x + 1, y: s.y - 3, largo: 3 }); sup.push({ x: s.x + 1, w: 3, y: s.y - 3 }); F('mecanico', s.x + 2, s.y - 4); }
      else if (i % 3 === 2) poner(s, (x) => F('mecanico', x, s.y - 1), 4);
    });
    util.forEach((s, i) => { if (i % 5 === 2 && s.w >= 5) S.push({ tipo: 'sierra', x: Math.floor(s.x + s.w / 2), y: s.y - 2, eje: 'x', recorrido: 3, periodo: 3.6 }); });
    cap('escopeta', 4); cap('fuego', 9); cap('grande', 13);
  } else if (arq === 'laberinto') {
    for (let r = 0; r < 4; r++) { const x0 = 12 + r * 24; F(r % 2 ? 'mago' : 'espectro', x0 + 17, GY - 4); S.push({ tipo: 'sierra', x: x0 + 20, y: GY - 2, eje: 'y', recorrido: 2, periodo: 3.2 }); if (r > 0) S.push({ tipo: 'torreta', x: x0 + 9, y: GY - 7, periodo: 2.8, nombre: (enes[0] || {}).nombre || 'Error', correccion: (enes[0] || {}).correccion || '' }); }
    cap('escopeta', 3); cap('hielo', 6); cap('fuego', 9);
  } else if (arq === 'onoff') {
    util.forEach((s, i) => { if (i % 4 === 3) poner(s, (x) => F(i % 8 === 3 ? 'gigante' : 'espectro', x, i % 8 === 3 ? s.y - 1 : s.y - 4), 4); });
    cap('doble', 2); cap('fuego', 6); cap('hielo', 10);
  }
  // pequeñas amenazas en el aire comunes
  const N = Object.assign({}, o, { capitulo_id: o.capitulo_id, ancho_tiles: ancho, alto_tiles: ALTO, segmentos: S, nombre_fase: (o.nombre_fase ? o.nombre_fase.replace(/\s*·.*$/, '') + ' · ' : '') + NOMBRE_ARQ[arq], extra: arq, tipo_nivel: 'normal' });
  delete N.vertical; delete N.cueva; delete N.lava_parkour; N.relieve = N.aire = N.peligros = true;
  if (arq === 'laberinto') N.ambiente = N.ambiente === 'cueva' || N.ambiente === 'lab' ? N.ambiente : 'cueva';
  return N;
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PLAN);
for (const id of ids) {
  const o = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8')), arq = PLAN[id];
  if (!arq) { console.log('·', id, 'sin plan'); continue; }
  let ok = null, err = [];
  for (let seed = 0; seed < 25 && !ok; seed++) { const n = construir(o, arq, seed), r = V.validar(n); if (!r.errores.length) ok = n; else err = r.errores; }
  if (ok) { fs.writeFileSync(path.join(dir, id + '--2.json'), JSON.stringify(ok, null, 1) + '\n'); console.log('✔', id, arq, ok.ancho_tiles + '×' + ok.alto_tiles, ok.segmentos.length + ' segmentos'); }
  else console.log('✖', id, arq, err.slice(0, 3));
}
