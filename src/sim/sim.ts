// Simulación pura: sin DOM ni render. Todo lo que pasa en el huerto ocurre aquí.
import {
  BASE_SPEED, BASKET, CLEAR_TIME, COST_GROWTH, CROPS, CROWN_MARGIN, DOOR, FIELD, GROUP_NAME_MAX, GROUP_PALETTE, HARVEST_TIME,
  IDLE_AREA, JOBS, LOG_MAX, MAX_GNOMES, MAX_GROUPS, PICKUP_TIME, PLANT_TIME, PORTER_CAPACITY, RIPE, ROTTEN, TREE,
  VALUE_DISTANCE_BIAS,
} from './config';
import { makeGnome } from './state';
import { APELLIDOS, ARBOL, CULTIVOS, GRUPOS, LOG, NOMBRES, OFICIOS } from '../textos';
import type { CropId, GameState, Gnome, GnomeGroup, JobId, NodeId, Plot, Pose, Priority, Rng, Task } from './types';

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
export const capacity = (s: GameState) => 1 + s.tree.saco;
export const basketMax = (s: GameState) => BASKET.base + BASKET.perLevel * s.tree.cesta;
export const stageTime = (s: GameState, crop: CropId) => (CROPS[crop].grow * 0.85 ** s.tree.abono) / RIPE;
export const hasPorters = (s: GameState) => s.gnomes.some(g => g.job === 'porteador');

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
  if (!jobUnlocked(s, job) || s.coins < cost || s.gnomes.length >= MAX_GNOMES) return false;
  s.coins -= cost;
  s.hired[job]++;
  const g = makeGnome(s.nextId++, makeName(s, rng), job, s.groups[0].id, DOOR.x + rng() * 8 - 4, DOOR.y + 2);
  s.gnomes.push(g);
  log(s, LOG.contratado(g.name, OFICIOS[job].nombre));
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
    const v = CROPS[p.crop].value;
    s.coins += v;
    s.totalEarned += v;
    const o = plotOrigin(p);
    s.events.push({ type: 'coins', x: o.x + 9, y: o.y + 2, amount: v });
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
      if (p.t >= CROPS[p.crop].keep) rot(s, p, rng);
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
  updateCrowns(s);
}

function rot(s: GameState, p: Plot, rng: Rng) {
  p.stage = ROTTEN;
  p.t = 0;
  s.rotted++;
  if (rng() < 0.25) log(s, LOG.podrido(CULTIVOS[p.crop].uno));
}

/**
 * Una corona por oficio para el que más tareas lleva. Cada oficio compite solo con los suyos porque sus
 * tareas duran distinto: un porteador nunca hará tantas como un recolector.
 * Para quitársela al líder hay que sacarle CROWN_MARGIN tareas.
 */
function updateCrowns(s: GameState) {
  for (const job of Object.keys(s.crowns) as JobId[]) {
    let leader: Gnome | null = null;
    for (const g of s.gnomes) if (g.job === job && (!leader || g.stats.tasks > leader.stats.tasks)) leader = g;
    if (!leader || leader.stats.tasks === 0 || leader.id === s.crowns[job]) continue;
    const holder = s.gnomes.find(g => g.id === s.crowns[job]);
    if (holder && leader.stats.tasks < holder.stats.tasks + CROWN_MARGIN) continue;
    const oficio = OFICIOS[job].nombre.toLowerCase();
    log(s, holder ? LOG.corona(leader.name, holder.name, oficio) : LOG.primeraCorona(leader.name, oficio));
    s.crowns[job] = leader.id;
  }
}

