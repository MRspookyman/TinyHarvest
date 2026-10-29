import { describe, expect, it } from 'vitest';
import {
  APHID, AWAY, BASKET, COST_GROWTH, CROPS, CROW_EAT, CROW_REACH, CROWN_MARGIN, FIELD, HOUSE, JOB_IDS, JOB_NODE, JOBS, MAX_GNOMES, MAX_GROUPS,
  MARKET, MEET_COOLDOWN, MERCADO_PER_LEVEL, MOLE_TIME, NODE_IDS, ORG, PRESTIGE, RIPE, ROTTEN, TALENT_EFFECT, TALENTS, TREE, WATER, GOLDEN, ZONE_BONUS,
  MASTERY, ALBUM, RALLY, ORDERS, FRIENDS, SEASONS, SKILL, BUBBLES, WORK_EFFECT, WORK_IDS, WORK_MAX, WORKS,
} from './config';
import {
  aphidOn, applyAway, basketMax, buyHouse, buyNode, buyTalent, canEndSeason, clickPlot, createGroup, cropValue, deleteGroup, endSeason, fieldSize,
  hire, hireCost, houseCapacity, isOpen, masteryLevel, moveGnome, nextGoal, nodeCost, nodeReachable, plotAt, plotStand, renameGroup, seasonSeeds,
  seedsCoinsNeeded, setGroupColor, setGroupSeed, setGroupZone, setPriority, stageTime, startEvent, talentCost, talentReachable, tick, turfBonus, waterTime,
  rally, gnomeWalkSpeed, gnomeWorkMult, seasonOf, favoriteCrop, marketMult, marketWindow, noteSale, skillBonus,
  buyWork, treeComplete, workCost, workSeeds,
} from './sim';
import { createState, deserialize, SAVE_VERSION, serialize } from './state';
import { LOG } from '../textos';
import type { CropId, GameState, JobId, Rng, TraitId } from './types';

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
/** momento de guardado fijo para los tests */
const SAVED_AT = 1_700_000_000_000;

