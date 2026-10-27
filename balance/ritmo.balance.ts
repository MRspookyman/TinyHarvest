// Informe de equilibrado: `npm run balance`. No comprueba nada; simula partidas y saca tablas en markdown.
import { test } from 'vitest';
import { CROP_IDS, CROPS, MAX_GNOMES, NODE_IDS, PORTER_CAPACITY, RIPE, ROTTEN, TREE } from '../src/sim/config';
import {
  buyNode, clickPlot, cropUnlocked, hire, hireCost, isOpen, jobUnlocked, nodeCost, nodeMaxed, nodeReachable,
  setGroupSeed, setPriority, tick,
} from '../src/sim/sim';
import { createState } from '../src/sim/state';
import type { CropId, GameState, JobId, Priority, Rng } from '../src/sim/types';

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

const bestCrop = (s: GameState): CropId => {
  let best: CropId = 'zanahoria';
  for (const c of CROP_IDS) if (cropUnlocked(s, c) && CROPS[c].value > CROPS[best].value) best = c;
  return best;
};

// ---------- a) Ritmo ----------

interface Profile {
  name: string;
  clicksPerSec: number;
}

type Purchase = { cost: number; buy: () => boolean };

function purchaseOptions(s: GameState, rng: Rng): Purchase[] {
  const opts: Purchase[] = [];
  const job = (j: JobId) => opts.push({ cost: hireCost(s, j), buy: () => hire(s, j, rng) });
  if (s.gnomes.length < MAX_GNOMES) {
    job('recolector');
    if (s.hired.sembrador < Math.ceil(s.hired.recolector / 1.5)) job('sembrador');
    if (jobUnlocked(s, 'porteador') && s.hired.porteador < Math.floor(s.hired.recolector / 3)) job('porteador');
  }
  for (const id of NODE_IDS) {
    if (nodeReachable(s, id) && !nodeMaxed(s, id)) opts.push({ cost: nodeCost(s, id), buy: () => buyNode(s, id) });
  }
  return opts;
}

/** Compra lo más barato que se pueda pagar, una y otra vez, hasta que no llegue para nada. */
function shop(s: GameState, rng: Rng) {
  for (;;) {
    const affordable = purchaseOptions(s, rng).filter(o => o.cost <= s.coins);
    if (!affordable.length) return;
    affordable.sort((a, b) => a.cost - b.cost);
    if (!affordable[0].buy()) return;
  }
}

/** Un clic del jugador: primero recoger, luego sembrar. Devuelve false si no había nada que hacer. */
function playerClick(s: GameState): boolean {
  const crop = bestCrop(s);
  for (const p of s.plots) {
    if (p.stage === RIPE && p.res === null && isOpen(s, p)) return clickPlot(s, p.id, crop) !== null;
  }
  for (const p of s.plots) {
    if ((p.stage === -1 || p.stage === ROTTEN) && p.res === null && isOpen(s, p)) return clickPlot(s, p.id, crop) !== null;
  }
  return false;
}

const MILESTONES = ['automático', 'trigo', 'porteadores', 'tomate', 'calabaza', 'bancal al máximo', '40 gnomos', 'árbol completo'] as const;
type Milestone = (typeof MILESTONES)[number];

const milestoneReached: Record<Milestone, (s: GameState) => boolean> = {
  'automático': s => s.hired.recolector >= 1 && s.hired.sembrador >= 1,
  trigo: s => s.tree.trigo > 0,
  porteadores: s => s.tree.porteadores > 0,
  tomate: s => s.tree.tomate > 0,
  calabaza: s => s.tree.calabaza > 0,
  'bancal al máximo': s => nodeMaxed(s, 'bancal'),
  '40 gnomos': s => s.gnomes.length >= MAX_GNOMES,
  'árbol completo': s => NODE_IDS.every(id => nodeMaxed(s, id)),
};

interface Sample {
  step: number;
  earned: number;
  coins: number;
  gnomes: string;
  bancal: number;
  crop: CropId;
  rotted: number;
}

