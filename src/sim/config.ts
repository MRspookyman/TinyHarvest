import type { Branch, CritterKind, CropId, JobId, NodeId, Priority, TalentId, TraitId } from './types';

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
/**
 * Pozo del regador (iteración 7): entre el tablón y el bancal, en la hierba de arriba. (x, y, w, h) es su caja;
 * el regador se pone en (x + w/2, y + h + 2) para llenar la regadera. Solo se dibuja con «regadores» comprado.
 */
export const WELL = { x: 98, y: 28, w: 12, h: 16 } as const;
/**
 * Estatua del Gnomo Dorado (iteración 8): a la derecha del bancal. Se pulsa para abrir la ventana «Temporada»
 * (fin de temporada, árbol dorado de talentos y salón de la fama). Crece con las temporadas jugadas.
 */
export const STATUE = { x: 280, y: 96, w: 16, h: 28 } as const;

export const STAGES = 5;
export const RIPE = STAGES - 1;
/** fase extra: la planta madura que nadie ha recogido a tiempo */
export const ROTTEN = STAGES;

export interface CropDef {
  value: number;
  /** segundos de semilla a madura (seco y sin abono; regada crece más rápido, ver WATER) */
  grow: number;
  /** segundos que aguanta madura antes de echarse a perder */
  keep: number;
  /** con sed: sin regar crece a WATER.dry de su velocidad */
  thirsty?: boolean;
}
export const CROPS: Record<CropId, CropDef> = {
  // Rápido y laborioso → lento y cómodo. Contando ~10 s de espera entre madurar y volver a sembrar,
  // monedas/s por parcela: 0,25 → 0,22 → 0,19 → 0,16; monedas por viaje: 5 → 9 → 18 → 45.
  zanahoria: { value: 5, grow: 10, keep: 20 },
  trigo: { value: 9, grow: 31, keep: 60 },
  // la fresa queda entre la zanahoria y el trigo (más valor por viaje que la una, más por parcela que el otro),
  // pero se estropea enseguida: pide gente de sobra o conservas
  fresa: { value: 8, grow: 24, keep: 10 },
  tomate: { value: 20, grow: 85, keep: 30, thirsty: true },
  calabaza: { value: 45, grow: 270, keep: 120 },
  // el melón es lo que más vale por viaje y por riego, pero solo crece si alguien lo riega
  melon: { value: 60, grow: 300, keep: 60, thirsty: true },
};
/** a partir de esta fracción del aguante, la planta amarillea: deja al menos 10 s de aviso */
export const WILT_WARNING = 0.5;
export const CROP_IDS: CropId[] = ['zanahoria', 'trigo', 'fresa', 'tomate', 'calabaza', 'melon'];
export const PRIORITIES: Priority[] = ['cercano', 'valioso', 'urgente', ...CROP_IDS.map(c => `solo_${c}` as const)];

export const JOBS: Record<JobId, { base: number }> = {
  recolector: { base: 12 },
  sembrador: { base: 18 },
  porteador: { base: 45 },
  regador: { base: 50 },
  guardian: { base: 60 },
};
export const JOB_IDS: JobId[] = ['recolector', 'sembrador', 'porteador', 'regador', 'guardian'];
/** el nodo del árbol que desbloquea cada oficio; los que no salen aquí se contratan desde el principio */
export const JOB_NODE: Partial<Record<JobId, NodeId>> = { porteador: 'porteadores', regador: 'regadores', guardian: 'guardianes' };
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
  guardianes: { branch: 'gnomos', base: 350, mult: 1, max: 1, parent: 'botas', x: 44, y: 38 },
  silbato: { branch: 'gnomos', base: 500, mult: 2.5, max: 3, parent: 'guardianes', x: 44, y: 15 },
  bancal: { branch: 'bancal', base: 75, mult: 1.55, max: 9, parent: null, x: 50, y: 62 },
  trigo: { branch: 'cultivos', base: 180, mult: 1, max: 1, parent: null, x: 76, y: 70 },
  abono: { branch: 'cultivos', base: 135, mult: 2.2, max: 5, parent: 'trigo', x: 91, y: 47 },
  fresa: { branch: 'cultivos', base: 400, mult: 1, max: 1, parent: 'trigo', x: 57, y: 47 },
  tomate: { branch: 'cultivos', base: 750, mult: 1, max: 1, parent: 'trigo', x: 69, y: 47 },
  calabaza: { branch: 'cultivos', base: 3000, mult: 1, max: 1, parent: 'tomate', x: 69, y: 26 },
  melon: { branch: 'cultivos', base: 12000, mult: 1, max: 1, parent: 'calabaza', x: 69, y: 6 },
  conservas: { branch: 'cultivos', base: 400, mult: 2.5, max: 3, parent: 'abono', x: 91, y: 26 },
  mercado: { branch: 'cultivos', base: 1200, mult: 2.15, max: 5, parent: 'conservas', x: 91, y: 6 },
  regadores: { branch: 'cultivos', base: 500, mult: 1, max: 1, parent: 'abono', x: 80, y: 26 },
  regadera: { branch: 'cultivos', base: 700, mult: 2.5, max: 3, parent: 'regadores', x: 80, y: 6 },
};
/** efectos de los nodos nuevos de la iteración 5 */
export const CARRETILLA_PER_LEVEL = 3;
export const CONSERVAS_PER_LEVEL = 0.25;
export const MERCADO_PER_LEVEL = 0.15;

