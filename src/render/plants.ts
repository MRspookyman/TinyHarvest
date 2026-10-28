import type { Palette, PixelMap } from './pixelart';
import { CROP_IDS } from '../sim/config';
import type { CropId } from '../sim/types';

// Plantas dibujadas a 32 × 28; la luz llega desde arriba a la izquierda.
export const PLANT_PAL: Palette = {
  D: '#1c3b33', G: '#38b764', g: '#257179', l: '#a7f070', m: '#8f5c3e', h: '#4a2c20',
  C: '#ef7d57', c: '#b8503a', Y: '#ffcd75', U: '#c28a3a', T: '#d9a066', K: '#1a1c2c', w: '#a8723f',
  R: '#e04a5f', r: '#8e2f44', W: '#f4f4f4',
  x: '#5d5a4e', z: '#8b8466', q: '#3f3a32',
};

type Grid = string[][];
type Stage = 1 | 2 | 3 | 4;
const grid = (): Grid => Array.from({ length: 28 }, () => Array<string>(32).fill('.'));
const put = (g: Grid, x: number, y: number, ch: string) => {
  if (x >= 0 && x < 32 && y >= 0 && y < 28) g[y][x] = ch;
};
const stamp = (g: Grid, map: PixelMap, x: number, y: number) =>
  map.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') put(g, x + c, y + r, ch); }));
const toMap = (g: Grid): PixelMap => g.map(r => r.join(''));
function line(g: Grid, x: number, y: number, endX: number, endY: number, ch: string) {
  const steps = Math.max(Math.abs(endX - x), Math.abs(endY - y));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    put(g, Math.round(x + (endX - x) * t), Math.round(y + (endY - y) * t), ch);
  }
}
function mound(g: Grid, wide = false) {
  stamp(g, wide
    ? ['..........mmmmmmmmmmmm..........', '.........hmmmmmmmmmmmmh.........']
    : ['............mmmmmmmm............', '...........hmmmmmmmmh...........'], 0, 26);
}
function stem(g: Grid, top: number) {
  line(g, 15, top, 15, 25, 'G');
  line(g, 16, top + 1, 16, 25, 'g');
}
function seed(a: string, b: string): PixelMap {
  const g = grid();
  stamp(g, [`..............${a}${a}${b}${b}..............`,
    `..............${a}${a}${b}${b}..............`,
    '............mmhhhhmm............', '...........mmmmmmmmmm...........',
    '..........hmmmmmmmmmmh..........', '.........hmmmmmmmmmmmmh.........'], 0, 22);
  return toMap(g);
}

// Nervios de un píxel: estas hojas no son ampliaciones de las antiguas.
const LEAF: PixelMap = [
  '..DDD...', '.DllGDD.', 'DlGlGGgD', 'DlGgGggD', '.DGgGgD.', '..DgGD..', '...DD...',
];
const WIDE_LEAF: PixelMap = [
  '..DDDDD...', '.DlllGGDD.', 'DlGlGGGggD', 'DlGGgGgggD', '.DGGgGggD.', '..DDggDD..', '....DD....',
];
const CLOVER: PixelMap = ['.DDDD.', 'DlGlGD', 'DlGGgD', '.DGgD.', '..DD..'];
const FLOWER: PixelMap = ['..WW..', '.WWWW.', 'WWYYWW', '.WYYW.', '..WW..'];
const BERRY: PixelMap = [
  '..G.G..', '.GGGGG.', '.KRRRK.', 'KWRYRRK', 'KRYRRrK', '.RRYrr.', '..Rrr..', '...r...',
];
function ellipse(g: Grid, cx: number, cy: number, rx: number, ry: number,
  fill: string, rib: string, edge: string, ribs: number[]) {
  const inside = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  for (let y = 0; y < 28; y++) for (let x = 0; x < 32; x++) {
    if (!inside(x, y)) continue;
    const border = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    // Las costillas se curvan hacia el pedúnculo en los extremos del fruto.
    const curve = Math.abs(y + 0.5 - cy) > ry * 0.6 ? 1 : 0;
    const distance = Math.abs(x + 0.5 - cx);
    put(g, x, y, border ? edge : ribs.some(r => distance === Math.max(0.5, r - curve)) ? rib : fill);
  }
}

