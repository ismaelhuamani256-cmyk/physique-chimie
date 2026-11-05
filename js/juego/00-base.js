// =====================================================================================
// 00-base.js — espacio de nombres PCB.juego y utilidades de dibujo pixel-art
// Orden de carga de js/juego/: 00-base, 10-sprites, 20-temas, 30-audio, 40-mundo, 50-jefes,
// 60-ui, 70-juego y validador.js (este último solo lo usan los demás en tiempo de ejecución).
// =====================================================================================
(function () {
  const PCB = (window.PCB = window.PCB || {});
  const J = (PCB.juego = PCB.juego || {});

  J.T = 16;     // píxeles por tile
  J.VW = 512;   // resolución interna (32 x 18 tiles)
  J.VH = 288;

  /** Hash determinista de un string (FNV-1a, 32 bits). Sirve para elegir "skins" por id. */
  J.hash = function (s) {
    let h = 2166136261;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  /** Crea un canvas (offscreen) sin suavizado. */
  J.canvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return c;
  };

  /** Rectángulo relleno con enteros. */
  J.rect = function (ctx, color, x, y, w, h) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

  /** Convierte un dibujo en texto ('.' = transparente) en un canvas. pal: {caracter: color}. */
  J.arte = function (filas, pal, escala) {
    const e = escala || 1, w = filas[0].length, h = filas.length;
    const c = J.canvas(w * e, h * e), x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = filas[j][i];
      if (ch !== '.' && pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i * e, j * e, e, e); }
    }
    return c;
  };

  /** Dibuja un canvas volteado horizontalmente (para mirar a la izquierda). */
  J.dibujarVolteado = function (ctx, img, x, y, volteado) {
    if (!volteado) { ctx.drawImage(img, Math.round(x), Math.round(y)); return; }
    ctx.save(); ctx.translate(Math.round(x) + img.width, Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
  };

  /** Mezcla de dos colores #rrggbb (t: 0..1). */
  J.mezcla = function (a, b, t) {
    const p = (s) => [1, 3, 5].map((i) => parseInt(s.substr(i, 2), 16));
    const A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };

  J.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  J.lerp = (a, b, t) => a + (b - a) * t;
})();
