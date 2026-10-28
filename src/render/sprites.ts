// Sprites del juego, según la hoja de estilo (estilo/gnomo.html).
import { Texture } from 'pixi.js';
import { blit, makeCanvas, mapCanvas, type Palette, type PixelMap } from './pixelart';
import { CROP_IDS, GROUP_PALETTE, JOB_IDS, ROTTEN } from '../sim/config';
import type { BubbleKind, CropId, JobId, Pose } from '../sim/types';

export const BASE: Palette = {
  O: '#1a1c2c', S: '#f2b98c', N: '#e07a5f', W: '#f4f4f4', w: '#94b0c2', B: '#257179', K: '#333c57',
  G: '#38b764', C: '#ef7d57', P: '#d9a066', p: '#a8723f', R: '#b13e53', Z: '#f4f4f4', Y: '#ffcd75',
  // agua de la regadera
  A: '#41a6f6', a: '#73eff7',
};

export const HATS: Record<JobId, [string, string]> = {
  recolector: ['#b13e53', '#5d275d'],
  sembrador: ['#a7f070', '#38b764'],
  porteador: ['#8b5a3c', '#5a3a2a'],
  regador: ['#41a6f6', '#3b5dc9'],
  guardian: ['#94b0c2', '#566c86'],
};

// ---------- Gnomo 16 × 16 ----------
const BODY: PixelMap = [
  '.......OO.......',
  '......OHHO......',
  '......OHhO......',
  '.....OHHHhO.....',
  '.....OHHHhO.....',
  '....OHHHHHhO....',
  '....OHHHHHhO....',
  '...OHHHHHHHhO...',
  '..OHHHHHHHHHhO..',
  '..OOOSSNNSSOOO..',
  '...OWSNNNNSWO...',
  '...OWWWNNWWWO...',
  '..OSOWWWWWWOSO..',
  '...OBOWWWWOBO...',
  '...OBBOwwOBBO...',
];
const squash = (body: PixelMap, drop: number[]) => body.filter((_, i) => !drop.includes(i));
const FEET = {
  n: ['...OKKO..OKKO...'],
  t: ['....OKKOOKKO....'],
  s: ['..OKKO....OKKO..'],
  // sentado: las piernas hacia delante, con los pies a los lados
  sit: ['.OKKOBBBBBBOKKO.'],
  // de culo: las piernas se levantan
  fall: ['..OOBBBBBBBBOO..'],
};
const WALK = [{ dy: 0, f: 'n' }, { dy: -1, f: 't' }, { dy: 0, f: 's' }, { dy: -1, f: 't' }] as const;
export const SACK: PixelMap = ['..G.G..', '.OOOOO.', 'OPPPPPO', 'OPPpPPO', 'OPPPPpO', '.OOOOO.'];
/** saco a la espalda según lo que lleva: 1, 2–3 o más */
const SACKS: PixelMap[] = [
  ['..G..', '.OOO.', 'OPPPO', 'OPpPO', '.OOO.'],
  SACK,
  ['...G.G...', '..OOOOO..', '.OPPPPPO.', 'OPPPPPPPO', 'OPPpPPPPO', 'OPPPPPpPO', 'OPPPPPPPO', '.OOOOOOO.'],
];

/** Píxel suelto encima del fotograma (x, y del lienzo de 16 × 17; '.' borra). */
type Px = readonly [x: number, y: number, ch: string];
// brazo derecho en alto (saluda); B lo mueve un píxel hacia fuera
const ARM_COMMON: Px[] = [[12, 13, 'O'], [13, 13, '.'], [13, 12, 'W'], [14, 12, 'O'], [13, 11, 'W'], [14, 11, 'O'], [13, 10, 'W'], [14, 10, 'O'], [13, 9, 'W'], [14, 9, 'O']];
const ARM_A: Px[] = [...ARM_COMMON, [13, 8, 'S'], [12, 8, 'O'], [14, 8, 'O'], [13, 7, 'S'], [12, 7, 'O'], [14, 7, 'O'], [13, 6, 'O']];
const ARM_B: Px[] = [...ARM_COMMON, [14, 8, 'S'], [13, 8, 'O'], [15, 8, 'O'], [14, 7, 'S'], [13, 7, 'O'], [15, 7, 'O'], [14, 6, 'O']];
// los dos brazos arriba (espanta cuervos o hace de espantapájaros): el brazo derecho y su reflejo
const ARMS_UP: Px[] = [...ARM_A, ...ARM_A.map(([x, y, ch]) => [15 - x, y, ch] as const)];
// de culo: pies en el aire a los lados y estrellitas dando vueltas
const FALL_LEGS: Px[] = [
  [1, 13, 'O'], [2, 13, 'O'], [0, 14, 'O'], [1, 14, 'K'], [2, 14, 'K'], [3, 14, 'O'], [1, 15, 'O'], [2, 15, 'B'],
  [13, 13, 'O'], [14, 13, 'O'], [12, 14, 'O'], [13, 14, 'K'], [14, 14, 'K'], [15, 14, 'O'], [14, 15, 'O'], [13, 15, 'B'],
];
const STARS: Px[][] = [
  [[2, 2, 'Y'], [12, 1, 'Y'], [8, 0, 'W']],
  [[4, 0, 'Y'], [13, 3, 'Y'], [6, 1, 'W']],
];
// regadera de zinc colgando de la mano derecha (el regador no la suelta nunca); clara para que se vea sobre la hierba
const CAN: Px[] = [
  [14, 12, 'O'], [14, 13, 'O'], [15, 13, 'O'],
  [13, 14, 'O'], [14, 14, 'a'], [15, 14, 'O'],
  [13, 15, 'O'], [14, 15, 'w'], [15, 15, 'O'],
  [13, 16, 'O'], [14, 16, 'O'], [15, 16, 'O'],
];
// regando: la regadera hacia delante e inclinada, con el pitorro abajo; las gotas caen a saltos
const WATER_CAN: Px[] = [
  [12, 11, 'O'], [13, 11, 'O'], [14, 11, 'O'],
  [13, 12, 'a'], [14, 12, 'w'], [15, 12, 'O'],
  [13, 13, 'w'], [14, 13, 'w'], [15, 13, 'O'],
  [13, 14, 'O'], [14, 14, 'O'], [15, 14, 'w'],
];
const WATER_DROPS: Px[][] = [
  [[15, 15, 'A'], [14, 16, 'a']],
  [[15, 16, 'A'], [14, 15, 'A']],
];
// bastón del guardián con un farolillo en la punta
const STAFF: Px[] = [
  [14, 2, 'O'], [13, 3, 'O'], [14, 3, 'Y'], [15, 3, 'O'], [14, 4, 'O'],
  ...[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].flatMap(y => [[14, y, 'p'], [15, y, 'O']] as Px[]),
  [13, 13, 'S'],
];
// vigilando: la mano derecha de visera bajo el ala del gorro
const WATCH_ARM: Px[] = [
  [12, 13, 'O'], [13, 13, '.'], [13, 12, 'W'], [14, 12, 'O'], [13, 11, 'W'], [14, 11, 'O'],
  [10, 10, 'S'], [11, 10, 'S'], [12, 10, 'S'], [13, 10, 'S'], [14, 10, 'O'],
];

