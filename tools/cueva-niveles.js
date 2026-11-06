// Convierte niveles de agua ya guardados (quiz_agua) en cuevas submarinas (js/juego/44-cueva.js). Uso: node tools/cueva-niveles.js [archivo.json …]
const fs = require('fs'), path = require('path'), V = require('../js/juego/validador.js'), C = require('../js/juego/44-cueva.js');
const dir = path.join(__dirname, '..', 'contenido', 'niveles');
const archivos = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f));
for (const f of archivos) {
  const n = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (n.tipo_nivel !== 'quiz_agua' || n.cueva) continue;
  let ok = null;
  for (const inten of [1, 0.7, 0.45]) { const c = C.aplicar(n, { seed: path.basename(f), intensidad: inten }); if (!V.validar(c).errores.length) { ok = c; break; } }
  if (ok) { fs.writeFileSync(f, JSON.stringify(ok, null, 1) + '\n'); console.log('✔', path.basename(f), JSON.stringify(ok.cueva)); } else console.log('✖', path.basename(f), 'no valida');
}
