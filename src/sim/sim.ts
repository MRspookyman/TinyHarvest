// Simulación pura: sin DOM ni render. Todo lo que pasa en el huerto ocurre aquí.
import {
  BASE_SPEED, BASKET, BUBBLE_TIME, CARRETILLA_PER_LEVEL, CLEAR_TIME, CONSERVAS_PER_LEVEL, COST_GROWTH, CRITTER_SPEED, CROPS,
  CROW_EAT, CROW_NOTICE, CROWN_MARGIN, DOOR, EVENT_GAP, FIELD, GROUP_NAME_MAX, GROUP_PALETTE, HAPPENING_EVERY, HAPPENING_TIME,
  HARVEST_TIME, HOUSE, IDLE_AREA, JOBS, LEGENDARY, LIFE, LOG_MAX, MAX_GNOMES, MAX_GROUPS, MEET_COOLDOWN, MEET_DIST, MERCADO_PER_LEVEL,
  MOLE_TIME, PICKUP_TIME, PLANT_TIME, PORTER_CAPACITY, RIPE, ROTTEN, TRAIT_WALK, TRAIT_WORK, TREE, VALUE_DISTANCE_BIAS, WORLD,
} from './config';
import { makeGnome, randomTrait } from './state';
import { APELLIDOS, ARBOL, CULTIVOS, GRUPOS, LEGENDARIO, LOG, NOMBRES, OFICIOS } from '../textos';
import type {
  BubbleKind, Critter, CritterKind, CropId, GameState, Gnome, GnomeGroup, Happening, JobId, MomentKind, NodeId, Plot, Pose,
  Priority, Rng, Task, TaskKind,
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

export function buyNode(s: GameState, id: NodeId): boolean {
  if (nodeMaxed(s, id) || !nodeReachable(s, id)) return false;
  const cost = nodeCost(s, id);
  if (s.coins < cost) return false;
  s.coins -= cost;
  s.tree[id]++;
  if (id === 'bancal') {
    const f = fieldSize(s);
    log(s, LOG.bancal(f.cols, f.rows));
  } else if (id === 'trigo' || id === 'tomate' || id === 'calabaza') {
    log(s, LOG.desbloqueo(CULTIVOS[id].plural));
  } else if (id === 'porteadores') {
    log(s, LOG.porteadores);
  } else {
    log(s, LOG.mejora(ARBOL[id].nombre));
  }
  return true;
}

export const cropUnlocked = (s: GameState, c: CropId) => c === 'zanahoria' || s.tree[c] > 0;
export const jobUnlocked = (s: GameState, j: JobId) => j !== 'porteador' || s.tree.porteadores > 0;
export const walkSpeed = (s: GameState) => BASE_SPEED * (1 + 0.2 * s.tree.botas);
export const workMult = (s: GameState) => Math.max(0.3, 1 - 0.18 * s.tree.cafe);
/** velocidad de un gnomo concreto: la del huerto con su rasgo y, si es legendario, un poco más */
export const gnomeWalkSpeed = (s: GameState, g: Gnome) =>
  walkSpeed(s) * (TRAIT_WALK[g.trait] ?? 1) * (g.legendary ? LEGENDARY.mult : 1);
/** multiplicador del tiempo de trabajo de un gnomo concreto (menos = más rápido) */
export const gnomeWorkMult = (s: GameState, g: Gnome) =>
  (workMult(s) * (TRAIT_WORK[g.trait] ?? 1)) / (g.legendary ? LEGENDARY.mult : 1);
export const capacity = (s: GameState) => 1 + s.tree.saco;
export const basketMax = (s: GameState) => BASKET.base + BASKET.perLevel * s.tree.cesta;
export const stageTime = (s: GameState, crop: CropId) => (CROPS[crop].grow * 0.85 ** s.tree.abono) / RIPE;
export const hasPorters = (s: GameState) => s.gnomes.some(g => g.job === 'porteador');
/** monedas que da un cultivo al venderse, con el mercado */
export const cropValue = (s: GameState, crop: CropId) => CROPS[crop].value * (1 + MERCADO_PER_LEVEL * s.tree.mercado);
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
  log(s, LOG.casa(houseCapacity(s)));
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

function log(s: GameState, text: string) {
  s.log.unshift(text);
  if (s.log.length > LOG_MAX) s.log.length = LOG_MAX;
}

const pick = <T>(rng: Rng, a: readonly T[]): T => a[Math.floor(rng() * a.length)];

function makeName(s: GameState, rng: Rng): string {
  for (let i = 0; i < 30; i++) {
    const n = `${pick(rng, NOMBRES)} ${pick(rng, APELLIDOS)}`;
    if (!s.gnomes.some(g => g.name === n)) return n;
  }
  return `${pick(rng, NOMBRES)} ${s.nextId}`;
}

export function hireCost(s: GameState, job: JobId): number {
  return Math.floor(JOBS[job].base * COST_GROWTH ** s.hired[job]);
}

export function hire(s: GameState, job: JobId, rng: Rng): boolean {
  const cost = hireCost(s, job);
  if (!jobUnlocked(s, job) || s.coins < cost || s.gnomes.length >= houseCapacity(s)) return false;
  s.coins -= cost;
  s.hired[job]++;
  const name = makeName(s, rng);
  const x = DOOR.x + rng() * 8 - 4;
  const trait = randomTrait(rng);
  const legendary = rng() < LEGENDARY.chance;
  const full = legendary ? `${name} ${pick(rng, LEGENDARIO.titulos)}` : name;
  const g = makeGnome(s.nextId++, full, job, s.groups[0].id, x, DOOR.y + 2, trait, legendary);
  s.gnomes.push(g);
  log(s, LOG.contratado(g.name, OFICIOS[job].nombre));
  if (legendary) {
    log(s, LOG.legendario(g.name));
    moment(s, 'legendario', g.x, g.y);
  }
  return true;
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
    id: s.nextGroupId++, name, color: color === -1 ? s.groups.length % GROUP_PALETTE.length : color, priority: 'cercano', seed: null,
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
  group.seed = seed;
}

/** El cultivo que plantará un sembrador en esa parcela. */
const seedFor = (s: GameState, g: Gnome, p: Plot): CropId => groupOf(s, g).seed ?? p.crop;

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

/** Recoge si está madura; planta si está vacía o echada a perder (se arranca y se siembra). */
export function clickPlot(s: GameState, id: number, crop: CropId): 'harvest' | 'plant' | null {
  const p = s.plots[id];
  if (!p || !isOpen(s, p)) return null;
  if (p.stage === RIPE) {
    const v = cropValue(s, p.crop);
    s.coins += v;
    s.totalEarned += v;
    const o = plotOrigin(p);
    s.events.push({ type: 'coins', x: o.x + 9, y: o.y + 2, amount: Math.round(v) });
    if (s.manualHarvests++ % 5 === 0) log(s, LOG.manual(CULTIVOS[p.crop].uno));
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
    return 'plant';
  }
  return null;
}

// ---------- Simulación ----------

export function tick(s: GameState, dt: number, rng: Rng) {
  for (const p of s.plots) {
    if (p.stage < 0 || p.stage === ROTTEN) continue;
    p.t += dt;
    if (p.stage === RIPE) {
      if (p.t >= keepTime(s, p.crop)) rot(s, p, rng);
      continue;
    }
    const st = stageTime(s, p.crop);
    while (p.t >= st && p.stage < RIPE) {
      p.t -= st;
      p.stage++;
    }
    if (p.stage === RIPE) p.t = 0;
  }
  for (const g of s.gnomes) updateGnome(s, g, dt, rng);
  meetings(s, rng);
  updateCritters(s, dt);
  updateEvents(s, dt, rng);
  updateCrowns(s, rng);
}

function rot(s: GameState, p: Plot, rng: Rng) {
  p.stage = ROTTEN;
  p.t = 0;
  s.rotted++;
  if (rng() < 0.25) log(s, LOG.podrido(CULTIVOS[p.crop].uno));
}

function moment(s: GameState, kind: MomentKind, x: number, y: number) {
  s.events.push({ type: 'moment', kind, x: Math.round(x), y: Math.round(y) });
}

/** bocadillo; t = Infinity lo deja hasta que acabe la tarea */
function say(g: Gnome, kind: BubbleKind, t = BUBBLE_TIME, crop?: CropId) {
  g.bubble = crop ? { kind, crop, t } : { kind, t };
}

/** bocadillo de intención: no tapa uno que ya esté diciendo algo (un enfado, un saludo) */
function intent(g: Gnome, kind: BubbleKind, crop?: CropId) {
  if (!g.bubble) say(g, kind, BUBBLE_TIME, crop);
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
    log(s, holder ? LOG.corona(leader.name, holder.name, oficio) : LOG.primeraCorona(leader.name, oficio));
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
 */
function pickPlot(s: GameState, g: Gnome, filter: (p: Plot) => boolean): Plot | null {
  const prio = groupOf(s, g).priority;
  const only = prio.startsWith('solo_') ? prio.slice('solo_'.length) : null;
  const speed = gnomeWalkSpeed(s, g);
  let best: Plot | null = null;
  let bestScore = Infinity;
  for (const p of s.plots) {
    if (p.res !== null || !isOpen(s, p) || !filter(p)) continue;
    if (only && p.crop !== only) continue;
    const st = plotStand(p);
    const dist = Math.hypot(st.x - g.x, st.y - g.y);
    let score = dist;
    if (prio === 'valioso') {
      const crop = g.job === 'sembrador' ? seedFor(s, g, p) : p.crop;
      score = -cropValue(s, crop) / (dist + VALUE_DISTANCE_BIAS);
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

/** desplaza las parcelas salvables por delante de cualquier distancia en «urgente» */
const UNSAVABLE = 1e6;

/** el topo está en esa parcela: no se puede sembrar hasta que se vaya */
export const moleOn = (s: GameState, plot: number) =>
  s.critters.some(c => c.kind === 'topo' && c.plot === plot && c.state !== 'out');

function goDeliver(s: GameState, g: Gnome, rng: Rng) {
  if (g.job === 'recolector' && hasPorters(s)) goTo(g, BASKET.x + rng() * 6 - 3, BASKET.y, { kind: 'drop' });
  else goTo(g, DOOR.x + rng() * 8 - 4, DOOR.y, { kind: 'deliver' });
  intent(g, 'sack');
}

function decide(s: GameState, g: Gnome, rng: Rng) {
  // el perezoso se para a pensar entre tarea y tarea
  if (g.trait === 'perezoso' && rng() < LIFE.lazyThink) {
    work(g, 1.5 + rng(), 'idle', { kind: 'think' });
    say(g, 'think', Infinity);
    moment(s, 'pensar', g.x, g.y);
    if (rng() < 0.15) log(s, LOG.pensar(g.name));
    return;
  }
  if (g.job === 'recolector') {
    if (g.carry.length < capacity(s)) {
      const p = pickPlot(s, g, p => p.stage === RIPE);
      if (p) {
        p.res = g.id;
        const st = plotStand(p);
        goTo(g, st.x, st.y, { kind: 'harvest', plot: p.id });
        intent(g, 'crop', p.crop);
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
      intent(g, 'crop', seedFor(s, g, p));
      return;
    }
  } else {
    if (g.carry.length) return goDeliver(s, g, rng);
    // cada porteador que ya va a la cesta se lleva su carga; si no queda nada para este, no va
    const claimed = s.gnomes.filter(o => o !== g && o.job === 'porteador' && o.task?.kind === 'pickup').length * porterCapacity(s);
    if (s.basket.length > claimed) {
      goTo(g, BASKET.x + rng() * 6 - 3, BASKET.y + 2, { kind: 'pickup' });
      intent(g, 'basket');
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
    if (rng() < 0.5) log(s, `${g.name} ${pick(rng, LOG.siesta)}`);
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
  if (rng() < 0.25) log(s, (kind === 'cards' ? LOG.cartas : LOG.charla)(a.name, b.name));
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
  if (rng() < 0.2) log(s, LOG.mariposa(g.name));
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
  if (rng() < 0.25) log(s, LOG.tropiezo(g.name));
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
  for (const g of [a, b]) {
    say(g, 'wave', 1.5);
    // los que pasean se paran a saludar; los que trabajan saludan sin parar
    if (g.task?.kind === 'wander') work(g, 0.8, 'wave', { kind: 'greet', other: g === a ? b.id : a.id });
  }
  moment(s, 'saludo', (a.x + b.x) / 2, (a.y + b.y) / 2);
}

// ---------- Llegar y acabar ----------

/** llega a su parcela y ya no le vale: alguien se le ha adelantado */
function dispute(s: GameState, g: Gnome, rng: Rng) {
  releaseTask(s, g);
  work(g, 1, 'idle', { kind: 'rest' });
  say(g, 'angry', 1.5);
  moment(s, 'disputa', g.x, g.y);
  if (rng() < 0.2) log(s, LOG.disputa(g.name));
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
      if (rng() < 0.15) log(s, LOG.cestaLlena(g.name));
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
  } else if (task.kind === 'wander') {
    work(g, 0.6 + rng(), 'idle', { kind: 'rest' });
  } else if (task.kind === 'sit') {
    work(g, 4 + rng() * 3, 'sit', task);
    moment(s, 'sentarse', g.x, g.y);
    if (rng() < 0.15) log(s, LOG.sentarse(g.name));
  } else if (task.kind === 'cards' || task.kind === 'chat') {
    const o = s.gnomes.find(o => o.id === task.other);
    if (!o || o.task?.kind !== task.kind || o.task.other !== g.id) return think(g);
    startTogether(s, g, o, task.kind, rng);
  } else if (task.kind === 'shoo') {
    const c = s.critters.find(c => c.id === task.critter);
    if (!c || c.state !== 'stay') return think(g);
    flyAway(c);
    work(g, 1, 'scare', task);
    if (rng() < 0.6) log(s, LOG.cuervoFuera(g.name));
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
    p.stage = -1;
    p.t = 0;
    g.stats.harvests++;
    g.stats.tasks++;
    const o = plotOrigin(p);
    s.events.push({ type: 'harvest', gnome: g.id, crop, x: o.x + 9, y: o.y + 9 });
    // el glotón se come alguna zanahoria recién recogida
    if (g.trait === 'gloton' && crop === 'zanahoria' && rng() < LIFE.glutton) {
      say(g, 'yum', Infinity);
      moment(s, 'comer', g.x, g.y);
      if (rng() < 0.4) log(s, LOG.comer(g.name));
      work(g, 1.2, 'idle', { kind: 'rest' });
      return;
    }
    g.carry.push(crop);
    g.stats.value += cropValue(s, crop);
    if (CROPS[crop].value >= 12 && rng() < 0.15) {
      log(s, LOG.protesta(g.name));
      say(g, 'alert', Infinity);
      g.stats.complaints++;
      work(g, 1.2, 'complain', { kind: 'complain' });
      moment(s, 'queja', g.x, g.y);
      return;
    }
  } else if (task?.kind === 'plant' && p) {
    p.res = null;
    if (p.stage === -1 || p.stage === ROTTEN) {
      if (p.stage === ROTTEN && rng() < 0.2) log(s, LOG.arrancar(g.name));
      else if (rng() < 0.08) log(s, `${g.name} ${pick(rng, LOG.plantar)}`);
      p.crop = seedFor(s, g, p);
      p.stage = 0;
      p.t = 0;
      g.stats.plants++;
      g.stats.tasks++;
    }
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

function updateCritters(s: GameState, dt: number) {
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
    else if (c.kind === 'topo') {
      // asoma, se queda un rato y se vuelve a meter (medio segundo para cada animación)
      if (c.state === 'in' && c.t >= 0.5) c.state = 'stay';
      else if (c.state === 'stay' && c.t >= 0.5 + MOLE_TIME) {
        c.state = 'out';
        c.t = 0;
        log(s, LOG.topoFuera);
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

/** se borra al acabar de irse (el topo, al meterse en su agujero; el caracol, al cruzar) */
function gone(c: Critter): boolean {
  const there = c.x === c.tx && c.y === c.ty;
  if (c.state !== 'out') return c.kind === 'caracol' && there;
  return c.kind === 'topo' ? c.t >= 0.5 : there;
}

/** gnomos que pueden dejarlo todo para espantar un cuervo: los ociosos y los que van andando a trabajar */
function canShoo(g: Gnome): boolean {
  if (g.state === 'think') return true;
  const k = g.task?.kind;
  if (k === 'wander' || k === 'rest' || k === 'sit' || k === 'chase' || k === 'think') return true;
  return g.state === 'walk' && (k === 'harvest' || k === 'plant' || k === 'drop' || k === 'deliver' || k === 'pickup');
}

function updateCrow(s: GameState, c: Critter, arrived: boolean) {
  const p = c.plot !== undefined ? s.plots[c.plot] : null;
  if (c.state === 'in' && arrived) {
    c.state = 'stay';
    c.t = 0;
    moment(s, 'cuervo', c.x, c.y);
    log(s, LOG.cuervo);
    return;
  }
  if (c.state !== 'stay') return;
  // alguien la ha recogido antes: aquí ya no hay nada que picar
  if (!p || p.stage !== RIPE) return flyAway(c);
  if (c.t >= CROW_EAT) {
    log(s, LOG.cuervoCome(CULTIVOS[p.crop].uno));
    p.stage = -1;
    p.t = 0;
    return flyAway(c);
  }
  if (c.t < CROW_NOTICE || s.gnomes.some(g => g.task?.kind === 'shoo' && g.task.critter === c.id)) return;
  // el gnomo libre más cercano va a espantarlo
  const st = plotStand(p);
  let best: Gnome | null = null;
  let bestD = Infinity;
  for (const g of s.gnomes) {
    const d = Math.hypot(g.x - st.x, g.y - st.y);
    if (d < bestD && canShoo(g)) {
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

export type EventKind = 'cuervo' | 'caracol' | 'topo' | Happening['kind'];
/** el cuervo sale el doble: es el único que pide reacción a los gnomos */
const SMALL: EventKind[] = ['cuervo', 'cuervo', 'topo', 'caracol'];
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
  const open = s.plots.filter(p => isOpen(s, p));
  if (kind === 'cuervo') {
    if (s.happening?.kind === 'espantapajaros') return false;
    const ripe = open.filter(p => p.stage === RIPE && !s.critters.some(c => c.plot === p.id));
    if (!ripe.length) return false;
    const p = pick(rng, ripe);
    const at = plotCentre(p);
    spawn(s, 'cuervo', at.x + (rng() < 0.5 ? -90 : 90), -20, at.x, at.y, 'in', p.id);
    return true;
  }
  if (kind === 'topo') {
    const empty = open.filter(p => p.stage === -1 && p.res === null && !s.critters.some(c => c.plot === p.id));
    if (!empty.length) return false;
    const p = pick(rng, empty);
    const at = plotCentre(p);
    spawn(s, 'topo', at.x, at.y, at.x, at.y, 'in', p.id);
    moment(s, 'topo', at.x, at.y);
    log(s, LOG.topo);
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
    if (rng() < 0.5) log(s, LOG.caracol);
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
    log(s, LOG.ranas);
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
    log(s, LOG.sindicato);
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
  log(s, LOG.espantapajaros(g.name));
  return true;
}
