// Informe de equilibrado: `npm run balance`. No comprueba nada; simula partidas y saca tablas en markdown.
import { test } from 'vitest';
import {
  BASKET, CARRETILLA_PER_LEVEL, CONSERVAS_PER_LEVEL, CROP_IDS, CROPS, DOOR, FIELD, HARVEST_TIME, HOUSE, IDLE_AREA, MAX_GNOMES,
  NODE_IDS, PICKUP_TIME, PLANT_TIME, PORTER_CAPACITY, RIPE, ROTTEN, TREE,
} from '../src/sim/config';
import {
  buyHouse, buyNode, capacity, clickPlot, cropUnlocked, cropValue, hasPorters, hire, hireCost, houseCapacity, houseCost,
  houseMaxed, isOpen, jobUnlocked, nodeCost, nodeMaxed, nodeReachable, plotStand, porterCapacity, setGroupSeed,
  setPriority, stageTime, tick, walkSpeed, workMult,
} from '../src/sim/sim';
import { createState } from '../src/sim/state';
import type { CropId, GameState, JobId, NodeId, Priority, Rng } from '../src/sim/types';

const SEED = 12345;
const DT = 0.1;
const STEPS_PER_MIN = Math.round(60 / DT);

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function table(head: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}

const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);
const minOr = (step: number | null) => (step === null ? 'nunca' : f1(step / STEPS_PER_MIN));

/** Avanza un paso; vacía los eventos de render para que no crezcan sin fin. */
function step(s: GameState, rng: Rng) {
  tick(s, DT, rng);
  s.events.length = 0;
}

// ---------- Elección de cultivo ----------

/** distancia típica entre dos parcelas maduras seguidas de la misma ronda del recolector */
const HOP_PX = FIELD.cell * 2;
/** descanso tras dejar la carga (granero o cesta) */
const REST_TIME = 0.3;

/**
 * Lo que haría un jugador sensato: cada cultivo da un ritmo de cosechas que es el menor de
 *   - lo que da el bancal: parcelas abiertas / ciclo de cada parcela. El ciclo es crecer (con abono) más la espera
 *     a que llegue un recolector y luego un sembrador (dos paseos desde donde haraganean, más recoger y plantar):
 *     con la zanahoria esa espera pesa casi tanto como crecer, con la calabaza no se nota,
 *   - lo que recogen los recolectores: cada uno hace viajes de ida y vuelta al punto de entrega (cesta si hay
 *     porteadores, granero si no) a la distancia media del bancal, recogiendo `capacity` plantas por viaje
 *     (saco), andando con las botas y trabajando con el café; si hay porteadores, también lo que vacían de la cesta,
 *   - lo que siembran los sembradores: plantar más un salto entre dos parcelas cualesquiera del bancal
 *     (1,5 × la distancia media al centro),
 * y los clics del jugador suman medio cultivo por clic a recoger y a sembrar (cada cultivo pide dos clics).
 * Se elige el cultivo desbloqueado con más (ritmo × valor de venta). Así la zanahoria gana con bancal pequeño y
 * gente de sobra, y la calabaza cuando faltan manos para tantos viajes.
 */
