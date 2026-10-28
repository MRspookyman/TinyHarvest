// Lo que está siempre en pantalla: monedas y organización arriba, barra de accesos y semillas abajo, y el último aviso del diario.
import { CROP_IDS } from '../sim/config';
import { cropUnlocked, cropValue, masteryLevel, masteryNext, nextGoal } from '../sim/sim';
import type { CropId, GameState, OrgPart } from '../sim/types';
import { cropIcons, goldenSeedIcon, menuIcons } from '../render/icons';
import type { Sound } from '../render/sound';
import { ARBOL, CULTIVOS, MAESTRIA, MENUS, ORG, TEMPORADA, UI, type MenuId } from '../textos';
import { esc, pixelImg, setDisabled, setText, toggleClass, type GameActions } from './dom';

export interface Hud {
  update(s: GameState, selected: CropId, openMenu: MenuId | null): void;
}

const MENU_ORDER: MenuId[] = ['contratar', 'grupos', 'arbol', 'ranking', 'album', 'diario', 'temporada'];
const ORG_PARTS = Object.keys(ORG.partes) as OrgPart[];
/** por debajo de esto, una parte da pista; la calidad colorea el multiplicador y las barras */
const ORG_OK = 0.9;
const quality = (f: number) => (f < 0.5 ? 'bad' : f < 0.8 ? 'mid' : 'good');

