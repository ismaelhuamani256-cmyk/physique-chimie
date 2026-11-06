// Coloca power-ups (núcleo expansivo, flor de plasma, escopeta de iones) en contenido/niveles/*.json. Idempotente (no duplica).
const fs = require('fs'), path = require('path');
const V = require('../js/juego/validador.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles');
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort()) {
  const p = path.join(dir, f), n = JSON.parse(fs.readFileSync(p, 'utf8')), alto = n.alto_tiles || 18, SMIN = alto - 6;
  const ya = new Set(n.segmentos.filter((s) => s.tipo === 'item').map((s) => s.item));
  const G = new Array(n.ancho_tiles).fill(null);
  for (const s of n.segmentos) if (s.tipo === 'plataforma' && s.grosor == null && s.y >= SMIN) for (let i = 0; i < s.largo; i++) G[s.x + i] = s.y;
  for (const s of n.segmentos) if (s.tipo === 'foso') for (let i = 0; i < s.largo; i++) G[s.x + i] = null;
  const jefe = n.segmentos.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz'), meta = n.segmentos.find((s) => s.tipo === 'meta');
  const fin = jefe ? jefe.x - 14 : meta ? meta.x - 8 : n.ancho_tiles - 12;
  const SUELO = ['enemigo', 'mina', 'picos', 'torreta', 'canon_bala', 'geiser', 'prensa', 'planta_carnivora', 'checkpoint', 'cartel', 'estacion_molecula', 'puerta_ecuacion', 'tuberia', 'puerta', 'palanca', 'resorte', 'item', 'cinta', 'bloque_rebote', 'interruptor_estado', 'sierra'];
  const ocupado = (x) => n.segmentos.some((s) => SUELO.includes(s.tipo) && typeof s.x === 'number' && x >= s.x - 1 && x <= s.x + (s.largo || 1) + 1);
  const colocar = (item, objetivo) => {
    if (ya.has(item)) return null;
    for (let d = 0; d < 90; d++) for (const x of [objetivo + d, objetivo - d]) {
      if (x < 12 || x > fin || G[x] == null || G[x - 1] == null || G[x + 1] == null || ocupado(x)) continue;
      n.segmentos.push({ tipo: 'item', x, y: G[x] - 1, item }); return x;
    }
    return null;
  };
  const r = [colocar('grande', 28), colocar('fuego', Math.round(fin * 0.45)), colocar('escopeta', Math.round(fin * 0.72))];
  if (!V.validar(n).ok) { console.log('  ✖', f, 'no valida tras añadir ítems'); continue; }
  fs.writeFileSync(p, JSON.stringify(n, null, 1)); console.log('  ✔', f.padEnd(26), 'grande/fuego/escopeta en x =', r.map((v) => v == null ? '—' : v).join(' / '));
}