function chooseCrop(s: GameState, clicksPerSec: number): CropId {
  const speed = walkSpeed(s);
  const wm = workMult(s);
  const stands = s.plots.filter(p => isOpen(s, p)).map(plotStand);
  const meanDist = (x: number, y: number) => stands.reduce((a, st) => a + Math.hypot(st.x - x, st.y - y), 0) / stands.length;
  const centre = stands.reduce((a, st) => ({ x: a.x + st.x / stands.length, y: a.y + st.y / stands.length }), { x: 0, y: 0 });
  const latency = (2 * meanDist((IDLE_AREA.x0 + IDLE_AREA.x1) / 2, (IDLE_AREA.y0 + IDLE_AREA.y1) / 2)) / speed
    + (HARVEST_TIME + PLANT_TIME) * wm;
  const drop = hasPorters(s) ? BASKET : DOOR;
  const cap = capacity(s);
  const trip = (2 * meanDist(drop.x, drop.y)) / speed + REST_TIME + cap * HARVEST_TIME * wm + ((cap - 1) * HOP_PX) / speed;
  const player = clicksPerSec / 2;
  let harvest = (s.hired.recolector * cap) / trip + player;
  if (hasPorters(s)) {
    const porterTrip = (2 * Math.hypot(BASKET.x - DOOR.x, BASKET.y - DOOR.y)) / speed + PICKUP_TIME * wm + REST_TIME;
    harvest = Math.min(harvest, (s.hired.porteador * porterCapacity(s)) / porterTrip + player);
  }
  const plant = s.hired.sembrador / (PLANT_TIME * wm + (1.5 * meanDist(centre.x, centre.y)) / speed) + player;
  let best: CropId = 'zanahoria';
  let bestRate = -1;
  for (const c of CROP_IDS) {
    if (!cropUnlocked(s, c)) continue;
    const field = stands.length / (stageTime(s, c) * RIPE + latency);
    const rate = Math.min(field, harvest, plant) * cropValue(s, c);
    if (rate > bestRate) {
      bestRate = rate;
      best = c;
    }
  }
  return best;
}

// ---------- a) Ritmo ----------

interface Profile {
  name: string;
  clicksPerSec: number;
}

type Purchase = { cost: number; buy: () => boolean };

function purchaseOptions(s: GameState, rng: Rng): Purchase[] {
  const opts: Purchase[] = [];
  const job = (j: JobId) => opts.push({ cost: hireCost(s, j), buy: () => hire(s, j, rng) });
  if (s.gnomes.length < houseCapacity(s)) {
    job('recolector');
    if (s.hired.sembrador < Math.ceil(s.hired.recolector / 1.5)) job('sembrador');
    if (jobUnlocked(s, 'porteador') && s.hired.porteador < Math.floor(s.hired.recolector / 3)) job('porteador');
  } else if (!houseMaxed(s)) {
    opts.push({ cost: houseCost(s), buy: () => buyHouse(s) });
  }
  for (const id of NODE_IDS) {
    if (nodeReachable(s, id) && !nodeMaxed(s, id)) opts.push({ cost: nodeCost(s, id), buy: () => buyNode(s, id) });
  }
  return opts;
}

/** Compra lo más barato que se pueda pagar, una y otra vez, hasta que no llegue para nada. Devuelve cuántas compras. */
function shop(s: GameState, rng: Rng): number {
  for (let bought = 0; ; bought++) {
    const affordable = purchaseOptions(s, rng).filter(o => o.cost <= s.coins);
    if (!affordable.length) return bought;
    affordable.sort((a, b) => a.cost - b.cost);
    if (!affordable[0].buy()) return bought;
  }
}

/** Un clic del jugador: primero recoger, luego sembrar. Devuelve false si no había nada que hacer. */
function playerClick(s: GameState, crop: CropId): boolean {
  for (const p of s.plots) {
    if (p.stage === RIPE && p.res === null && isOpen(s, p)) return clickPlot(s, p.id, crop) !== null;
  }
  for (const p of s.plots) {
    if ((p.stage === -1 || p.stage === ROTTEN) && p.res === null && isOpen(s, p)) return clickPlot(s, p.id, crop) !== null;
  }
  return false;
}

const MILESTONES = [
  'automático', 'trigo', 'porteadores', 'tomate', 'conservas', 'carretilla', 'calabaza', 'mercado', 'bancal al máximo',
  'casa al máximo', `${MAX_GNOMES} gnomos`, 'árbol completo',
] as const;
type Milestone = (typeof MILESTONES)[number];

