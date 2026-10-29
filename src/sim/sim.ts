// Simulación pura: sin DOM ni render. Todo lo que pasa en el huerto ocurre aquí.
import {
  APHID, AWAY, BASE_SPEED, BASKET, BUBBLE_TIME, CARRETILLA_PER_LEVEL, CLEAR_TIME, CONSERVAS_PER_LEVEL, COST_GROWTH, CRITTER_SPEED, CROP_IDS, CROPS,
  CROW_EAT, CROW_NOTICE, CROW_REACH, CROWN_MARGIN, DOOR, EVENT_GAP, FIELD, FLOCK, GROUP_NAME_MAX, GROUP_PALETTE, GUARD, HAPPENING_EVERY,
  HAPPENING_TIME,
  HARVEST_TIME, HOUSE, IDLE_AREA, JOB_IDS, JOB_NODE, JOBS, LEGENDARY, LIFE, LOG_MAX, MAX_GNOMES, MAX_GROUPS, MEET_COOLDOWN, MEET_DIST,
  MARKET, MERCADO_PER_LEVEL, MOLE_TIME, ORG, PICKUP_TIME, PLANT_TIME, PORTER_CAPACITY, PRESTIGE, RIPE, ROTTEN, TALENT_EFFECT,
  TALENTS, TRAIT_WALK, TRAIT_WORK, TREE, VALUE_DISTANCE_BIAS, WATER, WELL, WORLD, ZONE_BONUS, GOLDEN, NODE_IDS, MASTERY, ALBUM,
  RALLY, ORDERS, FRIENDS, SEASON_IDS, SEASONS, SKILL, BUBBLES, WORK_EFFECT, WORK_IDS, WORK_MAX, WORKS, type SeasonId,
} from './config';
import { ALBUM_PAGES, pageRewardId, stickerId, type AlbumPage } from './album';
import { createState, makeGnome, randomTrait } from './state';
import { ALBUM_TEXTOS, APELLIDOS, ARBOL, CULTIVOS, ENCARGOS, GRUPOS, LEGENDARIO, LOG, NOMBRES, OBRAS, OFICIOS, TALENTOS } from '../textos';
import type {
  BubbleKind, Critter, CritterKind, CropId, GameState, Gnome, GnomeGroup, Happening, JobId, MomentKind, NodeId, NoticeKind, Plot,
  Pose, Priority, Rng, SeasonRecord, TalentId, Task, TaskKind, Veteran, WorkId, Zone,
} from './types';

// ---------- Árbol de mejoras y sus efectos ----------

export function nodeCost(s: GameState, id: NodeId): number {
  const n = TREE[id];
  return Math.floor(n.base * n.mult ** s.tree[id]);
}

/** El nodo se ve y se puede comprar: su padre ya está comprado. */
export const nodeReachable = (s: GameState, id: NodeId) => {
  const parent = TREE[id].parent;
  return parent === null || s.tree[parent] > 0;
};
export const nodeMaxed = (s: GameState, id: NodeId) => s.tree[id] >= TREE[id].max;

/**
 * Próximo objetivo (G3), siempre a la vista en la barra de arriba: la mejora más barata del árbol que ya se puede
 * comprar; con el árbol completo, la obra sin terminar más barata; y con todo terminado, la siguiente semilla dorada.
 */
export type Goal =
  | { kind: 'node'; id: NodeId; have: number; need: number }
  | { kind: 'work'; id: WorkId; have: number; need: number }
  | { kind: 'seed'; seeds: number; have: number; need: number };
export function nextGoal(s: GameState): Goal {
  let best: NodeId | null = null;
  for (const id of NODE_IDS) {
    if (nodeMaxed(s, id) || !nodeReachable(s, id)) continue;
    if (best === null || nodeCost(s, id) < nodeCost(s, best)) best = id;
  }
  if (best) return { kind: 'node', id: best, have: s.coins, need: nodeCost(s, best) };
  let work: WorkId | null = null;
  for (const id of WORK_IDS) {
    if (s.works[id] >= WORK_MAX) continue;
    if (work === null || workCost(s, id) < workCost(s, work)) work = id;
  }
  if (work) return { kind: 'work', id: work, have: s.coins, need: workCost(s, work) };
  const seeds = seasonSeeds(s) + 1;
  return { kind: 'seed', seeds, have: s.totalEarned, need: seedsCoinsNeeded(seeds) };
}

export function buyNode(s: GameState, id: NodeId): boolean {
  if (nodeMaxed(s, id) || !nodeReachable(s, id)) return false;
  const cost = nodeCost(s, id);
  if (s.coins < cost) return false;
  s.coins -= cost;
  s.tree[id]++;
  if (id === 'bancal') {
    const f = fieldSize(s);
    log(s, LOG.bancal(f.cols, f.rows), 'importante');
  } else if ((CROP_IDS as string[]).includes(id)) {
    log(s, LOG.desbloqueo(CULTIVOS[id as CropId].plural), 'importante');
  } else if (id === 'porteadores') {
    log(s, LOG.porteadores, 'importante');
  } else if (id === 'regadores') {
    log(s, LOG.regadores, 'importante');
  } else if (id === 'guardianes') {
    log(s, LOG.guardianes, 'importante');
  } else {
    log(s, LOG.mejora(ARBOL[id].nombre), 'importante');
  }
  if (treeComplete(s)) log(s, LOG.obrasAbiertas, 'importante');
  return true;
}

// ---------- Obras de fin de temporada ----------

/** todos los nodos del árbol al máximo: se abren las obras */
export const treeComplete = (s: GameState) => NODE_IDS.every(id => nodeMaxed(s, id));
/** coste del siguiente nivel de la obra (solo con nivel < WORK_MAX) */
export const workCost = (s: GameState, id: WorkId) => WORKS[id].costs[s.works[id]];
/** semillas doradas de más al acabar la temporada: una por nivel de obra */
export const workSeeds = (s: GameState) => WORK_IDS.reduce((n, id) => n + s.works[id], 0);

export function buyWork(s: GameState, id: WorkId): boolean {
  if (!treeComplete(s) || s.works[id] >= WORK_MAX) return false;
  const cost = workCost(s, id);
  if (s.coins < cost) return false;
  s.coins -= cost;
  s.works[id]++;
  log(s, LOG.obra(OBRAS[id].nombre, s.works[id]), 'importante');
  return true;
}

export const cropUnlocked = (s: GameState, c: CropId) => c === 'zanahoria' || s.tree[c] > 0;
export const jobUnlocked = (s: GameState, j: JobId) => {
  const node = JOB_NODE[j];
  return !node || s.tree[node] > 0;
};
export const walkSpeed = (s: GameState) => BASE_SPEED * (1 + 0.2 * s.tree.botas);
export const workMult = (s: GameState) => Math.max(0.3, 1 - 0.18 * s.tree.cafe);
/**
 * Ventaja de zona (G1): los recolectores, sembradores y regadores de un grupo con zona «se conocen el terreno»
 * y van más rápido en todo su ciclo (ir, trabajar y volver). Cuanto más pequeña es la zona frente al bancal abierto,
 * más ventaja; una zona de todo el bancal no da nada.
 */
export function turfBonus(s: GameState, g: Gnome): number {
  if (g.job !== 'recolector' && g.job !== 'sembrador' && g.job !== 'regador') return 0;
  const zone = groupOf(s, g).zone;
  if (!zone) return 0;
  const f = fieldSize(s);
  const cols = Math.max(0, Math.min(zone.c1, f.cols - 1) - zone.c0 + 1);
  const rows = Math.max(0, Math.min(zone.r1, f.rows - 1) - zone.r0 + 1);
  return ZONE_BONUS * Math.max(0, 1 - (cols * rows) / (f.cols * f.rows));
}
/** velocidad de un gnomo concreto: la del huerto con su rasgo, si es legendario, en su zona y (el guardián) con silbato */
export const gnomeWalkSpeed = (s: GameState, g: Gnome) =>
  walkSpeed(s) * (TRAIT_WALK[g.trait] ?? 1) * (g.legendary ? LEGENDARY.mult : 1)
  * (g.job === 'guardian' ? 1 + GUARD.silbatoSpeed * s.tree.silbato : 1) * (1 + turfBonus(s, g)) * rallyBoost(s);
/** la especialización acelera las tareas de campo, no los paseos */
export function skillBonus(s: GameState, g: Gnome): number {
  if (g.job !== 'recolector' && g.job !== 'sembrador' && g.job !== 'regador') return 0;
  return Math.min(SKILL.max, SKILL.perMin * groupOf(s, g).skill / 60);
}
/** multiplicador del tiempo de trabajo de un gnomo concreto (menos = más rápido) */
export const gnomeWorkMult = (s: GameState, g: Gnome) =>
  (workMult(s) * (TRAIT_WORK[g.trait] ?? 1)) / (g.legendary ? LEGENDARY.mult : 1) / (1 + turfBonus(s, g) + friendBonus(s, g) + skillBonus(s, g)) / rallyBoost(s);
/** la arenga del capataz (G7) acelera a todos mientras dura */
export const rallyBoost = (s: GameState) => (s.rally.t > 0 ? 1 + RALLY.mult : 1);

/** Arenga del capataz (G7): todos más rápido un rato. Hace falta algún gnomo y que se haya recargado. */
export function rally(s: GameState, rng: Rng): boolean {
  if (s.rally.cd > 0 || !s.gnomes.length) return false;
  s.rally = { t: RALLY.duration, cd: RALLY.cooldown };
  for (const g of s.gnomes) say(g, 'cheer', 1.5);
  s.events.push({ type: 'rally' });
  log(s, pick(rng, LOG.arenga), 'importante');
  return true;
}
export const capacity = (s: GameState) => 1 + s.tree.saco;
export const basketMax = (s: GameState) => BASKET.base + BASKET.perLevel * s.tree.cesta;
/** segundos por fase con el abono (y el abono dorado) y el invernadero, a velocidad normal (ver growRate) */
export const stageTime = (s: GameState, crop: CropId) =>
  (CROPS[crop].grow * 0.85 ** s.tree.abono) / (1 + TALENT_EFFECT.abonoDorado * s.prestige.talents.abonoDorado)
  / (1 + WORK_EFFECT.invernadero * s.works.invernadero) / RIPE;
/** a qué velocidad crece ahora la parcela: más rápido regada, muy despacio si tiene sed y está seca */
export const growRate = (p: Plot) => (p.wet > 0 ? WATER.boost : CROPS[p.crop].thirsty ? WATER.dry : 1);
/** segundos que dura un riego, con la regadera */
export const waterTime = (s: GameState) =>
  WATER.duration * (1 + WATER.regaderaTime * s.tree.regadera) * (1 + WORK_EFFECT.fuente * s.works.fuente);
/** segundos que tarda un regador normal en regar una parcela, con la regadera */
export const waterWork = (s: GameState) => WATER.work * (1 - WATER.regaderaWork * s.tree.regadera);
/** hasta dónde ve el guardián (px del mundo), con el silbato */
export const guardRange = (s: GameState) => GUARD.sight + GUARD.silbatoSight * s.tree.silbato;
export const hasPorters = (s: GameState) => s.gnomes.some(g => g.job === 'porteador');
/** monedas que da un cultivo al venderse, con el mercado, el mercado dorado, su maestría, la saturación y el multiplicador de organización */
export const cropValue = (s: GameState, crop: CropId) =>
  CROPS[crop].value * (1 + MERCADO_PER_LEVEL * s.tree.mercado)
  * (1 + TALENT_EFFECT.mercadoDorado * s.prestige.talents.mercadoDorado)
  * (1 + MASTERY.bonus * masteryLevel(s, crop)) * (crop === favoriteCrop(s) ? 1 + SEASONS.bonus : 1) * s.org.mult
  * marketMult(s, crop);
