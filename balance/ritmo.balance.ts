// Informe de equilibrado: `npm run balance`. No comprueba nada; simula partidas y saca tablas en markdown.
import { test } from 'vitest';
import {
  BASKET, CARRETILLA_PER_LEVEL, CONSERVAS_PER_LEVEL, CROP_IDS, CROPS, DOOR, FIELD, HARVEST_TIME, HOUSE, IDLE_AREA, MAX_GNOMES,
  JOB_NODE, NODE_IDS, PICKUP_TIME, PLANT_TIME, PORTER_CAPACITY, PRESTIGE, RIPE, ROTTEN, TALENT_IDS, TREE, WATER, WELL,
} from '../src/sim/config';
import {
  buyHouse, buyNode, buyTalent, canEndSeason, capacity, clickPlot, cropsEaten, cropUnlocked, cropValue, endSeason, hasPorters, hire,
  hireCost, houseCapacity, houseCost, houseMaxed, isOpen, jobUnlocked, nodeCost, nodeMaxed, nodeReachable, plotStand,
  porterCapacity, seasonSeeds, setGroupSeed, setPriority, stageTime, startEvent, talentCost, talentMaxed, talentReachable, tick,
  walkSpeed, waterTime, waterWork, workMult,
} from '../src/sim/sim';
import { createState } from '../src/sim/state';
import type { CropId, GameState, JobId, MomentKind, NodeId, Priority, Rng, TalentId } from '../src/sim/types';

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

/** gnomos de un oficio; con talentos no coincide con `hired` (los gratis no cuentan para el precio) */
const staff = (s: GameState, j: JobId) => s.gnomes.filter(g => g.job === j).length;

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
  let harvest = (staff(s, 'recolector') * cap) / trip + player;
  if (hasPorters(s)) {
    const porterTrip = (2 * Math.hypot(BASKET.x - DOOR.x, BASKET.y - DOOR.y)) / speed + PICKUP_TIME * wm + REST_TIME;
    harvest = Math.min(harvest, (staff(s, 'porteador') * porterCapacity(s)) / porterTrip + player);
  }
  const plant = staff(s, 'sembrador') / (PLANT_TIME * wm + (1.5 * meanDist(centre.x, centre.y)) / speed) + player;
  // riegos por segundo de los regadores: ir de una parcela a otra y regar, más el viaje al pozo cada WATER.can riegos
  const well = { x: WELL.x + WELL.w / 2, y: WELL.y + WELL.h + 2 };
  const waterHop = (1.5 * meanDist(centre.x, centre.y)) / speed + waterWork(s) * wm;
  const refill = ((2 * meanDist(well.x, well.y)) / speed + WATER.refill * wm) / WATER.can;
  const waterings = staff(s, 'regador') / (waterHop + refill);
  let best: CropId = 'zanahoria';
  let bestRate = -1;
  for (const c of CROP_IDS) {
    if (!cropUnlocked(s, c)) continue;
    // parte del crecimiento que pasa regado: cada riego cubre su duración (o lo que le queda por crecer pasado
    // el umbral WATER.low, por debajo del cual el regador ya no riega)
    const grow = stageTime(s, c) * RIPE;
    const wetShare = Math.min(1, (waterings * Math.max(0, Math.min(waterTime(s), grow - WATER.low))) / stands.length);
    const speedUp = wetShare * WATER.boost + (1 - wetShare) * (CROPS[c].thirsty ? WATER.dry : 1);
    const field = stands.length / (grow / speedUp + latency);
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
    const rec = staff(s, 'recolector');
    job('recolector');
    if (staff(s, 'sembrador') < Math.ceil(rec / 1.5)) job('sembrador');
    if (jobUnlocked(s, 'porteador') && staff(s, 'porteador') < Math.floor(rec / 3)) job('porteador');
    // un regador por cada 5 recolectores en cuanto hay algún cultivo con sed que sembrar
    const thirsty = CROP_IDS.some(c => CROPS[c].thirsty && cropUnlocked(s, c));
    if (jobUnlocked(s, 'regador') && thirsty && staff(s, 'regador') < Math.floor(rec / 5)) job('regador');
    // un guardián en cuanto se puede (dos con el huerto grande)
    if (jobUnlocked(s, 'guardian') && staff(s, 'guardian') < (rec >= 20 ? 2 : 1)) job('guardian');
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

/** nodos del árbol que son hito por sí mismos (el minuto en que se compra el primer nivel) */
const NODE_MILESTONES = [
  'trigo', 'fresa', 'porteadores', 'guardianes', 'regadores', 'tomate', 'conservas', 'carretilla', 'calabaza', 'mercado',
  'melon',
] as const satisfies readonly NodeId[];
const MILESTONES = [
  'automático', ...NODE_MILESTONES, 'primer regador', 'primer guardián', 'bancal al máximo', 'casa al máximo',
  `${MAX_GNOMES} gnomos`, 'árbol completo',
] as const;
type Milestone = (typeof MILESTONES)[number];

const milestoneReached = {
  'automático': s => s.hired.recolector >= 1 && s.hired.sembrador >= 1,
  ...Object.fromEntries(NODE_MILESTONES.map(id => [id, (s: GameState) => s.tree[id] > 0])),
  'primer regador': s => s.hired.regador > 0,
  'primer guardián': s => s.hired.guardian > 0,
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
    gnomes: `${s.hired.recolector}/${s.hired.sembrador}/${s.hired.porteador}/${s.hired.regador}/${s.hired.guardian}`,
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
    out.push(table(['min', 'ganado total', 'monedas', 'monedas/s (tramo)', 'rec/sem/port/reg/guard', 'camas', 'bancal', 'sembrando', 'echados a perder'], rows));
  }
  console.log(`\n${out.join('\n')}\n`);
});

