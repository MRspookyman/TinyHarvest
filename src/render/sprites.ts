// Arte nativo a doble resolución: bordes de un píxel y luz desde arriba a la izquierda.
import { Texture } from 'pixi.js';
import { artTexture, blit, makeCanvas, mapCanvas, type Palette, type PixelMap } from './pixelart';
import { CROP_IDS, GROUP_PALETTE, JOB_IDS, ROTTEN } from '../sim/config';
import type { BubbleKind, CropId, JobId, Pose } from '../sim/types';
import { gnomeTextures } from './gnome';
import { PLANT_PAL, PLANT_MAPS, PASSING_MAPS, swayMap } from './plants';

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

export const SACK: PixelMap = [
  '....G..G......', '.....GG.......', '...OOOOOOOO...', '..OPYYYYPPpO..',
  '.OPYPpPPpPppO.', 'OPYPpPPpPPpppO', 'OPYPpPPpPPpppO', 'OPYPpPPpPPpppO',
  'OPPPpPPpPPpppO', '.OPPpPPpPpppO.', '..OPPPPPpppO..', '...OOOOOOOO...',
];
/** Costuras, boca atada y base más ancha según la carga. */
const SACKS: PixelMap[] = [
  ['....GG....', '....G.....', '..OOOOOO..', '.OPYYPPpO.', 'OPYPpPpppO', 'OPYPpPpppO', 'OPPPpPpppO', '.OPPPpppO.', '..OPPPPpO.', '...OOOO...'],
  SACK,
  ['......G..G........', '.......GG.........', '.....OOOOOOOO.....', '....OPYYYYPPpO....',
    '...OPYPpPPpPppO...', '..OPYPpPPpPPpppO..', '.OPYPpPPpPPpPpppO.', 'OPYYPpPPpPPpPPpppO',
    'OPPYPpPPpPPpPPpppO', 'OPPYPpPPpPPpPPpppO', 'OPPPPpPPpPPpPPpppO', '.OPPPpPPpPPpPpppO.',
    '.OPPPpPPpPPpPpppO.', '..OPPPPPPPPPpppO..', '...OPPPPPPPpppO...', '....OOOOOOOOOO....'],
];
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
  zanahoria: ['G...l.', '.GlGg.', '..Gg..', '.KKKK.', 'KYCCcK', 'KCCccK', '.KcCK.', '.KCcK.', '..Kc..', '..K...'],
  trigo: ['Y..Y..', 'YUYUY.', '.UYU.Y', 'YUYUYU', '.UTU..', '..T...', '.TTT..', 'TTTTT.'],
  tomate: ['..Gg..', '.GGlG.', '.KKKK.', 'KRWRrK', 'KRRRrK', 'KRRrrK', '.KrrK.', '..KK..'],
  calabaza: ['..gg..', '..Gg..', '.KKKK.', 'KYCCcK', 'KYCccK', 'KCcCcK', '.KccK.', '..KK..'],
  fresa: ['.GlG..', 'GgGgG.', '.KKKK.', 'KRYRrK', 'KRRYrK', '.KRrK.', '..Kr..', '..K...'],
  melon: ['...KKKK...', '..KGlgGK..', '.KllGggGK.', 'KGlGGgGggK', 'KGlGGgGggK', 'KGGggGgGgK', 'KGgGGgGggK', '.KGggGggK.', '..KggggK..', '...KKKK...'],
};
const RING: PixelMap = [
  '....XXXXXXXXXXXXXXXX....', '..XX................XX..', '.X....................X.',
  'X......................X', '.X....................X.', '..XXXXXXXXXXXXXXXXXXXX..',
];
/** Mimbre con borde enrollado y alternancia de fibras. */
const BASKET_BASE: PixelMap = [
  'OOOOOOOOOOOOOOOOOOOOOOOO', 'OYYYYYYYYYYYYYYYYYYYYYpO',
  'OPpPPpPPpPPpPPpPPpPPpppO', 'OPpPPpPPpPPpPPpPPpPPpppO',
  '.OPPpPPpPPpPPpPPpPPpppO.', '.OPPpPPpPPpPPpPPpPPpppO.',
  '..OPpPPpPPpPPpPPpPPppO..', '..OPPPPPPPPPPPPPPPpppO..',
  '...OPPPPPPPPPPPPPpppO...', '....OOOOOOOOOOOOOOOO....',
];
/** Siluetas de frutos separadas en cada nivel de carga. */
const BASKET_PILES: PixelMap[] = [
  [],
  ['......GG..G.............', '.....KYCKRRK.KCCK.......'],
  ['........G....G..........', '.......KYCK.KRRK........', '....GG.KCCKGLG.KYYK.....', '...KYCKKccKRrRKYYYYK....'],
  ['..........G.G...........', '.........KRRRK..........', '......GG.KRrrK.G........', '.....KYCK.KKK.KYYK......', '..GG.KCCK.G.G.KYUYK.G...', '.KYCKKccKKRRRK.KYKKCCK..'],
  ['........GG..G...........', '.......KYCKKRRK.........', '....GG.KCCKKrrK.G.......', '...KYCKKccK.KK.KYYK.....', '..GKCCK.G.G.G..KYUYK....', '.KRKccKKRRRKYYK.KYKKCCK.', 'KYCK.G.KRrrKYYUKGGKCCcK.', 'KCCKKYYKKKKKUUUKRRKKccK.'],
];

