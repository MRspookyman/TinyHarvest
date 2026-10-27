// Todos los textos del juego. Para retocar el tono, se cambia aquí.
import {
  BASKET, CARRETILLA_PER_LEVEL, CONSERVAS_PER_LEVEL, CROPS, MERCADO_PER_LEVEL, PORTER_CAPACITY,
} from './sim/config';
import type { Branch, CropId, JobId, NodeId, Priority } from './sim/types';

const pct = (f: number) => `${Math.round(f * 100)} %`;

export const UI = {
  titulo: 'Tiny Harvest',
  monedas: 'monedas',
  gnomos: 'gnomos',
  cerrar: 'Cerrar',
  vale: (n: number) => `vale ${n}`,
  semilla: 'Semilla',
  semillaAyuda: 'Lo que plantas al hacer clic en la tierra',
  bloqueadaEnArbol: 'Se desbloquea en el árbol de mejoras',
  tienes: (n: number) => `Tienes ${n}`,
  contratar: (n: number) => `Contratar · ${n}`,
  nivel: (n: number, max: number) => `Nivel ${n} de ${max}`,
  comprar: (n: number) => `Comprar · ${n}`,
  alMaximo: 'Al máximo',
  necesita: (padre: string) => `Necesita «${padre}»`,
  eligeNodo: 'Elige una rama del árbol para ver qué hace.',
  raiz: 'Huerto',
  raizDesc: 'De aquí sale todo. Las raíces no se compran: ya son tuyas.',
  bancalTam: (c: number, r: number) => `${c} × ${r}`,
  porViaje: (n: number) => `${n} cultivos por viaje`,
  masAguante: (p: number) => `lo maduro aguanta un ${p} % más`,
  masCaro: (p: number) => `todo se vende un ${p} % más caro`,
  ahora: 'Ahora',
  borrar: 'Borrar partida',
  borrarSeguro: '¿Seguro? Pulsa otra vez',
  pista: 'Haz clic en la tierra para plantar y en lo maduro para recogerlo. Lo maduro no espera para siempre: si nadie lo recoge, se echa a perder. El granero, la casa de gnomos, el tablón y el árbol viejo abren los menús.',
};

/** Menús y los elementos del huerto que los abren. */
export const MENUS = {
  contratar: { titulo: 'Granero', sub: 'Contratar gnomos', lugar: 'Granero', boton: 'Granero' },
  grupos: { titulo: 'Tablón de anuncios', sub: 'Grupos de gnomos', lugar: 'Tablón de anuncios', boton: 'Tablón' },
  arbol: { titulo: 'Árbol viejo', sub: 'Árbol de mejoras', lugar: 'Árbol viejo', boton: 'Árbol' },
  diario: { titulo: 'Diario del huerto', sub: 'Lo que ha pasado', lugar: 'Diario', boton: 'Diario' },
  ranking: { titulo: 'Gnomos del mes', sub: 'Quién destaca en el huerto', lugar: 'Ranking', boton: 'Ranking' },
} as const;
export type MenuId = keyof typeof MENUS;

export const OFICIOS: Record<JobId, { nombre: string; desc: string }> = {
  recolector: { nombre: 'Recolector', desc: 'Recoge lo que madura y lo lleva al granero. A veces, también lo que no.' },
  sembrador: { nombre: 'Sembrador', desc: 'Planta en las parcelas vacías, y arranca y vuelve a plantar las echadas a perder. Con una fe inquebrantable.' },
  porteador: { nombre: 'Porteador', desc: `Lleva la cosecha de la cesta al granero, de ${PORTER_CAPACITY} en ${PORTER_CAPACITY} (más con carretilla). Con porteadores, los recolectores dejan lo recogido en la cesta del bancal.` },
};

export const CULTIVOS: Record<CropId, { nombre: string; uno: string; plural: string }> = {
  zanahoria: { nombre: 'Zanahoria', uno: 'una zanahoria', plural: 'zanahorias' },
  trigo: { nombre: 'Trigo', uno: 'un haz de trigo', plural: 'trigo' },
  tomate: { nombre: 'Tomate', uno: 'un tomate', plural: 'tomates' },
  calabaza: { nombre: 'Calabaza', uno: 'una calabaza', plural: 'calabazas' },
};

export function prioridad(p: Priority): string {
  if (p === 'cercano') return 'Lo más cercano primero';
  if (p === 'valioso') return 'Lo más valioso (según el paseo)';
  if (p === 'urgente') return 'Lo que se va a estropear antes';
  const crop = p.slice('solo_'.length) as CropId;
  return crop === 'trigo' ? 'Solo trigo' : `Solo ${CULTIVOS[crop].plural}`;
}

export const RAMAS: Record<Branch, string> = { gnomos: 'Gnomos', bancal: 'Bancal', cultivos: 'Cultivos' };