const hatPal = (job: JobId): Palette => ({ ...BASE, H: HATS[job][0], h: HATS[job][1] });
/** Legendario: gorro dorado con una banda del color del oficio, para que se siga sabiendo qué hace. */
const legendPal = (job: JobId): Palette => ({ ...BASE, H: '#ffcd75', h: '#f4b41b', J: HATS[job][0], j: HATS[job][1] });
const LEGEND_BODY = BODY.map((r, i) => (i === 7 ? r.replace(/H/g, 'J').replace(/h/g, 'j') : r));

/** Fotograma de 16 × 17: una fila libre arriba para el saltito al andar. Los pies tocan el borde inferior. */
function gnomeCanvas(pal: Palette, body: PixelMap, feet: PixelMap, dy: number, px: readonly Px[] = []): HTMLCanvasElement {
  const c = makeCanvas(16, 17);
  const ctx = c.getContext('2d')!;
  blit(ctx, body, 0, 1 + dy + (15 - body.length), pal);
  blit(ctx, feet, 0, 16 + dy, pal);
  for (const [x, y, ch] of px) {
    if (ch === '.') {
      ctx.clearRect(x, y + dy, 1, 1);
    } else {
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x, y + dy, 1, 1);
    }
  }
  return c;
}

/** Gnomo quieto, para los iconos de los menús (con su herramienta, para distinguir oficios del mismo tono). */
export const gnomeIcon = (job: JobId) => gnomeCanvas(hatPal(job), BODY, FEET.n, 0, TOOLS[job]);

/** Estatua del Gnomo Dorado: un gnomo de oro saludando con el brazo en alto (16 × 17), luz a la izquierda. */
export const statueCanvas = () => gnomeCanvas(
  { O: '#1a1c2c', H: '#ffcd75', h: '#c28a3a', S: '#c28a3a', N: '#a8723f', W: '#f4b41b', w: '#c28a3a', B: '#a8723f', K: '#a8723f' },
  BODY, FEET.n, 0, ARM_A,
);

/** Lo que cada oficio lleva siempre en la mano al andar y trabajar. */
const TOOLS: Record<JobId, readonly Px[]> = { recolector: [], sembrador: [], porteador: [], regador: CAN, guardian: STAFF };

function gnomeFrames(pal: Palette, body: PixelMap, job: JobId): Record<Pose, Texture[]> {
  const tool = TOOLS[job];
  const f = (b: PixelMap, feet: PixelMap, dy: number, px: readonly Px[] = []) => Texture.from(gnomeCanvas(pal, b, feet, dy, px));
  // herramienta en la mano: en las poses con los brazos ocupados se suelta
  const ft = (b: PixelMap, feet: PixelMap, dy: number) => f(b, feet, dy, tool);
  const sq1 = squash(body, [4]);
  const sq2 = squash(body, [2, 4]);
  const idle = [ft(body, FEET.n, 0), ft(sq1, FEET.n, 0)];
  // el saco (o la carretilla) se dibuja aparte, porque crece con la carga
  const walk = WALK.map(w => ft(body, FEET[w.f], w.dy));
  return {
    idle,
    sleep: idle,
    walk,
    carry: walk,
    harvest: [ft(sq1, FEET.n, 0), ft(sq2, FEET.n, 0)],
    complain: [ft(body, FEET.n, 0), ft(body, FEET.n, -1)],
    // sentado: dos filas más bajo, respira despacio
    sit: [f(sq1.slice(0, -1), FEET.sit, 0), f(sq2.slice(0, -1), FEET.sit, 0)],
    wave: [f(body, FEET.n, 0, ARM_A), f(body, FEET.n, 0, ARM_B)],
    fall: STARS.map(st => f(sq2.slice(0, -1), FEET.fall, 0, [...FALL_LEGS, ...st])),
    scare: [f(body, FEET.n, 0, ARMS_UP), f(body, FEET.s, -1, ARMS_UP)],
    // regando, agachado un poco en el segundo fotograma
    water: WATER_DROPS.map((drops, i) => f(i ? sq1 : body, FEET.n, 0, [...WATER_CAN, ...drops])),
    // mirando a lo lejos: se pone de puntillas a ratos
    watch: [f(body, FEET.n, 0, WATCH_ARM), f(body, FEET.t, -1, WATCH_ARM)],
  };
}

