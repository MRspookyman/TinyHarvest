// Iconos pixel art para la interfaz HTML (barra, ventanas y árbol de mejoras).
// Se dibujan en canvas y se pasan a la interfaz como data URL.
import type { CropId, JobId, NodeId, TraitId } from '../sim/types';
import { makeCanvas, mapCanvas, type Palette, type PixelMap } from './pixelart';
import { BASE, basketCanvas, crownCanvas, gnomeIcon, PLANT_MAPS, PLANT_PAL, SACK } from './sprites';
import type { MenuId } from '../textos';

const P: Palette = {
  O: '#1a1c2c', K: '#333c57', R: '#b13e53', Y: '#ffcd75', W: '#f4f4f4', w: '#a8723f', P: '#5d275d',
  T: '#8b5a3c', t: '#5a3a2a', G: '#38b764', g: '#257179', l: '#a7f070', B: '#41a6f6', p: '#e8687d',
  C: '#d9a066', c: '#5a3a2a', s: '#94b0c2',
};

const BARN_ICON: PixelMap = [
  '.......OO.......',
  '.....OOKKOO.....',
  '...OOKKKKKKOO...',
  '.OOKKKKKKKKKKOO.',
  'OKKKKKKKKKKKKKKO',
  'OOOOOOOOOOOOOOOO',
  '.ORRRRRRRRRRRRO.',
  '.ORRRRROYORRRRO.',
  '.ORRRRROOORRRRO.',
  '.ORRRRRRRRRRRRO.',
  '.ORRROOOOOORRRO.',
  '.ORRROWPPWORRRO.',
  '.ORRROPWWPORRRO.',
  '.ORRROPWWPORRRO.',
  '.ORRROWPPWORRRO.',
  'OOOOOOOOOOOOOOOO',
];
const BOARD_ICON: PixelMap = [
  '................',
  'OOOOOOOOOOOOOOOO',
  'OwwwwwwwwwwwwwwO',
  'OwBWWwwpWWwwYWwO',
  'OwWWWwwWWWwwWWwO',
  'OwWsWwwWsWwwWswO',
  'OwWWWwwWWWwwWWwO',
  'OwwwwwwWWWwwwwwO',
  'OwwwwwwwwwwwwwwO',
  'OOOOOOOOOOOOOOOO',
  '...OtO....OtO...',
  '...OtO....OtO...',
  '...OtO....OtO...',
  '...OtO....OtO...',
  '...OtO....OtO...',
  '..OOOOO..OOOOO..',
];
const TREE_ICON: PixelMap = [
  '.....OOOOOO.....',
  '...OOGGGGGGOO...',
  '..OGGlGGGGGGGO..',
  '.OGGlGGGGYGGGGO.',
  '.OGGGGGGGGGGGGO.',
  'OGGGGYGGGGGGGGGO',
  'OGGGGGGGGGGYGGGO',
  'OgGGGGGGGGGGGGgO',
  '.OggGGGGGGGGggO.',
  '..OOggOTTOggOO..',
  '....OOOTTOOO....',
  '......OTTO......',
  '......OTTO......',
  '.....OTTTTO.....',
  '....OTTOOTTO....',
  '....OOO..OOO....',
];
const DIARY_ICON: PixelMap = [
  '................',
  '..OOOOOOOOOOOO..',
  '..ORRRRRRRRRRO..',
  '..ORRYYYYYYRRO..',
  '..ORRYOOOOYRRO..',
  '..ORRYYYYYYRRO..',
  '..ORRRRRRRRRRO..',
  '..ORRRRRRRRRRO..',
  '..ORRRRRRRRRRO..',
  '..ORRRRRRRRRRO..',
  '..ORRRRRRRRRRO..',
  '..ORRRRRRRRRRO..',
  '..OWWWWWWWWWWO..',
  '..OOOOOOOOOOOO..',
  '................',
  '................',
];
const BOOT: PixelMap = [
  '..OOOO....',
  '..OTTO....',
  '..OTTO....',
  '..OTTO....',
  '..OTTOOOO.',
  '.OTTTTTTTO',
  '.OTTTTTTTO',
  '.OOOOOOOOO',
  '.OCCCCCCCO',
  '.OOOOOOOOO',
];
const CUP: PixelMap = [
  '...W..W...',
  '..W..W....',
  '.OOOOOOO..',
  '.OcccccOOO',
  '.OWWWWWO.O',
  '.OWWWWWO.O',
  '.OWWWWWOOO',
  '..OWWWO...',
  '..OOOOO...',
  '..........',
];
const FERTILIZER: PixelMap = [
  '..OOOOOO..',
  '.OCCCCCCO.',
  '..OCCCCO..',
  '.OCCCCCCO.',
  'OCCCOOCCCO',
  'OCCCCCOCCO',
  'OCCCCOCCCO',
  'OCCCCCCCCO',
  'OCCCCOCCCO',
  '.OOOOOOOO.',
];
const SOIL: PixelMap = [
  '..........',
  '...l..l...',
  '..lGllGl..',
  '...GGGG...',
  '....GG....',
  'OOOOOOOOOO',
  'OTTTTTTTTO',
  'OccccccccO',
  'OTTTTTTTTO',
  'OOOOOOOOOO',
];

