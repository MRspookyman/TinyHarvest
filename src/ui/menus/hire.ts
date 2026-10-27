// Granero: ampliar la casa de gnomos y contratar gnomos.
import { JOB_IDS, JOB_NODE } from '../../sim/config';
import { hireCost, houseCapacity, houseCost, houseMaxed, jobUnlocked } from '../../sim/sim';
import type { GameState, JobId } from '../../sim/types';
import { houseIcon, jobIcons } from '../../render/icons';
import { ARBOL, CASA, OFICIOS, UI } from '../../textos';
import { html, pixelImg, setDisabled, setText, toggleClass, type GameActions } from '../dom';
import type { Menu } from '../windows';

export function createHireMenu(actions: GameActions): Menu {
  const el = html(`
    <div class="hire">
      <article class="job house" data-house>
        ${pixelImg(houseIcon, 'px job-icon house-icon')}
        <div class="job-text">
          <header><b>${CASA.nombre}</b><span class="muted" data-beds></span></header>
          <p data-house-desc></p>
        </div>
        <button type="button" class="btn" data-buy-house></button>
      </article>
      ${JOB_IDS.map(j => {
        // el oficio que se desbloquea en el árbol dice en qué nodo
        const node = JOB_NODE[j];
        return `
        <article class="job" data-job="${j}">
          ${pixelImg(jobIcons[j], 'px job-icon')}
          <div class="job-text">
            <header><b>${OFICIOS[j].nombre}</b><span class="muted" data-count></span></header>
            <p>${OFICIOS[j].desc}</p>
            ${node ? `<p class="lock-note" data-lock hidden>${UI.bloqueadaEnArbol}: «${ARBOL[node].nombre}».</p>` : ''}
          </div>
          <button type="button" class="btn" data-hire="${j}"></button>
        </article>`;
      }).join('')}
    </div>`);

  el.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-buy-house]')) return actions.buyHouse();
    const btn = target.closest<HTMLButtonElement>('[data-hire]');
    if (btn) actions.hire(btn.dataset.hire as JobId);
  });

  const house = el.querySelector<HTMLElement>('[data-house]')!;
  const houseBtn = house.querySelector<HTMLButtonElement>('[data-buy-house]');

  return {
    el,
    update(s: GameState) {
      const beds = houseCapacity(s);
      const full = s.gnomes.length >= beds;
      const maxed = houseMaxed(s);
      const cost = houseCost(s);
      const bedsEl = house.querySelector('[data-beds]');
      setText(bedsEl, CASA.camas(s.gnomes.length, beds));
      toggleClass(bedsEl, 'full', full);
      setText(house.querySelector('[data-house-desc]'), maxed ? CASA.maximo : CASA.desc);
      setText(houseBtn, maxed ? UI.alMaximo : CASA.ampliar(cost));
      setDisabled(houseBtn, maxed || s.coins < cost);

      for (const j of JOB_IDS) {
        const card = el.querySelector<HTMLElement>(`[data-job="${j}"]`)!;
        const unlocked = jobUnlocked(s, j);
        const jobCost = hireCost(s, j);
        const btn = card.querySelector<HTMLButtonElement>('[data-hire]');
        card.classList.toggle('locked', !unlocked);
        const lock = card.querySelector<HTMLElement>('[data-lock]');
        if (lock) lock.hidden = unlocked;
        setText(card.querySelector('[data-count]'), UI.tienes(s.gnomes.filter(g => g.job === j).length));
        setText(btn, full ? CASA.lleno : UI.contratar(jobCost));
        setDisabled(btn, !unlocked || full || s.coins < jobCost);
      }
    },
  };
}
