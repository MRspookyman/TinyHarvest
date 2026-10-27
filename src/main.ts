import './style.css';
import { Application, TextureSource } from 'pixi.js';
import { SceneView } from './render/scene';
import { buildAtlas } from './render/sprites';
import { clearGame, loadGame, saveGame } from './save';
import {
  buyHouse, buyNode, clickPlot, createGroup, cropUnlocked, deleteGroup, hire, hireCost, houseCapacity, houseCost, houseMaxed,
  moveGnome, nodeCost, renameGroup, setGroupColor, setGroupSeed, setPriority, tick,
} from './sim/sim';
import { createState } from './sim/state';
import type { CropId, GameState } from './sim/types';
import type { GameActions } from './ui/dom';
import { createHud } from './ui/hud';
import { createDiaryMenu } from './ui/menus/diary';
import { createGroupsMenu } from './ui/menus/groups';
import { createHireMenu } from './ui/menus/hire';
import { createRankingMenu } from './ui/menus/ranking';
import { createTreeMenu } from './ui/menus/tree';
import { createWindows } from './ui/windows';

const rng = Math.random;
// Con el juego cerrado o la pestaña oculta no se avanza: el paso máximo por fotograma es corto
// y no se recupera el tiempo perdido.
const MAX_DT = 0.1;
const SAVE_EVERY = 10;

async function start() {
  TextureSource.defaultOptions.scaleMode = 'nearest';

  const devParams = import.meta.env.DEV && location.search.length > 1;
  let state = (devParams ? null : loadGame(rng)) ?? createState(rng);
  if (devParams) applyDevParams(state);
  let seed: CropId = 'zanahoria';
  // solo en desarrollo: acceso al estado desde la consola para revisar (window.__th.state)
  if (import.meta.env.DEV) Object.assign(window, { __th: { get state() { return state; } } });

  const stageEl = document.getElementById('stage')!;
  const app = new Application();
  await app.init({ resizeTo: stageEl, background: '#38b764', antialias: false, roundPixels: true });
  stageEl.prepend(app.canvas);
  await document.fonts.load('16px "Pixelify Sans"').catch(() => undefined);

  const scene = new SceneView(app, buildAtlas());

  const actions: GameActions = {
    hire: job => hire(state, job, rng),
    buyNode: id => buyNode(state, id),
    buyHouse: () => buyHouse(state),
    createGroup: () => createGroup(state),
    renameGroup: (id, name) => renameGroup(state, id, name),
    setGroupColor: (id, color) => setGroupColor(state, id, color),
    setPriority: (id, p) => setPriority(state, id, p),
    setGroupSeed: (id, crop) => setGroupSeed(state, id, crop),
    deleteGroup: id => deleteGroup(state, id),
    moveGnome: (gnome, group) => moveGnome(state, gnome, group),
    selectSeed: crop => {
      if (cropUnlocked(state, crop)) seed = crop;
    },
    reset: () => {
      clearGame();
      state = createState(rng);
      seed = 'zanahoria';
      scene.reset();
      windows.close();
    },
  };

  const windows = createWindows(stageEl, {
    contratar: createHireMenu(actions),
    grupos: createGroupsMenu(actions),
    arbol: createTreeMenu(actions),
    diario: createDiaryMenu(actions),
    ranking: createRankingMenu(),
  });
  const hud = createHud(document.getElementById('topbar')!, stageEl, actions, m => windows.open(m));

  scene.onPlotClick = id => clickPlot(state, id, seed);
  scene.onOpenMenu = m => windows.open(m);

  let sinceSave = 0;
  app.ticker.add(ticker => {
    const dt = Math.min(ticker.deltaMS / 1000, MAX_DT);
    tick(state, dt, rng);
    if (!cropUnlocked(state, seed)) seed = 'zanahoria';
    scene.sync(state, dt);
    hud.update(state, seed, windows.current);
    windows.update(state);
    sinceSave += dt;
    if (sinceSave >= SAVE_EVERY) {
      sinceSave = 0;
      saveGame(state);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveGame(state);
  });
  window.addEventListener('pagehide', () => saveGame(state));
}

/**
 * Solo en desarrollo, para revisar sin jugar desde cero:
 * ?monedas=500&recolectores=3&sembradores=1&porteadores=1&bancal=4&casa=2
 * (porteadores y bancal compran también lo necesario en el árbol; casa amplía la casa de gnomos N niveles,
 * y si los gnomos pedidos no caben, se amplía lo que haga falta)
 */
function applyDevParams(state: GameState) {
  const q = new URLSearchParams(location.search);
  const n = (k: string) => Math.max(0, Math.floor(Number(q.get(k)) || 0));
  const freeHouse = () => {
    state.coins += houseCost(state);
    return buyHouse(state);
  };
  if (n('porteadores')) {
    for (const id of ['botas', 'saco', 'porteadores'] as const) {
      state.coins += nodeCost(state, id);
      buyNode(state, id);
    }
  }
  for (let i = 0; i < n('bancal'); i++) {
    state.coins += nodeCost(state, 'bancal');
    buyNode(state, 'bancal');
  }
  for (let i = 0; i < n('casa'); i++) freeHouse();
  const jobs = { recolectores: 'recolector', sembradores: 'sembrador', porteadores: 'porteador' } as const;
  for (const [param, job] of Object.entries(jobs)) {
    for (let i = 0; i < n(param); i++) {
      while (state.gnomes.length >= houseCapacity(state) && !houseMaxed(state)) freeHouse();
      state.coins += hireCost(state, job);
      hire(state, job, rng);
    }
  }
  state.coins += n('monedas');
}

start();
