import './style.css';
import { Application, TextureSource } from 'pixi.js';
import { SceneView } from './render/scene';
import { createSound } from './render/sound';
import { buildAtlas } from './render/sprites';
import { clearGame, loadGame, saveGame } from './save';
import {
  buyHouse, buyNode, buyTalent, canEndSeason, clickPlot, createGroup, cropUnlocked, deleteGroup, dismissOrder, endSeason, hire, hireCost,
  houseCapacity, houseCost, houseMaxed, moveGnome, nodeCost, plotOrigin, rally, renameGroup, setGroupColor, setGroupSeed, setGroupZone,
  setPriority, tick,
} from './sim/sim';
import { createState } from './sim/state';
import type { CropId, GameState } from './sim/types';
import type { GameActions } from './ui/dom';
import { flyCoins } from './ui/coinFly';
import { createGnomeCard } from './ui/gnomeCard';
import { createHud } from './ui/hud';
import { createAlbumMenu } from './ui/menus/album';
import { createDiaryMenu } from './ui/menus/diary';
import { createGroupsMenu } from './ui/menus/groups';
import { createHireMenu } from './ui/menus/hire';
import { createRankingMenu } from './ui/menus/ranking';
import { createSeasonMenu, createSeasonSummary } from './ui/menus/season';
import { createTreeMenu } from './ui/menus/tree';
import { createNotices } from './ui/notices';
import { createTutorial } from './ui/tutorial';
import { createWindows } from './ui/windows';
import { AVISOS } from './textos';

const rng = Math.random;
// Con el juego cerrado o la pestaña oculta no se avanza: el paso máximo por fotograma es corto
// y no se recupera el tiempo perdido.
const MAX_DT = 0.1;
const SAVE_EVERY = 10;

