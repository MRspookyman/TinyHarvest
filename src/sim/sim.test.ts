import { describe, expect, it } from 'vitest';
import {
  BASKET, COST_GROWTH, CROPS, CROW_EAT, CROWN_MARGIN, FIELD, HOUSE, JOB_IDS, JOB_NODE, MAX_GNOMES, MAX_GROUPS, MERCADO_PER_LEVEL,
  MOLE_TIME, ORG, RIPE, ROTTEN, TREE, WATER,
} from './config';
import {
  basketMax, buyHouse, buyNode, clickPlot, createGroup, deleteGroup, fieldSize, hire, hireCost, houseCapacity, isOpen,
  moveGnome, nodeCost, nodeReachable, plotAt, plotStand, renameGroup, setGroupColor, setGroupSeed, setPriority, stageTime,
  startEvent, tick, waterTime,
} from './sim';
import { createState, deserialize, SAVE_VERSION, serialize } from './state';
import type { GameState, JobId, Rng, TraitId } from './types';

function seeded(seed: number): Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run(s: GameState, seconds: number, rng: Rng) {
  for (let i = 0; i < seconds * 30; i++) tick(s, 1 / 30, rng);
}

/** Contrata gratis. Por defecto un currante normal (sin título), que no se para a pensar ni se come la cosecha. */
function hireFree(s: GameState, job: JobId, rng: Rng, trait: TraitId = 'currante') {
  s.coins += hireCost(s, job);
  const node = JOB_NODE[job];
  if (node) s.tree[node] = 1;
  hire(s, job, rng);
  const g = s.gnomes[s.gnomes.length - 1];
  g.trait = trait;
  g.legendary = false;
  return g;
}

/** lo vendido vale entre el valor base y el máximo del multiplicador de organización (que cambia mientras se juega) */
function expectSold(coins: number, base: number) {
  expect(coins).toBeGreaterThanOrEqual(base);
  expect(coins).toBeLessThanOrEqual(base * (1 + ORG.max) + 1e-9);
}

function park(g: { state: string; timer: number; task: unknown }) {
  g.state = 'work';
  g.timer = 9999;
  g.task = { kind: 'nap' };
}

const plotId = (col: number, row: number) => row * FIELD.maxCols + col;

describe('contratar', () => {
  it('el coste sube un COST_GROWTH por gnomo del mismo oficio', () => {
    const s = createState(seeded(1));
    expect(hireCost(s, 'recolector')).toBe(12);
    s.hired.recolector = 5;
    expect(hireCost(s, 'recolector')).toBe(Math.floor(12 * COST_GROWTH ** 5));
  });

  it('no se puede contratar sin monedas', () => {
    const s = createState(seeded(1));
    expect(hire(s, 'recolector', seeded(2))).toBe(false);
    s.coins = 12;
    expect(hire(s, 'recolector', seeded(2))).toBe(true);
    expect(s.coins).toBe(0);
  });

  it('los porteadores se desbloquean en el árbol', () => {
    const s = createState(seeded(1));
    s.coins = 1e6;
    expect(hire(s, 'porteador', seeded(2))).toBe(false);
    buyNode(s, 'botas');
    buyNode(s, 'saco');
    expect(buyNode(s, 'porteadores')).toBe(true);
    expect(hire(s, 'porteador', seeded(2))).toBe(true);
  });
});

describe('casa de gnomos', () => {
  it('sin cama libre no se contrata; ampliar la casa da más camas', () => {
    const rng = seeded(1);
    const s = createState(rng);
    s.coins = 1e9;
    for (let i = 0; i < HOUSE.base; i++) expect(hire(s, 'recolector', rng)).toBe(true);
    expect(hire(s, 'recolector', rng)).toBe(false);
    const coins = s.coins;
    expect(buyHouse(s)).toBe(true);
    expect(s.coins).toBe(coins - HOUSE.cost);
    expect(houseCapacity(s)).toBe(HOUSE.base + HOUSE.perLevel);
    expect(hire(s, 'recolector', rng)).toBe(true);
    while (buyHouse(s));
    expect(s.house).toBe(HOUSE.max);
    expect(houseCapacity(s)).toBeLessThanOrEqual(MAX_GNOMES);
  });

  it('una partida con más gnomos que camas carga con la casa ampliada', () => {
    const rng = seeded(1);
    const s = createState(rng);
    s.coins = 1e9;
    s.house = HOUSE.max;
    for (let i = 0; i < HOUSE.base + 5; i++) hire(s, 'recolector', rng);
    const old = JSON.parse(JSON.stringify(serialize(s)));
    delete old.house;
    const loaded = deserialize(old, rng)!;
    expect(houseCapacity(loaded)).toBeGreaterThanOrEqual(loaded.gnomes.length);
  });
});

