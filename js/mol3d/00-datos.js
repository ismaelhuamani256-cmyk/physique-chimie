// =====================================================================================
// 00-datos.js — MOL3D · tabla de elementos (dato físico estándar, no es contenido del cours)
//   PCB.mol3d.datos.elementos[símbolo] = {
//     z, nombre:{es,fr}, color (CPK, hex), rc (radio covalente, Å), rv (radio de van der Waals, Å),
//     masa (g·mol⁻¹), en (electronegatividad de Pauling), ve (electrones de valencia),
//     valencias (valencias habituales, para hidrógenos implícitos y mensajes del puzzle) }
//   PCB.mol3d.datos.el(sim) -> elemento (o uno genérico gris si no existe)
// Todo el módulo cuelga de window.PCB.mol3d; se carga con scripts clásicos (sin módulos ES).
// =====================================================================================
(function () {
  'use strict';
  const PCB = (window.PCB = window.PCB || {});
  const M = (PCB.mol3d = PCB.mol3d || {});

  // Colores CPK convencionales (esquema Jmol): H blanco, C gris, N azul, O rojo, Cl verde, S amarillo…
  const E = {
    H:  { z: 1,  es: 'hidrógeno', fr: 'hydrogène',  color: '#ffffff', rc: 0.31, rv: 1.20, masa: 1.008,  en: 2.20, ve: 1, valencias: [1] },
    B:  { z: 5,  es: 'boro',      fr: 'bore',       color: '#ffb5b5', rc: 0.84, rv: 1.92, masa: 10.81,  en: 2.04, ve: 3, valencias: [3] },
    C:  { z: 6,  es: 'carbono',   fr: 'carbone',    color: '#909090', rc: 0.76, rv: 1.70, masa: 12.011, en: 2.55, ve: 4, valencias: [4] },
    N:  { z: 7,  es: 'nitrógeno', fr: 'azote',      color: '#3050f8', rc: 0.71, rv: 1.55, masa: 14.007, en: 3.04, ve: 5, valencias: [3, 5] },
    O:  { z: 8,  es: 'oxígeno',   fr: 'oxygène',    color: '#ff0d0d', rc: 0.66, rv: 1.52, masa: 15.999, en: 3.44, ve: 6, valencias: [2] },
    F:  { z: 9,  es: 'flúor',     fr: 'fluor',      color: '#90e050', rc: 0.57, rv: 1.47, masa: 18.998, en: 3.98, ve: 7, valencias: [1] },
    Na: { z: 11, es: 'sodio',     fr: 'sodium',     color: '#ab5cf2', rc: 1.66, rv: 2.27, masa: 22.990, en: 0.93, ve: 1, valencias: [1] },
    Mg: { z: 12, es: 'magnesio',  fr: 'magnésium',  color: '#8aff00', rc: 1.41, rv: 1.73, masa: 24.305, en: 1.31, ve: 2, valencias: [2] },
    Al: { z: 13, es: 'aluminio',  fr: 'aluminium',  color: '#bfa6a6', rc: 1.21, rv: 1.84, masa: 26.982, en: 1.61, ve: 3, valencias: [3] },
    Si: { z: 14, es: 'silicio',   fr: 'silicium',   color: '#f0c8a0', rc: 1.11, rv: 2.10, masa: 28.086, en: 1.90, ve: 4, valencias: [4] },
    P:  { z: 15, es: 'fósforo',   fr: 'phosphore',  color: '#ff8000', rc: 1.07, rv: 1.80, masa: 30.974, en: 2.19, ve: 5, valencias: [3, 5] },
    S:  { z: 16, es: 'azufre',    fr: 'soufre',     color: '#ffff30', rc: 1.05, rv: 1.80, masa: 32.06,  en: 2.58, ve: 6, valencias: [2, 4, 6] },
    Cl: { z: 17, es: 'cloro',     fr: 'chlore',     color: '#1ff01f', rc: 1.02, rv: 1.75, masa: 35.45,  en: 3.16, ve: 7, valencias: [1, 3, 5, 7] },
    K:  { z: 19, es: 'potasio',   fr: 'potassium',  color: '#8f40d4', rc: 2.03, rv: 2.75, masa: 39.098, en: 0.82, ve: 1, valencias: [1] },
    Ca: { z: 20, es: 'calcio',    fr: 'calcium',    color: '#3dff00', rc: 1.76, rv: 2.31, masa: 40.078, en: 1.00, ve: 2, valencias: [2] },
    Mn: { z: 25, es: 'manganeso', fr: 'manganèse',  color: '#9c7ac7', rc: 1.39, rv: 2.05, masa: 54.938, en: 1.55, ve: 7, valencias: [2, 4, 7] },
    Fe: { z: 26, es: 'hierro',    fr: 'fer',        color: '#e06633', rc: 1.32, rv: 2.04, masa: 55.845, en: 1.83, ve: 8, valencias: [2, 3] },
    Cu: { z: 29, es: 'cobre',     fr: 'cuivre',     color: '#c88033', rc: 1.32, rv: 1.96, masa: 63.546, en: 1.90, ve: 11, valencias: [1, 2] },
    Zn: { z: 30, es: 'zinc',      fr: 'zinc',       color: '#7d80b0', rc: 1.22, rv: 2.01, masa: 65.38,  en: 1.65, ve: 12, valencias: [2] },
    Br: { z: 35, es: 'bromo',     fr: 'brome',      color: '#a62929', rc: 1.20, rv: 1.85, masa: 79.904, en: 2.96, ve: 7, valencias: [1, 3, 5] },
    Ag: { z: 47, es: 'plata',     fr: 'argent',     color: '#c0c0c0', rc: 1.45, rv: 1.72, masa: 107.87, en: 1.93, ve: 11, valencias: [1] },
    I:  { z: 53, es: 'yodo',      fr: 'iode',       color: '#940094', rc: 1.39, rv: 1.98, masa: 126.90, en: 2.66, ve: 7, valencias: [1, 3, 5, 7] },
    Xe: { z: 54, es: 'xenón',     fr: 'xénon',      color: '#429eb0', rc: 1.40, rv: 2.16, masa: 131.29, en: 2.60, ve: 8, valencias: [0, 2, 4, 6] },
  };
  Object.keys(E).forEach((s) => { const e = E[s]; e.sim = s; e.nombre = { es: e.es, fr: e.fr }; });

  const generico = { z: 0, sim: '?', es: 'elemento', fr: 'élément', nombre: { es: 'elemento', fr: 'élément' }, color: '#c060ff', rc: 1.0, rv: 1.8, masa: 0, en: 2, ve: 4, valencias: [4] };

  M.datos = {
    elementos: E,
    /** Devuelve el elemento del símbolo (o uno genérico si no se conoce). */
    el: (s) => E[s] || generico,
    /** Etiqueta de texto con tildes para el HUD */
    nombreEl: (s, lang) => (E[s] || generico)[lang === 'fr' ? 'fr' : 'es'],
    /** Orden de Hill simplificado para listar átomos: C, H, luego alfabético */
    ordenHill: (a, b) => { const o = (x) => (x === 'C' ? 0 : x === 'H' ? 1 : 2); return o(a) - o(b) || (a < b ? -1 : a > b ? 1 : 0); },
  };
})();