async function start() {
  TextureSource.defaultOptions.scaleMode = 'nearest';
  const stageEl = document.getElementById('stage')!;
  const notices = createNotices(stageEl);

  const devParams = import.meta.env.DEV && location.search.length > 1;
  const loaded = devParams ? { state: null } : loadGame(rng);
  let state = loaded.state ?? createState(rng);
  if (devParams) applyDevParams(state);
  // una partida ilegible sin copia apartada no se pisa hasta que el jugador lo decida
  let canSave = !loaded.unreadable || loaded.unreadable.backedUp;
  // tras un error en el bucle no se guarda: el estado puede estar a medias y la última copia buena es la del autoguardado
  let broken = false;
  let saveOk = true;
  const persist = () => {
    if (broken || !canSave) return;
    const ok = saveGame(state);
    if (ok === saveOk) return;
    saveOk = ok;
    if (ok) notices.hide('guardar');
    else notices.show('guardar', AVISOS.sinGuardar);
  };
  const allowSave = () => {
    canSave = true;
    notices.hide('ilegible');
    persist();
  };
  if (loaded.unreadable) {
    const { raw, backedUp } = loaded.unreadable;
    const download = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      a.download = 'tiny-harvest-partida-danada.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    if (backedUp) {
      notices.show('ilegible', AVISOS.ilegible, [
        { label: AVISOS.descargar, onClick: download },
        { label: AVISOS.entendido, onClick: () => notices.hide('ilegible') },
      ]);
    } else {
      notices.show('ilegible', AVISOS.ilegibleSinCopia, [
        { label: AVISOS.descargar, onClick: () => { download(); allowSave(); } },
        { label: AVISOS.sustituir, onClick: allowSave },
      ]);
    }
  }
  let seed: CropId = 'zanahoria';
  // solo en desarrollo: acceso al estado desde la consola para revisar (window.__th.state)
  if (import.meta.env.DEV) Object.assign(window, { __th: { get state() { return state; } } });

  const app = new Application();
  await app.init({ resizeTo: stageEl, background: '#38b764', antialias: false, roundPixels: true });
  stageEl.prepend(app.canvas);
  // La barra puede cambiar de altura al poblarse o envolver sus estadísticas.
  // resizeTo atiende al tamaño de ventana, no a los cambios del elemento anfitrión.
  new ResizeObserver(() => app.resize()).observe(stageEl);
  await document.fonts.load('16px "Pixelify Sans"').catch(() => undefined);

  const scene = new SceneView(app, buildAtlas());
  const sound = createSound();
  // cualquier botón de la interfaz hace un clic suave
  document.addEventListener('click', e => {
    if ((e.target as HTMLElement).closest('button')) sound.play('click');
  });
  /** compra con sonido: solo suena si de verdad se ha comprado */
  const bought = (ok: boolean, kind: 'buy' | 'hire' = 'buy') => {
    if (ok) sound.play(kind);
  };

  const actions: GameActions = {
    hire: job => bought(hire(state, job, rng), 'hire'),
    buyNode: id => bought(buyNode(state, id)),
    buyHouse: () => bought(buyHouse(state)),
    createGroup: () => createGroup(state),
    renameGroup: (id, name) => renameGroup(state, id, name),
    setGroupColor: (id, color) => setGroupColor(state, id, color),
    setPriority: (id, p) => setPriority(state, id, p),
    setGroupSeed: (id, crop) => setGroupSeed(state, id, crop),
    setGroupZone: (id, zone) => setGroupZone(state, id, zone),
    deleteGroup: id => deleteGroup(state, id),
    moveGnome: (gnome, group) => moveGnome(state, gnome, group),
    selectSeed: crop => {
      if (cropUnlocked(state, crop)) seed = crop;
    },
    showGnome: id => {
      windows.close();
      card.open(id);
    },
    reset: () => {
      clearGame();
      canSave = true;
      notices.hide('ilegible');
      state = createState(rng);
      seed = 'zanahoria';
      scene.reset();
      windows.close();
      card.close();
    },
    buyTalent: id => bought(buyTalent(state, id)),
    endSeason: () => {
      if (!canEndSeason(state)) return;
      state = endSeason(state, rng);
      seed = 'zanahoria';
      scene.reset();
      windows.close();
      card.close();
      persist();
      summary.show(state);
    },
    showHallOfFame: () => {
      seasonMenu.tab('fama');
      windows.open('temporada');
    },
    rally: () => {
      if (rally(state, rng)) sound.play('rally');
    },
    dismissOrder: () => dismissOrder(state),
  };

  const seasonMenu = createSeasonMenu(actions);
  const windows = createWindows(stageEl, {
    contratar: createHireMenu(actions),
    grupos: createGroupsMenu(actions),
    arbol: createTreeMenu(actions),
    diario: createDiaryMenu(actions),
    ranking: createRankingMenu(actions),
    temporada: seasonMenu,
    album: createAlbumMenu(),
  });
  const hud = createHud(document.getElementById('topbar')!, stageEl, actions, m => windows.open(m), sound);
  const coinStat = document.querySelector<HTMLElement>('[data-coin-stat]')!;
  const summary = createSeasonSummary(stageEl, actions);
  // después de las ventanas y del resumen: su Esc va primero
  const card = createGnomeCard(stageEl, actions, id => scene.follow(id));

  scene.onPlotClick = id => {
    const r = clickPlot(state, id, seed);
    if (r === 'plant') sound.play('plant');
    if (r === 'harvest') {
      sound.play('harvest');
      const o = plotOrigin(state.plots[id]);
      flyCoins(scene.pageOf(o.x + 9, o.y + 4), coinStat, 2);
    }
  };
  scene.onOpenMenu = m => windows.open(m);
  scene.onGnomeClick = id => card.open(id);
  const toolbar = stageEl.querySelector<HTMLElement>('.toolbar')!;
  const tutorial = createTutorial(stageEl, toolbar, !devParams || new URLSearchParams(location.search).get('tutorial') === '1');

  let sinceSave = 0;
  app.ticker.add(ticker => {
    try {
      const dt = Math.min(ticker.deltaMS / 1000, MAX_DT);
      tick(state, dt, rng);
      if (!cropUnlocked(state, seed)) seed = 'zanahoria';
      scene.sync(state, dt);
      playEvents(state.events);
      // los eventos son de un fotograma: ya los han visto la escena y el sonido
      state.events.length = 0;
      hud.update(state, seed, windows.current);
      windows.update(state);
      card.update(state);
      tutorial.update(state, { menu: windows.current, card: card.current });
      // la cámara encuadra el huerto en lo que no tapan la barra de abajo ni la ficha (D13); se aplica al siguiente fotograma
      scene.setInsets({
        right: card.el.hidden ? 0 : stageEl.clientWidth - card.el.offsetLeft,
        bottom: stageEl.clientHeight - toolbar.offsetTop,
      });
      sinceSave += dt;
      if (sinceSave >= SAVE_EVERY) {
        sinceSave = 0;
        persist();
      }
    } catch (e) {
      // un fallo a mitad de fotograma deja el estado a medias: se para todo y no se guarda encima de la última copia buena
      broken = true;
      app.ticker.stop();
      console.error(e);
      notices.show('error', AVISOS.roto, [{ label: AVISOS.recargar, onClick: () => location.reload() }]);
    }
  });

  function playEvents(events: GameState['events']) {
    for (const e of events) {
      if (e.type === 'harvest') sound.play('harvest');
      else if (e.type === 'coins') sound.play('coins', e.amount);
      else if (e.type === 'crown') sound.play('crown');
      else if (e.type === 'mastery') sound.play('mastery');
      else if (e.type === 'sticker') sound.play('album');
      else if (e.type === 'order') sound.play(e.done ? 'orderDone' : 'order');
      else if (e.type === 'golden') {
        sound.play('golden');
        flyCoins(scene.pageOf(e.x, e.y), coinStat, 6);
      }
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });
  window.addEventListener('pagehide', persist);
}