/** segundos en los que el mercado olvida lo vendido */
export const marketWindow = (s: GameState) => MARKET.window / (1 + WORK_EFFECT.molino * s.works.molino);
/** multiplicador de saturación: baja si un cultivo se lleva más de su cuota de lo vendido últimamente */
export function marketMult(s: GameState, crop: CropId): number {
  let total = 0;
  for (const c of CROP_IDS) total += s.market[c];
  if (total < MARKET.minSample) return 1;
  const free = 1 / Math.min(MARKET.fullMix, CROP_IDS.filter(c => cropUnlocked(s, c)).length);
  const share = s.market[crop] / total;
  return Math.max(MARKET.floor, 1 - MARKET.slope * Math.max(0, share - free));
}
/** apunta una venta en el mercado; llamar después de calcular su valor */
export function noteSale(s: GameState, crop: CropId, n: number) {
  s.market[crop] += n * CROPS[crop].value;
}

/** estación de la temporada en curso (G10): primavera, verano, otoño, invierno y vuelta a empezar */
export const seasonOf = (s: GameState): SeasonId => SEASON_IDS[(s.prestige.season - 1) % SEASON_IDS.length];
/** el cultivo de la estación se vende más caro */
export const favoriteCrop = (s: GameState): CropId => SEASONS.favorite[seasonOf(s)];

// ---------- Maestría (G5) y álbum (G6) ----------

/** nivel de maestría de un cultivo en esta temporada (0 = ninguno) */
export const masteryLevel = (s: GameState, crop: CropId) => MASTERY.steps.filter(n => s.mastery[crop] >= n).length;
/** cosechas que faltan para el siguiente nivel, o null en el máximo */
export const masteryNext = (s: GameState, crop: CropId): number | null => MASTERY.steps[masteryLevel(s, crop)] ?? null;

/** Cuenta una cosecha para la maestría y el encargo; al subir de nivel lo celebra y, desde ALBUM.masteryLevel, da su cromo. */
function countHarvest(s: GameState, crop: CropId) {
  const o = s.order;
  if (o && o.crop === crop && ++o.have >= o.need) {
    s.coins += o.reward;
    s.totalEarned += o.reward;
    s.order = null;
    s.events.push({ type: 'order', done: true });
    log(s, LOG.encargoCumplido(ENCARGOS.clientes[o.who], o.reward), 'importante');
  }
  const before = masteryLevel(s, crop);
  s.mastery[crop]++;
  const level = masteryLevel(s, crop);
  if (level === before) return;
  s.events.push({ type: 'mastery', crop, level });
  log(s, LOG.maestria(CULTIVOS[crop].plural, level, Math.round(MASTERY.bonus * level * 100)), 'importante');
  if (level >= ALBUM.masteryLevel) collect(s, 'maestrias', crop);
}

/**
 * Encargos del pueblo (G8): de vez en cuando alguien pide un cultivo de los que hay sembrados, tantos como el bancal
 * puede dar en el plazo con algo de esfuerzo. Si no se cumple, se va sin más: no se pierde nada.
 */
function updateOrders(s: GameState, dt: number, rng: Rng) {
  const o = s.order;
  if (o) {
    o.t -= dt;
    if (o.t <= 0) {
      s.order = null;
      log(s, LOG.encargoPerdido(ENCARGOS.clientes[o.who]), 'importante');
    }
    return;
  }
  s.nextOrderIn -= dt;
  if (s.nextOrderIn > 0) return;
  s.nextOrderIn = ORDERS.gap.min + rng() * (ORDERS.gap.max - ORDERS.gap.min);
  // lo que está creciendo o maduro en el bancal abierto
  const growing = CROP_IDS.map(crop => ({
    crop, plots: s.plots.filter(p => isOpen(s, p) && p.crop === crop && p.stage >= 0 && p.stage !== ROTTEN).length,
  })).filter(c => c.plots > 0);
  if (!growing.length) return;
  const { crop, plots } = pick(rng, growing);
  // lo que el bancal da en el plazo (con sed y sin regadores crece muy despacio)… y lo que los recolectores pueden
  // llevarse (más algo a mano)
  const dry = CROPS[crop].thirsty && !s.gnomes.some(g => g.job === 'regador');
  const cycle = (stageTime(s, crop) * RIPE) / (dry ? WATER.dry : 1) + PLANT_TIME + HARVEST_TIME + 5;
  const fromPlots = (plots * ORDERS.time) / cycle;
  const pickers = s.gnomes.filter(g => g.job === 'recolector').length;
  const share = plots / growing.reduce((a, c) => a + c.plots, 0);
  const fromPickers = (pickers * capacity(s) * ORDERS.time * share) / ORDERS.trip + ORDERS.byHand;
  const need = Math.round(Math.min(ORDERS.max, Math.max(ORDERS.min, Math.min(fromPlots, fromPickers) * ORDERS.effort)));
  const who = Math.floor(rng() * ENCARGOS.clientes.length);
  s.order = { who, crop, need, have: 0, t: ORDERS.time, reward: Math.round(need * cropValue(s, crop) * ORDERS.reward) };
  s.events.push({ type: 'order', done: false });
  log(s, LOG.encargo(ENCARGOS.clientes[who], need, CULTIVOS[crop].plural), 'importante');
}

/** El jugador dice que no al encargo: se va sin más y el siguiente tarda lo de siempre. */
export function dismissOrder(s: GameState) {
  if (!s.order) return;
  log(s, LOG.encargoRechazado(ENCARGOS.clientes[s.order.who]));
  s.order = null;
}

/** Pega un cromo en el álbum si es nuevo; si completa la página, da sus semillas doradas (una sola vez). */
export function collect(s: GameState, page: AlbumPage, key: string) {
  const album = s.prestige.album;
  const id = stickerId(page, key);
  if (album.includes(id)) return;
  album.push(id);
  const done = ALBUM_PAGES[page].every(k => album.includes(stickerId(page, k)));
  const reward = pageRewardId(page);
  if (done && !album.includes(reward)) {
    album.push(reward);
    s.prestige.goldenSeeds += ALBUM.pageSeeds;
    s.events.push({ type: 'sticker', id, page });
    log(s, LOG.paginaAlbum(ALBUM_TEXTOS.paginas[page].titulo, ALBUM.pageSeeds), 'importante');
  } else {
    s.events.push({ type: 'sticker', id });
    log(s, LOG.cromo(ALBUM_TEXTOS.paginas[page].titulo), 'importante');
  }
}
/** segundos que aguanta madura, con las conservas */
export const keepTime = (s: GameState, crop: CropId) => CROPS[crop].keep * (1 + CONSERVAS_PER_LEVEL * s.tree.conservas);
/** cultivos que se lleva un porteador de la cesta en cada viaje, con la carretilla */
export const porterCapacity = (s: GameState) => PORTER_CAPACITY + CARRETILLA_PER_LEVEL * s.tree.carretilla;

// ---------- Casa de gnomos ----------

/** camas de la casa: sin cama libre no se puede contratar */
export const houseCapacity = (s: GameState) => Math.min(MAX_GNOMES, HOUSE.base + HOUSE.perLevel * s.house);
export const houseCost = (s: GameState) => Math.floor(HOUSE.cost * HOUSE.mult ** s.house);
export const houseMaxed = (s: GameState) => s.house >= HOUSE.max;

export function buyHouse(s: GameState): boolean {
  const cost = houseCost(s);
  if (houseMaxed(s) || s.coins < cost) return false;
  s.coins -= cost;
  s.house++;
  log(s, LOG.casa(houseCapacity(s)), 'importante');
  return true;
}

// ---------- Geometría del bancal ----------

/** Tamaño del bancal para cada nivel de ampliación: columna y fila alternas, más o menos cuadrado. */
const FIELD_STEPS: { cols: number; rows: number }[] = (() => {
  const steps: { cols: number; rows: number }[] = [{ cols: FIELD.startCols, rows: FIELD.startRows }];
  for (let i = 0; i < TREE.bancal.max; i++) {
    const { cols, rows } = steps[steps.length - 1];
    const wantCol = cols < FIELD.maxCols && (rows >= FIELD.maxRows || cols - FIELD.startCols <= rows - FIELD.startRows);
    steps.push(wantCol ? { cols: cols + 1, rows } : { cols, rows: rows + 1 });
  }
  return steps;
})();

export const fieldSize = (s: GameState) => FIELD_STEPS[Math.min(s.tree.bancal, FIELD_STEPS.length - 1)];

export const isOpen = (s: GameState, p: Plot) => {
  const f = fieldSize(s);
  return p.col < f.cols && p.row < f.rows;
};

export function plotOrigin(p: Plot) {
  return { x: FIELD.x + p.col * FIELD.cell, y: FIELD.y + p.row * FIELD.cell };
}

/** Dónde se pone el gnomo para trabajar una parcela: justo delante, en el surco. */
export function plotStand(p: Plot) {
  const o = plotOrigin(p);
  return { x: o.x + 9, y: o.y + 20 };
}

/** Parcela abierta bajo un punto del mundo, o null. */
export function plotAt(s: GameState, x: number, y: number): number | null {
  const f = fieldSize(s);
  const col = Math.floor((x - FIELD.x) / FIELD.cell);
  const row = Math.floor((y - FIELD.y) / FIELD.cell);
  if (col < 0 || row < 0 || col >= f.cols || row >= f.rows) return null;
  return row * FIELD.maxCols + col;
}

// ---------- Contratar ----------

/**
 * Apunta una línea en el diario. Las «importantes» y las de «humor» salen además en el aviso de arriba
 * (la interfaz enseña siempre lo importante y, de vez en cuando, una gracia); el resto solo queda en el diario.
 */
function log(s: GameState, text: string, kind?: NoticeKind) {
  s.log.unshift(text);
  if (s.log.length > LOG_MAX) s.log.length = LOG_MAX;
  if (kind) s.events.push({ type: 'notice', text, kind });
}

/** cuándo salió arriba por última vez cada aviso que se repite (segundos de temporada); interno, no se guarda */
const lastNotice = new WeakMap<GameState, Partial<Record<string, number>>>();

/** Como log, pero el aviso de arriba sale como mucho una vez cada `every` segundos; las demás, solo en el diario. */
function logEvery(s: GameState, key: string, every: number, text: string, kind: NoticeKind) {
  let seen = lastNotice.get(s);
  if (!seen) lastNotice.set(s, (seen = {}));
  const last = seen[key];
  const due = last === undefined || s.seasonTime - last >= every;
  if (due) seen[key] = s.seasonTime;
  log(s, text, due ? kind : undefined);
}

const pick = <T>(rng: Rng, a: readonly T[]): T => a[Math.floor(rng() * a.length)];

function makeName(s: GameState, rng: Rng): string {
  for (let i = 0; i < 30; i++) {
    const n = `${pick(rng, NOMBRES)} ${pick(rng, APELLIDOS)}`;
    if (!s.gnomes.some(g => g.name === n)) return n;
  }
  return `${pick(rng, NOMBRES)} ${s.nextId}`;
}

