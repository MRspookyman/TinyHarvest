// Ficha de un gnomo: panel estrecho en una esquina, plegable, para no tapar el huerto. Mientras está abierta, la cámara lo sigue.
import { FRIENDS, GROUP_PALETTE } from '../sim/config';
import type { GameState, Gnome } from '../sim/types';
import { crownIcon, jobIcons, legendIcon, traitIcons } from '../render/icons';
import { CULTIVOS, FICHA, LEGENDARIO, OFICIOS, RANKING, RASGOS } from '../textos';
import { esc, html, pixelImg, type GameActions } from './dom';
import { PX_PER_STEP } from './menus/ranking';

export interface GnomeCard {
  /** el panel, para que la cámara sepa cuánto tapa */
  readonly el: HTMLElement;
  open(id: number): void;
  close(): void;
  readonly current: number | null;
  update(s: GameState): void;
}

const STATS = Object.keys(FICHA.stats) as (keyof typeof FICHA.stats)[];
const FOLD_KEY = 'tiny-harvest:ficha-plegada';

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
    case 'water': {
      if (!plot || plot.stage < 0) return H.regandoTierra;
      const uno = CULTIVOS[plot.crop].uno;
      return working ? H.regando(uno) : H.vaARegar(uno);
    }
    case 'refill': return working ? H.llenando : H.vaAlPozo;
    case 'patrol': return H.patrullando;
    case 'watch': return bubble === 'eye' ? H.haVisto : H.vigilando;
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
        <div class="card-btns">
          <button type="button" class="win-close card-fold" data-fold aria-expanded="true"></button>
          <button type="button" class="win-close" data-close aria-label="${FICHA.cerrar}" data-tip="${FICHA.cerrar}">×</button>
        </div>
      </header>
      <p class="card-now"><span>${FICHA.ahora}</span><b data-now></b></p>
      <div class="card-body" data-body></div>
      <label class="prio card-move">
        <span>${FICHA.mover}</span>
        <select data-move></select>
      </label>
    </aside>`);
  host.append(el);
  const head = el.querySelector<HTMLElement>('[data-head]')!;
  const now = el.querySelector<HTMLElement>('[data-now]')!;
  const body = el.querySelector<HTMLElement>('[data-body]')!;
  const move = el.querySelector<HTMLSelectElement>('[data-move]')!;
  const foldBtn = el.querySelector<HTMLButtonElement>('[data-fold]')!;
  let current: number | null = null;
  let sig = '';
  let moveSig = '';

  // plegada solo enseña el nombre y lo que hace, para ver más huerto; se recuerda entre partidas
  const setFolded = (folded: boolean) => {
    el.classList.toggle('folded', folded);
    foldBtn.textContent = folded ? '+' : '−';
    foldBtn.dataset.tip = folded ? FICHA.desplegar : FICHA.plegar;
    foldBtn.setAttribute('aria-label', foldBtn.dataset.tip);
    foldBtn.setAttribute('aria-expanded', String(!folded));
    try {
      localStorage.setItem(FOLD_KEY, folded ? '1' : '0');
    } catch {
      // sin almacenamiento: se pliega igual, solo que no se recuerda
    }
  };
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(FOLD_KEY);
  } catch {
    // sin almacenamiento
  }
  // la primera vez, plegada si la pantalla es baja (portátiles pequeños, tabletas en horizontal)
  setFolded(stored === null ? window.innerHeight < 700 : stored === '1');
  foldBtn.addEventListener('click', () => setFolded(!el.classList.contains('folded')));

  el.querySelector('[data-close]')!.addEventListener('click', () => close());
  // el nombre del amigo abre su ficha
  body.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-friend]');
    if (btn) open(Number(btn.dataset.friend));
  });
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
    const friend = g.friend === null ? null : s.gnomes.find(o => o.id === g.friend) ?? null;
    head.innerHTML = `
      ${pixelImg(jobIcons[g.job], 'px card-job')}
      <div>
        <h2 id="gnome-card-name">${esc(g.name)}${crowned ? pixelImg(crownIcon, 'px crown-icon') : ''}</h2>
        <p>${oficio}${crowned ? ` · ${RANKING.corona(oficio.toLowerCase())}` : ''}</p>
        ${g.legendary ? `<span class="badge legend" data-tip="${esc(LEGENDARIO.desc)}">${pixelImg(legendIcon, 'px legend-icon')}${LEGENDARIO.nombre}</span>` : ''}
      </div>`;
    now.textContent = doing(s, g);
    body.innerHTML = `
      <dl class="card-facts">
        <dt>${FICHA.grupo}</dt>
        <dd><i class="dot" style="background:${group ? GROUP_PALETTE[group.color] : 'transparent'}"></i>${esc(group?.name ?? '')}</dd>
        <dt>${FICHA.rasgo}</dt>
        <dd>${pixelImg(traitIcons[g.trait], 'px trait-icon')}<b>${RASGOS[g.trait].nombre}</b> <span class="muted">${RASGOS[g.trait].desc}</span></dd>
        <dt>${FICHA.amigo}</dt>
        <dd>${friend
          ? `<button type="button" class="link" data-friend="${friend.id}">♥ ${esc(friend.name)}</button> <span class="muted">${FICHA.amigoAyuda(Math.round(FRIENDS.bonus * 100))}</span>`
          : `<span class="muted">${FICHA.sinAmigo}</span>`}</dd>
      </dl>
      <ul class="card-stats">
        ${STATS.map(k => `<li><b>${statValue(g, k)}</b> ${FICHA.stats[k]}</li>`).join('')}
      </ul>
      <blockquote class="card-quote"><span>${FICHA.frase}</span>«${quote(g, Math.floor(Date.now() / 60000))}»</blockquote>`;
  }

  return {
    el,
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
        g.name, g.job, g.group, g.trait, g.legendary, g.friend, s.crowns[g.job] === g.id, doing(s, g),
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
