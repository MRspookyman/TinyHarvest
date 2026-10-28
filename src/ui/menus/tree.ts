// Árbol viejo: el árbol de mejoras. Crece hacia arriba desde la raíz; cada nodo cuelga de su padre.
import { CONSERVAS_PER_LEVEL, MERCADO_PER_LEVEL, NODE_IDS, TREE, TREE_ROOT } from '../../sim/config';
import { fieldSize, guardRange, nodeCost, nodeMaxed, nodeReachable, porterCapacity, waterTime } from '../../sim/sim';
import type { GameState, NodeId } from '../../sim/types';
import { nodeIcons, rootIcon } from '../../render/icons';
import { ARBOL, RAMAS, UI } from '../../textos';
import { html, pixelImg, setDisabled, setText, toggleClass, type GameActions } from '../dom';
import type { Menu } from '../windows';
import { PX_PER_STEP } from './ranking';

type Selection = NodeId | 'root';

/** Línea en codo (vertical, horizontal, vertical) del padre al hijo, como ramas de pixel art. */
export function elbow(x0: number, y0: number, x1: number, y1: number) {
  const mid = (y0 + y1) / 2;
  return `${x0},${y0} ${x0},${mid} ${x1},${mid} ${x1},${y1}`;
}

// junto a la raíz, por debajo de donde las ramas se separan
const BRANCH_LABELS: { branch: keyof typeof RAMAS; x: number }[] = [
  { branch: 'gnomos', x: 24 },
  { branch: 'cultivos', x: 76 },
];

export function createTreeMenu(actions: GameActions): Menu {
  let selected: Selection = 'botas';

  const lines = NODE_IDS.map(id => {
    const n = TREE[id];
    const p = n.parent ? TREE[n.parent] : TREE_ROOT;
    return `<polyline data-line="${id}" points="${elbow(p.x, p.y, n.x, n.y)}" />`;
  }).join('');

  const el = html(`
    <div class="tree-wrap">
      <div class="tree-canvas">
       <div class="tree-inner">
        <svg class="tree-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
        ${BRANCH_LABELS.map(b => `<span class="branch-label" style="left:${b.x}%">${RAMAS[b.branch]}</span>`).join('')}
        <button type="button" class="node root" data-node="root" style="left:${TREE_ROOT.x}%;top:${TREE_ROOT.y}%" aria-label="${UI.raiz}">
          ${pixelImg(rootIcon)}
        </button>
        ${NODE_IDS.map(id => `
          <button type="button" class="node" data-node="${id}" style="left:${TREE[id].x}%;top:${TREE[id].y}%" aria-label="${ARBOL[id].nombre}">
            ${pixelImg(nodeIcons[id])}
            <span class="pips">${'<i></i>'.repeat(TREE[id].max)}</span>
          </button>`).join('')}
       </div>
      </div>
      <aside class="tree-detail" aria-live="polite">
        <span class="detail-branch" data-d-branch></span>
        <h3 data-d-name></h3>
        <span class="detail-level" data-d-level></span>
        <p data-d-desc></p>
        <p class="detail-extra" data-d-extra></p>
        <button type="button" class="btn" data-buy></button>
      </aside>
    </div>`);

  el.addEventListener('click', e => {
    const node = (e.target as HTMLElement).closest<HTMLElement>('[data-node]');
    if (node) {
      selected = node.dataset.node as Selection;
      return;
    }
    if ((e.target as HTMLElement).closest('[data-buy]') && selected !== 'root') actions.buyNode(selected);
  });

  return {
    el,
    update(s: GameState) {
      toggleClass(el.querySelector('[data-node="root"]'), 'selected', selected === 'root');
      for (const id of NODE_IDS) {
        const btn = el.querySelector<HTMLElement>(`[data-node="${id}"]`)!;
        const reachable = nodeReachable(s, id);
        const maxed = nodeMaxed(s, id);
        toggleClass(btn, 'locked', !reachable);
        toggleClass(btn, 'owned', s.tree[id] > 0);
        toggleClass(btn, 'maxed', maxed);
        toggleClass(btn, 'affordable', reachable && !maxed && s.coins >= nodeCost(s, id));
        toggleClass(btn, 'selected', selected === id);
        btn.querySelectorAll('.pips i').forEach((pip, i) => toggleClass(pip, 'on', i < s.tree[id]));
        toggleClass(el.querySelector(`[data-line="${id}"]`), 'lit', reachable);
      }

      const buy = el.querySelector<HTMLButtonElement>('[data-buy]')!;
      if (selected === 'root') {
        setText(el.querySelector('[data-d-branch]'), '');
        setText(el.querySelector('[data-d-name]'), UI.raiz);
        setText(el.querySelector('[data-d-level]'), '');
        setText(el.querySelector('[data-d-desc]'), UI.raizDesc);
        setText(el.querySelector('[data-d-extra]'), '');
        buy.hidden = true;
        return;
      }
      const id = selected;
      const def = TREE[id];
      const reachable = nodeReachable(s, id);
      const maxed = nodeMaxed(s, id);
      const cost = nodeCost(s, id);
      setText(el.querySelector('[data-d-branch]'), RAMAS[def.branch]);
      setText(el.querySelector('[data-d-name]'), ARBOL[id].nombre);
      setText(el.querySelector('[data-d-level]'), def.max > 1 ? UI.nivel(s.tree[id], def.max) : '');
      setText(el.querySelector('[data-d-desc]'), ARBOL[id].desc);
      let extra = '';
      if (!reachable && def.parent) extra = UI.necesita(ARBOL[def.parent].nombre);
      else if (id === 'bancal') {
        const f = fieldSize(s);
        extra = `${UI.ahora}: ${UI.bancalTam(f.cols, f.rows)}`;
      } else if (id === 'carretilla') extra = `${UI.ahora}: ${UI.porViaje(porterCapacity(s))}`;
      else if (id === 'conservas') extra = `${UI.ahora}: ${UI.masAguante(Math.round(CONSERVAS_PER_LEVEL * s.tree.conservas * 100))}`;
      else if (id === 'mercado') extra = `${UI.ahora}: ${UI.masCaro(Math.round(MERCADO_PER_LEVEL * s.tree.mercado * 100))}`;
      else if (id === 'regadera') extra = `${UI.ahora}: ${UI.riegoDura(Math.round(waterTime(s)))}`;
      else if (id === 'silbato') extra = `${UI.ahora}: ${UI.vigilaA(Math.round(guardRange(s) / PX_PER_STEP))}`;
      setText(el.querySelector('[data-d-extra]'), extra);
      buy.hidden = false;
      setText(buy, maxed ? UI.alMaximo : UI.comprar(cost));
      setDisabled(buy, maxed || !reachable || s.coins < cost);
    },
  };
}