interface RunResult {
  profile: Profile;
  milestones: Record<Milestone, number | null>;
  coinsPerSecTail: number;
  rotted: number;
  rottedPerMinTail: number;
  samples: Sample[];
}

const RUN_MIN = 180;
const TAIL_MIN = 30;
const SAMPLE_MIN = 15;

function runProfile(profile: Profile): RunResult {
  const rng = mulberry32(SEED);
  const s = createState(rng);
  const total = RUN_MIN * STEPS_PER_MIN;
  const tailStart = (RUN_MIN - TAIL_MIN) * STEPS_PER_MIN;
  const clicksPerStep = profile.clicksPerSec * DT;
  const milestones = Object.fromEntries(MILESTONES.map(m => [m, null])) as Record<Milestone, number | null>;
  const samples: Sample[] = [];
  let budget = 0;
  let seeded: CropId = 'zanahoria';
  let tailEarned = 0;
  let tailRotted = 0;

  const sample = (n: number) => samples.push({
    step: n,
    earned: s.totalEarned,
    coins: s.coins,
    gnomes: `${s.hired.recolector}/${s.hired.sembrador}/${s.hired.porteador}`,
    bancal: s.tree.bancal,
    crop: bestCrop(s),
    rotted: s.rotted,
  });

  for (let n = 0; n < total; n++) {
    if (n === tailStart) {
      tailEarned = s.totalEarned;
      tailRotted = s.rotted;
    }
    // presupuesto de clics; no se acumula más de uno (el jugador no guarda clics para luego)
    budget = Math.min(budget + clicksPerStep, Math.max(1, clicksPerStep));
    while (budget >= 1) {
      if (!playerClick(s)) break;
      budget -= 1;
    }
    shop(s, rng);
    const best = bestCrop(s);
    if (best !== seeded) {
      setGroupSeed(s, s.groups[0].id, best);
      seeded = best;
    }
    step(s, rng);
    for (const m of MILESTONES) if (milestones[m] === null && milestoneReached[m](s)) milestones[m] = n + 1;
    if ((n + 1) % (SAMPLE_MIN * STEPS_PER_MIN) === 0) sample(n + 1);
  }

  return {
    profile,
    milestones,
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
  out.push('### Hitos (minuto en que se alcanzan)', '');
  out.push(table(
    ['Hito', ...results.map(r => r.profile.name)],
    MILESTONES.map(m => [m, ...results.map(r => minOr(r.milestones[m]))]),
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
      return [f1(x.step / STEPS_PER_MIN), Math.round(x.earned), Math.round(x.coins), f2(rate), x.gnomes, x.bancal, x.crop, x.rotted];
    });
    out.push(table(['min', 'ganado total', 'monedas', 'monedas/s (tramo)', 'rec/sem/port', 'bancal', 'mejor cultivo', 'echados a perder'], rows));
  }
  console.log(`\n${out.join('\n')}\n`);
});

// ---------- b) y c): bancal completo ----------

function fullField(rng: Rng, rec: number, sem: number, cropOf: (col: number) => CropId): GameState {
  const s = createState(rng);
  s.tree.bancal = TREE.bancal.max;
  s.tree.trigo = 1;
  s.tree.tomate = 1;
  s.tree.calabaza = 1;
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
  const rows = CROP_IDS.map(c => {
    const d = CROPS[c];
    return [c, d.value, d.grow, d.keep, f2(d.value / d.grow), d.value, d.value * sacoMax, d.value * PORTER_CAPACITY];
  });
  const out = [
    '## d) Cultivos', '',
    table(
      ['Cultivo', 'valor', 'crece (s)', 'aguanta (s)', 'monedas/s por parcela', 'monedas por viaje (recolector, saco 0)',
        `monedas por viaje (recolector, saco ${TREE.saco.max})`, 'monedas por viaje (porteador)'],
      rows,
    ),
  ];
  console.log(`\n${out.join('\n')}\n`);
});