// ---------- b), c) y e): bancal completo ----------

/** Bancal al máximo con todos los cultivos desbloqueados. `extra`: otros oficios (desbloquea lo que haga falta). */
function fullField(
  rng: Rng, rec: number, sem: number, cropOf: (col: number) => CropId, upgrades: Partial<Record<NodeId, number>> = {},
  extra: Partial<Record<JobId, number>> = {},
): GameState {
  const s = createState(rng);
  s.tree.bancal = TREE.bancal.max;
  for (const c of CROP_IDS) if (c !== 'zanahoria') s.tree[c] = 1;
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
  for (const [job, n] of Object.entries(extra) as [JobId, number][]) {
    const node = JOB_NODE[job];
    if (node) s.tree[node] = Math.max(1, s.tree[node]);
    for (let i = 0; i < n; i++) hire(s, job, rng);
  }
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
  { rec: 26, sem: 12 },
];
const BEST_MIN = 10;

/** variantes de cada plantilla: tal cual y con regadores (que es lo que pide el melón) */
const BEST_VARIANTS: { name: string; extra: Partial<Record<JobId, number>>; upgrades: Partial<Record<NodeId, number>> }[] = [
  { name: '', extra: {}, upgrades: {} },
  { name: ' + 2 reg', extra: { regador: 2 }, upgrades: {} },
  { name: ' + 4 reg', extra: { regador: 4 }, upgrades: {} },
];

test('e) El mejor cultivo según la plantilla', () => {
  const rateRows: (string | number)[][] = [];
  const rotRows: (string | number)[][] = [];
  const wins = new Map<CropId, number>();
  for (const st of BEST_STAFFING) {
    for (const v of BEST_VARIANTS) {
      const rates: number[] = [];
      const rots: number[] = [];
      // la casa no da para más de MAX_GNOMES: esa variante no se puede montar
      if (st.rec + st.sem + Object.values(v.extra).reduce((a, n) => a + n, 0) > MAX_GNOMES) continue;
      let pick: CropId = 'zanahoria';
      for (const c of CROP_IDS) {
        const rng = mulberry32(SEED);
        const s = fullField(rng, st.rec, st.sem, () => c, { ...BEST_UPGRADES, ...v.upgrades }, v.extra);
        if (c === CROP_IDS[0]) pick = chooseCrop(s, 0);
        for (let n = 0; n < BEST_MIN * STEPS_PER_MIN; n++) step(s, rng);
        const harvested = s.gnomes.reduce((a, g) => a + g.stats.harvests, 0);
        rates.push(s.totalEarned / (BEST_MIN * 60));
        rots.push(harvested + s.rotted ? (100 * s.rotted) / (harvested + s.rotted) : 0);
      }
      const best = rates.indexOf(Math.max(...rates));
      wins.set(CROP_IDS[best], (wins.get(CROP_IDS[best]) ?? 0) + 1);
      const label = `${st.rec} rec + ${st.sem} sem${v.name}`;
      rateRows.push([label, ...rates.map((r, i) => (i === best ? `**${f2(r)}**` : f2(r))), pick]);
      rotRows.push([label, ...rots.map(r => `${f1(r)} %`)]);
    }
  }
  const ups = Object.entries(BEST_UPGRADES).map(([k, v]) => `${k} ${v}`).join(', ');
  const out = [
    `## e) El mejor cultivo según la plantilla (bancal ${FIELD.maxCols}×${FIELD.maxRows} de un solo cultivo, ${ups}, sin porteadores, ${BEST_MIN} min, sin clics)`, '',
    '### monedas/s (en negrita, el mejor de la fila)', '',
    table(['Plantilla', ...CROP_IDS, 'elegiría el bot'], rateRows),
    '', `Filas que gana cada cultivo: ${CROP_IDS.map(c => `${c} ${wins.get(c) ?? 0}`).join(', ')}`,
    '', '### % echado a perder (de lo que llegó a madurar)', '',
    table(['Plantilla', ...CROP_IDS], rotRows),
  ];
  console.log(`\n${out.join('\n')}\n`);
});

