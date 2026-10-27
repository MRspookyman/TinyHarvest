import type { Branch, CritterKind, CropId, JobId, NodeId, Priority, TraitId } from './types';

// Coordenadas en píxeles lógicos del mundo (rejilla de 16 px por sprite).
export const WORLD = { w: 300, h: 200 } as const;
export const BARN = { x: 14, y: 30, w: 52, h: 46 } as const;
export const DOOR = { x: BARN.x + 26, y: BARN.y + 52 } as const;
/** tablón de anuncios (grupos), entre el granero y el bancal */
export const BOARD = { x: 76, y: 50, w: 22, h: 24 } as const;
/** árbol viejo (mejoras), bajo el granero */
export const OLD_TREE = { x: 4, y: 96, w: 40, h: 46 } as const;
export const FIELD = { x: 112, y: 58, cell: 18, maxCols: 9, maxRows: 6, startCols: 3, startRows: 3 } as const;
/** cesta del bancal: (x, y) es donde se ponen los gnomos para usarla */
export const BASKET = { x: 100, y: DOOR.y + 8, base: 30, perLevel: 15 } as const;
/**
 * Casa de gnomos: el primer edificio. Cada nivel añade camas; sin cama libre no se puede contratar.
 * (x, y, w, h) es su caja en el mundo; se pulsa para abrir el granero (contratar y ampliar la casa).
 */
export const HOUSE = { x: 56, y: 96, w: 30, h: 28, base: 8, perLevel: 4, max: 8, cost: 60, mult: 1.9 } as const;
/** donde pasean los gnomos sin trabajo: la hierba delante de su casa, junto al árbol viejo */
export const IDLE_AREA = { x0: 50, x1: 104, y0: 128, y1: 146 } as const;

export const STAGES = 5;
export const RIPE = STAGES - 1;
/** fase extra: la planta madura que nadie ha recogido a tiempo */
export const ROTTEN = STAGES;

export interface CropDef {
  value: number;
  /** segundos de semilla a madura */
  grow: number;
  /** segundos que aguanta madura antes de echarse a perder */
  keep: number;
}
export const CROPS: Record<CropId, CropDef> = {
  // Rápido y laborioso → lento y cómodo. Contando ~10 s de espera entre madurar y volver a sembrar,
  // monedas/s por parcela: 0,25 → 0,22 → 0,19 → 0,16; monedas por viaje: 5 → 9 → 18 → 45.
  zanahoria: { value: 5, grow: 10, keep: 20 },
  trigo: { value: 9, grow: 31, keep: 60 },
  tomate: { value: 18, grow: 85, keep: 30 },
  calabaza: { value: 45, grow: 270, keep: 120 },
};
/** a partir de esta fracción del aguante, la planta amarillea: deja al menos 10 s de aviso */
export const WILT_WARNING = 0.5;
export const CROP_IDS: CropId[] = ['zanahoria', 'trigo', 'tomate', 'calabaza'];
export const PRIORITIES: Priority[] = ['cercano', 'valioso', 'urgente', ...CROP_IDS.map(c => `solo_${c}` as const)];

export const JOBS: Record<JobId, { base: number }> = {
  recolector: { base: 12 },
  sembrador: { base: 18 },
  porteador: { base: 45 },
};
export const JOB_IDS: JobId[] = ['recolector', 'sembrador', 'porteador'];
export const COST_GROWTH = 1.3;
/** tope absoluto; el tope real lo marca la casa de gnomos (HOUSE) */
export const MAX_GNOMES = 40;
export const PORTER_CAPACITY = 5;
export const MAX_GROUPS = 20;
export const GROUP_NAME_MAX = 24;
/**
 * «Valioso» elige el mayor valor por paseo: valor / (distancia + VALUE_DISTANCE_BIAS).
 * El sesgo evita que una parcela pegada al gnomo gane siempre por estar a distancia casi cero.
 */
export const VALUE_DISTANCE_BIAS = 30;
/** Para quitarle la corona de su oficio al líder hay que sacarle al menos estas tareas (evita cambios cada segundo). */
export const CROWN_MARGIN = 3;

/** Colores para los grupos, sacados de la paleta del juego y elegidos para que se vean sobre la hierba. */
export const GROUP_PALETTE = [
  '#41a6f6', '#e8687d', '#ffcd75', '#73eff7', '#b55088', '#f4f4f4',
  '#ef7d57', '#3b5dc9', '#b13e53', '#a7f070', '#8b5a3c', '#333c57',
] as const;

// ---------- Árbol de mejoras ----------
// El árbol crece hacia arriba desde la raíz «Huerto». (x, y) en % del área del árbol; y = 100 es abajo.