/** Qué fotograma toca según la pose y el reloj del gnomo. */
export function frameIndex(pose: Pose, t: number): number {
  switch (pose) {
    case 'idle': return Math.floor(t * 1.5) % 2;
    case 'sleep': return Math.floor(t * 0.8) % 2;
    case 'walk':
    case 'carry': return Math.floor(t * 8) % 4;
    case 'harvest': return Math.floor(t * 4) % 2;
    case 'complain': return Math.floor(t * 6) % 2;
    case 'sit': return Math.floor(t * 0.7) % 2;
    case 'wave': return Math.floor(t * 5) % 2;
    case 'fall': return Math.floor(t * 4) % 2;
    case 'scare': return Math.floor(t * 6) % 2;
    case 'water': return Math.floor(t * 3) % 2;
    case 'watch': return Math.floor(t * 1.2) % 2;
  }
}

// ---------- Objetos y bocadillos ----------
const ITEMS: Record<CropId, PixelMap> = {
  zanahoria: ['G.G', '.G.', 'CCC', '.C.', '.C.'],
  trigo: ['Y.Y', 'YUY', '.T.', 'TTT'],
  tomate: ['.G.', 'RRR', 'RWR', 'RRR'],
  calabaza: ['.g.', 'CcC', 'CcC', 'CCC'],
  // fresa: picuda, con semillitas
  fresa: ['GlG', 'RRR', 'RYR', '.R.'],
  // melón a rayas
  melon: ['.KKK.', 'KGgGK', 'KlgGK', 'KGgGK', '.KKK.'],
};
const RING: PixelMap = ['.XXXXXXXXXX.', 'X..........X', '.XXXXXXXXXX.'];
const BASKET_BASE: PixelMap = [
  'OOOOOOOOOOOO',
  'OPpPpPpPpPpO',
  'OpPpPpPpPpPO',
  '.OPpPpPpPpO.',
  '..OOOOOOOO..',
];
/** Montón de cosecha sobre la cesta, de menos a más lleno. */
const BASKET_PILES: PixelMap[] = [
  [],
  ['...CYlRC....'],
  ['....YC.lY...', '..lCRYClRC..'],
  ['.....RY.....', '...CYlCRY...', '.YRCYlRCYlC.'],
  ['....CYRl....', '..YlCRYCl...', '.RCYlRCYlRC.', 'CYlRCYlRCYlR'],
];