/** Frondes finas en abanico, con pequeñas pinnas alternas. */
function frond(g: Grid, x: number, y: number, bottom: number) {
  line(g, 15, bottom, x, y, 'D');
  line(g, 16, bottom, x, y + 1, 'G');
  const length = bottom - y;
  for (let i = 2; i < length - 1; i += 3) {
    const cx = Math.round(x + (15 - x) * i / length);
    const cy = y + i;
    line(g, cx, cy, cx - 2, cy - 1, 'G');
    line(g, cx, cy + 1, cx + 2, cy, 'g');
    put(g, cx - 3, cy - 2, 'l');
    put(g, cx + 3, cy - 1, 'l');
  }
  put(g, x, y, 'l');
}
function carrot(stage: Stage): PixelMap {
  const g = grid();
  stem(g, stage === 1 ? 21 : 16);
  const tips = stage === 1 ? [[12, 18], [19, 18]]
    : stage === 2 ? [[9, 14], [15, 11], [22, 14]]
    : stage === 3 ? [[6, 11], [11, 7], [16, 5], [22, 8], [26, 12]]
    : [[5, 6], [10, 3], [16, 1], [22, 3], [27, 7]];
  tips.forEach(([x, y]) => frond(g, x, y, stage === 4 ? 16 : 24));
  mound(g);
  if (stage === 3) stamp(g, ['..KKKK..', '.KYYCCK.', 'mKYCCCcm'], 12, 24);
  if (stage === 4) {
    // Hombro ancho, raíz afilada y dos marcas horizontales.
    stamp(g, ['...KKKKKKKK...', '..KYYYYCCCCK..', '.KYYCCCCCCCcK.', '.KYCCCCCCCCcK.',
      '..KCCcccCCccK.', '..KCCCCCCCccK.', '...KCCCCcccK..', '....KCCccccK..',
      '.....KCCCcK...', '......KccK....', '.......KK.....'], 9, 16);
    put(g, 16, 27, 'c');
  }
  return toMap(g);
}

function wheat(stage: Stage): PixelMap {
  const g = grid();
  if (stage === 1) {
    for (const [x, top] of [[13, 20], [16, 18], [19, 21]]) {
      line(g, 15, 25, x, top, 'G'); put(g, x, top, 'l');
    }
  } else {
    const ripe = stage === 4;
    [4, 12, 19, 26].forEach((x, i) => {
      const top = stage === 2 ? [15, 12, 14, 16][i] : (ripe ? [4, 2, 4, 2] : [7, 5, 7, 5])[i];
      line(g, 15 + (i > 1 ? 1 : 0), 25, x, top + 5, ripe ? 'T' : 'G');
      line(g, x, top + 5, x, top, ripe ? 'T' : 'G');
      const side = i % 2 ? 1 : -1;
      line(g, x, 20, x + side * 3, 16, ripe ? 'U' : 'G');
      put(g, x + side * 3, 15, ripe ? 'Y' : 'l');
      if (stage === 2) { put(g, x, top, 'l'); return; }
      const ear = x + (ripe && i === 1 ? -1 : ripe && i === 3 ? 1 : 0);
      const light = ripe ? 'Y' : 'l';
      const dark = ripe ? 'U' : 'G';
      for (let y = 0; y < 8; y++) {
        const dx = y % 2 ? 1 : -1;
        put(g, ear, top + y, ripe ? 'T' : 'g');
        put(g, ear + dx, top + y, light);
        if (y > 0 && y < 7) put(g, ear + dx * 2, top + y, dark);
        if (y % 2 === 0) line(g, ear + dx * 2, top + y, ear + dx * 3, top + y - 2, light);
      }
      line(g, ear, top - 2, ear, top, light);
    });
  }
  mound(g);
  return toMap(g);
}