/** cuánto sube el precio de cada contratación del mismo oficio, con el talento «contrato» */
export const costGrowth = (s: GameState) => COST_GROWTH - TALENT_EFFECT.contrato * s.prestige.talents.contrato;
/** probabilidad de que un gnomo nuevo sea legendario, con el talento «suerte» */
export const legendaryChance = (s: GameState) => LEGENDARY.chance + TALENT_EFFECT.suerte * s.prestige.talents.suerte;

export function hireCost(s: GameState, job: JobId): number {
  return Math.floor(JOBS[job].base * costGrowth(s) ** s.hired[job]);
}

export function hire(s: GameState, job: JobId, rng: Rng): boolean {
  const cost = hireCost(s, job);
  if (!jobUnlocked(s, job) || s.coins < cost || s.gnomes.length >= houseCapacity(s)) return false;
  s.coins -= cost;
  s.hired[job]++;
  const g = addGnome(s, job, rng);
  log(s, LOG.contratado(g.name, OFICIOS[job].nombre), 'humor');
  if (g.legendary) log(s, LOG.legendario(g.name), 'importante');
  return true;
}

/** Un gnomo llega por la puerta del granero. Sin `who` es uno nuevo (nombre, rasgo y quizá legendario, al azar). */
function addGnome(s: GameState, job: JobId, rng: Rng, who?: Pick<Veteran, 'name' | 'trait' | 'legendary'>): Gnome {
  // mismo orden de tiradas que antes de la iteración 8: las partidas con semilla fija salen igual
  const name = who?.name ?? makeName(s, rng);
  const x = DOOR.x + rng() * 8 - 4;
  const trait = who?.trait ?? randomTrait(rng);
  const legendary = who ? who.legendary : rng() < legendaryChance(s);
  const title = !who && legendary ? Math.floor(rng() * LEGENDARIO.titulos.length) : -1;
  const full = title >= 0 ? `${name} ${LEGENDARIO.titulos[title]}` : name;
  const g = makeGnome(s.nextId++, full, job, s.groups[0].id, x, DOOR.y + 2, trait, legendary);
  s.gnomes.push(g);
  if (legendary) moment(s, 'legendario', g.x, g.y);
  collect(s, 'oficios', job);
  collect(s, 'rasgos', trait);
  if (title >= 0) collect(s, 'leyendas', String(title));
  return g;
}

// ---------- Grupos ----------

export const groupOf = (s: GameState, g: Gnome): GnomeGroup => s.groups.find(gr => gr.id === g.group) ?? s.groups[0];

export function createGroup(s: GameState): GnomeGroup | null {
  if (s.groups.length >= MAX_GROUPS) return null;
  const used = new Set(s.groups.map(g => g.name));
  const name = GRUPOS.sugerencias.find(n => !used.has(n)) ?? `Grupo ${s.nextGroupId}`;
  const usedColors = new Set(s.groups.map(g => g.color));
  const color = GROUP_PALETTE.findIndex((_, i) => !usedColors.has(i));
  const group: GnomeGroup = {
    id: s.nextGroupId++, name, color: color === -1 ? s.groups.length % GROUP_PALETTE.length : color, priority: 'cercano', seed: null, zone: null, skill: 0,
  };
  s.groups.push(group);
  log(s, LOG.grupoNuevo(name));
  return group;
}

export function renameGroup(s: GameState, id: number, name: string): boolean {
  const g = s.groups.find(g => g.id === id);
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, GROUP_NAME_MAX);
  if (!g || !clean || clean === g.name) return false;
  log(s, LOG.grupoRenombrado(g.name, clean));
  g.name = clean;
  return true;
}

export function setGroupColor(s: GameState, id: number, color: number) {
  const g = s.groups.find(g => g.id === id);
  if (g && color >= 0 && color < GROUP_PALETTE.length) g.color = color;
}

export function setPriority(s: GameState, id: number, p: Priority) {
  const group = s.groups.find(g => g.id === id);
  if (!group) return;
  group.priority = p;
  // los que iban de camino a una parcela vuelven a decidir con la prioridad nueva
  for (const g of s.gnomes) if (g.group === id && g.state === 'walk' && g.task?.plot !== undefined) releaseTask(s, g);
}

/** Qué siembran los sembradores del grupo; null = lo mismo que había en cada parcela. */
export function setGroupSeed(s: GameState, id: number, seed: CropId | null) {
  const group = s.groups.find(g => g.id === id);
  if (!group || (seed !== null && !cropUnlocked(s, seed))) return;
  if (group.seed === seed) return;
  group.skill = 0;
  group.seed = seed;
}

/** El cultivo que plantará un sembrador en esa parcela. */
const seedFor = (s: GameState, g: Gnome, p: Plot): CropId => groupOf(s, g).seed ?? p.crop;

/** La parcela cae dentro de la zona (sin zona, todo el bancal vale). */
export const inZone = (z: Zone | null, p: Pick<Plot, 'col' | 'row'>) =>
  !z || (p.col >= z.c0 && p.col <= z.c1 && p.row >= z.r0 && p.row <= z.r1);

/**
 * Zona del grupo (A5): dos esquinas cualesquiera del bancal, o null para todo el bancal.
 * Los del grupo que iban hacia una parcela de fuera vuelven a decidir.
 */
export function setGroupZone(s: GameState, id: number, zone: Zone | null) {
  const group = s.groups.find(g => g.id === id);
  if (!group) return;
  let next: Zone | null = null;
  if (zone) {
    const { c0, c1, r0, r1 } = zone;
    if (![c0, c1, r0, r1].every(Number.isInteger)) return;
    next = { c0: Math.min(c0, c1), c1: Math.max(c0, c1), r0: Math.min(r0, r1), r1: Math.max(r0, r1) };
    if (next.c0 < 0 || next.r0 < 0 || next.c1 >= FIELD.maxCols || next.r1 >= FIELD.maxRows) return;
  }
  if (group.zone === null ? next === null : next !== null && group.zone.c0 === next.c0 && group.zone.c1 === next.c1 && group.zone.r0 === next.r0 && group.zone.r1 === next.r1) return;
  group.skill = 0;
  group.zone = next;
  log(s, next ? LOG.zona(group.name, GRUPOS.zonaDesc(next.c0, next.c1, next.r0, next.r1)) : LOG.zonaTodo(group.name));
  for (const g of s.gnomes) {
    if (g.group !== id || g.state !== 'walk' || g.task?.plot === undefined) continue;
    if (!inZone(next, s.plots[g.task.plot])) releaseTask(s, g);
  }
}

/** Borra un grupo; sus gnomos pasan al primer grupo que quede. Siempre queda al menos uno. */
export function deleteGroup(s: GameState, id: number): boolean {
  if (s.groups.length <= 1) return false;
  const idx = s.groups.findIndex(g => g.id === id);
  if (idx === -1) return false;
  const [gone] = s.groups.splice(idx, 1);
  const target = s.groups[0];
  for (const g of s.gnomes) {
    if (g.group !== id) continue;
    g.group = target.id;
    releaseTask(s, g);
  }
  log(s, LOG.grupoBorrado(gone.name, target.name));
  return true;
}

export function moveGnome(s: GameState, gnomeId: number, groupId: number): boolean {
  const g = s.gnomes.find(g => g.id === gnomeId);
  const target = s.groups.find(gr => gr.id === groupId);
  if (!g || !target || g.group === groupId) return false;
  g.group = groupId;
  releaseTask(s, g);
  log(s, LOG.cambioGrupo(g.name, target.name));
  return true;
}

// ---------- Clic en el bancal ----------

/**
 * Espanta los pulgones si los hay (y nada más); si no, recoge si está madura o planta si está vacía o echada a perder
 * (se arranca y se siembra).
 */
export function clickPlot(s: GameState, id: number, crop: CropId): 'harvest' | 'plant' | 'shoo' | null {
  const p = s.plots[id];
  if (!p || !isOpen(s, p)) return null;
  if (aphidOn(s, id)) {
    for (const c of s.critters) {
      if (c.kind !== 'pulgon' || c.plot !== id || c.state === 'out') continue;
      c.state = 'out';
      c.t = 0;
    }
    return 'shoo';
  }
  if (p.stage === RIPE) {
    const golden = p.golden;
    const v = cropValue(s, p.crop) * (golden ? GOLDEN.mult : 1);
    s.coins += v;
    s.totalEarned += v;
    const o = plotOrigin(p);
    const manual = s.manualHarvests++ % 5 === 0;
    countHarvest(s, p.crop);
    noteSale(s, p.crop, 1);
    if (golden) {
      p.golden = false;
      s.events.push({ type: 'golden', crop: p.crop, x: o.x + 9, y: o.y + 6, amount: Math.round(v) });
      log(s, LOG.doradaMano(CULTIVOS[p.crop].uno, Math.round(v)), 'importante');
      collect(s, 'doradas', p.crop);
    } else {
      s.events.push({ type: 'coins', x: o.x + 9, y: o.y + 2, amount: Math.round(v) });
      if (manual) log(s, LOG.manual(CULTIVOS[p.crop].uno), 'humor');
    }
    p.stage = -1;
    p.t = 0;
    p.res = null;
    return 'harvest';
  }
  if ((p.stage === -1 || p.stage === ROTTEN) && cropUnlocked(s, crop)) {
    p.crop = crop;
    p.stage = 0;
    p.t = 0;
    p.res = null;
    p.wet = 0;
    return 'plant';
  }
  return null;
}

// ---------- Simulación ----------

export function tick(s: GameState, dt: number, rng: Rng) {
  const org = orgOf(s);
  const before = s.totalEarned;
  s.seasonTime += dt;
  orgDecay(org, dt);
  const mk = Math.exp(-dt / marketWindow(s));
  for (const c of CROP_IDS) s.market[c] *= mk;
  for (const g of s.groups) if (g.zone && g.seed) g.skill = Math.min(SKILL.max / SKILL.perMin * 60, g.skill + dt);
  for (const p of s.plots) {
    if (!isOpen(s, p)) continue;
    org.open += dt;
    if (p.stage === -1 || p.stage === ROTTEN) {
      org.emptyFor[p.id] += dt;
      if (org.emptyFor[p.id] > ORG.grace) org.idle += dt;
    } else {
      org.emptyFor[p.id] = 0;
    }
  }
  for (const p of s.plots) {
    if (p.stage < 0 || p.stage === ROTTEN) continue;
    if (p.stage === RIPE) {
      p.t += dt;
      if (p.t >= keepTime(s, p.crop)) rot(s, p, rng);
      continue;
    }
    if (CROPS[p.crop].thirsty) {
      org.thirsty += dt;
      if (p.wet > 0) org.watered += dt;
    }
    p.t += dt * growRate(p) * (aphidOn(s, p.id) ? APHID.slow : 1);
    p.wet = Math.max(0, p.wet - dt);
    const st = stageTime(s, p.crop);
    while (p.t >= st && p.stage < RIPE) {
      p.t -= st;
      p.stage++;
    }
    if (p.stage === RIPE) {
      // el riego se gasta creciendo: lo maduro vuelve a estar seco
      p.t = 0;
      p.wet = 0;
      org.ripened++;
      p.golden = rng() < GOLDEN.chance;
    }
  }
  for (const g of s.gnomes) {
    // solo cuenta el rato que trabaja: un recolector ocioso no disimula a otro atascado en la cesta
    const k = g.task?.kind;
    if (g.job !== 'recolector' || (k !== 'harvest' && k !== 'drop' && k !== 'deliver' && k !== 'wait')) continue;
    org.picking += dt;
    if (k === 'wait') org.waiting += dt;
  }
  for (const g of s.gnomes) updateGnome(s, g, dt, rng);
  meetings(s, rng);
  updateCritters(s, dt, rng);
  updateEvents(s, dt, rng);
  updateCrowns(s, rng);
  updateOrders(s, dt, rng);
  s.rally.t = Math.max(0, s.rally.t - dt);
  s.rally.cd = Math.max(0, s.rally.cd - dt);
  updateOrg(s, org);
  // ritmo de monedas/s para las ganancias al volver; un tick sin tiempo no lo toca (evita dividir entre 0)
  if (dt > 0) {
    const k = Math.exp(-dt / AWAY.window);
    s.rate = s.rate * k + ((s.totalEarned - before) / dt) * (1 - k);
  }
}