/**
 * Riego (iteración 7). Una parcela regada crece WATER.boost veces más rápido durante `duration` s (más con la
 * regadera); un cultivo con sed sin regar crece a WATER.dry de su velocidad. El regador lleva agua para `can`
 * riegos y vuelve al pozo (WELL) a llenar la regadera. Riega lo que crece y está seco o casi (menos de `low` s).
 */
export const WATER = {
  duration: 90,
  /** la regadera alarga el riego un tanto por uno por nivel… */
  regaderaTime: 0.3,
  /** …y acorta lo que tarda en regar */
  regaderaWork: 0.15,
  boost: 1.4,
  dry: 0.3,
  can: 6,
  /** segundos que tarda en regar una parcela y en llenar la regadera */
  work: 1,
  refill: 1.5,
  low: 8,
} as const;
/**
 * Guardián (iteración 7): patrulla por fuera del bancal y a veces se para a vigilar (en `post`, al pie de su
 * torre, o donde esté). Ve los bichos a `sight` px (más con el silbato) y va a por ellos en el acto.
 */
export const GUARD = {
  sight: 60,
  /** px de vista y tanto por uno de velocidad que da cada nivel de silbato */
  silbatoSight: 25,
  silbatoSpeed: 0.15,
  /** a cuánto del borde del bancal patrulla */
  margin: 6,
  watch: 0.35,
  post: { x: 184, y: 57 },
} as const;
/**
 * Multiplicador de organización (B6): 1 + max × (media de las partes y peor parte, mezcladas según `worstWeight`).
 * Cada parte es un cociente de contadores
 * que se olvidan con una ventana exponencial de `window` s. Sin datos una parte vale 1 (nada ha ido mal todavía),
 * así que una partida nueva empieza con el multiplicador entero y lo va ajustando: el primer minuto no castiga.
 * `floor` es el peso de ese «sin datos» (en cultivos para la cosecha y en segundos para las demás).
 */
export const ORG = {
  max: 0.3,
  /** peso de la peor parte frente a la media: así un solo cuello de botella baja el multiplicador de verdad */
  worstWeight: 0.5,
  window: 120,
  /** una parcela vacía empieza a contar como desatendida pasados estos segundos */
  grace: 5,
  floorCount: 1,
  floorTime: 10,
} as const;
export const NODE_IDS = Object.keys(TREE) as NodeId[];
export const TREE_ROOT = { x: 50, y: 90 } as const;

// ---------- Prestigio (iteración 8) ----------

/**
 * Semillas doradas al acabar la temporada: floor((ganado / seedUnit) ** seedPow). Crece menos que lo ganado:
 * alargar la temporada cunde cada vez menos. Por debajo de minSeeds no se puede acabar (ajustado con `npm run balance`, i).
 */
export const PRESTIGE = { seedUnit: 850, seedPow: 0.5, minSeeds: 6, historyMax: 20 } as const;

