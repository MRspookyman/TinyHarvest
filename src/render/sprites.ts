// Sprites del juego, según la hoja de estilo (estilo/gnomo.html).
import { Texture } from 'pixi.js';
import { blit, makeCanvas, mapCanvas, type Palette, type PixelMap } from './pixelart';
import { GROUP_PALETTE } from '../sim/config';
import type { BubbleKind, CropId, JobId, Pose } from '../sim/types';

export const BASE: Palette = {
  O: '#1a1c2c', S: '#f2b98c', N: '#e07a5f', W: '#f4f4f4', w: '#94b0c2', B: '#257179', K: '#333c57',
  G: '#38b764', C: '#ef7d57', P: '#d9a066', p: '#a8723f', R: '#b13e53', Z: '#f4f4f4', Y: '#ffcd75',
};

export const HATS: Record<JobId, [string, string]> = {
  recolector: ['#b13e53', '#5d275d'],
  sembrador: ['#a7f070', '#38b764'],
  porteador: ['#8b5a3c', '#5a3a2a'],
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

/** Gnomo quieto, para los iconos de los menús. */
export const gnomeIcon = (job: JobId) => gnomeCanvas(hatPal(job), BODY, FEET.n, 0);

function gnomeFrames(pal: Palette, body: PixelMap): Record<Pose, Texture[]> {
  const f = (b: PixelMap, feet: PixelMap, dy: number, px?: readonly Px[]) => Texture.from(gnomeCanvas(pal, b, feet, dy, px));
  const sq1 = squash(body, [4]);
  const sq2 = squash(body, [2, 4]);
  const idle = [f(body, FEET.n, 0), f(sq1, FEET.n, 0)];
  // el saco (o la carretilla) se dibuja aparte, porque crece con la carga
  const walk = WALK.map(w => f(body, FEET[w.f], w.dy));
  return {
    idle,
    sleep: idle,
    walk,
    carry: walk,
    harvest: [f(sq1, FEET.n, 0), f(sq2, FEET.n, 0)],
    complain: [f(body, FEET.n, 0), f(body, FEET.n, -1)],
    // sentado: dos filas más bajo, respira despacio
    sit: [f(sq1.slice(0, -1), FEET.sit, 0), f(sq2.slice(0, -1), FEET.sit, 0)],
    wave: [f(body, FEET.n, 0, ARM_A), f(body, FEET.n, 0, ARM_B)],
    fall: STARS.map(st => f(sq2.slice(0, -1), FEET.fall, 0, [...FALL_LEGS, ...st])),
    scare: [f(body, FEET.n, 0, ARMS_UP), f(body, FEET.s, -1, ARMS_UP)],
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
  }
}

// ---------- Objetos y bocadillos ----------
const ITEMS: Record<CropId, PixelMap> = {
  zanahoria: ['G.G', '.G.', 'CCC', '.C.', '.C.'],
  trigo: ['Y.Y', 'YUY', '.T.', 'TTT'],
  tomate: ['.G.', 'RRR', 'RWR', 'RRR'],
  calabaza: ['.g.', 'CcC', 'CcC', 'CCC'],
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
  S: '#f2b98c', P: '#d9a066', p: '#a8723f', G: '#38b764',
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

// El trigo y la calabaza se generan con un pequeño lienzo de caracteres en vez de dibujarse a mano.
type Grid = string[][];
const grid = (): Grid => Array.from({ length: 14 }, () => Array<string>(16).fill('.'));
const put = (g: Grid, x: number, y: number, ch: string) => {
  if (y >= 0 && y < 14 && x >= 0 && x < 16) g[y][x] = ch;
};
const stamp = (g: Grid, map: PixelMap, x: number, y: number) =>
  map.forEach((row, r) => [...row].forEach((ch, c) => ch !== '.' && put(g, x + c, y + r, ch)));
const toMap = (g: Grid): PixelMap => g.map(r => r.join(''));
const mound = (g: Grid) => {
  for (let x = 6; x <= 9; x++) put(g, x, 12, 'm');
  for (let x = 5; x <= 10; x++) put(g, x, 13, 'm');
};

function wheat(stage: 2 | 3 | 4): PixelMap {
  const g = grid();
  mound(g);
  const ripe = stage === 4;
  const heights = stage === 2 ? [3, 4, 3, 4] : stage === 3 ? [7, 8, 7, 8] : [9, 10, 8, 10];
  [3, 6, 9, 12].forEach((x, i) => {
    const top = 12 - heights[i];
    for (let y = top; y <= 12; y++) put(g, x, y, ripe ? 'T' : 'G');
    if (stage === 2) {
      put(g, x - 1, top + 1, 'l');
      return;
    }
    // espiga: verde al crecer, dorada al madurar
    const [a, b] = ripe ? ['Y', 'U'] : ['l', 'G'];
    put(g, x, top, a);
    put(g, x - 1, top + 1, a); put(g, x, top + 1, b); put(g, x + 1, top + 1, a);
    put(g, x - 1, top + 2, b); put(g, x, top + 2, a); put(g, x + 1, top + 2, b);
    put(g, x, top + 3, a);
    put(g, x + (i % 2 ? -1 : 1), top + 6, ripe ? 'U' : 'G');
  });
  return toMap(g);
}

const LEAF: PixelMap = ['.DD.', 'DlGD', 'DGGD', '.DD.'];

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

function pumpkin(stage: 2 | 3 | 4): PixelMap {
  const g = grid();
  mound(g);
  for (let x = 3; x <= 12; x++) put(g, x, 11, 'g');
  if (stage === 2) {
    stamp(g, LEAF, 3, 7);
    stamp(g, LEAF, 9, 6);
  } else if (stage === 3) {
    stamp(g, LEAF, 1, 5);
    stamp(g, LEAF, 11, 4);
    stamp(g, LEAF, 6, 2);
    ellipse(g, 8, 9.5, 3, 2.2, 'l', 'G', 'D', [0.5]);
  } else {
    stamp(g, LEAF, 0, 4);
    stamp(g, LEAF, 12, 3);
    ellipse(g, 8, 8.5, 6, 4, 'C', 'c', 'K', [0.5, 3.5]);
    put(g, 7, 3, 'g'); put(g, 8, 3, 'g'); put(g, 8, 4, 'g');
    put(g, 4, 6, 'Y'); put(g, 5, 6, 'Y'); put(g, 4, 7, 'Y');
  }
  return toMap(g);
}
const pad = (start: number, rows: string[]) => Array<string>(start).fill('................').concat(rows);

const SEED = pad(11, [
  '......mmmm......',
  '.....mmhhmm.....',
  '......mmmm......',
]);
const SPROUT = pad(7, [
  '....DD....DD....',
  '...DlGD..DGlD...',
  '....DGGDDGGD....',
  '.....DDGGDD.....',
  '.......GD.......',
  '......mGgm......',
  '.....mmmmmm.....',
]);
const CARROT_GROWING = pad(5, [
  '....D...D..D....',
  '...DlD.DlDDlD...',
  '...DGD.DGDDGD...',
  '....DGDGGDGD....',
  '.....DGGGGD.....',
  '......DGgD......',
  '.......gg.......',
  '......mCCm......',
  '.....mmmmmm.....',
]);
const CARROT_YOUNG = CARROT_GROWING.map(r => r.replace(/C/g, 'g'));
const CARROT_RIPE = pad(1, [
  '...D....D....D..',
  '..DlD..DlD..DlD.',
  '..DGD..DGD..DGD.',
  '..DGlD.DGD.DlGD.',
  '...DGGDDGDDGGD..',
  '....DGGGGGGGD...',
  '.....DGGgGGD....',
  '......DgggD.....',
  '.....KCYCCcK....',
  '.....KCCCCcK....',
  '....mKCCCccKm...',
  '....mmKKKKKmm...',
  '.....mmmmmmm....',
]);
const TOMATO_YOUNG = pad(3, [
  '..........w.....',
  '..........w.....',
  '......DD..w.....',
  '.....DlGD.w.....',
  '....DGGGGDwD....',
  '....DGlGGGwGD...',
  '.....DGGGgwGD...',
  '......DGgDwD....',
  '.......gg.w.....',
  '......mmggwm....',
  '.....mmmmmmmm...',
]);
const TOMATO_RIPE = [
  '..........w.....',
  '.........DwD....',
  '....DDD.DGwGD...',
  '...DGlGDGGwlGD..',
  '..DGGRRGGGwGGGD.',
  '..DGRWRRGGwRRGD.',
  '..DGRRRRGgwRWRD.',
  '...DGRRrGGwRRrD.',
  '...DGGrGRRwGrD..',
  '....DGgRWRwRGD..',
  '.....DgRRrwrD...',
  '......DgrrwD....',
  '......mmggwmm...',
  '.....mmmmmmmmm..',
];
// tomates verdes: la misma mata antes de enrojecer
const TOMATO_GREEN = TOMATO_RIPE.map(r => r.replace(/R/g, 'l').replace(/r/g, 'G'));
const SPROUT_STAKE = SPROUT.map((r, i) => (i >= 4 && i <= 12 ? r.slice(0, 10) + 'w' + r.slice(11) : r));

const recolor = (map: Record<string, string>) => (m: PixelMap): PixelMap =>
  m.map(r => r.replace(/./g, ch => map[ch] ?? ch));
/** Madura que lleva mucho esperando: las hojas amarillean y el trigo se oscurece; el fruto aún vale. */
const passing = recolor({ G: 'U', l: 'Y', g: 'G', Y: 'U', U: 'm' });
/** Echada a perder: todo pasa a grises de moho y el fruto a marrón. */
const rotten = recolor({ G: 'x', g: 'q', l: 'z', C: 'm', c: 'h', R: 'm', r: 'h', Y: 'z', U: 'x', T: 'x', W: 'z' });

const RIPE_MAPS: Record<CropId, PixelMap> = { zanahoria: CARROT_RIPE, trigo: wheat(4), tomate: TOMATO_RIPE, calabaza: pumpkin(4) };

/** Fases por cultivo: semilla, brote, joven, creciendo, madura y echada a perder (índice ROTTEN). */
export const PLANT_MAPS: Record<CropId, PixelMap[]> = {
  zanahoria: [SEED, SPROUT, CARROT_YOUNG, CARROT_GROWING, RIPE_MAPS.zanahoria, rotten(RIPE_MAPS.zanahoria)],
  trigo: [SEED, SPROUT, wheat(2), wheat(3), RIPE_MAPS.trigo, rotten(RIPE_MAPS.trigo)],
  tomate: [SEED, SPROUT_STAKE, TOMATO_YOUNG, TOMATO_GREEN, RIPE_MAPS.tomate, rotten(RIPE_MAPS.tomate)],
  calabaza: [SEED, SPROUT, pumpkin(2), pumpkin(3), RIPE_MAPS.calabaza, rotten(RIPE_MAPS.calabaza)],
};
/** Aviso: la planta madura que está a punto de echarse a perder. */
export const PASSING_MAPS: Record<CropId, PixelMap> = {
  zanahoria: passing(RIPE_MAPS.zanahoria), trigo: passing(RIPE_MAPS.trigo),
  tomate: passing(RIPE_MAPS.tomate), calabaza: passing(RIPE_MAPS.calabaza),
};

// ---------- Atlas ----------
export interface Atlas {
  gnome: Record<JobId, Record<Pose, Texture[]>>;
  /** gnomos legendarios: gorro dorado */
  legendary: Record<JobId, Record<Pose, Texture[]>>;
  plants: Record<CropId, Texture[]>;
  /** madura a punto de echarse a perder */
  passing: Record<CropId, Texture>;
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
}

const byCrop = <T>(f: (c: CropId) => T): Record<CropId, T> =>
  ({ zanahoria: f('zanahoria'), trigo: f('trigo'), tomate: f('tomate'), calabaza: f('calabaza') });

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
  const icons = BUBBLE_ICONS;
  const bubble = (icon: PixelMap) => Texture.from(bubbleCanvas(icon, BUBBLE_PAL));
  return {
    gnome: {
      recolector: gnomeFrames(hatPal('recolector'), BODY),
      sembrador: gnomeFrames(hatPal('sembrador'), BODY),
      porteador: gnomeFrames(hatPal('porteador'), BODY),
    },
    legendary: {
      recolector: gnomeFrames(legendPal('recolector'), LEGEND_BODY),
      sembrador: gnomeFrames(legendPal('sembrador'), LEGEND_BODY),
      porteador: gnomeFrames(legendPal('porteador'), LEGEND_BODY),
    },
    plants: byCrop(c => PLANT_MAPS[c].map(m => tex(m, PLANT_PAL))),
    passing: byCrop(c => tex(PASSING_MAPS[c], PLANT_PAL)),
    items: byCrop(c => tex(ITEMS[c], itemPal)),
    basket: BASKET_PILES.map((_, level) => Texture.from(basketCanvas(level))),
    rings: GROUP_PALETTE.map(color => tex(RING, { X: color })),
    hole: tex(['.hhhh.', 'hHHHHh', '.hhhh.'], { h: '#5c3a29', H: '#4a2c20' }),
    shadow: Texture.from(shadow),
    bubbles: {
      sack: bubble(icons.sack), basket: bubble(icons.basket), zz: bubble(icons.zz), alert: bubble(icons.alert),
      think: bubble(icons.think), heart: bubble(icons.heart), angry: bubble(icons.angry), wave: bubble(icons.wave),
      chat: bubble(icons.chat), cards: bubble(icons.cards), cheer: bubble(icons.cheer), yum: bubble(icons.yum),
      note: bubble(icons.note),
    },
    cropBubbles: byCrop(c => Texture.from(bubbleCanvas(ITEMS[c], itemPal))),
    sacks: SACKS.map(m => tex(m, BASE)),
    barrow: BARROW.map(m => tex(m, BARROW_PAL)),
    pile: BASKET_PILES.map((_, level) => tex([...pileRows(level), ...CRATE], basketPal)),
    door: [Texture.from(doorCanvas(5)), Texture.from(doorCanvas(3))],
    arrow: tex(ARROW, { O: '#1a1c2c', Y: '#ffcd75' }),
    dust: tex(['ww', 'ww'], { w: '#e0d2b4' }),
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
  };
}

export const crownCanvas = () => mapCanvas(CROWN, CROWN_PAL);