// ---------- f) Vida en el huerto ----------

const LIFE_STAFFING = [
  { name: '2 rec + 2 sem (principio, bancal 3×3)', rec: 2, sem: 2, por: 0, bancal: 0 },
  { name: '6 rec + 4 sem (bancal 5×5)', rec: 6, sem: 4, por: 0, bancal: 4 },
  { name: '20 rec + 14 sem + 6 port (bancal al máximo)', rec: 20, sem: 14, por: 6, bancal: TREE.bancal.max },
];
const LIFE_MIN = 10;

/**
 * Cuenta los «momentos» (algo llamativo que empieza en pantalla) en LIFE_MIN minutos sin tocar nada.
 * Los huecos se miden entre instantes distintos con algún momento, contando desde el principio y hasta el final.
 * Objetivo: hueco medio ≤ 15 s, máximo ≤ 30 s, y ningún tipo de momento por encima del 40 %.
 */
test('f) Vida en el huerto', () => {
  const kinds = new Map<MomentKind, number[]>();
  const rows: (string | number)[][] = [];
  LIFE_STAFFING.forEach((st, col) => {
    const rng = mulberry32(SEED);
    const s = fullField(rng, st.rec, st.sem, c => CROP_IDS[c % CROP_IDS.length]);
    s.tree.bancal = st.bancal;
    for (const p of s.plots) if (!isOpen(s, p)) p.stage = -1;
    s.tree.porteadores = st.por ? 1 : 0;
    s.coins = 1e12;
    for (let i = 0; i < st.por; i++) hire(s, 'porteador', rng);
    s.coins = 0;
    const times: number[] = [];
    let total = 0;
    const count = new Map<MomentKind, number>();
    for (let n = 0; n < LIFE_MIN * STEPS_PER_MIN; n++) {
      tick(s, DT, rng);
      for (const e of s.events) {
        if (e.type !== 'moment') continue;
        total++;
        count.set(e.kind, (count.get(e.kind) ?? 0) + 1);
        if (times[times.length - 1] !== n) times.push(n);
      }
      s.events.length = 0;
    }
    const marks = [0, ...times.map(n => n * DT), LIFE_MIN * 60];
    const gaps = marks.slice(1).map((t, i) => t - marks[i]);
    const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
    rows.push([
      st.name, f1(total / LIFE_MIN), f1(gaps.reduce((a, g) => a + g, 0) / gaps.length), f1(Math.max(...gaps)),
      top ? `${top[0]} ${Math.round((100 * top[1]) / total)} %` : '—', count.size,
    ]);
    for (const [k, v] of count) {
      if (!kinds.has(k)) kinds.set(k, LIFE_STAFFING.map(() => 0));
      kinds.get(k)![col] = v;
    }
  });
  const kindRows = [...kinds.entries()]
    .sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0))
    .map(([k, v]) => [k, ...v]);
  const out = [
    `## f) Vida en el huerto (bancal de cultivos mezclados por columna, ${LIFE_MIN} min, sin clics)`, '',
    'Objetivo: hueco medio ≤ 15 s, hueco máximo ≤ 30 s, el tipo más común ≤ 40 %.', '',
    table(['Plantilla', 'momentos/min', 'hueco medio (s)', 'hueco máximo (s)', 'el más común', 'tipos distintos'], rows),
    '', '### Momentos por tipo', '',
    table(['Momento', ...LIFE_STAFFING.map(st => st.name)], kindRows),
  ];
  console.log(`\n${out.join('\n')}\n`);
});

