// Estatua del Gnomo Dorado: terminar la temporada, el árbol dorado de talentos y el salón de la fama.
import { CROP_IDS, PRESTIGE, TALENT_EFFECT, TALENT_IDS, TALENT_ROOT, TALENTS } from '../../sim/config';
import {
  canEndSeason, costGrowth, legendaryChance, seasonSeeds, seedsCoinsNeeded, talentCost, talentMaxed, talentReachable, workSeeds,
} from '../../sim/sim';
import type { GameState, TalentId } from '../../sim/types';
import { goldenSeedIcon, jobIcons, legendIcon, talentIcons, traitIcons } from '../../render/icons';
import { CULTIVOS, LEGENDARIO, OFICIOS, RASGOS, TALENTOS, TEMPORADA, UI } from '../../textos';
import { esc, html, pixelImg, setDisabled, setText, toggleClass, type GameActions } from '../dom';
import { focusOwner, isTopLayer, restoreFocus, trapTab } from '../focus';
import type { Menu } from '../windows';
import { elbow } from './tree';

export type SeasonTab = keyof typeof TEMPORADA.pestanas;
const TABS = Object.keys(TEMPORADA.pestanas) as SeasonTab[];

export interface SeasonMenu extends Menu {
  /** cambia de pestaña (el ranking y el resumen abren directamente el salón de la fama) */
  tab(t: SeasonTab): void;
}

const list = new Intl.ListFormat('es');

/** «Ahora: …» de un talento ya comprado: lo que hace con el nivel que tiene. */
function effectNow(s: GameState, id: TalentId): string {
  const n = s.prestige.talents[id] * TALENT_EFFECT[id];
  const e = TEMPORADA.efecto;
  switch (id) {
    case 'abonoDorado':
    case 'mercadoDorado':
      return e[id](Math.round(n * 100));
    case 'contrato':
      return e.contrato(Math.round((costGrowth(s) - 1) * 100));
    case 'suerte':
      // los legendarios son raros: con un decimal, que «0 %» desanima
      return e.suerte(Math.round(legendaryChance(s) * 1000) / 10);
    case 'semillasConocidas':
      return e.semillasConocidas(list.format(CROP_IDS.slice(1, 1 + n).map(c => CULTIVOS[c].nombre.toLowerCase())));
    default:
      return e[id](n);
  }
}

