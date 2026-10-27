// Lo que está siempre en pantalla: monedas arriba, barra de accesos y semillas abajo, y el último aviso del diario.
import { CROP_IDS } from '../sim/config';
import { cropUnlocked, cropValue } from '../sim/sim';
import type { CropId, GameState } from '../sim/types';
import { cropIcons, menuIcons } from '../render/icons';
import { CULTIVOS, MENUS, UI, type MenuId } from '../textos';
import { esc, pixelImg, setDisabled, setText, toggleClass, type GameActions } from './dom';

export interface Hud {
  update(s: GameState, selected: CropId, openMenu: MenuId | null): void;
}

const MENU_ORDER: MenuId[] = ['contratar', 'grupos', 'arbol', 'ranking', 'diario'];

export function createHud(topbar: HTMLElement, stage: HTMLElement, actions: GameActions, open: (m: MenuId) => void): Hud {
  topbar.innerHTML = `
    <h1>${UI.titulo}</h1>
    <div class="stats">
      <span class="stat"><i class="coin" aria-hidden="true"></i><b data-coins>0</b> ${UI.monedas}</span>
      <span class="stat"><b data-gnomes>0</b> ${UI.gnomos}</span>
    </div>`;

  const bar = document.createElement('nav');
  bar.className = 'toolbar';
  bar.setAttribute('aria-label', 'Menús y semillas');
  bar.innerHTML = `
    <div class="tool-group">
      ${MENU_ORDER.map(m => `
        <button type="button" class="tool" data-menu="${m}" title="${esc(MENUS[m].sub)}">
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

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = UI.pista;
  stage.append(hint);

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
      setText(topbar.querySelector('[data-gnomes]'), String(s.gnomes.length));
      hint.hidden = s.gnomes.length > 0;

      for (const m of MENU_ORDER) toggleClass(bar.querySelector(`[data-menu="${m}"]`), 'active', openMenu === m);
      for (const c of CROP_IDS) {
        const btn = bar.querySelector<HTMLButtonElement>(`[data-seed="${c}"]`)!;
        const locked = !cropUnlocked(s, c);
        setDisabled(btn, locked);
        btn.setAttribute('aria-pressed', String(selected === c));
        const title = locked ? `${CULTIVOS[c].nombre}: ${UI.bloqueadaEnArbol}` : `${CULTIVOS[c].nombre} (${UI.vale(Math.round(cropValue(s, c)))}). ${UI.semillaAyuda}`;
        if (btn.title !== title) btn.title = title;
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