// ---------- g) Regador y guardián ----------

const GH_MIN = 10;
const mixedCrops = (col: number) => CROP_IDS[col % CROP_IDS.length];
const pct0 = (f: number) => `${Math.round(f * 100)} %`;
/** cada cuánto baja un cuervo y asoma un topo en la prueba del guardián (los sucesos normales también siguen) */
const CROW_EVERY = 10;
const MOLE_EVERY = 15;

test('g) Regador y guardián', () => {
  // regadores: mismo bancal y plantilla, con y sin ellos
  const waterRows: (string | number)[][] = [];
  for (const field of [{ name: 'mezclado', cropOf: mixedCrops }, { name: 'solo melón', cropOf: (): CropId => 'melon' }]) {
    for (const reg of [0, 2]) {
      const rng = mulberry32(SEED);
      const s = fullField(rng, 12, 8, field.cropOf, BEST_UPGRADES, { regador: reg });
      const value = new Map<CropId, number>();
      for (let n = 0; n < GH_MIN * STEPS_PER_MIN; n++) {
        tick(s, DT, rng);
        for (const e of s.events) if (e.type === 'harvest') value.set(e.crop, (value.get(e.crop) ?? 0) + CROPS[e.crop].value);
        s.events.length = 0;
      }
      const total = [...value.values()].reduce((a, v) => a + v, 0);
      const thirsty = CROP_IDS.filter(c => CROPS[c].thirsty).reduce((a, c) => a + (value.get(c) ?? 0), 0);
      waterRows.push([field.name, reg, f2(s.totalEarned / (GH_MIN * 60)), total ? pct0(thirsty / total) : '—', pct0(s.org.parts.riego)]);
    }
  }
  // guardián: cuervos y topos a menudo
  const guardRows: (string | number)[][] = [];
  for (const st of [{ rec: 0, sem: 0 }, { rec: 4, sem: 3 }, { rec: 12, sem: 8 }]) {
    for (const guard of [0, 1]) {
      const rng = mulberry32(SEED);
      const s = fullField(rng, st.rec, st.sem, mixedCrops, BEST_UPGRADES, { regador: 2, guardian: guard });
      let interrupted = 0;
      let moleTime = 0;
      for (let n = 0; n < GH_MIN * STEPS_PER_MIN; n++) {
        if (n % Math.round(CROW_EVERY / DT) === 0) startEvent(s, 'cuervo', rng);
        if (n % Math.round(MOLE_EVERY / DT) === 0) startEvent(s, 'topo', rng);
        const before = new Set(s.gnomes.filter(g => g.task?.kind === 'shoo').map(g => g.id));
        step(s, rng);
        interrupted += s.gnomes.filter(g => g.job !== 'guardian' && g.task?.kind === 'shoo' && !before.has(g.id)).length;
        moleTime += s.critters.filter(c => c.kind === 'topo' && c.state !== 'out').length * DT;
      }
      guardRows.push([
        st.rec ? `${st.rec} rec + ${st.sem} sem + 2 reg` : 'solo 2 reg (nadie libre)', guard, cropsEaten(s), interrupted,
        Math.round(moleTime), f2(s.totalEarned / (GH_MIN * 60)),
      ]);
    }
  }
  const out = [
    `## g) Regador y guardián (bancal al máximo, ${Object.entries(BEST_UPGRADES).map(([k, v]) => `${k} ${v}`).join(', ')}, ${GH_MIN} min, sin clics)`, '',
    '### Regadores (12 rec + 8 sem)', '',
    table(['Bancal', 'regadores', 'monedas/s', 'parte del valor cosechado en cultivos con sed', 'riego (org)'], waterRows),
    '', `### Guardián (un cuervo cada ${CROW_EVERY} s y un topo cada ${MOLE_EVERY} s)`, '',
    table(['Plantilla', 'guardianes', 'cultivos comidos', 'veces que otro gnomo dejó su trabajo para espantar', 's de parcela con topo', 'monedas/s'], guardRows),
  ];
  console.log(`\n${out.join('\n')}\n`);
});

