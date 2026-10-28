/**
 * Cultivos. Iteración 7: fresa (rápida, valiosa para su tamaño, pero se estropea enseguida) y melón (el más
 * valioso, lento, y con sed: sin regar crece mucho más despacio). Los cultivos con sed se marcan en CropDef.
 */
export type CropId = 'zanahoria' | 'trigo' | 'tomate' | 'calabaza' | 'fresa' | 'melon';
/**
 * Oficios. Iteración 7: regador (gorro azul: riega parcelas para que crezcan más rápido; imprescindible para
 * los cultivos con sed) y guardián (gorro gris: patrulla el bancal y espanta cuervos y topos antes de que hagan daño).
 */
export type JobId = 'recolector' | 'sembrador' | 'porteador' | 'regador' | 'guardian';
export type Priority = 'cercano' | 'valioso' | 'urgente' | `solo_${CropId}`;
/**
 * Nodos del árbol de mejoras. Los cultivos nuevos y la ampliación del bancal también son nodos.
 * Iteración 7: regadores (desbloquea el oficio), regadera (el riego dura más y el regador riega más rápido),
 * guardianes (desbloquea el oficio), silbato (el guardián ve más lejos y anda más rápido), fresa y melon.
 */
export type NodeId =
  | 'botas' | 'cafe' | 'saco' | 'porteadores' | 'cesta' | 'carretilla' | 'guardianes' | 'silbato'
  | 'bancal'
  | 'trigo' | 'abono' | 'tomate' | 'calabaza' | 'conservas' | 'mercado' | 'regadores' | 'regadera' | 'fresa' | 'melon';
export type Branch = 'gnomos' | 'bancal' | 'cultivos';
/**
 * Poses del gnomo. Nuevas en la iteración 6: sit (sentado en el suelo o en una calabaza), wave (saluda o
 * aplaude), fall (se cae de culo tras un tropiezo), scare (brazos arriba: espanta un cuervo o hace de espantapájaros).
 */
export type Pose =
  | 'idle' | 'walk' | 'carry' | 'harvest' | 'complain' | 'sleep' | 'sit' | 'wave' | 'fall' | 'scare'
  // iteración 7: water = inclina la regadera y caen gotas · watch = guardián quieto, mirando con la mano en la frente
  | 'water' | 'watch';
export type Rng = () => number;

export type TaskKind =
  | 'harvest' | 'plant' | 'deliver' | 'drop' | 'pickup' | 'wait'
  | 'wander' | 'rest' | 'nap' | 'complain'
  // vida en el huerto (iteración 6)
  | 'sit' | 'cards' | 'chase' | 'chat' | 'greet' | 'fall' | 'shoo' | 'scarecrow' | 'strike' | 'cheer' | 'think'
  // iteración 7: el regador va a regar `plot` (y vuelve al pozo a llenar la regadera); el guardián patrulla y vigila
  | 'water' | 'refill' | 'patrol' | 'watch';
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
  /** segundos de riego que le quedan (0 = seca). Regada crece más rápido; los cultivos con sed casi no crecen secos. */
  wet: number;
  /** id del regador que va a regarla, o null (aparte de `res`, que es para recoger y sembrar) */
  wres: number | null;
  /** cosecha dorada (G4): madura brillando y vale GOLDEN.mult veces más; se pierde si se echa a perder */
  golden: boolean;
}

/** Rectángulo de parcelas del bancal, con los bordes incluidos (columnas c0..c1, filas r0..r1). */
export interface Zone {
  c0: number;
  r0: number;
  c1: number;
  r1: number;
}

export interface GnomeGroup {
  id: number;
  name: string;
  /** índice en GROUP_PALETTE */
  color: number;
  priority: Priority;
  /** qué siembran sus sembradores; null = lo mismo que había en la parcela */
  seed: CropId | null;
  /** parcelas en las que trabajan recolectores, sembradores y regadores del grupo; null = todo el bancal */
  zone: Zone | null;
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
 * - water: va a regar (gota) · well: va al pozo a llenar la regadera · eye: el guardián ha visto un bicho
 */
export type BubbleKind =
  | 'crop' | 'sack' | 'basket' | 'zz' | 'alert' | 'think' | 'heart' | 'angry' | 'wave' | 'chat' | 'cards' | 'cheer'
  | 'yum' | 'note' | 'water' | 'well' | 'eye';
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
  /** su mejor amigo (G9): id de otro gnomo, o null. Si están en el mismo grupo trabajan algo más rápido. */
  friend: number | null;
}