function updateGnome(s: GameState, g: Gnome, dt: number, rng: Rng) {
  g.t += dt;
  if (g.state === 'think') {
    decide(s, g, rng);
  } else if (g.state === 'walk') {
    const dx = g.tx - g.x, dy = g.ty - g.y;
    const d = Math.hypot(dx, dy), step = walkSpeed(s) * dt;
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
  g.bubble = null;
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
  const speed = walkSpeed(s);
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
      score = -CROPS[crop].value / (dist + VALUE_DISTANCE_BIAS);
    } else if (prio === 'urgente' && p.stage === RIPE) {
      const margin = CROPS[p.crop].keep - p.t - dist / speed - HARVEST_TIME;
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

function goDeliver(s: GameState, g: Gnome, rng: Rng) {
  if (g.job === 'recolector' && hasPorters(s)) goTo(g, BASKET.x + rng() * 6 - 3, BASKET.y, { kind: 'drop' });
  else goTo(g, DOOR.x + rng() * 8 - 4, DOOR.y, { kind: 'deliver' });
}

function decide(s: GameState, g: Gnome, rng: Rng) {
  if (g.job === 'recolector') {
    if (g.carry.length < capacity(s)) {
      const p = pickPlot(s, g, p => p.stage === RIPE);
      if (p) {
        p.res = g.id;
        const st = plotStand(p);
        goTo(g, st.x, st.y, { kind: 'harvest', plot: p.id });
        return;
      }
    }
    if (g.carry.length) return goDeliver(s, g, rng);
  } else if (g.job === 'sembrador') {
    const p = pickPlot(s, g, p => (p.stage === -1 || p.stage === ROTTEN) && cropUnlocked(s, seedFor(s, g, p)));
    if (p) {
      p.res = g.id;
      const st = plotStand(p);
      goTo(g, st.x, st.y, { kind: 'plant', plot: p.id });
      return;
    }
  } else {
    if (g.carry.length) return goDeliver(s, g, rng);
    // cada porteador que ya va a la cesta se lleva hasta PORTER_CAPACITY; si no queda nada para este, no va
    const claimed = s.gnomes.filter(o => o !== g && o.job === 'porteador' && o.task?.kind === 'pickup').length * PORTER_CAPACITY;
    if (s.basket.length > claimed) {
      goTo(g, BASKET.x + rng() * 6 - 3, BASKET.y + 2, { kind: 'pickup' });
      return;
    }
  }
  idle(s, g, rng);
}

function idle(s: GameState, g: Gnome, rng: Rng) {
  if (rng() < 0.12) {
    if (rng() < 0.5) log(s, `${g.name} ${pick(rng, LOG.siesta)}`);
    g.bubble = 'zz';
    g.stats.naps++;
    work(g, 3 + rng() * 2, 'sleep', { kind: 'nap' });
    return;
  }
  const x = IDLE_AREA.x0 + rng() * (IDLE_AREA.x1 - IDLE_AREA.x0);
  const y = IDLE_AREA.y0 + rng() * (IDLE_AREA.y1 - IDLE_AREA.y0);
  goTo(g, x, y, { kind: 'wander' });
}

function arrive(s: GameState, g: Gnome, rng: Rng) {
  const task = g.task;
  if (!task) return think(g);
  const p = task.plot !== undefined ? s.plots[task.plot] : null;

  if (task.kind === 'harvest' && p) {
    if (p.stage !== RIPE) return releaseTask(s, g);
    work(g, HARVEST_TIME * workMult(s), 'harvest', task);
  } else if (task.kind === 'plant' && p) {
    if (p.stage !== -1 && p.stage !== ROTTEN) return releaseTask(s, g);
    work(g, (PLANT_TIME + (p.stage === ROTTEN ? CLEAR_TIME : 0)) * workMult(s), 'harvest', task);
  } else if (task.kind === 'deliver') {
    const amount = g.carry.reduce((a, c) => a + CROPS[c].value, 0);
    s.coins += amount;
    s.totalEarned += amount;
    s.events.push({ type: 'coins', x: DOOR.x, y: DOOR.y - 20, amount });
    if (rng() < 0.2) {
      const que = g.carry.length === 1 ? CULTIVOS[g.carry[0]].uno : LOG.variosCultivos(g.carry.length);
      log(s, LOG.entrega(g.name, que, amount));
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
      g.bubble = 'alert';
      g.stats.complaints++;
      work(g, 1.2, 'complain', { kind: 'wait' });
    } else {
      g.stats.tasks++;
      work(g, 0.3, 'idle', { kind: 'rest' });
    }
  } else if (task.kind === 'pickup') {
    if (!s.basket.length) return think(g);
    work(g, PICKUP_TIME * workMult(s), 'harvest', task);
  } else if (task.kind === 'wander') {
    work(g, 0.6 + rng(), 'idle', { kind: 'rest' });
  } else {
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
    p.stage = -1;
    p.t = 0;
    g.carry.push(p.crop);
    g.stats.harvests++;
    g.stats.value += CROPS[p.crop].value;
    g.stats.tasks++;
    if (CROPS[p.crop].value >= 12 && rng() < 0.15) {
      log(s, LOG.protesta(g.name));
      g.bubble = 'alert';
      g.stats.complaints++;
      work(g, 1.2, 'complain', { kind: 'complain' });
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
    g.carry.push(...s.basket.splice(0, PORTER_CAPACITY));
    if (g.carry.length > before) g.stats.tasks++;
  } else if (task?.kind === 'wait') {
    // vuelve a intentar dejar lo que lleva
    g.bubble = null;
    return goDeliver(s, g, rng);
  }
  think(g);
}