describe('árbol de mejoras', () => {
  it('un nodo necesita a su padre', () => {
    const s = createState(seeded(1));
    s.coins = 1e6;
    expect(nodeReachable(s, 'cafe')).toBe(false);
    expect(buyNode(s, 'cafe')).toBe(false);
    expect(buyNode(s, 'botas')).toBe(true);
    expect(buyNode(s, 'cafe')).toBe(true);
  });

  it('el coste crece con el nivel y hay un máximo', () => {
    const s = createState(seeded(1));
    s.coins = 1e9;
    expect(nodeCost(s, 'botas')).toBe(TREE.botas.base);
    buyNode(s, 'botas');
    expect(nodeCost(s, 'botas')).toBe(Math.floor(TREE.botas.base * TREE.botas.mult));
    while (buyNode(s, 'botas'));
    expect(s.tree.botas).toBe(TREE.botas.max);
  });

  it('el mercado sube lo que se cobra y las conservas retrasan la podredumbre', () => {
    const rng = seeded(1);
    const s = createState(rng);
    s.tree.mercado = 2;
    s.plots[0].stage = RIPE;
    clickPlot(s, 0, 'zanahoria');
    expect(s.coins).toBeCloseTo(CROPS.zanahoria.value * (1 + 2 * MERCADO_PER_LEVEL) * s.org.mult);
    s.tree.conservas = 1;
    const p = s.plots[0];
    p.stage = RIPE;
    p.t = 0;
    for (let i = 0; i < (CROPS.zanahoria.keep + 1) * 30; i++) tick(s, 1 / 30, rng);
    expect(p.stage).toBe(RIPE);
  });

  it('los cultivos nuevos se desbloquean en el árbol', () => {
    const s = createState(seeded(1));
    expect(clickPlot(s, 0, 'trigo')).toBe(null);
    s.coins = TREE.trigo.base;
    expect(buyNode(s, 'trigo')).toBe(true);
    expect(clickPlot(s, 0, 'trigo')).toBe('plant');
  });

  it('la cesta grande guarda más', () => {
    const s = createState(seeded(1));
    expect(basketMax(s)).toBe(BASKET.base);
    s.tree.cesta = 2;
    expect(basketMax(s)).toBe(BASKET.base + 2 * BASKET.perLevel);
  });
});

describe('bancal', () => {
  it('empieza en 3 × 3 y no se puede plantar fuera', () => {
    const s = createState(seeded(1));
    expect(s.plots.filter(p => isOpen(s, p))).toHaveLength(9);
    expect(clickPlot(s, plotId(3, 0), 'zanahoria')).toBe(null);
    expect(plotAt(s, FIELD.x + 3 * FIELD.cell + 1, FIELD.y + 1)).toBe(null);
  });

  it('crece alternando columnas y filas hasta 9 × 6', () => {
    const s = createState(seeded(1));
    s.coins = 1e9;
    buyNode(s, 'bancal');
    expect(fieldSize(s)).toEqual({ cols: 4, rows: 3 });
    buyNode(s, 'bancal');
    expect(fieldSize(s)).toEqual({ cols: 4, rows: 4 });
    while (buyNode(s, 'bancal'));
    expect(fieldSize(s)).toEqual({ cols: 9, rows: 6 });
  });
});

