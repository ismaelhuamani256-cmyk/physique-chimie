// Servidor local SIN dependencias: sirve la app, guarda el progreso y lista los scripts a cargar.
// Solo escucha en 127.0.0.1 (nadie más en tu red puede entrar). No hay API key ni llamadas a la nube.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, PORT = +process.env.PORT || 3000, HOST = '127.0.0.1';
const DATA = path.join(ROOT, 'data'), PROGRESO = path.join(DATA, 'progreso.json');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.woff2':'font/woff2', '.woff':'font/woff', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav' };
// Carpetas públicas: nunca servimos .git, data/, cours/ (los PDF pesan 120 MB y no hacen falta en runtime).
const PUBLIC = ['index.html','css','js','lib','contenido','assets'];

// Lista ordenada de scripts: core.js, anim-core.js y luego js/<carpeta>/*.js en orden alfabético (usa prefijos NN- para ordenar).
function listaScripts() {
  const js = path.join(ROOT, 'js'), out = ['js/core.js', 'js/anim-core.js', 'js/loader.js'];
  const walk = (dir, rel) => fs.readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name)).forEach(e => {
    const r = rel + '/' + e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r);
    else if (e.name.endsWith('.js') && !out.includes(r)) out.push(r);
  });
  // Orden de carpetas: anim, estudio, intro, juego y por último los .js sueltos (mapa.js)
  const dirs = fs.readdirSync(js, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
  dirs.forEach(d => walk(path.join(js, d), 'js/' + d));
  fs.readdirSync(js).filter(f => f.endsWith('.js')).sort().forEach(f => { if (!out.includes('js/' + f)) out.push('js/' + f); });
  return out.filter(f => f !== 'js/loader.js');
}
const listaCss = () => fs.readdirSync(path.join(ROOT, 'css')).filter(f => f.endsWith('.css')).sort((a,b)=> a==='base.css'?-1:b==='base.css'?1:a.localeCompare(b)).map(f => 'css/' + f);

// Qué capítulos tienen cada tipo de contenido ya generado
function listaContenido() {
  const r = {};
  for (const k of ['capitulos','niveles','intros','quizzes']) {
    const d = path.join(ROOT, 'contenido', k);
    r[k] = fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)) : [];
  }
  return r;
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); let p = decodeURIComponent(url.pathname);
  if (p === '/api/scripts') return json(res, 200, { js: listaScripts(), css: listaCss() });
  if (p === '/api/contenido') return json(res, 200, listaContenido());
  if (p === '/api/progreso') {
    if (req.method === 'GET') {
      try { return json(res, 200, JSON.parse(fs.readFileSync(PROGRESO, 'utf8'))); } catch { return json(res, 200, null); }
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      let b = ''; req.on('data', c => { b += c; if (b.length > 2e6) req.destroy(); });
      req.on('end', () => { try { JSON.parse(b); fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(PROGRESO, b); json(res, 200, { ok: true }); } catch { json(res, 400, { ok: false }); } });
      return;
    }
  }
  if (p === '/') p = '/index.html';
  const rel = path.normalize(p).replace(/^[/\\]+/, '');
  const raiz = rel.split(path.sep)[0];
  const file = path.join(ROOT, rel);
  if (!PUBLIC.includes(raiz) || !file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('No encontrado'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, HOST, () => console.log(`Physique-Chimie BAC → http://${HOST}:${PORT}`));
