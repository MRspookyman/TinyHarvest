// Gnomo a doble resolución: 32 × 34 píxeles de dibujo (16 × 17 unidades del mundo, como antes).
// Se pinta por capas (gorro, cara, túnica y brazos, barba, nariz, botas, herramienta) y el contorno oscuro se añade
// solo alrededor. Luz desde arriba a la izquierda. Prototipo y comparativa en estilo/gnomo-32.html.
import type { Texture } from 'pixi.js';
import { artTexture, makeCanvas, type Palette } from './pixelart';
import type { JobId, Pose } from '../sim/types';

const W = 32;
const H = 34;
/** filas libres arriba para el saltito y la punta del gorro */
const TOP = 2;

type Grid = string[][];
type Arms = 'lados' | 'delante' | 'saludoA' | 'saludoB' | 'arriba' | 'visera' | 'regar';
type Tool = 'regadera' | 'baston' | null;

/** Gorro (base, sombra) de cada oficio: el color dice el oficio. */
export const HAT_COLORS: Record<JobId, [string, string]> = {
  recolector: ['#b13e53', '#5d275d'],
  sembrador: ['#a7f070', '#38b764'],
  porteador: ['#8b5a3c', '#5a3a2a'],
  regador: ['#41a6f6', '#3b5dc9'],
  guardian: ['#94b0c2', '#566c86'],
};
const TOOLS: Record<JobId, Tool> = { recolector: null, sembrador: null, porteador: null, regador: 'regadera', guardian: 'baston' };