export function createSeasonMenu(actions: GameActions): SeasonMenu {
  let tab: SeasonTab = 'fin';
  let selected: TalentId | 'root' = TALENT_IDS[0];

  const lines = TALENT_IDS.map(id => {
    const n = TALENTS[id];
    const p = n.parent ? TALENTS[n.parent] : TALENT_ROOT;
    return `<polyline data-line="${id}" points="${elbow(p.x, p.y, n.x, n.y)}" />`;
  }).join('');

  const el = html(`
    <div class="season">
      <div class="tabs" role="tablist">
        ${TABS.map(t => `<button type="button" class="tab" role="tab" data-tab="${t}">${TEMPORADA.pestanas[t]}</button>`).join('')}
      </div>
      <section class="season-end" data-panel="fin">
        <dl class="season-facts">
          <div><dt>${TEMPORADA.temporadaTitulo}</dt><dd data-f-season></dd></div>
          <div><dt>${TEMPORADA.jugado}</dt><dd data-f-time></dd></div>
          <div><dt>${TEMPORADA.ganado}</dt><dd data-f-earned></dd></div>
          <div class="season-seeds"><dt>${TEMPORADA.tendrias}</dt><dd>${pixelImg(goldenSeedIcon, 'px seed-icon')}<b data-f-seeds></b></dd></div>
        </dl>
        <p class="muted">${TEMPORADA.rendimiento} <span data-f-next></span></p>
        <div class="season-keep">
          <div><h3>${TEMPORADA.seQueda}</h3><ul>${TEMPORADA.quedan.map(t => `<li>${t}</li>`).join('')}</ul></div>
          <div class="lost"><h3>${TEMPORADA.sePierde}</h3><ul>${TEMPORADA.pierden.map(t => `<li>${t}</li>`).join('')}</ul></div>
        </div>
        <button type="button" class="btn big gold" data-end>${TEMPORADA.terminar}</button>
        <p class="lock-note" data-f-why></p>
      </section>

      <section class="golden-tree" data-panel="arbol">
        <div class="tree-wrap">
          <div class="tree-canvas">
           <div class="tree-inner">
            <svg class="tree-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
            <button type="button" class="node root" data-node="root" style="left:${TALENT_ROOT.x}%;top:${TALENT_ROOT.y}%" aria-label="${TEMPORADA.raiz}">
              ${pixelImg(goldenSeedIcon)}
            </button>
            ${TALENT_IDS.map(id => `
              <button type="button" class="node" data-node="${id}" style="left:${TALENTS[id].x}%;top:${TALENTS[id].y}%" aria-label="${TALENTOS[id].nombre}">
                ${pixelImg(talentIcons[id])}
                <span class="pips">${'<i></i>'.repeat(TALENTS[id].max)}</span>
              </button>`).join('')}
           </div>
          </div>
          <aside class="tree-detail" aria-live="polite">
            <h3 data-d-name></h3>
            <span class="detail-level" data-d-level></span>
            <p data-d-desc></p>
            <p class="detail-extra" data-d-extra></p>
            <button type="button" class="btn gold" data-buy></button>
            <p class="muted detail-help">${TEMPORADA.arbolAyuda}</p>
          </aside>
        </div>
      </section>

      <section class="fame" data-panel="fama">
        <p class="muted">${TEMPORADA.famaAyuda}</p>
        <div data-fame></div>
      </section>
    </div>`);

  const head = html(`
    <span class="gold-balance" data-tip="${esc(TEMPORADA.saldo)}">${pixelImg(goldenSeedIcon, 'px seed-icon')}<b data-gold></b></span>`);

  const endBtn = el.querySelector<HTMLButtonElement>('[data-end]')!;
  const fame = el.querySelector<HTMLElement>('[data-fame]')!;
  let armTimer = 0;
  let fameSig = '';

  const disarm = () => {
    clearTimeout(armTimer);
    armTimer = 0;
    endBtn.textContent = TEMPORADA.terminar;
  };

  function showTab(t: SeasonTab) {
    tab = t;
    disarm();
    for (const b of el.querySelectorAll<HTMLElement>('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === t));
    for (const p of el.querySelectorAll<HTMLElement>('[data-panel]')) p.hidden = p.dataset.panel !== t;
  }
  showTab(tab);

  el.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    const tabBtn = target.closest<HTMLElement>('[data-tab]');
    if (tabBtn) return showTab(tabBtn.dataset.tab as SeasonTab);
    const node = target.closest<HTMLElement>('[data-node]');
    if (node) {
      selected = node.dataset.node as TalentId | 'root';
      return;
    }
    if (target.closest('[data-buy]') && selected !== 'root') actions.buyTalent(selected);
  });

  // dos pasos, como «Borrar partida»: terminar la temporada no tiene vuelta atrás
  endBtn.addEventListener('click', () => {
    if (!armTimer) {
      endBtn.textContent = TEMPORADA.terminarSeguro;
      armTimer = window.setTimeout(disarm, 3000);
      return;
    }
    disarm();
    actions.endSeason();
  });

  function updateEnd(s: GameState) {
    // las ganadas con monedas más una por cada nivel de obra
    const earned = seasonSeeds(s);
    const works = workSeeds(s);
    const seeds = earned + works;
    const can = canEndSeason(s);
    setText(el.querySelector('[data-f-season]'), String(s.prestige.season));
    setText(el.querySelector('[data-f-time]'), TEMPORADA.duracion(s.seasonTime));
    setText(el.querySelector('[data-f-earned]'), String(Math.floor(s.totalEarned)));
    setText(el.querySelector('[data-f-seeds]'), String(seeds));
    setText(el.querySelector('[data-f-next]'), TEMPORADA.siguiente(Math.ceil(seedsCoinsNeeded(earned + 1) - s.totalEarned)));
    setText(el.querySelector('[data-f-why]'), can ? '' : TEMPORADA.noAun(PRESTIGE.minSeeds, Math.ceil(seedsCoinsNeeded(PRESTIGE.minSeeds - works) - s.totalEarned)));
    if (!can && armTimer) disarm();
    setDisabled(endBtn, !can);
  }

  function updateTree(s: GameState) {
    const gold = s.prestige.goldenSeeds;
    toggleClass(el.querySelector('[data-node="root"]'), 'selected', selected === 'root');
    for (const id of TALENT_IDS) {
      const btn = el.querySelector<HTMLElement>(`[data-node="${id}"]`)!;
      const level = s.prestige.talents[id];
      const reachable = talentReachable(s, id);
      const maxed = talentMaxed(s, id);
      toggleClass(btn, 'locked', !reachable);
      toggleClass(btn, 'owned', level > 0);
      toggleClass(btn, 'maxed', maxed);
      toggleClass(btn, 'affordable', reachable && !maxed && gold >= talentCost(s, id));
      toggleClass(btn, 'selected', selected === id);
      btn.querySelectorAll('.pips i').forEach((pip, i) => toggleClass(pip, 'on', i < level));
      toggleClass(el.querySelector(`[data-line="${id}"]`), 'lit', reachable);
    }

    const buy = el.querySelector<HTMLButtonElement>('[data-buy]')!;
    if (selected === 'root') {
      setText(el.querySelector('[data-d-name]'), TEMPORADA.raiz);
      setText(el.querySelector('[data-d-level]'), '');
      setText(el.querySelector('[data-d-desc]'), TEMPORADA.raizDesc);
      setText(el.querySelector('[data-d-extra]'), '');
      buy.hidden = true;
      return;
    }
    const id = selected;
    const def = TALENTS[id];
    const level = s.prestige.talents[id];
    const reachable = talentReachable(s, id);
    const maxed = talentMaxed(s, id);
    const cost = talentCost(s, id);
    setText(el.querySelector('[data-d-name]'), TALENTOS[id].nombre);
    setText(el.querySelector('[data-d-level]'), def.max > 1 ? UI.nivel(level, def.max) : '');
    setText(el.querySelector('[data-d-desc]'), TALENTOS[id].desc);
    let extra = '';
    if (!reachable && def.parent) extra = UI.necesita(TALENTOS[def.parent].nombre);
    else if (level > 0) extra = `${UI.ahora}: ${effectNow(s, id)}`;
    setText(el.querySelector('[data-d-extra]'), extra);
    buy.hidden = false;
    setText(buy, maxed ? UI.alMaximo : TEMPORADA.comprar(cost));
    setDisabled(buy, maxed || !reachable || gold < cost);
  }

  function updateFame(s: GameState) {
    const { history, veterans } = s.prestige;
    const next = JSON.stringify([history.length, veterans]);
    if (next === fameSig) return;
    fameSig = next;
    const star = (legendary: boolean) => (legendary ? pixelImg(legendIcon, 'px fame-star') : '');
    const seasons = history.map(r => `
      <article class="rank-card fame-season">
        <header><h3>${TEMPORADA.temporada(r.season)}</h3><span class="muted">${TEMPORADA.fila(Math.floor(r.earned), r.seconds, r.seeds)}</span></header>
        ${r.crowned.length ? `<ol class="crowns">${r.crowned.map(c => `
          <li data-tip="${esc(OFICIOS[c.job].nombre)}${c.legendary ? ` · ${LEGENDARIO.nombre}` : ''}">
            ${pixelImg(jobIcons[c.job], 'px chip-icon')}
            <span class="fame-name">${esc(c.name)}${star(c.legendary)}</span>
            <span class="rank-value">${TEMPORADA.tareas(c.tasks)}</span>
          </li>`).join('')}</ol>` : `<p class="muted">${TEMPORADA.sinCoronas}</p>`}
      </article>`).join('');
    const vets = veterans.length ? `
      <article class="rank-card fame-vets">
        <header><h3>${TEMPORADA.veteranos}</h3><span class="muted">${TEMPORADA.veteranosAyuda}</span></header>
        <ol class="crowns">${veterans.map(v => `
          <li data-tip="${esc(OFICIOS[v.job].nombre)}">
            ${pixelImg(jobIcons[v.job], 'px chip-icon')}
            <span class="fame-name">${esc(v.name)}${star(v.legendary)}<img class="px trait-icon" src="${traitIcons[v.trait]}" alt="${RASGOS[v.trait].nombre}" aria-label="${RASGOS[v.trait].nombre}" data-tip="${RASGOS[v.trait].nombre}" draggable="false"></span>
            <span class="rank-value">${TEMPORADA.temporadas(v.seasons)}</span>
          </li>`).join('')}</ol>
      </article>` : '';
    fame.innerHTML = history.length || veterans.length
      ? `<div class="ranking-grid">${vets}${seasons}</div>`
      : `<p class="fame-empty">${TEMPORADA.famaVacia}</p>`;
  }

  return {
    el,
    head,
    tab: showTab,
    onOpen() {
      fameSig = '';
      disarm();
    },
    update(s: GameState) {
      setText(head.querySelector('[data-gold]'), String(s.prestige.goldenSeeds));
      if (tab === 'fin') updateEnd(s);
      else if (tab === 'arbol') updateTree(s);
      else updateFame(s);
    },
  };
}