const milestoneReached = {
  'automático': s => s.hired.recolector >= 1 && s.hired.sembrador >= 1,
  trigo: s => s.tree.trigo > 0,
  porteadores: s => s.tree.porteadores > 0,
  tomate: s => s.tree.tomate > 0,
  conservas: s => s.tree.conservas > 0,
  carretilla: s => s.tree.carretilla > 0,
  calabaza: s => s.tree.calabaza > 0,
  mercado: s => s.tree.mercado > 0,
  'bancal al máximo': s => nodeMaxed(s, 'bancal'),
  'casa al máximo': s => houseMaxed(s),
  [`${MAX_GNOMES} gnomos`]: s => s.gnomes.length >= MAX_GNOMES,
  'árbol completo': s => NODE_IDS.every(id => nodeMaxed(s, id)),
} as Record<Milestone, (s: GameState) => boolean>;

interface Sample {
  step: number;
  earned: number;
  coins: number;
  gnomes: string;
  beds: number;
  bancal: number;
  crop: CropId;
  rotted: number;
}

interface RunResult {
  profile: Profile;
  milestones: Record<Milestone, number | null>;
  /** hueco más largo sin compras: [inicio, fin] en pasos */
  longestGap: [number, number];
  rottedPerMinEarly: number;
  coinsPerSecAt: number[];
  coinsPerSecTail: number;
  rotted: number;
  rottedPerMinTail: number;
  samples: Sample[];
}

const RUN_MIN = 180;
const TAIL_MIN = 30;
const SAMPLE_MIN = 15;
/** cada cuánto se repiensa el cultivo */
const CHOOSE_STEPS = 30 * Math.round(1 / DT);
/** los huecos sin compras se miden desde aquí (al principio se compra en cuanto se junta para algo) */
const GAP_FROM_MIN = 2;
/** los echados a perder por minuto se miden en estos primeros minutos */
const EARLY_MIN = 60;
/** monedas/s medidas en los WINDOW_MIN minutos que acaban en cada uno de estos minutos */
const RATE_AT_MIN = [30, 60];
const WINDOW_MIN = 5;

function runProfile(profile: Profile): RunResult {
  const rng = mulberry32(SEED);
  const s = createState(rng);
  const total = RUN_MIN * STEPS_PER_MIN;
  const tailStart = (RUN_MIN - TAIL_MIN) * STEPS_PER_MIN;
  const gapFrom = GAP_FROM_MIN * STEPS_PER_MIN;
  const clicksPerStep = profile.clicksPerSec * DT;
  const milestones = Object.fromEntries(MILESTONES.map(m => [m, null])) as Record<Milestone, number | null>;
  const samples: Sample[] = [];
  const earnedAt = new Map<number, number>();
  const rateMarks = new Set(RATE_AT_MIN.flatMap(m => [(m - WINDOW_MIN) * STEPS_PER_MIN, m * STEPS_PER_MIN]));
  let budget = 0;
  let crop: CropId = 'zanahoria';
  let tailEarned = 0;
  let tailRotted = 0;
  let rottedEarly = 0;
  let gapStart = gapFrom;
  let longestGap: [number, number] = [gapFrom, gapFrom];
  const closeGap = (end: number) => {
    if (end - gapStart > longestGap[1] - longestGap[0]) longestGap = [gapStart, end];
    gapStart = end;
  };

  const sample = (n: number) => samples.push({
    step: n,
    earned: s.totalEarned,
    coins: s.coins,
    gnomes: `${s.hired.recolector}/${s.hired.sembrador}/${s.hired.porteador}`,
    beds: houseCapacity(s),
    bancal: s.tree.bancal,
    crop,
    rotted: s.rotted,
  });

  for (let n = 0; n < total; n++) {
    if (n === tailStart) {
      tailEarned = s.totalEarned;
      tailRotted = s.rotted;
    }
    if (rateMarks.has(n)) earnedAt.set(n, s.totalEarned);
    if (n % CHOOSE_STEPS === 0) {
      const next = chooseCrop(s, profile.clicksPerSec);
      if (next !== crop || n === 0) setGroupSeed(s, s.groups[0].id, next);
      crop = next;
    }
    // presupuesto de clics; no se acumula más de uno (el jugador no guarda clics para luego)
    budget = Math.min(budget + clicksPerStep, Math.max(1, clicksPerStep));
    while (budget >= 1) {
      if (!playerClick(s, crop)) break;
      budget -= 1;
    }
    const done = milestones['árbol completo'] !== null;
    if (shop(s, rng) > 0 && n >= gapFrom && !done) closeGap(n);
    step(s, rng);
    for (const m of MILESTONES) if (milestones[m] === null && milestoneReached[m](s)) milestones[m] = n + 1;
    if (n + 1 === EARLY_MIN * STEPS_PER_MIN) rottedEarly = s.rotted;
    if ((n + 1) % (SAMPLE_MIN * STEPS_PER_MIN) === 0) sample(n + 1);
  }
  if (milestones['árbol completo'] === null) closeGap(total);

  return {
    profile,
    milestones,
    longestGap,
    rottedPerMinEarly: rottedEarly / EARLY_MIN,
    coinsPerSecAt: RATE_AT_MIN.map(m => {
      const end = m * STEPS_PER_MIN === total ? s.totalEarned : earnedAt.get(m * STEPS_PER_MIN)!;
      return (end - earnedAt.get((m - WINDOW_MIN) * STEPS_PER_MIN)!) / (WINDOW_MIN * 60);
    }),
    coinsPerSecTail: (s.totalEarned - tailEarned) / (TAIL_MIN * 60),
    rotted: s.rotted,
    rottedPerMinTail: (s.rotted - tailRotted) / TAIL_MIN,
    samples,
  };
}

