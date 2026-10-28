// Álbum del huerto (G6): los cromos conseguidos en todas las temporadas. Lo que falta sale en silueta, con una pista.
import { ALBUM_PAGE_IDS, ALBUM_PAGES, pageRewardId, stickerId, type AlbumPage, type Suceso } from '../../sim/album';
import { ALBUM } from '../../sim/config';
import type { CropId, GameState, JobId, TraitId } from '../../sim/types';
import { cropIcons, eventIcons, jobIcons, legendIcon, traitIcons } from '../../render/icons';
import { ALBUM_TEXTOS, CULTIVOS, LEGENDARIO, OFICIOS, RASGOS } from '../../textos';
import { esc, html, pixelImg } from '../dom';
import type { Menu } from '../windows';

/** icono y nombre de cada cromo */
function sticker(page: AlbumPage, key: string): { icon: string; name: string } {
  switch (page) {
    case 'oficios': return { icon: jobIcons[key as JobId], name: OFICIOS[key as JobId].nombre };
    case 'rasgos': return { icon: traitIcons[key as TraitId], name: RASGOS[key as TraitId].nombre };
    case 'leyendas': return { icon: legendIcon, name: LEGENDARIO.titulos[Number(key)] };
    case 'sucesos': return { icon: eventIcons[key as Suceso], name: ALBUM_TEXTOS.sucesos[key as Suceso] };
    case 'doradas': return { icon: cropIcons[key as CropId], name: CULTIVOS[key as CropId].nombre };
    case 'maestrias': return { icon: cropIcons[key as CropId], name: ALBUM_TEXTOS.maestria(CULTIVOS[key as CropId].plural) };
  }
}

export function createAlbumMenu(): Menu {
  const el = html(`
    <div class="album">
      <p class="muted">${ALBUM_TEXTOS.ayuda(ALBUM.pageSeeds)}</p>
      <div class="album-pages"></div>
    </div>`);
  const pages = el.querySelector<HTMLElement>('.album-pages')!;
  let sig = '';

  return {
    el,
    update(s: GameState) {
      const album = s.prestige.album;
      const next = album.join(',');
      if (next === sig) return;
      sig = next;
      pages.innerHTML = ALBUM_PAGE_IDS.map(page => {
        const keys = ALBUM_PAGES[page];
        const have = keys.filter(k => album.includes(stickerId(page, k))).length;
        const done = album.includes(pageRewardId(page));
        const t = ALBUM_TEXTOS.paginas[page];
        return `
          <section class="album-page ${done ? 'done' : ''}" data-page="${page}">
            <header><h3>${t.titulo}</h3><span>${have} / ${keys.length}</span></header>
            <ul>
              ${keys.map(k => {
                const got = album.includes(stickerId(page, k));
                const { icon, name } = sticker(page, k);
                return got
                  ? `<li class="sticker" title="${esc(name)}">${pixelImg(icon, `px ${page === 'doradas' ? 'gilded' : ''}`)}<span>${esc(name)}</span></li>`
                  : `<li class="sticker missing" title="${esc(t.pista)}">${pixelImg(icon, 'px silhouette')}<span>${ALBUM_TEXTOS.falta}</span></li>`;
              }).join('')}
            </ul>
            <footer>${done ? ALBUM_TEXTOS.completa : ALBUM_TEXTOS.premio(ALBUM.pageSeeds)} · <span class="muted">${t.pista}</span></footer>
          </section>`;
      }).join('');
    },
  };
}