export function createHud(topbar: HTMLElement, stage: HTMLElement, actions: GameActions, open: (m: MenuId) => void, sound: Sound): Hud {
  topbar.innerHTML = `
    <h1>${UI.titulo}</h1>
    <div class="stats">
      <button type="button" class="stat goal" data-goal>
        <span class="goal-label">${UI.proximo}: <b data-goal-name></b></span>
        <i class="goal-bar" aria-hidden="true"><i data-goal-fill></i></i>
        <span class="goal-nums" data-goal-nums></span>
      </button>
      <span class="stat" data-coin-stat><i class="coin" aria-hidden="true"></i><b data-coins>0</b> ${UI.monedas}</span>
      <div class="org" data-org>
        <button type="button" class="stat org-btn" aria-expanded="false" aria-controls="org-pop" title="${esc(ORG.boton)}">
          <i class="org-icon" aria-hidden="true"></i><b data-org-mult></b>
        </button>
        <div class="org-pop" id="org-pop" role="tooltip">
          <h3>${ORG.titulo}</h3>
          <p class="muted">${ORG.ayuda}</p>
          <ul>
            ${ORG_PARTS.map(p => `<li><span>${ORG.partes[p]}</span><i class="org-bar"><i data-org-part="${p}"></i></i></li>`).join('')}
          </ul>
          <p class="org-tip" data-org-tip></p>
        </div>
      </div>
      <span class="stat"><b data-gnomes>0</b> ${UI.gnomos}</span>
      <span class="stat" data-prestige hidden title="${esc(TEMPORADA.saldo)}">${pixelImg(goldenSeedIcon, 'px seed-icon')}<b data-gold>0</b> · <span data-season></span></span>
      <button type="button" class="sound-btn" data-sound aria-pressed="false"><i aria-hidden="true"></i></button>
    </div>`;

  const goalBtn = topbar.querySelector<HTMLButtonElement>('[data-goal]')!;
  let goalMenu: MenuId = 'arbol';
  goalBtn.addEventListener('click', () => open(goalMenu));
  const soundBtn = topbar.querySelector<HTMLButtonElement>('[data-sound]')!;
  const syncSound = () => {
    soundBtn.setAttribute('aria-pressed', String(!sound.muted));
    soundBtn.classList.toggle('off', sound.muted);
    const label = sound.muted ? UI.sonidoOff : UI.sonidoOn;
    soundBtn.title = label;
    soundBtn.setAttribute('aria-label', label);
  };
  soundBtn.addEventListener('click', () => {
    sound.setMuted(!sound.muted);
    syncSound();
  });
  syncSound();
  // el contador de monedas da un saltito cuando sube (como mucho cada 0,2 s, para que no tiemble)
  const coinStat = topbar.querySelector<HTMLElement>('[data-coin-stat]')!;
  let lastCoins = 0;
  let lastBump = 0;
  /** cromos que ya ha visto el jugador; -1 hasta la primera actualización (lo de partidas anteriores no avisa) */
  let seenAlbum = -1;

  // el detalle sale al pasar el ratón (CSS) y al pulsar, que es lo que hay en pantallas táctiles
  const org = topbar.querySelector<HTMLElement>('[data-org]')!;
  const orgBtn = org.querySelector<HTMLButtonElement>('.org-btn')!;
  const setOrgOpen = (on: boolean) => {
    org.classList.toggle('open', on);
    orgBtn.setAttribute('aria-expanded', String(on));
  };
  orgBtn.addEventListener('click', () => setOrgOpen(!org.classList.contains('open')));
  document.addEventListener('pointerdown', e => {
    if (!org.contains(e.target as Node)) setOrgOpen(false);
  });
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !org.classList.contains('open')) return;
    setOrgOpen(false);
    e.preventDefault();
  });

  const bar = document.createElement('nav');
  bar.className = 'toolbar';
  bar.setAttribute('aria-label', 'Menús y semillas');
  bar.innerHTML = `
    <div class="tool-group">
      ${MENU_ORDER.map(m => `
        <button type="button" class="tool" data-menu="${m}" aria-label="${esc(MENUS[m].boton)}" aria-pressed="false" title="${esc(MENUS[m].sub)}">
          ${pixelImg(menuIcons[m])}<span>${MENUS[m].boton}</span>
        </button>`).join('')}
    </div>
    <div class="tool-sep" aria-hidden="true"></div>
    <div class="tool-group seeds" role="group" aria-label="${UI.semilla}">
      <span class="tool-label">${UI.semilla}</span>
      ${CROP_IDS.map(c => `
        <button type="button" class="tool seed" data-seed="${c}" aria-pressed="false">
          ${pixelImg(cropIcons[c])}
        </button>`).join('')}
    </div>`;
  stage.append(bar);

  const ticker = document.createElement('div');
  ticker.className = 'ticker';
  ticker.setAttribute('aria-live', 'polite');
  stage.append(ticker);

  bar.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn) return;
    if (btn.dataset.menu) open(btn.dataset.menu as MenuId);
    else if (btn.dataset.seed) actions.selectSeed(btn.dataset.seed as CropId);
  });

  let lastLog = '';
  return {
    update(s, selected, openMenu) {
      setText(topbar.querySelector('[data-coins]'), String(Math.floor(s.coins)));
      const now = performance.now();
      if (s.coins > lastCoins + 0.5 && now - lastBump > 200) {
        lastBump = now;
        coinStat.classList.remove('bump');
        void coinStat.offsetWidth;
        coinStat.classList.add('bump');
      }
      lastCoins = s.coins;

      // próximo objetivo (G3): nombre, barra y cifras; brilla cuando ya se puede
      const goal = nextGoal(s);
      const name = goal.kind === 'node' ? ARBOL[goal.id].nombre : UI.proximoSemilla(goal.seeds);
      const fill = Math.min(1, goal.have / goal.need);
      goalMenu = goal.kind === 'node' ? 'arbol' : 'temporada';
      setText(goalBtn.querySelector('[data-goal-name]'), name);
      setText(goalBtn.querySelector('[data-goal-nums]'), fill >= 1 && goal.kind === 'node' ? UI.listo : `${Math.floor(goal.have)} / ${goal.need}`);
      const width = `${Math.round(fill * 100)}%`;
      const goalFill = goalBtn.querySelector<HTMLElement>('[data-goal-fill]')!;
      if (goalFill.style.width !== width) goalFill.style.width = width;
      toggleClass(goalBtn, 'ready', fill >= 1 && goal.kind === 'node');
      const help = goal.kind === 'node' ? UI.proximoAyuda : UI.proximoSemillaAyuda;
      if (goalBtn.title !== help) goalBtn.title = help;
      setText(topbar.querySelector('[data-gnomes]'), String(s.gnomes.length));
      // semillas doradas y temporada: solo cuando ya significan algo
      const { goldenSeeds, season } = s.prestige;
      const prestige = topbar.querySelector<HTMLElement>('[data-prestige]')!;
      prestige.hidden = goldenSeeds === 0 && season === 1;
      setText(prestige.querySelector('[data-gold]'), String(goldenSeeds));
      setText(prestige.querySelector('[data-season]'), TEMPORADA.temporada(season));

      // organización: el multiplicador coloreado por la media de las partes, y pista para la peor
      const parts = s.org.parts;
      const mean = ORG_PARTS.reduce((sum, p) => sum + parts[p], 0) / ORG_PARTS.length;
      setText(topbar.querySelector('[data-org-mult]'), ORG.valor(s.org.mult));
      if (org.dataset.q !== quality(mean)) org.dataset.q = quality(mean);
      let worst = ORG_PARTS[0];
      for (const p of ORG_PARTS) {
        if (parts[p] < parts[worst]) worst = p;
        const bar = org.querySelector<HTMLElement>(`[data-org-part="${p}"]`)!;
        const width = `${Math.round(parts[p] * 100)}%`;
        if (bar.style.width !== width) bar.style.width = width;
        if (bar.dataset.q !== quality(parts[p])) bar.dataset.q = quality(parts[p]);
      }
      setText(org.querySelector('[data-org-tip]'), parts[worst] < ORG_OK ? ORG.consejo[worst] : ORG.todoBien);

      for (const m of MENU_ORDER) {
        const btn = bar.querySelector<HTMLButtonElement>(`[data-menu="${m}"]`)!;
        toggleClass(btn, 'active', openMenu === m);
        btn.setAttribute('aria-pressed', String(openMenu === m));
      }
      // cromo nuevo (G6): el botón del álbum lo avisa hasta que se abre
      if (seenAlbum < 0 || openMenu === 'album') seenAlbum = s.prestige.album.length;
      toggleClass(bar.querySelector('[data-menu="album"]'), 'new', s.prestige.album.length > seenAlbum);
      for (const c of CROP_IDS) {
        const btn = bar.querySelector<HTMLButtonElement>(`[data-seed="${c}"]`)!;
        const locked = !cropUnlocked(s, c);
        setDisabled(btn, locked);
        btn.setAttribute('aria-pressed', String(selected === c));
        // maestría (G5): estrellitas en el botón y el progreso en el título
        const level = masteryLevel(s, c);
        const next = masteryNext(s, c);
        if (btn.dataset.level !== String(level)) btn.dataset.level = String(level);
        const mastery = level || s.mastery[c] ? ` ${MAESTRIA.nivel(level)}: ${next === null ? MAESTRIA.maximo : MAESTRIA.progreso(s.mastery[c], next)}.` : '';
        const title = locked ? `${CULTIVOS[c].nombre}: ${UI.bloqueadaEnArbol}` : `${CULTIVOS[c].nombre} (${UI.vale(Math.round(cropValue(s, c)))}). ${UI.semillaAyuda}.${mastery}`;
        if (btn.title !== title) btn.title = title;
        if (btn.getAttribute('aria-label') !== title) btn.setAttribute('aria-label', title);
      }

      // el aviso más reciente del diario aparece un momento sobre el huerto
      if (s.log[0] !== lastLog) {
        lastLog = s.log[0] ?? '';
        ticker.textContent = lastLog;
        ticker.classList.remove('show');
        void ticker.offsetWidth;
        ticker.classList.add('show');
      }
    },
  };
}
