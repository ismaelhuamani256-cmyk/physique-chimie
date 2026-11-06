// LAGO DE LAVA: convierte un tramo del suelo en un parkour sobre lava (islotes de 2-3 tiles, fosos de 3-5, plataformas que caen/móviles)
// con bolas de magma que saltan. Uso: node tools/lava-niveles.js nivel…
const fs = require('fs'), path = require('path'), V = require('../js/juego/validador.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles');
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const SUELO_TIPOS = ['enemigo', 'picos', 'mina', 'sierra', 'torreta', 'canon_bala', 'geiser', 'laser', 'planta_carnivora', 'prensa', 'pendulo', 'cinta', 'resorte', 'cartel', 'bicho', 'item', 'checkpoint', 'foso', 'plataforma_cae', 'bloque_rebote', 'palanca', 'puente', 'atomo', 'estacion_molecula', 'puerta_ecuacion', 'tuberia', 'puerta', 'fauna', 'llave', 'interruptor_estado', 'plataforma_estado'];
function lago(o, a, largoTot, rnd) {
  const alto = o.alto_tiles, jefe = o.segmentos.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz'), b = a + largoTot;
  const piso = (x) => { const q = o.segmentos.find((s) => s.tipo === 'plataforma' && s.grosor == null && s.y >= alto - 6 && x >= s.x && x < s.x + s.largo); return q ? q.y : null; };
  const ya = piso(a - 1), yb = piso(b + 1); if (ya == null || yb == null) return null;
  const S = [];
  for (const s of o.segmentos) {
    if (s.tipo === 'plataforma' && s.grosor == null && s.y >= alto - 6) {   // recorta el suelo dentro de [a,b)
      const x0 = s.x, x1 = s.x + s.largo;
      if (x1 <= a || x0 >= b) { S.push(s); continue; }
      if (x0 < a) S.push(Object.assign({}, s, { largo: a - x0 }));
      if (x1 > b) S.push(Object.assign({}, s, { x: b, largo: x1 - b }));
      continue;
    }
    if (typeof s.x === 'number' && SUELO_TIPOS.includes(s.tipo) && s.x >= a - 1 && s.x <= b + 1) continue;   // limpia lo que había en el tramo
    S.push(s);
  }
  let x = a, i = 0; const islas = [];
  while (x < b) {
    const f = Math.min(b - x, 3 + Math.floor(rnd() * 2) + (i % 3 === 2 ? 1 : 0)), w = 2 + Math.floor(rnd() * 2);
    S.push({ tipo: 'foso', x, largo: f });
    S.push({ tipo: 'magma', x: x + Math.floor(f / 2), y: alto - 1, altura: 7 + Math.floor(rnd() * 3), periodo: +(2.8 + rnd() * 1.4).toFixed(1), retardo: +(rnd() * 3).toFixed(1) });
    x += f;
    const t = (x - a) / largoTot, y = Math.round(ya + (yb - ya) * t) + (i % 4 === 1 ? -1 : 0);
    const yy = Math.max(alto - 6, Math.min(alto - 3, y)), ww = Math.min(w, b - x);
    if (ww > 0 && x + ww <= b) { S.push({ tipo: 'plataforma', x, y: yy, largo: ww }); islas.push({ x, y: yy, w: ww }); x += ww; }
    else { S.push({ tipo: 'plataforma', x: b - 1, y: yb, largo: 1 }); x = b; }
    i++;
  }
  const mid = islas[Math.floor(islas.length / 2)]; if (mid && mid.w >= 2) S.push({ tipo: 'checkpoint', x: mid.x + 1 });
  // bolas de fuego extra desde arriba (lluvia de brasas) para esquivar mientras saltas
  S.push({ tipo: 'lluvia_rocas', x: a + 4, w: Math.max(6, largoTot - 8), periodo: 2.1 });
  return Object.assign({}, o, { segmentos: S, lava_parkour: true });
}
for (const id of process.argv.slice(2)) {
  const f = path.join(dir, id + '.json'), o = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (o.lava_parkour) { console.log('=', id); continue; }
  const jefe = o.segmentos.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz'), fin = (jefe ? jefe.x - 14 : o.ancho_tiles - 14);
  let ok = null, err = [];
  for (const largo of [48, 40, 32, 24]) for (const a of [30, 40, 50, 60, 70, 80]) {
    if (a + largo > fin) continue;
    for (let seed = 0; seed < 6 && !ok; seed++) {
      const n = lago(o, a, largo, rng(hash(id + a + seed))); if (!n) continue;
      const r = V.validar(n); if (!r.errores.length) ok = { n, a, largo }; else err = r.errores;
    }
    if (ok) break;
  }
  if (ok) { fs.writeFileSync(f, JSON.stringify(ok.n, null, 1) + '\n'); console.log('✔', id, 'lago x', ok.a, 'largo', ok.largo); } else console.log('✖', id, err.slice(0, 2));
}