function tomato(stage: Stage): PixelMap {
  const g = grid();
  // El tutor sigue visible detrás de las hojas desde el primer brote.
  line(g, 21, stage === 1 ? 8 : stage === 2 ? 5 : 1, 21, 25, 'w');
  line(g, 22, stage === 1 ? 9 : stage === 2 ? 6 : 2, 22, 25, 'T');
  stem(g, stage === 1 ? 21 : stage === 2 ? 13 : 7);
  if (stage === 1) {
    stamp(g, ['.DDDD...', 'DllGGD..', 'DGGgggD.', '.DDggDD.', '...DD...'], 8, 18);
    stamp(g, ['...DDDD.', '..DlGGgD', '.DlGGggD', '..DDggD.', '....DD..'], 16, 17);
  } else {
    const leaves = stage === 2 ? [[7, 17], [11, 10], [19, 13], [18, 20]]
      : [[3, 9], [11, 4], [21, 7], [5, 17], [13, 12], [22, 17]];
    leaves.forEach(([x, y]) => {
      line(g, 15, y + 7, x + 3, y + 4, 'G'); stamp(g, LEAF, x, y);
    });
    if (stage >= 3) {
      for (const [x, y] of [[5, 13], [23, 12], [10, 21], [21, 21]]) {
        stamp(g, ['..G.G..', '.GGGGG.', '..KKK..', '.KWRRK.', '.KRRrK.', '..KrK..'], x, y - 2);
      }
      stamp(g, ['.Y.', 'YYY', '.Y.'], 19, 16);
    }
  }
  mound(g);
  const map = toMap(g);
  return stage === 3 ? map.map(row => row.replace(/[RW]/g, 'l').replace(/r/g, 'G')) : map;
}

function pumpkin(stage: Stage): PixelMap {
  const g = grid();
  stem(g, stage === 1 ? 23 : 20);
  line(g, stage === 1 ? 14 : 5, 25, stage === 1 ? 17 : 26, 23, 'g');
  if (stage === 1) {
    stamp(g, WIDE_LEAF, 6, 18); stamp(g, WIDE_LEAF, 17, 18);
  } else if (stage === 2) {
    line(g, 16, 24, 22, 16, 'G');
    stamp(g, WIDE_LEAF, 4, 16); stamp(g, WIDE_LEAF, 18, 13);
    stamp(g, ['.GG.', 'G..G', '.G.G', '..G.'], 25, 20);
  } else if (stage === 3) {
    for (const [x, y] of [[2, 12], [19, 9], [10, 5]]) stamp(g, WIDE_LEAF, x, y);
    ellipse(g, 16, 22, 6, 4, 'l', 'G', 'D', [0.5, 3.5]);
    stamp(g, ['.gG.', '.g..', 'gg..'], 15, 16);
    stamp(g, ['..Y..', '.YYY.', 'YYUYY', '.YYY.', '..Y..'], 4, 21);
  } else {
    stamp(g, WIDE_LEAF, 1, 6); stamp(g, WIDE_LEAF, 21, 3);
    ellipse(g, 16, 19, 12, 8, 'C', 'c', 'K', [0.5, 4.5, 8.5]);
    stamp(g, ['..GGG.', '.G...G', '.G..G.', '..GG..', '..gG..', '.gg...'], 14, 6);
    stamp(g, ['YY.', 'YCC', '.C.'], 9, 13);
    line(g, 24, 20, 23, 23, 'c');
  }
  mound(g, stage === 4);
  return toMap(g);
}

/** Trébol dentado, flores de cinco pétalos y fresas colgantes con semillas. */
function strawberry(stage: Stage): PixelMap {
  const g = grid();
  stem(g, stage === 1 ? 23 : 19);
  if (stage === 1) {
    for (const [x, y] of [[9, 21], [13, 17], [18, 21]]) stamp(g, CLOVER, x, y);
  } else if (stage === 2) {
    for (const [x, y] of [[5, 17], [12, 12], [20, 17]]) {
      line(g, 15, 25, x + 3, y + 5, 'G'); stamp(g, LEAF, x, y);
    }
  } else {
    for (const [x, y] of [[2, 15], [7, 11], [17, 11], [24, 15], [12, 18]]) {
      line(g, 15, 25, x + 3, y + 5, 'G'); stamp(g, LEAF, x, y);
    }
    // La flor más alta se conserva al madurar para no encoger la silueta.
    stamp(g, FLOWER, 20, 5);
    if (stage === 3) {
      stamp(g, FLOWER, 3, 9); stamp(g, FLOWER, 24, 21);
    } else {
      for (const [x, y] of [[4, 19], [13, 20], [23, 19]]) stamp(g, BERRY, x, y);
    }
  }
  mound(g, stage === 4);
  return toMap(g);
}

