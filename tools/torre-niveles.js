// Convierte un nivel en una TORRE VERTICAL (alto_tiles 54): se asciende en zigzag por plataformas hasta una arena de jefe en lo alto.
// Reutiliza del original: fórmulas (coleccionables), errores (enemigos), cartel, bichos, jefe. Uso: node tools/torre-niveles.js nivel1 nivel2 …
const fs = require('fs'), path = require('path'), V = require('../js/juego/validador.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles');
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

function torre(orig, opt) {
  const rnd = rng(hash(orig.capitulo_id + '|torre')), ALTO = 54, ANCHO = 48, SUELO = ALTO - 4, N = 13, XS = [4, 13, 22, 13], LARGO = opt.largo || 6;
  const S = [{ tipo: 'plataforma', x: 0, y: SUELO, largo: ANCHO }];
  const pl = [];   // plataformas de la subida
  for (let i = 0; i < N; i++) { const y = SUELO - 3 - 3 * i, x = XS[i % 4] + (i % 4 === 0 ? 0 : 0); pl.push({ i, x, y, largo: LARGO, movil: opt.moviles && (i === 2 || i === 6 || i === 10) }); }
  const yTop = pl[N - 1].y - 3;
  S.push({ tipo: 'plataforma', x: 12, y: yTop, largo: ANCHO - 12 });
  for (const p of pl) S.push(p.movil ? { tipo: 'plataforma_movil', x: p.x, y: p.y, largo: 4, recorrido: 5, eje: 'x', periodo: 5 } : { tipo: 'plataforma', x: p.x, y: p.y, largo: p.largo });
  const cols = orig.segmentos.filter((s) => s.tipo === 'coleccionable'), enes = orig.segmentos.filter((s) => s.tipo === 'enemigo'), bichos = orig.segmentos.filter((s) => s.tipo === 'bicho'), jefe = orig.segmentos.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz'), cartel = orig.segmentos.find((s) => s.tipo === 'cartel');
  // columnas exclusivas (para checkpoints: topAt devuelve la plataforma MÁS ALTA de la columna)
  const exclusiva = (p) => { for (let c = p.x + 1; c < p.x + p.largo - 1; c++) if (!pl.some((q) => q !== p && c >= q.x && c < q.x + q.largo + (q.movil ? 5 : 0)) && !(c >= 12)) return c; return null; };
  if (cartel) S.push(Object.assign({}, cartel, { x: 6, y: SUELO - 1 }));
  // fórmulas: en las plataformas 1..N-2 (alternas), arriba de la plataforma
  let k = 0; for (let i = 1; i < N - 1 && k < cols.length; i += Math.max(1, Math.floor((N - 2) / Math.min(cols.length, 8)))) { const p = pl[i]; S.push(Object.assign({}, cols[k++], { x: p.x + 2, y: p.y - 2 })); }
  while (k < cols.length && k < 8) { const p = pl[1 + (k % (N - 2))]; S.push(Object.assign({}, cols[k++], { x: p.x + 3, y: p.y - 3 })); }
  // enemigos del repertorio del capítulo, sobre plataformas
  let e = 0; for (const i of [0, 2, 4, 6, 8, 10, 11]) { const p = pl[i]; if (p.movil || !enes.length) continue; const m = enes[e++ % enes.length]; S.push(Object.assign({}, m, { x: p.x + 2, y: p.y - 1 })); }
  for (const b of bichos.slice(0, 3)) { const p = pl[3 + (S.length % 5)]; S.push(Object.assign({}, b, { x: p.x + 8, y: p.y - 4 })); }
  // checkpoints: pocos (a 1/3 y 2/3 de la subida)
  for (const i of [4, 8]) { const c = exclusiva(pl[i]); if (c != null) S.push({ tipo: 'checkpoint', x: c }); }
  // peligros: torretas en el borde de algunas plataformas, sierras colgando bajo otras, minas, láseres entre saltos
  for (const i of [3, 5, 9]) { const p = pl[i]; if (!p.movil) S.push({ tipo: 'torreta', x: p.x + p.largo - 1, y: p.y - 1, periodo: 2.8, nombre: (enes[0] || {}).nombre || 'Error', correccion: (enes[0] || {}).correccion || '' }); }
  for (const i of [1, 5, 7, 11]) { const p = pl[i]; S.push({ tipo: 'sierra', x: p.x + 3, y: p.y + 3, eje: 'x', recorrido: 4, periodo: 3.2 + rnd() }); }
  for (const i of [7, 10]) { const p = pl[i]; if (!p.movil) S.push({ tipo: 'mina', x: p.x + 4, y: p.y - 1, modo: 'temporizador', radio: 1.4 }); }
  for (const i of [6, 9]) { const p = pl[i]; S.push({ tipo: 'laser', x: p.x + p.largo + 1, y: p.y - 3, eje: 'h', largo: 3, periodo: 3.6, retardo: rnd() * 2 }); }
  S.push({ tipo: 'lluvia_rocas', x: 14, w: 20, periodo: 2.4 });
  for (const [i, it] of [[2, 'escopeta'], [5, 'grande'], [8, 'fuego']]) { const p = pl[i]; if (!p.movil) S.push({ tipo: 'item', x: p.x + 1, y: p.y - 2, item: it }); }
  if (jefe) { S.push(Object.assign({}, jefe, { x: 32 })); S.push({ tipo: 'meta', x: 44 }); }
  S.push({ tipo: 'checkpoint', x: 14 });   // al llegar arriba (topAt = suelo de la arena)
  const N2 = Object.assign({}, orig, { ancho_tiles: ANCHO, alto_tiles: ALTO, segmentos: S, vertical: true, nombre_fase: orig.nombre_fase });
  delete N2.relieve; delete N2.aire; delete N2.peligros; N2.relieve = N2.aire = N2.peligros = true;
  return N2;
}

for (const id of process.argv.slice(2)) {
  const f = path.join(dir, id + '.json'), o = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (o.vertical) { console.log('=', id, 'ya es vertical'); continue; }
  let ok = null, motivo = [];
  for (const opt of [{ moviles: true }, { moviles: false }, { moviles: false, largo: 7 }]) { const n = torre(o, opt), r = V.validar(n); if (!r.errores.length) { ok = n; break; } motivo = r.errores; }
  if (ok) { fs.writeFileSync(f, JSON.stringify(ok, null, 1) + '\n'); console.log('✔', id, ok.segmentos.length, 'segmentos'); } else console.log('✖', id, motivo.slice(0, 6));
}
