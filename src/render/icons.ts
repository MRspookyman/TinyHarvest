// Iconos pixel art para la interfaz HTML (barra, ventanas y árbol de mejoras).
// Se dibujan en canvas y se pasan a la interfaz como data URL.
import type { CropId, JobId, NodeId } from '../sim/types';
import { makeCanvas, mapCanvas, type Palette, type PixelMap } from './pixelart';
import { BASE, basketCanvas, gnomeIcon, PLANT_MAPS, PLANT_PAL, SACK } from './sprites';
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

const url = (c: HTMLCanvasElement) => c.toDataURL();

export const menuIcons: Record<MenuId, string> = {
  contratar: url(mapCanvas(BARN_ICON, P)),
  grupos: url(mapCanvas(BOARD_ICON, P)),
  arbol: url(mapCanvas(TREE_ICON, P)),
  diario: url(mapCanvas(DIARY_ICON, P)),
};

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
  bancal: url(mapCanvas(SOIL, P)),
  trigo: cropIcons.trigo,
  abono: url(mapCanvas(FERTILIZER, P)),
  tomate: cropIcons.tomate,
  calabaza: cropIcons.calabaza,
};

export const rootIcon = url(mapCanvas(PLANT_MAPS.zanahoria[1], PLANT_PAL));

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