/**
 * Ganancias al volver tras `seconds` fuera: una parte del ritmo, con tope de tiempo. Solo da monedas, no suma a
 * totalEarned (lo ganado fuera no da semillas doradas). Devuelve las monedas cobradas (0 si no hay nada).
 */
export function applyAway(s: GameState, seconds: number): number {
  if (!(seconds >= AWAY.minSeconds) || s.rate <= 0) return 0;
  const n = Math.floor(s.rate * AWAY.share * Math.min(seconds, AWAY.maxSeconds));
  if (n <= 0) return 0;
  s.coins += n;
  log(s, LOG.vuelta(n));
  return n;
}

function rot(s: GameState, p: Plot, rng: Rng) {
  p.stage = ROTTEN;
  p.golden = false;
  p.t = 0;
  s.rotted++;
  orgOf(s).lost++;
  if (rng() < 0.25) logEvery(s, 'podrido', 60, LOG.podrido(CULTIVOS[p.crop].uno), 'importante');
}

// ---------- Multiplicador de organización ----------

/**
 * Contadores del multiplicador, olvidados con una ventana exponencial de ORG.window s. Internos: no se guardan
 * (al cargar se empieza sin datos, que vale como «todo en orden») ni se pintan; lo que se ve es s.org.
 */
interface OrgCounters {
  /** cosecha: cultivos que han madurado y los que se han perdido (podridos o comidos por el cuervo) */
  ripened: number;
  lost: number;
  /** cesta: segundos de recolector, y de ellos los que ha pasado esperando con la cesta llena */
  picking: number;
  waiting: number;
  /** siembra: segundos de parcela abierta, y de ellos los que ha pasado vacía más de ORG.grace s */
  open: number;
  idle: number;
  /** riego: segundos de cultivo con sed creciendo, y de ellos los que estaba regado */
  thirsty: number;
  watered: number;
  /** lo que lleva vacía cada parcela (no se olvida: es un reloj) */
  emptyFor: number[];
  /** cultivos que se han comido los cuervos en esta sesión (no se olvida; para medir al guardián) */
  eaten: number;
}
const DECAYED = ['ripened', 'lost', 'picking', 'waiting', 'open', 'idle', 'thirsty', 'watered'] as const;
const orgCounters = new WeakMap<GameState, OrgCounters>();

function orgOf(s: GameState): OrgCounters {
  let c = orgCounters.get(s);
  if (!c) {
    c = {
      ripened: 0, lost: 0, picking: 0, waiting: 0, open: 0, idle: 0, thirsty: 0, watered: 0,
      emptyFor: s.plots.map(() => 0), eaten: 0,
    };
    orgCounters.set(s, c);
  }
  return c;
}

function orgDecay(c: OrgCounters, dt: number) {
  const k = Math.exp(-dt / ORG.window);
  for (const key of DECAYED) c[key] *= k;
}

/** sin datos (o con todo olvidado) la parte vale 1: nada ha ido mal */
const share = (good: number, total: number, floor: number) =>
  Math.min(1, Math.max(0, (good + floor) / (total + floor)));

function updateOrg(s: GameState, c: OrgCounters) {
  const parts = s.org.parts;
  parts.cosecha = share(c.ripened - c.lost, c.ripened, ORG.floorCount);
  parts.cesta = share(c.picking - c.waiting, c.picking, ORG.floorTime);
  parts.siembra = share(c.open - c.idle, c.open, ORG.floorTime);
  parts.riego = share(c.watered, c.thirsty, ORG.floorTime);
  // media y peor parte a partes iguales: un cuello de botella se nota aunque el resto vaya bien
  const p = [parts.cosecha, parts.cesta, parts.siembra, parts.riego];
  const score = (1 - ORG.worstWeight) * (p.reduce((a, b) => a + b, 0) / p.length) + ORG.worstWeight * Math.min(...p);
  s.org.mult = Math.round((1 + ORG.max * score) * 100) / 100;
}

/** cultivos que se han comido los cuervos desde que empezó la sesión (no se guarda) */
export const cropsEaten = (s: GameState) => orgOf(s).eaten;

function moment(s: GameState, kind: MomentKind, x: number, y: number) {
  s.events.push({ type: 'moment', kind, x: Math.round(x), y: Math.round(y) });
}

/** bocadillo; t = Infinity lo deja hasta que acabe la tarea */
function say(g: Gnome, kind: BubbleKind, t = BUBBLE_TIME, crop?: CropId) {
  g.bubble = crop ? { kind, crop, t } : { kind, t };
}

/**
 * Bocadillo de intención (a por qué va): es rutina, así que sale solo de vez en cuando (BUBBLES.routine) y nunca con
 * más de BUBBLES.max bocadillos ya en pantalla. No tapa uno que ya esté diciendo algo (un enfado, un saludo).
 */
function intent(s: GameState, g: Gnome, rng: Rng, kind: BubbleKind, crop?: CropId) {
  if (g.bubble || rng() >= BUBBLES.routine) return;
  if (s.gnomes.filter(o => o.bubble).length >= BUBBLES.max) return;
  say(g, kind, BUBBLE_TIME, crop);
}

/** tareas que no se interrumpen para celebrar una corona */
const BUSY: Partial<Record<TaskKind, true>> = { strike: true, scarecrow: true, shoo: true, fall: true, cheer: true };

/**
 * Una corona por oficio para el que más tareas lleva. Cada oficio compite solo con los suyos porque sus
 * tareas duran distinto: un porteador nunca hará tantas como un recolector.
 * Para quitársela al líder hay que sacarle CROWN_MARGIN tareas.
 */
function updateCrowns(s: GameState, rng: Rng) {
  for (const job of Object.keys(s.crowns) as JobId[]) {
    let leader: Gnome | null = null;
    for (const g of s.gnomes) if (g.job === job && (!leader || g.stats.tasks > leader.stats.tasks)) leader = g;
    if (!leader || leader.stats.tasks === 0 || leader.id === s.crowns[job]) continue;
    const holder = s.gnomes.find(g => g.id === s.crowns[job]);
    if (holder && leader.stats.tasks < holder.stats.tasks + CROWN_MARGIN) continue;
    const oficio = OFICIOS[job].nombre.toLowerCase();
    log(s, holder ? LOG.corona(leader.name, holder.name, oficio) : LOG.primeraCorona(leader.name, oficio), 'importante');
    s.crowns[job] = leader.id;
    s.events.push({ type: 'crown', job, gnome: leader.id });
    moment(s, 'corona', leader.x, leader.y);
    // el nuevo rey lo celebra; los de su oficio que lo ven aplauden o refunfuñan
    if (!leader.task || !BUSY[leader.task.kind]) {
      releaseTask(s, leader);
      work(leader, 1.5, 'wave', { kind: 'cheer' });
      say(leader, 'cheer', Infinity);
    }
    for (const o of s.gnomes) {
      if (o === leader || o.job !== job || Math.hypot(o.x - leader.x, o.y - leader.y) > 40) continue;
      say(o, o === holder || rng() < 0.4 ? 'angry' : 'cheer', 1.5);
    }
  }
}

function updateGnome(s: GameState, g: Gnome, dt: number, rng: Rng) {
  g.t += dt;
  if (g.bubble && g.bubble.t !== Infinity) {
    g.bubble.t -= dt;
    if (g.bubble.t <= 0) g.bubble = null;
  }
  if (g.state === 'think') {
    decide(s, g, rng);
  } else if (g.state === 'walk') {
    if (g.task?.kind === 'chase' && !followButterfly(s, g, dt)) return;
    // los nerviosos tropiezan solos de vez en cuando
    if (g.trait === 'nervioso' && rng() < LIFE.trip * dt) return stumble(s, g, rng);
    const dx = g.tx - g.x, dy = g.ty - g.y;
    const d = Math.hypot(dx, dy), step = gnomeWalkSpeed(s, g) * dt;
    if (Math.abs(dx) > 0.3) g.flip = dx < 0;
    if (d <= step) {
      g.x = g.tx;
      g.y = g.ty;
      g.stats.walked += d;
      arrive(s, g, rng);
    } else {
      g.x += (dx / d) * step;
      g.y += (dy / d) * step;
      g.stats.walked += step;
    }
  } else {
    g.timer -= dt;
    if (g.timer <= 0) finish(s, g, rng);
  }
}

function goTo(g: Gnome, x: number, y: number, task: Task) {
  g.tx = x;
  g.ty = y;
  g.task = task;
  g.state = 'walk';
  g.pose = g.carry.length ? 'carry' : 'walk';
}

function work(g: Gnome, dur: number, pose: Pose, task: Task) {
  g.state = 'work';
  g.timer = dur;
  g.pose = pose;
  g.task = task;
}

function think(g: Gnome) {
  g.state = 'think';
  g.task = null;
  g.pose = 'idle';
  // los bocadillos de la tarea se van con ella; los cortos (intención, saludo) acaban solos
  if (g.bubble?.t === Infinity) g.bubble = null;
}

function releaseTask(s: GameState, g: Gnome) {
  if (g.task?.plot !== undefined) {
    const p = s.plots[g.task.plot];
    if (p.res === g.id) p.res = null;
    if (p.wres === g.id) p.wres = null;
  }
  think(g);
}

/**
 * Elige parcela según la prioridad del grupo (menor puntuación gana):
 * - cercano: la más cerca.
 * - valioso: más valor por paseo, valor / (distancia + sesgo).
 * - urgente: de lo maduro que aún da tiempo a salvar, lo que menos margen tiene. Lo que se va a echar
 *   a perder antes de llegar queda al final (por distancia). Para los sembradores, la más cerca.
 * - solo_X: la más cerca de ese cultivo.
 * El regador mira su propia reserva (wres) y, salvo en «valioso», riega antes lo que tiene sed.
 * Solo mira las parcelas de la zona del grupo (A5).
 */
