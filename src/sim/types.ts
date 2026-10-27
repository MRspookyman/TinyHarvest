export type CropId = 'zanahoria' | 'trigo' | 'tomate' | 'calabaza';
export type JobId = 'recolector' | 'sembrador' | 'porteador';
export type Priority = 'cercano' | 'valioso' | 'urgente' | `solo_${CropId}`;
/** Nodos del árbol de mejoras. Los cultivos nuevos y la ampliación del bancal también son nodos. */
export type NodeId =
  | 'botas' | 'cafe' | 'saco' | 'porteadores' | 'cesta'
  | 'bancal'
  | 'trigo' | 'abono' | 'tomate' | 'calabaza';
export type Branch = 'gnomos' | 'bancal' | 'cultivos';
export type Pose = 'idle' | 'walk' | 'carry' | 'harvest' | 'complain' | 'sleep';
export type Rng = () => number;

export type TaskKind =
  | 'harvest' | 'plant' | 'deliver' | 'drop' | 'pickup' | 'wait'
  | 'wander' | 'rest' | 'nap' | 'complain';
export interface Task {
  kind: TaskKind;
  plot?: number;
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
  bubble: 'zz' | 'alert' | null;
  stats: GnomeStats;
}

export type SimEvent = { type: 'coins'; x: number; y: number; amount: number };

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
  /** id del gnomo con la corona (el más trabajador), o null */
  crown: number | null;
  /** más reciente primero */
  log: string[];
  /** salida para el render; no se guarda */
  events: SimEvent[];
}