/** Resumen al terminar la temporada: lo ganado, quién entra en el salón de la fama y quién vuelve. */
export function createSeasonSummary(host: HTMLElement, actions: GameActions) {
  const layer = html(`<div class="win-layer summary-layer" hidden></div>`);
  host.append(layer);
  let opener: HTMLElement | null = null;
  const close = () => {
    if (layer.hidden) return;
    layer.hidden = true;
    const back = opener;
    opener = null;
    restoreFocus(back);
  };
  layer.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    if (target === layer || target.closest('[data-ok]')) close();
    else if (target.closest('[data-fame]')) {
      close();
      actions.showHallOfFame();
    }
  });
  // Esc lo cierra antes que nada (se registra antes que la ficha); Tab no sale de él
  window.addEventListener('keydown', e => {
    if (e.defaultPrevented || !isTopLayer(layer)) return;
    if (e.key === 'Tab') trapTab(e, layer);
    if (e.key !== 'Escape') return;
    e.preventDefault();
    close();
  });

  return {
    /** @param s el estado nuevo, ya en la temporada siguiente */
    show(s: GameState) {
      const r = s.prestige.history[0];
      if (!r) return;
      const back = s.gnomes.filter(g => s.prestige.veterans.some(v => v.name === g.name));
      const who = (job: keyof typeof jobIcons, name: string, legendary: boolean) =>
        `<li>${pixelImg(jobIcons[job], 'px chip-icon')}<span>${esc(name)}</span>${legendary ? pixelImg(legendIcon, 'px fame-star') : ''}</li>`;
      layer.innerHTML = `
        <section class="win summary" role="dialog" aria-modal="true" aria-labelledby="summary-title">
          <header class="win-head"><div><h2 id="summary-title">${TEMPORADA.resumenTitulo(r.season)}</h2><p>${TEMPORADA.fila(Math.floor(r.earned), r.seconds, r.seeds)}</p></div></header>
          <div class="summary-body">
            <p class="summary-seeds">${pixelImg(goldenSeedIcon, 'px seed-icon')}${TEMPORADA.resumenSemillas(r.seeds)}</p>
            ${r.crowned.length ? `<p>${TEMPORADA.resumenFama}</p><ul class="summary-list">${r.crowned.map(c => who(c.job, c.name, c.legendary)).join('')}</ul>` : ''}
            ${back.length ? `<p>${TEMPORADA.resumenVeteranos}</p><ul class="summary-list">${back.map(g => who(g.job, g.name, g.legendary)).join('')}</ul>` : ''}
            <p class="muted">${TEMPORADA.resumenSigue(s.prestige.season)}</p>
            <footer><button type="button" class="link" data-fame>${TEMPORADA.verFama}</button><button type="button" class="btn gold" data-ok>${TEMPORADA.vamos}</button></footer>
          </div>
        </section>`;
      if (layer.hidden) opener = focusOwner();
      layer.hidden = false;
      layer.querySelector<HTMLElement>('[data-ok]')!.focus({ preventScroll: true });
    },
  };
}