describe('cultivos', () => {
  it('una zanahoria madura en su tiempo de crecimiento', () => {
    const rng = seeded(3);
    const s = createState(rng);
    const p = s.plots[0];
    clickPlot(s, p.id, 'zanahoria');
    run(s, CROPS.zanahoria.grow - 0.5, rng);
    expect(p.stage).toBeLessThan(RIPE);
    run(s, 1, rng);
    expect(p.stage).toBe(RIPE);
  });

  it('recoger a mano da monedas y deja la parcela vacía', () => {
    const s = createState(seeded(1));
    s.plots[0].stage = RIPE;
    expect(clickPlot(s, 0, 'zanahoria')).toBe('harvest');
    expect(s.coins).toBe(CROPS.zanahoria.value * s.org.mult);
    expect(s.plots[0].stage).toBe(-1);
  });

  it('lo maduro que nadie recoge se echa a perder pasado su aguante', () => {
    const rng = seeded(3);
    const s = createState(rng);
    const p = s.plots[0];
    p.stage = RIPE;
    p.t = 0;
    run(s, CROPS.zanahoria.keep - 0.5, rng);
    expect(p.stage).toBe(RIPE);
    run(s, 1, rng);
    expect(p.stage).toBe(ROTTEN);
    expect(s.rotted).toBe(1);
    // echado a perder no da monedas: un clic lo arranca y siembra la semilla elegida
    expect(clickPlot(s, p.id, 'zanahoria')).toBe('plant');
    expect(s.coins).toBe(0);
    expect(p.stage).toBe(0);
  });
});

describe('gnomos', () => {
  it('sin porteadores, el recolector lleva la cosecha al granero', () => {
    const rng = seeded(4);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    s.plots[plotId(1, 1)].stage = RIPE;
    hireFree(s, 'recolector', rng);
    run(s, 30, rng);
    expectSold(s.coins, CROPS.zanahoria.value);
  });

  it('con porteadores, la cosecha pasa por la cesta', () => {
    const rng = seeded(8);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    hireFree(s, 'recolector', rng);
    const porter = hireFree(s, 'porteador', rng);
    park(porter);
    s.plots[plotId(0, 0)].stage = RIPE;
    s.plots[plotId(1, 0)].stage = RIPE;
    run(s, 30, rng);
    expect(s.basket).toHaveLength(2);
    expect(s.coins).toBe(0);
    porter.timer = 0;
    run(s, 30, rng);
    expect(s.basket).toHaveLength(0);
    expectSold(s.coins, 2 * CROPS.zanahoria.value);
  });

  it('con la cesta llena, el recolector espera con el saco', () => {
    const rng = seeded(9);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    s.basket = Array(basketMax(s)).fill('zanahoria');
    park(hireFree(s, 'porteador', rng));
    const picker = hireFree(s, 'recolector', rng);
    s.plots[0].stage = RIPE;
    run(s, 20, rng);
    expect(picker.carry).toHaveLength(1);
    expect(['wait', 'drop']).toContain(picker.task?.kind);
  });

  it('un sembrador replanta solo el bancal abierto', () => {
    const rng = seeded(5);
    const s = createState(rng);
    hireFree(s, 'sembrador', rng);
    run(s, 40, rng);
    expect(s.plots.filter(p => isOpen(s, p)).every(p => p.stage >= 0)).toBe(true);
    expect(s.plots.filter(p => !isOpen(s, p)).every(p => p.stage === -1)).toBe(true);
  });

  it('los recolectores no recogen lo echado a perder; los sembradores lo arrancan y replantan', () => {
    const rng = seeded(5);
    const s = createState(rng);
    for (const p of s.plots) p.stage = 0;
    const rotten = s.plots[plotId(1, 1)];
    rotten.stage = ROTTEN;
    const picker = hireFree(s, 'recolector', rng);
    tick(s, 1 / 30, rng);
    expect(picker.task?.kind).not.toBe('harvest');
    hireFree(s, 'sembrador', rng);
    run(s, 6, rng);
    expect(rotten.stage).toBeGreaterThanOrEqual(0);
    expect(rotten.stage).toBeLessThan(RIPE);
  });

  it('dos porteadores no van a por una cesta que solo da para uno', () => {
    const rng = seeded(8);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    const a = hireFree(s, 'porteador', rng);
    const b = hireFree(s, 'porteador', rng);
    s.basket = ['zanahoria', 'zanahoria', 'zanahoria'];
    tick(s, 1 / 30, rng);
    const kinds = [a, b].map(g => g.task?.kind);
    expect(kinds.filter(k => k === 'pickup')).toHaveLength(1);
    // con 6 en la cesta (más de PORTER_CAPACITY) ya hay trabajo para el segundo
    s.basket.push('zanahoria', 'zanahoria', 'zanahoria');
    const idle = a.task?.kind === 'pickup' ? b : a;
    idle.state = 'think';
    tick(s, 1 / 30, rng);
    expect(idle.task?.kind).toBe('pickup');
  });
});