describe('destreza', () => {
  it('con zona y semilla llega al tope; repetir valores no reinicia y cambiarlos sí', () => {
    const rng = seeded(65), s = createState(rng);
    const g = hireFree(s, 'recolector', rng);
    park(g);
    const group = s.groups[0], zone = { c0: 0, c1: 1, r0: 0, r1: 2 };
    setGroupZone(s, group.id, zone);
    setGroupSeed(s, group.id, 'zanahoria');
    const speed = gnomeWalkSpeed(s, g), work = gnomeWorkMult(s, g);
    run(s, SKILL.max / SKILL.perMin * 60 + 1, rng);
    expect(skillBonus(s, g)).toBeCloseTo(SKILL.max);
    expect(gnomeWorkMult(s, g)).toBeLessThan(work);
    expect(gnomeWalkSpeed(s, g)).toBe(speed);
    const skill = group.skill;
    setGroupZone(s, group.id, { ...zone });
    setGroupSeed(s, group.id, 'zanahoria');
    expect(group.skill).toBe(skill);
    expect(deserialize(serialize(s, SAVED_AT), rng)!.groups[0].skill).toBe(skill);
    s.tree.trigo = 1;
    setGroupSeed(s, group.id, 'trigo');
    expect(group.skill).toBe(0);
    run(s, 1, rng);
    setGroupZone(s, group.id, null);
    expect(group.skill).toBe(0);
  });

  it('sin zona no acumula destreza y las partidas antiguas empiezan a cero', () => {
    const rng = seeded(66), s = createState(rng);
    setGroupSeed(s, s.groups[0].id, 'zanahoria');
    run(s, 10, rng);
    expect(s.groups[0].skill).toBe(0);
    const raw = JSON.parse(JSON.stringify(serialize(s, SAVED_AT)));
    delete raw.groups[0].skill;
    expect(deserialize(raw, rng)!.groups[0].skill).toBe(0);
  });
});

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
    const old = JSON.parse(JSON.stringify(serialize(s, SAVED_AT)));
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
    run(s, 9, rng);
    // arrancada y replantada (puede que ya esté creciendo o madura, pero no podrida)
    expect(rotten.stage).toBeGreaterThanOrEqual(0);
    expect(rotten.stage).not.toBe(ROTTEN);
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

  it('la maestría sube con las cosechas de la temporada, encarece ese cultivo y se pierde al acabar la temporada', () => {
    const rng = seeded(43);
    const s = createState(rng);
    const base = cropValue(s, 'zanahoria');
    for (const p of s.plots) p.stage = -1;
    const p = s.plots[0];
    for (let i = 0; i < MASTERY.steps[0]; i++) {
      Object.assign(p, { stage: RIPE, t: 0 });
      clickPlot(s, p.id, 'zanahoria');
    }
    expect(masteryLevel(s, 'zanahoria')).toBe(1);
    expect(cropValue(s, 'zanahoria')).toBeCloseTo(base * (1 + MASTERY.bonus));
    expect(cropValue(s, 'trigo')).toBeCloseTo(CROPS.trigo.value * s.org.mult);
    expect(s.events.some(e => e.type === 'mastery' && e.crop === 'zanahoria' && e.level === 1)).toBe(true);
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(s, SAVED_AT))), rng)!;
    expect(loaded.mastery.zanahoria).toBe(MASTERY.steps[0]);
    s.totalEarned = seedsCoinsNeeded(PRESTIGE.minSeeds);
    expect(masteryLevel(endSeason(s, rng), 'zanahoria')).toBe(0);
  });

  it('el álbum pega cada cromo una vez, premia la página completa una sola vez y dura entre temporadas', () => {
    const rng = seeded(44);
    const s = createState(rng);
    s.coins = 1e9;
    for (const n of NODE_IDS) s.tree[n] = 1;
    s.house = HOUSE.max;
    // un gnomo de cada oficio: página de oficios completa
    for (const j of JOB_IDS) hire(s, j, rng);
    hire(s, 'recolector', rng);
    expect(s.prestige.album.filter(id => id.startsWith('oficios:'))).toHaveLength(JOB_IDS.length);
    expect(s.prestige.album).toContain('pagina:oficios');
    expect(s.prestige.goldenSeeds).toBe(ALBUM.pageSeeds);
    expect(s.events.filter(e => e.type === 'sticker' && e.page === 'oficios')).toHaveLength(1);
    // los sucesos también son cromos
    expect(startEvent(s, 'caracol', rng)).toBe(true);
    expect(s.prestige.album).toContain('sucesos:caracol');
    // al cargar se queda lo válido; en la temporada siguiente sigue ahí
    const raw = JSON.parse(JSON.stringify(serialize(s, SAVED_AT)));
    raw.prestige.album.push('inventado:1', 42);
    const loaded = deserialize(raw, rng)!;
    expect(loaded.prestige.album).toEqual(s.prestige.album);
    s.totalEarned = seedsCoinsNeeded(PRESTIGE.minSeeds);
    expect(endSeason(s, rng).prestige.album).toEqual(expect.arrayContaining(s.prestige.album));
  });

  it('la arenga acelera a todos un rato y no se puede repetir hasta que se recarga', () => {
    const rng = seeded(45);
    const s = createState(rng);
    expect(rally(s, rng)).toBe(false); // sin gnomos no hay a quién animar
    const g = hireFree(s, 'recolector', rng);
    const walk = gnomeWalkSpeed(s, g), work = gnomeWorkMult(s, g);
    expect(rally(s, rng)).toBe(true);
    expect(gnomeWalkSpeed(s, g)).toBeCloseTo(walk * (1 + RALLY.mult));
    expect(gnomeWorkMult(s, g)).toBeCloseTo(work / (1 + RALLY.mult));
    expect(rally(s, rng)).toBe(false);
    run(s, RALLY.duration + 1, rng);
    expect(gnomeWalkSpeed(s, g)).toBeCloseTo(walk);
    expect(rally(s, rng)).toBe(false);
    run(s, RALLY.cooldown - RALLY.duration, rng);
    expect(rally(s, rng)).toBe(true);
  });

  it('un encargo pide un cultivo sembrado, paga al cumplirse y si caduca se va sin quitar nada', () => {
    const rng = seeded(46);
    const s = createState(rng);
    for (const p of s.plots) p.stage = isOpen(s, p) ? 0 : -1;
    s.nextOrderIn = 0.01;
    tick(s, 0.1, rng);
    const o = s.order!;
    expect(o).toMatchObject({ crop: 'zanahoria', have: 0 });
    expect(o.need).toBeGreaterThanOrEqual(ORDERS.min);
    // se cumple con cosechas de ese cultivo, a mano o con gnomos
    const coins = s.coins;
    const p = s.plots[0];
    for (let i = 0; i < o.need; i++) {
      Object.assign(p, { stage: RIPE, t: 0, golden: false });
      clickPlot(s, p.id, 'zanahoria');
    }
    expect(s.order).toBe(null);
    expect(s.coins - coins).toBeGreaterThan(o.reward);
    expect(s.events.some(e => e.type === 'order' && e.done)).toBe(true);
    // el siguiente caduca: se va sin más
    s.nextOrderIn = 0.01;
    tick(s, 0.1, rng);
    const before = s.coins;
    s.order!.t = 0.05;
    tick(s, 0.1, rng);
    expect(s.order).toBe(null);
    expect(s.coins).toBeGreaterThanOrEqual(before);
  });

  it('dos gnomos que se tratan se hacen amigos, y en el mismo grupo trabajan más rápido; se guarda', () => {
    const rng = seeded(47);
    const s = createState(rng);
    const a = hireFree(s, 'recolector', rng, 'cotilla');
    const b = hireFree(s, 'recolector', rng);
    const work = gnomeWorkMult(s, a);
    // se cruzan una y otra vez paseando hasta hacerse amigos
    for (let i = 0; i < 40 && a.friend === null; i++) {
      for (const g of [a, b]) Object.assign(g, { state: 'walk', task: { kind: 'wander' }, x: 60, y: 120, tx: 90, ty: 120 });
      tick(s, 0.05, rng);
      a.bubble = b.bubble = null;
      // sin esperar la pausa entre encuentros: el reloj propio de cada gnomo pasa de golpe
      for (const g of [a, b]) g.t += MEET_COOLDOWN;
    }
    expect(a.friend).toBe(b.id);
    expect(b.friend).toBe(a.id);
    expect(gnomeWorkMult(s, a)).toBeCloseTo(work / (1 + FRIENDS.bonus));
    const c = createGroup(s)!;
    moveGnome(s, b.id, c.id);
    expect(gnomeWorkMult(s, a)).toBeCloseTo(work);
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(s, SAVED_AT))), rng)!;
    expect(loaded.gnomes.find(g => g.id === a.id)!.friend).toBe(b.id);
  });

  it('cada temporada es una estación con su cultivo favorito, que vale más', () => {
    const s = createState(seeded(48));
    expect(seasonOf(s)).toBe('primavera');
    const fav = favoriteCrop(s);
    expect(cropValue(s, fav)).toBeCloseTo(CROPS[fav].value * (1 + SEASONS.bonus) * s.org.mult);
    s.prestige.season = 2;
    expect(seasonOf(s)).toBe('verano');
    expect(cropValue(s, fav)).toBeCloseTo(CROPS[fav].value * s.org.mult);
    s.prestige.season = 5;
    expect(seasonOf(s)).toBe('primavera');
  });

  it('el próximo objetivo es la mejora más barata; con el árbol completo, la obra más barata; con todo, la siguiente semilla', () => {
    const s = createState(seeded(42));
    const reachable = NODE_IDS.filter(id => nodeReachable(s, id));
    const cheapest = reachable.reduce((a, b) => (nodeCost(s, b) < nodeCost(s, a) ? b : a));
    expect(nextGoal(s)).toMatchObject({ kind: 'node', id: cheapest, need: nodeCost(s, cheapest) });
    for (const id of NODE_IDS) s.tree[id] = TREE[id].max;
    expect(nextGoal(s)).toMatchObject({ kind: 'work', id: 'molino', need: WORKS.molino.costs[0] });
    s.works.molino = 1;
    expect(nextGoal(s)).toMatchObject({ kind: 'work', id: 'invernadero', need: WORKS.invernadero.costs[0] });
    for (const id of WORK_IDS) s.works[id] = WORK_MAX;
    s.totalEarned = seedsCoinsNeeded(3);
    expect(nextGoal(s)).toMatchObject({ kind: 'seed', seeds: 4, need: seedsCoinsNeeded(4) });
  });
});