// ---------- h) Organización ----------

const ORG_SETUPS: {
  name: string; rec: number; sem: number; cropOf: (col: number) => CropId;
  upgrades: Partial<Record<NodeId, number>>; extra: Partial<Record<JobId, number>>;
}[] = [
  {
    name: 'bien llevado: 12 rec + 8 sem + 4 port + 2 reg + 1 guard, cesta 1, carretilla 1', rec: 12, sem: 8, cropOf: mixedCrops,
    upgrades: { ...BEST_UPGRADES, cesta: 1, carretilla: 1 }, extra: { porteador: 4, regador: 2, guardian: 1 },
  },
  {
    name: 'regular: 12 rec + 3 sem + 2 port, sin regadores', rec: 12, sem: 3, cropOf: mixedCrops,
    upgrades: BEST_UPGRADES, extra: { porteador: 2 },
  },
  {
    name: 'mal llevado (atasco en la cesta): 20 rec + 4 sem + 1 port, cesta 0, zanahoria, fresa y tomate sin regar', rec: 20, sem: 4,
    cropOf: col => (['zanahoria', 'fresa', 'tomate'] as const)[col % 3], upgrades: BEST_UPGRADES, extra: { porteador: 1 },
  },
  {
    name: 'mal llevado (sin sembradores): 16 rec + 1 port, zanahoria, fresa y tomate sin regar', rec: 16, sem: 0,
    cropOf: col => (['zanahoria', 'fresa', 'tomate'] as const)[col % 3], upgrades: BEST_UPGRADES, extra: { porteador: 1 },
  },
];

test('h) Organización', () => {
  const rows = ORG_SETUPS.map(o => {
    const rng = mulberry32(SEED);
    const s = fullField(rng, o.rec, o.sem, o.cropOf, o.upgrades, o.extra);
    for (let n = 0; n < GH_MIN * STEPS_PER_MIN; n++) step(s, rng);
    const p = s.org.parts;
    return [o.name, `**×${f2(s.org.mult)}**`, pct0(p.cosecha), pct0(p.cesta), pct0(p.siembra), pct0(p.riego), f2(s.totalEarned / (GH_MIN * 60))];
  });
  const out = [
    `## h) Organización (bancal al máximo, ${GH_MIN} min, sin clics; el multiplicador y sus partes al final)`, '',
    'Objetivo: que se separen a simple vista (bien llevado ≥ ×1,20; mal llevado ≤ ×1,08). La peor parte pesa la mitad,',
    'así que un solo cuello de botella baja el multiplicador aunque el resto vaya bien.', '',
    table(['Huerto', 'multiplicador', 'cosecha', 'cesta', 'siembra', 'riego', 'monedas/s'], rows),
  ];
  console.log(`\n${out.join('\n')}\n`);
});

// ---------- i) Temporadas ----------

const SEASONS = 3;
/** el bot acaba la temporada al completar el árbol, o aquí si no llega */
const SEASON_CAP_MIN = 90;
/** semillas que daría acabar la primera temporada en estos minutos */
const SEED_MARKS_MIN = [30, 45, 65, 90];

interface SeasonRun {
  treeStep: number | null;
  endStep: number;
  /** primer paso en que se puede acabar la temporada */
  canEndStep: number | null;
  /** ganado en la temporada y semillas que daría, al final de cada minuto */
  byMinute: { earned: number; seeds: number }[];
}