describe('semilla por grupo', () => {
  it('los sembradores siembran la semilla del grupo; sin semilla, lo que había', () => {
    const rng = seeded(5);
    const s = createState(rng);
    s.tree.trigo = 1;
    s.tree.tomate = 1;
    s.tree.calabaza = 1;
    for (const p of s.plots) p.stage = 0;
    const a = s.plots[plotId(0, 0)];
    a.stage = -1;
    a.crop = 'zanahoria';
    hireFree(s, 'sembrador', rng);
    run(s, 5, rng);
    expect(a).toMatchObject({ stage: 0, crop: 'zanahoria' });

    setGroupSeed(s, s.groups[0].id, 'calabaza');
    a.stage = ROTTEN;
    // aunque esté de siesta o paseando, en 12 s vuelve; la calabaza tarda 15 s en pasar de fase
    run(s, 12, rng);
    expect(a).toMatchObject({ stage: 0, crop: 'calabaza' });
  });

  it('no deja elegir una semilla sin desbloquear', () => {
    const s = createState(seeded(1));
    setGroupSeed(s, s.groups[0].id, 'calabaza');
    expect(s.groups[0].seed).toBe(null);
  });
});

describe('grupos', () => {
  it('se crean con nombre y color distintos y hay un máximo', () => {
    const s = createState(seeded(1));
    const g = createGroup(s)!;
    expect(g.name).not.toBe(s.groups[0].name);
    expect(g.color).not.toBe(s.groups[0].color);
    while (createGroup(s));
    expect(s.groups).toHaveLength(MAX_GROUPS);
  });

  it('se renombran y cambian de color', () => {
    const s = createState(seeded(1));
    const id = s.groups[0].id;
    expect(renameGroup(s, id, '   Los   Valientes  ')).toBe(true);
    expect(s.groups[0].name).toBe('Los Valientes');
    expect(renameGroup(s, id, '   ')).toBe(false);
    setGroupColor(s, id, 5);
    expect(s.groups[0].color).toBe(5);
  });

  it('al borrar un grupo sus gnomos pasan al primero, y el último no se borra', () => {
    const rng = seeded(1);
    const s = createState(rng);
    const b = createGroup(s)!;
    const g = hireFree(s, 'recolector', rng);
    expect(moveGnome(s, g.id, b.id)).toBe(true);
    expect(deleteGroup(s, b.id)).toBe(true);
    expect(g.group).toBe(s.groups[0].id);
    expect(deleteGroup(s, s.groups[0].id)).toBe(false);
  });

  it('cada grupo sigue su prioridad', () => {
    const rng = seeded(6);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    const valiosos = createGroup(s)!;
    setPriority(s, valiosos.id, 'valioso');
    const g = hireFree(s, 'recolector', rng);
    moveGnome(s, g.id, valiosos.id);
    const carrot = s.plots[plotId(0, 0)];
    const tomato = s.plots[plotId(2, 2)];
    carrot.stage = RIPE;
    tomato.stage = RIPE;
    tomato.crop = 'tomate';
    const c = plotStand(carrot);
    g.x = c.x;
    g.y = c.y;
    tick(s, 1 / 30, rng);
    expect(g.task?.plot).toBe(tomato.id);

    setPriority(s, valiosos.id, 'solo_trigo');
    tick(s, 1 / 30, rng);
    expect(g.task?.kind).not.toBe('harvest');
  });

  it('«valioso» cuenta el paseo: un tomate al lado gana a una calabaza al fondo del bancal', () => {
    const rng = seeded(6);
    const s = createState(rng);
    s.tree.bancal = TREE.bancal.max;
    for (const p of s.plots) p.stage = -1;
    setPriority(s, s.groups[0].id, 'valioso');
    const g = hireFree(s, 'recolector', rng);
    const tomato = s.plots[plotId(0, 0)];
    const pumpkin = s.plots[plotId(8, 5)];
    Object.assign(tomato, { stage: RIPE, crop: 'tomate' });
    Object.assign(pumpkin, { stage: RIPE, crop: 'calabaza' });
    Object.assign(g, plotStand(tomato));
    tick(s, 1 / 30, rng);
    expect(g.task?.plot).toBe(tomato.id);
    // a la misma distancia, gana la calabaza
    releaseAndThink(s, g);
    Object.assign(tomato, { stage: -1 });
    const nearPumpkin = s.plots[plotId(1, 0)];
    Object.assign(nearPumpkin, { stage: RIPE, crop: 'calabaza' });
    Object.assign(tomato, { stage: RIPE, crop: 'tomate' });
    const mid = { x: (plotStand(tomato).x + plotStand(nearPumpkin).x) / 2, y: plotStand(tomato).y };
    Object.assign(g, mid);
    tick(s, 1 / 30, rng);
    expect(g.task?.plot).toBe(nearPumpkin.id);
  });

  it('«urgente» va a lo que antes se va a echar a perder, aunque esté más lejos', () => {
    const rng = seeded(6);
    const s = createState(rng);
    s.tree.bancal = TREE.bancal.max;
    for (const p of s.plots) p.stage = -1;
    setPriority(s, s.groups[0].id, 'urgente');
    const g = hireFree(s, 'recolector', rng);
    const fresh = s.plots[plotId(0, 0)];
    const old = s.plots[plotId(6, 4)];
    Object.assign(fresh, { stage: RIPE, t: 0 });
    Object.assign(old, { stage: RIPE, t: CROPS.zanahoria.keep - 8 });
    Object.assign(g, plotStand(fresh));
    tick(s, 1 / 30, rng);
    expect(g.task?.plot).toBe(old.id);
  });
});

