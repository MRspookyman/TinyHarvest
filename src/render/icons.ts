// Iconos pixel art para la interfaz HTML (barra, ventanas y árbol de mejoras).
// Se dibujan en canvas y se pasan a la interfaz como data URL.
import { SUCESOS, type Suceso } from '../sim/album';
import { CROP_IDS, JOB_IDS } from '../sim/config';
import type { CropId, JobId, NodeId, TalentId, TraitId } from '../sim/types';
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
/** Álbum abierto con cromos pegados (uno torcido). */
const ALBUM_ICON: PixelMap = [
  '................',
  '................',
  '.OOOOOOO.OOOOOO.',
  'OWWWWWWWOWWWWWWO',
  'OWOOOOWWOWWOOOWO',
  'OWOBBOWWOWOGGOWO',
  'OWOBBOWWOWOGGOWO',
  'OWOOOOWWOWWOOOWO',
  'OWWWWWWWOWWWWWWO',
  'OWWOOOOWOWOOOOWO',
  'OWWOYYOWOWORROWO',
  'OWWOOOOWOWOOOOWO',
  'OWWWWWWWOWWWWWWO',
  'OTTTTTTTOTTTTTTO',
  '.OOOOOOOOOOOOOO.',
  '................',
];
/** Sucesos del huerto para el álbum: cuervo, caracol, topo, rana, pancarta de huelga y espantapájaros. */
const EVENT_ICONS: Record<Suceso, PixelMap> = {
  cuervo: [
    '............',
    '.....OOO....',
    '....OKKKO...',
    '...OKKWKOYY.',
    '...OKKKKOO..',
    '.OOKKKKKO...',
    'OKKKKKKKO...',
    '.OKKKKKO....',
    '..OOKKO.....',
    '....OYO.....',
    '....Y.Y.....',
    '............',
  ],
  caracol: [
    '............',
    '............',
    '...OOOO..O.O',
    '..OCCCCO.O.O',
    '.OCcccCCOO.O',
    '.OCcCCcCOYYO',
    '.OCcccCCOYYO',
    '..OCCCCOYYYO',
    'OOOOOOOOYYO.',
    'OYYYYYYYYYO.',
    '.OOOOOOOOO..',
    '............',
  ],
  topo: [
    '............',
    '...OOOOOO...',
    '..OKKKKKKO..',
    '.OKKWKKWKKO.',
    '.OKKOKKOKKO.',
    '.OKKKppKKKO.',
    '..OKKppKKO..',
    '.OTTOOOOTTO.',
    'OTTTTTTTTTTO',
    'OTtTTTTTTtTO',
    '.OOOOOOOOOO.',
    '............',
  ],
  ranas: [
    '............',
    '..OO....OO..',
    '.OWWO..OWWO.',
    '.OWOO..OOWO.',
    '.OGGOOOOGGO.',
    'OGGGGGGGGGGO',
    'OGlllllllGGO',
    'OGGOOOOOOGGO',
    '.OGGGGGGGGO.',
    'OGO.OGGO.OGO',
    'OO..OOOO..OO',
    '............',
  ],
  sindicato: [
    'OOOOOOOOOOOO',
    'OWWWWWWWWWWO',
    'OWRRWRRWRRWO',
    'OWWWWWWWWWWO',
    'OWRRRWWRRRWO',
    'OWWWWWWWWWWO',
    'OOOOOTTOOOOO',
    '.....TT.....',
    '.....TT.....',
    '.....TT.....',
    '.....TT.....',
    '.....TT.....',
  ],
  espantapajaros: [
    '....OOOO....',
    '...OYYYYO...',
    '..OOOOOOOO..',
    '....OCCO....',
    '....OCCO....',
    'OOOOOBBOOOOO',
    'OTTTOBBOTTTO',
    'OOOOOBBOOOOO',
    '....OBBO....',
    '....OTTO....',
    '....OTTO....',
    '....OOOO....',
  ],
};
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