/** Bocadillo de 11 × 10 con el pico abajo a la izquierda; el icono va en el hueco de 9 × 6. */
const BUBBLE: PixelMap = [
  '.OOOOOOOOO.',
  'OWWWWWWWWWO',
  'OWWWWWWWWWO',
  'OWWWWWWWWWO',
  'OWWWWWWWWWO',
  'OWWWWWWWWWO',
  'OWWWWWWWWWO',
  '.OWWOOOOOO.',
  '.OWO.......',
  '.OO........',
];
const BUBBLE_PAL: Palette = {
  O: '#1a1c2c', W: '#f4f4f4', K: '#333c57', w: '#94b0c2', R: '#b13e53', r: '#e8687d', Y: '#ffcd75', C: '#ef7d57',
  S: '#f2b98c', P: '#d9a066', p: '#a8723f', G: '#38b764', B: '#41a6f6', b: '#73eff7',
};
const BUBBLE_ICONS: Record<Exclude<BubbleKind, 'crop'>, PixelMap> = {
  sack: SACK,
  basket: ['..OOO..', '.O...O.', '.CYRGC.', 'OPpPpPO', 'OpPpPpO', '.OOOOO.'],
  zz: ['.....KKK', '......K.', 'KKKK.KKK', '..K.....', '.K......', 'KKKK....'],
  alert: ['R.R', 'R.R', 'R.R', '...', 'R.R'],
  think: ['K.K.K'],
  heart: ['.RR.RR.', 'RrRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
  // garabato rojo de enfado
  angry: ['..RRR..', '.R...RR', 'R.RRR.R', '.RR..R.', 'R..RR..', '.....R.'],
  wave: ['.O.O.O.', 'OSOSOSO', 'OSSSSSO', 'OSSSSSO', '.OSSSO.', '..OOO..'],
  chat: ['KKKKKKK', '.......', 'KKKK...'],
  cards: ['OOOO...', 'OWWOOOO', 'ORWOWKO', 'OWWOKWO', 'OOOOWWO', '...OOOO'],
  cheer: ['...C...', '..CYC..', 'CCYYYCC', '.CYYYC.', '.CY.YC.', '.C...C.'],
  // boca relamiéndose
  yum: ['K.....K', '.KKKKK.', '..rrr..'],
  note: ['..KK.', '..K.K', '..K..', '..K..', 'KKK..', 'KK...'],
  // gota de agua
  water: ['..B..', '.BBB.', 'BbBBB', 'BbBBB', '.BBB.'],
  // cubo del pozo, lleno
  well: ['..KKK..', '.K...K.', 'OBBbBBO', 'OpPpPpO', '.OpPpO.', '..OOO..'],
  // ojo bien abierto
  eye: ['..OOO..', '.OWWWO.', 'OWBKBWO', '.OWWWO.', '..OOO..'],
};

/** Carretilla de los porteadores (mira a la derecha, el asa hacia el gnomo); dos fotogramas de rueda. */
const BARROW: PixelMap[] = ['OwKO', 'OKwO'].map(wheel => [
  '....RYCGCR..',
  '...OOOOOOOOO',
  'OOOOPPPPPPPO',
  '...OpPpPpPpO',
  '....OPpPpPO.',
  '.....OOOOO..',
  `.......${wheel}.`,
  '........OO..',
]);
const BARROW_PAL: Palette = {
  O: '#1a1c2c', P: '#c8925f', p: '#8b5a3c', K: '#333c57', w: '#94b0c2', C: '#ef7d57', Y: '#ffcd75', R: '#b13e53', G: '#38b764',
};
/** caja del montón junto a la puerta del granero */
const CRATE: PixelMap = ['OOOOOOOOOOOO', 'OPpPpPpPpPpO', 'OOOOOOOOOOOO'];
/** flecha que señala al gnomo que sigue la cámara */
const ARROW: PixelMap = ['OOOOOOO', 'OYYYYYO', '.OYYYO.', '..OYO..', '...O...'];

// ---------- Bichos ----------
const CRITTER_PAL: Palette = {
  O: '#1a1c2c', K: '#333c57', k: '#566c86', C: '#ef7d57', Y: '#ffcd75', W: '#f4f4f4', w: '#94b0c2',
  P: '#d9a066', p: '#a8723f', m: '#8f5c3e', h: '#4a2c20', G: '#38b764', g: '#257179', l: '#a7f070', N: '#e07a5f',
  s: '#d2c9a5',
};
/** cuervo de lado, mirando a la derecha: quieto y picoteando */
const CROW_PECK: PixelMap[] = [
  ['......OOO..', '.....OKwKO.', '.OOOOKKKKCC', 'OkKKKKKKOO.', '.OkKKKKKO..', '..OOOOOO...', '....C.C....'],
  ['...........', '...........', '.OOOOOO....', 'OkKKKKKOOO.', '.OkKKKKKwKO', '..OOOOOOKKO', '....C.C..CC'],
];
/** cuervo volando, de frente: alas arriba y abajo */
const CROW_FLY: PixelMap[] = [
  ['O.........O', 'KO..OOO..OK', 'OKOOwKwOOKO', '.OKKKKKKKO.', '..OOKCKOO..', '....OOO....'],
  ['...........', '....OOO....', '...OwKwO...', 'OOOKKKKKOOO', 'KKO.KCK.OKK', 'O...OOO...O'],
];
/** caracol mirando a la derecha; en el segundo fotograma encoge los cuernos */
const SNAIL: PixelMap[] = [
  ['..OOOO...O.O', '.OPPPpO..s.s', 'OPpppPpOOsss', 'OPpPOpPOssss', 'OPPppPpOssss', '.OOOOOOsssss', 'sssssssssss.'],
  ['..OOOO......', '.OPPPpO..O.O', 'OPpppPpOOsss', 'OPpPOpPOssss', 'OPPppPpOssss', '.OOOOOOsssss', 'sssssssssss.'],
];
const MOLE_MOUND: PixelMap = ['...mmmm...', '.mmhmmmmm.', 'mmmmmhmmmm', '.hhhhhhhh.'];
const MOLE_HEAD: PixelMap = ['.kkkk.', 'kOkkOk', 'kkNNkk', 'WkkkkW', 'WkkkkW'];
const BUTTERFLY: PixelMap[] = [['XX.XX', 'XXOXX', '.XOX.'], ['.X.X.', '.XOX.', '..O..']];
const BUTTERFLY_COLORS = ['#ffcd75', '#e8687d', '#41a6f6', '#f4f4f4', '#ef7d57'];
/** rana: sentada y saltando */
const FROG: PixelMap[] = [
  ['.OO.OO.', 'OKGOGKO', 'OGGGGGO', 'OGlllGO', 'OOGOGOO'],
  ['.OO.OO.', 'OKGOGKO', 'OGGGGGO', '.OlllO.', '.OGOGO.', 'OGO.OGO'],
];
const SPARKLE: PixelMap = ['.W.', 'WYW', '.W.'];
/** corona del mejor de cada oficio */
const CROWN: PixelMap = ['.Y.Y.Y.', 'OYOYOYO', 'OYYRYYO', 'OYYYYYO', '.OOOOO.'];
const CROWN_PAL: Palette = { O: '#1a1c2c', Y: '#ffcd75', R: '#b13e53' };
const FLY: PixelMap = ['w.w', '.K.'];

// ---------- Plantas (16 × 14, base en la última fila, sobre el caballón) ----------
export const PLANT_PAL: Palette = {
  D: '#1c3b33', G: '#38b764', g: '#257179', l: '#a7f070', m: '#8f5c3e', h: '#4a2c20',
  C: '#ef7d57', c: '#b8503a', Y: '#ffcd75', U: '#c28a3a', T: '#d9a066', K: '#1a1c2c', w: '#a8723f',
  R: '#e04a5f', r: '#8e2f44', W: '#f4f4f4',
  // moho de lo echado a perder: grises verdosos que no se confunden con la tierra ni con lo maduro
  x: '#5d5a4e', z: '#8b8466', q: '#3f3a32',
};

// Lienzo de caracteres para los cultivos con guías, hojas y espigas.
type Grid = string[][];
const grid = (): Grid => Array.from({ length: 14 }, () => Array<string>(16).fill('.'));
const put = (g: Grid, x: number, y: number, ch: string) => {
  if (y >= 0 && y < 14 && x >= 0 && x < 16) g[y][x] = ch;
};
const stamp = (g: Grid, map: PixelMap, x: number, y: number) =>
  map.forEach((row, r) => [...row].forEach((ch, c) => ch !== '.' && put(g, x + c, y + r, ch)));
const toMap = (g: Grid): PixelMap => g.map(r => r.join(''));
const mound = (g: Grid) => {
  stamp(g, ['......mmmm......', '.....hmmmmh.....'], 0, 12);
};
const pad = (start: number, rows: string[]): PixelMap => Array<string>(start).fill('................').concat(rows);
function seed(a: string, b: string): PixelMap {
  return pad(11, [`.......${a}${b}.......`, '.....mmhhmm.....', '....hmmmmmmh....']);
}

function wheat(stage: 1 | 2 | 3 | 4): PixelMap {
  const g = grid();
  if (stage === 1) {
    for (const [x, top] of [[6, 10], [8, 9], [9, 10]]) {
      for (let y = top; y < 12; y++) put(g, x, y, y === top ? 'l' : 'G');
    }
  } else {
    const ripe = stage === 4;
    [3, 6, 9, 12].forEach((x, i) => {
      const top = stage === 2 ? [7, 6, 8, 7][i] : (ripe ? [3, 2, 3, 2] : [4, 3, 4, 3])[i];
      for (let y = top; y < 12; y++) put(g, x, y, ripe ? 'T' : 'G');
      put(g, x + (i % 2 ? 1 : -1), stage === 2 ? top + 2 : 9, ripe ? 'U' : 'G');
      if (stage === 2) {
        put(g, x, top, 'l');
        return;
      }
      // Las dos espigas pares se abren hacia fuera: centros 3, 5, 9, 13.
      const ear = ripe ? x + (i === 1 ? -1 : i === 3 ? 1 : 0) : x;
      const earTop = ripe ? top - (i % 2) : top - 1;
      for (let y = 0; y < 4; y++) {
        for (let dx = (y === 0 || y === 3 ? 0 : -1); dx <= (y === 0 || y === 3 ? 0 : 1); dx++) {
          put(g, ear + dx, earTop + y, (y + dx + 1) % 2 ? (ripe ? 'U' : 'G') : (ripe ? 'Y' : 'l'));
        }
      }
      if (ripe) put(g, ear, earTop - 1, 'Y');
    });
  }
  mound(g);
  return toMap(g);
}

const LEAF: PixelMap = ['.DD.', 'DlGD', 'DGgD', '.DD.'];

function ellipse(g: Grid, cx: number, cy: number, rx: number, ry: number, fill: string, rib: string, edge: string, ribs: number[]) {
  const inside = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < 16; x++) {
      if (!inside(x, y)) continue;
      const border = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      put(g, x, y, border ? edge : ribs.includes(Math.abs(x + 0.5 - cx)) ? rib : fill);
    }
  }
}