function releaseAndThink(s: GameState, g: GameState['gnomes'][number]) {
  if (g.task?.plot !== undefined) s.plots[g.task.plot].res = null;
  g.state = 'think';
  g.task = null;
}

describe('ranking', () => {
  it('los gnomos apuntan lo que hacen', () => {
    const rng = seeded(4);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    s.plots[plotId(1, 1)].stage = RIPE;
    const g = hireFree(s, 'recolector', rng);
    run(s, 30, rng);
    expect(g.stats).toMatchObject({ harvests: 1, delivered: 1, tasks: 2 });
    expectSold(g.stats.value, CROPS.zanahoria.value);
    expect(g.stats.walked).toBeGreaterThan(0);
  });

  it('cada oficio tiene su corona, y solo cambia de cabeza con ventaja clara', () => {
    const rng = seeded(4);
    const s = createState(rng);
    const [a, b] = [hireFree(s, 'recolector', rng), hireFree(s, 'recolector', rng)];
    const p = hireFree(s, 'porteador', rng);
    for (const g of [a, b, p]) park(g);
    tick(s, 1 / 30, rng);
    expect(s.crowns).toEqual(Object.fromEntries(JOB_IDS.map(j => [j, null])));
    // el porteador hace menos tareas que los recolectores, pero es el mejor de su oficio
    a.stats.tasks = 50;
    p.stats.tasks = 10;
    tick(s, 1 / 30, rng);
    expect(s.crowns).toMatchObject({ recolector: a.id, porteador: p.id });
    b.stats.tasks = 50 + CROWN_MARGIN - 1;
    tick(s, 1 / 30, rng);
    expect(s.crowns.recolector).toBe(a.id);
    b.stats.tasks = 50 + CROWN_MARGIN;
    tick(s, 1 / 30, rng);
    expect(s.crowns.recolector).toBe(b.id);
    expect(s.log[0]).toContain(b.name);
  });
});