/** Regadera grande con el pitorro hacia la derecha y unas gotas. */
const WATERING_CAN: PixelMap = [
  '....OOOO......',
  '...O....O.....',
  '...O....O...B.',
  '.OOOOOOOOO.OOB',
  'OGGGGGGGGO.OGO',
  'OGlGGGGGGOOGO.',
  'OGlGGGGGGGGO..',
  'OGGGGGGGGGO..B',
  'OGGGGGGGGO..B.',
  '.OOOOOOOO.....',
];
/** Silbato de latón con su cordón. */
const WHISTLE: PixelMap = [
  '..........RR',
  '.........R..',
  '..OOOOOOOR..',
  '.OYYYYYYYO..',
  'OYWYYYYOYO..',
  'OYYYYYOOOO..',
  '.OYYYO......',
  '..OOO.......',
];

// ---------- Prestigio: todo en oro ----------
/** oro claro, medio y oscuro, y piel para las fotos */
const GOLD: Palette = { ...P, Y: '#ffcd75', y: '#f4b41b', d: '#c28a3a', S: '#f2b98c' };

/** Estatua del Gnomo Dorado sobre su pedestal con placa. */
const STATUE_ICON: PixelMap = [
  '.......OO.......',
  '......OYYO......',
  '......OYyO......',
  '.....OYYYyO.....',
  '.....OYWYyO.....',
  '....OYYYYYyO....',
  '...OYYYYYYYyO...',
  '...OOddddddOO...',
  '....OYyYYyYO....',
  '....OYYyyYYO....',
  '.....OYYYYO.....',
  '..OOOOOOOOOOOO..',
  '...OssssssssO...',
  '...OsKyyyyKsO...',
  '...OssssssssO...',
  '..OOOOOOOOOOOO..',
];
/** Semilla dorada: la moneda del prestigio. */
const GOLDEN_SEED: PixelMap = [
  '...OO...',
  '..OYYO..',
  '.OYWYyO.',
  '.OYYYyO.',
  'OYYYYyyO',
  'OYYYyyyO',
  'OyYyyydO',
  '.OyyddO.',
  '..OddO..',
  '...OO...',
];
/** Cofre abierto rebosando monedas (herencia). */
const COIN_CHEST: PixelMap = [
  '...Y..Y.W.....',
  '..YYYYYYYYYY..',
  '.OYyYYyYYyYYO.',
  'OOOOOOOOOOOOOO',
  'OTTTTyOOyTTTTO',
  'OTTTTyYYyTTTTO',
  'OyyyyyOOyyyyyO',
  'OTTTTTTTTTTTTO',
  'OTTTTTTTTTTTTO',
  'OOOOOOOOOOOOOO',
];
/** Foto enmarcada en oro de dos gnomos veteranos (experiencia). */
const VETERAN_PHOTO: PixelMap = [
  '.....OO.....',
  '....O..O....',
  '.OOOOOOOOOO.',
  'OyyyyyyyyyyO',
  'OyBBBBBBBByO',
  'OyBRBBBBGByO',
  'OyRRRBBGGGyO',
  'OySSSBBSSSyO',
  'OyWWWBBWWWyO',
  'OyWWWBBWWWyO',
  'OyyyyyyyyyyO',
  'OOOOOOOOOOOO',
];
/** Contrato enrollado con sello de oro (contrato). */
const CONTRACT: PixelMap = [
  '.OOOOOOOOOO.',
  'OCcCCCCCCcCO',
  '.OOWWWWWWOO.',
  '..OWssssWO..',
  '..OWWWWWWO..',
  '..OWsssWWO..',
  '..OWWWWWWO..',
  '..OWssWyyO..',
  '..OWWWWyyO..',
  '.OOWWWWRROO.',
  'OCcCCCCCCcCO',
  '.OOOOOOOOOO.',
];
/** Sobre de semillas dorado con un brote (semillas conocidas). */
const SEED_PACKET: PixelMap = [
  '.OOOOOOOO.',
  'OydydydydO',
  'OYYYYYYYYO',
  'OYWWWWWWYO',
  'OYWWGGWWYO',
  'OYWGlGGWYO',
  'OYWWGGWWYO',
  'OYWWdWWWYO',
  'OYWWWWWWYO',
  'OYYYYYYYYO',
  'OyyyyyyyyO',
  '.OOOOOOOO.',
];
/** Medalla con cinta (veterano). */
const MEDAL: PixelMap = [
  'OOOO..OOOO',
  'ORRBOOBRRO',
  '.ORRBBRRO.',
  '..ORRRRO..',
  '...OOOO...',
  '..OYYYYO..',
  '.OYWYYyyO.',
  '.OYYYYyyO.',
  '.OYYYyyyO.',
  '.OyYyyydO.',
  '..OyyddO..',
  '...OOOO...',
];
/** Trébol de cuatro hojas con el corazón de oro (suerte). */
const CLOVER: PixelMap = [
  '.OOO.OOO..Y.',
  'OlGGOGGlO...',
  'OGGGOGGGO...',
  'OOOOyOOOO...',
  'OGGGOGGGO...',
  'OlGGOGGGO...',
  '.OOO.OOOO...',
  '.......OgO..',
  '........OgO.',
  '.........OO.',
];

