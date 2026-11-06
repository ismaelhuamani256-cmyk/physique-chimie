// Reparte Errores Gigantes, Errores Alados y Espectros tímidos por los niveles de capítulo. Uso: node tools/gigantes-niveles.js [nivel…]
const fs = require('fs'), path = require('path'), V = require('../js/juego/validador.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f[0] !== '_').map((f) => f.replace('.json', ''));
const GROUND = ['enemigo', 'checkpoint', 'cartel', 'picos', 'mina', 'resorte', 'tuberia', 'puerta', 'palanca', 'sierra', 'torreta', 'laser', 'geiser', 'canon_bala', 'foso', 'item', 'fauna', 'llave', 'prensa', 'pendulo', 'cinta', 'planta_carnivora'];
for (const id of ids) {
  const f = path.join(dir, id + '.json'), n = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (n.vertical || n.segmentos.some((s) => s.tipo === 'fauna' && ['gigante', 'alado'].includes(s.especie))) { console.log('=', id); continue; }
  const alto = n.alto_tiles, jefe = n.segmentos.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz'), lim = (jefe ? jefe.x : n.ancho_tiles) - 20;
  const suelos = n.segmentos.filter((s) => s.tipo === 'plataforma' && s.grosor == null && s.y >= alto - 6 && s.largo >= 7 && s.x >= 24 && s.x + s.largo <= lim + 12);
  const libre = (x) => n.segmentos.every((q) => typeof q.x !== 'number' || !GROUND.includes(q.tipo) || Math.abs(q.x - x) > 2);
  const nuevos = [], pedidos = ['gigante', 'alado'];
  for (const s of suelos) for (let x = Math.floor(s.x + 2); x < s.x + s.largo - 2 && pedidos.length; x++) {
    if (x > lim || !libre(x) || nuevos.some((q) => Math.abs(q.x - x) < 10)) continue;
    nuevos.push({ tipo: 'fauna', especie: pedidos.shift(), x, y: s.y - 1 });
  }
  const sp = null; if (sp) nuevos.push({ tipo: 'fauna', especie: 'espectro', x: Math.floor(sp.x + sp.largo / 2), y: sp.y - 4 });
  if (!nuevos.length) { console.log('·', id, 'sin sitio'); continue; }
  const c = Object.assign({}, n, { segmentos: n.segmentos.concat(nuevos) }), r = V.validar(c);
  if (r.errores.length) { console.log('✖', id, r.errores.slice(0, 2)); continue; }
  fs.writeFileSync(f, JSON.stringify(c, null, 1) + '\n'); console.log('✔', id, nuevos.map((q) => q.especie).join(','));
}
