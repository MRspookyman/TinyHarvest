import { describe, expect, it } from 'vitest';
import {
  BASKET, COST_GROWTH, CROPS, CROW_EAT, CROWN_MARGIN, FIELD, HOUSE, JOB_IDS, JOB_NODE, JOBS, MAX_GNOMES, MAX_GROUPS,
  MERCADO_PER_LEVEL, MOLE_TIME, NODE_IDS, ORG, PRESTIGE, RIPE, ROTTEN, TALENT_EFFECT, TALENTS, TREE, WATER, GOLDEN, ZONE_BONUS,
} from './config';
import {
  basketMax, buyHouse, buyNode, buyTalent, canEndSeason, clickPlot, createGroup, cropValue, deleteGroup, endSeason, fieldSize,
  hire, hireCost, houseCapacity, isOpen, moveGnome, nextGoal, nodeCost, nodeReachable, plotAt, plotStand, renameGroup, seasonSeeds,
  seedsCoinsNeeded, setGroupColor, setGroupSeed, setGroupZone, setPriority, stageTime, startEvent, talentCost, talentReachable, tick, turfBonus, waterTime,
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

describe('zonas', () => {
  it('el grupo solo trabaja dentro de su zona, aunque lo de fuera esté más cerca', () => {
    const rng = seeded(6);
    const s = createState(rng);
    s.tree.bancal = TREE.bancal.max;
    for (const p of s.plots) p.stage = 0;
    const g = hireFree(s, 'recolector', rng);
    const near = s.plots[plotId(0, 0)];
    const far = s.plots[plotId(8, 5)];
    near.stage = RIPE;
    far.stage = RIPE;
    const st = plotStand(near);
    [g.x, g.y] = [st.x, st.y];
    setGroupZone(s, s.groups[0].id, { c0: 5, r0: 3, c1: 8, r1: 5 });
    tick(s, 1 / 30, rng);
    expect(g.task?.plot).toBe(far.id);

    // sin nada maduro dentro de la zona, no sale de ella
    far.stage = 0;
    releaseAndThink(s, g);
    tick(s, 1 / 30, rng);
    expect(g.task?.kind).not.toBe('harvest');
  });

  it('al cambiar la zona, quien iba hacia fuera vuelve a decidir; «todo el bancal» la quita', () => {
    const rng = seeded(6);
    const s = createState(rng);
    s.tree.bancal = TREE.bancal.max;
    for (const p of s.plots) p.stage = 0;
    const g = hireFree(s, 'sembrador', rng);
    const p = s.plots[plotId(0, 0)];
    p.stage = -1;
    tick(s, 1 / 30, rng);
    expect(g.task).toMatchObject({ kind: 'plant', plot: p.id });
    setGroupZone(s, s.groups[0].id, { c0: 4, r0: 0, c1: 8, r1: 5 });
    expect(p.res).toBe(null);
    expect(g.task?.kind).not.toBe('plant');
    setGroupZone(s, s.groups[0].id, null);
    expect(s.groups[0].zone).toBe(null);
    tick(s, 1 / 30, rng);
    expect(g.task).toMatchObject({ kind: 'plant', plot: p.id });
  });

  it('no acepta zonas fuera del bancal más grande', () => {
    const s = createState(seeded(1));
    setGroupZone(s, s.groups[0].id, { c0: 0, r0: 0, c1: FIELD.maxCols, r1: 0 });
    setGroupZone(s, s.groups[0].id, { c0: -1, r0: 0, c1: 2, r1: 0 });
    expect(s.groups[0].zone).toBe(null);
  });
});

describe('enganche', () => {
  it('la ventaja de zona crece cuanto más pequeña es la zona y no se da con todo el bancal ni sin zona', () => {
    const rng = seeded(40);
    const s = createState(rng);
    s.tree.bancal = TREE.bancal.max;
    const g = hireFree(s, 'recolector', rng);
    const id = s.groups[0].id;
    expect(turfBonus(s, g)).toBe(0);
    setGroupZone(s, id, { c0: 0, r0: 0, c1: FIELD.maxCols - 1, r1: FIELD.maxRows - 1 });
    expect(turfBonus(s, g)).toBe(0);
    setGroupZone(s, id, { c0: 0, r0: 0, c1: 2, r1: FIELD.maxRows - 1 });
    const third = turfBonus(s, g);
    setGroupZone(s, id, { c0: 0, r0: 0, c1: 0, r1: FIELD.maxRows - 1 });
    expect(turfBonus(s, g)).toBeGreaterThan(third);
    expect(third).toBeCloseTo(ZONE_BONUS * (2 / 3));
    // los porteadores van a todas partes: no tienen zona
    expect(turfBonus(s, hireFree(s, 'porteador', rng))).toBe(0);
  });

  it('una cosecha dorada vale GOLDEN.mult veces más, a mano o con un gnomo, y se pierde si se pudre', () => {
    const rng = seeded(41);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    const p = s.plots[0];
    Object.assign(p, { stage: RIPE, t: 0, golden: true });
    s.coins = 0;
    clickPlot(s, p.id, 'zanahoria');
    expectSold(s.coins, CROPS.zanahoria.value * GOLDEN.mult);
    expect(p.golden).toBe(false);
    expect(s.events.some(e => e.type === 'golden')).toBe(true);

    // un gnomo cobra lo de más en el acto y lleva el cultivo normal al saco
    Object.assign(p, { stage: RIPE, t: 0, golden: true, res: null });
    s.coins = 0;
    const g = hireFree(s, 'recolector', rng);
    run(s, 6, rng);
    expect(p.stage).toBe(-1);
    expect(s.coins).toBeGreaterThanOrEqual(CROPS.zanahoria.value * (GOLDEN.mult - 1));
    expect(g.stats.harvests).toBe(1);

    // lo que se echa a perder deja de brillar
    const q = s.plots[1];
    Object.assign(q, { stage: RIPE, t: CROPS.zanahoria.keep - 0.01, golden: true });
    tick(s, 0.1, rng);
    expect(q).toMatchObject({ stage: ROTTEN, golden: false });
  });

  it('el próximo objetivo es la mejora más barata que ya se puede comprar; con el árbol completo, la siguiente semilla', () => {
    const s = createState(seeded(42));
    const reachable = NODE_IDS.filter(id => nodeReachable(s, id));
    const cheapest = reachable.reduce((a, b) => (nodeCost(s, b) < nodeCost(s, a) ? b : a));
    expect(nextGoal(s)).toMatchObject({ kind: 'node', id: cheapest, need: nodeCost(s, cheapest) });
    for (const id of NODE_IDS) s.tree[id] = TREE[id].max;
    s.totalEarned = seedsCoinsNeeded(3);
    expect(nextGoal(s)).toMatchObject({ kind: 'seed', seeds: 4, need: seedsCoinsNeeded(4) });
  });
});

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
    setGroupZone(s, b.id, { c0: 2, r0: 1, c1: 0, r1: 0 });
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
    expect(loaded.groups[1]).toEqual({
      id: b.id, name: 'Los Valientes', color: 7, priority: 'solo_tomate', seed: 'tomate', zone: { c0: 0, c1: 2, r0: 0, r1: 1 },
    });
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

/** un huerto a media temporada con un rey en cada oficio que se pide (el recolector, glotón) */
function midSeason(rng: Rng, kings: Partial<Record<JobId, number>>) {
  const s = createState(rng);
  for (const [job, tasks] of Object.entries(kings) as [JobId, number][]) {
    const g = hireFree(s, job, rng, job === 'recolector' ? 'gloton' : 'currante');
    g.stats.tasks = tasks;
    s.crowns[job] = g.id;
  }
  s.coins = 777;
  s.totalEarned = seedsCoinsNeeded(9);
  s.seasonTime = 3600;
  s.house = 2;
  s.tree.bancal = 3;
  s.tree.botas = 2;
  return s;
}

describe('temporadas', () => {
  it('las semillas crecen con lo ganado, cada vez más despacio, y por debajo del mínimo no se puede acabar', () => {
    const s = createState(seeded(30));
    s.totalEarned = seedsCoinsNeeded(PRESTIGE.minSeeds) - 1;
    expect(seasonSeeds(s)).toBe(PRESTIGE.minSeeds - 1);
    expect(canEndSeason(s)).toBe(false);
    s.totalEarned += 1;
    expect(seasonSeeds(s)).toBe(PRESTIGE.minSeeds);
    expect(canEndSeason(s)).toBe(true);
    const few = seasonSeeds(s);
    s.totalEarned *= 4;
    expect(seasonSeeds(s)).toBeGreaterThan(few);
    expect(seasonSeeds(s)).toBeLessThan(few * 4);
  });

  it('acabar la temporada empieza de cero pero guarda lo permanente, las semillas y el salón de la fama', () => {
    const rng = seeded(31);
    const s = midSeason(rng, { recolector: 50, sembrador: 30 });
    s.prestige.goldenSeeds = 4;
    s.prestige.lifetimeEarned = 1000;
    const rec = s.gnomes.find(g => g.job === 'recolector')!;
    const n = endSeason(s, rng);
    expect(n.coins).toBe(0);
    expect(n.totalEarned).toBe(0);
    expect(n.seasonTime).toBe(0);
    expect(n.gnomes).toEqual([]);
    expect(n.house).toBe(0);
    expect(NODE_IDS.every(id => n.tree[id] === 0)).toBe(true);
    expect(n.prestige.season).toBe(2);
    expect(n.prestige.goldenSeeds).toBe(4 + 9);
    expect(n.prestige.lifetimeEarned).toBe(1000 + s.totalEarned);
    expect(n.prestige.history[0]).toMatchObject({ season: 1, earned: s.totalEarned, seconds: 3600, seeds: 9 });
    expect(n.prestige.history[0].crowned).toContainEqual({ job: 'recolector', name: rec.name, tasks: 50, legendary: false });
    expect(n.prestige.veterans).toEqual([]);
    expect(n.events).toContainEqual({ type: 'season', season: 2 });
    // el huerto viejo no se toca
    expect(s.coins).toBe(777);
  });

  it('los talentos de herencia se aplican al empezar y los veteranos vuelven con su nombre y su carácter', () => {
    const rng = seeded(32);
    const s = midSeason(rng, { recolector: 50, sembrador: 30 });
    Object.assign(s.prestige.talents, { herencia: 2, experiencia: 1, semillasConocidas: 2, bancalHeredado: 1, casaHeredada: 1, veterano: 1 });
    const king = s.gnomes.find(g => g.job === 'recolector')!;
    const n = endSeason(s, rng);
    expect(n.coins).toBe(2 * TALENT_EFFECT.herencia);
    expect(n.tree).toMatchObject({ trigo: 1, fresa: 1, tomate: 0, bancal: 1 });
    expect(n.house).toBe(1);
    // el veterano llega el primero; luego los gnomos con experiencia, gratis y sin encarecer el siguiente
    expect(n.gnomes.map(g => g.job)).toEqual(['recolector', 'recolector', 'sembrador']);
    expect(n.gnomes[0]).toMatchObject({ name: king.name, trait: 'gloton', legendary: false });
    expect(n.prestige.veterans).toEqual([{ name: king.name, job: 'recolector', trait: 'gloton', legendary: false, seasons: 1 }]);
    expect(hireCost(n, 'recolector')).toBe(JOBS.recolector.base);

    // si vuelve a coronarse, suma otra temporada
    n.gnomes[0].stats.tasks = 99;
    n.crowns.recolector = n.gnomes[0].id;
    n.totalEarned = seedsCoinsNeeded(PRESTIGE.minSeeds);
    const third = endSeason(n, rng);
    expect(third.prestige.veterans).toMatchObject([{ name: king.name, seasons: 2 }]);
    expect(third.gnomes[0].name).toBe(king.name);
  });

  it('los talentos cuestan semillas, piden a su padre y algunos se notan en el acto', () => {
    const s = createState(seeded(33));
    expect(buyTalent(s, 'herencia')).toBe(false);
    s.prestige.goldenSeeds = 100;
    expect(talentReachable(s, 'experiencia')).toBe(false);
    expect(buyTalent(s, 'experiencia')).toBe(false);
    const cost = talentCost(s, 'herencia');
    expect(cost).toBe(TALENTS.herencia.base);
    expect(buyTalent(s, 'herencia')).toBe(true);
    expect(s.prestige.goldenSeeds).toBe(100 - cost);
    expect(talentCost(s, 'herencia')).toBe(Math.floor(TALENTS.herencia.base * TALENTS.herencia.mult));
    expect(buyTalent(s, 'experiencia')).toBe(true);
    for (let i = 0; i < 10; i++) buyTalent(s, 'experiencia');
    expect(s.prestige.talents.experiencia).toBe(TALENTS.experiencia.max);

    const value = cropValue(s, 'zanahoria');
    const hired = { ...s, hired: { ...s.hired, recolector: 5 } };
    const before = hireCost(hired, 'recolector');
    buyTalent(s, 'mercadoDorado');
    buyTalent(s, 'contrato');
    expect(cropValue(s, 'zanahoria')).toBeCloseTo(value * (1 + TALENT_EFFECT.mercadoDorado));
    expect(hireCost(hired, 'recolector')).toBeLessThan(before);
    expect(hireCost(hired, 'recolector')).toBe(Math.floor(JOBS.recolector.base * (COST_GROWTH - TALENT_EFFECT.contrato) ** 5));
  });
});

describe('guardado v6', () => {
  it('una partida v5 carga como la primera temporada', () => {
    const rng = seeded(34);
    const s = createState(rng);
    hireFree(s, 'recolector', rng);
    s.coins = 321;
    const old = JSON.parse(JSON.stringify(serialize(s)));
    old.v = 5;
    delete old.seasonTime;
    delete old.prestige;
    const loaded = deserialize(old, rng)!;
    expect(loaded.coins).toBe(321);
    expect(loaded.seasonTime).toBe(0);
    expect(loaded.prestige).toMatchObject({ season: 1, goldenSeeds: 0, history: [], veterans: [], lifetimeEarned: 0 });
    expect(Object.values(loaded.prestige.talents).every(l => l === 0)).toBe(true);
  });

  it('lo permanente se guarda y una partida rota no regala nada', () => {
    const rng = seeded(35);
    const s = midSeason(rng, { recolector: 50 });
    s.prestige.talents.veterano = 1;
    const n = endSeason(s, rng);
    n.seasonTime = 42;
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(n))), rng)!;
    expect(loaded.prestige).toEqual(n.prestige);
    expect(loaded.seasonTime).toBe(42);

    const bad = JSON.parse(JSON.stringify(serialize(n)));
    bad.prestige.talents.veterano = 99;
    bad.prestige.goldenSeeds = 'muchas';
    bad.prestige.history = Array.from({ length: 30 }, () => n.prestige.history[0]);
    const fixed = deserialize(bad, rng)!;
    expect(fixed.prestige.talents.veterano).toBe(TALENTS.veterano.max);
    expect(fixed.prestige.goldenSeeds).toBe(0);
    expect(fixed.prestige.history).toHaveLength(PRESTIGE.historyMax);
  });
});
