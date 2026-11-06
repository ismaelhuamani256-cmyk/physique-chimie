// Añade magos de coral/éter (fauna "mago": se teletransportan junto a ti y lanzan orbes teledirigidos) sobre plataformas flotantes de cada nivel.
// Uso: node tools/magos-niveles.js [nivel…]  (sin argumentos: todos los niveles de capítulo, 2 magos por nivel)
const fs = require('fs'), path = require('path'), V = require('../js/juego/validador.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f[0] !== '_').map((f) => f.replace('.json', ''));
for (const id of ids) {
  const f = path.join(dir, id + '.json'), n = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (n.segmentos.some((s) => s.tipo === 'fauna' && s.especie === 'mago')) { console.log('=', id); continue; }
  const alto = n.alto_tiles, jefe = n.segmentos.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz'), limite = jefe ? jefe.x - 14 : n.ancho_tiles - 10;
  const cand = n.segmentos.filter((s) => s.tipo === 'plataforma' && s.grosor == null && s.largo >= 6 && s.x > 24 && s.x < limite && s.y >= 8);
  const lejos = (x, y, lista) => lista.every((q) => Math.hypot(q.x - x, q.y - y) > 3) && n.segmentos.every((s) => typeof s.x !== 'number' || s.tipo === 'plataforma' || s.tipo === 'zona_campo' || s.tipo === 'rastro_monedas' || Math.hypot(s.x - x, (s.y == null ? y : s.y) - y) > 1.9);
  const puestos = [];
  const paso = Math.max(1, Math.floor(cand.length / 2));
  for (let k = 0; k < cand.length && puestos.length < 2; k += paso) {
    const p = cand[Math.min(cand.length - 1, k + (puestos.length ? Math.floor(paso / 2) : 0))], x = Math.floor(p.x + p.largo / 2) + (puestos.length ? 2 : 0), y = p.y - 4;
    if (lejos(x, y, puestos)) puestos.push({ tipo: 'fauna', especie: 'mago', x, y });
  }
  if (!puestos.length) { console.log('·', id, 'sin sitio'); continue; }
  const c = Object.assign({}, n, { segmentos: n.segmentos.concat(puestos) }), r = V.validar(c);
  if (r.errores.length) { console.log('✖', id, r.errores.slice(0, 2)); continue; }
  fs.writeFileSync(f, JSON.stringify(c, null, 1) + '\n'); console.log('✔', id, puestos.length, 'magos');
}
