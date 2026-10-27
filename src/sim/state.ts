import {
  CROP_IDS, EVENT_GAP, FIELD, GROUP_NAME_MAX, GROUP_PALETTE, HOUSE, JOB_IDS, MAX_GROUPS, NODE_IDS, PRIORITIES, ROTTEN, TRAIT_IDS, TREE,
} from './config';
import { GRUPOS, LOG } from '../textos';
import type { CropId, GameState, Gnome, GnomeGroup, GnomeStats, JobId, NodeId, Plot, Priority, Rng, TraitId } from './types';

const STAT_KEYS: (keyof GnomeStats)[] = ['tasks', 'harvests', 'value', 'plants', 'delivered', 'walked', 'naps', 'complaints'];
const emptyStats = (): GnomeStats => ({ tasks: 0, harvests: 0, value: 0, plants: 0, delivered: 0, walked: 0, naps: 0, complaints: 0 });

export const randomTrait = (rng: Rng): TraitId => TRAIT_IDS[Math.floor(rng() * TRAIT_IDS.length)];

export function makeGnome(
  id: number, name: string, job: JobId, group: number, x: number, y: number, trait: TraitId, legendary = false,
): Gnome {
  return {
    id, name, job, group, x, y, tx: x, ty: y,
    state: 'think', task: null, pose: 'idle', timer: 0, t: 0, flip: false, carry: [], bubble: null, stats: emptyStats(),
    trait, legendary,
  };
}

export function createState(rng: Rng): GameState {
  const plots: Plot[] = [];
  for (let row = 0; row < FIELD.maxRows; row++) {
    for (let col = 0; col < FIELD.maxCols; col++) {
      plots.push({ id: plots.length, col, row, crop: 'zanahoria', stage: -1, t: 0, res: null });
    }
  }
  // una fila ya sembrada para que haya algo que recoger desde el principio
  for (const p of plots) if (p.row === 1 && p.col < FIELD.startCols) p.stage = Math.floor(rng() * 3);

  const tree = Object.fromEntries(NODE_IDS.map(id => [id, 0])) as Record<NodeId, number>;
  return {
    coins: 0,
    totalEarned: 0,
    tree,
    plots,
    basket: [],
    gnomes: [],
    hired: { recolector: 0, sembrador: 0, porteador: 0 },
    groups: [{ id: 1, name: GRUPOS.primero, color: 0, priority: 'cercano', seed: null }],
    nextGroupId: 2,
    nextId: 1,
    manualHarvests: 0,
    rotted: 0,
    house: 0,
    crowns: { recolector: null, sembrador: null, porteador: null },
    critters: [],
    nextCritterId: 1,
    nextEventIn: EVENT_GAP.first,
    happening: null,
    log: [LOG.inicio],
    events: [],
  };
}

// ---------- Guardado ----------
// Solo se guarda el estado duradero. Lo que el gnomo estaba haciendo se descarta
// y al cargar vuelve a pensar; no se simula el tiempo que pasó fuera. Los bichos y los sucesos tampoco se guardan.
// Los campos opcionales (semilla del grupo, estadísticas, podredumbre) se rellenan al cargar si faltan;
// los cambios de forma van en MIGRATIONS.

export const SAVE_VERSION = 4;
/** la partida más vieja que se sabe cargar */
const OLDEST_VERSION = 3;

export interface SaveData {
  v: typeof SAVE_VERSION;
  coins: number;
  totalEarned: number;
  tree: Record<NodeId, number>;
  basket: CropId[];
  hired: Record<JobId, number>;
  groups: GnomeGroup[];
  nextGroupId: number;
  nextId: number;
  manualHarvests: number;
  rotted: number;
  house: number;
  crowns: Record<JobId, number | null>;
  plots: { crop: CropId; stage: number; t: number }[];
  gnomes: {
    id: number; name: string; job: JobId; group: number; x: number; y: number; carry: CropId[]; stats: GnomeStats;
    trait: TraitId; legendary: boolean;
  }[];
  log: string[];
}

export function serialize(s: GameState): SaveData {
  return {
    v: SAVE_VERSION,
    coins: s.coins,
    totalEarned: s.totalEarned,
    tree: { ...s.tree },
    basket: [...s.basket],
    hired: { ...s.hired },
    groups: s.groups.map(g => ({ ...g })),
    nextGroupId: s.nextGroupId,
    nextId: s.nextId,
    manualHarvests: s.manualHarvests,
    rotted: s.rotted,
    house: s.house,
    crowns: { ...s.crowns },
    plots: s.plots.map(p => ({ crop: p.crop, stage: p.stage, t: p.t })),
    gnomes: s.gnomes.map(g => ({
      id: g.id, name: g.name, job: g.job, group: g.group, x: g.x, y: g.y, carry: [...g.carry], stats: { ...g.stats },
      trait: g.trait, legendary: g.legendary,
    })),
    log: s.log.slice(0, 15),
  };
}

const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const int = (v: unknown, def: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(num(v, def))));
const isCrop = (v: unknown): v is CropId => CROP_IDS.includes(v as CropId);
const isJob = (v: unknown): v is JobId => JOB_IDS.includes(v as JobId);
const isTrait = (v: unknown): v is TraitId => TRAIT_IDS.includes(v as TraitId);