export interface NodeDef {
  branch: Branch;
  base: number;
  mult: number;
  max: number;
  /** nodo padre: hay que tenerlo al menos a nivel 1; null = cuelga de la raíz */
  parent: NodeId | null;
  x: number;
  y: number;
}
export const TREE: Record<NodeId, NodeDef> = {
  botas: { branch: 'gnomos', base: 90, mult: 2, max: 5, parent: null, x: 24, y: 70 },
  cafe: { branch: 'gnomos', base: 120, mult: 2.3, max: 4, parent: 'botas', x: 9, y: 47 },
  saco: { branch: 'gnomos', base: 150, mult: 2.4, max: 4, parent: 'botas', x: 31, y: 47 },
  porteadores: { branch: 'gnomos', base: 240, mult: 1, max: 1, parent: 'saco', x: 31, y: 26 },
  cesta: { branch: 'gnomos', base: 450, mult: 2, max: 3, parent: 'porteadores', x: 31, y: 6 },
  carretilla: { branch: 'gnomos', base: 600, mult: 2.5, max: 3, parent: 'porteadores', x: 14, y: 20 },
  bancal: { branch: 'bancal', base: 75, mult: 1.55, max: 9, parent: null, x: 50, y: 62 },
  trigo: { branch: 'cultivos', base: 180, mult: 1, max: 1, parent: null, x: 76, y: 70 },
  abono: { branch: 'cultivos', base: 135, mult: 2.2, max: 5, parent: 'trigo', x: 91, y: 47 },
  tomate: { branch: 'cultivos', base: 750, mult: 1, max: 1, parent: 'trigo', x: 69, y: 47 },
  calabaza: { branch: 'cultivos', base: 3000, mult: 1, max: 1, parent: 'tomate', x: 69, y: 26 },
  conservas: { branch: 'cultivos', base: 400, mult: 2.5, max: 3, parent: 'abono', x: 91, y: 26 },
  mercado: { branch: 'cultivos', base: 1200, mult: 1.8, max: 5, parent: 'conservas', x: 80, y: 7 },
};
/** efectos de los nodos nuevos de la iteración 5 */
export const CARRETILLA_PER_LEVEL = 3;
export const CONSERVAS_PER_LEVEL = 0.25;
export const MERCADO_PER_LEVEL = 0.15;
export const NODE_IDS = Object.keys(TREE) as NodeId[];
export const TREE_ROOT = { x: 50, y: 90 } as const;

export const BASE_SPEED = 22;
export const HARVEST_TIME = 0.8;
export const PLANT_TIME = 0.6;
/** tiempo extra para arrancar una planta echada a perder antes de sembrar */
export const CLEAR_TIME = 0.8;
export const PICKUP_TIME = 0.5;
export const LOG_MAX = 40;

// ---------- Vida en el huerto (iteración 6) ----------

export const TRAIT_IDS: TraitId[] = ['perezoso', 'nervioso', 'gloton', 'cotilla', 'dormilon', 'currante'];
/** multiplicador de velocidad al andar por rasgo */
export const TRAIT_WALK: Partial<Record<TraitId, number>> = { perezoso: 0.85, nervioso: 1.2 };
/** multiplicador del tiempo de trabajo por rasgo (menos = más rápido) */
export const TRAIT_WORK: Partial<Record<TraitId, number>> = { currante: 0.85 };
/** probabilidad de que un gnomo contratado sea legendario, y cuánto mejor anda y trabaja */
export const LEGENDARY = { chance: 0.03, mult: 1.25 } as const;
/** lo que dura un bocadillo de intención o de reacción; corto para que con muchos gnomos no se llene el bancal */
export const BUBBLE_TIME = 0.9;
/** dos gnomos andando a menos de esto se ven; luego cada uno tarda MEET_COOLDOWN en volver a reaccionar */
export const MEET_DIST = 6;
export const MEET_COOLDOWN = 20;
/** segundos entre sucesos pequeños (cuervo, caracol, topo) */
export const EVENT_GAP = { min: 30, max: 90, first: 30 } as const;
/** uno de cada tantos sucesos es un suceso raro (ranas, sindicato, espantapájaros) */
export const HAPPENING_EVERY = 8;
/** el cuervo se come la planta a los CROW_EAT s; un gnomo libre se da cuenta a los CROW_NOTICE s */
export const CROW_EAT = 8;
export const CROW_NOTICE = 1;
/** el topo bloquea su parcela este tiempo */
export const MOLE_TIME = 15;
export const CRITTER_SPEED: Record<CritterKind, number> = { cuervo: 45, caracol: 4, topo: 0, mariposa: 14, rana: 26 };
/** sucesos raros: duración (s) */
export const HAPPENING_TIME = { ranas: 8, sindicato: 8, sindicatoCafe: 4, espantapajaros: 15 } as const;
/**
 * Probabilidades de la vida del huerto (por decisión, salvo `trip`, que es por segundo andando).
 * Ajustadas con `npm run balance` (apartado f): que siempre pase algo sin que nadie deje de trabajar.
 */
export const LIFE = {
  /** el perezoso se para a pensar al elegir tarea */
  lazyThink: 0.08,
  /** el nervioso tropieza solo, por segundo andando */
  trip: 0.012,
  /** el glotón se come la zanahoria que acaba de recoger */
  glutton: 0.2,
  // en los ratos libres (cada vez que un ocioso decide qué hacer)
  nap: 0.1,
  napDormilon: 0.22,
  napCurrante: 0.04,
  sit: 0.1,
  sitCurrante: 0.02,
  /** buscar a otro ocioso para charlar o jugar a las cartas */
  social: 0.15,
  socialCotilla: 0.35,
  chase: 0.06,
  // al cruzarse dos gnomos
  bump: 0.08,
  bumpNervioso: 0.3,
  greet: 1,
} as const;
