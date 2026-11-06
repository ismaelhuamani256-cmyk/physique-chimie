// Poda los checkpoints de contenido/niveles/*.json (44-relieve.js → podarCheckpoints): pocos y bien repartidos.   node tools/checkpoints-niveles.js
const fs = require('fs'), path = require('path');
const Rel = require('../js/juego/44-relieve.js'), V = require('../js/juego/validador.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles');
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort()) {
  const p = path.join(dir, f), n = JSON.parse(fs.readFileSync(p, 'utf8')), antes = n.segmentos.filter((s) => s.tipo === 'checkpoint').map((s) => s.x);
  const c = Rel.podarCheckpoints(n), despues = c.segmentos.filter((s) => s.tipo === 'checkpoint').map((s) => s.x);
  if (!V.validar(c).ok) { console.log('  ✖', f, 'el validador no lo acepta; se deja igual'); continue; }
  fs.writeFileSync(p, JSON.stringify(c, null, 1));
  console.log('  ✔', f.padEnd(26), antes.length, '→', despues.length, '[' + despues.join(', ') + ']');
}
