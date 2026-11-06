// Aplica el relieve (js/juego/44-relieve.js) a los niveles de contenido/niveles/ y se queda con el primero que pase el validador.
//   node tools/relieve-niveles.js            -> procesa los niveles que aún no tienen "relieve":true
//   node tools/relieve-niveles.js --forzar   -> reaplica a todos (parte del nivel tal como está)
const fs = require('fs'), path = require('path');
const Rel = require('../js/juego/44-relieve.js'), V = require('../js/juego/validador.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles'), forzar = process.argv.includes('--forzar');
let ok = 0, mal = 0;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort()) {
  const p = path.join(dir, f), nivel = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (nivel.relieve && !forzar) { console.log('  =', f, '(ya tiene relieve)'); continue; }
  const techo = ['cueva', 'horno'].includes(nivel.ambiente);
  let elegido = null, usado = 0;
  for (const inten of [1, 0.8, 0.6, 0.4, 0.25]) {
    for (let intento = 0; intento < 6 && !elegido; intento++) {
      const cand = Rel.aplicar(nivel, { seed: nivel.capitulo_id + '#' + intento, intensidad: inten, techo });
      const r = V.validar(cand);
      if (r.ok) { elegido = cand; usado = inten; }
    }
    if (elegido) break;
  }
  if (elegido) {
    fs.writeFileSync(p, JSON.stringify(elegido, null, 1)); ok++;
    const suelos = elegido.segmentos.filter((s) => s.tipo === 'plataforma' && s.grosor == null && s.y >= elegido.alto_tiles - 6);
    console.log('  ✔', f.padEnd(28), 'intensidad', usado, '| tramos de suelo', suelos.length, '| alturas', [...new Set(suelos.map((s) => s.y))].sort().join(','), techo ? '| techo' : '');
  } else { mal++; const r = V.validar(Rel.aplicar(nivel, { seed: nivel.capitulo_id + '#0', intensidad: 0.25, techo })); console.log('  ✖', f, 'ningún intento pasó el validador:', (r.errores || []).slice(0, 2).join(' / ')); }
}
console.log(`\nrelieve aplicado: ${ok} · sin cambios por fallo: ${mal}`);