/**
 * Solo en desarrollo, para revisar sin jugar desde cero:
 * ?monedas=500&recolectores=3&sembradores=1&porteadores=1&regadores=1&guardianes=1&bancal=4&casa=2&semillas=20&temporada=3
 * (porteadores, regadores, guardianes y bancal compran también lo necesario en el árbol; casa amplía la casa de
 * gnomos N niveles, y si los gnomos pedidos no caben, se amplía lo que haga falta; semillas da semillas doradas
 * para el árbol dorado y temporada pone el número de temporada, sin historial)
 */
function applyDevParams(state: GameState) {
  const q = new URLSearchParams(location.search);
  const n = (k: string) => Math.max(0, Math.floor(Number(q.get(k)) || 0));
  const freeHouse = () => {
    state.coins += houseCost(state);
    return buyHouse(state);
  };
  const needs = {
    porteadores: ['botas', 'saco', 'porteadores'],
    regadores: ['trigo', 'abono', 'regadores'],
    guardianes: ['botas', 'guardianes'],
  } as const;
  for (const [param, nodes] of Object.entries(needs)) {
    if (!n(param)) continue;
    for (const id of nodes) {
      if (state.tree[id] > 0) continue;
      state.coins += nodeCost(state, id);
      buyNode(state, id);
    }
  }
  for (let i = 0; i < n('bancal'); i++) {
    state.coins += nodeCost(state, 'bancal');
    buyNode(state, 'bancal');
  }
  for (let i = 0; i < n('casa'); i++) freeHouse();
  const jobs = {
    recolectores: 'recolector', sembradores: 'sembrador', porteadores: 'porteador', regadores: 'regador', guardianes: 'guardian',
  } as const;
  for (const [param, job] of Object.entries(jobs)) {
    for (let i = 0; i < n(param); i++) {
      while (state.gnomes.length >= houseCapacity(state) && !houseMaxed(state)) freeHouse();
      state.coins += hireCost(state, job);
      hire(state, job, rng);
    }
  }
  state.coins += n('monedas');
  state.prestige.goldenSeeds += n('semillas');
  if (n('temporada')) state.prestige.season = n('temporada');
}

start().catch(e => {
  console.error(e);
  createNotices(document.getElementById('stage') ?? document.body).show('error', AVISOS.noArranca, [
    { label: AVISOS.recargar, onClick: () => location.reload() },
  ]);
});