const url = (c: HTMLCanvasElement) => c.toDataURL();

export const menuIcons: Record<MenuId, string> = {
  contratar: url(mapCanvas(BARN_ICON, P)),
  grupos: url(mapCanvas(BOARD_ICON, P)),
  arbol: url(mapCanvas(TREE_ICON, P)),
  diario: url(mapCanvas(DIARY_ICON, P)),
  ranking: url(mapCanvas(PODIUM_ICON, P)),
  temporada: url(mapCanvas(STATUE_ICON, GOLD)),
  album: url(mapCanvas(ALBUM_ICON, P)),
};

export const eventIcons = Object.fromEntries(
  SUCESOS.map(k => [k, url(mapCanvas(EVENT_ICONS[k], P))]),
) as Record<Suceso, string>;

export const crownIcon = url(crownCanvas());
export const houseIcon = url(mapCanvas(HOUSE_ICON, P));

/** Megáfono del capataz para la arenga (G7). */
export const rallyIcon = url(mapCanvas([
  '................',
  '................',
  '..........OO....',
  '.........OYO....',
  '........OYYO..O.',
  '...OOOOOYYYO.O..',
  '..OYYYYYYYYO....',
  '.OYYWYYYYYYO.OOO',
  '.OYYYYYYYYYO....',
  '..OOOOOdYYYO.O..',
  '....OTTOdYYO..O.',
  '....OTTO.OdO....',
  '....OTTO..OO....',
  '....OOOO........',
  '................',
  '................',
], GOLD));

export const cropIcons = Object.fromEntries(
  CROP_IDS.map(c => [c, url(mapCanvas(PLANT_MAPS[c][4], PLANT_PAL))]),
) as Record<CropId, string>;

export const jobIcons = Object.fromEntries(JOB_IDS.map(j => [j, url(gnomeIcon(j))])) as Record<JobId, string>;

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
  guardianes: jobIcons.guardian,
  silbato: url(mapCanvas(WHISTLE, P)),
  regadores: jobIcons.regador,
  regadera: url(mapCanvas(WATERING_CAN, P)),
  fresa: cropIcons.fresa,
  melon: cropIcons.melon,
};

export const rootIcon = url(mapCanvas(PLANT_MAPS.zanahoria[1], PLANT_PAL));

export const goldenSeedIcon = url(mapCanvas(GOLDEN_SEED, GOLD));

/** Talentos del árbol dorado: lo mismo que dejan en el huerto, pintado en oro. */
export const talentIcons: Record<TalentId, string> = {
  // saco de abono y bancal de siempre, pero dorados
  abonoDorado: url(mapCanvas(FERTILIZER, { ...GOLD, C: '#f4b41b' })),
  mercadoDorado: url(mapCanvas(MARKET, { ...GOLD, R: '#f4b41b' })),
  herencia: url(mapCanvas(COIN_CHEST, GOLD)),
  experiencia: url(mapCanvas(VETERAN_PHOTO, GOLD)),
  contrato: url(mapCanvas(CONTRACT, GOLD)),
  bancalHeredado: url(mapCanvas(SOIL, { ...GOLD, l: '#ffcd75', G: '#f4b41b' })),
  casaHeredada: url(mapCanvas(HOUSE_ICON, { ...GOLD, R: '#f4b41b' })),
  semillasConocidas: url(mapCanvas(SEED_PACKET, GOLD)),
  veterano: url(mapCanvas(MEDAL, GOLD)),
  suerte: url(mapCanvas(CLOVER, GOLD)),
};

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