/** Bocadillo nativo de 22 × 20, borde de un píxel y sombra inferior. */
const BUBBLE: PixelMap = [
  '..OOOOOOOOOOOOOOOOOO..', '.OWWWWWWWWWWWWWWWWWWO.', 'OWWWWWWWWWWWWWWWWWWWWO',
  'OWWWWWWWWWWWWWWWWWWWWO', 'OWWWWWWWWWWWWWWWWWWWWO', 'OWWWWWWWWWWWWWWWWWWWWO',
  'OWWWWWWWWWWWWWWWWWWWWO', 'OWWWWWWWWWWWWWWWWWWWWO', 'OWWWWWWWWWWWWWWWWWWWWO',
  'OWWWWWWWWWWWWWWWWWWWWO', 'OWWWWWWWWWWWWWWWWWWWWO', 'OWWWWWWWWWWWWWWWWWWWWO',
  'OWWWWWWWWWWWWWWWWWWWWO', 'OWWWWWWWWWWWWWWWWWWWWO', '.OWWWWWwwwwwwwwwwwwwO.',
  '..OWWWWWOOOOOOOOOOOO..', '..OWWWWO..............', '..OWWWO...............',
  '..OWWO................', '..OOO.................',
];
const BUBBLE_PAL: Palette = {
  O: '#1a1c2c', W: '#f4f4f4', K: '#333c57', w: '#94b0c2', R: '#b13e53', r: '#e8687d', Y: '#ffcd75', C: '#ef7d57',
  S: '#f2b98c', P: '#d9a066', p: '#a8723f', G: '#38b764', B: '#41a6f6', b: '#73eff7',
};
const BUBBLE_ICONS: Record<Exclude<BubbleKind, 'crop'>, PixelMap> = {
  sack: SACK,
  basket: ['.....OOOO.....', '....OPPppO....', '...OP....pO...', '...O......O...', '..G..GG..G....', '.KYCKRRKYYK...', 'OOOOOOOOOOOOOO', 'OYPpPPpPPpPPpO', 'OPPpPPpPPpPPpO', '.OPpPPpPPpppO.', '..OPPPPPpppO..', '...OOOOOOOO...'],
  zz: ['..........KKKKKK', '..............K.', '.............K..', '............K...', '...........K....', '..........KKKKKK', 'KKKKKK..........', '....K...........', '...K............', '..K.............', '.K..............', 'KKKKKK..........'],
  alert: ['OR..RO', 'Rr..rR', 'Rr..rR', 'Rr..rR', 'Rr..rR', '.R..R.', '......', '......', 'OR..RO', '.R..R.'],
  think: ['KK..KK..KK', 'Kw..Kw..Kw'],
  heart: ['..RRR...RRR...', '.RrrRR.RrrRR..', 'RrrRRRRrrRRRR.', 'RrRRRRRRRRRRR.', 'RRRRRRRRRRRRR.', '.RRRRRRRRRRR..', '..RRRRRRRRR...', '...RRRRRRR....', '....RRRRR.....', '.....RRR......', '......R.......', '..............'],
  angry: ['....RRRR......', '..RR....RR....', '.R........RR..', 'R...RRRR...R..', 'R..R....R..R..', '.RR.RR...R.R..', '..RR..RRR..R..', '.R..RR....R...', 'R....RR..R....', '.RR....RR.....', '...RR....R....', '..........R...'],
  wave: ['..O..O..O.....', '.OSOOSOOSO....', '.OSOOSOOSO....', '.OSSSSSSSO....', '.OSSSSSSSO.O..', 'OOSSSSSSSOOSO.', 'OSSSSSSSSSSSO.', '.OSSSSSSSSSO..', '..OSSSSSSSO...', '..OSSSSSSSO...', '...OSSSSSO....', '....OOOOO.....'],
  chat: ['KKKKKKKKKKKKKK', 'KwwwwwwwwwwwwK', '..............', '..............', 'KKKKKKKK......', 'KwwwwwwK......'],
  cards: ['OOOOOOOO......', 'OWWWWWWO......', 'OWRWWWWOOOOOO.', 'OWRRWWWOwwwwO.', 'OWWRWWWOwKKwO.', 'OWWWWWWOwKKwO.', 'OWWWWWWOwwwwO.', 'OWWWWWWOwwwwO.', 'OOOOOOOOwwwwO.', '......OwwwwwO.', '......OwwwwwO.', '......OOOOOOO.'],
  cheer: ['......CC......', '.....CYYC.....', '....CYYYYC....', '....CYYYYC....', 'CCCCYYYYYYCCCC', '.CYYYYYYYYYYC.', '..CYYYYYYYYC..', '...CYYYYYYC...', '...CYYCCYYC...', '..CYYC..CYYC..', '..CYC....CYC..', '..CC......CC..'],
  yum: ['KK..........KK', '.KK........KK.', '..KKKKKKKKKK..', '....rrrrrr....', '.....rSSr.....', '......rr......'],
  note: ['....KKKK..', '....KwwKK.', '....K..wKK', '....K...KK', '....K.....', '....K.....', '....K.....', '..KKK.....', '.KwwK.....', 'KwwwK.....', 'KwwK......', '.KK.......'],
  water: ['....OB....', '....Bb....', '...OBbB...', '..OBbbBB..', '.OBbbBBBB.', 'OBbbBBBBBO', 'OBbBBBBBBO', 'OBBBBBBBBO', '.OBBBBBBO.', '..OOOOOO..'],
  well: ['.....OOOO.....', '....OwwwwO....', '...Ow....wO...', '...O......O...', 'OOOOOOOOOOOOOO', 'OBbbbBBBBBBBBO', 'OYYYYYYYYYYYYO', 'OPpPPpPPpPPppO', '.OPpPPpPPpppO.', '.OPpPPpPPpppO.', '..OPPPPPpppO..', '...OOOOOOOO...'],
  eye: ['....OOOOOO....', '..OOwwWWWWOO..', '.OWWWWBBWWWWO.', 'OWWWWBOOBWWWWO', 'OWWWWBOOBWWWWO', '.OWWWWBBWWWWO.', '..OOwwwwwwOO..', '....OOOOOO....', '..............', '..............'],
};