describe('guardado', () => {
  it('serializar y cargar conserva lo importante', () => {
    const rng = seeded(7);
    const s = createState(rng);
    s.coins = 123;
    s.tree.botas = 2;
    s.tree.tomate = 1;
    s.tree.bancal = 3;
    s.basket = ['trigo', 'zanahoria'];
    s.plots[3].crop = 'tomate';
    s.plots[3].stage = 2;
    const b = createGroup(s)!;
    renameGroup(s, b.id, 'Los Valientes');
    setGroupColor(s, b.id, 7);
    setPriority(s, b.id, 'solo_tomate');
    setGroupSeed(s, b.id, 'tomate');
    s.plots[4].stage = ROTTEN;
    s.rotted = 3;
    const g = hireFree(s, 'porteador', rng);
    moveGnome(s, g.id, b.id);
    g.stats.tasks = 9;
    g.stats.walked = 120;
    s.crowns.porteador = g.id;
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(s))), rng)!;
    expect(loaded.coins).toBe(s.coins);
    expect(loaded.tree).toEqual(s.tree);
    expect(fieldSize(loaded)).toEqual(fieldSize(s));
    expect(loaded.basket).toEqual(['trigo', 'zanahoria']);
    expect(loaded.plots[3]).toMatchObject({ crop: 'tomate', stage: 2 });
    expect(loaded.plots[4].stage).toBe(ROTTEN);
    expect(loaded.groups[1]).toEqual({ id: b.id, name: 'Los Valientes', color: 7, priority: 'solo_tomate', seed: 'tomate' });
    expect(loaded.gnomes[0]).toMatchObject({ name: g.name, job: 'porteador', group: b.id, state: 'think' });
    expect(loaded.gnomes[0].stats).toMatchObject({ tasks: 9, walked: 120 });
    expect(loaded).toMatchObject({ rotted: 3, crowns: { porteador: g.id, recolector: null } });
    expect(loaded.nextId).toBe(s.nextId);
    expect(loaded.nextGroupId).toBe(s.nextGroupId);
  });

  it('carga las partidas v3 (sin semilla, estadísticas, podredumbre ni rasgos) y les reparte rasgos', () => {
    const rng = seeded(7);
    const s = createState(rng);
    const g = hireFree(s, 'recolector', rng);
    const old = JSON.parse(JSON.stringify(serialize(s)));
    old.v = 3;
    delete old.rotted;
    delete old.crowns;
    for (const gr of old.groups) delete gr.seed;
    for (const gn of old.gnomes) {
      delete gn.stats;
      delete gn.trait;
      delete gn.legendary;
    }
    const copy = JSON.stringify(old);
    const loaded = deserialize(old, rng)!;
    expect(JSON.stringify(old)).toBe(copy);
    expect(loaded.groups[0].seed).toBe(null);
    expect(loaded.gnomes[0]).toMatchObject({ name: g.name, legendary: false });
    expect(['perezoso', 'nervioso', 'gloton', 'cotilla', 'dormilon', 'currante']).toContain(loaded.gnomes[0].trait);
    expect(loaded.gnomes[0].stats.tasks).toBe(0);
    expect(loaded).toMatchObject({ rotted: 0, crowns: { recolector: null, sembrador: null, porteador: null }, critters: [], happening: null });
    expect(serialize(loaded).v).toBe(SAVE_VERSION);
  });

  it('guarda el rasgo y si es legendario', () => {
    const rng = seeded(7);
    const s = createState(rng);
    const g = hireFree(s, 'sembrador', rng, 'dormilon');
    g.legendary = true;
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(s))), rng)!;
    expect(loaded.gnomes[0]).toMatchObject({ trait: 'dormilon', legendary: true });
  });

  it('rechaza partidas de otra versión', () => {
    expect(deserialize(null, seeded(1))).toBe(null);
    expect(deserialize({ v: 2 }, seeded(1))).toBe(null);
    expect(deserialize({ v: SAVE_VERSION + 1 }, seeded(1))).toBe(null);
  });
});

