// =====================================================================================
// 20-biblioteca.js — MOL3D · biblioteca de moléculas, iones y reacciones del cours
//
//  PCB.mol3d.molecula(id)        -> molécula 3D (cache) o null. `id` = fórmula como en el cours
//                                   ('H2O','H3O+','HO-','NH4+','CH3CO2H','SO4^2-'…) o alias ('OH-','CH3COOH','agua').
//     {id, formula, formulaAscii, nombre (es), nombre_fr, carga, axe, geometria, geometriaFr, centro,
//      atomos:[{el,x,y,z,carga}], enlaces:[{a,b,orden}], cargas:[por átomo], centros:[…], capitulos:[ids], categoria}
//  PCB.mol3d.lista(filtro?)      -> ids de moléculas  ({categoria:'cours'|'vsepr'})
//  PCB.mol3d.reaccionDef(id)     -> reacción resuelta (con mapa átomo→átomo) o null
//  PCB.mol3d.listaReacciones()   -> ids de reacciones
//  PCB.mol3d.resolverReaccion({reactivos:['NH3','H3O+'], productos:[…], mapa:'0.0>0.0 1.0>1.0'}) -> reacción resuelta
//  PCB.mol3d.delCapitulo(capId)  -> {moleculas:[ids], reacciones:[ids]} que aparecen en el cours de ese capítulo
//  PCB.mol3d.describir(mol)      -> texto en español (alternativa accesible) · resumenAngulos(mol) -> ['H–O–H 104,5°']
//
// FIDELIDAD AL COURS: cada molécula y cada reacción lleva `capitulos` (ids de contenido/capitulos/*.json en cuyo
// texto aparece literalmente la fórmula o la ecuación). Las geometrías no son contenido del cours: son datos
// físicos estándar (VSEPR). Las moléculas de categoría 'vsepr' son solo ejemplos de geometría (sin capítulo).
// Mapa de una reacción: «m.k>p.q» = el k-ésimo átomo NO-H (orden del SMILES) de la molécula m de los reactivos
// pasa a ser el q-ésimo átomo no-H de la molécula p de los productos. Los H se reparten solos (ver resolverReaccion).
// =====================================================================================
(function () {
  'use strict';
  const PCB = (window.PCB = window.PCB || {});
  const M = (PCB.mol3d = PCB.mol3d || {});
  const V = M.vsepr, D = M.datos;

  const AB = 'acide-base', FA = 'force-acides-bases', EV = 'evolution-temporelle', MC = 'methodes-chimiques', MP = 'methodes-physiques',
    SE = 'sens-evolution', FS = 'forcer-sens', SO = 'synthese-organique', GP = 'gaz-parfait', NU = 'nucleaires';

  // [id, smiles, nombre es, nombre fr, capítulos, opciones]
  const MOLS = [
    // --- gases y moléculas pequeñas ---
    ['H2', '[H][H]', 'dihidrógeno', 'dihydrogène', [EV, FS, GP, SO]],
    ['O2', 'O=O', 'dioxígeno', 'dioxygène', [EV, FS, MP, SO]],
    ['N2', 'N#N', 'dinitrógeno (diazote)', 'diazote', [GP]],
    ['O3', 'O=[O+][O-]', 'ozono', 'ozone', [GP]],
    ['H2O', 'O', 'agua', 'eau', [AB, EV, FA, FS, GP, MC, MP, SE, SO]],
    ['H2O2', 'OO', 'peróxido de hidrógeno (agua oxigenada)', "peroxyde d'hydrogène (eau oxygénée)", [EV], { diedros: { 1: 112 } }],
    ['CO2', 'O=C=O', 'dióxido de carbono', 'dioxyde de carbone', [AB, EV, FA, FS, GP, NU]],
    ['CO', '[C-]#[O+]', 'monóxido de carbono', 'monoxyde de carbone', [EV]],
    ['HCl', 'Cl', 'cloruro de hidrógeno', "chlorure d'hydrogène", [AB, EV, FA, MC, MP, SO]],
    ['NH3', 'N', 'amoníaco', 'ammoniac', [AB, FA, SO]],
    ['CH4', 'C', 'metano', 'méthane', [EV]],
    ['H2S', 'S', 'sulfuro de hidrógeno', "sulfure d'hydrogène", [SE]],
    ['SO2', 'O=S=O', 'dióxido de azufre', 'dioxyde de soufre', [SO]],
    ['SOCl2', 'O=S(Cl)Cl', 'cloruro de tionilo', 'chlorure de thionyle', [SO]],
    ['N2O5', 'O=[N+]([O-])O[N+](=O)[O-]', 'pentóxido de dinitrógeno', 'pentaoxyde de diazote', [EV]],
    ['H2CO3', 'OC(=O)O', 'ácido carbónico', 'acide carbonique', [AB]],
    // --- iones ---
    ['H3O+', '[OH3+]', 'ion oxonio (hidronio)', 'ion oxonium', [AB, EV, FA, GP, MC, MP, SE]],
    ['HO-', '[OH-]', 'ion hidróxido', 'ion hydroxyde', [AB, EV, FA, FS, MC, MP, SE, SO]],
    ['NH4+', '[NH4+]', 'ion amonio', 'ion ammonium', [AB, EV, FA]],
    ['Cl-', '[Cl-]', 'ion cloruro', 'ion chlorure', [AB, EV, FA, FS, MC, MP, SE]],
    ['HCO3-', 'OC(~O)~O', 'ion hidrogenocarbonato', 'ion hydrogénocarbonate', [AB, FA]],
    ['CO3^2-', 'C(~O)(~O)~O', 'ion carbonato', 'ion carbonate', [AB, FA]],
    ['NO3-', 'N(~O)(~O)~O', 'ion nitrato', 'ion nitrate', [FA, MC]],
    ['HNO3', 'O[N+](=O)[O-]', 'ácido nítrico', 'acide nitrique', [FA, MC, SO]],
    ['HClO', 'OCl', 'ácido hipocloroso', 'acide hypochloreux', [AB, FA]],
    ['ClO-', '[O-]Cl', 'ion hipoclorito', 'ion hypochlorite', [AB, EV, FA]],
    ['HSO3-', 'OS(=O)[O-]', 'ion hidrogenosulfito', 'ion hydrogénosulfite', [SE]],
    ['SO3^2-', '[S](~O)(~O)~O', 'ion sulfito', 'ion sulfite', [SE]],
    ['HS-', '[SH-]', 'ion hidrogenosulfuro', 'ion hydrogénosulfure', [SE]],
    ['SO4^2-', 'S(~O)(~O)(~O)~O', 'ion sulfato', 'ion sulfate', [EV]],
    ['PO4^3-', 'P(~O)(~O)(~O)~O', 'ion fosfato', 'ion phosphate', [AB]],
    ['HPO4^2-', 'OP(~O)(~O)~O', 'ion hidrogenofosfato', 'ion hydrogénophosphate', [AB]],
    ['H2SO4', 'OS(=O)(=O)O', 'ácido sulfúrico', 'acide sulfurique', [SO]],
    ['MnO4-', 'O=[Mn](=O)(=O)[O-]', 'ion permanganato', 'ion permanganate', [EV]],
    ['OCN-', '[N-]=C=O', 'ion cianato', 'ion cyanate', [EV]],
    ['Zn', '[Zn]', 'zinc (átomo)', 'zinc', [EV, FS, GP, SE]],
    ['Zn^2+', '[Zn+2]', 'ion zinc', 'ion zinc', [EV, FS, GP, SE]],
    // --- química orgánica ---
    ['CH3OH', 'CO', 'metanol', 'méthanol', [EV, SO]],
    ['C2H5OH', 'CCO', 'etanol', 'éthanol', [EV, MP, SO]],
    ['CH3CHO', 'CC=O', 'etanal', 'éthanal', [EV]],
    ['C3H6O', 'CC(C)=O', 'propanona (acetona)', 'propanone', [EV, SO]],
    ['C3H8O', 'CC(C)O', 'propan-2-ol', 'propan-2-ol', [EV]],
    ['CH3CO2H', 'CC(=O)O', 'ácido etanoico (acético)', 'acide éthanoïque (acétique)', [AB, EV, FA, MC, SE, SO]],
    ['CH3CO2-', 'CC(~O)~O', 'ion etanoato', 'ion éthanoate', [AB, EV, FA, MC, SE]],
    ['HCO2H', 'C(=O)O', 'ácido metanoico (fórmico)', 'acide méthanoïque', [FA]],
    ['HCO2-', 'C(~O)~O', 'ion metanoato', 'ion méthanoate', [FA]],
    ['C6H5CO2H', 'c1ccccc1C(=O)O', 'ácido benzoico', 'acide benzoïque', [FA, MC, SO]],
    ['C6H5CO2-', 'c1ccccc1C(~O)~O', 'ion benzoato', 'ion benzoate', [FA, MC]],
    ['CH3NH2', 'CN', 'metanamina', 'méthanamine', [AB, FA]],
    ['CH3NH3+', 'C[NH3+]', 'ion metanamonio', 'ion méthylammonium', [AB, FA]],
    ['CH3CO2C2H5', 'CC(=O)OCC', 'etanoato de etilo', "éthanoate d'éthyle", [EV]],
    ['C6H5CO2C2H5', 'c1ccccc1C(=O)OCC', 'benzoato de etilo', "benzoate d'éthyle", [SO]],
    ['C6H6', 'c1ccccc1', 'benceno', 'benzène', [SO]],
    ['C6H5CH2OH', 'c1ccccc1CO', 'alcohol bencílico', 'alcool benzylique', [SO]],
    ['C2H4O3', 'OCC(=O)O', 'ácido glicólico', 'acide glycolique', [FA]],
    ['C2H3O3-', 'OCC(~O)~O', 'ion glicolato', 'ion glycolate', [FA]],
    ['C10H20O2', 'CCCCCCCCCC(=O)O', 'ácido cáprico (decanoico)', 'acide caprique', [FA]],
    ['C5H10O2', 'CCCCC(=O)O', 'ácido pentanoico', 'acide pentanoïque', [MP]],
    ['C3H4O4', 'OC(=O)CC(=O)O', 'ácido malónico', 'acide malonique', [AB]],
    ['C6H12O6', 'OC1OC(CO)C(O)C(O)C1O', 'glucosa (β-D-glucopiranosa)', 'glucose (β-D-glucopyranose)', [FS, SE, SO]],
    ['C6H8O6', 'OCC(O)C1OC(=O)C(O)=C1O', 'ácido ascórbico (vitamina C)', 'acide ascorbique (vitamine C)', [AB]],
    ['C6H7O6-', 'OCC(O)C1OC(=O)C(O)=C1[O-]', 'ion ascorbato', 'ion ascorbate', [AB]],
    ['C2H2', 'C#C', 'etino (acetileno)', 'éthyne (acétylène)', [SO]],
    ['C5H8', 'C=C(C)C=C', 'isopreno (2-metilbuta-1,3-dieno)', 'isoprène', [SO]],
    ['MMA', 'C=C(C)C(=O)OC', 'metacrilato de metilo (monómero del PMMA)', 'méthacrylate de méthyle', [SO]],
    ['C2H5Cl', 'CCCl', 'cloroetano', 'chloroéthane', [SO]],
    ['CO(NH2)2', 'NC(N)=O', 'urea', 'urée', [EV]],
    // --- ejemplos VSEPR (no aparecen en un capítulo) ---
    ['C2H4', 'C=C', 'eteno (etileno)', 'éthène', [], { cat: 'vsepr' }],
    ['BF3', 'B(F)(F)F', 'trifluoruro de boro', 'trifluorure de bore', [], { cat: 'vsepr' }],
    ['PCl5', 'P(Cl)(Cl)(Cl)(Cl)Cl', 'pentacloruro de fósforo', 'pentachlorure de phosphore', [], { cat: 'vsepr' }],
    ['SF6', 'S(F)(F)(F)(F)(F)F', 'hexafluoruro de azufre', 'hexafluorure de soufre', [], { cat: 'vsepr' }],
    ['SF4', 'S(F)(F)(F)F', 'tetrafluoruro de azufre', 'tétrafluorure de soufre', [], { cat: 'vsepr' }],
    ['ClF3', 'Cl(F)(F)F', 'trifluoruro de cloro', 'trifluorure de chlore', [], { cat: 'vsepr' }],
    ['XeF2', '[Xe](F)F', 'difluoruro de xenón', 'difluorure de xénon', [], { cat: 'vsepr' }],
    ['XeF4', '[Xe](F)(F)(F)F', 'tetrafluoruro de xenón', 'tétrafluorure de xénon', [], { cat: 'vsepr' }],
    ['BrF5', 'Br(F)(F)(F)(F)F', 'pentafluoruro de bromo', 'pentafluorure de brome', [], { cat: 'vsepr' }],
  ];

  // ---------- normalización de identificadores ----------
  const SUBD = '₀₁₂₃₄₅₆₇₈₉', SUPD = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' };
  /** 'SO₄²⁻', 'SO4^2-', 'SO4(2-)', 'SO42-(aq)' -> 'SO42-' */
  function clave(s) {
    s = String(s == null ? '' : s).replace(/\s+/g, '').replace(/\((?:aq|g|s|l|ℓ)\)/gi, '');
    s = s.replace(/[₀-₉]/g, (d) => SUBD.indexOf(d)).replace(/[⁰¹²³⁴-⁹⁺⁻]/g, (d) => SUPD[d]).replace(/[−–]/g, '-').replace(/\^/g, '');
    s = s.replace(/\((\d*[+-])\)/, '$1');
    return s;
  }
  const ALIAS = { 'OH-': 'HO-', 'CH3COOH': 'CH3CO2H', 'CH3COO-': 'CH3CO2-', 'HCOOH': 'HCO2H', 'HCOO-': 'HCO2-', 'C7H6O2': 'C6H5CO2H', 'C6H5COOH': 'C6H5CO2H',
    'C7H5O2-': 'C6H5CO2-', 'C6H5COO-': 'C6H5CO2-', 'C2H4O2': 'CH3CO2H', 'CH3CH2OH': 'C2H5OH', 'CH3COCH3': 'C3H6O', 'CH3COOCH2CH3': 'CH3CO2C2H5',
    'H+': 'H3O+', 'Zn(s)': 'Zn', 'Zn2+': 'Zn^2+', 'H2PO4-': null, 'CO(NH2)2': 'CO(NH2)2', 'OC(NH2)2': 'CO(NH2)2', 'glucose': 'C6H12O6', 'glucosa': 'C6H12O6',
    'CH3CH2CH2CH2CO2H': 'C5H10O2', 'C6H5CO2CH2CH3': 'C6H5CO2C2H5', 'NH2CH3': 'CH3NH2', 'CH3NH3+': 'CH3NH3+' };

  const defs = {}, porClave = {}, orden = [];
  MOLS.forEach((r) => {
    const o = r[5] || {};
    defs[r[0]] = { id: r[0], smi: r[1], es: r[2], fr: r[3], caps: r[4], opt: o, cat: o.cat || 'cours' };
    porClave[clave(r[0])] = r[0]; orden.push(r[0]);
  });
  Object.keys(ALIAS).forEach((a) => { if (ALIAS[a] && defs[ALIAS[a]]) porClave[clave(a)] = ALIAS[a]; });
  // nombres en es/fr (agua, eau…) como alias de último recurso
  const porNombre = {};
  orden.forEach((id) => { [defs[id].es, defs[id].fr].forEach((n) => { porNombre[n.toLowerCase().replace(/\s*\(.*\)/, '')] = id; }); });

  function resolverId(x) {
    if (x == null) return null;
    if (defs[x]) return x;
    const k = clave(x);
    if (porClave[k]) return porClave[k];
    const k2 = Object.keys(porClave).find((q) => q.toLowerCase() === k.toLowerCase());
    if (k2) return porClave[k2];
    return porNombre[String(x).toLowerCase()] || null;
  }

  /** Carga total a partir del id: 'SO4^2-' -> -2, 'H3O+' -> +1, 'Zn^2+' -> +2 */
  function cargaDeId(id) {
    const m = /\^?(\d*)([+-])$/.exec(id);
    if (!m) return 0;
    const dig = /\d$/.test(id.replace(/[+-]$/, '')) && !id.includes('^') ? 1 : +(m[1] || 1);
    return (m[2] === '+' ? 1 : -1) * dig;
  }

  const cache = {};
  function molecula(x) {
    const id = resolverId(x);
    if (!id) return null;
    if (cache[id]) return cache[id];
    const d = defs[id];
    const m = V.desdeSMILES(d.smi, d.opt);
    m.id = id; m.formulaAscii = id; m.formula = V.formula(id); m.nombre = d.es; m.nombre_fr = d.fr;
    m.carga = cargaDeId(id); m.capitulos = d.caps.slice(); m.categoria = d.cat;
    m.cargas = m.atomos.map((a) => a.carga || 0);
    cache[id] = m;
    return m;
  }

  // ---------- texto accesible ----------
  const art = { H: 'de hidrógeno' };
  function resumenAngulos(m) {
    // agrupa por tipo de ángulo (p. ej. H–C–H) y muestra los valores distintos: «F–S–F ≈ 90° / 120° / 180°»
    const grupos = {}, orden = [];
    m.centros.forEach((c) => {
      if (c.el === 'H') return;
      c.angulos.forEach((a) => {
        const e1 = m.atomos[a.i].el, e2 = m.atomos[a.k].el, key = e1 <= e2 ? e1 + '–' + c.el + '–' + e2 : e2 + '–' + c.el + '–' + e1;
        if (!grupos[key]) { grupos[key] = new Set(); orden.push(key); }
        grupos[key].add(Math.round(a.deg * 10) / 10);
      });
    });
    const f = (x) => String(x).replace('.', ',');
    return orden.slice(0, 8).map((k) => k + ' ≈ ' + Array.from(grupos[k]).sort((x, y) => x - y).map((x) => f(x) + '°').join(' / '));
  }
  function describir(m) {
    const cuenta = {};
    m.atomos.forEach((a) => (cuenta[a.el] = (cuenta[a.el] || 0) + 1));
    const partes = Object.keys(cuenta).sort(D.ordenHill).map((e) => cuenta[e] + ' átomo' + (cuenta[e] > 1 ? 's' : '') + ' de ' + D.nombreEl(e));
    const lista = partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : partes[0];
    const ang = resumenAngulos(m);
    return (m.nombre ? m.nombre.charAt(0).toUpperCase() + m.nombre.slice(1) : 'Molécula') + ' (' + m.formula + '): ' + lista + '. Geometría VSEPR ' + m.axe + ', ' + m.geometria + (ang.length ? '. Ángulos: ' + ang.join('; ') : '') + '.';
  }

  // ---------- reacciones ----------
  // [id, reactivos[], productos[], mapa, capítulos, {eq:true si ⇌, nota, fuente, tipo}]
  const ident = (a, b, n) => Array.from({ length: n }, (_, i) => a + '.' + i + '>' + b + '.' + i).join(' ');
  const RXS = [
    ['hcl-agua', ['HCl', 'H2O'], ['Cl-', 'H3O+'], '0.0>0.0 1.0>1.0', [AB], { tipo: 'Transferencia de H⁺ (transformación total)', nota: 'El HCl cede un H⁺ al agua: reacción total (flecha simple).', fuente: 'texto' }],
    ['etanoico-agua', ['CH3CO2H', 'H2O'], ['CH3CO2-', 'H3O+'], '0.0>0.0 0.1>0.1 0.2>0.2 0.3>0.3 1.0>1.0', [AB, FA], { eq: true, tipo: 'Transferencia de H⁺ (no total)', nota: 'Ácido etanoico + agua no es total: se escribe con doble flecha ⇌.', fuente: 'texto' }],
    ['nh3-h3o', ['NH3', 'H3O+'], ['NH4+', 'H2O'], '0.0>0.0 1.0>1.0', [AB], { tipo: 'Transferencia de H⁺', nota: 'Reacción entre los pares NH₄⁺/NH₃ y H₃O⁺/H₂O del capítulo: el H₃O⁺ cede un H⁺ al NH₃ (doblete no ligante del N).', fuente: 'pares del capítulo' }],
    ['nh4-ho', ['NH4+', 'HO-'], ['NH3', 'H2O'], '0.0>0.0 1.0>1.0', [AB], { tipo: 'Transferencia de H⁺', nota: 'Observación NH₄⁺ + HO⁻ del capítulo (Cl⁻ y Na⁺ son iones espectadores): el HO⁻ capta un H⁺ del NH₄⁺.', fuente: 'texto y pares' }],
    ['etanoico-hco3', ['CH3CO2H', 'HCO3-'], ['CH3CO2-', 'CO2', 'H2O'], '0.0>0.0 0.1>0.1 0.2>0.2 0.3>0.3 1.0>2.0 1.1>1.1 1.2>1.0 1.3>1.2', [AB], { tipo: 'Transferencia de H⁺ con desprendimiento de CO₂', nota: 'Ejercicio 41: el gas formado es CO₂.', fuente: 'texto' }],
    ['ascorbico-hco3', ['C6H8O6', 'HCO3-'], ['C6H7O6-', 'CO2', 'H2O'], ident(0, 0, 12) + ' 1.0>2.0 1.1>1.1 1.2>1.0 1.3>1.2', [AB], { tipo: 'Transferencia de H⁺ con desprendimiento de CO₂', nota: 'Comprimidos efervescentes de vitamina C: C₆H₈O₆ + HCO₃⁻ → C₆H₇O₆⁻ + CO₂ + H₂O.', fuente: 'texto' }],
    ['nh4-po4', ['NH4+', 'PO4^3-'], ['NH3', 'HPO4^2-'], '0.0>0.0 1.0>1.1 1.1>1.0 1.2>1.2 1.3>1.3 1.4>1.4', [AB], { eq: true, tipo: 'Transferencia de H⁺', nota: 'El NH₄⁺ (ácido del par NH₄⁺/NH₃) cede un H⁺ al PO₄³⁻ (base del par HPO₄²⁻/PO₄³⁻).', fuente: 'texto' }],
    ['autoprotolisis', ['H2O', 'H2O'], ['H3O+', 'HO-'], '0.0>0.0 1.0>1.0', [FA], { eq: true, tipo: 'Autoprotólisis del agua', nota: 'Dos moléculas de agua reaccionan entre sí: una hace de ácido y la otra de base.', fuente: 'texto' }],
    ['nh4-agua', ['NH4+', 'H2O'], ['NH3', 'H3O+'], '0.0>0.0 1.0>1.0', [FA], { eq: true, tipo: 'Transferencia de H⁺ (KA del par NH₄⁺/NH₃)', nota: 'Equilibrio cuya constante es KA del par NH₄⁺/NH₃.', fuente: 'texto' }],
    ['hno3-agua', ['HNO3', 'H2O'], ['NO3-', 'H3O+'], '0.0>0.1 0.1>0.0 0.2>0.2 0.3>0.3 1.0>1.0', [FA], { tipo: 'Transferencia de H⁺ (ácido fuerte)', nota: 'Solución de ácido nítrico: la transformación es total.', fuente: 'texto' }],
    ['metanoico-agua', ['HCO2H', 'H2O'], ['HCO2-', 'H3O+'], ident(0, 0, 3) + ' 1.0>1.0', [FA], { eq: true, tipo: 'Transferencia de H⁺ (ácido débil)', nota: 'Un ácido débil no reacciona totalmente con el agua: equilibrio químico.', fuente: 'texto' }],
    ['etanoico-ho', ['CH3CO2H', 'HO-'], ['CH3CO2-', 'H2O'], '0.0>0.0 0.1>0.1 0.2>0.2 0.3>0.3 1.0>1.0', [MC], { tipo: 'Reacción de valoración', nota: 'Reacción de valoración ácido-base: CH₃CO₂H + HO⁻ → CH₃CO₂⁻ + H₂O.', fuente: 'texto' }],
    ['benzoico-ho', ['C6H5CO2H', 'HO-'], ['C6H5CO2-', 'H2O'], ident(0, 0, 9) + ' 1.0>1.0', [MC], { tipo: 'Reacción de valoración', nota: 'Valoración conductimétrica del ácido benzoico con sosa.', fuente: 'texto' }],
    ['h3o-ho', ['H3O+', 'HO-'], ['H2O', 'H2O'], '0.0>0.0 1.0>1.0', [MC], { tipo: 'Reacción de valoración', nota: 'H₃O⁺ + HO⁻ → 2 H₂O: reacción de valoración de un ácido fuerte por una base fuerte.', fuente: 'texto' }],
    ['h2o2-descomp', ['H2O2', 'H2O2'], ['H2O', 'H2O', 'O2'], '0.0>0.0 0.1>2.0 1.0>1.0 1.1>2.1', [EV], { tipo: 'Descomposición (catálisis)', nota: 'Descomposición del agua oxigenada: 2 H₂O₂ → 2 H₂O + O₂ (con Fe²⁺, Pt o catalasa).', fuente: 'texto' }],
    ['etanal-descomp', ['CH3CHO'], ['CH4', 'CO'], '0.0>0.0 0.1>1.0 0.2>1.1', [EV], { tipo: 'Descomposición', nota: 'Ej. 24: CH₃CHO(g) → CH₄(g) + CO(g), orden 1.', fuente: 'texto' }],
    ['clo-descomp', ['ClO-', 'ClO-'], ['O2', 'Cl-', 'Cl-'], '0.0>0.0 0.1>1.0 1.0>0.1 1.1>2.0', [EV], { tipo: 'Descomposición (catálisis)', nota: 'Ej. 13 (lejía): 2 ClO⁻ → O₂ + 2 Cl⁻, acelerada por Co²⁺ u otros metales.', fuente: 'texto' }],
    ['urea', ['CO(NH2)2'], ['OCN-', 'NH4+'], '0.0>0.0 0.1>0.1 0.2>1.0 0.3>0.2', [EV], { tipo: 'Isomerización (orden 1)', nota: 'Ej. 18 (urea): OC(NH₂)₂ → OCN⁻ + NH₄⁺, reacción de orden 1.', fuente: 'texto' }],
    ['zn-h3o', ['Zn', 'H3O+', 'H3O+'], ['Zn^2+', 'H2', 'H2O', 'H2O'], '0.0>0.0 1.0>2.0 2.0>3.0', [EV, GP], { tipo: 'Reacción redox (el Zn cede 2 e⁻)', nota: 'Zn(s) + 2 H₃O⁺ → Zn²⁺ + H₂(g) + 2 H₂O: la sobrepresión es proporcional a n(H₂).', fuente: 'texto' }],
    ['etanoato-ho', ['CH3CO2C2H5', 'HO-'], ['CH3CO2-', 'C2H5OH'], '0.0>0.0 0.1>0.1 0.2>0.2 0.3>1.2 0.4>1.1 0.5>1.0 1.0>0.3', [EV], { tipo: 'Hidrólisis básica de un éster', nota: 'Etanoato de etilo + HO⁻ → CH₃CO₂⁻ + C₂H₅OH (seguimiento conductimétrico).', fuente: 'texto' }],
    ['vino-vinagre', ['C2H5OH', 'O2'], ['CH3CO2H', 'H2O'], '0.0>0.0 0.1>0.1 0.2>0.3 1.0>0.2 1.1>1.0', [MP], { tipo: 'Oxidación', nota: 'El vino se transforma en vinagre: etanol + O₂ → ácido etanoico + H₂O.', fuente: 'texto' }],
    ['hso3-hs', ['HSO3-', 'HS-'], ['SO3^2-', 'H2S'], '0.0>0.1 0.1>0.0 0.2>0.2 0.3>0.3 1.0>1.0', [SE], { eq: true, tipo: 'Transferencia de H⁺ (Qr y K)', nota: 'Ejercicio 21: HSO₃⁻ + HS⁻ ⇌ SO₃²⁻ + H₂S, K(T) = 0,630.', fuente: 'texto' }],
    ['electrolisis-agua', ['H2O', 'H2O'], ['O2', 'H2', 'H2'], '0.0>0.0 1.0>0.1', [FS], { eq: true, tipo: 'Transformación forzada (electrólisis)', nota: '2 H₂O ⇌ O₂ + 2 H₂: producción de dihidrógeno por electrólisis del agua.', fuente: 'texto' }],
    ['pila-combustible', ['H2', 'H2', 'O2'], ['H2O', 'H2O'], '2.0>0.0 2.1>1.0', [FS], { tipo: 'Transformación espontánea (pila de combustible)', nota: 'Pila de combustible: reacción espontánea entre el dioxígeno y el dihidrógeno (pares H⁺/H₂ y O₂/H₂O).', fuente: 'pares del capítulo' }],
    ['esterificacion', ['C6H5CO2H', 'C2H5OH'], ['C6H5CO2C2H5', 'H2O'], ident(0, 0, 8) + ' 0.8>1.0 1.2>0.8 1.1>0.9 1.0>0.10', [SO], { eq: true, tipo: 'Condensación (esterificación)', nota: 'C₆H₅CO₂H + CH₃CH₂OH ⇌ C₆H₅CO₂CH₂CH₃ + H₂O (ejercicio 22, con APTS y calentamiento a reflujo).', fuente: 'texto' }],
    ['etanol-socl2', ['C2H5OH', 'SOCl2'], ['C2H5Cl', 'SO2', 'HCl'], '0.0>0.0 0.1>0.1 0.2>1.2 1.0>1.0 1.1>1.1 1.2>0.2 1.3>2.0', [SO], { tipo: 'Sustitución', nota: 'Ejemplo del capítulo: R–OH + SOCl₂ → R–Cl + SO₂ + HCl (aquí con R = C₂H₅).', fuente: 'texto (con R = C₂H₅)' }],
  ];
  const rdefs = {}, rorden = [];
  RXS.forEach((r) => { rdefs[r[0]] = { id: r[0], r: r[1], p: r[2], mapa: r[3], caps: r[4], opt: r[5] || {} }; rorden.push(r[0]); });

  const nomCoef = (ids) => {
    const out = []; ids.forEach((id) => { const l = out[out.length - 1]; if (l && l.id === id) l.n++; else out.push({ id, n: 1 }); });
    return out.map((o) => (o.n > 1 ? o.n + ' ' : '') + (molecula(o.id) ? molecula(o.id).formula : o.id)).join(' + ');
  };

  /**
   * Resuelve una reacción: reparte los H y devuelve el mapa completo átomo→átomo.
   * @param def {id?, reactivos:[ids], productos:[ids], mapa:'m.k>p.q …', eq?, nota?}
   * @returns {id, ecuacion, eq, reactivos:[{id, mol, base}], productos:[…], atomosR:[{m,i,el}], atomosP:[…],
   *           mapa:[ índice de átomo de producto (global) por cada átomo de reactivo (global) ], enlacesR, enlacesP, caps, nota…}
   */
  function resolverReaccion(def) {
    const R = def.reactivos.map((x) => molecula(x)), P = def.productos.map((x) => molecula(x));
    if (R.some((m) => !m) || P.some((m) => !m)) throw new Error('Reacción con molécula desconocida: ' + (def.id || ''));
    const base = (list) => { let s = 0; return list.map((m) => { const b = s; s += m.atomos.length; return b; }); };
    const bR = base(R), bP = base(P);
    const nR = R.reduce((s, m) => s + m.atomos.length, 0), nP = P.reduce((s, m) => s + m.atomos.length, 0);
    if (nR !== nP) throw new Error('Reacción no ajustada (átomos): ' + def.id + ' ' + nR + '≠' + nP);
    // átomos «pesados» = los que no son H (el H se reparte aparte); sus índices globales, molécula a molécula
    const hv = (list, bs) => list.map((m, k) => m.atomos.map((a, i) => i).filter((i) => m.atomos[i].el !== 'H').map((i) => bs[k] + i));
    const hR = hv(R, bR), hP = hv(P, bP);
    const mapa = new Array(nR).fill(-1), usadoP = new Array(nP).fill(false);
    String(def.mapa || '').trim().split(/\s+/).filter(Boolean).forEach((t) => {
      const m = /^(\d+)\.(\d+)>(\d+)\.(\d+)$/.exec(t);
      if (!m) throw new Error('Mapa no válido: ' + t);
      const a = hR[+m[1]][+m[2]], b = hP[+m[3]][+m[4]];
      if (a == null || b == null) throw new Error('Mapa fuera de rango: ' + t + ' en ' + def.id);
      mapa[a] = b; usadoP[b] = true;
    });
    // elementos coherentes
    const elR = (g) => { for (let k = R.length - 1; k >= 0; k--) if (g >= bR[k]) return R[k].atomos[g - bR[k]].el; };
    const elP = (g) => { for (let k = P.length - 1; k >= 0; k--) if (g >= bP[k]) return P[k].atomos[g - bP[k]].el; };
    mapa.forEach((b, a) => { if (b >= 0 && elR(a) !== elP(b)) throw new Error('Mapa cambia de elemento: ' + def.id + ' ' + elR(a) + '→' + elP(b)); });
    hR.flat().forEach((a) => { if (mapa[a] < 0) throw new Error('Átomo no-H sin mapear en ' + def.id + ': ' + elR(a)); });
    // reparto de H: el H se queda con su átomo pesado si el producto lo necesita; el resto va a un «pozo»
    const padreH = (list, bs, g) => { for (let k = list.length - 1; k >= 0; k--) if (g >= bs[k]) { const m = list[k], i = g - bs[k]; const e = m.enlaces.find((e) => (e.a === i || e.b === i)); return e ? bs[k] + (e.a === i ? e.b : e.a) : -1; } };
    const hijosH = (list, bs, atomo) => { const out = []; list.forEach((m, k) => m.enlaces.forEach((e) => { const a = bs[k] + e.a, b = bs[k] + e.b; if (a === atomo && m.atomos[e.b].el === 'H' && esHcolgante(m, e.b)) out.push(b); else if (b === atomo && m.atomos[e.a].el === 'H' && esHcolgante(m, e.a)) out.push(a); })); return out; };
    const pozo = [];
    hR.flat().forEach((a) => {
      const hs = hijosH(R, bR, a), b = mapa[a], need = hijosH(P, bP, b);
      hs.forEach((h, idx) => { if (idx < need.length) { mapa[h] = need[idx]; usadoP[need[idx]] = true; } else pozo.push(h); });
    });
    // H sin átomo pesado (los de H₂) también van al pozo
    for (let a = 0; a < nR; a++) if (mapa[a] < 0 && elR(a) === 'H') pozo.push(a);
    // H que faltan en los productos: se toman del pozo (el 2º reparto, geométrico, lo afina 40-reaccion.js)
    const faltan = []; for (let b = 0; b < nP; b++) if (!usadoP[b]) faltan.push(b);
    // los H libres (H₂) y los H de productos que reciben protones
    faltan.forEach((b, idx) => { if (elP(b) !== 'H') throw new Error('Producto sin origen: ' + def.id); mapa[pozo[idx]] = b; });
    if (mapa.includes(-1)) throw new Error('Reparto de H incompleto en ' + def.id);
    const atomosR = [], atomosP = [];
    R.forEach((m, k) => m.atomos.forEach((a, i) => atomosR.push({ m: k, i, el: a.el })));
    P.forEach((m, k) => m.atomos.forEach((a, i) => atomosP.push({ m: k, i, el: a.el })));
    const enl = (list, bs) => { const o = []; list.forEach((m, k) => m.enlaces.forEach((e) => o.push({ a: bs[k] + e.a, b: bs[k] + e.b, orden: e.orden }))); return o; };
    return {
      id: def.id || null, eq: !!def.eq, ecuacion: nomCoef(def.reactivos) + (def.eq ? ' ⇌ ' : ' → ') + nomCoef(def.productos),
      reactivos: R.map((m, k) => ({ id: m.id, mol: m, base: bR[k] })), productos: P.map((m, k) => ({ id: m.id, mol: m, base: bP[k] })),
      atomosR, atomosP, mapa, enlacesR: enl(R, bR), enlacesP: enl(P, bP), pozoH: pozo.slice(), nota: def.nota || '', tipo: def.tipo || '',
      fuente: def.fuente || '', capitulos: def.caps || [], mapaTxt: def.mapa,
    };
  }
  /** Un H «colgante» es un H unido a un átomo no-H (el H de H₂ o de H⁺ solo se trata como átomo libre) */
  function esHcolgante(m, i) {
    if (m.atomos[i].el !== 'H') return false;
    return m.enlaces.some((e) => (e.a === i && m.atomos[e.b].el !== 'H') || (e.b === i && m.atomos[e.a].el !== 'H'));
  }

  const rcache = {};
  function reaccionDef(id) {
    if (rcache[id]) return rcache[id];
    const d = rdefs[id];
    if (!d) return null;
    return (rcache[id] = resolverReaccion({ id, reactivos: d.r, productos: d.p, mapa: d.mapa, eq: d.opt.eq, nota: d.opt.nota, tipo: d.opt.tipo, fuente: d.opt.fuente, caps: d.caps }));
  }

  /** Moléculas y reacciones que aparecen en el cours de un capítulo (según el texto de contenido/capitulos/<id>.json) */
  function delCapitulo(capId) {
    return {
      moleculas: orden.filter((id) => defs[id].caps.includes(capId)),
      reacciones: rorden.filter((id) => rdefs[id].caps.includes(capId)),
    };
  }

  Object.assign(M, {
    molecula, resolverId, lista: (f) => orden.filter((id) => !f || !f.categoria || defs[id].cat === f.categoria),
    reaccionDef, listaReacciones: () => rorden.slice(), resolverReaccion, delCapitulo, describir, resumenAngulos, clave, esHcolgante,
    infoMolecula: (id) => defs[resolverId(id)] || null,
  });
})();
