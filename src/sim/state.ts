import { CROP_IDS, FIELD, GROUP_NAME_MAX, GROUP_PALETTE, JOB_IDS, MAX_GROUPS, NODE_IDS, PRIORITIES, RIPE, TREE } from './config';
import { GRUPOS, LOG } from '../textos';
import type { CropId, GameState, Gnome, GnomeGroup, JobId, NodeId, Plot, Priority, Rng } from './types';

export function makeGnome(id: number, name: string, job: JobId, group: number, x: number, y: number): Gnome {
  return {
    id, name, job, group, x, y, tx: x, ty: y,
    state: 'think', task: null, pose: 'idle', timer: 0, t: 0, flip: false, carry: [], bubble: null,
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
    groups: [{ id: 1, name: GRUPOS.primero, color: 0, priority: 'cercano' }],
    nextGroupId: 2,
    nextId: 1,
    manualHarvests: 0,
    log: [LOG.inicio],
    events: [],
  };
}

// ---------- Guardado ----------
// Solo se guarda el estado duradero. Lo que el gnomo estaba haciendo se descarta
// y al cargar vuelve a pensar; no se simula el tiempo que pasó fuera.

export const SAVE_VERSION = 3;

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
  plots: { crop: CropId; stage: number; t: number }[];
  gnomes: { id: number; name: string; job: JobId; group: number; x: number; y: number; carry: CropId[] }[];
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
    plots: s.plots.map(p => ({ crop: p.crop, stage: p.stage, t: p.t })),
    gnomes: s.gnomes.map(g => ({ id: g.id, name: g.name, job: g.job, group: g.group, x: g.x, y: g.y, carry: [...g.carry] })),
    log: s.log.slice(0, 15),
  };
}

const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const int = (v: unknown, def: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(num(v, def))));
const isCrop = (v: unknown): v is CropId => CROP_IDS.includes(v as CropId);
const isJob = (v: unknown): v is JobId => JOB_IDS.includes(v as JobId);

export function deserialize(raw: unknown, rng: Rng): GameState | null {
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== SAVE_VERSION) return null;
  const d = raw as Partial<SaveData>;
  const s = createState(rng);

  s.coins = Math.max(0, num(d.coins, 0));
  s.totalEarned = Math.max(0, num(d.totalEarned, 0));
  for (const id of NODE_IDS) s.tree[id] = int(d.tree?.[id], 0, 0, TREE[id].max);
  s.basket = Array.isArray(d.basket) ? d.basket.filter(isCrop) : [];
  s.nextId = Math.max(1, Math.floor(num(d.nextId, 1)));
  s.manualHarvests = Math.max(0, num(d.manualHarvests, 0));
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
      }));
    if (groups.length) s.groups = groups;
  }
  s.nextGroupId = Math.max(int(d.nextGroupId, 2, 1, 1e6), ...s.groups.map(g => g.id + 1));

  if (Array.isArray(d.plots) && d.plots.length === s.plots.length) {
    d.plots.forEach((p, i) => {
      const plot = s.plots[i];
      plot.crop = isCrop(p?.crop) ? p.crop : 'zanahoria';
      const stage = Math.floor(num(p?.stage, -1));
      plot.stage = stage >= -1 && stage <= RIPE ? stage : -1;
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
        const gn = makeGnome(id, g.name, g.job, group, num(g.x, 70), num(g.y, 120));
        gn.carry = Array.isArray(g.carry) ? g.carry.filter(isCrop) : [];
        return gn;
      });
    s.nextId = Math.max(s.nextId, ...s.gnomes.map(g => g.id + 1));
  }
  if (Array.isArray(d.log)) s.log = d.log.filter((l): l is string => typeof l === 'string').slice(0, 15);
  return s;
}
