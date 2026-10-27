export type CropId = 'zanahoria' | 'trigo' | 'tomate' | 'calabaza';
export type JobId = 'recolector' | 'sembrador' | 'porteador';
export type Priority = 'cercano' | 'valioso' | 'urgente' | `solo_${CropId}`;
/** Nodos del árbol de mejoras. Los cultivos nuevos y la ampliación del bancal también son nodos. */
export type NodeId =
  | 'botas' | 'cafe' | 'saco' | 'porteadores' | 'cesta' | 'carretilla'
  | 'bancal'
  | 'trigo' | 'abono' | 'tomate' | 'calabaza' | 'conservas' | 'mercado';
export type Branch = 'gnomos' | 'bancal' | 'cultivos';
/**
 * Poses del gnomo. Nuevas en la iteración 6: sit (sentado en el suelo o en una calabaza), wave (saluda o
 * aplaude), fall (se cae de culo tras un tropiezo), scare (brazos arriba: espanta un cuervo o hace de espantapájaros).
 */
export type Pose = 'idle' | 'walk' | 'carry' | 'harvest' | 'complain' | 'sleep' | 'sit' | 'wave' | 'fall' | 'scare';
export type Rng = () => number;

export type TaskKind =
  | 'harvest' | 'plant' | 'deliver' | 'drop' | 'pickup' | 'wait'
  | 'wander' | 'rest' | 'nap' | 'complain'
  // vida en el huerto (iteración 6)
  | 'sit' | 'cards' | 'chase' | 'chat' | 'greet' | 'fall' | 'shoo' | 'scarecrow' | 'strike' | 'cheer' | 'think';
export interface Task {
  kind: TaskKind;
  plot?: number;
  /** otro gnomo implicado (charla, cartas, saludo) */
  other?: number;
  /** bicho implicado (perseguir una mariposa, espantar un cuervo) */
  critter?: number;
}

export interface Plot {
  id: number;
  col: number;
  row: number;
  crop: CropId;
  /** -1 = vacía; 0..RIPE = fase de crecimiento; ROTTEN = se ha echado a perder */
  stage: number;
  /** segundos acumulados en la fase actual (madura: tiempo que lleva esperando) */
  t: number;
  /** id del gnomo que va a por ella, o null */
  res: number | null;
}

export interface GnomeGroup {
  id: number;
  name: string;
  /** índice en GROUP_PALETTE */
  color: number;
  priority: Priority;
  /** qué siembran sus sembradores; null = lo mismo que había en la parcela */
  seed: CropId | null;
}

/**
 * Rasgo de carácter: uno por gnomo, se ve al mirarlo y cambia un poco cómo trabaja.
 * - perezoso: anda un 15 % más lento y a veces se para a «pensar».
 * - nervioso: anda un 20 % más rápido, pero tropieza más.
 * - gloton: a veces se come una zanahoria que acaba de recoger.
 * - cotilla: se para a charlar con quien se cruza.
 * - dormilon: echa más siestas y más largas.
 * - currante: trabaja un 15 % más rápido y casi nunca se sienta.
 */
export type TraitId = 'perezoso' | 'nervioso' | 'gloton' | 'cotilla' | 'dormilon' | 'currante';

/**
 * Bocadillo sobre la cabeza. Los de intención salen al decidir qué hacer y duran un momento.
 * - crop: va a recoger o plantar `crop` · sack: va a dejar la carga (cesta o granero) · basket: va a por la cesta
 * - zz: siesta · alert: protesta o espera · think: «pensando» (perezoso) · heart: planta con cariño, o le cae bien alguien
 * - angry: le han quitado la parcela, o refunfuña · wave: saluda · chat: charla · cards: juega a las cartas
 * - cheer: aplaude o celebra · yum: se come algo · note: silba (pasea contento)
 */
export type BubbleKind =
  | 'crop' | 'sack' | 'basket' | 'zz' | 'alert' | 'think' | 'heart' | 'angry' | 'wave' | 'chat' | 'cards' | 'cheer'
  | 'yum' | 'note';
export interface Bubble {
  kind: BubbleKind;
  /** solo con kind 'crop' */
  crop?: CropId;
  /** segundos que le quedan; Infinity = hasta que acabe la tarea */
  t: number;
}
/** Lo que ha hecho cada gnomo, para el ranking. */
export interface GnomeStats {
  /** recoger, plantar, dejar en la cesta, sacar de la cesta y entregar en el granero */
  tasks: number;
  harvests: number;
  /** valor de lo que ha cosechado */
  value: number;
  plants: number;
  /** cultivos que ha entregado en el granero */
  delivered: number;
  /** distancia andada, en píxeles del mundo */
  walked: number;
  naps: number;
  complaints: number;
}