/** Carretilla de los porteadores (mira a la derecha, el asa hacia el gnomo); dos fotogramas de rueda. */
const BARROW: PixelMap[] = [0, 1].map(frame => [
  '........GG..G.G.........', '.......KYCKRRKYYK.......',
  '......OOOOOOOOOOOOOOOOOO', '......OYYYYYYYYYYYYYYYpO',
  'OOOOOOOPPpPPpPPpPPpPPppO', 'OYYYYYOPPpPPpPPpPPpPPppO',
  'OOOOOOOPPPpPPpPPpPPppppO', '.......OPPpPPpPPpPPpppO.',
  '........OPPPPPPPPPpppO..', '.........OOOOOOOOOOOO...',
  '...............OOOOOO...', '..............OKwwwwKO..',
  frame ? '..............OKwKKwKO..' : '..............OKKwKKKO..',
  frame ? '..............OKKKKwKO..' : '..............OKwwKwKO..',
  '...............OKKKKO...', '................OOOO....',
]);
const BARROW_PAL: Palette = {
  O: '#1a1c2c', P: '#c8925f', p: '#8b5a3c', K: '#333c57', w: '#94b0c2', C: '#ef7d57', Y: '#ffcd75', R: '#b13e53', G: '#38b764',
};
/** caja del montón junto a la puerta del granero */
const CRATE: PixelMap = [
  'OOOOOOOOOOOOOOOOOOOOOOOO', 'OYYYYYYYYYYYYYYYYYYYYYpO',
  'OPPpPPpPPpPPpPPpPPpPPppO', 'OPPpPPpPPpPPpPPpPPpPPppO',
  'OPpppppppppppppppppppppO', 'OOOOOOOOOOOOOOOOOOOOOOOO',
];
/** Flecha biselada que señala al gnomo seguido. */
const ARROW: PixelMap = ['OOOOOOOOOOOOOO', 'OYYYYYYYYYYYYO', 'OYWWYYYYYYYYpO', '.OYYYYYYYYYpO.', '..OYYYYYYYpO..', '...OYYYYYpO...', '....OYYYpO....', '.....OYpO.....', '......OO......', '..............'];