function pumpkin(stage: 1 | 2 | 3 | 4): PixelMap {
  const g = grid();
  for (let x = stage === 1 ? 7 : 3; x <= (stage === 1 ? 8 : 12); x++) put(g, x, 11, 'g');
  if (stage === 1) {
    stamp(g, LEAF, 4, 8);
    stamp(g, LEAF, 8, 8);
  } else if (stage === 2) {
    stamp(g, LEAF, 3, 7);
    stamp(g, LEAF, 9, 6);
  } else if (stage === 3) {
    for (const [x, y] of [[1, 5], [10, 4], [6, 2]]) stamp(g, LEAF, x, y);
    ellipse(g, 8, 10, 3, 2, 'l', 'G', 'D', [0.5]);
    put(g, 7, 7, 'g');
    stamp(g, ['.Y.', 'YYY', '.Y.'], 2, 9);
  } else {
    stamp(g, LEAF, 0, 3);
    stamp(g, LEAF, 11, 2);
    ellipse(g, 8, 9, 6, 4, 'C', 'c', 'K', [0.5, 3.5]);
    stamp(g, ['.GG.', 'G..G', '.gg.'], 6, 2);
    put(g, 8, 5, 'g');
    put(g, 4, 6, 'Y'); put(g, 5, 6, 'Y'); put(g, 4, 7, 'Y');
  }
  mound(g);
  return toMap(g);
}