export interface Gnome {
  id: number;
  name: string;
  job: JobId;
  /** id del grupo (GnomeGroup.id) */
  group: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  state: 'think' | 'walk' | 'work';
  task: Task | null;
  pose: Pose;
  timer: number;
  /** reloj propio, para desfasar las animaciones */
  t: number;
  flip: boolean;
  carry: CropId[];
  bubble: Bubble | null;
  stats: GnomeStats;
  trait: TraitId;
  /** gnomo legendario: raro, gorro dorado, trabaja mejor */
  legendary: boolean;
}

/**
 * Algo llamativo que acaba de empezar en pantalla. Sirve para medir la vida del huerto (`npm run balance`)
 * y el render puede usarlo para un pequeño efecto.
 */
export type MomentKind =
  | 'saludo' | 'tropiezo' | 'disputa' | 'siesta' | 'queja' | 'sentarse' | 'cartas' | 'mariposa' | 'charla' | 'pensar'
  | 'comer' | 'corona' | 'cuervo' | 'caracol' | 'topo' | 'ranas' | 'sindicato' | 'espantapajaros' | 'legendario';

/** Salida de la simulación para el render; se vacía en cada fotograma. */
export type SimEvent =
  | { type: 'coins'; x: number; y: number; amount: number }
  /** un gnomo acaba de recoger: el cultivo vuela de la planta al saco */
  | { type: 'harvest'; gnome: number; crop: CropId; x: number; y: number }
  /** un gnomo entrega en el granero: se abre la puerta y crece el montón */
  | { type: 'deliver'; gnome: number; count: number }
  | { type: 'crown'; job: JobId; gnome: number }
  | { type: 'moment'; kind: MomentKind; x: number; y: number };

/**
 * Bichos y visitas del huerto.
 * - cuervo: baja a una parcela madura (`plot`) y se la come si nadie lo espanta a tiempo.
 * - caracol: cruza el bancal despacio. Solo decora.
 * - topo: asoma en una parcela vacía (`plot`), deja un montículo un rato y se va.
 * - mariposa: revolotea por la hierba; los ociosos la persiguen.
 * - rana: cae del cielo en la lluvia de ranas y se va saltando.
 */
export type CritterKind = 'cuervo' | 'caracol' | 'topo' | 'mariposa' | 'rana';
export interface Critter {
  id: number;
  kind: CritterKind;
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** reloj propio (animación y duración) */
  t: number;
  /** in: llegando · stay: quieto en su sitio · out: marchándose (se borra al llegar) */
  state: 'in' | 'stay' | 'out';
  flip: boolean;
  plot?: number;
}

/** Suceso raro en curso: solo uno a la vez. */
export interface Happening {
  kind: 'ranas' | 'sindicato' | 'espantapajaros';
  /** segundos que le quedan */
  t: number;
  /** gnomo protagonista (el que se cree espantapájaros) */
  gnome?: number;
}

export interface GameState {
  coins: number;
  totalEarned: number;
  /** nivel de cada nodo del árbol de mejoras */
  tree: Record<NodeId, number>;
  /** todas las parcelas posibles (tamaño máximo); ver isOpen() */
  plots: Plot[];
  /** cosecha esperando a los porteadores */
  basket: CropId[];
  gnomes: Gnome[];
  hired: Record<JobId, number>;
  /** siempre hay al menos uno; los gnomos nuevos van al primero */
  groups: GnomeGroup[];
  nextGroupId: number;
  nextId: number;
  manualHarvests: number;
  /** cultivos que se han echado a perder en esta partida */
  rotted: number;
  /** nivel de la casa de gnomos (0 = la casa inicial) */
  house: number;
  /** id del gnomo con la corona de cada oficio (el que más tareas lleva), o null */
  crowns: Record<JobId, number | null>;
  critters: Critter[];
  nextCritterId: number;
  /** segundos hasta el próximo suceso pequeño */
  nextEventIn: number;
  happening: Happening | null;
  /** más reciente primero */
  log: string[];
  /** salida para el render; no se guarda */
  events: SimEvent[];
}