function pickPlot(s: GameState, g: Gnome, filter: (p: Plot) => boolean): Plot | null {
  const group = groupOf(s, g);
  const prio = group.priority;
  const only = prio.startsWith('solo_') ? prio.slice('solo_'.length) : null;
  const speed = gnomeWalkSpeed(s, g);
  const waters = g.job === 'regador';
  let best: Plot | null = null;
  let bestScore = Infinity;
  for (const p of s.plots) {
    if ((waters ? p.wres : p.res) !== null || !inZone(group.zone, p) || !isOpen(s, p) || !filter(p)) continue;
    if (only && p.crop !== only) continue;
    const st = plotStand(p);
    const dist = Math.hypot(st.x - g.x, st.y - g.y);
    let score = dist;
    if (prio === 'valioso') {
      const crop = g.job === 'sembrador' ? seedFor(s, g, p) : p.crop;
      score = -cropValue(s, crop) / (dist + VALUE_DISTANCE_BIAS);
    } else if (waters) {
      if (CROPS[p.crop].thirsty) score -= UNSAVABLE;
    } else if (prio === 'urgente' && p.stage === RIPE) {
      const margin = keepTime(s, p.crop) - p.t - dist / speed - HARVEST_TIME;
      score = margin >= 0 ? margin - UNSAVABLE : dist;
    }
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** desplaza por delante de cualquier distancia: lo salvable en «urgente», lo que tiene sed para el regador */
const UNSAVABLE = 1e6;

/** crece, está seca o casi, y aún le queda crecer lo bastante para que el riego cunda */
const needsWater = (s: GameState, p: Plot) =>
  p.stage >= 0 && p.stage < RIPE && p.wet < WATER.low && (RIPE - p.stage) * stageTime(s, p.crop) - p.t > WATER.low;

/** riegos que le quedan en la regadera a cada regador. Interno: al cargar la partida llegan con la regadera llena. */
const canLeft = new WeakMap<Gnome, number>();

function goRefill(s: GameState, g: Gnome, rng: Rng) {
  goTo(g, WELL.x + WELL.w / 2, WELL.y + WELL.h + 2, { kind: 'refill' });
  intent(s, g, rng, 'well');
}

/** el guardián da una vuelta: a un punto al azar por fuera del bancal abierto, o a vigilar al pie de su torre */
function patrol(s: GameState, g: Gnome, rng: Rng) {
  if (rng() < 0.15) return goTo(g, GUARD.post.x + rng() * 6 - 3, GUARD.post.y, { kind: 'watch' });
  const { cols, rows } = fieldSize(s);
  const x0 = FIELD.x - GUARD.margin, x1 = FIELD.x + cols * FIELD.cell + GUARD.margin;
  const y0 = FIELD.y - GUARD.margin, y1 = FIELD.y + rows * FIELD.cell + GUARD.margin;
  const w = x1 - x0, h = y1 - y0;
  // un punto al azar del perímetro
  let d = rng() * 2 * (w + h);
  let x: number, y: number;
  if (d < w) [x, y] = [x0 + d, y0];
  else if ((d -= w) < h) [x, y] = [x1, y0 + d];
  else if ((d -= h) < w) [x, y] = [x1 - d, y1];
  else [x, y] = [x0, y1 - (d - w)];
  goTo(g, x, y, { kind: 'patrol' });
}

/** el topo está en esa parcela: no se puede sembrar hasta que se vaya */
export const moleOn = (s: GameState, plot: number) =>
  s.critters.some(c => c.kind === 'topo' && c.plot === plot && c.state !== 'out');
/** hay pulgones en esa parcela: crece a medias hasta que se van */
export const aphidOn = (s: GameState, plot: number) =>
  s.critters.some(c => c.kind === 'pulgon' && c.plot === plot && c.state !== 'out');

function goDeliver(s: GameState, g: Gnome, rng: Rng) {
  if (g.job === 'recolector' && hasPorters(s)) goTo(g, BASKET.x + rng() * 6 - 3, BASKET.y, { kind: 'drop' });
  else goTo(g, DOOR.x + rng() * 8 - 4, DOOR.y, { kind: 'deliver' });
  intent(s, g, rng, 'sack');
}

function decide(s: GameState, g: Gnome, rng: Rng) {
  // el perezoso se para a pensar entre tarea y tarea
  if (g.trait === 'perezoso' && rng() < LIFE.lazyThink) {
    work(g, 1.5 + rng(), 'idle', { kind: 'think' });
    say(g, 'think', Infinity);
    moment(s, 'pensar', g.x, g.y);
    if (rng() < 0.15) log(s, LOG.pensar(g.name), 'humor');
    return;
  }
  if (g.job === 'recolector') {
    if (g.carry.length < capacity(s)) {
      const p = pickPlot(s, g, p => p.stage === RIPE);
      if (p) {
        p.res = g.id;
        const st = plotStand(p);
        goTo(g, st.x, st.y, { kind: 'harvest', plot: p.id });
        intent(s, g, rng, 'crop', p.crop);
        return;
      }
    }
    if (g.carry.length) return goDeliver(s, g, rng);
  } else if (g.job === 'sembrador') {
    const p = pickPlot(s, g, p => (p.stage === -1 || p.stage === ROTTEN) && cropUnlocked(s, seedFor(s, g, p)) && !moleOn(s, p.id));
    if (p) {
      p.res = g.id;
      const st = plotStand(p);
      goTo(g, st.x, st.y, { kind: 'plant', plot: p.id });
      intent(s, g, rng, 'crop', seedFor(s, g, p));
      return;
    }
  } else if (g.job === 'regador') {
    const left = canLeft.get(g) ?? WATER.can;
    // con la fuente a nivel máximo la regadera no se vacía y el regador no vuelve al pozo
    const endless = s.works.fuente >= WORK_MAX;
    if (!endless && left <= 0) return goRefill(s, g, rng);
    const p = pickPlot(s, g, p => needsWater(s, p));
    if (p) {
      p.wres = g.id;
      const st = plotStand(p);
      goTo(g, st.x, st.y, { kind: 'water', plot: p.id });
      intent(s, g, rng, 'water');
      return;
    }
    // sin nada que regar, aprovecha para llenar la regadera
    if (!endless && left < WATER.can) return goRefill(s, g, rng);
  } else if (g.job === 'guardian') {
    return patrol(s, g, rng);
  } else {
    if (g.carry.length) return goDeliver(s, g, rng);
    // cada porteador que ya va a la cesta se lleva su carga; si no queda nada para este, no va
    const claimed = s.gnomes.filter(o => o !== g && o.job === 'porteador' && o.task?.kind === 'pickup').length * porterCapacity(s);
    if (s.basket.length > claimed) {
      goTo(g, BASKET.x + rng() * 6 - 3, BASKET.y + 2, { kind: 'pickup' });
      intent(s, g, rng, 'basket');
      return;
    }
  }
  idle(s, g, rng);
}

// ---------- Ratos libres ----------

const idleSpot = (rng: Rng) => ({
  x: IDLE_AREA.x0 + rng() * (IDLE_AREA.x1 - IDLE_AREA.x0),
  y: IDLE_AREA.y0 + rng() * (IDLE_AREA.y1 - IDLE_AREA.y0),
});

/** otro ocioso cerca (paseando o descansando en la hierba) con quien jugar a las cartas o charlar */
function idlePartner(s: GameState, g: Gnome): Gnome | null {
  let best: Gnome | null = null;
  let bestD = 40;
  for (const o of s.gnomes) {
    if (o === g || (o.task?.kind !== 'rest' && o.task?.kind !== 'wander')) continue;
    // el descanso tras entregar en el granero no cuenta: solo los de la hierba
    if (o.x < IDLE_AREA.x0 - 6 || o.x > IDLE_AREA.x1 + 6 || o.y < IDLE_AREA.y0 - 6 || o.y > IDLE_AREA.y1 + 6) continue;
    const d = Math.hypot(o.x - g.x, o.y - g.y);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function idle(s: GameState, g: Gnome, rng: Rng) {
  const napChance = g.trait === 'dormilon' ? LIFE.napDormilon : g.trait === 'currante' ? LIFE.napCurrante : LIFE.nap;
  if (rng() < napChance) {
    if (rng() < 0.5) log(s, `${g.name} ${pick(rng, LOG.siesta)}`, 'humor');
    say(g, 'zz', Infinity);
    g.stats.naps++;
    const long = g.trait === 'dormilon';
    work(g, (long ? 6 : 3) + rng() * (long ? 3 : 2), 'sleep', { kind: 'nap' });
    moment(s, 'siesta', g.x, g.y);
    return;
  }
  if (rng() < (g.trait === 'currante' ? LIFE.sitCurrante : LIFE.sit)) return goSit(s, g, rng);
  if (rng() < (g.trait === 'cotilla' ? LIFE.socialCotilla : LIFE.social)) {
    const o = idlePartner(s, g);
    if (o) return invite(g, o, g.trait === 'cotilla' || rng() < 0.3 ? 'chat' : 'cards');
  }
  if (rng() < LIFE.chase) return chaseButterfly(s, g, rng);
  const spot = idleSpot(rng);
  goTo(g, spot.x, spot.y, { kind: 'wander' });
  // a veces pasea silbando
  if (rng() < 0.15) say(g, 'note', 2);
}

/** se sienta en la hierba, o junto a una calabaza madura si hay alguna */
function goSit(s: GameState, g: Gnome, rng: Rng) {
  const pumpkins = s.plots.filter(p => p.stage === RIPE && p.crop === 'calabaza' && isOpen(s, p));
  let spot = idleSpot(rng);
  if (pumpkins.length && rng() < 0.5) {
    const o = plotOrigin(pick(rng, pumpkins));
    spot = { x: o.x + 15, y: o.y + 15 };
  }
  goTo(g, spot.x, spot.y, { kind: 'sit' });
}

/** el otro se queda esperando; empiezan cuando llega este (ver arrive) */
function invite(g: Gnome, o: Gnome, kind: 'cards' | 'chat') {
  work(o, 10, kind === 'cards' ? 'sit' : 'idle', { kind, other: g.id });
  const x = o.x - 8 >= IDLE_AREA.x0 - 6 ? o.x - 8 : o.x + 8;
  goTo(g, x, o.y, { kind, other: o.id });
}

function startTogether(s: GameState, a: Gnome, b: Gnome, kind: 'cards' | 'chat', rng: Rng) {
  const dur = kind === 'cards' ? 5 + rng() * 3 : 2 + rng() * 1.5;
  const pose = kind === 'cards' ? 'sit' : 'idle';
  work(a, dur, pose, { kind, other: b.id });
  work(b, dur, pose, { kind, other: a.id });
  a.flip = b.x < a.x;
  b.flip = a.x < b.x;
  say(a, kind, Infinity);
  say(b, kind, Infinity);
  moment(s, kind === 'cards' ? 'cartas' : 'charla', (a.x + b.x) / 2, (a.y + b.y) / 2);
  if (rng() < 0.25) log(s, (kind === 'cards' ? LOG.cartas : LOG.charla)(a.name, b.name), 'humor');
  befriend(s, a, b, kind === 'cards' ? FRIENDS.cards : FRIENDS.chat);
}

function chaseButterfly(s: GameState, g: Gnome, rng: Rng) {
  let c = s.critters.find(c => c.kind === 'mariposa' && c.state !== 'out');
  if (!c) {
    const spot = idleSpot(rng);
    c = spawn(s, 'mariposa', spot.x, spot.y - 12, spot.x, spot.y - 12, 'stay');
  }
  g.timer = 3 + rng() * 2;
  goTo(g, c.x, c.y + 10, { kind: 'chase', critter: c.id });
  moment(s, 'mariposa', g.x, g.y);
  if (rng() < 0.2) log(s, LOG.mariposa(g.name), 'humor');
}

/** persigue la mariposa mientras le dure el capricho (g.timer); false si lo deja */
function followButterfly(s: GameState, g: Gnome, dt: number): boolean {
  g.timer -= dt;
  const c = s.critters.find(c => c.id === g.task?.critter);
  if (!c || c.state === 'out' || g.timer <= 0) {
    think(g);
    return false;
  }
  // la mariposa vuela por encima: el gnomo va debajo
  g.tx = c.x;
  g.ty = c.y + 10;
  return true;
}

function stumble(s: GameState, g: Gnome, rng: Rng) {
  releaseTask(s, g);
  work(g, 1, 'fall', { kind: 'fall' });
  moment(s, 'tropiezo', g.x, g.y);
  if (rng() < 0.25) log(s, LOG.tropiezo(g.name), 'humor');
}

// ---------- Encuentros ----------

/** cuándo puede volver a reaccionar cada gnomo (en su reloj g.t). Interno: no se guarda ni se pinta. */
const meetReady = new WeakMap<Gnome, number>();
/** caminos que no se paran por un encuentro */
const NO_MEET: Partial<Record<TaskKind, true>> = { shoo: true, chase: true, scarecrow: true, cards: true, chat: true };

const canMeet = (g: Gnome) =>
  g.state === 'walk' && !!g.task && !NO_MEET[g.task.kind] && (meetReady.get(g) ?? 0) <= g.t;

/** dos gnomos que se cruzan andando: se saludan, se paran a charlar (cotillas) o se tropiezan */
function meetings(s: GameState, rng: Rng) {
  const n = s.gnomes.length;
  for (let i = 0; i < n; i++) {
    const a = s.gnomes[i];
    if (!canMeet(a)) continue;
    for (let j = i + 1; j < n; j++) {
      const b = s.gnomes[j];
      if (!canMeet(b) || Math.abs(a.x - b.x) > MEET_DIST || Math.abs(a.y - b.y) > MEET_DIST) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > MEET_DIST) continue;
      meetReady.set(a, a.t + MEET_COOLDOWN);
      meetReady.set(b, b.t + MEET_COOLDOWN);
      react(s, a, b, rng);
      break;
    }
  }
}

function react(s: GameState, a: Gnome, b: Gnome, rng: Rng) {
  const nervous = a.trait === 'nervioso' || b.trait === 'nervioso';
  if (rng() < (nervous ? LIFE.bumpNervioso : LIFE.bump)) {
    // se cae el nervioso; si lo son los dos (o ninguno), a suertes
    const faller = a.trait === 'nervioso' && b.trait !== 'nervioso' ? a
      : b.trait === 'nervioso' && a.trait !== 'nervioso' ? b : rng() < 0.5 ? a : b;
    stumble(s, faller, rng);
    say(faller === a ? b : a, 'angry');
    return;
  }
  if (a.trait === 'cotilla' || b.trait === 'cotilla') {
    releaseTask(s, a);
    releaseTask(s, b);
    return startTogether(s, a, b, 'chat', rng);
  }
  if (rng() >= LIFE.greet) return;
  const friends = a.friend === b.id;
  for (const g of [a, b]) {
    // dos amigos se saludan con corazones
    say(g, friends ? 'heart' : 'wave', 1.5);
    // los que pasean se paran a saludar; los que trabajan saludan sin parar
    if (g.task?.kind === 'wander') work(g, 0.8, 'wave', { kind: 'greet', other: g === a ? b.id : a.id });
  }
  moment(s, 'saludo', (a.x + b.x) / 2, (a.y + b.y) / 2);
  befriend(s, a, b, FRIENDS.greet);
}

/** afinidad entre cada par de gnomos (G9); se olvida al cargar, las amistades no */
const bonds = new WeakMap<GameState, Map<string, number>>();

/** Suma afinidad; al llegar a FRIENDS.need, si ninguno tiene ya amigo, se hacen amigos para siempre. */
function befriend(s: GameState, a: Gnome, b: Gnome, points: number) {
  if (a.friend !== null || b.friend !== null) return;
  let map = bonds.get(s);
  if (!map) bonds.set(s, (map = new Map()));
  const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
  const v = (map.get(key) ?? 0) + points;
  map.set(key, v);
  if (v < FRIENDS.need) return;
  a.friend = b.id;
  b.friend = a.id;
  map.delete(key);
  moment(s, 'amistad', (a.x + b.x) / 2, (a.y + b.y) / 2);
  log(s, LOG.amistad(a.name, b.name), 'importante');
}

/** dos amigos del mismo grupo trabajan algo más rápido (G9) */
export function friendBonus(s: GameState, g: Gnome): number {
  if (g.friend === null) return 0;
  const f = s.gnomes.find(o => o.id === g.friend);
  return f && f.group === g.group ? FRIENDS.bonus : 0;
}

// ---------- Llegar y acabar ----------

/** llega a su parcela y ya no le vale: alguien se le ha adelantado */
function dispute(s: GameState, g: Gnome, rng: Rng) {
  releaseTask(s, g);
  work(g, 1, 'idle', { kind: 'rest' });
  say(g, 'angry', 1.5);
  moment(s, 'disputa', g.x, g.y);
  if (rng() < 0.2) log(s, LOG.disputa(g.name), 'humor');
}

function arrive(s: GameState, g: Gnome, rng: Rng) {
  const task = g.task;
  if (!task) return think(g);
  const p = task.plot !== undefined ? s.plots[task.plot] : null;

  if (task.kind === 'harvest' && p) {
    if (p.stage !== RIPE) return dispute(s, g, rng);
    work(g, HARVEST_TIME * gnomeWorkMult(s, g), 'harvest', task);
  } else if (task.kind === 'plant' && p) {
    if (p.stage !== -1 && p.stage !== ROTTEN) return dispute(s, g, rng);
    if (moleOn(s, p.id)) {
      // el topo ha salido justo ahí: refunfuña y busca otra
      releaseTask(s, g);
      say(g, 'angry');
      return;
    }
    work(g, (PLANT_TIME + (p.stage === ROTTEN ? CLEAR_TIME : 0)) * gnomeWorkMult(s, g), 'harvest', task);
  } else if (task.kind === 'deliver') {
    const amount = g.carry.reduce((a, c) => a + cropValue(s, c), 0);
    // el valor se calcula antes de apuntar la venta: la saturación cuenta desde la siguiente entrega
    for (const c of g.carry) noteSale(s, c, 1);
    s.coins += amount;
    s.totalEarned += amount;
    s.events.push({ type: 'coins', x: DOOR.x, y: DOOR.y - 20, amount: Math.round(amount) });
    s.events.push({ type: 'deliver', gnome: g.id, count: g.carry.length });
    if (rng() < 0.2) {
      const que = g.carry.length === 1 ? CULTIVOS[g.carry[0]].uno : LOG.variosCultivos(g.carry.length);
      log(s, LOG.entrega(g.name, que, Math.round(amount)));
    }
    g.stats.delivered += g.carry.length;
    g.stats.tasks++;
    g.carry = [];
    work(g, 0.3, 'idle', { kind: 'rest' });
  } else if (task.kind === 'drop') {
    const room = basketMax(s) - s.basket.length;
    s.basket.push(...g.carry.splice(0, Math.max(0, room)));
    if (g.carry.length) {
      // cesta llena: el cuello de botella se ve con el gnomo esperando con el saco
      if (rng() < 0.15) logEvery(s, 'cesta', 60, LOG.cestaLlena(g.name), 'importante');
      say(g, 'alert', Infinity);
      g.stats.complaints++;
      work(g, 1.2, 'complain', { kind: 'wait' });
    } else {
      g.stats.tasks++;
      work(g, 0.3, 'idle', { kind: 'rest' });
    }
  } else if (task.kind === 'pickup') {
    if (!s.basket.length) return think(g);
    work(g, PICKUP_TIME * gnomeWorkMult(s, g), 'harvest', task);
  } else if (task.kind === 'water' && p) {
    // ya ha madurado o la ha regado el jugador… (no es una disputa: busca otra sin enfadarse)
    if (!needsWater(s, p)) return releaseTask(s, g);
    work(g, waterWork(s) * gnomeWorkMult(s, g), 'water', task);
  } else if (task.kind === 'refill') {
    work(g, WATER.refill * gnomeWorkMult(s, g), 'harvest', task);
  } else if (task.kind === 'patrol') {
    if (rng() < GUARD.watch) work(g, 2 + rng() * 3, 'watch', { kind: 'watch' });
    else think(g);
  } else if (task.kind === 'watch') {
    work(g, 4 + rng() * 4, 'watch', task);
  } else if (task.kind === 'wander') {
    work(g, 0.6 + rng(), 'idle', { kind: 'rest' });
  } else if (task.kind === 'sit') {
    work(g, 4 + rng() * 3, 'sit', task);
    moment(s, 'sentarse', g.x, g.y);
    if (rng() < 0.15) log(s, LOG.sentarse(g.name), 'humor');
  } else if (task.kind === 'cards' || task.kind === 'chat') {
    const o = s.gnomes.find(o => o.id === task.other);
    if (!o || o.task?.kind !== task.kind || o.task.other !== g.id) return think(g);
    startTogether(s, g, o, task.kind, rng);
  } else if (task.kind === 'shoo') {
    const c = s.critters.find(c => c.id === task.critter);
    if (!c || c.state !== 'stay') return think(g);
    work(g, 1, 'scare', task);
    if (c.kind === 'topo' || c.kind === 'pulgon') {
      // el topo se mete en su agujero antes de tiempo; los pulgones se dispersan
      c.state = 'out';
      c.t = 0;
      if (c.kind === 'topo' && rng() < 0.6) log(s, LOG.topoGuardian(g.name), 'humor');
    } else {
      flyAway(c);
      if (rng() < 0.6) log(s, g.job === 'guardian' ? LOG.cuervoGuardian(g.name) : LOG.cuervoFuera(g.name), 'humor');
    }
  } else if (task.kind === 'scarecrow') {
    work(g, HAPPENING_TIME.espantapajaros, 'scare', task);
  } else if (task.kind !== 'chase') {
    // (si ha alcanzado la mariposa sigue detrás: followButterfly le cambia el destino)
    think(g);
  }
}

function finish(s: GameState, g: Gnome, rng: Rng) {
  const task = g.task;
  const p = task?.plot !== undefined ? s.plots[task.plot] : null;

  if (task?.kind === 'harvest' && p) {
    p.res = null;
    // el jugador puede haberla recogido mientras el gnomo estaba agachado
    if (p.stage !== RIPE) return think(g);
    const crop = p.crop;
    const golden = p.golden;
    p.stage = -1;
    p.t = 0;
    p.golden = false;
    g.stats.harvests++;
    g.stats.tasks++;
    const o = plotOrigin(p);
    s.events.push({ type: 'harvest', gnome: g.id, crop, x: o.x + 9, y: o.y + 9 });
    countHarvest(s, crop);
    if (golden) {
      // lo dorado se cobra en el acto: lo que vale de más; el cultivo normal sigue al saco
      const extra = cropValue(s, crop) * (GOLDEN.mult - 1);
      s.coins += extra;
      s.totalEarned += extra;
      g.stats.value += extra;
      s.events.push({ type: 'golden', crop, x: o.x + 9, y: o.y + 6, amount: Math.round(extra) });
      say(g, 'heart', 1.5);
      log(s, LOG.dorada(g.name, CULTIVOS[crop].uno, Math.round(extra)), 'importante');
      collect(s, 'doradas', crop);
    } else if (g.trait === 'gloton' && crop === 'zanahoria' && rng() < LIFE.glutton) {
      // el glotón se come alguna zanahoria recién recogida (las doradas, no: se las queda mirando)
      say(g, 'yum', Infinity);
      moment(s, 'comer', g.x, g.y);
      if (rng() < 0.4) log(s, LOG.comer(g.name), 'humor');
      work(g, 1.2, 'idle', { kind: 'rest' });
      return;
    }
    g.carry.push(crop);
    g.stats.value += cropValue(s, crop);
    if (CROPS[crop].value >= 12 && rng() < 0.15) {
      log(s, LOG.protesta(g.name), 'humor');
      say(g, 'alert', Infinity);
      g.stats.complaints++;
      work(g, 1.2, 'complain', { kind: 'complain' });
      moment(s, 'queja', g.x, g.y);
      return;
    }
  } else if (task?.kind === 'plant' && p) {
    p.res = null;
    if (p.stage === -1 || p.stage === ROTTEN) {
      if (p.stage === ROTTEN && rng() < 0.2) log(s, LOG.arrancar(g.name), 'humor');
      else if (rng() < 0.08) log(s, `${g.name} ${pick(rng, LOG.plantar)}`, 'humor');
      p.crop = seedFor(s, g, p);
      p.stage = 0;
      p.t = 0;
      p.wet = 0;
      g.stats.plants++;
      g.stats.tasks++;
    }
  } else if (task?.kind === 'water' && p) {
    if (p.wres === g.id) p.wres = null;
    if (p.stage >= 0 && p.stage < RIPE) {
      p.wet = waterTime(s);
      if (s.works.fuente < WORK_MAX) canLeft.set(g, (canLeft.get(g) ?? WATER.can) - 1);
      g.stats.tasks++;
      s.events.push({ type: 'water', plot: p.id });
      if (rng() < 0.04) log(s, `${g.name} ${pick(rng, LOG.regar)}`, 'humor');
    }
  } else if (task?.kind === 'refill') {
    canLeft.set(g, WATER.can);
  } else if (task?.kind === 'pickup') {
    const before = g.carry.length;
    g.carry.push(...s.basket.splice(0, porterCapacity(s)));
    if (g.carry.length > before) g.stats.tasks++;
  } else if (task?.kind === 'wait') {
    // vuelve a intentar dejar lo que lleva
    g.bubble = null;
    return goDeliver(s, g, rng);
  } else if (task?.kind === 'scarecrow' && s.happening?.kind === 'espantapajaros') {
    s.happening = null;
  }
  think(g);
}

// ---------- Bichos ----------

function spawn(
  s: GameState, kind: CritterKind, x: number, y: number, tx: number, ty: number, state: Critter['state'], plot?: number,
): Critter {
  const c: Critter = { id: s.nextCritterId++, kind, x, y, tx, ty, t: 0, state, flip: tx < x };
  if (plot !== undefined) c.plot = plot;
  s.critters.push(c);
  return c;
}

/** se va volando hacia arriba, fuera del mundo */
function flyAway(c: Critter) {
  c.state = 'out';
  c.t = 0;
  c.tx = c.x + (c.x < WORLD.w / 2 ? -80 : 80);
  c.ty = -20;
}

/** donde se posa algo en medio de la parcela */
function plotCentre(p: Plot) {
  const o = plotOrigin(p);
  return { x: o.x + 9, y: o.y + 12 };
}

/** último tramo de APHID.spread s en que cada pulgón ha intentado saltar a una vecina (interno, como canLeft) */
const aphidStep = new WeakMap<Critter, number>();
/** cuervos que han bajado en bandada: el aviso ya se dio al empezar (interno: los bichos no se guardan) */
const flockCrows = new WeakSet<Critter>();

/** parcela abierta con una planta creciendo (aún no madura) y sin bicho: donde se pueden poner pulgones */
const aphidTarget = (s: GameState, p: Plot) =>
  isOpen(s, p) && p.stage >= 0 && p.stage < RIPE && !s.critters.some(c => c.plot === p.id);

const liveAphids = (s: GameState) => s.critters.filter(c => c.kind === 'pulgon' && c.state !== 'out').length;

function updateAphid(s: GameState, c: Critter, rng: Rng) {
  if (c.state === 'in') {
    if (c.t >= 0.5) c.state = 'stay';
    return;
  }
  if (c.state !== 'stay') return;
  const p = c.plot !== undefined ? s.plots[c.plot] : undefined;
  // la planta ya ha madurado (o la han arrancado) o se han cansado: se van
  if (!p || p.stage < 0 || p.stage >= RIPE || c.t >= 0.5 + APHID.life) {
    c.state = 'out';
    c.t = 0;
    return;
  }
  const step = Math.floor(c.t / APHID.spread);
  if (step > (aphidStep.get(c) ?? 0)) {
    aphidStep.set(c, step);
    if (liveAphids(s) < APHID.max) {
      const next = s.plots.filter(q => Math.abs(q.col - p.col) + Math.abs(q.row - p.row) === 1 && aphidTarget(s, q));
      if (next.length) {
        const q = pick(rng, next);
        const at = plotCentre(q);
        spawn(s, 'pulgon', at.x, at.y, at.x, at.y, 'in', q.id);
      }
    }
  }
  // como el topo: solo los espanta el guardián (o el jugador con un clic)
  if (!shooed(s, c)) callGuard(s, c, plotStand(p));
}

function updateCritters(s: GameState, dt: number, rng: Rng) {
  for (const c of s.critters) {
    c.t += dt;
    const dx = c.tx - c.x, dy = c.ty - c.y;
    const d = Math.hypot(dx, dy), step = CRITTER_SPEED[c.kind] * dt;
    const arrived = d <= step;
    if (arrived) {
      c.x = c.tx;
      c.y = c.ty;
    } else {
      c.x += (dx / d) * step;
      c.y += (dy / d) * step;
      if (Math.abs(dx) > 0.3) c.flip = dx < 0;
    }
    if (c.kind === 'cuervo') updateCrow(s, c, arrived);
    else if (c.kind === 'pulgon') updateAphid(s, c, rng);
    else if (c.kind === 'topo') {
      // asoma, se queda un rato y se vuelve a meter (medio segundo para cada animación)
      if (c.state === 'in' && c.t >= 0.5) c.state = 'stay';
      else if (c.state === 'stay' && c.t >= 0.5 + MOLE_TIME) {
        c.state = 'out';
        c.t = 0;
        log(s, LOG.topoFuera);
      } else if (c.state === 'stay' && c.plot !== undefined && !shooed(s, c)) {
        // los topos solo los espanta el guardián; los demás no saben qué hacer con ellos
        callGuard(s, c, plotStand(s.plots[c.plot]));
      }
    } else if (c.kind === 'mariposa') {
      if (c.state === 'stay' && c.t >= 20) {
        c.state = 'out';
        c.tx = c.x + 40;
        c.ty = -20;
      } else if (c.state === 'stay' && arrived) {
        // revolotea de un sitio a otro de la hierba, sin rng: un salto pseudoaleatorio a partir de donde está
        c.tx = IDLE_AREA.x0 + ((c.x * 7 + c.t * 13) % (IDLE_AREA.x1 - IDLE_AREA.x0));
        c.ty = IDLE_AREA.y0 - 12 + ((c.y * 5 + c.t * 11) % (IDLE_AREA.y1 - IDLE_AREA.y0));
      }
    } else if (c.kind === 'rana') {
      if (c.state === 'in' && arrived) {
        c.state = 'stay';
        c.t = 0;
      } else if (c.state === 'stay' && c.t >= 0.4 + (c.id % 5) * 0.4) {
        // se va saltando hacia el borde más cercano
        c.state = 'out';
        c.tx = c.x < WORLD.w / 2 ? -12 : WORLD.w + 12;
        c.ty = c.y + ((c.id % 3) - 1) * 10;
      }
    }
  }
  s.critters = s.critters.filter(c => !gone(c));
}

/** se borra al acabar de irse (el topo, al meterse en su agujero; los pulgones, al dispersarse; el caracol, al cruzar) */
function gone(c: Critter): boolean {
  const there = c.x === c.tx && c.y === c.ty;
  if (c.state !== 'out') return c.kind === 'caracol' && there;
  return c.kind === 'topo' || c.kind === 'pulgon' ? c.t >= 0.5 : there;
}

/** gnomos que pueden dejarlo todo para espantar un cuervo: los ociosos y los que van andando a trabajar */
function canShoo(g: Gnome): boolean {
  if (g.state === 'think') return true;
  const k = g.task?.kind;
  if (k === 'wander' || k === 'rest' || k === 'sit' || k === 'chase' || k === 'think') return true;
  return g.state === 'walk' && (k === 'harvest' || k === 'plant' || k === 'drop' || k === 'deliver' || k === 'pickup');
}

const shooed = (s: GameState, c: Critter) => s.gnomes.some(g => g.task?.kind === 'shoo' && g.task.critter === c.id);

/**
 * El guardián libre (patrullando o vigilando) más cercano va a por el bicho: si lo tiene a la vista
 * (guardRange), en el acto; si no, cuando se entera, a los CROW_NOTICE s, como los demás.
 * Devuelve true si hay algún guardián libre: entonces el bicho es cosa suya y nadie más deja su trabajo.
 */
function callGuard(s: GameState, c: Critter, st: { x: number; y: number }): boolean {
  let best: Gnome | null = null;
  let bestD = Infinity;
  for (const g of s.gnomes) {
    if (g.job !== 'guardian' || (g.state !== 'think' && g.task?.kind !== 'patrol' && g.task?.kind !== 'watch')) continue;
    const d = Math.hypot(g.x - c.x, g.y - c.y);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  if (!best) return false;
  if (bestD > guardRange(s) && c.t < CROW_NOTICE) return true;
  releaseTask(s, best);
  goTo(best, st.x, st.y, { kind: 'shoo', critter: c.id });
  say(best, 'eye');
  moment(s, 'vigilancia', best.x, best.y);
  return true;
}

function updateCrow(s: GameState, c: Critter, arrived: boolean) {
  const p = c.plot !== undefined ? s.plots[c.plot] : null;
  if (c.state === 'in' && arrived) {
    c.state = 'stay';
    c.t = 0;
    moment(s, 'cuervo', c.x, c.y);
    // en bandada, el aviso se dio una vez al empezar
    if (!flockCrows.has(c)) log(s, LOG.cuervo, 'importante');
    return;
  }
  if (c.state !== 'stay') return;
  // alguien la ha recogido antes: aquí ya no hay nada que picar
  if (!p || p.stage !== RIPE) return flyAway(c);
  if (c.t >= CROW_EAT) {
    log(s, LOG.cuervoCome(CULTIVOS[p.crop].uno), 'importante');
    p.stage = -1;
    p.t = 0;
    const org = orgOf(s);
    org.lost++;
    org.eaten++;
    return flyAway(c);
  }
  if (shooed(s, c)) return;
  const st = plotStand(p);
  if (callGuard(s, c, st) || c.t < CROW_NOTICE) return;
  // sin guardián libre, el gnomo libre más cercano va a espantarlo, si está lo bastante cerca para enterarse
  let best: Gnome | null = null;
  let bestD = Infinity;
  for (const g of s.gnomes) {
    const d = Math.hypot(g.x - st.x, g.y - st.y);
    if (d <= CROW_REACH && d < bestD && canShoo(g)) {
      bestD = d;
      best = g;
    }
  }
  if (!best) return;
  releaseTask(s, best);
  goTo(best, st.x, st.y, { kind: 'shoo', critter: c.id });
  say(best, 'alert');
}

// ---------- Sucesos ----------

export type EventKind = 'cuervo' | 'caracol' | 'topo' | 'pulgon' | Happening['kind'];
/** el cuervo sale el doble: es el único que pide reacción a los gnomos */
const SMALL: EventKind[] = ['cuervo', 'cuervo', 'topo', 'caracol', 'pulgon'];
const RARE: Happening['kind'][] = ['ranas', 'sindicato', 'espantapajaros'];

function updateEvents(s: GameState, dt: number, rng: Rng) {
  if (s.happening) {
    s.happening.t -= dt;
    if (s.happening.t <= 0) {
      if (s.happening.kind === 'sindicato') log(s, LOG.sindicatoFin);
      s.happening = null;
    }
  }
  // sin gnomos no pasa nada: el huerto es para mirarlos a ellos
  if (!s.gnomes.length) return;
  s.nextEventIn -= dt;
  if (s.nextEventIn > 0) return;
  s.nextEventIn = EVENT_GAP.min + rng() * (EVENT_GAP.max - EVENT_GAP.min);
  if (!s.happening && rng() < 1 / HAPPENING_EVERY) startEvent(s, pick(rng, RARE), rng);
  else if (!startEvent(s, pick(rng, SMALL), rng)) startEvent(s, 'caracol', rng);
}

/** Empieza un suceso. Devuelve false si ahora no puede pasar (nada maduro para el cuervo, otro suceso raro en curso…). */
export function startEvent(s: GameState, kind: EventKind, rng: Rng): boolean {
  if (!beginEvent(s, kind, rng)) return false;
  // los pulgones no tienen cromo en el álbum
  if (kind !== 'pulgon') collect(s, 'sucesos', kind);
  return true;
}

function beginEvent(s: GameState, kind: EventKind, rng: Rng): boolean {
  const open = s.plots.filter(p => isOpen(s, p));
  if (kind === 'cuervo') {
    if (s.happening?.kind === 'espantapajaros') return false;
    const ripe = open.filter(p => p.stage === RIPE && !s.critters.some(c => c.plot === p.id));
    if (!ripe.length) return false;
    const p = pick(rng, ripe);
    const at = plotCentre(p);
    const first = spawn(s, 'cuervo', at.x + (rng() < 0.5 ? -90 : 90), -20, at.x, at.y, 'in', p.id);
    const { cols, rows } = fieldSize(s);
    if (cols * rows >= FLOCK.minPlots && rng() < FLOCK.chance) {
      // bandada: más cuervos, cada uno a otra parcela madura
      const rest = ripe.filter(q => q !== p);
      const flock = [first];
      for (let i = 1; i < FLOCK.size && rest.length; i++) {
        const q = pick(rng, rest);
        rest.splice(rest.indexOf(q), 1);
        const to = plotCentre(q);
        flock.push(spawn(s, 'cuervo', to.x + (rng() < 0.5 ? -90 : 90), -20, to.x, to.y, 'in', q.id));
      }
      if (flock.length > 1) {
        for (const c of flock) flockCrows.add(c);
        log(s, LOG.bandada, 'importante');
      }
    }
    return true;
  }
  if (kind === 'pulgon') {
    if (liveAphids(s) >= APHID.max) return false;
    const growing = open.filter(p => aphidTarget(s, p));
    if (!growing.length) return false;
    const p = pick(rng, growing);
    const at = plotCentre(p);
    spawn(s, 'pulgon', at.x, at.y, at.x, at.y, 'in', p.id);
    moment(s, 'pulgon', at.x, at.y);
    log(s, LOG.pulgon, 'importante');
    return true;
  }
  if (kind === 'topo') {
    const empty = open.filter(p => p.stage === -1 && p.res === null && !s.critters.some(c => c.plot === p.id));
    if (!empty.length) return false;
    const p = pick(rng, empty);
    const at = plotCentre(p);
    spawn(s, 'topo', at.x, at.y, at.x, at.y, 'in', p.id);
    moment(s, 'topo', at.x, at.y);
    log(s, LOG.topo, 'importante');
    return true;
  }
  if (kind === 'caracol') {
    const { cols, rows } = fieldSize(s);
    // por el surco de una fila, de un lado al otro
    const y = FIELD.y + Math.floor(rng() * rows) * FIELD.cell + 17;
    const left = FIELD.x - 8, right = FIELD.x + cols * FIELD.cell + 8;
    const ltr = rng() < 0.5;
    spawn(s, 'caracol', ltr ? left : right, y, ltr ? right : left, y, 'in');
    moment(s, 'caracol', ltr ? left : right, y);
    if (rng() < 0.5) log(s, LOG.caracol, 'humor');
    return true;
  }
  if (s.happening || !s.gnomes.length) return false;
  if (kind === 'ranas') {
    const n = 10 + Math.floor(rng() * 6);
    for (let i = 0; i < n; i++) {
      const x = 20 + rng() * (WORLD.w - 40), y = 90 + rng() * (WORLD.h - 110);
      spawn(s, 'rana', x, y - 70, x, y, 'in');
    }
    s.happening = { kind, t: HAPPENING_TIME.ranas };
    moment(s, 'ranas', WORLD.w / 2, WORLD.h / 2);
    log(s, LOG.ranas, 'importante');
    return true;
  }
  if (kind === 'sindicato') {
    const dur = s.tree.cafe >= 2 ? HAPPENING_TIME.sindicatoCafe : HAPPENING_TIME.sindicato;
    for (const g of s.gnomes) {
      releaseTask(s, g);
      work(g, dur, 'complain', { kind: 'strike' });
      say(g, 'alert', Infinity);
    }
    s.happening = { kind, t: dur };
    moment(s, 'sindicato', DOOR.x, DOOR.y);
    log(s, LOG.sindicato, 'importante');
    return true;
  }
  // espantapájaros: uno se planta en el bancal y los cuervos que hubiera se van
  const g = pick(rng, s.gnomes);
  const st = plotStand(pick(rng, open));
  releaseTask(s, g);
  goTo(g, st.x, st.y, { kind: 'scarecrow' });
  for (const c of s.critters) if (c.kind === 'cuervo' && c.state !== 'out') flyAway(c);
  // margen para llegar andando; si llega antes, lo da por acabado él al terminar su turno (finish)
  s.happening = { kind, t: HAPPENING_TIME.espantapajaros + 20, gnome: g.id };
  moment(s, 'espantapajaros', g.x, g.y);
  log(s, LOG.espantapajaros(g.name), 'importante');
  return true;
}

// ---------- Temporadas y árbol dorado (iteración 8) ----------

/** Semillas doradas que daría acabar la temporada ahora: crecen con lo ganado, pero cada vez más despacio. */
export const seasonSeeds = (s: GameState) => Math.floor((s.totalEarned / PRESTIGE.seedUnit) ** PRESTIGE.seedPow);
/** monedas que hay que ganar en una temporada para llevarse n semillas (lo contrario de seasonSeeds) */
export const seedsCoinsNeeded = (n: number) => Math.ceil(PRESTIGE.seedUnit * n ** (1 / PRESTIGE.seedPow));
export const canEndSeason = (s: GameState) => seasonSeeds(s) + workSeeds(s) >= PRESTIGE.minSeeds;

export function talentCost(s: GameState, id: TalentId): number {
  const t = TALENTS[id];
  return Math.floor(t.base * t.mult ** s.prestige.talents[id]);
}

/** El talento se ve y se puede comprar: su padre ya está comprado. */
export const talentReachable = (s: GameState, id: TalentId) => {
  const parent = TALENTS[id].parent;
  return parent === null || s.prestige.talents[parent] > 0;
};
export const talentMaxed = (s: GameState, id: TalentId) => s.prestige.talents[id] >= TALENTS[id].max;

/** Los talentos de cada temporada (crecer, vender, contratar, suerte) se notan ya; los de herencia, en la siguiente. */
export function buyTalent(s: GameState, id: TalentId): boolean {
  if (talentMaxed(s, id) || !talentReachable(s, id)) return false;
  const cost = talentCost(s, id);
  if (s.prestige.goldenSeeds < cost) return false;
  s.prestige.goldenSeeds -= cost;
  s.prestige.talents[id]++;
  log(s, LOG.talento(TALENTOS[id].nombre), 'importante');
  return true;
}

/**
 * Acaba la temporada: devuelve un huerto nuevo (monedas, árbol, casa y gnomos desde cero) que conserva lo
 * permanente, con las semillas ganadas, la temporada en el salón de la fama y los talentos de herencia aplicados.
 * No comprueba canEndSeason: eso lo decide quien llama.
 */
export function endSeason(s: GameState, rng: Rng): GameState {
  const old = s.prestige;
  const seeds = seasonSeeds(s) + workSeeds(s);
  const kings = JOB_IDS.map(j => s.gnomes.find(g => g.id === s.crowns[j] && g.job === j)).filter((g): g is Gnome => !!g);
  const record: SeasonRecord = {
    season: old.season,
    earned: s.totalEarned,
    seconds: s.seasonTime,
    seeds,
    crowned: kings.map(g => ({ job: g.job, name: g.name, tasks: g.stats.tasks, legendary: g.legendary })),
  };
  // vuelven los coronados que más han trabajado; el que ya era veterano suma una temporada más
  const veterans: Veteran[] = [];
  for (const g of [...kings].sort((a, b) => b.stats.tasks - a.stats.tasks)) {
    if (veterans.length >= TALENT_EFFECT.veterano * old.talents.veterano) break;
    if (veterans.some(v => v.name === g.name)) continue;
    const seasons = (old.veterans.find(v => v.name === g.name)?.seasons ?? 0) + 1;
    veterans.push({ name: g.name, job: g.job, trait: g.trait, legendary: g.legendary, seasons });
  }

  const n = createState(rng);
  n.prestige = {
    season: old.season + 1,
    goldenSeeds: old.goldenSeeds + seeds,
    talents: { ...old.talents },
    history: [record, ...old.history].slice(0, PRESTIGE.historyMax),
    veterans,
    lifetimeEarned: old.lifetimeEarned + s.totalEarned,
    album: [...old.album],
  };
  const t = n.prestige.talents;
  n.log = [];
  log(n, LOG.temporada(n.prestige.season, seeds), 'importante');
  n.coins = TALENT_EFFECT.herencia * t.herencia;
  n.tree.bancal = Math.min(TREE.bancal.max, TALENT_EFFECT.bancalHeredado * t.bancalHeredado);
  n.house = Math.min(HOUSE.max, TALENT_EFFECT.casaHeredada * t.casaHeredada);
  for (const c of CROP_IDS.slice(1, 1 + TALENT_EFFECT.semillasConocidas * t.semillasConocidas)) n.tree[c as NodeId] = 1;
  // gratis y sin contar en `hired`: el primero que se contrate sigue costando lo de siempre
  for (const v of veterans) {
    if (n.gnomes.length >= houseCapacity(n)) break;
    // si su gremio aún no ha abierto (el árbol empieza de cero), echa una mano recogiendo hasta que abra
    const g = addGnome(n, jobUnlocked(n, v.job) ? v.job : 'recolector', rng, v);
    log(n, LOG.veterano(g.name, v.seasons), 'importante');
  }
  const free = TALENT_EFFECT.experiencia * t.experiencia;
  let arrived = 0;
  for (let i = 0; i < free; i++) {
    for (const job of ['recolector', 'sembrador'] as const) {
      if (n.gnomes.length >= houseCapacity(n)) break;
      const g = addGnome(n, job, rng);
      if (g.legendary) log(n, LOG.legendario(g.name), 'importante');
      arrived++;
    }
  }
  if (arrived) log(n, LOG.experiencia(arrived), 'importante');
  n.events.push({ type: 'season', season: n.prestige.season });
  return n;
}