const CARROT_SPROUT = pad(8, [
  '.....l....l.....',
  '.....Gl..lG.....',
  '......G..g......',
  '.......Gg.......',
  '......mmmm......',
  '.....hmmmmh.....',
]);
const CARROT_YOUNG = pad(5, [
  '.......l........',
  '....l..G...l....',
  '....Gl.G..lG....',
  '.....G.Gg.G.....',
  '.....lGGgGl.....',
  '......GGgG......',
  '.......Gg.......',
  '......mmmm......',
  '.....hmmmmh.....',
]);
const CARROT_GROWING = pad(3, [
  '.......l........',
  '...l...G...l....',
  '...Gl.lG..lG....',
  '....Gg.Gg.G.....',
  '..l..GlGgG..l...',
  '...Gl.GGgG.lG...',
  '....GGGGggGG....',
  '......GGgg......',
  '.......Gg.......',
  '......mYCm......',
  '.....hmmmmh.....',
]);
const CARROT_RIPE = pad(1, [
  '..l....l....l...',
  '.DlD..DlD..DlD..',
  '..GgD.DGD.DGg...',
  '..DlGDDGDDGlD...',
  '...DGGGGgGGD....',
  '....DGGggGD.....',
  '......Ggg.......',
  '....KKYYYYKK....',
  '....KYCCCCcK....',
  '....KCccCCcK....',
  '....KCCCCccK....',
  '....mKKccKKm....',
  '.....hmmmmh.....',
]);
const TOMATO_SPROUT = pad(4, [
  '..........w.....',
  '..........w.....',
  '..........w.....',
  '..........w.....',
  '.....DD.DDw.....',
  '....DlGDlGwD....',
  '.....DgDGgw.....',
  '.......Gg.w.....',
  '......mmmm......',
  '.....hmmmmh.....',
]);
const TOMATO_YOUNG = pad(3, [
  '..........w.....',
  '......DD..w.....',
  '.....DlGD.w.....',
  '......DgD.wDD...',
  '...DD..GgDwGlD..',
  '..DlGD.Gg.wDD...',
  '...DgDGGg.w.....',
  '......DGgDw.....',
  '.......Gg.w.....',
  '......mmmm......',
  '.....hmmmmh.....',
]);
const TOMATO_RIPE: PixelMap = [
  '..........w.....',
  '.......DD.w.....',
  '...DD.DlGDwDD...',
  '..DlGD.DGGwlGD..',
  '...DG.GGGGwDD...',
  '..DGWRGlGDwGWRD.',
  '..DGRrDGGGwGRrD.',
  '...DGGGDGGwGGD..',
  '..DlGDG.GGwGDD..',
  '...DDWRGGGwWRD..',
  '.....RrDGgwRr...',
  '.......Gg.w.....',
  '......mmmm......',
  '.....hmmmmh.....',
];
// Cada fruto conserva el cáliz; antes de madurar no tiene brillo blanco.
const TOMATO_GREEN = TOMATO_RIPE.map(r => r.replace(/[RW]/g, 'l').replace(/r/g, 'G'));
// Una flor junto al tutor, sin recolorear los frutos.
TOMATO_GREEN[7] = '...DGGGDGGwYGD..';

const FLOWER: PixelMap = ['.W.', 'WYW', '.W.'];
const BERRY: PixelMap = ['.G.', 'RYR', 'RRr', '.r.'];
/** Mata de cinco hojas; flores y frutos cuelgan por delante. */
function strawberry(stage: 1 | 2 | 3 | 4): PixelMap {
  const g = grid();
  put(g, 7, 11, 'G'); put(g, 8, 11, 'g');
  if (stage === 1) {
    for (const [x, y] of [[5, 10], [7, 8], [9, 10]]) stamp(g, ['lG', 'Gg'], x, y);
  } else if (stage === 2) {
    for (const [x, y] of [[3, 8], [7, 6], [10, 8]]) stamp(g, LEAF, x, y);
  } else {
    for (const [x, y] of [[1, 7], [4, 5], [8, 5], [12, 7], [6, 8]]) stamp(g, LEAF, x, y);
    if (stage === 3) {
      for (const [x, y] of [[1, 4], [10, 2], [12, 9]]) stamp(g, FLOWER, x, y);
    } else {
      stamp(g, FLOWER, 10, 2);
      for (const [x, y] of [[2, 8], [11, 8], [6, 8]]) stamp(g, BERRY, x, y);
    }
  }
  mound(g);
  return toMap(g);
}

/** Guía con zarcillo y fruto rayado, de pequeño a maduro. */
function melon(stage: 1 | 2 | 3 | 4): PixelMap {
  const g = grid();
  for (let x = stage === 1 ? 7 : 3; x <= (stage === 1 ? 8 : 12); x++) put(g, x, 11, 'g');
  if (stage === 1) {
    stamp(g, LEAF, 3, 8);
    stamp(g, LEAF, 8, 8);
    put(g, 12, 10, 'G'); put(g, 12, 9, 'G');
  } else if (stage === 2) {
    stamp(g, LEAF, 2, 8);
    stamp(g, LEAF, 8, 6);
    stamp(g, ['.GG', 'G.G', '.G.'], 12, 8);
  } else if (stage === 3) {
    for (const [x, y] of [[0, 6], [10, 4], [5, 3]]) stamp(g, LEAF, x, y);
    stamp(g, ['.GG', 'G.G', '.G.'], 12, 8);
    ellipse(g, 8, 10, 4, 2, 'l', 'G', 'D', [0.5, 2.5]);
    put(g, 8, 7, 'g');
  } else {
    stamp(g, LEAF, 0, 2);
    stamp(g, LEAF, 11, 1);
    ellipse(g, 8, 9, 7, 4, 'G', 'g', 'K', [0.5, 2.5, 4.5]);
    stamp(g, ['.GG', 'G.G', '.G.'], 7, 1);
    put(g, 8, 4, 'g'); put(g, 8, 5, 'g');
    put(g, 4, 6, 'l'); put(g, 5, 6, 'l'); put(g, 3, 7, 'l');
  }
  mound(g);
  return toMap(g);
}

const recolor = (map: Record<string, string>) => (m: PixelMap): PixelMap =>
  m.map(r => r.replace(/./g, ch => map[ch] ?? ch));

/** Fotograma de ráfaga: las filas de arriba de la planta se desplazan 1 px a la derecha. */
const SWAY_ROWS = 6;
function swayMap(m: PixelMap): PixelMap {
  return m.map((r, i) => {
    if (i >= SWAY_ROWS) return r;
    if (r[15] !== '.') throw new Error(`Planta recortada al mecerse: fila ${i} «${r}»`);
    return '.' + r.slice(0, 15);
  });
}