describe('vida en el huerto', () => {
  /** bancal con todo creciendo y una sola parcela madura */
  function oneRipe(rng: Rng) {
    const s = createState(rng);
    for (const p of s.plots) p.stage = isOpen(s, p) ? 0 : -1;
    const p = s.plots[plotId(2, 2)];
    p.stage = RIPE;
    return { s, p };
  }

  it('el rasgo cambia el paso: un perezoso tarda más que un currante en el mismo camino', () => {
    const seconds = (trait: TraitId) => {
      const rng = seeded(11);
      const { s } = oneRipe(rng);
      const g = hireFree(s, 'recolector', rng, trait);
      for (let n = 1; n < 30 * 30; n++) {
        tick(s, 1 / 30, rng);
        if (g.stats.harvests) return n / 30;
      }
      return Infinity;
    };
    const lazy = seconds('perezoso'), hard = seconds('currante');
    expect(hard).toBeLessThan(Infinity);
    expect(lazy).toBeGreaterThan(hard * 1.1);
  });

  it('al ir a por algo maduro, el recolector lo dice con un bocadillo', () => {
    const rng = seeded(3);
    const { s, p } = oneRipe(rng);
    const g = hireFree(s, 'recolector', rng);
    tick(s, 1 / 30, rng);
    expect(g.task).toMatchObject({ kind: 'harvest', plot: p.id });
    expect(g.bubble).toMatchObject({ kind: 'crop', crop: 'zanahoria' });
    run(s, 2, rng);
    expect(g.bubble?.kind).not.toBe('crop');
  });

  it('un cuervo se come lo maduro si nadie lo espanta', () => {
    const rng = seeded(12);
    const { s, p } = oneRipe(rng);
    expect(startEvent(s, 'cuervo', rng)).toBe(true);
    run(s, CROW_EAT + 5, rng);
    expect(p.stage).toBe(-1);
    expect(s.rotted).toBe(0);
    run(s, 5, rng);
    expect(s.critters).toHaveLength(0);
  });

  it('si hay un gnomo libre, va a espantar al cuervo y la cosecha se salva', () => {
    const rng = seeded(12);
    const { s, p } = oneRipe(rng);
    // un sembrador sin nada que sembrar: está libre
    const g = hireFree(s, 'sembrador', rng);
    Object.assign(g, plotStand(s.plots[plotId(0, 2)]));
    expect(startEvent(s, 'cuervo', rng)).toBe(true);
    run(s, CROW_EAT + 5, rng);
    expect(p.stage).toBe(RIPE);
    expect(g.stats.tasks).toBe(0);
    run(s, 5, rng);
    expect(s.critters.filter(c => c.kind === 'cuervo')).toHaveLength(0);
  });

  it('donde asoma un topo no se siembra hasta que se va', () => {
    const rng = seeded(13);
    const s = createState(rng);
    for (const p of s.plots) p.stage = isOpen(s, p) ? 0 : -1;
    const hole = s.plots[plotId(1, 1)];
    hole.stage = -1;
    expect(startEvent(s, 'topo', rng)).toBe(true);
    expect(s.critters[0]).toMatchObject({ kind: 'topo', plot: hole.id });
    hireFree(s, 'sembrador', rng);
    run(s, MOLE_TIME - 2, rng);
    expect(hole.stage).toBe(-1);
    run(s, 8, rng);
    expect(hole.stage).toBeGreaterThanOrEqual(0);
  });

  it('un glotón se come alguna zanahoria de las que recoge', () => {
    const rng = seeded(14);
    const s = createState(rng);
    s.tree.bancal = 4;
    // saco grande: muchas zanahorias por viaje
    s.tree.saco = 3;
    const g = hireFree(s, 'recolector', rng, 'gloton');
    for (let i = 0; i < 8; i++) {
      for (const p of s.plots) if (isOpen(s, p) && p.stage === -1) p.stage = RIPE;
      run(s, 20, rng);
    }
    expect(s.events.some(e => e.type === 'moment' && e.kind === 'comer')).toBe(true);
    expect(g.stats.harvests).toBeGreaterThan(g.stats.delivered + g.carry.length);
  });
});

