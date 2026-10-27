// Gnomos del mes: las coronas de cada oficio y el podio de cada categoría en esta partida.
import { JOB_IDS } from '../../sim/config';
import type { GameState, Gnome } from '../../sim/types';
import { crownIcon, jobIcons } from '../../render/icons';
import { RANKING } from '../../textos';
import { esc, html, pixelImg } from '../dom';
import type { Menu } from '../windows';

type Category = Exclude<keyof typeof RANKING.categorias, 'tasks'>;
const PODIUM_CATEGORIES = (Object.keys(RANKING.categorias) as (keyof typeof RANKING.categorias)[])
  .filter((k): k is Category => k !== 'tasks');
const PODIUM = 3;
/** píxeles del mundo por paso: un gnomo da unos cinco pasitos por segundo */
const PX_PER_STEP = 4;

const metric = (k: Category, g: Gnome) => Math.floor(k === 'walked' ? g.stats.walked / PX_PER_STEP : g.stats[k]);

const row = (s: GameState, g: Gnome, value: number) => `
  <li title="${esc(g.name)}">
    ${pixelImg(jobIcons[g.job], 'px chip-icon')}
    <span class="rank-name">${esc(g.name)}${s.crowns[g.job] === g.id ? pixelImg(crownIcon, 'px crown-icon') : ''}</span>
    <span class="rank-value">${value}</span>
  </li>`;

const card = (title: string, unit: string, body: string) => `
  <article class="rank-card">
    <header><h3>${title}</h3><span class="muted">${unit}</span></header>
    ${body || `<p class="muted">${RANKING.nadie}</p>`}
  </article>`;

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
      const kings = JOB_IDS.map(j => s.gnomes.find(g => g.id === s.crowns[j])).filter((g): g is Gnome => !!g);
      const podiums = PODIUM_CATEGORIES.map(k => ({
        k,
        top: s.gnomes
          .filter(g => metric(k, g) > 0)
          .sort((a, b) => metric(k, b) - metric(k, a))
          .slice(0, PODIUM),
      }));
      const next = JSON.stringify([
        s.rotted, s.manualHarvests,
        kings.map(g => [g.id, g.stats.tasks]),
        podiums.map(p => p.top.map(g => [g.id, metric(p.k, g)])),
      ]);
      if (next === sig) return;
      sig = next;

      summary.innerHTML = [RANKING.aMano(s.manualHarvests), RANKING.perdidos(s.rotted)].join(' · ');

      // la primera tarjeta es la de las coronas: el mejor de cada oficio, contra los suyos
      const crowns = card(
        RANKING.categorias.tasks.titulo,
        RANKING.categorias.tasks.unidad,
        kings.length ? `<ol class="crowns">${kings.map(g => row(s, g, g.stats.tasks)).join('')}</ol>` : '',
      );
      grid.innerHTML = crowns + podiums.map(({ k, top }) => card(
        RANKING.categorias[k].titulo,
        RANKING.categorias[k].unidad,
        top.length ? `<ol>${top.map(g => row(s, g, metric(k, g))).join('')}</ol>` : '',
      )).join('');
    },
  };
}