/** Madura que lleva mucho esperando: las hojas amarillean y el trigo se oscurece; el fruto aún vale. */
const passing = recolor({ G: 'U', l: 'Y', g: 'G', Y: 'U', U: 'm' });
/** Echada a perder: todo pasa a grises de moho y el fruto a marrón. */
const rotten = recolor({ G: 'x', g: 'q', l: 'z', C: 'm', c: 'h', R: 'm', r: 'h', Y: 'z', U: 'x', T: 'x', W: 'z' });

const RIPE_MAPS: Record<CropId, PixelMap> = {
  zanahoria: CARROT_RIPE, trigo: wheat(4), tomate: TOMATO_RIPE, calabaza: pumpkin(4), fresa: strawberry(4), melon: melon(4),
};

/** Fases por cultivo: semilla, brote, joven, creciendo, madura y echada a perder (índice ROTTEN). */
export const PLANT_MAPS: Record<CropId, PixelMap[]> = {
  zanahoria: [seed('T', 'U'), CARROT_SPROUT, CARROT_YOUNG, CARROT_GROWING, RIPE_MAPS.zanahoria, rotten(RIPE_MAPS.zanahoria)],
  trigo: [seed('Y', 'U'), wheat(1), wheat(2), wheat(3), RIPE_MAPS.trigo, rotten(RIPE_MAPS.trigo)],
  tomate: [seed('Y', 'T'), TOMATO_SPROUT, TOMATO_YOUNG, TOMATO_GREEN, RIPE_MAPS.tomate, rotten(RIPE_MAPS.tomate)],
  calabaza: [seed('W', 'T'), pumpkin(1), pumpkin(2), pumpkin(3), RIPE_MAPS.calabaza, rotten(RIPE_MAPS.calabaza)],
  fresa: [seed('R', 'r'), strawberry(1), strawberry(2), strawberry(3), RIPE_MAPS.fresa, rotten(RIPE_MAPS.fresa)],
  melon: [seed('T', 'w'), melon(1), melon(2), melon(3), RIPE_MAPS.melon, rotten(RIPE_MAPS.melon)],
};

const byCrop = <T>(f: (c: CropId) => T) => Object.fromEntries(CROP_IDS.map(c => [c, f(c)])) as Record<CropId, T>;
const byJob = <T>(f: (j: JobId) => T) => Object.fromEntries(JOB_IDS.map(j => [j, f(j)])) as Record<JobId, T>;

/** Aviso: la planta madura que está a punto de echarse a perder. */
export const PASSING_MAPS = byCrop(c => passing(RIPE_MAPS[c]));

// ---------- Atlas ----------
export interface Atlas {
  gnome: Record<JobId, Record<Pose, Texture[]>>;
  /** gnomos legendarios: gorro dorado */
  legendary: Record<JobId, Record<Pose, Texture[]>>;
  plants: Record<CropId, Texture[]>;
  /** madura a punto de echarse a perder */
  passing: Record<CropId, Texture>;
  /** fotograma mecido de cada fase; semilla y echada a perder reutilizan plants */
  plantsSway: Record<CropId, Texture[]>;
  /** madura a punto de echarse a perder, mecida */
  passingSway: Record<CropId, Texture>;
  items: Record<CropId, Texture>;
  /** cesta con 0..4 niveles de montón */
  basket: Texture[];
  /** aro bajo el gnomo, uno por color de GROUP_PALETTE */
  rings: Texture[];
  hole: Texture;
  shadow: Texture;
  bubbles: Record<Exclude<BubbleKind, 'crop'>, Texture>;
  cropBubbles: Record<CropId, Texture>;
  /** saco a la espalda: pequeño, mediano, grande */
  sacks: Texture[];
  barrow: Texture[];
  /** caja junto a la puerta del granero con 0..4 niveles de montón */
  pile: Texture[];
  /** puerta del granero entreabierta y abierta */
  door: Texture[];
  arrow: Texture;
  dust: Texture;
  heart: Texture;
  crowPeck: Texture[];
  crowFly: Texture[];
  snail: Texture[];
  /** topo asomando: 0 = solo el montículo … 5 = la cabeza entera fuera */
  mole: Texture[];
  /** [color][fotograma] */
  butterfly: Texture[][];
  frog: Texture[];
  sparkle: Texture;
  crown: Texture;
  fly: Texture;
  /** gota de agua para la salpicadura del riego */
  drop: Texture;
  /** medalla de los veteranos (en el pecho) */
  medal: Texture;
  /** confeti y hojas doradas de la fiesta de la temporada nueva */
  confetti: Texture[];
}

const basketPal = { ...PLANT_PAL, O: '#1a1c2c', P: '#c8925f', p: '#8b5a3c' };
const pileRows = (level: number) => Array<string>(4 - BASKET_PILES[level].length).fill('............').concat(BASKET_PILES[level]);
export function basketCanvas(level: number): HTMLCanvasElement {
  return mapCanvas([...pileRows(level), ...BASKET_BASE], basketPal);
}

const itemPal = { ...PLANT_PAL, R: '#b13e53' };

/** Bocadillo con el icono centrado en su hueco. */
function bubbleCanvas(icon: PixelMap, pal: Palette): HTMLCanvasElement {
  const c = mapCanvas(BUBBLE, BUBBLE_PAL);
  const w = Math.max(...icon.map(r => r.length));
  blit(c.getContext('2d')!, icon, 1 + Math.floor((9 - w) / 2), 1 + Math.floor((6 - icon.length) / 2), pal);
  return c;
}