/** Descripción de las semillas sacada de CROPS, para que los números no se queden viejos. */
function semillaDesc(crop: CropId, cola: string): string {
  const c = CROPS[crop];
  if (crop === 'trigo') return `Permite plantar trigo: vale ${c.value}, tarda ${c.grow} s y aguanta ${c.keep} s maduro. ${cola}`;
  if (crop === 'tomate') return `Permite plantar tomates: valen ${c.value}, tardan ${c.grow} s y aguantan ${c.keep} s maduros. ${cola}`;
  return `Permite plantar ${CULTIVOS[crop].plural}: valen ${c.value}, tardan ${c.grow} s y aguantan ${c.keep} s maduras. ${cola}`;
}

export const ARBOL: Record<NodeId, { nombre: string; desc: string }> = {
  botas: { nombre: 'Botas con suela de corcho', desc: 'Los gnomos andan un 20 % más rápido por nivel.' },
  cafe: { nombre: 'Café de bellota', desc: 'Recogen y plantan un 18 % más rápido por nivel. Tiemblan un poco.' },
  saco: { nombre: 'Saco de tamaño familiar', desc: 'Los recolectores cargan un cultivo más por viaje.' },
  porteadores: { nombre: 'Gremio de porteadores', desc: 'Permite contratar porteadores en el granero. Llegan con carretilla propia y muchas opiniones.' },
  cesta: { nombre: 'Cesta de mimbre reforzado', desc: `La cesta del bancal guarda ${BASKET.perLevel} cultivos más por nivel.` },
  carretilla: { nombre: 'Carretilla con una rueda de más', desc: `Cada porteador se lleva ${CARRETILLA_PER_LEVEL} cultivos más por viaje y nivel. Nadie sabe para qué es la rueda de más, pero gira.` },
  bancal: { nombre: 'Ampliar el bancal', desc: 'Una columna o una fila más de tierra labrada.' },
  trigo: { nombre: 'Semillas de trigo', desc: semillaDesc('trigo', 'Más lento que la zanahoria, pero cada viaje cunde más.') },
  abono: { nombre: 'Abono de dudosa procedencia', desc: 'Los cultivos crecen un 15 % más rápido por nivel. Mejor no preguntar.' },
  tomate: { nombre: 'Semillas de tomate', desc: semillaDesc('tomate', 'Pocos viajes y buenas monedas, si alguien llega a tiempo.') },
  calabaza: { nombre: 'Semillas de calabaza', desc: semillaDesc('calabaza', 'Lentísima y cómoda: una siembra, una siesta larga y un viaje que vale la pena.') },
  conservas: { nombre: 'Cestos con paja', desc: `Lo maduro aguanta un ${pct(CONSERVAS_PER_LEVEL)} más por nivel antes de echarse a perder. La paja pica, pero no se queja nadie.` },
  mercado: { nombre: 'Puesto en el mercado', desc: `Todos los cultivos se venden un ${pct(MERCADO_PER_LEVEL)} más caros por nivel. Los gnomos regatean con mucho teatro.` },
};

/** Casa de gnomos: cada gnomo necesita una cama. Se gestiona desde el granero. */
export const CASA = {
  nombre: 'Casa de gnomos',
  desc: 'Cada gnomo necesita una cama. Sin camas libres no viene nadie, por mucho que pagues.',
  camas: (gnomos: number, camas: number) => `${gnomos} de ${camas} camas ocupadas`,
  ampliar: (coste: number) => `Ampliar · ${coste}`,
  lleno: 'No caben: amplía la casa',
  maximo: 'La casa no da para más: ya roza las nubes',
};

export const GRUPOS = {
  primero: 'Los de siempre',
  sugerencias: ['Los Madrugadores', 'La Brigada del Surco', 'Los Sin Prisa', 'Comando Zanahoria', 'Los del Fondo', 'La Peña del Rastrillo', 'Los Barbas', 'Los Siesteros', 'Escuadrón Tomate', 'Los Que Llegan Tarde'],
  ayuda: 'Cada grupo sigue su prioridad y siembra lo que le digas. En el huerto, el aro bajo cada gnomo y la marca en la parcela a la que va tienen el color de su grupo. Arrastra un gnomo a otro grupo, o pulsa en él y luego en «Mover aquí».',
  nuevo: 'Nuevo grupo',
  nombre: 'Nombre del grupo',
  color: 'Color',
  prioridad: 'Prioridad',
  siembra: 'Siembran',
  siembraIgual: 'Lo mismo que había',
  vacio: 'Nadie todavía. Arrastra aquí algún gnomo.',
  moverAqui: 'Mover aquí',
  borrar: 'Borrar grupo',
  borrarSeguro: '¿Seguro?',
  nuevos: 'Aquí llegan los recién contratados',
  maximo: 'No caben más grupos',
  miembros: (n: number) => (n === 1 ? '1 gnomo' : `${n} gnomos`),
  bloqueado: 'sin desbloquear',
};