describe('regador y guardián', () => {
  /** lo que lleva crecido una parcela, en fases */
  const growth = (s: GameState, p: GameState['plots'][number]) => p.stage + p.t / stageTime(s, p.crop);

  /** bancal vacío salvo dos tomateras recién plantadas, una a cada lado */
  function twoTomatoes(rng: Rng) {
    const s = createState(rng);
    s.tree.tomate = 1;
    for (const p of s.plots) p.stage = -1;
    const near = s.plots[plotId(0, 0)];
    const far = s.plots[plotId(2, 2)];
    for (const p of [near, far]) Object.assign(p, { crop: 'tomate', stage: 0, t: 0 });
    return { s, near, far };
  }

  it('un tomate sin regar crece muy despacio', () => {
    const rng = seeded(21);
    const { s, near } = twoTomatoes(rng);
    run(s, CROPS.tomate.grow, rng);
    expect(near.stage).toBeLessThan(RIPE);
    run(s, CROPS.tomate.grow * (1 / WATER.dry - 1) + 1, rng);
    expect(near.stage).toBe(RIPE);
  });

  it('el regador riega una tomatera seca y crece más rápido que la que no ha regado', () => {
    const rng = seeded(22);
    const { s, near, far } = twoTomatoes(rng);
    const g = hireFree(s, 'regador', rng);
    for (let i = 0; i < 30 * 30 && !near.wet && !far.wet; i++) tick(s, 1 / 30, rng);
    expect(s.events.some(e => e.type === 'water')).toBe(true);
    // se queda quieto: solo una de las dos está regada
    if (g.task?.plot !== undefined) s.plots[g.task.plot].wres = null;
    park(g);
    const [wet, dry] = near.wet ? [near, far] : [far, near];
    expect(wet.wet).toBeCloseTo(waterTime(s), 0);
    expect(dry.wet).toBe(0);
    const before = [growth(s, wet), growth(s, dry)];
    run(s, 20, rng);
    expect(growth(s, wet) - before[0]).toBeGreaterThan(3 * (growth(s, dry) - before[1]));
  });

  it('el guardián espanta al cuervo antes de que coma y los demás siguen a lo suyo', () => {
    const rng = seeded(23);
    const s = createState(rng);
    for (const p of s.plots) p.stage = isOpen(s, p) ? 0 : -1;
    const p = s.plots[plotId(2, 2)];
    p.stage = RIPE;
    const guard = hireFree(s, 'guardian', rng);
    // un sembrador libre al lado: sin guardián iría él
    const sower = hireFree(s, 'sembrador', rng);
    Object.assign(sower, plotStand(s.plots[plotId(1, 2)]));
    expect(startEvent(s, 'cuervo', rng)).toBe(true);
    let guardShooed = false;
    for (let i = 0; i < (CROW_EAT + 5) * 30; i++) {
      tick(s, 1 / 30, rng);
      expect(sower.task?.kind).not.toBe('shoo');
      if (guard.task?.kind === 'shoo') guardShooed = true;
    }
    expect(guardShooed).toBe(true);
    expect(p.stage).toBe(RIPE);
    expect(s.events.some(e => e.type === 'moment' && e.kind === 'vigilancia')).toBe(true);
  });
});

describe('multiplicador de organización', () => {
  it('baja cuando todo se echa a perder y sube cuando el trabajo fluye', () => {
    const rng = seeded(24);
    const s = createState(rng);
    expect(s.org.mult).toBeCloseTo(1 + ORG.max);
    for (const p of s.plots) p.stage = isOpen(s, p) ? RIPE : -1;
    run(s, 90, rng);
    const bad = s.org.mult;
    expect(s.org.parts.cosecha).toBeLessThan(0.3);
    expect(bad).toBeLessThan(1 + ORG.max * 0.6);
    for (let i = 0; i < 3; i++) hireFree(s, 'recolector', rng);
    for (let i = 0; i < 2; i++) hireFree(s, 'sembrador', rng);
    run(s, 300, rng);
    expect(s.org.mult).toBeGreaterThan(bad + 0.1);
    expect(s.org.parts.cosecha).toBeGreaterThan(0.8);
  });
});

describe('guardado v5', () => {
  it('una partida v4 carga sin riego y con los oficios nuevos a cero', () => {
    const rng = seeded(25);
    const s = createState(rng);
    const g = hireFree(s, 'recolector', rng);
    s.plots[0].stage = 1;
    const old = JSON.parse(JSON.stringify(serialize(s)));
    old.v = 4;
    for (const p of old.plots) delete p.wet;
    for (const k of ['regador', 'guardian']) {
      delete old.hired[k];
      delete old.crowns[k];
    }
    const loaded = deserialize(old, rng)!;
    expect(loaded.plots.every(p => p.wet === 0 && p.wres === null)).toBe(true);
    expect(loaded.plots[0].stage).toBe(1);
    expect(loaded.hired).toMatchObject({ recolector: 1, regador: 0, guardian: 0 });
    expect(loaded.crowns).toMatchObject({ regador: null, guardian: null });
    expect(loaded.gnomes[0].name).toBe(g.name);
    expect(serialize(loaded).v).toBe(SAVE_VERSION);
  });
});