/** Juega una temporada como el bot de a) (clics, cultivo y compras); con `stopAtTree` para al completar el árbol. */
function playSeason(s: GameState, rng: Rng, profile: Profile, capMin: number, stopAtTree: boolean): SeasonRun {
  const clicksPerStep = profile.clicksPerSec * DT;
  const run: SeasonRun = { treeStep: null, endStep: 0, canEndStep: null, byMinute: [{ earned: 0, seeds: 0 }] };
  let budget = 0;
  let crop: CropId = 'zanahoria';
  for (let n = 0; n < capMin * STEPS_PER_MIN; n++) {
    if (n % CHOOSE_STEPS === 0) {
      const next = chooseCrop(s, profile.clicksPerSec);
      if (next !== crop || n === 0) setGroupSeed(s, s.groups[0].id, next);
      crop = next;
    }
    budget = Math.min(budget + clicksPerStep, Math.max(1, clicksPerStep));
    while (budget >= 1) {
      if (!playerClick(s, crop)) break;
      budget -= 1;
    }
    shop(s, rng);
    step(s, rng);
    run.endStep = n + 1;
    if (run.canEndStep === null && canEndSeason(s)) run.canEndStep = n + 1;
    if ((n + 1) % STEPS_PER_MIN === 0) run.byMinute.push({ earned: s.totalEarned, seeds: seasonSeeds(s) });
    if (run.treeStep === null && NODE_IDS.every(id => nodeMaxed(s, id))) {
      run.treeStep = n + 1;
      if (stopAtTree) break;
    }
  }
  return run;
}

/** Gasta las semillas en el talento más barato que pueda pagar (a igual precio, el primero de TALENT_IDS), una y otra vez. */
function spendSeeds(s: GameState): TalentId[] {
  const bought: TalentId[] = [];
  for (;;) {
    const opts = TALENT_IDS.filter(id => talentReachable(s, id) && !talentMaxed(s, id) && talentCost(s, id) <= s.prestige.goldenSeeds);
    if (!opts.length) return bought;
    opts.sort((a, b) => talentCost(s, a) - talentCost(s, b));
    buyTalent(s, opts[0]);
    bought.push(opts[0]);
  }
}

const talentList = (levels: Partial<Record<TalentId, number>>) =>
  TALENT_IDS.filter(id => levels[id]).map(id => `${id} ${levels[id]}`).join(' · ') || '—';

test('i) Temporadas', () => {
  const profile = PROFILES[0];
  // la primera temporada, alargada, para ver lo que cunde esperar
  const rngA = mulberry32(SEED);
  const long = playSeason(createState(rngA), rngA, profile, Math.max(...SEED_MARKS_MIN), false);

  const rng = mulberry32(SEED);
  let s = createState(rng);
  const rows: (string | number)[][] = [];
  for (let k = 1; k <= SEASONS; k++) {
    const start = talentList(s.prestige.talents);
    const r = playSeason(s, rng, profile, SEASON_CAP_MIN, true);
    const seeds = seasonSeeds(s);
    const earned = s.totalEarned;
    s = endSeason(s, rng);
    const bought = spendSeeds(s);
    const counts: Partial<Record<TalentId, number>> = {};
    for (const id of bought) counts[id] = (counts[id] ?? 0) + 1;
    rows.push([
      k, start, minOr(r.treeStep), f1(r.endStep / STEPS_PER_MIN), minOr(r.canEndStep), Math.round(earned), `**${seeds}**`,
      talentList(counts), s.prestige.goldenSeeds,
    ]);
  }
  const out = [
    `## i) Temporadas (${profile.name}, ${SEASONS} temporadas seguidas)`, '',
    `El bot juega como en a) hasta completar el árbol (como mucho ${SEASON_CAP_MIN} min), acaba la temporada y gasta las`,
    'semillas en el talento más barato que pueda pagar, una y otra vez.',
    `Semillas = floor((ganado / ${PRESTIGE.seedUnit}) ^ ${PRESTIGE.seedPow}); para acabar hacen falta ${PRESTIGE.minSeeds}.`,
    'Objetivo: temporada 1 con el árbol en 60–75 min y 10–15 semillas; la 2 en ≤ 45–50 min; la 3, más rápida aún;',
    'se puede acabar la primera hacia el min 30–40.', '',
    table(
      ['temporada', 'talentos al empezar', 'árbol completo (min)', 'fin (min)', 'se puede acabar desde (min)', 'ganado', 'semillas', 'compra al acabar', 'semillas sobrantes'],
      rows,
    ),
    '', `### Semillas si se acaba la temporada 1 en el minuto… (se puede desde el min ${minOr(long.canEndStep)}; árbol completo en el ${minOr(long.treeStep)})`, '',
    table(['min', 'ganado', 'semillas'], SEED_MARKS_MIN.map(m => [m, Math.round(long.byMinute[m].earned), long.byMinute[m].seeds])),
  ];
  console.log(`\n${out.join('\n')}\n`);
});