describe('obras', () => {
  const completeTree = (s: GameState) => {
    for (const id of NODE_IDS) s.tree[id] = TREE[id].max;
  };

  it('sin el árbol completo no se construye; al completarlo se avisa', () => {
    const s = createState(seeded(90));
    s.coins = 1e9;
    expect(treeComplete(s)).toBe(false);
    expect(buyWork(s, 'molino')).toBe(false);
    expect(s.works.molino).toBe(0);
    completeTree(s);
    s.tree.botas--;
    expect(buyNode(s, 'botas')).toBe(true);
    expect(treeComplete(s)).toBe(true);
    expect(s.log[0]).toBe(LOG.obrasAbiertas);
  });

  it('cada nivel cuesta lo suyo, hasta el tercero, y da una semilla más al acabar; la temporada nueva empieza sin obras', () => {
    const rng = seeded(91), s = createState(rng);
    completeTree(s);
    s.totalEarned = seedsCoinsNeeded(PRESTIGE.minSeeds);
    const base = seasonSeeds(s);
    s.coins = WORKS.molino.costs.reduce((a, b) => a + b, 0);
    for (let i = 0; i < WORK_MAX; i++) {
      const cost = workCost(s, 'molino'), before = s.coins;
      expect(cost).toBe(WORKS.molino.costs[i]);
      expect(buyWork(s, 'molino')).toBe(true);
      expect(s.coins).toBe(before - cost);
    }
    expect(s.coins).toBe(0);
    s.coins = 1e9;
    expect(buyWork(s, 'molino')).toBe(false);
    expect(s.works.molino).toBe(WORK_MAX);
    expect(workSeeds(s)).toBe(3);
    expect(seasonSeeds(s)).toBe(base);
    const n = endSeason(s, rng);
    expect(n.prestige.goldenSeeds).toBe(base + 3);
    expect(n.prestige.history[0].seeds).toBe(base + 3);
    for (const id of WORK_IDS) expect(n.works[id]).toBe(0);
  });

  it('no se compra sin monedas suficientes', () => {
    const s = createState(seeded(92));
    completeTree(s);
    s.coins = WORKS.fuente.costs[0] - 1;
    expect(buyWork(s, 'fuente')).toBe(false);
    expect(s.coins).toBe(WORKS.fuente.costs[0] - 1);
  });

  it('las semillas de las obras cuentan para poder acabar la temporada', () => {
    const s = createState(seeded(93));
    s.totalEarned = seedsCoinsNeeded(PRESTIGE.minSeeds - 1);
    expect(canEndSeason(s)).toBe(false);
    s.works.fuente = 1;
    expect(canEndSeason(s)).toBe(true);
  });

  it('molino, invernadero y fuente cambian mercado, crecimiento y riego', () => {
    const s = createState(seeded(94));
    const window = marketWindow(s), stage = stageTime(s, 'zanahoria'), water = waterTime(s);
    s.works = { molino: 2, invernadero: 3, fuente: 1 };
    expect(marketWindow(s)).toBeCloseTo(window / (1 + 2 * WORK_EFFECT.molino));
    expect(stageTime(s, 'zanahoria')).toBeCloseTo(stage / (1 + 3 * WORK_EFFECT.invernadero));
    expect(waterTime(s)).toBeCloseTo(water * (1 + WORK_EFFECT.fuente));
  });

  it('con la fuente a nivel 3 el regador no vuelve al pozo; con menos, sí', () => {
    for (const fuente of [WORK_MAX - 1, WORK_MAX]) {
      const rng = seeded(95), s = createState(rng);
      s.tree.tomate = 1;
      s.works.fuente = fuente;
      for (const p of s.plots) if (isOpen(s, p)) Object.assign(p, { crop: 'tomate', stage: 0, t: 0 });
      else p.stage = -1;
      const g = hireFree(s, 'regador', rng);
      let waterings = 0, refills = 0;
      for (let i = 0; i < 90 * 30; i++) {
        const was = g.task?.kind;
        tick(s, 1 / 30, rng);
        waterings += s.events.filter(e => e.type === 'water').length;
        s.events.length = 0;
        if (g.task?.kind === 'refill' && was !== 'refill') refills++;
      }
      expect(waterings).toBeGreaterThan(WATER.can);
      if (fuente >= WORK_MAX) expect(refills).toBe(0);
      else expect(refills).toBeGreaterThan(0);
    }
  });

  it('se guardan y las partidas sin obras cargan a cero', () => {
    const rng = seeded(96), s = createState(rng);
    s.works = { molino: 3, invernadero: 1, fuente: 2 };
    expect(deserialize(serialize(s, SAVED_AT), rng)!.works).toEqual({ molino: 3, invernadero: 1, fuente: 2 });
    const raw = JSON.parse(JSON.stringify(serialize(s, SAVED_AT)));
    raw.works = { molino: 9, invernadero: -2, fuente: 'x' };
    expect(deserialize(raw, rng)!.works).toEqual({ molino: WORK_MAX, invernadero: 0, fuente: 0 });
    delete raw.works;
    expect(raw.v).toBe(SAVE_VERSION);
    expect(deserialize(raw, rng)!.works).toEqual({ molino: 0, invernadero: 0, fuente: 0 });
  });
});