// ---------- Bichos ----------
const CRITTER_PAL: Palette = {
  O: '#1a1c2c', K: '#333c57', k: '#566c86', C: '#ef7d57', Y: '#ffcd75', W: '#f4f4f4', w: '#94b0c2',
  P: '#d9a066', p: '#a8723f', m: '#8f5c3e', h: '#4a2c20', G: '#38b764', g: '#257179', l: '#a7f070', N: '#e07a5f',
  s: '#d2c9a5',
};
/** cuervo de lado, mirando a la derecha: quieto y picoteando */
const CROW_PECK: PixelMap[] = [
  ['.............OOOO.....', '............OkkKKO....', '...........OkwOKKKO...', '...........OkkKKKKO...', '...OOOOOOOOOKKKKKKCCCC', '..OkkkKKKKKKKKKKKOCCC.', '.OkkKKKKKKKKKKKKKO....', 'OkkKKKKKKKKKKKKKO.....', '.OKKKkKKKKKKKKKKO.....', '..OKKKKkKKKKKKKO......', '...OOOOOOOOOOOO.......', '.......C....C.........', '......CC...CC.........', '.....CCC..CCC.........'],
  ['......................', '......................', '......................', '......................', '...OOOOOOOOOO.........', '..OkkkKKKKKKKOOO......', '.OkkKKKKKKKKKKKKOOO...', 'OkkKKKKKKKKKKKKKKkkO..', '.OKKKkKKKKKKKKKKkwOKO.', '..OKKKKkKKKKKKKKKKKKO.', '...OOOOOOOOOOOOOKKKKO.', '.......C....C...OKKO..', '......CC...CC.....CC..', '.....CCC..CCC.....CCCC'],
];
/** cuervo volando, de frente: alas arriba y abajo */
const CROW_FLY: PixelMap[] = [
  ['O....................O', 'KO..................OK', 'OkO.....OOOOOO.....OkO', 'OKkO...OkwOKkwO...OkKO', '.OKkOOOKkkKKkkOOOkKO..', '..OKkKKKKKKKKKKKkKO...', '...OKKKkKKKKkKKKKO....', '....OKKKkKKkKKKKO.....', '.....OOKKKKKKOO.......', '.......OKCCKO.........', '........OOOO..........', '.........OO...........'],
  ['......................', '......................', '........OOOOOO........', '.......OkwOKkwO.......', '.......OkkKKkkO.......', '..OOOOOOKKKKKKOOOOOO..', '.OkkKKKKKKKKKKKKKKkkO.', 'OkkKKKKkKKKKkKKKKKKkkO', 'OKKKOO..KKKKKK..OOKKKO', '.OKO....OKCCKO....OKO.', '..O......OOOO......O..', '..........OO..........'],
];
/** caracol mirando a la derecha; en el segundo fotograma encoge los cuernos */
const SNAIL: PixelMap[] = [
  ['.....OOOOOO.......O...O.', '...OOPYYYYPOO.....Os.Os.', '..OPYPPpppPppO.....s.s..', '.OPYPPpOOOppppO....s.s..', 'OPYPPpOPPPpOpppO..OssssO', 'OPYPpOPPpppPOppO.OssWssO', 'OPYPpOPpOPppOppO.OsssssO', 'OPYPpOPpOOppOppOOssssssO', 'OPPPpOPPPppPOppOsssssssO', '.OPPPpOOOOOpppOssssssssO', '..OPPPPPPPpppOsssssssssO', '...OOOOOOOOOOssssssssssO', '.OssssssssssssssssssssO.', 'OsssssssssssssssssssssO.'],
  ['.....OOOOOO.............', '...OOPYYYYPOO...........', '..OPYPPpppPppO....O...O.', '.OPYPPpOOOppppO...Os.Os.', 'OPYPPpOPPPpOpppO...s.s..', 'OPYPpOPPpppPOppO..OsssO.', 'OPYPpOPpOPppOppO.OssWssO', 'OPYPpOPpOOppOppOOssssssO', 'OPPPpOPPPppPOppOsssssssO', '.OPPPpOOOOOpppOssssssssO', '..OPPPPPPPpppOsssssssssO', '...OOOOOOOOOOssssssssssO', '.OssssssssssssssssssssO.', 'OsssssssssssssssssssssO.'],
];
const MOLE_MOUND: PixelMap = [
  '......mmmmmmmm......', '....mmPPmmmmmmmm....', '..mmPPmmmhmPPmmhmm..', '.mmmPmmmmhmmmmmmmmm.',
  'mmmmmhmmmmmhmPPmmmmm', 'mmhmmmmmmmmhmmmmmmhm', '.hhhhmmmmmmmmhhhhhh.', '..hhhhhhhhhhhhhhhh..',
];
const MOLE_HEAD: PixelMap = [
  '...OOOOOO...', '..OkkkkkkO..', '.OkwkkkkkkO.', 'OkwOkkkOkkkO', 'OkkOkkkOkkkO',
  'OkkkNNNNkkkO', 'OkkkNSSNkkkO', 'OWkkkkkkkkWO', 'OWWkkkkkkWWO', '.OWOOOOOOWO.',
];
const BUTTERFLY: PixelMap[] = [
  ['OO......OO', 'OXO.OO.OXO', 'OXXOXXOXXO', '.OXOOOXXO.', '..OXOOXO..', '...OOOO...'],
  ['...O..O...', '..OXOOXO..', '..OXOOXO..', '...OOOO...', '...OXOO...', '....OO....'],
];
const BUTTERFLY_COLORS = ['#ffcd75', '#e8687d', '#41a6f6', '#f4f4f4', '#ef7d57'];
/** rana: sentada y saltando */
const FROG: PixelMap[] = [
  ['...OO...OO....', '..OlGO.OGlO...', '.OlWKOOKWlGO..', '.OlGGGGGGlGO..', 'OlGGGGGGGGGgO.', 'OGGGlllllGGgO.', 'OGGllYYlllGgO.', '.OGGlllllGgO..', 'OOGGOOGGOOGGO.', '.OOO..OO..OO..'],
  ['...OO...OO....', '..OlGO.OGlO...', '.OlWKOOKWlGO..', '.OlGGGGGGlGO..', 'OlGGGGGGGGGgO.', '.OGGlllllGgO..', '..OGllYllGO...', '..OGGlllGGO...', '.OGGOOOOGGGO..', 'OGGO....OGGGO.', 'OGO......OGGO.', '.OO.......OO..'],
];
const SPARKLE: PixelMap = ['..W...', '..W...', 'WWYWWW', '..YW..', '...W..', '...W..'];
/** Corona con bisel, perla roja y reflejo superior izquierdo. */
const CROWN: PixelMap = [
  '..Y...Y...Y...', '.OYO.OYO.OYO..', '.OWYOYWYOYYO..', '.OYYYYYYYYYO..',
  'OYWYYYYYYYYYpO', 'OYYYYYRRYYYYpO', 'OYYYYYRrYYYYpO', 'OYYYYYYYYYYppO',
  '.OYYYYYYYYppO.', '..OOOOOOOOOO..',
];
const CROWN_PAL: Palette = { O: '#1a1c2c', Y: '#ffcd75', R: '#b13e53', r: '#8e2f44', W: '#f4f4f4', p: '#c28a3a' };
const FLY: PixelMap = ['ww..ww', 'wWOOwW', '..KK..', '..OO..'];

