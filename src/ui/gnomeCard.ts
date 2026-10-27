// Ficha de un gnomo: panel pequeño en una esquina que no tapa el huerto. Mientras está abierta, la cámara lo sigue.
import { GROUP_PALETTE } from '../sim/config';
import type { GameState, Gnome } from '../sim/types';
import { crownIcon, jobIcons, legendIcon, traitIcons } from '../render/icons';
import { CULTIVOS, FICHA, LEGENDARIO, OFICIOS, RANKING, RASGOS } from '../textos';
import { esc, html, pixelImg, type GameActions } from './dom';
import { PX_PER_STEP } from './menus/ranking';

export interface GnomeCard {
  open(id: number): void;
  close(): void;
  readonly current: number | null;
  update(s: GameState): void;
}

const STATS = Object.keys(FICHA.stats) as (keyof typeof FICHA.stats)[];

/** Nombre de pila: «Pepín» de «Pepín Barbatiesa». */
const firstName = (s: GameState, id: number | undefined) => s.gnomes.find(g => g.id === id)?.name.split(' ')[0] ?? null;

/** Lo que está haciendo ahora, en una frase corta. */
function doing(s: GameState, g: Gnome): string {
  const H = FICHA.haciendo;
  const t = g.task;
  const bubble = g.bubble?.kind;
  if (bubble === 'yum') return H.comiendo;
  if (!t) return H.decidiendo;
  const working = g.state === 'work';
  const plot = t.plot === undefined ? undefined : s.plots.find(p => p.id === t.plot);
  switch (t.kind) {
    case 'harvest': {
      const uno = CULTIVOS[g.bubble?.crop ?? plot?.crop ?? 'zanahoria'].uno;
      return working ? H.recogiendo(uno) : H.vaARecoger(uno);
    }
    case 'plant': {
      // siembra lo que diga su grupo; si no dice nada, lo que había
      const seed = s.groups.find(gr => gr.id === g.group)?.seed;
      const uno = CULTIVOS[g.bubble?.crop ?? seed ?? plot?.crop ?? 'zanahoria'].uno;
      return working ? H.plantando(uno) : H.vaAPlantar(uno);
    }
    case 'deliver': return working ? H.entregando : H.vaAlGranero;
    case 'drop': return H.vaALaCesta;
    case 'wait': return H.cestaLlena;
    case 'pickup': return H.vaAPorCesta;
    case 'wander': return bubble === 'note' ? H.silbando : H.paseando;
    case 'rest': return H.descansando;
    case 'nap': return H.siesta;
    case 'complain': return H.queja;
    case 'sit': return H.sentado;
    case 'cards': return H.cartas(firstName(s, t.other));
    case 'chase': return H.mariposa;
    case 'chat': return H.charla(firstName(s, t.other));
    case 'greet': return H.saludo(firstName(s, t.other));
    case 'fall': return H.tropiezo;
    case 'shoo': return H.cuervo;
    case 'scarecrow': return H.espantapajaros;
    case 'strike': return H.huelga;
    case 'cheer': return H.aplaudiendo;
    case 'think': return H.pensando;
  }
}

/** Frase del día: fija para cada gnomo durante un minuto, sin guardar nada. */
function quote(g: Gnome, minute: number): string {
  const pool = [...FICHA.frases, ...FICHA.frasesRasgo[g.trait]];
  const h = (Math.imul(g.id + 1, 2654435761) ^ Math.imul(minute, 40503)) >>> 0;
  return pool[h % pool.length];
}

const statValue = (g: Gnome, k: keyof typeof FICHA.stats) =>
  Math.floor(k === 'walked' ? g.stats.walked / PX_PER_STEP : g.stats[k]);