/** Hueco de la puerta del granero (16 × 17) con las hojas abiertas hacia dentro `leaf` píxeles. */
function doorCanvas(leaf: number): HTMLCanvasElement {
  const c = makeCanvas(16, 17);
  const ctx = c.getContext('2d')!;
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  rect(0, 0, 16, 17, '#1a1c2c');
  rect(1, 3, 14, 14, '#333c57');
  // paja en el suelo del granero
  rect(1, 14, 14, 3, '#d9a066');
  for (const [x, y] of [[3, 14], [7, 15], [10, 14], [12, 16], [5, 16]]) rect(x, y, 1, 1, '#a8723f');
  rect(0, 0, leaf, 17, '#5d275d');
  rect(leaf - 1, 0, 1, 17, '#f4f4f4');
  rect(leaf, 0, 1, 17, '#1a1c2c');
  rect(16 - leaf, 0, leaf, 17, '#5d275d');
  rect(16 - leaf, 0, 1, 17, '#f4f4f4');
  rect(15 - leaf, 0, 1, 17, '#1a1c2c');
  return c;
}

/** Topo asomando `rise` filas de cabeza por encima del montículo (10 × 9). */
function moleCanvas(rise: number): HTMLCanvasElement {
  const c = makeCanvas(10, 9);
  const ctx = c.getContext('2d')!;
  blit(ctx, MOLE_HEAD.slice(0, rise), 2, 6 - rise, CRITTER_PAL);
  blit(ctx, MOLE_MOUND, 0, 5, CRITTER_PAL);
  return c;
}

export function buildAtlas(): Atlas {
  const tex = (map: PixelMap, pal: Palette) => Texture.from(mapCanvas(map, pal));
  const shadow = makeCanvas(10, 1);
  const sctx = shadow.getContext('2d')!;
  sctx.fillStyle = 'rgba(26,28,44,.28)';
  sctx.fillRect(0, 0, 10, 1);
  const bubble = (icon: PixelMap) => Texture.from(bubbleCanvas(icon, BUBBLE_PAL));
  const kinds = Object.keys(BUBBLE_ICONS) as Exclude<BubbleKind, 'crop'>[];
  const plants = byCrop(c => PLANT_MAPS[c].map(m => tex(m, PLANT_PAL)));
  return {
    gnome: byJob(j => gnomeFrames(hatPal(j), BODY, j)),
    legendary: byJob(j => gnomeFrames(legendPal(j), LEGEND_BODY, j)),
    plants,
    plantsSway: byCrop(c => PLANT_MAPS[c].map((m, i) => (i === 0 || i === ROTTEN ? plants[c][i] : tex(swayMap(m), PLANT_PAL)))),
    passing: byCrop(c => tex(PASSING_MAPS[c], PLANT_PAL)),
    passingSway: byCrop(c => tex(swayMap(PASSING_MAPS[c]), PLANT_PAL)),
    items: byCrop(c => tex(ITEMS[c], itemPal)),
    basket: BASKET_PILES.map((_, level) => Texture.from(basketCanvas(level))),
    rings: GROUP_PALETTE.map(color => tex(RING, { X: color })),
    hole: tex(['.hhhh.', 'hHHHHh', '.hhhh.'], { h: '#5c3a29', H: '#4a2c20' }),
    shadow: Texture.from(shadow),
    bubbles: Object.fromEntries(kinds.map(k => [k, bubble(BUBBLE_ICONS[k])])) as Atlas['bubbles'],
    cropBubbles: byCrop(c => Texture.from(bubbleCanvas(ITEMS[c], itemPal))),
    sacks: SACKS.map(m => tex(m, BASE)),
    barrow: BARROW.map(m => tex(m, BARROW_PAL)),
    pile: BASKET_PILES.map((_, level) => tex([...pileRows(level), ...CRATE], basketPal)),
    door: [Texture.from(doorCanvas(5)), Texture.from(doorCanvas(3))],
    arrow: tex(ARROW, { O: '#1a1c2c', Y: '#ffcd75' }),
    dust: tex(['ww', 'ww'], { w: '#e0d2b4' }),
    drop: tex(['a', 'A'], BASE),
    heart: tex(['r.r', 'rrr', '.r.'], { r: '#e8687d' }),
    crowPeck: CROW_PECK.map(m => tex(m, CRITTER_PAL)),
    crowFly: CROW_FLY.map(m => tex(m, CRITTER_PAL)),
    snail: SNAIL.map(m => tex(m, CRITTER_PAL)),
    mole: [0, 1, 2, 3, 4, 5].map(rise => Texture.from(moleCanvas(rise))),
    butterfly: BUTTERFLY_COLORS.map(X => BUTTERFLY.map(m => tex(m, { X, O: '#1a1c2c' }))),
    frog: FROG.map(m => tex(m, CRITTER_PAL)),
    sparkle: tex(SPARKLE, { W: '#f4f4f4', Y: '#ffcd75' }),
    crown: tex(CROWN, CROWN_PAL),
    fly: tex(FLY, { w: '#94b0c2', K: '#1a1c2c' }),
    medal: tex(['RB', 'YY', 'yy'], { R: '#b13e53', B: '#3b5dc9', Y: '#ffcd75', y: '#c28a3a' }),
    confetti: [
      tex(['YY'], { Y: '#ffcd75' }), tex(['R', 'R'], { R: '#e8687d' }), tex(['BB'], { B: '#41a6f6' }), tex(['G', 'G'], { G: '#a7f070' }),
      // hoja dorada
      tex(['.Y', 'Yy'], { Y: '#ffcd75', y: '#f4b41b' }), tex(['Yy.', '.yY'], { Y: '#ffcd75', y: '#c28a3a' }),
    ],
  };
}

export const crownCanvas = () => mapCanvas(CROWN, CROWN_PAL);
