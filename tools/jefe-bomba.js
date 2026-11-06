// Asigna el «Rey Bomba» (jefe que se derrota disparando) a niveles elegidos y deja una cápsula de escopeta antes de la arena.
// Uso: node tools/jefe-bomba.js nivel1 nivel2 ...
const fs = require('fs'), path = require('path'), V = require('../js/juego/validador.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles');
for (const id of process.argv.slice(2)) {
  const f = path.join(dir, id + '.json'), n = JSON.parse(fs.readFileSync(f, 'utf8'));
  const j = n.segmentos.find((s) => s.tipo === 'jefe' || s.tipo === 'jefe_quiz');
  if (!j) { console.log('✖', id, 'sin jefe'); continue; }
  if (j.jefe === 'rey_bomba') { console.log('=', id, 'ya tiene Rey Bomba'); continue; }
  const antes = JSON.stringify(n);
  j.jefe = 'rey_bomba'; if (j.tipo === 'jefe') j.titulo = (j.titulo || '').replace(/^Ejercicio BAC/, 'Rey Bomba');
  if (j.tipo === 'jefe_quiz') j.tipo = 'jefe';
  const piso = (x) => n.segmentos.find((s) => s.tipo === 'plataforma' && s.y >= n.alto_tiles - 6 && x >= s.x && x < s.x + s.largo);
  let puesto = false;
  for (let x = j.x - 8; x > j.x - 40 && !puesto; x--) {
    const p = piso(x); if (!p) continue;
    const libre = !n.segmentos.some((s) => s.x != null && Math.abs(s.x - x) < 2 && ['item', 'enemigo', 'bicho', 'geiser', 'sierra', 'picos', 'torreta', 'canon_bala', 'planta_techo', 'laser', 'coleccionable', 'foso', 'resorte', 'checkpoint'].includes(s.tipo));
    if (libre) { n.segmentos.push({ tipo: 'item', x, y: p.y - 2, item: 'escopeta' }); puesto = true; }
  }
  const r = V.validar(n);
  if (r.errores && r.errores.length) { console.log('✖', id, r.errores.slice(0, 3)); continue; }
  fs.writeFileSync(f, JSON.stringify(n, null, 1) + '\n'); console.log('✔', id, 'Rey Bomba' + (puesto ? ' + escopeta' : ''));
}