/** Carretilla con dos ruedas: la rueda de más. */
const WHEELBARROW: PixelMap = [
  '..............',
  '...YlY.l......',
  '..YYYYYYY.....',
  '.OOOOOOOOOO...',
  '.OsssssssssOOO',
  '..OsssssssOTTO',
  '...OOOOOOOO.OO',
  '...OKO..OKO...',
  '..OKsKOOKsKO..',
  '..OKKKOOKKKO..',
  '...OOO..OOO...',
];
/** Cesto de mimbre con paja y un tomate a salvo dentro. */
const STRAW_BASKET: PixelMap = [
  '...Y.OO..Y..',
  '.YYYORROYYY.',
  'OOOOOOOOOOOO',
  'OwCwCwCwCwCO',
  'OCwCwCwCwCwO',
  '.OwCwCwCwCO.',
  '.OCwCwCwCwO.',
  '..OOOOOOOO..',
];
/** Puesto de mercado con toldo de rayas y género en el mostrador. */
const MARKET: PixelMap = [
  'OOOOOOOOOOOOOO',
  'ORRWWRRWWRRWWO',
  'ORRWWRRWWRRWWO',
  'OOOOOOOOOOOOOO',
  '.OtO......OtO.',
  '.OtO......OtO.',
  '.OtORRYYlGOtO.',
  'OOOOOOOOOOOOOO',
  'OwwwwwwwwwwwwO',
  'OTTTTTTTTTTTTO',
  'OwwwwwwwwwwwwO',
  'OOOOOOOOOOOOOO',
];
/** Casa de gnomos: seta con puerta. */
const HOUSE_ICON: PixelMap = [
  '......OOOO......',
  '....OORRRROO....',
  '...ORRWWRRRRO...',
  '..ORRRWWRRRRRO..',
  '.ORRRRRRRRWWRRO.',
  '.ORWWRRRRRWWRRO.',
  'ORRWWRRRRRRRRRRO',
  'OOOOOOOOOOOOOOOO',
  '...OWWWWWWWWsO..',
  '...OWWOOOOWWsO..',
  '...OWOTTTTOWsO..',
  '...OWOTTTTOWsO..',
  '...OWOTTYTOWsO..',
  '...OWOTTTTOWsO..',
  '.GGOOOOOOOOOOOG.',
  '................',
];

/** Podio con corona: oro en el centro, plata a la izquierda y bronce a la derecha. */
const PODIUM_ICON: PixelMap = [
  '.....Y..Y..Y....',
  '....OYOOYOOYO...',
  '....OYYYRYYYO...',
  '....OYYYYYYYO...',
  '.....OOOOOOO....',
  '................',
  '.....OOOOOOO....',
  '.....OYYYYYO....',
  '.OOOOOYYWYYO....',
  '.OsssOYYYYYO....',
  '.OsWsOYYYYYOOOOO',
  '.OsssOYYYYYOCCCO',
  '.OsssOYYYYYOCWCO',
  '.OsssOYYYYYOCCCO',
  '.OsssOYYYYYOCCCO',
  'OOOOOOOOOOOOOOOO',
];

const url = (c: HTMLCanvasElement) => c.toDataURL();

export const menuIcons: Record<MenuId, string> = {
  contratar: url(mapCanvas(BARN_ICON, P)),
  grupos: url(mapCanvas(BOARD_ICON, P)),
  arbol: url(mapCanvas(TREE_ICON, P)),
  diario: url(mapCanvas(DIARY_ICON, P)),
  ranking: url(mapCanvas(PODIUM_ICON, P)),
};

export const crownIcon = url(crownCanvas());
export const houseIcon = url(mapCanvas(HOUSE_ICON, P));

export const cropIcons: Record<CropId, string> = {
  zanahoria: url(mapCanvas(PLANT_MAPS.zanahoria[4], PLANT_PAL)),
  trigo: url(mapCanvas(PLANT_MAPS.trigo[4], PLANT_PAL)),
  tomate: url(mapCanvas(PLANT_MAPS.tomate[4], PLANT_PAL)),
  calabaza: url(mapCanvas(PLANT_MAPS.calabaza[4], PLANT_PAL)),
};

export const jobIcons: Record<JobId, string> = {
  recolector: url(gnomeIcon('recolector')),
  sembrador: url(gnomeIcon('sembrador')),
  porteador: url(gnomeIcon('porteador')),
};

export const nodeIcons: Record<NodeId, string> = {
  botas: url(mapCanvas(BOOT, P)),
  cafe: url(mapCanvas(CUP, P)),
  saco: url(mapCanvas(SACK, BASE)),
  porteadores: jobIcons.porteador,
  cesta: url(basketCanvas(3)),
  carretilla: url(mapCanvas(WHEELBARROW, P)),
  bancal: url(mapCanvas(SOIL, P)),
  trigo: cropIcons.trigo,
  abono: url(mapCanvas(FERTILIZER, P)),
  tomate: cropIcons.tomate,
  calabaza: cropIcons.calabaza,
  conservas: url(mapCanvas(STRAW_BASKET, P)),
  mercado: url(mapCanvas(MARKET, P)),
};