function melon(stage: Stage): PixelMap {
  const g = grid();
  stem(g, stage === 1 ? 23 : 20);
  line(g, stage === 1 ? 14 : 5, 25, stage === 1 ? 18 : 27, 24, 'g');
  if (stage === 1) {
    stamp(g, WIDE_LEAF, 5, 19); stamp(g, WIDE_LEAF, 17, 18);
    stamp(g, ['.GG', 'G.G', '.G.'], 26, 21);
  } else if (stage === 2) {
    stamp(g, WIDE_LEAF, 3, 17); stamp(g, WIDE_LEAF, 17, 13);
    stamp(g, ['.GGG.', 'G...G', 'G.G.G', '.GG..'], 25, 18);
  } else if (stage === 3) {
    for (const [x, y] of [[1, 12], [19, 9], [9, 6]]) stamp(g, WIDE_LEAF, x, y);
    ellipse(g, 16, 22, 8, 4, 'l', 'G', 'D', [0.5, 3.5, 5.5]);
    line(g, 16, 16, 16, 18, 'g');
    stamp(g, ['.GGG.', 'G...G', '.G.G.', '..G..'], 25, 16);
  } else {
    stamp(g, WIDE_LEAF, 1, 4); stamp(g, WIDE_LEAF, 21, 2);
    ellipse(g, 16, 19, 14, 8, 'G', 'g', 'K', [0.5, 3.5, 6.5, 9.5, 12.5]);
    stamp(g, ['..GGG.', '.G...G', '.G.G.G', '..GG..', '..g...', '..g...'], 14, 5);
    stamp(g, ['.ll..', 'llGl.', '.l...'], 8, 13);
    put(g, 7, 17, 'l'); put(g, 11, 14, 'l');
  }
  mound(g, stage === 4);
  return toMap(g);
}

const recolor = (colors: Record<string, string>) => (map: PixelMap): PixelMap =>
  map.map(row => row.replace(/./g, ch => colors[ch] ?? ch));
/** Las hojas amarillean; la fruta todavía es comestible. */
const passing = recolor({ G: 'U', l: 'Y', g: 'G', Y: 'U', U: 'm' });
/** Moho gris verdoso y frutos marrones, sin confundirse con la fase madura. */
const rotten = recolor({ G: 'x', g: 'q', l: 'z', C: 'm', c: 'h', R: 'm', r: 'h', Y: 'z', U: 'x', T: 'x', W: 'z' });

export const SWAY_ROWS = 12;
/** Ráfaga de un píxel; fallar es preferible a recortar una hoja sin avisar. */
export function swayMap(map: PixelMap): PixelMap {
  return map.map((row, i) => {
    if (i >= SWAY_ROWS) return row;
    if (row[31] !== '.') throw new Error(`Planta recortada al mecerse: fila ${i} «${row}»`);
    return '.' + row.slice(0, 31);
  });
}

const RIPE_MAPS: Record<CropId, PixelMap> = {
  zanahoria: carrot(4), trigo: wheat(4), tomate: tomato(4), calabaza: pumpkin(4), fresa: strawberry(4), melon: melon(4),
};
/** Semilla, brote, joven, creciendo, madura y echada a perder. */
export const PLANT_MAPS: Record<CropId, PixelMap[]> = {
  zanahoria: [seed('T', 'U'), carrot(1), carrot(2), carrot(3), RIPE_MAPS.zanahoria, rotten(RIPE_MAPS.zanahoria)],
  trigo: [seed('Y', 'U'), wheat(1), wheat(2), wheat(3), RIPE_MAPS.trigo, rotten(RIPE_MAPS.trigo)],
  tomate: [seed('Y', 'T'), tomato(1), tomato(2), tomato(3), RIPE_MAPS.tomate, rotten(RIPE_MAPS.tomate)],
  calabaza: [seed('W', 'T'), pumpkin(1), pumpkin(2), pumpkin(3), RIPE_MAPS.calabaza, rotten(RIPE_MAPS.calabaza)],
  fresa: [seed('R', 'r'), strawberry(1), strawberry(2), strawberry(3), RIPE_MAPS.fresa, rotten(RIPE_MAPS.fresa)],
  melon: [seed('T', 'w'), melon(1), melon(2), melon(3), RIPE_MAPS.melon, rotten(RIPE_MAPS.melon)],
};
export const PASSING_MAPS: Record<CropId, PixelMap> = Object.fromEntries(
  CROP_IDS.map(c => [c, passing(RIPE_MAPS[c])]),
) as Record<CropId, PixelMap>;