const PROFILES: Profile[] = [
  { name: 'Activo (1 clic/s)', clicksPerSec: 1 },
  { name: 'Tranquilo (1 clic/5 s)', clicksPerSec: 0.2 },
];

test('a) Ritmo', () => {
  const results = PROFILES.map(runProfile);
  const out: string[] = [];
  out.push(`## a) Ritmo (${RUN_MIN} min de juego, dt = ${DT} s, semilla ${SEED})`, '');
  out.push(
    'El bot compra siempre lo más barato que pueda pagar (con la casa llena, ampliar la casa en vez de contratar) y',
    `cada ${CHOOSE_STEPS * DT} s siembra el cultivo con más (min(ritmo del bancal, de recolectores, de sembradores) × valor).`, '',
  );
  out.push('### Hitos (minuto en que se alcanzan)', '');
  out.push(table(
    ['Hito', ...results.map(r => r.profile.name)],
    MILESTONES.map(m => [m, ...results.map(r => minOr(r.milestones[m]))]),
  ));
  out.push('', '### Ritmo de compras y pérdidas', '');
  const gap = (r: RunResult) =>
    `**${f1((r.longestGap[1] - r.longestGap[0]) / STEPS_PER_MIN)}** (min ${f1(r.longestGap[0] / STEPS_PER_MIN)}–${f1(r.longestGap[1] / STEPS_PER_MIN)})`;
  out.push(table(
    ['Medida', ...results.map(r => r.profile.name)],
    [
      [`hueco más largo sin compras (min, desde el min ${GAP_FROM_MIN} hasta el árbol completo)`, ...results.map(gap)],
      [`echados a perder/min (min 0–${EARLY_MIN})`, ...results.map(r => f2(r.rottedPerMinEarly))],
      ...RATE_AT_MIN.map((m, i) => [`monedas/s en el min ${m} (media de los ${WINDOW_MIN} min anteriores)`, ...results.map(r => f2(r.coinsPerSecAt[i]))]),
    ],
  ));
  out.push('', `### Estado estable (últimos ${TAIL_MIN} min)`, '');
  out.push(table(
    ['Perfil', 'monedas/s', 'echados a perder (total)', `echados a perder/min (últimos ${TAIL_MIN} min)`],
    results.map(r => [r.profile.name, f2(r.coinsPerSecTail), r.rotted, f2(r.rottedPerMinTail)]),
  ));
  for (const r of results) {
    out.push('', `### Evolución: ${r.profile.name}`, '');
    let prev = { step: 0, earned: 0 };
    const rows = r.samples.map(x => {
      const rate = (x.earned - prev.earned) / ((x.step - prev.step) * DT);
      prev = x;
      return [f1(x.step / STEPS_PER_MIN), Math.round(x.earned), Math.round(x.coins), f2(rate), x.gnomes, x.beds, x.bancal, x.crop, x.rotted];
    });
    out.push(table(['min', 'ganado total', 'monedas', 'monedas/s (tramo)', 'rec/sem/port', 'camas', 'bancal', 'sembrando', 'echados a perder'], rows));
  }
  console.log(`\n${out.join('\n')}\n`);
});

