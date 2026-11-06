// Coloca una LLAVE (sobre una plataforma con fórmula) y una PUERTA CON LLAVE más adelante, en el suelo. Uso: node tools/llaves-niveles.js nivel…
const fs = require('fs'), path = require('path'), V = require('../js/juego/validador.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles');
for (const id of process.argv.slice(2)) {
  const f = path.join(dir, id + '.json'), n = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (n.segmentos.some((s) => s.tipo === 'llave')) { console.log('=', id); continue; }
  const alto = n.alto_tiles, jefe = n.segmentos.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz'), limite = (jefe ? jefe.x : n.ancho_tiles) - 18;
  const suelos = n.segmentos.filter((s) => s.tipo === 'plataforma' && s.y >= alto - 6 && s.grosor == null);
  const solida = (x, y) => n.segmentos.some((q) => (q.tipo === 'plataforma' || q.tipo === 'ladrillo') && x >= q.x && x < q.x + (q.largo || 1) && (q.y >= alto - 6 && q.grosor == null ? y >= q.y : y >= q.y && y < q.y + (q.grosor || 1)));
  const cols = n.segmentos.filter((s) => s.tipo === 'coleccionable' && s.x > 20 && s.x < limite - 14);
  let ok = false;
  for (const c of cols) {
    const kx = Math.round(c.x) + 1, ky = Math.round(c.y);
    if (solida(kx, ky) || solida(kx, ky + 1) && false) continue;
    for (let x = kx + 12; x < limite; x++) {
      const s0 = suelos.find((q) => x >= q.x + 2 && x + 3 < q.x + q.largo);
      if (!s0 || suelos.some((q) => q !== s0 && x + 1 >= q.x && x < q.x + q.largo && Math.abs(q.y - s0.y) > 0)) continue;
      const libre = n.segmentos.every((q) => typeof q.x !== 'number' || !['enemigo', 'checkpoint', 'cartel', 'picos', 'mina', 'resorte', 'tuberia', 'puerta', 'palanca', 'sierra', 'torreta', 'laser', 'geiser', 'canon_bala', 'estacion_molecula', 'puerta_ecuacion', 'prensa', 'pendulo', 'cinta', 'planta_carnivora', 'bloque_rebote', 'foso', 'item', 'atomo', 'plataforma_movil', 'meta'].includes(q.tipo) || Math.abs(q.x - x) > 3);
      if (!libre) continue;
      const nuevo = Object.assign({}, n, { segmentos: n.segmentos.concat([{ tipo: 'llave', x: kx, y: ky }, { tipo: 'puerta', x, y: s0.y - 6, alto: 6, llave: true }]) });
      if (!V.validar(nuevo).errores.length) { fs.writeFileSync(f, JSON.stringify(nuevo, null, 1) + '\n'); console.log('✔', id, 'llave en', kx, ky, 'puerta en', x, 'suelo', s0.y); ok = true; break; }
    }
    if (ok) break;
  }
  if (!ok) console.log('✖', id, 'sin sitio válido');
}