/** @param follow pide a la cámara que siga a un gnomo (null = vista normal) */
export function createGnomeCard(
  host: HTMLElement,
  actions: GameActions,
  follow: (id: number | null) => void,
): GnomeCard {
  const el = html(`
    <aside class="gnome-card" aria-labelledby="gnome-card-name" hidden>
      <header class="card-head">
        <div class="card-title" data-head></div>
        <button type="button" class="win-close" aria-label="${FICHA.cerrar}" title="${FICHA.cerrar}">×</button>
      </header>
      <div class="card-body" data-body></div>
      <label class="prio card-move">
        <span>${FICHA.mover}</span>
        <select data-move></select>
      </label>
    </aside>`);
  host.append(el);
  const head = el.querySelector<HTMLElement>('[data-head]')!;
  const body = el.querySelector<HTMLElement>('[data-body]')!;
  const move = el.querySelector<HTMLSelectElement>('[data-move]')!;
  let current: number | null = null;
  let sig = '';
  let moveSig = '';

  el.querySelector('.win-close')!.addEventListener('click', () => close());
  move.addEventListener('change', () => {
    if (current !== null) actions.moveGnome(current, Number(move.value));
    move.blur();
  });
  // Esc cierra la ficha solo si no hay ventana abierta (la ventana marca la tecla como usada al cerrarse)
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && current !== null && !e.defaultPrevented) close();
  });

  function open(id: number) {
    if (current === id) return;
    current = id;
    sig = '';
    moveSig = '';
    el.hidden = false;
    follow(id);
  }

  function close() {
    if (current === null) return;
    current = null;
    el.hidden = true;
    follow(null);
  }

  function render(s: GameState, g: Gnome) {
    const group = s.groups.find(gr => gr.id === g.group);
    const oficio = OFICIOS[g.job].nombre;
    const crowned = s.crowns[g.job] === g.id;
    head.innerHTML = `
      ${pixelImg(jobIcons[g.job], 'px card-job')}
      <div>
        <h2 id="gnome-card-name">${esc(g.name)}${crowned ? pixelImg(crownIcon, 'px crown-icon') : ''}</h2>
        <p>${oficio}${crowned ? ` · ${RANKING.corona(oficio.toLowerCase())}` : ''}</p>
        ${g.legendary ? `<span class="badge legend" title="${esc(LEGENDARIO.desc)}">${pixelImg(legendIcon, 'px legend-icon')}${LEGENDARIO.nombre}</span>` : ''}
      </div>`;
    body.innerHTML = `
      <dl class="card-facts">
        <dt>${FICHA.grupo}</dt>
        <dd><i class="dot" style="background:${group ? GROUP_PALETTE[group.color] : 'transparent'}"></i>${esc(group?.name ?? '')}</dd>
        <dt>${FICHA.rasgo}</dt>
        <dd>${pixelImg(traitIcons[g.trait], 'px trait-icon')}<b>${RASGOS[g.trait].nombre}</b> <span class="muted">${RASGOS[g.trait].desc}</span></dd>
        <dt>${FICHA.ahora}</dt>
        <dd class="card-now">${doing(s, g)}</dd>
      </dl>
      <ul class="card-stats">
        ${STATS.map(k => `<li><b>${statValue(g, k)}</b> ${FICHA.stats[k]}</li>`).join('')}
      </ul>
      <blockquote class="card-quote"><span>${FICHA.frase}</span>«${quote(g, Math.floor(Date.now() / 60000))}»</blockquote>`;
  }

  return {
    open,
    close,
    get current() {
      return current;
    },
    update(s) {
      if (current === null) return;
      const g = s.gnomes.find(gn => gn.id === current);
      // ya no está (partida nueva): se cierra
      if (!g) return close();

      const next = JSON.stringify([
        g.name, g.job, g.group, g.trait, g.legendary, s.crowns[g.job] === g.id, doing(s, g),
        STATS.map(k => statValue(g, k)), Math.floor(Date.now() / 60000),
        s.groups.find(gr => gr.id === g.group),
      ]);
      if (next !== sig) {
        sig = next;
        render(s, g);
      }

      // el desplegable no se rehace mientras se usa
      if (document.activeElement === move) return;
      const nextMove = JSON.stringify([g.group, s.groups.map(gr => [gr.id, gr.name])]);
      if (nextMove === moveSig) return;
      moveSig = nextMove;
      move.innerHTML = s.groups
        .map(gr => `<option value="${gr.id}" ${gr.id === g.group ? 'selected' : ''}>${esc(gr.name)}</option>`)
        .join('');
    },
  };
}