describe('vuelta', () => {
  it('el ritmo sigue a lo ganado y un tick sin tiempo no lo estropea', () => {
    const rng = seeded(97), s = createState(rng);
    for (const p of s.plots) p.stage = isOpen(s, p) ? RIPE : -1;
    run(s, 1, rng);
    expect(s.rate).toBe(0);
    hireFree(s, 'recolector', rng);
    run(s, 60, rng);
    expect(s.totalEarned).toBeGreaterThan(0);
    // la media empieza en 0 y se acerca a lo ganado por segundo sin pasarse
    expect(s.rate).toBeGreaterThan(0);
    expect(s.rate).toBeLessThanOrEqual(s.totalEarned / 60);
    const rate = s.rate;
    tick(s, 0, rng);
    expect(s.rate).toBe(rate);
    // sin ganar nada, el ritmo se va olvidando
    s.gnomes.length = 0;
    run(s, AWAY.window / 10, rng);
    expect(s.rate).toBeLessThan(rate);
    expect(s.rate).toBeGreaterThan(0);
  });

  it('da una parte del ritmo con tope de tiempo, sin sumar a lo ganado ni a las semillas', () => {
    const rng = seeded(98), s = createState(rng);
    s.rate = 10;
    s.coins = 5;
    s.totalEarned = 77;
    const log = s.log.length;
    expect(applyAway(s, 10_000)).toBe(36_000);
    expect(s.coins).toBe(36_005);
    expect(s.totalEarned).toBe(77);
    expect(s.log.length).toBe(log + 1);
    expect(s.log[0]).toBe(LOG.vuelta(36_000));
    expect(applyAway(s, 1000)).toBe(Math.floor(10 * AWAY.share * 1000));
  });

  it('poco rato fuera o sin ritmo no da nada', () => {
    const rng = seeded(99), s = createState(rng);
    s.rate = 10;
    expect(applyAway(s, 30)).toBe(0);
    expect(applyAway(s, Number.NaN)).toBe(0);
    s.rate = 0;
    expect(applyAway(s, 3600)).toBe(0);
    expect(s.coins).toBe(0);
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
    s.rate = 3.25;
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(s, SAVED_AT))), rng)!;
    expect(loaded.coins).toBe(s.coins);
    expect(loaded.tree).toEqual(s.tree);
    expect(fieldSize(loaded)).toEqual(fieldSize(s));
    expect(loaded.basket).toEqual(['trigo', 'zanahoria']);
    expect(loaded.plots[3]).toMatchObject({ crop: 'tomate', stage: 2 });
    expect(loaded.plots[4].stage).toBe(ROTTEN);
    expect(loaded.groups[1]).toMatchObject({
      id: b.id, name: 'Los Valientes', color: 7, priority: 'solo_tomate', seed: 'tomate', zone: { c0: 0, c1: 2, r0: 0, r1: 1 },
    });
    expect(loaded.gnomes[0]).toMatchObject({ name: g.name, job: 'porteador', group: b.id, state: 'think' });
    expect(loaded.gnomes[0].stats).toMatchObject({ tasks: 9, walked: 120 });
    expect(loaded).toMatchObject({ rotted: 3, crowns: { porteador: g.id, recolector: null } });
    expect(loaded.nextId).toBe(s.nextId);
    expect(loaded.nextGroupId).toBe(s.nextGroupId);
    expect(loaded.rate).toBe(3.25);
    expect(loaded.savedAt).toBe(SAVED_AT);
  });

  it('una partida v6 sin destreza, obras, ritmo ni momento de guardado carga con ceros', () => {
    const rng = seeded(8);
    const s = createState(rng);
    s.groups[0].skill = 100;
    s.works.molino = 2;
    s.rate = 4;
    const raw = JSON.parse(JSON.stringify(serialize(s, SAVED_AT)));
    for (const g of raw.groups) delete g.skill;
    delete raw.works;
    delete raw.rate;
    delete raw.savedAt;
    expect(raw.v).toBe(SAVE_VERSION);
    const loaded = deserialize(raw, rng)!;
    expect(loaded.groups[0].skill).toBe(0);
    expect(loaded.works).toEqual({ molino: 0, invernadero: 0, fuente: 0 });
    expect(loaded).toMatchObject({ rate: 0, savedAt: 0 });
  });

  it('carga las partidas v3 (sin semilla, estadísticas, podredumbre ni rasgos) y les reparte rasgos', () => {
    const rng = seeded(7);
    const s = createState(rng);
    const g = hireFree(s, 'recolector', rng);
    const old = JSON.parse(JSON.stringify(serialize(s, SAVED_AT)));
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
    expect(serialize(loaded, SAVED_AT).v).toBe(SAVE_VERSION);
  });

  it('guarda el rasgo y si es legendario', () => {
    const rng = seeded(7);
    const s = createState(rng);
    const g = hireFree(s, 'sembrador', rng, 'dormilon');
    g.legendary = true;
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(s, SAVED_AT))), rng)!;
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

  it('los bocadillos de rutina salen de vez en cuando y nunca más de BUBBLES.max a la vez', () => {
    const rng = seeded(3);
    const s = createState(rng);
    s.tree.bancal = TREE.bancal.max;
    s.house = HOUSE.max;
    for (const p of s.plots) p.stage = isOpen(s, p) ? RIPE : -1;
    for (let i = 0; i < 12; i++) hireFree(s, 'recolector', rng);
    const routine = new Set(['crop', 'sack', 'basket', 'well', 'water']);
    let seen = 0, most = 0;
    for (let i = 0; i < 30 * 30; i++) {
      tick(s, 1 / 30, rng);
      const now = s.gnomes.filter(g => g.bubble && routine.has(g.bubble.kind)).length;
      most = Math.max(most, now);
      if (now) seen++;
    }
    expect(seen).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(BUBBLES.max);
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

  /** quieto descansando a dist px del sitio desde el que se espanta al cuervo: libre para espantarlo */
  function restingAt(s: GameState, rng: Rng, p: GameState['plots'][number], dist: number) {
    const g = hireFree(s, 'sembrador', rng);
    const st = plotStand(p);
    Object.assign(g, { x: st.x - dist, y: st.y, state: 'work', timer: 9999, task: { kind: 'rest' } });
    return g;
  }

  it(`un gnomo libre a más de CROW_REACH px no se entera: el cuervo come a los CROW_EAT s`, () => {
    const rng = seeded(12);
    const { s, p } = oneRipe(rng);
    const g = restingAt(s, rng, p, CROW_REACH + 20);
    expect(startEvent(s, 'cuervo', rng)).toBe(true);
    const crow = s.critters.find(c => c.kind === 'cuervo')!;
    for (let i = 0; i < 30 * 30 && crow.state !== 'stay'; i++) tick(s, 1 / 30, rng);
    expect(crow.state).toBe('stay');
    run(s, CROW_EAT - 0.5, rng);
    expect(p.stage).toBe(RIPE);
    run(s, 1, rng);
    expect(p.stage).toBe(-1);
    expect(g.task?.kind).toBe('rest');
  });

  it('un gnomo libre a 30 px sí va a espantar al cuervo', () => {
    const rng = seeded(12);
    const { s, p } = oneRipe(rng);
    const g = restingAt(s, rng, p, 30);
    expect(startEvent(s, 'cuervo', rng)).toBe(true);
    let shooed = false;
    for (let i = 0; i < (CROW_EAT + 8) * 30; i++) {
      tick(s, 1 / 30, rng);
      if (g.task?.kind === 'shoo') shooed = true;
    }
    expect(shooed).toBe(true);
    expect(p.stage).toBe(RIPE);
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

describe('pulgón', () => {
  /** lo que lleva crecido una parcela, en fases */
  const growth = (s: GameState, p: GameState['plots'][number]) => p.stage + p.t / stageTime(s, p.crop);
  const liveAphids = (s: GameState) => s.critters.filter(c => c.kind === 'pulgon' && c.state !== 'out').length;

  /** bancal vacío salvo calabazas recién plantadas en las parcelas dadas (sin gnomos: no hay más sucesos) */
  function pumpkins(rng: Rng, plots: [number, number][]) {
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    const ps = plots.map(([col, row]) => Object.assign(s.plots[plotId(col, row)], { crop: 'calabaza', stage: 0, t: 0 }));
    return { s, ps };
  }

  it('la planta con pulgones crece a medias', () => {
    const rng = seeded(31);
    const { s, ps } = pumpkins(rng, [[0, 0], [2, 2]]);
    expect(startEvent(s, 'pulgon', rng)).toBe(true);
    const plot = s.critters[0].plot;
    const sick = ps.find(p => p.id === plot)!;
    const fine = ps.find(p => p.id !== plot)!;
    // menos que APHID.spread: aún no ha saltado (y no hay vecinas creciendo)
    run(s, APHID.spread - 5, rng);
    expect(aphidOn(s, sick.id)).toBe(true);
    expect(aphidOn(s, fine.id)).toBe(false);
    expect(growth(s, sick) / growth(s, fine)).toBeCloseTo(APHID.slow, 2);
  });

  it('un clic espanta los pulgones y no cosecha', () => {
    const rng = seeded(32);
    const { s, ps: [p] } = pumpkins(rng, [[1, 1]]);
    expect(startEvent(s, 'pulgon', rng)).toBe(true);
    run(s, 1, rng);
    // aunque estuviera madura, el clic solo espanta
    p.stage = RIPE;
    p.t = 0;
    expect(clickPlot(s, p.id, 'zanahoria')).toBe('shoo');
    expect(aphidOn(s, p.id)).toBe(false);
    expect(p.stage).toBe(RIPE);
    expect(s.coins).toBe(0);
    run(s, 1, rng);
    expect(s.critters).toHaveLength(0);
    expect(clickPlot(s, p.id, 'zanahoria')).toBe('harvest');
  });

  it('cada APHID.spread s saltan a una vecina que esté creciendo', () => {
    const rng = seeded(34);
    const { s } = pumpkins(rng, [[1, 1], [0, 1], [2, 1], [1, 0], [1, 2]]);
    expect(startEvent(s, 'pulgon', rng)).toBe(true);
    const first = s.plots[s.critters[0].plot!];
    run(s, APHID.spread - 1, rng);
    expect(liveAphids(s)).toBe(1);
    run(s, 2, rng);
    expect(liveAphids(s)).toBe(2);
    const next = s.plots[s.critters[1].plot!];
    expect(Math.abs(next.col - first.col) + Math.abs(next.row - first.row)).toBe(1);
  });

  it('nunca hay más de APHID.max pulgones a la vez', () => {
    const rng = seeded(33);
    const s = createState(rng);
    s.tree.bancal = TREE.bancal.max;
    for (const p of s.plots) Object.assign(p, { crop: 'calabaza', stage: isOpen(s, p) ? 0 : -1, t: 0 });
    let started = 0, most = 0;
    for (let i = 0; i < 90 * 30; i++) {
      if (i % (5 * 30) === 0 && startEvent(s, 'pulgon', rng)) started++;
      tick(s, 1 / 30, rng);
      most = Math.max(most, liveAphids(s));
    }
    expect(started).toBeGreaterThanOrEqual(APHID.max);
    expect(most).toBe(APHID.max);
  });
});

describe('mercado', () => {
  /** desbloquea los cultivos dados (además de la zanahoria) */
  function unlocked(rng: Rng, crops: CropId[]) {
    const s = createState(rng);
    for (const c of crops) if (c !== 'zanahoria') s.tree[c] = 1;
    return s;
  }

  it('con un solo cultivo desbloqueado no hay castigo, ni tras 100 cosechas', () => {
    const rng = seeded(60);
    const s = createState(rng);
    for (const p of s.plots) p.stage = -1;
    const p = s.plots[0];
    for (let i = 0; i < 100; i++) {
      Object.assign(p, { stage: RIPE, t: 0 });
      expect(clickPlot(s, p.id, 'zanahoria')).toBe('harvest');
    }
    expect(s.market.zanahoria).toBe(100 * CROPS.zanahoria.value);
    expect(marketMult(s, 'zanahoria')).toBe(1);
    // no se guarda: al cargar, el mercado empieza de cero
    expect(deserialize(JSON.parse(JSON.stringify(serialize(s, SAVED_AT))), rng)!.market.zanahoria).toBe(0);
  });

  it('con tres cultivos y solo ventas de melón, el melón baja a MARKET.floor y lo demás no', () => {
    const rng = seeded(61);
    const s = unlocked(rng, ['trigo', 'melon']);
    const base = cropValue(s, 'melon');
    noteSale(s, 'melon', 100);
    expect(marketMult(s, 'melon')).toBeCloseTo(MARKET.floor);
    expect(marketMult(s, 'melon')).toBeCloseTo(0.6);
    expect(cropValue(s, 'melon')).toBeCloseTo(base * MARKET.floor);
    expect(marketMult(s, 'trigo')).toBe(1);
    expect(marketMult(s, 'zanahoria')).toBe(1);
  });

  it('repartido a partes iguales entre tres cultivos, no hay castigo', () => {
    const rng = seeded(62);
    const s = unlocked(rng, ['trigo', 'melon']);
    for (const c of ['zanahoria', 'trigo', 'melon'] as const) noteSale(s, c, 600 / CROPS[c].value);
    for (const c of ['zanahoria', 'trigo', 'melon'] as const) expect(marketMult(s, c)).toBeCloseTo(1);
  });

  it('por debajo de MARKET.minSample no castiga, y lo vendido se olvida con el tiempo', () => {
    const rng = seeded(63);
    const s = unlocked(rng, ['trigo', 'melon']);
    for (const p of s.plots) p.stage = -1;
    s.nextEventIn = 1e9;
    s.nextOrderIn = 1e9;
    noteSale(s, 'zanahoria', (MARKET.minSample - 1) / CROPS.zanahoria.value);
    expect(marketMult(s, 'zanahoria')).toBe(1);
    s.market.zanahoria = 1000;
    run(s, marketWindow(s), rng);
    expect(s.market.zanahoria).toBeCloseTo(1000 * Math.exp(-1), 0);
  });

  it('la entrega se cobra al precio de antes de apuntarla en el mercado', () => {
    const rng = seeded(64);
    const s = unlocked(rng, ['trigo', 'melon']);
    s.nextEventIn = 1e9;
    s.nextOrderIn = 1e9;
    for (const p of s.plots) p.stage = -1;
    Object.assign(s.plots[plotId(1, 1)], { crop: 'melon', stage: RIPE, t: 0 });
    const g = hireFree(s, 'recolector', rng);
    const before = s.coins;
    for (let i = 0; i < 60 * 30 && g.stats.delivered === 0; i++) tick(s, 1 / 30, rng);
    expect(g.stats.delivered).toBe(1);
    // un melón (60) ya supera MARKET.minSample: la siguiente venta saldría castigada, esta no
    const fav = favoriteCrop(s) === 'melon' ? 1 + SEASONS.bonus : 1;
    expectSold(s.coins - before, CROPS.melon.value * fav);
    expect(s.market.melon).toBeCloseTo(CROPS.melon.value);
    expect(marketMult(s, 'melon')).toBeCloseTo(MARKET.floor);
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
    // con cuervos al azar alguna cosecha se pierde: «bien» es claramente por encima de lo de antes, no perfecto
    expect(s.org.parts.cosecha).toBeGreaterThan(0.75);
  });
});

describe('guardado v5', () => {
  it('una partida v4 carga sin riego y con los oficios nuevos a cero', () => {
    const rng = seeded(25);
    const s = createState(rng);
    const g = hireFree(s, 'recolector', rng);
    s.plots[0].stage = 1;
    const old = JSON.parse(JSON.stringify(serialize(s, SAVED_AT)));
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
    expect(serialize(loaded, SAVED_AT).v).toBe(SAVE_VERSION);
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
    const old = JSON.parse(JSON.stringify(serialize(s, SAVED_AT)));
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
    const loaded = deserialize(JSON.parse(JSON.stringify(serialize(n, SAVED_AT))), rng)!;
    expect(loaded.prestige).toEqual(n.prestige);
    expect(loaded.seasonTime).toBe(42);

    const bad = JSON.parse(JSON.stringify(serialize(n, SAVED_AT)));
    bad.prestige.talents.veterano = 99;
    bad.prestige.goldenSeeds = 'muchas';
    bad.prestige.history = Array.from({ length: 30 }, () => n.prestige.history[0]);
    const fixed = deserialize(bad, rng)!;
    expect(fixed.prestige.talents.veterano).toBe(TALENTS.veterano.max);
    expect(fixed.prestige.goldenSeeds).toBe(0);
    expect(fixed.prestige.history).toHaveLength(PRESTIGE.historyMax);
  });
});