/** Mezcla un color con blanco (t > 0) o con negro (t < 0). */
function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => Math.round(t > 0 ? c + (255 - c) * t : c * (1 + t)));
  return `#${ch.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Paleta del gnomo para un gorro; `banda` cambia el ala (legendarios: gorro de oro con el ala de su oficio). */
function palette(hat: [string, string], banda?: [string, string]): Palette {
  const [h, hs] = hat;
  return {
    O: '#1a1c2c',
    I: shade(h, 0.3), H: h, h: hs, J: banda ? banda[0] : shade(h, -0.15), j: banda ? banda[1] : shade(hs, -0.2),
    S: '#f2b98c', s: '#d69a72', c: '#e8687d',
    L: '#f7b39a', N: '#e07a5f', n: '#b55b46', q: '#7a3a35',
    W: '#f4f4f4', w: '#d0dbe4', V: '#94b0c2',
    T: '#3a9a8f', B: '#257179', b: '#1a4e5c', R: '#5a3a2a', Y: '#ffcd75',
    P: '#d9a066', p: '#a8723f', K: '#333c57', k: '#566c86',
    // herramientas: zinc de la regadera, agua, madera del bastón, luz del farol
    Z: '#c2d3e0', z: '#7d8fa0', A: '#73eff7', a: '#41a6f6', M: '#a8723f', m: '#5a3a2a', F: '#fff3b0',
  };
}
const GOLD: [string, string] = ['#ffcd75', '#f4b41b'];

const empty = (): Grid => Array.from({ length: H }, () => Array<string>(W).fill('.'));

function put(g: Grid, x: number, y: number, ch: string) {
  if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = ch;
}

/** Fila de colores a partir de (x, y) del dibujo de 32 × 32 ('.' deja lo que hubiera). */
function row(g: Grid, x: number, y: number, s: string) {
  for (let i = 0; i < s.length; i++) if (s[i] !== '.') put(g, x + i, y + TOP, s[i]);
}

/** Tramo de x0 a x1 con brillo a la izquierda y sombra a la derecha. */
function span(g: Grid, x0: number, x1: number, y: number, lit: string, base: string, dark: string, nLit = 1, nDark = 2) {
  for (let x = x0; x <= x1; x++) put(g, x, y + TOP, x < x0 + nLit ? lit : x > x1 - nDark ? dark : base);
}

function hat(g: Grid, dy: number, sway: number) {
  // cono con la punta caída hacia la derecha (la punta se mece al andar)
  const spans: [number, number][] = [
    [18, 19], [17, 19], [15, 18], [14, 18], [14, 18], [13, 19], [13, 19], [12, 19], [12, 20], [11, 20], [10, 21], [9, 21],
  ];
  spans.forEach(([x0, x1], i) => {
    const off = i < 3 ? sway : 0;
    const wide = x1 - x0 >= 5;
    span(g, x0 + off, x1 + off, 1 + i + dy, 'I', 'H', 'h', i < 2 ? 0 : wide ? 2 : 1, wide ? 2 : 1);
  });
  // un remiendo cosido en el gorro
  row(g, 16, 8 + dy, 'hh');
  row(g, 16, 9 + dy, 'hh');
  put(g, 15, 8 + dy + TOP, 'I');
  // ala ancha, con las puntas algo caídas
  span(g, 7, 23, 13 + dy, 'H', 'J', 'j', 3, 3);
  put(g, 7, 14 + dy + TOP, 'j');
  put(g, 23, 14 + dy + TOP, 'j');
}

function face(g: Grid, dy: number) {
  row(g, 8, 14 + dy, '.sssssssssssssss');
  row(g, 9, 15 + dy, 'sSSSSSSSSSSSs');
  row(g, 9, 16 + dy, 'cSSSSSSSSSSSc');
  row(g, 9, 17 + dy, 'SSSSSSSSSSSSS');
}

/** Brazo en alto, por fuera del ala del gorro para que se lea; `out` lo abre un píxel más (saludo). */
function armUp(g: Grid, dy: number, side: 1 | -1, out: number) {
  const x = side === 1 ? 24 + out : 5 - out;
  for (let y = 12; y <= 21; y++) row(g, x, y + dy, side === 1 ? 'Bb' : 'TB');
  row(g, x, 9 + dy, 'PP');
  row(g, x, 10 + dy, side === 1 ? 'PP' : 'PP');
  row(g, x, 11 + dy, side === 1 ? 'Pp' : 'Pp');
}

/** `swing`: al andar, una mano sube un píxel y la otra baja (1 = la izquierda sube, −1 = la derecha). */
function tunic(g: Grid, dy: number, arms: Arms, swing = 0) {
  for (let y = 19; y <= 28; y++) {
    const x0 = y < 21 ? 9 : 8, x1 = y < 21 ? 21 : 22;
    span(g, x0, x1, y + dy, 'T', 'B', 'b', 2, 3);
  }
  row(g, 8, 26 + dy, 'RRRRRRRRRRRRRRR');
  row(g, 14, 26 + dy, 'YYY');
  const leftDown = (d = 0) => {
    for (const y of [21, 22, 23]) row(g, 6, y + dy + Math.min(0, d), 'TB');
    row(g, 5, 24 + dy + d, 'PPp');
    row(g, 5, 25 + dy + d, 'Ppp');
  };
  const rightDown = (d = 0) => {
    for (const y of [21, 22, 23]) row(g, 23, y + dy + Math.min(0, d), 'Bb');
    row(g, 23, 24 + dy + d, 'PPp');
    row(g, 23, 25 + dy + d, 'ppp');
  };
  switch (arms) {
    case 'lados':
      leftDown(-swing);
      rightDown(swing);
      break;
    case 'delante':
      // recogiendo: las manos delante, a los lados de la barba
      row(g, 6, 24 + dy, 'PPp');
      row(g, 6, 25 + dy, 'Ppp');
      row(g, 22, 24 + dy, 'PPp');
      row(g, 22, 25 + dy, 'ppp');
      break;
    case 'saludoA':
    case 'saludoB':
      leftDown();
      armUp(g, dy, 1, arms === 'saludoB' ? 1 : 0);
      break;
    case 'arriba':
      armUp(g, dy, 1, 0);
      armUp(g, dy, -1, 0);
      break;
    case 'visera':
      // la mano derecha de visera sobre el ala del gorro, el brazo subiendo por fuera
      leftDown();
      for (let y = 13; y <= 21; y++) row(g, 24, y + dy, 'Bb');
      row(g, 19, 11 + dy, 'PPPPPp');
      row(g, 19, 12 + dy, 'ppppPp');
      break;
    case 'regar':
      // el brazo derecho hacia delante, sujetando la regadera
      leftDown();
      row(g, 23, 21 + dy, 'BBb');
      row(g, 24, 22 + dy, 'Bbb');
      break;
  }
}

function beard(g: Grid, dy: number, sway: number) {
  // barba de gnomo: ancha bajo la nariz y acabada en punta; mechones en vertical, sombra a la derecha
  const half = [6, 7, 7.5, 7.5, 7.5, 7, 6.5, 6, 5, 4, 3, 2];
  half.forEach((hw, i) => {
    const y = 17 + i;
    const off = i >= 8 ? sway : 0;
    const x0 = Math.round(15 - hw) + off, x1 = Math.round(15 + hw) + off;
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / Math.max(1, x1 - x0);
      const strand = (x + Math.floor(i / 3)) % 4 === 0 && i > 2 && t > 0.15 && t < 0.85;
      put(g, x, y + dy + TOP, t > 0.82 ? 'V' : t > 0.6 || strand ? 'w' : 'W');
    }
  });
  row(g, 9, 18 + dy, 'WWWWW.....WWwV');
  row(g, 8, 19 + dy, 'WWWWWWWWWWWWWWwV');
}

function nose(g: Grid, dy: number) {
  const map = ['..qqqq..', '.qLLNnq.', 'qLNNNnnq', 'qNNNNnnq', '.qnnnnq.', '..qqqq..'];
  map.forEach((s, i) => row(g, 11, 13 + i + dy, s));
}

type Feet = { l: number; r: number; liftL: number; liftR: number };
const STAND: Feet = { l: 9, r: 17, liftL: 0, liftR: 0 };
const WALK: Feet[] = [STAND, { l: 10, r: 16, liftL: 1, liftR: 0 }, { l: 8, r: 18, liftL: 0, liftR: 0 }, { l: 10, r: 16, liftL: 0, liftR: 1 }];

function boots(g: Grid, f: Feet) {
  for (const [x, lift] of [[f.l, f.liftL], [f.r, f.liftR]] as const) {
    row(g, x, 28 - lift, 'kkK');
    row(g, x, 29 - lift, 'kKKKK');
    row(g, x, 30 - lift, 'KKKKK');
  }
}

/** Sentado (o de culo): las piernas hacia delante, con las botas a los lados; `up` las levanta en el aire. */
function sitLegs(g: Grid, up: boolean) {
  if (!up) {
    for (const [x, flip] of [[3, false], [23, true]] as const) {
      row(g, flip ? x - 2 : x + 2, 29, 'BBBBB');
      row(g, x, 29, flip ? 'KKKKk' : 'kKKKK');
      row(g, x, 30, 'KKKKK');
    }
    return;
  }
  // de culo: las piernas en diagonal hacia arriba y las botas al aire
  for (const [x0, dir] of [[7, -1], [24, 1]] as const) {
    for (let i = 0; i < 4; i++) row(g, x0 + dir * i, 27 - i, 'BB');
    row(g, dir < 0 ? 1 : 26, 21, 'kKKK');
    row(g, dir < 0 ? 1 : 26, 22, 'KKKK');
  }
}

function tool(g: Grid, t: Tool, dy: number) {
  if (t === 'regadera') {
    // regadera de zinc colgando de la mano derecha
    row(g, 24, 26 + dy, '.zz.');
    row(g, 23, 27 + dy, 'ZZZzz');
    row(g, 23, 28 + dy, 'ZZZzzz');
    row(g, 23, 29 + dy, 'ZZzzz.');
    row(g, 28, 27 + dy, 'z');
  } else if (t === 'baston') {
    // bastón con un farolillo en la punta
    for (let y = 9; y <= 31; y++) row(g, 27, y + dy, 'Mm');
    row(g, 26, 5 + dy, '.mm.');
    row(g, 26, 6 + dy, 'mFFm');
    row(g, 26, 7 + dy, 'mFYm');
    row(g, 26, 8 + dy, '.mm.');
  }
}

/** Regadera inclinada hacia delante, con gotas que caen a saltos. */
function waterCan(g: Grid, dy: number, drops: number) {
  row(g, 25, 20 + dy, 'zz');
  row(g, 24, 21 + dy, 'ZZZz');
  row(g, 24, 22 + dy, 'ZZZzz');
  row(g, 25, 23 + dy, 'Zzzzz');
  row(g, 29, 24 + dy, 'zz');
  const d = drops ? [[30, 26], [29, 28], [31, 30]] : [[31, 27], [30, 29], [29, 31]];
  for (const [x, y] of d) row(g, x, y + dy, 'A');
}

/** Contorno de un píxel alrededor de todo lo pintado. */
function outline(g: Grid): Grid {
  const out = g.map(r => [...r]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g[y][x] !== '.') continue;
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (g[y + dy]?.[x + dx] ?? '.') !== '.');
      if (touches) out[y][x] = 'O';
    }
  }
  return out;
}

interface Opts {
  /** desplazamiento vertical de todo el cuerpo (−1 = saltito) */
  dy?: number;
  /** agacharse: el cuerpo baja y se encoge sobre las botas */
  low?: number;
  sway?: number;
  arms?: Arms;
  feet?: Feet;
  sit?: 'sentado' | 'culo';
  tool?: Tool;
  water?: number;
  /** estrellitas dando vueltas (de culo) */
  stars?: number;
}

function gnomeGrid(o: Opts): Grid {
  const g = empty();
  const dy = (o.dy ?? 0) + (o.low ?? 0) + (o.sit ? 3 : 0);
  const sway = o.sway ?? 0;
  if (o.tool === 'baston') tool(g, 'baston', o.dy ?? 0);
  hat(g, dy, sway);
  face(g, dy);
  tunic(g, (o.dy ?? 0) + Math.min(o.low ?? 0, 1) + (o.sit ? 3 : 0), o.arms ?? 'lados', sway);
  beard(g, dy, -sway);
  nose(g, dy);
  if (o.sit) sitLegs(g, o.sit === 'culo');
  else boots(g, o.feet ?? STAND);
  if (o.tool === 'regadera') tool(g, 'regadera', o.dy ?? 0);
  if (o.water !== undefined) waterCan(g, dy, o.water);
  const out = outline(g);
  if (o.stars !== undefined) {
    // estrellitas por encima del contorno, sin contorno propio
    const st = o.stars ? [[4, 2], [26, 4], [14, 0]] : [[8, 0], [27, 6], [12, 3]];
    for (const [x, y] of st) out[y][x] = 'Y';
  }
  return out;
}

function canvas(g: Grid, pal: Palette): HTMLCanvasElement {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d')!;
  g.forEach((r, y) => r.forEach((ch, x) => {
    if (ch === '.') return;
    ctx.fillStyle = pal[ch] ?? '#ff00ff';
    ctx.fillRect(x, y, 1, 1);
  }));
  return c;
}

/** Fotogramas de cada pose (los índices los elige frameIndex). */
function poses(job: JobId): Record<Pose, Opts[]> {
  const t = TOOLS[job];
  const walk = WALK.map((feet, i): Opts => ({ feet, dy: i % 2 ? -1 : 0, sway: i === 1 ? 1 : i === 3 ? -1 : 0, tool: t }));
  const idle: Opts[] = [{ tool: t }, { tool: t, low: 1 }];
  return {
    idle,
    sleep: idle,
    walk,
    carry: walk,
    harvest: [{ low: 1, arms: 'delante' }, { low: 2, arms: 'delante' }],
    complain: [{ tool: t, arms: 'arriba' }, { tool: t, arms: 'arriba', dy: -1 }],
    sit: [{ sit: 'sentado' }, { sit: 'sentado', low: 1 }],
    wave: [{ arms: 'saludoA' }, { arms: 'saludoB' }],
    fall: [{ sit: 'culo', stars: 0 }, { sit: 'culo', stars: 1 }],
    scare: [{ arms: 'arriba' }, { arms: 'arriba', dy: -1, feet: WALK[2] }],
    water: [{ arms: 'regar', water: 0 }, { arms: 'regar', water: 1, low: 1 }],
    watch: [{ arms: 'visera', tool: t === 'baston' ? null : t }, { arms: 'visera', dy: -1, feet: WALK[1] }],
  };
}

export function gnomeTextures(job: JobId, legendary: boolean): Record<Pose, Texture[]> {
  const pal = legendary ? palette(GOLD, HAT_COLORS[job]) : palette(HAT_COLORS[job]);
  const all = poses(job);
  return Object.fromEntries(
    (Object.keys(all) as Pose[]).map(p => [p, all[p].map(o => artTexture(canvas(gnomeGrid(o), pal)))]),
  ) as Record<Pose, Texture[]>;
}

/** Gnomo de oro saludando con el brazo en alto, para la estatua (32 × 34), luz a la izquierda. */
export function statueGnomeCanvas(): HTMLCanvasElement {
  const gold = palette(GOLD);
  const pal: Palette = {
    ...gold,
    S: '#e3a94a', s: '#c28a3a', c: '#c28a3a', L: '#ffe08a', N: '#d9a03a', n: '#a8723f', q: '#7a5525',
    W: '#f4b41b', w: '#d9a03a', V: '#a8723f', T: '#e3a94a', B: '#c28a3a', b: '#8f6328', R: '#7a5525', Y: '#ffe08a',
    P: '#e3a94a', p: '#a8723f', K: '#a8723f', k: '#c28a3a',
  };
  return canvas(gnomeGrid({ arms: 'saludoA' }), pal);
}

/** Gnomo quieto con su herramienta, para los iconos de la interfaz (32 × 34). */
export function gnomeIconCanvas(job: JobId): HTMLCanvasElement {
  return canvas(gnomeGrid({ tool: TOOLS[job] }), palette(HAT_COLORS[job]));
}