/** Talento del árbol dorado: mismo esquema que NodeDef, sin rama. El coste va en semillas doradas. */
export interface TalentDef {
  base: number;
  mult: number;
  max: number;
  parent: TalentId | null;
  x: number;
  y: number;
}
// Tres ramas desde la raíz: crecer (izquierda), heredar (centro) y negociar (derecha). (x, y) en % como en TREE.
export const TALENTS: Record<TalentId, TalentDef> = {
  abonoDorado: { base: 1, mult: 2, max: 5, parent: null, x: 22, y: 64 },
  semillasConocidas: { base: 2, mult: 1.6, max: 5, parent: 'abonoDorado', x: 10, y: 37 },
  bancalHeredado: { base: 2, mult: 1.8, max: 4, parent: 'abonoDorado', x: 32, y: 37 },
  herencia: { base: 1, mult: 2, max: 5, parent: null, x: 50, y: 64 },
  experiencia: { base: 2, mult: 2, max: 3, parent: 'herencia', x: 50, y: 37 },
  casaHeredada: { base: 3, mult: 2, max: 3, parent: 'experiencia', x: 40, y: 10 },
  veterano: { base: 3, mult: 2, max: 3, parent: 'experiencia', x: 60, y: 10 },
  mercadoDorado: { base: 1, mult: 2, max: 5, parent: null, x: 78, y: 64 },
  contrato: { base: 2, mult: 2, max: 4, parent: 'mercadoDorado', x: 68, y: 37 },
  suerte: { base: 2, mult: 2, max: 3, parent: 'mercadoDorado', x: 90, y: 37 },
};
export const TALENT_IDS = Object.keys(TALENTS) as TalentId[];
export const TALENT_ROOT = { x: 50, y: 92 } as const;
/**
 * Efecto de cada nivel: abonoDorado y mercadoDorado son fracciones (+15 % de velocidad de crecimiento / de precio),
 * herencia son monedas, contrato lo que baja COST_GROWTH, suerte lo que sube la probabilidad de legendario;
 * el resto cuenta cosas (gnomos de cada oficio, niveles del bancal o de la casa, cultivos, veteranos).
 */
export const TALENT_EFFECT: Record<TalentId, number> = {
  abonoDorado: 0.15, mercadoDorado: 0.15, herencia: 200, experiencia: 1, contrato: 0.03,
  bancalHeredado: 1, casaHeredada: 1, semillasConocidas: 1, veterano: 1, suerte: 0.03,
};

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

// ---------- Enganche (iteración 10) ----------

/**
 * Zonas (G1): los recolectores, sembradores y regadores de un grupo con zona «se conocen el terreno»: andan y trabajan
 * hasta un ZONE_BONUS más rápido. La ventaja crece cuanto más pequeña es la zona (una zona de todo el bancal no da nada).
 * Ajustado con `npm run balance` (apartado j).
 */
export const ZONE_BONUS = 0.4;
/** Cosecha dorada (G4): al madurar, una planta de cada tantas sale dorada y vale `mult` veces más. */
export const GOLDEN = { chance: 0.008, mult: 10 } as const;
/** Maestría de cultivo (G5): cosechas de un cultivo en la temporada para cada nivel; cada nivel, +bonus a lo que vale. */
export const MASTERY = { steps: [25, 75, 200, 500, 1200], bonus: 0.02 } as const;
/** Álbum (G6): completar una página da estas semillas doradas; el cromo de maestría sale a partir de este nivel. */
export const ALBUM = { pageSeeds: 1, masteryLevel: 3 } as const;
/** Arenga del capataz (G7): durante `duration` s todos andan y trabajan un `mult` más rápido; se recarga en `cooldown` s. */
export const RALLY = { mult: 0.5, duration: 30, cooldown: 300 } as const;
/**
 * Encargos del pueblo (G8): llegan cada `gap` s (el primero a los `first`), duran `time` s y piden lo que el bancal
 * y los recolectores pueden dar en ese tiempo con algo de esfuerzo (`effort`). Para calcularlo, un viaje de recolector
 * dura unos `trip` s y a mano se recogen unos `byHand` más. Lo cosechado se vende igual; el encargo paga además un
 * premio de `reward` veces lo que vale.
 */
export const ORDERS = { first: 90, gap: { min: 150, max: 300 }, time: 180, effort: 0.6, trip: 8, byHand: 15, min: 5, max: 80, reward: 0.5 } as const;
/**
 * Amistades (G9): saludarse, charlar y jugar a las cartas suman afinidad; al llegar a `need`, si ninguno tiene ya amigo,
 * se hacen amigos. Dos amigos del mismo grupo trabajan un `bonus` más rápido.
 */
export const FRIENDS = { greet: 1, chat: 3, cards: 4, need: 12, bonus: 0.05 } as const;
/**
 * Estaciones (G10): cada temporada del prestigio es una estación, por orden y en bucle. Cada una tiene su cultivo
 * favorito, que se vende un `bonus` más caro mientras dura.
 */
export const SEASON_IDS = ['primavera', 'verano', 'otono', 'invierno'] as const;
export type SeasonId = (typeof SEASON_IDS)[number];
export const SEASONS: { favorite: Record<SeasonId, CropId>; bonus: number } = {
  favorite: { primavera: 'fresa', verano: 'melon', otono: 'calabaza', invierno: 'zanahoria' },
  bonus: 0.1,
};