/**
 * Algo llamativo que acaba de empezar en pantalla. Sirve para medir la vida del huerto (`npm run balance`)
 * y el render puede usarlo para un pequeño efecto.
 */
export type MomentKind =
  | 'saludo' | 'tropiezo' | 'disputa' | 'siesta' | 'queja' | 'sentarse' | 'cartas' | 'mariposa' | 'charla' | 'pensar'
  | 'comer' | 'corona' | 'cuervo' | 'caracol' | 'topo' | 'ranas' | 'sindicato' | 'espantapajaros' | 'legendario'
  // iteración 7: el guardián espanta a un bicho a tiempo
  | 'vigilancia'
  // iteración 10: dos gnomos se hacen amigos
  | 'amistad';

/** Salida de la simulación para el render; se vacía en cada fotograma. */
export type SimEvent =
  | { type: 'coins'; x: number; y: number; amount: number }
  /** un gnomo acaba de recoger: el cultivo vuela de la planta al saco */
  | { type: 'harvest'; gnome: number; crop: CropId; x: number; y: number }
  /** un gnomo entrega en el granero: se abre la puerta y crece el montón */
  | { type: 'deliver'; gnome: number; count: number }
  | { type: 'crown'; job: JobId; gnome: number }
  | { type: 'moment'; kind: MomentKind; x: number; y: number }
  /** un regador acaba de regar una parcela: salpicadura de agua */
  | { type: 'water'; plot: number }
  /** empieza una temporada nueva (llega en los eventos del estado que devuelve endSeason) */
  | { type: 'season'; season: number }
  /** se ha recogido una cosecha dorada (G4): destello y monedas de más */
  | { type: 'golden'; crop: CropId; x: number; y: number; amount: number }
  /** un cultivo sube de maestría (G5) */
  | { type: 'mastery'; crop: CropId; level: number }
  /** cromo nuevo en el álbum (G6); `page` si con él se completa una página */
  | { type: 'sticker'; id: string; page?: string }
  /** el jugador echa una arenga (G7) */
  | { type: 'rally' }
  /** llega un encargo del pueblo o se cumple (G8) */
  | { type: 'order'; done: boolean }
  /** línea del diario que también merece el aviso de arriba: importante, o una gracia de vez en cuando */
  | { type: 'notice'; text: string; kind: NoticeKind };

/** Qué líneas del diario salen también arriba: «diario» solo se queda en el diario. */
export type NoticeKind = 'importante' | 'humor';

/** Encargo del pueblo (G8): alguien quiere tantos cultivos de un tipo antes de que se le acabe la paciencia. */
export interface Order {
  /** quién lo pide (índice en ENCARGOS.clientes) */
  who: number;
  crop: CropId;
  need: number;
  have: number;
  /** segundos que le quedan */
  t: number;
  /** monedas al cumplirlo */
  reward: number;
}

/**
 * Multiplicador de organización (B6): premia una cadena de trabajo que funciona. Se calcula sobre una ventana
 * móvil de los últimos minutos y multiplica lo que se cobra al vender (junto con el mercado).
 * Cada parte va de 0 (mal) a 1 (perfecto):
 * - cosecha: poco de lo maduro se echa a perder o se lo comen los cuervos.
 * - cesta: los recolectores apenas esperan con la cesta llena (sin porteadores cuenta como 1).
 * - siembra: las parcelas apenas se quedan vacías esperando sembrador.
 * - riego: las parcelas con cultivos con sed están regadas mientras crecen (sin cultivos con sed cuenta como 1).
 */
