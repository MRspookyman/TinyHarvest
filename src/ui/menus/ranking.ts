// Gnomos del mes: el podio de cada categoría con lo que ha hecho cada gnomo en esta partida.
import type { GameState, GnomeStats } from '../../sim/types';
import { crownIcon, jobIcons } from '../../render/icons';
import { RANKING } from '../../textos';
import { esc, html, pixelImg } from '../dom';
import type { Menu } from '../windows';

type Category = keyof typeof RANKING.categorias;
const CATEGORIES = Object.keys(RANKING.categorias) as Category[];
const PODIUM = 3;
/** píxeles del mundo por paso: un gnomo da unos cinco pasitos por segundo */
const PX_PER_STEP = 4;

const shown = (k: keyof GnomeStats, v: number) => Math.floor(k === 'walked' ? v / PX_PER_STEP : v);

export function createRankingMenu(): Menu {
  const el = html(`
    <div class="ranking">
      <p class="muted">${RANKING.ayuda}</p>
      <p class="ranking-summary" data-summary></p>
      <div class="ranking-grid" data-grid></div>
    </div>`);
  const summary = el.querySelector<HTMLElement>('[data-summary]')!;
  const grid = el.querySelector<HTMLElement>('[data-grid]')!;
  let sig = '';

  return {
    el,
    onOpen() {
      sig = '';
    },
    update(s: GameState) {
      const podiums = CATEGORIES.map(k => {
        const top = s.gnomes
          .filter(g => shown(k, g.stats[k]) > 0)
          .sort((a, b) => b.stats[k] - a.stats[k])
          .slice(0, PODIUM);
        return { k, top: top.map(g => ({ g, v: shown(k, g.stats[k]) })) };
      });
      const next = JSON.stringify([s.crown, s.rotted, s.manualHarvests, podiums.map(p => p.top.map(t => [t.g.id, t.v]))]);
      if (next === sig) return;
      sig = next;

      const king = s.gnomes.find(g => g.id === s.crown);
      summary.innerHTML = [
        king ? `${pixelImg(crownIcon, 'px crown-icon')}<b>${esc(king.name)}</b> · ${RANKING.corona.toLowerCase()}` : '',
        RANKING.aMano(s.manualHarvests),
        RANKING.perdidos(s.rotted),
      ].filter(Boolean).join(' · ');

      grid.innerHTML = podiums.map(({ k, top }) => `
        <article class="rank-card">
          <header><h3>${RANKING.categorias[k].titulo}</h3><span class="muted">${RANKING.categorias[k].unidad}</span></header>
          ${top.length
            ? `<ol>${top.map(({ g, v }) => `
                <li title="${esc(g.name)}">
                  ${pixelImg(jobIcons[g.job], 'px chip-icon')}
                  <span class="rank-name">${esc(g.name)}${g.id === s.crown ? pixelImg(crownIcon, 'px crown-icon') : ''}</span>
                  <span class="rank-value">${v}</span>
                </li>`).join('')}</ol>`
            : `<p class="muted">${RANKING.nadie}</p>`}
        </article>`).join('');
    },
  };
}
