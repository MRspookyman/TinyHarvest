// Álbum del huerto (G6): seis páginas de cromos que se coleccionan a lo largo de todas las temporadas.
import { CROP_IDS, JOB_IDS, TRAIT_IDS } from './config';
import { ALBUM_TEXTOS, LEGENDARIO } from '../textos';

export type AlbumPage = keyof typeof ALBUM_TEXTOS.paginas;
export const SUCESOS = ['cuervo', 'caracol', 'topo', 'ranas', 'sindicato', 'espantapajaros'] as const;
export type Suceso = (typeof SUCESOS)[number];
/** cromos de cada página, por clave; el id del cromo es `página:clave` */
export const ALBUM_PAGES: Record<AlbumPage, readonly string[]> = {
  oficios: JOB_IDS,
  rasgos: TRAIT_IDS,
  // los títulos de los legendarios, por su posición en LEGENDARIO.titulos
  leyendas: LEGENDARIO.titulos.map((_, i) => String(i)),
  sucesos: SUCESOS,
  doradas: CROP_IDS,
  maestrias: CROP_IDS,
};
export const ALBUM_PAGE_IDS = Object.keys(ALBUM_PAGES) as AlbumPage[];

export const stickerId = (page: AlbumPage, key: string) => `${page}:${key}`;
export const pageRewardId = (page: AlbumPage) => `pagina:${page}`;

/** todo lo que puede haber en el álbum guardado: cromos y páginas premiadas */
export const ALBUM_IDS = new Set([
  ...ALBUM_PAGE_IDS.flatMap(page => ALBUM_PAGES[page].map(key => stickerId(page, key))),
  ...ALBUM_PAGE_IDS.map(pageRewardId),
]);