// ---------- b), c) y e): bancal completo ----------

function fullField(
  rng: Rng, rec: number, sem: number, cropOf: (col: number) => CropId, upgrades: Partial<Record<NodeId, number>> = {},
): GameState {
  const s = createState(rng);
  s.tree.bancal = TREE.bancal.max;
  s.tree.trigo = 1;
  s.tree.tomate = 1;
  s.tree.calabaza = 1;
  Object.assign(s.tree, upgrades);
  s.house = HOUSE.max;
  for (const p of s.plots) {
    p.crop = cropOf(p.col);
    p.stage = isOpen(s, p) ? 0 : -1;
    p.t = 0;
    p.res = null;
  }
  s.coins = 1e12;
  for (let i = 0; i < rec; i++) hire(s, 'recolector', rng);
  for (let i = 0; i < sem; i++) hire(s, 'sembrador', rng);
  s.coins = 0;
  s.totalEarned = 0;
  setGroupSeed(s, s.groups[0].id, null);
  return s;
}

const PRIOS: Priority[] = ['cercano', 'valioso', 'urgente'];
const STAFFING = [
  { rec: 2, sem: 2 },
  { rec: 6, sem: 4 },
  { rec: 12, sem: 8 },
  { rec: 24, sem: 12 },
];
const PRIO_MIN = 10;

test('b) Prioridades', () => {
  const rows: (string | number)[][] = [];
  for (const st of STAFFING) {
    for (const prio of PRIOS) {
      const rng = mulberry32(SEED);
      const s = fullField(rng, st.rec, st.sem, col => CROP_IDS[col % CROP_IDS.length]);
      setPriority(s, s.groups[0].id, prio);
      for (let n = 0; n < PRIO_MIN * STEPS_PER_MIN; n++) step(s, rng);
      const waiting = s.plots.filter(p => isOpen(s, p) && p.stage === RIPE).length;
      rows.push([`${st.rec} rec + ${st.sem} sem`, prio, f2(s.totalEarned / (PRIO_MIN * 60)), s.rotted, waiting]);
    }
  }
  const out = [
    `## b) Prioridades (bancal al máximo, cultivos por columna, ${PRIO_MIN} min, sin clics)`, '',
    table(['Plantilla', 'Prioridad', 'monedas/s', 'echados a perder', 'maduras esperando'], rows),
  ];
  console.log(`\n${out.join('\n')}\n`);
});

const SEED_MIN = 15;
const SEED_TARGET = 0.9;

test('c) Semilla por grupo', () => {
  const rng = mulberry32(SEED);
  const s = fullField(rng, 6, 4, () => 'zanahoria');
  setGroupSeed(s, s.groups[0].id, 'calabaza');
  const open = s.plots.filter(p => isOpen(s, p));
  const share = () => open.filter(p => p.crop === 'calabaza').length / open.length;
  let reached: number | null = null;
  const marks: (string | number)[][] = [];
  for (let n = 0; n < SEED_MIN * STEPS_PER_MIN; n++) {
    step(s, rng);
    if (reached === null && share() >= SEED_TARGET) reached = n + 1;
    if ((n + 1) % STEPS_PER_MIN === 0) marks.push([(n + 1) / STEPS_PER_MIN, `${Math.round(share() * 100)} %`]);
  }
  const out = [
    `## c) Semilla por grupo (6 rec + 4 sem, todo zanahoria → semilla «calabaza», sin clics)`, '',
    `Minutos hasta ≥${SEED_TARGET * 100} % de las ${open.length} parcelas en calabaza: **${minOr(reached)}**${reached === null ? ` (en ${SEED_MIN} min)` : ''}`, '',
    table(['min', 'parcelas de calabaza'], marks),
  ];
  console.log(`\n${out.join('\n')}\n`);
});