const byCrop = <T>(f: (c: CropId) => T) => Object.fromEntries(CROP_IDS.map(c => [c, f(c)])) as Record<CropId, T>;
const byJob = <T>(f: (j: JobId) => T) => Object.fromEntries(JOB_IDS.map(j => [j, f(j)])) as Record<JobId, T>;


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
const pileRows = (level: number) => Array<string>(8 - BASKET_PILES[level].length).fill('........................').concat(BASKET_PILES[level]);
export function basketCanvas(level: number): HTMLCanvasElement {
  return mapCanvas([...pileRows(level), ...BASKET_BASE], basketPal);
}

const itemPal = { ...PLANT_PAL, R: '#b13e53' };

/** Bocadillo con el icono centrado en su hueco. */
function bubbleCanvas(icon: PixelMap, pal: Palette): HTMLCanvasElement {
  const c = mapCanvas(BUBBLE, BUBBLE_PAL);
  const w = Math.max(...icon.map(r => r.length));
  blit(c.getContext('2d')!, icon, 2 + Math.floor((18 - w) / 2), 2 + Math.floor((12 - icon.length) / 2), pal);
  return c;
}

/** Hueco nativo de 32 × 34 con madera, bisagras y paja. */
function doorCanvas(leaf: number): HTMLCanvasElement {
  const c = makeCanvas(32, 34);
  const ctx = c.getContext('2d')!;
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  rect(0, 0, 32, 34, '#1a1c2c');
  rect(1, 5, 30, 28, '#333c57');
  rect(3, 7, 26, 23, '#252638');
  rect(1, 28, 30, 6, '#c28a3a');
  for (let x = 2; x < 30; x += 3) {
    rect(x, 29 + x % 3, 2, 1, '#ffcd75');
    rect(x + 1, 31 + x % 2, 1, 2, '#a8723f');
  }
  const width = leaf * 2;
  for (const x of [0, 32 - width]) {
    rect(x, 0, width, 34, '#1a1c2c');
    rect(x + 1, 1, width - 2, 32, '#8e3b57');
    for (let plank = 1; plank < width - 1; plank += 3) {
      rect(x + plank, 2, 1, 30, '#b13e53');
      rect(x + plank + 1, 3 + plank % 4, 1, 9, '#5d275d');
      rect(x + plank + 1, 18 + plank % 3, 1, 8, '#5d275d');
    }
    rect(x + 1, 3, width - 2, 2, '#d9a066');
    rect(x + 1, 26, width - 2, 2, '#a8723f');
    for (const y of [6, 25]) {
      rect(x + 1, y, Math.min(4, width - 2), 2, '#333c57');
      rect(x + 2, y, 1, 1, '#94b0c2');
    }
    rect(x + width - 2, 16, 1, 4, '#ffcd75');
  }
  return c;
}