type RawSave = Record<string, unknown> & { v: number };
/**
 * Pasos de migración en orden: MIGRATIONS[i] convierte una partida de la versión OLDEST_VERSION + i a la siguiente.
 * Para una versión nueva basta con añadir un paso al final.
 */
const MIGRATIONS: ((d: RawSave, rng: Rng) => void)[] = [
  // v3 → v4: rasgos de carácter y gnomos legendarios (los de antes no lo son: no se les va a cambiar el nombre)
  (d, rng) => {
    if (Array.isArray(d.gnomes)) {
      for (const g of d.gnomes) if (g && typeof g === 'object') Object.assign(g, { trait: randomTrait(rng), legendary: false });
    }
  },
];

export function deserialize(raw: unknown, rng: Rng): GameState | null {
  const v = (raw as { v?: unknown } | null)?.v;
  if (!raw || typeof raw !== 'object' || typeof v !== 'number' || v < OLDEST_VERSION || v > SAVE_VERSION || !Number.isInteger(v)) return null;
  // se migra una copia: la partida que nos pasan no se toca
  const m = structuredClone(raw) as RawSave;
  for (let ver = v; ver < SAVE_VERSION; ver++) MIGRATIONS[ver - OLDEST_VERSION](m, rng);
  m.v = SAVE_VERSION;
  const d = m as unknown as Partial<SaveData>;
  const s = createState(rng);

  s.coins = Math.max(0, num(d.coins, 0));
  s.totalEarned = Math.max(0, num(d.totalEarned, 0));
  for (const id of NODE_IDS) s.tree[id] = int(d.tree?.[id], 0, 0, TREE[id].max);
  s.basket = Array.isArray(d.basket) ? d.basket.filter(isCrop) : [];
  s.nextId = Math.max(1, Math.floor(num(d.nextId, 1)));
  s.manualHarvests = Math.max(0, num(d.manualHarvests, 0));
  s.rotted = Math.max(0, num(d.rotted, 0));
  s.house = int(d.house, 0, 0, HOUSE.max);
  for (const j of JOB_IDS) s.hired[j] = int(d.hired?.[j], 0, 0, 999);

  if (Array.isArray(d.groups)) {
    const groups = d.groups
      .filter(g => g && typeof g.id === 'number' && typeof g.name === 'string')
      .slice(0, MAX_GROUPS)
      .map(g => ({
        id: Math.floor(g.id),
        name: g.name.slice(0, GROUP_NAME_MAX) || GRUPOS.primero,
        color: int(g.color, 0, 0, GROUP_PALETTE.length - 1),
        priority: PRIORITIES.includes(g.priority) ? g.priority : ('cercano' as Priority),
        seed: isCrop(g.seed) ? g.seed : null,
      }));
    if (groups.length) s.groups = groups;
  }
  s.nextGroupId = Math.max(int(d.nextGroupId, 2, 1, 1e6), ...s.groups.map(g => g.id + 1));

  if (Array.isArray(d.plots) && d.plots.length === s.plots.length) {
    d.plots.forEach((p, i) => {
      const plot = s.plots[i];
      plot.crop = isCrop(p?.crop) ? p.crop : 'zanahoria';
      const stage = Math.floor(num(p?.stage, -1));
      plot.stage = stage >= -1 && stage <= ROTTEN ? stage : -1;
      plot.t = Math.max(0, num(p?.t, 0));
    });
  }
  if (Array.isArray(d.gnomes)) {
    const groupIds = new Set(s.groups.map(g => g.id));
    s.gnomes = d.gnomes
      .filter(g => g && isJob(g.job) && typeof g.name === 'string')
      .map(g => {
        const id = typeof g.id === 'number' ? Math.floor(g.id) : s.nextId++;
        const group = groupIds.has(g.group) ? g.group : s.groups[0].id;
        const trait = isTrait(g.trait) ? g.trait : randomTrait(rng);
        const gn = makeGnome(id, g.name, g.job, group, num(g.x, 70), num(g.y, 120), trait, g.legendary === true);
        gn.carry = Array.isArray(g.carry) ? g.carry.filter(isCrop) : [];
        for (const k of STAT_KEYS) gn.stats[k] = Math.max(0, num(g.stats?.[k], 0));
        return gn;
      });
    s.nextId = Math.max(s.nextId, ...s.gnomes.map(g => g.id + 1));
  }
  // las partidas de antes de la casa pueden tener más gnomos que camas: la casa crece hasta que quepan
  while (s.house < HOUSE.max && HOUSE.base + HOUSE.perLevel * s.house < s.gnomes.length) s.house++;
  for (const j of JOB_IDS) {
    const id = d.crowns?.[j];
    s.crowns[j] = s.gnomes.some(g => g.id === id && g.job === j) ? (id as number) : null;
  }
  if (Array.isArray(d.log)) s.log = d.log.filter((l): l is string => typeof l === 'string').slice(0, 15);
  return s;
}