// ---------- d) Cultivos ----------

test('d) Cultivos', () => {
  const sacoMax = 1 + TREE.saco.max;
  const porterMax = PORTER_CAPACITY + CARRETILLA_PER_LEVEL * TREE.carretilla.max;
  const rows = CROP_IDS.map(c => {
    const d = CROPS[c];
    return [
      c, d.value, d.grow, d.keep, f1(d.keep * (1 + CONSERVAS_PER_LEVEL * TREE.conservas.max)), f2(d.value / d.grow),
      d.value, d.value * sacoMax, d.value * PORTER_CAPACITY, d.value * porterMax,
    ];
  });
  const out = [
    '## d) Cultivos (valores base, sin mercado ni abono)', '',
    table(
      ['Cultivo', 'valor', 'crece (s)', 'aguanta (s)', `aguanta (s, conservas ${TREE.conservas.max})`, 'monedas/s por parcela',
        'monedas por viaje (recolector, saco 0)', `monedas por viaje (recolector, saco ${TREE.saco.max})`,
        'monedas por viaje (porteador)', `monedas por viaje (porteador, carretilla ${TREE.carretilla.max})`],
      rows,
    ),
  ];
  console.log(`\n${out.join('\n')}\n`);
});

// ---------- e) El mejor cultivo según la plantilla ----------

const BEST_UPGRADES: Partial<Record<NodeId, number>> = { botas: 2, cafe: 2, saco: 2, abono: 2 };
const BEST_STAFFING = [
  { rec: 2, sem: 2 },
  { rec: 4, sem: 3 },
  { rec: 8, sem: 5 },
  { rec: 12, sem: 8 },
  { rec: 20, sem: 12 },
  { rec: 28, sem: 12 },
];
const BEST_MIN = 10;

test('e) El mejor cultivo según la plantilla', () => {
  const rateRows: (string | number)[][] = [];
  const rotRows: (string | number)[][] = [];
  for (const st of BEST_STAFFING) {
    const rates: number[] = [];
    const rots: number[] = [];
    let pick: CropId = 'zanahoria';
    for (const c of CROP_IDS) {
      const rng = mulberry32(SEED);
      const s = fullField(rng, st.rec, st.sem, () => c, BEST_UPGRADES);
      if (c === CROP_IDS[0]) pick = chooseCrop(s, 0);
      for (let n = 0; n < BEST_MIN * STEPS_PER_MIN; n++) step(s, rng);
      const harvested = s.gnomes.reduce((a, g) => a + g.stats.harvests, 0);
      rates.push(s.totalEarned / (BEST_MIN * 60));
      rots.push(harvested + s.rotted ? (100 * s.rotted) / (harvested + s.rotted) : 0);
    }
    const best = rates.indexOf(Math.max(...rates));
    const label = `${st.rec} rec + ${st.sem} sem`;
    rateRows.push([label, ...rates.map((r, i) => (i === best ? `**${f2(r)}**` : f2(r))), pick]);
    rotRows.push([label, ...rots.map(r => `${f1(r)} %`)]);
  }
  const ups = Object.entries(BEST_UPGRADES).map(([k, v]) => `${k} ${v}`).join(', ');
  const out = [
    `## e) El mejor cultivo según la plantilla (bancal ${FIELD.maxCols}×${FIELD.maxRows} de un solo cultivo, ${ups}, sin porteadores, ${BEST_MIN} min, sin clics)`, '',
    '### monedas/s (en negrita, el mejor de la fila)', '',
    table(['Plantilla', ...CROP_IDS, 'elegiría el bot'], rateRows),
    '', '### % echado a perder (de lo que llegó a madurar)', '',
    table(['Plantilla', ...CROP_IDS], rotRows),
  ];
  console.log(`\n${out.join('\n')}\n`);
});
