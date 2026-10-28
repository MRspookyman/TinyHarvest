// Tablón de anuncios: crear, renombrar, colorear y borrar grupos, elegir su prioridad, lo que siembran y su zona, y repartir gnomos.
import { CROP_IDS, GROUP_NAME_MAX, GROUP_PALETTE, MAX_GROUPS, PRIORITIES } from '../../sim/config';
import { cropUnlocked, fieldSize, inZone } from '../../sim/sim';
import type { CropId, GameState, GnomeGroup, Priority } from '../../sim/types';
import { jobIcons, traitIcons } from '../../render/icons';
import { CULTIVOS, FICHA, GRUPOS, OFICIOS, prioridad, RASGOS } from '../../textos';
import { esc, html, pixelImg, type GameActions } from '../dom';
import type { Menu } from '../windows';

export function createGroupsMenu(actions: GameActions): Menu {
  let selectedGnome: number | null = null;
  let paletteFor: number | null = null;
  let armedDelete: number | null = null;
  let armTimer = 0;
  /** primera esquina pulsada de la zona de un grupo, a la espera de la segunda */
  let corner: { group: number; c: number; r: number } | null = null;
  let sig = '';

  const el = html(`
    <div class="groups">
      <p class="muted">${GRUPOS.ayuda} ${GRUPOS.zonaAyuda} ${FICHA.ayudaTablon}</p>
      <div class="group-list"></div>
    </div>`);
  const list = el.querySelector<HTMLElement>('.group-list')!;

  function zonePicker(s: GameState, g: GnomeGroup): string {
    const f = fieldSize(s);
    const z = g.zone;
    const cells: string[] = [];
    for (let r = 0; r < f.rows; r++) {
      for (let c = 0; c < f.cols; c++) {
        const isCorner = corner?.group === g.id && corner.c === c && corner.r === r;
        cells.push(`<button type="button" class="zone-cell ${inZone(z, { col: c, row: r }) ? 'in' : ''} ${isCorner ? 'corner' : ''}"
          data-zone-cell="${g.id}:${c}:${r}" aria-label="${GRUPOS.zonaCelda(c, r)}" aria-pressed="${isCorner}"></button>`);
      }
    }
    const desc = z ? GRUPOS.zonaDesc(z.c0, z.c1, z.r0, z.r1) : GRUPOS.zonaTodo;
    return `
      <div class="zone">
        <span class="zone-label">${GRUPOS.zona}</span>
        <div class="zone-grid" style="--cols:${f.cols}" role="group" aria-label="${GRUPOS.zona}">${cells.join('')}</div>
        <div class="zone-info">
          <span>${corner?.group === g.id ? GRUPOS.zonaEsquina : desc}</span>
          ${z ? `<button type="button" class="link" data-zone-all="${g.id}">${GRUPOS.zonaTodo}</button>` : ''}
        </div>
      </div>`;
  }

  function render(s: GameState) {
    const unlocked = (p: Priority) => !p.startsWith('solo_') || cropUnlocked(s, p.slice('solo_'.length) as CropId);
    const cards = s.groups.map((g, i) => {
      const members = s.gnomes.filter(gn => gn.group === g.id);
      const color = GROUP_PALETTE[g.color];
      const canMoveHere = selectedGnome !== null && s.gnomes.some(gn => gn.id === selectedGnome && gn.group !== g.id);
      return `
        <article class="group" data-group="${g.id}" style="--group:${color}">
          <header>
            <button type="button" class="swatch" data-color-toggle="${g.id}" style="background:${color}"
              aria-label="${GRUPOS.color}" aria-expanded="${paletteFor === g.id}"></button>
            <input class="group-name" data-rename="${g.id}" value="${esc(g.name)}" maxlength="${GROUP_NAME_MAX}" aria-label="${GRUPOS.nombre}">
            <span class="muted count">${GRUPOS.miembros(members.length)}</span>
          </header>
          ${paletteFor === g.id ? `
            <div class="palette" role="group" aria-label="${GRUPOS.color}">
              ${GROUP_PALETTE.map((c, ci) => `
                <button type="button" class="swatch" data-set-color="${g.id}:${ci}" style="background:${c}" aria-pressed="${ci === g.color}" aria-label="${GRUPOS.color} ${ci + 1}"></button>`).join('')}
            </div>` : ''}
          <label class="prio">
            <span>${GRUPOS.prioridad}</span>
            <select data-prio="${g.id}">
              ${PRIORITIES.map(p => `<option value="${p}" ${p === g.priority ? 'selected' : ''} ${unlocked(p) ? '' : 'disabled'}>${prioridad(p)}${unlocked(p) ? '' : ` (${GRUPOS.bloqueado})`}</option>`).join('')}
            </select>
          </label>
          <label class="prio">
            <span>${GRUPOS.siembra}</span>
            <select data-group-seed="${g.id}">
              <option value="" ${g.seed === null ? 'selected' : ''}>${GRUPOS.siembraIgual}</option>
              ${CROP_IDS.map(c => `<option value="${c}" ${c === g.seed ? 'selected' : ''} ${cropUnlocked(s, c) ? '' : 'disabled'}>${CULTIVOS[c].nombre}${cropUnlocked(s, c) ? '' : ` (${GRUPOS.bloqueado})`}</option>`).join('')}
            </select>
          </label>
          ${zonePicker(s, g)}
          <div class="chips" data-drop="${g.id}">
            ${members.length
              ? members.map(gn => `
                <button type="button" class="chip ${selectedGnome === gn.id ? 'selected' : ''}" data-gnome="${gn.id}" draggable="true" data-tip="${esc(`${OFICIOS[gn.job].nombre} · ${RASGOS[gn.trait].nombre}`)}">
                  ${pixelImg(jobIcons[gn.job], 'px chip-icon')}${esc(gn.name)}${pixelImg(traitIcons[gn.trait], 'px trait-icon')}
                </button>`).join('')
              : `<span class="muted empty">${GRUPOS.vacio}</span>`}
          </div>
          <footer>
            ${i === 0 ? `<span class="badge">${GRUPOS.nuevos}</span>` : ''}
            ${selectedGnome !== null && members.some(gn => gn.id === selectedGnome) ? `<button type="button" class="btn small" data-show="${selectedGnome}">${FICHA.ver}</button>` : ''}
            ${canMoveHere ? `<button type="button" class="btn small" data-move-here="${g.id}">${GRUPOS.moverAqui}</button>` : ''}
            ${s.groups.length > 1 ? `<button type="button" class="link" data-delete="${g.id}">${armedDelete === g.id ? GRUPOS.borrarSeguro : GRUPOS.borrar}</button>` : ''}
          </footer>
        </article>`;
    });
    const full = s.groups.length >= MAX_GROUPS;
    list.innerHTML = cards.join('') + `
      <button type="button" class="new-group" data-new-group ${full ? 'disabled' : ''}>
        <span aria-hidden="true">+</span>${full ? GRUPOS.maximo : GRUPOS.nuevo}
      </button>`;
  }

  el.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const btn = t.closest<HTMLElement>('button');
    if (!btn) return;
    const d = btn.dataset;
    if (d.colorToggle) {
      paletteFor = paletteFor === Number(d.colorToggle) ? null : Number(d.colorToggle);
    } else if (d.setColor) {
      const [id, color] = d.setColor.split(':').map(Number);
      actions.setGroupColor(id, color);
      paletteFor = null;
    } else if (d.gnome) {
      const id = Number(d.gnome);
      selectedGnome = selectedGnome === id ? null : id;
    } else if (d.show) {
      selectedGnome = null;
      actions.showGnome(Number(d.show));
    } else if (d.moveHere && selectedGnome !== null) {
      actions.moveGnome(selectedGnome, Number(d.moveHere));
      selectedGnome = null;
    } else if (d.delete) {
      const id = Number(d.delete);
      clearTimeout(armTimer);
      if (armedDelete === id) {
        armedDelete = null;
        actions.deleteGroup(id);
      } else {
        armedDelete = id;
        armTimer = window.setTimeout(() => {
          armedDelete = null;
          sig = '';
        }, 3000);
      }
    } else if (d.newGroup !== undefined) {
      actions.createGroup();
    } else if (d.zoneCell) {
      const [id, c, r] = d.zoneCell.split(':').map(Number);
      if (corner?.group === id) {
        actions.setGroupZone(id, { c0: corner.c, r0: corner.r, c1: c, r1: r });
        corner = null;
      } else {
        corner = { group: id, c, r };
      }
    } else if (d.zoneAll) {
      actions.setGroupZone(Number(d.zoneAll), null);
      corner = null;
    }
    sig = '';
  });

  el.addEventListener('change', e => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t.dataset.prio) actions.setPriority(Number(t.dataset.prio), t.value as Priority);
    if (t.dataset.groupSeed) actions.setGroupSeed(Number(t.dataset.groupSeed), (t.value || null) as CropId | null);
    if (t.dataset.rename) actions.renameGroup(Number(t.dataset.rename), t.value);
    sig = '';
  });
  el.addEventListener('keydown', e => {
    const t = e.target as HTMLInputElement;
    if (e.key === 'Enter' && t.dataset.rename) t.blur();
  });

  // doble clic en un gnomo: su ficha
  el.addEventListener('dblclick', e => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-gnome]');
    if (!chip) return;
    selectedGnome = null;
    actions.showGnome(Number(chip.dataset.gnome));
  });

  // arrastrar gnomos entre grupos
  el.addEventListener('dragstart', e => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-gnome]');
    if (!chip || !e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', chip.dataset.gnome!);
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragover', e => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-group]');
    if (!card) return;
    e.preventDefault();
    el.querySelectorAll('.drop-over').forEach(c => c !== card && c.classList.remove('drop-over'));
    card.classList.add('drop-over');
  });
  el.addEventListener('dragleave', e => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-group]');
    if (card && !card.contains(e.relatedTarget as Node)) card.classList.remove('drop-over');
  });
  el.addEventListener('drop', e => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-group]');
    const id = e.dataTransfer?.getData('text/plain');
    if (!card || !id) return;
    e.preventDefault();
    actions.moveGnome(Number(id), Number(card.dataset.group));
    selectedGnome = null;
    sig = '';
  });

  return {
    el,
    onOpen() {
      selectedGnome = null;
      paletteFor = null;
      corner = null;
      sig = '';
    },
    update(s) {
      // no se redibuja mientras se escribe un nombre, para no perder el foco
      if (el.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement) return;
      const next = JSON.stringify([
        s.groups,
        s.gnomes.map(g => [g.id, g.group, g.job, g.name]),
        Object.values(s.tree),
        selectedGnome, paletteFor, armedDelete, corner,
      ]);
      if (next === sig) return;
      sig = next;
      const focused = document.activeElement instanceof HTMLElement && el.contains(document.activeElement)
        ? Object.entries(document.activeElement.dataset)[0]
        : null;
      render(s);
      // devuelve el foco al mismo control tras redibujar (teclado)
      if (focused) {
        const [k, v] = focused;
        const attr = k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        el.querySelector<HTMLElement>(`[data-${attr}="${v}"]`)?.focus({ preventScroll: true });
      }
    },
  };
}
