// Sprites del juego, según la hoja de estilo (estilo/gnomo.html).
import { Texture } from 'pixi.js';
import { blit, makeCanvas, mapCanvas, type Palette, type PixelMap } from './pixelart';
import { GROUP_PALETTE } from '../sim/config';
import type { CropId, JobId, Pose } from '../sim/types';

export const BASE: Palette = {
  O: '#1a1c2c', S: '#f2b98c', N: '#e07a5f', W: '#f4f4f4', w: '#94b0c2', B: '#257179', K: '#333c57',
  G: '#38b764', C: '#ef7d57', P: '#d9a066', p: '#a8723f', R: '#b13e53', Z: '#f4f4f4',
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
const SQUASH1 = BODY.filter((_, i) => i !== 4);
const SQUASH2 = BODY.filter((_, i) => i !== 4 && i !== 2);
const FEET = {
  n: ['...OKKO..OKKO...'],
  t: ['....OKKOOKKO....'],
  s: ['..OKKO....OKKO..'],
};
const WALK = [{ dy: 0, f: 'n' }, { dy: -1, f: 't' }, { dy: 0, f: 's' }, { dy: -1, f: 't' }] as const;
export const SACK: PixelMap = ['..G.G..', '.OOOOO.', 'OPPPPPO', 'OPPpPPO', 'OPPPPpO', '.OOOOO.'];

const hatPal = (job: JobId): Palette => ({ ...BASE, H: HATS[job][0], h: HATS[job][1] });

/** Fotograma de 16 × 17: una fila libre arriba para el saltito al andar. Los pies tocan el borde inferior. */
function gnomeCanvas(pal: Palette, body: PixelMap, feet: PixelMap, dy: number, sack = false): HTMLCanvasElement {
  const c = makeCanvas(16, 17);
  const ctx = c.getContext('2d')!;
  blit(ctx, body, 0, 1 + dy + (15 - body.length), pal);
  blit(ctx, feet, 0, 16 + dy, pal);
  if (sack) blit(ctx, SACK, 9, 6 + dy, pal);
  return c;
}
const gnomeFrame = (pal: Palette, body: PixelMap, feet: PixelMap, dy: number, sack = false) =>
  Texture.from(gnomeCanvas(pal, body, feet, dy, sack));

/** Gnomo quieto, para los iconos de los menús. */
export const gnomeIcon = (job: JobId) => gnomeCanvas(hatPal(job), BODY, FEET.n, 0);

function gnomeFrames(job: JobId): Record<Pose, Texture[]> {
  const pal = hatPal(job);
  const idle = [gnomeFrame(pal, BODY, FEET.n, 0), gnomeFrame(pal, SQUASH1, FEET.n, 0)];
  return {
    idle,
    sleep: idle,
    walk: WALK.map(w => gnomeFrame(pal, BODY, FEET[w.f], w.dy)),
    carry: WALK.map(w => gnomeFrame(pal, BODY, FEET[w.f], w.dy, true)),
    harvest: [gnomeFrame(pal, SQUASH1, FEET.n, 0), gnomeFrame(pal, SQUASH2, FEET.n, 0)],
    complain: [gnomeFrame(pal, BODY, FEET.n, 0), gnomeFrame(pal, BODY, FEET.n, -1)],
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
const ZZ: PixelMap = [
  '...ZZZZ',
  '.....Z.',
  '....Z..',
  '...ZZZZ',
  '.......',
  '.......',
  'ZZZ....',
  '.Z.....',
  'ZZZ....',
];
const ALERT: PixelMap = ['.OOOOOOO.', 'OWWWWWWWO', 'OWWRWRWWO', 'OWWRWRWWO', 'OWWWWWWWO', 'OWWRWRWWO', '.OOOOOOO.', '..OO.....'];
const SPARKLE: PixelMap = ['.W.', 'WYW', '.W.'];
/** corona del gnomo más trabajador */
const CROWN: PixelMap = ['.Y.Y.Y.', 'OYOYOYO', 'OYYRYYO', 'OYYYYYO', '.OOOOO.'];
const CROWN_PAL: Palette = { O: '#1a1c2c', Y: '#ffcd75', R: '#b13e53' };
const FLY: PixelMap = ['w.w', '.K.'];

// ---------- Plantas (16 × 14, base en la última fila, sobre el caballón) ----------
export const PLANT_PAL: Palette = {
  D: '#1c3b33', G: '#38b764', g: '#257179', l: '#a7f070', m: '#8f5c3e', h: '#4a2c20',
  C: '#ef7d57', c: '#b8503a', Y: '#ffcd75', U: '#c28a3a', T: '#d9a066', K: '#1a1c2c', w: '#a8723f',
  R: '#e04a5f', r: '#8e2f44', W: '#f4f4f4',
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

/** Planta echada a perder: la madura con los verdes y los frutos apagados a marrones. */
const WILT: Record<string, string> = { G: 'U', l: 'T', g: 'm', C: 'c', R: 'r', Y: 'U', W: 'T' };
const wilt = (m: PixelMap): PixelMap => m.map(r => r.replace(/[GlgCRYW]/g, ch => WILT[ch]));

/** Fases por cultivo: semilla, brote, joven, creciendo, madura y echada a perder (índice ROTTEN). */
export const PLANT_MAPS: Record<CropId, PixelMap[]> = {
  zanahoria: [SEED, SPROUT, CARROT_YOUNG, CARROT_GROWING, CARROT_RIPE, wilt(CARROT_RIPE)],
  trigo: [SEED, SPROUT, wheat(2), wheat(3), wheat(4), wilt(wheat(4))],
  tomate: [SEED, SPROUT_STAKE, TOMATO_YOUNG, TOMATO_GREEN, TOMATO_RIPE, wilt(TOMATO_RIPE)],
  calabaza: [SEED, SPROUT, pumpkin(2), pumpkin(3), pumpkin(4), wilt(pumpkin(4))],
};

// ---------- Atlas ----------
export interface Atlas {
  gnome: Record<JobId, Record<Pose, Texture[]>>;
  plants: Record<CropId, Texture[]>;
  items: Record<CropId, Texture>;
  /** cesta con 0..4 niveles de montón */
  basket: Texture[];
  /** aro bajo el gnomo, uno por color de GROUP_PALETTE */
  rings: Texture[];
  hole: Texture;
  shadow: Texture;
  zz: Texture;
  alert: Texture;
  sparkle: Texture;
  crown: Texture;
  fly: Texture;
}

const byCrop = <T>(f: (c: CropId) => T): Record<CropId, T> =>
  ({ zanahoria: f('zanahoria'), trigo: f('trigo'), tomate: f('tomate'), calabaza: f('calabaza') });

const basketPal = { ...PLANT_PAL, O: '#1a1c2c', P: '#c8925f', p: '#8b5a3c' };
export function basketCanvas(level: number): HTMLCanvasElement {
  const pile = BASKET_PILES[level];
  const rows = Array<string>(4 - pile.length).fill('............').concat(pile);
  return mapCanvas([...rows, ...BASKET_BASE], basketPal);
}

export function buildAtlas(): Atlas {
  const tex = (map: PixelMap, pal: Palette) => Texture.from(mapCanvas(map, pal));
  const shadow = makeCanvas(10, 1);
  const sctx = shadow.getContext('2d')!;
  sctx.fillStyle = 'rgba(26,28,44,.28)';
  sctx.fillRect(0, 0, 10, 1);
  return {
    gnome: { recolector: gnomeFrames('recolector'), sembrador: gnomeFrames('sembrador'), porteador: gnomeFrames('porteador') },
    plants: byCrop(c => PLANT_MAPS[c].map(m => tex(m, PLANT_PAL))),
    items: byCrop(c => tex(ITEMS[c], { ...PLANT_PAL, R: '#b13e53' })),
    basket: BASKET_PILES.map((_, level) => Texture.from(basketCanvas(level))),
    rings: GROUP_PALETTE.map(color => tex(RING, { X: color })),
    hole: tex(['.hhhh.', 'hHHHHh', '.hhhh.'], { h: '#5c3a29', H: '#4a2c20' }),
    shadow: Texture.from(shadow),
    zz: tex(ZZ, BASE),
    alert: tex(ALERT, BASE),
    sparkle: tex(SPARKLE, { W: '#f4f4f4', Y: '#ffcd75' }),
    crown: tex(CROWN, CROWN_PAL),
    fly: tex(FLY, { w: '#94b0c2', K: '#1a1c2c' }),
  };
}

export const crownCanvas = () => mapCanvas(CROWN, CROWN_PAL);