export const rootIcon = url(mapCanvas(PLANT_MAPS.zanahoria[1], PLANT_PAL));

/** Rasgos de carácter: un dibujito por rasgo para la ficha y las listas de gnomos. */
const TRAIT_MAPS: Record<TraitId, PixelMap> = {
  // caracol: no tiene prisa
  perezoso: [
    '....OOOO..',
    '...OCCCCO.',
    '..OCwwwCCO',
    'O.OCwCwCCO',
    'OO.OCwwCCO',
    'OlOOOCCCO.',
    'OllllllllO',
    '.OOOOOOOOO',
  ],
  // rayo
  nervioso: [
    '....OOOO',
    '...OYYYO',
    '..OYYYO.',
    '.OYYYOOO',
    'OYYYYYYO',
    'OOOOYYO.',
    '...OYYO.',
    '..OYYO..',
    '..OYO...',
    '..OO....',
  ],
  // manzana con un mordisco
  gloton: [
    '....Og...',
    '..OOOOO..',
    '.ORRRRRO.',
    'ORWRRRO..',
    'ORRRRO...',
    'ORRRRRO..',
    'ORRRRRRO.',
    '.ORRRRRO.',
    '..OOOOO..',
  ],
  // bocadillo de charla
  cotilla: [
    '.OOOOOOOOO.',
    'OWWWWWWWWWO',
    'OWKWWKWWKWO',
    'OWWWWWWWWWO',
    '.OOWOOOOOO.',
    '..OO.......',
  ],
  // luna con una zeta
  dormilon: [
    '..OOO.....',
    '.OYYO..OOO',
    'OYYO....O.',
    'OYYO...OOO',
    'OYYO......',
    'OYYYO.....',
    '.OYYYOOYO.',
    '..OOYYYO..',
    '....OOO...',
  ],
  // martillo
  currante: [
    '.OOOOOO.',
    'OssssssO',
    'OKKKKKKO',
    '.OOTTOO.',
    '..OTTO..',
    '..OTTO..',
    '..OTTO..',
    '..OTTO..',
    '..OOOO..',
  ],
};

const TRAIT_W = 12;
const TRAIT_H = 10;
/** Todos en un lienzo de 12 × 10, centrados, para que se escalen igual. */
function traitCanvas(map: PixelMap): HTMLCanvasElement {
  const c = makeCanvas(TRAIT_W, TRAIT_H);
  c.getContext('2d')!.drawImage(mapCanvas(map, P), (TRAIT_W - map[0].length) >> 1, (TRAIT_H - map.length) >> 1);
  return c;
}

export const traitIcons = Object.fromEntries(
  (Object.keys(TRAIT_MAPS) as TraitId[]).map(t => [t, url(traitCanvas(TRAIT_MAPS[t]))]),
) as Record<TraitId, string>;

/** Estrella de los gnomos legendarios. */
export const legendIcon = url(mapCanvas([
  '....O....',
  '...OYO...',
  'OOOOYOOOO',
  'OYYYYYYYO',
  '.OYYWYYO.',
  '..OYYYO..',
  '.OYYOYYO.',
  '.OYO.OYO.',
  '.OO...OO.',
], P));

/**
 * Marco de 24 × 24 para border-image (corte de 8 px): borde de madera con clavos dorados en las esquinas
 * y relleno de pergamino.
 */
export const frameImage: string = (() => {
  const c = makeCanvas(24, 24);
  const ctx = c.getContext('2d')!;
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  rect(1, 0, 22, 24, '#1a1c2c');
  rect(0, 1, 24, 22, '#1a1c2c');
  rect(1, 1, 22, 22, '#8b5a3c');
  rect(1, 1, 22, 1, '#c8925f');
  rect(1, 1, 1, 22, '#c8925f');
  rect(1, 22, 22, 1, '#5a3a2a');
  rect(22, 1, 1, 22, '#5a3a2a');
  rect(5, 5, 14, 14, '#1a1c2c');
  rect(6, 6, 12, 12, '#f0e2c0');
  rect(6, 6, 12, 1, '#d9c49a');
  for (const [x, y] of [[2, 2], [20, 2], [2, 20], [20, 20]]) {
    rect(x, y, 2, 2, '#ffcd75');
    rect(x + 1, y + 1, 1, 1, '#a8723f');
  }
  return url(c);
})();

/** Botón pequeño de madera (corte de 4 px) para la barra y las ventanas. */
export const buttonImage: string = (() => {
  const c = makeCanvas(12, 12);
  const ctx = c.getContext('2d')!;
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  rect(1, 0, 10, 12, '#1a1c2c');
  rect(0, 1, 12, 10, '#1a1c2c');
  rect(1, 1, 10, 10, '#c8925f');
  rect(1, 1, 10, 1, '#e0b07a');
  rect(1, 9, 10, 2, '#8b5a3c');
  return url(c);
})();