/** Ventana del ranking. Cada categoría muestra el podio de los gnomos actuales. */
export const RANKING = {
  ayuda: 'En cada oficio, el que más tareas lleva luce corona en el huerto. Para quitársela hay que sacarle ventaja. La corona es solo fama: no da ninguna ventaja.',
  corona: (oficio: string) => `Mejor ${oficio} del mes`,
  nadie: 'Nadie todavía.',
  perdidos: (n: number) => (n === 1 ? '1 cultivo echado a perder' : `${n} cultivos echados a perder`),
  aMano: (n: number) => (n === 1 ? 'Tú: 1 recogido a mano' : `Tú: ${n} recogidos a mano`),
  categorias: {
    tasks: { titulo: 'Los mejores de cada oficio', unidad: 'tareas; cada oficio compite con los suyos' },
    value: { titulo: 'El que más monedas genera', unidad: 'monedas cosechadas' },
    plants: { titulo: 'Mejor sembrador', unidad: 'siembras' },
    delivered: { titulo: 'El que más lleva al granero', unidad: 'cultivos' },
    walked: { titulo: 'El más andarín', unidad: 'pasos' },
    naps: { titulo: 'El más dormilón', unidad: 'siestas' },
    complaints: { titulo: 'El más quejica', unidad: 'quejas' },
  },
};

export const NOMBRES = ['Pepín', 'Tomasito', 'Gilberto', 'Remolacho', 'Anselmo', 'Fermín', 'Rufino', 'Baldomero', 'Eustaquio', 'Nicanor', 'Cosme', 'Telesforo', 'Casimiro', 'Leoncio', 'Hermenegildo', 'Pancracio'];
export const APELLIDOS = ['Barbatiesa', 'el Breve', 'Pocasprisas', 'Raíztorcida', 'Narizota', 'de la Acelga', 'Tresbotas', 'Sinsiesta', 'Gorrotuerto', 'Mediapapa', 'Terronillo', 'del Surco', 'Calabacín', 'Espigado'];

export const LOG = {
  inicio: 'El huerto abre. Los gnomos todavía no han llegado.',
  contratado: (n: string, oficio: string) => `${n} se une al huerto como ${oficio.toLowerCase()}. Ha traído su propia taza.`,
  siesta: ['se ha echado una siesta. Dice que es «estratégica».', 'se ha dormido de pie. Otra vez.', 'está «descansando la vista».'],
  plantar: ['ha plantado una semilla y le ha deseado suerte.', 'ha plantado una semilla al revés. Crecerá igual.', 'le ha puesto nombre a una semilla.'],
  protesta: (n: string) => `${n} protesta: «¿Quién ha decidido que esto lo lleve yo?»`,
  entrega: (n: string, que: string, monedas: number) => `${n} ha dejado ${que} en el granero. +${monedas} monedas.`,
  variosCultivos: (k: number) => `${k} cultivos`,
  cestaLlena: (n: string) => `${n} espera con el saco lleno: la cesta no da para más.`,
  manual: (uno: string) => `Has recogido ${uno} tú solo. Los gnomos aplauden sin muchas ganas.`,
  mejora: (nombre: string) => `Has comprado «${nombre}». Los gnomos fingen que les impresiona.`,
  desbloqueo: (plural: string) => `Ya se puede plantar ${plural}. Los gnomos ya se están quejando del peso.`,
  porteadores: 'El gremio de porteadores abre sus puertas. Exigen descanso los martes.',
  bancal: (c: number, r: number) => `El bancal crece a ${c} × ${r}. Los gnomos miran la tierra nueva con desconfianza.`,
  casa: (camas: number) => `La casa de gnomos crece: ya hay ${camas} camas. Discuten quién duerme arriba.`,
  cambioGrupo: (n: string, grupo: string) => `${n} se cambia a «${grupo}». Se despide de los demás con mucho drama.`,
  grupoNuevo: (g: string) => `Se funda «${g}». Nadie sabe muy bien para qué.`,
  grupoRenombrado: (a: string, b: string) => `«${a}» ahora se llama «${b}». Lo han votado a mano alzada.`,
  grupoBorrado: (a: string, b: string) => `«${a}» se disuelve. Sus miembros vuelven a «${b}» con la cabeza gacha.`,
  podrido: (uno: string) => `Se ha echado a perder ${uno}. Huele a reproche.`,
  arrancar: (n: string) => `${n} arranca una planta pocha y le da el pésame.`,
  primeraCorona: (n: string, oficio: string) => `${n} es el primer «mejor ${oficio} del mes». Nadie sabe quién decide esto, pero ya lleva corona.`,
  corona: (nuevo: string, viejo: string, oficio: string) => `${nuevo} le quita a ${viejo} la corona de mejor ${oficio}. Dice que no le importa, pero no se la quita ni para dormir.`,
};