/** Topo de 20 × 18; cada nivel descubre dos filas de pelo y bigotes. */
function moleCanvas(rise: number): HTMLCanvasElement {
  const c = makeCanvas(20, 18);
  const ctx = c.getContext('2d')!;
  blit(ctx, MOLE_HEAD.slice(0, rise * 2), 4, 12 - rise * 2, CRITTER_PAL);
  blit(ctx, MOLE_MOUND, 0, 10, CRITTER_PAL);
  return c;
}

export function buildAtlas(): Atlas {
  const tex = (map: PixelMap, pal: Palette) => artTexture(mapCanvas(map, pal));
  const shadow = makeCanvas(20, 2);
  const sctx = shadow.getContext('2d')!;
  sctx.fillStyle = 'rgba(26,28,44,.28)';
  sctx.fillRect(1, 0, 18, 1);
  sctx.fillRect(0, 1, 20, 1);
  const bubble = (icon: PixelMap) => artTexture(bubbleCanvas(icon, BUBBLE_PAL));
  const kinds = Object.keys(BUBBLE_ICONS) as Exclude<BubbleKind, 'crop'>[];
  const plants = byCrop(c => PLANT_MAPS[c].map(m => tex(m, PLANT_PAL)));
  return {
    gnome: byJob(j => gnomeTextures(j, false)),
    legendary: byJob(j => gnomeTextures(j, true)),
    plants,
    plantsSway: byCrop(c => PLANT_MAPS[c].map((m, i) => (i === 0 || i === ROTTEN ? plants[c][i] : tex(swayMap(m), PLANT_PAL)))),
    passing: byCrop(c => tex(PASSING_MAPS[c], PLANT_PAL)),
    passingSway: byCrop(c => tex(swayMap(PASSING_MAPS[c]), PLANT_PAL)),
    items: byCrop(c => tex(ITEMS[c], itemPal)),
    basket: BASKET_PILES.map((_, level) => artTexture(basketCanvas(level))),
    rings: GROUP_PALETTE.map(color => tex(RING, { X: color })),
    hole: tex(['...hhhhhh...', '.hhmmmmmmhh.', 'hmmHHHHHHmmh', 'hmHHHHHHHHmh', '.hhHHHHHHhh.', '...hhhhhh...'], { h: '#1a1c2c', m: '#8f5c3e', H: '#4a2c20' }),
    shadow: artTexture(shadow),
    bubbles: Object.fromEntries(kinds.map(k => [k, bubble(BUBBLE_ICONS[k])])) as Atlas['bubbles'],
    cropBubbles: byCrop(c => artTexture(bubbleCanvas(ITEMS[c], itemPal))),
    sacks: SACKS.map(m => tex(m, BASE)),
    barrow: BARROW.map(m => tex(m, BARROW_PAL)),
    pile: BASKET_PILES.map((_, level) => tex([...pileRows(level), ...CRATE], basketPal)),
    door: [artTexture(doorCanvas(5)), artTexture(doorCanvas(3))],
    arrow: tex(ARROW, { O: '#1a1c2c', Y: '#ffcd75' }),
    dust: tex(['.ww.', 'wWWw', 'wWww', '.ww.'], { w: '#c7b08b', W: '#e0d2b4' }),
    drop: tex(['.a', 'aA', 'aA', '.A'], BASE),
    heart: tex(['.rr.rr', 'rRrrrr', 'rRrrrr', '.rrrr.', '..rr..', '..r...'], { r: '#e8687d', R: '#f4f4f4' }),
    crowPeck: CROW_PECK.map(m => tex(m, CRITTER_PAL)),
    crowFly: CROW_FLY.map(m => tex(m, CRITTER_PAL)),
    snail: SNAIL.map(m => tex(m, CRITTER_PAL)),
    mole: [0, 1, 2, 3, 4, 5].map(rise => artTexture(moleCanvas(rise))),
    butterfly: BUTTERFLY_COLORS.map(X => BUTTERFLY.map(m => tex(m, { X, O: '#1a1c2c' }))),
    frog: FROG.map(m => tex(m, CRITTER_PAL)),
    sparkle: tex(SPARKLE, { W: '#f4f4f4', Y: '#ffcd75' }),
    crown: tex(CROWN, CROWN_PAL),
    fly: tex(FLY, { w: '#94b0c2', W: '#f4f4f4', O: '#1a1c2c', K: '#333c57' }),
    medal: tex(['R..B', 'RBBB', '.YY.', 'YWWy', 'YYyy', '.yy.'], { R: '#b13e53', B: '#3b5dc9', W: '#f4f4f4', Y: '#ffcd75', y: '#c28a3a' }),
    confetti: [
      tex(['YYYY', '.yyy'], { Y: '#ffcd75', y: '#c28a3a' }), tex(['Rr', 'Rr', 'Rr', '.r'], { R: '#e8687d', r: '#b13e53' }),
      tex(['BBbb', '.bbb'], { B: '#73eff7', b: '#41a6f6' }), tex(['Gl', 'Gl', 'Gg', '.g'], { G: '#38b764', l: '#a7f070', g: '#257179' }),
      // Hojas doradas con nervadura y punta asimétrica.
      tex(['..Y.', '.YYy', 'YYyy', '.yy.'], { Y: '#ffcd75', y: '#c28a3a' }), tex(['YYy...', '.YYy..', '..Yyy.', '...yyY'], { Y: '#ffcd75', y: '#c28a3a' }),
    ],
  };
}

export const crownCanvas = () => mapCanvas(CROWN, CROWN_PAL);