export type OrgPart = 'cosecha' | 'cesta' | 'siembra' | 'riego';
export interface Organization {
  /** multiplicador actual de las ventas: 1 + ORG.max × media de las partes, redondeado a 0,01 */
  mult: number;
  parts: Record<OrgPart, number>;
}

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
  /** se recalcula en cada tick; no se guarda */
  org: Organization;
  /** segundos jugados en esta temporada (solo cuentan con el juego abierto) */
  seasonTime: number;
  /** lo permanente: sobrevive al fin de temporada */
  prestige: Prestige;
  /** id del gnomo con la corona de cada oficio (el que más tareas lleva), o null */
  crowns: Record<JobId, number | null>;
  critters: Critter[];
  nextCritterId: number;
  /** segundos hasta el próximo suceso pequeño */
  nextEventIn: number;
  happening: Happening | null;
  /** cosechas de cada cultivo en esta temporada: dan la maestría (G5) */
  mastery: Record<CropId, number>;
  /** arenga del capataz (G7): segundos que le quedan al efecto y a la recarga */
  rally: { t: number; cd: number };
  /** encargo del pueblo en curso (G8), o null; no se guarda: al cargar llega otro */
  order: Order | null;
  /** segundos hasta el próximo encargo */
  nextOrderIn: number;
  /** más reciente primero */
  log: string[];
  /** salida para el render; no se guarda */
  events: SimEvent[];
}

// ---------- Prestigio (iteración 8) ----------

/**
 * Talentos del árbol dorado: se compran con semillas doradas y duran para siempre.
 * - abonoDorado: los cultivos crecen un poco más rápido (por nivel).
 * - mercadoDorado: todo se vende un poco más caro (por nivel).
 * - herencia: empiezas cada temporada con monedas (por nivel).
 * - experiencia: empiezas cada temporada con gnomos ya contratados gratis (recolectores y sembradores, por nivel).
 * - contrato: contratar sube de precio más despacio (por nivel).
 * - bancalHeredado: empiezas con el bancal ya ampliado (por nivel).
 * - casaHeredada: empiezas con la casa ya ampliada (por nivel).
 * - semillasConocidas: empiezas con cultivos ya desbloqueados (nivel n = los n primeros tras la zanahoria).
 * - veterano: los gnomos coronados al acabar la temporada vuelven en la siguiente con su nombre y rasgo (por nivel, cuántos).
 * - suerte: más probabilidad de gnomo legendario (por nivel).
 */
export type TalentId =
  | 'abonoDorado' | 'mercadoDorado' | 'herencia' | 'experiencia' | 'contrato'
  | 'bancalHeredado' | 'casaHeredada' | 'semillasConocidas' | 'veterano' | 'suerte';

/** Un gnomo que vuelve la temporada siguiente gracias al talento «veterano». */
export interface Veteran {
  name: string;
  job: JobId;
  trait: TraitId;
  legendary: boolean;
  /** cuántas temporadas lleva en el huerto (1 = la primera vez que vuelve) */
  seasons: number;
}

/** Una temporada terminada, para el salón de la fama. */
export interface SeasonRecord {
  season: number;
  /** monedas ganadas en la temporada */
  earned: number;
  /** segundos jugados */
  seconds: number;
  /** semillas doradas que dio */
  seeds: number;
  /** los coronados al acabar: el mejor de cada oficio */
  crowned: { job: JobId; name: string; tasks: number; legendary: boolean }[];
}

export interface Prestige {
  /** temporada en curso (la primera es la 1) */
  season: number;
  /** semillas doradas sin gastar */
  goldenSeeds: number;
  /** nivel de cada talento */
  talents: Record<TalentId, number>;
  /** temporadas terminadas, la más reciente primero */
  history: SeasonRecord[];
  /** gnomos que volverán (o han vuelto) por el talento «veterano» */
  veterans: Veteran[];
  /** monedas ganadas en todas las temporadas */
  lifetimeEarned: number;
  /** cromos del álbum (G6) conseguidos en cualquier temporada, y las páginas ya premiadas («pagina:…») */
  album: string[];
}
